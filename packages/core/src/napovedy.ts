// Nápovedy majstra Melichara (Michal 2026-10-24, roadmapa #85 a #14). Krátka
// výučba učí len jedno kolo; zvyšok povie Melichar v partii, keď sa vec hráčovi
// objaví prvýkrát. Texty a poradie sú dáta (data/vyucba/napovedy.json), tu je
// len rozpoznanie situácie.
//
// Rozpoznáva sa VÝHRADNE z pohľadu hráča (ClientState z viewFor): súperova ruka,
// jeho balíček stavby ani skryté Záverečné do rozhodnutia nevstupujú — nápoveda
// tak súperovi nič neprezradí a klient ju smie počítať sám (pravidlo 2).
// Spúšťače sú stavové, nie prechodové: nápoveda, ktorá sa pre inú s nižším
// poradím neukázala, sa ukáže pri ďalšom pohľade, kde jej situácia ešte platí.

import type { PlayerId } from "./types.ts";
import type { GameData } from "./data.ts";
import { defOf } from "./data.ts";
import type { ClientState } from "./view.ts";
import { cenaPatronatu, patronatMozny, priazenHraca, priazenSila, prebudenyPre, vydesil } from "./elders.ts";
import { zakazNaex } from "./effects.ts";
import { kandidatiNaNahradu, kartyZaPas, lineState, nahladPitky, naexCieleVLinii, prahyHraca, verejneAbstaky } from "./engine.ts";
import { evaluateLine } from "./partia.ts";
import { stavZavislosti } from "./zavislost.ts";

/** Jedna nápoveda v katalógu (napovedy.json). Text je jeden, alebo podľa variantu spúšťača. */
export interface NapovedaDef {
  readonly id: string;
  readonly poradie: number;
  readonly uroven?: string;
  readonly spustac?: { readonly lokality?: readonly string[] };
  readonly melichar: string | Readonly<Record<string, string>>;
  readonly zvyraznit: readonly string[];
}

export interface KatalogNapoved {
  readonly id: string;
  readonly verzia: number;
  readonly napovedy: readonly NapovedaDef[];
}

/** Nápoveda pripravená na bublinu: text a kľúče zvýraznenia s doplnenými zástupnými slovami. */
export interface Napoveda {
  readonly id: string;
  readonly poradie: number;
  readonly text: string;
  readonly zvyraznit: readonly string[];
}

interface Spustenie {
  readonly variant?: string;
  /** Do textu (názvy) — {lokalita}, {starsi}, {karta}. */
  readonly text?: Readonly<Record<string, string>>;
  /** Do kľúčov zvýraznenia (id) — {lokalita}, {elderId}, {defId}. */
  readonly kluce?: Readonly<Record<string, string>>;
}

type Spustac = (data: GameData, v: ClientState, ja: PlayerId, def: NapovedaDef) => Spustenie | null;

const ANO: Spustenie = {};

const naMojomTahuVZhromazdeni = (v: ClientState, ja: PlayerId): boolean =>
  v.faza === "zhromazdenie" && v.naTahu === ja && v.zhromazdenieStav !== null && !v.zhromazdenieStav.pasoval[ja];

/** Spúšťače podľa id nápovede — špecifikácia v docs/napady/napovedy-prva-partia.html. */
const SPUSTACE: Readonly<Record<string, Spustac>> = {
  "stavba-senku": (_d, v) =>
    v.faza === "draft" && v.draftStav?.krok === "stavba" && v.draftStav.mojBalicek.length > 0 && v.draftStav.mojVyber === null ? ANO : null,

  rola: (_d, v, ja) => (v.faza === "volbaCiela" && v.kolo === 1 ? { variant: v.utocnik === ja ? "utocnik" : "obranca" } : null),

  "odpoved-naex": (_d, v, ja) => (v.faza === "pitka" && v.pitkaStav?.reakcia === ja ? ANO : null),

  // Kým výučba nemá 2. časť o NA EX, predstaví ho nápoveda — v prvej Pitke, kde ho hráč naozaj smie dať.
  "prve-naex": (d, v, ja) => {
    const p = v.pitkaStav;
    if (v.faza !== "pitka" || v.naTahu !== ja || p === null || p.reakcia != null || p.hotovy[ja] || p.naexPouzity[ja]) return null;
    if (zakazNaex(v) || v.hraci[ja].poldeciPlne <= 0) return null;
    return naexCieleVLinii(d, lineState(v), ja).length > 0 ? ANO : null;
  },

  "pocet-pitiek": (_d, v) => ((v.faza === "zhromazdenie" || v.faza === "pitka") && v.pitkyCelkom >= 2 ? ANO : null),

  zadlzenie: (d, v, ja) => {
    if ((v.faza !== "zhromazdenie" && v.faza !== "pitka") || v.ciel === null) return null;
    const n = nahladPitky(d, v)[ja];
    return n.zadlzenie + n.zadlzenieZoStola > 0 ? ANO : null;
  },

  // Dlh sa hneď prizná — prvý v priznaných je prvý Dlh hráča.
  dlh: (_d, v, ja) => (v.hraci[ja].priznane.some((k) => k.defId === "dlh") ? ANO : null),

  "pas-cigarety": (_d, v, ja) => {
    if (!naMojomTahuVZhromazdeni(v, ja) || v.zhromazdenieStav === null) return null;
    // „Už som vyložil“ z pohľadu: moja karta leží v línii (do Zhromaždenia kola nič iné nedáva).
    const vylozil = v.strany.some((strana) => strana.some((pl) => pl.playedBy === ja));
    return vylozil && kartyZaPas(v.zhromazdenieStav, ja, v.hraci[ja].rukaPocet) >= 1 ? ANO : null;
  },

  "lokalita-pravidlo": (d, v, _ja, def) => {
    const lok = v.ciel?.lokalita ?? null;
    if (lok === null || v.faza === "volbaCiela" || !(def.spustac?.lokality ?? []).includes(lok.defId)) return null;
    const karta = defOf(d, lok);
    return { text: { lokalita: karta.name, efekt: karta.effectText }, kluce: { lokalita: lok.defId } };
  },

  body: (_d, v) => (v.kolo >= 2 ? ANO : null),

  pohorsenie: (_d, v, ja) =>
    v.faza === "bitka" && v.bitkaStav?.krok === "pohorsenie" && v.bitkaStav.caka !== null
      ? { variant: v.bitkaStav.caka === ja ? "moje" : "superove" }
      : null,

  abstak: (d, v, ja) => {
    if (verejneAbstaky(v, ja) > 0) return ANO;
    return naMojomTahuVZhromazdeni(v, ja) && stavZavislosti(d, v, ja).vyhlad === "ziska" ? ANO : null;
  },

  cirhoza: (_d, v) => (v.ruka.some((k) => k.defId === "cirhoza") ? ANO : null),

  priazen: (d, v, ja) => {
    const e = v.starsi.find((x) => !x.nahradeny && priazenHraca(x) === ja && priazenSila(x) > 0);
    return e === undefined ? null : { text: { starsi: defOf(d, e.karta).name }, kluce: { elderId: e.elderId } };
  },

  prevaha: (d, v) => {
    if ((v.faza !== "zhromazdenie" && v.faza !== "pitka") || v.ciel?.lokalita == null) return null;
    const stred = evaluateLine(d, lineState(v)).aktivneStredu;
    const zmiesana = (i: 0 | 1): boolean => v.strany[i].some((pl) => pl.playedBy === 0) && v.strany[i].some((pl) => pl.playedBy === 1);
    return ([0, 1] as const).some((i) => zmiesana(i) && stred[i] > 0) ? ANO : null;
  },

  // Tie isté podmienky ako moznyPatronat v jadre, len z pohľadu hráča (vlastná ruka je v ňom).
  patronat: (d, v, ja) => {
    const ds = v.draftStav;
    if (v.faza !== "draft" || ds === null || ds.krok !== "patronat" || ds.hotovo[ja] || v.patronat[ja] !== null) return null;
    const h = v.hraci[ja];
    if (h.poldeciPlne + h.poldeciVypite < 1 || kandidatiNaNahradu(d, v.ruka).length === 0) return null;
    const zabrate = new Set(v.patronat.flatMap((x) => (x === null ? [] : [x.elderId])));
    return v.starsi.some((e) => patronatMozny(e, ja) && h.cigarety >= cenaPatronatu(e).cigarety && !zabrate.has(e.elderId)) ? ANO : null;
  },

  vydesenie: (_d, v, ja) => {
    const e = v.starsi.find((x) => prebudenyPre(x) !== null);
    return e === undefined ? null : { variant: vydesil(e, ja) ? "moje" : "superove" };
  },

  dedicstvo: (d, v, ja) => {
    if (!naMojomTahuVZhromazdeni(v, ja)) return null;
    const k = v.ruka.find((x) => defOf(d, x).tags.includes("Nástroj"));
    return k === undefined ? null : { text: { karta: defOf(d, k).name }, kluce: { defId: k.defId } };
  },

  // Rovnako ako varovanie Dlhov v bare (Panely.tsx), len až keď nejaký Dlh je.
  exekutor: (d, v, ja) => {
    const p = prahyHraca(d, v, ja);
    return p.priznaneDlhy > 0 && p.priznaneDlhy >= p.exekutor - 2 ? ANO : null;
  },

  zaverecna: (_d, v, ja) => (v.kolo >= 2 && naMojomTahuVZhromazdeni(v, ja) && v.zaverecnaMozna ? ANO : null),
};

/** Id nápoved, ktoré jadro vie rozpoznať — test stráži, že sedia s napovedy.json. */
export const SPUSTACE_NAPOVED: readonly string[] = Object.keys(SPUSTACE);

const dopln = (s: string, hodnoty: Readonly<Record<string, string>>): string => s.replace(/\{(\w+)\}/g, (cele, k: string) => hodnoty[k] ?? cele);

/**
 * Nápovedy, ktorých situácia v tomto pohľade nastala, zoradené podľa poradia.
 * Ktoré už hráč videl, rieši volajúci (dalsiaNapoveda).
 */
export function napovedy(data: GameData, katalog: KatalogNapoved, view: ClientState): Napoveda[] {
  if (view.koniec !== null) return [];
  const out: Napoveda[] = [];
  for (const def of katalog.napovedy) {
    const s = SPUSTACE[def.id]?.(data, view, view.ja, def) ?? null;
    if (s === null) continue;
    const text = typeof def.melichar === "string" ? def.melichar : (def.melichar[s.variant ?? ""] ?? null);
    if (text === null) continue;
    out.push({
      id: def.id,
      poradie: def.poradie,
      text: dopln(text, s.text ?? {}),
      zvyraznit: def.zvyraznit.map((k) => dopln(k, s.kluce ?? {})),
    });
  }
  return out.sort((a, b) => a.poradie - b.poradie);
}

/** Najdôležitejšia nápoveda, ktorú hráč ešte nevidel, alebo null — v bubline je najviac jedna. */
export function dalsiaNapoveda(data: GameData, katalog: KatalogNapoved, view: ClientState, videne: ReadonlySet<string>): Napoveda | null {
  return napovedy(data, katalog, view).find((n) => !videne.has(n.id)) ?? null;
}

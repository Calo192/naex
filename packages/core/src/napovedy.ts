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
import { priazenHraca, priazenSila, vydesil } from "./elders.ts";
import { cigaretyZaPas, lineState, nahladPitky, naexCieleVLinii, prahyHraca, verejneAbstaky } from "./engine.ts";
import { bodyRozdelenia, krokRozdelenia, moznostiAkcie } from "./rozdelenie.ts";
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
    if (v.hraci[ja].poldeciPlne <= 0) return null;
    return naexCieleVLinii(d, lineState(v), ja).length > 0 ? ANO : null;
  },

  "pocet-pitiek": (_d, v) => ((v.faza === "zhromazdenie" || v.faza === "pitka") && v.pitkyCelkom >= 2 ? ANO : null),

  zadlzenie: (d, v, ja) => {
    if ((v.faza !== "zhromazdenie" && v.faza !== "pitka") || v.ciel === null) return null;
    const n = nahladPitky(d, v)[ja];
    return n.zadlzenie + n.zadlzenieZoStola > 0 ? ANO : null;
  },

  // Dlh je hneď priznaný (počítadlo) — prvý je prvý Dlh hráča.
  dlh: (_d, v, ja) => (v.hraci[ja].dlhy > 0 ? ANO : null),

  // v12.3: limit za poldeci a pas za cigaretu na každý plný poldeci. Hráč, ktorý už kartu vyložil a plný
  // poldeci mu ostal, sa rozhoduje, či vykladať ďalej, alebo pasovať. Zhromaždenie samo nemá počítadlo
  // vyložených kariet, preto stačí moja karta v línii — v tomto kole, línia sa po bitke vyprázdni.
  "pas-cigarety": (_d, v, ja) =>
    naMojomTahuVZhromazdeni(v, ja) && cigaretyZaPas(v, ja) >= 1 && v.strany.some((s) => s.some((pl) => pl.playedBy === ja)) ? ANO : null,

  "lokalita-pravidlo": (d, v, _ja, def) => {
    const lok = v.ciel?.lokalita ?? null;
    if (lok === null || v.faza === "volbaCiela" || !(def.spustac?.lokality ?? []).includes(lok.defId)) return null;
    const karta = defOf(d, lok);
    return { text: { lokalita: karta.name, efekt: karta.effectText }, kluce: { lokalita: lok.defId } };
  },

  body: (_d, v) => (v.kolo >= 2 ? ANO : null),

  // v10 (Hádka, texty schválil Michal 2026-11-01): id ostáva „pohorsenie“; variant podľa víťaza hádky
  // (v11: kým víťaz rozdeľuje hádku na reči).
  pohorsenie: (_d, v, ja) => {
    const h = v.faza === "bitka" && v.bitkaStav?.krok === "reci" ? v.bitkaStav.hadka : undefined;
    return h === undefined || h.vitaz === null ? null : { variant: h.vitaz === ja ? "moje" : "superove" };
  },

  abstak: (d, v, ja) => {
    if (verejneAbstaky(v, ja) > 0) return ANO;
    return naMojomTahuVZhromazdeni(v, ja) && stavZavislosti(d, v, ja).vyhlad === "ziska" ? ANO : null;
  },

  cirhoza: (_d, v) => (v.ruka.some((k) => k.defId === "cirhoza") ? ANO : null),

  priazen: (d, v, ja) => {
    const e = v.starsi.find((x) => priazenHraca(x) === ja && priazenSila(x) > 0);
    return e === undefined ? null : { text: { starsi: defOf(d, e.karta).name }, kluce: { elderId: e.elderId } };
  },

  prevaha: (d, v) => {
    if ((v.faza !== "zhromazdenie" && v.faza !== "pitka") || v.ciel?.lokalita == null) return null;
    const stred = evaluateLine(d, lineState(v)).aktivneStredu;
    const zmiesana = (i: 0 | 1): boolean => v.strany[i].some((pl) => pl.playedBy === 0) && v.strany[i].some((pl) => pl.playedBy === 1);
    return ([0, 1] as const).some((i) => zmiesana(i) && stred[i] > 0) ? ANO : null;
  },

  // Kľúč „patronat“ ostáva pre texty nápovied; od v11.4 je to zajatie pri rozdelení Nakladačky
  // (tie isté podmienky ako moznostiAkcie v jadre).
  patronat: (_d, v, ja) =>
    v.faza === "bitka" && krokRozdelenia(v, ja) === "prebytok" && moznostiAkcie(v, ja, "strach", bodyRozdelenia(v, ja)).length > 0 ? ANO : null,

  // Presvedčenie (v11.4) pri rozdelení hádky.
  presvedcenie: (_d, v, ja) =>
    v.faza === "bitka" && krokRozdelenia(v, ja) === "reci" && moznostiAkcie(v, ja, "reci", bodyRozdelenia(v, ja)).length > 0 ? ANO : null,

  vydesenie: (_d, v, ja) => {
    // Od v9 stav „vydesený“ (stupeň 3) — taký starší sa dá zajať.
    const e = v.starsi.find((x) => vydesil(x, 0) || vydesil(x, 1));
    return e === undefined ? null : { variant: vydesil(e, ja) ? "moje" : "superove" };
  },

  dedicstvo: (d, v, ja) => {
    if (!naMojomTahuVZhromazdeni(v, ja)) return null;
    const k = v.ruka.find((x) => defOf(d, x).tags.includes("Nástroj"));
    return k === undefined ? null : { text: { karta: defOf(d, k).name }, kluce: { defId: k.defId } };
  },

  // Exekúcia bez prahu (Michal 2026-10-28): prvý priznaný Dlh — Exekútor príde v najbližšej bitke.
  exekutor: (d, v, ja) => (prahyHraca(d, v, ja).priznaneDlhy > 0 ? ANO : null),

  zaverecna: (_d, v, ja) => (v.kolo >= 2 && naMojomTahuVZhromazdeni(v, ja) && v.zaverecnaMozna ? ANO : null),
};

/** Id nápoved, ktoré jadro vie rozpoznať — test stráži, že sedia s napovedy.json. */
export const SPUSTACE_NAPOVED: readonly string[] = Object.keys(SPUSTACE);

const dopln = (s: string, hodnoty: Readonly<Record<string, string>>): string => s.replace(/\{(\w+)\}/g, (cele, k: string) => hodnoty[k] ?? cele);

/**
 * Nápovedy, ktorých situácia v tomto pohľade nastala, zoradené podľa poradia.
 * Ktoré už hráč videl, rieši volajúci (dalsiaNapoveda).
 */
/** Nápovedy o špakoch, starších na stupniciach, hádke a Exekútorovi: v režime Päta, Lakeť, Otočka nič také nie je. */
export const NAPOVEDY_MIMO_PATY: ReadonlySet<string> = new Set([
  "dlh",
  "body",
  "pohorsenie",
  "cirhoza",
  "priazen",
  "patronat",
  "presvedcenie",
  "vydesenie",
  "exekutor",
]);

export function napovedy(data: GameData, katalog: KatalogNapoved, view: ClientState): Napoveda[] {
  if (view.koniec !== null) return [];
  const out: Napoveda[] = [];
  for (const def of katalog.napovedy) {
    if (view.pata !== undefined && NAPOVEDY_MIMO_PATY.has(def.id)) continue;
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

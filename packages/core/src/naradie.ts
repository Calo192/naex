// Hrany Nástroja a podloženie (rework Náradia, Michal 2026-11-08,
// docs/napady/naradie-hrany-zoznam.html v5 a naradie-mock-stol.html).
//
// Nástroj nemá sloty, má hornú a dolnú hranu. Do línie sa nevykladá: hráč ho podloží
// pod Občana či Starešinu natočený tak, že pretŕča jedna hrana, a platí len tá.
// Tvorca Vypálenej (v ňom admin sadu upravuje) pre hrany pole nemá, preto sú hrany
// v texte efektu za Dedičstvom — zápis preškolenia akcie „{X}→{Y}“ (preskolenie.ts):
//
//   Dedičstvo: Tvoje Rany udeľujú o 1 poškodenie viac. Hore: Vzbura. Dole: {Rana}→{Pecka}.
//
// Akciová hrana „{X}→{Y}“ mení všetky X na oboch hranách hostiteľa na Y ešte pred spojmi.
// Hrana posilnenia „Posilnená {X}“ (Puška, Michal 2026-11-09) posilní aktívne X hostiteľa (×2)
// tam, kde Forsáž — X po preškolení.
// Kartová hrana je slovo — Forsáž, NA EX, Výtržník, Vzbura — a dá hostiteľovi ten stav
// bez vedľajších nákladov cesty, ktorou vzniká inak (poldeci, nerest, pečeň). Text hrany
// sa len prečíta; čo hrana robí, rozhoduje jadro (partia.ts evaluateLine).

import type { Action, CardDef, CardInstance, Miesto, PlayerId, SideLayout, Slot } from "./types.ts";
import { akciaZTokenu, menoAkcie, preskolenieSlovami, rozborPreskolenia } from "./preskolenie.ts";

export type UcinokNastroja = "Forsáž" | "NA EX" | "Výtržník" | "Vzbura";
export const UCINKY_NASTROJA: readonly UcinokNastroja[] = ["Forsáž", "NA EX", "Výtržník", "Vzbura"];

export type HranaNastroja =
  | { readonly druh: "akcia"; readonly z: Action; readonly na: Action }
  | { readonly druh: "karta"; readonly ucinok: UcinokNastroja }
  | { readonly druh: "posilnenie"; readonly akcia: Action };

/** Zápis hrany posilnenia „Posilnená {Petelica}“ — tvar slova podľa rodu akcie, hra berie ktorýkoľvek. */
const POSILNENA = /^Posilnen[áýé]\s*\{([^{}]+)\}$/u;

const MUZSKE: readonly Action[] = ["Dlh", "Odpor", "Pakt"];
const STREDNE: readonly Action[] = ["Poldeci", "Obmedzenie", "Pohoršenie", "Posilnenie"];

/** „Posilnená Petelica“, „Posilnený Hazard“, „Posilnené Obmedzenie“. */
export function posilnenaSlovami(a: Action): string {
  const tvar = MUZSKE.includes(a) ? "Posilnený" : STREDNE.includes(a) ? "Posilnené" : "Posilnená";
  return `${tvar} ${menoAkcie(a)}`;
}

/** Hrana slovami pre log a ponuku: „Rana → Pecka“, „Vzbura“, „Posilnená Petelica“. */
export function hranaSlovami(h: HranaNastroja): string {
  return h.druh === "akcia" ? preskolenieSlovami(h) : h.druh === "karta" ? h.ucinok : posilnenaSlovami(h.akcia);
}

export type KtoraHrana = "horna" | "dolna";
export const KTORE_HRANY: readonly KtoraHrana[] = ["horna", "dolna"];

export interface HranyNastroja {
  readonly horna: HranaNastroja;
  readonly dolna: HranaNastroja;
}

/** Nástroj podložený pod kartu v línii — verejný, leží do bitky. */
export interface PodlozenyNastroj {
  readonly card: CardInstance;
  /** Kto ho podložil — po bitke ide do jeho odhadzovacieho balíčka, nie majiteľovi hostiteľa. */
  readonly majitel: PlayerId;
  /** Hrana, ktorá spod hostiteľa pretŕča; natočenie sa po podložení nemení. */
  readonly hrana: KtoraHrana;
  /** 2 na 2: člen tímu, ktorý ho podložil. */
  readonly miesto?: Miesto;
}

const bezDiakritiky = (s: string): string => s.replace(/\s+/g, "").toLocaleLowerCase("sk").normalize("NFD").replace(/\p{M}/gu, "");

// Hrana je veta „Hore: …“ či „Dole: …“ — od dvojbodky po bodku, výkričník alebo koniec textu.
const HRANA = /(?<=^|[\s.!?])(Hore|Dole):\s*([^.!?\n]*?)\s*(?:[.!?]+|(?=\n)|(?=\s(?:Hore|Dole):)|$)/gu;

export interface RozborHran {
  readonly horna: HranaNastroja | null;
  readonly dolna: HranaNastroja | null;
  /** Chyby zápisu — neznáma akcia či účinok, hrana dvakrát. Chýbajúcu hranu hlási chybyHran. */
  readonly chyby: readonly string[];
}

function hranaZTextu(obsah: string, kde: string, chyby: string[]): HranaNastroja | null {
  const r = rozborPreskolenia(obsah);
  if (r !== null) {
    for (const ch of r.chyby) chyby.push(`„${kde}: ${obsah}“ — ${ch}`);
    return r.preskolenie === null ? null : { druh: "akcia", ...r.preskolenie };
  }
  const posil = POSILNENA.exec(obsah);
  if (posil !== null) {
    const akcia = akciaZTokenu(posil[1] ?? "");
    if (akcia !== null) return { druh: "posilnenie", akcia };
    chyby.push(`„${kde}: ${obsah}“ — {${posil[1] ?? ""}} nie je akcia, ktorú hra pozná.`);
    return null;
  }
  const ucinok = UCINKY_NASTROJA.find((u) => bezDiakritiky(u) === bezDiakritiky(obsah));
  if (ucinok !== undefined) return { druh: "karta", ucinok };
  chyby.push(`„${kde}: ${obsah}“ — hrana je preškolenie {Akcia}→{Akcia}, posilnenie „Posilnená {Akcia}“ alebo účinok ${UCINKY_NASTROJA.join(", ")}.`);
  return null;
}

/** Prečíta hrany z textu efektu karty. */
export function rozborHran(text: string): RozborHran {
  const chyby: string[] = [];
  const najdene: { horna: HranaNastroja | null; dolna: HranaNastroja | null } = { horna: null, dolna: null };
  const videne = new Set<string>();
  for (const m of text.matchAll(HRANA)) {
    const kde = m[1] ?? "";
    if (videne.has(kde)) {
      chyby.push(`„${kde}:“ je v texte dvakrát — Nástroj má jednu hornú a jednu dolnú hranu.`);
      continue;
    }
    videne.add(kde);
    const hrana = hranaZTextu((m[2] ?? "").trim(), kde, chyby);
    if (kde === "Hore") najdene.horna = hrana;
    else najdene.dolna = hrana;
  }
  return { ...najdene, chyby };
}

/** Text efektu bez viet s hranami — zvyšok je Dedičstvo a efekty, ktoré číta navyse.ts. */
export function textBezHran(text: string): string {
  return text.replace(HRANA, "").replace(/[ \t]{2,}/gu, " ").trim();
}

/** Text efektu s hranami slovami („Dole: Rana → Pecka“) — kým karta nemá rám s hranami, hráč ich číta z textu. */
export function hranySlovami(text: string): string {
  return text.replace(HRANA, (cely: string, kde: string, obsah: string) => {
    const h = hranaZTextu(obsah.trim(), kde, []);
    if (h === null || h.druh === "karta") return cely;
    const koniec = /[.!?]\s*$/u.exec(cely)?.[0] ?? "";
    return `${kde}: ${hranaSlovami(h)}${koniec}`;
  });
}

/**
 * Chyby hrán karty pre tvorcu a test sady: chyby zápisu, hrany na karte, ktorá nie je
 * Nástroj, a chýbajúca hrana Nástroja. Nástroj bez hrán sa dá len vyložiť do Dedičstva.
 */
export function chybyHran(def: Pick<CardDef, "effectText" | "tags">): string[] {
  const out = chybyZapisuHran(def);
  const r = rozborHran(def.effectText);
  if (def.tags.includes("Nástroj") && r.chyby.length === 0) {
    if (r.horna === null) out.push("Nástroju chýba horná hrana („Hore: {Akcia}→{Akcia}.“ alebo „Hore: Vzbura.“).");
    if (r.dolna === null) out.push("Nástroju chýba dolná hrana („Dole: {Akcia}→{Akcia}.“ alebo „Dole: Forsáž.“).");
  }
  return out;
}

/**
 * Chyby zápisu hrán, pre ktoré načítanie sady spadne (preklep by hranu potichu vypol):
 * neznáma akcia či účinok, hrana dvakrát, hrany na karte, ktorá nie je Nástroj. Nástroj
 * bez hrán načítanie prejde — sada z tvorcu ich dostane až po prepise (pravidlo 5).
 */
export function chybyZapisuHran(def: Pick<CardDef, "effectText" | "tags">): string[] {
  const r = rozborHran(def.effectText);
  const out = [...r.chyby];
  const ma = r.horna !== null || r.dolna !== null || r.chyby.length > 0;
  if (!def.tags.includes("Nástroj") && ma) out.push("Hrany „Hore:“ a „Dole:“ má len Nástroj.");
  return out;
}

const pamat = new Map<string, HranyNastroja | null>();

/** Hrany Nástroja; null = karta nie je Nástroj alebo hrany v texte nemá celé (podložiť sa nedá). */
export function hranyNastroja(def: Pick<CardDef, "effectText" | "tags">): HranyNastroja | null {
  if (!def.tags.includes("Nástroj")) return null;
  const ulozene = pamat.get(def.effectText);
  if (ulozene !== undefined) return ulozene;
  const r = rozborHran(def.effectText);
  const hrany = r.horna !== null && r.dolna !== null ? { horna: r.horna, dolna: r.dolna } : null;
  pamat.set(def.effectText, hrany);
  return hrany;
}

/** Definície kariet, ako ich potrebujú funkcie nižšie (GameData aj testy). */
export interface DataNaradia {
  readonly cards: ReadonlyMap<string, Pick<CardDef, "effectText" | "tags">>;
}

/** Pretŕčajúca hrana podloženého Nástroja; null pri Nástroji bez hrán (stará sada). */
export function aktivnaHrana(data: DataNaradia, n: PodlozenyNastroj): HranaNastroja | null {
  const def = data.cards.get(n.card.defId);
  const hrany = def === undefined ? null : hranyNastroja(def);
  return hrany === null ? null : hrany[n.hrana];
}

/** Karta v línii, ako ju vidia hrany (PlacedCard aj pohľad klienta). */
export interface KartaSNastrojmi {
  readonly podlozene?: readonly PodlozenyNastroj[];
}

/**
 * Preškolenie akcií hostiteľa: akcia → na čo ju zmenil prvý podložený Nástroj (v poradí podloženia)
 * s touto akciou na pretŕčajúcej hrane. Dva Nástroje sa nereťazia (pod Zámočníkom Pečeň → Rana
 * a Rana → Pecka nedajú z Pečene Pecku); reťaz Školiteľ → Nástroj (v11.20) skladá partia.ts.
 */
export function preskoleniaHostitela(data: DataNaradia, pl: KartaSNastrojmi): ReadonlyMap<Action, { readonly na: Action; readonly uid: number }> {
  const out = new Map<Action, { na: Action; uid: number }>();
  for (const n of pl.podlozene ?? []) {
    const h = aktivnaHrana(data, n);
    if (h?.druh === "akcia" && !out.has(h.z)) out.set(h.z, { na: h.na, uid: n.card.uid });
  }
  return out;
}

/**
 * Posilnenia akcií hostiteľa: akcia → defId Nástroja, ktorého hrana ju posilňuje (prvý v poradí
 * podloženia). Dva Nástroje s tou istou akciou pod Zámočníkom posilnia raz — ako dve Forsáže.
 */
export function posilneniaHostitela(data: DataNaradia, pl: KartaSNastrojmi): ReadonlyMap<Action, string> {
  const out = new Map<Action, string>();
  for (const n of pl.podlozene ?? []) {
    const h = aktivnaHrana(data, n);
    if (h?.druh === "posilnenie" && !out.has(h.akcia)) out.set(h.akcia, n.card.defId);
  }
  return out;
}

const ZIADNE_UCINKY: ReadonlySet<UcinokNastroja> = new Set();

/** Kartové účinky podložených Nástrojov na hostiteľovi. */
export function ucinkyNastrojov(data: DataNaradia, pl: KartaSNastrojmi): ReadonlySet<UcinokNastroja> {
  if (pl.podlozene === undefined || pl.podlozene.length === 0) return ZIADNE_UCINKY;
  const out = new Set<UcinokNastroja>();
  for (const n of pl.podlozene ?? []) {
    const h = aktivnaHrana(data, n);
    if (h?.druh === "karta") out.add(h.ucinok);
  }
  return out;
}

/** Jeden slot hostiteľa po preškolení: akcia, ktorou je, a vytlačená akcia, ak ju Nástroj zmenil. */
export interface SlotPoPreskoleni {
  readonly akcia: Action;
  /** Vytlačená akcia — chýba, keď ju Nástroj nezmenil (klient ju kreslí prečiarknutú v rožku). */
  readonly povodna?: Action;
  /** uid Nástroja (v línii aj Školiteľa), ktorý slot zmenil. */
  readonly nastroj?: number;
  /** uid Nástroja, ktorý v reťazi (v11.20) preškolil výstup Školiteľa `nastroj`. */
  readonly potom?: number;
}

/** Strana karty po preškolení (Nástroje, v línii aj Školitelia) — v tom istom ráme ako `strana`. */
export function preskolStranu(premeny: ReadonlyMap<Action, { readonly na: Action; readonly uid: number; readonly potom?: number }>, strana: readonly Slot[]): (SlotPoPreskoleni | null)[] {
  return strana.map((a) => {
    if (a === null) return null;
    const p = premeny.get(a);
    return p === undefined ? { akcia: a } : { akcia: p.na, povodna: a, nastroj: p.uid, ...(p.potom !== undefined ? { potom: p.potom } : {}) };
  });
}

/** Strana karty ako SideLayout po preškolení (vstup výpočtu spojov). */
export function preskolenaStrana(premeny: ReadonlyMap<Action, { readonly na: Action; readonly uid: number }>, strana: SideLayout): SideLayout {
  if (premeny.size === 0) return strana;
  return strana.map((a) => (a === null ? null : (premeny.get(a)?.na ?? a))) as unknown as SideLayout;
}

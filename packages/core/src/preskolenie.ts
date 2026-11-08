// Preškolenie akcie „{X}→{Y}“ (Michal 2026-11-08, docs/napady/premeny-akcii.html): akcia X sa
// ráta ako Y. Zápis je spoločný pre hrany Nástroja (naradie.ts) a efekty Školiteľov (nižšie).
// Tu sa zápis len prečíta; kedy a čo preškolenie mení, rozhoduje ten, kto ho používa.

import type { Action, CardDef } from "./types.ts";
import { ALL_ACTIONS } from "./types.ts";

/** Názvy akcií z tvorcu, ktoré sa líšia od kľúča (Hazard je akcia Dlh, Pečeň je Poškodenie pečene). */
const ALIAS_AKCIE: Readonly<Record<string, Action>> = { Hazard: "Dlh", Cigaretka: "Cigareta", Pečeň: "PoškodeniePečene" };

const bezMedzier = (s: string): string => s.replace(/\s+/g, "").toLocaleLowerCase("sk");

/** Akcia z piktogramu {…} v texte efektu (kľúč akcie alebo jej meno v tvorcovi), null = neznáma. */
export function akciaZTokenu(token: string): Action | null {
  const t = bezMedzier(token);
  for (const a of ALL_ACTIONS) if (bezMedzier(a) === t) return a;
  for (const [alias, a] of Object.entries(ALIAS_AKCIE)) if (bezMedzier(alias) === t) return a;
  return null;
}

/** Meno akcie tak, ako ho hráč pozná z karty (Dlh je Hazard, Poškodenie pečene Pečeň). */
export function menoAkcie(a: Action): string {
  return a === "Dlh" ? "Hazard" : a === "PoškodeniePečene" ? "Pečeň" : a;
}

export interface PreskolenieAkcie {
  readonly z: Action;
  readonly na: Action;
}

/** Šípka preškolenia: „→“, pri písaní bez nej aj „->“ či „=>“. */
const SIPKA = String.raw`(?:→|->|=>)`;
/** Jedno preškolenie „{X}→{Y}“ kdekoľvek v texte. */
export const ZAPIS_PRESKOLENIA = new RegExp(String.raw`\{([^{}]+)\}\s*${SIPKA}\s*\{([^{}]+)\}`, "gu");
const CELY_ZAPIS = new RegExp(String.raw`^\{([^{}]+)\}\s*${SIPKA}\s*\{([^{}]+)\}$`, "u");

export interface RozborPreskolenia {
  /** null = zápis má chybu (chyby). */
  readonly preskolenie: PreskolenieAkcie | null;
  readonly chyby: readonly string[];
}

/** Premena zo zápisu „{X}→{Y}“, ktorý tvorí celý `text`; null = text taký zápis nie je. */
export function rozborPreskolenia(text: string): RozborPreskolenia | null {
  const m = CELY_ZAPIS.exec(text.trim());
  if (m === null) return null;
  return preskolenieZTokenov(m[1] ?? "", m[2] ?? "");
}

/** Všetky preškolenia „{X}→{Y}“ v texte, v poradí výskytu. */
export function preskoleniaVTexte(text: string): RozborPreskolenia[] {
  return [...text.matchAll(ZAPIS_PRESKOLENIA)].map((m) => preskolenieZTokenov(m[1] ?? "", m[2] ?? ""));
}

function preskolenieZTokenov(x: string, y: string): RozborPreskolenia {
  const z = akciaZTokenu(x);
  const na = akciaZTokenu(y);
  const chyby: string[] = [];
  if (z === null) chyby.push(`{${x}} nie je akcia, ktorú hra pozná.`);
  if (na === null) chyby.push(`{${y}} nie je akcia, ktorú hra pozná.`);
  if (z !== null && z === na) chyby.push(`{${x}}→{${y}} — preškolenie na tú istú akciu nič nerobí.`);
  return { preskolenie: chyby.length === 0 && z !== null && na !== null ? { z, na } : null, chyby };
}

/** Text preškolenia slovami: „Rana → Pecka“. */
export function preskolenieSlovami(p: PreskolenieAkcie): string {
  return `${menoAkcie(p.z)} → ${menoAkcie(p.na)}`;
}

// ---------------------------------------------------------------------------
// Školitelia (Michal 2026-11-08, docs/napady/obcania-kategorie.json): Občan s efektom
// „Spúšťač: Preškolenie {X}→{Y}.“ preškolí akciu X iných kariet na Y.
//
//   Furt     — obaja susedia v línii (karty oboch hráčov), kým s ním susedia; lícom dole tiež
//   Podpora  — tvoja karta, s ktorou sa stretne priložením, do konca kola
//   Konflikt — súperova karta, s ktorou sa stretne priložením, do konca kola
//
// Preškolenie platí pred spojmi ako hrana Nástroja. Akcia sa preškolí raz — prvou premenou
// v poradí Nástroj pod kartou → Podpora a Konflikt v poradí spustenia → Furt; nereťazí sa.
// Text sa tu len prečíta; dosah počíta partia.ts (premenyVLinii), spustenie engine.ts.

export type SpustacPreskolenia = "Furt" | "Podpora" | "Konflikt";
export const SPUSTACE_PRESKOLENIA: readonly SpustacPreskolenia[] = ["Furt", "Podpora", "Konflikt"];

export interface EfektPreskolenia extends PreskolenieAkcie {
  readonly spustac: SpustacPreskolenia;
}

export interface RozborPreskoleniKarty {
  readonly efekty: readonly EfektPreskolenia[];
  /** Chyby zápisu — spúšťač, neznáma akcia, modifikátor, X = Y. Prázdne = v poriadku. */
  readonly chyby: readonly string[];
}

/** Kľúčové slovo efektu Školiteľa. */
export const PRESKOLENIE = "Preškolenie";

/** Modifikátory spoja menia len hrany Nástroja (Hrable, Energeťák) — Školiteľ nie. */
const MODIFIKATORY: readonly Action[] = ["Posilnenie", "Odpor", "Pakt"];

// Skupiny: 1 spúšťač (slová pred dvojbodkou na začiatku vety), 2 X, 3 Y; zápis môže chýbať.
const EFEKT_PRESKOLENIA = new RegExp(
  String.raw`(?<=^\s*|[.!?]\s*)([\p{L}][\p{L} ]*?):\s*${PRESKOLENIE}(?![\p{L}])(?:\s*\{([^{}]+)\}\s*${SIPKA}\s*\{([^{}]+)\})?`,
  "gu",
);
/** Zápis „Preškolenie {X}→{Y}“ bez spúšťača — to, čo v texte nie je akcia navyše ani text. */
const ZAPIS_ZA_SLOVOM = new RegExp(String.raw`(${PRESKOLENIE})\s*\{[^{}]+\}\s*${SIPKA}\s*\{[^{}]+\}`, "gu");

/** Prečíta efekty Preškolenie z textu efektu karty. */
export function rozborPreskoleniKarty(text: string): RozborPreskoleniKarty {
  const efekty: EfektPreskolenia[] = [];
  const chyby: string[] = [];
  let najdenych = 0;
  for (const m of text.matchAll(EFEKT_PRESKOLENIA)) {
    najdenych++;
    const spustac = (m[1] ?? "").trim();
    if (!(SPUSTACE_PRESKOLENIA as readonly string[]).includes(spustac)) {
      chyby.push(`„${spustac}: ${PRESKOLENIE}“ — Preškolenie má spúšťač ${SPUSTACE_PRESKOLENIA.join(", ")}.`);
      continue;
    }
    if (m[2] === undefined || m[3] === undefined) {
      chyby.push(`„${spustac}: ${PRESKOLENIE}“ — chýba zápis {Akcia}→{Akcia}.`);
      continue;
    }
    const r = preskolenieZTokenov(m[2], m[3]);
    chyby.push(...r.chyby);
    if (r.preskolenie === null) continue;
    const modifikator = [r.preskolenie.z, r.preskolenie.na].find((a) => MODIFIKATORY.includes(a));
    if (modifikator !== undefined) {
      chyby.push(`{${modifikator}} — Preškolenie Školiteľa nemení modifikátory spoja (${MODIFIKATORY.join(", ")}).`);
      continue;
    }
    efekty.push({ spustac: spustac as SpustacPreskolenia, ...r.preskolenie });
  }
  // „Preškolenie“ inde ako hneď za spúšťačom by hra potichu nevyhodnotila.
  const slov = [...text.matchAll(new RegExp(String.raw`${PRESKOLENIE}(?![\p{L}])`, "gu"))].length;
  if (slov > najdenych) chyby.push(`„${PRESKOLENIE}“ patrí hneď za spúšťač: „Furt: ${PRESKOLENIE} {Akcia}→{Akcia}.“`);
  return { efekty, chyby };
}

/** Text efektu bez zápisov {X}→{Y} za slovom Preškolenie („Podpora: Preškolenie.“) — zvyšok číta navyse.ts. */
export function textBezPreskoleni(text: string): string {
  return text.replace(ZAPIS_ZA_SLOVOM, "$1");
}

const pamat = new Map<string, readonly EfektPreskolenia[]>();

/** Efekty Preškolenie karty (chybné zápisy odmietne už načítanie dát). Starší má v línii len akcie (v9). */
export function preskoleniaKarty(def: Pick<CardDef, "effectText" | "tags">): readonly EfektPreskolenia[] {
  if (def.tags.includes("Starešina") || !def.effectText.includes(PRESKOLENIE)) return [];
  const ulozene = pamat.get(def.effectText);
  if (ulozene !== undefined) return ulozene;
  const efekty = rozborPreskoleniKarty(def.effectText).efekty;
  pamat.set(def.effectText, efekty);
  return efekty;
}

/** Je karta Školiteľ (má efekt Preškolenie)? */
export function jeSkolitel(def: Pick<CardDef, "effectText" | "tags">): boolean {
  return preskoleniaKarty(def).length > 0;
}

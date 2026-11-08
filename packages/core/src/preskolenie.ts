// Preškolenie akcie „{X}→{Y}“ (Michal 2026-11-08, docs/napady/premeny-akcii.html): akcia X sa
// ráta ako Y. Zápis je spoločný pre hrany Nástroja (naradie.ts) a neskôr pre efekty kariet,
// ktoré menia jednu akciu na inú. Tu sa zápis len prečíta; kedy a čo preškolenie mení,
// rozhoduje ten, kto ho používa.

import type { Action } from "./types.ts";
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

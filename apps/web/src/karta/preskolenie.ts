// Preškolenie {X}→{Y} na líci karty (Michal 2026-11-08, docs/napady/premeny-akcii.html: pečať
// R5 „pilulka“, dotknutý slot D2) a hrany Nástroja (Náradie, naradie-mock-stol.html V1).
//
// Jediné miesto, kde klient číta preškolenia z textu efektu. Pečať berie dáta zo zápisu
// „Spúšťač: Preškolenie {X}→{Y}.“ (preskolenie.ts v jadre), nie z id karty — keď jadro dostane
// všeobecné Preškolenie s vlastným rozborom, napojí sa tu.

import type { Action, HranaNastroja, HranyNastroja } from "@naex/core";
import { ZAPIS_PRESKOLENIA, akciaZTokenu, rozborHran, textBezHran } from "@naex/core";

export interface PreskolenieVTexte {
  /** Spúšťač vety („Furt“, „Podpora“, „Konflikt“, „Dedičstvo“…); null = veta bez spúšťača. */
  readonly spustac: string | null;
  readonly z: Action;
  readonly na: Action;
}

/** Preškolenia „{X}→{Y}“ v texte efektu (bez hrán Nástroja), v poradí textu; zápis s chybou sa vynechá. */
export function preskoleniaZTextu(efekt: string): PreskolenieVTexte[] {
  const out: PreskolenieVTexte[] = [];
  for (const veta of textBezHran(efekt).split(/(?<=[.!?])\s+|\n/u)) {
    const spustac = /^\s*([\p{L} ]+?)\s*:/u.exec(veta)?.[1] ?? null;
    for (const m of veta.matchAll(ZAPIS_PRESKOLENIA)) {
      const z = akciaZTokenu(m[1] ?? "");
      const na = akciaZTokenu(m[2] ?? "");
      if (z !== null && na !== null && z !== na) out.push({ spustac, z, na });
    }
  }
  return out;
}

/** Text efektu bez zápisu „{X}→{Y}“ — ten kreslí pečať; slovo Preškolenie v texte ostáva. */
export function textBezPreskolenia(efekt: string): string {
  if (!/[→>]/u.test(efekt)) return efekt;
  // Hrany Nástroja („Dole: {Rana}→{Pecka}“) ostávajú — prečíta ich rám Nástroja alebo hranySlovami.
  return efekt
    .replace(new RegExp(String.raw`(?:(?:Hore|Dole):\s*)?${ZAPIS_PRESKOLENIA.source}`, "gu"), (m: string) => (/^(?:Hore|Dole):/u.test(m) ? m : ""))
    .replace(/[ \t]+([.,!?])/gu, "$1")
    .replace(/[ \t]{2,}/gu, " ")
    .trim();
}

/** Hrany karty Nástroja z textu; null = karta hrany nemá (iná karta alebo sada bez hrán). */
export function hranyZTextu(efekt: string, tagy: readonly string[]): HranyNastroja | null {
  if (!tagy.includes("Nástroj")) return null;
  const r = rozborHran(efekt);
  return r.horna !== null && r.dolna !== null ? { horna: r.horna, dolna: r.dolna } : null;
}

/** Vety pravidiel ku kartovým účinkom hrany — nápoveda pod myšou (PRAVIDLA §12). */
export const POPIS_UCINKU: Readonly<Record<string, string>> = {
  Forsáž: "Hostiteľ má Forsáž: jeho akcie aktívne po NA EX sú posilnené ×2 (neaktívne, ktoré NA EX aktivovalo, ×4).",
  "NA EX": "Hostiteľ má NA EX bez poldeca: aktívne akcie zrušené, neaktívne ×2.",
  Výtržník: "Hostiteľ je Výtržník: každá jeho akcia je Rana pre jeho majiteľa.",
  Vzbura: "Hostiteľ má Vzburu: jeho akcie sa obrátia.",
};

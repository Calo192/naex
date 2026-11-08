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

export type SmerHrany = "posila" | "sabotaz" | "obojaka" | "ucinok";

/**
 * Čo hrana robí, podľa zoznamu hrán v5 (docs/napady/naradie-hrany-zoznam.html, Michal 2026-11-08):
 * farba hrany na karte aj pod hostiteľom — zelená posila, červená sabotáž, modrá kartový účinok.
 * Hrany sú voľné, smer len hovorí, komu premena zvyčajne pomáha; neznáma premena je obojaká.
 */
const SMER_PRESKOLENIA: Readonly<Record<string, Exclude<SmerHrany, "ucinok">>> = {
  "Posilnenie>PoškodeniePečene": "sabotaz",
  "PoškodeniePečene>Poldeci": "posila",
  "Poldeci>PoškodeniePečene": "sabotaz",
  "Rana>Pecka": "posila",
  "Rana>Petelica": "posila",
  "Petelica>Rana": "sabotaz",
  "Pecka>Petelica": "posila",
  "Petelica>Pecka": "sabotaz",
  "PoškodeniePečene>Rana": "posila",
  "Pecka>Rana": "sabotaz",
  "Cigareta>Rana": "obojaka",
  "Cigareta>PoškodeniePečene": "sabotaz",
  "Viera>Pohoršenie": "posila",
  "Pohoršenie>Povera": "sabotaz",
  "Povera>Viera": "posila",
  "Viera>Povera": "sabotaz",
  "Povera>Pohoršenie": "posila",
  "Odpor>Povera": "sabotaz",
  "PoškodeniePečene>Viera": "posila",
  "Poldeci>Viera": "sabotaz",
  "PoškodeniePečene>Cigareta": "posila",
  "Dlh>Cigareta": "posila",
  "Dlh>Poldeci": "posila",
  "Cigareta>Dlh": "sabotaz",
  "Dlh>Vízia": "posila",
  "Vízia>Dlh": "sabotaz",
  "Dlh>Robota": "posila",
  "Robota>Dlh": "sabotaz",
  "Dlh>Povera": "posila",
  "Povera>Dlh": "sabotaz",
  "Povera>Vízia": "posila",
  "Vízia>Povera": "sabotaz",
  "Odpor>Posilnenie": "posila",
  "Posilnenie>Odpor": "sabotaz",
  "Odpor>Pakt": "posila",
  "Pakt>Odpor": "sabotaz",
  "PoškodeniePečene>Obmedzenie": "posila",
  "Pecka>Obmedzenie": "sabotaz",
  "PoškodeniePečene>Posilnenie": "posila",
  "PoškodeniePečene>Dlh": "obojaka",
};

export function smerHrany(h: HranaNastroja): SmerHrany {
  return h.druh === "karta" ? "ucinok" : (SMER_PRESKOLENIA[`${h.z}>${h.na}`] ?? "obojaka");
}

/** Vety pravidiel ku kartovým účinkom hrany — nápoveda pod myšou (PRAVIDLA §12). */
export const POPIS_UCINKU: Readonly<Record<string, string>> = {
  Forsáž: "Hostiteľ má Forsáž: jeho aktívne akcie sú posilnené ×2.",
  "NA EX": "Hostiteľ má NA EX bez poldeca: aktívne akcie zrušené, neaktívne ×2.",
  Výtržník: "Hostiteľ je Výtržník: každá jeho akcia je Rana pre jeho majiteľa.",
  Vzbura: "Hostiteľ má Vzburu: jeho akcie sa obrátia.",
};

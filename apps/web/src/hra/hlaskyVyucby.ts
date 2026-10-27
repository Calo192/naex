// Hlášky majstra Melichara vo výučbe (Michal 2026-10-27: „Chcem využiť soundbar
// majstra Melichara naplno… keď to je príhodné“). Zaznie len hláška, ktorú menuje
// scenár (krok, rada po zlom ťahu, zlá odpoveď kvízu) — nikdy náhodná pri
// momente. Text bubliny ostáva, hláška je len zvuk navyše.

import { castiHlasky, nazovHlasky } from "@naex/core";

/** Hláška zo zoznamu /api/melichar — len polia, podľa ktorých sa hľadá. */
export interface HlaskaZoznamu {
  readonly nazov: string;
  readonly skupina?: string;
  /** Súbor bez prípony; zoznam spred importu s menom ho nemá. */
  readonly meno?: string;
}

/**
 * Hláška scenára („skupina/súbor“) v zozname: podľa skupiny a mena, v starom
 * zozname bez mena podľa názvu, ktorý import spravil zo súboru.
 */
export function najdiHlaskuVyucby<H extends HlaskaZoznamu>(hlasky: readonly H[], hlaska: string | null | undefined): H | null {
  const c = hlaska === null || hlaska === undefined ? null : castiHlasky(hlaska);
  if (c === null) return null;
  const vSkupine = hlasky.filter((h) => h.skupina === c.skupina);
  const nazov = nazovHlasky(c.meno);
  return vSkupine.find((h) => h.meno === c.meno) ?? vSkupine.find((h) => h.meno === undefined && h.nazov === nazov) ?? null;
}

/** Čo zahrať; null = ticho (hlasitosť 0 v profile, bez hlášky, nahrávka chýba). */
export function hlaskaNaPrehratie<H extends HlaskaZoznamu>(hlasky: readonly H[], hlaska: string | null | undefined, hlasitost: number): H | null {
  return hlasitost > 0 ? najdiHlaskuVyucby(hlasky, hlaska) : null;
}

/** Krok tak, ako ho treba na rozhodnutie o hláške (KrokVyucby v useHra). */
export interface KrokSHlaskou {
  readonly kto: "hrac" | "bot" | "info" | "auto" | "otazka";
  readonly vykonany: boolean;
  readonly hlaska: string | null;
}

/**
 * Hláška kroku, ktorá má zaznieť teraz: keď bublinu vidno, pri ťahu bota či hry
 * za hráča až po ťahu — text na ťah reaguje („Štamgast hneď pasoval…“).
 */
export function hlaskaKroku(krok: KrokSHlaskou | null, bublinaVidno: boolean): string | null {
  if (krok === null || krok.hlaska === null || !bublinaVidno) return null;
  if ((krok.kto === "bot" || krok.kto === "auto") && !krok.vykonany) return null;
  return krok.hlaska;
}

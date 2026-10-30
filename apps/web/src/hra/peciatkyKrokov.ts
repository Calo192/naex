// Malé pečiatky krokov (Michal 2026-10-30): ako pečiatky momentov (prebudenie, výprask), len
// menšie a bez Melichara — keď hráč pasuje v Zhromaždení alebo prestane brať zo šenku. Berú
// sa z verejných udalostí motora (log pasu a konca brania), takže ich vidia obaja hráči.
// Koniec brania, keď sa šenok vyprázdnil, nie je rozhodnutie hráča — ten log nemá.

import type { Event, PlayerId } from "@naex/core";

export interface PeciatkaKroku {
  readonly hrac: PlayerId;
  readonly druh: "pas" | "dost";
}

const PAS = /^Hráč ([12]) pasuje do Pitky/;
const DOST = /^Hráč ([12]) už neberie zo šenku/;

/** Pečiatky, ktoré udalosti jedného ťahu vyvolali (pas v Zhromaždení, koniec brania zo šenku). */
export function peciatkyKrokov(events: readonly Event[]): PeciatkaKroku[] {
  const out: PeciatkaKroku[] = [];
  for (const e of events) {
    if (e.type !== "log") continue;
    const pas = PAS.exec(e.text);
    const dost = pas === null ? DOST.exec(e.text) : null;
    const m = pas ?? dost;
    if (m === null) continue;
    out.push({ hrac: (Number(m[1]) - 1) as PlayerId, druh: pas !== null ? "pas" : "dost" });
  }
  return out;
}

/** Text pečiatky a veta pod ňou. */
export function textPeciatkyKroku(p: PeciatkaKroku, ja: PlayerId, meno: string): { readonly nazov: string; readonly popis: string } {
  const ty = p.hrac === ja;
  return p.druh === "pas"
    ? { nazov: "PAS", popis: ty ? "Pasuješ do Pitky." : `${meno} pasuje do Pitky.` }
    : { nazov: "DOSŤ", popis: ty ? "Už neberieš zo šenku." : `${meno} už neberie zo šenku.` };
}

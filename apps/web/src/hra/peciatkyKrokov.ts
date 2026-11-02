// Malé pečiatky krokov (Michal 2026-10-30): ako pečiatky momentov (prebudenie, výprask), len
// menšie a bez Melichara — keď hráč pasuje v Zhromaždení alebo prestane brať zo šenku. Berú
// sa z verejných udalostí motora (log pasu a konca brania), takže ich vidia obaja hráči.
// Koniec brania, keď sa šenok vyprázdnil, nie je rozhodnutie hráča — ten log nemá.

import type { Event, PlayerId } from "@naex/core";

export interface PeciatkaKroku {
  readonly hrac: PlayerId;
  readonly druh: "pas" | "dost";
  /** Pas urobila hra, lebo hráč nemal čo vyložiť (udalosť autoPas, Michal 2026-11-02). */
  readonly auto?: true;
}

const PAS = /^Hráč ([12]) pasuje do Pitky/;
const DOST = /^Hráč ([12]) už neberie zo šenku/;

/** Pečiatky, ktoré udalosti jedného ťahu vyvolali (pas v Zhromaždení, koniec brania zo šenku). */
export function peciatkyKrokov(events: readonly Event[]): PeciatkaKroku[] {
  const out: PeciatkaKroku[] = [];
  const auto = new Set<PlayerId>();
  for (const e of events) {
    // autoPas ide tesne pred logom pasu toho istého hráča.
    if (e.type === "autoPas") auto.add(e.hrac);
    if (e.type !== "log") continue;
    const pas = PAS.exec(e.text);
    const dost = pas === null ? DOST.exec(e.text) : null;
    const m = pas ?? dost;
    if (m === null) continue;
    const hrac = (Number(m[1]) - 1) as PlayerId;
    if (pas !== null && auto.delete(hrac)) out.push({ hrac, druh: "pas", auto: true });
    else out.push({ hrac, druh: pas !== null ? "pas" : "dost" });
  }
  return out;
}

/** Text pečiatky a veta pod ňou. */
export function textPeciatkyKroku(p: PeciatkaKroku, ja: PlayerId, meno: string): { readonly nazov: string; readonly popis: string } {
  const ty = p.hrac === ja;
  if (p.auto === true) return { nazov: "PAS", popis: ty ? "Nemáš čo vyložiť — pasuješ do Pitky." : `${meno} nemá čo vyložiť — pasuje do Pitky.` };
  return p.druh === "pas"
    ? { nazov: "PAS", popis: ty ? "Pasuješ do Pitky." : `${meno} pasuje do Pitky.` }
    : { nazov: "DOSŤ", popis: ty ? "Už neberieš zo šenku." : `${meno} už neberie zo šenku.` };
}

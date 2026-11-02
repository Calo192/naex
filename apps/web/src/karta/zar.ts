// Žeravá ikona (Michal 2026-10-30, mock 3): akcia posilnená Nástrojom v Dedičstve
// majiteľa karty žhne ako uhlík (vyhasnutý útok z Úplatku zanikol vo v10.3).
// Údaje dáva jadro (vplyvyNaAkcie); tu sa len priradia slotom.

import type { VplyvNaAkciu } from "@naex/core";

/** Zmena akcie v slote karty — KartaLico ju kreslí ako žeravú či vyhasnutú ikonu. */
export interface ZarSlotu {
  readonly smer: "plus" | "minus";
  /** Krátky štítok vedľa ikony v lupe („Puška +1“). */
  readonly stitok: string;
  /** Veta do popisu akcie. */
  readonly popis: string;
  /** Čím je zmena daná — iná príčina = nové prvé zobrazenie (iskra). */
  readonly pricina: string;
}

/** Zmena akcie `akcia` na karte hráča, ktorý má `vplyvy` (Nástroje v Dedičstve). */
export function zarSlotu(
  akcia: string,
  vplyvy: readonly VplyvNaAkciu[],
  menoKarty: (defId: string) => string,
  uid?: number,
): ZarSlotu | null {
  // Vplyv viazaný na kartu (Zámočník pri Nástroji) platí len na nej.
  const v = vplyvy.find((x) => x.akcia === akcia && (x.uid === undefined || x.uid === uid));
  if (v === undefined) return null;
  const meno = menoKarty(v.zdroj);
  // Zmena bez čísla (Náradie 2026-10-30: Zapaľovač, Žreby…) — veta z jadra.
  if (v.popis !== undefined) return { smer: "plus", stitok: v.o > 0 ? `${meno} +${v.o}` : meno, popis: `${meno} v Dedičstve: ${v.popis}.`, pricina: `${v.zdroj}${v.o}` };
  return {
    smer: "plus",
    stitok: `${meno} +${v.o}`,
    popis: akcia === "Viera" ? `${meno} v Dedičstve: hodnota Viery +${v.o}.` : `${meno} v Dedičstve: ${akcia} udelí o ${v.o} ${v.o === 1 ? "poškodenie" : v.o < 5 ? "poškodenia" : "poškodení"} viac.`,
    pricina: `${v.zdroj}${v.o}`,
  };
}

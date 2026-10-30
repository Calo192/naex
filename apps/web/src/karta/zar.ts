// Žeravá ikona (Michal 2026-10-30, mock 3): akcia posilnená Nástrojom v Dedičstve
// majiteľa karty žhne ako uhlík, útok znížený Úplatkom je vyhasnutý s dymom.
// Údaje dáva jadro (vplyvyNaAkcie, utokPoUplatku); tu sa len priradia slotom.

import type { VplyvNaAkciu } from "@naex/core";
import { utokPoUplatku } from "@naex/core";

/** Zmena akcie v slote karty — KartaLico ju kreslí ako žeravú či vyhasnutú ikonu. */
export interface ZarSlotu {
  readonly smer: "plus" | "minus";
  /** Krátky štítok vedľa ikony v lupe („Puška +1“). */
  readonly stitok: string;
  /** Veta do popisu akcie. */
  readonly popis: string;
  /** Čím je zmena daná — iná príčina = nové prvé zobrazenie (iskra, dym). */
  readonly pricina: string;
}

/**
 * Zmena akcie `akcia` na karte hráča, ktorý má `vplyvy` (Nástroje v Dedičstve);
 * `uplatky` = Úplatky na karte (Kulturista). Znížený útok sa ráta ako slabší,
 * takže posilnenie pôvodného útoku ho už netýka — vyhrá vyhasnutie.
 */
export function zarSlotu(
  akcia: string,
  vplyvy: readonly VplyvNaAkciu[],
  uplatky: number,
  menoKarty: (defId: string) => string,
): ZarSlotu | null {
  if (uplatky > 0) {
    const ako = utokPoUplatku(akcia as VplyvNaAkciu["akcia"], uplatky);
    if (ako !== akcia) {
      return {
        smer: "minus",
        stitok: ako === null ? "Úplatok: nič" : `Úplatok: ${ako}`,
        popis: ako === null ? `Úplatok (${uplatky}×): útok sa nepočíta.` : `Úplatok (${uplatky}×): ráta sa len ako ${ako}.`,
        pricina: `uplatok${uplatky}`,
      };
    }
  }
  const v = vplyvy.find((x) => x.akcia === akcia);
  if (v === undefined) return null;
  const meno = menoKarty(v.zdroj);
  return {
    smer: "plus",
    stitok: `${meno} +${v.o}`,
    popis: akcia === "Viera" ? `${meno} v Dedičstve: hodnota Viery +${v.o}.` : `${meno} v Dedičstve: ${akcia} udelí o ${v.o} ${v.o === 1 ? "poškodenie" : v.o < 5 ? "poškodenia" : "poškodení"} viac.`,
    pricina: `${v.zdroj}${v.o}`,
  };
}

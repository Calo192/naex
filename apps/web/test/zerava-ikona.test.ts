// Žeravá ikona (Michal 2026-10-30, mock 3): ktorý slot žhne, ktorý je vyhasnutý a čo
// o tom povie popis — údaje z jadra (vplyvyNaAkcie).

import { describe, expect, it } from "vitest";
import type { VplyvNaAkciu } from "@naex/core";
import { zarSlotu } from "../src/karta/zar.ts";

const meno = (id: string): string => ({ puska: "Puška", vidly: "Vidly", svaty_text: "Svätý text" })[id] ?? id;
const vplyvy: readonly VplyvNaAkciu[] = [
  { akcia: "Petelica", zdroj: "puska", o: 1 },
  { akcia: "Viera", zdroj: "svaty_text", o: 1 },
];

describe("zarSlotu", () => {
  it("posilnená akcia žhne so štítkom Nástroja, iná nie", () => {
    expect(zarSlotu("Petelica", vplyvy, meno)).toEqual({
      smer: "plus",
      stitok: "Puška +1",
      popis: "Puška v Dedičstve: Petelica udelí o 1 poškodenie viac.",
      pricina: "puska1",
    });
    expect(zarSlotu("Viera", vplyvy, meno)?.popis).toBe("Svätý text v Dedičstve: hodnota Viery +1.");
    expect(zarSlotu("Rana", vplyvy, meno)).toBeNull();
    expect(zarSlotu("Posilnenie", vplyvy, meno)).toBeNull();
  });

  it("dva kusy: tvar slova podľa čísla", () => {
    expect(zarSlotu("Rana", [{ akcia: "Rana", zdroj: "vidly", o: 2 }], meno)?.popis).toBe("Vidly v Dedičstve: Rana udelí o 2 poškodenia viac.");
  });
});

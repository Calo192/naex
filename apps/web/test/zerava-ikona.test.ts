// Žeravá ikona (Michal 2026-10-30, mock 3): ktorý slot žhne, ktorý je vyhasnutý a čo
// o tom povie popis — údaje z jadra (vplyvyNaAkcie, utokPoUplatku).

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
    expect(zarSlotu("Petelica", vplyvy, 0, meno)).toEqual({
      smer: "plus",
      stitok: "Puška +1",
      popis: "Puška v Dedičstve: Petelica udelí o 1 poškodenie viac.",
      pricina: "puska1",
    });
    expect(zarSlotu("Viera", vplyvy, 0, meno)?.popis).toBe("Svätý text v Dedičstve: hodnota Viery +1.");
    expect(zarSlotu("Rana", vplyvy, 0, meno)).toBeNull();
    expect(zarSlotu("Posilnenie", vplyvy, 0, meno)).toBeNull();
  });

  it("dva kusy: tvar slova podľa čísla", () => {
    expect(zarSlotu("Rana", [{ akcia: "Rana", zdroj: "vidly", o: 2 }], 0, meno)?.popis).toBe("Vidly v Dedičstve: Rana udelí o 2 poškodenia viac.");
  });

  it("Úplatok: útok vyhasne a prebije posilnenie; neútok ostane", () => {
    expect(zarSlotu("Petelica", vplyvy, 1, meno)).toMatchObject({ smer: "minus", stitok: "Úplatok: Pecka", pricina: "uplatok1" });
    expect(zarSlotu("Pecka", vplyvy, 2, meno)).toMatchObject({ smer: "minus", stitok: "Úplatok: nič" });
    expect(zarSlotu("Viera", vplyvy, 2, meno)?.smer).toBe("plus");
  });
});

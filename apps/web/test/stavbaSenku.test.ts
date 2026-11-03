// Stavba šenku klikom (Michal 2026-10-28, roadmapa #147 a #148): klik vyberie do Šenku,
// ďalší klik vráti, plný výber ďalšiu kartu nepridá; nevybraté idú naspodok balíčka.

import { describe, expect, it } from "vitest";
import { prepniVyber, rozdelenieStavby } from "../src/hra/stavbaSenku.ts";

describe("výber do Šenku", () => {
  it("klik vyberie, ďalší klik výber zruší", () => {
    expect(prepniVyber([], 7, 4)).toEqual([7]);
    expect(prepniVyber([7, 3], 7, 4)).toEqual([3]);
  });

  it("pri plnom výbere klik na inú kartu nič nepridá (zosivená), na vybratú ju vráti", () => {
    const plny = [1, 2, 3, 4];
    expect(prepniVyber(plny, 5, 4)).toBe(plny);
    expect(prepniVyber(plny, 2, 4)).toEqual([1, 3, 4]);
  });

  it("rozdelenie ide v poradí balíčka: vybraté do Šenku, zvyšok naspodok", () => {
    const balicek = [10, 11, 12, 13, 14, 15, 16, 17].map((uid) => ({ uid }));
    expect(rozdelenieStavby(balicek, [16, 11, 13, 10])).toEqual({ doSenku: [10, 11, 13, 16], odhod: [12, 14, 15, 17] });
  });
});

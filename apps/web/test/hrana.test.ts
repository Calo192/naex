// Spodná hrana stola (Michal 2026-10-25): potvrdenie ťahu je pečiatka v strede hrany a stavová
// správa (↺ čo urobil súper) ju nesmie prekryť — na stole ide vedľa nej, na mobile nad rad.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { miestoUdalosti } from "../src/hra/hrana.ts";

describe("udalosti na hrane stola", () => {
  it("bez pečiatky ťahu sú na stole v strede hrany", () => {
    expect(miestoUdalosti(false, false)).toBe("stred");
  });

  it("s pečiatkou ťahu (hotovo, už neťahám, potvrdiť) idú vedľa nej, nie cez ňu", () => {
    expect(miestoUdalosti(true, false)).toBe("vedla");
  });

  it("na mobile ostávajú nad radom tlačidiel", () => {
    expect(miestoUdalosti(true, true)).toBe("nad");
    expect(miestoUdalosti(false, true)).toBe("nad");
  });
});

describe("pečiatka potvrdenia vo výučbe", () => {
  // Výučba svieti na potvrdenie ťahu (kľúč „potvrdit“) — po presune na hranu je to pečiatka
  // pecat-potvrd, nie tlacidlo-hlavne; bez nej by hráč po výbere karty nevidel, čím ťah dokončí.
  it("kľúč potvrdit nájde aj pečiatku na hrane stola", () => {
    const zdroj = readFileSync(new URL("../src/hra/Vyucba.tsx", import.meta.url), "utf8");
    const selektor = /button:is\(([^)]*)\):is\(\[data-skratka="k"\], \[data-vyucba="potvrdit"\]\)/.exec(zdroj)?.[1] ?? "";
    expect(selektor.split(",").map((s) => s.trim())).toEqual(expect.arrayContaining([".tlacidlo-hlavne", ".pecat-potvrd"]));
  });
});

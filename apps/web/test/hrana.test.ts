// Spodná hrana stola (Michal 2026-10-25): potvrdenie ťahu je pečiatka v strede hrany.
// Stavová správa (↺ čo urobil súper) je od jednotného baru v bare (bar.test.ts).

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("pečiatka potvrdenia vo výučbe", () => {
  // Výučba svieti na potvrdenie ťahu (kľúč „potvrdit“) — po presune na hranu je to pečiatka
  // pecat-potvrd, nie tlacidlo-hlavne; bez nej by hráč po výbere karty nevidel, čím ťah dokončí.
  it("kľúč potvrdit nájde aj pečiatku na hrane stola", () => {
    const zdroj = readFileSync(new URL("../src/hra/Vyucba.tsx", import.meta.url), "utf8");
    const selektor = /button:is\(([^)]*)\):is\(\[data-skratka="k"\], \[data-vyucba="potvrdit"\]\)/.exec(zdroj)?.[1] ?? "";
    expect(selektor.split(",").map((s) => s.trim())).toEqual(expect.arrayContaining([".tlacidlo-hlavne", ".pecat-potvrd"]));
  });
});

describe("hrana stola bez stavovej správy", () => {
  it("udalosti a chyby ťahu už na hrane nie sú — patria do baru", () => {
    const zdroj = readFileSync(new URL("../src/hra/HernaPlocha.tsx", import.meta.url), "utf8");
    expect(zdroj).not.toContain("pokyn-udalosti");
    expect(zdroj).toContain("sprava={spravaBaru}");
  });
});

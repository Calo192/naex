// Profil po prvej partii s botom nesmie vyzerať prázdny (UI inšpekcia W-08): kým hráč
// nemá partiu s človekom, predvolený filter partií je „Spolu“.

import { describe, expect, it } from "vitest";
import { predvolenyFilter, type Bilancia } from "../src/stranky/profil/typy.ts";

const b = (partie: number): Bilancia => ({ partie, vyhry: 0, prehry: partie, remizy: 0 });

describe("predvolený filter partií v profile", () => {
  it("len partie s botmi → Spolu", () => {
    expect(predvolenyFilter({ ludia: b(0), boti: b(1) })).toBe("spolu");
  });

  it("s ľuďmi aj bez partie ostáva S ľuďmi", () => {
    expect(predvolenyFilter({ ludia: b(2), boti: b(5) })).toBe("ludia");
    expect(predvolenyFilter({ ludia: b(0), boti: b(0) })).toBe("ludia");
  });
});

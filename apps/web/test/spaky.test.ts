// Krčmová nástenka (v6, spaky.html bod 12): poznámka pod lokalitou povie, prečo
// a koľko špakov bitka dala — remíza cez Absťáky či Dlhy, zrážka za Absťák,
// špaky zo sekery, prepadnuté vo finále, Exekútor a prebytok.

import { describe, expect, it } from "vitest";
import type { BitkaNaNastenke, PlayerId } from "@naex/core";
import { poznamkaBitky, spakyPredBitkou } from "../src/hra/Spaky.tsx";

const kto = (p: PlayerId): string => (p === 0 ? "ty" : "Fero");

const bitka = (b: Partial<BitkaNaNastenke>): BitkaNaNastenke => ({
  kolo: 1,
  lokalita: null,
  vitaz: 0,
  rozhodlo: "tuhe",
  pitky: 2,
  zaBitku: [2, 0],
  zoSekery: 0,
  abstakZrazka: 0,
  prepadlo: 0,
  zaStarsich: [0, 0],
  exekutor: [0, 0],
  prebytok: [0, 0],
  spakyPo: [2, 0],
  ...b,
});

describe("poznámka bitky na nástenke", () => {
  it("čistá výhra v tuhom nemá poznámku", () => {
    expect(poznamkaBitky(bitka({}), kto)).toEqual([]);
  });

  it("remíza rozhodnutá Absťákmi a zrážka víťazovi", () => {
    expect(poznamkaBitky(bitka({ rozhodlo: "abstak", abstakZrazka: 1 }), kto)).toEqual(["remíza → menej Absťákov", "−1 za Absťák"]);
  });

  it("sekera, Exekútor a prebytok po finále", () => {
    expect(poznamkaBitky(bitka({ vitaz: null, rozhodlo: "sekera", zaBitku: [0, 0], prepadlo: 3 }), kto)).toEqual(["3 špaky prepadlo"]);
    expect(poznamkaBitky(bitka({ zoSekery: 2, exekutor: [0, 4], prebytok: [3, 0] }), kto)).toEqual(["+2 zo sekery", "Exekútor: Fero −4", "prebytok: ty +3"]);
  });
});

describe("špaky pred bitkou", () => {
  it("po bitke mínus bitka, starší a prebytok, plus to, čo zhorelo pri exekúcii", () => {
    const b = bitka({ zaBitku: [3, 0], zaStarsich: [1, 2], exekutor: [0, 2], prebytok: [2, 0], spakyPo: [10, 4] });
    expect(spakyPredBitkou(b)).toEqual([4, 4]);
  });
});

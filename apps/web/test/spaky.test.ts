// Krčmová nástenka (v6, spaky.html bod 12): poznámka pod lokalitou povie, prečo
// a koľko špakov bitka dala — remíza cez Absťáky či Dlhy, zrážka za Absťák,
// špaky zo sekery, prepadnuté vo finále, Exekútor a prebytok.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { BitkaNaNastenke, PlayerId } from "@naex/core";
import { PocetSpakov, poznamkaBitky, sMinusom, spakyPredBitkou, textSpakovBitky } from "../src/hra/Spaky.tsx";

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

  it("sekera, Exekútor a Nakladačka po finále", () => {
    expect(poznamkaBitky(bitka({ vitaz: null, rozhodlo: "sekera", zaBitku: [0, 0], prepadlo: 3 }), kto)).toEqual(["3 špaky prepadlo"]);
    expect(poznamkaBitky(bitka({ zoSekery: 2, exekutor: [0, 4], prebytok: [3, 0] }), kto)).toEqual(["+2 zo sekery", "Exekútor: Fero −4", "Nakladačka: ty +3"]);
  });
});

describe("špaky pred bitkou", () => {
  it("po bitke mínus bitka, starší a Nakladačka, plus to, čo zhorelo pri exekúcii", () => {
    const b = bitka({ zaBitku: [3, 0], zaStarsich: [1, 2], exekutor: [0, 2], prebytok: [2, 0], spakyPo: [10, 4] });
    expect(spakyPredBitkou(b)).toEqual([4, 4]);
  });
});

// Dlaždica Špaky (Michal 2026-10-26): piktogram špaku a číslo — bez ilustrácie popolníka
// a bez riadku „od starších“; záporné špaky so znamienkom mínus (UI inšpekcia, UI-7).
describe("počet špakov", () => {
  it("piktogram a číslo, nič viac", () => {
    const html = renderToStaticMarkup(createElement(PocetSpakov, { n: 7, kto: "moj", titul: "" }));
    expect(html).toContain('class="ikona-spaku"');
    expect(html).toContain('<b class="velke-cislo">7</b>');
    expect(html).not.toMatch(/popol|pop-|oh-|starš/);
  });

  it("záporné špaky so znamienkom mínus a červeným číslom", () => {
    expect(sMinusom(-3)).toBe("−3");
    expect(sMinusom(0)).toBe("0");
    const html = renderToStaticMarkup(createElement(PocetSpakov, { n: -3, kto: "superov" }));
    expect(html).toContain("pocet-spakov superov minus");
    expect(html).toContain(">−3</b>");
  });

  it("riadok špakov bitky píše mínus, nie spojovník", () => {
    const b = bitka({ vitaz: 1, zaBitku: [0, 2], exekutor: [4, 0], spakyPo: [-3, 2] });
    expect(textSpakovBitky(b, spakyPredBitkou(b), [0, 1], kto)).toBe("ty 1 → −3 (−4 Exekútor) · Fero 0 → 2 (+2 bitka)");
  });
});

// Krčmová nástenka na stole (Michal 2026-10-28: „zväčšiť, a to o dosť“).

import { describe, expect, it } from "vitest";
import { DVA_RADY_OD, KARTA_MIN, rozmerNastenky } from "../src/hra/rozlozenieNastenky.ts";

describe("rozmer nástenky", () => {
  it("väčšia plsť = väčšie karty, písmo rastie s nimi", () => {
    const maly = rozmerNastenky(1275, 280, 9);
    const velky = rozmerNastenky(1830, 520, 9);
    expect(velky.sirkaKarty).toBeGreaterThan(maly.sirkaKarty);
    expect(velky.nk).toBeGreaterThanOrEqual(maly.nk);
    expect(velky.sirkaKarty).toBeGreaterThanOrEqual(110);
  });

  it("úzka plsť obmedzí karty šírkou", () => {
    const r = rozmerNastenky(700, 900, 9);
    expect(r.stlpcov * (r.sirkaKarty + 14) + (r.stlpcov - 1) * 14 + 24).toBeLessThanOrEqual(700);
  });

  it("dva rady len pri 10+ lístkoch a len keď sú v nich karty väčšie a čitateľné", () => {
    expect(rozmerNastenky(900, 1000, DVA_RADY_OD - 1).rady).toBe(1);
    const vysoka = rozmerNastenky(900, 1000, 12);
    expect(vysoka.rady).toBe(2);
    expect(vysoka.sirkaKarty).toBeGreaterThan(rozmerNastenky(900, 1000, 12, 0).sirkaKarty - 1);
    // Nízka plsť: dva rady by mali karty pod hranicou čitateľnosti — ostane jeden rad.
    expect(rozmerNastenky(1300, 240, 12).rady).toBe(1);
  });

  it("karty na výber pri voľbe cieľa sú väčšie než karty nástenky bez výberu", () => {
    const r = rozmerNastenky(1509, 444, 10, 5, 3);
    expect(r.sirkaVyberu).toBeGreaterThan(rozmerNastenky(1509, 444, 10).sirkaKarty);
    expect(r.sirkaVyberu).toBeGreaterThanOrEqual(KARTA_MIN);
  });
});

// Lístky lokalít na výber s čitateľným efektom (Leader 2026-10-30: na 1366 × 650 bol efekt 5 px).
// Plochy vrstvy nástenky namerané pri voľbe cieľa (šírka × výška, notebooky až veľký monitor).
const PLOCHY: readonly (readonly [string, number, number])[] = [
  ["1366×650", 1295, 264],
  ["1440×800", 1369, 371],
  ["1512×860", 1441, 431],
  ["1600×1000", 1529, 444],
  ["1920×1080", 1849, 494],
];

describe("lístky na výber pri voľbe cieľa", () => {
  // lokalít na výber × odohraných bitiek (aj finále dlhej hry: 7 odohraných, 3 na výber)
  const pripady: readonly (readonly [number, number])[] = [
    [3, 0], [5, 0], [7, 0], [6, 1], [6, 2], [7, 2], [5, 4], [5, 5], [3, 3], [3, 7],
  ];
  for (const [nazov, sirka, vyska] of PLOCHY)
    for (const [naVyber, odohranych] of pripady)
      it(`${nazov}: ${naVyber} na výber, ${odohranych} odohraných — lístky dosť veľké a rad sa zmestí`, () => {
        // + finále + Koniec
        const listkov = naVyber + odohranych + 2;
        const r = rozmerNastenky(sirka, vyska, listkov, naVyber, odohranych);
        const v = r.vyber;
        expect(v).not.toBeNull();
        if (v === null) return;
        expect(r.rady).toBe(1);
        // Šírka textu ≥ 110 px dá efektu písmo ≥ 11,5 px (spaky.css .ll-efekt) a riadok ~18 znakov.
        expect(v.vedla ? v.sirka - v.obraz : v.sirka).toBeGreaterThanOrEqual(110);
        // Ilustrácia na OREZ_MIN + názov a ~4 riadky efektu sa zmestia do výšky radu.
        if (!v.vedla) expect(v.sirka * 0.6 + 84).toBeLessThanOrEqual(v.vyska + 1);
        else expect(v.obraz).toBeLessThanOrEqual(v.vyska);
        // Ostatné lístky sú bez kariet (karta s účtenkou by bola vyššia než rad).
        expect(r.sirkaKarty).toBe(0);
        const historia = v.kratkeBitky ? Math.ceil(odohranych / 2) * 84 + (Math.ceil(odohranych / 2) - 1) * 8 : odohranych * 132;
        const poloziek = v.kratkeBitky ? naVyber + 3 : listkov;
        expect(naVyber * v.sirka + historia + 60 + 138 * r.nk + (poloziek - 1) * 14 + 48).toBeLessThanOrEqual(sirka);
      });

  it("veľa odohraných bitiek: krátke lístky v dvoch radoch, nech lokality na výber dostanú šírku", () => {
    const r = rozmerNastenky(1295, 264, 12, 3, 7);
    expect(r.vyber?.kratkeBitky).toBe(true);
    expect(rozmerNastenky(1849, 494, 7, 5, 0).vyber?.kratkeBitky).toBe(false);
  });

  it("väčší stôl = väčšie lístky", () => {
    const maly = rozmerNastenky(1295, 282, 7, 5);
    const velky = rozmerNastenky(1849, 524, 7, 5);
    expect(velky.vyber?.sirka ?? 0).toBeGreaterThan(maly.vyber?.sirka ?? 0);
  });

  it("nízky a široký lístok má text vedľa ilustrácie", () => {
    const v = rozmerNastenky(1295, 282, 5, 3).vyber;
    expect(v?.vedla).toBe(true);
    expect(v?.obraz).toBeGreaterThanOrEqual(150);
  });

  it("mimo voľby cieľa (Špaky, kompaktná nástenka) ostáva nástenka s kartami", () => {
    expect(rozmerNastenky(1295, 282, 9).vyber).toBeNull();
    expect(rozmerNastenky(1830, 520, 9).vyber).toBeNull();
  });
});

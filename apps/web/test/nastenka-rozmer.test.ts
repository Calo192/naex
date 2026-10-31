// Krčmová nástenka na stole (Michal 2026-10-28: „zväčšiť, a to o dosť“).

import { describe, expect, it } from "vitest";
import { DVA_RADY_OD, KARTA_MIN, POMER, POPOLNIKY_VEDLA, rozmerNastenky } from "../src/hra/rozlozenieNastenky.ts";

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
        expect(v.sirka).toBeGreaterThanOrEqual(110);
        // Pomer strán karty (Michal 2026-10-31: „zmrštené“ karty) a lístok sa zmestí do výšky radu.
        expect(Math.abs(v.vyska / v.sirka - POMER)).toBeLessThan(0.01);
        // Popolníky nad radom berú výšku, vedľa neho šírku.
        expect(v.vyska).toBeLessThanOrEqual(vyska - 20 - (v.popolnikyVedla ? 0 : 60 * r.nk) + 1);
        const popolniky = v.popolnikyVedla ? POPOLNIKY_VEDLA * r.nk + 14 : 0;
        // Ilustrácia na OREZ_MIN + názov a ~4 riadky efektu sa zmestia do lístka.
        expect(v.sirka * 0.6 + 84).toBeLessThanOrEqual(v.vyska + 1);
        // Ostatné lístky sú bez kariet (karta s účtenkou by bola vyššia než rad).
        expect(r.sirkaKarty).toBe(0);
        const historia = v.kratkeBitky ? Math.ceil(odohranych / 2) * 84 + (Math.ceil(odohranych / 2) - 1) * 8 : odohranych * 132;
        const poloziek = v.kratkeBitky ? naVyber + 3 : listkov;
        // Koniec má veľkosť karty na výber.
        expect((naVyber + 1) * v.sirka + historia + 60 + (poloziek - 1) * 14 + 48 + popolniky).toBeLessThanOrEqual(sirka);
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

  it("nízky stôl (Michal 2026-10-31): popolníky vedľa radu, keď sú tak karty väčšie; veľký stôl bez zmeny", () => {
    // 1366 × 650: začiatok hry (5 lokalít, rad je úzky) aj neskôr (3 lokality) — karty väčšie než s popolníkmi nad radom.
    const zaciatok = rozmerNastenky(1295, 264, 7, 5, 0).vyber;
    expect(zaciatok?.popolnikyVedla).toBe(true);
    expect(zaciatok?.sirka ?? 0).toBeGreaterThan(136);
    const neskor = rozmerNastenky(1295, 264, 7, 3, 2).vyber;
    expect(neskor?.popolnikyVedla).toBe(true);
    expect(neskor?.sirka ?? 0).toBeGreaterThanOrEqual(Math.floor(136 * 1.2));
    // 1440 × 800 so 7 lístkami už rad obmedzuje šírka — popolníky ostanú nad ním.
    expect(rozmerNastenky(1369, 371, 7, 5, 0).vyber?.popolnikyVedla).toBe(false);
    // Veľká obrazovka bez zmeny, aj keď by vedľa radu boli karty väčšie (málo lokalít).
    for (const [w, h] of [[1529, 444], [1849, 494]] as const) for (const [v, o] of [[5, 0], [3, 0], [2, 3]] as const) expect(rozmerNastenky(w, h, v + o + 2, v, o).vyber?.popolnikyVedla).toBe(false);
  });

  it("nízky a široký stôl: lístok sa zmenší celý, v pomere strán karty — nie roztiahne do šírky", () => {
    const v = rozmerNastenky(1295, 282, 5, 3).vyber;
    expect(v).not.toBeNull();
    if (v === null) return;
    expect(v.vyska).toBe(Math.round(v.sirka * POMER));
    expect(v.vyska).toBeLessThanOrEqual(282);
  });

  it("karta na výber bez lístkov (drobné karty) nechá miesto aj Koncu veľkosti karty", () => {
    const r = rozmerNastenky(700, 300, 9, 7, 0);
    expect(r.vyber).toBeNull();
    // 7 kariet na výber + Koniec rovnako široký + finále (lístok bez karty) a medzery.
    expect(8 * r.sirkaVyberu + 104 + 8 * 14 + 48).toBeLessThanOrEqual(700);
  });

  it("mimo voľby cieľa (Špaky, kompaktná nástenka) ostáva nástenka s kartami", () => {
    expect(rozmerNastenky(1295, 282, 9).vyber).toBeNull();
    expect(rozmerNastenky(1830, 520, 9).vyber).toBeNull();
  });
});

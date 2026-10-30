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

  it("karty na výber pri voľbe cieľa smú byť väčšie než lístky s účtenkou", () => {
    const r = rozmerNastenky(1509, 444, 10, 5);
    expect(r.sirkaVyberu).toBeGreaterThanOrEqual(r.sirkaKarty);
    expect(r.sirkaKarty).toBeGreaterThanOrEqual(KARTA_MIN);
  });
});

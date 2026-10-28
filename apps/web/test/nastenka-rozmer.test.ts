// Krčmová nástenka na stole (Michal 2026-10-28: „zväčšiť, a to o dosť“) a vety o NA EX
// v rekapitulácii (Michal 2026-10-28: „neviem, ako súper zareagoval na moje NA EX“).

import { describe, expect, it } from "vitest";
import { DVA_RADY_OD, KARTA_MIN, rozmerNastenky } from "../src/hra/rozlozenieNastenky.ts";
import { vetyNaex } from "../src/hra/Rekapitulacia.tsx";

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

describe("NA EX a odpoveď slovami", () => {
  const meno = (d: string): string => ({ hasic: "Hasič", pijan: "Pijan", prav: "Pravdovravec" })[d] ?? d;
  it("kto dal NA EX na čo, čo to spravilo a kto odpovedal ktorou kartou", () => {
    const vety = vetyNaex(
      {
        karty: [
          { uid: 1, defId: "hasic", majitel: 0, dal: 0, zdvojilo: 1, zrusilo: 2 },
          { uid: 2, defId: "prav", majitel: 1, dal: 1, zdvojilo: 4, zrusilo: 0 },
        ],
        zdvojilo: [1, 4],
        zrusilo: [2, 0],
      },
      [{ hrac: 1, defId: "pijan", ciel: "vlastna" }, { hrac: 0, defId: null, ciel: null }],
      0,
      ["Jano", "Fero"],
      meno,
    );
    expect(vety).toEqual([
      "NA EX — ty: na svoju kartu Hasič → zdvojilo 1, zrušilo 2",
      "NA EX — Fero: na svoju kartu Pravdovravec → zdvojilo 4",
      "Odpoveď na NA EX — Fero: Pijan na svoju stranu",
      "Odpoveď na NA EX — ty: žiadna",
    ]);
  });
});

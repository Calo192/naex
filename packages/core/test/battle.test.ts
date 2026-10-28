// M4 — vyhodnotenie bitky podľa PRAVIDLA §9.

import { describe, expect, it } from "vitest";
import type { BattleSide } from "../src/index.ts";
import {
  battleOutcome,
  computeDamage,
  spakyZaBitku,
  zhoriPriExekucii,
} from "../src/index.ts";

function side(overrides: Partial<BattleSide> = {}): BattleSide {
  return {
    sums: {},
    cirhozaBonus: 0,
    tuheBonus: 0,
    abstaky: 0,
    priznaneDlhy: 0,
    priazenBitkara: 0,
    hodnotaViery: 1,
    ...overrides,
  };
}

describe("M4 — poškodenie", () => {
  it("Viera znižuje súperovo tuhé poškodenie o 1 + priazeň Veriaceho", () => {
    // Hráč 0 udiera za 5 (Rana + Pecka×2), hráč 1 má 1 Vieru s priazňou 2.
    const damage = computeDamage([
      side({ sums: { Rana: 1, Pecka: 2 } }),
      side({ sums: { Viera: 1 }, hodnotaViery: 3 }),
    ]);
    expect(damage.tuhe[0]).toBe(2); // 5 − 1×3
    expect(damage.tuhe[1]).toBe(0);
  });

  it("Viera a Povera sa vyrušia 1:1 a zrušená Povera neudelí nič", () => {
    // Hráč 0: 2 Povery. Hráč 1: 2 Viery + priznané dlhy hráča 1 sú 3.
    const damage = computeDamage([
      side({ sums: { Povera: 2 } }),
      side({ sums: { Viera: 2 }, priznaneDlhy: 3 }),
    ]);
    // Obe Povery zrušené Vierami → žiadne mäkké poškodenie.
    expect(damage.zvysnaPovera[0]).toBe(0);
    expect(damage.zvysnaViera[1]).toBe(0);
    expect(damage.makke[0]).toBe(0);
  });

  it("mäkké poškodenie je zastropené súperovým priznaným dlhom", () => {
    const damage = computeDamage([
      side({ sums: { Povera: 4 } }),
      side({ priznaneDlhy: 2 }),
    ]);
    expect(damage.makke[0]).toBe(2);
    expect(damage.celkove[0]).toBe(2);
  });

  it("tuhé neklesne pod nulu a absťáky znižujú vlastné tuhé", () => {
    const damage = computeDamage([
      side({ sums: { Rana: 2 }, abstaky: 1 }),
      side({ sums: { Viera: 5 } }),
    ]);
    expect(damage.tuhe[0]).toBe(0); // 2 − 5×1 − 1 → 0
  });

  it("Cirhóza v mojej partii pridáva súperovi tuhé (rozhodnutie č. 5)", () => {
    const damage = computeDamage([
      side({ cirhozaBonus: 2 }), // 2 Cirhózy v partii hráča 1
      side(),
    ]);
    expect(damage.tuhe[0]).toBe(2);
  });

  it("priazeň Bitkára pridáva tuhé navyše", () => {
    const damage = computeDamage([side({ sums: { Rana: 1 }, priazenBitkara: 2 }), side()]);
    expect(damage.tuhe[0]).toBe(3);
  });
});

describe("M4 — výsledok", () => {
  // Michal 2026-10-21 (strategia-remiza-20261021): pri rovnakom tuhom nevyhrá
  // nikto — lokalita ide na sekeru. Rola ani celkové remízu nerozhodujú.
  it("pri úplnej remíze nevyhrá nikto (ani obranca)", () => {
    const damage = computeDamage([side({ sums: { Rana: 2 } }), side({ sums: { Pecka: 1 } })]);
    expect(damage.tuhe).toEqual([2, 2]);
    expect(damage.celkove).toEqual([2, 2]);
    expect(battleOutcome(damage).vitaz).toBeNull();
  });

  it("pri remíze v tuhom nevyhrá nikto, prebytok drží vyššie celkové", () => {
    const d = { tuhe: [2, 2], makke: [0, 1], celkove: [2, 3], zvysnaViera: [0, 0], zvysnaPovera: [0, 0] } as const;
    const o = battleOutcome(d);
    expect(o.vitaz).toBeNull();
    expect(o.prebytokDrzi).toBe(1);
    expect(o.prebytok).toBe(1);
  });

  it("pri remíze v celkovom poškodení nikto nezíska prebytok", () => {
    const damage = computeDamage([side({ sums: { Rana: 2 } }), side({ sums: { Pecka: 1 } })]);
    expect(damage.celkove).toEqual([2, 2]);
    const outcome = battleOutcome(damage);
    expect(outcome.prebytokDrzi).toBeNull();
    expect(outcome.prebytok).toBe(0);
  });

  it("prebytok drží hráč s vyšším celkovým, aj keď bitku prehral", () => {
    // Hráč 0 vyhrá na tuhom, ale hráč 1 má vyššie celkové vďaka mäkkému.
    const damage = computeDamage([
      side({ sums: { Pecka: 2 }, priznaneDlhy: 5 }),
      side({ sums: { Rana: 3, Povera: 3 } }),
    ]);
    expect(damage.tuhe).toEqual([4, 3]);
    expect(damage.celkove).toEqual([4, 6]);
    const outcome = battleOutcome(damage);
    expect(outcome.vitaz).toBe(0);
    expect(outcome.prebytokDrzi).toBe(1);
    expect(outcome.prebytok).toBe(2);
  });
});

describe("M4 — Exekútor", () => {
  it("bez prahu (Michal 2026-10-28): zhorí polovica priznaných Dlhov NAHOR — aj z jedného Dlhu", () => {
    expect(zhoriPriExekucii(0)).toBe(0);
    expect(zhoriPriExekucii(1)).toBe(1);
    expect(zhoriPriExekucii(2)).toBe(1);
    expect(zhoriPriExekucii(5)).toBe(3);
    expect(zhoriPriExekucii(10)).toBe(5);
  });

  it("súperova priazeň Exekútora zhorí navyše 1 / 2 / 3 Dlhy, najviac všetky", () => {
    expect(zhoriPriExekucii(5, 1)).toBe(4);
    expect(zhoriPriExekucii(5, 3)).toBe(5);
    expect(zhoriPriExekucii(2, 3)).toBe(2);
    expect(zhoriPriExekucii(0, 3)).toBe(0);
  });
});

describe("v6 — výsledok bitky a špaky za bitku (Michal 2026-10-26)", () => {
  const remiza = { tuhe: [3, 3], makke: [0, 2], celkove: [3, 5], zvysnaViera: [0, 0], zvysnaPovera: [0, 0] } as const;

  it("remízu v tuhom vyhrá menej Absťákov, potom menej priznaných Dlhov, inak sekera", () => {
    expect(battleOutcome(remiza, { abstaky: [1, 0], dlhy: [0, 0] })).toMatchObject({ vitaz: 1, rozhodlo: "abstak", prebytokDrzi: 1 });
    expect(battleOutcome(remiza, { abstaky: [1, 1], dlhy: [2, 3] })).toMatchObject({ vitaz: 0, rozhodlo: "dlhy" });
    expect(battleOutcome(remiza, { abstaky: [0, 0], dlhy: [1, 1] })).toMatchObject({ vitaz: null, rozhodlo: "sekera" });
    // Rozhoduje tuhé — Absťáky ani Dlhy nič nemenia.
    const tuhe = { ...remiza, tuhe: [4, 3] } as const;
    expect(battleOutcome(tuhe, { abstaky: [5, 0], dlhy: [9, 0] })).toMatchObject({ vitaz: 0, rozhodlo: "tuhe" });
  });

  it("víťaz dostane 1 špak za kartu v línii, aspoň 1 — Absťáky od v8.1 nič nezrážajú (Nervák)", () => {
    expect(spakyZaBitku(3)).toBe(3);
    expect(spakyZaBitku(0)).toBe(1);
  });
});

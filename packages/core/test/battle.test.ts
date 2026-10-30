// M4 — vyhodnotenie bitky podľa PRAVIDLA §9.

import { describe, expect, it } from "vitest";
import type { BattleSide } from "../src/index.ts";
import {
  battleOutcome,
  computeDamage,
  spakyZaBitku,
  spakyPriExekucii,
  zhoriPriExekucii,
} from "../src/index.ts";

function side(overrides: Partial<BattleSide> = {}): BattleSide {
  return {
    sums: {},
    cirhozaBonus: 0,
    tuheBonus: 0,
    abstaky: 0,
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

  it("Viera a Povera sa vyrušia 1:1 — zvyšné Povery idú na klebety, nie do poškodenia (v8.3)", () => {
    const damage = computeDamage([side({ sums: { Povera: 3 } }), side({ sums: { Viera: 2 } })]);
    expect(damage.zvysnaPovera[0]).toBe(1);
    expect(damage.zvysnaViera[1]).toBe(0);
    expect(damage.makke).toEqual([0, 0]);
    expect(damage.celkove).toEqual(damage.tuhe);
  });

  it("Čierna mačka (v8.3, návrh): moje Povery sa Vierou nerušia — Viera ostáva na tuhé", () => {
    const damage = computeDamage([side({ sums: { Povera: 2 }, poveryBezViery: true }), side({ sums: { Viera: 2, Rana: 0 } })]);
    expect(damage.zvysnaPovera[0]).toBe(2);
    expect(damage.zvysnaViera[1]).toBe(2);
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

  it("pri remíze v tuhom nevyhrá nikto a Nakladačku nedrží nikto (v8.3: Nakladačka = rozdiel tuhého)", () => {
    const d = { tuhe: [2, 2], makke: [0, 0], celkove: [2, 2], zvysnaViera: [0, 0], zvysnaPovera: [0, 3] } as const;
    const o = battleOutcome(d, { abstaky: [1, 0], dlhy: [0, 0] });
    expect(o.vitaz).toBe(1);
    expect(o.prebytokDrzi).toBeNull();
    expect(o.prebytok).toBe(0);
  });

  it("pri remíze v celkovom poškodení nikto nezíska Nakladačku", () => {
    const damage = computeDamage([side({ sums: { Rana: 2 } }), side({ sums: { Pecka: 1 } })]);
    expect(damage.celkove).toEqual([2, 2]);
    const outcome = battleOutcome(damage);
    expect(outcome.prebytokDrzi).toBeNull();
    expect(outcome.prebytok).toBe(0);
  });

  it("Nakladačku drží víťaz — rozdiel tuhého; Povery ju nemenia (v8.3)", () => {
    const damage = computeDamage([side({ sums: { Pecka: 2 } }), side({ sums: { Rana: 3, Povera: 3 } })]);
    expect(damage.tuhe).toEqual([4, 3]);
    const outcome = battleOutcome(damage);
    expect(outcome.vitaz).toBe(0);
    expect(outcome.prebytokDrzi).toBe(0);
    expect(outcome.prebytok).toBe(1);
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

  it("v9: priazeň Advokát odpočíta o 1 / 2 / 3 špaky menej, najmenej 0; Dlhy zhoria ako vždy", () => {
    expect(spakyPriExekucii(5)).toBe(3);
    expect(spakyPriExekucii(5, 1)).toBe(2);
    expect(spakyPriExekucii(5, 3)).toBe(0);
    expect(spakyPriExekucii(2, 3)).toBe(0);
    expect(spakyPriExekucii(0, 3)).toBe(0);
    expect(zhoriPriExekucii(5)).toBe(3);
  });
});

describe("v6 — výsledok bitky a špaky za bitku (Michal 2026-10-26)", () => {
  const remiza = { tuhe: [3, 3], makke: [0, 2], celkove: [3, 5], zvysnaViera: [0, 0], zvysnaPovera: [0, 0] } as const;

  it("remízu v tuhom vyhrá menej Absťákov, potom menej priznaných Dlhov, inak sekera", () => {
    expect(battleOutcome(remiza, { abstaky: [1, 0], dlhy: [0, 0] })).toMatchObject({ vitaz: 1, rozhodlo: "abstak", prebytokDrzi: null });
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

// Fajčenie naprázdno (Michal 2026-10-22, cez Leadera): keď sú doberací aj
// odhadzovací balíček prázdne, fajčenie nesmie minúť cigaretu — príkaz je
// neplatný a medzi legálnymi ťahmi nie je. Od v5 (Michal 2026-10-24, bod 1)
// sa fajčí len v Pitke, v Zhromaždení nie; draft zo šenku sa nemení.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { GameState, PlayerId } from "../src/index.ts";
import { IllegalCommandError, apply, legalCommands, loadGameData, setupGame } from "../src/index.ts";
import { setupSBalickom } from "./helpers.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

function vStave(faza: "zhromazdenie" | "pitka", doberaci: boolean): GameState {
  const s0 = setupSBalickom(data, 41);
  const p: PlayerId = 0;
  const h = s0.hraci[p];
  // Celý balíček v ruke — doberací aj odhadzovací prázdne (5 štartoviek, 1. kolo).
  const ruka = doberaci ? h.ruka : [...h.ruka, ...h.doberaci, ...h.odhadzovaci];
  const zaklad: GameState = {
    ...s0,
    pitkyCelkom: 1,
    pitkaCislo: faza === "pitka" ? 1 : 0,
    ciel: { typ: "lokalita", lokalita: s0.lokalityVHre[0]! },
    lokalityVHre: s0.lokalityVHre.slice(1),
    hraci: [{ ...h, cigarety: 3, ruka, doberaci: doberaci ? h.doberaci : [], odhadzovaci: doberaci ? h.odhadzovaci : [] }, s0.hraci[1]],
  };
  if (faza === "zhromazdenie") {
    return { ...zaklad, faza, zhromazdenieStav: { naTahu: p, zostavaLimit: [2, 2], pasoval: [false, false], navyse: [0, 0] } };
  }
  return {
    ...zaklad,
    faza,
    pitkaStav: { naTahu: p, hotovy: [false, false], naexPouzity: [false, false], fajcenie: [0, 0], reakcia: null, postarka: [false, false], starosta: [false, false], naexPocet: [0, 0], vykup: [false, false] },
  };
}

describe("fajčenie naprázdno", () => {
  it("s prázdnym doberacím aj odhadzovacím balíčkom sa fajčiť nedá a cigareta ostane", () => {
    const s = vStave("pitka", false);
    expect(s.hraci[0].doberaci).toHaveLength(0);
    expect(legalCommands(data, s, 0).some((c) => c.type === "smoke")).toBe(false);
    expect(() => apply(data, s, { type: "smoke", pocet: 1 }, 0)).toThrow(IllegalCommandError);
    expect(s.hraci[0].cigarety).toBe(3);
  });

  it("keď je z čoho ťahať, v Pitke fajčenie ide ako doteraz", () => {
    const s = vStave("pitka", true);
    expect(legalCommands(data, s, 0)).toContainEqual({ type: "smoke", pocet: 1 });
    const po = apply(data, s, { type: "smoke", pocet: 1 }, 0).state;
    expect(po.hraci[0].cigarety).toBe(2);
    expect(po.hraci[0].ruka.length).toBeGreaterThan(s.hraci[0].ruka.length - 1);
    expect(po.pitkaStav?.fajcenie[0]).toBe(1);
  });
});

describe("v5 bod 1: fajčenie len v Pitke", () => {
  it("v Zhromaždení fajčenie nie je legálny ťah a príkaz neprejde, cigareta ostane", () => {
    const s = vStave("zhromazdenie", true);
    expect(legalCommands(data, s, 0).some((c) => c.type === "smoke")).toBe(false);
    expect(() => apply(data, s, { type: "smoke", pocet: 1 }, 0)).toThrow(/len v Pitke/);
    expect(s.hraci[0].cigarety).toBe(3);
  });
});

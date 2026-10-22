// Fajčenie naprázdno (Michal 2026-10-22, cez Leadera): keď sú doberací aj
// odhadzovací balíček prázdne, fajčenie nesmie minúť cigaretu — príkaz je
// neplatný a medzi legálnymi ťahmi nie je.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { GameState, PlayerId } from "../src/index.ts";
import { IllegalCommandError, apply, legalCommands, loadGameData, setupGame } from "../src/index.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

function vZhromazdeni(doberaci: boolean): GameState {
  const s0 = setupGame(data, 41);
  const p: PlayerId = 0;
  const h = s0.hraci[p];
  // Celý balíček v ruke — doberací aj odhadzovací prázdne (5 štartoviek, 1. kolo).
  const ruka = doberaci ? h.ruka : [...h.ruka, ...h.doberaci, ...h.odhadzovaci];
  return {
    ...s0,
    faza: "zhromazdenie",
    pitkyCelkom: 1,
    pitkaCislo: 0,
    ciel: { typ: "lokalita", lokalita: s0.lokalityVHre[0]! },
    lokalityVHre: s0.lokalityVHre.slice(1),
    zhromazdenieStav: { naTahu: p, zostavaLimit: [2, 2], pasoval: [false, false], navyse: [0, 0] },
    hraci: [{ ...h, cigarety: 3, ruka, doberaci: doberaci ? h.doberaci : [], odhadzovaci: doberaci ? h.odhadzovaci : [] }, s0.hraci[1]],
  };
}

describe("fajčenie naprázdno", () => {
  it("s prázdnym doberacím aj odhadzovacím balíčkom sa fajčiť nedá a cigareta ostane", () => {
    const s = vZhromazdeni(false);
    expect(s.hraci[0].doberaci).toHaveLength(0);
    expect(legalCommands(data, s, 0).some((c) => c.type === "smoke")).toBe(false);
    expect(() => apply(data, s, { type: "smoke", pocet: 1 }, 0)).toThrow(IllegalCommandError);
    expect(s.hraci[0].cigarety).toBe(3);
  });

  it("keď je z čoho ťahať, fajčenie ide ako doteraz", () => {
    const s = vZhromazdeni(true);
    expect(legalCommands(data, s, 0)).toContainEqual({ type: "smoke", pocet: 1 });
    const po = apply(data, s, { type: "smoke", pocet: 1 }, 0).state;
    expect(po.hraci[0].cigarety).toBe(2);
    expect(po.hraci[0].ruka.length).toBeGreaterThan(s.hraci[0].ruka.length - 1);
  });
});

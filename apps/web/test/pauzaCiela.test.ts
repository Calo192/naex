// Pauza po súperovej voľbe cieľa (roadmapa #102): ukáže sa len hráčovi, ktorému cieľ vybral súper,
// a len pri prechode z voľby cieľa ďalej. Overuje sa na skutočnej partii z pohľadu hráča (viewFor).

import { describe, expect, it } from "vitest";
import cardsJson from "../../../packages/core/data/cards.json";
import eldersJson from "../../../packages/core/data/elders.json";
import scorecardsJson from "../../../packages/core/data/scorecards.json";
import type { PlayerId } from "@naex/core";
import { apply, loadGameData, setupGame, viewFor } from "@naex/core";
import { klavesPreskociPauzu, pauzaPoVolbeCiela } from "../src/hra/pauzaCiela.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

function volbaCiela(seed: number) {
  const pred = setupGame(data, seed);
  const obranca = (1 - pred.utocnik) as PlayerId;
  const lok = pred.lokalityVHre[0]!;
  const po = apply(data, pred, { type: "chooseLocation", uid: lok.uid, otocena: true }, obranca).state;
  return { pred, po, obranca, utocnik: pred.utocnik, lok };
}

describe("pauzaPoVolbeCiela", () => {
  it("útočník vidí pauzu s lokalitou, ktorú vybral súper", () => {
    const { pred, po, utocnik, lok } = volbaCiela(7);
    expect(pred.faza).toBe("volbaCiela");
    expect(po.faza).toBe("draft");
    expect(pauzaPoVolbeCiela(viewFor(data, pred, utocnik), viewFor(data, po, utocnik))).toEqual({ kolo: po.kolo, uid: lok.uid });
  });

  it("obranca, ktorý cieľ vybral sám, pauzu nemá", () => {
    const { pred, po, obranca } = volbaCiela(7);
    expect(pauzaPoVolbeCiela(viewFor(data, pred, obranca), viewFor(data, po, obranca))).toBeNull();
  });

  it("bez predošlého pohľadu (pripojenie do rozohranej partie) ani pri ďalších pohľadoch draftu pauza nie je", () => {
    const { po, utocnik } = volbaCiela(11);
    const v = viewFor(data, po, utocnik);
    expect(pauzaPoVolbeCiela(null, v)).toBeNull();
    expect(pauzaPoVolbeCiela(v, v)).toBeNull();
  });

  it("počas voľby cieľa ešte nie je čo ukázať", () => {
    const { pred, utocnik } = volbaCiela(3);
    const v = viewFor(data, pred, utocnik);
    expect(pauzaPoVolbeCiela(v, v)).toBeNull();
  });
});

describe("klavesPreskociPauzu", () => {
  it("samé modifikátory pauzu nezrušia, ostatné klávesy áno", () => {
    expect(klavesPreskociPauzu("Shift")).toBe(false);
    expect(klavesPreskociPauzu("Control")).toBe(false);
    expect(klavesPreskociPauzu("Enter")).toBe(true);
    expect(klavesPreskociPauzu("k")).toBe(true);
    expect(klavesPreskociPauzu("Escape")).toBe(true);
  });
});

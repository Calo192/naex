// Starší: strach a reči oboch hráčov (v11 Strach a reči, Michal 2026-11-02) a scorecardy.
// Pravidlá bodovania, rozdelenia a zajatia stráži strach-reci.test.ts.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { ElderState, Stupen } from "../src/index.ts";
import {
  favourStarsieho,
  freshElder,
  loadGameData,
  najvyssiMarker,
  setupGame,
  spakyOdStarsieho,
  strachZ,
  stupenStavu,
  vydesil,
} from "../src/index.ts";
import { instanceFor, makeDef, syntheticData } from "./helpers.ts";

const starsiLayoutLeft = ["Viera", null, "Povera", null] as const;
const starsiLayoutRight = [null, "Pecka", null, null] as const;
const data = syntheticData([makeDef("starsi", starsiLayoutLeft, starsiLayoutRight, { tags: ["Starešina", "Chlap"] })]);

function elder(strach: readonly [Stupen, Stupen], reci: readonly [Stupen, Stupen] = [0, 0]): ElderState {
  const e = freshElder("starsi", instanceFor(data, "starsi", starsiLayoutLeft, starsiLayoutRight), "sc");
  return { ...e, strach, reci };
}

describe("v11 — stupnica 0–3 a markery hráčov", () => {
  it("nový starší: strach aj reči oboch v sivom; stav podľa vyššieho strachu", () => {
    const e = freshElder("starsi", instanceFor(data, "starsi", starsiLayoutLeft, starsiLayoutRight), "sc");
    expect([e.strach, e.reci]).toEqual([
      [0, 0],
      [0, 0],
    ]);
    expect(stupenStavu(elder([1, 3]))).toBe(3);
    expect(strachZ(elder([1, 3]), 0)).toBe(1);
  });
});

describe("v11.4 — podmienka zajatia (§10)", () => {
  it("vydesený pre hráča = jeho strach 3 — súperov strach ani reči nerozhodujú", () => {
    expect(vydesil(elder([3, 0]), 0)).toBe(true);
    expect(vydesil(elder([3, 3]), 1)).toBe(true);
    expect(vydesil(elder([2, 0], [3, 0]), 0)).toBe(false); // reči nestačia
    expect(vydesil(elder([0, 3]), 0)).toBe(false);
  });
});

describe("scorecardy pri príprave hry", () => {
  const plne = loadGameData(cardsJson, eldersJson, scorecardsJson);

  it("každý starší dostane iný scorecard, rozdanie je deterministické zo seedu", () => {
    const a = setupGame(plne, 11);
    const ids = a.starsi.map((e) => e.scorecard);
    expect(new Set(ids).size).toBe(a.starsi.length);
    expect(setupGame(plne, 11).starsi.map((e) => e.scorecard)).toEqual(ids);
    const ine = [12, 13, 14].some((seed) => setupGame(plne, seed).starsi.some((e, i) => e.scorecard !== ids[i]));
    expect(ine).toBe(true);
  });

  it("priazeň staršieho určuje jeho scorecard; v6 bez bodovacích podmienok", () => {
    const s = setupGame(plne, 5);
    for (const e of s.starsi) {
      expect(favourStarsieho(plne, e)).toBe(plne.scorecards.find((x) => x.id === e.scorecard)?.favour);
    }
    for (const sc of plne.scorecards) {
      expect([...sc.lava, ...sc.prava].every((x) => x === null)).toBe(true);
    }
  });
});

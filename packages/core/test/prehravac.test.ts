// Prehrávač partie (roadmapa #18): prehratie zo seedu a príkazov dá presne
// odohranú partiu — krok po kroku aj na konci.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { Command, GameState, PrikazPartie } from "../src/index.ts";
import { apply, legalCommands, loadGameData, naTahu, prehrajPartiu, rngInt, rngSeed, setupGame } from "../src/index.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

describe("prehrávač partie", () => {
  it("seed + príkazy prehrajú odohranú partiu presne (každý krok aj koniec)", () => {
    const seed = 321;
    let s: GameState = setupGame(data, seed, { lokalit: 5 });
    let rng = rngSeed(99);
    const prikazy: PrikazPartie[] = [];
    const stavy: GameState[] = [s];
    for (let i = 0; i < 20000 && s.koniec === null; i++) {
      const p = naTahu(s)!;
      const cmds = legalCommands(data, s, p);
      const [j, r] = rngInt(rng, cmds.length);
      rng = r;
      const cmd = cmds[j] as Command;
      prikazy.push([p, cmd]);
      s = apply(data, s, cmd, p).state;
      stavy.push(s);
    }
    expect(s.koniec).not.toBeNull();
    expect(prehrajPartiu(data, seed, 5, prikazy, prikazy.length).state).toEqual(s);
    for (const n of [0, 1, Math.floor(prikazy.length / 3), prikazy.length - 1]) {
      expect(prehrajPartiu(data, seed, 5, prikazy, n).state).toEqual(stavy[n]);
    }
    // Krok mimo rozsahu sa oreže.
    expect(prehrajPartiu(data, seed, 5, prikazy, prikazy.length + 50).state).toEqual(s);
  });
});

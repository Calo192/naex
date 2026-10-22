// Celý ťah naraz (príkaz „tah“, ako ho posiela webový klient) sa v štatistikách
// hráča aj kariet ráta rovnako ako tie isté vyloženia po jednom.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { Command, DvojicaStatistik, GameState, StatistikyKariet } from "../src/index.ts";
import { apply, legalCommands, loadGameData, naTahu, noveStatistiky, rngInt, rngSeed, setupGame, zapisTah, zapisTahKariet } from "../src/index.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

function partia(seed: number, akoTah: boolean): { stat: DvojicaStatistik; karty: StatistikyKariet; tahov: number } {
  let state: GameState = setupGame(data, seed);
  let rng = rngSeed(seed ^ 0x7a4);
  let stat = noveStatistiky();
  let karty: StatistikyKariet = {};
  let tahov = 0;
  for (let i = 0; i < 20000 && state.koniec === null; i++) {
    const p = naTahu(state);
    if (p === null) break;
    const cmds = legalCommands(data, state, p);
    const [idx, r] = rngInt(rng, cmds.length);
    rng = r;
    const vybrany = cmds[idx] as Command;
    const zabalit = akoTah && state.faza === "zhromazdenie" && vybrany.type === "place";
    if (zabalit) tahov++;
    const cmd: Command = zabalit ? { type: "tah", kroky: [vybrany] } : vybrany;
    const { state: po, events } = apply(data, state, cmd, p);
    stat = zapisTah(stat, state, cmd, p, po, events);
    karty = zapisTahKariet(karty, state, cmd, p, events);
    state = po;
  }
  return { stat, karty, tahov };
}

describe("štatistiky a príkaz „tah“", () => {
  for (const seed of [4, 9, 16]) {
    it(`seed ${seed}: vyloženia cez „tah“ = vyloženia po jednom`, () => {
      const poJednom = partia(seed, false);
      const akoTah = partia(seed, true);
      expect(akoTah.tahov).toBeGreaterThan(0);
      expect(akoTah.stat).toEqual(poJednom.stat);
      expect(akoTah.karty).toEqual(poJednom.karty);
    });
  }
});

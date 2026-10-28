// Živý odhad poškodenia v klientovi musí sedieť so serverom: z verejného
// pohľadu (viewFor) + evaluateLine vyjde to isté, čo motor uloží do bitky.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { Command, GameState, PlayerId } from "../src/index.ts";
import {
  apply,
  evaluateLine,
  legalCommands,
  lineState,
  loadGameData,
  naTahu,
  poskodenieBitky,
  rngInt,
  rngSeed,
  setupGame,
  viewFor,
} from "../src/index.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

function abstakyVRuke(state: GameState, p: PlayerId): number {
  return state.hraci[p].ruka.filter((k) => k.defId === "abstak").length;
}

describe("poskodenieBitky z verejného pohľadu", () => {
  it("odhad sa rovná poškodeniu, ktoré vyrátal motor", () => {
    let porovnane = 0;
    for (const seed of [11, 42, 2026]) {
      let state = setupGame(data, seed);
      let rng = rngSeed(seed ^ 0xbeef);
      let predtymBezPoskodenia = true;
      for (let i = 0; i < 4000 && state.koniec === null; i++) {
        const b = state.bitkaStav;
        // Porovnáva sa hneď po výpočte: posuny markerov v Prebytku menia priazeň
        // (Bitkár, prebudený Veterinár…), ale poškodenie bitky je už dané.
        const prave = predtymBezPoskodenia && b !== null && b.damage !== null;
        predtymBezPoskodenia = b === null || b.damage === null;
        // Exekúcia (od 2026-10-28 po poškodení) už Dlhy spálila — vrátia sa do pohľadu; bitky s Robotou sa vynechajú.
        const bezRoboty = b !== null && (b.sums[0].Robota ?? 0) + (b.sums[1].Robota ?? 0) === 0;
        if (prave && bezRoboty && b !== null && b.krok === "prebytok" && b.damage !== null) {
          const v0 = viewFor(data, state, 0);
          const sDlhmi = (p: PlayerId) => ({ ...v0.hraci[p], priznane: [...v0.hraci[p].priznane, ...Array.from({ length: b.exekutor[p] }, (_, i) => ({ uid: -500 - 10 * p - i, defId: "dlh", leftLayout: 0, rightLayout: 0 }))] });
          const view = { ...v0, hraci: [sDlhmi(0), sDlhmi(1)] as typeof v0.hraci };
          // lineState ako klient: karta v strede (aj starší) a Pasca v Dedičstve.
          const linia = evaluateLine(data, lineState(view));
          const odhad = poskodenieBitky(data, view, linia.sums, [abstakyVRuke(state, 0), abstakyVRuke(state, 1)]);
          expect(odhad).toEqual(b.damage);
          porovnane++;
        }
        const hrac = naTahu(state);
        if (hrac === null) break;
        const cmds = legalCommands(data, state, hrac);
        const [idx, dalsi] = rngInt(rng, cmds.length);
        rng = dalsi;
        state = apply(data, state, cmds[idx] as Command, hrac).state;
      }
    }
    expect(porovnane).toBeGreaterThan(0);
  });
});

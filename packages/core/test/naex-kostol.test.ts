// Roadmapa #112: pri Kostole svietila v Pitke na
// kartách značka NA EX. Motor NA EX nepustil (cmdNaex aj moznostiNaex Kostol stráži),
// chyba bola v klientovi — značku kreslil bez Kostola. Klient teraz berie možnosti
// z moznostiNaexVPohlade a tá sa musí zhodovať s legálnymi ťahmi motora.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { CardInstance, Command, GameState, PlayerId } from "../src/index.ts";
import { apply, legalCommands, loadGameData, moznostiNaex, moznostiNaexVPohlade, mozeHrat, naTahu, rngInt, rngSeed, setupGame, viewFor } from "../src/index.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

const kto = (s: GameState): PlayerId | null => ([0, 1] as const).find((q) => mozeHrat(s, q)) ?? naTahu(s);

/** NA EX, ktoré motor hráčovi p teraz dovolí. */
const legalneNaex = (s: GameState, p: PlayerId): number[] =>
  mozeHrat(s, p)
    ? legalCommands(data, s, p)
        .flatMap((c) => (c.type === "naex" ? [c.uid] : []))
        .sort((a, b) => a - b)
    : [];

describe("NA EX z pohľadu klienta = legálne NA EX motora", () => {
  // Sada v7 má viac kariet a dlhšie partie — náhodné partie trvajú dlhšie.
  it("v náhodných partiách v každom stave oboch hráčov (aj pri Kostole)", { timeout: 60000 }, () => {
    let pitky = 0;
    let kostol = 0;
    for (let seed = 500; seed < 540; seed++) {
      let s = setupGame(data, seed);
      let rng = rngSeed(seed * 31 + 7);
      for (let krok = 0; s.koniec === null && krok < 3000; krok++) {
        for (const p of [0, 1] as const) {
          const pohlad = [...moznostiNaexVPohlade(data, viewFor(data, s, p))].sort((a, b) => a - b);
          expect(pohlad, `seed ${seed}, krok ${krok}, hráč ${p}`).toEqual(legalneNaex(s, p));
        }
        if (s.faza === "pitka") {
          pitky++;
          if (s.ciel?.lokalita?.defId === "kostol") kostol++;
        }
        const q = kto(s);
        if (q === null) break;
        const cmds = legalCommands(data, s, q).filter((c) => c.type !== "vzdat");
        const [i, r] = rngInt(rng, 2 ** 31);
        rng = r;
        s = apply(data, s, cmds[i % cmds.length] as Command, q).state;
      }
    }
    expect(pitky).toBeGreaterThan(100);
    expect(kostol).toBeGreaterThan(0);
  });
});

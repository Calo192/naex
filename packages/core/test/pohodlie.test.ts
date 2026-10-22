// Menej klikov (roadmapa #9 B): návrh prebytku na jeden klik a automatické
// „končím“ v Pitke musia byť vždy legálne ťahy, ktoré server prijme.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { Command, GameState } from "../src/index.ts";
import { apply, autoKoniecPitky, legalCommands, loadGameData, navrhPrebytku, naTahu, rngInt, rngSeed, setupGame, viewFor } from "../src/index.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

describe("menej klikov (roadmapa #9 B)", () => {
  it("návrh prebytku prejde ako jeden „tah“ a rozdelí celý prebytok", () => {
    let navrhov = 0;
    for (const seed of [2, 3, 5, 7, 11, 13]) {
      let s: GameState = setupGame(data, seed);
      let rng = rngSeed(seed ^ 0x91);
      for (let i = 0; i < 20000 && s.koniec === null; i++) {
        const p = naTahu(s);
        if (p === null) break;
        const n = navrhPrebytku(data, viewFor(data, s, p));
        if (n !== null) {
          navrhov++;
          const posunov = s.bitkaStav!.prebytokZostava;
          const po = apply(data, s, n.prikaz, p).state;
          expect(n.kroky.length).toBeGreaterThan(0);
          expect(n.kroky.length).toBeLessThanOrEqual(posunov);
          // Po návrhu sa už na prebytok tohto hráča nečaká.
          expect(po.bitkaStav?.krok === "prebytok" && po.bitkaStav.caka === p).toBe(false);
          s = po;
          continue;
        }
        const cmds = legalCommands(data, s, p);
        const [j, r] = rngInt(rng, cmds.length);
        rng = r;
        s = apply(data, s, cmds[j] as Command, p).state;
      }
    }
    expect(navrhov).toBeGreaterThan(5);
  });

  it("automatické „končím“ v Pitke je legálne a mimo zvoleného kola nič nerobí", () => {
    let auto = 0;
    for (const seed of [4, 6, 8]) {
      let s: GameState = setupGame(data, seed);
      let rng = rngSeed(seed ^ 0x33);
      for (let i = 0; i < 20000 && s.koniec === null; i++) {
        const p = naTahu(s);
        if (p === null) break;
        const v = viewFor(data, s, p);
        expect(autoKoniecPitky(v, null)).toBeNull();
        expect(autoKoniecPitky(v, s.kolo + 1)).toBeNull();
        const c = autoKoniecPitky(v, s.kolo);
        if (c !== null) {
          auto++;
          expect(legalCommands(data, s, p)).toContainEqual(c);
        }
        const cmds = legalCommands(data, s, p);
        const [j, r] = rngInt(rng, cmds.length);
        rng = r;
        s = apply(data, s, cmds[j] as Command, p).state;
      }
    }
    expect(auto).toBeGreaterThan(10);
  });
});

// Rod v hláškach (Michal 2026-10-22): motor značí sloveso {N:muž|žena|neutrálne},
// klient dosadí tvar podľa pohlavia hráča z profilu; bot hovorí v mužskom rode,
// bez voľby je hláška neutrálna (prítomný čas).

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { Command, GameState, Rod } from "../src/index.ts";
import { apply, legalCommands, loadGameData, naTahu, rngInt, rngSeed, rodovo, rozlozRod, setupGame, tvar } from "../src/index.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

describe("tvar a rozlozRod", () => {
  it("muž, žena, bot (mužský rod) a neuvedené (neutrálne)", () => {
    expect(["muz", "zena", "bot", null].map((r) => tvar(r as Rod, "skončil", "skončila", "končí"))).toEqual(["skončil", "skončila", "skončil", "končí"]);
    const text = `Hráč 1 ${rodovo(0, "vybral", "vybrala", "vyberá")} bitku, hráč 2 ${rodovo(1, "ukradol", "ukradla", "kradne")} 2 cigarety.`;
    expect(rozlozRod(text, ["zena", "bot"])).toBe("Hráč 1 vybrala bitku, hráč 2 ukradol 2 cigarety.");
    expect(rozlozRod(text, [null, "muz"])).toBe("Hráč 1 vyberá bitku, hráč 2 ukradol 2 cigarety.");
  });

  it("v náhodných partiách sa každá hláška rozloží na čistý text pre každý rod", () => {
    const rody: readonly (readonly [Rod, Rod])[] = [["muz", "zena"], ["zena", "bot"], [null, null]];
    let znaciek = 0;
    for (const seed of [3, 7, 11, 19, 23]) {
      let state: GameState = setupGame(data, seed);
      let rng = rngSeed(seed ^ 0x40d);
      for (let i = 0; state.koniec === null && i < 20000; i++) {
        const hrac = naTahu(state);
        if (hrac === null) break;
        const cmds = legalCommands(data, state, hrac);
        const [j, r] = rngInt(rng, cmds.length);
        rng = r;
        const { state: po, events } = apply(data, state, cmds[j] as Command, hrac);
        for (const e of events) {
          const texty = e.type === "log" ? [e.text] : e.type === "koniec" ? [e.dovod] : [];
          for (const t of texty) {
            if (t.includes("{")) znaciek++;
            for (const r2 of rody) expect(rozlozRod(t, r2), t).not.toMatch(/[{}|]/);
          }
        }
        state = po;
      }
    }
    expect(znaciek).toBeGreaterThan(0);
  });
});

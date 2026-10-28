// Absťák „Nervák“ (v8.1, Michal 2026-10-28, roadmapa #113; návrhy 1 + 4 z docs/napady/abstak-2.html):
// každý Absťák dá v bitke 1 Pohoršenie navyše (PRAVIDLA §9.2) popri rane menej (§9.3).

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { CardInstance, GameState } from "../src/index.ts";
import { apply, evaluateLine, legalCommands, lineState, loadGameData, naTahu, pohorseniaVBitke, rngInt, rngSeed, setupGame, viewFor } from "../src/index.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);
let uid = 97000;
const inst = (defId: string): CardInstance => ({ uid: ++uid, defId, leftLayout: 0, rightLayout: 0 });

describe("§9.2 Nervák: Absťák = Pohoršenie navyše", () => {
  const s0 = setupGame(data, 7);
  const sums = evaluateLine(data, lineState(s0)).sums;
  const s = (priznane: number, vRuke: number): GameState => ({
    ...s0,
    hraci: [
      {
        ...s0.hraci[0],
        priznane: Array.from({ length: priznane }, () => inst("abstak")),
        ruka: [...s0.hraci[0].ruka, ...Array.from({ length: vRuke }, () => inst("abstak"))],
      },
      s0.hraci[1],
    ],
  });

  it("každý priznaný Absťák pridá hráčovi 1 Pohoršenie, súperovi nič", () => {
    const [bez0, bez1] = pohorseniaVBitke(data, s(0, 0), sums);
    const [s2, s2super] = pohorseniaVBitke(data, s(2, 0), sums);
    expect(s2).toBe(bez0 + 2);
    expect(s2super).toBe(bez1);
  });

  it("Absťák v ruke sa do Pohoršení neráta — počet Pohoršení by prezradil ruku", () => {
    expect(pohorseniaVBitke(data, s(1, 2), sums)[0]).toBe(pohorseniaVBitke(data, s(1, 0), sums)[0]);
    // Rovnaký výsledok z pohľadu súpera (ten ruku nevidí).
    expect(pohorseniaVBitke(data, viewFor(data, s(1, 2), 1), sums)[0]).toBe(pohorseniaVBitke(data, s(1, 2), sums)[0]);
  });

  it("v partii hráč s Absťákmi dostane v kroku Pohoršenie aspoň toľko Pohoršení, koľko má Absťákov", () => {
    let videl = 0;
    for (const seed of [3, 4, 6, 9]) {
      let st: GameState = setupGame(data, seed);
      let rng = rngSeed(seed);
      for (let i = 0; st.koniec === null && i < 20000; i++) {
        const p = naTahu(st);
        if (p === null) break;
        const cmds = legalCommands(data, st, p);
        const [j, r] = rngInt(rng, cmds.length);
        rng = r;
        const pred = st;
        st = apply(data, st, cmds[j]!, p).state;
        const b = st.bitkaStav;
        if (b !== null && pred.bitkaStav?.krok !== "pohorsenie" && b.krok === "pohorsenie") {
          for (const q of [0, 1] as const) {
            const abst = st.hraci[q].priznane.filter((k) => k.defId === "abstak").length;
            if (abst === 0) continue;
            expect(b.pohorseniaSpolu?.[q] ?? b.pohorsenieZostava[q]).toBeGreaterThanOrEqual(abst);
            videl++;
          }
        }
      }
    }
    expect(videl).toBeGreaterThan(0);
  });
});

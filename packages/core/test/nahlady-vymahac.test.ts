// Náhľad bitky s Vymáhačom (playtest 20261109-115955, Jano N13, Šimon N9): Vymáhač dáva Ranu
// za každé 2 priznané Dlhy v bitke — teda s Dlhmi zo všetkých Pitiek kola. Náhľad (odhad bitky,
// náhľad NA EX) ich bral spred Pitiek a Vymáhača podhodnotil (K4: náhľad 3 : 7, bitka 9 : 18).

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { GameState, PlayerId } from "../src/index.ts";
import {
  apply,
  dalsiePitkyKola,
  evaluateLine,
  lineState,
  loadGameData,
  mozeHrat,
  naTahu,
  poskodenieBitky,
  poskodenieStola,
  rngInt,
  rngSeed,
  setupGame,
  stolPriPoskodeni,
  tahBota,
  viewFor,
} from "../src/index.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

describe("náhľad bitky ráta Vymáhača s Dlhmi po Pitkách kola", () => {
  it("Rany Vymáhača v náhľade = jeho Vymáhače × (polovica Dlhov pri poškodení − polovica dnešných)", () => {
    let najdene = 0;
    for (let seed = 1; seed <= 60 && najdene < 3; seed++) {
      let s: GameState = setupGame(data, 7000 + seed);
      let rng = rngSeed(seed);
      for (let krok = 0; krok < 400 && s.koniec === null; krok++) {
        if (s.faza === "zhromazdenie" || s.faza === "pitka") {
          for (const p of [0, 1] as const) {
            const vymahace = [...s.strany[0], ...s.strany[1]].filter((pl) => pl.playedBy === p && pl.card.defId === "vymahac").length;
            if (vymahace === 0) continue;
            const view = viewFor(data, s, p);
            const stol = stolPriPoskodeni(data, view, dalsiePitkyKola(data, view));
            const ranyNavyse = vymahace * (Math.floor(stol.hraci[p].dlhy / 2) - Math.floor(view.hraci[p].dlhy / 2));
            if (ranyNavyse <= 0) continue;
            const rany = (x: typeof view): number => evaluateLine(data, lineState(x)).sums[p].Rana ?? 0;
            expect(rany(stol) - rany(view), `seed ${seed}`).toBe(ranyNavyse);
            expect(poskodenieStola(data, stol).tuhe[p]).toBeGreaterThanOrEqual(poskodenieBitky(data, stol, evaluateLine(data, lineState(view)).sums).tuhe[p]);
            najdene++;
          }
        }
        const q: PlayerId | null = ([0, 1] as const).find((x) => mozeHrat(s, x)) ?? naTahu(s);
        if (q === null) break;
        const [n, r] = rngInt(rng, 2 ** 31);
        rng = r;
        s = apply(data, s, tahBota(data, s, q, n), q).state;
      }
    }
    expect(najdene).toBeGreaterThan(0);
  }, 60000);
});

// Hlášky v logu (Michal 2026-10-22): tvary čísloviek („1 cigaretu“, nie
// „1 cigariet“) a odpoveď na NA EX, ktorá zmení prevahu v kraji alebo počet
// Pitiek — pravidlo to dovoľuje (b22d4d6), hráč to musí vidieť (názor #27).

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { Command, GameState } from "../src/index.ts";
import { apply, cigariet, kariet, legalCommands, loadGameData, naTahu, prevahaStran, rngInt, rngSeed, setupGame } from "../src/index.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

describe("tvary čísloviek", () => {
  it("1 cigaretu, 2–4 cigarety, 0 a 5+ cigariet; to isté karty", () => {
    expect([0, 1, 2, 4, 5, 11].map(cigariet)).toEqual(["0 cigariet", "1 cigaretu", "2 cigarety", "4 cigarety", "5 cigariet", "11 cigariet"]);
    expect([0, 1, 3, 7].map(kariet)).toEqual(["0 kariet", "1 kartu", "3 karty", "7 kariet"]);
  });
});

describe("odpoveď na NA EX ohlási zmenu prevahy a počtu Pitiek", () => {
  it("hláška práve vtedy, keď sa prevaha v kraji či počet Pitiek zmení", () => {
    let odpovedi = 0;
    let hlasky = 0;
    for (const seed of [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610]) {
      let state: GameState = setupGame(data, seed);
      let rng = rngSeed(seed ^ 0x27);
      for (let i = 0; state.koniec === null && i < 20000; i++) {
        const hrac = naTahu(state);
        if (hrac === null) break;
        const cmds = legalCommands(data, state, hrac);
        const [j, r] = rngInt(rng, cmds.length);
        rng = r;
        const cmd = cmds[j] as Command;
        const { state: po, events } = apply(data, state, cmd, hrac);
        // Len keď po odpovedi beží tá istá Pitka — dohratá bitka by líniu už upratala.
        const taIstaPitka = po.faza === "pitka" && po.pitkaCislo === state.pitkaCislo;
        if (cmd.type === "place" && state.faza === "pitka" && state.pitkaStav?.reakcia === hrac && taIstaPitka) {
          odpovedi++;
          // v9.2: odpovede ležia lícom dole a hlásia sa až pri otočení — prevaha pred kolom odpovedí.
          const pred = prevahaStran(data, state.strany.map((st) => st.filter((pl) => pl.odpoved !== true)) as unknown as GameState["strany"]);
          const teraz = prevahaStran(data, po.strany);
          const texty = events.flatMap((e) => (e.type === "log" && e.text.startsWith("Odpoveď na NA EX:") ? [e.text] : []));
          if (!events.some((e) => e.type === "log" && e.text.startsWith("Odpovede sa otáčajú naraz"))) {
            expect(texty).toEqual([]);
            state = po;
            continue;
          }
          const zmienPrevahy = [0, 1].filter((k) => pred[k] !== teraz[k]).length;
          expect(texty.filter((t) => t.includes("prevahu")).length).toBe(zmienPrevahy);
          // Počet Pitiek po odpovedi — hra ho ešte v tom istom ťahu nezmení inak.
          const pitky = texty.filter((t) => t.includes("Pitiek v kole"));
          expect(pitky).toHaveLength(po.pitkyCelkom === state.pitkyCelkom ? 0 : 1);
          hlasky += texty.length;
        }
        state = po;
      }
    }
    expect(odpovedi).toBeGreaterThan(10);
    expect(hlasky).toBeGreaterThan(0);
  });
});

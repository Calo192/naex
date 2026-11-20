// Účet špakov na konci hry (inšpekcia UI 20261120-1324, S-01): riadky rozpisu musia dať
// „spolu“ — aj s hádkou vo finále a krádežou pri zajatí. Čísla sú z nástenky a konca hry,
// ktoré vidia obaja hráči, takže rozpis súpera nič skryté neprezradí.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { Command, GameState, RozpisSpakov } from "../src/index.ts";
import { apply, legalCommands, loadGameData, naTahu, rngInt, rngSeed, rozpisSpakov, setupGame, viewFor } from "../src/index.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

const sucetRiadkov = (r: RozpisSpakov): number =>
  r.zaBitky + r.zaStarsich + r.prebytok + r.hadka + r.exekutor + r.zajatie + r.cirhoza + r.vykupne + r.vazni;

/** Náhodné partie dohraté po finále. */
function dohratePartie(): GameState[] {
  const partie: GameState[] = [];
  for (let seed = 1; seed <= 40; seed++) {
    let state: GameState = setupGame(data, seed * 53, { lokalit: 3 });
    let rng = rngSeed(seed ^ 0xacc0);
    for (let i = 0; i < 8000 && state.koniec === null; i++) {
      const hrac = naTahu(state);
      if (hrac === null) break;
      const cmds = legalCommands(data, state, hrac);
      if (cmds.length === 0) break;
      const [idx, dalsi] = rngInt(rng, cmds.length);
      rng = dalsi;
      state = apply(data, state, cmds[idx] as Command, hrac).state;
    }
    if (state.koniec?.body != null) partie.push(state);
  }
  return partie;
}

describe("rozpisSpakov", () => {
  it("súčet riadkov = spolu v pohľade oboch hráčov, aj s hádkou vo finále", () => {
    const partie = dohratePartie();
    expect(partie.length).toBeGreaterThan(10);
    let sHadkou = 0;
    for (const state of partie) {
      for (const miesto of [0, 1] as const) {
        const view = viewFor(data, state, miesto);
        const rozpis = rozpisSpakov(view);
        for (const p of [0, 1] as const) {
          expect(sucetRiadkov(rozpis[p])).toBe(rozpis[p].spolu);
          expect(rozpis[p].spolu).toBe(state.koniec?.body?.[p]);
        }
      }
      if (state.nastenka.some((b) => (b.hadkaSpaky?.[0] ?? 0) + (b.hadkaSpaky?.[1] ?? 0) > 0)) sHadkou++;
    }
    expect(sHadkou).toBeGreaterThan(0);
  });
});

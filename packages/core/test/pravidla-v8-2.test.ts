// Pravidlá v8.2 (Michal 2026-10-30, z jeho partie a výučby): akcia Dlh sa volá
// Hazard, Dlh a Absťák sú počítadlá (nie karty) a posun markera Pohoršením
// a prebytkom stojí podľa zóny (PRAVIDLA §8, §9.2, §9.4, §10, §11).

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { BitkaStav, Command, GameState } from "../src/index.ts";
import { apply, legalCommands, loadGameData, naTahu, rngInt, rngSeed, setupGame, viewFor } from "../src/index.ts";
import { zPolohy } from "./helpers.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

// Cena posunu markera (v8.2) a prepadnutie hádky (v10) zanikli s v11 — strach-reci.test.ts.

describe("§11 Dlh je počítadlo — jadro sa na kartu dlh nespolieha (v8.2); Absťák je od v9.1 karta", () => {
  // Admin kartu Dlh zo sady vyradil; hra musí bežať aj bez nej — aj bez karty Absťák (staršia sada).
  const bez = { ...cardsJson, cards: cardsJson.cards.filter((c) => c.id !== "dlh" && c.id !== "abstak") };
  const sada = loadGameData(bez, eldersJson, scorecardsJson);

  it("náhodné partie dobehnú, Dlhy pribúdajú len do počítadla; sada bez karty Absťák ho nedáva", () => {
    let dlhy = 0;
    let abstaky = 0;
    for (const seed of [1, 2, 3, 4]) {
      let st: GameState = setupGame(sada, seed);
      let rng = rngSeed(seed ^ 0x82);
      for (let i = 0; st.koniec === null && i < 20000; i++) {
        const p = naTahu(st);
        if (p === null) break;
        const cmds = legalCommands(sada, st, p);
        const [j, r] = rngInt(rng, cmds.length);
        rng = r;
        st = apply(sada, st, cmds[j] as Command, p).state;
        for (const h of st.hraci) {
          const karty = [...h.ruka, ...h.doberaci, ...h.odhadzovaci, ...h.priznane, ...st.strany.flat().map((pl) => pl.card)];
          expect(karty.some((k) => k.defId === "dlh" || k.defId === "abstak")).toBe(false);
        }
      }
      expect(st.koniec).not.toBeNull();
      dlhy += (st.hraci[0].dlhyZiskane ?? 0) + (st.hraci[1].dlhyZiskane ?? 0);
      abstaky += (st.hraci[0].abstakyZiskane ?? 0) + (st.hraci[1].abstakyZiskane ?? 0);
    }
    expect(dlhy).toBeGreaterThan(0);
    expect(abstaky).toBe(0);
  });

  it("Dlhy a počet Absťákov sú verejné — viewFor ich posiela obom hráčom", () => {
    const s0 = setupGame(sada, 9);
    const abstak = (uid: number) => ({ uid, defId: "abstak", leftLayout: 0, rightLayout: 0 });
    const s: GameState = { ...s0, hraci: [{ ...s0.hraci[0], dlhy: 3, doberaci: [...s0.hraci[0].doberaci, abstak(990101)], ruka: [...s0.hraci[0].ruka, abstak(990102)] }, s0.hraci[1]] };
    for (const ja of [0, 1] as const) {
      expect(viewFor(sada, s, ja).hraci[0]).toMatchObject({ dlhy: 3, abstaky: 2 });
    }
  });
});

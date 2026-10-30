// Stávka bitky (Michal 2026-10-22, návrh 3 A z playtestu 20261021-143600):
// výpočet je v jadre nad verejným pohľadom, takže obaja hráči musia vidieť
// tú istú stávku, len s opačným znamienkom. V6 sa stávka ráta v špakoch.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { Command, GameState } from "../src/index.ts";
import { apply, kartyBitky, legalCommands, loadGameData, naTahu, rngInt, rngSeed, setupGame, spakyZaStarsich, stavkaBitky, viewFor } from "../src/index.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

/** Náhodné partie; `pri` dostane každý stav v Zhromaždení bitky o lokalitu. */
function prejdiZhromazdenia(pri: (state: GameState) => void): void {
  for (const seed of [7, 42, 2026]) {
    let state = setupGame(data, seed, { lokalit: 5 });
    let rng = rngSeed(seed ^ 0x5eed);
    for (let i = 0; i < 6000 && state.koniec === null; i++) {
      if (state.faza === "zhromazdenie" && state.ciel?.typ === "lokalita") pri(state);
      const hrac = naTahu(state);
      if (hrac === null) break;
      const cmds = legalCommands(data, state, hrac);
      const [idx, dalsi] = rngInt(rng, cmds.length);
      rng = dalsi;
      state = apply(data, state, cmds[idx] as Command, hrac).state;
    }
  }
}

describe("stavkaBitky", () => {
  it("obaja hráči vidia tú istú stávku s opačným znamienkom", () => {
    let porovnane = 0;
    prejdiZhromazdenia((state) => {
      // So skrytou Záverečnou vidí každý inú líniu — stávka sa líšiť smie.
      if (state.strany.some((strana) => strana.some((pl) => pl.zaverecna === true))) return;
      // Absťák v ruke pozná len jeho majiteľ.
      if (state.hraci.some((h) => h.ruka.some((k) => k.defId === "abstak"))) return;
      const s0 = stavkaBitky(data, viewFor(data, state, 0));
      const s1 = stavkaBitky(data, viewFor(data, state, 1));
      expect(s0).not.toBeNull();
      expect(s0?.vyhra).toBe(-(s1?.prehra ?? Number.NaN));
      expect(s0?.prehra).toBe(-(s1?.vyhra ?? Number.NaN));
      porovnane++;
    });
    expect(porovnane).toBeGreaterThan(10);
  });

  it("v8: výhra = karty v línii mínus rozdiel Absťákov (aspoň 1), sekera a nevyplatené zóny starších, ktorí sa víťaza boja", () => {
    let porovnane = 0;
    prejdiZhromazdenia((state) => {
      const view = viewFor(data, state, 0);
      const st = stavkaBitky(data, view);
      if (st === null) return;
      expect(st.karty).toBe(kartyBitky(view).spolu);
      if (view.ciel?.lokalita?.defId !== "kulturny_dom") expect(st.porazenemu).toEqual([0, 0]);
      expect(st.naSekere).toBe(view.spakyNaSekere);
      // Strach platí len víťazovi (v6.1) — je súčasťou stávky.
      expect(st.starsi).toEqual([spakyZaStarsich(view.starsi, 0), spakyZaStarsich(view.starsi, 1)]);
      // Noviny (Titulka, 2026-10-28) víťazovi nič neberú; Herňa (v7) pridá za Dlhy porazeného.
      expect(st.vyhra).toBeGreaterThanOrEqual(1 + view.spakyNaSekere + st.herna[0] + st.starsi[0]);
      expect(st.vyhra).toBeLessThanOrEqual(Math.max(1, st.karty) + view.spakyNaSekere + st.herna[0] + st.starsi[0]);
      expect(-st.prehra).toBeGreaterThanOrEqual(1 + view.spakyNaSekere + st.herna[1] + st.starsi[1]);
      porovnane++;
    });
    expect(porovnane).toBeGreaterThan(10);
  });

  it("mimo bitky o lokalitu stávka nie je", () => {
    const state = setupGame(data, 1, { lokalit: 5 });
    expect(stavkaBitky(data, viewFor(data, state, 0))).toBeNull();
  });
});

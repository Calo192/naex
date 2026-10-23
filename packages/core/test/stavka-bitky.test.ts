// Stávka bitky (Michal 2026-10-22, návrh 3 A z playtestu 20261021-143600):
// výpočet je v jadre nad verejným pohľadom, takže obaja hráči musia vidieť
// tú istú stávku, len s opačným znamienkom.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { ClientState, Command, GameState } from "../src/index.ts";
import { apply, bodyTeraz, legalCommands, loadGameData, naTahu, rngInt, rngSeed, setupGame, stavkaBitky, viewFor } from "../src/index.ts";

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
      const s0 = stavkaBitky(data, viewFor(data, state, 0));
      const s1 = stavkaBitky(data, viewFor(data, state, 1));
      expect(s0).not.toBeNull();
      expect(s0?.vyhra).toBe(-(s1?.prehra ?? Number.NaN));
      expect(s0?.prehra).toBe(-(s1?.vyhra ?? Number.NaN));
      porovnane++;
    });
    expect(porovnane).toBeGreaterThan(10);
  });

  it("bez prebytku je výhra presne cena lokality (aj zo sekery)", () => {
    let porovnane = 0;
    prejdiZhromazdenia((state) => {
      const view = viewFor(data, state, 0);
      const lokalita = view.ciel?.lokalita;
      if (lokalita === undefined || lokalita === null) return;
      const rozdiel = (v: ClientState): number => {
        const b = bodyTeraz(data, v).spolu;
        return b[0] - b[1];
      };
      const ziskane = [lokalita, ...view.naSekeru].map((karta) => ({ karta, hrac: 0 as const }));
      const ocakavane = rozdiel({ ...view, ovladnute: [...view.ovladnute, ...ziskane] }) - rozdiel(view);
      expect(stavkaBitky(data, view, 0)?.vyhra).toBe(ocakavane);
      porovnane++;
    });
    expect(porovnane).toBeGreaterThan(10);
  });

  it("„najviac, čo môže súper získať“ len v poslednej bitke a aspoň toľko ako prehra o 3", () => {
    let posledne = 0;
    prejdiZhromazdenia((state) => {
      const view = viewFor(data, state, 0);
      const s = stavkaBitky(data, view);
      if (view.lokalityVHre.length > 0) {
        expect(s?.superNajviac).toBeNull();
        return;
      }
      expect(s?.superNajviac).not.toBeNull();
      expect(s?.superNajviac ?? Number.NaN).toBeGreaterThanOrEqual(-(s?.prehra ?? Number.NaN));
      posledne++;
    });
    expect(posledne).toBeGreaterThan(0);
  });

  it("mimo bitky o lokalitu stávka nie je", () => {
    const state = setupGame(data, 1, { lokalit: 5 });
    expect(stavkaBitky(data, viewFor(data, state, 0))).toBeNull();
  });
});

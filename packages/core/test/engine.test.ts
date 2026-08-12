// M6 — motor kola: smoke test náhodnými legálnymi ťahmi + test filtrovania.
//
// Test filtrovania je napísaný PRED serverom (BRIEF): dokazuje, že viewFor
// neprepustí uid kariet zo súperovej ruky ani zo žiadneho doberacieho balíčka.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import type { Command, GameState, PlayerId } from "../src/index.ts";
import {
  apply,
  eventsFor,
  legalCommands,
  loadGameData,
  naTahu,
  rngInt,
  rngSeed,
  setupGame,
  viewFor,
} from "../src/index.ts";

const data = loadGameData(cardsJson, eldersJson);

/** Zoznam uid, ktoré hráč `ja` NIKDY nesmie dostať. */
function tajneUids(state: GameState, ja: PlayerId): number[] {
  const super_ = ja === 0 ? 1 : 0;
  return [
    ...state.hraci[super_].ruka.map((k) => k.uid),
    ...state.hraci[0].doberaci.map((k) => k.uid),
    ...state.hraci[1].doberaci.map((k) => k.uid),
    ...state.spolocnyBalicek.map((k) => k.uid),
  ];
}

function expectZiadenUnik(state: GameState, ja: PlayerId): void {
  const json = JSON.stringify(viewFor(data, state, ja));
  for (const uid of tajneUids(state, ja)) {
    // uid sa serializuje ako "uid":N nasledované čiarkou alebo }.
    expect(json.includes(`"uid":${uid},`) || json.includes(`"uid":${uid}}`)).toBe(false);
  }
}

/** Odohrá celú hru náhodnými legálnymi ťahmi; vracia počet krokov. */
function smoke(seed: number, kontrolaFiltrovania: boolean): { state: GameState; kroky: number } {
  let state = setupGame(data, seed);
  let testRng = rngSeed(seed ^ 0x5eed);
  let kroky = 0;
  const MAX = 20000;

  while (state.koniec === null) {
    kroky++;
    expect(kroky, "hra sa zacyklila").toBeLessThan(MAX);
    const hrac = naTahu(state);
    expect(hrac, `nikto nie je na ťahu vo fáze ${state.faza}`).not.toBeNull();
    if (hrac === null) break;
    const cmds = legalCommands(data, state, hrac);
    expect(cmds.length, `žiadny legálny ťah vo fáze ${state.faza}`).toBeGreaterThan(0);
    const [idx, rng] = rngInt(testRng, cmds.length);
    testRng = rng;
    const cmd = cmds[idx] as Command;
    const result = apply(data, state, cmd, hrac);
    state = result.state;

    if (kontrolaFiltrovania && kroky % 25 === 0) {
      expectZiadenUnik(state, 0);
      expectZiadenUnik(state, 1);
    }
  }
  return { state, kroky };
}

describe("M6 — setup", () => {
  it("hra sa rozdá: ruky po 10, šenok 8, poldeci 2, cigareta 1", () => {
    const state = setupGame(data, 42);
    expect(state.hraci[0].ruka.length).toBe(10);
    expect(state.hraci[1].ruka.length).toBe(10);
    expect(state.senok.length).toBe(8);
    expect(state.starsi.length).toBe(8);
    expect(state.lokalityVHre.length).toBe(3);
    expect(state.hraci[0].poldeciPlne).toBe(2);
    expect(state.hraci[0].cigarety).toBe(1);
    expect(state.faza).toBe("volbaCiela");
  });

  it("rovnaké semienko dáva rovnakú hru (determinizmus)", () => {
    const a = setupGame(data, 7);
    const b = setupGame(data, 7);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("apply nemení pôvodný stav (nemennosť)", () => {
    const state = setupGame(data, 11);
    const zaloha = JSON.stringify(state);
    const hrac = naTahu(state);
    if (hrac === null) return;
    const cmds = legalCommands(data, state, hrac);
    apply(data, state, cmds[0] as Command, hrac);
    expect(JSON.stringify(state)).toBe(zaloha);
  });
});

describe("M6 — smoke test", () => {
  for (const seed of [1, 1234, 987654]) {
    it(`celá hra náhodnými legálnymi ťahmi dobehne (seed ${seed})`, () => {
      const { state, kroky } = smoke(seed, false);
      expect(state.koniec).not.toBeNull();
      expect(kroky).toBeGreaterThan(10);
    });
  }

  it("hráč nemôže hrať mimo poradia", () => {
    const state = setupGame(data, 5);
    const hrac = naTahu(state);
    if (hrac === null) return;
    const superHrac = hrac === 0 ? 1 : 0;
    const cmds = legalCommands(data, state, hrac);
    expect(() => apply(data, state, cmds[0] as Command, superHrac)).toThrow();
  });
});

describe("M6 — test filtrovania (bezpečnostná hranica)", () => {
  it("viewFor neprepustí uid zo súperovej ruky ani z doberacích balíčkov", () => {
    const state = setupGame(data, 99);
    expectZiadenUnik(state, 0);
    expectZiadenUnik(state, 1);
  });

  it("filtrovanie platí počas celej náhodnej hry", () => {
    smoke(31337, true);
  });

  it("súkromné udalosti (dobrané karty) vidí len adresát", () => {
    // Nájdeme v hre moment, keď niekto ťahá karty, a overíme filtrovanie.
    let state = setupGame(data, 555);
    let testRng = rngSeed(1);
    for (let i = 0; i < 3000 && state.koniec === null; i++) {
      const hrac = naTahu(state);
      if (hrac === null) break;
      const cmds = legalCommands(data, state, hrac);
      const [idx, rng] = rngInt(testRng, cmds.length);
      testRng = rng;
      const { state: novy, events } = apply(data, state, cmds[idx] as Command, hrac);
      state = novy;
      for (const event of events) {
        if (event.type === "kartyTahane") {
          const preSupera = eventsFor(events, event.hrac === 0 ? 1 : 0);
          expect(preSupera).not.toContainEqual(event);
          const preAdresata = eventsFor(events, event.hrac);
          expect(preAdresata).toContainEqual(event);
          return; // stačí jeden overený prípad
        }
      }
    }
    throw new Error("v hre sa nenašlo žiadne ťahanie kariet");
  });
});

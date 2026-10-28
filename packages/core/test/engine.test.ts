// M6 — motor kola: smoke test náhodnými legálnymi ťahmi + test filtrovania.
//
// Test filtrovania je napísaný PRED serverom (BRIEF): dokazuje, že viewFor
// neprepustí uid kariet zo súperovej ruky ani zo žiadneho doberacieho balíčka.

import { describe, expect, it } from "vitest";
// Sada v6 (pred revíziou v7): test stráži pravidlá, ktoré revízia sady nemení.
import cardsJson from "./data/cards-v6.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { Command, GameState, PlayerId } from "../src/index.ts";
import {
  DLZKY_HRY,
  KONSTANTY,
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

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

/** Zoznam uid, ktoré hráč `ja` NIKDY nesmie dostať. */
function tajneUids(state: GameState, ja: PlayerId): number[] {
  const super_ = ja === 0 ? 1 : 0;
  // Vízia (Michal 2026-10-19): hráč, ktorý práve rozhoduje, vidí vrchnú kartu
  // SVOJHO balíčka — jedinú výnimku; súper ju nevidí nikdy.
  const vidiVrch = state.vizia !== null && naTahu(state) === ja;
  // Karta staršieho v súperovej ruke (patronát) je verejná — leží aj na scorecarde.
  const verejneVRuke = new Set(state.starsi.map((e) => e.karta.uid));
  const nahrada = state.patronat[super_]?.nahrada;
  return [
    ...state.hraci[super_].ruka.filter((k) => !verejneVRuke.has(k.uid)).map((k) => k.uid),
    // Súperova karta lícom dole pri patronáte (Michal 2026-10-20).
    ...(nahrada === undefined ? [] : [nahrada.uid]),
    ...state.hraci[ja].doberaci.slice(vidiVrch ? 1 : 0).map((k) => k.uid),
    ...state.hraci[super_].doberaci.map((k) => k.uid),
    ...state.spolocnyBalicek.map((k) => k.uid),
    // Súperova skrytá Záverečná v línii (roadmapa #83).
    ...state.strany.flat().filter((pl) => pl.zaverecna === true && pl.playedBy === super_).map((pl) => pl.card.uid),
    // Súperov balíček stavby šenku (jeho výber v kroku je jeho súčasťou).
    ...(state.draftStav?.balicky[super_] ?? []).map((k) => k.uid),
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

    if (kontrolaFiltrovania && (kroky % 25 === 0 || state.faza === "draft")) {
      expectZiadenUnik(state, 0);
      expectZiadenUnik(state, 1);
    }
  }
  return { state, kroky };
}

describe("M6 — setup", () => {
  it("hra sa rozdá (v6): 4 štartovky v ruke, prázdny doberací balíček, šenok prázdny, poldeci 2, cigarety 3", () => {
    const state = setupGame(data, 42);
    for (const p of [0, 1] as const) {
      expect(state.hraci[p].ruka.map((k) => k.defId).sort()).toEqual(["dievcina_na_vydaj", "milujuca_manzelka", "ministrant", "pijan"]);
      expect(state.hraci[p].doberaci).toEqual([]);
      expect(state.hraci[p].odhadzovaci).toEqual([]);
    }
    expect(state.senok.length).toBe(0);
    expect(state.starsi.length).toBe(8);
    expect(state.lokalityVHre.length).toBe(DLZKY_HRY.stredna);
    expect(state.lokalitCelkom).toBe(DLZKY_HRY.stredna);
    expect(state.hraci[0].poldeciPlne).toBe(2);
    expect(state.hraci[0].cigarety).toBe(3);
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

  it("po každej bitke si hráč dobere 2 karty a kliatby idú do odhadzovacieho balíčka", () => {
    let state = setupGame(data, 2024);
    let testRng = rngSeed(77);
    let kolo = state.kolo;
    let overenych = 0;
    for (let i = 0; i < 20000 && state.koniec === null; i++) {
      const hrac = naTahu(state);
      if (hrac === null) break;
      const cmds = legalCommands(data, state, hrac);
      const [idx, rng] = rngInt(testRng, cmds.length);
      testRng = rng;
      const pred = state;
      const { state: novy, events } = apply(data, state, cmds[idx] as Command, hrac);
      state = novy;
      // Nová kliatba nepríde rovno do ruky — len ak si ju hráč v tom istom
      // ťahu dobral (napr. Hazard ju dá do odhadzovacieho a ťahanie ho zamieša).
      const dobrane = new Set(events.flatMap((e) => (e.type === "kartyTahane" ? e.karty.map((k) => k.uid) : [])));
      for (const p of [0, 1] as const) {
        const noveVRuke = state.hraci[p].ruka.filter(
          (k) => k.uid >= pred.nextUid && (k.defId === "dlh" || k.defId === "cirhoza") && !dobrane.has(k.uid),
        );
        expect(noveVRuke).toEqual([]);
      }
      if (state.kolo !== kolo && state.koniec === null) {
        kolo = state.kolo;
        for (const p of [0, 1] as const) {
          const h = state.hraci[p];
          const dostupne = h.doberaci.length + h.odhadzovaci.length;
          // Po bitke +2 karty, ak bolo z čoho ťahať (Michal 2026-10-19); limit ruky nie je.
          expect(h.ruka.length).toBeGreaterThanOrEqual(Math.min(KONSTANTY.KARTY_PO_BITKE, dostupne));
        }
        expect(events.some((e) => e.type === "kartyTahane" || e.type === "log")).toBe(true);
        overenych++;
      }
    }
    expect(overenych).toBeGreaterThan(0);
  });

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

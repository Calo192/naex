// Štatistiky partie: zápis ťahov náhodnej hry, súčty a vzdanie sa.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { Command, DvojicaStatistik, Event, GameState } from "../src/index.ts";
import {
  apply,
  bodyTeraz,
  legalCommands,
  loadGameData,
  naTahu,
  noveStatistiky,
  normalizujStatistiky,
  prazdneStatistiky,
  rngInt,
  rngSeed,
  scitajStatistiky,
  setupGame,
  uzavriStatistiky,
  viewFor,
  zapisTah,
} from "../src/index.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

function odohraj(seed: number): { state: GameState; stat: DvojicaStatistik; udalosti: Event[] } {
  let state = setupGame(data, seed);
  let rng = rngSeed(seed ^ 0xbeef);
  let stat = noveStatistiky();
  const udalosti: Event[] = [];
  for (let krok = 0; state.koniec === null && krok < 20000; krok++) {
    const hrac = naTahu(state);
    if (hrac === null) break;
    const cmds = legalCommands(data, state, hrac);
    const [i, r] = rngInt(rng, cmds.length);
    rng = r;
    const cmd = cmds[i] as Command;
    const vysledok = apply(data, state, cmd, hrac);
    stat = zapisTah(stat, state, cmd, hrac, vysledok.state, vysledok.events);
    udalosti.push(...vysledok.events);
    state = vysledok.state;
  }
  return { state, stat: uzavriStatistiky(data, stat, state), udalosti };
}

describe("štatistiky partie", () => {
  it("sedia s udalosťami a záverečným stavom", () => {
    for (const seed of [1, 7, 42, 2026]) {
      const { state, stat, udalosti } = odohraj(seed);
      expect(state.koniec).not.toBeNull();
      const bitky = udalosti.filter((e) => e.type === "bitkaVysledok");
      for (const p of [0, 1] as const) {
        const s = stat[p];
        expect(s.partie).toBe(1);
        expect(s.bitky).toBe(bitky.length);
        expect(s.bitkyVyhrane).toBe(bitky.filter((b) => b.vitaz === p).length);
        expect(s.tuheUdelene).toBe(bitky.reduce((a, b) => a + b.damage.tuhe[p], 0));
        expect(s.kola).toBe(state.kolo);
        expect(s.lokalityOvladnute).toBe(state.ovladnute.filter((o) => o.hrac === p).length);
        const pecen = udalosti.reduce((a, e) => a + (e.type === "pecen" && e.hrac === p ? e.mnozstvo : 0), 0);
        expect(s.poskodeniePecene).toBe(pecen);
        // Každá Cirhóza vzniká z pečene: aspoň prah 2 poškodenia na kus.
        expect(s.poskodeniePecene).toBeGreaterThanOrEqual(s.cirhozyZiskane * 2);
        if (state.koniec?.body != null) {
          expect(s.body).toBe(state.koniec.body[p]);
          const podla = Object.values(s.bodyPodla).reduce((a, x) => a + x, 0);
          expect(podla).toBe(s.body);
        }
      }
      // Remíza o staršieho nemá víťaza.
      expect(stat[0].bitkyVyhrane + stat[1].bitkyVyhrane).toBe(bitky.filter((b) => b.vitaz !== null).length);
      expect(stat[0].tahy + stat[1].tahy).toBeGreaterThan(0);
    }
  });

  it("súčet sčíta počítadlá a rekordy berie ako maximum", () => {
    const a = { ...prazdneStatistiky(), partie: 1, bitky: 3, najvacsiZasah: 7, akcie: { Rana: 2 }, bodyPodla: { strach: 3 } };
    const b = { ...prazdneStatistiky(), partie: 1, bitky: 2, najvacsiZasah: 4, akcie: { Rana: 1, Pecka: 1 }, bodyPodla: { cigarety: 1 } };
    const s = scitajStatistiky(a, b);
    expect(s.partie).toBe(2);
    expect(s.bitky).toBe(5);
    expect(s.najvacsiZasah).toBe(7);
    expect(s.akcie).toEqual({ Rana: 3, Pecka: 1 });
    expect(s.bodyPodla).toEqual({ strach: 3, cigarety: 1 });
  });

  it("normalizácia doplní chýbajúce polia a zahodí nečísla", () => {
    const s = normalizujStatistiky({ bitky: 4, tahy: "x", akcie: { Rana: 2, Pecka: "y" } });
    expect(s.bitky).toBe(4);
    expect(s.tahy).toBe(0);
    expect(s.cirhozyZiskane).toBe(0);
    expect(s.akcie).toEqual({ Rana: 2 });
  });
});

describe("vzdanie sa", () => {
  it("vyhráva súper, aj keď sa vzdávajúci nie je na ťahu", () => {
    const state = setupGame(data, 5);
    const naRade = naTahu(state);
    expect(naRade).not.toBeNull();
    const druhy = naRade === 0 ? 1 : 0;
    const { state: po, events } = apply(data, state, { type: "vzdat" }, druhy);
    expect(po.koniec?.vitaz).toBe(naRade);
    expect(po.faza).toBe("koniec");
    expect(events.some((e) => e.type === "koniec")).toBe(true);
    expect(() => apply(data, po, { type: "vzdat" }, 0)).toThrow();
  });
});

describe("bodyTeraz — živý odhad bodov z pohľadu hráča", () => {
  it("na konci hry sa vlastné body rovnajú záverečnému bodovaniu; súperove len ak nie sú neisté", () => {
    let overene = 0;
    for (const seed of [3, 8, 21, 55, 89]) {
      const { state } = odohraj(seed);
      const body = state.koniec?.body;
      if (body == null) continue;
      for (const p of [0, 1] as const) {
        const odhad = bodyTeraz(data, viewFor(data, state, p));
        expect(odhad.spolu[p]).toBe(body[p]);
        const su = p === 0 ? 1 : 0;
        if (!odhad.neiste[su]) expect(odhad.spolu[su]).toBe(body[su]);
        // Súčet je presne súčet scorecardov — rozpis sedí s „body teraz“.
        expect(odhad.starsi.reduce((a, b) => a + b.body[p], 0)).toBe(odhad.spolu[p]);
        overene++;
      }
    }
    expect(overene).toBeGreaterThan(0);
  });
});

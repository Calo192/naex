// Kronika partie (Michal 2026-10-22, profily): záznam po kolách musí sedieť
// s udalosťami, štatistikami hráčov aj so záverečným bodovaním.

import { describe, expect, it } from "vitest";
// Sada v6 (pred revíziou v7): test stráži pravidlá, ktoré revízia sady nemení.
import cardsJson from "./data/cards-v6.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { Command, DvojicaStatistik, Event, GameState, StavKroniky } from "../src/index.ts";
import {
  apply,
  doplnNaexZKroniky,
  legalCommands,
  loadGameData,
  naTahu,
  novaKronika,
  noveStatistiky,
  rngInt,
  rngSeed,
  setupGame,
  tahBota,
  uzavriStatistiky,
  zapisDoKroniky,
  zapisTah,
} from "../src/index.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

function partia(seed: number, bot: boolean): { s: GameState; k: StavKroniky; stat: DvojicaStatistik; vysledky: Event[] } {
  let s = setupGame(data, seed, { lokalit: 5 });
  let rng = rngSeed(seed ^ 0x77);
  let k = novaKronika(s);
  let stat = noveStatistiky();
  const vysledky: Event[] = [];
  for (let i = 0; i < 20000 && s.koniec === null; i++) {
    const p = naTahu(s);
    if (p === null) break;
    const [j, r] = rngInt(rng, 2 ** 31);
    rng = r;
    const cmds = legalCommands(data, s, p);
    const cmd = bot ? tahBota(data, s, p, j, { povaha: "stamgast" }) : (cmds[j % cmds.length] as Command);
    const { state: po, events } = apply(data, s, cmd, p);
    k = zapisDoKroniky(data, k, s, cmd, p, po, events);
    stat = zapisTah(stat, s, cmd, p, po, events);
    vysledky.push(...events.filter((e) => e.type === "bitkaVysledok"));
    s = po;
  }
  return { s, k, stat: doplnNaexZKroniky(uzavriStatistiky(stat, s), k.kola), vysledky };
}

describe("kronika partie", () => {
  for (const [seed, bot] of [[5, false], [10, false], [13, true]] as const) {
    it(`seed ${seed}${bot ? " (bot)" : ""}: kolá, bitky, pasy, šenok, NA EX a body sedia`, () => {
      const { s, k, stat, vysledky } = partia(seed, bot);
      expect(s.koniec).not.toBeNull();
      // Každá odohraná bitka má svoje kolo s tým istým výsledkom.
      const sBitkou = k.kola.filter((x) => x.tuhe[0] + x.tuhe[1] > 0 || x.vitaz !== null || x.sekera);
      expect(sBitkou.length).toBeGreaterThanOrEqual(vysledky.length - 1);
      for (const [i, e] of vysledky.entries()) {
        if (e.type !== "bitkaVysledok") continue;
        const kolo = k.kola[i];
        if (kolo === undefined) continue;
        expect(kolo.tuhe).toEqual([e.damage.tuhe[0], e.damage.tuhe[1]]);
        expect(kolo.vitaz).toBe(e.vitaz);
      }
      for (const p of [0, 1] as const) {
        expect(k.kola.flatMap((x) => x.pasy).filter((x) => x.kto === p)).toHaveLength(stat[p].pasy);
        expect(k.kola.reduce((a, x) => a + x.senok[p], 0)).toBe(stat[p].senokKarty);
        expect(k.kola.flatMap((x) => x.naex).filter((x) => x.kto === p)).toHaveLength(stat[p].naex);
        expect(stat[p].naexHodnotene).toBeLessThanOrEqual(stat[p].naex);
        // Väčšina NA EX sa dá posúdiť (súper odpovedal alebo nemohol) — nie je stále null.
        if (stat[p].naex >= 3) expect(stat[p].naexHodnotene).toBeGreaterThan(0);
        expect(stat[p].partieV2).toBe(1);
      }
      // Body po poslednom kole = záverečné bodovanie (ak partia skončila bodovaním).
      const posledne = k.kola.at(-1);
      expect(posledne?.bodyPo).not.toBeNull();
      if (s.koniec?.body != null) expect(posledne?.bodyPo).toEqual([s.koniec.body[0], s.koniec.body[1]]);
      // Lokalita a útočník sú zapísané pri každom kole s bitkou — bez lokality sa nehrá (v8).
      for (const x of sBitkou) expect(x.lokalita).not.toBeNull();
    }, 30_000);
  }
});

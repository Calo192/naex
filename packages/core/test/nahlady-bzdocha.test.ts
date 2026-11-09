// Náhľad NA EX s Bzdochou (playtest 20261109-115955, Vilo N7): majiteľ Bzdochy vidí súperovo
// skryté NA EX — náhľad vlastného NA EX musí začínať od bitky s ním (ako odhad bitky), nie bez neho.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { ClientState, GameState, PlayerId } from "../src/index.ts";
import {
  apply,
  cenaKliatby,
  cenaTahu,
  loadGameData,
  moznostiNaexVPohlade,
  mozeHrat,
  nahladNaexNaKartu,
  naTahu,
  poOdkrytiNaex,
  rngInt,
  rngSeed,
  sMojimiSkrytymiNaex,
  setupGame,
  tahBota,
  viewFor,
} from "../src/index.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);
const ceny = [0, 1].map(() => ({ cirhoza: cenaKliatby("cirhoza"), dlh: cenaKliatby("dlh") })) as unknown as Parameters<typeof cenaTahu>[3];

describe("náhľad NA EX ráta súperovo NA EX, ktoré hráč vidí cez Bzdochu", () => {
  it("bitka pred = bitka so súperovým odkrytým NA EX; zrážka na tej istej karte ostáva Výtržník", () => {
    let porovnani = 0;
    for (let seed = 1; seed <= 40 && porovnani < 20; seed++) {
      let s: GameState = setupGame(data, 8100 + seed);
      let rng = rngSeed(seed);
      for (let krok = 0; krok < 300 && s.koniec === null && porovnani < 20; krok++) {
        const q: PlayerId | null = ([0, 1] as const).find((x) => mozeHrat(s, x)) ?? naTahu(s);
        if (q === null) break;
        if (s.faza === "pitka") {
          const view = viewFor(data, s, q);
          const ciele = moznostiNaexVPohlade(data, view);
          const su: PlayerId = q === 0 ? 1 : 0;
          // Súperovo NA EX, ktoré by majiteľ Bzdochy videl (server ho pošle v pitkaStav.skryteNaex).
          if (ciele.length >= 2 && view.pitkaStav !== null && !(view.pitkaStav.skryteNaex ?? []).some((x) => x.hrac === su)) {
            const [jeho, moje] = [ciele[0]!, ciele[1]!];
            const sBzdochou: ClientState = { ...view, pitkaStav: { ...view.pitkaStav, skryteNaex: [...(view.pitkaStav.skryteNaex ?? []), { hrac: su, uid: jeho }] } };
            const odkryte = poOdkrytiNaex(data, { ...sMojimiSkrytymiNaex(data, sBzdochou), ja: su }, jeho);
            const n = nahladNaexNaKartu(data, sBzdochou, moje, ceny);
            if (odkryte !== null && n !== null) {
              const sJeho = { ...odkryte.view, ja: q };
              expect(n.pred, `seed ${seed}`).toEqual(cenaTahu(data, sJeho, sJeho, ceny).pred);
              const zrazka = nahladNaexNaKartu(data, sBzdochou, jeho, ceny);
              const pl = zrazka?.odkrytie.view.strany.flat().find((x) => x.card.uid === jeho);
              expect(pl?.vytrznik).toBe(true);
              porovnani++;
            }
          }
        }
        const [n, r] = rngInt(rng, 2 ** 31);
        rng = r;
        s = apply(data, s, tahBota(data, s, q, n), q).state;
      }
    }
    expect(porovnani).toBeGreaterThan(5);
  }, 60000);
});

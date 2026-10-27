// Finále v6: prvá vyložená karta leží v strede línie (PRAVIDLA §14b). Keď sú obe
// strany neprázdne, zo strán sa nedá vyčítať, ktorá karta je v strede — stav si
// pamätá stranu prvej karty (stredFinale) a viewFor ju posiela klientovi.

import { describe, expect, it } from "vitest";
// Sada v6 (pred revíziou v7): test stráži pravidlá, ktoré revízia sady nemení.
import cardsJson from "./data/cards-v6.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { GameState, PlacedCard } from "../src/index.ts";
import { apply, loadGameData, naTahu, rngInt, rngSeed, setupGame, stranaStreduFinale, tahBota, viewFor } from "../src/index.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

const pl = (uid: number): PlacedCard => ({ card: { uid, defId: "hasic", leftLayout: 0, rightLayout: 0 }, playedBy: 0 });

describe("stranaStreduFinale", () => {
  const finale = { typ: "finale", lokalita: null } as const;
  it("mimo finále a pri prázdnej línii nič", () => {
    expect(stranaStreduFinale({ ciel: null, strany: [[pl(1)], []] })).toBeNull();
    expect(stranaStreduFinale({ ciel: finale, strany: [[], []] })).toBeNull();
  });
  it("jedna neprázdna strana nesie stred, pri dvoch rozhodne stredFinale", () => {
    expect(stranaStreduFinale({ ciel: finale, strany: [[], [pl(1)]] })).toBe(1);
    expect(stranaStreduFinale({ ciel: finale, strany: [[pl(2)], [pl(1)]], stredFinale: 1 })).toBe(1);
    expect(stranaStreduFinale({ ciel: finale, strany: [[pl(2)], [pl(1)]], stredFinale: 0 })).toBe(0);
  });
});

describe("finále: strana prvej karty", () => {
  it("prvá karta finále určí stred a ostane ním, aj keď pribudnú karty na oboch stranách", () => {
    let videne = 0;
    for (const seed of [8, 11]) {
      let s: GameState = setupGame(data, seed, { lokalit: 3 });
      let rng = rngSeed(seed);
      let prva: { strana: 0 | 1; uid: number } | null = null;
      for (let i = 0; i < 8000 && s.koniec === null; i++) {
        const kto = naTahu(s);
        if (kto === null) break;
        const [j, r] = rngInt(rng, 2 ** 31);
        rng = r;
        const pred = s;
        s = apply(data, s, tahBota(data, s, kto, j), kto).state;
        if (s.ciel?.typ !== "finale") continue;
        const prazdnaPred = pred.ciel?.typ === "finale" && pred.strany[0].length === 0 && pred.strany[1].length === 0;
        if (prazdnaPred && s.strany[0].length + s.strany[1].length > 0) {
          const strana = s.strany[0].length > 0 ? 0 : 1;
          prva = { strana, uid: s.strany[strana][0]!.card.uid };
          expect(s.stredFinale).toBe(strana);
        }
        if (prva !== null && s.faza !== "bitka") {
          const v = viewFor(data, s, 0);
          expect(v.stredFinale).toBe(prva.strana);
          if (s.strany[prva.strana][0] !== undefined) expect(s.strany[prva.strana][0]!.card.uid).toBe(prva.uid);
          if (s.strany[0].length > 0 && s.strany[1].length > 0) videne++;
        }
      }
    }
    // Aspoň v jednej partii ležali vo finále karty na oboch stranách stredu.
    expect(videne).toBeGreaterThan(0);
  }, 60000); // Celé partie botov — pod záťažou celej sady trvajú dlhšie.
});

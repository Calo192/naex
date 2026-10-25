// M3 — stav hráča a odvodené hodnoty.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { PlacedCard } from "../src/index.ts";
import {
  freshPlayer,
  hodnotaViery,
  limitVykladania,
  limitZhromazdenia,
  loadGameData,
  prahCirhozy,
  prahDlhu,
  setupGame,
  prahExekutora,
  velkostBalicka,
} from "../src/index.ts";
import { EMPTY, instanceFor, makeDef, syntheticData } from "./helpers.ts";

const data = syntheticData([makeDef("obcan", EMPTY, EMPTY)]);

function placed(playedBy: 0 | 1, naexBy?: 0 | 1): PlacedCard {
  const card = instanceFor(data, "obcan", EMPTY, EMPTY);
  return naexBy === undefined ? { card, playedBy } : { card, playedBy, naexBy };
}

describe("M3 — limit vykladania", () => {
  it("2 plné poldeci na štarte → limit 3 (Michal 2026-10-20)", () => {
    const player = freshPlayer();
    expect(player.poldeciPlne).toBe(2);
    expect(limitVykladania(player)).toBe(3);
  });

  it("po vypití jedného → limit 2", () => {
    const player = { ...freshPlayer(), poldeciPlne: 1, poldeciVypite: 1 };
    expect(limitVykladania(player)).toBe(2);
  });

  it("poldeci cez NA EX limit nezvyšuje — ani majiteľovi poldeci (pravidlá v4)", () => {
    // Hráč 0 dal NA EX na kartu ležiacu v partii hráča 1: plný poldeci odišiel
    // z jeho zásoby na kartu — limit je len 1 + 1 = 2 (do v4 bol 3).
    const s0 = setupGame(loadGameData(cardsJson, eldersJson, scorecardsJson), 1);
    const strany: [PlacedCard[], PlacedCard[]] = [[], [placed(1, 0)]];
    const s = { ...s0, strany, hraci: [{ ...s0.hraci[0], poldeciPlne: 1 }, { ...s0.hraci[1], poldeciPlne: 2 }] } as typeof s0;
    expect(limitZhromazdenia(s, 0)).toBe(2);
    expect(limitZhromazdenia(s, 1)).toBe(3);
  });

  it("priznané karty limit neovplyvňujú", () => {
    const player = {
      ...freshPlayer(),
      poldeciPlne: 2,
      priznane: [instanceFor(data, "obcan", EMPTY, EMPTY)],
    };
    expect(limitVykladania(player)).toBe(3);
  });
});

describe("M3 — odvodené hodnoty", () => {
  it("veľkosť balíčka neráta priznané ani dedičstvo", () => {
    const karta = () => instanceFor(data, "obcan", EMPTY, EMPTY);
    const player = {
      ...freshPlayer(),
      ruka: [karta(), karta()],
      doberaci: [karta()],
      odhadzovaci: [karta()],
      priznane: [karta()],
      dedicstvo: [karta()],
    };
    expect(velkostBalicka(player)).toBe(4);
  });

  it("v5: prahy priazeň nezdvíha, súperov Exekútor prah Exekúcie zníži; hodnota Viery je 1", () => {
    expect(prahCirhozy()).toBe(3);
    expect(prahDlhu()).toBe(2);
    expect(prahExekutora()).toBe(10);
    expect(prahExekutora(2)).toBe(8);
    expect(hodnotaViery()).toBe(1);
  });
});

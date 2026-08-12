// M3 — stav hráča a odvodené hodnoty.

import { describe, expect, it } from "vitest";
import type { PlacedCard } from "../src/index.ts";
import {
  freshPlayer,
  hodnotaViery,
  limitVykladania,
  prahCirhozy,
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
  it("2 plné poldeci → limit 3", () => {
    const player = freshPlayer();
    expect(player.poldeciPlne).toBe(2);
    expect(limitVykladania(player, [[], []], 0)).toBe(3);
  });

  it("po vypití jedného → limit 2", () => {
    const player = { ...freshPlayer(), poldeciPlne: 1, poldeciVypite: 1 };
    expect(limitVykladania(player, [[], []], 0)).toBe(2);
  });

  it("poldeci cez NA EX sa ráta majiteľovi poldeci, aj v súperovej partii", () => {
    // Hráč 0 dal NA EX na kartu ležiacu v partii hráča 1: jeden plný poldeci
    // sa presunul z jeho zásoby na kartu — limit má ostať 1 + 1 + 1 = 3.
    const player = { ...freshPlayer(), poldeciPlne: 1 };
    const partie: [PlacedCard[], PlacedCard[]] = [[], [placed(1, 0)]];
    expect(limitVykladania(player, partie, 0)).toBe(3);
    // Súperovi ten istý poldeci limit nezvyšuje.
    expect(limitVykladania(freshPlayer(), partie, 1)).toBe(3); // 2 + 0 + 1
  });

  it("priznané karty limit neovplyvňujú", () => {
    const player = {
      ...freshPlayer(),
      priznane: [instanceFor(data, "obcan", EMPTY, EMPTY)],
    };
    expect(limitVykladania(player, [[], []], 0)).toBe(3);
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

  it("prahy a hodnota viery rastú s priazňou", () => {
    expect(prahCirhozy(0)).toBe(2);
    expect(prahCirhozy(2)).toBe(4);
    expect(prahExekutora(0)).toBe(10);
    expect(prahExekutora(2)).toBe(14);
    expect(hodnotaViery(0)).toBe(1);
    expect(hodnotaViery(1)).toBe(2);
  });
});

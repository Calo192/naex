// Ciele vykladania v Zhromaždení — podľa nich klient ukazuje miesta pri ťahaní
// karty a legalCommands z nich skladá príkazy `place`.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { CardInstance, PlacedCard, PlayerId } from "../src/index.ts";
import { cieleVykladania, loadGameData } from "../src/index.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

let uid = 0;
const karta = (defId: string): CardInstance => ({ uid: ++uid, defId, leftLayout: 0, rightLayout: 0 });
const lezi = (defId: string, playedBy: PlayerId = 0): PlacedCard => ({ card: karta(defId), playedBy });
const prazdne: readonly [readonly PlacedCard[], readonly PlacedCard[]] = [[], []];

describe("cieleVykladania", () => {
  it("každá karta smie do vlastnej aj súperovej partie a míňa limit", () => {
    expect(cieleVykladania(data, prazdne, 0, karta("pijan"), 1)).toEqual(["vlastna", "superova"]);
    expect(cieleVykladania(data, prazdne, 0, karta("pijan"), 0)).toEqual([]);
  });

  it("Kočovník do súperovej partie limit nemíňa", () => {
    expect(cieleVykladania(data, prazdne, 0, karta("kocovnik"), 1)).toEqual(["vlastna", "superova"]);
    expect(cieleVykladania(data, prazdne, 0, karta("kocovnik"), 0)).toEqual(["superova"]);
  });

  it("Kliatbu možno priznať aj pri vyčerpanom limite", () => {
    expect(cieleVykladania(data, prazdne, 0, karta("dlh"), 0)).toEqual(["priznanie"]);
    expect(cieleVykladania(data, prazdne, 0, karta("milujuca_manzelka"), 1)).toEqual(["vlastna", "superova", "priznanie"]);
  });

  it("Nástroj limit nemíňa, ale nesusedí s Nástrojom na konci partie", () => {
    expect(cieleVykladania(data, prazdne, 0, karta("noviny"), 0)).toEqual(["vlastna", "superova", "dedicstvo"]);
    const partie = [[lezi("pijan"), lezi("vinko")], []] as const;
    expect(cieleVykladania(data, partie, 0, karta("noviny"), 3)).toEqual(["superova", "dedicstvo"]);
  });

  it("pes sa nestretne s iným zvieraťom toho istého majiteľa — v žiadnej partii", () => {
    const partie = [[], [lezi("cierna_macka", 1)]] as const;
    expect(cieleVykladania(data, partie, 1, karta("pes"), 2)).toEqual([]);
    // Mačka patrí súperovi — hráčovi 0 neprekáža.
    expect(cieleVykladania(data, partie, 0, karta("pes"), 2)).toEqual(["vlastna", "superova"]);
    // Vlastná mačka v súperovej partii prekáža rovnako.
    const podstrcena = [[], [lezi("cierna_macka", 0)]] as const;
    expect(cieleVykladania(data, podstrcena, 0, karta("pes"), 2)).toEqual([]);
  });
});

// Ciele vykladania v Zhromaždení — podľa nich klient ukazuje miesta pri ťahaní
// karty a legalCommands z nich skladá príkazy `place`.

import { describe, expect, it } from "vitest";
// Sada v6 (pred revíziou v7): test stráži pravidlá, ktoré revízia sady nemení.
import cardsJson from "./data/cards-v6.json";
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

  it("Kočovník míňa limit ako každá karta (Michal 2026-10-19)", () => {
    expect(cieleVykladania(data, prazdne, 0, karta("kocovnik"), 1)).toEqual(["vlastna", "superova"]);
    expect(cieleVykladania(data, prazdne, 0, karta("kocovnik"), 0)).toEqual([]);
  });

  it("Kliatbu možno priznať aj pri vyčerpanom limite", () => {
    expect(cieleVykladania(data, prazdne, 0, karta("cirhoza"), 0)).toEqual(["priznanie"]);
    expect(cieleVykladania(data, prazdne, 0, karta("milujuca_manzelka"), 1)).toEqual(["vlastna", "superova", "priznanie"]);
  });

  it("Nástroj limit nemíňa, ale nesusedí s Nástrojom na konci partie", () => {
    expect(cieleVykladania(data, prazdne, 0, karta("noviny"), 0)).toEqual(["vlastna", "superova", "dedicstvo"]);
    const partie = [[lezi("pijan"), lezi("vinko")], []] as const;
    expect(cieleVykladania(data, partie, 0, karta("noviny"), 3)).toEqual(["superova", "dedicstvo"]);
  });

});

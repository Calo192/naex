// Playtest 2026-10-22: náhľad vyloženia pripísal Dlh Finančnej poradkyne jej
// majiteľovi, hoci Pitka ho pripíše súperovi. Náhľad a Pitka rátajú zadĺženie
// tou istou funkciou (zadlzenieZLinie).

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { CardInstance, GameState, PlacedCard } from "../src/index.ts";
import { lineState, loadGameData, nahladVylozenia, prirastkyPitky, setupGame } from "../src/index.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

let uidSeq = 99000;
const inst = (defId: string): CardInstance => ({ uid: ++uidSeq, defId, leftLayout: 0, rightLayout: 0 });

describe("Finančná poradkyňa v náhľade vyloženia", () => {
  it("Dlh z jej akcií náhľad pripíše súperovi rovnako ako Pitka", () => {
    const s0 = setupGame(data, 5);
    let presmerovane = 0;
    for (const def of data.cards.values()) {
      if (!def.tags.includes("Občan")) continue;
      for (const kam of ["vlastna", "superova"] as const) {
        const poradkyna = inst("financna_poradkyna");
        const sused: PlacedCard = { card: inst(def.id), playedBy: kam === "vlastna" ? 0 : 1 };
        const strana = kam === "vlastna" ? 0 : 1;
        const s: GameState = { ...s0, strany: strana === 0 ? [[sused], []] : [[], [sused]] };
        const po: GameState = {
          ...s,
          strany: strana === 0 ? [[sused, { card: poradkyna, playedBy: 0 }], []] : [[], [sused, { card: poradkyna, playedBy: 0 }]],
        };
        const n = nahladVylozenia(data, lineState(s), 0, poradkyna, kam);
        const a = prirastkyPitky(data, s).zadlzenie;
        const b = prirastkyPitky(data, po).zadlzenie;
        expect([n.zmeny[0].Dlh ?? 0, n.zmeny[1].Dlh ?? 0], `${def.id} ${kam}`).toEqual([b[0] - a[0], b[1] - a[1]]);
        if (b[1] > a[1]) presmerovane++;
      }
    }
    // Aspoň jeden sused aktivuje jej Dlh — inak by test nič neoveril.
    expect(presmerovane).toBeGreaterThan(0);
  });
});

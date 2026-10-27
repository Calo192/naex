// Náhľad posunu prebytkom (UX/UI 2026-10-22): web a konzolový klient agentov
// volajú ten istý nahladPosunuPrebytkom. V6 ukazuje odhad špakov (spakyTeraz).

import { describe, expect, it } from "vitest";
// Sada v6 (pred revíziou v7): test stráži pravidlá, ktoré revízia sady nemení.
import cardsJson from "./data/cards-v6.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { ClientState, ElderState, GameState, MarkerPos } from "../src/index.ts";
import { apply, spakyTeraz, loadGameData, nahladPosunuMarkera, nahladPosunuPrebytkom, posunMarker, setupGame, viewFor } from "../src/index.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

function vPrebytku(seed: number, zostava: number): GameState {
  const s0 = setupGame(data, seed);
  const stred = (e: ElderState, i: number): ElderState => ({ ...e, marker: ([1, 2, 3, 4, 5, 6, 2, 6] as const)[(i + seed) % 8] as MarkerPos });
  return {
    ...s0,
    faza: "bitka",
    ciel: { typ: "lokalita", lokalita: s0.lokalityVHre.find((k) => k.defId !== "kulturny_dom")! },
    starsi: s0.starsi.map(stred),
    hraci: [s0.hraci[0], { ...s0.hraci[1], cigarety: 2 }],
    bitkaStav: {
      krok: "prebytok",
      caka: 0,
      sums: [{}, {}],
      exekutorHotovy: [true, true],
      pohorsenieZostava: [0, 0],
      exekutor: [0, 0],
      damage: { tuhe: [5, 0], makke: [0, 0], celkove: [5, 0], zvysnaViera: [0, 0], zvysnaPovera: [0, 0] },
      vitaz: 0,
      prebytokDrzi: 0,
      prebytokZostava: zostava,
      prebytokPosunute: [],
      pohrebHotovy: [true, true],
      benzinkaZostava: [0, 0],

      karHotovy: [true, true],
      spalit: [],
      vesticaHotova: true,
    },
  } as GameState;
}

describe("náhľad posunu prebytkom (v6)", () => {
  it("posun k porazenému pridá držiteľovi v odhade vždy jednu zónu × výplaty, ktoré ešte prídu", () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const s = vPrebytku(seed, 2);
      const v = viewFor(data, s, 0);
      const vyplat = spakyTeraz(v).vyplat;
      // Bitka je po výsledku: ostávajú výplaty ďalších bitiek (lokality + finále).
      expect(vyplat).toBe(s.lokalityVHre.length + 1);
      for (const e of v.starsi) {
        const n = nahladPosunuPrebytkom(data, v, e.elderId);
        if (n === null) {
          expect(posunMarker(e, 1)).toBeNull();
          continue;
        }
        const marker = posunMarker(e, 1)!;
        expect(n.odhad).toEqual(spakyTeraz({ ...v, starsi: v.starsi.map((x) => (x.elderId === e.elderId ? { ...x, marker } : x)) }).odhad);
        expect(n.zmena[0] - n.zmena[1]).toBe(vyplat);
        expect(n).toEqual(nahladPosunuMarkera(data, v, e.elderId, 1));
      }
      const elderId = v.starsi.find((e) => posunMarker(e, 1) !== null)!.elderId;
      const po = viewFor(data, apply(data, s, { type: "prebytok", elderId }, 0).state, 0);
      expect(po.bitkaStav?.prebytokPosunute).toEqual([elderId]);
    }
  });
});

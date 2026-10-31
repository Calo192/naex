// Náhľad posunu prebytkom (UX/UI 2026-10-22): web a konzolový klient agentov
// volajú ten istý nahladPosunuPrebytkom. V6 ukazuje odhad špakov (spakyTeraz).

import { describe, expect, it } from "vitest";
// Sada v6 (pred revíziou v7): test stráži pravidlá, ktoré revízia sady nemení.
import cardsJson from "./data/cards-v6.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { ElderState, GameState, MarkerPos } from "../src/index.ts";
import { STUPNICA_ZONY, apply, spakyTeraz, loadGameData, nahladPosunuMarkera, nahladPosunuPrebytkom, posunZaBody, setupGame, viewFor } from "../src/index.ts";

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
      // v8: prebytok víťaza rozdeľuje porazený.
      caka: 1,
      sums: [{}, {}],
      exekutorHotovy: [true, true],
      pohorsenieZostava: [0, 0],
      exekutor: [0, 0],
      damage: { tuhe: [5, 0], makke: [0, 0], celkove: [5, 0], zvysnaViera: [0, 0], zvysnaPovera: [0, 0] },
      vitaz: 0,
      prebytokDrzi: 0,
      prebytokZostava: zostava,
      prebytokPosunute: [],
      spalit: [],
      vesticaHotova: true,
    },
  } as GameState;
}

describe("náhľad posunu Nakladačkou (v8)", () => {
  it("posun k porazenému pohne rozdielom odhadov o jeden stupeň (čaká na udržanie, v8.3), kým ešte príde ďalší koniec kola; zvyšok 2 stačí len na lacné pole (v8.2)", () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const s = vPrebytku(seed, 2);
      const v = viewFor(data, s, 1);
      const vyplat = spakyTeraz(v).vyplat;
      // Koniec tohto kola a ďalších bitiek (v8.3; testovacia sada v6 finále nemá).
      expect(vyplat).toBe(s.lokalityVHre.length + 1);
      for (const e of v.starsi) {
        const n = nahladPosunuPrebytkom(data, v, e.elderId);
        const posun = posunZaBody(e, 1, 2);
        if (n === null) {
          expect(posun).toBeNull();
          continue;
        }
        expect(posun?.kroky).toBe(1);
        const marker = posun!.marker;
        expect(n.odhad).toEqual(spakyTeraz({ ...v, starsi: v.starsi.map((x) => (x.elderId === e.elderId ? { ...x, marker } : x)) }).odhad);
        // Nič nie je držané ani zaplatené: rozdiel sa pohne o stupeň poľa ďalej od stredu.
        expect(n.zmena[0] - n.zmena[1]).toBe(STUPNICA_ZONY[e.marker >= 3 ? marker : e.marker]);
        expect(n).toEqual(nahladPosunuMarkera(data, v, e.elderId, 1, 2));
      }
      // Väčší prebytok, aby po prvom posune ešte ostal na ďalší (inak bitka ide ďalej).
      const velky = vPrebytku(seed, 9);
      const elderId = velky.starsi.find((e) => posunZaBody(e, 1, 9) !== null)!.elderId;
      expect(() => apply(data, velky, { type: "prebytok", elderId }, 0)).toThrow();
      const po = viewFor(data, apply(data, velky, { type: "prebytok", elderId }, 1).state, 1);
      expect(po.bitkaStav?.prebytokPosunute).toEqual([elderId]);
    }
  });
});

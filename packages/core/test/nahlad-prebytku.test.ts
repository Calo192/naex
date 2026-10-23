// Náhľad posunu prebytkom (UX/UI 2026-10-22): web a konzolový klient agentov
// ukazovali rôzne čísla — konzola zmenu aj súčet („0 (→ −2)“), web len zmenu —
// a ani jeden neratal cigaretu, ktorú porazený dostane za prvý posun staršieho
// (§8.4), hoci cigarety bodujú. Obaja teraz volajú nahladPosunuPrebytkom.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { ClientState, ElderState, GameState, MarkerPos } from "../src/index.ts";
import { apply, bodyTeraz, loadGameData, nahladPosunuMarkera, nahladPosunuPrebytkom, posunMarker, setupGame, viewFor } from "../src/index.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

function vPrebytku(seed: number, zostava: number): GameState {
  const s0 = setupGame(data, seed);
  // Rôzne pozície markerov — v neutráli by podmienky (aj cigarety) nebodovali.
  const stred = (e: ElderState, i: number): ElderState => ({ ...e, marker: ([1, 2, 3, 5, 6, 7, 2, 6] as const)[(i + seed) % 8] as MarkerPos, markerZaciatokKola: 4 });
  return {
    ...s0,
    faza: "bitka",
    ciel: { typ: "lokalita", lokalita: s0.lokalityVHre[0]! },
    starsi: s0.starsi.map(stred),
    hraci: [s0.hraci[0], { ...s0.hraci[1], cigarety: 2 }],
    bitkaStav: {
      krok: "prebytok",
      caka: 0,
      sums: [{}, {}],
      exekutorHotovy: [true, true],
      pohorsenieZostava: [0, 0],
      pohorsenieHranice: {},
      damage: { tuhe: [5, 0], makke: [0, 0], celkove: [5, 0], zvysnaViera: [0, 0], zvysnaPovera: [0, 0] },
      vitaz: 0,
      prebytokDrzi: 0,
      prebytokZostava: zostava,
      prebytokPosunute: [],
      pohrebHotovy: [true, true],
      benzinkaZostava: [0, 0],
      spalit: [],
      vesticaHotova: true,
    },
  } as GameState;
}

/** Body po posune markera a s `cigarety` navyše pre porazeného (hráč 1). */
function bodyPo(v: ClientState, elderId: string, cigarety: number): readonly [number, number] {
  const e = v.starsi.find((x) => x.elderId === elderId)!;
  const marker = posunMarker(e, 1, false)!;
  const hraci = [v.hraci[0], { ...v.hraci[1], cigarety: v.hraci[1].cigarety + cigarety }] as ClientState["hraci"];
  return bodyTeraz(data, { ...v, hraci, starsi: v.starsi.map((x) => (x.elderId === elderId ? { ...x, marker } : x)) }).spolu;
}

describe("náhľad posunu prebytkom", () => {
  it("prvý posun staršieho ráta aj cigaretu porazenému, ďalší posun toho istého už nie", () => {
    let cigaretaHrala = 0;
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const s = vPrebytku(seed, 2);
      const v = viewFor(data, s, 0);
      expect(v.bitkaStav?.prebytokPosunute).toEqual([]);
      for (const e of v.starsi) {
        const n = nahladPosunuPrebytkom(data, v, e.elderId);
        if (n === null) continue;
        expect(n.body).toEqual(bodyPo(v, e.elderId, 1));
        if (n.zmena[1] !== nahladPosunuMarkera(data, v, e.elderId, 1, false)!.zmena[1]) cigaretaHrala++;
      }
      // Po prvom posune je starší v prebytokPosunute — ďalší posun cigaretu nepridá.
      const elderId = v.starsi.find((e) => posunMarker(e, 1, false) !== null)!.elderId;
      const po = viewFor(data, apply(data, s, { type: "prebytok", elderId }, 0).state, 0);
      expect(po.bitkaStav?.prebytokPosunute).toEqual([elderId]);
      expect(nahladPosunuPrebytkom(data, po, elderId)).toEqual(nahladPosunuMarkera(data, po, elderId, 1, false));
    }
    // Aspoň niekde cigareta body naozaj zmenila — inak by test nič neoveril.
    expect(cigaretaHrala).toBeGreaterThan(0);
  });
});

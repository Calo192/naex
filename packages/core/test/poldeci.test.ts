// Zmeny Michala 2026-10-16 po playteste 20261016-155120 („poldeci špirála“), od v12.2 (Michal 2026-11-11):
// A1 — na začiatku kola sa už nedolieva (poldeci sa obnovia v bitke, pravidla-v12-2.test.ts),
// E1 — limit vykladania = plné poldeci, v ďalšom kole maximum.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { BitkaStav, CardInstance, GameState, PlacedCard, PlayerId } from "../src/index.ts";
import { KONSTANTY, apply, limitBuduceKolo, limitZhromazdenia, loadGameData, setupGame, viewFor } from "../src/index.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

let uidSeq = 95000;
const inst = (defId: string): CardInstance => ({ uid: ++uidSeq, defId, leftLayout: 0, rightLayout: 0 });
const lezi = (card: CardInstance, playedBy: PlayerId, naexBy?: PlayerId): PlacedCard =>
  naexBy === undefined ? { card, playedBy } : { card, playedBy, naexBy };

function bitka(b: Partial<BitkaStav>): BitkaStav {
  return {
    krok: null,
    caka: null,
    sums: [{}, {}],
    exekutorHotovy: [true, true],
   
    exekutor: [0, 0],
    damage: null,
    vitaz: 0,
    prebytokDrzi: null,
    prebytokZostava: 0,
    prebytokZdvihy: [], prebytokPrepadlo: 0,
    spalit: [],
    vesticaHotova: true,
    ...b,
  };
}

/** Stav pri Cintoríne na konci bitky — „nič“ posunie hru do ďalšieho kola. */
function koniecBitky(poldeci: readonly [readonly [number, number], readonly [number, number]]): { s: GameState; ruka: CardInstance[] } {
  const s0 = setupGame(data, 21);
  const ruka = Array.from({ length: 8 }, () => inst("pijan"));
  const s: GameState = {
    ...s0,
    faza: "bitka",
    strany: [[], []],
    hraci: [
      { ...s0.hraci[0], ruka, poldeciPlne: poldeci[0][0], poldeciVypite: poldeci[0][1] },
      // 7 štartoviek (Michal 2026-10-22): doberací doplnený na 5, aby balíček neklesol pod 5.
      { ...s0.hraci[1], ruka: [], doberaci: [...s0.hraci[1].doberaci, inst("pijan"), inst("pijan"), inst("pijan")], poldeciPlne: poldeci[1][0], poldeciVypite: poldeci[1][1] },
    ],
    ciel: { typ: "lokalita", lokalita: s0.lokalityVHre[0]! },
    lokalityVHre: s0.lokalityVHre.slice(1),
    bitkaStav: bitka({ krok: "cintorin", caka: 0 }),
  };
  return { s, ruka };
}

describe("A1: začiatok kola už nedolieva (v12.2)", () => {
  it("po Cintoríne (za krokom poldeci v bitke) sa na začiatku kola nič neotočí", () => {
    const { s } = koniecBitky([[0, 2], [2, 0]]);
    const r = apply(data, s, { type: "cintorin", uid: null }, 0);
    expect(r.state.kolo).toBe(s.kolo + 1);
    expect([r.state.hraci[0].poldeciPlne, r.state.hraci[0].poldeciVypite]).toEqual([0, 2]);
    expect([r.state.hraci[1].poldeciPlne, r.state.hraci[1].poldeciVypite]).toEqual([2, 0]);
    expect(r.events.some((e) => e.type === "zmenaPoldeci")).toBe(false);
  });
});

describe("E1: limit vykladania pred a po ťahu", () => {
  it("limitZhromazdenia = plné (v12.2; NA EX na stole sa neráta), zmena plných ho posunie", () => {
    const s0 = setupGame(data, 22);
    const s: GameState = {
      ...s0,
      strany: [[lezi(inst("pijan"), 0, 0)], []],
      hraci: [{ ...s0.hraci[0], poldeciPlne: 1, poldeciVypite: 0 }, s0.hraci[1]],
    };
    expect(limitZhromazdenia(s, 0)).toBe(1);
    expect(limitZhromazdenia(s, 0, -1)).toBe(0);
    // Plné poldeci nejdú pod nulu.
    expect(limitZhromazdenia(s, 0, -5)).toBe(0);
  });

  it("Zastávka limit nemení (v9.1); Vínko v Dedičstve ho samo nemení — pridá plný poldeci pri vyložení (v12.2)", () => {
    const s0 = setupGame(data, 23);
    const zastavka: GameState = { ...s0, ciel: { typ: "lokalita", lokalita: inst("zastavka") } };
    const jeden = KONSTANTY.START_POLDECI;
    expect(limitZhromazdenia(zastavka, 0)).toBe(jeden);
    expect(limitZhromazdenia(zastavka, 0, -1)).toBe(jeden - 1);
    const vinko: GameState = { ...s0, hraci: [{ ...s0.hraci[0], dedicstvo: [inst("vinko")] }, s0.hraci[1]] };
    expect(limitZhromazdenia(vinko, 0)).toBe(KONSTANTY.START_POLDECI);
  });

  it("limitBuduceKolo: po bitke sa obnoví maximum — plné, vypité aj poldeci na stole (v12.2)", () => {
    const s0 = setupGame(data, 24);
    const s: GameState = { ...s0, hraci: [{ ...s0.hraci[0], poldeciPlne: 1, poldeciVypite: 1 }, s0.hraci[1]] };
    expect(limitBuduceKolo(s, 0)).toBe(2);
    // NA EX maximum nemení — poldeci sa v bitke vypije a obnoví ako ostatné.
    expect(limitBuduceKolo(s, 0, true)).toBe(2);
    const naStole: GameState = { ...s, strany: [[lezi(inst("pijan"), 0, 0)], []], hraci: [{ ...s.hraci[0], poldeciVypite: 0 }, s.hraci[1]] };
    expect(limitBuduceKolo(naStole, 0)).toBe(2);
  });

  it("pohľad klienta dáva rovnaké limity ako stav servera", () => {
    const s0 = setupGame(data, 25);
    const s: GameState = {
      ...s0,
      strany: [[lezi(inst("pijan"), 0, 0)], [lezi(inst("pijan"), 1)]],
      hraci: [{ ...s0.hraci[0], poldeciPlne: 1, poldeciVypite: 0 }, { ...s0.hraci[1], poldeciPlne: 0, poldeciVypite: 2 }],
    };
    for (const pozorovatel of [0, 1] as const) {
      const v = viewFor(data, s, pozorovatel);
      for (const p of [0, 1] as const) {
        expect(limitZhromazdenia(v, p)).toBe(limitZhromazdenia(s, p));
        expect(limitBuduceKolo(v, p, true)).toBe(limitBuduceKolo(s, p, true));
      }
    }
  });
});

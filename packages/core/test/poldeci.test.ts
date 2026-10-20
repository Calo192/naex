// Zmeny Michala 2026-10-16 po playteste 20261016-155120 („poldeci špirála“):
// A1 — na začiatku kola sa jeden vypitý poldeci doleje sám,
// E1 — limit vykladania pred a po ťahu (draft, Vypiť, NA EX).

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
    pohorsenieZostava: [0, 0],
    pohnuteMarkery: [],
    damage: null,
    vitaz: 0,
    prebytokDrzi: null,
    prebytokZostava: 0,
    prebytokPosunute: [],
    liecbaHotova: [true, true],
    benzinkaZostava: [0, 0],
    lokalitaPrepadne: false,
    spalit: [],
    vesticaHotova: true,
    ...b,
  };
}

/** Stav pri Liečbe na konci bitky — skipLiecba posunie hru do ďalšieho kola. */
function koniecBitky(poldeci: readonly [readonly [number, number], readonly [number, number]]): { s: GameState; ruka: CardInstance[] } {
  const s0 = setupGame(data, 21);
  const ruka = Array.from({ length: 8 }, () => inst("pijan"));
  const s: GameState = {
    ...s0,
    faza: "bitka",
    strany: [[], []],
    hraci: [
      { ...s0.hraci[0], ruka, poldeciPlne: poldeci[0][0], poldeciVypite: poldeci[0][1] },
      { ...s0.hraci[1], ruka: [], poldeciPlne: poldeci[1][0], poldeciVypite: poldeci[1][1] },
    ],
    ciel: { typ: "lokalita", lokalita: s0.lokalityVHre[0]!, elderId: null },
    lokalityVHre: s0.lokalityVHre.slice(1),
    bitkaStav: bitka({ krok: "liecba", caka: 0, liecbaHotova: [false, true] }),
  };
  return { s, ruka };
}

describe("A1: nové kolo, jeden poldeci späť", () => {
  it("na začiatku kola sa každému doleje najviac POLDECI_NA_ZACIATKU_KOLA vypitých", () => {
    expect(KONSTANTY.POLDECI_NA_ZACIATKU_KOLA).toBe(1);
    const { s } = koniecBitky([[0, 2], [2, 0]]);
    const r = apply(data, s, { type: "skipLiecba" }, 0);
    expect(r.state.kolo).toBe(s.kolo + 1);
    // Hráč 1 mal oba vypité → jeden plný. Hráč 2 nemal čo doliať.
    expect([r.state.hraci[0].poldeciPlne, r.state.hraci[0].poldeciVypite]).toEqual([1, 1]);
    expect([r.state.hraci[1].poldeciPlne, r.state.hraci[1].poldeciVypite]).toEqual([2, 0]);
    expect(r.events).toContainEqual({ type: "log", text: "Hráč 1 si na začiatku kola dolieva 1 poldeci." });
    expect(r.events.some((e) => e.type === "log" && e.text.startsWith("Hráč 2 si na začiatku kola"))).toBe(false);
  });

  it("dolieva sa len vypitý poldeci — nový z ničoho nevznikne", () => {
    const { s } = koniecBitky([[1, 1], [0, 0]]);
    // Hráč 2 má 0 plných a 0 vypitých (napr. po strate poldeci) — nič nedostane.
    const r = apply(data, s, { type: "skipLiecba" }, 0);
    expect([r.state.hraci[0].poldeciPlne, r.state.hraci[0].poldeciVypite]).toEqual([2, 0]);
    expect([r.state.hraci[1].poldeciPlne, r.state.hraci[1].poldeciVypite]).toEqual([0, 0]);
  });
});

describe("E1: limit vykladania pred a po ťahu", () => {
  it("limitZhromazdenia = plné + NA EX na stole + 1, karta zo šenku ho zníži", () => {
    const s0 = setupGame(data, 22);
    const s: GameState = {
      ...s0,
      strany: [[lezi(inst("pijan"), 0, 0)], []],
      hraci: [{ ...s0.hraci[0], poldeciPlne: 1, poldeciVypite: 0 }, s0.hraci[1]],
    };
    expect(limitZhromazdenia(s, 0)).toBe(3);
    expect(limitZhromazdenia(s, 0, -1)).toBe(2);
    // Plné poldeci nejdú pod nulu.
    expect(limitZhromazdenia(s, 0, -5)).toBe(2);
  });

  it("Zastávka: spoločný limit = súčet limitov oboch; Vínko v Dedičstve pridá 1", () => {
    const s0 = setupGame(data, 23);
    const zastavka: GameState = { ...s0, ciel: { typ: "lokalita", lokalita: inst("zastavka"), elderId: null } };
    const jeden = KONSTANTY.START_POLDECI + 1;
    expect(limitZhromazdenia(zastavka, 0)).toBe(2 * jeden);
    expect(limitZhromazdenia(zastavka, 0, -1)).toBe(2 * jeden - 1);
    const vinko: GameState = { ...s0, hraci: [{ ...s0.hraci[0], dedicstvo: [inst("vinko")] }, s0.hraci[1]] };
    expect(limitZhromazdenia(vinko, 0)).toBe(KONSTANTY.START_POLDECI + 2);
  });

  it("limitBuduceKolo: NA EX sa vypije, na začiatku kola sa jeden doleje", () => {
    const s0 = setupGame(data, 24);
    const s: GameState = { ...s0, hraci: [{ ...s0.hraci[0], poldeciPlne: 1, poldeciVypite: 1 }, s0.hraci[1]] };
    // Bez NA EX: 1 plný + 1 dolietý + 1.
    expect(limitBuduceKolo(s, 0)).toBe(3);
    // S NA EX: plný ide na stôl a vypije sa; doleje sa len jeden.
    expect(limitBuduceKolo(s, 0, true)).toBe(2);
    // Poldeci už ležiaci na stole sa vypije tiež.
    const naStole: GameState = { ...s, strany: [[lezi(inst("pijan"), 0, 0)], []], hraci: [{ ...s.hraci[0], poldeciVypite: 0 }, s.hraci[1]] };
    expect(limitBuduceKolo(naStole, 0)).toBe(3);
    expect(limitBuduceKolo(naStole, 0, true)).toBe(2);
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

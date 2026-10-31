// Pravidlá v8.2 (Michal 2026-10-30, z jeho partie a výučby): akcia Dlh sa volá
// Hazard, Dlh a Absťák sú počítadlá (nie karty) a posun markera Pohoršením
// a prebytkom stojí podľa zóny (PRAVIDLA §8, §9.2, §9.4, §10, §11).

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { BitkaStav, Command, GameState, MarkerPos } from "../src/index.ts";
import { apply, cenaKroku, cenaPosunuOPoli, legalCommands, loadGameData, naTahu, posunZaBody, rngInt, rngSeed, setupGame, viewFor } from "../src/index.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

describe("§10 cena posunu markera (v8.2)", () => {
  it("von zo stredu podľa cieľovej zóny 1 / 2 / 3, k stredu o 1 viac 4 / 3 / 2 — na oboch polovicach rovnako", () => {
    expect([cenaKroku(3, 4), cenaKroku(4, 5), cenaKroku(5, 6)]).toEqual([1, 2, 3]);
    expect([cenaKroku(6, 5), cenaKroku(5, 4), cenaKroku(4, 3)]).toEqual([4, 3, 2]);
    expect([cenaKroku(3, 2), cenaKroku(2, 1), cenaKroku(1, 0)]).toEqual([1, 2, 3]);
    expect([cenaKroku(0, 1), cenaKroku(1, 2), cenaKroku(2, 3)]).toEqual([4, 3, 2]);
    expect(cenaPosunuOPoli(3, 3)).toBe(6);
    expect(cenaPosunuOPoli(6, -3)).toBe(9);
    // Cez stred: oranžová hráča 1 → oranžová hráča 0 = 3 + 2 + 1 + 2.
    expect(cenaPosunuOPoli(5, -4)).toBe(8);
  });

  it("posunZaBody: marker ide, kým zvyšok stačí na ďalšie pole, a vráti cenu; bez jediného poľa null", () => {
    const zo = (marker: MarkerPos) => ({ marker });
    expect(posunZaBody(zo(3), 1, 6)).toEqual({ marker: 6, cena: 6, kroky: 3 });
    expect(posunZaBody(zo(3), 1, 5)).toEqual({ marker: 5, cena: 3, kroky: 2 });
    expect(posunZaBody(zo(3), 1, 1)).toEqual({ marker: 4, cena: 1, kroky: 1 });
    expect(posunZaBody(zo(5), 0, 2)).toBeNull();
    expect(posunZaBody(zo(6), 1, 10)).toBeNull();
  });
});

describe("§9.2 Pohoršenia, ktoré na žiadny posun nestačia, prepadnú (v8.2)", () => {
  function bitka(b: Partial<BitkaStav>): BitkaStav {
    return {
      krok: "pohorsenie",
      caka: 0,
      sums: [{}, {}],
      exekutorHotovy: [true, true],
      pohorsenieZostava: [0, 0],
      exekutor: [0, 0],
      damage: null,
      vitaz: null,
      prebytokDrzi: null,
      prebytokZostava: 0,
      prebytokPosunute: [],
      spalit: [],
      vesticaHotova: true,
      ...b,
    };
  }

  it("zvyšok 1 pri markeroch mimo stredu prepadne a log to povie", () => {
    const s0 = setupGame(data, 21);
    // Hráč 0 posunie jediného staršieho v strede (1 bod) — ďalšie pole stojí 2, zvyšok 1 nevyjde nikde.
    const s: GameState = {
      ...s0,
      faza: "bitka",
      kolo: 2,
      utocnik: 1,
      strany: [[], []],
      ciel: { typ: "lokalita", lokalita: s0.lokalityVHre[0]! },
      lokalityVHre: s0.lokalityVHre.slice(1),
      starsi: s0.starsi.map((e, i) => ({ ...e, marker: (i === 0 ? 3 : i % 2 === 0 ? 1 : 5) as MarkerPos })),
      bitkaStav: bitka({ pohorsenieZostava: [2, 0] }),
    };
    const { state, events } = apply(data, s, { type: "pohorsenie", elderId: s.starsi[0]!.elderId }, 0);
    expect(state.starsi[0]!.marker).toBe(4);
    expect(events.some((e) => e.type === "log" && e.text.includes("stráca 1 Pohoršenie"))).toBe(true);
  });
});

describe("§11 Dlh je počítadlo — jadro sa na kartu dlh nespolieha (v8.2); Absťák je od v9.1 karta", () => {
  // Admin kartu Dlh zo sady vyradil; hra musí bežať aj bez nej — aj bez karty Absťák (staršia sada).
  const bez = { ...cardsJson, cards: cardsJson.cards.filter((c) => c.id !== "dlh" && c.id !== "abstak") };
  const sada = loadGameData(bez, eldersJson, scorecardsJson);

  it("náhodné partie dobehnú, Dlhy pribúdajú len do počítadla; sada bez karty Absťák ho nedáva", () => {
    let dlhy = 0;
    let abstaky = 0;
    for (const seed of [1, 2, 3, 4]) {
      let st: GameState = setupGame(sada, seed);
      let rng = rngSeed(seed ^ 0x82);
      for (let i = 0; st.koniec === null && i < 20000; i++) {
        const p = naTahu(st);
        if (p === null) break;
        const cmds = legalCommands(sada, st, p);
        const [j, r] = rngInt(rng, cmds.length);
        rng = r;
        st = apply(sada, st, cmds[j] as Command, p).state;
        for (const h of st.hraci) {
          const karty = [...h.ruka, ...h.doberaci, ...h.odhadzovaci, ...h.priznane, ...st.strany.flat().map((pl) => pl.card)];
          expect(karty.some((k) => k.defId === "dlh" || k.defId === "abstak")).toBe(false);
        }
      }
      expect(st.koniec).not.toBeNull();
      dlhy += (st.hraci[0].dlhyZiskane ?? 0) + (st.hraci[1].dlhyZiskane ?? 0);
      abstaky += (st.hraci[0].abstakyZiskane ?? 0) + (st.hraci[1].abstakyZiskane ?? 0);
    }
    expect(dlhy).toBeGreaterThan(0);
    expect(abstaky).toBe(0);
  });

  it("Dlhy a počet Absťákov sú verejné — viewFor ich posiela obom hráčom", () => {
    const s0 = setupGame(sada, 9);
    const abstak = (uid: number) => ({ uid, defId: "abstak", leftLayout: 0, rightLayout: 0 });
    const s: GameState = { ...s0, hraci: [{ ...s0.hraci[0], dlhy: 3, doberaci: [...s0.hraci[0].doberaci, abstak(990101)], ruka: [...s0.hraci[0].ruka, abstak(990102)] }, s0.hraci[1]] };
    for (const ja of [0, 1] as const) {
      expect(viewFor(sada, s, ja).hraci[0]).toMatchObject({ dlhy: 3, abstaky: 2 });
    }
  });
});

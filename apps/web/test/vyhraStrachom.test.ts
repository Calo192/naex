// Výhra strachom na stole (Michal 2026-11-10, finále na Poľovníckej chate): hráč s 24 Dlhmi vyhral
// bitku so 3 staršími na červenom strachu a 1 väzňom — hra skončila výhrou strachom (4c) pred
// exekúciou (4d). Stôl to musí povedať a „4/4“ musí sedieť so stĺpčekmi (väzeň zvlášť).

import { describe, expect, it } from "vitest";
import cardsJson from "../../../packages/core/data/cards.json";
import eldersJson from "../../../packages/core/data/elders.json";
import scorecardsJson from "../../../packages/core/data/scorecards.json";
import type { BitkaStav, ElderState, GameState, Vazen } from "@naex/core";
import { apply, loadGameData, setupGame, spakyTeraz, viewFor } from "@naex/core";
import { hroziVyhraStrachom, textCervenych, textVyhryStrachom, vyhraStrachomBitky } from "../src/hra/vyhraStrachom.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

/** Bitka 4. kola pred poškodením: hráč 0 má `cervenych` starších na červenom strachu, 1 väzňa a 24 Dlhov. */
function predBitkou(cervenych: number): GameState {
  const s0 = setupGame(data, 11, { lokalit: 5 });
  const vazni: Vazen[] = [];
  const starsi: ElderState[] = [];
  s0.starsi.forEach((e, i) => {
    if (i === 0) vazni.push({ elderId: e.elderId, hrac: 0, poradie: 1, karta: e.karta, scorecard: e.scorecard, miesto: i });
    else starsi.push(i <= cervenych ? { ...e, strach: [3, 0] } : e);
  });
  // Priazeň starších, ktorí sa boja hráča 0, má súper (aj Bitkára) — tuhé s rezervou.
  const sums: BitkaStav["sums"] = [{ Rana: 30 }, {}];
  const bitkaStav: BitkaStav = {
    krok: "hadka",
    caka: null,
    sums,
    exekutorHotovy: [false, false],
    exekutor: [0, 0],
    hadka: { makke: [0, 0], vitaz: null, velkost: 0, zostava: 0, prepadlo: 0, zdvihy: [] },
    damage: null,
    vitaz: null,
    prebytokDrzi: null,
    prebytokZostava: 0,
    prebytokZdvihy: [],
    prebytokPrepadlo: 0,
    spalit: [],
    vesticaHotova: true,
  };
  return {
    ...s0,
    faza: "bitka",
    draftStav: null,
    kolo: 4,
    utocnik: 1,
    strany: [[], []],
    ciel: { typ: "lokalita", lokalita: s0.lokalityVHre[0]! },
    starsi,
    vazni,
    spaky: [20, 20],
    hraci: [{ ...s0.hraci[0], dlhy: 24 }, s0.hraci[1]],
    bitkaStav,
  };
}

/** Spustí bitku tak ako koniec Pitky (krok Hasiča pred bitkou). */
function bitka(s: GameState): GameState {
  return apply(data, { ...s, hasicVolby: [{ hrac: 0, uid: -1, potom: "bitka" }] }, { type: "hasic", nechat: false }, 0).state;
}

describe("výhra strachom na stole", () => {
  it("červené s väzňom: súčet sedí so stĺpčekmi, väzeň je menovaný zvlášť", () => {
    expect(textCervenych(4, 1, 4).kratko).toBe("3 + 1 väzeň = 4/4");
    expect(textCervenych(4, 2, 4).kratko).toBe("2 + 2 väzni = 4/4");
    expect(textCervenych(3, 0, 4).kratko).toBe("3/4");
    expect([textCervenych(4, 1, 4).odznak, textCervenych(3, 0, 4).odznak]).toEqual(["3+1/4", "3/4"]);
    expect(textCervenych(4, 1, 4).titul).toMatch(/3 starší na červenom strachu a 1 väzeň/);
  });

  it("4 červené (3 + väzeň) a víťaz bitky: hra skončí pred exekúciou, súhrn to povie, Dlhy aj špaky ostanú", () => {
    const s = predBitkou(3);
    const pred = viewFor(data, s, 0);
    expect(hroziVyhraStrachom(pred.vyhry)).toBe(true);
    const t = bitka(s);
    expect(t.koniec).toMatchObject({ vitaz: 0, body: null });
    expect(t.hraci[0].dlhy).toBe(24);
    const z = t.nastenka.at(-1)!;
    expect(z.exekutor).toEqual([0, 0]);
    // Náhľad „po výhre +N“ pred bitkou = skutočné špaky za starších, keď sa markery medzitým nepohli.
    expect(z.zaStarsich[0]).toBe(spakyTeraz(pred).zaStarsichVyhra[0]);
    const v = vyhraStrachomBitky(viewFor(data, t, 0), 4);
    expect(v).toEqual({ hrac: 0, cervene: 4, vazni: 1, bezExekucie: true });
    expect(textVyhryStrachom(v!)).toBe("Výhra strachom (4 červené, z toho 1 väzeň) — exekúcia sa nekonala, Dlhy ani špaky nezhoreli.");
    // Súper vidí to isté (verejné).
    expect(vyhraStrachomBitky(viewFor(data, t, 1), 4)).toEqual(v);
  });

  it("3 červené (2 + väzeň): hra pokračuje, exekúcia prebehne a súhrn o výhre strachom mlčí", () => {
    const s = predBitkou(2);
    expect(hroziVyhraStrachom(viewFor(data, s, 0).vyhry)).toBe(false);
    const t = bitka(s);
    expect(t.koniec).toBeNull();
    expect(t.nastenka.at(-1)!.exekutor[0]).toBeGreaterThan(0);
    expect(vyhraStrachomBitky(viewFor(data, t, 0), 4)).toBeNull();
  });
});

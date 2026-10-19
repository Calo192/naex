// „Ešte jednu!“ a remíza (Michal 2026-10-19, playtest 20261018-185541):
// bitka má jednu Pitku, prehrávajúci smie vypiť poldeci a objednať ďalšiu
// rundu (najviac 2); remíza o staršieho nechá staršieho na mieste.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { CardDef, GameData, GameState, PlayerId } from "../src/index.ts";
import { KONSTANTY, apply, buildGameData, legalCommands, loadGameData, naTahu, parseScorecards, prehravaBitku, setupGame } from "../src/index.ts";
import { instanceFor, makeDef } from "./helpers.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

function sadaS(...defs: CardDef[]): GameData {
  const cards = new Map(data.cards);
  for (const d of defs) cards.set(d.id, d);
  return buildGameData(cards, data.elders, parseScorecards(scorecardsJson));
}

// Hráč 0 má pri lokalite aktívnu Ranu — hráč 1 prehráva.
const lok = makeDef("lok_runda", [null, "Cigaretka", null, null], [null, null, null, null], { tags: ["Lokalita"] });
const bitkar = makeDef("bitkar_runda", [null, null, null, null], [null, "Rana", null, null]);
const sada = sadaS(lok, bitkar);

function poslednaPitka(poldeci1: number): GameState {
  const s0 = setupGame(sada, 5);
  return {
    ...s0,
    faza: "pitka",
    utocnik: 0,
    ciel: { typ: "lokalita", lokalita: instanceFor(sada, "lok_runda", [null, "Cigaretka", null, null], [null, null, null, null]), elderId: null },
    lokalitaOtocena: false,
    pitkyCelkom: 1,
    pitkaCislo: 1,
    strany: [[{ card: instanceFor(sada, "bitkar_runda", [null, null, null, null], [null, "Rana", null, null]), playedBy: 0 }], []],
    hraci: [s0.hraci[0], { ...s0.hraci[1], poldeciPlne: poldeci1, poldeciVypite: 2 - poldeci1 }],
    pitkaStav: { naTahu: 1, hotovy: [false, false], naexPouzity: [false, false], fajcenie: [0, 0], reakcia: null, postarka: [false, false], starosta: [false, false] },
  } as GameState;
}

/** Obaja ukončia Pitku bez NA EX. */
function dohrajPitku(s: GameState): GameState {
  let st = s;
  for (let i = 0; i < 4 && st.faza === "pitka" && st.ponukaRundy === null; i++) st = apply(sada, st, { type: "skipNaex" }, naTahu(st)!).state;
  return st;
}

function dohrajZhromazdenie(s: GameState): GameState {
  let st = s;
  for (let i = 0; i < 4 && st.faza === "zhromazdenie"; i++) st = apply(sada, st, { type: "pass" }, naTahu(st)!).state;
  return st;
}

describe("Ešte jednu!", () => {
  it("prehrávajúci s plným poldeci dostane ponuku rundy", () => {
    const s = dohrajPitku(poslednaPitka(1));
    expect(prehravaBitku(sada, s)).toBe(1);
    expect(s.faza).toBe("pitka");
    expect(s.ponukaRundy).toBe(1);
    expect(naTahu(s)).toBe(1);
    expect(legalCommands(sada, s, 1)).toEqual([{ type: "runda" }, { type: "bezRundy" }]);
    expect(legalCommands(sada, s, 0)).toEqual([]);
  });

  it("runda: poldeci sa vypije, pečeň +1, Zhromaždenie začína ten, kto ju objednal", () => {
    const s = dohrajPitku(poslednaPitka(1));
    const po = apply(sada, s, { type: "runda" }, 1).state;
    expect(po.faza).toBe("zhromazdenie");
    expect(po.zhromazdenieStav?.naTahu).toBe(1);
    expect(po.pitkyCelkom).toBe(2);
    expect([po.hraci[1].poldeciPlne, po.hraci[1].poldeciVypite, po.hraci[1].pecen]).toEqual([0, 2, 1]);
  });

  it("bez rundy sa ide do bitky", () => {
    const s = dohrajPitku(poslednaPitka(1));
    expect(apply(sada, s, { type: "bezRundy" }, 1).state.faza).toBe("bitka");
  });

  it("bez plného poldeci ponuka nie je", () => {
    expect(dohrajPitku(poslednaPitka(0)).faza).toBe("bitka");
  });

  it("najviac 2 rundy navyše", () => {
    let s = poslednaPitka(2);
    // Barter cigarety nemá, poldeci stačí na 2 rundy.
    for (let r = 0; r < KONSTANTY.RUNDY_NAVYSE; r++) {
      s = dohrajPitku(s);
      expect(s.ponukaRundy).toBe(1);
      s = dohrajZhromazdenie(apply(sada, s, { type: "runda" }, 1).state);
    }
    s = dohrajPitku(s);
    expect(s.pitkyCelkom).toBe(1 + KONSTANTY.RUNDY_NAVYSE);
    expect(s.ponukaRundy).toBeNull();
    expect(s.faza).toBe("bitka");
  });
});

describe("remíza o staršieho", () => {
  it("starší ostáva na mieste, prebytok nie je a útočník ostáva útočníkom", () => {
    let s = setupGame(data, 21);
    const elder = s.starsi[0]!;
    s = { ...s, starsi: s.starsi.map((e, i) => (i === 0 ? { ...e, marker: 1, markerZaciatokKola: 1 } : e)) };
    const utocnik: PlayerId = s.utocnik;
    s = apply(data, s, { type: "chooseElder", elderId: elder.elderId, otocena: false }, utocnik).state;
    // Obaja hneď pasujú — prázdna línia, 0 : 0.
    for (let i = 0; i < 40 && s.faza !== "bitka" && s.faza !== "volbaCiela"; i++) {
      const p = naTahu(s)!;
      const typ = s.faza === "zhromazdenie" ? "pass" : s.ponukaRundy !== null ? "bezRundy" : "skipNaex";
      s = apply(data, s, { type: typ } as never, p).state;
    }
    const markeryPred = s.starsi.map((e) => e.marker);
    for (let i = 0; i < 40 && s.faza === "bitka"; i++) {
      const p = naTahu(s);
      if (p === null) break;
      s = apply(data, s, legalCommands(data, s, p)[0]!, p).state;
    }
    expect(s.faza).toBe("volbaCiela");
    const po = s.starsi.find((e) => e.elderId === elder.elderId)!;
    expect(po.nahradeny).toBe(false);
    expect(po.marker).toBe(1);
    expect(s.starsi.map((e) => e.marker)).toEqual(markeryPred);
    expect(s.utocnik).toBe(utocnik);
  });
});

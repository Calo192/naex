// v11.9 (Michal 2026-11-06, docs/napady/agresivna-hra.html): dobratie do 3 kariet v ruke
// a výpalné hneď po bitke, aby cigarety boli pripravené na šenok.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { GameState, PlayerId } from "../src/index.ts";
import { KONSTANTY, apply, cervenychHraca, loadGameData, setupGame } from "../src/index.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

function predKoncomBitky(uprav: (s: GameState) => GameState, vitaz: PlayerId | null = 0, finale = false): GameState {
  const s0 = setupGame(data, 77);
  const zaklad: GameState = {
    ...s0,
    faza: "bitka",
    kolo: 2,
    strany: [[], []],
    ciel: { typ: finale ? "finale" : "lokalita", lokalita: s0.lokalityVHre[0]! },
    lokalityVHre: s0.lokalityVHre.slice(1),
    bitkaStav: {
      krok: "cintorin",
      caka: 0,
      sums: [{}, {}],
      exekutorHotovy: [true, true],
      exekutor: [0, 0],
      damage: null,
      vitaz,
      prebytokDrzi: null,
      prebytokZostava: 0,
      prebytokZdvihy: [],
      prebytokPrepadlo: 0,
      vesticaHotova: true,
      spalit: [],
    } as unknown as GameState["bitkaStav"],
  };
  return uprav(zaklad);
}

function sCigaretami(s: GameState, cigarety: readonly [number, number]): GameState {
  return {
    ...s,
    hraci: [
      { ...s.hraci[0], cigarety: cigarety[0] },
      { ...s.hraci[1], cigarety: cigarety[1] },
    ],
  };
}

/** Prvých `pocet` starších má červený strach hráča p. */
function sCervenymi(s: GameState, p: PlayerId, pocet: number): GameState {
  return {
    ...s,
    starsi: s.starsi.map((e, i) => {
      if (i >= pocet) return e;
      const strach: [number, number] = [e.strach[0], e.strach[1]];
      strach[p] = 3;
      return { ...e, strach };
    }) as GameState["starsi"],
  };
}

const poBitke = (s: GameState): GameState => apply(data, s, { type: "cintorin", uid: null }, s.bitkaStav?.vitaz === 1 ? 1 : 0).state;

function sRukou(s: GameState, p: PlayerId, ruka: number): GameState {
  const h = s.hraci[p];
  const vsetky = [...h.ruka, ...h.doberaci, ...h.odhadzovaci];
  const karty = Array.from({ length: Math.max(8, ruka + 4) }, (_, i) => vsetky[i % vsetky.length]!).map((k, i) => ({ ...k, uid: 90000 + p * 1000 + i }));
  const novy = { ...h, ruka: karty.slice(0, ruka), doberaci: karty.slice(ruka), odhadzovaci: [] };
  return { ...s, hraci: p === 0 ? [novy, s.hraci[1]] : [s.hraci[0], novy] };
}

describe("dobratie do troch (v11.9, §4)", () => {
  it.each([
    [0, 3],
    [1, 3],
    [2, 3],
    [3, 3],
    [7, 7],
  ])("s %i kartami v ruke začne ďalšie kolo s %i", (ruka, cakana) => {
    const po = poBitke(predKoncomBitky((s) => sRukou(s, 0, ruka)));
    expect(po.faza).toBe("volbaCiela");
    expect(po.hraci[0].ruka).toHaveLength(cakana);
  });

  it("z prázdnych balíčkov sa nedoberá a hra beží ďalej", () => {
    const po = poBitke(predKoncomBitky((s) => ({ ...s, hraci: [{ ...s.hraci[0], ruka: [], doberaci: [], odhadzovaci: [] }, s.hraci[1]] })));
    expect(po.faza).toBe("volbaCiela");
    expect(po.hraci[0].ruka).toHaveLength(0);
  });
});

describe("výpalné (v11.9, §10, krok 6c)", () => {
  it("súper platí 1 cigaretu za každú červenú hneď po bitke, pred šenkom ďalšieho kola", () => {
    // Víťaz 0 má 2 červené; súper má 5 cigariet a ako porazený dostane 1.
    const po = poBitke(predKoncomBitky((s) => sCigaretami(sCervenymi(s, 0, 2), [0, 5])));
    expect(po.faza).toBe("volbaCiela");
    expect(po.hraci[0].cigarety).toBe(2 * KONSTANTY.VYPALNE_ZA_CERVENU);
    expect(po.hraci[1].cigarety).toBe(5 + KONSTANTY.CIGARETY_PORAZENEMU - 2);
  });

  it("súper dá len toľko, koľko má; cigareta porazenému sa ráta a nič nedlhuje", () => {
    const po = poBitke(predKoncomBitky((s) => sCigaretami(sCervenymi(s, 0, 3), [0, 0])));
    expect(po.hraci[0].cigarety).toBe(KONSTANTY.CIGARETY_PORAZENEMU);
    expect(po.hraci[1].cigarety).toBe(0);
  });

  it("platí aj tomu, kto bitku prehral", () => {
    const po = poBitke(predKoncomBitky((s) => sCigaretami(sCervenymi(s, 1, 2), [4, 0]), 0));
    expect(po.hraci[0].cigarety).toBe(2);
    expect(po.hraci[1].cigarety).toBe(KONSTANTY.CIGARETY_PORAZENEMU + 2);
  });

  it("platí aj pri sekere, keď porazený nie je", () => {
    const po = poBitke(predKoncomBitky((s) => sCigaretami(sCervenymi(s, 0, 1), [0, 3]), null));
    expect(po.hraci[0].cigarety).toBe(1);
    expect(po.hraci[1].cigarety).toBe(2);
  });

  it("obaja platia naraz, poradie nerozhoduje", () => {
    // Starší 0–1 červení u hráča 0, starší 2 u hráča 1.
    const s = predKoncomBitky((st) => sCigaretami(sCervenymi(st, 0, 2), [0, 1]));
    const sTretim: GameState = {
      ...s,
      starsi: s.starsi.map((e, i) => (i === 2 ? { ...e, strach: [e.strach[0], 3] as [number, number] } : e)) as GameState["starsi"],
    };
    expect(cervenychHraca(sTretim, 0)).toBe(2);
    expect(cervenychHraca(sTretim, 1)).toBe(1);
    const po = poBitke(sTretim);
    // Hráč 1 má 1 + 1 za prehru a platí 2; hráč 0 nemal nič, takže neplatí nič.
    expect(po.hraci[0].cigarety).toBe(2);
    expect(po.hraci[1].cigarety).toBe(0);
  });

  it("väzeň sa ráta ako červená držiteľa", () => {
    const s = predKoncomBitky((st) => sCigaretami(st, [0, 3]));
    const sVaznom = { ...s, vazni: [{ hrac: 0 as PlayerId, starsi: s.starsi[0]! }] } as unknown as GameState;
    expect(cervenychHraca(sVaznom, 0)).toBe(1);
    const po = poBitke(sVaznom);
    expect(po.hraci[0].cigarety).toBe(1);
  });

  it("po finále sa neplatí", () => {
    const po = poBitke(predKoncomBitky((s) => sCigaretami(sCervenymi(s, 0, 2), [0, 5]), 0, true));
    expect(po.hraci[1].cigarety).toBe(5);
  });
});

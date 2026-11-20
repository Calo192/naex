// Pravidlá v12.7 (Michal 2026-11-20, Zrejúca): stokársky barter zdražie — prvý barter hráča v partii stojí
// 5 cigariet, každý ďalší o 1 viac (6, 7, 8…), bez stropu; počíta sa len vlastné bartery (v 2 na 2 tímu,
// §18.7), za celú partiu. Strach víťaza pod súperovými rečami (#76 A) testuje reci-teplomer.test.ts.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { GameState, Miesto, PlayerId } from "../src/index.ts";
import {
  KONSTANTY,
  apply,
  barterCena,
  cenaBarteru,
  kapitan,
  legalCommands,
  loadGameData,
  maximumPoldeci,
  miestoNaTahu,
  opponentOf,
  partnerMiesta,
  rukaMiesta,
  setupGame,
  viewFor,
} from "../src/index.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

/** Pitka 1 na 1, hráči majú `cigarety` a za sebou `bartery` barterov z minulých kôl. */
function vPitke(cigarety: number, bartery: readonly [number, number] = [0, 0]): GameState {
  const s0 = setupGame(data, 41);
  return {
    ...s0,
    faza: "pitka",
    utocnik: 1,
    ciel: { typ: "lokalita", lokalita: s0.lokalityVHre.find((x) => x.defId === "krcma")! },
    strany: [[], []],
    pitkyCelkom: 2,
    pitkaCislo: 1,
    pitkaStav: { naTahu: 0, hotovy: [false, false], naexPouzity: [false, false], fajcenie: [0, 0], reakcia: null, postarka: [false, false], starosta: [false, false], naexPocet: [0, 0] },
    hraci: [
      { ...s0.hraci[0], poldeciPlne: 0, poldeciVypite: 3, cigarety, bartery: bartery[0] },
      { ...s0.hraci[1], poldeciPlne: 0, poldeciVypite: 3, cigarety, bartery: bartery[1] },
    ],
  };
}

const barter = (s: GameState, p: PlayerId): GameState => apply(data, s, { type: "barter" }, p).state;

describe("§7 Stokársky barter zdražie (v12.7)", () => {
  it("prvý barter v partii 5 cigariet, potom 6, 7, 8 — každý pridá plný poldeci", () => {
    expect([0, 1, 2, 3].map((n) => cenaBarteru(n))).toEqual([5, 6, 7, 8]);
    expect(KONSTANTY.BARTER_CENA).toBe(5);
    expect(KONSTANTY.BARTER_PRIRASTOK).toBe(1);
    let s = vPitke(5 + 6 + 7);
    for (const cena of [5, 6, 7]) {
      expect(barterCena(data, s, 0)).toBe(cena);
      const pred = s.hraci[0];
      s = barter(s, 0);
      expect(s.hraci[0].cigarety).toBe(pred.cigarety - cena);
      expect(maximumPoldeci(s.hraci[0])).toBe(maximumPoldeci(pred) + 1);
    }
    expect(s.hraci[0].bartery).toBe(3);
    expect(barterCena(data, s, 0)).toBe(8);
  });

  it("bez stropu: aj desiaty barter sa dá, keď má hráč cigarety", () => {
    const s = vPitke(14, [9, 0]);
    expect(barterCena(data, s, 0)).toBe(14);
    expect(barter(s, 0).hraci[0].bartery).toBe(10);
  });

  it("cena rastie každému hráčovi zvlášť — súperove bartery ju nemenia", () => {
    let s = vPitke(20);
    s = barter(barter(s, 0), 0);
    expect(barterCena(data, s, 0)).toBe(7);
    expect(barterCena(data, s, 1)).toBe(5);
    s = barter(s, 1);
    expect(s.hraci[1].cigarety).toBe(15);
    expect(barterCena(data, s, 0)).toBe(7);
  });

  it("počíta sa za celú partiu, nie za Pitku či kolo: bartery z minulých kôl cenu držia", () => {
    const s = vPitke(6, [2, 0]);
    // Tretí barter v partii stojí 7 — so 6 cigaretami nejde, aj keď je to prvý v tejto Pitke.
    expect(barterCena(data, s, 0)).toBe(7);
    expect(legalCommands(data, s, 0).some((c) => c.type === "barter")).toBe(false);
    expect(() => barter(s, 0)).toThrow(/7 cigariet/);
    expect(legalCommands(data, s, 1).some((c) => c.type === "barter")).toBe(true);
  });

  it("počet barterov je verejný — klient ráta cenu rovnako ako server, obaja vidia oboch", () => {
    const s = barter(vPitke(20), 0);
    for (const ja of [0, 1] as const) {
      const v = viewFor(data, s, ja);
      expect(v.hraci[0].bartery).toBe(1);
      expect(v.hraci[1].bartery).toBe(0);
      expect(barterCena(data, v, 0)).toBe(6);
      expect(barterCena(data, v, 1)).toBe(5);
    }
  });

  it("partia bez poľa bartery (spred v12.7) začína od 5", () => {
    const s = vPitke(5);
    const { bartery: _, ...bez } = s.hraci[0];
    expect(barterCena(data, { ...s, hraci: [bez, s.hraci[1]] }, 0)).toBe(5);
  });
});

describe("§18.7 2 na 2: cena barteru rastie za tím (tímové cigarety a poldeci)", () => {
  /** Pitka 2 na 2: každý vyložil Pijana a všetci pasovali; tímy majú po 20 cigariet. */
  function pitka2na2(): GameState {
    const s0 = setupGame(data, 7, { format: "2na2" });
    let s: GameState = {
      ...s0,
      faza: "zhromazdenie",
      ciel: { typ: "lokalita", lokalita: s0.lokalityVHre[0]! },
      pitkyCelkom: 1,
      pitkaCislo: 0,
      hraci: [{ ...s0.hraci[0], poldeciPlne: 3, cigarety: 20 }, { ...s0.hraci[1], poldeciPlne: 3, cigarety: 20 }],
      zhromazdenieStav: { naTahu: kapitan(s0, s0.utocnik), zostavaLimit: [3, 3], pasoval: [false, false], navyse: [0, 0], skoncili: [false, false, false, false] },
    };
    for (let i = 0; i < 4; i++) {
      const kto = miestoNaTahu(s) as Miesto;
      const pijan = rukaMiesta(s, kto).find((k) => k.defId === "pijan");
      if (pijan === undefined) throw new Error("Bez Pijana.");
      s = apply(data, s, { type: "place", uid: pijan.uid, target: "vlastna" }, kto).state;
    }
    while (s.faza === "zhromazdenie") s = apply(data, s, { type: "pass" }, miestoNaTahu(s) as Miesto).state;
    expect(s.faza).toBe("pitka");
    return s;
  }

  it("barter kapitána zdraží aj barter spoluhráča; druhý tím platí od 5", () => {
    let s = pitka2na2();
    const t = s.utocnik;
    const kap = kapitan(s, t);
    const cig = s.hraci[t].cigarety;
    s = apply(data, s, { type: "barter" }, kap).state;
    expect(s.hraci[t].cigarety).toBe(cig - 5);
    expect(legalCommands(data, s, partnerMiesta(kap)).some((c) => c.type === "barter")).toBe(true);
    s = apply(data, s, { type: "barter" }, partnerMiesta(kap)).state;
    expect(s.hraci[t].cigarety).toBe(cig - 5 - 6);
    expect(s.hraci[t].bartery).toBe(2);
    expect(barterCena(data, s, t)).toBe(7);
    expect(barterCena(data, s, opponentOf(t))).toBe(5);
  });
});

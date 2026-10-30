// Fajčenie naprázdno (Michal 2026-10-22, cez Leadera): keď sú doberací aj
// odhadzovací balíček prázdne, fajčenie nesmie minúť cigaretu — príkaz je
// neplatný a medzi legálnymi ťahmi nie je. Od v5 (Michal 2026-10-24, bod 1)
// sa fajčí len v Pitke, v Zhromaždení nie; draft zo šenku sa nemení.

import { describe, expect, it } from "vitest";
// Sada v6 (pred revíziou v7): test stráži pravidlá, ktoré revízia sady nemení.
import cardsJson from "./data/cards-v6.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { GameState, PlayerId } from "../src/index.ts";
import { IllegalCommandError, apply, cenaFajcenia, cenaFajceniaHraca, legalCommands, loadGameData, mozeHrat, naTahu, rngInt, rngSeed, setupGame, viewFor } from "../src/index.ts";
import { setupSBalickom } from "./helpers.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

function vStave(faza: "zhromazdenie" | "pitka", doberaci: boolean): GameState {
  const s0 = setupSBalickom(data, 41);
  const p: PlayerId = 0;
  const h = s0.hraci[p];
  // Celý balíček v ruke — doberací aj odhadzovací prázdne (5 štartoviek, 1. kolo).
  const ruka = doberaci ? h.ruka : [...h.ruka, ...h.doberaci, ...h.odhadzovaci];
  const zaklad: GameState = {
    ...s0,
    pitkyCelkom: 1,
    pitkaCislo: faza === "pitka" ? 1 : 0,
    ciel: { typ: "lokalita", lokalita: s0.lokalityVHre[0]! },
    lokalityVHre: s0.lokalityVHre.slice(1),
    hraci: [{ ...h, cigarety: 3, ruka, doberaci: doberaci ? h.doberaci : [], odhadzovaci: doberaci ? h.odhadzovaci : [] }, s0.hraci[1]],
  };
  if (faza === "zhromazdenie") {
    return { ...zaklad, faza, zhromazdenieStav: { naTahu: p, zostavaLimit: [2, 2], pasoval: [false, false], navyse: [0, 0] } };
  }
  return {
    ...zaklad,
    faza,
    pitkaStav: { naTahu: p, hotovy: [false, false], naexPouzity: [false, false], fajcenie: [0, 0], reakcia: null, postarka: [false, false], starosta: [false, false], naexPocet: [0, 0], vykup: [false, false] },
  };
}

describe("fajčenie naprázdno", () => {
  it("s prázdnym doberacím aj odhadzovacím balíčkom sa fajčiť nedá a cigareta ostane", () => {
    const s = vStave("pitka", false);
    expect(s.hraci[0].doberaci).toHaveLength(0);
    expect(legalCommands(data, s, 0).some((c) => c.type === "smoke")).toBe(false);
    expect(() => apply(data, s, { type: "smoke", pocet: 1 }, 0)).toThrow(IllegalCommandError);
    expect(s.hraci[0].cigarety).toBe(3);
  });

  it("keď je z čoho ťahať, v Pitke fajčenie ide ako doteraz", () => {
    const s = vStave("pitka", true);
    expect(legalCommands(data, s, 0)).toContainEqual({ type: "smoke", pocet: 1 });
    const po = apply(data, s, { type: "smoke", pocet: 1 }, 0).state;
    expect(po.hraci[0].cigarety).toBe(2);
    expect(po.hraci[0].ruka.length).toBeGreaterThan(s.hraci[0].ruka.length - 1);
    expect(po.pitkaStav?.fajcenie[0]).toBe(1);
  });
});

describe("v5 bod 1: fajčenie len v Pitke", () => {
  it("v Zhromaždení fajčenie nie je legálny ťah a príkaz neprejde, cigareta ostane", () => {
    const s = vStave("zhromazdenie", true);
    expect(legalCommands(data, s, 0).some((c) => c.type === "smoke")).toBe(false);
    expect(() => apply(data, s, { type: "smoke", pocet: 1 }, 0)).toThrow(/len v Pitke/);
    expect(s.hraci[0].cigarety).toBe(3);
  });
});

describe("fajčenie zdražie v Pitke (Michal 2026-10-27)", () => {
  const sCigaretami = (cigarety: number): GameState => {
    const s = vStave("pitka", true);
    const h = s.hraci[0];
    let uid = s.nextUid;
    const doberaci = [...h.doberaci, ...Array.from({ length: 8 }, () => ({ uid: uid++, defId: "pijan", leftLayout: 0 as const, rightLayout: 0 as const }))];
    return { ...s, nextUid: uid, hraci: [{ ...h, cigarety, doberaci, nerestiTotoKolo: 0 }, s.hraci[1]] };
  };
  const fajc = (s: GameState): GameState => apply(data, s, { type: "smoke", pocet: 1 }, 0).state;

  it("prvé fajčenie 1 cigareta, druhé 2, tretie 3; každé dá kartu a každá vyfajčená cigareta je nerest", () => {
    let s = sCigaretami(10);
    const ruka = s.hraci[0].ruka.length;
    expect([cenaFajcenia(0), cenaFajcenia(1), cenaFajcenia(2)]).toEqual([1, 2, 3]);
    s = fajc(s);
    expect([s.hraci[0].cigarety, s.pitkaStav?.fajcenie[0]]).toEqual([9, 1]);
    s = fajc(s);
    expect([s.hraci[0].cigarety, s.pitkaStav?.fajcenie[0]]).toEqual([7, 2]);
    s = fajc(s);
    expect([s.hraci[0].cigarety, s.pitkaStav?.fajcenie[0]]).toEqual([4, 3]);
    expect(s.hraci[0].ruka.length).toBe(ruka + 3);
    expect(s.hraci[0].nerestiTotoKolo).toBe(1 + 2 + 3);
    // Nie je to strop: štvrté stojí 4 — so 4 cigaretami sa dá.
    expect(cenaFajceniaHraca(s, 0)).toBe(4);
    expect(legalCommands(data, s, 0)).toContainEqual({ type: "smoke", pocet: 1 });
    expect(fajc(s).hraci[0].cigarety).toBe(0);
  });

  it("na drahšie fajčenie bez dosť cigariet to nejde a cigarety ostanú", () => {
    const s0 = sCigaretami(1);
    const s: GameState = { ...s0, pitkaStav: { ...s0.pitkaStav!, fajcenie: [1, 0] } };
    expect(legalCommands(data, s, 0).some((c) => c.type === "smoke")).toBe(false);
    expect(() => apply(data, s, { type: "smoke", pocet: 1 }, 0)).toThrow(/stojí 2 cigarety/);
  });

  it("viac kariet naraz stojí súčet (1 + 2 + 3), počítadlo má každý hráč zvlášť", () => {
    const s = apply(data, sCigaretami(10), { type: "smoke", pocet: 3 }, 0).state;
    expect(s.hraci[0].cigarety).toBe(10 - 6);
    expect(s.pitkaStav?.fajcenie).toEqual([3, 0]);
    expect(cenaFajceniaHraca(s, 1)).toBe(1);
  });

  it("počítadlo fajčení je verejné — súper vidí, koľko ďalšie fajčenie stojí", () => {
    const s = fajc(fajc(sCigaretami(10)));
    for (const p of [0, 1] as const) {
      const v = viewFor(data, s, p);
      expect(v.pitkaStav?.fajcenie).toEqual([2, 0]);
      expect(cenaFajceniaHraca(v, 0)).toBe(3);
    }
  });

  it("každá Pitka začína fajčenie znova od 1 cigarety (náhodné partie, fajčí sa, kedy sa dá)", () => {
    let s = setupGame(data, 22, { lokalit: 3 });
    let rng = rngSeed(5);
    let novychPitiek = 0;
    let poFajceni = 0;
    let fajciliVPredoslej = false;
    for (let krok = 0; s.koniec === null && krok < 4000; krok++) {
      const p = ([0, 1] as const).find((q) => mozeHrat(s, q)) ?? naTahu(s);
      if (p === null) break;
      const [n, r] = rngInt(rng, 2 ** 31);
      rng = r;
      const pred = s;
      const cmds = legalCommands(data, s, p);
      const cmd = cmds.find((c) => c.type === "smoke") ?? (cmds[n % cmds.length] as (typeof cmds)[number]);
      s = apply(data, s, cmd, p).state;
      if (s.faza === "pitka" && s.pitkaStav !== null && (pred.faza !== "pitka" || pred.pitkaCislo !== s.pitkaCislo)) {
        novychPitiek++;
        if (fajciliVPredoslej) poFajceni++;
        expect(s.pitkaStav.fajcenie).toEqual([0, 0]);
      }
      if (s.pitkaStav !== null) fajciliVPredoslej = s.pitkaStav.fajcenie[0] + s.pitkaStav.fajcenie[1] > 0;
    }
    expect(novychPitiek).toBeGreaterThan(3);
    expect(poFajceni).toBeGreaterThan(0);
  });
});

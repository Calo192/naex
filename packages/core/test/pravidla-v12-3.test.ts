// Pravidlá v12.3 (Michal 2026-11-11: „Keď hráč pasne, dostane toľko cigariet, koľko má nevypitých
// poldeci.“): cigareta za každý plný poldeci v okamihu pasu, poldeci ostanú plné; aj pas za hráča.
// Záverečná a Vychovávateľka sú bez cigariet, Obecný úrad ich nezdvojuje, Vínko sa ráta cez poldeci.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { CardInstance, Event, GameState, PlayerId } from "../src/index.ts";
import { KONSTANTY, apply, applySPrisunom, cigaretyZaPas, loadGameData, prisunZUdalosti, setupGame, viewFor } from "../src/index.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

let uid = 913000;
const inst = (defId: string): CardInstance => ({ uid: ++uid, defId, leftLayout: 0, rightLayout: 0 });

/** Zhromaždenie, hráč 0 na ťahu s rukou `ruka`, `plne` plnými poldeci a `cigarety`. */
function vZhromazdeni(ruka: CardInstance[], o: { plne?: number; cigarety?: number; lokalita?: string; pitkaCislo?: number } = {}): GameState {
  const s0 = setupGame(data, 31);
  const lokalita = o.lokalita === undefined ? s0.lokalityVHre.find((k) => k.defId === "krcma")! : inst(o.lokalita);
  const plne = o.plne ?? 3;
  return {
    ...s0,
    faza: "zhromazdenie",
    utocnik: 0,
    ciel: { typ: "lokalita", lokalita },
    strany: [[], []],
    pitkyCelkom: 2,
    pitkaCislo: o.pitkaCislo ?? 0,
    hraci: [{ ...s0.hraci[0], ruka, poldeciPlne: plne, poldeciVypite: Math.max(0, 3 - plne), cigarety: o.cigarety ?? 0 }, { ...s0.hraci[1], cigarety: 0 }],
    zhromazdenieStav: { naTahu: 0, zostavaLimit: [plne, s0.hraci[1].poldeciPlne], pasoval: [false, false], navyse: [0, 0] },
  };
}

const kniha = (events: readonly Event[], p: PlayerId): number => events.reduce((a, e) => (e.type === "zmenaCigariet" && e.hrac === p ? a + e.suma : a), 0);

describe("§6 pas dáva cigaretu za každý plný poldeci (v12.3)", () => {
  it.each([0, 1, 2, 3])("%i plných poldeci = toľko cigariet; poldeci ostanú plné, náhľad sedí s motorom", (plne) => {
    const s = vZhromazdeni([inst("pijan")], { plne });
    expect(cigaretyZaPas(viewFor(data, s, 0), 0)).toBe(plne * KONSTANTY.CIGARETY_ZA_PAS_NA_POLDECI);
    const { state: po, events } = applySPrisunom(data, s, { type: "pass" }, 0);
    expect(po.hraci[0].cigarety).toBe(plne);
    expect([po.hraci[0].poldeciPlne, po.hraci[0].poldeciVypite]).toEqual([s.hraci[0].poldeciPlne, s.hraci[0].poldeciVypite]);
    expect(kniha(events, 0)).toBe(plne);
    // Prísun ukáže zdroj „Za pas“ — nie je to platba ani akcia.
    if (plne > 0) expect(prisunZUdalosti(events)[0]?.riadky).toEqual([{ zdroj: "pas", suma: plne }]);
    const log = events.flatMap((e) => (e.type === "log" ? [e.text] : []));
    expect(log).toContain(plne > 0 ? `Hráč 1 pasuje do Pitky a za ${plne === 1 ? "1 plný poldeci" : `${plne} ${plne < 5 ? "plné" : "plných"} poldeci`} dostáva ${plne === 1 ? "1 cigaretu" : `${plne} cigarety`}.` : "Hráč 1 pasuje do Pitky.");
  });

  it("ráta sa v okamihu pasu — po vyložení karty o poldeci menej", () => {
    const pijan = inst("pijan");
    let s = vZhromazdeni([pijan, inst("pijan")], { plne: 3 });
    s = { ...s, zhromazdenieStav: { ...s.zhromazdenieStav!, pasoval: [false, true] } };
    s = apply(data, s, { type: "place", uid: pijan.uid, target: "vlastna" }, 0).state;
    expect(s.hraci[0].poldeciPlne).toBe(2);
    const po = apply(data, s, { type: "pass" }, 0).state;
    expect(po.hraci[0].cigarety).toBe(2);
  });

  it("pas, ktorý urobí hra za hráča (prázdna ruka), dáva cigarety tiež", () => {
    let s = vZhromazdeni([], { plne: 2 });
    s = { ...s, zhromazdenieStav: { ...s.zhromazdenieStav!, naTahu: 1 } };
    // Súper pasuje, hráč 0 nemá čo vyložiť — hra za neho pasuje a Zhromaždenie skončí.
    // Zhromaždenie sa dohrá aj s Pitkou a bitkou (nik nemá čo hrať) — cigarety za pas ukáže kniha.
    const { events } = applySPrisunom(data, s, { type: "pass" }, 1);
    expect(events.some((e) => e.type === "autoPas" && e.hrac === 0)).toBe(true);
    expect(events.filter((e) => e.type === "zmenaCigariet" && e.zdroj === "pas").map((e) => (e.type === "zmenaCigariet" ? [e.hrac, e.suma] : []))).toEqual([
      [1, s.hraci[1].poldeciPlne],
      [0, 2],
    ]);
  });

  it("pas v ďalšom Zhromaždení toho istého kola dá cigarety znova", () => {
    const prve = apply(data, vZhromazdeni([inst("pijan")], { plne: 2, cigarety: 0 }), { type: "pass" }, 0).state;
    const druhe = vZhromazdeni([inst("pijan")], { plne: prve.hraci[0].poldeciPlne, cigarety: prve.hraci[0].cigarety, pitkaCislo: 1 });
    expect(apply(data, druhe, { type: "pass" }, 0).state.hraci[0].cigarety).toBe(4);
  });

  it("Obecný úrad cigarety za pas nezdvojuje — nie sú z Pitky", () => {
    const s = vZhromazdeni([inst("pijan")], { plne: 3, lokalita: "obecny_urad" });
    const { state: po, events } = applySPrisunom(data, s, { type: "pass" }, 0);
    expect(po.hraci[0].cigarety).toBe(3);
    expect(events.some((e) => e.type === "zmenaCigariet" && e.zdroj === "obecnyUrad")).toBe(false);
  });

  it("Vínko: maximum +1 sa do pasu ráta len ako skutočný plný poldeci", () => {
    const vinko = inst("vinko");
    let s = vZhromazdeni([vinko, inst("pijan")], { plne: 2, cigarety: 3 });
    s = { ...s, zhromazdenieStav: { ...s.zhromazdenieStav!, pasoval: [false, true] } };
    s = apply(data, s, { type: "place", uid: vinko.uid, target: "dedicstvo" }, 0).state;
    expect(s.hraci[0].poldeciPlne).toBe(3);
    const cigarety = s.hraci[0].cigarety;
    expect(apply(data, s, { type: "pass" }, 0).state.hraci[0].cigarety).toBe(cigarety + 3);
  });
});

describe("§6 bez cigariet: Záverečná a Vychovávateľka (v12.3)", () => {
  it("Záverečná ukončí vykladanie ako pas, ale cigarety za zvyšné poldeci nedá", () => {
    const pijan = inst("pijan");
    const s = vZhromazdeni([pijan, inst("pijan")], { plne: 3, cigarety: 1 });
    const po = apply(data, s, { type: "zaverecna", uid: pijan.uid, target: "vlastna" }, 0).state;
    expect(po.zhromazdenieStav?.pasoval[0] ?? true).toBe(true);
    expect(po.hraci[0].poldeciPlne).toBe(2);
    expect(po.hraci[0].cigarety).toBe(1 - KONSTANTY.CENA_ZAVERECNEJ);
  });

  it("Vychovávateľka: súper hneď pasuje a za pas nedostane cigarety — plné poldeci mu ostanú; log to povie", () => {
    const s0 = vZhromazdeni([inst("pijan")], { plne: 3 });
    const e = s0.starsi.find((x) => x.elderId === "vychovavatelka");
    if (e === undefined) throw new Error("Vychovávateľka v hre nie je.");
    const s: GameState = {
      ...s0,
      starsi: s0.starsi.filter((x) => x !== e),
      vazni: [{ elderId: e.elderId, hrac: 0, poradie: 1, karta: e.karta, scorecard: e.scorecard, miesto: 0 }],
      hraci: [s0.hraci[0], { ...s0.hraci[1], poldeciPlne: 3, poldeciVypite: 0 }],
    };
    const { state: po, events } = applySPrisunom(data, s, { type: "schopnostVazna", elderId: "vychovavatelka" }, 0);
    expect(po.zhromazdenieStav?.pasoval).toEqual([false, true]);
    expect(po.hraci[1].cigarety).toBe(0);
    expect(po.hraci[1].poldeciPlne).toBe(3);
    expect(kniha(events, 1)).toBe(0);
    expect(events.some((x) => x.type === "log" && x.text.endsWith("hráč 2 v tomto Zhromaždení hneď pasuje a za pas nedostane cigarety."))).toBe(true);
    expect(data.elders.get("vychovavatelka")?.schopnost).toBe("Súper v tomto Zhromaždení hneď pasuje a za pas nedostane cigarety.");
  });
});

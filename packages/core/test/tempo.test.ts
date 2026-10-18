// Tempo (Michal 2026-10-12, playtest 20261011-183315): priznanie neodovzdá
// ťah, nevyhnutné ťahy odohrá hra sama, akcie Dlh plnia zadĺženie s prahom.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { CardInstance, GameState, PlacedCard, PlayerId } from "../src/index.ts";
import { KONSTANTY, apply, buildGameData, legalCommands, loadGameData, setupGame } from "../src/index.ts";
import { EMPTY, instanceFor, makeDef } from "./helpers.ts";

const zaklad = loadGameData(cardsJson, eldersJson, scorecardsJson);
const dlznik = makeDef("dlznik", [null, "Dlh", null, null], EMPTY);
const data = buildGameData(new Map([...zaklad.cards, [dlznik.id, dlznik]]), zaklad.elders, {
  scorecards: zaklad.scorecards,
  body: zaklad.bodyPodmienok,
});

let uidSeq = 80000;
const inst = (defId: string): CardInstance => ({ uid: ++uidSeq, defId, leftLayout: 0, rightLayout: 0 });

function vZhromazdeni(ruka: CardInstance[], limit: [number, number], pasoval: [boolean, boolean]): GameState {
  const s = setupGame(data, 4);
  return {
    ...s,
    faza: "zhromazdenie",
    hraci: [{ ...s.hraci[0], ruka }, s.hraci[1]],
    zhromazdenieStav: { naTahu: 0, zostavaLimit: limit, pasoval, navyse: [0, 0] },
  } as GameState;
}

function vPitke(strany: GameState["strany"], hraci?: GameState["hraci"]): GameState {
  const s = setupGame(data, 3);
  return {
    ...s,
    faza: "pitka",
    pitkyCelkom: 1,
    pitkaCislo: 1,
    strany,
    hraci: hraci ?? s.hraci,
    pitkaStav: { naTahu: 0, hotovy: [false, false], naexPouzity: [false, false], fajcenie: [0, 0], reakcia: null, postarka: [false, false], starosta: [false, false] },
  } as GameState;
}

describe("priznanie neodovzdá ťah", () => {
  it("po priznaní je hráč stále na ťahu a limit sa nemíňa", () => {
    const cirhoza = inst("cirhoza");
    const pijan = inst("pijan");
    const s = vZhromazdeni([cirhoza, pijan], [2, 2], [false, false]);
    const { state } = apply(data, s, { type: "place", uid: cirhoza.uid, target: "priznanie" }, 0);
    expect(state.zhromazdenieStav?.naTahu).toBe(0);
    expect(state.zhromazdenieStav?.zostavaLimit[0]).toBe(2);
    expect(state.hraci[0].priznane.map((k) => k.uid)).toContain(cirhoza.uid);
  });
});

describe("nevyhnutné ťahy", () => {
  it("keď hráč nemá čo vyložiť, pas sa odohrá sám a začne Pitka", () => {
    const pijan = inst("pijan");
    // Súper už pasoval; hráč 0 vyloží poslednú kartu a nemá nič ďalšie.
    const s = vZhromazdeni([pijan], [1, 0], [false, true]);
    const { state, events } = apply(data, s, { type: "place", uid: pijan.uid, target: "vlastna" }, 0);
    expect(state.faza).toBe("pitka");
    expect(events).toContainEqual({ type: "log", text: "Hráč 1 už nemá čo vyložiť." });
  });

  it("Vypiť sa neponúka, keď sa nedá nič vyložiť", () => {
    const s = vZhromazdeni([inst("pijan")], [0, 0], [false, false]);
    // Fajčiť (karta za cigaretu) sa smie aj v Zhromaždení — za hráča sa však pasuje.
    expect(legalCommands(data, s, 0).filter((c) => c.type !== "smoke")).toEqual([{ type: "pass" }]);
  });

  it("hráč bez poldeci a cigariet v Pitke nič nepotvrdzuje", () => {
    const s0 = setupGame(data, 3);
    const bezNicoho = { ...s0.hraci[1], poldeciPlne: 0, cigarety: 0 };
    const s = vPitke([[], []], [s0.hraci[0], bezNicoho]);
    expect(legalCommands(data, { ...s, pitkaStav: { ...s.pitkaStav!, naTahu: 1 } } as GameState, 1)).toEqual([{ type: "skipNaex" }]);
    const { state } = apply(data, s, { type: "skipNaex" }, 0);
    expect(state.faza).not.toBe("pitka");
  });
});

describe("prah Dlhu a Cirhózy", () => {
  // Michal 2026-10-18: prah Dlhu 1 — Dlh je základná kliatba hry.
  it("prahy sú 3 (Cirhóza) a 1 (Dlh)", () => {
    expect(KONSTANTY.PRAH_CIRHOZY_ZAKLAD).toBe(3);
    expect(KONSTANTY.PRAH_DLHU).toBe(1);
  });

  it("dve akcie Dlh dajú dve karty Dlh a zadĺženie klesne na 0", () => {
    const karta = instanceFor(data, "dlznik", [null, "Dlh", null, null], EMPTY);
    const lezi: PlacedCard = { card: karta, playedBy: 0 as PlayerId };
    const s = vPitke([[lezi], []]);
    const dlhyPred = s.hraci[0].odhadzovaci.filter((k) => k.defId === "dlh").length;
    // NA EX zdvojí neaktívny Dlh → 2 akcie Dlh.
    const naex = apply(data, s, { type: "naex", uid: karta.uid }, 0).state;
    // Súper smie na NA EX odpovedať kartou — tu nechce.
    const bezReakcie = apply(data, naex, { type: "bezReakcie" }, 1).state;
    const po = apply(data, bezReakcie, { type: "skipNaex" }, 0).state;
    const { state, events } = apply(data, po, { type: "skipNaex" }, 1);
    const dlhyPo = state.hraci[0].odhadzovaci.filter((k) => k.defId === "dlh").length;
    expect(dlhyPo - dlhyPred).toBe(2);
    expect(state.hraci[0].zadlzenie).toBe(0);
    expect(events).toContainEqual({ type: "log", text: "Hráč 1 dosiahol prah dlhu (1) — Dlh." });
  });
});

// Pravidlá v3 (2026-10-11): NA EX len na vlastné karty, Vypiť, akcie lokality
// pre majiteľa susednej karty a Svokra zakazujúca súperovi NA EX.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { CardInstance, GameState, LineState, PlacedCard, PlayerId } from "../src/index.ts";
import { apply, evaluateLine, legalCommands, loadGameData, setupGame } from "../src/index.ts";
import { instanceFor, makeDef, syntheticData } from "./helpers.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

let uidSeq = 70000;
const inst = (defId: string): CardInstance => ({ uid: ++uidSeq, defId, leftLayout: 0, rightLayout: 0 });
const lezi = (defId: string, playedBy: PlayerId): PlacedCard => ({ card: inst(defId), playedBy });

/** Pitka, hráč 0 na ťahu; v línii karty podľa zadania. */
function vPitke(strany: GameState["strany"], zakaz: [boolean, boolean] = [false, false]): GameState {
  const s = setupGame(data, 3);
  return {
    ...s,
    faza: "pitka",
    pitkyCelkom: 1,
    pitkaCislo: 1,
    strany,
    pitkaStav: { naTahu: 0, hotovy: [false, false], naexPouzity: [false, false], zakazNaex: zakaz, fajcenie: [0, 0], reakcia: null, postarka: [false, false], starosta: [false, false] },
  } as GameState;
}

/** Zhromaždenie, hráč 0 na ťahu s limitom 3, v ruke dané karty. */
function vZhromazdeni(ruka: CardInstance[]): GameState {
  const s = setupGame(data, 4);
  return {
    ...s,
    faza: "zhromazdenie",
    hraci: [{ ...s.hraci[0], ruka, poldeciPlne: 2, poldeciVypite: 0 }, s.hraci[1]],
    zhromazdenieStav: { naTahu: 0, zostavaLimit: [3, 3], pasoval: [false, false], navyse: [0, 0] },
  } as GameState;
}

describe("NA EX len na vlastné karty", () => {
  it("na súperovu kartu nejde, na vlastnú áno — aj podstrčenú na súperovej strane", () => {
    const moja = lezi("pijan", 0);
    const podstrcena = lezi("ministrant", 0);
    const superova = lezi("pijan", 1);
    const s = vPitke([[moja], [podstrcena, superova]]);
    const naex = legalCommands(data, s, 0).filter((c) => c.type === "naex").map((c) => (c.type === "naex" ? c.uid : 0));
    expect(naex).toContain(moja.card.uid);
    expect(naex).toContain(podstrcena.card.uid);
    expect(naex).not.toContain(superova.card.uid);
    expect(() => apply(data, s, { type: "naex", uid: superova.card.uid }, 0)).toThrow(/svoju kartu/);
    // Pečeň z NA EX ide hráčovi, ktorý ho dal (je to jeho karta).
    const { events } = apply(data, s, { type: "naex", uid: podstrcena.card.uid }, 0);
    expect(events).toContainEqual({ type: "pecen", hrac: 0, mnozstvo: 1 });
  });
});

describe("Vypiť", () => {
  it("limit klesne o 1, ďalšou kartou ťah nekončí, pečeň +1 a nerest", () => {
    const [a, b, c] = [inst("pijan"), inst("ministrant"), inst("pijan")];
    let s = vZhromazdeni([a, b, c]);
    expect(legalCommands(data, s, 0)).toContainEqual({ type: "vypit" });
    const r = apply(data, s, { type: "vypit" }, 0);
    s = r.state;
    expect(s.hraci[0].poldeciPlne).toBe(1);
    expect(s.hraci[0].poldeciVypite).toBe(1);
    expect(s.hraci[0].nerestiTotoKolo).toBe(1);
    expect(s.zhromazdenieStav?.zostavaLimit[0]).toBe(2);
    expect(r.events).toContainEqual({ type: "pecen", hrac: 0, mnozstvo: 1 });
    // Prvá karta po vypití: hráč 0 pokračuje.
    s = apply(data, s, { type: "place", uid: a.uid, target: "vlastna" }, 0).state;
    expect(s.zhromazdenieStav?.naTahu).toBe(0);
    // Druhá karta: ťah prechádza na súpera.
    s = apply(data, s, { type: "place", uid: b.uid, target: "vlastna" }, 0).state;
    expect(s.zhromazdenieStav?.naTahu).toBe(1);
    expect(s.zhromazdenieStav?.zostavaLimit[0]).toBe(0);
  });

  it("dá sa piť opakovane; pasovanie zruší nevyužité ťahy navyše", () => {
    let s = vZhromazdeni([inst("pijan"), inst("pijan"), inst("pijan")]);
    s = apply(data, s, { type: "vypit" }, 0).state;
    s = apply(data, s, { type: "vypit" }, 0).state;
    expect(s.zhromazdenieStav?.navyse[0]).toBe(2);
    expect(s.zhromazdenieStav?.zostavaLimit[0]).toBe(1);
    expect(legalCommands(data, s, 0)).not.toContainEqual({ type: "vypit" }); // poldeci už nie sú plné
    s = apply(data, s, { type: "pass" }, 0).state;
    expect(s.zhromazdenieStav?.navyse[0]).toBe(0);
    expect(() => apply(data, s, { type: "vypit" }, 1)).not.toThrow();
  });
});

describe("Svokra", () => {
  it("súper v najbližšej Pitke nesmie dať NA EX", () => {
    const s = vPitke([[lezi("pijan", 0)], []], [true, false]);
    expect(legalCommands(data, s, 0).some((c) => c.type === "naex")).toBe(false);
    const karta = s.strany[0][0]?.card.uid ?? 0;
    expect(() => apply(data, s, { type: "naex", uid: karta }, 0)).toThrow(/Svokra/);
  });

  it("Nástup Svokry nastaví zákaz NA EX súperovi", () => {
    const svokra = inst("svokra");
    const s = vZhromazdeni([svokra]);
    const po = apply(data, s, { type: "place", uid: svokra.uid, target: "vlastna" }, 0).state;
    expect(po.zakazNaex).toEqual([false, true]);
  });
});

describe("akcie lokality patria majiteľovi susednej karty", () => {
  it("podstrčená karta aktivuje stranu lokality pre seba", () => {
    const lok = makeDef("lok", [null, "Cigaretka", null, null], ["Pecka", null, null, null], { tags: ["Lokalita"] });
    const a = makeDef("a", [null, null, null, null], [null, "Rana", null, null]);
    const syn = syntheticData([lok, a]);
    const lokCard = instanceFor(syn, "lok", [null, "Cigaretka", null, null], ["Pecka", null, null, null]);
    const cardA = instanceFor(syn, "a", [null, null, null, null], [null, "Rana", null, null]);
    const base: LineState = { lokalita: lokCard, lokalitaOtocena: false, strany: [[{ card: cardA, playedBy: 0 }], []] };
    // Vlastná karta hráča 0 na jeho strane: Rana aj Cigaretka lokality pre hráča 0.
    expect(evaluateLine(syn, base).sums[0]).toEqual({ Rana: 1, Cigaretka: 1 });
    // Tú istú kartu (rovnaké efektívne strany) má hráč 1 podstrčenú na strane hráča 0:
    // otočená karta má inú geometriu, preto ju skladáme tak, aby spoj vznikol rovnako.
    const b = makeDef("b", [null, null, "Rana", null], [null, null, null, null]);
    const syn2 = syntheticData([lok, b]);
    const cardB = instanceFor(syn2, "b", [null, null, "Rana", null], [null, null, null, null]);
    const podstrcena: LineState = { lokalita: lokCard, lokalitaOtocena: false, strany: [[{ card: cardB, playedBy: 1 }], []] };
    const ev = evaluateLine(syn2, podstrcena);
    expect(ev.sums[1]).toEqual({ Rana: 1, Cigaretka: 1 });
    expect(ev.sums[0]).toEqual({});
  });
});

// Roadmapa #71 (2026-10-23): Šofér a Snúbenica (do 2026-10-23 Ujo s fúrikom).
// Šofér — Furt: NA EX na kartu vedľa neho nezdvojí jej neaktívne akcie,
// aktívne zruší ako vždy. Snúbenica — Nástup: vyložená vedľa karty
// s NA EX ju vráti jej majiteľovi do ruky a zaujme jej miesto.
// Karty sú vo zverejnenej sade v11 (cards.json).

import { describe, expect, it } from "vitest";
// Sada v6 (pred revíziou v7): test stráži pravidlá, ktoré revízia sady nemení.
import cardsJson from "./data/cards-v6.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { CardInstance, GameState, PlacedCard, PlayerId } from "../src/index.ts";
import { apply, evaluateLine, legalCommands, loadGameData, nahladVylozenia, setupGame, tahBota } from "../src/index.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

let uidSeq = 70000;
const inst = (defId: string): CardInstance => ({ uid: ++uidSeq, defId, leftLayout: 0, rightLayout: 0 });
const lezi = (defId: string, playedBy: PlayerId, naexBy?: PlayerId): PlacedCard =>
  naexBy === undefined ? { card: inst(defId), playedBy } : { card: inst(defId), playedBy, naexBy };

/** Sloty karty po vyhodnotení línie bez lokality. */
function sloty(strany: GameState["strany"], karta: PlacedCard) {
  const ev = evaluateLine(data, { lokalita: null, lokalitaOtocena: false, strany }).cards.get(karta.card.uid);
  return [...(ev?.left ?? []), ...(ev?.right ?? [])].filter((x) => x !== null);
}

describe("Šofér (v7: NA EX susedov už nemení — efekt je Bitka, test v7-karty)", () => {
  it("NA EX na kartu vedľa Šoféra zdvojí jej neaktívne akcie ako inde", () => {
    const pijan = lezi("pijan", 0, 1);
    const bez = sloty([[pijan], []], pijan);
    // Osamotený Pijan: všetky akcie neaktívne, NA EX ich zdvojí.
    expect(bez.every((x) => x.stav === "aktivna" && x.nasobok === 2)).toBe(true);

    const sofer = lezi("sofer", 0);
    const vedla = sloty([[pijan, sofer], []], pijan);
    expect(vedla.some((x) => x.nasobok === 2)).toBe(true);
  });

  it("NA EX na samotného Šoféra zdvojuje normálne", () => {
    const sofer = lezi("sofer", 0, 0);
    const s = sloty([[sofer, lezi("hasic", 0)], []], sofer);
    expect(s.some((x) => x.stav === "aktivna" && x.nasobok === 2)).toBe(true);
  });
});

/** Pitka po odkrytom NA EX hráča 0 — hráč 1 smie odpovedať jednou kartou z ruky. */
function poNaex(strany: GameState["strany"], rukaReagujuceho: CardInstance[]): GameState {
  const s = setupGame(data, 5);
  return {
    ...s,
    faza: "pitka",
    pitkyCelkom: 1,
    pitkaCislo: 1,
    strany,
    hraci: [
      { ...s.hraci[0], poldeciPlne: 1, poldeciVypite: 0, nerestiTotoKolo: 0 },
      { ...s.hraci[1], ruka: rukaReagujuceho },
    ],
    // NA EX naraz (v5): odpovedá sa po odkrytí, keď obaja skončili; po hráčovi 1 ešte odpovedá hráč 0.
    pitkaStav: { naTahu: 1, hotovy: [true, true], naexPouzity: [true, false], fajcenie: [0, 0], reakcia: 1, postarka: [false, false], starosta: [false, false], frontaReakcii: [0] },
  } as GameState;
}

describe("Snúbenica", () => {
  it("vyložená vedľa karty s NA EX ju vráti majiteľovi do ruky a zaujme jej miesto", () => {
    const prvy = lezi("hasic", 0);
    const sNaex = lezi("pijan", 0, 0);
    const snubenica = inst("snubenica");
    const s = poNaex([[prvy, sNaex], []], [snubenica]);
    const { state, events } = apply(data, s, { type: "place", uid: snubenica.uid, target: "superova" }, 1);
    expect(state.strany[0].map((pl) => pl.card.uid)).toEqual([prvy.card.uid, snubenica.uid]);
    expect(state.strany[0][1]?.playedBy).toBe(1);
    // Karta ide majiteľovi (hráč 0), poldeci z nej je vypitý tomu, kto dal NA EX.
    expect(state.hraci[0].ruka.some((k) => k.uid === sNaex.card.uid)).toBe(true);
    expect(state.hraci[1].ruka.some((k) => k.uid === sNaex.card.uid)).toBe(false);
    expect(state.hraci[0].poldeciVypite).toBe(1);
    expect(state.hraci[0].nerestiTotoKolo).toBe(1);
    expect(events.some((e) => e.type === "log" && e.text.startsWith("Snúbenica:"))).toBe(true);
  });

  it("vlastnú kartu s NA EX vráti do ruky jej majiteľovi, aj keď NA EX dal súper", () => {
    const sNaex = lezi("pijan", 1, 0);
    const snubenica = inst("snubenica");
    const state = apply(data, poNaex([[], [sNaex]], [snubenica]), { type: "place", uid: snubenica.uid, target: "vlastna" }, 1).state;
    expect(state.strany[1].map((pl) => pl.card.uid)).toEqual([snubenica.uid]);
    expect(state.hraci[1].ruka.some((k) => k.uid === sNaex.card.uid)).toBe(true);
    expect(state.hraci[0].poldeciVypite).toBe(1);
  });

  it("vedľa karty bez NA EX nerobí nič", () => {
    const sNaex = lezi("pijan", 0, 0);
    const bez = lezi("hasic", 0);
    const snubenica = inst("snubenica");
    const state = apply(data, poNaex([[sNaex, bez], []], [snubenica]), { type: "place", uid: snubenica.uid, target: "superova" }, 1).state;
    expect(state.strany[0].map((pl) => pl.card.uid)).toEqual([sNaex.card.uid, bez.card.uid, snubenica.uid]);
    expect(state.hraci[0].poldeciVypite).toBe(0);
  });

  it("náhľad vyloženia ráta s odchodom karty a novým susedom", () => {
    const prvy = lezi("hasic", 0);
    const sNaex = lezi("pijan", 0, 0);
    const snubenica = inst("snubenica");
    const line = { lokalita: null, lokalitaOtocena: false, strany: [[prvy, sNaex], []] as GameState["strany"] };
    const n = nahladVylozenia(data, line, 1, snubenica, "superova");
    expect(n.sused?.karta.uid).toBe(prvy.card.uid);
    // Pijan s NA EX dával hráčovi 0 zdvojené akcie — po odchode ich niet.
    const pijanBezSuseda = sloty(line.strany, sNaex).filter((x) => x.nasobok > 0).length;
    expect(pijanBezSuseda).toBeGreaterThan(0);
    expect(Object.values(n.zmeny[0]).some((d) => (d ?? 0) < 0)).toBe(true);
  });

  it("je medzi legálnymi odpoveďami na NA EX", () => {
    const snubenica = inst("snubenica");
    const s = poNaex([[lezi("pijan", 0, 0)], []], [snubenica]);
    expect(legalCommands(data, s, 1).some((c) => c.type === "place" && c.uid === snubenica.uid)).toBe(true);
  });
});

describe("bot", () => {
  it("odpovie na NA EX Snúbenicou, ktorá súperovi vezme kartu so zdvojenou Peckou", () => {
    const snubenica = inst("snubenica");
    const s = { ...poNaex([[lezi("policajtka", 0), lezi("svokra", 0, 0)], []], [snubenica]), ciel: { typ: "lokalita", lokalita: inst("jednota") } } as GameState;
    const tah = tahBota(data, s, 1, 7);
    expect(tah).toMatchObject({ type: "place", uid: snubenica.uid });
  });
});

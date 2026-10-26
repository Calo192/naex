// Náhľady ceny (návrh „Náhľady sľubujú inú cenu, než hra potom zúčtuje“, #1 B):
// čo náhľad sľúbi o Dlhoch po bitke, musí hra naozaj nechať — Robota
// a Dievčina na vydaj ich pália tým istým kódom (paleneDlhyVBitke).

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { CardInstance, ClientState, GameState, PlacedCard, PlayerId } from "../src/index.ts";
import {
  apply,
  buildGameData,
  kliatbyNahladu,
  loadGameData,
  naTahu,
  parseScorecards,
  poOdkrytiNaex,
  setupGame,
  viewFor,
  vyhladDlhov,
} from "../src/index.ts";
import type { Layout4 } from "./helpers.ts";
import { instanceFor, makeDef, naexOdkryte } from "./helpers.ts";

const zaklad = loadGameData(cardsJson, eldersJson, scorecardsJson);
const D4: Layout4 = ["Dlh", "Dlh", "Dlh", "Dlh"];
const R1: Layout4 = ["Robota", null, null, null];
const dlzna = makeDef("dlzna", D4, D4, { tags: ["Občan"] });
const robotnik = makeDef("robotnik", R1, R1, { tags: ["Občan"] });
const cards = new Map(zaklad.cards);
for (const d of [dlzna, robotnik]) cards.set(d.id, d);
const data = buildGameData(cards, zaklad.elders, parseScorecards(scorecardsJson));

const dlh = (uid: number): CardInstance => ({ uid, defId: "dlh", leftLayout: 0, rightLayout: 0 });
const lezi = (card: CardInstance, playedBy: PlayerId): PlacedCard => ({ card, playedBy });
const dlhy = (s: GameState, p: PlayerId): number => s.hraci[p].priznane.filter((k) => k.defId === "dlh").length;

/** Posledná Pitka kola, obaja s plným poldeci, bez kariet v ruke (na NA EX sa neodpovedá). */
function vPitke(): GameState {
  const s0 = setupGame(data, 41);
  return {
    ...s0,
    faza: "pitka",
    pitkyCelkom: 1,
    pitkaCislo: 1,
    strany: [[lezi(instanceFor(data, "dlzna", D4, D4), 0), lezi(instanceFor(data, "dlzna", D4, D4), 0), lezi(instanceFor(data, "robotnik", R1, R1), 0)], []],
    hraci: [
      { ...s0.hraci[0], ruka: [], priznane: [dlh(910001), dlh(910002)], poldeciPlne: 1 },
      { ...s0.hraci[1], ruka: [], poldeciPlne: 1 },
    ],
    pitkaStav: {
      naTahu: s0.utocnik === 0 ? 1 : 0,
      hotovy: [false, false],
      naexPouzity: [false, false],
      fajcenie: [0, 0],
      reakcia: null,
      postarka: [false, false],
      starosta: [false, false],
    },
  };
}

/** Dohrá Pitku bez ďalšieho NA EX — bitka sa rozbehne v tom istom ťahu a prejde krokom Exekútora (aj celá). */
function doBitky(s: GameState): GameState {
  let t = s;
  for (let i = 0; i < 4 && t.faza === "pitka"; i++) t = apply(data, t, { type: "skipNaex" }, naTahu(t)!).state;
  expect(t.faza).not.toBe("pitka");
  expect(t.bitkaStav?.krok ?? null).not.toBe("exekutor");
  return t;
}

describe("Dlh po bitke v náhľade sedí s hrou", () => {
  it("výhľad Dlhov: nové Dlhy z Pitky mínus to, čo spáli Robota", () => {
    const s = vPitke();
    const [v0] = vyhladDlhov(data, viewFor(data, s, 1), 0);
    expect(v0.nove).toBeGreaterThan(0);
    expect(v0.kapacita).toBeGreaterThan(0);
    expect(v0.poBitke).toBeGreaterThan(0);
    expect(dlhy(doBitky(s), 0)).toBe(v0.poBitke);
  });

  it("náhľad NA EX: o koľko Dlhov viac ostane po bitke a za koľko bodov", () => {
    const s = vPitke();
    const p: PlayerId = 1;
    const ciel = s.strany[0][0]!.card.uid;
    const pred = viewFor(data, s, p);
    const po: ClientState = {
      ...pred,
      strany: [pred.strany[0].map((pl) => (pl.card.uid === ciel ? { ...pl, naexBy: p } : pl)), pred.strany[1]],
      hraci: [pred.hraci[0], { ...pred.hraci[1], pecen: pred.hraci[1].pecen + 1 }],
    };
    const ceny = [{ cirhoza: -2, dlh: -6 }, { cirhoza: -2, dlh: -6 }] as const;
    const [k0] = kliatbyNahladu(data, pred, po, 0, ceny);

    // Hráč 1 dá NA EX, ak je na ťahu; inak najprv hráč 0 skončí.
    let t = s;
    if (naTahu(t) !== p) t = apply(data, t, { type: "skipNaex" }, naTahu(t)!).state;
    t = naexOdkryte(data, t, ciel, p).state;
    const sNaex = doBitky(t);
    const bezNaex = doBitky(s);
    expect(k0.dlhy).toBeGreaterThan(0);
    expect(dlhy(sNaex, 0) - dlhy(bezNaex, 0)).toBe(k0.dlhyPoBitke);
    expect(k0.body).toBe(k0.cirhozy * -2 + k0.dlhyPoBitke * -6);
  });

  it("Svokra (Michal 2026-10-26): náhľad NA EX na jej majiteľovu kartu ukáže Ranu, cigarety nekradne", () => {
    const s0 = vPitke();
    const s: GameState = { ...s0, strany: [s0.strany[0], [lezi({ uid: 910100, defId: "svokra", leftLayout: 0, rightLayout: 0 }, 1)]] };
    // Hráč 1 má Svokru: NA EX hráča 0 na hráčovu 0 kartu jej majiteľovi nič nedá.
    const naSvoju = poOdkrytiNaex(data, viewFor(data, s, 0), s.strany[0][0]!.card.uid)!;
    expect(naSvoju.svokra).toBe(0);
    expect(naSvoju.view.hraci[0].cigarety).toBe(s.hraci[0].cigarety);
    // Svokru má hráč 0: NA EX hráča 1 na jeho kartu = Rana pre hráča 1.
    const s2: GameState = { ...s0, strany: [[...s0.strany[0], lezi({ uid: 910101, defId: "svokra", leftLayout: 0, rightLayout: 0 }, 0)], []] };
    const naJeho = poOdkrytiNaex(data, viewFor(data, s2, 1), s2.strany[0][0]!.card.uid)!;
    expect(naJeho.svokra).toBe(1);
    expect(naJeho.view.hraci[1].cigarety).toBe(s2.hraci[1].cigarety);
    let t = s2;
    if (naTahu(t) !== 1) t = apply(data, t, { type: "skipNaex" }, naTahu(t)!).state;
    t = naexOdkryte(data, t, s2.strany[0][0]!.card.uid, 1).state;
    expect(t.hraci[1].cigarety).toBe(s2.hraci[1].cigarety);
  });
});

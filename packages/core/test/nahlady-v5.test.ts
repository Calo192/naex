// Náhľady ceny NA EX vo v5 (návrh #1 „Náhľady sľubujú inú cenu, než hra potom zúčtuje“,
// Michal 2026-10-24): náhľad musí ukázať to, čo motor pri odkrytí naozaj zúčtuje —
// Výpalné (najviac toľko cigariet, koľko hráč má), Na zdravie „do dna“ (poldeci späť
// plný, limit ďalšieho kola) a skryté NA EX, ktoré hráč už dal (NA EX naraz).

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { CardInstance, ElderState, Favour, GameState, PlayerId } from "../src/index.ts";
import {
  apply,
  buildGameData,
  favourStarsieho,
  legalCommands,
  limitBuduceKolo,
  limitZhromazdenia,
  loadGameData,
  naTahu,
  odkrytieNaex,
  parseScorecards,
  sMojimiSkrytymiNaex,
  setupGame,
  viewFor,
} from "../src/index.ts";
import type { Layout4 } from "./helpers.ts";
import { EMPTY, instanceFor, makeDef } from "./helpers.ts";

const zaklad = loadGameData(cardsJson, eldersJson, scorecardsJson);
const R2: Layout4 = ["Rana", "Rana", null, null];
const R1: Layout4 = ["Rana", null, null, null];
const sada = buildGameData(
  new Map([...zaklad.cards, ["n5_lavy", makeDef("n5_lavy", EMPTY, R2)], ["n5_pol", makeDef("n5_pol", R1, R1)]]),
  zaklad.elders,
  parseScorecards(scorecardsJson),
);

/** Priazeň `favour` hráčovi p so silou sila (marker na jeho polovici). */
function sPriaznou(s: GameState, favour: Favour, p: PlayerId, sila: 1 | 2 | 3): GameState {
  const marker = (p === 0 ? 3 - sila : 5 + sila) as ElderState["marker"];
  return { ...s, starsi: s.starsi.map((e) => (favourStarsieho(sada, e) === favour ? { ...e, marker} : e)) };
}

/**
 * Pitka: obranca 1 na ťahu, na jeho strane dve jeho karty (NA EX smie na obe).
 * `odpoved`: hráč 0 má v ruke kartu, ktorou smie odpovedať — stav po odkrytí sa zastaví na odpovedi.
 */
function pitka(seed: number, cigarety: number, odpoved: boolean): { s: GameState; ciel: number } {
  const s0 = setupGame(sada, seed);
  const lavy = instanceFor(sada, "n5_lavy", EMPTY, R2);
  const pol = instanceFor(sada, "n5_pol", R1, R1);
  const ruka0: CardInstance[] = odpoved ? [instanceFor(sada, "n5_pol", R1, R1)] : [];
  const s: GameState = {
    ...s0,
    faza: "pitka",
    kolo: 2,
    utocnik: 0,
    pitkyCelkom: 1,
    pitkaCislo: 1,
    ciel: { typ: "lokalita", lokalita: null },
    lokalityVHre: s0.lokalityVHre.slice(1),
    strany: [[], [{ card: pol, playedBy: 1 }, { card: lavy, playedBy: 1 }]],
    hraci: [
      { ...s0.hraci[0], ruka: ruka0, cigarety: 5 },
      { ...s0.hraci[1], ruka: [], cigarety, poldeciPlne: 1, poldeciVypite: 1 },
    ],
    pitkaStav: { naTahu: 1, hotovy: [false, false], naexPouzity: [false, false], fajcenie: [0, 0], reakcia: null, postarka: [false, false], starosta: [false, false], naexPocet: [0, 0], vykup: [false, false] },
  };
  return { s, ciel: lavy.uid };
}

/** Dohrá Pitku a bitku bez ďalších rozhodnutí. */
function dohraj(s0: GameState): GameState {
  let s = s0;
  for (let i = 0; i < 30 && (s.faza === "pitka" || s.faza === "bitka") && s.koniec === null; i++) {
    const p = naTahu(s);
    if (p === null) break;
    const legal = legalCommands(sada, s, p);
    const cmd = legal.find((c) => c.type === "skipNaex" || c.type === "bezReakcie" || (c.type === "cintorin" && c.uid === null)) ?? legal[0]!;
    s = apply(sada, s, cmd, p).state;
  }
  return s;
}

describe("náhľad NA EX v5 = zúčtovanie motora", () => {
  it("Výpalné: náhľad sľúbi toľko cigariet, koľko motor pri odkrytí prevedie — najviac, koľko hráč má", () => {
    for (const cigarety of [0, 1, 5]) {
      const { s, ciel } = pitka(201, cigarety, true);
      const sV = sPriaznou(s, "NEPRAJNIK", 0, 2);
      const nahlad = odkrytieNaex(sada, viewFor(sada, sV, 1), 1);
      expect(nahlad.vypalne).toBe(Math.min(2, cigarety));
      // Odkrytie sa zastaví na odpovedi hráča 0 — cigarety sa porovnajú pred vyhodnotením Pitky.
      let st = apply(sada, sV, { type: "naex", uid: ciel }, 1).state;
      // Bez cigarety hráč 1 nemá čo robiť — „hotovo“ za neho odohrá hra sama.
      if (st.pitkaStav?.hotovy[1] !== true) st = apply(sada, st, { type: "skipNaex" }, 1).state;
      st = apply(sada, st, { type: "skipNaex" }, 0).state;
      expect(st.pitkaStav?.reakcia).toBe(0);
      expect(sV.hraci[1].cigarety - st.hraci[1].cigarety).toBe(nahlad.vypalne);
      expect(st.hraci[0].cigarety - sV.hraci[0].cigarety).toBe(nahlad.vypalne);
    }
  });

  it("skryté NA EX: pohľad so zúčtovaným NA EX sa zhoduje so stavom po odkrytí (poldeci, pečeň, cigarety, karta)", () => {
    const { s, ciel } = pitka(202, 3, true);
    const sV = sPriaznou(s, "NEPRAJNIK", 0, 1);
    const skryte = apply(sada, sV, { type: "naex", uid: ciel }, 1).state;
    const nahlad = sMojimiSkrytymiNaex(sada, viewFor(sada, skryte, 1));
    let st = apply(sada, skryte, { type: "skipNaex" }, 1).state;
    st = apply(sada, st, { type: "skipNaex" }, 0).state;
    // Hráč 0 má čím odpovedať — stav stojí po odkrytí, pred vyhodnotením Pitky.
    expect(st.pitkaStav?.reakcia).toBe(0);
    const odkryte = viewFor(sada, st, 1);
    for (const p of [0, 1] as const) {
      expect(nahlad.hraci[p].cigarety).toBe(odkryte.hraci[p].cigarety);
      expect(nahlad.hraci[p].poldeciPlne).toBe(odkryte.hraci[p].poldeciPlne);
      expect(nahlad.hraci[p].pecen).toBe(odkryte.hraci[p].pecen);
    }
    expect(nahlad.strany[1].find((pl) => pl.card.uid === ciel)?.naexBy).toBe(1);
    // Súper zo svojho pohľadu skryté NA EX nemá ako zúčtovať — jeho pohľad sa nezmení.
    const suPohlad = viewFor(sada, skryte, 0);
    expect(sMojimiSkrytymiNaex(sada, suPohlad)).toEqual(suPohlad);
  });

  it("Na zdravie „do dna“: limit ďalšieho kola v náhľade = limit, s ktorým hráč naozaj vojde do Zhromaždenia", () => {
    for (const sila of [0, 1] as const) {
      const { s, ciel } = pitka(203, 5, false);
      const sA = sila === 0 ? s : sPriaznou(s, "ALKOHOLIK", 1, sila);
      expect(odkrytieNaex(sada, viewFor(sada, sA, 1), 1).doDna).toBe(sila > 0);
      const nahlad = limitBuduceKolo(viewFor(sada, sA, 1), 1, true, sada);
      const po = dohraj(apply(sada, sA, { type: "naex", uid: ciel }, 1).state);
      expect(po.kolo).toBe(3);
      expect(limitZhromazdenia(viewFor(sada, po, 1), 1)).toBe(nahlad);
    }
  });
});

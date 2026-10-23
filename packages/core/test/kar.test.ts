// Lokalita Kar (roadmapa #80, 2026-10-23): „Bitka: Každý hráč smie zahodiť jednu
// nepriznanú Cirhózu z ruky. Súperov Hrobár za to dostane cigaretu.“ Kraje
// „pri vdove“ a „pri koláčoch“ podľa konceptu Admina. Lokalita ešte nie je vo
// zverejnenej sade (cards.json), test si ju pridá sám.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { CardInstance, GameState, PlacedCard } from "../src/index.ts";
import { apply, legalCommands, loadGameData, setupGame } from "../src/index.ts";

const KAR = {
  id: "kar",
  index: 63,
  name: "Kar",
  tags: ["Lokalita"],
  effect_text: "Bitka: Každý hráč smie zahodiť jednu nepriznanú Cirhózu z ruky. Súperov Hrobár za to dostane cigaretu.",
  triggers: ["Bitka"],
  left: { blocked: [0, 3], actions: { Viera: 1, Povera: 1 }, allowed: { "1": ["Viera"], "2": ["Povera"] }, name: "pri vdove" },
  right: { blocked: [0, 3], actions: { Poldeci: 1, Rana: 1 }, allowed: { "1": ["Poldeci"], "2": ["Rana"] }, name: "pri koláčoch" },
  permutations: { total: 1, left: 1, right: 1 },
};
const data = loadGameData({ ...cardsJson, cards: [...cardsJson.cards, KAR] }, eldersJson, scorecardsJson);

let uidSeq = 50000;
const inst = (defId: string): CardInstance => ({ uid: ++uidSeq, defId, leftLayout: 0, rightLayout: 0 });

/** Posledná Pitka pred bitkou o lokalitu `lokalita`; hráči majú dané ruky. */
function predBitkou(lokalita: string, ruky: [CardInstance[], CardInstance[]], strany: GameState["strany"] = [[], []]): GameState {
  const s = setupGame(data, 21);
  return {
    ...s,
    faza: "pitka",
    ciel: { typ: "lokalita", lokalita: inst(lokalita) },
    pitkyCelkom: 1,
    pitkaCislo: 1,
    strany,
    hraci: [
      { ...s.hraci[0], ruka: ruky[0], poldeciPlne: 0 },
      { ...s.hraci[1], ruka: ruky[1], poldeciPlne: 0 },
    ],
    pitkaStav: { naTahu: s.utocnik === 0 ? 1 : 0, hotovy: [false, false], naexPouzity: [false, false], fajcenie: [0, 0], reakcia: null, postarka: [false, false], starosta: [false, false] },
  } as GameState;
}

/** Dohrá Pitku, kým bitka nečaká na niekoho v kroku Kar (alebo ho neprejde). */
function doKaru(s: GameState): GameState {
  for (let i = 0; i < 20 && s.faza === "pitka"; i++) {
    const kto = s.pitkaStav?.naTahu ?? 0;
    s = apply(data, s, s.vizia !== null ? { type: "vizia", vziat: true } : { type: "skipNaex" }, kto).state;
  }
  return s;
}

describe("Kar", () => {
  it("bitka počká na obrancu, ktorý má v ruke Cirhózu; zahodená Cirhóza zmizne z hry a súperov Hrobár dostane cigaretu", () => {
    const cirhoza = inst("cirhoza");
    const hrobar: PlacedCard = { card: inst("hrobar"), playedBy: 1 };
    const s0 = predBitkou("kar", [[cirhoza, inst("pijan")], [inst("pijan")]], [[], [hrobar]]);
    const obranca = s0.utocnik === 0 ? 1 : 0;
    // Cirhózu dáme obrancovi — on sa rozhoduje prvý.
    const s1 = obranca === 0 ? s0 : ({ ...s0, hraci: [s0.hraci[1], s0.hraci[0]], strany: [[{ ...hrobar, playedBy: 0 }], []] } as GameState);
    const s = doKaru(s1);
    expect(s.bitkaStav?.krok).toBe("kar");
    expect(s.bitkaStav?.caka).toBe(obranca);
    expect(legalCommands(data, s, obranca)).toEqual([{ type: "kar", uid: null }, { type: "kar", uid: cirhoza.uid }]);
    const su = obranca === 0 ? 1 : 0;
    const cigPred = s.hraci[su].cigarety;
    const po = apply(data, s, { type: "kar", uid: cirhoza.uid }, obranca).state;
    const h = po.hraci[obranca];
    expect([...h.ruka, ...h.odhadzovaci, ...h.doberaci, ...h.priznane].some((k) => k.uid === cirhoza.uid)).toBe(false);
    expect(po.hraci[su].cigarety).toBeGreaterThanOrEqual(cigPred + 1);
    expect(po.bitkaStav?.krok).not.toBe("kar");
  });

  it("Cirhózu si hráč smie nechať; bez Cirhózy v ruke sa krok preskočí", () => {
    const cirhoza = inst("cirhoza");
    // Súper Cirhózu v ruke nemá — jeho rozhodnutie sa preskočí, čaká sa len na hráča 0.
    const s = doKaru(predBitkou("kar", [[cirhoza], [inst("pijan")]]));
    expect(s.bitkaStav?.caka).toBe(0);
    const po = apply(data, s, { type: "kar", uid: null }, 0).state;
    expect(po.hraci[0].ruka.map((k) => k.uid)).toContain(cirhoza.uid);
    expect(po.bitkaStav?.krok).not.toBe("kar");
  });

  it("inde ako na Kare sa krok nekoná", () => {
    const s = doKaru(predBitkou("jednota", [[inst("cirhoza")], [inst("cirhoza")]]));
    expect(s.bitkaStav?.krok).not.toBe("kar");
  });
});

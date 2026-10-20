// Revízia kariet (Michal 2026-10-18): nové a upravené efekty, ktoré vyhodnocuje
// jadro. Akcie kariet sú v tvorcovi; testy si karty skladajú samy, aby nezáviseli
// od východiskovej sady v cards.json.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { CardInstance, ElderState, GameState, LineState, PlacedCard, PlayerId } from "../src/index.ts";
import {
  KONSTANTY,
  apply,
  cenaBarteru,
  cieleVykladania,
  efektPotlaceny,
  evaluateLine,
  loadGameData,
  pohorseniaNeplatia,
  posunMarker,
  prebytokProtiZlava,
  printedSides,
  setupGame,
} from "../src/index.ts";
import { instanceFor, makeDef, syntheticData } from "./helpers.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

let uidSeq = 50000;
const inst = (defId: string): CardInstance => ({ uid: ++uidSeq, defId, leftLayout: 0, rightLayout: 0 });
const lezi = (defId: string, playedBy: PlayerId): PlacedCard => ({ card: inst(defId), playedBy });

describe("Dedičstvo stojí cigarety (od 2026-10-19 rastúca cena, viď pravidla-20261019)", () => {
  it("bez cigariet sa Nástroj do Dedičstva nedá, s nimi áno a cigarety ubudnú", () => {
    expect(cieleVykladania(data, [[], []], 0, inst("puska"), 3, false)).not.toContain("dedicstvo");
    expect(cieleVykladania(data, [[], []], 0, inst("puska"), 3, true)).toContain("dedicstvo");

    const s0 = setupGame(data, 5);
    const puska = inst("puska");
    const s = {
      ...s0,
      faza: "zhromazdenie",
      ciel: { typ: "lokalita", lokalita: s0.lokalityVHre[0]!, elderId: null },
      hraci: [{ ...s0.hraci[0], ruka: [puska, inst("pijan")], cigarety: 3 }, s0.hraci[1]],
      zhromazdenieStav: { naTahu: 0, zostavaLimit: [2, 2], pasoval: [false, false], navyse: [0, 0] },
    } as GameState;
    const po = apply(data, s, { type: "place", uid: puska.uid, target: "dedicstvo" }, 0).state;
    expect(po.hraci[0].cigarety).toBe(3 - KONSTANTY.CENA_DEDICSTVA_ZAKLAD);
    expect(po.hraci[0].dedicstvo.map((k) => k.uid)).toContain(puska.uid);

    const chudobny = { ...s, hraci: [{ ...s.hraci[0], cigarety: 0 }, s.hraci[1]] } as GameState;
    expect(() => apply(data, chudobny, { type: "place", uid: puska.uid, target: "dedicstvo" }, 0)).toThrow(/cigaret/);
  });
});

describe("Pasca a Kočovník vo vyhodnotení línie", () => {
  const R = ["Rana", null, null, null] as const;
  const D = ["Dlh", null, null, null] as const;
  const E = [null, null, null, null] as const;
  const sd = syntheticData([
    makeDef("lok", R, R, { tags: ["Lokalita"] }),
    makeDef("obcan", R, R),
    makeDef("kocovnik", D, D, { tags: ["Občan", "Zahraničný"] }),
    makeDef("prazdny", E, E),
  ]);
  const k = (id: string, l: readonly (string | null)[], r: readonly (string | null)[]) =>
    instanceFor(sd, id, l as never, r as never);

  it("Kočovník: jeho Hazard dostáva hráč, na ktorého strane leží", () => {
    const lokD = makeDef("lokD", D, D, { tags: ["Lokalita"] });
    const sd2 = syntheticData([lokD, makeDef("kocovnik", D, D, { tags: ["Občan", "Zahraničný"] })]);
    const kocovnik: PlacedCard = { card: instanceFor(sd2, "kocovnik", D, D), playedBy: 0 };
    // Podstrčený na stranu hráča 1: jeho aktívny Dlh ide hráčovi 1.
    const ev = evaluateLine(sd2, { lokalita: instanceFor(sd2, "lokD", D, D), lokalitaOtocena: false, strany: [[], [kocovnik]] });
    expect(ev.sums[1].Dlh).toBe(1);
    // Dlh lokality dostane majiteľ susednej karty (hráč 0) — to je bežné pravidlo.
    expect(ev.sums[0].Dlh).toBe(1);
  });
});

describe("Policajtka, Praudovravec, Puška, Noviny, Lakomec", () => {
  const stav = (strany: GameState["strany"], dedicstvo: [string[], string[]] = [[], []]): GameState => {
    const s = setupGame(data, 9);
    return {
      ...s,
      strany,
      hraci: [
        { ...s.hraci[0], dedicstvo: dedicstvo[0].map(inst) },
        { ...s.hraci[1], dedicstvo: dedicstvo[1].map(inst) },
      ],
    } as GameState;
  };

  it("Policajtka: súperove Pohoršenia proti jej majiteľovi neplatia", () => {
    const s = stav([[], [lezi("policajtka", 1)]]);
    expect(pohorseniaNeplatia(data, s, 1)).toBe(true);
    expect(pohorseniaNeplatia(data, s, 0)).toBe(false);
  });

  it("Praudovravec: Autority v SÚPEROVEJ partii neuplatňujú efekt", () => {
    // Policajtka (Autorita) hráča 1, Praudovravec hráča 0 → umlčaná.
    const s = stav([[lezi("praudovravec", 0)], [lezi("policajtka", 1)]]);
    expect(efektPotlaceny(data, s, 1, "policajtka")).toBe(true);
    expect(pohorseniaNeplatia(data, s, 1)).toBe(false);
    // Vlastný Praudovravec tvoju Autoritu neumlčí.
    const vlastny = stav([[], [lezi("praudovravec", 1), lezi("policajtka", 1)]]);
    expect(efektPotlaceny(data, vlastny, 1, "policajtka")).toBe(false);
  });

  it("Puška v Dedičstve: prebytok proti jej majiteľovi o 2 menší", () => {
    const s = stav([[], []], [["puska"], []]);
    expect(prebytokProtiZlava(s, 0)).toBe(2);
    expect(prebytokProtiZlava(s, 1)).toBe(0);
  });

  it("Noviny: Pohoršenie smie na krajnú pozíciu, ak bol marker na predposlednej od začiatku kola", () => {
    const e = { ...setupGame(data, 9).starsi[0]!, marker: 1, markerZaciatokKola: 1 } as ElderState;
    expect(posunMarker(e, 0, true)).toBeNull();
    expect(posunMarker(e, 0, true, true)).toBe(0);
    const len = { ...e, markerZaciatokKola: 2 } as ElderState;
    expect(posunMarker(len, 0, true, true)).toBeNull();
  });

  it("Lakomec: barter za 5 / 4 / 3 / 2 cigarety podľa sily priazne", () => {
    expect([0, 2, 4, 6].map(cenaBarteru)).toEqual([5, 4, 3, 2]);
  });
});

// Michal 2026-10-18 (po revízii): Pitky podľa lokality, cigarety za prebytok.
describe("cigarety porazenému za prebytok", () => {
  it("1 cigareta za každého posunutého staršieho, viac posunov toho istého = 1", () => {
    const s0 = setupGame(data, 12);
    const [e1, e2] = s0.starsi;
    const stred = (e: ElderState) => ({ ...e, marker: 4, markerZaciatokKola: 4 }) as ElderState;
    const s: GameState = {
      ...s0,
      faza: "bitka",
      ciel: { typ: "lokalita", lokalita: s0.lokalityVHre[0]!, elderId: null },
      starsi: [stred(e1!), stred(e2!), ...s0.starsi.slice(2)],
      bitkaStav: {
        krok: "prebytok",
        caka: 0,
        sums: [{}, {}],
        exekutorHotovy: [true, true],
        pohorsenieZostava: [0, 0],
        pohnuteMarkery: [],
        damage: { tuhe: [5, 0], makke: [0, 0], celkove: [5, 0], zvysnaViera: [0, 0], zvysnaPovera: [0, 0] },
        vitaz: 0,
        prebytokDrzi: 0,
        prebytokZostava: 3,
        prebytokPosunute: [],
        liecbaHotova: [true, true],
        benzinkaZostava: [0, 0],
        lokalitaPrepadne: false,
        spalit: [],
        vesticaHotova: true,
      },
    } as GameState;
    const cig = s.hraci[1].cigarety;
    let t = apply(data, s, { type: "prebytok", elderId: e1!.elderId }, 0).state;
    t = apply(data, t, { type: "prebytok", elderId: e1!.elderId }, 0).state;
    t = apply(data, t, { type: "prebytok", elderId: e2!.elderId }, 0).state;
    // Bitka sa dohrá sama (ostatné kroky sú hotové) — porazený dostane 2 cigarety.
    expect(t.hraci[1].cigarety - cig).toBe(2);
  });
});

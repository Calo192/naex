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
      ciel: { typ: "lokalita", lokalita: s0.lokalityVHre[0]! },
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

});

// Kočovník (Furt, Michal 2026-10-24): jeho akcie dostane hráč s prevahou v jeho
// kraji; do prevahy sa ráta majiteľovi; pri rovnosti karta hneď pri lokalite.
describe("Kočovník — akcie hráčovi s prevahou v kraji", () => {
  // Akcie na indexoch 0 a 3 — otočená karta (hráč 1) ich má na tých istých miestach.
  const R = ["Rana", null, null, "Rana"] as const;
  const D = ["Dlh", null, null, "Dlh"] as const;
  const lok = makeDef("lok", R, R, { tags: ["Lokalita"] });
  const obcan = makeDef("obcan", R, R);
  const sdDlh = syntheticData([lok, obcan, makeDef("kocovnik", D, D, { tags: ["Občan", "Zahraničný"] })]);
  const sdRana = syntheticData([lok, obcan, makeDef("kocovnik", R, R, { tags: ["Občan", "Zahraničný"] })]);
  const leziV = (sd: typeof sdDlh, id: string, a: readonly (string | null)[], hrac: PlayerId): PlacedCard => ({
    card: instanceFor(sd, id, a as never, a as never),
    playedBy: hrac,
  });
  const ev = (sd: typeof sdDlh, strana1: PlacedCard[]) =>
    evaluateLine(sd, { lokalita: instanceFor(sd, "lok", R as never, R as never), lokalitaOtocena: false, strany: [[], strana1] });

  it("prevahu má majiteľ (Kočovník sám v kraji) → Dlh dostane majiteľ, hoci leží na súperovej strane", () => {
    const e = ev(sdDlh, [leziV(sdDlh, "kocovnik", D, 0)]);
    expect(e.sums[0].Dlh).toBeGreaterThan(0);
    expect(e.sums[1].Dlh ?? 0).toBe(0);
  });

  it("súper v kraji prevládne (rovnosť, jeho karta pri lokalite) → Kočovníkov Dlh dostane súper", () => {
    const e = ev(sdDlh, [leziV(sdDlh, "obcan", R, 1), leziV(sdDlh, "kocovnik", D, 0)]);
    expect(e.sums[1].Dlh).toBeGreaterThan(0);
    expect(e.sums[0].Dlh ?? 0).toBe(0);
  });

  it("platí pre všetky jeho akcie — aj Ranu dostane hráč s prevahou", () => {
    const e = ev(sdRana, [leziV(sdRana, "obcan", R, 1), leziV(sdRana, "kocovnik", R, 0)]);
    expect(e.sums[0].Rana ?? 0).toBe(0);
    expect(e.sums[1].Rana).toBeGreaterThan(0);
  });

  it("do prevahy sa Kočovník ráta majiteľovi — s ďalšou svojou kartou majiteľ v kraji prevládne a akcie má on", () => {
    const e = ev(sdDlh, [leziV(sdDlh, "obcan", R, 1), leziV(sdDlh, "kocovnik", D, 0), leziV(sdDlh, "obcan", R, 0)]);
    expect(e.sums[0].Dlh).toBeGreaterThan(0);
    expect(e.sums[1].Dlh ?? 0).toBe(0);
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

  it("Praudovravec: Autority v SÚPEROVEJ partii neuplatňujú efekt", () => {
    // Policajtka (Autorita) hráča 1, Praudovravec hráča 0 → umlčaná.
    const s = stav([[lezi("praudovravec", 0)], [lezi("policajtka", 1)]]);
    expect(efektPotlaceny(data, s, 1, "policajtka")).toBe(true);
    // Vlastný Praudovravec tvoju Autoritu neumlčí.
    const vlastny = stav([[], [lezi("praudovravec", 1), lezi("policajtka", 1)]]);
    expect(efektPotlaceny(data, vlastny, 1, "policajtka")).toBe(false);
  });

  it("Puška v Dedičstve: prebytok proti jej majiteľovi o 2 menší", () => {
    const s = stav([[], []], [["puska"], []]);
    expect(prebytokProtiZlava(s, 0)).toBe(2);
    expect(prebytokProtiZlava(s, 1)).toBe(0);
  });

  it("v6: Pohoršenie smie na krajnú pozíciu vždy (Noviny majú nový efekt — špak za väčšinu strachu)", () => {
    const e = { ...setupGame(data, 9).starsi[0]!, marker: 1 } as ElderState;
    expect(posunMarker(e, 0)).toBe(0);
    expect(posunMarker({ ...e, marker: 0 }, 0)).toBeNull();
  });

  it("v5: barter stojí vždy 5 cigariet (Lakomec je Abstinent, barter nezlacňuje)", () => {
    expect(cenaBarteru()).toBe(5);
  });
});

// Michal 2026-10-18 (po revízii): Pitky podľa lokality, cigarety za prebytok.
describe("cigarety porazenému za prebytok", () => {
  it("1 cigareta za každého posunutého staršieho, viac posunov toho istého = 1", () => {
    const s0 = setupGame(data, 12);
    const [e1, e2] = s0.starsi;
    const stred = (e: ElderState) => ({ ...e, marker: 3 }) as ElderState;
    const s: GameState = {
      ...s0,
      faza: "bitka",
      ciel: { typ: "lokalita", lokalita: s0.lokalityVHre.find((k) => k.defId !== "kulturny_dom")! },
      starsi: [stred(e1!), stred(e2!), ...s0.starsi.slice(2)],
      bitkaStav: {
        krok: "prebytok",
        caka: 0,
        sums: [{}, {}],
        exekutorHotovy: [true, true],
        pohorsenieZostava: [0, 0],
        exekutor: [0, 0],
        damage: { tuhe: [5, 0], makke: [0, 0], celkove: [5, 0], zvysnaViera: [0, 0], zvysnaPovera: [0, 0] },
        vitaz: 0,
        prebytokDrzi: 0,
        prebytokZostava: 3,
        prebytokPosunute: [],
        pohrebHotovy: [true, true],
        benzinkaZostava: [0, 0],

        karHotovy: [true, true],
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

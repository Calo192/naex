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

describe("Pes stráži koniec strany", () => {
  it("na súperovho Psa na konci jeho strany nepodstrčíš, na svoju stranu áno", () => {
    const strany: GameState["strany"] = [[], [lezi("pes", 1)]];
    const ciele = cieleVykladania(data, strany, 0, inst("ministrant"), 3);
    expect(ciele).toContain("vlastna");
    expect(ciele).not.toContain("superova");
  });

  it("keď za Psom leží ďalšia karta, koniec už nestráži", () => {
    const strany: GameState["strany"] = [[], [lezi("pes", 1), lezi("ministrant", 1)]];
    expect(cieleVykladania(data, strany, 0, inst("ministrant"), 3)).toContain("superova");
  });
});

describe("Dedičstvo stojí 2 cigarety", () => {
  it("bez cigariet sa Nástroj do Dedičstva nedá, s dvoma áno a cigarety ubudnú", () => {
    expect(cieleVykladania(data, [[], []], 0, inst("puska"), 3, 1)).not.toContain("dedicstvo");
    expect(cieleVykladania(data, [[], []], 0, inst("puska"), 3, 2)).toContain("dedicstvo");

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
    expect(po.hraci[0].cigarety).toBe(3 - KONSTANTY.CENA_DEDICSTVA);
    expect(po.hraci[0].dedicstvo.map((k) => k.uid)).toContain(puska.uid);

    const chudobny = { ...s, hraci: [{ ...s.hraci[0], cigarety: 1 }, s.hraci[1]] } as GameState;
    expect(() => apply(data, chudobny, { type: "place", uid: puska.uid, target: "dedicstvo" }, 0)).toThrow(/cigarety/);
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

  it("Pasca: akcie prvej podstrčenej karty neplatia, susedov spoj áno", () => {
    // Hráč 0 podstrčí Občana na stranu hráča 1, hneď k lokalite.
    const podstrcena: PlacedCard = { card: k("obcan", R, R), playedBy: 0 };
    const line = (pasca: boolean): LineState => ({
      lokalita: k("lok", R, R),
      lokalitaOtocena: false,
      strany: [[], [podstrcena]],
      pasca: [false, pasca],
    });
    expect(evaluateLine(sd, line(false)).sums[0].Rana).toBe(2); // jeho Rana + Rana lokality
    // S Pascou hráča 1 nemá podstrčená karta nič; akcia lokality sa stále páruje (dostane ju majiteľ susednej karty).
    expect(evaluateLine(sd, line(true)).sums[0].Rana).toBe(1);
  });

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
describe("Pitky podľa aktivovaných akcií lokality", () => {
  it("vyloženie karty, ktorá aktivuje akcie lokality, zvýši počet Pitiek", () => {
    const s0 = setupGame(data, 11);
    // Lokalita, ktorej ľavá (k hráčovi 0) hrana má aspoň jednu akciu.
    const lokalita = s0.lokalityVHre.find((k) => printedSides(data, k).left.some((x) => x !== null))!;
    const lavaLok = printedSides(data, lokalita).left;
    // Karta z ruky hráča 0, ktorej pravá hrana sa s lokalitou spáruje na čo najviac pozíciách.
    const pary = (k: CardInstance) => printedSides(data, k).right.filter((x, i) => x !== null && lavaLok[i] !== null).length;
    const kandidati = [...data.cards.values()]
      .filter((c) => !c.tags.includes("Lokalita") && !c.tags.includes("Kliatba") && !c.tags.includes("Nástroj") && !c.tags.includes("Starešina"))
      .flatMap((c) => {
        const v = data.variants.get(c.id)!;
        return v.right.map((_, r) => ({ uid: 99000 + r, defId: c.id, leftLayout: 0, rightLayout: r }) as CardInstance);
      })
      .sort((a, b) => pary(b) - pary(a));
    const karta = kandidati[0]!;
    if (pary(karta) < 2) return; // sada nemá lokalitu s 2 spárovateľnými akciami — test nemá čo overiť
    const s: GameState = {
      ...s0,
      faza: "zhromazdenie",
      ciel: { typ: "lokalita", lokalita, elderId: null },
      lokalitaOtocena: false,
      pitkyCelkom: 1,
      pitkaCislo: 0,
      hraci: [{ ...s0.hraci[0], ruka: [karta, ...s0.hraci[0].ruka] }, s0.hraci[1]],
      zhromazdenieStav: { naTahu: 0, zostavaLimit: [2, 2], pasoval: [false, false], navyse: [0, 0] },
    } as GameState;
    const po = apply(data, s, { type: "place", uid: karta.uid, target: "vlastna" }, 0).state;
    expect(po.pitkyCelkom).toBeGreaterThanOrEqual(2);
  });
});

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
        limitHotovy: [true, true],
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

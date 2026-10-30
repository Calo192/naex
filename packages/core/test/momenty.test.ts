// Pečiatky momentov (Michal 2026-10-23, nápad 5): jadro rozpozná moment len
// z verejných vecí, strop drží 1 za úsek kola a zlato 2 za partiu.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { Command, Event, GameState, Moment, PlacedCard, PlayerId, StavMomentov } from "../src/index.ts";
import { parseScorecards, MOMENTY, NALADY, NALADY_MOMENTOV, NOVE_MOMENTY, ZLATO_ZA_PARTIU, apply, buildGameData, legalCommands, loadGameData, momenty, naTahu, obmedzMomenty, rngInt, rngSeed, setupGame, naladaMomentu } from "../src/index.ts";
import type { Layout4 } from "./helpers.ts";
import { EMPTY, instanceFor, makeDef, naexOdkryte } from "./helpers.ts";

const zaklad = loadGameData(cardsJson, eldersJson, scorecardsJson);
const R: Layout4 = ["Rana", null, null, null];
const RR: Layout4 = ["Rana", "Rana", null, null];
const KONIEC_RR: Layout4 = [null, null, "Rana", "Rana"];
const defs = [
  makeDef("m_c1", EMPTY, R),
  makeDef("m_c0", R, KONIEC_RR),
  // Karty hráča 1 ležia otočené o 180° — páruje sa ich vytlačená ľavá s pravou.
  makeDef("m_d0", RR, EMPTY),
  makeDef("m_d1", EMPTY, RR),
];
const data = buildGameData(new Map([...zaklad.cards, ...defs.map((d) => [d.id, d] as const)]), zaklad.elders, {
  scorecards: zaklad.scorecards,
  body: parseScorecards(scorecardsJson).body,
});
const lezi = (id: string, l: Layout4, r: Layout4, p: PlayerId): PlacedCard => ({ card: instanceFor(data, id, l, r), playedBy: p });

/** Pitka o Jednotu: hráč 0 má Ranu spárovanú a dve voľné, hráč 1 štyri spárované → vyhráva 1. */
function predZvratom(): { s: GameState; c0: PlacedCard } {
  const s0 = setupGame(data, 41);
  const c0 = lezi("m_c0", R, KONIEC_RR, 0);
  const s: GameState = {
    ...s0,
    faza: "pitka",
    ciel: { typ: "lokalita", lokalita: s0.lokalityVHre.find((k) => k.defId === "jednota") ?? { uid: 98001, defId: "jednota", leftLayout: 0, rightLayout: 0 } },
    lokalitaOtocena: false,
    pitkyCelkom: 1,
    pitkaCislo: 1,
    strany: [[c0, lezi("m_c1", EMPTY, R, 0)], [lezi("m_d0", RR, EMPTY, 1), lezi("m_d1", EMPTY, RR, 1)]],
    hraci: [{ ...s0.hraci[0], poldeciPlne: 1, priznane: [] }, { ...s0.hraci[1], priznane: [] }],
    pitkaStav: { naTahu: 0, hotovy: [false, false], naexPouzity: [false, false], fajcenie: [0, 0], reakcia: null, postarka: [false, false], starosta: [false, false] },
  } as GameState;
  return { s, c0 };
}

describe("momenty — rozpoznanie", () => {
  it("Zvrat: NA EX, ktoré otočí víťaza výhľadu, je strieborná pečiatka v prospech toho, kto teraz vyhráva", () => {
    const { s, c0 } = predZvratom();
    const { state, events } = naexOdkryte(data, s, c0.card.uid, 0);
    const m = momenty(data, s, state, events);
    expect(m).toContainEqual(expect.objectContaining({ typ: "zvrat", stupen: "striebro", hrac: 0 }));
  });

  it("Výprask: Nakladačka aspoň 8 je bronzová pečiatka držiteľa; 7 ešte nie", () => {
    const s = setupGame(zaklad, 42);
    const bitka = (prebytok: number): Event => ({ type: "bitkaVysledok", damage: { tuhe: [9, 1], makke: [0, 0], celkove: [9, 1], zvysnaViera: [0, 0], zvysnaPovera: [0, 0] }, sums: [{}, {}], vitaz: 0, rozhodlo: "tuhe", prebytok, prebytokNaRozdelenie: prebytok, prebytokDrzi: 0, karty: [] });
    expect(momenty(zaklad, s, s, [bitka(8)])).toEqual([expect.objectContaining({ typ: "vyprask", stupen: "bronz", hrac: 0 })]);
    expect(momenty(zaklad, s, s, [bitka(7)])).toEqual([]);
  });

  it("Zajatie (v9): hráčovi pribudol väzeň — zlatá pečiatka pre neho", () => {
    const s = setupGame(zaklad, 43);
    const e = s.starsi[0]!;
    const po: GameState = { ...s, starsi: s.starsi.slice(1), vazni: [{ elderId: e.elderId, hrac: 1, poradie: 1, karta: e.karta, scorecard: e.scorecard, miesto: 0 }] };
    expect(momenty(zaklad, s, po, [])).toEqual([expect.objectContaining({ typ: "zajatie", stupen: "zlato", hrac: 1 })]);
  });

  it("v9: marker na krajnej pozícii už prebudenie nehlási", () => {
    const s = setupGame(zaklad, 44);
    const po: GameState = { ...s, starsi: s.starsi.map((e, i) => (i === 0 ? { ...e, marker: 6 as const } : e)) };
    const pred: GameState = { ...s, starsi: s.starsi.map((e, i) => (i === 0 ? { ...e, marker: 5 as const } : e)) };
    expect(momenty(zaklad, pred, po, [])).toEqual([]);
  });

  it("Bitka o všetko (v6): bitka sa začína a na sekere sú špaky aspoň z dvoch bitiek", () => {
    const s = setupGame(zaklad, 45);
    const sekera = (kolo: number): GameState["nastenka"][number] => ({
      kolo, lokalita: null, vitaz: null, rozhodlo: "sekera", pitky: 2, zaBitku: [0, 0], zoSekery: 0, abstakZrazka: 0, prepadlo: 0,
      zaStarsich: [0, 0], exekutor: [0, 0], prebytok: [0, 0], spakyPo: [0, 0],
    });
    const po: GameState = { ...s, faza: "bitka", nastenka: [sekera(1), sekera(2)], spakyNaSekere: 4 };
    expect(momenty(zaklad, { ...s, faza: "pitka" }, po, [])).toEqual([expect.objectContaining({ typ: "bitkaOVsetko" })]);
    expect(momenty(zaklad, { ...s, faza: "pitka" }, { ...po, nastenka: [sekera(2)] }, [])).toEqual([]);
  });
});

describe("momenty — strop", () => {
  const m = (stupen: Moment["stupen"]): Moment => ({ typ: "vyprask", stupen, hrac: 0, nazov: "X", popis: "" });
  it("najviac jedna pečiatka za úsek kola, vyhrá vyšší stupeň; zlato najviac dvakrát za partiu", () => {
    const s = setupGame(zaklad, 46);
    const pitka: GameState = { ...s, faza: "pitka", pitkaCislo: 1 };
    const a = obmedzMomenty([m("bronz"), m("striebro")], NOVE_MOMENTY, pitka);
    expect(a.vybrane.map((x) => x.stupen)).toEqual(["striebro"]);
    expect(obmedzMomenty([m("zlato")], a.stav, pitka).vybrane).toEqual([]);
    let stav: StavMomentov = NOVE_MOMENTY;
    let zlate = 0;
    for (let kolo = 1; kolo <= 5; kolo++) {
      const r = obmedzMomenty([m("zlato")], stav, { ...s, faza: "bitka", kolo });
      stav = r.stav;
      zlate += r.vybrane.length;
    }
    expect(zlate).toBe(ZLATO_ZA_PARTIU);
  });
});

describe("momenty — nič neprezradia", () => {
  it("v celej partii je moment rovnaký, nech má ktorýkoľvek hráč v ruke a balíčku čokoľvek", () => {
    let rng = rngSeed(5);
    let porovnanych = 0;
    const inaRuka = (x: GameState): GameState => ({
      ...x,
      // Počet Absťákov je verejný (v9.1 karta, −1 tuhé za kus) — tie ostávajú.
      hraci: x.hraci.map((h) => ({ ...h, ruka: h.ruka.map((k) => (k.defId === "abstak" ? k : { ...k, defId: "hasic" })), doberaci: [...h.doberaci].reverse() })) as unknown as GameState["hraci"],
      // Skrytá Záverečná: iná karta lícom dole.
      strany: x.strany.map((strana) => strana.map((pl) => (pl.zaverecna === true ? { ...pl, card: { ...pl.card, defId: "svokra" } } : pl))) as unknown as GameState["strany"],
    });
    // Náhodná partia môže skončiť skoro (exekúcia) — preto viac partií.
    for (const seed of [47, 48, 49]) {
      let s = setupGame(zaklad, seed);
      for (let i = 0; i < 4000 && s.koniec === null; i++) {
        const p = naTahu(s);
        if (p === null) break;
        const cmds = legalCommands(zaklad, s, p);
        const [j, r] = rngInt(rng, cmds.length);
        rng = r;
        const { state: po, events } = apply(zaklad, s, cmds[j] as Command, p);
        const m = momenty(zaklad, s, po, events);
        expect(JSON.stringify(momenty(zaklad, inaRuka(s), inaRuka(po), events))).toBe(JSON.stringify(m));
        porovnanych++;
        s = po;
      }
    }
    expect(porovnanych).toBeGreaterThan(200);
  });
});

describe("hlášky Melichara k momentom", () => {
  it("každý moment má náladu pre aj proti, moment bez hráča má pre oboch tú istú", () => {
    for (const typ of Object.keys(MOMENTY) as (keyof typeof MOMENTY)[]) {
      expect(NALADY).toContain(NALADY_MOMENTOV[typ].pre);
      expect(NALADY).toContain(NALADY_MOMENTOV[typ].proti);
    }
    const zvrat: Moment = { typ: "zvrat", ...MOMENTY.zvrat, hrac: 1, popis: "" };
    expect(naladaMomentu(zvrat, 1)).toBe("pohoda");
    expect(naladaMomentu(zvrat, 0)).toBe("smola");
    const vzbura: Moment = { typ: "vzbura", ...MOMENTY.vzbura, hrac: null, popis: "" };
    expect(naladaMomentu(vzbura, 0)).toBe("udiv");
    expect(naladaMomentu(vzbura, 1)).toBe("udiv");
  });
});

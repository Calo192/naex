// Rozhodca pravidiel (prvý prechod 2026-10-22): bitka a koniec hry podľa
// PRAVIDLA.md §1, §2, §8–§11, §14 a §16 — Exekútor a Robota, poradie kroku
// Poldeci, návrat kariet, Absťák a neresti, body za kusy,
// efekty kariet. Očakávané hodnoty sú z textu pravidiel, nie z kódu.

import { describe, expect, it } from "vitest";
// Sada v6 (pred revíziou v7): test stráži pravidlá, ktoré revízia sady nemení.
import cardsJson from "./data/cards-v6.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { BattleSide, BitkaStav, CardDef, CardInstance, Event, GameData, GameState, PitkaStav, PlacedCard, PlayerId, PlayerState } from "../src/index.ts";
import {
  KONSTANTY,
  apply,
  buildGameData,
  computeDamage,
  loadGameData,
  naTahu,
  parseScorecards,
} from "../src/index.ts";
import type { Layout4 } from "./helpers.ts";
import { EMPTY, instanceFor, makeDef } from "./helpers.ts";
import { setupSBalickom } from "./helpers.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

let uidSeq = 890000;
const inst = (defId: string): CardInstance => ({ uid: ++uidSeq, defId, leftLayout: 0, rightLayout: 0 });
const lezi = (card: CardInstance, playedBy: PlayerId, naexBy?: PlayerId): PlacedCard =>
  naexBy === undefined ? { card, playedBy } : { card, playedBy, naexBy };
const kusy = (n: number, defId: string): CardInstance[] => Array.from({ length: n }, () => inst(defId));

function sadaS(...defs: CardDef[]): GameData {
  const cards = new Map(data.cards);
  for (const d of defs) cards.set(d.id, d);
  return buildGameData(cards, data.elders, parseScorecards(scorecardsJson));
}

function sHracom(s: GameState, p: PlayerId, h: Partial<PlayerState>): GameState {
  const hraci = [...s.hraci] as [PlayerState, PlayerState];
  hraci[p] = { ...hraci[p], ...h };
  return { ...s, hraci };
}

function pitkaStav(naTahuHrac: PlayerId): PitkaStav {
  return {
    naTahu: naTahuHrac,
    hotovy: [false, false],
    naexPouzity: [false, false],
    fajcenie: [0, 0],
    reakcia: null,
    postarka: [false, false],
    starosta: [false, false],
    naexPocet: [0, 0],
    vykup: [false, false],
  };
}

/** Pitka (útočník 0, na ťahu obranca 1) — po jej konci začne bitka. */
function vPitke(sada: GameData, seed: number, strany: GameState["strany"]): GameState {
  const s0 = setupSBalickom(sada, seed);
  return { ...s0, faza: "pitka", utocnik: 0, strany, pitkyCelkom: 1, pitkaCislo: 1, pitkaStav: pitkaStav(1) };
}

/** Obaja skončia Pitku bez NA EX; bitka sa rozbehne, kým nečaká na hráča. */
function doBitky(sada: GameData, s: GameState): { state: GameState; events: Event[] } {
  const events: Event[] = [];
  let st = s;
  for (let i = 0; i < 2 && st.faza === "pitka" && st.vizia === null; i++) {
    const r = apply(sada, st, { type: "skipNaex" }, naTahu(st)!);
    st = r.state;
    events.push(...r.events);
  }
  return { state: st, events };
}

function bitka(b: Partial<BitkaStav>): BitkaStav {
  return {
    krok: null,
    caka: null,
    sums: [{}, {}],
    exekutorHotovy: [true, true],
    pohorsenieZostava: [0, 0],
    exekutor: [0, 0],
    damage: null,
    vitaz: 0,
    prebytokDrzi: null,
    prebytokZostava: 0,
    prebytokPosunute: [],
    spalit: [],
    vesticaHotova: true,
    ...b,
  };
}

/** Bitka v kroku Cintorína, čaká sa na hráča 0 — „nič“ ju dokončí a začne ďalšie kolo. */
function predKoncomBitky(seed: number, uprav: (s: GameState) => GameState = (s) => s): GameState {
  const s0 = setupSBalickom(data, seed);
  return uprav({
    ...s0,
    faza: "bitka",
    kolo: 2,
    strany: [[], []],
    ciel: { typ: "lokalita", lokalita: s0.lokalityVHre[0]! },
    lokalityVHre: s0.lokalityVHre.slice(1),
    bitkaStav: bitka({ krok: "cintorin", caka: 0 }),
  });
}

/** Všetky uid v balíčkoch a ruke hráča. */
const zony = (h: PlayerState): number[] => [...h.ruka, ...h.doberaci, ...h.odhadzovaci, ...h.priznane, ...h.dedicstvo].map((k) => k.uid);

// --- §1 Podmienky konca -----------------------------------------------------------

describe("§1 Podmienky konca", () => {
  it("§1/§11 (Michal 2026-10-28): exekúcia bez prahu — každý s priznaným Dlhom stratí polovicu Dlhov nahor a rovnako špakov, aj do mínusu; hráč neprehráva", () => {
    const st = doBitky(data, sHracom(vPitke(data, 41, [[], []]), 0, { dlhy: 5 })).state;
    expect(st.koniec).toBeNull();
    const zaznam = st.nastenka.at(-1)!;
    expect(zaznam.exekutor).toEqual([3, 0]);
    expect(st.hraci[0].dlhy).toBe(2);
    // Prázdna línia 0 : 0 a rovnako Absťákov — remízu vyhrá menej priznaných Dlhov (hráč 2; 0 kariet, aspoň 1 špak).
    expect([zaznam.vitaz, zaznam.rozhodlo]).toEqual([1, "dlhy"]);
    expect(st.spaky).toEqual([-3, 1]);
    // Aj jediný Dlh: zhorí celý a jeden špak.
    const jeden = doBitky(data, sHracom(vPitke(data, 41, [[], []]), 0, { dlhy: 1 })).state;
    expect(jeden.nastenka.at(-1)?.exekutor).toEqual([1, 0]);
    expect(jeden.hraci[0].dlhy).toBe(0);
  });


  it("§11: Robota spáli priznaný Dlh ešte pred exekúciou — 6 Dlhov, Robota 1, exekúcia 3 (polovica z 5 nahor)", () => {
    const vonk: Layout4 = ["Robota", null, null, null];
    const vnut: Layout4 = ["Rana", null, null, null];
    const sada = sadaS(makeDef("r_rob_o", EMPTY, vonk), makeDef("r_rob_i", vnut, EMPTY));
    const strany: GameState["strany"] = [[lezi(instanceFor(sada, "r_rob_i", vnut, EMPTY), 0), lezi(instanceFor(sada, "r_rob_o", EMPTY, vonk), 0)], []];
    const st = doBitky(sada, sHracom(vPitke(sada, 43, strany), 0, { dlhy: 6 })).state;
    expect(st.koniec).toBeNull();
    expect(st.hraci[0].dlhy).toBe(2);
    expect(st.nastenka.at(-1)?.exekutor[0]).toBe(3);
  });

  it("§1 (v5 bod 4): balíček pod 5 kariet na konci kola už neprehráva — ani 1 karta", () => {
    const styri = predKoncomBitky(44, (s) => sHracom(s, 1, { ruka: kusy(4, "pijan"), doberaci: [], odhadzovaci: [] }));
    const po4 = apply(data, styri, { type: "cintorin", uid: null }, 0).state;
    expect(po4.koniec).toBeNull();
    expect(po4.faza).toBe("volbaCiela");
    const jedna = predKoncomBitky(44, (s) => sHracom(s, 1, { ruka: kusy(1, "pijan"), doberaci: [], odhadzovaci: [] }));
    expect(apply(data, jedna, { type: "cintorin", uid: null }, 0).state.koniec).toBeNull();
  });

  it("§1 (v9): vydesenie ako výhra zaniklo — ani 8 z 8 starších na stupni 3 hru neukončí", () => {
    const vydes = (s: GameState): GameState => ({ ...s, starsi: s.starsi.map((e) => ({ ...e, marker: 6 as const })) });
    const po = apply(data, predKoncomBitky(45, vydes), { type: "cintorin", uid: null }, 0).state;
    expect(po.koniec).toBeNull();
  });
});

// --- §2 Akcie a §9.3 Poškodenie -------------------------------------------------------

describe("§2 Akcie — tuhé poškodenie", () => {
  it("§2: Rana 1, Pecka 2, Petelica 3 tuhé", () => {
    const strana = (sums: BattleSide["sums"]): BattleSide => ({ sums, cirhozaBonus: 0, tuheBonus: 0, abstaky: 0, priazenBitkara: 0, hodnotaViery: 1 });
    expect(computeDamage([strana({ Rana: 1, Pecka: 1, Petelica: 1 }), strana({})]).tuhe).toEqual([6, 0]);
    expect(computeDamage([strana({ Petelica: 2 }), strana({ Pecka: 3 })]).tuhe).toEqual([6, 6]);
  });
});

// --- §9.5 Poldeci -------------------------------------------------------------------------

describe("§9.5 Poldeci v bitke", () => {
  it("§9.5: NA EX poldeci sa najprv vypijú, potom akcia Poldeci otočí vypitý na plný; bez vypitého vyjde naprázdno; platí pre majiteľa karty aj na súperovej strane", () => {
    const P: Layout4 = ["Poldeci", null, null, null];
    const C: Layout4 = ["Cigareta", null, null, null];
    const sada = sadaS(makeDef("r_pold", P, P), makeDef("r_cig", C, C));
    const k = (defId: string, l: Layout4, p: PlayerId, naexBy?: PlayerId): PlacedCard => lezi(instanceFor(sada, defId, l, l), p, naexBy);
    // Hráč 0 má pár Poldeci–Cigareta na súperovej strane a NA EX na jeho karte; hráč 1 na strane hráča 0.
    const strany: GameState["strany"] = [
      [k("r_pold", P, 1), k("r_cig", C, 1)],
      [k("r_pold", P, 0), k("r_cig", C, 0, 0)],
    ];
    let s = vPitke(sada, 46, strany);
    // Obom priznaná Cirhóza: bitka je remíza v tuhom (1 : 1) a dobehne do ďalšieho kola
    // (vypitý poldeci sa na začiatku kola nedolieva — žiadny neostal).
    s = sHracom(s, 0, { poldeciPlne: 0, poldeciVypite: 0, priznane: [inst("cirhoza")], nerestiTotoKolo: 0 });
    s = sHracom(s, 1, { poldeciPlne: 1, poldeciVypite: 0, priznane: [inst("cirhoza")] });
    const st = doBitky(sada, s).state;
    expect(st.bitkaStav).toBeNull();
    expect([st.hraci[0].poldeciPlne, st.hraci[0].poldeciVypite]).toEqual([1, 0]);
    expect([st.hraci[1].poldeciPlne, st.hraci[1].poldeciVypite]).toEqual([1, 0]);
    // §8 (v9.1): NA EX je nerest za 2 (poldeci sa vypije v bitke) — Chuť 0 → 2 − 1 = 1.
    expect(st.hraci[0].chut).toBe(KONSTANTY.NEREST_NAEX - KONSTANTY.CHUT_UBYTOK);
    expect(st.hraci[0].nerestiTotoKolo).toBe(0);
  });
});

// --- §9.7 Návrat kariet ------------------------------------------------------------

describe("§9.7 Návrat kariet", () => {

  it("§9.7: karty z línie sa vrátia do odhadzovacieho balíčka hráča, ktorý ich zahral — aj zo súperovej strany", () => {
    const moja = inst("pijan");
    const jeho = inst("pijan");
    const s = predKoncomBitky(49, (x) => ({ ...x, strany: [[lezi(jeho, 1)], [lezi(moja, 0)]] }));
    const po = apply(data, s, { type: "cintorin", uid: null }, 0).state;
    expect(zony(po.hraci[0])).toContain(moja.uid);
    expect(zony(po.hraci[1])).not.toContain(moja.uid);
    expect(zony(po.hraci[1])).toContain(jeho.uid);
    expect(zony(po.hraci[0])).not.toContain(jeho.uid);
  });
});

// --- §14 Bodovanie ------------------------------------------------------------------------------

describe("§14 Koniec hry po finále (v6)", () => {
  /**
   * Finále v kroku Cintorína — „nič“ ho dokončí a hra sa skončí. Bez poldeci
   * a cigariet, aby výkupné nemiešalo čísla (h0/h1 ich smú doplniť).
   */
  const BEZ_ZDROJOV: Partial<PlayerState> = { poldeciPlne: 0, poldeciVypite: 0, cigarety: 0 };
  const poFinale = (spaky: [number, number], h0: Partial<PlayerState> = {}, h1: Partial<PlayerState> = {}): GameState => {
    const s = predKoncomBitky(57, (x) =>
      sHracom(sHracom({ ...x, lokalityVHre: [], ciel: { typ: "finale", lokalita: inst("krcma") }, spaky }, 0, { ...BEZ_ZDROJOV, ...h0 }), 1, { ...BEZ_ZDROJOV, ...h1 }),
    );
    return apply(data, s, { type: "cintorin", uid: null }, 0).state;
  };

  it("§14: vyhrá viac špakov, rovnosť je remíza; ďalšie kolo už nie je", () => {
    expect(poFinale([9, 7]).koniec).toMatchObject({ vitaz: 0, body: [9, 7] });
    expect(poFinale([3, 3]).koniec).toMatchObject({ vitaz: null, body: [3, 3] });
    expect(poFinale([1, 2]).koniec?.vitaz).toBe(1);
  });

  it("§11/§14: nepriznaná Cirhóza na konci −3 špaky za kus (v8; ruka aj oba balíčky), priznaná nie", () => {
    const po = poFinale([12, 8], {
      ruka: [inst("cirhoza"), inst("pijan")],
      doberaci: [inst("cirhoza")],
      odhadzovaci: [inst("cirhoza")],
      priznane: [inst("cirhoza")],
    });
    expect(po.koniec?.cirhozy).toEqual([3, 0]);
    expect(po.koniec?.body).toEqual([12 - 9, 8]);
    expect(po.koniec?.vitaz).toBe(1);
    expect(po.spaky).toEqual([3, 8]);
  });

  it("§14: výkupné — plný poldeci 1 špak, každých celých 5 cigariet 1 špak, bez stropu; vypitý poldeci nič", () => {
    const po = poFinale([4, 10], { poldeciPlne: 3, poldeciVypite: 2, cigarety: 14 }, { poldeciPlne: 0, poldeciVypite: 4, cigarety: 4 });
    expect(po.koniec?.vykupne).toEqual([
      { poldeci: 3, cigarety: 14, spaky: 3 + 2 },
      { poldeci: 0, cigarety: 4, spaky: 0 },
    ]);
    expect(po.koniec?.body).toEqual([9, 10]);
    expect(po.koniec?.vitaz).toBe(1);
    // Bez stropu: 9 plných poldeci a 40 cigariet = 17 špakov.
    expect(poFinale([0, 0], { poldeciPlne: 9, cigarety: 40 }).koniec?.body).toEqual([17, 0]);
  });

  it("§14: výkupné rozhodne aj o víťazovi a ráta sa pred určením víťaza, spolu s Cirhózou", () => {
    const po = poFinale([6, 6], { poldeciPlne: 1, cigarety: 5, ruka: [inst("cirhoza")] }, { cigarety: 9 });
    // Hráč 1: 6 + 1 + 1 − 3 = 5; hráč 2: 6 + 1 = 7.
    expect(po.koniec?.body).toEqual([5, 7]);
    expect(po.koniec?.vitaz).toBe(1);
    const remiza = poFinale([5, 6], { poldeciPlne: 1 });
    expect(remiza.koniec).toMatchObject({ vitaz: null, body: [6, 6] });
  });

  it("§14: výkupné je len po finále — po bitke o lokalitu sa zdroje nevykupujú", () => {
    const s = predKoncomBitky(57, (x) => sHracom({ ...x, spaky: [2, 2] }, 0, { poldeciPlne: 4, cigarety: 10 }));
    const po = apply(data, s, { type: "cintorin", uid: null }, 0).state;
    expect(po.koniec).toBeNull();
    expect(po.hraci[0].poldeciPlne).toBeGreaterThanOrEqual(4);
  });
});

// §8 Chuť a Absťák (v9.1) stráži abstak-chut.test.ts.

/// --- §10 Prebudenie a §14 Kategórie ------------------------------------------------------------

describe("§10 Prebudenie a §14 finále", () => {

  it("§14 (v8): sada bez pinnacle lokalít (testovacia sada v6) finále nemá — po poslednej lokalite hra skončí, bez lokality sa nehrá", () => {
    const s = predKoncomBitky(57, (x) => ({ ...x, lokalityVHre: [] }));
    const po = apply(data, s, { type: "cintorin", uid: null }, 0).state;
    expect(po.koniec?.body).not.toBeNull();
    expect(po.koniec?.dovod).toMatch(/^Odohrali sa všetky lokality/);
    expect(po.ciel).toBeNull();
  });
});

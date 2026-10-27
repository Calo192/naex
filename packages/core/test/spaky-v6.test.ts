// Pravidlá v6 „Špaky“ (Michal 2026-10-26, docs/napady/spaky.html): víťazné
// body sú špaky — za bitku (odohrané Pitky), za starších po každej bitke,
// finále bez lokality, Exekútor, Cirhóza na konci; karty v6 (Kultúrny dom K1,
// Noviny, Záhradkár). Očakávané hodnoty sú z pravidla, nie z kódu.

import { describe, expect, it } from "vitest";
// Sada v6 (pred revíziou v7): test stráži pravidlá, ktoré revízia sady nemení.
import cardsJson from "./data/cards-v6.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { BitkaStav, CardInstance, ElderState, GameState, MarkerPos, PlayerId } from "../src/index.ts";
import {
  KONSTANTY,
  apply,
  evaluateLine,
  legalCommands,
  loadGameData,
  naTahu,
  pocetPitiek,
  setupGame,
  spakyTeraz,
  vyplatZaStarsich,
  viewFor,
} from "../src/index.ts";
import type { Layout4 } from "./helpers.ts";
import { EMPTY, instanceFor, makeDef, syntheticData } from "./helpers.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

let uidSeq = 660000;
const inst = (defId: string): CardInstance => ({ uid: ++uidSeq, defId, leftLayout: 0, rightLayout: 0 });

function bitka(b: Partial<BitkaStav>): BitkaStav {
  return {
    krok: null,
    caka: null,
    sums: [{}, {}],
    exekutorHotovy: [true, true],
    exekutor: [0, 0],
    pohorsenieZostava: [0, 0],
    damage: null,
    vitaz: null,
    prebytokDrzi: null,
    prebytokZostava: 0,
    prebytokPosunute: [],
    pohrebHotovy: [true, true],
    benzinkaZostava: [0, 0],
    karHotovy: [true, true],
    spalit: [],
    vesticaHotova: true,
    ...b,
  };
}

/**
 * Bitka čaká na posledné Pohoršenie hráča 0 (útočník 1); potom sa poškodenie
 * vyhodnotí zo súčtov `sums` a bitka sa dohrá sama. Všetci starší v strede.
 */
function predPoskodenim(o: {
  seed?: number;
  ciel: GameState["ciel"];
  lokalityVHre?: readonly CardInstance[];
  sums: BitkaStav["sums"];
  pitky?: number;
  uprav?: (s: GameState) => GameState;
}): GameState {
  const s0 = setupGame(data, o.seed ?? 5);
  const s: GameState = {
    ...s0,
    faza: "bitka",
    kolo: 3,
    utocnik: 1,
    strany: [[], []],
    ciel: o.ciel,
    lokalityVHre: o.lokalityVHre ?? s0.lokalityVHre.slice(1),
    pitkaCislo: o.pitky ?? 2,
    pitkyCelkom: o.pitky ?? 2,
    starsi: s0.starsi.map((e) => ({ ...e, marker: 3 as MarkerPos })),
    bitkaStav: bitka({ krok: "pohorsenie", caka: 0, pohorsenieZostava: [1, 0], sums: o.sums }),
  };
  return o.uprav === undefined ? s : o.uprav(s);
}

const lokalita = (s: GameState, defId: string): GameState["ciel"] => ({
  typ: "lokalita",
  lokalita: s.lokalityVHre.find((k) => k.defId === defId) ?? inst(defId),
});
const FINALE: GameState["ciel"] = { typ: "finale", lokalita: null };

/** Posledné Pohoršenie hráča 0 na prvého staršieho k súperovi (k hráčovi 1) — strach z hráča 0. */
const pohorsenie = (s: GameState) => apply(data, s, { type: "pohorsenie", elderId: s.starsi[0]!.elderId }, 0);

describe("v6 bod 1–5: špaky za bitku a za starších, poradie bitky", () => {
  const s0 = setupGame(data, 5);

  it("víťaz dostane odohrané Pitky; Pohoršenie sa ráta už do špakov za starších tejto bitky; lokalitu si neberie", () => {
    const s = predPoskodenim({ ciel: lokalita(s0, "krcma"), sums: [{ Rana: 5 }, {}], pitky: 2 });
    const { state, events } = pohorsenie(s);
    const zaznam = state.nastenka.at(-1)!;
    expect(zaznam).toMatchObject({ vitaz: 0, rozhodlo: "tuhe", pitky: 2, zaBitku: [2, 0], zaStarsich: [1, 0], zoSekery: 0 });
    expect(zaznam.lokalita?.defId).toBe("krcma");
    // Prebytok 5 posunie markery až po špakoch — v tejto bitke už nič nedá.
    expect(state.bitkaStav?.krok).toBe("prebytok");
    expect(state.spaky).toEqual([3, 0]);
    // Rekapitulácia bitky nesie špaky (v6).
    const v = events.find((e) => e.type === "bitkaVysledok");
    expect(v?.type === "bitkaVysledok" ? v.rekap?.spaky?.zaBitku : null).toEqual([2, 0]);
  });

  it("Absťák: víťaz s viac Absťákmi dostane o rozdiel menej, aspoň 1", () => {
    const s = predPoskodenim({
      ciel: lokalita(s0, "krcma"),
      sums: [{ Rana: 9 }, {}],
      pitky: 3,
      uprav: (t) => ({ ...t, hraci: [{ ...t.hraci[0], priznane: [inst("abstak"), inst("abstak")] }, t.hraci[1]] }),
    });
    const zaznam = pohorsenie(s).state.nastenka.at(-1)!;
    expect(zaznam).toMatchObject({ vitaz: 0, zaBitku: [1, 0], abstakZrazka: 2 });
  });

  it("sekera: remíza v tuhom, Absťákoch aj Dlhoch — špaky kola čakajú, vezme ich víťaz ďalšej bitky", () => {
    const remiza = pohorsenie(predPoskodenim({ ciel: lokalita(s0, "krcma"), sums: [{}, {}], pitky: 2 })).state;
    expect(remiza.nastenka.at(-1)).toMatchObject({ vitaz: null, rozhodlo: "sekera", zaBitku: [0, 0] });
    expect(remiza.spakyNaSekere).toBe(2);
    const vyhra = pohorsenie(predPoskodenim({ ciel: lokalita(s0, "jednota"), sums: [{}, { Rana: 4 }], pitky: 1, uprav: (t) => ({ ...t, spakyNaSekere: 2 }) })).state;
    expect(vyhra.nastenka.at(-1)).toMatchObject({ vitaz: 1, zaBitku: [0, 3], zoSekery: 2 });
    expect(vyhra.spakyNaSekere).toBe(0);
  });

  it("bod 4: starší dá obávanému 1 / 2 / 3 podľa zóny; sivý nikomu — v6.1 len víťazovi", () => {
    const s = predPoskodenim({
      ciel: lokalita(s0, "krcma"),
      sums: [{}, { Rana: 1 }],
      uprav: (t) => ({ ...t, starsi: t.starsi.map((e, i) => ({ ...e, marker: ([3, 5, 6, 1, 3, 3, 3, 3] as const)[i] as MarkerPos })) }),
    });
    // Pohoršenie hráča 0 posunie prvého staršieho 3 → 4 (žltá, strach z hráča 0).
    // Bitku vyhral hráč 1 — porazený hráč 0 za svojich 1 + 2 + 3 nedostane nič (v6.1).
    const zaznam = pohorsenie(s).state.nastenka.at(-1)!;
    expect(zaznam.zaStarsich).toEqual([0, 2]);
  });
});

describe("v6 karty: Kultúrny dom, Noviny", () => {
  const s0 = setupGame(data, 5);

  it("Kultúrny dom (K1): prebytok sa nerozdeľuje, držiteľ dostane toľko špakov", () => {
    const s = predPoskodenim({ ciel: lokalita(s0, "kulturny_dom"), sums: [{ Rana: 5 }, {}], pitky: 2 });
    const st = pohorsenie(s).state;
    expect(st.nastenka.at(-1)).toMatchObject({ zaBitku: [2, 0], zaStarsich: [1, 0], prebytok: [5, 0] });
    expect(st.spaky).toEqual([8, 0]);
    // Markery sa prebytkom nepohli a bitka sa dohrala do ďalšieho kola.
    expect(st.faza).toBe("volbaCiela");
    expect(st.starsi.filter((e) => e.marker !== 3)).toHaveLength(1);
  });

  it("Noviny: 1 špak navyše, keď sa hráča bojí viac starších ako súpera (počet starších, nie zón) — v6.1 len víťazovi, pri sekere obom", () => {
    const sNovinami = (markery: readonly number[], sums: BitkaStav["sums"] = [{ Rana: 5 }, {}]) =>
      predPoskodenim({
        ciel: lokalita(s0, "krcma"),
        sums,
        uprav: (t) => ({
          ...t,
          hraci: [{ ...t.hraci[0], dedicstvo: [inst("noviny")] }, t.hraci[1]],
          starsi: t.starsi.map((e, i) => ({ ...e, marker: (markery[i] ?? 3) as MarkerPos })),
        }),
      });
    // Hráča 0 sa boja dvaja (prvý po Pohoršení 3 → 4 a druhý), hráča 1 jeden — aj keď v červenej.
    // Hráč 0 vyhral: 1 + 1 za starších a Noviny +1; porazený hráč 1 nič.
    expect(pohorsenie(sNovinami([3, 4, 0])).state.nastenka.at(-1)?.zaStarsich).toEqual([1 + 1 + 1, 0]);
    // Rovnako starších (1 : 1) — nič navyše.
    expect(pohorsenie(sNovinami([3, 3, 0])).state.nastenka.at(-1)?.zaStarsich).toEqual([1, 0]);
    // Hráč 0 prehral: za starších nič a ani Noviny (Michal 2026-10-27).
    expect(pohorsenie(sNovinami([3, 4, 0], [{}, { Rana: 5 }])).state.nastenka.at(-1)?.zaStarsich).toEqual([0, 3]);
    // Sekera: obaja za starších, Noviny tiež.
    expect(pohorsenie(sNovinami([3, 4, 0], [{}, {}])).state.nastenka.at(-1)?.zaStarsich).toEqual([1 + 1 + 1, 3]);
  });
});

describe("v6 bod 11: finále", () => {
  /** Bitka o poslednú lokalitu v kroku Pohrebu — skipPohreb ju dokončí a začne finále. */
  function predFinale(spaky: readonly [number, number], vitaz: PlayerId | null, utocnik: PlayerId): GameState {
    const s0 = setupGame(data, 9);
    return {
      ...s0,
      faza: "bitka",
      kolo: 3,
      utocnik,
      spaky,
      ciel: { typ: "lokalita", lokalita: s0.lokalityVHre[0]! },
      lokalityVHre: [],
      bitkaStav: bitka({ krok: "pohreb", caka: 0, pohrebHotovy: [false, true], vitaz }),
    };
  }
  const poBitke = (s: GameState): GameState => apply(data, s, { type: "skipPohreb" }, 0).state;

  it("po poslednej lokalite príde finále: bez lokality, rovno šenok, útočí viac špakov", () => {
    const s = poBitke(predFinale([5, 3], 1, 1));
    expect(s.koniec).toBeNull();
    expect(s.ciel).toEqual({ typ: "finale", lokalita: null });
    expect(s.faza).toBe("draft");
    expect(s.kolo).toBe(4);
    expect(s.utocnik).toBe(0);
    expect(viewFor(data, s, 1).ciel?.typ).toBe("finale");
  });

  it("pri rovnosti špakov útočí porazený poslednej bitky; po sekere ostáva útočník (Leader 2026-10-26)", () => {
    expect(poBitke(predFinale([4, 4], 1, 1)).utocnik).toBe(0);
    expect(poBitke(predFinale([4, 4], 0, 0)).utocnik).toBe(1);
    expect(poBitke(predFinale([4, 4], null, 1)).utocnik).toBe(1);
    expect(poBitke(predFinale([4, 4], null, 0)).utocnik).toBe(0);
  });

  it("vždy 3 Pitky; prvá karta je stred línie a susedí s oboma stranami, kraje nie sú", () => {
    const R: Layout4 = ["Rana", null, null, null];
    const RK: Layout4 = [null, null, null, "Rana"];
    const sada = syntheticData([makeDef("f_a", RK, RK, { tags: ["Občan"] }), makeDef("f_b", R, R, { tags: ["Občan"] })]);
    const a = instanceFor(sada, "f_a", RK, RK);
    const b = instanceFor(sada, "f_b", R, R);
    const strany: GameState["strany"] = [[{ card: a, playedBy: 0 }], [{ card: b, playedBy: 1 }]];
    // Bez finále sú strany dva úseky — prvé karty spolu nesusedia.
    expect(evaluateLine(sada, { lokalita: null, lokalitaOtocena: false, strany }).sums).toEqual([{}, {}]);
    // Vo finále spoj vznikne (Rana hráča 0 aj hráča 1).
    expect(evaluateLine(sada, { lokalita: null, lokalitaOtocena: false, strany, finale: true }).sums).toEqual([{ Rana: 1 }, { Rana: 1 }]);
    const s = { ...setupGame(data, 3), ciel: FINALE, strany: [[], []] as GameState["strany"] };
    expect(pocetPitiek(data, s)).toBe(KONSTANTY.FINALE_PITKY);
  });

  it("útočník vyloží prvú kartu do stredu; obranca sa prikladá k nej", () => {
    let s = poBitke(predFinale([5, 3], 1, 1));
    // Šenok a patronát preskočí — každý len končí.
    for (let i = 0; i < 40 && s.faza === "draft"; i++) {
      const p = naTahu(s)!;
      const cmds = legalCommands(data, s, p);
      const c = cmds.find((x) => x.type === "draftStop" || x.type === "bezPatronatu") ?? cmds[0]!;
      s = apply(data, s, c, p).state;
    }
    expect(s.faza).toBe("zhromazdenie");
    expect(naTahu(s)).toBe(0);
    expect(s.pitkyCelkom).toBe(KONSTANTY.FINALE_PITKY);
    const prva = s.hraci[0].ruka.find((k) => k.defId === "pijan")!;
    s = apply(data, s, { type: "place", uid: prva.uid, target: "vlastna" }, 0).state;
    expect(s.strany[0][0]?.card.uid).toBe(prva.uid);
  });

  it("po finále: špaky za bitku (3 Pitky) a za starších, prebytok sa nerozdeľuje — držiteľ dostane špaky; potom koniec", () => {
    const s = predPoskodenim({ ciel: FINALE, lokalityVHre: [], sums: [{ Rana: 5 }, {}], pitky: 3 });
    expect(vyplatZaStarsich(s)).toBe(1);
    const st = pohorsenie(s).state;
    expect(st.nastenka.at(-1)).toMatchObject({ lokalita: null, vitaz: 0, zaBitku: [3, 0], zaStarsich: [1, 0], prebytok: [5, 0] });
    // Obaja majú zo začiatku 2 plné poldeci a 3 cigarety: výkupné +2 každému (2026-10-27).
    expect(st.koniec).toMatchObject({ vitaz: 0, body: [9 + 2, 0 + 2] });
    expect(spakyTeraz(viewFor(data, st, 1)).spolu).toEqual([11, 2]);
  });

  it("sekera vo finále: špaky kola aj zo sekery prepadnú", () => {
    const s = predPoskodenim({ ciel: FINALE, lokalityVHre: [], sums: [{}, {}], pitky: 3, uprav: (t) => ({ ...t, spakyNaSekere: 2, spaky: [4, 4] }) });
    const st = pohorsenie(s).state;
    expect(st.nastenka.at(-1)).toMatchObject({ vitaz: null, prepadlo: 5, zaBitku: [0, 0] });
    expect(st.koniec).toMatchObject({ vitaz: 0, body: [5 + 2, 4 + 2] });
  });
});

describe("v6.1 (Michal 2026-10-27): strach platí len víťazovi bitky", () => {
  const s0 = setupGame(data, 5);
  // Prvý starší po Pohoršení hráča 0 v žltej (bojí sa hráča 0), druhý v oranžovej na polovici
  // hráča 1 (bojí sa hráča 0), tretí v oranžovej na polovici hráča 0 (bojí sa hráča 1).
  const markery = (t: GameState): GameState => ({ ...t, starsi: t.starsi.map((e, i) => ({ ...e, marker: ([3, 5, 1, 3, 3, 3, 3, 3] as const)[i] as MarkerPos })) });
  const po = (ciel: GameState["ciel"], sums: BitkaStav["sums"], lokalityVHre?: readonly CardInstance[]) =>
    pohorsenie(predPoskodenim({ ciel, sums, uprav: markery, ...(lokalityVHre === undefined ? {} : { lokalityVHre, pitky: 3 }) })).state;

  it("víťaz dostane svojich starších, porazený za starších nič", () => {
    expect(po(lokalita(s0, "krcma"), [{ Rana: 5 }, {}]).nastenka.at(-1)).toMatchObject({ vitaz: 0, zaBitku: [2, 0], zaStarsich: [1 + 2, 0] });
    expect(po(lokalita(s0, "krcma"), [{}, { Rana: 5 }]).nastenka.at(-1)).toMatchObject({ vitaz: 1, zaBitku: [0, 2], zaStarsich: [0, 2] });
  });

  it("pri sekere (špaky za bitku idú na sekeru) dostanú za starších obaja", () => {
    const st = po(lokalita(s0, "krcma"), [{}, {}]);
    expect(st.nastenka.at(-1)).toMatchObject({ vitaz: null, rozhodlo: "sekera", zaStarsich: [3, 2] });
    expect(st.spaky).toEqual([3, 2]);
  });

  it("finále: strach len víťazovi, pri sekere obom", () => {
    expect(po(FINALE, [{}, { Rana: 5 }], []).nastenka.at(-1)).toMatchObject({ vitaz: 1, zaBitku: [0, 3], zaStarsich: [0, 2] });
    expect(po(FINALE, [{}, {}], []).nastenka.at(-1)).toMatchObject({ vitaz: null, zaStarsich: [3, 2] });
  });
});

describe("v6: špaky sú verejné", () => {
  it("pohľad oboch hráčov nesie špaky, sekeru, nástenku a priazeň staršieho bez scorecardu", () => {
    const s0 = setupGame(data, 5);
    const s: GameState = { ...s0, spaky: [3, -2], spakyNaSekere: 1 };
    for (const p of [0, 1] as const) {
      const v = viewFor(data, s, p);
      expect(v.spaky).toEqual([3, -2]);
      expect(v.spakyNaSekere).toBe(1);
      expect(v.nastenka).toEqual([]);
      for (const e of v.starsi) expect(e.priazen).toBe(data.scorecards.find((x) => x.id === e.scorecard)?.favour);
    }
  });

  it("výkupné (2026-10-27) je verejné: obaja vidia rovnaké plné poldeci, cigarety a špaky z nich", () => {
    const s0 = setupGame(data, 5);
    const s: GameState = { ...s0, spaky: [4, 1], hraci: [{ ...s0.hraci[0], poldeciPlne: 3, poldeciVypite: 1, cigarety: 11 }, { ...s0.hraci[1], poldeciPlne: 0, cigarety: 5 }] };
    const ocakavane = [
      { poldeci: 3, cigarety: 11, spaky: 3 + 2 },
      { poldeci: 0, cigarety: 5, spaky: 1 },
    ];
    for (const p of [0, 1] as const) {
      const v = viewFor(data, s, p);
      expect([v.hraci[0].poldeciPlne, v.hraci[0].cigarety, v.hraci[1].poldeciPlne, v.hraci[1].cigarety]).toEqual([3, 11, 0, 5]);
      const t = spakyTeraz(v);
      expect(t.vykupne).toEqual(ocakavane);
      expect(t.spolu).toEqual([4 + 5, 1 + 1]);
    }
  });

  it("výkupné neprezradí skryté NA EX: vlastný poldeci pod ním sa nevykúpi, súper rozdiel nevidí", () => {
    const s0 = setupGame(data, 5);
    const pitka = {
      naTahu: 1 as const,
      hotovy: [false, false] as const,
      naexPouzity: [false, false] as const,
      fajcenie: [0, 0] as const,
      reakcia: null,
      postarka: [false, false] as const,
      starosta: [false, false] as const,
      naexPocet: [0, 0] as const,
      vykup: [false, false] as const,
    };
    const bez: GameState = { ...s0, faza: "pitka", pitkaStav: pitka };
    const s: GameState = { ...bez, pitkaStav: { ...pitka, skryteNaex: [{ hrac: 0, uid: 999001 }] } };
    expect(spakyTeraz(viewFor(data, s, 0)).vykupne[0]).toEqual({ poldeci: 1, cigarety: 3, spaky: 1 });
    expect(spakyTeraz(viewFor(data, s, 1))).toEqual(spakyTeraz(viewFor(data, bez, 1)));
    expect(spakyTeraz(viewFor(data, s, 1)).vykupne[0]).toEqual({ poldeci: 2, cigarety: 3, spaky: 2 });
  });

  it("odhad špakov: strach × výplaty, ktoré ešte prídu (lokality + finále)", () => {
    const s0 = setupGame(data, 5, { lokalit: 3 });
    const starsi: ElderState[] = s0.starsi.map((e, i) => ({ ...e, marker: (i === 0 ? 6 : 3) as MarkerPos }));
    const t = spakyTeraz(viewFor(data, { ...s0, starsi }, 0));
    expect(t.vyplat).toBe(4);
    expect(t.zaStarsich).toEqual([3, 0]);
    // Odhad aj s výkupným zo začiatku hry: 2 plné poldeci, 3 cigarety = 2 špaky.
    expect(t.vykupne).toEqual([
      { poldeci: 2, cigarety: 3, spaky: 2 },
      { poldeci: 2, cigarety: 3, spaky: 2 },
    ]);
    expect(t.odhad).toEqual([12 + 2, 0 + 2]);
  });
});

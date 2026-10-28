// Pravidlá v6 „Špaky“ (Michal 2026-10-26, docs/napady/spaky.html) v znení v8
// (Michal 2026-10-28): víťazné body sú špaky — za bitku (karty v línii), za
// starších nové zóny po vyhratej bitke, Exekútor, Cirhóza na konci; Kultúrny dom
// „Obaja bodujú“. Očakávané hodnoty sú z pravidla, nie z kódu.

import { describe, expect, it } from "vitest";
// Sada v6 (pred revíziou v7): test stráži pravidlá, ktoré revízia sady nemení.
import cardsJson from "./data/cards-v6.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { BitkaStav, CardInstance, ElderState, GameState, MarkerPos, PlayerId } from "../src/index.ts";
import {
  apply,
  eventsFor,
  loadGameData,
  setupGame,
  spakyTeraz,
  vyplatZaStarsich,
  viewFor,
} from "../src/index.ts";

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
  /** Koľko kariet má ktorý hráč v línii (na svojej strane) — špaky za bitku (v8). */
  karty?: readonly [number, number];
  uprav?: (s: GameState) => GameState;
}): GameState {
  const s0 = setupGame(data, o.seed ?? 5);
  const [k0, k1] = o.karty ?? [1, 1];
  const s: GameState = {
    ...s0,
    faza: "bitka",
    kolo: 3,
    utocnik: 1,
    strany: [Array.from({ length: k0 }, () => ({ card: inst("pijan"), playedBy: 0 as const })), Array.from({ length: k1 }, () => ({ card: inst("pijan"), playedBy: 1 as const }))],
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
const FINALE: GameState["ciel"] = { typ: "finale", lokalita: inst("krcma") };

/** Posledné Pohoršenie hráča 0 na prvého staršieho k súperovi (k hráčovi 1) — strach z hráča 0. */
const pohorsenie = (s: GameState) => apply(data, s, { type: "pohorsenie", elderId: s.starsi[0]!.elderId }, 0);

describe("v6 bod 1–5: špaky za bitku a za starších, poradie bitky", () => {
  const s0 = setupGame(data, 5);

  it("víťaz dostane 1 špak za každú kartu v línii na oboch stranách (v8), nie za Pitky; Pohoršenie sa ráta už do špakov za starších tejto bitky; lokalitu si neberie", () => {
    const s = predPoskodenim({ ciel: lokalita(s0, "krcma"), sums: [{ Rana: 5 }, {}], pitky: 4, karty: [1, 1] });
    const { state, events } = pohorsenie(s);
    const zaznam = state.nastenka.at(-1)!;
    expect(zaznam).toMatchObject({ vitaz: 0, rozhodlo: "tuhe", pitky: 4, karty: 2, zaBitku: [2, 0], zaStarsich: [1, 0], zoSekery: 0 });
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
      karty: [2, 1],
      uprav: (t) => ({ ...t, hraci: [{ ...t.hraci[0], priznane: [inst("abstak"), inst("abstak")] }, t.hraci[1]] }),
    });
    const zaznam = pohorsenie(s).state.nastenka.at(-1)!;
    expect(zaznam).toMatchObject({ vitaz: 0, zaBitku: [1, 0], abstakZrazka: 2 });
  });

  it("sekera: remíza v tuhom, Absťákoch aj Dlhoch — špaky kola čakajú, vezme ich víťaz ďalšej bitky", () => {
    const remiza = pohorsenie(predPoskodenim({ ciel: lokalita(s0, "krcma"), sums: [{}, {}], karty: [1, 1] })).state;
    expect(remiza.nastenka.at(-1)).toMatchObject({ vitaz: null, rozhodlo: "sekera", zaBitku: [0, 0] });
    expect(remiza.spakyNaSekere).toBe(2);
    const vyhra = pohorsenie(predPoskodenim({ ciel: lokalita(s0, "jednota"), sums: [{}, { Rana: 4 }], karty: [0, 1], uprav: (t) => ({ ...t, spakyNaSekere: 2 }) })).state;
    expect(vyhra.nastenka.at(-1)).toMatchObject({ vitaz: 1, zaBitku: [0, 3], zoSekery: 2 });
    expect(vyhra.spakyNaSekere).toBe(0);
  });

  it("bod 4: starší dá obávanému nevyplatené zóny (v8: oranžová = 1 + 2); sivý nikomu — v6.1 len víťazovi", () => {
    const s = predPoskodenim({
      ciel: lokalita(s0, "krcma"),
      sums: [{}, { Rana: 1 }],
      uprav: (t) => ({ ...t, starsi: t.starsi.map((e, i) => ({ ...e, marker: ([3, 5, 6, 1, 3, 3, 3, 3] as const)[i] as MarkerPos })) }),
    });
    // Pohoršenie hráča 0 posunie prvého staršieho 3 → 4 (žltá, strach z hráča 0).
    // Bitku vyhral hráč 1 — porazený hráč 0 za svojich nedostane nič (v6.1). Hráčovi 1
    // ešte nikto nič nezaplatil: oranžová = žltá 1 + oranžová 2 (v8).
    const st = pohorsenie(s).state;
    expect(st.nastenka.at(-1)!.zaStarsich).toEqual([0, 3]);
    expect(st.starsi[3]?.vyplatene).toBe(2);
    // Porazený nič nedostal, preto mu ani nič nie je vyplatené.
    expect(st.starsi[2]?.vyplatene).toBeUndefined();
  });
});

describe("v8: Kultúrny dom „Obaja bodujú“ (návrh #29)", () => {
  const s0 = setupGame(data, 5);

  it("víťaz dostane špaky za všetky karty v línii, porazený za svoje; prebytok sa rozdeľuje ako inde (porazený)", () => {
    const s = predPoskodenim({ ciel: lokalita(s0, "kulturny_dom"), sums: [{ Rana: 5 }, {}], karty: [2, 3] });
    const { state: st, events } = pohorsenie(s);
    expect(st.nastenka.at(-1)).toMatchObject({ vitaz: 0, karty: 5, zaBitku: [5, 3], zaStarsich: [1, 0], prebytok: [0, 0] });
    expect(st.spaky).toEqual([6, 3]);
    expect(events.some((e) => e.type === "log" && e.text.startsWith("Kultúrny dom: aj porazený hráč 2 dostáva 3 špaky"))).toBe(true);
    // Prebytok 5 sa nemení na špaky — rozdeľuje ho porazený.
    expect(st.bitkaStav).toMatchObject({ krok: "prebytok", caka: 1, prebytokDrzi: 0, prebytokZostava: 5 });
  });

  it("pri sekere na Kultúrnom dome nikto nie je porazený — karty idú na sekeru ako inde", () => {
    const st = pohorsenie(predPoskodenim({ ciel: lokalita(s0, "kulturny_dom"), sums: [{}, {}], karty: [2, 3] })).state;
    expect(st.nastenka.at(-1)).toMatchObject({ vitaz: null, zaBitku: [0, 0] });
    expect(st.spakyNaSekere).toBe(5);
  });
});

describe("finále (v8): karty v línii, prebytok rozdelí držiteľ a strach za nové zóny sa vyplatí hneď", () => {
  it("po finále: špaky za karty a za starších; prebytok rozdelí držiteľ, nové zóny sa vyplatia ešte po finále; potom koniec", () => {
    const s = predPoskodenim({ ciel: FINALE, lokalityVHre: [], sums: [{ Rana: 5 }, {}], karty: [2, 1] });
    expect(vyplatZaStarsich(s)).toBe(1);
    let st = pohorsenie(s).state;
    expect(st.nastenka.at(-1)).toMatchObject({ vitaz: 0, finale: true, zaBitku: [3, 0], zaStarsich: [1, 0], prebytok: [0, 0] });
    // Vo finále rozdeľuje držiteľ prebytku (porazenému sú priazne na nič) a doplatok strachu ešte príde.
    expect(st.bitkaStav).toMatchObject({ krok: "prebytok", caka: 0, prebytokZostava: 5 });
    expect(vyplatZaStarsich(st)).toBe(1);
    // Prvý starší (žltá, vyplatená) ďalej: oranžová 2 a červená 3; traja ďalší do žltej po 1.
    for (const i of [0, 0, 1, 2, 3]) st = apply(data, st, { type: "prebytok", elderId: st.starsi[i]!.elderId }, 0).state;
    expect(st.nastenka.at(-1)).toMatchObject({ zaStarsich: [1 + 2 + 3 + 1 + 1 + 1, 0], prebytok: [0, 0] });
    // 4 + 8 špakov; výkupné: 2 poldeci každému, hráč 2 má 3 + 4 cigarety za posunutých starších (1 špak).
    expect(st.koniec).toMatchObject({ vitaz: 0, body: [12 + 2, 0 + 3] });
    expect(spakyTeraz(viewFor(data, st, 1)).spolu).toEqual([14, 3]);
  });

  it("sekera vo finále: špaky kola aj zo sekery prepadnú", () => {
    const s = predPoskodenim({ ciel: FINALE, lokalityVHre: [], sums: [{}, {}], karty: [2, 1], uprav: (t) => ({ ...t, spakyNaSekere: 2, spaky: [4, 4] }) });
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
    pohorsenie(predPoskodenim({ ciel, sums, uprav: markery, ...(lokalityVHre === undefined ? {} : { lokalityVHre, karty: [2, 1] as const }) })).state;

  it("víťaz dostane svojich starších (v8 nevyplatené zóny), porazený za starších nič", () => {
    expect(po(lokalita(s0, "krcma"), [{ Rana: 5 }, {}]).nastenka.at(-1)).toMatchObject({ vitaz: 0, zaBitku: [2, 0], zaStarsich: [1 + 3, 0] });
    expect(po(lokalita(s0, "krcma"), [{}, { Rana: 5 }]).nastenka.at(-1)).toMatchObject({ vitaz: 1, zaBitku: [0, 2], zaStarsich: [0, 3] });
  });

  it("pri sekere (špaky za bitku idú na sekeru) dostanú za starších obaja", () => {
    const st = po(lokalita(s0, "krcma"), [{}, {}]);
    expect(st.nastenka.at(-1)).toMatchObject({ vitaz: null, rozhodlo: "sekera", zaStarsich: [4, 3] });
    expect(st.spaky).toEqual([4, 3]);
  });

  it("rozpis za starších (Michal 2026-10-27): koľko dal ktorý starší, súčet = zaStarsich; pri sekere obom", () => {
    const s = setupGame(data, 5);
    const id = (i: number) => s.starsi[i]!.elderId;
    const def = (i: number) => s.starsi[i]!.karta.defId;
    const vyhra = po(lokalita(s0, "krcma"), [{ Rana: 5 }, {}]).nastenka.at(-1)!;
    expect(vyhra.zaStarsichRozpis).toEqual([
      [
        { elderId: id(0), defId: def(0), spaky: 1 },
        { elderId: id(1), defId: def(1), spaky: 3 },
      ],
      [],
    ]);
    const sekera = po(lokalita(s0, "krcma"), [{}, {}]).nastenka.at(-1)!;
    expect(sekera.zaStarsichRozpis?.[1]).toEqual([{ elderId: id(2), defId: def(2), spaky: 3 }]);
    for (const p of [0, 1] as const) expect(sekera.zaStarsichRozpis?.[p].reduce((a, x) => a + x.spaky, 0)).toBe(sekera.zaStarsich[p]);
  });

  it("rozpis za starších je v udalosti bitky aj na nástenke a obaja hráči ho vidia rovnako", () => {
    const { state, events } = pohorsenie(predPoskodenim({ ciel: lokalita(s0, "krcma"), sums: [{}, {}], uprav: markery }));
    const zaznam = state.nastenka.at(-1)!;
    for (const p of [0, 1] as const) {
      const bitka = eventsFor(events, p).find((e) => e.type === "bitkaVysledok");
      expect(bitka?.type === "bitkaVysledok" ? bitka.rekap?.spaky?.zaStarsichRozpis : undefined).toEqual(zaznam.zaStarsichRozpis);
      expect(viewFor(data, state, p).nastenka.at(-1)?.zaStarsichRozpis).toEqual(zaznam.zaStarsichRozpis);
    }
    // Rozpis nesie len id staršieho, kartu na ukazovateli (verejná) a číslo — nič zo skrytých zón.
    const kluce = new Set(zaznam.zaStarsichRozpis!.flat().flatMap((x) => Object.keys(x)));
    expect([...kluce].sort()).toEqual(["defId", "elderId", "spaky"]);
    const verejneKarty = new Set(state.starsi.map((e) => e.karta.defId));
    for (const x of zaznam.zaStarsichRozpis!.flat()) expect(verejneKarty.has(x.defId)).toBe(true);
  });

  it("finále: strach len víťazovi, pri sekere obom", () => {
    expect(po(FINALE, [{}, { Rana: 5 }], []).nastenka.at(-1)).toMatchObject({ vitaz: 1, zaBitku: [0, 3], zaStarsich: [0, 3] });
    expect(po(FINALE, [{}, {}], []).nastenka.at(-1)).toMatchObject({ vitaz: null, zaStarsich: [4, 3] });
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

  it("odhad špakov (v8): každá nevyplatená zóna raz, kým ešte nejaká výplata príde", () => {
    const s0 = setupGame(data, 5, { lokalit: 3 });
    const starsi: ElderState[] = s0.starsi.map((e, i) => ({ ...e, marker: (i === 0 ? 6 : 3) as MarkerPos }));
    const t = spakyTeraz(viewFor(data, { ...s0, starsi }, 0));
    // Testovacia sada v6 nemá pinnacle lokality — finále nie je, výplaty sú 3 bitky.
    expect(t.vyplat).toBe(3);
    expect(t.zaStarsich).toEqual([1 + 2 + 3, 0]);
    // Odhad aj s výkupným zo začiatku hry: 2 plné poldeci, 3 cigarety = 2 špaky.
    expect(t.vykupne).toEqual([
      { poldeci: 2, cigarety: 3, spaky: 2 },
      { poldeci: 2, cigarety: 3, spaky: 2 },
    ]);
    expect(t.odhad).toEqual([6 + 2, 0 + 2]);
    // Po výplate červenej už starší nedá nič, kým sa marker nepohne.
    const vyplateny = spakyTeraz(viewFor(data, { ...s0, starsi: starsi.map((e, i) => (i === 0 ? { ...e, vyplatene: 3 } : e)) }, 0));
    expect(vyplateny.zaStarsich).toEqual([0, 0]);
  });
});

// Pravidlá v6 „Špaky“ (Michal 2026-10-26, docs/napady/spaky.html) v znení v8
// (Michal 2026-10-28): víťazné body sú špaky — za bitku (karty v línii), Exekútor,
// Cirhóza na konci; Kultúrny dom „Obaja bodujú“. Strach starších až po udržaní
// (v8.3) stráži strach-udrzanie.test.ts. Očakávané hodnoty sú z pravidla, nie z kódu.

import { spustBitku } from "./helpers.ts";
import { describe, expect, it } from "vitest";
// Sada v6 (pred revíziou v7): test stráži pravidlá, ktoré revízia sady nemení.
import cardsJson from "./data/cards-v6.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { BitkaStav, CardInstance, ElderState, GameState } from "../src/index.ts";
import {
  apply,
  loadGameData,
  setupGame,
  spakyTeraz,
  viewFor,
} from "../src/index.ts";
import { zPolohy } from "./helpers.ts";

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
   
    damage: null,
    vitaz: null,
    prebytokDrzi: null,
    prebytokZostava: 0,
    prebytokZdvihy: [], prebytokPrepadlo: 0,
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
    starsi: s0.starsi.map((e) => ({ ...e, ...zPolohy(3 as number) })),
    bitkaStav: bitka({ krok: "hadka", caka: 0, hadka: { makke: [0, 0], vitaz: null, velkost: 0, zostava: 0, prepadlo: 0, zdvihy: [] }, sums: o.sums }),
  };
  return o.uprav === undefined ? s : o.uprav(s);
}

const lokalita = (s: GameState, defId: string): GameState["ciel"] => ({
  typ: "lokalita",
  lokalita: s.lokalityVHre.find((k) => k.defId === defId) ?? inst(defId),
});
const FINALE: GameState["ciel"] = { typ: "finale", lokalita: inst("krcma") };

/** Bitka sa vyhodnotí (v11: hádka nečaká — reči sa rozdeľujú po bodovaní). */
const pohorsenie = (s: GameState) => spustBitku(data, s);

describe("v6 bod 1–5: špaky za bitku a za starších, poradie bitky", () => {
  const s0 = setupGame(data, 5);

  it("víťaz dostane 1 špak za každú kartu v línii na oboch stranách (v8), nie za Pitky; strach za Pohoršenie v bitke nič (v8.3); lokalitu si neberie", () => {
    const s = predPoskodenim({ ciel: lokalita(s0, "krcma"), sums: [{ Rana: 5 }, {}], pitky: 4, karty: [1, 1] });
    const { state, events } = pohorsenie(s);
    const zaznam = state.nastenka.at(-1)!;
    expect(zaznam).toMatchObject({ vitaz: 0, rozhodlo: "tuhe", pitky: 4, karty: 2, zaBitku: [2, 0], zaStarsich: [0, 0], zoSekery: 0 });
    expect(zaznam.lokalita?.defId).toBe("krcma");
    // Prebytok 5 posunie markery až po špakoch — v tejto bitke už nič nedá.
    expect(state.bitkaStav?.krok).toBe("prebytok");
    expect(state.spaky).toEqual([2, 0]);
    // Rekapitulácia bitky nesie špaky (v6).
    const v = events.find((e) => e.type === "bitkaVysledok");
    expect(v?.type === "bitkaVysledok" ? v.rekap?.spaky?.zaBitku : null).toEqual([2, 0]);
  });

  it("Absťák (v8.1 Nervák): víťaz s viac Absťákmi dostane špaky za bitku celé — zrážka zanikla", () => {
    const s = predPoskodenim({
      ciel: lokalita(s0, "krcma"),
      sums: [{ Rana: 9 }, {}],
      karty: [2, 1],
      uprav: (t) => ({ ...t, hraci: [{ ...t.hraci[0], abstaky: 2 }, t.hraci[1]] }),
    });
    const zaznam = pohorsenie(s).state.nastenka.at(-1)!;
    expect(zaznam).toMatchObject({ vitaz: 0, zaBitku: [3, 0], abstakZrazka: 0 });
  });

  it("sekera: remíza v tuhom, Absťákoch aj Dlhoch — špaky kola čakajú, vezme ich víťaz ďalšej bitky", () => {
    const remiza = pohorsenie(predPoskodenim({ ciel: lokalita(s0, "krcma"), sums: [{}, {}], karty: [1, 1] })).state;
    expect(remiza.nastenka.at(-1)).toMatchObject({ vitaz: null, rozhodlo: "sekera", zaBitku: [0, 0] });
    expect(remiza.spakyNaSekere).toBe(2);
    const vyhra = pohorsenie(predPoskodenim({ ciel: lokalita(s0, "jednota"), sums: [{}, { Rana: 4 }], karty: [0, 1], uprav: (t) => ({ ...t, spakyNaSekere: 2 }) })).state;
    expect(vyhra.nastenka.at(-1)).toMatchObject({ vitaz: 1, zaBitku: [0, 3], zoSekery: 2 });
    expect(vyhra.spakyNaSekere).toBe(0);
  });

});

describe("v11.13: Kultúrny dom — každý len za svoje karty", () => {
  const s0 = setupGame(data, 5);

  it("víťaz aj porazený dostanú len za svoje karty v línii; Nakladačka sa rozdeľuje ako inde (v11 víťaz)", () => {
    const s = predPoskodenim({ ciel: lokalita(s0, "kulturny_dom"), sums: [{ Rana: 5 }, {}], karty: [2, 3] });
    const { state: st, events } = pohorsenie(s);
    expect(st.nastenka.at(-1)).toMatchObject({ vitaz: 0, karty: 5, zaBitku: [2, 3], zaStarsich: [0, 0], prebytok: [0, 0] });
    expect(st.spaky).toEqual([2, 3]);
    expect(events.some((e) => e.type === "log" && e.text.startsWith("Kultúrny dom: porazený hráč 2 dostáva 3 špaky"))).toBe(true);
    // Prebytok 5 sa nemení na špaky — rozdeľuje ho porazený.
    expect(st.bitkaStav).toMatchObject({ krok: "prebytok", caka: 0, prebytokDrzi: 0, prebytokZostava: 5 });
  });

  it("pri sekere na Kultúrnom dome nikto nie je porazený — karty idú na sekeru ako inde", () => {
    const st = pohorsenie(predPoskodenim({ ciel: lokalita(s0, "kulturny_dom"), sums: [{}, {}], karty: [2, 3] })).state;
    expect(st.nastenka.at(-1)).toMatchObject({ vitaz: null, zaBitku: [0, 0] });
    expect(st.spakyNaSekere).toBe(5);
  });
});

describe("finále (v8): karty v línii", () => {
  it("sekera vo finále: špaky kola aj zo sekery prepadnú", () => {
    const s = predPoskodenim({ ciel: FINALE, lokalityVHre: [], sums: [{}, {}], karty: [2, 1], uprav: (t) => ({ ...t, spakyNaSekere: 2, spaky: [4, 4] }) });
    const st = pohorsenie(s).state;
    expect(st.nastenka.at(-1)).toMatchObject({ vitaz: null, prepadlo: 5, zaBitku: [0, 0], zaStarsich: [0, 0] });
    // Nový stupeň z Pohoršenia vo finále nič nedá (v8.3) — remíza 4 + 2 : 4 + 2.
    expect(st.koniec).toMatchObject({ vitaz: null, body: [4 + 2, 4 + 2] });
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

  it("odhad špakov (v11.12): strach víťazovi bez obsadených stupňov, reči obom — verejné, rovnaké pre oboch", () => {
    const s0 = setupGame(data, 5);
    const starsi: ElderState[] = s0.starsi.map((e, i) => (i === 0 ? { ...e, strach: [3, 0], reci: [0, 3], reciOd: [0, 2] } : e));
    const s: GameState = { ...s0, starsi };
    const v0 = spakyTeraz(viewFor(data, s, 0));
    // Príklad Michala: červený strach, súperove reči na červenej a oranžovej: on 1, súper 4.
    expect(v0.zaStarsichVyhra).toEqual([1, 4]);
    expect(v0.zaStarsichPrehra).toEqual([0, 4]);
    expect(spakyTeraz(viewFor(data, s, 1))).toEqual(v0);
  });
});

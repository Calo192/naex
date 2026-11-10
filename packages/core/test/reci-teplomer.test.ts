// Pravidlá v11.12 „Reči na súperovom teplomere“ (Michal 2026-11-06, PRAVIDLA §10). Očakávané
// hodnoty sú z Michalových príkladov, nie z kódu. Hráč 0 má strach, hráč 1 naň dáva reči.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { BitkaStav, Command, ElderState, GameState, PlayerId, Stupen } from "../src/index.ts";
import {
  KONSTANTY,
  apply,
  blokReci,
  cenaZdvihu,
  cervenychHraca,
  kradezZaZajatie,
  krokyZdvihu,
  legalCommands,
  loadGameData,
  moznostiAkcie,
  overRozdelenie,
  plnyTeplomer,
  postupReci,
  priazenPre,
  sMarkerom,
  sReciNizsie,
  setupGame,
  spakyOdStarsieho,
  spakyZaReci,
  spakyZaStrach,
  vydesil,
} from "../src/index.ts";
import { spustBitku } from "./helpers.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

type Bl = readonly [Stupen, Stupen];

/** Starší: strach hráča 0 a reči hráča 1 ako blok [od, vrch]. */
const st = (strach: Stupen, blok: Bl | null = null): Pick<ElderState, "strach" | "reci" | "reciOd"> => ({
  strach: [strach, 0],
  reci: [0, blok === null ? 0 : blok[1]],
  reciOd: [0, blok === null ? 0 : blok[0]],
});

const zdvihni = (e: ReturnType<typeof st>, na: Stupen): ReturnType<typeof st> => sMarkerom(e, 1, "reci", na);

describe("§10 poradie obsadzovania a cena", () => {
  it("od vrchu súperovho strachu nadol, potom nad neho; zo sivej zdola nahor", () => {
    expect(postupReci(st(3), 1)).toEqual([3, 2, 1]);
    expect(postupReci(st(2), 1)).toEqual([2, 1, 3]);
    expect(postupReci(st(1), 1)).toEqual([1, 2, 3]);
    expect(postupReci(st(0), 1)).toEqual([1, 2, 3]);
  });

  it("príklady Michala: červená 3, červená + oranžová 5; pri prázdnom 1, 1 + 2, 1 + 2 + 3", () => {
    expect(krokyZdvihu(st(3), 1, "reci")).toEqual([{ na: 3, cena: 3 }, { na: 2, cena: 5 }, { na: 1, cena: 6 }]);
    expect(krokyZdvihu(st(2), 1, "reci")).toEqual([{ na: 2, cena: 2 }, { na: 1, cena: 3 }, { na: 3, cena: 6 }]);
    expect(krokyZdvihu(st(0), 1, "reci")).toEqual([{ na: 1, cena: 1 }, { na: 2, cena: 3 }, { na: 3, cena: 6 }]);
  });

  it("zdvih drží súvislý blok: v poradí po stupeň na", () => {
    expect(blokReci(zdvihni(st(3), 2), 1)).toEqual({ od: 2, vrch: 3 });
    expect(blokReci(zdvihni(st(2), 3), 1)).toEqual({ od: 1, vrch: 3 });
    expect(blokReci(zdvihni(st(0), 2), 1)).toEqual({ od: 1, vrch: 2 });
  });

  it("po klesnutí sa dopĺňa pod blokom, nie preskakuje", () => {
    expect(postupReci(st(0, [3, 3]), 1)).toEqual([2, 1]);
    expect(postupReci(st(3, [3, 3]), 1)).toEqual([2, 1]);
    expect(postupReci(st(1, [1, 2]), 1)).toEqual([3]);
    expect(postupReci(st(0, [1, 3]), 1)).toEqual([]);
  });
});

describe("§10 bodovanie: stupne 1 / 2 / 3 (v11.20) dostane, kto ich drží", () => {
  it("príklad Michala: červený strach, reči na červenej a oranžovej — on 1, ja 5 (do v11.19 4)", () => {
    const e = st(3, [2, 3]);
    expect(spakyZaStrach(e, 0)).toBe(1);
    expect(spakyZaReci(e, 1)).toBe(5);
    expect(spakyOdStarsieho(e, 0, true)).toBe(1);
    expect(spakyOdStarsieho(e, 1, false)).toBe(5);
  });

  it("tabuľka z mocku: strach a reči, špaky jemu a mne", () => {
    const pripady: readonly (readonly [Stupen, Bl, number, number])[] = [
      [3, [3, 3], 3, 3],
      [3, [2, 3], 1, 5],
      [3, [1, 3], 0, 6],
      [2, [2, 2], 1, 2],
      [2, [1, 2], 0, 3],
      [2, [1, 3], 0, 6],
      [0, [1, 1], 0, 1],
      [0, [1, 2], 0, 3],
      [0, [1, 3], 0, 6],
    ];
    for (const [s, b, on, ja] of pripady) {
      const e = st(s, b);
      expect(spakyOdStarsieho(e, 0, true), `strach ${s}, reči ${b.join("-")}`).toBe(on);
      expect(spakyOdStarsieho(e, 1, false), `strach ${s}, reči ${b.join("-")}`).toBe(ja);
    }
  });

  it("nad jeho strachom bodujú 1 / 3 / 6 (v11.20), po klesnutí podľa stupňov, ktoré ešte drží", () => {
    expect(spakyZaReci(st(1, [1, 2]), 1)).toBe(3);
    expect(spakyZaReci(st(0, [2, 3]), 1)).toBe(5);
    expect(spakyZaReci(st(0, [3, 3]), 1)).toBe(3);
  });

  it("reči bodujú pri výhre, prehre aj bez súperovho strachu; strach len víťazovi", () => {
    const e = st(2, [1, 2]);
    expect(spakyOdStarsieho(e, 1, true)).toBe(3);
    expect(spakyOdStarsieho(e, 1, false)).toBe(3);
    expect(spakyOdStarsieho(st(3), 0, false)).toBe(0);
    expect(spakyOdStarsieho(st(3), 0, true)).toBe(6);
  });
});

describe("§10 spomalenie a posun", () => {
  it("strach na obsadený stupeň o 1 viac: 2 / 3 / 4 na prázdnom teplomere s plnými rečami", () => {
    const e = st(0, [1, 3]);
    expect(krokyZdvihu(e, 0, "strach")).toEqual([{ na: 1, cena: 2 }, { na: 2, cena: 5 }, { na: 3, cena: 9 }]);
    expect(KONSTANTY.REC_PRIRAZKA).toBe(1);
  });

  it("voľný stupeň stojí bežne, príplatok len na obsadený", () => {
    expect(cenaZdvihu(st(1, [1, 1]), 0, "strach", 2)).toBe(2);
    expect(cenaZdvihu(st(1, [2, 3]), 0, "strach", 2)).toBe(3);
  });

  it("príklad Michala: reči žltá + oranžová, strach oranžová → červená: oranžová + červená; on 1, ja 5 (v11.20)", () => {
    const po = sMarkerom(st(2, [1, 2]), 0, "strach", 3);
    expect(blokReci(po, 1)).toEqual({ od: 2, vrch: 3 });
    expect(po.strach[0]).toBe(3);
    expect(spakyOdStarsieho(po, 0, true)).toBe(1);
    expect(spakyOdStarsieho(po, 1, false)).toBe(5);
  });

  it("príklad Michala: reči na žltej, strach žltá → oranžová: reči na oranžovej", () => {
    expect(blokReci(sMarkerom(st(1, [1, 1]), 0, "strach", 2), 1)).toEqual({ od: 2, vrch: 2 });
  });

  it("skok cez viac stupňov: počet stupňov bloku ostáva", () => {
    expect(blokReci(sMarkerom(st(0, [1, 1]), 0, "strach", 3), 1)).toEqual({ od: 3, vrch: 3 });
  });

  it("strach pod rečami blok nehýbe", () => {
    expect(blokReci(sMarkerom(st(0, [2, 3]), 0, "strach", 1), 1)).toEqual({ od: 2, vrch: 3 });
  });
});

describe("§10 čo reči nemenia (Michal 2026-11-06)", () => {
  it("obsadená červená sa ráta do výhry strachom a je vydesený", () => {
    const e = st(3, [1, 3]) as ElderState;
    expect(vydesil(e, 0)).toBe(true);
    expect(cervenychHraca({ starsi: [e, e, e, e], vazni: [] }, 0)).toBe(4);
  });

  it("priazeň z celého strachu: červený strach a plné reči = plná priazeň pre mňa", () => {
    expect(priazenPre(st(3, [1, 3]) as ElderState, 1)).toBe(3);
  });
});

/** Stav v kroku rozdelenia hádky či Nakladačky s jedným upraveným staršími. */
function rozdelenie(krok: "prebytok" | "reci", p: PlayerId, body: number, upravy: Readonly<Record<number, Partial<ElderState>>>): GameState {
  const s0 = setupGame(data, 21);
  const b: BitkaStav = {
    krok,
    caka: p,
    sums: [{}, {}],
    exekutorHotovy: [true, true],
    exekutor: [0, 0],
    damage: null,
    vitaz: p,
    prebytokDrzi: krok === "prebytok" ? p : null,
    prebytokZostava: krok === "prebytok" ? body : 0,
    prebytokZdvihy: [],
    prebytokPrepadlo: 0,
    ...(krok === "reci" ? { hadka: { makke: p === 0 ? ([body, 0] as const) : ([0, body] as const), vitaz: p, velkost: body, zostava: body, prepadlo: 0, zdvihy: [] } } : {}),
    spalit: [],
    vesticaHotova: true,
  } as unknown as BitkaStav;
  return {
    ...s0,
    faza: "bitka",
    draftStav: null,
    spaky: [10, 10],
    ciel: { typ: "lokalita", lokalita: s0.lokalityVHre[0]! },
    lokalityVHre: s0.lokalityVHre.slice(1),
    starsi: s0.starsi.map((e, i) => ({ ...e, ...(upravy[i] ?? {}) })),
    bitkaStav: b,
  };
}

const id = (s: GameState, i: number): string => s.starsi[i]!.elderId;

describe("§9.1 rozdelenie hádky cez server", () => {
  it("červený strach: hádka 5 = reči na červenej a oranžovej; zmena nesie aj spodok bloku", () => {
    const s = rozdelenie("reci", 1, 5, { 0: { strach: [3, 0] } });
    const r = apply(data, s, { type: "reci", zdvihy: [{ elderId: id(s, 0), na: 2 }] }, 1);
    const e = r.state.starsi[0]!;
    expect(blokReci(e, 1)).toEqual({ od: 2, vrch: 3 });
    expect(e.strach).toEqual([3, 0]);
    expect(r.state.zmenyMarkerov.find((z) => z.marker === "reci" && z.elderId === id(s, 0))).toMatchObject({ hrac: 1, z: 0, na: 3, odZ: 0, odNa: 2, zdroj: "hadka" });
  });

  it("mimo poradia reči nejdú: pri červenom strachu oranžová nie je prvá, ale po ňu sa obsadzuje; plný blok nič neprijme", () => {
    const s = rozdelenie("reci", 1, 6, { 0: { strach: [0, 0], reci: [0, 3], reciOd: [0, 1] } });
    expect(overRozdelenie(s, 1, "reci", 6, [{ elderId: id(s, 0), na: 1 }]).chyba).toMatch(/nejdú/);
  });

  it("zvyšok, ktorý na červenú pri červenom strachu nestačí, prepadne len keď nikde inde nie je kam", () => {
    const s = rozdelenie("reci", 1, 2, {});
    const plan = overRozdelenie(s, 1, "reci", 2, []);
    expect(plan.esteSaDa.length).toBeGreaterThan(0);
  });
});

describe("§10 presvedčenie (v11.12)", () => {
  it("ktorýkoľvek starší: plný teplomer + 3, aj keď sa ma bojí viac než súpera; reči ostávajú", () => {
    const s = rozdelenie("reci", 1, 9, { 0: { strach: [0, 3] } });
    expect(moznostiAkcie(s, 1, "reci", 9)).toContain(id(s, 0));
    expect(moznostiAkcie(s, 1, "reci", 8)).not.toContain(id(s, 0));
    const t = apply(data, s, { type: "reci", zdvihy: [{ elderId: id(s, 0), na: 3 }], presvedcenia: [id(s, 0)] }, 1).state;
    const e = t.starsi[0]!;
    expect(e.presvedcil).toBe(1);
    expect(plnyTeplomer(e, 1)).toBe(true);
    expect(spakyZaReci(e, 1)).toBe(6);
    expect(t.hraci[1].ruka.some((k) => k.uid === e.karta.uid)).toBe(true);
  });

  it("bez plného teplomera nejde; už presvedčeného nie", () => {
    const s = rozdelenie("reci", 1, 9, { 0: { strach: [0, 3], reci: [0, 3], reciOd: [0, 2] } });
    const c: Command = { type: "reci", zdvihy: [{ elderId: id(s, 1), na: 3 }], presvedcenia: [id(s, 0)] };
    expect(() => apply(data, s, c, 1)).toThrow(/celom teplomere/);
    const uz = rozdelenie("reci", 1, 9, { 0: { strach: [3, 0], reci: [0, 3], reciOd: [0, 1], presvedcil: 0 } });
    expect(moznostiAkcie(uz, 1, "reci", 9)).not.toContain(id(uz, 0));
  });
});

describe("§10 zajatie a krádež (v11.12)", () => {
  it("krádež = investované reči: červená 3, červená + oranžová 5, plný teplomer 6; bez rečí 0", () => {
    expect(kradezZaZajatie(st(3, [3, 3]), 0)).toBe(3);
    expect(kradezZaZajatie(st(3, [2, 3]), 0)).toBe(5);
    expect(kradezZaZajatie(st(3, [1, 3]), 0)).toBe(6);
    expect(kradezZaZajatie(st(3), 0)).toBe(0);
  });

  it("obsadeného staršieho sa dá zajať; okradnutý stratí, najviac koľko má", () => {
    const s = rozdelenie("prebytok", 0, 5, { 0: { strach: [3, 0], reci: [0, 3], reciOd: [0, 2] } });
    expect(legalCommands(data, s, 0)).toContainEqual({ type: "prebytok", zdvihy: [], zajatia: [id(s, 0)] });
    const t = apply(data, s, { type: "prebytok", zdvihy: [], zajatia: [id(s, 0)] }, 0).state;
    expect(t.spaky).toEqual([15, 5]);
    expect(t.vazni[0]?.hrac).toBe(0);
    const chudak = { ...s, spaky: [10, 2] as [number, number] };
    expect(apply(data, chudak, { type: "prebytok", zdvihy: [], zajatia: [id(s, 0)] }, 0).state.spaky).toEqual([12, 0]);
  });
});

describe("§10 klesanie: zospodu a len tomu, kto prehral hádku", () => {
  it("náhľad poklesu: spodný stupeň zanikne, posledný stupeň zanikne celý", () => {
    expect(blokReci(sReciNizsie(st(3, [1, 3]), 1), 1)).toEqual({ od: 2, vrch: 3 });
    expect(blokReci(sReciNizsie(st(3, [3, 3]), 1), 1)).toBeNull();
  });

  /** Bitka bez kariet: strach aj reči z `starsi`, víťaz bitky a hádky podľa súčtov. */
  function odohraj(vitazHadky: PlayerId | null): GameState {
    const s0 = setupGame(data, 21);
    const hadka = vitazHadky === null ? { vitaz: null, velkost: 0 } : { vitaz: vitazHadky, velkost: 2 };
    const makke = vitazHadky === null ? [0, 0] : vitazHadky === 0 ? [2, 0] : [0, 2];
    const b = {
      krok: "hadka",
      caka: null,
      sums: [{ Rana: 3 }, {}],
      exekutorHotovy: [true, true],
      exekutor: [0, 0],
      damage: null,
      vitaz: null,
      prebytokDrzi: null,
      prebytokZostava: 0,
      prebytokZdvihy: [],
      prebytokPrepadlo: 0,
      hadka: { makke, vitaz: hadka.vitaz, velkost: hadka.velkost, zostava: hadka.velkost, prepadlo: 0, zdvihy: [] },
      spalit: [],
      vesticaHotova: false,
    } as unknown as BitkaStav;
    const s: GameState = {
      ...s0,
      faza: "bitka",
      draftStav: null,
      spaky: [0, 0],
      ciel: { typ: "lokalita", lokalita: s0.lokalityVHre[0]! },
      lokalityVHre: s0.lokalityVHre.slice(1),
      starsi: s0.starsi.map((e, i) => (i === 0 ? { ...e, strach: [3, 0], reci: [0, 3], reciOd: [0, 1] } : e)),
      bitkaStav: b,
    };
    return spustBitku(data, s).state;
  }

  it("víťaz hádky reči nestráca; v11.12 bodujú porazenému aj víťazovi", () => {
    const e = odohraj(1).starsi[0]!;
    expect(e.reci[1]).toBe(3);
    expect(e.reciOd?.[1]).toBe(1);
  });

  it("kto prehral hádku, tomu klesnú zospodu", () => {
    const e = odohraj(0).starsi[0]!;
    expect(blokReci(e, 1)).toEqual({ od: 2, vrch: 3 });
  });

  it("pri remíze v hádke nikomu", () => {
    expect(blokReci(odohraj(null).starsi[0]!, 1)).toEqual({ od: 1, vrch: 3 });
  });
});

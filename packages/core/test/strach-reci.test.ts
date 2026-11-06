// Pravidlá v11 „Strach a reči“ (Michal 2026-11-02, docs/napady/strach-reci.html v2): každý hráč
// má pri každom staršom vlastný strach (neklesá) a reči (nad strachom); priazeň = rozdiel strachov.
// Strach dvíha víťaz bitky Nakladačkou, reči víťaz hádky; bodovanie po bitke (4b), výhra strachom
// (4c), krádež pri zajatí a väzni podľa ligy (v11.4 zajatie pri rozdelení Nakladačky). Očakávané
// hodnoty sú z pravidla, nie z kódu.
// Príklad „Ana a Boris“ z dokumentu: Ana je hráč 0, Boris hráč 1.
// Od v11.12 tieto reči (nad vlastným strachom) hrá len výučba: starší bez reciOd. Reči na súperovom
// teplomere overuje reci-teplomer.test.ts.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { BitkaStav, ElderState, GameState, PlayerId, Stupen, Vazen } from "../src/index.ts";
import {
  KONSTANTY,
  apply,
  cenaDvihnutia,
  cervenychHraca,
  kandidatiRozdelenia,
  legalCommands,
  loadGameData,
  overRozdelenie,
  priazenHraca,
  priazenPre,
  priazenSila,
  pultStarsich,
  reciNizsie,
  sMarkerom,
  setupGame,
  spakyOdStarsieho,
  stavkaBitky,
  vazniNaVyhru,
  viewFor,
} from "../src/index.ts";
import { spustBitku } from "./helpers.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

type Markery = readonly [readonly [Stupen, Stupen], readonly [Stupen, Stupen]];

/** Starší so [Ana strach, reči] a [Boris strach, reči]. */
function m(e: ElderState, ana: readonly [Stupen, Stupen], boris: readonly [Stupen, Stupen]): ElderState {
  const { reciOd: _reciOd, ...bez } = e;
  return { ...bez, strach: [ana[0], boris[0]], reci: [ana[1], boris[1]] };
}

/** Bitka pred poškodením (hádka už vyhodnotená), prázdna línia, súčty `sums`. */
function bitka(s: GameState, sums: BitkaStav["sums"], hadka: { vitaz: PlayerId | null; velkost: number } = { vitaz: null, velkost: 0 }): BitkaStav {
  const makke: [number, number] = hadka.vitaz === null ? [0, 0] : hadka.vitaz === 0 ? [hadka.velkost, 0] : [0, hadka.velkost];
  return {
    krok: "hadka",
    caka: null,
    sums,
    exekutorHotovy: [false, false],
    exekutor: [0, 0],
    hadka: { makke, vitaz: hadka.vitaz, velkost: hadka.velkost, zostava: hadka.velkost, prepadlo: 0, zdvihy: [] },
    damage: null,
    vitaz: null,
    prebytokDrzi: null,
    prebytokZostava: 0,
    prebytokZdvihy: [],
    prebytokPrepadlo: 0,
    spalit: [],
    vesticaHotova: true,
  };
}

/** Stav pred bitkou 4. kola Druhej ligy: všetci starší v sivom, ak `markery` nepovie inak. */
function pred(o: { markery?: Readonly<Record<number, Markery | "vazen-boris">>; sums: BitkaStav["sums"]; hadka?: { vitaz: PlayerId | null; velkost: number }; spaky?: readonly [number, number] }): GameState {
  const s0 = setupGame(data, 11, { lokalit: 5 });
  const vazni: Vazen[] = [];
  const starsi: ElderState[] = [];
  s0.starsi.forEach((e, i) => {
    const x = o.markery?.[i];
    if (x === "vazen-boris") vazni.push({ elderId: e.elderId, hrac: 1, poradie: 1, karta: e.karta, scorecard: e.scorecard, miesto: i });
    else starsi.push(x === undefined ? e : m(e, x[0], x[1]));
  });
  const s: GameState = {
    ...s0,
    faza: "bitka",
    draftStav: null,
    kolo: 4,
    utocnik: 1,
    strany: [[], []],
    ciel: { typ: "lokalita", lokalita: s0.lokalityVHre[0]! },
    starsi,
    vazni,
    spaky: o.spaky ?? [20, 20],
    bitkaStav: null,
  };
  return { ...s, bitkaStav: bitka(s, o.sums, o.hadka) };
}

/** Dohrá bitku: rozdelenia podľa `rozdel` (inak prvá ponuka), ostatné prvý legálny príkaz. */
function dohraj(s: GameState, rozdel: (s: GameState, p: PlayerId) => GameState | null = () => null): GameState {
  let t = s;
  const kolo = s.kolo;
  for (let i = 0; i < 40 && t.kolo === kolo && t.bitkaStav !== null && t.koniec === null; i++) {
    const p = ([0, 1] as const).find((q) => legalCommands(data, t, q).some((c) => c.type !== "vzdat"));
    if (p === undefined) break;
    const krok = t.bitkaStav?.krok;
    const vlastne = krok === "prebytok" || krok === "reci" ? rozdel(t, p) : null;
    t = vlastne ?? apply(data, t, legalCommands(data, t, p).find((c) => c.type !== "vzdat")!, p).state;
  }
  return t;
}

// Príklad Ana a Boris (strach-reci.html): Farár 3/— 3/—, Krčmárka 2/3 0/—, Starosta 0/— 1/2,
// Poštárka 3/— 0/2, Hrobár väzeň Borisa, Autobusár 1/— 1/—, Veterinár 0/2 3/—,
// Vychovávateľka 3/— 1/—.
const ANA_BORIS: readonly (Markery | "vazen-boris")[] = [
  [[3, 0], [3, 0]],
  [[2, 3], [0, 0]],
  [[0, 0], [1, 2]],
  [[3, 0], [0, 2]],
  "vazen-boris",
  [[1, 0], [1, 0]],
  [[0, 2], [3, 0]],
  [[3, 0], [1, 0]],
];
const FARAR = 0;
const KRCMARKA = 1;
const STAROSTA = 2;
const POSTARKA = 3;

// Krčmárka dáva priazeň Veriaci — Borisova Viera 2 uberie Aninmu tuhému 2.
function anaBoris(vitaz: PlayerId, nakladacka = 3): GameState {
  return pred({ markery: ANA_BORIS, sums: vitaz === 0 ? [{ Rana: nakladacka + 2 }, {}] : [{}, { Rana: nakladacka }] });
}

const id = (i: number): string => setupGame(data, 11, { lokalit: 5 }).starsi[i]!.elderId;
const elder = (s: GameState, i: number): ElderState | undefined => s.starsi.find((e) => e.elderId === id(i));

describe("§10 strach, reči a priazeň (v11)", () => {
  it("priazeň pre mňa = max(0, strach súpera − môj strach); reči priazeň nedávajú", () => {
    const e = { strach: [2, 0] as const, reci: [3, 0] as const };
    expect(priazenPre(e, 1)).toBe(2);
    expect(priazenPre(e, 0)).toBe(0);
    expect(priazenHraca(e)).toBe(1);
    expect(priazenSila(e)).toBe(2);
    expect(priazenHraca({ strach: [3, 3] })).toBeNull();
    expect(priazenHraca({ strach: [0, 1], reci: [2, 0] } as Pick<ElderState, "strach" | "reci">)).toBe(0);
  });

  it("cena stupňa 1 / 2 / 3; reči vždy nad strachom — zo žltého strachu na červené reči 2 + 3 = 5", () => {
    expect(cenaDvihnutia(0, 1)).toBe(1);
    expect(cenaDvihnutia(1, 2)).toBe(2);
    expect(cenaDvihnutia(2, 3)).toBe(3);
    expect(cenaDvihnutia(0, 3)).toBe(6);
    expect(cenaDvihnutia(1, 3)).toBe(5);
    const st: Pick<GameState, "starsi"> = { starsi: [m(setupGame(data, 11).starsi[0]!, [1, 0], [0, 0])] };
    const plan = overRozdelenie(st, 0, "reci", 5, [{ elderId: st.starsi[0]!.elderId, na: 3 }]);
    expect(plan).toMatchObject({ cena: 5, zvysok: 0, chyba: null, esteSaDa: [] });
    // Reči na stupni strachu ani pod ním nie sú.
    expect(overRozdelenie(st, 0, "reci", 5, [{ elderId: st.starsi[0]!.elderId, na: 1 }]).chyba).not.toBeNull();
  });

  it("strach, ktorý dorastie na stupeň rečí, ich zruší; reči po poklese na stupeň strachu zaniknú", () => {
    const e = { strach: [1, 0] as const, reci: [3, 0] as const };
    expect(sMarkerom(e, 0, "strach", 2).reci[0]).toBe(3);
    expect(sMarkerom(e, 0, "strach", 3).reci[0]).toBe(0);
    expect(reciNizsie(e, 0)).toBe(2);
    expect(reciNizsie({ strach: [2, 0], reci: [3, 0] }, 0)).toBe(0);
  });

  it("na červený strach sa reči nedajú; kam dvíhať nie je, zvyšok prepadne celý", () => {
    const [a] = setupGame(data, 11).starsi;
    const st: Pick<GameState, "starsi"> = { starsi: [m(a!, [3, 0], [0, 0])] };
    expect(overRozdelenie(st, 0, "reci", 6, [{ elderId: a!.elderId, na: 3 }]).chyba).not.toBeNull();
    // Kam dvíhať nie je — zvyšok prepadne celý (rozhodnuté 2026-11-02).
    expect(overRozdelenie(st, 0, "reci", 6, [])).toMatchObject({ zvysok: 6, esteSaDa: [], chyba: null });
  });

  it("rozdelí sa, čo sa dá: zvyšok, ktorý ešte stačí na stupeň, server neprijme; ponuka kandidátov je úplná", () => {
    const s0 = setupGame(data, 11);
    const st: Pick<GameState, "starsi"> = { starsi: s0.starsi };
    expect(overRozdelenie(st, 0, "strach", 4, [{ elderId: s0.starsi[0]!.elderId, na: 2 }]).esteSaDa.length).toBeGreaterThan(0);
    expect(overRozdelenie(st, 0, "strach", 4, [{ elderId: s0.starsi[0]!.elderId, na: 2 }, { elderId: s0.starsi[1]!.elderId, na: 1 }]).esteSaDa).toEqual([]);
    const kandidati = kandidatiRozdelenia(st, 0, "strach", 7);
    expect(kandidati.length).toBeGreaterThan(8);
    for (const k of kandidati) expect(overRozdelenie(st, 0, "strach", 7, k)).toMatchObject({ chyba: null, esteSaDa: [] });
  });

  it("väzni na výhru = (lokality + finále) / 2: Tretia liga 2, Druhá 3, Prvá 4", () => {
    expect([vazniNaVyhru(3), vazniNaVyhru(5), vazniNaVyhru(7)]).toEqual([2, 3, 4]);
  });
});

describe("§9 príklad Ana a Boris (Druhá liga, 4. kolo)", () => {
  it("pult: Ana výhra 24 · prehra 8, Boris 18 · 6 (výučba: reči nekrátia); červené Ana 3, Boris 3 (Farár, Veterinár a väzeň)", () => {
    const v = viewFor(data, anaBoris(0), 0);
    const pult = pultStarsich(v);
    expect(pult.vyhra).toEqual([24, 18]);
    expect(pult.prehra).toEqual([8, 6]);
    expect(pult.vyhry).toEqual({ cervene: [3, 3], cervenychNaVyhru: 4, vazni: [0, 1], vazniNaVyhru: 3 });
    // Farár: obaja na červenej — priazeň nikto.
    expect(pult.riadky.find((r) => r.elderId === id(FARAR))).toMatchObject({ priazenHrac: null, vyhra: [5, 5], prehra: [0, 0] });
    expect(pult.riadky.find((r) => r.elderId === id(POSTARKA))).toMatchObject({ priazenHrac: 1, priazenSila: 3, presvedcil: null });
    // Strach a reči oboch sú verejné — súper ich vidí rovnako.
    expect(viewFor(data, anaBoris(0), 1).starsi).toEqual(v.starsi);
    expect(stavkaBitky(v)).toMatchObject({ starsiVyhra: [24, 18], starsiPrehra: [8, 6] });
  });

  it("Ana vyhrá: 24 za starších, Boris 6 za reči; Nakladačka 8 — Krčmárka na červenú za 3, zajme Poštárku za 5 a ukradne 1", () => {
    const s = anaBoris(0, 8);
    const po = spustBitku(data, s).state;
    const zaznam = po.nastenka.at(-1)!;
    expect(zaznam.zaStarsich).toEqual([24, 6]);
    expect(zaznam.zaStarsichRozpis?.[1].map((x) => [x.elderId, x.spaky, x.reci])).toEqual([
      [id(STAROSTA), 3, true],
      [id(POSTARKA), 3, true],
    ]);
    // Reči po bodovaní: Ana Krčmárka 3 → zanikne (strach 2), Veterinár 2 → 1; Boris Starosta 2 → zanikne, Poštárka 2 → 1.
    expect(elder(po, KRCMARKA)!.reci).toEqual([0, 0]);
    expect(elder(po, 6)!.reci).toEqual([1, 0]);
    expect(elder(po, STAROSTA)!.reci).toEqual([0, 0]);
    expect(elder(po, POSTARKA)!.reci).toEqual([0, 1]);
    // 3 z 4 červených — výhra strachom ešte nie.
    expect(po.koniec).toBeNull();
    expect(po.bitkaStav).toMatchObject({ krok: "prebytok", caka: 0, prebytokZostava: 8 });
    const t = dohraj(po, (x, p) =>
      p === 0 && x.bitkaStav?.krok === "prebytok" ? apply(data, x, { type: "prebytok", zdvihy: [{ elderId: id(KRCMARKA), na: 3 }], zajatia: [id(POSTARKA)] }, 0).state : null,
    );
    // Výhra strachom sa ráta len v kroku 4c (pred Nakladačkou) — štvrtá červená ešte nekončí hru.
    expect(t.koniec).toBeNull();
    expect(elder(t, KRCMARKA)).toMatchObject({ strach: [3, 0], reci: [0, 0] });
    expect(t.vazni.map((v) => [v.elderId, v.hrac])).toEqual([
      [id(4), 1],
      [id(POSTARKA), 0],
    ]);
    // Krádež (v11.4): Borisove reči pri Poštárke v čase zajatia — po bodovaní klesli na žltú = 1 špak.
    expect(t.nastenka.at(-1)?.kradez).toEqual([1, -1]);
    expect(t.spaky[1]).toBe(20 + 6 + 0 - 1);
    // Väzeň sa ráta ako červená držiteľa: Farár, Krčmárka, Vychovávateľka a Poštárka.
    expect(cervenychHraca(t, 0)).toBe(4);
    // Porazený dostane 1 cigaretu.
    expect(t.hraci[1].cigarety).toBeGreaterThanOrEqual(s.hraci[1].cigarety + KONSTANTY.CIGARETY_PORAZENEMU);
  });

  it("Boris vyhrá: 18 za starších, Ana 8 za reči; Poštárka ostáva (Anin strach 3); Starosta 1 → 3 za 5 a ďalšia vyhratá bitka je výhra strachom", () => {
    const s = anaBoris(1, 5);
    const po = spustBitku(data, s).state;
    expect(po.nastenka.at(-1)?.zaStarsich).toEqual([8, 18]);
    const t = dohraj(po, (x, p) => (p === 1 && x.bitkaStav?.krok === "prebytok" ? apply(data, x, { type: "prebytok", zdvihy: [{ elderId: id(STAROSTA), na: 3 }] }, 1).state : null));
    expect(t.koniec).toBeNull();
    expect(elder(t, POSTARKA)!.strach).toEqual([3, 0]);
    expect(priazenHraca(elder(t, POSTARKA)!)).toBe(1);
    expect(elder(t, STAROSTA)).toMatchObject({ strach: [0, 3], reci: [0, 0] });
    expect(cervenychHraca(t, 1)).toBe(4);
    expect(t.nastenka.at(-1)?.kradez).toBeUndefined();
    // Ďalšia bitka, ktorú Boris vyhrá: výhra strachom hneď (4c), pred exekúciou.
    const dalsia: GameState = { ...t, faza: "bitka", ciel: { typ: "lokalita", lokalita: t.lokalityVHre[1]! }, strany: [[], []], bitkaStav: bitka(t, [{}, { Rana: 1 }]), hraci: [t.hraci[0], { ...t.hraci[1], dlhy: 2 }] };
    const koniec = spustBitku(data, dalsia).state;
    expect(koniec.koniec).toMatchObject({ vitaz: 1, body: null });
    expect(koniec.koniec?.dovod).toMatch(/výhra strachom/);
    expect(koniec.hraci[1].dlhy).toBe(2);
  });
});

describe("§9 bodovanie, sekera, finále a cigareta (v11)", () => {
  it("sekera: obaja bodujú len reči, cigaretu porazenému nedostane nikto, výpalné sa platí (v11.9)", () => {
    const s = pred({ markery: { 0: [[3, 0], [0, 2]], 3: [[1, 3], [2, 0]] }, sums: [{ Rana: 1 }, { Rana: 1 }] });
    const t = dohraj(spustBitku(data, s).state);
    const z = t.nastenka.at(-1)!;
    expect(z.vitaz).toBeNull();
    expect(z.zaStarsich).toEqual([spakyOdStarsieho({ strach: [1, 2], reci: [3, 0] }, 0, false), 3]);
    expect(z.zaStarsich).toEqual([5, 3]);
    // Hráč 0 má jednu červenú (starší 0), preto mu hráč 1 platí 1 cigaretu výpalného.
    expect([t.hraci[0].cigarety, t.hraci[1].cigarety]).toEqual([s.hraci[0].cigarety + 1, s.hraci[1].cigarety - 1]);
  });

  it("víťaz hádky rozdelí hádku na svoje reči až po bodovaní; strach dvíha víťaz bitky", () => {
    const s = pred({ sums: [{ Rana: 1 }, {}], hadka: { vitaz: 1, velkost: 3 } });
    let t = spustBitku(data, s).state;
    expect(t.bitkaStav).toMatchObject({ krok: "prebytok", caka: 0, prebytokZostava: 1 });
    expect(() => apply(data, t, { type: "reci", zdvihy: [{ elderId: id(0), na: 2 }] }, 1)).toThrow();
    t = apply(data, t, { type: "prebytok", zdvihy: [{ elderId: id(0), na: 1 }] }, 0).state;
    expect(elder(t, 0)!.strach).toEqual([1, 0]);
    expect(t.bitkaStav).toMatchObject({ krok: "reci", caka: 1 });
    t = apply(data, t, { type: "reci", zdvihy: [{ elderId: id(0), na: 2 }] }, 1).state;
    expect(elder(t, 0)).toMatchObject({ strach: [1, 0], reci: [0, 2] });
    // Reči priazeň nedávajú: priazeň má Boris z rozdielu strachov (1 : 0).
    expect(priazenHraca(elder(t, 0)!)).toBe(1);
  });

  it("finále: markery sa nedvíhajú — Nakladačka aj hádka idú 1 : 1 na špaky", () => {
    const s0 = pred({ sums: [{ Rana: 4 }, {}], hadka: { vitaz: 1, velkost: 3 } });
    const s: GameState = { ...s0, ciel: { typ: "finale", lokalita: s0.ciel!.lokalita! } };
    const t = dohraj(spustBitku(data, s).state);
    const z = t.nastenka.at(-1)!;
    expect(z.prebytok).toEqual([4, 0]);
    expect(z.hadkaSpaky).toEqual([0, 3]);
    expect(t.starsi.every((e) => e.strach[0] === 0 && e.strach[1] === 0 && e.reci[0] === 0 && e.reci[1] === 0)).toBe(true);
  });

  it("porazený dostane cigaretu po bitke o lokalitu, po finále nie (Michal 2026-11-02)", () => {
    const s0 = pred({ sums: [{ Rana: 2 }, {}] });
    const lokalita = dohraj(spustBitku(data, s0).state);
    expect(lokalita.hraci[1].cigarety).toBe(s0.hraci[1].cigarety + KONSTANTY.CIGARETY_PORAZENEMU);
    const s: GameState = { ...s0, ciel: { typ: "finale", lokalita: s0.ciel!.lokalita! } };
    const finale = dohraj(spustBitku(data, s).state);
    expect(finale.koniec).not.toBeNull();
    expect(finale.hraci[1].cigarety).toBe(s.hraci[1].cigarety);
  });
});

describe("§16 Kapybara a Predsedova vila (v11)", () => {
  it("Kapybara: súperove reči pri jednom staršom klesnú o stupeň — ponuka len starší so súperovými rečami", () => {
    const s0 = pred({ markery: [[[0, 0], [1, 3]], [[0, 0], [0, 0]]], sums: [{}, {}] });
    const s: GameState = { ...s0, faza: "pitka", bitkaStav: null, hasicVolby: [{ hrac: 0, typ: "kapybara", uid: 0, potom: null }] };
    const ponuka = legalCommands(data, s, 0);
    expect(ponuka).toEqual([{ type: "kapybara", elderId: id(0) }]);
    const t = apply(data, s, { type: "kapybara", elderId: id(0) }, 0).state;
    expect(elder(t, 0)!.reci).toEqual([0, 2]);
    expect(t.zmenyMarkerov.at(-1)).toMatchObject({ hrac: 1, marker: "reci", z: 3, na: 2, zdroj: "nastup", kto: 0 });
  });
});

describe("§10 zajatie v11: krádež, väzni podľa ligy, Predsedova vila", () => {
  it("krádež najviac toľko, koľko súper má; väzni na výhru v Tretej lige 2 — hneď po rozdelení Nakladačky", () => {
    const s0 = pred({ markery: { 0: [[3, 0], [3, 0]], 4: "vazen-boris" }, sums: [{ Rana: 5 }, {}], spaky: [0, 2] });
    // Väzeň Borisa prejde Ane — v Tretej lige stačia na výhru dvaja.
    const s: GameState = { ...s0, lokalitCelkom: 3, vazni: s0.vazni.map((v) => ({ ...v, hrac: 0 })) };
    const t = dohraj(spustBitku(data, s).state, (x, p) => (p === 0 && x.bitkaStav?.krok === "prebytok" ? apply(data, x, { type: "prebytok", zdvihy: [], zajatia: [id(0)] }, 0).state : null));
    expect(t.koniec).toMatchObject({ vitaz: 0, body: null });
    expect(t.koniec?.dovod).toMatch(/výhra väzňami/);
    // Borisov strach pri ňom je červený (5 špakov), má však len 2 — ukradnú sa 2.
    expect(t.nastenka.at(-1)?.kradez).toEqual([2, -2]);
    expect(t.spaky[1]).toBe(0);
  });

  it("Predsedova vila: za 2 cigarety moje reči o stupeň nad vyšší z mojich markerov; pri červenej nie", () => {
    const s0 = pred({ markery: { 0: [[1, 0], [0, 0]], 1: [[0, 2], [0, 0]], 2: [[3, 0], [0, 0]] }, sums: [{}, {}] });
    const vila = { uid: 9_999_001, defId: "predsedova_vila", leftLayout: 0, rightLayout: 0 };
    const s: GameState = {
      ...s0,
      faza: "pitka",
      bitkaStav: null,
      ciel: { typ: "lokalita", lokalita: vila },
      pitkyCelkom: 1,
      pitkaCislo: 1,
      hraci: [{ ...s0.hraci[0], cigarety: 5 }, s0.hraci[1]],
      pitkaStav: { naTahu: 0, hotovy: [false, false], naexPouzity: [false, false], fajcenie: [0, 0], reakcia: null, postarka: [false, false], starosta: [false, false], naexPocet: [0, 0], vykup: [false, false] },
    };
    const ponuka = legalCommands(data, s, 0).filter((c) => c.type === "kseft");
    const ids = ponuka.map((c) => (c.type === "kseft" ? c.elderId : null));
    expect(ids).toContain(id(0));
    expect(ids).toContain(id(1));
    expect(ids).not.toContain(id(2));
    expect(ids).toContain(id(3));
    const t = apply(data, s, { type: "kseft", uid: vila.uid, elderId: id(0) }, 0).state;
    expect(elder(t, 0)).toMatchObject({ strach: [1, 0], reci: [2, 0] });
    expect(t.hraci[0].cigarety).toBe(s.hraci[0].cigarety - 2);
    const u = apply(data, s, { type: "kseft", uid: vila.uid, elderId: id(1) }, 0).state;
    expect(elder(u, 1)!.reci).toEqual([3, 0]);
  });
});

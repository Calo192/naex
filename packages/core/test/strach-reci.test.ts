// Pravidlá v11 „Strach a reči“ (Michal 2026-11-02, docs/napady/strach-reci.html v2): každý hráč
// má pri každom staršom vlastný strach (neklesá) a reči; priazeň = rozdiel strachov.
// Strach dvíha víťaz bitky Nakladačkou, reči víťaz hádky; bodovanie po bitke (4b), výhra strachom
// (4c), krádež pri zajatí a väzni podľa ligy (v11.4 zajatie pri rozdelení Nakladačky). Očakávané
// hodnoty sú z pravidla, nie z kódu.
// Ana je hráč 0, Boris hráč 1.
// Od v11.12 sú reči blokom na súperovom teplomere — podrobne ich overuje reci-teplomer.test.ts; tu
// `m` kladie reči na jediný stupeň (spodok bloku = vrch).

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { BitkaStav, ElderState, GameState, PlayerId, Stupen, Vazen } from "../src/index.ts";
import {
  KONSTANTY,
  apply,
  kandidatiRozdelenia,
  legalCommands,
  loadGameData,
  overRozdelenie,
  priazenHraca,
  priazenPre,
  priazenSila,
  setupGame,
  spakyOdStarsieho,
  vazniNaVyhru,
} from "../src/index.ts";
import { spustBitku } from "./helpers.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

type Markery = readonly [readonly [Stupen, Stupen], readonly [Stupen, Stupen]];

/** Starší so [Ana strach, reči] a [Boris strach, reči]. */
function m(e: ElderState, ana: readonly [Stupen, Stupen], boris: readonly [Stupen, Stupen]): ElderState {
  return { ...e, strach: [ana[0], boris[0]], reci: [ana[1], boris[1]] };
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

describe("§9 bodovanie, sekera, finále a cigareta (v11)", () => {
  it("sekera: obaja bodujú len reči, cigaretu porazenému nedostane nikto, výpalné sa platí (v11.9)", () => {
    // Boris drží rečami Aninu červenú (3), Ana Borisovu oranžovú (2) — hodnota stupňa 1 / 2 / 3 (v11.20).
    const s = pred({ markery: { 0: [[3, 0], [0, 3]], 3: [[1, 2], [2, 0]] }, sums: [{ Rana: 1 }, { Rana: 1 }] });
    const t = dohraj(spustBitku(data, s).state);
    const z = t.nastenka.at(-1)!;
    expect(z.vitaz).toBeNull();
    expect(z.zaStarsich).toEqual([spakyOdStarsieho(s.starsi[3]!, 0, false), spakyOdStarsieho(s.starsi[0]!, 1, false)]);
    expect(z.zaStarsich).toEqual([2, 3]);
    // Hráč 0 má jednu červenú (starší 0), preto mu hráč 1 platí 1 cigaretu výpalného.
    expect([t.hraci[0].cigarety, t.hraci[1].cigarety]).toEqual([s.hraci[0].cigarety + 1, s.hraci[1].cigarety - 1]);
  });

  it("log bodovania rozpíše špaky víťaza za strach a za reči, nulové časti vynechá (playtest 20261108-165501)", () => {
    // Ana vyhrá: pri staršom 0 má červený strach (6), pri staršom 3 žltý strach (1) a reči na Borisovej oranžovej (2).
    const s = pred({ markery: { 0: [[3, 0], [0, 0]], 3: [[1, 2], [2, 0]] }, sums: [{ Rana: 2 }, {}] });
    const { events } = spustBitku(data, s);
    const log = events.flatMap((e) => (e.type === "log" && e.text.startsWith("Starší po bitke") ? [e.text] : []));
    const meno = (i: number): string => data.cards.get(s.starsi[i]!.karta.defId)!.name;
    expect(log).toEqual([`Starší po bitke: hráč 1 (víťaz) dostáva 9 špakov — ${meno(0)} 6 za strach; ${meno(3)} 1 za strach, 2 za reči.`]);
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

describe("§10 zajatie v11: krádež, väzni podľa ligy, Predsedova vila", () => {
  it("krádež najviac toľko, koľko súper má; väzni na výhru v Tretej lige 2 — hneď po rozdelení Nakladačky", () => {
    const s0 = pred({ markery: { 0: [[3, 0], [3, 3]], 4: "vazen-boris" }, sums: [{ Rana: 5 }, {}], spaky: [0, -1] });
    // Väzeň Borisa prejde Ane — v Tretej lige stačia na výhru dvaja.
    const s: GameState = { ...s0, lokalitCelkom: 3, vazni: s0.vazni.map((v) => ({ ...v, hrac: 0 })) };
    const t = dohraj(spustBitku(data, s).state, (x, p) => (p === 0 && x.bitkaStav?.krok === "prebytok" ? apply(data, x, { type: "prebytok", zdvihy: [], zajatia: [id(0)] }, 0).state : null));
    expect(t.koniec).toMatchObject({ vitaz: 0, body: null });
    expect(t.koniec?.dovod).toMatch(/výhra väzňami/);
    // Borisove reči pri ňom sú na červenej (3 investované); má len 2 (−1 a 3 z ich bodovania) — ukradnú sa 2.
    expect(t.nastenka.at(-1)?.kradez).toEqual([2, -2]);
    expect(t.spaky[1]).toBe(0);
  });
});

// Rozdelenie hádky (v10) a Nakladačky naraz (mock C · Pečať, Michal 2026-10-30): plán
// v klientovi (planRozdelenia) musí presne zodpovedať tomu, čo server urobí s ťahom.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { BitkaStav, GameState, MarkerPos, PlayerId } from "../src/index.ts";
import { apply, bitkaPoPlane, favourStarsieho, loadGameData, planRozdelenia, prepniVolbu, setupGame, starsiPreZvysok, viewFor, zvysokPrepadne } from "../src/index.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

/** Bitka v kroku hádky, ktorú hráč 0 vyhral o `hadka`. */
function bitka(b: Partial<BitkaStav>, hadka = 9): BitkaStav {
  return {
    krok: "hadka",
    caka: 0,
    sums: [{}, {}],
    exekutorHotovy: [true, true],
    hadka: { makke: [hadka, 0], vitaz: 0, velkost: hadka, zostava: hadka, prepadlo: 0, posuny: [] },
    exekutor: [0, 0],
    damage: null,
    vitaz: null,
    prebytokDrzi: null,
    prebytokZostava: 0,
    prebytokPosunute: [],
    spalit: [],
    vesticaHotova: true,
    ...b,
  };
}

/** Bitka v kroku hádky či Nakladačky; markery starších podľa zoznamu (chýbajúci = stred). */
function stav(b: Partial<BitkaStav>, markery: readonly number[] = [], hadka = 9): GameState {
  const s0 = setupGame(data, 21);
  return {
    ...s0,
    faza: "bitka",
    kolo: 2,
    utocnik: 1,
    strany: [[], []],
    ciel: { typ: "lokalita", lokalita: s0.lokalityVHre[0]! },
    lokalityVHre: s0.lokalityVHre.slice(1),
    starsi: s0.starsi.map((e, i) => ({ ...e, marker: (markery[i] ?? 3) as MarkerPos })),
    bitkaStav: bitka(b, hadka),
  };
}

const id = (s: GameState, i: number): string => s.starsi[i]!.elderId;

describe("plán rozdelenia = to, čo server urobí s ťahom", () => {
  it("hádka: priazeň zo stredu na víťazovu silu 3 stojí 6, zvyšok sa míňa v poradí volieb; marker stojí", () => {
    const s = stav({});
    const plan = planRozdelenia(s, 0, [{ elderId: id(s, 0) }, { elderId: id(s, 1) }]);
    // Víťaz je hráč 0 — jeho kraj je pole 0. Zvyšok 3 pri druhom: žltá 1 + oranžová 2.
    expect(plan.kroky.map((k) => [k.z, k.na, k.cena])).toEqual([
      [3, 0, 6],
      [3, 1, 3],
    ]);
    expect(plan.zvysok).toBe(0);
    const { state } = apply(data, s, plan.prikaz!, 0);
    expect(state.starsi.map((e) => e.marker)).toEqual(s.starsi.map((e) => e.marker));
  });

  it("súperova červená → stred stojí 4 + 3 + 2 (k stredu o 1 viac); na víťazovom kraji (sila 3) sa ďalej nedá", () => {
    const s = stav({}, [6, 0]);
    const plan = planRozdelenia(s, 0, [{ elderId: id(s, 0) }, { elderId: id(s, 1) }]);
    expect(plan.kroky[0]).toMatchObject({ z: 6, na: 3, cena: 9 });
    expect(plan.nevyslo).toEqual([{ elderId: id(s, 1) }]);
  });

  it("nedostatočný rozpočet: voľba, na ktorú zvyšok nestačí, vypadne z plánu aj zo zoznamu", () => {
    const s = stav({}, [3, 5], 3);
    // Prvý zje 3 (stred → žltá → oranžová), druhý z oranžovej k stredu by stál 3 — nič nezostalo.
    const volby = prepniVolbu(s, 0, prepniVolbu(s, 0, [], { elderId: id(s, 0) }), { elderId: id(s, 1) });
    expect(volby).toEqual([{ elderId: id(s, 0) }]);
    expect(planRozdelenia(s, 0, volby).zvysok).toBe(0);
  });

  it("ťah s výberom, na ktorý zvyšok nestačí, server odmietne celý — nič sa nevykoná", () => {
    const s = stav({}, [3, 5], 3);
    const zly = { type: "tah" as const, kroky: [{ type: "hadka" as const, elderId: id(s, 0) }, { type: "hadka" as const, elderId: id(s, 1) }] };
    expect(() => apply(data, s, zly, 0)).toThrow();
  });

  it("ťuk na toho istého staršieho výber zruší, na nového ho pridá na koniec", () => {
    const s = stav({});
    let volby = prepniVolbu(s, 0, [], { elderId: id(s, 0) });
    volby = prepniVolbu(s, 0, volby, { elderId: id(s, 1) });
    expect(volby).toEqual([{ elderId: id(s, 0) }, { elderId: id(s, 1) }]);
    expect(prepniVolbu(s, 0, volby, { elderId: id(s, 0) })).toEqual([{ elderId: id(s, 1) }]);
  });

  it("zvyšok, ktorý nekúpi nič, prepadne — starsiPreZvysok je prázdne a server krok uzavrie", () => {
    const s = stav({}, [3, 5, 5, 5, 5, 5, 5, 5], 2);
    const plan = planRozdelenia(s, 0, [{ elderId: id(s, 0) }]);
    expect(plan.zvysok).toBe(1);
    expect(starsiPreZvysok(s, 0, plan)).toEqual([]);
    expect(zvysokPrepadne(s, 0, plan)).toBe(true);
    const { state, events } = apply(data, s, plan.prikaz!, 0);
    expect(state.bitkaStav?.krok).not.toBe("hadka");
    expect(events.some((e) => e.type === "log" && e.text.includes("Hádka 1 prepadla"))).toBe(true);
  });

  it("starší v ohrození (pokus o zajatie) sa pri hádke posúva (v10 H4), pri Nakladačke nie (O8)", () => {
    const s0 = stav({});
    const s: GameState = { ...s0, pokusy: [null, { elderId: id(s0, 0) }] };
    expect(planRozdelenia(s, 0, [{ elderId: id(s, 0) }]).kroky.map((k) => k.elderId)).toEqual([id(s, 0)]);
    const sPrebytok: GameState = { ...s, bitkaStav: bitka({ krok: "prebytok", caka: 0, prebytokDrzi: 1, prebytokZostava: 3 }) };
    const plan = planRozdelenia(sPrebytok, 0, [{ elderId: id(s, 0) }, { elderId: id(s, 1) }]);
    expect(plan.nevyslo).toEqual([{ elderId: id(s, 0) }]);
    expect(() => apply(data, sPrebytok, { type: "prebytok", elderId: id(s, 0) }, 0)).toThrow();
  });

  it("Nakladačka: jeden smer k súperovi držiteľa, klient z verejného pohľadu plánuje to isté ako server", () => {
    const s = stav({ krok: "prebytok", caka: 0, prebytokDrzi: 1, prebytokZostava: 3 }, [3, 2]);
    const view = viewFor(data, s, 0);
    const plan = planRozdelenia(view, 0, [{ elderId: id(s, 1) }, { elderId: id(s, 0) }]);
    // Držiteľ je hráč 1 → markery idú k hráčovi 0 (polia 2, 1, 0).
    expect(plan.kroky.map((k) => [k.z, k.na, k.cena])).toEqual([
      [2, 1, 2],
      [3, 2, 1],
    ]);
    const { state } = apply(data, s, plan.prikaz!, 0);
    expect([state.starsi[0]!.marker, state.starsi[1]!.marker]).toEqual([2, 1]);
  });

  it("hádka z verejného pohľadu: plán počíta s klebetami, ktoré už víťaz rozdelil", () => {
    const s = stav({}, [3, 3], 4);
    const po = apply(data, s, { type: "hadka", elderId: id(s, 0) }, 0).state;
    // Prvý výber: stred → žltá (1) → oranžová (2), zvyšok 1.
    expect(po.bitkaStav).toMatchObject({ krok: "hadka", caka: 0 });
    expect(po.bitkaStav?.hadka?.zostava).toBe(1);
    const view = viewFor(data, po, 0);
    expect(view.bitkaStav?.klebety).toEqual({ [id(s, 0)]: 2 });
    // Ďalší výber toho istého staršieho začína z oranžovej (polohaPriazne) — na červenú by treba 3.
    expect(planRozdelenia(view, 0, [{ elderId: id(s, 0) }]).kroky).toEqual([]);
    expect(planRozdelenia(view, 0, [{ elderId: id(s, 1) }]).kroky.map((k) => [k.z, k.na])).toEqual([[3, 2]]);
  });

  it("zvyšok, ktorý ešte niekoho posunie, neprepadne — server po ťahu čaká na ďalší výber", () => {
    const s = stav({}, [3, 3], 2);
    const plan = planRozdelenia(s, 0, [{ elderId: id(s, 0) }]);
    expect(plan.zvysok).toBe(1);
    expect(zvysokPrepadne(s, 0, plan)).toBe(false);
    const { state } = apply(data, s, plan.prikaz!, 0);
    expect(state.bitkaStav).toMatchObject({ krok: "hadka", caka: 0 });
  });

  it("bitka po pláne: hádka na Bitkára pridá tuhé už v tejto bitke", () => {
    const s0 = stav({}, [], 1);
    const sc = data.scorecards.find((x) => x.favour === "BITKAR");
    expect(sc).toBeDefined();
    const s: GameState = { ...s0, starsi: s0.starsi.map((e, i) => (i === 0 ? { ...e, scorecard: sc!.id } : e)) };
    expect(favourStarsieho(data, s.starsi[0]!)).toBe("BITKAR");
    const view = viewFor(data, s, 0);
    const b = bitkaPoPlane(data, view, planRozdelenia(view, 0, [{ elderId: id(s, 0) }]));
    expect(b).not.toBeNull();
    expect(b!.po.tuhe[0]).toBe(b!.pred.tuhe[0] + 1);
    expect(bitkaPoPlane(data, view, planRozdelenia(view, 0, []))).toBeNull();
  });

  it("mimo kroku hráča plán nič neponúkne — porazený v hádke nerozdeľuje", () => {
    const s = stav({ caka: 1 });
    const plan = planRozdelenia(s, 0 as PlayerId, [{ elderId: id(s, 0) }]);
    expect(plan.prikaz).toBeNull();
    expect(planRozdelenia(s, 1, [{ elderId: id(s, 0) }]).prikaz).toBeNull();
  });
});

// Rozdelenie Pohoršenia a prebytku naraz (mock C · Pečať, Michal 2026-10-30): plán
// v klientovi (planRozdelenia) musí presne zodpovedať tomu, čo server urobí s ťahom.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { BitkaStav, GameState, MarkerPos, PlayerId, VolbaRozdelenia } from "../src/index.ts";
import { apply, bitkaPoPlane, favourStarsieho, loadGameData, planRozdelenia, prepniVolbu, setupGame, starsiPreZvysok, viewFor, zvysokPrepadne } from "../src/index.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

function bitka(b: Partial<BitkaStav>): BitkaStav {
  return {
    krok: "pohorsenie",
    caka: 0,
    sums: [{}, {}],
    exekutorHotovy: [true, true],
    pohorsenieZostava: [0, 0],
    exekutor: [0, 0],
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

/** Bitka v kroku Pohoršenia či prebytku; markery starších podľa zoznamu (chýbajúci = stred). */
function stav(b: Partial<BitkaStav>, markery: readonly number[] = []): GameState {
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
    bitkaStav: bitka(b),
  };
}

const id = (s: GameState, i: number): string => s.starsi[i]!.elderId;

describe("plán rozdelenia = to, čo server urobí s ťahom", () => {
  it("Pohoršenie: stred → červená súpera stojí 6, zvyšok sa míňa v poradí volieb", () => {
    const s = stav({ pohorsenieZostava: [8, 0] });
    const volby: VolbaRozdelenia[] = [{ elderId: id(s, 0) }, { elderId: id(s, 1), kSebe: true }];
    const plan = planRozdelenia(s, 0, volby);
    // Hráč 0 → súper je hráč 1, jeho kraj je pole 6.
    // Zvyšok 2 pri druhom: stred → žltá stojí 1, ďalšie pole na oranžovú 2 už nevyjde.
    expect(plan.kroky.map((k) => [k.z, k.na, k.cena])).toEqual([
      [3, 6, 6],
      [3, 2, 1],
    ]);
    expect(plan.zvysok).toBe(1);
    const { state } = apply(data, s, plan.prikaz!, 0);
    expect(state.starsi[0]!.marker).toBe(6);
    expect(state.starsi[1]!.marker).toBe(2);
  });

  it("červená → oranžová stojí 4 (k stredu o 1 viac); na kraji sa ďalej nedá", () => {
    const s = stav({ pohorsenieZostava: [5, 0] }, [6, 6]);
    const plan = planRozdelenia(s, 0, [{ elderId: id(s, 0), kSebe: true }, { elderId: id(s, 1) }]);
    expect(plan.kroky).toHaveLength(1);
    expect(plan.kroky[0]).toMatchObject({ z: 6, na: 5, cena: 4 });
    // K súperovi (pole 6 je jeho kraj) sa marker na kraji nepohne — voľba nevyšla.
    expect(plan.nevyslo).toEqual([{ elderId: id(s, 1) }]);
  });

  it("nedostatočný rozpočet: voľba, na ktorú zvyšok nestačí, vypadne z plánu aj zo zoznamu", () => {
    const s = stav({ pohorsenieZostava: [3, 0] }, [3, 5]);
    // Prvý zje 3 (stred → žltá → oranžová), druhý z oranžovej k stredu by stál 3 — nič nezostalo.
    const volby = prepniVolbu(s, 0, prepniVolbu(s, 0, [], { elderId: id(s, 0) }), { elderId: id(s, 1), kSebe: true });
    expect(volby).toEqual([{ elderId: id(s, 0) }]);
    expect(planRozdelenia(s, 0, volby).zvysok).toBe(0);
  });

  it("ťah s posunom, na ktorý zvyšok nestačí, server odmietne celý — nič sa nevykoná", () => {
    const s = stav({ pohorsenieZostava: [3, 0] }, [3, 5]);
    const zly = { type: "tah" as const, kroky: [{ type: "pohorsenie" as const, elderId: id(s, 0) }, { type: "pohorsenie" as const, elderId: id(s, 1), kSebe: true }] };
    expect(() => apply(data, s, zly, 0)).toThrow();
  });

  it("prehodenie smeru ostane na tom istom mieste v poradí; ten istý smer posun zruší", () => {
    const s = stav({ pohorsenieZostava: [4, 0] });
    let volby = prepniVolbu(s, 0, [], { elderId: id(s, 0) });
    volby = prepniVolbu(s, 0, volby, { elderId: id(s, 1) });
    volby = prepniVolbu(s, 0, volby, { elderId: id(s, 0), kSebe: true });
    expect(volby).toEqual([{ elderId: id(s, 0), kSebe: true }, { elderId: id(s, 1) }]);
    const plan = planRozdelenia(s, 0, volby);
    expect(plan.kroky.map((k) => k.na)).toEqual([1, 4]);
    expect(prepniVolbu(s, 0, volby, { elderId: id(s, 1) })).toEqual([{ elderId: id(s, 0), kSebe: true }]);
    const { state } = apply(data, s, plan.prikaz!, 0);
    expect([state.starsi[0]!.marker, state.starsi[1]!.marker]).toEqual([1, 4]);
  });

  it("zvyšok, ktorý nekúpi nič, prepadne — starsiPreZvysok je prázdne a server krok uzavrie", () => {
    const s = stav({ pohorsenieZostava: [2, 0] }, [3, 1, 1, 1, 1, 1, 1, 1]);
    const plan = planRozdelenia(s, 0, [{ elderId: id(s, 0) }]);
    expect(plan.zvysok).toBe(1);
    expect(starsiPreZvysok(s, 0, plan)).toEqual([]);
    expect(zvysokPrepadne(s, 0, plan)).toBe(true);
    const { state, events } = apply(data, s, plan.prikaz!, 0);
    expect(state.bitkaStav?.krok).not.toBe("pohorsenie");
    expect(events.some((e) => e.type === "log" && e.text.includes("stráca 1 Pohoršenie"))).toBe(true);
  });

  it("starší v ohrození (pokus o zajatie, v9) sa nehýbe — plán aj server rovnako", () => {
    const s0 = stav({ pohorsenieZostava: [3, 0] });
    const s: GameState = { ...s0, pokusy: [null, { elderId: id(s0, 0) }] };
    const plan = planRozdelenia(s, 0, [{ elderId: id(s, 0) }, { elderId: id(s, 1) }]);
    expect(plan.nevyslo).toEqual([{ elderId: id(s, 0) }]);
    expect(plan.kroky.map((k) => k.elderId)).toEqual([id(s, 1)]);
    expect(() => apply(data, s, { type: "pohorsenie", elderId: id(s, 0) }, 0)).toThrow();
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
    // kSebe pri prebytku nič nemení — smer je daný.
    expect(planRozdelenia(view, 0, [{ elderId: id(s, 1), kSebe: true }]).kroky[0]?.na).toBe(1);
    const { state } = apply(data, s, plan.prikaz!, 0);
    expect([state.starsi[0]!.marker, state.starsi[1]!.marker]).toEqual([2, 1]);
  });

  it("zvyšok, ktorý ešte niekoho posunie, neprepadne — server po ťahu čaká na ďalší posun", () => {
    const s = stav({ pohorsenieZostava: [4, 0] }, [3, 3]);
    const plan = planRozdelenia(s, 0, [{ elderId: id(s, 0) }]);
    expect(plan.zvysok).toBe(1);
    expect(zvysokPrepadne(s, 0, plan)).toBe(false);
    const { state } = apply(data, s, plan.prikaz!, 0);
    expect(state.bitkaStav).toMatchObject({ krok: "pohorsenie", caka: 0, pohorsenieZostava: [1, 0] });
  });

  it("bitka po pláne: Pohoršenie k sebe na Bitkára pridá tuhé už v tejto bitke", () => {
    const s0 = stav({ pohorsenieZostava: [1, 0] });
    const sc = data.scorecards.find((x) => x.favour === "BITKAR");
    expect(sc).toBeDefined();
    const s: GameState = { ...s0, starsi: s0.starsi.map((e, i) => (i === 0 ? { ...e, scorecard: sc!.id } : e)) };
    const bitkar = 0;
    expect(favourStarsieho(data, s.starsi[bitkar]!)).toBe("BITKAR");
    const view = viewFor(data, s, 0);
    const plan = planRozdelenia(view, 0, [{ elderId: id(s, bitkar), kSebe: true }]);
    const b = bitkaPoPlane(data, view, plan);
    expect(b).not.toBeNull();
    expect(b!.po.tuhe[0]).toBe(b!.pred.tuhe[0] + 1);
    expect(bitkaPoPlane(data, view, planRozdelenia(view, 0, []))).toBeNull();
  });

  it("mimo kroku hráča plán nič neponúkne", () => {
    const s = stav({ pohorsenieZostava: [0, 4], caka: 1 });
    const plan = planRozdelenia(s, 0 as PlayerId, [{ elderId: id(s, 0) }]);
    expect(plan.prikaz).toBeNull();
    expect(plan.kroky).toEqual([]);
  });
});

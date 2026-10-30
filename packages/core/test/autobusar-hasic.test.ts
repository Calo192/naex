// Autobusár a Hasič (Michal 2026-10-26, brainstorming kariet).
// Autobusár, variant A „dôsledný“: jeden Absťák ignoruje všade, kde sa v bitke
// rátajú — v poškodení, pri remíze v tuhom aj v špakoch víťaza.
// Hasič: Nástup vytiahne náhodnú kartu z vlastného odhadzovacieho balíčka (aj
// kliatbu) a hráč sa rozhodne, či si ju nechá v ruke, alebo ju vráti.
// Očakávané hodnoty sú z pravidla, nie z kódu.

import { describe, expect, it } from "vitest";
// Sada v6 (pred revíziou v7): test stráži pravidlá, ktoré revízia sady nemení.
import cardsJson from "./data/cards-v6.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { BitkaStav, CardInstance, Event, GameState, MarkerPos, PlacedCard, PlayerId } from "../src/index.ts";
import { apply, legalCommands, loadGameData, naTahu, rngSeed, setupGame, stavkaBitky, tahBota, viewFor } from "../src/index.ts";
import { naexOdkryte } from "./helpers.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

let uidSeq = 770000;
const inst = (defId: string): CardInstance => ({ uid: ++uidSeq, defId, leftLayout: 0, rightLayout: 0 });

// ---------------------------------------------------------------------------
// Autobusár

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
 * Bitka o Krčmu čaká na posledné Pohoršenie hráča 0; potom sa poškodenie
 * vyhodnotí zo súčtov `sums`. Hráč 0 má priznaných `abstaky[0]` Absťákov,
 * hráč 1 `abstaky[1]`; s `autobusar` leží Autobusár v partii hráča 0.
 */
function predPoskodenim(o: { sums: BitkaStav["sums"]; abstaky: readonly [number, number]; autobusar: boolean; pitky?: number }): GameState {
  const s0 = setupGame(data, 5);
  const abstaky = (n: number): CardInstance[] => Array.from({ length: n }, () => inst("abstak"));
  const strany: GameState["strany"] = [o.autobusar ? [{ card: inst("autobusar"), playedBy: 0 }] : [], []];
  return {
    ...s0,
    faza: "bitka",
    kolo: 3,
    utocnik: 1,
    strany,
    ciel: { typ: "lokalita", lokalita: s0.lokalityVHre.find((k) => k.defId === "krcma") ?? inst("krcma") },
    lokalityVHre: s0.lokalityVHre.filter((k) => k.defId !== "krcma"),
    pitkaCislo: o.pitky ?? 2,
    pitkyCelkom: o.pitky ?? 2,
    starsi: s0.starsi.map((e) => ({ ...e, marker: 3 as MarkerPos })),
    hraci: [
      { ...s0.hraci[0], priznane: abstaky(o.abstaky[0]) },
      { ...s0.hraci[1], priznane: abstaky(o.abstaky[1]) },
    ],
    bitkaStav: bitka({ krok: "pohorsenie", caka: 0, pohorsenieZostava: [1, 0], sums: o.sums }),
  };
}

const vyhodnot = (s: GameState) => apply(data, s, { type: "pohorsenie", elderId: s.starsi[0]!.elderId }, 0);


// ---------------------------------------------------------------------------
// Hasič

/** Zhromaždenie o Jednotu, hráč 0 na ťahu s rukou a odhadzovacím balíčkom. */
function vZhromazdeni(ruka: CardInstance[], odhadzovaci: CardInstance[]): GameState {
  const s = setupGame(data, 11);
  return {
    ...s,
    faza: "zhromazdenie",
    ciel: { typ: "lokalita", lokalita: inst("jednota") },
    pitkyCelkom: 1,
    pitkaCislo: 0,
    strany: [[], []],
    hraci: [
      { ...s.hraci[0], ruka, odhadzovaci, cigarety: 3, poldeciPlne: 2 },
      { ...s.hraci[1], ruka: [inst("pijan")], odhadzovaci: [inst("svokra"), inst("cirhoza")], cigarety: 3, poldeciPlne: 2 },
    ],
    zhromazdenieStav: { naTahu: 0, zostavaLimit: [3, 3], pasoval: [false, false], navyse: [0, 0] },
  } as GameState;
}

const uids = (karty: readonly CardInstance[]): number[] => karty.map((k) => k.uid);

describe("Hasič: náhodná karta z vlastného odhadzovacieho balíčka, hráč ju nechá alebo vráti", () => {
  it("§16 Hasič: vytiahne kartu z VLASTNÉHO odhadzovacieho balíčka deterministicky zo semienka hry; aj kliatbu", () => {
    const hasic = inst("hasic");
    const odhadzovaci = [inst("ministrant"), inst("cirhoza"), inst("pijan")];
    const s = vZhromazdeni([hasic], odhadzovaci);
    const cmd = { type: "place", uid: hasic.uid, target: "vlastna" } as const;
    const a = apply(data, s, cmd, 0).state;
    const b = apply(data, s, cmd, 0).state;
    expect(a.hasicVolby).toEqual(b.hasicVolby);
    expect(uids(odhadzovaci)).toContain(a.hasicVolby?.[0]?.uid);
    // Rôzne semienka ťahajú rôzne karty — vždy len z vlastného balíčka, aj Cirhózu.
    const vytiahnute = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      const po = apply(data, { ...s, rng: rngSeed(seed) }, cmd, 0).state;
      const uid = po.hasicVolby?.[0]?.uid;
      expect(uids(odhadzovaci)).toContain(uid);
      vytiahnute.add(odhadzovaci.find((k) => k.uid === uid)!.defId);
    }
    expect([...vytiahnute].sort()).toEqual(["cirhoza", "ministrant", "pijan"]);
  });

  it("§16 Hasič: kým hráč nerozhodne, hrá len on a len túto voľbu; karta zatiaľ leží v odhadzovacom", () => {
    const hasic = inst("hasic");
    const pijan = inst("pijan");
    const s = vZhromazdeni([hasic, pijan], [inst("ministrant")]);
    const po = apply(data, s, { type: "place", uid: hasic.uid, target: "vlastna" }, 0).state;
    expect(naTahu(po)).toBe(0);
    expect(legalCommands(data, po, 0)).toEqual([{ type: "hasic", nechat: true }, { type: "hasic", nechat: false }]);
    expect(legalCommands(data, po, 1)).toEqual([]);
    expect(() => apply(data, po, { type: "place", uid: pijan.uid, target: "vlastna" }, 0)).toThrow(/Hasič/);
    expect(() => apply(data, po, { type: "pass" }, 1)).toThrow(/na ťahu/);
    expect(po.hraci[0].odhadzovaci).toHaveLength(1);
  });

  it("§16 Hasič: nechať — karta ide z odhadzovacieho do ruky, potom je na ťahu súper", () => {
    const hasic = inst("hasic");
    const ministrant = inst("ministrant");
    const s = vZhromazdeni([hasic], [ministrant]);
    const po = apply(data, s, { type: "place", uid: hasic.uid, target: "vlastna" }, 0).state;
    const { state, events } = apply(data, po, { type: "hasic", nechat: true }, 0);
    expect(uids(state.hraci[0].ruka)).toEqual([ministrant.uid]);
    expect(state.hraci[0].odhadzovaci).toEqual([]);
    expect(state.hasicVolby).toEqual([]);
    expect(naTahu(state)).toBe(1);
    expect(events.some((e) => e.type === "log" && e.text.includes("Hasič") && e.text.includes("necháva"))).toBe(true);
  });

  it("§16 Hasič: vrátiť — karta ostáva v odhadzovacom balíčku, ruka sa nemení", () => {
    const hasic = inst("hasic");
    const cirhoza = inst("cirhoza");
    const s = vZhromazdeni([hasic], [cirhoza]);
    const po = apply(data, s, { type: "place", uid: hasic.uid, target: "vlastna" }, 0).state;
    const state = apply(data, po, { type: "hasic", nechat: false }, 0).state;
    expect(state.hraci[0].ruka).toEqual([]);
    expect(uids(state.hraci[0].odhadzovaci)).toEqual([cirhoza.uid]);
    expect(naTahu(state)).toBe(1);
  });

  it("§16 Hasič: s prázdnym odhadzovacím balíčkom sa nič nestane a ťah ide ďalej", () => {
    const hasic = inst("hasic");
    const s = vZhromazdeni([hasic], []);
    const { state, events } = apply(data, s, { type: "place", uid: hasic.uid, target: "vlastna" }, 0);
    expect(state.hasicVolby ?? []).toEqual([]);
    expect(naTahu(state)).toBe(1);
    expect(events.some((e) => e.type === "log" && e.text.includes("prázdny odhadzovací"))).toBe(true);
  });

  it("§16 Hasič v ťahu naraz: zvyšok ťahu sa zahrá, o karte hráč rozhodne potom; ťah bez Vypiť po Hasičovi neprejde", () => {
    const hasic = inst("hasic");
    const pijan = inst("pijan");
    const s = vZhromazdeni([hasic, pijan], [inst("ministrant")]);
    const tah = { type: "tah", kroky: [{ type: "vypit" }, { type: "place", uid: hasic.uid, target: "vlastna" }, { type: "place", uid: pijan.uid, target: "vlastna" }] } as const;
    const po = apply(data, s, tah, 0).state;
    expect(po.strany[0].map((pl) => pl.card.defId)).toEqual(["hasic", "pijan"]);
    expect(po.hasicVolby).toHaveLength(1);
    expect(naTahu(po)).toBe(0);
    expect(naTahu(apply(data, po, { type: "hasic", nechat: false }, 0).state)).toBe(1);
    // Čakanie na Hasiča nesmie predĺžiť ťah: bez Vypiť ťah končí Hasičom.
    const bezVypit = { type: "tah", kroky: [{ type: "place", uid: hasic.uid, target: "vlastna" }, { type: "place", uid: pijan.uid, target: "vlastna" }] } as const;
    expect(() => apply(data, s, bezVypit, 0)).toThrow(/Ťah sa skončil/);
  });

  it("§16 Hasič: súper vidí len verejné — kartu z odhadzovacieho (ten je verejný), nie ruku", () => {
    const hasic = inst("hasic");
    const vRuke = inst("svokra");
    const ministrant = inst("ministrant");
    const s = vZhromazdeni([hasic, vRuke], [ministrant]);
    const po = apply(data, s, { type: "place", uid: hasic.uid, target: "vlastna" }, 0).state;
    const moj = viewFor(data, po, 0);
    const jeho = viewFor(data, po, 1);
    expect(moj.hasicVolba).toEqual({ hrac: 0, karta: ministrant });
    expect(jeho.hasicVolba).toEqual({ hrac: 0, karta: ministrant });
    expect(jeho.hraci[0].odhadzovaci).toContainEqual(ministrant);
    expect(JSON.stringify(jeho)).not.toContain(`"uid":${vRuke.uid}`);
    // Po rozhodnutí: súper vie len, že ruka podrástla a karta z odhadzovacieho zmizla.
    const nechal = viewFor(data, apply(data, po, { type: "hasic", nechat: true }, 0).state, 1);
    expect(nechal.hasicVolba).toBeNull();
    expect(nechal.hraci[0].rukaPocet).toBe(2);
    expect(JSON.stringify(nechal)).not.toContain(`"uid":${vRuke.uid}`);
  });

  it("§16 Hasič ako odpoveď na NA EX: Nástup pri otočení odpovedí (v9.2), Pitka sa vyhodnotí až po voľbe", () => {
    const s0 = setupGame(data, 12);
    const pijan: PlacedCard = { card: inst("pijan"), playedBy: 0 };
    const hasic = inst("hasic");
    const ministrant = inst("ministrant");
    const s = {
      ...s0,
      faza: "pitka",
      ciel: { typ: "lokalita", lokalita: inst("jednota") },
      pitkyCelkom: 1,
      pitkaCislo: 1,
      strany: [[pijan], []],
      hraci: [
        { ...s0.hraci[0], poldeciPlne: 1, cigarety: 3 },
        { ...s0.hraci[1], ruka: [hasic], odhadzovaci: [ministrant], poldeciPlne: 1, cigarety: 3 },
      ],
      pitkaStav: { naTahu: 0, hotovy: [false, false], naexPouzity: [false, false], fajcenie: [0, 0], reakcia: null, postarka: [false, false], starosta: [false, false] },
    } as GameState;
    const naex = naexOdkryte(data, s, pijan.card.uid, 0).state;
    expect(naex.pitkaStav?.reakcia).toBe(1);
    const odpoved = apply(data, naex, { type: "place", uid: hasic.uid, target: "vlastna" }, 1);
    expect(odpoved.state.hasicVolby?.[0]).toMatchObject({ hrac: 1, uid: ministrant.uid, potom: "odpovede" });
    expect(odpoved.state.pitkaStav?.reakcia).toBeNull();
    expect(odpoved.events.some((e) => e.type === "pitkaVysledok")).toBe(false);
    const volba = apply(data, odpoved.state, { type: "hasic", nechat: true }, 1);
    expect(volba.events.some((e) => e.type === "pitkaVysledok")).toBe(true);
    expect(uids(volba.state.hraci[1].ruka)).toContain(ministrant.uid);
  });

  it("§16 Hasič ako Záverečná: otočí sa na konci Pitky a Pitka sa dokončí až po voľbe", () => {
    const s0 = setupGame(data, 12);
    const hasic = inst("hasic");
    const cirhoza = inst("cirhoza");
    const s = {
      ...s0,
      faza: "pitka",
      ciel: { typ: "lokalita", lokalita: inst("jednota") },
      pitkyCelkom: 1,
      pitkaCislo: 1,
      strany: [[{ card: hasic, playedBy: 0, zaverecna: true }], []],
      hraci: [
        { ...s0.hraci[0], odhadzovaci: [cirhoza], poldeciPlne: 1, cigarety: 3 },
        { ...s0.hraci[1], poldeciPlne: 1, cigarety: 3 },
      ],
      pitkaStav: { naTahu: 0, hotovy: [false, false], naexPouzity: [false, false], fajcenie: [0, 0], reakcia: null, postarka: [false, false], starosta: [false, false] },
    } as GameState;
    let st = s;
    for (let i = 0; i < 4 && !(st.hasicVolby?.length ?? 0) && st.faza === "pitka"; i++) {
      const kto = naTahu(st) as PlayerId;
      st = apply(data, st, { type: "skipNaex" }, kto).state;
    }
    expect(st.faza).toBe("pitka");
    expect(st.strany[0][0]?.zaverecna).toBeUndefined();
    expect(st.hasicVolby?.[0]).toMatchObject({ hrac: 0, uid: cirhoza.uid, potom: "koniecPitky" });
    const po = apply(data, st, { type: "hasic", nechat: false }, 0).state;
    expect(po.faza).not.toBe("pitka");
    expect(uids(po.hraci[0].odhadzovaci)).toContain(cirhoza.uid);
  });

  it("bot: kliatbu od Hasiča vráti, inú kartu si nechá", () => {
    const cirhoza = inst("cirhoza");
    const ministrant = inst("ministrant");
    const s = vZhromazdeni([], [cirhoza, ministrant]);
    const cakaNa = (uid: number): GameState => ({ ...s, hasicVolby: [{ hrac: 0, uid, potom: null }] });
    expect(tahBota(data, cakaNa(cirhoza.uid), 0, 3)).toEqual({ type: "hasic", nechat: false });
    expect(tahBota(data, cakaNa(ministrant.uid), 0, 3)).toEqual({ type: "hasic", nechat: true });
  });
});

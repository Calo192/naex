// Zmeny pravidiel z interview Michala 2026-10-19: Pitky podľa akcií lokality,
// priznanie každej kliatby = karta, +2 karty po bitke bez limitu ruky,
// Zberateľ (od 2026-10-20 Úžerník), Dedičstvo s rastúcou cenou, Milujúca manželka, Nástroj v línii,
// Veľmi smútiaca vdova a Vychovávateľka.

import { describe, expect, it } from "vitest";
// Sada v6 (pred revíziou v7): test stráži pravidlá, ktoré revízia sady nemení.
import cardsJson from "./data/cards-v6.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { BitkaStav, CardDef, CardInstance, Command, GameData, GameState, PlacedCard, PlayerId } from "../src/index.ts";
import {
  KONSTANTY,
  apply,
  buildGameData,
  cenaDedicstva,
  evaluateLine,
  favourStarsieho,
  legalCommands,
  loadGameData,
  naTahu,
  parseScorecards,
  planVykladania,
  poskodenieBitky,
  prahyHraca,
  priazenZKluca,
  pocetPitiek,
  setupGame,
  viewFor,
} from "../src/index.ts";
import type { Layout4 } from "./helpers.ts";
import { instanceFor, makeDef, syntheticData, naexOdkryte } from "./helpers.ts";
import { setupSBalickom } from "./helpers.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);
const EMPTY: Layout4 = [null, null, null, null];

let uidSeq = 97000;
const inst = (defId: string): CardInstance => ({ uid: ++uidSeq, defId, leftLayout: 0, rightLayout: 0 });

function sadaS(...defs: CardDef[]): GameData {
  const cards = new Map(data.cards);
  for (const d of defs) cards.set(d.id, d);
  return buildGameData(cards, data.elders, parseScorecards(scorecardsJson));
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
    pohrebHotovy: [true, true],
    benzinkaZostava: [0, 0],

    karHotovy: [true, true],
    spalit: [],
    vesticaHotova: true,
    ...b,
  };
}

function sHracom(s: GameState, p: PlayerId, h: Partial<GameState["hraci"][0]>): GameState {
  const hraci = [...s.hraci] as [GameState["hraci"][0], GameState["hraci"][1]];
  hraci[p] = { ...hraci[p], ...h };
  return { ...s, hraci };
}

/** Stav pred Pohrebom (hráč 0 ju preskočí) — bitka potom dobehne do ďalšieho kola. */
function predKoncomBitky(seed: number, uprav: (s: GameState) => GameState = (s) => s): GameState {
  const s0 = setupSBalickom(data, seed);
  return uprav({
    ...s0,
    faza: "bitka",
    kolo: 2,
    strany: [[], []],
    ciel: { typ: "lokalita", lokalita: s0.lokalityVHre[0]! },
    lokalityVHre: s0.lokalityVHre.slice(1),
    bitkaStav: bitka({ krok: "pohreb", caka: 0, pohrebHotovy: [false, true] }),
  });
}

// --- Pitky -------------------------------------------------------------------

// Lokalita: tri Rany na strane hráča 0, jedna Viera na strane hráča 1.
const lokP = makeDef("lok_pitky", ["Rana", "Rana", "Rana", null], [null, "Viera", null, null], { tags: ["Lokalita"] });
// Karta hráča 0 aktivuje všetky tri akcie lokality; karta hráča 1 (otočená) jednu.
const tri = makeDef("tri_spoje", EMPTY, ["Rana", "Rana", "Rana", null]);
const jeden = makeDef("jeden_spoj", EMPTY, [null, null, "Rana", null]);
const sadaP = sadaS(lokP, tri, jeden);

function vZhromazdeni(strany: GameState["strany"]): GameState {
  const s0 = setupSBalickom(sadaP, 31);
  return {
    ...s0,
    faza: "zhromazdenie",
    utocnik: 0,
    ciel: { typ: "lokalita", lokalita: instanceFor(sadaP, "lok_pitky", ["Rana", "Rana", "Rana", null], [null, "Viera", null, null]) },
    lokalitaOtocena: false,
    strany,
    pitkyCelkom: 1,
    pitkaCislo: 0,
    zhromazdenieStav: { naTahu: 1, zostavaLimit: [0, 0], pasoval: [false, false], navyse: [0, 0] },
  };
}

const kartaTri = (): PlacedCard => ({ card: instanceFor(sadaP, "tri_spoje", EMPTY, ["Rana", "Rana", "Rana", null]), playedBy: 0 });
const kartaJeden = (): PlacedCard => ({ card: instanceFor(sadaP, "jeden_spoj", EMPTY, [null, null, "Rana", null]), playedBy: 1 });

describe("Pitky = 1 + menší počet aktivovaných akcií lokality (Michal 2026-10-19)", () => {
  it("3 a 1 aktivované akcie → 2 Pitky; jedna strana prázdna → 1 Pitka", () => {
    expect(evaluateLine(sadaP, { lokalita: vZhromazdeni([[], []]).ciel!.lokalita, lokalitaOtocena: false, strany: [[kartaTri()], [kartaJeden()]] }).aktivneStredu).toEqual([3, 1]);
    expect(pocetPitiek(sadaP, vZhromazdeni([[kartaTri()], [kartaJeden()]]))).toBe(2);
    expect(pocetPitiek(sadaP, vZhromazdeni([[kartaTri()], []]))).toBe(1);
    expect(pocetPitiek(sadaP, vZhromazdeni([[], []]))).toBe(1);
  });

  it("po prvej Pitke ide ďalšie Zhromaždenie a druhá Pitka, potom bitka", () => {
    let s = vZhromazdeni([[kartaTri()], [kartaJeden()]]);
    const skus = (typ: "pass" | "skipNaex"): void => {
      s = apply(sadaP, s, { type: typ }, naTahu(s)!).state;
    };
    skus("pass");
    skus("pass");
    expect(s.faza).toBe("pitka");
    expect([s.pitkaCislo, s.pitkyCelkom]).toEqual([1, 2]);
    skus("skipNaex");
    skus("skipNaex");
    expect(s.faza).toBe("zhromazdenie");
    skus("pass");
    skus("pass");
    expect([s.pitkaCislo, s.pitkyCelkom]).toEqual([2, 2]);
    skus("skipNaex");
    skus("skipNaex");
    expect(s.faza).toBe("bitka");
  });

  it("„Ešte jednu!“ už nie je — po jedinej Pitke ide rovno bitka", () => {
    let s = vZhromazdeni([[kartaTri()], []]);
    for (let i = 0; i < 4 && s.faza !== "bitka"; i++) s = apply(sadaP, s, { type: s.faza === "zhromazdenie" ? "pass" : "skipNaex" }, naTahu(s)!).state;
    expect(s.faza).toBe("bitka");
  });
});

// --- Ruka ----------------------------------------------------------------------

describe("ruka: +2 karty po bitke, žiadny limit ruky (Michal 2026-10-19)", () => {
  it("po bitke si každý dobere 2 karty, veľkú ruku nikto neodhadzuje", () => {
    const ruka = Array.from({ length: 9 }, () => inst("pijan"));
    // 7 štartoviek (Michal 2026-10-22): doberací doplnený na 5, aby balíček neklesol pod 5.
    const s = predKoncomBitky(40, (st) =>
      sHracom(sHracom(st, 0, { ruka }), 1, { ruka: [], doberaci: [...st.hraci[1].doberaci, inst("pijan"), inst("pijan"), inst("pijan")] }),
    );
    const po = apply(data, s, { type: "skipPohreb" }, 0).state;
    expect(po.faza).toBe("volbaCiela");
    expect(po.hraci[0].ruka).toHaveLength(9 + KONSTANTY.KARTY_PO_BITKE);
    expect(po.hraci[1].ruka).toHaveLength(KONSTANTY.KARTY_PO_BITKE);
  });

  it("štart: 2 poldeci (Michal 2026-10-20), 3 cigarety, 4 karty v ruke (v6)", () => {
    const s = setupSBalickom(data, 41);
    for (const p of [0, 1] as const) {
      expect([s.hraci[p].poldeciPlne, s.hraci[p].cigarety, s.hraci[p].ruka.length]).toEqual([2, 3, 4]);
    }
  });
});

describe("Úžerník (Michal 2026-10-20): prah Dlhu 2 + sila, Zberateľ zanikol", () => {
  it("v5: priazeň Úžerníka (Kmotra) prah Dlhu nemení — obaja majú prah 2", () => {
    const s0 = setupSBalickom(data, 42);
    const uzernik = s0.starsi.find((e) => favourStarsieho(data, e) === "UZERNIK")!;
    // Marker na 1 = priazeň hráča 0, sila 2.
    const s: GameState = { ...s0, starsi: s0.starsi.map((e) => (e === uzernik ? { ...e, marker: 1} : e)) };
    expect(prahyHraca(data, s, 0).dlh).toBe(2);
    expect(prahyHraca(data, s, 1).dlh).toBe(2);
  });

  it("po bitke sa už nič neprezerá — po Pohrebe ide hra rovno do ďalšieho kola", () => {
    const s = predKoncomBitky(42);
    const ruka = s.hraci[0].ruka.length;
    const po = apply(data, s, { type: "skipPohreb" }, 0).state;
    expect(po.faza).toBe("volbaCiela");
    expect(po.hraci[0].ruka).toHaveLength(ruka + KONSTANTY.KARTY_PO_BITKE);
  });

  it("stará sada so Zberateľom alebo Očumovateľom sa načíta ako Úžerník", () => {
    expect(priazenZKluca("ZBERATEL")).toBe("UZERNIK");
    expect(priazenZKluca("OCUMOVATEL")).toBe("UZERNIK");
  });
});

// --- Kliatby ---------------------------------------------------------------------

/** Lokalita bez efektu na Zhromaždenie (Kostol, Most, Zastávka, Benzínka, Družstvo by test menili). */
const OBYCAJNA = ["krcma", "ihrisko", "lesna_cesta", "zberny_dvor"];

function vZhromazdeniHrac0(seed: number, h: Partial<GameState["hraci"][0]>): GameState {
  const s0 = setupSBalickom(data, seed);
  const lokalita = s0.lokalityVHre.find((k) => OBYCAJNA.includes(k.defId)) ?? inst("krcma");
  return sHracom(
    {
      ...s0,
      faza: "zhromazdenie",
      ciel: { typ: "lokalita", lokalita },
      lokalityVHre: s0.lokalityVHre.slice(1),
      zhromazdenieStav: { naTahu: 0, zostavaLimit: [2, 2], pasoval: [false, false], navyse: [0, 0] },
    },
    0,
    h,
  );
}

describe("Milujúca manželka v7 (M2): latku Absťáku už neposúva", () => {
  it("s priznanou Manželkou ani bez nej Absťák pri rovnosti nerestí nedostane", () => {
    const zaklad = (manzelky: number): GameState =>
      predKoncomBitky(44, (st) =>
        sHracom(st, 0, {
          // 7 štartoviek: aby bolo z čoho ťahať za Absťák aj po bitke.
          doberaci: [...st.hraci[0].doberaci, inst("pijan"), inst("pijan"), inst("pijan")],
          nerestiMinuleKolo: 2,
          nerestiTotoKolo: 2,
          priznane: Array.from({ length: manzelky }, () => inst("milujuca_manzelka")),
        }),
      );
    const abstaky = (st: GameState): number => st.hraci[0].priznane.filter((k) => k.defId === "abstak").length;
    expect(abstaky(apply(data, zaklad(0), { type: "skipPohreb" }, 0).state)).toBe(0);
    const s1 = apply(data, zaklad(1), { type: "skipPohreb" }, 0).state;
    expect(abstaky(s1)).toBe(0);
    expect(s1.hraci[0].ruka).toHaveLength(zaklad(1).hraci[0].ruka.length + KONSTANTY.KARTY_PO_BITKE);
  });

  it("ani v línii: dve Manželky pri o 1 viac nerestiach Absťák nedajú", () => {
    const s = predKoncomBitky(45, (st) => ({
      ...sHracom(st, 0, { nerestiMinuleKolo: 2, nerestiTotoKolo: 3, priznane: [inst("milujuca_manzelka")] }),
      strany: [[{ card: inst("milujuca_manzelka"), playedBy: 0 }], []],
    }));
    const po = apply(data, s, { type: "skipPohreb" }, 0).state;
    expect(po.hraci[0].priznane.filter((k) => k.defId === "abstak")).toHaveLength(0);
  });

  it("log menuje Manželku, len keď Absťák priniesla ona (playtest 20261027-105422)", () => {
    const logAbstaku = (teraz: number): string => {
      const s = predKoncomBitky(47, (st) => sHracom(st, 0, { nerestiMinuleKolo: 2, nerestiTotoKolo: teraz, priznane: [inst("milujuca_manzelka")] }));
      const { state, events } = apply(data, s, { type: "skipPohreb" }, 0);
      expect(state.hraci[0].priznane.filter((k) => k.defId === "abstak")).toHaveLength(1);
      const log = events.find((e) => e.type === "log" && e.text.startsWith("Hráč 1 získava Absťák"));
      return log?.type === "log" ? log.text : "";
    };
    // 2 = 2: Absťák len vďaka Manželke.
    expect(logAbstaku(2)).toContain("Milujúca manželka");
    // 1 < 2: Absťák by prišiel aj bez nej.
    expect(logAbstaku(1)).toContain("v kole mal 1 nerest, v predošlom 2 neresti.");
    expect(logAbstaku(1)).not.toContain("Milujúca manželka");
  });
});

// --- Dedičstvo -------------------------------------------------------------------

describe("Dedičstvo: cena rastie spoločne pre oboch (1, 2, 3 … cigariet)", () => {
  it("prvý Nástroj stojí 1, ďalší — aj súperov — 2", () => {
    const puska = inst("puska");
    let s = vZhromazdeniHrac0(46, { ruka: [puska], cigarety: 5 });
    expect(cenaDedicstva(s)).toBe(1);
    s = apply(data, s, { type: "place", uid: puska.uid, target: "dedicstvo" }, 0).state;
    expect(s.hraci[0].cigarety).toBe(4);
    expect(cenaDedicstva(s)).toBe(2);
    expect(viewFor(data, s, 1).cenaDedicstva).toBe(2);
    const noviny = inst("noviny");
    s = sHracom({ ...s, zhromazdenieStav: { ...s.zhromazdenieStav!, naTahu: 1 } }, 1, { ruka: [noviny], cigarety: 1 });
    expect(legalCommands(data, s, 1).some((c) => c.type === "place" && c.target === "dedicstvo")).toBe(false);
    expect(() => apply(data, s, { type: "place", uid: noviny.uid, target: "dedicstvo" }, 1)).toThrow(/2 cigarety/);
  });
});

// --- Nástroj v línii -------------------------------------------------------------

describe("Nástroj v línii: akcie dostane majiteľ karty, s ktorou tvorí spoj", () => {
  it("Nástroj podstrčený súperovi pracuje pre súpera", () => {
    const obcan = makeDef("obcan_n", [null, null, null, "Rana"], EMPTY, { tags: ["Občan"] });
    const nastroj = makeDef("nastroj_n", ["Cigareta", null, null, null], EMPTY, { tags: ["Nástroj"] });
    const sd = syntheticData([obcan, nastroj]);
    const strany: GameState["strany"] = [
      [],
      [
        { card: instanceFor(sd, "obcan_n", [null, null, null, "Rana"], EMPTY), playedBy: 1 },
        { card: instanceFor(sd, "nastroj_n", ["Cigareta", null, null, null], EMPTY), playedBy: 0 },
      ],
    ];
    const ev = evaluateLine(sd, { lokalita: null, lokalitaOtocena: false, strany });
    expect(ev.sums[1]).toEqual({ Rana: 1, Cigareta: 1 });
    expect(ev.sums[0]).toEqual({});
  });
});

// --- Celý ťah naraz ----------------------------------------------------------------

describe("ťah v Zhromaždení naraz: ďalšia karta stojí poldeci (Michal 2026-10-19)", () => {
  it("dve karty = Vypiť pred prvou; server ich vykoná atomicky a ťah prejde na súpera", () => {
    const [a, b, d] = [inst("pijan"), inst("ministrant"), inst("dlh")];
    const s = sHracom(
      { ...vZhromazdeniHrac0(60, {}), zhromazdenieStav: { naTahu: 0, zostavaLimit: [4, 4], pasoval: [false, false], navyse: [0, 0] } },
      0,
      { ruka: [a, b, d], poldeciPlne: 3 },
    );
    const plan = planVykladania(data, s, 0, 4, [
      { karta: a, ciel: "vlastna" },
      { karta: d, ciel: "priznanie" },
      { karta: b, ciel: "superova" },
    ]);
    expect(plan.chyba).toBeNull();
    expect(plan.poldeci).toBe(1);
    expect(plan.kroky).toEqual([
      { type: "place", uid: d.uid, target: "priznanie" },
      { type: "vypit" },
      { type: "place", uid: a.uid, target: "vlastna" },
      { type: "place", uid: b.uid, target: "superova" },
    ]);
    const po = apply(data, s, { type: "tah", kroky: plan.kroky }, 0).state;
    expect(po.strany[0].map((x) => x.card.uid)).toEqual([a.uid]);
    expect(po.strany[1].map((x) => x.card.uid)).toEqual([b.uid]);
    expect(po.hraci[0].poldeciPlne).toBe(2);
    expect(po.zhromazdenieStav?.zostavaLimit[0]).toBe(1);
    expect(naTahu(po)).toBe(1);
  });

  it("bez poldeci druhá karta nejde; chybný ťah sa nevykoná vôbec", () => {
    const [a, b] = [inst("pijan"), inst("ministrant")];
    const s = sHracom(vZhromazdeniHrac0(61, {}), 0, { ruka: [a, b], poldeciPlne: 0 });
    const plan = planVykladania(data, s, 0, 2, [
      { karta: a, ciel: "vlastna" },
      { karta: b, ciel: "vlastna" },
    ]);
    expect(plan.chyba).toMatch(/plný poldeci/);
    const zle: Command = { type: "tah", kroky: [{ type: "place", uid: a.uid, target: "vlastna" }, { type: "place", uid: b.uid, target: "vlastna" }] };
    expect(() => apply(data, s, zle, 0)).toThrow(/skončil/);
    // Nič sa nezmenilo — stav je nemenný, apply vracia nový.
    expect(s.strany[0]).toHaveLength(0);
  });
});

// --- Vízia -----------------------------------------------------------------------

describe("Vízia: vrchnú kartu balíčka do ruky, alebo zahodiť (Michal 2026-10-19)", () => {
  const lokV = makeDef("lok_vizia", ["Rana", null, null, null], EMPTY, { tags: ["Lokalita"] });
  const vestec = makeDef("vestec", EMPTY, ["Vízia", null, null, null]);
  const sadaV = sadaS(lokV, vestec);

  function poPitke(): GameState {
    const s0 = setupSBalickom(sadaV, 50);
    let s: GameState = {
      ...s0,
      faza: "pitka",
      utocnik: 1,
      ciel: { typ: "lokalita", lokalita: instanceFor(sadaV, "lok_vizia", ["Rana", null, null, null], EMPTY) },
      lokalitaOtocena: false,
      strany: [[{ card: instanceFor(sadaV, "vestec", EMPTY, ["Vízia", null, null, null]), playedBy: 0 }], []],
      pitkyCelkom: 1,
      pitkaCislo: 1,
      pitkaStav: { naTahu: 0, hotovy: [false, false], naexPouzity: [false, false], fajcenie: [0, 0], reakcia: null, postarka: [false, false], starosta: [false, false] },
    };
    for (let i = 0; i < 2 && s.vizia === null && s.faza === "pitka"; i++) s = apply(sadaV, s, { type: "skipNaex" }, naTahu(s)!).state;
    return s;
  }

  it("po Pitke sa čaká na rozhodnutie; vrchnú kartu vidí len majiteľ Vízie", () => {
    const s = poPitke();
    expect(s.faza).toBe("pitka");
    expect(s.vizia?.zostava).toEqual([1, 0]);
    expect(naTahu(s)).toBe(0);
    expect(legalCommands(sadaV, s, 0)).toEqual([
      { type: "vizia", vziat: true },
      { type: "vizia", vziat: false },
    ]);
    const vrchna = s.hraci[0].doberaci[0]!;
    expect(viewFor(sadaV, s, 0).volbaVizia).toEqual(vrchna);
    expect(viewFor(sadaV, s, 1).volbaVizia).toBeNull();
    expect(JSON.stringify(viewFor(sadaV, s, 1))).not.toContain(`"uid":${vrchna.uid},`);
    expect(() => apply(sadaV, s, { type: "skipNaex" }, 0)).toThrow(/Vízi/);
  });

  it("vziať: karta ide do ruky; zahodiť: karta je preč z hry; potom bitka", () => {
    const s = poPitke();
    const vrchna = s.hraci[0].doberaci[0]!;
    const vzal = apply(sadaV, s, { type: "vizia", vziat: true }, 0).state;
    expect(vzal.hraci[0].ruka.map((k) => k.uid)).toContain(vrchna.uid);
    expect(vzal.faza).toBe("bitka");
    const zahodil = apply(sadaV, s, { type: "vizia", vziat: false }, 0).state;
    const vsade = [...zahodil.hraci[0].ruka, ...zahodil.hraci[0].doberaci, ...zahodil.hraci[0].odhadzovaci].map((k) => k.uid);
    expect(vsade).not.toContain(vrchna.uid);
    expect(zahodil.hraci[0].doberaci).toHaveLength(s.hraci[0].doberaci.length - 1);
  });
});

// --- Karty -----------------------------------------------------------------------

describe("Veľmi smútiaca vdova (oprava 2026-10-19)", () => {
  it("muž navrchu ide z hry a Dlhy sa naozaj zahodia — aj z odhadzovacieho", () => {
    const vdova = inst("velmi_smutiaca_vdova");
    const pijan = inst("pijan");
    let s = vZhromazdeniHrac0(47, { ruka: [vdova], odhadzovaci: [inst("dlh"), inst("dlh"), inst("pijan")] });
    s = sHracom(s, 1, { doberaci: [pijan, ...s.hraci[1].doberaci] });
    const r = apply(data, s, { type: "place", uid: vdova.uid, target: "vlastna" }, 0);
    expect(r.state.hraci[1].doberaci.map((k) => k.uid)).not.toContain(pijan.uid);
    expect(r.state.hraci[0].odhadzovaci.map((k) => k.defId)).toEqual(["pijan"]);
    expect(r.events.some((e) => e.type === "log" && e.text.includes("muž ide z hry") && e.text.includes("2 Dlhy"))).toBe(true);
  });

  it("keď navrchu nie je muž, log to povie", () => {
    const vdova = inst("velmi_smutiaca_vdova");
    let s = vZhromazdeniHrac0(48, { ruka: [vdova] });
    s = sHracom(s, 1, { doberaci: [inst("milujuca_manzelka"), ...s.hraci[1].doberaci] });
    const r = apply(data, s, { type: "place", uid: vdova.uid, target: "vlastna" }, 0);
    expect(r.events.some((e) => e.type === "log" && e.text.includes("nie muž"))).toBe(true);
  });
});

describe("Vychovávateľka: Dlh ide súperovi do balíčka, nie na ruku", () => {
  it("pri NA EX majiteľa Vychovávateľky", () => {
    const s0 = setupSBalickom(data, 49);
    const vych = inst("vychovavatelka");
    const ciel = inst("pijan");
    const dlh = inst("dlh");
    let s: GameState = sHracom(
      {
        ...s0,
        faza: "pitka",
        ciel: { typ: "lokalita", lokalita: s0.lokalityVHre[0]! },
        lokalityVHre: s0.lokalityVHre.slice(1),
        strany: [[{ card: vych, playedBy: 0 }, { card: ciel, playedBy: 0 }], []],
        pitkyCelkom: 1,
        pitkaCislo: 1,
        pitkaStav: { naTahu: 0, hotovy: [false, false], naexPouzity: [false, false], fajcenie: [0, 0], reakcia: null, postarka: [false, false], starosta: [false, false] },
      },
      0,
      { priznane: [dlh] },
    );
    const ruka1 = s.hraci[1].ruka.length;
    s = naexOdkryte(data, s, ciel.uid, 0).state;
    expect(s.hraci[0].priznane.map((k) => k.uid)).not.toContain(dlh.uid);
    expect(s.hraci[1].doberaci.map((k) => k.uid)).toContain(dlh.uid);
    expect(s.hraci[1].ruka).toHaveLength(ruka1);
  });
});

describe("pas (Michal 2026-10-20): do Pitky, cigareta za každú nevyloženú kartu", () => {
  it("pasujúci dostane cigarety za zostávajúci limit a súper vykladá sám", () => {
    let s = vZhromazdeniHrac0(44, { ruka: [inst("pijan"), inst("pijan")], cigarety: 0 });
    s = apply(data, s, { type: "pass" }, 0).state;
    expect(s.hraci[0].cigarety).toBe(2);
    expect(s.zhromazdenieStav?.pasoval).toEqual([true, false]);
    expect(naTahu(s)).toBe(1);
    expect(() => apply(data, s, { type: "place", uid: s.hraci[0].ruka[0]!.uid, target: "vlastna" }, 0)).toThrow();
    // Súper vyloží kartu a je na ťahu znova — pasujúci už do Pitky nehrá.
    const karta = s.hraci[1].ruka.find((k) => !data.cards.get(k.defId)!.tags.includes("Kliatba") && !data.cards.get(k.defId)!.tags.includes("Nástroj"))!;
    s = apply(data, s, { type: "place", uid: karta.uid, target: "vlastna" }, 1).state;
    expect(naTahu(s)).toBe(1);
    const cigarety = s.hraci[1].cigarety;
    s = apply(data, s, { type: "pass" }, 1).state;
    expect(s.hraci[1].cigarety).toBe(cigarety + 1);
    expect(s.faza).toBe("pitka");
  });

  it("kto vyčerpal limit, za pas nič nedostane", () => {
    let s = vZhromazdeniHrac0(45, { ruka: [inst("pijan")], cigarety: 0 });
    s = { ...s, zhromazdenieStav: { ...s.zhromazdenieStav!, zostavaLimit: [0, 2] } };
    s = apply(data, s, { type: "pass" }, 0).state;
    expect(s.hraci[0].cigarety).toBe(0);
  });
});

describe("kliatba do línie nepatrí (Michal 2026-10-20)", () => {
  it("Dlh sa dá len priznať, Milujúca manželka (Občan) smie aj do línie", () => {
    const dlh = inst("dlh");
    const manzelka = inst("milujuca_manzelka");
    const s = vZhromazdeniHrac0(46, { ruka: [dlh, manzelka] });
    const legal = legalCommands(data, s, 0);
    expect(legal.filter((c) => c.type === "place" && c.uid === dlh.uid).map((c) => (c.type === "place" ? c.target : ""))).toEqual(["priznanie"]);
    expect(legal.some((c) => c.type === "place" && c.uid === manzelka.uid && c.target === "vlastna")).toBe(true);
    expect(() => apply(data, s, { type: "place", uid: dlh.uid, target: "superova" }, 0)).toThrow(/priznať/);
  });
});

describe("Dlhy sa priznávajú samy, Cirhóza bez dobratia (Michal 2026-10-20)", () => {
  it("dobratý Dlh sa hneď prizná a hráč ťahá ďalšiu kartu, aj v reťazi", () => {
    const [d1, d2, p1] = [inst("dlh"), inst("dlh"), inst("pijan")];
    const z = vZhromazdeniHrac0(47, { ruka: [], doberaci: [d1, d2, p1], odhadzovaci: [], cigarety: 1, priznane: [] });
    // Fajčí sa len v Pitke (v5).
    let s: GameState = {
      ...z,
      faza: "pitka",
      zhromazdenieStav: null,
      pitkyCelkom: 1,
      pitkaCislo: 1,
      pitkaStav: { naTahu: 0, hotovy: [false, false], naexPouzity: [false, false], fajcenie: [0, 0], reakcia: null, postarka: [false, false], starosta: [false, false] },
    };
    s = apply(data, s, { type: "smoke", pocet: 1 }, 0).state;
    expect(s.hraci[0].ruka.map((k) => k.uid)).toEqual([p1.uid]);
    expect(s.hraci[0].priznane.map((k) => k.uid)).toEqual([d1.uid, d2.uid]);
  });

  it("priznaná Cirhóza kartu nedá, Milujúca manželka áno", () => {
    const cirhoza = inst("cirhoza");
    const manzelka = inst("milujuca_manzelka");
    let s = vZhromazdeniHrac0(48, { ruka: [cirhoza, manzelka] });
    const balicek = s.hraci[0].doberaci.length;
    s = apply(data, s, { type: "place", uid: cirhoza.uid, target: "priznanie" }, 0).state;
    expect(s.hraci[0].ruka).toHaveLength(1);
    expect(s.hraci[0].doberaci).toHaveLength(balicek);
    s = apply(data, s, { type: "place", uid: manzelka.uid, target: "priznanie" }, 0).state;
    expect(s.hraci[0].ruka).toHaveLength(1);
  });
});

describe("Veriaci (Michal 2026-10-20): Viera navyše rovná sile", () => {
  it("dve Viery s priazňou sily 2 uberú súperovi 4 tuhé, nie 10", () => {
    const s0 = setupSBalickom(data, 49);
    const veriaci = s0.starsi.find((e) => favourStarsieho(data, e) === "VERIACI")!;
    // Marker na 1 = priazeň hráča 0, sila 2.
    const s: GameState = { ...s0, strany: [[], []], starsi: s0.starsi.map((e) => (e === veriaci ? { ...e, marker: 1} : e)) };
    const dmg = poskodenieBitky(data, s, [{ Viera: 2 }, { Petelica: 4 }], [0, 0]);
    expect(dmg.zvysnaViera[0]).toBe(4);
    expect(dmg.tuhe[1]).toBe(12 - 4);
  });
});

describe("Cirhóza v bitke (Michal 2026-10-20): škodí tomu, kto ju priznal", () => {
  it("za každú priznanú Cirhózu dá súper +1 tuhé", () => {
    const s0 = setupSBalickom(data, 50);
    const s = sHracom({ ...s0, strany: [[], []] }, 0, { priznane: [inst("cirhoza"), inst("cirhoza")] });
    const dmg = poskodenieBitky(data, s, [{}, {}], [0, 0]);
    expect(dmg.tuhe[1]).toBe(2);
    expect(dmg.tuhe[0]).toBe(0);
  });
});

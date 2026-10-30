// Zmeny po playteste 20261012-055944 (Michal 2026-10-12): reakcia na NA EX,
// nahradený starší v hre, karta staršieho v strede, limit ruky so Zberateľom,
// a efekty kariet, ktoré boli MANUAL. Draft testuje draft.test.ts.

import { describe, expect, it } from "vitest";
// Sada v6 (pred revíziou v7): test stráži pravidlá, ktoré revízia sady nemení.
import cardsJson from "./data/cards-v6.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type {
  BitkaStav,
  CardDef,
  CardInstance,
  GameData,
  GameState,
  LineState,
  PlacedCard,
  PlayerId,
} from "../src/index.ts";
import {
  apply,
  buildGameData,
  computeDamage,
  evaluateLine,
  legalCommands,
  loadGameData,
  moznostiNaex,
  naTahu,
  parseScorecards,
  poskodenieBitky,
  patronatMozny,
  priazen,
  setupGame,
  viewFor,
} from "../src/index.ts";
import type { Layout4 } from "./helpers.ts";
import { EMPTY, instanceFor, makeDef, syntheticData, naexOdkryte } from "./helpers.ts";
import { setupSBalickom } from "./helpers.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

let uidSeq = 90000;
const inst = (defId: string): CardInstance => ({ uid: ++uidSeq, defId, leftLayout: 0, rightLayout: 0 });
const lezi = (card: CardInstance, playedBy: PlayerId): PlacedCard => ({ card, playedBy });

/** Tlačová sada so syntetickými kartami navyše (alebo namiesto kariet s rovnakým id). */
function sadaS(...defs: CardDef[]): GameData {
  const cards = new Map(data.cards);
  for (const d of defs) cards.set(d.id, d);
  return buildGameData(cards, data.elders, parseScorecards(scorecardsJson));
}

function vPitke(s: GameState, strany: GameState["strany"], naTahuHrac: PlayerId = 0): GameState {
  return {
    ...s,
    faza: "pitka",
    pitkyCelkom: 1,
    pitkaCislo: 1,
    strany,
    pitkaStav: {
      naTahu: naTahuHrac,
      hotovy: [false, false],
      naexPouzity: [false, false],
      fajcenie: [0, 0],
      reakcia: null,
      postarka: [false, false],
      starosta: [false, false],
    },
  };
}

/** Dohrá bitku prvými legálnymi voľbami (Pohoršenie, prebytok…) až do ďalšieho kola. */
function dohrajBitku(d: GameData, s: GameState): GameState {
  let st = s;
  for (let i = 0; i < 50 && st.faza === "bitka"; i++) {
    const p = naTahu(st);
    if (p === null) break;
    const cmd = legalCommands(d, st, p)[0];
    if (cmd === undefined) break;
    st = apply(d, st, cmd, p).state;
  }
  return st;
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
    benzinkaZostava: [0, 0],

    karHotovy: [true, true],
    spalit: [],
    vesticaHotova: true,
    ...b,
  };
}

describe("reakcia na NA EX", () => {
  it("v5: na odkryté NA EX smie súper vyložiť jednu kartu mimo limitu, potom sa Pitka vyhodnotí", () => {
    const s0 = setupSBalickom(data, 11);
    const moja = inst("pijan");
    let s = vPitke(s0, [[lezi(moja, 0), lezi(inst("pijan"), 0)], []]);
    // NA EX naraz: kým obaja neskončia Pitku, súper o ňom nevie a neodpovedá.
    expect(apply(data, s, { type: "naex", uid: moja.uid }, 0).state.pitkaStav?.reakcia).toBeNull();
    s = naexOdkryte(data, s, moja.uid, 0).state;
    expect(s.pitkaStav?.reakcia).toBe(1);
    expect(naTahu(s)).toBe(1);
    const moznosti = legalCommands(data, s, 1);
    expect(moznosti).toContainEqual({ type: "bezReakcie" });
    // Počas reakcie sa nedá dať NA EX ani fajčiť — len vyložiť kartu alebo nič.
    expect(moznosti.every((c) => c.type === "bezReakcie" || c.type === "place")).toBe(true);
    const karta = s.hraci[1].ruka[0] as CardInstance;
    s = apply(data, s, { type: "place", uid: karta.uid, target: "superova" }, 1).state;
    expect(s.strany[0].map((p) => p.card.uid)).toContain(karta.uid);
    expect(s.pitkaStav?.reakcia ?? null).toBeNull();
    expect(s.pitkaCislo === 1 && s.faza === "pitka" && s.vizia === null).toBe(false);
  });

  it("bez kariet v ruke sa reakcia neponúka", () => {
    const s0 = setupSBalickom(data, 12);
    const moja = inst("pijan");
    let s = vPitke({ ...s0, hraci: [s0.hraci[0], { ...s0.hraci[1], ruka: [] }] }, [[lezi(moja, 0), lezi(inst("pijan"), 0)], []]);
    s = naexOdkryte(data, s, moja.uid, 0).state;
    expect(s.pitkaStav?.reakcia ?? null).toBeNull();
  });

  it("na Liberála NA EX dať smie (Michal 2026-10-26)", () => {
    const liberal = inst("liberal");
    const s = vPitke(setupSBalickom(data, 13), [[lezi(inst("pijan"), 0), lezi(liberal, 0), lezi(inst("pijan"), 0)], []]);
    expect(moznostiNaex(data, s, 0)).toContain(liberal.uid);
    expect(() => apply(data, s, { type: "naex", uid: liberal.uid }, 0)).not.toThrow();
  });
});

describe("Krčma vynúti NA EX", () => {
  it("s plným poldeci a vlastným Občanom v línii sa Pitka bez NA EX neskončí", () => {
    const s0 = setupSBalickom(data, 14);
    const krcma = inst("krcma");
    const moja = inst("pijan");
    const s = { ...vPitke(s0, [[lezi(moja, 0), lezi(inst("pijan"), 0)], []]), ciel: { typ: "lokalita" as const, lokalita: krcma } };
    expect(legalCommands(data, s, 0)).not.toContainEqual({ type: "skipNaex" });
    expect(() => apply(data, s, { type: "skipNaex" }, 0)).toThrow(/Krčma/);
    // Bez poldeci povinnosť zaniká.
    const bez = { ...s, hraci: [{ ...s.hraci[0], poldeciPlne: 0 }, s.hraci[1]] as GameState["hraci"] };
    expect(legalCommands(data, bez, 0)).toContainEqual({ type: "skipNaex" });
  });
});

describe("nahradený starší ostáva v hre", () => {
  it("dáva priazeň a jeho marker sa dá posunúť Pohoršením; do ruky ho vziať nemožno", () => {
    const s0 = setupSBalickom(data, 15);
    const e0 = s0.starsi[0]!;
    const nahradeny = { ...e0, nahradeny: true, ziskal: 0 as PlayerId, marker: 5 as const };
    const starsi = [nahradeny, ...s0.starsi.slice(1)];
    const s: GameState = {
      ...s0,
      faza: "bitka",
      starsi,
      // Oranžová → žltá (k stredu) stojí od v8.2 tri Pohoršenia.
      bitkaStav: bitka({ krok: "pohorsenie", caka: 1, pohorsenieZostava: [0, 3], vitaz: null }),
    };
    const favour = data.scorecards.find((sc) => sc.id === e0.scorecard)!.favour;
    // Marker na 5 = sila 2, účinok dvojnásobný (Michal 2026-10-16) → bonus 4.
    expect(priazen(data, s, favour, 1)).toBe(4);
    expect(legalCommands(data, s, 1)).toContainEqual({ type: "pohorsenie", elderId: e0.elderId });
    const po = apply(data, s, { type: "pohorsenie", elderId: e0.elderId }, 1).state;
    expect(po.starsi[0]!.marker).toBe(4);
    // Patronát nad náhradou nie je v ponuke.
    expect(patronatMozny(nahradeny, 1)).toBe(false);
  });
});

describe("limit ruky zrušený (Michal 2026-10-19)", () => {
  it("veľká ruka sa po bitke neodhadzuje a súperov Hrobár za nič nedostane", () => {
    const s0 = setupSBalickom(data, 20);
    const ruka = Array.from({ length: 8 }, () => inst("pijan"));
    const hrobar = inst("hrobar");
    const s: GameState = {
      ...s0,
      faza: "bitka",
      strany: [[], [lezi(hrobar, 1)]],
      // 7 štartoviek (Michal 2026-10-22): doberací doplnený na 5, aby balíček neklesol pod 5.
      hraci: [{ ...s0.hraci[0], ruka }, { ...s0.hraci[1], cigarety: 0, ruka: [], doberaci: [...s0.hraci[1].doberaci, inst("pijan"), inst("pijan"), inst("pijan")] }],
      ciel: { typ: "lokalita", lokalita: s0.lokalityVHre[0]! },
      lokalityVHre: s0.lokalityVHre.slice(1),
      bitkaStav: bitka({ krok: "cintorin", caka: 0 }),
    };
    const po = apply(data, s, { type: "cintorin", uid: null }, 0).state;
    expect(po.hraci[0].ruka.length).toBeGreaterThanOrEqual(8);
    expect(po.hraci[1].cigarety).toBe(0);
    expect(po.kolo).toBe(s0.kolo + 1);
  });
});

describe("Benzínka, Dievčina na vydaj a Krčmárka pri bitke", () => {
  const C4: Layout4 = ["Cigareta", "Cigareta", "Cigareta", "Cigareta"];
  const kuric = makeDef("kuric", C4, C4, { tags: ["Občan", "Chlap"] });
  const sada = sadaS(kuric);

  it("Benzínka: nikto nesmie fajčiť; Krčmárka po bitke otočí vypitý poldeci (Michal 2026-10-20)", () => {
    const s0 = setupSBalickom(sada, 21);
    const benzinka = s0.lokalityVHre.find((k) => k.defId === "benzinka") ?? inst("benzinka");
    const k = (): CardInstance => instanceFor(sada, "kuric", C4, C4);
    const [a, b, c, d] = [k(), k(), k(), k()];
    const krcmarka = inst("krcmarka");
    const hraci = [
      { ...s0.hraci[0], poldeciPlne: 1, poldeciVypite: 1 },
      s0.hraci[1],
    ] as GameState["hraci"];
    let s: GameState = {
      ...vPitke(s0, [[lezi(a, 0), lezi(b, 0), lezi(krcmarka, 0)], [lezi(c, 1), lezi(d, 1)]], s0.utocnik === 0 ? 1 : 0),
      hraci,
      ciel: { typ: "lokalita", lokalita: benzinka },
      lokalityVHre: s0.lokalityVHre.filter((x) => x.uid !== benzinka.uid),
    };
    s = { ...s, hraci: [{ ...s.hraci[0], cigarety: 3 }, { ...s.hraci[1], cigarety: 3 }] };
    const p = naTahu(s)!;
    expect(legalCommands(sada, s, p).some((c) => c.type === "smoke")).toBe(false);
    expect(() => apply(sada, s, { type: "smoke", pocet: 1 }, p)).toThrow(/Benzínka/);
    // Dohraj Pitky.
    while (s.faza === "pitka" || s.faza === "zhromazdenie") {
      s = apply(sada, s, { type: s.faza === "zhromazdenie" ? "pass" : "skipNaex" }, naTahu(s)!).state;
    }
    s = dohrajBitku(sada, s);
    // Stará Benzínka (zahodenie Občanov, prepadnutie) už neplatí — bitka je na nástenke.
    expect(s.nastenka.at(-1)?.lokalita?.uid).toBe(benzinka.uid);
    const vsetky = (q: PlayerId) => [...s.hraci[q].odhadzovaci, ...s.hraci[q].doberaci, ...s.hraci[q].ruka].map((x) => x.uid);
    for (const x of [a, b]) expect(vsetky(0)).toContain(x.uid);
    for (const x of [c, d]) expect(vsetky(1)).toContain(x.uid);
    // Krčmárka: bez Absťáku a bez NA EX sa vypitý poldeci otočil na plný.
    expect(s.hraci[0].poldeciVypite).toBe(0);
  });

});

describe("efekty v línii", () => {
  const R: Layout4 = ["Rana", null, null, null];
  const R1: Layout4 = [null, "Rana", null, null];
  const defs = [
    makeDef("liberal", R, R1, { tags: ["Občan", "Žena", "Chlap"] }),
    makeDef("zena", EMPTY, R, { tags: ["Občan", "Žena"] }),
    makeDef("chlap", R1, EMPTY, { tags: ["Občan", "Chlap"] }),
    makeDef("zena2", R1, EMPTY, { tags: ["Občan", "Žena"] }),
    makeDef("silna_nezavisla_zena", R, R1, { tags: ["Občan", "Žena"] }),
    makeDef("chlapL", EMPTY, R, { tags: ["Občan", "Chlap"] }),
    makeDef("zamocnik", EMPTY, R, { tags: ["Občan", "Chlap"] }),
    makeDef("nastroj", R, EMPTY, { tags: ["Nástroj"] }),
    makeDef("sarlatan", EMPTY, ["Viera", null, null, null], { tags: ["Občan", "Chlap"] }),
    makeDef("veriaca", ["Viera", null, null, null], EMPTY, { tags: ["Občan"] }),
    makeDef("pijan", EMPTY, R, { tags: ["Občan", "Chlap"] }),
    makeDef("zena_poldeci", R, ["Poldeci", null, null, null], { tags: ["Občan", "Žena"] }),
    makeDef("pijak", ["Poldeci", null, null, null], EMPTY, { tags: ["Občan"] }),
    makeDef("veteran", R, R1, { tags: ["Občan", "Chlap"] }),
    makeDef("influencer", EMPTY, R, { tags: ["Občan", "Influencer"] }),
  ];
  const sd = syntheticData(defs);
  const rozlozenia: Record<string, [Layout4, Layout4]> = {
    liberal: [R, R1],
    zena: [EMPTY, R],
    chlap: [R1, EMPTY],
    zena2: [R1, EMPTY],
    silna_nezavisla_zena: [R, R1],
    chlapL: [EMPTY, R],
    zamocnik: [EMPTY, R],
    nastroj: [R, EMPTY],
    sarlatan: [EMPTY, ["Viera", null, null, null]],
    veriaca: [["Viera", null, null, null], EMPTY],
    pijan: [EMPTY, R],
    zena_poldeci: [R, ["Poldeci", null, null, null]],
    pijak: [["Poldeci", null, null, null], EMPTY],
    veteran: [R, R1],
    influencer: [EMPTY, R],
  };
  const k = (id: string): CardInstance => {
    const [l, r] = rozlozenia[id]!;
    return instanceFor(sd, id, l, r);
  };
  /** Rad kariet hráča 0 zľava doprava (na strane 1 nie sú otočené). */
  const linia = (...ids: string[]): LineState => ({
    lokalita: null,
    lokalitaOtocena: false,
    strany: [[], ids.map((id) => lezi(k(id), 0))],
  });


  // Michal 2026-10-18: Silná nezávislá žena podporuje okolie — aktívne akcie
  // tvojich susedných kariet sa rátajú dvakrát (ona sama nie).
  it("Silná nezávislá žena: zdvojí aktívne akcie tvojich susedov", () => {
    // chlapL (1) + ona (1) + ona (1) + chlap (1) = 4 → susedia ×2 = 6.
    expect(evaluateLine(sd, linia("chlapL", "silna_nezavisla_zena", "chlap")).sums[0].Rana).toBe(6);
    // Sused patrí súperovi (otočený, nemá s ňou pár) — nič mu nezdvojí ani nepridá.
    const cudzi: LineState = {
      lokalita: null,
      lokalitaOtocena: false,
      strany: [[], [lezi(k("chlapL"), 0), lezi(k("silna_nezavisla_zena"), 0), lezi(k("chlap"), 1)]],
    };
    expect(evaluateLine(sd, cudzi).sums[1].Rana).toBeUndefined();
  });

  it("Zámočník: akcie Nástroja v jeho okolí sú posilnené", () => {
    expect(evaluateLine(sd, linia("zamocnik", "nastroj")).sums[0].Rana).toBe(1 + 2);
  });

  it("Šarlatán (v7): Viera v jeho okolí už nie je Vízia (efekt je pečeň ako Viera, test v7-pakt)", () => {
    const sums = evaluateLine(sd, linia("sarlatan", "veriaca")).sums[0];
    expect(sums.Viera).toBe(2);
    expect(sums.Vízia).toBeUndefined();
  });


});

describe("Svätý text a Puška (Nástroje 2026-10-18)", () => {
  it("Svätý text: hodnota tvojej Viery je o 1 vyššia", () => {
    const s = setupSBalickom(data, 23);
    const stav = { ...s, hraci: [s.hraci[0], { ...s.hraci[1], dedicstvo: [inst("svaty_text")] }] as GameState["hraci"] };
    // 3 Rany proti 1 Viere: bez Svätého textu 3 − 1 = 2, so Svätým textom 3 − 2 = 1.
    expect(poskodenieBitky(data, s, [{ Rana: 3 }, { Viera: 1 }]).tuhe[0]).toBe(2);
    expect(poskodenieBitky(data, stav, [{ Rana: 3 }, { Viera: 1 }]).tuhe[0]).toBe(1);
  });
});

// Policajtka dostala 2026-10-18 nový efekt (súperove Pohoršenia proti tebe
// neplatia) — test nového efektu je v michal-20261018.test.ts.
describe("Veštica — odhalené balíčky len tomu, kto vyberá", () => {
  it("Veštica: oba balíčky vidí len porazený počas výberu", () => {
    const s0 = setupSBalickom(data, 25);
    const s: GameState = { ...s0, faza: "bitka", bitkaStav: bitka({ krok: "vestica", caka: 1, vitaz: 0, vesticaHotova: false }) };
    const v1 = viewFor(data, s, 1).volbaVestica;
    expect(v1?.moj).toEqual(s.hraci[1].doberaci);
    expect(v1?.jeho).toEqual(s.hraci[0].doberaci);
    expect(viewFor(data, s, 0).volbaVestica).toBeNull();
    expect(viewFor(data, { ...s, bitkaStav: bitka({ krok: "cintorin", caka: 1 }) }, 1).volbaVestica).toBeNull();
  });
});

describe("Poštárka, Starosta a Vychovávateľka", () => {

});

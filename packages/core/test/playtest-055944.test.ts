// Zmeny po playteste 20261012-055944 (Michal 2026-10-12): reakcia na NA EX,
// nahradený starší v hre, karta staršieho v strede, limit ruky so Zberateľom,
// a efekty kariet, ktoré boli MANUAL. Draft testuje draft.test.ts.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
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
  nahladBitkyOStarsieho,
  naTahu,
  parseScorecards,
  poskodenieBitky,
  priazen,
  setupGame,
  viewFor,
} from "../src/index.ts";
import type { Layout4 } from "./helpers.ts";
import { EMPTY, instanceFor, makeDef, syntheticData } from "./helpers.ts";

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
      zakazNaex: [false, false],
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
    pohnuteMarkery: [],
    damage: null,
    vitaz: 0,
    prebytokDrzi: null,
    prebytokZostava: 0,
    liecbaHotova: [true, true],
    benzinkaZostava: [0, 0],
    lokalitaPrepadne: false,
    spalit: [],
    vesticaHotova: true,
    limitHotovy: [false, false],
    ...b,
  };
}

describe("reakcia na NA EX", () => {
  it("súper smie hneď vyložiť jednu kartu mimo limitu, potom je na ťahu znova ten, kto NA EX dal", () => {
    const s0 = setupGame(data, 11);
    const moja = inst("pijan");
    let s = vPitke(s0, [[lezi(moja, 0)], []]);
    s = apply(data, s, { type: "naex", uid: moja.uid }, 0).state;
    expect(s.pitkaStav?.reakcia).toBe(1);
    expect(naTahu(s)).toBe(1);
    const moznosti = legalCommands(data, s, 1);
    expect(moznosti).toContainEqual({ type: "bezReakcie" });
    // Počas reakcie sa nedá dať NA EX ani fajčiť — len vyložiť kartu alebo nič.
    expect(moznosti.every((c) => c.type === "bezReakcie" || c.type === "place")).toBe(true);
    const karta = s.hraci[1].ruka[0] as CardInstance;
    s = apply(data, s, { type: "place", uid: karta.uid, target: "superova" }, 1).state;
    expect(s.strany[0].map((p) => p.card.uid)).toContain(karta.uid);
    expect(s.pitkaStav?.reakcia).toBeNull();
    expect(naTahu(s)).toBe(0);
  });

  it("bez kariet v ruke sa reakcia neponúka", () => {
    const s0 = setupGame(data, 12);
    const moja = inst("pijan");
    let s = vPitke({ ...s0, hraci: [s0.hraci[0], { ...s0.hraci[1], ruka: [] }] }, [[lezi(moja, 0)], []]);
    s = apply(data, s, { type: "naex", uid: moja.uid }, 0).state;
    expect(s.pitkaStav?.reakcia).toBeNull();
    expect(naTahu(s)).toBe(0);
  });

  it("na Liberála NA EX dať nemožno", () => {
    const liberal = inst("liberal");
    const s = vPitke(setupGame(data, 13), [[lezi(liberal, 0)], []]);
    expect(moznostiNaex(data, s, 0)).not.toContain(liberal.uid);
    expect(() => apply(data, s, { type: "naex", uid: liberal.uid }, 0)).toThrow(/Liberál/);
  });
});

describe("Krčma vynúti NA EX", () => {
  it("s plným poldeci a vlastným Občanom v línii sa Pitka bez NA EX neskončí", () => {
    const s0 = setupGame(data, 14);
    const krcma = inst("krcma");
    const moja = inst("pijan");
    const s = { ...vPitke(s0, [[lezi(moja, 0)], []]), ciel: { typ: "lokalita" as const, lokalita: krcma, elderId: null } };
    expect(legalCommands(data, s, 0)).not.toContainEqual({ type: "skipNaex" });
    expect(() => apply(data, s, { type: "skipNaex" }, 0)).toThrow(/Krčma/);
    // Bez poldeci povinnosť zaniká.
    const bez = { ...s, hraci: [{ ...s.hraci[0], poldeciPlne: 0 }, s.hraci[1]] as GameState["hraci"] };
    expect(legalCommands(data, bez, 0)).toContainEqual({ type: "skipNaex" });
  });
});

describe("nahradený starší ostáva v hre", () => {
  it("dáva priazeň a jeho marker sa dá posunúť Pohoršením; bojovať o neho sa nedá", () => {
    const s0 = setupGame(data, 15);
    const e0 = s0.starsi[0]!;
    const nahradeny = { ...e0, nahradeny: true, ziskal: 0 as PlayerId, marker: 7 as const, markerZaciatokKola: 7 as const };
    const starsi = [nahradeny, ...s0.starsi.slice(1)];
    const s: GameState = {
      ...s0,
      faza: "bitka",
      starsi,
      bitkaStav: bitka({ krok: "pohorsenie", caka: 1, pohorsenieZostava: [0, 1], vitaz: null }),
    };
    const favour = data.scorecards.find((sc) => sc.id === e0.scorecard)!.favour;
    expect(priazen(data, s, favour, 1)).toBe(2);
    expect(legalCommands(data, s, 1)).toContainEqual({ type: "pohorsenie", elderId: e0.elderId });
    const po = apply(data, s, { type: "pohorsenie", elderId: e0.elderId }, 1).state;
    expect(po.starsi[0]!.marker).toBe(6);
    // Bitka o náhradu nie je v ponuke.
    const volba: GameState = { ...s0, starsi };
    expect(legalCommands(data, volba, volba.utocnik).some((c) => c.type === "chooseElder" && c.elderId === e0.elderId)).toBe(false);
  });
});

describe("bitka o staršieho", () => {
  it("karta staršieho leží v strede línie a útočník ju natočí", () => {
    const s0 = setupGame(data, 16);
    const e0 = { ...s0.starsi[0]!, marker: 7 as const, markerZaciatokKola: 7 as const };
    const s: GameState = { ...s0, starsi: [e0, ...s0.starsi.slice(1)] };
    expect(legalCommands(data, s, s.utocnik)).toContainEqual({ type: "chooseElder", elderId: e0.elderId, otocena: true });
    const po = apply(data, s, { type: "chooseElder", elderId: e0.elderId, otocena: true }, s.utocnik).state;
    expect(po.ciel?.lokalita).toEqual(e0.karta);
    expect(po.lokalitaOtocena).toBe(true);
  });

  it("náhľad: víťazovi pribudne získaný starší, body z toho staršieho zmiznú", () => {
    const s0 = setupGame(data, 17);
    const e0 = { ...s0.starsi[0]!, marker: 1 as const, markerZaciatokKola: 1 as const };
    const view = viewFor(data, { ...s0, starsi: [e0, ...s0.starsi.slice(1)] }, 0);
    const n = nahladBitkyOStarsieho(data, view, e0.elderId);
    // Po bitke je marker v sivej — hráč 1 (obávaný) z neho nemá nič.
    expect(n.vyhra[0][1]).toBeLessThanOrEqual(n.teraz[1]);
    expect(n.vyhra[1][1]).toBeLessThanOrEqual(n.teraz[1]);
  });
});

describe("limit ruky (6 + Zberateľ) a Hrobár", () => {
  it("nadbytok sa odhodí podľa výberu; súperov Hrobár za to dá cigarety", () => {
    const s0 = setupGame(data, 20);
    const ruka = Array.from({ length: 8 }, () => inst("pijan"));
    const hrobar = inst("hrobar");
    const s: GameState = {
      ...s0,
      faza: "bitka",
      strany: [[], [lezi(hrobar, 1)]],
      hraci: [{ ...s0.hraci[0], ruka }, { ...s0.hraci[1], cigarety: 0, ruka: [] }],
      ciel: { typ: "lokalita", lokalita: s0.lokalityVHre[0]!, elderId: null },
      lokalityVHre: s0.lokalityVHre.slice(1),
      bitkaStav: bitka({ krok: "limitRuky", caka: 0, limitHotovy: [false, true] }),
    };
    const odhod = legalCommands(data, s, 0).find((c) => c.type === "odhod");
    expect(odhod).toEqual({ type: "odhod", uids: [ruka[0]!.uid, ruka[1]!.uid] });
    expect(() => apply(data, s, { type: "odhod", uids: [ruka[0]!.uid] }, 0)).toThrow(/presne 2/);
    const po = apply(data, s, { type: "odhod", uids: [ruka[3]!.uid, ruka[5]!.uid] }, 0).state;
    expect(po.hraci[0].ruka).toHaveLength(6);
    expect(po.hraci[0].odhadzovaci.map((k) => k.uid)).toEqual(expect.arrayContaining([ruka[3]!.uid, ruka[5]!.uid]));
    expect(po.hraci[1].cigarety).toBe(2);
    expect(po.kolo).toBe(s0.kolo + 1);
  });
});

describe("Benzínka, Dievčina na vydaj a Krčmárka pri bitke", () => {
  const C4: Layout4 = ["Cigaretka", "Cigaretka", "Cigaretka", "Cigaretka"];
  const kuric = makeDef("kuric", C4, C4, { tags: ["Občan", "Chlap"] });
  const sada = sadaS(kuric);

  it("nad 7 Cigaretiek sa Občania z línie spália a lokalita prepadne", () => {
    const s0 = setupGame(sada, 21);
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
      ciel: { typ: "lokalita", lokalita: benzinka, elderId: null },
      lokalityVHre: s0.lokalityVHre.filter((x) => x.uid !== benzinka.uid),
    };
    s = apply(sada, s, { type: "skipNaex" }, naTahu(s)!).state;
    if (s.faza === "pitka") s = apply(sada, s, { type: "skipNaex" }, naTahu(s)!).state;
    s = dohrajBitku(sada, s);
    expect(s.prepadnute.map((x) => x.uid)).toEqual([benzinka.uid]);
    expect(s.ovladnute).toHaveLength(0);
    const vsetky = (p: PlayerId) => [...s.hraci[p].odhadzovaci, ...s.hraci[p].doberaci, ...s.hraci[p].ruka].map((x) => x.uid);
    for (const x of [a, b]) expect(vsetky(0)).not.toContain(x.uid);
    for (const x of [c, d]) expect(vsetky(1)).not.toContain(x.uid);
    // Krčmárka: bez Absťáku a bez NA EX sa vypitý poldeci otočil na plný.
    expect(s.hraci[0].poldeciVypite).toBe(0);
  });

  it("Dievčina spáli toľko priznaných Dlhov, koľko mala aktívnych akcií, a sama sa spáli", () => {
    const dievcina = makeDef("dievcina_na_vydaj", EMPTY, ["Rana", null, null, null], { tags: ["Občan", "Závislý", "Žena"] });
    const sused = makeDef("sused", ["Rana", null, null, null], EMPTY, { tags: ["Občan"] });
    const sada2 = sadaS(dievcina, sused);
    const s0 = setupGame(sada2, 22);
    const d = instanceFor(sada2, "dievcina_na_vydaj", EMPTY, ["Rana", null, null, null]);
    const n = instanceFor(sada2, "sused", ["Rana", null, null, null], EMPTY);
    const dlhy = [inst("dlh"), inst("dlh"), inst("dlh")];
    // Hráč 1 je natočený opačne — dáme Dievčinu hráčovi 0 na stranu 1 (bez otočenia).
    const hraci = [{ ...s0.hraci[0], priznane: dlhy }, s0.hraci[1]] as GameState["hraci"];
    let s: GameState = {
      ...vPitke(s0, [[], [lezi(d, 0), lezi(n, 0)]], s0.utocnik === 0 ? 1 : 0),
      hraci,
      ciel: { typ: "lokalita", lokalita: s0.lokalityVHre[0]!, elderId: null },
      lokalityVHre: s0.lokalityVHre.slice(1),
    };
    s = apply(sada2, s, { type: "skipNaex" }, naTahu(s)!).state;
    if (s.faza === "pitka") s = apply(sada2, s, { type: "skipNaex" }, naTahu(s)!).state;
    s = dohrajBitku(sada2, s);
    // 1 aktívna akcia → 1 Dlh; Exekútor (mimo ohrozenia) spáli ďalší.
    expect(s.hraci[0].priznane.filter((k) => k.defId === "dlh")).toHaveLength(1);
    const vsetky = [...s.hraci[0].odhadzovaci, ...s.hraci[0].doberaci, ...s.hraci[0].ruka].map((x) => x.uid);
    expect(vsetky).not.toContain(d.uid);
    expect(vsetky).toContain(n.uid);
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

  it("Liberál: pri rovnakom počte žien a chlapov sa jeho akcie rátajú dvakrát", () => {
    expect(evaluateLine(sd, linia("zena", "liberal", "chlap")).sums[0].Rana).toBe(2 + 4);
    expect(evaluateLine(sd, linia("zena", "liberal", "zena2")).sums[0].Rana).toBe(2 + 2);
  });

  it("Silná nezávislá žena: jej akcie platia len medzi dvoma chlapmi", () => {
    expect(evaluateLine(sd, linia("chlapL", "silna_nezavisla_zena", "chlap")).sums[0].Rana).toBe(4);
    expect(evaluateLine(sd, linia("chlapL", "silna_nezavisla_zena", "zena2")).sums[0].Rana).toBe(2);
  });

  it("Zámočník: akcie Nástroja v jeho okolí sú posilnené", () => {
    expect(evaluateLine(sd, linia("zamocnik", "nastroj")).sums[0].Rana).toBe(1 + 2);
  });

  it("Šarlatán: Viera v jeho okolí platí ako Vízia", () => {
    const sums = evaluateLine(sd, linia("sarlatan", "veriaca")).sums[0];
    expect(sums.Viera).toBe(1);
    expect(sums.Vízia).toBe(1);
  });

  it("Pijan: žena v okolí s aktívnym Poldeci mu dá ranu do vlastnej partie", () => {
    const sums = evaluateLine(sd, linia("pijan", "zena_poldeci", "pijak")).sums;
    expect(sums[1].Rana).toBe(1);
  });

  it("Veterán: podporený ženou vpravo stratí ľavé akcie, s influencerom v partii pravé", () => {
    expect(evaluateLine(sd, linia("chlapL", "veteran", "zena2")).sums[0].Rana).toBe(1 + 2);
    expect(evaluateLine(sd, linia("influencer", "veteran", "zena2")).sums[0].Rana).toBe(1 + 1);
  });
});

describe("Svätý text a Pasca", () => {
  it("Svätý text: Viera nechráni pred tuhým, ruší mäkké", () => {
    const strana = (sums: Record<string, number>, dlhy = 0) => ({
      sums,
      cirhozaBonus: 0,
      tuheBonus: 0,
      abstaky: 0,
      priznaneDlhy: dlhy,
      priazenBitkara: 0,
      hodnotaViery: 1,
    });
    // Bežne Viera najprv ruší Povery 1:1 — mäkké potom zmierni len Viera, ktorá
    // ostala (napr. keď súperove Noviny vyrušenie vypnú).
    const r = computeDamage([strana({ Rana: 3, Povera: 3 }), strana({ Viera: 2 }, 5)], {
      poveraVieraSaNerusia: [true, false],
      vieraProtiMakkemu: [false, true],
    });
    expect(r.tuhe[0]).toBe(3);
    expect(r.makke[0]).toBe(1);
  });

  it("Pasca: najviac jedno Obmedzenie a to dá súperovi pecku", () => {
    const s = setupGame(data, 23);
    const stav = { ...s, hraci: [{ ...s.hraci[0], dedicstvo: [inst("pasca")] }, s.hraci[1]] as GameState["hraci"] };
    const d = poskodenieBitky(data, stav, [{ Obmedzenie: 3 }, {}], [0, 0]);
    expect(d.tuhe[0]).toBe(2);
  });
});

describe("Policajtka, Veštica — odhalené balíčky len tomu, kto vyberá", () => {
  it("Policajtka: vlastný balíček vidí len vyberajúci; vybrané idú navrch", () => {
    const s0 = setupGame(data, 24);
    const z = { naTahu: 0 as PlayerId, zostavaLimit: [3, 3] as const, pasoval: [false, false] as const, navyse: [0, 0] as const };
    const policajtka = inst("policajtka");
    const s: GameState = {
      ...s0,
      faza: "zhromazdenie",
      zhromazdenieStav: z,
      hraci: [{ ...s0.hraci[0], ruka: [policajtka, ...s0.hraci[0].ruka] }, s0.hraci[1]],
    };
    const po = apply(data, s, { type: "place", uid: policajtka.uid, target: "vlastna" }, 0).state;
    expect(po.volba).toEqual({ typ: "policajtka", hrac: 0, potom: "zhromazdenie" });
    expect(naTahu(po)).toBe(0);
    expect(viewFor(data, po, 0).volbaPolicajtka).toEqual(po.hraci[0].doberaci);
    expect(viewFor(data, po, 1).volbaPolicajtka).toBeNull();
    const balicek = po.hraci[0].doberaci;
    const hotovo = apply(data, po, { type: "policajtka", hore: [2, 0] }, 0).state;
    expect(hotovo.hraci[0].doberaci.slice(0, 3)).toEqual([balicek[2], balicek[0], balicek[1]]);
    expect(hotovo.volba).toBeNull();
    expect(naTahu(hotovo)).toBe(1);
  });

  it("Veštica: oba balíčky vidí len porazený počas výberu", () => {
    const s0 = setupGame(data, 25);
    const s: GameState = { ...s0, faza: "bitka", bitkaStav: bitka({ krok: "vestica", caka: 1, vitaz: 0, vesticaHotova: false }) };
    const v1 = viewFor(data, s, 1).volbaVestica;
    expect(v1?.moj).toEqual(s.hraci[1].doberaci);
    expect(v1?.jeho).toEqual(s.hraci[0].doberaci);
    expect(viewFor(data, s, 0).volbaVestica).toBeNull();
    expect(viewFor(data, { ...s, bitkaStav: bitka({ krok: "liecba", caka: 1 }) }, 1).volbaVestica).toBeNull();
  });
});

describe("Poštárka, Starosta a Vychovávateľka", () => {
  it("Poštárka dober navyše s Dlhom; Starosta vymení kartu za cigaretu", () => {
    const s0 = setupGame(data, 26);
    const postarka = inst("postarka");
    const starosta = inst("starosta");
    // Šenok pri rozdaní nie je — stavia sa v drafte.
    let s = vPitke(
      { ...s0, senok: [inst("pijan")], hraci: [{ ...s0.hraci[0], cigarety: 2 }, s0.hraci[1]] },
      [[lezi(postarka, 0), lezi(starosta, 0)], []],
    );
    const ruka = s.hraci[0].ruka.length;
    s = apply(data, s, { type: "postarka", pocet: 2 }, 0).state;
    expect(s.hraci[0].ruka.length).toBe(ruka + 2);
    expect(s.hraci[0].odhadzovaci.filter((k) => k.defId === "dlh")).toHaveLength(1);
    expect(() => apply(data, s, { type: "postarka", pocet: 1 }, 0)).toThrow(/už použil/);
    const zRuky = s.hraci[0].ruka[0]!;
    const zoSenku = s.senok[0]!;
    s = apply(data, s, { type: "starosta", rukaUid: zRuky.uid, senokUid: zoSenku.uid }, 0).state;
    expect(s.hraci[0].ruka.map((k) => k.uid)).toContain(zoSenku.uid);
    expect(s.senok.map((k) => k.uid)).toContain(zRuky.uid);
    expect(s.hraci[0].cigarety).toBe(1);
  });

  it("Vychovávateľka: po NA EX si súper berie tvoj priznaný Dlh na ruku", () => {
    const s0 = setupGame(data, 27);
    const vych = inst("vychovavatelka");
    const moja = inst("pijan");
    const dlh = inst("dlh");
    let s = vPitke({ ...s0, hraci: [{ ...s0.hraci[0], priznane: [dlh] }, s0.hraci[1]] }, [[lezi(vych, 0), lezi(moja, 0)], []]);
    s = apply(data, s, { type: "naex", uid: moja.uid }, 0).state;
    expect(s.hraci[0].priznane).toHaveLength(0);
    expect(s.hraci[1].ruka.map((k) => k.uid)).toContain(dlh.uid);
  });
});

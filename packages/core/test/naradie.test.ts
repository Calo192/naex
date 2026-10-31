// Náradie (Michal 2026-10-30, docs/napady/naradie-akcie.html, sekcia Rozhodnuté):
// 12 Nástrojov do Dedičstva, Profesionálny tipér a zmena akcie Robota (§2, §11, §12, §16).
// Karty pridá Admin do sady — tu sa skúšajú na testovacích kartách a inštanciách v Dedičstve.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { BitkaStav, CardInstance, GameState, LineState, MarkerPos, PlacedCard, PlayerId } from "../src/index.ts";
import {
  apply,
  cenaKroku,
  favourStarsieho,
  cigaretyZaPas,
  evaluateLine,
  legalCommands,
  loadGameData,
  nastrojeTuhe,
  naTahu,
  posunZaBody,
  setupGame,
  silaPriazne,
  viewFor,
  vplyvyNaAkcie,
} from "../src/index.ts";
import { EMPTY, instanceFor, makeDef, syntheticData, type Layout4 } from "./helpers.ts";

let uidSeq = 870000;
const nastroj = (defId: string): CardInstance => ({ uid: ++uidSeq, defId, leftLayout: 0, rightLayout: 0 });
const own = (card: CardInstance, naex = false): PlacedCard => ({ card, playedBy: 0, ...(naex ? { naexBy: 1 as PlayerId } : {}) });

/** Partia hráča 0 bez lokality: [A, B] — ľavá strana A proti pravej B; Nástroje hráča 0 v Dedičstve. */
function par(aLeft: Layout4, bRight: Layout4, nastroje: readonly string[], o: { naexA?: boolean; aId?: string } = {}) {
  const aId = o.aId ?? "a";
  const data = syntheticData([makeDef(aId, aLeft, EMPTY), makeDef("b", EMPTY, bRight)]);
  const a = instanceFor(data, aId, aLeft, EMPTY);
  const b = instanceFor(data, "b", EMPTY, bRight);
  const l: LineState = { lokalita: null, lokalitaOtocena: false, strany: [[own(a, o.naexA), own(b)], []], nastroje: [nastroje, []] };
  return { data, a, b, l };
}

describe("Náradie v línii (§12)", () => {
  it("Zapaľovač: tvoje aktívne Cigarety NA EX nezruší (ostatné áno)", () => {
    const bez = par(["Cigareta", "Rana", null, null], ["Cigareta", "Rana", null, null], [], { naexA: true });
    expect(evaluateLine(bez.data, bez.l).sums[0]).toEqual({ Cigareta: 1, Rana: 1 });
    const s = par(["Cigareta", "Rana", null, null], ["Cigareta", "Rana", null, null], ["zapalovac"], { naexA: true });
    expect(evaluateLine(s.data, s.l).sums[0]).toEqual({ Cigareta: 2, Rana: 1 });
  });

  it("Energeťák: tvoje Posilnenie NA EX nezruší — partner ostáva ×2", () => {
    const bez = par([null, "Posilnenie", null, null], [null, "Pecka", null, null], [], { naexA: true });
    expect(evaluateLine(bez.data, bez.l).sums[0]).toEqual({ Pecka: 1 });
    const s = par([null, "Posilnenie", null, null], [null, "Pecka", null, null], ["energetak"], { naexA: true });
    expect(evaluateLine(s.data, s.l).sums[0]).toEqual({ Pecka: 2 });
  });

  it("Výherné žreby: Hazard nespojený aktívny, spojený neaktívny; NA EX zdvojí spojené (O1)", () => {
    // A: Hazard na indexe 0 (spojený s Ranou B) a na indexe 2 (bez partnera).
    const s = par(["Dlh", null, "Dlh", null], ["Rana", null, null, null], ["vyherne_zreby"]);
    expect(evaluateLine(s.data, s.l).sums[0]).toEqual({ Dlh: 1, Rana: 1 });
    const n = par(["Dlh", null, "Dlh", null], ["Rana", null, null, null], ["vyherne_zreby"], { naexA: true });
    // NA EX na A: spojený (neaktívny) Hazard ×2, nespojený (aktívny) zrušený.
    expect(evaluateLine(n.data, n.l).sums[0]).toEqual({ Dlh: 2, Rana: 1 });
  });

  it("Hrable: akcia zrušená tvojím Odporom sa ráta ako tvoja a posilnená", () => {
    // Súperova Petelica (karta hráča 1 vedľa môjho Odporu) — bez Hrablí zrušená, s nimi moja ×2.
    const data = syntheticData([makeDef("a", [null, "Odpor", null, null], EMPTY), makeDef("c", [null, null, "Petelica", null], EMPTY)]);
    const a = instanceFor(data, "a", [null, "Odpor", null, null], EMPTY);
    // Karta hráča 1 v partii hráča 0 je otočená: jej vytlačená ľavá (index 2) je efektívna pravá (index 1).
    const c = instanceFor(data, "c", [null, null, "Petelica", null], EMPTY);
    const strany = [[own(a), { card: c, playedBy: 1 as PlayerId }], []] as const;
    const bez = evaluateLine(data, { lokalita: null, lokalitaOtocena: false, strany, nastroje: [[], []] });
    expect(bez.sums).toEqual([{}, {}]);
    const s = evaluateLine(data, { lokalita: null, lokalitaOtocena: false, strany, nastroje: [["hrable"], []] });
    expect(s.sums).toEqual([{ Petelica: 2 }, {}]);
  });

  it("Puška: prepojenú Petelicu Odpor ani NA EX nezruší — udelí o 1 menej (3 → 2); súperove Hrable nemajú čo ukradnúť", () => {
    // NA EX na kartu s prepojenou Petelicou: bez Pušky zrušená, s Puškou 2 (v súčtoch ako Pecka).
    const bez = par([null, null, "Petelica", null], [null, null, "Rana", null], [], { naexA: true });
    expect(evaluateLine(bez.data, bez.l).sums[0]).toEqual({ Rana: 1 });
    const s = par([null, null, "Petelica", null], [null, null, "Rana", null], ["puska"], { naexA: true });
    expect(evaluateLine(s.data, s.l).sums[0]).toEqual({ Pecka: 1, Rana: 1 });
    // Odpor súpera proti mojej Petelici; súper má Hrable — Puška zrušenie nedovolí, Hrable nič.
    const data = syntheticData([makeDef("a", [null, "Petelica", null, null], EMPTY), makeDef("c", [null, null, "Odpor", null], EMPTY)]);
    const a = instanceFor(data, "a", [null, "Petelica", null, null], EMPTY);
    const c = instanceFor(data, "c", [null, null, "Odpor", null], EMPTY);
    const strany = [[own(a), { card: c, playedBy: 1 as PlayerId }], []] as const;
    expect(evaluateLine(data, { lokalita: null, lokalitaOtocena: false, strany, nastroje: [[], ["hrable"]] }).sums).toEqual([{}, { Petelica: 2 }]);
    expect(evaluateLine(data, { lokalita: null, lokalitaOtocena: false, strany, nastroje: [["puska"], ["hrable"]] }).sums).toEqual([{ Pecka: 1 }, {}]);
    // Neprepojená Petelica (NA EX ju len zdvojí ako neaktívnu) — Puška sa neuplatní.
    const n = par([null, null, "Petelica", null], EMPTY, ["puska"], { naexA: true });
    expect(evaluateLine(n.data, n.l).sums[0]).toEqual({ Petelica: 2 });
  });

  it("Zrkadlo: tvoj Pakt kopíruje prepojenú akciu dvakrát", () => {
    const bez = par([null, "Pakt", null, null], [null, "Petelica", null, null], []);
    expect(evaluateLine(bez.data, bez.l).sums[0]).toEqual({ Petelica: 2 });
    const s = par([null, "Pakt", null, null], [null, "Petelica", null, null], ["zrkadlo"]);
    expect(evaluateLine(s.data, s.l).sums[0]).toEqual({ Petelica: 3 });
  });

  it("Profesionálny tipér: tvoja posilnená akcia na jeho spoji sa ráta ako posilnená Robota", () => {
    const s = par([null, "Posilnenie", null, null], [null, "Petelica", null, null], [], { aId: "profesionalny_tiper" });
    expect(evaluateLine(s.data, s.l).sums[0]).toEqual({ Robota: 2 });
  });

  it("Profesionálny tipér: súperova posilnená akcia na jeho spoji sa ráta ako posilnený Hazard", () => {
    // Tipér hráča 0 s Posilnením, vedľa karta hráča 1 s Pečkou na spoji.
    const data = syntheticData([makeDef("profesionalny_tiper", [null, "Posilnenie", null, null], EMPTY), makeDef("c", [null, null, "Pecka", null], EMPTY)]);
    const t = instanceFor(data, "profesionalny_tiper", [null, "Posilnenie", null, null], EMPTY);
    const c = instanceFor(data, "c", [null, null, "Pecka", null], EMPTY);
    const ev = evaluateLine(data, { lokalita: null, lokalitaOtocena: false, strany: [[own(t), { card: c, playedBy: 1 }], []] });
    expect(ev.sums).toEqual([{}, { Dlh: 2 }]);
  });
});

/** Sada v26 a testovacie Nástroje (Admin ich pridá do sady; cards.json sa skopíruje potom). */
const NOVE = ["zapalovac", "vyherne_zreby", "pistalka", "hrable", "zrkadlo", "boxer", "telefon", "jogurt", "energetak", "horoskop", "furik", "kristalova_gula"];
const zaklad = loadGameData(cardsJson, eldersJson, scorecardsJson);
const syn = syntheticData([
  ...NOVE.map((id) => makeDef(id, ["Rana", null, null, null], ["Rana", null, null, null], { tags: ["Nástroj"] })),
  makeDef("obmedzenie_test", ["Obmedzenie", null, null, null], ["Obmedzenie", null, null, null]),
  makeDef("poldeci_test", ["Poldeci", null, null, null], ["Poldeci", null, null, null]),
]);
const data = { ...zaklad, cards: new Map([...zaklad.cards, ...syn.cards]), variants: new Map([...zaklad.variants, ...syn.variants]) };

function bitka(b: Partial<BitkaStav>): BitkaStav {
  return {
    krok: null,
    caka: null,
    sums: [{}, {}],
    exekutorHotovy: [false, false],
    exekutor: [0, 0],
    pohorsenieZostava: [0, 0],
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

const sDedicstvom = (s: GameState, p: PlayerId, defIds: readonly string[]): GameState => {
  const hraci = [...s.hraci] as [GameState["hraci"][0], GameState["hraci"][1]];
  hraci[p] = { ...hraci[p], dedicstvo: [...hraci[p].dedicstvo, ...defIds.map(nastroj)] };
  return { ...s, hraci };
};

describe("Náradie mimo línie (§11, §12)", () => {
  it("Boxer: tvoje Pecky o 1 poškodenie viac (aj žeravá ikona)", () => {
    const s = sDedicstvom(setupGame(data, 3), 0, ["boxer"]);
    expect(nastrojeTuhe(s, 0, { Pecka: 2 })).toEqual([{ zdroj: "boxer", tuhe: 2 }]);
    expect(vplyvyNaAkcie(s, 0)).toContainEqual({ akcia: "Pecka", zdroj: "boxer", o: 1 });
  });

  it("Zámočník: žeravá ikona na akciách Nástroja v jeho okolí — len na tej karte, aj súperovej", () => {
    const s0 = setupGame(data, 3);
    const zam = nastroj("zamocnik");
    const boxer = nastroj("boxer");
    const iny = nastroj("telefon");
    // Hráč 0 zahral Zámočníka, hráč 1 vedľa neho Nástroj (podstrčený do partie hráča 0); ďalší Nástroj ďalej.
    const s = { ...s0, strany: [[{ card: zam, playedBy: 0 }, { card: boxer, playedBy: 1 }, { card: iny, playedBy: 1 }], []] } as GameState;
    const v1 = vplyvyNaAkcie(s, 1, data);
    expect(v1).toContainEqual(expect.objectContaining({ akcia: "Rana", zdroj: "zamocnik", uid: boxer.uid }));
    expect(v1.some((v) => v.uid === iny.uid)).toBe(false);
    expect(vplyvyNaAkcie(s, 0, data).some((v) => v.zdroj === "zamocnik")).toBe(false);
    // Do poškodenia sa nepripočíta druhýkrát (zdvojenie rieši línia).
    expect(nastrojeTuhe(s, 1, { Rana: 2 })).toEqual([]);
  });

  it("Telefón: Pohoršenie k stredu stojí toľko ako von (z červenej 3, nie 4)", () => {
    expect(cenaKroku(0, 1)).toBe(4);
    expect(cenaKroku(0, 1, true)).toBe(3);
    expect(cenaKroku(2, 3, true)).toBe(1);
    expect(posunZaBody({ marker: 0 as MarkerPos }, 1, 6, true)?.marker).toBe(3);
  });

  it("Píšťalka: súperove Obmedzenia v línii uberajú aj cigarety za pas", () => {
    const s0 = setupGame(data, 4);
    const zh = { naTahu: 0, pasoval: [false, false], zostavaLimit: [3, 3], navyse: [0, 0] };
    const s = { ...s0, zhromazdenieStav: zh as unknown as GameState["zhromazdenieStav"], lokalitaOtocena: false };
    const bez = cigaretyZaPas(data, s as GameState, 0, 3);
    expect(bez).toBe(3);
    // Bez Obmedzení v línii Píšťalka nič neuberie.
    expect(cigaretyZaPas(data, sDedicstvom(s as GameState, 1, ["pistalka"]), 0, 3)).toBe(3);
    // Súper (hráč 1) má v línii spoj Obmedzenie–Obmedzenie = 2 aktívne: s Píšťalkou za pas 3 − 2.
    const o = (): CardInstance => instanceFor(data, "obmedzenie_test", ["Obmedzenie", null, null, null], ["Obmedzenie", null, null, null]);
    const sObm = { ...s, strany: [[], [{ card: o(), playedBy: 1 as PlayerId }, { card: o(), playedBy: 1 as PlayerId }]] } as GameState;
    expect(cigaretyZaPas(data, sObm, 0, 3)).toBe(3);
    expect(cigaretyZaPas(data, sDedicstvom(sObm, 1, ["pistalka"]), 0, 3)).toBe(1);
  });

  it("Robota bez Dlhu dá špak; s Fúrikom spáli 2 Dlhy, bez nich 2 špaky", () => {
    const s0 = setupGame(data, 5);
    const ciel = s0.lokalityVHre[0]!;
    const zaklad = (dlhy: number, nastroje: readonly string[]): GameState => {
      const s: GameState = {
        ...s0,
        faza: "bitka",
        kolo: 2,
        utocnik: 1,
        ciel: { typ: "lokalita", lokalita: ciel },
        lokalityVHre: s0.lokalityVHre.slice(1),
        hraci: [{ ...s0.hraci[0], dlhy }, s0.hraci[1]],
        // Bitka čaká na Pohoršenie hráča 0; súčty s Robotou hráča 0 sa po ňom vyhodnotia (exekucieBitky).
        bitkaStav: bitka({ krok: "pohorsenie", caka: 0, pohorsenieZostava: [1, 0], sums: [{ Robota: 1, Rana: 3 }, {}] }),
      };
      return sDedicstvom(s, 0, nastroje);
    };
    const po = (s: GameState): GameState => apply(data, s, { type: "pohorsenie", elderId: s.starsi.filter((e) => favourStarsieho(data, e) !== "ROBOTA").at(-1)!.elderId }, 0).state;
    // Bez Fúrika: 3 Dlhy → spáli 1; 0 Dlhov → 1 špak.
    const a = po(zaklad(3, []));
    expect(a.hraci[0].dlhy).toBeLessThanOrEqual(2);
    expect(a.nastenka.at(-1)?.robota ?? [0, 0]).toEqual([0, 0]);
    const b = po(zaklad(0, []));
    expect(b.nastenka.at(-1)?.robota).toEqual([1, 0]);
    // S Fúrikom: 1 Dlh → spáli ho a za druhý 1 špak; bez Dlhov 2 špaky.
    const c = po(zaklad(1, ["furik"]));
    expect(c.nastenka.at(-1)?.robota).toEqual([1, 0]);
    const d = po(zaklad(0, ["furik"]));
    expect(d.nastenka.at(-1)?.robota).toEqual([2, 0]);
    expect(d.spaky[0] - b.spaky[0]).toBe(1);
  });

  it("Jogurt: tvoje Poldeci otočia vypitý poldeci hneď v Pitke, bitka ich znova neotočí", () => {
    const s0 = setupGame(data, 7);
    const k = (): CardInstance => instanceFor(data, "poldeci_test", ["Poldeci", null, null, null], ["Poldeci", null, null, null]);
    const pitka = (jogurt: boolean): GameState => {
      const zaklad: GameState = {
        ...s0,
        faza: "pitka",
        utocnik: 1,
        ciel: { typ: "lokalita", lokalita: s0.lokalityVHre[0]! },
        lokalityVHre: s0.lokalityVHre.slice(1),
        strany: [[own(k()), own(k())], []],
        pitkyCelkom: 1,
        pitkaCislo: 1,
        pitkaStav: { naTahu: 0, hotovy: [false, false], naexPouzity: [false, false], fajcenie: [0, 0], reakcia: null, postarka: [false, false], starosta: [false, false], naexPocet: [0, 0], vykup: [false, false] },
        hraci: [{ ...s0.hraci[0], poldeciPlne: 0, poldeciVypite: 2 }, s0.hraci[1]],
      };
      return jogurt ? sDedicstvom(zaklad, 0, ["jogurt"]) : zaklad;
    };
    const skonci = (s: GameState): GameState => {
      let t = s;
      for (let i = 0; i < 4 && t.faza === "pitka"; i++) {
        const p = ([0, 1] as const).find((x) => legalCommands(data, t, x).some((c) => c.type === "skipNaex"));
        if (p === undefined) break;
        t = apply(data, t, { type: "skipNaex" }, p).state;
      }
      return t;
    };
    const bez = skonci(pitka(false));
    const s = skonci(pitka(true));
    expect(s.hraci[0].poldeciPlne - bez.hraci[0].poldeciPlne).toBeGreaterThanOrEqual(1);
    expect(s.poldeciOtoceneVKole?.[0] ?? 0).toBeGreaterThanOrEqual(1);
  });

  it("Krištáľová guľa: Vízia ponúkne aj druhú kartu zhora — tá ide do ruky, vrchná ostane navrchu", () => {
    const s0 = sDedicstvom(setupGame(data, 6), 0, ["kristalova_gula"]);
    const dva = [nastroj("pijan"), nastroj("kulturista")];
    const s: GameState = {
      ...s0,
      faza: "pitka",
      vizia: { zostava: [1, 0] },
      hraci: [{ ...s0.hraci[0], doberaci: dva, ruka: [] }, s0.hraci[1]],
    };
    expect(viewFor(data, s, 0).volbaViziaDruha?.defId).toBe("kulturista");
    expect(viewFor(data, s, 1).volbaViziaDruha ?? null).toBeNull();
    expect(legalCommands(data, s, 0)).toContainEqual({ type: "vizia", vziat: true, druha: true });
    const t = apply(data, s, { type: "vizia", vziat: true, druha: true }, 0).state;
    expect(t.hraci[0].ruka.map((k) => k.defId)).toEqual(["kulturista"]);
    expect(t.hraci[0].doberaci[0]?.defId).toBe("pijan");
  });

  it("Horoskop: klebety z tvojich Povier platia aj v nasledujúcom kole", () => {
    const s0 = sDedicstvom(setupGame(data, 5), 0, ["horoskop"]);
    const ciel = s0.lokalityVHre.find((k) => k.defId === "krcma")!;
    const stred = s0.starsi.map((e) => ({ ...e, marker: 3 as MarkerPos }));
    const s: GameState = {
      ...s0,
      faza: "bitka",
      kolo: 2,
      utocnik: 1,
      starsi: stred,
      ciel: { typ: "lokalita", lokalita: ciel },
      lokalityVHre: s0.lokalityVHre.filter((k) => k.defId !== "krcma"),
      bitkaStav: bitka({ krok: "povery", caka: 0, poveryZostava: [1, 0], exekutorHotovy: [true, true] }),
    };
    const elder = s.starsi[0]!;
    let t = apply(data, s, { type: "povera", elderId: elder.elderId }, 0).state;
    const favour = data.scorecards.find((x) => x.id === elder.scorecard)!.favour;
    expect(silaPriazne(data, t, favour, 0)).toBe(1);
    for (let i = 0; i < 60 && t.bitkaStav !== null && t.koniec === null; i++) {
      const p = naTahu(t) as PlayerId;
      t = apply(data, t, legalCommands(data, t, p)[0]!, p).state;
    }
    expect(t.bitkaStav).toBeNull();
    expect(t.klebetyPrenesene?.[elder.elderId]).toBe(1);
    expect(viewFor(data, t, 1).klebetyPrenesene?.[elder.elderId]).toBe(1);
  });
});

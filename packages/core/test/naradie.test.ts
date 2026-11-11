// Náradie (Michal 2026-10-30, docs/napady/naradie-akcie.html, sekcia Rozhodnuté):
// 12 Nástrojov do Dedičstva a zmena akcie Robota (§2, §11, §12, §16). Profesionálny tipér je od
// 2026-11-08 Školiteľ na Konflikte (skolitelia.test.ts).
// Karty pridá Admin do sady — tu sa skúšajú na testovacích kartách a inštanciách v Dedičstve.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { BitkaStav, CardInstance, GameState, LineState, PlacedCard, PlayerId } from "../src/index.ts";
import {
  apply,
  favourStarsieho,
  KONSTANTY,
  doliatiePoPitke,
  evaluateLine,
  legalCommands,
  loadGameData,
  nastrojeTuhe,
  naTahu,
  poskodenieBitky,
  setupGame,
  silaPriazne,
  viewFor,
  vplyvyNaAkcie,
} from "../src/index.ts";
import { EMPTY, instanceFor, makeDef, spustBitku, syntheticData, type Layout4, zPolohy } from "./helpers.ts";

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

  it("Hrable (v12.1): tvoj aktívny Odpor dáva v bitke poškodenie ako Pecka; Odpor na spoji nie", () => {
    const data = syntheticData([makeDef("a", [null, "Odpor", null, null], EMPTY), makeDef("c", [null, null, "Petelica", null], EMPTY)]);
    const a = instanceFor(data, "a", [null, "Odpor", null, null], EMPTY);
    const sam = [[own(a)], []] as const;
    expect(evaluateLine(data, { lokalita: null, lokalitaOtocena: false, strany: sam, nastroje: [[], []] }).sums).toEqual([{}, {}]);
    const s = evaluateLine(data, { lokalita: null, lokalitaOtocena: false, strany: sam, nastroje: [["hrable"], []] });
    expect(s.sums).toEqual([{ Pecka: 1 }, {}]);
    expect(s.zdroje[0].Pecka?.[0]).toMatchObject({ defId: "a", dovody: ["Odpor", "karta:hrable"] });
    // Súperove Hrable môj Odpor nevidia.
    expect(evaluateLine(data, { lokalita: null, lokalitaOtocena: false, strany: sam, nastroje: [[], ["hrable"]] }).sums).toEqual([{}, {}]);
    // Súperova Petelica (karta hráča 1 vedľa môjho Odporu): Odpor ju zruší a zhasne — Pecka nie je, nič sa neukradne.
    // Karta hráča 1 v partii hráča 0 je otočená: jej vytlačená ľavá (index 2) je efektívna pravá (index 1).
    const c = instanceFor(data, "c", [null, null, "Petelica", null], EMPTY);
    const strany = [[own(a), { card: c, playedBy: 1 as PlayerId }], []] as const;
    expect(evaluateLine(data, { lokalita: null, lokalitaOtocena: false, strany, nastroje: [["hrable"], []] }).sums).toEqual([{}, {}]);
  });

  it("Puška: prepojenú Petelicu Odpor ani NA EX nezruší — udelí o 1 menej (3 → 2); súperove Hrable nemajú čo ukradnúť", () => {
    // NA EX na kartu s prepojenou Petelicou: bez Pušky zrušená, s Puškou 2 (v súčtoch ako Pecka).
    const bez = par([null, null, "Petelica", null], [null, null, "Rana", null], [], { naexA: true });
    expect(evaluateLine(bez.data, bez.l).sums[0]).toEqual({ Rana: 1 });
    const s = par([null, null, "Petelica", null], [null, null, "Rana", null], ["puska"], { naexA: true });
    expect(evaluateLine(s.data, s.l).sums[0]).toEqual({ Pecka: 1, Rana: 1 });
    // Odpor súpera proti mojej Petelici; súper má Hrable — Odpor na spoji mu Pecku nedá (v12.1), Puška zrušenie nedovolí.
    const data = syntheticData([makeDef("a", [null, "Petelica", null, null], EMPTY), makeDef("c", [null, null, "Odpor", null], EMPTY)]);
    const a = instanceFor(data, "a", [null, "Petelica", null, null], EMPTY);
    const c = instanceFor(data, "c", [null, null, "Odpor", null], EMPTY);
    const strany = [[own(a), { card: c, playedBy: 1 as PlayerId }], []] as const;
    expect(evaluateLine(data, { lokalita: null, lokalitaOtocena: false, strany, nastroje: [[], ["hrable"]] }).sums).toEqual([{}, {}]);
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
    damage: null,
    vitaz: null,
    prebytokDrzi: null,
    prebytokZostava: 0,
    prebytokZdvihy: [], prebytokPrepadlo: 0,
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

  it("Izolačka (pistalka, v12.2): za každé súperovo aktívne Obmedzenie sa ti po Pitke doleje o 1 poldeci menej", () => {
    const s0 = setupGame(data, 4);
    const s: GameState = { ...s0, hraci: [{ ...s0.hraci[0], poldeciPlne: 0, poldeciVypite: 5 }, s0.hraci[1]] };
    const sums = [{ Poldeci: 2 }, { Obmedzenie: 2 }] as const;
    // Bez Izolačky: 1 zadarmo + 2 akcie Poldeci.
    expect(doliatiePoPitke(s, sums, 0).zisk).toBe(3);
    // Súperova Izolačka uberie 2 — najprv to zadarmo, potom z akcií.
    const iz = doliatiePoPitke(sDedicstvom(s, 1, ["pistalka"]), sums, 0);
    expect(iz.zisk).toBe(1);
    expect(iz.izolacka).toBe(2);
    expect(iz.casti).toEqual([["akcie", 1]]);
    // Najmenej 0 — Obmedzení viac než doliatia.
    expect(doliatiePoPitke(sDedicstvom(s, 1, ["pistalka"]), [{}, { Obmedzenie: 4 }], 0).zisk).toBe(0);
    // Vlastná Izolačka tvoje doliatie nemení.
    expect(doliatiePoPitke(sDedicstvom(s, 0, ["pistalka"]), sums, 0).zisk).toBe(3);
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
        // Bitka s vyhodnotenou hádkou; súčty s Robotou hráča 0 sa vyhodnotia (exekucieBitky).
        bitkaStav: bitka({ krok: "hadka", caka: 0, sums: [{ Robota: 1, Rana: 3 }, {}], hadka: { makke: [1, 0], vitaz: 0, velkost: 1, zostava: 1, prepadlo: 0, zdvihy: [] } }),
      };
      return sDedicstvom(s, 0, nastroje);
    };
    const po = (s: GameState): GameState => spustBitku(data, s).state;
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

  it("Jogurt (v12.2): po každej Pitke sa doleje o 1 poldeci viac", () => {
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
        pitkaStav: { naTahu: 0, hotovy: [false, false], naexPouzity: [false, false], fajcenie: [0, 0], reakcia: null, postarka: [false, false], starosta: [false, false], naexPocet: [0, 0] },
        hraci: [{ ...s0.hraci[0], poldeciPlne: 0, poldeciVypite: 6 }, s0.hraci[1]],
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
    expect(bez.hraci[0].poldeciPlne).toBeGreaterThanOrEqual(2);
    expect(s.hraci[0].poldeciPlne - bez.hraci[0].poldeciPlne).toBe(KONSTANTY.JOGURT_POLDECI);
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

  it("Horoskop (v10): tvoje Povery majú silu 2; hádka (v11) priazeň nemení ani v tomto, ani v ďalšom kole", () => {
    const s0 = sDedicstvom(setupGame(data, 5), 0, ["horoskop"]);
    const ciel = s0.lokalityVHre.find((k) => k.defId === "krcma")!;
    const stred = s0.starsi.map((e) => ({ ...e, ...zPolohy(3 as number) }));
    const s: GameState = {
      ...s0,
      faza: "bitka",
      kolo: 2,
      utocnik: 1,
      starsi: stred,
      ciel: { typ: "lokalita", lokalita: ciel },
      lokalityVHre: s0.lokalityVHre.filter((k) => k.defId !== "krcma"),
      bitkaStav: bitka({ krok: "hadka", caka: 0, exekutorHotovy: [true, true], hadka: { makke: [2, 0], vitaz: 0, velkost: 1, zostava: 1, prepadlo: 0, zdvihy: [] } }),
    };
    // Povera hráča s Horoskopom dá 2 mäkké, bez neho 1.
    expect(poskodenieBitky(data, s, [{ Povera: 1 }, { Povera: 1 }]).makke).toEqual([2, 1]);
    const elder = s.starsi[0]!;
    const r = spustBitku(data, s);
    let t = r.state;
    const favour = data.scorecards.find((x) => x.id === elder.scorecard)!.favour;
    for (let i = 0; i < 60 && t.bitkaStav !== null && t.koniec === null; i++) {
      const p = naTahu(t) as PlayerId;
      t = apply(data, t, legalCommands(data, t, p)[0]!, p).state;
    }
    expect(t.bitkaStav).toBeNull();
    // Nové kolo: priazeň je znova z markera.
    expect(silaPriazne(data, t, favour, 0)).toBe(0);
    expect(JSON.stringify(viewFor(data, t, 1))).not.toContain("klebetyPrenesene");
  });
});

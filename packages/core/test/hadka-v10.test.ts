// Pravidlá v10 „Hádka“ (Michal 2026-11-01, docs/napady/hadka.html, verzia 4): Povery a Pohoršenie
// sú mäkké poškodenie, víťaz hádky rozdelí rozdiel na sily priazní starších len k sebe (cena
// podľa zóny, strop 3, marker sa nehýbe, do konca kola). Abstinent odpúšťa Absťáky; Telefón,
// Horoskop, Svätý text, Čierna mačka, Šarlatán, Veriaci v dvoch častiach. Príklady „Ana a Boris“
// z dokumentu: Ana je hráč 0, Boris hráč 1.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { BattleSide, BitkaStav, CardInstance, Favour, GameState, LineState, MarkerPos, PlacedCard, PlayerId, StavHadky } from "../src/index.ts";
import {
  apply,
  battleOutcome,
  computeDamage,
  evaluateLine,
  favourStarsieho,
  legalCommands,
  loadGameData,
  poskodenieBitky,
  rekapitulaciaBitky,
  setupGame,
  silaPriazne,
  viewFor,
  vysledokHadky,
} from "../src/index.ts";
import { EMPTY, instanceFor, makeDef, syntheticData } from "./helpers.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

function side(o: Partial<BattleSide> = {}): BattleSide {
  return { sums: {}, cirhozaBonus: 0, tuheBonus: 0, abstaky: 0, priazenBitkara: 0, hodnotaViery: 1, ...o };
}

describe("§9 krok Hádka — mäkké poškodenie (computeDamage)", () => {
  it("Ana a Boris: Borisova Viera zruší jednu Aninu Poveru — mäkké 5 : 3, Ana vyhrala hádku o 2", () => {
    const d = computeDamage([side({ sums: { Pohoršenie: 2, Povera: 2 } }), side({ sums: { Pohoršenie: 1, Povera: 1, Viera: 1 } })]);
    expect(d.makke).toEqual([5, 3]);
    expect(d.zrusenePovery).toEqual([1, 0]);
    // Viera, ktorá rušila Poveru, na tuhé nezostane.
    expect(d.zvysnaViera).toEqual([0, 0]);
    expect(vysledokHadky(d.makke)).toEqual({ vitaz: 0, velkost: 2 });
  });

  it("rovnosť mäkkého = remíza, nikto nerozdeľuje (H5)", () => {
    expect(vysledokHadky(computeDamage([side({ sums: { Pohoršenie: 1 } }), side({ sums: { Povera: 2 } })]).makke)).toEqual({ vitaz: null, velkost: 0 });
    expect(vysledokHadky([0, 0])).toEqual({ vitaz: null, velkost: 0 });
  });

  it("Viera proti Pohoršeniu nepomáha — zvyšná Viera tlmí tuhé", () => {
    const d = computeDamage([side({ sums: { Pohoršenie: 2, Rana: 3 } }), side({ sums: { Viera: 2 } })]);
    expect(d.makke).toEqual([4, 0]);
    expect(d.tuhe[0]).toBe(1);
  });

  it("Horoskop: Povera má silu 2; ruší sa stále 1 : 1 na kusy — jedna Viera zruší 2 mäkké", () => {
    const d = computeDamage([side({ sums: { Povera: 3 }, silaPovery: 2 }), side({ sums: { Viera: 1 } })]);
    expect(d.zrusenePovery?.[0]).toBe(1);
    expect(d.makke[0]).toBe(4);
  });

  it("Svätý text: každá Viera zruší 2 Povery (s Horoskopom 4 mäkké); Viera, ktorá rušila, netlmí tuhé", () => {
    const bez = computeDamage([side({ sums: { Povera: 2 } }), side({ sums: { Viera: 1 }, hodnotaViery: 2 })]);
    expect(bez.makke[0]).toBe(0);
    const sHoroskopom = computeDamage([side({ sums: { Povera: 3, Rana: 4 }, silaPovery: 2 }), side({ sums: { Viera: 2 }, hodnotaViery: 2 })]);
    // Prvá Viera zruší 2 Povery (4 mäkké), druhá tretiu — žiadna nezostane na tuhé.
    expect(sHoroskopom.makke[0]).toBe(0);
    expect(sHoroskopom.zvysnaViera[1]).toBe(0);
    expect(sHoroskopom.tuhe[0]).toBe(4);
    // Zvyšná Viera so Svätým textom tlmí tuhé dvakrát.
    expect(computeDamage([side({ sums: { Povera: 1, Rana: 5 } }), side({ sums: { Viera: 2 }, hodnotaViery: 2 })]).tuhe[0]).toBe(3);
  });

  it("Čierna mačka: jej Povery sa Vierou nerušia — vždy mäkké, Viera ostáva na tuhé", () => {
    const d = computeDamage([side({ sums: { Povera: 2, Rana: 3 }, poveryBezViery: true }), side({ sums: { Viera: 2 } })]);
    expect(d.makke[0]).toBe(2);
    expect(d.tuhe[0]).toBe(1);
  });

  it("Veriaci v dvoch častiach: proti Poverám so silou pred hádkou, rozdiel po hádke v tlmení tuhého", () => {
    // Veriaci pred hádkou 1 zruší 1 Poveru; hádka mu pridala na 3 → tlmenie tuhého +2.
    const d = computeDamage([side({ sums: { Povera: 1, Rana: 5 } }), side({ vieraVeriacehoPred: 1, vieraVeriaceho: 3 })]);
    expect(d.makke[0]).toBe(0);
    expect(d.zvysnaViera[1]).toBe(2);
    expect(d.tuhe[0]).toBe(3);
    // Hádka mu silu vzala (2 → 0): Viera z Veriaceho, ktorá rušila, ostala minutá, tuhé netlmí.
    const vzala = computeDamage([side({ sums: { Rana: 5 } }), side({ vieraVeriacehoPred: 2, vieraVeriaceho: 0 })]);
    expect(vzala.zvysnaViera[1]).toBe(0);
    expect(vzala.tuhe[0]).toBe(5);
  });

  it("Abstinent: v bitke sa neráta 1 / 2 / 3 Absťákov — v poškodení aj pri remíze v tuhom", () => {
    expect(computeDamage([side({ sums: { Rana: 4 }, abstaky: 3, silaAbstinenta: 2 }), side()]).tuhe[0]).toBe(3);
    expect(computeDamage([side({ sums: { Rana: 4 }, abstaky: 1, silaAbstinenta: 3 }), side()]).tuhe[0]).toBe(4);
    // Remíza 2 : 2: hráč 0 má 3 Absťáky (Abstinent 3 → 0), hráč 1 má 1 → vyhrá hráč 0.
    const d = computeDamage([side({ sums: { Rana: 5 }, abstaky: 3, silaAbstinenta: 3 }), side({ sums: { Rana: 3 }, abstaky: 1 })]);
    expect(d.tuhe).toEqual([5, 2]);
    const remiza = computeDamage([side({ sums: { Rana: 2 }, abstaky: 3, silaAbstinenta: 3 }), side({ sums: { Rana: 3 }, abstaky: 1 })]);
    expect(remiza.tuhe).toEqual([2, 2]);
    expect(battleOutcome(remiza, { abstaky: [3, 1], dlhy: [0, 0] })).toMatchObject({ vitaz: 0, rozhodlo: "abstak" });
    // Abstinent do hádky nevstupuje (Pohoršenia navyše nedáva).
    expect(remiza.makke).toEqual([0, 0]);
  });
});

/** Bitka v kroku hádky (vyhral ju `vitaz` o `velkost`), prázdna línia; markery podľa priazne. */
function vHadke(o: { velkost: number; vitaz?: PlayerId; markery?: Partial<Record<Favour, MarkerPos>>; sums?: BitkaStav["sums"]; uprav?: (s: GameState) => GameState }): GameState {
  const s0 = setupGame(data, 11);
  const vitaz = o.vitaz ?? 0;
  const hadka: StavHadky = { makke: vitaz === 0 ? [o.velkost, 0] : [0, o.velkost], vitaz, velkost: o.velkost, zostava: o.velkost, prepadlo: 0, posuny: [] };
  const s: GameState = {
    ...s0,
    faza: "bitka",
    kolo: 2,
    utocnik: 1,
    strany: [[], []],
    ciel: { typ: "lokalita", lokalita: s0.lokalityVHre[0]! },
    lokalityVHre: s0.lokalityVHre.slice(1),
    starsi: s0.starsi.map((e) => ({ ...e, marker: o.markery?.[favourStarsieho(data, e)] ?? (3 as MarkerPos) })),
    bitkaStav: {
      krok: "hadka",
      caka: vitaz,
      sums: o.sums ?? [{}, {}],
      exekutorHotovy: [false, false],
      exekutor: [0, 0],
      hadka,
      damage: null,
      vitaz: null,
      prebytokDrzi: null,
      prebytokZostava: 0,
      prebytokPosunute: [],
      spalit: [],
      vesticaHotova: true,
    },
  };
  return o.uprav === undefined ? s : o.uprav(s);
}

/** Bitka bez hádky — motor ju pri vstupe do kroku vyhodnotí z línie. */
function bezHadky(b: BitkaStav): BitkaStav {
  const out = { ...b };
  delete (out as { hadka?: StavHadky }).hadka;
  return out;
}

const idPriazne = (s: GameState, f: Favour): string => s.starsi.find((e) => favourStarsieho(data, e) === f)!.elderId;

describe("§9 krok Hádka v motore", () => {
  it("Ana vyhrala hádku o 2: Fajčiar aj Robota zo stredu na jej žltú — cigareta po bitke a spálený Dlh; markery v strede", () => {
    const s = vHadke({ velkost: 2, uprav: (t) => ({ ...t, hraci: [{ ...t.hraci[0], dlhy: 1 }, t.hraci[1]] }) });
    const cig = s.hraci[0].cigarety;
    let t = apply(data, s, { type: "hadka", elderId: idPriazne(s, "FAJCIAR") }, 0).state;
    expect(t.bitkaStav?.hadka?.zostava).toBe(1);
    expect(silaPriazne(data, t, "FAJCIAR", 0)).toBe(1);
    const r = apply(data, t, { type: "hadka", elderId: idPriazne(s, "ROBOTA") }, 0);
    t = r.state;
    // Robota sily 1 v exekúcii spáli Anin jediný Dlh (pred Exekútorom).
    expect(t.hraci[0].dlhy).toBe(0);
    const rekap = r.events.find((e) => e.type === "bitkaVysledok");
    expect(rekap?.type === "bitkaVysledok" ? rekap.rekap?.hadka : undefined).toMatchObject({
      vitaz: 0,
      velkost: 2,
      starsi: [
        { elderId: idPriazne(s, "FAJCIAR"), pred: { hrac: null, sila: 0 }, po: { hrac: 0, sila: 1 }, cena: 1 },
        { elderId: idPriazne(s, "ROBOTA"), pred: { hrac: null, sila: 0 }, po: { hrac: 0, sila: 1 }, cena: 1 },
      ],
    });
    expect(t.starsi.map((e) => e.marker)).toEqual(s.starsi.map((e) => e.marker));
    expect(r.events.some((e) => e.type === "posunMarkera")).toBe(false);
    // Dohrať po koniec bitky: Fajčiar dá cigaretu (do konca kola), potom klebety zaniknú.
    for (let i = 0; i < 30 && t.bitkaStav !== null && t.koniec === null; i++) {
      const p = ([0, 1] as const).find((q) => legalCommands(data, t, q).some((c) => c.type !== "vzdat"))!;
      t = apply(data, t, legalCommands(data, t, p).find((c) => c.type !== "vzdat")!, p).state;
    }
    expect(t.hraci[0].cigarety).toBeGreaterThan(cig);
    expect(silaPriazne(data, t, "FAJCIAR", 0)).toBe(0);
    expect(t.nastenka.at(-1)?.povery?.[0]).toEqual({ [idPriazne(s, "FAJCIAR")]: 1, [idPriazne(s, "ROBOTA")]: 1 });
  });

  it("väčšia hádka o 5 — „zobrať“: Borisov Bitkár sily 2 cez stred na nič (3 + 2), v tejto bitke nebije", () => {
    const s = vHadke({ velkost: 5, markery: { BITKAR: 5 }, sums: [{ Rana: 1 }, { Rana: 1 }] });
    expect(poskodenieBitky(data, s, s.bitkaStav!.sums).tuhe).toEqual([1, 3]);
    const r = apply(data, s, { type: "hadka", elderId: idPriazne(s, "BITKAR") }, 0);
    const v = r.events.find((e) => e.type === "bitkaVysledok");
    expect(v?.type === "bitkaVysledok" ? v.damage.tuhe : null).toEqual([1, 1]);
    expect(r.state.starsi.find((e) => e.elderId === idPriazne(s, "BITKAR"))?.marker).toBe(5);
  });

  it("väčšia hádka o 5 — „získať“: Advokát na 2 (1 + 2), Veriaci a Robota na 1 — Borisov Bitkár bije ďalej", () => {
    const s = vHadke({ velkost: 5, markery: { BITKAR: 5 } });
    const t = apply(data, s, {
      type: "tah",
      kroky: [
        { type: "hadka", elderId: idPriazne(s, "ADVOKAT") },
        { type: "hadka", elderId: idPriazne(s, "VERIACI") },
        { type: "hadka", elderId: idPriazne(s, "ROBOTA") },
      ],
    }, 0);
    const v = t.events.find((e) => e.type === "bitkaVysledok");
    expect(v?.type === "bitkaVysledok" ? v.rekap?.hadka?.starsi.map((x) => [favourStarsieho(data, s.starsi.find((e) => e.elderId === x.elderId)!), x.po.sila]) : null).toEqual([
      ["ADVOKAT", 2],
      ["VERIACI", 1],
      ["ROBOTA", 1],
    ]);
    // Veriaci 1 po hádke (pred ňou 0) tlmí Borisov Bitkár: 2 − 1.
    expect(v?.type === "bitkaVysledok" ? v.damage.tuhe : null).toEqual([0, 1]);
  });

  it("súperovi priazeň dať nesmie, porazený v hádke nerozdeľuje nič; ťah s príkazom inej fázy server odmietne", () => {
    const s = vHadke({ velkost: 3 });
    expect(legalCommands(data, s, 1)).not.toContainEqual(expect.objectContaining({ type: "hadka" }));
    expect(() => apply(data, s, { type: "hadka", elderId: s.starsi[0]!.elderId }, 1)).toThrow();
    expect(() => apply(data, s, { type: "tah", kroky: [{ type: "prebytok", elderId: s.starsi[0]!.elderId }] }, 0)).toThrow();
  });

  it("strop 3 a prepadnutie: keď sú všetky priazne víťazove v sile 3, hádka celá prepadne a log to povie", () => {
    const s0 = vHadke({ velkost: 4 });
    const hasic: CardInstance = { uid: 990002, defId: "pijan", leftLayout: 0, rightLayout: 0 };
    const s: GameState = {
      ...s0,
      starsi: s0.starsi.map((e) => ({ ...e, marker: 0 as MarkerPos })),
      bitkaStav: { ...s0.bitkaStav!, caka: null },
      hraci: [{ ...s0.hraci[0], odhadzovaci: [hasic] }, s0.hraci[1]],
      hasicVolby: [{ hrac: 0, uid: hasic.uid, potom: "bitka" }],
    };
    expect(legalCommands(data, { ...s, hasicVolby: [], bitkaStav: { ...s.bitkaStav!, caka: 0 } }, 0).filter((c) => c.type === "hadka")).toEqual([]);
    // Bitka pokračuje (po Hasičovi): hádka nemá kam ísť — prepadne celá.
    const { state, events } = apply(data, s, { type: "hasic", nechat: false }, 0);
    expect(events.some((e) => e.type === "log" && e.text.includes("Hádka 4 prepadla"))).toBe(true);
    expect(events.some((e) => e.type === "bitkaVysledok" && e.rekap?.hadka?.prepadlo === 4)).toBe(true);
    expect(state.starsi.every((e) => e.marker === 0)).toBe(true);
  });

  it("remíza v hádke: nikto nerozdeľuje a bitka ide rovno na poškodenie", () => {
    const s0 = vHadke({ velkost: 1 });
    const hasic: CardInstance = { uid: 990001, defId: "pijan", leftLayout: 0, rightLayout: 0 };
    const s: GameState = {
      ...s0,
      bitkaStav: bezHadky({ ...s0.bitkaStav!, caka: null }),
      hraci: [{ ...s0.hraci[0], odhadzovaci: [hasic] }, s0.hraci[1]],
      hasicVolby: [{ hrac: 0, uid: hasic.uid, potom: "bitka" }],
    };
    const { state, events } = apply(data, s, { type: "hasic", nechat: false }, 0);
    // Prázdna línia: mäkké 0 : 0 — hádka nie je, bitka sa vyhodnotila.
    expect(events.some((e) => e.type === "bitkaVysledok")).toBe(true);
    expect(state.bitkaStav === null || state.bitkaStav.krok !== "hadka").toBe(true);
  });

  it("rozdelenie hádky je verejné — súper vidí mäkké, zvyšok aj klebety", () => {
    const s = vHadke({ velkost: 4 });
    const t = apply(data, s, { type: "hadka", elderId: s.starsi[0]!.elderId }, 0).state;
    const v1 = viewFor(data, t, 1);
    expect(v1.bitkaStav?.hadka).toEqual(t.bitkaStav?.hadka);
    expect(v1.bitkaStav?.klebety).toEqual(t.bitkaStav?.klebety);
  });

  it("rekapitulácia: Viera ukáže, čo zrušila, Pohoršenie a Povera sú mäkké", () => {
    const sums: BitkaStav["sums"] = [{ Pohoršenie: 2, Povera: 2 }, { Pohoršenie: 1, Povera: 1, Viera: 1 }];
    const s = vHadke({ velkost: 2, sums });
    const line: LineState = { lokalita: null, lokalitaOtocena: false, strany: [[], []] };
    const linia = evaluateLine(data, line);
    const damage = poskodenieBitky(data, s, sums);
    const r = rekapitulaciaBitky(data, {
      linia,
      line,
      sums,
      rozpis: [
        { zAkcii: 0, bonusy: [], zrazky: [], hodnotaViery: 1, zrusenaViera: 0, zrusenaPovera: 1, poveraIgnorovana: 0, zvysnaPovera: 1, makke: 5, silaPovery: 1, veriaciPred: 0, veriaciPo: 0, abstinent: 0 },
        { zAkcii: 0, bonusy: [], zrazky: [], hodnotaViery: 1, zrusenaViera: 1, zrusenaPovera: 0, poveraIgnorovana: 0, zvysnaPovera: 1, makke: 3, silaPovery: 1, veriaciPred: 0, veriaciPo: 0, abstinent: 0 },
      ],
      damage,
      priznaneDlhy: [0, 0],
      pohorsenia: [2, 1],
      pitkyKola: [],
      vitaz: null,
      prebytok: 0,
      prebytokDrzi: null,
    });
    expect(r.makke).toEqual([5, 3]);
    expect(r.zrusenaPovera).toEqual([1, 0]);
    expect(r.zrusenaViera).toEqual([0, 1]);
    expect(r.pohorsenie.spolu).toEqual([2, 1]);
  });
});

describe("Telefón (Dedičstvo, v10): tvoje Pohoršenia nemožno zrušiť Odporom a NA EX", () => {
  const own = (card: CardInstance, naex = false): PlacedCard => ({ card, playedBy: 0, ...(naex ? { naexBy: 1 as PlayerId } : {}) });

  it("Odpor súpera na spoji s mojím Pohoršením ho nezruší", () => {
    const syn = syntheticData([makeDef("a", [null, "Pohoršenie", null, null], EMPTY), makeDef("c", [null, null, "Odpor", null], EMPTY)]);
    const a = instanceFor(syn, "a", [null, "Pohoršenie", null, null], EMPTY);
    const c = instanceFor(syn, "c", [null, null, "Odpor", null], EMPTY);
    const strany = [[own(a), { card: c, playedBy: 1 as PlayerId }], []] as const;
    expect(evaluateLine(syn, { lokalita: null, lokalitaOtocena: false, strany, nastroje: [[], []] }).sums).toEqual([{}, {}]);
    expect(evaluateLine(syn, { lokalita: null, lokalitaOtocena: false, strany, nastroje: [["telefon"], []] }).sums).toEqual([{ Pohoršenie: 1 }, {}]);
  });

  it("NA EX moje aktívne Pohoršenia nezruší (ostatné áno)", () => {
    const par = (nastroje: readonly string[]) => {
      const syn = syntheticData([makeDef("a", ["Pohoršenie", "Rana", null, null], EMPTY), makeDef("b", EMPTY, ["Pohoršenie", "Rana", null, null])]);
      const a = instanceFor(syn, "a", ["Pohoršenie", "Rana", null, null], EMPTY);
      const b = instanceFor(syn, "b", EMPTY, ["Pohoršenie", "Rana", null, null]);
      return evaluateLine(syn, { lokalita: null, lokalitaOtocena: false, strany: [[own(a, true), own(b)], []], nastroje: [nastroje, []] }).sums[0];
    };
    expect(par([])).toEqual({ Pohoršenie: 1, Rana: 1 });
    expect(par(["telefon"])).toEqual({ Pohoršenie: 2, Rana: 1 });
  });
});

describe("Šarlatán (Konflikt) ďalej: súperove Povery sa z mäkkého presunú do tuhého", () => {
  it("Povera ako Rana — mäkké neprinesie, tuhé áno", () => {
    const syn = syntheticData([makeDef("a", [null, "Povera", null, null], EMPTY), makeDef("b", EMPTY, [null, "Rana", null, null])]);
    const a = instanceFor(syn, "a", [null, "Povera", null, null], EMPTY);
    const b = instanceFor(syn, "b", EMPTY, [null, "Rana", null, null]);
    const l = (premena: boolean): LineState => ({
      lokalita: null,
      lokalitaOtocena: false,
      strany: [[{ card: a, playedBy: 0, ...(premena ? { premena: "sarlatan" as const } : {}) }, { card: b, playedBy: 0 }], []],
    });
    expect(evaluateLine(syn, l(false)).sums[0]).toEqual({ Povera: 1, Rana: 1 });
    expect(evaluateLine(syn, l(true)).sums[0]).toEqual({ Rana: 2 });
  });
});

// Schopnosť väzňa (pravidlá v11.2, Michal 2026-11-02, PRAVIDLA §10): Kšeft väzňa zanikol —
// držiteľ smie schopnosť zajatého staršieho použiť raz za hru vo svojom ťahu (branie zo
// šenku, Zhromaždenie, Pitka), keď má účinok. Väzeň ostáva v pivnici.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { CardInstance, Command, GameState, LineState, PlayerId } from "../src/index.ts";
import {
  KONSTANTY,
  NOVE_MOMENTY,
  apply,
  evaluateLine,
  legalCommands,
  loadGameData,
  momenty,
  naladaMomentu,
  obmedzMomenty,
  ponukaSchopnostiVazna,
  schopnostiVazna,
  stavSchopnostiVaznaZPohladu,
  tahBota,
  viewFor,
} from "../src/index.ts";
import { EMPTY, instanceFor, makeDef, setupSBalickom, syntheticData } from "./helpers.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

const PITKA = { naTahu: 1 as PlayerId, hotovy: [false, false] as const, naexPouzity: [false, false] as const, fajcenie: [0, 0] as const, reakcia: null, postarka: [false, false] as const, starosta: [false, false] as const, naexPocet: [0, 0] as const, vykup: [false, false] as const };

/** Hráč `p` drží väzňa `elderId`; stav v Pitke (predvolene), Zhromaždení alebo pri braní zo šenku. */
function sVaznom(elderId: string, faza: "pitka" | "zhromazdenie" | "draft" = "pitka", p: PlayerId = 0, upravy: (s: GameState) => GameState = (s) => s): GameState {
  const s0 = setupSBalickom(data, 6);
  const elder = s0.starsi.find((e) => e.elderId === elderId)!;
  const lok = s0.lokalityVHre.find((k) => k.defId !== "krcma" && k.defId !== "kostol")!;
  const s: GameState = {
    ...s0,
    faza,
    starsi: s0.starsi.filter((e) => e.elderId !== elderId),
    vazni: [{ elderId, hrac: p, poradie: 1, karta: elder.karta, scorecard: elder.scorecard, miesto: 0 }],
    ciel: { typ: "lokalita", lokalita: lok },
    pitkaCislo: 1,
    pitkyCelkom: 2,
    senok: s0.naradie.slice(0, 4),
    pitkaStav: faza === "pitka" ? PITKA : null,
    zhromazdenieStav: faza === "zhromazdenie" ? { naTahu: p, zostavaLimit: [2, 2], pasoval: [false, false], navyse: [0, 0] } : null,
    draftStav: faza === "draft" ? { krok: "beranie", balicky: [[], []], vyber: [null, null], naTahu: p, hotovo: [false, false], noveKarty: [0, 0] } : null,
    zaciatokPitky: { pecen: [0, 0], cirhozy: [0, 0] },
  };
  return upravy(s);
}

const ponuka = (s: GameState, p: PlayerId = 0): Command[] => schopnostiVazna(s, p);
const hracSo = (s: GameState, p: PlayerId, zmena: Partial<GameState["hraci"][0]>): GameState => ({
  ...s,
  hraci: (p === 0 ? [{ ...s.hraci[0], ...zmena }, s.hraci[1]] : [s.hraci[0], { ...s.hraci[1], ...zmena }]) as unknown as GameState["hraci"],
});
const cirhoza = (uid: number): CardInstance => ({ uid, defId: "cirhoza", leftLayout: 0, rightLayout: 0 });

/** Karta hráča 0 v jeho partii, na ktorej leží súperovo NA EX (poldeci hráča 1). */
function sNaexSupera(s: GameState): GameState {
  const karta = s.hraci[0].ruka.find((k) => !data.elders.has(k.defId))!;
  return { ...hracSo(s, 0, { ruka: s.hraci[0].ruka.filter((k) => k.uid !== karta.uid) }), strany: [[{ card: karta, playedBy: 0, naexBy: 1 }], []] };
}

describe("§10 Schopnosť väzňa — kto a kedy", () => {
  it("len držiteľ, raz za hru; po použití je minutá, väzeň ostáva v pivnici", () => {
    const s = sVaznom("postarka");
    expect(ponuka(s, 1)).toEqual([]);
    const cmd = ponuka(s)[0]!;
    expect(cmd).toEqual({ type: "schopnostVazna", elderId: "postarka" });
    expect(legalCommands(data, s, 0)).toContainEqual(cmd);
    const po = apply(data, s, cmd, 0).state;
    expect(po.vazni).toHaveLength(1);
    expect(po.vazni[0]).toMatchObject({ elderId: "postarka", hrac: 0, pouzita: true });
    expect(ponuka(po)).toEqual([]);
    expect(() => apply(data, po, cmd, 0)).toThrow(/už použil/);
    // Ostáva červenou držiteľa (ráta sa ako vydesený).
    expect(viewFor(data, po, 0).vyhry.cervene[0]).toBe(viewFor(data, s, 0).vyhry.cervene[0]);
  });

  it("vo vlastnom ťahu — v Zhromaždení na ťahu, v Pitke kým ju neskončil, pri braní zo šenku; inak nie", () => {
    expect(ponuka(sVaznom("postarka", "zhromazdenie"))).toHaveLength(1);
    expect(ponuka(sVaznom("postarka", "zhromazdenie", 0, (s) => ({ ...s, zhromazdenieStav: { ...s.zhromazdenieStav!, naTahu: 1 } })))).toEqual([]);
    expect(ponuka(sVaznom("postarka", "zhromazdenie", 0, (s) => ({ ...s, zhromazdenieStav: { ...s.zhromazdenieStav!, pasoval: [true, false], naTahu: 1 } })))).toEqual([]);
    expect(ponuka(sVaznom("postarka", "pitka", 0, (s) => ({ ...s, pitkaStav: { ...PITKA, hotovy: [true, false] } })))).toEqual([]);
    expect(ponuka(sVaznom("postarka", "pitka", 0, (s) => ({ ...s, pitkaStav: { ...PITKA, reakcia: 0 } })))).toEqual([]);
    expect(ponuka(sVaznom("postarka", "draft"))).toHaveLength(1);
    expect(ponuka(sVaznom("postarka", "draft", 0, (s) => ({ ...s, draftStav: { ...s.draftStav!, naTahu: 1 } })))).toEqual([]);
    expect(ponuka(sVaznom("postarka", "draft", 0, (s) => ({ ...s, draftStav: { ...s.draftStav!, krok: "zajatie" } })))).toEqual([]);
    expect(ponuka(sVaznom("postarka", "pitka", 0, (s) => ({ ...s, faza: "bitka", pitkaStav: null })))).toEqual([]);
    expect(() => apply(data, sVaznom("postarka", "zhromazdenie", 0, (s) => ({ ...s, zhromazdenieStav: { ...s.zhromazdenieStav!, naTahu: 1 } })), { type: "schopnostVazna", elderId: "postarka" }, 0)).toThrow();
  });

  it("aj vo finále", () => {
    const s = sVaznom("krcmarka", "pitka", 0, (st) => ({ ...st, ciel: { typ: "finale", lokalita: st.ciel!.lokalita } }) as GameState);
    expect(ponuka(s)).toEqual([{ type: "schopnostVazna", elderId: "krcmarka" }]);
  });

  it("nevyhnutný ťah nezdrží — legalCommands ju dáva na koniec", () => {
    const s = sVaznom("postarka", "zhromazdenie");
    expect(legalCommands(data, s, 0).at(-1)).toEqual({ type: "schopnostVazna", elderId: "postarka" });
  });
});

describe("§10 Osem schopností", () => {
  it(`Poštárka: ${KONSTANTY.POSTARKA_CIGARETY} cigarety`, () => {
    const s = sVaznom("postarka");
    const po = apply(data, s, { type: "schopnostVazna", elderId: "postarka" }, 0).state;
    expect(po.hraci[0].cigarety).toBe(s.hraci[0].cigarety + 4);
  });

  it("Krčmárka: nový plný poldeci natrvalo (aj v Zhromaždení)", () => {
    const s = sVaznom("krcmarka", "zhromazdenie");
    const po = apply(data, s, { type: "schopnostVazna", elderId: "krcmarka" }, 0).state;
    expect(po.hraci[0].poldeciPlne).toBe(s.hraci[0].poldeciPlne + 1);
    expect(po.hraci[0].poldeciVypite).toBe(s.hraci[0].poldeciVypite);
    // Ťah ostáva hráčovi — schopnosť nie je ťah.
    expect(po.zhromazdenieStav?.naTahu).toBe(0);
  });

  it("Farár: odstráni súperovo NA EX z karty, poldeci súpera ostáva vypitý; bez NA EX sa neponúkne", () => {
    expect(ponuka(sVaznom("farar"))).toEqual([]);
    const s = sNaexSupera(sVaznom("farar"));
    const uid = s.strany[0][0]!.card.uid;
    expect(ponuka(s)).toEqual([{ type: "schopnostVazna", elderId: "farar", uid }]);
    const po = apply(data, s, { type: "schopnostVazna", elderId: "farar", uid }, 0).state;
    expect(po.strany[0][0]!.naexBy).toBeUndefined();
    expect(po.hraci[1].poldeciVypite).toBe(s.hraci[1].poldeciVypite + 1);
    expect(po.hraci[1].poldeciPlne).toBe(s.hraci[1].poldeciPlne);
    expect(po.hraci[1].nerestiTotoKolo).toBe(s.hraci[1].nerestiTotoKolo + KONSTANTY.NEREST_NAEX);
    // Vlastné NA EX Farár neodstráni.
    const vlastne: GameState = { ...s, strany: [[{ ...s.strany[0][0]!, naexBy: 0 }], []] };
    expect(ponuka(vlastne)).toEqual([]);
  });

  it("Farár pri zrážke (Výtržník): ostane moje NA EX a karta prestane byť Výtržníkom", () => {
    const s0 = sNaexSupera(sVaznom("farar"));
    const s: GameState = { ...s0, strany: [[{ ...s0.strany[0][0]!, naexBy: 0, naexBy2: 1, vytrznik: true }], []] };
    const uid = s.strany[0][0]!.card.uid;
    const pl = apply(data, s, { type: "schopnostVazna", elderId: "farar", uid }, 0).state.strany[0][0]!;
    expect([pl.naexBy, pl.naexBy2, pl.vytrznik]).toEqual([0, undefined, undefined]);
  });

  it("Starosta: v tejto bitke akcie hrán lokality posilnené; druhýkrát v kole nie, bez lokality nie", () => {
    const s = sVaznom("starosta");
    const po = apply(data, s, { type: "schopnostVazna", elderId: "starosta" }, 0).state;
    expect(po.kseftyKola?.hranyPosilnene).toBe(true);
    expect(ponuka({ ...po, vazni: po.vazni.map((v) => ({ ...v, pouzita: undefined }) as unknown as typeof v) })).toEqual([]);
    expect(ponuka(sVaznom("starosta", "pitka", 0, (st) => ({ ...st, ciel: null })))).toEqual([]);
  });

  it("Starosta v línii: ×2 len akcie bitky na hranách lokality, akcie Pitky (Cigareta) nie", () => {
    const lok = makeDef("lok", [null, "Cigareta", "Pecka", null], [null, null, null, null], { tags: ["Lokalita"] });
    const a = makeDef("a", EMPTY, [null, "Rana", "Rana", null]);
    const syn = syntheticData([lok, a]);
    const line: LineState = {
      lokalita: instanceFor(syn, "lok", [null, "Cigareta", "Pecka", null], [null, null, null, null]),
      lokalitaOtocena: false,
      strany: [[{ card: instanceFor(syn, "a", EMPTY, [null, "Rana", "Rana", null]), playedBy: 0 }], []],
    };
    const bez = evaluateLine(syn, line).sums[0];
    const s = evaluateLine(syn, { ...line, hranyPosilnene: true }).sums[0];
    expect(bez.Pecka).toBe(1);
    expect(s.Pecka).toBe(2);
    expect(s.Cigareta).toBe(bez.Cigareta);
    expect(s.Rana).toBe(bez.Rana);
  });

  it("Veterinár: odhodí všetky priznané Cirhózy a Cirhózy na ruke (nie z balíčkov); bez nich sa neponúkne", () => {
    expect(ponuka(sVaznom("veterinar"))).toEqual([]);
    const s = sVaznom("veterinar", "pitka", 0, (st) =>
      hracSo(st, 0, { ruka: [...st.hraci[0].ruka, cirhoza(99001)], priznane: [cirhoza(99002), cirhoza(99004)], odhadzovaci: [cirhoza(99003)] }),
    );
    const po = apply(data, s, { type: "schopnostVazna", elderId: "veterinar" }, 0).state;
    expect(po.hraci[0].ruka.some((k) => k.defId === "cirhoza")).toBe(false);
    expect(po.hraci[0].priznane.some((k) => k.defId === "cirhoza")).toBe(false);
    expect(po.hraci[0].odhadzovaci.map((k) => k.uid).sort()).toEqual([99001, 99002, 99003, 99004]);
  });

  it("Vychovávateľka: v Zhromaždení súper hneď pasuje bez cigariet, ja vykladám ďalej; mimo Zhromaždenia nie", () => {
    expect(ponuka(sVaznom("vychovavatelka"))).toEqual([]);
    const s = sVaznom("vychovavatelka", "zhromazdenie");
    const po = apply(data, s, { type: "schopnostVazna", elderId: "vychovavatelka" }, 0).state;
    expect(po.zhromazdenieStav?.pasoval).toEqual([false, true]);
    expect(po.hraci[1].cigarety).toBe(s.hraci[1].cigarety);
    expect(po.zhromazdenieStav?.naTahu).toBe(0);
    expect(legalCommands(data, po, 0).some((c) => c.type === "place")).toBe(true);
    // Keď súper už pasoval, nemá účinok.
    expect(ponuka(sVaznom("vychovavatelka", "zhromazdenie", 0, (st) => ({ ...st, zhromazdenieStav: { ...st.zhromazdenieStav!, pasoval: [false, true] } })))).toEqual([]);
  });

  it("Autobusár: pri braní zo šenku koľko chcem, každá za cigaretu; potom s braním končím a berie súper", () => {
    expect(ponuka(sVaznom("autobusar"))).toEqual([]);
    const s = sVaznom("autobusar", "draft", 0, (st) => hracSo(st, 0, { cigarety: 5 }));
    expect(ponuka(s)).toHaveLength(s.senok.length);
    const uids = s.senok.slice(0, 3).map((k) => k.uid);
    const po = apply(data, s, { type: "schopnostVazna", elderId: "autobusar", uids }, 0).state;
    expect(po.hraci[0].cigarety).toBe(2);
    expect(uids.every((u) => po.hraci[0].ruka.some((k) => k.uid === u))).toBe(true);
    expect(po.senok).toHaveLength(s.senok.length - 3);
    expect(po.draftStav?.hotovo).toEqual([true, false]);
    expect(po.draftStav?.naTahu).toBe(1);
    expect(po.draftStav?.zobrate).toHaveLength(3);
    // Na viac kariet než cigariet nie; bez cigarety sa neponúkne.
    expect(() => apply(data, hracSo(s, 0, { cigarety: 2 }), { type: "schopnostVazna", elderId: "autobusar", uids }, 0)).toThrow();
    expect(ponuka(hracSo(s, 0, { cigarety: 0 }))).toEqual([]);
  });

  it("Hrobár: 1 karta zo súperovho odhadzovacieho balíčka do ruky; pri prázdnom sa neponúkne", () => {
    expect(ponuka(sVaznom("hrobar", "pitka", 0, (st) => hracSo(st, 1, { odhadzovaci: [] })))).toEqual([]);
    const karta = { uid: 99100, defId: "pijan", leftLayout: 0, rightLayout: 0 };
    const s = sVaznom("hrobar", "pitka", 0, (st) => hracSo(st, 1, { odhadzovaci: [karta] }));
    expect(ponuka(s)).toEqual([{ type: "schopnostVazna", elderId: "hrobar", uid: 99100 }]);
    const po = apply(data, s, { type: "schopnostVazna", elderId: "hrobar", uid: 99100 }, 0).state;
    expect(po.hraci[0].ruka.some((k) => k.uid === 99100)).toBe(true);
    expect(po.hraci[1].odhadzovaci).toEqual([]);
  });
});

describe("§10 Schopnosť väzňa — pohľad, pečiatka, bot", () => {
  it("viewFor: značka použitá je verejná a ponuka z pohľadu sedí so serverom", () => {
    const s = sVaznom("postarka", "zhromazdenie");
    const v = viewFor(data, s, 0);
    expect(ponukaSchopnostiVazna(stavSchopnostiVaznaZPohladu(v), 0)).toEqual(ponuka(s));
    const po = apply(data, s, { type: "schopnostVazna", elderId: "postarka" }, 0).state;
    expect(viewFor(data, po, 1).vazni[0]?.pouzita).toBe(true);
    expect(ponukaSchopnostiVazna(stavSchopnostiVaznaZPohladu(viewFor(data, po, 0)), 0)).toEqual([]);
  });

  it("pečiatka padne pri každom použití, obom, mimo stropu úseku", () => {
    const s = sVaznom("farar");
    const s1 = sNaexSupera(s);
    const uid = s1.strany[0][0]!.card.uid;
    const r = apply(data, s1, { type: "schopnostVazna", elderId: "farar", uid }, 0);
    const kandidati = momenty(data, s1, r.state, r.events);
    const m = kandidati.find((x) => x.typ === "schopnostVazna")!;
    expect(m).toMatchObject({ hrac: 0, elderId: "farar", nazov: "FARÁR · zrušil NA EX" });
    expect(naladaMomentu(m, 0)).toBe("pohoda");
    expect(naladaMomentu(m, 1)).toBe("smola");
    const plny = { ...NOVE_MOMENTY, usek: `${r.state.kolo}:p${r.state.pitkaCislo}` };
    expect(obmedzMomenty(kandidati, plny, r.state).vybrane).toContainEqual(m);
  });

  it("bot: Krčmárku použije hneď, Poštárku s plnými vreckami šetrí; nespadne", () => {
    const k = sVaznom("krcmarka", "pitka", 0, (st) => ({ ...st, pitkaStav: { ...PITKA, naTahu: 0 } }));
    expect(tahBota(data, k, 0, 1)).toEqual({ type: "schopnostVazna", elderId: "krcmarka" });
    const p = sVaznom("postarka", "pitka", 0, (st) => hracSo({ ...st, pitkaStav: { ...PITKA, naTahu: 0 } }, 0, { cigarety: 8 }));
    expect(tahBota(data, p, 0, 1).type).not.toBe("schopnostVazna");
  });
});

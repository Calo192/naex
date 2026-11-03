// Pravidlá v10.3 (Michal 2026-11-02): Forsáž (Posilnenie + Posilnenie), Nástroj bez Vzbury
// a Forsáže, Sypač (Kulturista) ako Výtržník s Peckami, nová Veľmi smútiaca vdova a Liberál.
// Karty sú syntetické — akcie Kulturistu, Liberála a Vdovy v sade mení admin.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { CardInstance, GameData, GameState, LineState, PlacedCard, PlayerId, Tag } from "../src/index.ts";
import { KONSTANTY, MOMENTY, apply, buildGameData, evaluateLine, loadGameData, momenty, naladaMomentu, parseScorecards, setupGame } from "../src/index.ts";
import type { Layout4 } from "./helpers.ts";
import { EMPTY, instanceFor, makeDef, syntheticData } from "./helpers.ts";

const own = (card: CardInstance, x: Partial<PlacedCard> = {}): PlacedCard => ({ card, playedBy: 0, ...x });
/** Partia hráča 0 bez lokality: [A, B, C] sa vyhodnotí ako línia C · B · A (C.pravá ↔ B.ľavá, B.pravá ↔ A.ľavá). */
const lineP0 = (...cards: PlacedCard[]): LineState => ({ lokalita: null, lokalitaOtocena: false, strany: [cards, []] });

describe("Forsáž (v10.3)", () => {
  // C · B · A: B–A Posilnenie + Posilnenie (index 0) = Forsáž B aj A; C–B Rana proti Pecke (index 1),
  // B–A Cigareta proti Viere (index 2) a Robota proti Hazardu (index 3).
  const A_L: Layout4 = ["Posilnenie", null, "Viera", "Dlh"];
  const B_R: Layout4 = ["Posilnenie", null, "Cigareta", "Robota"];
  const B_L: Layout4 = [null, "Rana", null, null];
  const C_R: Layout4 = [null, "Pecka", null, null];
  const C_R_POSIL: Layout4 = [null, "Posilnenie", null, null];
  const zostav = (cR: Layout4, bTags: readonly Tag[] = ["Občan"]) => {
    const data = syntheticData([makeDef("a", A_L, EMPTY), makeDef("b", B_L, B_R, { tags: bTags }), makeDef("c", EMPTY, cR)]);
    return {
      data,
      a: instanceFor(data, "a", A_L, EMPTY),
      b: instanceFor(data, "b", B_L, B_R),
      c: instanceFor(data, "c", EMPTY, cR),
    };
  };

  it("obe karty spoja majú všetky aktívne akcie ×2 — aj Hazard; tretia karta nie", () => {
    const { data, a, b, c } = zostav(C_R);
    const ev = evaluateLine(data, lineP0(own(a), own(b), own(c)));
    expect(ev.sums[0]).toEqual({ Rana: 2, Pecka: 1, Viera: 2, Cigareta: 2, Dlh: 2, Robota: 2 });
    expect(ev.cards.get(a.uid)?.forsaz).toBe(true);
    expect(ev.cards.get(b.uid)?.forsaz).toBe(true);
    expect(ev.cards.get(c.uid)?.forsaz).toBe(false);
    expect(ev.zdroje[0].Rana?.[0]?.dovody).toEqual(["Forsáž"]);
  });

  it("akcia posilnená ešte Posilnením suseda má ×4", () => {
    const { data, a, b, c } = zostav(C_R_POSIL);
    const ev = evaluateLine(data, lineP0(own(a), own(b), own(c)));
    expect(ev.sums[0].Rana).toBe(4);
    expect(ev.zdroje[0].Rana?.[0]?.dovody).toEqual(["Posilnenie", "Forsáž"]);
  });

  it("NA EX na kartu Forsáže zruší jej Posilnenie, a tým Forsáž; NA EX na suseda zruší len jeho ×2", () => {
    const { data, a, b, c } = zostav(C_R_POSIL);
    const naA = evaluateLine(data, lineP0(own(a, { naexBy: 0 }), own(b), own(c)));
    expect(naA.cards.get(b.uid)?.forsaz).toBe(false);
    // B: Rana už len z Posilnenia C, Cigareta a Robota ×1; A má aktívne akcie zrušené.
    expect(naA.sums[0]).toMatchObject({ Rana: 2, Cigareta: 1, Robota: 1 });
    expect(naA.sums[0].Viera).toBeUndefined();
    const naC = evaluateLine(data, lineP0(own(a), own(b), own(c, { naexBy: 0 })));
    expect(naC.sums[0].Rana).toBe(2);
    expect(naC.cards.get(b.uid)?.forsaz).toBe(true);
  });

  it("Energeťák: NA EX tvoje Posilnenie nezruší, Forsáž ostáva", () => {
    const { data, a, b, c } = zostav(C_R_POSIL);
    const ev = evaluateLine(data, { ...lineP0(own(a, { naexBy: 1 }), own(b), own(c)), nastroje: [["energetak"], []] });
    expect(ev.cards.get(b.uid)?.forsaz).toBe(true);
    expect(ev.sums[0]).toMatchObject({ Rana: 4, Cigareta: 2, Robota: 2 });
  });

  it("Nástroj Forsáž nedostane — pri spoji Nástroj–Občan ju má len Občan", () => {
    const { data, a, b, c } = zostav(C_R, ["Nástroj"]);
    const ev = evaluateLine(data, lineP0(own(a), own(b), own(c)));
    expect(ev.cards.get(b.uid)?.forsaz).toBe(false);
    expect(ev.cards.get(a.uid)?.forsaz).toBe(true);
    // Rana a Cigareta sú Nástroja ×1, Viera a Hazard Občana ×2.
    expect(ev.sums[0]).toMatchObject({ Rana: 1, Cigareta: 1, Robota: 1, Viera: 2, Dlh: 2 });
  });

  it("Odpor Praudovravca sa ráta ako Posilnenie — s Posilnením aj s Odporom vytvorí Forsáž", () => {
    const P_L: Layout4 = ["Odpor", "Rana", null, null];
    for (const druhy of ["Posilnenie", "Odpor"] as const) {
      const x_R: Layout4 = [druhy, "Pecka", null, null];
      const data = syntheticData([makeDef("praudovravec", P_L, EMPTY), makeDef("x", EMPTY, x_R)]);
      const p = instanceFor(data, "praudovravec", P_L, EMPTY);
      const x = instanceFor(data, "x", EMPTY, x_R);
      const ev = evaluateLine(data, lineP0(own(p), own(x)));
      expect(ev.cards.get(p.uid)?.forsaz, druhy).toBe(true);
      expect(ev.sums[0], druhy).toEqual({ Rana: 2, Pecka: 2 });
    }
  });

  it("Pakt proti Posilneniu sa stane Posilnením — Forsáž", () => {
    const X_L: Layout4 = ["Pakt", "Rana", null, null];
    const Y_R: Layout4 = ["Posilnenie", "Pecka", null, null];
    const data = syntheticData([makeDef("x", X_L, EMPTY), makeDef("y", EMPTY, Y_R)]);
    const ev = evaluateLine(data, lineP0(own(instanceFor(data, "x", X_L, EMPTY)), own(instanceFor(data, "y", EMPTY, Y_R))));
    expect(ev.sums[0]).toEqual({ Rana: 2, Pecka: 2 });
  });

  it("akcie aktivované Vzburou Forsáž tiež zdvojí", () => {
    // C · B · A: C–B Odpor + Odpor (Vzbura B aj C), B–A Posilnenie + Posilnenie. Pecka B nemá partnera.
    const bL: Layout4 = ["Odpor", null, "Pecka", null];
    const bR: Layout4 = ["Posilnenie", null, null, null];
    const aL: Layout4 = ["Posilnenie", null, null, null];
    const cR: Layout4 = ["Odpor", null, null, null];
    const data = syntheticData([makeDef("a", aL, EMPTY), makeDef("b", bL, bR), makeDef("c", EMPTY, cR)]);
    const b = instanceFor(data, "b", bL, bR);
    const ev = evaluateLine(data, lineP0(own(instanceFor(data, "a", aL, EMPTY)), own(b), own(instanceFor(data, "c", EMPTY, cR))));
    expect(ev.sums[0]).toEqual({ Pecka: 2 });
    expect(ev.zdroje[0].Pecka?.[0]?.dovody).toEqual(["Vzbura", "Forsáž"]);
  });

  it("lokalita má Forsáž len na hrane pri tom kraji", () => {
    // Lokalita: ľavá hrana (hráč 0) Posilnenie + Rana, pravá hrana (hráč 1) Viera.
    const lokL: Layout4 = ["Posilnenie", "Rana", null, null];
    const lokR: Layout4 = [null, "Viera", null, null];
    const aR: Layout4 = ["Posilnenie", "Pecka", null, null];
    // Karta hráča 1 je otočená: jej efektívna ľavá je vytlačená pravá odzadu.
    const dR: Layout4 = [null, null, "Pecka", null];
    const data = syntheticData([makeDef("lok", lokL, lokR, { tags: ["Lokalita" as Tag] }), makeDef("a", EMPTY, aR), makeDef("d", EMPTY, dR)]);
    const lok = instanceFor(data, "lok", lokL, lokR);
    const ev = evaluateLine(data, {
      lokalita: lok,
      lokalitaOtocena: false,
      strany: [[own(instanceFor(data, "a", EMPTY, aR))], [{ card: instanceFor(data, "d", EMPTY, dR), playedBy: 1 }]],
    });
    expect(ev.sums[0]).toEqual({ Rana: 2, Pecka: 2 });
    expect(ev.sums[1]).toEqual({ Viera: 1, Pecka: 1 });
  });

  it("moment FORSÁŽ! — bronz, Údiv pre oboch", () => {
    expect(MOMENTY.forsaz).toEqual({ stupen: "bronz", nazov: "FORSÁŽ!" });
    const m = { typ: "forsaz" as const, ...MOMENTY.forsaz, hrac: null, popis: "" };
    expect(naladaMomentu(m, 0)).toBe("udiv");
    expect(naladaMomentu(m, 1)).toBe("udiv");
  });
});

describe("Vzbura s Nástrojom (v10.3)", () => {
  it("Odpor Nástroja proti Odporu Občana: Vzburu dostane len Občan", () => {
    // B (Nástroj) · A (Občan) — B.pravá Odpor ↔ A.ľavá Odpor. C podporuje Nástroj zľava.
    const aL: Layout4 = ["Odpor", null, null, null];
    const aR: Layout4 = [null, null, null, "Pecka"];
    const bL: Layout4 = [null, null, null, "Rana"];
    const bR: Layout4 = ["Odpor", null, null, null];
    const cR: Layout4 = ["Viera", null, null, null];
    const data = syntheticData([makeDef("a", aL, aR), makeDef("b", bL, bR, { tags: ["Nástroj"] }), makeDef("c", EMPTY, cR)]);
    const a = instanceFor(data, "a", aL, aR);
    const b = instanceFor(data, "b", bL, bR);
    const ev = evaluateLine(data, lineP0(own(a), own(b), own(instanceFor(data, "c", EMPTY, cR))));
    expect(ev.cards.get(a.uid)?.vzbura).toBe(true);
    expect(ev.cards.get(b.uid)?.vzbura).toBe(false);
    expect(ev.sums[0]).toEqual({ Pecka: 1 });
  });
});

describe("Sypač (Kulturista, v10.3)", () => {
  it("ako Výtržník má všetky akcie aktívne Pecky, nie Rany; iný Výtržník Rany", () => {
    const L: Layout4 = ["Posilnenie", "Petelica", null, "Dlh"];
    const R: Layout4 = [null, "Odpor", "Viera", null];
    const data = syntheticData([makeDef("kulturista", L, R), makeDef("iny", L, R)]);
    for (const [id, akcia] of [["kulturista", "Pecka"], ["iny", "Rana"]] as const) {
      const ev = evaluateLine(data, lineP0(own(instanceFor(data, id, L, R), { naexBy: 0, naexBy2: 1, vytrznik: true })));
      expect(ev.sums[0], id).toEqual({ [akcia]: 5 });
    }
  });
});

describe("Liberál (Furt, v10.3)", () => {
  const LIB_L: Layout4 = ["Rana", null, null, null];
  const X_R: Layout4 = ["Pecka", null, null, null];
  const data = syntheticData([
    makeDef("liberal", LIB_L, EMPTY, { tags: ["Občan", "Žena", "Chlap"] }),
    makeDef("x", EMPTY, X_R),
    makeDef("zena", EMPTY, EMPTY, { tags: ["Občan", "Žena"] }),
    makeDef("chlap", EMPTY, EMPTY, { tags: ["Občan", "Chlap"] }),
  ]);
  const lib = instanceFor(data, "liberal", LIB_L, EMPTY);
  const x = instanceFor(data, "x", EMPTY, X_R);
  const zena = (): CardInstance => instanceFor(data, "zena", EMPTY, EMPTY);
  const chlap = (): CardInstance => instanceFor(data, "chlap", EMPTY, EMPTY);
  /** Liberál a jeho partner X v partii hráča 0, ďalšie karty na súperovej strane. */
  const rana = (dalsie: PlacedCard[]): number | undefined =>
    evaluateLine(data, { lokalita: null, lokalitaOtocena: false, strany: [[own(lib), own(x)], dalsie] }).zdroje[0].Rana?.[0]?.hodnota;

  it("rovnako žien a chlapov (on sa ráta za oboch) — jeho aktívne akcie ×2, partnerove nie", () => {
    expect(rana([])).toBe(2);
    expect(rana([own(zena()), own(chlap())])).toBe(2);
    expect(evaluateLine(data, lineP0(own(lib), own(x))).sums[0].Pecka).toBe(1);
  });

  it("nerovnosť — ×1; súperove karty a skrytá Záverečná sa nerátajú", () => {
    expect(rana([own(zena())])).toBe(1);
    expect(rana([own(zena()), own(zena()), own(chlap())])).toBe(1);
    expect(rana([{ card: zena(), playedBy: 1 }])).toBe(2);
    expect(rana([own(zena()), own(chlap(), { zaverecna: true })])).toBe(1);
  });
});

describe("Veľmi smútiaca vdova (Konflikt, v11.3) a moment Forsáže v hre", () => {
  const zaklad = loadGameData(cardsJson, eldersJson, scorecardsJson);
  const defs = [
    makeDef("velmi_smutiaca_vdova", EMPTY, EMPTY, { tags: ["Občan", "Žena"], triggers: ["Konflikt"] }),
    makeDef("v_chlap", EMPTY, EMPTY, { tags: ["Občan", "Chlap"] }),
    makeDef("v_zena", EMPTY, EMPTY, { tags: ["Občan", "Žena"] }),
    makeDef("v_karta", EMPTY, EMPTY),
    makeDef("f_x", ["Posilnenie", "Rana", null, null], EMPTY),
    makeDef("f_y", EMPTY, ["Posilnenie", "Pecka", null, null]),
  ];
  const data: GameData = buildGameData(new Map([...zaklad.cards, ...defs.map((d) => [d.id, d] as const)]), zaklad.elders, {
    scorecards: zaklad.scorecards,
    body: parseScorecards(scorecardsJson).body,
  });
  const karta = (id: string): CardInstance => instanceFor(data, id, EMPTY, EMPTY);
  const lezi = (card: CardInstance, playedBy: PlayerId): PlacedCard => ({ card, playedBy });
  const balik = (n: number): CardInstance[] => Array.from({ length: n }, () => karta("v_karta"));

  /** Zhromaždenie, hráč 0 na ťahu s `ruka`; Vdova hráča 1 leží na jeho strane. */
  function zhromazdenie(strana0: PlacedCard[], ruka: CardInstance[], doberaci: CardInstance[], odhadzovaci: CardInstance[] = []): GameState {
    const s0 = setupGame(data, 7);
    const lokalita = s0.lokalityVHre.find((k) => k.defId === "zastavka")!;
    const hraci = [{ ...s0.hraci[0], ruka, doberaci, odhadzovaci }, s0.hraci[1]] as unknown as GameState["hraci"];
    return {
      ...s0,
      hraci,
      faza: "zhromazdenie",
      utocnik: 0,
      ciel: { typ: "lokalita", lokalita },
      lokalityVHre: s0.lokalityVHre.filter((k) => k !== lokalita),
      strany: [strana0, []],
      pitkyCelkom: 1,
      pitkaCislo: 0,
      pitkaStav: null,
      zhromazdenieStav: { naTahu: 0, zostavaLimit: [3, 3], pasoval: [false, false], navyse: [0, 0] },
    };
  }
  const priloz = (s: GameState, uid: number): GameState => apply(data, s, { type: "place", uid, target: "vlastna" }, 0).state;
  const odhodene = (pred: GameState, po: GameState): number => po.hraci[0].odhadzovaci.length - pred.hraci[0].odhadzovaci.length;

  it("0 Chlapov pri nej — nič; 1 Chlap — súper odhodí 1 kartu z vrchu doberacieho balíčka (v11.3)", () => {
    const vdova = lezi(karta("velmi_smutiaca_vdova"), 1);
    const zena = karta("v_zena");
    const s = zhromazdenie([vdova], [zena], balik(5));
    expect(odhodene(s, priloz(s, zena.uid))).toBe(0);
    const chlap = karta("v_chlap");
    const s1 = zhromazdenie([vdova], [chlap], balik(5));
    const po = priloz(s1, chlap.uid);
    expect(KONSTANTY.EFEKT.VDOVA_ODHOD_ZA_CHLAPA).toBe(1);
    expect(po.hraci[0].doberaci.map((k) => k.uid)).toEqual(s1.hraci[0].doberaci.slice(1).map((k) => k.uid));
    expect(po.hraci[0].odhadzovaci.map((k) => k.uid)).toEqual(s1.hraci[0].doberaci.slice(0, 1).map((k) => k.uid));
  });

  it("2 Chlapi pri nej (z oboch strán) — 2 karty; Chlap majiteľa Vdovy sa neráta", () => {
    const vdova = lezi(karta("velmi_smutiaca_vdova"), 1);
    const chlap = karta("v_chlap");
    const s = zhromazdenie([lezi(karta("v_chlap"), 0), vdova], [chlap], balik(6));
    expect(odhodene(s, priloz(s, chlap.uid))).toBe(2);
    const s2 = zhromazdenie([lezi(karta("v_chlap"), 1), vdova], [chlap], balik(6));
    expect(odhodene(s2, priloz(s2, chlap.uid))).toBe(1);
  });

  it("málo kariet: zamieša odhadzovací do doberacieho, potom zvyšok z ruky; všetko do odhadzovacieho", () => {
    const vdova = lezi(karta("velmi_smutiaca_vdova"), 1);
    const chlap = karta("v_chlap");
    const ruka = [chlap, ...balik(2)];
    const s = zhromazdenie([lezi(karta("v_chlap"), 0), vdova], ruka, [], balik(1));
    const po = priloz(s, chlap.uid);
    // 1 po zamiešaní odhadzovacieho, 1 z ruky.
    expect(po.hraci[0].doberaci).toEqual([]);
    expect(po.hraci[0].ruka).toHaveLength(1);
    expect(po.hraci[0].odhadzovaci).toHaveLength(2);
    const vsetky = (st: GameState): number[] => [...st.hraci[0].ruka, ...st.hraci[0].doberaci, ...st.hraci[0].odhadzovaci].map((k) => k.uid).sort();
    expect(vsetky(po)).toEqual(vsetky(s).filter((u) => u !== chlap.uid));
    // Ani ruka nestačí: odhodí, čo má.
    const s2 = zhromazdenie([lezi(karta("v_chlap"), 0), vdova], [chlap], [], []);
    const po2 = priloz(s2, chlap.uid);
    expect(po2.hraci[0].odhadzovaci).toHaveLength(0);
    expect(po2.hraci[0].ruka).toEqual([]);
  });

  it("Konflikt oboma smermi (v11.3): Vdovu priloží jej majiteľ k súperovmu Chlapovi — súper odhodí", () => {
    const vdova = karta("velmi_smutiaca_vdova");
    const s0 = zhromazdenie([lezi(karta("v_chlap"), 1)], [vdova], balik(2));
    // Súperov Chlap leží na strane hráča 0 (podstrčený); Vdova hráča 0 ide za neho, odhadzuje hráč 1.
    const s = { ...s0, hraci: [s0.hraci[0], { ...s0.hraci[1], doberaci: balik(3), odhadzovaci: [] }] } as unknown as GameState;
    const po = apply(data, s, { type: "place", uid: vdova.uid, target: "vlastna" }, 0).state;
    expect(po.hraci[1].odhadzovaci).toHaveLength(1);
    expect(po.hraci[0].odhadzovaci).toHaveLength(0);
    // K vlastnému Chlapovi nič (to by bola Podpora, Vdova ju nemá).
    const s2 = zhromazdenie([lezi(karta("v_chlap"), 0)], [vdova], balik(2));
    expect(odhodene(s2, priloz(s2, vdova.uid))).toBe(0);
  });

  it("nový spoj Posilnenie + Posilnenie hlási moment FORSÁŽ!", () => {
    const x = instanceFor(data, "f_x", ["Posilnenie", "Rana", null, null], EMPTY);
    const y = instanceFor(data, "f_y", EMPTY, ["Posilnenie", "Pecka", null, null]);
    const s = zhromazdenie([lezi(x, 0)], [y], balik(3));
    const r = apply(data, s, { type: "place", uid: y.uid, target: "vlastna" }, 0);
    expect(momenty(data, s, r.state, r.events)).toContainEqual(expect.objectContaining({ typ: "forsaz", stupen: "bronz", hrac: null }));
  });
});

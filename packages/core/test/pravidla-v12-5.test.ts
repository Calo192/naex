// Pravidlá v12.5 (Michal 2026-11-16: „Implementovať nasledovne: Hádka pred bitkou, R1, E2, V1, N1.“):
// hádka sa rozdelí pred Nakladačkou (návrh #48 A, §9 krok 4e), reči bodujú len na súperovom strachu
// (R1, §10), kartu z ponuky platíš tomu, kto ju priniesol (E2, §5), výhra väzňami až v ďalšej
// vyhratej bitke (V1, §1 a §10 — testy vo vazen.test.ts) a Dopiť za teba (N1, §6).
// Očakávané hodnoty sú z pravidla, nie z kódu.

import { describe, expect, it } from "vitest";
import cardsJson from "./data/cards-v6.json";
import cardsPlna from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { BitkaStav, CardInstance, GameState, PlacedCard, PlayerId, Vazen } from "../src/index.ts";
import {
  KONSTANTY,
  MOMENTY,
  apply,
  buildGameData,
  eventsFor,
  favourStarsieho,
  legalCommands,
  loadGameData,
  parseScorecards,
  prahyHraca,
  silaAbstinenta,
  momenty,
  moznostiDopitia,
  povodKartySenku,
  setupGame,
  tahBota,
  viewFor,
} from "../src/index.ts";
import { spustBitku } from "./helpers.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

let uidSeq = 93000;
const inst = (defId: string): CardInstance => ({ uid: ++uidSeq, defId, leftLayout: 0, rightLayout: 0 });
const lezi = (defId: string, playedBy: PlayerId, extra: Partial<PlacedCard> = {}): PlacedCard => ({ card: inst(defId), playedBy, ...extra });

/** Zhromaždenie pred 2. Pitkou kola: na ťahu je hráč `naTahu`, línia podľa `strany`. */
function vZhromazdeni(strany: GameState["strany"], naTahu: PlayerId = 1, plne: readonly [number, number] = [2, 2]): GameState {
  const s = setupGame(data, 3);
  return {
    ...s,
    faza: "zhromazdenie",
    draftStav: null,
    pitkyCelkom: 2,
    pitkaCislo: 1,
    ciel: { typ: "lokalita", lokalita: inst("krcma") },
    strany,
    hraci: [
      { ...s.hraci[0], poldeciPlne: plne[0], poldeciVypite: 0, cigarety: 3, ruka: [inst("zamocnik")] },
      { ...s.hraci[1], poldeciPlne: plne[1], poldeciVypite: 0, cigarety: 3, ruka: [inst("zamocnik")] },
    ],
    zhromazdenieStav: { naTahu, zostavaLimit: [plne[0], plne[1]], pasoval: [false, false], navyse: [0, 0] },
  } as GameState;
}

describe("N1 Dopiť za teba (v12.5, §6)", () => {
  const moja = (): PlacedCard => lezi("zamocnik", 1, { naexBy: 0 });

  it("namiesto karty dopije súperovo NA EX zo svojej karty: svoj plný poldeci na vypitý, 1 nerest; súperovo NA EX zíde, jeho poldeci vypitý", () => {
    const karta = moja();
    const s = vZhromazdeni([[lezi("zamocnik", 0)], [lezi("zamocnik", 1), karta]]);
    expect(legalCommands(data, s, 1)).toContainEqual({ type: "dopit", uid: karta.card.uid });
    const { state: t, events } = apply(data, s, { type: "dopit", uid: karta.card.uid }, 1);
    const po = t.strany[1].find((pl) => pl.card.uid === karta.card.uid);
    expect(po?.naexBy).toBeUndefined();
    expect(t.hraci[1].poldeciPlne).toBe(s.hraci[1].poldeciPlne - KONSTANTY.CENA_DOPITIA_POLDECI);
    expect(t.hraci[1].poldeciVypite).toBe(s.hraci[1].poldeciVypite + 1);
    expect(t.hraci[1].nerestiTotoKolo).toBe(s.hraci[1].nerestiTotoKolo + KONSTANTY.NEREST_DOPITIA);
    // Bez pečene (Michal sa k pečeni nevyjadril — znenie návrhu).
    expect(t.hraci[1].pecen).toBe(s.hraci[1].pecen);
    // Súperov poldeci z NA EX ostáva vypitý (ako pri Farárovi), nerest NA EX sa mu ráta.
    expect(t.hraci[0].poldeciVypite).toBe(s.hraci[0].poldeciVypite + 1);
    expect(t.hraci[0].nerestiTotoKolo).toBe(s.hraci[0].nerestiTotoKolo + KONSTANTY.NEREST_NAEX);
    // Je to ťah — hrá súper; ruka sa nemení.
    expect(t.zhromazdenieStav?.naTahu).toBe(0);
    expect(t.hraci[1].ruka).toEqual(s.hraci[1].ruka);
    // Verejné: udalosť aj pečiatka DOPIL ZA TEBA vidia obaja.
    for (const q of [0, 1] as const) expect(eventsFor(events, q)).toContainEqual({ type: "dopitie", hrac: 1 });
    const m = momenty(data, s, t, events);
    expect(m.find((x) => x.typ === "dopitie")).toMatchObject({ hrac: 1, nazov: MOMENTY.dopitie.nazov });
    expect(MOMENTY.dopitie.nazov).toBe("DOPIL ZA TEBA");
  });

  it("len vlastná karta so súperovým NA EX, len s plným poldeci, nie po Vypiť ani mimo Zhromaždenia", () => {
    const karta = moja();
    const vlastneNaex = lezi("zamocnik", 1, { naexBy: 1 });
    const superova = lezi("zamocnik", 0, { naexBy: 1 });
    const s = vZhromazdeni([[superova], [vlastneNaex, karta]]);
    expect(moznostiDopitia(s, 1)).toEqual([karta.card.uid]);
    // Súper (hráč 1) z cudzej karty nedopíja, vlastné NA EX dopíjať netreba.
    expect(() => apply(data, s, { type: "dopit", uid: vlastneNaex.card.uid }, 1)).toThrow(/súperovo NA EX/);
    // Bez plného poldeci nie.
    const bez = vZhromazdeni([[superova], [vlastneNaex, karta]], 1, [2, 0]);
    expect(moznostiDopitia(bez, 1)).toEqual([]);
    expect(() => apply(data, bez, { type: "dopit", uid: karta.card.uid }, 1)).toThrow(/plný poldeci/);
    // Po Vypiť (uprostred ťahu) nie.
    const poVypit = { ...s, zhromazdenieStav: { ...s.zhromazdenieStav!, navyse: [0, 1] as const } } as GameState;
    expect(moznostiDopitia(poVypit, 1)).toEqual([]);
    // V Pitke nie — tam je odpoveď na NA EX.
    expect(moznostiDopitia({ ...s, faza: "pitka" }, 1)).toEqual([]);
    // Kto pasoval, nedopíja.
    const pasoval = { ...s, zhromazdenieStav: { ...s.zhromazdenieStav!, pasoval: [false, true] as const } } as GameState;
    expect(moznostiDopitia(pasoval, 1)).toEqual([]);
  });

  it("Výtržník (zrážka na mojej karte): dopijem súperovo NA EX, moje ostáva a karta prestane byť Výtržníkom", () => {
    const karta = lezi("zamocnik", 1, { naexBy: 0, naexBy2: 1, vytrznik: true });
    const s = vZhromazdeni([[lezi("zamocnik", 0)], [karta]]);
    const t = apply(data, s, { type: "dopit", uid: karta.card.uid }, 1).state;
    const po = t.strany[1][0]!;
    expect(po.naexBy).toBe(1);
    expect(po.naexBy2).toBeUndefined();
    expect(po.vytrznik).toBeUndefined();
  });

  it("dopiť sa dá aj bez karty v ruke — za hráča sa vtedy nepasuje", () => {
    const karta = moja();
    const s0 = vZhromazdeni([[lezi("zamocnik", 0)], [karta]]);
    const s = { ...s0, hraci: [s0.hraci[0], { ...s0.hraci[1], ruka: [] }] } as GameState;
    expect(legalCommands(data, s, 1).map((c) => c.type).sort()).toEqual(["dopit", "pass"]);
  });

  it("bot vie Dopiť použiť: ťah je legálny a ponúkne ho výpočet", () => {
    const karta = moja();
    const s = vZhromazdeni([[lezi("zamocnik", 0)], [karta]]);
    const cmd = tahBota(data, s, 1, 7);
    expect(legalCommands(data, s, 1)).toContainEqual(cmd);
  });

  it("v pohľade súpera nič skryté navyše: ruka dopíjajúceho ostáva len počtom", () => {
    const karta = moja();
    const s = vZhromazdeni([[lezi("zamocnik", 0)], [karta]]);
    const t = apply(data, s, { type: "dopit", uid: karta.card.uid }, 1).state;
    const v = viewFor(data, t, 0);
    expect(JSON.stringify(v)).not.toContain(`"uid":${s.hraci[1].ruka[0]!.uid}`);
  });
});

describe("E2 Platíš tomu, kto kartu priniesol (v12.5, §5)", () => {
  /** Draft po voľbe cieľa (stavba ponuky). */
  function doDraftu(seed: number): GameState {
    const s = setupGame(data, seed);
    return apply(data, s, { type: "chooseLocation", uid: s.lokalityVHre[0]!.uid, otocena: false }, s.utocnik === 0 ? 1 : 0).state;
  }

  /** Draft so stavbou hotovou: obaja dali do ponuky prvé 4 karty stavby. */
  function poStavbe(seed: number): GameState {
    let s = doDraftu(seed);
    while (s.draftStav?.krok === "stavba") {
      const d = s.draftStav;
      for (const p of [0, 1] as const) {
        if (d.vyber[p] !== null) continue;
        const b = d.balicky[p];
        s = apply(data, s, { type: "stavbaSenku", doSenku: b.slice(0, 4).map((k) => k.uid), odhod: b.slice(4).map((k) => k.uid) }, p).state;
        break;
      }
    }
    return s;
  }

  it("pôvod sa ukáže až po odhalení stavby — pred ním súper nevidí, čo hráč do ponuky dal", () => {
    let s = doDraftu(21);
    const d = s.draftStav!;
    const b = d.balicky[0];
    s = apply(data, s, { type: "stavbaSenku", doSenku: b.slice(0, 4).map((k) => k.uid), odhod: b.slice(4).map((k) => k.uid) }, 0).state;
    expect(viewFor(data, s, 1).povodSenku).toEqual([]);
    expect(viewFor(data, s, 1).senok).toEqual([]);
    const t = poStavbe(21);
    for (const k of t.senok) expect([0, 1]).toContain(povodKartySenku(t, k.uid));
  });

  it("Autobusár platí rovnako: každú súperovu kartu súperovi, svoju banke", () => {
    const s0 = poStavbe(22);
    const p: PlayerId = s0.utocnik === 0 ? 1 : 0;
    const su: PlayerId = p === 0 ? 1 : 0;
    const starsi = s0.starsi.find((e) => e.karta.defId === "autobusar")!;
    const vazen: Vazen = { elderId: starsi.elderId, hrac: p, poradie: 1, karta: starsi.karta, scorecard: starsi.scorecard, miesto: 0 };
    const hraci = [...s0.hraci] as [GameState["hraci"][0], GameState["hraci"][1]];
    hraci[p] = { ...hraci[p], cigarety: 5 };
    hraci[su] = { ...hraci[su], cigarety: 0 };
    const s: GameState = { ...s0, hraci, vazni: [vazen], starsi: s0.starsi.filter((e) => e !== starsi) };
    const jeho = s.senok.filter((k) => povodKartySenku(s, k.uid) === su).slice(0, 2).map((k) => k.uid);
    const moja = s.senok.find((k) => povodKartySenku(s, k.uid) === p)!.uid;
    const t = apply(data, s, { type: "schopnostVazna", elderId: starsi.elderId, uids: [...jeho, moja] }, p).state;
    expect(t.hraci[p].cigarety).toBe(2);
    expect(t.hraci[su].cigarety).toBe(2);
  });
});

describe("Hádka pred Nakladačkou (v12.5, návrh #48 A, §9 krok 4e)", () => {
  function bitka(b: Partial<BitkaStav>): BitkaStav {
    return {
      krok: null,
      caka: null,
      sums: [{}, {}],
      exekutorHotovy: [true, true],
      exekutor: [0, 0],
      damage: null,
      vitaz: 0,
      prebytokDrzi: null,
      prebytokZostava: 0,
      prebytokZdvihy: [],
      prebytokPrepadlo: 0,
      spalit: [],
      vesticaHotova: true,
      ...b,
    };
  }

  it("partia rozohraná pred v12.5 (čaká na Nakladačku, hádka nerozdelená): po Nakladačke sa rozdelí hádka", () => {
    const s0 = setupGame(data, 4);
    const s: GameState = {
      ...s0,
      faza: "bitka",
      draftStav: null,
      ciel: { typ: "lokalita", lokalita: s0.lokalityVHre[0]! },
      lokalityVHre: s0.lokalityVHre.slice(1),
      nastenka: [{ kolo: s0.kolo, lokalita: null, vitaz: 0, rozhodlo: "tuhe", pitky: 1, zaBitku: [0, 0], zoSekery: 0, abstakZrazka: 0, prepadlo: 0, zaStarsich: [0, 0], exekutor: [0, 0], prebytok: [0, 0], spakyPo: [0, 0] }],
      bitkaStav: bitka({ krok: "prebytok", caka: 0, vitaz: 0, prebytokDrzi: 0, prebytokZostava: 1, hadka: { makke: [0, 2], vitaz: 1, velkost: 2, zostava: 2, prepadlo: 0, zdvihy: [] } }),
    };
    const id = s.starsi[0]!.elderId;
    const t = apply(data, s, { type: "prebytok", zdvihy: [{ elderId: id, na: 1 }] }, 0).state;
    expect(t.bitkaStav).toMatchObject({ krok: "reci", caka: 1 });
  });
});

describe("R1 Reči sa držia strachu (v12.5, §10)", () => {
  it("bodovanie po bitke: reči nad súperovým strachom nedajú nič, na strachu áno", () => {
    const s0 = setupGame(data, 4);
    const [a, b] = [s0.starsi[0]!, s0.starsi[1]!];
    const starsi = s0.starsi.map((e) =>
      e.elderId === a.elderId ? { ...e, strach: [0, 0] as const, reci: [0, 3] as const, reciOd: [0, 1] as const } : e.elderId === b.elderId ? { ...e, strach: [2, 0] as const, reci: [0, 3] as const, reciOd: [0, 1] as const } : e,
    );
    const s: GameState = {
      ...s0,
      faza: "bitka",
      draftStav: null,
      starsi,
      ciel: { typ: "lokalita", lokalita: s0.lokalityVHre[0]! },
      lokalityVHre: s0.lokalityVHre.slice(1),
      bitkaStav: {
        krok: "hadka",
        caka: null,
        sums: [{ Rana: 2 }, {}],
        exekutorHotovy: [false, false],
        exekutor: [0, 0],
        damage: null,
        vitaz: null,
        prebytokDrzi: null,
        prebytokZostava: 0,
        prebytokZdvihy: [],
        prebytokPrepadlo: 0,
        spalit: [],
        vesticaHotova: true,
      },
    };
    const t = spustBitku(data, s).state;
    // Hráč 2 má plný teplomer pri oboch: pri prvom súper strach nemá (0), pri druhom oranžový — 1 + 2.
    const rozpis = t.nastenka.at(-1)?.zaStarsichRozpis?.[1] ?? [];
    expect(rozpis.find((x) => x.elderId === a.elderId)).toBeUndefined();
    expect(rozpis.find((x) => x.elderId === b.elderId)?.spaky).toBe(3);
  });
});

// --- Mŕtve a otravné pravidlá (Michal 2026-11-16: „implementovať 1–7“, docs/napady/mrtve-pravidla-20261116.html) ---

describe("Abstinent: prah Cirhózy o silu vyšší (v12.5, nález 5)", () => {
  it("sila priazne 1 / 2 / 3 zvýši prah Cirhózy hráča, súperovi nie; Absťáky v bitke uberajú tuhé ďalej", () => {
    const s0 = setupGame(data, 4);
    const abst = s0.starsi.find((e) => favourStarsieho(data, e) === "LAKOMEC")!;
    for (const sila of [1, 2, 3] as const) {
      // Priazeň dáva starší tomu, koho sa bojí menej: strach súpera − môj strach.
      const s: GameState = { ...s0, starsi: s0.starsi.map((e) => (e === abst ? { ...e, strach: [0, sila] as const } : e)) };
      expect(silaAbstinenta(data, s, 0)).toBe(sila);
      expect(prahyHraca(data, s, 0).cirhoza).toBe(KONSTANTY.PRAH_CIRHOZY_ZAKLAD + sila);
      expect(prahyHraca(data, s, 1).cirhoza).toBe(KONSTANTY.PRAH_CIRHOZY_ZAKLAD);
    }
  });
});

describe("Krok 6c aj po finále (v12.5, nález 6 A)", () => {
  it("porazený finále dostane cigaretu a výpalné sa vyplatí, potom sa vykúpia", () => {
    const s0 = setupGame(data, 4);
    const e0 = s0.starsi[0]!;
    const s: GameState = {
      ...s0,
      faza: "bitka",
      draftStav: null,
      starsi: s0.starsi.map((e) => (e === e0 ? { ...e, strach: [0, 3] as const } : e)),
      ciel: { typ: "finale", lokalita: s0.lokalityVHre[0]! },
      lokalityVHre: s0.lokalityVHre.slice(1),
      bitkaStav: {
        krok: "hadka",
        caka: null,
        sums: [{}, {}],
        exekutorHotovy: [false, false],
        exekutor: [0, 0],
        damage: null,
        vitaz: null,
        prebytokDrzi: null,
        prebytokZostava: 0,
        prebytokZdvihy: [],
        prebytokPrepadlo: 0,
        spalit: [],
        vesticaHotova: true,
      },
    };
    const { state, events } = spustBitku(data, { ...s, strany: [[lezi("zamocnik", 0)], []] });
    const logy = events.flatMap((e) => (e.type === "log" ? [e.text] : []));
    expect(state.koniec?.vitaz).toBe(0);
    expect(logy).toContain("Porazený hráč 2 dostáva 1 cigaretu.");
    expect(logy).toContain("Výpalné: hráč 2 dostane z banky 1 cigaretu.");
    // Štart 3 cigarety + 1 porazenému + 1 výpalné = 5 → výkupné 1 špak za 5.
    expect(state.koniec?.vykupne?.[1].cigarety).toBe(5);
  });
});

describe("Výherný automat: Dedičstvo „Pitka: {Cigareta} {Dlh}“ (v12.5, nález 7)", () => {
  const plna = loadGameData(cardsPlna, eldersJson, scorecardsJson);
  const automat = plna.cards.get("vyherny_automat")!;
  const nova = buildGameData(
    new Map([...plna.cards, ["vyherny_automat", { ...automat, effectText: "Dedičstvo: Pitka: {Cigareta} {Dlh}. Hore: {Hazard}→{Poldeci}. Dole: {Hazard}→{Pecka}." }]]),
    plna.elders,
    { scorecards: plna.scorecards, body: parseScorecards(scorecardsJson).body },
  );

  it("v každej Pitke cigareta aj Dlh, bez prahu Dlhu", () => {
    const s0 = setupGame(nova, 9);
    const s: GameState = {
      ...s0,
      faza: "pitka",
      draftStav: null,
      ciel: null,
      strany: [[], []],
      pitkyCelkom: 2,
      pitkaCislo: 1,
      hraci: [{ ...s0.hraci[0], cigarety: 0, dlhy: 0, dedicstvo: [inst("vyherny_automat")] }, { ...s0.hraci[1], cigarety: 0, dlhy: 0 }],
      pitkaStav: { naTahu: 0, hotovy: [false, false], naexPouzity: [false, false], fajcenie: [0, 0], reakcia: null, postarka: [false, false], starosta: [false, false], naexPocet: [0, 0] },
    } as GameState;
    let t = s;
    const ev: { type: string; dlhy?: readonly number[]; cigarety?: readonly number[] }[] = [];
    for (let i = 0; i < 4 && !ev.some((e) => e.type === "pitkaVysledok"); i++) {
      const q = ([0, 1] as const).find((x) => legalCommands(nova, t, x).some((c) => c.type === "skipNaex"));
      if (q === undefined) break;
      const r = apply(nova, t, { type: "skipNaex" }, q);
      ev.push(...r.events);
      t = r.state;
    }
    const v = ev.find((e) => e.type === "pitkaVysledok");
    expect(v?.dlhy).toEqual([1, 0]);
    expect(v?.cigarety).toEqual([1, 0]);
  });
});

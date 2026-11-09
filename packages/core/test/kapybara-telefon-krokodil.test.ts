// Kapybara, Telefón, Krokodíl a hrany Náradia (Michal 2026-11-09, docs/napady/kapybara-telefon.html
// a docs/napady/naradie-len-svoje.html). Kapybara je Školiteľ (Podpora aj Konflikt {Viera}→{Cigareta})
// s akciou navyše bez podmienky „Furt: {Cigareta}“; Telefón v Dedičstve vyhrá remízu v hádke (nie 0 : 0)
// a dá Poveru za každú akciu zrušenú súperovým Odporom, imunita Pohoršení zaniká; Krokodíl „Konflikt:
// Občan {Spálenie}“ spáli na konci bitky súperovho Občana, s ktorým sa stretol (Leader 2026-11-09: len Občan). Texty sú z test/data/karty-20261109.json
// (cards.json ich dostane až od admina); očakávané hodnoty sú z pravidla (PRAVIDLA §6, §9.1, §12, §16).

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import noveJson from "./data/karty-20261109.json";
import staraJson from "./data/cards-pred-frakciami.json";
import type { CardInstance, Command, GameData, GameState, LineState, PlacedCard, PlayerId, VerejnyStav } from "../src/index.ts";
import {
  apply,
  buildGameData,
  cardVariants,
  chybyHran,
  defOf,
  dovodNepodlozenia,
  efektyNavyse,
  evaluateLine,
  hranaSlovami,
  hranyNastroja,
  jeSkolitel,
  legalCommands,
  lineState,
  loadGameData,
  parseCards,
  parseScorecards,
  preskoleniaKarty,
  rozborNavyse,
  sPrilozenou,
  setupGame,
  spaleniaZoSpojov,
  textBezAkcii,
  vysledokHadkyStola,
} from "../src/index.ts";
import type { Layout4 } from "./helpers.ts";
import { instanceFor, makeDef } from "./helpers.ts";

type Surova = Record<string, unknown> & { id: string };

/** cards.json s textami z karty-20261109.json — načítanie sady zároveň overí, že zápisy hra berie. */
function sadaSNovymiTextami(): GameData {
  const zmeny = new Map((noveJson.karty as Surova[]).map((k) => [k.id, k]));
  const cards = (cardsJson as { cards: Surova[] }).cards.map((c) => {
    const z = zmeny.get(c.id);
    if (z === undefined) return c;
    const novy: Surova = { ...c, ...z };
    const def = parseCards({ cards: [novy] }).get(c.id);
    if (def === undefined) throw new Error(c.id);
    const v = cardVariants(def);
    return { ...novy, permutations: { total: v.total, left: v.left.length, right: v.right.length } };
  });
  return loadGameData({ ...cardsJson, cards }, eldersJson, scorecardsJson);
}

const nova = sadaSNovymiTextami();
/** Sada so starým Telefónom (imunita Pohoršení, do v11.16). */
const stara = loadGameData(staraJson, eldersJson, scorecardsJson);

const VIERY: Layout4 = ["Viera", "Viera", "Viera", "Viera"];
const POHORSENIA: Layout4 = ["Pohoršenie", "Pohoršenie", "Pohoršenie", "Pohoršenie"];
const ODPORY: Layout4 = ["Odpor", "Odpor", "Odpor", "Odpor"];
const PAKTY: Layout4 = ["Pakt", "Pakt", "Pakt", "Pakt"];
const ROBOTY: Layout4 = ["Robota", "Robota", "Robota", "Robota"];

const syn = [
  makeDef("s_viera", VIERY, VIERY, { tags: ["Občan", "Žena"] }),
  makeDef("s_pohorsenie", POHORSENIA, POHORSENIA, { tags: ["Občan", "Chlap"] }),
  makeDef("s_odpor", ODPORY, ODPORY, { tags: ["Občan", "Chlap"] }),
  makeDef("s_pakt", PAKTY, PAKTY, { tags: ["Občan", "Chlap"] }),
  makeDef("s_robota", ROBOTY, ROBOTY, { tags: ["Občan", "Chlap"] }),
];
const data: GameData = buildGameData(new Map([...nova.cards, ...syn.map((x) => [x.id, x] as const)]), nova.elders, {
  scorecards: nova.scorecards,
  body: parseScorecards(scorecardsJson).body,
});
const ROZ: Record<string, Layout4> = { s_viera: VIERY, s_pohorsenie: POHORSENIA, s_odpor: ODPORY, s_pakt: PAKTY, s_robota: ROBOTY };

let uidSeq = 960000;
const karta = (id: string): CardInstance => {
  const r = ROZ[id];
  return r === undefined ? { uid: ++uidSeq, defId: id, leftLayout: 0, rightLayout: 0 } : instanceFor(data, id, r, r);
};
const lezi = (card: CardInstance, playedBy: PlayerId, x: Partial<PlacedCard> = {}): PlacedCard => ({ card, playedBy, ...x });
const naKarte = (s: Pick<GameState, "strany">, uid: number): PlacedCard | undefined => s.strany.flat().find((pl) => pl.card.uid === uid);

/** Línia bez lokality s Dedičstvom hráčov: strana 0 [A, B] je úsek B · A (B.pravá ↔ A.ľavá). */
function linia(strana0: PlacedCard[], dedicstvo: readonly [readonly CardInstance[], readonly CardInstance[]] = [[], []]): LineState {
  return {
    lokalita: null,
    lokalitaOtocena: false,
    strany: [strana0, []],
    kolo: { naexVKole: [false, false], dlhy: [0, 0], prilozeniaKu: [0, 0], dedicstvo, poslednaPitka: false },
  };
}

/** Zhromaždenie na Zastávke, hráč 0 na ťahu s `ruka`. */
function zhromazdenie(strany: GameState["strany"], ruka: CardInstance[]): GameState {
  const s0 = setupGame(data, 7);
  const lokalita = s0.lokalityVHre.find((k) => k.defId === "zastavka")!;
  const hraci = [{ ...s0.hraci[0], ruka }, s0.hraci[1]] as unknown as GameState["hraci"];
  return {
    ...s0,
    hraci,
    faza: "zhromazdenie",
    utocnik: 0,
    ciel: { typ: "lokalita", lokalita },
    lokalityVHre: s0.lokalityVHre.filter((k) => k !== lokalita),
    strany,
    pitkyCelkom: 1,
    pitkaCislo: 0,
    pitkaStav: null,
    zhromazdenieStav: { naTahu: 0, zostavaLimit: [3, 3], pasoval: [false, false], navyse: [0, 0] },
  };
}
const priloz = (s: GameState, uid: number) => apply(data, s, { type: "place", uid, target: "vlastna" }, 0);

/** Pitka na Zastávke (obranca = hráč 0 na ťahu), s balíčkami, aby hra nedohrala Pitku sama. */
function vPitke(strany: GameState["strany"]): GameState {
  const s0 = setupGame(data, 7);
  const lokalita = s0.lokalityVHre.find((k) => k.defId === "zastavka")!;
  const hraci = s0.hraci.map((h) => ({ ...h, cigarety: 5, doberaci: [karta("masiar"), karta("vandal"), karta("hasic")] })) as unknown as GameState["hraci"];
  return {
    ...s0,
    hraci,
    senok: [karta("masiar"), karta("zamocnik"), karta("vandal")],
    faza: "pitka",
    utocnik: 1,
    ciel: { typ: "lokalita", lokalita },
    lokalityVHre: s0.lokalityVHre.filter((k) => k !== lokalita),
    strany,
    pitkyCelkom: 1,
    pitkaCislo: 1,
    pitkaStav: { naTahu: 0, hotovy: [false, false], naexPouzity: [false, false], fajcenie: [0, 0], reakcia: null, postarka: [false, false], starosta: [false, false], naexPocet: [0, 0] },
  };
}

/** Dohrá kolo prvými „pokojnými“ ťahmi až po ďalšie kolo (alebo koniec hry). */
function dohrajKolo(s0: GameState): GameState {
  let s = s0;
  const kolo = s.kolo;
  for (let i = 0; i < 400 && s.koniec === null && s.kolo === kolo; i++) {
    const q = ([0, 1] as const).find((x) => legalCommands(data, s, x).length > 0);
    if (q === undefined) break;
    const legal = legalCommands(data, s, q);
    const cmd =
      legal.find((c) => c.type === "skipNaex") ??
      legal.find((c) => c.type === "pass") ??
      legal.find((c) => c.type === "bezReakcie") ??
      legal.find((c) => c.type === "cintorin" && c.uid === null) ??
      legal.find((c) => c.type === "vizia" && c.vziat) ??
      (legal[0] as Command);
    s = apply(data, s, cmd, q).state;
  }
  return s;
}
const kartyHraca = (s: GameState, p: PlayerId): number[] => [...s.hraci[p].ruka, ...s.hraci[p].doberaci, ...s.hraci[p].odhadzovaci].map((k) => k.uid);

// --- Zápis ---------------------------------------------------------------------

describe("zápis: akcie navyše bez podmienky (Furt) a {Spálenie}", () => {
  it("„Furt: {Cigareta}.“ — akcia navyše bez podmienky; tag ani modifikátor nie", () => {
    expect(rozborNavyse("Furt: {Cigareta}.")).toEqual({ efekty: [{ spustac: "Furt", tag: null, akcie: ["Cigareta"] }], chyby: [] });
    expect(rozborNavyse("Furt: Pamätník {Cigareta}.").chyby[0]).toMatch(/bez podmienky/);
    expect(rozborNavyse("Furt: {Posilnenie}.").chyby[0]).toMatch(/bez spoja/);
    // Mäsiar (Furt slovami) akcie navyše nemá.
    expect(efektyNavyse(defOf(data, { defId: "masiar" }))).toEqual([]);
  });

  it("„Konflikt: {Spálenie}.“ — účinok v pečati, nie akcia; inde než pri Konflikte či Podpore je to chyba", () => {
    expect(rozborNavyse("Konflikt: {Spálenie}.")).toEqual({ efekty: [{ spustac: "Konflikt", tag: null, akcie: [], ucinky: ["Spálenie"] }], chyby: [] });
    expect(rozborNavyse("Konflikt: Občan {Spálenie}.")).toEqual({ efekty: [{ spustac: "Konflikt", tag: "Občan", akcie: [], ucinky: ["Spálenie"] }], chyby: [] });
    expect(rozborNavyse("Spoločník: Pamätník {Spálenie}.").chyby[0]).toMatch(/Konflikt alebo Podporu/);
    expect(textBezAkcii("Konflikt: {Spálenie}.")).toBe("Konflikt.");
  });

  it("nové texty sa načítajú bez chyby a hrany 15 Nástrojov sú podľa tabuľky (naradie-len-svoje.html)", () => {
    const hrany = (id: string): string => {
      const h = hranyNastroja(defOf(nova, { defId: id }));
      return h === null ? "—" : `${hranaSlovami(h.horna)} | ${hranaSlovami(h.dolna)}`;
    };
    expect({
      energetak: hrany("energetak"),
      lievik: hrany("lievik"),
      vidly: hrany("vidly"),
      boxer: hrany("boxer"),
      pasca: hrany("pasca"),
      zapalovac: hrany("zapalovac"),
      noviny: hrany("noviny"),
      svaty_text: hrany("svaty_text"),
      nealko: hrany("nealko"),
      kristalova_gula: hrany("kristalova_gula"),
      vyherny_automat: hrany("vyherny_automat"),
      vyherne_zreby: hrany("vyherne_zreby"),
      furik: hrany("furik"),
      horoskop: hrany("horoskop"),
      pistalka: hrany("pistalka"),
      telefon: hrany("telefon"),
    }).toEqual({
      energetak: "Forsáž | Poldeci → Posilnenie",
      lievik: "Výtržník | Pečeň → Robota",
      vidly: "Vzbura | Robota → Petelica",
      boxer: "Pecka → Petelica | Rana → Petelica",
      pasca: "Pečeň → Rana | Posilnená Rana",
      zapalovac: "Cigareta → Rana | Poldeci → Petelica",
      noviny: "Viera → Pohoršenie | Pečeň → Pohoršenie",
      svaty_text: "Povera → Viera | Odpor → Viera",
      nealko: "Pečeň → Povera | Poldeci → Pohoršenie",
      kristalova_gula: "Povera → Vízia | Pečeň → Vízia",
      vyherny_automat: "Hazard → Poldeci | Hazard → Pecka",
      vyherne_zreby: "Hazard → Vízia | Cigareta → Vízia",
      furik: "Hazard → Robota | Posilnená Robota",
      horoskop: "Hazard → Povera | Posilnená Povera",
      pistalka: "Pečeň → Obmedzenie | Posilnené Obmedzenie",
      telefon: "Povera → Pohoršenie | Odpor → Povera",
    });
    for (const k of noveJson.karty) expect(chybyHran(defOf(nova, { defId: k.id }))).toEqual([]);
  });

  it("každá dvojica X → Y je v sade jediná — hrany Nástrojov a Školitelia vrátane Kapybary", () => {
    const dvojice: string[] = [];
    for (const def of nova.cards.values()) {
      const h = hranyNastroja(def);
      if (h !== null) for (const x of [h.horna, h.dolna]) if (x.druh === "akcia") dvojice.push(`${x.z}>${x.na}`);
      for (const e of preskoleniaKarty(def)) if (def.id !== "kapybara" || e.spustac === "Podpora") dvojice.push(`${e.z}>${e.na}`);
    }
    // Známa kolízia zo sady: Vidly dole {Rana}→{Pecka} = Sypač — Vidly ju od 2026-11-09 nemajú.
    expect(dvojice.filter((d, i) => dvojice.indexOf(d) !== i)).toEqual([]);
  });
});

// --- Kapybara ------------------------------------------------------------------------

describe("Kapybara — Školiteľ: Podpora aj Konflikt {Viera}→{Cigareta}, Furt: {Cigareta}", () => {
  const kapybara = defOf(data, { defId: "kapybara" });

  it("je Zviera aj Školiteľ s dvoma spúšťačmi; akcia navyše Cigareta platí, kým leží — vedľa Mäsiara nie", () => {
    expect(kapybara.tags).toEqual(["Zviera"]);
    expect(jeSkolitel(kapybara)).toBe(true);
    expect(preskoleniaKarty(kapybara)).toEqual([
      { spustac: "Podpora", z: "Viera", na: "Cigareta" },
      { spustac: "Konflikt", z: "Viera", na: "Cigareta" },
    ]);
    const kap = karta("kapybara");
    const sama = evaluateLine(data, linia([lezi(kap, 0)]));
    expect(sama.cards.get(kap.uid)?.navyse?.[0]).toMatchObject({ spustac: "Furt", krat: 1 });
    expect(sama.sums[0].Cigareta ?? 0).toBe(1);
    const priMasiarovi = evaluateLine(data, linia([lezi(kap, 0), lezi(karta("masiar"), 1)]));
    expect(priMasiarovi.cards.get(kap.uid)?.navyse?.[0]?.krat).toBe(0);
  });

  it("priložená k tvojej karte (Podpora) aj k súperovej (Konflikt): Viery tej karty sa do konca kola rátajú ako Cigarety", () => {
    const moja = lezi(karta("s_viera"), 0);
    const kap = karta("kapybara");
    const { state: po, events } = priloz(zhromazdenie([[moja], []], [kap]), kap.uid);
    expect(naKarte(po, moja.card.uid)?.preskolenia).toEqual([{ z: "Viera", na: "Cigareta", od: kap.uid, spustac: "Podpora" }]);
    expect(events.some((e) => e.type === "log" && /^Podpora — Preškolenie: Kapybara .* Viera ako Cigareta\.$/.test(e.text))).toBe(true);
    const ev = evaluateLine(data, lineState(po));
    expect(ev.sums[0].Viera ?? 0).toBe(0);

    const cudzia = lezi(karta("s_viera"), 1);
    const kap2 = karta("kapybara");
    const po2 = priloz(zhromazdenie([[cudzia], []], [kap2]), kap2.uid).state;
    expect(naKarte(po2, cudzia.card.uid)?.preskolenia).toEqual([{ z: "Viera", na: "Cigareta", od: kap2.uid, spustac: "Konflikt" }]);
    // Náhľad vyloženia vidí to isté ako motor.
    const s2 = zhromazdenie([[cudzia], []], [kap2]);
    expect(naKarte(sPrilozenou(data, s2, 0, kap2, 0), cudzia.card.uid)?.preskolenia).toEqual(naKarte(po2, cudzia.card.uid)?.preskolenia);
  });

  it("starý Nástup (súperove reči o stupeň nižšie) zanikol — priloženie nečaká na voľbu staršieho", () => {
    const kap = karta("kapybara");
    const s = zhromazdenie([[lezi(karta("s_robota"), 0)], []], [kap]);
    const starsi = s.starsi.map((e, i) => (i === 0 ? { ...e, strach: [0, 1] as const, reci: [0, 3] as const, reciOd: [0, 2] as const } : e));
    const po = priloz({ ...s, starsi }, kap.uid).state;
    expect(po.hasicVolby ?? []).toEqual([]);
    expect(po.starsi[0]!.reci).toEqual([0, 3]);
  });
});

// --- Telefón -------------------------------------------------------------------------

describe("Telefón (Dedičstvo): remíza v hádke a Povera za akciu zrušenú súperovým Odporom", () => {
  const tel = (): CardInstance => karta("telefon");
  const stav = (d0: number, d1: number): Pick<VerejnyStav, "hraci"> =>
    ({ hraci: [{ dedicstvo: Array.from({ length: d0 }, tel) }, { dedicstvo: Array.from({ length: d1 }, tel) }] }) as unknown as Pick<VerejnyStav, "hraci">;

  it("remízu (nie 0 : 0) vyhráva majiteľ Telefónu o 0; majú ho obaja = remíza; starý text remízu nemení", () => {
    expect(vysledokHadkyStola(data, stav(0, 1), [2, 2])).toEqual({ vitaz: 1, velkost: 0, telefon: true });
    expect(vysledokHadkyStola(data, stav(2, 0), [3, 3])).toEqual({ vitaz: 0, velkost: 0, telefon: true });
    expect(vysledokHadkyStola(data, stav(0, 1), [0, 0])).toEqual({ vitaz: null, velkost: 0 });
    expect(vysledokHadkyStola(data, stav(1, 1), [2, 2])).toEqual({ vitaz: null, velkost: 0 });
    // Bez remízy Telefón nič nemení.
    expect(vysledokHadkyStola(data, stav(1, 0), [1, 3])).toEqual({ vitaz: 1, velkost: 2 });
    expect(vysledokHadkyStola(stara, stav(0, 1), [2, 2])).toEqual({ vitaz: null, velkost: 0 });
  });

  it("Odpor súpera zruší aj Pohoršenie (imunita zanikla) a za každú zrušenú akciu dá Telefón 1 Poveru — za každý Telefón", () => {
    const moja = lezi(karta("s_pohorsenie"), 0);
    const odpor = lezi(karta("s_odpor"), 1);
    const t = tel();
    const ev = evaluateLine(data, linia([moja, odpor], [[t], []]));
    expect(ev.sums[0].Pohoršenie ?? 0).toBe(0);
    expect(ev.zruseneSuperovymOdporom).toEqual([4, 0]);
    expect(ev.navyseDedicstva?.get(t.uid)?.find((e) => e.spustac === "Bitka")?.krat).toBe(4);
    expect(ev.sums[0].Povera ?? 0).toBe(4);
    const dva = evaluateLine(data, linia([moja, odpor], [[tel(), tel()], []]));
    expect(dva.sums[0].Povera ?? 0).toBe(8);
    // Bez Telefónu nič; vlastný Odpor sa neráta.
    expect(evaluateLine(data, linia([moja, odpor])).sums[0].Povera ?? 0).toBe(0);
    expect(evaluateLine(data, linia([moja, lezi(karta("s_odpor"), 0)], [[tel()], []])).sums[0].Povera ?? 0).toBe(0);
  });

  it("Pakt, ktorý súperov Odpor nenechal kopírovať, je tvoja zrušená akcia — ráta sa", () => {
    const ev = evaluateLine(data, linia([lezi(karta("s_pakt"), 0), lezi(karta("s_odpor"), 1)], [[tel()], []]));
    expect(ev.zruseneSuperovymOdporom).toEqual([4, 0]);
    expect(ev.sums[0].Povera ?? 0).toBe(4);
  });
});

// --- Krokodíl --------------------------------------------------------------------------

describe("Krokodíl — Konflikt: Občan {Spálenie}", () => {
  it("len súperov Občan: Starešinu ani Zviera bez tagu Občan neoznačí, Recidivistu (Občan aj Zviera) áno", () => {
    expect(efektyNavyse(defOf(data, { defId: "krokodil" }))).toEqual([{ spustac: "Konflikt", tag: "Občan", akcie: [], ucinky: ["Spálenie"] }]);
    const oznacene = (id: string): readonly number[] => {
      const cudzia = lezi(karta(id), 1);
      const kro = karta("krokodil");
      return naKarte(priloz(zhromazdenie([[cudzia], []], [kro]), kro.uid).state, kro.uid)?.navyseOd?.[0] ?? [];
    };
    expect(oznacene("farar")).toEqual([]);
    expect(oznacene("pes")).toEqual([]);
    expect(oznacene("recidivista")).toHaveLength(1);
  });

  it("priložený k súperovej karte ju označí; k tvojej nie (to by bola Podpora)", () => {
    const cudzia = lezi(karta("s_robota"), 1);
    const kro = karta("krokodil");
    const { state: po, events } = priloz(zhromazdenie([[cudzia], []], [kro]), kro.uid);
    expect(naKarte(po, kro.uid)?.navyseOd).toEqual([[cudzia.card.uid]]);
    expect(events.some((e) => e.type === "log" && e.text.includes("sa na konci bitky spáli"))).toBe(true);
    expect(spaleniaZoSpojov(data, lineState(po)).map((x) => x.obet.card.uid)).toEqual([cudzia.card.uid]);

    const moja = lezi(karta("s_robota"), 0);
    const kro2 = karta("krokodil");
    const po2 = priloz(zhromazdenie([[moja], []], [kro2]), kro2.uid).state;
    expect(spaleniaZoSpojov(data, lineState(po2))).toEqual([]);
  });

  it("na konci bitky sa súperova karta spáli (nevráti sa), Nástroj pod ňou ide tomu, kto ho podložil; vlastný sused ostáva", () => {
    const moja = lezi(karta("s_robota"), 0);
    const nastroj = karta("furik");
    const cudzia = lezi(karta("s_robota"), 1, { podlozene: [{ card: nastroj, majitel: 1, hrana: "horna" }] });
    const kro = lezi(karta("krokodil"), 0, { navyse: [1], navyseOd: [[cudzia.card.uid]] });
    const po = dohrajKolo(vPitke([[moja, kro, cudzia], []]));
    expect(kartyHraca(po, 1)).not.toContain(cudzia.card.uid);
    expect(kartyHraca(po, 1)).toContain(nastroj.uid);
    expect(kartyHraca(po, 0)).toContain(moja.card.uid);
    expect(kartyHraca(po, 0)).toContain(kro.card.uid);
  });

  it("vedľa Mäsiara nespáli nič — efekty Zvierat v jeho okolí neplatia", () => {
    const cudzia = lezi(karta("s_robota"), 1);
    const kro = lezi(karta("krokodil"), 0, { navyse: [1], navyseOd: [[cudzia.card.uid]] });
    const masiar = lezi(karta("masiar"), 0);
    const s = vPitke([[masiar, kro, cudzia], []]);
    expect(spaleniaZoSpojov(data, lineState(s))).toEqual([]);
    expect(kartyHraca(dohrajKolo(s), 1)).toContain(cudzia.card.uid);
  });
});

// --- 2 na 2 ---------------------------------------------------------------------------

describe("2 na 2: vlastná karta pri podkladaní je aj karta spoluhráča", () => {
  it("Nástroj smie pod kartu spoluhráča (ten istý tím), pod kartu súperovho tímu nie", () => {
    const nastroj = karta("furik");
    const spoluhrac = lezi(karta("s_robota"), 0, { miesto: 2 });
    const super_ = lezi(karta("s_robota"), 1, { miesto: 1 });
    const l = linia([spoluhrac, super_]);
    expect(dovodNepodlozenia(data, l, nastroj, spoluhrac.card.uid, "dolna", 0)).toBeNull();
    expect(dovodNepodlozenia(data, l, nastroj, super_.card.uid, "dolna", 0)).toMatch(/vlastné karty/);
  });
});

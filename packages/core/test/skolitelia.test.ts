// Občania v troch kategóriách (Michal 2026-11-08, docs/napady/obcania-kategorie.json): Školitelia
// („Spúšťač: Preškolenie {X}→{Y}.“ — Vedúcko Furt, Sypač a Anonymný alkoholik Podpora, Tipér
// Konflikt), Efekt s vedľajšou akciou (Šofér, Traktorista, Dievčina, Opatrovateľka) a Textový efekt.
// Testy stoja na budúcej sade (obcaniaData.ts) a na syntetických kartách s presnými hranami;
// očakávané hodnoty sú z pravidla (PRAVIDLA §6, §16, §17), nie z kódu.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import scenarJson from "../data/vyucba/prva-hra.json";
import zoznam from "./data/obcania-kategorie.json";
import type { CardInstance, Event, GameData, GameState, LineState, PitkaStav, PlacedCard, PlayerId, ScenarVyucby } from "../src/index.ts";
import {
  apply,
  buildGameData,
  defOf,
  dlhyPoslednejPitky,
  efektyNavyse,
  evaluateLine,
  jeSkolitel,
  legalCommands,
  lineState,
  loadGameData,
  nahladVylozenia,
  naTahu,
  overScenar,
  parseScorecards,
  podmienkySpoja,
  preskoleniaKarty,
  preskoleniaPoSpoji,
  prehrajVyucbu,
  rozborNavyse,
  rozborPreskoleniKarty,
  sPrilozenou,
  setupGame,
  spustiSpoj,
  tahBota,
  textBezAkcii,
  vyhladDlhov,
} from "../src/index.ts";
import type { Layout4 } from "./helpers.ts";
import { EMPTY, instanceFor, makeDef, syntheticData } from "./helpers.ts";
import { dataBuducejSady } from "./obcaniaData.ts";

const buduca = dataBuducejSady();
const dnesna = loadGameData(cardsJson, eldersJson, scorecardsJson);

const ROBOTY: Layout4 = ["Robota", "Robota", "Robota", "Robota"];
const RANY: Layout4 = ["Rana", "Rana", "Rana", "Rana"];
const CIGARETY: Layout4 = ["Cigareta", "Cigareta", "Cigareta", "Cigareta"];
const PECEN: Layout4 = ["PoškodeniePečene", "PoškodeniePečene", "PoškodeniePečene", "PoškodeniePečene"];
const RANA_PECKA: Layout4 = ["Rana", "Pecka", "Rana", "Pecka"];

const VEDUCKO = "Furt: Preškolenie {Robota}→{Pecka}.";
const SYPAC = "Podpora: Preškolenie {Rana}→{Pecka}.";
const AA = "Podpora: Preškolenie {PoškodeniePečene}→{Viera}.";
const TIPER = "Konflikt: Preškolenie {Cigareta}→{Dlh}.";

const lezi = (card: CardInstance, playedBy: PlayerId, x: Partial<PlacedCard> = {}): PlacedCard => ({ card, playedBy, ...x });
/** Bez lokality: strana 0 [A, B, C] je úsek C · B · A (C.pravá ↔ B.ľavá, B.pravá ↔ A.ľavá). */
const linia = (strana0: PlacedCard[], lokalita: CardInstance | null = null): LineState => ({ lokalita, lokalitaOtocena: false, strany: [strana0, []] });
const sloty = (ev: ReturnType<typeof evaluateLine>, uid: number) => [...(ev.cards.get(uid)?.left ?? []), ...(ev.cards.get(uid)?.right ?? [])].filter((x) => x !== null);

// --- Zápis ---------------------------------------------------------------------

describe("zápis „Spúšťač: Preškolenie {X}→{Y}.“", () => {
  it("štyria Školitelia budúcej sady — spúšťač, X a Y; {Hazard} je Dlh, {Pečeň} Poškodenie pečene", () => {
    const efekt = (id: string) => preskoleniaKarty(defOf(buduca, { defId: id }));
    expect(efekt("veducko")).toEqual([{ spustac: "Furt", z: "Robota", na: "Pecka" }]);
    expect(efekt("kulturista")).toEqual([{ spustac: "Podpora", z: "Rana", na: "Pecka" }]);
    expect(efekt("anonymny_alkoholik")).toEqual([{ spustac: "Podpora", z: "PoškodeniePečene", na: "Viera" }]);
    expect(efekt("profesionalny_tiper")).toEqual([{ spustac: "Konflikt", z: "Cigareta", na: "Dlh" }]);
    expect(rozborPreskoleniKarty("Konflikt: Preškolenie {Cigareta}→{Hazard}.").efekty).toEqual([{ spustac: "Konflikt", z: "Cigareta", na: "Dlh" }]);
    expect(rozborPreskoleniKarty("Furt: Preškolenie {Pečeň} -> {Viera}.").efekty).toEqual([{ spustac: "Furt", z: "PoškodeniePečene", na: "Viera" }]);
  });

  it("chyby: neznáma akcia, X = Y, modifikátor spoja, iný spúšťač, chýbajúci zápis, slovo mimo spúšťača", () => {
    const chyby = (t: string) => rozborPreskoleniKarty(t).chyby;
    expect(chyby("Furt: Preškolenie {Ranka}→{Pecka}.")[0]).toMatch(/Ranka/);
    expect(chyby("Furt: Preškolenie {Rana}→{Rana}.")[0]).toMatch(/tú istú akciu/);
    expect(chyby("Furt: Preškolenie {Posilnenie}→{Rana}.")[0]).toMatch(/modifikátory/);
    expect(chyby("Podpora: Preškolenie {Rana}→{Odpor}.")[0]).toMatch(/modifikátory/);
    expect(chyby("Bitka: Preškolenie {Rana}→{Pecka}.")[0]).toMatch(/Furt, Podpora, Konflikt/);
    expect(chyby("Furt: Preškolenie.")[0]).toMatch(/chýba zápis/);
    expect(chyby("Furt: Tvoje Preškolenie je silné.")).toHaveLength(1);
    // Chybný zápis odmietne už načítanie sady.
    const zly = { ...cardsJson, cards: cardsJson.cards.map((c) => (c.id === "veducko" ? { ...c, effect_text: "Furt: Preškolenie {Robota}→{Robota}." } : c)) };
    expect(() => loadGameData(zly, eldersJson, scorecardsJson)).toThrow(/veducko/);
  });

  it("nie je to akcia navyše ani tag: rozbor navyše ho preskočí, Podpora a Konflikt sú bez tagu, text karty bez piktogramov", () => {
    for (const t of [VEDUCKO, SYPAC, AA, TIPER]) expect(rozborNavyse(t), t).toEqual({ efekty: [], chyby: [] });
    expect(podmienkySpoja({ effectText: SYPAC, tags: ["Občan"] }, "Podpora")).toEqual([null]);
    expect(podmienkySpoja({ effectText: TIPER, tags: ["Občan"] }, "Konflikt")).toEqual([null]);
    expect(textBezAkcii(SYPAC)).toBe("Podpora: Preškolenie.");
    // Starší má v línii len akcie (v9) — Preškolenie ako schopnosť väzňa nie.
    expect(preskoleniaKarty({ effectText: VEDUCKO, tags: ["Starešina"] })).toEqual([]);
  });
});

describe("budúca sada: 8 zmenených Občanov (test/data/obcania-kategorie.json pre admina)", () => {
  it("zoznam sedí so záväzným zadaním: 4 Školitelia, 4 s vedľajšou akciou", () => {
    expect(zoznam.karty.map((k) => k.id).sort()).toEqual(["anonymny_alkoholik", "dievcina_na_vydaj", "kulturista", "opatrovatelka", "profesionalny_tiper", "sofer", "traktoristka", "veducko"]);
    for (const k of zoznam.karty) expect(jeSkolitel(defOf(buduca, { defId: k.id })), k.id).toBe(k.kategoria === "skolitel");
    const navyse = (id: string) => efektyNavyse(defOf(buduca, { defId: id }));
    expect(navyse("dievcina_na_vydaj")).toEqual([{ spustac: "Podpora", tag: null, akcie: ["Povera"] }]);
    expect(navyse("opatrovatelka")).toEqual([{ spustac: "Spoločník", tag: "Pamätník", akcie: ["Robota"] }]);
    expect(navyse("sofer")).toEqual([{ spustac: "Bitka", tag: null, akcie: ["Pecka", "Rana"], podmienka: "Ak si v tomto kole nedal NA EX" }]);
    expect(navyse("traktoristka")).toEqual([
      { spustac: "Bitka", tag: null, akcie: ["Pecka"], podmienka: "Ak máš v jeho kraji prevahu" },
      { spustac: "Posledná Pitka kola", tag: null, akcie: ["Dlh"], podmienka: "Bez prevahy v jeho kraji" },
    ]);
  });

  it("prechod: dnešná sada v67 sa so starými textmi načíta, Školiteľa v nej niet a staré texty nič nepreškolia", () => {
    for (const id of ["veducko", "kulturista", "anonymny_alkoholik", "profesionalny_tiper"]) expect(jeSkolitel(defOf(dnesna, { defId: id })), id).toBe(false);
    const v = { uid: 1, defId: "veducko", leftLayout: 0, rightLayout: 0 };
    const ziv = { uid: 2, defId: "zivnostnik", leftLayout: 0, rightLayout: 0 };
    const ev = evaluateLine(dnesna, linia([lezi(v, 0), lezi(ziv, 0)]));
    expect(ev.cards.get(ziv.uid)?.preskolena).toBeUndefined();
    expect(ev.cards.get(v.uid)?.skolitel).toBeUndefined();
  });
});

// --- Furt: Vedúcko --------------------------------------------------------------

describe("Furt — obaja susedia, karty oboch hráčov, kým susedia (Vedúcko)", () => {
  const d = syntheticData([
    makeDef("veducko", RANY, RANY, { tags: ["Občan", "Autorita", "Chlap"], triggers: ["Furt"], effectText: VEDUCKO }),
    makeDef("obyc", RANY, RANY, { tags: ["Občan"] }),
    makeDef("rob", ROBOTY, ROBOTY, { tags: ["Občan"] }),
    makeDef("v_rob", ROBOTY, ROBOTY, { tags: ["Občan"], triggers: ["Furt"], effectText: VEDUCKO }),
    makeDef("lok", ROBOTY, ROBOTY, { tags: ["Lokalita"] }),
  ]);
  const k = (id: string, l: Layout4, r: Layout4 = l) => instanceFor(d, id, l, r);

  it("Roboty oboch susedov sú pred spojmi Pecky — aj súperovej karty; bez Vedúcka Roboty", () => {
    const a = k("rob", ROBOTY);
    const v = k("veducko", RANY);
    const c = k("rob", ROBOTY);
    const ev = evaluateLine(d, linia([lezi(a, 0), lezi(v, 0), lezi(c, 1)]));
    // Každý sused má k Vedúckovi 4 spárované Roboty — teraz Pecky; Rany Vedúcka ostávajú.
    expect(ev.sums).toEqual([{ Pecka: 4, Rana: 8 }, { Pecka: 4 }]);
    expect(ev.zdroje[1].Pecka?.[0]?.dovody).toContain("karta:veducko");
    const o = k("obyc", RANY);
    expect(evaluateLine(d, linia([lezi(a, 0), lezi(o, 0), lezi(c, 1)])).sums).toEqual([{ Robota: 4, Rana: 8 }, { Robota: 4 }]);
  });

  it("slot nesie vytlačenú akciu a Školiteľa; dotknutá karta aj Školiteľ to vedia povedať klientovi", () => {
    const a = k("rob", ROBOTY);
    const v = k("veducko", RANY);
    const c = k("rob", ROBOTY);
    const ev = evaluateLine(d, linia([lezi(a, 0), lezi(v, 0), lezi(c, 1)]));
    for (const x of sloty(ev, a.uid)) expect(x).toMatchObject({ action: "Pecka", povodna: "Robota", preskolil: v.uid });
    expect(ev.cards.get(a.uid)?.preskolena).toEqual([{ z: "Robota", na: "Pecka", od: v.uid, zdroj: "Furt", akcii: 8 }]);
    expect(ev.cards.get(v.uid)?.skolitel).toEqual([{ spustac: "Furt", z: "Robota", na: "Pecka", ku: [c.uid, a.uid], akcii: 16 }]);
    // Sused bez Robôt: pilulka sivá (0), šípka ostáva.
    const o = k("obyc", RANY);
    const ev2 = evaluateLine(d, linia([lezi(o, 0), lezi(v, 0)]));
    expect(ev2.cards.get(v.uid)?.skolitel?.[0]).toMatchObject({ ku: [o.uid], akcii: 0 });
  });

  it("karta sama ani hrana lokality sa nepreškolí; keď sused odíde, premena skončí", () => {
    const vr = k("v_rob", ROBOTY);
    const lok = k("lok", ROBOTY);
    // V_rob pri lokalite: jeho Roboty aj Roboty hrany lokality ostávajú Robotami (oboje hráčovi 0).
    const ev = evaluateLine(d, linia([lezi(vr, 0)], lok));
    expect(ev.sums[0]).toEqual({ Robota: 8 });
    expect(ev.cards.get(vr.uid)?.skolitel?.[0]).toMatchObject({ ku: [], akcii: 0 });
    const a = k("rob", ROBOTY);
    expect(evaluateLine(d, linia([lezi(a, 0), lezi(k("obyc", RANY), 0)])).cards.get(a.uid)?.preskolena).toBeUndefined();
  });

  it("náhľad vyloženia ukáže páry už s preškolenými akciami (Furt platí aj na novú kartu)", () => {
    const v = k("veducko", RANY);
    const n = nahladVylozenia(d, linia([lezi(v, 0)]), 0, k("rob", ROBOTY), "vlastna");
    expect(n.pary.map((p) => p.moja)).toEqual(["Pecka", "Pecka", "Pecka", "Pecka"]);
    expect(n.zmeny[0]).toEqual({ Pecka: 4, Rana: 4 });
  });
});

// --- Poradie a nereťazenie ---------------------------------------------------------

describe("jedna akcia sa preškolí raz: Nástroj pod kartou → Podpora a Konflikt v poradí spustenia → Furt", () => {
  const d = syntheticData([
    makeDef("x", RANA_PECKA, RANA_PECKA, { tags: ["Občan"] }),
    makeDef("partner", RANY, RANY, { tags: ["Občan"] }),
    makeDef("skol_viera", CIGARETY, CIGARETY, { tags: ["Občan"], triggers: ["Furt"], effectText: "Furt: Preškolenie {Rana}→{Viera}." }),
    makeDef("skol_spat", CIGARETY, CIGARETY, { tags: ["Občan"], triggers: ["Furt"], effectText: "Furt: Preškolenie {Pecka}→{Rana}." }),
    makeDef("puska", EMPTY, EMPTY, { tags: ["Nástroj"], effectText: "Hore: {Rana}→{Petelica}. Dole: {Petelica}→{Rana}." }),
  ]);
  const x = instanceFor(d, "x", RANA_PECKA, RANA_PECKA);
  const sypac = 777001;
  const tiper = 777002;
  const podpora = { z: "Rana", na: "Pecka", od: sypac, spustac: "Podpora" } as const;
  const konflikt = { z: "Rana", na: "Dlh", od: tiper, spustac: "Konflikt" } as const;
  const akcie = (pl: PlacedCard, sused: string) => {
    const r = sused === "partner" ? RANY : CIGARETY;
    const s = instanceFor(d, sused, r, r);
    const ev = evaluateLine(d, linia([pl, lezi(s, 0)]));
    return { ev, slot: sloty(ev, x.uid)[0] };
  };

  it("Nástroj vyhrá nad Podporou aj Furt; Podpora nad Furt; Furt, keď nič iné", () => {
    const puska = instanceFor(d, "puska", EMPTY, EMPTY);
    const sNastrojom = akcie(lezi(x, 0, { preskolenia: [podpora], podlozene: [{ card: puska, majitel: 1, hrana: "horna" }] }), "skol_viera");
    expect(sNastrojom.slot).toMatchObject({ action: "Petelica", povodna: "Rana", preskolil: puska.uid });
    expect(sNastrojom.ev.cards.get(x.uid)?.preskolena?.map((p) => p.zdroj)).toEqual(["Nástroj"]);
    expect(akcie(lezi(x, 0, { preskolenia: [podpora] }), "skol_viera").slot).toMatchObject({ action: "Pecka", povodna: "Rana", preskolil: sypac });
    expect(akcie(lezi(x, 0), "skol_viera").slot).toMatchObject({ action: "Viera", povodna: "Rana" });
  });

  it("Podpora a Konflikt v poradí spustenia — prvá vyhrá", () => {
    expect(akcie(lezi(x, 0, { preskolenia: [konflikt, podpora] }), "partner").slot).toMatchObject({ action: "Dlh", preskolil: tiper });
    expect(akcie(lezi(x, 0, { preskolenia: [podpora, konflikt] }), "partner").slot).toMatchObject({ action: "Pecka", preskolil: sypac });
  });

  it("nereťazí sa: Rana → Pecka a Pecka → Rana dajú z Rany Pecku a z Pecky Ranu", () => {
    const { ev } = akcie(lezi(x, 0, { preskolenia: [podpora] }), "skol_spat");
    expect(sloty(ev, x.uid).map((s) => [s.povodna, s.action])).toEqual(
      Array.from({ length: 4 }, () => [
        ["Rana", "Pecka"],
        ["Pecka", "Rana"],
      ]).flat(),
    );
  });
});

// --- Akcie navyše dotknutej karty --------------------------------------------------

describe("preškolenie mení aj akcie navyše dotknutej karty; Nástroj len hrany (§12)", () => {
  const inst = (defId: string, uid: number): CardInstance => ({ uid, defId, leftLayout: 0, rightLayout: 0 });

  it("Živnostník (Spoločník: Autorita {Robota}) vedľa Vedúcka: Robota navyše je Pecka — v súčtoch aj v pečati", () => {
    const v = inst("veducko", 1);
    const ziv = inst("zivnostnik", 2);
    const ev = evaluateLine(buduca, linia([lezi(v, 0), lezi(ziv, 0)]));
    expect(ev.cards.get(ziv.uid)?.navyse?.[0]).toMatchObject({ krat: 1, akcie: ["Robota"], ako: ["Pecka"], akoOd: [v.uid] });
    expect(ev.zdroje[0].Pecka?.some((z) => z.uid === ziv.uid && z.dovody[0]?.startsWith("akcia navyše") === true && z.dovody.includes("karta:veducko"))).toBe(true);
    expect(ev.zdroje[0].Robota?.some((z) => z.uid === ziv.uid && z.dovody[0]?.startsWith("akcia navyše") === true)).not.toBe(true);
  });

  it("Fúrik dolnou hranou ({Robota}→{Hazard}) pod Živnostníkom: hrany Hazard, Robota navyše od Vedúcka Pecka", () => {
    const v = inst("veducko", 1);
    const ziv = inst("zivnostnik", 2);
    const furik = inst("furik", 3);
    const ev = evaluateLine(buduca, linia([lezi(v, 0), lezi(ziv, 0, { podlozene: [{ card: furik, majitel: 1, hrana: "dolna" }] })]));
    expect(ev.cards.get(ziv.uid)?.navyse?.[0]?.ako).toEqual(["Pecka"]);
    for (const x of sloty(ev, ziv.uid)) if (x.povodna === "Robota") expect(x).toMatchObject({ action: "Dlh", preskolil: furik.uid });
    const zdroje = ev.cards.get(ziv.uid)?.preskolena ?? [];
    expect(zdroje.map((p) => p.zdroj).sort()).toEqual(["Furt", "Nástroj"]);
  });
});

// --- Podpora a Konflikt v motore -------------------------------------------------------

const zaklad = buduca;
const syn = [
  makeDef("kulturista", RANY, RANY, { tags: ["Občan", "Influencer", "Chlap"], triggers: ["Podpora"], effectText: SYPAC }),
  makeDef("anonymny_alkoholik", RANY, RANY, { tags: ["Občan", "Závislý", "Chlap"], triggers: ["Podpora"], effectText: AA }),
  makeDef("profesionalny_tiper", RANY, RANY, { tags: ["Občan", "Závislý", "Chlap"], triggers: ["Konflikt"], effectText: TIPER }),
  makeDef("s_zena", RANY, RANY, { tags: ["Občan", "Žena"] }),
  makeDef("s_cig", CIGARETY, CIGARETY, { tags: ["Občan", "Chlap"] }),
  makeDef("s_pecen", PECEN, PECEN, { tags: ["Občan", "Chlap"] }),
];
const data: GameData = buildGameData(new Map([...zaklad.cards, ...syn.map((x) => [x.id, x] as const)]), zaklad.elders, {
  scorecards: zaklad.scorecards,
  body: parseScorecards(scorecardsJson).body,
});
const ROZ: Record<string, Layout4> = { kulturista: RANY, anonymny_alkoholik: RANY, profesionalny_tiper: RANY, s_zena: RANY, s_cig: CIGARETY, s_pecen: PECEN };
const karta = (id: string): CardInstance => {
  const r = ROZ[id];
  return r === undefined ? { uid: ++uidSeq, defId: id, leftLayout: 0, rightLayout: 0 } : instanceFor(data, id, r, r);
};
let uidSeq = 970000;

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
const naKarte = (s: Pick<GameState, "strany">, uid: number): PlacedCard => s.strany.flat().find((pl) => pl.card.uid === uid)!;

describe("Podpora — tvoja karta, s ktorou sa Školiteľ stretne priložením, do konca kola (Sypač, Anonymný alkoholik)", () => {
  it("Sypač priložený k tvojej Žene: tá má Rany ako Pecky (tag Chlap padol); log to povie", () => {
    const zena = lezi(karta("s_zena"), 0);
    const syp = karta("kulturista");
    const { state: po, events } = priloz(zhromazdenie([[zena], []], [syp]), syp.uid);
    expect(naKarte(po, zena.card.uid).preskolenia).toEqual([{ z: "Rana", na: "Pecka", od: syp.uid, spustac: "Podpora" }]);
    expect(events.some((e) => e.type === "log" && /^Podpora — Preškolenie: .* pri karte .*: tá má do konca kola Rana ako Pecka\.$/.test(e.text))).toBe(true);
    // Rany Ženy idú do súčtov ako Pecky.
    expect(sloty(evaluateLine(data, lineState(po)), zena.card.uid).every((x) => x.action === "Pecka" && x.povodna === "Rana")).toBe(true);
  });

  it("Anonymný alkoholik: tvoja karta s pečeňou má Vieru; súperova karta nič (to by bol Konflikt)", () => {
    const moja = lezi(karta("s_pecen"), 0);
    const aa = karta("anonymny_alkoholik");
    const po = priloz(zhromazdenie([[moja], []], [aa]), aa.uid).state;
    expect(naKarte(po, moja.card.uid).preskolenia).toEqual([{ z: "PoškodeniePečene", na: "Viera", od: aa.uid, spustac: "Podpora" }]);
    expect(evaluateLine(data, lineState(po)).sums[0].PoškodeniePečene ?? 0).toBe(0);
    const cudzia = lezi(karta("s_pecen"), 1);
    const aa2 = karta("anonymny_alkoholik");
    expect(naKarte(priloz(zhromazdenie([[cudzia], []], [aa2]), aa2.uid).state, cudzia.card.uid).preskolenia).toBeUndefined();
  });

  it("každé spustenie ďalšia karta; tá istá dvojica druhý raz nič nové; náhľad (sPrilozenou) vidí to isté ako motor", () => {
    const syp = lezi(karta("kulturista"), 0);
    const zena = karta("s_zena");
    const po = priloz(zhromazdenie([[syp], []], [zena]), zena.uid).state;
    const raz = naKarte(po, zena.uid);
    expect(raz.preskolenia).toHaveLength(1);
    expect(preskoleniaPoSpoji(data, "Podpora", syp, raz)).toEqual(raz.preskolenia);
    expect(preskoleniaPoSpoji(data, "Konflikt", syp, raz)).toBeNull();
    const s = zhromazdenie([[syp], []], [zena]);
    expect(naKarte(sPrilozenou(data, s, 0, zena, 0), zena.uid).preskolenia).toEqual(raz.preskolenia);
    expect(spustiSpoj(data, "Podpora", syp, lezi(zena, 0))).toBe(true);
  });
});

describe("Konflikt — súperova karta, s ktorou sa Školiteľ stretne priložením (Profesionálny tipér)", () => {
  it("Tipér priložený k súperovej karte: jej Cigarety sú do konca kola Hazard súpera; k vlastnej nič", () => {
    const cudzia = lezi(karta("s_cig"), 1);
    const tip = karta("profesionalny_tiper");
    const pred = zhromazdenie([[cudzia], []], [tip]);
    const po = priloz(pred, tip.uid).state;
    expect(naKarte(po, cudzia.card.uid).preskolenia).toEqual([{ z: "Cigareta", na: "Dlh", od: tip.uid, spustac: "Konflikt" }]);
    const ev = evaluateLine(data, lineState(po));
    // Z karty už žiadna Cigareta, Hazard áno (hrana lokality ostáva, ako je).
    expect((ev.zdroje[1].Cigareta ?? []).some((z) => z.uid === cudzia.card.uid)).toBe(false);
    expect((ev.zdroje[1].Dlh ?? []).filter((z) => z.uid === cudzia.card.uid).reduce((n, z) => n + z.hodnota, 0)).toBeGreaterThanOrEqual(4);
    expect(ev.cards.get(tip.uid)?.skolitel).toEqual([{ spustac: "Konflikt", z: "Cigareta", na: "Dlh", ku: [cudzia.card.uid], akcii: 8 }]);
    const moja = lezi(karta("s_cig"), 0);
    const tip2 = karta("profesionalny_tiper");
    expect(naKarte(priloz(zhromazdenie([[moja], []], [tip2]), tip2.uid).state, moja.card.uid).preskolenia).toBeUndefined();
  });

  it("aj keď súper priloží svoju kartu k Tipérovi (Konflikt oboma smermi, §16)", () => {
    const tip = lezi(karta("profesionalny_tiper"), 0);
    const cig = karta("s_cig");
    const s = zhromazdenie([[tip], []], []);
    const s1: GameState = { ...s, hraci: [s.hraci[0], { ...s.hraci[1], ruka: [cig] }] as unknown as GameState["hraci"], zhromazdenieStav: { ...s.zhromazdenieStav!, naTahu: 1 } };
    const po = apply(data, s1, { type: "place", uid: cig.uid, target: "superova" }, 1).state;
    expect(naKarte(po, cig.uid).preskolenia).toEqual([{ z: "Cigareta", na: "Dlh", od: tip.card.uid, spustac: "Konflikt" }]);
  });
});

// --- Šofér a Traktorista -------------------------------------------------------------

function pitkaStav(naTahu: PlayerId): PitkaStav {
  return { naTahu, hotovy: [false, false], naexPouzity: [false, false], fajcenie: [0, 0], reakcia: null, postarka: [false, false], starosta: [false, false], naexPocet: [0, 0] };
}

/** Posledná Pitka kola na Moste s danou líniou (budúca sada). */
function vPitke(strany: GameState["strany"], pitkyCelkom = 1): GameState {
  const s0 = setupGame(buduca, 7);
  const lokalita = s0.lokalityVHre.find((k) => k.defId === "most")!;
  const hraci = s0.hraci.map((h) => ({ ...h, cigarety: 5 })) as unknown as GameState["hraci"];
  return { ...s0, hraci, faza: "pitka", utocnik: 1, ciel: { typ: "lokalita", lokalita }, lokalityVHre: s0.lokalityVHre.filter((k) => k !== lokalita), strany, pitkyCelkom, pitkaCislo: 1, pitkaStav: pitkaStav(0) };
}

/** Obaja dohrajú Pitku bez NA EX — udalosti až po začiatok bitky či ďalšie Zhromaždenie. */
function dohrajPitku(s0: GameState): { readonly s: GameState; readonly events: Event[] } {
  let s = s0;
  const events: Event[] = [];
  for (let i = 0; i < 8 && s.faza === "pitka"; i++) {
    const q = ([0, 1] as const).find((x) => legalCommands(buduca, s, x).some((c) => c.type === "skipNaex" || c.type === "bezReakcie"));
    if (q === undefined) break;
    const r = apply(buduca, s, legalCommands(buduca, s, q).find((c) => c.type === "skipNaex" || c.type === "bezReakcie")!, q);
    s = r.state;
    events.push(...r.events);
  }
  return { s, events };
}

const inst = (defId: string): CardInstance => ({ uid: ++uidSeq, defId, leftLayout: 0, rightLayout: 0 });

describe("Šofér: Bitka: Ak si v tomto kole nedal NA EX {Pecka} {Rana}", () => {
  it("bez NA EX Pecka a Rana navyše v súčtoch; cigareta na začiatku bitky zanikla", () => {
    const sofer = inst("sofer");
    const s = vPitke([[lezi(sofer, 0)], []]);
    const { s: b } = dohrajPitku(s);
    expect(b.faza).toBe("bitka");
    expect(evaluateLine(buduca, lineState(b)).cards.get(sofer.uid)?.navyse?.[0]).toMatchObject({ krat: 1, akcie: ["Pecka", "Rana"] });
    expect(b.hraci[0].cigarety).toBe(s.hraci[0].cigarety);
    expect(evaluateLine(buduca, lineState({ ...b, naexVKole: [true, false] })).cards.get(sofer.uid)?.navyse?.[0]?.krat).toBe(0);
  });
});

describe("Traktorista: Posledná Pitka kola: Bez prevahy v jeho kraji {Dlh} — prevaha po otočení Záverečných", () => {
  const bezPrevahy = (t: CardInstance): GameState["strany"] => [[lezi(t, 0), lezi(inst("masiar"), 1), lezi(inst("vandal"), 1)], []];
  const dlhLog = (events: readonly Event[]) => events.filter((e) => e.type === "log" && /posledná Pitka kola, Hazard navyše: Dlh/.test(e.text)).length;

  it("bez prevahy v jeho kraji dá na konci poslednej Pitky Dlh; s prevahou nie (vtedy Pecka v bitke)", () => {
    const t = inst("traktoristka");
    expect(dlhyPoslednejPitky(buduca, lineState(vPitke(bezPrevahy(t))))).toEqual([{ uid: t.uid, defId: "traktoristka", hrac: 0, dlhy: 1 }]);
    const bez = dohrajPitku(vPitke(bezPrevahy(t)));
    expect(dlhLog(bez.events)).toBe(1);
    const t2 = inst("traktoristka");
    const s = vPitke([[lezi(t2, 0)], []]);
    expect(dlhyPoslednejPitky(buduca, lineState(s))).toEqual([]);
    const sPrev = dohrajPitku(s);
    expect(dlhLog(sPrev.events)).toBe(0);
    expect(evaluateLine(buduca, lineState(sPrev.s)).cards.get(t2.uid)?.navyse?.map((e) => e.krat)).toEqual([1, 0]);
  });

  it("v skoršej Pitke kola nič; pečať Posledná Pitka kola svieti len v poslednej; náhľad Dlhov s ním ráta", () => {
    const t = inst("traktoristka");
    const prva = vPitke(bezPrevahy(t), 2);
    expect(evaluateLine(buduca, lineState(prva)).cards.get(t.uid)?.navyse?.[1]?.krat).toBe(0);
    expect(evaluateLine(buduca, lineState(vPitke(bezPrevahy(t)))).cards.get(t.uid)?.navyse?.[1]?.krat).toBe(1);
    // Náhľad Dlhov do bitky: o 1 viac, než keby Traktorista mal prevahu.
    const t2 = inst("traktoristka");
    const sPrev = vPitke([[lezi(t2, 0), lezi(inst("masiar"), 1)], []]);
    const bez = vPitke([[lezi(t2, 0), lezi(inst("masiar"), 1), lezi(inst("vandal"), 1)], []]);
    expect(vyhladDlhov(buduca, bez, 0)[0].nove - vyhladDlhov(buduca, sPrev, 0)[0].nove).toBe(1);
  });
});

// --- Výučba a boti na budúcej sade ---------------------------------------------------------

describe("budúca sada v hre", () => {
  it("výučba Prvá hra prejde aj na budúcej sade — koniec 56 : 15 ako na dnešnej", () => {
    const scenar = scenarJson as unknown as ScenarVyucby;
    expect(overScenar(buduca, scenar)).toBeNull();
    const koniec = prehrajVyucbu(buduca, scenar, scenar.kroky.length).koniec;
    expect(koniec?.vitaz).toBe(0);
    expect(koniec?.body).toEqual([56, 15]);
  });

  it("partia dvoch botov na budúcej sade dobehne do konca", () => {
    let s = setupGame(buduca, 31, { lokalit: 3 });
    for (let n = 0; n < 4000 && s.koniec === null; n++) {
      const kto = naTahu(s);
      if (kto === null) break;
      s = apply(buduca, s, tahBota(buduca, s, kto, 31 * 7 + n), kto).state;
    }
    expect(s.koniec).not.toBeNull();
  }, 120000);
});

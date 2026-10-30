// Chuť a Absťák v3 (pravidlá v9.1, Michal 2026-10-30, docs/napady/abstak-3-zadanie.md):
// Chuť je verejná latka nerestí hráča; kto v kole vypije a vyfajčí menej, dostane kartu
// Absťák do odhadzovacieho balíčka, potom Chuť = väčšie z (Chuť, neresti) − 1. Absťák je
// Kliatba, ktorá sa nedá priznať; −1 tuhé za každú kartu kdekoľvek v balíčku. Očakávané
// hodnoty sú z textu pravidiel.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import prvaHra from "../data/vyucba/prva-hra.json";
import type { BitkaStav, CardInstance, GameState, PitkaStav, PlayerId, PlayerState, Rozdanie } from "../src/index.ts";
import {
  KONSTANTY,
  apply,
  battleOutcome,
  legalCommands,
  loadGameData,
  naTahu,
  pocetAbstakov,
  poskodenieBitky,
  setupGame,
  setupZRozdania,
  stavZavislosti,
  viewFor,
} from "../src/index.ts";
import { setupSBalickom } from "./helpers.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);
let uidSeq = 970000;
const inst = (defId: string): CardInstance => ({ uid: ++uidSeq, defId, leftLayout: 0, rightLayout: 0 });
const kusy = (n: number, defId: string): CardInstance[] => Array.from({ length: n }, () => inst(defId));

function sHracom(s: GameState, p: PlayerId, h: Partial<PlayerState>): GameState {
  const hraci = [...s.hraci] as [PlayerState, PlayerState];
  hraci[p] = { ...hraci[p], ...h };
  return { ...s, hraci };
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

/** Bitka v kroku Cintorína (2. kolo) — „nič“ ju dokončí a príde koniec kola. */
function predKoncomKola(seed: number, uprav: (s: GameState) => GameState = (s) => s, finale = false): GameState {
  const s0 = setupSBalickom(data, seed);
  const lokalita = s0.lokalityVHre[0]!;
  return uprav({
    ...s0,
    faza: "bitka",
    kolo: 2,
    strany: [[], []],
    ciel: finale ? { typ: "finale", lokalita } : { typ: "lokalita", lokalita },
    lokalityVHre: s0.lokalityVHre.slice(1),
    bitkaStav: bitka({ krok: "cintorin", caka: 0 }),
  });
}
const koniecKola = (s: GameState): GameState => apply(data, s, { type: "cintorin", uid: null }, 0).state;

function pitkaStav(naTahuHrac: PlayerId): PitkaStav {
  return { naTahu: naTahuHrac, hotovy: [false, false], naexPouzity: [false, false], fajcenie: [0, 0], reakcia: null, postarka: [false, false], starosta: [false, false], naexPocet: [0, 0], vykup: [false, false] };
}

describe("§8 Chuť: koniec kola (v9.1)", () => {
  it("menej nerestí než Chuť → karta Absťák do odhadzovacieho balíčka; Chuť = väčšie z (Chuť, neresti) − 1", () => {
    const s = predKoncomKola(1, (x) => sHracom(x, 0, { chut: 3, nerestiTotoKolo: 1, abstakyZiskane: 0 }));
    const r = apply(data, s, { type: "cintorin", uid: null }, 0);
    const h = r.state.hraci[0];
    expect(h.odhadzovaci.filter((k) => k.defId === "abstak")).toHaveLength(1);
    expect(pocetAbstakov(h)).toBe(1);
    expect(h.abstakyZiskane).toBe(1);
    expect(h.chut).toBe(2);
    expect(h.nerestiTotoKolo).toBe(0);
    const logy = r.events.flatMap((e) => (e.type === "log" ? [e.text] : []));
    expect(logy.some((t) => t.startsWith("Hráč 1 dostáva Absťák do odhadzovacieho balíčka: Chuť 3"))).toBe(true);
    expect(logy).toContain("Chuť hráča 1: 3 → 2.");
  });

  it("rovnako ako Chuť → nič; viac → Chuť rastie (Michalov príklad: 9 nerestí → 8, potom 7 → Absťák a 8 − 1)", () => {
    const rovnako = koniecKola(predKoncomKola(2, (x) => sHracom(x, 0, { chut: 2, nerestiTotoKolo: 2 })));
    expect(pocetAbstakov(rovnako.hraci[0])).toBe(0);
    expect(rovnako.hraci[0].chut).toBe(1);
    const flam = koniecKola(predKoncomKola(3, (x) => sHracom(x, 0, { chut: 0, nerestiTotoKolo: 9 })));
    expect(flam.hraci[0].chut).toBe(8);
    expect(pocetAbstakov(flam.hraci[0])).toBe(0);
    const potom = koniecKola(predKoncomKola(4, (x) => sHracom(x, 0, { chut: 8, nerestiTotoKolo: 7 })));
    expect(pocetAbstakov(potom.hraci[0])).toBe(1);
    expect(potom.hraci[0].chut).toBe(7);
    // Chuť neklesne pod 0.
    expect(koniecKola(predKoncomKola(5)).hraci.map((h) => h.chut)).toEqual([0, 0]);
  });

  it("súper latku neurčuje — kolo bez nerestí s Chuťou 0 nič nedá, aj keď súper flámoval", () => {
    const s = koniecKola(predKoncomKola(6, (x) => sHracom(sHracom(x, 1, { nerestiTotoKolo: 5 }), 0, { chut: 0, nerestiTotoKolo: 0 })));
    expect(pocetAbstakov(s.hraci[0])).toBe(0);
    expect(s.hraci[1].chut).toBe(4);
  });

  it("po poslednej bitke hry (finále) sa Chuť ani Absťák nerieši", () => {
    const s = koniecKola(predKoncomKola(7, (x) => sHracom(x, 0, { chut: 4, nerestiTotoKolo: 0 }), true));
    expect(s.koniec).not.toBeNull();
    expect(pocetAbstakov(s.hraci[0])).toBe(0);
    expect(s.hraci[0].chut).toBe(4);
  });

  it("partia bez Chuti (výučba Prvá hra): koniec kola Absťák nedá; rozdanie výučby ju zakladá bez Chuti", () => {
    const s = predKoncomKola(8, (x) => ({ ...sHracom(x, 0, { chut: 3, nerestiTotoKolo: 0 }), bezChuti: true }));
    const po = koniecKola(s);
    expect(pocetAbstakov(po.hraci[0])).toBe(0);
    expect(po.hraci[0].chut).toBe(3);
    expect(setupGame(data, 1, { bezChuti: true }).bezChuti).toBe(true);
    expect(setupGame(data, 1).bezChuti).toBeUndefined();
    expect(setupZRozdania(data, (prvaHra as unknown as { rozdanie: Rozdanie }).rozdanie).bezChuti).toBe(true);
    expect(viewFor(data, s, 1).bezChuti).toBe(true);
  });

  it("Opatrovateľka v línii (Furt): Chuť sa porovnáva o 2 nižšia — ubúda normálne", () => {
    const opatr = (x: GameState): GameState => ({ ...x, strany: [[{ card: inst("opatrovatelka"), playedBy: 0 }], []] });
    const s = koniecKola(predKoncomKola(9, (x) => opatr(sHracom(x, 0, { chut: 3, nerestiTotoKolo: 1 }))));
    expect(pocetAbstakov(s.hraci[0])).toBe(0);
    expect(s.hraci[0].chut).toBe(2);
    // Bez nej Absťák príde; súperova Opatrovateľka nepomáha.
    const cudzia = (x: GameState): GameState => ({ ...x, strany: [[{ card: inst("opatrovatelka"), playedBy: 1 }], []] });
    expect(pocetAbstakov(koniecKola(predKoncomKola(9, (x) => cudzia(sHracom(x, 0, { chut: 3, nerestiTotoKolo: 1 })))).hraci[0])).toBe(1);
  });
});

describe("§8 Nerest = len konzumácia (v9.1)", () => {
  it("fajčenie 1 za každú cigaretu; doliatie, barter, Dedičstvo ani šenok nie", () => {
    const s0 = setupSBalickom(data, 11);
    let s: GameState = sHracom({ ...s0, faza: "pitka", utocnik: 0, pitkyCelkom: 1, pitkaCislo: 1, pitkaStav: pitkaStav(0) }, 0, { cigarety: 12, poldeciVypite: 1, nerestiTotoKolo: 0 });
    s = apply(data, s, { type: "refillPoldeci" }, 0).state;
    expect(s.hraci[0].nerestiTotoKolo).toBe(0);
    s = apply(data, s, { type: "barter" }, 0).state;
    expect(s.hraci[0].nerestiTotoKolo).toBe(0);
    s = apply(data, s, { type: "smoke", pocet: 1 }, 0).state;
    expect(s.hraci[0].nerestiTotoKolo).toBe(1);
    // Druhé fajčenie v Pitke stojí 2 cigarety — 2 neresti.
    s = apply(data, s, { type: "smoke", pocet: 1 }, 0).state;
    expect(s.hraci[0].nerestiTotoKolo).toBe(1 + 2);
  });

  it("Vypiť v Zhromaždení 1, NA EX 2 (vypije sa v bitke) — výhľad v bare ráta NA EX na stole za 2", () => {
    const s0 = setupSBalickom(data, 12);
    const z = sHracom({ ...s0, faza: "zhromazdenie", utocnik: 0, pitkyCelkom: 1, pitkaCislo: 0, zhromazdenieStav: { naTahu: 0, zostavaLimit: [3, 3], pasoval: [false, false], navyse: [0, 0] } }, 0, { poldeciPlne: 2 });
    expect(apply(data, z, { type: "vypit" }, 0).state.hraci[0].nerestiTotoKolo).toBe(1);
    const naStole: GameState = { ...sHracom(s0, 0, { chut: 4 }), strany: [[{ card: inst("pijan"), playedBy: 0, naexBy: 0 }], []] };
    const zav = stavZavislosti(data, { ...naStole, kolo: 2 }, 0);
    expect(zav.teraz).toBe(KONSTANTY.NEREST_NAEX);
    expect(zav.vyhlad).toBe("ziska");
    expect(zav.doBezpecia).toBe(4 - KONSTANTY.NEREST_NAEX);
    expect(zav.chutPo).toBe(3);
  });
});

describe("§9.3 a §9.4 Absťák v bitke (v9.1)", () => {
  it("−1 tuhé za každú kartu Absťák kdekoľvek v balíčku (ruka, doberací, odhadzovací); Pohoršenie nedáva", () => {
    const s0 = setupSBalickom(data, 13);
    const s = sHracom(s0, 0, { ruka: [...s0.hraci[0].ruka, inst("abstak")], doberaci: [...s0.hraci[0].doberaci, inst("abstak")], odhadzovaci: [inst("abstak")] });
    expect(poskodenieBitky(data, s, [{ Rana: 5 }, {}]).tuhe[0]).toBe(5 - 3);
    expect(poskodenieBitky(data, s0, [{ Rana: 5 }, {}]).tuhe[0]).toBe(5);
  });

  it("remízu v tuhom prehráva, kto má viac Absťákov — v partii z kariet v balíčku", () => {
    expect(battleOutcome(poskodenieBitky(data, setupGame(data, 1), [{}, {}]), { abstaky: [2, 1], dlhy: [0, 0] })).toMatchObject({ vitaz: 1, rozhodlo: "abstak" });
    // Prázdna línia 0 : 0, hráč 1 má Absťák v doberacom balíčku → bitku vyhrá súper.
    const s0 = setupSBalickom(data, 14);
    let s: GameState = sHracom({ ...s0, faza: "pitka", utocnik: 0, strany: [[], []], ciel: { typ: "lokalita", lokalita: s0.lokalityVHre[0]! }, lokalityVHre: s0.lokalityVHre.slice(1), pitkyCelkom: 1, pitkaCislo: 1, pitkaStav: pitkaStav(1) }, 0, {
      doberaci: [...s0.hraci[0].doberaci, inst("abstak")],
    });
    for (let i = 0; i < 4 && s.faza === "pitka"; i++) s = apply(data, s, { type: "skipNaex" }, naTahu(s)!).state;
    expect(s.nastenka.at(-1)).toMatchObject({ vitaz: 1, rozhodlo: "abstak" });
  });
});

describe("§9.7 a §11 Karta Absťák (v9.1)", () => {
  it("§9.7: Absťák z ruky ide po bitke do odhadzovacieho balíčka", () => {
    const a = inst("abstak");
    const s = koniecKola(predKoncomKola(15, (x) => sHracom(x, 0, { ruka: [...x.hraci[0].ruka, a] })));
    expect(s.hraci[0].ruka.some((k) => k.uid === a.uid)).toBe(false);
    expect(s.hraci[0].odhadzovaci.some((k) => k.uid === a.uid)).toBe(true);
  });

  it("§11: Absťák sa nedá priznať ani vyložiť", () => {
    const s0 = setupSBalickom(data, 16);
    const a = inst("abstak");
    const z = sHracom({ ...s0, faza: "zhromazdenie", utocnik: 0, pitkyCelkom: 1, pitkaCislo: 0, zhromazdenieStav: { naTahu: 0, zostavaLimit: [3, 3], pasoval: [false, false], navyse: [0, 0] } }, 0, { ruka: [a, ...s0.hraci[0].ruka] });
    expect(legalCommands(data, z, 0).some((c) => c.type === "place" && c.uid === a.uid)).toBe(false);
    for (const target of ["priznanie", "vlastna", "superova"] as const) expect(() => apply(data, z, { type: "place", uid: a.uid, target }, 0)).toThrow();
  });

  it("§11: Vízia ho smie zahodiť z hry; Kar zahodí Absťák z ruky ako Cirhózu", () => {
    const s0 = setupSBalickom(data, 17);
    const a = inst("abstak");
    const v: GameState = sHracom({ ...s0, faza: "pitka", utocnik: 0, pitkyCelkom: 1, pitkaCislo: 1, pitkaStav: null, vizia: { zostava: [1, 0] } as GameState["vizia"] }, 0, { doberaci: [a, ...s0.hraci[0].doberaci] });
    const po = apply(data, v, { type: "vizia", vziat: false }, 0).state;
    expect(pocetAbstakov(po.hraci[0])).toBe(0);
    const k = inst("abstak");
    const kar = predKoncomKola(18, (x) => ({ ...sHracom(x, 0, { ruka: [...x.hraci[0].ruka, k] }), bitkaStav: bitka({ krok: "kar", caka: 0, karHotovy: [false, true] }) }));
    expect(legalCommands(data, kar, 0)).toContainEqual({ type: "kar", uid: k.uid });
    expect(pocetAbstakov(apply(data, kar, { type: "kar", uid: k.uid }, 0).state.hraci[0])).toBe(0);
  });

  it("viewFor: počet Absťákov oboch je verejný, poloha karty v ruke a doberacom balíčku nie", () => {
    const s0 = setupSBalickom(data, 19);
    const vRuke = inst("abstak");
    const vBalicku = inst("abstak");
    const s = sHracom(s0, 0, { ruka: [...s0.hraci[0].ruka, vRuke], doberaci: [vBalicku, ...s0.hraci[0].doberaci], chut: 2 });
    const super_ = viewFor(data, s, 1);
    expect(super_.hraci[0].abstaky).toBe(2);
    expect(super_.hraci[0].chut).toBe(2);
    const json = JSON.stringify(super_);
    expect(json).not.toContain(`"uid":${vRuke.uid}`);
    expect(json).not.toContain(`"uid":${vBalicku.uid}`);
    // Výhľad v bare je z pohľadu rovnaký ako zo stavu.
    expect(stavZavislosti(data, { ...super_, kolo: 2 }, 0)).toEqual(stavZavislosti(data, { ...s, kolo: 2 }, 0));
  });
});

describe("§14 Koniec hry: Absťák nestojí nič", () => {
  it("karta Absťák v balíčku na konci hry špaky neuberá", () => {
    const bez = koniecKola(predKoncomKola(20, (x) => x, true));
    const s = koniecKola(predKoncomKola(20, (x) => sHracom(x, 0, { odhadzovaci: kusy(3, "abstak") }), true));
    expect(s.koniec?.body?.[0]).toBe(bez.koniec?.body?.[0]);
  });
});

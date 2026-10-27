// Rozhodca 2026-10-27, roadmapa #54 „Medzery a nejasné vety v pravidlách“ (návrh #7),
// pravidlá v6.2. Medzery z playtestov 20261027-062058, 20261027-105422 a nočných
// nezrovnalostí 20261026-*. Očakávané hodnoty sú z textu docs/PRAVIDLA.md (§ v názve
// testu), nie z kódu; čo text nerozhodne, je v mape ako „nejasne“ a test tu nie je.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { CardDef, CardInstance, GameData, GameState, PlacedCard, PlayerId } from "../src/index.ts";
import { apply, buildGameData, evaluateLine, lineState, loadGameData, parseScorecards, pocetPitiek, setupGame, viewFor } from "../src/index.ts";
import type { Layout4 } from "./helpers.ts";
import { EMPTY, instanceFor, makeDef, setupSBalickom } from "./helpers.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

function sadaS(...defs: CardDef[]): GameData {
  const cards = new Map(data.cards);
  for (const d of defs) cards.set(d.id, d);
  return buildGameData(cards, data.elders, parseScorecards(scorecardsJson));
}

const lezi = (card: CardInstance, playedBy: PlayerId): PlacedCard => ({ card, playedBy });

// --- §7 Počet Pitiek -----------------------------------------------------------

// Lokalita: hrana pri strane hráča 0 má 3 Rany, hrana pri strane hráča 1 tri Rany.
const LOK_L: Layout4 = ["Rana", "Rana", "Rana", null];
const LOK_P: Layout4 = ["Rana", "Rana", "Rana", null];
const lok = makeDef("medz_lok", LOK_L, LOK_P, { tags: ["Lokalita"] });
// Karta hráča 0 na jeho strane: vnútorná (pravá) hrana proti ľavej hrane lokality.
const vlastnaTri = makeDef("medz_vlastna_tri", EMPTY, ["Rana", "Rana", "Rana", null]);
// Karta hráča 1 podstrčená na stranu hráča 0 (natočená k hráčovi 1): k lokalite smeruje
// jeho vytlačená ľavá hrana čítaná odzadu.
const cudziaTri = makeDef("medz_cudzia_tri", [null, "Rana", "Rana", "Rana"], EMPTY);
// Karta hráča 1 na jeho strane: vytlačená pravá hrana čítaná odzadu (index 2 → 1).
const supJeden = makeDef("medz_sup_jeden", EMPTY, [null, null, "Rana", null]);
const supDva = makeDef("medz_sup_dva", EMPTY, [null, "Rana", "Rana", null]);
// Posilnenie na vnútornej hrane karty hráča 0 proti Rane lokality na indexe 0.
const posilnovac = makeDef("medz_posil", EMPTY, ["Posilnenie", null, null, null]);
const sadaP = sadaS(lok, vlastnaTri, cudziaTri, supJeden, supDva, posilnovac);

const ROZLOZENIA: Readonly<Record<string, readonly [Layout4, Layout4]>> = {
  medz_vlastna_tri: [EMPTY, ["Rana", "Rana", "Rana", null]],
  medz_cudzia_tri: [[null, "Rana", "Rana", "Rana"], EMPTY],
  medz_sup_jeden: [EMPTY, [null, null, "Rana", null]],
  medz_sup_dva: [EMPTY, [null, "Rana", "Rana", null]],
  medz_posil: [EMPTY, ["Posilnenie", null, null, null]],
};

const k = (id: string): CardInstance => {
  const r = ROZLOZENIA[id];
  if (r === undefined) throw new Error(id);
  return instanceFor(sadaP, id, r[0], r[1]);
};

function vZhromazdeni(strany: GameState["strany"]): GameState {
  const s0 = setupSBalickom(sadaP, 62);
  return {
    ...s0,
    faza: "zhromazdenie",
    utocnik: 0,
    ciel: { typ: "lokalita", lokalita: instanceFor(sadaP, "medz_lok", LOK_L, LOK_P) },
    lokalitaOtocena: false,
    strany,
    pitkyCelkom: 1,
    pitkaCislo: 0,
    zhromazdenieStav: { naTahu: 1, zostavaLimit: [0, 0], pasoval: [false, false], navyse: [0, 0] },
  };
}

describe("§7 Počet Pitiek: ráta sa podľa strán lokality, nie podľa hráčov (rozhodca 2026-10-27)", () => {
  it("§7: akcie hrany aktivované podstrčenou kartou sa rátajú strane, kde karta leží — 3 a 1 → 2 Pitky", () => {
    // Pravidlo: „1 + menší z počtov aktivovaných akcií lokality na jej dvoch stranách“.
    // Obe karty zahral hráč 1 — po hráčoch by bolo 0 : 4 → 1 Pitka, po stranách 3 : 1 → 2.
    const s = vZhromazdeni([[lezi(k("medz_cudzia_tri"), 1)], [lezi(k("medz_sup_jeden"), 1)]]);
    expect(evaluateLine(sadaP, lineState(s)).aktivneStredu).toEqual([3, 1]);
    expect(pocetPitiek(sadaP, s)).toBe(2);
  });

  it("§7: akcia hrany zdvojená Posilnením je jedna aktivovaná akcia — 1 a 2 → 2 Pitky, nie 3", () => {
    // Pravidlo: „ráta sa každá aktívna akcia hrany“ — počíta sa akcia, nie jej násobok.
    const s = vZhromazdeni([[lezi(k("medz_posil"), 0)], [lezi(k("medz_sup_dva"), 1)]]);
    const ev = evaluateLine(sadaP, lineState(s));
    // Rana hrany pri strane hráča 0 je aktívna ×2 (Posilnenie) a dostane ju hráč 0 (prevaha).
    expect(ev.sums[0].Rana).toBe(2);
    expect(ev.aktivneStredu).toEqual([1, 2]);
    expect(pocetPitiek(sadaP, s)).toBe(2);
    // Hranica: bez Posilnenia, s dvomi bežnými spojmi na strane hráča 0 by boli 3 Pitky.
    expect(pocetPitiek(sadaP, vZhromazdeni([[lezi(k("medz_vlastna_tri"), 0)], [lezi(k("medz_sup_dva"), 1)]]))).toBe(3);
  });
});

// --- §2 / §8 Akcia Poldeci v Pitke pridá pečeň ------------------------------------

const lokNic = makeDef("medz_lok_nic", [null, null, null, null], [null, null, null, null], { tags: ["Lokalita"] });
const poldA3 = makeDef("medz_pold_a3", ["Poldeci", "Poldeci", "Poldeci", null], EMPTY);
const poldA2 = makeDef("medz_pold_a2", ["Poldeci", "Poldeci", null, null], EMPTY);
const poldB = makeDef("medz_pold_b", EMPTY, ["Poldeci", "Poldeci", "Poldeci", null]);
const sadaPold = sadaS(lokNic, poldA3, poldA2, poldB);

const kp = (id: string, l: Layout4, r: Layout4): CardInstance => instanceFor(sadaPold, id, l, r);

function pitkaSPoldeci(a: CardInstance): GameState {
  const s = setupGame(sadaPold, 63);
  return {
    ...s,
    faza: "pitka",
    ciel: { typ: "lokalita", lokalita: kp("medz_lok_nic", EMPTY, EMPTY) },
    lokalitaOtocena: false,
    pitkyCelkom: 1,
    pitkaCislo: 1,
    // strany[0] = [a pri lokalite, b] → spoj b.pravá ↔ a.ľavá.
    strany: [[lezi(a, 0), lezi(kp("medz_pold_b", EMPTY, ["Poldeci", "Poldeci", "Poldeci", null]), 0)], []],
    hraci: [
      { ...s.hraci[0], poldeciPlne: 0, cigarety: 0, pecen: 0 },
      { ...s.hraci[1], poldeciPlne: 0, cigarety: 0, pecen: 0 },
    ],
    pitkaStav: { naTahu: 1, hotovy: [false, false], naexPouzity: [false, false], fajcenie: [0, 0], reakcia: null, postarka: [false, false], starosta: [false, false] },
  } as GameState;
}

function cirhozy(s: GameState, p: PlayerId): number {
  const h = s.hraci[p];
  return [...h.ruka, ...h.doberaci, ...h.odhadzovaci, ...h.priznane].filter((c) => c.defId === "cirhoza").length;
}

function dohrajPitku(s: GameState): GameState {
  for (let i = 0; i < 20 && s.faza === "pitka"; i++) {
    const kto = s.pitkaStav?.naTahu ?? 0;
    s = apply(sadaPold, s, s.vizia !== null ? { type: "vizia", vziat: true } : { type: "skipNaex" }, kto).state;
  }
  return s;
}

describe("§2, §8 akcia Poldeci v Pitke pridá poškodenie pečene (nočné nezrovnalosti 20261026)", () => {
  it("§8: každá aktívna akcia Poldeci = pečeň +1 majiteľovi; prah 3 → 6 pečene = 2 Cirhózy, 4 = 1", () => {
    // 3 spojené indexy Poldeci–Poldeci = 6 aktívnych akcií Poldeci hráča 0.
    const po6 = dohrajPitku(pitkaSPoldeci(kp("medz_pold_a3", ["Poldeci", "Poldeci", "Poldeci", null], EMPTY)));
    expect(po6.faza).not.toBe("pitka");
    expect(cirhozy(po6, 0)).toBe(2);
    expect(cirhozy(po6, 1)).toBe(0);
    // Hranica: 2 spoje = 4 pečene → jedna Cirhóza (zvyšok 1 sa po Pitke vynuluje).
    const po4 = dohrajPitku(pitkaSPoldeci(kp("medz_pold_a2", ["Poldeci", "Poldeci", null, null], EMPTY)));
    expect(cirhozy(po4, 0)).toBe(1);
  });
});

// --- §13 Záverečná: ani aktivácia mojej akcie ju neprezradí ---------------------

// Moja karta pri lokalite má na ľavej (vonkajšej) hrane Ranu na indexe 0.
const moja = makeDef("medz_moja_rana", ["Rana", null, null, null], EMPTY);
// Súperova Záverečná na mojej strane (natočená k súperovi): k mojej karte smeruje jej
// vytlačená ľavá hrana čítaná odzadu — index 3 → 0 → pár s mojou Ranou.
const skrytaPar = makeDef("medz_skryta_par", [null, null, null, "Cigareta"], EMPTY);
const skrytaBez = makeDef("medz_skryta_bez", [null, null, null, null], ["Cigareta", null, null, null]);
const sadaZ = sadaS(lokNic, moja, skrytaPar, skrytaBez);

function soZaverecnou(skrytaId: string, l: Layout4, r: Layout4): GameState {
  const s = setupGame(sadaZ, 64);
  const skryta: PlacedCard = { card: { ...instanceFor(sadaZ, skrytaId, l, r), uid: 64999 }, playedBy: 1, zaverecna: true };
  return {
    ...s,
    faza: "pitka",
    ciel: { typ: "lokalita", lokalita: { ...instanceFor(sadaZ, "medz_lok_nic", EMPTY, EMPTY), uid: 64000 } },
    lokalitaOtocena: false,
    pitkyCelkom: 1,
    pitkaCislo: 1,
    strany: [[lezi({ ...instanceFor(sadaZ, "medz_moja_rana", ["Rana", null, null, null], EMPTY), uid: 64001 }, 0), skryta], []],
    pitkaStav: { naTahu: 0, hotovy: [false, false], naexPouzity: [false, false], fajcenie: [0, 0], reakcia: null, postarka: [false, false], starosta: [false, false] },
  } as GameState;
}

describe("§13 Záverečná lícom dole: ráta sa normálne, súper z nej nevidí nič (nočné nezrovnalosti 20261026, ODHAD)", () => {
  it("§13: súperova Záverečná aktivuje moju Ranu v bitke, ale môj pohľad (a odhad z neho) je rovnaký ako bez páru", () => {
    const sPar = soZaverecnou("medz_skryta_par", [null, null, null, "Cigareta"], EMPTY);
    const sBez = soZaverecnou("medz_skryta_bez", EMPTY, ["Cigareta", null, null, null]);
    // „Kým leží lícom dole, ráta sa normálne — akcie, spoje…“: moja Rana je aktívna.
    expect(evaluateLine(sadaZ, lineState(sPar)).sums[0].Rana).toBe(1);
    expect(evaluateLine(sadaZ, lineState(sBez)).sums[0].Rana ?? 0).toBe(0);
    // „Súper z nej nevidí nič … jej príspevok mu ostáva neznámy“ — ani cez aktiváciu mojej akcie.
    expect(JSON.stringify(viewFor(sadaZ, sPar, 0))).toBe(JSON.stringify(viewFor(sadaZ, sBez, 0)));
  });
});

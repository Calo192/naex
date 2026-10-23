// Výučba „Prvá hra“ (Michal 2026-10-23): pevné rozdanie zo scenára, kroky
// s jediným dovoleným príkazom a kontrola, že scenár v jadre prejde.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import scenarJson from "../data/vyucba/prva-hra.json";
import type { Command, GameState, ScenarVyucby } from "../src/index.ts";
import {
  apply,
  legalCommands,
  loadGameData,
  naTahu,
  ocakavanyPrikaz,
  overScenar,
  porovnajSKrokom,
  prehrajVyucbu,
  rngInt,
  rngSeed,
  setupZRozdania,
  textChybyKroku,
  uidZOdkazu,
  zacniVyucbu,
  zhodnyPrikaz,
} from "../src/index.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);
const scenar = scenarJson as unknown as ScenarVyucby;

describe("výučba — scenár", () => {
  it("scenár prva-hra prejde v jadre od začiatku do konca (každý krok legálny, na ťahu ten, komu patrí)", () => {
    expect(overScenar(data, scenar)).toBeNull();
  });

  it("pokračovanie: stav po n krokoch je rovnaký, či sa prehrá naraz alebo po krokoch", () => {
    const n = scenar.kroky.length;
    expect(JSON.stringify(prehrajVyucbu(data, scenar, n))).toBe(JSON.stringify(prehrajVyucbu(data, scenar, n)));
    // Prvý krok hráča: príkaz, ktorý server čaká, dá ten istý stav ako prehratie scenára.
    const prvy = scenar.kroky.findIndex((k) => k.kto === "hrac");
    const pred = prehrajVyucbu(data, scenar, prvy);
    const ocakava = ocakavanyPrikaz(scenar, pred, prvy);
    expect(ocakava).not.toBeNull();
    expect(JSON.stringify(apply(data, pred, ocakava as Command, 0).state)).toBe(JSON.stringify(prehrajVyucbu(data, scenar, prvy + 1)));
  });

  it("chybný scenár ohlási krok, ktorý v jadre neprejde", () => {
    const zly: ScenarVyucby = {
      ...scenar,
      kroky: [{ id: "zly", kto: "hrac", prikaz: { type: "pass" }, melichar: "" }],
    };
    expect(overScenar(data, zly)).toMatch(/Krok 0 \(zly\)/);
    // Karta, ktorá v zóne nie je (Most medzi lokalitami scenára nie je).
    const zlaKarta: ScenarVyucby = { ...scenar, kroky: [{ id: "x", kto: "hrac", prikaz: { type: "chooseLocation", uid: "lokality:most", otocena: false }, melichar: "" }] };
    expect(overScenar(data, zlaKarta)).toMatch(/lokality:most/);
  });
});

describe("výučba — pevné rozdanie", () => {
  const r = scenar.rozdanie;

  it("ruky, balíčky, lokality v poradí a útočník podľa scenára, aj s variantmi kariet", () => {
    const s = zacniVyucbu(data, scenar);
    // „defId“ = variant 0/0, „defId/ľavý/pravý“ = daný variant.
    const ref = (k: { defId: string; leftLayout: number; rightLayout: number }): string => `${k.defId}/${k.leftLayout}/${k.rightLayout}`;
    const plny = (x: string): string => (x.includes("/") ? x : `${x}/0/0`);
    expect(s.hraci[0].ruka.map(ref)).toEqual(r.hraci[0].ruka.map(plny));
    expect(s.hraci[1].doberaci.map(ref)).toEqual(r.hraci[1].doberaci.map(plny));
    expect(s.lokalityVHre.map(ref)).toEqual(r.lokality.map(plny));
    expect(s.lokalitCelkom).toBe(r.lokality.length);
    expect(s.utocnik).toBe(r.utocnik);
    // uid sú jedinečné aj po prepise.
    const uids = [...s.hraci[0].ruka, ...s.hraci[1].ruka, ...s.lokalityVHre, ...s.spolocnyBalicek, ...s.starsi.map((e) => e.karta)].map((k) => k.uid);
    expect(new Set(uids).size).toBe(uids.length);
  });

  it("variant karty, scorecard a spoločný balíček sa dajú zadať; neznáme hodnoty sú chyba", () => {
    const sc = data.scorecards[3]!.id;
    const s = setupZRozdania(data, {
      ...r,
      scorecardy: { farar: sc },
      spolocnyBalicek: ["hasic", "svokra/0/1"],
      hraci: [{ ...r.hraci[0], ruka: ["pijan/1/0"] }, r.hraci[1]],
    });
    expect(s.starsi.find((e) => e.elderId === "farar")?.scorecard).toBe(sc);
    expect(s.spolocnyBalicek.map((k) => `${k.defId}/${k.leftLayout}/${k.rightLayout}`)).toEqual(["hasic/0/0", "svokra/0/1"]);
    expect(s.hraci[0].ruka[0]?.leftLayout).toBe(1);
    expect(() => setupZRozdania(data, { ...r, lokality: ["pijan"] })).toThrow(/nie je lokalita/);
    expect(() => setupZRozdania(data, { ...r, hraci: [{ ...r.hraci[0], ruka: ["pijan/9/9"] }, r.hraci[1]] })).toThrow(/variantov/);
    expect(() => setupZRozdania(data, { ...r, scorecardy: { farar: "neexistuje" } })).toThrow(/scorecard/);
  });

  it("hra s dvoma lokalitami sa po druhej bitke skončí s bodovaním", () => {
    // Väčšie balíčky, nech hra neskončí prehrou na balíček skôr než bitkami.
    const balicek = ["pijan", "pijan", "ministrant", "ministrant", "hasic", "svokra", "pijan", "ministrant", "hasic", "svokra"];
    let s: GameState = setupZRozdania(data, { ...r, hraci: [{ ...r.hraci[0], doberaci: balicek }, { ...r.hraci[1], doberaci: balicek }] });
    let rng = rngSeed(3);
    for (let i = 0; i < 5000 && s.koniec === null; i++) {
      const p = naTahu(s);
      if (p === null) break;
      const cmds = legalCommands(data, s, p);
      const [idx, r2] = rngInt(rng, cmds.length);
      rng = r2;
      s = apply(data, s, cmds[idx] as Command, p).state;
    }
    expect(s.koniec?.dovod).toMatch(/posledná bitka/);
    expect(s.koniec?.body).not.toBeNull();
    expect(s.kolo).toBe(2);
  });
});

describe("výučba — porovnanie príkazov", () => {
  it("odkaz zóna:defId#n nájde n-tú rovnakú kartu", () => {
    const s = zacniVyucbu(data, scenar);
    const pijany = s.hraci[0].ruka.filter((k) => k.defId === "pijan");
    expect(uidZOdkazu(s, 0, "ruka:pijan")).toBe(pijany[0]?.uid);
    expect(uidZOdkazu(s, 0, "ruka:pijan#2")).toBe(pijany[1]?.uid);
    expect(() => uidZOdkazu(s, 0, "ruka:hasic")).toThrow(/nie je/);
  });

  it("ťah naraz s jedným krokom a poradie v zoznamoch nezáleží", () => {
    const place: Command = { type: "place", uid: 5, target: "vlastna" };
    expect(zhodnyPrikaz({ type: "tah", kroky: [place] }, place)).toBe(true);
    expect(zhodnyPrikaz({ type: "draftBer", uids: [3, 1] }, { type: "draftBer", uids: [1, 3] })).toBe(true);
    expect(zhodnyPrikaz(place, { type: "place", uid: 5, target: "superova" })).toBe(false);
  });
});

describe("výučba — zlý ťah povie, čo chýba (playtest výučby, návrh 1)", () => {
  const krok = (id: string): number => scenar.kroky.findIndex((k) => k.id === id);

  it("k10: len Pijan bez Hasiča a bez Vypiť — chýba Hasič aj Vypiť, nič navyše", () => {
    const i = krok("k10");
    const state = prehrajVyucbu(data, scenar, i);
    const ocakava = ocakavanyPrikaz(scenar, state, i) as Command & { type: "tah" };
    const pijan = ocakava.kroky.find((c) => c.type === "place") as Command;
    const p = porovnajSKrokom(data, state, { type: "tah", kroky: [pijan] }, ocakava);
    expect(p.zhoda).toBe(false);
    expect(p.navyse).toEqual([]);
    expect(p.chybajuce.map((x) => x.popis)).toEqual(["vypi poldeci (Vypiť)", "polož kartu „Hasič“ na svoju stranu línie"]);
    expect(p.chybajuce[1]?.uid).toEqual(expect.any(Number));
    expect(textChybyKroku(p)).toBe("Takto nie — ešte chýba: vypi poldeci (Vypiť), polož kartu „Hasič“ na svoju stranu línie.");
  });

  it("celý ťah v inom poradí prejde; karta na zlé miesto je navyše aj chýba", () => {
    const i = krok("k10");
    const state = prehrajVyucbu(data, scenar, i);
    const ocakava = ocakavanyPrikaz(scenar, state, i) as Command & { type: "tah" };
    expect(porovnajSKrokom(data, state, { type: "tah", kroky: [...ocakava.kroky].reverse() }, ocakava).zhoda).toBe(true);
    const zle = ocakava.kroky.map((c) => (c.type === "place" ? { ...c, target: "superova" as const } : c));
    const p = porovnajSKrokom(data, state, { type: "tah", kroky: zle }, ocakava);
    expect(p.zhoda).toBe(false);
    expect(p.navyse.map((x) => x.popis)).toContain("polož kartu „Pijan“ na súperovu stranu línie");
    expect(p.chybajuce.map((x) => x.popis)).toContain("polož kartu „Pijan“ na svoju stranu línie");
  });

  it("rovnaká karta (defId aj variant) je zameniteľná, Pijan s iným rozložením akcií nie", () => {
    const i = krok("k50");
    const state = prehrajVyucbu(data, scenar, i);
    const ocakava = ocakavanyPrikaz(scenar, state, i) as Command & { type: "tah" };
    const chcem = ocakava.kroky[0] as Command & { type: "place" };
    const karta = (u: number) => state.hraci[0].ruka.find((k) => k.uid === u);
    const iny = state.hraci[0].ruka.find((k) => k.defId === "pijan" && k.uid !== chcem.uid);
    expect(iny).toBeDefined();
    const zameni = iny?.leftLayout === karta(chcem.uid)?.leftLayout && iny?.rightLayout === karta(chcem.uid)?.rightLayout;
    const p = porovnajSKrokom(data, state, { type: "tah", kroky: [{ ...chcem, uid: iny?.uid ?? -1 }] }, ocakava);
    expect(p.zhoda).toBe(zameni);
    if (!zameni) expect(p.chybajuce[0]?.uid).toBe(chcem.uid);
    // Tá istá karta pod iným uid v kópii stavu (zameniteľná) prejde.
    const kopia: GameState = {
      ...state,
      hraci: [{ ...state.hraci[0], ruka: state.hraci[0].ruka.map((k) => (k.uid === iny?.uid ? { ...k, leftLayout: karta(chcem.uid)?.leftLayout ?? 0, rightLayout: karta(chcem.uid)?.rightLayout ?? 0 } : k)) }, state.hraci[1]],
    };
    expect(porovnajSKrokom(data, kopia, { type: "tah", kroky: [{ ...chcem, uid: iny?.uid ?? -1 }] }, ocakava).zhoda).toBe(true);
  });
});

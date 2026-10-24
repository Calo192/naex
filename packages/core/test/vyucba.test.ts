// Výučba „Prvá hra“ (Michal 2026-10-23): pevné rozdanie zo scenára, kroky
// s jediným dovoleným príkazom a kontrola, že scenár v jadre prejde.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import scenarJson from "../data/vyucba/prva-hra.json";
import type { CardInstance, Command, GameState, ScenarVyucby, VolbaKroku } from "../src/index.ts";
import {
  apply,
  defOf,
  legalCommands,
  loadGameData,
  naTahu,
  ocakavanyPrikaz,
  overScenar,
  PAUZA_PRED_TAHOM_MS,
  PAUZA_TICHA_MS,
  cakaNaDalej,
  pauzaKrokuVyucby,
  porovnajSKrokom,
  prelozKluceZvyraznenia,
  radaKVolbe,
  prehrajVyucbu,
  rngInt,
  rngSeed,
  setupGame,
  setupZRozdania,
  textChybyKroku,
  uidZOdkazu,
  zacniVyucbu,
  zodpovedaVzoru,
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
  // Porovnanie nič nevykonáva — stačí bežný stav a príkazy z kariet v ruke, nezávisle od scenára.
  const state = setupGame(data, 7);
  const ruka = state.hraci[0].ruka;
  const a = ruka[0] as CardInstance;
  const b = ruka.find((k) => k.defId !== a.defId) as CardInstance;
  const meno = (k: CardInstance): string => defOf(data, k).name;
  const ocakava: Command = {
    type: "tah",
    kroky: [{ type: "vypit" }, { type: "place", uid: a.uid, target: "vlastna" }, { type: "place", uid: b.uid, target: "vlastna" }],
  };

  it("čiastočný viackartový ťah: chýba druhá karta aj Vypiť, nič navyše", () => {
    const p = porovnajSKrokom(data, state, { type: "tah", kroky: [{ type: "place", uid: a.uid, target: "vlastna" }] }, ocakava);
    expect(p.zhoda).toBe(false);
    expect(p.navyse).toEqual([]);
    expect(p.chybajuce.map((x) => x.popis)).toEqual(["vypi poldeci (Vypiť)", `polož kartu „${meno(b)}“ na svoju stranu línie`]);
    expect(p.chybajuce[1]?.uid).toBe(b.uid);
    expect(textChybyKroku(p)).toBe(`Takto nie — ešte chýba: vypi poldeci (Vypiť), polož kartu „${meno(b)}“ na svoju stranu línie.`);
  });

  it("celý ťah v inom poradí prejde; karta na zlé miesto je navyše aj chýba", () => {
    const kroky = ocakava.type === "tah" ? ocakava.kroky : [];
    expect(porovnajSKrokom(data, state, { type: "tah", kroky: [...kroky].reverse() }, ocakava).zhoda).toBe(true);
    const zle = kroky.map((c) => (c.type === "place" && c.uid === a.uid ? { ...c, target: "superova" as const } : c));
    const p = porovnajSKrokom(data, state, { type: "tah", kroky: zle }, ocakava);
    expect(p.zhoda).toBe(false);
    expect(p.navyse.map((x) => x.popis)).toEqual([`polož kartu „${meno(a)}“ na súperovu stranu línie`]);
    expect(p.chybajuce.map((x) => x.popis)).toEqual([`polož kartu „${meno(a)}“ na svoju stranu línie`]);
    expect(textChybyKroku({ zhoda: false, chybajuce: [], navyse: p.navyse })).toMatch(/^Takto nie — toto teraz nie: /);
  });

  it("rovnaká karta (defId aj variant) pod iným uid je zameniteľná, s iným rozložením akcií nie", () => {
    const uid = Math.max(...ruka.map((k) => k.uid)) + 1000;
    const dvojca = (zmena: Partial<CardInstance>): GameState => ({
      ...state,
      hraci: [{ ...state.hraci[0], ruka: [...ruka, { ...a, uid, ...zmena }] }, state.hraci[1]],
    });
    const krok: Command = { type: "place", uid: a.uid, target: "vlastna" };
    const inouKartou: Command = { type: "place", uid, target: "vlastna" };
    expect(porovnajSKrokom(data, dvojca({}), inouKartou, krok).zhoda).toBe(true);
    const ina = dvojca({ leftLayout: a.leftLayout + 1 });
    const p = porovnajSKrokom(data, ina, inouKartou, krok);
    expect(p.zhoda).toBe(false);
    expect(p.chybajuce[0]?.uid).toBe(a.uid);
  });

  it("stavba šenku: chýbajúca a navyše karta na Smetisku", () => {
    const [x, y, z] = ruka as [CardInstance, CardInstance, CardInstance];
    const chce: Command = { type: "stavbaSenku", doSenku: [x.uid, y.uid], odhod: [] };
    const p = porovnajSKrokom(data, state, { type: "stavbaSenku", doSenku: [x.uid, z.uid], odhod: [] }, chce);
    expect(p.chybajuce.map((c) => c.uid)).toEqual([y.uid]);
    expect(p.navyse.map((c) => c.uid)).toEqual([z.uid]);
  });
});

describe("výučba — automatické kroky hráča (kto: auto)", () => {
  it("auto je príkaz hráča: scenár s ťahmi hráča ako auto prejde a skončí v tom istom stave", () => {
    const auto: ScenarVyucby = { ...scenar, kroky: scenar.kroky.map((k) => (k.kto === "hrac" ? { ...k, kto: "auto" as const } : k)) };
    expect(overScenar(data, auto)).toBeNull();
    expect(JSON.stringify(prehrajVyucbu(data, auto, auto.kroky.length))).toBe(JSON.stringify(prehrajVyucbu(data, scenar, scenar.kroky.length)));
    // Hráč auto krok neposiela — server ho nečaká.
    const i = auto.kroky.findIndex((k) => k.kto === "auto");
    expect(ocakavanyPrikaz(auto, prehrajVyucbu(data, auto, i), i)).toBeNull();
  });

  it("auto bez príkazu a auto namiesto ťahu bota scenár neprejde", () => {
    const iHrac = scenar.kroky.findIndex((k) => k.kto === "hrac");
    const bezPrikazu: ScenarVyucby = { ...scenar, kroky: scenar.kroky.map((k, j) => (j === iHrac ? { id: k.id, kto: "auto" as const, melichar: k.melichar } : k)) };
    expect(overScenar(data, bezPrikazu)).toMatch(/auto bez príkazu/);
    const iBot = scenar.kroky.findIndex((k) => k.kto === "bot");
    const zaBota: ScenarVyucby = { ...scenar, kroky: scenar.kroky.map((k, j) => (j === iBot ? { ...k, kto: "auto" as const } : k)) };
    expect(overScenar(data, zaBota)).not.toBeNull();
  });
});

describe("výučba — kontrolné otázky a rozhodnutia (UX N2)", () => {
  const otazka = (moznosti: { text: string; spravna: boolean; vysvetlenie: string }[], navyse: Record<string, unknown> = {}) =>
    ({ id: "q-test", kto: "otazka" as const, melichar: "Čo dá spoj?", moznosti, ...navyse }) as ScenarVyucby["kroky"][number];
  const sOtazkou = (krok: ScenarVyucby["kroky"][number]): ScenarVyucby => ({ ...scenar, kroky: [scenar.kroky[0] as ScenarVyucby["kroky"][number], krok, ...scenar.kroky.slice(1)] });
  const dobre = [
    { text: "Ranu", spravna: true, vysvetlenie: "Áno." },
    { text: "Nič", spravna: false, vysvetlenie: "Nie." },
  ];

  it("otázka partiu nemení a overScenar stráži 2–3 možnosti, práve jednu správnu, bez príkazu", () => {
    expect(overScenar(data, sOtazkou(otazka(dobre)))).toBeNull();
    expect(JSON.stringify(prehrajVyucbu(data, sOtazkou(otazka(dobre)), 2))).toBe(JSON.stringify(prehrajVyucbu(data, scenar, 1)));
    expect(overScenar(data, sOtazkou(otazka([dobre[0] as (typeof dobre)[number]])))).toMatch(/2 – 3 možnosti/);
    expect(overScenar(data, sOtazkou(otazka(dobre.map((m) => ({ ...m, spravna: true })))))).toMatch(/práve jednu správnu/);
    expect(overScenar(data, sOtazkou(otazka(dobre, { prikaz: { type: "pass" } })))).toMatch(/nemá mať prikaz/);
    expect(overScenar(data, sOtazkou(otazka([...dobre, { text: "", spravna: false, vysvetlenie: "x" }])))).toMatch(/text aj vysvetlenie/);
  });

  it("rozhodnutie: zlý ťah dostane radu zo vzoru (len uvedené polia), inak všeobecnú; vzor nesmie sedieť na správny ťah", () => {
    const i = scenar.kroky.findIndex((k) => k.kto === "hrac");
    const krok = scenar.kroky[i] as ScenarVyucby["kroky"][number];
    const state = prehrajVyucbu(data, scenar, i);
    const spravny = ocakavanyPrikaz(scenar, state, i) as Command;
    const volba: VolbaKroku = { kandidati: ["ruka:pijan"], zle: [{ prikaz: { type: "pass" }, text: "Ešte nepasuj." }], inak: "Skús inú kartu." };
    expect(radaKVolbe(state, volba, { type: "pass" })).toBe("Ešte nepasuj.");
    expect(radaKVolbe(state, volba, { type: "skipNaex" })).toBe("Skús inú kartu.");
    expect(zodpovedaVzoru(state, spravny, { type: spravny.type })).toBe(true);
    // Vzor iba s typom správneho ťahu sedí aj naň — overScenar to odhalí.
    const zly: ScenarVyucby = { ...scenar, kroky: scenar.kroky.map((k, j) => (j === i ? { ...krok, volba: { ...volba, zle: [{ prikaz: { type: spravny.type }, text: "x" }] } } : k)) };
    expect(overScenar(data, zly)).toMatch(/sedí aj na správny ťah/);
    const ok: ScenarVyucby = { ...scenar, kroky: scenar.kroky.map((k, j) => (j === i ? { ...krok, volba } : k)) };
    expect(overScenar(data, ok)).toBeNull();
  });
});

describe("výučba — pauza pred krokom, ktorý hra spraví sama (UI inšpekcia)", () => {
  const krok = (kto: "bot" | "auto", melichar: string) => ({ id: "x", kto, melichar, prikaz: { type: "pass" as const } });

  it("s textom 700 ms a potom čaká na ďalej; bez textu 1500 ms a ide sám (U5)", () => {
    expect(pauzaKrokuVyucby(krok("bot", ""))).toBe(PAUZA_TICHA_MS);
    expect(pauzaKrokuVyucby(krok("auto", "  "))).toBe(PAUZA_TICHA_MS);
    expect(pauzaKrokuVyucby(krok("bot", "Štamgast ide do krčmy a pije."))).toBe(PAUZA_PRED_TAHOM_MS);
    expect(cakaNaDalej(krok("auto", "Hra kúpila Hasiča."))).toBe(true);
    expect(cakaNaDalej(krok("bot", ""))).toBe(false);
    expect(PAUZA_TICHA_MS).toBeGreaterThanOrEqual(1500);
  });
});

describe("výučba — kľúče zvýraznenia „zóna:defId#n“ idú klientovi ako uid", () => {
  it("#n sa preloží na uid:N podľa poradia v stave; ostatné kľúče a neexistujúca karta ostanú", () => {
    const state = setupGame(data, 7);
    const ruka = state.hraci[0].ruka;
    const defId = ruka.find((k) => ruka.filter((x) => x.defId === k.defId).length >= 2)?.defId ?? (ruka[0]?.defId as string);
    const druha = ruka.filter((k) => k.defId === defId)[1] ?? ruka.filter((k) => k.defId === defId)[0];
    expect(prelozKluceZvyraznenia(state, [`ruka:${defId}#1`, `ruka:${defId}`, "bar:poldeci", "ruka:neexistuje#2"])).toEqual([
      `uid:${ruka.find((k) => k.defId === defId)?.uid}`,
      `ruka:${defId}`,
      "bar:poldeci",
      "ruka:neexistuje#2",
    ]);
    if (ruka.filter((k) => k.defId === defId).length >= 2) expect(prelozKluceZvyraznenia(state, [`ruka:${defId}#2`])).toEqual([`uid:${druha?.uid}`]);
  });
});

describe("výučba — zlý ťah pri staršom pomenuje staršieho (U3)", () => {
  it("prebytok, Pohoršenie a patronát na zlého staršieho: text povie meno správneho", () => {
    const state = setupGame(data, 7);
    const [a, b] = state.starsi;
    if (a === undefined || b === undefined) throw new Error("starší");
    const meno = defOf(data, a.karta).name;
    const p = porovnajSKrokom(data, state, { type: "prebytok", elderId: b.elderId }, { type: "prebytok", elderId: a.elderId });
    expect(p.chybajuce.map((x) => x.popis)).toEqual([`posuň prebytkom staršieho „${meno}“`]);
    expect(textChybyKroku(p)).toContain(meno);
  });
});

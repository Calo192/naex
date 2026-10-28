// Výučba „Prvá hra“ (Michal 2026-10-23): pevné rozdanie zo scenára, kroky
// s jediným dovoleným príkazom a kontrola, že scenár v jadre prejde.

import { describe, expect, it } from "vitest";
// Scenár „Prvá hra“ je od 2026-10-27 na sade v7 (pravidlá v7, lokality úrovne 1).
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import scenarJson from "../data/vyucba/prva-hra.json";
import type { CardInstance, Command, GameState, Rozdanie, ScenarVyucby, VolbaKroku } from "../src/index.ts";
import {
  apply,
  spakyTeraz,
  defOf,
  evaluateLine,
  legalCommands,
  lineState,
  lokalityNaVyber,
  loadGameData,
  nahladPitky,
  naTahu,
  silaPriazne,
  ocakavanyPrikaz,
  overScenar,
  PAUZA_PRED_TAHOM_MS,
  PAUZA_TICHA_MS,
  cakaNaDalej,
  pauzaKrokuVyucby,
  pocetPitiek,
  poskodenieBitky,
  prahyHraca,
  porovnajSKrokom,
  prelozKluceZvyraznenia,
  radaKVolbe,
  radaVyucby,
  castiHlasky,
  nazovHlasky,
  prikazZoScenara,
  prehrajVyucbu,
  rngInt,
  rngSeed,
  setupGame,
  setupZRozdania,
  textChybyKroku,
  uidZOdkazu,
  urovenLokality,
  viewFor,
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
    // Karta, ktorá v zóne nie je (Kostol medzi lokalitami scenára nie je).
    const zlaKarta: ScenarVyucby = { ...scenar, kroky: [{ id: "x", kto: "hrac", prikaz: { type: "chooseLocation", uid: "lokality:kostol", otocena: false }, melichar: "" }] };
    expect(overScenar(data, zlaKarta)).toMatch(/lokality:kostol/);
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
    // S rozpisom úrovní (v7) je dĺžka hry počet kôl bez finále, lokality sú zásoba.
    expect(s.lokalitCelkom).toBe((r.rozpis?.length ?? r.lokality.length + 1) - 1);
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
      hraci: [{ ...r.hraci[0], ruka: ["hasic/1/0"] }, r.hraci[1]],
    });
    expect(s.starsi.find((e) => e.elderId === "farar")?.scorecard).toBe(sc);
    expect(s.spolocnyBalicek.map((k) => `${k.defId}/${k.leftLayout}/${k.rightLayout}`)).toEqual(["hasic/0/0", "svokra/0/1"]);
    expect(s.hraci[0].ruka[0]?.leftLayout).toBe(1);
    expect(() => setupZRozdania(data, { ...r, lokality: ["pijan"] })).toThrow(/nie je lokalita/);
    expect(() => setupZRozdania(data, { ...r, hraci: [{ ...r.hraci[0], ruka: ["pijan/9/9"] }, r.hraci[1]] })).toThrow(/variantov/);
    expect(() => setupZRozdania(data, { ...r, scorecardy: { farar: "neexistuje" } })).toThrow(/scorecard/);
  });

  it("rozpis úrovní (v7): obranca vyberá len z lokalít úrovne kola; zásoba bez úrovne rozpisu je chyba", () => {
    expect(r.rozpis).toEqual([1, 2, 3, 4]);
    const s = zacniVyucbu(data, scenar);
    expect(s.rozpis).toEqual([1, 2, 3, 4]);
    expect(lokalityNaVyber(data, s).map((k) => k.defId)).toEqual(["lesna_cesta", "jednota", "cintorin"]);
    // Každá úroveň rozpisu má v zásobe aspoň tri lokality, ako v bežnej hre (§5).
    for (const u of [1, 2, 3, 4]) expect(s.lokalityVHre.filter((k) => urovenLokality(data, k.defId) === u).length, `úroveň ${u}`).toBe(3);
    expect(() => setupZRozdania(data, { ...r, lokality: r.lokality.slice(0, 9) })).toThrow(/úroveň 4/);
    expect(() => setupZRozdania(data, { ...r, rozpis: [1] })).toThrow(/finále/);
  });

  it("sada bez rozpisu úrovní finále nemá: hra s jednou lokalitou sa po bitke skončí so špakmi", () => {
    // Väčšie balíčky, nech hra neskončí prehrou na balíček skôr než bitkami.
    const balicek = ["pijan", "pijan", "ministrant", "ministrant", "hasic", "svokra", "pijan", "ministrant", "hasic", "svokra"];
    // Bez rozpisu úrovní: lokality v pevnom poradí; bez pinnacle lokality finále nie je (v8).
    const bezRozpisu: Rozdanie = { seed: r.seed, lokality: r.lokality.slice(0, 1), utocnik: r.utocnik, hraci: [{ ...r.hraci[0], doberaci: balicek }, { ...r.hraci[1], doberaci: balicek }] };
    let s: GameState = setupZRozdania(data, bezRozpisu);
    let rng = rngSeed(3);
    for (let i = 0; i < 5000 && s.koniec === null; i++) {
      const p = naTahu(s);
      if (p === null) break;
      const cmds = legalCommands(data, s, p);
      const [idx, r2] = rngInt(rng, cmds.length);
      rng = r2;
      s = apply(data, s, cmds[idx] as Command, p).state;
    }
    expect(s.koniec?.dovod).toMatch(/všetky lokality/);
    expect(s.koniec?.body).not.toBeNull();
    expect(s.kolo).toBe(1);
    expect(s.nastenka.map((b) => b.lokalita?.defId ?? null)).toEqual([r.lokality[0]!.split("/")[0]]);
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

  it("otázka partiu nemení a overScenar stráži 2–3 možnosti, aspoň jednu správnu, bez príkazu", () => {
    expect(overScenar(data, sOtazkou(otazka(dobre)))).toBeNull();
    expect(JSON.stringify(prehrajVyucbu(data, sOtazkou(otazka(dobre)), 2))).toBe(JSON.stringify(prehrajVyucbu(data, scenar, 1)));
    expect(overScenar(data, sOtazkou(otazka([dobre[0] as (typeof dobre)[number]])))).toMatch(/2 – 3 možnosti/);
    // Obe správne smú byť (Michal 2026-10-25, q-naex), žiadna správna nie.
    expect(overScenar(data, sOtazkou(otazka(dobre.map((m) => ({ ...m, spravna: true })))))).toBeNull();
    expect(overScenar(data, sOtazkou(otazka(dobre.map((m) => ({ ...m, spravna: false })))))).toMatch(/aspoň jednu správnu/);
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

describe("výučba — cigarety pre Melichara (Michal 2026-10-25)", () => {
  const iVitaj = scenar.kroky.findIndex((k) => k.id === "i-vitaj");
  const iStrach = scenar.kroky.findIndex((k) => k.id === "i-strach");

  it("hráč začína s 5, úvod a stupnica strachu mu uberú po cigarete; po 1. časti má 5, Štamgast 8", () => {
    expect(scenar.kroky.filter((k) => k.odovzdaCigaretu === true).map((k) => k.id)).toEqual(["i-vitaj", "i-strach"]);
    expect(zacniVyucbu(data, scenar).hraci[0].cigarety).toBe(5);
    expect(prehrajVyucbu(data, scenar, iVitaj + 1).hraci[0].cigarety).toBe(4);
    // „Inak, nemáš ešte cigaretku?“ — po dvoch pasoch (1 + 2 cigarety) má hráč 6, Melicharovi dá jednu.
    const predStrachom = prehrajVyucbu(data, scenar, iStrach);
    expect(predStrachom.hraci[0].cigarety).toBe(6);
    expect(prehrajVyucbu(data, scenar, iStrach + 1).hraci[0].cigarety).toBe(5);
    const koniec = prehrajVyucbu(data, scenar, scenar.kroky.length);
    expect([koniec.hraci[0].cigarety, koniec.hraci[1].cigarety]).toEqual([5, 8]);
  });

  it("úvod ponúkne preskočenie a tlačidlá majú nápis zo scenára; posledný krok uzavrie časť", () => {
    expect(scenar.kroky[iVitaj]).toMatchObject({ kto: "info", tlacidlo: "Dať cigaretu", preskocenie: true });
    expect(scenar.kroky[iStrach]).toMatchObject({ kto: "info", tlacidlo: "Odovzdať cigaretu" });
    expect(scenar.kroky.at(-1)).toMatchObject({ id: "i-dovidenia", kto: "info", tlacidlo: "Dokončiť 1. časť" });
  });

  it("bez cigarety ju hráč odovzdať nemôže; odovzdanie a naneisto len pri info kroku", () => {
    const chudak: ScenarVyucby = { ...scenar, rozdanie: { ...scenar.rozdanie, hraci: [{ ...scenar.rozdanie.hraci[0], cigarety: 0 }, scenar.rozdanie.hraci[1]] } };
    expect(overScenar(data, chudak)).toMatch(/i-vitaj.*nemá cigaretu/);
    const zlyKrok: ScenarVyucby = { ...scenar, kroky: scenar.kroky.map((k) => (k.id === "k-pijan" ? { ...k, odovzdaCigaretu: true } : k)) };
    expect(overScenar(data, zlyKrok)).toMatch(/k-pijan.*len k info kroku/);
    const bezZvyraznenia: ScenarVyucby = { ...scenar, kroky: scenar.kroky.map((k) => (k.id === "i-senok" ? { ...k, zvyraznit: [] } : k)) };
    expect(overScenar(data, bezZvyraznenia)).toMatch(/i-senok.*naneisto bez zvýraznených/);
  });

  it("šenok nanečisto: i-senok partiu nemení, rozloženie určí až k-stavba (stavia Melichar)", () => {
    const iSenok = scenar.kroky.findIndex((k) => k.id === "i-senok");
    expect(scenar.kroky[iSenok]).toMatchObject({ kto: "info", naneisto: true });
    expect(scenar.kroky[iSenok + 1]).toMatchObject({ id: "k-stavba", kto: "auto" });
    expect(JSON.stringify(prehrajVyucbu(data, scenar, iSenok + 1))).toBe(JSON.stringify(prehrajVyucbu(data, scenar, iSenok)));
  });
});

describe("výučba Prvá hra — 1. časť (návrh vyucba-cast1, Michal 2026-10-25)", () => {
  const i = (id: string): number => {
    const n = scenar.kroky.findIndex((k) => k.id === id);
    if (n < 0) throw new Error(`Scenár nemá krok ${id}`);
    return n;
  };
  /** Stav, ktorý hráč vidí pri texte kroku `id` (pred jeho príkazom). */
  const pri = (id: string): GameState => prehrajVyucbu(data, scenar, i(id));
  /** Stav po príkaze kroku `id`. */
  const po = (id: string): GameState => prehrajVyucbu(data, scenar, i(id) + 1);
  const odhad = (s: GameState): readonly number[] => poskodenieBitky(data, s, evaluateLine(data, lineState(s)).sums, [0, 0]).celkove;
  // Špaky v popolníku. Nie „keby skončila teraz“ — to od 2026-10-27 pridáva výkupné poldeci a cigariet.
  const body = (s: GameState): readonly number[] => spakyTeraz(viewFor(data, s, 0)).spaky;

  it("1. časť: verzia scenára a číslo časti (hviezdička), tri lokality úrovne 1, Farár so scorecardom Exekútor", () => {
    expect(scenar).toMatchObject({ id: "prva-hra", cast: 1, zverejnena: true });
    expect(scenar.verzia).toMatch(/v7/);
    // v7: úroveň lokality = počet akcií na hrane; prvé kolo sa bije o lokalitu úrovne 1.
    expect(lokalityNaVyber(data, pri("k-ciel")).map((k) => k.defId)).toEqual(["lesna_cesta", "jednota", "cintorin"]);
    for (const k of lokalityNaVyber(data, pri("k-ciel"))) expect(urovenLokality(data, k.defId), k.defId).toBe(1);
    expect(scenar.rozdanie.scorecardy).toMatchObject({ farar: "EXEKUTOR", krcmarka: "LAKOMEC" });
  });

  it("schválené znenia Michala 2026-10-27 (i-fazy, q-spoj, i-fajcit, i-body)", () => {
    expect(scenar.kroky[i("i-fazy")]?.melichar).toContain("v Zhromaždení ich hráš k Lesnej ceste");
    expect(scenar.kroky[i("q-spoj")]?.moznosti?.find((m) => m.spravna)?.text).toBe("Na spoji stretla Pecku Lesnej cesty v rovnakej výške.");
    expect(scenar.kroky[i("i-fajcit")]?.melichar).toContain(
      "za [Cigareta] cigaretu si hneď doberieš kartu; každé ďalšie fajčenie v tej istej Pitke je o cigaretu drahšie.",
    );
    // v8: špaky za bitku sú karty v línii — 6, nie 2 Pitky (Michal 2026-10-28, návrh #28).
    expect(scenar.kroky[i("i-body")]?.melichar).toMatch(/^Špaky v bare: 5 : −1\./);
  });

  it("Lesnú cestu si hráč vyberie sám, Peckou k sebe; zlá lokalita aj zlé natočenie dostanú radu Melichara", () => {
    const krok = scenar.kroky[i("k-ciel")];
    expect(krok).toMatchObject({ kto: "hrac", prikaz: { type: "chooseLocation", uid: "lokality:lesna_cesta", otocena: false } });
    const s = pri("k-ciel");
    const volba = krok?.volba as VolbaKroku;
    const uid = (id: string): number => uidZOdkazu(s, 0, `lokality:${id}`);
    expect(radaKVolbe(s, volba, { type: "chooseLocation", uid: uid("lesna_cesta"), otocena: true })).toMatch(/Otoč ju/);
    expect(radaKVolbe(s, volba, { type: "chooseLocation", uid: uid("jednota"), otocena: true })).toMatch(/Jednote/);
    expect(radaKVolbe(s, volba, { type: "chooseLocation", uid: uid("cintorin"), otocena: false })).toMatch(/Cintoríne/);
  });

  it("zlý Pijan by s Peckou spojil Poldeci namiesto Rany — rada Melichara to povie", () => {
    const s = pri("k-pijan");
    const zly: Command = { type: "tah", kroky: [{ type: "place", uid: uidZOdkazu(s, 0, "ruka:pijan#2"), target: "vlastna" }] };
    const sums = evaluateLine(data, lineState(apply(data, s, zly, 0).state)).sums[0];
    expect(sums).toMatchObject({ Pecka: 1, Poldeci: 1 });
    expect(sums.Rana ?? 0).toBe(0);
    expect(radaKVolbe(s, scenar.kroky[i("k-pijan")]?.volba as VolbaKroku, zly)).toMatch(/Poldeci/);
  });

  it("čísla v hláškach sedia s jadrom: odhad bitky 0 : 2 → 3 : 2 → 3 : 3 → 7 : 3 → 7 : 4, Pitky 1 → 2, bitka 8 : 5", () => {
    expect(odhad(po("k-zh-bot1"))).toEqual([0, 2]);
    expect(pocetPitiek(data, pri("k-pijan"))).toBe(1);
    expect(odhad(po("k-pijan"))).toEqual([3, 2]);
    expect(pocetPitiek(data, po("k-pijan"))).toBe(2);
    expect(odhad(po("k-zh-bot2"))).toEqual([3, 3]);
    expect(odhad(po("k-hasic"))).toEqual([7, 3]);
    expect(odhad(po("k-zh-bot3"))).toEqual([7, 4]);
    // Štamgastova Povera z hrany Lesnej cesty; kým hráč nemá Dlh, nič nedá (i-pecka-povera).
    expect(evaluateLine(data, lineState(po("k-zh-bot1"))).sums[1]).toMatchObject({ Pecka: 1, Povera: 1 });
    // Dievčinina Povera, zdvojená Hasičovým Posilnením (k-dievcina).
    expect(evaluateLine(data, lineState(po("k-dievcina"))).sums[0]).toMatchObject({ Povera: 2 });
    // Bitka (i-bitka): tuhé 7 : 4, Povery sa vyrovnajú 1 : 1 (exekúcia až po poškodení, 2026-10-28) — prebytok 3.
    const d = pri("i-bitka").bitkaStav?.damage;
    expect([d?.tuhe, d?.makke, d?.celkove]).toEqual([[7, 4], [1, 1], [8, 5]]);
  });

  it("Pitka v7 (D6): pečeň sa nuluje, zadĺženie nie; Hasič v oboch Pitkách = karta Dlh, hneď priznaná", () => {
    expect(nahladPitky(data, pri("k-hotovo"))[0]).toMatchObject({ pecenZoStola: 1, zadlzenieZoStola: 1, prahPecene: 3, prahDlhu: 2 });
    const poPitke = po("k-hotovo-bot");
    expect(poPitke.faza).toBe("zhromazdenie");
    expect(poPitke.hraci[0]).toMatchObject({ zadlzenie: 1, pecen: 0 });
    expect(prahyHraca(data, poPitke, 0).priznaneDlhy).toBe(0);
    expect(poPitke.hraci[1].cigarety).toBe(3);
    const poBitke = po("k-hotovo-bot2");
    expect(poBitke.hraci[0]).toMatchObject({ zadlzenie: 0, pecen: 0 });
    // Karta Dlh vznikla, ale exekútor (bez prahu, 2026-10-28) ju v bitke hneď zhorel — obom aj s 1 špakom.
    expect(prahyHraca(data, poBitke, 0).priznaneDlhy).toBe(0);
    expect(prahyHraca(data, poBitke, 1).priznaneDlhy).toBe(0);
    expect(poBitke.nastenka.at(-1)?.exekutor).toEqual([1, 1]);
    expect(body(pri("k-hotovo-bot2"))).toEqual([0, 0]);
    // Hráč vyhral bitku so 6 kartami v línii (v8); starší v strede ešte nič nedali.
    expect(body(poBitke)).toEqual([5, -1]);
  });

  it("prebytok 3 rozdeľuje porazený Štamgast, celý na Farára (v8): jeho Exekútor 0 → 1 → 2 → 3 (exekúcia hráčovi o toľko viac), cigareta za posunutého", () => {
    for (const id of ["k-prebytok1", "k-prebytok2", "k-prebytok3"]) expect(scenar.kroky[i(id)]?.kto).toBe("bot");
    expect(naTahu(pri("k-prebytok1"))).toBe(1);
    expect(silaPriazne(data, pri("k-prebytok1"), "EXEKUTOR", 1)).toBe(0);
    expect(silaPriazne(data, po("k-prebytok1"), "EXEKUTOR", 1)).toBe(1);
    expect(silaPriazne(data, po("k-prebytok2"), "EXEKUTOR", 1)).toBe(2);
    const s = po("k-prebytok3");
    expect(silaPriazne(data, s, "EXEKUTOR", 1)).toBe(3);
    expect(s.hraci[1].cigarety).toBe(pri("k-prebytok1").hraci[1].cigarety + 1);
    expect(body(s)).toEqual([5, -1]);
  });

  it("časť končí uprostred partie: 2. kolo, hráč vyhral a vyberá ďalší cieľ", () => {
    const s = prehrajVyucbu(data, scenar, scenar.kroky.length);
    expect(s.koniec).toBeNull();
    expect(s.kolo).toBe(2);
    expect(s.faza).toBe("volbaCiela");
    expect(naTahu(s)).toBe(0);
    // Rozpis úrovní: 2. kolo ponúkne lokality úrovne 2 (2. časť učí úrovne, Michal 2026-10-27).
    expect(lokalityNaVyber(data, s).map((k) => k.defId)).toEqual(["ihrisko", "benzinka", "zberny_dvor"]);
    for (const k of lokalityNaVyber(data, s)) expect(urovenLokality(data, k.defId), k.defId).toBe(2);
    expect(viewFor(data, s, 0).lokalityVHre.map((k) => k.defId)).toEqual(["ihrisko", "benzinka", "zberny_dvor"]);
    // Karta Dlh z 1. kola zhorela pri exekúcii (bez prahu, 2026-10-28).
    expect(prahyHraca(data, s, 0).priznaneDlhy).toBe(0);
    // Kroky o starších po bitke bežia už v 2. kole — UI ich ukáže namiesto výberu lokality.
    expect(i("i-oranzova")).toBe(i("k-prebytok3") + 1);
    expect(pri("i-oranzova").kolo).toBe(2);
  });

  it("kandidáti rozhodnutia idú klientovi všetci ako uid, alebo žiadny — inak klient zvýrazní len tie s uid", () => {
    // „ruka:pijan“ vedľa „ruka:pijan#2“ svietil len zlý Pijan (prvé prejdenie 1. časti v prehliadači).
    for (const [n, krok] of scenar.kroky.entries()) {
      if (krok.volba === undefined) continue;
      const kluce = prelozKluceZvyraznenia(prehrajVyucbu(data, scenar, n), krok.volba.kandidati);
      const sUid = kluce.filter((k) => k.startsWith("uid:")).length;
      expect([0, kluce.length], `${krok.id}: ${kluce.join(", ")}`).toContain(sUid);
    }
  });

  it("každý kľúčový pojem má kvíz (Michal: kvíz po každom pojme), NA EX v 1. časti nie", () => {
    const kvizy = scenar.kroky.filter((k) => k.kto === "otazka").map((k) => k.id);
    for (const id of ["q-senok", "q-povera", "q-spoj", "q-pitky", "q-dlh", "q-zhromazdenie", "q-fazy", "q-dlh-karta", "q-bitka", "q-starsi", "q-prebytok", "q-lokality"]) {
      expect(kvizy).toContain(id);
    }
    expect(scenar.kroky.some((k) => k.prikaz?.type === "naex")).toBe(false);
  });
});

describe("výučba Prvá hra — pripomienky Michala k 1. časti (#107, 2026-10-25)", () => {
  const krok = (id: string): ScenarVyucby["kroky"][number] => {
    const k = scenar.kroky.find((x) => x.id === id);
    if (k === undefined) throw new Error(`Scenár nemá krok ${id}`);
    return k;
  };
  /** Všetko, čo Melichar v scenári povie — hlášky, možnosti kvízov aj vysvetlenia. */
  const reci = scenar.kroky.flatMap((k) => [k.melichar, ...(k.moznosti ?? []).flatMap((m) => [m.text, m.vysvetlenie]), ...(k.volba?.zle ?? []).map((z) => z.text)]);

  it("fázy kola menuje ako os kola: Voľba cieľa → Draft → Zhromaždenie → Pitka → Bitka; šenok patrí do Draftu", () => {
    expect(krok("i-fazy").melichar).toContain("Voľba cieľa, Draft, Zhromaždenie, Pitka, Bitka");
    expect(krok("i-senok").melichar).toMatch(/^Teraz je Draft\./);
    expect(reci.some((t) => /šenok, Zhromaždenie|šenkovom drafte/.test(t))).toBe(false);
  });

  it("v Bitke sa ráta Poškodenie s piktogramami, v Pitke sa pije a fajčí; nezrozumiteľná veta je preč", () => {
    const fazy = krok("i-fazy").melichar;
    expect(fazy).toContain("v Pitke sa pije a fajčí");
    expect(fazy).toContain("v Bitke sa ráta Poškodenie ([Pohoršenie] [Rana] [Pecka] [Petelica] [Povera])");
    expect(reci.some((t) => /bez stola niet čo platiť/.test(t))).toBe(false);
  });

  it("karty sa zhromažďujú a hrajú, nie kladú; pečeň bez „stôl napočíta“ a Cirhóza je dedinská kliatba", () => {
    expect(reci.filter((t) => /klad/i.test(t))).toEqual([]);
    expect(reci.filter((t) => /stôl napočíta|zlú kartu/.test(t))).toEqual([]);
    expect(krok("i-pitky").melichar).toContain("dvakrát zhromažďujete a dvakrát pijete");
    expect(krok("i-pecen").melichar).toMatch(/^\[PoškodeniePečene\] Poškodenie pečene:/);
    expect(krok("i-pecen").melichar).toContain("dostaneš Cirhózu — dedinskú kliatbu!");
  });

  it("zmysel Zhromaždenia a prečo Pitka po ňom — Michalove vety", () => {
    expect(krok("q-zhromazdenie").moznosti?.find((m) => m.spravna)?.text).toBe("Hrám karty, aby sa moje akcie spojili, ideálne v môj prospech.");
    const ucet = krok("i-ucet").melichar;
    expect(ucet).toMatch(/^V Pitke pribúdajú Dlhy a poškodzuje sa pečeň/);
    expect(ucet).toContain("V Pitke tiež získavaš cigarety");
    expect(reci.some((t) => /najprv sa naleje/i.test(t))).toBe(false);
  });

  it("výber lokality svieti lokalitu na stole a tlačidlo otočiť; druhá Pitka svieti spoje lokality na oboch stranách", () => {
    expect(krok("k-ciel").zvyraznit).toEqual(expect.arrayContaining(["lokalita-navrh", "tlacidlo:otocit"]));
    expect(krok("i-pitky").zvyraznit).toEqual(["os-kola", "spoje-lokality"]);
    // Na oboch stranách lokality je pri hláške spojená akcia — inak by „spoje-lokality“ ukázali len jednu stranu.
    const s = prehrajVyucbu(data, scenar, scenar.kroky.findIndex((k) => k.id === "i-pitky"));
    expect(evaluateLine(data, lineState(s)).aktivneStredu).toEqual([1, 1]);
  });
});

describe("výučba — hlášky Melichara zo soundboardu (Michal 2026-10-27)", () => {
  // Pole „hlaska“ = „skupina/súbor bez prípony“ z data/majster_melichar (priečinok je mimo gitu,
  // existenciu súborov overil Vymyselník pri zápise). Hlášky na posúdenie sa vo výučbe nepoužijú.
  const SKUPINY = ["pohoda", "bieda", "nervy", "reci", "udiv", "urazky", "vyhrazky"];
  type SHlaskou = { readonly hlaska?: string };
  const hlasky = scenar.kroky.flatMap((k) => [
    (k as SHlaskou).hlaska,
    ...(k.volba?.zle ?? []).map((z) => (z as SHlaskou).hlaska),
    ...(k.moznosti ?? []).map((m) => (m as SHlaskou).hlaska),
  ]);

  it("každá hláška má tvar skupina/súbor zo známej skupiny; nie v každej bubline", () => {
    const pouzite = hlasky.filter((h): h is string => h !== undefined);
    expect(pouzite.length).toBeGreaterThan(10);
    for (const h of pouzite) {
      expect(h).toMatch(/^[a-z]+\/[^/\s.]+$/);
      expect(SKUPINY, h).toContain(h.split("/")[0]);
    }
    // „Nemusia v každom chatovom okne“ — najviac polovica krokov.
    expect(scenar.kroky.filter((k) => (k as SHlaskou).hlaska !== undefined).length).toBeLessThanOrEqual(scenar.kroky.length / 2);
  });

  it("hláška pri kvíze len pri zlej odpovedi a „BOHA jeho!“ z textu zaznie aj nahlas", () => {
    for (const k of scenar.kroky) for (const m of k.moznosti ?? []) if ((m as SHlaskou).hlaska !== undefined) expect(m.spravna, k.id).toBe(false);
    const prebytok = scenar.kroky.find((k) => k.id === "k-prebytok1");
    expect(prebytok?.melichar).toContain("BOHA jeho!");
    expect((prebytok as SHlaskou | undefined)?.hlaska).toBe("udiv/09_Boha");
  });
});

describe("výučba — hláška v kroku a v rade (Michal 2026-10-27)", () => {
  it("krok nesie hlášku zo scenára; rada k zlému ťahu nesie hlášku vzoru, všeobecná je bez nej", () => {
    expect(scenar.kroky.find((k) => k.id === "i-vitaj")?.hlaska).toBe("reci/sem_pod2");
    const i = scenar.kroky.findIndex((k) => k.id === "k-ciel");
    const volba = scenar.kroky[i]?.volba as VolbaKroku;
    const s = prehrajVyucbu(data, scenar, i);
    const zly = volba.zle?.find((z) => z.hlaska !== undefined);
    expect(zly).toBeDefined();
    const cmd = prikazZoScenara(s, 0, zly?.prikaz ?? { type: "pass" });
    expect(radaVyucby(s, volba, cmd)).toEqual({ text: zly?.text, hlaska: zly?.hlaska });
    expect(radaVyucby(s, { kandidati: [], inak: "Skús inú." }, cmd)).toEqual({ text: "Skús inú.", hlaska: null });
  });

  it("hláška sa rozloží na skupinu a súbor; overScenar odmietne zlý tvar", () => {
    expect(castiHlasky("udiv/09_Boha")).toEqual({ skupina: "udiv", meno: "09_Boha" });
    expect(castiHlasky("09_Boha")).toBeNull();
    expect(castiHlasky("udiv/a/b")).toBeNull();
    expect(nazovHlasky("09_Boha")).toBe("Boha");
    const zly: ScenarVyucby = { ...scenar, kroky: scenar.kroky.map((k, j) => (j === 0 ? { ...k, hlaska: "bez-skupiny" } : k)) };
    expect(overScenar(data, zly)).toMatch(/hláška „bez-skupiny“/);
  });
});

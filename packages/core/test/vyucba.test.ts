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
  pocetAbstakov,
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
  castKroku,
  castiScenara,
  hlaskaPriChybe,
  koniecCastiPoKroku,
  pauzaKrokuVyucby,
  pocetPitiek,
  poskodenieBitky,
  prahyHraca,
  porovnajSKrokom,
  prelozKluceZvyraznenia,
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
  vykonajKrok,
  zacniVyucbu,
  zodpovedaVzoru,
  zhodnyPrikaz,
} from "../src/index.ts";


const data = loadGameData(cardsJson, eldersJson, scorecardsJson);
/** Celá výučba: tri časti v jednej partii (roadmapa #105). */
const celyScenar = scenarJson as unknown as ScenarVyucby;
const koniecPrvej = celyScenar.kroky.findIndex((k) => k.koniecCasti === 1);
/** 1. časť ako samostatný scenár — testy 1. časti rátajú s jej koncom uprostred partie. */
const scenar: ScenarVyucby = { ...celyScenar, casti: (celyScenar.casti ?? []).slice(0, 1), kroky: celyScenar.kroky.slice(0, koniecPrvej + 1) };
/** 2. a 3. časť (Vymyselník 2026-10-28). */
const pokracovanie = celyScenar.kroky.slice(koniecPrvej + 1);
const hlaskyChyby = celyScenar.hlaskyChyby ?? [];

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
    const uids = [...s.hraci[0].ruka, ...s.hraci[1].ruka, ...s.lokalityVHre, ...s.naradie, ...s.obcania, ...s.starsi.map((e) => e.karta)].map((k) => k.uid);
    expect(new Set(uids).size).toBe(uids.length);
  });

  it("variant karty, scorecard a balíčky Náradie a Občania sa dajú zadať; neznáme hodnoty sú chyba", () => {
    const sc = data.scorecards[3]!.id;
    const s = setupZRozdania(data, {
      ...r,
      scorecardy: { farar: sc },
      naradie: ["puska"],
      obcania: ["hasic", "sofer/1/0"],
      hraci: [{ ...r.hraci[0], ruka: ["hasic/0/1"] }, r.hraci[1]],
    });
    expect(s.starsi.find((e) => e.elderId === "farar")?.scorecard).toBe(sc);
    // Nástroj nemá sloty, len jeden variant (rework Náradia, sada v70) — iný ako 0/0 je chyba.
    expect(s.naradie.map((k) => `${k.defId}/${k.leftLayout}/${k.rightLayout}`)).toEqual(["puska/0/0"]);
    expect(() => setupZRozdania(data, { ...r, naradie: ["puska/0/1"] })).toThrow(/1×1 variantov/);
    expect(s.obcania.map((k) => `${k.defId}/${k.leftLayout}/${k.rightLayout}`)).toEqual(["hasic/0/0", "sofer/1/0"]);
    // Scenár spred v8.5 s jedným spoločným balíčkom: rozdelí sa podľa druhu, poradie ostáva.
    // Scenár výučby už má naradie/obcania (tie by spoločný balíček prepísali) — starý tvar bez nich.
    const stary = setupZRozdania(data, { seed: r.seed, lokality: r.lokality, utocnik: r.utocnik, hraci: r.hraci, spolocnyBalicek: ["hasic", "puska", "svokra"] });
    expect(stary.naradie.map((k) => k.defId)).toEqual(["puska"]);
    expect(stary.obcania.map((k) => k.defId)).toEqual(["hasic", "svokra"]);
    // Sada B+ (v11): Hasič má jedno ľavé rozloženie a dve pravé.
    expect(s.hraci[0].ruka[0]?.rightLayout).toBe(1);
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
    const s0 = zacniVyucbu(data, scenar);
    // Dvaja rovnakí sú v balíčku Štamgasta (Anonymní alkoholici, prídu dobratím v 2. kole, v11.21) — tu ich dáme do ruky.
    const bot = s0.hraci[1];
    const s: GameState = { ...s0, hraci: [s0.hraci[0], { ...bot, ruka: [...bot.ruka, ...bot.doberaci] }] };
    const alkoholici = s.hraci[1].ruka.filter((k) => k.defId === "anonymny_alkoholik");
    expect(uidZOdkazu(s, 1, "ruka:anonymny_alkoholik")).toBe(alkoholici[0]?.uid);
    expect(uidZOdkazu(s, 1, "ruka:anonymny_alkoholik#2")).toBe(alkoholici[1]?.uid);
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
    expect(p.chybajuce.map((x) => x.popis)).toEqual(["vypi poldeci (Vypiť)", `polož kartu „${meno(b)}“ na koniec línie vľavo`]);
    expect(p.chybajuce[1]?.uid).toBe(b.uid);
    expect(textChybyKroku(p)).toBe(`Takto nie — ešte chýba: vypi poldeci (Vypiť), polož kartu „${meno(b)}“ na koniec línie vľavo.`);
  });

  it("celý ťah v inom poradí prejde; karta na zlé miesto je navyše aj chýba", () => {
    const kroky = ocakava.type === "tah" ? ocakava.kroky : [];
    expect(porovnajSKrokom(data, state, { type: "tah", kroky: [...kroky].reverse() }, ocakava).zhoda).toBe(true);
    const zle = kroky.map((c) => (c.type === "place" && c.uid === a.uid ? { ...c, target: "superova" as const } : c));
    const p = porovnajSKrokom(data, state, { type: "tah", kroky: zle }, ocakava);
    expect(p.zhoda).toBe(false);
    expect(p.navyse.map((x) => x.popis)).toEqual([`polož kartu „${meno(a)}“ na koniec línie vpravo`]);
    expect(p.chybajuce.map((x) => x.popis)).toEqual([`polož kartu „${meno(a)}“ na koniec línie vľavo`]);
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
    expect(radaVyucby(state, volba, { type: "pass" }).text).toBe("Ešte nepasuj.");
    expect(radaVyucby(state, volba, { type: "skipNaex" }).text).toBe("Skús inú kartu.");
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
  it("Nakladačka a reči pri zlom staršom: text povie meno správneho (v11 jeden zámer so zdvihmi)", () => {
    const state = setupGame(data, 7);
    const [a, b] = state.starsi;
    if (a === undefined || b === undefined) throw new Error("starší");
    const meno = defOf(data, a.karta).name;
    const p = porovnajSKrokom(data, state, { type: "prebytok", zdvihy: [{ elderId: b.elderId, na: 1 }] }, { type: "prebytok", zdvihy: [{ elderId: a.elderId, na: 1 }] });
    expect(p.chybajuce.map((x) => x.popis)).toEqual([`rozdeľ Nakladačku na strach: „${meno}“`]);
    expect(textChybyKroku(p)).toContain(meno);
    const r = porovnajSKrokom(data, state, { type: "reci", zdvihy: [{ elderId: b.elderId, na: 1 }] }, { type: "reci", zdvihy: [{ elderId: a.elderId, na: 1 }] });
    expect(r.chybajuce.map((x) => x.popis)).toEqual([`rozdeľ hádku na reči: „${meno}“`]);
  });
});

describe("výučba — cigareta pre Melichara (Michal 2026-10-25; len raz, prerobenie výučby 2026-10-30)", () => {
  const iVitaj = scenar.kroky.findIndex((k) => k.id === "i-vitaj");
  const iStarsi = scenar.kroky.findIndex((k) => k.id === "i-starsi");

  it("hráč začína s 10 a cigaretu dá Melicharovi len v úvode; po 1. časti má 8, Štamgast 7", () => {
    // Playtest výučby 20261030-184959: žiadanie cigarety 3× unavovalo — ostalo jediné, v úvode.
    expect(celyScenar.kroky.filter((k) => k.odovzdaCigaretu === true).map((k) => k.id)).toEqual(["i-vitaj"]);
    // Prvé kolo (2026-11-10): hráč vyloží tri karty a za pas nedostane nič — 10 − 1 Melichar − 1 Vymáhač = 8 ako doteraz.
    expect(zacniVyucbu(data, scenar).hraci[0].cigarety).toBe(10);
    expect(prehrajVyucbu(data, scenar, iVitaj + 1).hraci[0].cigarety).toBe(9);
    expect(prehrajVyucbu(data, scenar, iStarsi).hraci[0].cigarety).toBe(8);
    expect(prehrajVyucbu(data, scenar, iStarsi + 1).hraci[0].cigarety).toBe(8);
    const koniec = prehrajVyucbu(data, scenar, scenar.kroky.length);
    // Štamgast: 5 − 1 Traktorista + 2 zo zdvojenej Cigarety Traktoristu + 1 za prehru (v12 bez Fajčiara: Nakladačka 3
    // ide celá na Farára, Autobusár sa v 1. kole nebojí).
    expect([koniec.hraci[0].cigarety, koniec.hraci[1].cigarety]).toEqual([8, 7]);
  });

  it("úvod ponúkne preskočenie a tlačidlá majú nápis zo scenára; posledný krok uzavrie časť", () => {
    expect(scenar.kroky[iVitaj]).toMatchObject({ kto: "info", tlacidlo: "Dať cigaretu", preskocenie: true });
    expect(scenar.kroky[iStarsi]?.tlacidlo).toBeUndefined();
    expect(scenar.kroky.at(-1)).toMatchObject({ id: "i-dovidenia", kto: "info", tlacidlo: "Dokončiť 1. časť" });
  });

  it("bez cigarety ju hráč odovzdať nemôže; odovzdanie a naneisto len pri info kroku", () => {
    const chudak: ScenarVyucby = { ...scenar, rozdanie: { ...scenar.rozdanie, hraci: [{ ...scenar.rozdanie.hraci[0], cigarety: 0 }, scenar.rozdanie.hraci[1]] } };
    expect(overScenar(data, chudak)).toMatch(/i-vitaj.*nemá cigaretu/);
    const zlyKrok: ScenarVyucby = { ...scenar, kroky: scenar.kroky.map((k) => (k.id === "k-masiar" ? { ...k, odovzdaCigaretu: true } : k)) };
    expect(overScenar(data, zlyKrok)).toMatch(/k-masiar.*len k info kroku/);
    const bezZvyraznenia: ScenarVyucby = { ...scenar, kroky: scenar.kroky.map((k) => (k.id === "i-senok" ? { ...k, zvyraznit: [] } : k)) };
    expect(overScenar(data, bezZvyraznenia)).toMatch(/i-senok.*naneisto bez zvýraznených/);
  });

  it("ponuka nanečisto: i-senok partiu nemení, rozloženie určí až k-stavba (stavia Melichar)", () => {
    const iSenok = scenar.kroky.findIndex((k) => k.id === "i-senok");
    expect(scenar.kroky[iSenok]).toMatchObject({ kto: "info", naneisto: true });
    expect(scenar.kroky[iSenok + 1]).toMatchObject({ id: "k-stavba", kto: "auto" });
    expect(JSON.stringify(prehrajVyucbu(data, scenar, iSenok + 1))).toBe(JSON.stringify(prehrajVyucbu(data, scenar, iSenok)));
  });
});

describe("výučba Prvá hra — 1. časť „Prvé kolo“ (docs/napady/prvy-dojem-navstevnika.html, Michal 2026-11-10)", () => {
  const i = (id: string): number => {
    const n = scenar.kroky.findIndex((k) => k.id === id);
    if (n < 0) throw new Error(`Scenár nemá krok ${id}`);
    return n;
  };
  /** Stav, ktorý hráč vidí pri texte kroku `id` (pred jeho príkazom). */
  const pri = (id: string): GameState => prehrajVyucbu(data, scenar, i(id));
  /** Stav po príkaze kroku `id`. */
  const po = (id: string): GameState => prehrajVyucbu(data, scenar, i(id) + 1);
  const odhad = (s: GameState): readonly number[] => poskodenieBitky(data, s, evaluateLine(data, lineState(s)).sums).celkove;
  // Špaky v popolníku. Nie „keby skončila teraz“ — to od 2026-10-27 pridáva výkupné poldeci a cigariet.
  const body = (s: GameState): readonly number[] => spakyTeraz(viewFor(data, s, 0)).spaky;
  /** Všetko, čo Melichar v 1. časti povie. */
  const texty = scenar.kroky.flatMap((k) => [k.melichar, ...(k.moznosti ?? []).flatMap((m) => [m.text, m.vysvetlenie]), ...(k.volba?.zle ?? []).map((z) => z.text), k.volba?.inak ?? ""]);

  it("1. časť: verzia scenára a číslo časti (hviezdička), tri lokality úrovne 1, Farár so scorecardom Advokát", () => {
    expect(celyScenar).toMatchObject({ id: "prva-hra", zverejnena: true });
    expect(celyScenar.casti?.[0]).toMatchObject({ cast: 1, nazov: "Prvé kolo", od: "i-vitaj", po: "i-dovidenia" });
    // v11.13 (2026-11-07): lokality, reči na súperovom teplomere, natáčanie (docs/napady/vyucba-v11-13.html).
    // Prvé kolo (2026-11-10): 13 slov jadra, rozdanie bez Hazardu, pečene a Povery, jedno NA EX hráča.
    expect(scenar.verzia).toBe("v11-20-prve-kolo-2026-11-10");
    expect(lokalityNaVyber(data, pri("k-ciel")).map((k) => k.defId)).toEqual(["lesna_cesta", "jednota", "cintorin"]);
    for (const k of lokalityNaVyber(data, pri("k-ciel"))) expect(urovenLokality(data, k.defId), k.defId).toBe(1);
    expect(scenar.rozdanie.scorecardy).toMatchObject({ farar: "ADVOKAT", krcmarka: "LAKOMEC" });
  });

  it("pojmy: jedno nové slovo na krok, najviac 25 slov v bubline; slová mimo jadra hráč v 1. časti nepočuje", () => {
    // Slová ako tokeny bez piktogramov ([Rana]) — tie sú obrázky, nie slová.
    const slova = (t: string): number => t.replace(/\[[^\]]+\]/g, "").split(/\s+/).filter((w) => /\p{L}|\d/u.test(w)).length;
    for (const k of scenar.kroky) if (k.id !== "i-vitaj" && k.id !== "i-toto-vies") expect(slova(k.melichar), `${k.id}: ${k.melichar}`).toBeLessThanOrEqual(25);
    // Von (Michal 2026-11-10): bar, Draft, šenok, tuhé, scorecard, Partia, balíčky Náradie a Občania; druhá vrstva príde v 2. časti.
    const von = /(?<!\p{L})(bar|bare|Draft\p{L}*|šen\p{L}*|Šen\p{L}*|tuh\p{L}*|scorecard\p{L}*|Parti\p{L}*|Náradi\p{L}*|Občani\p{L}*|hádk\p{L}*|reč\p{L}*|priaz\p{L}*|Advokát\p{L}*|exekútor\p{L}*|Hazard\p{L}*|Dlh\p{L}*|pečeň\p{L}*|Cirhóz\p{L}*|Nakladačk\p{L}*|limit\p{L}*|hran\p{L}*|finále)(?!\p{L})/u;
    expect(texty.filter((t) => von.test(t))).toEqual([]);
    // Zhrnutie na konci menuje všetkých 13 slov jadra.
    const zhrnutie = scenar.kroky[i("i-toto-vies")]?.melichar ?? "";
    for (const slovo of ["špaky", "bitka", "lokalita", "akcie a údery", "ponuka", "cigarety", "Zhromaždenie", "línia", "poldeci", "spoj", "Pitka", "NA EX", "starší a strach"]) expect(zhrnutie).toContain(slovo);
    expect(i("i-toto-vies")).toBe(i("i-dovidenia") - 1);
  });

  it("schválené znenia Michala (q-spoj, q-zhromazdenie) a cieľ hry hneď na začiatku", () => {
    expect(scenar.kroky[i("q-spoj")]?.moznosti?.find((m) => m.spravna)?.text).toBe("Na spoji stretla Pecku Lesnej cesty v rovnakej výške.");
    expect(scenar.kroky[i("q-zhromazdenie")]?.moznosti?.find((m) => m.spravna)?.text).toBe("Hrám karty, aby sa moje akcie spojili, ideálne v môj prospech.");
    expect(scenar.kroky[i("i-zhromazdenie")]?.melichar).toContain("Zhromaždenie je podstata hry");
    // Playtest výučby 20261030-184959 (3/3): cieľ hry a čo sú špaky v druhom kroku.
    expect(i("i-lokalita")).toBe(1);
    for (const kus of ["špaky", "na konci viac", "Dole pri sebe"]) expect(scenar.kroky[1]?.melichar).toContain(kus);
  });

  it("Lesnú cestu si hráč vyberie sám, Peckou k sebe; zlá lokalita aj zlé natočenie dostanú radu Melichara", () => {
    const krok = scenar.kroky[i("k-ciel")];
    expect(krok).toMatchObject({ kto: "hrac", prikaz: { type: "chooseLocation", uid: "lokality:lesna_cesta", otocena: false } });
    const s = pri("k-ciel");
    const volba = krok?.volba as VolbaKroku;
    const uid = (id: string): number => uidZOdkazu(s, 0, `lokality:${id}`);
    expect(radaVyucby(s, volba, { type: "chooseLocation", uid: uid("lesna_cesta"), otocena: true }).text).toMatch(/Otoč ju/);
    expect(radaVyucby(s, volba, { type: "chooseLocation", uid: uid("jednota"), otocena: true }).text).toMatch(/Jednote/);
    expect(radaVyucby(s, volba, { type: "chooseLocation", uid: uid("cintorin"), otocena: false }).text).toMatch(/Cintoríne/);
  });

  it("Pijan namiesto Mäsiara by s Peckou cesty spojil Poldeci — rada Melichara to povie", () => {
    const s = pri("k-masiar");
    const zly: Command = { type: "tah", kroky: [{ type: "place", uid: uidZOdkazu(s, 0, "ruka:pijan"), target: "vlastna" }] };
    expect(evaluateLine(data, lineState(apply(data, s, zly, 0).state)).sums[0]).toMatchObject({ Pecka: 1, Poldeci: 1 });
    expect(radaVyucby(s, scenar.kroky[i("k-masiar")]?.volba as VolbaKroku, zly).text).toMatch(/Poldeci/);
  });

  it("čísla v hláškach sedia s jadrom: 4 : 0 → 4 : 6 → 8 : 6 → 8 : 9 → 10 : 9, NA EX → 10 : 7, jedna Pitka", () => {
    expect(odhad(po("k-zh-bot1"))).toEqual([0, 0]);
    expect(odhad(po("k-masiar"))).toEqual([4, 0]);
    // v12 (Michal 2026-11-11: „Nechať Traktoristu, prečíslovať“): s prevahou v jeho kraji má Traktorista Pecku navyše.
    expect(odhad(po("k-zh-bot2"))).toEqual([4, 6]);
    expect(scenar.kroky[i("k-zh-bot2")]?.melichar).toContain("s prevahou má Traktorista [Pecka] Pecku navyše: 4 : 6");
    expect(odhad(po("k-vymahac"))).toEqual([8, 6]);
    expect(odhad(po("k-zh-bot3"))).toEqual([8, 9]);
    expect(odhad(po("k-zahradkar"))).toEqual([10, 9]);
    for (const [id, cislo] of [["k-vymahac", "8 : 6"], ["k-zh-bot3", "8 : 9"], ["k-zahradkar", "10 : 9"]] as const) expect(scenar.kroky[i(id)]?.melichar, id).toContain(cislo);
    // Štamgast so Lesnou cestou nič nespojí — jedna Zhromaždenie, jedna Pitka (počet Pitiek príde v 2. časti).
    expect(po("k-zahradkar")).toMatchObject({ faza: "pitka", pitkyCelkom: 1 });
    // V spojoch 1. kola sú len údery — žiadny Hazard, pečeň, Povera ani Posilnenie (rozdanie podľa 3b).
    for (const strana of [0, 1] as const) {
      const sums = evaluateLine(data, lineState(po("k-zahradkar"))).sums[strana];
      for (const a of Object.keys(sums)) expect(["Rana", "Pecka", "Petelica"], `strana ${strana}: ${a}`).toContain(a);
    }
    // Lesná cesta dá 2 tuhé za Zviera — v 1. kole žiadne Zviera neleží (texty kariet sa v 1. časti nehrajú).
    expect(po("k-zahradkar").strany.flat().some((pl) => defOf(data, pl.card).tags.includes("Zviera"))).toBe(false);
  });

  it("NA EX hráča na Traktoristu zhasne jeho dve Rany, Pecka navyše ostane: 10 : 7, bitka čaká na Nakladačku 3; Štamgast NA EX nedá", () => {
    expect(scenar.kroky.filter((k) => k.prikaz?.type === "naex").map((k) => [k.id, k.kto])).toEqual([["k-naex", "hrac"]]);
    const bitka = pri("i-bitka");
    expect(bitka.strany[1].find((pl) => pl.card.defId === "traktoristka")?.naexBy).toBe(0);
    expect(bitka.bitkaStav).toMatchObject({ krok: "prebytok", caka: 0, vitaz: 0, prebytokZostava: 3, damage: { tuhe: [10, 7], makke: [0, 0] } });
    expect(scenar.kroky[i("i-bitka")]?.melichar).toContain("Vyhral si o 3");
    // Šesť kariet v línii, bez starších a bez exekútora (Dlh nemá nikto).
    expect(body(bitka)).toEqual([6, 0]);
    expect(bitka.nastenka.at(-1)).toMatchObject({ kolo: 1, karty: 6, zaBitku: [6, 0], zaStarsich: [0, 0], exekutor: [0, 0], pitky: 1 });
    expect([bitka.hraci[0].dlhy, bitka.hraci[1].dlhy]).toEqual([0, 0]);
    expect(bitka.hraci[0].odhadzovaci.some((k) => k.defId === "cirhoza")).toBe(false);
  });

  it("Nakladačku 3 minie hráč na strach (Farár 1 + 2); hádka ani reči v 1. časti nie sú", () => {
    expect(scenar.kroky[i("k-nakladacka1")]).toMatchObject({ kto: "hrac", prikaz: { type: "prebytok", zdvihy: [{ elderId: "farar", na: 2 }] } });
    expect(i("k-nakladacka1")).toBe(i("i-starsi") + 1);
    expect(naTahu(pri("k-nakladacka1"))).toBe(0);
    const s = po("k-nakladacka1");
    expect(s.starsi.find((e) => e.elderId === "farar")).toMatchObject({ strach: [2, 0], reci: [0, 0] });
    expect(s.starsi.filter((e) => e.elderId !== "farar").every((e) => e.strach[0] + e.strach[1] === 0)).toBe(true);
    expect(s.starsi.every((e) => e.reci[0] + e.reci[1] === 0)).toBe(true);
    // Priazeň z rozdielu strachu (Advokát 2 pre Štamgasta) vysvetlí až 2. časť (i-priazen).
    expect(silaPriazne(data, s, "ADVOKAT", 1)).toBe(2);
    expect(body(s)).toEqual([6, 0]);
    expect(scenar.kroky.some((k) => k.prikaz?.type === "reci")).toBe(false);
  });

  it("časť končí uprostred partie: 2. kolo, hráč vyhral a vyberá ďalší cieľ", () => {
    const s = prehrajVyucbu(data, scenar, scenar.kroky.length);
    expect(s.koniec).toBeNull();
    expect(s).toMatchObject({ kolo: 2, faza: "volbaCiela" });
    expect(naTahu(s)).toBe(0);
    // Dobratie do troch (v11.9, i-vitaj2): hráč mal dve karty a dobral Pijana, Štamgast má štyri a nedobral nič.
    expect(s.hraci[0].ruka.map((k) => k.defId)).toEqual(["pijan", "ministrant", "pijan"]);
    expect(s.hraci[1].ruka.map((k) => k.defId)).toEqual(["cierna_macka", "pijan", "anonymny_alkoholik", "anonymny_alkoholik"]);
    // Poldeci z NA EX sa na začiatku 2. kola dolial.
    expect(s.hraci[0]).toMatchObject({ poldeciPlne: 2, poldeciVypite: 0 });
    expect(lokalityNaVyber(data, s).map((k) => k.defId)).toEqual(["ihrisko", "benzinka", "zberny_dvor"]);
    for (const k of lokalityNaVyber(data, s)) expect(urovenLokality(data, k.defId), k.defId).toBe(2);
    expect(viewFor(data, s, 0).lokalityVHre.map((k) => k.defId)).toEqual(["ihrisko", "benzinka", "zberny_dvor"]);
    expect(prahyHraca(data, s, 1).priznaneDlhy).toBe(0);
    expect(pri("q-starsi").kolo).toBe(2);
  });

  it("kandidáti rozhodnutia idú klientovi všetci ako uid, alebo žiadny — inak klient zvýrazní len tie s uid", () => {
    for (const [n, krok] of scenar.kroky.entries()) {
      if (krok.volba === undefined) continue;
      const kluce = prelozKluceZvyraznenia(prehrajVyucbu(data, scenar, n), krok.volba.kandidati);
      const sUid = kluce.filter((k) => k.startsWith("uid:")).length;
      expect([0, kluce.length], `${krok.id}: ${kluce.join(", ")}`).toContain(sUid);
    }
  });

  it("kvíz až po použití pojmu; presunuté kvízy sú v 2. časti", () => {
    const kvizy = scenar.kroky.filter((k) => k.kto === "otazka").map((k) => k.id);
    expect(kvizy).toEqual(["q-spoj", "q-zhromazdenie", "q-bitka", "q-lokality", "q-starsi"]);
    const druha = pokracovanie.filter((k) => k.kto === "otazka").map((k) => k.id);
    for (const id of ["q-senok", "q-povera", "q-pitky", "q-dlh", "q-fazy", "q-dlh-karta", "q-prebytok"]) expect(druha, id).toContain(id);
    for (const [id, pojem] of [["q-spoj", "k-masiar"], ["q-zhromazdenie", "k-zahradkar"], ["q-bitka", "i-bitka"], ["q-starsi", "k-nakladacka1"]] as const) expect(i(id), id).toBeGreaterThan(i(pojem));
  });
});

describe("výučba Prvá hra — presunuté kroky 1. časti v 2. časti (Michal 2026-11-10: nič sa nestráca)", () => {
  const krok = (id: string): ScenarVyucby["kroky"][number] => {
    const k = celyScenar.kroky.find((x) => x.id === id);
    if (k === undefined) throw new Error(`Scenár nemá krok ${id}`);
    return k;
  };
  const index = (id: string): number => celyScenar.kroky.findIndex((k) => k.id === id);
  /** Všetko, čo Melichar v scenári povie — hlášky, možnosti kvízov aj vysvetlenia. */
  const reci = celyScenar.kroky.flatMap((k) => [k.melichar, ...(k.moznosti ?? []).flatMap((m) => [m.text, m.vysvetlenie]), ...(k.volba?.zle ?? []).map((z) => z.text)]);

  it("presunuté kroky sú v 2. časti", () => {
    for (const id of ["i-fazy", "i-preco-senok", "i-pitky", "i-pitka-ucet", "i-zadlzenie", "i-stupne", "i-cena-posunu", "i-body", "i-priazen"]) {
      expect(index(id), id).toBeGreaterThan(koniecPrvej);
      expect(castKroku(celyScenar, index(id))?.cast, id).toBe(2);
    }
  });

  it("fázy kola menuje ako os kola: Voľba cieľa → Ponuka → Zhromaždenie → Pitka → Bitka (šenok je od 2026-11-10 Ponuka)", () => {
    expect(krok("i-fazy").melichar).toContain("Voľba cieľa, Ponuka, Zhromaždenie, Pitka, Bitka");
    expect(krok("i-fazy").melichar).toContain("v Zhromaždení ich hráš k Ihrisku");
    expect(reci.some((t) => /šenok, Zhromaždenie|šenkovom drafte/.test(t))).toBe(false);
    // Slovo šenok hráč vo výučbe nepočuje (Michal 2026-11-10), ani Draft a bar.
    expect(reci.filter((t) => /(?<!\p{L})(šen\p{L}*|Šen\p{L}*|Draft\p{L}*|bar|bare)(?!\p{L})/u.test(t))).toEqual([]);
  });

  it("v Bitke sa ráta Poškodenie s piktogramami, v Pitke sa pije a fajčí; nezrozumiteľná veta je preč", () => {
    const fazy = krok("i-fazy").melichar;
    expect(fazy).toContain("v Pitke sa pije a fajčí");
    expect(fazy).toContain("v Bitke sa najprv hádate – ohovára sa a pohoršuje ([Povera] [Pohoršenie]) – a potom sa ráta Poškodenie ([Rana] [Pecka] [Petelica])");
    expect(reci.some((t) => /bez stola niet čo platiť/.test(t))).toBe(false);
    // Fajčenie (schválené 2026-10-27) je od 2026-11-10 v k-fajcit2.
    expect(krok("k-fajcit2").melichar).toContain("za [Cigareta] cigaretu si hneď doberieš kartu, každé ďalšie fajčenie je o cigaretu drahšie.");
  });

  it("karty sa zhromažďujú a hrajú, nie kladú; pečeň bez „stôl napočíta“ a Cirhóza je dedinská kliatba", () => {
    // „Nakladačka“ (prebytok, Michal 2026-10-30) nie je kladenie kariet.
    const prva = scenar.kroky.flatMap((k) => [k.melichar, ...(k.moznosti ?? []).flatMap((m) => [m.text, m.vysvetlenie]), ...(k.volba?.zle ?? []).map((z) => z.text)]);
    expect(prva.filter((t) => /klad(?!ačk)/i.test(t))).toEqual([]);
    expect(reci.filter((t) => /stôl napočíta|zlú kartu/.test(t))).toEqual([]);
    expect(krok("i-pitky").melichar).toContain("dvakrát zhromažďujete a dvakrát pijete");
    expect(krok("i-zadlzenie").melichar).toContain("[PoškodeniePečene] Poškodenie pečene:");
    expect(krok("i-zadlzenie").melichar).toContain("dostaneš Cirhózu — dedinskú kliatbu!");
  });

  it("prečo Pitka po Zhromaždení — Michalove vety", () => {
    const ucet = krok("i-pitka-ucet").melichar;
    expect(ucet).toContain("pridajú Dlhy a pečeň");
    expect(ucet).toContain("Preto ide Pitka až po Zhromaždení.");
    expect(index("q-fazy")).toBe(index("i-pitka-ucet") + 1);
    expect(reci.some((t) => /najprv sa naleje/i.test(t))).toBe(false);
  });

  it("výber lokality svieti lokalitu na stole a tlačidlo otočiť; druhá Pitka svieti spoje lokality na oboch stranách", () => {
    expect(krok("k-ciel").zvyraznit).toEqual(expect.arrayContaining(["lokalita-navrh", "tlacidlo:otocit"]));
    expect(krok("i-pitky").zvyraznit).toEqual(["os-kola", "spoje-lokality"]);
    // Na oboch stranách Ihriska je pri hláške spojená akcia: na trávniku dve, na tribúne jedna.
    const s = prehrajVyucbu(data, celyScenar, index("i-pitky"));
    expect(evaluateLine(data, lineState(s)).aktivneStredu).toEqual([2, 1]);
    expect(s.pitkyCelkom).toBe(2);
  });

  it("strach a Nakladačka v 2. časti: stupne, cena posunu, exekútor a priazeň vysvetlené pri 2. bitke", () => {
    expect(index("i-stupne")).toBe(index("k-nakladacka2") - 1);
    expect(index("i-cena-posunu")).toBe(index("k-nakladacka2") + 1);
    expect(index("q-prebytok")).toBe(index("i-cena-posunu") + 1);
    expect(index("i-body")).toBe(index("i-bodovanie2") + 1);
    expect(index("i-priazen")).toBe(index("i-body") + 1);
    // v11.20: hodnota stupňa 1 / 2 / 3 — žltá 1, oranžová 3, červená 6.
    expect(krok("i-stupne").melichar).toContain("žltá 1 špak, oranžová 3, červená 6");
  });
});

describe("výučba — hlášky Melichara len pri chybe hráča (Michal 2026-10-28)", () => {
  // Pole „hlaska“ = „skupina/súbor bez prípony“ z data/majster_melichar (priečinok je mimo gitu,
  // existenciu súborov overil Vymyselník pri zápise). Od 2026-10-28 zaznie hláška len pri chybe:
  // zlý ťah (volba.zle, hlaskaChyby kroku, hlaskyChyby scenára) a zlá odpoveď v kvíze.
  const SKUPINY = ["pohoda", "bieda", "nervy", "reci", "udiv", "urazky", "vyhrazky"];
  type SHlaskou = { readonly hlaska?: string; readonly hlaskaChyby?: string };
  const vsetky = [...scenar.kroky, ...pokracovanie];
  const hlasky = [
    ...vsetky.flatMap((k) => [
      (k as SHlaskou).hlaskaChyby,
      ...(k.volba?.zle ?? []).map((z) => (z as SHlaskou).hlaska),
      ...(k.moznosti ?? []).map((m) => (m as SHlaskou).hlaska),
    ]),
    ...hlaskyChyby,
  ];

  it("každá hláška má tvar skupina/súbor zo známej skupiny", () => {
    const pouzite = hlasky.filter((h): h is string => h !== undefined);
    expect(pouzite.length).toBeGreaterThan(10);
    for (const h of pouzite) {
      expect(h).toMatch(/^[a-z]+\/[^/\s.]+$/);
      expect(SKUPINY, h).toContain(h.split("/")[0]);
      expect(castiHlasky(h), h).not.toBeNull();
    }
  });

  it("žiadny krok nemá hlášku na ozdobu; kvíz má hlášku len pri zlej odpovedi", () => {
    for (const k of vsetky) expect((k as SHlaskou).hlaska, k.id).toBeUndefined();
    for (const k of vsetky) for (const m of k.moznosti ?? []) if ((m as SHlaskou).hlaska !== undefined) expect(m.spravna, k.id).toBe(false);
  });

  it("2. a 3. časť: každá zlá odpoveď a každý krok hráča má hlášku pri chybe", () => {
    for (const k of pokracovanie) {
      for (const m of k.moznosti ?? []) if (!m.spravna) expect((m as SHlaskou).hlaska, k.id).toBeDefined();
      if (k.kto === "hrac") expect((k as SHlaskou).hlaskaChyby, k.id).toBeDefined();
    }
  });
});

describe("výučba — hláška v kroku a v rade (Michal 2026-10-27)", () => {
  it("rada k zlému ťahu nesie hlášku vzoru, všeobecná je bez nej", () => {
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
    const zly: ScenarVyucby = { ...scenar, kroky: scenar.kroky.map((k, j) => (j === 0 ? { ...k, hlaskaChyby: "bez-skupiny" } : k)) };
    expect(overScenar(data, zly)).toMatch(/hláška „bez-skupiny“/);
    expect(overScenar(data, { ...scenar, hlaskyChyby: ["udiv/ok", "bez-skupiny"] })).toMatch(/Záložná hláška „bez-skupiny“/);
  });
});

describe("výučba Prvá hra — 2. a 3. časť (pravidlá v8, exekúcia po poškodení; texty schválené 2026-10-28)", () => {
  const cela = celyScenar;
  const i = (id: string): number => {
    const n = cela.kroky.findIndex((k) => k.id === id);
    if (n < 0) throw new Error(`Scenár nemá krok ${id}`);
    return n;
  };
  const pri = (id: string): GameState => prehrajVyucbu(data, cela, i(id));
  const po = (id: string): GameState => prehrajVyucbu(data, cela, i(id) + 1);
  const odhad = (s: GameState): readonly number[] => poskodenieBitky(data, s, evaluateLine(data, lineState(s)).sums).tuhe;
  const body = (s: GameState): readonly number[] => s.spaky;

  it("celá partia (1. + 2. + 3. časť) prejde v jadre od začiatku do konca hry", () => {
    expect(overScenar(data, cela)).toBeNull();
    const koniec = prehrajVyucbu(data, cela, cela.kroky.length);
    expect(koniec.koniec?.vitaz).toBe(0);
    // Frakcie (2026-11-08): finále vyhrá hráč 27 : 5 (Policajtka má Petelicu navyše proti Recidivistovi, Rany navyše
    // Pijanov zosilnia Vidly); Farára zajal v 3. kole (vo finále sa nezajíma). Hráč má dve nepriznané Cirhózy (−6):
    // 60 + vykúpenie 3 − 6 = 57, Štamgast jednu: 13 + 5 − 3 = 15. Výhra strachom ani väzňami nenastala.
    // Konflikt bez tagu (2026-11-08): hráč nemá v 2. kole Dlh z Praudovravca, exekútor mu nezobral špak — o 1 viac.
    // Pas bez ohľadu na ruku (v11.16): v 3. kole dostane hráč za prázdnu ruku 3 cigarety, na konci ich má 8 — špak navyše.
    // Hodnota stupňa 1 / 2 / 3 (v11.20): Štamgastove reči na Farárovej červenej v 3. kole mu dajú 3, nie 2.
    // Prvé kolo (2026-11-10): 1. kolo bez Hazardu a hádky, vo finále Mäsiar a Záhradkár z 1. kola namiesto Pijana
    // a Mačky — hráč 53 + vykúpenie 2 − 6 = 49, Štamgast 15 + 5 − 3 = 17.
    // v12 (Traktorista s prevahou Pecku navyše): 1. kolo 10 : 7, Nakladačka 3 len Farárovi; Kmotor je Autobusár
    // (Nakladačka 2 Farár 3 + Autobusár 1), v 3. kole Autobusár na oranžovú — hráč 48 + 2 − 6 = 44, Štamgast 15 + 4 − 3 = 16.
    expect(koniec.koniec?.body).toEqual([44, 16]);
    expect(cela.kroky[i("i-koniec")]?.melichar).toContain("44 : 16");
    expect(koniec.vazni.map((v) => [v.elderId, v.hrac])).toEqual([["farar", 0]]);
    // Nepriznané Cirhózy: hráčova z 2. kola a z finále (i-koniec, q-koniec), Štamgastova z 2. kola.
    expect(koniec.koniec?.cirhozy).toEqual([2, 1]);
  });

  it("časti nadväzujú: každá má začiatok a koniec, idú za sebou a 2. časť začína tam, kde 1. skončila", () => {
    const casti = cela.casti ?? [];
    expect(casti.map((c) => c.cast)).toEqual([1, 2, 3]);
    let predosly = -1;
    for (const c of casti) {
      expect(i(c.od), c.od).toBe(predosly + 1);
      expect(cela.kroky[i(c.od)]?.cast).toBe(c.cast);
      expect(cela.kroky[i(c.po)]?.koniecCasti).toBe(c.cast);
      predosly = i(c.po);
    }
    expect(predosly).toBe(cela.kroky.length - 1);
    expect(i("i-vitaj2")).toBe(scenar.kroky.length);
    // 2. časť: 2. kolo, hráč vyhral a vyberá cieľ; 3. časť: 3. kolo — v8.2 vyhral hráč aj 2. kolo
    // (remíza v tuhom, menej Dlhov), takže cieľ volí znova on.
    expect(pri("i-vitaj2")).toMatchObject({ faza: "volbaCiela", kolo: 2 });
    expect(naTahu(pri("i-vitaj2"))).toBe(0);
    expect(pri("i-vitaj3")).toMatchObject({ faza: "volbaCiela", kolo: 3 });
    expect(naTahu(pri("i-vitaj3"))).toBe(0);
    expect(pri("i-dovidenia3").faza).toBe("koniec");
  });

  it("2. časť: Ihrisko, prevaha, Záverečná a NA EX — čísla v textoch sedia s jadrom", () => {
    // v11.5: Pijan spojí Poldeci s Peckou a Ranu s Ranou Ihriska; Viera Miňištranta uberie Štamgastovi 1 tuhé.
    expect(odhad(po("k-vypit"))).toEqual([6, 1]);
    expect(po("k-vypit").pitkyCelkom).toBe(2);
    expect(odhad(po("k-zh2-bot2"))).toEqual([4, 1]);
    // Záverečná je Liberál; prevaha na trávniku je Štamgastova: 1 : 6.
    expect(odhad(po("k-hotovo3-bot"))).toEqual([1, 6]);
    expect(po("k-hotovo3-bot").strany[0].some((pl) => pl.card.defId === "liberal" && pl.playedBy === 1)).toBe(true);
    // Hazard Dvojčiat spojí Miňištrantovu pečeň: vypitý poldeci 1 + 4 z kariet — Cirhóza (i-cirhoza2).
    // Frakcie (2026-11-08): Praudovravec má namiesto Odporu Poveru — o 1 tuhé viac.
    expect(po("k-hotovo3-bot").hraci[0].odhadzovaci.filter((k) => k.defId === "cirhoza")).toHaveLength(1);
    expect(odhad(po("k-prevaha2"))).toEqual([5, 0]);
    // Priznanie Cirhózy (v11.5 bez Nástupu Alkoholika) sa učí až v 3. kole — v 2. nikto nič nepriznal.
    expect(po("k-prevaha2").hraci[0].priznane).toHaveLength(0);
    // Exekútor až po poškodení (master 3ab061b): pred bitkou sa špaky nemenia.
    expect(body(pri("k-odpoved-bot"))).toEqual([6, 0]);
    // NA EX hráča na Alkoholika zdvojí jeho osamotené Viery, Štamgastovo na Liberála jeho dve osamotené Povery. Odpoveď
    // Čierna mačka spojí jednu Vieru Alkoholika (NA EX ju zruší) a jej Furt chráni Štamgastove Povery pred Vierou.
    // Konflikt bez tagu (2026-11-08): Praudovravec (variant 0/1) priložený k Liberálovi má Pohoršenie navyše a jeho Dlh
    // ostal nespojený. Mäkké 2 : 6 (Štamgast Povery 4 + Pohoršenie Mačky 2), hádku vyhral Štamgast o 4. Štamgastove
    // Viery zrušili obe hráčove Povery (Miňištrant, Praudovravec), hráčove Viery Štamgastovi všetko tuhé — 4 : 0,
    // bitka je hráčova, Nakladačka 4.
    const bitka = pri("k-povera3");
    expect(bitka.bitkaStav).toMatchObject({ krok: "prebytok", caka: 0, vitaz: 0, prebytokZostava: 4, damage: { tuhe: [4, 0] }, hadka: { makke: [2, 6], vitaz: 1, velkost: 4, zostava: 4 } });
    expect(bitka.nastenka.at(-1)).toMatchObject({ kolo: 2, vitaz: 0, rozhodlo: "tuhe", exekutor: [0, 0] });
    // Bodovanie (krok 4b, i-bodovanie2): Farár strach oranžový 3 (v12 nikto iný sa po 1. kole nebojí).
    // Štamgast bez rečí 0, za svoje karty ako víťaz hádky 6 (v11.11).
    expect(bitka.nastenka.at(-1)?.zaStarsich).toEqual([3, 0]);
    expect(bitka.nastenka.at(-1)?.zaBitku).toEqual([10, 6]);
    expect(bitka.starsi.find((e) => e.elderId === "veterinar")).toMatchObject({ strach: [0, 0], reci: [0, 0] });
    // Nakladačka 4 (hráč): Farár z oranžovej na červenú — vydesený, v 3. kole ho smie zajať; zvyšok 1 Autobusárovi na žltú
    // (v12 má Autobusár scorecard Kmotor — Farár 3 + Vychovávateľka 1 jadro medzi legálnymi zámermi nevymenúva).
    expect(cela.kroky[i("k-nakladacka2")]).toMatchObject({
      kto: "hrac",
      prikaz: { type: "prebytok", zdvihy: [{ elderId: "farar", na: 3 }, { elderId: "autobusar", na: 1 }] },
    });
    expect(pri("k-nakladacka2").starsi.find((e) => e.elderId === "autobusar")?.scorecard).toBe("zberatel");
    expect(po("k-nakladacka2").starsi.find((e) => e.elderId === "farar")).toMatchObject({ strach: [3, 0] });
    // Hádka 4 na Štamgastove reči na hráčovom teplomere (v11.12): Farár červená za 3, Krčmárka žltá za 1.
    expect(cela.kroky[i("k-reci-bot")]).toMatchObject({ kto: "bot", prikaz: { type: "reci" } });
    const kolo3 = po("k-reci-bot");
    expect(kolo3).toMatchObject({ kolo: 3, faza: "volbaCiela" });
    expect(kolo3.starsi.find((e) => e.elderId === "farar")).toMatchObject({ strach: [3, 0], reci: [0, 3], reciOd: [0, 3] });
    expect(kolo3.starsi.find((e) => e.elderId === "krcmarka")).toMatchObject({ strach: [0, 0], reci: [0, 1], reciOd: [0, 1] });
    // 10 za karty v línii, starší 3, exekútor 0 : 0 (hráč Dlh nemal; Štamgastovi z troch dva, Advokát 2, i-body);
    // Štamgast 6 za svoje karty ako víťaz hádky — 19 : 6 (i-spaky2).
    expect(body(kolo3)).toEqual([19, 6]);
    expect(cela.kroky[i("i-spaky2")]?.melichar).toContain("19 : 6");
    expect(kolo3.hraci[0].poldeciPlne).toBe(2);
    expect(kolo3.nastenka.at(-1)?.lokalita?.defId).toBe("ihrisko");
    // Autobusár dal Štamgastovi Kmotra: jeho Dlh, ktorý exekútor nespálil, prešiel na hráča (i-spaky2).
    expect(kolo3.hraci[0].dlhy).toBe(1);
    expect(kolo3.hraci[1].dlhy).toBe(0);
    // Výpalné (v11.9): Farár je po Nakladačke na červenej — Štamgast cigaretu za prehru odovzdá hráčovi (v12 bez Fajčiara).
    expect(kolo3.hraci[1].cigarety).toBe(bitka.hraci[1].cigarety);
    expect(kolo3.hraci[0].cigarety).toBe(bitka.hraci[0].cigarety + 1);
    // Na začiatku 3. kola sa zamiešal odhadzovací balíček a hráč si dobral Cirhózu (i-vitaj3, k-priznaj).
    expect(kolo3.hraci[0].ruka.at(-1)?.defId).toBe("cirhoza");
    // v9.1: výučba Prvá hra je bez Chuti (Michal 2026-10-30) — Absťák nedostane nikto; od 2026-10-30 ich výučba ani nevysvetľuje.
    expect(pocetAbstakov(kolo3.hraci[1])).toBe(0);
    expect(pocetAbstakov(kolo3.hraci[0])).toBe(0);
  });

  it("3. časť (v11.5): priznanie Cirhózy, Dedičstvo, reči porazeného, zajatie Nakladačkou, reči nad strachom", () => {
    // Hráč je obranca (vyhral 2. kolo) a vyberá Kultúrny dom; natáča Štamgast, víťaz hádky 2. kola (v11.11),
    // a vchod si dá k sebe — parket je hráčov. v9.2 kupuje prvý hráč (Vidly), Štamgast Mäsiara.
    expect(cela.kroky[i("k-ciel3")]).toMatchObject({ kto: "hrac", prikaz: { type: "chooseLocation", uid: "lokality:kulturny_dom", otocena: false } });
    expect(pri("k-natocenie3-bot").faza).toBe("natocenieCiela");
    expect(cela.kroky[i("k-natocenie3-bot")]).toMatchObject({ kto: "bot", prikaz: { type: "natocLokalitu", otocena: false } });
    expect(po("k-natocenie3-bot")).toMatchObject({ faza: "draft", lokalitaOtocena: false });
    expect(po("k-kup3-bot").hraci[1].ruka.some((k) => k.defId === "masiar")).toBe(true);
    expect(po("k-stop3").faza).toBe("zhromazdenie");
    expect(cela.kroky[i("i-zajatie")]?.melichar).toMatch(/za päť/);
    // Priznanie (v11.5 namiesto Nástupu Alkoholika): Cirhóza z ruky ide medzi priznané, Štamgast má o 1 tuhé viac.
    expect(i("k-priznaj")).toBeLessThan(i("k-dedicstvo"));
    expect(odhad(pri("k-priznaj"))).toEqual([0, 2]);
    expect(po("k-priznaj").hraci[0].priznane.map((k) => k.defId)).toEqual(["cirhoza"]);
    expect(odhad(po("k-priznaj"))).toEqual([0, 3]);
    expect(cela.kroky[i("i-nastup")]?.melichar).toContain("0 : 3, nie 0 : 2");
    expect(po("k-dedicstvo").hraci[0].dedicstvo.map((k) => k.defId)).toEqual(["vidly"]);
    // Náradie (2026-11-08): Nástroj sa do línie nevykladá — namiesto Pušky Recidivista: Petelica 3 + Rana s Vidlami 2;
    // Pijan pridá Ranu po 2. Štamgastove 3 tuhé (Pecka, priznaná Cirhóza) zrušia Viery Miňištranta a Recidivistu.
    expect(odhad(po("k-nastroj"))).toEqual([5, 0]);
    expect(odhad(po("k-zh3-2"))).toEqual([7, 0]);
    expect(body(pri("k-hotovo6-bot"))).toEqual([19, 6]);
    // Hádka o 3 (Pohoršenie domu 2 + Povera 1), tuhé 7 : 0 — bitka čaká na Nakladačku 7.
    const vyhra = po("k-hotovo6-bot");
    expect(vyhra.bitkaStav).toMatchObject({ krok: "prebytok", caka: 0, vitaz: 0, prebytokZostava: 7, damage: { tuhe: [7, 0] }, hadka: { makke: [3, 0], vitaz: 0, zostava: 3 } });
    // Kultúrny dom (v11.13): každý len za svoje karty — hráč 3, Štamgast 1. Starší (v11.12): Farár hráčovi 5 − 2
    // za Štamgastove reči na červenej, Autobusár a Vychovávateľka po 1; Krčmárkinu žltú drží Štamgast. Štamgast:
    // Farár 2, Krčmárka 1 (porazený boduje reči); exekútor hráčovi 2 (aj Hazardy Recidivistu) — 27 : 9 (i-vyhra3).
    expect(vyhra.nastenka.at(-1)?.zaBitku).toEqual([3, 1]);
    // v12: hráčovi Farár 3 a Autobusár 1 (Vychovávateľka sa nebojí).
    expect(vyhra.nastenka.at(-1)?.zaStarsich).toEqual([4, 4]);
    expect(vyhra.nastenka.at(-1)?.exekutor).toEqual([2, 0]);
    // v11.20: Farár Štamgastovi 3 za reči na červenej (hráčovi 6 − 3 = 3 ako predtým 5 − 2) — 27 : 11 (prvé kolo bez Dlhu).
    expect(body(vyhra)).toEqual([24, 11]);
    expect(cela.kroky[i("i-vyhra3")]?.melichar).toContain("24 : 11");
    expect(cela.kroky[i("i-vyhra3")]?.melichar).toContain("zaplatil jemu, 3");
    // Štamgast prehral hádku: jeho reči klesli zospodu a zanikli (jediný stupeň).
    expect(vyhra.starsi.find((e) => e.elderId === "farar")).toMatchObject({ reci: [0, 0] });
    // Nakladačka 7 (auto, Melichar): zajatie Farára za 5 (krádež 0 — reči zanikli), Autobusár 1 → 2 (v12; predtým Krčmárka).
    expect(cela.kroky[i("k-nakladacka3")]?.kto).toBe("auto");
    const nakl = po("k-nakladacka3");
    expect(nakl.vazni.map((v) => [v.elderId, v.hrac])).toEqual([["farar", 0]]);
    expect(nakl.starsi.some((e) => e.elderId === "farar")).toBe(false);
    expect(nakl.starsi.find((e) => e.elderId === "autobusar")).toMatchObject({ strach: [2, 0] });
    expect(nakl.starsi.find((e) => e.elderId === "starosta")).toMatchObject({ strach: [0, 0] });
    expect(body(nakl)).toEqual([24, 11]);
    // Hádka 3 (hráč): reči na Štamgastovom teplomere zospodu, Veterinár žltá a oranžová za 1 + 2.
    expect(cela.kroky[i("k-reci3")]).toMatchObject({ kto: "hrac", prikaz: { type: "reci", zdvihy: [{ elderId: "veterinar", na: 2 }] } });
    const kolo4 = po("k-reci3");
    expect(kolo4.kolo).toBe(4);
    expect(kolo4.starsi.find((e) => e.elderId === "veterinar")).toMatchObject({ strach: [0, 0], reci: [2, 0], reciOd: [1, 0] });
    // Priazne Štamgasta z rozdielu strachov (v12): Kmotor 2 (Autobusár na oranžovej); Krčmárka, Starosta a Vychovávateľka bez strachu.
    expect(silaPriazne(data, kolo4, "LAKOMEC", 1)).toBe(0);
    expect(silaPriazne(data, kolo4, "BITKAR", 1)).toBe(0);
    expect(silaPriazne(data, kolo4, "FAJCIAR", 1)).toBe(0);
    expect(silaPriazne(data, kolo4, "UZERNIK", 1)).toBe(2);
    // Výpalné (v11.9) za väzňa: Farár sa ráta ako červený strach držiteľa; Štamgast dostal cigaretu za prehru a dal ju.
    expect(kolo4.hraci[1].cigarety).toBe(vyhra.hraci[1].cigarety);
    expect(body(kolo4)).toEqual([24, 11]);
    // Do finále má hráč 8 cigariet (2 z výpalného, 3 za pas s prázdnou rukou, v11.16) — s pasom a Cigaretou vily stačí na Policajtku a doliatie.
    expect(kolo4.hraci[0].cigarety).toBe(8);
    expect(pocetAbstakov(kolo4.hraci[0])).toBe(0);
    expect(pocetAbstakov(kolo4.hraci[1])).toBe(0);
  });

  it("finále (v11.4): bez zajatia, doliatie, zrážka NA EX (Kšeft vily zanikol, frakcie 2026-11-08)", () => {
    for (const id of ["k-kup-finale", "k-zh-finale-pas3", "k-vypit-finale", "k-doliatie", "k-naex-vytrznik", "k-bez-odpovede-finale"]) expect(cela.kroky[i(id)]?.kto, id).toBe("hrac");
    // v11.4: po voľbe vily sa hneď stavia šenok — pokus o zajatie ani karta zadarmo nie sú.
    expect(i("k-stavba-finale")).toBe(i("k-ciel-finale") + 1);
    expect(cela.kroky.some((k) => k.prikaz?.type === ("pokus" as string))).toBe(false);
    const stavba = po("k-stavba-finale-bot");
    expect(stavba.hraci[1].ruka).toHaveLength(pri("k-stavba-finale-bot").hraci[1].ruka.length);
    expect(stavba.senok).toHaveLength(8);
    // Recidivista: Rana a Petelica; Štamgastovi navyše priznaná Cirhóza hráča a Bitkár. Pijan spojí Posilnenie
    // (zdvojí mu Poldeci), Ranu a Hazard vily (v11.13 nové hrany).
    expect(odhad(po("k-zh-finale-bot"))).toEqual([0, 5]);
    expect(odhad(po("k-pijan-finale"))).toEqual([6, 5]);
    expect(po("k-pijan-finale").pitkyCelkom).toBe(3);
    // Dobratie po bitke (v11.21, i-po-bitke3): 2 karty, Mäsiar z 1. kola a Pijan. Záhradkára z 1. kola si hráč
    // dofajčí v druhej Pitke finále s prázdnou rukou — nechá si ho na pas a ako možnú odpoveď.
    expect(pri("k-kup-finale").hraci[0].ruka.map((k) => k.defId)).toEqual(["masiar", "pijan"]);
    expect(pri("k-fajcit-finale").hraci[0].ruka).toEqual([]);
    expect(po("k-fajcit-finale").hraci[0].ruka.map((k) => k.defId)).toEqual(["zahradkar"]);
    expect(po("k-fajcit-finale").hraci[0].cigarety).toBe(pri("k-fajcit-finale").hraci[0].cigarety - 1);
    expect(cela.kroky[i("k-fajcit-finale")]?.kto).toBe("hrac");
    expect(cela.kroky.some((k) => k.id === "k-kseft")).toBe(false);
    expect(pri("k-finale-p1").starsi.find((e) => e.elderId === "veterinar")).toMatchObject({ strach: [0, 0], reci: [2, 0], reciOd: [1, 0] });
    // Mäsiar za Pijanom, Policajtka za Mäsiarom; Nepriateľ (frakcie 2026-11-08): Štamgastov Kriminál Recidivista jej dá Petelicu.
    expect(odhad(po("k-vypit-finale"))).toEqual([13, 5]);
    expect(cela.kroky[i("k-vypit-finale")]?.melichar).toContain("13 : 5");
    // Doliatie: vypitý poldeci späť na plný za 2 cigarety.
    expect(pri("k-doliatie").hraci[0]).toMatchObject({ poldeciPlne: 1, poldeciVypite: 1 });
    expect(po("k-doliatie").hraci[0]).toMatchObject({ poldeciPlne: 2, poldeciVypite: 0 });
    expect(po("k-doliatie").hraci[0].cigarety).toBe(pri("k-doliatie").hraci[0].cigarety - 2);
    // Zrážka: obaja NA EX na hráčovho Pijana pri vile — Výtržník je hráčov, 27 : 6 — skryté akcie (Michal 2026-11-08): Rana navyše
    // oboch Pijanov za hráčovo NA EX je v súčtoch, takže ju Vidly zosilnia (+1 za každú; predtým 25 : 6).
    const pijan = po("k-finale-p3-bot").strany[0].find((pl) => pl.card.defId === "pijan");
    expect(pijan?.naexBy).toBeDefined();
    expect(odhad(po("k-finale-p3-bot"))).toEqual([21, 5]);
    expect(cela.kroky[i("k-finale-p3-bot")]?.melichar).toContain("21 : 5");
    expect(cela.kroky[i("i-bitka-finale")]?.melichar).toContain("21 : 5");
    expect(cela.kroky[i("i-bitka-finale")]?.melichar).toContain("Nakladačka 16");
    // Hráč má v ruke Záhradkára, ale neodpovedá (plný poldeci je na konci špak) — hra skončí po jeho „bez odpovede“.
    expect(po("k-bez-odpovede-finale-bot").faza).toBe("pitka");
    expect(po("k-bez-odpovede-finale").faza).toBe("koniec");
    expect(cela.kroky[i("i-hadka-finale")]?.kto).toBe("info");
    const koniec = prehrajVyucbu(data, cela, cela.kroky.length);
    // Finále (i-bitka-finale): 5 za karty v línii, Nakladačka 16 na špaky 1 : 1, starší 3 + 3 (Veterinár reči po
    // oranžovú, Autobusár oranžový strach — v12); Štamgast 3 za hádku a 2 za svoje karty ako víťaz hádky
    // (i-hadka-finale); exekútor hráčovi 3, Štamgastovi 1.
    expect(koniec.nastenka.at(-1)).toMatchObject({ vitaz: 0, finale: true, karty: 5, zaBitku: [5, 2], prebytok: [16, 0], hadkaSpaky: [0, 3], zaStarsich: [6, 0], exekutor: [3, 1], spakyPo: [48, 15] });
    // Vo finále sa nezajíma (v11.4) — väzeň je len Farár z 3. kola.
    expect(koniec.vazni).toHaveLength(1);
    expect(cela.kroky[i("i-bitka-finale")]?.melichar).toContain("nezajíma");
  });

  it("texty nehovoria o Smetisku ani o bodoch (Michal 2026-10-28: stavba klikom, víťazné body sú špaky)", () => {
    for (const k of cela.kroky) {
      const texty = [k.melichar, ...(k.moznosti ?? []).flatMap((m) => [m.text, m.vysvetlenie]), ...(k.volba?.zle ?? []).map((z) => z.text), k.volba?.inak ?? ""];
      for (const text of texty) {
        expect(text, k.id).not.toMatch(/Smetisk/);
        // „bod Nakladačky“ je iný význam a ostáva; víťazné body sú špaky.
        expect(text, k.id).not.toMatch(/(?<!\p{L})(body|bodov|BODY)(?!\p{L})/u);
      }
    }
  });
});

describe("výučba v troch častiach — hranice, hlášky pri chybe, lokalita kola (roadmapa #105)", () => {
  const index = (id: string): number => celyScenar.kroky.findIndex((k) => k.id === id);

  it("časti s indexmi krokov: 1. časť po i-dovidenia, 2. a 3. nadväzujú; koniec časti po poslednom kroku", () => {
    const casti = castiScenara(celyScenar);
    expect(casti.map((c) => [c.cast, c.od, c.po])).toEqual([
      [1, 0, koniecPrvej],
      [2, index("i-vitaj2"), index("i-dovidenia2")],
      [3, index("i-vitaj3"), celyScenar.kroky.length - 1],
    ]);
    expect(castKroku(celyScenar, index("k-doliatie"))?.cast).toBe(3);
    expect(castKroku(celyScenar, celyScenar.kroky.length)).toBeNull();
    expect(koniecCastiPoKroku(celyScenar, index("i-dovidenia2"))).toBe(2);
    expect(koniecCastiPoKroku(celyScenar, index("i-vitaj2"))).toBeNull();
    // Scenár bez častí je jedna časť cez všetky kroky (testy, staré scenáre).
    expect(castiScenara({ id: scenar.id, nazov: scenar.nazov, rozdanie: scenar.rozdanie, kroky: scenar.kroky, cast: 2 })).toEqual([{ cast: 2, nazov: scenar.nazov, minuty: 0, navrh: false, od: 0, po: scenar.kroky.length - 1 }]);
  });

  it("postup sa hľadá podľa id kroku: ťahy a kvízy ostali, zlúčený info krok nesie id prvého z nich", () => {
    // Prerobenie 2026-10-30: 212 → 170 krokov. Uložený vyucba_krok_id ťahu či kvízu sa nájde aj po zmene;
    // nová verzia zabráni, aby starý index bez id ukázal na iný krok.
    // Prvé kolo (2026-11-10): 53 → 40 krokov 1. časti, nová verzia — staré uloženie bez id sa nepoužije.
    expect(celyScenar.kroky.slice(0, 6).map((k) => k.id)).toEqual(["i-vitaj", "i-lokalita", "i-bitka-uvod", "i-lokality", "i-akcie", "k-ciel"]);
    expect(koniecPrvej).toBe(39);
    expect(celyScenar.verzia).toBe("v11-20-prve-kolo-2026-11-10");
  });

  it("overScenar stráži hranice častí: medzera, chýbajúci koniec, zlé číslo", () => {
    expect(overScenar(data, celyScenar)).toBeNull();
    const casti = celyScenar.casti ?? [];
    const bezKonca: ScenarVyucby = { ...celyScenar, kroky: celyScenar.kroky.map((k) => (k.id === "i-dovidenia2" ? (Object.fromEntries(Object.entries(k).filter(([x]) => x !== "koniecCasti")) as typeof k) : k)) };
    expect(overScenar(data, bezKonca)).toMatch(/i-dovidenia2.*nemá koniecCasti/);
    const medzera: ScenarVyucby = { ...celyScenar, casti: casti.map((c) => (c.cast === 2 ? { ...c, od: "i-rola" } : c)) };
    expect(overScenar(data, medzera)).toMatch(/Časť 2 nenadväzuje/);
    const neznamy: ScenarVyucby = { ...celyScenar, casti: casti.map((c) => (c.cast === 3 ? { ...c, po: "neexistuje" } : c)) };
    expect(overScenar(data, neznamy)).toMatch(/Časť 3: krok neexistuje/);
    const zleCislo: ScenarVyucby = { ...celyScenar, kroky: celyScenar.kroky.map((k) => (k.id === "i-dovidenia" ? { ...k, koniecCasti: 2 } : k)) };
    expect(overScenar(data, zleCislo)).toMatch(/i-dovidenia.*koniecCasti 2 nesedí/);
  });

  it("hláška pri chybe: vlastná > kroku > záložná; záložné idú dookola bez opakovania po sebe", () => {
    const krok = celyScenar.kroky[index("k-ciel2")];
    expect(krok?.hlaskaChyby).toBeDefined();
    expect(hlaskaPriChybe(celyScenar, krok, "udiv/vlastna", 0)).toEqual({ hlaska: "udiv/vlastna", zaloha: false });
    expect(hlaskaPriChybe(celyScenar, krok, null, 0)).toEqual({ hlaska: krok?.hlaskaChyby, zaloha: false });
    const bez = celyScenar.kroky.find((k) => k.kto === "hrac" && k.hlaskaChyby === undefined);
    expect(bez).toBeDefined();
    const zalohy = Array.from({ length: hlaskyChyby.length * 2 }, (_, n) => hlaskaPriChybe(celyScenar, bez, undefined, n));
    expect(zalohy.every((z) => z.zaloha)).toBe(true);
    expect(new Set(zalohy.map((z) => z.hlaska))).toEqual(new Set(hlaskyChyby));
    for (let n = 1; n < zalohy.length; n++) expect(zalohy[n]?.hlaska).not.toBe(zalohy[n - 1]?.hlaska);
    expect(hlaskaPriChybe({ ...celyScenar, hlaskyChyby: [] }, bez, null, 3)).toEqual({ hlaska: null, zaloha: false });
  });

  it("lokalita kola je v zóne ciel:, nie medzi lokalitami na výber", () => {
    const s = prehrajVyucbu(data, celyScenar, index("k-finale-p1"));
    const lokalita = s.ciel?.lokalita;
    expect(lokalita?.defId).toBe("predsedova_vila");
    expect(uidZOdkazu(s, 0, "ciel:predsedova_vila")).toBe(lokalita?.uid);
    // Vybratá lokalita medzi lokalitami na výber už nie je — preto zóna ciel.
    expect(() => uidZOdkazu(s, 0, "lokality:predsedova_vila")).toThrow();
    expect(uidZOdkazu(prehrajVyucbu(data, celyScenar, 0), 0, "lokality:lesna_cesta")).toBeGreaterThan(0);
    expect(() => uidZOdkazu(prehrajVyucbu(data, celyScenar, 0), 0, "ciel:lesna_cesta")).toThrow(/v zóne nie je/);
  });
});

describe("výučba — prerobenie podľa playtestu výučby 20261030-184959", () => {
  const kroky = celyScenar.kroky;
  /** Všetko, čo Melichar povie — text kroku, možnosti a vysvetlenia kvízov, rady k zlému ťahu. */
  const texty = (k: ScenarVyucby["kroky"][number]): string[] => [
    k.melichar,
    ...(k.moznosti ?? []).flatMap((m) => [m.text, m.vysvetlenie]),
    ...(k.volba?.zle ?? []).map((z) => z.text),
    k.volba?.inak ?? "",
  ];

  it("Chuť, neresti a Absťák prvá hra neučí — spomenie ich len rozlúčka (nápovedy v partii)", () => {
    const sChutou = kroky.filter((k) => texty(k).some((t) => /Chuť|nerest|Absťák/.test(t))).map((k) => k.id);
    expect(sChutou).toEqual(["i-dovidenia3"]);
  });

  it("exekútora vysvetlí výučba raz, v 2. bitke (prvé kolo je bez Dlhov); ďalej ho len spomína", () => {
    const pravidlo = /polovicu Dlhov|polovica Dlhov/;
    expect(kroky.filter((k) => pravidlo.test(k.melichar)).map((k) => k.id)).toEqual(["i-body"]);
  });

  it("Pitka či bitka, ktorú uzavrie ťah bota, nemlčí — Melichar komentuje rekapituláciu", () => {
    // Prehráva sa raz krok za krokom (nie od začiatku pre každý krok) — pod záťažou celej sady sa inak nezmestí do 5 s.
    let pred = zacniVyucbu(data, celyScenar);
    for (const [n, k] of kroky.entries()) {
      const po = vykonajKrok(data, celyScenar, pred, n);
      const koniecPitky = pred.faza === "pitka" && po.faza !== "pitka";
      if (k.kto === "bot" && (koniecPitky || po.faza === "koniec")) expect(k.melichar.trim(), k.id).not.toBe("");
      pred = po;
    }
  });

  it("po kvíze jedna bublina: vysvetlenie správnej odpovede je krátke", () => {
    const slova = (t: string): number => t.split(/\s+/).filter((w) => w !== "").length;
    for (const k of kroky.filter((x) => x.kto === "otazka")) {
      for (const m of k.moznosti ?? []) expect(slova(m.vysvetlenie), `${k.id}: ${m.vysvetlenie}`).toBeLessThanOrEqual(30);
    }
  });

  it("časti majú odhad minút podľa playtestu (spolu najviac 40)", () => {
    const minuty = (celyScenar.casti ?? []).map((c) => c.minuty ?? 0);
    expect(minuty.every((m) => m > 0)).toBe(true);
    expect(minuty.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(40);
  });
});

describe("výučba — pravidlá v9.2 (šenok začína obranca, odpovede na NA EX lícom dole)", () => {
  const kroky = celyScenar.kroky;
  const i = (id: string): number => {
    const n = kroky.findIndex((k) => k.id === id);
    if (n < 0) throw new Error(`Scenár nemá krok ${id}`);
    return n;
  };

  it("v každom kole kupuje zo šenku prvý hráč (obranca) jednu kartu, až potom Štamgast", () => {
    for (const [hrac, bot] of [["k-kup-vymahac", "k-kupa-bot"], ["k-kup2", "k-kupa2-bot"], ["k-kup3", "k-kup3-bot"], ["k-kup-finale", "k-kup-finale-bot"]] as const) {
      expect(i(hrac), hrac).toBeLessThan(i(bot));
      const prikaz = kroky[i(hrac)]?.prikaz as { readonly uids?: readonly string[] } | undefined;
      expect(prikaz?.uids?.length, hrac).toBe(1);
    }
  });

  it("na NA EX odpovedá Štamgast (útočník) lícom dole za plný poldeci; hráč bez plného neodpovedá; otočenie komentuje i-odpovede", () => {
    // v11.16: odpoveď stojí plný poldeci — hráčov leží pod jeho NA EX, krok „bez odpovede“ odpadol.
    expect(i("i-odpovede")).toBe(i("k-odpoved-bot") + 1);
    const pred = prehrajVyucbu(data, celyScenar, i("k-odpoved-bot"));
    expect(pred.hraci[0].poldeciPlne).toBe(0);
    expect(pred.hraci[1].poldeciPlne).toBeGreaterThanOrEqual(1);
    const po = prehrajVyucbu(data, celyScenar, i("k-odpoved-bot") + 1);
    // v11.5: Štamgast odpovedá Čiernou mačkou — spojí osamotenú Vieru Alkoholika (i-odpovede); otočí sa hneď.
    expect(po.strany[0].some((pl) => pl.card.defId === "cierna_macka" && pl.playedBy === 1)).toBe(true);
    expect(po.strany[0].some((pl) => pl.odpoved === true)).toBe(false);
  });

  it("texty nehovoria, že šenok začína útočník, ani o poslednom slove", () => {
    for (const k of kroky) expect(k.melichar, k.id).not.toMatch(/útočník[^.]*kupuje prvý|kupuje prvý: |má posledné slovo/);
  });
});

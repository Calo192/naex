// Draft so stavbou šenku (Michal 2026-10-12): obaja naraz dávajú karty do
// šenku a naspodok (od 2026-10-20 polovicu a polovicu, bez podávania
// balíčkov), potom striedavo berú — 1 karta za cigaretu, 2 karty za 3 cigarety.
// v8.5 (Michal 2026-10-30): karty stavby z dvoch balíčkov — 2 z Náradia, 6 z Občanov.

import { describe, expect, it } from "vitest";
// Sada v6 (pred revíziou v7): test stráži pravidlá, ktoré revízia sady nemení.
import cardsJson from "./data/cards-v6.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { CardInstance, Command, GameState, PlayerId } from "../src/index.ts";
import {
  apply,
  KONSTANTY,
  IllegalCommandError,
  jeNaradie,
  legalCommands,
  loadGameData,
  mozeHrat,
  naTahu,
  setupGame,
  velkostStavby,
  viewFor,
} from "../src/index.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

function doDraftu(seed: number, uprav?: (s: GameState) => GameState): GameState {
  let s = setupGame(data, seed);
  if (uprav !== undefined) s = uprav(s);
  const lok = s.lokalityVHre[0]!;
  return apply(data, s, { type: "chooseLocation", uid: lok.uid, otocena: false }, (1 - s.utocnik) as PlayerId).state;
}

const obrancaOf = (s: GameState): PlayerId => (s.utocnik === 0 ? 1 : 0);

/** Výber pri stavbe: prvá polovica do šenku, druhá naspodok. */
const vyber = (b: readonly CardInstance[]): Command => ({
  type: "stavbaSenku",
  doSenku: b.slice(0, b.length / 2).map((k) => k.uid),
  odhod: b.slice(b.length / 2).map((k) => k.uid),
});

/** Jeden krok stavby za oboch hráčov. */
function krokStavby(s: GameState): GameState {
  for (const p of [obrancaOf(s), s.utocnik] as const) s = apply(data, s, vyber(s.draftStav!.balicky[p]), p).state;
  return s;
}

/** Hráčovi nastaví cigarety (testy brania). */
function sCigaretami(s: GameState, p: PlayerId, cigarety: number): GameState {
  const hraci = [...s.hraci] as [GameState["hraci"][0], GameState["hraci"][1]];
  hraci[p] = { ...hraci[p], cigarety };
  return { ...s, hraci };
}

function postavSenok(s: GameState): GameState {
  while (s.draftStav?.krok === "stavba") s = krokStavby(s);
  return s;
}

describe("stavba šenku", () => {
  it("každý dostane 2 karty z Náradia a 6 z Občanov, bez ohľadu na počet starších (v8.5)", () => {
    const s0 = setupGame(data, 1);
    expect(s0.senok).toHaveLength(0);
    expect(s0.naradie.length).toBeGreaterThan(0);
    expect(s0.naradie.every((k) => jeNaradie(data, k))).toBe(true);
    expect(s0.obcania.some((k) => jeNaradie(data, k))).toBe(false);
    const s = doDraftu(1);
    expect(velkostStavby(s0)).toBe(8);
    expect(s.draftStav?.krok).toBe("stavba");
    // Zoradené náradie / občania.
    for (const p of [0, 1] as const) expect(s.draftStav!.balicky[p].map((k) => jeNaradie(data, k))).toEqual([true, true, false, false, false, false, false, false]);
    expect(s.naradie).toHaveLength(s0.naradie.length - 4);
    expect(s.obcania).toHaveLength(s0.obcania.length - 12);
    // Nahradený starší počet kariet stavby nemení (do v8.4 by bolo 6).
    const sedem = { ...s0, starsi: s0.starsi.map((e, i) => (i === 0 ? { ...e, nahradeny: true } : e)) };
    expect(velkostStavby(sedem)).toBe(8);
  });

  it("čo jeden balíček nemá, doplní druhý; keď sa minú oba, stavba sa zmenšuje (výklad 2026-10-30)", () => {
    const s0 = setupGame(data, 12);
    // V Náradí jediný Nástroj: obranca ho dostane a 7 Občanov, útočník 8 Občanov.
    const s = doDraftu(12, (s) => ({ ...s, naradie: s.naradie.slice(0, 1) }));
    expect(s.draftStav!.balicky[obrancaOf(s)].filter((k) => jeNaradie(data, k))).toHaveLength(1);
    expect(s.draftStav!.balicky[s.utocnik].filter((k) => jeNaradie(data, k))).toHaveLength(0);
    expect(s.draftStav!.balicky.map((b) => b.length)).toEqual([8, 8]);
    expect(s.naradie).toHaveLength(0);
    // Málo Občanov: chýbajúce dá Náradie.
    const m = doDraftu(12, (s) => ({ ...s, obcania: s.obcania.slice(0, 3) }));
    expect(m.draftStav!.balicky.map((b) => b.length)).toEqual([8, 8]);
    expect(m.obcania).toHaveLength(0);
    expect(m.naradie).toHaveLength(s0.naradie.length - 13);
    // Spolu 6 kariet: každý po 2 (nadol na párne).
    expect(velkostStavby({ naradie: s0.naradie.slice(0, 1), obcania: s0.obcania.slice(0, 5) })).toBe(2);
    expect(velkostStavby({ naradie: [], obcania: s0.obcania.slice(0, 1) })).toBe(0);
  });

  it("obaja hrajú naraz; výber sa odhalí, až keď vyberú obaja", () => {
    let s = doDraftu(2);
    const u = s.utocnik;
    const o = obrancaOf(s);
    expect(mozeHrat(s, 0) && mozeHrat(s, 1)).toBe(true);
    expect(naTahu(s)).toBe(o);
    // Útočník smie vybrať skôr než obranca.
    const bu = s.draftStav!.balicky[u];
    const id = (i: number): number => bu[i]!.uid;
    // Do šenku aj naspodok presne polovicu (z 8 po 4), každú kartu len raz.
    expect(() => apply(data, s, { type: "stavbaSenku", doSenku: [id(0), id(1)], odhod: [id(2), id(3), id(4), id(5)] }, u)).toThrow(/Do šenku daj 4/);
    expect(() => apply(data, s, { type: "stavbaSenku", doSenku: [id(0), id(1), id(2), id(3)], odhod: [id(3), id(4), id(5), id(6)] }, u)).toThrow(/len raz/);
    s = apply(data, s, vyber(bu), u).state;
    expect(mozeHrat(s, u)).toBe(false);
    expect(s.senok).toHaveLength(0);
    expect(() => apply(data, s, vyber(bu), u)).toThrow(IllegalCommandError);
    // Obranca výber útočníka nevidí, len že vybral.
    const pohlad = viewFor(data, s, o);
    expect(pohlad.draftStav?.vybral[u]).toBe(true);
    expect(pohlad.draftStav?.mojVyber).toBeNull();
    expect(JSON.stringify(pohlad)).not.toContain(`"uid":${bu[0]!.uid},`);

    const bo = s.draftStav!.balicky[o];
    const predObcania = s.obcania.length;
    s = apply(data, s, vyber(bo), o).state;
    const uids = (b: readonly CardInstance[]): number[] => b.map((k) => k.uid);
    expect(uids(s.senok).sort()).toEqual([...uids(bu.slice(0, 4)), ...uids(bo.slice(0, 4))].sort());
    // Odhodení Občania ležia naspodok Občanov.
    expect(s.obcania).toHaveLength(predObcania + 8);
    expect(uids(s.obcania.slice(-8)).sort()).toEqual([...uids(bu.slice(4)), ...uids(bo.slice(4))].sort());
    // Bez podávania balíčkov: stavba je hotová jedným výberom.
    expect(s.draftStav?.krok).toBe("beranie");
  });

  it("odhodené karty sa nedostanú do pohľadu ani do logu súpera", () => {
    let s = doDraftu(3);
    const u = s.utocnik;
    const o = obrancaOf(s);
    const bo = s.draftStav!.balicky[o];
    const odhod = bo[5]!;
    let udalosti: string[] = [];
    for (const [p, b] of [[u, s.draftStav!.balicky[u]], [o, bo]] as const) {
      const r = apply(data, s, vyber(b), p);
      s = r.state;
      udalosti = [...udalosti, ...r.events.map((e) => JSON.stringify(e))];
    }
    expect(udalosti.join()).not.toContain(`"uid":${odhod.uid},`);
    expect(JSON.stringify(viewFor(data, s, u))).not.toContain(`"uid":${odhod.uid},`);
  });

  it("do šenku ľubovoľný mix; Nástroj naspodok ide k Náradiu, Občan k Občanom", () => {
    let s = doDraftu(13);
    const u = s.utocnik;
    const o = obrancaOf(s);
    const predNaradie = s.naradie.length;
    // Útočník dá do šenku 4 Občanov a oba Nástroje naspodok, obranca oba Nástroje do šenku.
    const bu = s.draftStav!.balicky[u];
    s = apply(data, s, { type: "stavbaSenku", doSenku: bu.slice(2, 6).map((k) => k.uid), odhod: [...bu.slice(0, 2), ...bu.slice(6)].map((k) => k.uid) }, u).state;
    const bo = s.draftStav!.balicky[o];
    s = apply(data, s, vyber(bo), o).state;
    expect(s.senok.filter((k) => jeNaradie(data, k))).toHaveLength(2);
    expect(s.naradie).toHaveLength(predNaradie + 2);
    expect(s.naradie.slice(-2).map((k) => k.uid)).toEqual(bu.slice(0, 2).map((k) => k.uid));
    expect(s.obcania.slice(-6).map((k) => k.uid).sort()).toEqual([...bu.slice(6), ...bo.slice(4)].map((k) => k.uid).sort());
  });

  it("stavba má jeden krok; po nej má šenok 8 kariet a balíčky stratili len tie", () => {
    const s0 = setupGame(data, 4);
    const s = krokStavby(doDraftu(4));
    expect(s.senok).toHaveLength(8);
    expect(s.naradie.length + s.obcania.length).toBe(s0.naradie.length + s0.obcania.length - 8);
    expect(s.draftStav?.krok).toBe("beranie");
    // Zo šenku berie prvý obranca (v9.2, Michal 2026-10-30; predtým útočník).
    expect(naTahu(s)).toBe(obrancaOf(s));
  });
});

describe("branie zo šenku (Michal 2026-10-19: 1 karta za cigaretu, 2 karty za 3 cigarety)", () => {
  it("striedavo, začína obranca (v9.2); 1 karta = 1 cigareta, 2 karty = 3 cigarety, nič zadarmo, poldeci sa neplatí", () => {
    let s = postavSenok(doDraftu(5));
    // v9.2: prvý berie obranca, útočník druhý.
    const u = obrancaOf(s);
    const o = s.utocnik;
    s = sCigaretami(sCigaretami(s, u, 4), o, 2);
    const poldeci = s.hraci[o].poldeciPlne;
    expect(() => apply(data, s, { type: "draftBer", uids: [s.senok[0]!.uid] }, o)).toThrow(IllegalCommandError);
    expect(() => apply(data, s, { type: "draftBer", uids: [] }, u)).toThrow(/1 alebo 2/);
    expect(() => apply(data, s, { type: "draftBer", uids: s.senok.slice(0, 3).map((k) => k.uid) }, u)).toThrow(/1 alebo 2/);
    // v9.2: kto berie prvý, na prvom ťahu vezme len 1 kartu — ponuka aj server.
    expect(legalCommands(data, s, u).some((c) => c.type === "draftBer" && c.uids.length === 2)).toBe(false);
    expect(() => apply(data, s, { type: "draftBer", uids: [s.senok[0]!.uid, s.senok[1]!.uid] }, u)).toThrow(/prvom ťahu/);
    s = apply(data, s, { type: "draftBer", uids: [s.senok[0]!.uid] }, u).state;
    expect(s.hraci[u].cigarety).toBe(3);
    expect(s.draftStav?.noveKarty[u]).toBe(1);
    expect(naTahu(s)).toBe(o);
    // Útočník s 2 cigaretami nemá na dve karty — len na jednu.
    expect(legalCommands(data, s, o).some((c) => c.type === "draftBer" && c.uids.length === 2)).toBe(false);
    expect(() => apply(data, s, { type: "draftBer", uids: [s.senok[0]!.uid, s.senok[1]!.uid] }, o)).toThrow(/3 cigarety/);
    s = apply(data, s, { type: "draftBer", uids: [s.senok[0]!.uid] }, o).state;
    expect(s.hraci[o].cigarety).toBe(1);
    expect(s.hraci[o].poldeciPlne).toBe(poldeci);
    expect(naTahu(s)).toBe(u);
    // Na ďalšom ťahu už aj 2 karty za 3 cigarety; limit kariet nie je — berie sa, kým je čím platiť.
    s = apply(data, s, { type: "draftBer", uids: [s.senok[0]!.uid, s.senok[1]!.uid] }, u).state;
    expect(s.hraci[u].cigarety).toBe(0);
    expect(s.draftStav?.noveKarty[u]).toBe(3);
  });

  it("bez cigariet sa zo šenku nedá brať — hra za hráča branie ukončí", () => {
    let s = postavSenok(doDraftu(6));
    const u = obrancaOf(s);
    const o = s.utocnik;
    s = sCigaretami(sCigaretami(s, u, 3), o, 0);
    expect(legalCommands(data, s, o).some((c) => c.type === "draftBer")).toBe(false);
    s = apply(data, s, { type: "draftBer", uids: [s.senok[0]!.uid] }, u).state;
    // Útočník nemá čím platiť → jeho branie sa ukončí samo, berie ďalej obranca.
    expect(s.draftStav?.hotovo[o]).toBe(true);
    expect(naTahu(s)).toBe(u);
  });

  it("bez kariet v línii sa ráta jedna Pitka (Michal 2026-10-19 — Pitky podľa akcií lokality)", () => {
    let s = postavSenok(doDraftu(9));
    s = apply(data, s, { type: "draftStop" }, naTahu(s)!).state;
    s = apply(data, s, { type: "draftStop" }, naTahu(s)!).state;
    expect(s.faza).toBe("zhromazdenie");
    expect(s.pitkyCelkom).toBe(1);
  });

  it("prázdny šenok: hra za hráča sama ukončí branie", () => {
    let s = postavSenok(doDraftu(7));
    s = { ...s, senok: [] };
    expect(legalCommands(data, s, obrancaOf(s))).toEqual([{ type: "draftStop" } satisfies Command]);
  });

  it("nevzaté karty idú pri ďalšom drafte naspodok svojho balíčka (Náradie / Občania)", () => {
    let s = postavSenok(doDraftu(8));
    for (let i = 0; i < 2; i++) s = apply(data, s, { type: "draftStop" }, naTahu(s)!).state;
    const zvysok = s.senok;
    expect(zvysok).toHaveLength(8);
    const nastroje = zvysok.filter((k) => jeNaradie(data, k)).map((k) => k.uid);
    const obcania = zvysok.filter((k) => !jeNaradie(data, k)).map((k) => k.uid);
    expect(nastroje.length).toBeGreaterThan(0);
    // Nasimulujeme začiatok ďalšieho kola s voľbou lokality.
    const dalsie: GameState = { ...s, faza: "volbaCiela", draftStav: null, zhromazdenieStav: null, pitkaStav: null };
    const lok = dalsie.lokalityVHre[0]!;
    const po = apply(data, dalsie, { type: "chooseLocation", uid: lok.uid, otocena: false }, (1 - dalsie.utocnik) as PlayerId).state;
    expect(po.senok).toHaveLength(0);
    expect(po.naradie.slice(-nastroje.length).map((k) => k.uid)).toEqual(nastroje);
    expect(po.obcania.slice(-obcania.length).map((k) => k.uid)).toEqual(obcania);
  });
});

describe("doplnenie šenku po braní (Michal 2026-10-20)", () => {
  it("po braní sa šenok doplní na 8; s 2 Nástrojmi v šenku z vrchu Občanov", () => {
    let s = postavSenok(doDraftu(10));
    // Obranca (prvý, v9.2) a útočník vezmú po jednom Nástroji z čela šenku — v šenku ostanú dva ďalšie.
    const o = obrancaOf(s);
    s = sCigaretami(sCigaretami(s, o, 3), s.utocnik, 3);
    expect(s.senok.slice(0, 2).every((k) => jeNaradie(data, k))).toBe(true);
    s = apply(data, s, { type: "draftBer", uids: [s.senok[0]!.uid] }, o).state;
    s = apply(data, s, { type: "draftBer", uids: [s.senok[0]!.uid] }, s.utocnik).state;
    expect(s.senok).toHaveLength(6);
    expect(s.senok.filter((k) => jeNaradie(data, k))).toHaveLength(2);
    const vrch = s.obcania.slice(0, 2).map((k) => k.uid);
    while (s.faza === "draft") s = apply(data, s, { type: "draftStop" }, naTahu(s)!).state;
    expect(s.senok).toHaveLength(KONSTANTY.SENOK_PO_BRANI);
    expect(s.senok.slice(-2).map((k) => k.uid)).toEqual(vrch);
  });

  it("v pomere stavby: najprv z Náradia, kým v šenku nie sú 2 Nástroje, zvyšok z Občanov (v8.5)", () => {
    let s = postavSenok(doDraftu(14));
    // Šenok bez Nástrojov, 4 Občania.
    s = { ...s, senok: s.senok.filter((k) => !jeNaradie(data, k)).slice(0, 4) };
    const naradie = s.naradie.slice(0, 2).map((k) => k.uid);
    const obcania = s.obcania.slice(0, 2).map((k) => k.uid);
    while (s.faza === "draft") s = apply(data, s, { type: "draftStop" }, naTahu(s)!).state;
    expect(s.senok.slice(-4).map((k) => k.uid)).toEqual([...naradie, ...obcania]);
    // Bez Náradia doplnia všetko Občania.
    let b = postavSenok(doDraftu(14));
    b = { ...b, senok: [], naradie: [] };
    const vrch = b.obcania.slice(0, 8).map((k) => k.uid);
    while (b.faza === "draft") b = apply(data, b, { type: "draftStop" }, naTahu(b)!).state;
    expect(b.senok.map((k) => k.uid)).toEqual(vrch);
  });
});

describe("posledná šanca v šenku (Michal 2026-10-20)", () => {
  it("keď jeden prestane, druhý berie už len raz a branie končí", () => {
    let s = postavSenok(doDraftu(11));
    // Prvý je na ťahu obranca (v9.2) a prestane; útočník berie už len raz.
    const u = obrancaOf(s);
    const o = s.utocnik;
    s = sCigaretami(sCigaretami(s, u, 9), o, 9);
    s = apply(data, s, { type: "draftStop" }, u).state;
    expect(naTahu(s)).toBe(o);
    s = apply(data, s, { type: "draftBer", uids: [s.senok[0]!.uid] }, o).state;
    expect(s.faza).toBe("zhromazdenie");
    expect(s.hraci[o].cigarety).toBe(8);
  });
});

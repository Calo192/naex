// Draft so stavbou šenku (Michal 2026-10-12): hráči si podávajú balíčky,
// naraz dávajú karty do šenku a naspodok (od 2026-10-19 po dvoch), potom
// striedavo berú — 1 karta za cigaretu, 2 karty za 3 cigarety.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { CardInstance, Command, GameState, PlayerId } from "../src/index.ts";
import {
  apply,
  IllegalCommandError,
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

/** Výber v kroku stavby: prvé dve karty do šenku, ďalšie dve naspodok. */
const vyber = (b: readonly CardInstance[]): Command => ({
  type: "stavbaSenku",
  doSenku: b.slice(0, 2).map((k) => k.uid),
  odhod: b.slice(2, 4).map((k) => k.uid),
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
  it("každý dostane toľko kariet, koľko je nenahradených starších (nadol na párne)", () => {
    const s0 = setupGame(data, 1);
    expect(s0.senok).toHaveLength(0);
    const s = doDraftu(1);
    expect(velkostStavby(s0)).toBe(8);
    expect(s.draftStav?.krok).toBe("stavba");
    expect(s.draftStav?.balicky[0]).toHaveLength(8);
    expect(s.draftStav?.balicky[1]).toHaveLength(8);
    expect(s.spolocnyBalicek).toHaveLength(s0.spolocnyBalicek.length - 16);
    const sedem = { ...s0, starsi: s0.starsi.map((e, i) => (i === 0 ? { ...e, nahradeny: true } : e)) };
    expect(velkostStavby(sedem)).toBe(6);
  });

  it("obaja hrajú naraz; výber sa odhalí, až keď vyberú obaja", () => {
    let s = doDraftu(2);
    const u = s.utocnik;
    const o = obrancaOf(s);
    expect(mozeHrat(s, 0) && mozeHrat(s, 1)).toBe(true);
    expect(naTahu(s)).toBe(o);
    // Útočník smie vybrať skôr než obranca.
    const bu = s.draftStav!.balicky[u];
    // Do šenku aj naspodok presne po dve karty, každá len raz.
    expect(() => apply(data, s, { type: "stavbaSenku", doSenku: [bu[0]!.uid], odhod: [bu[1]!.uid, bu[2]!.uid] }, u)).toThrow(/Do šenku daj 2/);
    expect(() => apply(data, s, { type: "stavbaSenku", doSenku: [bu[0]!.uid, bu[1]!.uid], odhod: [bu[1]!.uid, bu[2]!.uid] }, u)).toThrow(/len raz/);
    s = apply(data, s, vyber(bu), u).state;
    expect(mozeHrat(s, u)).toBe(false);
    expect(s.senok).toHaveLength(0);
    expect(() => apply(data, s, vyber(bu.slice(4)), u)).toThrow(IllegalCommandError);
    // Obranca výber útočníka nevidí, len že vybral.
    const pohlad = viewFor(data, s, o);
    expect(pohlad.draftStav?.vybral[u]).toBe(true);
    expect(pohlad.draftStav?.mojVyber).toBeNull();
    expect(JSON.stringify(pohlad)).not.toContain(`"uid":${bu[0]!.uid},`);

    const bo = s.draftStav!.balicky[o];
    const predBalicek = s.spolocnyBalicek.length;
    s = apply(data, s, vyber(bo), o).state;
    const uids = (b: readonly CardInstance[]): number[] => b.map((k) => k.uid);
    expect(uids(s.senok).sort()).toEqual([...uids(bu.slice(0, 2)), ...uids(bo.slice(0, 2))].sort());
    // Odhodené ležia naspodok spoločného balíčka.
    expect(s.spolocnyBalicek).toHaveLength(predBalicek + 4);
    expect(uids(s.spolocnyBalicek.slice(-4)).sort()).toEqual([...uids(bu.slice(2, 4)), ...uids(bo.slice(2, 4))].sort());
    // Balíčky sa vymenili: obranca má teraz zvyšok útočníkovho.
    expect(uids(s.draftStav!.balicky[o])).toEqual(uids(bu.slice(4)));
  });

  it("odhodené karty sa nedostanú do pohľadu ani do logu súpera", () => {
    let s = doDraftu(3);
    const u = s.utocnik;
    const o = obrancaOf(s);
    const bo = s.draftStav!.balicky[o];
    const odhod = bo[2]!;
    let udalosti: string[] = [];
    for (const [p, b] of [[u, s.draftStav!.balicky[u]], [o, bo]] as const) {
      const r = apply(data, s, vyber(b), p);
      s = r.state;
      udalosti = [...udalosti, ...r.events.map((e) => JSON.stringify(e))];
    }
    expect(udalosti.join()).not.toContain(`"uid":${odhod.uid},`);
    expect(JSON.stringify(viewFor(data, s, u))).not.toContain(`"uid":${odhod.uid},`);
  });

  it("stavba má dva kroky; po nej má šenok 8 kariet a spoločný balíček stratil len tie", () => {
    const s0 = setupGame(data, 4);
    const s1 = krokStavby(doDraftu(4));
    expect(s1.draftStav?.krok).toBe("stavba");
    expect(s1.draftStav?.balicky[0]).toHaveLength(4);
    const s = krokStavby(s1);
    expect(s.senok).toHaveLength(8);
    expect(s.spolocnyBalicek).toHaveLength(s0.spolocnyBalicek.length - 8);
    expect(s.draftStav?.krok).toBe("beranie");
    // Zo šenku berie prvý útočník (Michal 2026-10-16).
    expect(naTahu(s)).toBe(s.utocnik);
  });
});

describe("branie zo šenku (Michal 2026-10-19: 1 karta za cigaretu, 2 karty za 3 cigarety)", () => {
  it("striedavo, začína útočník; 1 karta = 1 cigareta, 2 karty = 3 cigarety, nič zadarmo, poldeci sa neplatí", () => {
    let s = postavSenok(doDraftu(5));
    const u = s.utocnik;
    const o = obrancaOf(s);
    s = sCigaretami(sCigaretami(s, u, 4), o, 2);
    const poldeci = s.hraci[o].poldeciPlne;
    expect(() => apply(data, s, { type: "draftBer", uids: [s.senok[0]!.uid] }, o)).toThrow(IllegalCommandError);
    expect(() => apply(data, s, { type: "draftBer", uids: [] }, u)).toThrow(/1 alebo 2/);
    expect(() => apply(data, s, { type: "draftBer", uids: s.senok.slice(0, 3).map((k) => k.uid) }, u)).toThrow(/1 alebo 2/);
    s = apply(data, s, { type: "draftBer", uids: [s.senok[0]!.uid, s.senok[1]!.uid] }, u).state;
    expect(s.hraci[u].cigarety).toBe(1);
    expect(s.draftStav?.noveKarty[u]).toBe(2);
    expect(naTahu(s)).toBe(o);
    // Obranca s 2 cigaretami nemá na dve karty — len na jednu.
    expect(legalCommands(data, s, o).some((c) => c.type === "draftBer" && c.uids.length === 2)).toBe(false);
    expect(() => apply(data, s, { type: "draftBer", uids: [s.senok[0]!.uid, s.senok[1]!.uid] }, o)).toThrow(/3 cigarety/);
    s = apply(data, s, { type: "draftBer", uids: [s.senok[0]!.uid] }, o).state;
    expect(s.hraci[o].cigarety).toBe(1);
    expect(s.hraci[o].poldeciPlne).toBe(poldeci);
    expect(naTahu(s)).toBe(u);
    // Limit kariet nie je — berie sa, kým je čím platiť.
    s = apply(data, s, { type: "draftBer", uids: [s.senok[0]!.uid] }, u).state;
    expect(s.draftStav?.noveKarty[u]).toBe(3);
  });

  it("bez cigariet sa zo šenku nedá brať — hra za hráča branie ukončí", () => {
    let s = postavSenok(doDraftu(6));
    const u = s.utocnik;
    const o = obrancaOf(s);
    s = sCigaretami(sCigaretami(s, u, 3), o, 0);
    expect(legalCommands(data, s, o).some((c) => c.type === "draftBer")).toBe(false);
    s = apply(data, s, { type: "draftBer", uids: [s.senok[0]!.uid] }, u).state;
    // Obranca nemá čím platiť → jeho branie sa ukončí samo, berie ďalej útočník.
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
    expect(legalCommands(data, s, s.utocnik)).toEqual([{ type: "draftStop" } satisfies Command]);
  });

  it("nevzaté karty idú pri ďalšom drafte naspodok spoločného balíčka", () => {
    let s = postavSenok(doDraftu(8));
    for (let i = 0; i < 2; i++) s = apply(data, s, { type: "draftStop" }, naTahu(s)!).state;
    const zvysok = s.senok.map((k) => k.uid);
    expect(zvysok).toHaveLength(8);
    // Nasimulujeme začiatok ďalšieho kola s voľbou lokality.
    const dalsie: GameState = { ...s, faza: "volbaCiela", draftStav: null, zhromazdenieStav: null, pitkaStav: null };
    const lok = dalsie.lokalityVHre[0]!;
    const po = apply(data, dalsie, { type: "chooseLocation", uid: lok.uid, otocena: false }, (1 - dalsie.utocnik) as PlayerId).state;
    expect(po.senok).toHaveLength(0);
    expect(po.spolocnyBalicek.slice(-8).map((k) => k.uid)).toEqual(zvysok);
  });
});

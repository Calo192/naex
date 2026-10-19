// Draft so stavbou šenku (Michal 2026-10-12): hráči si podávajú balíčky,
// naraz dávajú kartu do šenku a kartu naspodok, potom striedavo berú.

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
  return apply(data, s, { type: "chooseLocation", uid: lok.uid, otocena: false }, s.utocnik).state;
}

const obrancaOf = (s: GameState): PlayerId => (s.utocnik === 0 ? 1 : 0);

/** Jeden krok stavby: každý dá prvú kartu do šenku a druhú naspodok. */
function krokStavby(s: GameState): GameState {
  for (const p of [obrancaOf(s), s.utocnik] as const) {
    const b = s.draftStav!.balicky[p];
    s = apply(data, s, { type: "stavbaSenku", doSenku: b[0]!.uid, odhod: b[1]!.uid }, p).state;
  }
  return s;
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
    s = apply(data, s, { type: "stavbaSenku", doSenku: bu[0]!.uid, odhod: bu[1]!.uid }, u).state;
    expect(mozeHrat(s, u)).toBe(false);
    expect(s.senok).toHaveLength(0);
    expect(() => apply(data, s, { type: "stavbaSenku", doSenku: bu[2]!.uid, odhod: bu[3]!.uid }, u)).toThrow(
      IllegalCommandError,
    );
    // Obranca výber útočníka nevidí, len že vybral.
    const pohlad = viewFor(data, s, o);
    expect(pohlad.draftStav?.vybral[u]).toBe(true);
    expect(pohlad.draftStav?.mojVyber).toBeNull();
    expect(JSON.stringify(pohlad)).not.toContain(`"uid":${bu[0]!.uid},`);

    const bo = s.draftStav!.balicky[o];
    const predBalicek = s.spolocnyBalicek.length;
    s = apply(data, s, { type: "stavbaSenku", doSenku: bo[0]!.uid, odhod: bo[1]!.uid }, o).state;
    expect(s.senok.map((k) => k.uid).sort()).toEqual([bu[0]!.uid, bo[0]!.uid].sort());
    // Odhodené ležia naspodok spoločného balíčka.
    expect(s.spolocnyBalicek).toHaveLength(predBalicek + 2);
    expect(s.spolocnyBalicek.slice(-2).map((k) => k.uid).sort()).toEqual([bu[1]!.uid, bo[1]!.uid].sort());
    // Balíčky sa vymenili: obranca má teraz zvyšok útočníkovho.
    expect(s.draftStav!.balicky[o].map((k) => k.uid)).toEqual(bu.slice(2).map((k) => k.uid));
  });

  it("odhodené karty sa nedostanú do pohľadu ani do logu súpera", () => {
    let s = doDraftu(3);
    const u = s.utocnik;
    const o = obrancaOf(s);
    const bo = s.draftStav!.balicky[o];
    const odhod = bo[1]!;
    let udalosti: string[] = [];
    for (const [p, b] of [[u, s.draftStav!.balicky[u]], [o, bo]] as const) {
      const r = apply(data, s, { type: "stavbaSenku", doSenku: b[0]!.uid, odhod: b[1]!.uid }, p);
      s = r.state;
      udalosti = [...udalosti, ...r.events.map((e) => JSON.stringify(e))];
    }
    expect(udalosti.join()).not.toContain(`"uid":${odhod.uid},`);
    expect(JSON.stringify(viewFor(data, s, u))).not.toContain(`"uid":${odhod.uid},`);
  });

  it("po stavbe má šenok 8 kariet a spoločný balíček stratil len tie", () => {
    const s0 = setupGame(data, 4);
    const s = postavSenok(doDraftu(4));
    expect(s.senok).toHaveLength(8);
    expect(s.spolocnyBalicek).toHaveLength(s0.spolocnyBalicek.length - 8);
    expect(s.draftStav?.krok).toBe("beranie");
    // Zo šenku berie prvý útočník (Michal 2026-10-16).
    expect(naTahu(s)).toBe(s.utocnik);
  });
});

describe("branie zo šenku (Michal 2026-10-18: 1 karta za cigaretu, 2 za poldeci, bez limitu)", () => {
  it("striedavo, začína útočník; cigareta = 1 karta, poldeci = 2 karty v jednom ťahu, nič zadarmo", () => {
    let s = postavSenok(doDraftu(5));
    const u = s.utocnik;
    const o = obrancaOf(s);
    const hraci = [...s.hraci] as [GameState["hraci"][0], GameState["hraci"][1]];
    hraci[u] = { ...hraci[u], cigarety: 3 };
    hraci[o] = { ...hraci[o], cigarety: 0 };
    s = { ...s, hraci };
    expect(() => apply(data, s, { type: "draftBer", uid: s.senok[0]!.uid, platba: "cigareta" }, o)).toThrow(IllegalCommandError);
    // Bez platby sa nedá — žiadna karta zadarmo.
    expect(() => apply(data, s, { type: "draftBer", uid: s.senok[0]!.uid }, u)).toThrow(IllegalCommandError);
    s = apply(data, s, { type: "draftBer", uid: s.senok[0]!.uid, platba: "cigareta" }, u).state;
    expect(s.hraci[u].cigarety).toBe(2);
    expect(s.hraci[u].poldeciPlne).toBe(2);
    expect(naTahu(s)).toBe(o);
    // Obranca bez cigariet platí poldeci: dve karty, druhú hneď v tom istom ťahu.
    expect(legalCommands(data, s, o).some((c) => c.type === "draftBer" && c.platba === "cigareta")).toBe(false);
    s = apply(data, s, { type: "draftBer", uid: s.senok[0]!.uid, platba: "poldeci" }, o).state;
    expect([s.hraci[o].poldeciPlne, s.hraci[o].poldeciVypite]).toEqual([1, 1]);
    expect(s.draftStav?.kredit[o]).toBe(1);
    expect(naTahu(s)).toBe(o);
    s = apply(data, s, { type: "draftBer", uid: s.senok[0]!.uid }, o).state;
    expect(s.draftStav?.noveKarty[o]).toBe(2);
    expect(naTahu(s)).toBe(u);
    // Limit 3 karty už neplatí.
    for (let i = 0; i < 2; i++) {
      s = apply(data, s, { type: "draftBer", uid: s.senok[0]!.uid, platba: "cigareta" }, u).state;
      if (naTahu(s) === o) s = apply(data, s, { type: "draftStop" }, o).state;
    }
    expect(s.draftStav?.noveKarty[u]).toBe(3);
  });

  it("bez cigariet a plného poldeci sa zo šenku nedá brať — hra za hráča branie ukončí", () => {
    let s = postavSenok(doDraftu(6));
    const u = s.utocnik;
    const o = obrancaOf(s);
    const hraci = [...s.hraci] as [GameState["hraci"][0], GameState["hraci"][1]];
    hraci[o] = { ...hraci[o], poldeciPlne: 0, poldeciVypite: 2, cigarety: 0 };
    s = { ...s, hraci };
    expect(legalCommands(data, s, o).some((c) => c.type === "draftBer")).toBe(false);
    s = apply(data, s, { type: "draftBer", uid: s.senok[0]!.uid, platba: "poldeci" }, u).state;
    s = apply(data, s, { type: "draftBer", uid: s.senok[0]!.uid }, u).state;
    // Obranca nemá čím platiť → jeho branie sa ukončí samo, berie ďalej útočník.
    expect(s.draftStav?.hotovo[o]).toBe(true);
    expect(naTahu(s)).toBe(u);
  });

  it("bitka začína jednou Pitkou (Michal 2026-10-19 — ďalšie sa objednávajú)", () => {
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
    const po = apply(data, dalsie, { type: "chooseLocation", uid: lok.uid, otocena: false }, dalsie.utocnik).state;
    expect(po.senok).toHaveLength(0);
    expect(po.spolocnyBalicek.slice(-8).map((k) => k.uid)).toEqual(zvysok);
  });
});

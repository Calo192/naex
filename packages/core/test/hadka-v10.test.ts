// Pravidlá v10 „Hádka“ (Michal 2026-11-01, docs/napady/hadka.html, verzia 4): Povery a Pohoršenie
// sú mäkké poškodenie; od v11 víťaz hádky rozdelí rozdiel na svoje reči (strach-reci.test.ts). Abstinent odpúšťa Absťáky; Telefón,
// Horoskop, Svätý text, Čierna mačka, Šarlatán, Veriaci v dvoch častiach. Príklady „Ana a Boris“
// z dokumentu: Ana je hráč 0, Boris hráč 1.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { BattleSide, BitkaStav, CardInstance, Favour, GameState, LineState, PlacedCard, PlayerId, StavHadky } from "../src/index.ts";
import {
  apply,
  battleOutcome,
  computeDamage,
  evaluateLine,
  favourStarsieho,
  legalCommands,
  loadGameData,
  poskodenieBitky,
  rekapitulaciaBitky,
  setupGame,
  silaPriazne,
  viewFor,
  vysledokHadky,
} from "../src/index.ts";
import { EMPTY, instanceFor, makeDef, syntheticData, zPolohy } from "./helpers.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

function side(o: Partial<BattleSide> = {}): BattleSide {
  return { sums: {}, cirhozaBonus: 0, tuheBonus: 0, abstaky: 0, priazenBitkara: 0, hodnotaViery: 1, ...o };
}

describe("§9 krok Hádka — mäkké poškodenie (computeDamage)", () => {
  it("Ana a Boris: Borisova Viera zruší jednu Aninu Poveru — mäkké 8 : 5, Ana vyhrala hádku o 3", () => {
    const d = computeDamage([side({ sums: { Pohoršenie: 2, Povera: 2 } }), side({ sums: { Pohoršenie: 1, Povera: 1, Viera: 1 } })]);
    expect(d.makke).toEqual([8, 5]);
    expect(d.zrusenePovery).toEqual([1, 0]);
    // Viera, ktorá rušila Poveru, na tuhé nezostane.
    expect(d.zvysnaViera).toEqual([0, 0]);
    expect(vysledokHadky(d.makke)).toEqual({ vitaz: 0, velkost: 3 });
  });

  it("rovnosť mäkkého = remíza, nikto nerozdeľuje (H5)", () => {
    expect(vysledokHadky(computeDamage([side({ sums: { Pohoršenie: 2 } }), side({ sums: { Povera: 3 } })]).makke)).toEqual({ vitaz: null, velkost: 0 });
    expect(vysledokHadky([0, 0])).toEqual({ vitaz: null, velkost: 0 });
  });

  it("Viera proti Pohoršeniu nepomáha — zvyšná Viera tlmí tuhé", () => {
    const d = computeDamage([side({ sums: { Pohoršenie: 2, Rana: 3 } }), side({ sums: { Viera: 2 } })]);
    expect(d.makke).toEqual([6, 0]);
    expect(d.tuhe[0]).toBe(1);
  });

  it("Horoskop: Povera má silu 3; ruší sa stále 1 : 1 na kusy — jedna Viera zruší 3 mäkké", () => {
    const d = computeDamage([side({ sums: { Povera: 3 }, silaPovery: 3 }), side({ sums: { Viera: 1 } })]);
    expect(d.zrusenePovery?.[0]).toBe(1);
    expect(d.makke[0]).toBe(6);
  });

  it("Svätý text: jedna Viera zruší stále len jednu Poveru (aj vylepšenú Horoskopom); hodnota 2 len v tlmení tuhého", () => {
    // Michal 2026-11-01: „1 akcia Viera zruší jednu akciu Povera — vylepšenú, nevylepšenú“.
    const bez = computeDamage([side({ sums: { Povera: 2 } }), side({ sums: { Viera: 1 }, hodnotaViery: 2 })]);
    expect(bez.zrusenePovery?.[0]).toBe(1);
    expect(bez.makke[0]).toBe(2);
    const sHoroskopom = computeDamage([side({ sums: { Povera: 3, Rana: 4 }, silaPovery: 3 }), side({ sums: { Viera: 2 }, hodnotaViery: 2 })]);
    // Dve Viery zrušia dve vylepšené Povery celé, tretia dá 3 mäkké; na tuhé Viera nezostane.
    expect(sHoroskopom.makke[0]).toBe(3);
    expect(sHoroskopom.zvysnaViera[1]).toBe(0);
    expect(sHoroskopom.tuhe[0]).toBe(4);
    // Zvyšná Viera so Svätým textom tlmí tuhé dvakrát.
    expect(computeDamage([side({ sums: { Povera: 1, Rana: 5 } }), side({ sums: { Viera: 2 }, hodnotaViery: 2 })]).tuhe[0]).toBe(3);
  });

  it("Čierna mačka: jej Povery sa Vierou nerušia — vždy mäkké, Viera ostáva na tuhé", () => {
    const d = computeDamage([side({ sums: { Povera: 2, Rana: 3 }, poveryBezViery: true }), side({ sums: { Viera: 2 } })]);
    expect(d.makke[0]).toBe(4);
    expect(d.tuhe[0]).toBe(1);
  });

  it("Veriaci v dvoch častiach: proti Poverám so silou pred hádkou, rozdiel po hádke v tlmení tuhého", () => {
    // Veriaci pred hádkou 1 zruší 1 Poveru; hádka mu pridala na 3 → tlmenie tuhého +2.
    const d = computeDamage([side({ sums: { Povera: 1, Rana: 5 } }), side({ vieraVeriacehoPred: 1, vieraVeriaceho: 3 })]);
    expect(d.makke[0]).toBe(0);
    expect(d.zvysnaViera[1]).toBe(2);
    expect(d.tuhe[0]).toBe(3);
    // Hádka mu silu vzala (2 → 0): Viera z Veriaceho, ktorá rušila, ostala minutá, tuhé netlmí.
    const vzala = computeDamage([side({ sums: { Rana: 5 } }), side({ vieraVeriacehoPred: 2, vieraVeriaceho: 0 })]);
    expect(vzala.zvysnaViera[1]).toBe(0);
    expect(vzala.tuhe[0]).toBe(5);
  });

  it("Abstinent: v bitke sa neráta 1 / 2 / 3 Absťákov — v poškodení aj pri remíze v tuhom", () => {
    expect(computeDamage([side({ sums: { Rana: 4 }, abstaky: 3, silaAbstinenta: 2 }), side()]).tuhe[0]).toBe(3);
    expect(computeDamage([side({ sums: { Rana: 4 }, abstaky: 1, silaAbstinenta: 3 }), side()]).tuhe[0]).toBe(4);
    // Remíza 2 : 2: hráč 0 má 3 Absťáky (Abstinent 3 → 0), hráč 1 má 1 → vyhrá hráč 0.
    const d = computeDamage([side({ sums: { Rana: 5 }, abstaky: 3, silaAbstinenta: 3 }), side({ sums: { Rana: 3 }, abstaky: 1 })]);
    expect(d.tuhe).toEqual([5, 2]);
    const remiza = computeDamage([side({ sums: { Rana: 2 }, abstaky: 3, silaAbstinenta: 3 }), side({ sums: { Rana: 3 }, abstaky: 1 })]);
    expect(remiza.tuhe).toEqual([2, 2]);
    expect(battleOutcome(remiza, { abstaky: [3, 1], dlhy: [0, 0] })).toMatchObject({ vitaz: 0, rozhodlo: "abstak" });
    // Abstinent do hádky nevstupuje (Pohoršenia navyše nedáva).
    expect(remiza.makke).toEqual([0, 0]);
  });
});

// Rozdelenie hádky na priazne v motore (v10) zaniklo s v11 — hádka dvíha reči (strach-reci.test.ts).

describe("Telefón (Dedičstvo, v10): tvoje Pohoršenia nemožno zrušiť Odporom a NA EX", () => {
  const own = (card: CardInstance, naex = false): PlacedCard => ({ card, playedBy: 0, ...(naex ? { naexBy: 1 as PlayerId } : {}) });

  it("Odpor súpera na spoji s mojím Pohoršením ho nezruší", () => {
    const syn = syntheticData([makeDef("a", [null, "Pohoršenie", null, null], EMPTY), makeDef("c", [null, null, "Odpor", null], EMPTY)]);
    const a = instanceFor(syn, "a", [null, "Pohoršenie", null, null], EMPTY);
    const c = instanceFor(syn, "c", [null, null, "Odpor", null], EMPTY);
    const strany = [[own(a), { card: c, playedBy: 1 as PlayerId }], []] as const;
    expect(evaluateLine(syn, { lokalita: null, lokalitaOtocena: false, strany, nastroje: [[], []] }).sums).toEqual([{}, {}]);
    expect(evaluateLine(syn, { lokalita: null, lokalitaOtocena: false, strany, nastroje: [["telefon"], []] }).sums).toEqual([{ Pohoršenie: 1 }, {}]);
  });

  it("NA EX moje aktívne Pohoršenia nezruší (ostatné áno)", () => {
    const par = (nastroje: readonly string[]) => {
      const syn = syntheticData([makeDef("a", ["Pohoršenie", "Rana", null, null], EMPTY), makeDef("b", EMPTY, ["Pohoršenie", "Rana", null, null])]);
      const a = instanceFor(syn, "a", ["Pohoršenie", "Rana", null, null], EMPTY);
      const b = instanceFor(syn, "b", EMPTY, ["Pohoršenie", "Rana", null, null]);
      return evaluateLine(syn, { lokalita: null, lokalitaOtocena: false, strany: [[own(a, true), own(b)], []], nastroje: [nastroje, []] }).sums[0];
    };
    expect(par([])).toEqual({ Pohoršenie: 1, Rana: 1 });
    expect(par(["telefon"])).toEqual({ Pohoršenie: 2, Rana: 1 });
  });
});

describe("Šarlatán (Konflikt) ďalej: súperove Povery sa z mäkkého presunú do tuhého", () => {
  it("Povera ako Rana — mäkké neprinesie, tuhé áno", () => {
    const syn = syntheticData([makeDef("a", [null, "Povera", null, null], EMPTY), makeDef("b", EMPTY, [null, "Rana", null, null])]);
    const a = instanceFor(syn, "a", [null, "Povera", null, null], EMPTY);
    const b = instanceFor(syn, "b", EMPTY, [null, "Rana", null, null]);
    const l = (premena: boolean): LineState => ({
      lokalita: null,
      lokalitaOtocena: false,
      strany: [[{ card: a, playedBy: 0, ...(premena ? { premena: "sarlatan" as const } : {}) }, { card: b, playedBy: 0 }], []],
    });
    expect(evaluateLine(syn, l(false)).sums[0]).toEqual({ Povera: 1, Rana: 1 });
    expect(evaluateLine(syn, l(true)).sums[0]).toEqual({ Rana: 2 });
  });
});

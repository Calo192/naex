// Pakt (v7, Michal 2026-10-27): „Na spoji sa správa ako akcia, s ktorou je v páre.“
// Otvorené body z plan.md 12.3 podľa návrhov Vymyselníka. Plus ďalšie efekty
// polohy v línii z revízie: Praudovravec (Dezinformátor), Šarlatán, Kôň,
// Brigádnik, Poľovnícka chata.

import { describe, expect, it } from "vitest";
import type { CardInstance, LineState, PlacedCard } from "../src/index.ts";
import { evaluateLine, naexMaZmysel, prevahaStran } from "../src/index.ts";
import { EMPTY, instanceFor, makeDef, syntheticData, type Layout4 } from "./helpers.ts";

const own = (card: CardInstance): PlacedCard => ({ card, playedBy: 0 });
/** Partia hráča 0 bez lokality: [A, B] sa vyhodnotí ako [B, A] — pravá strana B proti ľavej A. */
const line = (...cards: PlacedCard[]): LineState => ({ lokalita: null, lokalitaOtocena: false, strany: [cards, []] });

function par(aLeft: Layout4, bRight: Layout4, aId = "a", bId = "b") {
  const data = syntheticData([makeDef(aId, aLeft, EMPTY), makeDef(bId, EMPTY, bRight)]);
  const a = instanceFor(data, aId, aLeft, EMPTY);
  const b = instanceFor(data, bId, EMPTY, bRight);
  return { data, a, b, l: line(own(a), own(b)) };
}

describe("Pakt (§2, §6)", () => {
  it("kopíruje akciu partnera: Pakt proti Petelici = dve Petelice", () => {
    const { data, l } = par([null, "Pakt", null, null], [null, "Petelica", null, null]);
    expect(evaluateLine(data, l).sums[0]).toEqual({ Petelica: 2 });
  });

  it("kopíruje aj zlú akciu: Pakt proti Dlhu = dva Dlhy", () => {
    const { data, l } = par([null, null, "Pakt", null], [null, null, "Dlh", null]);
    expect(evaluateLine(data, l).sums[0]).toEqual({ Dlh: 2 });
  });

  it("bez partnera je neaktívny a v súčtoch nie je", () => {
    const { data, a, l } = par([null, "Pakt", null, null], EMPTY);
    const ev = evaluateLine(data, l);
    expect(ev.sums[0]).toEqual({});
    expect(ev.cards.get(a.uid)?.left[1]?.stav).toBe("neaktivna");
  });

  it("12.3 bod 1: Pakt s Paktom nerobí nič", () => {
    const { data, l } = par([null, "Pakt", null, null], [null, "Pakt", null, null]);
    expect(evaluateLine(data, l).sums[0]).toEqual({});
  });

  it("12.3 bod 2: Pakt proti Posilneniu sa stane Posilnením — nič sa nezdvojí", () => {
    const { data, l } = par([null, "Pakt", "Rana", null], [null, "Posilnenie", null, null]);
    expect(evaluateLine(data, l).sums[0]).toEqual({});
  });

  it("12.3 bod 4: Odpor Pakt zruší", () => {
    const { data, a, l } = par([null, "Pakt", null, null], [null, "Odpor", null, null]);
    const ev = evaluateLine(data, l);
    expect(ev.sums[0]).toEqual({});
    expect(ev.cards.get(a.uid)?.left[1]?.stav).toBe("zrusena");
  });

  it("12.3 bod 6: NA EX zruší aktívny Pakt, neaktívny nezdvojí a do „aspoň 1 neaktívna“ sa neráta", () => {
    const data = syntheticData([makeDef("a", [null, "Pakt", "Pakt", null], EMPTY), makeDef("b", EMPTY, [null, "Pecka", null, null])]);
    const a = instanceFor(data, "a", [null, "Pakt", "Pakt", null], EMPTY);
    const b = instanceFor(data, "b", EMPTY, [null, "Pecka", null, null]);
    const bezNaex = line(own(a), own(b));
    // Karta a má jeden aktívny (Pecka) a jeden neaktívny Pakt — NA EX by nemalo čo zdvojiť.
    expect(naexMaZmysel(data, bezNaex).has(a.uid)).toBe(false);
    const sNaex = line({ card: a, playedBy: 0, naexBy: 0 }, own(b));
    expect(evaluateLine(data, sNaex).sums[0]).toEqual({ Pecka: 1 });
  });
});

describe("efekty polohy v línii (v7)", () => {
  it("Praudovravec: Odpor na jeho spoji neruší, ale posilní", () => {
    const { data, l } = par([null, "Odpor", null, null], [null, "Pecka", null, null], "praudovravec", "b");
    expect(evaluateLine(data, l).sums[0]).toEqual({ Pecka: 2 });
  });

  it("Šarlatán: aktívne Poškodenie pečene pri ňom sa ráta aj ako Viera", () => {
    const { data, l } = par([null, "PoškodeniePečene", null, null], [null, "Rana", null, null], "sarlatan", "b");
    expect(evaluateLine(data, l).sums[0]).toEqual({ PoškodeniePečene: 1, Viera: 1, Rana: 1 });
  });

  it("Kôň: Nástroj s ním tvorí spoj", () => {
    const kon = makeDef("kon", [null, "Rana", null, null], EMPTY, { tags: ["Zviera"] });
    const nastroj = makeDef("n", EMPTY, [null, "Pecka", null, null], { tags: ["Nástroj"] });
    const data = syntheticData([kon, nastroj]);
    const a = instanceFor(data, "kon", [null, "Rana", null, null], EMPTY);
    const b = instanceFor(data, "n", EMPTY, [null, "Pecka", null, null]);
    expect(evaluateLine(data, line(own(a), own(b))).sums[0]).toEqual({ Rana: 1, Pecka: 1 });
  });

  it("Brigádnik sa do prevahy neráta", () => {
    const data = syntheticData([makeDef("brigadnik", EMPTY, EMPTY), makeDef("x", EMPTY, EMPTY)]);
    const br = instanceFor(data, "brigadnik", EMPTY, EMPTY);
    const x = instanceFor(data, "x", EMPTY, EMPTY);
    // Hráč 0 má pri lokalite Brigádnika, hráč 1 za ním Občana — prevahu má hráč 1.
    expect(prevahaStran(data, [[own(br), { card: x, playedBy: 1 }], []])[0]).toBe(1);
  });

  it("Poľovnícka chata: tuhé z hrán ×2, ostatné akcie hrán nie", () => {
    const chata = makeDef("polovnicka_chata", [null, "Petelica", "Dlh", null], EMPTY, { tags: ["Lokalita"] });
    const karta = makeDef("k", EMPTY, [null, "Rana", "Rana", null]);
    const data = syntheticData([chata, karta]);
    const lok = instanceFor(data, "polovnicka_chata", [null, "Petelica", "Dlh", null], EMPTY);
    const k = instanceFor(data, "k", EMPTY, [null, "Rana", "Rana", null]);
    const ev = evaluateLine(data, { lokalita: lok, lokalitaOtocena: false, strany: [[own(k)], []] });
    expect(ev.sums[0]).toEqual({ Petelica: 2, Dlh: 1, Rana: 2 });
  });
});

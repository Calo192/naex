// Počítadlo bitky (Michal 2026-10-23): kroky po vlnách od lokality von musia skončiť
// presne na tuhom z vyhodnotenia (to isté číslo ako Účet bitky), aj keď klient
// nevidí súperove Absťáky v ruke.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { CardInstance, GameState, PlacedCard, PlayerId } from "../src/index.ts";
import { evaluateLine, lineState, loadGameData, pocitadloBitky, poskodenieBitky, setupGame, stavPocitadla } from "../src/index.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);
const hracske = [...data.cards.values()].filter((d) => d.tags.includes("Občan")).map((d) => d.id);

let uidSeq = 80000;
const inst = (defId: string): CardInstance => ({ uid: ++uidSeq, defId, leftLayout: 0, rightLayout: 0 });

/** Stôl s náhodnou líniou (deterministicky zo semienka). */
function stol(seed: number): GameState {
  const s = setupGame(data, seed);
  let x = seed * 7919 + 13;
  const rng = (n: number): number => (x = (x * 1103515245 + 12345) % 2147483648) % n;
  const strana = (): PlacedCard[] => Array.from({ length: 1 + rng(4) }, () => ({ card: inst(hracske[rng(hracske.length)]!), playedBy: rng(2) as PlayerId }));
  return { ...s, faza: "bitka", ciel: { typ: "lokalita", lokalita: s.lokalityVHre[0]! }, strany: [strana(), strana()] } as GameState;
}

describe("počítadlo bitky", () => {
  it("skončí na tuhom z vyhodnotenia; karty idú po vlnách od lokality von", () => {
    let sKartami = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const s = stol(seed);
      const linia = evaluateLine(data, lineState(s));
      const damage = poskodenieBitky(data, s, linia.sums);
      const p = pocitadloBitky(data, s, linia, damage.tuhe);
      expect(stavPocitadla(p, p.vln)).toEqual(damage.tuhe);
      // Bez skrytých Absťákov netreba dorovnávať — zrážky rešpektujú dno 0 samy.
      expect(p.kroky.some((k) => k.druh === "spolu")).toBe(false);
      for (const kto of [0, 1] as const) {
        let s = 0;
        for (const k of p.kroky.filter((k) => k.kto === kto)) {
          s += k.zmena;
          expect(s).toBeGreaterThanOrEqual(0);
        }
      }
      // Vlny idú po poradí; karta má vlnu = vzdialenosť od lokality.
      for (let i = 1; i < p.kroky.length; i++) expect(p.kroky[i]!.vlna).toBeGreaterThanOrEqual(p.kroky[i - 1]!.vlna);
      for (const k of p.kroky.filter((k) => k.druh === "karta")) {
        const i = s.strany.findIndex((st) => st.some((pl) => pl.card.uid === k.uid));
        const vlna = i === -1 ? 0 : s.strany[i]!.findIndex((pl) => pl.card.uid === k.uid) + 1;
        expect(k.vlna).toBe(vlna);
        sKartami++;
      }
      // Súčet kariet = tuhé z akcií (Rana ×1, Pecka ×2, Petelica ×3).
      for (const kto of [0, 1] as const) {
        const zAkcii = (linia.sums[kto].Rana ?? 0) + 2 * (linia.sums[kto].Pecka ?? 0) + 3 * (linia.sums[kto].Petelica ?? 0);
        expect(p.kroky.filter((k) => k.kto === kto && k.druh === "karta").reduce((a, k) => a + k.zmena, 0)).toBe(zAkcii);
      }
    }
    expect(sKartami).toBeGreaterThan(20);
  });

  it("Absťáky sú od v8.2 verejné (počítadlo) — počítadlo ich zrazí samo, krok „spolu“ netreba", () => {
    let zrazene = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const s0 = stol(seed);
      const s: GameState = { ...s0, hraci: [s0.hraci[0], { ...s0.hraci[1], abstaky: 1 }] };
      const linia = evaluateLine(data, lineState(s));
      // Len tam, kde Absťák hráča 1 naozaj uberie (jeho tuhé bez neho nie je 0).
      if (poskodenieBitky(data, s0, linia.sums).tuhe[1] === 0) continue;
      const server = poskodenieBitky(data, s, linia.sums);
      const p = pocitadloBitky(data, s, linia, server.tuhe);
      expect(stavPocitadla(p, p.vln)).toEqual(server.tuhe);
      expect(p.kroky.some((k) => k.druh === "spolu")).toBe(false);
      expect(p.kroky).toContainEqual(expect.objectContaining({ kto: 1, druh: "zrazka", zdroj: "abstak" }));
      zrazene++;
    }
    expect(zrazene).toBeGreaterThan(0);
  });
});

// Štatistiky kariet z partií — podklad pre rebalans v tvorcovi.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { Command, Event, GameState, StatistikyKariet } from "../src/index.ts";
import {
  apply,
  evaluateLine,
  legalCommands,
  loadGameData,
  naTahu,
  normalizujStatistikyKariet,
  prispevkyKariet,
  rngInt,
  rngSeed,
  scitajStatistikyKariet,
  setupGame,
  zapisTahKariet,
} from "../src/index.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

/** Náhodná partia; vracia štatistiky kariet a počty príkazov podľa typu. */
function partia(seed: number): { stat: StatistikyKariet; prikazy: Record<string, number>; bitky: Event[] } {
  let state: GameState = setupGame(data, seed);
  let rng = rngSeed(seed ^ 0xbeef);
  let stat: StatistikyKariet = {};
  const prikazy: Record<string, number> = {};
  const bitky: Event[] = [];
  for (let i = 0; i < 20000 && state.koniec === null; i++) {
    const p = naTahu(state);
    if (p === null) break;
    const cmds = legalCommands(data, state, p);
    const [idx, r] = rngInt(rng, cmds.length);
    rng = r;
    const cmd = cmds[idx] as Command;
    const kluc = cmd.type === "place" ? `place:${cmd.target}` : cmd.type;
    // Zo šenku sa berie 1 alebo 2 karty jedným príkazom (Michal 2026-10-19).
    prikazy[kluc] = (prikazy[kluc] ?? 0) + (cmd.type === "draftBer" ? cmd.uids.length : 1);
    const res = apply(data, state, cmd, p);
    stat = zapisTahKariet(stat, state, cmd, p, res.events);
    bitky.push(...res.events.filter((e) => e.type === "bitkaVysledok"));
    state = res.state;
  }
  return { stat, prikazy, bitky };
}

const sucet = (stat: StatistikyKariet, pole: keyof StatistikyKariet[string]): number =>
  Object.values(stat).reduce((s, k) => s + k[pole], 0);

describe("štatistiky kariet z partie", () => {
  it("počty sedia s príkazmi a bitkami", () => {
    const { stat, prikazy, bitky } = partia(11);
    expect(bitky.length).toBeGreaterThan(0);
    expect(sucet(stat, "zoSenku")).toBe(prikazy.draftBer ?? 0);
    expect(sucet(stat, "vylozene")).toBe(prikazy["place:vlastna"] ?? 0);
    expect(sucet(stat, "podstrcene")).toBe(prikazy["place:superova"] ?? 0);
    expect(sucet(stat, "naex")).toBe(prikazy.naex ?? 0);
    const kariet = bitky.reduce((s, e) => s + (e.type === "bitkaVysledok" ? e.karty.length : 0), 0);
    expect(sucet(stat, "bitky")).toBe(kariet);
    for (const s of Object.values(stat)) {
      expect(s.partie).toBe(1);
      expect(s.vyhrateBitky).toBeLessThanOrEqual(s.bitky);
    }
  });

  it("súčet viacerých partií a načítanie z archívu", () => {
    const a = partia(12).stat;
    const b = partia(13).stat;
    const spolu = scitajStatistikyKariet(a, b);
    expect(sucet(spolu, "bitky")).toBe(sucet(a, "bitky") + sucet(b, "bitky"));
    expect(Math.max(...Object.values(spolu).map((s) => s.partie))).toBeLessThanOrEqual(2);
    expect(normalizujStatistikyKariet(JSON.parse(JSON.stringify(spolu)))).toEqual(spolu);
    expect(normalizujStatistikyKariet({ pijan: { bitky: "x" } }).pijan?.bitky).toBe(0);
  });

  it("príspevok karty: tuhé poškodenie z aktívnych akcií", () => {
    const s0 = setupGame(data, 14);
    const pijan = { uid: 1, defId: "pijan", leftLayout: 0, rightLayout: 0 };
    const line = { lokalita: null, lokalitaOtocena: false, strany: [[{ card: pijan, playedBy: 0 as const }], []] as const };
    const k = prispevkyKariet(line, evaluateLine(data, line));
    expect(k).toHaveLength(1);
    expect(k[0]).toMatchObject({ uid: 1, defId: "pijan", majitel: 0, aktivne: 0, tuhe: 0 });
    expect(k[0]?.akcii).toBeGreaterThan(0);
    expect(s0.koniec).toBeNull();
  });
});

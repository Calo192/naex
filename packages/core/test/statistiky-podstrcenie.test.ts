// Podstrčenie (Michal 2026-11-08) = priložiť svoju kartu k súperovej, nech je to na
// ktoromkoľvek konci línie. Štatistika kartyPodstrcene (achievement Podstrkovač) ho ráta
// podľa tejto definície, nie podľa cieľa „superova“.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { Command, DvojicaStatistik, GameState, PlayerId } from "../src/index.ts";
import { apply, legalCommands, loadGameData, naTahu, noveStatistiky, opponentOf, rngInt, rngSeed, setupGame, zapisTah } from "../src/index.ts";
import achievementy from "../data/achievementy.json";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

interface Vysledok {
  readonly stat: DvojicaStatistik;
  /** Podstrčenia spočítané nezávisle: vnútorný sused priloženej karty je súperova karta. */
  readonly ocakavane: [number, number];
  /** Z nich priložené na koniec „vlastna“ — podľa starej definície by sa nerátali. */
  readonly naVlastnyKoniec: number;
  /** Na koniec „superova“ bez súperovej karty na konci — stará definícia by ich rátala. */
  readonly superovaBezPrilozenia: number;
}

function partia(seed: number): Vysledok {
  let state: GameState = setupGame(data, seed);
  let rng = rngSeed(seed ^ 0x51d);
  let stat = noveStatistiky();
  const ocakavane: [number, number] = [0, 0];
  let naVlastnyKoniec = 0;
  let superovaBezPrilozenia = 0;
  for (let i = 0; i < 20000 && state.koniec === null; i++) {
    const p = naTahu(state);
    if (p === null) break;
    const cmds = legalCommands(data, state, p);
    const [idx, r] = rngInt(rng, cmds.length);
    rng = r;
    const cmd = cmds[idx] as Command;
    if ((cmd.type === "place" || cmd.type === "zaverecna") && (cmd.target === "vlastna" || cmd.target === "superova")) {
      const k: PlayerId = cmd.target === "vlastna" ? p : opponentOf(p);
      const sused = state.strany[k].at(-1);
      if (sused !== undefined && sused.playedBy !== p) {
        ocakavane[p] += 1;
        if (cmd.target === "vlastna") naVlastnyKoniec += 1;
      } else if (cmd.target === "superova") superovaBezPrilozenia += 1;
    }
    const { state: po, events } = apply(data, state, cmd, p);
    stat = zapisTah(stat, state, cmd, p, po, events);
    state = po;
  }
  return { stat, ocakavane, naVlastnyKoniec, superovaBezPrilozenia };
}

describe("podstrčenie = priložiť svoju kartu k súperovej (Michal 2026-11-08)", () => {
  const partie = [3, 7, 12, 21].map(partia);

  it("kartyPodstrcene rátajú priloženia k súperovej karte na oboch koncoch línie", () => {
    for (const x of partie) {
      expect([x.stat[0].kartyPodstrcene, x.stat[1].kartyPodstrcene]).toEqual(x.ocakavane);
    }
    expect(partie.reduce((n, x) => n + x.ocakavane[0] + x.ocakavane[1], 0)).toBeGreaterThan(0);
  });

  it("líši sa od starého „na súperovu stranu“: ráta aj koniec vľavo, neráta koniec bez súperovej karty", () => {
    expect(partie.reduce((n, x) => n + x.naVlastnyKoniec, 0)).toBeGreaterThan(0);
    expect(partie.reduce((n, x) => n + x.superovaBezPrilozenia, 0)).toBeGreaterThan(0);
  });

  it("achievement Podstrkovač berie novú metriku", () => {
    const a = (achievementy as { achievementy: { id: string; metrika: string }[] }).achievementy.find((x) => x.id === "podstrkovac");
    expect(a?.metrika).toBe("stat.kartyPodstrcene");
  });
});

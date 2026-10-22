// Prehrávač partie (roadmapa #18, Michal 2026-10-22): stav po n-tom príkaze
// zo seedu a archivovaných príkazov. Hra je deterministická (CLAUDE.md, pravidlo
// 4), takže prehratie na tej istej verzii jadra a sady dá presne odohranú
// partiu. Čo z toho hráč smie vidieť, filtruje viewFor/eventsFor na serveri.

import type { Command, Event, GameState } from "./engine.ts";
import { apply, setupGame } from "./engine.ts";
import type { GameData } from "./data.ts";
import type { PlayerId } from "./types.ts";

export type PrikazPartie = readonly [PlayerId, Command];

export interface KrokPartie {
  readonly state: GameState;
  /** Udalosti posledného prehratého príkazu (pri kroku 0 prázdne). */
  readonly events: readonly Event[];
}

/** Stav partie po `krok` príkazoch (0 = rozdanie). Vyhodí chybu, keď príkaz na tomto jadre neprejde. */
export function prehrajPartiu(data: GameData, seed: number, lokalit: number, prikazy: readonly PrikazPartie[], krok: number): KrokPartie {
  let state = setupGame(data, seed, { lokalit });
  let events: readonly Event[] = [];
  const n = Math.max(0, Math.min(krok, prikazy.length));
  for (let i = 0; i < n; i++) {
    const [miesto, cmd] = prikazy[i] as PrikazPartie;
    const r = apply(data, state, cmd, miesto);
    state = r.state;
    events = r.events;
  }
  return { state, events };
}

// Pauza po súperovej voľbe cieľa (roadmapa #102, Michal 2026-10-25): „3 s, klik preskočí —
// vybraná lokalita sa na 3 sekundy zvýrazní s nápisom ‚Súper vybral: <Lokalita>‘.“ Server
// medzitým hrá ďalej; pauza je len v zobrazení, preto sa zisťuje z dvoch pohľadov za sebou.

import type { ClientState } from "@naex/core";

export const PAUZA_CIELA_MS = 3000;

export interface PauzaCiela {
  readonly kolo: number;
  /** Lokalita, ktorú súper vybral (stred línie). */
  readonly uid: number;
}

/**
 * Pauza patrí len prechodu z voľby cieľa ďalej v tom istom kole, keď cieľ vyberal súper.
 * Svoju voľbu hráč pozná; po pripojení do rozohranej partie (bez predošlého pohľadu) nie je čo ukázať.
 */
export function pauzaPoVolbeCiela(pred: ClientState | null, view: ClientState): PauzaCiela | null {
  if (pred === null || pred.faza !== "volbaCiela" || view.faza === "volbaCiela") return null;
  if (view.koniec !== null || view.kolo !== pred.kolo) return null;
  if (pred.naTahu === null || pred.naTahu === view.ja) return null;
  const lokalita = view.ciel?.lokalita ?? null;
  return lokalita === null ? null : { kolo: view.kolo, uid: lokalita.uid };
}

/** Klávesy, ktoré pauzu nepreskočia — samé modifikátory sú súčasť skratky, nie zámer pokračovať. */
export function klavesPreskociPauzu(key: string): boolean {
  return !["Shift", "Control", "Alt", "Meta", "AltGraph", "CapsLock"].includes(key);
}

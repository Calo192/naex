// Zastavenie po poslednej Pitke kola (Michal 2026-11-09: „okamžite idem na súmar Pitky a bitky…
// nevidel som, kam dal súper NA EX“): stôl ostane v stave po Pitke — NA EX oboch odkryté —, kým hráč
// nedá Ďalej (vyhodnotenie Pitky a bitky) alebo Preskočiť. Len prezentácia v klientovi; server ide ďalej.
// Bez Reactu, aby sa dalo otestovať.

import type { ClientState, Event } from "@naex/core";
import { pitkaPredBitkou } from "@naex/core";

/** Index rekapitulácie poslednej Pitky kola v dávke udalostí (po nej príde bitka), inak -1. */
export function poslednaPitkaVDavke(events: readonly Event[]): number {
  return events.findIndex((e, i) => e.type === "pitkaRekap" && pitkaPredBitkou(events, i));
}

/**
 * Stôl, na ktorom zastavenie stojí. Keď bitka prišla v tej istej dávke, server je už za ňou —
 * línia je tá z bitky (bitkaStol), inak pohľad zo servera. Hráč počas zastavenia neťahá (návrhy
 * a tlačidlá ťahu by svietili nad stolom, ktorý už neplatí) a skryté NA EX sú už v línii
 * (naexBy), takže zoznam skrytých by ich rátal druhýkrát.
 */
export function stolZastavenia(server: ClientState, bitkaStol: ClientState | null): ClientState {
  const s = bitkaStol ?? server;
  return {
    ...s,
    mozemHrat: false,
    pitkaStav: s.pitkaStav === null ? null : { ...s.pitkaStav, skryteNaex: [] },
  };
}

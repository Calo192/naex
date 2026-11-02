// Menej klikov (roadmapa #9 B, Michal 2026-10-22): čo klient smie za hráča
// navrhnúť alebo poslať sám. Len z ClientState — nič, čo hráč nevidí; server
// každý príkaz overí ako vždy, pravidlá sa nemenia.

import type { Command } from "./engine.ts";
import type { PlayerId } from "./types.ts";
import type { ClientState } from "./view.ts";

// Rozdelenie Nakladačky a hádky na jeden klik (v11) je navrhRozdelenia vo view.ts.

/**
 * „V tejto bitke už NA EX nedám“: v kole `kolo` klient za hráča ukončí jeho
 * časť každej ďalšej Pitky (nefajčí, nedolieva). Odpoveď na súperovo NA EX
 * ostáva na hráčovi a Krčma, ktorá NA EX vynúti, prepínač vypne.
 */
export function autoKoniecPitky(view: ClientState, kolo: number | null): Command | null {
  if (kolo === null || kolo !== view.kolo || view.koniec !== null || !view.mozemHrat || view.hasicVolba !== null) return null;
  const ps = view.pitkaStav;
  const ja: PlayerId = view.ja;
  if (view.faza !== "pitka" || ps === null || ps.reakcia !== null || ps.naTahu !== ja || ps.hotovy[ja]) return null;
  if (view.ciel?.lokalita?.defId === "krcma" && view.hraci[ja].poldeciPlne > 0) return null;
  return { type: "skipNaex" };
}

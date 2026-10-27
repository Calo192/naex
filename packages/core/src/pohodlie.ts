// Menej klikov (roadmapa #9 B, Michal 2026-10-22): čo klient smie za hráča
// navrhnúť alebo poslať sám. Len z ClientState — nič, čo hráč nevidí; server
// každý príkaz overí ako vždy, pravidlá sa nemenia.

import type { Command } from "./engine.ts";
import { partiaHraca } from "./effects.ts";
import type { PlayerId } from "./types.ts";
import type { GameData } from "./data.ts";
import type { ClientState } from "./view.ts";
import { hltavyPrebytok } from "./view.ts";

/**
 * Prebytok jedným klikom: celé rozdelenie prebytku ako jeden príkaz „tah“
 * (posuny tam, kde rozdielu bodov najviac pridajú — ten istý výpočet ako stávka
 * bitky). null, keď hráč prebytok práve nerozdeľuje.
 */
export function navrhPrebytku(data: GameData, view: ClientState): { readonly kroky: readonly string[]; readonly prikaz: Command } | null {
  const b = view.bitkaStav;
  const ja = view.ja;
  if (view.faza !== "bitka" || b === null || b.krok !== "prebytok" || b.caka !== ja || !view.mozemHrat) return null;
  // Od v7 stojí posun markera vždy 1 (Miňištrant ho už nezdražuje).
  const cena = 1;
  const { kroky } = hltavyPrebytok(data, view, ja, b.prebytokZostava, cena);
  if (kroky.length === 0) return null;
  return { kroky, prikaz: { type: "tah", kroky: kroky.map((elderId) => ({ type: "prebytok", elderId })) } };
}

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

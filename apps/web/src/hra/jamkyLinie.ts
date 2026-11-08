// Jamky na prázdnych indexoch (Michal 2026-11-08, docs/napady/spoje-indexy-mocky.html, mock A):
// prázdny index sa na karte inak nekreslí a hráč nevidí, kde spoj nevznikne. Jamky sú len
// tam, kde ešte môže vzniknúť — na ruke a na otvorenej hrane línie. Karta so susedmi
// z oboch strán ich nepotrebuje.

import type { PlayerId } from "@naex/core";

/** Vytlačené strany karty, na ktorých sa kreslia jamky. */
export interface JamkyKarty {
  readonly left: boolean;
  readonly right: boolean;
}

export const JAMKY_RUKY: JamkyKarty = { left: true, right: true };

/** Karta v línii, ako ju vidí divák: otočená = nohami hore (zahral ju ten druhý). */
export interface KartaNaKraji {
  readonly uid: number;
  readonly otocena: boolean;
}

export interface VstupJamiek {
  readonly ja: PlayerId;
  /** Karty strany od lokality von (index 0 pri lokalite). */
  readonly strany: readonly [readonly KartaNaKraji[], readonly KartaNaKraji[]];
  /** Navrhnuté karty strany v poradí vykladania — posledná leží najďalej. */
  readonly navrh: readonly [readonly KartaNaKraji[], readonly KartaNaKraji[]];
  /** Súperova karta lícom dole na konci strany — za ňu sa nepriloží, hrana je zavretá. */
  readonly zavreta: readonly [boolean, boolean];
  /** Lokalita (aj navrhnutá); bez nej nič neleží. */
  readonly stred: KartaNaKraji | null;
}

/**
 * Pre každý kraj línie nájde kartu na jeho konci a jej vonkajšiu hranu prepočíta
 * na vytlačenú stranu: moja strana je z môjho pohľadu vľavo, súperova vpravo.
 */
export function jamkyLinie(v: VstupJamiek): ReadonlyMap<number, JamkyKarty> {
  const out = new Map<number, JamkyKarty>();
  const pridaj = (k: KartaNaKraji, vonkajsia: "left" | "right"): void => {
    const vytlacena = k.otocena ? (vonkajsia === "left" ? "right" : "left") : vonkajsia;
    const doteraz = out.get(k.uid) ?? { left: false, right: false };
    out.set(k.uid, { ...doteraz, [vytlacena]: true });
  };
  for (const p of [0, 1] as const) {
    const vonkajsia = p === v.ja ? "left" : "right";
    const navrh = v.navrh[p];
    const strana = v.strany[p];
    const krajna = navrh[navrh.length - 1] ?? (v.zavreta[p] ? null : (strana[strana.length - 1] ?? v.stred));
    if (krajna !== null && krajna !== undefined) pridaj(krajna, vonkajsia);
  }
  return out;
}

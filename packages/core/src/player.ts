// Stav hráča a odvodené hodnoty (M3).

import type { CardInstance } from "./types.ts";
import { KONSTANTY } from "./constants.ts";

export interface PlayerState {
  readonly ruka: readonly CardInstance[];
  readonly doberaci: readonly CardInstance[];
  readonly odhadzovaci: readonly CardInstance[];
  /** Priznané kliatby — mimo partie, mimo balíčka. */
  readonly priznane: readonly CardInstance[];
  /** Nástroje vyložené ako Dedičstvo. */
  readonly dedicstvo: readonly CardInstance[];
  readonly poldeciPlne: number;
  readonly poldeciVypite: number;
  /** Cigarety (mena aj body). */
  readonly cigarety: number;
  /**
   * Poškodenie pečene v tejto Pitke (pri prahu vzniká Cirhóza a počítadlo
   * klesne). Po každej Pitke sa vynuluje; pitie do dna v Zhromaždení sem
   * pripíše pečeň dopredu a vyhodnotí sa v najbližšej Pitke.
   */
  readonly pecen: number;
  /** Zadĺženie z akcií Dlh v tejto Pitke (pri prahu vzniká Dlh); po Pitke sa vynuluje. */
  readonly zadlzenie: number;
  /** Spotrebované neresti v predošlom kole — porovnanie dáva Absťák. */
  readonly nerestiMinuleKolo: number;
  readonly nerestiTotoKolo: number;
  /**
   * Absťáky získané za celú hru (v5, podmienka Absťák — Michal 2026-10-25):
   * zbavením sa Absťáku neklesne. Chýba v stavoch spred v5 (= 0).
   */
  readonly abstakyZiskane?: number;
}

/** „1 nerest“, „3 neresti“, „5 nerestí“ — pre log a rozhranie. */
export function textNeresti(n: number): string {
  return n === 1 ? "1 nerest" : n >= 2 && n <= 4 ? `${n} neresti` : `${n} nerestí`;
}

export function freshPlayer(): PlayerState {
  return {
    ruka: [],
    doberaci: [],
    odhadzovaci: [],
    priznane: [],
    dedicstvo: [],
    poldeciPlne: KONSTANTY.START_POLDECI,
    poldeciVypite: 0,
    cigarety: KONSTANTY.START_CIGARETY,
    pecen: 0,
    zadlzenie: 0,
    nerestiMinuleKolo: 0,
    nerestiTotoKolo: 0,
    abstakyZiskane: 0,
  };
}

/**
 * Veľkosť balíčka = doberací + odhadzovací + ruka. Priznané karty ani
 * Dedičstvo sa nerátajú (PRAVIDLA §1).
 */
export function velkostBalicka(player: PlayerState): number {
  return player.doberaci.length + player.odhadzovaci.length + player.ruka.length;
}

/**
 * Limit vykladania = plné poldeci + 1. Vypité poldeci, poldeci ležiace na
 * kartách cez NA EX (pravidlá v4, Michal 2026-10-23 — oslabenie NA EX)
 * a priznané karty limit neovplyvňujú (PRAVIDLA §6).
 */
export function limitVykladania(player: Pick<PlayerState, "poldeciPlne">): number {
  return player.poldeciPlne + 1;
}

// Priazne v5 (Michal 2026-10-24/25): Alkoholik, Kmotor (Úžerník), Abstinent
// (Lakomec) a Neprajník už prahy, barter ani mäkké poškodenie nemenia.

export function prahCirhozy(): number {
  return KONSTANTY.PRAH_CIRHOZY_ZAKLAD;
}

export function prahDlhu(): number {
  return KONSTANTY.PRAH_DLHU_ZAKLAD;
}

/**
 * Prah Exekúcie hráča (§11). Priazeň Exekútora v5 (Michal 2026-10-25): SÚPEROV
 * prah je nižší o silu priazne (1 / 2 / 3) — `zlava` = sila súperovho Exekútora.
 */
export function prahExekutora(zlava = 0): number {
  return KONSTANTY.PRAH_EXEKUTORA_ZAKLAD - zlava;
}

/** Hodnota jednej Viery; Veriaci od 2026-10-20 dáva Vieru navyše, nie vyššiu hodnotu. */
export function hodnotaViery(): number {
  return KONSTANTY.HODNOTA_VIERY_ZAKLAD;
}

/** Stokársky barter (§7): pevná cena, Lakomec ju vo v5 už nezlacňuje. */
export function cenaBarteru(): number {
  return KONSTANTY.BARTER_CENA;
}

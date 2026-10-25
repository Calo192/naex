// Stav hráča a odvodené hodnoty (M3).

import type { CardInstance, PlayerId } from "./types.ts";
import type { PlacedCard } from "./partia.ts";
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

export function prahCirhozy(priazenAlkoholika: number): number {
  return KONSTANTY.PRAH_CIRHOZY_ZAKLAD + priazenAlkoholika;
}

/** Prah Dlhu = 2 + sila Úžerníka (priazeň je 2 × sila, Úžerník pridáva len silu). */
export function prahDlhu(priazenUzernika: number): number {
  return KONSTANTY.PRAH_DLHU_ZAKLAD + priazenUzernika / KONSTANTY.NASOBOK_PRIAZNE;
}

export function prahExekutora(priazenExekutora: number): number {
  return KONSTANTY.PRAH_EXEKUTORA_ZAKLAD + 2 * priazenExekutora;
}

/** Hodnota jednej Viery; Veriaci od 2026-10-20 dáva Vieru navyše, nie vyššiu hodnotu. */
export function hodnotaViery(): number {
  return KONSTANTY.HODNOTA_VIERY_ZAKLAD;
}

/**
 * Stokársky barter (Michal 2026-10-18, priazeň Lakomca): stojí o silu priazne
 * menej — 5 / 4 / 3 / 2 cigarety. Priazeň je 2 × sila, preto polovica.
 */
export function cenaBarteru(priazenLakomca: number): number {
  return Math.max(1, KONSTANTY.BARTER_CENA - priazenLakomca / KONSTANTY.NASOBOK_PRIAZNE);
}

/**
 * Mäkké poškodenie Povier smie prekročiť súperove priznané Dlhy o priazeň
 * Neprajníka (2 / 4 / 6) — Michal 2026-10-18 namiesto kľúčového slova Zopár.
 */
export function makkeNadDlhy(priazenNeprajnika: number): number {
  return priazenNeprajnika;
}

// Stav hráča a odvodené hodnoty (M3).

import type { CardInstance, Clen, Format } from "./types.ts";
import { KONSTANTY } from "./constants.ts";

/**
 * Stav hráča v 1 na 1, stav tímu v 2 na 2 (Michal 2026-10-28: tím je hráč z 1 na 1
 * s dvoma rukami) — zdroje, balíčky, kliatby aj partia sú tímu.
 */
export interface PlayerState {
  /** Ruka hráča; v 2 na 2 ruka prvého člena tímu. */
  readonly ruka: readonly CardInstance[];
  /** Ruka druhého člena tímu (2 na 2). V 1 na 1 chýba. */
  readonly rukaDruheho?: readonly CardInstance[];
  readonly doberaci: readonly CardInstance[];
  readonly odhadzovaci: readonly CardInstance[];
  /** Priznané kliatby (Cirhóza, Milujúca manželka) — mimo partie, mimo balíčka. */
  readonly priznane: readonly CardInstance[];
  /**
   * Priznané Dlhy — od v8.2 počítadlo, nie karty (Michal 2026-10-30): Dlh je
   * hneď priznaný, netreba ho ťahať ani s ním inak manipulovať. Verejné.
   */
  readonly dlhy: number;
  /**
   * Chuť (v9.1, Michal 2026-10-30): latka nerestí — kto v kole vypije a vyfajčí menej,
   * dostane kartu Absťák. Verejná, na začiatku 0. Absťáky sú karty v balíčku (pocetAbstakov).
   */
  readonly chut: number;
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
  /** Zadĺženie z akcií Hazard (kľúč Dlh): pri prahu vzniká Dlh, zvyšok ostáva (v7). */
  readonly zadlzenie: number;
  /** Neresti v tomto kole — na konci kola ich porovnanie s Chuťou dáva Absťák (v9.1). */
  readonly nerestiTotoKolo: number;
  /**
   * Absťáky získané za celú hru (v5, podmienka Absťák — Michal 2026-10-25):
   * zahodením karty neklesne. Chýba v stavoch spred v5 (= 0).
   */
  readonly abstakyZiskane?: number;
  /** Dlhy získané za celú hru (štatistika, v8.2) — presun ani pálenie ich neubera. */
  readonly dlhyZiskane?: number;
}

/** „1 nerest“, „3 neresti“, „5 nerestí“ — pre log a rozhranie. */
export function textNeresti(n: number): string {
  return n === 1 ? "1 nerest" : n >= 2 && n <= 4 ? `${n} neresti` : `${n} nerestí`;
}

export function freshPlayer(format: Format = "1na1"): PlayerState {
  const dva = format === "2na2";
  return {
    ruka: [],
    ...(dva ? { rukaDruheho: [] } : {}),
    doberaci: [],
    odhadzovaci: [],
    priznane: [],
    dlhy: 0,
    chut: 0,
    dedicstvo: [],
    poldeciPlne: dva ? KONSTANTY.DVA_NA_DVA.START_POLDECI : KONSTANTY.START_POLDECI,
    poldeciVypite: 0,
    cigarety: dva ? KONSTANTY.DVA_NA_DVA.START_CIGARETY : KONSTANTY.START_CIGARETY,
    pecen: 0,
    zadlzenie: 0,
    nerestiTotoKolo: 0,
    abstakyZiskane: 0,
  };
}

/** Ruka člena tímu (v 1 na 1 je člen 0 hráč sám). */
export function rukaClena(player: Pick<PlayerState, "ruka" | "rukaDruheho">, clen: Clen): readonly CardInstance[] {
  return clen === 0 ? player.ruka : (player.rukaDruheho ?? []);
}

/** Karty vo všetkých rukách hráča — v 2 na 2 oboch členov tímu. */
export function kartyVRukach(player: Pick<PlayerState, "ruka" | "rukaDruheho">): readonly CardInstance[] {
  return player.rukaDruheho === undefined ? player.ruka : [...player.ruka, ...player.rukaDruheho];
}

/**
 * Karty Absťák v balíčku hráča — ruka, doberací aj odhadzovací (v9.1). Každá mu v bitke
 * uberie 1 tuhé. Poloha je skrytá, počet verejný (viewFor).
 */
export function pocetAbstakov(player: Pick<PlayerState, "ruka" | "rukaDruheho" | "doberaci" | "odhadzovaci">): number {
  let n = 0;
  for (const k of [...kartyVRukach(player), ...player.doberaci, ...player.odhadzovaci]) if (k.defId === "abstak") n++;
  return n;
}

/**
 * Limit vykladania = plné poldeci (v12.2, Michal 2026-11-11: „Limit vykladania bude rovný
 * presne počtu poldeci“; do v12.1 plné + 1). Vypité poldeci a poldeci ležiace na kartách
 * cez NA EX sa nerátajú (PRAVIDLA §6).
 */
export function limitVykladania(player: Pick<PlayerState, "poldeciPlne">): number {
  return player.poldeciPlne;
}

/**
 * Maximum poldeci — na toľko plných sa obnovia po bitke (v12.2): štart, barter, Krčmárka a Vínko.
 * Poldeci nikdy nezmiznú (vypité ostávajú, NA EX sa v bitke vypije), preto stačí ich spočítať.
 */
export function maximumPoldeci(player: Pick<PlayerState, "poldeciPlne" | "poldeciVypite">, naStole = 0): number {
  return player.poldeciPlne + player.poldeciVypite + naStole;
}

// Priazne v5 (Michal 2026-10-24/25): Kmotor (Úžerník) a Abstinent (Lakomec)
// už prahy ani barter nemenia.

export function prahCirhozy(): number {
  return KONSTANTY.PRAH_CIRHOZY_ZAKLAD;
}

export function prahDlhu(): number {
  return KONSTANTY.PRAH_DLHU_ZAKLAD;
}

/** Hodnota jednej Viery; Veriaci od 2026-10-20 dáva Vieru navyše, nie vyššiu hodnotu. */
export function hodnotaViery(): number {
  return KONSTANTY.HODNOTA_VIERY_ZAKLAD;
}

/** Stokársky barter (§7): pevná cena, Lakomec ju vo v5 už nezlacňuje. */
export function cenaBarteru(): number {
  return KONSTANTY.BARTER_CENA;
}

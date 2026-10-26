// Vyhodnotenie bitky — presné poradie z PRAVIDLA.md §9 (M4).
//
// Tu sú len ČISTÉ funkcie (Exekútor / poškodenie / výsledok). Kroky, ktoré
// vyžadujú rozhodnutie hráča (Pohoršenie, rozdelenie prebytku,
// Pohreb), motor v M6 len pripraví ako čakajúce rozhodnutia.

import type { ActionSums } from "./partia.ts";
import type { PlayerId } from "./types.ts";
import { prahExekutora } from "./player.ts";
import { KONSTANTY } from "./constants.ts";

/** Vstup jedného hráča do výpočtu poškodenia. */
export interface BattleSide {
  /** Súčty aktívnych akcií hráča z evaluateLine. */
  readonly sums: ActionSums;
  /**
   * Cirhózy ležiace v SÚPEROVEJ partii — ich efekt „Obdržíš od súpera
   * dodatočnú ranu“ pridáva +1 tuhé tomuto hráčovi (rozhodnutie k otvorenej
   * otázke č. 5).
   */
  readonly cirhozaBonus: number;
  /** Dodatočné tuhé poškodenie z efektov kariet (recidivista, pes, …). */
  readonly tuheBonus: number;
  /** Počet mojich Absťákov — znižujú MOJE tuhé poškodenie (PRAVIDLA §8). */
  readonly abstaky: number;
  /** Tuhé menej z efektov súpera (Pasca: −1 za každé moje Zviera v línii). Chýba = 0. */
  readonly tuheZlava?: number;
  /** Moje priznané Dlhy — strop pre súperove mäkké poškodenie. */
  readonly priznaneDlhy: number;
  /**
   * O koľko smú MOJE Povery prekročiť súperove priznané Dlhy (priazeň
   * Neprajníka; Čierna mačka = bez stropu). Chýba = 0.
   */
  readonly makkeNadDlhy?: number;
  /** Priazeň Bitkára, ak ju mám (inak 0) — tuhé poškodenie navyše. */
  readonly priazenBitkara: number;
  /** Hodnota jednej MOJEJ Viery = 1 + Svätý text (priazeň Veriaceho pridáva Vieru navyše, nie hodnotu). */
  readonly hodnotaViery: number;
}

export interface DamageResult {
  readonly tuhe: readonly [number, number];
  readonly makke: readonly [number, number];
  readonly celkove: readonly [number, number];
  readonly zvysnaViera: readonly [number, number];
  readonly zvysnaPovera: readonly [number, number];
}

function n(v: number | undefined): number {
  return v ?? 0;
}

export function computeDamage(sides: readonly [BattleSide, BattleSide]): DamageResult {
  // 1. Viera a Povera sa vyrušia 1:1 — moja Viera ruší súperove Povery,
  //    moje Povery rušia súperovu Vieru. Zrušená Povera neudelí nič.
  const viera = [n(sides[0].sums.Viera), n(sides[1].sums.Viera)] as const;
  const povera = [n(sides[0].sums.Povera), n(sides[1].sums.Povera)] as const;
  const cancel0 = Math.min(povera[0], viera[1]);
  const cancel1 = Math.min(povera[1], viera[0]);
  const zvysnaViera = [viera[0] - cancel1, viera[1] - cancel0] as const;
  const zvysnaPovera = [povera[0] - cancel0, povera[1] - cancel1] as const;

  const tuhe = ([0, 1] as const).map((p) => {
    const me = sides[p];
    const opp = sides[p === 0 ? 1 : 0];
    const oppViera = zvysnaViera[p === 0 ? 1 : 0];
    const base =
      n(me.sums.Rana) * 1 +
      n(me.sums.Pecka) * 2 +
      n(me.sums.Petelica) * 3 +
      me.cirhozaBonus +
      me.tuheBonus +
      me.priazenBitkara;
    return Math.max(0, base - oppViera * opp.hodnotaViery - me.abstaky - (me.tuheZlava ?? 0));
  }) as [number, number];

  // 3. Mäkké poškodenie je zastropené súperovým PRIZNANÝM dlhom (+ priazeň
  //    Neprajníka, Čierna mačka strop ruší).
  const makke = ([0, 1] as const).map((p) => {
    const q = p === 0 ? 1 : 0;
    const strop = sides[q].priznaneDlhy + (sides[p].makkeNadDlhy ?? 0);
    return Math.max(0, Math.min(zvysnaPovera[p], strop));
  }) as [number, number];

  const celkove = [tuhe[0] + makke[0], tuhe[1] + makke[1]] as [number, number];
  return {
    tuhe,
    makke,
    celkove,
    zvysnaViera: [...zvysnaViera] as [number, number],
    zvysnaPovera: [...zvysnaPovera] as [number, number],
  };
}

/** Čím sa rozhodla bitka (v6): tuhé, pri remíze menej Absťákov, potom menej priznaných Dlhov, inak sekera. */
export type RozhodnutieBitky = "tuhe" | "abstak" | "dlhy" | "sekera";

export interface BattleOutcome {
  /**
   * Víťaz bitky: vyššie TUHÉ poškodenie. Pri remíze v tuhom (v6, Michal
   * 2026-10-26) vyhrá, kto má menej Absťákov, potom kto má menej priznaných
   * Dlhov; inak nikto — špaky kola idú na sekeru. Bez údajov o remíze
   * (náhľady) je remíza v tuhom vždy sekera.
   */
  readonly vitaz: PlayerId | null;
  readonly rozhodlo: RozhodnutieBitky;
  /** Vyššie CELKOVÉ poškodenie — aj pri remíze v tuhom; pri rovnosti nikto. */
  readonly prebytokDrzi: PlayerId | null;
  readonly prebytok: number;
}

/** Čo rozhoduje remízu v tuhom: Absťáky, ktoré hráči práve majú, a ich priznané Dlhy. */
export interface RemizaBitky {
  readonly abstaky: readonly [number, number];
  readonly dlhy: readonly [number, number];
}

/** Hráč s menším číslom, pri rovnosti null. */
function menej(x: readonly [number, number]): PlayerId | null {
  return x[0] === x[1] ? null : x[0] < x[1] ? 0 : 1;
}

export function battleOutcome(damage: DamageResult, remiza?: RemizaBitky): BattleOutcome {
  const prebytokDrzi: PlayerId | null =
    damage.celkove[0] === damage.celkove[1] ? null : damage.celkove[0] > damage.celkove[1] ? 0 : 1;
  const prebytok = Math.abs(damage.celkove[0] - damage.celkove[1]);
  if (damage.tuhe[0] !== damage.tuhe[1]) return { vitaz: damage.tuhe[0] > damage.tuhe[1] ? 0 : 1, rozhodlo: "tuhe", prebytokDrzi, prebytok };
  const zAbstakov = remiza === undefined ? null : menej(remiza.abstaky);
  if (zAbstakov !== null) return { vitaz: zAbstakov, rozhodlo: "abstak", prebytokDrzi, prebytok };
  const zDlhov = remiza === undefined ? null : menej(remiza.dlhy);
  if (zDlhov !== null) return { vitaz: zDlhov, rozhodlo: "dlhy", prebytokDrzi, prebytok };
  return { vitaz: null, rozhodlo: "sekera", prebytokDrzi, prebytok };
}

/**
 * Exekútor (§11, v6): kto má aspoň prah priznaných Dlhov, čelí exekúcii.
 * zlavaPrahu = sila súperovej priazne Exekútora (v5).
 */
export function exekutorCheck(priznaneDlhy: number, zlavaPrahu = 0): boolean {
  return priznaneDlhy >= prahExekutora(zlavaPrahu);
}

/**
 * Exekúcia v6 (Michal 2026-10-26): zhorí polovica priznaných Dlhov (nadol)
 * a rovnaký počet špakov. Nástroj sa neodovzdáva a prehra exekúciou sa ruší.
 */
export function zhoriPriExekucii(priznaneDlhy: number): number {
  return Math.floor(priznaneDlhy / 2);
}

/**
 * Špaky víťaza za bitku (v6): odohrané Pitky mínus o koľko má víťaz viac
 * Absťákov než porazený, vždy aspoň 1.
 */
export function spakyZaBitku(pitky: number, abstakyVitaza: number, abstakyPorazeneho: number): number {
  return Math.max(KONSTANTY.SPAKY_ZA_BITKU_MIN, pitky - Math.max(0, abstakyVitaza - abstakyPorazeneho));
}

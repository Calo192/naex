// Vyhodnotenie bitky — presné poradie z PRAVIDLA.md §9 (M4).
//
// Tu sú len ČISTÉ funkcie (Exekútor / poškodenie / výsledok). Kroky, ktoré
// vyžadujú rozhodnutie hráča (Pohoršenie, rozdelenie prebytku,
// Pohreb), motor v M6 len pripraví ako čakajúce rozhodnutia.

import type { ActionSums } from "./partia.ts";
import type { PlayerId } from "./types.ts";
import { prahExekutora } from "./player.ts";

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

export interface BattleOutcome {
  /**
   * Vyššie TUHÉ poškodenie. Remíza (Michal 2026-10-21, rozbor
   * strategia-remiza-20261021): pri rovnakom tuhom nevyhrá nikto — lokalita
   * ide „na sekeru“ a berie ju víťaz najbližšej bitky. Rola (obranca) ani
   * celkové poškodenie remízu nerozhodujú.
   */
  readonly vitaz: PlayerId | null;
  /** Vyššie CELKOVÉ poškodenie — aj pri remíze v tuhom; pri rovnosti nikto. */
  readonly prebytokDrzi: PlayerId | null;
  readonly prebytok: number;
}

export function battleOutcome(damage: DamageResult): BattleOutcome {
  const prebytokDrzi: PlayerId | null =
    damage.celkove[0] === damage.celkove[1] ? null : damage.celkove[0] > damage.celkove[1] ? 0 : 1;
  const vitaz: PlayerId | null = damage.tuhe[0] === damage.tuhe[1] ? null : damage.tuhe[0] > damage.tuhe[1] ? 0 : 1;
  return { vitaz, prebytokDrzi, prebytok: Math.abs(damage.celkove[0] - damage.celkove[1]) };
}

/** Krok Exekútora pre jedného hráča (PRAVIDLA §11). */
export type ExekutorVysledok = "mimoOhrozenia" | "musiOdovzdatNastroj";

/** zlavaPrahu = sila súperovej priazne Exekútora (v5). */
export function exekutorCheck(priznaneDlhy: number, zlavaPrahu = 0): ExekutorVysledok {
  return priznaneDlhy >= prahExekutora(zlavaPrahu)
    ? "musiOdovzdatNastroj"
    : "mimoOhrozenia";
}

/** Po odovzdaní Nástroja zhorí polovica priznaných dlhov (zaokrúhlené nadol). */
export function dlhyPoExekucii(priznaneDlhy: number): number {
  return priznaneDlhy - Math.floor(priznaneDlhy / 2);
}

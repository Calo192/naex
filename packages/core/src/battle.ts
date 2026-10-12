// Vyhodnotenie bitky — presné poradie z PRAVIDLA.md §8 (M4).
//
// Tu sú len ČISTÉ funkcie (Exekútor / poškodenie / výsledok). Kroky, ktoré
// vyžadujú rozhodnutie hráča (Pohoršenie, rozdelenie prebytku, Liečba či
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
  /** Počet mojich Absťákov — znižujú MOJE tuhé poškodenie (PRAVIDLA §12). */
  readonly abstaky: number;
  /** Moje priznané Dlhy — strop pre súperove mäkké poškodenie. */
  readonly priznaneDlhy: number;
  /** Priazeň Bitkára, ak ju mám (inak 0) — tuhé poškodenie navyše. */
  readonly priazenBitkara: number;
  /** Hodnota MOJEJ Viery = 1 + priazeň Veriaceho, ak ju mám. */
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

export interface DamageOptions {
  /**
   * poveraVieraSaNerusia[p]: Povery hráča p a Viera súpera sa navzájom
   * nerušia (efekt Novín v Dedičstve hráča p).
   */
  readonly poveraVieraSaNerusia?: readonly [boolean, boolean];
  /**
   * vieraProtiMakkemu[p]: zvyšná Viera hráča p nechráni pred súperovým
   * tuhým, ale ruší jeho mäkké poškodenie 1:1 (Svätý text v Dedičstve p).
   */
  readonly vieraProtiMakkemu?: readonly [boolean, boolean];
}

export function computeDamage(
  sides: readonly [BattleSide, BattleSide],
  opts?: DamageOptions,
): DamageResult {
  // 1. Viera a Povera sa vyrušia 1:1 — moja Viera ruší súperove Povery,
  //    moje Povery rušia súperovu Vieru. Zrušená Povera neudelí nič.
  const nerusia = opts?.poveraVieraSaNerusia ?? [false, false];
  const viera = [n(sides[0].sums.Viera), n(sides[1].sums.Viera)] as const;
  const povera = [n(sides[0].sums.Povera), n(sides[1].sums.Povera)] as const;
  // Vyrušenie páru (povera hráča p, viera súpera) sa dá vypnúť Novinami.
  const cancel0 = nerusia[0] ? 0 : Math.min(povera[0], viera[1]);
  const cancel1 = nerusia[1] ? 0 : Math.min(povera[1], viera[0]);
  const zvysnaViera = [viera[0] - cancel1, viera[1] - cancel0] as const;
  const zvysnaPovera = [povera[0] - cancel0, povera[1] - cancel1] as const;

  const protiMakkemu = opts?.vieraProtiMakkemu ?? [false, false];
  const tuhe = ([0, 1] as const).map((p) => {
    const me = sides[p];
    const opp = sides[p === 0 ? 1 : 0];
    const oppViera = protiMakkemu[p === 0 ? 1 : 0] ? 0 : zvysnaViera[p === 0 ? 1 : 0];
    const base =
      n(me.sums.Rana) * 1 +
      n(me.sums.Pecka) * 2 +
      n(me.sums.Petelica) * 3 +
      me.cirhozaBonus +
      me.tuheBonus +
      me.priazenBitkara;
    return Math.max(0, base - oppViera * opp.hodnotaViery - me.abstaky);
  }) as [number, number];

  // 3. Mäkké poškodenie je zastropené súperovým PRIZNANÝM dlhom.
  const makke = ([0, 1] as const).map((p) => {
    const q = p === 0 ? 1 : 0;
    const oppDlhy = sides[q].priznaneDlhy;
    const ochrana = protiMakkemu[q] ? zvysnaViera[q] : 0;
    return Math.max(0, Math.min(zvysnaPovera[p], oppDlhy) - ochrana);
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
  /** Vyššie TUHÉ poškodenie; pri remíze víťazí útočník. */
  readonly vitaz: PlayerId;
  /** Vyššie CELKOVÉ poškodenie; pri remíze prebytok nikto nezíska. */
  readonly prebytokDrzi: PlayerId | null;
  readonly prebytok: number;
}

export function battleOutcome(damage: DamageResult, utocnik: PlayerId): BattleOutcome {
  const vitaz: PlayerId =
    damage.tuhe[0] === damage.tuhe[1] ? utocnik : damage.tuhe[0] > damage.tuhe[1] ? 0 : 1;
  const prebytok = Math.abs(damage.celkove[0] - damage.celkove[1]);
  const prebytokDrzi: PlayerId | null =
    damage.celkove[0] === damage.celkove[1] ? null : damage.celkove[0] > damage.celkove[1] ? 0 : 1;
  return { vitaz, prebytokDrzi, prebytok };
}

/** Krok Exekútora pre jedného hráča (PRAVIDLA §8.1). */
export type ExekutorVysledok = "mimoOhrozenia" | "musiOdovzdatNastroj";

export function exekutorCheck(priznaneDlhy: number, priazenExekutora: number): ExekutorVysledok {
  return priznaneDlhy >= prahExekutora(priazenExekutora)
    ? "musiOdovzdatNastroj"
    : "mimoOhrozenia";
}

/** Po odovzdaní Nástroja zhorí polovica priznaných dlhov (zaokrúhlené nadol). */
export function dlhyPoExekucii(priznaneDlhy: number): number {
  return priznaneDlhy - Math.floor(priznaneDlhy / 2);
}

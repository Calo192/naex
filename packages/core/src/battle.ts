// Vyhodnotenie bitky — presné poradie z PRAVIDLA.md §9 (M4).
//
// Tu sú len ČISTÉ funkcie (Exekútor / hádka a poškodenie / výsledok). Kroky, ktoré
// vyžadujú rozhodnutie hráča (rozdelenie hádky a Nakladačky, Veštica, Cintorín),
// motor len pripraví ako čakajúce rozhodnutia.

import type { ActionSums } from "./partia.ts";
import type { PlayerId } from "./types.ts";
import { opponentOf } from "./types.ts";
import { KONSTANTY } from "./constants.ts";

/** Vstup jedného hráča do výpočtu poškodenia. */
export interface BattleSide {
  /** Súčty aktívnych akcií hráča z evaluateLine (Viera bez Veriaceho). */
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
  /** Moje Povery sa súperovou Vierou nerušia (Čierna mačka). Chýba = false. */
  readonly poveryBezViery?: boolean;
  /** Priazeň Bitkára, ak ju mám (inak 0) — tuhé poškodenie navyše, účinnou silou po hádke. */
  readonly priazenBitkara: number;
  /** Hodnota jednej MOJEJ Viery v tlmení tuhého = 1 + Svätý text; Povery ruší 1 : 1 bez ohľadu na hodnotu. */
  readonly hodnotaViery: number;
  /** Viera navyše z priazne Veriaceho so silou PRED hádkou — ruší Povery (v10). Chýba = 0. */
  readonly vieraVeriacehoPred?: number;
  /** Viera navyše z priazne Veriaceho so silou PO hádke — rozdiel oproti „pred“ tlmí tuhé (v10). Chýba = vieraVeriacehoPred. */
  readonly vieraVeriaceho?: number;
  /** Povery navyše z priazne Ohováračky — rátajú sa ako Povery z akcií kariet (v11.10). Chýba = 0. */
  readonly poveryOhovaracky?: number;
  /** Koľko mäkkého dá jedna moja zvyšná Povera: 1, s Horoskopom 2 (v10). Chýba = 1. */
  readonly silaPovery?: number;
  /** Sila priazne Abstinenta po hádke — v bitke sa mi toľko Absťákov neráta (v10). Chýba = 0. */
  readonly silaAbstinenta?: number;
}

export interface DamageResult {
  readonly tuhe: readonly [number, number];
  /**
   * Mäkké poškodenie (v10 Hádka): Pohoršenie × 2 + zvyšné Povery × sila Povery.
   * Vyššie mäkké vyhrá hádku; v8.3–v9 vždy 0 (archív).
   */
  readonly makke: readonly [number, number];
  /** Od v8.3 rovné tuhému — mäkké do víťaza bitky nevstupuje; pole ostáva pre archív. */
  readonly celkove: readonly [number, number];
  readonly zvysnaViera: readonly [number, number];
  readonly zvysnaPovera: readonly [number, number];
  /** Moje Povery, ktoré zrušila súperova Viera (v10). Chýba v archíve. */
  readonly zrusenePovery?: readonly [number, number];
  /** Moja Viera minutá na rušenie súperových Povier (v10). Chýba v archíve. */
  readonly vieraNaPovery?: readonly [number, number];
  /** Sila Abstinenta — o toľko menej Absťákov sa ráta v poškodení aj pri remíze (v10). Chýba = 0. */
  readonly abstinent?: readonly [number, number];
}

function n(v: number | undefined): number {
  return v ?? 0;
}

/** Hádka z mäkkého (v10): víťaz = vyššie mäkké, veľkosť = rozdiel; remíza = nikto. */
export interface VysledokHadky {
  readonly vitaz: PlayerId | null;
  readonly velkost: number;
}

export function vysledokHadky(makke: readonly [number, number]): VysledokHadky {
  if (makke[0] === makke[1]) return { vitaz: null, velkost: 0 };
  return { vitaz: makke[0] > makke[1] ? 0 : 1, velkost: Math.abs(makke[0] - makke[1]) };
}

/** Absťáky, ktoré sa v bitke rátajú: Abstinent ich toľko odpustí, najmenej 0 (v10). */
export function abstakyVBitke(abstaky: number, silaAbstinenta = 0): number {
  return Math.max(0, abstaky - silaAbstinenta);
}
export function computeDamage(sides: readonly [BattleSide, BattleSide]): DamageResult {
  // 1. Hádka (v10, docs/napady/hadka.html): Viera a Povery sa vyrušia 1 : 1 na kusy — jedna
  //    akcia Viera zruší jednu akciu Povera, aj vylepšenú Horoskopom; Svätý text rušenie
  //    nemení (Michal 2026-11-01). Čierna mačka: jej Povery sa nerušia.
  const viera = ([0, 1] as const).map((p) => n(sides[p].sums.Viera) + n(sides[p].vieraVeriacehoPred)) as [number, number];
  const povera = [n(sides[0].sums.Povera) + n(sides[0].poveryOhovaracky), n(sides[1].sums.Povera) + n(sides[1].poveryOhovaracky)] as const;
  const zrusene = ([0, 1] as const).map((p) => (sides[p].poveryBezViery === true ? 0 : Math.min(povera[p], viera[opponentOf(p)]))) as [number, number];
  // Viera, ktorá rušila Povery, sa na tuhé nepoužije.
  const vieraNaPovery = [zrusene[1], zrusene[0]] as [number, number];
  const zvysnaPovera = [povera[0] - zrusene[0], povera[1] - zrusene[1]] as const;
  // Veriaci po hádke: čo mu hádka pridala alebo ubrala, sa prejaví v tlmení tuhého.
  const zvysnaViera = ([0, 1] as const).map((p) => {
    const s = sides[p];
    const posun = n(s.vieraVeriaceho ?? s.vieraVeriacehoPred) - n(s.vieraVeriacehoPred);
    return Math.max(0, viera[p] - vieraNaPovery[p] + posun);
  }) as [number, number];
  const makke = ([0, 1] as const).map(
    (p) => n(sides[p].sums.Pohoršenie) * KONSTANTY.HADKA.POHORSENIE_MAKKE + zvysnaPovera[p] * (sides[p].silaPovery ?? KONSTANTY.HADKA.POVERA_MAKKE),
  ) as [number, number];

  const tuhe = ([0, 1] as const).map((p) => {
    const me = sides[p];
    const opp = sides[opponentOf(p)];
    const oppViera = zvysnaViera[opponentOf(p)];
    const base =
      n(me.sums.Rana) * 1 +
      n(me.sums.Pecka) * 2 +
      n(me.sums.Petelica) * 3 +
      me.cirhozaBonus +
      me.tuheBonus +
      me.priazenBitkara;
    return Math.max(0, base - oppViera * opp.hodnotaViery - abstakyVBitke(me.abstaky, me.silaAbstinenta) - (me.tuheZlava ?? 0));
  }) as [number, number];

  return {
    tuhe,
    makke,
    celkove: [tuhe[0], tuhe[1]],
    zvysnaViera,
    zvysnaPovera: [...zvysnaPovera] as [number, number],
    zrusenePovery: zrusene,
    vieraNaPovery,
    abstinent: [n(sides[0].silaAbstinenta), n(sides[1].silaAbstinenta)],
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
  /**
   * Nakladačka (v8.3): rozdiel tuhého, drží ju hráč s vyšším tuhým (víťaz);
   * pri remíze v tuhom nikto — aj keď remízu rozhodnú Absťáky či Dlhy.
   */
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

export function battleOutcome(damage: DamageResult, remizaVstup?: RemizaBitky): BattleOutcome {
  // Abstinent (v10): pri remíze v tuhom sa porovnáva počet Absťákov znížený o jeho silu.
  const a = damage.abstinent;
  const remiza =
    remizaVstup === undefined || a === undefined
      ? remizaVstup
      : { ...remizaVstup, abstaky: [abstakyVBitke(remizaVstup.abstaky[0], a[0]), abstakyVBitke(remizaVstup.abstaky[1], a[1])] as const };
  const prebytokDrzi: PlayerId | null = damage.tuhe[0] === damage.tuhe[1] ? null : damage.tuhe[0] > damage.tuhe[1] ? 0 : 1;
  const prebytok = Math.abs(damage.tuhe[0] - damage.tuhe[1]);
  if (damage.tuhe[0] !== damage.tuhe[1]) return { vitaz: damage.tuhe[0] > damage.tuhe[1] ? 0 : 1, rozhodlo: "tuhe", prebytokDrzi, prebytok };
  const zAbstakov = remiza === undefined ? null : menej(remiza.abstaky);
  if (zAbstakov !== null) return { vitaz: zAbstakov, rozhodlo: "abstak", prebytokDrzi, prebytok };
  const zDlhov = remiza === undefined ? null : menej(remiza.dlhy);
  if (zDlhov !== null) return { vitaz: zDlhov, rozhodlo: "dlhy", prebytokDrzi, prebytok };
  return { vitaz: null, rozhodlo: "sekera", prebytokDrzi, prebytok };
}

/**
 * Exekúcia bez prahu (Michal 2026-10-28): Exekútor príde v každej bitke ku každému
 * hráčovi s aspoň 1 priznaným Dlhom a zhorí polovica jeho priznaných Dlhov
 * zaokrúhlene NAHOR a rovnaký počet špakov. Priazeň Exekútora zanikla v9.
 */
export function zhoriPriExekucii(priznaneDlhy: number): number {
  if (priznaneDlhy <= 0) return 0;
  return Math.ceil(priznaneDlhy / 2);
}

/**
 * Špaky, o ktoré hráča exekúcia pripraví (v9, priazeň Advokát, Michal 2026-10-30):
 * zhorené Dlhy mínus sila jeho priazne Advokáta, najmenej 0.
 */
export function spakyPriExekucii(priznaneDlhy: number, silaAdvokata = 0): number {
  return Math.max(0, zhoriPriExekucii(priznaneDlhy) - silaAdvokata);
}

/**
 * Špaky víťaza za bitku (v8): karty v línii, vždy aspoň 1. Zrážka za Absťáky
 * zanikla v8.1 (Michal 2026-10-28) — Absťák od v9.1 berie tuhé (karta v balíčku).
 */
export function spakyZaBitku(karty: number): number {
  return Math.max(KONSTANTY.SPAKY_ZA_BITKU_MIN, karty);
}

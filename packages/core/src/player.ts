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
  /** Fyzické cigarety (menové aj bodové). */
  readonly cigarety: number;
  /** Kumulatívne poškodenie pečene (pri prahu vzniká Cirhóza a počítadlo klesne). */
  readonly pecen: number;
  /** Kumulatívne zadĺženie z akcií Dlh (pri prahu vzniká Dlh a počítadlo klesne). */
  readonly zadlzenie: number;
  /** Spotrebované neresti v predošlom kole — porovnanie dáva Absťák. */
  readonly nerestiMinuleKolo: number;
  readonly nerestiTotoKolo: number;
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
 * Limit vykladania = plné poldeci + poldeci ležiace na kartách cez NA EX + 1.
 * Poldeci na karte sa ráta MAJITEĽOVI poldeci, aj keď karta leží v súperovej
 * partii. Vypité poldeci a priznané karty limit neovplyvňujú (PRAVIDLA §5).
 */
export function limitVykladania(
  player: PlayerState,
  strany: readonly [readonly PlacedCard[], readonly PlacedCard[]],
  p: PlayerId,
): number {
  let naexPoldeci = 0;
  for (const strana of strany) {
    for (const placed of strana) {
      if (placed.naexBy === p) naexPoldeci++;
    }
  }
  return player.poldeciPlne + naexPoldeci + 1;
}

export function prahCirhozy(priazenAlkoholika: number): number {
  return KONSTANTY.PRAH_CIRHOZY_ZAKLAD + priazenAlkoholika;
}

export function prahDlhu(): number {
  return KONSTANTY.PRAH_DLHU;
}

export function prahExekutora(priazenExekutora: number): number {
  return KONSTANTY.PRAH_EXEKUTORA_ZAKLAD + 2 * priazenExekutora;
}

export function hodnotaViery(priazenVeriaceho: number): number {
  return KONSTANTY.HODNOTA_VIERY_ZAKLAD + priazenVeriaceho;
}

export function limitRuky(priazenZberatela: number): number {
  return KONSTANTY.LIMIT_RUKY_ZAKLAD + priazenZberatela;
}

export function hodnotaTrocha(priazenLakomca: number): number {
  return KONSTANTY.TROCHA_ZAKLAD + priazenLakomca;
}

export function hodnotaZopar(priazenNeprajnika: number): number {
  return KONSTANTY.ZOPAR_ZAKLAD + priazenNeprajnika;
}

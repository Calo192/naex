// Starší, ukazovatele a špaky za strach.
//
// Stupnica strachu má od v6 7 polí (Michal 2026-10-26): 3-2-1-0-1-2-3 —
// červená, oranžová, žltá, jedno sivé, žltá, oranžová, červená. Konvencia
// strán: indexy 0–2 = polovica hráča 0, 4–6 = polovica hráča 1, 3 = sivý stred.
//
//  - Priazeň: marker na polovici hráča → TEN hráč má priazeň sily 1 / 2 / 3.
//  - Strach: starší sa bojí hráča na OPAČNEJ strane. Po každej bitke dá
//    obávanému hráčovi toľko špakov, aká je zóna (žltá 1, oranžová 2, červená 3);
//    sivý stred nedá nikomu.
//  - Nahradený starší (patronát) ostáva v hre celý: marker, priazeň,
//    prebudenie aj špaky.

import type { CardInstance, Favour, PlayerId } from "./types.ts";
import type { GameData } from "./data.ts";
import type { ScorecardDef } from "./types.ts";

/** Sila priazne podľa pozície markera. */
export const STUPNICA_HODNOTY = [3, 2, 1, 0, 1, 2, 3] as const;

/** Zóna pozície: 0 = sivá, 1 = žltá, 2 = oranžová, 3 = červená. */
export const STUPNICA_ZONY = [3, 2, 1, 0, 1, 2, 3] as const;

export type MarkerPos = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export const MARKER_STRED: MarkerPos = 3;
/** Krajné pozície stupnice — červená na polovici hráča 0 a hráča 1. */
export const MARKER_KRAJ = [0, 6] as const;

/** Názvy zón podľa pravidiel (§10). */
export const NAZVY_ZON = ["Neutralita", "Znepokojenie", "Strach", "Vydesenie"] as const;

/**
 * Posun markera (roadmapa #95, Michal 2026-10-26): odkiaľ kam, prečo a kto ho
 * urobil. Pozícia markera je verejná, preto aj posun — posiela sa obom.
 */
export interface PosunMarkera {
  readonly elderId: string;
  readonly z: MarkerPos;
  readonly na: MarkerPos;
  readonly zdroj: "pohorsenie" | "prebytok" | "patronat";
  /** Hráč, ktorého akcia marker posunula (pri prebytku držiteľ prebytku). */
  readonly kto: PlayerId;
}

export interface ElderState {
  /** Pôvodný starší (kľúč do elders.json — ukazovateľ ostáva aj po náhrade). */
  readonly elderId: string;
  /** Karta ležiaca na ukazovateli: starší, alebo po náhrade Občan/Zviera. */
  readonly karta: CardInstance;
  readonly marker: MarkerPos;
  /** Na ukazovateli leží náhrada — o takého staršieho sa už bojovať nedá. */
  readonly nahradeny: boolean;
  /** Hráč, ktorý si vzal kartu staršieho náhradou (patronát). */
  readonly ziskal: PlayerId | null;
  /** Id scorecardu, na ktorom ukazovateľ leží (rozdaný pri príprave, aj po náhrade). */
  readonly scorecard: string;
}

export function freshElder(elderId: string, karta: CardInstance, scorecard: string): ElderState {
  return { elderId, karta, scorecard, marker: MARKER_STRED, nahradeny: false, ziskal: null };
}

/** Hráč, ktorý sa teší priazni tohto staršieho (marker na jeho polovici). */
export function priazenHraca(elder: Pick<ElderState, "marker">): PlayerId | null {
  if (elder.marker < MARKER_STRED) return 0;
  if (elder.marker > MARKER_STRED) return 1;
  return null;
}

/** Sila priazne = hodnota pozície markera. */
export function priazenSila(elder: Pick<ElderState, "marker">): number {
  return STUPNICA_HODNOTY[elder.marker];
}

/** Hráč, ktorého sa starší bojí — ten na opačnej strane, než leží marker (v sivom nikto). */
export function obavanyHrac(elder: Pick<ElderState, "marker">): PlayerId | null {
  const p = priazenHraca(elder);
  return p === null ? null : p === 0 ? 1 : 0;
}

/** Prebudený starší: marker na krajnej červenej pozícii; efekt platí obávanému. */
export function prebudenyPre(elder: Pick<ElderState, "marker">): PlayerId | null {
  if (elder.marker === MARKER_KRAJ[0]) return 1;
  if (elder.marker === MARKER_KRAJ[1]) return 0;
  return null;
}

/** Hráč p vydesil staršieho = marker na krajnej pozícii súperovej polovice. */
export function vydesil(elder: Pick<ElderState, "marker">, p: PlayerId): boolean {
  return elder.marker === MARKER_KRAJ[p === 0 ? 1 : 0];
}

/** Ako veľmi sa starší bojí hráča p: zóna markera na súperovej polovici, inak 0. */
export function strachZ(elder: Pick<ElderState, "marker">, p: PlayerId): 0 | 1 | 2 | 3 {
  return obavanyHrac(elder) === p ? STUPNICA_ZONY[elder.marker] : 0;
}

/**
 * Špaky za starších po bitke (v6, Michal 2026-10-26): každý starší, ktorý sa
 * hráča bojí, mu dá toľko špakov, aká je zóna — aj nahradený.
 */
export function spakyZaStarsich(starsi: readonly Pick<ElderState, "marker">[], p: PlayerId): number {
  return starsi.reduce((a, e) => a + strachZ(e, p), 0);
}

/**
 * Patronát (Michal 2026-10-20 — nahradil bitku o staršieho): patrón je hráč,
 * ktorému starší prejavuje priazeň. Po šenku si smie vziať do ruky pôvodného
 * (nenahradeného) staršieho, ktorého marker je aspoň v žltej zóne na jeho
 * polovici.
 */
export function patronatMozny(elder: ElderState, p: PlayerId): boolean {
  return !elder.nahradeny && priazenHraca(elder) === p;
}

/**
 * Cena patronátu: cigarety = koľko markeru chýba do červenej (žltá 2,
 * oranžová 1, červená 0), súper dostane v bitke toľko Pohoršení, o koľko polí
 * sa marker vráti do stredu (v6: 1 / 2 / 3). Spolu vždy 3.
 */
export function cenaPatronatu(elder: Pick<ElderState, "marker">): { readonly cigarety: number; readonly pohorsenia: number } {
  return { cigarety: 3 - STUPNICA_ZONY[elder.marker], pohorsenia: Math.abs(elder.marker - MARKER_STRED) };
}

/**
 * Posun markera o jedno pole k hráčovi `smerK` (prebytok aj Pohoršenie, v6).
 * Zamknutie krajnej pozície sa ruší (Michal 2026-10-26): na červenú smie marker
 * aj viac posunmi v jednom kole a z červenej ho smie súper odtlačiť. Vracia
 * novú pozíciu, alebo null, keď je marker už na kraji v tom smere.
 */
export function posunMarker(elder: Pick<ElderState, "marker">, smerK: PlayerId): MarkerPos | null {
  const pos = elder.marker;
  if (pos === MARKER_KRAJ[smerK]) return null;
  return (smerK === 0 ? pos - 1 : pos + 1) as MarkerPos;
}

/** Scorecard, na ktorom starší leží; chýbajúci je chyba dát, nie hry. */
export function scorecardStarsieho(data: GameData, elder: ElderState): ScorecardDef {
  const sc = data.scorecards.find((x) => x.id === elder.scorecard);
  if (sc === undefined) throw new Error(`Chybné dáta: starší ${elder.elderId} leží na neznámom scorecarde ${elder.scorecard}`);
  return sc;
}

/** Priazeň, ktorú starší dáva — určuje ju jeho scorecard. */
export function favourStarsieho(data: GameData, elder: ElderState): Favour {
  return scorecardStarsieho(data, elder).favour;
}

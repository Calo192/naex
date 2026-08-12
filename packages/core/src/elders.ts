// Starší, ukazovatele a bodovanie (M5).
//
// Stupnica strachu má 9 pozícií. Konvencia strán: indexy 0–2 = polovica
// hráča 0, 6–8 = polovica hráča 1, 3–5 = neutrálny stred.
//
//  - Priazeň (počas hry): marker na polovici hráča → TEN hráč má priazeň.
//  - Strach (koniec hry): starší sa bojí hráča na OPAČNEJ strane a body
//    získava OBÁVANÝ hráč.

import type { CardInstance, ElderDef, PlayerId, Zone } from "./types.ts";
import type { GameData } from "./data.ts";
import { printedSides } from "./data.ts";

export const STUPNICA_HODNOTY = [2, 2, 1, 0, 0, 0, 1, 2, 2] as const;

/** Zóna pozície: 0 = sivá, 1 = žltá, 2 = oranžová, 3 = červená. */
export const STUPNICA_ZONY = [3, 2, 1, 0, 0, 0, 1, 2, 3] as const;

export type MarkerPos = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export const MARKER_STRED: MarkerPos = 4;

export interface ElderState {
  /** Pôvodný starší (kľúč do elders.json — ukazovateľ ostáva aj po náhrade). */
  readonly elderId: string;
  /** Karta ležiaca na ukazovateli: starší, alebo po náhrade Občan/Zviera. */
  readonly karta: CardInstance;
  readonly marker: MarkerPos;
  /** Pozícia na začiatku kola — podmienka vstupu na krajnú pozíciu. */
  readonly markerZaciatokKola: MarkerPos;
  readonly nahradeny: boolean;
  /** Hráč, ktorý si vzal kartu staršieho náhradou (bodovanie). */
  readonly ziskal: PlayerId | null;
}

export function freshElder(elderId: string, karta: CardInstance): ElderState {
  return {
    elderId,
    karta,
    marker: MARKER_STRED,
    markerZaciatokKola: MARKER_STRED,
    nahradeny: false,
    ziskal: null,
  };
}

/** Hráč, ktorý sa teší priazni tohto staršieho (marker na jeho polovici). */
export function priazenHraca(elder: ElderState): PlayerId | null {
  if (elder.nahradeny) return null;
  if (elder.marker <= 2) return 0;
  if (elder.marker >= 6) return 1;
  return null;
}

/** Sila priazne = hodnota pozície markera. */
export function priazenSila(elder: ElderState): number {
  return priazenHraca(elder) === null ? 0 : STUPNICA_HODNOTY[elder.marker];
}

/**
 * Hráč, ktorého sa starší bojí — ten na opačnej strane, než leží marker.
 * Bojí sa len pri vychýlenom markeri (mimo sivej zóny).
 */
export function obavanyHrac(elder: ElderState): PlayerId | null {
  if (elder.marker <= 2) return 1;
  if (elder.marker >= 6) return 0;
  return null;
}

/** Prebudený starší: marker na krajnej červenej pozícii; efekt platí obávanému. */
export function prebudenyPre(elder: ElderState): PlayerId | null {
  if (elder.nahradeny) return null;
  if (elder.marker === 0) return 1;
  if (elder.marker === 8) return 0;
  return null;
}

/** Hráč p vydesil staršieho = marker na krajnej pozícii súperovej polovice. */
export function vydesil(elder: ElderState, p: PlayerId): boolean {
  return elder.marker === (p === 0 ? 8 : 0);
}

/** Bitka o staršieho sa dá vyvolať, len ak je marker aspoň v oranžovej zóne. */
export function bitkaOStarsiehoMozna(elder: ElderState): boolean {
  return !elder.nahradeny && STUPNICA_ZONY[elder.marker] >= 2;
}

/**
 * Posun markera o 1 smerom k hráčovi `smerK`. Vracia novú pozíciu, alebo
 * null, keď je posun zakázaný:
 *  - z krajnej pozície sa marker bežným posunom nepohne,
 *  - na krajnú pozíciu len z predposlednej, na ktorej bol UŽ NA ZAČIATKU
 *    kola (markerZaciatokKola) — nie viacerými posunmi v jednom kole,
 *  - Pohoršenie na krajnú pozíciu nesmie nikdy.
 */
export function posunMarker(
  elder: ElderState,
  smerK: PlayerId,
  cezPohorsenie: boolean,
): MarkerPos | null {
  const pos = elder.marker;
  if (pos === 0 || pos === 8) return null;
  const target = (smerK === 0 ? pos - 1 : pos + 1) as MarkerPos;
  if (target === 0 || target === 8) {
    if (cezPohorsenie) return null;
    if (elder.markerZaciatokKola !== pos) return null;
  }
  return target;
}

/**
 * Bodovanie jedného ukazovateľa na konci hry. Bočnú pozíciu aktivuje
 * neprázdna akcia karty na ukazovateli na spárovanom indexe (ľavá strana ↔
 * pozície 0..3, pravá ↔ 4..7); podmienka zóny je prahová — marker v danej
 * zóne alebo v ktorejkoľvek intenzívnejšej. Body získava obávaný hráč.
 */
export function elderScore(
  data: GameData,
  def: ElderDef,
  elder: ElderState,
): { hrac: PlayerId; body: number } | null {
  const hrac = obavanyHrac(elder);
  if (hrac === null) return null;
  const markerZona = STUPNICA_ZONY[elder.marker] as Zone | 0;
  if (markerZona === 0) return null;

  const sides = printedSides(data, elder.karta);
  let body = 0;
  def.scoring.forEach((pos, i) => {
    const action = i < 4 ? sides.left[i as 0 | 1 | 2 | 3] : sides.right[(i - 4) as 0 | 1 | 2 | 3];
    if (action === null) return;
    if (markerZona >= pos.zone) body += pos.points;
  });
  return { hrac, body };
}

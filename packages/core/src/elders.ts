// Starší, ukazovatele a bodovanie (M5).
//
// Stupnica strachu má 9 pozícií. Konvencia strán: indexy 0–2 = polovica
// hráča 0, 6–8 = polovica hráča 1, 3–5 = neutrálny stred.
//
//  - Priazeň (počas hry): marker na polovici hráča → TEN hráč má priazeň.
//  - Strach (koniec hry): starší sa bojí hráča na OPAČNEJ strane a body
//    získava OBÁVANÝ hráč — podľa podmienok scorecardu, na ktorom starší leží.
//  - Nahradený starší (bitka o staršieho) ostáva v hre celý: marker, priazeň,
//    prebudenie aj body — podmienky aktivuje karta náhrady (Michal 2026-10-12).

import type { CardInstance, Favour, PlayerId, Podmienka, ScorecardDef, SlotIndex } from "./types.ts";
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
  /** Na ukazovateli leží náhrada — o takého staršieho sa už bojovať nedá. */
  readonly nahradeny: boolean;
  /** Hráč, ktorý si vzal kartu staršieho náhradou (bodovanie). */
  readonly ziskal: PlayerId | null;
  /** Id scorecardu, na ktorom ukazovateľ leží (rozdaný pri príprave, aj po náhrade). */
  readonly scorecard: string;
}

export function freshElder(elderId: string, karta: CardInstance, scorecard: string): ElderState {
  return {
    elderId,
    karta,
    scorecard,
    marker: MARKER_STRED,
    markerZaciatokKola: MARKER_STRED,
    nahradeny: false,
    ziskal: null,
  };
}

/** Hráč, ktorý sa teší priazni tohto staršieho (marker na jeho polovici). */
export function priazenHraca(elder: ElderState): PlayerId | null {
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
  if (elder.marker === 0) return 1;
  if (elder.marker === 8) return 0;
  return null;
}

/** Hráč p vydesil staršieho = marker na krajnej pozícii súperovej polovice. */
export function vydesil(elder: ElderState, p: PlayerId): boolean {
  return elder.marker === (p === 0 ? 8 : 0);
}

/**
 * Bitka o staršieho sa dá vyvolať, len ak je marker aspoň v oranžovej zóne
 * a na ukazovateli ešte leží pôvodný starší (o náhradu sa nebojuje).
 */
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

/**
 * Od akej zóny markera podmienka boduje (1 žltá, 2 oranžová, 3 červená).
 * Kladné podmienky za kus až od Strachu — v playteste 20261011-183315 dali
 * v žltej zóne 51:1 a strach starších prestal rozhodovať (rozhodnutie Michala
 * 2026-10-12). Tresty za Dlhy a Cirhózy platia od Znepokojenia, aby sa im
 * nedalo vyhnúť slabším strachom.
 */
const PRAH_PODMIENKY: Readonly<Record<Podmienka, 1 | 2 | 3>> = {
  znepokojenie: 1,
  strach: 2,
  vydesenie: 3,
  lokality: 2,
  starsi: 2,
  cigarety: 2,
  cirhoza: 1,
  dlh: 1,
};

/** Najslabšia zóna markera, v ktorej podmienka boduje. */
export function prahPodmienky(podmienka: Podmienka): 1 | 2 | 3 {
  return PRAH_PODMIENKY[podmienka];
}

const ZONOVE: ReadonlySet<Podmienka> = new Set(["znepokojenie", "strach", "vydesenie"]);

/** Podmienka scorecardu tak, ako ju vidí hráč v hre (zvýraznenie) aj bodovanie. */
export interface StavPodmienky {
  readonly strana: "lava" | "prava";
  readonly index: SlotIndex;
  readonly podmienka: Podmienka;
  /** Karta na ukazovateli má na tejto strane a indexe neprázdnu akciu. */
  readonly aktivna: boolean;
  /** Hráč, ktorému strana patrí (ľavá = 0, pravá = 1). */
  readonly hrac: PlayerId;
}

/** Všetky podmienky scorecardu staršieho s tým, ktoré aktivuje karta na ukazovateli. */
export function podmienkyStarsieho(data: GameData, elder: ElderState): StavPodmienky[] {
  const sc = scorecardStarsieho(data, elder);
  const sides = printedSides(data, elder.karta);
  const out: StavPodmienky[] = [];
  for (const strana of ["lava", "prava"] as const) {
    const podmienky = strana === "lava" ? sc.lava : sc.prava;
    const akcie = strana === "lava" ? sides.left : sides.right;
    podmienky.forEach((podmienka, i) => {
      if (podmienka === null) return;
      const index = i as SlotIndex;
      out.push({ strana, index, podmienka, aktivna: akcie[index] !== null, hrac: strana === "lava" ? 0 : 1 });
    });
  }
  return out;
}

/** Čo potrebuje bodovanie zo stavu hry (počty kusov obávaného hráča). */
export interface StavBodovania {
  readonly ovladnute: readonly { readonly hrac: PlayerId }[];
  readonly starsi: readonly ElderState[];
  readonly hraci: readonly {
    readonly cigarety: number;
    readonly ruka: readonly CardInstance[];
    readonly doberaci: readonly CardInstance[];
    readonly odhadzovaci: readonly CardInstance[];
  }[];
}

function pocetKusov(podmienka: Podmienka, stav: StavBodovania, p: PlayerId): number {
  const hrac = stav.hraci[p];
  if (hrac === undefined) return 0;
  const nepriznane = (defId: string): number =>
    [...hrac.ruka, ...hrac.doberaci, ...hrac.odhadzovaci].filter((k) => k.defId === defId).length;
  switch (podmienka) {
    case "lokality":
      return stav.ovladnute.filter((o) => o.hrac === p).length;
    case "starsi":
      return stav.starsi.filter((e) => e.ziskal === p).length;
    case "cigarety":
      return hrac.cigarety;
    case "cirhoza":
      return nepriznane("cirhoza");
    case "dlh":
      return nepriznane("dlh");
    default:
      return 0;
  }
}

export interface BodPodmienky extends StavPodmienky {
  readonly body: number;
}

/**
 * Bodovanie jedného ukazovateľa na konci hry. Boduje len obávaný hráč a len
 * aktivované podmienky na SVOJEJ strane scorecardu (ľavá = hráč 0). Každá
 * podmienka platí od svojho prahu zóny (`prahPodmienky`); zóny dávajú pevné
 * body, ostatné podmienky body za každý kus obávaného hráča.
 */
export function elderScore(
  data: GameData,
  stav: StavBodovania,
  elder: ElderState,
): { hrac: PlayerId; body: number; polozky: BodPodmienky[] } | null {
  const hrac = obavanyHrac(elder);
  if (hrac === null) return null;
  const markerZona = STUPNICA_ZONY[elder.marker];
  if (markerZona === 0) return null;

  const polozky: BodPodmienky[] = [];
  for (const pod of podmienkyStarsieho(data, elder)) {
    if (!pod.aktivna || pod.hrac !== hrac) continue;
    const body =
      markerZona < prahPodmienky(pod.podmienka)
        ? 0
        : ZONOVE.has(pod.podmienka)
          ? data.bodyPodmienok[pod.podmienka]
          : pocetKusov(pod.podmienka, stav, hrac) * data.bodyPodmienok[pod.podmienka];
    if (body !== 0) polozky.push({ ...pod, body });
  }
  return { hrac, body: polozky.reduce((a, x) => a + x.body, 0), polozky };
}

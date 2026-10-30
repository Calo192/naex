// Starší, ukazovatele a špaky za strach.
//
// Stupnica má od v6 7 polí (Michal 2026-10-26): stupne 3-2-1-0-1-2-3 —
// červená, oranžová, žltá, sivý stred, žltá, oranžová, červená. Konvencia
// strán: indexy 0–2 = polovica hráča 0, 4–6 = polovica hráča 1, 3 = stred.
// Pojmy (v8.3, Michal 2026-10-30, R14): stupeň 0–3 a farba; stav staršieho
// pokojný / znepokojený / vystrašený / vydesený; smer „od seba / k sebe“.
//
//  - Priazeň: marker na polovici hráča → TEN hráč má priazeň sily = stupeň.
//  - Strach: starší sa bojí hráča na OPAČNEJ strane, na stupni markera. Stupeň
//    zaplatí (žltá 1, oranžová 2, červená 3) až vtedy, keď sa na ňom marker
//    udrží do konca nasledujúceho kola (v8.3, variant 6A) — obávanému hráčovi,
//    nech bitku vyhral ktokoľvek. Ústup k stredu zmaže zaplatené aj držané
//    stupne (sPosunutymMarkerom).
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

/** Zóny podľa stupňa (§10, v8.3): stred 0, žltá 1, oranžová 2, červená 3. */
export const NAZVY_ZON = ["stred", "žltá", "oranžová", "červená"] as const;

/** Stav staršieho podľa stupňa (§10, v8.3) — prídavné meno, nie názov zóny. */
export const STAV_STARSIEHO = ["pokojný", "znepokojený", "vystrašený", "vydesený"] as const;

/**
 * Posun markera (roadmapa #95, Michal 2026-10-26): odkiaľ kam, prečo a kto ho
 * urobil. Pozícia markera je verejná, preto aj posun — posiela sa obom.
 */
export interface PosunMarkera {
  readonly elderId: string;
  readonly z: MarkerPos;
  readonly na: MarkerPos;
  /** kseft = Predsedova vila (v7), nastup = Kapybara (v7). */
  readonly zdroj: "pohorsenie" | "prebytok" | "patronat" | "kseft" | "nastup";
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
  /**
   * Po ktorý stupeň (1 žltá … 3 červená) už starší zaplatil strach hráčovi, ktorého
   * sa bojí (v8, Michal 2026-10-28). Nikdy nie je väčší ako stupeň markera; chýba = 0.
   */
  readonly vyplatene?: number;
  /**
   * Po ktorý stupeň marker stál na strane obávaného na konci minulého kola a odvtedy
   * neustúpil (v8.3, Michal 2026-10-30) — tieto stupne sa na konci kola udržia
   * a zaplatia. Nikdy nie je väčší ako stupeň markera; chýba = 0.
   */
  readonly drzane?: number;
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

/**
 * Klebety staršieho (Povery v8.3 „Výpožička priazne“, Michal 2026-10-30): o koľko
 * stupňov Povery tohto kola posunuli silu jeho priazne — kladne k hráčovi 0,
 * záporne k hráčovi 1. Marker sa nehýbe; po kole klebety zaniknú.
 */
export type Klebety = Readonly<Record<string, number>>;

/** Priazeň ako jedno číslo −3 … +3: kladná patrí hráčovi 0, záporná hráčovi 1. */
function priazenSoZnamienkom(elder: Pick<ElderState, "marker">): number {
  return MARKER_STRED - elder.marker;
}

/**
 * Účinná priazeň staršieho v tomto kole: sila z markera posunutá klebetami
 * a orezaná na −3 … +3 (v8.3). Bez klebiet je to priazeň z markera. Na jedno
 * kolo môže mať priazeň aj hráč, ktorého sa starší bojí.
 */
export function ucinnaPriazen(elder: Pick<ElderState, "marker" | "elderId">, klebety?: Klebety): { readonly hrac: PlayerId | null; readonly sila: number } {
  const v = Math.max(-3, Math.min(3, priazenSoZnamienkom(elder) + (klebety?.[elder.elderId] ?? 0)));
  return { hrac: v > 0 ? 0 : v < 0 ? 1 : null, sila: Math.abs(v) };
}

/** Smie ďalšia Povera hráča p posunúť priazeň tohto staršieho k nemu? (strop 3) */
export function poveraMozna(elder: Pick<ElderState, "marker" | "elderId">, p: PlayerId, klebety?: Klebety): boolean {
  const u = ucinnaPriazen(elder, klebety);
  return !(u.hrac === p && u.sila >= 3);
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

/** Ako veľmi sa starší bojí hráča p: stupeň markera na súperovej polovici, inak 0. */
export function strachZ(elder: Pick<ElderState, "marker">, p: PlayerId): 0 | 1 | 2 | 3 {
  return obavanyHrac(elder) === p ? STUPNICA_ZONY[elder.marker] : 0;
}

/** Súčet hodnôt zón od (od + 1) po `po` — žltá 1, oranžová 2, červená 3. */
function hodnotaZon(od: number, po: number): number {
  return (po * (po + 1)) / 2 - (od * (od + 1)) / 2;
}

type StavStrachu = Pick<ElderState, "marker" | "vyplatene" | "drzane">;

/**
 * Strach na konci kola (v8.3, Michal 2026-10-30, variant 6A): koľko špakov dá
 * starší hráčovi p na konci tohto kola, ak marker dovtedy neustúpi — stupne,
 * ktoré držal už na konci minulého kola a ešte ich nezaplatil. Platí obávanému
 * aj po prehre; zaparkovaný marker po výplate nedá nič.
 */
export function strachNaVyplatu(elder: StavStrachu, p: PlayerId): number {
  const drzane = Math.min(elder.drzane ?? 0, strachZ(elder, p));
  return hodnotaZon(Math.min(elder.vyplatene ?? 0, drzane), drzane);
}

/**
 * Strach, ktorý čaká na udržanie (v8.3): stupne, kam sa marker dostal až v tomto
 * kole — zaplatia sa na konci NASLEDUJÚCEHO kola, ak sa na nich marker udrží.
 */
export function strachNaUdrzanie(elder: StavStrachu, p: PlayerId): number {
  const zona = strachZ(elder, p);
  const od = Math.max(elder.vyplatene ?? 0, Math.min(elder.drzane ?? 0, zona));
  return hodnotaZon(Math.min(od, zona), zona);
}

/**
 * Špaky za starších na konci kola: každý starší, ktorý sa hráča bojí, mu zaplatí
 * udržané a ešte nezaplatené stupne (v8.3) — aj nahradený, nech bitku vyhral ktokoľvek.
 */
export function spakyZaStarsich(starsi: readonly StavStrachu[], p: PlayerId): number {
  return starsi.reduce((a, e) => a + strachNaVyplatu(e, p), 0);
}

/** Strach všetkých starších, ktorý čaká na udržanie (strachNaUdrzanie). */
export function strachNaUdrzanieSpolu(starsi: readonly StavStrachu[], p: PlayerId): number {
  return starsi.reduce((a, e) => a + strachNaUdrzanie(e, p), 0);
}

/**
 * Starší s markerom na novej pozícii — jediné miesto, kde sa ráta, čo ostane
 * zaplatené a držané (v8, v8.3): ústup k stredu zmaže stupne, z ktorých marker
 * odišiel, prechod cez stred zmaže všetko (druhá polovica platí nanovo druhému
 * hráčovi). Postup od stredu nič nemaže ani nepridáva.
 */
export function sPosunutymMarkerom<E extends StavStrachu>(elder: E, na: MarkerPos): E {
  const ista = obavanyHrac(elder) === obavanyHrac({ marker: na });
  const bez: E = { ...elder, marker: na };
  delete (bez as { vyplatene?: number }).vyplatene;
  delete (bez as { drzane?: number }).drzane;
  const vyplatene = ista ? Math.min(elder.vyplatene ?? 0, STUPNICA_ZONY[na]) : 0;
  const drzane = ista ? Math.min(elder.drzane ?? 0, STUPNICA_ZONY[na]) : 0;
  return { ...bez, ...(vyplatene > 0 ? { vyplatene } : {}), ...(drzane > 0 ? { drzane } : {}) };
}

/**
 * Starší na konci kola (v8.3): udržané stupne sú zaplatené a stupeň, na ktorom
 * marker teraz stojí, sa začína udržiavať do konca nasledujúceho kola.
 */
export function poKonciKola<E extends StavStrachu>(elder: E): E {
  const bez: E = { ...elder };
  delete (bez as { vyplatene?: number }).vyplatene;
  delete (bez as { drzane?: number }).drzane;
  const zona = STUPNICA_ZONY[elder.marker];
  const vyplatene = Math.min(zona, Math.max(elder.vyplatene ?? 0, elder.drzane ?? 0));
  return { ...bez, ...(vyplatene > 0 ? { vyplatene } : {}), ...(zona > 0 ? { drzane: zona } : {}) };
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
 * Cena patronátu (v6.1, Michal 2026-10-27): cigarety podľa zóny — červená 1,
 * oranžová 2, žltá 3 (sivá patronát nepripúšťa). Súper dostane v bitke toľko
 * Pohoršení, o koľko polí sa marker vráti do stredu (žltá 1, oranžová 2, červená 3).
 */
export function cenaPatronatu(elder: Pick<ElderState, "marker">): { readonly cigarety: number; readonly pohorsenia: number } {
  const zona = STUPNICA_ZONY[elder.marker];
  return { cigarety: zona === 0 ? 0 : 4 - zona, pohorsenia: Math.abs(elder.marker - MARKER_STRED) };
}

/**
 * Posun markera o jedno pole k hráčovi `smerK` (Kšeft Predsedovej vily, Kapybara;
 * Pohoršenie a prebytok od v8.2 cez posunZaBody).
 * Zamknutie krajnej pozície sa ruší (Michal 2026-10-26): na červenú smie marker
 * aj viac posunmi v jednom kole a z červenej ho smie súper odtlačiť. Vracia
 * novú pozíciu, alebo null, keď je marker už na kraji v tom smere.
 */
export function posunMarker(elder: Pick<ElderState, "marker">, smerK: PlayerId): MarkerPos | null {
  const pos = elder.marker;
  if (pos === MARKER_KRAJ[smerK]) return null;
  return (smerK === 0 ? pos - 1 : pos + 1) as MarkerPos;
}

/**
 * Cena posunu markera o jedno pole z `z` na susedné `na` za Pohoršenie či prebytok
 * (v8.2, Michal 2026-10-30): smerom von zo stredu toľko, aká je cieľová zóna —
 * stred → žltá 1, žltá → oranžová 2, oranžová → červená 3 (zo stredu na červenú 6);
 * smerom k stredu o 1 viac — červená → oranžová 4, oranžová → žltá 3, žltá → stred 2.
 */
export function cenaKroku(z: MarkerPos, na: MarkerPos): number {
  const zo = STUPNICA_ZONY[z];
  const doZony = STUPNICA_ZONY[na];
  return doZony > zo ? doZony : zo + 1;
}

/** Kam sa marker dostane za body a koľko to stojí (posunZaBody). */
export interface PosunZaBody {
  readonly marker: MarkerPos;
  readonly cena: number;
  readonly kroky: number;
}

/**
 * Posun za body (v8.2): hráč vyberá len staršieho a smer, nie počet polí —
 * marker ide k hráčovi `smerK`, kým zvyšok bodov stačí na ďalší krok (cenaKroku)
 * a kým nie je na kraji. null, keď nevyjde ani jeden krok.
 */
export function posunZaBody(elder: Pick<ElderState, "marker">, smerK: PlayerId, body: number): PosunZaBody | null {
  let marker = elder.marker;
  let cena = 0;
  let kroky = 0;
  for (let dalsi = posunMarker({ marker }, smerK); dalsi !== null; dalsi = posunMarker({ marker }, smerK)) {
    const c = cenaKroku(marker, dalsi);
    if (cena + c > body) break;
    cena += c;
    marker = dalsi;
    kroky++;
  }
  return kroky === 0 ? null : { marker, cena, kroky };
}

/** Cena posunu markera z pozície `z` o `d` polí (záporné k hráčovi 0, kladné k hráčovi 1). */
export function cenaPosunuOPoli(z: MarkerPos, d: number): number {
  let cena = 0;
  for (let m = z, i = 0; i < Math.abs(d); i++) {
    const na = (d < 0 ? m - 1 : m + 1) as MarkerPos;
    cena += cenaKroku(m, na);
    m = na;
  }
  return cena;
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

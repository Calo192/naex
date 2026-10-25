// Starší, ukazovatele a bodovanie (M5).
//
// Stupnica strachu má 9 pozícií. Konvencia strán: indexy 0–2 = polovica
// hráča 0, 6–8 = polovica hráča 1, 3–5 = neutrálny stred.
//
//  - Priazeň (počas hry): marker na polovici hráča → TEN hráč má priazeň.
//  - Strach (koniec hry): starší sa bojí hráča na OPAČNEJ strane a body
//    získava OBÁVANÝ hráč — podľa podmienok scorecardu, na ktorom starší leží.
//  - Nahradený starší (patronát) ostáva v hre celý: marker, priazeň,
//    prebudenie aj body — podmienky aktivuje karta náhrady (Michal 2026-10-12).

import type { CardInstance, Favour, PlayerId, Podmienka, ScorecardDef, SlotIndex } from "./types.ts";
import type { GameData } from "./data.ts";
import { printedSides } from "./data.ts";

/** Sila priazne podľa pozície markera (Michal 2026-10-16: 1 / 2 / 3, predtým 1 / 2 / 2). */
export const STUPNICA_HODNOTY = [3, 2, 1, 0, 0, 0, 1, 2, 3] as const;

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
 * Patronát (Michal 2026-10-20 — nahradil bitku o staršieho): patrón je hráč,
 * ktorému starší prejavuje priazeň. Po šenku si smie vziať do ruky pôvodného
 * (nenahradeného) staršieho, ktorého marker je aspoň v žltej zóne na jeho
 * polovici.
 */
export function patronatMozny(elder: ElderState, p: PlayerId): boolean {
  return !elder.nahradeny && priazenHraca(elder) === p && STUPNICA_ZONY[elder.marker] >= 1;
}

/**
 * Cena patronátu: cigarety = koľko markeru chýba do červenej (žltá 2,
 * oranžová 1, červená 0), súper dostane v bitke toľko Pohoršení, o koľko sa
 * marker posunie do stredu (2 / 3 / 4). Spolu vždy 4.
 */
export function cenaPatronatu(elder: ElderState): { readonly cigarety: number; readonly pohorsenia: number } {
  return { cigarety: 3 - STUPNICA_ZONY[elder.marker], pohorsenia: Math.abs(elder.marker - MARKER_STRED) };
}

/** Zóna so stranou (−3 … 3, sivá 0) — hranicu zón prekročí posun, ktorý ju zmení. */
const ZONA_SO_STRANOU = [-3, -2, -1, 0, 0, 0, 1, 2, 3] as const;

/** Prekročí posun z `z` na `na` hranicu zón? (Pohoršenie smie najviac dve — §9.2.) */
export function prekraciaHranicu(z: MarkerPos, na: MarkerPos): boolean {
  return ZONA_SO_STRANOU[z] !== ZONA_SO_STRANOU[na];
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
  /** Noviny v Dedičstve: Pohoršenie smie na kraj za tej istej podmienky ako prebytok. */
  pohorsenieNaKraj = false,
): MarkerPos | null {
  const pos = elder.marker;
  if (pos === 0 || pos === 8) return null;
  const target = (smerK === 0 ? pos - 1 : pos + 1) as MarkerPos;
  if (target === 0 || target === 8) {
    if (cezPohorsenie && !pohorsenieNaKraj) return null;
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
 * Úroveň strachu, ktorú zónová podmienka žiada: Znepokojenie 1 (žltá),
 * Strach 2 (oranžová), Vydesenie 3 (červená). Ostatné podmienky sú za kus.
 */
const UROVEN_ZONOVEJ: Readonly<Partial<Record<Podmienka, 1 | 2 | 3>>> = {
  znepokojenie: 1,
  strach: 2,
  vydesenie: 3,
};

/** Úroveň strachu zónovej podmienky, alebo null pri podmienke za kus. */
export function urovenPodmienky(podmienka: Podmienka): 1 | 2 | 3 | null {
  return UROVEN_ZONOVEJ[podmienka] ?? null;
}

/** Ako veľmi sa starší bojí hráča p: zóna markera na súperovej polovici, inak 0. */
export function strachZ(elder: ElderState, p: PlayerId): 0 | 1 | 2 | 3 {
  return obavanyHrac(elder) === p ? STUPNICA_ZONY[elder.marker] : 0;
}

/** Podmienka scorecardu tak, ako ju vidí hráč v hre (zvýraznenie) aj bodovanie. */
export interface StavPodmienky {
  readonly strana: "lava" | "prava";
  readonly index: SlotIndex;
  readonly podmienka: Podmienka;
  /** Karta na ukazovateli má na tejto strane a indexe neprázdnu akciu. */
  readonly aktivna: boolean;
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
      out.push({ strana, index, podmienka, aktivna: akcie[index] !== null });
    });
  }
  return out;
}

/** Čo potrebuje bodovanie zo stavu hry (strach všetkých starších a počty kusov hráčov). */
export interface StavBodovania {
  readonly ovladnute: readonly { readonly hrac: PlayerId }[];
  readonly starsi: readonly ElderState[];
  readonly hraci: readonly {
    readonly cigarety: number;
    readonly ruka: readonly CardInstance[];
    readonly doberaci: readonly CardInstance[];
    readonly odhadzovaci: readonly CardInstance[];
    /** Priznané karty — z nich sa na konci ráta Dlh (verejný dlh). */
    readonly priznane: readonly CardInstance[];
    /** Plné poldeci a Dedičstvo (Vínko = plný poldeci navyše) — podmienka Rezerva. */
    readonly poldeciPlne: number;
    readonly dedicstvo: readonly CardInstance[];
    /** Absťáky získané za hru — podmienka Absťák (chýba = 0). */
    readonly abstakyZiskane?: number;
  }[];
}

function pocetKusov(podmienka: Podmienka, stav: StavBodovania, p: PlayerId): number {
  const hrac = stav.hraci[p];
  if (hrac === undefined) return 0;
  const nepriznane = (defId: string): number =>
    [...hrac.ruka, ...hrac.doberaci, ...hrac.odhadzovaci].filter((k) => k.defId === defId).length;
  // Verejný dlh (Michal 2026-10-21): Dlh uberá body všade — v balíčku, v ruke
  // aj priznaný. Cirhóza len nepriznaná: priznaná už platí v každej bitke.
  switch (podmienka) {
    case "lokality":
      return stav.ovladnute.filter((o) => o.hrac === p).length;
    case "starsi":
      return stav.starsi.filter((e) => e.ziskal === p).length;
    case "cigarety":
      // v5: súboj o zvyšné cigarety kus po kuse (trojice platili pri bodoch za kus vo v4).
      return hrac.cigarety;
    case "cirhoza":
      return nepriznane("cirhoza");
    case "dlh":
      return nepriznane("dlh") + hrac.priznane.filter((k) => k.defId === "dlh").length;
    // v5 (Michal 2026-10-25): Absťáky získané za hru, nie tie, čo hráč práve má.
    case "abstak":
      return hrac.abstakyZiskane ?? 0;
    // v5 (Michal 2026-10-25): Vínko v Dedičstve sa ráta ako plný poldeci.
    case "rezerva":
      return hrac.poldeciPlne + (hrac.dedicstvo.some((k) => k.defId === "vinko") ? 1 : 0);
    default:
      return 0;
  }
}

/** Aktívna podmienka scorecardu — súboj hráčov (v5) a čo z nej hráč má. */
export interface BodPodmienky extends StavPodmienky {
  /** 1 = hráč tento súboj vyhral, 0 = prehral alebo rovnosť (body za staršieho sú v BodyScorecardu). */
  readonly body: number;
  /**
   * Hodnota hráča v súboji: pri zónovej podmienke počet OSTATNÝCH starších,
   * ktorí sa ho boja aspoň na jej úroveň; inak ovládnuté lokality, získaní
   * starší, cigarety, plné poldeci, Absťáky za hru, Dlhy (aj priznané) či
   * nepriznané Cirhózy hráča.
   */
  readonly kusy: number;
}

export interface BodyScorecardu {
  /** Body hráča 0 a hráča 1 za tohto staršieho. */
  readonly body: readonly [number, number];
  /** Koľko súbojov (aktívnych podmienok) vyhral hráč 0 a hráč 1. */
  readonly vyhry: readonly [number, number];
  /** Každá aktívna podmienka zvlášť, pre každého hráča. */
  readonly polozky: readonly [readonly BodPodmienky[], readonly BodPodmienky[]];
}

/** Body, ktoré hráč za staršieho dostane: 1 + zóny strachu, v ktorých sa ho bojí (priazeň či stred = 1). */
export function bodyZaStarsieho(elder: ElderState, p: PlayerId): number {
  return 1 + strachZ(elder, p);
}

/**
 * Bodovanie v5 (návrh Michala 2026-10-24, davka.md): body sa rátajú za každého
 * staršieho zvlášť. Každá AKTÍVNA podmienka jeho scorecardu je súboj hráčov —
 * dve rovnaké podmienky sú dva súboje (Michal 2026-10-25); rovnosť v súboji
 * nevyhrá nikto. Smer súboja dávajú dáta (bodyPodmienok: kladné = vyhrá viac,
 * záporné = vyhrá menej — Dlh, Cirhóza, Absťák).
 *
 *  - Zónové podmienky (Znepokojenie 1, Strach 2, Vydesenie 3) rátajú len
 *    OSTATNÝCH starších, ktorí sa hráča boja aspoň na tú úroveň.
 *  - Body za staršieho dostane, kto vyhrá viac súbojov; pri rovnosti obaja.
 *    Body = 1 + zóny strachu, v ktorých sa starší hráča bojí (bodyZaStarsieho).
 *  - Plošné body za kusy a násobenie počtom podmienok sa vo v5 rušia.
 */
export function elderScore(data: GameData, stav: StavBodovania, elder: ElderState): BodyScorecardu {
  const aktivne = podmienkyStarsieho(data, elder).filter((p) => p.aktivna);
  const ostatni = stav.starsi.filter((e) => e.elderId !== elder.elderId);
  const hodnota = (podmienka: Podmienka, p: PlayerId): number => {
    const u = urovenPodmienky(podmienka);
    return u !== null ? ostatni.filter((e) => strachZ(e, p) >= u).length : pocetKusov(podmienka, stav, p);
  };
  const vyhry: [number, number] = [0, 0];
  const polozky: [BodPodmienky[], BodPodmienky[]] = [[], []];
  for (const pod of aktivne) {
    const h: [number, number] = [hodnota(pod.podmienka, 0), hodnota(pod.podmienka, 1)];
    const smer = Math.sign(data.bodyPodmienok[pod.podmienka]);
    const rozdiel = smer * (h[0] - h[1]);
    const vitaz: PlayerId | null = rozdiel > 0 ? 0 : rozdiel < 0 ? 1 : null;
    if (vitaz !== null) vyhry[vitaz]++;
    for (const p of [0, 1] as const) polozky[p].push({ ...pod, kusy: h[p], body: vitaz === p ? 1 : 0 });
  }
  const pre = (p: PlayerId): number => {
    const su: PlayerId = p === 0 ? 1 : 0;
    // Kto väčšinu súbojov prehrá, nedostane nič — ani za vyhratú podmienku
    // (variant „útecha“ Michal zamietol, interview 4).
    return vyhry[p] >= vyhry[su] ? bodyZaStarsieho(elder, p) : 0;
  };
  return { body: [pre(0), pre(1)], vyhry, polozky };
}

// Starší, strach a reči (v11 Strach a reči, Michal 2026-11-02, docs/napady/strach-reci.html).
//
// Stupnica staršieho má stupne 0–3 (sivá, žltá, oranžová, červená). Každý hráč má pri
// každom staršom vlastné dva markery:
//  - strach 0–3: neklesá (výnimka: neúspešný pokus o zajatie ho vynuluje); dvíha ho víťaz
//    bitky Nakladačkou. Priazeň pre mňa = max(0, strach súpera − môj strach).
//  - reči: nič (0), alebo stupeň NAD vlastným strachom; dvíha ich víťaz hádky. Priazeň
//    nedávajú, bodujú aj porazenému a po bodovaní klesnú o stupeň; keď by klesli na
//    stupeň strachu (alebo strach dorastie na ich stupeň), zaniknú.
// Po bitke dá starší víťazovi špaky za najvyšší marker (reči, inak strach), porazenému
// a pri sekere obom len za reči — žltá 1, oranžová 3, červená 5 (KONSTANTY.SPAKY_ZA_STUPEN).
// Väzeň (v9): starší, ktorého sa hráč bojí na stupni 3, sa dá zajať; zajatý odchádza
// zo stupnice (GameState.vazni) a ráta sa ako červená svojho držiteľa (výhra strachom).

import type { CardInstance, Favour, PlayerId } from "./types.ts";
import { opponentOf } from "./types.ts";
import type { GameData } from "./data.ts";
import type { ScorecardDef } from "./types.ts";
import { KONSTANTY } from "./constants.ts";

/** Stupeň markera na stupnici staršieho: 0 sivá, 1 žltá, 2 oranžová, 3 červená. */
export type Stupen = 0 | 1 | 2 | 3;
export const STUPNE: readonly Stupen[] = [0, 1, 2, 3];
/** Najvyšší stupeň — červená. */
export const CERVENA: Stupen = 3;

/** Názvy farieb stupňov (§10). */
export const NAZVY_ZON = ["sivá", "žltá", "oranžová", "červená"] as const;

/** Stav staršieho podľa vyššieho strachu (§10) — prídavné meno, nie názov farby. */
export const STAV_STARSIEHO = ["pokojný", "znepokojený", "vystrašený", "vydesený"] as const;

/** Ktorý z dvoch markerov hráča. */
export type DruhMarkera = "strach" | "reci";

export interface ElderState {
  /** Starší (kľúč do elders.json). */
  readonly elderId: string;
  /** Karta staršieho — na ukazovateli, alebo počas pokusu o zajatie v ruke či línii pokúšajúceho. */
  readonly karta: CardInstance;
  /** Id scorecardu, na ktorom ukazovateľ leží (rozdaný pri príprave). */
  readonly scorecard: string;
  /** Strach [hráč 0, hráč 1] — ako veľmi sa starší bojí ktorého hráča. Verejné. */
  readonly strach: readonly [Stupen, Stupen];
  /** Reči [hráč 0, hráč 1] — 0 = žiadne, inak vždy vyššie ako strach toho hráča. Verejné. */
  readonly reci: readonly [Stupen, Stupen];
}

export function freshElder(elderId: string, karta: CardInstance, scorecard: string): ElderState {
  return { elderId, karta, scorecard, strach: [0, 0], reci: [0, 0] };
}

/**
 * Zmena markera (stopa na stupnici a účtenka, #95; v11): kto, ktorý marker, odkiaľ kam
 * a prečo. Markery sú verejné, preto aj ich zmeny — posielajú sa obom.
 */
export interface ZmenaMarkera {
  readonly elderId: string;
  /** Čí marker sa zmenil. */
  readonly hrac: PlayerId;
  readonly marker: DruhMarkera;
  readonly z: Stupen;
  readonly na: Stupen;
  /**
   * nakladacka = víťaz bitky dvíha strach, hadka = víťaz hádky dvíha reči, bodovanie = reči
   * po bodovaní klesli, zanik = reči zanikli pod dorastajúcim strachom, zajatie = neúspešný
   * pokus vynuloval strach, kseft = Predsedova vila, nastup = Kapybara.
   */
  readonly zdroj: "nakladacka" | "hadka" | "bodovanie" | "zanik" | "zajatie" | "kseft" | "nastup";
  /** Hráč, ktorého ťah či efekt zmenu spôsobil (Kapybara mení súperove reči). */
  readonly kto: PlayerId;
}

/**
 * Väzeň (v9, Michal 2026-10-30, §10): zajatý starší v priznaných kartách držiteľa —
 * „v pivnici“. Nedáva priazeň, držiteľ má jeho Kšeft a ráta sa mu ako červený strach
 * (v11, výhra strachom). Verejné.
 */
export interface Vazen {
  readonly elderId: string;
  readonly hrac: PlayerId;
  /** Poradie zajatia v celej partii (1 = prvý zajatý starší, nech ho zajal ktokoľvek). */
  readonly poradie: number;
  readonly karta: CardInstance;
  /** Scorecard (otočený — priazeň zanikla). */
  readonly scorecard: string;
  /** Miesto ukazovateľa v rade starších (poradie elders.json) — tam ostane prázdne miesto. */
  readonly miesto: number;
}

type Strach = Pick<ElderState, "strach">;
type Markery = Pick<ElderState, "strach" | "reci">;

/** Ako veľmi sa starší bojí hráča p (strach hráča p). */
export function strachZ(elder: Strach, p: PlayerId): Stupen {
  return elder.strach[p];
}

/** Reči hráča p pri staršom (0 = žiadne). */
export function reciZ(elder: Pick<ElderState, "reci">, p: PlayerId): Stupen {
  return elder.reci[p];
}

/** Hráč p desí staršieho naplno — strach na červenej. */
export function vydesil(elder: Strach, p: PlayerId): boolean {
  return elder.strach[p] === CERVENA;
}

/** Smie hráč p skúsiť zajať staršieho (v11): jeho strach je 3 — súperov nerozhoduje. */
export function pokusMozny(elder: Strach, p: PlayerId): boolean {
  return vydesil(elder, p);
}

/** Sila priazne staršieho pre hráča p: o koľko sa starší bojí súpera viac než jeho. */
export function priazenPre(elder: Strach, p: PlayerId): number {
  return Math.max(0, elder.strach[opponentOf(p)] - elder.strach[p]);
}

/** Hráč, ktorému starší dáva priazeň (null = strachy sú rovnaké). */
export function priazenHraca(elder: Strach): PlayerId | null {
  return elder.strach[0] === elder.strach[1] ? null : elder.strach[0] < elder.strach[1] ? 0 : 1;
}

/** Sila priazne — rozdiel strachov. */
export function priazenSila(elder: Strach): number {
  return Math.abs(elder.strach[0] - elder.strach[1]);
}

/** Stav staršieho (STAV_STARSIEHO) podľa vyššieho strachu. */
export function stupenStavu(elder: Strach): Stupen {
  return Math.max(elder.strach[0], elder.strach[1]) as Stupen;
}

/** Najvyšší marker hráča p pri staršom — reči, ak ich má (sú vždy nad strachom), inak strach. */
export function najvyssiMarker(elder: Markery, p: PlayerId): Stupen {
  return elder.reci[p] > elder.strach[p] ? elder.reci[p] : elder.strach[p];
}

/** Stupeň, za ktorý starší po bitke boduje hráčovi p: víťaz najvyšší marker, inak len reči. */
export function stupenNaBodovanie(elder: Markery, p: PlayerId, vyhral: boolean): Stupen {
  return vyhral ? najvyssiMarker(elder, p) : elder.reci[p];
}

/** Špaky za marker na stupni (žltá 1, oranžová 3, červená 5). */
export function spakyZaStupen(stupen: number): number {
  return KONSTANTY.SPAKY_ZA_STUPEN[stupen] ?? 0;
}

/** Špaky, ktoré starší dá hráčovi p po bitke, ktorú p vyhral (vyhral = true), alebo nie. */
export function spakyOdStarsieho(elder: Markery, p: PlayerId, vyhral: boolean): number {
  return spakyZaStupen(stupenNaBodovanie(elder, p, vyhral));
}

/** Cena dvihnutia markera zo stupňa `z` na `na` — súčet cien stupňov, do ktorých vstupuje (1 / 2 / 3). */
export function cenaDvihnutia(z: number, na: number): number {
  let cena = 0;
  for (let st = z + 1; st <= na; st++) cena += KONSTANTY.CENA_STUPNA[st] ?? 0;
  return cena;
}

/** Odkiaľ sa dvíha marker hráča p: strach od strachu, reči od vyššieho z rečí a strachu. */
export function stupenOdkial(elder: Markery, p: PlayerId, marker: DruhMarkera): Stupen {
  return marker === "strach" ? elder.strach[p] : najvyssiMarker(elder, p);
}

/**
 * Najvyšší stupeň, na ktorý smie hráč p marker zdvihnúť (v11): strach do červenej, reči
 * nad strachom do červenej — pri červenom strachu reči nie. null = dvíhať sa nedá.
 */
export function moznyZdvih(elder: Markery, p: PlayerId, marker: DruhMarkera): { readonly od: Stupen; readonly najviac: Stupen } | null {
  const od = stupenOdkial(elder, p, marker);
  return od >= CERVENA ? null : { od, najviac: CERVENA };
}

/** Starší s markerom hráča p zdvihnutým na stupeň `na` — strach na stupni rečí či nad nimi reči zruší. */
export function sMarkerom<E extends Markery>(elder: E, p: PlayerId, marker: DruhMarkera, na: Stupen): E {
  const strach: [Stupen, Stupen] = [elder.strach[0], elder.strach[1]];
  const reci: [Stupen, Stupen] = [elder.reci[0], elder.reci[1]];
  if (marker === "strach") strach[p] = na;
  else reci[p] = na;
  if (reci[p] <= strach[p]) reci[p] = 0;
  return { ...elder, strach, reci };
}

/** Reči hráča p o stupeň nižšie (po bodovaní, Kapybara) — na stupni strachu zaniknú. */
export function reciNizsie(elder: Markery, p: PlayerId): Stupen {
  const r = elder.reci[p];
  if (r === 0) return 0;
  const na = r - 1;
  return (na <= elder.strach[p] ? 0 : na) as Stupen;
}

/** Zdvihnutie markera jedného staršieho pri rozdelení (zámer klienta, v11): na ktorý stupeň. */
export interface Zdvih {
  readonly elderId: string;
  readonly na: Stupen;
}

/** Scorecard, na ktorom starší leží; chýbajúci je chyba dát, nie hry. */
export function scorecardStarsieho(data: GameData, elder: Pick<ElderState, "elderId" | "scorecard">): ScorecardDef {
  const sc = data.scorecards.find((x) => x.id === elder.scorecard);
  if (sc === undefined) throw new Error(`Chybné dáta: starší ${elder.elderId} leží na neznámom scorecarde ${elder.scorecard}`);
  return sc;
}

/** Priazeň, ktorú starší dáva — určuje ju jeho scorecard. */
export function favourStarsieho(data: GameData, elder: Pick<ElderState, "elderId" | "scorecard">): Favour {
  return scorecardStarsieho(data, elder).favour;
}

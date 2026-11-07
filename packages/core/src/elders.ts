// Starší, strach a reči (v11 Strach a reči, Michal 2026-11-02, docs/napady/strach-reci.html).
//
// Stupnica staršieho má stupne 0–3 (sivá, žltá, oranžová, červená). Každý hráč má pri
// každom staršom vlastné dva markery:
//  - strach 0–3: neklesá; dvíha ho víťaz
//    bitky Nakladačkou. Priazeň pre mňa = max(0, strach súpera − môj strach).
//  - reči: blok stupňov na teplomere súpera (v11.12, nižšie); dvíha ich víťaz hádky. Priazeň
//    nedávajú, bodujú aj porazenému.
// Väzeň (v9; v11.4 za 5 bodov Nakladačky): starší, ktorý sa hráča bojí na stupni 3, sa dá zajať;
// zajatý odchádza zo stupnice (GameState.vazni) a ráta sa ako červená svojho držiteľa (výhra strachom).
// Presvedčený (v11.4): ostáva na stupnici, jeho karta patrí presvedčovateľovi.
//
// v11.12 Reči na súperovom teplomere (Michal 2026-11-06): reči hráča p sú BLOK stupňov na teplomere
// SÚPERA (reciOd..reci). Stupeň má hodnotu 1 / 2 / 2 a špaky za neho dostane ten, kto ho drží: reči
// majú prednosť pred strachom. Obsadzuje sa od vrchu súperovho strachu nadol, potom nad ním; súper
// za obsadený stupeň platí o 1 viac a keď reči prekoná, blok sa posunie s jeho strachom. Klesajú
// zospodu a len tomu, kto prehral hádku.

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
  /** Karta staršieho — na ukazovateli, u presvedčeného v ruke, balíčku či línii presvedčovateľa. */
  readonly karta: CardInstance;
  /** Id scorecardu, na ktorom ukazovateľ leží (rozdaný pri príprave). */
  readonly scorecard: string;
  /** Strach [hráč 0, hráč 1] — ako veľmi sa starší bojí ktorého hráča. Verejné. */
  readonly strach: readonly [Stupen, Stupen];
  /**
   * Reči [hráč 0, hráč 1] — 0 = žiadne. v11.12: vrchný stupeň bloku hráča na teplomere súpera. Verejné.
   */
  readonly reci: readonly [Stupen, Stupen];
  /** Spodný stupeň bloku rečí [hráč 0, hráč 1], 0 = žiadne (v11.12). Verejné. */
  readonly reciOd: readonly [Stupen, Stupen];
  /**
   * Kto staršieho presvedčil (v11.4, §10): jeho karta natrvalo patrí tomuto hráčovi (hrá ju
   * ako ktorúkoľvek, bez efektu), starší ostáva na stupnici. Verejné; kde karta práve je, nie.
   */
  readonly presvedcil?: PlayerId;
}

export function freshElder(elderId: string, karta: CardInstance, scorecard: string): ElderState {
  return { elderId, karta, scorecard, strach: [0, 0], reci: [0, 0], reciOd: [0, 0] };
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
   * po bodovaní klesli, kseft = Predsedova vila, nastup = Kapybara, posun = súperov strach
   * prekonal reči a blok sa posunul (v11.12).
   */
  readonly zdroj: "nakladacka" | "hadka" | "bodovanie" | "kseft" | "nastup" | "posun";
  /** Spodok bloku rečí pred a po zmene (v11.12); vrch je v z a na, môže ostať rovnaký. */
  readonly odZ?: Stupen;
  readonly odNa?: Stupen;
  /** Hráč, ktorého ťah či efekt zmenu spôsobil (Kapybara mení súperove reči). */
  readonly kto: PlayerId;
}

/**
 * Väzeň (v9, Michal 2026-10-30, §10): zajatý starší v priznaných kartách držiteľa —
 * „v pivnici“. Nedáva priazeň, ráta sa držiteľovi ako červený strach (v11, výhra strachom)
 * a držiteľ smie raz za hru použiť jeho schopnosť (v11.2). Verejné.
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
  /** Schopnosť väzňa je minutá (v11.2) — väzeň ostáva v pivnici. */
  readonly pouzita?: true;
}

type Strach = Pick<ElderState, "strach">;
type Markery = Pick<ElderState, "strach" | "reci" | "reciOd">;

/** Blok rečí hráča p na teplomere súpera (v11.12): stupne od..vrch, null = žiadne. */
export function blokReci(e: Pick<ElderState, "reci" | "reciOd">, p: PlayerId): { readonly od: Stupen; readonly vrch: Stupen } | null {
  const vrch = e.reci[p];
  if (vrch === 0) return null;
  const od = e.reciOd[p];
  return { od: od === 0 ? vrch : od, vrch };
}

/** Leží na stupni st teplomera hráča p blok súperových rečí (v11.12)? */
export function obsadenyStupen(e: Pick<ElderState, "reci" | "reciOd">, p: PlayerId, st: number): boolean {
  const b = blokReci(e, opponentOf(p));
  return b !== null && st >= b.od && st <= b.vrch;
}

/**
 * Stupne, ktoré hráč p ešte môže obsadiť rečami, v záväznom poradí (v11.12): prvé reči idú na vrch
 * súperovho strachu, potom nadol a nakoniec nad neho; zo sivej zdola nahor. Blok ostáva súvislý.
 */
export function postupReci(e: Markery, p: PlayerId): readonly Stupen[] {
  const b = blokReci(e, p);
  const out: Stupen[] = [];
  const zaciatok = b === null ? Math.max(1, e.strach[opponentOf(p)]) : b.od - 1;
  for (let st = zaciatok; st >= 1; st--) out.push(st as Stupen);
  for (let st = (b === null ? zaciatok : b.vrch) + 1; st <= CERVENA; st++) out.push(st as Stupen);
  return out;
}

/** Reči hráča p slovom: „žltá“, „oranžová až červená“, „nič“. */
export function opisReci(e: Pick<ElderState, "reci" | "reciOd">, p: PlayerId): string {
  const b = blokReci(e, p);
  if (b === null) return "nič";
  return b.od === b.vrch ? NAZVY_ZON[b.vrch] : `${NAZVY_ZON[b.od]} až ${NAZVY_ZON[b.vrch]}`;
}

/** Má hráč p reči na celom súperovom teplomere? Podmienka presvedčenia (v11.12). */
export function plnyTeplomer(e: Pick<ElderState, "reci" | "reciOd">, p: PlayerId): boolean {
  const b = blokReci(e, p);
  return b !== null && b.od === 1 && b.vrch === CERVENA;
}

/** Súčet hodnôt stupňov od..vrch (1 / 2 / 2). */
function hodnotaStupnov(od: number, vrch: number): number {
  let n = 0;
  for (let st = od; st <= vrch; st++) n += KONSTANTY.HODNOTA_STUPNA[st] ?? 0;
  return n;
}

/** Špaky, ktoré dajú reči hráča p po každej bitke: hodnota stupňov, ktoré drží (v11.12). */
export function spakyZaReci(e: Pick<ElderState, "reci" | "reciOd">, p: PlayerId): number {
  const b = blokReci(e, p);
  return b === null ? 0 : hodnotaStupnov(b.od, b.vrch);
}

/** Špaky víťaza bitky za strach: jeho stupne bez tých, ktoré drží súper rečami (v11.12). */
export function spakyZaStrach(e: Markery, p: PlayerId): number {
  const b = blokReci(e, opponentOf(p));
  const zaStrach = spakyZaStupen(e.strach[p]);
  if (b === null) return zaStrach;
  return Math.max(0, zaStrach - hodnotaStupnov(b.od, Math.min(b.vrch, e.strach[p])));
}

/** Koľko bodov hádky je v rečiach hráča p pri staršom — krádež pri zajatí (v11.12). */
export function investovaneReci(e: Pick<ElderState, "reci" | "reciOd">, p: PlayerId): number {
  const b = blokReci(e, p);
  if (b === null) return 0;
  let n = 0;
  for (let st = b.od; st <= b.vrch; st++) n += KONSTANTY.CENA_STUPNA[st] ?? 0;
  return n;
}

/** Špaky, ktoré odovzdá súper tomu, kto staršieho zajme (najviac koľko má, stráži volajúci). */
export function kradezZaZajatie(e: Markery, zlodej: PlayerId): number {
  const su = opponentOf(zlodej);
  return investovaneReci(e, su);
}

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

/**
 * Stupeň, za ktorý starší po bitke boduje hráčovi p (v11.12): vrch rečí, ak ich má, inak víťazov
 * strach (popis v súhrne, špaky ráta spakyOdStarsieho).
 */
export function stupenNaBodovanie(elder: Markery, p: PlayerId, vyhral: boolean): Stupen {
  return elder.reci[p] > 0 ? elder.reci[p] : vyhral ? elder.strach[p] : 0;
}

/** Špaky za marker na stupni (žltá 1, oranžová 3, červená 5). */
export function spakyZaStupen(stupen: number): number {
  return KONSTANTY.SPAKY_ZA_STUPEN[stupen] ?? 0;
}

/**
 * Špaky, ktoré starší dá hráčovi p po bitke, ktorú p vyhral (vyhral = true), alebo nie.
 * v11.12: reči bodujú vždy, strach len víťazovi a bez stupňov, ktoré drží súper rečami.
 * Nahrádza krátenie z v11.11.
 */
export function spakyOdStarsieho(elder: Markery, p: PlayerId, vyhral: boolean): number {
  return spakyZaReci(elder, p) + (vyhral ? spakyZaStrach(elder, p) : 0);
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

/** Krok zdvihu markera: na ktorý stupeň a koľko to stojí spolu od terajšieho stavu. */
export interface KrokZdvihu {
  readonly na: Stupen;
  readonly cena: number;
}

/**
 * Stupne, na ktoré smie hráč p marker zdvihnúť, v poradí s cenou od terajšieho stavu. Prázdne =
 * dvíhať sa nedá. Strach: nahor, stupeň so súperovými rečami je o REC_PRIRAZKA drahší (v11.12).
 * Reči: podľa postupReci; v zdvihu je `na` stupeň, po ktorý sa v tomto poradí obsadzuje.
 */
export function krokyZdvihu(e: Markery, p: PlayerId, marker: DruhMarkera): readonly KrokZdvihu[] {
  const out: KrokZdvihu[] = [];
  let cena = 0;
  const stupne: readonly number[] =
    marker === "reci"
      ? postupReci(e, p)
      : [1, 2, 3].filter((st) => st > stupenOdkial(e, p, marker));
  for (const st of stupne) {
    cena += (KONSTANTY.CENA_STUPNA[st] ?? 0) + (marker === "strach" && obsadenyStupen(e, p, st) ? KONSTANTY.REC_PRIRAZKA : 0);
    out.push({ na: st as Stupen, cena });
  }
  return out;
}

/** Cena zdvihu markera na stupeň `na`, alebo null, keď tam zdvih nejde. */
export function cenaZdvihu(e: Markery, p: PlayerId, marker: DruhMarkera, na: number): number | null {
  return krokyZdvihu(e, p, marker).find((k) => k.na === na)?.cena ?? null;
}

/** Starší s markerom hráča p zdvihnutým na stupeň `na` — strach prekoná reči, reči obsadia stupne. */
export function sMarkerom<E extends Markery>(elder: E, p: PlayerId, marker: DruhMarkera, na: Stupen): E {
  const strach: [Stupen, Stupen] = [elder.strach[0], elder.strach[1]];
  const reci: [Stupen, Stupen] = [elder.reci[0], elder.reci[1]];
  const reciOd: [Stupen, Stupen] = [elder.reciOd[0], elder.reciOd[1]];
  if (marker === "strach") {
    strach[p] = na;
    const su = opponentOf(p);
    const b = blokReci(elder, su);
    // Prekonané reči idú so strachom hore: spodný stupeň zanikne, počet stupňov ostáva.
    if (b !== null && na > b.vrch) {
      reci[su] = na;
      reciOd[su] = Math.max(1, na - (b.vrch - b.od)) as Stupen;
    }
  } else {
    const b = blokReci(elder, p);
    let od: number = b?.od ?? CERVENA;
    let vrch: number = b?.vrch ?? 0;
    for (const st of postupReci(elder, p)) {
      od = Math.min(od, st);
      vrch = Math.max(vrch, st);
      if (st === na) break;
    }
    reci[p] = vrch as Stupen;
    reciOd[p] = od as Stupen;
  }
  return { ...elder, strach, reci, reciOd };
}

/** Reči hráča p o stupeň nižšie (Kapybara, bodovanie): vrch po poklese. v11.12 zospodu, vrch ostáva. */
export function reciNizsie(elder: Markery, p: PlayerId): Stupen {
  const b = blokReci(elder, p);
  return b !== null && b.od < b.vrch ? b.vrch : 0;
}

/** Spodok bloku po poklese rečí (v11.12); 0 = reči zanikli. */
export function reciOdNizsie(elder: Pick<ElderState, "reci" | "reciOd">, p: PlayerId): Stupen {
  const b = blokReci(elder, p);
  return b !== null && b.od < b.vrch ? ((b.od + 1) as Stupen) : 0;
}

/** Starší s rečami hráča p o stupeň nižšie (náhľad Kapybary). */
export function sReciNizsie<E extends Markery>(elder: E, p: PlayerId): E {
  const reci: [Stupen, Stupen] = [elder.reci[0], elder.reci[1]];
  reci[p] = reciNizsie(elder, p);
  const reciOd: [Stupen, Stupen] = [elder.reciOd[0], elder.reciOd[1]];
  reciOd[p] = reciOdNizsie(elder, p);
  return { ...elder, reci, reciOd };
}

/** Ďalší stupeň rečí pri Kšefte Predsedovej vily, alebo null, keď už nie je kam. */
export function dalsiStupenReci(elder: Markery, p: PlayerId): Stupen | null {
  return krokyZdvihu(elder, p, "reci")[0]?.na ?? null;
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

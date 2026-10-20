// Motor kola (M6): stavový automat
//
//   Voľba cieľa → [Draft] → (Zhromaždenie → Pitka) × N → Bitka → ďalšie kolo
//
// apply(state, cmd, hrac) je jediné miesto, kde sa stav mení. Vracia NOVÝ
// stav + udalosti; starý stav nemutuje (vnútri pracuje na hlbokej kópii).
// Klient posiela zámery, server počíta — všetko tu je deterministické.
//
// Rozhodnutia pri nejasných pravidlách sú vypísané v README (sekcia
// „Rozhodnuté nejasnosti“) a označené v komentároch ako [R#].

import type { CardDef, CardInstance, Phase, PlayerId, Tag } from "./types.ts";
import { opponentOf } from "./types.ts";
import type { GameData } from "./data.ts";
import { defOf } from "./data.ts";
import type { RngState } from "./rng.ts";
import { rngInt, rngSeed, rngShuffle } from "./rng.ts";
import type { ActionSums, KartaVBitke, LineState, PlacedCard } from "./partia.ts";
import { evaluateLine, prispevkyKariet } from "./partia.ts";
import type { PlayerState } from "./player.ts";
import {
  cenaBarteru,
  freshPlayer,
  hodnotaViery,
  makkeNadDlhy,
  prahCirhozy,
  prahDlhu,
  prahExekutora,
  textNeresti,
  velkostBalicka,
} from "./player.ts";
import type { BattleSide, DamageResult } from "./battle.ts";
import { battleOutcome, computeDamage, dlhyPoExekucii, exekutorCheck } from "./battle.ts";
import type { ElderState, MarkerPos } from "./elders.ts";
import {
  bitkaOStarsiehoMozna,
  freshElder,
  posunMarker,
  prebudenyPre,
  priazenHraca,
  priazenSila,
  vydesil,
  elderScore,
  favourStarsieho,
} from "./elders.ts";
import type { DlzkaHry } from "./constants.ts";
import { ALL_DLZKY, DLZKY_HRY, KONSTANTY, PREDVOLENA_DLZKA } from "./constants.ts";
import {
  doliatieZakazane,
  bitkaMody,
  barterZlavaLokality,
  bezLimituPracujuci,
  cenaPrebytku,
  dedicstvoZaPrehru,
  efektHraca,
  efektPotlaceny,
  exekutorLokality,
  jeCielLokalita,
  jeEfektManual,
  lenVlastnaStrana,
  limitZhromazdenia,
  naexZaPitku,
  opakovanePohorsenie,
  pohorseniaNeplatia,
  pohorsenieNaKraj,
  prebytokProtiZlava,
  prahCirhozyBonus,
  spolocnyLimit,
  vykupZoSrotu,
  zakazFajcit,
  zakazNaex,
  zakazVypit,
  vDedicstve,
  partiaHraca,
  vPartii,
} from "./effects.ts";
import type { VerejnyHrac, VerejnyStav } from "./effects.ts";
import type { Favour } from "./types.ts";

// ---------------------------------------------------------------------------
// Stav

export interface CielKola {
  readonly typ: "lokalita" | "starsi";
  /**
   * Karta v strede línie: lokalita aktuálneho kola, v bitke o staršieho
   * karta staršieho (Michal 2026-10-12) — jej akcie na spojoch dostane
   * majiteľ susednej karty ako pri lokalite.
   */
  readonly lokalita: CardInstance | null;
  readonly elderId: string | null;
}

/** Výber hráča v jednom kroku stavby šenku (uid z jeho balíčka stavby). */
export interface VyberStavby {
  readonly doSenku: readonly number[];
  readonly odhod: readonly number[];
}

/**
 * Draft (Michal 2026-10-12): najprv hráči šenok postavia — z balíčkov, ktoré
 * si podávajú, naraz dávajú karty do šenku a naspodok spoločného balíčka
 * (Michal 2026-10-19: po dvoch, aby stavba mala len dva kroky) — potom
 * z neho striedavo berú, začína útočník.
 */
export interface DraftStav {
  readonly krok: "stavba" | "beranie";
  /** Balíčky stavby v rukách hráčov — TAJNÉ, každý vidí len svoj (viewFor). */
  readonly balicky: readonly [readonly CardInstance[], readonly CardInstance[]];
  /** Výbery v aktuálnom kroku stavby — TAJNÉ, kým nevyberú obaja. */
  readonly vyber: readonly [VyberStavby | null, VyberStavby | null];
  /** Kto berie zo šenku (krok „beranie“). */
  readonly naTahu: PlayerId;
  /** Hráč už nič neberie (prestal, alebo šenok je prázdny). */
  readonly hotovo: readonly [boolean, boolean];
  readonly noveKarty: readonly [number, number];
}

export interface ZhromazdenieStav {
  readonly naTahu: PlayerId;
  readonly zostavaLimit: readonly [number, number];
  readonly pasoval: readonly [boolean, boolean];
  /** Koľko ďalších vyložení hráč ešte zahrá bez odovzdania ťahu (Vypiť). */
  readonly navyse: readonly [number, number];
  /** Zastávka: limit je spoločný — každé vyloženie či vypitie ho uberie obom. */
  readonly spolocny?: boolean;
}

export interface PitkaStav {
  readonly naTahu: PlayerId;
  readonly hotovy: readonly [boolean, boolean];
  readonly naexPouzity: readonly [boolean, boolean];
  /** Cigarety vyfajčené v tejto pitke (každá už dala kartu). */
  readonly fajcenie: readonly [number, number];
  /**
   * Hráč, ktorý práve smie na súperovo NA EX odpovedať vyložením jednej
   * karty z ruky mimo limitu (Michal 2026-10-12). Potom je na ťahu znova
   * ten, kto NA EX dal.
   */
  readonly reakcia: PlayerId | null;
  /** Poštárka a Starosta sa smú použiť raz za Pitku. */
  readonly postarka: readonly [boolean, boolean];
  readonly starosta: readonly [boolean, boolean];
  /** Koľko NA EX hráč v tejto Pitke dal (Vínna pivnica dovolí dve). */
  readonly naexPocet?: readonly [number, number];
  /** Zberný dvor: výkup karty z odhadzovacieho balíčka už v tejto Pitke použitý. */
  readonly vykup?: readonly [boolean, boolean];
}

export type BitkaKrok =
  | "benzinka"
  | "exekutor"
  | "pohorsenie"
  | "prebytok"
  | "nahrada"
  | "vestica"
  | "liecba"
  | "cintorin"
  | "zberatel";

export interface BitkaStav {
  readonly krok: BitkaKrok | null;
  /** Hráč, ktorého rozhodnutie sa čaká (null = automatika beží). */
  readonly caka: PlayerId | null;
  readonly sums: readonly [ActionSums, ActionSums];
  readonly exekutorHotovy: readonly [boolean, boolean];
  readonly pohorsenieZostava: readonly [number, number];
  /** Markery posunuté Pohoršením v tejto bitke — každý najviac raz. */
  readonly pohnuteMarkery: readonly string[];
  readonly damage: DamageResult | null;
  readonly vitaz: PlayerId | null;
  readonly prebytokDrzi: PlayerId | null;
  readonly prebytokZostava: number;
  /** Starší posunutí prebytkom v tejto bitke — súper držiteľa za nich dostane cigarety. */
  readonly prebytokPosunute: readonly string[];
  readonly liecbaHotova: readonly [boolean, boolean];
  /** Benzínka: koľko svojich Občanov z línie má hráč ešte zahodiť. */
  readonly benzinkaZostava: readonly [number, number];
  /** Benzínka: lokalitu nikto nevyhrá, prepadne. */
  readonly lokalitaPrepadne: boolean;
  /** Karty z línie, ktoré sa po bitke spália namiesto návratu (Dievčina na vydaj). */
  readonly spalit: readonly number[];
  readonly vesticaHotova: boolean;
  readonly zberatelHotovy: readonly [boolean, boolean];
  /** Cintorín: porazený už rozhodol o Nástroji do Dedičstva. */
  readonly cintorinHotovy?: boolean;
  /**
   * Zberateľ (Michal 2026-10-19): vrchné karty doberacieho balíčka, z ktorých
   * si hráč vyberá — TAJNÉ, viewFor posiela len vlastnú ponuku.
   */
  readonly zberatelPonuka: readonly [readonly CardInstance[], readonly CardInstance[]];
}

export interface OvladnutaLokalita {
  readonly karta: CardInstance;
  readonly hrac: PlayerId;
}

export interface KoniecHry {
  readonly vitaz: PlayerId | null;
  readonly dovod: string;
  readonly body: readonly [number, number] | null;
}

export interface GameState {
  readonly rng: RngState;
  readonly nextUid: number;
  readonly faza: Phase;
  readonly kolo: number;
  readonly utocnik: PlayerId;
  readonly hraci: readonly [PlayerState, PlayerState];
  readonly spolocnyBalicek: readonly CardInstance[];
  readonly senok: readonly CardInstance[];
  readonly lokalityVHre: readonly CardInstance[];
  /** Počet lokalít, o ktoré sa hrá (dĺžka hry). */
  readonly lokalitCelkom: number;
  readonly ovladnute: readonly OvladnutaLokalita[];
  /** Lokality, ktoré nikto nevyhral (Benzínka) — z hry vypadli. */
  readonly prepadnute: readonly CardInstance[];
  /** Hráč dal v tomto kole NA EX (Krčmárka). */
  readonly naexVKole: readonly [boolean, boolean];
  readonly starsi: readonly ElderState[];
  readonly ciel: CielKola | null;
  readonly lokalitaOtocena: boolean;
  readonly strany: readonly [readonly PlacedCard[], readonly PlacedCard[]];
  /**
   * Pitiek v bitke (Michal 2026-10-19): 1 + menší z počtov aktivovaných
   * akcií karty v strede na jej dvoch stranách. Mení sa s líniou počas kola,
   * nikdy však neklesne pod už začaté Pitky.
   */
  readonly pitkyCelkom: number;
  readonly pitkaCislo: number;
  /** Nástroje vyložené do Dedičstva za celú hru oboma hráčmi — určuje cenu ďalšieho. */
  readonly dedicstvaVylozene: number;
  /** Cirhózy získané v tomto kole (efekt Čiernej mačky). */
  readonly cirhozyVKole: readonly [number, number];
  readonly draftStav: DraftStav | null;
  readonly zhromazdenieStav: ZhromazdenieStav | null;
  readonly pitkaStav: PitkaStav | null;
  readonly bitkaStav: BitkaStav | null;
  readonly koniec: KoniecHry | null;
  /**
   * Vízia na konci Pitky (Michal 2026-10-19): koľko vrchných kariet ešte hráč
   * prezrie a rozhodne, či si ich vezme do ruky, alebo zahodí. null = nič.
   */
  readonly vizia: { readonly zostava: readonly [number, number] } | null;
  /**
   * Ohlásené vydesenie (Michal 2026-10-16): kolo, v ktorom hráč vydesil
   * polovicu starších. Vyhrá, ak ich udrží do konca nasledujúceho kola.
   */
  readonly ohlaseneVydesenie: readonly [number | null, number | null];
}

type DeepMutable<T> = { -readonly [K in keyof T]: DeepMutable<T[K]> };
type MutState = DeepMutable<GameState>;

// ---------------------------------------------------------------------------
// Príkazy a udalosti

export type Command =
  | { readonly type: "chooseLocation"; readonly uid: number; readonly otocena: boolean }
  // Karta staršieho leží v strede línie; útočník ju natočí ako lokalitu.
  | { readonly type: "chooseElder"; readonly elderId: string; readonly otocena: boolean }
  // Stavba šenku: z vlastného balíčka stavby karty do šenku a karty naspodok (po dvoch).
  | { readonly type: "stavbaSenku"; readonly doSenku: readonly number[]; readonly odhod: readonly number[] }
  // Branie zo šenku: 1 karta za cigaretu, 2 karty za 3 cigarety (KONSTANTY.CENA_SENKU), alebo koniec brania.
  | { readonly type: "draftBer"; readonly uids: readonly number[] }
  | { readonly type: "draftStop" }
  | { readonly type: "place"; readonly uid: number; readonly target: CielVykladania }
  | { readonly type: "pass" }
  | { readonly type: "naex"; readonly uid: number }
  | { readonly type: "skipNaex" }
  // Reakcia na súperovo NA EX: „place“ (jedna karta do línie) alebo nič.
  | { readonly type: "bezReakcie" }
  // Poštárka (Pitka): dober 1 až 2 karty navyše a s nimi 1 Dlh.
  | { readonly type: "postarka"; readonly pocet: number }
  // Starosta (Pitka): za cigaretu vymeň kartu z ruky za kartu zo šenku.
  | { readonly type: "starosta"; readonly rukaUid: number; readonly senokUid: number }
  // Benzínka: vlastní Občania z línie, ktorí sa zahodia.
  | { readonly type: "benzinka"; readonly uids: readonly number[] }
  // Veštica (Prehra): poradové čísla v odhalených doberacích balíčkoch.
  | { readonly type: "vestica"; readonly moja: number; readonly jeho: number }
  // Zberateľ po bitke: karty, ktoré si hráč z ponuky vezme do ruky (uid z ponuky).
  | { readonly type: "zberatel"; readonly uids: readonly number[] }
  // Vízia na konci Pitky: vrchnú kartu doberacieho balíčka do ruky (true), alebo zahodiť (false).
  | { readonly type: "vizia"; readonly vziat: boolean }
  // Zberný dvor (Pitka): za cigaretu karta z vlastného odhadzovacieho balíčka do ruky.
  | { readonly type: "vykup"; readonly uid: number }
  // Cintorín (Prehra): Nástroj z ruky do Dedičstva zadarmo, alebo nič (uid null).
  | { readonly type: "cintorin"; readonly uid: number | null }
  | { readonly type: "smoke"; readonly pocet: number }
  | { readonly type: "barter" }
  | { readonly type: "refillPoldeci" }
  // Rozhodnutia siahajúce do vlastného balíčka sa zadávajú cez defId + kde,
  // nie cez uid: klient uid kariet v doberacom balíčku nikdy nevidí.
  | { readonly type: "exekutorTool"; readonly defId: string; readonly kde: KartaZdroj }
  | { readonly type: "pohorsenie"; readonly elderId: string }
  | { readonly type: "prebytok"; readonly elderId: string }
  | {
      readonly type: "liecba";
      readonly cirhozaUid: number;
      readonly zavislyUid: number;
      readonly senokUid: number;
    }
  | { readonly type: "pohreb"; readonly cirhozaUid: number; readonly kartaUid: number }
  | { readonly type: "skipLiecba" }
  | {
      readonly type: "nahrada";
      readonly defId: string;
      readonly kde: KartaZdroj;
      readonly marker: MarkerPos;
    }
  // Vypiť (pravidlá v3): v Zhromaždení otoč plný poldeci na vypitý — limit
  // klesne o 1, ale ďalšou kartou ťah nekončí (zahráš dve za sebou).
  | { readonly type: "vypit" }
  // Celý ťah v Zhromaždení naraz (Michal 2026-10-19): klient pošle priznania,
  // vyloženia a pred každou ďalšou kartou Vypiť — vykoná sa všetko, alebo nič.
  | { readonly type: "tah"; readonly kroky: readonly Command[] }
  // Vzdať sa smie hráč kedykoľvek, aj mimo svojho ťahu. Kontumáciu (súper
  // dlho odpojený) posiela za odpojeného hráča server.
  | { readonly type: "vzdat"; readonly kontumacia?: boolean };

export type KartaZdroj = "ruka" | "doberaci" | "odhadzovaci" | "dedicstvo";

/** Kam možno v Zhromaždení vyložiť kartu z ruky. */
export type CielVykladania = "vlastna" | "superova" | "priznanie" | "dedicstvo";

export type Event =
  | { readonly type: "log"; readonly text: string; readonly pre?: PlayerId }
  | { readonly type: "faza"; readonly faza: Phase }
  | {
      readonly type: "kartyTahane";
      readonly hrac: PlayerId;
      readonly karty: readonly CardInstance[];
      readonly pre: PlayerId;
    }
  | { readonly type: "tahal"; readonly hrac: PlayerId; readonly pocet: number }
  | {
      readonly type: "manualEfekt";
      readonly defId: string;
      readonly nazov: string;
      readonly text: string;
      readonly hrac: PlayerId | null;
    }
  | {
      readonly type: "bitkaVysledok";
      readonly damage: DamageResult;
      /** Súčty aktívnych akcií oboch partií (línia je verejná) — štatistiky. */
      readonly sums: readonly [ActionSums, ActionSums];
      /** null = remíza v bitke o staršieho (starší ostáva). */
      readonly vitaz: PlayerId | null;
      readonly prebytok: number;
      readonly prebytokDrzi: PlayerId | null;
      /** Karty v línii pri vyhodnotení (verejné) — štatistiky kariet pre tvorcu. */
      readonly karty: readonly KartaVBitke[];
    }
  /** Poškodenie pečene započítané k prahu Cirhózy — štatistiky. */
  | { readonly type: "pecen"; readonly hrac: PlayerId; readonly mnozstvo: number }
  | {
      readonly type: "koniec";
      readonly vitaz: PlayerId | null;
      readonly dovod: string;
      readonly body: readonly [number, number] | null;
    };

/** Udalosti pre konkrétneho hráča — súkromné (pre) vidí len adresát. */
export function eventsFor(events: readonly Event[], hrac: PlayerId): Event[] {
  return events.filter((e) => !("pre" in e) || e.pre === undefined || e.pre === hrac);
}

export class IllegalCommandError extends Error {}

function need(cond: boolean, msg: string): asserts cond {
  if (!cond) throw new IllegalCommandError(msg);
}

// ---------------------------------------------------------------------------
// Pomocníci

function obranca(s: { utocnik: PlayerId }): PlayerId {
  return opponentOf(s.utocnik);
}

/**
 * Bonus z priazne daného typu pre hráča p: NASOBOK_PRIAZNE × sila (2 / 4 / 6),
 * 0, ak ju má súper alebo nikto.
 */
export function priazen(
  data: GameData,
  state: { readonly starsi: readonly ElderState[] },
  favour: Favour,
  p: PlayerId,
): number {
  for (const elder of state.starsi) {
    // Priazeň dáva ukazovateľ (scorecard), nie karta, ktorá na ňom leží —
    // aj po náhrade staršieho.
    if (favourStarsieho(data, elder) === favour && priazenHraca(elder) === p) return KONSTANTY.NASOBOK_PRIAZNE * priazenSila(elder);
  }
  return 0;
}

function hrac(s: MutState, p: PlayerId): DeepMutable<PlayerState> {
  return s.hraci[p] as DeepMutable<PlayerState>;
}

function cielLokalita(s: GameState): CardInstance | null {
  return s.ciel?.typ === "lokalita" ? (s.ciel.lokalita ?? null) : null;
}

/** defId lokality, o ktorú sa hrá — null v bitke o staršieho (aj pre klienta). */
export function cielLokalitaId(s: Pick<VerejnyStav, "ciel">): string | null {
  return s.ciel?.typ === "lokalita" ? (s.ciel.lokalita?.defId ?? null) : null;
}

/**
 * Línia zo stavu — server aj klienti (ClientState spĺňa VerejnyStav), aby
 * náhľady rátali s tým istým ako bitka (aj s Pascou v Dedičstve).
 */
export function lineState(s: VerejnyStav & { readonly lokalitaOtocena: boolean }): LineState {
  return {
    // V bitke o staršieho leží v strede karta staršieho.
    lokalita: s.ciel?.lokalita ?? null,
    lokalitaOtocena: s.lokalitaOtocena,
    strany: s.strany,
  };
}

/** Efekt karty defId patrí hráčovi p a nie je umlčaný (Praudovravec). */
function maEfekt(s: MutState, data: GameData, p: PlayerId, defId: string): boolean {
  return efektHraca(s as GameState, p, defId) && !efektPotlaceny(data, s as GameState, p, defId);
}

/**
 * Hrobár: keď súper zahodí kartu (z ruky alebo z línie, efektom či limitom
 * ruky — nie návratom po bitke), majiteľ Hrobára si dobere cigaretu za kus.
 */
function poZahodeni(s: MutState, data: GameData, p: PlayerId, pocet: number, events: Event[]): void {
  if (pocet <= 0) return;
  const opp = opponentOf(p);
  if (!maEfekt(s, data, opp, "hrobar")) return;
  hrac(s, opp).cigarety += pocet;
  events.push({ type: "log", text: `Hrobár: hráč ${opp + 1} si berie ${pocet} cigariet za zahodené karty.` });
}

function tagOf(data: GameData, card: CardInstance): readonly Tag[] {
  return defOf(data, card).tags;
}

function najdiVLinii(s: MutState, uid: number): { strana: PlayerId; index: number } | null {
  for (const p of [0, 1] as const) {
    const i = s.strany[p].findIndex((pl) => pl.card.uid === uid);
    if (i !== -1) return { strana: p, index: i };
  }
  return null;
}

function vezmiZRuky(s: MutState, p: PlayerId, uid: number): CardInstance {
  const idx = hrac(s, p).ruka.findIndex((k) => k.uid === uid);
  need(idx !== -1, "Karta nie je v ruke.");
  return hrac(s, p).ruka.splice(idx, 1)[0] as CardInstance;
}

/** Nová inštancia karty s náhodným variantom. */
function novaInstancia(s: MutState, data: GameData, defId: string): CardInstance {
  const def = data.cards.get(defId);
  if (def === undefined) throw new Error(`Neznáma karta ${defId}`);
  const variants = data.variants.get(defId);
  if (variants === undefined) throw new Error(`Bez variantov ${defId}`);
  const [li, r1] = rngInt(s.rng, variants.left.length);
  const [ri, r2] = rngInt(r1, variants.right.length);
  s.rng = r2;
  return { uid: s.nextUid++, defId, leftLayout: li, rightLayout: ri };
}

/** Ťahanie z vlastného doberacieho balíčka, s premiešaním odhadzovacieho. */
function tahaj(s: MutState, p: PlayerId, pocet: number, events: Event[]): CardInstance[] {
  const player = hrac(s, p);
  const tahane: CardInstance[] = [];
  for (let i = 0; i < pocet; i++) {
    if (player.doberaci.length === 0 && player.odhadzovaci.length > 0) {
      const [premiesane, rng] = rngShuffle(s.rng, player.odhadzovaci);
      s.rng = rng;
      player.doberaci = premiesane as DeepMutable<CardInstance>[];
      player.odhadzovaci = [];
    }
    const karta = player.doberaci.shift();
    if (karta === undefined) break;
    player.ruka.push(karta);
    tahane.push(karta as CardInstance);
  }
  if (tahane.length > 0) {
    events.push({ type: "tahal", hrac: p, pocet: tahane.length });
    events.push({ type: "kartyTahane", hrac: p, karty: tahane, pre: p });
  }
  return tahane;
}

/**
 * Pridá kliatbu (dlh / cirhoza) do ODHADZOVACIEHO balíčka hráča — do ruky
 * príde, až keď si ju dobere (PRAVIDLA §12). Balíček zaneráda, ruku nie.
 */
function pridajKliatbu(s: MutState, data: GameData, p: PlayerId, defId: string, events: Event[]): void {
  const karta = novaInstancia(s, data, defId);
  hrac(s, p).odhadzovaci.push(karta as DeepMutable<CardInstance>);
  events.push({ type: "log", text: `Hráč ${p + 1} získava kartu ${defId === "dlh" ? "Dlh" : defId === "cirhoza" ? "Cirhóza" : "Absťák"}.` });
}

/** Poškodenie pečene + okamžitá Cirhóza pri prahu (PRAVIDLA §7 krok 3). */
function pridajPecen(
  s: MutState,
  data: GameData,
  p: PlayerId,
  mnozstvo: number,
  events: Event[],
): void {
  if (mnozstvo <= 0) return;
  hrac(s, p).pecen += mnozstvo;
  events.push({ type: "pecen", hrac: p, mnozstvo });
  skontrolujPrahPecene(s, data, p, events);
}

/** Cirhóza za každý dosiahnutý prah pečene — počíta sa len počas Pitky. */
function skontrolujPrahPecene(s: MutState, data: GameData, p: PlayerId, events: Event[]): void {
  const player = hrac(s, p);
  // ihrisko (Furt) a nealko (Dedičstvo): prah Cirhózy je vyšší.
  const prah =
    prahCirhozy(priazen(data, s as GameState, "ALKOHOLIK", p)) + prahCirhozyBonus(s as GameState, p);
  while (player.pecen >= prah) {
    player.pecen -= prah;
    pridajKliatbu(s, data, p, "cirhoza", events);
    s.cirhozyVKole[p] += 1;
    events.push({ type: "log", text: `Hráč ${p + 1} dosiahol prah pečene (${prah}) — Cirhóza.` });
  }
}

/** Zadĺženie z akcií Dlh + karta Dlh pri prahu (rovnako ako pečeň a Cirhóza). */
function pridajZadlzenie(s: MutState, data: GameData, p: PlayerId, mnozstvo: number, events: Event[]): void {
  if (mnozstvo <= 0) return;
  const player = hrac(s, p);
  player.zadlzenie += mnozstvo;
  const prah = prahDlhu();
  while (player.zadlzenie >= prah) {
    player.zadlzenie -= prah;
    pridajKliatbu(s, data, p, "dlh", events);
    events.push({ type: "log", text: `Hráč ${p + 1} dosiahol prah dlhu (${prah}) — Dlh.` });
  }
}

function pocetKariet(player: VerejnyHrac, defId: string, kde: "priznane"): number {
  return player[kde].filter((k) => k.defId === defId).length;
}

/** Absťáky hráča mimo ruky: priznané aj vyložené v partiách (jeho karty). */
export function verejneAbstaky(s: VerejnyStav, p: PlayerId): number {
  let n = s.hraci[p].priznane.filter((k) => k.defId === "abstak").length;
  for (const partia of s.strany) {
    for (const pl of partia) if (pl.playedBy === p && pl.card.defId === "abstak") n++;
  }
  return n;
}

/** O koľko Absťáky znížia hráčovi tuhé poškodenie v bitke (Autobusár jeden ignoruje). */
export function abstakyVBitke(data: GameData, s: VerejnyStav, p: PlayerId, vRuke: number): number {
  return Math.max(0, verejneAbstaky(s, p) + vRuke - bitkaMody(data, s, p).abstakyZlava);
}

/** Cirhózy hráča p vyložené v línii (jeho karty = jeho postihy). */
function cirhozyVPartii(s: VerejnyStav, p: PlayerId): number {
  return partiaHraca(s, p).filter((pl) => pl.card.defId === "cirhoza").length;
}

/**
 * Poškodenie bitky zo súčtov aktívnych akcií (PRAVIDLA §8.3). Server ho
 * volá pri vyhodnotení, klient pre živý odhad nad aktuálnou líniou.
 * Absťáky v ruke sú tajné — klient pozná len svoje, súperove dá 0.
 */
export function poskodenieBitky(
  data: GameData,
  s: VerejnyStav,
  sums: readonly [ActionSums, ActionSums],
  abstakyVRuke: readonly [number, number],
): DamageResult {
  return computeDamage(stranyBitky(data, s, sums, abstakyVRuke));
}

function stranyBitky(
  data: GameData,
  s: VerejnyStav,
  sums: readonly [ActionSums, ActionSums],
  abstakyVRuke: readonly [number, number],
): [BattleSide, BattleSide] {
  const mody = ([0, 1] as const).map((p) => bitkaMody(data, s, p));
  const strana = (p: PlayerId): BattleSide => {
    const opp = opponentOf(p);
    // farár súpera časť Povier ignoruje.
    const povera = Math.max(0, (sums[p].Povera ?? 0) - mody[opp]!.superovePoveryZlava);
    return {
      sums: { ...sums[p], Povera: povera },
      cirhozaBonus: Math.max(0, cirhozyVPartii(s, opp) - mody[p]!.cirhozaZlava),
      tuheBonus: mody[p]!.tuheBonus,
      tuheZlava: mody[p]!.tuheZlava,
      // Neprajník: Povery smú nad súperove priznané Dlhy; čierna mačka: bez stropu.
      makkeNadDlhy: vPartii(s, p, "cierna_macka") ? Number.POSITIVE_INFINITY : makkeNadDlhy(priazen(data, s, "NEPRAJNIK", p)),
      abstaky: abstakyVBitke(data, s, p, abstakyVRuke[p]),
      priznaneDlhy: pocetKariet(s.hraci[p], "dlh", "priznane"),
      priazenBitkara: priazen(data, s, "BITKAR", p),
      // svaty_text (Dedičstvo): hodnota tvojej Viery je vyššia.
      hodnotaViery:
        hodnotaViery(priazen(data, s, "VERIACI", p)) + (vDedicstve(s, p, "svaty_text") ? KONSTANTY.EFEKT.SVATY_TEXT_VIERA : 0),
    };
  };
  return [strana(0), strana(1)];
}

/** Položka rozpisu poškodenia: zdroj (id karty, priazne či pojmu) a o koľko mení hodnotu. */
export interface PolozkaRozpisu {
  readonly zdroj: string;
  readonly hodnota: number;
}

/**
 * Rozpis poškodenia hráča — z čoho sa skladá tuhé a mäkké poškodenie (Michal
 * 2026-10-20: každá prírastok a úbytok má byť v paneli bitky vidno).
 */
export interface RozpisPoskodenia {
  /** Rana ×1 + Pecka ×2 + Petelica ×3. */
  readonly zAkcii: number;
  /** Tuhé navyše (karty, lokalita, priazeň Bitkára, súperove Cirhózy). */
  readonly bonusy: readonly PolozkaRozpisu[];
  /** Tuhé menej (súperova nezrušená Viera, vlastné Absťáky) — hodnoty kladné. */
  readonly zrazky: readonly PolozkaRozpisu[];
  /** Hodnota jednej mojej Viery (1 + priazeň Veriaceho + Svätý text). */
  readonly hodnotaViery: number;
  /** Moja Viera, ktorú zrušili súperove Povery, a moje Povery zrušené súperovou Vierou. */
  readonly zrusenaViera: number;
  readonly zrusenaPovera: number;
  /** Koľko mojich Povier súperov Farár ignoruje. */
  readonly poveraIgnorovana: number;
  /** Strop mäkkého poškodenia (súperove priznané Dlhy + priazeň Neprajníka); Infinity = bez stropu. */
  readonly makkeStrop: number;
}

export function rozpisPoskodenia(
  data: GameData,
  s: VerejnyStav,
  sums: readonly [ActionSums, ActionSums],
  abstakyVRuke: readonly [number, number],
): readonly [RozpisPoskodenia, RozpisPoskodenia] {
  const strany = stranyBitky(data, s, sums, abstakyVRuke);
  const dmg = computeDamage(strany);
  const rozpis = (p: PlayerId): RozpisPoskodenia => {
    const q = opponentOf(p);
    const ja = strany[p];
    const su = strany[q];
    const bonusy: PolozkaRozpisu[] = bitkaMody(data, s, p).tuheZdroje.map((z) => ({ zdroj: z.zdroj, hodnota: z.tuhe }));
    if (ja.cirhozaBonus > 0) bonusy.push({ zdroj: "cirhoza", hodnota: ja.cirhozaBonus });
    if (ja.priazenBitkara > 0) bonusy.push({ zdroj: "BITKAR", hodnota: ja.priazenBitkara });
    const zrazky: PolozkaRozpisu[] = [];
    if (dmg.zvysnaViera[q] > 0) zrazky.push({ zdroj: "Viera", hodnota: dmg.zvysnaViera[q] * su.hodnotaViery });
    if ((ja.tuheZlava ?? 0) > 0) zrazky.push({ zdroj: "pasca", hodnota: ja.tuheZlava ?? 0 });
    if (ja.abstaky > 0) zrazky.push({ zdroj: "abstak", hodnota: ja.abstaky });
    return {
      zAkcii: (ja.sums.Rana ?? 0) + 2 * (ja.sums.Pecka ?? 0) + 3 * (ja.sums.Petelica ?? 0),
      bonusy,
      zrazky,
      hodnotaViery: ja.hodnotaViery,
      zrusenaViera: (ja.sums.Viera ?? 0) - dmg.zvysnaViera[p],
      zrusenaPovera: (ja.sums.Povera ?? 0) - dmg.zvysnaPovera[p],
      poveraIgnorovana: (sums[p].Povera ?? 0) - (ja.sums.Povera ?? 0),
      makkeStrop: su.priznaneDlhy + (ja.makkeNadDlhy ?? 0),
    };
  };
  return [rozpis(0), rozpis(1)];
}

/** Prahy, ku ktorým hráč smeruje — Cirhóza (pečeň), Dlh (zadĺženie) a Exekútor (priznané Dlhy). */
export function prahyHraca(
  data: GameData,
  s: VerejnyStav,
  p: PlayerId,
): { readonly cirhoza: number; readonly dlh: number; readonly exekutor: number; readonly priznaneDlhy: number } {
  return {
    // ihrisko (Furt): prah Cirhózy je o 1 vyšší.
    cirhoza: prahCirhozy(priazen(data, s, "ALKOHOLIK", p)) + prahCirhozyBonus(s, p),
    dlh: prahDlhu(),
    // obecny_urad: prah Exekútora je o 4 nižší.
    exekutor: prahExekutora(priazen(data, s, "EXEKUTOR", p)) - exekutorLokality(s).zlava,
    priznaneDlhy: pocetKariet(s.hraci[p], "dlh", "priznane"),
  };
}

/** MANUAL pripomienky efektov kariet v hre pre daný spúšťač. */
function manualEfekty(s: MutState, data: GameData, trigger: string, events: Event[]): void {
  const pripomen = (card: CardInstance, hracEfektu: PlayerId | null): void => {
    const def = defOf(data, card);
    if (!def.triggers.includes(trigger as CardDef["triggers"][number])) return;
    if (!jeEfektManual(def.id)) return;
    // Praudovravec: Autority v tej istej partii efekt neuplatňujú.
    if (hracEfektu !== null && efektPotlaceny(data, s as GameState, hracEfektu, def.id)) return;
    events.push({
      type: "manualEfekt",
      defId: def.id,
      nazov: def.name,
      text: def.effectText,
      hrac: hracEfektu,
    });
  };
  for (const p of [0, 1] as const) {
    for (const pl of partiaHraca(s, p)) pripomen(pl.card as CardInstance, p);
    for (const k of s.hraci[p].dedicstvo) pripomen(k as CardInstance, p);
    for (const k of s.hraci[p].priznane) pripomen(k as CardInstance, p);
  }
  const lok = cielLokalita(s);
  if (lok !== null) pripomen(lok, null);
  for (const elder of s.starsi) {
    const pre = prebudenyPre(elder as ElderState);
    if (pre !== null) pripomen(elder.karta as CardInstance, pre);
  }
}

// ---------------------------------------------------------------------------
// Setup

export interface SetupOptions {
  /** Počet lokalít v hre — dĺžka hry (DLZKY_HRY); predvolene stredná. */
  readonly lokalit?: number;
}

/** Dĺžky hry, na ktoré má sada dosť lokalít. */
export function dostupneDlzky(data: GameData): DlzkaHry[] {
  return ALL_DLZKY.filter((d) => DLZKY_HRY[d] <= data.lokality.length);
}

export function setupGame(data: GameData, seed: number, opts?: SetupOptions): GameState {
  const s: MutState = {
    rng: rngSeed(seed),
    nextUid: 1,
    faza: "volbaCiela",
    kolo: 1,
    utocnik: 0,
    hraci: [freshPlayer(), freshPlayer()] as MutState["hraci"],
    spolocnyBalicek: [],
    senok: [],
    lokalityVHre: [],
    lokalitCelkom: 0,
    ovladnute: [],
    prepadnute: [],
    naexVKole: [false, false],
    starsi: [],
    ciel: null,
    lokalitaOtocena: false,
    strany: [[], []],
    pitkyCelkom: 0,
    pitkaCislo: 0,
    dedicstvaVylozene: 0,
    cirhozyVKole: [0, 0],
    draftStav: null,
    zhromazdenieStav: null,
    pitkaStav: null,
    bitkaStav: null,
    koniec: null,
    vizia: null,
    ohlaseneVydesenie: [null, null],
  };

  // Náhodný útočník prvého kola (PRAVIDLA §7).
  const [prvy, rng0] = rngInt(s.rng, 2);
  s.rng = rng0;
  s.utocnik = prvy as PlayerId;

  // Starší — každý s konkrétnym variantom karty, na náhodne rozdanom
  // scorecarde (ten určuje priazeň aj bodovacie podmienky).
  const [scorecardy, rngSc] = rngShuffle(s.rng, data.scorecards);
  s.rng = rngSc;
  [...data.elders.values()].forEach((elderDef, i) => {
    const karta = novaInstancia(s, data, elderDef.id);
    const sc = scorecardy[i];
    if (sc === undefined) throw new Error("Chybné dáta: menej scorecardov ako starších.");
    s.starsi.push(freshElder(elderDef.id, karta, sc.id) as DeepMutable<ElderState>);
  });

  // Lokality: náhodný výber z dostupných.
  const pocetLokalit = opts?.lokalit ?? DLZKY_HRY[PREDVOLENA_DLZKA];
  if (pocetLokalit > data.lokality.length) {
    throw new Error(`Sada má len ${data.lokality.length} lokalít, hra potrebuje ${pocetLokalit}.`);
  }
  s.lokalitCelkom = pocetLokalit;
  const [poradieLokalit, rng1] = rngShuffle(s.rng, data.lokality);
  s.rng = rng1;
  for (const def of poradieLokalit.slice(0, pocetLokalit)) {
    s.lokalityVHre.push(novaInstancia(s, data, def.id) as DeepMutable<CardInstance>);
  }

  // Spoločný doberací balíček: kópie všetkých kariet okrem lokalít,
  // starešinov, čistých kliatob (tie vznikajú akciami) a štartoviek
  // (Michal 2026-10-18: sú výhradne v štartovacích balíčkoch).
  const KLIATBY = new Set(["dlh", "cirhoza", "abstak"]);
  const spolocne: CardInstance[] = [];
  for (const def of data.cards.values()) {
    if (def.tags.includes("Lokalita") || def.tags.includes("Starešina")) continue;
    if (KLIATBY.has(def.id) || def.id in KONSTANTY.START_RUKA) continue;
    for (let i = 0; i < KONSTANTY.KOPIE_V_SPOLOCNOM_BALICKU; i++) {
      spolocne.push(novaInstancia(s, data, def.id));
    }
  }
  const [zamiesane, rng2] = rngShuffle(s.rng, spolocne);
  s.rng = rng2;
  s.spolocnyBalicek = zamiesane as DeepMutable<CardInstance>[];

  // Štartovacie karty (rovnaké pre oboch, viď constants) sa zamiešajú do
  // doberacieho balíčka; do ruky ide VELKOST_RUKY kariet.
  for (const p of [0, 1] as const) {
    const startovacie: CardInstance[] = [];
    for (const [defId, pocet] of Object.entries(KONSTANTY.START_RUKA)) {
      for (let i = 0; i < pocet; i++) startovacie.push(novaInstancia(s, data, defId));
    }
    const [balicek, rngP] = rngShuffle(s.rng, startovacie);
    s.rng = rngP;
    hrac(s, p).doberaci = balicek as DeepMutable<CardInstance>[];
    tahaj(s, p, KONSTANTY.VELKOST_RUKY, []);
  }

  // Šenok sa na začiatku nevykladá — postavia ho hráči v prvom drafte.
  return s as GameState;
}

// ---------------------------------------------------------------------------
// Kto je na ťahu

export function naTahu(state: GameState): PlayerId | null {
  if (state.koniec !== null) return null;
  switch (state.faza) {
    case "volbaCiela":
      // Cieľ kola vyberá a natáča obranca, vykladať začína útočník (Michal 2026-10-20).
      return obranca(state);
    case "draft": {
      const d = state.draftStav;
      if (d === null) return null;
      // Stavbu šenku hrajú obaja naraz (mozeHrat); naTahu ukazuje toho, na
      // koho sa ešte čaká — obrancu skôr.
      if (d.krok === "stavba") return d.vyber[obranca(state)] === null ? obranca(state) : state.utocnik;
      return d.naTahu;
    }
    case "zhromazdenie":
      return state.zhromazdenieStav?.naTahu ?? null;
    case "pitka":
      if (state.vizia !== null) return viziaNaTahu(state);
      return state.pitkaStav?.naTahu ?? null;
    case "bitka":
      return state.bitkaStav?.caka ?? null;
    default:
      return null;
  }
}

/**
 * Smie hráč p teraz poslať príkaz? Zvyčajne len ten na ťahu; stavbu šenku
 * však hrajú obaja naraz — každý, kto v tomto kroku ešte nevybral.
 */
export function mozeHrat(state: GameState, p: PlayerId): boolean {
  if (state.koniec !== null) return false;
  if (state.faza === "draft" && state.draftStav?.krok === "stavba") {
    return state.draftStav.vyber[p] === null;
  }
  return naTahu(state) === p;
}

// ---------------------------------------------------------------------------
// apply

export function apply(
  data: GameData,
  state: GameState,
  cmd: Command,
  hracId: PlayerId,
): { state: GameState; events: Event[] } {
  need(state.koniec === null, "Hra sa skončila.");
  const s = structuredClone(state) as MutState;
  const events: Event[] = [];

  if (cmd.type === "tah") {
    // Atomicky: pri chybe ktoréhokoľvek kroku sa nevykoná nič.
    need(state.faza === "zhromazdenie", "Celý ťah naraz sa hrá len v Zhromaždení.");
    need(cmd.kroky.length > 0, "Ťah je prázdny.");
    let st = state;
    const vsetky: Event[] = [];
    for (const k of cmd.kroky) {
      need(k.type === "place" || k.type === "vypit", "V ťahu smú byť len vyloženia a Vypiť.");
      need(st.faza === "zhromazdenie" && naTahu(st) === hracId, "Ťah sa skončil skôr, než si vyložil všetky karty.");
      const r = apply(data, st, k, hracId);
      st = r.state;
      vsetky.push(...r.events);
    }
    return { state: st, events: vsetky };
  }

  if (cmd.type === "vzdat") {
    const dovod = cmd.kontumacia === true ? `Kontumácia: Hráč ${hracId + 1} je dlho odpojený.` : `Partiu vzdáva Hráč ${hracId + 1}.`;
    ukonciHru(s, data, opponentOf(hracId), dovod, events);
    return { state: s as GameState, events };
  }

  need(mozeHrat(state, hracId), "Nie si na ťahu.");
  need(state.vizia === null || cmd.type === "vizia", "Najprv rozhodni o karte z Vízie.");

  switch (cmd.type) {
    case "chooseLocation":
      cmdChooseLocation(s, data, cmd, hracId, events);
      break;
    case "chooseElder":
      cmdChooseElder(s, data, cmd, hracId, events);
      break;
    case "stavbaSenku":
      cmdStavbaSenku(s, data, cmd, hracId, events);
      break;
    case "draftBer":
      cmdDraftBer(s, data, cmd, hracId, events);
      break;
    case "draftStop":
      cmdDraftStop(s, data, hracId, events);
      break;
    case "place":
      if (s.faza === "pitka") cmdReakcia(s, data, cmd, hracId, events);
      else cmdPlace(s, data, cmd, hracId, events);
      break;
    case "bezReakcie":
      cmdBezReakcie(s, hracId, events);
      break;
    case "postarka":
      cmdPostarka(s, data, cmd, hracId, events);
      break;
    case "starosta":
      cmdStarosta(s, data, cmd, hracId, events);
      break;
    case "benzinka":
      cmdBenzinka(s, data, cmd, hracId, events);
      break;
    case "vestica":
      cmdVestica(s, data, cmd, hracId, events);
      break;
    case "zberatel":
      cmdZberatel(s, data, cmd, hracId, events);
      break;
    case "vizia":
      cmdVizia(s, data, cmd, hracId, events);
      break;
    case "vykup":
      cmdVykup(s, data, cmd, hracId, events);
      break;
    case "cintorin":
      cmdCintorin(s, data, cmd, hracId, events);
      break;
    case "pass":
      cmdPass(s, data, hracId, events);
      break;
    case "vypit":
      cmdVypit(s, data, hracId, events);
      break;
    case "naex":
      cmdNaex(s, data, cmd, hracId, events);
      break;
    case "skipNaex":
      cmdSkipNaex(s, data, hracId, events);
      break;
    case "smoke":
      cmdSmoke(s, cmd, hracId, events);
      break;
    case "barter":
      cmdBarter(s, data, hracId, events);
      break;
    case "refillPoldeci":
      cmdRefill(s, hracId, events);
      break;
    case "exekutorTool":
      cmdExekutorTool(s, data, cmd, hracId, events);
      break;
    case "pohorsenie":
      cmdPohorsenie(s, data, cmd, hracId, events);
      break;
    case "prebytok":
      cmdPrebytok(s, data, cmd, hracId, events);
      break;
    case "liecba":
      cmdLiecba(s, data, cmd, hracId, events);
      break;
    case "pohreb":
      cmdPohreb(s, data, cmd, hracId, events);
      break;
    case "skipLiecba":
      cmdSkipLiecba(s, data, hracId, events);
      break;
    case "nahrada":
      cmdNahrada(s, data, cmd, hracId, events);
      break;
  }

  aktualizujPitky(s, data);
  dohrajNevyhnutne(data, s, events);
  return { state: s as GameState, events };
}

/**
 * Pitky v bitke (Michal 2026-10-19): 1 + menší z počtov aktivovaných akcií
 * karty v strede (lokalita, v bitke o staršieho jeho karta) na jej dvoch
 * stranách. Kto aktivuje 3 akcie lokality a súper 1, pijú sa 2 Pitky.
 */
export function pocetPitiek(data: GameData, state: VerejnyStav & { readonly lokalitaOtocena: boolean }): number {
  if (state.ciel?.lokalita == null) return 1;
  const [a, b] = evaluateLine(data, lineState(state)).aktivneStredu;
  return 1 + Math.min(a, b);
}

/** Počet Pitiek sa mení s líniou, už začaté Pitky však ostávajú. */
function aktualizujPitky(s: MutState, data: GameData): void {
  if (s.faza !== "zhromazdenie" && s.faza !== "pitka") return;
  // V Zhromaždení sa už chystá ďalšia Pitka (pitkaCislo ráta odohrané).
  const zacate = s.faza === "zhromazdenie" ? s.pitkaCislo + 1 : s.pitkaCislo;
  s.pitkyCelkom = Math.max(zacate, pocetPitiek(data, s as GameState));
}

/**
 * Ťahy bez voľby odohrá hra sama (Michal 2026-10-12): keď je jediná možnosť
 * pasovať, preskočiť NA EX alebo Pohreb, hráč na to nemusí klikať. Tretina
 * príkazov playtestu 20261011-183315 boli práve takéto potvrdenia.
 */
function dohrajNevyhnutne(data: GameData, s: MutState, events: Event[]): void {
  for (;;) {
    const p = naTahu(s as GameState);
    if (p === null) return;
    // Fajčiť smie hráč v Zhromaždení kedykoľvek, ale kvôli tomu sa za neho
    // nečaká — kto nemá čo vyložiť, pasuje (cigarety mu ostanú na Pitku).
    const moznosti = legalCommands(data, s as GameState, p).filter((c) => !(s.faza === "zhromazdenie" && c.type === "smoke"));
    const jedina = moznosti.length === 1 ? moznosti[0] : undefined;
    if (jedina?.type === "pass") {
      events.push({ type: "log", text: `Hráč ${p + 1} už nemá čo vyložiť.` });
      cmdPass(s, data, p, events);
    } else if (jedina?.type === "skipNaex") {
      events.push({ type: "log", text: `Hráč ${p + 1} nemá v Pitke čo urobiť.` });
      cmdSkipNaex(s, data, p, events);
    } else if (jedina?.type === "skipLiecba") {
      cmdSkipLiecba(s, data, p, events);
    } else if (jedina?.type === "bezReakcie") {
      cmdBezReakcie(s, p, events);
    } else if (jedina?.type === "draftStop") {
      if (s.senok.length > 0) events.push({ type: "log", text: `Hráč ${p + 1} nemá cigaretu na kartu zo šenku.` });
      cmdDraftStop(s, data, p, events);
    } else {
      return;
    }
  }
}

// ---------------------------------------------------------------------------
// Voľba cieľa a draft

function cmdChooseLocation(
  s: MutState,
  data: GameData,
  cmd: { uid: number; otocena: boolean },
  p: PlayerId,
  events: Event[],
): void {
  need(s.faza === "volbaCiela", "Teraz sa nevyberá cieľ.");
  const idx = s.lokalityVHre.findIndex((k) => k.uid === cmd.uid);
  need(idx !== -1, "Taká lokalita nie je v hre.");
  const karta = s.lokalityVHre.splice(idx, 1)[0] as CardInstance;
  s.ciel = { typ: "lokalita", lokalita: karta as DeepMutable<CardInstance>, elderId: null };
  s.lokalitaOtocena = cmd.otocena;
  events.push({
    type: "log",
    text: `Hráč ${p + 1} vybral bitku o lokalitu ${defOf(data, karta).name}.`,
  });
  s.faza = "draft";
  events.push({ type: "faza", faza: "draft" });
  zacniDraft(s, events);
}

function cmdChooseElder(
  s: MutState,
  data: GameData,
  cmd: { elderId: string; otocena: boolean },
  p: PlayerId,
  events: Event[],
): void {
  need(s.faza === "volbaCiela", "Teraz sa nevyberá cieľ.");
  const elder = s.starsi.find((e) => e.elderId === cmd.elderId);
  need(elder !== undefined, "Taký starší nie je.");
  need(!elder.nahradeny, "O náhradu staršieho sa bojovať nedá.");
  need(bitkaOStarsiehoMozna(elder as ElderState), "Marker nie je aspoň v oranžovej zóne.");
  // Karta staršieho leží v strede línie a útočník ju natočí ako lokalitu
  // (Michal 2026-10-12) — strany sa tak spájajú cez ňu.
  s.ciel = { typ: "starsi", lokalita: elder.karta, elderId: cmd.elderId };
  s.lokalitaOtocena = cmd.otocena === true;
  events.push({
    type: "log",
    text: `Hráč ${p + 1} vyvolal bitku o staršieho ${defOf(data, elder.karta as CardInstance).name}.`,
  });
  // Bez draftu; Pitiek ako pri lokalite — z akcií karty staršieho (Michal 2026-10-19).
  s.pitkyCelkom = 1;
  s.pitkaCislo = 0;
  zacniZhromazdenie(s, data, events);
}

/**
 * Veľkosť balíčka stavby šenku: počet nenahradených starších, nadol na párne
 * číslo (v každom kroku ubudnú z balíčka dve karty), najviac koľko spoločný
 * balíček dá obom hráčom.
 */
export function velkostStavby(state: Pick<GameState, "starsi" | "spolocnyBalicek">): number {
  const podlaStarsich = state.starsi.filter((e) => !e.nahradeny).length;
  const n = Math.min(podlaStarsich, Math.floor(state.spolocnyBalicek.length / 2));
  return n - (n % 2);
}

function zacniDraft(s: MutState, events: Event[]): void {
  // Nevzaté karty zo starého šenku idú naspodok spoločného balíčka.
  if (s.senok.length > 0) {
    s.spolocnyBalicek.push(...s.senok);
    events.push({ type: "log", text: `Zo šenku ide naspodok balíčka ${s.senok.length} nevzatých kariet.` });
    s.senok = [];
  }
  const n = velkostStavby(s as GameState);
  const balicky: [DeepMutable<CardInstance>[], DeepMutable<CardInstance>[]] = [[], []];
  for (const p of [obranca(s), s.utocnik] as const) balicky[p] = s.spolocnyBalicek.splice(0, n);
  s.draftStav = {
    krok: n > 0 ? "stavba" : "beranie",
    balicky,
    vyber: [null, null],
    // Zo šenku berie prvý útočník — porazený z minulej bitky (Michal 2026-10-16).
    naTahu: s.utocnik,
    hotovo: [false, false],
    noveKarty: [0, 0],
  };
  events.push({
    type: "log",
    text:
      n > 0
        ? `Stavba šenku: každý hráč dostáva ${n} kariet zo spoločného balíčka.`
        : "Spoločný balíček je prázdny — šenok sa nestavia.",
  });
}

/**
 * Koľko kariet dá hráč v kroku stavby do šenku a koľko naspodok — po dvoch
 * (Michal 2026-10-19), pri menšom balíčku menej. Zvyšok podá súperovi.
 */
export function krokStavby(velkost: number): { readonly doSenku: number; readonly odhod: number } {
  const doSenku = Math.min(KONSTANTY.STAVBA_DO_SENKU, velkost);
  return { doSenku, odhod: Math.min(KONSTANTY.STAVBA_NASPODOK, velkost - doSenku) };
}

function cmdStavbaSenku(
  s: MutState,
  data: GameData,
  cmd: { doSenku: readonly number[]; odhod: readonly number[] },
  p: PlayerId,
  events: Event[],
): void {
  const d = s.draftStav;
  need(s.faza === "draft" && d !== null && d.krok === "stavba", "Teraz sa šenok nestavia.");
  need(d.vyber[p] === null, "V tomto kroku si už vybral.");
  const moj = d.balicky[p];
  const krok = krokStavby(moj.length);
  need(cmd.doSenku.length === krok.doSenku, `Do šenku daj ${krok.doSenku} ${krok.doSenku === 1 ? "kartu" : "karty"}.`);
  need(cmd.odhod.length === krok.odhod, `Naspodok daj ${krok.odhod} ${krok.odhod === 1 ? "kartu" : "karty"}.`);
  const vybrane = [...cmd.doSenku, ...cmd.odhod];
  need(new Set(vybrane).size === vybrane.length, "Každú kartu vyber len raz.");
  need(
    vybrane.every((uid) => moj.some((k) => k.uid === uid)),
    "Karta nie je v tvojom balíčku stavby.",
  );
  d.vyber[p] = { doSenku: [...cmd.doSenku], odhod: [...cmd.odhod] };
  events.push({ type: "log", text: `Hráč ${p + 1} vybral karty do šenku.` });
  const v0 = d.vyber[0];
  const v1 = d.vyber[1];
  if (v0 === null || v1 === null) return;

  // Obaja vybrali: karty do šenku sa odhalia, odhodené idú lícom dole naspodok.
  const vyber = [v0, v1] as const;
  const doSenku: string[] = [];
  for (const h of [obranca(s), s.utocnik] as const) {
    const b = d.balicky[h];
    const vezmi = (uid: number): DeepMutable<CardInstance> =>
      b.splice(b.findIndex((k) => k.uid === uid), 1)[0] as DeepMutable<CardInstance>;
    for (const uid of vyber[h].doSenku) {
      const karta = vezmi(uid);
      s.senok.push(karta);
      doSenku.push(`${defOf(data, karta as CardInstance).name} (hráč ${h + 1})`);
    }
    for (const uid of vyber[h].odhod) s.spolocnyBalicek.push(vezmi(uid));
  }
  events.push({ type: "log", text: `Do šenku: ${doSenku.join(", ")}.` });
  d.balicky = [d.balicky[1], d.balicky[0]];
  d.vyber = [null, null];
  if (d.balicky[0].length === 0) {
    d.krok = "beranie";
    d.naTahu = s.utocnik;
    events.push({
      type: "log",
      text: `Šenok je postavený (${s.senok.length} kariet). Berie sa striedavo, začína útočník: 1 karta za ${KONSTANTY.CENA_SENKU[1]} cigaretu, 2 karty za ${KONSTANTY.CENA_SENKU[2]} cigarety.`,
    });
  }
}

/**
 * Koľko kariet si hráč p smie teraz vziať zo šenku (Michal 2026-10-19):
 * 1 karta za cigaretu, 2 karty za 3 cigarety. Prázdne = nemá na to.
 */
export function moznostiZoSenku(state: GameState, p: PlayerId): number[] {
  const d = state.draftStav;
  if (d === null || d.krok !== "beranie" || d.hotovo[p]) return [];
  const out: number[] = [];
  for (let pocet = 1; pocet < KONSTANTY.CENA_SENKU.length; pocet++) {
    if (pocet <= state.senok.length && state.hraci[p].cigarety >= (KONSTANTY.CENA_SENKU[pocet] ?? Number.POSITIVE_INFINITY)) out.push(pocet);
  }
  return out;
}

function cmdDraftBer(
  s: MutState,
  data: GameData,
  cmd: { uids: readonly number[] },
  p: PlayerId,
  events: Event[],
): void {
  const d = s.draftStav;
  need(s.faza === "draft" && d !== null && d.krok === "beranie", "Teraz sa zo šenku neberie.");
  need(!d.hotovo[p], "Už nič neberieš.");
  const pocet = cmd.uids.length;
  need(pocet >= 1 && pocet < KONSTANTY.CENA_SENKU.length, "Zo šenku ber 1 alebo 2 karty.");
  need(new Set(cmd.uids).size === pocet, "Každú kartu vyber len raz.");
  need(cmd.uids.every((uid) => s.senok.some((k) => k.uid === uid)), "Karta nie je v šenku.");
  const cena = KONSTANTY.CENA_SENKU[pocet] as number;
  need(s.hraci[p].cigarety >= cena, `Na ${pocet === 1 ? "kartu" : `${pocet} karty`} treba ${cena} ${cena === 1 ? "cigaretu" : "cigarety"}.`);
  hrac(s, p).cigarety -= cena;
  const mena: string[] = [];
  for (const uid of cmd.uids) {
    const karta = s.senok.splice(s.senok.findIndex((k) => k.uid === uid), 1)[0] as DeepMutable<CardInstance>;
    hrac(s, p).ruka.push(karta);
    mena.push(defOf(data, karta as CardInstance).name);
  }
  d.noveKarty[p] += pocet;
  events.push({ type: "log", text: `Hráč ${p + 1} berie zo šenku ${mena.join(" a ")} za ${cena} ${cena === 1 ? "cigaretu" : "cigarety"}.` });
  // Prázdny šenok končí branie obom.
  if (s.senok.length === 0) d.hotovo = [true, true];
  dalsiVBerani(s, data, p, events);
}

function cmdDraftStop(s: MutState, data: GameData, p: PlayerId, events: Event[]): void {
  const d = s.draftStav;
  need(s.faza === "draft" && d !== null && d.krok === "beranie", "Teraz sa zo šenku neberie.");
  need(!d.hotovo[p], "Už nič neberieš.");
  d.hotovo[p] = true;
  events.push({ type: "log", text: `Hráč ${p + 1} už neberie zo šenku (vzal ${d.noveKarty[p]}).` });
  dalsiVBerani(s, data, p, events);
}

/** Po ťahu v braní berie súper, ak ešte berie, inak ten istý; keď už nikto, draft končí. */
function dalsiVBerani(s: MutState, data: GameData, p: PlayerId, events: Event[]): void {
  const d = s.draftStav;
  if (d === null) return;
  const opp = opponentOf(p);
  if (!d.hotovo[opp] || !d.hotovo[p]) {
    d.naTahu = d.hotovo[opp] ? p : opp;
    return;
  }
  // Pitiek je podľa aktivovaných akcií lokality — prepočítava sa s líniou.
  s.pitkaCislo = 0;
  s.pitkyCelkom = 1;
  s.draftStav = null;
  skontrolujBalicky(s, data, events);
  if (s.koniec !== null) return;
  zacniZhromazdenie(s, data, events);
}

// ---------------------------------------------------------------------------
// Zhromaždenie

/**
 * Vykladať začína útočník (Michal 2026-10-20) — natočenie lokality už neurčuje,
 * kto kam vykladá, a cieľ vyberá obranca.
 */
function zacniZhromazdenie(s: MutState, data: GameData, events: Event[], zacina: PlayerId = s.utocnik): void {
  s.faza = "zhromazdenie";
  events.push({ type: "faza", faza: "zhromazdenie" });
  // Limit sa počíta nanovo na začiatku každého Zhromaždenia (PRAVIDLA §5).
  // zastavka ho prepíše na 2; vinko pridáva poldeci navyše.
  s.zhromazdenieStav = {
    naTahu: zacina,
    zostavaLimit: [limitZhromazdenia(s as GameState, 0), limitZhromazdenia(s as GameState, 1)],
    pasoval: [false, false],
    navyse: [0, 0],
    // Zastávka: obaja čerpajú zo spoločného limitu (súčet ich limitov).
    spolocny: spolocnyLimit(s as GameState),
  };
  manualEfekty(s, data, "Zhromaždenie", events);
}

function posunTahZhromazdenia(s: MutState, data: GameData, p: PlayerId, events: Event[]): void {
  const z = s.zhromazdenieStav;
  if (z === null) return;
  const oppon = opponentOf(p);
  if (!z.pasoval[oppon]) {
    z.naTahu = oppon;
  }
  if (z.pasoval[0] && z.pasoval[1]) {
    s.zhromazdenieStav = null;
    zacniPitku(s, data, events);
  }
}

function cmdPlace(
  s: MutState,
  data: GameData,
  cmd: { uid: number; target: CielVykladania },
  p: PlayerId,
  events: Event[],
): void {
  const z = s.zhromazdenieStav;
  need(s.faza === "zhromazdenie" && z !== null, "Teraz nie je Zhromaždenie.");
  need(!z.pasoval[p], "Už si pasoval.");
  const kartaVRuke = s.hraci[p].ruka.find((k) => k.uid === cmd.uid);
  need(kartaVRuke !== undefined, "Karta nie je v ruke.");
  const def = defOf(data, kartaVRuke as CardInstance);
  const jeNastroj = def.tags.includes("Nástroj");

  if (cmd.target === "priznanie") {
    need(def.tags.includes("Kliatba"), "Priznať možno len kartu s tagom Kliatba.");
    const karta = vezmiZRuky(s, p, cmd.uid);
    hrac(s, p).priznane.push(karta as DeepMutable<CardInstance>);
    // Pri priznaní každej kliatby si hráč okamžite doberie kartu (Michal
    // 2026-10-19; predtým len pri Dlhu) — log to hovorí výslovne.
    const dobral = tahaj(s, p, 1, events).length;
    events.push({
      type: "log",
      text:
        dobral > 0
          ? `Hráč ${p + 1} priznáva kartu ${def.name} a doberá si kartu.`
          : `Hráč ${p + 1} priznáva kartu ${def.name} — balíček aj odhadzovací balíček sú prázdne, niet čo dobrať.`,
    });
    // Priznanie neodovzdá ťah (Michal 2026-10-12) — kliatby sa nepriznávajú
    // na striedačku a nedá sa nimi „čakať“, kým súper vyloží.
    return;
  } else if (cmd.target === "dedicstvo") {
    need(jeNastroj, "Do Dedičstva patria len Nástroje.");
    // Dedičstvo stojí cigarety a cena rastie spoločne pre oboch (Michal 2026-10-19).
    const cena = cenaDedicstva(s as GameState);
    need(s.hraci[p].cigarety >= cena, `Do Dedičstva treba ${cena} ${cena === 1 ? "cigaretu" : cena <= 4 ? "cigarety" : "cigariet"}.`);
    hrac(s, p).cigarety -= cena;
    s.dedicstvaVylozene += 1;
    const karta = vezmiZRuky(s, p, cmd.uid);
    hrac(s, p).dedicstvo.push(karta as DeepMutable<CardInstance>);
    events.push({
      type: "log",
      text: `Hráč ${p + 1} vykladá ${def.name} do Dedičstva za ${cena} ${cena === 1 ? "cigaretu" : cena <= 4 ? "cigarety" : "cigariet"} (ďalšie Dedičstvo stojí ${cenaDedicstva(s as GameState)}).`,
    });
    manualEfekty(s, data, "Dedičstvo", events);
  } else {
    // Nástroj sa do limitu vykladania nezapočítava (PRAVIDLA §5+§6); ostatné
    // karty limit míňajú (Kočovník od 2026-10-19 tiež).
    // Družstvo: Pracujúci limit nemíňajú.
    if (!jeNastroj && !bezLimituPracujuci(cielLokalita(s as GameState)?.defId ?? null, def.tags)) {
      need(z.zostavaLimit[p] > 0, "Limit vykladania je vyčerpaný.");
      uberLimit(z, p, 1);
    }
    vylozDoLinie(s, data, p, cmd.uid, cmd.target, events);
  }

  ukonciVykladanie(s, data, p, events);
}

/**
 * Odhalené Milujúce manželky hráča p — priznané aj v línii (Furt platí, kým je
 * karta odhalená; Michal 2026-10-19). Každá posunie latku Absťáku o 1.
 */
export function manzelkyHraca(s: VerejnyStav, p: PlayerId): number {
  return (
    s.hraci[p].priznane.filter((k) => k.defId === "milujuca_manzelka").length +
    partiaHraca(s, p).filter((pl) => pl.card.defId === "milujuca_manzelka").length
  );
}

/** Cena ďalšieho Nástroja do Dedičstva — 1, 2, 3… spoločne pre oboch (Michal 2026-10-19). */
export function cenaDedicstva(state: { readonly dedicstvaVylozene: number }): number {
  return KONSTANTY.CENA_DEDICSTVA_ZAKLAD + state.dedicstvaVylozene;
}

/**
 * Vyloženie karty z ruky na koniec tvojej alebo súperovej strany — v
 * Zhromaždení aj ako reakcia na NA EX. Limit vykladania rieši volajúci.
 */
function vylozDoLinie(
  s: MutState,
  data: GameData,
  p: PlayerId,
  uid: number,
  target: CielVykladania,
  events: Event[],
): void {
  need(target === "vlastna" || target === "superova", "Kartu možno vyložiť len na tvoju alebo súperovu stranu.");
  need(!(target === "superova" && lenVlastnaStrana(cielLokalita(s as GameState)?.defId ?? null)), "Most: karty sa smú vykladať len na vlastnú stranu.");
  const kartaVRuke = s.hraci[p].ruka.find((k) => k.uid === uid);
  need(kartaVRuke !== undefined, "Karta nie je v ruke.");
  const def = defOf(data, kartaVRuke as CardInstance);
  // Karta smie na ktorúkoľvek stranu; patrí tomu, kto ju zahral (pravidlá v3).
  const cielPartia: PlayerId = target === "vlastna" ? p : opponentOf(p);
  // Nástroj nesmie susediť s Nástrojom (PRAVIDLA §6).
  const partia = s.strany[cielPartia];
  const sused = partia.length > 0 ? partia[partia.length - 1] : null;
  if (def.tags.includes("Nástroj") && sused != null) {
    need(
      !defOf(data, sused.card as CardInstance).tags.includes("Nástroj"),
      "Nástroj nesmie susediť s Nástrojom.",
    );
  }
  // pes: nikdy nesmie byť v partii s iným zvieraťom — medzi kartami toho istého majiteľa.
  need(!zvieraKonflikt(data, partiaHraca(s as GameState, p), def), "Pes nesmie byť medzi tvojimi kartami s iným zvieraťom.");
  // pes (Furt): kým je na konci strany svojho majiteľa, súper naň nesmie podstrčiť kartu.
  need(
    !(cielPartia !== p && sused != null && sused.card.defId === "pes" && sused.playedBy === cielPartia),
    "Pes stráži koniec strany — sem nepodstrčíš.",
  );
  const karta = vezmiZRuky(s, p, uid);
  partia.push({ card: karta, playedBy: p } as DeepMutable<PlacedCard>);
  events.push({
    type: "log",
    text: `Hráč ${p + 1} vykladá ${def.name} do ${target === "vlastna" ? "svojej" : "súperovej"} partie.`,
  });
  if (def.triggers.includes("Nástup")) {
    nastupEfekt(s, data, def.id, p, events);
  }
}

/** Po vyložení: s vypitým poldeci (Vypiť) hráč pokračuje, inak ide súper. */
function ukonciVykladanie(s: MutState, data: GameData, p: PlayerId, events: Event[]): void {
  const z = s.zhromazdenieStav;
  if (z !== null && z.navyse[p] > 0) {
    z.navyse[p] -= 1;
    return;
  }
  posunTahZhromazdenia(s, data, p, events);
}

/**
 * Implementované Nástup efekty; efekty pôsobia v partii, kde karta leží.
 * Neimplementované sa pripomenú v logu; Autority umlčí Praudovravec.
 */
function nastupEfekt(
  s: MutState,
  data: GameData,
  defId: string,
  p: PlayerId,
  events: Event[],
): void {
  const def = data.cards.get(defId);
  if (def === undefined) return;
  if (efektPotlaceny(data, s as GameState, p, defId)) {
    events.push({ type: "log", text: `Praudovravec: efekt karty ${def.name} sa neuplatní.` });
    return;
  }
  if (jeEfektManual(defId)) {
    events.push({
      type: "manualEfekt",
      defId,
      nazov: def.name,
      text: def.effectText,
      hrac: p,
    });
    return;
  }
  const opp = opponentOf(p);
  switch (defId) {
    case "hasic": {
      // Zober si pracujúceho občana do ruky z odhadzovacieho balíčka.
      const idx = s.hraci[p].odhadzovaci.findIndex((k) =>
        defOf(data, k as CardInstance).tags.includes("Pracujúci"),
      );
      if (idx !== -1) {
        const karta = hrac(s, p).odhadzovaci.splice(idx, 1)[0] as DeepMutable<CardInstance>;
        hrac(s, p).ruka.push(karta);
        events.push({
          type: "log",
          text: `Hasič: hráč ${p + 1} si berie ${defOf(data, karta).name} z odhadzovacieho.`,
        });
      }
      break;
    }
    case "niekoho_stryna": {
      // Zahoď 1 Cirhózu alebo 1 Dlh z ruky alebo z odhadzovacieho balíčka.
      // Hra vyberie za hráča: najprv z ruky, Cirhózu pred Dlhom (uberá viac bodov).
      let zostava = KONSTANTY.EFEKT.STRYNA_KLIATBY;
      let zRuky = 0;
      for (const kde of ["ruka", "odhadzovaci"] as const) {
        for (const kliatba of ["cirhoza", "dlh"] as const) {
          while (zostava > 0) {
            const idx = s.hraci[p][kde].findIndex((k) => k.defId === kliatba);
            if (idx === -1) break;
            hrac(s, p)[kde].splice(idx, 1);
            zostava--;
            if (kde === "ruka") zRuky++;
            events.push({ type: "log", text: `Niekoho stryná: hráč ${p + 1} zahodil ${kliatba === "dlh" ? "Dlh" : "Cirhózu"}.` });
          }
        }
      }
      poZahodeni(s, data, p, zRuky, events);
      break;
    }
    case "zivnostnik": {
      // Zahoď jedno súperovo dedičstvo.
      const prve = hrac(s, opp).dedicstvo.shift();
      if (prve !== undefined) {
        events.push({
          type: "log",
          text: `Živnostník: dedičstvo ${defOf(data, prve as CardInstance).name} hráča ${opp + 1} zahodené.`,
        });
      }
      break;
    }
    case "velmi_smutiaca_vdova": {
      // Muž navrchu súperovho balíčka ide z hry a majiteľ zahodí 2 svoje Dlhy.
      // Oprava 2026-10-19 (Michal: „efekt nefunguje“): vrchná karta sa berie
      // aj po zamiešaní odhadzovacieho, Dlhy sa naozaj zahodia (z ruky aj
      // z odhadzovacieho — predtým sa len odhodili a vrátili) a log vždy povie,
      // čo sa stalo. Hrobár sa nespúšťa — zahadzuje sa vlastnou kartou.
      const opponent = hrac(s, opp);
      if (opponent.doberaci.length === 0 && opponent.odhadzovaci.length > 0) {
        const [premiesane, rng] = rngShuffle(s.rng, opponent.odhadzovaci);
        s.rng = rng;
        opponent.doberaci = premiesane as DeepMutable<CardInstance>[];
        opponent.odhadzovaci = [];
      }
      const vrchna = opponent.doberaci[0];
      if (vrchna === undefined) {
        events.push({ type: "log", text: `Veľmi smútiaca vdova: hráč ${opp + 1} nemá v balíčku žiadnu kartu — nič sa nestane.` });
        break;
      }
      const meno = defOf(data, vrchna as CardInstance).name;
      if (!defOf(data, vrchna as CardInstance).tags.includes("Chlap")) {
        events.push({ type: "log", text: `Veľmi smútiaca vdova: vrchná karta balíčka hráča ${opp + 1} je ${meno} — nie muž, nič sa nestane.` });
        break;
      }
      opponent.doberaci.shift();
      let zostava = KONSTANTY.EFEKT.VDOVA_DLHY;
      for (const kde of ["ruka", "odhadzovaci"] as const) {
        while (zostava > 0) {
          const idx = s.hraci[p][kde].findIndex((k) => k.defId === "dlh");
          if (idx === -1) break;
          hrac(s, p)[kde].splice(idx, 1);
          zostava--;
        }
      }
      const zahodene = KONSTANTY.EFEKT.VDOVA_DLHY - zostava;
      events.push({
        type: "log",
        text: `Veľmi smútiaca vdova: vrchná karta balíčka hráča ${opp + 1} je ${meno} — muž ide z hry; hráč ${p + 1} zahadzuje ${zahodene} ${zahodene === 1 ? "Dlh" : "Dlhy"}.`,
      });
      break;
    }
    default:
      break;
  }
}

/** Uberie z limitu vykladania; na Zastávke zo spoločného limitu obom. */
function uberLimit(z: DeepMutable<ZhromazdenieStav>, p: PlayerId, n: number): void {
  for (const q of z.spolocny === true ? ([0, 1] as const) : [p]) z.zostavaLimit[q] = Math.max(0, z.zostavaLimit[q] - n);
}

function cmdPass(s: MutState, data: GameData, p: PlayerId, events: Event[]): void {
  const z = s.zhromazdenieStav;
  need(s.faza === "zhromazdenie" && z !== null, "Teraz nie je Zhromaždenie.");
  need(!z.pasoval[p], "Už si pasoval.");
  z.pasoval[p] = true;
  z.navyse[p] = 0;
  events.push({ type: "log", text: `Hráč ${p + 1} pasuje.` });
  posunTahZhromazdenia(s, data, p, events);
}

/**
 * Vypiť (pravidlá v3): plný poldeci sa otočí na vypitý. Limit vykladania
 * hneď klesne o 1 (poldeci už nie je plný), pečeň +1 a ráta sa ako nerest —
 * zato hráč ďalšou kartou neodovzdá ťah. Smie piť opakovane.
 */
function cmdVypit(s: MutState, data: GameData, p: PlayerId, events: Event[]): void {
  const z = s.zhromazdenieStav;
  need(s.faza === "zhromazdenie" && z !== null, "Vypiť sa dá len v Zhromaždení.");
  need(!z.pasoval[p], "Už si pasoval.");
  need(!zakazVypit(s as GameState), "Kostol: nikto nesmie vypiť.");
  need(s.hraci[p].poldeciPlne > 0, "Nemáš plný poldeci.");
  const player = hrac(s, p);
  player.poldeciPlne -= 1;
  player.poldeciVypite += 1;
  player.nerestiTotoKolo += 1;
  uberLimit(z, p, 1);
  z.navyse[p] += 1;
  events.push({ type: "log", text: `Hráč ${p + 1} pije do dna — zahrá ďalšiu kartu hneď, limit mu klesá na ${z.zostavaLimit[p]}.` });
  // Pečeň sa vyhodnocuje len v Pitke (Michal 2026-10-16): vypitie ju pripíše
  // dopredu a prah Cirhózy sa skontroluje v najbližšej Pitke.
  player.pecen += 1;
  events.push({ type: "pecen", hrac: p, mnozstvo: 1 });
}

// ---------------------------------------------------------------------------
// Pitka

function zacniPitku(s: MutState, data: GameData, events: Event[]): void {
  s.faza = "pitka";
  s.pitkaCislo += 1;
  events.push({ type: "faza", faza: "pitka" });
  events.push({ type: "log", text: `Pitka ${s.pitkaCislo}/${s.pitkyCelkom}.` });
  s.pitkaStav = {
    naTahu: obranca(s),
    hotovy: [false, false],
    naexPouzity: [false, false],
    fajcenie: [0, 0],
    reakcia: null,
    postarka: [false, false],
    starosta: [false, false],
    naexPocet: [0, 0],
    vykup: [false, false],
  };
  manualEfekty(s, data, "Pitka", events);
}

function cmdNaex(
  s: MutState,
  data: GameData,
  cmd: { uid: number },
  p: PlayerId,
  events: Event[],
): void {
  const pitka = s.pitkaStav;
  need(s.faza === "pitka" && pitka !== null, "Teraz nie je Pitka.");
  need(pitka.reakcia === null, "Najprv odpovedz na NA EX.");
  need(!zakazNaex(s as GameState), "Kostol: nikto nesmie dať NA EX.");
  need(!pitka.naexPouzity[p], naexZaPitku(s as GameState) > 1 ? "NA EX smieš dať najviac dvakrát za Pitku." : "NA EX smieš dať najviac raz za Pitku.");
  need(s.hraci[p].poldeciPlne > 0, "Nemáš plný poldeci.");
  const kde = najdiVLinii(s, cmd.uid);
  need(kde !== null, "Karta neleží v žiadnej partii.");
  const placed = s.strany[kde.strana][kde.index] as DeepMutable<PlacedCard>;
  need(placed.naexBy === undefined, "Na karte už poldeci leží.");
  // NA EX na vlastnú aj súperovu kartu (Michal 2026-10-18 vrátil obmedzenie
  // z pravidiel v3 na „len vlastnú“) — akcie karty ostávajú jej majiteľovi.
  const def = defOf(data, placed.card as CardInstance);
  need(
    def.tags.includes("Občan") || def.tags.includes("Starešina"),
    "NA EX smie len na Občana alebo Starešinu.",
  );
  need(def.id !== "liberal", "Liberál: na neho NA EX dať nemožno.");
  need(!chraneneAlkoholikom(s.strany[kde.strana], kde.index, p), "Anonymný alkoholik: na neho ani na karty jeho majiteľa vedľa neho NA EX dať nemôžeš.");

  hrac(s, p).poldeciPlne -= 1;
  placed.naexBy = p;
  s.naexVKole[p] = true;
  events.push({
    type: "log",
    text: `Hráč ${p + 1} dáva NA EX na ${placed.playedBy === p ? "svoju" : "súperovu"} kartu ${def.name}${kde.strana === p ? "" : " (na súperovej strane)"}.`,
  });
  // Pečeň z NA EX sa počíta hneď — poldeci pije ten, kto NA EX dal (PRAVIDLA §5).
  pridajPecen(s, data, p, 1, events);
  // Vínna pivnica dovolí dve NA EX za Pitku, inde jedno.
  const pocet = (pitka.naexPocet?.[p] ?? 0) + 1;
  pitka.naexPocet = p === 0 ? [pocet, pitka.naexPocet?.[1] ?? 0] : [pitka.naexPocet?.[0] ?? 0, pocet];
  pitka.naexPouzity[p] = pocet >= naexZaPitku(s as GameState);

  const opp = opponentOf(p);
  // vychovavatelka: súper si musí vziať jeden tvoj priznaný Dlh — do
  // doberacieho balíčka, nie na ruku (Michal 2026-10-19: priznanie dáva kartu,
  // Dlh na ruke by bol pre súpera darom). Zamieša sa na náhodné miesto.
  if (maEfekt(s, data, p, "vychovavatelka")) {
    const idx = s.hraci[p].priznane.findIndex((k) => k.defId === "dlh");
    if (idx !== -1) {
      const dlh = hrac(s, p).priznane.splice(idx, 1)[0] as DeepMutable<CardInstance>;
      const [miesto, rng] = rngInt(s.rng, s.hraci[opp].doberaci.length + 1);
      s.rng = rng;
      hrac(s, opp).doberaci.splice(miesto, 0, dlh);
      events.push({ type: "log", text: `Vychovávateľka: hráč ${opp + 1} dostáva priznaný Dlh hráča ${p + 1} do doberacieho balíčka.` });
    }
  }

  // svokra: každá Svokra súpera mu za toto NA EX ukradne cigaretu (Michal
  // 2026-10-18 — nahradila zákaz NA EX, ochranu teraz nesie Anonymný alkoholik).
  if (maEfekt(s, data, opp, "svokra")) {
    const svokry = Math.max(1, partiaHraca(s as GameState, opp).filter((pl) => pl.card.defId === "svokra").length);
    const ukradne = Math.min(s.hraci[p].cigarety, svokry * KONSTANTY.EFEKT.SVOKRA_CIGARETY);
    if (ukradne > 0) {
      hrac(s, p).cigarety -= ukradne;
      hrac(s, opp).cigarety += ukradne;
      events.push({ type: "log", text: `Svokra: hráč ${opp + 1} ukradol hráčovi ${p + 1} ${ukradne} cigariet za NA EX.` });
    }
  }

  // Súper smie na NA EX hneď odpovedať jednou kartou z ruky (Michal 2026-10-12).
  if (mozeReagovat(s as GameState, data, opp)) {
    pitka.reakcia = opp;
    pitka.naTahu = opp;
    events.push({ type: "log", text: `Hráč ${opp + 1} smie na NA EX odpovedať jednou kartou.` });
  }
}

/**
 * NA EX hráča p — Občania a Starešinovia v línii (vlastní aj súperovi) bez
 * poldeci, nie Liberál ani Anonymný alkoholik a jeho susedia.
 */
export function moznostiNaex(data: GameData, state: GameState, p: PlayerId): number[] {
  const pitka = state.pitkaStav;
  if (pitka === null || pitka.reakcia !== null || zakazNaex(state)) return [];
  if (pitka.naexPouzity[p] || state.hraci[p].poldeciPlne <= 0) return [];
  return naexCieleVLinii(data, state.strany, p);
}

/** Karty v línii, na ktoré smie hráč p dať NA EX — spoločné pre server aj klienta. */
export function naexCieleVLinii(data: GameData, strany: readonly (readonly PlacedCard[])[], p: PlayerId): number[] {
  const out: number[] = [];
  for (const strana of strany) {
    for (const [i, placed] of strana.entries()) {
      if (placed.naexBy !== undefined || placed.card.defId === "liberal" || chraneneAlkoholikom(strana, i, p)) continue;
      const tags = defOf(data, placed.card).tags;
      if (tags.includes("Občan") || tags.includes("Starešina")) out.push(placed.card.uid);
    }
  }
  return out;
}

/**
 * anonymny_alkoholik (Michal 2026-10-19): súper jeho majiteľa nedá NA EX na
 * neho ani na majiteľove karty vedľa neho na tej istej strane. Majiteľ smie;
 * súperove karty nechráni. Prvé karty strán susedia s lokalitou, nie navzájom.
 */
function chraneneAlkoholikom(strana: readonly PlacedCard[], i: number, p: PlayerId): boolean {
  const ciel = strana[i];
  if (ciel === undefined) return false;
  for (let j = i - 1; j <= i + 1; j++) {
    const alk = strana[j];
    if (alk?.card.defId !== "anonymny_alkoholik" || alk.playedBy === p) continue;
    if (j === i || ciel.playedBy === alk.playedBy) return true;
  }
  return false;
}

/** krcma: kto má plný poldeci (a kam ho dať), musí dať NA EX. */
export function krcmaVyzaduje(data: GameData, state: GameState, p: PlayerId): boolean {
  return jeCielLokalita(state, "krcma") && moznostiNaex(data, state, p).length > 0;
}

/** Hráč q má v ruke kartu, ktorú môže vyložiť do línie (reakcia je mimo limitu). */
function mozeReagovat(s: GameState, data: GameData, q: PlayerId): boolean {
  return s.hraci[q].ruka.some((k) =>
    cieleVykladania(data, s.strany, q, k, Number.POSITIVE_INFINITY, true, cielLokalitaId(s)).some((c) => c === "vlastna" || c === "superova"),
  );
}

function cmdReakcia(
  s: MutState,
  data: GameData,
  cmd: { uid: number; target: CielVykladania },
  p: PlayerId,
  events: Event[],
): void {
  const pitka = s.pitkaStav;
  need(s.faza === "pitka" && pitka !== null && pitka.reakcia === p, "Teraz nemôžeš reagovať na NA EX.");
  vylozDoLinie(s, data, p, cmd.uid, cmd.target, events);
  ukonciReakciu(s);
}

function cmdBezReakcie(s: MutState, p: PlayerId, events: Event[]): void {
  const pitka = s.pitkaStav;
  need(s.faza === "pitka" && pitka !== null && pitka.reakcia === p, "Teraz nemôžeš reagovať na NA EX.");
  events.push({ type: "log", text: `Hráč ${p + 1} na NA EX neodpovedá.` });
  ukonciReakciu(s);
}

/** Po reakcii je na ťahu znova ten, kto dal NA EX. */
function ukonciReakciu(s: MutState): void {
  const pitka = s.pitkaStav;
  if (pitka === null || pitka.reakcia === null) return;
  pitka.naTahu = opponentOf(pitka.reakcia);
  pitka.reakcia = null;
}

/** postarka (Pitka): dober 1 až 2 karty navyše a spolu s nimi 1 Dlh. */
function cmdPostarka(s: MutState, data: GameData, cmd: { pocet: number }, p: PlayerId, events: Event[]): void {
  const pitka = s.pitkaStav;
  need(s.faza === "pitka" && pitka !== null && pitka.reakcia === null, "Poštárka platí v Pitke.");
  need(maEfekt(s, data, p, "postarka"), "Poštárku nemáš.");
  need(!pitka.postarka[p], "Poštárku si v tejto Pitke už použil.");
  const najviac = KONSTANTY.EFEKT.POSTARKA_KARTY;
  need(Number.isInteger(cmd.pocet) && cmd.pocet >= 1 && cmd.pocet <= najviac, `Dobrať smieš 1 až ${najviac} kariet.`);
  pitka.postarka[p] = true;
  tahaj(s, p, cmd.pocet, events);
  const dlhy = KONSTANTY.EFEKT.POSTARKA_DLHY;
  for (let i = 0; i < dlhy; i++) pridajKliatbu(s, data, p, "dlh", events);
  events.push({ type: "log", text: `Poštárka: hráč ${p + 1} dobral ${cmd.pocet} kariet a ${dlhy} Dlhov.` });
}

/** starosta (Pitka): za cigaretu vymeň kartu z ruky za kartu zo šenku. */
function cmdStarosta(
  s: MutState,
  data: GameData,
  cmd: { rukaUid: number; senokUid: number },
  p: PlayerId,
  events: Event[],
): void {
  const pitka = s.pitkaStav;
  need(s.faza === "pitka" && pitka !== null && pitka.reakcia === null, "Starosta platí v Pitke.");
  need(maEfekt(s, data, p, "starosta"), "Starostu nemáš.");
  need(!pitka.starosta[p], "Starostu si v tejto Pitke už použil.");
  need(s.hraci[p].cigarety >= 1, "Treba cigaretu.");
  const senokIdx = s.senok.findIndex((k) => k.uid === cmd.senokUid);
  need(senokIdx !== -1, "Karta nie je v šenku.");
  const zRuky = vezmiZRuky(s, p, cmd.rukaUid);
  const zoSenku = s.senok.splice(senokIdx, 1, zRuky as DeepMutable<CardInstance>)[0] as CardInstance;
  hrac(s, p).ruka.push(zoSenku as DeepMutable<CardInstance>);
  hrac(s, p).cigarety -= 1;
  pitka.starosta[p] = true;
  events.push({
    type: "log",
    text: `Starosta: hráč ${p + 1} vymenil ${defOf(data, zRuky).name} za ${defOf(data, zoSenku).name} zo šenku.`,
  });
}

/**
 * Fajčenie (Michal 2026-10-16): cigareta = jedna karta hneď. Smie sa
 * v Zhromaždení aj v Pitke, keď je hráč na ťahu, a ťah to neukončí.
 * Cigarety sa prenášajú z kola na kolo.
 */
function cmdSmoke(s: MutState, cmd: { pocet: number }, p: PlayerId, events: Event[]): void {
  const pitka = s.pitkaStav;
  const vPitke = s.faza === "pitka" && pitka !== null && pitka.reakcia === null;
  need(vPitke || (s.faza === "zhromazdenie" && s.zhromazdenieStav !== null), "Fajčiť sa dá v Zhromaždení a v Pitke.");
  need(!zakazFajcit(s as GameState), "Benzínka: nikto nesmie fajčiť.");
  need(cmd.pocet > 0 && Number.isInteger(cmd.pocet), "Počet cigariet musí byť kladný.");
  need(s.hraci[p].cigarety >= cmd.pocet, "Toľko cigariet nemáš.");
  hrac(s, p).cigarety -= cmd.pocet;
  hrac(s, p).nerestiTotoKolo += cmd.pocet;
  const tahane = tahaj(s, p, cmd.pocet, events);
  if (vPitke) pitka.fajcenie[p] += cmd.pocet;
  events.push({ type: "log", text: `Hráč ${p + 1} fajčí ${cmd.pocet} ${cmd.pocet === 1 ? "cigaretu" : "cigarety"} a doberá si ${tahane.length} ${tahane.length === 1 ? "kartu" : "karty"}.` });
}

/** Cena stokárskeho barteru hráča p — priazeň Lakomca ju znižuje (Michal 2026-10-18). */
export function barterCena(data: GameData, s: VerejnyStav, p: PlayerId): number {
  // jednota (Michal 2026-10-20): barter o 1 cigaretu lacnejší.
  return Math.max(1, cenaBarteru(priazen(data, s, "LAKOMEC", p)) - barterZlavaLokality(s));
}

/** Zberný dvor (Pitka): raz za Pitku za cigaretu karta z vlastného odhadzovacieho balíčka do ruky. */
function cmdVykup(s: MutState, data: GameData, cmd: { uid: number }, p: PlayerId, events: Event[]): void {
  const pitka = s.pitkaStav;
  need(s.faza === "pitka" && pitka !== null && pitka.reakcia === null && s.vizia === null, "Výkup sa robí počas Pitky.");
  need(vykupZoSrotu(s as GameState), "Výkup je len na Zbernom dvore.");
  need(pitka.vykup?.[p] !== true, "Výkup si v tejto Pitke už použil.");
  need(s.hraci[p].cigarety >= KONSTANTY.EFEKT.ZBERNY_DVOR_CENA, "Na výkup treba cigaretu.");
  const idx = s.hraci[p].odhadzovaci.findIndex((k) => k.uid === cmd.uid);
  need(idx !== -1, "Karta nie je v tvojom odhadzovacom balíčku.");
  const karta = hrac(s, p).odhadzovaci.splice(idx, 1)[0] as DeepMutable<CardInstance>;
  hrac(s, p).ruka.push(karta);
  hrac(s, p).cigarety -= KONSTANTY.EFEKT.ZBERNY_DVOR_CENA;
  hrac(s, p).nerestiTotoKolo += 1;
  pitka.vykup = p === 0 ? [true, pitka.vykup?.[1] ?? false] : [pitka.vykup?.[0] ?? false, true];
  events.push({ type: "log", text: `Zberný dvor: hráč ${p + 1} vykupuje zo šrotu ${defOf(data, karta as CardInstance).name} za cigaretu.` });
}

function cmdBarter(s: MutState, data: GameData, p: PlayerId, events: Event[]): void {
  need(s.faza === "pitka" && s.pitkaStav?.reakcia === null, "Barter sa robí počas Pitky.");
  // Zjednodušenie v1: barter berie len cigarety, ktoré hráč má (pravidlá pripúšťajú
  // aj aktívne akcie Cigareta) — viď README.
  const cena = barterCena(data, s as GameState, p);
  need(s.hraci[p].cigarety >= cena, `Na barter treba ${cena} cigariet.`);
  hrac(s, p).cigarety -= cena;
  hrac(s, p).nerestiTotoKolo += cena;
  hrac(s, p).poldeciPlne += 1;
  events.push({ type: "log", text: `Hráč ${p + 1} robí stokársky barter za ${cena} cigariet — nový plný poldeci.` });
}

function cmdRefill(s: MutState, p: PlayerId, events: Event[]): void {
  need(s.faza === "pitka" && s.pitkaStav?.reakcia === null, "Poldeci sa dopĺňa počas Pitky.");
  need(!doliatieZakazane(s as GameState, p), "Vínko: poldeci za cigarety dolievať nesmieš.");
  need(s.hraci[p].cigarety >= KONSTANTY.REFILL_CENA, `Treba ${KONSTANTY.REFILL_CENA} cigarety.`);
  need(s.hraci[p].poldeciVypite > 0, "Nemáš vypitý poldeci.");
  hrac(s, p).cigarety -= KONSTANTY.REFILL_CENA;
  hrac(s, p).nerestiTotoKolo += KONSTANTY.REFILL_CENA;
  hrac(s, p).poldeciVypite -= 1;
  hrac(s, p).poldeciPlne += 1;
  events.push({ type: "log", text: `Hráč ${p + 1} otáča poldeci za 2 cigarety.` });
}

function cmdSkipNaex(s: MutState, data: GameData, p: PlayerId, events: Event[]): void {
  const pitka = s.pitkaStav;
  need(s.faza === "pitka" && pitka !== null && pitka.reakcia === null, "Teraz nie je Pitka.");
  need(!pitka.hotovy[p], "Už si skončil.");
  need(!krcmaVyzaduje(data, s as GameState, p), "Krčma: kým máš plný poldeci, musíš dať NA EX.");
  pitka.hotovy[p] = true;
  const oppon = opponentOf(p);
  if (!pitka.hotovy[oppon]) {
    pitka.naTahu = oppon;
    return;
  }
  vyhodnotPitku(s, data, events);
}

/** Automatické kroky Pitky 2–7 (PRAVIDLA §7). */
function vyhodnotPitku(s: MutState, data: GameData, events: Event[]): void {
  const pitka = s.pitkaStav;
  if (pitka === null) return;
  const vyhodnotenie = evaluateLine(data, lineState(s as GameState));
  const sums = vyhodnotenie.sums;

  // 2. Dlh — aktívne akcie Dlh postihujú majiteľa karty, Dlhy Finančnej
  //    poradkyne súpera; zberny_dvor generuje o 1 menej.
  const poradkynaDlhy = [0, 0] as [number, number];
  for (const p of [0, 1] as const) {
    for (const placed of partiaHraca(s as GameState, p)) {
      if (placed.card.defId !== "financna_poradkyna") continue;
      if (efektPotlaceny(data, s as GameState, p, "financna_poradkyna")) continue;
      const ev = vyhodnotenie.cards.get(placed.card.uid);
      if (ev === undefined) continue;
      for (const strana of [ev.left, ev.right]) {
        for (const slot of strana) {
          if (slot?.action === "Dlh" && slot.stav === "aktivna") poradkynaDlhy[p] += slot.nasobok;
        }
      }
    }
  }
  // financna_poradkyna (Michal 2026-10-18): Dlh z jej akcií dostáva súper, nie jej majiteľ.
  for (const p of [0, 1] as const) {
    const odSupera = poradkynaDlhy[opponentOf(p)];
    const vlastne = Math.max(0, (sums[p].Dlh ?? 0) - poradkynaDlhy[p]);
    pridajZadlzenie(s, data, p, vlastne + odSupera, events);
  }

  // 3. Poškodenie pečene: akcie Poškodenie pečene a Poldeci [R6b]; NA EX už pripísané,
  //    pitie do dna zo Zhromaždenia čaká na prah práve tu.
  for (const p of [0, 1] as const) {
    pridajPecen(s, data, p, sums[p].PoškodeniePečene ?? 0, events);
    pridajPecen(s, data, p, sums[p].Poldeci ?? 0, events);
    skontrolujPrahPecene(s, data, p, events);
  }

  // 4.–6. Obmedzenie, Cigarety, ťahanie (Michal 2026-10-16): aktívne akcie
  //    Cigareta dávajú cigarety, súperove Obmedzenia ich uberú.
  //    Karty si hráč doberá fajčením (cmdSmoke) — kedy chce.
  for (const p of [0, 1] as const) {
    let cigarety = sums[p].Cigareta ?? 0;
    // Priazeň Fajčiara: cigarety navyše v prvej Pitke kola o lokalitu — +sila,
    // bez dvojnásobku (Michal 2026-10-19: cigarety platia šenok aj Dedičstvo).
    if (s.pitkaCislo === 1 && s.ciel?.typ === "lokalita") {
      cigarety += priazen(data, s as GameState, "FAJCIAR", p) / KONSTANTY.NASOBOK_PRIAZNE;
    }
    const opp = opponentOf(p);
    const obmedzenia = sums[opp].Obmedzenie ?? 0;
    // cigorky (Dedičstvo): v každej Pitke cigareta navyše — Obmedzenie ju neuberie.
    const cigorky = vDedicstve(s as GameState, p, "cigorky") ? KONSTANTY.EFEKT.CIGORKY_CIGARETY : 0;
    const ziska = Math.max(0, cigarety - obmedzenia) + cigorky;
    if (ziska > 0) {
      hrac(s, p).cigarety += ziska;
      events.push({
        type: "log",
        text: `Hráč ${p + 1} získava ${ziska} ${ziska === 1 ? "cigaretu" : ziska <= 4 ? "cigarety" : "cigariet"}.`,
      });
    }
  }

  // 7. Vízia (Michal 2026-10-19): za každú aktívnu Víziu sa hráč pozrie na
  //    vrchnú kartu svojho doberacieho balíčka a rozhodne — do ruky, alebo
  //    zahodiť (preč z hry: kliatba či slabá karta). Predtým Vízia len
  //    preosievala kliatby medzi kartami dobratými v Pitke.
  const vizie: [number, number] = [sums[0].Vízia ?? 0, sums[1].Vízia ?? 0];
  if (vizie[0] + vizie[1] > 0) {
    s.vizia = { zostava: vizie };
    if (pripravVizia(s)) return;
  }
  dokonciPitku(s, data, events);
}

/** Na koho sa vo Vízii čaká — obranca pred útočníkom. */
function viziaNaTahu(state: GameState): PlayerId | null {
  if (state.vizia === null) return null;
  for (const p of [obranca(state), state.utocnik] as const) if (state.vizia.zostava[p] > 0) return p;
  return null;
}

/**
 * Vrchná karta pre Víziu: prázdny doberací balíček sa doplní zamiešaním
 * odhadzovacieho; kto nemá žiadnu kartu, Víziu stráca. Vráti true, keď sa
 * čaká na rozhodnutie hráča.
 */
function pripravVizia(s: MutState): boolean {
  const v = s.vizia;
  if (v === null) return false;
  for (const p of [obranca(s), s.utocnik] as const) {
    if (v.zostava[p] <= 0) continue;
    const player = hrac(s, p);
    if (player.doberaci.length === 0 && player.odhadzovaci.length > 0) {
      const [premiesane, rng] = rngShuffle(s.rng, player.odhadzovaci);
      s.rng = rng;
      player.doberaci = premiesane as DeepMutable<CardInstance>[];
      player.odhadzovaci = [];
    }
    if (player.doberaci.length > 0) return true;
    v.zostava[p] = 0;
  }
  s.vizia = null;
  return false;
}

function cmdVizia(s: MutState, data: GameData, cmd: { vziat: boolean }, p: PlayerId, events: Event[]): void {
  need(s.faza === "pitka" && s.vizia !== null && viziaNaTahu(s as GameState) === p, "Teraz nerozhoduješ o Vízii.");
  const vrchna = s.hraci[p].doberaci[0];
  need(vrchna !== undefined, "Doberací balíček je prázdny.");
  if (cmd.vziat) {
    tahaj(s, p, 1, events);
    events.push({ type: "log", text: `Vízia: hráč ${p + 1} si vrchnú kartu balíčka berie do ruky.` });
  } else {
    hrac(s, p).doberaci.shift();
    events.push({ type: "log", text: `Vízia: hráč ${p + 1} zahadzuje vrchnú kartu balíčka — ${defOf(data, vrchna as CardInstance).name}.` });
    poZahodeni(s, data, p, 1, events);
  }
  s.vizia.zostava[p] -= 1;
  if (pripravVizia(s)) return;
  dokonciPitku(s, data, events);
}

/** Koniec Pitky: pečeň a zadĺženie sa vynulujú, ide ďalšia Pitka alebo bitka. */
function dokonciPitku(s: MutState, data: GameData, events: Event[]): void {
  // Pečeň a zadĺženie žijú len počas Pitky (Michal 2026-10-16) — zvyšok pod
  // prahom sa do ďalšej Pitky neprenáša.
  for (const p of [0, 1] as const) {
    const player = hrac(s, p);
    if (player.pecen > 0 || player.zadlzenie > 0) {
      events.push({ type: "log", text: `Hráč ${p + 1}: po Pitke sa pečeň (${player.pecen}) a zadĺženie (${player.zadlzenie}) vynulovali.` });
    }
    player.pecen = 0;
    player.zadlzenie = 0;
  }

  s.vizia = null;
  s.pitkaStav = null;
  // Pokles balíčka pod 5 sa kontroluje až v stabilných bodoch (po drafte
  // a na konci kola) — uprostred kola ležia karty v partiách a do veľkosti
  // balíčka sa nepočítajú, takže by kontrola falošne trestala vykladanie.

  // Ďalšia Pitka (Michal 2026-10-19): toľko, koľko dovolia aktivované akcie
  // karty v strede — línia sa medzitým mohla zmeniť.
  s.pitkyCelkom = Math.max(s.pitkaCislo, pocetPitiek(data, s as GameState));
  if (s.pitkaCislo < s.pitkyCelkom) {
    zacniZhromazdenie(s, data, events);
    return;
  }
  zacniBitku(s, data, events);
}

// ---------------------------------------------------------------------------
// Bitka

function zacniBitku(s: MutState, data: GameData, events: Event[]): void {
  s.faza = "bitka";
  events.push({ type: "faza", faza: "bitka" });
  const vyhodnotenie = evaluateLine(data, lineState(s as GameState));

  s.bitkaStav = {
    // Prvý krok je Benzínka; súčty a Pohoršenia sa po nej prepočítajú.
    krok: "benzinka",
    caka: null,
    sums: vyhodnotenie.sums as DeepMutable<BitkaStav["sums"]>,
    exekutorHotovy: [false, false],
    pohorsenieZostava: [0, 0],
    pohnuteMarkery: [],
    damage: null,
    vitaz: null,
    prebytokDrzi: null,
    prebytokZostava: 0,
    prebytokPosunute: [],
    liecbaHotova: [false, false],
    benzinkaZostava: [0, 0],
    lokalitaPrepadne: false,
    spalit: [],
    vesticaHotova: false,
    zberatelHotovy: [false, false],
    zberatelPonuka: [[], []],
  };
  const b = s.bitkaStav;

  for (const p of [0, 1] as const) {
    // krcmarka: bez Absťáku a bez NA EX v tomto kole sa vypitý poldeci otočí na plný.
    const abstaky = verejneAbstaky(s as GameState, p) + s.hraci[p].ruka.filter((k) => k.defId === "abstak").length;
    if (maEfekt(s, data, p, "krcmarka") && !s.naexVKole[p] && abstaky === 0 && s.hraci[p].poldeciVypite > 0) {
      hrac(s, p).poldeciVypite -= 1;
      hrac(s, p).poldeciPlne += 1;
      events.push({ type: "log", text: `Krčmárka: hráč ${p + 1} otáča vypitý poldeci na plný.` });
    }
    // dievcina_na_vydaj: zahodí sa (po bitke sa spáli) a s ňou toľko priznaných
    // Dlhov majiteľa, koľko mala aktívnych akcií.
    for (const placed of partiaHraca(s as GameState, p)) {
      if (placed.card.defId !== "dievcina_na_vydaj" || efektPotlaceny(data, s as GameState, p, "dievcina_na_vydaj")) continue;
      const ev = vyhodnotenie.cards.get(placed.card.uid);
      const aktivne =
        ev === undefined ? 0 : [...ev.left, ...ev.right].reduce((a, x) => a + (x?.stav === "aktivna" ? x.nasobok : 0), 0);
      let zostava = aktivne;
      while (zostava > 0) {
        const idx = s.hraci[p].priznane.findIndex((k) => k.defId === "dlh");
        if (idx === -1) break;
        hrac(s, p).priznane.splice(idx, 1);
        zostava--;
      }
      b.spalit.push(placed.card.uid);
      poZahodeni(s, data, p, 1, events);
      events.push({
        type: "log",
        text: `Dievčina na vydaj: hráč ${p + 1} ju zahadzuje a s ňou ${aktivne - zostava} priznaných Dlhov.`,
      });
    }
  }


  manualEfekty(s, data, "Bitka", events);
  manualEfekty(s, data, "Furt", events);
  manualEfekty(s, data, "Prestávka", events);
  pokracujBitku(s, data, events);
}

/** Vlastní Občania hráča p v línii, ktorí sa ešte nezahadzujú. */
function obcaniaVLinii(s: GameState, data: GameData, p: PlayerId): PlacedCard[] {
  const spalit = s.bitkaStav?.spalit ?? [];
  return partiaHraca(s, p).filter((pl) => defOf(data, pl.card).tags.includes("Občan") && !spalit.includes(pl.card.uid));
}

/** Karty z línie sa zahodia (spália) — z hry von, nevrátia sa do balíčka. */
function spalZLinie(
  s: MutState,
  data: GameData,
  p: PlayerId,
  uids: readonly number[],
  zdroj: string,
  events: Event[],
): void {
  for (const uid of uids) {
    const kde = najdiVLinii(s, uid);
    if (kde === null) continue;
    const [karta] = s.strany[kde.strana].splice(kde.index, 1);
    if (karta !== undefined) {
      events.push({ type: "log", text: `${zdroj}: hráč ${p + 1} zahadzuje ${defOf(data, karta.card as CardInstance).name}.` });
    }
  }
  poZahodeni(s, data, p, uids.length, events);
}

/** Súčty akcií a Pohoršenia z aktuálnej línie (Benzínka ju môže zmeniť). */
function nastavSumy(s: MutState, data: GameData): void {
  const b = s.bitkaStav;
  if (b === null) return;
  const sums = evaluateLine(data, lineState(s as GameState)).sums;
  b.sums = sums as DeepMutable<BitkaStav["sums"]>;
  b.pohorsenieZostava = [
    // puska: súperove Pohoršenia proti tebe neplatia.
    pohorseniaNeplatia(data, s as GameState, 1) ? 0 : (sums[0].Pohoršenie ?? 0),
    pohorseniaNeplatia(data, s as GameState, 0) ? 0 : (sums[1].Pohoršenie ?? 0),
  ];
}

/**
 * Zberateľ (Michal 2026-10-19, náhrada limitu ruky): po bitke si hráč
 * prezrie 2 × sila vrchných kariet doberacieho balíčka a sila z nich si
 * vezme do ruky. Vracia, koľko kariet si berie (0 = priazeň nemá).
 */
export function zberatelBerie(data: GameData, state: { readonly starsi: readonly ElderState[] }, p: PlayerId): number {
  return priazen(data, state, "ZBERATEL", p) / KONSTANTY.NASOBOK_PRIAZNE;
}

/** Ženie bitku dopredu, kým nenarazí na rozhodnutie hráča alebo koniec. */
function pokracujBitku(s: MutState, data: GameData, events: Event[]): void {
  const b = s.bitkaStav;
  if (b === null || s.koniec !== null) return;
  b.caka = null;

  // 0. Benzínka — kto má viac Občanov, než musí zahodiť, vyberá.
  if (b.krok === "benzinka") {
    for (const p of [obranca(s), s.utocnik]) {
      if (b.benzinkaZostava[p] <= 0) continue;
      const obcania = obcaniaVLinii(s as GameState, data, p);
      if (obcania.length > b.benzinkaZostava[p]) {
        b.caka = p;
        return;
      }
      spalZLinie(s, data, p, obcania.map((o) => o.card.uid), "Benzínka", events);
      b.benzinkaZostava[p] = 0;
    }
    nastavSumy(s, data);
    b.krok = "exekutor";
  }

  // 1. Exekútor (obranca, potom útočník).
  if (b.krok === "exekutor") {
    for (const p of [obranca(s), s.utocnik]) {
      if (b.exekutorHotovy[p]) continue;
      // Robota (pravidlá v2): ešte pred kontrolou prahu odhodí za každú
      // aktívnu Robotu 1 priznaný Dlh — do odhadzovacieho balíčka
      // (na Obecnom úrade 2, Michal 2026-10-20).
      const urad = exekutorLokality(s as GameState);
      for (let r = (b.sums[p].Robota ?? 0) * urad.robota; r > 0; r--) {
        const idx = s.hraci[p].priznane.findIndex((k) => k.defId === "dlh");
        if (idx === -1) break;
        const [dlh] = hrac(s, p).priznane.splice(idx, 1);
        if (dlh !== undefined) hrac(s, p).odhadzovaci.push(dlh);
        events.push({ type: "log", text: `Robota: hráč ${p + 1} odhadzuje 1 priznaný Dlh.` });
      }
      const dlhy = pocetKariet(s.hraci[p] as PlayerState, "dlh", "priznane");
      const vysledok = exekutorCheck(dlhy + urad.zlava, priazen(data, s as GameState, "EXEKUTOR", p));
      if (vysledok === "mimoOhrozenia") {
        // Hráč mimo ohrozenia spáli 1 priznaný Dlh (PRAVIDLA §8.1).
        const idx = s.hraci[p].priznane.findIndex((k) => k.defId === "dlh");
        if (idx !== -1) {
          hrac(s, p).priznane.splice(idx, 1);
          events.push({ type: "log", text: `Hráč ${p + 1} páli 1 priznaný Dlh.` });
        }
        b.exekutorHotovy[p] = true;
      } else {
        const nastroje = najdiNastroje(s as GameState, data, p);
        if (nastroje.length === 0) {
          // Nedokáže čeliť exekúcii — okamžite prehráva (PRAVIDLA §1).
          ukonciHru(s, data, opponentOf(p), `Hráč ${p + 1} nedokázal čeliť exekúcii.`, events);
          return;
        }
        b.caka = p;
        events.push({ type: "log", text: `Exekútor u hráča ${p + 1} — musí odovzdať Nástroj.` });
        return;
      }
    }
    b.krok = "pohorsenie";
  }

  // 2. Pohoršenie (obranca, potom útočník).
  if (b.krok === "pohorsenie") {
    for (const p of [obranca(s), s.utocnik]) {
      while (b.pohorsenieZostava[p] > 0) {
        // Kultúrny dom: ten istý marker smie ísť viackrát.
        if (!existujeLegalnePohorsenie(s, p, opakovanePohorsenie(s as GameState) ? [] : b.pohnuteMarkery)) {
          b.pohorsenieZostava[p] = 0;
          break;
        }
        b.caka = p;
        return;
      }
    }
    b.krok = null; // poškodenie a výsledok — automatické
    vyhodnotPoskodenie(s, data, events);
    if (s.koniec !== null) return;
  }

  // 3. Prebytok.
  if (b.krok === "prebytok") {
    while (b.prebytokZostava > 0 && b.prebytokDrzi !== null) {
      if (!existujeLegalnyPrebytok(s, b.prebytokDrzi)) {
        b.prebytokZostava = 0;
        break;
      }
      b.caka = b.prebytokDrzi;
      return;
    }
    if (s.ciel?.typ === "starsi" && b.vitaz !== null) {
      b.krok = "nahrada";
    } else {
      vypiPoldeci(s, data, events);
      b.krok = "vestica";
    }
  }

  // 4. Náhrada staršieho (len bitka o staršieho); cmdNahrada posúva krok sám.
  if (b.krok === "nahrada") {
    const kandidati = b.vitaz === null ? [] : najdiNahradnikov(s as GameState, data, b.vitaz);
    if (b.vitaz !== null && kandidati.length > 0) {
      b.caka = b.vitaz;
      events.push({ type: "log", text: `Hráč ${b.vitaz + 1} vyberá náhradu za staršieho.` });
      return;
    }
    // Bez kandidáta sa náhrada preskočí a starší ostáva (okrajový prípad).
    events.push({ type: "log", text: "Víťaz nemá Občana ani Zviera na náhradu — starší ostáva." });
    vypiPoldeci(s, data, events);
    b.krok = "vestica";
  }

  // 5. Veštica (Prehra): porazený vymení kartu medzi doberacími balíčkami.
  if (b.krok === "vestica") {
    const porazeny = b.vitaz === null ? null : opponentOf(b.vitaz);
    if (
      porazeny !== null &&
      !b.vesticaHotova &&
      maEfekt(s, data, porazeny, "vestica") &&
      s.hraci[porazeny].doberaci.length > 0 &&
      s.hraci[opponentOf(porazeny)].doberaci.length > 0
    ) {
      b.caka = porazeny;
      return;
    }
    b.vesticaHotova = true;
    b.krok = "liecba";
  }

  // 6. Liečba / Pohreb (obranca, potom útočník).
  if (b.krok === "liecba") {
    for (const p of [obranca(s), s.utocnik]) {
      if (b.liecbaHotova[p]) continue;
      const maPriznanuCirhozu = s.hraci[p].priznane.some((k) => k.defId === "cirhoza");
      if (!maPriznanuCirhozu) {
        b.liecbaHotova[p] = true;
        continue;
      }
      b.caka = p;
      return;
    }
    b.krok = "cintorin";
  }

  // 6c. Cintorín (Prehra, Michal 2026-10-20): porazený smie dať Nástroj z ruky do Dedičstva zadarmo.
  if (b.krok === "cintorin") {
    const porazeny = b.vitaz === null ? null : opponentOf(b.vitaz);
    if (
      b.cintorinHotovy !== true &&
      porazeny !== null &&
      dedicstvoZaPrehru(s as GameState) &&
      s.hraci[porazeny].ruka.some((k) => defOf(data, k as CardInstance).tags.includes("Nástroj"))
    ) {
      b.caka = porazeny;
      return;
    }
    b.cintorinHotovy = true;
    b.krok = "zberatel";
  }

  // 7. Zberateľ (Michal 2026-10-19): hráč s priazňou si prezrie vrchné karty
  //    balíčka a vyberie si, ktoré si vezme do ruky. Limit ruky už nie je.
  if (b.krok === "zberatel") {
    for (const p of [obranca(s), s.utocnik]) {
      if (b.zberatelHotovy[p]) continue;
      // Po poslednej bitke o lokalitu sa už nehrá — výber by nič nezmenil.
      const posledna = s.ciel?.typ === "lokalita" && s.lokalityVHre.length === 0;
      const berie = posledna ? 0 : zberatelBerie(data, s as GameState, p);
      if (berie > 0 && b.zberatelPonuka[p].length === 0) {
        const ponuka = tahajZBalicka(s, p, berie * KONSTANTY.NASOBOK_PRIAZNE);
        b.zberatelPonuka[p] = ponuka as DeepMutable<CardInstance>[];
      }
      if (b.zberatelPonuka[p].length > 0) {
        b.caka = p;
        return;
      }
      b.zberatelHotovy[p] = true;
    }
    koniecBitky(s, data, events);
  }
}

/**
 * Vrchné karty doberacieho balíčka (s premiešaním odhadzovacieho, keď
 * dôjde) — mimo ruky; volajúci rozhodne, kam pôjdu.
 */
function tahajZBalicka(s: MutState, p: PlayerId, pocet: number): CardInstance[] {
  const player = hrac(s, p);
  const out: CardInstance[] = [];
  for (let i = 0; i < pocet; i++) {
    if (player.doberaci.length === 0 && player.odhadzovaci.length > 0) {
      const [premiesane, rng] = rngShuffle(s.rng, player.odhadzovaci);
      s.rng = rng;
      player.doberaci = premiesane as DeepMutable<CardInstance>[];
      player.odhadzovaci = [];
    }
    const karta = player.doberaci.shift();
    if (karta === undefined) break;
    out.push(karta as CardInstance);
  }
  return out;
}

function cmdBenzinka(s: MutState, data: GameData, cmd: { uids: readonly number[] }, p: PlayerId, events: Event[]): void {
  const b = s.bitkaStav;
  need(s.faza === "bitka" && b !== null && b.krok === "benzinka" && b.caka === p, "Nečaká sa na Benzínku.");
  const zostava = b.benzinkaZostava[p];
  need(cmd.uids.length === zostava && new Set(cmd.uids).size === zostava, `Vyber presne ${zostava} Občanov.`);
  const moji = new Set(obcaniaVLinii(s as GameState, data, p).map((o) => o.card.uid));
  need(cmd.uids.every((u) => moji.has(u)), "Zahodiť smieš len svojich Občanov z línie.");
  spalZLinie(s, data, p, cmd.uids, "Benzínka", events);
  b.benzinkaZostava[p] = 0;
  pokracujBitku(s, data, events);
}

function cmdVestica(s: MutState, data: GameData, cmd: { moja: number; jeho: number }, p: PlayerId, events: Event[]): void {
  const b = s.bitkaStav;
  need(s.faza === "bitka" && b !== null && b.krok === "vestica" && b.caka === p, "Nečaká sa na Vešticu.");
  const opp = opponentOf(p);
  const moj = hrac(s, p).doberaci;
  const jeho = hrac(s, opp).doberaci;
  need(Number.isInteger(cmd.moja) && cmd.moja >= 0 && cmd.moja < moj.length, "Taká karta v tvojom balíčku nie je.");
  need(Number.isInteger(cmd.jeho) && cmd.jeho >= 0 && cmd.jeho < jeho.length, "Taká karta v súperovom balíčku nie je.");
  const a = moj[cmd.moja] as DeepMutable<CardInstance>;
  const c = jeho[cmd.jeho] as DeepMutable<CardInstance>;
  moj[cmd.moja] = c;
  jeho[cmd.jeho] = a;
  // Karty sa vrátia a balíčky zamiešajú — poradie, ktoré hráč videl, neplatí.
  for (const q of [p, opp]) {
    const [zamiesane, rng] = rngShuffle(s.rng, s.hraci[q].doberaci);
    s.rng = rng;
    hrac(s, q).doberaci = zamiesane as DeepMutable<CardInstance>[];
  }
  events.push({
    type: "log",
    text: `Veštica: hráč ${p + 1} vymenil ${defOf(data, a).name} za súperovu kartu ${defOf(data, c).name}.`,
  });
  b.vesticaHotova = true;
  b.krok = "liecba";
  pokracujBitku(s, data, events);
}

function cmdCintorin(s: MutState, data: GameData, cmd: { uid: number | null }, p: PlayerId, events: Event[]): void {
  const b = s.bitkaStav;
  need(s.faza === "bitka" && b !== null && b.krok === "cintorin" && b.caka === p, "Nečaká sa na Cintorín.");
  if (cmd.uid !== null) {
    const karta = s.hraci[p].ruka.find((k) => k.uid === cmd.uid);
    need(karta !== undefined && defOf(data, karta as CardInstance).tags.includes("Nástroj"), "Do Dedičstva patrí Nástroj z ruky.");
    hrac(s, p).dedicstvo.push(vezmiZRuky(s, p, cmd.uid) as DeepMutable<CardInstance>);
    // Spoločná cena Dedičstva sa zvýši ako vždy (Michal 2026-10-20).
    s.dedicstvaVylozene += 1;
    events.push({ type: "log", text: `Cintorín: hráč ${p + 1} dedí — ${defOf(data, karta as CardInstance).name} ide do Dedičstva zadarmo.` });
    manualEfekty(s, data, "Dedičstvo", events);
  }
  b.cintorinHotovy = true;
  b.krok = "zberatel";
  pokracujBitku(s, data, events);
}

function cmdZberatel(s: MutState, data: GameData, cmd: { uids: readonly number[] }, p: PlayerId, events: Event[]): void {
  const b = s.bitkaStav;
  need(s.faza === "bitka" && b !== null && b.krok === "zberatel" && b.caka === p, "Nečaká sa na Zberateľa.");
  const ponuka = b.zberatelPonuka[p];
  const berie = Math.min(zberatelBerie(data, s as GameState, p), ponuka.length);
  need(cmd.uids.length === berie && new Set(cmd.uids).size === berie, `Vyber presne ${berie} ${berie === 1 ? "kartu" : "karty"}.`);
  need(cmd.uids.every((uid) => ponuka.some((k) => k.uid === uid)), "Karta nie je medzi ponúknutými.");
  // Vybrané idú do ruky, ostatné do odhadzovacieho balíčka (odhodenie, nie zahodenie).
  for (const karta of ponuka) {
    if (cmd.uids.includes(karta.uid)) hrac(s, p).ruka.push(karta);
    else hrac(s, p).odhadzovaci.push(karta);
  }
  events.push({ type: "log", text: `Zberateľ: hráč ${p + 1} si z ${ponuka.length} vrchných kariet balíčka berie ${berie} do ruky, ostatné odhadzuje.` });
  b.zberatelPonuka[p] = [];
  b.zberatelHotovy[p] = true;
  pokracujBitku(s, data, events);
}

export interface KartaVolba {
  readonly defId: string;
  readonly kde: KartaZdroj;
}

/** pes: nikdy nesmie byť v partii s iným zvieraťom (platí v oboch smeroch). */
function zvieraKonflikt(data: GameData, partia: readonly PlacedCard[], def: CardDef): boolean {
  if (!def.tags.includes("Zviera")) return false;
  return partia.some((pl) => {
    if (!defOf(data, pl.card).tags.includes("Zviera")) return false;
    return def.id === "pes" || pl.card.defId === "pes";
  });
}

/** Položka návrhu ťahu v Zhromaždení: karta z ruky a kam ide. */
export interface PolozkaVykladania {
  readonly karta: CardInstance;
  readonly ciel: CielVykladania;
}

export interface PlanVykladania {
  /** Príkazy pre { type: "tah" } v poradí, v akom ich server vykoná. */
  readonly kroky: readonly Command[];
  /** Koľko plných poldeci ťah vypije (Vypiť pred každou ďalšou kartou). */
  readonly poldeci: number;
  /** Prečo sa ťah nedá zahrať (prvá chyba), inak null. */
  readonly chyba: string | null;
  /** Limit vykladania po ťahu. */
  readonly zostava: number;
}

/**
 * Celý ťah v Zhromaždení naraz (Michal 2026-10-19): priznania nič nestoja
 * a ťah neukončia; každá ďalšia karta do línie či do Dedičstva po prvej stojí
 * plný poldeci (Vypiť — limit klesne o 1). Klient z toho kreslí návrh a cenu,
 * server ten istý ťah overí znova príkazom „tah“.
 */
export function planVykladania(
  data: GameData,
  stav: {
    readonly strany: readonly [readonly PlacedCard[], readonly PlacedCard[]];
    readonly ciel: VerejnyStav["ciel"];
    readonly dedicstvaVylozene: number;
    readonly hraci: readonly [{ readonly cigarety: number; readonly poldeciPlne: number }, { readonly cigarety: number; readonly poldeciPlne: number }];
  },
  p: PlayerId,
  zostavaLimit: number,
  polozky: readonly PolozkaVykladania[],
): PlanVykladania {
  const kroky: Command[] = [];
  const priznania = polozky.filter((x) => x.ciel === "priznanie");
  const tahove = polozky.filter((x) => x.ciel !== "priznanie");
  let strany = stav.strany;
  let zostava = zostavaLimit;
  let plne = stav.hraci[p].poldeciPlne;
  let cigarety = stav.hraci[p].cigarety;
  let dedicstva = stav.dedicstvaVylozene;
  let poldeci = 0;
  const chyba = (text: string): PlanVykladania => ({ kroky, poldeci, chyba: text, zostava });
  const lokalita = cielLokalitaId(stav);
  // Kostol: nikto nesmie vypiť — bez Vypiť ide v ťahu len jedna karta.
  if (tahove.length > 1 && zakazVypit(stav)) return chyba("Kostol: nikto nesmie vypiť — v ťahu len jedna karta.");
  for (const x of priznania) {
    if (!cieleVykladania(data, strany, p, x.karta, zostava, true, lokalita).includes("priznanie")) return chyba(`${defOf(data, x.karta).name} sa nedá priznať.`);
    kroky.push({ type: "place", uid: x.karta.uid, target: "priznanie" });
  }
  for (let i = 0; i < tahove.length; i++) {
    const x = tahove[i] as PolozkaVykladania;
    // Každá karta okrem poslednej: najprv Vypiť, aby ďalšia neukončila ťah.
    if (i < tahove.length - 1) {
      if (plne <= 0) return chyba("Na ďalšiu kartu v tom istom ťahu treba plný poldeci.");
      plne -= 1;
      poldeci += 1;
      zostava = Math.max(0, zostava - 1);
      kroky.push({ type: "vypit" });
    }
    const cena = cenaDedicstva({ dedicstvaVylozene: dedicstva });
    if (!cieleVykladania(data, strany, p, x.karta, zostava, cigarety >= cena, lokalita).includes(x.ciel)) {
      return chyba(
        x.ciel === "dedicstvo"
          ? `Do Dedičstva treba ${cena} cig.`
          : zostava <= 0
            ? "Limit vykladania je vyčerpaný."
            : `${defOf(data, x.karta).name} sem vyložiť nemôžeš.`,
      );
    }
    kroky.push({ type: "place", uid: x.karta.uid, target: x.ciel });
    if (x.ciel === "dedicstvo") {
      cigarety -= cena;
      dedicstva += 1;
    } else {
      const kam: PlayerId = x.ciel === "vlastna" ? p : opponentOf(p);
      const nova = [...strany[kam], { card: x.karta, playedBy: p }];
      strany = kam === 0 ? [nova, strany[1]] : [strany[0], nova];
      const tagy = defOf(data, x.karta).tags;
      if (!tagy.includes("Nástroj") && !bezLimituPracujuci(lokalita, tagy)) zostava -= 1;
    }
  }
  return { kroky, poldeci, chyba: null, zostava };
}

/**
 * Kam smie hráč p vyložiť kartu z ruky v Zhromaždení. Volá to legalCommands
 * aj klient, ktorý podľa toho pri ťahaní karty ukazuje povolené miesta —
 * pravidlá vykladania tak existujú len raz. Server ich v cmdPlace overí znova.
 */
export function cieleVykladania(
  data: GameData,
  strany: readonly [readonly PlacedCard[], readonly PlacedCard[]],
  p: PlayerId,
  karta: CardInstance,
  zostavaLimit: number,
  /** Má hráč cigarety na ďalšie Dedičstvo (cenaDedicstva — rastie, Michal 2026-10-19)? */
  naDedicstvo = true,
  /** defId lokality v hre (cielLokalitaId) — Most a Družstvo menia, kam a za koľko sa vykladá. */
  lokalita: string | null = null,
): CielVykladania[] {
  const def = defOf(data, karta);
  const jeNastroj = def.tags.includes("Nástroj");
  const doDedicstva = jeNastroj && naDedicstvo;
  // Pes sa nesmie stretnúť s iným zvieraťom medzi kartami toho istého majiteľa.
  if (zvieraKonflikt(data, partiaHraca({ strany }, p), def)) {
    return def.tags.includes("Kliatba") ? ["priznanie"] : doDedicstva ? ["dedicstvo"] : [];
  }
  // Nástroj limit nemíňa, nesmie však susediť s Nástrojom na konci partie.
  const smie = (partia: readonly PlacedCard[], ciel: "vlastna" | "superova"): boolean => {
    if (!jeNastroj && zostavaLimit <= 0 && !bezLimituPracujuci(lokalita, def.tags)) return false;
    if (ciel === "superova" && lenVlastnaStrana(lokalita)) return false;
    const koniec = partia.length > 0 ? partia[partia.length - 1] : null;
    // pes (Furt, Michal 2026-10-18): kým je na konci strany svojho majiteľa, súper naň nepodstrčí.
    if (ciel === "superova" && koniec != null && koniec.card.defId === "pes" && koniec.playedBy !== p) return false;
    return !(jeNastroj && koniec != null && defOf(data, koniec.card).tags.includes("Nástroj"));
  };
  const out: CielVykladania[] = [];
  if (smie(strany[p], "vlastna")) out.push("vlastna");
  if (smie(strany[opponentOf(p)], "superova")) out.push("superova");
  if (def.tags.includes("Kliatba")) out.push("priznanie");
  if (doDedicstva) out.push("dedicstvo");
  return out;
}

/** Nástroje hráča naprieč zónami — bez uid, aby sa dali poslať klientovi. */
export function najdiNastroje(s: GameState, data: GameData, p: PlayerId): KartaVolba[] {
  const out: KartaVolba[] = [];
  for (const kde of ["ruka", "odhadzovaci", "doberaci", "dedicstvo"] as const) {
    const videne = new Set<string>();
    for (const k of s.hraci[p][kde]) {
      // zahradkar: pri Exekúcii ho smieš zahodiť namiesto náradia.
      if (!defOf(data, k).tags.includes("Nástroj") && k.defId !== "zahradkar") continue;
      if (videne.has(k.defId)) continue;
      videne.add(k.defId);
      out.push({ defId: k.defId, kde });
    }
  }
  return out;
}

function existujeLegalnePohorsenie(s: MutState, p: PlayerId, pohnute: readonly string[]): boolean {
  return s.starsi.some(
    (e) =>
      !pohnute.includes(e.elderId) &&
      posunMarker(e as ElderState, opponentOf(p), true, pohorsenieNaKraj(s as GameState, p)) !== null,
  );
}

/** Koľko prebytku stojí jeden posun: víťaza Miňištrant v jeho partii o 1 viac. */
function cenaPosunuPrebytkom(state: GameState, p: PlayerId): number {
  return p === state.bitkaStav?.vitaz ? cenaPrebytku(state, p) : 1;
}

function existujeLegalnyPrebytok(s: MutState, drzi: PlayerId): boolean {
  const vylucenyElder = s.ciel?.typ === "starsi" ? s.ciel.elderId : null;
  if ((s.bitkaStav?.prebytokZostava ?? 0) < cenaPosunuPrebytkom(s as GameState, drzi)) return false;
  return s.starsi.some(
    (e) =>
      e.elderId !== vylucenyElder &&
      posunMarker(e as ElderState, opponentOf(drzi), false) !== null,
  );
}

/** Kandidáti na náhradu staršieho: Občan/Zviera (nie Nástroj, nie Kliatba). */
export function najdiNahradnikov(s: GameState, data: GameData, p: PlayerId): KartaVolba[] {
  const vyhovuje = (defId: string): boolean => {
    const def = data.cards.get(defId);
    if (def === undefined) return false;
    return (
      (def.tags.includes("Občan") || def.tags.includes("Zviera")) &&
      !def.tags.includes("Nástroj") &&
      !def.tags.includes("Kliatba")
    );
  };
  const out: KartaVolba[] = [];
  for (const kde of ["ruka", "odhadzovaci", "doberaci"] as const) {
    const videne = new Set<string>();
    for (const k of s.hraci[p][kde]) {
      if (!vyhovuje(k.defId) || videne.has(k.defId)) continue;
      videne.add(k.defId);
      out.push({ defId: k.defId, kde });
    }
  }
  return out;
}

function cmdExekutorTool(
  s: MutState,
  data: GameData,
  cmd: { defId: string; kde: KartaZdroj },
  p: PlayerId,
  events: Event[],
): void {
  const b = s.bitkaStav;
  need(s.faza === "bitka" && b !== null && b.krok === "exekutor" && b.caka === p, "Nečaká sa na Nástroj.");
  const idx = s.hraci[p][cmd.kde].findIndex((k) => k.defId === cmd.defId);
  need(idx !== -1, "Taký Nástroj tam nemáš.");
  const karta = s.hraci[p][cmd.kde][idx] as CardInstance;
  need(
    defOf(data, karta).tags.includes("Nástroj") || karta.defId === "zahradkar",
    "Karta nie je Nástroj.",
  );
  hrac(s, p)[cmd.kde].splice(idx, 1);
  // Polovica priznaných dlhov zhorí (nadol).
  const dlhy = s.hraci[p].priznane.filter((k) => k.defId === "dlh");
  const ostane = dlhyPoExekucii(dlhy.length);
  let spalit = dlhy.length - ostane;
  hrac(s, p).priznane = s.hraci[p].priznane.filter((k) => {
    if (k.defId === "dlh" && spalit > 0) {
      spalit--;
      return false;
    }
    return true;
  });
  events.push({
    type: "log",
    text: `Hráč ${p + 1} odovzdal ${defOf(data, karta).name} exekútorovi, zhorela polovica priznaných dlhov.`,
  });
  const bb = s.bitkaStav;
  if (bb !== null) bb.exekutorHotovy[p] = true;
  pokracujBitku(s, data, events);
}

function cmdPohorsenie(
  s: MutState,
  data: GameData,
  cmd: { elderId: string },
  p: PlayerId,
  events: Event[],
): void {
  const b = s.bitkaStav;
  need(s.faza === "bitka" && b !== null && b.krok === "pohorsenie" && b.caka === p, "Nečaká sa na Pohoršenie.");
  need(b.pohorsenieZostava[p] > 0, "Nemáš aktívne Pohoršenie.");
  const elder = s.starsi.find((e) => e.elderId === cmd.elderId);
  need(elder !== undefined, "Taký starší nie je.");
  need(opakovanePohorsenie(s as GameState) || !b.pohnuteMarkery.includes(cmd.elderId), "Tento marker sa už v bitke posunul.");
  const nova = posunMarker(elder as ElderState, opponentOf(p), true, pohorsenieNaKraj(s as GameState, p));
  need(nova !== null, "Marker sa nedá posunúť.");
  elder.marker = nova;
  b.pohnuteMarkery.push(cmd.elderId);
  b.pohorsenieZostava[p] -= 1;
  events.push({
    type: "log",
    text: `Pohoršenie: marker staršieho ${cmd.elderId} sa posúva k hráčovi ${opponentOf(p) + 1}.`,
  });
  skontrolujVydesenie(s, data, events);
  pokracujBitku(s, data, events);
}

/** Poškodenie + výsledok (PRAVIDLA §8.3–8.4) — čisto automatické. */
function vyhodnotPoskodenie(s: MutState, data: GameData, events: Event[]): void {
  const b = s.bitkaStav;
  if (b === null) return;
  const vRuke = (p: PlayerId): number => s.hraci[p].ruka.filter((k) => k.defId === "abstak").length;
  const damage = poskodenieBitky(data, s as GameState, b.sums as readonly [ActionSums, ActionSums], [vRuke(0), vRuke(1)]);
  const outcome = battleOutcome(damage, s.utocnik, s.ciel?.typ === "starsi");
  b.damage = damage as DeepMutable<DamageResult>;
  b.vitaz = outcome.vitaz;
  b.prebytokDrzi = outcome.prebytokDrzi;
  // puska (Dedičstvo): prebytok, ktorý súper rozdeľuje proti jej majiteľovi, je o 2 menší.
  b.prebytokZostava =
    outcome.prebytokDrzi === null
      ? 0
      : Math.max(0, outcome.prebytok - prebytokProtiZlava(s as GameState, opponentOf(outcome.prebytokDrzi)));
  b.krok = "prebytok";
  events.push({
    type: "bitkaVysledok",
    damage,
    sums: b.sums as readonly [ActionSums, ActionSums],
    vitaz: outcome.vitaz,
    prebytok: outcome.prebytok,
    prebytokDrzi: outcome.prebytokDrzi,
    karty: prispevkyKariet(lineState(s as GameState), evaluateLine(data, lineState(s as GameState))),
  });
  manualEfekty(s, data, "Výhra", events);
  manualEfekty(s, data, "Prehra", events);
}

function cmdPrebytok(
  s: MutState,
  data: GameData,
  cmd: { elderId: string },
  p: PlayerId,
  events: Event[],
): void {
  const b = s.bitkaStav;
  need(s.faza === "bitka" && b !== null && b.krok === "prebytok" && b.caka === p, "Nečaká sa na prebytok.");
  need(b.prebytokZostava > 0, "Prebytok je rozdelený.");
  // Miňištrant (Výhra): posun víťaza stojí viac — na neúplný posun prebytok nestačí.
  const cena = cenaPosunuPrebytkom(s as GameState, p);
  need(b.prebytokZostava >= cena, `Posun markera ťa stojí ${cena} (Miňištrant), prebytok je len ${b.prebytokZostava}.`);
  const vyluceny = s.ciel?.typ === "starsi" ? s.ciel.elderId : null;
  need(cmd.elderId !== vyluceny, "Prebytok sa delí medzi ostatných starších.");
  const elder = s.starsi.find((e) => e.elderId === cmd.elderId);
  need(elder !== undefined, "Taký starší nie je.");
  // Prebytok posúva marker k súperovi držiteľa [R8.4] — pri víťazovi
  // je to porazený, ako hovorí pravidlo.
  const nova = posunMarker(elder as ElderState, opponentOf(p), false);
  need(nova !== null, "Marker sa nedá posunúť.");
  elder.marker = nova;
  if (!b.prebytokPosunute.includes(cmd.elderId)) b.prebytokPosunute.push(cmd.elderId);
  b.prebytokZostava = Math.max(0, b.prebytokZostava - cena);
  events.push({
    type: "log",
    text: `Prebytok: marker staršieho ${cmd.elderId} sa posúva k hráčovi ${opponentOf(p) + 1}.`,
  });
  skontrolujVydesenie(s, data, events);
  pokracujBitku(s, data, events);
}

function cmdNahrada(
  s: MutState,
  data: GameData,
  cmd: { defId: string; kde: KartaZdroj; marker: MarkerPos },
  p: PlayerId,
  events: Event[],
): void {
  const b = s.bitkaStav;
  need(s.faza === "bitka" && b !== null && b.krok === "nahrada" && b.caka === p, "Nečaká sa na náhradu.");
  need(cmd.marker >= 3 && cmd.marker <= 5, "Marker musí skončiť v sivej zóne.");
  need(cmd.kde !== "dedicstvo", "Náhrada nejde z Dedičstva.");
  const elderId = s.ciel?.elderId ?? null;
  need(elderId !== null, "Nie je bitka o staršieho.");
  const elder = s.starsi.find((e) => e.elderId === elderId);
  need(elder !== undefined, "Starší sa stratil.");
  need(
    najdiNahradnikov(s as GameState, data, p).some(
      (k) => k.defId === cmd.defId && k.kde === cmd.kde,
    ),
    "Náhradou smie byť len Občan alebo Zviera z tvojho balíčka.",
  );
  const idx = s.hraci[p][cmd.kde].findIndex((k) => k.defId === cmd.defId);
  need(idx !== -1, "Karta sa nenašla.");
  const kandidat = s.hraci[p][cmd.kde][idx] as CardInstance;
  hrac(s, p)[cmd.kde].splice(idx, 1);

  // Karta staršieho ide do balíčka víťaza, náhrada na ukazovateľ.
  hrac(s, p).odhadzovaci.push(elder.karta as DeepMutable<CardInstance>);
  elder.karta = kandidat as DeepMutable<CardInstance>;
  elder.nahradeny = true;
  elder.ziskal = p;
  elder.marker = cmd.marker;
  elder.markerZaciatokKola = cmd.marker;
  events.push({
    type: "log",
    text: `Hráč ${p + 1} získava staršieho ${elderId}; na ukazovateľ kladie ${defOf(data, kandidat).name}.`,
  });
  b.caka = null;
  vypiPoldeci(s, data, events);
  b.krok = "vestica";
  pokracujBitku(s, data, events);
}

/** Krok 5 — poldeci: NA EX sa vypijú, aktívne akcie Poldeci otáčajú vypité. */
function vypiPoldeci(s: MutState, data: GameData, events: Event[]): void {
  const b = s.bitkaStav;
  if (b === null) return;
  for (const partia of s.strany) {
    for (const placed of partia) {
      if (placed.naexBy !== undefined) {
        hrac(s, placed.naexBy as PlayerId).poldeciVypite += 1;
        hrac(s, placed.naexBy as PlayerId).nerestiTotoKolo += 1;
        delete (placed as { naexBy?: PlayerId }).naexBy;
      }
    }
  }
  for (const p of [0, 1] as const) {
    // nealko: akcia Poldeci nedopĺňa poldeci.
    let otocenia = b.sums[p].Poldeci ?? 0;
    while (otocenia > 0 && s.hraci[p].poldeciVypite > 0) {
      hrac(s, p).poldeciVypite -= 1;
      hrac(s, p).poldeciPlne += 1;
      otocenia--;
    }
  }
  events.push({ type: "log", text: "Poldeci z NA EX sa vypili; aktívne akcie Poldeci otočili vypité." });
}

function cmdLiecba(
  s: MutState,
  data: GameData,
  cmd: { cirhozaUid: number; zavislyUid: number; senokUid: number },
  p: PlayerId,
  events: Event[],
): void {
  const b = s.bitkaStav;
  need(s.faza === "bitka" && b !== null && b.krok === "liecba" && b.caka === p, "Nečaká sa na Liečbu.");
  const cirhozaIdx = s.hraci[p].priznane.findIndex(
    (k) => k.uid === cmd.cirhozaUid && k.defId === "cirhoza",
  );
  need(cirhozaIdx !== -1, "Taká priznaná Cirhóza nie je.");
  const kdeZavisly = najdiVLinii(s, cmd.zavislyUid);
  const zavisly = kdeZavisly === null ? undefined : (s.strany[kdeZavisly.strana][kdeZavisly.index] as PlacedCard | undefined);
  need(kdeZavisly !== null && zavisly !== undefined && zavisly.playedBy === p, "Závislý musí byť tvoja karta v línii.");
  need(defOf(data, zavisly.card).tags.includes("Závislý"), "Karta nemá tag Závislý.");
  const senokIdx = s.senok.findIndex((k) => k.uid === cmd.senokUid);
  need(senokIdx !== -1, "Karta nie je v šenku.");

  hrac(s, p).priznane.splice(cirhozaIdx, 1);
  s.strany[kdeZavisly.strana].splice(kdeZavisly.index, 1);
  pridajKliatbu(s, data, p, "dlh", events);
  const zoSenku = s.senok.splice(senokIdx, 1)[0] as CardInstance;
  hrac(s, p).ruka.push(zoSenku as DeepMutable<CardInstance>);
  events.push({
    type: "log",
    text: `Hráč ${p + 1} sa lieči: spálil Cirhózu a ${defOf(data, zavisly.card).name}, berie kartu zo šenku.`,
  });
  b.liecbaHotova[p] = true;
  b.caka = null;
  pokracujBitku(s, data, events);
}

function cmdPohreb(
  s: MutState,
  data: GameData,
  cmd: { cirhozaUid: number; kartaUid: number },
  p: PlayerId,
  events: Event[],
): void {
  const b = s.bitkaStav;
  need(s.faza === "bitka" && b !== null && b.krok === "liecba" && b.caka === p, "Nečaká sa na Pohreb.");
  const cirhozaIdx = s.hraci[p].priznane.findIndex(
    (k) => k.uid === cmd.cirhozaUid && k.defId === "cirhoza",
  );
  need(cirhozaIdx !== -1, "Taká priznaná Cirhóza nie je.");
  const kde = najdiVLinii(s, cmd.kartaUid);
  need(kde !== null && s.strany[kde.strana][kde.index]?.playedBy === p, "Pochovať môžeš len svoju kartu v línii.");

  hrac(s, p).priznane.splice(cirhozaIdx, 1);
  const pochovana = s.strany[kde.strana].splice(kde.index, 1)[0] as PlacedCard;
  events.push({
    type: "log",
    text: `Hráč ${p + 1} robí Pohreb: spálil Cirhózu a ${defOf(data, pochovana.card).name}.`,
  });
  b.liecbaHotova[p] = true;
  b.caka = null;
  pokracujBitku(s, data, events);
}

function cmdSkipLiecba(s: MutState, data: GameData, p: PlayerId, events: Event[]): void {
  const b = s.bitkaStav;
  need(s.faza === "bitka" && b !== null && b.krok === "liecba" && b.caka === p, "Nečaká sa na Liečbu.");
  b.liecbaHotova[p] = true;
  b.caka = null;
  pokracujBitku(s, data, events);
}

/** Návrat kariet, kliatby kola, kontrola konca, ďalšie kolo. */
function koniecBitky(s: MutState, data: GameData, events: Event[]): void {
  const b = s.bitkaStav;
  if (b === null) return;
  // null = remíza o staršieho: nikto nevyhral ani neprehral.
  const vitaz = b.vitaz as PlayerId | null;
  const porazeny = vitaz === null ? null : opponentOf(vitaz);

  // Michal 2026-10-18: proti komu sa delil prebytok, dostane cigaretu za každého
  // posunutého staršieho (viac posunov toho istého = 1 cigareta).
  if (b.prebytokDrzi !== null && b.prebytokPosunute.length > 0) {
    const proti = opponentOf(b.prebytokDrzi as PlayerId);
    hrac(s, proti).cigarety += b.prebytokPosunute.length;
    events.push({
      type: "log",
      text: `Hráč ${proti + 1} dostáva ${b.prebytokPosunute.length} cigariet za posunutých starších.`,
    });
  }

  // Efekty Výhra/Prehra — ešte kým karty ležia v partiách.
  // vyherny_automat (Dedičstvo): Výhra = 2 cigarety, Prehra = 1 Dlh.
  if (vitaz !== null && vDedicstve(s as GameState, vitaz, "vyherny_automat")) {
    hrac(s, vitaz).cigarety += KONSTANTY.EFEKT.AUTOMAT_VYHRA_CIGARETY;
    events.push({ type: "log", text: `Výherný automat: hráč ${vitaz + 1} vyhral ${KONSTANTY.EFEKT.AUTOMAT_VYHRA_CIGARETY} cigarety.` });
  }
  if (porazeny !== null && vDedicstve(s as GameState, porazeny, "vyherny_automat")) {
    for (let i = 0; i < KONSTANTY.EFEKT.AUTOMAT_PREHRA_DLHY; i++) pridajKliatbu(s, data, porazeny, "dlh", events);
  }
  // podvodnik: pri Prehre ukradni súperovi 2 cigarety.
  if (vitaz !== null && porazeny !== null && vPartii(s as GameState, porazeny, "podvodnik")) {
    const ukradne = Math.min(s.hraci[vitaz].cigarety, KONSTANTY.EFEKT.PODVODNIK_CIGARETY);
    if (ukradne > 0) {
      hrac(s, vitaz).cigarety -= ukradne;
      hrac(s, porazeny).cigarety += ukradne;
      events.push({ type: "log", text: `Podvodník: hráč ${porazeny + 1} ukradol ${ukradne} cigariet.` });
    }
  }

  // Milujúca manželka (Furt): ráta sa ešte pred návratom kariet z línie.
  const manzelky = ([0, 1] as const).map((p) => manzelkyHraca(s as GameState, p));

  // 7. Návrat kariet — do odhadzovacieho balíčka hráča, ktorý ich zahral.
  //    Zahodené (Dievčina na vydaj) sa spália.
  for (const partia of s.strany) {
    for (const placed of partia) {
      if (b.spalit.includes(placed.card.uid)) continue;
      hrac(s, placed.playedBy as PlayerId).odhadzovaci.push(placed.card as DeepMutable<CardInstance>);
    }
  }
  s.strany = [[], []];

  // Lokalitu si berie víťaz — po Benzínke ju nikto nevyhrá a prepadne.
  const lokalita = cielLokalita(s as GameState);
  if (lokalita !== null && b.lokalitaPrepadne) {
    s.prepadnute.push(lokalita as DeepMutable<CardInstance>);
    events.push({ type: "log", text: `Lokalitu ${defOf(data, lokalita).name} nikto nevyhral — prepadla.` });
  } else if (lokalita !== null && vitaz !== null) {
    s.ovladnute.push({ karta: lokalita, hrac: vitaz } as DeepMutable<OvladnutaLokalita>);
    events.push({ type: "log", text: `Hráč ${vitaz + 1} ovládol lokalitu ${defOf(data, lokalita).name}.` });
  }

  // Absťák (pravidlá v2): menej nerestí než minulé kolo → Absťák rovno do
  // hracej oblasti (priznaný); viac → jeden Absťák späť do zásoby. Prvé kolo
  // len nastaví základ.
  // Log uvádza počty nerestí — playtest 20261019-055945: hráči nevedeli,
  // odkiaľ sa Absťák berie.
  if (s.kolo === 1) {
    events.push({
      type: "log",
      text: `Základ závislosti: hráč 1 mal v kole ${textNeresti(s.hraci[0].nerestiTotoKolo)}, hráč 2 ${textNeresti(s.hraci[1].nerestiTotoKolo)}. Kto bude mať v ďalšom kole menej, dostane Absťák.`,
    });
  }
  for (const p of [0, 1] as const) {
    const teraz = s.hraci[p].nerestiTotoKolo;
    const minule = s.hraci[p].nerestiMinuleKolo;
    // Milujúca manželka: Absťák aj pri rovnakom počte nerestí (každá ďalšia o 1 viac).
    const manzelka = manzelky[p] ?? 0;
    if (s.kolo > 1 && teraz < minule + manzelka) {
      hrac(s, p).priznane.push(novaInstancia(s, data, "abstak") as DeepMutable<CardInstance>);
      // Absťák sa rovno priznáva — a priznanie kliatby dáva kartu (Michal 2026-10-19).
      const dobral = tahaj(s, p, 1, events).length;
      events.push({
        type: "log",
        text: `Hráč ${p + 1} získava Absťák: v kole mal ${textNeresti(teraz)}, v predošlom ${textNeresti(minule)}${manzelka > 0 ? ` (Milujúca manželka: Absťák aj pri ${textNeresti(minule + manzelka - 1)})` : ""}. Každý Absťák mu v bitke uberie 1 tuhé.${dobral > 0 ? " Za priznaný Absťák si doberá kartu." : ""}`,
      });
    } else if (s.kolo > 1 && teraz > minule) {
      const idx = s.hraci[p].priznane.findIndex((k) => k.defId === "abstak");
      if (idx !== -1) {
        hrac(s, p).priznane.splice(idx, 1);
        events.push({ type: "log", text: `Hráč ${p + 1} sa zbavuje Absťáku: v kole mal ${textNeresti(teraz)}, v predošlom ${textNeresti(minule)}.` });
      }
    }
    hrac(s, p).nerestiMinuleKolo = s.hraci[p].nerestiTotoKolo;
    hrac(s, p).nerestiTotoKolo = 0;
  }

  s.bitkaStav = null;
  s.ciel = null;
  s.cirhozyVKole = [0, 0];
  s.naexVKole = [false, false];

  skontrolujVydesenie(s, data, events, true);
  if (s.koniec !== null) return;
  skontrolujBalicky(s, data, events);
  if (s.koniec !== null) return;

  // Posledná bitka o lokalitu → záverečné bodovanie.
  if (s.lokalityVHre.length === 0) {
    zaverecneBodovanie(s, data, events);
    return;
  }

  // Ďalšie kolo: útočníkom je porazený; po remíze o staršieho ostáva ten istý.
  s.kolo += 1;
  if (vitaz !== null) s.utocnik = opponentOf(vitaz);
  s.faza = "volbaCiela";
  events.push({ type: "faza", faza: "volbaCiela" });
  for (const elder of s.starsi) elder.markerZaciatokKola = elder.marker;
  events.push({ type: "log", text: `Kolo ${s.kolo}: útočí hráč ${s.utocnik + 1}.` });
  dolejNaZaciatkuKola(s, events);
  doberPoBitke(s, events);
}

/** Začiatok kola: vypité poldeci sa čiastočne otočia na plné (PRAVIDLA §5). */
function dolejNaZaciatkuKola(s: MutState, events: Event[]): void {
  for (const p of [0, 1] as const) {
    const pocet = Math.min(KONSTANTY.POLDECI_NA_ZACIATKU_KOLA, s.hraci[p].poldeciVypite);
    if (pocet <= 0) continue;
    hrac(s, p).poldeciVypite -= pocet;
    hrac(s, p).poldeciPlne += pocet;
    events.push({ type: "log", text: `Hráč ${p + 1} si na začiatku kola dolieva ${pocet} poldeci.` });
  }
}

/**
 * Po každej bitke si každý hráč dobere KARTY_PO_BITKE kariet (Michal
 * 2026-10-19 — namiesto doplnenia ruky na 5). Limit ruky nie je.
 */
function doberPoBitke(s: MutState, events: Event[]): void {
  for (const p of [0, 1] as const) {
    const tahane = tahaj(s, p, KONSTANTY.KARTY_PO_BITKE, events);
    if (tahane.length > 0) {
      events.push({ type: "log", text: `Hráč ${p + 1} si po bitke doberá ${tahane.length} ${tahane.length === 1 ? "kartu" : "karty"}.` });
    }
  }
}

// ---------------------------------------------------------------------------
// Konce hry

function ukonciHru(
  s: MutState,
  _data: GameData,
  vitaz: PlayerId | null,
  dovod: string,
  events: Event[],
): void {
  s.koniec = { vitaz, dovod, body: null };
  s.faza = "koniec";
  events.push({ type: "koniec", vitaz, dovod, body: null });
}

/** Koľko starších musí hráč vydesiť na výhru — polovica (PRAVIDLA §1). */
export function prahVydesenia(state: { readonly starsi: readonly ElderState[] }): number {
  return Math.ceil(state.starsi.length / 2);
}

/**
 * Vydesenie aspoň polovice starších → výhra (PRAVIDLA §1). Rátajú sa aj
 * nahradení — ostávajú v hre (Michal 2026-10-12). Ohlásené vydesenie
 * (Michal 2026-10-16): kto dosiahne prah, vyhrá, až keď ho udrží do konca
 * NASLEDUJÚCEHO kola — súper má kolo na odpoveď (bitka o staršieho).
 */
function skontrolujVydesenie(s: MutState, data: GameData, events: Event[], koniecKola = false): void {
  if (s.koniec !== null) return;
  const vHre = s.starsi;
  if (vHre.length === 0) return;
  const prah = prahVydesenia(s as GameState);
  for (const p of [0, 1] as const) {
    const vydeseni = vHre.filter((e) => vydesil(e as ElderState, p)).length;
    const ohlasene = s.ohlaseneVydesenie[p];
    if (vydeseni < prah) {
      if (ohlasene !== null) {
        s.ohlaseneVydesenie[p] = null;
        events.push({ type: "log", text: `Hráč ${p + 1} už nemá vydesenú polovicu starších (${vydeseni}/${prah}) — hrozba vydesenia padla.` });
      }
      continue;
    }
    if (ohlasene === null) {
      s.ohlaseneVydesenie[p] = s.kolo;
      events.push({
        type: "log",
        text: `Hráč ${p + 1} vydesil ${vydeseni} z ${vHre.length} starších! Ak ich udrží do konca ďalšieho kola, vyhrá.`,
      });
    } else if (koniecKola && s.kolo > ohlasene) {
      ukonciHru(s, data, p, `Hráč ${p + 1} udržal vydesených ${vydeseni} z ${vHre.length} starších.`, events);
      return;
    }
  }
}

/** Pokles balíčka pod 5 → okamžitá prehra (PRAVIDLA §1). */
function skontrolujBalicky(s: MutState, data: GameData, events: Event[]): void {
  if (s.koniec !== null) return;
  for (const p of [0, 1] as const) {
    if (velkostBalicka(s.hraci[p] as PlayerState) < KONSTANTY.MIN_VELKOST_BALICKA) {
      ukonciHru(
        s,
        data,
        opponentOf(p),
        `Balíček hráča ${p + 1} klesol pod ${KONSTANTY.MIN_VELKOST_BALICKA} kariet.`,
        events,
      );
      return;
    }
  }
}

function zaverecneBodovanie(s: MutState, data: GameData, events: Event[]): void {
  const body: [number, number] = [0, 0];

  // Body sa rátajú len cez scorecardy: každá aktívna podmienka boduje obom
  // hráčom (Michal 2026-10-16), marker staršieho určuje len priazeň.
  for (const elder of s.starsi) {
    const score = elderScore(data, s as GameState, elder as ElderState);
    body[0] += score.body[0];
    body[1] += score.body[1];
  }

  const vitaz: PlayerId | null = body[0] === body[1] ? null : body[0] > body[1] ? 0 : 1;
  s.koniec = { vitaz, dovod: "Odohrala sa posledná bitka o lokalitu.", body };
  s.faza = "koniec";
  events.push({ type: "koniec", vitaz, dovod: s.koniec.dovod, body });
}

// ---------------------------------------------------------------------------
// Legálne príkazy (pre klienta aj smoke test)

export function legalCommands(data: GameData, state: GameState, p: PlayerId): Command[] {
  if (!mozeHrat(state, p)) return [];
  const out: Command[] = [];

  switch (state.faza) {
    case "volbaCiela": {
      for (const lok of state.lokalityVHre) {
        out.push({ type: "chooseLocation", uid: lok.uid, otocena: false });
        out.push({ type: "chooseLocation", uid: lok.uid, otocena: true });
      }
      for (const elder of state.starsi) {
        if (!bitkaOStarsiehoMozna(elder)) continue;
        out.push({ type: "chooseElder", elderId: elder.elderId, otocena: false });
        out.push({ type: "chooseElder", elderId: elder.elderId, otocena: true });
      }
      break;
    }
    case "draft": {
      const d = state.draftStav;
      if (d === null) break;
      if (d.krok === "stavba") {
        // Všetky rozdelenia by boli tisíce príkazov — vypíšu sa súvislé okná
        // (každé je legálne; apply prijme ľubovoľný výber správnej veľkosti).
        const b = d.balicky[p].map((k) => k.uid);
        const krok = krokStavby(b.length);
        const n = krok.doSenku + krok.odhod;
        for (let i = 0; i + n <= b.length; i++) {
          const okno = b.slice(i, i + n);
          out.push({ type: "stavbaSenku", doSenku: okno.slice(0, krok.doSenku), odhod: okno.slice(krok.doSenku) });
          if (krok.odhod > 0) out.push({ type: "stavbaSenku", doSenku: okno.slice(krok.odhod), odhod: okno.slice(0, krok.odhod) });
        }
      } else if (!d.hotovo[p]) {
        out.push({ type: "draftStop" });
        const senok = state.senok.map((k) => k.uid);
        for (const pocet of moznostiZoSenku(state, p)) {
          if (pocet === 1) for (const uid of senok) out.push({ type: "draftBer", uids: [uid] });
          else for (let i = 0; i < senok.length; i++) for (let j = i + 1; j < senok.length; j++) out.push({ type: "draftBer", uids: [senok[i]!, senok[j]!] });
        }
      }
      break;
    }
    case "zhromazdenie": {
      const z = state.zhromazdenieStav;
      if (z === null) break;
      out.push({ type: "pass" });
      const vylozenia: Command[] = [];
      for (const karta of state.hraci[p].ruka) {
        for (const target of cieleVykladania(data, state.strany, p, karta, z.zostavaLimit[p], state.hraci[p].cigarety >= cenaDedicstva(state), cielLokalitaId(state))) {
          vylozenia.push({ type: "place", uid: karta.uid, target });
        }
      }
      // Vypiť len znižuje limit — keď sa nedá nič vyložiť, nepomôže (priznanie
      // ťah neodovzdáva, tomu vypitie tiež nepridá).
      const doLinie = vylozenia.some((c) => c.type === "place" && c.target !== "priznanie");
      if (doLinie && state.hraci[p].poldeciPlne > 0 && !z.pasoval[p] && !zakazVypit(state)) out.push({ type: "vypit" });
      // Fajčiť (karta za cigaretu) smie hráč kedykoľvek na svojom ťahu — okrem Benzínky.
      if (state.hraci[p].cigarety > 0 && !zakazFajcit(state)) out.push({ type: "smoke", pocet: 1 });
      out.push(...vylozenia);
      break;
    }
    case "pitka": {
      if (state.vizia !== null) {
        out.push({ type: "vizia", vziat: true }, { type: "vizia", vziat: false });
        break;
      }
      const pitka = state.pitkaStav;
      if (pitka === null) break;
      if (pitka.reakcia === p) {
        // Reakcia na NA EX: jedna karta do línie mimo limitu, alebo nič.
        out.push({ type: "bezReakcie" });
        for (const karta of state.hraci[p].ruka) {
          for (const target of cieleVykladania(data, state.strany, p, karta, Number.POSITIVE_INFINITY, true, cielLokalitaId(state))) {
            if (target === "vlastna" || target === "superova") out.push({ type: "place", uid: karta.uid, target });
          }
        }
        break;
      }
      // Krčma: kým je NA EX možné a poldeci plný, skončiť Pitku sa nedá.
      if (!krcmaVyzaduje(data, state, p)) out.push({ type: "skipNaex" });
      for (const uid of moznostiNaex(data, state, p)) out.push({ type: "naex", uid });
      if (!pitka.postarka[p] && efektHraca(state, p, "postarka") && !efektPotlaceny(data, state, p, "postarka")) {
        for (let n = 1; n <= KONSTANTY.EFEKT.POSTARKA_KARTY; n++) out.push({ type: "postarka", pocet: n });
      }
      if (
        !pitka.starosta[p] &&
        state.hraci[p].cigarety >= 1 &&
        efektHraca(state, p, "starosta") &&
        !efektPotlaceny(data, state, p, "starosta")
      ) {
        for (const k of state.hraci[p].ruka) {
          for (const z of state.senok) out.push({ type: "starosta", rukaUid: k.uid, senokUid: z.uid });
        }
      }
      if (state.hraci[p].cigarety > 0 && !zakazFajcit(state)) out.push({ type: "smoke", pocet: 1 });
      if (vykupZoSrotu(state) && pitka.vykup?.[p] !== true && state.hraci[p].cigarety >= KONSTANTY.EFEKT.ZBERNY_DVOR_CENA) {
        for (const k of state.hraci[p].odhadzovaci) out.push({ type: "vykup", uid: k.uid });
      }
      if (state.hraci[p].cigarety >= barterCena(data, state, p)) {
        out.push({ type: "barter" });
      }
      if (
        state.hraci[p].cigarety >= KONSTANTY.REFILL_CENA &&
        state.hraci[p].poldeciVypite > 0 &&
        !doliatieZakazane(state, p)
      ) {
        out.push({ type: "refillPoldeci" });
      }
      break;
    }
    case "bitka": {
      const b = state.bitkaStav;
      if (b === null || b.caka !== p) break;
      // Výbery viacerých kariet: vypíšu sa súvislé okná (každé je legálne;
      // apply prijme aj ľubovoľný iný výber správnej veľkosti).
      const okna = (uids: readonly number[], k: number): number[][] =>
        k <= 0 ? [[]] : Array.from({ length: Math.max(0, uids.length - k + 1) }, (_, i) => uids.slice(i, i + k));
      if (b.krok === "benzinka") {
        const obcania = obcaniaVLinii(state, data, p).map((o) => o.card.uid);
        for (const uids of okna(obcania, b.benzinkaZostava[p])) out.push({ type: "benzinka", uids });
      } else if (b.krok === "cintorin") {
        out.push({ type: "cintorin", uid: null });
        for (const k of state.hraci[p].ruka) if (defOf(data, k).tags.includes("Nástroj")) out.push({ type: "cintorin", uid: k.uid });
      } else if (b.krok === "zberatel") {
        const ponuka = b.zberatelPonuka[p].map((k) => k.uid);
        for (const uids of okna(ponuka, Math.min(zberatelBerie(data, state, p), ponuka.length))) out.push({ type: "zberatel", uids });
      } else if (b.krok === "vestica") {
        const opp = opponentOf(p);
        const prve = (karty: readonly CardInstance[]): number[] => {
          const videne = new Set<string>();
          return karty.flatMap((k, i) => (videne.has(k.defId) ? [] : (videne.add(k.defId), [i])));
        };
        for (const moja of prve(state.hraci[p].doberaci)) {
          for (const jeho of prve(state.hraci[opp].doberaci)) out.push({ type: "vestica", moja, jeho });
        }
      } else if (b.krok === "exekutor") {
        for (const nastroj of najdiNastroje(state, data, p)) {
          out.push({ type: "exekutorTool", defId: nastroj.defId, kde: nastroj.kde });
        }
      } else if (b.krok === "pohorsenie") {
        for (const elder of state.starsi) {
          if (b.pohnuteMarkery.includes(elder.elderId) && !opakovanePohorsenie(state)) continue;
          if (posunMarker(elder, opponentOf(p), true, pohorsenieNaKraj(state, p)) !== null) {
            out.push({ type: "pohorsenie", elderId: elder.elderId });
          }
        }
      } else if (b.krok === "prebytok") {
        const vyluceny = state.ciel?.typ === "starsi" ? state.ciel.elderId : null;
        if (b.prebytokZostava < cenaPosunuPrebytkom(state, p)) break;
        for (const elder of state.starsi) {
          if (elder.elderId === vyluceny) continue;
          if (posunMarker(elder, opponentOf(p), false) !== null) {
            out.push({ type: "prebytok", elderId: elder.elderId });
          }
        }
      } else if (b.krok === "nahrada") {
        for (const kandidat of najdiNahradnikov(state, data, p)) {
          for (const marker of [3, 4, 5] as const) {
            out.push({ type: "nahrada", defId: kandidat.defId, kde: kandidat.kde, marker });
          }
        }
      } else if (b.krok === "liecba") {
        out.push({ type: "skipLiecba" });
        const cirhozy = state.hraci[p].priznane.filter((k) => k.defId === "cirhoza");
        for (const cirhoza of cirhozy) {
          for (const placed of partiaHraca(state, p)) {
            if (defOf(data, placed.card).tags.includes("Závislý")) {
              for (const zoSenku of state.senok) {
                out.push({
                  type: "liecba",
                  cirhozaUid: cirhoza.uid,
                  zavislyUid: placed.card.uid,
                  senokUid: zoSenku.uid,
                });
              }
            }
            out.push({ type: "pohreb", cirhozaUid: cirhoza.uid, kartaUid: placed.card.uid });
          }
        }
      }
      break;
    }
    default:
      break;
  }
  return out;
}

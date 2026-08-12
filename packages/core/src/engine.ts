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
import type { ActionSums, LineState, PlacedCard } from "./partia.ts";
import { evaluateLine } from "./partia.ts";
import type { PlayerState } from "./player.ts";
import {
  freshPlayer,
  hodnotaViery,
  hodnotaZopar,
  limitVykladania,
  prahCirhozy,
  velkostBalicka,
} from "./player.ts";
import type { DamageResult } from "./battle.ts";
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
} from "./elders.ts";
import { KONSTANTY } from "./constants.ts";
import { jeEfektManual, mozeDoSuperovejPartie } from "./effects.ts";
import type { Favour } from "./types.ts";

// ---------------------------------------------------------------------------
// Stav

export interface CielKola {
  readonly typ: "lokalita" | "starsi";
  /** Karta lokality aktuálneho kola (typ lokalita). */
  readonly lokalita: CardInstance | null;
  readonly elderId: string | null;
}

export interface DraftStav {
  readonly naTahu: PlayerId;
  readonly hotovo: readonly [boolean, boolean];
  readonly noveKarty: readonly [number, number];
}

export interface ZhromazdenieStav {
  readonly naTahu: PlayerId;
  readonly zostavaLimit: readonly [number, number];
  readonly pasoval: readonly [boolean, boolean];
}

export interface PitkaStav {
  readonly naTahu: PlayerId;
  readonly hotovy: readonly [boolean, boolean];
  readonly naexPouzity: readonly [boolean, boolean];
  /** Fyzické cigarety vyfajčené v tejto pitke (počítajú sa do ťahania). */
  readonly fajcenie: readonly [number, number];
}

export type BitkaKrok = "exekutor" | "pohorsenie" | "prebytok" | "nahrada" | "liecba";

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
  readonly liecbaHotova: readonly [boolean, boolean];
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
  readonly ovladnute: readonly OvladnutaLokalita[];
  readonly starsi: readonly ElderState[];
  readonly ciel: CielKola | null;
  readonly lokalitaOtocena: boolean;
  readonly partie: readonly [readonly PlacedCard[], readonly PlacedCard[]];
  readonly pitkyCelkom: number;
  readonly pitkaCislo: number;
  readonly draftStav: DraftStav | null;
  readonly zhromazdenieStav: ZhromazdenieStav | null;
  readonly pitkaStav: PitkaStav | null;
  readonly bitkaStav: BitkaStav | null;
  readonly koniec: KoniecHry | null;
}

type DeepMutable<T> = { -readonly [K in keyof T]: DeepMutable<T[K]> };
type MutState = DeepMutable<GameState>;

// ---------------------------------------------------------------------------
// Príkazy a udalosti

export type Command =
  | { readonly type: "chooseLocation"; readonly uid: number; readonly otocena: boolean }
  | { readonly type: "chooseElder"; readonly elderId: string }
  | { readonly type: "draft"; readonly cigarety: number; readonly karty: readonly number[] }
  | {
      readonly type: "place";
      readonly uid: number;
      readonly target: "vlastna" | "superova" | "priznanie" | "dedicstvo";
    }
  | { readonly type: "pass" }
  | { readonly type: "naex"; readonly uid: number }
  | { readonly type: "skipNaex" }
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
    };

export type KartaZdroj = "ruka" | "doberaci" | "odhadzovaci" | "dedicstvo";

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
      readonly vitaz: PlayerId;
      readonly prebytok: number;
      readonly prebytokDrzi: PlayerId | null;
    }
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

/** Priazeň daného typu pre hráča p (0, ak ju má súper alebo nikto). */
export function priazen(data: GameData, state: GameState, favour: Favour, p: PlayerId): number {
  for (const elder of state.starsi) {
    if (elder.nahradeny) continue;
    // Priazeň sa viaže na pôvodného staršieho (elderId), nie na jeho kartu.
    const def = data.elders.get(elder.elderId);
    if (def?.favour === favour && priazenHraca(elder) === p) return priazenSila(elder);
  }
  return 0;
}

function hrac(s: MutState, p: PlayerId): DeepMutable<PlayerState> {
  return s.hraci[p] as DeepMutable<PlayerState>;
}

function cielLokalita(s: GameState): CardInstance | null {
  return s.ciel?.typ === "lokalita" ? (s.ciel.lokalita ?? null) : null;
}

function lineState(s: GameState): LineState {
  return {
    lokalita: cielLokalita(s),
    lokalitaOtocena: s.lokalitaOtocena,
    partie: s.partie,
  };
}

function tagOf(data: GameData, card: CardInstance): readonly Tag[] {
  return defOf(data, card).tags;
}

function najdiVPartiach(s: MutState, uid: number): { partia: PlayerId; index: number } | null {
  for (const p of [0, 1] as const) {
    const i = s.partie[p].findIndex((pl) => pl.card.uid === uid);
    if (i !== -1) return { partia: p, index: i };
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

/** Pridá kliatbu (dlh / cirhoza / abstak) do ruky hráča. */
function pridajKliatbu(s: MutState, data: GameData, p: PlayerId, defId: string, events: Event[]): void {
  const karta = novaInstancia(s, data, defId);
  hrac(s, p).ruka.push(karta as DeepMutable<CardInstance>);
  events.push({ type: "log", text: `Hráč ${p + 1} získava kartu ${defId === "dlh" ? "Dlh" : defId === "cirhoza" ? "Cirhóza" : "Absťák"}.` });
}

/** Poškodenie pečene + okamžitá Cirhóza pri prahu (PRAVIDLA §7 krok 3). */
function pridajPecen(s: MutState, data: GameData, p: PlayerId, mnozstvo: number, events: Event[]): void {
  if (mnozstvo <= 0) return;
  const player = hrac(s, p);
  player.pecen += mnozstvo;
  const prah = prahCirhozy(priazen(data, s as GameState, "ALKOHOLIK", p));
  while (player.pecen >= prah) {
    player.pecen -= prah;
    pridajKliatbu(s, data, p, "cirhoza", events);
    events.push({ type: "log", text: `Hráč ${p + 1} dosiahol prah pečene (${prah}) — Cirhóza.` });
  }
}

function pocetKariet(player: PlayerState, defId: string, kde: "priznane"): number {
  return player[kde].filter((k) => k.defId === defId).length;
}

/** Absťáky hráča: v ruke, priznané aj vyložené v partiách (jeho karty). */
function pocetAbstakov(s: GameState, p: PlayerId): number {
  let n = s.hraci[p].ruka.filter((k) => k.defId === "abstak").length;
  n += s.hraci[p].priznane.filter((k) => k.defId === "abstak").length;
  for (const partia of s.partie) {
    for (const pl of partia) if (pl.playedBy === p && pl.card.defId === "abstak") n++;
  }
  return n;
}

/** Cirhózy ležiace v partii hráča p (jeho partia = jeho postihy). */
function cirhozyVPartii(s: GameState, p: PlayerId): number {
  return s.partie[p].filter((pl) => pl.card.defId === "cirhoza").length;
}

/** MANUAL pripomienky efektov kariet v hre pre daný spúšťač. */
function manualEfekty(s: MutState, data: GameData, trigger: string, events: Event[]): void {
  const pripomen = (card: CardInstance, hracEfektu: PlayerId | null): void => {
    const def = defOf(data, card);
    if (!def.triggers.includes(trigger as CardDef["triggers"][number])) return;
    if (!jeEfektManual(def.id)) return;
    events.push({
      type: "manualEfekt",
      defId: def.id,
      nazov: def.name,
      text: def.effectText,
      hrac: hracEfektu,
    });
  };
  for (const p of [0, 1] as const) {
    for (const pl of s.partie[p]) pripomen(pl.card as CardInstance, p);
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
  /** Počet lokalít v hre (3 krátka / 6 stredná; kariet je 7). */
  readonly lokalit?: number;
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
    ovladnute: [],
    starsi: [],
    ciel: null,
    lokalitaOtocena: false,
    partie: [[], []],
    pitkyCelkom: 0,
    pitkaCislo: 0,
    draftStav: null,
    zhromazdenieStav: null,
    pitkaStav: null,
    bitkaStav: null,
    koniec: null,
  };

  // Náhodný útočník prvého kola (PRAVIDLA §7).
  const [prvy, rng0] = rngInt(s.rng, 2);
  s.rng = rng0;
  s.utocnik = prvy as PlayerId;

  // Starší — každý s konkrétnym variantom karty.
  for (const elderDef of data.elders.values()) {
    const karta = novaInstancia(s, data, elderDef.id);
    s.starsi.push(freshElder(elderDef.id, karta) as DeepMutable<ElderState>);
  }

  // Lokality: náhodný výber z dostupných.
  const pocetLokalit = Math.min(opts?.lokalit ?? KONSTANTY.LOKALIT_V_HRE, data.lokality.length);
  const [poradieLokalit, rng1] = rngShuffle(s.rng, data.lokality);
  s.rng = rng1;
  for (const def of poradieLokalit.slice(0, pocetLokalit)) {
    s.lokalityVHre.push(novaInstancia(s, data, def.id) as DeepMutable<CardInstance>);
  }

  // Spoločný doberací balíček: kópie všetkých kariet okrem lokalít,
  // starešinov a čistých kliatob (tie vznikajú akciami).
  const KLIATBY = new Set(["dlh", "cirhoza", "abstak"]);
  const spolocne: CardInstance[] = [];
  for (const def of data.cards.values()) {
    if (def.tags.includes("Lokalita") || def.tags.includes("Starešina")) continue;
    if (KLIATBY.has(def.id)) continue;
    for (let i = 0; i < KONSTANTY.KOPIE_V_SPOLOCNOM_BALICKU; i++) {
      spolocne.push(novaInstancia(s, data, def.id));
    }
  }
  const [zamiesane, rng2] = rngShuffle(s.rng, spolocne);
  s.rng = rng2;
  s.spolocnyBalicek = zamiesane as DeepMutable<CardInstance>[];

  // Štartovacie ruky (TODO rozdelenie — otvorená otázka č. 7, viď constants).
  for (const p of [0, 1] as const) {
    for (const [defId, pocet] of Object.entries(KONSTANTY.START_RUKA)) {
      for (let i = 0; i < pocet; i++) {
        hrac(s, p).ruka.push(novaInstancia(s, data, defId) as DeepMutable<CardInstance>);
      }
    }
  }

  doplnSenok(s);
  return s as GameState;
}

/** Šenok sa dopĺňa na počet nenahradených starších [R9]. */
function doplnSenok(s: MutState): void {
  const cielovy = s.starsi.filter((e) => !e.nahradeny).length;
  while (s.senok.length < cielovy && s.spolocnyBalicek.length > 0) {
    s.senok.push(s.spolocnyBalicek.shift() as DeepMutable<CardInstance>);
  }
}

// ---------------------------------------------------------------------------
// Kto je na ťahu

export function naTahu(state: GameState): PlayerId | null {
  if (state.koniec !== null) return null;
  switch (state.faza) {
    case "volbaCiela":
      return state.utocnik;
    case "draft":
      return state.draftStav?.naTahu ?? null;
    case "zhromazdenie":
      return state.zhromazdenieStav?.naTahu ?? null;
    case "pitka":
      return state.pitkaStav?.naTahu ?? null;
    case "bitka":
      return state.bitkaStav?.caka ?? null;
    default:
      return null;
  }
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

  need(naTahu(state) === hracId, "Nie si na ťahu.");

  switch (cmd.type) {
    case "chooseLocation":
      cmdChooseLocation(s, data, cmd, hracId, events);
      break;
    case "chooseElder":
      cmdChooseElder(s, data, cmd, hracId, events);
      break;
    case "draft":
      cmdDraft(s, data, cmd, hracId, events);
      break;
    case "place":
      cmdPlace(s, data, cmd, hracId, events);
      break;
    case "pass":
      cmdPass(s, data, hracId, events);
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
      cmdBarter(s, hracId, events);
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

  return { state: s as GameState, events };
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
  s.draftStav = { naTahu: obranca(s), hotovo: [false, false], noveKarty: [0, 0] };
}

function cmdChooseElder(
  s: MutState,
  data: GameData,
  cmd: { elderId: string },
  p: PlayerId,
  events: Event[],
): void {
  need(s.faza === "volbaCiela", "Teraz sa nevyberá cieľ.");
  const elder = s.starsi.find((e) => e.elderId === cmd.elderId);
  need(elder !== undefined, "Taký starší nie je.");
  need(bitkaOStarsiehoMozna(elder as ElderState), "Marker nie je aspoň v oranžovej zóne.");
  s.ciel = { typ: "starsi", lokalita: null, elderId: cmd.elderId };
  events.push({
    type: "log",
    text: `Hráč ${p + 1} vyvolal bitku o staršieho ${defOf(data, elder.karta as CardInstance).name}.`,
  });
  // Bez draftu, vždy práve jedna pitka (PRAVIDLA §7).
  s.pitkyCelkom = 1;
  s.pitkaCislo = 0;
  zacniZhromazdenie(s, data, events);
}

function cmdDraft(
  s: MutState,
  data: GameData,
  cmd: { cigarety: number; karty: readonly number[] },
  p: PlayerId,
  events: Event[],
): void {
  need(s.faza === "draft" && s.draftStav !== null, "Teraz nie je draft.");
  need(cmd.cigarety >= 0 && cmd.cigarety <= 3, "Cigarety musia byť 0–3.");
  const chceKariet = Math.min(3 - cmd.cigarety, s.senok.length);
  need(cmd.karty.length === chceKariet, `Treba vybrať presne ${chceKariet} kariet zo šenku.`);

  hrac(s, p).cigarety += cmd.cigarety;
  for (const uid of cmd.karty) {
    const idx = s.senok.findIndex((k) => k.uid === uid);
    need(idx !== -1, "Karta nie je v šenku.");
    const karta = s.senok.splice(idx, 1)[0] as CardInstance;
    hrac(s, p).ruka.push(karta as DeepMutable<CardInstance>);
  }
  events.push({
    type: "log",
    text: `Hráč ${p + 1} si vzal ${cmd.cigarety} cigariet a ${cmd.karty.length} kariet zo šenku.`,
  });

  const draft = s.draftStav;
  draft.hotovo[p] = true;
  draft.noveKarty[p] = cmd.karty.length;
  if (!draft.hotovo[opponentOf(p)]) {
    draft.naTahu = opponentOf(p);
    return;
  }

  // Počet pitiek = 1 + |rozdiel nových kariet| (PRAVIDLA §7).
  s.pitkyCelkom = 1 + Math.abs(draft.noveKarty[0] - draft.noveKarty[1]);
  s.pitkaCislo = 0;
  s.draftStav = null;
  skontrolujBalicky(s, data, events);
  if (s.koniec !== null) return;
  zacniZhromazdenie(s, data, events);
}

// ---------------------------------------------------------------------------
// Zhromaždenie

function zacniZhromazdenie(s: MutState, data: GameData, events: Event[]): void {
  s.faza = "zhromazdenie";
  events.push({ type: "faza", faza: "zhromazdenie" });
  // Limit sa počíta nanovo na začiatku každého Zhromaždenia (PRAVIDLA §5).
  s.zhromazdenieStav = {
    naTahu: obranca(s),
    zostavaLimit: [
      limitVykladania(s.hraci[0] as PlayerState, s.partie as LineState["partie"], 0),
      limitVykladania(s.hraci[1] as PlayerState, s.partie as LineState["partie"], 1),
    ],
    pasoval: [false, false],
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
  cmd: { uid: number; target: "vlastna" | "superova" | "priznanie" | "dedicstvo" },
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
    events.push({ type: "log", text: `Hráč ${p + 1} priznáva kartu ${def.name}.` });
    // Pri priznaní Dlhu si hráč okamžite doberie kartu (PRAVIDLA §6).
    if (def.id === "dlh") tahaj(s, p, 1, events);
  } else if (cmd.target === "dedicstvo") {
    need(jeNastroj, "Do Dedičstva patria len Nástroje.");
    const karta = vezmiZRuky(s, p, cmd.uid);
    hrac(s, p).dedicstvo.push(karta as DeepMutable<CardInstance>);
    events.push({ type: "log", text: `Hráč ${p + 1} vykladá ${def.name} do Dedičstva.` });
    manualEfekty(s, data, "Dedičstvo", events);
  } else {
    const cielPartia: PlayerId = cmd.target === "vlastna" ? p : opponentOf(p);
    if (cmd.target === "superova") {
      need(
        mozeDoSuperovejPartie(def.id),
        "Táto karta nesmie nastúpiť do súperovej partie.",
      );
    }
    // Nástroj sa do limitu vykladania nezapočítava (PRAVIDLA §5+§6);
    // ostatné karty limit míňajú.
    if (!jeNastroj) {
      need(z.zostavaLimit[p] > 0, "Limit vykladania je vyčerpaný.");
      z.zostavaLimit[p] -= 1;
    }
    // Nástroj nesmie susediť s Nástrojom (PRAVIDLA §6).
    const partia = s.partie[cielPartia];
    const sused = partia.length > 0 ? partia[partia.length - 1] : null;
    if (jeNastroj && sused != null) {
      need(
        !defOf(data, sused.card as CardInstance).tags.includes("Nástroj"),
        "Nástroj nesmie susediť s Nástrojom.",
      );
    }
    const karta = vezmiZRuky(s, p, cmd.uid);
    partia.push({ card: karta, playedBy: p } as DeepMutable<PlacedCard>);
    events.push({
      type: "log",
      text: `Hráč ${p + 1} vykladá ${def.name} do ${cmd.target === "vlastna" ? "svojej" : "súperovej"} partie.`,
    });
    if (def.triggers.includes("Nástup")) manualEfekty(s, data, "Nástup", events);
  }

  posunTahZhromazdenia(s, data, p, events);
}

function cmdPass(s: MutState, data: GameData, p: PlayerId, events: Event[]): void {
  const z = s.zhromazdenieStav;
  need(s.faza === "zhromazdenie" && z !== null, "Teraz nie je Zhromaždenie.");
  need(!z.pasoval[p], "Už si pasoval.");
  z.pasoval[p] = true;
  events.push({ type: "log", text: `Hráč ${p + 1} pasuje.` });
  posunTahZhromazdenia(s, data, p, events);
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
  need(!pitka.naexPouzity[p], "NA EX smieš dať najviac raz za Pitku.");
  need(s.hraci[p].poldeciPlne > 0, "Nemáš plný poldeci.");
  const kde = najdiVPartiach(s, cmd.uid);
  need(kde !== null, "Karta neleží v žiadnej partii.");
  const placed = s.partie[kde.partia][kde.index] as DeepMutable<PlacedCard>;
  need(placed.naexBy === undefined, "Na karte už poldeci leží.");
  const def = defOf(data, placed.card as CardInstance);
  need(
    def.tags.includes("Občan") || def.tags.includes("Starešina"),
    "NA EX smie len na Občana alebo Starešinu.",
  );

  hrac(s, p).poldeciPlne -= 1;
  placed.naexBy = p;
  events.push({
    type: "log",
    text: `Hráč ${p + 1} dáva NA EX na kartu ${def.name}${kde.partia === p ? "" : " v súperovej partii"}.`,
  });
  // Pečeň z NA EX sa počíta hneď a pripíše vlastníkovi cieľovej karty —
  // hráčovi, v ktorého partii karta leží (PRAVIDLA §5).
  pridajPecen(s, data, kde.partia, 1, events);
  pitka.naexPouzity[p] = true;
}

function cmdSmoke(s: MutState, cmd: { pocet: number }, p: PlayerId, events: Event[]): void {
  const pitka = s.pitkaStav;
  need(s.faza === "pitka" && pitka !== null, "Teraz nie je Pitka.");
  need(cmd.pocet > 0 && Number.isInteger(cmd.pocet), "Počet cigariet musí byť kladný.");
  need(s.hraci[p].cigarety >= cmd.pocet, "Toľko cigariet nemáš.");
  hrac(s, p).cigarety -= cmd.pocet;
  hrac(s, p).nerestiTotoKolo += cmd.pocet;
  pitka.fajcenie[p] += cmd.pocet;
  events.push({ type: "log", text: `Hráč ${p + 1} fajčí ${cmd.pocet} cigariet.` });
}

function cmdBarter(s: MutState, p: PlayerId, events: Event[]): void {
  need(s.faza === "pitka", "Barter sa robí počas Pitky.");
  // Zjednodušenie v1: barter berie len fyzické cigarety (pravidlá pripúšťajú
  // aj aktívne Cigaretky) — viď README.
  need(s.hraci[p].cigarety >= KONSTANTY.BARTER_CENA, "Na barter treba 5 cigariet.");
  hrac(s, p).cigarety -= KONSTANTY.BARTER_CENA;
  hrac(s, p).nerestiTotoKolo += KONSTANTY.BARTER_CENA;
  hrac(s, p).poldeciPlne += 1;
  events.push({ type: "log", text: `Hráč ${p + 1} robí stokársky barter — nový plný poldeci.` });
}

function cmdRefill(s: MutState, p: PlayerId, events: Event[]): void {
  need(s.faza === "pitka", "Poldeci sa dopĺňa počas Pitky.");
  need(s.hraci[p].cigarety >= KONSTANTY.REFILL_CENA, "Treba 2 fyzické cigarety.");
  need(s.hraci[p].poldeciVypite > 0, "Nemáš vypitý poldeci.");
  hrac(s, p).cigarety -= KONSTANTY.REFILL_CENA;
  hrac(s, p).nerestiTotoKolo += KONSTANTY.REFILL_CENA;
  hrac(s, p).poldeciVypite -= 1;
  hrac(s, p).poldeciPlne += 1;
  events.push({ type: "log", text: `Hráč ${p + 1} otáča poldeci za 2 cigarety.` });
}

function cmdSkipNaex(s: MutState, data: GameData, p: PlayerId, events: Event[]): void {
  const pitka = s.pitkaStav;
  need(s.faza === "pitka" && pitka !== null, "Teraz nie je Pitka.");
  need(!pitka.hotovy[p], "Už si skončil.");
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

  // 2. Hazard — aktívne Dlhy postihujú partiu, v ktorej sú.
  for (const p of [0, 1] as const) {
    const dlhy = sums[p].Dlh ?? 0;
    for (let i = 0; i < dlhy; i++) pridajKliatbu(s, data, p, "dlh", events);
  }

  // 3. Poškodenie pečene: akcie Pečeň a Poldecko [R6b]; NA EX už pripísané.
  for (const p of [0, 1] as const) {
    pridajPecen(s, data, p, (sums[p].PoškodeniePečene ?? 0) + (sums[p].Poldeci ?? 0), events);
  }

  // 4.–6. Obmedzenie, Cigaretky, ťahanie.
  for (const p of [0, 1] as const) {
    let cigaretky = sums[p].Cigaretka ?? 0;
    // Priazeň Fajčiara: cigaretky navyše v prvej pitke kola o lokalitu.
    if (s.pitkaCislo === 1 && s.ciel?.typ === "lokalita") {
      cigaretky += priazen(data, s as GameState, "FAJCIAR", p);
    }
    const obmedzenia = sums[opponentOf(p)].Obmedzenie ?? 0;
    const pocet = Math.max(0, cigaretky + pitka.fajcenie[p] - obmedzenia);
    const tahane = tahaj(s, p, pocet, events);

    // 7. Vízia: z práve dobraných zahoď Zopár kliatieb, dober rovnaký počet.
    const vizie = sums[p].Vízia ?? 0;
    if (vizie > 0 && tahane.length > 0) {
      const strop = vizie * hodnotaZopar(priazen(data, s as GameState, "NEPRAJNIK", p));
      let zahodene = 0;
      for (const karta of tahane) {
        if (zahodene >= strop) break;
        if (!defOf(data, karta).tags.includes("Kliatba")) continue;
        const idx = hrac(s, p).ruka.findIndex((k) => k.uid === karta.uid);
        if (idx === -1) continue;
        hrac(s, p).ruka.splice(idx, 1); // Zahodenie = preč z hry (PRAVIDLA §13)
        zahodene++;
      }
      if (zahodene > 0) {
        events.push({ type: "log", text: `Vízia hráča ${p + 1}: zahodené ${zahodene} kliatby.` });
        tahaj(s, p, zahodene, events);
      }
    }
  }

  s.pitkaStav = null;
  // Pokles balíčka pod 5 sa kontroluje až v stabilných bodoch (po drafte
  // a na konci kola) — uprostred kola ležia karty v partiách a do veľkosti
  // balíčka sa nepočítajú, takže by kontrola falošne trestala vykladanie.

  if (s.pitkaCislo >= s.pitkyCelkom) {
    zacniBitku(s, data, events);
  } else {
    zacniZhromazdenie(s, data, events);
  }
}

// ---------------------------------------------------------------------------
// Bitka

function zacniBitku(s: MutState, data: GameData, events: Event[]): void {
  s.faza = "bitka";
  events.push({ type: "faza", faza: "bitka" });
  const vyhodnotenie = evaluateLine(data, lineState(s as GameState));
  s.bitkaStav = {
    krok: "exekutor",
    caka: null,
    sums: vyhodnotenie.sums as DeepMutable<BitkaStav["sums"]>,
    exekutorHotovy: [false, false],
    pohorsenieZostava: [
      vyhodnotenie.sums[0].Pohoršenie ?? 0,
      vyhodnotenie.sums[1].Pohoršenie ?? 0,
    ],
    pohnuteMarkery: [],
    damage: null,
    vitaz: null,
    prebytokDrzi: null,
    prebytokZostava: 0,
    liecbaHotova: [false, false],
  };
  manualEfekty(s, data, "Bitka", events);
  manualEfekty(s, data, "Furt", events);
  manualEfekty(s, data, "Prestávka", events);
  pokracujBitku(s, data, events);
}

/** Ženie bitku dopredu, kým nenarazí na rozhodnutie hráča alebo koniec. */
function pokracujBitku(s: MutState, data: GameData, events: Event[]): void {
  const b = s.bitkaStav;
  if (b === null || s.koniec !== null) return;
  b.caka = null;

  // 1. Exekútor (obranca, potom útočník).
  if (b.krok === "exekutor") {
    for (const p of [obranca(s), s.utocnik]) {
      if (b.exekutorHotovy[p]) continue;
      const dlhy = pocetKariet(s.hraci[p] as PlayerState, "dlh", "priznane");
      const vysledok = exekutorCheck(dlhy, priazen(data, s as GameState, "EXEKUTOR", p));
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
        if (!existujeLegalnePohorsenie(s, p, b.pohnuteMarkery)) {
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
      b.krok = "liecba";
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
    b.krok = "liecba";
  }

  // 5. Liečba / Pohreb (obranca, potom útočník).
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
    koniecBitky(s, data, events);
  }
}

export interface KartaVolba {
  readonly defId: string;
  readonly kde: KartaZdroj;
}

/** Nástroje hráča naprieč zónami — bez uid, aby sa dali poslať klientovi. */
export function najdiNastroje(s: GameState, data: GameData, p: PlayerId): KartaVolba[] {
  const out: KartaVolba[] = [];
  for (const kde of ["ruka", "odhadzovaci", "doberaci", "dedicstvo"] as const) {
    const videne = new Set<string>();
    for (const k of s.hraci[p][kde]) {
      if (!defOf(data, k).tags.includes("Nástroj")) continue;
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
      !e.nahradeny &&
      !pohnute.includes(e.elderId) &&
      posunMarker(e as ElderState, opponentOf(p), true) !== null,
  );
}

function existujeLegalnyPrebytok(s: MutState, drzi: PlayerId): boolean {
  const vylucenyElder = s.ciel?.typ === "starsi" ? s.ciel.elderId : null;
  return s.starsi.some(
    (e) =>
      !e.nahradeny &&
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
  need(defOf(data, karta).tags.includes("Nástroj"), "Karta nie je Nástroj.");
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
  need(elder !== undefined && !elder.nahradeny, "Taký starší nie je.");
  need(!b.pohnuteMarkery.includes(cmd.elderId), "Tento marker sa už v bitke posunul.");
  const nova = posunMarker(elder as ElderState, opponentOf(p), true);
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
  const strany = ([0, 1] as const).map((p) => ({
    sums: b.sums[p] as ActionSums,
    cirhozaBonus: cirhozyVPartii(s as GameState, opponentOf(p)),
    abstaky: pocetAbstakov(s as GameState, p),
    priznaneDlhy: pocetKariet(s.hraci[p] as PlayerState, "dlh", "priznane"),
    priazenBitkara: priazen(data, s as GameState, "BITKAR", p),
    hodnotaViery: hodnotaViery(priazen(data, s as GameState, "VERIACI", p)),
  }));
  const damage = computeDamage([strany[0], strany[1]] as [typeof strany[0], typeof strany[0]]);
  const outcome = battleOutcome(damage, s.utocnik);
  b.damage = damage as DeepMutable<DamageResult>;
  b.vitaz = outcome.vitaz;
  b.prebytokDrzi = outcome.prebytokDrzi;
  b.prebytokZostava = outcome.prebytokDrzi === null ? 0 : outcome.prebytok;
  b.krok = "prebytok";
  events.push({
    type: "bitkaVysledok",
    damage,
    vitaz: outcome.vitaz,
    prebytok: outcome.prebytok,
    prebytokDrzi: outcome.prebytokDrzi,
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
  const vyluceny = s.ciel?.typ === "starsi" ? s.ciel.elderId : null;
  need(cmd.elderId !== vyluceny, "Prebytok sa delí medzi ostatných starších.");
  const elder = s.starsi.find((e) => e.elderId === cmd.elderId);
  need(elder !== undefined && !elder.nahradeny, "Taký starší nie je.");
  // Prebytok posúva marker k súperovi držiteľa [R8.4] — pri víťazovi
  // je to porazený, ako hovorí pravidlo.
  const nova = posunMarker(elder as ElderState, opponentOf(p), false);
  need(nova !== null, "Marker sa nedá posunúť.");
  elder.marker = nova;
  b.prebytokZostava -= 1;
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
  b.krok = "liecba";
  pokracujBitku(s, data, events);
}

/** Krok 5 — poldeci: NA EX sa vypijú, aktívne Poldecko otáča vypité. */
function vypiPoldeci(s: MutState, data: GameData, events: Event[]): void {
  const b = s.bitkaStav;
  if (b === null) return;
  for (const partia of s.partie) {
    for (const placed of partia) {
      if (placed.naexBy !== undefined) {
        hrac(s, placed.naexBy as PlayerId).poldeciVypite += 1;
        hrac(s, placed.naexBy as PlayerId).nerestiTotoKolo += 1;
        delete (placed as { naexBy?: PlayerId }).naexBy;
      }
    }
  }
  for (const p of [0, 1] as const) {
    let otocenia = b.sums[p].Poldeci ?? 0;
    while (otocenia > 0 && s.hraci[p].poldeciVypite > 0) {
      hrac(s, p).poldeciVypite -= 1;
      hrac(s, p).poldeciPlne += 1;
      otocenia--;
    }
  }
  events.push({ type: "log", text: "Poldeci z NA EX sa vypili; aktívne Poldecko otočili vypité." });
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
  const kdeZavisly = najdiVPartiach(s, cmd.zavislyUid);
  need(kdeZavisly !== null && kdeZavisly.partia === p, "Závislý musí ležať v tvojej partii.");
  const zavisly = s.partie[p][kdeZavisly.index] as PlacedCard;
  need(defOf(data, zavisly.card).tags.includes("Závislý"), "Karta nemá tag Závislý.");
  const senokIdx = s.senok.findIndex((k) => k.uid === cmd.senokUid);
  need(senokIdx !== -1, "Karta nie je v šenku.");

  hrac(s, p).priznane.splice(cirhozaIdx, 1);
  s.partie[p].splice(kdeZavisly.index, 1);
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
  const kde = najdiVPartiach(s, cmd.kartaUid);
  need(kde !== null && kde.partia === p, "Karta musí ležať v tvojej partii.");

  hrac(s, p).priznane.splice(cirhozaIdx, 1);
  const pochovana = s.partie[p].splice(kde.index, 1)[0] as PlacedCard;
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
  if (b === null || b.vitaz === null) return;
  const vitaz = b.vitaz as PlayerId;

  // 7. Návrat kariet — do odhadzovacieho balíčka hráča, ktorý ich zahral.
  for (const partia of s.partie) {
    for (const placed of partia) {
      hrac(s, placed.playedBy as PlayerId).odhadzovaci.push(placed.card as DeepMutable<CardInstance>);
    }
  }
  s.partie = [[], []];

  // Lokalitu si berie víťaz.
  const lokalita = cielLokalita(s as GameState);
  if (lokalita !== null) {
    s.ovladnute.push({ karta: lokalita, hrac: vitaz } as DeepMutable<OvladnutaLokalita>);
    events.push({ type: "log", text: `Hráč ${vitaz + 1} ovládol lokalitu ${defOf(data, lokalita).name}.` });
  }

  // Absťák: menej nerestí než v predošlom kole → nová kliatba (PRAVIDLA §12).
  for (const p of [0, 1] as const) {
    if (s.hraci[p].nerestiTotoKolo < s.hraci[p].nerestiMinuleKolo) {
      pridajKliatbu(s, data, p, "abstak", events);
    }
    hrac(s, p).nerestiMinuleKolo = s.hraci[p].nerestiTotoKolo;
    hrac(s, p).nerestiTotoKolo = 0;
  }

  s.bitkaStav = null;
  s.ciel = null;

  skontrolujVydesenie(s, data, events);
  if (s.koniec !== null) return;
  skontrolujBalicky(s, data, events);
  if (s.koniec !== null) return;

  // Posledná bitka o lokalitu → záverečné bodovanie.
  if (s.lokalityVHre.length === 0) {
    zaverecneBodovanie(s, data, events);
    return;
  }

  // Ďalšie kolo: útočníkom je porazený.
  s.kolo += 1;
  s.utocnik = opponentOf(vitaz);
  s.faza = "volbaCiela";
  events.push({ type: "faza", faza: "volbaCiela" });
  for (const elder of s.starsi) elder.markerZaciatokKola = elder.marker;
  doplnSenok(s);
  events.push({ type: "log", text: `Kolo ${s.kolo}: útočí hráč ${s.utocnik + 1}.` });
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

/** Vydesenie aspoň polovice starších v hre → okamžitá výhra (PRAVIDLA §1). */
function skontrolujVydesenie(s: MutState, data: GameData, events: Event[]): void {
  if (s.koniec !== null) return;
  const vHre = s.starsi.filter((e) => !e.nahradeny);
  if (vHre.length === 0) return;
  const prah = Math.ceil(vHre.length / 2);
  for (const p of [0, 1] as const) {
    const vydeseni = vHre.filter((e) => vydesil(e as ElderState, p)).length;
    if (vydeseni >= prah) {
      ukonciHru(s, data, p, `Hráč ${p + 1} vydesil ${vydeseni} z ${vHre.length} starších.`, events);
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

  for (const elder of s.starsi) {
    const def = data.elders.get(elder.elderId);
    if (def === undefined) continue;
    const score = elderScore(data, def, elder as ElderState);
    if (score !== null) body[score.hrac] += score.body;
  }
  for (const ovl of s.ovladnute) body[ovl.hrac] += KONSTANTY.BODY_ZA_LOKALITU;
  for (const elder of s.starsi) {
    if (elder.ziskal !== null) body[elder.ziskal] += KONSTANTY.BODY_ZA_STARSIEHO;
  }
  for (const p of [0, 1] as const) {
    body[p] += s.hraci[p].cigarety * KONSTANTY.BODY_ZA_CIGARETU;
    const vsade = [...s.hraci[p].ruka, ...s.hraci[p].doberaci, ...s.hraci[p].odhadzovaci];
    body[p] += vsade.filter((k) => k.defId === "dlh").length * KONSTANTY.POKUTA_NEPRIZNANY_DLH;
    body[p] +=
      vsade.filter((k) => k.defId === "cirhoza").length * KONSTANTY.POKUTA_NEPRIZNANA_CIRHOZA;
  }

  const vitaz: PlayerId | null = body[0] === body[1] ? null : body[0] > body[1] ? 0 : 1;
  s.koniec = { vitaz, dovod: "Odohrala sa posledná bitka o lokalitu.", body };
  s.faza = "koniec";
  events.push({ type: "koniec", vitaz, dovod: s.koniec.dovod, body });
}

// ---------------------------------------------------------------------------
// Legálne príkazy (pre klienta aj smoke test)

export function legalCommands(data: GameData, state: GameState, p: PlayerId): Command[] {
  if (state.koniec !== null || naTahu(state) !== p) return [];
  const out: Command[] = [];

  switch (state.faza) {
    case "volbaCiela": {
      for (const lok of state.lokalityVHre) {
        out.push({ type: "chooseLocation", uid: lok.uid, otocena: false });
        out.push({ type: "chooseLocation", uid: lok.uid, otocena: true });
      }
      for (const elder of state.starsi) {
        if (bitkaOStarsiehoMozna(elder)) out.push({ type: "chooseElder", elderId: elder.elderId });
      }
      break;
    }
    case "draft": {
      for (let cig = 0; cig <= 3; cig++) {
        const pocet = Math.min(3 - cig, state.senok.length);
        out.push({ type: "draft", cigarety: cig, karty: state.senok.slice(0, pocet).map((k) => k.uid) });
      }
      break;
    }
    case "zhromazdenie": {
      const z = state.zhromazdenieStav;
      if (z === null) break;
      out.push({ type: "pass" });
      for (const karta of state.hraci[p].ruka) {
        const def = defOf(data, karta);
        const jeNastroj = def.tags.includes("Nástroj");
        const partia = state.partie[p];
        const koniec = partia.length > 0 ? partia[partia.length - 1] : null;
        const koniecJeNastroj =
          koniec != null && defOf(data, koniec.card).tags.includes("Nástroj");
        if ((jeNastroj || z.zostavaLimit[p] > 0) && !(jeNastroj && koniecJeNastroj)) {
          out.push({ type: "place", uid: karta.uid, target: "vlastna" });
        }
        if ((jeNastroj || z.zostavaLimit[p] > 0) && mozeDoSuperovejPartie(def.id)) {
          const sup = state.partie[opponentOf(p)];
          const supKoniec = sup.length > 0 ? sup[sup.length - 1] : null;
          const supNastroj =
            supKoniec != null && defOf(data, supKoniec.card).tags.includes("Nástroj");
          if (!(jeNastroj && supNastroj)) {
            out.push({ type: "place", uid: karta.uid, target: "superova" });
          }
        }
        if (def.tags.includes("Kliatba")) out.push({ type: "place", uid: karta.uid, target: "priznanie" });
        if (jeNastroj) out.push({ type: "place", uid: karta.uid, target: "dedicstvo" });
      }
      break;
    }
    case "pitka": {
      const pitka = state.pitkaStav;
      if (pitka === null) break;
      out.push({ type: "skipNaex" });
      if (!pitka.naexPouzity[p] && state.hraci[p].poldeciPlne > 0) {
        for (const q of [0, 1] as const) {
          for (const placed of state.partie[q]) {
            if (placed.naexBy !== undefined) continue;
            const tags = defOf(data, placed.card).tags;
            if (tags.includes("Občan") || tags.includes("Starešina")) {
              out.push({ type: "naex", uid: placed.card.uid });
            }
          }
        }
      }
      if (state.hraci[p].cigarety > 0) out.push({ type: "smoke", pocet: 1 });
      if (state.hraci[p].cigarety >= KONSTANTY.BARTER_CENA) out.push({ type: "barter" });
      if (state.hraci[p].cigarety >= KONSTANTY.REFILL_CENA && state.hraci[p].poldeciVypite > 0) {
        out.push({ type: "refillPoldeci" });
      }
      break;
    }
    case "bitka": {
      const b = state.bitkaStav;
      if (b === null || b.caka !== p) break;
      if (b.krok === "exekutor") {
        for (const nastroj of najdiNastroje(state, data, p)) {
          out.push({ type: "exekutorTool", defId: nastroj.defId, kde: nastroj.kde });
        }
      } else if (b.krok === "pohorsenie") {
        for (const elder of state.starsi) {
          if (elder.nahradeny || b.pohnuteMarkery.includes(elder.elderId)) continue;
          if (posunMarker(elder, opponentOf(p), true) !== null) {
            out.push({ type: "pohorsenie", elderId: elder.elderId });
          }
        }
      } else if (b.krok === "prebytok") {
        const vyluceny = state.ciel?.typ === "starsi" ? state.ciel.elderId : null;
        for (const elder of state.starsi) {
          if (elder.nahradeny || elder.elderId === vyluceny) continue;
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
          for (const placed of state.partie[p]) {
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

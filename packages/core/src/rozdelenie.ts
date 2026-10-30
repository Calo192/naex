// Rozdelenie Pohoršenia a prebytku naraz (mock C · Pečať, Michal 2026-10-30): hráč pri
// starších vyberie smery, nepotvrdené ich drží klient a Potvrdiť ich pošle jedným ťahom
// ({ type: "tah" }). Server ich vykoná po jednom v poradí, ako prišli — každý posun ide
// tak ďaleko, ako zvyšok stačí (posunZaBody). Plán tu je ten istý výpočet, preto náhľad
// v klientovi (cieľ, cena, zvyšok) ukáže presne to, čo server urobí.

import type { DamageResult } from "./battle.ts";
import type { GameData } from "./data.ts";
import type { VerejnyStav } from "./effects.ts";
import type { BitkaKrok, Command, StavBodovPohorseni } from "./engine.ts";
import { bodyNaPohorsenie, lineState, poskodenieBitky } from "./engine.ts";
import { evaluateLine } from "./partia.ts";
import type { ElderState, MarkerPos } from "./elders.ts";
import { posunZaBody, telefonHraca } from "./elders.ts";
import { opponentOf, type PlayerId } from "./types.ts";

/** Voľba hráča: starší a smer (kSebe len pri Pohoršení — prebytok má jediný smer). */
export interface VolbaRozdelenia {
  readonly elderId: string;
  readonly kSebe?: boolean;
}

/** Jeden posun plánu tak, ako ho server vykoná. */
export interface KrokRozdelenia {
  readonly elderId: string;
  readonly kSebe: boolean;
  /** Ku komu marker ide. */
  readonly smer: PlayerId;
  readonly z: MarkerPos;
  readonly na: MarkerPos;
  readonly cena: number;
  /** Koľko bodov mal posun k dispozícii — z toho klient ukáže ceny polí na stupnici. */
  readonly body: number;
}

export interface PlanRozdelenia {
  readonly kroky: readonly KrokRozdelenia[];
  /** Voľby, na ktoré zvyšok už nestačil — server by ich odmietol, plán ich vynechá. */
  readonly nevyslo: readonly VolbaRozdelenia[];
  /** Body, ktoré po pláne ostanú. */
  readonly zvysok: number;
  /** Ťah pre server; null, keď v pláne nie je nič. */
  readonly prikaz: Command | null;
}

/** Čo plán potrebuje zo stavu — ClientState aj GameState. */
export interface StavRozdelenia extends StavBodovPohorseni {
  readonly starsi: readonly Pick<ElderState, "elderId" | "marker">[];
  readonly bitkaStav:
    | (StavBodovPohorseni["bitkaStav"] & {
        readonly krok: BitkaKrok | null;
        readonly caka: PlayerId | null;
        readonly prebytokDrzi: PlayerId | null;
        readonly prebytokZostava: number;
      })
    | null;
}

/** Krok, v ktorom hráč p práve rozdeľuje, alebo null. */
export function krokRozdelenia(state: StavRozdelenia, p: PlayerId): "pohorsenie" | "prebytok" | null {
  const b = state.bitkaStav;
  if (b === null || b.caka !== p) return null;
  if (b.krok === "pohorsenie" && b.pohorsenieZostava[p] > 0) return "pohorsenie";
  if (b.krok === "prebytok" && b.prebytokDrzi !== null && b.prebytokZostava > 0) return "prebytok";
  return null;
}

/** Smery, ktoré krok dovoľuje: Pohoršenie k súperovi aj k sebe, prebytok len k súperovi držiteľa. */
export function smeryRozdelenia(state: StavRozdelenia, p: PlayerId): readonly { readonly kSebe: boolean; readonly smer: PlayerId }[] {
  const krok = krokRozdelenia(state, p);
  if (krok === "pohorsenie") return [{ kSebe: false, smer: opponentOf(p) }, { kSebe: true, smer: p }];
  const drzi = state.bitkaStav?.prebytokDrzi ?? null;
  if (krok === "prebytok" && drzi !== null) return [{ kSebe: false, smer: opponentOf(drzi) }];
  return [];
}

/** Body pre posun staršieho pri danom zvyšku — starší v ohrození (pokus o zajatie, v9) sa nehýbe. */
function bodyPre(state: StavRozdelenia, p: PlayerId, _krok: "pohorsenie" | "prebytok", zvysok: number, elderId: string): number {
  const zost: [number, number] = [0, 0];
  zost[p] = zvysok;
  return bodyNaPohorsenie({ ...(state.pokusy !== undefined ? { pokusy: state.pokusy } : {}), bitkaStav: { pohorsenieZostava: zost } }, p, { elderId });
}

/**
 * Plán rozdelenia: voľby v poradí, každá zo zvyšku po predošlých (ako server pri ťahu).
 * Starší v ohrození (pokus o zajatie, v9) sa nehýbe — rovnako ako cmdPohorsenie.
 */
export function planRozdelenia(state: StavRozdelenia, p: PlayerId, volby: readonly VolbaRozdelenia[]): PlanRozdelenia {
  const krok = krokRozdelenia(state, p);
  const b = state.bitkaStav;
  if (krok === null || b === null) return { kroky: [], nevyslo: [...volby], zvysok: 0, prikaz: null };
  let zvysok = krok === "pohorsenie" ? b.pohorsenieZostava[p] : b.prebytokZostava;
  const markery = new Map(state.starsi.map((e) => [e.elderId, e.marker]));
  const kroky: KrokRozdelenia[] = [];
  const nevyslo: VolbaRozdelenia[] = [];
  for (const v of volby) {
    const z = markery.get(v.elderId);
    const kSebe = krok === "pohorsenie" && v.kSebe === true;
    const smer = krok === "pohorsenie" ? (kSebe ? p : opponentOf(p)) : opponentOf(b.prebytokDrzi as PlayerId);
    const body = z === undefined || zvysok <= 0 ? 0 : bodyPre(state, p, krok, zvysok, v.elderId);
    const posun = z === undefined || body <= 0 ? null : posunZaBody({ marker: z }, smer, body, krok === "pohorsenie" && telefonHraca(state, p));
    if (z === undefined || posun === null) {
      nevyslo.push(v);
      continue;
    }
    kroky.push({ elderId: v.elderId, kSebe, smer, z, na: posun.marker, cena: posun.cena, body });
    markery.set(v.elderId, posun.marker);
    zvysok -= posun.cena;
  }
  const prikazy: Command[] = kroky.map((k) =>
    krok === "prebytok" ? { type: "prebytok", elderId: k.elderId } : k.kSebe ? { type: "pohorsenie", elderId: k.elderId, kSebe: true } : { type: "pohorsenie", elderId: k.elderId },
  );
  return { kroky, nevyslo, zvysok, prikaz: prikazy.length === 0 ? null : { type: "tah", kroky: prikazy } };
}

/** Koľko bodov by mal po pláne ďalší posun tohto staršieho. */
export function rozpocetPoPlane(state: StavRozdelenia, p: PlayerId, plan: PlanRozdelenia, elderId: string): number {
  const krok = krokRozdelenia(state, p);
  if (krok === null || plan.zvysok <= 0) return 0;
  return bodyPre(state, p, krok, plan.zvysok, elderId);
}

/**
 * Starší mimo plánu, ktorých zvyšok ešte niekam posunie (bublina „stačí ešte pre N starších“).
 * Nula pri kladnom zvyšku = zvyšok prepadne.
 */
export function starsiPreZvysok(state: StavRozdelenia, p: PlayerId, plan: PlanRozdelenia): readonly string[] {
  const vPlane = new Set(plan.kroky.map((k) => k.elderId));
  const smery = smeryRozdelenia(state, p);
  return state.starsi
    .filter((e) => !vPlane.has(e.elderId))
    .filter((e) => {
      const body = rozpocetPoPlane(state, p, plan, e.elderId);
      return body > 0 && smery.some((s) => posunZaBody(e, s.smer, body, krokRozdelenia(state, p) === "pohorsenie" && telefonHraca(state, p)) !== null);
    })
    .map((e) => e.elderId);
}

/**
 * Ťuk na šípku pri staršom (mock C): ten istý smer posun zruší, opačný ho prehodí na tom
 * istom mieste v poradí, nový sa pridá na koniec. Voľby, na ktoré by potom zvyšok nestačil,
 * vypadnú — zoznam drží len to, čo server naozaj vykoná.
 */
export function prepniVolbu(state: StavRozdelenia, p: PlayerId, volby: readonly VolbaRozdelenia[], volba: VolbaRozdelenia): readonly VolbaRozdelenia[] {
  const kSebe = volba.kSebe === true;
  const nova: VolbaRozdelenia = kSebe ? { elderId: volba.elderId, kSebe: true } : { elderId: volba.elderId };
  const i = volby.findIndex((v) => v.elderId === volba.elderId);
  const dalsie =
    i < 0 ? [...volby, nova] : (volby[i]?.kSebe === true) === kSebe ? volby.filter((_, j) => j !== i) : volby.map((v, j) => (j === i ? nova : v));
  const plan = planRozdelenia(state, p, dalsie);
  return dalsie.filter((v) => !plan.nevyslo.includes(v));
}

/**
 * Prepadne zvyšok po pláne? Áno, keď ho server nemôže minúť na žiadneho staršieho — ani na
 * toho, ktorý sa v pláne už posunul (od novej polohy). Vtedy server krok po ťahu uzavrie.
 */
export function zvysokPrepadne(state: StavRozdelenia, p: PlayerId, plan: PlanRozdelenia): boolean {
  if (plan.zvysok <= 0) return false;
  const po = new Map(plan.kroky.map((k) => [k.elderId, k.na]));
  const smery = smeryRozdelenia(state, p);
  return !state.starsi.some((e) => {
    const body = rozpocetPoPlane(state, p, plan, e.elderId);
    const marker = po.get(e.elderId) ?? e.marker;
    return body > 0 && smery.some((s) => posunZaBody({ marker }, s.smer, body, krokRozdelenia(state, p) === "pohorsenie" && telefonHraca(state, p)) !== null);
  });
}

/**
 * Bitka pred a po pláne Pohoršení — priazeň sa mení hneď a platí už v tejto bitke
 * (Bitkár, Veriaci). null, keď plán poškodenie nezmení alebo bitka už je vyhodnotená.
 */
export function bitkaPoPlane(
  data: GameData,
  view: VerejnyStav & { readonly lokalitaOtocena: boolean; readonly bitkaStav: { readonly damage: DamageResult | null } | null },
  plan: PlanRozdelenia,
): { readonly pred: DamageResult; readonly po: DamageResult } | null {
  if (view.ciel === null || view.bitkaStav === null || view.bitkaStav.damage !== null || plan.kroky.length === 0) return null;
  const na = new Map(plan.kroky.map((k) => [k.elderId, k.na]));
  const sums = evaluateLine(data, lineState(view)).sums;
  const pred = poskodenieBitky(data, view, sums);
  const po = poskodenieBitky(data, { ...view, starsi: view.starsi.map((e) => ({ ...e, marker: na.get(e.elderId) ?? e.marker })) }, sums);
  const rovnake = pred.tuhe[0] === po.tuhe[0] && pred.tuhe[1] === po.tuhe[1] && pred.celkove[0] === po.celkove[0] && pred.celkove[1] === po.celkove[1];
  return rovnake ? null : { pred, po };
}

// Rozdelenie hádky a Nakladačky naraz (mock C · Pečať, Michal 2026-10-30; hádka v10): hráč
// pri starších vyberie, koho posunie, nepotvrdené výbery drží klient a Potvrdiť ich pošle
// jedným ťahom ({ type: "tah" }). Server ich vykoná po jednom v poradí, ako prišli — každý
// posun ide tak ďaleko, ako zvyšok stačí (posunZaBody). Plán tu je ten istý výpočet, preto
// náhľad v klientovi (cieľ, cena, zvyšok) ukáže presne to, čo server urobí.
//
// Nakladačka posúva marker (k súperovi držiteľa), hádka len polohu účinnej priazne
// (polohaPriazne) k víťazovi hádky — z, na a ceny v pláne hádky sú polohy priazne, marker stojí.

import type { DamageResult } from "./battle.ts";
import type { GameData } from "./data.ts";
import type { VerejnyStav } from "./effects.ts";
import type { BitkaKrok, Command, PokusOZajatie } from "./engine.ts";
import { klebetyKola, lineState, poskodenieBitky, vOhrozeni } from "./engine.ts";
import { evaluateLine } from "./partia.ts";
import type { ElderState, Klebety, MarkerPos } from "./elders.ts";
import { polohaPriazne, posunZaBody } from "./elders.ts";
import { opponentOf, type PlayerId } from "./types.ts";

/** Voľba hráča: starší (smer určuje krok — hádka k víťazovi, Nakladačka k súperovi držiteľa). */
export interface VolbaRozdelenia {
  readonly elderId: string;
}

/** Jeden posun plánu tak, ako ho server vykoná. */
export interface KrokRozdelenia {
  readonly elderId: string;
  /** Ku komu marker (pri hádke priazeň) ide. */
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
export interface StavRozdelenia {
  /** Pokusy o zajatie tohto kola (v9) — pri Nakladačke sa starší v ohrození nehýbe. */
  readonly pokusy?: readonly (PokusOZajatie | null)[];
  readonly starsi: readonly Pick<ElderState, "elderId" | "marker">[];
  readonly bitkaStav: {
    readonly krok: BitkaKrok | null;
    readonly caka: PlayerId | null;
    readonly prebytokDrzi: PlayerId | null;
    readonly prebytokZostava: number;
    readonly hadka?: { readonly vitaz: PlayerId | null; readonly zostava: number };
    readonly klebety?: Klebety;
  } | null;
}

export type DruhRozdelenia = "hadka" | "prebytok";

/** Krok, v ktorom hráč p práve rozdeľuje, alebo null. */
export function krokRozdelenia(state: StavRozdelenia, p: PlayerId): DruhRozdelenia | null {
  const b = state.bitkaStav;
  if (b === null || b.caka !== p) return null;
  if (b.krok === "hadka" && b.hadka?.vitaz === p && b.hadka.zostava > 0) return "hadka";
  if (b.krok === "prebytok" && b.prebytokDrzi !== null && b.prebytokZostava > 0) return "prebytok";
  return null;
}

/** Smer kroku: hádka k víťazovi (rozdeľujúcemu), Nakladačka k súperovi držiteľa. */
export function smerRozdelenia(state: StavRozdelenia, p: PlayerId): PlayerId | null {
  const krok = krokRozdelenia(state, p);
  if (krok === "hadka") return p;
  const drzi = state.bitkaStav?.prebytokDrzi ?? null;
  return krok === "prebytok" && drzi !== null ? opponentOf(drzi) : null;
}

/** Body na rozdelenie v kroku (zvyšok hádky alebo Nakladačky). */
export function bodyRozdelenia(state: StavRozdelenia, p: PlayerId): number {
  const krok = krokRozdelenia(state, p);
  const b = state.bitkaStav;
  if (krok === null || b === null) return 0;
  return krok === "hadka" ? (b.hadka?.zostava ?? 0) : b.prebytokZostava;
}

/**
 * Poloha, ktorú krok posúva: pri hádke účinná priazeň (klebety kola), pri Nakladačke marker.
 * Pri Nakladačke sa starší v ohrození (pokus o zajatie, v9 O8) nehýbe — undefined.
 */
export function polohyRozdelenia(state: StavRozdelenia, p: PlayerId): ReadonlyMap<string, MarkerPos> {
  const krok = krokRozdelenia(state, p);
  const klebety = klebetyKola(state);
  const out = new Map<string, MarkerPos>();
  for (const e of state.starsi) {
    if (krok === "prebytok" && state.pokusy !== undefined && vOhrozeni({ pokusy: state.pokusy }, e.elderId)) continue;
    out.set(e.elderId, krok === "hadka" ? polohaPriazne(e, klebety) : e.marker);
  }
  return out;
}

/**
 * Plán rozdelenia: voľby v poradí, každá zo zvyšku po predošlých (ako server pri ťahu).
 * Hádka priazeň posúva len k víťazovi a najviac na silu 3 — to je kraj stupnice.
 */
export function planRozdelenia(state: StavRozdelenia, p: PlayerId, volby: readonly VolbaRozdelenia[]): PlanRozdelenia {
  const krok = krokRozdelenia(state, p);
  const smer = smerRozdelenia(state, p);
  if (krok === null || smer === null) return { kroky: [], nevyslo: [...volby], zvysok: 0, prikaz: null };
  let zvysok = bodyRozdelenia(state, p);
  const polohy = new Map(polohyRozdelenia(state, p));
  const kroky: KrokRozdelenia[] = [];
  const nevyslo: VolbaRozdelenia[] = [];
  for (const v of volby) {
    const z = polohy.get(v.elderId);
    const posun = z === undefined || zvysok <= 0 ? null : posunZaBody({ marker: z }, smer, zvysok);
    if (z === undefined || posun === null) {
      nevyslo.push(v);
      continue;
    }
    kroky.push({ elderId: v.elderId, smer, z, na: posun.marker, cena: posun.cena, body: zvysok });
    polohy.set(v.elderId, posun.marker);
    zvysok -= posun.cena;
  }
  const prikazy: Command[] = kroky.map((k) => (krok === "prebytok" ? { type: "prebytok", elderId: k.elderId } : { type: "hadka", elderId: k.elderId }));
  return { kroky, nevyslo, zvysok, prikaz: prikazy.length === 0 ? null : { type: "tah", kroky: prikazy } };
}

/** Koľko bodov by mal po pláne ďalší posun tohto staršieho (0 = nikam, aj v ohrození pri Nakladačke). */
export function rozpocetPoPlane(state: StavRozdelenia, p: PlayerId, plan: PlanRozdelenia, elderId: string): number {
  if (krokRozdelenia(state, p) === null || plan.zvysok <= 0 || !polohyRozdelenia(state, p).has(elderId)) return 0;
  return plan.zvysok;
}

/**
 * Starší mimo plánu, ktorých zvyšok ešte niekam posunie (bublina „stačí ešte pre N starších“).
 * Nula pri kladnom zvyšku = zvyšok prepadne.
 */
export function starsiPreZvysok(state: StavRozdelenia, p: PlayerId, plan: PlanRozdelenia): readonly string[] {
  const vPlane = new Set(plan.kroky.map((k) => k.elderId));
  const smer = smerRozdelenia(state, p);
  const polohy = polohyRozdelenia(state, p);
  if (smer === null || plan.zvysok <= 0) return [];
  return [...polohy].filter(([id, z]) => !vPlane.has(id) && posunZaBody({ marker: z }, smer, plan.zvysok) !== null).map(([id]) => id);
}

/**
 * Ťuk pri staršom (mock C): ten istý starší výber zruší, nový sa pridá na koniec. Voľby, na
 * ktoré by potom zvyšok nestačil, vypadnú — zoznam drží len to, čo server naozaj vykoná.
 */
export function prepniVolbu(state: StavRozdelenia, p: PlayerId, volby: readonly VolbaRozdelenia[], volba: VolbaRozdelenia): readonly VolbaRozdelenia[] {
  const i = volby.findIndex((v) => v.elderId === volba.elderId);
  const dalsie = i < 0 ? [...volby, { elderId: volba.elderId }] : volby.filter((_, j) => j !== i);
  const plan = planRozdelenia(state, p, dalsie);
  return dalsie.filter((v) => !plan.nevyslo.includes(v));
}

/**
 * Prepadne zvyšok po pláne? Áno, keď ho server nemôže minúť na žiadneho staršieho — ani na
 * toho, ktorý sa v pláne už posunul (od novej polohy). Vtedy server krok po ťahu uzavrie.
 */
export function zvysokPrepadne(state: StavRozdelenia, p: PlayerId, plan: PlanRozdelenia): boolean {
  if (plan.zvysok <= 0) return false;
  const smer = smerRozdelenia(state, p);
  if (smer === null) return true;
  const po = new Map(plan.kroky.map((k) => [k.elderId, k.na]));
  return ![...polohyRozdelenia(state, p)].some(([id, z]) => posunZaBody({ marker: po.get(id) ?? z }, smer, plan.zvysok) !== null);
}

/**
 * Bitka pred a po pláne hádky — priazeň sa mení hneď a platí už v tejto bitke (Bitkár,
 * Veriaci, Abstinent). null, keď plán poškodenie nezmení alebo bitka už je vyhodnotená.
 */
export function bitkaPoPlane(
  data: GameData,
  view: VerejnyStav & { readonly lokalitaOtocena: boolean; readonly bitkaStav: { readonly damage: DamageResult | null; readonly klebety?: Klebety } | null },
  plan: PlanRozdelenia,
): { readonly pred: DamageResult; readonly po: DamageResult } | null {
  if (view.ciel === null || view.bitkaStav === null || view.bitkaStav.damage !== null || plan.kroky.length === 0) return null;
  const klebety: Record<string, number> = { ...(view.bitkaStav.klebety ?? {}) };
  for (const k of plan.kroky) {
    const e = view.starsi.find((x) => x.elderId === k.elderId);
    if (e !== undefined) klebety[k.elderId] = e.marker - k.na;
  }
  const sums = evaluateLine(data, lineState(view)).sums;
  const pred = poskodenieBitky(data, view, sums);
  const po = poskodenieBitky(data, { ...view, bitkaStav: { ...view.bitkaStav, klebety } } as typeof view, sums);
  const rovnake = pred.tuhe[0] === po.tuhe[0] && pred.tuhe[1] === po.tuhe[1];
  return rovnake ? null : { pred, po };
}

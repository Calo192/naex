// Syntetické karty pre testy — presne určené rozloženia, deterministický vstup.

import type {
  Action,
  CardDef,
  CardInstance,
  Event,
  GameData,
  GameState,
  PlayerId,
  SideDef,
  Slot,
  Tag,
  Trigger,
} from "../src/index.ts";
import { apply, buildGameData, sideLayouts } from "../src/index.ts";

export type Layout4 = readonly [Slot, Slot, Slot, Slot];

function sideFromLayout(layout: Layout4): SideDef {
  const actions: Partial<Record<Action, number>> = {};
  for (const slot of layout) {
    if (slot !== null) actions[slot] = (actions[slot] ?? 0) + 1;
  }
  return { blocked: [], actions };
}

let defCounter = 0;

/** Karta s presne danými stranami (rozloženie sa vyberie cez instanceFor). */
export function makeDef(
  id: string,
  left: Layout4,
  right: Layout4,
  extra?: { tags?: readonly Tag[]; triggers?: readonly Trigger[]; effectText?: string },
): CardDef {
  const leftDef = sideFromLayout(left);
  const rightDef = sideFromLayout(right);
  const l = sideLayouts(leftDef).length;
  const r = sideLayouts(rightDef).length;
  return {
    id,
    index: ++defCounter,
    name: id,
    tags: extra?.tags ?? ["Občan"],
    effectText: extra?.effectText ?? "",
    triggers: extra?.triggers ?? [],
    left: leftDef,
    right: rightDef,
    permutations: { total: l * r, left: l, right: r },
  };
}

export function syntheticData(defs: readonly CardDef[]): GameData {
  return buildGameData(new Map(defs.map((d) => [d.id, d])), new Map());
}

let uidCounter = 0;

/** Inštancia karty s presne týmto rozložením oboch strán. */
export function instanceFor(
  data: GameData,
  defId: string,
  left: Layout4,
  right: Layout4,
): CardInstance {
  const variants = data.variants.get(defId);
  if (variants === undefined) throw new Error(`niet variantov pre ${defId}`);
  const findIndex = (layouts: readonly Layout4[], wanted: Layout4): number => {
    const idx = layouts.findIndex((l) => JSON.stringify(l) === JSON.stringify(wanted));
    if (idx === -1) throw new Error(`rozloženie ${JSON.stringify(wanted)} pre ${defId} neexistuje`);
    return idx;
  };
  return {
    uid: ++uidCounter,
    defId,
    leftLayout: findIndex(variants.left, left),
    rightLayout: findIndex(variants.right, right),
  };
}

/** Skratka: definícia + inštancia jedným ťahom. */
export function makeCard(
  id: string,
  left: Layout4,
  right: Layout4,
): { def: CardDef; make: (data: GameData) => CardInstance } {
  return { def: makeDef(id, left, right), make: (data) => instanceFor(data, id, left, right) };
}

export const EMPTY: Layout4 = [null, null, null, null];

/**
 * NA EX naraz (v5, Michal 2026-10-24/25): NA EX sa vyberá skryto a odkryje
 * sa, až keď obaja skončia svoju časť Pitky. Test súpera vopred „skončí“
 * a hráč hneď po NA EX skončí tiež — vráti stav po odkrytí (ak súper smie
 * odpovedať, Pitka sa ešte nevyhodnotila).
 */
export function naexOdkryte(
  data: GameData,
  s: GameState,
  uid: number,
  p: PlayerId,
): { state: GameState; events: Event[] } {
  const pitka = s.pitkaStav;
  if (pitka === null) throw new Error("naexOdkryte: nie je Pitka");
  const hotovy: [boolean, boolean] = p === 0 ? [false, true] : [true, false];
  const pred: GameState = { ...s, pitkaStav: { ...pitka, hotovy, naTahu: p } };
  const a = apply(data, pred, { type: "naex", uid }, p);
  // Keď hráč nemá v Pitke nič iné, skončí ju za neho hra sama (dohrajNevyhnutne).
  const caka = a.state.faza === "pitka" && a.state.pitkaStav?.hotovy[p] === false && a.state.pitkaStav.naTahu === p;
  if (!caka) return a;
  const b = apply(data, a.state, { type: "skipNaex" }, p);
  return { state: b.state, events: [...a.events, ...b.events] };
}

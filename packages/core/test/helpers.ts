// Syntetické karty pre testy — presne určené rozloženia, deterministický vstup.

import type {
  Action,
  CardDef,
  CardInstance,
  GameData,
  SideDef,
  Slot,
  Tag,
  Trigger,
} from "../src/index.ts";
import { buildGameData, sideLayouts } from "../src/index.ts";

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

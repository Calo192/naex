// Generovanie variantov kariet.
//
// cards.json pri každej strane udáva len multimnožinu akcií + blokované
// sloty. Fyzická karta je vždy jedno konkrétne rozloženie; rôzne rozloženia
// sú v tlači samostatné karty. Tu z multimnožiny vyrobíme všetky RÔZNE
// rozloženia deterministicky a v stabilnom poradí — duplicitné akcie
// (napr. Poldeci ×3) sa nesmú počítať viackrát.

import type { Action, CardDef, SideDef, SideLayout, Slot, SlotIndex } from "./types.ts";
import { SLOT_INDEXES } from "./types.ts";

/**
 * Všetky rôzne rozloženia jednej strany, v stabilnom lexikografickom poradí.
 * Symboly sa radia kódovými bodmi, prázdny slot ("") pred všetkými akciami —
 * poradie je vec konvencie, dôležitá je len jeho stálosť (determinizmus).
 */
export function sideLayouts(side: SideDef): readonly SideLayout[] {
  const free: SlotIndex[] = SLOT_INDEXES.filter((i) => !side.blocked.includes(i));

  // Multimnožina symbolov: akcie + prázdne miesta do počtu voľných slotov.
  const symbols = new Map<string, number>();
  let actionCount = 0;
  for (const [action, count] of Object.entries(side.actions)) {
    if (count === undefined || count <= 0) continue;
    symbols.set(action, count);
    actionCount += count;
  }
  const emptyCount = free.length - actionCount;
  if (emptyCount < 0) {
    throw new Error(
      `Strana má ${actionCount} akcií, ale len ${free.length} voľných slotov.`,
    );
  }
  if (emptyCount > 0) symbols.set("", emptyCount);

  const distinct = [...symbols.keys()].sort();
  const layouts: SideLayout[] = [];
  const current: string[] = [];

  const recurse = (): void => {
    if (current.length === free.length) {
      const layout: Slot[] = [null, null, null, null];
      free.forEach((slotIndex, k) => {
        const sym = current[k];
        layout[slotIndex] = sym === "" || sym === undefined ? null : (sym as Action);
      });
      layouts.push(layout as unknown as SideLayout);
      return;
    }
    for (const sym of distinct) {
      const remaining = symbols.get(sym) ?? 0;
      if (remaining === 0) continue;
      symbols.set(sym, remaining - 1);
      current.push(sym);
      recurse();
      current.pop();
      symbols.set(sym, remaining);
    }
  };

  recurse();
  return layouts;
}

export interface CardVariants {
  readonly left: readonly SideLayout[];
  readonly right: readonly SideLayout[];
  readonly total: number;
}

export function cardVariants(def: CardDef): CardVariants {
  const left = sideLayouts(def.left);
  const right = sideLayouts(def.right);
  return { left, right, total: left.length * right.length };
}

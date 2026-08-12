// Vyhodnotenie línie kariet — jadro hry (M2).
//
// Geometria: karty tvoria jednu súvislú líniu
//
//   [posledná karta hráča 0] … [prvá karta hráča 0] [LOKALITA] [prvá karta hráča 1] …
//
// v „globálnom ráme“ = pohľad hráča 0. Karta je v globálnom ráme otočená
// o 180° práve vtedy, keď ju zahral hráč 1 (karty čelia hráčovi, ktorý ich
// zahral — vyloženie do súperovej partie je „nohami hore“ voči tej partii).
// Lokalita je otočená podľa natočenia útočníkom. Otočenie o 180°: ľavá
// a pravá strana sa vymenia a poradie indexov sa obráti (0↔3, 1↔2).
//
// Na spoji sa stretáva PRAVÁ strana ľavého prvku s ĽAVOU stranou pravého
// prvku na rovnakom indexe; akcia je aktívna, keď sú oba sloty neprázdne.
//
// Rozhodnutia pri nejasných pravidlách (viď README):
//  - Posilnenie + Posilnenie: nič sa nedeje (niet čo zdvojnásobiť).
//  - Vzbura na lokalite aktivuje len stranu patriacu danej partii.
//  - Vzbura ani NA EX neoživujú akcie zrušené Odporom.
//  - NA EX mení len akcie cieľovej karty; už vypočítané dôsledky jej akcií
//    na susedoch (Posilnenie ×2, Odpor zrušenie) ostávajú.

import type { Action, CardInstance, PlayerId, SideLayout, Slot } from "./types.ts";
import type { GameData } from "./data.ts";
import { printedSides } from "./data.ts";

/** Karta ležiaca v partii. */
export interface PlacedCard {
  readonly card: CardInstance;
  readonly playedBy: PlayerId;
  /** Hráč, ktorého poldeci na karte leží cez NA EX (vlastník poldeci), ak nejaký. */
  readonly naexBy?: PlayerId;
}

export interface LineState {
  readonly lokalita: CardInstance | null;
  /**
   * false = vytlačená ľavá strana lokality patrí hráčovi 0;
   * true  = lokalita otočená o 180°, hráčovi 0 patrí vytlačená pravá strana.
   */
  readonly lokalitaOtocena: boolean;
  /** partie[p][0] je karta najbližšie k lokalite. */
  readonly partie: readonly [readonly PlacedCard[], readonly PlacedCard[]];
}

export type SlotStav = "neaktivna" | "aktivna" | "zrusena";

export interface SlotEval {
  readonly action: Action;
  readonly stav: SlotStav;
  /** Koľkokrát sa akcia počíta (2 = Posilnenie alebo NA EX; 0 = zrušená/neaktívna). */
  readonly nasobok: number;
}

/** Vyhodnotenie jednej karty — sloty vo VYTLAČENOM ráme karty. */
export interface CardLineEval {
  readonly uid: number;
  readonly vzbura: boolean;
  readonly left: readonly (SlotEval | null)[];
  readonly right: readonly (SlotEval | null)[];
}

export type ActionSums = Readonly<Partial<Record<Action, number>>>;

export interface LineEval {
  /** Súčty aktívnych akcií podľa hráča (akcie pôsobia v partii, kde karta leží). */
  readonly sums: readonly [ActionSums, ActionSums];
  readonly cards: ReadonlyMap<number, CardLineEval>;
}

/** Posilnenie a Odpor sú modifikátory spoja — do súčtov nikdy neprispievajú. */
const MODIFIERS: readonly Action[] = ["Posilnenie", "Odpor"];

interface Elem {
  readonly uid: number;
  /** Hráč, ktorému patria aktívne akcie kariet; lokalita má strany rozdelené. */
  readonly owner: PlayerId;
  readonly isLokalita: boolean;
  readonly rotated: boolean;
  readonly printed: { readonly left: SideLayout; readonly right: SideLayout };
  readonly effLeft: readonly Slot[];
  readonly effRight: readonly Slot[];
  /** stav[side][k]: side 0 = efektívna ľavá, 1 = efektívna pravá. */
  readonly stav: SlotStav[][];
  readonly nasobok: number[][];
  /** vzbura[side] pre lokalitu; karta má vzburu vždy za obe strany naraz. */
  readonly vzbura: [boolean, boolean];
  readonly naexBy: PlayerId | undefined;
}

function reversed(side: SideLayout): Slot[] {
  return [side[3], side[2], side[1], side[0]];
}

function freshStav(): SlotStav[] {
  return ["neaktivna", "neaktivna", "neaktivna", "neaktivna"];
}

function freshNasobok(): number[] {
  return [0, 0, 0, 0];
}

function makeElem(
  data: GameData,
  card: CardInstance,
  owner: PlayerId,
  rotated: boolean,
  isLokalita: boolean,
  naexBy: PlayerId | undefined,
): Elem {
  const printed = printedSides(data, card);
  return {
    uid: card.uid,
    owner,
    isLokalita,
    rotated,
    printed,
    effLeft: rotated ? reversed(printed.right) : [...printed.left],
    effRight: rotated ? reversed(printed.left) : [...printed.right],
    stav: [freshStav(), freshStav()],
    nasobok: [freshNasobok(), freshNasobok()],
    vzbura: [false, false],
    naexBy,
  };
}

function markVzbura(elem: Elem, side: 0 | 1): void {
  if (elem.isLokalita) {
    elem.vzbura[side] = true;
  } else {
    elem.vzbura[0] = true;
    elem.vzbura[1] = true;
  }
}

/** Spoj medzi susedmi: pravá strana `a` proti ľavej strane `b`. */
function resolveJunction(a: Elem, b: Elem): void {
  for (let k = 0; k < 4; k++) {
    const actA = a.effRight[k];
    const actB = b.effLeft[k];
    if (actA == null || actB == null) continue;

    const odporA = actA === "Odpor";
    const odporB = actB === "Odpor";
    const posilA = actA === "Posilnenie";
    const posilB = actB === "Posilnenie";

    if (odporA && odporB) {
      // Vzbura — oba Odpory sa vyrušia a obe karty aktivujú neprepojené akcie.
      a.stav[1]![k] = "aktivna";
      b.stav[0]![k] = "aktivna";
      markVzbura(a, 1);
      markVzbura(b, 0);
    } else if (odporA || odporB) {
      const [odporElem, odporSide, otherElem, otherSide, otherAct] = odporA
        ? ([a, 1, b, 0, actB] as const)
        : ([b, 0, a, 1, actA] as const);
      odporElem.stav[odporSide]![k] = "aktivna";
      otherElem.stav[otherSide]![k] = "zrusena";
      // Posilnenie + Odpor: neprepojené akcie aktivuje IBA karta s Odporom.
      if (otherAct === "Posilnenie") markVzbura(odporElem, odporSide);
    } else if (posilA && posilB) {
      // Posilnenie + Posilnenie: pravidlá mlčia — rozhodnutie: nič sa nedeje.
      a.stav[1]![k] = "aktivna";
      b.stav[0]![k] = "aktivna";
    } else if (posilA || posilB) {
      const [posilElem, posilSide, otherElem, otherSide] = posilA
        ? ([a, 1, b, 0] as const)
        : ([b, 0, a, 1] as const);
      posilElem.stav[posilSide]![k] = "aktivna";
      otherElem.stav[otherSide]![k] = "aktivna";
      otherElem.nasobok[otherSide]![k] = 2;
    } else {
      a.stav[1]![k] = "aktivna";
      a.nasobok[1]![k] = 1;
      b.stav[0]![k] = "aktivna";
      b.nasobok[0]![k] = 1;
    }
  }
}

function applyVzbura(elem: Elem): void {
  for (const side of [0, 1] as const) {
    if (!elem.vzbura[side]) continue;
    const actions = side === 0 ? elem.effLeft : elem.effRight;
    for (let k = 0; k < 4; k++) {
      if (actions[k] != null && elem.stav[side]![k] === "neaktivna") {
        elem.stav[side]![k] = "aktivna";
        elem.nasobok[side]![k] = 1;
      }
    }
  }
}

function applyNaex(elem: Elem): void {
  if (elem.naexBy === undefined) return;
  for (const side of [0, 1] as const) {
    const actions = side === 0 ? elem.effLeft : elem.effRight;
    for (let k = 0; k < 4; k++) {
      if (actions[k] == null) continue;
      const stav = elem.stav[side]![k];
      if (stav === "aktivna") {
        elem.stav[side]![k] = "zrusena";
        elem.nasobok[side]![k] = 0;
      } else if (stav === "neaktivna") {
        elem.stav[side]![k] = "aktivna";
        elem.nasobok[side]![k] = 2;
      }
    }
  }
}

function elemEval(elem: Elem): CardLineEval {
  // Výstup mapujeme späť do vytlačeného rámu karty: pri otočenej karte je
  // efektívna ľavá strana vytlačenou pravou v obrátenom poradí indexov.
  const printedSlot = (printedSide: 0 | 1, k: number): SlotEval | null => {
    const [side, idx] = elem.rotated
      ? ([printedSide === 0 ? 1 : 0, 3 - k] as const)
      : ([printedSide, k] as const);
    const actions = side === 0 ? elem.effLeft : elem.effRight;
    const action = actions[idx];
    if (action == null) return null;
    return {
      action,
      stav: elem.stav[side]![idx] as SlotStav,
      nasobok: elem.nasobok[side]![idx] as number,
    };
  };
  return {
    uid: elem.uid,
    vzbura: elem.vzbura[0] || elem.vzbura[1],
    left: [0, 1, 2, 3].map((k) => printedSlot(0, k)),
    right: [0, 1, 2, 3].map((k) => printedSlot(1, k)),
  };
}

export function evaluateLine(data: GameData, line: LineState): LineEval {
  const elems: Elem[] = [];
  const segments: Elem[][] = [];

  const partia0 = line.partie[0].map((p) =>
    makeElem(data, p.card, 0, p.playedBy === 1, false, p.naexBy),
  );
  const partia1 = line.partie[1].map((p) =>
    makeElem(data, p.card, 1, p.playedBy === 1, false, p.naexBy),
  );

  if (line.lokalita !== null) {
    // owner lokality je len formálny — súčty jej strán sa delia podľa strán.
    const lok = makeElem(data, line.lokalita, 0, line.lokalitaOtocena, true, undefined);
    segments.push([...[...partia0].reverse(), lok, ...partia1]);
    elems.push(...partia0, lok, ...partia1);
  } else {
    // Bitka o staršieho nemá lokalitu: partie sú dva samostatné úseky,
    // prvá karta nemá suseda zľava.
    segments.push([...partia0].reverse(), [...partia1]);
    elems.push(...partia0, ...partia1);
  }

  for (const segment of segments) {
    for (let i = 0; i + 1 < segment.length; i++) {
      resolveJunction(segment[i] as Elem, segment[i + 1] as Elem);
    }
  }
  for (const elem of elems) applyVzbura(elem);
  for (const elem of elems) applyNaex(elem);

  const sums: [Partial<Record<Action, number>>, Partial<Record<Action, number>>] = [{}, {}];
  for (const elem of elems) {
    for (const side of [0, 1] as const) {
      const actions = side === 0 ? elem.effLeft : elem.effRight;
      for (let k = 0; k < 4; k++) {
        const action = actions[k];
        if (action == null || MODIFIERS.includes(action)) continue;
        if (elem.stav[side]![k] !== "aktivna") continue;
        const nasobok = elem.nasobok[side]![k] as number;
        if (nasobok === 0) continue;
        // Efektívna ľavá strana lokality patrí hráčovi 0, pravá hráčovi 1;
        // akcie karty patria partii, v ktorej karta leží.
        const target: PlayerId = elem.isLokalita ? side : elem.owner;
        sums[target][action] = (sums[target][action] ?? 0) + nasobok;
      }
    }
  }

  const cards = new Map<number, CardLineEval>();
  for (const elem of elems) cards.set(elem.uid, elemEval(elem));

  return { sums, cards };
}

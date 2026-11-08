// Sada s hranami Nástrojov (rework Náradia, Michal 2026-11-08) — kým admin hrany nezadá
// v tvorcovi a cards.json sa neskopíruje (pravidlo 5), testy podloženia stoja na sade,
// v ktorej Nástroje dostanú text efektu zo zoznamu pre admina a stratia sloty.

import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import zoznam from "./data/naradie-hrany.json";
import type { GameData } from "../src/index.ts";
import { loadGameData } from "../src/index.ts";

interface SurovaKarta {
  readonly id: string;
  readonly effect_text: string;
}

/** Sada (JSON vo formáte cards.json), v ktorej Nástroje zo zoznamu majú hrany v texte a nemajú sloty. */
export function sHranami<T extends { readonly cards: readonly SurovaKarta[] }>(sada: T): T {
  const texty = new Map(zoznam.nastroje.map((n) => [n.id, n.effect_text]));
  const bezSlotov = { blocked: [], actions: {} };
  return {
    ...sada,
    cards: sada.cards.map((c) => {
      const text = texty.get(c.id);
      return text === undefined ? c : { ...c, effect_text: text, left: bezSlotov, right: bezSlotov, permutations: { total: 1, left: 1, right: 1 } };
    }),
  } as unknown as T;
}

/** cards.json s hranami 22 Nástrojov podľa zoznamu. */
export function dataSHranami(): GameData {
  return loadGameData(sHranami(cardsJson), eldersJson, scorecardsJson);
}

// Budúca sada Zrejúcej (Michal 2026-11-08, Občania v troch kategóriách): kým admin neprepíše
// 8 Občanov a hrany Nástrojov v tvorcovi a cards.json sa neskopíruje (pravidlo 5), testy
// Školiteľov stoja na sade cards.json + nové texty 8 kariet (test/data/obcania-kategorie.json)
// + hrany 22 Nástrojov bez slotov (naradieData.ts).

import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import zoznam from "./data/obcania-kategorie.json";
import type { GameData } from "../src/index.ts";
import { loadGameData } from "../src/index.ts";
import { sHranami } from "./naradieData.ts";

interface SurovaKarta {
  readonly id: string;
  readonly effect_text: string;
  readonly triggers: readonly string[];
}

// Vedúcko zmenil Michal 2026-11-09 z Furt na Podporu (v11.18) — zoznam z 2026-11-08 je história,
// platí text z cards.json.
const NOVSIE_V_SADE: ReadonlySet<string> = new Set(["veducko"]);

/** Sada (JSON vo formáte cards.json) s novými textami a spúšťačmi 8 Občanov zo zoznamu. */
export function sObcanmi<T extends { readonly cards: readonly SurovaKarta[] }>(sada: T): T {
  const nove = new Map(zoznam.karty.filter((k) => !NOVSIE_V_SADE.has(k.id)).map((k) => [k.id, k]));
  return {
    ...sada,
    cards: sada.cards.map((c) => {
      const k = nove.get(c.id);
      return k === undefined ? c : { ...c, effect_text: k.effect_text, triggers: k.triggers };
    }),
  } as unknown as T;
}

/** cards.json budúcej sady: hrany Nástrojov + 8 Občanov. */
export function buducaSadaJson(): typeof cardsJson {
  return sObcanmi(sHranami(cardsJson));
}

/** Budúca sada Zrejúcej ako GameData. */
export function dataBuducejSady(): GameData {
  return loadGameData(buducaSadaJson(), eldersJson, scorecardsJson);
}

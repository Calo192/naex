// Načítanie a validácia dát z packages/core/data/*.json.
//
// Jadro nesmie robiť I/O, preto súbory načítava volajúci (server cez fs,
// klient a testy cez import) a sem posiela surové JSON hodnoty. Validácia
// je prísna — preklep v dátach má spadnúť pri štarte, nie uprostred partie.

import type {
  Action,
  CardDef,
  ElderDef,
  Favour,
  ScoringPos,
  SideDef,
  SideLayout,
  SlotIndex,
  Tag,
  Trigger,
  Zone,
} from "./types.ts";
import { ALL_ACTIONS, ALL_FAVOURS } from "./types.ts";
import type { CardVariants } from "./variants.ts";
import { cardVariants } from "./variants.ts";

export interface GameData {
  readonly cards: ReadonlyMap<string, CardDef>;
  readonly elders: ReadonlyMap<string, ElderDef>;
  /** Predpočítané rozloženia strán — počítať ich pri každom vyhodnotení je zbytočné. */
  readonly variants: ReadonlyMap<string, CardVariants>;
  /** Pomocné zoznamy — poradie podľa `index` v cards.json (stabilné). */
  readonly lokality: readonly CardDef[];
  readonly nastroje: readonly CardDef[];
  readonly staresinovia: readonly CardDef[];
}

function fail(path: string, msg: string): never {
  throw new Error(`Chybné dáta (${path}): ${msg}`);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asString(v: unknown, path: string): string {
  if (typeof v !== "string") fail(path, `očakávam string, mám ${typeof v}`);
  return v;
}

function asNumber(v: unknown, path: string): number {
  if (typeof v !== "number" || !Number.isFinite(v)) fail(path, "očakávam číslo");
  return v;
}

function asArray(v: unknown, path: string): readonly unknown[] {
  if (!Array.isArray(v)) fail(path, "očakávam pole");
  return v;
}

function parseSide(v: unknown, path: string): SideDef {
  if (!isRecord(v)) fail(path, "očakávam objekt");
  const blocked = asArray(v.blocked, `${path}.blocked`).map((b, i) => {
    const n = asNumber(b, `${path}.blocked[${i}]`);
    if (n !== 0 && n !== 1 && n !== 2 && n !== 3) fail(path, `blokovaný slot ${n} mimo 0..3`);
    return n as SlotIndex;
  });
  if (!isRecord(v.actions)) fail(`${path}.actions`, "očakávam objekt");
  const actions: Partial<Record<Action, number>> = {};
  for (const [key, count] of Object.entries(v.actions)) {
    if (!(ALL_ACTIONS as readonly string[]).includes(key)) {
      fail(`${path}.actions`, `neznáma akcia „${key}“`);
    }
    actions[key as Action] = asNumber(count, `${path}.actions.${key}`);
  }
  if (v.allowed === undefined) return { blocked, actions };
  if (!isRecord(v.allowed)) fail(`${path}.allowed`, "očakávam objekt");
  const allowed: Partial<Record<SlotIndex, readonly Action[]>> = {};
  for (const [pos, list] of Object.entries(v.allowed)) {
    const n = Number(pos);
    if (n !== 0 && n !== 1 && n !== 2 && n !== 3) fail(`${path}.allowed`, `pozícia ${pos} mimo 0..3`);
    allowed[n as SlotIndex] = asArray(list, `${path}.allowed.${pos}`).map((a) => {
      const s = asString(a, `${path}.allowed.${pos}`);
      if (!(ALL_ACTIONS as readonly string[]).includes(s)) fail(`${path}.allowed`, `neznáma akcia „${s}“`);
      return s as Action;
    });
  }
  return { blocked, actions, allowed };
}

export function parseCards(json: unknown): ReadonlyMap<string, CardDef> {
  if (!isRecord(json)) fail("cards.json", "očakávam objekt");
  const cards = new Map<string, CardDef>();
  for (const raw of asArray(json.cards, "cards.json.cards")) {
    if (!isRecord(raw)) fail("cards.json.cards[]", "očakávam objekt");
    const id = asString(raw.id, "card.id");
    const path = `karta ${id}`;
    const tags = asArray(raw.tags, `${path}.tags`).map((t, i) => {
      // Tagy nemajú vlastné pravidlá (PRAVIDLA §2) — tvorca smie zaviesť nový;
      // motor reaguje len na tie, ktoré pozná.
      return asString(t, `${path}.tags[${i}]`) as Tag;
    });
    const triggers = asArray(raw.triggers, `${path}.triggers`).map((t, i) => {
      // Neznámy spúšťač nevadí — taký efekt beží v režime MANUAL.
      return asString(t, `${path}.triggers[${i}]`) as Trigger;
    });
    if (!isRecord(raw.permutations)) fail(path, "chýba permutations");
    const def: CardDef = {
      id,
      index: asNumber(raw.index, `${path}.index`),
      name: asString(raw.name, `${path}.name`),
      tags,
      effectText: asString(raw.effect_text, `${path}.effect_text`),
      triggers,
      left: parseSide(raw.left, `${path}.left`),
      right: parseSide(raw.right, `${path}.right`),
      permutations: {
        total: asNumber(raw.permutations.total, `${path}.permutations.total`),
        left: asNumber(raw.permutations.left, `${path}.permutations.left`),
        right: asNumber(raw.permutations.right, `${path}.permutations.right`),
      },
    };
    if (cards.has(id)) fail(path, "duplicitné id");
    cards.set(id, def);
  }
  return cards;
}

export function parseElders(json: unknown, cards: ReadonlyMap<string, CardDef>): ReadonlyMap<string, ElderDef> {
  if (!isRecord(json)) fail("elders.json", "očakávam objekt");
  const elders = new Map<string, ElderDef>();
  for (const raw of asArray(json.elders, "elders.json.elders")) {
    if (!isRecord(raw)) fail("elders.json.elders[]", "očakávam objekt");
    const id = asString(raw.id, "elder.id");
    const path = `starší ${id}`;
    const card = cards.get(id);
    if (card === undefined) fail(path, "nemá kartu v cards.json");
    if (!card.tags.includes("Starešina")) fail(path, "karta nemá tag Starešina");
    const favour = asString(raw.favour, `${path}.favour`);
    if (!(ALL_FAVOURS as readonly string[]).includes(favour)) fail(path, `neznáma priazeň „${favour}“`);
    const scoring = asArray(raw.scoring, `${path}.scoring`).map((s, i): ScoringPos => {
      if (!isRecord(s)) fail(`${path}.scoring[${i}]`, "očakávam objekt");
      const zone = asNumber(s.zone, `${path}.scoring[${i}].zone`);
      if (zone !== 1 && zone !== 2 && zone !== 3) fail(path, `zóna ${zone} mimo 1..3`);
      return { zone: zone as Zone, points: asNumber(s.points, `${path}.scoring[${i}].points`) };
    });
    if (scoring.length !== 8) fail(path, `scoring má ${scoring.length} pozícií, treba 8`);
    if (elders.has(id)) fail(path, "duplicitné id");
    elders.set(id, { id, favour: favour as Favour, scoring });
  }
  return elders;
}

/**
 * Poskladá GameData z už zvalidovaných definícií. Oddelené od loadGameData,
 * aby testy mohli stavať syntetické karty bez JSON-u.
 */
export function buildGameData(
  cards: ReadonlyMap<string, CardDef>,
  elders: ReadonlyMap<string, ElderDef>,
): GameData {
  const variants = new Map<string, CardVariants>();
  // Kontrolné súčty generátora variantov — nesúlad znamená, že sa rozišiel
  // generátor s exportom KartyAI, a to má spadnúť hneď pri štarte.
  for (const def of cards.values()) {
    const v = cardVariants(def);
    if (
      v.left.length !== def.permutations.left ||
      v.right.length !== def.permutations.right ||
      v.total !== def.permutations.total
    ) {
      fail(
        `karta ${def.id}`,
        `generátor variantov nesedí s permutations: ` +
          `${v.left.length}×${v.right.length}=${v.total}, ` +
          `očakávané ${def.permutations.left}×${def.permutations.right}=${def.permutations.total}`,
      );
    }
    variants.set(def.id, v);
  }

  const byIndex = [...cards.values()].sort((a, b) => a.index - b.index);
  return {
    cards,
    elders,
    variants,
    lokality: byIndex.filter((c) => c.tags.includes("Lokalita")),
    nastroje: byIndex.filter((c) => c.tags.includes("Nástroj")),
    staresinovia: byIndex.filter((c) => c.tags.includes("Starešina")),
  };
}

export function loadGameData(cardsJson: unknown, eldersJson: unknown): GameData {
  const cards = parseCards(cardsJson);
  const elders = parseElders(eldersJson, cards);
  return buildGameData(cards, elders);
}

/** Definícia karty pre inštanciu — chýbajúca definícia je chyba dát, nie hry. */
export function defOf(data: GameData, inst: { readonly defId: string }): CardDef {
  const def = data.cards.get(inst.defId);
  if (def === undefined) fail(`karta ${inst.defId}`, "inštancia bez definície");
  return def;
}

/** Vytlačené strany konkrétnej inštancie (variant vybraný pri vzniku karty). */
export function printedSides(
  data: GameData,
  inst: { readonly defId: string; readonly leftLayout: number; readonly rightLayout: number },
): { readonly left: SideLayout; readonly right: SideLayout } {
  const v = data.variants.get(inst.defId);
  if (v === undefined) fail(`karta ${inst.defId}`, "chýbajú varianty");
  const left = v.left[inst.leftLayout];
  const right = v.right[inst.rightLayout];
  if (left === undefined || right === undefined) {
    fail(`karta ${inst.defId}`, `variant ${inst.leftLayout}/${inst.rightLayout} neexistuje`);
  }
  return { left, right };
}

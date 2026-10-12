// Načítanie a validácia dát z packages/core/data/*.json.
//
// Jadro nesmie robiť I/O, preto súbory načítava volajúci (server cez fs,
// klient a testy cez import) a sem posiela surové JSON hodnoty. Validácia
// je prísna — preklep v dátach má spadnúť pri štarte, nie uprostred partie.

import type {
  Action,
  CardDef,
  ElderDef,
  Podmienka,
  ScorecardDef,
  SideDef,
  SideLayout,
  SlotIndex,
  Tag,
  Trigger,
} from "./types.ts";
import { ALL_ACTIONS, ALL_PODMIENKY, priazenZKluca } from "./types.ts";
import type { CardVariants } from "./variants.ts";
import { cardVariants } from "./variants.ts";

export interface GameData {
  readonly cards: ReadonlyMap<string, CardDef>;
  readonly elders: ReadonlyMap<string, ElderDef>;
  /** Scorecardy, ktoré sa rozdávajú starším pri príprave (aspoň toľko ako starších). */
  readonly scorecards: readonly ScorecardDef[];
  /** Body za splnenú podmienku (zóna) alebo za kus (ostatné). */
  readonly bodyPodmienok: Readonly<Record<Podmienka, number>>;
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
    if (elders.has(id)) fail(path, "duplicitné id");
    elders.set(id, { id });
  }
  return elders;
}

export interface ScorecardsData {
  readonly scorecards: readonly ScorecardDef[];
  readonly body: Readonly<Record<Podmienka, number>>;
}

export const NULOVE_BODY: Readonly<Record<Podmienka, number>> = Object.fromEntries(
  ALL_PODMIENKY.map((p) => [p, 0]),
) as Record<Podmienka, number>;

function parsePodmienky(v: unknown, path: string): (Podmienka | null)[] {
  const out = asArray(v, path).map((x, i): Podmienka | null => {
    if (x === null) return null;
    const p = asString(x, `${path}[${i}]`);
    if (!(ALL_PODMIENKY as readonly string[]).includes(p)) fail(path, `neznáma podmienka „${p}“`);
    return p as Podmienka;
  });
  if (out.length !== 4) fail(path, `má ${out.length} pozícií, treba 4`);
  return out;
}

export function parseScorecards(json: unknown): ScorecardsData {
  if (!isRecord(json)) fail("scorecards.json", "očakávam objekt");
  if (!isRecord(json.body)) fail("scorecards.json.body", "očakávam objekt");
  const rawBody = json.body;
  const body = Object.fromEntries(
    ALL_PODMIENKY.map((p) => [p, asNumber(rawBody[p], `scorecards.json.body.${p}`)]),
  ) as Record<Podmienka, number>;
  const ids = new Set<string>();
  const scorecards = asArray(json.scorecards, "scorecards.json.scorecards").map((raw): ScorecardDef => {
    if (!isRecord(raw)) fail("scorecards.json.scorecards[]", "očakávam objekt");
    const id = asString(raw.id, "scorecard.id");
    const path = `scorecard ${id}`;
    if (ids.has(id)) fail(path, "duplicitné id");
    ids.add(id);
    const kluc = asString(raw.favour, `${path}.favour`);
    const favour = priazenZKluca(kluc);
    if (favour === null) fail(path, `neznáma priazeň „${kluc}“`);
    return {
      id,
      nazov: asString(raw.nazov, `${path}.nazov`),
      favour,
      lava: parsePodmienky(raw.lava, `${path}.lava`),
      prava: parsePodmienky(raw.prava, `${path}.prava`),
    };
  });
  return { scorecards, body };
}

/**
 * Poskladá GameData z už zvalidovaných definícií. Oddelené od loadGameData,
 * aby testy mohli stavať syntetické karty bez JSON-u.
 */
export function buildGameData(
  cards: ReadonlyMap<string, CardDef>,
  elders: ReadonlyMap<string, ElderDef>,
  bodovanie: ScorecardsData = { scorecards: [], body: NULOVE_BODY },
): GameData {
  // Každý starší musí dostať vlastný scorecard (testy so syntetickými dátami
  // starších nemajú, a tak scorecardy nepotrebujú).
  if (bodovanie.scorecards.length < elders.size) {
    fail("scorecards.json", `${bodovanie.scorecards.length} scorecardov na ${elders.size} starších`);
  }
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
    scorecards: bodovanie.scorecards,
    bodyPodmienok: bodovanie.body,
    variants,
    lokality: byIndex.filter((c) => c.tags.includes("Lokalita")),
    nastroje: byIndex.filter((c) => c.tags.includes("Nástroj")),
    staresinovia: byIndex.filter((c) => c.tags.includes("Starešina")),
  };
}

export function loadGameData(cardsJson: unknown, eldersJson: unknown, scorecardsJson: unknown): GameData {
  const cards = parseCards(cardsJson);
  const elders = parseElders(eldersJson, cards);
  return buildGameData(cards, elders, parseScorecards(scorecardsJson));
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

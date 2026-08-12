// Základné typy dátovej vrstvy. Doménové pojmy ostávajú po slovensky —
// presne tak, ako sú v pravidlách a v cards.json.

export type PlayerId = 0 | 1;

export function opponentOf(p: PlayerId): PlayerId {
  return p === 0 ? 1 : 0;
}

/** Akcie v slotoch po stranách karty (kľúče z cards.json). */
export type Action =
  | "Rana"
  | "Pecka"
  | "Petelica"
  | "Povera"
  | "Pohoršenie"
  | "Viera"
  | "Dlh"
  | "PoškodeniePečene"
  | "Obmedzenie"
  | "Cigaretka"
  | "Vízia"
  | "Poldeci"
  | "Posilnenie"
  | "Odpor";

export const ALL_ACTIONS: readonly Action[] = [
  "Rana",
  "Pecka",
  "Petelica",
  "Povera",
  "Pohoršenie",
  "Viera",
  "Dlh",
  "PoškodeniePečene",
  "Obmedzenie",
  "Cigaretka",
  "Vízia",
  "Poldeci",
  "Posilnenie",
  "Odpor",
];

export type Tag =
  | "Autorita"
  | "Chlap"
  | "Influencer"
  | "Kliatba"
  | "Kriminál"
  | "Lokalita"
  | "Nástroj"
  | "Občan"
  | "Pamätník"
  | "Pracujúci"
  | "Starešina"
  | "Zahraničný"
  | "Zviera"
  | "Závislý"
  | "Žena";

export const ALL_TAGS: readonly Tag[] = [
  "Autorita",
  "Chlap",
  "Influencer",
  "Kliatba",
  "Kriminál",
  "Lokalita",
  "Nástroj",
  "Občan",
  "Pamätník",
  "Pracujúci",
  "Starešina",
  "Zahraničný",
  "Zviera",
  "Závislý",
  "Žena",
];

/** Spúšťače efektov (union hodnôt z cards.json a pojmov z pravidiel). */
export type Trigger =
  | "Nástup"
  | "Furt"
  | "Bitka"
  | "Pitka"
  | "Zhromaždenie"
  | "Dedičstvo"
  | "Výhra"
  | "Prehra"
  | "Prestávka"
  | "Podpora";

export const ALL_TRIGGERS: readonly Trigger[] = [
  "Nástup",
  "Furt",
  "Bitka",
  "Pitka",
  "Zhromaždenie",
  "Dedičstvo",
  "Výhra",
  "Prehra",
  "Prestávka",
  "Podpora",
];

/** Fázy kola — stavový automat motora (M6). */
export type Phase =
  | "volbaCiela"
  | "draft"
  | "zhromazdenie"
  | "pitka"
  | "bitka"
  | "koniec";

export type SlotIndex = 0 | 1 | 2 | 3;
export const SLOT_INDEXES: readonly SlotIndex[] = [0, 1, 2, 3];

/** Jedna strana karty tak, ako je v cards.json: multimnožina akcií + blokované sloty. */
export interface SideDef {
  readonly blocked: readonly SlotIndex[];
  readonly actions: Readonly<Partial<Record<Action, number>>>;
}

export interface CardDef {
  readonly id: string;
  readonly index: number;
  readonly name: string;
  readonly tags: readonly Tag[];
  readonly effectText: string;
  readonly triggers: readonly Trigger[];
  readonly left: SideDef;
  readonly right: SideDef;
  /** Kontrolný súčet generátora variantov (z exportu KartyAI). */
  readonly permutations: { readonly total: number; readonly left: number; readonly right: number };
}

/**
 * Obsah jedného slotu v konkrétnom rozložení: akcia, prázdno (null)
 * — blokovaný slot je v rozložení tiež null, rozdiel pozná len SideDef.
 */
export type Slot = Action | null;

/** Konkrétne rozloženie akcií jednej strany po slotoch 0..3 (0 hore). */
export type SideLayout = readonly [Slot, Slot, Slot, Slot];

/**
 * Konkrétna inštancia karty v hre. Fyzická karta je vždy jeden konkrétny
 * variant (dvojica rozložení), preto inštancia nesie indexy rozložení.
 */
export interface CardInstance {
  readonly uid: number;
  readonly defId: string;
  readonly leftLayout: number;
  readonly rightLayout: number;
}

/** Priazne starších (kľúče z elders.json). */
export type Favour =
  | "OCUMOVATEL"
  | "LAKOMEC"
  | "NEPRAJNIK"
  | "BITKAR"
  | "VERIACI"
  | "FAJCIAR"
  | "ALKOHOLIK"
  | "EXEKUTOR";

export const ALL_FAVOURS: readonly Favour[] = [
  "OCUMOVATEL",
  "LAKOMEC",
  "NEPRAJNIK",
  "BITKAR",
  "VERIACI",
  "FAJCIAR",
  "ALKOHOLIK",
  "EXEKUTOR",
];

/** Zóny stupnice strachu: 1 = Znepokojenie, 2 = Strach, 3 = Vydesenie. */
export type Zone = 1 | 2 | 3;

export interface ScoringPos {
  readonly zone: Zone;
  readonly points: number;
}

export interface ElderDef {
  readonly id: string;
  readonly favour: Favour;
  /**
   * 8 bočných bodovacích pozícií: indexy 0..3 = strana hráča 0 (páruje sa
   * s ľavou stranou karty staršieho), 4..7 = strana hráča 1 (pravá strana).
   */
  readonly scoring: readonly ScoringPos[];
}

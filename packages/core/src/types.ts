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
  | "Odpor"
  | "Robota";

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
  "Robota",
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
  | "Podpora"
  | "Exekúcia";

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
  "Exekúcia",
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
  /**
   * Obmedzenie pozícií (tvorca kariet KartyAI): pozícia uvedená tu smie
   * držať len vymenované akcie (alebo ostať prázdna). Chýbajúca pozícia
   * povoľuje všetko.
   */
  readonly allowed?: Readonly<Partial<Record<SlotIndex, readonly Action[]>>>;
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
  | "ZBERATEL"
  | "LAKOMEC"
  | "NEPRAJNIK"
  | "BITKAR"
  | "VERIACI"
  | "FAJCIAR"
  | "ALKOHOLIK"
  | "EXEKUTOR";

export const ALL_FAVOURS: readonly Favour[] = [
  "ZBERATEL",
  "LAKOMEC",
  "NEPRAJNIK",
  "BITKAR",
  "VERIACI",
  "FAJCIAR",
  "ALKOHOLIK",
  "EXEKUTOR",
];

/**
 * Zrušené priazne a ich náhrady — staré zverejnené sady a databázy ich ešte
 * nesú. Očumovateľ (Preskúmanie) v hre nič nerobil; nahradil ho Zberateľ
 * s limitom ruky (Michal 2026-10-12, playtest 20261012-055944).
 */
const PRIAZNE_ALIAS: Readonly<Record<string, Favour>> = { OCUMOVATEL: "ZBERATEL" };

/** Priazeň z kľúča (aj zrušeného), alebo null, ak taká nie je. */
export function priazenZKluca(kluc: string): Favour | null {
  if ((ALL_FAVOURS as readonly string[]).includes(kluc)) return kluc as Favour;
  return PRIAZNE_ALIAS[kluc] ?? null;
}

/** Zóny stupnice strachu: 1 = Znepokojenie, 2 = Strach, 3 = Vydesenie. */
export type Zone = 1 | 2 | 3;

export interface ElderDef {
  readonly id: string;
}

/**
 * Podmienka na scorecarde (bodovacej karte staršieho). Zóny sú prahové —
 * marker aspoň v danej zóne; ostatné bodujú za každý kus obávaného hráča,
 * kladné z nich až od oranžovej zóny (`prahPodmienky`).
 */
export type Podmienka =
  | "znepokojenie"
  | "strach"
  | "vydesenie"
  | "lokality"
  | "starsi"
  | "cigarety"
  | "cirhoza"
  | "dlh";

export const ALL_PODMIENKY: readonly Podmienka[] = [
  "znepokojenie",
  "strach",
  "vydesenie",
  "lokality",
  "starsi",
  "cigarety",
  "cirhoza",
  "dlh",
];

/**
 * Scorecard — podložka, na ktorej leží karta staršieho. Rozdáva sa starším
 * náhodne pri príprave a určuje priazeň staršieho. Podmienka na indexe i
 * sa aktivuje, keď má karta na ukazovateli na tej istej strane a indexe
 * neprázdnu akciu. Ľavá strana patrí hráčovi 0, pravá hráčovi 1.
 */
export interface ScorecardDef {
  readonly id: string;
  readonly nazov: string;
  readonly favour: Favour;
  readonly lava: readonly (Podmienka | null)[];
  readonly prava: readonly (Podmienka | null)[];
}

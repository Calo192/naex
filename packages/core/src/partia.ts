// Vyhodnotenie línie kariet — jadro hry (M2).
//
// Geometria: karty tvoria jednu súvislú líniu
//
//   [posledná karta hráča 0] … [prvá karta hráča 0] [LOKALITA] [prvá karta hráča 1] …
//
// v „globálnom ráme“ = pohľad hráča 0. Karta je v globálnom ráme otočená
// o 180° práve vtedy, keď ju zahral hráč 1 (karty čelia hráčovi, ktorý ich
// zahral — vyloženie do súperovej partie je „nohami hore“ voči tej partii).
// Akcie karty patria jej MAJITEĽOVI (tomu, kto ju zahral a k nemu je
// natočená), nie partii, v ktorej leží — pravidlá v3, rozhodnutie Michala
// 2026-10-11. Karta v súperovej partii tak aktivuje súperove akcie na
// spojoch (tie dostane súper) a sama boduje pre svojho majiteľa.
// Lokalita je otočená podľa natočenia obrancom (volí a natáča cieľ, 2026-10-20). Otočenie o 180°: ľavá
// a pravá strana sa vymenia a poradie indexov sa obráti (0↔3, 1↔2).
//
// Na spoji sa stretáva PRAVÁ strana ľavého prvku s ĽAVOU stranou pravého
// prvku na rovnakom indexe; akcia je aktívna, keď sú oba sloty neprázdne.
//
// Rozhodnutia pri nejasných pravidlách (viď README):
//  - Posilnenie + Posilnenie = Forsáž (v10.3, Michal 2026-11-02): obe karty spoja majú
//    všetky aktívne akcie posilnené; lokalita len hranu pri tom kraji, Nástroj nič.
//  - Vzbura obráti aktivitu karty (v11.1, Michal 2026-11-02): nespojené akcie sú aktívne,
//    spojené neaktívne; na lokalite len strana patriaca danej partii; Nástroj Vzburu nedostane (v10.3).
//    Odpor proti Posilneniu je Vzbura len karty s Odporom a jej aktívne akcie sú posilnené.
//  - Vzbura ani NA EX neoživujú akcie zrušené Odporom.
//  - NA EX mení len akcie cieľovej karty; zrušenie Odporom na susedovi
//    ostáva. Výnimka: zrušené Posilnenie prestane zdvojovať partnera na spoji
//    (Michal 2026-10-24, O1 z playtestu 20261024-075830).
//
// Efekty kariet, ktoré závisia od polohy v línii (Silná nezávislá žena,
// Zámočník, Mäsiar, Pes, Liberál; premena Šarlatána a Miňištranta), sa vyhodnocujú tu, po spojoch
// a NA EX — „okolie“ karty sú jej susedia v línii (aj lokalita či starší
// v strede). Výklad textov schválil Michal 2026-10-12.

import type { Action, CardInstance, Miesto, PlayerId, SideLayout, Slot, Tag } from "./types.ts";
import { opponentOf } from "./types.ts";
import type { GameData } from "./data.ts";
import { defOf, printedSides } from "./data.ts";

/** Karta ležiaca v partii. */
export interface PlacedCard {
  readonly card: CardInstance;
  readonly playedBy: PlayerId;
  /** Hráč, ktorého poldeci na karte leží cez NA EX (vlastník poldeci), ak nejaký. */
  readonly naexBy?: PlayerId;
  /**
   * Záverečná (roadmapa #83, Michal 2026-10-23): karta leží lícom dole do konca
   * Pitky. Ráta sa normálne, súper ju však nevidí (viewFor) a za ňu sa nedá
   * priložiť; efekty mimo línie a Nástup sa odložia na otočenie.
   */
  readonly zaverecna?: true;
  /**
   * NA EX naraz (v5, Michal 2026-10-24/25): druhý hráč, ktorého poldeci na karte
   * leží — obaja skryto vybrali tú istú kartu (zrážka). Pije ho pri bitke tiež.
   */
  readonly naexBy2?: PlayerId;
  /**
   * Zrážka NA EX: z karty je Výtržník — všetky jej akcie sú aktívne Rany pre
   * majiteľa (až po spárovaní). Len do konca bitky, potom
   * vytriezvie (Michal 2026-10-25).
   */
  readonly vytrznik?: true;
  /**
   * Odpoveď na NA EX lícom dole (v9.2, Michal 2026-10-30): leží so `zaverecna` (skrytá
   * ako Záverečná), kým sa odpovede kola neotočia naraz — ešte pred vyhodnotením Pitky.
   */
  readonly odpoved?: true;
  /**
   * Premena akcií do konca kola (v7): Šarlatán po Konflikte (Dlh → Viera,
   * Povera → Rana), Miňištrant, ktorý vyvolal Konflikt (Viera → Pecka).
   * Mení sa druh akcie, nie jej aktivita; po bitke ide karta do balíčka s pôvodnými.
   */
  readonly premena?: "sarlatan" | "ministrant";
  /**
   * Sypač (Podpora, v11.5): tvoj Chlap, s ktorým sa priložením stretol, má do konca kola
   * Rany ako Pecky. Samostatne od premeny — Šarlatán či Miňištrant ju môžu mať tiež.
   */
  readonly ranyAkoPecky?: true;
  /** Hrobár (Konflikt, v7): za túto kartu sa na jej strane už nič nepriloží. */
  readonly posledna?: true;
  /** Po bitke ide karta z hry (Vdova, Hrobár — Konflikt v7). */
  readonly poBitkeZHry?: true;
  /** Po bitke ide karta do odhadzovacieho balíčka tohto hráča a je jeho (Snúbenica, Konflikt v7). */
  readonly poBitkeK?: PlayerId;
  /** 2 na 2: člen tímu, ktorý kartu vyložil — karta „do ruky“ ide jemu (Michal 2026-11-02, Q4). */
  readonly miesto?: Miesto;
}

export interface LineState {
  /** Karta v strede línie: lokalita, v bitke o staršieho karta staršieho. */
  readonly lokalita: CardInstance | null;
  /**
   * false = vytlačená ľavá strana lokality patrí hráčovi 0;
   * true  = lokalita otočená o 180°, hráčovi 0 patrí vytlačená pravá strana.
   */
  readonly lokalitaOtocena: boolean;
  /** partie[p][0] je karta najbližšie k lokalite. */
  readonly strany: readonly [readonly PlacedCard[], readonly PlacedCard[]];
  /**
   * Nástroje v Dedičstve hráčov (defId) — tie, ktoré menia vyhodnotenie línie
   * (Náradie 2026-10-30: Zapaľovač, Energeťák, Výherné žreby, Hrable, Zrkadlo).
   * Chýba = žiadne (testy, ukážky).
   */
  readonly nastroje?: readonly [readonly string[], readonly string[]];
  /** Schopnosť väzňa Starosta (v11.2): všetky aktívne akcie hrán lokality sú posilnené — aj tie, ktoré sa vyhodnocujú v Pitke. */
  readonly hranyPosilnene?: boolean;
}

export type SlotStav = "neaktivna" | "aktivna" | "zrusena";

export interface SlotEval {
  readonly action: Action;
  readonly stav: SlotStav;
  /** Koľkokrát sa akcia počíta (2 = Posilnenie alebo NA EX; 0 = zrušená/neaktívna). */
  readonly nasobok: number;
  /** Akcia sa ráta ako iná (Šarlatán: Viera v jeho okolí platí ako Vízia). */
  readonly ako?: Action;
}

/** Vyhodnotenie jednej karty — sloty vo VYTLAČENOM ráme karty. */
export interface CardLineEval {
  readonly uid: number;
  readonly vzbura: boolean;
  /** Forsáž (v10.3): Posilnenie proti Posilneniu na niektorom spoji karty, NA EX ju nezrušil. */
  readonly forsaz: boolean;
  readonly left: readonly (SlotEval | null)[];
  readonly right: readonly (SlotEval | null)[];
}

export type ActionSums = Readonly<Partial<Record<Action, number>>>;

/**
 * Odkiaľ sa vzala aktívna akcia v súčte hráča — pre nápovedu v paneli bitky
 * (Michal 2026-10-20: hráč má vidieť, čo jeho hodnoty zvýšilo či znížilo).
 */
export interface ZdrojAkcie {
  /** Karta, ktorej slot akciu dal (lokalita aj karta staršieho v strede). */
  readonly defId: string;
  readonly uid: number;
  /** Koľko akcia do súčtu pridala (2 = zdvojená). */
  readonly hodnota: number;
  readonly vStrede: boolean;
  /**
   * Prečo je akcia aktívna či zdvojená: "Posilnenie", "Forsáž", "Vzbura", "NA EX",
   * alebo "karta:<defId>" pri efekte karty (Liberál, Zámočník, Pijan…).
   */
  readonly dovody: readonly string[];
}
export type ZdrojeAkcii = Readonly<Partial<Record<Action, readonly ZdrojAkcie[]>>>;

export interface LineEval {
  /** Súčty aktívnych akcií podľa hráča (akcie pôsobia v partii, kde karta leží). */
  readonly sums: readonly [ActionSums, ActionSums];
  readonly cards: ReadonlyMap<number, CardLineEval>;
  /**
   * Aktivované akcie karty v strede (lokalita, v bitke o staršieho jeho karta)
   * na strane hráča 0 a hráča 1 — z nich je počet Pitiek (Michal 2026-10-19).
   */
  readonly aktivneStredu: readonly [number, number];
  /** Rozpis súčtov — ktoré karty a prečo ich dali (sums sú ich súčty). */
  readonly zdroje: readonly [ZdrojeAkcii, ZdrojeAkcii];
  /**
   * Zrušené akcie po hráčoch, ktorým by inak patrili — hodnota 0, dovody = čím
   * („Odpor“, „NA EX“). Podrobná rekapitulácia ich ukáže sivé (Michal 2026-10-30).
   */
  readonly zrusene: readonly [ZdrojeAkcii, ZdrojeAkcii];
  /**
   * Koľko súperových akcií (bez modifikátorov) zrušil Odpor hráča — akcie, ktoré by inak patrili
   * súperovi; Odpor lokality sa neráta (Policajtka, Pitka: zadĺženie za každú).
   */
  readonly zruseneOdporom: readonly [number, number];
}

/**
 * Posilnenie a Odpor sú modifikátory spoja — do súčtov nikdy neprispievajú.
 * Pakt (v7) bez partnera nemá čo kopírovať; spárovaný sa na spoji premení na
 * akciu partnera (resolveJunction), takže v súčtoch sa ráta už ako ona.
 */
const TUHE: Partial<Record<Action, number>> = { Rana: 1, Pecka: 2, Petelica: 3 };

const MODIFIERS: readonly Action[] = ["Posilnenie", "Odpor", "Pakt"];

interface Elem {
  readonly uid: number;
  readonly defId: string;
  readonly tags: readonly Tag[];
  /** Majiteľ karty — dostane jej aktívne akcie; lokalita má strany rozdelené. */
  readonly owner: PlayerId;
  readonly isLokalita: boolean;
  /** Strana línie, na ktorej karta leží (lokalita v strede: null). */
  readonly strana: PlayerId | null;
  readonly rotated: boolean;
  readonly printed: { readonly left: SideLayout; readonly right: SideLayout };
  readonly effLeft: readonly Slot[];
  readonly effRight: readonly Slot[];
  /** stav[side][k]: side 0 = efektívna ľavá, 1 = efektívna pravá. */
  readonly stav: SlotStav[][];
  readonly nasobok: number[][];
  /** vzbura[side] pre lokalitu; karta má vzburu vždy za obe strany naraz. */
  readonly vzbura: [boolean, boolean];
  /**
   * Vzbura z Odporu proti Posilneniu (v11.1, Michal 2026-11-02): aktívne akcie karty sú
   * posilnené — [side] pre lokalitu, karta za obe strany naraz.
   */
  readonly vzburaPosilnena: [boolean, boolean];
  /** forsaz[side] pre lokalitu (len hrana pri tom kraji); karta ju má za obe strany naraz. */
  readonly forsaz: [boolean, boolean];
  readonly naexBy: PlayerId | undefined;
  /** Šarlatán v okolí: Viera tejto karty sa ráta ako Vízia (do v6; v7 nepoužíva). */
  vieraAkoVizia: boolean;
  /** Premena akcií do konca kola (PlacedCard.premena). */
  readonly premena: PlacedCard["premena"];
  /** dovody[side][k]: čo akciu aktivovalo či zdvojilo (ZdrojAkcie.dovody). */
  readonly dovody: string[][][];
  /** zrusil[side][k]: čím je akcia zrušená („Odpor“, „NA EX“) — LineEval.zrusene. */
  readonly zrusil: (string | null)[][];
  /** Akcie susedov, ktoré Posilnenie tejto karty zdvojilo — NA EX ich zdvojenie zruší. */
  readonly posilnene: { readonly elem: Elem; readonly side: 0 | 1; readonly k: number }[];
  /** spojena[side][k]: slot má na spoji partnera (Výherné žreby rátajú podľa toho). */
  readonly spojena: boolean[][];
  /** zrusilOdporom[side][k]: majiteľ Odporu, ktorý akciu zrušil (Hrable). */
  readonly zrusilOdporom: (PlayerId | null)[][];
  /** tiper[side][k]: posilnená akcia na spoji Profesionálneho tipéra — jeho majiteľ (premena pri súčte). */
  readonly tiper: (PlayerId | null)[][];
  /** puska[side][k]: Petelica, ktorú Puška zachránila pred zrušením — ráta sa o 1 poškodenie menej. */
  readonly puska: boolean[][];
  /** Vedúcko v okolí: vytlačené Roboty karty sa rátajú ako Pecky. */
  robotaAkoPecka: boolean;
  /** Anonymný alkoholik majiteľa v okolí (v11.5): Poškodenie pečene karty sa ráta ako Viera. */
  pecenAkoViera: boolean;
  /** Sypač (PlacedCard.ranyAkoPecky): Rany karty sa rátajú ako Pecky. */
  readonly ranyAkoPecky: boolean;
}

/** Má hráč p v Dedičstve Nástroj defId? (LineState.nastroje) */
function maNastroj(line: Pick<LineState, "nastroje">, p: PlayerId, defId: string): boolean {
  return line.nastroje?.[p].includes(defId) ?? false;
}

/**
 * PREVAHA (Michal 2026-10-20): v kraji (polovici línie) ju má hráč, ktorý tam
 * má viac svojich Občanov, Zvierat a Starešinov — Nástroje a iné karty sa
 * nerátajú. Pri rovnosti rozhoduje majiteľ karty pri lokalite. Hráč s prevahou
 * dostane akcie hrany lokality v tom kraji.
 */
export function rataSaDoPrevahy(tags: readonly Tag[]): boolean {
  return tags.includes("Občan") || tags.includes("Zviera") || tags.includes("Starešina");
}

/** Prevaha v kraji z počtov a majiteľa karty pri lokalite (null = prázdny kraj). */
function kto(pocet: readonly [number, number], priLokalite: PlayerId | null): PlayerId | null {
  if (pocet[0] > pocet[1]) return 0;
  if (pocet[1] > pocet[0]) return 1;
  return priLokalite;
}

/**
 * Presbiter (Michal 2026-10-20, Bitka): ak v jeho kraji nemá majiteľ iného
 * Občana, Zviera ani Starešinu a súper tam má prevahu, súper má o toľko Viery
 * menej, koľko má Presbiter aktívnych akcií (s násobkami). Ráta sa počet Vier
 * pred vzájomným rušením s Poverou; Praudovravec súpera ho umlčí (Autorita).
 */
function presbiter(
  kraje: readonly [readonly Elem[], readonly Elem[]],
  prevahaKrajov: readonly [PlayerId | null, PlayerId | null],
  elems: readonly Elem[],
  sums: [Partial<Record<Action, number>>, Partial<Record<Action, number>>],
  zdroje: [Partial<Record<Action, ZdrojAkcie[]>>, Partial<Record<Action, ZdrojAkcie[]>>],
): void {
  for (const k of [0, 1] as const) {
    for (const e of kraje[k]) {
      if (e.defId !== "presbiter") continue;
      const su = opponentOf(e.owner);
      if (prevahaKrajov[k] !== su) continue;
      if (kraje[k].some((x) => x !== e && x.owner === e.owner && rataSaDoPrevahy(x.tags))) continue;
      if (elems.some((x) => x.defId === "praudovravec" && x.owner === su)) continue;
      let aktivnych = 0;
      for (const side of [0, 1] as const) {
        for (let i = 0; i < 4; i++) if (e.stav[side]![i] === "aktivna") aktivnych += e.nasobok[side]![i] as number;
      }
      const ubrat = Math.min(aktivnych, sums[su].Viera ?? 0);
      if (ubrat === 0) continue;
      sums[su].Viera = (sums[su].Viera ?? 0) - ubrat;
      (zdroje[su].Viera ??= []).push({ defId: "presbiter", uid: e.uid, hodnota: -ubrat, vStrede: false, dovody: ["karta:presbiter"] });
    }
  }
}

/** Koľko karta váži v prevahe: Dvojčatá (Furt) za dvoch, ostatné do prevahy 1, iné 0. */
function vahaVPrevahe(defId: string, tags: readonly Tag[]): number {
  // Brigádnik (Furt, v7): do prevahy sa neráta.
  if (!rataSaDoPrevahy(tags) || defId === "brigadnik") return 0;
  return defId === "dvojcata" ? 2 : 1;
}

/** Prevaha v kraji z prvkov línie (prvok [0] leží pri lokalite). */
function prevaha(strana: readonly Elem[]): PlayerId | null {
  const pocet: [number, number] = [0, 0];
  for (const e of strana) pocet[e.owner] += vahaVPrevahe(e.defId, e.tags);
  return kto(pocet, strana[0]?.owner ?? null);
}

/** Sila hráča 0 a 1 v kraji pre prevahu (Dvojčatá sa rátajú za dvoch). */
export function silaVKraji(data: GameData, strana: readonly PlacedCard[]): [number, number] {
  const pocet: [number, number] = [0, 0];
  for (const pl of strana) pocet[pl.playedBy] += vahaVPrevahe(pl.card.defId, defOf(data, pl.card).tags);
  return pocet;
}

/** Prevaha v jednom kraji tak, ako ju treba ukázať hráčom (návrh 5 A). */
export interface StavKraja {
  /** Sila hráča 0 a 1 (Dvojčatá za dvoch). */
  readonly pocet: readonly [number, number];
  /** Majiteľ karty hneď pri lokalite — rozhoduje rovnosť. */
  readonly priLokalite: PlayerId | null;
  readonly prevaha: PlayerId | null;
  readonly rovnost: boolean;
  /**
   * Koľko Občanov, Zvierat či Starešinov musí do kraja dať hráč bez prevahy,
   * aby ju prebral (pri rovnosti vyhráva karta pri lokalite, preto o 1 viac).
   * null pri prázdnom kraji.
   */
  readonly naPrebitie: number | null;
}

/**
 * Stav prevahy v kraji (Michal 2026-10-22, návrh 5 A z playtestu
 * 20261021-143600): hráči čítali „majiteľ karty pri lokalite“ ako majiteľa
 * lokality — rozhranie preto ukazuje rovnosť a koľko kariet treba na prebitie.
 */
export function stavKraja(data: GameData, strana: readonly PlacedCard[]): StavKraja {
  const pocet = silaVKraji(data, strana);
  const priLokalite = strana[0]?.playedBy ?? null;
  const prevaha = kto(pocet, priLokalite);
  const rovnost = priLokalite !== null && pocet[0] === pocet[1];
  if (prevaha === null) return { pocet, priLokalite, prevaha, rovnost, naPrebitie: null };
  const druhy = opponentOf(prevaha);
  // Pri rovnosti berie hranu karta pri lokalite — kto ju nemá, potrebuje o 1 viac.
  const naPrebitie = pocet[prevaha] - pocet[druhy] + (priLokalite === druhy ? 0 : 1);
  return { pocet, priLokalite, prevaha, rovnost, naPrebitie };
}

/** Prevaha v kraji pri strane hráča 0 a 1 — kto dostane akcie príslušnej hrany lokality. */
export function prevahaStran(data: GameData, strany: readonly [readonly PlacedCard[], readonly PlacedCard[]]): [PlayerId | null, PlayerId | null] {
  return [kto(silaVKraji(data, strany[0]), strany[0][0]?.playedBy ?? null), kto(silaVKraji(data, strany[1]), strany[1][0]?.playedBy ?? null)];
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
  strana: PlayerId | null,
  pl?: PlacedCard,
): Elem {
  const printed = printedSides(data, card);
  return {
    uid: card.uid,
    defId: card.defId,
    tags: defOf(data, card).tags,
    owner,
    isLokalita,
    strana,
    rotated,
    printed,
    effLeft: rotated ? reversed(printed.right) : [...printed.left],
    effRight: rotated ? reversed(printed.left) : [...printed.right],
    stav: [freshStav(), freshStav()],
    nasobok: [freshNasobok(), freshNasobok()],
    vzbura: [false, false],
    vzburaPosilnena: [false, false],
    forsaz: [false, false],
    naexBy,
    vieraAkoVizia: false,
    premena: pl?.premena,
    dovody: [0, 1].map(() => [[], [], [], []]),
    zrusil: [0, 1].map(() => [null, null, null, null]),
    posilnene: [],
    spojena: [0, 1].map(() => [false, false, false, false]),
    zrusilOdporom: [0, 1].map(() => [null, null, null, null]),
    tiper: [0, 1].map(() => [null, null, null, null]),
    puska: [0, 1].map(() => [false, false, false, false]),
    robotaAkoPecka: false,
    pecenAkoViera: false,
    ranyAkoPecky: pl?.ranyAkoPecky === true,
  };
}

/**
 * Puška (Dedičstvo, Michal 2026-10-30): keď by tvoju prepojenú Petelicu zrušil iný
 * efekt (Odpor, NA EX…), namiesto zrušenia udeľuje o 1 poškodenie menej (3 → 2).
 * Prepojená = má na spoji partnera; Petelica aktívna len zo Vzbury nie. Pod Vzburou
 * (v11.1) by bola prepojená Petelica neaktívna — Puška nemá čo chrániť. Výtržník
 * Petelicu neruší — Puška sa ho netýka; súperove Hrable nemajú čo ukradnúť.
 */
function puskaChrani(elem: Elem, line: Pick<LineState, "nastroje">): void {
  if (elem.isLokalita || !maNastroj(line, elem.owner, "puska")) return;
  for (const side of [0, 1] as const) {
    const actions = side === 0 ? elem.effLeft : elem.effRight;
    for (let k = 0; k < 4; k++) {
      if (actions[k] !== "Petelica" || !elem.spojena[side]![k] || elem.stav[side]![k] !== "zrusena" || elem.vzbura[side]) continue;
      elem.stav[side]![k] = "aktivna";
      elem.nasobok[side]![k] = 1;
      elem.zrusil[side]![k] = null;
      elem.zrusilOdporom[side]![k] = null;
      elem.puska[side]![k] = true;
      elem.dovody[side]![k] = ["karta:puska"];
    }
  }
}

/** Nástroj v línii (nie karta v strede) — Vzburu ani Forsáž nedostane (v10.3). */
function jeNastroj(elem: Elem): boolean {
  return !elem.isLokalita && elem.tags.includes("Nástroj");
}

function markVzbura(elem: Elem, side: 0 | 1): void {
  // Odpor Nástroja proti Odporu Občana: Vzburu dostane len Občan (v10.3); ani proti Posilneniu (v11.1).
  if (jeNastroj(elem)) return;
  if (elem.isLokalita) {
    elem.vzbura[side] = true;
  } else {
    elem.vzbura[0] = true;
    elem.vzbura[1] = true;
  }
}

/**
 * Nástroj funguje len na strane, kde ho podporuje Občan alebo Starešina
 * (Michal 2026-10-18). Pri lokalite, karte staršieho v strede či karte bez
 * týchto tagov spoj nevznikne — neaktivuje sa nič ani na susedovi.
 */
export function spojVznikne(
  a: { readonly tags: readonly Tag[]; readonly stred: boolean; readonly defId?: string; readonly umlcany?: boolean },
  b: { readonly tags: readonly Tag[]; readonly stred: boolean; readonly defId?: string; readonly umlcany?: boolean },
): boolean {
  // Kôň (Furt, v7): Nástroj vedľa neho s ním tvorí spoj ako s Občanom — nie vedľa Mäsiara (umlcany).
  const podporuje = (x: typeof a): boolean =>
    !x.stred && (x.tags.includes("Občan") || x.tags.includes("Starešina") || (x.defId === "kon" && x.umlcany !== true));
  if (a.tags.includes("Nástroj") && !a.stred && !podporuje(b)) return false;
  if (b.tags.includes("Nástroj") && !b.stred && !podporuje(a)) return false;
  return true;
}

/** Spoj, na ktorom sa stretli dve Posilnenia — Forsáž, ak ani jedno nezruší NA EX. */
interface SpojForsaze {
  readonly a: Elem;
  readonly b: Elem;
}

/** Odpor proti Posilneniu — Vzbura karty s Odporom, posilnená, ak NA EX Posilnenie nezruší. */
interface VzburaSPosilnenim {
  readonly odpor: Elem;
  readonly side: 0 | 1;
  readonly posil: Elem;
}

/**
 * Spoj medzi susedmi: pravá strana `a` proti ľavej strane `b`; `umlcane` = Zvieratá vedľa
 * Mäsiara. Spoje s dvoma Posilneniami pribudnú do `forsaze`, Odpor proti Posilneniu do
 * `vzburyPosilnene` (vyhodnotí ich applyForsaz).
 */
function resolveJunction(
  a: Elem,
  b: Elem,
  umlcane: ReadonlySet<number>,
  line: Pick<LineState, "nastroje">,
  forsaze: SpojForsaze[],
  vzburyPosilnene: VzburaSPosilnenim[],
): void {
  const x = { tags: a.tags, stred: a.isLokalita, defId: a.defId, umlcany: umlcane.has(a.uid) };
  if (!spojVznikne(x, { tags: b.tags, stred: b.isLokalita, defId: b.defId, umlcany: umlcane.has(b.uid) })) return;
  // Praudovravec (Dezinformátor, v7): Odpor na jeho spojoch neruší, ale posilní.
  const dezinformator = (!a.isLokalita && a.defId === "praudovravec") || (!b.isLokalita && b.defId === "praudovravec");
  for (let k = 0; k < 4; k++) {
    let actA = a.effRight[k];
    let actB = b.effLeft[k];
    if (actA == null || actB == null) continue;
    a.spojena[1]![k] = true;
    b.spojena[0]![k] = true;
    if (dezinformator) {
      if (actA === "Odpor") actA = "Posilnenie";
      if (actB === "Odpor") actB = "Posilnenie";
    }
    if (actA === "Pakt" && actB === "Pakt") {
      // Pakt s Paktom (plan.md 12.3 bod 1): pár je, kopírovať nemá čo — nerobí nič.
      a.stav[1]![k] = "aktivna";
      b.stav[0]![k] = "aktivna";
      continue;
    }
    // Pakt (v7): na spoji sa správa ako akcia, s ktorou je v páre — premení sa pred
    // násobkami (12.3 bod 2), takže pri Posilnení vzniknú dve Posilnenia — Forsáž (v10.3).
    // Odpor ho zruší ako každú akciu (bod 4).
    // Zrkadlo (Dedičstvo, Náradie 2026-10-30): tvoj Pakt kopíruje prepojenú akciu dvakrát.
    let zrkadloA = false;
    let zrkadloB = false;
    if (actA === "Pakt" && actB !== "Odpor") {
      actA = actB;
      (a.effRight as Slot[])[k] = actB;
      a.dovody[1]![k]!.push("Pakt");
      zrkadloA = maNastroj(line, a.owner, "zrkadlo") && !a.isLokalita;
    } else if (actB === "Pakt" && actA !== "Odpor") {
      actB = actA;
      (b.effLeft as Slot[])[k] = actA;
      b.dovody[0]![k]!.push("Pakt");
      zrkadloB = maNastroj(line, b.owner, "zrkadlo") && !b.isLokalita;
    }

    const odporA = actA === "Odpor";
    const odporB = actB === "Odpor";
    const posilA = actA === "Posilnenie";
    const posilB = actB === "Posilnenie";

    if (odporA && odporB) {
      // Vzbura — oba Odpory sa vyrušia (do súčtov nič nedajú) a obe karty sa obrátia (applyVzbura).
      a.stav[1]![k] = "aktivna";
      b.stav[0]![k] = "aktivna";
      markVzbura(a, 1);
      markVzbura(b, 0);
    } else if (odporA || odporB) {
      const [odporElem, odporSide, otherElem, otherSide, otherAct] = odporA
        ? ([a, 1, b, 0, actB] as const)
        : ([b, 0, a, 1, actA] as const);
      odporElem.stav[odporSide]![k] = "aktivna";
      // Telefón (Dedičstvo, v10): tvoje Pohoršenia nemožno zrušiť Odporom — ostávajú aktívne.
      if (otherAct === "Pohoršenie" && !otherElem.isLokalita && maNastroj(line, otherElem.owner, "telefon")) {
        otherElem.stav[otherSide]![k] = "aktivna";
        otherElem.nasobok[otherSide]![k] = 1;
        otherElem.dovody[otherSide]![k]!.push("karta:telefon");
      } else {
        otherElem.stav[otherSide]![k] = "zrusena";
        otherElem.zrusil[otherSide]![k] = "Odpor";
        otherElem.zrusilOdporom[otherSide]![k] = odporElem.isLokalita ? null : odporElem.owner;
      }
      // Posilnenie + Odpor (v11.1, Michal 2026-11-02): Vzbura IBA karty s Odporom, jej aktívne akcie posilnené.
      if (otherAct === "Posilnenie") {
        markVzbura(odporElem, odporSide);
        vzburyPosilnene.push({ odpor: odporElem, side: odporSide, posil: otherElem });
      }
    } else if (posilA && posilB) {
      // Posilnenie + Posilnenie = Forsáž (v10.3): akcie zdvojí až applyForsaz, keď vie,
      // či NA EX niektoré z Posilnení nezruší.
      a.stav[1]![k] = "aktivna";
      b.stav[0]![k] = "aktivna";
      if (!forsaze.some((f) => f.a === a && f.b === b)) forsaze.push({ a, b });
    } else if (posilA || posilB) {
      const [posilElem, posilSide, otherElem, otherSide] = posilA
        ? ([a, 1, b, 0] as const)
        : ([b, 0, a, 1] as const);
      posilElem.stav[posilSide]![k] = "aktivna";
      otherElem.stav[otherSide]![k] = "aktivna";
      otherElem.nasobok[otherSide]![k] = 2;
      otherElem.dovody[otherSide]![k]!.push("Posilnenie");
      posilElem.posilnene.push({ elem: otherElem, side: otherSide, k });
    } else {
      a.stav[1]![k] = "aktivna";
      a.nasobok[1]![k] = 1;
      b.stav[0]![k] = "aktivna";
      b.nasobok[0]![k] = 1;
    }
    if (zrkadloA && a.stav[1]![k] === "aktivna" && actA !== "Posilnenie") {
      a.nasobok[1]![k] = (a.nasobok[1]![k] as number) * 2;
      a.dovody[1]![k]!.push("karta:zrkadlo");
    }
    if (zrkadloB && b.stav[0]![k] === "aktivna" && actB !== "Posilnenie") {
      b.nasobok[0]![k] = (b.nasobok[0]![k] as number) * 2;
      b.dovody[0]![k]!.push("karta:zrkadlo");
    }
  }
}

/**
 * Výherné žreby (Dedičstvo, Náradie 2026-10-30): Hazardy majiteľa sú aktívne, keď nie
 * sú spojené, a neaktívne, keď sú spojené. Beží pred NA EX — to potom zdvojí spojené
 * (neaktívne) a zruší nespojené (aktívne), ako každú akciu (O1). Zrušené Odporom ostávajú.
 */
function vyherneZreby(elem: Elem, line: Pick<LineState, "nastroje">): void {
  if (elem.isLokalita || !maNastroj(line, elem.owner, "vyherne_zreby")) return;
  for (const side of [0, 1] as const) {
    const actions = side === 0 ? elem.effLeft : elem.effRight;
    for (let k = 0; k < 4; k++) {
      if (actions[k] !== "Dlh" || elem.stav[side]![k] === "zrusena") continue;
      if (elem.spojena[side]![k]) {
        elem.stav[side]![k] = "neaktivna";
        elem.nasobok[side]![k] = 0;
        elem.dovody[side]![k] = [];
      } else {
        elem.stav[side]![k] = "aktivna";
        elem.nasobok[side]![k] = 1;
        elem.dovody[side]![k]!.push("karta:vyherne_zreby");
      }
    }
  }
}

/**
 * Profesionálny tipér (Furt, Náradie 2026-10-30): posilnené akcie na jeho spojoch
 * sa rátajú inak — súperove ako posilnený Hazard, tvoje ako posilnená Robota.
 * Rozsah: jeho strany a strany susedov k nemu. Posilnená = ×2 z Posilnenia (po NA EX) alebo
 * z Forsáže (Michal 2026-11-02; Forsáž, ktorú NA EX zrušil, sa nepočíta).
 */
const jePosilnena = (dovody: readonly string[]): boolean => dovody.includes("Posilnenie") || dovody.includes("Forsáž");

function profesionalnyTiper(segments: readonly (readonly Elem[])[]): void {
  for (const seg of segments) {
    seg.forEach((t, i) => {
      if (t.isLokalita || t.defId !== "profesionalny_tiper") return;
      const oznac = (e: Elem, side: 0 | 1): void => {
        for (let k = 0; k < 4; k++) {
          if (e.stav[side]![k] === "aktivna" && jePosilnena(e.dovody[side]![k] ?? [])) e.tiper[side]![k] = t.owner;
        }
      };
      const lavy = seg[i - 1];
      const pravy = seg[i + 1];
      if (lavy !== undefined) {
        oznac(t, 0);
        oznac(lavy, 1);
      }
      if (pravy !== undefined) {
        oznac(t, 1);
        oznac(pravy, 0);
      }
    });
  }
}

/**
 * Zruší NA EX Posilnenie tejto karty? Veteránovi nie, Energeťák majiteľa ho chráni
 * (Dedičstvo, Náradie 2026-10-30). Lokalita NA EX nedostáva.
 */
function naexRusiPosilnenie(elem: Elem, line: Pick<LineState, "nastroje">): boolean {
  if (elem.naexBy === undefined || elem.defId === "veteran") return false;
  return elem.isLokalita || !maNastroj(line, elem.owner, "energetak");
}

/**
 * Forsáž (v10.3, Michal 2026-11-02): kde sa na spoji stretli dve Posilnenia, obe karty
 * majú všetky aktívne akcie posilnené (×2; s Posilnením suseda ×4). Lokalita len hranu
 * pri tom kraji, Nástroj ju nedostane. NA EX, ktorý zruší jedno z Posilnení, ju zruší
 * (ako ×2 partnerovi, §7) — preto sa ráta pred NA EX, ale len zo spojov, ktoré prežijú.
 * Beží po Vzbure a Výherných žreboch, aby zdvojila aj akcie, ktoré aktivovali.
 *
 * Rovnako Vzbura z Odporu proti Posilneniu (v11.1, Michal 2026-11-02): karta s Odporom má
 * po obrátení všetky aktívne akcie posilnené (×2, s Forsážou ×4); NA EX, ktorý Posilnenie
 * partnera zruší, ruší aj toto zdvojenie (§7), obrátenie ostáva.
 */
function applyForsaz(
  forsaze: readonly SpojForsaze[],
  vzburyPosilnene: readonly VzburaSPosilnenim[],
  elems: readonly Elem[],
  line: Pick<LineState, "nastroje">,
): void {
  for (const { a, b } of forsaze) {
    if (naexRusiPosilnenie(a, line) || naexRusiPosilnenie(b, line)) continue;
    for (const [elem, side] of [[a, 1], [b, 0]] as const) {
      if (jeNastroj(elem)) continue;
      if (elem.isLokalita) elem.forsaz[side] = true;
      else elem.forsaz.fill(true);
    }
  }
  for (const { odpor, side, posil } of vzburyPosilnene) {
    if (naexRusiPosilnenie(posil, line) || jeNastroj(odpor)) continue;
    if (odpor.isLokalita) odpor.vzburaPosilnena[side] = true;
    else odpor.vzburaPosilnena.fill(true);
  }
  for (const elem of elems) {
    for (const side of [0, 1] as const) {
      for (const [zapnute, dovod] of [
        [elem.forsaz[side], "Forsáž"],
        [elem.vzburaPosilnena[side], "Posilnenie"],
      ] as const) {
        if (!zapnute) continue;
        for (let k = 0; k < 4; k++) {
          const nasobok = elem.nasobok[side]![k] as number;
          if (elem.stav[side]![k] !== "aktivna" || nasobok === 0) continue;
          elem.nasobok[side]![k] = nasobok * 2;
          elem.dovody[side]![k]!.push(dovod);
        }
      }
    }
  }
}

/**
 * Vzbura obráti aktivitu karty (v11.1, Michal 2026-11-02: „Majú sa aktivovať akcie naopak,
 * nie aktivovať všetky.“): nespojené akcie sú aktívne ×1, spojené neaktívne — aj tie, ktoré
 * zdvojilo Posilnenie suseda. Zrušené Odporom ostávajú zrušené. Modifikátory karty na spojoch
 * pôsobia ďalej (Odpor ruší, Posilnenie zdvojí suseda, Forsáž) — inak by Vzbura menila aj
 * susedov a spoj Vzbury by sám seba vyrušil. Odpory spoja Vzbury ostávajú aktívne ako doteraz
 * (do súčtov nič nedajú, pri lokalite sa rátajú do Pitiek a NA EX ich zruší).
 */
function applyVzbura(elem: Elem): void {
  for (const side of [0, 1] as const) {
    if (!elem.vzbura[side]) continue;
    const actions = side === 0 ? elem.effLeft : elem.effRight;
    for (let k = 0; k < 4; k++) {
      const action = actions[k];
      if (action == null) continue;
      if (!elem.spojena[side]![k]) {
        if (elem.stav[side]![k] !== "neaktivna") continue;
        elem.stav[side]![k] = "aktivna";
        elem.nasobok[side]![k] = 1;
        elem.dovody[side]![k]!.push("Vzbura");
      } else if (elem.stav[side]![k] === "aktivna" && !MODIFIERS.includes(action)) {
        elem.stav[side]![k] = "neaktivna";
        elem.nasobok[side]![k] = 0;
        elem.dovody[side]![k] = [];
      }
    }
  }
}

/**
 * NA EX: aktívne akcie karty zruší, neaktívne zdvojí. Šofér (Furt, roadmapa
 * #71): karte vedľa seba neaktívne nezdvojí — aktívne zruší ako vždy.
 * Veterán (Furt, pravidlá v4, Michal 2026-10-23): naopak — jeho aktívne
 * akcie NA EX zdvojí a nezruší, neaktívne ostanú neaktívne.
 */
/**
 * NA EX zruší Posilnenie karty — a s ním aj ×2, ktoré dalo partnerovi na spoji
 * (Michal 2026-10-24); partnerova akcia ostáva aktívna ×1. Beží pred applyNaex
 * všetkých kariet, aby NA EX na partnerovi (zrušenie, Veterán ×2) vychádzalo
 * už z ×1. Veteránovi NA EX Posilnenie nezruší, takže zdvojenie ostáva.
 */
function zrusPosilnenie(elem: Elem, line: Pick<LineState, "nastroje">): void {
  if (!naexRusiPosilnenie(elem, line)) return;
  for (const { elem: partner, side, k } of elem.posilnene) {
    const dovody = partner.dovody[side]![k]!;
    if (partner.stav[side]![k] !== "aktivna" || !dovody.includes("Posilnenie")) continue;
    // Polovica, nie ×1: Forsáž partnera (×4) ostáva ×2.
    partner.nasobok[side]![k] = (partner.nasobok[side]![k] as number) / 2;
    dovody.splice(dovody.indexOf("Posilnenie"), 1);
  }
}

function applyNaex(elem: Elem, line: Pick<LineState, "nastroje">): void {
  if (elem.naexBy === undefined) return;
  // Zapaľovač, Energeťák a Telefón (Dedičstvo, Náradie 2026-10-30, v10): tvoje aktívne Cigarety,
  // Posilnenie, resp. Pohoršenia NA EX nezruší (a nezdvojí — ostávajú, ako sú).
  const imunne: Action[] = [];
  if (!elem.isLokalita && maNastroj(line, elem.owner, "zapalovac")) imunne.push("Cigareta");
  if (!elem.isLokalita && maNastroj(line, elem.owner, "energetak")) imunne.push("Posilnenie");
  // Telefón (Dedičstvo, v10): tvoje Pohoršenia nemožno zrušiť NA EX.
  if (!elem.isLokalita && maNastroj(line, elem.owner, "telefon")) imunne.push("Pohoršenie");
  if (elem.defId === "veteran") {
    zdvojAktivne(elem, "NA EX", "NA EX");
    return;
  }
  for (const side of [0, 1] as const) {
    const actions = side === 0 ? elem.effLeft : elem.effRight;
    for (let k = 0; k < 4; k++) {
      if (actions[k] == null) continue;
      const stav = elem.stav[side]![k];
      if (stav === "aktivna" && imunne.includes(actions[k] as Action)) continue;
      if (stav === "aktivna") {
        elem.stav[side]![k] = "zrusena";
        elem.nasobok[side]![k] = 0;
        elem.zrusil[side]![k] = "NA EX";
      } else if (stav === "neaktivna" && actions[k] !== "Pakt") {
        // Neaktívny Pakt nemá čo zdvojiť (12.3 bod 6).
        elem.stav[side]![k] = "aktivna";
        elem.nasobok[side]![k] = 2;
        elem.dovody[side]![k]!.push("NA EX");
      }
    }
  }
}

/** Aktívne akcie karty sa rátajú dvakrát (Liberál, Zámočník pri Nástroji, Silná žena, NA EX na Veterána). */
function zdvojAktivne(elem: Elem, zdroj: string, dovod = `karta:${zdroj}`): void {
  for (const side of [0, 1] as const) {
    for (let k = 0; k < 4; k++) {
      if (elem.stav[side]![k] !== "aktivna") continue;
      elem.nasobok[side]![k] = (elem.nasobok[side]![k] as number) * 2;
      elem.dovody[side]![k]!.push(dovod);
    }
  }
}

/**
 * Efekty kariet závislé od polohy v línii (Zámočník, Silná žena, Pes). Pes vedľa
 * Mäsiara (umlcane) nezdvojuje — efekty Zvierat v okolí Mäsiara neplatia.
 */
function kartoveEfekty(segments: readonly (readonly Elem[])[], umlcane: ReadonlySet<number>, rovnovaha: readonly [boolean, boolean]): void {
  const susedia = new Map<Elem, [Elem | null, Elem | null]>();
  for (const seg of segments) {
    seg.forEach((e, i) => susedia.set(e, [seg[i - 1] ?? null, seg[i + 1] ?? null]));
  }
  const karty = [...susedia.keys()].filter((e) => !e.isLokalita);
  const okolie = (e: Elem): Elem[] => (susedia.get(e) ?? [null, null]).filter((x): x is Elem => x !== null);
  for (const e of karty) {
    if (e.defId === "zamocnik") {
      for (const s of okolie(e)) if (s.tags.includes("Nástroj")) zdvojAktivne(s, e.defId);
    } else if (e.defId === "silna_nezavisla_zena") {
      // Michal 2026-10-18: podporuje okolie — aktívne akcie susedných kariet
      // toho istého majiteľa sa rátajú dvakrát (lokalitu a cudzie karty nie).
      for (const s of okolie(e)) if (!s.isLokalita && s.owner === e.owner) zdvojAktivne(s, e.defId);
    } else if (e.defId === "pes" && !umlcane.has(e.uid)) {
      // Pes (Furt, v7): aktívne akcie na spoji so súperovou kartou ×2 — strana k tomu susedovi.
      const [lavy, pravy] = susedia.get(e) ?? [null, null];
      for (const [side, sused] of [[0, lavy], [1, pravy]] as const) {
        if (sused !== null && !sused.isLokalita && sused.owner !== e.owner) zdvojStranu(e, side, e.defId);
      }
    } else if (e.defId === "veducko") {
      // Vedúcko (Furt, Michal 2026-11-02): Roboty susedných kariet (oboch hráčov, lokalita nie —
      // ako Silná nezávislá žena) sa rátajú ako Pecky; Dlh nepália, dávajú tuhé.
      for (const s of okolie(e)) if (!s.isLokalita) s.robotaAkoPecka = true;
    } else if (e.defId === "opatrovatelka") {
      // Opatrovateľka (Furt, v11.5): aktívne akcie tvojich Pamätníkov v jej okolí sú posilnené.
      for (const s of okolie(e)) if (!s.isLokalita && s.owner === e.owner && s.tags.includes("Pamätník")) zdvojAktivne(s, e.defId);
    } else if (e.defId === "anonymny_alkoholik") {
      // Anonymný alkoholik (Furt, v11.5): Poškodenie pečene tvojich kariet v jeho okolí sa ráta ako Viera.
      for (const s of okolie(e)) if (!s.isLokalita && s.owner === e.owner) s.pecenAkoViera = true;
    } else if (e.defId === "liberal" && rovnovaha[e.owner]) {
      // Liberál (Furt, v10.3): s rovnako ženami a chlapmi v partii majiteľa sú jeho aktívne akcie posilnené.
      zdvojAktivne(e, e.defId);
    }
  }
}

/** Aktívne akcie jednej strany karty sa rátajú dvakrát (Pes). */
function zdvojStranu(elem: Elem, side: 0 | 1, zdroj: string): void {
  for (let k = 0; k < 4; k++) {
    if (elem.stav[side]![k] !== "aktivna") continue;
    elem.nasobok[side]![k] = (elem.nasobok[side]![k] as number) * 2;
    elem.dovody[side]![k]!.push(`karta:${zdroj}`);
  }
}

/** Akcia, ktorou sa slot karty ráta (v7): premena Šarlatána a Miňištranta, potom Sypač (Rany ako Pecky). */
function akciaPoPremene(elem: Elem, action: Action): Action {
  let a: Action = elem.vieraAkoVizia && action === "Viera" ? "Vízia" : action;
  if (elem.premena === "sarlatan") a = a === "Dlh" ? "Viera" : a === "Povera" ? "Rana" : a;
  else if (elem.premena === "ministrant" && a === "Viera") a = "Pecka";
  return elem.ranyAkoPecky && a === "Rana" ? "Pecka" : a;
}

/**
 * Liberál (Furt, v10.3): má hráč v partii (karty natočené k nemu, v ktoromkoľvek kraji)
 * rovnako žien a chlapov? Karta s oboma tagmi sa ráta za oboch, skrytá Záverečná nie.
 */
export function rovnovahaPohlavi(data: GameData, strany: LineState["strany"], p: PlayerId): boolean {
  let zeny = 0;
  let chlapi = 0;
  for (const pl of [...strany[0], ...strany[1]]) {
    if (pl.playedBy !== p || pl.zaverecna === true) continue;
    const tags = defOf(data, pl.card).tags;
    if (tags.includes("Žena")) zeny++;
    if (tags.includes("Chlap")) chlapi++;
  }
  return zeny === chlapi;
}

/** Akcie Výtržníka po zrážke: Rany (Sypačove Pecky z v10.3 zanikli vo v11.5). */
export function akciaVytrznika(): Action {
  return "Rana";
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
      ...(elem.vieraAkoVizia && action === "Viera" ? { ako: "Vízia" as const } : {}),
    };
  };
  return {
    uid: elem.uid,
    vzbura: elem.vzbura[0] || elem.vzbura[1],
    forsaz: elem.forsaz[0] || elem.forsaz[1],
    left: [0, 1, 2, 3].map((k) => printedSlot(0, k)),
    right: [0, 1, 2, 3].map((k) => printedSlot(1, k)),
  };
}

/**
 * Mäsiar (Furt, Michal 2026-10-28): efekty Zvierat v jeho okolí neplatia — uid Zvierat
 * (ktoréhokoľvek hráča), ktoré v línii susedia s odkrytým Mäsiarom. Akcie Zvierat
 * sa rátajú normálne (do 2026-10-28 Mäsiar rušil akcie). Jeden výpočet pre líniu
 * (Pes, Kôň) aj motor (Čierna mačka, Krokodíl, Kohút, Recidivista, Kapybara).
 */
export function zvieratAUmlcane(data: GameData, line: Pick<LineState, "lokalita" | "strany">): ReadonlySet<number> {
  const out = new Set<number>();
  const l = line as LineState;
  for (const pl of [...line.strany[0], ...line.strany[1]]) {
    if (!defOf(data, pl.card).tags.includes("Zviera")) continue;
    if (okolieVLinii(l, pl.card.uid).some((s) => s !== null && s.card.defId === "masiar" && s.zaverecna !== true)) out.add(pl.card.uid);
  }
  return out;
}

export function evaluateLine(data: GameData, line: LineState): LineEval {
  const elems: Elem[] = [];
  const segments: Elem[][] = [];
  const umlcane = zvieratAUmlcane(data, line);

  // Výtržník NA EX nezdvojuje — jeho akcie sa prepíšu na Rany nižšie.
  const vytrznici = new Set<number>();
  for (const strana of line.strany) for (const p of strana) if (p.vytrznik === true) vytrznici.add(p.card.uid);
  const partia0 = line.strany[0].map((p) =>
    makeElem(data, p.card, p.playedBy, p.playedBy === 1, false, p.vytrznik === true ? undefined : p.naexBy, 0, p),
  );
  const partia1 = line.strany[1].map((p) =>
    makeElem(data, p.card, p.playedBy, p.playedBy === 1, false, p.vytrznik === true ? undefined : p.naexBy, 1, p),
  );
  // Posilnenie a Odpor Výtržníka sú už len Rany (v6.1, Michal 2026-10-27): suseda
  // nezdvojujú ani nerušia, spoj s nimi je obyčajný pár. Ostatné akcie sa spárujú
  // ako vytlačené — zmena na Rany príde až po spojoch (nižšie).
  for (const elem of [...partia0, ...partia1]) {
    if (!vytrznici.has(elem.uid)) continue;
    const utok = akciaVytrznika();
    const bezModifikatora = (x: Slot): Slot => (x === "Posilnenie" || x === "Odpor" ? utok : x);
    const m = elem as { effLeft: readonly Slot[]; effRight: readonly Slot[] };
    m.effLeft = elem.effLeft.map(bezModifikatora);
    m.effRight = elem.effRight.map(bezModifikatora);
  }

  // Prevaha (Michal 2026-10-20, rozbor strategia-strany-20261020): akcie hrany
  // lokality dostane, kto má na tej strane viac svojich kariet (Nástroje sa
  // nerátajú); pri rovnosti majiteľ karty pri lokalite (pravidlá v3).
  const susedLokality: [PlayerId | null, PlayerId | null] = [prevaha(partia0), prevaha(partia1)];
  let stred: Elem | null = null;
  if (line.lokalita !== null) {
    // owner lokality je len formálny — súčty jej strán idú majiteľovi suseda.
    const lok = makeElem(data, line.lokalita, 0, line.lokalitaOtocena, true, undefined, null);
    stred = lok;
    segments.push([...[...partia0].reverse(), lok, ...partia1]);
    elems.push(...partia0, lok, ...partia1);
  } else {
    // Bez karty v strede (len testy a ukážky): strany sú dva samostatné úseky.
    segments.push([...partia0].reverse(), [...partia1]);
    elems.push(...partia0, ...partia1);
  }

  const forsaze: SpojForsaze[] = [];
  const vzburyPosilnene: VzburaSPosilnenim[] = [];
  for (const segment of segments) {
    for (let i = 0; i + 1 < segment.length; i++) {
      resolveJunction(segment[i] as Elem, segment[i + 1] as Elem, umlcane, line, forsaze, vzburyPosilnene);
    }
  }
  for (const elem of elems) applyVzbura(elem);
  for (const elem of elems) vyherneZreby(elem, line);
  applyForsaz(forsaze, vzburyPosilnene, elems, line);
  for (const elem of elems) zrusPosilnenie(elem, line);
  for (const elem of elems) applyNaex(elem, line);
  for (const elem of elems) puskaChrani(elem, line);
  profesionalnyTiper(segments);
  kartoveEfekty(segments, umlcane, [rovnovahaPohlavi(data, line.strany, 0), rovnovahaPohlavi(data, line.strany, 1)]);
  // Výtržník (zrážka NA EX naraz, v5): každá akcia karty je aktívna Rana pre
  // majiteľa. Spoje susedov sa rátajú s vytlačenými akciami
  // (okrem Posilnenia a Odporu, vyššie) — Výtržník ich nemení.
  for (const elem of elems) {
    if (!vytrznici.has(elem.uid)) continue;
    const utok = akciaVytrznika();
    const rana = (x: Slot): Slot => (x === null ? null : utok);
    const m = elem as { effLeft: readonly Slot[]; effRight: readonly Slot[] };
    m.effLeft = elem.effLeft.map(rana);
    m.effRight = elem.effRight.map(rana);
    for (const side of [0, 1] as const) {
      const akcie = side === 0 ? elem.effLeft : elem.effRight;
      for (let k = 0; k < akcie.length; k++) {
        if (akcie[k] === null) continue;
        elem.stav[side]![k] = "aktivna";
        elem.nasobok[side]![k] = 1;
        // Dôvody zdvojenia z vytlačených akcií už neplatia — rozpis by ukázal ×2 pri Rane za 1.
        elem.dovody[side]![k] = [];
      }
    }
  }

  // Nástroj v línii (Michal 2026-10-19): akcie na spoji dostane majiteľ karty,
  // s ktorou Nástroj spoj vytvoril — nie majiteľ Nástroja. Efekt Nástroja platí
  // len v Dedičstve. Ľavá efektívna strana spája s ľavým susedom v úseku.
  const susedNastroja = new Map<Elem, [PlayerId | null, PlayerId | null]>();
  for (const seg of segments) {
    seg.forEach((e, i) => {
      if (!e.isLokalita && e.tags.includes("Nástroj")) susedNastroja.set(e, [seg[i - 1]?.owner ?? null, seg[i + 1]?.owner ?? null]);
    });
  }

  const sums: [Partial<Record<Action, number>>, Partial<Record<Action, number>>] = [{}, {}];
  const zdroje: [Partial<Record<Action, ZdrojAkcie[]>>, Partial<Record<Action, ZdrojAkcie[]>>] = [{}, {}];
  const zrusene: [Partial<Record<Action, ZdrojAkcie[]>>, Partial<Record<Action, ZdrojAkcie[]>>] = [{}, {}];
  const zruseneOdporom: [number, number] = [0, 0];
  const pridajZdroj = (p: PlayerId, a: Action, z: ZdrojAkcie): void => {
    (zdroje[p][a] ??= []).push(z);
  };
  for (const elem of elems) {
    for (const side of [0, 1] as const) {
      const actions = side === 0 ? elem.effLeft : elem.effRight;
      for (let k = 0; k < 4; k++) {
        const action = actions[k];
        if (action == null || MODIFIERS.includes(action)) continue;
        const stav = elem.stav[side]![k];
        const nasobok = elem.nasobok[side]![k] as number;
        const zrusil = stav === "zrusena" ? elem.zrusil[side]![k] : null;
        if (zrusil == null && (stav !== "aktivna" || nasobok === 0)) continue;
        // Akcia lokality patrí majiteľovi karty, s ktorou tvorí spoj (bez suseda
        // nie je aktívna); akcia karty jej majiteľovi, nech leží kdekoľvek.
        // Kočovník (Furt, Michal 2026-10-24): všetky jeho akcie dostane hráč
        // s prevahou v jeho kraji — súper, ktorý tam prevládne, berie aj škodlivé.
        // Zrušená akcia sa zapíše tomu, komu by inak patrila.
        const kocovnik = elem.defId === "kocovnik" && elem.strana !== null ? (susedLokality[elem.strana] ?? elem.owner) : null;
        const nastroj = susedNastroja.get(elem)?.[side] ?? null;
        const target: PlayerId = elem.isLokalita ? (susedLokality[side] ?? side) : (kocovnik ?? nastroj ?? elem.owner);
        const tiper = elem.tiper[side]![k] ?? null;
        // Puška: zachránená Petelica udeľuje 2 — v súčtoch sa ráta ako Pecka (2 tuhé).
        const vedRobota = tiper === null && action === "Robota" && elem.robotaAkoPecka;
        const aaPecen = tiper === null && action === "PoškodeniePečene" && elem.pecenAkoViera;
        const ako: Action = tiper !== null ? (target === tiper ? "Robota" : "Dlh") : elem.puska[side]![k] || vedRobota ? "Pecka" : aaPecen ? "Viera" : akciaPoPremene(elem, action);
        if (zrusil != null) {
          (zrusene[target][ako] ??= []).push({ defId: elem.defId, uid: elem.uid, hodnota: 0, vStrede: elem.isLokalita, dovody: [zrusil] });
          // Hrable (Dedičstvo, Náradie 2026-10-30): akcia zrušená tvojím Odporom sa ráta ako tvoja a je posilnená.
          const odporom = elem.zrusilOdporom[side]![k] ?? null;
          if (zrusil === "Odpor" && odporom !== null && odporom !== target) zruseneOdporom[odporom] += 1;
          if (zrusil === "Odpor" && odporom !== null && maNastroj(line, odporom, "hrable")) {
            sums[odporom][ako] = (sums[odporom][ako] ?? 0) + 2;
            pridajZdroj(odporom, ako, { defId: elem.defId, uid: elem.uid, hodnota: 2, vStrede: elem.isLokalita, dovody: ["Odpor", "karta:hrable"] });
          }
          continue;
        }
        // Poľovnícka chata (Furt, v7): aktívne Rany, Pecky a Petelice z jej hrán sa rátajú dvakrát.
        const chata = elem.isLokalita && elem.defId === "polovnicka_chata" && TUHE[ako] !== undefined;
        // Väzeň Starosta (v11.2, Michal 2026-11-02): od použitia do konca kola sú posilnené všetky
        // aktívne akcie hrán lokality, aj Pitky (Hazard, pečeň, Cigareta…) — ×2 sa násobí s ostatnými.
        const starosta = elem.isLokalita && line.hranyPosilnene === true;
        const hodnota = nasobok * (chata ? 2 : 1) * (starosta ? 2 : 1);
        sums[target][ako] = (sums[target][ako] ?? 0) + hodnota;
        const dovody = [...(elem.dovody[side]![k] ?? [])];
        if (chata) dovody.push("karta:polovnicka_chata");
        if (starosta) dovody.push("karta:starosta");
        if (tiper !== null) dovody.push("karta:profesionalny_tiper");
        else if (vedRobota) dovody.push("karta:veducko");
        else if (aaPecen) dovody.push("karta:anonymny_alkoholik");
        else if (ako !== action) dovody.push(`karta:${elem.premena ?? (elem.ranyAkoPecky ? "kulturista" : "sarlatan")}`);
        pridajZdroj(target, ako, { defId: elem.defId, uid: elem.uid, hodnota, vStrede: elem.isLokalita, dovody });
      }
    }
  }

  const cards = new Map<number, CardLineEval>();
  for (const elem of elems) cards.set(elem.uid, elemEval(elem));

  // Efektívna ľavá strana karty v strede susedí so stranou hráča 0, pravá s hráčom 1.
  const aktivne = (side: 0 | 1): number => (stred === null ? 0 : stred.stav[side]!.filter((x) => x === "aktivna").length);

  presbiter([partia0, partia1], susedLokality, elems, sums, zdroje);

  return { sums, cards, aktivneStredu: [aktivne(0), aktivne(1)], zdroje, zrusene, zruseneOdporom };
}

/** Príspevok karty v línii k bitke — štatistiky partií a simulácia sily kariet v tvorcovi. */
export interface KartaVBitke {
  readonly uid: number;
  readonly defId: string;
  readonly majitel: PlayerId;
  /** Akcie vytlačené na karte (bez modifikátorov Posilnenie/Odpor). */
  readonly akcii: number;
  /** Aktívne akcie karty vrátane násobkov (NA EX, Posilnenie). */
  readonly aktivne: number;
  /** Tuhé poškodenie z jej aktívnych akcií: Rana 1, Pecka 2, Petelica 3. */
  readonly tuhe: number;
  /** Aktívne kliatbové akcie (Dlh, Poškodenie pečene) — škodia majiteľovi. */
  readonly zle: number;
}

const ZLE: readonly Action[] = ["Dlh", "PoškodeniePečene"];

/** Rozpis vyhodnotenej línie po kartách (lokalita sa nepočíta — nie je ničia). */
export function prispevkyKariet(line: LineState, ev: LineEval): KartaVBitke[] {
  const out: KartaVBitke[] = [];
  for (const placed of [...line.strany[0], ...line.strany[1]]) {
    const e = ev.cards.get(placed.card.uid);
    let akcii = 0;
    let aktivne = 0;
    let tuhe = 0;
    let zle = 0;
    for (const slot of [...(e?.left ?? []), ...(e?.right ?? [])]) {
      if (slot === null || MODIFIERS.includes(slot.action)) continue;
      akcii++;
      if (slot.stav !== "aktivna" || slot.nasobok === 0) continue;
      const ako = slot.ako ?? slot.action;
      aktivne += slot.nasobok;
      tuhe += (TUHE[ako] ?? 0) * slot.nasobok;
      if (ZLE.includes(ako)) zle += slot.nasobok;
    }
    out.push({ uid: placed.card.uid, defId: placed.card.defId, majitel: placed.playedBy, akcii, aktivne, tuhe, zle });
  }
  return out;
}

/**
 * Susedia karty v línii — „okolie“ z textov kariet (Veterinár, Krokodíl):
 * karty na oboch stranách bez ohľadu na majiteľa, aj lokalita v strede (null
 * v zozname = lokalita).
 */
export function okolieVLinii(line: LineState, uid: number): (PlacedCard | null)[] {
  const lava = [...line.strany[0]].reverse();
  const stred: (PlacedCard | null)[] = line.lokalita !== null ? [null] : [];
  const useky: (PlacedCard | null)[][] =
    line.lokalita !== null ? [[...lava, ...stred, ...line.strany[1]]] : [lava, [...line.strany[1]]];
  for (const usek of useky) {
    const i = usek.findIndex((x) => x !== null && x.card.uid === uid);
    if (i === -1) continue;
    return [usek[i - 1], usek[i + 1]].filter((x): x is PlacedCard | null => x !== undefined);
  }
  return [];
}

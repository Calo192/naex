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
//    všetky aktívne akcie posilnené; lokalita len hranu pri tom kraji.
//  - Vzbura obráti aktivitu karty (v11.1, Michal 2026-11-02): nespojené akcie sú aktívne,
//    spojené neaktívne; na lokalite len strana patriaca danej partii.
//  - Preškolenie (Michal 2026-11-08, preskolenie.ts): akcie karty premení ešte pred spojmi prvá
//    premena v poradí podložený Nástroj → Podpora a Konflikt Školiteľa → Furt Školiteľa (premenyVLinii).
//  - Podložený Nástroj (Náradie, Michal 2026-11-08, naradie.ts): akciová hrana premení akcie
//    hostiteľa ešte pred spojmi, kartová mu dá Vzburu, Forsáž, NA EX či Výtržníka tou istou
//    cestou, akou ich karta dostane inak — v poradí spoje → Vzbura → Výherné žreby → Forsáž →
//    NA EX → Výtržník.
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
import type { EfektNavyse, NavyseStav } from "./navyse.ts";
import { efektyNavyse, jeSlovami, popisPodmienky, stavNavyse } from "./navyse.ts";
import type { PodlozenyNastroj } from "./naradie.ts";
import { preskolStranu, preskoleniaHostitela, ucinkyNastrojov } from "./naradie.ts";
import type { SpustacPreskolenia } from "./preskolenie.ts";
import { preskoleniaKarty } from "./preskolenie.ts";

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
   * Preškolenia od Školiteľov z Podpory a Konfliktu (Michal 2026-11-08) v poradí spustenia —
   * platia do konca kola, aj keď sa karty rozídu (preskolenie.ts).
   */
  readonly preskolenia?: readonly PreskolenieOdSkolitela[];
  /**
   * Akcie navyše (frakcie, Michal 2026-11-08): koľkokrát sa v tomto kole spustil efekt
   * navyše [i] karty (navyse.ts efektyNavyse) — Podpora a Konflikt pri každom stretnutí.
   */
  readonly navyse?: readonly number[];
  /** Uid kariet, s ktorými sa efekt navyše [i] spustil (Podpora, Konflikt) — šípky pečate k susedom. */
  readonly navyseOd?: readonly (readonly number[])[];
  /** Hrobár (Konflikt, v7): za túto kartu sa na jej strane už nič nepriloží. */
  readonly posledna?: true;
  /** Po bitke ide karta z hry (Vdova, Hrobár — Konflikt v7). */
  readonly poBitkeZHry?: true;
  /** Po bitke ide karta do odhadzovacieho balíčka tohto hráča a je jeho (Snúbenica, Konflikt v7). */
  readonly poBitkeK?: PlayerId;
  /** 2 na 2: člen tímu, ktorý kartu vyložil — karta „do ruky“ ide jemu (Michal 2026-11-02, Q4). */
  readonly miesto?: Miesto;
  /**
   * Nástroje podložené pod kartu (Náradie, Michal 2026-11-08) v poradí podloženia — verejné;
   * viac ako jeden len pod Zámočníkom. Po bitke a keď karta odíde z línie idú majiteľom Nástrojov.
   */
  readonly podlozene?: readonly PodlozenyNastroj[];
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
  /**
   * Stav kola pre akcie navyše s podmienkou slovami (skryté akcie, Michal 2026-11-08: Pijan,
   * Svokra, Vymáhač, Šofér, Traktorista, Pasca, Výherný automat). Chýba = také podmienky
   * nesplní nič (testy, ukážky).
   */
  readonly kolo?: StavKolaLinie;
}

/** Verejný stav kola, z ktorého jadro vyhodnotí podmienky slovami (engine.ts lineState). */
export interface StavKolaLinie {
  /** Hráč dal v tomto kole NA EX (Šofér). */
  readonly naexVKole: readonly [boolean, boolean];
  /** Priznané Dlhy (Vymáhač). */
  readonly dlhy: readonly [number, number];
  /** Koľkokrát súper v tomto kole priložil kartu ku karte hráča (Pasca). */
  readonly prilozeniaKu: readonly [number, number];
  /** Dedičstvo hráčov — Nástroje s efektom „Dedičstvo: … {Akcia}“. */
  readonly dedicstvo: readonly [readonly CardInstance[], readonly CardInstance[]];
  /** Prebieha posledná Pitka kola (Výherný automat). */
  readonly poslednaPitka: boolean;
}

/** Preškolenie od Školiteľa zapísané na kartu, s ktorou sa stretol Podporou či Konfliktom (engine). */
export interface PreskolenieOdSkolitela {
  readonly z: Action;
  readonly na: Action;
  /** uid Školiteľa. */
  readonly od: number;
  readonly spustac: "Podpora" | "Konflikt";
}

/** Odkiaľ je preškolenie akcie karty — v poradí prednosti. */
export type ZdrojPreskolenia = "Nástroj" | SpustacPreskolenia;

/** Preškolenie, ktoré platí na karte v línii (dotknutá karta — klient ju označí). */
export interface PremenaNaKarte {
  readonly z: Action;
  readonly na: Action;
  /** uid podloženého Nástroja alebo Školiteľa. */
  readonly od: number;
  readonly zdroj: ZdrojPreskolenia;
  /** Koľko akcií karty premenilo — vytlačené na oboch hranách aj akcie navyše; 0 = karta akciu z nemá. */
  readonly akcii: number;
}

/** Efekt Preškolenie Školiteľa v línii — pre pečať (pilulku) na jeho karte. */
export interface StavSkolitela {
  readonly spustac: SpustacPreskolenia;
  readonly z: Action;
  readonly na: Action;
  /** Karty, ktoré preškoľuje (šípky k nim) — Furt: susedia, Podpora a Konflikt: karty, s ktorými sa stretol. */
  readonly ku: readonly number[];
  /** Koľko akcií na nich premenil; 0 = sivá pilulka (akciu nemajú, alebo ju skôr preškolil Nástroj či iný Školiteľ). */
  readonly akcii: number;
}

/** Preškolenie akcie, ako ho čítajú hrany (naradie.ts preskolStranu): na čo a kto. */
export interface PremenaAkcie {
  readonly na: Action;
  /** uid Nástroja či Školiteľa. */
  readonly uid: number;
  readonly zdroj: ZdrojPreskolenia;
}

export type SlotStav = "neaktivna" | "aktivna" | "zrusena";

export interface SlotEval {
  readonly action: Action;
  readonly stav: SlotStav;
  /** Koľkokrát sa akcia počíta (2 = Posilnenie alebo NA EX; 0 = zrušená/neaktívna). */
  readonly nasobok: number;
  /** Akcia sa ráta ako iná (stará sada: premena Šarlatána, Viera v jeho okolí ako Vízia). */
  readonly ako?: Action;
  /**
   * Karta kreslí na slote `ako` namiesto vytlačenej akcie. Od Školiteľov (2026-11-08) ho nič
   * nenastavuje — preškolenie je v `action` a `povodna`.
   */
  readonly naKarte?: true;
  /** Vytlačená akcia, ktorú preškolil podložený Nástroj či Školiteľ na `action` (klient ju kreslí prečiarknutú v rožku). */
  readonly povodna?: Action;
  /** uid Nástroja či Školiteľa, ktorý slot preškolil (pri `povodna`). */
  readonly preskolil?: number;
}

/** Vyhodnotenie jednej karty — sloty vo VYTLAČENOM ráme karty. */
export interface CardLineEval {
  readonly uid: number;
  readonly vzbura: boolean;
  /** Forsáž (v10.3): Posilnenie proti Posilneniu na niektorom spoji karty, NA EX ju nezrušil; aj z Energeťáka pod kartou. */
  readonly forsaz: boolean;
  readonly left: readonly (SlotEval | null)[];
  readonly right: readonly (SlotEval | null)[];
  /** Efekty s akciami navyše a koľkokrát platia (navyse.ts); chýba = karta ich nemá. */
  readonly navyse?: readonly NavyseStav[];
  /** Preškolenia, ktoré na karte platia, v poradí prednosti; chýba = žiadne. */
  readonly preskolena?: readonly PremenaNaKarte[];
  /** Školiteľ: jeho efekty Preškolenie a koho preškoľujú; chýba = karta nie je Školiteľ. */
  readonly skolitel?: readonly StavSkolitela[];
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
  /** Akcie navyše Nástrojov v Dedičstve (Pasca, Výherný automat) podľa uid karty. */
  readonly navyseDedicstva?: ReadonlyMap<number, readonly NavyseStav[]>;
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
  /**
   * Karta nemá efekt s akciami navyše — Kočovník, Opatrovateľka a Praudovravec ho v sade
   * frakcií (2026-11-08) dostali namiesto Furtu; ich starý efekt platí len pre staré sady.
   */
  readonly staryEfekt: boolean;
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
  /**
   * Forsáž z podloženého Energeťáka — neviaže sa na Posilnenie, NA EX ju nezruší; so spojovou
   * Forsážou či Vzburou z Odporu proti Posilneniu sa násobí (naradie-hrany-zoznam.html v5).
   */
  forsazNastroj: boolean;
  readonly naexBy: PlayerId | undefined;
  /** NA EX z podloženého Vínka — ako NA EX, len bez poldeca (nie je nerest, nepije sa). */
  readonly naexNastroj: boolean;
  /** povodne[side][k]: vytlačená akcia, ktorú preškolil Nástroj či Školiteľ (efektívny rám). */
  readonly povodne: (Action | null)[][];
  /** preskolil[side][k]: uid Nástroja či Školiteľa pri povodne. */
  readonly preskolil: (number | null)[][];
  /** Preškolenia karty (premenyVLinii). */
  readonly premeny: PremenyKarty;
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
  /** puska[side][k]: Petelica, ktorú Puška zachránila pred zrušením — ráta sa o 1 poškodenie menej. */
  readonly puska: boolean[][];
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
      if (elems.some((x) => x.defId === "praudovravec" && x.staryEfekt && x.owner === su)) continue;
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
  premeny: PremenyKarty = BEZ_PREMIEN,
): Elem {
  const printed = printedSides(data, card);
  // Preškolenie (Nástroj, Školiteľ) platí ešte pred spojmi — susedia sa párujú už s preškolenými akciami.
  const sNastrojom = pl?.podlozene !== undefined && pl.podlozene.length > 0;
  const h = premeny.hrany;
  const strany = h.size === 0 ? null : { left: preskolStranu(h, printed.left), right: preskolStranu(h, printed.right) };
  const akcie = (s: NonNullable<typeof strany>["left"]): Slot[] => s.map((x) => x?.akcia ?? null);
  const povodne = (s: NonNullable<typeof strany>["left"]): (Action | null)[] => s.map((x) => x?.povodna ?? null);
  const kto = (s: NonNullable<typeof strany>["left"]): (number | null)[] => s.map((x) => x?.nastroj ?? null);
  const ucinky: ReadonlySet<string> = sNastrojom ? ucinkyNastrojov(data, pl) : new Set();
  return {
    uid: card.uid,
    defId: card.defId,
    tags: defOf(data, card).tags,
    staryEfekt: efektyNavyse(defOf(data, card)).length === 0,
    owner,
    isLokalita,
    strana,
    rotated,
    printed,
    effLeft: strany === null ? (rotated ? reversed(printed.right) : [...printed.left]) : rotated ? akcie(strany.right).reverse() : akcie(strany.left),
    effRight: strany === null ? (rotated ? reversed(printed.left) : [...printed.right]) : rotated ? akcie(strany.left).reverse() : akcie(strany.right),
    povodne:
      strany === null
        ? [[null, null, null, null], [null, null, null, null]]
        : rotated
          ? [povodne(strany.right).reverse(), povodne(strany.left).reverse()]
          : [povodne(strany.left), povodne(strany.right)],
    preskolil:
      strany === null
        ? [[null, null, null, null], [null, null, null, null]]
        : rotated
          ? [kto(strany.right).reverse(), kto(strany.left).reverse()]
          : [kto(strany.left), kto(strany.right)],
    premeny,
    stav: [freshStav(), freshStav()],
    nasobok: [freshNasobok(), freshNasobok()],
    vzbura: [false, false],
    vzburaPosilnena: [false, false],
    forsaz: [false, false],
    forsazNastroj: ucinky.has("Forsáž"),
    naexBy,
    naexNastroj: naexBy === undefined && ucinky.has("NA EX") && !ucinky.has("Výtržník") && pl?.vytrznik !== true,
    vieraAkoVizia: false,
    premena: pl?.premena,
    dovody: [0, 1].map(() => [[], [], [], []]),
    zrusil: [0, 1].map(() => [null, null, null, null]),
    posilnene: [],
    spojena: [0, 1].map(() => [false, false, false, false]),
    zrusilOdporom: [0, 1].map(() => [null, null, null, null]),
    puska: [0, 1].map(() => [false, false, false, false]),
  };
}

/** Preškolenia jednej karty: akcia → na čo a kto. */
export interface PremenyKarty {
  /** Akcie na hranách — Nástroj pod kartou aj Školitelia. */
  readonly hrany: ReadonlyMap<Action, PremenaAkcie>;
  /** Akcie navyše — len Školitelia (Nástroj preškoľuje hrany, PRAVIDLA §12). */
  readonly navyse: ReadonlyMap<Action, PremenaAkcie>;
}

const BEZ_PREMIEN: PremenyKarty = { hrany: new Map(), navyse: new Map() };

/**
 * Preškolenia kariet v línii (Michal 2026-11-08) podľa uid, každé v poradí prednosti: akcia sa
 * preškolí raz, prvou premenou v poradí podložený Nástroj (v poradí podloženia) → Podpora
 * a Konflikt Školiteľa (v poradí spustenia, PlacedCard.preskolenia) → Furt Školiteľa, s ktorým
 * karta susedí (karty oboch hráčov; aj lícom dole, ako Furt efekty akcií). Premeny sa nereťazia —
 * výstup jednej nie je vstupom inej. Lokalita ani karta v strede nič nedostane. Akcie navyše
 * preškolí len Školiteľ — Nástroj mení hrany.
 */
export function premenyVLinii(data: GameData, line: Pick<LineState, "lokalita" | "strany">): ReadonlyMap<number, PremenyKarty> {
  const out = new Map<number, { hrany: Map<Action, PremenaAkcie>; navyse: Map<Action, PremenaAkcie> }>();
  const vsetky = [...line.strany[0], ...line.strany[1]];
  const pridaj = (uid: number, z: Action, p: PremenaAkcie): void => {
    let m = out.get(uid);
    if (m === undefined) {
      m = { hrany: new Map(), navyse: new Map() };
      out.set(uid, m);
    }
    if (!m.hrany.has(z)) m.hrany.set(z, p);
    if (p.zdroj !== "Nástroj" && !m.navyse.has(z)) m.navyse.set(z, p);
  };
  for (const pl of vsetky) {
    if (pl.podlozene !== undefined && pl.podlozene.length > 0) {
      for (const [z, p] of preskoleniaHostitela(data, pl)) pridaj(pl.card.uid, z, { na: p.na, uid: p.uid, zdroj: "Nástroj" });
    }
    for (const p of pl.preskolenia ?? []) pridaj(pl.card.uid, p.z, { na: p.na, uid: p.od, zdroj: p.spustac });
  }
  for (const pl of vsetky) {
    const furt = preskoleniaKarty(defOf(data, pl.card)).filter((e) => e.spustac === "Furt");
    if (furt.length === 0) continue;
    for (const s of okolieVLinii(line, pl.card.uid)) {
      if (s === null) continue;
      for (const e of furt) pridaj(s.card.uid, e.z, { na: e.na, uid: pl.card.uid, zdroj: "Furt" });
    }
  }
  return out;
}

/** Preškolenia, ktoré platia na karte, s počtom premenených akcií (vytlačené na oboch hranách a akcie navyše). */
function preskolenaKarta(data: GameData, card: CardInstance, premeny: PremenyKarty): PremenaNaKarte[] {
  const p = printedSides(data, card);
  const navyse = efektyNavyse(defOf(data, card)).flatMap((e) => e.akcie);
  const out = new Map<string, PremenaNaKarte>();
  const pridaj = (z: Action, x: PremenaAkcie, n: number): void => {
    const k = `${x.uid}:${x.zdroj}:${z}`;
    const bolo = out.get(k);
    out.set(k, { z, na: x.na, od: x.uid, zdroj: x.zdroj, akcii: (bolo?.akcii ?? 0) + n });
  };
  for (const [z, x] of premeny.hrany) pridaj(z, x, [...p.left, ...p.right].filter((a) => a === z).length);
  // Školiteľ, ktorého na hranách predbehol Nástroj, ostáva len pri akciách navyše, ktoré karta má.
  for (const [z, x] of premeny.navyse) {
    const n = navyse.filter((a) => a === z).length;
    if (n > 0 || out.has(`${x.uid}:${x.zdroj}:${z}`)) pridaj(z, x, n);
  }
  return [...out.values()];
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

function markVzbura(elem: Elem, side: 0 | 1): void {
  if (elem.isLokalita) {
    elem.vzbura[side] = true;
  } else {
    elem.vzbura[0] = true;
    elem.vzbura[1] = true;
  }
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
  line: Pick<LineState, "nastroje">,
  forsaze: SpojForsaze[],
  vzburyPosilnene: VzburaSPosilnenim[],
): void {
  // Praudovravec (Dezinformátor, v7): Odpor na jeho spojoch neruší, ale posilní.
  const dezinformator = (!a.isLokalita && a.defId === "praudovravec" && a.staryEfekt) || (!b.isLokalita && b.defId === "praudovravec" && b.staryEfekt);
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
 * Zruší NA EX Posilnenie tejto karty? Veteránovi nie, Energeťák majiteľa ho chráni
 * (Dedičstvo, Náradie 2026-10-30). Lokalita NA EX nedostáva.
 */
function naexRusiPosilnenie(elem: Elem, line: Pick<LineState, "nastroje">): boolean {
  if ((elem.naexBy === undefined && !elem.naexNastroj) || elem.defId === "veteran") return false;
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
      if (elem.isLokalita) elem.forsaz[side] = true;
      else elem.forsaz.fill(true);
    }
  }
  for (const { odpor, side, posil } of vzburyPosilnene) {
    if (naexRusiPosilnenie(posil, line)) continue;
    if (odpor.isLokalita) odpor.vzburaPosilnena[side] = true;
    else odpor.vzburaPosilnena.fill(true);
  }
  for (const elem of elems) {
    for (const side of [0, 1] as const) {
      for (const [zapnute, dovod] of [
        [elem.forsaz[side], "Forsáž"],
        [elem.vzburaPosilnena[side], "Posilnenie"],
        [elem.forsazNastroj && !elem.isLokalita, "Forsáž"],
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
  if (elem.naexBy === undefined && !elem.naexNastroj) return;
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
    if (e.defId === "silna_nezavisla_zena") {
      // Michal 2026-10-18: podporuje okolie — aktívne akcie susedných kariet
      // toho istého majiteľa sa rátajú dvakrát (lokalitu a cudzie karty nie).
      // Michal 2026-11-08: len ľudí — Občanov a Starešinov; Zviera ani Nástroj nie,
      // ani keď je zároveň Občan (Recidivista).
      for (const s of okolie(e)) if (!s.isLokalita && s.owner === e.owner && podporiSilnaZena(s.tags)) zdvojAktivne(s, e.defId);
    } else if (e.defId === "pes" && !umlcane.has(e.uid)) {
      // Pes (Furt, v7): aktívne akcie na spoji so súperovou kartou ×2 — strana k tomu susedovi.
      const [lavy, pravy] = susedia.get(e) ?? [null, null];
      for (const [side, sused] of [[0, lavy], [1, pravy]] as const) {
        if (sused !== null && !sused.isLokalita && sused.owner !== e.owner) zdvojStranu(e, side, e.defId);
      }
    } else if (e.defId === "opatrovatelka" && e.staryEfekt) {
      // Opatrovateľka (Furt, v11.5): aktívne akcie tvojich Pamätníkov v jej okolí sú posilnené.
      for (const s of okolie(e)) if (!s.isLokalita && s.owner === e.owner && s.tags.includes("Pamätník")) zdvojAktivne(s, e.defId);
    } else if (e.defId === "liberal" && rovnovaha[e.owner]) {
      // Liberál (Furt, v10.3): s rovnako ženami a chlapmi v partii majiteľa sú jeho aktívne akcie posilnené.
      zdvojAktivne(e, e.defId);
    }
  }
}

/** Koho Silná nezávislá žena podporí: Občana či Starešinu, nie Zviera ani Nástroj (Michal 2026-11-08). */
function podporiSilnaZena(tags: readonly Tag[]): boolean {
  return (tags.includes("Občan") || tags.includes("Starešina")) && !tags.includes("Zviera") && !tags.includes("Nástroj");
}

/** Aktívne akcie jednej strany karty sa rátajú dvakrát (Pes). */
function zdvojStranu(elem: Elem, side: 0 | 1, zdroj: string): void {
  for (let k = 0; k < 4; k++) {
    if (elem.stav[side]![k] !== "aktivna") continue;
    elem.nasobok[side]![k] = (elem.nasobok[side]![k] as number) * 2;
    elem.dovody[side]![k]!.push(`karta:${zdroj}`);
  }
}

/** Akcia, ktorou sa slot karty ráta — staré sady (v7): premena Šarlatána a Miňištranta. */
function akciaPoPremene(elem: Elem, action: Action): Action {
  const a: Action = elem.vieraAkoVizia && action === "Viera" ? "Vízia" : action;
  if (elem.premena === "sarlatan") return a === "Dlh" ? "Viera" : a === "Povera" ? "Rana" : a;
  if (elem.premena === "ministrant" && a === "Viera") return "Pecka";
  return a;
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
    // Michal 2026-11-08: preškolená akcia je vidieť na karte, ktorej sa týka — `action` je už nová,
    // `povodna` vytlačená (Nástroj aj Školiteľ). Šarlatán a Výtržník nie (zatiaľ).
    const povodna = elem.povodne[side]![idx] ?? null;
    const preskolil = elem.preskolil[side]![idx] ?? null;
    return {
      action,
      ...(povodna !== null ? { povodna, ...(preskolil !== null ? { preskolil } : {}) } : {}),
      stav: elem.stav[side]![idx] as SlotStav,
      nasobok: elem.nasobok[side]![idx] as number,
      ...(elem.vieraAkoVizia && action === "Viera" ? { ako: "Vízia" as const } : {}),
    };
  };
  return {
    uid: elem.uid,
    vzbura: elem.vzbura[0] || elem.vzbura[1],
    forsaz: elem.forsaz[0] || elem.forsaz[1] || elem.forsazNastroj,
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
  // Školiteľ, ktorý akciu preškolil, je karta v línii — rozpis súčtov ho uvedie ako dôvod.
  const vLinii = new Map([...line.strany[0], ...line.strany[1]].map((pl) => [pl.card.uid, pl.card.defId]));
  const dovodSkolitela = (uid: number | null): string | null => {
    const defId = uid === null ? undefined : vLinii.get(uid);
    return defId === undefined ? null : `karta:${defId}`;
  };

  // Výtržník NA EX nezdvojuje — jeho akcie sa prepíšu na Rany nižšie.
  const vytrznici = new Set<number>();
  // Injekcia pod kartou (Náradie) z nej robí Výtržníka tou istou cestou ako zrážka NA EX.
  for (const strana of line.strany) for (const p of strana) if (p.vytrznik === true || ucinkyNastrojov(data, p).has("Výtržník")) vytrznici.add(p.card.uid);
  const premeny = premenyVLinii(data, line);
  const partia0 = line.strany[0].map((p) =>
    makeElem(data, p.card, p.playedBy, p.playedBy === 1, false, vytrznici.has(p.card.uid) ? undefined : p.naexBy, 0, p, premeny.get(p.card.uid)),
  );
  const partia1 = line.strany[1].map((p) =>
    makeElem(data, p.card, p.playedBy, p.playedBy === 1, false, vytrznici.has(p.card.uid) ? undefined : p.naexBy, 1, p, premeny.get(p.card.uid)),
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
      resolveJunction(segment[i] as Elem, segment[i + 1] as Elem, line, forsaze, vzburyPosilnene);
    }
  }
  // Vidly pod kartou (Náradie): Vzbura ako zo spoja — so Vzburou zo spoja sa karta obráti raz.
  for (const strana of line.strany) {
    for (const p of strana) {
      if (!ucinkyNastrojov(data, p).has("Vzbura")) continue;
      const elem = elems.find((e) => e.uid === p.card.uid);
      if (elem !== undefined) markVzbura(elem, 0);
    }
  }
  for (const elem of elems) applyVzbura(elem);
  for (const elem of elems) vyherneZreby(elem, line);
  applyForsaz(forsaze, vzburyPosilnene, elems, line);
  for (const elem of elems) zrusPosilnenie(elem, line);
  for (const elem of elems) applyNaex(elem, line);
  for (const elem of elems) puskaChrani(elem, line);
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
        const kocovnik = elem.defId === "kocovnik" && elem.staryEfekt && elem.strana !== null ? (susedLokality[elem.strana] ?? elem.owner) : null;
        const target: PlayerId = elem.isLokalita ? (susedLokality[side] ?? side) : (kocovnik ?? elem.owner);
        // Puška: zachránená Petelica udeľuje 2 — v súčtoch sa ráta ako Pecka (2 tuhé).
        const ako: Action = elem.puska[side]![k] ? "Pecka" : akciaPoPremene(elem, action);
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
        // Preškolil Školiteľ — rozpis ukáže, kto (Nástroj pod kartou leží na očiach).
        const skolitel = dovodSkolitela(elem.preskolil[side]![k] ?? null);
        if (skolitel !== null) dovody.push(skolitel);
        if (ako !== action && !elem.puska[side]![k]) dovody.push(`karta:${elem.premena ?? "sarlatan"}`);
        pridajZdroj(target, ako, { defId: elem.defId, uid: elem.uid, hodnota, vStrede: elem.isLokalita, dovody });
      }
    }
  }

  const cards = new Map<number, CardLineEval>();
  for (const elem of elems) cards.set(elem.uid, elemEval(elem));

  // Efektívna ľavá strana karty v strede susedí so stranou hráča 0, pravá s hráčom 1.
  const aktivne = (side: 0 | 1): number => (stred === null ? 0 : stred.stav[side]!.filter((x) => x === "aktivna").length);

  // Akcie navyše (frakcie): majiteľovi karty, mimo hrán — nič, čo mení akcie na spojoch, ich nemení,
  // okrem preškolenia karty (Michal 2026-11-08). Pred Presbiterom, ktorý uberá z celého súčtu Viery.
  const tagy = (defId: string): readonly Tag[] => data.cards.get(defId)?.tags ?? [];
  const elemPodla = new Map(elems.map((e) => [e.uid, e]));
  const pripocitaj = (p: PlayerId, defId: string, uid: number, stav: readonly NavyseStav[]): void => {
    for (const e of stav) {
      // Výherný automat: Dlh dáva motor na konci poslednej Pitky (engine pokracujPoPitke), nie súčet.
      if (e.krat === 0 || e.spustac === "Posledná Pitka kola") continue;
      const dovod = `akcia navyše (${popisPodmienky(e)})`;
      const pocty = new Map<string, { a: Action; ako: Action; od: number | null; n: number }>();
      e.akcie.forEach((a, j) => {
        const ako = e.ako?.[j] ?? a;
        const od = e.akoOd?.[j] ?? null;
        const k = `${a}>${ako}`;
        const x = pocty.get(k);
        if (x === undefined) pocty.set(k, { a, ako, od, n: 1 });
        else x.n += 1;
      });
      for (const { a, ako, od, n } of pocty.values()) {
        const hodnota = e.krat * n;
        const pricina = ako === a ? null : (dovodSkolitela(od) ?? (od === null ? null : "Nástroj"));
        const dovody = pricina === null ? [dovod] : [dovod, pricina];
        sums[p][ako] = (sums[p][ako] ?? 0) + hodnota;
        pridajZdroj(p, ako, { defId, uid, hodnota, vStrede: false, dovody });
      }
    }
  };
  for (const strana of line.strany) {
    for (const pl of strana) {
      const def = defOf(data, pl.card);
      const efekty = efektyNavyse(def);
      if (efekty.length === 0) continue;
      const slovami = efekty.map((e) => (jeSlovami(e) ? kratSlovami(data, line, pl, e) : 0));
      const elem = elemPodla.get(pl.card.uid);
      const stav = stavNavyse(tagy, efekty, line.strany, pl, umlcane, slovami).map((e) => premenNavyse(e, elem));
      const ev = cards.get(pl.card.uid);
      if (ev !== undefined) cards.set(pl.card.uid, { ...ev, navyse: stav });
      pripocitaj(pl.playedBy, def.id, pl.card.uid, stav);
    }
  }
  const navyseDedicstva = new Map<number, readonly NavyseStav[]>();
  for (const p of [0, 1] as const) {
    for (const k of line.kolo?.dedicstvo[p] ?? []) {
      const def = defOf(data, k);
      const efekty = efektyNavyse(def);
      if (!efekty.some((e) => e.dedicstvo === true)) continue;
      const stav = efekty.map((e): NavyseStav => ({ ...e, krat: kratVDedicstve(line, p, def.id, e) }));
      navyseDedicstva.set(k.uid, stav);
      pripocitaj(p, def.id, k.uid, stav);
    }
  }

  // Preškolenia (Michal 2026-11-08): na dotknutej karte čo a kto, na Školiteľovi koho preškoľuje.
  const premenene = new Map<string, number>();
  for (const pl of [...line.strany[0], ...line.strany[1]]) {
    const m = premeny.get(pl.card.uid);
    if (m === undefined) continue;
    const preskolena = preskolenaKarta(data, pl.card, m);
    for (const p of preskolena) premenene.set(`${p.od}:${p.zdroj}:${p.z}:${pl.card.uid}`, p.akcii);
    const ev = cards.get(pl.card.uid);
    if (ev !== undefined) cards.set(pl.card.uid, { ...ev, preskolena });
  }
  for (const pl of [...line.strany[0], ...line.strany[1]]) {
    const efekty = preskoleniaKarty(defOf(data, pl.card));
    if (efekty.length === 0) continue;
    const susedia = okolieVLinii(line, pl.card.uid).flatMap((s) => (s === null ? [] : [s.card.uid]));
    const skolitel = efekty.map((e): StavSkolitela => {
      const ku =
        e.spustac === "Furt"
          ? susedia
          : [...line.strany[0], ...line.strany[1]].filter((x) => (x.preskolenia ?? []).some((p) => p.od === pl.card.uid && p.spustac === e.spustac && p.z === e.z)).map((x) => x.card.uid);
      const akcii = ku.reduce((n, uid) => n + (premenene.get(`${pl.card.uid}:${e.spustac}:${e.z}:${uid}`) ?? 0), 0);
      return { spustac: e.spustac, z: e.z, na: e.na, ku, akcii };
    });
    const ev = cards.get(pl.card.uid);
    if (ev !== undefined) cards.set(pl.card.uid, { ...ev, skolitel });
  }

  presbiter([partia0, partia1], susedLokality, elems, sums, zdroje);

  return { sums, cards, aktivneStredu: [aktivne(0), aktivne(1)], zdroje, zrusene, zruseneOdporom, ...(navyseDedicstva.size > 0 ? { navyseDedicstva } : {}) };
}

/**
 * Preškolenie akcií navyše karty (Michal 2026-11-08): Školiteľ mení akcie navyše dotknutej karty
 * tak ako jej hrany; podložený Nástroj len hrany (§12). Iné modifikátory spoja ich nemenia.
 */
function premenNavyse(e: NavyseStav, elem: Elem | undefined): NavyseStav {
  const m = elem?.premeny.navyse;
  if (m === undefined || m.size === 0) return e;
  const ako = e.akcie.map((a): Action => m.get(a)?.na ?? a);
  if (!ako.some((a, j) => a !== e.akcie[j])) return e;
  return { ...e, ako, akoOd: e.akcie.map((a) => m.get(a)?.uid ?? null) };
}

/**
 * Koľkokrát platí efekt navyše s podmienkou slovami karty v línii (skryté akcie, Michal
 * 2026-11-08). Podmienku vyhodnocuje jadro podľa karty, text ju len opisuje — ten istý
 * výpočet, aký mali tieto karty ako tuhé navyše (effects.ts bitkaMody). Neznáma karta:
 * bez podmienky platí raz, s podmienkou nikdy (tvorca to hlási).
 */
function kratSlovami(data: GameData, line: LineState, pl: PlacedCard, e: EfektNavyse): number {
  const kolo = line.kolo;
  // Efekt Dedičstva v línii neplatí — Nástroj v línii je len akcie na hranách.
  if (kolo === undefined || e.dedicstvo === true) return 0;
  const p = pl.playedBy;
  const q = opponentOf(p);
  if (e.spustac === "Posledná Pitka kola") {
    if (!kolo.poslednaPitka) return 0;
    // Traktorista (Michal 2026-11-08): bez prevahy v jeho kraji; vo finále bez lokality kraje nie sú — prevahu nemá nikto.
    if (pl.card.defId === "traktoristka") return line.lokalita === null || prevahaStran(data, line.strany)[stranaKarty(line, pl)] !== p ? 1 : 0;
    return e.podmienka === undefined ? 1 : 0;
  }
  const vsetky = [...line.strany[0], ...line.strany[1]];
  switch (pl.card.defId) {
    case "pijan":
      // Za každé NA EX majiteľa v tomto kole — poldeci z neho leží na karte do kroku 5 bitky.
      return vsetky.reduce((n, x) => n + (x.naexBy === p ? 1 : 0) + (x.naexBy2 === p ? 1 : 0), 0);
    case "svokra":
      // Za každú kartu majiteľa so súperovým NA EX na ktorejkoľvek strane, aj pri zrážke (Výtržník).
      if (autorityUmlcane(data, line.strany, p)) return 0;
      return vsetky.filter((x) => x.playedBy === p && (x.naexBy === q || x.naexBy2 === q)).length;
    case "vymahac":
      return Math.floor(kolo.dlhy[p] / 2);
    case "sofer":
      return kolo.naexVKole[p] ? 0 : 1;
    case "traktoristka":
      // Prevaha v kraji, kde leží; vo finále bez lokality kraje nie sú.
      if (line.lokalita === null) return 0;
      return prevahaStran(data, line.strany)[stranaKarty(line, pl)] === p ? 1 : 0;
    default:
      return e.podmienka === undefined ? 1 : 0;
  }
}

/** Kraj, v ktorom karta leží (strana línie). */
function stranaKarty(line: Pick<LineState, "strany">, pl: PlacedCard): PlayerId {
  return line.strany[0].some((x) => x.card.uid === pl.card.uid) ? 0 : 1;
}

/** Dlh z akcie Hazard navyše „Posledná Pitka kola“ karty v línii — motor ho dá na konci poslednej Pitky. */
export interface DlhPoslednejPitky {
  readonly uid: number;
  readonly defId: string;
  readonly hrac: PlayerId;
  readonly dlhy: number;
}

/**
 * Hazardy navyše „Posledná Pitka kola“ kariet v línii (Traktorista bez prevahy v jeho kraji,
 * Michal 2026-11-08): ako Výherný automat v Dedičstve do súčtov nejdú — každý dá majiteľovi
 * na konci poslednej Pitky kola Dlh (engine pokracujPoPitke; náhľad vyhladDlhov). Ráta sa
 * z línie tak, ako by bola posledná Pitka teraz.
 */
export function dlhyPoslednejPitky(data: GameData, line: LineState): DlhPoslednejPitky[] {
  const vsetky = [...line.strany[0], ...line.strany[1]];
  if (!vsetky.some((pl) => efektyNavyse(defOf(data, pl.card)).some((e) => e.spustac === "Posledná Pitka kola"))) return [];
  const kolo: StavKolaLinie = { naexVKole: [false, false], dlhy: [0, 0], prilozeniaKu: [0, 0], dedicstvo: [[], []], ...line.kolo, poslednaPitka: true };
  const ev = evaluateLine(data, { ...line, kolo });
  const out: DlhPoslednejPitky[] = [];
  for (const pl of vsetky) {
    const dlhy = (ev.cards.get(pl.card.uid)?.navyse ?? [])
      .filter((e) => e.spustac === "Posledná Pitka kola")
      .reduce((n, e) => n + e.krat * (e.ako ?? e.akcie).filter((a) => a === "Dlh").length, 0);
    if (dlhy > 0) out.push({ uid: pl.card.uid, defId: pl.card.defId, hrac: pl.playedBy, dlhy });
  }
  return out;
}

/** Koľkokrát platí efekt navyše Nástroja v Dedičstve hráča p (Pasca, Výherný automat). */
function kratVDedicstve(line: LineState, p: PlayerId, defId: string, e: EfektNavyse): number {
  const kolo = line.kolo;
  if (kolo === undefined || e.dedicstvo !== true) return 0;
  if (e.spustac === "Posledná Pitka kola") return kolo.poslednaPitka ? 1 : 0;
  if (e.spustac !== "Bitka") return 0;
  // Pasca: súper v tomto kole priložil kartu (akúkoľvek, aj lícom dole) k tvojej — za každú Pascu.
  if (defId === "pasca") return kolo.prilozeniaKu[p] > 0 ? 1 : 0;
  return e.podmienka === undefined ? 1 : 0;
}

/** Karty, ktorých podmienku slovami jadro pozná — na inej karte ju tvorca hlási ako chybu. */
export const PODMIENKY_SLOVAMI: readonly string[] = ["pijan", "svokra", "vymahac", "sofer", "traktoristka", "pasca", "vyherny_automat"];

/**
 * Praudovravec starej sady: Autority hráča p neuplatňujú efekt, keď v súperovej partii leží
 * odkrytý Praudovravec so starým textom (effects.ts efektPotlaceny).
 */
export function autorityUmlcane(data: GameData, strany: LineState["strany"], p: PlayerId): boolean {
  const praudovravec = data.cards.get("praudovravec");
  if (praudovravec === undefined || !praudovravec.effectText.includes("Autorit") || efektyNavyse(praudovravec).length > 0) return false;
  return [...strany[0], ...strany[1]].some((x) => x.playedBy !== p && x.card.defId === "praudovravec" && x.zaverecna !== true);
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
    for (const n of e?.navyse ?? []) {
      for (const a of n.akcie) {
        aktivne += n.krat;
        tuhe += (TUHE[a] ?? 0) * n.krat;
        if (ZLE.includes(a)) zle += n.krat;
      }
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
export function okolieVLinii(line: Pick<LineState, "lokalita" | "strany">, uid: number): (PlacedCard | null)[] {
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

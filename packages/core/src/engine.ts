// Motor kola (M6): stavový automat
//
//   Voľba cieľa → [Draft] → (Zhromaždenie → Pitka) × N → Bitka → ďalšie kolo
//
// apply(state, cmd, hrac) je jediné miesto, kde sa stav mení. Vracia NOVÝ
// stav + udalosti; starý stav nemutuje (vnútri pracuje na hlbokej kópii).
// Klient posiela zámery, server počíta — všetko tu je deterministické.
//
// Rozhodnutia pri nejasných pravidlách sú vypísané v README (sekcia
// „Rozhodnuté nejasnosti“) a označené v komentároch ako [R#].

import type { CardDef, CardInstance, Phase, PlayerId, Tag } from "./types.ts";
import { opponentOf, priazenZKluca } from "./types.ts";
import type { GameData } from "./data.ts";
import { defOf } from "./data.ts";
import type { RngState } from "./rng.ts";
import { rngInt, rngSeed, rngShuffle } from "./rng.ts";
import type { ActionSums, KartaVBitke, LineEval, LineState, PlacedCard } from "./partia.ts";
import { evaluateLine, prevahaStran, prispevkyKariet, snubenicaVracia } from "./partia.ts";
import { krajeStran } from "./hrany.ts";
import type { PlayerState } from "./player.ts";
import {
  cenaBarteru,
  freshPlayer,
  hodnotaViery,
  prahCirhozy,
  prahDlhu,
  prahExekutora,
  textNeresti,
} from "./player.ts";
import type { BattleOutcome, BattleSide, DamageResult, RozhodnutieBitky } from "./battle.ts";
import { battleOutcome, computeDamage, exekutorCheck, spakyZaBitku, zhoriPriExekucii } from "./battle.ts";
import type { ElderState, PosunMarkera } from "./elders.ts";
import {
  MARKER_STRED,
  NAZVY_ZON,
  STUPNICA_ZONY,
  cenaPatronatu,
  freshElder,
  patronatMozny,
  posunMarker,
  prebudenyPre,
  priazenHraca,
  priazenSila,
  obavanyHrac,
  spakyZaStarsich,
  vydesil,
  favourStarsieho,
  scorecardStarsieho,
} from "./elders.ts";
import type { DlzkaHry } from "./constants.ts";
import { ALL_DLZKY, DLZKY_HRY, KONSTANTY, PREDVOLENA_DLZKA } from "./constants.ts";
import { cigariet, kariet, pocet, rodovo } from "./jazyk.ts";
import type { Rozdanie } from "./vyucba.ts";
import type { Moment } from "./momenty.ts";
import type { RekapitulaciaBitky, RekapitulaciaPitky, ZaverecnaOdhalena } from "./rekapitulacia.ts";
import { akcieKartyVLinii, rekapitulaciaBitky, rekapitulaciaPitky } from "./rekapitulacia.ts";
import {
  doliatieZakazane,
  bitkaMody,
  barterZlavaLokality,
  bezLimituPracujuci,
  cenaPrebytku,
  dedicstvoZaPrehru,
  efektHraca,
  efektPotlaceny,
  exekutorLokality,
  jeCielLokalita,
  jeEfektManual,
  lenVlastnaStrana,
  limitZhromazdenia,
  vlastnyLimitZhromazdenia,
  naexZaPitku,
  prebytokProtiZlava,
  prahCirhozyBonus,
  spolocnyLimit,
  vykupZoSrotu,
  zakazFajcit,
  zakazNaex,
  zakazVypit,
  zadlzenieZLinie,
  vDedicstve,
  partiaHraca,
  vPartii,
  doliatieNaKari,
  naexNaZviera,
  traktoristkyBezPrevahy,
} from "./effects.ts";
import type { VerejnyHrac, VerejnyStav } from "./effects.ts";
import type { Favour } from "./types.ts";

// ---------------------------------------------------------------------------
// Stav

/**
 * Cieľ kola je lokalita — bitku o staršieho nahradil patronát (Michal
 * 2026-10-20). Od v6 (Michal 2026-10-26) je posledná bitka finále bez
 * lokality: v strede leží prvá vyložená karta.
 */
export type CielKola =
  | {
      readonly typ: "lokalita";
      /** Karta v strede línie. */
      readonly lokalita: CardInstance | null;
    }
  // v7 (plan.md 7.3): finále sa hrá na pinnacle lokalite; null = finále bez lokality (v6, staré uloženia, výučba).
  | { readonly typ: "finale"; readonly lokalita: CardInstance | null };

/**
 * Patronát (Michal 2026-10-20): hráč, ktorému starší prejavuje priazeň, si
 * ho po šenku vezme do ruky; na scorecard dá lícom dole kartu z ruky a marker
 * ide do stredu. Vyhrá bitku → staršieho si nechá a náhrada sa otočí; prehrá
 * → starší sa vracia na scorecard a hráč odhodí poldeci.
 */
export interface Patronat {
  readonly elderId: string;
  /** Karta lícom dole na scorecarde — TAJNÁ, súperovi ju viewFor neposiela. */
  readonly nahrada: CardInstance;
  /** Pohoršenia, ktoré súper dostane v bitke (o koľko sa marker posunul do stredu). */
  readonly pohorsenia: number;
}

/** Výber hráča v jednom kroku stavby šenku (uid z jeho balíčka stavby). */
export interface VyberStavby {
  readonly doSenku: readonly number[];
  readonly odhod: readonly number[];
}

/**
 * Draft (Michal 2026-10-12): najprv hráči šenok postavia — z balíčkov, ktoré
 * si podávajú, naraz dávajú karty do šenku a naspodok spoločného balíčka
 * (Michal 2026-10-19: po dvoch, aby stavba mala len dva kroky) — potom
 * z neho striedavo berú, začína útočník.
 */
export interface DraftStav {
  /** Po braní nasleduje patronát: rozhoduje útočník, potom obranca. */
  readonly krok: "stavba" | "beranie" | "patronat";
  /** Balíčky stavby v rukách hráčov — TAJNÉ, každý vidí len svoj (viewFor). */
  readonly balicky: readonly [readonly CardInstance[], readonly CardInstance[]];
  /** Výbery v aktuálnom kroku stavby — TAJNÉ, kým nevyberú obaja. */
  readonly vyber: readonly [VyberStavby | null, VyberStavby | null];
  /** Kto berie zo šenku (krok „beranie“). */
  readonly naTahu: PlayerId;
  /** Hráč už nič neberie (prestal, alebo šenok je prázdny). */
  readonly hotovo: readonly [boolean, boolean];
  readonly noveKarty: readonly [number, number];
  /**
   * Karty vzaté zo šenku v tomto drafte (#111, Michal 2026-10-26) — branie je
   * verejné, hráč má vidieť, čo mu súper zobral; na mieste karty ostane jej tieň.
   * Chýba v stavoch spred tejto zmeny (scenár výučby, staré testy) — číta sa cez `?? []`.
   */
  readonly zobrate?: readonly ZobrataZoSenku[];
}

/** Karta vzatá zo šenku: kto ju vzal a na ktorom mieste šenku ležala. */
export interface ZobrataZoSenku {
  readonly karta: CardInstance;
  readonly hrac: PlayerId;
  /** Miesto v rade šenku, rátané aj s tieňmi skôr vzatých kariet — tieň ostane tam, kde karta ležala. */
  readonly miesto: number;
}

export interface ZhromazdenieStav {
  readonly naTahu: PlayerId;
  readonly zostavaLimit: readonly [number, number];
  readonly pasoval: readonly [boolean, boolean];
  /** Koľko ďalších vyložení hráč ešte zahrá bez odovzdania ťahu (Vypiť). */
  readonly navyse: readonly [number, number];
  /** Zastávka: limit je spoločný — každé vyloženie či vypitie ho uberie obom. */
  readonly spolocny?: boolean;
  /**
   * Zastávka: zvyšok vlastného limitu hráča (jeho limit mínus čo sám vyložil
   * a vypil). Pas platí cigarety najviac z neho, nie zo spoločnej zásoby.
   */
  readonly vlastny?: readonly [number, number];
}

/**
 * Za koľko kariet dostane hráč cigarety, keď teraz pasuje (§6; Zastávka §15):
 * zvyšok limitu, najviac toľko, koľko má kariet v ruke (v6.1, Michal 2026-10-27 —
 * s prázdnou rukou pas nič nedá).
 */
export function kartyZaPas(z: Pick<ZhromazdenieStav, "zostavaLimit" | "vlastny">, p: PlayerId, vRuke: number): number {
  return Math.max(0, Math.min(z.zostavaLimit[p], z.vlastny?.[p] ?? z.zostavaLimit[p], vRuke));
}

export interface PitkaStav {
  readonly naTahu: PlayerId;
  readonly hotovy: readonly [boolean, boolean];
  /** Limit NA EX za Pitku je po odkrytí minutý (placatka sa doň neráta). */
  readonly naexPouzity: readonly [boolean, boolean];
  /**
   * Koľkokrát hráč v tejto Pitke fajčil (každé fajčenie = 1 karta). Verejné —
   * určuje cenu ďalšieho fajčenia (cenaFajcenia), na začiatku Pitky je 0.
   */
  readonly fajcenie: readonly [number, number];
  /**
   * Hráč, ktorý práve smie na súperovo NA EX odpovedať vyložením jednej
   * karty z ruky mimo limitu (Michal 2026-10-12). Potom je na ťahu znova
   * ten, kto NA EX dal.
   */
  readonly reakcia: PlayerId | null;
  /** Poštárka a Starosta sa smú použiť raz za Pitku. */
  readonly postarka: readonly [boolean, boolean];
  readonly starosta: readonly [boolean, boolean];
  /** Koľko NA EX hráč v tejto Pitke dal, aj placatku (Policajtka ich porovná). */
  readonly naexPocet?: readonly [number, number];
  /** Zberný dvor: výkup karty z odhadzovacieho balíčka už v tejto Pitke použitý. */
  readonly vykup?: readonly [boolean, boolean];
  /** Kšefty (v7) použité v tejto Pitke — uid kariet (aj lokality) za každého hráča. */
  readonly kseft?: readonly [readonly number[], readonly number[]];
  /**
   * NA EX naraz (v5): skryto vybrané NA EX, ktoré sa odkryjú, keď obaja skončia
   * Pitku — TAJNÉ, každý vidí len svoje (viewFor).
   */
  readonly skryteNaex?: readonly SkryteNaex[];
  /** Po odkrytí NA EX: kto ešte odpovedá (v poradí obranca, potom útočník). */
  readonly frontaReakcii?: readonly PlayerId[];
}

/** Skryto vybrané NA EX (v5): kto ho dal a na ktorú kartu (skutočné uid). */
export interface SkryteNaex {
  readonly hrac: PlayerId;
  readonly uid: number;
}

export type BitkaKrok =
  | "benzinka"
  | "kar"
  | "exekutor"
  | "pohorsenie"
  | "prebytok"
  | "vestica"
  | "pohreb"
  | "cintorin"
  | "zivnostnik";

export interface BitkaStav {
  readonly krok: BitkaKrok | null;
  /** Hráč, ktorého rozhodnutie sa čaká (null = automatika beží). */
  readonly caka: PlayerId | null;
  readonly sums: readonly [ActionSums, ActionSums];
  readonly exekutorHotovy: readonly [boolean, boolean];
  /** Špaky, ktoré hráčom zhoreli pri exekúcii v tejto bitke (v6) — idú na nástenku. */
  readonly exekutor: readonly [number, number];
  readonly pohorsenieZostava: readonly [number, number];
  /** Pohoršenia, ktoré hráči v bitke dostali (pred použitím) — rekapitulácia bitky. */
  readonly pohorseniaSpolu?: readonly [number, number];
  /**
   * Koľko z pohorsenieZostava sú ešte Pohoršenia zo súperovho patronátu (v6,
   * Michal 2026-10-26) — tie nesmú na staršieho, ktorého si súper vzal za patróna.
   * Chýba = 0.
   */
  readonly pohorseniaPatronatu?: readonly [number, number];
  readonly damage: DamageResult | null;
  readonly vitaz: PlayerId | null;
  readonly prebytokDrzi: PlayerId | null;
  readonly prebytokZostava: number;
  /** Starší posunutí prebytkom v tejto bitke — súper držiteľa za nich dostane cigarety. */
  readonly prebytokPosunute: readonly string[];
  readonly pohrebHotovy: readonly [boolean, boolean];
  /** Benzínka: koľko svojich Občanov z línie má hráč ešte zahodiť. */
  readonly benzinkaZostava: readonly [number, number];
  /** Kar: hráč už rozhodol, či zahodí nepriznanú Cirhózu z ruky. */
  readonly karHotovy: readonly [boolean, boolean];
  /** Karty z línie, ktoré sa po bitke spália namiesto návratu (Dievčina na vydaj). */
  readonly spalit: readonly number[];
  readonly vesticaHotova: boolean;
  /** Cintorín: porazený už rozhodol o Nástroji do Dedičstva. */
  readonly cintorinHotovy?: boolean;
  /**
   * Živnostník (Výhra): koľko súperových Dedičstiev víťaz ešte zahodí. Nastaví
   * sa až pri vstupe do kroku (undefined = ešte nie) — Pohreb pred ním smie
   * Živnostníka z línie spáliť.
   */
  readonly zivnostnikZostava?: number;
}

/**
 * Bitka na krčmovej nástenke (v6, Michal 2026-10-26): lokalita s víťazom
 * a čo kto v bitke získal či stratil. Verejné — z toho kreslí klient nástenku
 * a popolníky (rozpisSpakov). Čísla špakov sú kladné, okrem `spakyPo`.
 */
export interface BitkaNaNastenke {
  readonly kolo: number;
  /** Karta lokality; null = finále. */
  readonly lokalita: CardInstance | null;
  readonly vitaz: PlayerId | null;
  readonly rozhodlo: RozhodnutieBitky;
  /** Odohrané Pitky kola. */
  readonly pitky: number;
  /** Špaky za bitku [hráč 0, hráč 1] — víťazovi, so špakmi zo sekery. */
  readonly zaBitku: readonly [number, number];
  /** Koľko zo zaBitku víťaz zobral zo sekery (predošlé remízy). */
  readonly zoSekery: number;
  /** Absťáky víťaza navyše oproti porazenému — o toľko dostal menej. */
  readonly abstakZrazka: number;
  /** Špaky po sekere, ktoré prepadli (remíza vo finále). */
  readonly prepadlo: number;
  readonly zaStarsich: readonly [number, number];
  /** Špaky, ktoré hráčom zhoreli pri exekúcii. */
  readonly exekutor: readonly [number, number];
  /** Po finále: držiteľ prebytku dostane špaky namiesto posunu markerov. */
  readonly prebytok: readonly [number, number];
  /** Špaky oboch po bitke (pred záverečnou Cirhózou a výkupným). */
  readonly spakyPo: readonly [number, number];
}

export interface KoniecHry {
  readonly vitaz: PlayerId | null;
  readonly dovod: string;
  /** Konečné špaky — null, keď sa hra skončila inak než po finále (vydesenie, vzdanie). */
  readonly body: readonly [number, number] | null;
  /** Nepriznané Cirhózy na konci hry (ruka aj oba balíčky) — za každú SPAKY_ZA_CIRHOZU menej. */
  readonly cirhozy?: readonly [number, number];
  /** Výkupné zvyšných plných poldeci a cigariet po finále (vykupne). */
  readonly vykupne?: readonly [Vykupne, Vykupne];
}

/** Výkupné zvyšných zdrojov hráča na konci hry: čo sa vykúpilo a za koľko špakov. */
export interface Vykupne {
  /** Plné poldeci (vypité ani ležiace pod NA EX sa nerátajú). */
  readonly poldeci: number;
  readonly cigarety: number;
  readonly spaky: number;
}

export interface GameState {
  readonly rng: RngState;
  readonly nextUid: number;
  readonly faza: Phase;
  readonly kolo: number;
  readonly utocnik: PlayerId;
  readonly hraci: readonly [PlayerState, PlayerState];
  readonly spolocnyBalicek: readonly CardInstance[];
  readonly senok: readonly CardInstance[];
  readonly lokalityVHre: readonly CardInstance[];
  /** Počet lokalít, o ktoré sa hrá (dĺžka hry); po nich príde finále. */
  readonly lokalitCelkom: number;
  /**
   * Rozpis úrovní lokalít po kolách (v7, plan.md 7.2), posledná je finále (4 =
   * pinnacle). Obranca vyberá zo všetkých ešte neodohraných lokalít úrovne kola;
   * lokalityVHre sú vtedy všetky lokality sady. Chýba = žreb lokalít ako do v6.
   */
  readonly rozpis?: readonly number[];
  /**
   * Špaky — víťazné body (v6, Michal 2026-10-26). Verejné, smú ísť do mínusu
   * (Exekútor). Nepriznaná Cirhóza sa odpočíta až na konci hry.
   */
  readonly spaky: readonly [number, number];
  /** Špaky zo sekery (remíza): čakajú na víťaza ďalšej bitky, vo finále prepadnú. */
  readonly spakyNaSekere: number;
  /** Odohrané bitky v poradí — krčmová nástenka. */
  readonly nastenka: readonly BitkaNaNastenke[];
  /**
   * Finále: strana, na ktorú padla prvá karta — tá leží v strede línie
   * (strany[stredFinale][0]). Keď sú obe strany neprázdne, zo strán sa to
   * vyčítať nedá. Chýba v uloženiach spred v6 UI.
   */
  readonly stredFinale?: PlayerId | null;
  /** Hráč dal v tomto kole NA EX (Krčmárka). */
  readonly naexVKole: readonly [boolean, boolean];
  readonly starsi: readonly ElderState[];
  readonly ciel: CielKola | null;
  readonly lokalitaOtocena: boolean;
  readonly strany: readonly [readonly PlacedCard[], readonly PlacedCard[]];
  /**
   * Pitiek v bitke (Michal 2026-10-19): 1 + menší z počtov aktivovaných
   * akcií karty v strede na jej dvoch stranách. Mení sa s líniou počas kola,
   * nikdy však neklesne pod už začaté Pitky.
   */
  readonly pitkyCelkom: number;
  readonly pitkaCislo: number;
  /** Nástroje vyložené do Dedičstva za celú hru oboma hráčmi — určuje cenu ďalšieho. */
  readonly dedicstvaVylozene: number;
  /** Cirhózy získané v tomto kole (efekt Čiernej mačky). */
  readonly cirhozyVKole: readonly [number, number];
  readonly draftStav: DraftStav | null;
  readonly zhromazdenieStav: ZhromazdenieStav | null;
  readonly pitkaStav: PitkaStav | null;
  readonly bitkaStav: BitkaStav | null;
  readonly koniec: KoniecHry | null;
  /**
   * Vízia na konci Pitky (Michal 2026-10-19): koľko vrchných kariet ešte hráč
   * prezrie a rozhodne, či si ich vezme do ruky, alebo zahodí. null = nič.
   */
  readonly vizia: { readonly zostava: readonly [number, number] } | null;
  /**
   * Ohlásené vydesenie (Michal 2026-10-16): kolo, v ktorom hráč vydesil
   * polovicu starších. Vyhrá, ak ich udrží do konca nasledujúceho kola.
   */
  readonly ohlaseneVydesenie: readonly [number | null, number | null];
  /** Patronát hráča v tomto kole (každý najviac jeden starší). */
  readonly patronat: readonly [Patronat | null, Patronat | null];
  /**
   * Odložené spúšťače skrytej Záverečnej hráča (index = majiteľ; najviac jedna
   * naraz — otočí sa na konci Pitky). Vyhodnotia sa pri otočení (Michal 2026-10-23).
   */
  readonly zaverecnaOdklad: readonly [OdkladZaverecnej | null, OdkladZaverecnej | null];
  /**
   * Posuny markerov (Pohoršenie, prebytok, patronát) od poslednej bitky do
   * konca nasledujúceho Zhromaždenia — stopa na stupnici a účtenka (#95).
   * Verejné; pravidlá z nich nič nerátajú.
   */
  readonly posunyMarkerov: readonly PosunMarkera[];
  /**
   * Rekapitulácie Pitiek tohto kola (roadmapa #106) — blok „z Pitiek kola“
   * v rekapitulácii bitky. Klient ich dostane v udalostiach, nie v pohľade.
   */
  readonly pitkyKola?: readonly RekapitulaciaPitky[];
  /** Pečeň a Cirhózy kola na začiatku Pitky — rekapitulácia Pitky z nich ráta pitie a NA EX. */
  readonly zaciatokPitky?: { readonly pecen: readonly [number, number]; readonly cirhozy: readonly [number, number] } | null;
  /**
   * Hasič (Michal 2026-10-26): karty náhodne vytiahnuté z vlastného
   * odhadzovacieho balíčka, o ktorých hráč ešte nerozhodol (nechať v ruke,
   * alebo vrátiť). Kým nerozhodne, nikto iný nehrá; karta leží ďalej
   * v odhadzovacom balíčku. Chýba v uloženiach spred zmeny.
   */
  readonly hasicVolby?: readonly HasicVolba[];
  /** Rany navyše kúpené Kšeftom Strýka z Ameriky v tomto kole (v7); verejné. */
  readonly kseftRany?: readonly [number, number];
}

/** Čakajúca voľba Hasiča. */
export interface HasicVolba {
  readonly hrac: PlayerId;
  /**
   * Voľba Nástupu, ktorá čaká ako Hasič (v7): Klebetnica (karta zo súperovej
   * ruky naspodok jeho balíčka), Dohadzovačka (dvaja starší). Chýba = Hasič.
   */
  readonly typ?: "klebetnica" | "dohadzovacka";
  readonly uid: number;
  /**
   * Čo hra odložila do rozhodnutia: odpoveď na NA EX by hneď vyhodnotila
   * Pitku a otočená Záverečná by ju ukončila — s kartou ešte nerozhodnutou.
   */
  readonly potom: "reakcia" | "koniecPitky" | null;
}

/** Čo by skrytá Záverečná spustila, keby bola odkrytá (Policajtka, Vychovávateľka, Hrobár). */
export interface OdkladZaverecnej {
  /** NA EX súpera majiteľa (Policajtka). */
  readonly naexSupera: number;
  /** NA EX majiteľa (Vychovávateľka, Policajtka). */
  readonly naexVlastne: number;
  /** Karty, ktoré súper zahodil (Hrobár). */
  readonly zahodeniaSupera: number;
}

type DeepMutable<T> = { -readonly [K in keyof T]: DeepMutable<T[K]> };
type MutState = DeepMutable<GameState>;

// ---------------------------------------------------------------------------
// Príkazy a udalosti

export type Command =
  | { readonly type: "chooseLocation"; readonly uid: number; readonly otocena: boolean }
  // Patronát po šenku: staršieho do ruky, kartu z ruky (uid) lícom dole na scorecard.
  | { readonly type: "patronat"; readonly elderId: string; readonly uid: number }
  | { readonly type: "bezPatronatu" }
  // Stavba šenku: z vlastného balíčka stavby karty do šenku a karty naspodok (po dvoch).
  | { readonly type: "stavbaSenku"; readonly doSenku: readonly number[]; readonly odhod: readonly number[] }
  // Branie zo šenku: 1 karta za cigaretu, 2 karty za 3 cigarety (KONSTANTY.CENA_SENKU), alebo koniec brania.
  | { readonly type: "draftBer"; readonly uids: readonly number[] }
  | { readonly type: "draftStop" }
  | { readonly type: "place"; readonly uid: number; readonly target: CielVykladania }
  // Záverečná (roadmapa #83): za cigaretu karta lícom dole na koniec strany;
  // hráč tým v tomto Zhromaždení končí s vykladaním (cigarety za pas nedostane).
  | { readonly type: "zaverecna"; readonly uid: number; readonly target: "vlastna" | "superova" }
  | { readonly type: "pass" }
  | { readonly type: "naex"; readonly uid: number }
  | { readonly type: "skipNaex" }
  // Reakcia na súperovo NA EX: „place“ (jedna karta do línie) alebo nič.
  | { readonly type: "bezReakcie" }
  // Poštárka (Pitka): dober 1 až 2 karty navyše a s nimi 1 Dlh.
  | { readonly type: "postarka"; readonly pocet: number }
  // Starosta (Pitka): za cigaretu vymeň kartu z ruky za kartu zo šenku.
  | { readonly type: "starosta"; readonly rukaUid: number; readonly senokUid: number }
  // Benzínka: vlastní Občania z línie, ktorí sa zahodia.
  | { readonly type: "benzinka"; readonly uids: readonly number[] }
  // Kar (Bitka, roadmapa #80): zahoď jednu nepriznanú Cirhózu z ruky, alebo nič (uid null).
  | { readonly type: "kar"; readonly uid: number | null }
  // Veštica (Prehra): poradové čísla v odhalených doberacích balíčkoch.
  | { readonly type: "vestica"; readonly moja: number; readonly jeho: number }
  // Vízia na konci Pitky: vrchnú kartu doberacieho balíčka do ruky (true), alebo zahodiť (false).
  | { readonly type: "vizia"; readonly vziat: boolean }
  // Zberný dvor (Pitka): za cigaretu karta z vlastného odhadzovacieho balíčka do ruky.
  | { readonly type: "vykup"; readonly uid: number }
  // Cintorín (Prehra): Nástroj z ruky do Dedičstva zadarmo, alebo nič (uid null).
  | { readonly type: "cintorin"; readonly uid: number | null }
  // Živnostník (Výhra): uid súperovho Dedičstva, ktoré víťaz zahodí.
  | { readonly type: "zivnostnik"; readonly uid: number }
  // Záhradkár pri exekúcii (v6, Michal 2026-10-26): zahodiť ho namiesto špakov, alebo nie.
  | { readonly type: "zahradkar"; readonly zahodit: boolean }
  // Hasič (Nástup, Michal 2026-10-26): kartu z odhadzovacieho balíčka si nechať v ruke (true), alebo ju vrátiť (false).
  | { readonly type: "hasic"; readonly nechat: boolean }
  // Kšeft (v7): uid karty v línii alebo lokality; voľba podľa karty (Smetiarka: karta z ruky,
  // Predsedova vila: starší a smer).
  | { readonly type: "kseft"; readonly uid: number; readonly kartaUid?: number; readonly elderId?: string; readonly kSebe?: boolean }
  // Klebetnica (Nástup, v7): uid karty zo súperovej ruky, ktorá ide naspodok jeho balíčka.
  | { readonly type: "klebetnica"; readonly uid: number }
  // Dohadzovačka (Nástup, v7): dvaja starší, ktorým sa vymenia scorecardy.
  | { readonly type: "dohadzovacka"; readonly elderA: string; readonly elderB: string }
  | { readonly type: "smoke"; readonly pocet: number }
  | { readonly type: "barter" }
  | { readonly type: "refillPoldeci" }
  // Pohoršenie (v5 bod 7): marker o 1 k súperovi (bez kSebe), alebo k sebe (kSebe: true).
  | { readonly type: "pohorsenie"; readonly elderId: string; readonly kSebe?: boolean }
  | { readonly type: "prebytok"; readonly elderId: string }
  // Pohreb (pravidlá v4 — zlúčil v sebe Liečbu): spáli priznanú Cirhózu a svoju
  // kartu z línie; za Závislého smie hráč vziať kartu zo šenku (senokUid).
  | { readonly type: "pohreb"; readonly cirhozaUid: number; readonly kartaUid: number; readonly senokUid?: number }
  | { readonly type: "skipPohreb" }
  // Vypiť (pravidlá v3): v Zhromaždení otoč plný poldeci na vypitý — limit
  // klesne o 1, ale ďalšou kartou ťah nekončí (zahráš dve za sebou).
  | { readonly type: "vypit" }
  // Celý ťah v Zhromaždení naraz (Michal 2026-10-19): klient pošle priznania,
  // vyloženia a pred každou ďalšou kartou Vypiť — vykoná sa všetko, alebo nič.
  | { readonly type: "tah"; readonly kroky: readonly Command[] }
  // Vzdať sa smie hráč kedykoľvek, aj mimo svojho ťahu. Kontumáciu (súper
  // dlho odpojený) posiela za odpojeného hráča server.
  | { readonly type: "vzdat"; readonly kontumacia?: boolean };

/** Kam možno v Zhromaždení vyložiť kartu z ruky. */
export type CielVykladania = "vlastna" | "superova" | "priznanie" | "dedicstvo";

export type Event =
  | { readonly type: "log"; readonly text: string; readonly pre?: PlayerId }
  | { readonly type: "faza"; readonly faza: Phase }
  | {
      readonly type: "kartyTahane";
      readonly hrac: PlayerId;
      readonly karty: readonly CardInstance[];
      readonly pre: PlayerId;
    }
  | { readonly type: "tahal"; readonly hrac: PlayerId; readonly pocet: number }
  | {
      readonly type: "manualEfekt";
      readonly defId: string;
      readonly nazov: string;
      readonly text: string;
      readonly hrac: PlayerId | null;
    }
  | {
      readonly type: "bitkaVysledok";
      readonly damage: DamageResult;
      /** Súčty aktívnych akcií oboch partií (línia je verejná) — štatistiky. */
      readonly sums: readonly [ActionSums, ActionSums];
      /** null = sekera: remíza v tuhom aj v Absťákoch aj v Dlhoch. */
      readonly vitaz: PlayerId | null;
      readonly rozhodlo: RozhodnutieBitky;
      readonly prebytok: number;
      /** Prebytok po zľave Pušky — toľko držiteľ naozaj rozdelí. */
      readonly prebytokNaRozdelenie: number;
      readonly prebytokDrzi: PlayerId | null;
      /** Karty v línii pri vyhodnotení (verejné) — štatistiky kariet pre tvorcu. */
      readonly karty: readonly KartaVBitke[];
      /** Rekapitulácia pod Počítadlom bitky (roadmapa #106); chýba v starších záznamoch. */
      readonly rekap?: RekapitulaciaBitky;
    }
  /** Poškodenie pečene započítané k prahu Cirhózy — štatistiky. */
  | { readonly type: "pecen"; readonly hrac: PlayerId; readonly mnozstvo: number }
  /**
   * Účet Pitky (Michal 2026-10-21): čo vyhodnotenie pripísalo obom hráčom —
   * verejné, klient z neho ukáže súhrn po Pitke.
   */
  | {
      readonly type: "pitkaVysledok";
      readonly pitka: number;
      readonly cirhozy: readonly [number, number];
      readonly dlhy: readonly [number, number];
      readonly cigarety: readonly [number, number];
    }
  /**
   * Rekapitulácia Pitky (roadmapa #106) — až po otočení Záverečných, aby počas
   * Vízie neprezradila, čo dáva súperova karta lícom dole.
   */
  | { readonly type: "pitkaRekap"; readonly rekap: RekapitulaciaPitky }
  /** Posun markera staršieho — verejný ako marker sám; klient z neho kreslí stopu a účtenku. */
  | ({ readonly type: "posunMarkera" } & PosunMarkera)
  /** Pečiatka momentu (momenty.ts) — verejná, rovnaká pre oboch; server ju pridá po príkaze. */
  | { readonly type: "moment"; readonly moment: Moment }
  | {
      readonly type: "koniec";
      readonly vitaz: PlayerId | null;
      readonly dovod: string;
      readonly body: readonly [number, number] | null;
    };

/** Udalosti pre konkrétneho hráča — súkromné (pre) vidí len adresát. */
export function eventsFor(events: readonly Event[], hrac: PlayerId): Event[] {
  return events.filter((e) => !("pre" in e) || e.pre === undefined || e.pre === hrac);
}

export class IllegalCommandError extends Error {}

function need(cond: boolean, msg: string): asserts cond {
  if (!cond) throw new IllegalCommandError(msg);
}

// ---------------------------------------------------------------------------
// Pomocníci

function obranca(s: { utocnik: PlayerId }): PlayerId {
  return opponentOf(s.utocnik);
}

/**
 * Bonus z priazne daného typu pre hráča p: NASOBOK_PRIAZNE × sila (2 / 4 / 6),
 * 0, ak ju má súper alebo nikto.
 */
export function priazen(
  data: GameData,
  state: { readonly starsi: readonly ElderState[] },
  favour: Favour,
  p: PlayerId,
): number {
  for (const elder of state.starsi) {
    // Priazeň dáva ukazovateľ (scorecard), nie karta, ktorá na ňom leží —
    // aj po náhrade staršieho.
    if (favourStarsieho(data, elder) === favour && priazenHraca(elder) === p) return KONSTANTY.NASOBOK_PRIAZNE * priazenSila(elder);
  }
  return 0;
}

/**
 * Sila priazne (1 / 2 / 3) daného typu pre hráča p, 0 ak ju nemá. Priazne v5
 * (Michal 2026-10-24/25, miera sily: 1 bod ≈ 1 cigareta za kolo) pôsobia silou,
 * nie dvojnásobkom.
 */
export function silaPriazne(data: GameData, state: { readonly starsi: readonly ElderState[] }, favour: Favour, p: PlayerId): number {
  return priazen(data, state, favour, p) / KONSTANTY.NASOBOK_PRIAZNE;
}

function hrac(s: MutState, p: PlayerId): DeepMutable<PlayerState> {
  return s.hraci[p] as DeepMutable<PlayerState>;
}

function cielLokalita(s: GameState): CardInstance | null {
  return s.ciel?.lokalita ?? null;
}

/** defId lokality, o ktorú sa hrá (aj pinnacle vo finále v7) — null vo finále bez lokality (aj pre klienta). */
export function cielLokalitaId(s: Pick<VerejnyStav, "ciel">): string | null {
  return s.ciel?.lokalita?.defId ?? null;
}

/** Úroveň lokality (v7, plan.md 7.1) = počet akcií na jej hrane: 1 / 2 / 3, pinnacle 4. */
export function urovenLokality(data: GameData, defId: string): number {
  const def = data.cards.get(defId);
  if (def === undefined) return 0;
  return Object.values(def.left.actions).reduce((a, n) => a + (n ?? 0), 0);
}

/** Úroveň pinnacle lokality finále. */
export const UROVEN_FINALE = 4;

/**
 * Rozpis úrovní pre dĺžku hry (plan.md 7.2) s finále na konci; null, keď sada
 * nemá dosť lokalít každej úrovne (stará sada — hrá sa žreb ako do v6).
 */
export function rozpisUrovni(data: GameData, lokalit: number): number[] | null {
  const ROZPISY: Readonly<Record<number, readonly number[]>> = { 3: [1, 2, 3], 5: [1, 2, 2, 3, 3], 7: [1, 1, 2, 2, 3, 3, 3] };
  const rozpis = ROZPISY[lokalit];
  if (rozpis === undefined) return null;
  const s = [...rozpis, UROVEN_FINALE];
  for (const u of new Set(s)) {
    const treba = s.filter((x) => x === u).length;
    if (data.lokality.filter((l) => urovenLokality(data, l.id) === u).length < treba) return null;
  }
  return s;
}

/**
 * Úroveň, z ktorej sa vyberá cieľ (v7): vo Voľbe cieľa úroveň tohto kola,
 * inokedy úroveň ďalšieho kola; null bez rozpisu alebo po finále.
 */
export function urovenNaVyber(s: { readonly rozpis?: readonly number[]; readonly kolo: number; readonly faza: Phase }): number | null {
  if (s.rozpis === undefined) return null;
  return s.rozpis[s.faza === "volbaCiela" ? s.kolo - 1 : s.kolo] ?? null;
}

/** Lokality, z ktorých obranca vyberá cieľ (v7: neodohrané lokality úrovne kola). */
export function lokalityNaVyber(data: GameData, s: Pick<GameState, "lokalityVHre" | "kolo" | "faza"> & { readonly rozpis?: readonly number[] }): CardInstance[] {
  const u = urovenNaVyber(s);
  if (u === null) return [...s.lokalityVHre];
  return s.lokalityVHre.filter((k) => urovenLokality(data, k.defId) === u);
}

/** Finále bez lokality v strede (v6) — prvá karta leží v strede línie. */
export function finaleBezStredu(s: Pick<VerejnyStav, "ciel">): boolean {
  return s.ciel?.typ === "finale" && s.ciel.lokalita === null;
}

/**
 * Línia zo stavu — server aj klienti (ClientState spĺňa VerejnyStav), aby
 * náhľady rátali s tým istým ako bitka (aj s Pascou v Dedičstve).
 */
export function lineState(s: VerejnyStav & { readonly lokalitaOtocena: boolean }): LineState {
  return {
    lokalita: s.ciel?.lokalita ?? null,
    lokalitaOtocena: s.lokalitaOtocena,
    strany: s.strany,
    ...(jeFinale(s) ? { finale: true } : {}),
  };
}

/** Koľko posledných bitiek skončilo sekerou — ich špaky čakajú na víťaza ďalšej bitky. */
export function bitkyNaSekere(nastenka: readonly Pick<BitkaNaNastenke, "vitaz">[]): number {
  let n = 0;
  for (let i = nastenka.length - 1; i >= 0 && nastenka[i]?.vitaz === null; i--) n++;
  return n;
}

/** Hrá sa finále — posledná bitka bez lokality (v6). */
export function jeFinale(s: Pick<VerejnyStav, "ciel">): boolean {
  return s.ciel?.typ === "finale";
}

/**
 * Finále: strana, ktorej prvá karta (strany[p][0]) leží v strede línie; null
 * mimo finále a kým nikto nič nevyložil. Pri jednej neprázdnej strane je to
 * ona, pri dvoch rozhodne stredFinale (prvá vyložená karta).
 */
export function stranaStreduFinale(
  s: Pick<VerejnyStav, "ciel" | "strany"> & { readonly stredFinale?: PlayerId | null },
): PlayerId | null {
  if (!finaleBezStredu(s)) return null;
  const plna = [s.strany[0].length > 0, s.strany[1].length > 0] as const;
  if (!plna[0] && !plna[1]) return null;
  if (plna[0] !== plna[1]) return plna[0] ? 0 : 1;
  return s.stredFinale ?? 0;
}

/**
 * Koľkokrát ešte starší vyplatia špaky za strach (po každej bitke, aj po
 * finále; v6.1 len víťazovi) — so súčasnou bitkou, kým sa v nej nevyplatili. Pre
 * odhady (náhľady, bot): marker, ktorý sa už nepohne, dá toľkokrát svoju zónu
 * hráčovi, ktorý vyhrá každú bitku.
 */
export function vyplatZaStarsich(
  s: Pick<GameState, "lokalityVHre" | "ciel" | "koniec" | "kolo" | "lokalitCelkom"> & { readonly bitkaStav: { readonly damage: unknown } | null; readonly rozpis?: readonly number[] },
): number {
  if (s.koniec !== null) return 0;
  const tato = s.ciel === null ? 0 : s.bitkaStav !== null && s.bitkaStav.damage !== null ? 0 : 1;
  // v7: lokality sa nežrebujú — neodohrané kolá o lokalitu ráta rozpis (kolo k je k-te).
  const zostava = s.rozpis !== undefined ? Math.max(0, s.lokalitCelkom - s.kolo + (s.ciel === null ? 1 : 0)) : s.lokalityVHre.length;
  const finaleUz = s.ciel?.typ === "finale" || (s.rozpis !== undefined && s.kolo > s.lokalitCelkom);
  return zostava + (finaleUz ? 0 : 1) + tato;
}

/** Efekt karty defId patrí hráčovi p a nie je umlčaný (Praudovravec). */
function maEfekt(s: MutState, data: GameData, p: PlayerId, defId: string): boolean {
  return efektHraca(s as GameState, p, defId) && !efektPotlaceny(data, s as GameState, p, defId);
}

/**
 * Hrobár: keď súper zahodí kartu (z ruky alebo z línie, efektom či limitom
 * ruky, aj Pohrebom — nie návratom po bitke), majiteľ Hrobára si
 * dobere cigaretu za kus.
 */
function poZahodeni(s: MutState, data: GameData, p: PlayerId, pocet: number, events: Event[]): void {
  if (pocet <= 0) return;
  const opp = opponentOf(p);
  zapisOdklad(s, opp, "zahodeniaSupera", pocet);
  if (!maEfekt(s, data, opp, "hrobar")) return;
  hrac(s, opp).cigarety += pocet;
  events.push({ type: "log", text: `Hrobár: hráč ${opp + 1} si berie ${cigariet(pocet)} za zahodené karty.` });
}

function tagOf(data: GameData, card: CardInstance): readonly Tag[] {
  return defOf(data, card).tags;
}

function najdiVLinii(s: MutState, uid: number): { strana: PlayerId; index: number } | null {
  for (const p of [0, 1] as const) {
    const i = s.strany[p].findIndex((pl) => pl.card.uid === uid);
    if (i !== -1) return { strana: p, index: i };
  }
  return null;
}

function vezmiZRuky(s: MutState, p: PlayerId, uid: number): CardInstance {
  const idx = hrac(s, p).ruka.findIndex((k) => k.uid === uid);
  need(idx !== -1, "Karta nie je v ruke.");
  return hrac(s, p).ruka.splice(idx, 1)[0] as CardInstance;
}

/** Nová inštancia karty s náhodným variantom. */
function novaInstancia(s: MutState, data: GameData, defId: string): CardInstance {
  const def = data.cards.get(defId);
  if (def === undefined) throw new Error(`Neznáma karta ${defId}`);
  const variants = data.variants.get(defId);
  if (variants === undefined) throw new Error(`Bez variantov ${defId}`);
  const [li, r1] = rngInt(s.rng, variants.left.length);
  const [ri, r2] = rngInt(r1, variants.right.length);
  s.rng = r2;
  return { uid: s.nextUid++, defId, leftLayout: li, rightLayout: ri };
}

/**
 * Keď sa doberací balíček minie, odhadzovací sa zamieša a stane sa z neho nový
 * doberací balíček (PRAVIDLA §4) — pri ťahaní aj pri Veštici. Vracia, či sa miešalo.
 */
function doplnDoberaci(s: MutState, p: PlayerId): boolean {
  const player = hrac(s, p);
  if (player.doberaci.length > 0 || player.odhadzovaci.length === 0) return false;
  const [premiesane, rng] = rngShuffle(s.rng, player.odhadzovaci);
  s.rng = rng;
  player.doberaci = premiesane as DeepMutable<CardInstance>[];
  player.odhadzovaci = [];
  return true;
}

/**
 * Ťahanie z vlastného doberacieho balíčka, s premiešaním odhadzovacieho.
 * Dobratý Dlh sa hneď sám prizná a hráč za neho ťahá ďalšiu kartu — aj tá
 * môže byť Dlh (Michal 2026-10-20, zrýchlenie hry). Vracia karty v ruke.
 */
function tahaj(s: MutState, p: PlayerId, pocet: number, events: Event[]): CardInstance[] {
  const player = hrac(s, p);
  const tahane: CardInstance[] = [];
  let priznane = 0;
  for (let i = 0; i < pocet; i++) {
    doplnDoberaci(s, p);
    const karta = player.doberaci.shift();
    if (karta === undefined) break;
    if (karta.defId === "dlh") {
      // Priznaný Dlh je natrvalo mimo balíčka, takže reťaz sa vždy skončí.
      player.priznane.push(karta);
      priznane += 1;
      i -= 1;
      continue;
    }
    player.ruka.push(karta);
    tahane.push(karta as CardInstance);
  }
  if (priznane > 0) {
    events.push({
      type: "log",
      text: `Hráč ${p + 1} ${rodovo(p, "dobral", "dobrala", "doberá")} ${priznane === 1 ? "Dlh — sám sa priznáva" : `${priznane} Dlhy — samy sa priznávajú`} a hráč za ${priznane === 1 ? "neho" : "ne"} ťahá ďalšiu kartu.`,
    });
  }
  if (tahane.length > 0) {
    events.push({ type: "tahal", hrac: p, pocet: tahane.length });
    events.push({ type: "kartyTahane", hrac: p, karty: tahane, pre: p });
  }
  return tahane;
}

/**
 * Karta mimo ťahania (Zberný dvor) ide do ruky; Dlh sa namiesto toho hneď
 * prizná a hráč si dobere kartu, ako pri ťahaní (Michal 2026-10-20).
 */
function doRuky(s: MutState, p: PlayerId, karta: DeepMutable<CardInstance>, events: Event[]): void {
  if (karta.defId !== "dlh") {
    hrac(s, p).ruka.push(karta);
    return;
  }
  hrac(s, p).priznane.push(karta);
  events.push({ type: "log", text: `Hráč ${p + 1}: Dlh sa sám priznáva a hráč ťahá kartu.` });
  tahaj(s, p, 1, events);
}

/**
 * Nová kliatba (PRAVIDLA §11, „verejný dlh“ Michal 2026-10-21): Dlh sa hneď
 * prizná — ide medzi priznané karty a kartu zaň hráč nedobere; špaky berie
 * len cez Exekútora (v6, §11 a §14). Cirhóza ide do odhadzovacieho balíčka
 * (Michal 2026-10-25; predtým navrch doberacieho) — do ruky príde, až keď sa
 * doberací balíček minie a odhadzovací sa zamieša (tahaj).
 */
function pridajKliatbu(s: MutState, data: GameData, p: PlayerId, defId: string, events: Event[]): void {
  const karta = novaInstancia(s, data, defId) as DeepMutable<CardInstance>;
  if (defId === "dlh") hrac(s, p).priznane.push(karta);
  else hrac(s, p).odhadzovaci.push(karta);
  const text =
    defId === "dlh"
      ? `Hráč ${p + 1} získava Dlh — hneď sa priznáva (ráta sa k prahu Exekútora).`
      : defId === "cirhoza"
        ? `Hráč ${p + 1} získava Cirhózu — ide do jeho odhadzovacieho balíčka.`
        : `Hráč ${p + 1} získava kartu Absťák.`;
  events.push({ type: "log", text });
}

/** Poškodenie pečene + okamžitá Cirhóza pri prahu (PRAVIDLA §8). */
function pridajPecen(
  s: MutState,
  data: GameData,
  p: PlayerId,
  mnozstvo: number,
  events: Event[],
): void {
  if (mnozstvo <= 0) return;
  hrac(s, p).pecen += mnozstvo;
  events.push({ type: "pecen", hrac: p, mnozstvo });
  skontrolujPrahPecene(s, data, p, events);
}

/** Cirhóza za každý dosiahnutý prah pečene — počíta sa len počas Pitky. */
function skontrolujPrahPecene(s: MutState, data: GameData, p: PlayerId, events: Event[]): void {
  const player = hrac(s, p);
  // nealko (Dedičstvo) a Krčma (cieľ kola): prah Cirhózy je vyšší.
  const prah =
    prahCirhozy() + prahCirhozyBonus(s as GameState, p);
  while (player.pecen >= prah) {
    player.pecen -= prah;
    pridajKliatbu(s, data, p, "cirhoza", events);
    s.cirhozyVKole[p] += 1;
    events.push({ type: "log", text: `Hráč ${p + 1} ${rodovo(p, "dosiahol", "dosiahla", "dosahuje")} prah pečene (${prah}) — Cirhóza.` });
  }
}

/** Zadĺženie z akcií Dlh + karta Dlh pri prahu (rovnako ako pečeň a Cirhóza). */
function pridajZadlzenie(s: MutState, data: GameData, p: PlayerId, mnozstvo: number, events: Event[]): void {
  if (mnozstvo <= 0) return;
  const player = hrac(s, p);
  player.zadlzenie += mnozstvo;
  const prah = prahDlhu();
  while (player.zadlzenie >= prah) {
    player.zadlzenie -= prah;
    pridajKliatbu(s, data, p, "dlh", events);
    events.push({ type: "log", text: `Hráč ${p + 1} ${rodovo(p, "dosiahol", "dosiahla", "dosahuje")} prah dlhu (${prah}) — Dlh.` });
  }
}

/**
 * Čo pripíšu karty na stole pri vyhodnotení Pitky (PRAVIDLA §7 kroky 2–3, §8):
 * zadĺženie z aktívnych akcií Dlh (Finančná poradkyňa ich posiela súperovi)
 * a pečeň z akcií Poškodenie pečene a Poldeci. Jeden výpočet pre
 * vyhodnotenie aj náhľad, aby sa nemohli rozísť.
 */
export interface PrirastkyPitky {
  readonly zadlzenie: readonly [number, number];
  readonly poskodeniePecene: readonly [number, number];
  readonly poldeci: readonly [number, number];
}

export function prirastkyPitky(
  data: GameData,
  s: VerejnyStav & { readonly lokalitaOtocena: boolean },
  vyhodnotenie: LineEval = evaluateLine(data, lineState(s)),
): PrirastkyPitky {
  const sums = vyhodnotenie.sums;
  // Milujúca manželka (Pitka, v7 M2): poškodenie pečene majiteľa v Pitke −1 za kus,
  // najprv z akcií Poškodenie pečene, potom z Poldeci.
  const pecen: [number, number] = [sums[0].PoškodeniePečene ?? 0, sums[1].PoškodeniePečene ?? 0];
  const poldeci: [number, number] = [sums[0].Poldeci ?? 0, sums[1].Poldeci ?? 0];
  for (const p of [0, 1] as const) {
    let ubrat = partiaHraca(s, p).filter((pl) => pl.card.defId === "milujuca_manzelka" && pl.zaverecna !== true).length;
    const zPecene = Math.min(ubrat, pecen[p]);
    pecen[p] -= zPecene;
    ubrat -= zPecene;
    poldeci[p] -= Math.min(ubrat, poldeci[p]);
  }
  return {
    zadlzenie: zadlzenieZLinie(data, s, vyhodnotenie),
    poskodeniePecene: pecen,
    poldeci,
  };
}

/** Náhľad konca Pitky pre jedného hráča — „ak sa do konca Pitky na stole nič nezmení“. */
export interface NahladPitkyHraca {
  /** Pečeň a zadĺženie teraz (Vypiť a NA EX sú už pripísané). */
  readonly pecen: number;
  readonly zadlzenie: number;
  /** Čo pripíšu karty na stole. */
  readonly pecenZoStola: number;
  readonly zadlzenieZoStola: number;
  readonly prahPecene: number;
  readonly prahDlhu: number;
  /** Kariet Cirhóza a Dlh po vyhodnotení — za každý celý prah jedna. */
  readonly cirhozy: number;
  readonly dlhy: number;
}

/**
 * Náhľad vyhodnotenia Pitky (Michal 2026-10-21, dizajn hra-nezrovnalosti):
 * počítadlá pečene a zadĺženia ukazujú stav „po Pitke“, nie „doteraz“.
 * Ten istý výpočet ako vyhodnotPitku — test pitka-nahlad.test.ts.
 */
export function nahladPitky(
  data: GameData,
  s: VerejnyStav & {
    readonly lokalitaOtocena: boolean;
    readonly hraci: readonly [VerejnyHrac & PecenHraca, VerejnyHrac & PecenHraca];
    readonly vizia: GameState["vizia"];
  },
): readonly [NahladPitkyHraca, NahladPitkyHraca] {
  const pr = prirastkyPitky(data, s);
  // Vo Vízii je Pitka už vyhodnotená — karty na stole pečeň a zadĺženie pripísali
  // a nulujú sa až v dokonciPitku. Rátať ich znova hlásilo kliatby, ktoré nevzniknú
  // (playtest 20261021-143600).
  const vyhodnotena = s.vizia !== null;
  const pre = (p: PlayerId): NahladPitkyHraca => {
    const prahPecene = prahCirhozy() + prahCirhozyBonus(s, p);
    const prahD = prahDlhu();
    const pecenZoStola = vyhodnotena ? 0 : pr.poskodeniePecene[p] + pr.poldeci[p];
    const zadlzenieZoStola = vyhodnotena ? 0 : pr.zadlzenie[p];
    const h = s.hraci[p];
    return {
      pecen: h.pecen,
      zadlzenie: h.zadlzenie,
      pecenZoStola,
      zadlzenieZoStola,
      prahPecene,
      prahDlhu: prahD,
      cirhozy: Math.floor((h.pecen + pecenZoStola) / prahPecene),
      dlhy: Math.floor((h.zadlzenie + zadlzenieZoStola) / prahD),
    };
  };
  return [pre(0), pre(1)];
}

interface PecenHraca {
  readonly pecen: number;
  readonly zadlzenie: number;
}

function pocetKariet(player: VerejnyHrac, defId: string, kde: "priznane"): number {
  return player[kde].filter((k) => k.defId === defId).length;
}

/** Absťáky hráča mimo ruky: priznané aj vyložené v partiách (jeho karty). */
export function verejneAbstaky(s: VerejnyStav, p: PlayerId): number {
  let n = s.hraci[p].priznane.filter((k) => k.defId === "abstak").length;
  for (const partia of s.strany) {
    for (const pl of partia) if (pl.playedBy === p && pl.card.defId === "abstak") n++;
  }
  return n;
}

/**
 * Absťáky, ktoré sa hráčovi v bitke rátajú: o toľko mu znížia tuhé poškodenie
 * a rozhodujú remízu aj špaky víťaza. Autobusár jeden ignoruje všade
 * (Michal 2026-10-26, variant A).
 */
export function abstakyVBitke(data: GameData, s: VerejnyStav, p: PlayerId, vRuke: number): number {
  return Math.max(0, verejneAbstaky(s, p) + vRuke - bitkaMody(data, s, p).abstakyZlava);
}

/** Cirhózy hráča p vyložené v línii (jeho karty = jeho postihy). */
/**
 * Cirhózy, za ktoré súper hráča p v bitke udrie navyše — jeho PRIZNANÉ
 * Cirhózy (Michal 2026-10-20; predtým len Cirhózy v línii, kam už kliatba
 * nesmie). Za každú dostane súper +1 tuhé.
 */
function cirhozyPriznane(s: VerejnyStav, p: PlayerId): number {
  return pocetKariet(s.hraci[p], "cirhoza", "priznane");
}

/**
 * Poškodenie bitky zo súčtov aktívnych akcií (PRAVIDLA §9.3). Server ho
 * volá pri vyhodnotení, klient pre živý odhad nad aktuálnou líniou.
 * Absťáky v ruke sú tajné — klient pozná len svoje, súperove dá 0.
 */
export function poskodenieBitky(
  data: GameData,
  s: VerejnyStav,
  sums: readonly [ActionSums, ActionSums],
  abstakyVRuke: readonly [number, number],
): DamageResult {
  return computeDamage(stranyBitky(data, s, sums, abstakyVRuke));
}

function stranyBitky(
  data: GameData,
  s: VerejnyStav,
  sums: readonly [ActionSums, ActionSums],
  abstakyVRuke: readonly [number, number],
): [BattleSide, BattleSide] {
  const mody = ([0, 1] as const).map((p) => bitkaMody(data, s, p));
  const strana = (p: PlayerId): BattleSide => {
    const opp = opponentOf(p);
    // farár súpera časť Povier ignoruje.
    const povera = Math.max(0, (sums[p].Povera ?? 0) - mody[opp]!.superovePoveryZlava);
    // Veriaci (Michal 2026-10-20): Viera navyše rovná sile priazne, nie vyššia
    // hodnota každej Viery — dve Viery s priazňou 2 dávali štít 10.
    const vieraNavyse = priazen(data, s, "VERIACI", p) / KONSTANTY.NASOBOK_PRIAZNE;
    return {
      sums: { ...sums[p], Povera: povera, ...(vieraNavyse > 0 ? { Viera: (sums[p].Viera ?? 0) + vieraNavyse } : {}) },
      cirhozaBonus: Math.max(0, cirhozyPriznane(s, opp) - mody[p]!.cirhozaZlava),
      tuheBonus: mody[p]!.tuheBonus,
      tuheZlava: mody[p]!.tuheZlava,
      // Čierna mačka: Povery bez stropu (Výpalník, predtým Neprajník, vo v5 strop nezdvíha — má Výpalné).
      makkeNadDlhy: vPartii(s, p, "cierna_macka") ? Number.POSITIVE_INFINITY : 0,
      abstaky: abstakyVBitke(data, s, p, abstakyVRuke[p]),
      priznaneDlhy: pocetKariet(s.hraci[p], "dlh", "priznane"),
      // Bitkár v5 (Michal 2026-10-24): +1 / +2 / +3 tuhého, nie dvojnásobok.
      priazenBitkara: silaPriazne(data, s, "BITKAR", p),
      // svaty_text (Dedičstvo): hodnota tvojej Viery je vyššia.
      hodnotaViery: hodnotaViery() + (vDedicstve(s, p, "svaty_text") ? KONSTANTY.EFEKT.SVATY_TEXT_VIERA : 0),
    };
  };
  return [strana(0), strana(1)];
}

/** Položka rozpisu poškodenia: zdroj (id karty, priazne či pojmu) a o koľko mení hodnotu. */
export interface PolozkaRozpisu {
  readonly zdroj: string;
  readonly hodnota: number;
}

/**
 * Rozpis poškodenia hráča — z čoho sa skladá tuhé a mäkké poškodenie (Michal
 * 2026-10-20: každá prírastok a úbytok má byť v paneli bitky vidno).
 */
export interface RozpisPoskodenia {
  /** Rana ×1 + Pecka ×2 + Petelica ×3. */
  readonly zAkcii: number;
  /** Tuhé navyše (karty, lokalita, priazeň Bitkára, súperove Cirhózy). */
  readonly bonusy: readonly PolozkaRozpisu[];
  /** Tuhé menej (súperova nezrušená Viera, vlastné Absťáky) — hodnoty kladné. */
  readonly zrazky: readonly PolozkaRozpisu[];
  /** Hodnota jednej mojej Viery (1 + Svätý text); Veriaci pridáva Vieru navyše, nie hodnotu. */
  readonly hodnotaViery: number;
  /** Moja Viera, ktorú zrušili súperove Povery, a moje Povery zrušené súperovou Vierou. */
  readonly zrusenaViera: number;
  readonly zrusenaPovera: number;
  /** Koľko mojich Povier súperov Farár ignoruje. */
  readonly poveraIgnorovana: number;
  /** Strop mäkkého poškodenia (súperove priznané Dlhy + priazeň Neprajníka); Infinity = bez stropu. */
  readonly makkeStrop: number;
}

export function rozpisPoskodenia(
  data: GameData,
  s: VerejnyStav,
  sums: readonly [ActionSums, ActionSums],
  abstakyVRuke: readonly [number, number],
): readonly [RozpisPoskodenia, RozpisPoskodenia] {
  const strany = stranyBitky(data, s, sums, abstakyVRuke);
  const dmg = computeDamage(strany);
  const rozpis = (p: PlayerId): RozpisPoskodenia => {
    const q = opponentOf(p);
    const ja = strany[p];
    const su = strany[q];
    const bonusy: PolozkaRozpisu[] = bitkaMody(data, s, p).tuheZdroje.map((z) => ({ zdroj: z.zdroj, hodnota: z.tuhe }));
    if (ja.cirhozaBonus > 0) bonusy.push({ zdroj: "cirhoza", hodnota: ja.cirhozaBonus });
    if (ja.priazenBitkara > 0) bonusy.push({ zdroj: "BITKAR", hodnota: ja.priazenBitkara });
    const zrazky: PolozkaRozpisu[] = [];
    if (dmg.zvysnaViera[q] > 0) zrazky.push({ zdroj: "Viera", hodnota: dmg.zvysnaViera[q] * su.hodnotaViery });
    if ((ja.tuheZlava ?? 0) > 0) zrazky.push({ zdroj: "pasca", hodnota: ja.tuheZlava ?? 0 });
    if (ja.abstaky > 0) zrazky.push({ zdroj: "abstak", hodnota: ja.abstaky });
    return {
      zAkcii: (ja.sums.Rana ?? 0) + 2 * (ja.sums.Pecka ?? 0) + 3 * (ja.sums.Petelica ?? 0),
      bonusy,
      zrazky,
      hodnotaViery: ja.hodnotaViery,
      zrusenaViera: (ja.sums.Viera ?? 0) - dmg.zvysnaViera[p],
      zrusenaPovera: (ja.sums.Povera ?? 0) - dmg.zvysnaPovera[p],
      poveraIgnorovana: (sums[p].Povera ?? 0) - (ja.sums.Povera ?? 0),
      makkeStrop: su.priznaneDlhy + (ja.makkeNadDlhy ?? 0),
    };
  };
  return [rozpis(0), rozpis(1)];
}

/** Prahy, ku ktorým hráč smeruje — Cirhóza (pečeň), Dlh (zadĺženie) a Exekútor (priznané Dlhy). */
export function prahyHraca(
  data: GameData,
  s: VerejnyStav,
  p: PlayerId,
): { readonly cirhoza: number; readonly dlh: number; readonly exekutor: number; readonly priznaneDlhy: number } {
  return {
    // nealko (Dedičstvo) a Krčma (cieľ kola): prah Cirhózy je vyšší.
    cirhoza: prahCirhozy() + prahCirhozyBonus(s, p),
    dlh: prahDlhu(),
    // obecny_urad: prah Exekútora je o 4 nižší; súperov Exekútor (v5) o svoju silu.
    exekutor: prahExekutora(silaPriazne(data, s, "EXEKUTOR", opponentOf(p))) - exekutorLokality(s, p).zlava,
    priznaneDlhy: pocetKariet(s.hraci[p], "dlh", "priznane"),
  };
}

/** MANUAL pripomienky efektov kariet v hre pre daný spúšťač. */
function manualEfekty(s: MutState, data: GameData, trigger: string, events: Event[]): void {
  const pripomen = (card: CardInstance, hracEfektu: PlayerId | null): void => {
    const def = defOf(data, card);
    if (!def.triggers.includes(trigger as CardDef["triggers"][number])) return;
    if (!jeEfektManual(def.id)) return;
    // Praudovravec: Autority v tej istej partii efekt neuplatňujú.
    if (hracEfektu !== null && efektPotlaceny(data, s as GameState, hracEfektu, def.id)) return;
    events.push({
      type: "manualEfekt",
      defId: def.id,
      nazov: def.name,
      text: def.effectText,
      hrac: hracEfektu,
    });
  };
  for (const p of [0, 1] as const) {
    for (const pl of partiaHraca(s, p)) pripomen(pl.card as CardInstance, p);
    for (const k of s.hraci[p].dedicstvo) pripomen(k as CardInstance, p);
    for (const k of s.hraci[p].priznane) pripomen(k as CardInstance, p);
  }
  const lok = cielLokalita(s);
  if (lok !== null) pripomen(lok, null);
  for (const elder of s.starsi) {
    const pre = prebudenyPre(elder as ElderState);
    if (pre !== null) pripomen(elder.karta as CardInstance, pre);
  }
}

// ---------------------------------------------------------------------------
// Setup

export interface SetupOptions {
  /** Počet lokalít v hre — dĺžka hry (DLZKY_HRY); predvolene stredná. */
  readonly lokalit?: number;
}

/** Dĺžky hry, na ktoré má sada dosť lokalít. */
export function dostupneDlzky(data: GameData): DlzkaHry[] {
  return ALL_DLZKY.filter((d) => DLZKY_HRY[d] <= data.lokality.length);
}

export function setupGame(data: GameData, seed: number, opts?: SetupOptions): GameState {
  const s: MutState = {
    rng: rngSeed(seed),
    nextUid: 1,
    faza: "volbaCiela",
    kolo: 1,
    utocnik: 0,
    hraci: [freshPlayer(), freshPlayer()] as MutState["hraci"],
    spolocnyBalicek: [],
    senok: [],
    lokalityVHre: [],
    lokalitCelkom: 0,
    spaky: [0, 0],
    spakyNaSekere: 0,
    nastenka: [],
    naexVKole: [false, false],
    starsi: [],
    ciel: null,
    lokalitaOtocena: false,
    strany: [[], []],
    pitkyCelkom: 0,
    pitkaCislo: 0,
    dedicstvaVylozene: 0,
    cirhozyVKole: [0, 0],
    draftStav: null,
    zhromazdenieStav: null,
    pitkaStav: null,
    bitkaStav: null,
    koniec: null,
    vizia: null,
    ohlaseneVydesenie: [null, null],
    patronat: [null, null],
    zaverecnaOdklad: [null, null],
    posunyMarkerov: [],
    pitkyKola: [],
    zaciatokPitky: null,
  };

  // Náhodný útočník prvého kola (PRAVIDLA §3, §4).
  const [prvy, rng0] = rngInt(s.rng, 2);
  s.rng = rng0;
  s.utocnik = prvy as PlayerId;

  // Starší — každý s konkrétnym variantom karty, na náhodne rozdanom
  // scorecarde (ten určuje priazeň aj bodovacie podmienky).
  const [scorecardy, rngSc] = rngShuffle(s.rng, data.scorecards);
  s.rng = rngSc;
  [...data.elders.values()].forEach((elderDef, i) => {
    const karta = novaInstancia(s, data, elderDef.id);
    const sc = scorecardy[i];
    if (sc === undefined) throw new Error("Chybné dáta: menej scorecardov ako starších.");
    s.starsi.push(freshElder(elderDef.id, karta, sc.id) as DeepMutable<ElderState>);
  });

  // Lokality: v7 podľa úrovní (všetky v hre, obranca vyberá z úrovne kola), inak náhodný výber.
  const pocetLokalit = opts?.lokalit ?? DLZKY_HRY[PREDVOLENA_DLZKA];
  if (pocetLokalit > data.lokality.length) {
    throw new Error(`Sada má len ${data.lokality.length} lokalít, hra potrebuje ${pocetLokalit}.`);
  }
  s.lokalitCelkom = pocetLokalit;
  const rozpis = rozpisUrovni(data, pocetLokalit);
  if (rozpis !== null) {
    s.rozpis = rozpis;
    for (const def of data.lokality) s.lokalityVHre.push(novaInstancia(s, data, def.id) as DeepMutable<CardInstance>);
  } else {
    const [poradieLokalit, rng1] = rngShuffle(s.rng, data.lokality);
    s.rng = rng1;
    for (const def of poradieLokalit.slice(0, pocetLokalit)) {
      s.lokalityVHre.push(novaInstancia(s, data, def.id) as DeepMutable<CardInstance>);
    }
  }

  // Spoločný doberací balíček: kópie všetkých kariet okrem lokalít,
  // starešinov, čistých kliatob (tie vznikajú akciami) a štartoviek
  // (Michal 2026-10-18: sú výhradne v štartovacích balíčkoch).
  const KLIATBY = new Set(["dlh", "cirhoza", "abstak"]);
  const spolocne: CardInstance[] = [];
  for (const def of data.cards.values()) {
    if (def.tags.includes("Lokalita") || def.tags.includes("Starešina")) continue;
    if (KLIATBY.has(def.id) || def.id in KONSTANTY.START_RUKA) continue;
    for (let i = 0; i < KONSTANTY.KOPIE_V_SPOLOCNOM_BALICKU; i++) {
      spolocne.push(novaInstancia(s, data, def.id));
    }
  }
  const [zamiesane, rng2] = rngShuffle(s.rng, spolocne);
  s.rng = rng2;
  s.spolocnyBalicek = zamiesane as DeepMutable<CardInstance>[];

  // Počiatočná ruka (v6, Michal 2026-10-26): štartovacie karty idú rovno do
  // ruky, doberací balíček je prázdny — naplní ho až odhadzovací.
  for (const p of [0, 1] as const) {
    for (const [defId, pocet] of Object.entries(KONSTANTY.START_RUKA)) {
      for (let i = 0; i < pocet; i++) hrac(s, p).ruka.push(novaInstancia(s, data, defId) as DeepMutable<CardInstance>);
    }
  }

  // Šenok sa na začiatku nevykladá — postavia ho hráči v prvom drafte.
  return s as GameState;
}

/**
 * Pevné rozdanie výučby (Michal 2026-10-23): z bežného rozdania podľa seedu
 * prepíše to, čo scenár určí — lokality v poradí, scorecardy, útočníka, ruky,
 * doberacie balíčky a spoločný balíček. Karty dostanú nové uid a variant
 * „defId/ľavý/pravý“ (predvolene 0/0), aby scenár presne vedel, kde sú akcie.
 */
export function setupZRozdania(data: GameData, r: Rozdanie): GameState {
  if (r.lokality.length === 0) throw new Error("Rozdanie nemá žiadnu lokalitu.");
  const s = structuredClone(setupGame(data, r.seed, { lokalit: r.lokality.length })) as MutState;
  const karta = (ref: string): DeepMutable<CardInstance> => {
    const [defId = "", l = "0", p = "0"] = ref.split("/");
    const variants = data.variants.get(defId);
    if (!data.cards.has(defId) || variants === undefined) throw new Error(`Rozdanie: neznáma karta „${defId}“.`);
    const li = Number(l);
    const ri = Number(p);
    if (!(li >= 0 && li < variants.left.length && ri >= 0 && ri < variants.right.length)) {
      throw new Error(`Rozdanie: karta „${defId}“ má ${variants.left.length}×${variants.right.length} variantov, nie ${li}/${ri}.`);
    }
    return { uid: s.nextUid++, defId, leftLayout: li, rightLayout: ri };
  };
  s.utocnik = r.utocnik;
  s.lokalitCelkom = r.lokality.length;
  // Výučba má lokality v pevnom poradí — hrá sa bez rozpisu úrovní.
  delete s.rozpis;
  s.lokalityVHre = r.lokality.map((id) => {
    if (!(data.cards.get(id.split("/")[0] ?? "")?.tags ?? []).includes("Lokalita")) throw new Error(`Rozdanie: „${id}“ nie je lokalita.`);
    return karta(id);
  });
  for (const elder of s.starsi) {
    const ref = r.scorecardy?.[elder.elderId];
    if (ref === undefined) continue;
    // Scorecard podľa id, alebo podľa priazne (UZERNIK…) — id sa medzi sadami
    // líšia (tvorca má „ocumovatel“, jadro „zberatel“), priazeň nie.
    const priazen = priazenZKluca(ref);
    const sc = data.scorecards.find((x) => x.id === ref) ?? data.scorecards.find((x) => priazen !== null && x.favour === priazen);
    if (sc === undefined) throw new Error(`Rozdanie: neznámy scorecard „${ref}“.`);
    elder.scorecard = sc.id;
  }
  for (const p of [0, 1] as const) {
    const h = r.hraci[p];
    hrac(s, p).ruka = h.ruka.map(karta);
    hrac(s, p).doberaci = h.doberaci.map(karta);
    hrac(s, p).odhadzovaci = [];
    if (h.cigarety !== undefined) hrac(s, p).cigarety = h.cigarety;
  }
  if (r.spolocnyBalicek !== undefined) s.spolocnyBalicek = r.spolocnyBalicek.map(karta);
  // Ďalšia náhoda (zamiešanie odhodených) len zo seedu scenára — nie zo stavu
  // po bežnom rozdaní, ktorý závisí od počtu kariet v sade (sada v11 ho zmenila).
  s.rng = rngSeed(r.seed);
  return s as GameState;
}

// ---------------------------------------------------------------------------
// Kto je na ťahu

export function naTahu(state: GameState): PlayerId | null {
  if (state.koniec !== null) return null;
  const hasic = state.hasicVolby?.[0];
  if (hasic !== undefined) return hasic.hrac;
  return naTahuVoFaze(state);
}

/** Kto je na ťahu podľa fázy — bez čakania na voľbu Hasiča. */
function naTahuVoFaze(state: GameState): PlayerId | null {
  switch (state.faza) {
    case "volbaCiela":
      // Cieľ kola vyberá a natáča obranca, vykladať začína útočník (Michal 2026-10-20).
      return obranca(state);
    case "draft": {
      const d = state.draftStav;
      if (d === null) return null;
      // Stavbu šenku hrajú obaja naraz (mozeHrat); naTahu ukazuje toho, na
      // koho sa ešte čaká — obrancu skôr.
      if (d.krok === "stavba") return d.vyber[obranca(state)] === null ? obranca(state) : state.utocnik;
      return d.naTahu;
    }
    case "zhromazdenie":
      return state.zhromazdenieStav?.naTahu ?? null;
    case "pitka":
      if (state.vizia !== null) return viziaNaTahu(state);
      return state.pitkaStav?.naTahu ?? null;
    case "bitka":
      return state.bitkaStav?.caka ?? null;
    default:
      return null;
  }
}

/**
 * Smie hráč p teraz poslať príkaz? Zvyčajne len ten na ťahu; stavbu šenku
 * však hrajú obaja naraz — každý, kto v tomto kroku ešte nevybral.
 */
export function mozeHrat(state: GameState, p: PlayerId): boolean {
  if (state.koniec !== null) return false;
  if (cakaHasic(state)) return naTahu(state) === p;
  if (state.faza === "draft" && state.draftStav?.krok === "stavba") {
    return state.draftStav.vyber[p] === null;
  }
  return naTahu(state) === p;
}

// ---------------------------------------------------------------------------
// apply

export function apply(
  data: GameData,
  state: GameState,
  cmd: Command,
  hracId: PlayerId,
): { state: GameState; events: Event[] } {
  return applyPrikaz(data, state, cmd, hracId, false);
}

/** `vTahu`: krok ťahu poslaného naraz — Hasič vyložený skôr v tom istom ťahu ho nezastaví. */
function applyPrikaz(
  data: GameData,
  state: GameState,
  cmd: Command,
  hracId: PlayerId,
  vTahu: boolean,
): { state: GameState; events: Event[] } {
  need(state.koniec === null, "Hra sa skončila.");
  const s = structuredClone(state) as MutState;
  const events: Event[] = [];

  if (cmd.type === "tah") {
    // Atomicky: pri chybe ktoréhokoľvek kroku sa nevykoná nič. Okrem Zhromaždenia
    // aj celý prebytok jedným klikom (roadmapa #9 B, Michal 2026-10-22).
    const prebytok = state.faza === "bitka" && state.bitkaStav?.krok === "prebytok";
    need(state.faza === "zhromazdenie" || prebytok, "Celý ťah naraz sa hrá len v Zhromaždení alebo pri prebytku.");
    need(!cakaHasic(state), HASIC_NAJPRV);
    need(cmd.kroky.length > 0, "Ťah je prázdny.");
    let st = state;
    const vsetky: Event[] = [];
    for (const k of cmd.kroky) {
      if (prebytok) {
        need(k.type === "prebytok", "Pri prebytku smú byť v ťahu len posuny markerov.");
        need(st.faza === "bitka" && st.bitkaStav?.krok === "prebytok" && st.bitkaStav.caka === hracId, "Prebytok sa minul skôr, než si posunul všetky markery.");
      } else {
        need(k.type === "place" || k.type === "vypit" || k.type === "zaverecna", "V ťahu smú byť len vyloženia, Vypiť a Záverečná.");
        // O vytiahnutej karte Hasiča hráč rozhodne po zvyšku ťahu (ten poslal skôr, než ju videl);
        // ťah sa preto posudzuje bez čakania na Hasiča.
        need(st.faza === "zhromazdenie" && naTahuVoFaze(st) === hracId, "Ťah sa skončil skôr, než si vyložil všetky karty.");
      }
      const r = applyPrikaz(data, st, k, hracId, true);
      st = r.state;
      vsetky.push(...r.events);
    }
    return { state: st, events: vsetky };
  }

  if (cmd.type === "vzdat") {
    const dovod = cmd.kontumacia === true ? `Kontumácia: Hráč ${hracId + 1} je dlho odpojený.` : `Partiu vzdáva Hráč ${hracId + 1}.`;
    ukonciHru(s, data, opponentOf(hracId), dovod, events);
    return { state: s as GameState, events };
  }

  need(mozeHrat(state, hracId), "Nie si na ťahu.");
  need(state.vizia === null || cmd.type === "vizia", "Najprv rozhodni o karte z Vízie.");
  need(!cakaHasic(state) || cmd.type === "hasic" || cmd.type === "klebetnica" || cmd.type === "dohadzovacka" || vTahu, HASIC_NAJPRV);

  switch (cmd.type) {
    case "chooseLocation":
      cmdChooseLocation(s, data, cmd, hracId, events);
      break;
    case "patronat":
      cmdPatronat(s, data, cmd, hracId, events);
      break;
    case "bezPatronatu":
      cmdBezPatronatu(s, data, hracId, events);
      break;
    case "stavbaSenku":
      cmdStavbaSenku(s, data, cmd, hracId, events);
      break;
    case "draftBer":
      cmdDraftBer(s, data, cmd, hracId, events);
      break;
    case "draftStop":
      cmdDraftStop(s, data, hracId, events);
      break;
    case "place":
      if (s.faza === "pitka") cmdReakcia(s, data, cmd, hracId, events);
      else cmdPlace(s, data, cmd, hracId, events);
      break;
    case "zaverecna":
      cmdZaverecna(s, data, cmd, hracId, events);
      break;
    case "bezReakcie":
      cmdBezReakcie(s, data, hracId, events);
      break;
    case "postarka":
      cmdPostarka(s, data, cmd, hracId, events);
      break;
    case "starosta":
      cmdStarosta(s, data, cmd, hracId, events);
      break;
    case "kar":
      cmdKar(s, data, cmd, hracId, events);
      break;
    case "benzinka":
      cmdBenzinka(s, data, cmd, hracId, events);
      break;
    case "vestica":
      cmdVestica(s, data, cmd, hracId, events);
      break;
    case "vizia":
      cmdVizia(s, data, cmd, hracId, events);
      break;
    case "vykup":
      cmdVykup(s, data, cmd, hracId, events);
      break;
    case "cintorin":
      cmdCintorin(s, data, cmd, hracId, events);
      break;
    case "zivnostnik":
      cmdZivnostnik(s, data, cmd, hracId, events);
      break;
    case "pass":
      cmdPass(s, data, hracId, events);
      break;
    case "vypit":
      cmdVypit(s, data, hracId, events);
      break;
    case "naex":
      cmdNaex(s, data, cmd, hracId, events);
      break;
    case "skipNaex":
      cmdSkipNaex(s, data, hracId, events);
      break;
    case "smoke":
      cmdSmoke(s, cmd, hracId, events);
      break;
    case "barter":
      cmdBarter(s, data, hracId, events);
      break;
    case "refillPoldeci":
      cmdRefill(s, data, hracId, events);
      break;
    case "zahradkar":
      cmdZahradkar(s, data, cmd, hracId, events);
      break;
    case "hasic":
      cmdHasic(s, data, cmd, hracId, events);
      break;
    case "kseft":
      cmdKseft(s, data, cmd, hracId, events);
      break;
    case "klebetnica":
      cmdKlebetnica(s, data, cmd, hracId, events);
      break;
    case "dohadzovacka":
      cmdDohadzovacka(s, data, cmd, hracId, events);
      break;
    case "pohorsenie":
      cmdPohorsenie(s, data, cmd, hracId, events);
      break;
    case "prebytok":
      cmdPrebytok(s, data, cmd, hracId, events);
      break;
    case "pohreb":
      cmdPohreb(s, data, cmd, hracId, events);
      break;
    case "skipPohreb":
      cmdSkipPohreb(s, data, hracId, events);
      break;
  }

  aktualizujPitky(s, data);
  dohrajNevyhnutne(data, s, events);
  // Nevyhnutné ťahy smú odkryť NA EX (hotovo za hráča) — aj to mení počet Pitiek.
  aktualizujPitky(s, data);
  events.push(...zaznamyPriazne(data, state, s as GameState));
  return { state: s as GameState, events };
}

/**
 * Záznam do logu, keď hráčovi pribudne priazeň staršieho (posun markera k nemu).
 * Michal 2026-10-23: klient ju oznamuje toastom a celé znenie má byť v Logu —
 * ako udalosť servera ostane aj po obnovení stránky (história miestnosti).
 */
export function zaznamyPriazne(data: GameData, pred: GameState, po: GameState): Event[] {
  const out: Event[] = [];
  for (const e of po.starsi) {
    const komu = priazenHraca(e);
    if (komu === null) continue;
    const a = pred.starsi.find((x) => x.elderId === e.elderId);
    const sila = priazenSila(e);
    if (a !== undefined && priazenHraca(a) === komu && priazenSila(a) >= sila) continue;
    out.push({ type: "log", text: `♥ Hráč ${komu + 1} dostáva priazeň ${defOf(data, e.karta).name} (${scorecardStarsieho(data, e).nazov}) sily ${sila}.` });
  }
  return out;
}

/**
 * Pitky v bitke (Michal 2026-10-19): 1 + menší z počtov aktivovaných akcií
 * karty v strede (lokalita, v bitke o staršieho jeho karta) na jej dvoch
 * stranách. Kto aktivuje 3 akcie lokality a súper 1, pijú sa 2 Pitky.
 */
export function pocetPitiek(data: GameData, state: VerejnyStav & { readonly lokalitaOtocena: boolean }): number {
  // Finále bez lokality má vždy 3 Pitky (v6); na pinnacle (v7) platí to isté pravidlo ako inde.
  if (finaleBezStredu(state)) return KONSTANTY.FINALE_PITKY;
  if (state.ciel?.lokalita == null) return 1;
  const [a, b] = evaluateLine(data, lineState(state)).aktivneStredu;
  // Kohút (Furt, v7): kým leží v línii, kolo má aspoň 2 Pitky.
  const kohut = vPartii(state, 0, "kohut") || vPartii(state, 1, "kohut");
  return Math.max(kohut ? 2 : 1, 1 + Math.min(a, b));
}

/** Počet Pitiek sa mení s líniou, už začaté Pitky však ostávajú. */
function aktualizujPitky(s: MutState, data: GameData): void {
  if (s.faza !== "zhromazdenie" && s.faza !== "pitka") return;
  // V Zhromaždení sa už chystá ďalšia Pitka (pitkaCislo ráta odohrané).
  const zacate = s.faza === "zhromazdenie" ? s.pitkaCislo + 1 : s.pitkaCislo;
  s.pitkyCelkom = Math.max(zacate, pocetPitiek(data, s as GameState));
}

/**
 * Ťahy bez voľby odohrá hra sama (Michal 2026-10-12): keď je jediná možnosť
 * pasovať, preskočiť NA EX alebo Pohreb, hráč na to nemusí klikať. Tretina
 * príkazov playtestu 20261011-183315 boli práve takéto potvrdenia.
 */
function dohrajNevyhnutne(data: GameData, s: MutState, events: Event[]): void {
  for (;;) {
    const p = naTahu(s as GameState);
    if (p === null) return;
    const moznosti = legalCommands(data, s as GameState, p);
    const jedina = moznosti.length === 1 ? moznosti[0] : undefined;
    if (jedina?.type === "pass") {
      events.push({ type: "log", text: `Hráč ${p + 1} už nemá čo vyložiť.` });
      cmdPass(s, data, p, events);
    } else if (jedina?.type === "skipNaex") {
      // Len pre hráča (pravidlo 2): po skrytom NA EX býva „hotovo“ jediný ťah, takže
      // verejné „nemá čo urobiť“ prezrádzalo, že NA EX padlo (playtest 20261027-062058).
      // Súper vidí to isté „končí svoju časť Pitky“ ako pri ručnom hotovo.
      events.push({
        type: "log",
        pre: p,
        text:
          skryteHraca(s.pitkaStav, p).length > 0
            ? "Po skrytom NA EX už v Pitke nemáš čo urobiť — tvoja časť Pitky sa končí."
            : "V Pitke už nemáš čo urobiť — tvoja časť Pitky sa končí.",
      });
      cmdSkipNaex(s, data, p, events);
    } else if (jedina?.type === "skipPohreb") {
      cmdSkipPohreb(s, data, p, events);
    } else if (jedina?.type === "bezReakcie") {
      cmdBezReakcie(s, data, p, events);
    } else if (jedina?.type === "draftStop") {
      if (s.senok.length > 0) events.push({ type: "log", text: `Hráč ${p + 1} nemá cigaretu na kartu zo šenku.` });
      cmdDraftStop(s, data, p, events);
    } else if (jedina?.type === "bezPatronatu") {
      const dovod = dovodBezPatronatu(data, s as GameState, p);
      if (dovod !== null) events.push({ type: "log", pre: p, text: dovod });
      cmdBezPatronatu(s, data, p, events, true);
    } else {
      return;
    }
  }
}

// ---------------------------------------------------------------------------
// Voľba cieľa a draft

function cmdChooseLocation(
  s: MutState,
  data: GameData,
  cmd: { uid: number; otocena: boolean },
  p: PlayerId,
  events: Event[],
): void {
  need(s.faza === "volbaCiela", "Teraz sa nevyberá cieľ.");
  need(lokalityNaVyber(data, s as GameState).some((k) => k.uid === cmd.uid), "Takú lokalitu teraz vybrať nemožno.");
  const idx = s.lokalityVHre.findIndex((k) => k.uid === cmd.uid);
  const karta = s.lokalityVHre.splice(idx, 1)[0] as CardInstance;
  const finale = s.rozpis !== undefined && s.kolo > s.lokalitCelkom;
  s.ciel = finale ? { typ: "finale", lokalita: karta as DeepMutable<CardInstance> } : { typ: "lokalita", lokalita: karta as DeepMutable<CardInstance> };
  s.lokalitaOtocena = cmd.otocena;
  events.push({
    type: "log",
    text: `Hráč ${p + 1} ${rodovo(p, "vybral", "vybrala", "vyberá")} ${finale ? "pre finále lokalitu" : "bitku o lokalitu"} ${defOf(data, karta).name}.`,
  });
  s.faza = "draft";
  events.push({ type: "faza", faza: "draft" });
  zacniDraft(s, events);
}

/**
 * Veľkosť balíčka stavby šenku: počet nenahradených starších, nadol na párne
 * číslo (v každom kroku ubudnú z balíčka dve karty), najviac koľko spoločný
 * balíček dá obom hráčom.
 */
export function velkostStavby(state: Pick<GameState, "starsi" | "spolocnyBalicek">): number {
  const podlaStarsich = state.starsi.filter((e) => !e.nahradeny).length;
  const n = Math.min(podlaStarsich, Math.floor(state.spolocnyBalicek.length / 2));
  return n - (n % 2);
}

function zacniDraft(s: MutState, events: Event[]): void {
  // Nevzaté karty zo starého šenku idú naspodok spoločného balíčka.
  if (s.senok.length > 0) {
    s.spolocnyBalicek.push(...s.senok);
    events.push({ type: "log", text: `Zo šenku ide naspodok balíčka ${s.senok.length} nevzatých kariet.` });
    s.senok = [];
  }
  const n = velkostStavby(s as GameState);
  const balicky: [DeepMutable<CardInstance>[], DeepMutable<CardInstance>[]] = [[], []];
  for (const p of [obranca(s), s.utocnik] as const) balicky[p] = s.spolocnyBalicek.splice(0, n);
  s.draftStav = {
    krok: n > 0 ? "stavba" : "beranie",
    balicky,
    vyber: [null, null],
    // Zo šenku berie prvý útočník — porazený z minulej bitky (Michal 2026-10-16).
    naTahu: s.utocnik,
    hotovo: [false, false],
    noveKarty: [0, 0],
  };
  events.push({
    type: "log",
    text:
      n > 0
        ? `Stavba šenku: každý hráč dostáva ${n} kariet zo spoločného balíčka.`
        : "Spoločný balíček je prázdny — šenok sa nestavia.",
  });
}

/**
 * Koľko kariet dá hráč pri stavbe do šenku a koľko naspodok: polovicu
 * a polovicu, naraz a bez podávania balíčkov (Michal 2026-10-20 — predtým
 * po 2 + 2 s výmenou zvyšku, posledné karty išli do šenku bez voľby).
 */
export function krokStavby(velkost: number): { readonly doSenku: number; readonly odhod: number } {
  const odhod = Math.floor(velkost / 2);
  return { doSenku: velkost - odhod, odhod };
}

function cmdStavbaSenku(
  s: MutState,
  data: GameData,
  cmd: { doSenku: readonly number[]; odhod: readonly number[] },
  p: PlayerId,
  events: Event[],
): void {
  const d = s.draftStav;
  need(s.faza === "draft" && d !== null && d.krok === "stavba", "Teraz sa šenok nestavia.");
  need(d.vyber[p] === null, "V tomto kroku si už vybral.");
  const moj = d.balicky[p];
  const krok = krokStavby(moj.length);
  need(cmd.doSenku.length === krok.doSenku, `Do šenku daj ${kariet(krok.doSenku)}.`);
  need(cmd.odhod.length === krok.odhod, `Naspodok daj ${kariet(krok.odhod)}.`);
  const vybrane = [...cmd.doSenku, ...cmd.odhod];
  need(new Set(vybrane).size === vybrane.length, "Každú kartu vyber len raz.");
  need(
    vybrane.every((uid) => moj.some((k) => k.uid === uid)),
    "Karta nie je v tvojom balíčku stavby.",
  );
  d.vyber[p] = { doSenku: [...cmd.doSenku], odhod: [...cmd.odhod] };
  events.push({ type: "log", text: `Hráč ${p + 1} ${rodovo(p, "vybral", "vybrala", "vyberá")} karty do šenku.` });
  const v0 = d.vyber[0];
  const v1 = d.vyber[1];
  if (v0 === null || v1 === null) return;

  // Obaja vybrali: karty do šenku sa odhalia, odhodené idú lícom dole naspodok.
  const vyber = [v0, v1] as const;
  const doSenku: string[] = [];
  for (const h of [obranca(s), s.utocnik] as const) {
    const b = d.balicky[h];
    const vezmi = (uid: number): DeepMutable<CardInstance> =>
      b.splice(b.findIndex((k) => k.uid === uid), 1)[0] as DeepMutable<CardInstance>;
    for (const uid of vyber[h].doSenku) {
      const karta = vezmi(uid);
      s.senok.push(karta);
      doSenku.push(`${defOf(data, karta as CardInstance).name} (hráč ${h + 1})`);
    }
    for (const uid of vyber[h].odhod) s.spolocnyBalicek.push(vezmi(uid));
  }
  events.push({ type: "log", text: `Do šenku: ${doSenku.join(", ")}.` });
  d.vyber = [null, null];
  if (d.balicky[0].length === 0 && d.balicky[1].length === 0) {
    d.krok = "beranie";
    d.naTahu = s.utocnik;
    events.push({
      type: "log",
      text: `Šenok je postavený (${s.senok.length} ${s.senok.length === 1 ? "karta" : s.senok.length >= 2 && s.senok.length <= 4 ? "karty" : "kariet"}). Berie sa striedavo, začína útočník: 1 karta za ${KONSTANTY.CENA_SENKU[1]} cigaretu, 2 karty za ${KONSTANTY.CENA_SENKU[2]} cigarety.`,
    });
  }
}

/**
 * Koľko kariet si hráč p smie teraz vziať zo šenku (Michal 2026-10-19):
 * 1 karta za cigaretu, 2 karty za 3 cigarety. Prázdne = nemá na to.
 */
export function moznostiZoSenku(state: GameState, p: PlayerId): number[] {
  const d = state.draftStav;
  if (d === null || d.krok !== "beranie" || d.hotovo[p]) return [];
  const out: number[] = [];
  for (let pocet = 1; pocet < KONSTANTY.CENA_SENKU.length; pocet++) {
    if (pocet <= state.senok.length && state.hraci[p].cigarety >= (KONSTANTY.CENA_SENKU[pocet] ?? Number.POSITIVE_INFINITY)) out.push(pocet);
  }
  return out;
}

function cmdDraftBer(
  s: MutState,
  data: GameData,
  cmd: { uids: readonly number[] },
  p: PlayerId,
  events: Event[],
): void {
  const d = s.draftStav;
  need(s.faza === "draft" && d !== null && d.krok === "beranie", "Teraz sa zo šenku neberie.");
  need(!d.hotovo[p], "Už nič neberieš.");
  const pocet = cmd.uids.length;
  need(pocet >= 1 && pocet < KONSTANTY.CENA_SENKU.length, "Zo šenku ber 1 alebo 2 karty.");
  need(new Set(cmd.uids).size === pocet, "Každú kartu vyber len raz.");
  need(cmd.uids.every((uid) => s.senok.some((k) => k.uid === uid)), "Karta nie je v šenku.");
  const cena = KONSTANTY.CENA_SENKU[pocet] as number;
  need(s.hraci[p].cigarety >= cena, `Na ${pocet === 1 ? "kartu" : kariet(pocet)} treba ${cigariet(cena)}.`);
  hrac(s, p).cigarety -= cena;
  const mena: string[] = [];
  // Miesta tieňov sa určia pred vybratím, aby dve karty jedného ťahu nepohli jedna druhou.
  const zobrate = [...(d.zobrate ?? [])];
  const miesta = cmd.uids.map((uid) => miestoVSenku(s.senok.findIndex((k) => k.uid === uid), zobrate));
  cmd.uids.forEach((uid, i) => {
    const karta = s.senok.splice(s.senok.findIndex((k) => k.uid === uid), 1)[0] as DeepMutable<CardInstance>;
    hrac(s, p).ruka.push(karta);
    mena.push(defOf(data, karta as CardInstance).name);
    zobrate.push({ karta: { ...karta }, hrac: p, miesto: miesta[i] ?? 0 });
  });
  d.zobrate = zobrate;
  d.noveKarty[p] += pocet;
  events.push({ type: "log", text: `Hráč ${p + 1} berie zo šenku ${mena.join(" a ")} za ${cena} ${cena === 1 ? "cigaretu" : "cigarety"}.` });
  // Prázdny šenok končí branie obom.
  if (s.senok.length === 0) d.hotovo = [true, true];
  // Kto už prestal, súperovi nechal len poslednú šancu — jeden ťah, potom
  // branie končí (Michal 2026-10-20; predtým bral druhý sám, koľko chcel).
  if (d.hotovo[opponentOf(p)]) d.hotovo[p] = true;
  dalsiVBerani(s, data, p, events);
}

/** Miesto karty šenku (index v `senok`) v rade s tieňmi: index-té miesto, ktoré nezaberá tieň. */
export function miestoVSenku(index: number, zobrate: readonly Pick<ZobrataZoSenku, "miesto">[]): number {
  const tiene = new Set(zobrate.map((z) => z.miesto));
  let miesto = 0;
  for (let volnych = 0; ; miesto++) {
    if (tiene.has(miesto)) continue;
    if (volnych === index) return miesto;
    volnych++;
  }
}

function cmdDraftStop(s: MutState, data: GameData, p: PlayerId, events: Event[]): void {
  const d = s.draftStav;
  need(s.faza === "draft" && d !== null && d.krok === "beranie", "Teraz sa zo šenku neberie.");
  need(!d.hotovo[p], "Už nič neberieš.");
  d.hotovo[p] = true;
  events.push({ type: "log", text: `Hráč ${p + 1} už neberie zo šenku (spolu ${d.noveKarty[p]}).` });
  dalsiVBerani(s, data, p, events);
}

/** Po ťahu v braní berie súper, ak ešte berie, inak ten istý; keď už nikto, draft končí. */
function dalsiVBerani(s: MutState, data: GameData, p: PlayerId, events: Event[]): void {
  const d = s.draftStav;
  if (d === null) return;
  const opp = opponentOf(p);
  if (!d.hotovo[opp] || !d.hotovo[p]) {
    d.naTahu = d.hotovo[opp] ? p : opp;
    return;
  }
  // Pitiek je podľa aktivovaných akcií lokality — prepočítava sa s líniou.
  s.pitkaCislo = 0;
  s.pitkyCelkom = pocetPitiek(data, s as GameState);
  // Šenok sa po braní doplní z vrchu spoločného balíčka (Michal 2026-10-20) —
  // Pohreb Závislého, Starosta a iné efekty potom majú z čoho brať.
  const doplnit = Math.min(Math.max(0, KONSTANTY.SENOK_PO_BRANI - s.senok.length), s.spolocnyBalicek.length);
  if (doplnit > 0) {
    s.senok.push(...s.spolocnyBalicek.splice(0, doplnit));
    events.push({ type: "log", text: `Šenok sa dopĺňa z vrchu spoločného balíčka na ${s.senok.length} kariet (+${doplnit}).` });
  }
  // Fajčiar v5 (Michal 2026-10-24): +1 / +2 / +3 cigarety po výbere zo šenku —
  // súperovo Obmedzenie ich neuberá (nie sú z Pitky).
  for (const p of [s.utocnik, obranca(s)] as const) {
    const sila = silaPriazne(data, s as GameState, "FAJCIAR", p);
    if (sila <= 0) continue;
    hrac(s, p).cigarety += sila;
    events.push({ type: "log", text: `Priazeň Fajčiara: hráč ${p + 1} dostáva po šenku ${cigariet(sila)}.` });
  }
  // Patronát: rozhoduje útočník, potom obranca — druhý už vidí voľbu prvého.
  d.krok = "patronat";
  d.naTahu = s.utocnik;
  d.hotovo = [false, false];
}

// ---------------------------------------------------------------------------
// Patronát (Michal 2026-10-20 — nahradil bitku o staršieho)

/** Karty z ruky hráča p, ktoré smú ísť lícom dole na scorecard: Občan alebo Zviera. */
export function kandidatiNaNahradu(data: GameData, ruka: readonly CardInstance[]): CardInstance[] {
  return ruka.filter((k) => {
    const tags = defOf(data, k).tags;
    return (tags.includes("Občan") || tags.includes("Zviera")) && !tags.includes("Nástroj") && !tags.includes("Kliatba");
  });
}

/**
 * Starší, ktorých si hráč p teraz smie vziať: prejavujú mu priazeň (aspoň žltá),
 * zaplatí cigarety, má poldeci na bolestné a kartu na náhradu. Kartu staršieho,
 * ktorú už drží iný patronát, si vziať nemožno.
 */
export function moznyPatronat(data: GameData, state: GameState, p: PlayerId): ElderState[] {
  const d = state.draftStav;
  if (state.faza !== "draft" || d === null || d.krok !== "patronat" || d.hotovo[p]) return [];
  if (state.patronat[p] !== null) return [];
  const h = state.hraci[p];
  if (h.poldeciPlne + h.poldeciVypite < 1) return [];
  if (kandidatiNaNahradu(data, h.ruka).length === 0) return [];
  return state.starsi.filter(
    (e) =>
      patronatMozny(e, p) &&
      h.cigarety >= cenaPatronatu(e).cigarety &&
      !state.patronat.some((x) => x?.elderId === e.elderId),
  );
}

/**
 * Prečo hra patronát preskočila, hoci hráčovi niektorý starší prejavuje priazeň
 * (playtest 20261026-173610-3: preskočil sa ticho). Len pre hráča — dôvod môže
 * prezradiť ruku (nemá Občana ani Zviera). Null, keď patronát ani neprichádzal do úvahy.
 */
function dovodBezPatronatu(data: GameData, state: GameState, p: PlayerId): string | null {
  const starsi = state.starsi.filter((e) => patronatMozny(e, p) && !state.patronat.some((x) => x?.elderId === e.elderId));
  if (starsi.length === 0 || state.patronat[p] !== null) return null;
  const h = state.hraci[p];
  const kto = starsi.map((e) => `${defOf(data, e.karta).name} (${cigariet(cenaPatronatu(e).cigarety)})`).join(", ");
  const dovod =
    h.poldeciPlne + h.poldeciVypite < 1
      ? "nemáš poldeci na bolestné"
      : kandidatiNaNahradu(data, h.ruka).length === 0
        ? "nemáš v ruke Občana ani Zviera, ktorého by si dal na scorecard"
        : `máš len ${cigariet(h.cigarety)}`;
  return `Patronát preskočený: priazeň ti prejavuje ${kto}, ale ${dovod}.`;
}

/** Je karta s týmto uid práve karta staršieho, ktorého má niekto v patronáte? */
// Štruktúrny typ: rovnako sa pýta server (GameState) aj klient agentov (ClientState).
export function jeKartaPatronatu(
  state: { readonly patronat: readonly ({ readonly elderId: string } | null)[]; readonly starsi: readonly ElderState[] },
  uid: number,
): boolean {
  return state.patronat.some((x) => x !== null && state.starsi.find((e) => e.elderId === x.elderId)?.karta.uid === uid);
}

function cmdPatronat(
  s: MutState,
  data: GameData,
  cmd: { elderId: string; uid: number },
  p: PlayerId,
  events: Event[],
): void {
  const d = s.draftStav;
  need(s.faza === "draft" && d !== null && d.krok === "patronat" && d.naTahu === p && !d.hotovo[p], "Teraz sa staršieho do ruky neberie.");
  const elder = s.starsi.find((e) => e.elderId === cmd.elderId);
  need(elder !== undefined, "Taký starší nie je.");
  need(s.patronat[p] === null, "Staršieho si v tomto kole už vzal.");
  need(!elder.nahradeny, "Náhradu staršieho si do ruky vziať nemožno.");
  need(patronatMozny(elder as ElderState, p), "Starší ti neprejavuje priazeň aspoň v žltej zóne.");
  const h = s.hraci[p];
  need(h.poldeciPlne + h.poldeciVypite >= 1, "Na patronát treba mať poldeci (bolestné pri prehre).");
  const cena = cenaPatronatu(elder as ElderState);
  need(h.cigarety >= cena.cigarety, `Patronát stojí ${cena.cigarety} ${cena.cigarety === 1 ? "cigaretu" : "cigarety"}.`);
  const karta = h.ruka.find((k) => k.uid === cmd.uid);
  need(karta !== undefined && kandidatiNaNahradu(data, [karta as CardInstance]).length === 1, "Lícom dole na scorecard smie ísť len Občan alebo Zviera z ruky.");

  vezmiZRuky(s, p, cmd.uid);
  hrac(s, p).cigarety -= cena.cigarety;
  hrac(s, p).ruka.push(elder.karta);
  s.patronat[p] = { elderId: elder.elderId, nahrada: karta, pohorsenia: cena.pohorsenia };
  if (elder.marker !== MARKER_STRED) zapisPosun(s, events, { elderId: elder.elderId, z: elder.marker, na: MARKER_STRED, zdroj: "patronat", kto: p });
  elder.marker = MARKER_STRED;
  events.push({
    type: "log",
    text: `Patronát: hráč ${p + 1} si berie do ruky staršieho ${defOf(data, elder.karta as CardInstance).name}, na scorecard kladie kartu lícom dole a marker dáva do stredu${cena.cigarety > 0 ? ` (platí ${cena.cigarety} ${cena.cigarety === 1 ? "cigaretu" : "cigarety"})` : ""}. Súper dostane v bitke ${cena.pohorsenia} Pohoršenia.`,
  });
  // Patronát z červenej môže súperovi zobrať polovicu vydesených — ohlásenie
  // padá hneď, nie až na konci kola (Michal 2026-10-26).
  skontrolujVydesenie(s, data, events);
  dalsiVPatronate(s, data, p, events);
}

function cmdBezPatronatu(s: MutState, data: GameData, p: PlayerId, events: Event[], samo = false): void {
  const d = s.draftStav;
  need(s.faza === "draft" && d !== null && d.krok === "patronat" && d.naTahu === p && !d.hotovo[p], "Teraz sa o patronáte nerozhoduje.");
  if (!samo) events.push({ type: "log", text: `Hráč ${p + 1} si staršieho do ruky neberie.` });
  dalsiVPatronate(s, data, p, events);
}

/** Po rozhodnutí útočníka rozhoduje obranca; potom začína Zhromaždenie. */
function dalsiVPatronate(s: MutState, data: GameData, p: PlayerId, events: Event[]): void {
  const d = s.draftStav;
  if (d === null) return;
  d.hotovo[p] = true;
  const opp = opponentOf(p);
  if (!d.hotovo[opp]) {
    d.naTahu = opp;
    return;
  }
  s.draftStav = null;
  zacniZhromazdenie(s, data, events);
}

/**
 * Patronát po bitke: víťaz-patrón si staršieho nechá (náhrada sa otočí lícom
 * hore), porazený-patrón ho vracia na scorecard, náhradu berie späť do ruky
 * a ODHADZUJE jeden poldeci — vypitý, ak ho má, inak plný (Michal 2026-10-20).
 * Volá sa pred návratom kariet z línie.
 */
function vyriesPatronat(s: MutState, data: GameData, vitaz: PlayerId | null, events: Event[]): void {
  for (const p of [0, 1] as const) {
    const pat = s.patronat[p];
    if (pat === null) continue;
    const elder = s.starsi.find((e) => e.elderId === pat.elderId);
    if (elder === undefined) continue;
    const meno = defOf(data, elder.karta as CardInstance).name;
    if (vitaz === p) {
      // Karta staršieho je teraz hráčova — z línie sa vráti s ostatnými, v ruke ostáva.
      elder.karta = pat.nahrada;
      elder.nahradeny = true;
      elder.ziskal = p;
      events.push({
        type: "log",
        text: `Patronát: hráč ${p + 1} ${rodovo(p, "vyhral", "vyhrala", "vyhráva")} a nechá si staršieho ${meno}; na scorecarde sa otáča ${defOf(data, pat.nahrada as CardInstance).name}.`,
      });
    } else {
      const uid = elder.karta.uid;
      const vRuke = s.hraci[p].ruka.findIndex((k) => k.uid === uid);
      if (vRuke !== -1) hrac(s, p).ruka.splice(vRuke, 1);
      const kde = najdiVLinii(s, uid);
      if (kde !== null) s.strany[kde.strana].splice(kde.index, 1);
      hrac(s, p).ruka.push(pat.nahrada);
      const h = hrac(s, p);
      const vypity = h.poldeciVypite > 0;
      if (vypity) h.poldeciVypite -= 1;
      else if (h.poldeciPlne > 0) h.poldeciPlne -= 1;
      events.push({
        type: "log",
        text: `Patronát: hráč ${p + 1} ${rodovo(p, "prehral", "prehrala", "prehráva")} — ${meno} sa vracia na scorecard, karta lícom dole späť do ruky a hráč odhadzuje ${vypity ? "vypitý" : "plný"} poldeci (bolestné).`,
      });
    }
  }
  s.patronat = [null, null];
}

// ---------------------------------------------------------------------------
// Zhromaždenie

/**
 * Vykladať začína útočník (Michal 2026-10-20) — natočenie lokality už neurčuje,
 * kto kam vykladá, a cieľ vyberá obranca.
 */
function zacniZhromazdenie(s: MutState, data: GameData, events: Event[], zacina: PlayerId = s.utocnik): void {
  s.faza = "zhromazdenie";
  events.push({ type: "faza", faza: "zhromazdenie" });
  // Limit sa počíta nanovo na začiatku každého Zhromaždenia (PRAVIDLA §6).
  // zastavka ho prepíše na 2; vinko pridáva poldeci navyše.
  s.zhromazdenieStav = {
    naTahu: zacina,
    zostavaLimit: [limitZhromazdenia(s as GameState, 0), limitZhromazdenia(s as GameState, 1)],
    pasoval: [false, false],
    navyse: [0, 0],
    // Zastávka: obaja čerpajú zo spoločného limitu (súčet ich limitov).
    spolocny: spolocnyLimit(s as GameState),
    ...(spolocnyLimit(s as GameState)
      ? { vlastny: [vlastnyLimitZhromazdenia(s as GameState, 0), vlastnyLimitZhromazdenia(s as GameState, 1)] as [number, number] }
      : {}),
  };
  manualEfekty(s, data, "Zhromaždenie", events);
}

function posunTahZhromazdenia(s: MutState, data: GameData, p: PlayerId, events: Event[]): void {
  const z = s.zhromazdenieStav;
  if (z === null) return;
  const oppon = opponentOf(p);
  if (!z.pasoval[oppon]) {
    z.naTahu = oppon;
  }
  if (z.pasoval[0] && z.pasoval[1]) {
    s.zhromazdenieStav = null;
    zacniPitku(s, data, events);
  }
}

function cmdPlace(
  s: MutState,
  data: GameData,
  cmd: { uid: number; target: CielVykladania },
  p: PlayerId,
  events: Event[],
): void {
  const z = s.zhromazdenieStav;
  need(s.faza === "zhromazdenie" && z !== null, "Teraz nie je Zhromaždenie.");
  need(!z.pasoval[p], "Už si pasoval.");
  const kartaVRuke = s.hraci[p].ruka.find((k) => k.uid === cmd.uid);
  need(kartaVRuke !== undefined, "Karta nie je v ruke.");
  const def = defOf(data, kartaVRuke as CardInstance);
  const jeNastroj = def.tags.includes("Nástroj");

  if (cmd.target === "priznanie") {
    need(def.tags.includes("Kliatba"), "Priznať možno len kartu s tagom Kliatba.");
    const karta = vezmiZRuky(s, p, cmd.uid);
    hrac(s, p).priznane.push(karta as DeepMutable<CardInstance>);
    // Pri priznaní kliatby si hráč okamžite doberie kartu (Michal 2026-10-19),
    // za Cirhózu nie (Michal 2026-10-20 — Dlhy sa priznávajú samy, Cirhóza je voľba).
    if (karta.defId === "cirhoza") {
      events.push({ type: "log", text: `Hráč ${p + 1} priznáva kartu ${def.name}.` });
      return;
    }
    const dobral = tahaj(s, p, 1, events).length;
    events.push({
      type: "log",
      text:
        dobral > 0
          ? `Hráč ${p + 1} priznáva kartu ${def.name} a doberá si kartu.`
          : `Hráč ${p + 1} priznáva kartu ${def.name} — balíček aj odhadzovací balíček sú prázdne, niet čo dobrať.`,
    });
    // Priznanie neodovzdá ťah (Michal 2026-10-12) — kliatby sa nepriznávajú
    // na striedačku a nedá sa nimi „čakať“, kým súper vyloží.
    return;
  } else if (cmd.target === "dedicstvo") {
    need(jeNastroj, "Do Dedičstva patria len Nástroje.");
    // Dedičstvo stojí cigarety a cena rastie spoločne pre oboch (Michal 2026-10-19).
    const cena = cenaDedicstva(s as GameState);
    need(s.hraci[p].cigarety >= cena, `Do Dedičstva treba ${cigariet(cena)}.`);
    hrac(s, p).cigarety -= cena;
    s.dedicstvaVylozene += 1;
    const karta = vezmiZRuky(s, p, cmd.uid);
    hrac(s, p).dedicstvo.push(karta as DeepMutable<CardInstance>);
    events.push({
      type: "log",
      text: `Hráč ${p + 1} vykladá ${def.name} do Dedičstva za ${cigariet(cena)} (ďalšie Dedičstvo stojí ${cenaDedicstva(s as GameState)}).`,
    });
    manualEfekty(s, data, "Dedičstvo", events);
  } else {
    // Nástroj sa do limitu vykladania nezapočítava (PRAVIDLA §6, §12); ostatné
    // karty limit míňajú (Kočovník od 2026-10-19 tiež).
    // Družstvo: Pracujúci limit nemíňajú.
    if (!jeNastroj && !bezLimituPracujuci(cielLokalita(s as GameState)?.defId ?? null, def.tags)) {
      need(z.zostavaLimit[p] > 0, "Limit vykladania je vyčerpaný.");
      uberLimit(z, p, 1);
    }
    vylozDoLinie(s, data, p, cmd.uid, cmd.target, events);
  }

  ukonciVykladanie(s, data, p, events);
}

/**
 * Záverečná (roadmapa #83, Michal 2026-10-23): za cigaretu karta z ruky lícom
 * dole na koniec strany. Míňa limit ako bežné vyloženie (aj po Vypiť) a hráč
 * tým v tomto Zhromaždení končí — bez cigariet za pas.
 */
function cmdZaverecna(
  s: MutState,
  data: GameData,
  cmd: { uid: number; target: "vlastna" | "superova" },
  p: PlayerId,
  events: Event[],
): void {
  const z = s.zhromazdenieStav;
  need(s.faza === "zhromazdenie" && z !== null, "Záverečná sa hrá len v Zhromaždení.");
  need(!z.pasoval[p], "Už si pasoval.");
  need(s.hraci[p].cigarety >= KONSTANTY.CENA_ZAVERECNEJ, `Záverečná stojí ${cigariet(KONSTANTY.CENA_ZAVERECNEJ)}.`);
  const kartaVRuke = s.hraci[p].ruka.find((k) => k.uid === cmd.uid);
  need(kartaVRuke !== undefined, "Karta nie je v ruke.");
  const def = defOf(data, kartaVRuke as CardInstance);
  if (!def.tags.includes("Nástroj") && !bezLimituPracujuci(cielLokalita(s as GameState)?.defId ?? null, def.tags)) {
    need(z.zostavaLimit[p] > 0, "Limit vykladania je vyčerpaný.");
    uberLimit(z, p, 1);
  }
  vylozDoLinie(s, data, p, cmd.uid, cmd.target, events, true);
  hrac(s, p).cigarety -= KONSTANTY.CENA_ZAVERECNEJ;
  s.zaverecnaOdklad[p] = { naexSupera: 0, naexVlastne: 0, zahodeniaSupera: 0 };
  z.pasoval[p] = true;
  z.navyse[p] = 0;
  posunTahZhromazdenia(s, data, p, events);
}

/** Skryté Záverečné v línii — najviac jedna na stranu (za ňou sa nedá priložiť). */
function skryteZaverecne(s: GameState): { strana: PlayerId; placed: PlacedCard }[] {
  const out: { strana: PlayerId; placed: PlacedCard }[] = [];
  for (const strana of [0, 1] as const) {
    for (const placed of s.strany[strana]) if (placed.zaverecna === true) out.push({ strana, placed });
  }
  return out;
}

/** Náhradné uid skrytej Záverečnej na strane — súper ju cez neho cieli NA EX. */
export function uidZaverecnej(strana: PlayerId): number {
  return -900000 - strana;
}

/** Strany, za ktorých koniec sa nedá priložiť (skrytá Záverečná) — pre cieleVykladania na klientovi. */
export function zablokovaneStrany(view: { readonly zaverecne: readonly { readonly strana: PlayerId }[] }): [boolean, boolean] {
  return [view.zaverecne.some((z) => z.strana === 0), view.zaverecne.some((z) => z.strana === 1)];
}

/**
 * Otočenie Záverečných na konci Pitky: odložené spúšťače (Policajtka,
 * Vychovávateľka, Hrobár) sa vyhodnotia teraz, potom Nástup. Odhalené karty
 * a čo urobili pridá do rekapitulácie Pitky. Vráti true, keď otočený Hasič čaká
 * na voľbu — koniec Pitky dobehne až po nej.
 */
function otocZaverecne(s: MutState, data: GameData, events: Event[]): boolean {
  const skryte = skryteZaverecne(s as GameState);
  if (skryte.length === 0) return false;
  // Akcie, ktoré karta v práve vyhodnotenej Pitke dávala — línia sa od vyhodnotenia nezmenila.
  const linia = evaluateLine(data, lineState(s as GameState));
  const odhalene: ZaverecnaOdhalena[] = [];
  let cakaNaHasica = false;
  for (const { strana, placed } of skryte) {
    const p = placed.playedBy;
    const opp = opponentOf(p);
    delete (placed as { zaverecna?: true }).zaverecna;
    const def = defOf(data, placed.card);
    events.push({ type: "log", text: `Záverečná hráča ${p + 1} sa otáča: ${def.name}.` });
    const odEfektov = events.length;
    const odklad = s.zaverecnaOdklad[p];
    s.zaverecnaOdklad[p] = null;
    if (odklad !== null && maEfekt(s, data, p, def.id)) {
      if (def.id === "policajtka") {
        // Záverečná sa otočí na konci Pitky po svojom Zhromaždení — odklad drží NA EX práve tejto Pitky.
        if (odklad.naexSupera > odklad.naexVlastne) dlhOdPolicajtky(s, data, opp, odklad.naexSupera, odklad.naexVlastne, events);
      } else if (def.id === "hrobar" && odklad.zahodeniaSupera > 0) {
        hrac(s, p).cigarety += odklad.zahodeniaSupera;
        events.push({ type: "log", text: `Hrobár: hráč ${p + 1} si berie ${cigariet(odklad.zahodeniaSupera)} za zahodené karty.` });
      } else if (def.id === "vychovavatelka") {
        for (let i = 0; i < odklad.naexVlastne; i++) presunDlhVychovavatelky(s, p, events);
      }
    }
    if (def.triggers.includes("Nástup")) nastupEfekt(s, data, def.id, p, strana, events);
    odhalene.push({
      majitel: p,
      strana,
      uid: placed.card.uid,
      defId: def.id,
      akcie: akcieKartyVLinii(linia, placed.card.uid),
      // Súkromné hlášky (pre) do verejnej rekapitulácie nepatria.
      efekty: events.slice(odEfektov).flatMap((e) => (e.type === "log" && e.pre === undefined ? [e.text] : [])),
    });
    if (odlozPoHasicovi(s, "koniecPitky")) {
      cakaNaHasica = true;
      break;
    }
  }
  const rekap = s.pitkyKola?.at(-1);
  if (rekap !== undefined && rekap.pitka === s.pitkaCislo && odhalene.length > 0) {
    // Po voľbe Hasiča sa dootáčajú zvyšné — pridajú sa k už odhaleným.
    const novy = { ...rekap, zaverecne: [...(rekap.zaverecne ?? []), ...odhalene] } as DeepMutable<RekapitulaciaPitky>;
    s.pitkyKola = [...(s.pitkyKola ?? []).slice(0, -1), novy];
  }
  return cakaNaHasica;
}

/**
 * Odhalené Milujúce manželky hráča p — priznané aj v línii (Furt platí, kým je
 * karta odhalená; Michal 2026-10-19). Každá posunie latku Absťáku o 1.
 */
export function manzelkyHraca(_s: VerejnyStav, _p: PlayerId): number {
  // v7 (M2): Milujúca manželka už latku Absťáku neposúva — znižuje pečeň v Pitke.
  return 0;
}

/** Do v6: odhalené Manželky hráča p posúvali latku Absťáku. */
export function manzelkyHracaV6(s: VerejnyStav, p: PlayerId): number {
  return (
    s.hraci[p].priznane.filter((k) => k.defId === "milujuca_manzelka").length +
    partiaHraca(s, p).filter((pl) => pl.card.defId === "milujuca_manzelka").length
  );
}

/** Cena ďalšieho Nástroja do Dedičstva — 1, 2, 3… spoločne pre oboch (Michal 2026-10-19). */
export function cenaDedicstva(state: { readonly dedicstvaVylozene: number }): number {
  return KONSTANTY.CENA_DEDICSTVA_ZAKLAD + state.dedicstvaVylozene;
}

/**
 * Vyloženie karty z ruky na koniec tvojej alebo súperovej strany — v
 * Zhromaždení aj ako reakcia na NA EX. Limit vykladania rieši volajúci.
 */
function vylozDoLinie(
  s: MutState,
  data: GameData,
  p: PlayerId,
  uid: number,
  target: CielVykladania,
  events: Event[],
  /** Záverečná: lícom dole, Nástup až pri otočení na konci Pitky. */
  zaverecna = false,
): void {
  need(target === "vlastna" || target === "superova", "Kartu možno vyložiť len na tvoju alebo súperovu stranu.");
  need(!(target === "superova" && lenVlastnaStrana(cielLokalita(s as GameState)?.defId ?? null)), "Most: karty sa smú vykladať len na vlastnú stranu.");
  const kartaVRuke = s.hraci[p].ruka.find((k) => k.uid === uid);
  need(kartaVRuke !== undefined, "Karta nie je v ruke.");
  const def = defOf(data, kartaVRuke as CardInstance);
  need(!(def.tags.includes("Kliatba") && !def.tags.includes("Občan")), "Kliatbu možno len priznať — do línie nepatrí.");
  // Karta smie na ktorúkoľvek stranu; patrí tomu, kto ju zahral (pravidlá v3).
  const cielPartia: PlayerId = target === "vlastna" ? p : opponentOf(p);
  // Nástroj nesmie susediť s Nástrojom (PRAVIDLA §12).
  const partia = s.strany[cielPartia];
  const sused = susedNaKonci(s.strany, cielPartia, finaleBezStredu(s));
  need(sused?.zaverecna !== true, "Za Záverečnú sa nedá priložiť, kým sa na konci Pitky neotočí.");
  if (def.tags.includes("Nástroj") && sused != null) {
    need(
      !defOf(data, sused.card as CardInstance).tags.includes("Nástroj"),
      "Nástroj nesmie susediť s Nástrojom.",
    );
  }
  // pes: nikdy nesmie byť v partii s iným zvieraťom — medzi kartami toho istého majiteľa.
  need(!zvieraKonflikt(data, partiaHraca(s as GameState, p), def), "Pes nesmie byť medzi tvojimi kartami s iným zvieraťom.");
  const karta = vezmiZRuky(s, p, uid);
  if (finaleBezStredu(s) && s.strany[0].length === 0 && s.strany[1].length === 0) s.stredFinale = cielPartia;
  if (zaverecna) {
    partia.push({ card: karta, playedBy: p, zaverecna: true } as DeepMutable<PlacedCard>);
    // Meno karty sa v logu objaví až pri otočení.
    events.push({ type: "log", text: `Hráč ${p + 1} hrá Záverečnú lícom dole do ${target === "vlastna" ? "svojej" : "súperovej"} partie.` });
    return;
  }
  partia.push({ card: karta, playedBy: p } as DeepMutable<PlacedCard>);
  events.push({
    type: "log",
    text: `Hráč ${p + 1} vykladá ${def.name} do ${target === "vlastna" ? "svojej" : "súperovej"} partie.`,
  });
  if (def.triggers.includes("Nástup")) {
    nastupEfekt(s, data, def.id, p, cielPartia, events);
  }
}

/**
 * Karta, ku ktorej sa priloží ďalšia karta na koniec strany `strana`. Vo
 * finále (v6) leží prvá karta v strede a susedí s oboma stranami — prázdna
 * strana sa prikladá k nej.
 */
export function susedNaKonci(strany: readonly [readonly PlacedCard[], readonly PlacedCard[]], strana: PlayerId, finale: boolean): PlacedCard | null {
  const partia = strany[strana];
  if (partia.length > 0) return partia[partia.length - 1] ?? null;
  return finale ? (strany[opponentOf(strana)][0] ?? null) : null;
}

/** Po vyložení: s vypitým poldeci (Vypiť) hráč pokračuje, inak ide súper. */
function ukonciVykladanie(s: MutState, data: GameData, p: PlayerId, events: Event[]): void {
  const z = s.zhromazdenieStav;
  if (z !== null && z.navyse[p] > 0) {
    z.navyse[p] -= 1;
    return;
  }
  posunTahZhromazdenia(s, data, p, events);
}

/**
 * Implementované Nástup efekty; efekty pôsobia v partii, kde karta leží.
 * Neimplementované sa pripomenú v logu; Autority umlčí Praudovravec.
 */
function nastupEfekt(
  s: MutState,
  data: GameData,
  defId: string,
  p: PlayerId,
  /** Partia, do ktorej sa karta práve vyložila (na jej koniec). */
  strana: PlayerId,
  events: Event[],
): void {
  const def = data.cards.get(defId);
  if (def === undefined) return;
  if (efektPotlaceny(data, s as GameState, p, defId)) {
    events.push({ type: "log", text: `Praudovravec: efekt karty ${def.name} sa neuplatní.` });
    return;
  }
  if (jeEfektManual(defId)) {
    events.push({
      type: "manualEfekt",
      defId,
      nazov: def.name,
      text: def.effectText,
      hrac: p,
    });
    return;
  }
  const opp = opponentOf(p);
  switch (defId) {
    case "snubenica": {
      // Snúbenica leží na konci partie; sused s NA EX ide majiteľovi do ruky
      // a ona sa posunie na jeho miesto. Poldeci z karty sa vypije ako v bitke —
      // NA EX už pečeň započítalo, nerest pripadne tomu, kto ho dal.
      const partia = s.strany[strana];
      // Vo finále môže Snúbenica na prázdnej strane susediť s kartou v strede (v6).
      const sused = partia.length === 1 && finaleBezStredu(s) ? (s.strany[opponentOf(strana)][0] ?? null) : null;
      const vracia = sused !== null ? snubenicaVracia([sused as PlacedCard], defId) : snubenicaVracia(partia.slice(0, -1) as readonly PlacedCard[], defId);
      if (vracia === null) break;
      if (sused !== null) s.strany[opponentOf(strana)].splice(0, 1);
      else partia.splice(partia.length - 2, 1);
      const majitel = vracia.playedBy;
      const naexBy = vracia.naexBy as PlayerId;
      hrac(s, majitel).ruka.push(vracia.card as DeepMutable<CardInstance>);
      hrac(s, naexBy).poldeciVypite += 1;
      hrac(s, naexBy).nerestiTotoKolo += 1;
      events.push({
        type: "log",
        text: `Snúbenica: ${defOf(data, vracia.card).name} s NA EX ide hráčovi ${majitel + 1} do ruky, Snúbenica zaujíma jej miesto (poldeci hráča ${naexBy + 1} je vypitý).`,
      });
      break;
    }
    case "hasic": {
      // Michal 2026-10-26: náhodná karta z vlastného odhadzovacieho balíčka, aj
      // kliatba — hráč sa rozhodne, či si ju nechá (príkaz hasic). Karta, o ktorej
      // ešte rozhoduje iný Hasič z toho istého ťahu, sa znova nevytiahne.
      const caka = new Set((s.hasicVolby ?? []).map((v) => v.uid));
      const moznosti = s.hraci[p].odhadzovaci.filter((k) => !caka.has(k.uid));
      if (moznosti.length === 0) {
        events.push({ type: "log", text: `Hasič: hráč ${p + 1} má prázdny odhadzovací balíček — nič sa nestane.` });
        break;
      }
      const [i, rng] = rngInt(s.rng, moznosti.length);
      s.rng = rng;
      const karta = moznosti[i] as CardInstance;
      s.hasicVolby = [...(s.hasicVolby ?? []), { hrac: p, uid: karta.uid, potom: null }];
      events.push({
        type: "log",
        text: `Hasič: hráč ${p + 1} ${rodovo(p, "vytiahol", "vytiahla", "ťahá")} z odhadzovacieho balíčka kartu ${defOf(data, karta).name} — nechá si ju, alebo ju vráti.`,
      });
      break;
    }
    case "degustatorka": {
      // v7: súper s viac plnými poldeci ako majiteľ — jeden mu ochutná (nie nerest ani pečeň).
      if (s.hraci[opp].poldeciPlne > s.hraci[p].poldeciPlne) {
        hrac(s, opp).poldeciPlne -= 1;
        hrac(s, opp).poldeciVypite += 1;
        events.push({ type: "log", text: `Degustátorka: hráčovi ${opp + 1} ochutná plný poldeci — je vypitý.` });
      } else events.push({ type: "log", text: `Degustátorka: hráč ${opp + 1} nemá viac plných poldeci — nič neochutná.` });
      break;
    }
    case "vandal": {
      if (s.ciel?.lokalita != null) {
        s.lokalitaOtocena = !s.lokalitaOtocena;
        events.push({ type: "log", text: `Vandal: hráč ${p + 1} otáča lokalitu o 180° — jej hrany si vymenili strany.` });
      }
      break;
    }
    case "opatrovatelka": {
      const pred = s.hraci[p].nerestiMinuleKolo;
      hrac(s, p).nerestiMinuleKolo = Math.max(0, pred - 2);
      events.push({ type: "log", text: `Opatrovateľka: hráčovi ${p + 1} klesá počet nerestí z minulého kola z ${pred} na ${s.hraci[p].nerestiMinuleKolo}.` });
      break;
    }
    case "klebetnica": {
      if (s.hraci[opp].ruka.length === 0) {
        events.push({ type: "log", text: `Klebetnica: hráč ${opp + 1} nemá v ruke nič — nič sa nestane.` });
        break;
      }
      s.hasicVolby = [...(s.hasicVolby ?? []), { hrac: p, typ: "klebetnica", uid: 0, potom: null }];
      events.push({ type: "log", text: `Klebetnica: hráč ${p + 1} si pozerá súperovu ruku a jednu kartu mu pošle naspodok balíčka.` });
      break;
    }
    case "dohadzovacka": {
      s.hasicVolby = [...(s.hasicVolby ?? []), { hrac: p, typ: "dohadzovacka", uid: 0, potom: null }];
      events.push({ type: "log", text: `Dohadzovačka: hráč ${p + 1} vymení dvom starším priazne.` });
      break;
    }
    case "niekoho_stryna": {
      // Zahoď 1 Cirhózu alebo 1 Dlh z ruky alebo z odhadzovacieho balíčka,
      // Dlh aj spomedzi priznaných (verejný dlh 2026-10-21 — nový Dlh je hneď
      // priznaný). Hra vyberie za hráča: najprv z ruky, Cirhózu pred Dlhom.
      let zostava = KONSTANTY.EFEKT.STRYNA_KLIATBY;
      let zRuky = 0;
      for (const kde of ["ruka", "odhadzovaci", "priznane"] as const) {
        for (const kliatba of kde === "priznane" ? (["dlh"] as const) : (["cirhoza", "dlh"] as const)) {
          while (zostava > 0) {
            const idx = s.hraci[p][kde].findIndex((k) => k.defId === kliatba);
            if (idx === -1) break;
            hrac(s, p)[kde].splice(idx, 1);
            zostava--;
            if (kde === "ruka") zRuky++;
            events.push({ type: "log", text: `Niekoho stryná: hráč ${p + 1} ${rodovo(p, "zahodil", "zahodila", "zahadzuje")} ${kliatba === "dlh" ? "Dlh" : "Cirhózu"}.` });
          }
        }
      }
      poZahodeni(s, data, p, zRuky, events);
      break;
    }
    case "velmi_smutiaca_vdova": {
      // Muž navrchu súperovho balíčka ide z hry a majiteľ zahodí 2 svoje Dlhy.
      // Oprava 2026-10-19 (Michal: „efekt nefunguje“): vrchná karta sa berie
      // aj po zamiešaní odhadzovacieho, Dlhy sa naozaj zahodia (z ruky aj
      // z odhadzovacieho — predtým sa len odhodili a vrátili) a log vždy povie,
      // čo sa stalo. Hrobár sa nespúšťa — zahadzuje sa vlastnou kartou.
      const opponent = hrac(s, opp);
      if (opponent.doberaci.length === 0 && opponent.odhadzovaci.length > 0) {
        const [premiesane, rng] = rngShuffle(s.rng, opponent.odhadzovaci);
        s.rng = rng;
        opponent.doberaci = premiesane as DeepMutable<CardInstance>[];
        opponent.odhadzovaci = [];
      }
      const vrchna = opponent.doberaci[0];
      if (vrchna === undefined) {
        events.push({ type: "log", text: `Veľmi smútiaca vdova: hráč ${opp + 1} nemá v balíčku žiadnu kartu — nič sa nestane.` });
        break;
      }
      const meno = defOf(data, vrchna as CardInstance).name;
      if (!defOf(data, vrchna as CardInstance).tags.includes("Chlap")) {
        events.push({ type: "log", text: `Veľmi smútiaca vdova: vrchná karta balíčka hráča ${opp + 1} je ${meno} — nie muž, nič sa nestane.` });
        break;
      }
      opponent.doberaci.shift();
      let zostava = KONSTANTY.EFEKT.VDOVA_DLHY;
      for (const kde of ["ruka", "odhadzovaci", "priznane"] as const) {
        while (zostava > 0) {
          const idx = s.hraci[p][kde].findIndex((k) => k.defId === "dlh");
          if (idx === -1) break;
          hrac(s, p)[kde].splice(idx, 1);
          zostava--;
        }
      }
      const zahodene = KONSTANTY.EFEKT.VDOVA_DLHY - zostava;
      events.push({
        type: "log",
        text: `Veľmi smútiaca vdova: vrchná karta balíčka hráča ${opp + 1} je ${meno} — muž ide z hry; hráč ${p + 1} zahadzuje ${zahodene} ${zahodene === 1 ? "Dlh" : "Dlhy"}.`,
      });
      break;
    }
    default:
      break;
  }
}

/** Uberie z limitu vykladania; na Zastávke zo spoločného limitu obom. */
function uberLimit(z: DeepMutable<ZhromazdenieStav>, p: PlayerId, n: number): void {
  for (const q of z.spolocny === true ? ([0, 1] as const) : [p]) z.zostavaLimit[q] = Math.max(0, z.zostavaLimit[q] - n);
  if (z.vlastny !== undefined) z.vlastny[p] = Math.max(0, z.vlastny[p] - n);
}

function cmdPass(s: MutState, data: GameData, p: PlayerId, events: Event[]): void {
  const z = s.zhromazdenieStav;
  need(s.faza === "zhromazdenie" && z !== null, "Teraz nie je Zhromaždenie.");
  need(!z.pasoval[p], "Už si pasoval.");
  z.pasoval[p] = true;
  z.navyse[p] = 0;
  // Pas (Michal 2026-10-20): cigareta za každú kartu, ktorú hráč ešte smel
  // vyložiť a má ju v ruke — aj keď pasuje hra za neho. Do Pitky už nehrá,
  // súper vykladá sám.
  const karty = kartyZaPas(z, p, s.hraci[p].ruka.length);
  const ziska = karty * KONSTANTY.CIGARETY_ZA_PAS_NA_KARTU;
  hrac(s, p).cigarety += ziska;
  events.push({
    type: "log",
    text:
      ziska > 0
        ? `Hráč ${p + 1} pasuje do Pitky a za ${pocet(karty, "nevyloženú kartu", "nevyložené karty", "nevyložených kariet")} dostáva ${cigariet(ziska)}.`
        : `Hráč ${p + 1} pasuje do Pitky.`,
  });
  posunTahZhromazdenia(s, data, p, events);
}

/**
 * Vypiť (pravidlá v3): plný poldeci sa otočí na vypitý. Limit vykladania
 * hneď klesne o 1 (poldeci už nie je plný), pečeň +1 a ráta sa ako nerest —
 * zato hráč ďalšou kartou neodovzdá ťah. Smie piť opakovane.
 */
function cmdVypit(s: MutState, data: GameData, p: PlayerId, events: Event[]): void {
  const z = s.zhromazdenieStav;
  need(s.faza === "zhromazdenie" && z !== null, "Vypiť sa dá len v Zhromaždení.");
  need(!z.pasoval[p], "Už si pasoval.");
  need(!zakazVypit(s as GameState), "Kostol: nikto nesmie vypiť.");
  need(s.hraci[p].poldeciPlne > 0, "Nemáš plný poldeci.");
  const player = hrac(s, p);
  player.poldeciPlne -= 1;
  player.poldeciVypite += 1;
  player.nerestiTotoKolo += 1;
  uberLimit(z, p, 1);
  z.navyse[p] += 1;
  events.push({ type: "log", text: `Hráč ${p + 1} pije do dna — zahrá ďalšiu kartu hneď, limit mu klesá na ${z.zostavaLimit[p]}.` });
  // Pečeň sa vyhodnocuje len v Pitke (Michal 2026-10-16): vypitie ju pripíše
  // dopredu a prah Cirhózy sa skontroluje v najbližšej Pitke.
  player.pecen += 1;
  events.push({ type: "pecen", hrac: p, mnozstvo: 1 });
}

// ---------------------------------------------------------------------------
// Pitka

function zacniPitku(s: MutState, data: GameData, events: Event[]): void {
  // Stopa posunov drží do konca Zhromaždenia po bitke (Michal 2026-10-26).
  s.posunyMarkerov = [];
  s.faza = "pitka";
  s.pitkaCislo += 1;
  s.zaciatokPitky = { pecen: [s.hraci[0].pecen, s.hraci[1].pecen], cirhozy: [s.cirhozyVKole[0], s.cirhozyVKole[1]] };
  events.push({ type: "faza", faza: "pitka" });
  events.push({ type: "log", text: `Pitka ${s.pitkaCislo}/${s.pitkyCelkom}.` });
  s.pitkaStav = {
    naTahu: obranca(s),
    hotovy: [false, false],
    naexPouzity: [false, false],
    fajcenie: [0, 0],
    reakcia: null,
    postarka: [false, false],
    starosta: [false, false],
    naexPocet: [0, 0],
    vykup: [false, false],
  };
  manualEfekty(s, data, "Pitka", events);
}

/**
 * Stav, v ktorom skryté NA EX už ležia na kartách (poldeci odpísané) — bez
 * pečene a efektov odkrytia. Len na odhad hodnoty NA EX (bot), nie do hry.
 */
export function sNaexNaKartach(state: GameState): GameState {
  const skryte = state.pitkaStav?.skryteNaex ?? [];
  if (skryte.length === 0 || state.pitkaStav === null) return state;
  const strany = state.strany.map((strana) =>
    strana.map((pl) => {
      const kto = skryte.filter((x) => x.uid === pl.card.uid).map((x) => x.hrac);
      const [prvy, druhy] = kto;
      if (prvy === undefined) return pl;
      return druhy === undefined ? { ...pl, naexBy: prvy } : { ...pl, naexBy: prvy, naexBy2: druhy, vytrznik: true as const };
    }),
  ) as unknown as GameState["strany"];
  const hraci = state.hraci.map((h, i) => ({ ...h, poldeciPlne: Math.max(0, h.poldeciPlne - skryte.filter((x) => x.hrac === i).length) })) as unknown as GameState["hraci"];
  return { ...state, strany, hraci, pitkaStav: { ...state.pitkaStav, skryteNaex: [] } };
}

/** Skryté NA EX hráča p v tejto Pitke (v5 NA EX naraz). */
function skryteHraca(pitka: Pick<PitkaStav, "skryteNaex"> | null, p: PlayerId): readonly SkryteNaex[] {
  return (pitka?.skryteNaex ?? []).filter((x) => x.hrac === p);
}

/**
 * NA EX naraz (v5 bod 2, Michal 2026-10-24/25): hráč vyberá NA EX skryto —
 * súper nevidí ani kartu, ani že nejaké dal (poldeci, pečeň a efekty sa
 * prejavia až pri odkrytí, keď obaja skončia Pitku). Ciele posudzuje podľa
 * toho, čo vidí: súperove skryté NA EX nie, preto môže trafiť tú istú kartu
 * (zrážka — Výtržník).
 */
function cmdNaex(
  s: MutState,
  data: GameData,
  cmd: { uid: number },
  p: PlayerId,
  events: Event[],
): void {
  const pitka = s.pitkaStav;
  need(s.faza === "pitka" && pitka !== null, "Teraz nie je Pitka.");
  need(pitka.reakcia === null, "Najprv odpovedz na NA EX.");
  need(!pitka.hotovy[p], "Svoju časť Pitky si už skončil.");
  need(!zakazNaex(s as GameState), "Kostol: nikto nesmie dať NA EX.");
  const moje = skryteHraca(pitka, p);
  // Skrytú Záverečnú súper cieli náhradným uid (uidZaverecnej) — skutočné nepozná.
  const skryta = skryteZaverecne(s as GameState).find((x) => uidZaverecnej(x.strana) === cmd.uid);
  const uidCiela = skryta === undefined ? cmd.uid : skryta.placed.card.uid;
  need(
    !naexLimitMinuty(data, s as GameState, p) || jePlacatka(data, s as GameState, p, uidCiela),
    naexZaPitku(s as GameState) > 1 ? "NA EX smieš dať najviac dvakrát za Pitku." : "NA EX smieš dať najviac raz za Pitku.",
  );
  need(s.hraci[p].poldeciPlne - moje.length > 0, "Nemáš plný poldeci.");
  const kde = najdiVLinii(s, uidCiela);
  need(kde !== null, "Karta neleží v žiadnej partii.");
  const placed = s.strany[kde.strana][kde.index] as DeepMutable<PlacedCard>;
  need(placed.naexBy === undefined && !moje.some((x) => x.uid === placed.card.uid), "Na karte už poldeci leží.");
  // NA EX na vlastnú aj súperovu kartu (Michal 2026-10-18 vrátil obmedzenie
  // z pravidiel v3 na „len vlastnú“) — akcie karty ostávajú jej majiteľovi.
  const def = defOf(data, placed.card as CardInstance);
  if (placed.zaverecna === true) {
    // Skrytá Záverečná (Michal 2026-10-23): majiteľ nie, súperovi NA EX prejde
    // vždy — kontrola tagu či zmyslu NA EX by kartu prezradila.
    need(placed.playedBy !== p, "Na svoju Záverečnú NA EX dať nemôžeš, kým sa neotočí.");
  } else {
    need(
      def.tags.includes("Občan") || def.tags.includes("Starešina"),
      "NA EX smie len na Občana alebo Starešinu.",
    );
    need(
      naexMaZmysel(data, lineState(s as GameState)).has(placed.card.uid),
      "NA EX smie len na kartu, ktorá má aspoň jednu aktívnu a aspoň jednu neaktívnu akciu.",
    );
  }
  pitka.skryteNaex = [...(pitka.skryteNaex ?? []), { hrac: p, uid: placed.card.uid }];
  // Len pre hráča — súperovi nesmie nič prezradiť (eventsFor).
  events.push({
    type: "log",
    pre: p,
    text: `Skryto dávaš NA EX na ${placed.zaverecna === true ? "súperovu Záverečnú" : `${placed.playedBy === p ? "svoju" : "súperovu"} kartu ${def.name}`} — odkryje sa, keď obaja skončíte Pitku.`,
  });
}

/**
 * Odkrytie NA EX naraz (v5): keď obaja skončia svoju časť Pitky. Najprv NA EX
 * obrancu, potom útočníka — poldeci, pečeň (pije ten, kto NA EX dal),
 * Výpalné, Vychovávateľka. Tú istú kartu oboch = zrážka, z karty je Výtržník.
 * Odpovede (jedna karta za každé súperovo NA EX): najprv obranca, útočník má
 * posledné slovo (Michal 2026-10-25, interview 4). Vracia true, keď sa čaká
 * na odpoveď.
 */
function odhalNaex(s: MutState, data: GameData, events: Event[]): boolean {
  const pitka = s.pitkaStav;
  if (pitka === null) return false;
  const skryte = pitka.skryteNaex ?? [];
  pitka.skryteNaex = [];
  if (skryte.length === 0) return false;
  const obr = obranca(s);
  const pocty: [number, number] = [0, 0];
  const vLimite: [number, number] = [0, 0];
  for (const p of [obr, s.utocnik] as const) {
    for (const x of skryte.filter((y) => y.hrac === p)) {
      const kde = najdiVLinii(s, x.uid);
      if (kde === null) continue;
      if (!jePlacatka(data, s as GameState, p, x.uid)) vLimite[p] += 1;
      const placed = s.strany[kde.strana][kde.index] as DeepMutable<PlacedCard>;
      const opp = opponentOf(p);
      const zrazka = placed.naexBy === opp;
      if (zrazka) {
        placed.naexBy2 = p;
        placed.vytrznik = true;
      } else placed.naexBy = p;
      hrac(s, p).poldeciPlne = Math.max(0, s.hraci[p].poldeciPlne - 1);
      s.naexVKole[p] = true;
      pocty[p] += 1;
      const meno =
        placed.zaverecna === true
          ? "súperovu Záverečnú (lícom dole)"
          : `${placed.playedBy === p ? "svoju" : "súperovu"} kartu ${defOf(data, placed.card as CardInstance).name}`;
      events.push({ type: "log", text: `Odkryté NA EX: hráč ${p + 1} dal NA EX na ${meno}.` });
      if (zrazka) {
        events.push({
          type: "log",
          text: `Zrážka NA EX: obaja dali poldeci na tú istú kartu — je z nej Výtržník, všetky jej akcie sú Rany pre hráča ${placed.playedBy + 1}.`,
        });
      }
      // Skryté Záverečné si NA EX zapamätajú pre Policajtku a Vychovávateľku pri otočení.
      zapisOdklad(s, opp, "naexSupera", 1);
      zapisOdklad(s, p, "naexVlastne", 1);
      // Pečeň z NA EX — poldeci pije ten, kto NA EX dal (PRAVIDLA §7).
      pridajPecen(s, data, p, 1, events);
      // vychovavatelka: súper si musí vziať jeden tvoj priznaný Dlh — do
      // doberacieho balíčka, nie na ruku (Michal 2026-10-19).
      if (maEfekt(s, data, p, "vychovavatelka")) presunDlhVychovavatelky(s, p, events);
      vypalne(s, data, p, events);
    }
  }
  // Policajtka porovná všetky NA EX Pitky (aj placatku); limit (Vínna pivnica dve, inde jedno) placatku neráta.
  pitka.naexPocet = [(pitka.naexPocet?.[0] ?? 0) + pocty[0], (pitka.naexPocet?.[1] ?? 0) + pocty[1]];
  for (const p of [0, 1] as const) pitka.naexPouzity[p] = pitka.naexPouzity[p] || vLimite[p] >= naexZaPitku(s as GameState);
  // Policajtka porovná NA EX hneď pri odkrytí — odpoveď na NA EX už počet nezmení.
  for (const p of [obr, s.utocnik] as const) policajtka(s, data, p, events);
  // Odpovede: obranca na NA EX útočníka, potom útočník na NA EX obrancu.
  pitka.frontaReakcii = [...Array<PlayerId>(pocty[s.utocnik]).fill(obr), ...Array<PlayerId>(pocty[obr]).fill(s.utocnik)];
  return dalsiaReakcia(s, data, events);
}

/** Ďalší v rade odpovedí na odkryté NA EX, ktorý má čím odpovedať; false = nikto. */
function dalsiaReakcia(s: MutState, data: GameData, events: Event[]): boolean {
  const pitka = s.pitkaStav;
  if (pitka === null) return false;
  const fronta = [...(pitka.frontaReakcii ?? [])];
  while (fronta.length > 0) {
    const q = fronta.shift() as PlayerId;
    if (!mozeReagovat(s as GameState, data, q)) continue;
    pitka.frontaReakcii = fronta;
    pitka.reakcia = q;
    pitka.naTahu = q;
    events.push({ type: "log", text: `Hráč ${q + 1} smie na NA EX odpovedať jednou kartou.` });
    return true;
  }
  pitka.frontaReakcii = [];
  pitka.reakcia = null;
  return false;
}

/**
 * Výpalné (priazeň Výpalníka, predtým Neprajník — v5, Michal 2026-10-25): za
 * KAŽDÉ NA EX hráča `dal` mu súper s touto priazňou vezme 1 / 2 / 3 cigarety (koľko má).
 */
function vypalne(s: MutState, data: GameData, dal: PlayerId, events: Event[]): void {
  const komu = opponentOf(dal);
  const n = Math.min(silaPriazne(data, s as GameState, "NEPRAJNIK", komu), s.hraci[dal].cigarety);
  if (n <= 0) return;
  hrac(s, dal).cigarety -= n;
  hrac(s, komu).cigarety += n;
  events.push({ type: "log", text: `Výpalné (priazeň Výpalníka): hráč ${dal + 1} platí za NA EX hráčovi ${komu + 1} ${cigariet(n)}.` });
}

/** Vychovávateľka hráča p: súper dostane jeho priznaný Dlh do doberacieho balíčka. */
function presunDlhVychovavatelky(s: MutState, p: PlayerId, events: Event[]): void {
  const opp = opponentOf(p);
  const idx = s.hraci[p].priznane.findIndex((k) => k.defId === "dlh");
  if (idx === -1) return;
  const dlh = hrac(s, p).priznane.splice(idx, 1)[0] as DeepMutable<CardInstance>;
  const [miesto, rng] = rngInt(s.rng, s.hraci[opp].doberaci.length + 1);
  s.rng = rng;
  hrac(s, opp).doberaci.splice(miesto, 0, dlh);
  events.push({ type: "log", text: `Vychovávateľka: hráč ${opp + 1} dostáva priznaný Dlh hráča ${p + 1} do doberacieho balíčka.` });
}

/** Spúšťač pre skrytú Záverečnú hráča majitel — vyhodnotí sa pri otočení. */
function zapisOdklad(s: MutState, majitel: PlayerId, co: keyof OdkladZaverecnej, kolko: number): void {
  const o = s.zaverecnaOdklad[majitel];
  if (o !== null) o[co] += kolko;
}

/**
 * NA EX hráča p — Občania a Starešinovia v línii (vlastní aj súperovi) bez
 * poldeci. Po minutom limite už len placatka (vlastný Anonymný alkoholik).
 */
export function moznostiNaex(data: GameData, state: GameState, p: PlayerId): number[] {
  const pitka = state.pitkaStav;
  if (pitka === null || pitka.reakcia !== null || pitka.hotovy[p] || zakazNaex(state)) return [];
  // NA EX naraz (v5): vlastné skryté NA EX sa rátajú do limitu, poldeci aj cieľov.
  const moje = skryteHraca(pitka, p);
  if (state.hraci[p].poldeciPlne - moje.length <= 0) return [];
  const minuty = naexLimitMinuty(data, state, p);
  // Súperova skrytá Záverečná má náhradné uid — porovnáva sa skutočná karta.
  const skutocne = (uid: number): number => skryteZaverecne(state).find((x) => uidZaverecnej(x.strana) === uid)?.placed.card.uid ?? uid;
  return naexCieleVLinii(data, lineState(state), p, naexNaZviera(state, p)).filter(
    (uid) => !moje.some((x) => x.uid === skutocne(uid)) && (!minuty || jePlacatka(data, state, p, skutocne(uid))),
  );
}

/** Čo treba na posúdenie limitu NA EX za Pitku — GameState aj pohľad klienta. */
type StavLimituNaex = VerejnyStav & { readonly pitkaStav: Pick<PitkaStav, "naexPouzity" | "skryteNaex"> | null };

/**
 * anonymny_alkoholik (Furt, Michal 2026-10-26 — „placatka“): NA EX hráča p na
 * vlastného Anonymného alkoholika sa do limitu NA EX za Pitku neráta. Súper
 * naňho NA EX dať smie, ale jemu sa do limitu ráta. Zákaz na Kostole a pravidlo
 * „na kartu s poldeci ďalšie NA EX nie“ platia aj tu, takže placatka je
 * najviac jedna na Anonymného alkoholika za kolo.
 */
export function jePlacatka(data: GameData, state: Pick<VerejnyStav, "strany">, p: PlayerId, uid: number): boolean {
  const ciel = [...state.strany[0], ...state.strany[1]].find((pl) => pl.card.uid === uid);
  return (
    ciel !== undefined &&
    ciel.card.defId === "anonymny_alkoholik" &&
    ciel.playedBy === p &&
    ciel.zaverecna !== true &&
    !efektPotlaceny(data, state, p, "anonymny_alkoholik")
  );
}

/**
 * Minul hráč p v tejto Pitke limit NA EX (Vínna pivnica dve, inde jedno)? Po
 * odkrytí to drží naexPouzity, pred ním sa rátajú jeho skryté NA EX — placatka nie.
 */
export function naexLimitMinuty(data: GameData, state: StavLimituNaex, p: PlayerId): boolean {
  const pitka = state.pitkaStav;
  if (pitka === null || pitka.naexPouzity[p]) return true;
  const vLimite = skryteHraca(pitka, p).filter((x) => !jePlacatka(data, state, p, x.uid)).length;
  return vLimite >= naexZaPitku(state);
}

/** Čo z pohľadu klienta treba na posúdenie NA EX (ClientState to spĺňa). */
export type PohladNaNaex = VerejnyStav & {
  readonly lokalitaOtocena: boolean;
  readonly faza: Phase;
  readonly ja: PlayerId;
  readonly mozemHrat: boolean;
  readonly vizia: GameState["vizia"];
  readonly pitkaStav: PitkaStav | null;
  readonly hraci: readonly [VerejnyHrac & { readonly poldeciPlne: number }, VerejnyHrac & { readonly poldeciPlne: number }];
  readonly zaverecne: readonly { readonly majitel: PlayerId; readonly uid: number; readonly naexBy: PlayerId | null }[];
};

/**
 * moznostiNaex z pohľadu hráča `view.ja` — tie isté podmienky ako cmdNaex, len
 * z toho, čo klient vidí (vlastné skryté NA EX áno, súperove nie). Klient podľa
 * toho kreslí značku NA EX na kartách: pri Kostole ju kreslil, hoci motor NA EX
 * nepustí (roadmapa #112).
 */
export function moznostiNaexVPohlade(data: GameData, view: PohladNaNaex): number[] {
  const pitka = view.pitkaStav;
  const ja = view.ja;
  if (!view.mozemHrat || view.faza !== "pitka" || view.vizia !== null || pitka === null) return [];
  if (pitka.reakcia !== null || pitka.hotovy[ja] || zakazNaex(view)) return [];
  const moje = skryteHraca(pitka, ja);
  if (view.hraci[ja].poldeciPlne - moje.length <= 0) return [];
  const minuty = naexLimitMinuty(data, view, ja);
  // Súperovu skrytú Záverečnú klient v línii nemá — doplní ju zo zaverecne (náhradné uid).
  const naRub = view.zaverecne.filter((z) => z.majitel !== ja && z.naexBy === null && !view.strany.some((st) => st.some((pl) => pl.card.uid === z.uid))).map((z) => z.uid);
  return [...naexCieleVLinii(data, lineState(view), ja, naexNaZviera(view, ja)), ...naRub].filter(
    (uid) => !moje.some((x) => x.uid === uid) && (!minuty || jePlacatka(data, view, ja, uid)),
  );
}

/**
 * Karty v línii, na ktoré smie hráč p dať NA EX — spoločné pre server aj klienta.
 * Súperova skrytá Záverečná ide vždy, a to náhradným uid (uidZaverecnej); klient
 * ju v strany nemá a doplní si ju zo zaverecne. Ostatné musia mať aspoň jednu
 * aktívnu a aspoň jednu neaktívnu akciu (naexMaZmysel, Michal 2026-10-23).
 */
export function naexCieleVLinii(data: GameData, line: LineState, p: PlayerId, naZviera = false): number[] {
  const out: number[] = [];
  const zmysel = naexMaZmysel(data, line);
  for (const [si, strana] of line.strany.entries()) {
    for (const placed of strana) {
      if (placed.zaverecna === true) {
        if (placed.naexBy === undefined && placed.playedBy !== p) out.push(uidZaverecnej(si as PlayerId));
        continue;
      }
      if (placed.naexBy !== undefined) continue;
      const tags = defOf(data, placed.card).tags;
      // Lievik (Dedičstvo, v7): aj na Zviera.
      if ((tags.includes("Občan") || tags.includes("Starešina") || (naZviera && tags.includes("Zviera"))) && zmysel.has(placed.card.uid)) out.push(placed.card.uid);
    }
  }
  return out;
}

/**
 * Karty, na ktoré má NA EX zmysel (Michal 2026-10-23): aspoň jedna akcia
 * aktívna (spárovaná a nezrušená Odporom) a aspoň jedna neaktívna — v okamihu
 * NA EX, aj Veterán. Skryté Záverečné sa do vyhodnotenia nerátajú, inak by
 * odmietnutie NA EX na ich suseda prezradilo, čo leží lícom dole.
 */
export function naexMaZmysel(data: GameData, line: LineState): ReadonlySet<number> {
  const verejne = line.strany.map((strana) => strana.filter((pl) => pl.zaverecna !== true)) as unknown as LineState["strany"];
  const ev = evaluateLine(data, { ...line, strany: verejne });
  const out = new Set<number>();
  for (const [uid, karta] of ev.cards) {
    const sloty = [...karta.left, ...karta.right];
    // Neaktívny Pakt NA EX nezdvojí (v7, plan.md 12.3 bod 6) — do „neaktívnej“ sa neráta.
    if (sloty.some((x) => x?.stav === "aktivna") && sloty.some((x) => x?.stav === "neaktivna" && x.action !== "Pakt")) out.add(uid);
  }
  return out;
}

/**
 * krcma: kto má plný poldeci (a kam ho dať), musí dať NA EX — jedno. Splní ho
 * aj placatka na vlastného Anonymného alkoholika (Michal 2026-10-26), preto
 * po prvom NA EX v Pitke povinnosť končí, aj keď placatka či druhé NA EX ešte ide.
 */
export function krcmaVyzaduje(data: GameData, state: GameState, p: PlayerId): boolean {
  const pitka = state.pitkaStav;
  const dal = skryteHraca(pitka, p).length + (pitka?.naexPocet?.[p] ?? 0) > 0;
  return jeCielLokalita(state, "krcma") && !dal && moznostiNaex(data, state, p).length > 0;
}

/** Hráč q má v ruke kartu, ktorú môže vyložiť do línie (reakcia je mimo limitu). */
function mozeReagovat(s: GameState, data: GameData, q: PlayerId): boolean {
  return s.hraci[q].ruka.some((k) =>
    cieleVykladania(data, s.strany, q, k, Number.POSITIVE_INFINITY, true, cielLokalitaId(s), [false, false], finaleBezStredu(s)).some((c) => c === "vlastna" || c === "superova"),
  );
}

function cmdReakcia(
  s: MutState,
  data: GameData,
  cmd: { uid: number; target: CielVykladania },
  p: PlayerId,
  events: Event[],
): void {
  const pitka = s.pitkaStav;
  need(s.faza === "pitka" && pitka !== null && pitka.reakcia === p, "Teraz nemôžeš reagovať na NA EX.");
  const prevahaPred = prevahaStran(data, s.strany);
  const pitkyPred = s.pitkyCelkom;
  vylozDoLinie(s, data, p, cmd.uid, cmd.target, events);
  // Odpoveď smie zmeniť prevahu v kraji aj počet Pitiek (PRAVIDLÁ, b22d4d6) —
  // hráč to musí vidieť (názor #27, Michal 2026-10-22).
  const prevahaPo = prevahaStran(data, s.strany);
  const kraje = krajeStran(data, s.ciel?.lokalita ?? null, s.lokalitaOtocena);
  for (const strana of [0, 1] as const) {
    const kto = prevahaPo[strana];
    if (kto === prevahaPred[strana]) continue;
    const kraj = kraje[strana] === null ? `pri strane hráča ${strana + 1}` : `v kraji ${kraje[strana]}`;
    events.push({ type: "log", text: `Odpoveď na NA EX: prevahu ${kraj} má teraz ${kto === null ? "nikto" : `hráč ${kto + 1}`}.` });
  }
  aktualizujPitky(s, data);
  if (s.pitkyCelkom !== pitkyPred) {
    events.push({ type: "log", text: `Odpoveď na NA EX: Pitiek v kole je ${s.pitkyCelkom} namiesto ${pitkyPred}.` });
  }
  if (odlozPoHasicovi(s, "reakcia")) return;
  ukonciReakciu(s, data, events);
}

function cmdBezReakcie(s: MutState, data: GameData, p: PlayerId, events: Event[]): void {
  const pitka = s.pitkaStav;
  need(s.faza === "pitka" && pitka !== null && pitka.reakcia === p, "Teraz nemôžeš reagovať na NA EX.");
  events.push({ type: "log", text: `Hráč ${p + 1} na NA EX neodpovedá.` });
  ukonciReakciu(s, data, events);
}

/** Po odpovedi odpovedá ďalší v rade (v5: obranca, potom útočník); keď nikto, Pitka sa vyhodnotí. */
function ukonciReakciu(s: MutState, data: GameData, events: Event[]): void {
  const pitka = s.pitkaStav;
  if (pitka === null || pitka.reakcia === null) return;
  pitka.reakcia = null;
  if (dalsiaReakcia(s, data, events)) return;
  vyhodnotPitku(s, data, events);
}

/** postarka (Pitka): dober 1 až 2 karty navyše a spolu s nimi 1 Dlh. */
function cmdPostarka(s: MutState, data: GameData, cmd: { pocet: number }, p: PlayerId, events: Event[]): void {
  const pitka = s.pitkaStav;
  need(s.faza === "pitka" && pitka !== null && pitka.reakcia === null, "Poštárka platí v Pitke.");
  need(maEfekt(s, data, p, "postarka"), "Poštárku nemáš.");
  need(!pitka.postarka[p], "Poštárku si v tejto Pitke už použil.");
  const najviac = KONSTANTY.EFEKT.POSTARKA_KARTY;
  need(Number.isInteger(cmd.pocet) && cmd.pocet >= 1 && cmd.pocet <= najviac, `Dobrať smieš 1 až ${najviac} kariet.`);
  // Rozhodca #8 (Michal 2026-10-22): Dlh len za naozaj dobratú kartu — naprázdno sa Poštárka nepoužije.
  need(jeCoTahat(s.hraci[p].doberaci.length, s.hraci[p].odhadzovaci.length), "Nemáš z čoho ťahať — doberací aj odhadzovací balíček sú prázdne.");
  pitka.postarka[p] = true;
  const dobrate = tahaj(s, p, cmd.pocet, events);
  // Balíček mohol mať len Dlhy (samy sa priznajú) — do ruky nič, Dlh z Poštárky nie.
  const dlhy = dobrate.length > 0 ? KONSTANTY.EFEKT.POSTARKA_DLHY : 0;
  for (let i = 0; i < dlhy; i++) pridajKliatbu(s, data, p, "dlh", events);
  events.push({ type: "log", text: `Poštárka: hráč ${p + 1} ${rodovo(p, "dobral", "dobrala", "doberá")} ${kariet(dobrate.length)}${dlhy > 0 ? ` a ${pocet(dlhy, "Dlh", "Dlhy", "Dlhov")}` : ""}.` });
}

/** starosta (Pitka): za cigaretu vymeň kartu z ruky za kartu zo šenku. */
function cmdStarosta(
  s: MutState,
  data: GameData,
  cmd: { rukaUid: number; senokUid: number },
  p: PlayerId,
  events: Event[],
): void {
  const pitka = s.pitkaStav;
  need(s.faza === "pitka" && pitka !== null && pitka.reakcia === null, "Starosta platí v Pitke.");
  need(maEfekt(s, data, p, "starosta"), "Starostu nemáš.");
  need(!pitka.starosta[p], "Starostu si v tejto Pitke už použil.");
  need(s.hraci[p].cigarety >= 1, "Treba cigaretu.");
  const senokIdx = s.senok.findIndex((k) => k.uid === cmd.senokUid);
  need(senokIdx !== -1, "Karta nie je v šenku.");
  need(!jeKartaPatronatu(s as GameState, cmd.rukaUid), "Staršieho z patronátu do šenku nedáš.");
  // Kšeft Starostu (v7): Cirhózu z ruky do šenku nevymeníš — obišla by −5 špakov na konci.
  need(s.hraci[p].ruka.find((k) => k.uid === cmd.rukaUid)?.defId !== "cirhoza", "Cirhózu Starosta nevymení.");
  const zRuky = vezmiZRuky(s, p, cmd.rukaUid);
  const zoSenku = s.senok.splice(senokIdx, 1, zRuky as DeepMutable<CardInstance>)[0] as CardInstance;
  hrac(s, p).ruka.push(zoSenku as DeepMutable<CardInstance>);
  hrac(s, p).cigarety -= 1;
  pitka.starosta[p] = true;
  events.push({
    type: "log",
    text: `Starosta: hráč ${p + 1} ${rodovo(p, "vymenil", "vymenila", "vymieňa")} ${defOf(data, zRuky).name} za ${defOf(data, zoSenku).name} zo šenku.`,
  });
}

/**
 * Fajčenie (Michal 2026-10-16): cigareta = jedna karta hneď, ťah to neukončí.
 * Od v5 (Michal 2026-10-24) len v Pitke — v Zhromaždení si hráč kartu
 * fajčením nedoberie. Cigarety sa prenášajú z kola na kolo.
 */
/**
 * Fajčenie dáva kartu z doberacieho balíčka (s premiešaním odhadzovacieho).
 * Keď sú oba prázdne, cigareta by sa minula naprázdno — príkaz je neplatný.
 */
export function jeCoTahat(doberaci: number, odhadzovaci: number): boolean {
  return doberaci + odhadzovaci > 0;
}

/**
 * Cena fajčenia (Michal 2026-10-27): `pocet` ďalších fajčení po `uz` fajčeniach
 * v tej istej Pitke — k-te stojí CENA_FAJCENIA_ZAKLAD + (k − 1) × PRIRASTOK,
 * viac naraz je súčet (1 + 2 + …).
 */
export function cenaFajcenia(uz: number, pocet = 1): number {
  let cena = 0;
  for (let i = 0; i < pocet; i++) cena += KONSTANTY.CENA_FAJCENIA_ZAKLAD + (uz + i) * KONSTANTY.CENA_FAJCENIA_PRIRASTOK;
  return cena;
}

/** Cena najbližšieho fajčenia hráča p v prebiehajúcej Pitke (mimo Pitky ako prvé). */
export function cenaFajceniaHraca(s: { readonly pitkaStav: Pick<PitkaStav, "fajcenie"> | null }, p: PlayerId, pocet = 1): number {
  return cenaFajcenia(s.pitkaStav?.fajcenie[p] ?? 0, pocet);
}

function cmdSmoke(s: MutState, cmd: { pocet: number }, p: PlayerId, events: Event[]): void {
  const pitka = s.pitkaStav;
  const vPitke = s.faza === "pitka" && pitka !== null && pitka.reakcia === null;
  need(vPitke, "Fajčiť sa dá len v Pitke.");
  need(!zakazFajcit(s as GameState), "Benzínka: nikto nesmie fajčiť.");
  need(cmd.pocet > 0 && Number.isInteger(cmd.pocet), "Počet kariet musí byť kladný.");
  const cena = cenaFajcenia(pitka.fajcenie[p], cmd.pocet);
  need(s.hraci[p].cigarety >= cena, `Fajčiť teraz stojí ${cigariet(cena)}, máš ${s.hraci[p].cigarety}.`);
  need(jeCoTahat(s.hraci[p].doberaci.length, s.hraci[p].odhadzovaci.length), "Nemáš z čoho ťahať — doberací aj odhadzovací balíček sú prázdne.");
  hrac(s, p).cigarety -= cena;
  // Nerest je každá vyfajčená cigareta (§8) — aj tie, o ktoré je ďalšie fajčenie drahšie.
  hrac(s, p).nerestiTotoKolo += cena;
  const tahane = tahaj(s, p, cmd.pocet, events);
  pitka.fajcenie[p] += cmd.pocet;
  events.push({ type: "log", text: `Hráč ${p + 1} fajčí za ${cigariet(cena)} a doberá si ${kariet(tahane.length)}.` });
}

/** Cena stokárskeho barteru hráča p (Lakomec ju vo v5 nezlacňuje — je z neho Abstinent). */
export function barterCena(_data: GameData, s: VerejnyStav, _p: PlayerId): number {
  // jednota (Michal 2026-10-20): barter o 1 cigaretu lacnejší.
  return Math.max(1, cenaBarteru() - barterZlavaLokality(s));
}

/** Zberný dvor (Pitka): raz za Pitku za cigaretu karta z vlastného odhadzovacieho balíčka do ruky. */
function cmdVykup(s: MutState, data: GameData, cmd: { uid: number }, p: PlayerId, events: Event[]): void {
  const pitka = s.pitkaStav;
  need(s.faza === "pitka" && pitka !== null && pitka.reakcia === null && s.vizia === null, "Výkup sa robí počas Pitky.");
  need(vykupZoSrotu(s as GameState), "Výkup je len na Zbernom dvore.");
  need(pitka.vykup?.[p] !== true, "Výkup si v tejto Pitke už použil.");
  need(s.hraci[p].cigarety >= KONSTANTY.EFEKT.ZBERNY_DVOR_CENA, "Na výkup treba cigaretu.");
  const idx = s.hraci[p].odhadzovaci.findIndex((k) => k.uid === cmd.uid);
  need(idx !== -1, "Karta nie je v tvojom odhadzovacom balíčku.");
  const karta = hrac(s, p).odhadzovaci.splice(idx, 1)[0] as DeepMutable<CardInstance>;
  doRuky(s, p, karta, events);
  hrac(s, p).cigarety -= KONSTANTY.EFEKT.ZBERNY_DVOR_CENA;
  hrac(s, p).nerestiTotoKolo += 1;
  pitka.vykup = p === 0 ? [true, pitka.vykup?.[1] ?? false] : [pitka.vykup?.[0] ?? false, true];
  events.push({ type: "log", text: `Zberný dvor: hráč ${p + 1} vykupuje zo šrotu ${defOf(data, karta as CardInstance).name} za cigaretu.` });
}

function cmdBarter(s: MutState, data: GameData, p: PlayerId, events: Event[]): void {
  need(s.faza === "pitka" && s.pitkaStav?.reakcia === null, "Barter sa robí počas Pitky.");
  // Zjednodušenie v1: barter berie len cigarety, ktoré hráč má (pravidlá pripúšťajú
  // aj aktívne akcie Cigareta) — viď README.
  const cena = barterCena(data, s as GameState, p);
  need(s.hraci[p].cigarety >= cena, `Na barter treba ${cigariet(cena)}.`);
  hrac(s, p).cigarety -= cena;
  hrac(s, p).nerestiTotoKolo += cena;
  hrac(s, p).poldeciPlne += 1;
  events.push({ type: "log", text: `Hráč ${p + 1} robí stokársky barter za ${cigariet(cena)} — nový plný poldeci.` });
}

function cmdRefill(s: MutState, data: GameData, p: PlayerId, events: Event[]): void {
  need(s.faza === "pitka" && s.pitkaStav?.reakcia === null, "Poldeci sa dopĺňa počas Pitky.");
  need(!doliatieZakazane(s as GameState, p), "Vínko: poldeci za cigarety dolievať nesmieš.");
  if (doliatieNaKari(s as GameState)) {
    // Kar (v7): doliatie zadarmo, ale +1 pečeň; nerest ako bežné doliatie (plan.md 7.5 bod 3).
    need(s.hraci[p].poldeciVypite > 0, "Nemáš vypitý poldeci.");
    hrac(s, p).nerestiTotoKolo += KONSTANTY.REFILL_CENA;
    hrac(s, p).poldeciVypite -= 1;
    hrac(s, p).poldeciPlne += 1;
    events.push({ type: "log", text: `Kar: hráč ${p + 1} si dolieva zadarmo — pečeň +1.` });
    pitieVPitke(s, p, 1);
    pridajPecen(s, data, p, 1, events);
    return;
  }
  need(s.hraci[p].cigarety >= KONSTANTY.REFILL_CENA, `Treba ${KONSTANTY.REFILL_CENA} cigarety.`);
  need(s.hraci[p].poldeciVypite > 0, "Nemáš vypitý poldeci.");
  hrac(s, p).cigarety -= KONSTANTY.REFILL_CENA;
  hrac(s, p).nerestiTotoKolo += KONSTANTY.REFILL_CENA;
  hrac(s, p).poldeciVypite -= 1;
  hrac(s, p).poldeciPlne += 1;
  events.push({ type: "log", text: `Hráč ${p + 1} otáča poldeci za 2 cigarety.` });
}

function cmdSkipNaex(s: MutState, data: GameData, p: PlayerId, events: Event[]): void {
  const pitka = s.pitkaStav;
  need(s.faza === "pitka" && pitka !== null && pitka.reakcia === null, "Teraz nie je Pitka.");
  need(!pitka.hotovy[p], "Už si skončil.");
  need(!krcmaVyzaduje(data, s as GameState, p), "Krčma: kým máš plný poldeci, musíš dať NA EX.");
  pitka.hotovy[p] = true;
  const oppon = opponentOf(p);
  // Záznam pre súpera (Michal 2026-10-21): bez neho to vyzeralo, že Pitku
  // začína on — hotovo obrancu nezanechalo žiadnu stopu.
  // NA EX naraz (v5): či hráč NA EX dal, sa súper dozvie až pri odkrytí.
  events.push({
    type: "log",
    text: pitka.hotovy[oppon]
      ? `Hráč ${p + 1} končí svoju časť Pitky — NA EX sa odkryjú a Pitka sa vyhodnotí.`
      : `Hráč ${p + 1} končí svoju časť Pitky. Na ťahu je hráč ${oppon + 1}.`,
  });
  if (!pitka.hotovy[oppon]) {
    pitka.naTahu = oppon;
    return;
  }
  // NA EX naraz (v5): obaja skončili — skryté NA EX sa odkryjú a odpovedá sa na ne.
  if (odhalNaex(s, data, events)) return;
  vyhodnotPitku(s, data, events);
}

/** Automatické kroky Pitky 2–7 (PRAVIDLA §7). */
function vyhodnotPitku(s: MutState, data: GameData, events: Event[]): void {
  const pitka = s.pitkaStav;
  if (pitka === null) return;
  const vyhodnotenie = evaluateLine(data, lineState(s as GameState));
  const sums = vyhodnotenie.sums;
  // Prírastky počíta prirastkyPitky — ten istý výpočet ukazuje náhľad (nahladPitky).
  const prirastky = prirastkyPitky(data, s as GameState, vyhodnotenie);
  const ucet = { cirhozy: [0, 0] as [number, number], dlhy: [0, 0] as [number, number], cigarety: [0, 0] as [number, number] };
  const kliatbyPred = ([0, 1] as const).map((p) => ({
    cirhozy: s.cirhozyVKole[p],
    dlhy: s.hraci[p].priznane.filter((k) => k.defId === "dlh").length,
  }));
  const zadlzeniePred: [number, number] = [s.hraci[0].zadlzenie, s.hraci[1].zadlzenie];

  // 2. Dlh — aktívne akcie Dlh postihujú majiteľa karty, Dlhy Finančnej
  //    poradkyne súpera.
  for (const p of [0, 1] as const) pridajZadlzenie(s, data, p, prirastky.zadlzenie[p], events);

  // 3. Poškodenie pečene: akcie Poškodenie pečene a Poldeci [R6b]; NA EX už pripísané,
  //    pitie do dna zo Zhromaždenia čaká na prah práve tu.
  for (const p of [0, 1] as const) {
    pridajPecen(s, data, p, prirastky.poskodeniePecene[p], events);
    pridajPecen(s, data, p, prirastky.poldeci[p], events);
    skontrolujPrahPecene(s, data, p, events);
  }

  // 4.–6. Obmedzenie, Cigarety, ťahanie (Michal 2026-10-16): aktívne akcie
  //    Cigareta dávajú cigarety, súperove Obmedzenia ich uberú.
  //    Karty si hráč doberá fajčením (cmdSmoke) — kedy chce.
  const cigaretyPitky = cigaretyZPitky(data, s as GameState, sums, s.pitkaCislo);
  for (const p of [0, 1] as const) {
    const ziska = cigaretyPitky[p];
    ucet.cigarety[p] = ziska;
    if (ziska > 0) {
      hrac(s, p).cigarety += ziska;
      events.push({
        type: "log",
        text: `Hráč ${p + 1} získava ${cigariet(ziska)}.`,
      });
    }
  }

  for (const p of [0, 1] as const) {
    ucet.cirhozy[p] = s.cirhozyVKole[p] - (kliatbyPred[p]?.cirhozy ?? 0);
    ucet.dlhy[p] = s.hraci[p].priznane.filter((k) => k.defId === "dlh").length - (kliatbyPred[p]?.dlhy ?? 0);
  }
  events.push({ type: "pitkaVysledok", pitka: s.pitkaCislo, ...ucet });
  const zaciatok = s.zaciatokPitky ?? { pecen: [0, 0], cirhozy: [kliatbyPred[0]?.cirhozy ?? 0, kliatbyPred[1]?.cirhozy ?? 0] };
  const rekap = rekapitulaciaPitky(data, {
    pitka: s.pitkaCislo,
    pitkyCelkom: Math.max(s.pitkaCislo, s.pitkyCelkom),
    line: lineState(s as GameState),
    linia: vyhodnotenie,
    zadlzenieZoStola: prirastky.zadlzenie,
    poskodeniePecene: prirastky.poskodeniePecene,
    poldeci: prirastky.poldeci,
    zadlzeniePred,
    prahDlhu: prahDlhu(),
    dlhy: ucet.dlhy,
    pecenNaZaciatku: [zaciatok.pecen[0], zaciatok.pecen[1]],
    naexDal: [pitka.naexPocet?.[0] ?? 0, pitka.naexPocet?.[1] ?? 0],
    prahPecene: [prahCirhozy() + prahCirhozyBonus(s as GameState, 0), prahCirhozy() + prahCirhozyBonus(s as GameState, 1)],
    cirhozy: [s.cirhozyVKole[0] - zaciatok.cirhozy[0], s.cirhozyVKole[1] - zaciatok.cirhozy[1]],
    cigarety: ucet.cigarety,
  });
  s.pitkyKola = [...(s.pitkyKola ?? []), rekap as DeepMutable<RekapitulaciaPitky>];

  // 7. Vízia (Michal 2026-10-19): za každú aktívnu Víziu sa hráč pozrie na
  //    vrchnú kartu svojho doberacieho balíčka a rozhodne — do ruky, alebo
  //    zahodiť (preč z hry: kliatba či slabá karta). Predtým Vízia len
  //    preosievala kliatby medzi kartami dobratými v Pitke.
  const vizie: [number, number] = [sums[0].Vízia ?? 0, sums[1].Vízia ?? 0];
  if (vizie[0] + vizie[1] > 0) {
    s.vizia = { zostava: vizie };
    if (pripravVizia(s)) return;
  }
  dokonciPitku(s, data, events);
}

/**
 * policajtka (Pitka, Michal 2026-10-26 — nahradila „súperove Pohoršenia
 * neplatia“): ak súper majiteľa p dal v tejto Pitke viac NA EX ako p (placatka
 * sa ráta), dostane pri odkrytí NA EX Dlh — jeden, nie za každé NA EX navyše.
 * Pri rovnosti a na Kostole (0 : 0) nič. Platí odkrytá Policajtka v línii
 * v okamihu odkrytia (nie vyložená až ako odpoveď); skrytú Záverečnú vyhodnotí
 * otocZaverecne.
 */
function policajtka(s: MutState, data: GameData, p: PlayerId, events: Event[]): void {
  const opp = opponentOf(p);
  const pocet = s.pitkaStav?.naexPocet ?? [0, 0];
  const dlhy = dlhyPolicajtky(data, s as GameState, p, pocet[opp], pocet[p]);
  for (let i = 0; i < dlhy; i++) dlhOdPolicajtky(s, data, opp, pocet[opp], pocet[p], events);
}

/**
 * Koľko Dlhov dá Policajtka hráča p súperovi, ktorý dal v Pitke `naexSupera`
 * NA EX proti `naexMajitela` — každá odkrytá Policajtka jeden; 0, keď súper
 * nedal viac alebo Policajtku umlčal Praudovravec. Pre motor aj náhľad NA EX.
 */
export function dlhyPolicajtky(data: GameData, s: VerejnyStav, p: PlayerId, naexSupera: number, naexMajitela: number): number {
  if (naexSupera <= naexMajitela || !efektHraca(s, p, "policajtka") || efektPotlaceny(data, s, p, "policajtka")) return 0;
  return Math.max(1, partiaHraca(s, p).filter((pl) => pl.card.defId === "policajtka" && pl.zaverecna !== true).length);
}

/** Policajtka dá hráčovi `komu` Dlh (hneď priznaný) za NA EX `jeho` : `majitela`. */
function dlhOdPolicajtky(s: MutState, data: GameData, komu: PlayerId, jeho: number, majitela: number, events: Event[]): void {
  events.push({ type: "log", text: `Policajtka: hráč ${komu + 1} dal v tejto Pitke viac NA EX (${jeho} : ${majitela}) — dostáva Dlh.` });
  pridajKliatbu(s, data, komu, "dlh", events);
}

/**
 * Cigarety, ktoré hráči dostanú vo vyhodnotení Pitky číslo `pitkaCislo`
 * (PRAVIDLA §7 krok 5) — jeden výpočet pre motor aj náhľad NA EX, aby cena
 * ťahu v cigaretách sedela so zúčtovaním (návrh #1, playtest 20261024-075830).
 */
export function cigaretyZPitky(
  data: GameData,
  s: VerejnyStav,
  sums: readonly [ActionSums, ActionSums],
  pitkaCislo: number,
): readonly [number, number] {
  const pre = (p: PlayerId): number => {
    // Fajčiar v5 dáva cigarety po šenku (dalsiVBerani), nie v Pitke.
    const cigarety = sums[p].Cigareta ?? 0;
    const obmedzenia = sums[opponentOf(p)].Obmedzenie ?? 0;
    // cigorky (Dedičstvo): v každej Pitke cigareta navyše — Obmedzenie ju neuberie.
    const cigorky = vDedicstve(s, p, "cigorky") ? KONSTANTY.EFEKT.CIGORKY_CIGARETY : 0;
    return Math.max(0, cigarety - obmedzenia) + cigorky;
  };
  return [pre(0), pre(1)];
}

/** Na koho sa vo Vízii čaká — obranca pred útočníkom. */
function viziaNaTahu(state: GameState): PlayerId | null {
  if (state.vizia === null) return null;
  for (const p of [obranca(state), state.utocnik] as const) if (state.vizia.zostava[p] > 0) return p;
  return null;
}

/**
 * Vrchná karta pre Víziu: prázdny doberací balíček sa doplní zamiešaním
 * odhadzovacieho; kto nemá žiadnu kartu, Víziu stráca. Vráti true, keď sa
 * čaká na rozhodnutie hráča.
 */
function pripravVizia(s: MutState): boolean {
  const v = s.vizia;
  if (v === null) return false;
  for (const p of [obranca(s), s.utocnik] as const) {
    if (v.zostava[p] <= 0) continue;
    const player = hrac(s, p);
    if (player.doberaci.length === 0 && player.odhadzovaci.length > 0) {
      const [premiesane, rng] = rngShuffle(s.rng, player.odhadzovaci);
      s.rng = rng;
      player.doberaci = premiesane as DeepMutable<CardInstance>[];
      player.odhadzovaci = [];
    }
    if (player.doberaci.length > 0) return true;
    v.zostava[p] = 0;
  }
  s.vizia = null;
  return false;
}

function cmdVizia(s: MutState, data: GameData, cmd: { vziat: boolean }, p: PlayerId, events: Event[]): void {
  need(s.faza === "pitka" && s.vizia !== null && viziaNaTahu(s as GameState) === p, "Teraz nerozhoduješ o Vízii.");
  const vrchna = s.hraci[p].doberaci[0];
  need(vrchna !== undefined, "Doberací balíček je prázdny.");
  if (cmd.vziat) {
    tahaj(s, p, 1, events);
    events.push({ type: "log", text: `Vízia: hráč ${p + 1} si vrchnú kartu balíčka berie do ruky.` });
  } else {
    hrac(s, p).doberaci.shift();
    events.push({ type: "log", text: `Vízia: hráč ${p + 1} zahadzuje vrchnú kartu balíčka — ${defOf(data, vrchna as CardInstance).name}.` });
    poZahodeni(s, data, p, 1, events);
  }
  s.vizia.zostava[p] -= 1;
  if (pripravVizia(s)) return;
  dokonciPitku(s, data, events);
}

const HASIC_NAJPRV = "Najprv rozhodni o karte, ktorú vytiahol Hasič.";

/** Čaká sa, kým hráč rozhodne o karte z Hasiča? */
export function cakaHasic(state: Pick<GameState, "hasicVolby">): boolean {
  return (state.hasicVolby?.length ?? 0) > 0;
}

/**
 * Keď práve vyložený Hasič čaká na voľbu, zapamätá, čo má hra urobiť po nej,
 * a vráti true — volajúci tok hry zastaví.
 */
function odlozPoHasicovi(s: MutState, potom: NonNullable<HasicVolba["potom"]>): boolean {
  const volby = s.hasicVolby ?? [];
  const posledna = volby[volby.length - 1];
  if (posledna === undefined) return false;
  posledna.potom = potom;
  return true;
}

/**
 * Hasič: vytiahnutú kartu si hráč nechá v ruke (Dlh sa ako vždy sám prizná
 * a hráč ťahá ďalšiu kartu), alebo ju vráti do odhadzovacieho balíčka.
 * Potom dobehne, čo hra kvôli voľbe odložila.
 */
function cmdHasic(s: MutState, data: GameData, cmd: { nechat: boolean }, p: PlayerId, events: Event[]): void {
  const [volba, ...dalsie] = s.hasicVolby ?? [];
  need(volba !== undefined && volba.hrac === p && volba.typ === undefined, "Teraz nerozhoduješ o karte od Hasiča.");
  s.hasicVolby = dalsie;
  const idx = s.hraci[p].odhadzovaci.findIndex((k) => k.uid === volba.uid);
  if (idx === -1) {
    // Zvyšok toho istého ťahu (napr. Niekoho stryná) ju medzitým odniesol.
    events.push({ type: "log", text: `Hasič: karta hráča ${p + 1} už v odhadzovacom balíčku nie je.` });
  } else if (cmd.nechat) {
    const karta = hrac(s, p).odhadzovaci.splice(idx, 1)[0] as DeepMutable<CardInstance>;
    events.push({ type: "log", text: `Hasič: hráč ${p + 1} si kartu ${defOf(data, karta as CardInstance).name} necháva v ruke.` });
    doRuky(s, p, karta, events);
  } else {
    const meno = defOf(data, s.hraci[p].odhadzovaci[idx] as CardInstance).name;
    events.push({ type: "log", text: `Hasič: hráč ${p + 1} vracia kartu ${meno} do odhadzovacieho balíčka.` });
  }
  dokonciPoVolbe(s, data, volba, events);
}

/** Po voľbe Hasiča, Klebetnice či Dohadzovačky dobehne, čo hra kvôli nej odložila. */
function dokonciPoVolbe(s: MutState, data: GameData, volba: HasicVolba, events: Event[]): void {
  if (volba.potom === "reakcia") ukonciReakciu(s, data, events);
  else if (volba.potom === "koniecPitky") dokonciPitku(s, data, events);
}

/** Príkazy, ktoré čakajúca voľba (Hasič, Klebetnica, Dohadzovačka) dovoľuje. */
function volbyNastupu(state: GameState): Command[] {
  const volba = state.hasicVolby?.[0];
  if (volba === undefined) return [];
  if (volba.typ === "klebetnica") return state.hraci[opponentOf(volba.hrac)].ruka.map((k) => ({ type: "klebetnica", uid: k.uid }) as Command);
  if (volba.typ === "dohadzovacka") {
    const out: Command[] = [];
    state.starsi.forEach((a, i) => state.starsi.slice(i + 1).forEach((b) => out.push({ type: "dohadzovacka", elderA: a.elderId, elderB: b.elderId })));
    return out;
  }
  return [{ type: "hasic", nechat: true }, { type: "hasic", nechat: false }];
}

/** Klebetnica (Nástup, v7): vybranú kartu zo súperovej ruky dá naspodok jeho doberacieho balíčka. */
function cmdKlebetnica(s: MutState, data: GameData, cmd: { uid: number }, p: PlayerId, events: Event[]): void {
  const [volba, ...dalsie] = s.hasicVolby ?? [];
  need(volba !== undefined && volba.hrac === p && volba.typ === "klebetnica", "Teraz nerozhoduješ za Klebetnicu.");
  const opp = opponentOf(p);
  const idx = s.hraci[opp].ruka.findIndex((k) => k.uid === cmd.uid);
  need(idx !== -1, "Taká karta v súperovej ruke nie je.");
  s.hasicVolby = dalsie;
  const karta = hrac(s, opp).ruka.splice(idx, 1)[0] as DeepMutable<CardInstance>;
  hrac(s, opp).doberaci.push(karta);
  events.push({ type: "log", text: `Klebetnica: hráč ${p + 1} posiela súperovi kartu ${defOf(data, karta as CardInstance).name} naspodok jeho doberacieho balíčka.` });
  dokonciPoVolbe(s, data, volba, events);
}

/** Dohadzovačka (Nástup, v7): dvom starším sa vymenia scorecardy (priazne), markery ostanú. */
function cmdDohadzovacka(s: MutState, data: GameData, cmd: { elderA: string; elderB: string }, p: PlayerId, events: Event[]): void {
  const [volba, ...dalsie] = s.hasicVolby ?? [];
  need(volba !== undefined && volba.hrac === p && volba.typ === "dohadzovacka", "Teraz nerozhoduješ za Dohadzovačku.");
  const a = s.starsi.find((e) => e.elderId === cmd.elderA);
  const b = s.starsi.find((e) => e.elderId === cmd.elderB);
  need(a !== undefined && b !== undefined && a !== b, "Vyber dvoch rôznych starších.");
  s.hasicVolby = dalsie;
  const sc = a.scorecard;
  a.scorecard = b.scorecard;
  b.scorecard = sc;
  events.push({
    type: "log",
    text: `Dohadzovačka: hráč ${p + 1} vymieňa priazne starším ${defOf(data, a.karta as CardInstance).name} a ${defOf(data, b.karta as CardInstance).name}.`,
  });
  dokonciPoVolbe(s, data, volba, events);
}

/** Pečeň z pitia počas Pitky (Kar, Oslávenec) — rekapitulácia ju ráta ako pitie zo Zhromaždenia. */
function pitieVPitke(s: MutState, p: PlayerId, n: number): void {
  if (s.zaciatokPitky != null) s.zaciatokPitky.pecen[p] += n;
}

/** Karty s Kšeftom v línii (lokality majú vlastné id nižšie). */
const KSEFTY_KARIET: readonly string[] = ["kapybara", "stryko_z_ameriky", "oslavenec", "smetiarka"];
const KSEFTY_LOKALIT: readonly string[] = ["jednota", "sklad", "predsedova_vila"];
const KAPYBARA_CENA = 2;
const STRYKO_CENA = 2;
const OSLAVENEC_PECEN = 2;
const JEDNOTA_CIGARETY = 2;
const SKLAD_CENA = 1;
const VILA_CENA = 2;

/** Kšeft použitý hráčom p v tejto Pitke? */
function kseftPouzity(s: Pick<GameState, "pitkaStav">, p: PlayerId, uid: number): boolean {
  return s.pitkaStav?.kseft?.[p].includes(uid) === true;
}

/**
 * Kšefty, ktoré hráč p teraz smie spustiť (v7, plan.md 7.4, karty-kolo2 1.3):
 * v Pitke na svojom ťahu, nie počas odpovede na NA EX, každú kartu raz za Pitku;
 * karta v jeho partii (nie skrytá Záverečná), Kšeft lokality obaja.
 */
export function moznostiKseftu(data: GameData, state: GameState, p: PlayerId): Command[] {
  const pitka = state.pitkaStav;
  if (state.faza !== "pitka" || pitka === null || pitka.reakcia !== null || state.vizia !== null || pitka.hotovy[p]) return [];
  const h = state.hraci[p];
  const opp = opponentOf(p);
  const out: Command[] = [];
  for (const pl of partiaHraca(state, p)) {
    const uid = pl.card.uid;
    if (pl.zaverecna === true || !KSEFTY_KARIET.includes(pl.card.defId) || kseftPouzity(state, p, uid)) continue;
    switch (pl.card.defId) {
      case "kapybara":
        if (h.cigarety >= KAPYBARA_CENA) out.push({ type: "kseft", uid });
        break;
      case "stryko_z_ameriky":
        if (h.cigarety >= STRYKO_CENA) out.push({ type: "kseft", uid });
        break;
      case "oslavenec":
        // Poldeci sľúbené skrytému NA EX už nalievať nemožno.
        if (h.poldeciPlne - skryteHraca(pitka, p).length > 0 && !zakazVypit(state)) out.push({ type: "kseft", uid });
        break;
      case "smetiarka":
        for (const k of h.ruka) if (!defOf(data, k).tags.includes("Kliatba") && !jeKartaPatronatu(state, k.uid)) out.push({ type: "kseft", uid, kartaUid: k.uid });
        break;
    }
  }
  const lok = state.ciel?.lokalita ?? null;
  if (lok !== null && KSEFTY_LOKALIT.includes(lok.defId) && !kseftPouzity(state, p, lok.uid)) {
    const uid = lok.uid;
    if (lok.defId === "jednota") out.push({ type: "kseft", uid });
    if (lok.defId === "sklad" && h.cigarety >= SKLAD_CENA && state.hraci[opp].odhadzovaci.length > 0) out.push({ type: "kseft", uid });
    if (lok.defId === "predsedova_vila" && h.cigarety >= VILA_CENA) {
      const chraneny = state.patronat[opp]?.elderId;
      for (const e of state.starsi) {
        if (e.elderId === chraneny) continue;
        for (const kSebe of [false, true]) if (posunMarker(e, kSebe ? p : opp) !== null) out.push({ type: "kseft", uid, elderId: e.elderId, kSebe });
      }
    }
  }
  return out;
}

function cmdKseft(s: MutState, data: GameData, cmd: { uid: number; kartaUid?: number; elderId?: string; kSebe?: boolean }, p: PlayerId, events: Event[]): void {
  const pitka = s.pitkaStav;
  need(s.faza === "pitka" && pitka !== null && pitka.reakcia === null && s.vizia === null && !pitka.hotovy[p], "Kšeft sa robí v Pitke na tvojom ťahu.");
  need(!kseftPouzity(s as GameState, p, cmd.uid), "Tento Kšeft si v tejto Pitke už použil.");
  const opp = opponentOf(p);
  const h = hrac(s, p);
  const lok = s.ciel?.lokalita ?? null;
  const vLinii = partiaHraca(s as GameState, p).find((pl) => pl.card.uid === cmd.uid && pl.zaverecna !== true);
  const defId = lok?.uid === cmd.uid ? lok.defId : vLinii?.card.defId;
  need(defId !== undefined && (KSEFTY_KARIET.includes(defId) || KSEFTY_LOKALIT.includes(defId)), "Taký Kšeft teraz nemáš.");
  switch (defId) {
    case "kapybara":
      need(h.cigarety >= KAPYBARA_CENA, `Kapybara chce ${cigariet(KAPYBARA_CENA)}.`);
      h.cigarety -= KAPYBARA_CENA;
      s.spaky[opp] -= 1;
      events.push({ type: "log", text: `Kapybara: hráč ${p + 1} platí ${cigariet(KAPYBARA_CENA)} a kapybara zožerie hráčovi ${opp + 1} 1 špak.` });
      break;
    case "stryko_z_ameriky": {
      need(h.cigarety >= STRYKO_CENA, `Strýko chce ${cigariet(STRYKO_CENA)}.`);
      h.cigarety -= STRYKO_CENA;
      const r: [number, number] = [s.kseftRany?.[0] ?? 0, s.kseftRany?.[1] ?? 0];
      r[p] += 1;
      s.kseftRany = r;
      events.push({ type: "log", text: `Strýko z Ameriky platí rundu: hráč ${p + 1} udelí v tejto bitke 1 Ranu navyše.` });
      break;
    }
    case "oslavenec":
      need(h.poldeciPlne - skryteHraca(pitka, p).length > 0, "Oslávenec chce plný poldeci (ten na skrytom NA EX nie).");
      need(!zakazVypit(s as GameState), "Kostol: nikto nesmie vypiť.");
      // Nie je to nerest ani pečeň platiteľa — vypil to súper (Michal, plan.md časť 4).
      h.poldeciPlne -= 1;
      h.poldeciVypite += 1;
      events.push({ type: "log", text: `Oslávenec: hráč ${p + 1} nalieva hráčovi ${opp + 1} — ten dostáva ${OSLAVENEC_PECEN} poškodenia pečene.` });
      pitieVPitke(s, opp, OSLAVENEC_PECEN);
      pridajPecen(s, data, opp, OSLAVENEC_PECEN, events);
      break;
    case "smetiarka": {
      const idx = h.ruka.findIndex((k) => k.uid === cmd.kartaUid);
      need(idx !== -1, "Vyber kartu z ruky.");
      const karta = h.ruka[idx] as CardInstance;
      need(!defOf(data, karta).tags.includes("Kliatba"), "Kliatbu Smetiarka nezoberie.");
      need(!jeKartaPatronatu(s as GameState, karta.uid), "Staršieho z patronátu Smetiarka nezoberie.");
      h.ruka.splice(idx, 1);
      h.odhadzovaci.push(karta as DeepMutable<CardInstance>);
      h.cigarety += 1;
      events.push({ type: "log", text: `Smetiarka: hráč ${p + 1} odhadzuje ${defOf(data, karta).name} a dostáva cigaretu.` });
      break;
    }
    case "jednota":
      pridajKliatbu(s, data, p, "dlh", events);
      h.cigarety += JEDNOTA_CIGARETY;
      events.push({ type: "log", text: `Jednota: hráč ${p + 1} berie na sekeru — ${cigariet(JEDNOTA_CIGARETY)} za Dlh.` });
      break;
    case "sklad": {
      need(h.cigarety >= SKLAD_CENA, "Na Sklad treba cigaretu.");
      const karta = hrac(s, opp).odhadzovaci.pop();
      need(karta !== undefined, "Súperov odhadzovací balíček je prázdny.");
      h.cigarety -= SKLAD_CENA;
      // Cigareta za Kšeft lokality je nerest ako pri Zbernom dvore (plan.md 7.5 bod 7d).
      h.nerestiTotoKolo += SKLAD_CENA;
      events.push({ type: "log", text: `Sklad: hráč ${p + 1} si za cigaretu berie zo súperovho odhadzovacieho balíčka ${defOf(data, karta as CardInstance).name}.` });
      // Karta odteraz patrí novému majiteľovi (7.5 bod 7c).
      doRuky(s, p, karta, events);
      break;
    }
    case "predsedova_vila": {
      need(h.cigarety >= VILA_CENA, `Vila chce ${cigariet(VILA_CENA)}.`);
      const elder = s.starsi.find((e) => e.elderId === cmd.elderId);
      need(elder !== undefined, "Vyber staršieho.");
      need(elder.elderId !== s.patronat[opp]?.elderId, "Staršieho zo súperovho patronátu tohto kola posunúť nesmieš.");
      const kSebe = cmd.kSebe === true;
      const nova = posunMarker(elder, kSebe ? p : opp);
      need(nova !== null, "Marker je na kraji stupnice.");
      h.cigarety -= VILA_CENA;
      zapisPosun(s, events, { elderId: elder.elderId, z: elder.marker, na: nova, zdroj: "kseft", kto: p });
      elder.marker = nova;
      events.push({ type: "log", text: `Predsedova vila: hráč ${p + 1} platí ${cigariet(VILA_CENA)} — ${textPosunu(data, elder as ElderState, kSebe ? "k sebe" : "k súperovi")}` });
      skontrolujVydesenie(s, data, events);
      break;
    }
  }
  const pouzite: [number[], number[]] = [[...(pitka.kseft?.[0] ?? [])], [...(pitka.kseft?.[1] ?? [])]];
  pouzite[p].push(cmd.uid);
  pitka.kseft = pouzite;
}

/** Koniec Pitky: pečeň a zadĺženie sa vynulujú, ide ďalšia Pitka alebo bitka. */
function dokonciPitku(s: MutState, data: GameData, events: Event[]): void {
  // Záverečné sa otočia ešte pred vynulovaním pečene — Nástup (napr. Niekoho
  // stryná) patrí ešte do tejto Pitky.
  if (otocZaverecne(s, data, events)) return;
  // Rekapitulácia až teraz: počas Vízie ešte mohla ležať súperova karta lícom dole.
  const rekap = s.pitkyKola?.at(-1);
  if (rekap !== undefined && rekap.pitka === s.pitkaCislo) events.push({ type: "pitkaRekap", rekap: rekap as RekapitulaciaPitky });
  s.zaciatokPitky = null;
  // Pečeň žije len počas Pitky (Michal 2026-10-16). Zadĺženie od v7 nie (D6,
  // Michal 2026-10-27): zvyšok pod prahom ostáva na účte do ďalšej Pitky aj kola.
  for (const p of [0, 1] as const) {
    const player = hrac(s, p);
    if (player.pecen > 0) events.push({ type: "log", text: `Hráč ${p + 1}: po Pitke sa pečeň (${player.pecen}) vynulovala.` });
    if (player.zadlzenie > 0) events.push({ type: "log", text: `Hráč ${p + 1}: zadĺženie ${player.zadlzenie} ostáva na účte do ďalšej Pitky.` });
    player.pecen = 0;
  }

  s.vizia = null;
  s.pitkaStav = null;

  // Ďalšia Pitka (Michal 2026-10-19): toľko, koľko dovolia aktivované akcie
  // karty v strede — línia sa medzitým mohla zmeniť.
  s.pitkyCelkom = Math.max(s.pitkaCislo, pocetPitiek(data, s as GameState));
  if (s.pitkaCislo < s.pitkyCelkom) {
    zacniZhromazdenie(s, data, events);
    return;
  }
  zacniBitku(s, data, events);
}

// ---------------------------------------------------------------------------
// Bitka

/** Súčet násobkov aktívnych akcií karty v línii (Dievčina na vydaj). */
function aktivneAkcieKarty(vyhodnotenie: LineEval, uid: number): number {
  const ev = vyhodnotenie.cards.get(uid);
  return ev === undefined ? 0 : [...ev.left, ...ev.right].reduce((a, x) => a + (x?.stav === "aktivna" ? x.nasobok : 0), 0);
}

/** Koľko priznaných Dlhov spáli Robota v kroku Exekútora (na Obecnom úrade 2 za kus). */
function robotaPali(s: VerejnyStav, sums: ActionSums): number {
  return (sums.Robota ?? 0) * exekutorLokality(s).robota;
}

/**
 * Koľko priznaných Dlhov najviac spáli najbližšia bitka — Dievčina na vydaj
 * na jej začiatku a Robota v kroku Exekútora; Dlh sa sám nepáli (návrh #4 B).
 * Ten istý výpočet ako zacniBitku a pokracujBitku, aby náhľad ceny Dlhu
 * sedel s hrou (návrh „Náhľady sľubujú inú cenu“, #1 B). Benzínku a odovzdaný
 * Nástroj nepredvída.
 */
export function paleneDlhyVBitke(
  data: GameData,
  s: VerejnyStav & { readonly lokalitaOtocena: boolean },
  vyhodnotenie: LineEval = evaluateLine(data, lineState(s)),
  /** Dlhy, ktoré do bitky ešte pribudnú (náhľad) — rátajú sa k podmienke Dievčiny. */
  dlhyNavyse: readonly [number, number] = [0, 0],
): readonly [number, number] {
  const pre = (p: PlayerId): number => {
    let n = robotaPali(s, vyhodnotenie.sums[p]);
    const vena = s.hraci[p].priznane.filter((k) => k.defId === "dlh").length + dlhyNavyse[p] >= DIEVCINA_DLHY;
    for (const placed of partiaHraca(s, p)) {
      if (!vena || placed.card.defId !== "dievcina_na_vydaj" || efektPotlaceny(data, s, p, "dievcina_na_vydaj")) continue;
      n += aktivneAkcieKarty(vyhodnotenie, placed.card.uid);
    }
    return n;
  };
  return [pre(0), pre(1)];
}

/** Dievčina na vydaj (v7, D4): veno páli Dlhy až od toľkých priznaných Dlhov. */
const DIEVCINA_DLHY = 4;

function zacniBitku(s: MutState, data: GameData, events: Event[]): void {
  s.faza = "bitka";
  events.push({ type: "faza", faza: "bitka" });
  const vyhodnotenie = evaluateLine(data, lineState(s as GameState));

  s.bitkaStav = {
    // Prvý krok je Benzínka; súčty a Pohoršenia sa po nej prepočítajú.
    krok: "benzinka",
    caka: null,
    sums: vyhodnotenie.sums as DeepMutable<BitkaStav["sums"]>,
    exekutorHotovy: [false, false],
    exekutor: [0, 0],
    pohorsenieZostava: [0, 0],
    damage: null,
    vitaz: null,
    prebytokDrzi: null,
    prebytokZostava: 0,
    prebytokPosunute: [],
    pohrebHotovy: [false, false],
    benzinkaZostava: [0, 0],
    karHotovy: [false, false],
    spalit: [],
    vesticaHotova: false,
  };
  const b = s.bitkaStav;

  for (const p of [0, 1] as const) {
    // krcmarka: bez Absťáku a bez NA EX v tomto kole sa vypitý poldeci otočí na plný.
    const abstaky = verejneAbstaky(s as GameState, p) + s.hraci[p].ruka.filter((k) => k.defId === "abstak").length;
    if (maEfekt(s, data, p, "krcmarka") && !s.naexVKole[p] && abstaky === 0 && s.hraci[p].poldeciVypite > 0) {
      hrac(s, p).poldeciVypite -= 1;
      hrac(s, p).poldeciPlne += 1;
      events.push({ type: "log", text: `Krčmárka: hráč ${p + 1} otáča vypitý poldeci na plný.` });
    }
    // dievcina_na_vydaj: zahodí sa (po bitke sa spáli) a s ňou toľko priznaných
    // Dlhov majiteľa, koľko mala aktívnych akcií.
    // v7 (D4): veno až od 4 priznaných Dlhov.
    const vena = s.hraci[p].priznane.filter((k) => k.defId === "dlh").length >= DIEVCINA_DLHY;
    for (const placed of partiaHraca(s as GameState, p)) {
      if (!vena || placed.card.defId !== "dievcina_na_vydaj" || efektPotlaceny(data, s as GameState, p, "dievcina_na_vydaj")) continue;
      const aktivne = aktivneAkcieKarty(vyhodnotenie, placed.card.uid);
      let zostava = aktivne;
      while (zostava > 0) {
        const idx = s.hraci[p].priznane.findIndex((k) => k.defId === "dlh");
        if (idx === -1) break;
        hrac(s, p).priznane.splice(idx, 1);
        zostava--;
      }
      b.spalit.push(placed.card.uid);
      poZahodeni(s, data, p, 1, events);
      events.push({
        type: "log",
        text: `Dievčina na vydaj: hráč ${p + 1} ju zahadzuje a s ňou ${aktivne - zostava} priznaných Dlhov.`,
      });
    }
  }


  // Traktoristka (v7, Na leasing): bez prevahy v jej kraji Dlh — pred Exekútorom.
  for (const p of [0, 1] as const) {
    for (let i = traktoristkyBezPrevahy(data, s as GameState, p); i > 0; i--) {
      events.push({ type: "log", text: `Traktoristka: hráč ${p + 1} nemá v jej kraji prevahu — leasing ide na Dlh.` });
      pridajKliatbu(s, data, p, "dlh", events);
    }
  }

  manualEfekty(s, data, "Bitka", events);
  manualEfekty(s, data, "Furt", events);
  pokracujBitku(s, data, events);
}

/** Vlastní Občania hráča p v línii, ktorí sa ešte nezahadzujú. */
function obcaniaVLinii(s: GameState, data: GameData, p: PlayerId): PlacedCard[] {
  const spalit = s.bitkaStav?.spalit ?? [];
  return partiaHraca(s, p).filter((pl) => defOf(data, pl.card).tags.includes("Občan") && !spalit.includes(pl.card.uid));
}

/** Karty z línie sa zahodia (spália) — z hry von, nevrátia sa do balíčka. */
function spalZLinie(
  s: MutState,
  data: GameData,
  p: PlayerId,
  uids: readonly number[],
  zdroj: string,
  events: Event[],
): void {
  for (const uid of uids) {
    const kde = najdiVLinii(s, uid);
    if (kde === null) continue;
    const [karta] = s.strany[kde.strana].splice(kde.index, 1);
    if (karta !== undefined) {
      events.push({ type: "log", text: `${zdroj}: hráč ${p + 1} zahadzuje ${defOf(data, karta.card as CardInstance).name}.` });
    }
  }
  poZahodeni(s, data, p, uids.length, events);
}

/** Súčty akcií a Pohoršenia z aktuálnej línie (Benzínka ju môže zmeniť). */
function nastavSumy(s: MutState, data: GameData): void {
  const b = s.bitkaStav;
  if (b === null) return;
  const sums = evaluateLine(data, lineState(s as GameState)).sums;
  b.sums = sums as DeepMutable<BitkaStav["sums"]>;
  const zPatronatu: [number, number] = [0, 0];
  const pohorsenie = (p: PlayerId): number => {
    const r = rozpisPohorseni(data, s as GameState, sums, p);
    zPatronatu[p] = r.zPatronatu;
    return r.spolu;
  };
  b.pohorsenieZostava = [pohorsenie(0), pohorsenie(1)];
  b.pohorseniaSpolu = [b.pohorsenieZostava[0], b.pohorsenieZostava[1]];
  b.pohorseniaPatronatu = zPatronatu;
}

/**
 * Smie hráč p teraz dať Pohoršenie na staršieho (k súperovi, alebo kSebe k sebe)?
 * V6 posúva o pole bez limitu, aj na kraj. Pohoršenia zo súperovho patronátu
 * (Michal 2026-10-26) nesmú na staršieho, ktorého si súper vzal za patróna —
 * inak by mu marker hneď vrátili a patronát by nezastavil vydesenie. Ostatné
 * Pohoršenia naňho smú; hra minie najprv tie z patronátu.
 */
export function pohorsenieMozne(
  state: {
    readonly patronat: readonly ({ readonly elderId: string } | null)[];
    readonly bitkaStav: { readonly pohorsenieZostava: readonly [number, number]; readonly pohorseniaPatronatu?: readonly [number, number] } | null;
  },
  p: PlayerId,
  elder: Pick<ElderState, "elderId" | "marker">,
  kSebe = false,
): boolean {
  const b = state.bitkaStav;
  if (b === null || b.pohorsenieZostava[p] <= 0) return false;
  if (posunMarker(elder, kSebe ? p : opponentOf(p)) === null) return false;
  const patronSupera = state.patronat[opponentOf(p)]?.elderId;
  if (elder.elderId !== patronSupera) return true;
  return b.pohorsenieZostava[p] > (b.pohorseniaPatronatu?.[p] ?? 0);
}

/** Stav pre Pohoršenia bitky — línia a verejný patronát (GameState aj ClientState). */
export type StavPohorseni = VerejnyStav & { readonly patronat: readonly ({ readonly pohorsenia: number } | null)[] };

function rozpisPohorseni(
  data: GameData,
  s: StavPohorseni,
  sums: readonly [ActionSums, ActionSums],
  p: PlayerId,
): { readonly spolu: number; readonly zPatronatu: number } {
  // Patronát: súper patróna dostane Pohoršenia navyše (o koľko marker išiel do
  // stredu) — strach, ktorý spôsobil, mu tak neprepadne (Michal 2026-10-20).
  const zPatronatu = s.patronat[opponentOf(p)]?.pohorsenia ?? 0;
  // Abstinent v5 (Michal 2026-10-25): v bitke +1 / +2 / +3 Pohoršenia.
  const abstinent = silaPriazne(data, s, "LAKOMEC", p);
  // Policajtka ich od 2026-10-26 neruší — jej efekt je Dlh za NA EX v Pitke.
  return { spolu: (sums[p].Pohoršenie ?? 0) + zPatronatu + abstinent, zPatronatu };
}

/**
 * Pohoršenia, ktoré hráči dostanú v bitke (PRAVIDLA §9.2) zo súčtov línie
 * a patronátu — ten istý výpočet ako nastavSumy, pre náhľad ceny NA EX
 * a patronátu (návrh #1, playtest 20261024-075830).
 */
export function pohorseniaVBitke(data: GameData, s: StavPohorseni, sums: readonly [ActionSums, ActionSums]): readonly [number, number] {
  return [rozpisPohorseni(data, s, sums, 0).spolu, rozpisPohorseni(data, s, sums, 1).spolu];
}

/** Ženie bitku dopredu, kým nenarazí na rozhodnutie hráča alebo koniec. */
function pokracujBitku(s: MutState, data: GameData, events: Event[]): void {
  const b = s.bitkaStav;
  if (b === null || s.koniec !== null) return;
  b.caka = null;

  // 0. Benzínka — kto má viac Občanov, než musí zahodiť, vyberá.
  if (b.krok === "benzinka") {
    for (const p of [obranca(s), s.utocnik]) {
      if (b.benzinkaZostava[p] <= 0) continue;
      const obcania = obcaniaVLinii(s as GameState, data, p);
      if (obcania.length > b.benzinkaZostava[p]) {
        b.caka = p;
        return;
      }
      spalZLinie(s, data, p, obcania.map((o) => o.card.uid), "Benzínka", events);
      b.benzinkaZostava[p] = 0;
    }
    nastavSumy(s, data);
    b.krok = "kar";
  }

  // 0b. Kar (roadmapa #80): kto má v ruke nepriznanú Cirhózu, smie jednu zahodiť
  // (obranca, potom útočník).
  if (b.krok === "kar") {
    // Kar v7 (Pitka: doliatie zadarmo s pečeňou) už Cirhózu v bitke nezahadzuje — len stará sada.
    if (jeCielLokalita(s as GameState, "kar") && data.cards.get("kar")?.triggers.includes("Bitka") === true) {
      for (const p of [obranca(s), s.utocnik]) {
        if (b.karHotovy[p]) continue;
        if (!s.hraci[p].ruka.some((k) => k.defId === "cirhoza")) {
          b.karHotovy[p] = true;
          continue;
        }
        b.caka = p;
        return;
      }
    }
    b.krok = "exekutor";
  }

  // 1. Exekútor (obranca, potom útočník).
  if (b.krok === "exekutor") {
    for (const p of [obranca(s), s.utocnik]) {
      if (b.exekutorHotovy[p]) continue;
      // Robota (pravidlá v2): ešte pred kontrolou prahu spáli za každú
      // aktívnu Robotu 1 priznaný Dlh (na Obecnom úrade 2, Michal 2026-10-20).
      // Verejný dlh (2026-10-21): predtým ho odhodila do balíčka, odkiaľ by sa
      // pri dobratí znova priznal — teraz z hry zmizne.
      const urad = exekutorLokality(s as GameState, p);
      for (let r = robotaPali(s, b.sums[p] as ActionSums); r > 0; r--) {
        const idx = s.hraci[p].priznane.findIndex((k) => k.defId === "dlh");
        if (idx === -1) break;
        hrac(s, p).priznane.splice(idx, 1);
        events.push({ type: "log", text: `Robota: hráč ${p + 1} páli 1 priznaný Dlh.` });
      }
      const dlhy = pocetKariet(s.hraci[p] as PlayerState, "dlh", "priznane");
      // Exekútor v5 (Michal 2026-10-25): súperova priazeň znižuje prah tohto hráča.
      if (!exekutorCheck(dlhy + urad.zlava, silaPriazne(data, s as GameState, "EXEKUTOR", opponentOf(p)))) {
        // Dlh sa sám nepáli (Michal 2026-10-22, návrh #4 B) — pália ho len
        // Robota, Dievčina na vydaj, Niekoho stryná a Veľmi smútiaca vdova.
        b.exekutorHotovy[p] = true;
        continue;
      }
      // Záhradkár (v6): kto ho má, rozhodne, či ho zahodí namiesto špakov.
      if (zhoriPriExekucii(dlhy) > 0 && zahradkarHraca(s as GameState, p) !== null) {
        b.caka = p;
        events.push({ type: "log", text: `Exekútor u hráča ${p + 1} — môže zahodiť Záhradkára namiesto špakov.` });
        return;
      }
      exekucia(s, data, p, false, events);
    }
    b.krok = "pohorsenie";
  }

  // 2. Pohoršenie (obranca, potom útočník).
  if (b.krok === "pohorsenie") {
    for (const p of [obranca(s), s.utocnik]) {
      while (b.pohorsenieZostava[p] > 0) {
        // v6: Pohoršenie posúva ako prebytok — o pole, bez limitu, aj na kraj; k sebe aj k súperovi.
        if (!s.starsi.some((e) => pohorsenieMozne(s as GameState, p, e) || pohorsenieMozne(s as GameState, p, e, true))) {
          b.pohorsenieZostava[p] = 0;
          break;
        }
        b.caka = p;
        return;
      }
    }
    b.krok = null; // poškodenie, výsledok a špaky — automatické
    vyhodnotPoskodenie(s, data, events);
    if (s.koniec !== null) return;
  }

  // 4c. Prebytok — posunie markery pre ďalšiu bitku; po finále a na Kultúrnom dome sú z neho špaky.
  if (b.krok === "prebytok") {
    if (b.prebytokZostava > 0 && b.prebytokDrzi !== null && prebytokDoSpakov(s)) {
      const drzi = b.prebytokDrzi as PlayerId;
      const n = b.prebytokZostava;
      s.spaky[drzi] += n;
      const zaznam = s.nastenka[s.nastenka.length - 1];
      if (zaznam !== undefined) {
        zaznam.prebytok[drzi] += n;
        zaznam.spakyPo = [s.spaky[0], s.spaky[1]];
      }
      events.push({ type: "log", text: `Prebytok ${n} sa nerozdeľuje${jeFinale(s) ? " (finále)" : " (Kultúrny dom)"} — hráč ${drzi + 1} dostáva ${spakov(n)}.` });
      b.prebytokZostava = 0;
    }
    while (b.prebytokZostava > 0 && b.prebytokDrzi !== null) {
      if (!existujeLegalnyPrebytok(s, b.prebytokDrzi)) {
        // Hlásiť, inak hráči tiché prepadnutie považovali za chybu (playtest 20261021-143600).
        const cena = cenaPosunuPrebytkom(s as GameState, b.prebytokDrzi);
        events.push({
          type: "log",
          text:
            b.prebytokZostava < cena
              ? `Prebytok ${b.prebytokZostava} prepadol — posun markera stojí hráča ${b.prebytokDrzi + 1} ${cena} (Miňištrant).`
              : `Prebytok ${b.prebytokZostava} prepadol — žiadny marker sa nedá posunúť k hráčovi ${opponentOf(b.prebytokDrzi) + 1}.`,
        });
        b.prebytokZostava = 0;
        break;
      }
      b.caka = b.prebytokDrzi;
      return;
    }
    vypiPoldeci(s, data, events);
    b.krok = "vestica";
  }

  // 5. Veštica (Prehra): porazený vymení kartu medzi doberacími balíčkami.
  if (b.krok === "vestica") {
    const porazeny = b.vitaz === null ? null : opponentOf(b.vitaz);
    const maKarty = (q: PlayerId): boolean => s.hraci[q].doberaci.length + s.hraci[q].odhadzovaci.length > 0;
    if (porazeny !== null && !b.vesticaHotova && maEfekt(s, data, porazeny, "vestica") && maKarty(porazeny) && maKarty(opponentOf(porazeny))) {
      // Prázdny doberací balíček sa doplní ako pri ťahaní (Michal 2026-10-25) — inak by Veštica prepadla.
      // Keď niekto nemá ani odhadzovací, Veštica sa nespustí a nič sa nemieša.
      for (const q of [porazeny, opponentOf(porazeny)]) {
        if (doplnDoberaci(s, q)) {
          events.push({
            type: "log",
            text: `Veštica: doberací balíček hráča ${q + 1} sa minul — odhadzovací sa zamiešal a je z neho nový doberací.`,
          });
        }
      }
      b.caka = porazeny;
      return;
    }
    b.vesticaHotova = true;
    b.krok = "pohreb";
  }

  // 6. Pohreb (obranca, potom útočník).
  if (b.krok === "pohreb") {
    for (const p of [obranca(s), s.utocnik]) {
      if (b.pohrebHotovy[p]) continue;
      const maPriznanuCirhozu = s.hraci[p].priznane.some((k) => k.defId === "cirhoza");
      if (!maPriznanuCirhozu) {
        b.pohrebHotovy[p] = true;
        continue;
      }
      b.caka = p;
      return;
    }
    b.krok = "cintorin";
  }

  // 6c. Cintorín (Prehra, Michal 2026-10-20): porazený smie dať Nástroj z ruky do Dedičstva zadarmo.
  if (b.krok === "cintorin") {
    const porazeny = b.vitaz === null ? null : opponentOf(b.vitaz);
    if (
      b.cintorinHotovy !== true &&
      porazeny !== null &&
      dedicstvoZaPrehru(s as GameState) &&
      s.hraci[porazeny].ruka.some((k) => defOf(data, k as CardInstance).tags.includes("Nástroj"))
    ) {
      b.caka = porazeny;
      return;
    }
    // Krok Zberateľa zanikol (Michal 2026-10-20 — jeho ukazovateľ je Úžerník s prahom Dlhu).
    b.cintorinHotovy = true;
    b.krok = "zivnostnik";
  }

  // 6c. Živnostník (Výhra, Michal 2026-10-26; predtým Nástup a hra zahodila
  // najstaršie Dedičstvo): víťaz za každého svojho Živnostníka v línii zahodí
  // jedno súperovo Dedičstvo podľa vlastného výberu. Ide pred ostatnými
  // efektmi Výhra a Prehra — zahodené Dedičstvo v tejto bitke už nič nedá.
  if (b.krok === "zivnostnik") {
    const vitaz = b.vitaz as PlayerId | null;
    if (b.zivnostnikZostava === undefined) b.zivnostnikZostava = vitaz === null ? 0 : pocetZivnostnikov(s, vitaz);
    while (vitaz !== null && b.zivnostnikZostava > 0) {
      const dedicstvo = s.hraci[opponentOf(vitaz)].dedicstvo;
      if (dedicstvo.length === 0) break;
      // Keď sú všetky súperove Dedičstvá rovnaké, niet čo voliť — hra zahodí sama.
      if (new Set(dedicstvo.map((k) => k.defId)).size > 1) {
        b.caka = vitaz;
        return;
      }
      zahodDedicstvoZivnostnikom(s, data, vitaz, (dedicstvo[0] as CardInstance).uid, events);
    }
    b.zivnostnikZostava = 0;
    koniecBitky(s, data, events);
  }
}

function pocetZivnostnikov(s: MutState, p: PlayerId): number {
  return partiaHraca(s, p).filter((pl) => pl.card.defId === "zivnostnik" && pl.zaverecna !== true).length;
}

function zahodDedicstvoZivnostnikom(s: MutState, data: GameData, p: PlayerId, uid: number, events: Event[]): void {
  const opp = opponentOf(p);
  const b = s.bitkaStav;
  const idx = s.hraci[opp].dedicstvo.findIndex((k) => k.uid === uid);
  need(b !== null && idx !== -1, "Také Dedičstvo súper nemá.");
  const karta = hrac(s, opp).dedicstvo.splice(idx, 1)[0] as CardInstance;
  b.zivnostnikZostava = Math.max(0, (b.zivnostnikZostava ?? 0) - 1);
  events.push({
    type: "log",
    text: `Živnostník: hráč ${p + 1} ${rodovo(p, "zahodil", "zahodila", "zahadzuje")} Dedičstvo ${defOf(data, karta).name} hráča ${opp + 1}.`,
  });
}

function cmdZivnostnik(s: MutState, data: GameData, cmd: { uid: number }, p: PlayerId, events: Event[]): void {
  const b = s.bitkaStav;
  need(s.faza === "bitka" && b !== null && b.krok === "zivnostnik" && b.caka === p, "Nečaká sa na Živnostníka.");
  zahodDedicstvoZivnostnikom(s, data, p, cmd.uid, events);
  pokracujBitku(s, data, events);
}

function cmdKar(s: MutState, data: GameData, cmd: { uid: number | null }, p: PlayerId, events: Event[]): void {
  const b = s.bitkaStav;
  need(s.faza === "bitka" && b !== null && b.krok === "kar" && b.caka === p, "Nečaká sa na Kar.");
  if (cmd.uid !== null) {
    const karta = s.hraci[p].ruka.find((k) => k.uid === cmd.uid);
    need(karta !== undefined && karta.defId === "cirhoza", "Na Kare smieš zahodiť len nepriznanú Cirhózu z ruky.");
    vezmiZRuky(s, p, cmd.uid);
    events.push({ type: "log", text: `Kar: hráč ${p + 1} ${rodovo(p, "zahodil", "zahodila", "zahadzuje")} nepriznanú Cirhózu z ruky.` });
    poZahodeni(s, data, p, 1, events);
  }
  b.karHotovy[p] = true;
  pokracujBitku(s, data, events);
}

function cmdBenzinka(s: MutState, data: GameData, cmd: { uids: readonly number[] }, p: PlayerId, events: Event[]): void {
  const b = s.bitkaStav;
  need(s.faza === "bitka" && b !== null && b.krok === "benzinka" && b.caka === p, "Nečaká sa na Benzínku.");
  const zostava = b.benzinkaZostava[p];
  need(cmd.uids.length === zostava && new Set(cmd.uids).size === zostava, `Vyber presne ${zostava} Občanov.`);
  const moji = new Set(obcaniaVLinii(s as GameState, data, p).map((o) => o.card.uid));
  need(cmd.uids.every((u) => moji.has(u)), "Zahodiť smieš len svojich Občanov z línie.");
  spalZLinie(s, data, p, cmd.uids, "Benzínka", events);
  b.benzinkaZostava[p] = 0;
  pokracujBitku(s, data, events);
}

function cmdVestica(s: MutState, data: GameData, cmd: { moja: number; jeho: number }, p: PlayerId, events: Event[]): void {
  const b = s.bitkaStav;
  need(s.faza === "bitka" && b !== null && b.krok === "vestica" && b.caka === p, "Nečaká sa na Vešticu.");
  const opp = opponentOf(p);
  const moj = hrac(s, p).doberaci;
  const jeho = hrac(s, opp).doberaci;
  need(Number.isInteger(cmd.moja) && cmd.moja >= 0 && cmd.moja < moj.length, "Taká karta v tvojom balíčku nie je.");
  need(Number.isInteger(cmd.jeho) && cmd.jeho >= 0 && cmd.jeho < jeho.length, "Taká karta v súperovom balíčku nie je.");
  const a = moj[cmd.moja] as DeepMutable<CardInstance>;
  const c = jeho[cmd.jeho] as DeepMutable<CardInstance>;
  moj[cmd.moja] = c;
  jeho[cmd.jeho] = a;
  // Karty sa vrátia a balíčky zamiešajú — poradie, ktoré hráč videl, neplatí.
  for (const q of [p, opp]) {
    const [zamiesane, rng] = rngShuffle(s.rng, s.hraci[q].doberaci);
    s.rng = rng;
    hrac(s, q).doberaci = zamiesane as DeepMutable<CardInstance>[];
  }
  events.push({
    type: "log",
    text: `Veštica: hráč ${p + 1} ${rodovo(p, "vymenil", "vymenila", "vymieňa")} ${defOf(data, a).name} za súperovu kartu ${defOf(data, c).name}.`,
  });
  b.vesticaHotova = true;
  b.krok = "pohreb";
  pokracujBitku(s, data, events);
}

function cmdCintorin(s: MutState, data: GameData, cmd: { uid: number | null }, p: PlayerId, events: Event[]): void {
  const b = s.bitkaStav;
  need(s.faza === "bitka" && b !== null && b.krok === "cintorin" && b.caka === p, "Nečaká sa na Cintorín.");
  if (cmd.uid !== null) {
    const karta = s.hraci[p].ruka.find((k) => k.uid === cmd.uid);
    need(karta !== undefined && defOf(data, karta as CardInstance).tags.includes("Nástroj"), "Do Dedičstva patrí Nástroj z ruky.");
    hrac(s, p).dedicstvo.push(vezmiZRuky(s, p, cmd.uid) as DeepMutable<CardInstance>);
    // Spoločná cena Dedičstva sa zvýši ako vždy (Michal 2026-10-20).
    s.dedicstvaVylozene += 1;
    events.push({ type: "log", text: `Cintorín: hráč ${p + 1} dedí — ${defOf(data, karta as CardInstance).name} ide do Dedičstva zadarmo.` });
    manualEfekty(s, data, "Dedičstvo", events);
  }
  b.cintorinHotovy = true;
  pokracujBitku(s, data, events);
}

/** pes: nikdy nesmie byť v partii s iným zvieraťom (platí v oboch smeroch). */
function zvieraKonflikt(data: GameData, partia: readonly PlacedCard[], def: CardDef): boolean {
  if (!def.tags.includes("Zviera")) return false;
  return partia.some((pl) => {
    if (!defOf(data, pl.card).tags.includes("Zviera")) return false;
    return def.id === "pes" || pl.card.defId === "pes";
  });
}

/** Položka návrhu ťahu v Zhromaždení: karta z ruky a kam ide. */
export interface PolozkaVykladania {
  readonly karta: CardInstance;
  readonly ciel: CielVykladania;
  /** Záverečná (lícom dole za cigaretu) — len posledná karta do línie v ťahu. */
  readonly zaverecna?: true;
}

export interface PlanVykladania {
  /** Príkazy pre { type: "tah" } v poradí, v akom ich server vykoná. */
  readonly kroky: readonly Command[];
  /** Koľko plných poldeci ťah vypije (Vypiť pred každou ďalšou kartou). */
  readonly poldeci: number;
  /** Prečo sa ťah nedá zahrať (prvá chyba), inak null. */
  readonly chyba: string | null;
  /** Limit vykladania po ťahu. */
  readonly zostava: number;
}

/**
 * Celý ťah v Zhromaždení naraz (Michal 2026-10-19): priznania nič nestoja
 * a ťah neukončia; každá ďalšia karta do línie či do Dedičstva po prvej stojí
 * plný poldeci (Vypiť — limit klesne o 1). Klient z toho kreslí návrh a cenu,
 * server ten istý ťah overí znova príkazom „tah“.
 */
export function planVykladania(
  data: GameData,
  stav: {
    readonly strany: readonly [readonly PlacedCard[], readonly PlacedCard[]];
    readonly ciel: VerejnyStav["ciel"];
    readonly dedicstvaVylozene: number;
    readonly hraci: readonly [{ readonly cigarety: number; readonly poldeciPlne: number }, { readonly cigarety: number; readonly poldeciPlne: number }];
    /** Skryté Záverečné (ClientState) — klient súpera ich v strany nemá. */
    readonly zaverecne?: readonly { readonly strana: PlayerId }[];
  },
  p: PlayerId,
  zostavaLimit: number,
  polozky: readonly PolozkaVykladania[],
): PlanVykladania {
  const zablokovane = zablokovaneStrany({ zaverecne: stav.zaverecne ?? [] });
  const kroky: Command[] = [];
  const priznania = polozky.filter((x) => x.ciel === "priznanie");
  const tahove = polozky.filter((x) => x.ciel !== "priznanie");
  let strany = stav.strany;
  let zostava = zostavaLimit;
  let plne = stav.hraci[p].poldeciPlne;
  let cigarety = stav.hraci[p].cigarety;
  let dedicstva = stav.dedicstvaVylozene;
  let poldeci = 0;
  const chyba = (text: string): PlanVykladania => ({ kroky, poldeci, chyba: text, zostava });
  const lokalita = cielLokalitaId(stav);
  const finale = finaleBezStredu(stav);
  // Kostol: nikto nesmie vypiť — bez Vypiť ide v ťahu len jedna karta.
  if (tahove.length > 1 && zakazVypit(stav)) return chyba("Kostol: nikto nesmie vypiť — v ťahu len jedna karta.");
  for (const x of priznania) {
    if (!cieleVykladania(data, strany, p, x.karta, zostava, true, lokalita, zablokovane, finale).includes("priznanie")) return chyba(`${defOf(data, x.karta).name} sa nedá priznať.`);
    kroky.push({ type: "place", uid: x.karta.uid, target: "priznanie" });
  }
  for (let i = 0; i < tahove.length; i++) {
    const x = tahove[i] as PolozkaVykladania;
    // Každá karta okrem poslednej: najprv Vypiť, aby ďalšia neukončila ťah.
    if (i < tahove.length - 1) {
      if (plne <= 0) return chyba("Na ďalšiu kartu v tom istom ťahu treba plný poldeci.");
      plne -= 1;
      poldeci += 1;
      zostava = Math.max(0, zostava - 1);
      kroky.push({ type: "vypit" });
    }
    const cena = cenaDedicstva({ dedicstvaVylozene: dedicstva });
    if (!cieleVykladania(data, strany, p, x.karta, zostava, cigarety >= cena, lokalita, zablokovane, finale).includes(x.ciel)) {
      return chyba(
        x.ciel === "dedicstvo"
          ? `Do Dedičstva treba ${cena} cig.`
          : zostava <= 0
            ? "Limit vykladania je vyčerpaný."
            : `${defOf(data, x.karta).name} sem vyložiť nemôžeš.`,
      );
    }
    if (x.zaverecna === true) {
      if (i < tahove.length - 1) return chyba("Záverečná musí byť posledná karta ťahu — potom už nevykladáš.");
      if (x.ciel !== "vlastna" && x.ciel !== "superova") return chyba("Záverečná ide len do línie.");
      if (cigarety < KONSTANTY.CENA_ZAVERECNEJ) return chyba(`Záverečná stojí ${cigariet(KONSTANTY.CENA_ZAVERECNEJ)}.`);
      cigarety -= KONSTANTY.CENA_ZAVERECNEJ;
      kroky.push({ type: "zaverecna", uid: x.karta.uid, target: x.ciel });
    } else {
      kroky.push({ type: "place", uid: x.karta.uid, target: x.ciel });
    }
    if (x.ciel === "dedicstvo") {
      cigarety -= cena;
      dedicstva += 1;
    } else {
      const kam: PlayerId = x.ciel === "vlastna" ? p : opponentOf(p);
      const nova = [...strany[kam], { card: x.karta, playedBy: p }];
      strany = kam === 0 ? [nova, strany[1]] : [strany[0], nova];
      const tagy = defOf(data, x.karta).tags;
      if (!tagy.includes("Nástroj") && !bezLimituPracujuci(lokalita, tagy)) zostava -= 1;
    }
  }
  return { kroky, poldeci, chyba: null, zostava };
}

/**
 * Kam smie hráč p vyložiť kartu z ruky v Zhromaždení. Volá to legalCommands
 * aj klient, ktorý podľa toho pri ťahaní karty ukazuje povolené miesta —
 * pravidlá vykladania tak existujú len raz. Server ich v cmdPlace overí znova.
 */
export function cieleVykladania(
  data: GameData,
  strany: readonly [readonly PlacedCard[], readonly PlacedCard[]],
  p: PlayerId,
  karta: CardInstance,
  zostavaLimit: number,
  /** Má hráč cigarety na ďalšie Dedičstvo (cenaDedicstva — rastie, Michal 2026-10-19)? */
  naDedicstvo = true,
  /** defId lokality v hre (cielLokalitaId) — Most a Družstvo menia, kam a za koľko sa vykladá. */
  lokalita: string | null = null,
  /**
   * Strany so skrytou Záverečnou (zablokovaneStrany) — klient súpera ju v strany
   * nemá; na serveri ju prezradí príznak karty na konci strany.
   */
  zablokovane: readonly [boolean, boolean] = [false, false],
  /** Finále (jeFinale): prázdna strana sa prikladá ku karte v strede (susedNaKonci). */
  finale = false,
): CielVykladania[] {
  const def = defOf(data, karta);
  // Kliatba sa dá len priznať (Michal 2026-10-20) — do línie smie len kliatba,
  // ktorá je zároveň Občan s akciami (Milujúca manželka).
  if (def.tags.includes("Kliatba") && !def.tags.includes("Občan")) return ["priznanie"];
  const jeNastroj = def.tags.includes("Nástroj");
  const doDedicstva = jeNastroj && naDedicstvo;
  // Pes sa nesmie stretnúť s iným zvieraťom medzi kartami toho istého majiteľa.
  if (zvieraKonflikt(data, partiaHraca({ strany }, p), def)) {
    return def.tags.includes("Kliatba") ? ["priznanie"] : doDedicstva ? ["dedicstvo"] : [];
  }
  // Nástroj limit nemíňa, nesmie však susediť s Nástrojom na konci partie.
  const smie = (strana: PlayerId, ciel: "vlastna" | "superova"): boolean => {
    if (!jeNastroj && zostavaLimit <= 0 && !bezLimituPracujuci(lokalita, def.tags)) return false;
    if (ciel === "superova" && lenVlastnaStrana(lokalita)) return false;
    const koniec = susedNaKonci(strany, strana, finale);
    // Za skrytú Záverečnú sa nedá priložiť (ani odpoveď na NA EX), kým sa neotočí.
    if (koniec?.zaverecna === true || zablokovane[ciel === "vlastna" ? p : opponentOf(p)]) return false;
    return !(jeNastroj && koniec != null && defOf(data, koniec.card).tags.includes("Nástroj"));
  };
  const out: CielVykladania[] = [];
  if (smie(p, "vlastna")) out.push("vlastna");
  if (smie(opponentOf(p), "superova")) out.push("superova");
  if (def.tags.includes("Kliatba")) out.push("priznanie");
  if (doDedicstva) out.push("dedicstvo");
  return out;
}

/** Kde má hráč p Záhradkára, ktorého smie pri exekúcii zahodiť (ruka, potom balíčky); null = nikde. */
export function zahradkarHraca(_s: GameState, _p: PlayerId): "ruka" | "odhadzovaci" | "doberaci" | null {
  // v7: Záhradkár exekúciu nerieši zahodením, ale vyšším prahom (exekutorLokality).
  // Príkaz zahradkar ostáva kvôli starým uloženiam, ponúkať ho netreba.
  return null;
}

/**
 * Exekúcia (v6, Michal 2026-10-26): zhorí polovica priznaných Dlhov (nadol)
 * a rovnaký počet špakov — smie ísť do mínusu, súper ich nedostane. Záhradkár
 * (Michal 2026-10-26): kto ho zahodí, špaky nestratí, Dlhy zhoria aj tak.
 */
function exekucia(s: MutState, data: GameData, p: PlayerId, zahradkar: boolean, events: Event[]): void {
  const b = s.bitkaStav;
  if (b === null) return;
  const dlhy = s.hraci[p].priznane.filter((k) => k.defId === "dlh").length;
  const zhori = zhoriPriExekucii(dlhy);
  let spalit = zhori;
  hrac(s, p).priznane = s.hraci[p].priznane.filter((k) => {
    if (k.defId === "dlh" && spalit > 0) {
      spalit--;
      return false;
    }
    return true;
  });
  const kde = zahradkar ? zahradkarHraca(s as GameState, p) : null;
  if (kde !== null) {
    const zona = hrac(s, p)[kde];
    zona.splice(zona.findIndex((k) => k.defId === "zahradkar"), 1);
    events.push({ type: "log", text: `Exekútor: hráčovi ${p + 1} zhorí ${pocet(zhori, "priznaný Dlh", "priznané Dlhy", "priznaných Dlhov")}; špaky zachráni zahodený Záhradkár.` });
    if (kde === "ruka") poZahodeni(s, data, p, 1, events);
  } else {
    s.spaky[p] -= zhori;
    b.exekutor[p] += zhori;
    events.push({ type: "log", text: `Exekútor: hráčovi ${p + 1} zhorí ${pocet(zhori, "priznaný Dlh", "priznané Dlhy", "priznaných Dlhov")} a ${spakov(zhori)}.` });
  }
  b.exekutorHotovy[p] = true;
}

/** „1 špak“, „3 špaky“, „5 špakov“. */
export function spakov(n: number): string {
  return pocet(n, "špak", "špaky", "špakov");
}


/** Koľko prebytku stojí jeden posun: víťaza Miňištrant v jeho partii o 1 viac. */
function cenaPosunuPrebytkom(state: GameState, p: PlayerId): number {
  return p === state.bitkaStav?.vitaz ? cenaPrebytku(state, p) : 1;
}

function existujeLegalnyPrebytok(s: MutState, drzi: PlayerId): boolean {
  if ((s.bitkaStav?.prebytokZostava ?? 0) < cenaPosunuPrebytkom(s as GameState, drzi)) return false;
  return s.starsi.some((e) => posunMarker(e, opponentOf(drzi)) !== null);
}

function cmdZahradkar(s: MutState, data: GameData, cmd: { zahodit: boolean }, p: PlayerId, events: Event[]): void {
  const b = s.bitkaStav;
  need(s.faza === "bitka" && b !== null && b.krok === "exekutor" && b.caka === p, "Nečaká sa na Záhradkára.");
  need(!cmd.zahodit || zahradkarHraca(s as GameState, p) !== null, "Záhradkára nemáš.");
  exekucia(s, data, p, cmd.zahodit, events);
  pokracujBitku(s, data, events);
}

/** Zapíše posun markera do stopy (posunyMarkerov) a pošle ho obom ako udalosť. */
function zapisPosun(s: MutState, events: Event[], posun: PosunMarkera): void {
  s.posunyMarkerov.push(posun);
  events.push({ type: "posunMarkera", ...posun });
}

/** Log posunu s menom staršieho a dôsledkom — „hráč N“ klient nahradí menom (UX U11). */
function textPosunu(data: GameData, elder: ElderState, smer: "k sebe" | "k súperovi"): string {
  const komu = priazenHraca(elder);
  const priazen = komu === null ? "" : `, priazeň +${priazenSila(elder)} má hráč ${komu + 1}`;
  return `${defOf(data, elder.karta).name} o krok ${smer} → ${NAZVY_ZON[STUPNICA_ZONY[elder.marker]]}${priazen}.`;
}

function cmdPohorsenie(
  s: MutState,
  data: GameData,
  cmd: { elderId: string; kSebe?: boolean },
  p: PlayerId,
  events: Event[],
): void {
  const b = s.bitkaStav;
  need(s.faza === "bitka" && b !== null && b.krok === "pohorsenie" && b.caka === p, "Nečaká sa na Pohoršenie.");
  need(b.pohorsenieZostava[p] > 0, "Nemáš aktívne Pohoršenie.");
  const elder = s.starsi.find((e) => e.elderId === cmd.elderId);
  need(elder !== undefined, "Taký starší nie je.");
  const kSebe = cmd.kSebe === true;
  const smer = kSebe ? p : opponentOf(p);
  const nova = posunMarker(elder, smer);
  need(nova !== null, "Marker je na kraji stupnice.");
  need(pohorsenieMozne(s as GameState, p, elder, kSebe), "Pohoršenia z patronátu nesmú na staršieho, ktorého si súper vzal za patróna.");
  // Priazeň aj strach sa menia hneď — platia už v poškodení a v špakoch tejto bitky.
  zapisPosun(s, events, { elderId: cmd.elderId, z: elder.marker, na: nova, zdroj: "pohorsenie", kto: p });
  elder.marker = nova;
  // Najprv sa míňajú Pohoršenia z patronátu — na patróna smú len ostatné.
  const zPatronatu = b.pohorseniaPatronatu?.[p] ?? 0;
  if (zPatronatu > 0 && cmd.elderId !== s.patronat[opponentOf(p)]?.elderId) {
    const nove: [number, number] = [b.pohorseniaPatronatu?.[0] ?? 0, b.pohorseniaPatronatu?.[1] ?? 0];
    nove[p] = zPatronatu - 1;
    b.pohorseniaPatronatu = nove;
  }
  b.pohorsenieZostava[p] -= 1;
  events.push({ type: "log", text: `Pohoršenie (hráč ${p + 1}): ${textPosunu(data, elder as ElderState, kSebe ? "k sebe" : "k súperovi")}` });
  skontrolujVydesenie(s, data, events);
  pokracujBitku(s, data, events);
}

/**
 * Prebytok, ktorý držiteľ naozaj rozdelí — puska (Dedičstvo): proti jej
 * majiteľovi o 2 menší. Jeden výpočet pre bitku aj odhad bitky v klientovi.
 */
export function prebytokNaRozdelenie(s: VerejnyStav, outcome: BattleOutcome): number {
  if (outcome.prebytokDrzi === null) return 0;
  return Math.max(0, outcome.prebytok - prebytokProtiZlava(s, opponentOf(outcome.prebytokDrzi)));
}

/** Poškodenie + výsledok (PRAVIDLA §9.3–9.4) — čisto automatické. */
function vyhodnotPoskodenie(s: MutState, data: GameData, events: Event[]): void {
  const b = s.bitkaStav;
  if (b === null) return;
  const vRuke = (p: PlayerId): number => s.hraci[p].ruka.filter((k) => k.defId === "abstak").length;
  const damage = poskodenieBitky(data, s as GameState, b.sums as readonly [ActionSums, ActionSums], [vRuke(0), vRuke(1)]);
  // Remízu v tuhom rozhodnú Absťáky, ktoré hráči práve majú, potom priznané Dlhy (v6).
  const abstaky: [number, number] = [aktualneAbstaky(data, s as GameState, 0), aktualneAbstaky(data, s as GameState, 1)];
  const dlhy: [number, number] = [pocetKariet(s.hraci[0] as PlayerState, "dlh", "priznane"), pocetKariet(s.hraci[1] as PlayerState, "dlh", "priznane")];
  const outcome = battleOutcome(damage, { abstaky, dlhy });
  b.damage = damage as DeepMutable<DamageResult>;
  b.vitaz = outcome.vitaz;
  b.prebytokDrzi = outcome.prebytokDrzi;
  b.prebytokZostava = prebytokNaRozdelenie(s, outcome);
  b.krok = "prebytok";
  const sums = b.sums as readonly [ActionSums, ActionSums];
  const line = lineState(s as GameState);
  const linia = evaluateLine(data, line);
  const rekap = rekapitulaciaBitky(data, {
    linia,
    line,
    sums,
    rozpis: rozpisPoskodenia(data, s as GameState, sums, [vRuke(0), vRuke(1)]),
    damage,
    priznaneDlhy: [pocetKariet(s.hraci[0], "dlh", "priznane"), pocetKariet(s.hraci[1], "dlh", "priznane")],
    pohorsenia: [b.pohorseniaSpolu?.[0] ?? 0, b.pohorseniaSpolu?.[1] ?? 0],
    pitkyKola: (s.pitkyKola ?? []) as readonly RekapitulaciaPitky[],
    vitaz: outcome.vitaz,
    prebytok: outcome.prebytok,
    prebytokDrzi: outcome.prebytokDrzi,
  });
  // Špaky za bitku a za starších (v6) idú aj do rekapitulácie bitky.
  const logy: Event[] = [];
  vyplatSpaky(s, data, outcome, abstaky, logy);
  const spaky = s.nastenka[s.nastenka.length - 1] as BitkaNaNastenke | undefined;
  events.push({
    type: "bitkaVysledok",
    damage,
    sums,
    vitaz: outcome.vitaz,
    rozhodlo: outcome.rozhodlo,
    prebytok: outcome.prebytok,
    prebytokNaRozdelenie: b.prebytokZostava,
    prebytokDrzi: outcome.prebytokDrzi,
    karty: prispevkyKariet(line, linia),
    rekap: spaky === undefined ? rekap : { ...rekap, spaky },
  });
  events.push(...logy);
  if (outcome.prebytokDrzi !== null && b.prebytokZostava < outcome.prebytok) {
    events.push({
      type: "log",
      text: `Puška hráča ${opponentOf(outcome.prebytokDrzi) + 1}: prebytok ${outcome.prebytok} → ${b.prebytokZostava}.`,
    });
  }
  manualEfekty(s, data, "Výhra", events);
  manualEfekty(s, data, "Prehra", events);
}

/**
 * Absťáky, ktoré hráč práve má — priznané, vo svojich kartách v línii aj v ruke —
 * po Autobusárovi (v6: remíza a špaky za bitku).
 */
export function aktualneAbstaky(
  data: GameData,
  s: VerejnyStav & { readonly hraci: readonly [{ readonly ruka: readonly CardInstance[] }, { readonly ruka: readonly CardInstance[] }] },
  p: PlayerId,
): number {
  return abstakyVBitke(data, s, p, s.hraci[p].ruka.filter((k) => k.defId === "abstak").length);
}

/**
 * Komu starší po bitke vyplatia špaky za strach (v6.1, Michal 2026-10-27): víťazovi;
 * pri sekere (špaky za bitku idú na sekeru, vo finále prepadnú) obom.
 */
export function spakyZaStarsichPre(vitaz: PlayerId | null): readonly PlayerId[] {
  return vitaz === null ? [0, 1] : [vitaz];
}

/** Koľko starších sa hráča p bojí (marker na súperovej polovici) — Noviny (v6). */
export function pocetBojacichSa(starsi: readonly ElderState[], p: PlayerId): number {
  return starsi.filter((e) => obavanyHrac(e) === p).length;
}

/**
 * Špaky po výsledku bitky (v6, Michal 2026-10-26), krok 4a a 4b:
 *  - víťaz dostane odohrané Pitky mínus rozdiel Absťákov (aspoň 1) a špaky zo
 *    sekery; pri sekere čakajú špaky kola na víťaza ďalšej bitky, vo finále prepadnú,
 *  - potom za starších, ktorí sa hráča boja (žltá 1, oranžová 2, červená 3): len
 *    víťaz, pri sekere obaja (v6.1); rovnako Noviny v Dedičstve +1, keď sa hráča
 *    bojí viac starších ako súpera.
 * Lokalita ide s výsledkom na nástenku.
 */
function vyplatSpaky(s: MutState, data: GameData, outcome: BattleOutcome, abstaky: readonly [number, number], events: Event[]): void {
  const b = s.bitkaStav;
  if (b === null) return;
  const finale = jeFinale(s);
  const pitky = s.pitkaCislo;
  const zaBitku: [number, number] = [0, 0];
  let zoSekery = 0;
  let abstakZrazka = 0;
  let prepadlo = 0;
  const vitaz = outcome.vitaz;
  if (vitaz !== null) {
    const porazeny = opponentOf(vitaz);
    const zisk = spakyZaBitku(pitky, abstaky[vitaz], abstaky[porazeny]);
    abstakZrazka = pitky - zisk > 0 ? pitky - zisk : 0;
    zoSekery = s.spakyNaSekere;
    // Herňa (Bitka, v7): víťaz navyše toľko špakov, koľko má porazený priznaných Dlhov — bez stropu.
    const herna = jeCielLokalita(s as GameState, "herna") ? s.hraci[porazeny].priznane.filter((k) => k.defId === "dlh").length : 0;
    if (herna > 0) events.push({ type: "log", text: `Herňa: hráč ${porazeny + 1} má ${pocet(herna, "priznaný Dlh", "priznané Dlhy", "priznaných Dlhov")} — víťaz berie ${spakov(herna)} navyše.` });
    zaBitku[vitaz] = zisk + zoSekery + herna;
    s.spakyNaSekere = 0;
    s.spaky[vitaz] += zaBitku[vitaz];
    const preco = outcome.rozhodlo === "abstak" ? " (remíza v tuhom, menej Absťákov)" : outcome.rozhodlo === "dlhy" ? " (remíza v tuhom aj v Absťákoch, menej priznaných Dlhov)" : "";
    events.push({
      type: "log",
      text: `Bitku ${rodovo(vitaz, "vyhral", "vyhrala", "vyhráva")} hráč ${vitaz + 1}${preco}: ${spakov(zaBitku[vitaz])} za ${pocet(pitky, "Pitku", "Pitky", "Pitiek")}${abstakZrazka > 0 ? ` mínus ${abstakZrazka} za Absťák` : ""}${zoSekery > 0 ? ` a ${zoSekery} zo sekery` : ""}.`,
    });
  } else if (finale) {
    prepadlo = pitky + s.spakyNaSekere;
    s.spakyNaSekere = 0;
    events.push({ type: "log", text: `Finále skončilo sekerou — ${spakov(prepadlo)} za bitku prepadá.` });
  } else {
    s.spakyNaSekere += pitky;
    events.push({ type: "log", text: `Sekera: remíza v tuhom, v Absťákoch aj v Dlhoch — ${spakov(pitky)} ide na sekeru (spolu ${s.spakyNaSekere}), vezme ich víťaz ďalšej bitky.` });
  }
  // v6.1 (Michal 2026-10-27, playtesty v6): strach platí len víťazovi — porazený za
  // starších nedostane nič, aby náskok nerástol ako snehová guľa. Noviny rovnako
  // (Michal 2026-10-27): len víťazovi, pri sekere obom.
  const zaStarsich: [number, number] = [0, 0];
  const komu = spakyZaStarsichPre(vitaz);
  for (const p of komu) zaStarsich[p] = spakyZaStarsich(s.starsi, p);
  for (const p of komu) {
    if (vDedicstve(s as GameState, p, "noviny") && pocetBojacichSa(s.starsi as ElderState[], p) > pocetBojacichSa(s.starsi as ElderState[], opponentOf(p))) {
      zaStarsich[p] += 1;
      events.push({ type: "log", text: `Noviny: hráča ${p + 1} sa bojí viac starších ako súpera — špak navyše.` });
    }
    s.spaky[p] += zaStarsich[p];
  }
  events.push({
    type: "log",
    text: `Špaky za starších (${vitaz === null ? "sekera — obom" : `len víťaz, hráč ${vitaz + 1}`}): hráč 1 ${zaStarsich[0]}, hráč 2 ${zaStarsich[1]}.`,
  });
  const lokalita = cielLokalita(s as GameState);
  s.nastenka.push({
    kolo: s.kolo,
    lokalita: lokalita as DeepMutable<CardInstance> | null,
    vitaz,
    rozhodlo: outcome.rozhodlo,
    pitky,
    zaBitku,
    zoSekery,
    abstakZrazka,
    prepadlo,
    zaStarsich,
    exekutor: [b.exekutor[0], b.exekutor[1]],
    prebytok: [0, 0],
    spakyPo: [s.spaky[0], s.spaky[1]],
  });
}

/**
 * Prebytok sa nerozdeľuje medzi starších, jeho držiteľ dostane toľko špakov
 * (v6): po finále (Michal 2026-10-26) a na Kultúrnom dome (Michal 2026-10-26, K1).
 */
export function prebytokDoSpakov(s: Pick<VerejnyStav, "ciel">): boolean {
  return jeFinale(s) || jeCielLokalita(s, "kulturny_dom");
}

function cmdPrebytok(
  s: MutState,
  data: GameData,
  cmd: { elderId: string },
  p: PlayerId,
  events: Event[],
): void {
  const b = s.bitkaStav;
  need(s.faza === "bitka" && b !== null && b.krok === "prebytok" && b.caka === p, "Nečaká sa na prebytok.");
  need(b.prebytokZostava > 0, "Prebytok je rozdelený.");
  // Miňištrant (Výhra): posun víťaza stojí viac — na neúplný posun prebytok nestačí.
  const cena = cenaPosunuPrebytkom(s as GameState, p);
  need(b.prebytokZostava >= cena, `Posun markera ťa stojí ${cena} (Miňištrant), prebytok je len ${b.prebytokZostava}.`);
  const elder = s.starsi.find((e) => e.elderId === cmd.elderId);
  need(elder !== undefined, "Taký starší nie je.");
  // Prebytok posúva marker k súperovi držiteľa [R8.4] — pri víťazovi
  // je to porazený, ako hovorí pravidlo.
  const nova = posunMarker(elder, opponentOf(p));
  need(nova !== null, "Marker sa nedá posunúť.");
  zapisPosun(s, events, { elderId: cmd.elderId, z: elder.marker, na: nova, zdroj: "prebytok", kto: p });
  elder.marker = nova;
  if (!b.prebytokPosunute.includes(cmd.elderId)) b.prebytokPosunute.push(cmd.elderId);
  b.prebytokZostava = Math.max(0, b.prebytokZostava - cena);
  events.push({ type: "log", text: `Prebytok (hráč ${p + 1}): ${textPosunu(data, elder as ElderState, "k súperovi")}` });
  skontrolujVydesenie(s, data, events);
  pokracujBitku(s, data, events);
}

/** Krok 5 — poldeci: NA EX sa vypijú, aktívne akcie Poldeci otáčajú vypité. */
function vypiPoldeci(s: MutState, data: GameData, events: Event[]): void {
  const b = s.bitkaStav;
  if (b === null) return;
  // Na zdravie „do dna“ (Alkoholik v5, Michal 2026-10-25): poldeci z toľkých
  // tvojich NA EX za kolo, aká je sila priazne, sa ti vráti plný. Nerest ostáva.
  const doDna: [number, number] = [silaPriazne(data, s as GameState, "ALKOHOLIK", 0), silaPriazne(data, s as GameState, "ALKOHOLIK", 1)];
  const vratene: [number, number] = [0, 0];
  for (const partia of s.strany) {
    for (const placed of partia) {
      if (placed.naexBy !== undefined) {
        const q = placed.naexBy as PlayerId;
        if (vratene[q] < doDna[q]) {
          hrac(s, q).poldeciPlne += 1;
          vratene[q] += 1;
        } else hrac(s, q).poldeciVypite += 1;
        hrac(s, q).nerestiTotoKolo += 1;
        delete (placed as { naexBy?: PlayerId }).naexBy;
      }
      // Zrážka NA EX (Výtržník): druhý poldeci na karte pije druhý hráč.
      if (placed.naexBy2 !== undefined) {
        const q = placed.naexBy2 as PlayerId;
        if (vratene[q] < doDna[q]) {
          hrac(s, q).poldeciPlne += 1;
          vratene[q] += 1;
        } else hrac(s, q).poldeciVypite += 1;
        hrac(s, q).nerestiTotoKolo += 1;
        delete (placed as { naexBy2?: PlayerId }).naexBy2;
      }
    }
  }
  for (const q of [0, 1] as const) {
    if (vratene[q] > 0) events.push({ type: "log", text: `Na zdravie (priazeň Alkoholika): hráčovi ${q + 1} sa ${vratene[q] === 1 ? "poldeci z NA EX vracia plný" : `${vratene[q]} poldeci z NA EX vracajú plné`}.` });
  }
  for (const p of [0, 1] as const) {
    // nealko: akcia Poldeci nedopĺňa poldeci.
    let otocenia = b.sums[p].Poldeci ?? 0;
    while (otocenia > 0 && s.hraci[p].poldeciVypite > 0) {
      hrac(s, p).poldeciVypite -= 1;
      hrac(s, p).poldeciPlne += 1;
      otocenia--;
    }
  }
  events.push({ type: "log", text: "Poldeci z NA EX sa vypili; aktívne akcie Poldeci otočili vypité." });
}

/**
 * Pohreb (pravidlá v4, Michal 2026-10-23 — zlúčil v sebe Liečbu): spáľ
 * priznanú Cirhózu a svoju kartu z línie. Keď je spálená karta Závislý,
 * smieš si vziať jednu kartu zo šenku. Dlh a Preskúmanie Liečby zmizli.
 */
function cmdPohreb(
  s: MutState,
  data: GameData,
  cmd: { cirhozaUid: number; kartaUid: number; senokUid?: number },
  p: PlayerId,
  events: Event[],
): void {
  const b = s.bitkaStav;
  need(s.faza === "bitka" && b !== null && b.krok === "pohreb" && b.caka === p, "Nečaká sa na Pohreb.");
  const cirhozaIdx = s.hraci[p].priznane.findIndex(
    (k) => k.uid === cmd.cirhozaUid && k.defId === "cirhoza",
  );
  need(cirhozaIdx !== -1, "Taká priznaná Cirhóza nie je.");
  const kde = najdiVLinii(s, cmd.kartaUid);
  need(kde !== null && s.strany[kde.strana][kde.index]?.playedBy === p, "Pochovať môžeš len svoju kartu v línii.");
  need(!jeKartaPatronatu(s as GameState, cmd.kartaUid), "Staršieho z patronátu pochovať nemožno.");
  const senokIdx = cmd.senokUid === undefined ? -1 : s.senok.findIndex((k) => k.uid === cmd.senokUid);
  if (cmd.senokUid !== undefined) {
    const karta = s.strany[kde.strana][kde.index] as PlacedCard;
    need(defOf(data, karta.card).tags.includes("Závislý"), "Kartu zo šenku dostaneš len za pochovaného Závislého.");
    need(senokIdx !== -1, "Karta nie je v šenku.");
  }

  hrac(s, p).priznane.splice(cirhozaIdx, 1);
  const pochovana = s.strany[kde.strana].splice(kde.index, 1)[0] as PlacedCard;
  const zoSenku = senokIdx === -1 ? null : (s.senok.splice(senokIdx, 1)[0] as CardInstance);
  if (zoSenku !== null) hrac(s, p).ruka.push(zoSenku as DeepMutable<CardInstance>);
  events.push({
    type: "log",
    text: `Hráč ${p + 1} robí Pohreb: ${rodovo(p, "spálil", "spálila", "páli")} Cirhózu a ${defOf(data, pochovana.card).name}${zoSenku === null ? "" : ` a za Závislého ${rodovo(p, "vzal", "vzala", "berie")} zo šenku ${defOf(data, zoSenku).name}`}.`,
  });
  // Rozhodca #9 (Michal 2026-10-22): spálenie karty z línie je zahodenie — súperov Hrobár dostane cigaretu.
  poZahodeni(s, data, p, 1, events);
  b.pohrebHotovy[p] = true;
  b.caka = null;
  pokracujBitku(s, data, events);
}

function cmdSkipPohreb(s: MutState, data: GameData, p: PlayerId, events: Event[]): void {
  const b = s.bitkaStav;
  need(s.faza === "bitka" && b !== null && b.krok === "pohreb" && b.caka === p, "Nečaká sa na Pohreb.");
  b.pohrebHotovy[p] = true;
  b.caka = null;
  pokracujBitku(s, data, events);
}

/** Návrat kariet, kliatby kola, kontrola konca, ďalšie kolo. */
function koniecBitky(s: MutState, data: GameData, events: Event[]): void {
  const b = s.bitkaStav;
  if (b === null) return;
  // null = sekera: nikto nevyhral ani neprehral, špaky kola čakajú na sekere.
  const vitaz = b.vitaz as PlayerId | null;
  const porazeny = vitaz === null ? null : opponentOf(vitaz);

  // Michal 2026-10-18: proti komu sa delil prebytok, dostane cigaretu za každého
  // posunutého staršieho (viac posunov toho istého = 1 cigareta).
  if (b.prebytokDrzi !== null && b.prebytokPosunute.length > 0) {
    const proti = opponentOf(b.prebytokDrzi as PlayerId);
    hrac(s, proti).cigarety += b.prebytokPosunute.length;
    events.push({
      type: "log",
      text: `Hráč ${proti + 1} dostáva ${cigariet(b.prebytokPosunute.length)} za posunutých starších.`,
    });
  }

  // Kmotor (Úžerník v5, Michal 2026-10-25): po bitke sa priznaný Dlh zníži
  // o silu priazne (1 / 2 / 3) — Dlh zmizne z hry. Bez Dlhu nerobí nič.
  for (const p of [0, 1] as const) {
    let zostava = silaPriazne(data, s as GameState, "UZERNIK", p);
    let spalene = 0;
    while (zostava > 0) {
      const idx = s.hraci[p].priznane.findIndex((k) => k.defId === "dlh");
      if (idx === -1) break;
      hrac(s, p).priznane.splice(idx, 1);
      zostava--;
      spalene++;
    }
    if (spalene > 0) events.push({ type: "log", text: `Priazeň Kmotra: hráčovi ${p + 1} ${spalene === 1 ? "mizne 1 priznaný Dlh" : `miznú ${spalene} priznané Dlhy`}.` });
  }

  // Efekty Výhra/Prehra — ešte kým karty ležia v partiách.
  // vyherny_automat (Dedičstvo): Výhra = 2 cigarety, Prehra = 1 Dlh.
  if (vitaz !== null && vDedicstve(s as GameState, vitaz, "vyherny_automat")) {
    hrac(s, vitaz).cigarety += KONSTANTY.EFEKT.AUTOMAT_VYHRA_CIGARETY;
    events.push({ type: "log", text: `Výherný automat: hráč ${vitaz + 1} ${rodovo(vitaz, "vyhral", "vyhrala", "vyhráva")} ${KONSTANTY.EFEKT.AUTOMAT_VYHRA_CIGARETY} cigarety.` });
  }
  if (porazeny !== null && vDedicstve(s as GameState, porazeny, "vyherny_automat")) {
    for (let i = 0; i < KONSTANTY.EFEKT.AUTOMAT_PREHRA_DLHY; i++) pridajKliatbu(s, data, porazeny, "dlh", events);
  }
  // podvodnik (Prehra, v7): za každého Podvodníka prejde jeden priznaný Dlh porazeného k víťazovi.
  if (vitaz !== null && porazeny !== null) {
    const podvodnici = partiaHraca(s as GameState, porazeny).filter((pl) => pl.card.defId === "podvodnik" && pl.zaverecna !== true).length;
    for (let i = 0; i < podvodnici; i++) {
      const idx = s.hraci[porazeny].priznane.findIndex((k) => k.defId === "dlh");
      if (idx === -1) break;
      const dlh = hrac(s, porazeny).priznane.splice(idx, 1)[0] as DeepMutable<CardInstance>;
      hrac(s, vitaz).priznane.push(dlh);
      events.push({ type: "log", text: `Podvodník: hráč ${porazeny + 1} prepisuje jeden svoj priznaný Dlh na hráča ${vitaz + 1}.` });
    }
  }

  // Krokodíl (Furt, v7): súperov Občan či Zviero vyložené hneď za ním (karty sa kladú
  // na vonkajší koniec, takže za ním = po ňom) po bitke zožerie — z hry, Hrobár nie.
  for (const strana of s.strany) {
    strana.forEach((pl, i) => {
      if (pl.card.defId !== "krokodil" || pl.zaverecna === true) return;
      const obet = strana[i + 1];
      if (obet === undefined || obet.playedBy === pl.playedBy || b.spalit.includes(obet.card.uid)) return;
      const tagy = defOf(data, obet.card as CardInstance).tags;
      if (!tagy.includes("Občan") && !tagy.includes("Zviera")) return;
      b.spalit.push(obet.card.uid);
      events.push({ type: "log", text: `Krokodíl hráča ${pl.playedBy + 1} zožiera kartu ${defOf(data, obet.card as CardInstance).name} — ide z hry.` });
    });
  }

  // Milujúca manželka (Furt): ráta sa ešte pred návratom kariet z línie.
  const manzelky = ([0, 1] as const).map((p) => manzelkyHraca(s as GameState, p));

  // Patronát: víťaz si staršieho nechá, porazený ho vracia na scorecard
  // (kartu staršieho z línie aj z ruky) a platí bolestné.
  vyriesPatronat(s, data, vitaz, events);

  // 7. Návrat kariet — do odhadzovacieho balíčka hráča, ktorý ich zahral.
  //    Zahodené (Dievčina na vydaj) sa spália. Výtržník je výtržníkom len počas
  //    jednej bitky (Michal 2026-10-25): vytriezvie — do balíčka ide karta
  //    s pôvodnými akciami, príznak ostáva len na PlacedCard, ktorá zaniká.
  for (const partia of s.strany) {
    for (const placed of partia) {
      if (placed.vytrznik === true) {
        events.push({ type: "log", text: `Výtržník ${defOf(data, placed.card as CardInstance).name} vytriezvel — karta má znova svoje akcie.` });
        delete (placed as { vytrznik?: true }).vytrznik;
      }
      if (b.spalit.includes(placed.card.uid)) continue;
      hrac(s, placed.playedBy as PlayerId).odhadzovaci.push(placed.card as DeepMutable<CardInstance>);
    }
  }
  s.strany = [[], []];

  // Nepriznaná Cirhóza v ruke ide po bitke do odhadzovacieho balíčka (v5 bod 8,
  // Michal 2026-10-25): kto ju neprizná hneď, riskuje, že sa mu do konca hry
  // nevráti do ruky a na konci ho bude stáť body (ráta sa aj v balíčkoch).
  for (const p of [0, 1] as const) {
    const cirhozy = s.hraci[p].ruka.filter((k) => k.defId === "cirhoza");
    if (cirhozy.length === 0) continue;
    hrac(s, p).ruka = s.hraci[p].ruka.filter((k) => k.defId !== "cirhoza");
    hrac(s, p).odhadzovaci.push(...cirhozy);
    events.push({
      type: "log",
      text: `Hráč ${p + 1}: ${cirhozy.length === 1 ? "nepriznaná Cirhóza z ruky ide" : `${cirhozy.length} nepriznané Cirhózy z ruky idú`} do odhadzovacieho balíčka.`,
    });
  }

  // Víťaz si lokalitu neberie (v6) — karta je už na nástenke (vyplatSpaky).

  // Absťák (pravidlá v2): menej nerestí než minulé kolo → Absťák rovno do
  // hracej oblasti (priznaný); viac → jeden Absťák späť do zásoby. Prvé kolo
  // len nastaví základ.
  // Log uvádza počty nerestí — playtest 20261019-055945: hráči nevedeli,
  // odkiaľ sa Absťák berie.
  if (s.kolo === 1) {
    events.push({
      type: "log",
      text: `Základ závislosti: hráč 1 mal v kole ${textNeresti(s.hraci[0].nerestiTotoKolo)}, hráč 2 ${textNeresti(s.hraci[1].nerestiTotoKolo)}. Kto bude mať v ďalšom kole menej, dostane Absťák.`,
    });
  }
  for (const p of [0, 1] as const) {
    const teraz = s.hraci[p].nerestiTotoKolo;
    const minule = s.hraci[p].nerestiMinuleKolo;
    // Milujúca manželka: Absťák aj pri rovnakom počte nerestí (každá ďalšia o 1 viac).
    const manzelka = manzelky[p] ?? 0;
    if (s.kolo > 1 && teraz < minule + manzelka) {
      hrac(s, p).priznane.push(novaInstancia(s, data, "abstak") as DeepMutable<CardInstance>);
      hrac(s, p).abstakyZiskane = (s.hraci[p].abstakyZiskane ?? 0) + 1;
      // Absťák sa rovno priznáva — a priznanie kliatby dáva kartu (Michal 2026-10-19).
      const dobral = tahaj(s, p, 1, events).length;
      events.push({
        type: "log",
        text: `Hráč ${p + 1} získava Absťák: v kole mal ${textNeresti(teraz)}, v predošlom ${textNeresti(minule)}${manzelka > 0 ? ` (Milujúca manželka: Absťák aj pri ${textNeresti(minule + manzelka - 1)})` : ""}. Každý Absťák mu v bitke uberie 1 tuhé.${dobral > 0 ? " Za priznaný Absťák si doberá kartu." : ""}`,
      });
    } else if (s.kolo > 1 && teraz > minule) {
      const idx = s.hraci[p].priznane.findIndex((k) => k.defId === "abstak");
      if (idx !== -1) {
        hrac(s, p).priznane.splice(idx, 1);
        events.push({ type: "log", text: `Hráč ${p + 1} sa zbavuje Absťáku: v kole mal ${textNeresti(teraz)}, v predošlom ${textNeresti(minule)}.` });
      }
    }
    hrac(s, p).nerestiMinuleKolo = s.hraci[p].nerestiTotoKolo;
    hrac(s, p).nerestiTotoKolo = 0;
  }

  const boloFinale = jeFinale(s);
  s.bitkaStav = null;
  s.ciel = null;
  s.cirhozyVKole = [0, 0];
  s.naexVKole = [false, false];
  delete s.kseftRany;
  s.pitkyKola = [];

  // Prehra balíčkom pod 5 kariet sa vo v5 ruší (Michal 2026-10-24), vydesenie ostáva.
  skontrolujVydesenie(s, data, events, true);
  if (s.koniec !== null) return;

  // Po finále → konečné špaky.
  if (boloFinale) {
    zaverecneBodovanie(s, data, events);
    return;
  }

  // Ďalšie kolo: útočníkom je porazený; po sekere ostáva ten istý.
  s.kolo += 1;
  if (s.rozpis !== undefined && s.kolo > s.lokalitCelkom) {
    // Finále na pinnacle (v7, plan.md 7.3): útočí, kto má viac špakov (pravidlo v6);
    // obranca — ten, kto zaostáva — vyberie a natočí pinnacle lokalitu ako každý cieľ.
    s.utocnik = s.spaky[0] !== s.spaky[1] ? (s.spaky[0] > s.spaky[1] ? 0 : 1) : vitaz !== null ? opponentOf(vitaz) : s.utocnik;
    s.faza = "volbaCiela";
    events.push({ type: "faza", faza: "volbaCiela" });
    events.push({
      type: "log",
      text: `Finále (${s.spaky[0]} : ${s.spaky[1]} špakov): útočí hráč ${s.utocnik + 1}, hráč ${opponentOf(s.utocnik) + 1} vyberá a natáča pinnacle lokalitu.`,
    });
    dolejNaZaciatkuKola(s, events);
    doberPoBitke(s, events);
    return;
  }
  if (s.rozpis === undefined && s.lokalityVHre.length === 0) {
    // Finále (v6, Michal 2026-10-26): útočí, kto má viac špakov; pri rovnosti
    // porazený poslednej bitky, po sekere ostáva útočník (Leader 2026-10-26).
    s.utocnik = s.spaky[0] !== s.spaky[1] ? (s.spaky[0] > s.spaky[1] ? 0 : 1) : vitaz !== null ? opponentOf(vitaz) : s.utocnik;
    s.ciel = { typ: "finale", lokalita: null };
    s.stredFinale = null;
    s.lokalitaOtocena = false;
    events.push({
      type: "log",
      text: `Finále — posledná bitka bez lokality (${s.spaky[0]} : ${s.spaky[1]} špakov). Útočí hráč ${s.utocnik + 1} a jeho prvá karta bude v strede línie.`,
    });
    dolejNaZaciatkuKola(s, events);
    doberPoBitke(s, events);
    s.faza = "draft";
    events.push({ type: "faza", faza: "draft" });
    zacniDraft(s, events);
    return;
  }
  if (vitaz !== null) s.utocnik = opponentOf(vitaz);
  s.faza = "volbaCiela";
  events.push({ type: "faza", faza: "volbaCiela" });
  events.push({ type: "log", text: `Kolo ${s.kolo}: útočí hráč ${s.utocnik + 1}.` });
  dolejNaZaciatkuKola(s, events);
  doberPoBitke(s, events);
}

/** Začiatok kola: vypité poldeci sa čiastočne otočia na plné (PRAVIDLA §6). */
function dolejNaZaciatkuKola(s: MutState, events: Event[]): void {
  for (const p of [0, 1] as const) {
    const pocet = Math.min(KONSTANTY.POLDECI_NA_ZACIATKU_KOLA, s.hraci[p].poldeciVypite);
    if (pocet <= 0) continue;
    hrac(s, p).poldeciVypite -= pocet;
    hrac(s, p).poldeciPlne += pocet;
    events.push({ type: "log", text: `Hráč ${p + 1} si na začiatku kola dolieva ${pocet} poldeci.` });
  }
}

/**
 * Po každej bitke si každý hráč dobere KARTY_PO_BITKE kariet (Michal
 * 2026-10-19 — namiesto doplnenia ruky na 5). Limit ruky nie je.
 */
function doberPoBitke(s: MutState, events: Event[]): void {
  for (const p of [0, 1] as const) {
    const tahane = tahaj(s, p, KONSTANTY.KARTY_PO_BITKE, events);
    if (tahane.length > 0) {
      events.push({ type: "log", text: `Hráč ${p + 1} si po bitke doberá ${kariet(tahane.length)}.` });
    }
  }
}

// ---------------------------------------------------------------------------
// Konce hry

function ukonciHru(
  s: MutState,
  _data: GameData,
  vitaz: PlayerId | null,
  dovod: string,
  events: Event[],
): void {
  s.koniec = { vitaz, dovod, body: null };
  s.faza = "koniec";
  events.push({ type: "koniec", vitaz, dovod, body: null });
}

/** Koľko starších musí hráč vydesiť na výhru — polovica (PRAVIDLA §1). */
export function prahVydesenia(state: { readonly starsi: readonly ElderState[] }): number {
  return Math.ceil(state.starsi.length / 2);
}

/**
 * Vydesenie aspoň polovice starších → výhra (PRAVIDLA §1). Rátajú sa aj
 * nahradení — ostávajú v hre (Michal 2026-10-12). Ohlásené vydesenie
 * (Michal 2026-10-16): kto dosiahne prah, vyhrá, až keď ho udrží do konca
 * NASLEDUJÚCEHO kola — súper má kolo na odpoveď (patronát, Pohoršenie, prebytok).
 * Volá sa po KAŽDOM posune markera (Michal 2026-10-26): pokles pod prah zruší
 * ohlásenie hneď a opätovné doplnenie v tom istom kole ohlási vydesenie odznova.
 */
function skontrolujVydesenie(s: MutState, data: GameData, events: Event[], koniecKola = false): void {
  if (s.koniec !== null) return;
  const vHre = s.starsi;
  if (vHre.length === 0) return;
  const prah = prahVydesenia(s as GameState);
  for (const p of [0, 1] as const) {
    const vydeseni = vHre.filter((e) => vydesil(e as ElderState, p)).length;
    const ohlasene = s.ohlaseneVydesenie[p];
    if (vydeseni < prah) {
      if (ohlasene !== null) {
        s.ohlaseneVydesenie[p] = null;
        events.push({ type: "log", text: `Hráč ${p + 1} už nemá vydesenú polovicu starších (${vydeseni}/${prah}) — hrozba vydesenia padla.` });
      }
      continue;
    }
    if (ohlasene === null) {
      s.ohlaseneVydesenie[p] = s.kolo;
      events.push({
        type: "log",
        text: `Hráč ${p + 1} ${rodovo(p, "vydesil", "vydesila", "desí")} ${vydeseni} z ${vHre.length} starších! Ak ich udrží do konca ďalšieho kola, vyhrá.`,
      });
    } else if (koniecKola && s.kolo > ohlasene) {
      ukonciHru(s, data, p, `Hráč ${p + 1} ${rodovo(p, "udržal", "udržala", "udržiava")} vydesených ${vydeseni} z ${vHre.length} starších.`, events);
      return;
    }
  }
}

/** Nepriznané Cirhózy hráča — v ruke a v oboch balíčkoch (§11, koniec hry v6). */
export function nepriznaneCirhozy(h: Pick<PlayerState, "ruka" | "doberaci" | "odhadzovaci">): number {
  return [...h.ruka, ...h.doberaci, ...h.odhadzovaci].filter((k) => k.defId === "cirhoza").length;
}

/**
 * Výkupné zvyšných zdrojov (Michal 2026-10-27, §14): každý plný poldeci
 * SPAKY_ZA_POLDECI, každých celých CIGARIET_ZA_SPAK cigariet 1 špak, bez stropu.
 * `skryteNaex` = poldeci hráča pod jeho ešte neodkrytým NA EX — ten sa vypije,
 * nie vykúpi (rátajú sa len pre vlastné, súperove pohľad nemá).
 */
export function vykupneHraca(h: Pick<PlayerState, "poldeciPlne" | "cigarety">, skryteNaex = 0): Vykupne {
  const poldeci = Math.max(0, h.poldeciPlne - skryteNaex);
  const cigarety = Math.max(0, h.cigarety);
  return { poldeci, cigarety, spaky: poldeci * KONSTANTY.SPAKY_ZA_POLDECI + Math.floor(cigarety / KONSTANTY.CIGARIET_ZA_SPAK) };
}

/**
 * Koniec hry po finále (v6, Michal 2026-10-26): každá nepriznaná Cirhóza
 * stojí SPAKY_ZA_CIRHOZU špakov, zvyšné plné poldeci a cigarety sa vykúpia
 * (2026-10-27), vyhrá viac špakov, rovnosť je remíza.
 */
function zaverecneBodovanie(s: MutState, _data: GameData, events: Event[]): void {
  const cirhozy: [number, number] = [nepriznaneCirhozy(s.hraci[0] as PlayerState), nepriznaneCirhozy(s.hraci[1] as PlayerState)];
  const vykupne: [Vykupne, Vykupne] = [vykupneHraca(s.hraci[0]), vykupneHraca(s.hraci[1])];
  for (const p of [0, 1] as const) {
    const v = vykupne[p];
    if (v.spaky > 0) {
      s.spaky[p] += v.spaky;
      const casti = [
        v.poldeci > 0 ? pocet(v.poldeci, "plný poldeci", "plné poldeci", "plných poldeci") : null,
        v.cigarety >= KONSTANTY.CIGARIET_ZA_SPAK ? cigariet(v.cigarety) : null,
      ].filter((t): t is string => t !== null);
      events.push({ type: "log", text: `Hráč ${p + 1}: výkupné za ${casti.join(" a ")} — plus ${spakov(v.spaky)}.` });
    }
    if (cirhozy[p] === 0) continue;
    s.spaky[p] -= cirhozy[p] * KONSTANTY.SPAKY_ZA_CIRHOZU;
    events.push({ type: "log", text: `Hráč ${p + 1}: ${pocet(cirhozy[p], "nepriznaná Cirhóza", "nepriznané Cirhózy", "nepriznaných Cirhóz")} — mínus ${spakov(cirhozy[p] * KONSTANTY.SPAKY_ZA_CIRHOZU)}.` });
  }
  const body: [number, number] = [s.spaky[0], s.spaky[1]];
  const vitaz: PlayerId | null = body[0] === body[1] ? null : body[0] > body[1] ? 0 : 1;
  // Záporné špaky (Exekútor, Cirhóza) so znamienkom mínus, nie spojovníkom — vedľa pomlčky pôsobil ako preklep (UI-7).
  const sk = (n: number): string => (n < 0 ? `−${-n}` : String(n));
  s.koniec = { vitaz, dovod: `Odohralo sa finále, špaky ${sk(body[0])} : ${sk(body[1])}.`, body, cirhozy, vykupne };
  s.faza = "koniec";
  events.push({ type: "koniec", vitaz, dovod: s.koniec.dovod, body });
}

// ---------------------------------------------------------------------------
// Legálne príkazy (pre klienta aj smoke test)

function mozeFajcit(state: GameState, p: PlayerId): boolean {
  const h = state.hraci[p];
  return h.cigarety >= cenaFajceniaHraca(state, p) && !zakazFajcit(state) && jeCoTahat(h.doberaci.length, h.odhadzovaci.length);
}

export function legalCommands(data: GameData, state: GameState, p: PlayerId): Command[] {
  if (!mozeHrat(state, p)) return [];
  if (cakaHasic(state)) return volbyNastupu(state);
  const out: Command[] = [];

  switch (state.faza) {
    case "volbaCiela": {
      for (const lok of lokalityNaVyber(data, state)) {
        out.push({ type: "chooseLocation", uid: lok.uid, otocena: false });
        out.push({ type: "chooseLocation", uid: lok.uid, otocena: true });
      }
      break;
    }
    case "draft": {
      const d = state.draftStav;
      if (d === null) break;
      if (d.krok === "stavba") {
        // Všetky rozdelenia by boli tisíce príkazov — vypíšu sa súvislé okná
        // (každé je legálne; apply prijme ľubovoľný výber správnej veľkosti).
        const b = d.balicky[p].map((k) => k.uid);
        const krok = krokStavby(b.length);
        const n = krok.doSenku + krok.odhod;
        for (let i = 0; i + n <= b.length; i++) {
          const okno = b.slice(i, i + n);
          out.push({ type: "stavbaSenku", doSenku: okno.slice(0, krok.doSenku), odhod: okno.slice(krok.doSenku) });
          if (krok.odhod > 0) out.push({ type: "stavbaSenku", doSenku: okno.slice(krok.odhod), odhod: okno.slice(0, krok.odhod) });
        }
      } else if (d.krok === "patronat") {
        if (d.naTahu !== p || d.hotovo[p]) break;
        out.push({ type: "bezPatronatu" });
        const kandidati = kandidatiNaNahradu(data, state.hraci[p].ruka);
        for (const elder of moznyPatronat(data, state, p)) {
          for (const k of kandidati) out.push({ type: "patronat", elderId: elder.elderId, uid: k.uid });
        }
      } else if (!d.hotovo[p]) {
        out.push({ type: "draftStop" });
        const senok = state.senok.map((k) => k.uid);
        for (const pocet of moznostiZoSenku(state, p)) {
          if (pocet === 1) for (const uid of senok) out.push({ type: "draftBer", uids: [uid] });
          else for (let i = 0; i < senok.length; i++) for (let j = i + 1; j < senok.length; j++) out.push({ type: "draftBer", uids: [senok[i]!, senok[j]!] });
        }
      }
      break;
    }
    case "zhromazdenie": {
      const z = state.zhromazdenieStav;
      if (z === null) break;
      out.push({ type: "pass" });
      const vylozenia: Command[] = [];
      for (const karta of state.hraci[p].ruka) {
        for (const target of cieleVykladania(data, state.strany, p, karta, z.zostavaLimit[p], state.hraci[p].cigarety >= cenaDedicstva(state), cielLokalitaId(state), [false, false], finaleBezStredu(state))) {
          vylozenia.push({ type: "place", uid: karta.uid, target });
          // Záverečná: tá istá karta lícom dole za cigaretu.
          if ((target === "vlastna" || target === "superova") && state.hraci[p].cigarety >= KONSTANTY.CENA_ZAVERECNEJ) {
            vylozenia.push({ type: "zaverecna", uid: karta.uid, target });
          }
        }
      }
      // Vypiť len znižuje limit — keď sa nedá nič vyložiť, nepomôže (priznanie
      // ťah neodovzdáva, tomu vypitie tiež nepridá).
      const doLinie = vylozenia.some((c) => c.type === "place" && c.target !== "priznanie");
      if (doLinie && state.hraci[p].poldeciPlne > 0 && !z.pasoval[p] && !zakazVypit(state)) out.push({ type: "vypit" });
      // Fajčiť sa v Zhromaždení nesmie (v5, Michal 2026-10-24) — len v Pitke.
      out.push(...vylozenia);
      break;
    }
    case "pitka": {
      if (state.vizia !== null) {
        out.push({ type: "vizia", vziat: true }, { type: "vizia", vziat: false });
        break;
      }
      const pitka = state.pitkaStav;
      if (pitka === null) break;
      if (pitka.reakcia === p) {
        // Reakcia na NA EX: jedna karta do línie mimo limitu, alebo nič.
        out.push({ type: "bezReakcie" });
        for (const karta of state.hraci[p].ruka) {
          for (const target of cieleVykladania(data, state.strany, p, karta, Number.POSITIVE_INFINITY, true, cielLokalitaId(state), [false, false], finaleBezStredu(state))) {
            if (target === "vlastna" || target === "superova") out.push({ type: "place", uid: karta.uid, target });
          }
        }
        break;
      }
      // Krčma: kým je NA EX možné a poldeci plný, skončiť Pitku sa nedá.
      if (!krcmaVyzaduje(data, state, p)) out.push({ type: "skipNaex" });
      for (const uid of moznostiNaex(data, state, p)) out.push({ type: "naex", uid });
      if (
        !pitka.postarka[p] &&
        efektHraca(state, p, "postarka") &&
        !efektPotlaceny(data, state, p, "postarka") &&
        jeCoTahat(state.hraci[p].doberaci.length, state.hraci[p].odhadzovaci.length)
      ) {
        for (let n = 1; n <= KONSTANTY.EFEKT.POSTARKA_KARTY; n++) out.push({ type: "postarka", pocet: n });
      }
      if (
        !pitka.starosta[p] &&
        state.hraci[p].cigarety >= 1 &&
        efektHraca(state, p, "starosta") &&
        !efektPotlaceny(data, state, p, "starosta")
      ) {
        for (const k of state.hraci[p].ruka) {
          if (jeKartaPatronatu(state, k.uid) || k.defId === "cirhoza") continue;
          for (const z of state.senok) out.push({ type: "starosta", rukaUid: k.uid, senokUid: z.uid });
        }
      }
      if (mozeFajcit(state, p)) out.push({ type: "smoke", pocet: 1 });
      if (vykupZoSrotu(state) && pitka.vykup?.[p] !== true && state.hraci[p].cigarety >= KONSTANTY.EFEKT.ZBERNY_DVOR_CENA) {
        for (const k of state.hraci[p].odhadzovaci) out.push({ type: "vykup", uid: k.uid });
      }
      if (state.hraci[p].cigarety >= barterCena(data, state, p)) {
        out.push({ type: "barter" });
      }
      if (
        (state.hraci[p].cigarety >= KONSTANTY.REFILL_CENA || doliatieNaKari(state)) &&
        state.hraci[p].poldeciVypite > 0 &&
        !doliatieZakazane(state, p)
      ) {
        out.push({ type: "refillPoldeci" });
      }
      out.push(...moznostiKseftu(data, state, p));
      break;
    }
    case "bitka": {
      const b = state.bitkaStav;
      if (b === null || b.caka !== p) break;
      // Výbery viacerých kariet: vypíšu sa súvislé okná (každé je legálne;
      // apply prijme aj ľubovoľný iný výber správnej veľkosti).
      const okna = (uids: readonly number[], k: number): number[][] =>
        k <= 0 ? [[]] : Array.from({ length: Math.max(0, uids.length - k + 1) }, (_, i) => uids.slice(i, i + k));
      if (b.krok === "kar") {
        out.push({ type: "kar", uid: null });
        const cirhoza = state.hraci[p].ruka.find((k) => k.defId === "cirhoza");
        if (cirhoza !== undefined) out.push({ type: "kar", uid: cirhoza.uid });
      } else if (b.krok === "benzinka") {
        const obcania = obcaniaVLinii(state, data, p).map((o) => o.card.uid);
        for (const uids of okna(obcania, b.benzinkaZostava[p])) out.push({ type: "benzinka", uids });
      } else if (b.krok === "cintorin") {
        out.push({ type: "cintorin", uid: null });
        for (const k of state.hraci[p].ruka) if (defOf(data, k).tags.includes("Nástroj")) out.push({ type: "cintorin", uid: k.uid });
      } else if (b.krok === "zivnostnik") {
        const videne = new Set<string>();
        for (const k of state.hraci[opponentOf(p)].dedicstvo) {
          if (videne.has(k.defId)) continue;
          videne.add(k.defId);
          out.push({ type: "zivnostnik", uid: k.uid });
        }
      } else if (b.krok === "vestica") {
        const opp = opponentOf(p);
        const prve = (karty: readonly CardInstance[]): number[] => {
          const videne = new Set<string>();
          return karty.flatMap((k, i) => (videne.has(k.defId) ? [] : (videne.add(k.defId), [i])));
        };
        for (const moja of prve(state.hraci[p].doberaci)) {
          for (const jeho of prve(state.hraci[opp].doberaci)) out.push({ type: "vestica", moja, jeho });
        }
      } else if (b.krok === "exekutor") {
        out.push({ type: "zahradkar", zahodit: true }, { type: "zahradkar", zahodit: false });
      } else if (b.krok === "pohorsenie") {
        for (const elder of state.starsi) {
          if (pohorsenieMozne(state, p, elder)) out.push({ type: "pohorsenie", elderId: elder.elderId });
          if (pohorsenieMozne(state, p, elder, true)) out.push({ type: "pohorsenie", elderId: elder.elderId, kSebe: true });
        }
      } else if (b.krok === "prebytok") {
        if (b.prebytokZostava < cenaPosunuPrebytkom(state, p)) break;
        for (const elder of state.starsi) {
          if (posunMarker(elder, opponentOf(p)) !== null) {
            out.push({ type: "prebytok", elderId: elder.elderId });
          }
        }
      } else if (b.krok === "pohreb") {
        out.push({ type: "skipPohreb" });
        const cirhozy = state.hraci[p].priznane.filter((k) => k.defId === "cirhoza");
        for (const cirhoza of cirhozy) {
          for (const placed of partiaHraca(state, p)) {
            if (jeKartaPatronatu(state, placed.card.uid)) continue;
            const pohreb = { type: "pohreb", cirhozaUid: cirhoza.uid, kartaUid: placed.card.uid } as const;
            out.push(pohreb);
            if (defOf(data, placed.card).tags.includes("Závislý")) {
              for (const zoSenku of state.senok) out.push({ ...pohreb, senokUid: zoSenku.uid });
            }
          }
        }
      }
      break;
    }
    default:
      break;
  }
  return out;
}

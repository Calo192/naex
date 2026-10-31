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
import { evaluateLine, okolieVLinii, prevahaStran, prispevkyKariet, zvieratAUmlcane } from "./partia.ts";
import { krajeStran } from "./hrany.ts";
import type { PlayerState } from "./player.ts";
import {
  cenaBarteru,
  freshPlayer,
  hodnotaViery,
  pocetAbstakov,
  prahCirhozy,
  prahDlhu,
  textNeresti,
} from "./player.ts";
import type { BattleOutcome, BattleSide, DamageResult, RozhodnutieBitky } from "./battle.ts";
import { battleOutcome, computeDamage, spakyPriExekucii, spakyZaBitku, zhoriPriExekucii } from "./battle.ts";
import type { ElderState, Klebety, MarkerPos, PosunMarkera, Vazen } from "./elders.ts";
import {
  MARKER_STRED,
  NAZVY_ZON,
  STAV_STARSIEHO,
  STUPNICA_ZONY,
  freshElder,
  pokusMozny,
  posunMarker,
  posunZaBody,
  priazenHraca,
  priazenSila,
  poveraMozna,
  spojKlebety,
  telefonHraca,
  ucinnaPriazen,
  obavanyHrac,
  poKonciKola,
  sPosunutymMarkerom,
  spakyZaStarsich,
  strachNaVyplatu,
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
  bezLimituPracujuci,
  dovodZakazuFajcit,
  jednotaZakazuje,
  nastrojeTuhe,
  naexPecenSuperovi,
  prahDlhuBonus,
  stranaOltara,
  efektHraca,
  efektPotlaceny,
  jeCielLokalita,
  jeEfektManual,
  lenVlastnaStrana,
  limitBonusDedicstva,
  limitZhromazdenia,
  naexZaPitku,
  prahCirhozyBonus,
  zakazVypit,
  zadlzenieZLinie,
  vDedicstve,
  partiaHraca,
  vPartii,
  zvieraPlati,
  naexNaZviera,
  liberalZadlzenie,
  traktoristkyBezPrevahy,
} from "./effects.ts";
import type { VerejnyHrac, VerejnyStav } from "./effects.ts";
import type { Favour } from "./types.ts";

// ---------------------------------------------------------------------------
// Stav

/**
 * Cieľ kola je lokalita — bitku o staršieho nahradil patronát a od v9 pokus o zajatie (Michal
 * 2026-10-20). Posledná bitka je finále na pinnacle lokalite (v7).
 */
export type CielKola =
  | {
      readonly typ: "lokalita";
      /** Karta v strede línie. */
      readonly lokalita: CardInstance | null;
    }
  // v7 (plan.md 7.3): finále sa hrá na pinnacle lokalite.
  | { readonly typ: "finale"; readonly lokalita: CardInstance };

/**
 * Pokus o zajatie (v9, Michal 2026-10-30, §10 „Zajatie a väzeň“): hráč zaplatil
 * cigaretu, karta staršieho je v súperovej ruke (boss) a starší je „v ohrození“ —
 * jeho markerom v tomto kole nič nehýbe. Verejné.
 */
export interface PokusOZajatie {
  readonly elderId: string;
}

/**
 * Kšefty väzňov s účinkom do konca kola (v9, §7): Starosta (hrany posilnené),
 * Farár (Viera súpera je posilnený Hazard, index = hráč, ktorého Viera), Vychovávateľka
 * (Petelice = +3 tuhé držiteľovi v bitke za každú splnenú hrozbu). Verejné.
 */
export interface KseftyKola {
  readonly hranyPosilnene?: boolean;
  readonly vieraAkoHazard?: readonly [boolean, boolean];
  readonly petelice?: readonly [number, number];
}

/** Výber hráča v jednom kroku stavby šenku (uid z jeho balíčka stavby). */
export interface VyberStavby {
  readonly doSenku: readonly number[];
  readonly odhod: readonly number[];
}

/**
 * Draft (Michal 2026-10-12): najprv hráči šenok postavia — z balíčkov, ktoré
 * si podávajú, naraz dávajú karty do šenku a naspodok spoločného balíčka
 * (Michal 2026-10-19: po dvoch, aby stavba mala len dva kroky; od v8.5
 * naspodok Náradia a Občanov) — potom
 * z neho striedavo berú, začína útočník.
 */
export interface DraftStav {
  /** Po braní nasleduje pokus o zajatie (v9): rozhoduje útočník, potom obranca. */
  readonly krok: "stavba" | "beranie" | "zajatie";
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
}

/**
 * Za koľko kariet dostane hráč cigarety, keď teraz pasuje (§6):
 * zvyšok limitu, najviac toľko, koľko má kariet v ruke (v6.1, Michal 2026-10-27 —
 * s prázdnou rukou pas nič nedá).
 */
export function kartyZaPas(z: Pick<ZhromazdenieStav, "zostavaLimit">, p: PlayerId, vRuke: number): number {
  return Math.max(0, Math.min(z.zostavaLimit[p], vRuke));
}

/**
 * Cigarety, ktoré hráč p dostane, keď teraz pasuje — jeden výpočet pre motor aj
 * náhľad pasu: karty za pas (kartyZaPas) a Píšťalka v súperovom
 * Dedičstve (Náradie 2026-10-30): súperove aktívne Obmedzenia v línii ich uberajú, najmenej 0.
 */
export function cigaretyZaPas(
  data: GameData,
  s: VerejnyStav & { readonly lokalitaOtocena: boolean; readonly zhromazdenieStav: Pick<ZhromazdenieStav, "pasoval" | "zostavaLimit"> | null },
  p: PlayerId,
  vRuke: number,
): number {
  const z = s.zhromazdenieStav;
  if (z === null) return 0;
  const karty = kartyZaPas(z, p, vRuke);
  const zaPas = karty * KONSTANTY.CIGARETY_ZA_PAS_NA_KARTU;
  const q = opponentOf(p);
  if (zaPas === 0 || !vDedicstve(s, q, "pistalka")) return zaPas;
  const obmedzenia = evaluateLine(data, lineState(s)).sums[q].Obmedzenie ?? 0;
  return Math.max(0, zaPas - obmedzenia);
}

export interface PitkaStav {
  readonly naTahu: PlayerId;
  readonly hotovy: readonly [boolean, boolean];
  /** Limit NA EX za Pitku je po odkrytí minutý. */
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
  /** Poštárka a Starosta sa smú použiť raz za Pitku (do v7; od v9 sa nepoužíva). */
  readonly postarka: readonly [boolean, boolean];
  readonly starosta: readonly [boolean, boolean];
  /** Väzeň Krčmárka (v9): hráč v tejto Pitke NA EX nedá. Verejné. */
  readonly zakazNaex?: readonly [boolean, boolean];
  /** Väzeň Vychovávateľka (v9): koľko hrozieb Petelicou má hráč na súperovo NA EX v tejto Pitke. */
  readonly hrozbaPetelice?: readonly [number, number];
  /** Väzeň Veterinár (v9): hráčovi sa v tejto Pitke nepočíta poškodenie pečene. */
  readonly bezPecene?: readonly [boolean, boolean];
  /** Koľko NA EX hráč v tejto Pitke dal (odkrytých). */
  readonly naexPocet?: readonly [number, number];
  /** Zberný dvor: výkup karty z odhadzovacieho balíčka už v tejto Pitke použitý. */
  readonly vykup?: readonly [boolean, boolean];
  /** Kšefty (v7) použité v tejto Pitke — uid kariet (aj lokality) za každého hráča. */
  readonly kseft?: readonly [readonly number[], readonly number[]];
  /** Úplatky (v7) v tejto Pitke — uid Kulturistov, na ktoré už súper cigaretu dal. */
  readonly uplatok?: readonly number[];
  /** Cigarety vyfajčené v tejto Pitke (Krabička cigariet v7). */
  readonly vyfajcene?: readonly [number, number];
  /**
   * NA EX naraz (v5): skryto vybrané NA EX, ktoré sa odkryjú, keď obaja skončia
   * Pitku — TAJNÉ, každý vidí len svoje (viewFor).
   */
  readonly skryteNaex?: readonly SkryteNaex[];
  /** Po odkrytí NA EX: kto ešte odpovedá v tomto kole odpovedí (v9.2: útočník, potom obranca). */
  readonly frontaReakcii?: readonly PlayerId[];
  /** Koľko odpovedí ešte hráč smie dať — jednu za každé súperovo NA EX (v9.2). */
  readonly odpovedeZostava?: readonly [number, number];
  /**
   * Na koniec ktorej strany odpovedal lícom dole prvý v tomto kole odpovedí (v9.2) —
   * druhý smie len na druhý kraj línie. null = prvý neodpovedal (druhý na ktorýkoľvek).
   */
  readonly krajOdpovede?: PlayerId | null;
  /**
   * Pitka naraz (Michal 2026-10-27): obaja hrajú súčasne, len majiteľ Bzdochy
   * čaká, kým súper skončí, a potom vidí jeho NA EX. Kto čaká; null = nikto
   * (aj keď Bzdochu majú obaja). Verejné — Bzdocha leží v línii.
   */
  readonly bzdocha?: PlayerId | null;
}

/** Skryto vybrané NA EX (v5): kto ho dal a na ktorú kartu (skutočné uid). */
export interface SkryteNaex {
  readonly hrac: PlayerId;
  readonly uid: number;
}

export type BitkaKrok =
  | "benzinka"
  | "kar"
  | "povery"
  | "exekutor"
  | "pohorsenie"
  | "prebytok"
  | "vestica"
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
  /**
   * Povery, ktoré hráč ešte rozdelí medzi starších (v8.3 „Výpožička priazne“) —
   * zvyšné po vyrušení s Vierou; nastaví sa pri vstupe do kroku Povery.
   */
  readonly poveryZostava?: readonly [number, number];
  /** Klebety tohto kola: o koľko stupňov Povery posunuli silu priazne starších (elders.ts). */
  readonly klebety?: Klebety;
  /** Klebety z Povier každého hráča zvlášť — Horoskop ich prenesie do ďalšieho kola. */
  readonly klebetyHracov?: readonly [Klebety, Klebety];
  /** Robota už v tejto bitke spálila Dlhy a dala špaky (exekucieBitky sa smie volať znova). */
  readonly robotaHotova?: readonly [boolean, boolean];
  readonly pohorseniaSpolu?: readonly [number, number];
  readonly damage: DamageResult | null;
  readonly vitaz: PlayerId | null;
  readonly prebytokDrzi: PlayerId | null;
  readonly prebytokZostava: number;
  /** Starší posunutí prebytkom v tejto bitke — súper držiteľa za nich dostane cigarety. */
  readonly prebytokPosunute: readonly string[];
  /** Benzínka: koľko svojich Občanov z línie má hráč ešte zahodiť. */
  readonly benzinkaZostava: readonly [number, number];
  /** Kar: hráč už rozhodol, či zahodí nepriznanú Cirhózu z ruky. */
  readonly karHotovy: readonly [boolean, boolean];
  /** Karty z línie, ktoré sa po bitke spália namiesto návratu (Dievčina na vydaj). */
  readonly spalit: readonly number[];
  readonly vesticaHotova: boolean;
  /** Cintorín: porazený už rozhodol o Nástroji z ruky či zo šenku do Dedičstva. */
  readonly cintorinHotovy?: boolean;
  /**
   * Živnostník (Výhra): koľko súperových Dedičstiev víťaz ešte zahodí. Nastaví
   * sa až pri vstupe do kroku (undefined = ešte nie).
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
  /** Karta lokality (null len v archívnych záznamoch spred v7). */
  readonly lokalita: CardInstance | null;
  /** Finále — bitka na pinnacle lokalite. */
  readonly finale?: boolean;
  readonly vitaz: PlayerId | null;
  readonly rozhodlo: RozhodnutieBitky;
  /** Odohrané Pitky kola. */
  readonly pitky: number;
  /** Karty v línii pri bitke (v8) — z nich sú špaky za bitku. Chýba v záznamoch spred v8. */
  readonly karty?: number;
  /** Špaky za bitku [hráč 0, hráč 1] — víťazovi so špakmi zo sekery, na Kultúrnom dome (v8) aj porazenému. */
  readonly zaBitku: readonly [number, number];
  /** Noviny (Titulka, 2026-10-28): koľko zo zaBitku porazeného je za Dlhy, ktoré má víťaz navyše. Chýba v starších záznamoch. */
  readonly noviny?: number;
  /** Robota (Náradie 2026-10-30): špaky za Dlhy, ktoré nemala čo spáliť [hráč 0, hráč 1]. */
  readonly robota?: readonly [number, number];
  /** Koľko zo zaBitku víťaz zobral zo sekery (predošlé remízy). */
  readonly zoSekery: number;
  /** Absťáky víťaza navyše oproti porazenému — o toľko dostal menej (do v8; od v8.1 vždy 0). */
  readonly abstakZrazka: number;
  /** Špaky po sekere, ktoré prepadli (remíza vo finále). */
  readonly prepadlo: number;
  readonly zaStarsich: readonly [number, number];
  /**
   * Kto zo zaStarsich koľko dal (Michal 2026-10-27), v poradí ukazovateľov; súčet
   * = zaStarsich. Verejné ako starší a markery. Chýba v záznamoch spred 2026-10-27.
   */
  readonly zaStarsichRozpis?: readonly [readonly SpakyOdStarsieho[], readonly SpakyOdStarsieho[]];
  /** Špaky, ktoré hráčom zhoreli pri exekúcii. */
  readonly exekutor: readonly [number, number];
  /** Nakladačka zmenená na špaky: do v7 po finále a na Kultúrnom dome, v8–v9 vždy 0, od v9.1 vo finále 1 : 1. */
  readonly prebytok: readonly [number, number];
  /** Špaky oboch po bitke (pred záverečnou Cirhózou a výkupným). */
  readonly spakyPo: readonly [number, number];
}

/** Položka rozpisu špakov za starších po bitke (BitkaNaNastenke.zaStarsichRozpis). */
export interface SpakyOdStarsieho {
  /** Ukazovateľ staršieho; null = Noviny v Dedičstve (+1, keď sa hráča bojí viac starších). */
  readonly elderId: string | null;
  /** Karta, ktorej meno sa ukáže: čo leží na ukazovateli (aj náhrada), alebo Noviny. */
  readonly defId: string;
  readonly spaky: number;
}

export interface KoniecHry {
  readonly vitaz: PlayerId | null;
  readonly dovod: string;
  /** Konečné špaky — null, keď sa hra skončila inak než po finále (tretí väzeň, vzdanie). */
  readonly body: readonly [number, number] | null;
  /** Špaky za väzňov po finále (v9, podľa poradia zajatia v partii). */
  readonly vazni?: readonly [number, number];
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
  /** Balíček Náradie (v8.5): karty s tagom Nástroj, zhora nadol. */
  readonly naradie: readonly CardInstance[];
  /** Balíček Občania (v8.5): všetky ostatné karty šenku, zhora nadol. */
  readonly obcania: readonly CardInstance[];
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
  /** Hráč dal v tomto kole NA EX (Krčmárka). */
  readonly naexVKole: readonly [boolean, boolean];
  /** Partia bez Chuti a Absťáku (výučba Prvá hra, v9.1) — koniec kola ich nerieši. */
  readonly bezChuti?: true;
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
  /** Pokus o zajatie hráča v tomto kole (v9, každý najviac jeden). Verejné. */
  readonly pokusy: readonly [PokusOZajatie | null, PokusOZajatie | null];
  /** Väzni oboch hráčov v poradí zajatia (v9). Verejné. */
  readonly vazni: readonly Vazen[];
  /** Kšefty väzňov s účinkom do konca kola (v9). Verejné. */
  readonly kseftyKola?: KseftyKola;
  /**
   * Posuny markerov (Pohoršenie, prebytok, zajatie) od poslednej bitky do
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
  /** Koľkokrát súper v tomto kole priložil kartu ku karte hráča (Pasca v7); verejné. */
  readonly prilozeniaKu?: readonly [number, number];
  /** Poldeci, ktoré akcie Poldeci v tomto kole už otočili v Pitke (Jogurt, Náradie 2026-10-30). */
  readonly poldeciOtoceneVKole?: readonly [number, number];
  /**
   * Klebety z Povier hráča s Horoskopom (Náradie 2026-10-30) — platia aj v nasledujúcom
   * kole; priazen() ich pripočíta ku klebetám bitky. Verejné.
   */
  readonly klebetyPrenesene?: Klebety;
}

/** Čakajúca voľba Hasiča. */
export interface HasicVolba {
  readonly hrac: PlayerId;
  /**
   * Voľba, ktorá čaká ako Hasič (v7): karta zo šenku (Starosta, Dohadzovačka, Zastávka),
   * Nástroj za Živnostníka, starší pre Kapybaru. Klebetnica a Dohadzovačka
   * s pôvodnými efektmi ostávajú pre staré uloženia. Chýba = Hasič.
   */
  readonly typ?: "klebetnica" | "dohadzovacka" | "senok" | "nastroj" | "kapybara";
  readonly uid: number;
  /**
   * Čo hra odložila do rozhodnutia: odpoveď na NA EX by hneď vyhodnotila
   * Pitku a otočená Záverečná by ju ukončila — s kartou ešte nerozhodnutou.
   */
  readonly potom: "reakcia" | "odpovede" | "koniecPitky" | "bitka" | "zastavka" | null;
  /** Živnostník: strana, na ktorej leží — Nástroj sa priloží za neho. */
  readonly strana?: PlayerId;
}

type DeepMutable<T> = { -readonly [K in keyof T]: DeepMutable<T[K]> };
type MutState = DeepMutable<GameState>;

// ---------------------------------------------------------------------------
// Príkazy a udalosti

export type Command =
  | { readonly type: "chooseLocation"; readonly uid: number; readonly otocena: boolean }
  // Pokus o zajatie po šenku (v9): starší, ktorý sa ťa bojí na stupni 3, za cigaretu.
  | { readonly type: "pokus"; readonly elderId: string }
  | { readonly type: "bezPokusu" }
  // Kšeft väzňa (v9): za vypitý poldeci; kartaUid = karta zo šenku (Autobusár) či Cirhóza (Veterinár).
  | { readonly type: "kseftVazna"; readonly elderId: string; readonly kartaUid?: number }
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
  // Benzínka: vlastní Občania z línie, ktorí sa zahodia.
  | { readonly type: "benzinka"; readonly uids: readonly number[] }
  // Kar (Bitka, roadmapa #80): zahoď jednu nepriznanú Cirhózu z ruky, alebo nič (uid null).
  | { readonly type: "kar"; readonly uid: number | null }
  // Veštica (Prehra): poradové čísla v odhalených doberacích balíčkoch.
  | { readonly type: "vestica"; readonly moja: number; readonly jeho: number }
  // Vízia na konci Pitky: vrchnú kartu doberacieho balíčka do ruky (true), alebo zahodiť (false).
  // Krištáľová guľa (Náradie 2026-10-30): druha = rozhodnutie o druhej karte zhora, prvá ostane navrchu.
  | { readonly type: "vizia"; readonly vziat: boolean; readonly druha?: true }
  // Zberný dvor do v7 — od v7 je to Kšeft (kseft s kartaUid); príkaz ostáva pre staré záznamy.
  | { readonly type: "vykup"; readonly uid: number }
  // Cintorín (Prehra, Michal 2026-10-27): Nástroj z ruky alebo zo šenku do Dedičstva zadarmo, alebo nič (uid null).
  | { readonly type: "cintorin"; readonly uid: number | null }
  // Živnostník (Výhra): uid súperovho Dedičstva, ktoré víťaz zahodí.
  | { readonly type: "zivnostnik"; readonly uid: number }
  // Hasič (Nástup, Michal 2026-10-26): kartu z odhadzovacieho balíčka si nechať v ruke (true), alebo ju vrátiť (false).
  | { readonly type: "hasic"; readonly nechat: boolean }
  // Kšeft (v7): uid karty v línii alebo lokality; voľba podľa karty (Smetiarka: karta z ruky,
  // Predsedova vila: starší a smer).
  | { readonly type: "kseft"; readonly uid: number; readonly kartaUid?: number; readonly elderId?: string; readonly kSebe?: boolean }
  // Klebetnica (Nástup, v7): uid karty zo súperovej ruky, ktorá ide naspodok jeho balíčka.
  | { readonly type: "klebetnica"; readonly uid: number }
  // Dohadzovačka (Nástup, v7): dvaja starší, ktorým sa vymenia scorecardy.
  | { readonly type: "dohadzovacka"; readonly elderA: string; readonly elderB: string }
  // Karta zo šenku za Starostu (Nástup) či Dohadzovačku (Bitka), v7.
  | { readonly type: "senok"; readonly uid: number }
  // Živnostník (Nástup, v7): Nástroj z ruky, ktorý sa priloží za neho, alebo nič (uid null).
  | { readonly type: "nastroj"; readonly uid: number | null }
  // Kapybara (Nástup, v7): starší, ktorého marker sa posunie o 1 pole k stredu.
  | { readonly type: "kapybara"; readonly elderId: string }
  // Úplatok (v7): cigareta na súperovho Kulturistu (uid v línii).
  | { readonly type: "uplatok"; readonly uid: number }
  // Fajčenie: pocet kariet naraz (chýba = 1).
  | { readonly type: "smoke"; readonly pocet?: number }
  | { readonly type: "barter" }
  | { readonly type: "refillPoldeci" }
  // Pohoršenie (v5 bod 7): marker o 1 k súperovi (bez kSebe), alebo k sebe (kSebe: true).
  | { readonly type: "pohorsenie"; readonly elderId: string; readonly kSebe?: boolean }
  // Povera (v8.3): sila priazne staršieho o stupeň k hráčovi, len na toto kolo.
  | { readonly type: "povera"; readonly elderId: string }
  | { readonly type: "prebytok"; readonly elderId: string }
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
      /**
       * Línia pri vyhodnotení (verejná ako karty vyššie) — klient z nej počíta Počítadlo bitky,
       * keď bitka prišla v tom istom ťahu ako odpoveď na NA EX (jeho posledný pohľad ju ešte nemal).
       */
      readonly strany?: readonly [readonly PlacedCard[], readonly PlacedCard[]];
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
  /**
   * Odpoveď na odkryté NA EX (Michal 2026-10-28: „neviem, ako súper zareagoval“) — verejná:
   * karta ide do línie lícom hore. uid/defId null = hráč neodpovedal.
   */
  | {
      readonly type: "odpovedNaNaex";
      readonly hrac: PlayerId;
      readonly uid: number | null;
      readonly defId: string | null;
      readonly ciel: CielVykladania | null;
    }
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
/** Stav, z ktorého sa rátajú klebety kola (GameState aj ClientState). */
export interface StavKlebiet {
  readonly bitkaStav?: { readonly klebety?: Klebety } | null;
  readonly klebetyPrenesene?: Klebety;
}

/** Klebety, ktoré v tomto kole platia: z Povier tejto bitky a prenesené Horoskopom (Náradie 2026-10-30). */
export function klebetyKola(state: StavKlebiet): Klebety | undefined {
  return spojKlebety(state.bitkaStav?.klebety, state.klebetyPrenesene);
}

export function priazen(
  data: GameData,
  state: { readonly starsi: readonly ElderState[] } & StavKlebiet,
  favour: Favour,
  p: PlayerId,
): number {
  const klebety = klebetyKola(state);
  for (const elder of state.starsi) {
    // Priazeň dáva ukazovateľ (scorecard), nie karta, ktorá na ňom leží —
    // aj po náhrade staršieho. Klebety z Povier (v8.3) ju v tomto kole posúvajú.
    if (favourStarsieho(data, elder) !== favour) continue;
    const u = ucinnaPriazen(elder, klebety);
    if (u.hrac === p) return KONSTANTY.NASOBOK_PRIAZNE * u.sila;
  }
  return 0;
}

/**
 * Sila priazne (1 / 2 / 3) daného typu pre hráča p, 0 ak ju nemá. Priazne v5
 * (Michal 2026-10-24/25, miera sily: 1 bod ≈ 1 cigareta za kolo) pôsobia silou,
 * nie dvojnásobkom.
 */
export function silaPriazne(
  data: GameData,
  state: { readonly starsi: readonly ElderState[] } & StavKlebiet,
  favour: Favour,
  p: PlayerId,
): number {
  return priazen(data, state, favour, p) / KONSTANTY.NASOBOK_PRIAZNE;
}

function hrac(s: MutState, p: PlayerId): DeepMutable<PlayerState> {
  return s.hraci[p] as DeepMutable<PlayerState>;
}

/** Spáli najviac `najviac` priznaných Dlhov hráča (z hry); vráti, koľko ich naozaj bolo. */
function odoberDlhy(s: MutState, p: PlayerId, najviac: number): number {
  const odobrate = Math.max(0, Math.min(najviac, s.hraci[p].dlhy));
  hrac(s, p).dlhy -= odobrate;
  return odobrate;
}

/** Presunie najviac `najviac` priznaných Dlhov od hráča `od` k hráčovi `k`; vráti, koľko. */
function presunDlhy(s: MutState, od: PlayerId, k: PlayerId, najviac: number): number {
  const n = odoberDlhy(s, od, najviac);
  hrac(s, k).dlhy += n;
  return n;
}

function cielLokalita(s: GameState): CardInstance | null {
  return s.ciel?.lokalita ?? null;
}

/** defId lokality, o ktorú sa hrá (aj pinnacle vo finále) — null pred voľbou cieľa (aj pre klienta). */
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

/**
 * Lokality, z ktorých obranca vyberá cieľ (v7: neodohrané lokality úrovne kola).
 * Vo v7 sú v lokalityVHre všetky lokality sady — keď už niet čo vyberať (finále
 * má cieľ), je výber prázdny, nie celá zvyšná sada. Koľko lokalít ešte príde,
 * povie lokalitNevybranych.
 */
export function lokalityNaVyber(data: GameData, s: Pick<GameState, "lokalityVHre" | "kolo" | "faza"> & { readonly rozpis?: readonly number[] }): CardInstance[] {
  if (s.rozpis === undefined) return [...s.lokalityVHre];
  const u = urovenNaVyber(s);
  if (u === null) return [];
  return s.lokalityVHre.filter((k) => urovenLokality(data, k.defId) === u);
}

/**
 * Koľko lokalít (bez finále) ešte čaká na výber cieľa — kolá o lokalitu pred
 * nami. Vo v7 ich ráta rozpis (kolo k je k-te), lokalityVHre je celá sada;
 * do v6 sú v hre len vyžrebované. Server aj klient (ClientState to spĺňa).
 */
export function lokalitNevybranych(s: Pick<GameState, "lokalityVHre" | "ciel" | "kolo" | "lokalitCelkom"> & { readonly rozpis?: readonly number[] }): number {
  if (s.rozpis === undefined) return s.lokalityVHre.length;
  return Math.max(0, s.lokalitCelkom - s.kolo + (s.ciel === null ? 1 : 0));
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
    // Náradie (2026-10-30): Nástroje v Dedičstve, ktoré menia vyhodnotenie línie — verejné.
    nastroje: [s.hraci[0].dedicstvo.map((k) => k.defId), s.hraci[1].dedicstvo.map((k) => k.defId)],
    // Kšefty väzňov Starosta a Farár (v9) platia do konca kola.
    ...(s.kseftyKola?.hranyPosilnene === true ? { hranyPosilnene: true } : {}),
    ...(s.kseftyKola?.vieraAkoHazard !== undefined ? { vieraAkoHazard: s.kseftyKola.vieraAkoHazard } : {}),
  };
}

/** Bitka na nástenke bola finále (príznak). */
export function jeFinaleNaNastenke(b: Pick<BitkaNaNastenke, "finale">): boolean {
  return b.finale === true;
}

/** Koľko posledných bitiek skončilo sekerou — ich špaky čakajú na víťaza ďalšej bitky. */
export function bitkyNaSekere(nastenka: readonly Pick<BitkaNaNastenke, "vitaz">[]): number {
  let n = 0;
  for (let i = nastenka.length - 1; i >= 0 && nastenka[i]?.vitaz === null; i--) n++;
  return n;
}

/** Hrá sa finále — posledná bitka na pinnacle lokalite. */
export function jeFinale(s: Pick<VerejnyStav, "ciel">): boolean {
  return s.ciel?.typ === "finale";
}

/**
 * Koľko výplat strachu ešte príde — koncov kola vrátane prebiehajúceho (v8.3:
 * na konci každého kola, aj po finále). Pre odhady (náhľady, bot): udržané stupne
 * zaplatí najbližší koniec kola, nové až ďalší — vo finále teda nič.
 */
export function vyplatZaStarsich(
  s: Pick<GameState, "lokalityVHre" | "ciel" | "koniec" | "kolo" | "lokalitCelkom"> & {
    readonly bitkaStav: { readonly damage: unknown; readonly krok?: BitkaKrok | null } | null;
    readonly rozpis?: readonly number[];
  },
): number {
  if (s.koniec !== null) return 0;
  // Koniec prebiehajúceho kola (v8.3) príde, kým je cieľ — aj po poškodení.
  const tato = s.ciel === null ? 0 : 1;
  // Vo Voľbe cieľa finále (v7) je cieľ ešte null — finále je stále pred nami. Sada bez
  // pinnacle lokalít (bez rozpisu, testy) finále nemá.
  const finaleUz = s.ciel?.typ === "finale" || s.rozpis === undefined;
  return lokalitNevybranych(s) + (finaleUz ? 0 : 1) + tato;
}

/** Karta staršieho (v9): v línii má len akcie, efekt platí len ako Kšeft väzňa. */
export function jeStarsi(data: GameData, defId: string): boolean {
  return data.elders.has(defId);
}

/** Efekt karty defId patrí hráčovi p a nie je umlčaný (Praudovravec). */
function maEfekt(s: MutState, data: GameData, p: PlayerId, defId: string): boolean {
  return efektHraca(s as GameState, p, defId) && !efektPotlaceny(data, s as GameState, p, defId);
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
 * Dlh od v8.2 v balíčku nie je (počítadlo). Vracia karty v ruke.
 */
function tahaj(s: MutState, p: PlayerId, pocet: number, events: Event[]): CardInstance[] {
  const player = hrac(s, p);
  const tahane: CardInstance[] = [];
  for (let i = 0; i < pocet; i++) {
    doplnDoberaci(s, p);
    const karta = player.doberaci.shift();
    if (karta === undefined) break;
    player.ruka.push(karta);
    tahane.push(karta as CardInstance);
  }
  if (tahane.length > 0) {
    events.push({ type: "tahal", hrac: p, pocet: tahane.length });
    events.push({ type: "kartyTahane", hrac: p, karty: tahane, pre: p });
  }
  return tahane;
}

/** Karta mimo ťahania (Zberný dvor, Sklad) ide do ruky. */
function doRuky(s: MutState, p: PlayerId, karta: DeepMutable<CardInstance>): void {
  hrac(s, p).ruka.push(karta);
}

/**
 * Nový Dlh (PRAVIDLA §11, „verejný dlh“ Michal 2026-10-21; v8.2 počítadlo bez
 * karty, Michal 2026-10-30): hneď priznaný, kartu zaň hráč nedobere; špaky berie
 * len cez Exekútora (v6, §11 a §14).
 */
function pridajDlh(s: MutState, p: PlayerId, events: Event[]): void {
  hrac(s, p).dlhy += 1;
  hrac(s, p).dlhyZiskane = (s.hraci[p].dlhyZiskane ?? 0) + 1;
  events.push({ type: "log", text: `Hráč ${p + 1} získava Dlh — hneď sa priznáva (v bitke ho páli Exekútor).` });
}

/**
 * Nová Cirhóza (Michal 2026-10-25; predtým navrch doberacieho) ide do
 * odhadzovacieho balíčka — do ruky príde, až keď sa doberací balíček minie
 * a odhadzovací sa zamieša (tahaj).
 */
function pridajCirhozu(s: MutState, data: GameData, p: PlayerId, events: Event[]): void {
  hrac(s, p).odhadzovaci.push(novaInstancia(s, data, "cirhoza") as DeepMutable<CardInstance>);
  events.push({ type: "log", text: `Hráč ${p + 1} získava Cirhózu — ide do jeho odhadzovacieho balíčka.` });
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
  // Väzeň Veterinár (v9): v tejto Pitke sa hráčovi pečeň nepočíta — ani z NA EX a ceny Kšeftu.
  if (s.pitkaStav?.bezPecene?.[p] === true) return;
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
    pridajCirhozu(s, data, p, events);
    s.cirhozyVKole[p] += 1;
    events.push({ type: "log", text: `Hráč ${p + 1} ${rodovo(p, "dosiahol", "dosiahla", "dosahuje")} prah pečene (${prah}) — Cirhóza.` });
  }
}

/** Zadĺženie z akcií Hazard (kľúč Dlh) + Dlh pri prahu (rovnako ako pečeň a Cirhóza). */
function pridajZadlzenie(s: MutState, data: GameData, p: PlayerId, mnozstvo: number, events: Event[]): void {
  if (mnozstvo <= 0) return;
  const player = hrac(s, p);
  player.zadlzenie += mnozstvo;
  const prah = prahDlhu() + prahDlhuBonus(s as GameState, p);
  while (player.zadlzenie >= prah) {
    player.zadlzenie -= prah;
    pridajDlh(s, p, events);
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
  /** Kto v tejto Pitke dal NA EX (Stryná); chýba = nevie sa, Stryná sa neráta. */
  naexDal?: readonly [boolean, boolean],
): PrirastkyPitky {
  const sums = vyhodnotenie.sums;
  const line = lineState(s);
  // Milujúca manželka (Pitka, v7 M2): poškodenie pečene majiteľa v Pitke −1 za kus,
  // najprv z akcií Poškodenie pečene, potom z Poldeci.
  const pecen: [number, number] = [sums[0].PoškodeniePečene ?? 0, sums[1].PoškodeniePečene ?? 0];
  const poldeci: [number, number] = [sums[0].Poldeci ?? 0, sums[1].Poldeci ?? 0];
  // Stryná (Pitka, v7): každá dá hráčovi bez NA EX v tejto Pitke 1 pečeň.
  const stryne = [...s.strany[0], ...s.strany[1]].filter((pl) => pl.card.defId === "niekoho_stryna" && pl.zaverecna !== true && !efektPotlaceny(data, s, pl.playedBy, "niekoho_stryna")).length;
  if (naexDal !== undefined) for (const p of [0, 1] as const) if (!naexDal[p]) pecen[p] += stryne;
  for (const p of [0, 1] as const) {
    let ubrat = partiaHraca(s, p).filter((pl) => pl.card.defId === "milujuca_manzelka" && pl.zaverecna !== true).length;
    const zPecene = Math.min(ubrat, pecen[p]);
    pecen[p] -= zPecene;
    ubrat -= zPecene;
    poldeci[p] -= Math.min(ubrat, poldeci[p]);
  }
  // Väzeň Veterinár (Kšeft, v9): držiteľovi sa v tejto Pitke poškodenie pečene nepočíta.
  const bezPecene = (s as { readonly pitkaStav?: Pick<PitkaStav, "bezPecene"> | null }).pitkaStav?.bezPecene;
  for (const p of [0, 1] as const) {
    if (bezPecene?.[p] !== true) continue;
    pecen[p] = 0;
    poldeci[p] = 0;
  }
  // Liberál (Pitka, v7): súper, ktorého partia nemá rovnako žien a chlapov, získa 1 zadĺženie.
  const zLinie = zadlzenieZLinie(data, s, vyhodnotenie);
  const liberal = liberalZadlzenie(data, s);
  const zadlzenie: [number, number] = [zLinie[0] + liberal[0], zLinie[1] + liberal[1]];
  return {
    zadlzenie,
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
  /** Kto v tejto Pitke dal NA EX (Stryná) — klient pozná len to, čo vidí. */
  naexDal?: readonly [boolean, boolean],
): readonly [NahladPitkyHraca, NahladPitkyHraca] {
  // Stryná: bez zadaného naexDal sa berie, čo vidno — zúčtované NA EX Pitky a skryté v pohľade.
  const pk = (s as { readonly pitkaStav?: Pick<PitkaStav, "naexPocet" | "skryteNaex"> | null }).pitkaStav;
  const dal = naexDal ?? (pk == null ? undefined : (([0, 1] as const).map((p) => (pk.naexPocet?.[p] ?? 0) + (pk.skryteNaex ?? []).filter((x) => x.hrac === p).length > 0) as [boolean, boolean]));
  const pr = prirastkyPitky(data, s, undefined, dal);
  // Vo Vízii je Pitka už vyhodnotená — karty na stole pečeň a zadĺženie pripísali
  // a nulujú sa až v dokonciPitku. Rátať ich znova hlásilo kliatby, ktoré nevzniknú
  // (playtest 20261021-143600).
  const vyhodnotena = s.vizia !== null;
  const pre = (p: PlayerId): NahladPitkyHraca => {
    const prahPecene = prahCirhozy() + prahCirhozyBonus(s, p);
    const prahD = prahDlhu() + prahDlhuBonus(s, p);
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

/**
 * Karty Absťák v balíčku hráča (v9.1, Michal 2026-10-30) — ruka, doberací aj odhadzovací.
 * Počet je verejný (klient ho má v pohľade, poloha nie): v bitke každá uberie 1 tuhé
 * a rozhoduje remízu v tuhom.
 */
export function verejneAbstaky(s: VerejnyStav, p: PlayerId): number {
  const h = s.hraci[p];
  return "abstaky" in h ? h.abstaky : pocetAbstakov(h);
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
 * volá pri vyhodnotení, klient pre živý odhad nad aktuálnou líniou — všetko,
 * z čoho sa ráta, je od v8.2 verejné (Absťáky sú počítadlo, nie karty v ruke).
 */
export function poskodenieBitky(data: GameData, s: VerejnyStav, sums: readonly [ActionSums, ActionSums]): DamageResult {
  return computeDamage(stranyBitky(data, s, sums));
}

/** Vstupy bitky oboch strán (súčty, bonusy, priazne) — z nich computeDamage ráta poškodenie. */
export function stranyBitky(data: GameData, s: VerejnyStav, sums: readonly [ActionSums, ActionSums]): [BattleSide, BattleSide] {
  const mody = ([0, 1] as const).map((p) => bitkaMody(data, s, p));
  const strana = (p: PlayerId): BattleSide => {
    const opp = opponentOf(p);
    const povera = sums[p].Povera ?? 0;
    // Veriaci (Michal 2026-10-20): Viera navyše rovná sile priazne, nie vyššia
    // hodnota každej Viery — dve Viery s priazňou 2 dávali štít 10.
    const vieraNavyse = priazen(data, s, "VERIACI", p) / KONSTANTY.NASOBOK_PRIAZNE;
    return {
      sums: { ...sums[p], Povera: povera, ...(vieraNavyse > 0 ? { Viera: (sums[p].Viera ?? 0) + vieraNavyse } : {}) },
      cirhozaBonus: cirhozyPriznane(s, opp),
      // Väzeň Vychovávateľka (v9): Petelica navyše = +3 tuhé, Viera ju tlmí ako každé tuhé.
      tuheBonus: mody[p]!.tuheBonus + nastrojeTuhe(s, p, sums[p]).reduce((a, z) => a + z.tuhe, 0) + peteliceVychovavatelky(s, p),
      // Čierna mačka (v8.3, návrh docs/napady/povery.html — otvorené P5): tvoje Povery sa Vierou nerušia.
      poveryBezViery: zvieraPlati(data, s, p, "cierna_macka"),
      abstaky: verejneAbstaky(s, p),
      // Bitkár v5 (Michal 2026-10-24): +1 / +2 / +3 tuhého, nie dvojnásobok.
      priazenBitkara: silaPriazne(data, s, "BITKAR", p),
      // svaty_text (Dedičstvo): hodnota tvojej Viery je vyššia.
      hodnotaViery: hodnotaViery() + (vDedicstve(s, p, "svaty_text") ? KONSTANTY.EFEKT.SVATY_TEXT_VIERA : 0),
    };
  };
  return [strana(0), strana(1)];
}

/** Tuhé navyše z Kšeftu väzňa Vychovávateľky (v9): +3 za každú splnenú hrozbu v tomto kole. */
export function peteliceVychovavatelky(s: Pick<VerejnyStav, "kseftyKola">, p: PlayerId): number {
  return (s.kseftyKola?.petelice?.[p] ?? 0) * KONSTANTY.VYCHOVAVATELKA_TUHE;
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
  /** Zvyšné Povery po vyrušení s Vierou — v8.3 posúvajú silu priazní (krok Povery). */
  readonly zvysnaPovera: number;
}

export function rozpisPoskodenia(data: GameData, s: VerejnyStav, sums: readonly [ActionSums, ActionSums]): readonly [RozpisPoskodenia, RozpisPoskodenia] {
  const strany = stranyBitky(data, s, sums);
  const dmg = computeDamage(strany);
  const rozpis = (p: PlayerId): RozpisPoskodenia => {
    const q = opponentOf(p);
    const ja = strany[p];
    const su = strany[q];
    const mody = bitkaMody(data, s, p);
    const bonusy: PolozkaRozpisu[] = [...mody.tuheZdroje, ...nastrojeTuhe(s, p, sums[p])].map((z) => ({ zdroj: z.zdroj, hodnota: z.tuhe }));
    if (ja.cirhozaBonus > 0) bonusy.push({ zdroj: "cirhoza", hodnota: ja.cirhozaBonus });
    if (ja.priazenBitkara > 0) bonusy.push({ zdroj: "BITKAR", hodnota: ja.priazenBitkara });
    if (peteliceVychovavatelky(s, p) > 0) bonusy.push({ zdroj: "karta:vychovavatelka", hodnota: peteliceVychovavatelky(s, p) });
    const zrazky: PolozkaRozpisu[] = [];
    if (dmg.zvysnaViera[q] > 0) zrazky.push({ zdroj: "Viera", hodnota: dmg.zvysnaViera[q] * su.hodnotaViery });
    if (ja.abstaky > 0) zrazky.push({ zdroj: "abstak", hodnota: ja.abstaky });
    return {
      zAkcii: (ja.sums.Rana ?? 0) + 2 * (ja.sums.Pecka ?? 0) + 3 * (ja.sums.Petelica ?? 0),
      bonusy,
      zrazky,
      hodnotaViery: ja.hodnotaViery,
      zrusenaViera: (ja.sums.Viera ?? 0) - dmg.zvysnaViera[p],
      zrusenaPovera: (ja.sums.Povera ?? 0) - dmg.zvysnaPovera[p],
      poveraIgnorovana: (sums[p].Povera ?? 0) - (ja.sums.Povera ?? 0),
      zvysnaPovera: dmg.zvysnaPovera[p],
    };
  };
  return [rozpis(0), rozpis(1)];
}

/** Prahy, ku ktorým hráč smeruje — Cirhóza (pečeň), Dlh (zadĺženie) a Exekútor (priznané Dlhy). */
export function prahyHraca(
  data: GameData,
  s: VerejnyStav,
  p: PlayerId,
): { readonly cirhoza: number; readonly dlh: number; readonly exekucia: number; readonly priznaneDlhy: number } {
  const priznaneDlhy = s.hraci[p].dlhy;
  return {
    // nealko (Dedičstvo) a Krčma (cieľ kola): prah Cirhózy je vyšší.
    cirhoza: prahCirhozy() + prahCirhozyBonus(s, p),
    dlh: prahDlhu() + prahDlhuBonus(s, p),
    // Exekúcia bez prahu (Michal 2026-10-28): koľko Dlhov a špakov by v bitke zhorelo teraz
    // (pred Robotou); Záhradkár v partii ju obíde.
    exekucia: zahradkarChrani(data, s, p) ? 0 : zhoriPriExekucii(priznaneDlhy),
    priznaneDlhy,
  };
}

/** MANUAL pripomienky efektov kariet v hre pre daný spúšťač. */
function manualEfekty(s: MutState, data: GameData, trigger: string, events: Event[]): void {
  const pripomen = (card: CardInstance, hracEfektu: PlayerId | null): void => {
    const def = defOf(data, card);
    if (jeStarsi(data, def.id)) return;
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
}

// ---------------------------------------------------------------------------
// Setup

export interface SetupOptions {
  /** Počet lokalít v hre — dĺžka hry (DLZKY_HRY); predvolene stredná. */
  readonly lokalit?: number;
  /** Bez Chuti a Absťáku (výučba Prvá hra, v9.1). */
  readonly bezChuti?: boolean;
}

/** Dĺžky hry, na ktoré má sada dosť lokalít. */
export function dostupneDlzky(data: GameData): DlzkaHry[] {
  return ALL_DLZKY.filter((d) => DLZKY_HRY[d] <= data.lokality.length);
}

/** Patrí karta do balíčka Náradie (tag Nástroj), alebo do Občanov (v8.5)? */
export function jeNaradie(data: GameData, karta: CardInstance): boolean {
  return defOf(data, karta).tags.includes("Nástroj");
}

/** Vráti karty naspodok ich balíčka — Nástroj k Náradiu, ostatné k Občanom (v8.5). */
function naspodok(s: MutState, data: GameData, karty: readonly DeepMutable<CardInstance>[]): void {
  for (const k of karty) (jeNaradie(data, k as CardInstance) ? s.naradie : s.obcania).push(k);
}

export function setupGame(data: GameData, seed: number, opts?: SetupOptions): GameState {
  const s: MutState = {
    rng: rngSeed(seed),
    nextUid: 1,
    faza: "volbaCiela",
    kolo: 1,
    utocnik: 0,
    hraci: [freshPlayer(), freshPlayer()] as MutState["hraci"],
    naradie: [],
    obcania: [],
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
    pokusy: [null, null],
    vazni: [],
    posunyMarkerov: [],
    pitkyKola: [],
    zaciatokPitky: null,
    ...(opts?.bezChuti === true ? { bezChuti: true as const } : {}),
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

  // Karty šenku: kópie všetkých kariet okrem lokalít, starešinov, čistých
  // kliatob (tie vznikajú akciami) a štartoviek (Michal 2026-10-18: sú
  // výhradne v štartovacích balíčkoch). v8.5: Nástroje tvoria balíček
  // Náradie, ostatné balíček Občania (Michal 2026-10-30).
  const KLIATBY = new Set(["dlh", "cirhoza", "abstak"]);
  const karty: CardInstance[] = [];
  for (const def of data.cards.values()) {
    if (def.tags.includes("Lokalita") || def.tags.includes("Starešina")) continue;
    if (KLIATBY.has(def.id) || def.id in KONSTANTY.START_RUKA) continue;
    for (let i = 0; i < KONSTANTY.KOPIE_V_SPOLOCNOM_BALICKU; i++) {
      karty.push(novaInstancia(s, data, def.id));
    }
  }
  const [zamiesane, rng2] = rngShuffle(s.rng, karty);
  s.rng = rng2;
  s.naradie = zamiesane.filter((k) => jeNaradie(data, k)) as DeepMutable<CardInstance>[];
  s.obcania = zamiesane.filter((k) => !jeNaradie(data, k)) as DeepMutable<CardInstance>[];

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
 * doberacie balíčky, Náradie a Občanov. Karty dostanú nové uid a variant
 * „defId/ľavý/pravý“ (predvolene 0/0), aby scenár presne vedel, kde sú akcie.
 */
export function setupZRozdania(data: GameData, r: Rozdanie): GameState {
  if (r.lokality.length === 0) throw new Error("Rozdanie nemá žiadnu lokalitu.");
  if (r.rozpis !== undefined && r.rozpis.length < 2) throw new Error("Rozdanie: rozpis úrovní potrebuje aspoň jedno kolo a finále.");
  const kolLokalit = r.rozpis !== undefined ? r.rozpis.length - 1 : r.lokality.length;
  // Výučba Prvá hra Chuť neučí (Michal 2026-10-30) — tá patrí do jej 2. časti.
  const s = structuredClone(setupGame(data, r.seed, { lokalit: kolLokalit, bezChuti: r.bezChuti ?? true })) as MutState;
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
  s.lokalitCelkom = kolLokalit;
  s.lokalityVHre = r.lokality.map((id) => {
    if (!(data.cards.get(id.split("/")[0] ?? "")?.tags ?? []).includes("Lokalita")) throw new Error(`Rozdanie: „${id}“ nie je lokalita.`);
    return karta(id);
  });
  if (r.rozpis === undefined) {
    // Lokality v pevnom poradí — hrá sa bez rozpisu úrovní (ako do v6).
    delete s.rozpis;
  } else {
    // Výučba v7 s rozpisom (Michal 2026-10-27): každé kolo a finále musí mať zo zásoby
    // čo vybrať, inak by sa partia zasekla vo Voľbe cieľa.
    for (const u of new Set(r.rozpis)) {
      const treba = r.rozpis.filter((x) => x === u).length;
      const ma = s.lokalityVHre.filter((k) => urovenLokality(data, k.defId) === u).length;
      if (ma < treba) throw new Error(`Rozdanie: rozpis chce ${treba}× úroveň ${u}, lokalít tej úrovne je ${ma}.`);
    }
    s.rozpis = [...r.rozpis];
  }
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
  // Scenár spred v8.5 má jeden spoločný balíček — rozdelí sa podľa druhu, poradie ostáva.
  if (r.spolocnyBalicek !== undefined) {
    const spolocne = r.spolocnyBalicek.map(karta);
    s.naradie = spolocne.filter((k) => jeNaradie(data, k as CardInstance));
    s.obcania = spolocne.filter((k) => !jeNaradie(data, k as CardInstance));
  }
  if (r.naradie !== undefined) s.naradie = r.naradie.map(karta);
  if (r.obcania !== undefined) s.obcania = r.obcania.map(karta);
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
    case "pitka": {
      if (state.vizia !== null) return viziaNaTahu(state);
      const pk = state.pitkaStav;
      if (pk === null) return null;
      if (pk.reakcia !== null) return pk.reakcia;
      // Pitka naraz: hrajú obaja — naTahu ukáže toho, na koho sa čaká, obrancu skôr.
      const obr = obranca(state);
      return [obr, state.utocnik].find((q) => hraVPitke(pk, q)) ?? null;
    }
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
  // Pitka naraz (Michal 2026-10-27): kým niekto neodpovedá na NA EX, hrajú obaja.
  if (state.faza === "pitka" && state.vizia === null && state.pitkaStav !== null && state.pitkaStav.reakcia === null) {
    return hraVPitke(state.pitkaStav, p);
  }
  return naTahu(state) === p;
}

/**
 * Pitka naraz (Michal 2026-10-27): hráč p ešte hrá svoju časť Pitky — neskončil
 * a nečaká s Bzdochou na súpera. Z verejného stavu, takže to vie aj klient.
 */
export function hraVPitke(pk: Pick<PitkaStav, "hotovy" | "reakcia" | "bzdocha">, p: PlayerId): boolean {
  if (pk.reakcia !== null || pk.hotovy[p]) return false;
  return !cakaSBzdochou(pk, p);
}

/** Majiteľ Bzdochy čaká, kým súper skončí svoju časť Pitky (Michal 2026-10-27). */
export function cakaSBzdochou(pk: Pick<PitkaStav, "hotovy" | "bzdocha">, p: PlayerId): boolean {
  return pk.bzdocha === p && !pk.hotovy[opponentOf(p)];
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
    // aj celý prebytok jedným klikom (roadmapa #9 B, Michal 2026-10-22) a od mocku C · Pečať
    // (Michal 2026-10-30) aj Pohoršenie — Potvrdiť pošle všetky nepotvrdené posuny (rozdelenie.ts).
    const prebytok = state.faza === "bitka" && state.bitkaStav?.krok === "prebytok";
    const pohorsenie = state.faza === "bitka" && state.bitkaStav?.krok === "pohorsenie";
    need(state.faza === "zhromazdenie" || prebytok || pohorsenie, "Celý ťah naraz sa hrá len v Zhromaždení, pri Pohoršení alebo pri Nakladačke.");
    need(!cakaHasic(state), HASIC_NAJPRV);
    need(cmd.kroky.length > 0, "Ťah je prázdny.");
    let st = state;
    const vsetky: Event[] = [];
    for (const k of cmd.kroky) {
      if (prebytok) {
        need(k.type === "prebytok", "Pri Nakladačke smú byť v ťahu len posuny markerov.");
        need(st.faza === "bitka" && st.bitkaStav?.krok === "prebytok" && st.bitkaStav.caka === hracId, "Nakladačka sa minula skôr, než si posunula všetky markery.");
      } else if (pohorsenie) {
        need(k.type === "pohorsenie", "Pri Pohoršení smú byť v ťahu len posuny markerov.");
        need(st.faza === "bitka" && st.bitkaStav?.krok === "pohorsenie" && st.bitkaStav.caka === hracId, "Pohoršenia sa minuli skôr, než si posunul všetky markery.");
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
  need(!cakaHasic(state) || ["hasic", "klebetnica", "dohadzovacka", "senok", "nastroj", "kapybara"].includes(cmd.type) || vTahu, HASIC_NAJPRV);

  switch (cmd.type) {
    case "chooseLocation":
      cmdChooseLocation(s, data, cmd, hracId, events);
      break;
    case "pokus":
      cmdPokus(s, data, cmd, hracId, events);
      break;
    case "bezPokusu":
      cmdBezPokusu(s, data, hracId, events);
      break;
    case "kseftVazna":
      cmdKseftVazna(s, data, cmd, hracId, events);
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
      // Zberný dvor do v7 — príkaz zo starých záznamov ide ako Kšeft lokality.
      cmdKseft(s, data, { uid: s.ciel?.lokalita?.uid ?? -1, kartaUid: cmd.uid }, hracId, events);
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
      cmdVypit(s, hracId, events);
      break;
    case "naex":
      cmdNaex(s, data, cmd, hracId, events);
      break;
    case "skipNaex":
      cmdSkipNaex(s, data, hracId, events);
      break;
    case "smoke":
      cmdSmoke(s, data, cmd, hracId, events);
      break;
    case "uplatok":
      cmdUplatok(s, data, cmd, hracId, events);
      break;
    case "senok":
      cmdSenok(s, data, cmd, hracId, events);
      break;
    case "nastroj":
      cmdNastroj(s, data, cmd, hracId, events);
      break;
    case "kapybara":
      cmdKapybara(s, data, cmd, hracId, events);
      break;
    case "barter":
      cmdBarter(s, data, hracId, events);
      break;
    case "refillPoldeci":
      cmdRefill(s, data, hracId, events);
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
    case "povera":
      cmdPovera(s, data, cmd, hracId, events);
      break;
    case "pohorsenie":
      cmdPohorsenie(s, data, cmd, hracId, events);
      break;
    case "prebytok":
      cmdPrebytok(s, data, cmd, hracId, events);
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
    out.push({ type: "log", text: `Priazeň ${defOf(data, e.karta).name} (${scorecardStarsieho(data, e).nazov}) sily ${sila} dostáva Hráč ${komu + 1}.` });
  }
  return out;
}

/**
 * Pitky v bitke (Michal 2026-10-19): 1 + menší z počtov aktivovaných akcií
 * karty v strede (lokalita, v bitke o staršieho jeho karta) na jej dvoch
 * stranách. Kto aktivuje 3 akcie lokality a súper 1, pijú sa 2 Pitky.
 */
export function pocetPitiek(data: GameData, state: VerejnyStav & { readonly lokalitaOtocena: boolean }): number {
  if (state.ciel?.lokalita == null) return 1;
  const [a, b] = evaluateLine(data, lineState(state)).aktivneStredu;
  return 1 + Math.min(a, b);
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
 * pasovať alebo preskočiť NA EX, hráč na to nemusí klikať. Tretina
 * príkazov playtestu 20261011-183315 boli práve takéto potvrdenia.
 */
function dohrajNevyhnutne(data: GameData, s: MutState, events: Event[]): void {
  for (;;) {
    const prvy = naTahu(s as GameState);
    if (prvy === null) return;
    // Pitka naraz: nevyhnutný ťah môže mať aj ten druhý, čo práve hrá.
    const kandidati = s.faza === "pitka" ? [prvy, opponentOf(prvy)].filter((q) => mozeHrat(s as GameState, q)) : [prvy];
    if (!kandidati.some((q) => nevyhnutnyTah(data, s, q, events))) return;
  }
}

/** Urobí za hráča p jediný možný ťah (pas, koniec Pitky, bez odpovede…); false = má voľbu. */
function nevyhnutnyTah(data: GameData, s: MutState, p: PlayerId, events: Event[]): boolean {
  {
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
    } else if (jedina?.type === "bezReakcie") {
      cmdBezReakcie(s, data, p, events);
    } else if (jedina?.type === "draftStop") {
      if (s.senok.length > 0) events.push({ type: "log", text: `Hráč ${p + 1} nemá cigaretu na kartu zo šenku.` });
      cmdDraftStop(s, data, p, events);
    } else if (jedina?.type === "bezPokusu") {
      const dovod = dovodBezPokusu(data, s as GameState, p);
      if (dovod !== null) events.push({ type: "log", pre: p, text: dovod });
      cmdBezPokusu(s, data, p, events, true);
    } else {
      return false;
    }
    return true;
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
  zacniDraft(s, data, events);
}

/**
 * Veľkosť balíčka stavby šenku (v8.5, Michal 2026-10-30): 2 karty z Náradia
 * a 6 z Občanov, bez ohľadu na počet starších. Pri nedostatku najviac toľko,
 * koľko oba balíčky spolu dajú obom hráčom, nadol na párne číslo — polovica
 * ide do šenku, polovica naspodok.
 */
export function velkostStavby(state: Pick<GameState, "naradie" | "obcania">): number {
  const plna = KONSTANTY.STAVBA_NARADIE + KONSTANTY.STAVBA_OBCANIA;
  const n = Math.min(plna, Math.floor((state.naradie.length + state.obcania.length) / 2));
  return n - (n % 2);
}

/**
 * Vezme z vrchu balíčkov n kariet, z toho `naradia` z Náradia a zvyšok
 * z Občanov; čo jeden balíček nemá, doplní druhý (výklad Leadera 2026-10-30).
 * Nástroje idú prvé — hráč ich má v balíčku stavby zoradené náradie / občania.
 */
function zVrchuBalickov(s: MutState, n: number, naradia: number): DeepMutable<CardInstance>[] {
  let zNaradia = Math.min(naradia, n, s.naradie.length);
  const zObcanov = Math.min(n - zNaradia, s.obcania.length);
  zNaradia = Math.min(n - zObcanov, s.naradie.length);
  return [...s.naradie.splice(0, zNaradia), ...s.obcania.splice(0, zObcanov)];
}

function zacniDraft(s: MutState, data: GameData, events: Event[]): void {
  // Nevzaté karty zo starého šenku idú naspodok svojho balíčka (Náradie / Občania).
  if (s.senok.length > 0) {
    naspodok(s, data, s.senok);
    events.push({ type: "log", text: `Zo šenku ide naspodok Náradia a Občanov ${s.senok.length} nevzatých kariet.` });
    s.senok = [];
  }
  const n = velkostStavby(s as GameState);
  const balicky: [DeepMutable<CardInstance>[], DeepMutable<CardInstance>[]] = [[], []];
  for (const p of [obranca(s), s.utocnik] as const) balicky[p] = zVrchuBalickov(s, n, KONSTANTY.STAVBA_NARADIE);
  s.draftStav = {
    krok: n > 0 ? "stavba" : "beranie",
    balicky,
    vyber: [null, null],
    // Zo šenku berie prvý obranca, útočník druhý (v9.2, Michal 2026-10-30; predtým útočník prvý).
    naTahu: obranca(s),
    hotovo: [false, false],
    noveKarty: [0, 0],
  };
  events.push({
    type: "log",
    text:
      n > 0
        ? `Stavba šenku: každý hráč dostáva ${n} kariet z Náradia a Občanov.`
        : "Náradie aj Občania sú prázdni — šenok sa nestavia.",
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
    naspodok(s, data, vyber[h].odhod.map(vezmi));
  }
  events.push({ type: "log", text: `Do šenku: ${doSenku.join(", ")}.` });
  d.vyber = [null, null];
  if (d.balicky[0].length === 0 && d.balicky[1].length === 0) {
    d.krok = "beranie";
    d.naTahu = obranca(s);
    events.push({
      type: "log",
      text: `Šenok je postavený (${s.senok.length} ${s.senok.length === 1 ? "karta" : s.senok.length >= 2 && s.senok.length <= 4 ? "karty" : "kariet"}). Berie sa striedavo, začína obranca: 1 karta za ${KONSTANTY.CENA_SENKU[1]} cigaretu, 2 karty za ${KONSTANTY.CENA_SENKU[2]} cigarety; obranca na prvom ťahu len 1 kartu.`,
    });
  }
}

/**
 * Najviac kariet, ktoré si hráč p smie vziať na tomto ťahu v braní (v9.2, Michal 2026-10-30):
 * kto berie prvý (obranca), na prvom ťahu len SENOK_PRVY_TAH; inak 1 alebo 2.
 */
export function maxZoSenku(state: { readonly utocnik: PlayerId; readonly draftStav: { readonly noveKarty: readonly [number, number] } | null }, p: PlayerId): number {
  const d = state.draftStav;
  const prvyTah = d !== null && p === obranca(state) && d.noveKarty[p] === 0;
  return prvyTah ? KONSTANTY.SENOK_PRVY_TAH : KONSTANTY.CENA_SENKU.length - 1;
}

/**
 * Koľko kariet si hráč p smie teraz vziať zo šenku (Michal 2026-10-19):
 * 1 karta za cigaretu, 2 karty za 3 cigarety. Prázdne = nemá na to.
 */
export function moznostiZoSenku(state: GameState, p: PlayerId): number[] {
  const d = state.draftStav;
  if (d === null || d.krok !== "beranie" || d.hotovo[p]) return [];
  const out: number[] = [];
  for (let pocet = 1; pocet <= maxZoSenku(state, p); pocet++) {
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
  need(pocet <= maxZoSenku(s as GameState, p), "Kto berie zo šenku prvý, na prvom ťahu vezme len 1 kartu.");
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
  // Šenok sa po braní doplní na 8 (Michal 2026-10-20) — Starosta, Cintorín a iné
  // efekty potom majú z čoho brať. v8.5: v pomere stavby — z Náradia, kým v šenku
  // nie sú aspoň 2 Nástroje, zvyšok z Občanov.
  const chyba = Math.max(0, KONSTANTY.SENOK_PO_BRANI - s.senok.length);
  const naradiaVSenku = Math.round((KONSTANTY.SENOK_PO_BRANI * KONSTANTY.STAVBA_NARADIE) / (KONSTANTY.STAVBA_NARADIE + KONSTANTY.STAVBA_OBCANIA));
  const nastrojov = s.senok.filter((k) => jeNaradie(data, k as CardInstance)).length;
  const doplnene = zVrchuBalickov(s, chyba, Math.max(0, naradiaVSenku - nastrojov));
  if (doplnene.length > 0) {
    s.senok.push(...doplnene);
    events.push({ type: "log", text: `Šenok sa dopĺňa z vrchu Náradia a Občanov na ${s.senok.length} kariet (+${doplnene.length}).` });
  }
  // Pokus o zajatie (v9): rozhoduje útočník, potom obranca — druhý už vidí voľbu prvého.
  // Fajčiar dáva cigarety od v9 po bitke (koniecBitky), nie po šenku.
  d.krok = "zajatie";
  d.naTahu = s.utocnik;
  d.hotovo = [false, false];
}

// ---------------------------------------------------------------------------
// Zajatie a väzeň (v9, Michal 2026-10-30, §10 — nahradilo patronát a vydesenie)

/** Väzni hráča p v poradí zajatia. */
export function vazniHraca(state: { readonly vazni: readonly Vazen[] }, p: PlayerId): Vazen[] {
  return state.vazni.filter((v) => v.hrac === p);
}

/** Je starší práve „v ohrození“ — niekto sa ho v tomto kole pokúša zajať (jeho markerom nič nehýbe)? */
export function vOhrozeni(state: { readonly pokusy: readonly (PokusOZajatie | null)[] }, elderId: string): boolean {
  return state.pokusy.some((x) => x?.elderId === elderId);
}

/** Je karta s týmto uid karta staršieho, o ktorého zajatie sa v tomto kole hrá (boss)? */
// Štruktúrny typ: rovnako sa pýta server (GameState) aj klient agentov (ClientState).
export function jeKartaBossa(
  state: { readonly pokusy: readonly (PokusOZajatie | null)[]; readonly starsi: readonly Pick<ElderState, "elderId" | "karta">[] },
  uid: number,
): boolean {
  return state.pokusy.some((x) => x !== null && state.starsi.find((e) => e.elderId === x.elderId)?.karta.uid === uid);
}

/**
 * Starší, ktorých sa hráč p teraz smie pokúsiť zajať: bojí sa ho na stupni 3, nikto
 * sa ho v tomto kole nepokúša zajať a hráč má cigaretu. Každý hráč najviac jeden pokus za kolo.
 */
export function moznePokusy(state: GameState, p: PlayerId): ElderState[] {
  const d = state.draftStav;
  if (state.faza !== "draft" || d === null || d.krok !== "zajatie" || d.hotovo[p]) return [];
  if (state.pokusy[p] !== null || state.hraci[p].cigarety < KONSTANTY.CENA_POKUSU) return [];
  return state.starsi.filter((e) => pokusMozny(e, p) && !vOhrozeni(state, e.elderId));
}

/** Prečo hra pokus preskočila, hoci sa hráča niektorý starší bojí na stupni 3 (len pre hráča). */
function dovodBezPokusu(data: GameData, state: GameState, p: PlayerId): string | null {
  const starsi = state.starsi.filter((e) => pokusMozny(e, p) && !vOhrozeni(state, e.elderId));
  if (starsi.length === 0 || state.pokusy[p] !== null) return null;
  const kto = starsi.map((e) => defOf(data, e.karta).name).join(", ");
  return `Pokus o zajatie preskočený: na stupni 3 sa ťa bojí ${kto}, ale nemáš cigaretu.`;
}

function cmdPokus(s: MutState, data: GameData, cmd: { elderId: string }, p: PlayerId, events: Event[]): void {
  const d = s.draftStav;
  need(s.faza === "draft" && d !== null && d.krok === "zajatie" && d.naTahu === p && !d.hotovo[p], "Teraz sa o zajatí nerozhoduje.");
  need(s.pokusy[p] === null, "V tomto kole si sa o zajatie už pokúsil.");
  const elder = s.starsi.find((e) => e.elderId === cmd.elderId);
  need(elder !== undefined, "Taký starší na stupnici nie je.");
  need(pokusMozny(elder as ElderState, p), "Zajať sa dá len staršieho, ktorý sa ťa bojí na stupni 3.");
  need(!vOhrozeni(s as GameState, elder.elderId), "O tohto staršieho sa už v tomto kole hrá.");
  need(s.hraci[p].cigarety >= KONSTANTY.CENA_POKUSU, `Pokus o zajatie stojí ${cigariet(KONSTANTY.CENA_POKUSU)}.`);
  const opp = opponentOf(p);
  // Cigareta prepadne do banky bez ohľadu na výsledok; boss ide súperovi do ruky.
  hrac(s, p).cigarety -= KONSTANTY.CENA_POKUSU;
  hrac(s, opp).ruka.push(elder.karta);
  s.pokusy[p] = { elderId: elder.elderId };
  events.push({
    type: "log",
    text: `Pokus o zajatie: hráč ${p + 1} platí ${cigariet(KONSTANTY.CENA_POKUSU)} a ${defOf(data, elder.karta as CardInstance).name} ide hráčovi ${opp + 1} do ruky. Vyhrá hráč ${p + 1} bitku → väzeň; inak sa starší vráti a marker ustúpi o stupeň.`,
  });
  dalsiVZajati(s, data, p, events);
}

function cmdBezPokusu(s: MutState, data: GameData, p: PlayerId, events: Event[], samo = false): void {
  const d = s.draftStav;
  need(s.faza === "draft" && d !== null && d.krok === "zajatie" && d.naTahu === p && !d.hotovo[p], "Teraz sa o zajatí nerozhoduje.");
  if (!samo) events.push({ type: "log", text: `Hráč ${p + 1} sa o zajatie nepokúša.` });
  dalsiVZajati(s, data, p, events);
}

/** Po rozhodnutí útočníka rozhoduje obranca; potom začína Zhromaždenie. */
function dalsiVZajati(s: MutState, data: GameData, p: PlayerId, events: Event[]): void {
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
 * Vytiahne kartu s uid odkiaľkoľvek (ruka, balíčky, priznané, Dedičstvo, línia) —
 * boss sa po bitke vracia vždy, aj keby ho efekt poslal do balíčka (v9). Nenájdená = nič.
 */
function vytiahniKartu(s: MutState, uid: number): void {
  for (const q of [0, 1] as const) {
    const h = hrac(s, q);
    for (const kopa of [h.ruka, h.doberaci, h.odhadzovaci, h.priznane, h.dedicstvo]) {
      const i = kopa.findIndex((k) => k.uid === uid);
      if (i !== -1) {
        kopa.splice(i, 1);
        return;
      }
    }
  }
  const kde = najdiVLinii(s, uid);
  if (kde !== null) s.strany[kde.strana].splice(kde.index, 1);
}

/**
 * Výsledok pokusov o zajatie (v9, krok 6d): kto vyhral bitku, zajme — starší ide medzi jeho
 * priznané karty ako väzeň a zo stupnice zmizne (udržaný strach mu ešte zaplatí); kto
 * prehral alebo pri sekere, starší sa vráti na ukazovateľ a marker ustúpi o stupeň k stredu
 * (ústup zmaže nezaplatený stupeň, O9). Tretí väzeň jedného hráča končí hru. Volá sa pred
 * návratom kariet z línie.
 */
function vyriesZajatie(s: MutState, data: GameData, vitaz: PlayerId | null, events: Event[]): void {
  const poradieStarsich = [...data.elders.keys()];
  for (const p of [s.utocnik, obranca(s)] as const) {
    const pokus = s.pokusy[p];
    if (pokus === null) continue;
    const elder = s.starsi.find((e) => e.elderId === pokus.elderId);
    if (elder === undefined) continue;
    const meno = defOf(data, elder.karta as CardInstance).name;
    vytiahniKartu(s, elder.karta.uid);
    if (vitaz === p) {
      // Udržaný strach z tohto kola sa platí normálne (O8) — väzeň už potom nič nedá.
      const strach = strachNaVyplatu(elder as ElderState, p);
      if (strach > 0) {
        s.spaky[p] += strach;
        const zaznam = s.nastenka[s.nastenka.length - 1];
        if (zaznam !== undefined) {
          zaznam.zaStarsich[p] += strach;
          const rozpis = zaznam.zaStarsichRozpis ?? [[], []];
          rozpis[p] = [...rozpis[p], { elderId: elder.elderId, defId: elder.karta.defId, spaky: strach }];
          zaznam.zaStarsichRozpis = rozpis;
          zaznam.spakyPo = [s.spaky[0], s.spaky[1]];
        }
        events.push({ type: "log", text: `Udržaný strach: ${meno} ešte platí hráčovi ${p + 1} ${spakov(strach)}.` });
      }
      const vazen: Vazen = {
        elderId: elder.elderId,
        hrac: p,
        poradie: s.vazni.length + 1,
        karta: elder.karta as CardInstance,
        scorecard: elder.scorecard,
        miesto: Math.max(0, poradieStarsich.indexOf(elder.elderId)),
      };
      s.vazni.push(vazen as DeepMutable<Vazen>);
      s.starsi = s.starsi.filter((e) => e.elderId !== elder.elderId);
      const hodnota = KONSTANTY.SPAKY_ZA_VAZNOV[vazen.poradie - 1] ?? 0;
      events.push({
        type: "log",
        text: `Zajatie: hráč ${p + 1} ${rodovo(p, "vyhral", "vyhrala", "vyhráva")} bitku — ${meno} je jeho väzeň (${vazen.poradie}. zajatý v partii, po finále ${spakov(hodnota)}). Priazeň zaniká, na ukazovateli ostáva prázdne miesto.`,
      });
    } else {
      const na = (elder.marker < MARKER_STRED ? elder.marker + 1 : elder.marker - 1) as MarkerPos;
      presunMarker(s, events, elder, na, "zajatie", p);
      events.push({
        type: "log",
        text: `Zajatie zlyhalo: hráč ${p + 1} bitku ${vitaz === null ? "nevyhral (sekera)" : rodovo(p, "prehral", "prehrala", "prehráva")} — ${meno} sa vracia na ukazovateľ a marker ustupuje o stupeň; cigareta prepadla.`,
      });
    }
  }
  s.pokusy = [null, null];
  for (const p of [0, 1] as const) {
    const vazni = vazniHraca(s as GameState, p).length;
    if (vazni >= KONSTANTY.VAZNI_NA_VYHRU) {
      ukonciHru(s, data, p, `Hráč ${p + 1} ${rodovo(p, "zajal", "zajala", "zajíma")} tretieho staršieho.`, events);
      return;
    }
  }
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
  // Limit sa počíta nanovo na začiatku každého Zhromaždenia (PRAVIDLA §6); vinko pridáva poldeci navyše.
  s.zhromazdenieStav = {
    naTahu: zacina,
    zostavaLimit: [limitZhromazdenia(s as GameState, 0), limitZhromazdenia(s as GameState, 1)],
    pasoval: [false, false],
    navyse: [0, 0],
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
    need(def.id !== "abstak", "Absťák sa nedá priznať — po bitke ide z ruky do odhadzovacieho balíčka.");
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
    const bonusPred = limitBonusDedicstva(s.hraci[p].dedicstvo);
    hrac(s, p).dedicstvo.push(karta as DeepMutable<CardInstance>);
    pridajLimit(z, p, limitBonusDedicstva(s.hraci[p].dedicstvo) - bonusPred);
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
    delete (placed as { zaverecna?: true }).zaverecna;
    const def = defOf(data, placed.card);
    events.push({ type: "log", text: `Záverečná hráča ${p + 1} sa otáča: ${def.name}.` });
    const odEfektov = events.length;
    if (def.triggers.includes("Nástup")) nastupEfekt(s, data, def.id, p, strana, events);
    // Konflikt, ktorý Záverečná vyvolala priložením, sa odložil na jej otočenie (plan.md 13.2 bod 10).
    const sused = susedPrilozenej(s, strana);
    if (sused !== null) konflikt(s, data, sused, placed as DeepMutable<PlacedCard>, events);
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
  /** Odpoveď na NA EX (v9.2): lícom dole ako Záverečná, otočí sa s odpoveďou súpera. */
  odpoved = false,
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
  const sused = susedNaKonci(s.strany, cielPartia);
  need(sused?.zaverecna !== true, "Za Záverečnú sa nedá priložiť, kým sa na konci Pitky neotočí.");
  need(sused?.posledna !== true, "Za túto kartu sa už nepriloží — Hrobár ju urobil poslednou na strane.");
  if (def.tags.includes("Nástroj") && sused != null) {
    need(
      !defOf(data, sused.card as CardInstance).tags.includes("Nástroj"),
      "Nástroj nesmie susediť s Nástrojom.",
    );
  }
  const karta = vezmiZRuky(s, p, uid);
  // Pasca (v7): súper priložil kartu k tvojej — ráta sa každé priloženie, aj lícom dole.
  if (sused != null && sused.playedBy !== p) {
    const n: [number, number] = [s.prilozeniaKu?.[0] ?? 0, s.prilozeniaKu?.[1] ?? 0];
    n[sused.playedBy] += 1;
    s.prilozeniaKu = n;
  }
  if (odpoved) {
    partia.push({ card: karta, playedBy: p, zaverecna: true, odpoved: true } as DeepMutable<PlacedCard>);
    events.push({ type: "log", text: `Hráč ${p + 1} odpovedá na NA EX lícom dole na koniec ${target === "vlastna" ? "svojej" : "súperovej"} strany.` });
    return;
  }
  if (zaverecna) {
    partia.push({ card: karta, playedBy: p, zaverecna: true } as DeepMutable<PlacedCard>);
    // Meno karty sa v logu objaví až pri otočení.
    events.push({ type: "log", text: `Hráč ${p + 1} hrá Záverečnú lícom dole do ${target === "vlastna" ? "svojej" : "súperovej"} partie.` });
    return;
  }
  const nova = { card: karta, playedBy: p } as DeepMutable<PlacedCard>;
  partia.push(nova);
  events.push({
    type: "log",
    text: `Hráč ${p + 1} vykladá ${def.name} do ${target === "vlastna" ? "svojej" : "súperovej"} partie.`,
  });
  if (def.triggers.includes("Nástup")) {
    nastupEfekt(s, data, def.id, p, cielPartia, events);
  }
  // Konflikt (v7, plan.md 13): najprv Nástup priloženej karty, potom Konflikt ležiacej.
  if (sused != null) konflikt(s, data, sused as DeepMutable<PlacedCard>, nova, events);
}

/** Karta, ku ktorej sa priložila posledná karta strany `strana`. */
function susedPrilozenej(s: MutState, strana: PlayerId): DeepMutable<PlacedCard> | null {
  const partia = s.strany[strana];
  return partia.length >= 2 ? (partia[partia.length - 2] ?? null) : null;
}

/** Vyvolá ležiaca karta Konflikt, keď sa k nej priloží `prilozena`? (plan.md 13.1) */
export function vyvolaKonflikt(data: GameData, lezi: PlacedCard, prilozena: Pick<PlacedCard, "card" | "playedBy">): boolean {
  if (lezi.zaverecna === true || lezi.playedBy === prilozena.playedBy) return false;
  // Starší má v línii len akcie (v9) — jeho efekt je Kšeft väzňa.
  if (!defOf(data, lezi.card).triggers.includes("Konflikt") || jeStarsi(data, lezi.card.defId)) return false;
  // Priložený Nástroj Konflikt nevyvolá.
  return !defOf(data, prilozena.card).tags.includes("Nástroj");
}

/**
 * Stôl po priložení karty `karta` hráča `kto` na koniec strany `strana` — pre
 * náhľady a bota (v7): to, čo z Konfliktu a Nástupu Miňištranta mení bitku,
 * ako vylozDoLinie. Policajtkin Dlh ide medzi priznané s náhradným uid,
 * cigarety za Kriminála ani Nástupy s voľbou náhľad nepredvída.
 */
export function sPrilozenou<T extends VerejnyStav & { readonly lokalitaOtocena: boolean }>(data: GameData, s: T, strana: PlayerId, karta: CardInstance, kto: PlayerId): T {
  const sused = susedNaKonci(s.strany, strana);
  let nova: PlacedCard = { card: karta, playedBy: kto };
  const konfl = sused !== null && vyvolaKonflikt(data, sused, nova) && !efektPotlaceny(data, s, sused.playedBy, sused.card.defId);
  if (karta.defId === "ministrant" && sused !== null && vyvolaKonflikt(data, sused, nova)) nova = { ...nova, premena: "ministrant" };
  let lezi = sused;
  let hraci = s.hraci;
  if (konfl && sused !== null) {
    const jeho = defOf(data, karta).tags;
    switch (sused.card.defId) {
      case "sarlatan":
        lezi = { ...sused, premena: "sarlatan" };
        break;
      case "policajtka":
        if (!jeho.includes("Kriminál")) {
          hraci = (kto === 0 ? [{ ...s.hraci[0], dlhy: s.hraci[0].dlhy + 1 }, s.hraci[1]] : [s.hraci[0], { ...s.hraci[1], dlhy: s.hraci[1].dlhy + 1 }]) as unknown as T["hraci"];
        }
        break;
      case "velmi_smutiaca_vdova":
        if (jeho.includes("Chlap")) nova = { ...nova, poBitkeZHry: true };
        break;
      case "snubenica":
        if (jeho.includes("Chlap")) nova = { ...nova, poBitkeK: sused.playedBy };
        break;
    }
  }
  const zamen = (pl: PlacedCard): PlacedCard => (pl === sused && lezi !== null ? lezi : pl);
  let strany = ([0, 1] as const).map((q) => [...s.strany[q].map(zamen), ...(q === strana ? [nova] : [])]) as unknown as T["strany"];
  // Dohadzovačka (Nástup): presun najvzdialenejšieho Občana opačného pohlavia za ňu.
  if (karta.defId === "dohadzovacka" && defOf(data, karta).triggers.includes("Nástup") && !efektPotlaceny(data, s, kto, "dohadzovacka")) {
    strany = presunDohadzovackou(data, strany, strana, karta.uid).strany;
  }
  const prilozeniaKu: [number, number] = [s.prilozeniaKu?.[0] ?? 0, s.prilozeniaKu?.[1] ?? 0];
  if (sused !== null && sused.playedBy !== kto) prilozeniaKu[sused.playedBy] += 1;
  return { ...s, strany, hraci, prilozeniaKu };
}

/**
 * Konflikt (v7, plan.md 13.1): efekt ležiacej karty, keď k nej súper priloží
 * svoju — aj odpoveďou na NA EX; Záverečná až pri otočení. NA EX ani zrážka
 * ho nespúšťajú. Vdova, Policajtka, Šarlatán, Snúbenica, Hrobár.
 */
function konflikt(s: MutState, data: GameData, lezi: DeepMutable<PlacedCard>, prilozena: DeepMutable<PlacedCard>, events: Event[]): void {
  if (!vyvolaKonflikt(data, lezi as PlacedCard, prilozena as PlacedCard)) return;
  const p = lezi.playedBy as PlayerId;
  const opp = opponentOf(p);
  const def = defOf(data, lezi.card as CardInstance);
  if (efektPotlaceny(data, s as GameState, p, def.id)) {
    events.push({ type: "log", text: `Praudovravec: Konflikt karty ${def.name} sa neuplatní.` });
    return;
  }
  const jeho = defOf(data, prilozena.card as CardInstance);
  switch (def.id) {
    case "velmi_smutiaca_vdova":
      if (!jeho.tags.includes("Chlap")) break;
      prilozena.poBitkeZHry = true;
      events.push({ type: "log", text: `Konflikt — Veľmi smútiaca vdova: ${jeho.name} hráča ${opp + 1} ide po bitke z hry.` });
      break;
    case "policajtka":
      if (jeho.tags.includes("Kriminál")) {
        const n = Math.min(KONSTANTY.EFEKT.POLICAJTKA_CIGARETY, s.hraci[opp].cigarety);
        hrac(s, opp).cigarety -= n;
        hrac(s, p).cigarety += n;
        events.push({ type: "log", text: `Konflikt — Policajtka: ${jeho.name} je Kriminál, hráč ${opp + 1} dáva hráčovi ${p + 1} ${cigariet(n)}.` });
      } else {
        events.push({ type: "log", text: `Konflikt — Policajtka: pokuta na mieste, hráč ${opp + 1} získava Dlh.` });
        pridajDlh(s, opp, events);
      }
      break;
    case "sarlatan":
      lezi.premena = "sarlatan";
      events.push({ type: "log", text: `Konflikt — Šarlatán hráča ${p + 1}: do konca kola sa jeho akcie Hazard rátajú ako Viera a Povery ako Rana.` });
      break;
    case "snubenica":
      if (!jeho.tags.includes("Chlap")) break;
      prilozena.poBitkeK = p;
      events.push({ type: "log", text: `Konflikt — Snúbenica: ${jeho.name} ide po bitke do odhadzovacieho balíčka hráča ${p + 1} a je jeho.` });
      break;
    default:
      events.push({ type: "manualEfekt", defId: def.id, nazov: def.name, text: def.effectText, hrac: p });
  }
}

/**
 * Karta, ku ktorej sa priloží ďalšia karta na koniec strany `strana`; pri
 * prázdnej strane null (prikladá sa k lokalite).
 */
export function susedNaKonci(strany: readonly [readonly PlacedCard[], readonly PlacedCard[]], strana: PlayerId): PlacedCard | null {
  return strany[strana].at(-1) ?? null;
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
  // Starší má v línii len akcie (v9) — Nástup nemá.
  if (def === undefined || jeStarsi(data, defId)) return;
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
    case "dohadzovacka": {
      const d = s.strany[strana].at(-1);
      if (d === undefined || d.card.defId !== "dohadzovacka") break;
      const { strany, presunuta } = presunDohadzovackou(data, s.strany as GameState["strany"], strana, d.card.uid);
      if (presunuta === null) break;
      s.strany = strany as MutState["strany"];
      events.push({
        type: "log",
        text: `Dohadzovačka: ${defOf(data, presunuta.card).name} (${presunuta.playedBy === p ? `hráča ${p + 1}` : `hráča ${opp + 1}`}) sa presúva z druhej strany lokality za Dohadzovačku.`,
      });
      break;
    }
    case "zivnostnik": {
      // v7: v tom istom ťahu smie za neho priložiť Nástroj z ruky — mimo limitu.
      if (!s.hraci[p].ruka.some((k) => defOf(data, k as CardInstance).tags.includes("Nástroj"))) break;
      s.hasicVolby = [...(s.hasicVolby ?? []), { hrac: p, typ: "nastroj", uid: 0, potom: null, strana }];
      events.push({ type: "log", text: `Živnostník: hráč ${p + 1} smie za neho priložiť Nástroj z ruky.` });
      break;
    }
    case "kapybara": {
      // Mäsiar (Furt, Michal 2026-10-28): Kapybara priložená k nemu sa nespustí.
      const k = s.strany[strana].at(-1);
      if (k !== undefined && zvieratAUmlcane(data, { lokalita: s.ciel?.lokalita ?? null, strany: s.strany as GameState["strany"] }).has(k.card.uid)) {
        events.push({ type: "log", text: "Mäsiar: Kapybara vedľa neho nič nespraví." });
        break;
      }
      if (!s.starsi.some((e) => e.marker !== MARKER_STRED)) {
        events.push({ type: "log", text: "Kapybara: všetky markery sú v strede — nič sa nestane." });
        break;
      }
      s.hasicVolby = [...(s.hasicVolby ?? []), { hrac: p, typ: "kapybara", uid: 0, potom: null }];
      events.push({ type: "log", text: `Kapybara: hráč ${p + 1} posunie marker jedného staršieho o 1 pole k stredu.` });
      break;
    }
    case "anonymny_alkoholik": {
      const cirhozy = s.hraci[p].odhadzovaci.filter((k) => k.defId === "cirhoza");
      if (cirhozy.length === 0) break;
      hrac(s, p).odhadzovaci = s.hraci[p].odhadzovaci.filter((k) => k.defId !== "cirhoza") as DeepMutable<CardInstance>[];
      hrac(s, p).priznane.push(...(cirhozy as DeepMutable<CardInstance>[]));
      events.push({ type: "log", text: `Anonymný alkoholik: hráč ${p + 1} priznáva ${pocet(cirhozy.length, "Cirhózu", "Cirhózy", "Cirhóz")} z odhadzovacieho balíčka.` });
      break;
    }
    case "ministrant": {
      // Podmienka „vyvoláš Konflikt“ je známa už pri priložení (plan.md 14.3).
      const sused = susedPrilozenej(s, strana);
      const ja = s.strany[strana][s.strany[strana].length - 1];
      if (sused === null || ja === undefined || !vyvolaKonflikt(data, sused as PlacedCard, ja as PlacedCard)) break;
      ja.premena = "ministrant";
      events.push({ type: "log", text: `Miňištrant hráča ${p + 1} vyvolal Konflikt — do konca kola sa jeho Viera ráta ako Pecka.` });
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
    default:
      break;
  }
}

/**
 * Vínko vyložené do Dedičstva v Zhromaždení (návrh #26 B, Michal 2026-10-28):
 * zostávajúci limit stúpne hneď, ako keby bol v limite od začiatku Zhromaždenia.
 */
function pridajLimit(z: DeepMutable<ZhromazdenieStav>, p: PlayerId, n: number): void {
  z.zostavaLimit[p] += n;
}

function uberLimit(z: DeepMutable<ZhromazdenieStav>, p: PlayerId, n: number): void {
  z.zostavaLimit[p] = Math.max(0, z.zostavaLimit[p] - n);
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
  const ziska = cigaretyZaPas(data, s as GameState, p, s.hraci[p].ruka.length);
  const pistalka = karty * KONSTANTY.CIGARETY_ZA_PAS_NA_KARTU - ziska;
  if (pistalka > 0) events.push({ type: "log", text: `Píšťalka: súperove Obmedzenia uberajú hráčovi ${p + 1} ${cigariet(pistalka)} za pas.` });
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
function cmdVypit(s: MutState, p: PlayerId, events: Event[]): void {
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
  // Bzdocha (Michal 2026-10-27): jej majiteľ hrá Pitku až po súperovi; keď ju majú obaja, nečaká nikto.
  const sBzdochou = ([0, 1] as const).filter((q) => maEfekt(s, data, q, "klebetnica"));
  const bzdocha = sBzdochou.length === 1 ? (sBzdochou[0] as PlayerId) : null;
  s.pitkaStav = {
    naTahu: bzdocha === obranca(s) ? s.utocnik : obranca(s),
    bzdocha,
    hotovy: [false, false],
    naexPouzity: [false, false],
    fajcenie: [0, 0],
    reakcia: null,
    postarka: [false, false],
    starosta: [false, false],
    naexPocet: [0, 0],
    vykup: [false, false],
  };
  if (bzdocha !== null) events.push({ type: "log", text: `Bzdocha: hráč ${bzdocha + 1} hrá Pitku až po súperovi a uvidí jeho NA EX.` });
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
  need(pitka.zakazNaex?.[p] !== true, "Krčmárka: v tejto Pitke NA EX nedáš.");
  const moje = skryteHraca(pitka, p);
  // Skrytú Záverečnú súper cieli náhradným uid (uidZaverecnej) — skutočné nepozná.
  const skryta = skryteZaverecne(s as GameState).find((x) => uidZaverecnej(x.strana) === cmd.uid);
  const uidCiela = skryta === undefined ? cmd.uid : skryta.placed.card.uid;
  need(
    !naexLimitMinuty(data, s as GameState, p),
    naexZaPitku(s as GameState) > 1 ? "NA EX smieš dať najviac dvakrát za Pitku." : "NA EX smieš dať najviac raz za Pitku.",
  );
  need(s.hraci[p].poldeciPlne - moje.length > 0, "Nemáš plný poldeci.");
  const kde = najdiVLinii(s, uidCiela);
  need(kde !== null, "Karta neleží v žiadnej partii.");
  const oltar = stranaOltara(lineState(s as GameState));
  need(oltar === null || kde.strana === oltar, "Kostol: NA EX smie len na kartu v kraji pri oltári.");
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
      def.tags.includes("Občan") || def.tags.includes("Starešina") || (naexNaZviera(s as GameState, p) && def.tags.includes("Zviera")),
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
 * Odkrytie NA EX naraz (v9.2, Michal 2026-10-30): keď obaja skončia svoju časť Pitky,
 * všetky NA EX sa odkryjú naraz — poldeci ľahnú na karty, potom pečeň (pije ten,
 * kto NA EX dal) a hrozba Kšeftu Vychovávateľky (v9). Výsledok od poradia nezávisí;
 * vnútorne ide obranca prvý len preto, aby pri zrážke niesol naexBy (Výtržník).
 * Potom odpovede (zacniKoloOdpovedi). Vracia true, keď sa čaká na odpoveď.
 */
function odhalNaex(s: MutState, data: GameData, events: Event[]): boolean {
  const pitka = s.pitkaStav;
  if (pitka === null) return false;
  const skryte = pitka.skryteNaex ?? [];
  pitka.skryteNaex = [];
  if (skryte.length === 0) return false;
  const obr = obranca(s);
  const pocty: [number, number] = [0, 0];
  const odkryte: string[] = [];
  const zrazky: string[] = [];
  const pije: PlayerId[] = [];
  for (const p of [obr, s.utocnik] as const) {
    for (const x of skryte.filter((y) => y.hrac === p)) {
      const kde = najdiVLinii(s, x.uid);
      if (kde === null) continue;
      const placed = s.strany[kde.strana][kde.index] as DeepMutable<PlacedCard>;
      const zrazka = placed.naexBy === opponentOf(p);
      if (zrazka) {
        placed.naexBy2 = p;
        placed.vytrznik = true;
      } else placed.naexBy = p;
      hrac(s, p).poldeciPlne = Math.max(0, s.hraci[p].poldeciPlne - 1);
      s.naexVKole[p] = true;
      pocty[p] += 1;
      pije.push(p);
      const meno =
        placed.zaverecna === true
          ? "súperovu Záverečnú (lícom dole)"
          : `${placed.playedBy === p ? "svoju" : "súperovu"} kartu ${defOf(data, placed.card as CardInstance).name}`;
      odkryte.push(`hráč ${p + 1} na ${meno}`);
      if (zrazka) {
        zrazky.push(`Zrážka NA EX: obaja dali poldeci na tú istú kartu — je z nej Výtržník, všetky jej akcie sú Rany pre hráča ${placed.playedBy + 1}.`);
      }
    }
  }
  if (odkryte.length > 0) events.push({ type: "log", text: `NA EX sa odkrývajú naraz: ${odkryte.join("; ")}.` });
  for (const text of zrazky) events.push({ type: "log", text });
  // Pečeň z NA EX — poldeci pije ten, kto NA EX dal (PRAVIDLA §7); na Kare jeho súper (v7).
  for (const p of pije) {
    if (naexPecenSuperovi(s as GameState)) {
      events.push({ type: "log", text: `Kar: pečeň za NA EX hráča ${p + 1} dostáva hráč ${opponentOf(p) + 1}.` });
      pridajPecen(s, data, opponentOf(p), 1, events);
    } else pridajPecen(s, data, p, 1, events);
  }
  pitka.naexPocet = [(pitka.naexPocet?.[0] ?? 0) + pocty[0], (pitka.naexPocet?.[1] ?? 0) + pocty[1]];
  for (const p of [0, 1] as const) pitka.naexPouzity[p] = pitka.naexPouzity[p] || pocty[p] >= naexZaPitku(s as GameState);
  // Väzeň Vychovávateľka (v9): súperovo NA EX v tejto Pitke → držiteľ má v bitke Petelicu za každý Kšeft.
  for (const p of [0, 1] as const) {
    const hrozby = pitka.hrozbaPetelice?.[p] ?? 0;
    if (hrozby <= 0 || pocty[opponentOf(p)] === 0) continue;
    const petelice: [number, number] = [s.kseftyKola?.petelice?.[0] ?? 0, s.kseftyKola?.petelice?.[1] ?? 0];
    petelice[p] += hrozby;
    s.kseftyKola = { ...(s.kseftyKola ?? {}), petelice };
    events.push({ type: "log", text: `Vychovávateľka: hráč ${opponentOf(p) + 1} dal NA EX — hráč ${p + 1} má v bitke Petelicu navyše (+${hrozby * KONSTANTY.VYCHOVAVATELKA_TUHE} tuhé).` });
  }
  // Za každé súperovo NA EX jedna odpoveď. Kohút (posledné slovo) je od v9.2 vyradený.
  // TODO Kohút (Michal 2026-10-30): karta sa prerobí — dovtedy nemá účinok.
  pitka.odpovedeZostava = [pocty[1], pocty[0]];
  return zacniKoloOdpovedi(s, data, events);
}

/**
 * Kolo odpovedí (v9.2, Michal 2026-10-30): najprv útočník vyloží odpoveď lícom dole,
 * potom obranca — na druhý kraj línie, ak útočník odpovedal (inak na ktorýkoľvek).
 * Pri viacerých NA EX ide po kolách: v kole najviac jedna odpoveď každého, kolo sa
 * otočí a ďalšie začne (výklad 2026-10-30 — za lícom dole položenou kartou sa nedá priložiť).
 */
function zacniKoloOdpovedi(s: MutState, data: GameData, events: Event[]): boolean {
  const pitka = s.pitkaStav;
  if (pitka === null) return false;
  const zostava = pitka.odpovedeZostava ?? [0, 0];
  pitka.krajOdpovede = null;
  pitka.frontaReakcii = [s.utocnik, obranca(s)].filter((q) => zostava[q] > 0);
  return dalsiaReakcia(s, data, events);
}

/** Ďalší v kole odpovedí, ktorý má čím odpovedať; false = kolo skončilo. Kto nemá čím, už neodpovedá. */
function dalsiaReakcia(s: MutState, data: GameData, events: Event[]): boolean {
  const pitka = s.pitkaStav;
  if (pitka === null) return false;
  const fronta = [...(pitka.frontaReakcii ?? [])];
  while (fronta.length > 0) {
    const q = fronta.shift() as PlayerId;
    if (!mozeReagovat(s as GameState, data, q)) {
      const zostava: [number, number] = [pitka.odpovedeZostava?.[0] ?? 0, pitka.odpovedeZostava?.[1] ?? 0];
      zostava[q] = 0;
      pitka.odpovedeZostava = zostava;
      continue;
    }
    pitka.frontaReakcii = fronta;
    pitka.reakcia = q;
    pitka.naTahu = q;
    const kraj = pitka.krajOdpovede ?? null;
    events.push({
      type: "log",
      text: `Hráč ${q + 1} smie na NA EX odpovedať jednou kartou lícom dole${kraj === null ? "" : ` — len na koniec strany hráča ${opponentOf(kraj) + 1} (druhý kraj línie)`}.`,
    });
    return true;
  }
  pitka.frontaReakcii = [];
  pitka.reakcia = null;
  return false;
}

/**
 * Po kole odpovedí (v9.2): odpovede lícom dole sa otočia naraz, potom ďalšie kolo,
 * alebo sa Pitka vyhodnotí. Otočený Hasič (Nástup) počká na voľbu.
 */
function poKoleOdpovedi(s: MutState, data: GameData, events: Event[]): void {
  if (otocOdpovede(s, data, events)) return;
  const zostava = s.pitkaStav?.odpovedeZostava ?? [0, 0];
  if ((zostava[0] > 0 || zostava[1] > 0) && zacniKoloOdpovedi(s, data, events)) return;
  vyhodnotPitku(s, data, events);
}

/**
 * Otočenie odpovedí lícom dole (v9.2): naraz, pred vyhodnotením Pitky — Nástup,
 * Konflikt, ktorý odpoveď vyvolala priložením, prevaha v kraji a počet Pitiek.
 * Vráti true, keď otočený Hasič čaká na voľbu (zvyšok dobehne dokonciPoVolbe).
 */
function otocOdpovede(s: MutState, data: GameData, events: Event[]): boolean {
  const skryte = ([0, 1] as const).flatMap((strana) => s.strany[strana].filter((pl) => pl.odpoved === true).map((placed) => ({ strana, placed })));
  if (skryte.length === 0) return false;
  const bezSkrytych = s.strany.map((strana) => strana.filter((pl) => pl.odpoved !== true)) as unknown as GameState["strany"];
  const prevahaPred = prevahaStran(data, bezSkrytych);
  events.push({
    type: "log",
    text: `Odpovede sa otáčajú naraz: ${skryte.map(({ strana, placed }) => `hráč ${placed.playedBy + 1} ${defOf(data, placed.card as CardInstance).name} (koniec strany hráča ${strana + 1})`).join("; ")}.`,
  });
  let cakaNaHasica = false;
  for (const { strana, placed } of skryte) {
    const p = placed.playedBy as PlayerId;
    delete (placed as { zaverecna?: true }).zaverecna;
    delete (placed as { odpoved?: true }).odpoved;
    const def = defOf(data, placed.card as CardInstance);
    events.push({ type: "odpovedNaNaex", hrac: p, uid: placed.card.uid, defId: def.id, ciel: strana === p ? "vlastna" : "superova" });
    if (def.triggers.includes("Nástup")) nastupEfekt(s, data, def.id, p, strana, events);
    const sused = susedPrilozenej(s, strana);
    if (sused !== null) konflikt(s, data, sused, placed as DeepMutable<PlacedCard>, events);
    if (odlozPoHasicovi(s, "odpovede")) {
      cakaNaHasica = true;
      break;
    }
  }
  // Odpoveď smie zmeniť prevahu v kraji aj počet Pitiek (b22d4d6) — hráč to musí vidieť (názor #27).
  const prevahaPo = prevahaStran(data, s.strany);
  const kraje = krajeStran(data, s.ciel?.lokalita ?? null, s.lokalitaOtocena);
  for (const strana of [0, 1] as const) {
    const kto = prevahaPo[strana];
    if (kto === prevahaPred[strana]) continue;
    const kraj = kraje[strana] === null ? `pri strane hráča ${strana + 1}` : `v kraji ${kraje[strana]}`;
    events.push({ type: "log", text: `Odpoveď na NA EX: prevahu ${kraj} má teraz ${kto === null ? "nikto" : `hráč ${kto + 1}`}.` });
  }
  const pitkyPred = s.pitkyCelkom;
  aktualizujPitky(s, data);
  if (s.pitkyCelkom !== pitkyPred) {
    events.push({ type: "log", text: `Odpoveď na NA EX: Pitiek v kole je ${s.pitkyCelkom} namiesto ${pitkyPred}.` });
  }
  return cakaNaHasica;
}

/**
 * NA EX hráča p — Občania a Starešinovia v línii (vlastní aj súperovi) bez
 * poldeci. Po minutom limite žiadne (v7 bez výnimky pre Anonymného alkoholika).
 */
export function moznostiNaex(data: GameData, state: GameState, p: PlayerId): number[] {
  const pitka = state.pitkaStav;
  if (pitka === null || pitka.reakcia !== null || pitka.hotovy[p] || pitka.zakazNaex?.[p] === true) return [];
  // NA EX naraz (v5): vlastné skryté NA EX sa rátajú do limitu, poldeci aj cieľov.
  const moje = skryteHraca(pitka, p);
  if (state.hraci[p].poldeciPlne - moje.length <= 0) return [];
  const minuty = naexLimitMinuty(data, state, p);
  // Súperova skrytá Záverečná má náhradné uid — porovnáva sa skutočná karta.
  const skutocne = (uid: number): number => skryteZaverecne(state).find((x) => uidZaverecnej(x.strana) === uid)?.placed.card.uid ?? uid;
  return naexCieleVLinii(data, lineState(state), p, naexNaZviera(state, p)).filter(
    (uid) => !moje.some((x) => x.uid === skutocne(uid)) && !minuty,
  );
}

/** Čo treba na posúdenie limitu NA EX za Pitku — GameState aj pohľad klienta. */
type StavLimituNaex = VerejnyStav & { readonly pitkaStav: Pick<PitkaStav, "naexPouzity" | "skryteNaex"> | null };

/**
 * Minul hráč p v tejto Pitke limit NA EX (Vínna pivnica dve, inde jedno)? Po
 * odkrytí to drží naexPouzity, pred ním sa rátajú jeho skryté NA EX.
 */
export function naexLimitMinuty(data: GameData, state: StavLimituNaex, p: PlayerId): boolean {
  const pitka = state.pitkaStav;
  if (pitka === null || pitka.naexPouzity[p]) return true;
  return skryteHraca(pitka, p).length >= naexZaPitku(state);
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
  readonly zaverecne: readonly { readonly strana: PlayerId; readonly majitel: PlayerId; readonly uid: number; readonly naexBy: PlayerId | null }[];
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
  if (pitka.reakcia !== null || pitka.hotovy[ja] || pitka.zakazNaex?.[ja] === true) return [];
  const moje = skryteHraca(pitka, ja);
  if (view.hraci[ja].poldeciPlne - moje.length <= 0) return [];
  const minuty = naexLimitMinuty(data, view, ja);
  // Súperovu skrytú Záverečnú klient v línii nemá — doplní ju zo zaverecne (náhradné uid).
  // Kostol (v7): aj rub len v kraji pri oltári.
  const oltar = stranaOltara(lineState(view));
  const naRub = view.zaverecne
    .filter((z) => z.majitel !== ja && z.naexBy === null && (oltar === null || z.strana === oltar) && !view.strany.some((st) => st.some((pl) => pl.card.uid === z.uid)))
    .map((z) => z.uid);
  return [...naexCieleVLinii(data, lineState(view), ja, naexNaZviera(view, ja)), ...naRub].filter(
    (uid) => !moje.some((x) => x.uid === uid) && !minuty,
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
  // Kostol (Pitka, v7): len kraj pri oltári.
  const oltar = stranaOltara(line);
  for (const [si, strana] of line.strany.entries()) {
    if (oltar !== null && si !== oltar) continue;
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
 * krcma: kto má plný poldeci (a kam ho dať), musí dať NA EX — jedno. Po prvom
 * NA EX v Pitke povinnosť končí, aj keď druhé (Vínna pivnica) ešte ide.
 */
export function krcmaVyzaduje(data: GameData, state: GameState, p: PlayerId): boolean {
  const pitka = state.pitkaStav;
  const dal = skryteHraca(pitka, p).length + (pitka?.naexPocet?.[p] ?? 0) > 0;
  // Väzeň Krčmárka (v9) povinnosť ruší — moznostiNaex je pri zákaze prázdne.
  return jeCielLokalita(state, "krcma") && !dal && moznostiNaex(data, state, p).length > 0;
}

/**
 * Kam smie hráč q odpovedať kartou `karta` (v9.2): na koniec svojej alebo súperovej
 * strany, mimo limitu; keď prvý v kole už odpovedal, len na druhý kraj línie.
 */
export function cieleOdpovede(
  data: GameData,
  s: Pick<GameState, "strany" | "ciel" | "pitkaStav">,
  q: PlayerId,
  karta: CardInstance,
): ("vlastna" | "superova")[] {
  const kraj = s.pitkaStav?.krajOdpovede ?? null;
  return cieleVykladania(data, s.strany, q, karta, Number.POSITIVE_INFINITY, true, cielLokalitaId(s), [false, false]).filter(
    (c): c is "vlastna" | "superova" => (c === "vlastna" || c === "superova") && (kraj === null || (c === "vlastna" ? q : opponentOf(q)) !== kraj),
  );
}

/** Hráč q má v ruke kartu, ktorú môže ako odpoveď vyložiť (mimo limitu, v9.2 aj s krajom). */
function mozeReagovat(s: GameState, data: GameData, q: PlayerId): boolean {
  return s.hraci[q].ruka.some((k) => cieleOdpovede(data, s, q, k).length > 0);
}

/** Odpoveď na NA EX (v9.2): karta lícom dole, zadarmo, mimo limitu; otočí sa až s odpoveďou súpera. */
function cmdReakcia(
  s: MutState,
  data: GameData,
  cmd: { uid: number; target: CielVykladania },
  p: PlayerId,
  events: Event[],
): void {
  const pitka = s.pitkaStav;
  need(s.faza === "pitka" && pitka !== null && pitka.reakcia === p, "Teraz nemôžeš reagovať na NA EX.");
  const karta = s.hraci[p].ruka.find((k) => k.uid === cmd.uid);
  need(karta !== undefined, "Karta nie je v ruke.");
  const kraj = pitka.krajOdpovede ?? null;
  need(
    kraj === null || (cmd.target === "vlastna" ? p : opponentOf(p)) !== kraj,
    "Súper odpovedal na tento kraj línie — tvoja odpoveď smie len na druhý.",
  );
  vylozDoLinie(s, data, p, cmd.uid, cmd.target, events, false, true);
  const zostava: [number, number] = [pitka.odpovedeZostava?.[0] ?? 0, pitka.odpovedeZostava?.[1] ?? 0];
  zostava[p] = Math.max(0, zostava[p] - 1);
  pitka.odpovedeZostava = zostava;
  if (kraj === null) pitka.krajOdpovede = cmd.target === "vlastna" ? p : opponentOf(p);
  ukonciReakciu(s, data, events);
}

function cmdBezReakcie(s: MutState, data: GameData, p: PlayerId, events: Event[]): void {
  const pitka = s.pitkaStav;
  need(s.faza === "pitka" && pitka !== null && pitka.reakcia === p, "Teraz nemôžeš reagovať na NA EX.");
  events.push({ type: "log", text: `Hráč ${p + 1} na NA EX neodpovedá.` });
  events.push({ type: "odpovedNaNaex", hrac: p, uid: null, defId: null, ciel: null });
  // Kto vynechá, v tejto Pitke už neodpovedá (ani na ďalšie NA EX).
  const zostava: [number, number] = [pitka.odpovedeZostava?.[0] ?? 0, pitka.odpovedeZostava?.[1] ?? 0];
  zostava[p] = 0;
  pitka.odpovedeZostava = zostava;
  ukonciReakciu(s, data, events);
}

/** Po odpovedi odpovedá ďalší v kole (v9.2: útočník, potom obranca); keď nikto, kolo sa otočí. */
function ukonciReakciu(s: MutState, data: GameData, events: Event[]): void {
  const pitka = s.pitkaStav;
  if (pitka === null || pitka.reakcia === null) return;
  pitka.reakcia = null;
  if (dalsiaReakcia(s, data, events)) return;
  poKoleOdpovedi(s, data, events);
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

function cmdSmoke(s: MutState, data: GameData, cmd: { pocet?: number }, p: PlayerId, events: Event[]): void {
  const pitka = s.pitkaStav;
  const vPitke = s.faza === "pitka" && pitka !== null && pitka.reakcia === null;
  need(vPitke, "Fajčiť sa dá len v Pitke.");
  const zakaz = dovodZakazuFajcit(data, s as GameState, p);
  need(zakaz === null, zakaz ?? "");
  // Počet kariet naraz je nepovinný (playtest v7 131033: klient AI ho nepoznal) — bez neho 1.
  const kolko = cmd.pocet ?? 1;
  need(kolko > 0 && Number.isInteger(kolko), "Počet kariet musí byť kladný.");
  const cena = cenaFajcenia(pitka.fajcenie[p], kolko);
  need(s.hraci[p].cigarety >= cena, `Fajčiť teraz stojí ${cigariet(cena)}, máš ${s.hraci[p].cigarety}.`);
  need(jeCoTahat(s.hraci[p].doberaci.length, s.hraci[p].odhadzovaci.length), "Nemáš z čoho ťahať — doberací aj odhadzovací balíček sú prázdne.");
  hrac(s, p).cigarety -= cena;
  // Nerest je každá vyfajčená cigareta (§8) — aj tie, o ktoré je ďalšie fajčenie drahšie;
  // platby cigaretami za iné veci (doliatie, barter, Kšefty) od v9.1 nerest nie sú.
  hrac(s, p).nerestiTotoKolo += cena;
  const tahane = tahaj(s, p, kolko, events);
  pitka.fajcenie[p] += kolko;
  events.push({ type: "log", text: `Hráč ${p + 1} fajčí za ${cigariet(cena)} a doberá si ${kariet(tahane.length)}.` });
  // Krabička cigariet (Dedičstvo: Pitka, v7): súperovi za každé 2 vyfajčené cigarety karta, bez neresti.
  const opp = opponentOf(p);
  const pred = pitka.vyfajcene?.[p] ?? 0;
  const vyfajcene: [number, number] = [pitka.vyfajcene?.[0] ?? 0, pitka.vyfajcene?.[1] ?? 0];
  vyfajcene[p] = pred + cena;
  pitka.vyfajcene = vyfajcene;
  const krabicky = s.hraci[opp].dedicstvo.filter((k) => k.defId === "cigorky").length;
  const karty = krabicky * (Math.floor(vyfajcene[p] / KONSTANTY.EFEKT.CIGORKY_ZA_KARTU) - Math.floor(pred / KONSTANTY.EFEKT.CIGORKY_ZA_KARTU));
  if (karty > 0 && jeCoTahat(s.hraci[opp].doberaci.length, s.hraci[opp].odhadzovaci.length)) {
    const dobral = tahaj(s, opp, karty, events).length;
    events.push({ type: "log", text: `Krabička cigariet: hráč ${opp + 1} si za súperovo fajčenie doberá ${kariet(dobral)}.` });
  }
}

/** Cena stokárskeho barteru hráča p. */
export function barterCena(_data: GameData, _s: VerejnyStav, _p: PlayerId): number {
  return cenaBarteru();
}

function cmdBarter(s: MutState, data: GameData, p: PlayerId, events: Event[]): void {
  need(s.faza === "pitka" && s.pitkaStav?.reakcia === null, "Barter sa robí počas Pitky.");
  // Zjednodušenie v1: barter berie len cigarety, ktoré hráč má (pravidlá pripúšťajú
  // aj aktívne akcie Cigareta) — viď README.
  const cena = barterCena(data, s as GameState, p);
  need(s.hraci[p].cigarety >= cena, `Na barter treba ${cigariet(cena)}.`);
  hrac(s, p).cigarety -= cena;
  hrac(s, p).poldeciPlne += 1;
  events.push({ type: "log", text: `Hráč ${p + 1} robí stokársky barter za ${cigariet(cena)} — nový plný poldeci.` });
}

function cmdRefill(s: MutState, data: GameData, p: PlayerId, events: Event[]): void {
  need(s.faza === "pitka" && s.pitkaStav?.reakcia === null, "Poldeci sa dopĺňa počas Pitky.");
  need(!doliatieZakazane(s as GameState, p), "Vínko: poldeci za cigarety dolievať nesmieš.");
  need(!jednotaZakazuje(s as GameState, p), "Jednota: máš viac priznaných Dlhov — nesmieš fajčiť ani dolievať.");
  need(s.hraci[p].cigarety >= KONSTANTY.REFILL_CENA, `Treba ${KONSTANTY.REFILL_CENA} cigarety.`);
  need(s.hraci[p].poldeciVypite > 0, "Nemáš vypitý poldeci.");
  hrac(s, p).cigarety -= KONSTANTY.REFILL_CENA;
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
      : pitka.bzdocha === oppon
        ? `Hráč ${p + 1} končí svoju časť Pitky. Hráč ${oppon + 1} (Bzdocha) teraz hrá a vidí jeho NA EX.`
        : `Hráč ${p + 1} končí svoju časť Pitky. Čaká sa na hráča ${oppon + 1}.`,
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
  const naexDal: [boolean, boolean] = [(pitka.naexPocet?.[0] ?? 0) > 0, (pitka.naexPocet?.[1] ?? 0) > 0];
  const prirastky = prirastkyPitky(data, s as GameState, vyhodnotenie, naexDal);
  const ucet = { cirhozy: [0, 0] as [number, number], dlhy: [0, 0] as [number, number], cigarety: [0, 0] as [number, number] };
  const kliatbyPred = ([0, 1] as const).map((p) => ({
    cirhozy: s.cirhozyVKole[p],
    dlhy: s.hraci[p].dlhy,
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

  // Jogurt (Dedičstvo, Náradie 2026-10-30): tvoje Poldeci otáčajú vypitý poldeci hneď v Pitke —
  // čo otočia teraz, bitka už neotočí (poldeciOtoceneVKole).
  for (const p of [0, 1] as const) {
    if (!vDedicstve(s as GameState, p, "jogurt")) continue;
    const otocene = s.poldeciOtoceneVKole?.[p] ?? 0;
    const teraz = Math.min(Math.max(0, (sums[p].Poldeci ?? 0) - otocene), s.hraci[p].poldeciVypite);
    if (teraz <= 0) continue;
    hrac(s, p).poldeciVypite -= teraz;
    hrac(s, p).poldeciPlne += teraz;
    const nove: [number, number] = [s.poldeciOtoceneVKole?.[0] ?? 0, s.poldeciOtoceneVKole?.[1] ?? 0];
    nove[p] += teraz;
    s.poldeciOtoceneVKole = nove;
    events.push({ type: "log", text: `Jogurt: hráčovi ${p + 1} akcie Poldeci otáčajú ${pocet(teraz, "vypitý poldeci", "vypité poldeci", "vypitých poldeci")} na plný hneď v Pitke.` });
  }

  for (const p of [0, 1] as const) {
    ucet.cirhozy[p] = s.cirhozyVKole[p] - (kliatbyPred[p]?.cirhozy ?? 0);
    ucet.dlhy[p] = s.hraci[p].dlhy - (kliatbyPred[p]?.dlhy ?? 0);
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
    // Výherný automat (v7) zvyšuje prah Dlhu — rekapitulácia delí tým istým prahom ako vyhodnotenie.
    prahDlhu: [prahDlhu() + prahDlhuBonus(s as GameState, 0), prahDlhu() + prahDlhuBonus(s as GameState, 1)],
    dlhy: ucet.dlhy,
    pecenNaZaciatku: [zaciatok.pecen[0], zaciatok.pecen[1]],
    // Pečeň z NA EX — na Kare (v7) ju nesie súper toho, kto NA EX dal.
    naexDal: naexPecenSuperovi(s as GameState) ? [pitka.naexPocet?.[1] ?? 0, pitka.naexPocet?.[0] ?? 0] : [pitka.naexPocet?.[0] ?? 0, pitka.naexPocet?.[1] ?? 0],
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
    return Math.max(0, cigarety - obmedzenia);
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

function cmdVizia(s: MutState, data: GameData, cmd: { vziat: boolean; druha?: true }, p: PlayerId, events: Event[]): void {
  need(s.faza === "pitka" && s.vizia !== null && viziaNaTahu(s as GameState) === p, "Teraz nerozhoduješ o Vízii.");
  const vrchna = s.hraci[p].doberaci[0];
  need(vrchna !== undefined, "Doberací balíček je prázdny.");
  if (cmd.druha === true) {
    // Krištáľová guľa: druhá karta zhora do ruky či preč, vrchná sa vráti navrch.
    need(vDedicstve(s as GameState, p, "kristalova_gula"), "Druhú kartu ukáže len Krištáľová guľa.");
    const druha = s.hraci[p].doberaci[1];
    need(druha !== undefined, "Druhá karta v balíčku nie je.");
    hrac(s, p).doberaci.splice(1, 1);
    if (cmd.vziat) {
      doRuky(s, p, druha);
      events.push({ type: "tahal", hrac: p, pocet: 1 });
      events.push({ type: "kartyTahane", hrac: p, karty: [druha as CardInstance], pre: p });
      events.push({ type: "log", text: `Vízia (Krištáľová guľa): hráč ${p + 1} si berie druhú kartu zhora, vrchná ostáva navrchu.` });
    } else {
      events.push({ type: "log", text: `Vízia (Krištáľová guľa): hráč ${p + 1} zahadzuje druhú kartu zhora — ${defOf(data, druha as CardInstance).name}; vrchná ostáva navrchu.` });
    }
  } else if (cmd.vziat) {
    tahaj(s, p, 1, events);
    events.push({ type: "log", text: `Vízia: hráč ${p + 1} si vrchnú kartu balíčka berie do ruky.` });
  } else {
    hrac(s, p).doberaci.shift();
    events.push({ type: "log", text: `Vízia: hráč ${p + 1} zahadzuje vrchnú kartu balíčka — ${defOf(data, vrchna as CardInstance).name}.` });
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
    doRuky(s, p, karta);
  } else {
    const meno = defOf(data, s.hraci[p].odhadzovaci[idx] as CardInstance).name;
    events.push({ type: "log", text: `Hasič: hráč ${p + 1} vracia kartu ${meno} do odhadzovacieho balíčka.` });
  }
  dokonciPoVolbe(s, data, volba, events);
}

/** Po voľbe Hasiča, Klebetnice či Dohadzovačky dobehne, čo hra kvôli nej odložila. */
function dokonciPoVolbe(s: MutState, data: GameData, volba: HasicVolba, events: Event[]): void {
  if (volba.potom === "reakcia") ukonciReakciu(s, data, events);
  else if (volba.potom === "odpovede") poKoleOdpovedi(s, data, events);
  else if (volba.potom === "koniecPitky") dokonciPitku(s, data, events);
  else if (volba.potom === "bitka") pokracujBitku(s, data, events);
  else if (volba.potom === "zastavka") {
    if (volba.hrac === s.utocnik && zastavkaVolba(s, data, opponentOf(s.utocnik), events)) return;
    pokracujPoPitke(s, data, events);
  }
}

/** Príkazy, ktoré čakajúca voľba (Hasič, šenok, Živnostník, Kapybara…) dovoľuje. */
function volbyNastupu(data: GameData, state: GameState): Command[] {
  const volba = state.hasicVolby?.[0];
  if (volba === undefined) return [];
  if (volba.typ === "senok") return state.senok.map((k) => ({ type: "senok", uid: k.uid }) as Command);
  if (volba.typ === "kapybara") return state.starsi.filter((e) => e.marker !== MARKER_STRED && !vOhrozeni(state, e.elderId)).map((e) => ({ type: "kapybara", elderId: e.elderId }) as Command);
  if (volba.typ === "nastroj") {
    const strana = state.strany[volba.strana ?? volba.hrac];
    const posledna = strana[strana.length - 1];
    const smie = posledna?.card.defId === "zivnostnik" && posledna.playedBy === volba.hrac;
    const nastroje = smie ? state.hraci[volba.hrac].ruka.filter((k) => defOf(data, k).tags.includes("Nástroj")) : [];
    return [{ type: "nastroj", uid: null }, ...nastroje.map((k) => ({ type: "nastroj", uid: k.uid }) as Command)];
  }
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

/** Karty s Kšeftom v línii (Oslávenec a Smetiarka sú mimo sady v7, efekt ostáva rozhodnutý). */
const KSEFTY_KARIET: readonly string[] = ["stryko_z_ameriky", "oslavenec", "smetiarka"];
const KSEFTY_LOKALIT: readonly string[] = ["zberny_dvor", "sklad", "obecny_urad", "predsedova_vila"];
const OSLAVENEC_PECEN = 2;
const SKLAD_CENA = 1;
const VILA_CENA = 2;

/** Kšeft použitý hráčom p v tejto Pitke? */
function kseftPouzity(s: Pick<GameState, "pitkaStav">, p: PlayerId, uid: number): boolean {
  return s.pitkaStav?.kseft?.[p].includes(uid) === true;
}

/**
 * Kšefty, ktoré hráč p teraz smie spustiť (v7, plan.md 14.7): v Pitke na svojom
 * ťahu, nie počas odpovede na NA EX, každú kartu raz za Pitku; karta v jeho
 * partii (nie skrytá Záverečná), Kšeft lokality obaja. Kšeft väzňa (v9) ponúka
 * moznostiKseftuVazna.
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
      case "stryko_z_ameriky":
        if (h.cigarety >= KONSTANTY.EFEKT.STRYKO_CENA) out.push({ type: "kseft", uid });
        break;
      case "oslavenec":
        // Poldeci sľúbené skrytému NA EX už nalievať nemožno.
        if (h.poldeciPlne - skryteHraca(pitka, p).length > 0 && !zakazVypit(state)) out.push({ type: "kseft", uid });
        break;
      case "smetiarka":
        for (const k of h.ruka) if (!defOf(data, k).tags.includes("Kliatba") && !jeKartaBossa(state, k.uid)) out.push({ type: "kseft", uid, kartaUid: k.uid });
        break;
    }
  }
  const lok = state.ciel?.lokalita ?? null;
  if (lok !== null && KSEFTY_LOKALIT.includes(lok.defId) && !kseftPouzity(state, p, lok.uid)) {
    const uid = lok.uid;
    if (lok.defId === "zberny_dvor" && h.cigarety >= KONSTANTY.EFEKT.ZBERNY_DVOR_CENA) for (const k of h.odhadzovaci) out.push({ type: "kseft", uid, kartaUid: k.uid });
    if (lok.defId === "sklad" && h.cigarety >= SKLAD_CENA && state.hraci[opp].odhadzovaci.length > 0) out.push({ type: "kseft", uid });
    if (lok.defId === "obecny_urad" && h.cigarety >= KONSTANTY.EFEKT.URAD_CENA && h.dlhy > 0) out.push({ type: "kseft", uid });
    if (lok.defId === "predsedova_vila" && h.cigarety >= VILA_CENA) {
      for (const e of state.starsi) {
        if (vOhrozeni(state, e.elderId)) continue;
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
    case "stryko_z_ameriky": {
      need(h.cigarety >= KONSTANTY.EFEKT.STRYKO_CENA, `Strýko chce ${cigariet(KONSTANTY.EFEKT.STRYKO_CENA)}.`);
      h.cigarety -= KONSTANTY.EFEKT.STRYKO_CENA;
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
      need(!jeKartaBossa(s as GameState, karta.uid), "Staršieho, o ktorého zajatie sa hrá, Smetiarka nezoberie.");
      h.ruka.splice(idx, 1);
      h.odhadzovaci.push(karta as DeepMutable<CardInstance>);
      h.cigarety += 1;
      events.push({ type: "log", text: `Smetiarka: hráč ${p + 1} odhadzuje ${defOf(data, karta).name} a dostáva cigaretu.` });
      break;
    }
    case "zberny_dvor": {
      need(h.cigarety >= KONSTANTY.EFEKT.ZBERNY_DVOR_CENA, "Na Zberný dvor treba cigaretu.");
      const idx = h.odhadzovaci.findIndex((k) => k.uid === cmd.kartaUid);
      need(idx !== -1, "Karta nie je v tvojom odhadzovacom balíčku.");
      const karta = h.odhadzovaci.splice(idx, 1)[0] as DeepMutable<CardInstance>;
      h.cigarety -= KONSTANTY.EFEKT.ZBERNY_DVOR_CENA;
      events.push({ type: "log", text: `Zberný dvor: hráč ${p + 1} vykupuje zo šrotu ${defOf(data, karta as CardInstance).name} za cigaretu.` });
      doRuky(s, p, karta);
      break;
    }
    case "sklad": {
      need(h.cigarety >= SKLAD_CENA, "Na Sklad treba cigaretu.");
      const karta = hrac(s, opp).odhadzovaci.pop();
      need(karta !== undefined, "Súperov odhadzovací balíček je prázdny.");
      h.cigarety -= SKLAD_CENA;
      events.push({ type: "log", text: `Sklad: hráč ${p + 1} si za cigaretu berie zo súperovho odhadzovacieho balíčka ${defOf(data, karta as CardInstance).name}.` });
      // Karta odteraz patrí novému majiteľovi (7.5 bod 7c).
      doRuky(s, p, karta);
      break;
    }
    case "obecny_urad": {
      need(h.cigarety >= KONSTANTY.EFEKT.URAD_CENA, `Obecný úrad chce ${cigariet(KONSTANTY.EFEKT.URAD_CENA)}.`);
      need(h.dlhy > 0, "Nemáš priznaný Dlh.");
      h.cigarety -= KONSTANTY.EFEKT.URAD_CENA;
      presunDlhy(s, p, opp, 1);
      events.push({ type: "log", text: `Obecný úrad: hráč ${p + 1} platí ${cigariet(KONSTANTY.EFEKT.URAD_CENA)} a jeho priznaný Dlh prechádza na hráča ${opp + 1}.` });
      break;
    }
    case "predsedova_vila": {
      need(h.cigarety >= VILA_CENA, `Vila chce ${cigariet(VILA_CENA)}.`);
      const elder = s.starsi.find((e) => e.elderId === cmd.elderId);
      need(elder !== undefined, "Vyber staršieho.");
      need(!vOhrozeni(s as GameState, elder.elderId), "O tohto staršieho sa hrá (pokus o zajatie) — v tomto kole sa nehýbe.");
      const kSebe = cmd.kSebe === true;
      const nova = posunMarker(elder, kSebe ? p : opp);
      need(nova !== null, "Marker je na kraji stupnice.");
      h.cigarety -= VILA_CENA;
      const z = elder.marker;
      presunMarker(s, events, elder, nova, "kseft", p);
      events.push({ type: "log", text: `Predsedova vila: hráč ${p + 1} platí ${cigariet(VILA_CENA)} — ${textPosunu(data, elder as ElderState, kSebe ? "k sebe" : "od seba", z)}` });
      break;
    }
  }
  const pouzite: [number[], number[]] = [[...(pitka.kseft?.[0] ?? [])], [...(pitka.kseft?.[1] ?? [])]];
  pouzite[p].push(cmd.uid);
  pitka.kseft = pouzite;
}

// ---------------------------------------------------------------------------
// Kšeft väzňa (v9, Michal 2026-10-30, §7): výhradne držiteľ väzňa, za vypitý plný
// poldeci zo svojej zásoby, raz za Pitku na väzňa, v Pitke kým ju hráč neskončil.
// Kšeft, ktorý nemá čo urobiť, sa neponúka (Veterinár má aspoň časť o pečeni).

/** Starší, ktorých Kšeft väzňa hra pozná (v9, texty kariet v sekcii 3 zadania kroku 2). */
export const KSEFTY_VAZNOV: readonly string[] = ["hrobar", "farar", "autobusar", "starosta", "postarka", "krcmarka", "vychovavatelka", "veterinar"];

/** Cirhózy hráča p, ktoré smie zahodiť Veterinárov Kšeft: z ruky alebo priznané (O3), nie z balíčkov. */
export function cirhozyPreVeterinara(h: Pick<PlayerState, "ruka" | "priznane">): CardInstance[] {
  return [...h.ruka, ...h.priznane].filter((k) => k.defId === "cirhoza");
}

/**
 * Čo treba na ponuku Kšeftu väzňa — z verejného stavu a vlastnej ruky, aby rovnako
 * počítal server (GameState) aj klient (pohľad). Súperova ruka len počtom.
 */
export interface StavKseftuVazna {
  readonly faza: Phase;
  readonly vizia: GameState["vizia"];
  readonly pitkaStav: Pick<PitkaStav, "reakcia" | "hotovy" | "kseft" | "skryteNaex" | "zakazNaex"> | null;
  readonly ciel: CielKola | null;
  readonly senok: readonly CardInstance[];
  readonly vazni: readonly Vazen[];
  readonly kseftyKola?: KseftyKola;
  readonly poldeciPlne: readonly [number, number];
  readonly dlhy: readonly [number, number];
  readonly rukaPocet: readonly [number, number];
  /** Cirhózy hráča, ktorý sa pýta: v ruke a priznané (Veterinár, O3). */
  readonly cirhozy: readonly CardInstance[];
}

/** StavKseftuVazna zo stavu hry pre hráča p. */
export function stavKseftuVazna(state: GameState, p: PlayerId): StavKseftuVazna {
  return {
    faza: state.faza,
    vizia: state.vizia,
    pitkaStav: state.pitkaStav,
    ciel: state.ciel,
    senok: state.senok,
    vazni: state.vazni,
    ...(state.kseftyKola !== undefined ? { kseftyKola: state.kseftyKola } : {}),
    poldeciPlne: [state.hraci[0].poldeciPlne, state.hraci[1].poldeciPlne],
    dlhy: [state.hraci[0].dlhy, state.hraci[1].dlhy],
    rukaPocet: [state.hraci[0].ruka.length, state.hraci[1].ruka.length],
    cirhozy: cirhozyPreVeterinara(state.hraci[p]),
  };
}

/** Kšefty väzňov, ktoré hráč p teraz smie spustiť. */
export function moznostiKseftuVazna(data: GameData, state: GameState, p: PlayerId): Command[] {
  return ponukaKseftuVazna(stavKseftuVazna(state, p), p);
}

/** Ponuka Kšeftu väzňa zo StavKseftuVazna — jeden výpočet pre server aj klienta. */
export function ponukaKseftuVazna(state: StavKseftuVazna, p: PlayerId): Command[] {
  const pitka = state.pitkaStav;
  if (state.faza !== "pitka" || pitka === null || pitka.reakcia !== null || state.vizia !== null || pitka.hotovy[p]) return [];
  // Platí sa plným poldeci zo zásoby — nie tým, ktorý leží na skrytom NA EX. Kostol: nikto nevypije.
  if (state.poldeciPlne[p] - skryteHraca(pitka, p).length <= 0 || zakazVypit(state)) return [];
  const opp = opponentOf(p);
  const kola = state.kseftyKola;
  const out: Command[] = [];
  for (const v of vazniHraca(state, p)) {
    if (pitka.kseft?.[p].includes(v.karta.uid) === true) continue;
    const elderId = v.elderId;
    switch (v.karta.defId) {
      case "hrobar":
        if (state.rukaPocet[opp] > 0) out.push({ type: "kseftVazna", elderId });
        break;
      case "farar":
        // Ponúka sa aj súperovi bez Viery (hádže sa na ďalšie Pitky), nie však, keď už platí.
        if (kola?.vieraAkoHazard?.[opp] !== true) out.push({ type: "kseftVazna", elderId });
        break;
      case "autobusar":
        for (const k of state.senok) out.push({ type: "kseftVazna", elderId, kartaUid: k.uid });
        break;
      case "starosta":
        if (state.ciel?.lokalita != null && kola?.hranyPosilnene !== true) out.push({ type: "kseftVazna", elderId });
        break;
      case "postarka":
        if (state.dlhy[p] > 0) out.push({ type: "kseftVazna", elderId });
        break;
      case "krcmarka":
        // Len z verejného stavu — či súper skryto dal NA EX, sa tu prezradiť nesmie.
        if (pitka.zakazNaex?.[opp] !== true && state.poldeciPlne[opp] > 0) out.push({ type: "kseftVazna", elderId });
        break;
      case "vychovavatelka":
        // Na Krčme (NA EX povinné) sa neponúka (R16 B); súper bez plného poldeci NA EX nedá.
        if (!jeCielLokalita(state, "krcma") && pitka.zakazNaex?.[opp] !== true && state.poldeciPlne[opp] > 0) out.push({ type: "kseftVazna", elderId });
        break;
      case "veterinar":
        if (state.cirhozy.length === 0) out.push({ type: "kseftVazna", elderId });
        for (const k of state.cirhozy) out.push({ type: "kseftVazna", elderId, kartaUid: k.uid });
        break;
    }
  }
  return out;
}

function cmdKseftVazna(s: MutState, data: GameData, cmd: { elderId: string; kartaUid?: number }, p: PlayerId, events: Event[]): void {
  const moznosti = moznostiKseftuVazna(data, s as GameState, p);
  need(
    moznosti.some((c) => c.type === "kseftVazna" && c.elderId === cmd.elderId && c.kartaUid === cmd.kartaUid),
    "Taký Kšeft väzňa teraz nemáš (väzeň, plný poldeci, raz za Pitku, nie naprázdno).",
  );
  const pitka = s.pitkaStav as DeepMutable<PitkaStav>;
  const vazen = vazniHraca(s as GameState, p).find((v) => v.elderId === cmd.elderId) as Vazen;
  const meno = defOf(data, vazen.karta).name;
  const opp = opponentOf(p);
  const h = hrac(s, p);
  // Veterinár: pečeň držiteľa je v tejto Pitke 0 vrátane ceny Kšeftu — platí pred zaplatením.
  if (vazen.karta.defId === "veterinar") {
    const bez: [boolean, boolean] = [pitka.bezPecene?.[0] ?? false, pitka.bezPecene?.[1] ?? false];
    bez[p] = true;
    pitka.bezPecene = bez;
    h.pecen = 0;
  }
  // Cena: vypitý plný poldeci — nerest, +1 pečeň v tejto Pitke, limit ďalšieho Zhromaždenia o 1 nižší.
  h.poldeciPlne -= 1;
  h.poldeciVypite += 1;
  h.nerestiTotoKolo += 1;
  pitieVPitke(s, p, 1);
  pridajPecen(s, data, p, 1, events);
  const zaPoldeci = `Kšeft väzňa ${meno}: hráč ${p + 1} vypíja poldeci`;
  switch (vazen.karta.defId) {
    case "hrobar": {
      const ruka = s.hraci[opp].ruka;
      const [i, rng] = rngInt(s.rng, ruka.length);
      s.rng = rng;
      const karta = hrac(s, opp).ruka.splice(i, 1)[0] as DeepMutable<CardInstance>;
      hrac(s, opp).odhadzovaci.push(karta);
      events.push({ type: "log", text: `${zaPoldeci} — hráč ${opp + 1} odhadzuje náhodnú kartu z ruky.` });
      events.push({ type: "log", pre: opp, text: `Hrobár ti z ruky odhodil ${defOf(data, karta as CardInstance).name}.` });
      break;
    }
    case "farar": {
      const viera: [boolean, boolean] = [s.kseftyKola?.vieraAkoHazard?.[0] ?? false, s.kseftyKola?.vieraAkoHazard?.[1] ?? false];
      viera[opp] = true;
      s.kseftyKola = { ...(s.kseftyKola ?? {}), vieraAkoHazard: viera };
      events.push({ type: "log", text: `${zaPoldeci} — do konca kola je každá aktívna Viera hráča ${opp + 1} posilnený Hazard; v bitke mu Viera chýba.` });
      break;
    }
    case "autobusar": {
      const idx = s.senok.findIndex((k) => k.uid === cmd.kartaUid);
      const karta = s.senok.splice(idx, 1)[0] as DeepMutable<CardInstance>;
      doRuky(s, p, karta);
      events.push({ type: "log", text: `${zaPoldeci} a berie si zo šenku ${defOf(data, karta as CardInstance).name}.` });
      break;
    }
    case "starosta":
      s.kseftyKola = { ...(s.kseftyKola ?? {}), hranyPosilnene: true };
      events.push({ type: "log", text: `${zaPoldeci} — do konca kola sú všetky aktívne akcie hrán lokality posilnené (pre oboch).` });
      break;
    case "postarka":
      presunDlhy(s, p, opp, 1);
      events.push({ type: "log", text: `${zaPoldeci} a prepisuje svoj priznaný Dlh na hráča ${opp + 1}.` });
      break;
    case "krcmarka": {
      const zakaz: [boolean, boolean] = [pitka.zakazNaex?.[0] ?? false, pitka.zakazNaex?.[1] ?? false];
      zakaz[opp] = true;
      pitka.zakazNaex = zakaz;
      // Už dané skryté NA EX sa vráti (O4) — poldeci ešte nebol odpísaný, pečeň ani nerest nepribudli.
      const vratene = skryteHraca(pitka, opp).length;
      pitka.skryteNaex = (pitka.skryteNaex ?? []).filter((x) => x.hrac !== opp);
      events.push({
        type: "log",
        text: `${zaPoldeci} — hráč ${opp + 1} v tejto Pitke NA EX nedá${vratene > 0 ? "; jeho skryté NA EX sa mu vracia (poldeci ostáva plný)" : ""}.`,
      });
      break;
    }
    case "vychovavatelka": {
      const hrozby: [number, number] = [pitka.hrozbaPetelice?.[0] ?? 0, pitka.hrozbaPetelice?.[1] ?? 0];
      hrozby[p] += 1;
      pitka.hrozbaPetelice = hrozby;
      events.push({ type: "log", text: `${zaPoldeci} — ak hráč ${opp + 1} v tejto Pitke dá NA EX, hráč ${p + 1} má v bitke Petelicu navyše (+${KONSTANTY.VYCHOVAVATELKA_TUHE} tuhé).` });
      break;
    }
    case "veterinar": {
      let zahodena: string | null = null;
      if (cmd.kartaUid !== undefined) {
        for (const kopa of [h.ruka, h.priznane]) {
          const i = kopa.findIndex((k) => k.uid === cmd.kartaUid);
          if (i === -1) continue;
          kopa.splice(i, 1);
          zahodena = kopa === h.ruka ? "z ruky" : "priznanú";
          break;
        }
      }
      events.push({
        type: "log",
        text: `${zaPoldeci}${zahodena === null ? "" : ` a zahadzuje z hry Cirhózu ${zahodena}`} — v tejto Pitke sa mu poškodenie pečene nepočíta.`,
      });
      break;
    }
  }
  const pouzite: [number[], number[]] = [[...(pitka.kseft?.[0] ?? [])], [...(pitka.kseft?.[1] ?? [])]];
  pouzite[p].push(vazen.karta.uid);
  pitka.kseft = pouzite;
}

/** Súperove Kulturistovia, na ktoré hráč p smie v tejto Pitke dať Úplatok (v7). */
export function moznostiUplatku(data: GameData, state: GameState, p: PlayerId): Command[] {
  const pitka = state.pitkaStav;
  if (state.faza !== "pitka" || pitka === null || pitka.reakcia !== null || state.vizia !== null || pitka.hotovy[p]) return [];
  if (state.hraci[p].cigarety < 1) return [];
  const opp = opponentOf(p);
  if (efektPotlaceny(data, state, opp, "kulturista")) return [];
  return partiaHraca(state, opp)
    .filter((pl) => pl.card.defId === "kulturista" && pl.zaverecna !== true && !(pitka.uplatok ?? []).includes(pl.card.uid))
    .map((pl) => ({ type: "uplatok", uid: pl.card.uid }) as Command);
}

/**
 * Úplatok (v7, Kulturista): súper dá na kartu 1 cigaretu, raz za Pitku. Každý
 * zníži do konca kola jej útoky o stupeň (Petelica → Pecka → Rana → nič);
 * cigareta prepadne.
 */
function cmdUplatok(s: MutState, data: GameData, cmd: { uid: number }, p: PlayerId, events: Event[]): void {
  need(moznostiUplatku(data, s as GameState, p).some((c) => c.type === "uplatok" && c.uid === cmd.uid), "Úplatok teraz dať nemôžeš.");
  const pitka = s.pitkaStav as DeepMutable<PitkaStav>;
  const kde = najdiVLinii(s, cmd.uid) as { strana: PlayerId; index: number };
  const pl = s.strany[kde.strana][kde.index] as DeepMutable<PlacedCard>;
  hrac(s, p).cigarety -= 1;
  pl.uplatky = (pl.uplatky ?? 0) + 1;
  pitka.uplatok = [...(pitka.uplatok ?? []), cmd.uid];
  events.push({ type: "log", text: `Úplatok: hráč ${p + 1} dáva cigaretu na Kulturistu hráča ${opponentOf(p) + 1} — jeho útoky sú do konca kola o ${pl.uplatky} ${pl.uplatky === 1 ? "stupeň" : "stupne"} slabšie.` });
}

/** Karta zo šenku za Starostu (Nástup) či Dohadzovačku (Bitka), v7. */
function cmdSenok(s: MutState, data: GameData, cmd: { uid: number }, p: PlayerId, events: Event[]): void {
  const [volba, ...dalsie] = s.hasicVolby ?? [];
  need(volba !== undefined && volba.hrac === p && volba.typ === "senok", "Teraz neberieš kartu zo šenku.");
  const idx = s.senok.findIndex((k) => k.uid === cmd.uid);
  need(idx !== -1, "Karta nie je v šenku.");
  s.hasicVolby = dalsie;
  const karta = s.senok.splice(idx, 1)[0] as DeepMutable<CardInstance>;
  events.push({ type: "log", text: `Hráč ${p + 1} si berie zo šenku ${defOf(data, karta as CardInstance).name}.` });
  doRuky(s, p, karta);
  dokonciPoVolbe(s, data, volba, events);
}

/** Živnostník (Nástup, v7): Nástroj z ruky za neho na tú istú stranu, mimo limitu; null = nič. */
function cmdNastroj(s: MutState, data: GameData, cmd: { uid: number | null }, p: PlayerId, events: Event[]): void {
  const [volba, ...dalsie] = s.hasicVolby ?? [];
  need(volba !== undefined && volba.hrac === p && volba.typ === "nastroj", "Teraz neprikladáš Nástroj za Živnostníka.");
  s.hasicVolby = dalsie;
  if (cmd.uid !== null) {
    const karta = s.hraci[p].ruka.find((k) => k.uid === cmd.uid);
    need(karta !== undefined && defOf(data, karta as CardInstance).tags.includes("Nástroj"), "Za Živnostníka smieš priložiť len Nástroj z ruky.");
    const strana = volba.strana ?? p;
    const posledna = s.strany[strana][s.strany[strana].length - 1];
    need(posledna?.card.defId === "zivnostnik" && posledna.playedBy === p, "Živnostník už nie je na konci strany — Nástroj sa za neho nepriloží.");
    vylozDoLinie(s, data, p, cmd.uid, strana === p ? "vlastna" : "superova", events);
  } else events.push({ type: "log", text: `Živnostník: hráč ${p + 1} za neho Nástroj neprikladá.` });
  dokonciPoVolbe(s, data, volba, events);
}

/** Kapybara (Nástup, v7): marker vybraného staršieho o 1 pole k stredu. */
function cmdKapybara(s: MutState, data: GameData, cmd: { elderId: string }, p: PlayerId, events: Event[]): void {
  const [volba, ...dalsie] = s.hasicVolby ?? [];
  need(volba !== undefined && volba.hrac === p && volba.typ === "kapybara", "Teraz nerozhoduješ za Kapybaru.");
  const elder = s.starsi.find((e) => e.elderId === cmd.elderId);
  need(elder !== undefined && elder.marker !== MARKER_STRED, "Vyber staršieho, ktorého marker nie je v strede.");
  need(!vOhrozeni(s as GameState, elder.elderId), "O tohto staršieho sa hrá (pokus o zajatie) — v tomto kole sa nehýbe.");
  s.hasicVolby = dalsie;
  const nova = (elder.marker < MARKER_STRED ? elder.marker + 1 : elder.marker - 1) as MarkerPos;
  presunMarker(s, events, elder, nova, "nastup", p);
  events.push({ type: "log", text: `Kapybara (hráč ${p + 1}): ${defOf(data, elder.karta as CardInstance).name} o pole k stredu.` });
  dokonciPoVolbe(s, data, volba, events);
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

  if (s.pitkaCislo === 1 && zastavkaVolba(s, data, s.utocnik, events)) return;
  pokracujPoPitke(s, data, events);
}

/**
 * Zastávka (Pitka, v9.1 — nahrádza spoločný limit vykladania): po prvej Pitke kola si
 * každý hráč vezme zadarmo 1 kartu zo šenku, najprv útočník, potom obranca. Šenok sa
 * medzi nimi nedopĺňa; z prázdneho sa neberie nič. Zaradí voľbu hráča p; false = nie je čo brať.
 */
function zastavkaVolba(s: MutState, data: GameData, p: PlayerId, events: Event[]): boolean {
  if (!jeCielLokalita(s as GameState, "zastavka")) return false;
  if (s.senok.length === 0) {
    events.push({ type: "log", text: `Zastávka: šenok je prázdny — hráč ${p + 1} si nič neberie.` });
    return false;
  }
  s.hasicVolby = [...(s.hasicVolby ?? []), { hrac: p, typ: "senok", uid: 0, potom: "zastavka" }];
  events.push({ type: "log", text: `Zastávka: hráč ${p + 1} si po prvej Pitke berie zadarmo 1 kartu zo šenku.` });
  return true;
}

/** Po Pitke (a voľbách Zastávky): ďalšia Pitka, alebo bitka. */
function pokracujPoPitke(s: MutState, data: GameData, events: Event[]): void {
  // Ďalšia Pitka (Michal 2026-10-19): toľko, koľko dovolia aktivované akcie
  // karty v strede — línia sa medzitým mohla zmeniť.
  s.pitkyCelkom = Math.max(s.pitkaCislo, pocetPitiek(data, s as GameState));
  if (s.pitkaCislo < s.pitkyCelkom) {
    zacniZhromazdenie(s, data, events);
    return;
  }
  // Výherný automat (Dedičstvo, v7): v poslednej Pitke kola 1 Dlh za kus.
  for (const p of [0, 1] as const) {
    for (const _ of s.hraci[p].dedicstvo.filter((k) => k.defId === "vyherny_automat")) {
      events.push({ type: "log", text: `Výherný automat: hráč ${p + 1} v poslednej Pitke kola prehráva — Dlh.` });
      pridajDlh(s, p, events);
    }
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

/**
 * Koľko priznaných Dlhov chce spáliť Robota v kroku Exekútora — 1 za kus, s Fúrikom
 * v Dedičstve o 1 viac za kus (Náradie 2026-10-30). Za každý, ktorý nemá čo spáliť,
 * dá 1 špak (zmena pravidla Robota, §2, §11).
 */
function robotaPali(sums: ActionSums, furikov = 0, priazen = 0): number {
  // Priazeň Robota (v9, O5): akcie Robota navyše — aj na ne platí Fúrik.
  return ((sums.Robota ?? 0) + priazen) * (1 + furikov);
}

/** Fúriky v Dedičstve hráča p. */
function furikov(s: VerejnyStav, p: PlayerId): number {
  return s.hraci[p].dedicstvo.filter((k) => k.defId === "furik").length;
}

/**
 * Koľko priznaných Dlhov najviac spáli najbližšia bitka — Robota v kroku
 * Exekútora (Dievčina na vydaj od v7 Dlhy nepáli); Dlh sa sám nepáli (návrh #4 B).
 * Ten istý výpočet ako zacniBitku a pokracujBitku, aby náhľad ceny Dlhu
 * sedel s hrou (návrh „Náhľady sľubujú inú cenu“, #1 B). Benzínku a odovzdaný
 * Nástroj nepredvída.
 */
export function paleneDlhyVBitke(
  data: GameData,
  s: VerejnyStav & { readonly lokalitaOtocena: boolean },
  vyhodnotenie: LineEval = evaluateLine(data, lineState(s)),
): readonly [number, number] {
  return [robotaPali(vyhodnotenie.sums[0], furikov(s, 0), silaPriazne(data, s, "ROBOTA", 0)), robotaPali(vyhodnotenie.sums[1], furikov(s, 1), silaPriazne(data, s, "ROBOTA", 1))];
}

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
    benzinkaZostava: [0, 0],
    karHotovy: [false, false],
    spalit: [],
    vesticaHotova: false,
  };
  const b = s.bitkaStav;

  // Traktoristka (v7, Na leasing): bez prevahy v jej kraji Dlh — pred Exekútorom.
  for (const p of [0, 1] as const) {
    for (let i = traktoristkyBezPrevahy(data, s as GameState, p); i > 0; i--) {
      events.push({ type: "log", text: `Traktoristka: hráč ${p + 1} nemá v jej kraji prevahu — leasing ide na Dlh.` });
      pridajDlh(s, p, events);
    }
  }

  manualEfekty(s, data, "Bitka", events);
  manualEfekty(s, data, "Furt", events);
  if (odlozPoHasicovi(s, "bitka")) return;
  pokracujBitku(s, data, events);
}

/**
 * Dohadzovačka (Nástup, Michal 2026-10-28): leží na konci strany `strana` (uid). Ak jej
 * vnútorný sused O2 je Občan alebo Starešina s tagom Žena či Chlap (karta ktoréhokoľvek
 * hráča), z druhej strany lokality sa najvzdialenejší Občan alebo Starešina opačného
 * pohlavia presunie za ňu — na vonkajší koniec jej strany; medzera sa uzavrie. Presun je
 * povinný, karta ostáva majiteľovi a natočená k nemu. Karta s oboma tagmi sa ráta ako
 * oboje. Presun nie je priloženie (Konflikt ani Pascu nespustí); skrytá Záverečná sa
 * nepresúva. Vráti nové strany a presunutú kartu (null = nič sa nestalo).
 */
export function presunDohadzovackou<S extends readonly [readonly PlacedCard[], readonly PlacedCard[]]>(
  data: GameData,
  strany: S,
  strana: PlayerId,
  uid: number,
): { readonly strany: S; readonly presunuta: PlacedCard | null } {
  const moja = strany[strana];
  const i = moja.findIndex((pl) => pl.card.uid === uid);
  const o2 = i > 0 ? moja[i - 1] : undefined;
  const nic = { strany, presunuta: null };
  if (o2 === undefined || o2.zaverecna === true) return nic;
  const tagy2 = defOf(data, o2.card).tags;
  const clovek = (t: readonly Tag[]): boolean => t.includes("Občan") || t.includes("Starešina");
  if (!clovek(tagy2)) return nic;
  const hladam: Tag[] = [...(tagy2.includes("Žena") ? (["Chlap"] as const) : []), ...(tagy2.includes("Chlap") ? (["Žena"] as const) : [])];
  if (hladam.length === 0) return nic;
  const druha = strany[opponentOf(strana)];
  for (let j = druha.length - 1; j >= 0; j--) {
    const o1 = druha[j] as PlacedCard;
    if (o1.zaverecna === true) continue;
    const t = defOf(data, o1.card).tags;
    if (!clovek(t) || !hladam.some((x) => t.includes(x))) continue;
    const zostava = druha.filter((_, k) => k !== j);
    const nova = [...moja, o1];
    return { strany: (strana === 0 ? [nova, zostava] : [zostava, nova]) as unknown as S, presunuta: o1 };
  }
  return nic;
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
}

/** Súčty akcií a Pohoršenia z aktuálnej línie (Benzínka ju môže zmeniť). */
function nastavSumy(s: MutState, data: GameData): void {
  const b = s.bitkaStav;
  if (b === null) return;
  const sums = evaluateLine(data, lineState(s as GameState)).sums;
  b.sums = sums as DeepMutable<BitkaStav["sums"]>;
  b.pohorsenieZostava = [rozpisPohorseni(data, s as GameState, sums, 0), rozpisPohorseni(data, s as GameState, sums, 1)];
  b.pohorseniaSpolu = [b.pohorsenieZostava[0], b.pohorsenieZostava[1]];
}

/** Stav, z ktorého sa rátajú body Pohoršení (GameState aj ClientState). */
export interface StavBodovPohorseni {
  /** Pokusy o zajatie tohto kola (v9) — starší v ohrození sa nehýbe. Chýba v syntetických stavoch. */
  readonly pokusy?: readonly (PokusOZajatie | null)[];
  /** Dedičstvo hráčov — Telefón mení cenu Pohoršenia k stredu (chýba v syntetických stavoch). */
  readonly hraci?: readonly { readonly dedicstvo: readonly { readonly defId: string }[] }[];
  readonly bitkaStav: { readonly pohorsenieZostava: readonly [number, number] } | null;
}

/**
 * Koľko Pohoršení smie hráč p minúť na staršieho. Starší v ohrození (pokus o zajatie v9,
 * O8) sa v kole pokusu nehýbe — naňho nič.
 */
export function bodyNaPohorsenie(state: StavBodovPohorseni, p: PlayerId, elder: Pick<ElderState, "elderId">): number {
  const b = state.bitkaStav;
  if (b === null) return 0;
  if (state.pokusy !== undefined && vOhrozeni({ pokusy: state.pokusy }, elder.elderId)) return 0;
  return b.pohorsenieZostava[p];
}

/**
 * Smie hráč p teraz dať Pohoršenia na staršieho (k súperovi, alebo kSebe k sebe)?
 * Od v8.2 (Michal 2026-10-30) sa posun platí podľa zóny (cenaKroku) — stačí, keď
 * zvyšok Pohoršení vyjde aspoň na jedno pole.
 */
export function pohorsenieMozne(state: StavBodovPohorseni, p: PlayerId, elder: Pick<ElderState, "elderId" | "marker">, kSebe = false): boolean {
  const body = bodyNaPohorsenie(state, p, elder);
  return body > 0 && posunZaBody(elder, kSebe ? p : opponentOf(p), body, telefonHraca(state, p)) !== null;
}

/** Stav pre Pohoršenia bitky — línia (GameState aj ClientState). */
export type StavPohorseni = VerejnyStav;

function rozpisPohorseni(data: GameData, s: StavPohorseni, sums: readonly [ActionSums, ActionSums], p: PlayerId): number {
  // Abstinent v5 (Michal 2026-10-25): v bitke +1 / +2 / +3 Pohoršenia. Nervák (Pohoršenie
  // za Absťák) zanikol v9.1. Policajtka ich od 2026-10-26 neruší — jej efekt je Dlh za NA EX v Pitke.
  const abstinent = silaPriazne(data, s, "LAKOMEC", p);
  return (sums[p].Pohoršenie ?? 0) + abstinent;
}

/**
 * Pohoršenia, ktoré hráči dostanú v bitke (PRAVIDLA §9.2) zo súčtov línie — ten istý
 * výpočet ako nastavSumy, pre náhľad ceny NA EX (návrh #1, playtest 20261024-075830).
 */
export function pohorseniaVBitke(data: GameData, s: StavPohorseni, sums: readonly [ActionSums, ActionSums]): readonly [number, number] {
  return [rozpisPohorseni(data, s, sums, 0), rozpisPohorseni(data, s, sums, 1)];
}

/** Smie Povera hráča p posunúť silu priazne tohto staršieho (v8.3; v ohrození nie, v9 O8)? */
export function poveraNaStarsieho(state: { readonly pokusy?: readonly (PokusOZajatie | null)[] } & StavKlebiet, elder: Pick<ElderState, "marker" | "elderId">, p: PlayerId): boolean {
  if (state.pokusy !== undefined && vOhrozeni({ pokusy: state.pokusy }, elder.elderId)) return false;
  return poveraMozna(elder, p, klebetyKola(state));
}

/** Smie prebytok hráča `drzi` (zvyšok `body`) posunúť marker tohto staršieho? (v ohrození nie, v9 O8) */
export function prebytokNaStarsieho(state: { readonly pokusy?: readonly (PokusOZajatie | null)[] }, elder: Pick<ElderState, "marker" | "elderId">, drzi: PlayerId, body: number): boolean {
  if (state.pokusy !== undefined && vOhrozeni({ pokusy: state.pokusy }, elder.elderId)) return false;
  return posunZaBody(elder, opponentOf(drzi), body) !== null;
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
    // Exekúcia (Robota, Exekútor) ide od 2026-10-28 až po poškodení a špakoch za bitku (exekucieBitky).
    b.krok = "povery";
  }

  // 1. Povery (v8.3 „Výpožička priazne“, Michal 2026-10-30): Viera a Povery sa vyrušia
  // 1 : 1, každá zvyšná Povera posunie silu priazne jedného staršieho o stupeň k svojmu
  // majiteľovi (marker sa nehýbe) — obranca rozdeľuje prvý, útočník vidí. Potom sa
  // Pohoršenia prepočítajú (Abstinent už s klebetami).
  if (b.krok === "povery") {
    if (b.poveryZostava === undefined) {
      const zvysne = poskodenieBitky(data, s as GameState, b.sums as readonly [ActionSums, ActionSums]).zvysnaPovera;
      b.poveryZostava = [zvysne[0], zvysne[1]];
    }
    const zostava = b.poveryZostava;
    for (const p of [obranca(s), s.utocnik]) {
      if (zostava[p] <= 0) continue;
      if (!s.starsi.some((e) => poveraNaStarsieho(s as GameState, e as ElderState, p))) {
        events.push({ type: "log", text: `Hráč ${p + 1} stráca ${pocet(zostava[p], "Poveru", "Povery", "Povier")} — všetky priazne sú už jeho v sile 3.` });
        zostava[p] = 0;
        continue;
      }
      b.caka = p;
      return;
    }
    nastavSumy(s, data);
    b.krok = "pohorsenie";
  }

  // 2. Pohoršenie (obranca, potom útočník).
  if (b.krok === "pohorsenie") {
    for (const p of [obranca(s), s.utocnik]) {
      while (b.pohorsenieZostava[p] > 0) {
        // v8.2: Pohoršenia sa míňajú ako prebytok — podľa ceny zóny, bez limitu, aj na kraj; k sebe aj k súperovi.
        if (!s.starsi.some((e) => pohorsenieMozne(s as GameState, p, e) || pohorsenieMozne(s as GameState, p, e, true))) {
          events.push({ type: "log", text: `Hráč ${p + 1} stráca ${pocet(b.pohorsenieZostava[p], "Pohoršenie", "Pohoršenia", "Pohoršení")} — nestačí na posun žiadneho markera.` });
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

  // 4c. Prebytok — posunie markery pre ďalšiu bitku (v8: rozdeľuje ten, proti komu sa ráta;
  // vo finále sa od v8.3 nerozdeľuje, prebytokNaRozdelenie).
  if (b.krok === "prebytok") {
    while (b.prebytokZostava > 0 && b.prebytokDrzi !== null) {
      if (!existujeLegalnyPrebytok(s, b.prebytokDrzi)) {
        // Hlásiť, inak hráči tiché prepadnutie považovali za chybu (playtest 20261021-143600).
        events.push({
          type: "log",
          text: `Nakladačka ${b.prebytokZostava} prepadla — nestačí na posun žiadneho markera k hráčovi ${opponentOf(b.prebytokDrzi) + 1}.`,
        });
        b.prebytokZostava = 0;
        break;
      }
      b.caka = rozdelujePrebytok(s, b.prebytokDrzi);
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
    b.krok = "cintorin";
  }

  // 6. Cintorín (Prehra, Michal 2026-10-27): porazený smie dať Nástroj z ruky alebo zo šenku
  // do Dedičstva zadarmo; pri sekere nikto (porazený nie je).
  if (b.krok === "cintorin") {
    const porazeny = b.vitaz === null ? null : opponentOf(b.vitaz);
    if (
      b.cintorinHotovy !== true &&
      porazeny !== null &&
      jeCielLokalita(s as GameState, "cintorin") &&
      data.cards.get("cintorin")?.triggers.includes("Prehra") === true &&
      [...s.hraci[porazeny].ruka, ...s.senok].some((k) => defOf(data, k as CardInstance).tags.includes("Nástroj"))
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
    if (b.zivnostnikZostava === undefined) b.zivnostnikZostava = vitaz === null ? 0 : pocetZivnostnikov(s, data, vitaz);
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

function pocetZivnostnikov(s: MutState, data: GameData, p: PlayerId): number {
  // Do v7 Výhra; od v7 má Živnostník Nástup (Nástroj za neho).
  if (data.cards.get("zivnostnik")?.triggers.includes("Výhra") !== true) return 0;
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
    // Absťák (v9.1) smie Kar zahodiť ako Cirhózu.
    need(karta !== undefined && (karta.defId === "cirhoza" || karta.defId === "abstak"), "Na Kare smieš zahodiť len nepriznanú Cirhózu alebo Absťák z ruky.");
    vezmiZRuky(s, p, cmd.uid);
    events.push({ type: "log", text: `Kar: hráč ${p + 1} ${rodovo(p, "zahodil", "zahodila", "zahadzuje")} ${karta.defId === "abstak" ? "Absťák" : "nepriznanú Cirhózu"} z ruky.` });
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
  b.krok = "cintorin";
  pokracujBitku(s, data, events);
}

function cmdCintorin(s: MutState, data: GameData, cmd: { uid: number | null }, p: PlayerId, events: Event[]): void {
  const b = s.bitkaStav;
  need(s.faza === "bitka" && b !== null && b.krok === "cintorin" && b.caka === p, "Nečaká sa na Cintorín.");
  if (cmd.uid !== null) {
    const zRuky = s.hraci[p].ruka.find((k) => k.uid === cmd.uid);
    const zoSenku = s.senok.find((k) => k.uid === cmd.uid);
    const karta = zRuky ?? zoSenku;
    need(karta !== undefined && defOf(data, karta as CardInstance).tags.includes("Nástroj"), "Do Dedičstva patrí Nástroj z ruky alebo zo šenku.");
    if (zRuky !== undefined) vezmiZRuky(s, p, cmd.uid);
    else s.senok.splice(s.senok.findIndex((k) => k.uid === cmd.uid), 1);
    hrac(s, p).dedicstvo.push(karta as DeepMutable<CardInstance>);
    // Spoločná cena Dedičstva sa zvýši ako vždy (Michal 2026-10-20).
    s.dedicstvaVylozene += 1;
    events.push({ type: "log", text: `Cintorín: hráč ${p + 1} dedí — ${defOf(data, karta as CardInstance).name} ${zRuky !== undefined ? "z ruky" : "zo šenku"} ide do Dedičstva zadarmo.` });
    manualEfekty(s, data, "Dedičstvo", events);
  }
  b.cintorinHotovy = true;
  pokracujBitku(s, data, events);
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

/** Hráč v pláne ťahu; Dedičstvo kvôli Vínku, ktoré zvýši limit hneď. */
export interface PlanHraca {
  readonly cigarety: number;
  readonly poldeciPlne: number;
  readonly dedicstvo?: readonly { readonly defId: string }[];
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
    readonly hraci: readonly [PlanHraca, PlanHraca];
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
  let mojeDedicstvo: readonly { readonly defId: string }[] = stav.hraci[p].dedicstvo ?? [];
  let poldeci = 0;
  const chyba = (text: string): PlanVykladania => ({ kroky, poldeci, chyba: text, zostava });
  const lokalita = cielLokalitaId(stav);
  // Kostol: nikto nesmie vypiť — bez Vypiť ide v ťahu len jedna karta.
  if (tahove.length > 1 && zakazVypit(stav)) return chyba("Kostol: nikto nesmie vypiť — v ťahu len jedna karta.");
  for (const x of priznania) {
    if (!cieleVykladania(data, strany, p, x.karta, zostava, true, lokalita, zablokovane).includes("priznanie")) return chyba(`${defOf(data, x.karta).name} sa nedá priznať.`);
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
    if (!cieleVykladania(data, strany, p, x.karta, zostava, cigarety >= cena, lokalita, zablokovane).includes(x.ciel)) {
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
      const bonusPred = limitBonusDedicstva(mojeDedicstvo);
      mojeDedicstvo = [...mojeDedicstvo, x.karta];
      zostava += limitBonusDedicstva(mojeDedicstvo) - bonusPred;
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
): CielVykladania[] {
  const def = defOf(data, karta);
  // Kliatba sa dá len priznať (Michal 2026-10-20) — do línie smie len kliatba,
  // ktorá je zároveň Občan s akciami (Milujúca manželka). Absťák (v9.1) ani to.
  if (def.id === "abstak") return [];
  if (def.tags.includes("Kliatba") && !def.tags.includes("Občan")) return ["priznanie"];
  const jeNastroj = def.tags.includes("Nástroj");
  const doDedicstva = jeNastroj && naDedicstvo;
  // Nástroj limit nemíňa, nesmie však susediť s Nástrojom na konci partie.
  const smie = (strana: PlayerId, ciel: "vlastna" | "superova"): boolean => {
    if (!jeNastroj && zostavaLimit <= 0 && !bezLimituPracujuci(lokalita, def.tags)) return false;
    if (ciel === "superova" && lenVlastnaStrana(lokalita)) return false;
    const koniec = susedNaKonci(strany, strana);
    // Za skrytú Záverečnú sa nedá priložiť (ani odpoveď na NA EX), kým sa neotočí.
    if (koniec?.zaverecna === true || zablokovane[ciel === "vlastna" ? p : opponentOf(p)]) return false;
    // Za kartu, ktorú Hrobár urobil poslednou, sa už nepriloží (Konflikt v7).
    if (koniec?.posledna === true) return false;
    return !(jeNastroj && koniec != null && defOf(data, koniec.card).tags.includes("Nástroj"));
  };
  const out: CielVykladania[] = [];
  if (smie(p, "vlastna")) out.push("vlastna");
  if (smie(opponentOf(p), "superova")) out.push("superova");
  if (def.tags.includes("Kliatba")) out.push("priznanie");
  if (doDedicstva) out.push("dedicstvo");
  return out;
}

/**
 * Exekúcia (Michal 2026-10-28, krok 4c): po poškodení, výsledku a špakoch za bitku
 * a za starších, pred prebytkom; obranca, potom útočník. Najprv Robota spáli za každú
 * aktívnu Robotu 1 priznaný Dlh (z hry), potom Exekútor — bez prahu — ku každému
 * s priznaným Dlhom; Záhradkár v partii ho obíde. Zhorené špaky sa zapíšu do
 * záznamu bitky na nástenke.
 */
function exekucieBitky(s: MutState, data: GameData, events: Event[]): void {
  const b = s.bitkaStav;
  if (b === null) return;
  for (const p of [obranca(s), s.utocnik]) {
    if (b.exekutorHotovy[p]) continue;
    // Robota (Náradie 2026-10-30): spáli 1 priznaný Dlh za kus (s Fúrikom viac); za každý,
    // ktorý nemá čo spáliť, 1 špak. Robota sa ráta raz za bitku (exekutorHotovy).
    const chce = b.robotaHotova?.[p] === true ? 0 : robotaPali(b.sums[p] as ActionSums, furikov(s as GameState, p), silaPriazne(data, s as GameState, "ROBOTA", p));
    const spalene = odoberDlhy(s, p, chce);
    if (spalene > 0) events.push({ type: "log", text: `Robota: hráč ${p + 1} páli ${pocet(spalene, "priznaný Dlh", "priznané Dlhy", "priznaných Dlhov")}.` });
    if (chce - spalene > 0) {
      s.spaky[p] += chce - spalene;
      const zaznam = s.nastenka[s.nastenka.length - 1];
      if (zaznam !== undefined) {
        const r: [number, number] = [zaznam.robota?.[0] ?? 0, zaznam.robota?.[1] ?? 0];
        r[p] += chce - spalene;
        zaznam.robota = r;
      }
      events.push({ type: "log", text: `Robota: hráč ${p + 1} nemá čo spáliť — dostáva ${spakov(chce - spalene)}.` });
    }
    const hotova: [boolean, boolean] = [b.robotaHotova?.[0] ?? false, b.robotaHotova?.[1] ?? false];
    hotova[p] = true;
    b.robotaHotova = hotova;
    const dlhy = s.hraci[p].dlhy;
    if (dlhy === 0) {
      b.exekutorHotovy[p] = true;
      continue;
    }
    if (zahradkarChrani(data, s as GameState, p)) {
      events.push({ type: "log", text: `Záhradkár: exekúcia hráča ${p + 1} v tomto kole obchádza — Dlhy ani špaky nezhoria.` });
      b.exekutorHotovy[p] = true;
      continue;
    }
    exekucia(s, data, p, events);
  }
  const zaznam = s.nastenka[s.nastenka.length - 1];
  if (zaznam !== undefined) {
    zaznam.exekutor = [b.exekutor[0], b.exekutor[1]];
    zaznam.spakyPo = [s.spaky[0], s.spaky[1]];
  }
}

/**
 * Záhradkár (Exekúcia, Michal 2026-10-28): „Exekúcia v tomto kole pre teba neplatí.“ —
 * odkrytý v partii hráča p v línii tejto bitky; vtedy ho Exekútor obíde celkom.
 */
export function zahradkarChrani(data: GameData, s: Pick<VerejnyStav, "strany">, p: PlayerId): boolean {
  return partiaHraca(s, p).some((pl) => pl.card.defId === "zahradkar" && pl.zaverecna !== true && !efektPotlaceny(data, s, p, "zahradkar"));
}

/**
 * Exekúcia bez prahu (Michal 2026-10-28): zhorí polovica priznaných Dlhov
 * zaokrúhlene nahor a rovnaký počet špakov — smú ísť do mínusu, súper ich nedostane.
 * Priazeň Advokát (v9) odpočíta o svoju silu menej špakov, najmenej 0; Dlhy zhoria ako vždy.
 */
function exekucia(s: MutState, data: GameData, p: PlayerId, events: Event[]): void {
  const b = s.bitkaStav;
  if (b === null) return;
  const dlhy = s.hraci[p].dlhy;
  const zhori = zhoriPriExekucii(dlhy);
  const advokat = silaPriazne(data, s as GameState, "ADVOKAT", p);
  const spaky = spakyPriExekucii(dlhy, advokat);
  odoberDlhy(s, p, zhori);
  s.spaky[p] -= spaky;
  b.exekutor[p] += spaky;
  events.push({
    type: "log",
    text: `Exekútor: hráčovi ${p + 1} zhorí ${pocet(zhori, "priznaný Dlh", "priznané Dlhy", "priznaných Dlhov")} a ${spakov(spaky)}${advokat > 0 ? ` (Advokát ušetril ${spakov(zhori - spaky)})` : ""}.`,
  });
  b.exekutorHotovy[p] = true;
}

/** „1 špak“, „3 špaky“, „5 špakov“. */
export function spakov(n: number): string {
  return pocet(n, "špak", "špaky", "špakov");
}


function existujeLegalnyPrebytok(s: MutState, drzi: PlayerId): boolean {
  const body = s.bitkaStav?.prebytokZostava ?? 0;
  if (body < 1) return false;
  return s.starsi.some((e) => prebytokNaStarsieho(s as GameState, e as ElderState, drzi, body));
}

/**
 * Posun markera — jediné miesto, kde sa marker v stave mení: stopa (posunyMarkerov,
 * udalosť obom), nová pozícia, zaplatené a držané stupne strachu (v8.3, sPosunutymMarkerom).
 */
function presunMarker(s: MutState, events: Event[], elder: DeepMutable<ElderState>, na: MarkerPos, zdroj: PosunMarkera["zdroj"], kto: PlayerId): void {
  if (elder.marker !== na) {
    const posun: PosunMarkera = { elderId: elder.elderId, z: elder.marker, na, zdroj, kto };
    s.posunyMarkerov.push(posun);
    events.push({ type: "posunMarkera", ...posun });
  }
  const po = sPosunutymMarkerom(elder as ElderState, na);
  elder.marker = po.marker;
  if (po.vyplatene === undefined) delete elder.vyplatene;
  else elder.vyplatene = po.vyplatene;
  if (po.drzane === undefined) delete elder.drzane;
  else elder.drzane = po.drzane;
}

/**
 * Log posunu s menom staršieho a dôsledkom — „hráč N“ klient nahradí menom (UX U11).
 * Stupeň pred a po aj obe strany (návrh #27 A, Michal 2026-10-28; pojmy v8.3): „od seba“
 * je smer na stupnici, nie polovica — z vlastnej polovice tvoja priazeň klesne a súper ho
 * desí menej. Mená idú len v 1. páde („hráč N“), preto „desí ho hráč N“, nie „bojí sa hráča N“.
 */
function textPosunu(data: GameData, elder: ElderState, smer: "k sebe" | "od seba", z: MarkerPos): string {
  const kroky = Math.abs(elder.marker - z);
  const oKolko = kroky === 1 ? "o krok" : `o ${kroky} ${kroky <= 4 ? "polia" : "polí"}`;
  const pred = { marker: z };
  const komuPred = priazenHraca(pred);
  const komu = priazenHraca(elder);
  const silaPred = priazenSila(pred);
  const sila = priazenSila(elder);
  const stupen = STUPNICA_ZONY[elder.marker];
  const stupne = `stupeň ${STUPNICA_ZONY[z]} → ${stupen} (${NAZVY_ZON[STUPNICA_ZONY[z]]} → ${NAZVY_ZON[stupen]}), ${STAV_STARSIEHO[stupen]}`;
  let strany: string;
  if (komu === null) {
    strany = komuPred === null ? "nikto nemá priazeň" : `hráč ${komuPred + 1} prišiel o priazeň, nikto ho nedesí`;
  } else {
    const zmena = komuPred !== komu ? "nová" : sila > silaPred ? `stúpla z +${silaPred}` : `klesla z +${silaPred}`;
    const strach = komuPred !== komu ? "desí" : sila > silaPred ? "desí viac" : "desí menej";
    strany = `hráč ${komu + 1} má priazeň +${sila} (${zmena}), hráč ${opponentOf(komu) + 1} ho ${strach}`;
  }
  return `${defOf(data, elder.karta).name} ${oKolko} ${smer} — ${stupne}: ${strany}.`;
}

/** Povera (v8.3): posunie silu priazne staršieho o stupeň k hráčovi p — len na toto kolo. */
function cmdPovera(s: MutState, data: GameData, cmd: { elderId: string }, p: PlayerId, events: Event[]): void {
  const b = s.bitkaStav;
  need(s.faza === "bitka" && b !== null && b.krok === "povery" && b.caka === p, "Nečaká sa na Povery.");
  need((b.poveryZostava?.[p] ?? 0) > 0, "Nemáš zvyšnú Poveru.");
  const elder = s.starsi.find((e) => e.elderId === cmd.elderId);
  need(elder !== undefined, "Taký starší nie je.");
  need(!vOhrozeni(s as GameState, elder.elderId), "O tohto staršieho sa hrá (pokus o zajatie) — v tomto kole sa nehýbe.");
  need(poveraMozna(elder as ElderState, p, klebetyKola(s as GameState)), "Priazeň tohto staršieho je už tvoja v sile 3.");
  const pred = ucinnaPriazen(elder as ElderState, klebetyKola(s as GameState));
  const posun = p === 0 ? 1 : -1;
  const klebety = (b.klebety ?? {}) as Klebety;
  b.klebety = { ...klebety, [elder.elderId]: (klebety[elder.elderId] ?? 0) + posun };
  // Horoskop (Náradie 2026-10-30): klebety každého hráča zvlášť — jeho prejdú do ďalšieho kola.
  const hracov: [Klebety, Klebety] = [b.klebetyHracov?.[0] ?? {}, b.klebetyHracov?.[1] ?? {}];
  hracov[p] = { ...hracov[p], [elder.elderId]: (hracov[p][elder.elderId] ?? 0) + posun };
  b.klebetyHracov = hracov as DeepMutable<[Klebety, Klebety]>;
  const po = ucinnaPriazen(elder as ElderState, klebetyKola(s as GameState));
  const zostava = b.poveryZostava as [number, number];
  zostava[p] -= 1;
  const text = (u: { hrac: PlayerId | null; sila: number }): string => (u.hrac === null ? "nikto" : `hráč ${u.hrac + 1} +${u.sila}`);
  events.push({
    type: "log",
    text: `Povera (hráč ${p + 1}): ${defOf(data, elder.karta as CardInstance).name} — priazeň v tomto kole ${text(pred)} → ${text(po)}; marker sa nehýbe.`,
  });
  pokracujBitku(s, data, events);
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
  need(posunMarker(elder, smer) !== null, "Marker je na kraji stupnice.");
  const body = bodyNaPohorsenie(s as GameState, p, elder);
  need(body > 0, "O tohto staršieho sa hrá (pokus o zajatie) — v tomto kole sa nehýbe.");
  // v8.2: hráč vyberá staršieho a smer, nie počet polí — marker ide, kým Pohoršenia stačia.
  const posun = posunZaBody(elder, smer, body, telefonHraca(s, p));
  need(posun !== null, "Na posun tohto markera tvoje Pohoršenia nestačia.");
  // Priazeň aj strach sa menia hneď — platia už v poškodení a v špakoch tejto bitky.
  const z = elder.marker;
  presunMarker(s, events, elder, posun.marker, "pohorsenie", p);
  b.pohorsenieZostava[p] -= posun.cena;
  events.push({
    type: "log",
    text: `Pohoršenie (hráč ${p + 1}, ${pocet(posun.cena, "Pohoršenie", "Pohoršenia", "Pohoršení")}): ${textPosunu(data, elder as ElderState, kSebe ? "k sebe" : "od seba", z)}`,
  });
  pokracujBitku(s, data, events);
}

/**
 * Prebytok, ktorý sa naozaj rozdelí — jeden výpočet pre bitku aj odhad bitky v klientovi.
 * Vo finále sa prebytok nerozdeľuje (v8.3, Michal 2026-10-30): nové stupne by nič nedali —
 * od v9.1 ho víťaz dostane v špakoch 1 : 1 (vyplatSpaky).
 */
export function prebytokNaRozdelenie(s: VerejnyStav, outcome: BattleOutcome): number {
  return outcome.prebytokDrzi === null || jeFinale(s) ? 0 : outcome.prebytok;
}

/** Poškodenie + výsledok (PRAVIDLA §9.3–9.4) — čisto automatické. */
function vyhodnotPoskodenie(s: MutState, data: GameData, events: Event[]): void {
  const b = s.bitkaStav;
  if (b === null) return;
  const damage = poskodenieBitky(data, s as GameState, b.sums as readonly [ActionSums, ActionSums]);
  // Remízu v tuhom rozhodnú Absťáky, ktoré hráči práve majú, potom priznané Dlhy (v6).
  const abstaky: [number, number] = [aktualneAbstaky(data, s as GameState, 0), aktualneAbstaky(data, s as GameState, 1)];
  const dlhy: [number, number] = [s.hraci[0].dlhy, s.hraci[1].dlhy];
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
    rozpis: rozpisPoskodenia(data, s as GameState, sums),
    damage,
    priznaneDlhy: [s.hraci[0].dlhy, s.hraci[1].dlhy],
    pohorsenia: [b.pohorseniaSpolu?.[0] ?? 0, b.pohorseniaSpolu?.[1] ?? 0],
    pitkyKola: (s.pitkyKola ?? []) as readonly RekapitulaciaPitky[],
    vitaz: outcome.vitaz,
    prebytok: outcome.prebytok,
    prebytokDrzi: outcome.prebytokDrzi,
  });
  // Špaky za bitku a za starších (v6) idú aj do rekapitulácie bitky; exekúcia
  // (Michal 2026-10-28) až po nich — Povera, remíza, Herňa a Noviny vidia Dlhy pred ňou.
  const logy: Event[] = [];
  vyplatSpaky(s, data, outcome, logy);
  exekucieBitky(s, data, logy);
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
    strany: [[...s.strany[0]], [...s.strany[1]]],
    rekap: spaky === undefined ? rekap : { ...rekap, spaky },
  });
  events.push(...logy);
  // Vo finále sa Nakladačka nerozdeľuje — víťaz ju dostal v špakoch (vyplatSpaky).
  if (outcome.prebytokDrzi !== null && !jeFinale(s) && b.prebytokZostava < outcome.prebytok) {
    events.push({
      type: "log",
      text: `Puška hráča ${opponentOf(outcome.prebytokDrzi) + 1}: Nakladačka ${outcome.prebytok} → ${b.prebytokZostava}.`,
    });
  }
  manualEfekty(s, data, "Výhra", events);
  manualEfekty(s, data, "Prehra", events);
}

/**
 * Latka Absťáku na konci kola: Chuť, s Opatrovateľkou v línii o OPATROVATELKA_CHUT nižšia
 * za kus (Furt, v9.1). Jeden výpočet pre motor aj výhľad v bare (stavZavislosti).
 */
export function latkaChuti(chut: number, opatrovatelky: number): number {
  return chut - opatrovatelky * KONSTANTY.OPATROVATELKA_CHUT;
}

/** Chuť po konci kola: väčšie z (Chuť, neresti kola) − CHUT_UBYTOK, nie pod 0. */
export function chutPoKole(chut: number, neresti: number): number {
  return Math.max(0, Math.max(chut, neresti) - KONSTANTY.CHUT_UBYTOK);
}

/** Opatrovateľky hráča p odhalené v línii (Furt) — Záverečná lícom dole nie. */
export function opatrovatelkyHraca(data: GameData, s: VerejnyStav, p: PlayerId): number {
  return partiaHraca(s, p).filter((pl) => pl.card.defId === "opatrovatelka" && pl.zaverecna !== true && !efektPotlaceny(data, s, p, "opatrovatelka")).length;
}

function koniecKolaChut(s: MutState, data: GameData, p: PlayerId, opatrovatelky: number, events: Event[]): void {
  const h = hrac(s, p);
  const neresti = h.nerestiTotoKolo;
  const latka = latkaChuti(h.chut, opatrovatelky);
  // Sada spred v9.1 kartu Absťák nemá — Chuť sa vedie, karta nepríde.
  if (neresti < latka && data.cards.has("abstak")) {
    h.odhadzovaci.push(novaInstancia(s, data, "abstak") as DeepMutable<CardInstance>);
    h.abstakyZiskane = (h.abstakyZiskane ?? 0) + 1;
    const opatr = opatrovatelky > 0 ? ` (Opatrovateľka: porovnáva sa ${latka})` : "";
    events.push({
      type: "log",
      text: `Hráč ${p + 1} dostáva Absťák do odhadzovacieho balíčka: Chuť ${h.chut}${opatr}, v kole ${rodovo(p, "vypil a vyfajčil", "vypila a vyfajčila", "vypije a vyfajčí")} ${textNeresti(neresti)}.`,
    });
  }
  const po = chutPoKole(h.chut, neresti);
  if (po !== h.chut) events.push({ type: "log", text: `Chuť hráča ${p + 1}: ${h.chut} → ${po}.` });
  h.chut = po;
}

/** Karty Absťák v balíčku hráča (v9.1) — rozhodujú remízu v tuhom. */
export function aktualneAbstaky(_data: GameData, s: VerejnyStav, p: PlayerId): number {
  return verejneAbstaky(s, p);
}

/** Koľko starších sa hráča p bojí (marker na súperovej polovici) — Noviny (v6). */
export function pocetBojacichSa(starsi: readonly ElderState[], p: PlayerId): number {
  return starsi.filter((e) => obavanyHrac(e) === p).length;
}

/** Karty v línii pri bitke (v8): spolu na oboch stranách a koľko z nich je v partii ktorého hráča. */
export interface KartyBitky {
  readonly spolu: number;
  readonly vlastne: readonly [number, number];
}

/**
 * Karty ležiace v línii pri lokalite (v8, Michal 2026-10-28) — z nich sú špaky
 * za bitku. Priznané karty a Dedičstvo v línii nie sú; čo z nej počas kola
 * zmizlo, sa neráta. Súperov klient skrytú Záverečnú v strany nemá — ráta sa
 * podľa verejného záznamu (zaverecne); v bitke je už otočená.
 */
export function kartyBitky(s: {
  readonly strany: readonly [readonly PlacedCard[], readonly PlacedCard[]];
  readonly zaverecne?: readonly { readonly majitel: PlayerId; readonly uid: number }[];
}): KartyBitky {
  const vlastne: [number, number] = [0, 0];
  const uids = new Set<number>();
  for (const pl of [...s.strany[0], ...s.strany[1]]) {
    vlastne[pl.playedBy] += 1;
    uids.add(pl.card.uid);
  }
  for (const z of s.zaverecne ?? []) if (!uids.has(z.uid)) vlastne[z.majitel] += 1;
  return { spolu: vlastne[0] + vlastne[1], vlastne };
}

/** Špaky za bitku (krok 4a) pri víťazovi — komu idú a z čoho sa skladajú. */
export interface SpakyZaVyhru {
  /** Karty v línii (aspoň 1). */
  readonly zisk: number;
  readonly zoSekery: number;
  /** Herňa (v7): toľko, koľko má porazený priznaných Dlhov. */
  readonly herna: number;
  readonly spolu: number;
  /** Kultúrny dom (v8): porazený dostane 1 špak za každú svoju kartu v línii. */
  readonly porazenemu: number;
  /** Noviny porazeného (Titulka): 1 špak za každý priznaný Dlh, ktorý má víťaz navyše. */
  readonly noviny: number;
}

/**
 * Udržaný strach na konci kola (v8.3, Michal 2026-10-30, variant 6A): po bitke,
 * Pohoršeniach aj prebytku zaplatí každý starší hráčovi, ktorého sa bojí, stupne,
 * ktoré marker udržal od konca minulého kola (strachNaVyplatu) — nech bitku vyhral
 * ktokoľvek; stupeň, na ktorom marker stojí teraz, sa začína udržiavať (poKonciKola).
 * Vo finále sa tak vyplatí, čo sa udržalo z posledného kola; nové stupne finále nič.
 * Pripíše sa k špakom za starších na nástenke (záznam tejto bitky).
 */
function vyplatUdrzanyStrach(s: MutState, data: GameData, events: Event[]): void {
  const zaStarsich: [number, number] = [0, 0];
  const rozpis: [SpakyOdStarsieho[], SpakyOdStarsieho[]] = [[], []];
  for (const e of s.starsi) {
    const kto = obavanyHrac(e as ElderState);
    if (kto !== null) {
      const n = strachNaVyplatu(e as ElderState, kto);
      if (n > 0) {
        zaStarsich[kto] += n;
        rozpis[kto].push({ elderId: e.elderId, defId: e.karta.defId, spaky: n });
      }
    }
    const po = poKonciKola(e as ElderState);
    if (po.vyplatene === undefined) delete e.vyplatene;
    else e.vyplatene = po.vyplatene;
    if (po.drzane === undefined) delete e.drzane;
    else e.drzane = po.drzane;
  }
  if (zaStarsich[0] + zaStarsich[1] === 0) return;
  for (const p of [0, 1] as const) s.spaky[p] += zaStarsich[p];
  const zaznam = s.nastenka[s.nastenka.length - 1];
  if (zaznam !== undefined) {
    zaznam.zaStarsich = [zaznam.zaStarsich[0] + zaStarsich[0], zaznam.zaStarsich[1] + zaStarsich[1]];
    const stary = zaznam.zaStarsichRozpis ?? [[], []];
    zaznam.zaStarsichRozpis = [
      [...stary[0], ...rozpis[0]],
      [...stary[1], ...rozpis[1]],
    ];
    zaznam.spakyPo = [s.spaky[0], s.spaky[1]];
  }
  for (const p of [0, 1] as const) {
    if (zaStarsich[p] === 0) continue;
    const kto = rozpis[p].map((x) => `${data.cards.get(x.defId)?.name ?? x.defId} ${x.spaky}`).join(", ");
    events.push({ type: "log", text: `Koniec kola — udržaný strach: hráč ${p + 1} dostáva ${spakov(zaStarsich[p])} (${kto}).` });
  }
}

/**
 * Špaky za bitku, keď ju vyhrá `vitaz` — jeden výpočet pre vyplatSpaky aj
 * stávku bitky v klientovi (stavkaBitky). Priznané Dlhy (Herňa, Noviny) berie
 * zo stavu, ktorý dostane: pri výplate po Exekútorovi, v stávke tie teraz.
 */
export function spakyZaVyhru(
  s: VerejnyStav & { readonly spakyNaSekere: number },
  vitaz: PlayerId,
  karty: KartyBitky,
): SpakyZaVyhru {
  const porazeny = opponentOf(vitaz);
  const zisk = spakyZaBitku(karty.spolu);
  const dlhy = (q: PlayerId): number => s.hraci[q].dlhy;
  // Herňa (Bitka, v7): víťaz navyše toľko špakov, koľko má porazený priznaných Dlhov — bez stropu.
  const herna = jeCielLokalita(s, "herna") ? dlhy(porazeny) : 0;
  // Noviny — Titulka (Dedičstvo: Prehra, návrh #40, Michal 2026-10-28): porazený majiteľ
  // dostane 1 špak za každý priznaný Dlh, ktorý má víťaz navyše; víťazovi sa nič neberie.
  const noviny = vDedicstve(s, porazeny, "noviny") ? Math.max(0, dlhy(vitaz) - dlhy(porazeny)) : 0;
  // Kultúrny dom (Bitka, v8 „Obaja bodujú“): porazený aj za svoje karty v línii.
  const porazenemu = jeCielLokalita(s, "kulturny_dom") ? karty.vlastne[porazeny] : 0;
  return { zisk, zoSekery: s.spakyNaSekere, herna, spolu: zisk + s.spakyNaSekere + herna, porazenemu, noviny };
}

/**
 * Špaky po výsledku bitky (v6, Michal 2026-10-26), krok 4a: víťaz dostane 1 špak
 * za kartu v línii (aspoň 1; od v8.1 bez zrážky za Absťáky) a špaky zo sekery; pri
 * sekere čakajú špaky kola na víťaza ďalšej bitky, vo finále prepadnú. Noviny
 * porazeného mu dajú 1 špak za každý Dlh víťaza navyše. Strach starších sa od v8.3
 * vypláca až na konci kola (vyplatUdrzanyStrach). Lokalita ide s výsledkom na nástenku.
 */
function vyplatSpaky(s: MutState, data: GameData, outcome: BattleOutcome, events: Event[]): void {
  const b = s.bitkaStav;
  if (b === null) return;
  const finale = jeFinale(s);
  const pitky = s.pitkaCislo;
  // v8 (Michal 2026-10-28, návrh #28): špaky za bitku = karty v línii na oboch stranách.
  const karty = kartyBitky(s as GameState);
  const zaBitku: [number, number] = [0, 0];
  let zoSekery = 0;
  let noviny = 0;
  const abstakZrazka = 0;
  let prepadlo = 0;
  const nakladacka: [number, number] = [0, 0];
  const vitaz = outcome.vitaz;
  if (vitaz !== null) {
    const porazeny = opponentOf(vitaz);
    const v = spakyZaVyhru(s as GameState, vitaz, karty);
    const { zisk, herna, spolu, porazenemu } = v;
    noviny = v.noviny;
    zoSekery = s.spakyNaSekere;
    zaBitku[vitaz] += spolu;
    zaBitku[porazeny] += porazenemu + noviny;
    s.spakyNaSekere = 0;
    s.spaky[vitaz] += spolu;
    s.spaky[porazeny] += porazenemu + noviny;
    const preco = outcome.rozhodlo === "abstak" ? " (remíza v tuhom, menej Absťákov)" : outcome.rozhodlo === "dlhy" ? " (remíza v tuhom aj v Absťákoch, menej priznaných Dlhov)" : "";
    events.push({
      type: "log",
      // Zložky zvlášť (Michal 2026-10-27): karty v línii, Herňa za Dlhy porazeného, sekera.
      text: `Bitku ${rodovo(vitaz, "vyhral", "vyhrala", "vyhráva")} hráč ${vitaz + 1}${preco}: ${spakov(zisk + zoSekery + herna)} — 1 špak za kartu v línii (${kariet(karty.spolu)})${herna > 0 ? `, +${herna} za Dlhy porazeného (Herňa, ${pocet(herna, "priznaný Dlh", "priznané Dlhy", "priznaných Dlhov")})` : ""}${zoSekery > 0 ? `, +${zoSekery} zo sekery` : ""}.`,
    });
    if (porazenemu > 0) {
      events.push({ type: "log", text: `Kultúrny dom: aj porazený hráč ${porazeny + 1} dostáva ${spakov(porazenemu)} — 1 za každú svoju kartu v línii.` });
    }
    if (noviny > 0) {
      events.push({ type: "log", text: `Noviny: porazený hráč ${porazeny + 1} dostáva ${spakov(noviny)} — víťaz má o ${pocet(noviny, "priznaný Dlh", "priznané Dlhy", "priznaných Dlhov")} viac.` });
    }
    // Nakladačka vo finále (v9.1, Michal 2026-10-30): markery sa už nehýbu — víťaz dostane
    // za každý jej bod 1 špak (predtým prepadla), aby zaostávajúci mohol finále dobehnúť.
    if (finale && outcome.prebytokDrzi === vitaz && outcome.prebytok > 0) {
      nakladacka[vitaz] = outcome.prebytok * KONSTANTY.SPAKY_ZA_NAKLADACKU_VO_FINALE;
      s.spaky[vitaz] += nakladacka[vitaz];
      events.push({ type: "log", text: `Nakladačka ${outcome.prebytok} vo finále: hráč ${vitaz + 1} dostáva ${spakov(nakladacka[vitaz])} — 1 za každý bod.` });
    }
  } else if (finale) {
    prepadlo = karty.spolu + s.spakyNaSekere;
    s.spakyNaSekere = 0;
    events.push({ type: "log", text: `Finále skončilo sekerou — ${spakov(prepadlo)} za bitku prepadá.` });
  } else {
    s.spakyNaSekere += karty.spolu;
    events.push({ type: "log", text: `Sekera: remíza v tuhom, v Absťákoch aj v Dlhoch — ${spakov(karty.spolu)} za karty v línii ide na sekeru (spolu ${s.spakyNaSekere}), vezme ich víťaz ďalšej bitky.` });
  }
  const lokalita = cielLokalita(s as GameState);
  s.nastenka.push({
    kolo: s.kolo,
    lokalita: lokalita as DeepMutable<CardInstance> | null,
    ...(finale ? { finale: true } : {}),
    vitaz,
    rozhodlo: outcome.rozhodlo,
    pitky,
    karty: karty.spolu,
    zaBitku,
    ...(noviny > 0 ? { noviny } : {}),
    zoSekery,
    abstakZrazka,
    prepadlo,
    zaStarsich: [0, 0],
    zaStarsichRozpis: [[], []],
    exekutor: [b.exekutor[0], b.exekutor[1]],
    prebytok: nakladacka,
    spakyPo: [s.spaky[0], s.spaky[1]],
  });
}

/**
 * Kto rozdeľuje prebytok (v8, Michal 2026-10-28): markery idú vždy k súperovi
 * držiteľa (starší sa začnú báť držiteľa), ale vyberá hráč, proti ktorému sa
 * prebytok ráta — spravidla porazený si sám vyberie, ktoré priazne dostane;
 * pri sekere ten s nižším celkovým poškodením. Vo finále sa od v8.3 nerozdeľuje.
 */
export function rozdelujePrebytok(_s: Pick<VerejnyStav, "ciel">, drzi: PlayerId): PlayerId {
  return opponentOf(drzi);
}

function cmdPrebytok(
  s: MutState,
  data: GameData,
  cmd: { elderId: string },
  p: PlayerId,
  events: Event[],
): void {
  const b = s.bitkaStav;
  need(s.faza === "bitka" && b !== null && b.krok === "prebytok" && b.caka === p && b.prebytokDrzi !== null, "Nečaká sa na Nakladačku.");
  need(b.prebytokZostava > 0, "Nakladačka je rozdelená.");
  const elder = s.starsi.find((e) => e.elderId === cmd.elderId);
  need(elder !== undefined, "Taký starší nie je.");
  // Prebytok posúva marker k súperovi držiteľa [R8.4] — pri víťazovi k porazenému,
  // ktorý od v8 sám vyberá, ktorých starších (priazne) chce. Od v8.2 len staršieho:
  // marker ide, kým zvyšok prebytku stačí na ďalšie pole (cenaKroku).
  const drzi = b.prebytokDrzi as PlayerId;
  need(!vOhrozeni(s as GameState, elder.elderId), "O tohto staršieho sa hrá (pokus o zajatie) — v tomto kole sa nehýbe.");
  const posun = posunZaBody(elder, opponentOf(drzi), b.prebytokZostava);
  need(posun !== null, "Na posun tohto markera zvyšok Nakladačky nestačí.");
  const z = elder.marker;
  presunMarker(s, events, elder, posun.marker, "prebytok", drzi);
  if (!b.prebytokPosunute.includes(cmd.elderId)) b.prebytokPosunute.push(cmd.elderId);
  b.prebytokZostava -= posun.cena;
  events.push({ type: "log", text: `Nakladačka (hráč ${p + 1}, ${posun.cena} z Nakladačky): ${textPosunu(data, elder as ElderState, p === drzi ? "od seba" : "k sebe", z)}` });
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
  const vypiNaex = (q: PlayerId): void => {
    if (vratene[q] < doDna[q]) {
      hrac(s, q).poldeciPlne += 1;
      vratene[q] += 1;
    } else hrac(s, q).poldeciVypite += 1;
    hrac(s, q).nerestiTotoKolo += KONSTANTY.NEREST_NAEX;
  };
  for (const partia of s.strany) {
    for (const placed of partia) {
      if (placed.naexBy !== undefined) {
        vypiNaex(placed.naexBy as PlayerId);
        delete (placed as { naexBy?: PlayerId }).naexBy;
      }
      // Zrážka NA EX (Výtržník): druhý poldeci na karte pije druhý hráč.
      if (placed.naexBy2 !== undefined) {
        vypiNaex(placed.naexBy2 as PlayerId);
        delete (placed as { naexBy2?: PlayerId }).naexBy2;
      }
    }
  }
  for (const q of [0, 1] as const) {
    if (vratene[q] > 0) events.push({ type: "log", text: `Na zdravie (priazeň Alkoholika): hráčovi ${q + 1} sa ${vratene[q] === 1 ? "poldeci z NA EX vracia plný" : `${vratene[q]} poldeci z NA EX vracajú plné`}.` });
  }
  for (const p of [0, 1] as const) {
    // Jogurt: čo akcie Poldeci otočili už v Pitke, sa v bitke neotáča znova.
    let otocenia = Math.max(0, (b.sums[p].Poldeci ?? 0) - (s.poldeciOtoceneVKole?.[p] ?? 0));
    while (otocenia > 0 && s.hraci[p].poldeciVypite > 0) {
      hrac(s, p).poldeciVypite -= 1;
      hrac(s, p).poldeciPlne += 1;
      otocenia--;
    }
  }
  events.push({ type: "log", text: "Poldeci z NA EX sa vypili; aktívne akcie Poldeci otočili vypité." });
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

  // 6c. Kmotor (v9, Michal 2026-10-30): po bitke presunie tvoje priznané Dlhy medzi súperove —
  // pri sile 1 / 2 / 3 až 2 / 3 / 4; ak ich máš menej, toľko, koľko máš.
  for (const p of [0, 1] as const) {
    const su = opponentOf(p);
    const sila = silaPriazne(data, s as GameState, "UZERNIK", p);
    const presunute = presunDlhy(s, p, su, sila > 0 ? sila + 1 : 0);
    if (presunute > 0) {
      events.push({ type: "log", text: `Priazeň Kmotra: hráč ${p + 1} prepisuje ${pocet(presunute, "priznaný Dlh", "priznané Dlhy", "priznaných Dlhov")} na hráča ${su + 1}.` });
    }
  }

  // 6c. Fajčiar (v9, Michal 2026-10-30): +1 / +2 / +3 cigarety po bitke (predtým po šenku) —
  // Obmedzenie ich neuberá; cigarety za prebytok porazenému ostávajú.
  for (const p of [s.utocnik, obranca(s)] as const) {
    const sila = silaPriazne(data, s as GameState, "FAJCIAR", p);
    if (sila <= 0) continue;
    hrac(s, p).cigarety += sila;
    events.push({ type: "log", text: `Priazeň Fajčiara: hráč ${p + 1} dostáva po bitke ${cigariet(sila)}.` });
  }

  // Efekty Výhra/Prehra — ešte kým karty ležia v partiách. Zvieratá vedľa Mäsiara
  // (Recidivista, Krokodíl) sa nespustia — rozhoduje okolie v tejto chvíli.
  const umlcane = zvieratAUmlcane(data, lineState(s as GameState));
  const doRukyPoBitke = new Set<number>();
  if (vitaz !== null && porazeny !== null) {
    const linia = evaluateLine(data, lineState(s as GameState));
    for (const pl of partiaHraca(s as GameState, porazeny)) {
      if (pl.zaverecna === true || b.spalit.includes(pl.card.uid) || efektPotlaceny(data, s as GameState, porazeny, pl.card.defId)) continue;
      // Recidivista (Prehra, v7): po bitke sa vráti majiteľovi do ruky.
      if (pl.card.defId === "recidivista" && !umlcane.has(pl.card.uid)) {
        doRukyPoBitke.add(pl.card.uid);
        events.push({ type: "log", text: `Recidivista: zas je vonku — hráčovi ${porazeny + 1} sa po bitke vráti do ruky.` });
      }
      // Dievčina na vydaj (Prehra, v7): zahodí sa, víťaz získa Dlhy za jej aktívne akcie.
      if (pl.card.defId === "dievcina_na_vydaj") {
        const dlhy = aktivneAkcieKarty(linia, pl.card.uid);
        b.spalit.push(pl.card.uid);
        events.push({ type: "log", text: `Dievčina na vydaj: hráč ${porazeny + 1} ju zahadzuje — hráč ${vitaz + 1} získava ${pocet(dlhy, "Dlh", "Dlhy", "Dlhov")}.` });
        for (let i = 0; i < dlhy; i++) pridajDlh(s, vitaz, events);
      }
    }
  }
  // podvodnik (Prehra, v7): za každého Podvodníka prejde jeden priznaný Dlh porazeného k víťazovi.
  if (vitaz !== null && porazeny !== null) {
    const podvodnici = partiaHraca(s as GameState, porazeny).filter((pl) => pl.card.defId === "podvodnik" && pl.zaverecna !== true).length;
    for (let i = 0; i < podvodnici; i++) {
      if (presunDlhy(s, porazeny, vitaz, 1) === 0) break;
      events.push({ type: "log", text: `Podvodník: hráč ${porazeny + 1} prepisuje jeden svoj priznaný Dlh na hráča ${vitaz + 1}.` });
    }
  }

  // Krokodíl (Bitka, v7): na konci bitky idú z hry všetci Občania a Zvieratá v jeho okolí,
  // bez ohľadu na majiteľa; Starešinovia a Nástroje ostávajú.
  const line = lineState(s as GameState);
  for (const pl of [...s.strany[0], ...s.strany[1]]) {
    if (pl.card.defId !== "krokodil" || pl.zaverecna === true || umlcane.has(pl.card.uid) || efektPotlaceny(data, s as GameState, pl.playedBy as PlayerId, "krokodil")) continue;
    for (const obet of okolieVLinii(line, pl.card.uid)) {
      if (obet === null || b.spalit.includes(obet.card.uid)) continue;
      const tagy = defOf(data, obet.card).tags;
      if (!tagy.includes("Občan") && !tagy.includes("Zviera")) continue;
      b.spalit.push(obet.card.uid);
      events.push({ type: "log", text: `Krokodíl hráča ${pl.playedBy + 1} zožiera kartu ${defOf(data, obet.card).name} — ide z hry.` });
    }
  }

  // 6d. Zajatie (v9): víťazov pokus uspeje, ostatné zlyhajú; tretí väzeň končí hru.
  vyriesZajatie(s, data, vitaz, events);
  if (s.koniec !== null) return;

  // Opatrovateľka (Furt, v9.1) platí, kým leží v línii — po návrate kariet by tam už nebola.
  const opatrovatelky = ([0, 1] as const).map((p) => opatrovatelkyHraca(data, s as GameState, p));

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
      // Vdova a Hrobár (Konflikt v7) posielajú kartu z hry, Snúbenica k sebe.
      if (b.spalit.includes(placed.card.uid) || placed.poBitkeZHry === true) continue;
      const karta = placed.card as DeepMutable<CardInstance>;
      if (doRukyPoBitke.has(karta.uid)) hrac(s, placed.playedBy as PlayerId).ruka.push(karta);
      else hrac(s, (placed.poBitkeK ?? placed.playedBy) as PlayerId).odhadzovaci.push(karta);
    }
  }
  s.strany = [[], []];

  // Nepriznaná Cirhóza v ruke ide po bitke do odhadzovacieho balíčka (v5 bod 8,
  // Michal 2026-10-25): kto ju neprizná hneď, riskuje, že sa mu do konca hry
  // nevráti do ruky a na konci ho bude stáť body (ráta sa aj v balíčkoch).
  // Absťák (v9.1) tiež — priznať sa nedá, ostáva v balíčku a ťahá sa znova.
  for (const p of [0, 1] as const) {
    const cirhozy = s.hraci[p].ruka.filter((k) => k.defId === "cirhoza");
    const abstaky = s.hraci[p].ruka.filter((k) => k.defId === "abstak");
    if (cirhozy.length + abstaky.length === 0) continue;
    hrac(s, p).ruka = s.hraci[p].ruka.filter((k) => k.defId !== "cirhoza" && k.defId !== "abstak");
    hrac(s, p).odhadzovaci.push(...cirhozy, ...abstaky);
    if (cirhozy.length > 0) {
      events.push({
        type: "log",
        text: `Hráč ${p + 1}: ${cirhozy.length === 1 ? "nepriznaná Cirhóza z ruky ide" : `${cirhozy.length} nepriznané Cirhózy z ruky idú`} do odhadzovacieho balíčka.`,
      });
    }
    if (abstaky.length > 0) {
      events.push({ type: "log", text: `Hráč ${p + 1}: ${abstaky.length === 1 ? "Absťák z ruky ide" : `${abstaky.length} Absťáky z ruky idú`} do odhadzovacieho balíčka.` });
    }
  }

  // Víťaz si lokalitu neberie (v6) — karta je už na nástenke (vyplatSpaky).

  // Chuť a Absťák (v9.1, Michal 2026-10-30, §8): kto mal v kole menej nerestí, než je
  // jeho Chuť, dostane kartu Absťák do odhadzovacieho balíčka; potom Chuť = väčšie
  // z (Chuť, neresti kola) − 1, nie pod 0. Súper latku neurčuje. Po poslednej bitke hry
  // nič (návrh #41 A) a výučba Prvá hra Chuť neučí (bezChuti).
  const poslednaBitka = jeFinale(s) || (s.rozpis === undefined && s.lokalityVHre.length === 0);
  if (!poslednaBitka && s.bezChuti !== true) {
    for (const p of [0, 1] as const) koniecKolaChut(s, data, p, opatrovatelky[p] ?? 0, events);
  }
  for (const p of [0, 1] as const) hrac(s, p).nerestiTotoKolo = 0;

  vyplatUdrzanyStrach(s, data, events);

  // Horoskop (Náradie 2026-10-30): klebety z Povier hráča s Horoskopom platia aj v nasledujúcom
  // kole; prenesené z minulého kola týmto kolom končia.
  const prenesene = spojKlebety(...([0, 1] as const).map((p) => (vDedicstve(s as GameState, p, "horoskop") ? (b.klebetyHracov?.[p] as Klebety | undefined) : undefined)));
  if (prenesene === undefined) delete s.klebetyPrenesene;
  else s.klebetyPrenesene = prenesene as DeepMutable<Klebety>;

  const boloFinale = jeFinale(s);
  s.bitkaStav = null;
  s.ciel = null;
  s.cirhozyVKole = [0, 0];
  s.naexVKole = [false, false];
  delete s.kseftRany;
  delete s.kseftyKola;
  delete s.poldeciOtoceneVKole;
  delete s.prilozeniaKu;
  s.pitkyKola = [];

  // Po finále → konečné špaky. Sada bez pinnacle lokalít (testovacia sada do v6,
  // bez rozpisu úrovní) finále nemá — hra skončí po poslednej lokalite.
  if (boloFinale || (s.rozpis === undefined && s.lokalityVHre.length === 0)) {
    zaverecneBodovanie(s, data, events, boloFinale);
    return;
  }

  // Ďalšie kolo: útočníkom je porazený; po sekere ostáva ten istý.
  s.kolo += 1;
  if (s.rozpis !== undefined && s.kolo > s.lokalitCelkom) {
    // Finále na pinnacle (v7, Michal 2026-10-27): útočí zaostávajúci (menej špakov),
    // pri rovnosti porazený poslednej bitky, po sekere ostáva útočník. Obranca —
    // ten, kto vedie — vyberie a natočí pinnacle lokalitu ako každý cieľ.
    s.utocnik = utocnikFinale(s.spaky, vitaz, s.utocnik);
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
  if (vitaz !== null) s.utocnik = opponentOf(vitaz);
  s.faza = "volbaCiela";
  events.push({ type: "faza", faza: "volbaCiela" });
  events.push({ type: "log", text: `Kolo ${s.kolo}: útočí hráč ${s.utocnik + 1}.` });
  dolejNaZaciatkuKola(s, events);
  doberPoBitke(s, events);
}

/**
 * Útočník finále (Michal 2026-10-27, mení §14b): zaostávajúci — hráč s menej
 * špakmi; pri rovnosti porazený poslednej bitky, po sekere ostáva útočník.
 */
export function utocnikFinale(spaky: readonly [number, number], vitazPoslednej: PlayerId | null, utocnik: PlayerId): PlayerId {
  if (spaky[0] !== spaky[1]) return spaky[0] < spaky[1] ? 0 : 1;
  return vitazPoslednej !== null ? opponentOf(vitazPoslednej) : utocnik;
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

/** Špaky za väzňov hráča p po finále (v9): podľa poradia zajatia v celej partii. */
export function spakyZaVaznov(state: { readonly vazni: readonly Vazen[] }, p: PlayerId): number {
  return vazniHraca(state, p).reduce((a, v) => a + (KONSTANTY.SPAKY_ZA_VAZNOV[v.poradie - 1] ?? 0), 0);
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
function zaverecneBodovanie(s: MutState, _data: GameData, events: Event[], poFinale: boolean): void {
  const cirhozy: [number, number] = [nepriznaneCirhozy(s.hraci[0] as PlayerState), nepriznaneCirhozy(s.hraci[1] as PlayerState)];
  const vykupne: [Vykupne, Vykupne] = [vykupneHraca(s.hraci[0]), vykupneHraca(s.hraci[1])];
  // Väzni (v9): špaky podľa poradia zajatia v celej partii — 8 / 6 / 4 / 2.
  const zaVaznov: [number, number] = [spakyZaVaznov(s as GameState, 0), spakyZaVaznov(s as GameState, 1)];
  for (const p of [0, 1] as const) {
    if (zaVaznov[p] > 0) {
      s.spaky[p] += zaVaznov[p];
      const mena = vazniHraca(s as GameState, p).map((v) => `${defOf(_data, v.karta).name} ${KONSTANTY.SPAKY_ZA_VAZNOV[v.poradie - 1] ?? 0}`).join(", ");
      events.push({ type: "log", text: `Hráč ${p + 1}: väzni — plus ${spakov(zaVaznov[p])} (${mena}).` });
    }
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
  const co = poFinale ? "Odohralo sa finále" : "Odohrali sa všetky lokality";
  s.koniec = { vitaz, dovod: `${co}, špaky ${sk(body[0])} : ${sk(body[1])}.`, body, cirhozy, vykupne, vazni: zaVaznov };
  s.faza = "koniec";
  events.push({ type: "koniec", vitaz, dovod: s.koniec.dovod, body });
}

// ---------------------------------------------------------------------------
// Legálne príkazy (pre klienta aj smoke test)

function mozeFajcit(data: GameData, state: GameState, p: PlayerId): boolean {
  const h = state.hraci[p];
  return h.cigarety >= cenaFajceniaHraca(state, p) && dovodZakazuFajcit(data, state, p) === null && jeCoTahat(h.doberaci.length, h.odhadzovaci.length);
}

export function legalCommands(data: GameData, state: GameState, p: PlayerId): Command[] {
  if (!mozeHrat(state, p)) return [];
  if (cakaHasic(state)) return volbyNastupu(data, state);
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
      } else if (d.krok === "zajatie") {
        if (d.naTahu !== p || d.hotovo[p]) break;
        out.push({ type: "bezPokusu" });
        for (const elder of moznePokusy(state, p)) out.push({ type: "pokus", elderId: elder.elderId });
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
        for (const target of cieleVykladania(data, state.strany, p, karta, z.zostavaLimit[p], state.hraci[p].cigarety >= cenaDedicstva(state), cielLokalitaId(state), [false, false])) {
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
        if (vDedicstve(state, p, "kristalova_gula") && state.hraci[p].doberaci.length > 1) {
          out.push({ type: "vizia", vziat: true, druha: true }, { type: "vizia", vziat: false, druha: true });
        }
        break;
      }
      const pitka = state.pitkaStav;
      if (pitka === null) break;
      if (pitka.reakcia === p) {
        // Odpoveď na NA EX (v9.2): jedna karta lícom dole mimo limitu (po súperovi len na druhý kraj), alebo nič.
        out.push({ type: "bezReakcie" });
        for (const karta of state.hraci[p].ruka) {
          for (const target of cieleOdpovede(data, state, p, karta)) out.push({ type: "place", uid: karta.uid, target });
        }
        break;
      }
      // Krčma: kým je NA EX možné a poldeci plný, skončiť Pitku sa nedá.
      if (!krcmaVyzaduje(data, state, p)) out.push({ type: "skipNaex" });
      for (const uid of moznostiNaex(data, state, p)) out.push({ type: "naex", uid });
      if (mozeFajcit(data, state, p)) out.push({ type: "smoke", pocet: 1 });
      if (state.hraci[p].cigarety >= barterCena(data, state, p)) {
        out.push({ type: "barter" });
      }
      if (
        state.hraci[p].cigarety >= KONSTANTY.REFILL_CENA &&
        state.hraci[p].poldeciVypite > 0 &&
        !doliatieZakazane(state, p) &&
        !jednotaZakazuje(state, p)
      ) {
        out.push({ type: "refillPoldeci" });
      }
      out.push(...moznostiKseftu(data, state, p), ...moznostiKseftuVazna(data, state, p), ...moznostiUplatku(data, state, p));
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
        for (const id of ["cirhoza", "abstak"]) {
          const karta = state.hraci[p].ruka.find((k) => k.defId === id);
          if (karta !== undefined) out.push({ type: "kar", uid: karta.uid });
        }
      } else if (b.krok === "benzinka") {
        const obcania = obcaniaVLinii(state, data, p).map((o) => o.card.uid);
        for (const uids of okna(obcania, b.benzinkaZostava[p])) out.push({ type: "benzinka", uids });
      } else if (b.krok === "cintorin") {
        out.push({ type: "cintorin", uid: null });
        for (const k of [...state.hraci[p].ruka, ...state.senok]) if (defOf(data, k).tags.includes("Nástroj")) out.push({ type: "cintorin", uid: k.uid });
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
      } else if (b.krok === "povery") {
        if ((b.poveryZostava?.[p] ?? 0) > 0) {
          for (const elder of state.starsi) if (poveraNaStarsieho(state, elder, p)) out.push({ type: "povera", elderId: elder.elderId });
        }
      } else if (b.krok === "pohorsenie") {
        for (const elder of state.starsi) {
          if (pohorsenieMozne(state, p, elder)) out.push({ type: "pohorsenie", elderId: elder.elderId });
          if (pohorsenieMozne(state, p, elder, true)) out.push({ type: "pohorsenie", elderId: elder.elderId, kSebe: true });
        }
      } else if (b.krok === "prebytok") {
        if (b.prebytokZostava < 1 || b.prebytokDrzi === null) break;
        // Markery idú k súperovi držiteľa, aj keď rozdeľuje porazený (v8).
        for (const elder of state.starsi) {
          if (prebytokNaStarsieho(state, elder, b.prebytokDrzi, b.prebytokZostava)) {
            out.push({ type: "prebytok", elderId: elder.elderId });
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

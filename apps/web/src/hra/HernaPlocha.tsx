// Herná obrazovka (M8): partia súpera hore, lokalita v strede, vlastná
// partia a ruka dole, starší a šenok bokom, stav hráčov a log. Karty sú
// v tlačovom vzhľade; ich sloty svietia podľa živého vyhodnotenia línie.
//
// Živé zvýraznenie: evaluateLine z @naex/core sa volá na klientskom pohľade
// pri každom prekreslení — hráč okamžite vidí, čo mu na spoji chytilo.
//
// Karty sa kladú ťahaním (useTahanie) alebo klikom na miesto na konci strany
// a potom na kartu v ruke. Pravý klik všade odstraňuje: vráti kartu z návrhu,
// zruší výber. Položená karta je najprv len NÁVRH
// v tomto prehliadači: dá sa presunúť, vrátiť alebo nahradiť inou a živé
// vyhodnotenie ho už ráta. Na server ide príkaz až po „potvrdiť“ na stole — v
// Zhromaždení celý ťah naraz (Michal 2026-10-19): každá ďalšia karta v tom
// istom ťahu stojí plný poldeci a rozhranie to výrazne ukazuje.

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import type {
  BitkaNaNastenke,
  CardInstance,
  CielVykladania,
  ClientState,
  Command,
  ElderState,
  Event,
  GameData,
  LineEval,
  PlacedCard,
  PlayerId,
  PocitadloBitky as Pocitadlo,
  RekapitulaciaBitky,
  RekapitulaciaPitky,
  VerejnyStav,
  ZobrataVerejne,
} from "@naex/core";
import {
  KONSTANTY,
  MARKER_STRED,
  STUPNICA_ZONY,
  NAZVY_ZON,
  jeCoTahat,
  kartyZaPas,
  spakyTeraz,
  spakov,
  pohorsenieMozne,
  cenaKliatby,
  battleOutcome,
  prebytokNaRozdelenie,
  dopadyNahladu,
  nahladPitky,
  pocet,
  stavPoPatronate,
  tvar,
  vyhladDlhov,
  cieleVykladania,
  cielLokalitaId,
  evaluateLine,
  pocitadloBitky,
  pitkaPredBitkou,
  hrozbaNaex,
  bitkaPoPohorseni,
  nepridelenePohorsenia,
  rozsahPohorseni,
  krokStavby,
  planVykladania,
  barterCena,
  limitBuduceKolo,
  limitZhromazdenia,
  lineState,
  cenaPatronatu,
  kandidatiNaNahradu,
  nahladPatronatu,
  patronatMozny,
  prevahaStran,
  krajeStran,
  dovodZakazuFajcit,
  defOf,
  efektHraca,
  efektPotlaceny,
  jednotaZakazuje,
  cenaFajceniaHraca,
  naexLimitMinuty as naexLimitMinutyHraca,
  sMojimiSkrytymiNaex,
  sPrilozenou,
  nahladNaexNaKartu,
  najhorsiaOdpovedNaNaex,
  cenaTahu,
  nahladPosunuMarkera,
  nahladPosunuPrebytkom,
  nahladVylozenia,
  moznostiNaexVPohlade,
  zablokovaneStrany,
  posunMarker,
  navrhPrebytku,
  printedSides,
  poskodenieBitky,
  rozpisPoskodenia,
  prahVydesenia,
  prahyHraca,
  priazen,
  priazenHraca,
  priazenSila,
  scorecardStarsieho,
  stavKraja,
  stavkaBitky,
  stavZavislosti,
  stranyLokality,
  vidiVolbuSupera,
  hraVPitke,
  cakaSBzdochou,
  vydesil,
} from "@naex/core";
import type { ActionSums, DopadyNahladu, GameState, KliatbyNahladu, NahladNaexNaKartu, PrebytokNahladu, MarkerPos, NahladVylozenia, PolozkaVykladania, Rod, Slot, StranaLinie } from "@naex/core";
import { IkonaAkcie } from "../karta/IkonaAkcie.tsx";
import { KoniecHry } from "./KoniecHry.tsx";
import { LiniaStarsich, LupaStarsieho, stopaStarsieho, ucinokPriazne, type StarsiVLinii, type VolbaPosunu } from "./LiniaStarsich.tsx";
import { PonukaPatronatu, type MoznostPatronatu } from "./PonukaPatronatu.tsx";
import { LetiacaKarta, type Obdlznik, type Prelet } from "./LetiacaKarta.tsx";
import { radSenku } from "./tieneSenku.ts";
import { PocitadloSLiniou } from "./PocitadloBitky.tsx";
import { RekapitulaciaPitkyVrstva, type PiktogramyRekapitulacie } from "./Rekapitulacia.tsx";
import { mediaUrl } from "../lib/api.ts";
import { useStolVHlavicke, useStrazOdchodu } from "../lib/odchod.ts";
import { HlavickaPartie } from "./HlavickaPartie.tsx";
import { skupinyBalicka } from "./doberaciBalicek.ts";
import { SkratkyNapoveda, escVratiNavrh, tlacidloNavratu, useSkratky, type VrstvyPreEsc } from "./skratky.tsx";
import { klucFazy, predvolenyRezim, vyberSpravu, type RezimStran } from "./bar.ts";
import { JednotnyBar, type StranaBaru } from "./JednotnyBar.tsx";
import { polozkySoZaverecnou, tahSoZaverecnou } from "./zaverecnaTahu.ts";
import { polozkyOdkazu, tahOdkazu } from "./odkazTahu.ts";
import { klucPrechodu, medziobrazovka } from "./prechodFazy.ts";
import { Medziobrazovka } from "./Medziobrazovka.tsx";
import { klavesPreskociPauzu, PAUZA_CIELA_MS, pauzaPoVolbeCiela, type PauzaCiela } from "./pauzaCiela.ts";
import type { Sada } from "@naex/tvorba";
import { HernaKarta, vzhladKarty, type HernaKartaProps } from "./HernaKarta.tsx";
import { useZarovnanieLinie } from "./zarovnanieLinie.ts";
import { Lupa, maxMierkaLupy } from "./Lupa.tsx";
import { LUPA_PREDVOLENA, useUcet } from "../lib/ucet.tsx";
import { rezimRadov } from "./spakyAStarsi.ts";
import { Vrstva as VrstvaPanel } from "./Vrstva.tsx";
import {
  AkcieStrany,
  BitkaPanel,
  CenaCigariet,
  HracDoska,
  IkonaKarty,
  IkonaPoldeci,
  OdhadBaru,
  PriebehKola,
  tipOdhadu,
  type BitkaPanelProps,
  type HrozbaBitky,
  type KartyDlazdica,
  type VyhladPitky,
} from "./Panely.tsx";
import { StavkaBitky } from "./StavkaBitky.tsx";
import { UCINOK_KRATKO, UCINOK_PRIAZNE } from "./Scorecard.tsx";
import type { HracInfo, SuhrnAchievementov, ZmenyFrajeriny } from "./useHra.ts";
import { menoVoVete, rodHraca, textHlasky } from "./useHra.ts";
import { NAHRADIT, textNepolozenejKarty } from "./nepolozenaKarta.ts";
import { useBezNaexVBitke, useOdlozenyPrikaz } from "./usePohodlie.ts";
import { useTahanie } from "./useTahanie.ts";
import "./hra.css";
// Až po hra.css — jednotný bar upravuje aj jej pravidlá (os kola, nástroje, rezerva stola).
import "./jbar.css";
import { IkonaSpaku, Nastenka, PocetSpakov, sMinusom, spakyPredBitkou, textSpakovBitky } from "./Spaky.tsx";

/**
 * Čo sa ťahá. `navrh` = karta už leží na stole, ale len ako nepotvrdený návrh.
 * „stavba“ = karta z môjho balíčka stavby šenku (aj keď už leží v zóne).
 */
interface Zdroj {
  readonly karta: CardInstance;
  readonly odkial: "ruka" | "senok" | "lokality" | "stavba";
  readonly navrh: boolean;
}

/** Nepotvrdený ťah — žije len v klientovi, server o ňom nevie. */
type Navrh =
  // Vyloženia z ruky v jednom ťahu: v Zhromaždení aj viac kariet (každá ďalšia
  // za plný poldeci, Michal 2026-10-19), v odpovedi na NA EX jedna.
  | { readonly typ: "vylozenia"; readonly polozky: readonly { readonly uid: number; readonly ciel: CielVykladania }[] }
  // otocena je v ráme hráča 0, presne ako v príkaze chooseLocation.
  | { readonly typ: "lokalita"; readonly uid: number; readonly otocena: boolean }
  // Draft: karty zo šenku presunuté do ruky.
  | { readonly typ: "zoSenku"; readonly uids: readonly number[] };

const CIELE_VYKLADANIA: readonly string[] = ["vlastna", "superova", "priznanie", "dedicstvo"] satisfies CielVykladania[];
const jeCielVykladania = (c: string): c is CielVykladania => CIELE_VYKLADANIA.includes(c);

const POPIS_CIELA: Record<CielVykladania, string> = {
  vlastna: "na tvoju stranu",
  superova: "na súperovu stranu (ostane tvoja)",
  priznanie: "priznať",
  dedicstvo: "do Dedičstva (za cigarety)",
};

/** Cieľ pri preusporiadaní ruky: karta, pred/za ktorú ťahaná karta pôjde. */
/** Ako dlho sa na stole otáča odhalená Záverečná, kým príde rekapitulácia Pitky (Michal 2026-10-27). */
const ODHALENIE_MS = 2200;
const PORADIE = "poradie:";
/** Zóny stavby šenku (Michal 2026-10-16): vľavo Smetisko, vpravo Šenok. */
const SMETISKO = "smetisko";
const BALICEK_STAVBY = "balicekStavby";

/**
 * Čo netreba mať na stole stále — otvára sa ako vrstva cez obrazovku.
 * „vestica“ ukazuje doberacie balíčky, ktoré hráčovi podľa karty odhalil server.
 */
type Vrstva = "senok" | "lokality" | "log" | "vestica" | "karty";
/** Záložky vrstvy Karty (Michal 2026-10-23, #76) — súper ukazuje len Priznané a Dedičstvo. */
type ZalozkaKariet = "balicek" | "odhodene" | "priznane" | "dedicstvo";

/**
 * Pokyn ťahu (Michal 2026-10-21): nadpis a text sú v pilulke na hornej hrane
 * stola, tlačidlá na jeho spodnej hrane — `vlavo` nákupy za cigarety, `stred`
 * pečiatka NA EX! či potvrdenie ťahu (pecatTahu, Michal 2026-10-25), `vpravo`
 * (a všeobecné `tlacidla`) koniec ťahu a vedľajšie voľby.
 */
interface Pokyn {
  readonly nadpis: ReactNode;
  readonly text?: ReactNode;
  readonly tlacidla?: ReactNode;
  readonly vlavo?: ReactNode;
  readonly stred?: ReactNode;
  readonly vpravo?: ReactNode;
}
/** Hrana stola pre ťah s návrhom: pečiatka v strede, vedľajšie voľby vľavo či vpravo. */
interface HranaTahu {
  readonly stred: ReactNode;
  readonly vlavo?: ReactNode;
  readonly vpravo?: ReactNode;
}
/** Výkup zo šrotu: dve karty cez seba (odhadzovací balíček). */
function IkonaSrotu() {
  return (
    <svg className="ikona-srotu" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3.5" y="3" width="11" height="15" rx="2" />
      <rect x="9.5" y="6.5" width="11" height="15" rx="2" />
    </svg>
  );
}

/** Ako dlho sa stôl po prechode fázy ustáli, kým príde medziobrazovka. */
const MEDZIOBRAZOVKA_MS = 400;

/** Šírka karty v ruke — nastavuje aj --ruka-w v hra.css (na mobile menšia). */
const SIRKA_V_RUKE = 120;
const SIRKA_V_RUKE_MOBIL = 72;
/** Pod touto šírkou okna je rozloženie mobilné. */
const MOBIL = 760;
/** Výšky okna, pod ktorými sa stôl zhustí — rovnaké hranice má hra.css (@media max-height). */
const NOTEBOOK = 920;
const NIZKE_OKNO = 720;
/** Partia je stredobod hry — karty 1,5× väčšie než pôvodných 132 px. */
const SIRKA_V_LINII = 198;
/** Dlhá línia sa zmenší na šírku stola, ale nie pod túto šírku karty. */
const SIRKA_V_LINII_MIN = 96;
/**
 * Najmenšia čitateľná karta v línii. Bežné rozlíšenia ju neprekročia (1366 × 650 so
 * 7 kartami ≈ 84 px, 1440 × 800 so zoomom 125 % ≈ 79 px); menšie okno či zoom 150 %
 * prepne stôl na scroll (Michal 2026-10-24).
 */
const SIRKA_CITATELNA = 72;
/** Ako dlho musí karta ostať pod SIRKA_CITATELNA, kým stôl prejde na scroll. */
const ONESKORENIE_SCROLLU_MS = 200;
/** Miesto na klik na konci strany — zlomok šírky karty v línii. */
const MIESTO_VOLBY = 0.42;
/** Karty v šenku a lokalitách — väčšie než kedysi v bočnom paneli. */
const SIRKA_VO_VRSTVE = 150;
/**
 * Nástenka na stole (Michal 2026-10-27): čo okrem karty lokality zaberie výška plste —
 * popolníky, päta, lístok bez karty (víťaz, názov, účtenka) a okraje. Karty lokalít sa
 * ukážu, len keď na ne ostane aspoň NASTENKA_KARTA_MIN; inak lístky v rade bez kariet.
 */
const NASTENKA_BEZ_KARTY = 300;
const NASTENKA_KARTA_MIN = 56;
/** Voľba cieľa: čo okrem kariet lokalít na výber zaberie výška plste (popolníky, päta, okraje). */
const NASTENKA_VOLBA_REZERVA = 150;
/** Výška / šírka karty (54 × 80 mm) — výška línie určuje veľkosť kariet (Stôl bez scrollovania, #67). */
const POMER_KARTY = 80 / 54;
/** Náhradné uid tieňov vzatých kariet šenku (UID_TIENA − miesto) — mimo uid kariet aj Záverečnej. */
const UID_TIENA = -800000;
/** Čo línia zaberá okrem kariet: okraj, popisy strán, rezerva posuvníka. */
const PRIDAVOK_LINIE = 74;
/** To isté na nízkom okne (NOTEBOOK): jeden tenký riadok nadpisov, menšie okraje (hra.css). */
const PRIDAVOK_NOTEBOOK = 38;
/** Pod NIZKE_OKNO: spodný okraj línie leží pod hranou stola (hra.css). */
const PRIDAVOK_NIZKE = 28;
/** Najmenší posun kariet akcia ku akcii (zlomok výšky karty), kým ho línia nezmeria. */
const REZERVA_POSUNU = 0.3;

/** Pravý klik = odstrániť / zrušiť (Michal 2026-10-20) — bez kontextovej ponuky prehliadača. */
function pravyKlik(fn: (() => void) | undefined): ((e: React.MouseEvent) => void) | undefined {
  return fn === undefined
    ? undefined
    : (e) => {
        e.preventDefault();
        e.stopPropagation();
        fn();
      };
}

/** Dĺžka doznievania lupy po odchode myši — rovnaká ako animácia .lupa.doznieva v hra.css. */
const DOZNIEVANIE_LUPY_MS = 160;
/** Ako dlho ostane hláška „karta sa nepoložila“ — stačí na prečítanie, potom nezavadzia. */
const ZOBRAZENIE_CHYBY_TAHANIA_MS = 6000;
/**
 * Kam s hláškou „karta sa nepoložila“ (w × h): k bodu pustenia — nad, pod, vedľa,
 * alebo do rohu plste —, kde najmenej zakryje ciele ťahu, lokalitu, pečiatky
 * a bary (UI inšpekcia 2026-10-24: nad bodom pod líniou zakryla líniu aj „+“).
 * Pri rovnakom skóre bližšie k bodu. Nad plsť nie — tam je pokyn a pás kola.
 */
function polohaChybyTahania(bod: { readonly x: number; readonly y: number }, w: number, h: number): { readonly x: number; readonly y: number } {
  const plst = document.querySelector(".stol-plst")?.getBoundingClientRect();
  // Pilulka pokynu presahuje na hornú hranu plste.
  const hore = Math.max(8, (plst?.top ?? 0) + 8);
  const dole = Math.max(hore, window.innerHeight - 8 - h);
  const vpravo = Math.max(16, window.innerWidth - 16 - w);
  const medzera = 14;
  const kandidati = [
    [bod.x - w / 2, bod.y - h - medzera],
    [bod.x - w / 2, bod.y + medzera],
    [bod.x - w - medzera, bod.y - h / 2],
    [bod.x + medzera, bod.y - h / 2],
    ...(plst === undefined
      ? []
      : [
          [plst.left + 8, plst.top + 8],
          [plst.right - 8 - w, plst.top + 8],
          [plst.left + 8, plst.bottom - 8 - h],
          [plst.right - 8 - w, plst.bottom - 8 - h],
        ]),
  ].map(([x = 0, y = 0]) => ({ x: Math.min(Math.max(x, 16), vpravo), y: Math.min(Math.max(y, hore), dole) }));
  const vahy: readonly (readonly [string, number])[] = [
    [".linia .kl, .miesto-volby, .linia-skupina.lokalita, .stol-hrana .pecat, .stol-hrana button, [data-vyucba-bublina]", 10],
    [".doska, .linia-stav, .jbar", 3],
    [".ruka .kl", 1],
  ];
  const prekazky = vahy.map(([sel, vaha]) => ({ vaha, r: [...document.querySelectorAll(sel)].map((e) => e.getBoundingClientRect()) }));
  const skore = (p: { readonly x: number; readonly y: number }): number =>
    prekazky.reduce(
      (s, { vaha, r }) =>
        s + vaha * r.reduce((t, b) => t + Math.max(0, Math.min(p.x + w, b.right) - Math.max(p.x, b.left)) * Math.max(0, Math.min(p.y + h, b.bottom) - Math.max(p.y, b.top)), 0),
      0,
    ) + Math.hypot(p.x + w / 2 - bod.x, p.y + h / 2 - bod.y);
  return kandidati.reduce((naj, p) => (skore(p) < skore(naj) ? p : naj));
}
/** Šírka lupy staršieho z bodového baru — vojde sa aj na notebook 1366 × 650 a neprekryje celý stôl. */
const SIRKA_LUPY_STARSIEHO = 400;

function kariet(n: number): string {
  return n === 1 ? "1 kartu" : n >= 2 && n <= 4 ? `${n} karty` : `${n} kariet`;
}

/** Podmet so slovesom — „zvyšné 4 karty pôjdu“, „zvyšných 5 kariet pôjde“. */
function zvysnePojdu(n: number): string {
  return n === 1 ? "zvyšná 1 karta pôjde" : n >= 2 && n <= 4 ? `zvyšné ${n} karty pôjdu` : `zvyšných ${n} kariet pôjde`;
}

function cigariet(n: number): string {
  return n === 1 ? "1 cigaretu" : n >= 2 && n <= 4 ? `${n} cigarety` : `${n} cigariet`;
}

type Mode =
  | { typ: "ziadny" }
  // NA EX na dva kroky (dizajn hra-nezrovnalosti-20261021-1229, UX N3): vyber kartu, potom potvrď.
  | { typ: "naexCiel"; uid: number | null }
  // Patronát (Michal 2026-10-20): vybraný starší a karta z ruky lícom dole na jeho scorecard.
  | { typ: "patronat"; elderId: string; uid: number | null }
  // Výbery viacerých kariet: Benzínka (Občania v línii), Veštica.
  | { typ: "vyber"; uids: readonly number[] }
  | { typ: "vestica"; moja: number | null; jeho: number | null }
  | { typ: "vykup" };

// Hra beží na sade svojej miestnosti; pomocné funkcie nižšie ju čítajú odtiaľto.
let DATA: GameData;

function menoKarty(defId: string): string {
  return DATA.cards.get(defId)?.name ?? defId;
}

export interface HernaPlochaProps {
  readonly view: ClientState;
  readonly data: GameData;
  readonly sada: Sada;
  readonly hraci: readonly [HracInfo | null, HracInfo | null];
  readonly log: readonly string[];
  /** Udalosti poslednej správy so stavom — účet Pitky a bitky. */
  readonly udalosti?: { readonly id: number; readonly events: readonly Event[] };
  readonly chyba: string | null;
  readonly zrusChybu?: () => void;
  readonly superPripojeny: boolean;
  /** Odkedy je súper odpojený (useHra) — odpočet kontumácie v menu Partia. */
  readonly superOdpojenyOd?: number | null;
  readonly kod: string;
  readonly cmd: (c: Command) => void;
  readonly opustit: () => void;
  /** Zmena Frajeriny po dohraní (príde zo servera po zápise do archívu). */
  readonly frajerina?: ZmenyFrajeriny | null;
  /** Achievementy z partie (súhrn po konci) — okno konca ich ukáže. */
  readonly achievementy?: SuhrnAchievementov | null;
  readonly kontumacia?: () => void;
  /** Ovládanie navyše v hlavičke webu pred menom súpera (soundboard Melichara). */
  readonly vHlavicke?: ReactNode;
  /** Prehrávač dohratej partie (roadmapa #18): ovládanie krokov nahradí v hlavičke spojenie, vzdanie a odchod. */
  readonly prehravanie?: ReactNode;
  /** Počítadlo bitky beží / skončilo — pečiatka momentu z bitky (Momenty) počká na jeho koniec. */
  readonly onPocitadlo?: (bezi: boolean) => void;
  /** Výučba „Prvá hra“: okno konca partie neukazovať — záver povie Melichar v bubline. */
  readonly bezOknaKonca?: boolean;
  /** Výučba „Prvá hra“ beží — pas bez odpočtu na vrátenie, „končím“ bez druhého potvrdenia. */
  readonly vyucba?: boolean;
  /**
   * Výučba: id kroku, ktorý po ťahu čaká na „ďalej“ s textom Melichara. Bitka, ktorú jeho ťah
   * spustil, sa prehrá až po zmene kroku — inak bežala pod textom, ktorý sa nedal prečítať (U3).
   */
  readonly zadrzBitku?: string | null;
  /** Výučba: ťah, ktorý krok čaká — „potvrdiť“ sa odomkne, až keď na stole leží všetko z neho. */
  readonly vyucbaOcakava?: Command | null;
  /** Výučba: ťah hráča teraz spraví hra (krok „auto“) — stôl nevyzýva hráča a nereaguje na neho. */
  readonly zaHracaHra?: boolean;
  /**
   * Výučba: hráč si stavbu šenku len skúša (Michal 2026-10-25) — karty smie presúvať, no
   * potvrdiť nie je; rozloženie spraví Melichar v ďalšom kroku.
   */
  readonly naneisto?: boolean;
  /**
   * Výučba: kroky po bitke hovoria o starších a stupnici, hoci partia je už pri voľbe cieľa
   * 2. kola — línia starších ostane na stole (bar bežný, nie bodový) namiesto výberu lokality.
   */
  readonly ukazStarsich?: boolean;
}

/** Názvy fáz pre titulok karty prehliadača. */
const NAZOV_FAZY: Readonly<Record<string, string>> = {
  volbaCiela: "Cieľ kola",
  draft: "Šenok",
  zhromazdenie: "Zhromaždenie",
  pitka: "Pitka",
  bitka: "Bitka",
};

/** Účet Pitky — čo vyhodnotenie pripísalo (udalosť pitkaVysledok). */
interface UcetPitky {
  readonly kolo: number;
  readonly pitka: number;
  readonly cirhozy: readonly [number, number];
  readonly dlhy: readonly [number, number];
  readonly cigarety: readonly [number, number];
}

/** Vrstva po vyhodnotení: rekapitulácia Pitky, alebo Počítadlo bitky s rekapituláciou. */
type VrstvaVyhodnotenia =
  | { readonly druh: "pitka"; readonly r: RekapitulaciaPitky; readonly nadpis: string }
  | { readonly druh: "bitka"; readonly p: Pocitadlo; readonly stol: ClientState; readonly linia: LineEval; readonly rekap: RekapitulaciaBitky | null };

/** Účet bitky — výsledok, lokality, posuny markerov a body pred a po. */
interface UcetBitky {
  readonly kolo: number;
  readonly lokalita: string;
  readonly tuhe: readonly [number, number];
  readonly vitaz: PlayerId | null;
  readonly prebytok: number;
  readonly prebytokNaRozdelenie: number;
  readonly prebytokDrzi: PlayerId | null;
  /** Záznam bitky na nástenke (v6): špaky za bitku, za starších, Exekútor, sekera. */
  readonly bitka: BitkaNaNastenke | null;
  readonly posuny: readonly { readonly meno: string; readonly pred: number; readonly po: number }[];
  /** Špaky v popolníkoch pred bitkou. */
  readonly spakyPred: readonly [number, number];
}

export function HernaPlocha({
  view: viewZoServera,
  data,
  sada,
  hraci,
  log,
  udalosti,
  chyba,
  zrusChybu,
  superPripojeny,
  superOdpojenyOd = null,
  kod,
  cmd,
  opustit,
  frajerina = null,
  achievementy = null,
  kontumacia,
  vHlavicke,
  prehravanie,
  onPocitadlo,
  bezOknaKonca,
  vyucbaOcakava,
  vyucba,
  zadrzBitku = null,
  zaHracaHra = false,
  naneisto = false,
  ukazStarsich = false,
}: HernaPlochaProps) {
  DATA = data;
  // Odložené zobrazenie (Michal 2026-10-27): kým hráč pozerá odhalenú Záverečnú a rekapituláciu
  // Pitky, súperov ďalší ťah (napr. nová Záverečná na tú istú stranu) sa nekreslí — server ho
  // už odohral, stôl ho ukáže až po Ďalej.
  const [zadrzanyView, setZadrzanyView] = useState<ClientState | null>(null);
  const view = zadrzanyView ?? viewZoServera;
  const ja = view.ja;
  // Bot je vo vete „Bot Teta Gizka“; tvary podľa rodu hráča (Michal 2026-10-22).
  const menoHraca = (p: PlayerId): string => menoVoVete(hraci[p], p);
  const rodHracaP = (p: PlayerId): Rod => rodHraca(hraci[p]);
  const karta = (props: Omit<HernaKartaProps, "sada" | "data"> & { readonly key?: number }) => {
    const { key, ...rest } = props;
    return <HernaKarta key={key} sada={sada} data={data} {...rest} />;
  };
  const super_ = (ja === 0 ? 1 : 0) as PlayerId;
  const [mode, setMode] = useState<Mode>({ typ: "ziadny" });
  const [vrstva, setVrstva] = useState<Vrstva | null>(null);
  // Čí popolník nástenka zvýrazní (Michal 2026-10-27): Špaky súpera otvoria jeho, hlavička tvoju.
  const [nastenkaPre, setNastenkaPre] = useState<PlayerId>(ja);
  useEffect(() => {
    if (vrstva !== "lokality") setNastenkaPre(ja);
  }, [vrstva, ja]);
  /** Lokalita nakliknutá vo vrstve lokalít — tlačidlo „umiestniť“ ju položí na stôl. */
  const [vyberLokality, setVyberLokality] = useState<number | null>(null);
  /** Kedy sme naposledy automaticky otvorili vrstvu — raz za fázu, nie pri každom prekreslení. */
  const autoVrstva = useRef("");
  // Obrazovka konca hry sa dá zavrieť a pozrieť si stôl.
  const [koniecZavrety, setKoniecZavrety] = useState(false);
  // Koľko riadkov logu hráč už videl — zvyšok svieti ako nové na tlačidle.
  const [videnyLog, setVidenyLog] = useState(() => log.length);
  useEffect(() => {
    if (vrstva === "log") setVidenyLog(log.length);
  }, [vrstva, log.length]);
  // Stavbu šenku hrajú obaja naraz — „môžem hrať“ nie je vždy „som na ťahu“.
  // Ťah, ktorý vo výučbe spraví hra za hráča, nie je hráčov — inak stavba šenku vyzývala
  // „Vyber 4 karty na Smetisko“ s POTVRDIŤ, kým hra stavala (playtest výučby 20261025, krok 6).
  const somNaTahu = view.mozemHrat && !zaHracaHra;
  const draft = view.draftStav;
  const stavim = view.faza === "draft" && draft?.krok === "stavba";
  // Živý odhad záverečného bodovania — hráč musí stále vidieť, za čo dostane body.
  // v6: špaky (spolu = keby hra skončila teraz), za starších a odhad.
  const body = useMemo(() => spakyTeraz(view), [view]);
  // Šírka okna — na mobile menšia ruka a predvolene zbalení starší.
  const [sirkaOkna, setSirkaOkna] = useState(() => (typeof window === "undefined" ? 1600 : window.innerWidth));
  const [vyskaOkna, setVyskaOkna] = useState(() => (typeof window === "undefined" ? 1000 : window.innerHeight));
  useEffect(() => {
    const zmena = (): void => {
      setSirkaOkna(window.innerWidth);
      setVyskaOkna(window.innerHeight);
    };
    window.addEventListener("resize", zmena);
    return () => window.removeEventListener("resize", zmena);
  }, []);
  const mobil = sirkaOkna < MOBIL;
  // Dotyková obrazovka bez myši — kartu v ruke zväčší ťuknutie (hover tam nie je).
  const jeDotyk = useMemo(() => typeof window !== "undefined" && window.matchMedia?.("(hover: none)").matches === true, []);
  // Nízky notebook (MacBook 14" ≈ 860 px, 13" s lištou ≈ 800, 1366 × 650): menšia ruka nechá výšku stolu.
  const sirkaVRuke = mobil ? SIRKA_V_RUKE_MOBIL : vyskaOkna < NIZKE_OKNO ? 84 : vyskaOkna < NOTEBOOK ? 96 : SIRKA_V_RUKE;
  // Časová os kola sa lepí pod hlavičku webu — tá je tiež prilepená, preto jej výška.
  const [vyskaHlavicky, setVyskaHlavicky] = useState(0);
  useEffect(() => {
    const el = document.querySelector<HTMLElement>(".hlavicka");
    if (el === null) return;
    const zmeraj = () => setVyskaHlavicky(el.offsetHeight);
    zmeraj();
    const ro = new ResizeObserver(zmeraj);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // Kým partia beží, klik na menu v hlavičke sa najprv opýta (Michal 2026-10-23); prehrávač nestráži.
  useStrazOdchodu(view.koniec === null && prehravanie === undefined, kod, vyucba === true);
  // Pri stole hlavička nemá menu webu (Michal 2026-10-26, #23); prehrávač ho nechá.
  useStolVHlavicke(prehravanie === undefined);
  // Ovládanie partie (spojenie, kontumácia, vzdať sa, odísť) je v hlavičke webu — Layout má preň miesto.
  const [slotHlavicky, setSlotHlavicky] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setSlotHlavicky(document.getElementById("hlavicka-hra"));
  }, []);
  const liniaRef = useRef<HTMLDivElement>(null);
  useZarovnanieLinie(liniaRef);
  // Lepiaca hrana stola má zmysel, len keď je línia nad rukou aspoň trochu vidno.
  // Keď stôl leží skoro celý pod okrajom okna, hrana by sa vysunula cez pilulku
  // pokynu a pás kola (Pitka na 1600 × 1000) — vtedy ostane na stole.
  const [liniaVidno, setLiniaVidno] = useState(true);
  useEffect(() => {
    const el = liniaRef.current;
    if (el === null || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([z]) => setLiniaVidno(z?.isIntersecting ?? true), { rootMargin: "0px 0px -320px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  // Zväčšenie karty (lupa a ruka) podľa nastavenia v profile.
  const mierkaLupy = (useUcet().ja?.lupa ?? LUPA_PREDVOLENA) / 100;
  // Klávesové skratky v partii (Michal 2026-10-22, roadmapa #19) — vypínač v profile.
  const skratky = useSkratky(useUcet().ja?.skratky !== false && view.koniec === null, (k) => {
    // N bez vybranej karty nič nerobil — nováčik nevedel prečo (playtest výučby U6).
    if (k !== "n" || !naexMozny || mode.typ === "naexCiel") return;
    const r = liniaRef.current?.getBoundingClientRect();
    setChybaTahania({ text: "Najprv vyber kartu so značkou NA EX v línii — potom NA EX! alebo N.", x: r === undefined ? window.innerWidth / 2 : r.left + r.width / 2, y: r === undefined ? window.innerHeight / 2 : r.top + r.height / 2 });
  });
  const lokalitaRef = useRef<HTMLDivElement>(null);
  // Línia môže byť dlhá — lokalitu drž v strede pohľadu.
  const pocetVLinii = view.strany[0].length + view.strany[1].length;
  // Dlhá línia sa zmenší na šírku stola (karty sa nezrežú), až po minimum.
  const [sirkaLinie, setSirkaLinie] = useState(0);
  useEffect(() => {
    const el = liniaRef.current;
    if (el === null) return;
    const ro = new ResizeObserver(([z]) => setSirkaLinie(Math.floor(z?.contentRect.width ?? 0)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // Výška stola (#67): stôl dostane, čo ostane z okna, a karty sa zmenšia tak, aby sa
  // línia zmestila aj s posunom akcia ku akcii — ten línia zmeria po zarovnaní.
  const plstRef = useRef<HTMLDivElement>(null);
  const [vyskaPlste, setVyskaPlste] = useState(0);
  useEffect(() => {
    const el = plstRef.current;
    if (el === null) return;
    const ro = new ResizeObserver(([z]) => setVyskaPlste(Math.floor(z?.contentRect.height ?? 0)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // Voľba cieľa a draft ležia vo vrstve na stole: karty sa zväčšia na jej výšku.
  // Réžia = všetko v paneli okrem kariet (hlavička, popisy, rad šenku zatiaľ bez kariet);
  // zmeria sa po vykreslení a karty sa prepočítajú — ako rezerva posunu línie.
  const [vrstvaFazyEl, setVrstvaFazyEl] = useState<HTMLDivElement | null>(null);
  const [vyskaVrstvy, setVyskaVrstvy] = useState(0);
  // Réžia v rámci kroku len rastie: keď sa rad kariet pri úzkom okne zalomí,
  // réžia skočí, karty sa zmenšia, rad sa odlomí a réžia klesne — pri voľnom
  // nastavovaní sa to točilo donekonečna (React #185 pod ≈ 1300 px, Bugfixing
  // 2026-10-24). Nový krok alebo iný rozmer vrstvy či línie (okno, zoom) začne
  // meranie odznova — až po prepočte rozloženia, inak by ostala réžia z menšieho okna.
  const [reziaDraftu, setReziaDraftu] = useState(0);
  useEffect(() => setReziaDraftu(0), [view.faza, draft?.krok, vyskaVrstvy, sirkaLinie]);
  useEffect(() => {
    if (vrstvaFazyEl === null) return;
    const ro = new ResizeObserver(([z]) => setVyskaVrstvy(Math.floor(z?.contentRect.height ?? 0)));
    ro.observe(vrstvaFazyEl);
    return () => ro.disconnect();
  }, [vrstvaFazyEl]);
  useLayoutEffect(() => {
    const panel = vrstvaFazyEl?.firstElementChild;
    if (!(panel instanceof HTMLElement)) return;
    const hore = panel.getBoundingClientRect().top;
    let spodok = hore;
    for (const c of panel.children) spodok = Math.max(spodok, c.getBoundingClientRect().bottom);
    const obsah = spodok - hore + parseFloat(getComputedStyle(panel).paddingBottom);
    let karty = 0;
    for (const kl of panel.querySelectorAll<HTMLElement>(":is(.stavba-rad, .draft-karty:not(.stavba-senok-zatial *)) .kl, .stavba-zona-miesto")) karty = Math.max(karty, kl.offsetHeight);
    const zatial = panel.querySelector<HTMLElement>(".stavba-senok-zatial .kl")?.offsetHeight ?? 0;
    if (karty === 0) return;
    const r = Math.round(obsah - karty - zatial);
    if (r > reziaDraftu + 3) setReziaDraftu(r);
  });
  const [rezervaPosunu, setRezervaPosunu] = useState(REZERVA_POSUNU);
  useEffect(() => setRezervaPosunu(REZERVA_POSUNU), [view.kolo]);
  useLayoutEffect(() => {
    const l = liniaRef.current;
    if (l === null) return;
    let posun = 0;
    let vyska = 0;
    for (const el of l.querySelectorAll<HTMLElement>(".partia-rad > *")) {
      posun = Math.max(posun, parseFloat(el.style.marginTop) || 0);
      const kl = el.querySelector<HTMLElement>(".kl");
      if (kl !== null) vyska = Math.max(vyska, kl.offsetHeight);
    }
    if (vyska === 0) return;
    const r = Math.ceil((posun / vyska) * 20) / 20;
    if (r > rezervaPosunu) setRezervaPosunu(r);
  });
  // Kladiem kartu z ruky do línie: v Zhromaždení (kým nepasujem) alebo v odpovedi na NA EX.
  const vykladam =
    somNaTahu &&
    view.koniec === null &&
    ((view.faza === "zhromazdenie" && view.zhromazdenieStav !== null && !view.zhromazdenieStav.pasoval[ja]) ||
      (view.faza === "pitka" && view.pitkaStav?.reakcia === ja));
  // +2: karta v strede a voľné miesto na koniec strany pri vykladaní;
  // pri vykladaní ležia na oboch koncoch úzke miesta na klik (MIESTO_VOLBY).
  // Pod NOTEBOOK skryje hra.css riadok „na prebitie“ a popis strán pod lokalitou, nadpisy krajov sú tenšie.
  // Stôl so scrollom (Michal 2026-10-24): keď by karty v línii klesli pod čitateľnú
  // veľkosť (malé okno, zoom 150 %), partia prestane byť na výšku okna, karty ostanú
  // SIRKA_CITATELNA a stránka sa scrolluje. Výška stola sa vtedy riadi kartami — preto
  // každá zmena okna (aj zoom) vráti stôl na výšku okna a premeria ho; na scroll prejde,
  // až keď karta ostane pod minimom chvíľu (prvé rozloženie po načítaní ešte skáče).
  const [stolScroll, setStolScroll] = useState(false);
  useEffect(() => setStolScroll(false), [sirkaOkna, vyskaOkna]);
  const sirkaPodlaVysky = stolScroll
    ? SIRKA_CITATELNA
    : mobil || vyskaPlste === 0
      ? SIRKA_V_LINII
      : Math.floor((vyskaPlste - (vyskaOkna < NIZKE_OKNO ? PRIDAVOK_NIZKE : vyskaOkna < NOTEBOOK ? PRIDAVOK_NOTEBOOK : PRIDAVOK_LINIE)) / (POMER_KARTY * (1 + rezervaPosunu)));
  useEffect(() => {
    // Výučba stôl na scroll neprepína: návrh ťahu so spojom (vysunuté karty, pokyn v dvoch riadkoch
    // úzkeho stola) ho prepol natrvalo a pás hráča s rukou ostali pod okrajom okna (UI inšpekcia
    // 20261024-napovedy, N4). Karty ostávajú aj tak na SIRKA_CITATELNA a do plste sa vojdú.
    if (mobil || vyucba === true || stolScroll || vyskaPlste === 0 || sirkaPodlaVysky >= SIRKA_CITATELNA) return;
    // Skrytá línia (starší, voľba cieľa, draft): plsť zmenší pokyn s kartami (patronát),
    // nie karty línie — scroll by plsť zrazil na pár px (UI inšpekcia 20261024-nahlad, N1).
    if (plstRef.current?.classList.contains("linia-skryta") === true) return;
    const t = setTimeout(() => setStolScroll(true), ONESKORENIE_SCROLLU_MS);
    return () => clearTimeout(t);
  }, [mobil, vyucba, stolScroll, vyskaPlste, sirkaPodlaVysky]);
  const sirkaVLinii =
    sirkaLinie === 0
      ? Math.min(SIRKA_V_LINII, sirkaPodlaVysky)
      : // Minimum platí pre šírku (dlhá línia sa radšej posúva); výška stola ho prebije —
        // na nízkom notebooku sa karty inak orezali dole (Michal 2026-10-23) — no nie pod
        // čitateľnú veľkosť: tam už stôl prejde na scroll.
        Math.max(
          SIRKA_CITATELNA,
          Math.min(
            sirkaPodlaVysky,
            Math.max(SIRKA_V_LINII_MIN, Math.min(SIRKA_V_LINII, Math.floor((sirkaLinie - 60) / (pocetVLinii + 2 + (vykladam ? 2 * MIESTO_VOLBY : 0))) - 12)),
          ),
        );
  useEffect(() => {
    const l = liniaRef.current;
    const lok = lokalitaRef.current;
    if (l === null || lok === null) return;
    l.scrollTo({ left: lok.offsetLeft + lok.offsetWidth / 2 - l.clientWidth / 2, behavior: "smooth" });
  }, [pocetVLinii, view.ciel]);

  // ---- návrh ťahu ----------------------------------------------------------
  const [navrh, setNavrh] = useState<Navrh | null>(null);
  // Nová fáza, ťah alebo krok bitky — starý návrh už neplatí.
  const klucTahu = `${view.kolo}|${view.faza}|${view.naTahu}|${view.bitkaStav?.krok ?? ""}|${draft?.krok ?? ""}|${draft?.balicekPocet[ja] ?? ""}`;
  useEffect(() => setNavrh(null), [klucTahu]);
  // Pokyn ťahu (pilulka na stole, v drafte pätička šenku) nesmie pri novom ťahu
  // ostať pod pripnutou rukou (UI inšpekcia U04) — stránka sa posunie len
  // toľko, aby bol nad rukou; keď ho hráč vidí, nehýbe sa.
  useEffect(() => {
    if (!somNaTahu) return;
    const ciel = document.querySelector<HTMLElement>(view.faza === "draft" ? ".draft-paticka" : ".linia-stav");
    if (ciel === null) return;
    const ruka = document.querySelector<HTMLElement>(".ruka")?.getBoundingClientRect().height ?? 0;
    const dole = window.innerHeight - ruka;
    const r = ciel.getBoundingClientRect();
    if (r.top > 0 && r.bottom > dole) window.scrollBy({ top: r.bottom - dole + 12, behavior: "smooth" });
    // Len pri novom ťahu — nie pri každom prekreslení.
  }, [klucTahu, somNaTahu]);
  // Nevratné kroky s inline potvrdením (dizajn UX N1): „hotovo“ v Pitke, keď
  // ním hráč vzdáva možné NA EX, a „pasovať“, keď ešte môže vykladať.
  const [potvrdenie, setPotvrdenie] = useState<"hotovo" | null>(null);
  useEffect(() => setPotvrdenie(null), [klucTahu, view.pitkaCislo]);
  // „Skončiť Pitku“ bez NA EX chce druhý klik — keď ho hráč neurobí, tlačidlo sa po chvíli vráti.
  useEffect(() => {
    if (potvrdenie === null) return;
    const t = setTimeout(() => setPotvrdenie(null), 4000);
    return () => clearTimeout(t);
  }, [potvrdenie]);
  useEffect(() => {
    if (potvrdenie === null && mode.typ !== "naexCiel") return;
    const klaves = (e: KeyboardEvent): void => {
      if (e.key !== "Escape") return;
      setPotvrdenie(null);
      setMode((m) => (m.typ === "naexCiel" ? { typ: "ziadny" } : m));
    };
    window.addEventListener("keydown", klaves);
    return () => window.removeEventListener("keydown", klaves);
  }, [potvrdenie, mode.typ]);
  // Stavba šenku (Michal 2026-10-22): hráč vyberie len karty na Smetisko
  // (naspodok spoločného balíčka) — zvyšok balíčka ide do Šenku sám, triediť
  // do dvoch zón netreba. Koľko na Smetisko, určuje jadro (krokStavby: polovica
  // nadol — pri 8 kartách 4, pri menšom balíčku menej). Server dostane celé rozdelenie.
  const [odhodStavby, setOdhodStavby] = useState<readonly number[]>([]);
  useEffect(() => setOdhodStavby([]), [klucTahu]);
  const krokSt = krokStavby(draft?.krok === "stavba" ? draft.mojBalicek.length : 0);
  /** Karta na Smetisko (alebo späť do balíčka); na plné Smetisko ustúpi posledná karta. */
  const doZonyStavby = (uid: number, naSmetisko: boolean): void =>
    setOdhodStavby((v) => {
      const bez = v.filter((u) => u !== uid);
      if (!naSmetisko || krokSt.odhod <= 0) return bez;
      return [...(bez.length >= krokSt.odhod ? bez.slice(0, krokSt.odhod - 1) : bez), uid];
    });
  const doSenkuStavby = (draft?.mojBalicek ?? []).filter((k) => !odhodStavby.includes(k.uid)).map((k) => k.uid);
  const stavbaHotova = odhodStavby.length === krokSt.odhod && doSenkuStavby.length === krokSt.doSenku;
  const potvrdStavbu = (): void => {
    if (stavbaHotova && !naneisto) posli({ type: "stavbaSenku", doSenku: doSenkuStavby, odhod: odhodStavby });
  };

  // Limit Zhromaždenia na jeho začiatku — pás nad stolom z neho ukazuje,
  // koľko kariet hráč už vyložil a koľko ešte smie (server posiela len zvyšok).
  const zs0 = view.zhromazdenieStav;
  const klucZhromazdenia = `${view.kolo}-${view.pitkaCislo}`;
  const [limitNaZaciatku, setLimitNaZaciatku] = useState<{ readonly kluc: string; readonly limit: readonly [number, number] } | null>(null);
  useEffect(() => {
    if (view.faza !== "zhromazdenie" || zs0 === null || limitNaZaciatku?.kluc === klucZhromazdenia) return;
    setLimitNaZaciatku({ kluc: klucZhromazdenia, limit: [zs0.zostavaLimit[0], zs0.zostavaLimit[1]] });
  }, [view.faza, zs0, klucZhromazdenia, limitNaZaciatku]);

  // Karty, ktoré si hráč v tomto kole vzal zo šenku — v ruke sú označené.
  const [noveZoSenku, setNoveZoSenku] = useState<{ readonly kolo: number; readonly uids: readonly number[] }>({ kolo: 0, uids: [] });
  // Štítok „zo šenku“ len počas draftu (Michal 2026-10-18) — potom sú to bežné karty v ruke.
  const noveVRuke = noveZoSenku.kolo === view.kolo && view.faza === "draft" ? noveZoSenku.uids : [];

  // Práve dobraté karty mimo draftu (priznaný Dlh, fajčenie, Pitka) — dobratie
  // inak zaniklo v logu (Michal 2026-10-18). Štítok platí do ďalšej zmeny ruky.
  const predoslaRuka = useRef<readonly number[] | null>(null);
  const [dobrate, setDobrate] = useState<readonly number[]>([]);
  const klucRuky = view.ruka.map((k) => k.uid).join(",");
  useEffect(() => {
    const teraz = view.ruka.map((k) => k.uid);
    const pred = predoslaRuka.current;
    predoslaRuka.current = teraz;
    if (pred === null || view.faza === "draft") {
      setDobrate([]);
      return;
    }
    const nove = teraz.filter((u) => !pred.includes(u));
    // Ubudnutie karty (vyloženie) štítok len upraví, pribudnutie ho nahradí.
    setDobrate((d) => (nove.length > 0 ? nove : d.filter((u) => teraz.includes(u))));
  }, [klucRuky, view.faza]);

  // Poradie kariet v ruke si hráč skladá sám (Michal 2026-10-16); žije len
  // v tomto prehliadači — server poradie ruky nepozná a nepotrebuje.
  const klucPoradia = `naex.ruka.${kod}.${ja}`;
  const [poradieRuky, setPoradieRuky] = useState<readonly number[]>(() => {
    try {
      const ulozene = localStorage.getItem(klucPoradia);
      return ulozene === null ? [] : (JSON.parse(ulozene) as number[]);
    } catch {
      return [];
    }
  });
  const ulozPoradie = (uids: readonly number[]): void => {
    setPoradieRuky(uids);
    try {
      localStorage.setItem(klucPoradia, JSON.stringify(uids));
    } catch {
      // bez úložiska sa poradie len nezapamätá po obnovení stránky
    }
  };
  /** Ruka v poradí hráča; nové karty idú na koniec v poradí, v akom prišli. */
  const ruka = useMemo(() => {
    const pozicia = new Map(poradieRuky.map((uid, i) => [uid, i]));
    return [...view.ruka].sort(
      (a, b) => (pozicia.get(a.uid) ?? Number.MAX_SAFE_INTEGER) - (pozicia.get(b.uid) ?? Number.MAX_SAFE_INTEGER),
    );
  }, [view.ruka, poradieRuky]);
  const presunVRuke = (uid: number, cielUid: number | null): void => {
    const uids = ruka.map((k) => k.uid);
    const odkial = uids.indexOf(uid);
    if (odkial === -1) return;
    const bez = uids.filter((u) => u !== uid);
    // Doprava ide karta ZA cieľ, doľava PRED neho — ako pri preskladaní kariet v ruke.
    const kam = cielUid === null ? bez.length : bez.indexOf(cielUid) + (uids.indexOf(cielUid) > odkial ? 1 : 0);
    ulozPoradie([...bez.slice(0, kam), uid, ...bez.slice(kam)]);
  };

  // Návrh sa vždy overí proti aktuálnemu pohľadu; karta, ktorá už nie je
  // tam, odkiaľ prišla, z návrhu potichu vypadne.
  // Reakcia na súperovo NA EX: jedna karta z ruky do línie mimo limitu.
  const reagujem = somNaTahu && view.faza === "pitka" && view.pitkaStav?.reakcia === ja;
  const vylozenia: readonly PolozkaVykladania[] = (() => {
    if (navrh?.typ !== "vylozenia" || !somNaTahu || !(view.faza === "zhromazdenie" || reagujem)) return [];
    return navrh.polozky.flatMap((x) => {
      const k = view.ruka.find((r) => r.uid === x.uid);
      return k === undefined ? [] : [{ karta: k, ciel: x.ciel }];
    });
  })();
  // Pri myši na Záverečnej návrh ukáže, ktorá karta pôjde lícom dole.
  const [nahladZaverecnej, setNahladZaverecnej] = useState(false);
  useEffect(() => setNahladZaverecnej(false), [klucTahu]);
  /** Posledná navrhnutá karta (v odpovedi na NA EX jediná). */
  const vylozene: PolozkaVykladania | null = vylozenia[vylozenia.length - 1] ?? null;
  // Celý ťah v Zhromaždení naraz: koľko poldeci stojí a či ho pravidlá pustia —
  // rovnaký výpočet, aký server urobí s príkazom „tah“.
  const zostavaTeraz = view.zhromazdenieStav?.zostavaLimit[ja] ?? 0;
  const planTahu = (polozky: readonly PolozkaVykladania[]) => planVykladania(data, view, ja, zostavaTeraz, polozky);
  const plan = view.faza === "zhromazdenie" ? planTahu(vylozenia) : null;
  // Výučba (playtest 20261023-161148, návrh 1): ťah, ktorému ešte niečo chýba, sa nedá potvrdiť —
  // inak ho server odmietol a hráč nevedel prečo. Rovnaká karta (defId) platí za tú zo scenára.
  const chybaVyucby = (polozky: readonly PolozkaVykladania[]): string | null => {
    if (vyucbaOcakava === undefined || vyucbaOcakava === null) return null;
    const kroky = (vyucbaOcakava.type === "tah" ? vyucbaOcakava.kroky : [vyucbaOcakava]) as readonly Command[];
    const ocakavane = kroky.flatMap((k) => {
      if (k.type !== "place" && k.type !== "zaverecna") return [];
      const defId = view.ruka.find((r) => r.uid === k.uid)?.defId;
      return defId === undefined ? [] : [{ defId, ciel: k.target, zaverecna: k.type === "zaverecna" }];
    });
    const sedi = (o: (typeof ocakavane)[number], v: PolozkaVykladania): boolean =>
      v.karta.defId === o.defId && v.ciel === o.ciel && o.zaverecna === (v.zaverecna === true);
    const chyba = ocakavane.filter((o) => !polozky.some((v) => sedi(o, v)));
    if (chyba.length === 0) return null;
    const navyse = polozky.filter((v) => !ocakavane.some((o) => sedi(o, v)));
    return [
      `Ešte chýba: ${chyba.map((o) => menoKarty(o.defId)).join(", ")}.`,
      navyse.length > 0 ? `${navyse.map((v) => menoKarty(v.karta.defId)).join(", ")} sem teraz nepatrí — vráť do ruky (pravý klik).` : "",
    ]
      .filter((x) => x !== "")
      .join(" ");
  };
  const chybaVoVyucbe = chybaVyucby(vylozenia);
  // Záverečná (roadmapa #83, Michal 2026-10-24) je forma konca ťahu: tlačidlo vedľa potvrdenia
  // odošle návrh a jeho posledná karta pôjde lícom dole; potom už v tomto Zhromaždení nevykladám.
  const zaverecna = ((): { readonly kroky: readonly Command[] | null; readonly dovod: string | null } | null => {
    if (view.faza !== "zhromazdenie" || !somNaTahu) return null;
    const t = tahSoZaverecnou(data, view, ja, vylozenia);
    const vyucba = t.kroky === null ? null : chybaVyucby(polozkySoZaverecnou(vylozenia));
    return vyucba === null ? t : { kroky: null, dovod: vyucba };
  })();
  /** Koľkatá karta do línie či do Dedičstva v ťahu (od 0) — od druhej stojí plný poldeci. */
  const poradieVTahu = (uid: number): number => vylozenia.filter((x) => x.ciel !== "priznanie").findIndex((x) => x.karta.uid === uid);
  const lokalitaNavrh = (() => {
    if (navrh?.typ !== "lokalita" || !somNaTahu || view.faza !== "volbaCiela") return null;
    const k = view.lokalityVHre.find((x) => x.uid === navrh.uid);
    return k === undefined ? null : { karta: k, otocena: navrh.otocena };
  })();
  // Lokalita umiestnená z vrstvy: posuň stránku k stolu, nech ju ruka neprekrýva.
  const navrhLokality = navrh?.typ === "lokalita" ? navrh.uid : null;
  useEffect(() => {
    if (navrhLokality === null) return;
    lokalitaRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [navrhLokality]);
  // Branie zo šenku (Michal 2026-10-19): na ťahu potiahneš 1 alebo 2 karty do
  // ruky a potvrdíš — 1 karta za cigaretu, 2 karty za 3 cigarety, poldeci sa neplatí.
  const beriem = view.faza === "draft" && draft?.krok === "beranie" && !draft.hotovo[ja] && view.koniec === null;
  const cigJa = view.hraci[ja].cigarety;
  const kolkoMozemBrat =
    beriem && somNaTahu
      ? Math.min(view.senok.length, cigJa >= (KONSTANTY.CENA_SENKU[2] ?? 3) ? 2 : cigJa >= (KONSTANTY.CENA_SENKU[1] ?? 1) ? 1 : 0)
      : 0;
  const mozemBrat = kolkoMozemBrat > 0;
  // Patronát (Michal 2026-10-20): koho si smiem vziať — rovnaké podmienky ako v jadre (moznyPatronat).
  const kandidatiPatronatu = kandidatiNaNahradu(data, view.ruka);
  const hJa = view.hraci[ja];
  const mozniPatronati =
    view.faza === "draft" && draft?.krok === "patronat" && somNaTahu && hJa.poldeciPlne + hJa.poldeciVypite >= 1 && kandidatiPatronatu.length > 0
      ? view.starsi.filter((e) => patronatMozny(e, ja) && hJa.cigarety >= cenaPatronatu(e).cigarety)
      : [];
  /** Karta staršieho v patronáte — v ruke a v línii nesie štítok. */
  const jeKartaPatronatu = (uid: number): boolean =>
    view.patronat.some((x) => x !== null && view.starsi.find((e) => e.elderId === x.elderId)?.karta.uid === uid);
  const limitTeraz = limitZhromazdenia(view, ja);
  const zoSenkuLimit = kolkoMozemBrat;
  // Keď hráč má vyberať kartu zo šenku (Starosta) či Vešticu, vrstva sa otvorí
  // sama. Raz za fázu — ak ju zavrie, znova sa nevnucuje. Cieľ kola sa vyberá
  // na stole (Michal 2026-10-19), nie vo vrstve.
  const chceVrstvu: Vrstva | null = !somNaTahu || view.koniec !== null
    ? null
    : view.volbaVestica !== null
        ? "vestica"
    : // Karta zo šenku (Starosta, Dohadzovačka v7): šenok sa otvorí sám.
          view.volbaNastupu?.typ === "senok" && view.volbaNastupu.hrac === ja
          ? "senok"
          : null;
  // Výber lokality skončil (aj keď ho urobil súper) — vrstva by zakryla draft na stole.
  useEffect(() => {
    if (view.faza !== "volbaCiela") setVrstva((v) => (v === "lokality" ? null : v));
  }, [view.faza]);
  const klucAutoVrstvy = `${view.kolo}-${view.faza}-${mode.typ}-${view.pitkaCislo}-${draft?.krok ?? ""}-${draft?.balicekPocet[ja] ?? ""}`;
  useEffect(() => {
    if (chceVrstvu === null || autoVrstva.current === klucAutoVrstvy) return;
    autoVrstva.current = klucAutoVrstvy;
    setVrstva(chceVrstvu);
  }, [chceVrstvu, klucAutoVrstvy]);
  const zoSenku: readonly CardInstance[] =
    navrh?.typ === "zoSenku" && zoSenkuLimit > 0
      ? view.senok.filter((k) => navrh.uids.includes(k.uid)).slice(0, zoSenkuLimit)
      : [];

  // NA EX naraz (v5): moje skryto vybrané NA EX — server posiela len moje,
  // na súperovu skrytú Záverečnú s jej náhradným uid. Súperove nevidím.
  const mojeSkryteNaex = useMemo(
    () => new Set((view.pitkaStav?.skryteNaex ?? []).filter((x) => x.hrac === ja).map((x) => x.uid)),
    [view.pitkaStav, ja],
  );
  // Bzdocha (v7): kto vyberá NA EX po súperovi, dostane aj jeho skryté NA EX — stôl ich vyznačí.
  const superoveSkryteNaex = useMemo(
    () => new Set((view.pitkaStav?.skryteNaex ?? []).filter((x) => x.hrac !== ja).map((x) => x.uid)),
    [view.pitkaStav, ja],
  );
  const vidimVolbuSupera = view.pitkaStav !== null && vidiVolbuSupera(data, view, ja);
  const stitokSuperovhoNaex = (
    <span
      className="naex-nad naex-skryte"
      title={`${menoHraca(super_)} dal NA EX skryto — vidíš ho vďaka Bzdoche, lebo vyberáš po ňom. Odkryje sa, keď skončíš Pitku.`}
    >
      <IkonaPoldeci /> NA EX · {menoHraca(super_)} · skryto
    </span>
  );
  // Pre mňa sú skryté NA EX dané: náhľady a výhľady rátajú s nimi tak, ako ich motor
  // zúčtuje pri odkrytí (poldeci, pečeň, Svokra, Výpalné — sMojimiSkrytymiNaex).
  const zaklad = useMemo(() => sMojimiSkrytymiNaex(data, view), [data, view]);
  // Finále je na pinnacle lokalite a línia je ako v každom kole (Michal 2026-10-27).
  const jeFinaleStola = view.ciel?.typ === "finale";
  // Stôl tak, ako by vyzeral po potvrdení návrhu — z neho sa ráta živé
  // zvýraznenie spojov aj odhad bitky. Moje skryté NA EX v ňom ležia na kartách
  // (pre mňa sú dané), súperove nie — tie sa ukážu až pri odkrytí.
  const { stol, lineEval, odhad, rozpis, hrozby, rozsahy, presunute } = useMemo(() => {
    let strany: ClientState["strany"] = zaklad.strany;
    let hraci = zaklad.hraci;
    let prilozeniaKu = zaklad.prilozeniaKu;
    // Karty, ktoré navrhnutá Dohadzovačka presunie z druhej strany lokality za seba.
    const presunute = new Set<number>();
    for (const x of vylozenia) {
      if (x.ciel === "vlastna" || x.ciel === "superova") {
        const kam = x.ciel === "vlastna" ? ja : super_;
        // Konflikt, Miňištrant a Dohadzovačka menia stôl už pri priložení — ako motor.
        const po = sPrilozenou(data, { ...zaklad, strany, hraci, ...(prilozeniaKu === undefined ? {} : { prilozeniaKu }) }, kam, x.karta, ja);
        if (x.karta.defId === "dohadzovacka") {
          const pred = new Set(strany[kam].map((pl) => pl.card.uid));
          for (const pl of po.strany[kam]) if (!pred.has(pl.card.uid) && pl.card.uid !== x.karta.uid) presunute.add(pl.card.uid);
        }
        strany = po.strany;
        hraci = po.hraci;
        prilozeniaKu = po.prilozeniaKu;
      } else {
        const h = hraci[ja];
        const novy = x.ciel === "priznanie" ? { ...h, priznane: [...h.priznane, x.karta] } : { ...h, dedicstvo: [...h.dedicstvo, x.karta] };
        hraci = ja === 0 ? [novy, hraci[1]] : [hraci[0], novy];
      }
    }
    const ciel = lokalitaNavrh !== null ? { typ: "lokalita" as const, lokalita: lokalitaNavrh.karta } : view.ciel;
    // Šofér, Strýko, Vychovávateľka, Pasca a Vidly čítajú aj NA EX v kole, Kšefty a špaky (playtest v7 131033).
    const stol: VerejnyStav = {
      ciel,
      strany,
      starsi: view.starsi,
      hraci,
      spaky: view.spaky,
      naexVKole: zaklad.naexVKole,
      ...(view.kseftRany === undefined ? {} : { kseftRany: view.kseftRany }),
      ...(view.kseftPovery === undefined ? {} : { kseftPovery: view.kseftPovery }),
      ...(prilozeniaKu === undefined ? {} : { prilozeniaKu }),
    };
    // lineState: rovnaká línia ako na serveri.
    const lineEval = evaluateLine(data, lineState({ ...stol, lokalitaOtocena: lokalitaNavrh?.otocena ?? view.lokalitaOtocena }));
    // Absťáky v ruke: svoje poznáš (bez karty, ktorá už leží na stole), súperove nie.
    const mojeAbstaky = view.ruka.filter((k) => k.defId === "abstak" && !vylozenia.some((x) => x.karta.uid === k.uid)).length;
    const abstakyVRuke: [number, number] = ja === 0 ? [mojeAbstaky, 0] : [0, mojeAbstaky];
    const odhad = ciel === null ? null : poskodenieBitky(data, stol, lineEval.sums, abstakyVRuke);
    const rozpis = rozpisPoskodenia(data, stol, lineEval.sums, abstakyVRuke);
    // Hrozba na stole: najsilnejšie NA EX každého z vás z kariet na stole (bez ruky).
    const priebeh = {
      faza: view.faza,
      pitkaStav: view.pitkaStav,
      pitkaCislo: view.pitkaCislo,
      pitkyCelkom: view.pitkyCelkom,
      poldeciPlne: [view.hraci[0].poldeciPlne, view.hraci[1].poldeciPlne] as const,
    };
    const stolBitky = { ...stol, lokalitaOtocena: lokalitaNavrh?.otocena ?? view.lokalitaOtocena };
    const hrozby =
      ciel === null || view.bitkaStav !== null
        ? ([null, null] as const)
        : ([hrozbaNaex(data, stolBitky, priebeh, 0, abstakyVRuke), hrozbaNaex(data, stolBitky, priebeh, 1, abstakyVRuke)] as const);
    // Nepridelené Pohoršenia (Michal 2026-10-27 „ukázať rozsah“): kam až ich hráč bitku dotiahne.
    const stolPohorseni = { ...stolBitky, patronat: view.patronat, bitkaStav: view.bitkaStav };
    const nepridelene = nepridelenePohorsenia(data, stolPohorseni, lineEval.sums);
    const rozsahy =
      ciel === null
        ? ([null, null] as const)
        : ([
            rozsahPohorseni(data, stolPohorseni, lineEval.sums, nepridelene, 0, abstakyVRuke),
            rozsahPohorseni(data, stolPohorseni, lineEval.sums, nepridelene, 1, abstakyVRuke),
          ] as const);
    return { stol, lineEval, odhad, rozpis, hrozby, rozsahy, presunute };
    // vylozene a lokalitaNavrh sú odvodené len z navrh a view.
  }, [data, view, navrh, somNaTahu, zaklad]);

  // Karty, na ktoré NA EX teraz smiem dať, nesú v línii značku — tie isté podmienky
  // ako motor (moznostiNaexVPohlade: Kostol, limit Pitky, plné poldeci, moje skryté NA EX,
  // súperova Záverečná cez náhradné uid). Značka bez Kostola svietila aj tam (roadmapa #112).
  const naexCiele = useMemo(() => new Set(moznostiNaexVPohlade(data, view)), [data, view]);
  const pitka = view.pitkaStav;
  const naexLimitMinuty = pitka !== null && naexLimitMinutyHraca(data, view, ja);
  const naexMozny = somNaTahu && naexCiele.size > 0;
  // Kartu so značkou smieš rovno kliknúť.
  const naexPriamo = naexMozny;
  // Benzínka: vlastní Občania v línii, z ktorých hráč vyberá, koho zahodí.
  const benzinkaCiele = useMemo(() => {
    const out = new Set<number>();
    const bs = view.bitkaStav;
    if (bs === null || bs.krok !== "benzinka" || bs.caka !== ja) return out;
    for (const pl of [...view.strany[0], ...view.strany[1]]) {
      if (pl.playedBy !== ja || bs.spalit.includes(pl.card.uid)) continue;
      if ((data.cards.get(pl.card.defId)?.tags ?? []).includes("Občan")) out.add(pl.card.uid);
    }
    return out;
  }, [data, view, ja]);

  // ---- výhľad Pitky (Michal 2026-10-21) ------------------------------------
  // Počítadlá pečene a zadĺženia ukazujú stav „po Pitke“, nie „doteraz“ — ten
  // istý výpočet ako vyhodnotenie (nahladPitky). V Zhromaždení ráta aj poldeci,
  // ktoré navrhnutý ťah vypije.
  const otocenaTeraz = lokalitaNavrh?.otocena ?? view.lokalitaOtocena;
  // Pečeň zo skrytých NA EX už nesie zaklad (sMojimiSkrytymiNaex).
  const vypijemVTahu = plan?.poldeci ?? 0;
  // Stávka bitky (návrh 3 A): v pásme kola a pri potvrdení pasu.
  const stavka = useMemo(
    () => (view.faza === "zhromazdenie" || view.faza === "pitka" ? stavkaBitky(data, view) : null),
    [data, view],
  );
  const nahladyPitky = useMemo(() => {
    if (view.koniec !== null || (view.faza !== "zhromazdenie" && view.faza !== "pitka") || stol.ciel === null) return null;
    const h = zaklad.hraci;
    const hraci: ClientState["hraci"] =
      ja === 0 ? [{ ...h[0], pecen: h[0].pecen + vypijemVTahu }, h[1]] : [h[0], { ...h[1], pecen: h[1].pecen + vypijemVTahu }];
    return nahladPitky(data, { ciel: stol.ciel, strany: stol.strany, starsi: view.starsi, hraci, lokalitaOtocena: otocenaTeraz, vizia: view.vizia });
  }, [data, view, stol, ja, vypijemVTahu, otocenaTeraz, zaklad]);
  /** Špaky jednej Cirhózy a jedného Dlhu na konci hry (v6: Cirhóza −5, Dlh 0). */
  const cenyKliatob = useMemo(
    () =>
      ([0, 1] as const).map((p) => ({ cirhoza: cenaKliatby(data, view, p, "cirhoza"), dlh: cenaKliatby(data, view, p, "dlh") })) as [
        { readonly cirhoza: number; readonly dlh: number },
        { readonly cirhoza: number; readonly dlh: number },
      ],
    [data, view],
  );
  const dalsiePitky = Math.max(0, view.pitkyCelkom - (view.faza === "pitka" ? view.pitkaCislo : view.pitkaCislo + 1));
  // Dlhy po najbližšej bitke (návrh #1 B): z nových prežijú len tie, ktoré
  // Robota a Dievčina na vydaj nespália — rovnaký stôl ako výhľad Pitky.
  const dlhyBitka = useMemo(() => {
    if (nahladyPitky === null || stol.ciel === null) return null;
    const h = zaklad.hraci;
    const hraci: ClientState["hraci"] =
      ja === 0 ? [{ ...h[0], pecen: h[0].pecen + vypijemVTahu }, h[1]] : [h[0], { ...h[1], pecen: h[1].pecen + vypijemVTahu }];
    const v = vyhladDlhov(data, { ciel: stol.ciel, strany: stol.strany, starsi: view.starsi, hraci, lokalitaOtocena: otocenaTeraz, vizia: view.vizia }, dalsiePitky);
    return ([0, 1] as const).map((p) => {
      const teraz = view.hraci[p].priznane.filter((k) => k.defId === "dlh").length;
      return { pali: v[p].kapacita, ostane: v[p].poBitke - Math.max(0, teraz - v[p].kapacita) };
    }) as [VyhladPitky["dlhyBitka"], VyhladPitky["dlhyBitka"]];
  }, [nahladyPitky, stol, view, ja, vypijemVTahu, data, otocenaTeraz, dalsiePitky, zaklad]);
  const vyhladPitky = (p: PlayerId): VyhladPitky | null =>
    nahladyPitky === null || dlhyBitka === null
      ? null
      : {
          nahlad: nahladyPitky[p],
          vPitke: view.faza === "pitka",
          dalsiePitky,
          cenaCirhozy: cenyKliatob[p].cirhoza,
          cenaDlhu: cenyKliatob[p].dlh,
          dlhyBitka: dlhyBitka[p],
        };

  // Prečo na kartu NA EX nejde — hráč to vidí pri karte (dizajn hra-20261021-1240, UX N4).
  const dovodBezNaexNaKartu = (pl: PlacedCard): string => {
    const def = data.cards.get(pl.card.defId);
    if (pl.naexBy !== undefined) return "Na karte už poldeci leží.";
    if (def !== undefined && !def.tags.includes("Občan") && !def.tags.includes("Starešina"))
      return `NA EX len na Občana alebo Starešinu${def.tags.includes("Nástroj") ? " — toto je Nástroj" : ""}.`;
    if (naexLimitMinuty) return "Limit NA EX v tejto Pitke je minutý — ďalšie NA EX až v ďalšej Pitke.";
    return "NA EX ide len na kartu s aspoň jednou aktívnou a jednou neaktívnou akciou.";
  };
  /**
   * Kliatby z náhľadu NA EX či odpovede: Cirhóza s oboma cenami (nepriznaná
   * body, priznaná +1 tuhé súperovi), Dlh po najbližšej bitke (návrh #1 B).
   */
  const textKliatob = (k: KliatbyNahladu): string => {
    const znak = (n: number): string => `${n > 0 ? "+" : "−"}${Math.abs(n)}`;
    const cirhozy = k.cirhozy + k.dalejCirhozy;
    const dlhy = k.dlhy + k.dalejDlhy;
    const casti: string[] = [];
    if (cirhozy !== 0) casti.push(`${znak(cirhozy)}× Cirhóza${cirhozy > 0 ? " (priznaná body neuberie, súper za ňu +1 tuhé v každej bitke)" : ""}`);
    if (dlhy !== 0) casti.push(`${znak(dlhy)}× Dlh${dlhy !== k.dlhyPoBitke ? ` → po bitke ${k.dlhyPoBitke === 0 ? "nič" : znak(k.dlhyPoBitke)} (spáli Robota či Dievčina)` : ""}`);
    if (k.dalejCirhozy !== 0 || k.dalejDlhy !== 0) casti.push("vrátane ďalších Pitiek kola");
    return `${casti.length === 0 ? "nič" : casti.join(", ")}${k.body !== 0 ? ` · ${k.body > 0 ? "+" : "−"}${Math.abs(k.body)} b` : ""}`;
  };
  /**
   * Zvyšok ceny ťahu (návrh #1, playtest 20261024-075830): cigarety z Pitiek
   * kola, Pohoršenia v bitke s ≈ bodmi (rozdiel hráča voči súperovi) a mäkké.
   * Len to, čo sa mení; null, keď sa nemení nič.
   */
  const textDopadov = (d: readonly [DopadyNahladu, DopadyNahladu]): string | null => {
    const znak = (n: number): string => `${n > 0 ? "+" : "−"}${Math.abs(n)}`;
    const kto = (p: PlayerId): string => (p === ja ? "ty" : menoHraca(super_));
    const hraci = [ja, super_] as const;
    const casti: string[] = [];
    const cig = hraci.filter((p) => d[p].cigarety !== 0).map((p) => `${kto(p)} ${znak(d[p].cigarety)}`);
    if (cig.length > 0) casti.push(`cigarety: ${cig.join(", ")}`);
    const poh = hraci
      .filter((p) => d[p].pohorsenia !== 0)
      .map((p) => {
        const n = d[p].pohorsenia;
        const spolu = d[p].pohorseniaSpolu !== n ? `spolu ${d[p].pohorseniaSpolu}, ` : "";
        return `${kto(p)} ${n > 0 ? "+" : "−"}${pocet(Math.abs(n), "posun", "posuny", "posunov")} (${spolu}≈ ${d[p].pohorseniaBody === 0 ? "0" : znak(d[p].pohorseniaBody)} š.)`;
      });
    if (poh.length > 0) casti.push(`Pohoršenia: ${poh.join(", ")}`);
    const makke = hraci.filter((p) => d[p].makke !== 0).map((p) => `${kto(p)} ${znak(d[p].makke)}`);
    if (makke.length > 0) casti.push(`mäkké: ${makke.join(", ")}`);
    return casti.length === 0 ? null : casti.join(" · ");
  };
  /**
   * Prebytok bitky pred ťahom a po ňom, keď sa mení alebo ho kráti Puška či Miňištrant
   * (bitka to hlási v logu, náhľad mlčal — playtest 20261024-075830).
   */
  const textPrebytku = (a: PrebytokNahladu, b: PrebytokNahladu): string | null => {
    const t = (x: PrebytokNahladu): string => {
      if (x.drzi === null || x.prebytok === 0) return "žiadny";
      const kratenie = [
        ...(x.naRozdelenie !== x.prebytok ? [`Puška −${x.prebytok - x.naRozdelenie}`] : []),
        ...(x.cenaPosunu > 1 ? [`posun za ${x.cenaPosunu} (Miňištrant)`] : []),
      ];
      const posuny = kratenie.length === 0 ? "" : ` (${kratenie.join(", ")} → ${pocet(x.posuny, "posun", "posuny", "posunov")})`;
      return `${x.drzi === ja ? "tvoj" : "súperov"} ${x.prebytok}${posuny}`;
    };
    const rovnaky = a.drzi === b.drzi && a.prebytok === b.prebytok && a.posuny === b.posuny;
    if (rovnaky && b.naRozdelenie === b.prebytok && b.cenaPosunu === 1) return null;
    return rovnaky ? `prebytok ${t(b)}` : `prebytok ${t(a)} → ${t(b)}`;
  };
  /**
   * Cena NA EX skrátene pre jeden riadok pokynu (UI inšpekcia 20261024-nahlad, N3):
   * body z kliatob, cigarety, Pohoršenia a mäkké — podrobnosti sú v rozbalenom pokyne.
   */
  const kratkaCena = (k: readonly [KliatbyNahladu, KliatbyNahladu], d: readonly [DopadyNahladu, DopadyNahladu]): string | null => {
    const znak = (n: number): string => `${n > 0 ? "+" : "−"}${Math.abs(n)}`;
    const kto = (p: PlayerId): string => (p === ja ? "ty" : "súper");
    const hraci = [ja, super_] as const;
    const casti = [
      ...hraci.filter((p) => k[p].body !== 0).map((p) => `${kto(p)} ${znak(k[p].body)} b`),
      ...hraci.filter((p) => d[p].cigarety !== 0).map((p) => `${kto(p)} ${znak(d[p].cigarety)} cig`),
      ...hraci
        .filter((p) => d[p].pohorsenia !== 0)
        .map((p) => `${kto(p)} ${d[p].pohorsenia > 0 ? "+" : "−"}${pocet(Math.abs(d[p].pohorsenia), "Pohoršenie", "Pohoršenia", "Pohoršení")}`),
      ...hraci.filter((p) => d[p].makke !== 0).map((p) => `${kto(p)} mäkké ${znak(d[p].makke)}`),
    ];
    return casti.length === 0 ? null : casti.join(" · ");
  };
  // Možnosť NA EX pod myšou či fokusom — tá istá karta svieti na stole.
  const [zvyraznenaNaex, setZvyraznenaNaex] = useState<number | null>(null);
  // Karta z riadku hrozby (prejdenie myšou) — v línii sa zvýrazní.
  const [ukazHrozbu, setUkazHrozbu] = useState<number | null>(null);

  // Náhľad NA EX s celou cenou (dizajn hra-nezrovnalosti-20261021-1229, UI N4 + UX N3;
  // návrh #49 „áno, celá cena“): bitka pred a po, zmeny OBOCH hráčov, vzorec násobkov na
  // karte, kliatby, cigarety, Pohoršenia, mäkké a prebytok — všetko z nahladNaexNaKartu
  // v jadre, ktorá stôl po NA EX skladá krokmi motora (test nahlady-zuctovanie).
  const nahladNaex = useMemo(() => {
    const out = new Map<
      number,
      NahladNaexNaKartu & {
        readonly zmeny: readonly [string[], string[]];
        readonly vzorec: readonly string[];
        readonly majitel: PlayerId;
        readonly strana: PlayerId;
        readonly pozicia: number;
      }
    >();
    if (mode.typ !== "naexCiel" || odhad === null || nahladyPitky === null) return out;
    const nazov = (k: string): string => sada.akcie.find((a) => a.kluc === k)?.nazov ?? k;
    const dovod = (d: string): string =>
      d === "NA EX" ? "×2 NA EX" : d === "Posilnenie" ? "×2 Posilnenie" : d.startsWith("karta:") ? `×2 ${menoKarty(d.slice(6))}` : d;
    for (const uid of naexCiele) {
      const strana = view.strany[0].some((pl) => pl.card.uid === uid) ? 0 : 1;
      const index = view.strany[strana].findIndex((pl) => pl.card.uid === uid);
      const placed = view.strany[strana][index];
      if (placed === undefined) continue;
      const n = nahladNaexNaKartu(data, view, uid, cenyKliatob);
      if (n === null) continue;
      const ev = n.liniaPo;
      const zmeny = ([0, 1] as const).map((p) => {
        const kluce = new Set([...Object.keys(ev.sums[p]), ...Object.keys(n.liniaPred.sums[p])]) as Set<keyof (typeof ev.sums)[0]>;
        const out2: string[] = [];
        for (const k of kluce) {
          const rozdiel = (ev.sums[p][k] ?? 0) - (n.liniaPred.sums[p][k] ?? 0);
          if (rozdiel !== 0) out2.push(`${nazov(k)} ${rozdiel > 0 ? "+" : "−"}${Math.abs(rozdiel)}`);
        }
        return out2;
      }) as [string[], string[]];
      // Vzorec: akcie tejto karty po NA EX s dôvodmi zdvojenia (Rana 4: ×2 NA EX, ×2 Silná žena).
      const zdrojeMajitela = ev.zdroje[placed.playedBy];
      const vzorec: string[] = [];
      for (const [akcia, zoznam] of Object.entries(zdrojeMajitela)) {
        for (const z of zoznam ?? []) {
          if (z.defId !== placed.card.defId || z.hodnota <= 0) continue;
          const dovody = z.dovody.map(dovod);
          vzorec.push(`${nazov(akcia)} ${z.hodnota}${dovody.length > 0 ? ` (${dovody.join(" · ")})` : ""}`);
        }
      }
      out.set(uid, { ...n, zmeny, vzorec, majitel: placed.playedBy, strana, pozicia: index + 1 });
    }
    return out;
  }, [mode.typ, naexCiele, data, view, odhad, sada, nahladyPitky, cenyKliatob]);

  // Náhľad odpovede na NA EX (návrh #1 B): ten istý ako pri NA EX — bitka pred
  // a po navrhnutej karte, kliatby a ostatné dopady oboch hráčov (cenaTahu).
  const nahladOdpovede = useMemo(() => {
    if (!reagujem || odhad === null || stol.ciel === null || !vylozenia.some((x) => x.ciel === "vlastna" || x.ciel === "superova")) return null;
    return cenaTahu(data, view, { ...view, strany: stol.strany }, cenyKliatob);
  }, [reagujem, odhad, stol, vylozenia, view, data, cenyKliatob]);

  // Náhľad vyloženia na koniec strany (playtest 20261017-164450: ktorá hrana
  // sa spáruje, hráči zisťovali skúškou) — počas ťahania aj v návrhu.
  const nahladVylozeniaNa = (k: CardInstance, kam: "vlastna" | "superova"): NahladVylozenia =>
    nahladVylozenia(data, { ...lineState(view), strany: stol.strany }, ja, k, kam);
  const nazovAkcie = (k: string): string => sada.akcie.find((a) => a.kluc === k)?.nazov ?? k;
  const piktogramyRekapitulacie: PiktogramyRekapitulacie = {
    ikona: (k) => <IkonaAkcie kluc={k} akcia={sada.akcie.find((a) => a.kluc === k)} />,
    nazov: nazovAkcie,
  };
  const textZmien = (z: ActionSums): string =>
    (Object.entries(z) as [string, number][]).map(([k, d]) => `${nazovAkcie(k)} ${d > 0 ? "+" : "−"}${Math.abs(d)}`).join(", ") || "bez zmeny";
  // Zmeny akcií aj tuhé navyše z kariet (Pes, Recidivista…) — bonus Psa náhľad vynechal (playtest 20261026-173610-1).
  const textZmienVylozenia = (n: NahladVylozenia, p: PlayerId): string => {
    const akcie = textZmien(n.zmeny[p]);
    const t = n.tuhe[p];
    if (t === 0) return akcie;
    const tuhe = `tuhé navyše ${t > 0 ? "+" : "−"}${Math.abs(t)}`;
    return akcie === "bez zmeny" ? tuhe : `${akcie}, ${tuhe}`;
  };
  const textSpoja = (n: NahladVylozenia): string =>
    n.sused === null
      ? "nič sa nespojí"
      : n.pary.length === 0
        ? "vnútorná hrana nemá pár"
        : `spoj: ${n.pary.map((p) => `${nazovAkcie(p.moja)} + ${nazovAkcie(p.susedova)}`).join(", ")}`;
  /** Hrana ako rad ikon zhora nadol (prázdny slot = pomlčka). */
  const hranaIkony = (h: readonly Slot[]): ReactNode => (
    <span className="hrana-ikony" title="zhora nadol">
      {h.map((k, i) =>
        k === null ? (
          <span key={i} className="hi-prazdny">
            —
          </span>
        ) : (
          <span key={i} className="hi-slot" title={nazovAkcie(k)}>
            <IkonaAkcie kluc={k} akcia={sada.akcie.find((a) => a.kluc === k)} />
          </span>
        ),
      )}
    </span>
  );
  const nahladSpojov = useMemo(() => {
    // Náhľad poslednej navrhnutej karty do línie — na stole, kde už ležia tie pred ňou.
    const doLinie = vylozenia.filter((x) => x.ciel === "vlastna" || x.ciel === "superova");
    const posledna = doLinie[doLinie.length - 1];
    if (posledna === undefined) return null;
    let strany = view.strany;
    for (const x of doLinie.slice(0, -1)) {
      const kam = x.ciel === "vlastna" ? ja : super_;
      const nova: readonly PlacedCard[] = [...strany[kam], { card: x.karta, playedBy: ja }];
      strany = kam === 0 ? [nova, strany[1]] : [strany[0], nova];
    }
    const n = nahladVylozenia(data, { ...lineState(view), strany }, ja, posledna.karta, posledna.ciel === "vlastna" ? "vlastna" : "superova");
    return { n, uid: posledna.karta.uid, spoj: textSpoja(n), ja: textZmienVylozenia(n, ja), su: textZmienVylozenia(n, super_) };
    // vylozenia sú odvodené z navrh a view.
  }, [data, view, navrh, ja, super_, sada]);

  // ---- výber miesta klikom (Michal 2026-10-20) -----------------------------
  // Okrem ťahania: hráč klikne na koniec strany a z ruky sa vysunú karty, ktoré
  // tam vytvoria spoj — akcie spoja svietia na nich aj na susedovi. Karty, ktoré
  // sa tam dajú položiť bez spoja, ostanú stlmené; nepoložiteľné stlmené ešte viac.
  const [miestoVolby, setMiestoVolby] = useState<StranaLinie | null>(null);
  useEffect(() => setMiestoVolby(null), [klucTahu]);
  useEffect(() => {
    if (!vykladam) setMiestoVolby(null);
  }, [vykladam]);
  const moznostiMiesta = useMemo(() => {
    // kratko: text na úzke miesto, kde by sa dlhé slová lámali v polovici; celý dôvod ostáva v title.
    const out = new Map<StranaLinie, { readonly karty: ReadonlyMap<number, NahladVylozenia>; readonly dovod: string | null; readonly kratko?: string }>();
    if (!vykladam) return out;
    const volne = ruka.filter((k) => !vylozenia.some((x) => x.karta.uid === k.uid));
    const zablokovane = zablokovaneStrany(view);
    for (const c of ["vlastna", "superova"] as const) {
      // Za kartou lícom dole sa nedá priložiť — jadro by vrátilo len všeobecné „sem nemôžeš“.
      if (zablokovane[c === "vlastna" ? ja : super_]) {
        out.set(c, { karty: new Map(), dovod: "Za Záverečnou až po jej otočení na konci Pitky.", kratko: "až po Pitke" });
        continue;
      }
      const karty = new Map<number, NahladVylozenia>();
      let dovod: string | null = null;
      for (const k of volne) {
        // Odpoveď na NA EX je jediná karta — nová nahradí navrhnutú, ráta sa teda bez nej.
        const chyba = reagujem
          ? cieleVykladania(data, view.strany, ja, k, Number.POSITIVE_INFINITY, true, cielLokalitaId(view), zablokovaneStrany(view)).includes(c)
            ? null
            : "Sem žiadnu kartu z ruky vyložiť nesmieš."
          : planTahu([...vylozenia, { karta: k, ciel: c }]).chyba;
        if (chyba !== null) {
          dovod ??= chyba;
          continue;
        }
        karty.set(k.uid, reagujem ? nahladVylozenia(data, lineState(view), ja, k, c) : nahladVylozeniaNa(k, c));
      }
      out.set(c, { karty, dovod: karty.size > 0 ? null : (dovod ?? "Nemáš kartu, ktorú by si sem mohol vyložiť.") });
    }
    return out;
    // vylozenia a planTahu sú odvodené z navrh a view; nahladVylozeniaNa zo stol.
  }, [data, view, navrh, ruka, vykladam, reagujem, stol, ja]);
  const vybraneMiesto = miestoVolby === null ? undefined : moznostiMiesta.get(miestoVolby);
  /** Klik na kartu v ruke pri vybranom mieste: karta ide na stôl ako návrh. */
  const polozNaMiesto = (k: CardInstance): void => {
    if (miestoVolby === null || vybraneMiesto?.karty.has(k.uid) !== true) return;
    const ciel = miestoVolby;
    setNavrh({
      typ: "vylozenia",
      polozky: reagujem ? [{ uid: k.uid, ciel }] : [...vylozenia.map((x) => ({ uid: x.karta.uid, ciel: x.ciel })), { uid: k.uid, ciel }],
    });
    setMiestoVolby(null);
  };
  /** Navrhnutá karta späť do ruky (pravý klik). */
  const vratDoRuky = (uid: number): void => {
    const zvysok = vylozenia.filter((x) => x.karta.uid !== uid).map((x) => ({ uid: x.karta.uid, ciel: x.ciel }));
    setNavrh(zvysok.length === 0 ? null : { typ: "vylozenia", polozky: zvysok });
  };
  useEffect(() => {
    if (miestoVolby === null) return;
    const klaves = (e: KeyboardEvent): void => {
      if (e.key === "Escape") setMiestoVolby(null);
    };
    window.addEventListener("keydown", klaves);
    return () => window.removeEventListener("keydown", klaves);
  }, [miestoVolby]);
  /**
   * Akcie suseda na konci vybranej strany, s ktorými sa niektorá karta z ruky
   * spáruje — na vytlačených stranách suseda (otočená karta má hrany obrátené).
   */
  const spojSuseda = useMemo(() => {
    if (vybraneMiesto === undefined || miestoVolby === null) return null;
    let sused: NahladVylozenia["sused"] = null;
    const indexy = new Set<number>();
    for (const n of vybraneMiesto.karty.values()) {
      if (n.sused === null || n.pary.length === 0) continue;
      sused = n.sused;
      for (const p of n.pary) indexy.add(p.index);
    }
    if (sused === null) return null;
    const otocena = sused.stred ? view.lokalitaOtocena !== (ja === 1) : sused.majitel !== ja;
    // Z pohľadu hráča sa k novej karte obracia na jeho strane ľavá hrana suseda, na súperovej pravá.
    const vPohlade: "left" | "right" = miestoVolby === "vlastna" ? "left" : "right";
    const vytlacena: "left" | "right" = otocena ? (vPohlade === "left" ? "right" : "left") : vPohlade;
    const dlzka = printedSides(data, sused.karta)[vytlacena].length;
    const sloty = [...indexy].map((i) => (otocena ? dlzka - 1 - i : i));
    return { uid: sused.karta.uid, spoj: vytlacena === "left" ? { left: sloty, right: [] } : { left: [], right: sloty } };
  }, [vybraneMiesto, miestoVolby, view.lokalitaOtocena, ja, data]);
  const spojPre = (uid: number) => (spojSuseda?.uid === uid ? spojSuseda.spoj : undefined);

  // Kroky s výberom viacerých kariet si pri začiatku pripravia prázdny výber.
  const bs0 = view.bitkaStav;
  const krokVyberu: string | null =
    bs0 !== null && bs0.caka === ja ? (bs0.krok ?? null) : null;
  useEffect(() => {
    if (krokVyberu === "benzinka") setMode({ typ: "vyber", uids: [] });
    else if (krokVyberu === "vestica") setMode({ typ: "vestica", moja: null, jeho: null });
  }, [krokVyberu, klucTahu]);

  const posli = (c: Command): void => {
    cmd(c);
    setMode({ typ: "ziadny" });
    // Vo výučbe môže server ťah odmietnuť radou Melichara („Otoč ho, klikni naň ešte raz“) — návrh
    // ostane na stole, nech ho hráč opraví; prijatý ťah zmení klucTahu a návrh zmizne aj tak.
    if (vyucba !== true) setNavrh(null);
    setVyberLokality(null);
  };
  // Menej klikov (roadmapa #9 B): logika je v usePohodlie a v jadre (pohodlie.ts).
  const bezNaex = useBezNaexVBitke(view, posli);
  const odlozenyPas = useOdlozenyPrikaz(posli, `${klucTahu}|${vylozenia.length}`); // potiahnutá karta pas zruší
  const navrhRozdelenia = navrhPrebytku(data, view);

  // ---- čo sa práve stalo (dizajn hra-20261021-1240, UX N3) -------------------
  // Keď môj ťah skončí, zapamätá sa línia a dĺžka logu. Keď som znova na ťahu,
  // súperove karty, ktoré medzitým pribudli, nesú štítok „nová“ a pás ukáže,
  // čo súper urobil — bez otvárania logu.
  const liniaPoMojomTahu = useRef<ReadonlySet<number> | null>(null);
  const logPoMojomTahu = useRef(log.length);
  useEffect(() => {
    if (somNaTahu) return;
    liniaPoMojomTahu.current = new Set([...view.strany[0], ...view.strany[1]].map((pl) => pl.card.uid));
    logPoMojomTahu.current = log.length;
    // Snímka len pri konci môjho ťahu — nie pri každom súperovom vyložení.
  }, [somNaTahu]);
  // Záverečné odhalené na konci poslednej Pitky (Michal 2026-10-27): karta sa na stole otočí
  // lícom hore a do konca ďalšieho Zhromaždenia nesie štítok — súper (aj bot) často hneď
  // zahrá novú Záverečnú na tú istú stranu a bez neho to vyzerá, akoby sa stará neotočila.
  // Ktoré karty to sú, hovorí rekapitulácia Pitky (udalosť pitkaRekap).
  const [otoceneZaverecne, setOtoceneZaverecne] = useState<{ readonly kolo: number; readonly pitka: number; readonly uids: ReadonlySet<number>; readonly od: number } | null>(null);
  const otoceneTeraz: ReadonlySet<number> =
    otoceneZaverecne !== null && otoceneZaverecne.kolo === view.kolo && otoceneZaverecne.pitka === view.pitkaCislo ? otoceneZaverecne.uids : new Set();
  // Animácia otočenia beží len hneď po Pitke, nie pri každom neskoršom prekreslení.
  const odhalenieCerstve = otoceneZaverecne !== null && Date.now() - otoceneZaverecne.od < ODHALENIE_MS + 600;
  const noveSuperove: readonly number[] =
    somNaTahu && liniaPoMojomTahu.current !== null
      ? [...view.strany[0], ...view.strany[1]]
          .filter((pl) => pl.playedBy === super_ && !(liniaPoMojomTahu.current?.has(pl.card.uid) ?? true))
          .map((pl) => pl.card.uid)
      : [];
  const menoSupera = menoHraca(super_);
  const poslednySuperov: readonly string[] = somNaTahu
    ? log
        .slice(Math.min(logPoMojomTahu.current, log.length))
        .filter((r) => r.includes(menoSupera) && !r.startsWith("⚠"))
        .slice(-2)
    : [];

  // Účet Pitky a bitky (UX N2/N3, UI N5 „bloček“ v striedmej podobe): čo
  // vyhodnotenie komu pripísalo — inak to bolo len v logu a skóre skočilo bez súhrnu.
  const [ucetPitky, setUcetPitky] = useState<UcetPitky | null>(null);
  const vysledokBitky = useRef<Extract<Event, { type: "bitkaVysledok" }> | null>(null);
  // Počítadlo bitky (Michal 2026-10-23) a pod ním rekapitulácia; po Pitke jej rekapitulácia
  // (roadmapa #106). Vrstvy idú po rade, na stole je vždy len prvá z fronty, a každú zavrie až
  // hráč (Ďalej). Stôl bitky je ten s líniou — keď bitka hneď skončila
  // a línia už zmizla, predošlý pohľad.
  const [frontaVrstiev, setFrontaVrstiev] = useState<readonly VrstvaVyhodnotenia[]>([]);
  const vrstvaVyhodnotenia = frontaVrstiev[0] ?? null;
  const pocitadlo = vrstvaVyhodnotenia?.druh === "bitka" ? vrstvaVyhodnotenia : null;
  const pocitadloAktivne = useRef(false);
  const koniecPocitadla = useCallback(() => {
    setFrontaVrstiev((f) => {
      pocitadloAktivne.current = f.length > 1;
      return f.slice(1);
    });
  }, []);
  // Kým sa na stole otáča Záverečná, rekapitulácia Pitky čaká (ODHALENIE_MS).
  const [cakaOdhalenie, setCakaOdhalenie] = useState(false);
  const casovacOdhalenia = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (casovacOdhalenia.current !== null) clearTimeout(casovacOdhalenia.current);
  }, []);
  const pocitadloBezi = vrstvaVyhodnotenia !== null || cakaOdhalenie;
  useEffect(() => onPocitadlo?.(pocitadloBezi), [pocitadloBezi, onPocitadlo]);
  useEffect(() => {
    const nove: VrstvaVyhodnotenia[] = [];
    const events = udalosti?.events ?? [];
    let odhalenie = false;
    for (const [i, e] of events.entries()) {
      const zaverecne = e.type === "pitkaRekap" ? (e.rekap.zaverecne ?? []) : [];
      if (e.type === "pitkaRekap" && zaverecne.length > 0) {
        odhalenie = true;
        setOtoceneZaverecne({ kolo: view.kolo, pitka: e.rekap.pitka, uids: new Set(zaverecne.map((z) => z.uid)), od: Date.now() });
      }
      if (e.type === "pitkaVysledok") setUcetPitky({ kolo: view.kolo, pitka: e.pitka, cirhozy: e.cirhozy, dlhy: e.dlhy, cigarety: e.cigarety });
      // Poslednú Pitku kola ukáže rekapitulácia bitky („z Pitiek kola“), nie vlastná vrstva (Michal 2026-10-26).
      if (e.type === "pitkaRekap" && !pitkaPredBitkou(events, i)) {
        const ciel = view.ciel ?? predoslyView.current?.ciel ?? null;
        const lok = ciel?.lokalita ?? null;
        nove.push({ druh: "pitka", r: e.rekap, nadpis: `Pitka ${e.rekap.pitka} / ${e.rekap.pitkyCelkom}${lok === null ? "" : ` · ${menoKarty(lok.defId)}`}` });
      }
      if (e.type === "bitkaVysledok") {
        vysledokBitky.current = e;
        const stol = view.ciel !== null && view.strany.some((s) => s.length > 0) ? view : (predoslyView.current ?? view);
        if (stol.ciel !== null) {
          const linia = evaluateLine(data, lineState(stol));
          nove.push({ druh: "bitka", p: pocitadloBitky(data, stol, linia, e.damage.tuhe), stol, linia, rekap: e.rekap ?? null });
        }
      }
    }
    if (nove.length === 0) return;
    pocitadloAktivne.current = true;
    // Prehrávač pri posúvaní nehromadí vrstvy — ukáže len tú z práve zobrazeného kroku.
    if (prehravanie !== undefined) setFrontaVrstiev(nove);
    else if (zadrzBitku === null) {
      // Stôl ostane taký, aký bol na konci Pitky, kým hráč rekapituláciu nezavrie.
      if (vyucba !== true && nove.some((v) => v.druh === "pitka")) setZadrzanyView((z) => z ?? viewZoServera);
      if (odhalenie) {
        // Najprv nech hráč vidí, ako sa Záverečná na stole otočí, až potom rekapitulácia.
        setCakaOdhalenie(true);
        if (casovacOdhalenia.current !== null) clearTimeout(casovacOdhalenia.current);
        casovacOdhalenia.current = setTimeout(() => {
          casovacOdhalenia.current = null;
          setFrontaVrstiev((f) => [...f, ...nove]);
          setCakaOdhalenie(false);
        }, ODHALENIE_MS);
      } else setFrontaVrstiev((f) => [...f, ...nove]);
    } else setOdlozeneBitky((o) => ({ krok: zadrzBitku, vrstvy: [...(o?.vrstvy ?? []), ...nove] }));
    // Len nové udalosti — view.kolo je to isté prekreslenie.
  }, [udalosti?.id]);
  // Odložené vrstvy sa spustia, keď výučba prejde na ďalší krok — ešte pred vykreslením, aby text
  // nového kroku nebolo vidno skôr než animáciu.
  const [odlozeneBitky, setOdlozeneBitky] = useState<{ readonly krok: string; readonly vrstvy: readonly VrstvaVyhodnotenia[] } | null>(null);
  useLayoutEffect(() => {
    if (odlozeneBitky === null || odlozeneBitky.krok === zadrzBitku) return;
    setFrontaVrstiev((f) => [...f, ...odlozeneBitky.vrstvy]);
    setOdlozeneBitky(null);
  }, [odlozeneBitky, zadrzBitku]);
  // Rekapitulácia Pitky zavretá (Ďalej) — stôl dobehne na to, čo medzitým poslal server.
  useEffect(() => {
    if (zadrzanyView !== null && !cakaOdhalenie && !frontaVrstiev.some((v) => v.druh === "pitka")) setZadrzanyView(null);
  }, [zadrzanyView, cakaOdhalenie, frontaVrstiev]);
  const [ucetBitky, setUcetBitky] = useState<UcetBitky | null>(null);
  const [ucetBitkyZavrety, setUcetBitkyZavrety] = useState(false);
  const predoslyView = useRef<ClientState | null>(null);
  const viewPredBitkou = useRef<ClientState | null>(null);
  useEffect(() => {
    const pred = predoslyView.current;
    predoslyView.current = view;
    if (pred === null) return;
    if (view.faza === "bitka" && pred.faza !== "bitka") viewPredBitkou.current = pred;
    const skoncila = view.kolo > pred.kolo || (view.koniec !== null && pred.koniec === null && pred.ciel !== null);
    if (!skoncila) return;
    const zaklad = viewPredBitkou.current !== null && viewPredBitkou.current.kolo === pred.kolo ? viewPredBitkou.current : pred;
    viewPredBitkou.current = null;
    const v = vysledokBitky.current;
    vysledokBitky.current = null;
    // v6: lokalita ide na nástenku; víťaz dostane špaky, pri sekere čakajú (vo finále prepadnú).
    const bitka = view.nastenka.find((b) => b.kolo === pred.kolo) ?? null;
    const posuny = view.starsi.flatMap((e) => {
      const a = zaklad.starsi.find((x) => x.elderId === e.elderId);
      return a === undefined || a.marker === e.marker ? [] : [{ meno: menoKarty(e.karta.defId), pred: a.marker, po: e.marker }];
    });
    setUcetBitky({
      kolo: pred.kolo,
      lokalita:
        zaklad.ciel === null || zaklad.ciel.lokalita === null
          ? zaklad.ciel?.typ === "finale" ? "Finále" : ""
          : `${zaklad.ciel.typ === "finale" ? "Finále · " : ""}${menoKarty(zaklad.ciel.lokalita.defId)}`,
      tuhe: v?.damage.tuhe ?? [0, 0],
      vitaz: v?.vitaz ?? null,
      prebytok: v?.prebytok ?? 0,
      prebytokNaRozdelenie: v?.prebytokNaRozdelenie ?? 0,
      prebytokDrzi: v?.prebytokDrzi ?? null,
      bitka,
      posuny,
      // Pred bitkou = po nej mínus to, čo bitka dala (pohľad pred výsledkom nemusí byť k dispozícii).
      spakyPred: bitka === null ? [zaklad.spaky[0], zaklad.spaky[1]] : spakyPredBitkou(bitka),
    });
    setUcetBitkyZavrety(false);
    // Porovnáva sa len predošlý a nový pohľad.
  }, [view]);
  // Účet bitky ostane nad stolom, kým ho hráč nezavrie alebo kým sa v novom kole nezačne vykladať.
  const ukazUcetBitky =
    ucetBitky !== null && !ucetBitkyZavrety && view.kolo === ucetBitky.kolo + 1 && (view.faza === "volbaCiela" || view.faza === "draft");

  // Titulok karty prehliadača — hráč v inej karte vidí, že je na ťahu (UX N1, U9).
  useEffect(() => {
    const povodny = document.title;
    return () => {
      document.title = povodny;
    };
  }, []);
  useEffect(() => {
    document.title =
      view.koniec !== null
        ? "Koniec partie · NA EX!"
        : somNaTahu
          ? `● Tvoj ťah — ${NAZOV_FAZY[view.faza] ?? ""} · NA EX!`
          : `Na ťahu je ${menoSupera} · NA EX!`;
  }, [somNaTahu, view.faza, view.koniec, menoSupera]);

  // Posun k miestu ťahu pri zmene fázy alebo kroku (UX N1, U3): aktívna plocha
  // pod časovú os. Nie, ak hráč za posledné 3 s sám roloval, a bez animácie pri
  // prefers-reduced-motion.
  const cielPanelRef = useRef<HTMLElement>(null);
  const draftPanelRef = useRef<HTMLElement>(null);
  const liniaObalRef = useRef<HTMLDivElement>(null);
  const posledneRolovanie = useRef(0);
  useEffect(() => {
    const zaznamenaj = (): void => {
      posledneRolovanie.current = Date.now();
    };
    window.addEventListener("wheel", zaznamenaj, { passive: true });
    window.addEventListener("touchmove", zaznamenaj, { passive: true });
    return () => {
      window.removeEventListener("wheel", zaznamenaj);
      window.removeEventListener("touchmove", zaznamenaj);
    };
  }, []);
  useEffect(() => {
    if (!somNaTahu || view.koniec !== null || Date.now() - posledneRolovanie.current < 3000) return;
    const krok = view.bitkaStav?.krok;
    const el: HTMLElement | null =
      view.faza === "volbaCiela"
        ? cielPanelRef.current
        : view.faza === "draft"
          ? (draftPanelRef.current ?? liniaObalRef.current)
          : view.faza === "bitka" && (krok === "pohorsenie" || krok === "prebytok")
            ? liniaObalRef.current
            : liniaObalRef.current;
    if (el === null) return;
    const r = el.getBoundingClientRect();
    const hore = vyskaHlavicky + 56;
    const dole = window.innerHeight - 170;
    // Už je vidno — nič.
    if (r.top >= hore && r.top <= Math.max(hore, dole)) return;
    const rychlo = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
    window.scrollTo({ top: Math.max(0, r.top + window.scrollY - hore), behavior: rychlo ? "auto" : "smooth" });
    // klucTahu zahŕňa fázu, ťah aj krok bitky.
  }, [klucTahu, somNaTahu]);

  const volimLokalitu = somNaTahu && view.faza === "volbaCiela" && view.koniec === null;
  const vybranaLokalita = view.lokalityVHre.find((k) => k.uid === vyberLokality);
  /** Nakliknutá lokalita ide na stôl ako návrh — otočiť a potvrdiť sa dá tam. */
  const umiestniLokalitu = (): void => {
    if (vybranaLokalita === undefined) return;
    setNavrh({ typ: "lokalita", uid: vybranaLokalita.uid, otocena: ja === 1 });
    setVyberLokality(null);
    setVrstva(null);
  };
  /** Klik na kartu v šenku: pridá ju do výberu (do limitu), opätovný klik ju vráti. */
  const prepniZoSenku = (uid: number): void => {
    const uids = zoSenku.map((k) => k.uid);
    if (uids.includes(uid)) setNavrh({ typ: "zoSenku", uids: uids.filter((u) => u !== uid) });
    else if (uids.length < zoSenkuLimit) setNavrh({ typ: "zoSenku", uids: [...uids, uid] });
    else if (zoSenkuLimit === 1) setNavrh({ typ: "zoSenku", uids: [uid] });
  };
  const zrus = (): void => {
    setMode({ typ: "ziadny" });
    setNavrh(null);
  };

  // ---- ťahanie ----------------------------------------------------------------
  /** Kam smie karta zo zdroja ísť (hodnoty data-ciel). */
  const cieleZdroja = (z: Zdroj): ReadonlySet<string> => {
    const out = new Set<string>();
    // Preskladať ruku smie hráč kedykoľvek, aj keď nie je na ťahu.
    if (z.odkial === "ruka" && !z.navrh) {
      for (const k of ruka) if (k.uid !== z.karta.uid) out.add(PORADIE + k.uid);
      out.add(PORADIE + "koniec");
    }
    if (!somNaTahu || view.koniec !== null) return out;
    if (z.odkial === "stavba" && stavim) {
      if (krokSt.odhod > 0) out.add(SMETISKO);
      if (odhodStavby.includes(z.karta.uid)) out.add(BALICEK_STAVBY);
    }
    const zs = view.zhromazdenieStav;
    if (z.odkial === "ruka" && view.faza === "zhromazdenie" && zs !== null && !zs.pasoval[ja]) {
      // Karta smie tam, kam ju pustí celý ťah (aj s cenou ďalších kariet v poldeci).
      const bez = vylozenia.filter((x) => x.karta.uid !== z.karta.uid);
      for (const c of CIELE_VYKLADANIA as readonly CielVykladania[]) {
        if (planTahu([...bez, { karta: z.karta, ciel: c }]).chyba === null) out.add(c);
      }
      // Na miesto navrhnutej karty: nahradí ju.
      for (const x of bez) {
        if (planTahu(bez.map((y) => (y === x ? { karta: z.karta, ciel: x.ciel } : y))).chyba === null) out.add(NAHRADIT + x.karta.uid);
      }
      if (z.navrh) out.add("ruka");
    }
    if (z.odkial === "ruka" && reagujem) {
      for (const c of cieleVykladania(data, view.strany, ja, z.karta, Number.POSITIVE_INFINITY, true, cielLokalitaId(view), zablokovaneStrany(view))) {
        if (c === "vlastna" || c === "superova") out.add(c);
      }
      if (z.navrh) out.add("ruka");
    }
    if (z.odkial === "senok" && zoSenkuLimit > 0) {
      if (z.navrh) {
        out.add("senok");
      } else {
        if (zoSenku.length < zoSenkuLimit) out.add("ruka");
        for (const k of zoSenku) out.add(NAHRADIT + k.uid);
      }
    }
    if (z.odkial === "lokality" && view.faza === "volbaCiela") {
      // Navrhnutú lokalitu vráti pravý klik na stole — tlačidlo Nástenka, kam sa púšťala, zaniklo.
      if (!z.navrh) out.add("lokalita");
    }
    return out;
  };

  // Kde hráč pustil kartu: položená karta sa objaví pod nehybnou myšou a jej lupa zakryla
  // tlačidlá návrhu (UI inšpekcia, výučba kolo 4) — lupa sa ukáže, až keď myš odíde z miesta.
  const poPusteni = useRef<{ readonly x: number; readonly y: number } | null>(null);
  const pusti = (z: Zdroj, ciel: string | null, bod: { readonly x: number; readonly y: number }): void => {
    poPusteni.current = bod;
    // Karta ťahaná zo zväčšenej kópie — lupa by po pustení visela na starom mieste.
    setLupa(null);
    setMiestoVolby(null);
    setChybaTahania(null);
    // Mimo povoleného miesta sa karta vráti tam, kde bola. Keď ju hráč chcel vyložiť,
    // povie to hláška — ticho bolo horšie než samo zlyhanie (playtest výučby 2026-10-23).
    // Pustenie späť nad ruku je zrušenie, to hlášku nepotrebuje.
    if (ciel === null || !cieleZdroja(z).has(ciel)) {
      // Aj pri vyčerpanom limite (žiadny cieľ) — vtedy hláška povie prečo a čo ďalej.
      const vykladal = z.odkial === "ruka" && !z.navrh && vykladam;
      if (vykladal && document.elementFromPoint(bod.x, bod.y)?.closest(".ruka") == null) {
        const miesta = [...moznostiMiesta.values()];
        const text = textNepolozenejKarty({
          ciele: cieleZdroja(z),
          plus: miesta.some((m) => m.dovod === null),
          dovodStola: miesta.find((m) => m.dovod !== null)?.dovod ?? null,
          pas: view.faza === "zhromazdenie",
        });
        setChybaTahania({ text, ...bod });
      }
      return;
    }
    if (ciel.startsWith(PORADIE)) {
      const kam = ciel.slice(PORADIE.length);
      presunVRuke(z.karta.uid, kam === "koniec" ? null : Number(kam));
      return;
    }
    if (z.odkial === "stavba") {
      doZonyStavby(z.karta.uid, ciel === SMETISKO);
      return;
    }
    if (z.odkial === "ruka") {
      const bez = vylozenia.filter((x) => x.karta.uid !== z.karta.uid).map((x) => ({ uid: x.karta.uid, ciel: x.ciel }));
      if (ciel === "ruka") {
        setNavrh(bez.length === 0 ? null : { typ: "vylozenia", polozky: bez });
      } else if (ciel.startsWith(NAHRADIT)) {
        const stara = Number(ciel.slice(NAHRADIT.length));
        setNavrh({ typ: "vylozenia", polozky: bez.map((x) => (x.uid === stara ? { uid: z.karta.uid, ciel: x.ciel } : x)) });
      } else if (jeCielVykladania(ciel)) {
        setNavrh({ typ: "vylozenia", polozky: reagujem ? [{ uid: z.karta.uid, ciel }] : [...bez, { uid: z.karta.uid, ciel }] });
      }
    } else if (z.odkial === "senok") {
      const uids = zoSenku.map((k) => k.uid);
      if (ciel === "senok") {
        setNavrh({ typ: "zoSenku", uids: uids.filter((u) => u !== z.karta.uid) });
      } else if (ciel === "ruka") {
        setNavrh({ typ: "zoSenku", uids: [...uids, z.karta.uid] });
      } else if (ciel.startsWith(NAHRADIT)) {
        const stara = Number(ciel.slice(NAHRADIT.length));
        setNavrh({ typ: "zoSenku", uids: uids.map((u) => (u === stara ? z.karta.uid : u)) });
      }
    } else if (ciel === "lokalita") {
      // Náhrada inou lokalitou si nechá zvolené natočenie.
      setNavrh({ typ: "lokalita", uid: z.karta.uid, otocena: lokalitaNavrh?.otocena ?? ja === 1 });
      // Lokalita je vybraná — vrstva by už len zavadzala pri otáčaní a potvrdení.
      setVrstva(null);
    } else {
      setNavrh(null);
    }
  };

  // Hláška leží tam, kde hráč kartu pustil — to miesto je prázdne. Na stole by
  // zakryla lokalitu a „+“, kam hovorí kartu pustiť (UI inšpekcia 2026-10-24).
  const [chybaTahania, setChybaTahania] = useState<{ readonly text: string; readonly x: number; readonly y: number } | null>(null);
  useEffect(() => setChybaTahania(null), [klucTahu]);
  useEffect(() => {
    if (chybaTahania === null) return;
    const t = setTimeout(() => setChybaTahania(null), ZOBRAZENIE_CHYBY_TAHANIA_MS);
    return () => clearTimeout(t);
  }, [chybaTahania]);
  const chybaTahaniaRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = chybaTahaniaRef.current;
    if (el === null || chybaTahania === null) return;
    const p = polohaChybyTahania(chybaTahania, el.offsetWidth, el.offsetHeight);
    el.style.left = `${p.x}px`;
    el.style.top = `${p.y}px`;
  }, [chybaTahania]);
  const { tahanie, zacni, duchRef } = useTahanie(pusti);

  // ---- lupa nad kartami na stole a vo vrstvách ----------------------------
  // Michal 2026-10-22: karta sa zväčší pri prejdení myšou (predtým klikom) a susedia
  // v tom istom rade uhnú do strán ako v ruke (harmonika v hra.css). Klik ostáva
  // herným akciám — lupa leží nad kartou a klik na ňu urobí to isté ako na kartu.
  // zFokusu: lupu otvoril fokus z klávesnice, zavrie ju jeho strata.
  // prechod: lupa sa preniesla zo susednej karty — nastúpi jemnejšie (bez skoku zo 50 %).
  const [lupa, setLupa] = useState<{ readonly kluc: string; readonly rect: DOMRect; readonly zFokusu?: boolean; readonly prechod?: boolean } | null>(null);
  // Lupa, ktorú myš práve opustila, chvíľu doznieva (Michal 2026-10-23: prechod z karty
  // na kartu „trhal“ — stará lupa zmizla naraz a nová skočila na miesto).
  const [doznieva, setDoznieva] = useState<{ readonly kluc: string; readonly rect: DOMRect } | null>(null);
  useEffect(() => {
    if (doznieva === null) return;
    const t = setTimeout(() => setDoznieva(null), DOZNIEVANIE_LUPY_MS);
    return () => clearTimeout(t);
  }, [doznieva]);
  // Čo je pod lupou v tomto prekreslení — lupa kreslí vždy živý stav.
  const lupaKarty = new Map<
    string,
    {
      readonly render: (sirka: number) => ReactNode;
      readonly mierka?: number;
      /** Lupa nad prvkom, nie cez neho (starší v rade — susedia ostanú voľní). */
      readonly nad?: boolean;
      readonly zdroj?: Zdroj;
      readonly odstran?: (() => void) | undefined;
    }
  >();
  /** Zväčší kartu pod prvkom `el` (myš, fokus, na dotyku ťuknutie). */
  const otvorLupu = (kluc: string, el: Element | null | undefined, zFokusu = false, prechod = false): void => {
    // Časovač prejdenia myšou mohol dobehnúť až počas ťahania — stav `tahanie` v ňom je starý.
    if (tahanie === null && !document.body.classList.contains("tahanie-aktivne") && el != null) setLupa({ kluc, rect: bezPosunuHarmoniky(el), zFokusu, prechod });
  };
  const casovacLupy = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lupaZavreta = useRef<{ readonly kluc: string; readonly cas: number } | null>(null);
  // Ako nájsť kartu prvku s lupou (data-lupa) — pre prechod na susednú kartu.
  const najdiLupu = new Map<string, (el: HTMLElement) => Element | null>();
  /**
   * Zavrie lupu. Keď z nej myš odišla na susednú kartu, otvorí hneď lupu tej
   * karty — inak by sa susedia vrátili na miesto (harmonika) a karta pod
   * myšou by uskočila (Bugfixing 2026-10-22, stavba šenku). Poloha novej lupy
   * je tam, kde karta skončí, keď sa stane aktívnou: bez posunu harmoniky.
   */
  const zavriLupu = (kde?: { readonly x: number; readonly y: number }): void => {
    if (lupa !== null) lupaZavreta.current = { kluc: lupa.kluc, cas: Date.now() };
    const dalsia = kde === undefined || tahanie !== null || lupa === null ? null : lupaPodMysou(kde.x, kde.y, lupa);
    // Pri odchode myši stará lupa dozneje; pri kliku, Esc či ťahaní zmizne hneď.
    if (lupa !== null && kde !== undefined && tahanie === null) setDoznieva({ kluc: lupa.kluc, rect: lupa.rect });
    setLupa(dalsia === null ? null : { ...dalsia, prechod: true });
  };
  /**
   * Poloha karty, keď sa stane aktívnou: bez posunu harmoniky. Počas uhýbania
   * susedov je karta v pohybe a jej okamžitá poloha by lupu postavila vedľa.
   */
  const bezPosunuHarmoniky = (ciel: Element): DOMRect => {
    let posun = 0;
    for (let a: Element | null = ciel; a !== null; a = a.parentElement) {
      const rodic = a.parentElement;
      if (rodic?.classList.contains("harmonika") === true || rodic?.classList.contains("harmonika-skupiny") === true) {
        const t = getComputedStyle(a).transform;
        if (t !== "none") posun += new DOMMatrixReadOnly(t).m41;
      }
    }
    const r = ciel.getBoundingClientRect();
    return new DOMRect(r.x - posun, r.y, r.width, r.height);
  };
  /**
   * Karta, na ktorú myš odišla z lupy. Susedia uhýbajú o kúsok viac, než lupa
   * narástla, takže medzi lupou a susedom je medzera — keby lupa v nej zhasla,
   * susedia by sa vrátili a hneď znova uhli (blikanie). Preto sa hľadá aj kúsok
   * ďalej v smere pohybu.
   */
  const lupaPodMysou = (
    x: number,
    y: number,
    terajsia: { readonly kluc: string; readonly rect: DOMRect },
  ): { readonly kluc: string; readonly rect: DOMRect } | null => {
    const smer = Math.sign(x - (terajsia.rect.left + terajsia.rect.width / 2));
    for (const d of [0, 8, 16, 24]) {
      const el = document
        .elementsFromPoint(x + smer * d, y)
        .find(
          (e): e is HTMLElement =>
            e instanceof HTMLElement &&
            e.dataset.lupa !== undefined &&
            e.dataset.lupa !== terajsia.kluc &&
            lupaKarty.has(e.dataset.lupa) &&
            e.closest(".lupa") === null,
        );
      const kluc = el?.dataset.lupa;
      const ciel = el === undefined || kluc === undefined ? null : (najdiLupu.get(kluc)?.(el) ?? null);
      if (kluc !== undefined && ciel !== null) return { kluc, rect: bezPosunuHarmoniky(ciel) };
    }
    return null;
  };
  useEffect(() => () => clearTimeout(casovacLupy.current), []);
  // Lupa po ťahaní ostala visieť nad miestami a tlačidlami (playtest výučby U2): zavrie sa
  // pri začiatku ťahania, pri novom ťahu (karta pod ňou sa presunula) a na požiadanie
  // výučby pri novom kroku (udalosť naex:zavri-lupu — Escape by zrušil aj výber).
  const zavriLupuHned = useCallback((): void => {
    clearTimeout(casovacLupy.current);
    setLupa(null);
    setDoznieva(null);
  }, []);
  useEffect(() => {
    if (tahanie !== null) zavriLupuHned();
  }, [tahanie !== null, zavriLupuHned]);
  useEffect(zavriLupuHned, [klucTahu, view.strany[0].length + view.strany[1].length, zavriLupuHned]);
  useEffect(() => {
    window.addEventListener("naex:zavri-lupu", zavriLupuHned);
    return () => window.removeEventListener("naex:zavri-lupu", zavriLupuHned);
  }, [zavriLupuHned]);

  // Pauza po súperovej voľbe cieľa (roadmapa #102): stavbu šenku robia obaja naraz, takže
  // hráč by súperovu voľbu prebehol — stôl ju na chvíľu ukáže a prvý klik či kláves ju len zruší.
  // Vo výučbe lokalitu ukazuje Melichar svojím krokom, v prehrávači tempo určuje hráč.
  const [pauzaCiela, setPauzaCiela] = useState<PauzaCiela | null>(null);
  const predVolbouCiela = useRef<ClientState | null>(null);
  useLayoutEffect(() => {
    const pred = predVolbouCiela.current;
    predVolbouCiela.current = view;
    if (vyucba === true || prehravanie !== undefined) return;
    const nova = pauzaPoVolbeCiela(pred, view);
    if (nova !== null) setPauzaCiela(nova);
    else if (pauzaCiela !== null && (view.kolo !== pauzaCiela.kolo || view.koniec !== null)) setPauzaCiela(null);
  }, [view]);
  // Kým beží počítadlo bitky, pauza počká — inak by jej 3 s ubehli pod ním.
  const pauzaBezi = pauzaCiela !== null && !pocitadloBezi;
  const zrusPauzuCiela = useCallback((): void => setPauzaCiela(null), []);
  // ---- medziobrazovky pri prechode fáz (Michal 2026-10-27) ------------------
  // Pri výbere lokality, šenku, Zhromaždení, Pitke, bitke a prebytku (aj v novom kole a vo finále,
  // ktoré tak nahradilo starý oznam) sa ukáže názov fázy a čo sa ide diať; ostane do „Rozumiem“. Vypínač v profile, výučba má vlastné
  // bubliny. Bitka čaká s počítadlom, kým hráč neklikne — inak by prebehlo pod medziobrazovkou.
  const medziZapnute = useUcet().ja?.medziobrazovky !== false && vyucba !== true && prehravanie === undefined;
  const medziTeraz = medziobrazovka(view, ja, menoHraca(super_), pocitadlo !== null ? pocitadlo.stol.kolo : null);
  // Pri načítaní stola sa za videnú berie fáza, ktorá už beží — okrem začiatku partie.
  const [potvrdenaMedzi, setPotvrdenaMedzi] = useState<string | null>(() =>
    view.kolo === 1 && view.faza === "volbaCiela" ? null : (medziTeraz?.kluc ?? null),
  );
  const medziCaka = medziZapnute && medziTeraz !== null && medziTeraz.kluc !== potvrdenaMedzi;
  // Krátka chvíľa, kým sa stôl ustáli (bitka a nové kolo prídu naraz, počítadlo až po nich).
  const [medziUstalena, setMedziUstalena] = useState<string | null>(null);
  const klucMedzi = medziCaka ? medziTeraz.kluc : null;
  useEffect(() => {
    if (klucMedzi === null) return;
    const t = setTimeout(() => setMedziUstalena(klucMedzi), MEDZIOBRAZOVKA_MS);
    return () => clearTimeout(t);
  }, [klucMedzi]);
  const medziViditelna =
    medziCaka &&
    medziUstalena === medziTeraz.kluc &&
    !pauzaBezi &&
    !cakaOdhalenie &&
    (vrstvaVyhodnotenia === null || pocitadlo !== null);
  useEffect(() => {
    if (!pauzaBezi) return;
    zavriLupuHned();
    const t = setTimeout(zrusPauzuCiela, PAUZA_CIELA_MS);
    // Kláves pauzu zruší a ďalej nejde — skratka by inak odoslala ťah stavby.
    const klaves = (e: KeyboardEvent): void => {
      if (!klavesPreskociPauzu(e.key)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      zrusPauzuCiela();
    };
    window.addEventListener("keydown", klaves, true);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", klaves, true);
    };
  }, [pauzaBezi, zrusPauzuCiela, zavriLupuHned]);
  // Okno okolo lokality v strede línie — meria sa po vykreslení, pri posune aj zmene okna.
  const [oknoPauzy, setOknoPauzy] = useState<DOMRect | null>(null);
  useLayoutEffect(() => {
    if (!pauzaBezi) {
      setOknoPauzy(null);
      return;
    }
    const zmeraj = (): void => setOknoPauzy(lokalitaRef.current?.getBoundingClientRect() ?? null);
    zmeraj();
    window.addEventListener("scroll", zmeraj, true);
    window.addEventListener("resize", zmeraj);
    return () => {
      window.removeEventListener("scroll", zmeraj, true);
      window.removeEventListener("resize", zmeraj);
    };
  }, [pauzaBezi]);
  // Susedia uhnú o polovicu prírastku šírky lupy (harmonika v hra.css) — pred
  // vykreslením, aby sa susedia nepohli najprv o starý posun.
  useLayoutEffect(() => {
    if (lupa === null) return;
    const lk = lupaKarty.get(lupa.kluc);
    const mierka = Math.min(lk?.mierka ?? mierkaLupy, maxMierkaLupy(lupa.rect));
    document.body.style.setProperty("--harmonika-posun", `${Math.round((lupa.rect.width * (mierka - 1)) / 2 + 6)}px`);
    return () => {
      document.body.style.removeProperty("--harmonika-posun");
    };
    // lupaKarty sa skladá pri každom kreslení — stačí kľúč a poloha lupy.
  }, [lupa, mierkaLupy]);
  // Uhnuté skupiny línie môžu presiahnuť jej šírku. Línia, ktorá sa v pokoji
  // neposúva, by vtedy ukázala vodorovný posuvník (skok výšky stola) a prichytenie
  // lokality do stredu by ju posunulo — udalosť scroll lupu zavrela, preto lupa
  // pri prechode myšou „trhala“ (Michal 2026-10-23). Kým je lupa otvorená, línia
  // si drží stav z pokoja (hra.css .linia.lupa-v-pokoji).
  const liniaVPokoji = useRef<boolean | null>(null);
  useLayoutEffect(() => {
    const l = liniaRef.current;
    if (l === null) return;
    if (lupa === null) {
      liniaVPokoji.current = null;
      l.classList.remove("lupa-v-pokoji");
      return;
    }
    if (liniaVPokoji.current === null) liniaVPokoji.current = l.scrollWidth <= l.clientWidth;
    l.classList.toggle("lupa-v-pokoji", liniaVPokoji.current);
  }, [lupa]);
  /**
   * Udalosti prvku, ktorý sa pri prejdení myšou zväčší. Lupa sa otvorí až po
   * krátkej chvíli (pri prechode cez rad by blikala); hneď po zavretí inej
   * lupy bez čakania, nech sa dá rad prechádzať plynulo. Kartu, z ktorej lupy
   * myš práve odišla, znova neotvorí, kým myš neopustí jej miesto.
   */
  const ONESKORENIE_LUPY_MS = 150;
  /** O koľko px sa musí myš po pustení karty pohnúť, aby sa lupa znova otvárala. */
  const VZDIALENOST_PO_PUSTENI = 60;
  const nadLupou = (kluc: string, najdi: (el: HTMLElement) => Element | null, fokus: boolean) => {
    najdiLupu.set(kluc, najdi);
    return {
      "data-lupa": kluc,
      tabIndex: fokus ? 0 : undefined,
      onPointerEnter: (e: ReactPointerEvent<HTMLElement>): void => {
        if (e.pointerType !== "mouse" || tahanie !== null) return;
        const p = poPusteni.current;
        if (p !== null) {
          if (Math.hypot(e.clientX - p.x, e.clientY - p.y) < VZDIALENOST_PO_PUSTENI) return;
          poPusteni.current = null;
        }
        const z = lupaZavreta.current;
        if (z?.kluc === kluc) return;
        const el = e.currentTarget;
        clearTimeout(casovacLupy.current);
        const plynulo = z !== null && Date.now() - z.cas < 300;
        casovacLupy.current = setTimeout(() => otvorLupu(kluc, najdi(el), false, plynulo), plynulo ? 0 : ONESKORENIE_LUPY_MS);
      },
      onPointerLeave: (): void => {
        clearTimeout(casovacLupy.current);
        if (lupaZavreta.current?.kluc === kluc) lupaZavreta.current = { kluc: "", cas: lupaZavreta.current.cas };
      },
      onFocus: (e: ReactFocusEvent<HTMLElement>): void => {
        if (e.currentTarget.matches(":focus-visible")) otvorLupu(kluc, najdi(e.currentTarget), true);
      },
      onBlur: (): void => setLupa((l) => (l?.kluc === kluc && l.zFokusu === true ? null : l)),
      // Dotyk nemá prejdenie myšou — kartu bez akcie zväčší ťuknutie.
      onClick: jeDotyk && fokus ? (e: ReactMouseEvent<HTMLElement>) => otvorLupu(kluc, najdi(e.currentTarget)) : undefined,
    };
  };
  // Zvislý posun kariet, aby sa akcie na spoji stretli slot pri slote, ráta useZarovnanieLinie z DOM.
  const vLinii = (obsah: ReactNode, kluc?: number): ReactNode => (
    <div key={kluc} className="v-linii">
      {obsah}
    </div>
  );
  /**
   * Karta, ktorá sa klikom zväčší (otočená ostane otočená, ako na stole). Ak klik
   * na kartu niečo robí (výber, NA EX…), zväčší ju tlačidlo v rohu.
   * `obsah` nahradí holú kartu (napr. ťahateľným obalom), `zdroj` dovolí
   * chytiť ju aj zo zväčšenej kópie,
   * `odstran` je pravý klik (aj na zväčšenú kópiu).
   */
  const sLupou = (
    props: Omit<HernaKartaProps, "sada" | "data">,
    moznosti: {
      readonly obsah?: ReactNode;
      readonly zdroj?: Zdroj;
      readonly kluc?: number;
      readonly trieda?: string | undefined;
      readonly odstran?: (() => void) | undefined;
      /** Nápoveda celej karty (napr. prečo naň NA EX nejde). */
      readonly titul?: string;
      /** Štítok cez kartu (napr. „nová“ pri súperovom ťahu). */
      readonly stitok?: ReactNode;
      /** Bez lupy — na karte ležia tlačidlá (voľba zóny v šenku), lupa by ich zakryla. */
      readonly bezLupy?: boolean;
      /** Tieň karty, ktorú vzal súper zo šenku — miesto v rade (odtiaľ odletí animácia). */
      readonly tien?: number;
    } = {},
  ): ReactNode => {
    const uid = props.karta.uid;
    const kluc = `k${uid}`;
    // Lupa ukáže kartu tak, ako leží na stole, aj otočenú (Michal 2026-10-27) — text sa číta aj tak.
    const render = (sirka: number): ReactNode => karta({ ...props, sirka });
    if (moznosti.bezLupy !== true) lupaKarty.set(kluc, { render, ...(moznosti.zdroj === undefined ? {} : { zdroj: moznosti.zdroj }), odstran: moznosti.odstran });
    const maAkciu = props.onClick !== undefined;
    const triedy = ["s-lupou", maAkciu ? "ma-akciu" : "", lupa?.kluc === kluc ? "harmonika-aktivna" : ""];
    if (moznosti.trieda !== undefined) triedy.push(moznosti.trieda);
    return (
      <div
        key={moznosti.kluc ?? uid}
        className={triedy.filter((x) => x !== "").join(" ")}
        title={moznosti.titul}
        data-tien={moznosti.tien}
        // Karta s akciou je fokusovateľná sama; ostatné dostanú tabIndex kvôli klávesnici.
        {...nadLupou(kluc, (el) => el.querySelector(".kl"), !maAkciu)}
        onContextMenu={pravyKlik(moznosti.odstran)}
      >
        {moznosti.obsah ?? karta(props)}
        {moznosti.stitok}
      </div>
    );
  };
  // Krčmová nástenka (v6, spaky.html bod 12): lokalitu si víťaz neberie — ide na nástenku s jeho fotkou a špakmi.
  const nastenkaEl = (
    sKartami: boolean,
    sirkaKarty = 74,
    ucet = false,
    vyber?: (k: CardInstance, sirka: number) => ReactNode,
    kompaktna = !sKartami,
  ): ReactNode => (
    <Nastenka
      nastenka={view.nastenka}
      zostava={view.lokalityVHre}
      ciel={view.ciel}
      ja={ja}
      mena={[menoHraca(0), menoHraca(1)]}
      avatary={[hraci[0]?.avatar ?? null, hraci[1]?.avatar ?? null]}
      karta={sKartami ? (k, sirka) => karta({ karta: k, sirka }) : undefined}
      menoKarty={menoKarty}
      sirkaKarty={Math.round(sirkaKarty)}
      kompaktna={kompaktna}
      koniec={view.koniec !== null}
      ucet={ucet ? { body, zvyraznit: nastenkaPre } : undefined}
      vyber={vyber}
    />
  );
  const aktivneCiele: ReadonlySet<string> = tahanie === null ? new Set() : cieleZdroja(tahanie.zdroj);
  const jeCiel = (c: string): boolean => aktivneCiele.has(c);
  const nadCielom = (c: string): boolean => tahanie?.ciel === c && jeCiel(c);

  /** Karta, ktorú možno chytiť; s `ciel` je zároveň miestom na nahradenie. */
  const tahatelna = (
    z: Zdroj,
    obsah: ReactNode,
    kluc?: number,
    ciel?: string,
    trieda?: string,
    odstran?: () => void,
    /** Karta v ruke: zastávka klávesnice a klik bez myši (Enter, ťuknutie) — dizajn UX N4. */
    fokus?: { readonly aktivuj: (el: HTMLElement) => void; readonly popis: string; readonly tukni?: boolean },
  ): ReactNode => {
    const moze = cieleZdroja(z).size > 0;
    const ide = tahanie?.zdroj.karta.uid === z.karta.uid;
    const nahraditelna = ciel !== undefined && !ide && jeCiel(ciel);
    const poradie = ciel?.startsWith(PORADIE) === true;
    const triedy = trieda === undefined ? ["tahatelna"] : ["tahatelna", trieda];
    if (moze) triedy.push("chytitelna");
    if (ide) triedy.push("tahana");
    // Nie „navrh“ — tú triedu má karta návrhu v sekcii Playtest (margin 14px) a CSS je spoločné.
    if (z.navrh) triedy.push("navrhnuta");
    if (nahraditelna) triedy.push(poradie ? "poradie-ciel" : "nahraditelna");
    if (nahraditelna && nadCielom(ciel)) triedy.push("nad-cielom");
    // Kam karta v ruke padne: doprava za cieľ, doľava pred neho.
    if (poradie && nahraditelna && tahanie !== null) {
      const uids = ruka.map((k) => k.uid);
      triedy.push(uids.indexOf(Number(ciel.slice(PORADIE.length))) > uids.indexOf(tahanie.zdroj.karta.uid) ? "za" : "pred");
    }
    return (
      <div
        key={kluc}
        className={triedy.join(" ")}
        data-ciel={nahraditelna ? ciel : undefined}
        onPointerDown={moze ? (e) => zacni(z, e) : undefined}
        onDragStart={(e) => e.preventDefault()}
        onContextMenu={pravyKlik(odstran)}
        {...(fokus === undefined
          ? {}
          : {
              tabIndex: 0,
              "aria-label": fokus.popis,
              ...(fokus.tukni === true ? { onClick: (e: React.MouseEvent<HTMLDivElement>) => fokus.aktivuj(e.currentTarget) } : {}),
              onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => {
                if (e.key !== "Enter" && e.key !== " ") return;
                e.preventDefault();
                fokus.aktivuj(e.currentTarget);
              },
            })}
      >
        {obsah}
        {nahraditelna && !poradie && <span className="nahradit-stitok">nahradiť</span>}
      </div>
    );
  };

  /** Prázdne miesto, kam karta smie — ukáže sa len počas ťahania. */
  const miesto = (ciel: string, popis: ReactNode, sirka: number): ReactNode => {
    if (tahanie === null || !jeCiel(ciel)) return null;
    const v = vzhladKarty(sada, data, tahanie.zdroj.karta.defId);
    return (
      <div
        className={`ciel-miesto ${nadCielom(ciel) ? "nad-cielom" : ""}`}
        data-ciel={ciel}
        style={{ width: sirka, height: (sirka * v.vyskaMm) / v.sirkaMm }}
      >
        {popis}
      </div>
    );
  };

  // Miesto pod kurzorom zakrýva ťahaná karta — jeho náhľad zopakuje panel.
  const cielTahania = tahanie?.zdroj.odkial === "ruka" ? tahanie.ciel : null;
  const kamTahania: "vlastna" | "superova" | null =
    (cielTahania === "vlastna" || cielTahania === "superova") && jeCiel(cielTahania) ? cielTahania : null;
  const nahladTahania =
    tahanie !== null && kamTahania !== null ? { ciel: kamTahania, n: nahladVylozeniaNa(tahanie.zdroj.karta, kamTahania) } : null;
  const textNahladuTahania =
    nahladTahania === null ? null : (
      <span className="nahlad-spojov">
        <strong>{menoKarty(tahanie?.zdroj.karta.defId ?? "")}</strong> → {POPIS_CIELA[nahladTahania.ciel]} · {textSpoja(nahladTahania.n)} · ty:{" "}
        {textZmienVylozenia(nahladTahania.n, ja)} · {menoHraca(super_)}: {textZmienVylozenia(nahladTahania.n, super_)}
      </span>
    );

  const zonaTriedy = (ciel: string, zaklad: string): string =>
    [zaklad, jeCiel(ciel) ? "ciel-zona" : "", nadCielom(ciel) ? "nad-cielom" : ""].join(" ");

  // ---- klikanie na karty v línii (NA EX cieľ, Benzínka) -------------------
  const klikLinia = (_majitel: PlayerId, uid: number): (() => void) | undefined => {
    if (mode.typ === "naexCiel") {
      if (!naexCiele.has(uid)) return undefined;
      return () => setMode(mode.uid === uid ? { typ: "ziadny" } : { typ: "naexCiel", uid });
    }
    // Pitka (Michal 2026-10-21): klik na kartu so značkou ju rovno vyberie — pečiatka NA EX! sa ukáže na hrane stola.
    if (naexPriamo && mode.typ === "ziadny" && naexCiele.has(uid)) {
      return () => setMode({ typ: "naexCiel", uid });
    }
    if (benzinkaCiele.has(uid) && mode.typ === "vyber") {
      return () => setMode({ typ: "vyber", uids: mode.uids.includes(uid) ? mode.uids.filter((u) => u !== uid) : [...mode.uids, uid] });
    }
    return undefined;
  };

  // Línia z pohľadu hráča (PRAVIDLA §6): tvoja strana vedie od lokality
  // doľava, súperova doprava — karty sa dotýkajú presne tak, ako sa
  // vyhodnocujú spoje. Karta je otočená, ak ju zahral ten druhý z vás
  // (súperove vlastné karty sú voči tebe nohami hore).
  const kartyStrany = (p: PlayerId): ReactNode[] => {
    const strana = view.strany[p];
    const poradie = p === ja ? [...strana].reverse() : strana;
    return poradie.map((placed) => kartaVLinii(placed));
  };
  const kartaVLinii = (placed: PlacedCard): ReactNode => {
    {
      const uid = placed.card.uid;
      const vybranaBenzinka = mode.typ === "vyber" && benzinkaCiele.has(uid) && mode.uids.includes(uid);
      const otocena = otoceneTeraz.has(uid);
      // Otočená súperova Záverečná je v línii „nová“ — štítok otočenia povie viac.
      const nova = noveSuperove.includes(uid) && !otocena;
      // NA EX na karte je štítok nad kartou, výber pre NA EX nápis pod ňou (Michal 2026-10-21).
      const naexBy = placed.naexBy;
      // NA EX naraz (v5): moje skryté NA EX vidím len ja; zrážka oboch = Výtržník.
      const skryteMoje = mojeSkryteNaex.has(uid);
      const skryteSupera = superoveSkryteNaex.has(uid);
      const vytrznik = placed.vytrznik === true;
      const vybranaNaex = mode.typ === "naexCiel" && mode.uid === uid;
      const presunieSa = presunute.has(uid);
      const stitky =
        nova || otocena || presunieSa || naexBy !== undefined || skryteMoje || skryteSupera || vybranaNaex || placed.zaverecna === true ? (
          <>
            {presunieSa && (
              <span className="nova-stitok" title="Navrhnutá Dohadzovačka túto kartu po potvrdení presunie z druhej strany lokality za seba (na koniec svojej strany).">
                presunie sa za Dohadzovačku
              </span>
            )}
            {nova && (
              <span className="nova-stitok" title={`Vyložil ${menoHraca(super_)} v poslednom ťahu`}>
                nová
              </span>
            )}
            {vytrznik ? (
              <span
                className="naex-nad vytrznik-stitok"
                title={`Zrážka NA EX: obaja ste dali poldeci na túto kartu. Do konca bitky je z nej Výtržník — každá jej akcia je Rana pre ${placed.playedBy === ja ? "teba" : menoHraca(placed.playedBy)}. Po bitke vytriezvie.`}
              >
                <IkonaPoldeci /> Výtržník · Rany pre {placed.playedBy === ja ? "teba" : menoHraca(placed.playedBy)}
              </span>
            ) : naexBy !== undefined ? (
              <span className="naex-nad" title={`NA EX — poldeci hráča ${menoHraca(naexBy)}`}>
                <IkonaPoldeci /> NA EX · {naexBy === ja ? "tvoj" : menoHraca(naexBy)}
              </span>
            ) : (
              <>
                {skryteMoje && (
                  <span className="naex-nad naex-skryte" title={`Tvoje NA EX leží skryto — ${menoHraca(super_)} ho nevidí. Odkryje sa, keď obaja skončíte Pitku.`}>
                    <IkonaPoldeci /> NA EX · tvoj · skryto
                  </span>
                )}
                {skryteSupera && stitokSuperovhoNaex}
              </>
            )}
            {/* Nad kartou ako NA EX — pod ňou zakrýval text efektu (UI inšpekcia); za štítkom NA EX sa posunie vyššie. */}
            {placed.zaverecna === true && (
              <span className="zaverecna-stitok" title="Tvoja Záverečná — súper ju nevidí a nevie, čo dáva; za ňu sa nedá priložiť. Otočí sa na konci Pitky.">
                Záverečná · lícom dole
              </span>
            )}
            {otocena && (
              <span className="zaverecna-stitok" title="Záverečná odhalená na konci Pitky — čo urobila, ukáže rekapitulácia Pitky. Za ňu sa už dá prikladať.">
                Záverečná · odhalená
              </span>
            )}
            {vybranaNaex && <span className="vybrana-pod">vybraná</span>}
          </>
        ) : undefined;
      return sLupou(
        {
          karta: placed.card,
          sirka: sirkaVLinii,
          otocena: placed.playedBy !== ja,
          eval: lineEval.cards.get(uid) ?? null,
          onClick: klikLinia(placed.playedBy, uid),
          vybrana: (mode.typ === "naexCiel" && (mode.uid === uid || zvyraznenaNaex === uid)) || vybranaBenzinka,
          spoj: spojPre(uid),
          vytrznik,
        },
        {
          trieda: [
            naexMozny && naexCiele.has(uid) ? "naex-mozny" : "",
            mode.typ === "naexCiel" && !naexCiele.has(uid) ? "naex-nie" : "",
            naexBy !== undefined || skryteMoje ? "naex-dany" : "",
            skryteSupera ? "naex-supera" : "",
            vytrznik ? "vytrznik" : "",
            nova ? "nova-superova" : "",
            ukazHrozbu === uid ? "hrozba-ciel" : "",
            placed.zaverecna === true ? "zaverecna-moja" : "",
            otocena ? "zaverecna-odhalena" : "",
            otocena && odhalenieCerstve ? "zaverecna-otaca" : "",
          ]
            .join(" ")
            .trim() || undefined,
          ...(mode.typ === "naexCiel" && !naexCiele.has(uid) ? { titul: dovodBezNaexNaKartu(placed) } : {}),
          ...(stitky !== undefined ? { stitok: stitky } : {}),
          // Benzínka: pravý klik vyradí Občana z výberu.
          odstran: vybranaBenzinka && mode.typ === "vyber" ? () => setMode({ typ: "vyber", uids: mode.uids.filter((u) => u !== uid) }) : undefined,
        },
      );
    }
  };
  /** Štítok na navrhnutej karte, za ktorú hráč v tomto ťahu vypije plný poldeci. */
  const stitokPoldeci = (uid: number): ReactNode =>
    view.faza === "zhromazdenie" && poradieVTahu(uid) >= 1 ? (
      <span className="poldeci-stitok" title="Ďalšia karta v tom istom ťahu — vypiješ za ňu plný poldeci (limit −1, pečeň +1, nerest).">
        −1 poldeci
      </span>
    ) : null;
  /** Ťahaná karta by bola v ťahu ďalšia — stojí plný poldeci (Michal 2026-10-19: hra to musí jasne ohlásiť). */
  const tahanaStojiPoldeci =
    tahanie !== null &&
    tahanie.zdroj.odkial === "ruka" &&
    view.faza === "zhromazdenie" &&
    vylozenia.some((x) => x.ciel !== "priznanie" && x.karta.uid !== tahanie.zdroj.karta.uid);
  const varovaniePoldeci = tahanaStojiPoldeci ? (
    <span className="nm-poldeci">ďalšia karta v ťahu: −1 plný poldeci (limit −1)</span>
  ) : null;

  /** Vonkajší koniec strany: navrhnuté karty, a počas ťahania voľné miesto. */
  const naStoleNavrh = nahladZaverecnej && zaverecna?.kroky != null ? polozkySoZaverecnou(vylozenia) : vylozenia;
  const navrhnutaKarta = (x: (typeof naStoleNavrh)[number]): ReactNode => {
    {
      const z: Zdroj = { karta: x.karta, odkial: "ruka", navrh: true };
      const props = {
        karta: x.karta,
        sirka: sirkaVLinii,
        eval: lineEval.cards.get(x.karta.uid) ?? null,
        hranaVnutorna: nahladSpojov?.uid === x.karta.uid ? nahladSpojov.n.vnutornaVytlacena : undefined,
        spoj: spojPre(x.karta.uid),
      };
      const vrat = (): void => vratDoRuky(x.karta.uid);
      const obsah = tahatelna(
        z,
        <>
          {karta(props)}
          {stitokPoldeci(x.karta.uid)}
          {x.zaverecna === true && <span className="zaverecna-stitok">Záverečná · lícom dole</span>}
        </>,
        undefined,
        NAHRADIT + x.karta.uid,
        undefined,
        vrat,
      );
      return sLupou(props, { obsah, zdroj: z, kluc: -100 - x.karta.uid, odstran: vrat });
    }
  };
  const koniecStrany = (p: PlayerId): ReactNode => {
    const ciel: CielVykladania = p === ja ? "vlastna" : "superova";
    const navrhnute = naStoleNavrh.filter((x) => x.ciel === ciel).map(navrhnutaKarta);
    const volne = tahanie === null ? miestoNaKlik(p, ciel) : miestoNaKonci(p, ciel);
    if (navrhnute.length === 0) return volne;
    // Tvoja strana vedie od lokality doľava — najvzdialenejšia karta je vľavo.
    return p === ja ? (
      <>
        {volne}
        {[...navrhnute].reverse()}
      </>
    ) : (
      <>
        {navrhnute}
        {volne}
      </>
    );
  };
  const miestoNaKonci = (p: PlayerId, ciel: "vlastna" | "superova"): ReactNode => {
    // Počas ťahania z ruky ukáže miesto ešte pred pustením, s čím sa karta spojí.
    const nazovMiesta = p === ja ? "na tvoju stranu" : "na súperovu stranu";
    const n = tahanie !== null && tahanie.zdroj.odkial === "ruka" && jeCiel(ciel) ? nahladVylozeniaNa(tahanie.zdroj.karta, ciel) : null;
    const popis =
      n === null ? (
        <>
          {nazovMiesta}
          {varovaniePoldeci}
        </>
      ) : (
        <span className="nahlad-miesto">
          <strong>{nazovMiesta}</strong>
          <span>k lokalite ide tvoja {n.vnutornaVytlacena === "left" ? "ľavá" : "pravá"} hrana</span>
          <span className={n.pary.length > 0 ? "nm-spoj" : "nm-bez"}>{textSpoja(n)}</span>
          <span>ty: {textZmienVylozenia(n, ja)}</span>
          <span>
            {menoHraca(super_)}: {textZmienVylozenia(n, super_)}
          </span>
          {varovaniePoldeci}
        </span>
      );
    const m = miesto(ciel, popis, sirkaVLinii);
    return m === null ? null : vLinii(m, -2);
  };
  /** Úzke miesto na konci strany: klik vysunie z ruky karty, ktoré sa tu spoja. */
  const miestoNaKlik = (p: PlayerId, ciel: StranaLinie): ReactNode => {
    const m = moznostiMiesta.get(ciel);
    if (m === undefined) return null;
    const vybrane = miestoVolby === ciel;
    const moze = m.dovod === null;
    const sSpojom = [...m.karty.values()].filter((n) => n.pary.length > 0).length;
    const nazov = p === ja ? "na tvoju stranu" : "na súperovu stranu";
    const vyska = (sirkaVLinii * 80) / 54;
    const sirkaMiesta = Math.round(sirkaVLinii * MIESTO_VOLBY);
    return vLinii(
      <button
        type="button"
        className={["miesto-volby", vybrane ? "vybrane" : "", moze ? "" : "zakazane"].join(" ")}
        style={{ width: sirkaMiesta, height: vyska }}
        disabled={!moze}
        aria-pressed={vybrane}
        title={
          !moze
            ? (m.dovod ?? "")
            : vybrane
              ? "Vyber kartu z ruky. Zrušíš opätovným klikom, pravým klikom alebo Esc."
              : `Klikni a vyber kartu z ruky ${nazov} — vysunú sa tie, ktoré tu vytvoria spoj.`
        }
        onClick={() => setMiestoVolby(vybrane ? null : ciel)}
        onContextMenu={pravyKlik(vybrane ? () => setMiestoVolby(null) : undefined)}
      >
        <span className="mv-plus" aria-hidden="true">
          {moze ? "+" : "⊘"}
        </span>
        {/* Prečo sa sem nedá — textom, nie len v title, ktorý na dotyku nevidno (UX N4, U13).
            V úzkom mieste (malé karty na nízkom notebooku) by sa text lámal po písmenách — ostáva v title. */}
        {(moze || m.kratko !== undefined ? sirkaMiesta >= 36 : sirkaMiesta >= 72) && (
          <span className={`mv-text ${moze ? "" : "mv-dovod"} ${!moze && m.kratko !== undefined ? "mv-kratko" : ""}`}>
            {!moze ? (m.kratko ?? m.dovod ?? "nedá sa") : vybrane ? "vyber z ruky" : sSpojom > 0 ? `spoj: ${sSpojom}` : "bez spoja"}
          </span>
        )}
      </button>,
      -3,
    );
  };
  /** Súperova Záverečná lícom dole (roadmapa #83): rub na vonkajšom konci strany, NA EX na ňu prejde vždy. */
  const rubZaverecnej = (p: PlayerId): ReactNode => {
    const z = view.zaverecne.find((x) => x.strana === p && x.majitel !== ja);
    if (z === undefined) return null;
    // Na strane leží jeho predošlá, už otočená Záverečná — táto je nová z tohto Zhromaždenia.
    const dalsiaZaverecna = view.strany[p].some((pl) => otoceneTeraz.has(pl.card.uid));
    const vybrana = mode.typ === "naexCiel" && mode.uid === z.uid;
    // Ako karta v línii: značka, keď NA EX dať môžeš; klik rovno, alebo po pečiatke NA EX!.
    const znacka = naexMozny && naexCiele.has(z.uid);
    const klik = znacka && (naexPriamo || mode.typ === "naexCiel") ? () => setMode(vybrana ? { typ: "ziadny" } : { typ: "naexCiel", uid: z.uid }) : undefined;
    return vLinii(
      <button
        type="button"
        className={["rub-zaverecnej", znacka ? "naex-mozny" : "", superoveSkryteNaex.has(z.uid) ? "naex-supera" : "", vybrana ? "vybrana" : ""].join(" ")}
        style={{ width: sirkaVLinii, height: (sirkaVLinii * 80) / 54 }}
        disabled={klik === undefined}
        onClick={klik}
        title={`Záverečná ${menoHraca(super_)} lícom dole — nevieš, čo to je, ale ráta sa do bitky. Za ňu sa nedá priložiť, otočí sa na konci Pitky.${dalsiaZaverecna ? " Je to nová Záverečná — predošlá sa už odhalila." : ""}${klik !== undefined ? " Klik: NA EX (prejde vždy)." : ""}`}
      >
        <span className="rub-text">
          Záverečná
          <small>{dalsiaZaverecna ? "nová" : "lícom dole"} · otočí sa na konci Pitky</small>
        </span>
        {z.naexBy !== null ? (
          <span className="naex-nad">
            <IkonaPoldeci /> NA EX · {z.naexBy === ja ? "tvoj" : menoHraca(z.naexBy)}
          </span>
        ) : mojeSkryteNaex.has(z.uid) ? (
          <span className="naex-nad naex-skryte" title={`Tvoje NA EX leží skryto — ${menoHraca(super_)} ho nevidí. Odkryje sa, keď obaja skončíte Pitku.`}>
            <IkonaPoldeci /> NA EX · tvoj · skryto
          </span>
        ) : (
          superoveSkryteNaex.has(z.uid) && stitokSuperovhoNaex
        )}
        {vybrana && <span className="vybrana-pod">vybraná</span>}
      </button>,
      -1000 - p,
    );
  };
  const radStrany = (p: PlayerId): ReactNode => {
    const koniec = koniecStrany(p);
    const karty = view.strany[p].length === 0 ? null : kartyStrany(p);
    const rub = rubZaverecnej(p);
    // Prázdna strana má veľkosť karty v línii — pevných 198 px pretieklo nízky stôl (posuvník línie).
    if (koniec === null && karty === null && rub === null) {
      return vLinii(
        <span className="prazdna" style={{ width: sirkaVLinii, minHeight: Math.round(sirkaVLinii * POMER_KARTY) }}>
          prázdna
        </span>,
      );
    }
    // Tvoja partia vedie od lokality doľava, jej koniec je teda vľavo; skrytá Záverečná leží na konci.
    return p === ja ? (
      <>
        {koniec}
        {rub}
        {karty}
      </>
    ) : (
      <>
        {karty}
        {rub}
        {koniec}
      </>
    );
  };

  const lokalita = view.ciel?.lokalita ?? null;
  // Natočenie lokality je v ráme hráča 1 opačné.
  const lokalitaNavrhOtocena = lokalitaNavrh !== null && lokalitaNavrh.otocena !== (ja === 1);
  // Ktorá hrana stredu je obrátená ku ktorej strane (playtest 20261017-164450:
  // Eva kvôli otočeniu lokality dala súperovi Petelicu). Natočenie je v ráme hráča 0.
  const stredKarta = lokalitaNavrh?.karta ?? lokalita;
  const stranyStredu =
    stredKarta === null ? null : stranyLokality(data, stredKarta, lokalitaNavrh?.otocena ?? view.lokalitaOtocena, ja);
  // Kraje (Michal 2026-10-20): polovice línie sa volajú podľa hrán lokality
  // (Krčma: pri výčape / pri dverách) — „tvoja/súperova strana“ mätie, lebo
  // obaja vykladajú na obe. Vytlačená ľavá hrana leží pri strane hráča 0,
  // kým lokalita nie je otočená.
  const kraje = krajeStran(data, stredKarta, lokalitaNavrh?.otocena ?? view.lokalitaOtocena);
  const krajStrany = (p: PlayerId): string | null => kraje[p];
  // Prevaha: akcie hrany dostane, kto má v kraji viac svojich Občanov, Zvierat a Starešinov.
  const prevaha = prevahaStran(data, stol.strany);
  const kto = (p: PlayerId | null): string => (p === null ? "nikto" : p === ja ? "ty" : menoHraca(p));
  const tipKraja = (p: PlayerId): string =>
    `Prevaha: akcie tejto hrany dostane, kto má v tomto kraji viac svojich Občanov, Zvierat a Starešinov (Nástroje a Cirhóza sa nerátajú); pri rovnosti majiteľ karty pri lokalite. Teraz: ${kto(prevaha[p])}.`;
  // Rovnosť a prebitie (návrh 5 A): hráči čítali „majiteľ karty pri lokalite“
  // ako majiteľa lokality a nevedeli, koľko kariet treba na prebratie hrany.
  // Ako reťazec aj pre nápovedu kraja — na nízkom okne riadok skryje hra.css (UI inšpekcia).
  const textRovnostiKraja = (p: PlayerId): string | null => {
    const s = stavKraja(data, stol.strany[p]);
    if (stredKarta === null || s.prevaha === null || s.naPrebitie === null) return null;
    const druhy: PlayerId = s.prevaha === 0 ? 1 : 0;
    const zs = view.faza === "zhromazdenie" ? view.zhromazdenieStav : null;
    const rovnost = !s.rovnost
      ? ""
      : `rovnosť ${s.pocet[ja]} : ${s.pocet[super_]} → ${s.prevaha === ja ? "hranu máš ty (tvoja karta leží pri lokalite)" : `hranu má ${menoHraca(s.prevaha)} (súperova karta leží pri lokalite)`} · `;
    const limit =
      zs === null ? "" : ` · vyloží ešte: ty ${zs.pasoval[ja] ? 0 : zs.zostavaLimit[ja]}, ${menoHraca(super_)} ${zs.pasoval[super_] ? 0 : zs.zostavaLimit[super_]}`;
    return `${rovnost}na prebitie ${druhy === ja ? "potrebuješ" : `${menoHraca(druhy)} potrebuje`} ${kariet(s.naPrebitie)}${limit}`;
  };
  const rovnostKraja = (p: PlayerId): ReactNode => {
    const t = textRovnostiKraja(p);
    return t === null ? null : <span className="kraj-rovnost">{t}</span>;
  };
  const popisKraja = (p: PlayerId, smer: "vlavo" | "vpravo") => {
    const nazov = krajStrany(p) ?? (p === ja ? "tvoja strana" : `strana — ${menoHraca(p)}`);
    return (
      <span className="partia-popis" title={[tipKraja(p), textRovnostiKraja(p)].filter((x) => x !== null).join(" ")}>
        {smer === "vlavo" ? "← " : ""}
        {nazov}
        {stredKarta !== null && (
          <span className={`kraj-prevaha ${prevaha[p] === ja ? "moja" : prevaha[p] === null ? "" : "superova"}`} data-vyucba="prevaha">
            {" "}
            · prevaha: {kto(prevaha[p])}
          </span>
        )}
        {smer === "vpravo" ? " →" : ""}
        {rovnostKraja(p)}
      </span>
    );
  };
  // Pod kartou len krátke štítky — akcie hrán vidno na karte samej.
  const popisStranStredu =
    stranyStredu === null ? null : (
      <span className="strany-stredu">
        <span title={tipKraja(ja)}>◀ {krajStrany(ja) ?? "k tebe"}</span>
        <span title={tipKraja(super_)}>{krajStrany(super_) ?? "k súperovi"} ▶</span>
      </span>
    );
  const ikonyStranStredu =
    stranyStredu === null ? null : (
      <span className="strany-stredu-ikony">
        k tebe {hranaIkony(stranyStredu.kTebe)} · k súperovi {hranaIkony(stranyStredu.kSuperovi)}
      </span>
    );
  const stredLinie = ((): ReactNode => {
    if (lokalita !== null) {
      return sLupou({
        karta: lokalita,
        sirka: sirkaVLinii,
        otocena: view.lokalitaOtocena !== (ja === 1),
        eval: lineEval.cards.get(lokalita.uid) ?? null,
        spoj: spojPre(lokalita.uid),
      });
    }
    // Návrh lokality je bez lupy — klik ju otáča a narovnaná lupa by to skryla.
    if (lokalitaNavrh !== null) {
      return vLinii(
        tahatelna(
          { karta: lokalitaNavrh.karta, odkial: "lokality", navrh: true },
          karta({
            karta: lokalitaNavrh.karta,
            sirka: sirkaVLinii,
            otocena: lokalitaNavrhOtocena,
            eval: lineEval.cards.get(lokalitaNavrh.karta.uid) ?? null,
            onClick: () => setNavrh({ typ: "lokalita", uid: lokalitaNavrh.karta.uid, otocena: !lokalitaNavrh.otocena }),
          }),
          undefined,
          "lokalita",
          undefined,
          () => setNavrh(null),
        ),
      );
    }
    return vLinii(
      miesto("lokalita", "polož lokalitu sem", sirkaVLinii) ?? (
        <span className="prazdna lokalita-miesto" style={{ width: sirkaVLinii, minHeight: Math.round(sirkaVLinii * POMER_KARTY) }}>
          vyberá sa…
        </span>
      ),
    );
  })();

  /** Pokyn pri vybranom mieste na konci strany. */
  const textVolbyMiesta: ReactNode =
    miestoVolby === null || vybraneMiesto === undefined ? null : (
      <span className="volba-miesta-text">
        <strong>{miestoVolby === "vlastna" ? "Na tvoju stranu" : "Na súperovu stranu"}:</strong> klikni na kartu v ruke. Vysunuté sa tu spoja
        (svietia akcie spoja), stlmené sa dajú položiť bez spoja.{" "}
        {vylozenia.some((x) => x.ciel !== "priznanie") && view.faza === "zhromazdenie" && (
          <span className="nm-poldeci">ďalšia karta v ťahu: −1 plný poldeci</span>
        )}{" "}
        <span className="tlmene">Zrušíš pravým klikom alebo Esc.</span>
      </span>
    );

  // Záverečná vpravo pri konci ťahu (Michal 2026-10-24), nie medzi nákupmi: je to druhý spôsob,
  // ako ťah odoslať. Neaktívna ostáva viditeľná a pri myši povie prečo, ako pečiatky nákupov.
  const tlacidloZaverecnej: ReactNode =
    zaverecna === null ? null : (
      <button
        type="button"
        className="tlacidlo-zaverecna"
        data-vyucba="zaverecna"
        aria-disabled={zaverecna.kroky === null}
        title={
          zaverecna.dovod ??
          `Záverečná: posledná karta návrhu pôjde lícom dole za ${cigariet(KONSTANTY.CENA_ZAVERECNEJ)}. Súper ju nevidí do konca Pitky a za ňu nepriloží; ty už v tomto Zhromaždení nevykladáš (bez cigariet za pas).`
        }
        onMouseEnter={() => setNahladZaverecnej(true)}
        onMouseLeave={() => setNahladZaverecnej(false)}
        onFocus={() => setNahladZaverecnej(true)}
        onBlur={() => setNahladZaverecnej(false)}
        onClick={() => {
          if (zaverecna.kroky !== null) posli({ type: "tah", kroky: zaverecna.kroky });
        }}
      >
        <span className="ikona-rub" aria-hidden="true" />
        záverečná · <CenaCigariet n={KONSTANTY.CENA_ZAVERECNEJ} />
      </button>
    );

  // ---- potvrdenie ťahu ako pečiatka (Michal 2026-10-25) ---------------------
  // Hlavné potvrdenie ťahu leží v strede spodnej hrany stola, na mieste pečiatky NA EX! —
  // nie v paneloch či v rohu. ✕ v rohu návrh vráti (ako zrušenie výberu pri NA EX!);
  // keď nie je čo potvrdiť, na tom istom mieste je ťah bez návrhu („už neťahám“, „neberiem“).
  const pecatTahu = (p: {
    readonly text: ReactNode;
    readonly akcia: () => void;
    readonly druh?: "potvrd" | "pas";
    /** Prečo sa teraz nedá — pečiatka je len obrys a dôvod povie pri myši. */
    readonly dovod?: string | null;
    readonly tip?: string;
    readonly skratka?: "k" | "p";
    readonly vyucba?: string;
    readonly zrus?: { readonly akcia: () => void; readonly popis: string };
  }): ReactNode => (
    <span className="pecat-tahu-obal">
      <button
        type="button"
        className={p.druh === "pas" ? "pecat pecat-koncim pecat-pas" : "pecat pecat-potvrd"}
        data-skratka={p.skratka}
        data-vyucba={p.vyucba}
        disabled={p.dovod !== undefined && p.dovod !== null}
        title={p.dovod ?? p.tip}
        onClick={p.akcia}
      >
        {p.text}
      </button>
      {p.zrus !== undefined && (
        // Esc stlačí ✕ (tlacidloNavratu) — vráti návrh ako pravý klik.
        <button type="button" className="pecat-zrusit" data-skratka="esc" aria-label={p.zrus.popis} title={`${p.zrus.popis} (aj Esc či pravý klik)`} onClick={p.zrus.akcia}>
          ✕
        </button>
      )}
    </span>
  );
  const pravidloBrania =
    "Beriete striedavo, kým obaja neprestanete; kto nemá cigaretu, prestane sám. Pitiek v bitke bude 1 + menší počet aktivovaných akcií lokality z dvoch strán.";
  const potvrdBranie = (): void => {
    const uids = zoSenku.map((k) => k.uid);
    setNoveZoSenku((n) => ({ kolo: view.kolo, uids: [...(n.kolo === view.kolo ? n.uids : []), ...uids] }));
    posli({ type: "draftBer", uids });
  };
  /** Koľko kariet si kto v tomto kole vzal zo šenku — na stole vpravo na hrane (predtým v hlavičke panelu). */
  const skoreBrania: ReactNode =
    draft === null ? null : (
      <span className="hrana-skore" title="Nové karty zo šenku v tomto kole.">
        <span className="moje">ty {draft.noveKarty[ja]}</span>
        <span className="superove">
          {menoHraca(super_)} {draft.noveKarty[super_]}
          {draft.hotovo[super_] ? " · už neberie" : ""}
        </span>
      </span>
    );

  // ---- dlaždica KARTY ako cieľ priznania a Dedičstva (Michal 2026-10-23, #76) ----
  // Pri ťahaní kliatby sa dlaždica KARTY v tvojom bare zmení na cieľ „Priznať“, pri Nástroji
  // na „Dedičstvo“ s cenou; karta sa pustí na ňu (do návrhu ťahu), stôl sa neprepína. Klik na
  // kartu a potom na dlaždicu robí to isté (aj kláves O). Kam karta patrí, určuje jej typ — keď ju
  // tam pravidlá teraz nepustia, dlaždica povie prečo. Vybraný Nástroj má navyše pečiatku
  // „odkazujem“ vedľa pasovať (Michal 2026-10-27: Dedičstvo bolo neintuitívne) — tá aj dlaždica
  // pošlú ten istý ťah ako „potvrdiť“ (planVykladania → tah), len hneď.
  const [vybranaDoOblasti, setVybranaDoOblasti] = useState<number | null>(null);
  useEffect(() => setVybranaDoOblasti(null), [klucTahu]);
  /** Kam smie karta z ruky — rovnaké ciele ako pri ťahaní (planVykladania). */
  const kamIde = (k: CardInstance): { readonly priznanie: boolean; readonly dedicstvo: boolean } => {
    const c = cieleZdroja({ karta: k, odkial: "ruka", navrh: false });
    return { priznanie: c.has("priznanie"), dedicstvo: c.has("dedicstvo") };
  };
  const mozemOdkladat = view.faza === "zhromazdenie" && vykladam && !reagujem;
  const typOblasti = (k: CardInstance): { readonly priznanie: boolean; readonly dedicstvo: boolean } => {
    const tagy = data.cards.get(k.defId)?.tags ?? [];
    return { priznanie: mozemOdkladat && tagy.includes("Kliatba"), dedicstvo: mozemOdkladat && tagy.includes("Nástroj") };
  };
  const tahanaZRuky = tahanie !== null && tahanie.zdroj.odkial === "ruka" && !tahanie.zdroj.navrh ? tahanie.zdroj.karta : null;
  const vybranaKarta = vybranaDoOblasti === null ? null : (ruka.find((k) => k.uid === vybranaDoOblasti) ?? null);
  const kartaOblasti = tahanaZRuky ?? vybranaKarta;
  const typKarty = kartaOblasti === null ? null : typOblasti(kartaOblasti);
  const cielDlazdice: "priznanie" | "dedicstvo" | null = typKarty === null ? null : typKarty.priznanie ? "priznanie" : typKarty.dedicstvo ? "dedicstvo" : null;
  const smieNaDlazdicu = kartaOblasti !== null && cielDlazdice !== null && kamIde(kartaOblasti)[cielDlazdice];
  /** Prečo karta na dlaždicu nesmie — ten istý výpočet, aký urobí server. */
  const chybaDlazdice =
    kartaOblasti === null || cielDlazdice === null || smieNaDlazdicu
      ? null
      : (planTahu([...vylozenia.filter((x) => x.karta.uid !== kartaOblasti.uid), { karta: kartaOblasti, ciel: cielDlazdice }]).chyba ?? "Sem ju teraz vyložiť nesmieš.");
  /** Odkáže Nástroj do Dedičstva hneď — návrh ťahu + Nástroj, ten istý príkaz „tah“ ako „potvrdiť“ (odkazTahu.ts). */
  // Výučba pustí len ťah zo scenára — ako pri „potvrdiť“.
  const dovodOdkazu = (k: CardInstance): string | null => tahOdkazu(data, view, ja, vylozenia, k).dovod ?? chybaVyucby(polozkyOdkazu(vylozenia, k));
  const odkaz = (k: CardInstance): void => {
    const t = tahOdkazu(data, view, ja, vylozenia, k);
    if (t.kroky === null || dovodOdkazu(k) !== null) return;
    setVybranaDoOblasti(null);
    setNavrh(null);
    posli({ type: "tah", kroky: t.kroky });
  };
  /** Nástroj vybraný v ruke, ktorý smie do Dedičstva — vtedy je na hrane stola „odkazujem“. */
  const nastrojNaOdkaz = vybranaKarta !== null && typOblasti(vybranaKarta).dedicstvo ? vybranaKarta : null;
  const tlacidloOdkazu: ReactNode = (() => {
    if (nastrojNaOdkaz === null) return null;
    const k = nastrojNaOdkaz;
    const chyba = dovodOdkazu(k);
    const cena = view.cenaDedicstva;
    const ineVNavrhu = vylozenia.some((x) => x.karta.uid !== k.uid && x.ciel !== "priznanie");
    const tip =
      `Odkážeš kartu ${menoKarty(k.defId)} do Dedičstva za ${cigariet(cena)} (máš ${hJa.cigarety}): jej efekt Dedičstvo platí do konca hry a do línie sa už nevráti. ` +
      `Limit nemíňa, ale je to tvoj ťah${ineVNavrhu ? " — potvrdíš ním aj karty v návrhu" : ""}. Ďalšie Dedičstvo stojí o cigaretu viac, pre oboch.`;
    return (
      <button
        type="button"
        className="pecat pecat-koncim pecat-odkaz"
        data-vyucba="tlacidlo:odkazujem"
        aria-disabled={chyba !== null}
        title={chyba ?? tip}
        onClick={(e) => {
          if (chyba === null) odkaz(k);
          else setChybaTahania({ text: chyba, x: e.clientX, y: e.clientY });
        }}
      >
        odkazujem <CenaCigariet n={cena} />
      </button>
    );
  })();

  // ---- tlačidlá návrhu na stole (Michal 2026-10-20) ------------------------
  // Potvrdenie patrí k tomu, čo leží na stole — hráč nemusí pozerať dole na pás.
  const stolTlacidla = ((): HranaTahu | null => {
    if (!somNaTahu || view.koniec !== null) return null;
    if (view.faza === "volbaCiela" && lokalitaNavrh !== null) {
      return {
        vlavo: (
          <button onClick={() => setNavrh({ typ: "lokalita", uid: lokalitaNavrh.karta.uid, otocena: !lokalitaNavrh.otocena })} data-vyucba="tlacidlo:otocit">
            otočiť ↻
          </button>
        ),
        stred: pecatTahu({
          text: "potvrdiť",
          skratka: "k",
          tip: `Bitka o ${menoKarty(lokalitaNavrh.karta.defId)}${lokalitaNavrhOtocena ? " (otočenú)" : ""}.`,
          akcia: () => posli({ type: "chooseLocation", uid: lokalitaNavrh.karta.uid, otocena: lokalitaNavrh.otocena }),
          zrus: { akcia: () => setNavrh(null), popis: "Späť na výber lokality" },
        }),
      };
    }
    if (view.faza === "zhromazdenie" && plan !== null && vylozenia.length > 0) {
      return {
        stred: pecatTahu({
          text: <>potvrdiť{plan.poldeci > 0 && <span className="cena">−{plan.poldeci} poldeci</span>}</>,
          skratka: "k",
          dovod: plan.chyba ?? chybaVoVyucbe,
          akcia: () => posli({ type: "tah", kroky: plan.kroky }),
          zrus: { akcia: () => setNavrh(null), popis: "Vrátiť karty do ruky" },
        }),
        vpravo: (
          <>
            {/* Výučba: prečo sa nedá potvrdiť, priamo pri tlačidle (nápoveda na dotyku nie je). */}
            {chybaVoVyucbe !== null && plan.chyba === null && <span className="vyucba-zamok">{chybaVoVyucbe}</span>}
            {tlacidloZaverecnej}
            {tlacidloOdkazu}
          </>
        ),
      };
    }
    if (reagujem && vylozene !== null) {
      return {
        stred: pecatTahu({
          text: "potvrdiť",
          skratka: "k",
          akcia: () => posli({ type: "place", uid: vylozene.karta.uid, target: vylozene.ciel }),
          zrus: { akcia: () => setNavrh(null), popis: "Vrátiť kartu do ruky" },
        }),
      };
    }
    const bs = view.bitkaStav;
    if (view.faza === "bitka" && bs?.krok === "benzinka" && bs.caka === ja) {
      const vybrane = mode.typ === "vyber" ? mode.uids : [];
      const treba = bs.benzinkaZostava[ja];
      return {
        stred: pecatTahu({
          text: `zahodiť ${vybrane.length}/${treba}`,
          dovod: vybrane.length !== treba ? `Vyber ${treba} svojich Občanov v línii.` : null,
          akcia: () => posli({ type: "benzinka", uids: vybrane }),
          ...(vybrane.length > 0 ? { zrus: { akcia: () => setMode({ typ: "ziadny" }), popis: "Zrušiť výber" } } : {}),
        }),
      };
    }
    return null;
  })();
  /** Pravý klik na prázdny stôl zruší rozbehnutý výber (miesto, cieľ NA EX…). */
  const zrusVyberNaStole = ((): (() => void) | undefined => {
    if (miestoVolby !== null) return () => setMiestoVolby(null);
    if (mode.typ === "naexCiel") return () => setMode({ typ: "ziadny" });
    return undefined;
  })();

  // ---- pokyn: pilulka na hornej hrane stola, tlačidlá na spodnej -------------
  /** Nákup na hrane stola ako papierová pečiatka (Michal 2026-10-21): čo sa nedá, je len obrys a pri myši povie prečo. */
  const pecatNakupu = (p: {
    readonly kluc: string;
    readonly ikona: ReactNode;
    readonly nazov: string;
    readonly cena: number;
    readonly znamienko?: "−" | "+";
    readonly dovod: string | null;
    readonly tip: string;
    readonly akcia: () => void;
    /** Čo hráč za cenu dostane — kreslí sa za cenou so šípkou (fajčenie: cigarety → karta). */
    readonly zisk?: ReactNode;
  }): ReactNode => (
    <button
      key={p.kluc}
      type="button"
      className={`pecat pecat-nakup${p.dovod !== null ? " ne" : ""}`}
      data-vyucba={`tlacidlo:${p.kluc}`}
      aria-disabled={p.dovod !== null}
      title={p.dovod ?? p.tip}
      onClick={(e) => {
        if (p.dovod === null) p.akcia();
        // Nedostupný nákup povie prečo — tichý klik na DOLIAŤ mýlil (playtest výučby 20261025).
        else setChybaTahania({ text: p.dovod, x: e.clientX, y: e.clientY });
      }}
    >
      {(p.ikona !== null || p.cena > 0) && (
        <span className="pecat-riadok">
          {p.ikona}
          {p.cena > 0 && <CenaCigariet n={p.cena} znamienko={p.znamienko ?? "−"} />}
          {p.zisk !== undefined && (
            <>
              <span className="pecat-sipka" aria-hidden="true">→</span>
              {p.zisk}
            </>
          )}
        </span>
      )}
      <span className="pecat-nazov">{p.nazov}</span>
    </button>
  );
  const otvorVrstvu = (v: Vrstva): ReactNode => (
    <button onClick={() => setVrstva(v)}>{v === "senok" ? "otvoriť šenok" : "otvoriť lokality"}</button>
  );
  const pokyn: Pokyn | null = (() => {
    if (view.koniec !== null) {
      return {
        nadpis: view.koniec.vitaz === null ? "Remíza" : view.koniec.vitaz === ja ? tvar(rodHracaP(ja), "Vyhral si!", "Vyhrala si!", "Výhra!") : tvar(rodHracaP(ja), "Prehral si", "Prehrala si", "Prehra"),
        text: (
          <>
            {textHlasky(view.koniec.dovod, [menoHraca(0), menoHraca(1)], [rodHracaP(0), rodHracaP(1)])}
            {view.koniec.body !== null && ` Špaky ${sMinusom(view.koniec.body[ja])} : ${sMinusom(view.koniec.body[super_])} (ty : ${menoHraca(super_)}).`}
            {frajerina !== null && <ZmenaFrajeriny pred={frajerina[ja].pred} po={frajerina[ja].po} />}
          </>
        ),
        // Výučba končí v bare Melichara (tam je aj „Do lobby“) — tu by tlačidlo predbehlo jej záver.
        tlacidla:
          vyucba === true ? undefined : (
            <button className="tlacidlo-hlavne" onClick={opustit}>
              {prehravanie === undefined ? "späť do lobby" : "späť na detail partie"}
            </button>
          ),
      };
    }
    if (!somNaTahu && beriem) {
      return {
        nadpis: "Branie zo šenku",
        text: (
          <span className="cakanie-text">
            Zo šenku teraz berie <strong>{menoHraca(super_)}</strong>
            <span className="bodky" aria-hidden="true" />
          </span>
        ),
        ...(mobil ? {} : { vpravo: skoreBrania }),
      };
    }
    if (zaHracaHra && stavim && draft?.mojVyber === null) {
      return {
        nadpis: "Stavba šenku",
        text: (
          <span className="cakanie-text">
            Šenok za teba stavia Melichar
            <span className="bodky" aria-hidden="true" />
          </span>
        ),
      };
    }
    if (!somNaTahu && stavim) {
      return {
        nadpis: "Stavba šenku",
        text: (
          <span className="cakanie-text">
            {tvar(rodHracaP(ja), "Vybral si.", "Vybrala si.", "Výber je hotový.")} Čakáš, kým <strong>{menoHraca(super_)}</strong> vyberie kartu do šenku
            <span className="bodky" aria-hidden="true" />
          </span>
        ),
      };
    }
    if (!somNaTahu && view.faza === "draft" && draft?.krok === "patronat") {
      return {
        nadpis: "Patronát",
        text: (
          <span className="cakanie-text">
            <strong>{menoHraca(super_)}</strong> rozhoduje, či si vezme do ruky staršieho, ktorý mu prejavuje priazeň
            <span className="bodky" aria-hidden="true" />
          </span>
        ),
      };
    }
    if (!somNaTahu && view.hasicVolba !== null && view.hasicVolba.hrac === super_) {
      const k = view.hasicVolba.karta;
      return {
        nadpis: "Hasič",
        text: (
          <span className="cakanie-text">
            <strong>{menoHraca(super_)}</strong> {tvar(rodHracaP(super_), "vytiahol", "vytiahla", "ťahá")} Hasičom z odhadzovacieho balíčka kartu
            {k === null ? "" : <> <strong>{menoKarty(k.defId)}</strong></>} — nechá si ju v ruke, alebo ju vráti
            <span className="bodky" aria-hidden="true" />
          </span>
        ),
      };
    }
    if (!somNaTahu && view.vizia !== null) {
      return {
        nadpis: "Vízia",
        text: (
          <span className="cakanie-text">
            <strong>{menoHraca(super_)}</strong> sa pozerá na vrchnú kartu svojho balíčka — vezme si ju, alebo ju zahodí
            <span className="bodky" aria-hidden="true" />
          </span>
        ),
      };
    }
    // Súperov krok na staršom (UX N4): názov kroku a čo z neho bude mať čakajúci, nie len „Čakáš“.
    const bsCak = view.bitkaStav;
    if (!somNaTahu && view.faza === "bitka" && bsCak !== null && bsCak.caka === super_ && (bsCak.krok === "prebytok" || bsCak.krok === "pohorsenie")) {
      const prebytok = bsCak.krok === "prebytok";
      return {
        nadpis: (
          <>
            {prebytok ? "Prebytok súpera" : "Pohoršenie súpera"} <small>zostáva {prebytok ? bsCak.prebytokZostava : bsCak.pohorsenieZostava[super_]}</small>
          </>
        ),
        text: (
          <span className="cakanie-text">
            {prebytok ? (
              <>
                {bsCak.prebytokDrzi === ja ? (
                  <>
                    <strong>{menoHraca(super_)}</strong> rozdeľuje tvoj prebytok: vyberá, ktorí starší pôjdu k nemu — on dostane ich priazeň, teba sa
                    začnú báť (nové zóny ti zaplatia po najbližšej výhre). Za každého staršieho dostane cigaretu.
                  </>
                ) : (
                  <>
                    <strong>{menoHraca(super_)}</strong> posúva starších k tebe: ty máš hneď ich priazeň, starší sa začnú báť súpera.
                  </>
                )}
              </>
            ) : (
              <>
                <strong>{menoHraca(super_)}</strong> posúva starších o krok: k tebe (ty priazeň, súpera sa začnú báť), alebo k sebe (priazeň si berie,
                platí už v tejto bitke).
              </>
            )}
            <span className="bodky" aria-hidden="true" />
          </span>
        ),
      };
    }
    if (!somNaTahu && view.faza === "draft" && draft?.krok === "patronat" && draft.naTahu === super_) {
      return {
        nadpis: "Patronát súpera",
        text: (
          <span className="cakanie-text">
            <strong>{menoHraca(super_)}</strong> sa rozhoduje, či si vezme do ruky staršieho, ktorý mu prejavuje priazeň (marker pôjde do stredu, ty
            dostaneš Pohoršenia navyše)
            <span className="bodky" aria-hidden="true" />
          </span>
        ),
      };
    }
    // Pitka naraz (Michal 2026-10-27): kto skončil, čaká na súpera; s Bzdochou sa čaká, kým súper skončí.
    const psCak = view.pitkaStav;
    if (!somNaTahu && view.faza === "pitka" && view.vizia === null && psCak !== null && psCak.reakcia === null && !psCak.hotovy[ja] && cakaSBzdochou(psCak, ja)) {
      return {
        nadpis: "Bzdocha",
        text: (
          <span className="cakanie-text">
            Bzdocha: Pitku hráš až po <strong>{menoHraca(super_)}</strong> — keď skončí, uvidíš, či a kam dal NA EX.
            <span className="bodky" aria-hidden="true" />
          </span>
        ),
      };
    }
    if (!somNaTahu && view.faza === "pitka" && view.vizia === null && psCak !== null && psCak.reakcia === null && psCak.hotovy[ja] && !psCak.hotovy[super_]) {
      return {
        nadpis: "Čakáš",
        text: (
          <span className="cakanie-text">
            {tvar(rodHracaP(ja), "Skončil si", "Skončila si", "Skončil si")} Pitku. <strong>{menoHraca(super_)}</strong> ešte hrá — NA EX sa odkryjú, keď skončí
            {psCak.bzdocha === super_ ? " (má Bzdochu: uvidí tvoje NA EX)" : ""}.
            <span className="bodky" aria-hidden="true" />
          </span>
        ),
      };
    }
    if (!somNaTahu) {
      return {
        nadpis: "Čakáš",
        text: (
          <span className="cakanie-text">
            Na ťahu je <strong>{menoHraca(super_)}</strong>
            <span className="bodky" aria-hidden="true" />
          </span>
        ),
      };
    }
    if (view.volbaNastupu !== null && view.volbaNastupu.hrac === ja) {
      // Voľby v7 čakajú ako Hasič: karta zo šenku (Starosta, Dohadzovačka), Nástroj za Živnostníka, Kapybara.
      const nv = view.volbaNastupu;
      if (nv.typ === "senok" || nv.typ === "nastroj") {
        const zoSenku = nv.typ === "senok";
        const ponuka = zoSenku ? view.senok : view.ruka.filter((k) => defOf(data, k).tags.includes("Nástroj"));
        return {
          nadpis: zoSenku ? "Karta zo šenku" : "Živnostník",
          text: (
            <span className="vizia-text">
              <span>{zoSenku ? "Vyber si kartu zo šenku do ruky." : "Smieš za Živnostníka hneď priložiť Nástroj z ruky — limit nemíňa."}</span>{" "}
              {ponuka.map((k) => (
                <span key={k.uid} className="vizia-karta">
                  {karta({ karta: k, sirka: 72, onClick: () => posli(zoSenku ? { type: "senok", uid: k.uid } : { type: "nastroj", uid: k.uid }) })}
                </span>
              ))}
            </span>
          ),
          ...(zoSenku ? {} : { vpravo: <button className="pecat pecat-tichy" onClick={() => posli({ type: "nastroj", uid: null })}>bez Nástroja</button> }),
        };
      }
      if (nv.typ === "kapybara") {
        return {
          nadpis: "Kapybara",
          text: (
            <span>
              Posuň marker jedného staršieho o 1 pole k stredu:{" "}
              {view.starsi
                .filter((e) => e.marker !== MARKER_STRED)
                .map((e) => (
                  <button key={e.elderId} type="button" className="pecat pecat-nakup" onClick={() => posli({ type: "kapybara", elderId: e.elderId })}>
                    {defOf(data, e.karta).name}
                  </button>
                ))}
            </span>
          ),
        };
      }
      return {
        nadpis: nv.typ === "klebetnica" ? "Klebetnica" : "Dohadzovačka",
        text: <VolbaNastupu view={view} posli={posli} />,
      };
    }
    if (view.hasicVolba !== null) {
      // Hasič (Michal 2026-10-26): náhodná karta z odhadzovacieho balíčka — do ruky, alebo späť.
      const k = view.hasicVolba.karta;
      return {
        nadpis: "Hasič",
        text: (
          <span className="vizia-text">
            {k !== null && <span className="vizia-karta">{sLupou({ karta: k, sirka: 72 })}</span>}
            <span>
              {k === null ? (
                "Karta, ktorú Hasič vytiahol, už v odhadzovacom balíčku nie je."
              ) : (
                <>
                  Hasič ti z odhadzovacieho balíčka vytiahol kartu <strong>{menoKarty(k.defId)}</strong>. Necháš si ju v ruke, alebo ju vrátiš
                  do odhadzovacieho balíčka?
                </>
              )}
            </span>
          </span>
        ),
        // „vrátiť“ je druhá voľba, nie zrušenie — preto nie je ✕ na pečiatke.
        stred: pecatTahu({
          text: k === null ? "pokračovať" : "do ruky",
          tip: k === null ? "Hra pokračuje." : "Kartu si necháš v ruke.",
          akcia: () => posli({ type: "hasic", nechat: k !== null }),
        }),
        ...(k === null ? {} : { vpravo: <button onClick={() => posli({ type: "hasic", nechat: false })}>vrátiť</button> }),
      };
    }

    switch (view.faza) {
      case "volbaCiela":
        return lokalitaNavrh === null
          ? {
              nadpis: "Cieľ kola",
              text: mobil ? "Klikni na lokalitu v paneli Cieľ kola." : "Klikni na nástenke na lokalitu, o ktorú sa chceš biť.",
            }
          : {
              nadpis: "Cieľ kola",
              text: (
                <>
                  <strong>{menoKarty(lokalitaNavrh.karta.defId)}</strong>
                  {lokalitaNavrhOtocena ? " (otočená)" : ""} — klikom na kartu ju otočíš. {ikonyStranStredu} (akcie hrany dostane ten,
                  koho karta sa k nej priloží)
                </>
              ),
            };

      case "draft": {
        if (draft === null) return null;
        if (draft.krok === "patronat") {
          const b2 = (v: readonly [number, number]): string => `${v[ja]}:${v[super_]}`;
          const vybrany = mode.typ === "patronat" ? view.starsi.find((e) => e.elderId === mode.elderId) : undefined;
          if (mode.typ === "patronat" && vybrany !== undefined) {
            const vybrata = kandidatiPatronatu.find((k) => k.uid === mode.uid);
            // Celá cena (návrh #1, playtest 20261024-075830): cigarety a súperove Pohoršenia s ≈ bodmi.
            const cenaTahu = textDopadov(dopadyNahladu(data, view, stavPoPatronate(view, vybrany.elderId), 0));
            const cena = cenaPatronatu(vybrany);
            // Nízke okno (1366 × 650): pokyn v toku uberá plsti so staršími — vysvetlenie ide
            // do titulku a karty kandidátov sú menšie (UI inšpekcia 20261024-nahlad, patronát).
            const nizke = vyskaOkna < NIZKE_OKNO;
            const vysvetlenie = "Pri výhre je starší tvoj a karta sa otočí; marker ide do stredu, takže súper zaňho prestane brať špaky.";
            return {
              nadpis: `Patronát — ${menoKarty(vybrany.karta.defId)}`,
              text: (
                <span className="zberatel-text">
                  <span title={nizke ? vysvetlenie : undefined}>
                    Ktorý Občan či Zviera pôjde lícom dole na miesto staršieho?{" "}
                    {nizke ? "Pod kartou" : <>{vysvetlenie.slice(0, -1)} — pod kartou</>} odhad špakov ty:súper do konca pri výhre (teraz{" "}
                    <b>{b2(nahladPatronatu(data, view, vybrany.elderId, null).teraz)}</b>, pri prehre{" "}
                    <b>{b2(nahladPatronatu(data, view, vybrany.elderId, null).prehra)}</b>, bez súperových Pohoršení).
                    {cenaTahu !== null && <> Cena: {cenaTahu}.</>}
                  </span>
                  <span className="zberatel-ponuka">
                    {kandidatiPatronatu.map((k) => (
                      <span key={k.uid} className="nahrada-kandidat">
                        {karta({ karta: k, sirka: nizke ? 48 : 72, vybrana: mode.uid === k.uid, onClick: () => setMode({ typ: "patronat", elderId: vybrany.elderId, uid: k.uid }) })}
                        <small>výhra {b2(nahladPatronatu(data, view, vybrany.elderId, k).vyhra)}</small>
                      </span>
                    ))}
                  </span>
                </span>
              ),
              stred: pecatTahu({
                text: <>vziať do ruky{cena.cigarety > 0 && <CenaCigariet n={cena.cigarety} />}</>,
                vyucba: "potvrdit",
                dovod: vybrata === undefined ? "Vyber Občana či Zviera, ktoré pôjde lícom dole na miesto staršieho." : null,
                akcia: () => vybrata !== undefined && posli({ type: "patronat", elderId: vybrany.elderId, uid: vybrata.uid }),
                zrus: { akcia: zrus, popis: "Iný starší" },
              }),
            };
          }
          return {
            nadpis: "Patronát",
            text: (
              <>
                Starší, ktorý ti prejavuje priazeň (aspoň Znepokojenie), ti môže prísť na pomoc: vezmeš si ho do ruky, na jeho miesto dáš
                lícom dole Občana či Zviera z ruky a marker pôjde do stredu. Platíš cigarety podľa zóny (červená 1, oranžová 2, žltá 3), súper dostane v bitke toľko
                Pohoršení, o koľko marker išiel do stredu. <strong>Vyhráš bitku — starší je tvoj; prehráš — odhodíš poldeci.</strong>
              </>
            ),
            tlacidla: (
              <>
                {mozniPatronati.map((e) => {
                  const c = cenaPatronatu(e);
                  return (
                    <button key={e.elderId} onClick={() => setMode({ typ: "patronat", elderId: e.elderId, uid: null })}>
                      {menoKarty(e.karta.defId)}
                      <span className="cena">
                        {c.cigarety > 0 ? `−${cigariet(c.cigarety)}, ` : ""}súper +{c.pohorsenia} Pohoršení
                      </span>
                    </button>
                  );
                })}
              </>
            ),
            stred: pecatTahu({ text: "neberiem", druh: "pas", tip: "Bez patronátu — starší ostanú, kde sú.", akcia: () => posli({ type: "bezPatronatu" }) }),
          };
        }
        if (draft.krok === "stavba" && naneisto) {
          return {
            nadpis: "Stavba šenku",
            text: <>Skús si, ktoré karty by išli na <strong>Smetisko</strong> — klikni na kartu alebo ju potiahni. Rozloženie dnes spraví majster Melichar.</>,
          };
        }
        if (draft.krok === "stavba") {
          return {
            nadpis: "Stavba šenku",
            text: (
              <>
                Vyber {kariet(krokSt.odhod)} na <strong>Smetisko</strong> (naspodok spoločného balíčka, súper ich neuvidí) — klikni na
                kartu alebo ju potiahni. {zvysnePojdu(krokSt.doSenku).replace(/^z/, "Z")} do <strong>Šenku</strong> (uvidia ich obaja).
                Vyberáte naraz; kartu zo Smetiska vrátiš klikom.
              </>
            ),
            // Na mobile je „potvrdiť“ v pätičke panelu stavby.
            ...(mobil
              ? {}
              : {
                  stred: pecatTahu({
                    text: "potvrdiť",
                    skratka: "k",
                    dovod: stavbaHotova ? null : `Na Smetisku ${odhodStavby.length} z ${krokSt.odhod} — klikni na kartu, ktorá tam pôjde.`,
                    tip: `${zvysnePojdu(doSenkuStavby.length).replace(/^z/, "Z")} do Šenku.`,
                    akcia: potvrdStavbu,
                    ...(odhodStavby.length > 0 ? { zrus: { akcia: () => setOdhodStavby([]), popis: "Vrátiť karty zo Smetiska" } } : {}),
                  }),
                }),
          };
        }
        // Na stole (nie na mobile, tam je pätička v paneli šenku) je potvrdenie pečiatkou na hrane
        // a pilulka hovorí, čo „hotovo“ potvrdí (Michal 2026-10-25).
        const cenaBrania = KONSTANTY.CENA_SENKU[zoSenku.length] ?? 0;
        return {
          nadpis: "Branie zo šenku",
          text:
            zoSenku.length > 0 ? (
              <>
                Berieš <strong>{zoSenku.map((k) => menoKarty(k.defId)).join(" a ")}</strong> za {cigariet(cenaBrania)} — potvrdíš „hotovo“, {mobil ? "„vrátiť“" : "✕"} (alebo
                pravý klik na kartu v ruke) {zoSenku.length === 1 ? "ju vráti" : "ich vráti"} do šenku.
              </>
            ) : mozemBrat ? (
              <>
                <strong>Tvoj ťah</strong> — klikni na {kolkoMozemBrat === 2 ? "1 alebo 2 karty" : "kartu"} v šenku (alebo ich potiahni do ruky) a daj
                „hotovo“ (1 karta ={" "}
                {cigariet(KONSTANTY.CENA_SENKU[1] ?? 1)}, 2 karty = {cigariet(KONSTANTY.CENA_SENKU[2] ?? 3)}), alebo už neťahaj. Limit vykladania: {limitTeraz}.
              </>
            ) : view.senok.length === 0 ? (
              "Šenok je prázdny."
            ) : (
              `Nemáš cigaretu — zo šenku už nevezmeš. Limit vykladania v tomto kole: ${limitTeraz}.`
            ),
          ...(mobil
            ? {}
            : {
                vlavo: (
                  <span className="hrana-zasoba" title={`Máš ${cigariet(cigJa)}. 1 karta = ${cigariet(KONSTANTY.CENA_SENKU[1] ?? 1)}, 2 karty = ${cigariet(KONSTANTY.CENA_SENKU[2] ?? 3)}.`}>
                    <b>{cigJa}</b>cigarety
                  </span>
                ),
                stred:
                  zoSenku.length > 0
                    ? pecatTahu({
                        text: (
                          <>
                            hotovo <CenaCigariet n={cenaBrania} />
                          </>
                        ),
                        skratka: "k",
                        tip: `Berieš ${zoSenku.map((k) => menoKarty(k.defId)).join(" a ")} za ${cigariet(cenaBrania)}.`,
                        akcia: potvrdBranie,
                        zrus: { akcia: () => setNavrh(null), popis: zoSenku.length === 1 ? "Vrátiť kartu do šenku" : "Vrátiť karty do šenku" },
                      })
                    : pecatTahu({
                        text: "už neťahám",
                        druh: "pas",
                        skratka: "p",
                        vyucba: "tlacidlo:pas",
                        tip: `Prestaneš brať zo šenku; v Zhromaždení vyložíš ${limitTeraz}. ${pravidloBrania}`,
                        akcia: () => posli({ type: "draftStop" }),
                      }),
                vpravo: skoreBrania,
              }),
        };
      }

      case "zhromazdenie": {
        const zostava = zostavaTeraz;
        const plne = view.hraci[ja].poldeciPlne;
        // Fázu a limit hovorí jednotný bar (os kola, strany) — pilulka nesie len pokyn (Michal 2026-10-25).
        const nadpis = null;
        // Fajčiť sa vo v5 dá len v Pitke (bod 1, Michal 2026-10-24) — v Zhromaždení tlačidlo nie je.
        // Celý ťah naraz (Michal 2026-10-19): karty sa ťahajú na stôl ako návrh,
        // každá ďalšia stojí plný poldeci, server dostane ťah až po „potvrdiť“ na stole.
        if (vylozenia.length === 0 || plan === null) {
          const zaPas = (view.zhromazdenieStav === null ? 0 : kartyZaPas(view.zhromazdenieStav, ja, view.hraci[ja].rukaPocet)) * KONSTANTY.CIGARETY_ZA_PAS_NA_KARTU;
          // Pas je nevratný: potvrdenie len keď ešte niečo vyložiť môžem (UX N1, U10).
          const mozemVylozit = zostava > 0 && [...moznostiMiesta.values()].some((m) => m.karty.size > 0);
          if (odlozenyPas.caka !== null) {
            return {
              nadpis,
              text: (
                <>
                  <strong>
                    Pasuješ do Pitky — dostaneš {cigariet(zaPas)}, {menoHraca(super_)} potom vykladá sám. Vrátiť to môžeš ešte {odlozenyPas.zostavaS} s.
                  </strong>
                  {stavka !== null && (
                    <>
                      <br />
                      <StavkaBitky stavka={stavka} />
                    </>
                  )}
                </>
              ),
              vpravo: (
                <>
                  <button className="pecat pecat-tichy" onClick={odlozenyPas.vrat} autoFocus>
                    vrátiť · ešte vykladám
                  </button>
                </>
              ),
            };
          }
          return {
            nadpis,
            text: textNahladuTahania ?? textVolbyMiesta ?? (![...moznostiMiesta.values()].some((m) => m.karty.size > 0) ? (
              // Pri vyčerpanom limite pokyn „potiahni kartu“ zavádzal (playtest výučby 20261025, K11).
              <>
                <strong>Na stôl už nič nevyložíš.</strong> Pasuj do Pitky{zaPas > 0 ? ` — dostaneš ${cigariet(zaPas)}` : ""}.{" "}
                <span className="tlmene">{[...moznostiMiesta.values()].find((m) => m.dovod !== null)?.dovod ?? ""}</span>
              </>
            ) : (
              <>
                Potiahni kartu z ruky na stôl, alebo klikni na <strong>+</strong> na konci strany — vysunú sa karty, ktoré sa tam spoja. Alebo
                pasuj do Pitky (cigareta za každú nevyloženú kartu).{" "}
                <span className="tlmene">
                  Ďalšie karty v tom istom ťahu smieš pridať, každá ťa stojí plný poldeci (limit −1, pečeň +1){plne === 0 ? " — teraz žiadny nemáš" : ""}.
                </span>
              </>
            )),
            vpravo: (
              <>
                {tlacidloZaverecnej}
                {tlacidloOdkazu}
                <button
                  className="pecat pecat-koncim"
                  data-skratka="p"
                  data-vyucba="tlacidlo:pas"
                  title="Do Pitky už nevykladáš, súper vykladá sám. Za každú kartu, ktorú si ešte smel vyložiť, dostaneš cigaretu."
                  onClick={() => (mozemVylozit && vyucba !== true ? odlozenyPas.spusti({ type: "pass" }) : posli({ type: "pass" }))}
                >
                  pasovať <CenaCigariet n={zaPas} znamienko="+" />
                </button>
              </>
            ),
          };
        }
        const mojVyhlad = nahladyPitky?.[ja] ?? null;
        return {
          nadpis,
          text: (
            <>
              {vylozenia.map((x, i) => (
                <span key={x.karta.uid} className="tah-polozka">
                  {i > 0 && " · "}
                  <strong>{menoKarty(x.karta.defId)}</strong> → {POPIS_CIELA[x.ciel]}
                  {poradieVTahu(x.karta.uid) >= 1 && <b className="poldeci-text"> (−1 poldeci)</b>}
                </span>
              ))}
              {plan.poldeci > 0 && (
                <strong className="poldeci-varovanie">
                  {" "}
                  Ťah ťa stojí {plan.poldeci} {plan.poldeci === 1 ? "plný poldeci" : "plné poldeci"} — limit {zostava} → {plan.zostava}, pečeň +{plan.poldeci}
                  {mojVyhlad !== null && mojVyhlad.cirhozy > 0
                    ? ` → v Pitke Cirhóza ×${mojVyhlad.cirhozy} (${mojVyhlad.cirhozy * cenyKliatob[ja].cirhoza} b)`
                    : ""}
                  .
                </strong>
              )}
              {plan.chyba !== null && <strong className="chyba-tahu"> {plan.chyba}</strong>}
              {nahladSpojov !== null && (
                <span className="nahlad-spojov">
                  {" "}· {nahladSpojov.spoj} · ty: {nahladSpojov.ja} · {menoHraca(super_)}: {nahladSpojov.su}
                </span>
              )}
              {textNahladuTahania !== null && <> · {textNahladuTahania}</>}
              {textVolbyMiesta !== null && <> · {textVolbyMiesta}</>}
            </>
          ),
        };
      }

      case "pitka": {
        if (view.vizia !== null) {
          // Vízia (Michal 2026-10-19): vrchná karta balíčka do ruky, alebo navždy preč.
          const k = view.volbaVizia;
          const zostava = view.vizia.zostava[ja];
          return {
            nadpis: "Vízia",
            text: (
              <span className="vizia-text">
                {k !== null && <span className="vizia-karta">{sLupou({ karta: k, sirka: 72 })}</span>}
                <span>
                  Vrchná karta tvojho balíčka: <strong>{k === null ? "?" : menoKarty(k.defId)}</strong>. Vezmi si ju do ruky, alebo ju zahoď
                  — navždy z hry (kliatba, slabá karta).{zostava > 1 ? ` Ešte ${zostava - 1}× Vízia.` : ""}
                </span>
              </span>
            ),
            // „zahodiť“ je druhá voľba, nie zrušenie — preto nie je ✕ na pečiatke.
            stred: pecatTahu({ text: "do ruky", tip: "Vrchnú kartu balíčka si vezmeš do ruky.", akcia: () => posli({ type: "vizia", vziat: true }) }),
            vpravo: <button onClick={() => posli({ type: "vizia", vziat: false })}>zahodiť</button>,
          };
        }
        const hracJa = view.hraci[ja];
        const pitkaSt = view.pitkaStav;
        const obranca: PlayerId = view.utocnik === 0 ? 1 : 0;
        const naexBol = naexLimitMinuty;
        const nadpis = null;
        if (reagujem) {
          // Reakcia na súperovo NA EX (Michal 2026-10-12): jedna karta mimo limitu. Vo v5 až po
          // odkrytí NA EX oboch — najprv obranca, posledné slovo má útočník (interview 4).
          const poMneSuper = (pitkaSt?.frontaReakcii ?? []).includes(super_);
          const superoveNaex = view.strany
            .flat()
            .filter((pl) => pl.naexBy === super_ || pl.naexBy2 === super_)
            .map((pl) => (pl.vytrznik === true ? `${menoKarty(pl.card.defId)} (Výtržník)` : menoKarty(pl.card.defId)));
          return vylozene === null
            ? {
                nadpis: "Odpoveď na NA EX",
                text: textNahladuTahania ?? textVolbyMiesta ?? (
                  <>
                    NA EX sú odkryté — {menoHraca(super_)} {tvar(rodHracaP(super_), "dal", "dala", "dáva")} NA EX
                    {superoveNaex.length > 0 ? ` na ${superoveNaex.join(" a ")}` : ""}. Môžeš vyložiť <strong>jednu kartu</strong> z ruky (limit
                    nemíňa), napr. aby si jeho neaktívne akcie spároval a NA EX ich zrušil.{" "}
                    {poMneSuper ? (
                      <strong>Odpovedáš prvý — {menoHraca(super_)} potom odpovie na tvoje NA EX.</strong>
                    ) : obranca !== ja ? (
                      <strong>Máš posledné slovo.</strong>
                    ) : null}{" "}
                    Potiahni ju na stôl, alebo klikni na <strong>+</strong> na konci strany.
                  </>
                ),
                stred: pecatTahu({
                  text: "bez odpovede",
                  druh: "pas",
                  vyucba: "tlacidlo:bez-odpovede",
                  tip: "Na NA EX neodpovieš — platí, ako ho súper dal.",
                  akcia: () => posli({ type: "bezReakcie" }),
                }),
              }
            : {
                nadpis: "Odpoveď na NA EX",
                text: (
                  <>
                    <strong>{menoKarty(vylozene.karta.defId)}</strong> → {POPIS_CIELA[vylozene.ciel]}
                    {nahladSpojov !== null && (
                      <span className="nahlad-spojov">
                        {" "}· {nahladSpojov.spoj} · ty: {nahladSpojov.ja} · {menoHraca(super_)}: {nahladSpojov.su}
                      </span>
                    )}
                    {nahladOdpovede !== null && odhad !== null && (
                      <span className="tlmene">
                        {" "}· bitka {nahladOdpovede.pred.tuhe[ja]}:{nahladOdpovede.pred.tuhe[super_]} → <b>{nahladOdpovede.po.tuhe[ja]}:{nahladOdpovede.po.tuhe[super_]}</b> · kliatby — ty:{" "}
                        {textKliatob(nahladOdpovede.kliatby[ja])} · {menoHraca(super_)}: {textKliatob(nahladOdpovede.kliatby[super_])}
                        {textDopadov(nahladOdpovede.dopady) !== null && <> · {textDopadov(nahladOdpovede.dopady)}</>}
                        {textPrebytku(nahladOdpovede.prebytokPred, nahladOdpovede.prebytokPo) !== null && <> · {textPrebytku(nahladOdpovede.prebytokPred, nahladOdpovede.prebytokPo)}</>}
                      </span>
                    )}
                    {textVolbyMiesta !== null && <> · {textVolbyMiesta}</>}
                  </>
                ),
              };
        }
        if (mode.typ === "vykup") {
          // Zberný dvor (Michal 2026-10-20): raz za Pitku za cigaretu karta z vlastného odhadzovacieho balíčka.
          const srot = hracJa.odhadzovaci;
          return {
            nadpis: "Zberný dvor — výkup",
            text: (
              <span className="zberatel-text">
                <span>
                  Za {KONSTANTY.EFEKT.ZBERNY_DVOR_CENA} cigaretu si vezmi do ruky jednu kartu zo svojho odhadzovacieho balíčka — klikni na ňu.
                </span>
                <span className="zberatel-ponuka">
                  {srot.map((k) => (
                    <span key={k.uid}>
                      {karta({
                        karta: k,
                        sirka: 72,
                        onClick: () => {
                          setMode({ typ: "ziadny" });
                          if (view.ciel?.lokalita != null) cmd({ type: "kseft", uid: view.ciel.lokalita.uid, kartaUid: k.uid });
                        },
                      })}
                    </span>
                  ))}
                </span>
              </span>
            ),
            tlacidla: <button onClick={() => setMode({ typ: "ziadny" })}>zrušiť</button>,
          };
        }
        // Prečo NA EX nejde — hráč to vidí hneď, nielen v tooltipe.
        const dovodBezNaex = naexCiele.size > 0
          ? null
          : naexBol
          ? mojeSkryteNaex.size > 0
            ? "Tvoje NA EX v tejto Pitke už leží (skryto)."
            : "NA EX si v tejto Pitke už dal."
          : hracJa.poldeciPlne - mojeSkryteNaex.size <= 0
            ? "Nemáš plný poldeci (doliať: 2 cigarety)."
            : naexCiele.size === 0
              ? view.ciel?.lokalita?.defId === "kostol"
                ? "Kostol: NA EX smie len na kartu v kraji pri oltári — tam nie je karta, na ktorú by malo zmysel."
                : "NA EX ide len na Občana či Starešinu v línii s aspoň jednou aktívnou a jednou neaktívnou akciou (nie Nástroj)."
              : null;
        // Krčma chce jedno NA EX; po ňom už končím nič neblokuje.
        const krcma = view.ciel?.lokalita?.defId === "krcma" && dovodBezNaex === null && mojeSkryteNaex.size === 0;
        const cenaBarteru = barterCena(data, view, ja);
        // Vínko (Michal 2026-10-19): s ním sa poldeci za cigarety nedolieva.
        const vinko = hracJa.dedicstvo.some((k) => k.defId === "vinko");
        // Zberný dvor (Kšeft v7): kartu z odhadzovacieho balíčka si hráč vyberie kliknutím (mode vykup).
        const lokUid = view.ciel?.lokalita?.uid;
        const vykup = view.ciel?.lokalita?.defId === "zberny_dvor" && lokUid !== undefined && !(pitkaSt?.kseft?.[ja] ?? []).includes(lokUid);
        const zakazFajc = dovodZakazuFajcit(data, view, ja);
        // Pitka naraz (Michal 2026-10-27): obaja hrajú súčasne; poradie platí len pre odpovede na NA EX.
        const superSkoncil = pitkaSt?.hotovy[super_] === true;
        const superCakaSBzdochou = pitkaSt != null && cakaSBzdochou(pitkaSt, super_);
        // NA EX naraz (v5): či súper NA EX dal, sa ukáže až pri odkrytí — tu len že už vybral.
        const kontext = superSkoncil ? (
          <>
            <strong>
              {menoHraca(super_)} {tvar(rodHracaP(super_), "už vybral", "už vybrala", "už skončil výber")}
            </strong>{" "}
            {vidimVolbuSupera
              ? superoveSkryteNaex.size > 0
                ? "— vďaka Bzdoche vidíš, kam dal NA EX (štítok „skryto“ na karte)."
                : "— vďaka Bzdoche vieš, že NA EX nedal."
              : "— či a kam dal NA EX, uvidíš pri odkrytí, keď skončíš aj ty."}{" "}
            {obranca === ja ? "Na jeho NA EX odpovieš prvý, on má posledné slovo." : "Na tvoje NA EX odpovie prvý, posledné slovo máš ty."}{" "}
          </>
        ) : (
          <>
            <strong>Pitku hráte naraz.</strong>{" "}
            {superCakaSBzdochou
              ? `${menoHraca(super_)} má Bzdochu: hrá až po tebe a uvidí tvoje NA EX.`
              : "NA EX vyberáte obaja skryto — odkryjú sa, keď obaja skončíte. Na tú istú kartu oboch = Výtržník."}{" "}
          </>
        );
        const limitPo = limitBuduceKolo(zaklad, ja, true, data);
        const limitBez = limitBuduceKolo(zaklad, ja, false, data);
        // „Skončiť Pitku“ chce druhý klik len vtedy, keď hráč má plný poldeci a NA EX nedal (Michal 2026-10-27).
        const hotovoVzdavaNaex =
          dovodBezNaex === null && mojeSkryteNaex.size === 0 && (pitkaSt?.naexPocet?.[ja] ?? 0) === 0 && hracJa.poldeciPlne > 0 && !krcma;
        const potvrdzujem = potvrdenie === "hotovo" && hotovoVzdavaNaex;
        const cig = hracJa.cigarety;
        // Fajčenie zdražie s každým v tej istej Pitke (Michal 2026-10-27): 1, 2, 3… cigarety.
        const cenaFajc = cenaFajceniaHraca(view, ja);
        // Nákupy za cigarety (Michal 2026-10-21): každý je samostatná pečiatka vľavo na hrane stola — jeden klik.
        const nakupy = (
          <>
            <span className="hrana-zasoba" title={`Máš ${cigariet(cig)}.`}>
              <b>{cig}</b>cigarety
            </span>
            {pecatNakupu({
              kluc: "fajcit",
              // Pečiatka ukazuje, čo hráč dostane (Michal 2026-10-27): cena v cigaretách → karta.
              ikona: null,
              zisk: <IkonaKarty zakaz={zakazFajc !== null} />,
              nazov: "fajčiť",
              cena: cenaFajc,
              dovod: zakazFajc !== null
                ? zakazFajc
                : cig < cenaFajc
                  ? `Fajčiť teraz stojí ${cigariet(cenaFajc)}, máš ${cig}.`
                  : !jeCoTahat(hracJa.doberaciPocet, hracJa.odhadzovaci.length)
                    ? "Nemáš z čoho ťahať — doberací aj odhadzovací balíček sú prázdne."
                    : null,
              tip: `Fajčiť za ${cigariet(cenaFajc)}: hneď si doberieš kartu. Ďalšie fajčenie v tejto Pitke stojí ${cigariet(cenaFajceniaHraca(view, ja, 2) - cenaFajc)}, nová Pitka začína od ${cigariet(KONSTANTY.CENA_FAJCENIA_ZAKLAD)}. Každá vyfajčená cigareta je nerest.`,
              akcia: () => cmd({ type: "smoke", pocet: 1 }),
            })}
            {pecatNakupu({
              kluc: "doliat",
              ikona: <IkonaPoldeci />,
              nazov: "doliať",
              cena: KONSTANTY.REFILL_CENA,
              dovod: vinko
                ? "Vínko v Dedičstve: poldeci za cigarety dolievať nesmieš (nový poldeci barterom áno)."
                : jednotaZakazuje(view, ja)
                ? "Jednota: máš viac priznaných Dlhov — nesmieš fajčiť ani dolievať."
                : hracJa.poldeciVypite === 0
                  ? "Nemáš vypitý poldeci, ktorý by sa dal doliať."
                  : cig < KONSTANTY.REFILL_CENA
                    ? `Doliať stojí ${cigariet(KONSTANTY.REFILL_CENA)}, máš ${cig}.`
                    : null,
              tip: `Doliať poldeci: za ${cigariet(KONSTANTY.REFILL_CENA)} otočíš vypitý poldeci späť na plný.`,
              akcia: () => cmd({ type: "refillPoldeci" }),
            })}
            {pecatNakupu({
              kluc: "novy",
              ikona: <IkonaPoldeci novy />,
              nazov: "nový poldeci",
              cena: cenaBarteru,
              dovod: cig < cenaBarteru ? `Stokársky barter stojí ${cigariet(cenaBarteru)}, máš ${cig}.` : null,
              tip: `Stokársky barter: za ${cigariet(cenaBarteru)} dostaneš nový plný poldeci navyše — máš o poldeci viac natrvalo.`,
              akcia: () => cmd({ type: "barter" }),
            })}
            {vykup &&
              pecatNakupu({
                kluc: "vykup",
                ikona: <IkonaSrotu />,
                nazov: "výkup zo šrotu",
                cena: KONSTANTY.EFEKT.ZBERNY_DVOR_CENA,
                dovod:
                  hracJa.odhadzovaci.length === 0
                    ? "Tvoj odhadzovací balíček je prázdny."
                    : cig < KONSTANTY.EFEKT.ZBERNY_DVOR_CENA
                      ? `Výkup stojí ${cigariet(KONSTANTY.EFEKT.ZBERNY_DVOR_CENA)}, máš ${cig}.`
                      : null,
                tip: "Zberný dvor (Kšeft): za cigaretu ľubovoľná karta z tvojho odhadzovacieho balíčka do ruky.",
                akcia: () => setMode({ typ: "vykup" }),
              })}
            <KseftyPitky data={data} view={view} cmd={cmd} pecatNakupu={pecatNakupu} />
          </>
        );
        const koncim = (
          <button
            className="pecat pecat-koncim"
            data-skratka="k"
            data-vyucba="tlacidlo:hotovo"
            aria-disabled={krcma}
            title={
              krcma
                ? "Krčma: kým máš plný poldeci, najprv daj NA EX."
                : potvrdzujem
                  ? "Ešte jeden klik skončí Pitku bez NA EX (Esc = späť)."
                  : superSkoncil
                    ? "Nedá sa vrátiť. NA EX oboch sa odkryjú, po odpovediach sa Pitka vyhodnotí."
                    : `Nedá sa vrátiť. ${menoHraca(super_)} hrá ďalej; tvoje NA EX uvidí až pri odkrytí${superCakaSBzdochou ? " — okrem Bzdochy: s ňou ho uvidí hneď" : ""}.`
            }
            onClick={() => {
              if (krcma) return;
              if (hotovoVzdavaNaex && !potvrdzujem && vyucba !== true) setPotvrdenie("hotovo");
              else posli({ type: "skipNaex" });
            }}
          >
            {potvrdzujem ? "naozaj bez NA EX?" : "Skončiť Pitku"}
          </button>
        );
        // Vybraná karta (klik na kartu so značkou): pod kartou „vybraná“, v pilulke náhľad, na hrane pečiatka NA EX!.
        const vybranaUid = mode.typ === "naexCiel" ? mode.uid : null;
        const vybrana = vybranaUid === null ? undefined : nahladNaex.get(vybranaUid);
        // Najhoršia verejne možná odpoveď súpera — skúša celú sadu, preto len pre vybranú kartu (playtest 20261026-173610-3).
        const odpoved = vybrana === undefined ? null : najhorsiaOdpovedNaNaex(data, view, vybrana);
        const naRub = vybranaUid !== null && view.zaverecne.some((z) => z.uid === vybranaUid);
        const menoVybranej = naRub ? "súperovu Záverečnú" : vybranaUid === null ? "" : menoKarty(view.strany.flat().find((pl) => pl.card.uid === vybranaUid)?.card.defId ?? "");
        // Limit po NA EX na túto kartu: akcie Poldeci po NA EX (zruší či zdvojí ich) — playtest 20261026-173610-1.
        const limitPoVybranej = vybrana === undefined ? limitPo : limitBuduceKolo(vybrana.odkrytie.view, ja, false, data);
        const textVyberu = naRub ? (
          <span className="naex-vyber-text">
            <strong>NA EX na súperovu Záverečnú</strong> · nevieš, čo to je — prejde vždy, aktívne akcie zruší a neaktívne zdvojí ako pri každej karte · pečeň +1
          </span>
        ) :
          vybrana === undefined || odhad === null ? null : (
            <span className="naex-vyber-text">
              <strong>NA EX na {menoVybranej}</strong> · bitka {vybrana.pred.tuhe[ja]}:{vybrana.pred.tuhe[super_]} →{" "}
              <b>
                {vybrana.po.tuhe[ja]}:{vybrana.po.tuhe[super_]}
              </b>{" "}
              {vybrana.po.tuhe[ja] - vybrana.po.tuhe[super_] > vybrana.pred.tuhe[ja] - vybrana.pred.tuhe[super_]
                ? "▲"
                : vybrana.po.tuhe[ja] - vybrana.po.tuhe[super_] < vybrana.pred.tuhe[ja] - vybrana.pred.tuhe[super_]
                  ? "▼"
                  : "="}{" "}
              {odpoved !== null && (
                <span title={`Súperovu ruku nevidíš — takto by dopadla najhoršia karta sady, akou môže odpovedať (napr. ${menoKarty(odpoved.karta.defId)} na koniec ${odpoved.strana === ja ? "tvojej" : "svojej"} strany).`}>
                  · po najhoršej odpovedi {menoHraca(super_)} až{" "}
                  <b>
                    {odpoved.damage.tuhe[ja]}:{odpoved.damage.tuhe[super_]}
                  </b>{" "}
                </span>
              )}
              {kratkaCena(vybrana.kliatby, vybrana.dopady) !== null && <>· cena: <b>{kratkaCena(vybrana.kliatby, vybrana.dopady)}</b> </>}
              · ty: {vybrana.zmeny[ja].length > 0 ? vybrana.zmeny[ja].join(", ") : "bez zmeny"} · {menoHraca(super_)}:{" "}
              {vybrana.zmeny[super_].length > 0 ? vybrana.zmeny[super_].join(", ") : "bez zmeny"}
              <span className="tlmene">
                {" "}
                · kliatby — ty: {textKliatob(vybrana.kliatby[ja])} · {menoHraca(super_)}: {textKliatob(vybrana.kliatby[super_])}
                {textDopadov(vybrana.dopady) !== null && <> · {textDopadov(vybrana.dopady)}</>}
                {textPrebytku(vybrana.prebytokPred, vybrana.prebytokPo) !== null && <> · {textPrebytku(vybrana.prebytokPred, vybrana.prebytokPo)}</>} · pečeň +1
                {vybrana.odkrytie.svokra > 0 && (
                  <>
                    {" "}
                    · Svokra {menoHraca(super_)}: v bitke ti udelí {vybrana.odkrytie.svokra === 1 ? "Ranu" : `${vybrana.odkrytie.svokra} Rany`} (v tuhom už je)
                  </>
                )}
                {vybrana.odkrytie.kar && <> · Kar: pečeň za toto NA EX dostane {menoHraca(super_)}</>}
                {vybrana.odkrytie.vypalne > 0 && (
                  <>
                    {" "}
                    · Výpalné: zaplatíš {menoHraca(super_)} {vybrana.odkrytie.vypalne} cig.
                  </>
                )}
                {vybrana.odkrytie.doDna && <> · Na zdravie: poldeci sa ti po bitke vráti plný</>}
                {view.zaverecne.some((z) => z.majitel === super_) && <> · bez súperovej Záverečnej lícom dole</>} · v ďalšom kole limit{" "}
                {limitPoVybranej === limitBez ? `ostane ${limitBez}` : `${limitPoVybranej} namiesto ${limitBez}`} · skryto do konca Pitky; ak {menoHraca(super_)} dá NA EX
                na tú istú kartu, je z nej Výtržník (všetky akcie Rany pre majiteľa) · platí, ak {menoHraca(super_)} neodpovie (v ruke má{" "}
                {view.hraci[super_].rukaPocet} {view.hraci[super_].rukaPocet === 1 ? "kartu" : view.hraci[super_].rukaPocet >= 2 && view.hraci[super_].rukaPocet <= 4 ? "karty" : "kariet"})
              </span>
            </span>
          );
        // Tlačidlo NA EX je v Pitke stále (Michal 2026-10-27) — bez vybranej karty neaktívne a v tooltipe povie prečo.
        const naexStred =
          vybranaUid === null || dovodBezNaex !== null ? (
            <span className="pecat-naex-obal">
              <button
                className="tlacidlo-naex pecat-naex neaktivne"
                data-vyucba="tlacidlo:naex"
                aria-disabled="true"
                title={dovodBezNaex ?? "Najprv klikni v línii na kartu so značkou NA EX — potom ho dáš týmto tlačidlom (skryto)."}
              >
                NA EX!
              </button>
            </span>
          ) : (
            <span className="pecat-naex-obal">
              <button
                className="tlacidlo-naex pecat-naex"
                data-skratka="n"
                data-vyucba="tlacidlo:naex"
                title={`NA EX na ${menoVybranej} — skryto: ${menoHraca(super_)} ho uvidí, až keď obaja skončíte Pitku. Potom smie odpovedať jednou kartou.`}
                onClick={() => posli({ type: "naex", uid: vybranaUid })}
              >
                NA EX!
              </button>
              <button className="pecat-zrusit" aria-label="Zrušiť výber" title="Zrušiť výber (aj pravý klik na stôl)" onClick={() => setMode({ typ: "ziadny" })}>
                ✕
              </button>
            </span>
          );
        return {
          nadpis,
          text: potvrdzujem ? (
            <strong>Skončiť bez NA EX? Máš plný poldeci a v tejto Pitke ho už nedáš — klikni ešte raz, alebo Esc.</strong>
          ) : krcma ? (
            textVyberu ?? <strong>Krčma: kým máš plný poldeci, musíš dať NA EX — klikni na kartu so značkou.</strong>
          ) : (
            textVyberu ?? (
              <>
                {/* Prepínač je odkaz v texte, nie pečiatka — na hrane by prekryl popis kraja (UX/UI, 1600×1000). */}
                {bezNaex.zapnute && (
                  <>
                    <strong>Do konca bitky končíš Pitky sám, bez NA EX.</strong>{" "}
                    <button className="auto-hotovo-odkaz" onClick={bezNaex.vypni}>
                      zrušiť
                    </button>{" "}
                  </>
                )}
                {kontext}
                {mojeSkryteNaex.size > 0 && (
                  <>
                    <strong>
                      Tvoje NA EX leží skryto na{" "}
                      {[...mojeSkryteNaex]
                        .map((uid) =>
                          view.zaverecne.some((z) => z.uid === uid) ? "súperovej Záverečnej" : menoKarty(view.strany.flat().find((pl) => pl.card.uid === uid)?.card.defId ?? ""),
                        )
                        .join(" a ")}
                    </strong>{" "}
                    — {menoHraca(super_)} ho nevidí, kým obaja neskončíte.{" "}
                  </>
                )}
                {dovodBezNaex !== null ? (
                  <>
                    Fajči, doliať či kúp poldeci — potom Skončiť Pitku. <span className="tlmene">{dovodBezNaex}</span>
                  </>
                ) : (
                  <>
                    Klikni na kartu so značkou NA EX a potom na NA EX!, alebo Pitku skonči.{" "}
                    <span className="tlmene">
                      NA EX sa pri bitke vypije → v ďalšom kole limit {limitPo === limitBez ? `ostane ${limitBez}` : `${limitPo} namiesto ${limitBez}`}.
                    </span>
                  </>
                )}
                {/* Voľba až na konci ako celá veta — na začiatku sa čítala ako odtrhnutý kus vety pred
                    „Začínaš Pitku“ (playtest výučby 20261025). Výučba ju nevysvetľuje, tam nie je. */}
                {!bezNaex.zapnute && vyucba !== true && (
                  <>
                    {" "}
                    <button
                      className="auto-hotovo-odkaz"
                      title="Hra za teba v každej ďalšej Pitke tejto bitky ťukne „končím“ — bez NA EX, bez fajčenia. Na súperovo NA EX odpovedáš sám."
                      onClick={bezNaex.zapni}
                    >
                      Ďalšie Pitky tejto bitky bez NA EX
                    </button>
                  </>
                )}
              </>
            )
          ),
          vlavo: nakupy,
          stred: naexStred,
          vpravo: koncim,
        };
      }

      case "bitka": {
        const b = view.bitkaStav;
        if (b === null) return null;
        if (b.krok === "benzinka") {
          const vybrane = mode.typ === "vyber" ? mode.uids : [];
          const treba = b.benzinkaZostava[ja];
          return {
            nadpis: "Benzínka",
            text: (
              <>
                Cigaretiek je nad 7 — lokalitu nikto nevyhrá. Klikni na <strong>{treba}</strong> svojich Občanov v línii, ktorých
                zahodíš (vybraní: {vybrane.length}; pravým klikom výber zrušíš). Potvrdíš na stole.
              </>
            ),
          };
        }
        if (b.krok === "vestica") {
          const v = mode.typ === "vestica" ? mode : { moja: null, jeho: null };
          return {
            nadpis: "Veštica",
            text: `${tvar(rodHracaP(ja), "Prehral si", "Prehrala si", "Bitka je prehratá")} — vyber po jednej karte z oboch doberacích balíčkov, vymenia sa a balíčky sa zamiešajú.`,
            vlavo: <button onClick={() => setVrstva("vestica")}>balíčky</button>,
            stred: pecatTahu({
              text: "vymeniť",
              dovod: v.moja === null || v.jeho === null ? "Vyber po jednej karte z oboch balíčkov (tlačidlo balíčky)." : null,
              akcia: () => v.moja !== null && v.jeho !== null && posli({ type: "vestica", moja: v.moja, jeho: v.jeho }),
            }),
          };
        }
        if (b.krok === "kar") {
          // Kar (roadmapa #80): jednu nepriznanú Cirhózu z ruky smie hráč zahodiť.
          const cirhoza = view.ruka.find((k) => k.defId === "cirhoza");
          return {
            nadpis: "Kar",
            text: "Na Kare smieš zahodiť jednu nepriznanú Cirhózu z ruky — navždy z hry.",
            // Bez Cirhózy v ruke je jediná voľba „nechať si ju“ — tá je potom v strede ako ťah bez návrhu.
            ...(cirhoza === undefined
              ? { stred: pecatTahu({ text: "nechať si ju", druh: "pas", akcia: () => posli({ type: "kar", uid: null }) }) }
              : {
                  stred: pecatTahu({ text: "zahodiť Cirhózu", akcia: () => posli({ type: "kar", uid: cirhoza.uid }) }),
                  vpravo: <button onClick={() => posli({ type: "kar", uid: null })}>nechať si ju</button>,
                }),
          };
        }
        if (b.krok === "cintorin") {
          // Cintorín (Michal 2026-10-27, Pozostalosť): porazený dá Nástroj z ruky alebo zo šenku do Dedičstva zadarmo.
          const jeNastroj = (k: CardInstance): boolean => (data.cards.get(k.defId)?.tags ?? []).includes("Nástroj");
          const nastroje = [...view.ruka.filter(jeNastroj), ...view.senok.filter(jeNastroj)];
          const zoSenkuUid = new Set(view.senok.map((k) => k.uid));
          return {
            nadpis: "Cintorín",
            text: (
              <span className="zberatel-text">
                <span>
                  {tvar(rodHracaP(ja), "Prehral si na Cintoríne", "Prehrala si na Cintoríne", "Prehra na Cintoríne")}: jeden Nástroj z ruky alebo zo šenku smieš dať do Dedičstva <strong>zadarmo</strong> (ďalšie Dedičstvo aj tak
                  zdražie pre oboch). Klikni naň, alebo nič.
                </span>
                <span className="zberatel-ponuka">
                  {nastroje.map((k) => (
                    <span key={k.uid} title={zoSenkuUid.has(k.uid) ? "zo šenku" : "z ruky"}>
                      {karta({ karta: k, sirka: 84, onClick: () => posli({ type: "cintorin", uid: k.uid }) })}
                    </span>
                  ))}
                </span>
              </span>
            ),
            tlacidla: <button onClick={() => posli({ type: "cintorin", uid: null })}>nič</button>,
          };
        }
        if (b.krok === "zivnostnik") {
          // Živnostník (Výhra, Michal 2026-10-26): víťaz vyberie, ktoré súperovo Dedičstvo zahodí.
          // Rovnaké Dedičstvá sa ponúknu raz — je jedno, ktorý kus zmizne.
          const ponuka = view.hraci[super_].dedicstvo.filter((k, i, vsetky) => vsetky.findIndex((x) => x.defId === k.defId) === i);
          return {
            nadpis: (
              <>
                Živnostník{b.zivnostnikZostava > 1 && <small> zostáva {b.zivnostnikZostava}</small>}
              </>
            ),
            text: (
              <span className="zberatel-text">
                <span>
                  {tvar(rodHracaP(ja), "Vyhral si", "Vyhrala si", "Bitka je vyhratá")} so Živnostníkom v línii — klikni na Dedičstvo, ktoré {menoHraca(super_)}{" "}
                  <strong>zahodí</strong> (navždy z hry).
                </span>
                <span className="zberatel-ponuka">
                  {ponuka.map((k) => (
                    <span key={k.uid}>{karta({ karta: k, sirka: 84, onClick: () => posli({ type: "zivnostnik", uid: k.uid }) })}</span>
                  ))}
                </span>
              </span>
            ),
          };
        }
        if (b.krok === "exekutor") {
          // v6: zhorí polovica priznaných Dlhov a rovnako špakov — Záhradkár smie ísť namiesto špakov.
          const dlhy = hJa.priznane.filter((k) => k.defId === "dlh").length;
          const zhori = Math.floor(dlhy / 2);
          // Kde Záhradkár leží — engine ho berie z ruky, potom z odhadzovacieho, potom z doberacieho balíčka.
          const kde = view.ruka.some((k) => k.defId === "zahradkar")
            ? "z ruky"
            : hJa.odhadzovaci.some((k) => k.defId === "zahradkar")
              ? "z odhadzovacieho balíčka"
              : "z doberacieho balíčka";
          return {
            nadpis: "Exekútor!",
            text: (
              <>
                Máš {dlhy} priznaných Dlhov — zhorí ich {zhori} a k tomu {spakov(zhori)} ({view.spaky[ja]} → {String(view.spaky[ja] - zhori).replace("-", "−")}). Záhradkára smieš
                zahodiť {kde} namiesto špakov; Dlhy zhoria aj tak.
              </>
            ),
            tlacidla: (
              <>
                <button className="tlacidlo-hlavne" onClick={() => posli({ type: "zahradkar", zahodit: true })}>
                  zahodiť Záhradkára · špaky ostanú
                </button>
                <button onClick={() => posli({ type: "zahradkar", zahodit: false })}>nechať Záhradkára · −{spakov(zhori)}</button>
              </>
            ),
          };
        }
        if (b.krok === "pohorsenie") {
          return {
            nadpis: (
              <>
                Pohoršenie <small>zostáva {b.pohorsenieZostava[ja]}</small>
              </>
            ),
            text: (
              <>
                Pri staršom vyber smer — každé Pohoršenie posunie marker o jedno pole. <strong>K súperovi</strong>: on dostane priazeň, starší
                sa začne báť teba (nová zóna ti zaplatí po najbližšej výhre, cesta k vydeseniu). <strong>K sebe</strong>: priazeň sa ti zmení hneď a platí už v
                tejto bitke.
              </>
            ),
          };
        }
        if (b.krok === "prebytok") {
          return {
            nadpis: (
              <>
                Prebytok <small>zostáva {b.prebytokZostava}</small>
              </>
            ),
            text: (
              <>
                {b.prebytokDrzi === ja
                  ? "Klikni na staršieho — marker ide k súperovi (on priazeň, teba sa starší začne báť; nová zóna ti zaplatí ešte po finále). Rozdeliť treba celý prebytok."
                  : `Prebytok drží ${menoHraca(super_)}, ale vyberáš ty: klikni na staršieho — marker ide k tebe (ty priazeň, súpera sa začne báť a nová zóna mu zaplatí po jeho najbližšej výhre). Za každého posunutého staršieho cigareta. Rozdeliť treba celý prebytok.`}
                {navrhRozdelenia !== null && (
                  <span className="tlmene">
                    {" "}
                    Alebo celý prebytok naraz podľa špakov: {navrhRozdelenia.kroky.map((id) => menoKarty(view.starsi.find((e) => e.elderId === id)?.karta.defId ?? id)).join(", ")}.
                  </span>
                )}
              </>
            ),
            ...(navrhRozdelenia === null
              ? {}
              : {
                  vpravo: (
                    <button className="pecat pecat-koncim" title="Posunie markery podľa návrhu vedľa — ten istý výpočet ako náhľad špakov pri staršom." onClick={() => posli(navrhRozdelenia.prikaz)}>
                      rozdeliť naraz
                    </button>
                  ),
                }),
          };
        }
        return null;
      }

      default:
        return null;
    }
  })();

  // ---- starší -------------------------------------------------------------
  // Náhľad posunu (Michal 2026-10-19): komu posun pomôže — body spolu a priazeň.
  // Zóny menom z pravidiel, nie farbou (UI A4) — tie isté slová ako zónové podmienky.
  const ZONA = NAZVY_ZON;
  const DO_ZONY = ["Neutrality", "Znepokojenia", "Strachu", "Vydesenia"] as const;
  const popisPosunu = (elder: ElderState, cezPohorsenie: boolean, naKraj = false, k: PlayerId = super_): string => {
    // Prebytok: aj cigareta porazenému za prvý posun staršieho (§9.4) — nahladPosunuPrebytkom.
    void naKraj;
    const n = cezPohorsenie ? nahladPosunuMarkera(data, view, elder.elderId, k) : nahladPosunuPrebytkom(data, view, elder.elderId);
    const novy = posunMarker(elder, k);
    if (n === null || novy === null) return "";
    const zn = (x: number): string => (x > 0 ? `+${x}` : x < 0 ? `−${-x}` : "±0");
    const priazen = n.priazen === null ? "♥ nikto" : `♥ ${n.priazen === ja ? "tebe" : "súperovi"} +${n.sila}`;
    const zonaPred = ZONA[STUPNICA_ZONY[elder.marker]];
    const zonaPo = ZONA[STUPNICA_ZONY[novy]];
    // Pri ±0 nech voľby nevyzerajú rovnako (UX N1, U11): koľko krokov chýba do ďalšej zóny.
    let doZony = "";
    if (n.zmena[ja] === 0 && n.zmena[super_] === 0) {
      let m = novy;
      for (let krok = 1; krok <= 4; krok++) {
        const dalsi = posunMarker({ ...elder, marker: m }, k);
        if (dalsi === null) break;
        m = dalsi;
        if (STUPNICA_ZONY[m] !== STUPNICA_ZONY[novy]) {
          doZony = ` · do ${DO_ZONY[STUPNICA_ZONY[m]]} ešte ${krok} ${krok === 1 ? "krok" : "kroky"}`;
          break;
        }
      }
    }
    // Bez čísel pozícií (Michal 2026-10-22): hráč 2 vidí stupnicu zrkadlovo, „4 → 5“ by mu klamalo.
    // Pohoršenie k sebe (v5): priazeň sa mení hneď, rozhoduje už túto bitku.
    const hned = k === ja && cezPohorsenie && n.priazen !== priazenHraca(elder) ? " — hneď, platí už v tejto bitke" : "";
    // Priazeň sa mení hneď — keď to pohne poškodením (Bitkár, Veriaci), náhľad ukáže bitku pred a po (playtest 20261026-181227-1).
    const mojeAbstaky = view.ruka.filter((x) => x.defId === "abstak").length;
    const zmenaBitky = cezPohorsenie ? bitkaPoPohorseni(data, view, elder.elderId, ja, k === ja, ja === 0 ? [mojeAbstaky, 0] : [0, mojeAbstaky]) : null;
    const bitka = zmenaBitky === null ? "" : ` · bitka ${zmenaBitky.pred.tuhe[ja]} : ${zmenaBitky.pred.tuhe[super_]} → ${zmenaBitky.po.tuhe[ja]} : ${zmenaBitky.po.tuhe[super_]}`;
    return ` · ${k === ja ? "k sebe" : `k ${menoHraca(super_)}`}: ${zonaPred} → ${zonaPo} · špaky do konca pri výhrach ty ${zn(n.zmena[ja])}, súper ${zn(n.zmena[super_])}${doZony} · ${priazen}${hned}${bitka}`;
  };
  /**
   * Pohoršenie oboma smermi (v5 bod 7): pri každom staršom voľba k súperovi alebo
   * k sebe — len smery, ktoré jadro dovolí (hranice zón, kraj, Noviny).
   */
  const volbyPohorsenia = (elder: ElderState): readonly VolbaPosunu[] | undefined => {
    const b = view.bitkaStav;
    if (!somNaTahu || view.faza !== "bitka" || b?.caka !== ja || b.krok !== "pohorsenie") return undefined;
    const naKraj = false;
    const volby: VolbaPosunu[] = [];
    for (const kSebe of [false, true]) {
      // v6: Pohoršenie o pole bez limitu, aj na kraj; z patronátu nie na súperovho patróna.
      if (!pohorsenieMozne(view, ja, elder, kSebe)) continue;
      const ciel = posunMarker(elder, kSebe ? ja : super_);
      if (ciel === null) continue;
      volby.push({
        smer: kSebe ? "ja" : "su",
        nazov: kSebe ? "k sebe" : "k súperovi",
        akcia: `posunúť${popisPosunu(elder, true, naKraj, kSebe ? ja : super_)}`,
        ciel,
        klik: () => cmd(kSebe ? { type: "pohorsenie", elderId: elder.elderId, kSebe: true } : { type: "pohorsenie", elderId: elder.elderId }),
      });
    }
    return volby.length === 0 ? undefined : volby;
  };
  const klikStarsi = (elder: ElderState): { readonly akcia: string; readonly klik: () => void } | undefined => {
    if (!somNaTahu) return undefined;
    // Patronát (Michal 2026-10-20): staršieho, ktorý mi prejavuje priazeň, si vezmem do ruky.
    if (mozniPatronati.some((e) => e.elderId === elder.elderId)) {
      const c = cenaPatronatu(elder);
      return {
        akcia: `vziať do ruky${c.cigarety > 0 ? ` (−${cigariet(c.cigarety)})` : ""} · súper +${c.pohorsenia} Pohoršení`,
        klik: () => setMode({ typ: "patronat", elderId: elder.elderId, uid: null }),
      };
    }
    const b = view.bitkaStav;
    if (view.faza === "bitka" && b?.caka === ja) {
      // Prebytok ide vždy k súperovi držiteľa — rozdeľuje ho od v8 spravidla porazený, teda k nemu.
      const smerPrebytku: PlayerId = b.prebytokDrzi === super_ ? ja : super_;
      if (b.krok === "prebytok" && posunMarker(elder, smerPrebytku) !== null) {
        return { akcia: `posunúť marker${popisPosunu(elder, false, false, smerPrebytku)}`, klik: () => cmd({ type: "prebytok", elderId: elder.elderId }) };
      }
    }
    return undefined;
  };

  // ---- línia starších na mieste línie kariet (Michal 2026-10-23, #68 + #69 variant A) ----
  // Krok na staršom ukáže líniu obom hráčom; čakajúci si smie nahliadnuť na stôl.
  const bs = view.bitkaStav;
  const krokStarsich: { readonly nazov: string; readonly kto: PlayerId; readonly typ: "pohorsenie" | "prebytok" | "patronat" } | null =
    view.koniec !== null
      ? null
      : view.faza === "bitka" && bs !== null && bs.caka !== null && (bs.krok === "pohorsenie" || bs.krok === "prebytok")
        ? { nazov: bs.krok === "pohorsenie" ? "Pohoršenie" : "Prebytok", kto: bs.caka, typ: bs.krok }
        : view.faza === "draft" && draft?.krok === "patronat"
          ? { nazov: "Patronát", kto: draft.naTahu, typ: "patronat" }
          : null;
  const klucKroku = krokStarsich === null ? null : `${view.kolo}-${krokStarsich.typ}-${krokStarsich.kto}`;
  /** Čie čísla línia zvýrazní (Body hráča alebo súpera); null = línia kariet. */
  const [pohladStarsich, setPohladStarsich] = useState<PlayerId | null>(null);
  const [nahliadnutie, setNahliadnutie] = useState(false);
  // Výsledok kroku ostane na stole, kým ho hráč nezavrie alebo nepotrebuje líniu kariet — bez časovača (UX, Michal 2026-10-23).
  const [vysledokKroku, setVysledokKroku] = useState(false);
  const predoslyKrok = useRef<string | null>(null);
  useEffect(() => {
    setVysledokKroku(predoslyKrok.current !== null && klucKroku === null);
    setNahliadnutie(false);
    predoslyKrok.current = klucKroku;
  }, [klucKroku]);
  const potrebujemLiniu = somNaTahu && (vykladam || view.faza === "zhromazdenie" || view.faza === "pitka" || view.faza === "volbaCiela");
  useEffect(() => {
    if (!potrebujemLiniu) return;
    setVysledokKroku(false);
    setPohladStarsich(null);
  }, [potrebujemLiniu]);
  // Línia starších zmizne, hneď ako prestane byť aktuálna (Michal 2026-10-27): koniec bitky či
  // patronátu, výber lokality, šenok, Zhromaždenie, Pitka — aj keď je na ťahu súper. Inak
  // ostala ukázaná, kým hráč sám nepotreboval líniu kariet. Až po efekte kroku vyššie, aby
  // koniec patronátu (krok aj fáza naraz) nenechal výsledok kroku na stole.
  const fazaStola = klucPrechodu(view);
  const predoslaFazaStola = useRef(fazaStola);
  useEffect(() => {
    if (predoslaFazaStola.current === fazaStola) return;
    predoslaFazaStola.current = fazaStola;
    setVysledokKroku(false);
    setPohladStarsich(null);
  }, [fazaStola]);
  // Kým beží počítadlo bitky, stôl ukazuje líniu kariet (rozsvecujú sa), nie starších.
  // Pauza po súperovej voľbe cieľa líniu starších na chvíľu skryje — rámik pauzy by inak svietil
  // na medzeru medzi staršími a vybranú lokalitu by nebolo vidno (Michal 2026-10-26). Po pauze
  // sa línia vráti sama: stav, ktorý ju otvoril (výsledok kroku, patronát, Body), sa nemení.
  const starsiViditelni =
    !pauzaBezi &&
    tahanie === null &&
    pocitadlo === null &&
    (krokStarsich !== null ? !nahliadnutie : vysledokKroku || pohladStarsich !== null || ukazStarsich);
  const pohladLinie = pohladStarsich ?? ja;
  // Krčmová nástenka leží na mieste hracej plochy (Michal 2026-10-27), nie v okne nad stolom.
  // Pri voľbe cieľa sa ukáže sama a vyberá sa v nej lokalita (obranca klikne, útočník čaká).
  // Pri ťahaní lokality z nej ustúpi, nech je vidno, kam ju pustiť; krok na staršom má prednosť.
  const volbaNaStole = !mobil && !pauzaBezi && view.faza === "volbaCiela" && view.koniec === null && lokalitaNavrh === null;
  const nastenkaNaStole = (vrstva === "lokality" || volbaNaStole) && tahanie === null && !starsiViditelni;
  // Bar starších (Michal 2026-10-27): po kliku na Starších ukážu oba bary dlaždicu na každého staršieho;
  // späť sa prepnú spolu so stolom. Nástenka (Špaky) prepne bary na dlaždice špakov (rezimBaru).
  const bodovyRezim = starsiViditelni && pohladStarsich !== null;

  const zavriStarsich = (): void => {
    setPohladStarsich(null);
    setVysledokKroku(false);
  };
  const prepniStarsich = (p: PlayerId): void => {
    // Nástenka (Špaky) a línia starších (Starší) sa navzájom vylučujú (Michal 2026-10-27).
    setVrstva((v) => (v === "lokality" ? null : v));
    if (krokStarsich !== null && !nahliadnutie) {
      setPohladStarsich((x) => (x === p ? null : p));
      return;
    }
    setNahliadnutie(false);
    if (starsiViditelni && pohladLinie === p) zavriStarsich();
    else {
      setVysledokKroku(false);
      setPohladStarsich(p);
    }
  };
  const otvorNastenku = (p: PlayerId): void => {
    if (vrstva === "lokality" && nastenkaPre === p) {
      setVrstva(null);
      return;
    }
    zavriStarsich();
    setNastenkaPre(p);
    setVrstva("lokality");
  };
  // Nástenka na stole nemá okno s krížikom — Esc ju zavrie (lupa karty má prednosť).
  useEffect(() => {
    if (vrstva !== "lokality") return;
    const klaves = (e: KeyboardEvent): void => {
      if (e.key === "Escape" && lupa === null) setVrstva(null);
    };
    window.addEventListener("keydown", klaves);
    return () => window.removeEventListener("keydown", klaves);
  }, [vrstva, lupa]);
  useEffect(() => {
    if (!starsiViditelni && !nahliadnutie) return;
    const klaves = (e: KeyboardEvent): void => {
      if (e.key !== "Escape" || vrstva !== null || lupa !== null) return;
      // Esc krok nezruší (UX): v kroku vráti z nahliadnutia späť na starších.
      if (nahliadnutie) setNahliadnutie(false);
      else if (krokStarsich === null) zavriStarsich();
    };
    window.addEventListener("keydown", klaves);
    return () => window.removeEventListener("keydown", klaves);
  }, [starsiViditelni, nahliadnutie, vrstva, lupa, krokStarsich === null]);
  // Starší, ktorým sa práve pohol marker — v línii bliknú.
  const markeryPred = useRef<ReadonlyMap<string, number> | null>(null);
  const [zmeneniStarsi, setZmeneniStarsi] = useState<ReadonlySet<string>>(new Set());
  useEffect(() => {
    const teraz = new Map(view.starsi.map((e) => [e.elderId, e.marker]));
    const pred = markeryPred.current;
    markeryPred.current = teraz;
    if (pred === null) return;
    const zmena = new Set(view.starsi.filter((e) => pred.get(e.elderId) !== e.marker).map((e) => e.elderId));
    if (zmena.size === 0) return;
    setZmeneniStarsi(zmena);
    const t = setTimeout(() => setZmeneniStarsi(new Set()), 1600);
    return () => clearTimeout(t);
  }, [view.starsi]);
  const krokMoj = krokStarsich !== null && krokStarsich.kto === ja && somNaTahu;

  /** Prečo sa na staršieho v mojom kroku nedá kliknúť — textom namiesto len vyblednutia (UI U12). */
  const zamokStarsieho = (e: ElderState): string | undefined => {
    if (!krokMoj || krokStarsich === null) return undefined;
    if (krokStarsich.typ === "patronat") {
      if (view.patronat.some((x) => x?.elderId === e.elderId)) return "v patronáte";
      if (priazenHraca(e) !== ja) return "bez tvojej priazne";
      if (e.nahradeny) return "náhrada — do ruky sa nedá";
      if (hJa.cigarety < cenaPatronatu(e).cigarety) return "málo cigariet";
      return kandidatiPatronatu.length === 0 ? "nemáš v ruke Občana ani Zviera" : "nedá sa vziať";
    }
    const pohorsenie = krokStarsich.typ === "pohorsenie";
    if (!pohorsenie && posunMarker(e, super_) !== null) return undefined;
    return "už na krajnej pozícii";
  };
  const starsiVLinii: StarsiVLinii[] = view.starsi.map((e) => {
    const klik = klikStarsi(e);
    const volby = volbyPohorsenia(e);
    const obrazok = vzhladKarty(sada, data, e.karta.defId).obrazok;
    const iPatron = view.patronat.findIndex((x) => x?.elderId === e.elderId);
    const pohorsenie = krokStarsich?.typ === "pohorsenie";
    const ciel: MarkerPos | null =
      !krokMoj || krokStarsich === null
        ? null
        : krokStarsich.typ === "patronat"
          ? MARKER_STRED
          : posunMarker(e, super_);
    return {
      elder: e,
      meno: menoKarty(e.karta.defId),
      obrazok: obrazok === null ? null : mediaUrl(obrazok.nahlad),
      body: body.starsi.find((x) => x.elderId === e.elderId),
      klik,
      volby,
      ciel,
      dovod: klik === undefined && volby === undefined ? zamokStarsieho(e) : undefined,
      patron: iPatron === -1 ? null : { kto: iPatron as PlayerId, pohorsenia: view.patronat[iPatron]?.pohorsenia ?? 0 },
      vybrany: mode.typ === "patronat" && mode.elderId === e.elderId,
      stopa: stopaStarsieho(view.posunyMarkerov ?? [], e.elderId),
    };
  });
  // Lupa staršieho mimo krokov (Michal 2026-10-23): plynulá ako pri kartách — tie isté
  // lupaKarty a nadLupou; registruje sa tu, nie v LiniaStarsich, lebo lupa sa kreslí
  // na konci tohto prekreslenia.
  const lupyStarsich = new Map(
    starsiVLinii.map((s) => {
      const kluc = `st-${s.elder.elderId}`;
      // Lupa staršieho má pevnú šírku (obsah je text, nie zväčšená dlaždica); výšku si zmeria Lupa.
      const r = lupa?.kluc === kluc ? lupa.rect : doznieva?.kluc === kluc ? doznieva.rect : null;
      const mierka = r === null || r.width === 0 ? 2.4 : Math.min(3, Math.max(1.6, SIRKA_LUPY_STARSIEHO / r.width));
      lupaKarty.set(kluc, {
        render: (sirka) => (
          <LupaStarsieho
            s={s}
            data={data}
            ikony={sada.ikonyBodovania ?? []}
            ja={ja}
            mena={[menoHraca(0), menoHraca(1)]}
            sirka={sirka}
            karta={karta({ karta: s.elder.karta, sirka: Math.round(sirka * 0.26) })}
          />
        ),
        mierka,
        nad: true,
      });
      return [s.elder.elderId, nadLupou(kluc, (el) => el, true)] as const;
    }),
  );
  const rezimBaru = rezimRadov({ nastenkaKlikom: vrstva === "lokality", nastenkaNaStole, liniaStarsich: bodovyRezim });
  const idLinieStarsich = useId();
  // Ponuka patronátu (#110): kým si hráč staršieho nevybral, stôl ukáže namiesto línie
  // starších len tých, ktorých si smie vziať — kartu s akciami, priazeň a cenu.
  const vyberPatronatu = krokMoj && krokStarsich?.typ === "patronat" && mode.typ !== "patronat" && mozniPatronati.length > 0;
  // „všetci starší“ prepne na líniu (markery, súboje) bez bodového režimu barov; nový krok začne ponukou.
  const [liniaPriPatronate, setLiniaPriPatronate] = useState(false);
  useEffect(() => setLiniaPriPatronate(false), [klucKroku]);
  const ponukaPatronatu: MoznostPatronatu[] | null =
    vyberPatronatu && pohladStarsich === null && !liniaPriPatronate
      ? mozniPatronati.map((e) => {
          const vyber = (): void => setMode({ typ: "patronat", elderId: e.elderId, uid: null });
          const cena = cenaPatronatu(e);
          const ucinok = ucinokPriazne(data, e);
          return {
            elderId: e.elderId,
            meno: menoKarty(e.karta.defId),
            karta: (sirka: number) => sLupou({ karta: e.karta, sirka, onClick: vyber }),
            priazen: { sila: priazenSila(e), nazov: scorecardStarsieho(data, e).nazov, kratko: ucinok.kratko, cely: ucinok.cely },
            cigarety: cena.cigarety,
            pohorsenia: cena.pohorsenia,
            vyber,
          };
        })
      : null;
  const tlacidloLinieStarsich: ReactNode =
    krokStarsich !== null ? (
      vyberPatronatu ? (
        <button
          type="button"
          className="ls-tlacidlo"
          onClick={() => {
            setLiniaPriPatronate(false);
            setPohladStarsich(null);
          }}
        >
          ← ponuka patronátu
        </button>
      ) : krokMoj ? null : (
        <button type="button" className="ls-tlacidlo" onClick={() => setNahliadnutie(true)} title="Krok nezruší — vráti sa klikom alebo Esc">
          pozrieť stôl
        </button>
      )
    ) : vyucba === true ? null : (
      // Vo výučbe prepína stôl a starších Melichar podľa kroku.
      <button type="button" className="ls-tlacidlo" onClick={zavriStarsich}>
        ← {vysledokKroku && pohladStarsich === null ? "ďalej na stôl" : "Späť na stôl"} <kbd>Esc</kbd>
      </button>
    );
  const prahy = (p: PlayerId) => prahyHraca(data, stol, p);
  const zavislost = (p: PlayerId) => stavZavislosti(data, { ...stol, kolo: view.kolo, hraci: view.hraci }, p);
  const popisKarty = (defId: string): string => {
    const def = data.cards.get(defId);
    return def === undefined ? defId : `${def.name}: ${def.effectText}`;
  };
  const b = view.bitkaStav;
  // Hrozba na stole do riadku bitky: súperova prvá (to je to prekvapenie z posledného slova, #35).
  const najdiVLinii = (uid: number) => view.strany.flat().find((pl) => pl.card.uid === uid);
  const textHrozby = (kto: "ja" | "su"): HrozbaBitky | null => {
    const h = hrozby[kto === "ja" ? ja : super_];
    if (h === null) return null;
    const pl = najdiVLinii(h.uid);
    // Názov karty sa neskloňuje — „na svoju kartu Svokra“.
    const karta = pl === undefined ? "kartu" : `${pl.playedBy === h.hrac ? (kto === "ja" ? "svoju" : "jeho") : kto === "ja" ? "jeho" : "tvoju"} kartu ${menoKarty(pl.card.defId)}`;
    const tuhe = `tuhé ${h.damage.tuhe[ja]} : ${h.damage.tuhe[super_]}`;
    const v = h.vysledok;
    const prebytok = v.prebytokDrzi === null ? "" : ` · prebytok ${v.prebytok} → ${v.prebytokDrzi === ja ? "tebe" : menoHraca(super_)}`;
    const kdo = kto === "ja" ? "Ty ešte môžeš" : `${menoHraca(super_)} ešte môže`;
    const kratkyPrebytok = v.prebytokDrzi === null ? "" : ` (prebytok ${v.prebytok} → ${v.prebytokDrzi === ja ? "ty" : "súper"})`;
    return {
      kto,
      uid: h.uid,
      mini: `${kto === "ja" ? "ty" : "súper"} až ${h.damage.tuhe[ja]} : ${h.damage.tuhe[super_]}${kratkyPrebytok}`,
      kratko: `${kto === "ja" ? "Ty ešte môžeš" : "Súper ešte môže"}: ${tuhe}${v.prebytokDrzi === null ? "" : ` · prebytok ${v.prebytok} → ${v.prebytokDrzi === ja ? "ty" : "súper"}`}`,
      cele: `${kdo} dať NA EX na ${karta}: ${tuhe}${prebytok} (z kariet na stole, ruka sa neráta).`,
    };
  };
  // Rozsah nepridelených Pohoršení — vedľa hrozby NA EX, rovnakým tvarom (Michal 2026-10-27).
  const textRozsahu = (kto: "ja" | "su"): HrozbaBitky | null => {
    const r = rozsahy[kto === "ja" ? ja : super_];
    if (r === null) return null;
    const v = r.vysledok;
    const tuhe = `tuhé ${r.damage.tuhe[ja]} : ${r.damage.tuhe[super_]}`;
    const pohorseni = `${r.pocet} ${r.pocet === 1 ? "Pohoršenie" : r.pocet <= 4 ? "Pohoršenia" : "Pohoršení"}`;
    return {
      kto,
      zdroj: "pohorsenia",
      uid: null,
      // Pohoršenia prídu isto — riadok s nimi začína bez „ešte môže“; číslo ide hneď za kto,
      // aby ho pri 1366 px neodrezalo (snímka 1366 × 650).
      mini: `${kto === "ja" ? "ty" : "súper"} až ${r.damage.tuhe[ja]} : ${r.damage.tuhe[super_]} Pohoršeniami`,
      kratko: `${kto === "ja" ? "Ty" : "Súper"} Pohoršeniami (${r.pocet}) až: ${tuhe}`,
      cele: `${kto === "ja" ? `Máš ${pohorseni}` : `${menoHraca(super_)} má ${pohorseni}`}, ktoré sa rozdelia až v bitke — priazeň platí hneď (Bitkár, Veriaci): najviac ${tuhe}${v.prebytokDrzi === null ? "" : ` · prebytok ${v.prebytok} → ${v.prebytokDrzi === ja ? "tebe" : menoHraca(super_)}`}.`,
    };
  };
  // Pohoršenia prídu v bitke isto, NA EX len možno — idú prvé; pri viacerých položkách bez prebytku
  // (je v titulku a nápovede), inak by sa do riadku pri 1366 px nezmestila ani druhá.
  const polozkyHrozby = [textRozsahu("su"), textHrozby("su"), textRozsahu("ja"), textHrozby("ja")].filter((h): h is HrozbaBitky => h !== null);
  const hrozbyBitky =
    polozkyHrozby.length < 2
      ? polozkyHrozby
      : polozkyHrozby.map((h) => ({ ...h, mini: h.zdroj === "pohorsenia" ? h.mini : h.mini.replace(/ \(prebytok [^)]*\)$/, "").replace(/^(ty|súper) až/, "$1 NA EX až") }));
  // Odhad bitky len keď ho hráči ovplyvnia — v Zhromaždení, Pitke a bitke;
  // pri voľbe cieľa a v drafte mätie (Michal 2026-10-20).
  const bitkaProps: BitkaPanelProps | null =
    odhad === null || view.faza === "volbaCiela" || view.faza === "draft" || view.koniec !== null
      ? null
      : {
          rodJa: rodHracaP(ja),
          damage: b?.damage ?? odhad,
          sums: lineEval.sums,
          zdroje: lineEval.zdroje,
          rozpis,
          menoKarty,
          ja,
          vysledok: b?.damage != null,
          mena: [menoHraca(0), menoHraca(1)],
          sada,
          ciel: lokalita !== null ? `o ${menoKarty(lokalita.defId)}` : "",
          naSekeru: view.spakyNaSekere > 0 ? [`${view.spakyNaSekere} špakov`] : [],
          poslednaBitka: view.ciel?.typ === "finale",
          prebytokNaRozdelenie: prebytokNaRozdelenie(view, battleOutcome(b?.damage ?? odhad)),
          skrytaSupera: b?.damage == null && view.zaverecne.some((z) => z.majitel !== ja),
          utocnik: `útočník: ${view.utocnik === ja ? "ty" : menoHraca(view.utocnik)} — ${view.kolo === 1 ? "v 1. kole náhodne" : "porazený z minulej bitky (remíza roly nemení)"}`,
          hrozby: b?.damage != null ? [] : hrozbyBitky,
          ukazHrozbu: setUkazHrozbu,
        };
  // Strany jednotného baru (Michal 2026-10-25): aktivované akcie, alebo karty na vyloženie.
  // Kým hráč neklikne na odhad, režim určí fáza; ručné prepnutie platí do konca fázy.
  const klucRezimu = klucFazy(view.kolo, view.faza, view.pitkaCislo);
  const [rezimRucne, setRezimRucne] = useState<{ readonly kluc: string; readonly rezim: RezimStran } | null>(null);
  // Na mobile sú akcie v celom paneli bitky pod barom — strany baru nesú len karty.
  const rezimStran: RezimStran = mobil ? "karty" : rezimRucne?.kluc === klucRezimu ? rezimRucne.rezim : predvolenyRezim(view.faza);
  const prepniStrany = (): void => setRezimRucne({ kluc: klucRezimu, rezim: rezimStran === "akcie" ? "karty" : "akcie" });
  const bitkaPanel = bitkaProps === null || !mobil ? null : <BitkaPanel {...bitkaProps} />;

  // ---- vydesenie a priazeň (Michal 2026-10-16) -----------------------------
  const prahVyd = prahVydesenia(view);
  const vydeseni = [0, 1].map((p) => view.starsi.filter((e) => vydesil(e, p as PlayerId)).length) as [number, number];
  // Ohlásené vydesenie: kto ho udrží do konca nasledujúceho kola, vyhrá.
  const hrozbaVydesenia = ([ja, super_] as const)
    .filter((p) => view.ohlaseneVydesenie[p] !== null && view.koniec === null)
    .map((p) => {
      const kolo = (view.ohlaseneVydesenie[p] ?? 0) + 1;
      return (
        <div key={p} className={`hrozba-vydesenia ${p === ja ? "moja" : "superova"}`} role="alert">
          {p === ja ? (
            <>
              <strong>
                {tvar(rodHracaP(ja), "Vydesil si", "Vydesila si", "Máš vydesených")} {vydeseni[p]} starších!
              </strong> Ak ich udržíš do konca kola {kolo}, vyhráš.
            </>
          ) : (
            <>
              <strong>
                {menoHraca(p)} {tvar(rodHracaP(p), "vydesil", "vydesila", "desí")} {vydeseni[p]} starších!
              </strong>{" "}
              Ak ich udrží do konca kola {kolo}, vyhrá. Vráť niektorého do sivej — vydeseného staršieho si po šenku vezmi do ruky (patronát).
            </>
          )}
        </div>
      );
    });

  // Keď hráčovi pribudne priazeň (posun k nemu), povie mu to hra hneď aj s účinkom —
  // v playteste 20261016-134912 to porazená nepochopila. Michal 2026-10-23: plávajúci
  // toast na hornej hrane stola (nemení rozloženie), jeden naraz, 4 s; záznam píše
  // do logu server (zaznamyPriazne v jadre), takže ostane aj po obnovení stránky.
  type ToastPriazne = { readonly id: number; readonly komu: PlayerId; readonly zaklad: string; readonly pocet: number; readonly cele: string };
  const [toastPriazne, setToastPriazne] = useState<ToastPriazne | null>(null);
  const predoslaPriazen = useRef<ReadonlyMap<string, { readonly komu: PlayerId | null; readonly sila: number }> | null>(null);
  const idOznamu = useRef(0);
  // Počas Počítadla bitky by ho prekrylo — počká a jeho 4 s začnú až po ňom.
  const toastCaka = useRef<ToastPriazne | null>(null);
  // Ten istý text tesne po sebe (pohľad sa prekreslí s rovnakou zmenou) toast neobnoví.
  const poslednyToast = useRef<{ readonly text: string; readonly kedy: number } | null>(null);
  // Druhá priazeň tesne po prvej (ďalší krok tej istej bitky) by prvú prepísala skôr,
  // než sa dá prečítať — zlúči sa do jedného toastu s „(+n)“.
  const zobrazenyToast = useRef<{ readonly t: ToastPriazne; readonly od: number } | null>(null);
  const zluc = (stary: ToastPriazne | null, novy: ToastPriazne): ToastPriazne =>
    stary === null ? novy : { ...novy, pocet: stary.pocet + novy.pocet, cele: `${stary.cele}\n${novy.cele}` };
  const ukazToast = (t: ToastPriazne | null): void => {
    zobrazenyToast.current = t === null ? null : { t, od: performance.now() };
    setToastPriazne(t);
  };
  useEffect(() => {
    const teraz = new Map(view.starsi.map((e) => [e.elderId, { komu: priazenHraca(e), sila: priazenSila(e) }]));
    const pred = predoslaPriazen.current;
    predoslaPriazen.current = teraz;
    if (pred === null) return;
    const nove: { komu: PlayerId; kratko: string; cele: string }[] = [];
    for (const e of view.starsi) {
      const t = teraz.get(e.elderId);
      const p = pred.get(e.elderId);
      if (t === undefined || t.komu === null) continue;
      if (p !== undefined && p.komu === t.komu && p.sila >= t.sila) continue;
      const sc = scorecardStarsieho(data, e);
      const meno = menoKarty(e.karta.defId);
      nove.push({
        komu: t.komu,
        kratko: `${meno} ${t.komu === ja ? "ti dáva" : `dáva ${menoHraca(t.komu)}`} priazeň ${t.sila}: ${UCINOK_KRATKO[sc.favour](t.sila)}`,
        cele: `${t.komu === ja ? "Dostávaš" : `${menoHraca(t.komu)} dostáva`} priazeň ${meno} (${sc.nazov}) sily ${t.sila}: ${UCINOK_PRIAZNE[sc.favour](t.sila)}`,
      });
    }
    const posledny = nove[nove.length - 1];
    if (posledny === undefined) return;
    // Len jeden naraz — ďalší nahradí predošlý; viac naraz zhrnie „(+n)“, všetky sú v Logu.
    const kratko = posledny.kratko + (nove.length > 1 ? ` (+${nove.length - 1})` : "");
    const teraz2 = performance.now();
    if (poslednyToast.current !== null && poslednyToast.current.text === kratko && teraz2 - poslednyToast.current.kedy < 8000) return;
    poslednyToast.current = { text: kratko, kedy: teraz2 };
    const novy = { id: ++idOznamu.current, komu: posledny.komu, zaklad: posledny.kratko, pocet: nove.length, cele: nove.map((n) => n.cele).join("\n") };
    const z = zobrazenyToast.current;
    if (pocitadloAktivne.current) toastCaka.current = zluc(toastCaka.current, novy);
    else ukazToast(z !== null && teraz2 - z.od < 1500 ? zluc(z.t, novy) : novy);
    // menoHraca a ja sú len na text; stačí sledovať starších.
  }, [view.starsi, data]);
  useEffect(() => {
    if (pocitadloBezi || toastCaka.current === null) return;
    ukazToast(toastCaka.current);
    toastCaka.current = null;
  }, [pocitadloBezi]);
  useEffect(() => {
    if (toastPriazne === null) return;
    const t = setTimeout(() => setToastPriazne((x) => (x?.id === toastPriazne.id ? null : x)), 4000);
    return () => clearTimeout(t);
  }, [toastPriazne]);
  // Poloha toastu: vedľa pilulky pokynu na hornej hrane stola, ak je tam miesto,
  // inak tesne pod ňou v pravom rohu stola — nikdy nie cez bary, ruku, pokyn či karty.
  const [polohaToastu, setPolohaToastu] = useState<CSSProperties | null>(null);
  const toastJe = toastPriazne !== null;
  useLayoutEffect(() => {
    if (!toastJe) return;
    const zmeraj = (): void => {
      const obal = liniaObalRef.current?.getBoundingClientRect();
      const pilulka = liniaObalRef.current?.querySelector(".linia-stav")?.getBoundingClientRect();
      if (obal === undefined || pilulka === undefined) return setPolohaToastu(null);
      const vedla = obal.right - pilulka.right - 28;
      setPolohaToastu(
        vedla >= 200
          ? { top: pilulka.top - obal.top + pilulka.height / 2, right: 12, maxWidth: vedla, translate: "0 -50%" }
          : { top: pilulka.bottom - obal.top + 6, right: 12, maxWidth: Math.min(380, obal.width / 3) },
      );
    };
    zmeraj();
    window.addEventListener("resize", zmeraj);
    return () => window.removeEventListener("resize", zmeraj);
  }, [toastJe, toastPriazne?.id]);
  const toastPriazneEl =
    toastPriazne === null ? null : (
      <button
        key={toastPriazne.id}
        type="button"
        className={`toast-priazne ${toastPriazne.komu === ja ? "moja" : "superova"}`}
        style={polohaToastu ?? undefined}
        role="status"
        aria-live="polite"
        title={`${toastPriazne.cele}\n(klik zavrie, záznam je v Logu)`}
        onClick={() => ukazToast(null)}
        onContextMenu={pravyKlik(() => ukazToast(null))}
      >
        <span aria-hidden="true">♥</span> {toastPriazne.zaklad}
        {toastPriazne.pocet > 1 && ` (+${toastPriazne.pocet - 1})`}
      </button>
    );

  // ---- tieň karty, ktorú vzal súper zo šenku (#111, Michal 2026-10-26) -----
  // Na mieste karty ostane do konca draftu stlmená karta so súperovým menom — hráč vidí,
  // čo mu súper zobral. Vlastné vzaté karty tieň nenechajú, tie má hráč v ruke.
  const zobrateZoSenku = view.faza === "draft" ? (draft?.zobrate ?? []) : [];
  const tieneSenku = zobrateZoSenku.filter((z) => z.hrac === super_);
  const tienSenku = (z: ZobrataVerejne, sirka: number): ReactNode => {
    const uid = UID_TIENA - z.miesto;
    const kto = `${tvar(rodHracaP(super_), "vzal", "vzala", "má")} ${menoHraca(super_)}`;
    return sLupou(
      { karta: { uid, ...z.karta }, sirka },
      {
        kluc: uid,
        trieda: "senok-tien",
        titul: `${menoKarty(z.karta.defId)} — zo šenku si ju ${tvar(rodHracaP(super_), "vzal", "vzala", "vzal(a)")} ${menoHraca(super_)}`,
        stitok: <span className="senok-tien-stitok">{kto}</span>,
        tien: z.miesto,
      },
    );
  };
  /** Karty šenku v rade aj s tieňmi — každá na mieste, kde ležala pred braním. */
  const radSenkuSTienmi = (karty: readonly CardInstance[], kresli: (k: CardInstance) => ReactNode, sirka: number): ReactNode[] =>
    radSenku(view.senok, karty, zobrateZoSenku, super_).map((x) => (x.typ === "karta" ? kresli(x.karta) : tienSenku(x.zobrata, sirka)));
  // Prelet karty, ktorú súper práve vzal: z miesta jej tieňa k jeho doske (aj bot, aj Melichar vo výučbe).
  const [prelety, setPrelety] = useState<readonly (Prelet & { readonly karta: ZobrataVerejne["karta"] })[]>([]);
  const zobratePred = useRef<{ readonly kolo: number; readonly pocet: number } | null>(null);
  useLayoutEffect(() => {
    const pred = zobratePred.current;
    zobratePred.current = { kolo: view.kolo, pocet: zobrateZoSenku.length };
    // Po načítaní partie (aj po odpojení) sa nič neprehráva — len branie, ktoré hráč práve videl.
    if (pred === null || pred.kolo !== view.kolo || zobrateZoSenku.length <= pred.pocet) return;
    const nove = zobrateZoSenku.slice(pred.pocet).filter((z) => z.hrac === super_);
    if (nove.length === 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const obdlznik = (el: Element | null): Obdlznik | null => {
      const r = el?.getBoundingClientRect();
      return r === undefined || r.width === 0 ? null : { left: r.left, top: r.top, width: r.width, height: r.height };
    };
    const na = obdlznik(document.querySelector(".doska.superova .zdroj-karty")) ?? obdlznik(document.querySelector(".doska.superova"));
    // Keď súperovo branie draft ukončilo, šenok na stole už nie je — karta vyletí spod tlačidla Šenok.
    const tlacidlo = obdlznik(document.querySelector('[data-vyucba="hlavicka:senok"]'));
    const nahradny = tlacidlo === null ? null : { left: tlacidlo.left, top: tlacidlo.top + tlacidlo.height, width: 96, height: Math.round(96 * POMER_KARTY) };
    if (na === null) return;
    const pridaj = nove.flatMap((z) => {
      const odkial = obdlznik(document.querySelector(`.senok-tien[data-tien="${z.miesto}"] .kl`)) ?? nahradny;
      return odkial === null ? [] : [{ kluc: `${view.kolo}-${z.miesto}`, z: odkial, na, karta: z.karta }];
    });
    if (pridaj.length > 0) setPrelety((x) => [...x, ...pridaj]);
  });

  // ---- draft na stole (Michal 2026-10-16) ----------------------------------
  // Na stole (#67) sa Smetisko a balíček zmestia do jedného radu: 12 miest na šírku;
  // na výšku karty vyplnia vrstvu stola bez réžie panelu (malý notebook, Michal 2026-10-23).
  const radZatial = stavim && view.senok.length > 0 ? 0.7 : 0;
  const miestDraftu = stavim ? 12 : Math.max(6, view.faza === "draft" ? view.senok.length + tieneSenku.length : view.lokalityVHre.length);
  const sirkaDraftu = mobil
    ? 84
    : Math.max(
        56,
        Math.min(
          170,
          // Na šírku: stavba má 12 miest (Smetisko + balíček), branie kariet šenku, voľba cieľa lokalít;
          // 60 px okraje panelu a zón, 10 px medzera za každou kartou.
          sirkaLinie > 0 ? Math.floor((sirkaLinie - 60) / miestDraftu) - 10 : 118,
          // Pri stole so scrollom má vrstva výšku podľa obsahu — karty sa podľa nej nezmenšujú.
          stolScroll ? Number.POSITIVE_INFINITY : vyskaVrstvy > 0 ? Math.floor((vyskaVrstvy - reziaDraftu) / (POMER_KARTY * (1 + radZatial))) : 118,
        ),
      );
  /** Zóna stavby šenku: karta v nej, alebo prázdne miesto s popisom. */
  const zonaStavby = (ciel: string, nazov: string, pozn: string, uids: readonly number[], kapacita: number): ReactNode => {
    if (kapacita <= 0) return null;
    const karty = uids.flatMap((uid) => draft?.mojBalicek.filter((x) => x.uid === uid) ?? []);
    return (
      <div className={zonaTriedy(ciel, `stavba-zona ${ciel === SMETISKO ? "smetisko" : "senok"}`)} data-ciel={jeCiel(ciel) ? ciel : undefined}>
        <span className="stavba-zona-nazov">
          {nazov} <small>{karty.length}/{kapacita}</small>
        </span>
        <span className="stavba-zona-karty harmonika">
          {karty.map((k) => {
            const z: Zdroj = { karta: k, odkial: "stavba", navrh: false };
            // Klik (aj pravý) vráti kartu zo Smetiska späť do balíčka.
            const spat = (): void => doZonyStavby(k.uid, false);
            const props = { karta: k, sirka: sirkaDraftu, onClick: spat };
            return somNaTahu
              ? sLupou(props, { obsah: tahatelna(z, karta(props), k.uid, undefined, undefined, spat), zdroj: z, odstran: spat })
              : sLupou({ karta: k, sirka: sirkaDraftu });
          })}
          {Array.from({ length: Math.max(0, kapacita - karty.length) }, (_, i) => (
            <div key={`m${i}`} className="stavba-zona-miesto" style={{ width: sirkaDraftu, height: Math.round(sirkaDraftu * POMER_KARTY) }}>
              {somNaTahu ? "potiahni sem kartu" : null}
            </div>
          ))}
        </span>
        <span className="stavba-zona-pozn">{pozn}</span>
      </div>
    );
  };
  // Voľba cieľa na stole (Michal 2026-10-19): lokality sú v paneli namiesto
  // stavby šenku.
  const cielPanel = ((): ReactNode => {
    if (view.faza !== "volbaCiela" || view.koniec !== null) return null;
    const naStole = lokalitaNavrh?.karta ?? null;
    return (
      <section ref={cielPanelRef} className={`draft-panel volba-ciela ${somNaTahu ? "moj-tah" : "cakanie"}`} aria-label="Cieľ kola">
        <header className="draft-hlava">
          <strong>Cieľ kola</strong>
          <span>
            {!somNaTahu
              ? `${menoHraca(super_)} vyberá, o čo sa bude v tomto kole bojovať.`
              : naStole !== null
                ? `Na stole: ${menoKarty(naStole.defId)} — klikom ju otočíš a potvrdíš na stole (pravým klikom ju vrátiš). Alebo vyber inú.`
                : "Klikni na lokalitu, o ktorú sa chceš biť."}
          </span>
        </header>
        <div className="harmonika draft-karty volba-ciela-karty" data-vyucba="lokality">
          {view.lokalityVHre.length === 0 && <span className="popis">Žiadne lokality v hre.</span>}
          {view.lokalityVHre
            .filter((k) => k.uid !== lokalitaNavrh?.karta.uid)
            .map((k) => {
              const z: Zdroj = { karta: k, odkial: "lokality", navrh: false };
              const props = {
                karta: k,
                sirka: sirkaDraftu,
                onClick: volimLokalitu
                  ? () => setNavrh({ typ: "lokalita", uid: k.uid, otocena: lokalitaNavrh?.otocena ?? ja === 1 })
                  : undefined,
              };
              return volimLokalitu ? sLupou(props, { obsah: tahatelna(z, karta(props)), zdroj: z }) : sLupou(props);
            })}
        </div>
        {view.spakyNaSekere > 0 && (
          <p className="sekera-pozn">
            <strong>Na sekere:</strong> {spakov(view.spakyNaSekere)} — vezme ich víťaz tejto bitky. Vo finále pri sekere prepadnú.
          </p>
        )}
        {view.nastenka.length > 0 && nastenkaEl(false)}
      </section>
    );
  })();
  const draftPanel = ((): ReactNode => {
    if (draft === null || view.faza !== "draft" || view.koniec !== null) return null;
    if (stavim) {
      const odhod = somNaTahu ? odhodStavby : (draft.mojVyber?.odhod ?? []);
      const zvysok = draft.mojBalicek.filter((k) => !odhod.includes(k.uid));
      const textStavby = !stavbaHotova
        ? `Na Smetisku ${odhod.length} z ${krokSt.odhod}. Kartu zo Smetiska vrátiš klikom; na plné Smetisko ustúpi posledná.`
        : `Hotovo? ${zvysnePojdu(zvysok.length).replace(/^z/, "Z")} do Šenku.`;
      return (
        <section ref={draftPanelRef} className={`draft-panel stavba ${somNaTahu ? "moj-tah" : "cakanie"}`} aria-label="Stavba šenku" data-vyucba="stavba">
          {/* Na stole nadpis aj čo robiť hovorí pilulka a „potvrdiť“ je pečiatka na hrane stola — hlavička
              a pätička brali výšku kartám (malý notebook, Michal 2026-10-23 a 2026-10-25). */}
          {somNaTahu && !mobil ? null : (
            <header className="draft-hlava">
              <strong>Stavba šenku</strong>
              <span>
                {somNaTahu
                  ? `Tvoj balíček: ${kariet(draft.mojBalicek.length)} — vyber ${kariet(krokSt.odhod)} na Smetisko, ${zvysnePojdu(krokSt.doSenku)} do Šenku.`
                  : zaHracaHra && draft.mojVyber === null
                    ? "Šenok za teba stavia Melichar."
                    : `${tvar(rodHracaP(ja), "Vybral si", "Vybrala si", "Výber je hotový")} — čakáš, kým vyberie ${menoHraca(super_)}.`}
              </span>
            </header>
          )}
          <div className="stavba-rad">
            {zonaStavby(SMETISKO, "Smetisko", "naspodok spoločného balíčka · súper ich neuvidí", odhod, krokSt.odhod)}
            <div
              className={zonaTriedy(BALICEK_STAVBY, "stavba-balicek harmonika")}
              data-ciel={jeCiel(BALICEK_STAVBY) ? BALICEK_STAVBY : undefined}
            >
              <span className="stavba-balicek-nazov">
                do Šenku <small>{zvysok.length}/{krokSt.doSenku}</small>
              </span>
              {/* Karta, ktorá odišla na Smetisko, nechá po sebe prázdne miesto — ostatné neposkočia
                  a ďalší klik trafí, kam hráč mieril (playtest výučby). */}
              {draft.mojBalicek.map((k) => {
                if (odhod.includes(k.uid)) {
                  return <div key={`m${k.uid}`} className="stavba-prazdne" style={{ width: sirkaDraftu, height: Math.round(sirkaDraftu * POMER_KARTY) }} aria-hidden="true" />;
                }
                const z: Zdroj = { karta: k, odkial: "stavba", navrh: false };
                if (!somNaTahu) return sLupou({ karta: k, sirka: sirkaDraftu });
                const props = { karta: k, sirka: sirkaDraftu, onClick: () => doZonyStavby(k.uid, true) };
                return sLupou(props, { obsah: tahatelna(z, karta(props)), zdroj: z });
              })}
            </div>
          </div>
          {somNaTahu && mobil && !naneisto && (
            <footer className="draft-paticka">
              <span>{textStavby}</span>
              <button className="tlacidlo-hlavne" data-skratka="k" disabled={!stavbaHotova} onClick={potvrdStavbu}>
                potvrdiť
              </button>
            </footer>
          )}
          {view.senok.length > 0 && (
            <div className="stavba-senok-zatial">
              <span className="oblast-nazov">v šenku zatiaľ · {view.senok.length}</span>
              <div className="harmonika draft-karty">{view.senok.map((k) => sLupou({ karta: k, sirka: Math.round(sirkaDraftu * 0.7) }))}</div>
            </div>
          )}
        </section>
      );
    }
    if (!beriem) return null;
    const mam = draft.noveKarty[ja];
    const cig = view.hraci[ja].cigarety;
    const cena = KONSTANTY.CENA_SENKU[zoSenku.length] ?? 0;
    return (
      <section ref={draftPanelRef} className={`draft-panel branie ${mozemBrat ? "moj-tah" : "cakanie"}`} aria-label="Branie zo šenku">
        {/* Na stole hovorí pilulka, kto berie a za koľko, a skóre aj potvrdenie ležia na hrane stola —
            hlavička by brala výšku kartám (malý notebook, Michal 2026-10-25). */}
        {mobil && (
          <header className="draft-hlava">
            <strong className="branie-kto">
              {mozemBrat
                ? `Tvoj ťah — potiahni ${kolkoMozemBrat === 2 ? "1 alebo 2 karty" : "kartu"} do ruky`
                : somNaTahu
                  ? "Na kartu zo šenku nemáš cigaretu"
                  : `Berie ${menoHraca(super_)}…`}
            </strong>
            <span className="branie-cena">
              1 karta = {cigariet(KONSTANTY.CENA_SENKU[1] ?? 1)} · 2 karty = {cigariet(KONSTANTY.CENA_SENKU[2] ?? 3)} <small>(máš {cig})</small>
            </span>
            <span className="branie-skore">
              <span className="moje">ty {mam}</span>
              <span className="superove">
                {menoHraca(super_)} {draft.noveKarty[super_]}
                {draft.hotovo[super_] ? " · už neberie" : ""}
              </span>
            </span>
          </header>
        )}
        <div className="harmonika draft-karty branie-karty" data-vyucba="senok">
          {view.senok.length === 0 && tieneSenku.length === 0 && <span className="popis">Šenok je prázdny.</span>}
          {radSenkuSTienmi(
            view.senok.filter((k) => !zoSenku.some((x) => x.uid === k.uid)),
            (k) => {
              const z: Zdroj = { karta: k, odkial: "senok", navrh: false };
              // Klik vezme kartu do ruky ako návrh (bez ťahania, UX N4) — „hotovo“ ju potvrdí.
              const props = { karta: k, sirka: sirkaDraftu, ...(mozemBrat ? { onClick: () => prepniZoSenku(k.uid) } : {}) };
              return mozemBrat ? sLupou(props, { obsah: tahatelna(z, karta(props)), zdroj: z }) : sLupou(props);
            },
            sirkaDraftu,
          )}
        </div>
        {/* Na mobile pätička pod kartami; na stole je potvrdenie pečiatkou na hrane (pokyn.stred). */}
        {mobil && (
          <footer className="draft-paticka" title={pravidloBrania}>
            <span className="tlmene">
              {zoSenku.length === 0
                ? pravidloBrania
                : `Berieš ${zoSenku.map((k) => menoKarty(k.defId)).join(" a ")} za ${cigariet(cena)}.`}
            </span>
            {zoSenku.length > 0 ? (
              <>
                <button onClick={() => setNavrh(null)}>vrátiť</button>
                <button className="tlacidlo-hlavne" data-skratka="k" onClick={potvrdBranie}>
                  hotovo <span className="cena">−{cena} cig.</span>
                </button>
              </>
            ) : (
              <button
                className="tlacidlo-cigarety"
                data-skratka="p"
                data-vyucba="tlacidlo:pas"
                disabled={!somNaTahu}
                title={somNaTahu ? `Prestaneš brať zo šenku; v Zhromaždení vyložíš ${limitTeraz}.` : "Počkaj, kým budeš na ťahu."}
                onClick={() => posli({ type: "draftStop" })}
              >
                už neťahám
              </button>
            )}
          </footer>
        )}
      </section>
    );
  })();

  // Stôl bez scrollovania (#67): na počítači leží voľba cieľa a draft na stole namiesto
  // prázdnej línie. Lokalita na otočenie a potvrdenie je v línii — vtedy sa vráti línia.
  useEffect(() => {
    if (vybranaDoOblasti === null) return;
    const klaves = (e: KeyboardEvent): void => {
      if (e.key === "Escape") setVybranaDoOblasti(null);
    };
    window.addEventListener("keydown", klaves);
    return () => window.removeEventListener("keydown", klaves);
  }, [vybranaDoOblasti]);
  // Esc vráti návrh ťahu do ruky až ako posledná vrstva (Leader 2026-10-24). Obsluhy
  // ostatných vrstiev bežia na ten istý kláves; stav z tohto kreslenia ešte ukazuje,
  // čo bolo otvorené pred stlačením, a DOM sa do konca udalosti nezmení.
  useEffect(() => {
    if (navrh === null) return;
    const klaves = (e: KeyboardEvent): void => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      const otvorene = (sel: string): boolean => [...document.querySelectorAll(sel)].some((el) => el.getClientRects().length > 0);
      const vrstvy: VrstvyPreEsc = {
        // Lupa karty, ktorá klikom odišla zo šenku do ruky, ostane v stave bez kresby (nemá
        // z čoho odísť myšou) — Esc by inak návrh nikdy nevrátil.
        lupa: (lupa !== null && lupaKarty.has(lupa.kluc)) || otvorene(".lupa:not(.doznieva)"),
        dialog: vrstva !== null || skratky.napoveda || otvorene('[role="dialog"]'),
        starsi: starsiViditelni || nahliadnutie,
        vyber: miestoVolby !== null || mode.typ === "naexCiel" || vybranaDoOblasti !== null,
        potvrdenie: potvrdenie !== null,
        pult: otvorene(".sb-bar"),
      };
      const navrat = tlacidloNavratu();
      if (!escVratiNavrh(vrstvy, navrat !== null)) return;
      e.preventDefault();
      navrat?.click();
    };
    window.addEventListener("keydown", klaves);
    return () => window.removeEventListener("keydown", klaves);
  });
  /** Klik na kartu v ruke: karta → cieľ na dlaždici. */
  const vyberDoOblasti = (k: CardInstance): void => {
    setMiestoVolby(null);
    setVybranaDoOblasti(vybranaDoOblasti === k.uid ? null : k.uid);
  };
  const vylozDoOblasti = (ciel: "priznanie" | "dedicstvo"): void => {
    if (vybranaKarta === null || !kamIde(vybranaKarta)[ciel]) return;
    const bez = vylozenia.filter((x) => x.karta.uid !== vybranaKarta.uid).map((x) => ({ uid: x.karta.uid, ciel: x.ciel }));
    setNavrh({ typ: "vylozenia", polozky: [...bez, { uid: vybranaKarta.uid, ciel }] });
    setVybranaDoOblasti(null);
  };
  // Vrstva Karty so záložkami; klik na súperovu dlaždicu ukáže jeho Priznané a Dedičstvo.
  const [kartyHrac, setKartyHrac] = useState<PlayerId>(ja);
  const [kartyZalozka, setKartyZalozka] = useState<ZalozkaKariet>("balicek");
  const otvorKarty = (p: PlayerId, zalozka?: ZalozkaKariet): void => {
    const z = zalozka ?? (p === ja ? "balicek" : "priznane");
    if (vrstva === "karty" && kartyHrac === p && (zalozka === undefined || kartyZalozka === z)) {
      setVrstva(null);
      return;
    }
    setKartyHrac(p);
    setKartyZalozka(z);
    setVrstva("karty");
  };
  const kartyDlazdica = (p: PlayerId): KartyDlazdica => ({
    otvorena: vrstva === "karty" && kartyHrac === p,
    otvor: () => otvorKarty(p),
    navrhy: p === ja ? vylozenia.filter((x) => x.ciel === "priznanie" || x.ciel === "dedicstvo").length : 0,
    ciel:
      p !== ja || cielDlazdice === null
        ? null
        : {
            nazov: cielDlazdice === "priznanie" ? "Priznať" : "Dedičstvo",
            pozn:
              cielDlazdice === "priznanie"
                ? kartaOblasti?.defId === "cirhoza"
                  ? "za Cirhózu kartu nedostaneš"
                  : "dobereš kartu · nemíňa limit"
                : `−${cigariet(view.cenaDedicstva)} · máš ${hJa.cigarety}`,
            zamknute: chybaDlazdice,
            aktivny: jeCiel(cielDlazdice) || (vybranaKarta !== null && smieNaDlazdicu),
            nad: nadCielom(cielDlazdice),
            dataCiel: jeCiel(cielDlazdice) ? cielDlazdice : undefined,
            // Klik s vybraným Nástrojom robí to isté ako „odkazujem“ — jedna cesta, nie dve.
            onKlik:
              vybranaKarta !== null && smieNaDlazdicu ? () => (cielDlazdice === "dedicstvo" ? odkaz(vybranaKarta) : vylozDoOblasti(cielDlazdice)) : undefined,
          },
  });

  // Počas pauzy po súperovej voľbe cieľa je vidno líniu s vybranou lokalitou, nie stavbu.
  // Voľbu cieľa ukazuje na stole nástenka (volbaNaStole); cielPanel ostáva pre mobil.
  const vrstvaFazy: ReactNode = mobil || pauzaBezi || volbaNaStole ? null : draftPanel;
  const liniaSkryta = starsiViditelni || vrstvaFazy !== null || nastenkaNaStole;
  // Karty lokalít na nástenke čo najväčšie, aby sa nástenka zmestila do plste bez posúvania.
  const sirkaNastenky = Math.min(Math.round(SIRKA_VO_VRSTVE * 0.62), Math.floor((vyskaPlste - NASTENKA_BEZ_KARTY) / POMER_KARTY));
  const sirkaVolby = Math.max(60, Math.min(SIRKA_VO_VRSTVE, Math.floor((vyskaPlste - NASTENKA_VOLBA_REZERVA) / POMER_KARTY)));
  // Voľba cieľa na nástenke: lokalita, o ktorú sa ešte nehralo, je karta na výber — klik ju dá
  // na stôl (otočiť a potvrdiť sa dá tam), dá sa aj potiahnuť. Útočník ich len vidí.
  const vyberNaNastenke = (k: CardInstance, sirka: number): ReactNode => {
    const z: Zdroj = { karta: k, odkial: "lokality", navrh: false };
    const props = {
      karta: k,
      sirka,
      onClick: volimLokalitu
        ? () => {
            setNavrh({ typ: "lokalita", uid: k.uid, otocena: lokalitaNavrh?.otocena ?? ja === 1 });
            setVrstva((v) => (v === "lokality" ? null : v));
          }
        : undefined,
    };
    return volimLokalitu ? sLupou(props, { obsah: tahatelna(z, karta(props)), zdroj: z }) : sLupou(props);
  };

  // ---- jednotný bar: strany, odhad a os kola (Michal 2026-10-25, mock V2) -------------
  // Vydesení sú v osi baru jedným krátkym údajom, celé znenie je v nápovede.
  const desi = (
    <span
      className={`jbar-desi vydeseni-pocet ${vydeseni[super_] >= prahVyd - 1 ? "hrozba" : ""}`}
      title={`Vydesení starší — ty ${vydeseni[ja]}, ${menoHraca(super_)} ${vydeseni[super_]} z ${prahVyd}. Kto vydesí ${prahVyd} starších (krajná červená pozícia) a udrží ich do konca ďalšieho kola, vyhrá.`}
    >
      <span className="jbar-desi-nazov">vydesení </span>
      <b className="moje">{vydeseni[ja]}</b>:<b className="superove">{vydeseni[super_]}</b>/{prahVyd}
    </span>
  );
  // Os kola v strede hlavičky webu (Michal 2026-10-27, dizajn timeline-lista A) — bar má jeden
  // riadok a stôl je vyšší. Mobil a prehrávač majú os v bare ako doteraz.
  const osVListe = !mobil && prehravanie === undefined;
  const skratkyZapnute = useUcet().ja?.skratky !== false;
  const osKola = (
    <>
      {/* Kód miestnosti je v hlavičke webu (menu Partia); v prehrávači ostáva číslo partie tu. */}
      {prehravanie !== undefined && (
        <span className="kod" title="číslo partie v archíve">
          {kod}
        </span>
      )}
      <PriebehKola
        view={view}
        onBitka={ucetBitky !== null && view.kolo === ucetBitky.kolo + 1 ? () => setUcetBitkyZavrety(false) : undefined}
        // Šenok na pozretie (napr. pred Starostom) — ďalší klik alebo Esc ho zavrie; v Drafte je na stole.
        onDraft={() => setVrstva((v) => (v === "senok" ? null : "senok"))}
      />
    </>
  );
  // Log a ? — tlačidlo Šenok zaniklo (Michal 2026-10-27): šenok sa ukáže sám, keď ho treba
  // (draft na stole, Starosta, Cintorín), a pokyn má naň tlačidlo.
  const nastrojeStola = (
    <div className="hlava-vrstvy">
      <button
        className={["hlava-vrstva", vrstva === "log" ? "otvorena" : ""].join(" ")}
        data-vyucba="hlavicka:log"
        onClick={() => setVrstva(vrstva === "log" ? null : "log")}
      >
        Log
        {log.length - videnyLog > 0 && <span className="pocet nove">{log.length - videnyLog}</span>}
      </button>
      {skratkyZapnute && (
        <button
          type="button"
          className={`hlava-vrstva hlava-skratky ${skratky.napoveda ? "otvorena" : ""}`}
          aria-expanded={skratky.napoveda}
          aria-keyshortcuts="?"
          data-vyucba="hlavicka:skratky"
          title="Klávesové skratky (?)"
          onClick={skratky.prepniNapovedu}
        >
          ?
        </button>
      )}
    </div>
  );
  const rukaPocet = (p: PlayerId): ReactNode => (
    <span key="ruka" className="jbar-ruka" title={p === ja ? "Kariet v tvojej ruke" : `Kariet v ruke — ${menoHraca(p)}`}>
      <b>{view.hraci[p].rukaPocet}</b> v ruke
    </span>
  );
  // Režim „karty“ (Michal 2026-10-25): povinne počet kariet — zvyšných na vyloženie alebo
  // v ruke podľa fázy; nič, čo už je inde na stole (cigarety, poldeci sú v bare hráča).
  const kartyBaru = (p: PlayerId): ReactNode => {
    const casti: ReactNode[] = [];
    const pozn = (kluc: string, text: ReactNode, title?: string): void => {
      casti.push(
        <span key={kluc} className="jbar-pozn" title={title}>
          {text}
        </span>,
      );
    };
    const zs = view.zhromazdenieStav;
    const ps = view.pitkaStav;
    const obranca: PlayerId = view.utocnik === 0 ? 1 : 0;
    if (view.koniec !== null) {
      casti.push(rukaPocet(p));
    } else if (view.faza === "zhromazdenie" && zs !== null) {
      const start = limitNaZaciatku?.kluc === klucZhromazdenia ? limitNaZaciatku.limit : zs.zostavaLimit;
      const spolu = Math.max(start[p], zs.zostavaLimit[p]);
      const zostava = zs.zostavaLimit[p];
      casti.push(
        <span key="sloty" className="pas-sloty" aria-hidden="true">
          {Array.from({ length: spolu }, (_, i) => (
            <span key={i} className={i < spolu - zostava ? "slot pouzity" : "slot"} />
          ))}
        </span>,
      );
      const poradie = obranca === p ? "v Pitke začína" : "v Pitke má posledné slovo";
      casti.push(
        <span key="text" className="jbar-hlavne" title={`${p === ja ? "Ty" : menoHraca(p)}: ${poradie}.`}>
          {zs.pasoval[p]
            ? tvar(rodHracaP(p), "pasoval", "pasovala", "pas")
            : zostava === 0
              ? tvar(rodHracaP(p), "vyložil všetko", "vyložila všetko", "všetko vyložené")
              : `${p === ja ? "vyložíš" : "vyloží"} ešte ${kariet(zostava)}`}
        </span>,
      );
    } else if (view.faza === "pitka" && ps !== null) {
      // NA EX naraz (v5): súperove NA EX je známe až po odkrytí (obaja skončili), moje skryté vidím.
      const naex = (ps.naexPocet?.[p] ?? 0) > 0;
      const skryte = p === ja && mojeSkryteNaex.size > 0;
      const odkryte = ps.hotovy[0] && ps.hotovy[1];
      // Pitka naraz (Michal 2026-10-27): poradie platí len pre odpovede na NA EX — útočník má posledné slovo.
      casti.push(rukaPocet(p));
      if (ps.reakcia === p) pozn("stav", p === ja ? "odpovedáš na NA EX" : "odpovedá na NA EX");
      else if (cakaSBzdochou(ps, p))
        pozn("stav", "čaká · Bzdocha", `S Bzdochou hrá Pitku až po ${p === ja ? menoHraca(super_) : "tebe"} a uvidí ${p === ja ? "jeho" : "tvoje"} NA EX.`);
      else if (ps.hotovy[p] && !odkryte && p !== ja && vidimVolbuSupera)
        pozn("stav", `✓ ${tvar(rodHracaP(p), "vybral", "vybrala", "vybrané")} · NA EX ${superoveSkryteNaex.size > 0 ? `×${superoveSkryteNaex.size}` : "nie"}`, "Vďaka Bzdoche vidíš jeho voľbu NA EX ešte pred odkrytím.");
      else if (ps.hotovy[p] && !odkryte && p !== ja)
        pozn("stav", `✓ ${tvar(rodHracaP(p), "vybral", "vybrala", "vybrané")} · NA EX?`, "Či a kam dal NA EX, uvidíš pri odkrytí — keď skončíš aj ty.");
      else if (ps.hotovy[p]) pozn("stav", `✓ ${tvar(rodHracaP(p), "skončil", "skončila", "koniec")}${naex || skryte ? " po NA EX" : odkryte ? " bez NA EX" : ""}`);
      else if (skryte) pozn("stav", "NA EX skryto", "Súper tvoje NA EX nevidí — odkryje sa, keď obaja skončíte Pitku.");
      else if (naex) pozn("stav", "NA EX dal");
      if (view.pitkaCislo < view.pitkyCelkom) pozn("limit", `ďalšie Zhromaždenie: ${limitZhromazdenia(view, p)}`, "Limit vykladania v ďalšom Zhromaždení.");
    } else if (view.faza === "draft" && draft !== null) {
      casti.push(rukaPocet(p));
      if (draft.krok === "stavba") pozn("stav", draft.vybral[p] ? `✓ ${tvar(rodHracaP(p), "vybral", "vybrala", "vybrané")}` : "stavia šenok");
      if (draft.noveKarty[p] > 0) pozn("senok", `+${draft.noveKarty[p]} zo šenku`);
      if (draft.krok === "beranie" && draft.hotovo[p]) pozn("stav", `✓ ${tvar(rodHracaP(p), "skončil", "skončila", "koniec")}`);
    } else if (view.faza === "bitka") {
      casti.push(rukaPocet(p));
      pozn("dobere", `po bitke dobere ${KONSTANTY.KARTY_PO_BITKE}`);
    } else {
      casti.push(rukaPocet(p));
    }
    return casti;
  };
  const naTahuStrana = (p: PlayerId): boolean => {
    if (view.koniec !== null) return false;
    if (view.faza === "draft" && draft?.krok === "stavba") return !draft.vybral[p];
    const ps = view.pitkaStav;
    // Pitka naraz: na ťahu sú obaja, kým neskončia (Bzdocha čaká).
    if (view.faza === "pitka" && ps !== null && view.vizia === null) return ps.reakcia === p || hraVPitke(ps, p);
    return view.naTahu === p;
  };
  const stranaBaru = (p: PlayerId): StranaBaru => ({
    meno: p === ja ? "ty" : menoHraca(p),
    naTahu: naTahuStrana(p),
    akcie: <AkcieStrany sums={lineEval.sums[p]} zdroje={lineEval.zdroje[p]} rozpis={rozpis[p]} sada={sada} menoKarty={menoKarty} sNazvom />,
    karty: kartyBaru(p),
  });
  const prepnutNa = rezimStran === "akcie" ? "karty na vyloženie" : "aktivované akcie";
  const stredBaru: ReactNode =
    bitkaProps !== null ? (
      <>
        <OdhadBaru {...bitkaProps} />
        {stavka !== null && <StavkaBitky stavka={stavka} kratko />}
      </>
    ) : (
      <>
        <span className="jbar-nadpis">{view.koniec !== null ? "koniec" : "cieľ"}</span>
        <b className="jbar-verdikt">
          {view.koniec !== null ? "Koniec hry" : lokalita !== null ? menoKarty(lokalita.defId) : "vyberá sa lokalita"}
        </b>
        {view.koniec === null && view.spakyNaSekere > 0 && <span className="jbar-tuhe">+ {view.spakyNaSekere} š. na sekere</span>}
      </>
    );

  // ---- účty a posledné udalosti (UX N3) ---------------------------------------
  const zn = (x: number): string => (x > 0 ? `+${x}` : x < 0 ? `−${-x}` : "±0");
  const ucetBitkyEl =
    !ukazUcetBitky || ucetBitky === null ? null : (
      <section className="ucet-bitky" aria-label={`Účet bitky — ${ucetBitky.lokalita}`} data-vyucba="bitka-ucet">
        <header>
          <strong>
            {ucetBitky.vitaz === null
              ? `Bitka · ${ucetBitky.lokalita}: remíza`
              : ucetBitky.vitaz === ja
                ? `Bitka · ${ucetBitky.lokalita}: ${tvar(rodHracaP(ja), "vyhral si", "vyhrala si", "výhra")} o ${Math.abs(ucetBitky.tuhe[0] - ucetBitky.tuhe[1])}`
                : `Bitka · ${ucetBitky.lokalita}: ${tvar(rodHracaP(ja), "prehral si", "prehrala si", "prehra")} o ${Math.abs(ucetBitky.tuhe[0] - ucetBitky.tuhe[1])}`}
          </strong>
          <button type="button" className="tlacidlo-male" onClick={() => setUcetBitkyZavrety(true)}>
            ďalej
          </button>
        </header>
        <ul>
          {ucetBitky.bitka !== null && (
            <li className="ucet-bitky-spaky" title="Špaky v popolníkoch pred bitkou → po nej a odkiaľ pribudli.">
              <IkonaSpaku /> <b>Špaky</b>{" "}
              {textSpakovBitky(ucetBitky.bitka, ucetBitky.spakyPred, [ja, super_], (p) => (p === ja ? "ty" : menoHraca(p)))}
            </li>
          )}
          <li>
            Tuhé {ucetBitky.tuhe[ja]} : {ucetBitky.tuhe[super_]}
            {ucetBitky.bitka?.rozhodlo === "abstak" && " · remíza, rozhodli Absťáky"}
            {ucetBitky.bitka?.rozhodlo === "dlhy" && " · remíza, rozhodli priznané Dlhy"}
            {ucetBitky.prebytokDrzi !== null &&
              ` · prebytok ${ucetBitky.prebytok}${ucetBitky.prebytokNaRozdelenie < ucetBitky.prebytok ? ` − Puška = ${ucetBitky.prebytokNaRozdelenie}` : ""} → ${ucetBitky.prebytokDrzi === ja ? "ty" : menoHraca(ucetBitky.prebytokDrzi)}`}
          </li>

          {ucetBitky.posuny.length > 0 && (
            <li>
              Posuny:{" "}
              {ucetBitky.posuny
                .map((x) => {
                  // Nižší index = polovica hráča 1 (miesto 0); smer, nie čísla — stupnica je zrkadlová.
                  const k: PlayerId = x.po < x.pred ? 0 : 1;
                  const zPred = ZONA[STUPNICA_ZONY[x.pred] ?? 0];
                  const zPo = ZONA[STUPNICA_ZONY[x.po] ?? 0];
                  const zony = zPred === zPo ? zPo : `${zPred} → ${zPo}`;
                  return `${x.meno} k ${k === ja ? "tebe" : menoHraca(k)} ${Math.abs(x.po - x.pred) > 1 ? `o ${Math.abs(x.po - x.pred)} ` : ""}(${zony})`;
                })
                .join(" · ")}
            </li>
          )}
        </ul>
      </section>
    );
  const textUctuPitky = ((): string | null => {
    if (ucetPitky === null || ucetPitky.kolo !== view.kolo || view.faza === "volbaCiela" || view.faza === "draft") return null;
    const za = (p: PlayerId): string => {
      const casti: string[] = [];
      if (ucetPitky.cirhozy[p] > 0) casti.push(`+${ucetPitky.cirhozy[p]} Cirhóza`);
      if (ucetPitky.dlhy[p] > 0) casti.push(`+${ucetPitky.dlhy[p]} Dlh`);
      const body = ucetPitky.cirhozy[p] * cenyKliatob[p].cirhoza + ucetPitky.dlhy[p] * cenyKliatob[p].dlh;
      if (body !== 0) casti.push(`(${zn(body)} b)`);
      if (ucetPitky.cigarety[p] > 0) casti.push(`+${ucetPitky.cigarety[p]} cig.`);
      return casti.length === 0 ? "nič" : casti.join(" ");
    };
    return `Pitka ${ucetPitky.pitka} vyhodnotená · ty: ${za(ja)} · ${menoHraca(super_)}: ${za(super_)}`;
  })();
  // Stavová správa má od jednotného baru pevné miesto pod odhadom (Michal 2026-10-25) — z hrany stola zmizla.
  // Vo výučbe hovorí len Melichar — správa o súperovom ťahu sa v bare neukáže (Michal 2026-10-25).
  const spravaBaru = vyberSpravu(chyba, textUctuPitky, poslednySuperov.length > 0 && vyucba !== true ? poslednySuperov.join(" · ") : null);

  // Spodná hrana stola (Michal 2026-10-21): vľavo nákupy za cigarety, v strede
  // NA EX! či potvrdenie návrhu, vpravo koniec ťahu.
  const hranaVlavo = stolTlacidla?.vlavo ?? pokyn?.vlavo ?? null;
  const hranaStred = stolTlacidla?.stred ?? pokyn?.stred ?? null;
  const vpravoTahu = stolTlacidla?.vpravo ?? null;
  // Pri výbere patróna ležia starší na stole s kartou (ponuka) alebo v línii na klik — tlačidlá
  // s menami by ich len opakovali a pri štyroch by pretiekli cez dosku hráča.
  const tlacidlaPokynu = vyberPatronatu ? undefined : pokyn?.tlacidla;
  const hranaVpravo =
    vpravoTahu === null && tlacidlaPokynu === undefined && pokyn?.vpravo === undefined ? null : (
      <>
        {vpravoTahu}
        {tlacidlaPokynu}
        {pokyn?.vpravo}
      </>
    );
  const maHranaTlacidla = hranaVlavo !== null || hranaStred !== null || hranaVpravo !== null;
  // Na stole (Michal 2026-10-25) je hrana jeden rad stredom na čiare okraja plste.
  const hranaStola = !maHranaTlacidla ? null : (
    // Počas pauzy po voľbe cieľa by „potvrdiť“ stavby svietilo v okne okolo lokality; miesto drží, aby stôl neposkočil.
    // V drafte sa hrana neprilepí nad ruku: stôl leží pod draftom a pri posúvaní
    // by zakrývala karty draftu a pokyn.
    // Ani keď z línie nad rukou nie je nič vidno (liniaVidno).
    <div className={`${view.faza === "draft" || !liniaVidno ? "stol-hrana neprilepena" : "stol-hrana"} s-tlacidlami${pauzaBezi ? " pocas-pauzy" : ""}`}>
      <div className="hrana-rad">
        <div className="hrana-vlavo">{hranaVlavo}</div>
        <div className="hrana-stred">{hranaStred}</div>
        <div className="hrana-vpravo">{hranaVpravo}</div>
      </div>
    </div>
  );

  // Nápis stojí nad lokalitou (pod ňou, keď nad ňou nie je miesto) — obidve hrany hovoria natočenie.
  const pauzaCielaEl = ((): ReactNode => {
    if (!pauzaBezi || lokalita === null) return null;
    const kTebe = krajStrany(ja);
    const kSuperovi = krajStrany(super_);
    const nad = oknoPauzy !== null && oknoPauzy.top > 150;
    const polohaNapisu: CSSProperties | undefined =
      oknoPauzy === null
        ? undefined
        : {
            left: oknoPauzy.left + oknoPauzy.width / 2,
            top: nad ? oknoPauzy.top - 14 : oknoPauzy.bottom + 14,
            transform: nad ? "translate(-50%, -100%)" : "translateX(-50%)",
          };
    return (
      <div
        className="pauza-ciela"
        style={{ "--pauza-ms": `${PAUZA_CIELA_MS}ms` } as CSSProperties}
        onClick={zrusPauzuCiela}
        onContextMenu={(e) => {
          e.preventDefault();
          zrusPauzuCiela();
        }}
      >
        {oknoPauzy !== null && (
          <div
            className="pauza-ciela-okno"
            style={{ left: oknoPauzy.left - 8, top: oknoPauzy.top - 8, width: oknoPauzy.width + 16, height: oknoPauzy.height + 16 }}
            aria-hidden="true"
          />
        )}
        <div className={`pauza-ciela-napis${oknoPauzy === null ? " stred" : ""}`} style={polohaNapisu} role="status" aria-live="assertive">
          <strong>Súper vybral: {menoKarty(lokalita.defId)}</strong>
          {kTebe !== null && kSuperovi !== null ? (
            <span>
              k tebe <b>{kTebe}</b> · k súperovi <b>{kSuperovi}</b>
            </span>
          ) : (
            ikonyStranStredu
          )}
          <small>klik alebo kláves — ďalej</small>
          <span className="pauza-ciela-cas" aria-hidden="true" />
        </div>
      </div>
    );
  })();

  return (
    <div
      className={stolScroll ? "hra stol-scroll" : "hra"}
      style={{ "--ruka-w": `${sirkaVRuke}px`, "--hlavicka-h": `${vyskaHlavicky}px` } as CSSProperties}
    >
      {pauzaCielaEl}
      {/* V prehrávači výsledok ukáže detail partie — okno konca s hodnotením a lobby tam nepatrí. */}
      {view.koniec !== null && !koniecZavrety && prehravanie === undefined && bezOknaKonca !== true && (
        <KoniecHry
          rodJa={rodHracaP(ja)}
          rody={[rodHracaP(0), rodHracaP(1)]}
          view={view}
          data={data}
          mena={[menoHraca(0), menoHraca(1)]}
          avatary={[hraci[0]?.avatar ?? null, hraci[1]?.avatar ?? null]}
          menoKarty={menoKarty}
          frajerina={frajerina}
          achievementy={achievementy ?? null}
          onZavri={() => setKoniecZavrety(true)}
          opustit={opustit}
        />
      )}
      <JednotnyBar
        os={osVListe ? null : osKola}
        desi={osVListe ? null : desi}
        nastroje={osVListe ? null : nastrojeStola}
        rezim={rezimStran}
        prepni={prepniStrany}
        stred={stredBaru}
        tip={bitkaProps !== null ? tipOdhadu(bitkaProps, stavka, prepnutNa) : { nadpis: "Strany baru", text: `Klik ukáže na stranách baru ${prepnutNa}.` }}
        ja={stranaBaru(ja)}
        su={stranaBaru(super_)}
        sprava={spravaBaru}
        zrusChybu={zrusChybu}
        bezPrepinaca={mobil}
      >
        {skratky.napoveda && <SkratkyNapoveda onZavri={skratky.zavriNapovedu} />}
      </JednotnyBar>
      {slotHlavicky !== null &&
        createPortal(
          prehravanie !== undefined ? (
            <div className="hlavicka-partia">{prehravanie}</div>
          ) : (
            // Štítok partie a menu Partia ▾ (Michal 2026-10-26, #22 A) — menu webu je počas partie preč (#23).
            <HlavickaPartie
              kod={kod}
              view={view}
              menoSupera={menoHraca(super_)}
              superBot={hraci[super_]?.bot === true}
              superPripojeny={superPripojeny}
              superOdpojenyOd={superOdpojenyOd}
              vyucba={vyucba === true}
              os={osVListe ? osKola : null}
              nastroje={osVListe ? nastrojeStola : null}
              melichar={vHlavicke}
              vzdat={() => cmd({ type: "vzdat" })}
              kontumacia={kontumacia}
              opustit={opustit}
            />
          ),
          slotHlavicky,
        )}

      <div className="plocha">
        {/* Súperi sedia oproti sebe (Michal 2026-10-22): súperov bar hore, tvoj pod stolom;
            scoreboard nad staršími zanikol — body sú v bare hráča. */}
        <HracDoska
          data={data}
          view={view}
          p={super_}
          info={hraci[super_]}
          prahy={prahy(super_)}
          zavislost={zavislost(super_)}
          menoKarty={menoKarty}
          popisKarty={popisKarty}
          vyhlad={vyhladPitky(super_)}
          cenaDlhu={cenyKliatob[super_].dlh}
          body={body}
          mena={[menoHraca(0), menoHraca(1)]}
          starsi={{ stlacene: starsiViditelni && krokStarsich === null && pohladLinie === super_, prepni: () => prepniStarsich(super_), id: idLinieStarsich }}
          spakyKlik={{ stlacene: vrstva === "lokality" && nastenkaPre === super_, prepni: () => otvorNastenku(super_) }}
          karty={kartyDlazdica(super_)}
          rezim={rezimBaru}
          pocitadloBezi={pocitadloBezi}
          // Stav súpera je bodkou na jeho avatare, nie v lište (dizajn timeline-lista A); bot sa neodpája.
          spojenie={hraci[super_]?.bot === true || vyucba === true || prehravanie !== undefined ? undefined : { pripojeny: superPripojeny, odpojenyOd: superOdpojenyOd }}
        />
        {/* Starší hore — mimo dosahu ruky, aby sa ich lupa nebila s lupou kariet v ruke. */}
        <div className="stred">
          {/* Stôl je hneď pod staršími — pás pokynov a ruka ho neprekryjú
              (playtest 20261012-055944); dosky hráčov sú pod ním. */}
          {hrozbaVydesenia}
          {ucetBitkyEl}
          {/* Na počítači ležia voľba cieľa a draft na stole (vrstvaFazy) — línia je vtedy prázdna. */}
          {mobil && cielPanel}
          {mobil && !pauzaBezi && draftPanel}
          {bitkaPanel}
          {/* Farba stola hovorí, čí je ťah: zelená = tvoj, sivá = čakáš. */}
          <div
            ref={liniaObalRef}
            className={`linia-obal ${view.koniec !== null ? "koniec" : somNaTahu ? "moj-tah" : "cakanie"}${hranaStola === null ? "" : maHranaTlacidla ? " s-hranou s-tlacidlami" : " s-hranou"}`}
            onContextMenu={pravyKlik(zrusVyberNaStole)}
          >
            {/* Pokyn je pilulka na hornej hrane stola (Michal 2026-10-21) — predtým pás nad rukou. */}
            {/* tabIndex: pokyn skrátený na jeden riadok sa rozbalí aj z klávesnice (fokus). */}
            {/* Výučba po bitke hovorí o starších, hoci partia stojí pri voľbe cieľa 2. kola — „klikni na
                lokalitu“ by hráča posielal na ťah, ktorý výučba nepustí. */}
            {!ukazStarsich && (
              <div className="linia-stav" role="status" aria-live="polite" tabIndex={0}>
                {(pokyn === null || pokyn.nadpis !== null) && (
                  <strong className="pilulka-nadpis">
                    {pokyn?.nadpis ?? (view.koniec !== null ? "Koniec hry" : somNaTahu ? "Tvoj ťah" : `Na ťahu je ${menoHraca(super_)}`)}
                  </strong>
                )}
                {pokyn?.text !== undefined && <span className="pilulka-text">{pokyn.text}</span>}
              </div>
            )}
            {toastPriazneEl}
            {prelety.map((x) => (
              <LetiacaKarta key={x.kluc} prelet={x} koniec={() => setPrelety((p) => p.filter((y) => y.kluc !== x.kluc))}>
                {karta({ karta: { uid: UID_TIENA - 500, ...x.karta }, sirka: Math.round(x.z.width) })}
              </LetiacaKarta>
            ))}
            <div className={`stol-plst${liniaSkryta ? " linia-skryta" : ""}${starsiViditelni && krokStarsich !== null ? " krok-starsich" : ""}`} ref={plstRef}>
            {/* Línia kariet ostáva v DOM a drží výšku stola — línia starších leží nad ňou (#68). */}
            <div className="linia harmonika-skupiny" ref={liniaRef} inert={liniaSkryta} aria-hidden={liniaSkryta || undefined} data-vyucba="linia">
              <div className="linia-skupina moja">
                {popisKraja(ja, "vlavo")}
                <div className="partia-rad harmonika">{radStrany(ja)}</div>
              </div>
              <div
                className={`linia-skupina lokalita${lokalitaNavrh !== null ? " navrh" : ""}${jeFinaleStola ? " finale" : ""}`}
                ref={lokalitaRef}
                data-vyucba={lokalitaNavrh !== null ? "lokalita-navrh" : undefined}
              >
                <span
                  className="partia-popis"
                  title={
                    stranyStredu === null || krajStrany(ja) === null || krajStrany(super_) === null
                      ? undefined
                      : `Hrana k tebe: ${krajStrany(ja)} · hrana k súperovi: ${krajStrany(super_)}`
                  }
                >
                  {jeFinaleStola && lokalita !== null ? "finále · lokalita" : lokalita !== null || lokalitaNavrh !== null ? "lokalita" : "cieľ kola"}
                </span>
                <div className="partia-rad harmonika">{stredLinie}</div>
                {popisStranStredu}
                {lokalitaNavrh !== null && tahanie === null && (
                  <span className="otocit-tip" data-vyucba="otocenie">
                    klik na kartu = otočiť ↻
                  </span>
                )}
              </div>
              <div className="linia-skupina superova">
                {popisKraja(super_, "vpravo")}
                <div className="partia-rad harmonika">{radStrany(super_)}</div>
              </div>
            </div>
            {vrstvaFazy !== null && !starsiViditelni && !nastenkaNaStole && (
              <div className="vrstva-fazy" ref={setVrstvaFazyEl}>
                {vrstvaFazy}
              </div>
            )}
            <div className="vrstva-starsich" id={idLinieStarsich} hidden={!starsiViditelni} data-vyucba="linia-starsich">
              {starsiViditelni && ponukaPatronatu !== null && (
                <PonukaPatronatu moznosti={ponukaPatronatu} menoSupera={menoHraca(super_)} vsetci={() => setLiniaPriPatronate(true)} />
              )}
              {starsiViditelni && ponukaPatronatu === null && (
                <LiniaStarsich
                  starsi={starsiVLinii}
                  data={data}
                  ikony={sada.ikonyBodovania ?? []}
                  ja={ja}
                  pohlad={pohladLinie}
                  mena={[menoHraca(0), menoHraca(1)]}
                  vydeseni={vydeseni}
                  prahVydesenia={prahVyd}
                  spolu={body.spolu}
                  krok={krokMoj && krokStarsich !== null ? krokStarsich.nazov : null}
                  hraniceZon={false}
                  zmenene={zmeneniStarsi}
                  tlacidlo={tlacidloLinieStarsich}

                  lupa={(s) => lupyStarsich.get(s.elder.elderId) ?? {}}
                  prebytok={
                    krokMoj && bs !== null && bs.krok === "prebytok"
                      ? { zostava: bs.prebytokZostava, cena: 1 }
                      : undefined
                  }
                />
              )}
            </div>
            {nastenkaNaStole && (
              <div className="vrstva-nastenky" data-vyucba="nastenka">
                {volbaNaStole ? (
                  <span className="nastenka-pokyn">
                    <strong>Cieľ kola</strong>
                    {/* Pokyn na ťah je v pilulke nad stolom — tu len to, čo v nej nie je. */}
                    {!volimLokalitu && `${menoHraca(super_)} vyberá, o čo sa bude v tomto kole bojovať.`}
                    {view.spakyNaSekere > 0 && <small>Na sekere {spakov(view.spakyNaSekere)} — vezme ich víťaz tejto bitky.</small>}
                  </span>
                ) : (
                  <button type="button" className="ls-tlacidlo nastenka-spat" onClick={() => setVrstva(null)}>
                    ← Späť na stôl <kbd>Esc</kbd>
                  </button>
                )}
                {volbaNaStole
                  ? nastenkaEl(false, sirkaVolby, true, vyberNaNastenke, false)
                  : nastenkaEl(sirkaNastenky >= NASTENKA_KARTA_MIN, sirkaNastenky, true, undefined, false)}
              </div>
            )}
            {nahliadnutie && krokStarsich !== null && (
              <button type="button" className="ls-tlacidlo stol-navrat" onClick={() => setNahliadnutie(false)}>
                ← späť na starších · {krokStarsich.nazov} <kbd>Esc</kbd>
              </button>
            )}
            </div>
            {hranaStola}
          </div>

          <HracDoska
            data={data}
            view={view}
            p={ja}
            info={hraci[ja]}
            prahy={prahy(ja)}
            zavislost={zavislost(ja)}
            menoKarty={menoKarty}
            popisKarty={popisKarty}
            vyhlad={vyhladPitky(ja)}
            cenaDlhu={cenyKliatob[ja].dlh}
            obchodCigariet={{
              mozno: somNaTahu && view.faza === "pitka" && view.pitkaStav?.reakcia === null && view.koniec === null,
              doliat: () => cmd({ type: "refillPoldeci" }),
              novy: () => cmd({ type: "barter" }),
              cenaBarteru: barterCena(data, view, ja),
            }}
            body={body}
            mena={[menoHraca(0), menoHraca(1)]}
            starsi={{
              stlacene: starsiViditelni && krokStarsich === null && pohladLinie === ja,
              prepni: () => prepniStarsich(ja),
              id: idLinieStarsich,
              posuny: new Set((view.posunyMarkerov ?? []).map((x) => x.elderId)).size,
            }}
            spakyKlik={{ stlacene: vrstva === "lokality" && nastenkaPre === ja, prepni: () => otvorNastenku(ja) }}
            karty={kartyDlazdica(ja)}
            rezim={rezimBaru}
            pocitadloBezi={pocitadloBezi}
          />


        </div>

      </div>

      {vrstva === "senok" && (
        <VrstvaPanel
          nazov={`Šenok · ${view.senok.length}`}
          pozn={
            zoSenkuLimit > 0
              ? `klikni na ${zoSenkuLimit === 1 ? "kartu" : `0–${zoSenkuLimit} kariet`} — vybrané idú do ruky`
              : `spoločný balíček ${view.spolocnyBalicekPocet}`
          }
          skryta={tahanie !== null}
          onZavri={() => setVrstva(null)}
          paticka={
            zoSenkuLimit > 0 ? (
              <>
                <span className="vrstva-paticka-text">
                  {zoSenku[0] !== undefined ? (
                    <>
                      Berieš <strong>{menoKarty(zoSenku[0].defId)}</strong>.
                    </>
                  ) : (
                    "Vyber jednu kartu."
                  )}
                </span>
                <button className="tlacidlo-hlavne" data-vyucba="potvrdit" onClick={() => setVrstva(null)} disabled={zoSenku.length === 0}>
                  vziať
                </button>
              </>
            ) : undefined
          }
        >
          <div className="vrstva-karty harmonika">
            {view.senok.length === 0 && tieneSenku.length === 0 && <span className="popis">Šenok je prázdny.</span>}
            {radSenkuSTienmi(view.senok, (k) => {
              const z: Zdroj = { karta: k, odkial: "senok", navrh: false };
              const vybrana = zoSenku.some((x) => x.uid === k.uid);
              const props = {
                karta: k,
                sirka: SIRKA_VO_VRSTVE,
                vybrana,
                onClick:
                  view.volbaNastupu?.typ === "senok" && view.volbaNastupu.hrac === ja
                    ? () => posli({ type: "senok", uid: k.uid })
                    : zoSenkuLimit > 0
                      ? () => prepniZoSenku(k.uid)
                      : undefined,
              };
              return sLupou(props, {
                obsah: vybrana ? karta(props) : tahatelna(z, karta(props)),
                zdroj: z,
                odstran: vybrana ? () => prepniZoSenku(k.uid) : undefined,
              });
            }, SIRKA_VO_VRSTVE)}
          </div>
        </VrstvaPanel>
      )}

      {vrstva === "vestica" && view.volbaVestica !== null && (
        <VrstvaPanel
          nazov="Veštica — doberacie balíčky"
          pozn="vyber po jednej karte z oboch — vymenia sa a balíčky sa zamiešajú"
          skryta={tahanie !== null}
          onZavri={() => setVrstva(null)}
        >
          {(["moj", "jeho"] as const).map((kto) => (
            <div key={kto}>
              <span className="oblast-nazov">{kto === "moj" ? "tvoj balíček" : `balíček – ${menoHraca(super_)}`}</span>
              <div className="vrstva-karty harmonika">
                {(view.volbaVestica?.[kto] ?? []).map((k, i) => {
                  const v = mode.typ === "vestica" ? mode : null;
                  const vybrana = v !== null && (kto === "moj" ? v.moja === i : v.jeho === i);
                  const zrusVolbu = (): void => {
                    if (v !== null) setMode(kto === "moj" ? { ...v, moja: null } : { ...v, jeho: null });
                  };
                  return sLupou(
                    {
                      karta: k,
                      sirka: SIRKA_VO_VRSTVE,
                      vybrana,
                      onClick: () =>
                        v !== null && setMode(kto === "moj" ? { ...v, moja: vybrana ? null : i } : { ...v, jeho: vybrana ? null : i }),
                    },
                    { odstran: vybrana ? zrusVolbu : undefined },
                  );
                })}
              </div>
            </div>
          ))}
        </VrstvaPanel>
      )}

      {vrstva === "karty" &&
        (() => {
          const h = view.hraci[kartyHrac];
          const moje = kartyHrac === ja;
          const zalozky: readonly (readonly [ZalozkaKariet, string])[] = [
            ...(moje
              ? ([
                  ["balicek", `Balíček ${h.doberaciPocet}`],
                  ["odhodene", `Odhodené ${h.odhadzovaci.length}`],
                ] as const)
              : []),
            ["priznane", `Priznané ${h.priznane.length}`],
            ["dedicstvo", `Dedičstvo ${h.dedicstvo.length}`],
          ];
          const zal: ZalozkaKariet = moje || kartyZalozka === "priznane" || kartyZalozka === "dedicstvo" ? kartyZalozka : "priznane";
          const k = view.nepriznaneKliatby[kartyHrac];
          const nepriznane = [k.cirhoza > 0 ? `Cirhóza ×${k.cirhoza}` : "", k.dlh > 0 ? `Dlh ×${k.dlh}` : ""].filter((x) => x !== "").join(" · ");
          const POZN: Record<ZalozkaKariet, string> = {
            balicek: "tvoje karty zoskupené podľa typu a mena — poradie v balíčku je tajné",
            odhodene: "tvoj odhadzovací balíček — keď sa minie doberací, zamieša sa doň",
            priznane: `priznané kliatby — natrvalo mimo balíčka${nepriznane === "" ? "" : ` · nepriznané: ${nepriznane}`}`,
            dedicstvo: moje ? `Nástroje s pasívnym efektom · ďalší stojí ${cigariet(view.cenaDedicstva)} (cena rastie pre oboch)` : "Nástroje s pasívnym efektom",
          };
          const karty = (ks: readonly CardInstance[]): ReactNode => (
            <div className="vrstva-karty harmonika">
              {ks.length === 0 && <span className="popis">Zatiaľ nič.</span>}
              {ks.map((x) => sLupou({ karta: x, sirka: SIRKA_VO_VRSTVE }))}
            </div>
          );
          return (
            <VrstvaPanel nazov={moje ? "Tvoje karty" : `Karty — ${menoHraca(kartyHrac)}`} pozn={POZN[zal]} skryta={tahanie !== null} onZavri={() => setVrstva(null)}>
              <div className="karty-zalozky" role="tablist" aria-label="Karty hráča">
                {zalozky.map(([id, text]) => (
                  <button key={id} type="button" role="tab" aria-selected={zal === id} className={zal === id ? "aktivna" : undefined} onClick={() => setKartyZalozka(id)}>
                    {text}
                  </button>
                ))}
              </div>
              {zal === "balicek" && (
                <>
                  {hJa.doberaciPocet === 0 && <span className="popis">Balíček je prázdny — pri ďalšom ťahaní sa doň zamiešajú odhodené karty.</span>}
                  {skupinyBalicka(data, view.mojBalicekZlozenie).map((s) => (
                    <section key={s.nazov} className="balicek-skupina">
                      <h3>
                        {s.nazov} <b>{s.pocet}</b>
                      </h3>
                      <div className="vrstva-karty">
                        {s.karty.map((k) =>
                          sLupou(
                            { karta: k.karta, sirka: SIRKA_VO_VRSTVE },
                            k.pocet > 1 ? { stitok: <span className="balicek-kusov">×{k.pocet}</span> } : {},
                          ),
                        )}
                      </div>
                    </section>
                  ))}
                </>
              )}
              {zal === "odhodene" && karty(h.odhadzovaci)}
              {zal === "priznane" && karty(h.priznane)}
              {zal === "dedicstvo" && karty(h.dedicstvo)}
            </VrstvaPanel>
          );
        })()}

      {vrstva === "log" && (
        <VrstvaPanel nazov="Log" skryta={tahanie !== null} onZavri={() => setVrstva(null)}>
          <div className="log">
            {log.length === 0 && <span className="popis">Zatiaľ žiadne záznamy — log sa zbiera od pripojenia.</span>}
            {log.map((riadok, i) => (
              <div key={i} className={riadok.startsWith("⚠") ? "manual" : riadok.startsWith("♥") ? "log-priazen" : ""}>
                {riadok}
              </div>
            ))}
          </div>
        </VrstvaPanel>
      )}

      {/* Ruka je pripnutá k spodku okna a vždy v jednom rade — pri veľa
          kartách sa prekrývajú (viď .ruka v hra.css), nikdy nezalomia.
          Pokyn a tlačidlá ťahu sú na stole (pilulka a hrana stola). */}
      <div
        className={zonaTriedy("ruka", vybraneMiesto !== undefined ? "ruka volba-miesta" : "ruka")}
        data-ciel={jeCiel("ruka") ? "ruka" : undefined}
        style={{ "--lupa-ruky": mierkaLupy } as CSSProperties}
      >
        {/* Karty v ruke vidno hneď vedľa — dôležitejšie je, koľko ostáva v balíčku (dizajn U10). */}
        <button
          className={`ruka-nadpis odhodene-nadpis balicek-nadpis ${vrstva === "karty" && kartyHrac === ja && kartyZalozka === "balicek" ? "otvorena" : ""}`}
          title="Tvoj doberací balíček — karty podľa typu a mena"
          aria-expanded={vrstva === "karty" && kartyHrac === ja && kartyZalozka === "balicek"}
          onClick={() => otvorKarty(ja, "balicek")}
        >
          balíček<b>{hJa.doberaciPocet}</b>
        </button>
        {/* Zrkadlo k „balíček“: odhadzovací balíček je verejný, klik ho ukáže. */}
        <button
          className={`ruka-nadpis odhodene-nadpis ${vrstva === "karty" && kartyHrac === ja && kartyZalozka === "odhodene" ? "otvorena" : ""}`}
          title="Tvoj odhadzovací balíček"
          onClick={() => otvorKarty(ja, "odhodene")}
        >
          odhodené<b>{hJa.odhadzovaci.length}</b>
        </button>
        <div className="ruka-rad harmonika-hover" data-vyucba="ruka">
          {ruka
            .filter((k) => !vylozenia.some((x) => x.karta.uid === k.uid))
            .map((k) => {
              // Vybrané miesto na stole: karta, ktorá tam smie, sa tam klikom položí.
              const naMiesto = vybraneMiesto?.karty.get(k.uid);
              const onClick =
                naMiesto !== undefined
                    ? () => polozNaMiesto(k)
                    : vybraneMiesto === undefined && (typOblasti(k).priznanie || typOblasti(k).dedicstvo)
                      ? () => vyberDoOblasti(k)
                      : undefined;
              const nova = noveVRuke.includes(k.uid);
              const dobrata = !nova && dobrate.includes(k.uid);
              const pary = naMiesto?.pary ?? [];
              const strana = naMiesto?.vnutornaVytlacena;
              const spoj =
                strana === undefined || pary.length === 0
                  ? undefined
                  : { left: strana === "left" ? pary.map((x) => x.index) : [], right: strana === "right" ? pary.map((x) => x.index) : [] };
              const obsah = (
                <>
                  {karta({ karta: k, sirka: sirkaVRuke, vybrana: vybranaDoOblasti === k.uid, onClick, hranaVnutorna: strana, spoj })}
                  {/* Nízke okno: pás s názvom je pod okrajom okna — meno ukáže štítok nad ním (hra.css). */}
                  <span className="ruka-meno" aria-hidden="true">
                    {menoKarty(k.defId)}
                  </span>
                  {nova &&<span className="nova-stitok">zo šenku</span>}
                  {dobrata && <span className="nova-stitok">dobraná</span>}
                  {jeKartaPatronatu(k.uid) && <span className="nova-stitok">starší · patronát</span>}
                  {pary.length > 0 && <span className="spoj-stitok">{pary.length === 1 ? "1 spoj" : `${pary.length} spoje`}</span>}
                </>
              );
              const triedy = [nova || dobrata ? "nova-zo-senku" : ""];
              if (vybraneMiesto !== undefined) triedy.push(naMiesto === undefined ? "nemoze" : pary.length > 0 ? "vysunuta" : "bez-spoja");
              // Bez myši: Enter / ťuknutie urobí to isté čo klik, inak kartu zväčší (lupa) — na dotyku sa ruka inak prečítať nedá.
              const klucLupy = `r${k.uid}`;
              const zdrojRuky: Zdroj = { karta: k, odkial: "ruka", navrh: false };
              lupaKarty.set(klucLupy, { render: (s) => karta({ karta: k, sirka: s }), zdroj: zdrojRuky });
              const aktivuj = (el: HTMLElement): void => {
                if (onClick !== undefined) onClick();
                else otvorLupu(klucLupy, el.querySelector(".kl"));
              };
              return tahatelna(
                zdrojRuky,
                obsah,
                k.uid,
                PORADIE + k.uid,
                triedy.join(" ").trim() || undefined,
                vybraneMiesto !== undefined
                    ? () => setMiestoVolby(null)
                    : undefined,
                { aktivuj, popis: `${menoKarty(k.defId)}${naMiesto !== undefined ? " — položiť na vybrané miesto" : ""}`, tukni: jeDotyk && onClick === undefined },
              );
            })}
          {jeCiel(PORADIE + "koniec") && (
            <div className={`poradie-koniec ${nadCielom(PORADIE + "koniec") ? "nad-cielom" : ""}`} data-ciel={PORADIE + "koniec"}>
              na koniec
            </div>
          )}
          {zoSenku.map((k) =>
            tahatelna(
              { karta: k, odkial: "senok", navrh: true },
              karta({ karta: k, sirka: sirkaVRuke }),
              k.uid,
              NAHRADIT + k.uid,
              undefined,
              // Pravý klik vráti kartu do šenku.
              () => prepniZoSenku(k.uid),
            ),
          )}
        </div>
      </div>

      {vrstvaVyhodnotenia?.druh === "pitka" && (
        <RekapitulaciaPitkyVrstva
          key={`pitka-${view.kolo}-${vrstvaVyhodnotenia.r.pitka}`}
          r={vrstvaVyhodnotenia.r}
          ja={ja}
          mena={[menoHraca(0), menoHraca(1)]}
          nadpis={vrstvaVyhodnotenia.nadpis}
          menoKarty={menoKarty}
          piktogramy={piktogramyRekapitulacie}
          onKoniec={koniecPocitadla}
        />
      )}
      {medziViditelna && medziTeraz !== null && <Medziobrazovka obsah={medziTeraz} onRozumiem={() => setPotvrdenaMedzi(medziTeraz.kluc)} />}
      {pocitadlo !== null && !medziCaka && (
        <PocitadloSLiniou
          key={`bitka-${pocitadlo.stol.kolo}`}
          vrstva={pocitadlo}
          ja={ja}
          mena={[menoHraca(0), menoHraca(1)]}
          karta={karta}
          menoKarty={menoKarty}
          piktogramy={piktogramyRekapitulacie}
          onKoniec={koniecPocitadla}
          vysledokHned={vyucba === true}
        />
      )}

      {/* Až tu — lupaKarty sa naplnia pri kreslení stola a vrstiev vyššie. */}
      {(() => {
        // Doznievajúca lupa pod novou — len obraz, myš ani klik neberie.
        const lk = doznieva === null || doznieva.kluc === lupa?.kluc ? undefined : lupaKarty.get(doznieva.kluc);
        if (doznieva === null || lk === undefined) return null;
        return (
          <Lupa key={`doznieva-${doznieva.kluc}`} rect={doznieva.rect} mierka={lk.mierka ?? mierkaLupy} onZavri={() => setDoznieva(null)} doznieva nad={lk.nad === true}>
            {lk.render(doznieva.rect.width * Math.min(lk.mierka ?? mierkaLupy, maxMierkaLupy(doznieva.rect)))}
          </Lupa>
        );
      })()}
      {(() => {
        const lk = lupa === null || tahanie !== null ? undefined : lupaKarty.get(lupa.kluc);
        if (lupa === null || lk === undefined) return null;
        const z = lk.zdroj;
        const chytit = z !== undefined && cieleZdroja(z).size > 0;
        return (
          <Lupa
            // Nový kľúč = nová lupa s nástupom; stará pod ňou dozneje.
            key={lupa.kluc}
            rect={lupa.rect}
            prechod={lupa.prechod === true}
            nad={lk.nad === true}
            mierka={lk.mierka ?? mierkaLupy}
            onZavri={zavriLupu}
            onPointerDown={chytit ? (e) => zacni(z, e, lupa.rect.width) : undefined}
            onOdstran={lk.odstran}
          >
            {lk.render(lupa.rect.width * Math.min(lk.mierka ?? mierkaLupy, maxMierkaLupy(lupa.rect)))}
          </Lupa>
        );
      })()}

      {tahanie !== null && (
        <div
          className="tahanie-duch"
          ref={duchRef}
          style={{ transform: `translate(${tahanie.x}px, ${tahanie.y}px)`, width: tahanie.sirka }}
        >
          {karta({
            karta: tahanie.zdroj.karta,
            sirka: tahanie.sirka,
            otocena: tahanie.zdroj.odkial === "lokality" && tahanie.zdroj.navrh && lokalitaNavrhOtocena,
            bezPopisov: true,
          })}
        </div>
      )}

      {chybaTahania !== null && (
        // Poloha sa dopočíta pred vykreslením (useLayoutEffect) podľa rozmeru hlášky.
        <div className="chyba-tahania" role="alert" ref={chybaTahaniaRef}>
          <span>⚠ {chybaTahania.text}</span>
          <button type="button" className="tlacidlo-male" onClick={() => setChybaTahania(null)}>
            OK
          </button>
        </div>
      )}
    </div>
  );
}

/** Zmena Frajeriny po partii: „Frajerina 1200 → 1216 (+16)“. */
function ZmenaFrajeriny({ pred, po }: { readonly pred: number; readonly po: number }) {
  const rozdiel = po - pred;
  return (
    <span className={`zmena-frajeriny ${rozdiel > 0 ? "plus" : rozdiel < 0 ? "minus" : ""}`}>
      {" "}Frajerina {pred} → <strong>{po}</strong> ({rozdiel > 0 ? "+" : rozdiel < 0 ? "−" : "±"}
      {Math.abs(rozdiel)}).
    </span>
  );
}

type PecatNakupu = (p: {
  readonly kluc: string;
  readonly ikona: ReactNode;
  readonly nazov: string;
  readonly cena: number;
  readonly dovod: string | null;
  readonly tip: string;
  readonly akcia: () => void;
}) => ReactNode;

/**
 * Kšefty a Úplatky v Pitke (v7). Ponúka presne to, čo jadro dovolí — rovnaký
 * zoznam ako legalCommands, vyrátaný z pohľadu hráča. Zberný dvor má vlastnú
 * pečiatku (výber karty z odhadzovacieho balíčka).
 */
function KseftyPitky({ data, view, cmd, pecatNakupu }: { readonly data: GameData; readonly view: ClientState; readonly cmd: (c: Command) => void; readonly pecatNakupu: PecatNakupu }) {
  const [smetiarka, setSmetiarka] = useState<number | null>(null);
  const [vila, setVila] = useState<string>("");
  const ja = view.ja;
  const su: PlayerId = ja === 0 ? 1 : 0;
  const pitka = view.pitkaStav;
  if (pitka === null || pitka.reakcia !== null || pitka.hotovy[ja]) return null;
  const h = view.hraci[ja];
  const meno = (defId: string): string => data.cards.get(defId)?.name ?? defId;
  const pouzite = pitka.kseft?.[ja] ?? [];
  const skryte = (pitka.skryteNaex ?? []).filter((x) => x.hrac === ja).length;
  const karty = [...view.strany[0], ...view.strany[1]].filter((pl) => pl.playedBy === ja && pl.zaverecna !== true && !pouzite.includes(pl.card.uid));
  const out: ReactNode[] = [];
  for (const pl of karty) {
    const uid = pl.card.uid;
    if (pl.card.defId === "stryko_z_ameriky")
      out.push(pecatNakupu({ kluc: `kseft${uid}`, ikona: null, nazov: "Strýko", cena: KONSTANTY.EFEKT.STRYKO_CENA, dovod: h.cigarety < KONSTANTY.EFEKT.STRYKO_CENA ? "Strýko chce 2 cigarety." : null, tip: "Kšeft: za 2 cigarety udelíš v bitke tohto kola 1 Ranu navyše.", akcia: () => cmd({ type: "kseft", uid }) }));
    if (pl.card.defId === "oslavenec")
      out.push(
        pecatNakupu({
          kluc: `kseft${uid}`,
          ikona: null,
          nazov: "Oslávenec",
          cena: 0,
          dovod: h.poldeciPlne - skryte <= 0 ? "Oslávenec chce plný poldeci." : view.ciel?.lokalita?.defId === "kostol" ? "Kostol: nikto nesmie vypiť." : null,
          tip: "Kšeft: za tvoj plný poldeci súper dostane 2 poškodenia pečene.",
          akcia: () => cmd({ type: "kseft", uid }),
        }),
      );
    if (pl.card.defId === "smetiarka") {
      const moznosti = view.ruka.filter((k) => k.defId !== "dlh" && k.defId !== "cirhoza" && k.defId !== "abstak");
      out.push(
        <span key={`kseft${uid}`} className="pecat pecat-nakup">
          <select value={smetiarka ?? ""} onChange={(e) => setSmetiarka(e.target.value === "" ? null : Number(e.target.value))}>
            <option value="">Smetiarka: karta z ruky…</option>
            {moznosti.map((k) => (
              <option key={k.uid} value={k.uid}>
                {meno(k.defId)}
              </option>
            ))}
          </select>
          <button type="button" disabled={smetiarka === null} onClick={() => smetiarka !== null && cmd({ type: "kseft", uid, kartaUid: smetiarka })}>
            odhodiť za cigaretu
          </button>
        </span>,
      );
    }
  }
  // Starší s Kšeftom (v7) — v línii aj prebudení; uid je karta staršieho.
  for (const defId of ["postarka", "vychovavatelka"] as const) {
    if (!efektHraca(view, ja, defId) || efektPotlaceny(data, view, ja, defId)) continue;
    const uid = [...view.strany[0], ...view.strany[1]].find((pl) => pl.playedBy === ja && pl.card.defId === defId && pl.zaverecna !== true)?.card.uid ?? view.starsi.find((e) => e.karta.defId === defId)?.karta.uid;
    if (uid === undefined || pouzite.includes(uid)) continue;
    if (defId === "postarka") {
      const prazdny = !jeCoTahat(h.doberaciPocet, h.odhadzovaci.length);
      out.push(pecatNakupu({ kluc: `kseft${uid}`, ikona: null, nazov: "Poštárka", cena: 0, dovod: prazdny ? "Nemáš z čoho ťahať." : null, tip: "Kšeft: za 1 Dlh (hneď priznaný) si doberieš 1 kartu.", akcia: () => cmd({ type: "kseft", uid }) }));
    } else {
      const c = KONSTANTY.EFEKT.VYCHOVAVATELKA_CENA;
      out.push(pecatNakupu({ kluc: `kseft${uid}`, ikona: null, nazov: "Vychovávateľka", cena: c, dovod: h.cigarety < c ? `Vychovávateľka chce ${cigariet(c)}.` : null, tip: "Kšeft: za 2 cigarety máš v bitke tohto kola 1 Poveru navyše.", akcia: () => cmd({ type: "kseft", uid }) }));
    }
  }
  // Úplatok (v7): cigareta na súperovho Kulturistu, raz za Pitku na kartu.
  for (const pl of [...view.strany[0], ...view.strany[1]]) {
    if (pl.playedBy !== su || pl.card.defId !== "kulturista" || pl.zaverecna === true || (pitka.uplatok ?? []).includes(pl.card.uid)) continue;
    const uid = pl.card.uid;
    out.push(pecatNakupu({ kluc: `uplatok${uid}`, ikona: null, nazov: "Úplatok", cena: 1, dovod: h.cigarety < 1 ? "Úplatok stojí cigaretu." : null, tip: `Úplatok: cigareta na súperovho Kulturistu — jeho útoky budú do konca kola o stupeň slabšie (teraz ${pl.uplatky ?? 0}).`, akcia: () => cmd({ type: "uplatok", uid }) }));
  }
  const lok = view.ciel?.lokalita ?? null;
  if (lok !== null && !pouzite.includes(lok.uid)) {
    const uid = lok.uid;
    if (lok.defId === "sklad") {
      const prazdny = view.hraci[su].odhadzovaci.length === 0;
      out.push(pecatNakupu({ kluc: "kseftSklad", ikona: null, nazov: "Sklad", cena: 1, dovod: prazdny ? "Súperov odhadzovací balíček je prázdny." : h.cigarety < 1 ? "Sklad chce cigaretu." : null, tip: "Kšeft: za cigaretu vrchná karta súperovho odhadzovacieho balíčka do tvojej ruky.", akcia: () => cmd({ type: "kseft", uid }) }));
    }
    if (lok.defId === "obecny_urad") {
      const c = KONSTANTY.EFEKT.URAD_CENA;
      const dlh = h.priznane.some((k) => k.defId === "dlh");
      out.push(pecatNakupu({ kluc: "kseftUrad", ikona: null, nazov: "Obecný úrad", cena: c, dovod: !dlh ? "Nemáš priznaný Dlh." : h.cigarety < c ? `Úrad chce ${cigariet(c)}.` : null, tip: "Kšeft: za 3 cigarety presunieš 1 svoj priznaný Dlh medzi súperove priznané.", akcia: () => cmd({ type: "kseft", uid }) }));
    }
    if (lok.defId === "predsedova_vila" && h.cigarety >= 2) {
      const chraneny = view.patronat[su]?.elderId;
      out.push(
        <span key="kseftVila" className="pecat pecat-nakup">
          <select value={vila} onChange={(e) => setVila(e.target.value)}>
            <option value="">Vila (2 cig.): marker…</option>
            {view.starsi
              .filter((e) => e.elderId !== chraneny)
              .flatMap((e) => [
                <option key={`${e.elderId}-s`} value={`${e.elderId}|0`}>{`${meno(e.karta.defId)} k súperovi`}</option>,
                <option key={`${e.elderId}-j`} value={`${e.elderId}|1`}>{`${meno(e.karta.defId)} k sebe`}</option>,
              ])}
          </select>
          <button
            type="button"
            disabled={vila === ""}
            onClick={() => {
              const [elderId, kSebe] = vila.split("|");
              if (elderId !== undefined) cmd({ type: "kseft", uid, elderId, kSebe: kSebe === "1" });
            }}
          >
            posunúť
          </button>
        </span>,
      );
    }
  }
  return <>{out}</>;
}

/** Klebetnica a Dohadzovačka (v7): voľba Nástupu. Súperovu ruku pohľad pošle len tomu, kto vyberá. */
function VolbaNastupu({ view, posli }: { readonly view: ClientState; readonly posli: (c: Command) => void }) {
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const nv = view.volbaNastupu;
  if (nv === null) return null;
  if (nv.typ === "klebetnica") {
    return (
      <span>
        Klebetnica: súperovu kartu pošli naspodok jeho doberacieho balíčka.{" "}
        {(nv.ruka ?? []).map((k) => (
          <button key={k.uid} type="button" onClick={() => posli({ type: "klebetnica", uid: k.uid })}>
            {k.defId}
          </button>
        ))}
      </span>
    );
  }
  return (
    <span>
      Dohadzovačka: vymeň dvom starším priazne (scorecardy), markery ostanú.{" "}
      {[
        [a, setA],
        [b, setB],
      ].map(([hodnota, nastav], i) => (
        <select key={i} value={hodnota as string} onChange={(e) => (nastav as (x: string) => void)(e.target.value)}>
          <option value="">starší…</option>
          {view.starsi.map((e) => (
            <option key={e.elderId} value={e.elderId}>
              {e.karta.defId}
            </option>
          ))}
        </select>
      ))}
      <button type="button" disabled={a === "" || b === "" || a === b} onClick={() => posli({ type: "dohadzovacka", elderA: a, elderB: b })}>
        vymeniť
      </button>
    </span>
  );
}


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
  CardInstance,
  CielVykladania,
  ClientState,
  Command,
  ElderState,
  Event,
  GameData,
  KartaZdroj,
  LineEval,
  PlacedCard,
  PlayerId,
  PocitadloBitky as Pocitadlo,
  VerejnyStav,
} from "@naex/core";
import {
  KONSTANTY,
  MARKER_STRED,
  STUPNICA_ZONY,
  jeCoTahat,
  kartyZaPas,
  bodyTeraz,
  cenaKliatby,
  battleOutcome,
  cenaPrebytku,
  prebytokNaRozdelenie,
  kliatbyNahladu,
  nahladPitky,
  svokraZaNaex,
  tvar,
  vyhladDlhov,
  cieleVykladania,
  cielLokalitaId,
  evaluateLine,
  pocitadloBitky,
  hrozbaNaex,
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
  pohorsenieBezLimitu,
  pohorsenieMozne,
  prevahaStran,
  krajeStran,
  vykupZoSrotu,
  zakazFajcit,
  zakazNaex,
  nahladPosunuMarkera,
  nahladPosunuPrebytkom,
  pohorsenieNaKraj,
  nahladVylozenia,
  naexCieleVLinii,
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
  hodnotaLokality,
  stavZavislosti,
  stranyLokality,
  vydesil,
} from "@naex/core";
import type { ActionSums, GameState, KliatbyNahladu, MarkerPos, NahladVylozenia, PolozkaVykladania, Podmienka, Rod, Slot, StranaLinie } from "@naex/core";
import { IkonaAkcie } from "../karta/IkonaAkcie.tsx";
import { KoniecHry } from "./KoniecHry.tsx";
import { LiniaStarsich, LupaStarsieho, type StarsiVLinii } from "./LiniaStarsich.tsx";
import { PocitadloBitky } from "./PocitadloBitky.tsx";
import { mediaUrl } from "../lib/api.ts";
import { useStrazOdchodu } from "../lib/odchod.ts";
import { skupinyBalicka } from "./doberaciBalicek.ts";
import { SkratkyNapoveda, escVratiNavrh, tlacidloNavratu, useSkratky, type VrstvyPreEsc } from "./skratky.tsx";
import type { Sada } from "@naex/tvorba";
import { HernaKarta, vzhladKarty, type HernaKartaProps } from "./HernaKarta.tsx";
import { useZarovnanieLinie } from "./zarovnanieLinie.ts";
import { Lupa, maxMierkaLupy } from "./Lupa.tsx";
import { LUPA_PREDVOLENA, useUcet } from "../lib/ucet.tsx";
import { Vrstva as VrstvaPanel } from "./Vrstva.tsx";
import {
  BitkaPanel,
  CenaCigariet,
  HracDoska,
  IkonaCigareta,
  IkonaPoldeci,
  PriebehKola,
  SuhrnBitky,
  type BitkaPanelProps,
  type HrozbaBitky,
  type KartyDlazdica,
  type VyhladPitky,
} from "./Panely.tsx";
import { StavkaBitky } from "./StavkaBitky.tsx";
import { UCINOK_KRATKO, UCINOK_PRIAZNE } from "./Scorecard.tsx";
import type { HracInfo, SuhrnAchievementov, ZmenyFrajeriny } from "./useHra.ts";
import { menoVoVete, rodHraca, textHlasky } from "./useHra.ts";
import { useBezNaexVBitke, useOdlozenyPrikaz } from "./usePohodlie.ts";
import { useTahanie } from "./useTahanie.ts";
import "./hra.css";

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
  // Draft aj Pohreb Závislého: karty zo šenku presunuté do ruky.
  | { readonly typ: "zoSenku"; readonly uids: readonly number[] };

const CIELE_VYKLADANIA: readonly string[] = ["vlastna", "superova", "priznanie", "dedicstvo"] satisfies CielVykladania[];
const jeCielVykladania = (c: string): c is CielVykladania => CIELE_VYKLADANIA.includes(c);

const POPIS_CIELA: Record<CielVykladania, string> = {
  vlastna: "na tvoju stranu",
  superova: "na súperovu stranu (ostane tvoja)",
  priznanie: "priznať",
  dedicstvo: "do Dedičstva (za cigarety)",
};

const NAHRADIT = "nahradit:";
/** Cieľ pri preusporiadaní ruky: karta, pred/za ktorú ťahaná karta pôjde. */
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
 * pečiatka NA EX!, `vpravo` (a všeobecné `tlacidla`) potvrdenie či koniec ťahu.
 */
interface Pokyn {
  readonly nadpis: ReactNode;
  readonly text?: ReactNode;
  readonly tlacidla?: ReactNode;
  readonly vlavo?: ReactNode;
  readonly stred?: ReactNode;
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
/** Výška / šírka karty (54 × 80 mm) — výška línie určuje veľkosť kariet (Stôl bez scrollovania, #67). */
const POMER_KARTY = 80 / 54;
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
    [".doska, .linia-stav, .pas-kola-obal", 3],
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

/** Nominatív — „súper: 2 plné poldeci · 3 karty v ruke“. */
function plnePoldeci(n: number): string {
  return n === 1 ? "1 plný poldeci" : n >= 2 && n <= 4 ? `${n} plné poldeci` : `${n} plných poldeci`;
}

function kartyNom(n: number): string {
  return n === 1 ? "1 karta" : n >= 2 && n <= 4 ? `${n} karty` : `${n} kariet`;
}

function cigariet(n: number): string {
  return n === 1 ? "1 cigaretu" : n >= 2 && n <= 4 ? `${n} cigarety` : `${n} cigariet`;
}

type Mode =
  | { typ: "ziadny" }
  // NA EX na dva kroky (dizajn hra-nezrovnalosti-20261021-1229, UX N3): vyber kartu, potom potvrď.
  | { typ: "naexCiel"; uid: number | null }
  | { typ: "pohrebKarta"; cirhozaUid: number }
  // Pohreb Závislého (pravidlá v4): smie si vziať kartu zo šenku.
  | { typ: "pohrebSenok"; cirhozaUid: number; kartaUid: number }
  // Patronát (Michal 2026-10-20): vybraný starší a karta z ruky lícom dole na jeho scorecard.
  | { typ: "patronat"; elderId: string; uid: number | null }
  // Výbery viacerých kariet: Benzínka (Občania v línii), Veštica.
  | { typ: "vyber"; uids: readonly number[] }
  | { typ: "vestica"; moja: number | null; jeho: number | null }
  | { typ: "starosta"; rukaUid: number | null }
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
  /** Výučba: ťah, ktorý krok čaká — „potvrdiť“ sa odomkne, až keď na stole leží všetko z neho. */
  readonly vyucbaOcakava?: Command | null;
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

/** Účet bitky — výsledok, lokality, posuny markerov a body pred a po. */
interface UcetBitky {
  readonly kolo: number;
  readonly lokalita: string;
  readonly tuhe: readonly [number, number];
  readonly vitaz: PlayerId | null;
  readonly prebytok: number;
  readonly prebytokNaRozdelenie: number;
  readonly prebytokDrzi: PlayerId | null;
  readonly lokality: readonly { readonly meno: string; readonly komu: PlayerId | null; readonly ako: "ovladol" | "sekera" | "prepadla" }[];
  readonly posuny: readonly { readonly meno: string; readonly pred: number; readonly po: number }[];
  readonly body: { readonly pred: readonly [number, number]; readonly po: readonly [number, number] };
}

export function HernaPlocha({
  view,
  data,
  sada,
  hraci,
  log,
  udalosti,
  chyba,
  zrusChybu,
  superPripojeny,
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
}: HernaPlochaProps) {
  DATA = data;
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
  /** Lokalita nakliknutá vo vrstve lokalít — tlačidlo „umiestniť“ ju položí na stôl. */
  const [vyberLokality, setVyberLokality] = useState<number | null>(null);
  /** Kedy sme naposledy automaticky otvorili vrstvu — raz za fázu, nie pri každom prekreslení. */
  const autoVrstva = useRef("");
  // Obrazovka konca hry sa dá zavrieť a pozrieť si stôl.
  const [koniecZavrety, setKoniecZavrety] = useState(false);
  // Vzdanie sa je nevratné — prvé kliknutie len pýta potvrdenie.
  const [potvrdVzdanie, setPotvrdVzdanie] = useState(false);
  useEffect(() => {
    if (!potvrdVzdanie) return;
    const t = setTimeout(() => setPotvrdVzdanie(false), 4000);
    return () => clearTimeout(t);
  }, [potvrdVzdanie]);
  // Koľko riadkov logu hráč už videl — zvyšok svieti ako nové na tlačidle.
  const [videnyLog, setVidenyLog] = useState(() => log.length);
  useEffect(() => {
    if (vrstva === "log") setVidenyLog(log.length);
  }, [vrstva, log.length]);
  // Stavbu šenku hrajú obaja naraz — „môžem hrať“ nie je vždy „som na ťahu“.
  const somNaTahu = view.mozemHrat;
  const draft = view.draftStav;
  const stavim = view.faza === "draft" && draft?.krok === "stavba";
  // Živý odhad záverečného bodovania — hráč musí stále vidieť, za čo dostane body.
  const body = useMemo(() => bodyTeraz(data, view), [data, view]);
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
  useStrazOdchodu(view.koniec === null && prehravanie === undefined, kod);
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
    if (mobil || stolScroll || vyskaPlste === 0 || sirkaPodlaVysky >= SIRKA_CITATELNA) return;
    const t = setTimeout(() => setStolScroll(true), ONESKORENIE_SCROLLU_MS);
    return () => clearTimeout(t);
  }, [mobil, stolScroll, vyskaPlste, sirkaPodlaVysky]);
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
    if (stavbaHotova) posli({ type: "stavbaSenku", doSenku: doSenkuStavby, odhod: odhodStavby });
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
  // Záverečná (roadmapa #83): prepínač na hrane stola — posledná karta ťahu do línie pôjde
  // lícom dole za cigaretu a potom už v tomto Zhromaždení nevykladám.
  const [zaverecnaZapnuta, setZaverecnaZapnuta] = useState(false);
  useEffect(() => setZaverecnaZapnuta(false), [klucTahu]);
  const vylozenia: readonly PolozkaVykladania[] = (() => {
    if (navrh?.typ !== "vylozenia" || !somNaTahu || !(view.faza === "zhromazdenie" || reagujem)) return [];
    const polozky = navrh.polozky.flatMap((x) => {
      const k = view.ruka.find((r) => r.uid === x.uid);
      return k === undefined ? [] : [{ karta: k, ciel: x.ciel }];
    });
    if (!zaverecnaZapnuta || reagujem) return polozky;
    const posledna = polozky.map((x) => x.ciel === "vlastna" || x.ciel === "superova").lastIndexOf(true);
    return polozky.map((x, i) => (i === posledna ? { ...x, zaverecna: true as const } : x));
  })();
  /** Posledná navrhnutá karta (v odpovedi na NA EX jediná). */
  const vylozene: PolozkaVykladania | null = vylozenia[vylozenia.length - 1] ?? null;
  // Celý ťah v Zhromaždení naraz: koľko poldeci stojí a či ho pravidlá pustia —
  // rovnaký výpočet, aký server urobí s príkazom „tah“.
  const zostavaTeraz = view.zhromazdenieStav?.zostavaLimit[ja] ?? 0;
  const planTahu = (polozky: readonly PolozkaVykladania[]) => planVykladania(data, view, ja, zostavaTeraz, polozky);
  const plan = view.faza === "zhromazdenie" ? planTahu(vylozenia) : null;
  // Výučba (playtest 20261023-161148, návrh 1): ťah, ktorému ešte niečo chýba, sa nedá potvrdiť —
  // inak ho server odmietol a hráč nevedel prečo. Rovnaká karta (defId) platí za tú zo scenára.
  const chybaVoVyucbe = ((): string | null => {
    if (vyucbaOcakava === undefined || vyucbaOcakava === null) return null;
    const kroky = (vyucbaOcakava.type === "tah" ? vyucbaOcakava.kroky : [vyucbaOcakava]) as readonly Command[];
    const ocakavane = kroky.flatMap((k) => {
      if (k.type !== "place" && k.type !== "zaverecna") return [];
      const defId = view.ruka.find((r) => r.uid === k.uid)?.defId;
      return defId === undefined ? [] : [{ defId, ciel: k.target, zaverecna: k.type === "zaverecna" }];
    });
    const sedi = (o: (typeof ocakavane)[number], v: PolozkaVykladania): boolean =>
      v.karta.defId === o.defId && v.ciel === o.ciel && o.zaverecna === (v.zaverecna === true);
    const chyba = ocakavane.filter((o) => !vylozenia.some((v) => sedi(o, v)));
    if (chyba.length === 0) return null;
    const navyse = vylozenia.filter((v) => !ocakavane.some((o) => sedi(o, v)));
    return [
      `Ešte chýba: ${chyba.map((o) => menoKarty(o.defId)).join(", ")}.`,
      navyse.length > 0 ? `${navyse.map((v) => menoKarty(v.karta.defId)).join(", ")} sem teraz nepatrí — vráť do ruky (pravý klik).` : "",
    ]
      .filter((x) => x !== "")
      .join(" ");
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
  const zoSenkuLimit = somNaTahu && mode.typ === "pohrebSenok" ? 1 : kolkoMozemBrat;
  // Keď hráč má vyberať karty zo šenku (Pohreb Závislého) či Vešticu, vrstva sa otvorí
  // sama. Raz za fázu — ak ju zavrie, znova sa nevnucuje. Cieľ kola sa vyberá
  // na stole (Michal 2026-10-19), nie vo vrstve.
  const chceVrstvu: Vrstva | null = !somNaTahu || view.koniec !== null
    ? null
    : view.volbaVestica !== null
        ? "vestica"
    : mode.typ === "pohrebSenok"
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

  // Stôl tak, ako by vyzeral po potvrdení návrhu — z neho sa ráta živé
  // zvýraznenie spojov aj odhad bitky.
  const { stol, lineEval, odhad, rozpis, hrozby } = useMemo(() => {
    let strany = view.strany;
    let hraci = view.hraci;
    for (const x of vylozenia) {
      if (x.ciel === "vlastna" || x.ciel === "superova") {
        const kam = x.ciel === "vlastna" ? ja : super_;
        const nova: readonly PlacedCard[] = [...strany[kam], { card: x.karta, playedBy: ja }];
        strany = kam === 0 ? [nova, strany[1]] : [strany[0], nova];
      } else {
        const h = hraci[ja];
        const novy = x.ciel === "priznanie" ? { ...h, priznane: [...h.priznane, x.karta] } : { ...h, dedicstvo: [...h.dedicstvo, x.karta] };
        hraci = ja === 0 ? [novy, hraci[1]] : [hraci[0], novy];
      }
    }
    const ciel = lokalitaNavrh !== null ? { typ: "lokalita" as const, lokalita: lokalitaNavrh.karta } : view.ciel;
    const stol: VerejnyStav = { ciel, ovladnute: view.ovladnute, strany, starsi: view.starsi, hraci };
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
    return { stol, lineEval, odhad, rozpis, hrozby };
    // vylozene a lokalitaNavrh sú odvodené len z navrh a view.
  }, [data, view, navrh, somNaTahu]);

  // NA EX na Občana alebo Starešinu v línii — vlastného aj súperovho (Michal 2026-10-18).
  // Súperova Záverečná lícom dole: NA EX na ňu smie vždy (cez náhradné uid, roadmapa #83).
  const naexCiele = useMemo(
    () => new Set([...naexCieleVLinii(data, lineState(view), ja), ...view.zaverecne.filter((z) => z.majitel !== ja && z.naexBy === null).map((z) => z.uid)]),
    [data, view.strany, view.zaverecne, ja],
  );

  // Kedy NA EX dať môžem — karty, ktoré ho prijmú, nesú v línii značku.
  const pitka = view.pitkaStav;
  const naexMozny =
    somNaTahu &&
    view.faza === "pitka" &&
    pitka !== null &&
    pitka.reakcia === null &&
    !pitka.naexPouzity[ja] &&
    view.hraci[ja].poldeciPlne > 0;
  // Kartu so značkou smieš rovno kliknúť — bez Kostola, ktorý NA EX zakazuje.
  const naexPriamo = naexMozny && !zakazNaex(view);
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
  const vypijemVTahu = plan?.poldeci ?? 0;
  // Stávka bitky (návrh 3 A): v pásme kola a pri potvrdení pasu.
  const stavka = useMemo(
    () => (view.faza === "zhromazdenie" || view.faza === "pitka" ? stavkaBitky(data, view) : null),
    [data, view],
  );
  const nahladyPitky = useMemo(() => {
    if (view.koniec !== null || (view.faza !== "zhromazdenie" && view.faza !== "pitka") || stol.ciel === null) return null;
    const h = view.hraci;
    const hraci: ClientState["hraci"] =
      ja === 0 ? [{ ...h[0], pecen: h[0].pecen + vypijemVTahu }, h[1]] : [h[0], { ...h[1], pecen: h[1].pecen + vypijemVTahu }];
    return nahladPitky(data, { ciel: stol.ciel, ovladnute: view.ovladnute, strany: stol.strany, starsi: view.starsi, hraci, lokalitaOtocena: otocenaTeraz, vizia: view.vizia });
  }, [data, view, stol, ja, vypijemVTahu, otocenaTeraz]);
  /** Body jednej Cirhózy a jedného Dlhu na konci hry pri dnešných scorecardoch (záporné). */
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
    const h = view.hraci;
    const hraci: ClientState["hraci"] =
      ja === 0 ? [{ ...h[0], pecen: h[0].pecen + vypijemVTahu }, h[1]] : [h[0], { ...h[1], pecen: h[1].pecen + vypijemVTahu }];
    const v = vyhladDlhov(data, { ciel: stol.ciel, ovladnute: view.ovladnute, strany: stol.strany, starsi: view.starsi, hraci, lokalitaOtocena: otocenaTeraz, vizia: view.vizia }, dalsiePitky);
    return ([0, 1] as const).map((p) => {
      const teraz = view.hraci[p].priznane.filter((k) => k.defId === "dlh").length;
      return { pali: v[p].kapacita, ostane: v[p].poBitke - Math.max(0, teraz - v[p].kapacita) };
    }) as [VyhladPitky["dlhyBitka"], VyhladPitky["dlhyBitka"]];
  }, [nahladyPitky, stol, view, ja, vypijemVTahu, data, otocenaTeraz, dalsiePitky]);
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
    if (pl.card.defId === "liberal") return "Liberál: na neho NA EX dať nemožno.";
    if (def !== undefined && !def.tags.includes("Občan") && !def.tags.includes("Starešina"))
      return `NA EX len na Občana alebo Starešinu${def.tags.includes("Nástroj") ? " — toto je Nástroj" : ""}.`;
    return "Anonymný alkoholik: na neho NA EX dať nemôžeš.";
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
  // Možnosť NA EX pod myšou či fokusom — tá istá karta svieti na stole.
  const [zvyraznenaNaex, setZvyraznenaNaex] = useState<number | null>(null);
  // Karta z riadku hrozby (prejdenie myšou) — v línii sa zvýrazní.
  const [ukazHrozbu, setUkazHrozbu] = useState<number | null>(null);

  // Náhľad NA EX s celou cenou (dizajn hra-nezrovnalosti-20261021-1229, UI N4 + UX N3):
  // bitka pred a po, zmeny OBOCH hráčov, vzorec násobkov na karte, kliatby
  // z tejto aj ďalších Pitiek kola a ich cena v bodoch. Dlh ráta po najbližšej
  // bitke (Robota, Dievčina na vydaj — kliatbyNahladu, návrh #1 B).
  const nahladNaex = useMemo(() => {
    const out = new Map<
      number,
      {
        readonly tuhe: readonly [number, number];
        readonly zmeny: readonly [string[], string[]];
        readonly vzorec: readonly string[];
        readonly kliatby: readonly [KliatbyNahladu, KliatbyNahladu];
        /** Koľko cigariet mi za toto NA EX ukradnú súperove Svokry. */
        readonly svokra: number;
        readonly majitel: PlayerId;
        readonly strana: PlayerId;
        readonly pozicia: number;
      }
    >();
    if (mode.typ !== "naexCiel" || odhad === null || nahladyPitky === null) return out;
    const mojeAbstaky = view.ruka.filter((k) => k.defId === "abstak").length;
    const nazov = (k: string): string => sada.akcie.find((a) => a.kluc === k)?.nazov ?? k;
    const dovod = (d: string): string =>
      d === "NA EX" ? "×2 NA EX" : d === "Posilnenie" ? "×2 Posilnenie" : d.startsWith("karta:") ? `×2 ${menoKarty(d.slice(6))}` : d;
    for (const uid of naexCiele) {
      const strana = view.strany[0].some((pl) => pl.card.uid === uid) ? 0 : 1;
      const index = view.strany[strana].findIndex((pl) => pl.card.uid === uid);
      const placed = view.strany[strana][index];
      if (placed === undefined) continue;
      const strany: ClientState["strany"] = [
        view.strany[0].map((pl) => (pl.card.uid === uid ? { ...pl, naexBy: ja } : pl)),
        view.strany[1].map((pl) => (pl.card.uid === uid ? { ...pl, naexBy: ja } : pl)),
      ];
      const ev = evaluateLine(data, { ...lineState(view), strany });
      const d = poskodenieBitky(data, { ...stol, strany }, ev.sums, ja === 0 ? [mojeAbstaky, 0] : [0, mojeAbstaky]);
      const zmeny = ([0, 1] as const).map((p) => {
        const kluce = new Set([...Object.keys(ev.sums[p]), ...Object.keys(lineEval.sums[p])]) as Set<keyof (typeof ev.sums)[0]>;
        const out2: string[] = [];
        for (const k of kluce) {
          const rozdiel = (ev.sums[p][k] ?? 0) - (lineEval.sums[p][k] ?? 0);
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
      // Kliatby: NA EX pripíše pečeň +1 tomu, kto ho dal, a zmení línie — porovnaj stôl pred a po.
      const h = view.hraci;
      const hraci: ClientState["hraci"] = ja === 0 ? [{ ...h[0], pecen: h[0].pecen + 1 }, h[1]] : [h[0], { ...h[1], pecen: h[1].pecen + 1 }];
      const pred = { ciel: stol.ciel, ovladnute: view.ovladnute, strany: view.strany, starsi: view.starsi, hraci: view.hraci, lokalitaOtocena: view.lokalitaOtocena, vizia: view.vizia };
      const kliatby = kliatbyNahladu(data, pred, { ...pred, strany, hraci }, dalsiePitky, cenyKliatob);
      const svokra = svokraZaNaex(data, view, ja, view.hraci[ja].cigarety);
      out.set(uid, { tuhe: d.tuhe, zmeny, vzorec, kliatby, svokra, majitel: placed.playedBy, strana, pozicia: index + 1 });
    }
    return out;
  }, [mode.typ, naexCiele, data, view, stol, lineEval, odhad, ja, sada, nahladyPitky, cenyKliatob, dalsiePitky]);

  // Náhľad odpovede na NA EX (návrh #1 B): ten istý ako pri NA EX — bitka pred
  // a po navrhnutej karte a kliatby oboch hráčov po Pitke.
  const nahladOdpovede = useMemo(() => {
    if (!reagujem || odhad === null || stol.ciel === null || !vylozenia.some((x) => x.ciel === "vlastna" || x.ciel === "superova")) return null;
    const mojeAbstaky = view.ruka.filter((k) => k.defId === "abstak").length;
    const bezOdpovede = poskodenieBitky(data, view, evaluateLine(data, lineState(view)).sums, ja === 0 ? [mojeAbstaky, 0] : [0, mojeAbstaky]);
    const pred = { ciel: stol.ciel, ovladnute: view.ovladnute, strany: view.strany, starsi: view.starsi, hraci: view.hraci, lokalitaOtocena: view.lokalitaOtocena, vizia: view.vizia };
    return { pred: bezOdpovede.tuhe, kliatby: kliatbyNahladu(data, pred, { ...pred, strany: stol.strany }, dalsiePitky, cenyKliatob) };
  }, [reagujem, odhad, stol, vylozenia, view, data, ja, dalsiePitky, cenyKliatob]);

  // Náhľad vyloženia na koniec strany (playtest 20261017-164450: ktorá hrana
  // sa spáruje, hráči zisťovali skúškou) — počas ťahania aj v návrhu.
  const nahladVylozeniaNa = (k: CardInstance, kam: "vlastna" | "superova"): NahladVylozenia =>
    nahladVylozenia(data, { ...lineState(view), strany: stol.strany }, ja, k, kam);
  const nazovAkcie = (k: string): string => sada.akcie.find((a) => a.kluc === k)?.nazov ?? k;
  const textZmien = (z: ActionSums): string =>
    (Object.entries(z) as [string, number][]).map(([k, d]) => `${nazovAkcie(k)} ${d > 0 ? "+" : "−"}${Math.abs(d)}`).join(", ") || "bez zmeny";
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
    return { n, uid: posledna.karta.uid, spoj: textSpoja(n), ja: textZmien(n.zmeny[ja]), su: textZmien(n.zmeny[super_]) };
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
    setNavrh(null);
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
  // Počítadlo bitky (Michal 2026-10-23): výsledok rastie po vlnách, kým ho hráč nepreskočí.
  // Stôl je ten s líniou — keď bitka hneď skončila a línia už zmizla, predošlý pohľad.
  const [pocitadlo, setPocitadlo] = useState<{ readonly p: Pocitadlo; readonly stol: ClientState; readonly linia: LineEval } | null>(null);
  const pocitadloAktivne = useRef(false);
  const koniecPocitadla = useCallback(() => {
    pocitadloAktivne.current = false;
    setPocitadlo(null);
  }, []);
  const pocitadloBezi = pocitadlo !== null;
  useEffect(() => onPocitadlo?.(pocitadloBezi), [pocitadloBezi, onPocitadlo]);
  useEffect(() => {
    for (const e of udalosti?.events ?? []) {
      if (e.type === "pitkaVysledok") setUcetPitky({ kolo: view.kolo, pitka: e.pitka, cirhozy: e.cirhozy, dlhy: e.dlhy, cigarety: e.cigarety });
      if (e.type === "bitkaVysledok") {
        vysledokBitky.current = e;
        const stol = view.ciel !== null && view.strany.some((s) => s.length > 0) ? view : (predoslyView.current ?? view);
        const tlmene = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (!tlmene && stol.ciel !== null) {
          const linia = evaluateLine(data, lineState(stol));
          pocitadloAktivne.current = true;
          setPocitadlo({ p: pocitadloBitky(data, stol, linia, e.damage.tuhe), stol, linia });
        }
      }
    }
    // Len nové udalosti — view.kolo je to isté prekreslenie.
  }, [udalosti?.id]);
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
    const nove = <T,>(a: readonly T[], b: readonly T[], uid: (x: T) => number): T[] => b.filter((x) => !a.some((y) => uid(y) === uid(x)));
    const lokality = [
      ...nove(zaklad.ovladnute, view.ovladnute, (o) => o.karta.uid).map((o) => ({ meno: menoKarty(o.karta.defId), komu: o.hrac, ako: "ovladol" as const })),
      ...nove(zaklad.naSekeru, view.naSekeru, (k) => k.uid).map((k) => ({ meno: menoKarty(k.defId), komu: null, ako: "sekera" as const })),
      ...nove(zaklad.prepadnute, view.prepadnute, (k) => k.uid).map((k) => ({ meno: menoKarty(k.defId), komu: null, ako: "prepadla" as const })),
    ];
    const posuny = view.starsi.flatMap((e) => {
      const a = zaklad.starsi.find((x) => x.elderId === e.elderId);
      return a === undefined || a.marker === e.marker ? [] : [{ meno: menoKarty(e.karta.defId), pred: a.marker, po: e.marker }];
    });
    const bodyPred = bodyTeraz(data, zaklad).spolu;
    const bodyPo = bodyTeraz(data, view).spolu;
    setUcetBitky({
      kolo: pred.kolo,
      lokalita: zaklad.ciel?.lokalita === null || zaklad.ciel === null ? "" : menoKarty(zaklad.ciel.lokalita.defId),
      tuhe: v?.damage.tuhe ?? [0, 0],
      vitaz: v?.vitaz ?? null,
      prebytok: v?.prebytok ?? 0,
      prebytokNaRozdelenie: v?.prebytokNaRozdelenie ?? 0,
      prebytokDrzi: v?.prebytokDrzi ?? null,
      lokality,
      posuny,
      body: { pred: [bodyPred[0], bodyPred[1]], po: [bodyPo[0], bodyPo[1]] },
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
      out.add(z.navrh ? "lokality" : "lokalita");
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
      const vykladal = z.odkial === "ruka" && !z.navrh && [...cieleZdroja(z)].some((c) => jeCielVykladania(c) || c.startsWith(NAHRADIT));
      if (vykladal && document.elementFromPoint(bod.x, bod.y)?.closest(".ruka") == null) {
        setChybaTahania({ text: "Karta sa nepoložila. Pusti ju na zvýraznené miesto alebo klikni na „+“ a potom na kartu.", ...bod });
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
   * Karta, ktorá sa klikom zväčší (narovnaná, aby sa dala čítať). Ak klik
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
    } = {},
  ): ReactNode => {
    const uid = props.karta.uid;
    const kluc = `k${uid}`;
    const render = (sirka: number): ReactNode => karta({ ...props, otocena: false, sirka });
    if (moznosti.bezLupy !== true) lupaKarty.set(kluc, { render, ...(moznosti.zdroj === undefined ? {} : { zdroj: moznosti.zdroj }), odstran: moznosti.odstran });
    const maAkciu = props.onClick !== undefined;
    const triedy = ["s-lupou", maAkciu ? "ma-akciu" : "", lupa?.kluc === kluc ? "harmonika-aktivna" : ""];
    if (moznosti.trieda !== undefined) triedy.push(moznosti.trieda);
    return (
      <div
        key={moznosti.kluc ?? uid}
        className={triedy.filter((x) => x !== "").join(" ")}
        title={moznosti.titul}
        // Karta s akciou je fokusovateľná sama; ostatné dostanú tabIndex kvôli klávesnici.
        {...nadLupou(kluc, (el) => el.querySelector(".kl"), !maAkciu)}
        onContextMenu={pravyKlik(moznosti.odstran)}
      >
        {moznosti.obsah ?? karta(props)}
        {moznosti.stitok}
      </div>
    );
  };
  // Hodnota lokality (Michal 2026-10-22): štítok cez kartu pri výbere cieľa a vo vrstve Lokality.
  // Pri voľbe cieľa aj so sekerou — víťaz bitky ju berie spolu s cieľom.
  const stitokHodnoty = (k: CardInstance): ReactNode => {
    const sSekerou = view.faza === "volbaCiela" && view.naSekeru.length > 0;
    const h = hodnotaLokality(data, view, k, sSekerou);
    return (
      <span
        className="hodnota-lokality"
        title={`Ovládnutie${sSekerou ? " (aj so sekerou)" : ""} by ti dnes pridalo ${h[ja]} b, ${menoHraca(super_)} ${h[super_]} b — podľa rozdania scorecardov, každá aktívna podmienka „lokality“ zvlášť.`}
      >
        +{h[ja]} b · súper +{h[super_]}
      </span>
    );
  };
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
        {textZmien(nahladTahania.n.zmeny[ja])} · {menoHraca(super_)}: {textZmien(nahladTahania.n.zmeny[super_])}
      </span>
    );

  const zonaTriedy = (ciel: string, zaklad: string): string =>
    [zaklad, jeCiel(ciel) ? "ciel-zona" : "", nadCielom(ciel) ? "nad-cielom" : ""].join(" ");

  // ---- klikanie na karty v línii (NA EX cieľ, Pohreb) -------------------
  // Pohreb berie tvoju kartu — natočenú k tebe, na ktorejkoľvek strane.
  const klikLinia = (majitel: PlayerId, uid: number): (() => void) | undefined => {
    if (mode.typ === "naexCiel") {
      if (!naexCiele.has(uid)) return undefined;
      return () => setMode(mode.uid === uid ? { typ: "ziadny" } : { typ: "naexCiel", uid });
    }
    // Pitka (Michal 2026-10-21): klik na kartu so značkou ju rovno vyberie — pečiatka NA EX! sa ukáže na hrane stola.
    if (naexPriamo && mode.typ === "ziadny" && naexCiele.has(uid)) {
      return () => setMode({ typ: "naexCiel", uid });
    }
    if (mode.typ === "pohrebKarta" && majitel === ja) {
      return () => {
        // Za Závislého smie hráč vziať kartu zo šenku — najprv ju vyberie.
        const karta = view.strany.flat().find((pl) => pl.card.uid === uid)?.card;
        const zavisly = karta !== undefined && (data.cards.get(karta.defId)?.tags ?? []).includes("Závislý");
        if (zavisly && view.senok.length > 0) setMode({ typ: "pohrebSenok", cirhozaUid: mode.cirhozaUid, kartaUid: uid });
        else posli({ type: "pohreb", cirhozaUid: mode.cirhozaUid, kartaUid: uid });
      };
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
    const poradie = p === ja ? [...view.strany[p]].reverse() : view.strany[p];
    return poradie.map((placed) => {
      const uid = placed.card.uid;
      const vybranaBenzinka = mode.typ === "vyber" && benzinkaCiele.has(uid) && mode.uids.includes(uid);
      const nova = noveSuperove.includes(uid);
      // NA EX na karte je štítok nad kartou, výber pre NA EX nápis pod ňou (Michal 2026-10-21).
      const naexBy = placed.naexBy;
      const vybranaNaex = mode.typ === "naexCiel" && mode.uid === uid;
      const stitky =
        nova || naexBy !== undefined || vybranaNaex || placed.zaverecna === true ? (
          <>
            {nova && (
              <span className="nova-stitok" title={`Vyložil ${menoHraca(super_)} v poslednom ťahu`}>
                nová
              </span>
            )}
            {naexBy !== undefined && (
              <span className="naex-nad" title={`NA EX — poldeci hráča ${menoHraca(naexBy)}`}>
                <IkonaPoldeci /> NA EX · {naexBy === ja ? "tvoj" : menoHraca(naexBy)}
              </span>
            )}
            {/* Nad kartou ako NA EX — pod ňou zakrýval text efektu (UI inšpekcia); za štítkom NA EX sa posunie vyššie. */}
            {placed.zaverecna === true && (
              <span className="zaverecna-stitok" title="Tvoja Záverečná — súper ju nevidí a nevie, čo dáva; za ňu sa nedá priložiť. Otočí sa na konci Pitky.">
                Záverečná · lícom dole
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
        },
        {
          trieda: [
            naexMozny && naexCiele.has(uid) ? "naex-mozny" : "",
            mode.typ === "naexCiel" && !naexCiele.has(uid) ? "naex-nie" : "",
            naexBy !== undefined ? "naex-dany" : "",
            nova ? "nova-superova" : "",
            ukazHrozbu === uid ? "hrozba-ciel" : "",
            placed.zaverecna === true ? "zaverecna-moja" : "",
          ]
            .join(" ")
            .trim() || undefined,
          ...(mode.typ === "naexCiel" && !naexCiele.has(uid) ? { titul: dovodBezNaexNaKartu(placed) } : {}),
          ...(stitky !== undefined ? { stitok: stitky } : {}),
          // Benzínka: pravý klik vyradí Občana z výberu.
          odstran: vybranaBenzinka && mode.typ === "vyber" ? () => setMode({ typ: "vyber", uids: mode.uids.filter((u) => u !== uid) }) : undefined,
        },
      );
    });
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
  const koniecStrany = (p: PlayerId): ReactNode => {
    const ciel: CielVykladania = p === ja ? "vlastna" : "superova";
    const navrhnute = vylozenia.filter((x) => x.ciel === ciel).map((x) => {
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
    });
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
          <span>ty: {textZmien(n.zmeny[ja])}</span>
          <span>
            {menoHraca(super_)}: {textZmien(n.zmeny[super_])}
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
    const vybrana = mode.typ === "naexCiel" && mode.uid === z.uid;
    // Ako karta v línii: značka, keď NA EX dať môžeš; klik rovno, alebo po pečiatke NA EX!.
    const znacka = naexMozny && naexCiele.has(z.uid);
    const klik = znacka && (naexPriamo || mode.typ === "naexCiel") ? () => setMode(vybrana ? { typ: "ziadny" } : { typ: "naexCiel", uid: z.uid }) : undefined;
    return vLinii(
      <button
        type="button"
        className={["rub-zaverecnej", znacka ? "naex-mozny" : "", vybrana ? "vybrana" : ""].join(" ")}
        style={{ width: sirkaVLinii, height: (sirkaVLinii * 80) / 54 }}
        disabled={klik === undefined}
        onClick={klik}
        title={`Záverečná ${menoHraca(super_)} lícom dole — nevieš, čo to je, ale ráta sa do bitky. Za ňu sa nedá priložiť, otočí sa na konci Pitky.${klik !== undefined ? " Klik: NA EX (prejde vždy)." : ""}`}
      >
        <span className="rub-text">
          Záverečná
          <small>lícom dole · otočí sa na konci Pitky</small>
        </span>
        {z.naexBy !== null && (
          <span className="naex-nad">
            <IkonaPoldeci /> NA EX · {z.naexBy === ja ? "tvoj" : menoHraca(z.naexBy)}
          </span>
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

  // ---- tlačidlá návrhu na stole (Michal 2026-10-20) ------------------------
  // Potvrdenie patrí k tomu, čo leží na stole — hráč nemusí pozerať dole na pás.
  const stolTlacidla = ((): ReactNode => {
    if (!somNaTahu || view.koniec !== null) return null;
    const navrat = (text: string, fn: () => void): ReactNode => (
      <button data-skratka="esc" onClick={fn} title="To isté urobí pravý klik na kartu alebo Esc.">
        {text}
      </button>
    );
    if (view.faza === "volbaCiela" && lokalitaNavrh !== null) {
      return (
        <>
          {navrat("← späť na výber", () => setNavrh(null))}
          <button onClick={() => setNavrh({ typ: "lokalita", uid: lokalitaNavrh.karta.uid, otocena: !lokalitaNavrh.otocena })}>otočiť ↻</button>
          <button className="tlacidlo-hlavne" data-skratka="k" onClick={() => posli({ type: "chooseLocation", uid: lokalitaNavrh.karta.uid, otocena: lokalitaNavrh.otocena })}>
            potvrdiť
          </button>
        </>
      );
    }
    if (view.faza === "zhromazdenie" && plan !== null && vylozenia.length > 0) {
      return (
        <>
          {navrat("vrátiť do ruky", () => setNavrh(null))}
          <button
            className="tlacidlo-hlavne"
            data-skratka="k"
            disabled={plan.chyba !== null || chybaVoVyucbe !== null}
            title={plan.chyba ?? chybaVoVyucbe ?? undefined}
            onClick={() => posli({ type: "tah", kroky: plan.kroky })}
          >
            potvrdiť{plan.poldeci > 0 && <span className="cena">−{plan.poldeci} poldeci</span>}
          </button>
          {/* Výučba: prečo sa nedá potvrdiť, priamo pri tlačidle (nápoveda na dotyku nie je). */}
          {chybaVoVyucbe !== null && plan.chyba === null && <span className="vyucba-zamok">{chybaVoVyucbe}</span>}
        </>
      );
    }
    if (reagujem && vylozene !== null) {
      return (
        <>
          {navrat("vrátiť do ruky", () => setNavrh(null))}
          <button className="tlacidlo-hlavne" data-skratka="k" onClick={() => posli({ type: "place", uid: vylozene.karta.uid, target: vylozene.ciel })}>
            potvrdiť
          </button>
        </>
      );
    }
    const bs = view.bitkaStav;
    if (view.faza === "bitka" && bs?.krok === "benzinka" && bs.caka === ja) {
      const vybrane = mode.typ === "vyber" ? mode.uids : [];
      const treba = bs.benzinkaZostava[ja];
      return (
        <button className="tlacidlo-hlavne" disabled={vybrane.length !== treba} onClick={() => posli({ type: "benzinka", uids: vybrane })}>
          zahodiť {vybrane.length}/{treba}
        </button>
      );
    }
    return null;
  })();
  /** Pravý klik na prázdny stôl zruší rozbehnutý výber (miesto, cieľ NA EX, Pohreb…). */
  const zrusVyberNaStole = ((): (() => void) | undefined => {
    if (miestoVolby !== null) return () => setMiestoVolby(null);
    if (mode.typ === "naexCiel" || mode.typ === "pohrebKarta") return () => setMode({ typ: "ziadny" });
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
    /** Prepínač (Záverečná) — stlačený stav. */
    readonly stlacena?: boolean;
  }): ReactNode => (
    <button
      key={p.kluc}
      type="button"
      className={`pecat pecat-nakup${p.dovod !== null ? " ne" : ""}${p.stlacena === true ? " stlacena" : ""}`}
      data-vyucba={p.kluc === "zaverecna" ? "zaverecna" : `tlacidlo:${p.kluc}`}
      aria-disabled={p.dovod !== null}
      aria-pressed={p.stlacena}
      title={p.dovod ?? p.tip}
      onClick={() => {
        if (p.dovod === null) p.akcia();
      }}
    >
      {(p.ikona !== null || p.cena > 0) && (
        <span className="pecat-riadok">
          {p.ikona}
          {p.cena > 0 && <CenaCigariet n={p.cena} znamienko={p.znamienko ?? "−"} />}
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
            {view.koniec.body !== null && ` Body ${view.koniec.body[ja]}:${view.koniec.body[super_]} (ty : ${menoHraca(super_)}).`}
            {frajerina !== null && <ZmenaFrajeriny pred={frajerina[ja].pred} po={frajerina[ja].po} />}
          </>
        ),
        tlacidla: (
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

    switch (view.faza) {
      case "volbaCiela":
        return lokalitaNavrh === null
          ? {
              nadpis: "Cieľ kola",
              text: "Klikni na lokalitu v paneli Cieľ kola.",
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
            const cena = cenaPatronatu(vybrany);
            const vybrata = kandidatiPatronatu.find((k) => k.uid === mode.uid);
            return {
              nadpis: `Patronát — ${menoKarty(vybrany.karta.defId)}`,
              text: (
                <span className="zberatel-text">
                  <span>
                    Ktorý Občan či Zviera pôjde lícom dole na scorecard? Pri výhre ostane na ukazovateli a jeho akcie zapnú podmienky —
                    pod kartou body ty:súper pri výhre (teraz <b>{b2(nahladPatronatu(data, view, vybrany.elderId, null).teraz)}</b>, pri
                    prehre <b>{b2(nahladPatronatu(data, view, vybrany.elderId, null).prehra)}</b>; súper si ich {cena.pohorsenia} Pohoršeniami
                    môže čiastočne vrátiť).
                  </span>
                  <span className="zberatel-ponuka">
                    {kandidatiPatronatu.map((k) => (
                      <span key={k.uid} className="nahrada-kandidat">
                        {karta({ karta: k, sirka: 84, vybrana: mode.uid === k.uid, onClick: () => setMode({ typ: "patronat", elderId: vybrany.elderId, uid: k.uid }) })}
                        <small>výhra {b2(nahladPatronatu(data, view, vybrany.elderId, k).vyhra)}</small>
                      </span>
                    ))}
                  </span>
                </span>
              ),
              tlacidla: (
                <>
                  <button onClick={zrus}>iný starší</button>
                  <button
                    className="tlacidlo-hlavne"
                    data-vyucba="potvrdit"
                    disabled={vybrata === undefined}
                    onClick={() => vybrata !== undefined && posli({ type: "patronat", elderId: vybrany.elderId, uid: vybrata.uid })}
                  >
                    vziať do ruky{cena.cigarety > 0 && <span className="cena">−{cigariet(cena.cigarety)}</span>}
                  </button>
                </>
              ),
            };
          }
          return {
            nadpis: "Patronát",
            text: (
              <>
                Starší, ktorý ti prejavuje priazeň (aspoň žltá zóna), ti môže prísť na pomoc: vezmeš si ho do ruky, na jeho scorecard dáš
                lícom dole Občana či Zviera z ruky a marker pôjde do stredu. Platíš cigarety do červenej, súper dostane v bitke toľko
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
                <button className="tlacidlo-hlavne" onClick={() => posli({ type: "bezPatronatu" })}>
                  neberiem
                </button>
              </>
            ),
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
          };
        }
        return {
          nadpis: "Branie zo šenku",
          text: mozemBrat ? (
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
        };
      }

      case "zhromazdenie": {
        const zostava = zostavaTeraz;
        const plne = view.hraci[ja].poldeciPlne;
        const nadpis = (
          <>
            Zhromaždenie <small>limit {zostava}</small>
          </>
        );
        // Fajčiť smie hráč kedykoľvek na svojom ťahu (Michal 2026-10-16) — cigareta = karta hneď.
        const fajcit = (
          <>
            <span className="hrana-zasoba" title={`Máš ${cigariet(view.hraci[ja].cigarety)}.`}>
              <b>{view.hraci[ja].cigarety}</b>cigarety
            </span>
            {pecatNakupu({
              kluc: "fajcit",
              ikona: <IkonaCigareta zakaz={zakazFajcit(view)} />,
              nazov: "fajčiť",
              cena: 1,
              dovod: zakazFajcit(view)
                ? "Benzínka: nikto nesmie fajčiť."
                : view.hraci[ja].cigarety === 0
                  ? "Nemáš cigaretu."
                  : !jeCoTahat(view.hraci[ja].doberaciPocet, view.hraci[ja].odhadzovaci.length)
                    ? "Nemáš z čoho ťahať — doberací aj odhadzovací balíček sú prázdne."
                    : null,
              tip: "Fajčiť: za cigaretu si hneď doberieš kartu. Ťah ti neskončí, ráta sa ako nerest.",
              akcia: () => cmd({ type: "smoke", pocet: 1 }),
            })}
            {(view.zaverecnaMozna || zaverecnaZapnuta) &&
              pecatNakupu({
                kluc: "zaverecna",
                ikona: <span className="ikona-rub" aria-hidden="true" />,
                nazov: zaverecnaZapnuta ? "záverečná ✓" : "záverečná",
                cena: KONSTANTY.CENA_ZAVERECNEJ,
                dovod: null,
                stlacena: zaverecnaZapnuta,
                tip: `Záverečná: posledná karta ťahu do línie pôjde lícom dole za ${cigariet(KONSTANTY.CENA_ZAVERECNEJ)}. Súper ju nevidí do konca Pitky a za ňu nepriloží; ty už v tomto Zhromaždení nevykladáš (bez cigariet za pas).`,
                akcia: () => setZaverecnaZapnuta(!zaverecnaZapnuta),
              })}
          </>
        );
        // Celý ťah naraz (Michal 2026-10-19): karty sa ťahajú na stôl ako návrh,
        // každá ďalšia stojí plný poldeci, server dostane ťah až po „potvrdiť“ na stole.
        if (vylozenia.length === 0 || plan === null) {
          const zaPas = (view.zhromazdenieStav === null ? 0 : kartyZaPas(view.zhromazdenieStav, ja)) * KONSTANTY.CIGARETY_ZA_PAS_NA_KARTU;
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
            text: textNahladuTahania ?? textVolbyMiesta ?? (
              <>
                {zaverecnaZapnuta && (
                  <strong>Záverečná: polož kartu do línie — pôjde lícom dole a potom už nevykladáš. </strong>
                )}
                Potiahni kartu z ruky na stôl, alebo klikni na <strong>+</strong> na konci strany — vysunú sa karty, ktoré sa tam spoja. Alebo
                pasuj do Pitky (cigareta za každú nevyloženú kartu).{" "}
                <span className="tlmene">
                  Ďalšie karty v tom istom ťahu smieš pridať, každá ťa stojí plný poldeci (limit −1, pečeň +1){plne === 0 ? " — teraz žiadny nemáš" : ""}.
                </span>
              </>
            ),
            vlavo: fajcit,
            vpravo: (
              <button
                className="pecat pecat-koncim"
                data-skratka="p"
                data-vyucba="tlacidlo:pas"
                title="Do Pitky už nevykladáš, súper vykladá sám. Za každú kartu, ktorú si ešte smel vyložiť, dostaneš cigaretu."
                onClick={() => (mozemVylozit && vyucba !== true ? odlozenyPas.spusti({ type: "pass" }) : posli({ type: "pass" }))}
              >
                pasovať <CenaCigariet n={zaPas} znamienko="+" />
              </button>
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
                  {x.zaverecna === true && <b className="zaverecna-text"> · Záverečná lícom dole (−{cigariet(KONSTANTY.CENA_ZAVERECNEJ)})</b>}
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
          vlavo: fajcit,
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
                  — navždy z hry (kliatba, slabá karta).{zostava > 1 ? ` Ešte ${zostava - 1}× Vízia.` : ""}{" "}
                  <span className="tlmene">Balíček pod {KONSTANTY.MIN_VELKOST_BALICKA} kariet = prehra.</span>
                </span>
              </span>
            ),
            tlacidla: (
              <>
                <button onClick={() => posli({ type: "vizia", vziat: false })}>zahodiť</button>
                <button className="tlacidlo-hlavne" onClick={() => posli({ type: "vizia", vziat: true })}>
                  do ruky
                </button>
              </>
            ),
          };
        }
        const hracJa = view.hraci[ja];
        const pitkaSt = view.pitkaStav;
        const obranca: PlayerId = view.utocnik === 0 ? 1 : 0;
        const naexBol = pitkaSt?.naexPouzity[ja] === true;
        const nadpis = `Pitka ${view.pitkaCislo}/${view.pitkyCelkom}`;
        if (reagujem) {
          // Reakcia na súperovo NA EX (Michal 2026-10-12): jedna karta mimo limitu.
          return vylozene === null
            ? {
                nadpis: "Odpoveď na NA EX",
                text: textNahladuTahania ?? textVolbyMiesta ?? (
                  <>
                    {menoHraca(super_)} {tvar(rodHracaP(super_), "dal", "dala", "dáva")} NA EX — môžeš hneď vyložiť <strong>jednu kartu</strong> z ruky (limit nemíňa), napr. aby si
                    jeho neaktívne akcie spároval a NA EX ich zrušil. Potiahni ju na stôl, alebo klikni na <strong>+</strong> na konci strany.
                  </>
                ),
                tlacidla: (
                  <button data-vyucba="tlacidlo:bez-odpovede" onClick={() => posli({ type: "bezReakcie" })}>
                    bez odpovede
                  </button>
                ),
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
                        {" "}· bitka {nahladOdpovede.pred[ja]}:{nahladOdpovede.pred[super_]} → <b>{odhad.tuhe[ja]}:{odhad.tuhe[super_]}</b> · kliatby — ty:{" "}
                        {textKliatob(nahladOdpovede.kliatby[ja])} · {menoHraca(super_)}: {textKliatob(nahladOdpovede.kliatby[super_])}
                      </span>
                    )}
                    {textVolbyMiesta !== null && <> · {textVolbyMiesta}</>}
                  </>
                ),
              };
        }
        if (mode.typ === "starosta") {
          const zRuky = view.ruka.find((k) => k.uid === mode.rukaUid);
          return {
            nadpis: "Starosta",
            text:
              zRuky === undefined ? (
                "Klikni na kartu v ruke, ktorú vymeníš (za cigaretu) za kartu zo šenku."
              ) : (
                <>
                  Dávaš <strong>{menoKarty(zRuky.defId)}</strong> — klikni v šenku na kartu, ktorú si vezmeš.
                </>
              ),
            tlacidla: (
              <>
                <button onClick={zrus}>zrušiť</button>
                <button onClick={() => setVrstva("senok")} disabled={zRuky === undefined}>
                  šenok
                </button>
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
                          cmd({ type: "vykup", uid: k.uid });
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
        const dovodBezNaex = zakazNaex(view)
          ? "Kostol: nikto nesmie dať NA EX."
          : naexBol
          ? "NA EX si v tejto Pitke už dal."
          : hracJa.poldeciPlne === 0
            ? "Nemáš plný poldeci (doliať: 2 cigarety)."
            : naexCiele.size === 0
              ? "NA EX ide len na Občana či Starešinu v línii (nie Nástroj, nie Liberál, nie na súperovho Anonymného alkoholika)."
              : null;
        const krcma = view.ciel?.lokalita?.defId === "krcma" && dovodBezNaex === null;
        const postarkaKarty = KONSTANTY.EFEKT.POSTARKA_KARTY;
        const cenaBarteru = barterCena(data, view, ja);
        const mamEfekt = (defId: string): boolean =>
          [...view.strany[0], ...view.strany[1]].some((pl) => pl.playedBy === ja && pl.card.defId === defId);
        const postarka =
          mamEfekt("postarka") && pitkaSt?.postarka[ja] !== true && jeCoTahat(hracJa.doberaciPocet, hracJa.odhadzovaci.length);
        const starosta = mamEfekt("starosta") && pitkaSt?.starosta[ja] !== true && hracJa.cigarety > 0;
        // Vínko (Michal 2026-10-19): s ním sa poldeci za cigarety nedolieva.
        const vinko = hracJa.dedicstvo.some((k) => k.defId === "vinko");
        const vykup = vykupZoSrotu(view) && pitkaSt?.vykup?.[ja] !== true;
        // Poradie v Pitke (dizajn UX N1 „Pitka nahlas“): obranca začína, útočník má posledné slovo.
        const superSkoncil = pitkaSt?.hotovy[super_] === true;
        const zacinam = obranca === ja && !superSkoncil;
        const superNaex = (pitkaSt?.naexPocet?.[super_] ?? 0) > 0;
        const kontext = superSkoncil ? (
          <>
            {menoHraca(super_)} {tvar(rodHracaP(super_), "skončil", "skončila", "končí")}{superNaex ? "" : " bez NA EX"}.{" "}
            <strong>{tvar(rodHracaP(ja), "Si posledný", "Si posledná", "Máš posledné slovo")}</strong> — na tvoje NA EX už odpovie len jednou
            kartou. Po tvojom „končím“ sa Pitka vyhodnotí.{" "}
          </>
        ) : zacinam ? (
          <>
            <strong>Začínaš Pitku.</strong> {menoHraca(super_)} uvidí tvoje NA EX a smie naň odpovedať.{" "}
          </>
        ) : null;
        const limitPo = limitBuduceKolo(view, ja, true);
        const limitBez = limitBuduceKolo(view, ja);
        // „končím“ chce druhý klik len vtedy, keď ním hráč vzdáva možné NA EX a súper ešte neskončil.
        const hotovoVzdavaNaex = dovodBezNaex === null && !superSkoncil && !krcma;
        if (potvrdenie === "hotovo") {
          return {
            nadpis,
            text: (
              <strong>
                Skončiť bez NA EX? V tejto Pitke ho už nedáš a {menoHraca(super_)} bude hrať s vedomím, že {tvar(rodHracaP(ja), "si skončil", "si skončila", "končíš")} — bude mať posledné slovo.
              </strong>
            ),
            vpravo: (
              <>
                <button className="pecat pecat-tichy" onClick={() => setPotvrdenie(null)} autoFocus>
                  ešte nie
                </button>
                <button className="pecat pecat-koncim" data-skratka="k" onClick={() => posli({ type: "skipNaex" })}>
                  skončiť Pitku
                </button>
              </>
            ),
          };
        }
        const cig = hracJa.cigarety;
        // Nákupy za cigarety (Michal 2026-10-21): každý je samostatná pečiatka vľavo na hrane stola — jeden klik.
        const nakupy = (
          <>
            <span className="hrana-zasoba" title={`Máš ${cigariet(cig)}.`}>
              <b>{cig}</b>cigarety
            </span>
            {pecatNakupu({
              kluc: "fajcit",
              ikona: <IkonaCigareta zakaz={zakazFajcit(view)} />,
              nazov: "fajčiť",
              cena: 1,
              dovod: zakazFajcit(view)
                ? "Benzínka: nikto nesmie fajčiť."
                : cig === 0
                  ? "Nemáš cigaretu."
                  : !jeCoTahat(hracJa.doberaciPocet, hracJa.odhadzovaci.length)
                    ? "Nemáš z čoho ťahať — doberací aj odhadzovací balíček sú prázdne."
                    : null,
              tip: "Fajčiť: za cigaretu si hneď doberieš kartu. Ráta sa ako nerest.",
              akcia: () => cmd({ type: "smoke", pocet: 1 }),
            })}
            {pecatNakupu({
              kluc: "doliat",
              ikona: <IkonaPoldeci />,
              nazov: "doliať",
              cena: KONSTANTY.REFILL_CENA,
              dovod: vinko
                ? "Vínko v Dedičstve: poldeci za cigarety dolievať nesmieš (nový poldeci barterom áno)."
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
                tip: "Zberný dvor: raz za Pitku za cigaretu karta z tvojho odhadzovacieho balíčka do ruky.",
                akcia: () => setMode({ typ: "vykup" }),
              })}
            {starosta &&
              pecatNakupu({
                kluc: "starosta",
                ikona: null,
                nazov: "Starosta",
                cena: 1,
                dovod: null,
                tip: "Starosta: za cigaretu vymeň kartu z ruky za kartu zo šenku.",
                akcia: () => setMode({ typ: "starosta", rukaUid: null }),
              })}
            {postarka &&
              Array.from({ length: postarkaKarty }, (_, i) => i + 1).map((n) =>
                pecatNakupu({
                  kluc: `postarka${n}`,
                  ikona: null,
                  nazov: `Poštárka +${n}`,
                  cena: 0,
                  dovod: null,
                  tip: `Poštárka: dober karty navyše a s nimi ${KONSTANTY.EFEKT.POSTARKA_DLHY} Dlh.`,
                  akcia: () => cmd({ type: "postarka", pocet: n }),
                }),
              )}
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
                : superSkoncil
                  ? "Pitka sa vyhodnotí — nedá sa vrátiť."
                  : `Končíš svoju časť Pitky — nedá sa vrátiť. ${menoHraca(super_)} potom hrá a má posledné slovo.`
            }
            onClick={() => {
              if (krcma) return;
              if (hotovoVzdavaNaex && vyucba !== true) setPotvrdenie("hotovo");
              else posli({ type: "skipNaex" });
            }}
          >
            {superSkoncil ? "končím · vyhodnotiť" : "končím"}
          </button>
        );
        // Vybraná karta (klik na kartu so značkou): pod kartou „vybraná“, v pilulke náhľad, na hrane pečiatka NA EX!.
        const vybranaUid = mode.typ === "naexCiel" ? mode.uid : null;
        const vybrana = vybranaUid === null ? undefined : nahladNaex.get(vybranaUid);
        const naRub = vybranaUid !== null && view.zaverecne.some((z) => z.uid === vybranaUid);
        const menoVybranej = naRub ? "súperovu Záverečnú" : vybranaUid === null ? "" : menoKarty(view.strany.flat().find((pl) => pl.card.uid === vybranaUid)?.card.defId ?? "");
        const textVyberu = naRub ? (
          <span className="naex-vyber-text">
            <strong>NA EX na súperovu Záverečnú</strong> · nevieš, čo to je — prejde vždy, aktívne akcie zruší a neaktívne zdvojí ako pri každej karte · pečeň +1
          </span>
        ) :
          vybrana === undefined || odhad === null ? null : (
            <span className="naex-vyber-text">
              <strong>NA EX na {menoVybranej}</strong> · bitka {odhad.tuhe[ja]}:{odhad.tuhe[super_]} →{" "}
              <b>
                {vybrana.tuhe[ja]}:{vybrana.tuhe[super_]}
              </b>{" "}
              {vybrana.tuhe[ja] - vybrana.tuhe[super_] > odhad.tuhe[ja] - odhad.tuhe[super_]
                ? "▲"
                : vybrana.tuhe[ja] - vybrana.tuhe[super_] < odhad.tuhe[ja] - odhad.tuhe[super_]
                  ? "▼"
                  : "="}{" "}
              · ty: {vybrana.zmeny[ja].length > 0 ? vybrana.zmeny[ja].join(", ") : "bez zmeny"} · {menoHraca(super_)}:{" "}
              {vybrana.zmeny[super_].length > 0 ? vybrana.zmeny[super_].join(", ") : "bez zmeny"}
              <span className="tlmene">
                {" "}
                · kliatby — ty: {textKliatob(vybrana.kliatby[ja])} · {menoHraca(super_)}: {textKliatob(vybrana.kliatby[super_])} · pečeň +1
                {vybrana.svokra > 0 && <> · Svokra ti ukradne {vybrana.svokra} cig.</>} · v ďalšom kole limit{" "}
                {limitPo === limitBez ? `ostane ${limitBez}` : `${limitPo} namiesto ${limitBez}`} · platí, ak {menoHraca(super_)} neodpovie (v ruke má{" "}
                {view.hraci[super_].rukaPocet} {view.hraci[super_].rukaPocet === 1 ? "kartu" : view.hraci[super_].rukaPocet >= 2 && view.hraci[super_].rukaPocet <= 4 ? "karty" : "kariet"})
              </span>
            </span>
          );
        const naexStred =
          vybranaUid === null || dovodBezNaex !== null ? undefined : (
            <span className="pecat-naex-obal">
              <button className="tlacidlo-naex pecat-naex" data-skratka="n" data-vyucba="tlacidlo:naex" title={`NA EX na ${menoVybranej} — súper smie hneď odpovedať jednou kartou.`} onClick={() => posli({ type: "naex", uid: vybranaUid })}>
                NA EX!
              </button>
              <button className="pecat-zrusit" aria-label="Zrušiť výber" title="Zrušiť výber (aj pravý klik na stôl)" onClick={() => setMode({ typ: "ziadny" })}>
                ✕
              </button>
            </span>
          );
        return {
          nadpis,
          text: krcma ? (
            textVyberu ?? <strong>Krčma: kým máš plný poldeci, musíš dať NA EX — klikni na kartu so značkou.</strong>
          ) : (
            textVyberu ?? (
              <>
                {/* Prepínač je odkaz v texte, nie pečiatka — na hrane by prekryl popis kraja (UX/UI, 1600×1000). */}
                {bezNaex.zapnute ? (
                  <>
                    <strong>Do konca bitky končíš Pitky sám, bez NA EX.</strong>{" "}
                    <button className="auto-hotovo-odkaz" onClick={bezNaex.vypni}>
                      zrušiť
                    </button>{" "}
                  </>
                ) : (
                  <>
                    <button
                      className="auto-hotovo-odkaz"
                      title="Hra za teba v každej ďalšej Pitke tejto bitky ťukne „končím“ — bez NA EX, bez fajčenia. Na súperovo NA EX odpovedáš sám."
                      onClick={bezNaex.zapni}
                    >
                      do konca bitky bez NA EX
                    </button>{" "}
                  </>
                )}
                {kontext}
                {dovodBezNaex !== null ? (
                  <>
                    Fajči, doliať či kúp poldeci — potom končím. <span className="tlmene">{dovodBezNaex}</span>
                  </>
                ) : (
                  <>
                    Klikni na kartu so značkou NA EX, alebo Pitku ukonči.{" "}
                    <span className="tlmene">
                      NA EX sa pri bitke vypije → v ďalšom kole limit {limitPo === limitBez ? `ostane ${limitBez}` : `${limitPo} namiesto ${limitBez}`}.
                    </span>
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
            tlacidla: (
              <>
                <button onClick={() => setVrstva("vestica")}>balíčky</button>
                <button
                  className="tlacidlo-hlavne"
                  disabled={v.moja === null || v.jeho === null}
                  onClick={() => v.moja !== null && v.jeho !== null && posli({ type: "vestica", moja: v.moja, jeho: v.jeho })}
                >
                  vymeniť
                </button>
              </>
            ),
          };
        }
        if (b.krok === "kar") {
          // Kar (roadmapa #80): jednu nepriznanú Cirhózu z ruky smie hráč zahodiť.
          const cirhoza = view.ruka.find((k) => k.defId === "cirhoza");
          return {
            nadpis: "Kar",
            text: "Na Kare smieš zahodiť jednu nepriznanú Cirhózu z ruky — navždy z hry. Súperov Hrobár za ňu dostane cigaretu.",
            tlacidla: (
              <>
                <button onClick={() => posli({ type: "kar", uid: null })}>nechať si ju</button>
                <button className="tlacidlo-hlavne" disabled={cirhoza === undefined} onClick={() => cirhoza !== undefined && posli({ type: "kar", uid: cirhoza.uid })}>
                  zahodiť Cirhózu
                </button>
              </>
            ),
          };
        }
        if (b.krok === "cintorin") {
          // Cintorín (Michal 2026-10-20): porazený dá Nástroj z ruky do Dedičstva zadarmo.
          const nastroje = view.ruka.filter((k) => (data.cards.get(k.defId)?.tags ?? []).includes("Nástroj"));
          return {
            nadpis: "Cintorín",
            text: (
              <span className="zberatel-text">
                <span>
                  {tvar(rodHracaP(ja), "Prehral si na Cintoríne", "Prehrala si na Cintoríne", "Prehra na Cintoríne")}: jeden Nástroj z ruky smieš dať do Dedičstva <strong>zadarmo</strong> (ďalšie Dedičstvo aj tak
                  zdražie pre oboch). Klikni naň, alebo nič.
                </span>
                <span className="zberatel-ponuka">
                  {nastroje.map((k) => (
                    <span key={k.uid}>{karta({ karta: k, sirka: 84, onClick: () => posli({ type: "cintorin", uid: k.uid }) })}</span>
                  ))}
                </span>
              </span>
            ),
            tlacidla: <button onClick={() => posli({ type: "cintorin", uid: null })}>nič</button>,
          };
        }
        if (b.krok === "exekutor") {
          return {
            nadpis: "Exekútor!",
            text: "Odovzdaj jeden Nástroj.",
            tlacidla: (view.volbyExekutor ?? []).map((v, i) => (
              <button key={i} onClick={() => posli({ type: "exekutorTool", defId: v.defId, kde: v.kde })}>
                {menoKarty(v.defId)} <span className="cena">{v.kde}</span>
              </button>
            )),
          };
        }
        if (b.krok === "pohorsenie") {
          return {
            nadpis: (
              <>
                Pohoršenie <small>zostáva {b.pohorsenieZostava[ja]}</small>
              </>
            ),
            text: "Klikni na staršieho — marker sa posunie k súperovi: on dostane priazeň, starší sa začne báť teba (zónové body, cesta k vydeseniu). Pri zamknutom je dôvod.",
          };
        }
        if (b.krok === "prebytok") {
          // Miňištrant (Výhra): víťaza stojí každý posun o 1 viac.
          const cenaPosunu = b.vitaz === ja ? cenaPrebytku({ strany: view.strany } as unknown as GameState, ja) : 1;
          return {
            nadpis: (
              <>
                Prebytok <small>zostáva {b.prebytokZostava}</small>
              </>
            ),
            text: (
              <>
                Klikni na staršieho — marker ide k súperovi (on priazeň, teba sa starší začne báť).{" "}
                {cenaPosunu > 1 ? (
                  <strong>Posun ťa stojí {cenaPosunu} (Miňištrant v tvojej partii).</strong>
                ) : (
                  "Posun stojí 1."
                )}
                {navrhRozdelenia !== null && (
                  <span className="tlmene">
                    {" "}
                    Alebo celý prebytok naraz podľa bodov: {navrhRozdelenia.kroky.map((id) => menoKarty(view.starsi.find((e) => e.elderId === id)?.karta.defId ?? id)).join(", ")}.
                  </span>
                )}
              </>
            ),
            ...(navrhRozdelenia === null
              ? {}
              : {
                  vpravo: (
                    <button className="pecat pecat-koncim" title="Posunie markery podľa návrhu vedľa — ten istý výpočet ako náhľad bodov pri staršom." onClick={() => posli(navrhRozdelenia.prikaz)}>
                      rozdeliť naraz
                    </button>
                  ),
                }),
          };
        }
        if (b.krok === "pohreb") {
          const cirhoza = view.hraci[ja].priznane.find((k) => k.defId === "cirhoza");
          const zrusit = <button onClick={zrus}>zrušiť</button>;
          if (mode.typ === "pohrebSenok") {
            const vzata = zoSenku[0];
            return {
              nadpis: "Pohreb Závislého",
              text:
                vzata === undefined ? (
                  "Za Závislého si smieš vziať jednu kartu zo šenku."
                ) : (
                  <>
                    Berieš <strong>{menoKarty(vzata.defId)}</strong>.
                  </>
                ),
              tlacidla: (
                <>
                  {zrusit}
                  <button onClick={() => setVrstva("senok")}>← späť na šenok</button>
                  <button onClick={() => posli({ type: "pohreb", cirhozaUid: mode.cirhozaUid, kartaUid: mode.kartaUid })}>bez karty zo šenku</button>
                  <button
                    className="tlacidlo-hlavne"
                    data-vyucba="potvrdit"
                    disabled={vzata === undefined}
                    onClick={() =>
                      vzata !== undefined &&
                      posli({ type: "pohreb", cirhozaUid: mode.cirhozaUid, kartaUid: mode.kartaUid, senokUid: vzata.uid })
                    }
                  >
                    potvrdiť
                  </button>
                </>
              ),
            };
          }
          if (mode.typ === "pohrebKarta") {
            return { nadpis: "Pohreb", text: "Klikni na kartu vo svojej partii, ktorú spáliš. Za Závislého si vezmeš kartu zo šenku.", tlacidla: zrusit };
          }
          return {
            nadpis: "Priznaná Cirhóza",
            text: "Pohreb spáli Cirhózu a kartu z tvojej partie; za Závislého si vezmeš kartu zo šenku.",
            tlacidla: (
              <>
                <button onClick={() => posli({ type: "skipPohreb" })}>preskočiť</button>
                <button
                  data-vyucba="pohreb"
                  disabled={cirhoza === undefined}
                  onClick={() => cirhoza !== undefined && setMode({ typ: "pohrebKarta", cirhozaUid: cirhoza.uid })}
                >
                  Pohreb
                </button>
              </>
            ),
          };
        }
        return null;
      }

      default:
        return null;
    }
  })();
  // Kam sa oplatí pozrieť: tlačidlo vrstvy v páse jemne pulzuje.
  const treba: Vrstva | null =
    !somNaTahu || view.koniec !== null
      ? null
      : mode.typ === "pohrebSenok" && zoSenku.length === 0
        ? "senok"
        : view.faza === "volbaCiela" && lokalitaNavrh === null
          ? "lokality"
          : null;

  // ---- starší -------------------------------------------------------------
  // Náhľad posunu (Michal 2026-10-19): komu posun pomôže — body spolu a priazeň.
  const ZONA = ["neutrál", "žltá", "oranžová", "červená"] as const;
  const DO_ZONY = ["neutrálu", "žltej", "oranžovej", "červenej"] as const;
  const popisPosunu = (elder: ElderState, cezPohorsenie: boolean, naKraj = false): string => {
    // Prebytok: aj cigareta porazenému za prvý posun staršieho (§9.4) — nahladPosunuPrebytkom.
    const n = cezPohorsenie ? nahladPosunuMarkera(data, view, elder.elderId, super_, true, naKraj) : nahladPosunuPrebytkom(data, view, elder.elderId);
    const novy = posunMarker(elder, super_, cezPohorsenie, naKraj);
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
        const dalsi = posunMarker({ ...elder, marker: m }, super_, false);
        if (dalsi === null) break;
        m = dalsi;
        if (STUPNICA_ZONY[m] !== STUPNICA_ZONY[novy]) {
          doZony = ` · do ${DO_ZONY[STUPNICA_ZONY[m]]} ešte ${krok} ${krok === 1 ? "krok" : "kroky"}`;
          break;
        }
      }
    }
    // Bez čísel pozícií (Michal 2026-10-22): hráč 2 vidí stupnicu zrkadlovo, „4 → 5“ by mu klamalo.
    return ` · k ${menoHraca(super_)}: ${zonaPred} → ${zonaPo} · body ty ${zn(n.zmena[ja])}, súper ${zn(n.zmena[super_])}${doZony} · ${priazen}`;
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
    const smerKSuperovi = super_;
    if (view.faza === "bitka" && b?.caka === ja) {
      // Zamknuté markery (krajná pozícia, Pohoršenie na krajnú, limit dvoch hraníc zón) sa neponúkajú.
      const naKraj = pohorsenieNaKraj(view, ja);
      if (b.krok === "pohorsenie" && pohorsenieMozne(view, ja, elder)) {
        return { akcia: `posunúť k súperovi${popisPosunu(elder, true, naKraj)}`, klik: () => cmd({ type: "pohorsenie", elderId: elder.elderId }) };
      }
      if (b.krok === "prebytok" && posunMarker(elder, smerKSuperovi, false) !== null) {
        return { akcia: `posunúť marker${popisPosunu(elder, false)}`, klik: () => cmd({ type: "prebytok", elderId: elder.elderId }) };
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
  // Kým beží počítadlo bitky, stôl ukazuje líniu kariet (rozsvecujú sa), nie starších.
  const starsiViditelni =
    tahanie === null && pocitadlo === null && (krokStarsich !== null ? !nahliadnutie : vysledokKroku || pohladStarsich !== null);
  const pohladLinie = pohladStarsich ?? ja;
  // Bodový bar (Michal 2026-10-23): po kliku na Body ukážu oba bary body podľa podmienok;
  // späť sa prepnú spolu so stolom. Podmienka pod myšou zvýrazní starších v línii.
  const bodovyRezim = starsiViditelni && pohladStarsich !== null;
  const [zvyraznenaPodmienka, setZvyraznenaPodmienka] = useState<Podmienka | null>(null);
  useEffect(() => {
    if (!bodovyRezim) setZvyraznenaPodmienka(null);
  }, [bodovyRezim]);
  const zavriStarsich = (): void => {
    setPohladStarsich(null);
    setVysledokKroku(false);
  };
  const prepniStarsich = (p: PlayerId): void => {
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
  const naKrajPohorsenia = pohorsenieNaKraj(view, ja);
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
    if (posunMarker(e, super_, pohorsenie, pohorsenie && naKrajPohorsenia) !== null) return pohorsenie ? "už 2 hranice zón" : undefined;
    if (e.marker === 0 || e.marker === 8) return "už na krajnej pozícii";
    return pohorsenie ? "krajnú pozíciu Pohoršenie nedosiahne" : "na krajnú len z predposlednej od začiatku kola";
  };
  const starsiVLinii: StarsiVLinii[] = view.starsi.map((e) => {
    const klik = klikStarsi(e);
    const obrazok = vzhladKarty(sada, data, e.karta.defId).obrazok;
    const iPatron = view.patronat.findIndex((x) => x?.elderId === e.elderId);
    const pohorsenie = krokStarsich?.typ === "pohorsenie";
    const ciel: MarkerPos | null =
      !krokMoj || krokStarsich === null
        ? null
        : krokStarsich.typ === "patronat"
          ? MARKER_STRED
          : posunMarker(e, super_, pohorsenie, pohorsenie && naKrajPohorsenia);
    return {
      elder: e,
      meno: menoKarty(e.karta.defId),
      obrazok: obrazok === null ? null : mediaUrl(obrazok.nahlad),
      body: body.starsi.find((x) => x.elderId === e.elderId),
      klik,
      ciel,
      dovod: klik === undefined ? zamokStarsieho(e) : undefined,
      hranice: pohorsenie && krokStarsich !== null ? (bs?.pohorsenieHranice[`${krokStarsich.kto}:${e.elderId}`] ?? 0) : undefined,
      patron: iPatron === -1 ? null : { kto: iPatron as PlayerId, pohorsenia: view.patronat[iPatron]?.pohorsenia ?? 0 },
      vybrany: mode.typ === "patronat" && mode.elderId === e.elderId,
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
  const bodovyBar = bodovyRezim
    ? {
        data,
        starsi: view.starsi,
        ikony: sada.ikonyBodovania ?? [],
        menoStarsieho: (e: ElderState) => menoKarty(e.karta.defId),
        zvyraznena: zvyraznenaPodmienka,
        zvyrazni: setZvyraznenaPodmienka,
      }
    : undefined;
  const idLinieStarsich = useId();
  const tlacidloLinieStarsich: ReactNode =
    krokStarsich !== null ? (
      krokMoj ? null : (
        <button type="button" className="ls-tlacidlo" onClick={() => setNahliadnutie(true)} title="Krok nezruší — vráti sa klikom alebo Esc">
          pozrieť stôl
        </button>
      )
    ) : (
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
  const hrozbyBitky = (["su", "ja"] as const).map(textHrozby).filter((h): h is HrozbaBitky => h !== null);
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
          naSekeru: view.naSekeru.map((k) => menoKarty(k.defId)),
          poslednaBitka: view.lokalityVHre.length === 0,
          cenaPosunuVitaza: [
            cenaPrebytku({ strany: view.strany } as unknown as GameState, 0),
            cenaPrebytku({ strany: view.strany } as unknown as GameState, 1),
          ],
          prebytokNaRozdelenie: prebytokNaRozdelenie(view, battleOutcome(b?.damage ?? odhad)),
          skrytaSupera: b?.damage == null && view.zaverecne.some((z) => z.majitel !== ja),
          utocnik: `útočník: ${view.utocnik === ja ? "ty" : menoHraca(view.utocnik)} — ${view.kolo === 1 ? "v 1. kole náhodne" : "porazený z minulej bitky (remíza roly nemení)"}`,
          hrozby: b?.damage != null ? [] : hrozbyBitky,
          ukazHrozbu: setUkazHrozbu,
        };
  // Na počítači je odhad bitky v páse kola jedným riadkom; klik naň prepne ten istý pás
  // na riadok bitky s akciami oboch strán (Michal 2026-10-23, ako bar hráča cez Body).
  // Pás drží výšku, línia sa nepohne. Na mobile leží celý panel pod pásom ako doteraz.
  const [odhadOtvoreny, setOdhadOtvoreny] = useState(false);
  const pasRef = useRef<HTMLDivElement>(null);
  const [vyskaPasu, setVyskaPasu] = useState(0);
  useEffect(() => {
    const el = pasRef.current;
    if (el === null || odhadOtvoreny) return;
    const ro = new ResizeObserver(([z]) => setVyskaPasu(Math.round(z?.borderBoxSize[0]?.blockSize ?? 0)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [odhadOtvoreny, bitkaProps === null]);
  const idOdhadu = useId();
  useEffect(() => {
    if (!odhadOtvoreny) return;
    const klaves = (e: KeyboardEvent): void => {
      if (e.key === "Escape") setOdhadOtvoreny(false);
    };
    window.addEventListener("keydown", klaves);
    return () => window.removeEventListener("keydown", klaves);
  }, [odhadOtvoreny]);
  const bitkaPanel = bitkaProps === null || !mobil ? null : <BitkaPanel {...bitkaProps} />;
  const suhrnBitky =
    bitkaProps === null ? null : <SuhrnBitky {...bitkaProps} otvoreny={odhadOtvoreny} prepni={() => setOdhadOtvoreny((o) => !o)} id={idOdhadu} />;

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

  // ---- draft na stole (Michal 2026-10-16) ----------------------------------
  // Na stole (#67) sa Smetisko a balíček zmestia do jedného radu: 12 miest na šírku;
  // na výšku karty vyplnia vrstvu stola bez réžie panelu (malý notebook, Michal 2026-10-23).
  const radZatial = stavim && view.senok.length > 0 ? 0.7 : 0;
  const miestDraftu = stavim ? 12 : Math.max(6, view.faza === "draft" ? view.senok.length : view.lokalityVHre.length);
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
              potiahni sem kartu
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
              return volimLokalitu
                ? sLupou(props, { obsah: tahatelna(z, karta(props)), zdroj: z, stitok: stitokHodnoty(k) })
                : sLupou(props, { stitok: stitokHodnoty(k) });
            })}
        </div>
        {view.naSekeru.length > 0 && (
          <p className="sekera-pozn">
            <strong>Na sekere:</strong> {view.naSekeru.map((k) => menoKarty(k.defId)).join(", ")} — víťaz tejto bitky si ich vezme spolu s
            lokalitou, o ktorú sa bude biť (ide o {view.naSekeru.length + 1} lokality). Pri remíze v poslednej bitke prepadnú.
          </p>
        )}
        {(view.ovladnute.length > 0 || view.prepadnute.length > 0) && (
          <div className="ovladnute">
            {view.ovladnute.length > 0 && <span className="oblast-nazov">ovládnuté</span>}
            {view.ovladnute.map((o) => (
              <span key={o.karta.uid} className={`cip ${o.hrac === ja ? "moja" : "superova"}`}>
                {menoKarty(o.karta.defId)} · {o.hrac === ja ? "ty" : menoHraca(o.hrac)}
              </span>
            ))}
            {view.prepadnute.length > 0 && <span className="oblast-nazov">prepadli</span>}
            {view.prepadnute.map((k) => (
              <span key={k.uid} className="cip">
                {menoKarty(k.defId)}
              </span>
            ))}
          </div>
        )}
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
          {/* Na stole nadpis aj čo robiť hovorí pilulka — panel má len „potvrdiť“ v rohu, hlavička
              a pätička brali výšku kartám (malý notebook, Michal 2026-10-23). */}
          {somNaTahu && !mobil ? (
            <button className="tlacidlo-hlavne stavba-potvrd" data-skratka="k" disabled={!stavbaHotova} onClick={potvrdStavbu} title={textStavby}>
              potvrdiť
            </button>
          ) : (
            <header className="draft-hlava">
              <strong>Stavba šenku</strong>
              <span>
                {somNaTahu
                  ? `Tvoj balíček: ${kariet(draft.mojBalicek.length)} — vyber ${kariet(krokSt.odhod)} na Smetisko, ${zvysnePojdu(krokSt.doSenku)} do Šenku.`
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
          {somNaTahu && mobil && (
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
    const pravidloBrania =
      "Beriete striedavo, kým obaja neprestanete; kto nemá cigaretu, prestane sám. Pitiek v bitke bude 1 + menší počet aktivovaných akcií lokality z dvoch strán.";
    return (
      <section ref={draftPanelRef} className={`draft-panel branie ${mozemBrat ? "moj-tah" : "cakanie"}`} aria-label="Branie zo šenku">
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
        <div className="harmonika draft-karty branie-karty" data-vyucba="senok">
          {view.senok.length === 0 && <span className="popis">Šenok je prázdny.</span>}
          {view.senok
            .filter((k) => !zoSenku.some((x) => x.uid === k.uid))
            .map((k) => {
              const z: Zdroj = { karta: k, odkial: "senok", navrh: false };
              // Klik vezme kartu do ruky ako návrh (bez ťahania, UX N4) — „hotovo“ ju potvrdí.
              const props = { karta: k, sirka: sirkaDraftu, ...(mozemBrat ? { onClick: () => prepniZoSenku(k.uid) } : {}) };
              return mozemBrat ? sLupou(props, { obsah: tahatelna(z, karta(props)), zdroj: z }) : sLupou(props);
            })}
        </div>
        {/* Na stole leží pätička v riadku hlavičky a vysvetlenie je v nápovede — karty dostanú výšku (malý notebook). */}
        <footer className="draft-paticka" title={pravidloBrania}>
          <span className="tlmene">
            {zoSenku.length === 0
              ? pravidloBrania
              : `Berieš ${zoSenku.map((k) => menoKarty(k.defId)).join(" a ")} za ${cigariet(cena)}.`}
          </span>
          {zoSenku.length > 0 ? (
            <>
              <button onClick={() => setNavrh(null)}>vrátiť</button>
              <button
                className="tlacidlo-hlavne"
                data-skratka="k"
                onClick={() => {
                  const uids = zoSenku.map((k) => k.uid);
                  setNoveZoSenku((n) => ({ kolo: view.kolo, uids: [...(n.kolo === view.kolo ? n.uids : []), ...uids] }));
                  posli({ type: "draftBer", uids });
                }}
              >
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
      </section>
    );
  })();

  // Stôl bez scrollovania (#67): na počítači leží voľba cieľa a draft na stole namiesto
  // prázdnej línie. Lokalita na otočenie a potvrdenie je v línii — vtedy sa vráti línia.
  // ---- dlaždica KARTY ako cieľ priznania a Dedičstva (Michal 2026-10-23, #76) ----
  // Pri ťahaní kliatby sa dlaždica KARTY v tvojom bare zmení na cieľ „Priznať“, pri Nástroji
  // na „Dedičstvo“ s cenou; karta sa pustí na ňu, stôl sa neprepína. Klik na kartu a potom
  // na dlaždicu robí to isté (aj kláves O). Kam karta patrí, určuje jej typ — keď ju tam
  // pravidlá teraz nepustia, dlaždica povie prečo.
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
        lupa: lupa !== null || otvorene(".lupa:not(.doznieva)"),
        dialog: vrstva !== null || skratky.napoveda || otvorene('[role="dialog"]'),
        starsi: starsiViditelni || nahliadnutie,
        vyber: miestoVolby !== null || mode.typ === "naexCiel" || vybranaDoOblasti !== null,
        potvrdenie: potvrdenie !== null,
        odhad: odhadOtvoreny,
        pult: otvorene('.sb-spust[aria-expanded="true"]'),
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
            onKlik: vybranaKarta !== null && smieNaDlazdicu ? () => vylozDoOblasti(cielDlazdice) : undefined,
          },
  });

  const vrstvaFazy: ReactNode = mobil ? null : cielPanel !== null && lokalitaNavrh === null ? cielPanel : draftPanel;
  const liniaSkryta = starsiViditelni || vrstvaFazy !== null;

  // ---- pás kola: koľko Pitiek a koľko kariet kto vykladá -------------------
  // Súhrn starších (Michal 2026-10-22, #55 kus 3): v páse kola, aby na 1366 × 768 bolo vidno viac zo stĺpcov.
  const starsiSuhrn = (
    <span className="pas-starsi">
      <span
        className={`vydeseni-pocet ${vydeseni[super_] >= prahVyd - 1 ? "hrozba" : ""}`}
        title={`Kto vydesí ${prahVyd} starších (krajná červená pozícia) a udrží ich do konca ďalšieho kola, vyhrá.`}
      >
        vydesení <b className="moje">ty {vydeseni[ja]}/{prahVyd}</b> · <b className="superove">{menoHraca(super_)} {vydeseni[super_]}/{prahVyd}</b>
      </span>
    </span>
  );
  const pasKola = ((): ReactNode => {
    if (view.koniec !== null || view.ciel === null) return null;
    if (view.faza !== "zhromazdenie" && view.faza !== "pitka" && view.faza !== "bitka") return null;
    const n = view.pitkyCelkom;
    const aktualna = view.faza === "zhromazdenie" ? view.pitkaCislo + 1 : view.pitkaCislo;
    const zs = view.zhromazdenieStav;
    const start = zs === null ? null : limitNaZaciatku?.kluc === klucZhromazdenia ? limitNaZaciatku.limit : zs.zostavaLimit;
    const sloty = (p: PlayerId): ReactNode => {
      if (zs === null || start === null) return null;
      const spolu = Math.max(start[p], zs.zostavaLimit[p]);
      const zostava = zs.zostavaLimit[p];
      return (
        <span className={`pas-hrac ${p === ja ? "moje" : "superove"}`}>
          <span className="pas-meno">{p === ja ? "ty" : menoHraca(p)}</span>
          <span className="pas-sloty" aria-label={`vyloží ešte ${zostava} z ${spolu}`}>
            {Array.from({ length: spolu }, (_, i) => (
              <span key={i} className={i < spolu - zostava ? "slot pouzity" : "slot"} aria-hidden="true" />
            ))}
          </span>
          <span className="pas-text">
            {zs.pasoval[p]
              ? tvar(rodHracaP(p), "pasoval", "pasovala", "pas")
              : zostava === 0
                ? tvar(rodHracaP(p), "vyložil všetko", "vyložila všetko", "všetko vyložené")
                : `vyloží ešte ${kariet(zostava)}`}
          </span>
        </span>
      );
    };
    // Pitka ako dve stoličky (dizajn UI N2 + UX N1): poradie, kto je na ťahu, kto
    // už skončil a s NA EX či bez — „hotovo“ predtým nezanechalo žiadnu stopu.
    const ps = view.pitkaStav;
    const obranca: PlayerId = view.utocnik === 0 ? 1 : 0;
    const stolicky =
      view.faza === "pitka" && ps !== null && view.vizia === null ? (
        <ol className="pas-stolicky" aria-label="Poradie v Pitke" aria-live="polite">
          {([obranca, view.utocnik] as const).map((p, i) => {
            const odpoveda = ps.reakcia === p;
            const naTahu = ps.naTahu === p && ps.reakcia === null && !ps.hotovy[p];
            const naex = (ps.naexPocet?.[p] ?? 0) > 0;
            const stav = ps.hotovy[p]
              ? `✓ ${tvar(rodHracaP(p), "skončil", "skončila", "koniec")}${naex ? " po NA EX" : " bez NA EX"}`
              : odpoveda
                ? "odpovedá na NA EX"
                : naTahu
                  ? `na ťahu${naex ? " · NA EX dal" : ""}`
                  : `čaká${naex ? " · NA EX dal" : ""}`;
            const posledne = naTahu && ps.hotovy[p === 0 ? 1 : 0];
            return (
              <li
                key={p}
                className={["stolicka", p === ja ? "moja" : "superova", naTahu || odpoveda ? "na-tahu" : "", ps.hotovy[p] ? "hotova" : ""].join(" ")}
              >
                <span className="stolicka-poradie">{i + 1}.</span>
                <span className="stolicka-meno">
                  {p === ja ? "ty" : menoHraca(p)} · {i === 0 ? "obranca, začína" : "útočník"}
                </span>
                <span className="stolicka-stav">{stav}</span>
                {/* Verejné zdroje (návrh 5 A): kto ešte môže dať NA EX a čím odpovedať. */}
                <span className="stolicka-zdroje">
                  {plnePoldeci(view.hraci[p].poldeciPlne)} · {kartyNom(view.hraci[p].rukaPocet)} v ruke
                </span>
                {posledne && <span className="stolicka-posledne">{p === ja ? "posledné slovo máš ty" : "má posledné slovo"}</span>}
              </li>
            );
          })}
        </ol>
      ) : null;
    // Poradie Pitky vopred (návrh 5 A): hráči posledné slovo útočníka cítili ako „stoličku“.
    const poradiePitky =
      view.faza === "zhromazdenie" ? (
        <span className="pas-poradie" title="Pitku začína obranca; keď dá „hotovo“, hrá útočník a má posledné slovo.">
          {obranca === ja ? `v Pitke začínaš ty, posledné slovo má ${menoHraca(super_)}` : `v Pitke začne ${menoHraca(super_)}, posledné slovo máš ty`}
        </span>
      ) : null;
    const limityDalej =
      view.faza === "pitka" && aktualna < n ? (
        <span className="pas-pozn">
          ďalšie Zhromaždenie: ty limit {limitZhromazdenia(view, ja)} · {menoHraca(super_)} limit {limitZhromazdenia(view, super_)}
        </span>
      ) : null;
    return (
      <div className="pas-kola" key={view.kolo}>
        <span
          className="pas-pitky"
          title="Pitiek je 1 + menší z počtov aktivovaných akcií lokality na jej dvoch stranách. Keď sa aktivuje ďalšia na oboch, Pitka pribudne — už začatá neubudne."
        >
          <span className={`pas-pitky-pocet ${n > 1 ? "viac" : ""}`}>
            {view.faza === "bitka" ? `Bitka po ${n} ${n === 1 ? "Pitke" : "Pitkách"}` : view.faza === "pitka" ? `Pitka ${aktualna} z ${n}` : `Zhromaždenie ${aktualna} z ${n}`}
            {view.faza === "zhromazdenie" && <small> · zatiaľ</small>}
          </span>
          <span className="pas-bodky" aria-hidden="true">
            {Array.from({ length: n }, (_, i) => (
              <span key={i} className={i + 1 < aktualna || view.faza === "bitka" ? "bodka hotova" : i + 1 === aktualna ? "bodka teraz" : "bodka"} />
            ))}
          </span>
          {view.faza !== "zhromazdenie" && <span className="pas-pozn">{n === 1 ? "1 Pitka — potom bitka" : `${n} Pitky — po každej ďalšie Zhromaždenie`}</span>}
          {limityDalej}
        </span>
        {stolicky}
        {poradiePitky}
        {stavka !== null && <StavkaBitky stavka={stavka} />}
        {suhrnBitky}
        {view.faza === "zhromazdenie" && (
          <span className="pas-limit">
            {sloty(ja)}
            {sloty(super_)}
          </span>
        )}
        {starsiSuhrn}
      </div>
    );
  })();

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
          <li>
            Tuhé {ucetBitky.tuhe[ja]} : {ucetBitky.tuhe[super_]}
            {ucetBitky.prebytokDrzi !== null &&
              ` · prebytok ${ucetBitky.prebytok}${ucetBitky.prebytokNaRozdelenie < ucetBitky.prebytok ? ` − Puška = ${ucetBitky.prebytokNaRozdelenie}` : ""} → ${ucetBitky.prebytokDrzi === ja ? "ty" : menoHraca(ucetBitky.prebytokDrzi)}`}
          </li>
          {ucetBitky.lokality.length > 0 && (
            <li>
              {ucetBitky.lokality
                .map((l) => (l.ako === "ovladol" ? `${l.meno} → ${l.komu === ja ? "ty" : menoHraca(l.komu ?? super_)}` : l.ako === "sekera" ? `${l.meno} ide na sekeru` : `${l.meno} prepadla`))
                .join(" · ")}
            </li>
          )}
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
          <li>
            Body: ty {ucetBitky.body.pred[ja]} → <b>{ucetBitky.body.po[ja]}</b> · {menoHraca(super_)} {ucetBitky.body.pred[super_]} →{" "}
            <b>{ucetBitky.body.po[super_]}</b>
          </li>
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
  const pokynUdalosti =
    chyba === null && poslednySuperov.length === 0 && textUctuPitky === null ? null : (
      <div className="pokyn-udalosti">
        {chyba !== null && (
          <span className="pokyn-chyba" role="alert">
            ⚠ Ťah neprešiel: {chyba}
            {zrusChybu !== undefined && (
              <button type="button" className="tlacidlo-male" onClick={zrusChybu}>
                OK
              </button>
            )}
          </span>
        )}
        {textUctuPitky !== null && (
          <span className="pokyn-ucet" role="status">
            {textUctuPitky}
          </span>
        )}
        {poslednySuperov.length > 0 && (
          <span className="pokyn-posledny" aria-live="polite">
            ↺ {poslednySuperov.join(" · ")}
          </span>
        )}
      </div>
    );

  // Spodná hrana stola (Michal 2026-10-21): vľavo nákupy za cigarety, v strede
  // NA EX! či potvrdenie návrhu, vpravo koniec ťahu. Udalosti a chyby sú hneď nad ňou.
  const hranaVlavo = pokyn?.vlavo ?? null;
  const hranaStred = stolTlacidla ?? pokyn?.stred ?? null;
  const hranaVpravo =
    pokyn?.tlacidla === undefined && pokyn?.vpravo === undefined ? null : (
      <>
        {pokyn.tlacidla}
        {pokyn.vpravo}
      </>
    );
  const maHranaTlacidla = hranaVlavo !== null || hranaStred !== null || hranaVpravo !== null;
  const hranaStola =
    !maHranaTlacidla && pokynUdalosti === null ? null : (
      // V drafte sa hrana neprilepí nad ruku: stôl leží pod draftom a pri posúvaní
      // by zakrývala karty draftu a pokyn; potvrdenie je aj tak v draft paneli.
      // Ani keď z línie nad rukou nie je nič vidno (liniaVidno).
      <div className={view.faza === "draft" || !liniaVidno ? "stol-hrana neprilepena" : "stol-hrana"}>
        {pokynUdalosti}
        {maHranaTlacidla && (
          <div className="hrana-rad">
            <div className="hrana-vlavo">{hranaVlavo}</div>
            <div className="hrana-stred">{hranaStred}</div>
            <div className="hrana-vpravo">{hranaVpravo}</div>
          </div>
        )}
      </div>
    );

  return (
    <div
      className={stolScroll ? "hra stol-scroll" : "hra"}
      style={{ "--ruka-w": `${sirkaVRuke}px`, "--hlavicka-h": `${vyskaHlavicky}px` } as CSSProperties}
    >
      {/* V prehrávači výsledok ukáže detail partie — okno konca s hodnotením a lobby tam nepatrí. */}
      {view.koniec !== null && !koniecZavrety && prehravanie === undefined && bezOknaKonca !== true && (
        <KoniecHry
          rodJa={rodHracaP(ja)}
          rody={[rodHracaP(0), rodHracaP(1)]}
          view={view}
          data={data}
          mena={[menoHraca(0), menoHraca(1)]}
          menoKarty={menoKarty}
          frajerina={frajerina}
          achievementy={achievementy ?? null}
          onZavri={() => setKoniecZavrety(true)}
          opustit={opustit}
        />
      )}
      <header className="hra-hlava">
        {/* Kód miestnosti je v hlavičke webu (blok partie, Michal 2026-10-23); v prehrávači ostáva číslo partie tu. */}
        {prehravanie !== undefined && (
          <span className="kod" title="číslo partie v archíve">
            {kod}
          </span>
        )}
        <PriebehKola view={view} onBitka={ucetBitky !== null && view.kolo === ucetBitky.kolo + 1 ? () => setUcetBitkyZavrety(false) : undefined} />
        {/* Šenok, Lokality a Log sú v osi kola (Michal 2026-10-21) — ovládanie partie je v hlavičke webu. */}
        <div className="hlava-vrstvy">
          {(["senok", "lokality", "log"] as const).map((v) => {
            const pocet = v === "senok" ? view.senok.length : v === "lokality" ? view.lokalityVHre.length : log.length - videnyLog;
            // Kartu zo šenku či lokalitu vrátiš pustením na jej tlačidlo.
            const ciel = v === "log" ? null : v;
            return (
              <button
                key={v}
                className={[
                  "hlava-vrstva",
                  vrstva === v ? "otvorena" : "",
                  treba === v && vrstva !== v ? "treba" : "",
                  ciel !== null && jeCiel(ciel) ? "ciel-zona" : "",
                  ciel !== null && nadCielom(ciel) ? "nad-cielom" : "",
                ].join(" ")}
                data-ciel={ciel !== null && jeCiel(ciel) ? ciel : undefined}
                data-vyucba={`hlavicka:${v}`}
                onClick={() => setVrstva(vrstva === v ? null : v)}
              >
                {v === "senok" ? "Šenok" : v === "lokality" ? "Lokality" : "Log"}
                {(v !== "log" || pocet > 0) && <span className={v === "log" ? "pocet nove" : "pocet"}>{pocet}</span>}
              </button>
            );
          })}
          {useUcet().ja?.skratky !== false && (
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
        {skratky.napoveda && <SkratkyNapoveda onZavri={skratky.zavriNapovedu} />}
      </header>
      {slotHlavicky !== null &&
        createPortal(
          <div className="hlavicka-partia">
            {prehravanie ?? (
              <>
            {/* Blok partie (Michal 2026-10-23, hlavička B): kód miestnosti, súper, Melichar, vzdať sa, odísť. */}
            <span className="partia-kod" title="Kód miestnosti — vrátiš sa ním do partie alebo ho pošli súperovi">
              {kod}
            </span>
            <span className={`partia-super ${superPripojeny ? "online" : "offline"}`}>
              <span className="spojenie" title={menoHraca(super_)}>{superPripojeny ? `● ${menoHraca(super_)}` : `○ ${menoHraca(super_)} odpojený`}</span>
              {/* Kontumácia patrí k stavu „odpojený“, ktorý ju umožňuje (dizajn UI N1). */}
              {view.koniec === null && !superPripojeny && kontumacia !== undefined && (
                <button
                  className="opustit tlacidlo-male"
                  onClick={kontumacia}
                  title="Súper je odpojený. Po 3 minútach si môžeš vyžiadať kontumačnú výhru."
                >
                  kontumačná výhra
                </button>
              )}
            </span>
            {vHlavicke}
            {view.koniec === null && (
              <button
                className={`opustit tlacidlo-male tlacidlo-nebezpecne ${potvrdVzdanie ? "potvrdit" : ""}`}
                onClick={() => {
                  if (!potvrdVzdanie) {
                    setPotvrdVzdanie(true);
                    return;
                  }
                  setPotvrdVzdanie(false);
                  cmd({ type: "vzdat" });
                }}
                title="Partia sa skončí tvojou prehrou a započíta sa do Frajeriny."
              >
                {potvrdVzdanie ? "naozaj sa vzdať?" : "vzdať sa"}
              </button>
            )}
            <button
              className="opustit tlacidlo-male tlacidlo-jemne"
              onClick={opustit}
              title={view.koniec === null ? "Partia beží ďalej — vrátiš sa do nej kódom miestnosti." : undefined}
            >
              {view.koniec === null ? "odísť" : "opustiť hru"}
            </button>
              </>
            )}
          </div>,
          slotHlavicky,
        )}

      <div className="plocha">
        {/* Súperi sedia oproti sebe (Michal 2026-10-22): súperov bar hore, tvoj pod stolom;
            scoreboard nad staršími zanikol — body sú v bare hráča. */}
        <HracDoska
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
          karty={kartyDlazdica(super_)}
          bodovy={bodovyBar}
        />
        {/* Starší hore — mimo dosahu ruky, aby sa ich lupa nebila s lupou kariet v ruke. */}
        <div className="stred">
          {/* Stôl je hneď pod staršími — pás pokynov a ruka ho neprekryjú
              (playtest 20261012-055944); dosky hráčov sú pod ním. */}
          {hrozbaVydesenia}
          {ucetBitkyEl}
          {/* Na počítači ležia voľba cieľa a draft na stole (vrstvaFazy) — línia je vtedy prázdna. */}
          {mobil && cielPanel}
          {mobil && draftPanel}
          <div
            className="pas-kola-obal"
            id={idOdhadu}
            ref={pasRef}
            // Pod NOTEBOOK pás nemá výšku dvoch riadkov — riadok bitky s hrozbou by sa doň nezmestil.
            style={odhadOtvoreny && vyskaPasu > 0 && vyskaOkna >= NOTEBOOK ? { height: vyskaPasu } : undefined}
          >
            {odhadOtvoreny && bitkaProps !== null && !mobil ? <BitkaPanel {...bitkaProps} stred={suhrnBitky} /> : pasKola}
          </div>
          {bitkaPanel}
          {/* Starší sú na stole po kliku na Body (#68) — nad stolom ostáva len ich súhrn. */}
          {pasKola === null && <div className="starsi-info-samostatne">{starsiSuhrn}</div>}
          {/* Farba stola hovorí, čí je ťah: zelená = tvoj, sivá = čakáš. */}
          <div
            ref={liniaObalRef}
            className={`linia-obal ${view.koniec !== null ? "koniec" : somNaTahu ? "moj-tah" : "cakanie"}${hranaStola !== null ? " s-hranou" : ""}`}
            onContextMenu={pravyKlik(zrusVyberNaStole)}
          >
            {/* Pokyn je pilulka na hornej hrane stola (Michal 2026-10-21) — predtým pás nad rukou. */}
            {/* tabIndex: pokyn skrátený na jeden riadok sa rozbalí aj z klávesnice (fokus). */}
            <div className="linia-stav" role="status" aria-live="polite" tabIndex={0}>
              <strong className="pilulka-nadpis">
                {pokyn?.nadpis ?? (view.koniec !== null ? "Koniec hry" : somNaTahu ? "Tvoj ťah" : `Na ťahu je ${menoHraca(super_)}`)}
              </strong>
              {pokyn?.text !== undefined && <span className="pilulka-text">{pokyn.text}</span>}
            </div>
            {toastPriazneEl}
            <div className={`stol-plst${liniaSkryta ? " linia-skryta" : ""}${starsiViditelni && krokStarsich !== null ? " krok-starsich" : ""}`} ref={plstRef}>
            {/* Línia kariet ostáva v DOM a drží výšku stola — línia starších leží nad ňou (#68). */}
            <div className="linia harmonika-skupiny" ref={liniaRef} inert={liniaSkryta} aria-hidden={liniaSkryta || undefined} data-vyucba="linia">
              <div className="linia-skupina moja">
                {popisKraja(ja, "vlavo")}
                <div className="partia-rad harmonika">{radStrany(ja)}</div>
              </div>
              <div className="linia-skupina lokalita" ref={lokalitaRef}>
                <span
                  className="partia-popis"
                  title={
                    stranyStredu === null || krajStrany(ja) === null || krajStrany(super_) === null
                      ? undefined
                      : `Hrana k tebe: ${krajStrany(ja)} · hrana k súperovi: ${krajStrany(super_)}`
                  }
                >
                  {lokalita !== null || lokalitaNavrh !== null ? "lokalita" : "cieľ kola"}
                </span>
                <div className="partia-rad harmonika">{stredLinie}</div>
                {popisStranStredu}
                {lokalitaNavrh !== null && tahanie === null && (
                  <span className="otocit-tip" data-vyucba="otocenie">
                    klik = otočiť
                  </span>
                )}
              </div>
              <div className="linia-skupina superova">
                {popisKraja(super_, "vpravo")}
                <div className="partia-rad harmonika">{radStrany(super_)}</div>
              </div>
            </div>
            {vrstvaFazy !== null && !starsiViditelni && (
              <div className="vrstva-fazy" ref={setVrstvaFazyEl}>
                {vrstvaFazy}
              </div>
            )}
            <div className="vrstva-starsich" id={idLinieStarsich} hidden={!starsiViditelni} data-vyucba="linia-starsich">
              {starsiViditelni && (
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
                  hraniceZon={krokMoj && krokStarsich?.typ === "pohorsenie" && !pohorsenieBezLimitu(view)}
                  zmenene={zmeneniStarsi}
                  tlacidlo={tlacidloLinieStarsich}
                  zvyraznena={zvyraznenaPodmienka}
                  lupa={(s) => lupyStarsich.get(s.elder.elderId) ?? {}}
                />
              )}
            </div>
            {nahliadnutie && krokStarsich !== null && (
              <button type="button" className="ls-tlacidlo stol-navrat" onClick={() => setNahliadnutie(false)}>
                ← späť na starších · {krokStarsich.nazov} <kbd>Esc</kbd>
              </button>
            )}
            </div>
            {hranaStola}
          </div>

          <HracDoska
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
            starsi={{ stlacene: starsiViditelni && krokStarsich === null && pohladLinie === ja, prepni: () => prepniStarsich(ja), id: idLinieStarsich }}
            karty={kartyDlazdica(ja)}
            bodovy={bodovyBar}
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
            {view.senok.length === 0 && <span className="popis">Šenok je prázdny.</span>}
            {view.senok.map((k) => {
              const z: Zdroj = { karta: k, odkial: "senok", navrh: false };
              const vybrana = zoSenku.some((x) => x.uid === k.uid);
              const props = {
                karta: k,
                sirka: SIRKA_VO_VRSTVE,
                vybrana,
                onClick:
                  mode.typ === "starosta" && mode.rukaUid !== null
                    ? () => posli({ type: "starosta", rukaUid: mode.rukaUid as number, senokUid: k.uid })
                    : zoSenkuLimit > 0
                      ? () => prepniZoSenku(k.uid)
                      : undefined,
              };
              return sLupou(props, {
                obsah: vybrana ? karta(props) : tahatelna(z, karta(props)),
                zdroj: z,
                odstran: vybrana ? () => prepniZoSenku(k.uid) : undefined,
              });
            })}
          </div>
        </VrstvaPanel>
      )}

      {vrstva === "lokality" && (
        <VrstvaPanel
          nazov={`Lokality v hre · ${view.lokalityVHre.length}`}
          pozn={volimLokalitu ? "klikni na lokalitu, o ktorú sa chceš biť" : undefined}
          skryta={tahanie !== null}
          onZavri={() => setVrstva(null)}
          paticka={
            volimLokalitu ? (
              <>
                <span className="vrstva-paticka-text">
                  {vybranaLokalita !== undefined ? (
                    <>
                      <strong>{menoKarty(vybranaLokalita.defId)}</strong> — na stole ju ešte môžeš otočiť.
                    </>
                  ) : (
                    "Klikni na lokalitu, o ktorú sa chceš biť."
                  )}
                </span>
                <button className="tlacidlo-hlavne" disabled={vybranaLokalita === undefined} onClick={umiestniLokalitu}>
                  umiestniť na stôl
                </button>
              </>
            ) : undefined
          }
        >
          <div className="vrstva-karty harmonika">
            {view.lokalityVHre.length === 0 && <span className="popis">Žiadne lokality v hre.</span>}
            {view.lokalityVHre
              .filter((k) => k.uid !== lokalitaNavrh?.karta.uid)
              .map((k) => {
                const z: Zdroj = { karta: k, odkial: "lokality", navrh: false };
                const props = {
                  karta: k,
                  sirka: SIRKA_VO_VRSTVE,
                  vybrana: vyberLokality === k.uid,
                  onClick: volimLokalitu ? () => setVyberLokality(vyberLokality === k.uid ? null : k.uid) : undefined,
                };
                return sLupou(props, {
                  obsah: tahatelna(z, karta(props)),
                  zdroj: z,
                  odstran: vyberLokality === k.uid ? () => setVyberLokality(null) : undefined,
                  stitok: stitokHodnoty(k),
                });
              })}
          </div>
          {view.naSekeru.length > 0 && (
            <div className="ovladnute">
              <span className="oblast-nazov">na sekere (berie ich víťaz najbližšej bitky)</span>
              {view.naSekeru.map((k) => (
                <span key={k.uid} className="cip sekera">
                  {menoKarty(k.defId)}
                </span>
              ))}
            </div>
          )}
          {view.prepadnute.length > 0 && (
            <div className="ovladnute">
              <span className="oblast-nazov">prepadli (nikto ich nevyhral)</span>
              {view.prepadnute.map((k) => (
                <span key={k.uid} className="cip">
                  {menoKarty(k.defId)}
                </span>
              ))}
            </div>
          )}
          {view.ovladnute.length > 0 && (
            <div className="ovladnute">
              <span className="oblast-nazov">ovládnuté</span>
              {view.ovladnute.map((o) => (
                <span key={o.karta.uid} className={`cip ${o.hrac === ja ? "moja" : "superova"}`}>
                  {menoKarty(o.karta.defId)} · {o.hrac === ja ? "ty" : menoHraca(o.hrac)}
                </span>
              ))}
            </div>
          )}
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
                  <p className="popis balicek-prehra">
                    Prehrávaš, keď ti v balíčku, odhodených a v ruke spolu ostane menej ako {KONSTANTY.MIN_VELKOST_BALICKA} kariet —
                    teraz ich máš {hJa.doberaciPocet + hJa.odhadzovaci.length + view.ruka.length}.
                  </p>
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
              // Starosta: karta v ruke sa vyberá klikom.
              const vybrana = mode.typ === "starosta" && mode.rukaUid === k.uid;
              // Vybrané miesto na stole: karta, ktorá tam smie, sa tam klikom položí.
              const naMiesto = vybraneMiesto?.karty.get(k.uid);
              const onClick =
                mode.typ === "starosta"
                  ? () => setMode({ typ: "starosta", rukaUid: k.uid })
                  : naMiesto !== undefined
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
                  {karta({ karta: k, sirka: sirkaVRuke, vybrana: vybrana || vybranaDoOblasti === k.uid, onClick, hranaVnutorna: strana, spoj })}
                  {nova && <span className="nova-stitok">zo šenku</span>}
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
                vybrana
                  ? () => setMode({ typ: "starosta", rukaUid: null })
                  : vybraneMiesto !== undefined
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

      {pocitadlo !== null &&
        (() => {
          // Línia z okamihu bitky, ako na stole: tvoja strana od lokality doľava, súperova doprava.
          const { stol, linia } = pocitadlo;
          const lok = stol.ciel?.lokalita ?? null;
          const poradie = [
            ...[...stol.strany[ja]].reverse(),
            ...(lok === null ? [] : [{ card: lok, playedBy: null }]),
            ...stol.strany[super_],
          ];
          const sirka = Math.max(56, Math.min(110, Math.floor((window.innerWidth - 120) / Math.max(1, poradie.length))));
          const rad = poradie.map((pl) => ({
            uid: pl.card.uid,
            karta: karta({
              karta: pl.card,
              sirka,
              otocena: pl.playedBy === null ? stol.lokalitaOtocena !== (ja === 1) : pl.playedBy !== ja,
              eval: linia.cards.get(pl.card.uid) ?? null,
              bezPopisov: true,
            }),
          }));
          return <PocitadloBitky p={pocitadlo.p} ja={ja} mena={[menoHraca(0), menoHraca(1)]} menoKarty={menoKarty} rad={rad} onKoniec={koniecPocitadla} />;
        })()}

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

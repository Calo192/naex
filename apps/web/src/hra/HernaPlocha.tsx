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
  useEffect,
  useId,
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
  PlacedCard,
  PlayerId,
  VerejnyStav,
} from "@naex/core";
import {
  KONSTANTY,
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
import type { ActionSums, GameState, KliatbyNahladu, NahladVylozenia, PolozkaVykladania, Rod, Slot, StranaLinie } from "@naex/core";
import { IkonaAkcie } from "../karta/IkonaAkcie.tsx";
import { KoniecHry } from "./KoniecHry.tsx";
import { KrcmovyUcet } from "./KrcmovyUcet.tsx";
import { SkratkyNapoveda, useSkratky } from "./skratky.tsx";
import type { Sada } from "@naex/tvorba";
import { HernaKarta, vzhladKarty, type HernaKartaProps } from "./HernaKarta.tsx";
import { SpojeLinie } from "./SpojeLinie.tsx";
import { Lupa, maxMierkaLupy } from "./Lupa.tsx";
import { LUPA_PREDVOLENA, useUcet } from "../lib/ucet.tsx";
import { Vrstva as VrstvaPanel } from "./Vrstva.tsx";
import { BitkaPanel, CenaCigariet, HracDoska, IkonaCigareta, IkonaPoldeci, PriebehKola, type VyhladPitky } from "./Panely.tsx";
import { RozpisBodov } from "./RozpisBodov.tsx";
import { StavkaBitky } from "./StavkaBitky.tsx";
import { DlazdicaStarsieho, Scorecard, StavStarsieho, UCINOK_PRIAZNE, pomerScorecardu } from "./Scorecard.tsx";
import type { HracInfo, ZmenyFrajeriny } from "./useHra.ts";
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
  // Draft aj Liečba: karty zo šenku presunuté do ruky.
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
type Vrstva = "senok" | "lokality" | "log" | "vestica" | "odhodene";

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
/** Partia je stredobod hry — karty 1,5× väčšie než pôvodných 132 px. */
const SIRKA_V_LINII = 198;
/** Dlhá línia sa zmenší na šírku stola, ale nie pod túto šírku karty. */
const SIRKA_V_LINII_MIN = 96;
/** Miesto na klik na konci strany — zlomok šírky karty v línii. */
const MIESTO_VOLBY = 0.42;
/** Karty v šenku a lokalitách — väčšie než kedysi v bočnom paneli. */
const SIRKA_VO_VRSTVE = 150;
/** Scorecardy starších nad stolom; výška vyplýva z pomeru strán. */
const MEDZERA_SCORECARDOV = 10;
/** Najväčšia šírka scorecardu — starší sú hore a nesmú odtlačiť stôl pod ruku; detail ukáže lupa. */
// Michal 2026-10-18: na širokej obrazovke boli starší malí a ďaleko od seba.
const SIRKA_SCORECARDU_MAX = 240;
/** Zbalený rad starších — stupnica s markerom ostáva čitateľná, detail ukáže lupa. */
const SIRKA_SCORECARDU_MALA = 96;
const KLUC_MALI_STARSI = "naex.malyStarsi";
/** Pod touto šírkou riadku sa scorecardy zalomia na dva rady po štyroch. */
const SIRKA_PRE_JEDEN_RAD = 1000;
/** V lupe má scorecard zhruba túto šírku (px), nech je okno akékoľvek. */
const SIRKA_SCORECARDU_V_LUPE = 460;
/** Šírka dlaždice staršieho po boku stola (CSS .stlpec-starsich). */
const SIRKA_DLAZDICE_STARSIEHO = 176;

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
  | { typ: "liecbaZavisly"; cirhozaUid: number }
  | { typ: "liecbaSenok"; cirhozaUid: number; zavislyUid: number }
  | { typ: "pohrebKarta"; cirhozaUid: number }
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
  readonly kontumacia?: () => void;
  /** Ovládanie navyše v hlavičke webu pred menom súpera (soundboard Melichara). */
  readonly vHlavicke?: ReactNode;
  /** Prehrávač dohratej partie (roadmapa #18): ovládanie krokov nahradí v hlavičke spojenie, vzdanie a odchod. */
  readonly prehravanie?: ReactNode;
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
  kontumacia,
  vHlavicke,
  prehravanie,
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
  /** Meno staršieho (karty na ukazovateli) — rozpis bodov v bare hráča. */
  const menoStarsieho = (id: string): string => {
    const e = view.starsi.find((x) => x.elderId === id);
    return e === undefined ? id : menoKarty(e.karta.defId);
  };
  const [akoBodovanie, setAkoBodovanie] = useState(false);
  // Šírka okna — na mobile menšia ruka a predvolene zbalení starší.
  const [sirkaOkna, setSirkaOkna] = useState(() => (typeof window === "undefined" ? 1600 : window.innerWidth));
  useEffect(() => {
    const zmena = (): void => setSirkaOkna(window.innerWidth);
    window.addEventListener("resize", zmena);
    return () => window.removeEventListener("resize", zmena);
  }, []);
  const mobil = sirkaOkna < MOBIL;
  // Dotyková obrazovka bez myši — kartu v ruke zväčší ťuknutie (hover tam nie je).
  const jeDotyk = useMemo(() => typeof window !== "undefined" && window.matchMedia?.("(hover: none)").matches === true, []);
  const sirkaVRuke = mobil ? SIRKA_V_RUKE_MOBIL : SIRKA_V_RUKE;
  // Hráč si môže rad starších zmenšiť, aby mal stôl vyššie (zapamätá sa v prehliadači).
  const [maliStarsi, setMaliStarsi] = useState(() => {
    try {
      const ulozene = localStorage.getItem(KLUC_MALI_STARSI);
      if (ulozene !== null) return ulozene === "1";
    } catch {
      // bez úložiska rozhodne šírka okna
    }
    return typeof window !== "undefined" && window.innerWidth < MOBIL;
  });
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
  // Ovládanie partie (spojenie, kontumácia, vzdať sa, odísť) je v hlavičke webu — Layout má preň miesto.
  const [slotHlavicky, setSlotHlavicky] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setSlotHlavicky(document.getElementById("hlavicka-hra"));
  }, []);
  const prepniMalychStarsich = (): void => {
    setMaliStarsi((m) => {
      try {
        localStorage.setItem(KLUC_MALI_STARSI, m ? "0" : "1");
      } catch {
        // bez úložiska sa voľba len nezapamätá
      }
      return !m;
    });
  };
  const liniaRef = useRef<HTMLDivElement>(null);
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
  // Šírka scorecardu sa ráta z dostupnej šírky riadku — karta staršieho
  // v rámčeku potrebuje rozmer v px, CSS percentá tu nestačia.
  const scorecardyRef = useRef<HTMLDivElement>(null);
  const [sirkaRadu, setSirkaRadu] = useState(0);
  useEffect(() => {
    const el = scorecardyRef.current;
    if (el === null) return;
    const ro = new ResizeObserver(([z]) => setSirkaRadu(Math.floor(z?.contentRect.width ?? 0)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const vRade = sirkaRadu >= SIRKA_PRE_JEDEN_RAD ? 8 : 4;
  const minScorecardu = maliStarsi ? SIRKA_SCORECARDU_MALA : 120;
  const sirkaScorecardu = Math.min(maliStarsi ? SIRKA_SCORECARDU_MALA : SIRKA_SCORECARDU_MAX, Math.max(minScorecardu, Math.floor((sirkaRadu - (vRade - 1) * MEDZERA_SCORECARDOV) / vRade)));
  // Zväčšenie karty (lupa a ruka) podľa nastavenia v profile.
  const mierkaLupy = (useUcet().ja?.lupa ?? LUPA_PREDVOLENA) / 100;
  // Zobrazenie skóre (preferencia v profile, Michal 2026-10-22): dlaždice v bare, alebo krčmový účet cez starších.
  const zobrazenieSkore = useUcet().ja?.skore ?? "dlazdice";
  // Klávesové skratky v partii (Michal 2026-10-22, roadmapa #19) — vypínač v profile.
  const skratky = useSkratky(useUcet().ja?.skratky !== false && view.koniec === null);
  // Poloha účtu vo viditeľnej časti okna (Michal 2026-10-22: klik na Body pri mojom bare
  // otvoril účet hore pod súperovým barom, mimo obrazovky) — pod osou kola, nad tlačidlami kroku a rukou.
  const [ucetPoloha, setUcetPoloha] = useState<{ readonly top: number; readonly maxH: number } | null>(null);
  const ucetOtvoreny = ucetPoloha !== null;
  const setUcetOtvoreny = (o: boolean): void => setUcetPoloha(o ? polohaUcetu() : null);
  const polohaUcetu = (): { readonly top: number; readonly maxH: number } => {
    const hlava = document.querySelector(".hra-hlava")?.getBoundingClientRect().bottom ?? 0;
    const ruka = document.querySelector(".ruka")?.getBoundingClientRect().top ?? window.innerHeight;
    const hrana = document.querySelector(".stol-hrana .hrana-rad")?.getBoundingClientRect();
    // Tlačidlá kroku nad rukou nesmie prekryť; keď sú vyššie, než sa účet zmestí, berie sa len ruka.
    let dole = ruka - 8;
    if (hrana !== undefined && hrana.height > 0 && hrana.top > hlava + 260 && hrana.top < dole) dole = hrana.top - 8;
    const top = Math.max(8, hlava + 8);
    return { top, maxH: Math.max(200, dole - top) };
  };
  const idUcetu = useId();
  useEffect(() => {
    if (!ucetOtvoreny) return;
    const klaves = (e: KeyboardEvent): void => {
      if (e.key === "Escape") setUcetPoloha(null);
    };
    window.addEventListener("keydown", klaves);
    return () => window.removeEventListener("keydown", klaves);
  }, [ucetOtvoreny]);
  const ucetBaru =
    zobrazenieSkore === "dlazdice" ? undefined : { otvoreny: ucetOtvoreny, prepni: () => setUcetOtvoreny(!ucetOtvoreny), id: idUcetu };
  const mierkaLupyScorecardu = Math.max(1.6, SIRKA_SCORECARDU_V_LUPE / sirkaScorecardu);
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
  // Kladiem kartu z ruky do línie: v Zhromaždení (kým nepasujem) alebo v odpovedi na NA EX.
  const vykladam =
    somNaTahu &&
    view.koniec === null &&
    ((view.faza === "zhromazdenie" && view.zhromazdenieStav !== null && !view.zhromazdenieStav.pasoval[ja]) ||
      (view.faza === "pitka" && view.pitkaStav?.reakcia === ja));
  // +2: karta v strede a voľné miesto na koniec strany pri vykladaní;
  // pri vykladaní ležia na oboch koncoch úzke miesta na klik (MIESTO_VOLBY).
  const sirkaVLinii =
    sirkaLinie === 0
      ? SIRKA_V_LINII
      : Math.max(
          SIRKA_V_LINII_MIN,
          Math.min(SIRKA_V_LINII, Math.floor((sirkaLinie - 60) / (pocetVLinii + 2 + (vykladam ? 2 * MIESTO_VOLBY : 0))) - 12),
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
  const vylozenia: readonly PolozkaVykladania[] = (() => {
    if (navrh?.typ !== "vylozenia" || !somNaTahu || !(view.faza === "zhromazdenie" || reagujem)) return [];
    return navrh.polozky.flatMap((x) => {
      const k = view.ruka.find((r) => r.uid === x.uid);
      return k === undefined ? [] : [{ karta: k, ciel: x.ciel }];
    });
  })();
  /** Posledná navrhnutá karta (v odpovedi na NA EX jediná). */
  const vylozene: PolozkaVykladania | null = vylozenia[vylozenia.length - 1] ?? null;
  // Celý ťah v Zhromaždení naraz: koľko poldeci stojí a či ho pravidlá pustia —
  // rovnaký výpočet, aký server urobí s príkazom „tah“.
  const zostavaTeraz = view.zhromazdenieStav?.zostavaLimit[ja] ?? 0;
  const planTahu = (polozky: readonly PolozkaVykladania[]) => planVykladania(data, view, ja, zostavaTeraz, polozky);
  const plan = view.faza === "zhromazdenie" ? planTahu(vylozenia) : null;
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
  const zoSenkuLimit = somNaTahu && mode.typ === "liecbaSenok" ? 1 : kolkoMozemBrat;
  // Keď hráč má vyberať karty zo šenku (Liečba) či Vešticu, vrstva sa otvorí
  // sama. Raz za fázu — ak ju zavrie, znova sa nevnucuje. Cieľ kola sa vyberá
  // na stole (Michal 2026-10-19), nie vo vrstve.
  const chceVrstvu: Vrstva | null = !somNaTahu || view.koniec !== null
    ? null
    : view.volbaVestica !== null
        ? "vestica"
    : mode.typ === "liecbaSenok"
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
  const { stol, lineEval, odhad, rozpis } = useMemo(() => {
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
    return { stol, lineEval, odhad, rozpis };
    // vylozene a lokalitaNavrh sú odvodené len z navrh a view.
  }, [data, view, navrh, somNaTahu]);

  // NA EX na Občana alebo Starešinu v línii — vlastného aj súperovho (Michal 2026-10-18).
  const naexCiele = useMemo(() => new Set(naexCieleVLinii(data, view.strany, ja)), [data, view.strany, ja]);

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
    const out = new Map<StranaLinie, { readonly karty: ReadonlyMap<number, NahladVylozenia>; readonly dovod: string | null }>();
    if (!vykladam) return out;
    const volne = ruka.filter((k) => !vylozenia.some((x) => x.karta.uid === k.uid));
    for (const c of ["vlastna", "superova"] as const) {
      const karty = new Map<number, NahladVylozenia>();
      let dovod: string | null = null;
      for (const k of volne) {
        // Odpoveď na NA EX je jediná karta — nová nahradí navrhnutú, ráta sa teda bez nej.
        const chyba = reagujem
          ? cieleVykladania(data, view.strany, ja, k, Number.POSITIVE_INFINITY, true, cielLokalitaId(view)).includes(c)
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
  useEffect(() => {
    for (const e of udalosti?.events ?? []) {
      if (e.type === "pitkaVysledok") setUcetPitky({ kolo: view.kolo, pitka: e.pitka, cirhozy: e.cirhozy, dlhy: e.dlhy, cigarety: e.cigarety });
      if (e.type === "bitkaVysledok") vysledokBitky.current = e;
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
  const starsiPanelRef = useRef<HTMLElement>(null);
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
      for (const c of cieleVykladania(data, view.strany, ja, z.karta, Number.POSITIVE_INFINITY, true, cielLokalitaId(view))) {
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

  const pusti = (z: Zdroj, ciel: string | null): void => {
    // Karta ťahaná zo zväčšenej kópie — lupa by po pustení visela na starom mieste.
    setLupa(null);
    setMiestoVolby(null);
    // Mimo povoleného miesta sa karta vráti tam, kde bola.
    if (ciel === null || !cieleZdroja(z).has(ciel)) return;
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

  const { tahanie, zacni, duchRef } = useTahanie(pusti);

  // ---- lupa nad kartami na stole a vo vrstvách ----------------------------
  // Michal 2026-10-22: karta sa zväčší pri prejdení myšou (predtým klikom) a susedia
  // v tom istom rade uhnú do strán ako v ruke (harmonika v hra.css). Klik ostáva
  // herným akciám — lupa leží nad kartou a klik na ňu urobí to isté ako na kartu.
  // zFokusu: lupu otvoril fokus z klávesnice, zavrie ju jeho strata.
  const [lupa, setLupa] = useState<{ readonly kluc: string; readonly rect: DOMRect; readonly zFokusu?: boolean } | null>(null);
  // Čo je pod lupou v tomto prekreslení — lupa kreslí vždy živý stav.
  const lupaKarty = new Map<
    string,
    {
      readonly render: (sirka: number) => ReactNode;
      readonly mierka?: number;
      readonly zdroj?: Zdroj;
      readonly odstran?: (() => void) | undefined;
    }
  >();
  /** Zväčší kartu pod prvkom `el` (myš, fokus, na dotyku ťuknutie). */
  const otvorLupu = (kluc: string, el: Element | null | undefined, zFokusu = false): void => {
    if (tahanie === null && el != null) setLupa({ kluc, rect: el.getBoundingClientRect(), zFokusu });
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
    const dalsia = kde === undefined || tahanie !== null ? null : lupaPodMysou(kde.x, kde.y, lupa?.kluc ?? null);
    setLupa(dalsia);
  };
  const lupaPodMysou = (x: number, y: number, terajsia: string | null): { readonly kluc: string; readonly rect: DOMRect } | null => {
    const el = document
      .elementsFromPoint(x, y)
      .find(
        (e): e is HTMLElement =>
          e instanceof HTMLElement &&
          e.dataset.lupa !== undefined &&
          e.dataset.lupa !== terajsia &&
          lupaKarty.has(e.dataset.lupa) &&
          e.closest(".lupa") === null,
      );
    const kluc = el?.dataset.lupa;
    const ciel = el === undefined || kluc === undefined ? null : (najdiLupu.get(kluc)?.(el) ?? null);
    if (el === undefined || kluc === undefined || ciel === null) return null;
    let posun = 0;
    for (let a: HTMLElement | null = el; a !== null; a = a.parentElement) {
      const rodic = a.parentElement;
      if (rodic?.classList.contains("harmonika") === true || rodic?.classList.contains("harmonika-skupiny") === true) {
        const t = getComputedStyle(a).transform;
        if (t !== "none") posun += new DOMMatrixReadOnly(t).m41;
      }
    }
    const r = ciel.getBoundingClientRect();
    return { kluc, rect: new DOMRect(r.x - posun, r.y, r.width, r.height) };
  };
  useEffect(() => () => clearTimeout(casovacLupy.current), []);
  // Susedia uhnú o polovicu prírastku šírky lupy (harmonika v hra.css).
  useEffect(() => {
    if (lupa === null) return;
    const lk = lupaKarty.get(lupa.kluc);
    const mierka = Math.min(lk?.mierka ?? mierkaLupy, maxMierkaLupy(lupa.rect));
    document.body.style.setProperty("--harmonika-posun", `${Math.round((lupa.rect.width * (mierka - 1)) / 2 + 6)}px`);
    return () => {
      document.body.style.removeProperty("--harmonika-posun");
    };
    // lupaKarty sa skladá pri každom kreslení — stačí kľúč a poloha lupy.
  }, [lupa, mierkaLupy]);
  /**
   * Udalosti prvku, ktorý sa pri prejdení myšou zväčší. Lupa sa otvorí až po
   * krátkej chvíli (pri prechode cez rad by blikala); hneď po zavretí inej
   * lupy bez čakania, nech sa dá rad prechádzať plynulo. Kartu, z ktorej lupy
   * myš práve odišla, znova neotvorí, kým myš neopustí jej miesto.
   */
  const ONESKORENIE_LUPY_MS = 150;
  const nadLupou = (kluc: string, najdi: (el: HTMLElement) => Element | null, fokus: boolean) => {
    najdiLupu.set(kluc, najdi);
    return {
      "data-lupa": kluc,
      tabIndex: fokus ? 0 : undefined,
      onPointerEnter: (e: ReactPointerEvent<HTMLElement>): void => {
        if (e.pointerType !== "mouse" || tahanie !== null) return;
        const z = lupaZavreta.current;
        if (z?.kluc === kluc) return;
        const el = e.currentTarget;
        clearTimeout(casovacLupy.current);
        const plynulo = z !== null && Date.now() - z.cas < 300;
        casovacLupy.current = setTimeout(() => otvorLupu(kluc, najdi(el)), plynulo ? 0 : ONESKORENIE_LUPY_MS);
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
  // Línia je rovný rad (Michal 2026-10-22) — vzpriamená karta už neleží nižšie
  // kvôli spoju; páry akcií na spoji ukazujú spojnice (SpojeLinie).
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

  // ---- klikanie na karty v línii (NA EX cieľ, Liečba, Pohreb) ----------
  // Liečba aj Pohreb berú tvoju kartu — natočenú k tebe, na ktorejkoľvek strane.
  const klikLinia = (majitel: PlayerId, uid: number): (() => void) | undefined => {
    if (mode.typ === "naexCiel") {
      if (!naexCiele.has(uid)) return undefined;
      return () => setMode(mode.uid === uid ? { typ: "ziadny" } : { typ: "naexCiel", uid });
    }
    // Pitka (Michal 2026-10-21): klik na kartu so značkou ju rovno vyberie — pečiatka NA EX! sa ukáže na hrane stola.
    if (naexPriamo && mode.typ === "ziadny" && naexCiele.has(uid)) {
      return () => setMode({ typ: "naexCiel", uid });
    }
    if (mode.typ === "liecbaZavisly" && majitel === ja) {
      return () => setMode({ typ: "liecbaSenok", cirhozaUid: mode.cirhozaUid, zavislyUid: uid });
    }
    if (mode.typ === "pohrebKarta" && majitel === ja) {
      return () => posli({ type: "pohreb", cirhozaUid: mode.cirhozaUid, kartaUid: uid });
    }
    if (benzinkaCiele.has(uid) && mode.typ === "vyber") {
      return () => setMode({ typ: "vyber", uids: mode.uids.includes(uid) ? mode.uids.filter((u) => u !== uid) : [...mode.uids, uid] });
    }
    return undefined;
  };

  // Línia z pohľadu hráča (PRAVIDLA §4): tvoja strana vedie od lokality
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
        nova || naexBy !== undefined || vybranaNaex ? (
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
    return vLinii(
      <button
        type="button"
        className={["miesto-volby", vybrane ? "vybrane" : "", moze ? "" : "zakazane"].join(" ")}
        style={{ width: Math.round(sirkaVLinii * MIESTO_VOLBY), height: vyska }}
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
        {/* Prečo sa sem nedá — textom, nie len v title, ktorý na dotyku nevidno (UX N4, U13). */}
        <span className={`mv-text ${moze ? "" : "mv-dovod"}`}>
          {!moze ? (m.dovod ?? "nedá sa") : vybrane ? "vyber z ruky" : sSpojom > 0 ? `spoj: ${sSpojom}` : "bez spoja"}
        </span>
      </button>,
      -3,
    );
  };
  const radStrany = (p: PlayerId): ReactNode => {
    const koniec = koniecStrany(p);
    const karty = view.strany[p].length === 0 ? null : kartyStrany(p);
    if (koniec === null && karty === null) return vLinii(<span className="prazdna">prázdna</span>);
    // Tvoja partia vedie od lokality doľava, jej koniec je teda vľavo.
    return p === ja ? (
      <>
        {koniec}
        {karty}
      </>
    ) : (
      <>
        {karty}
        {koniec}
      </>
    );
  };

  /** Priznanie a Dedičstvo — miesto mimo línie, len pre Kliatby a Nástroje. */
  const odkladanie = (ciel: "priznanie" | "dedicstvo", nazov: string, pozn: string): ReactNode => {
    const navrhnute = vylozenia.filter((x) => x.ciel === ciel);
    const volne = miesto(
      ciel,
      ciel === "dedicstvo" && varovaniePoldeci !== null ? (
        <>
          {nazov}
          {varovaniePoldeci}
        </>
      ) : (
        nazov
      ),
      104,
    );
    if (navrhnute.length === 0 && volne === null) return null;
    return (
      <div className="odkladanie-zona" key={ciel}>
        <span className="popis">{nazov}</span>
        {navrhnute.map((x) =>
          tahatelna(
            { karta: x.karta, odkial: "ruka", navrh: true },
            <>
              {karta({ karta: x.karta, sirka: 104 })}
              {stitokPoldeci(x.karta.uid)}
            </>,
            x.karta.uid,
            NAHRADIT + x.karta.uid,
            undefined,
            () => vratDoRuky(x.karta.uid),
          ),
        )}
        {volne}
        <span className="odkladanie-pozn">{pozn}</span>
      </div>
    );
  };
  const odkladacieZony = [
    odkladanie("priznanie", "priznať", "navždy z balíčka · nemíňa limit · za Cirhózu sa nedoberá · Cirhóza po bitke odomkne Liečbu a Pohreb"),
    odkladanie("dedicstvo", "do Dedičstva", `pasívny efekt · teraz stojí ${cigariet(view.cenaDedicstva)} (cena rastie pre oboch) · nemíňa limit`),
  ].filter(
    (z) => z !== null,
  );

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
  const rovnostKraja = (p: PlayerId): ReactNode => {
    const s = stavKraja(data, stol.strany[p]);
    if (stredKarta === null || s.prevaha === null || s.naPrebitie === null) return null;
    const druhy: PlayerId = s.prevaha === 0 ? 1 : 0;
    const zs = view.faza === "zhromazdenie" ? view.zhromazdenieStav : null;
    return (
      <span className="kraj-rovnost">
        {s.rovnost && (
          <>
            rovnosť {s.pocet[ja]} : {s.pocet[super_]} →{" "}
            {s.prevaha === ja ? "hranu máš ty (tvoja karta leží pri lokalite)" : `hranu má ${menoHraca(s.prevaha)} (súperova karta leží pri lokalite)`} ·{" "}
          </>
        )}
        na prebitie {druhy === ja ? "potrebuješ" : `${menoHraca(druhy)} potrebuje`} {kariet(s.naPrebitie)}
        {zs !== null && (
          <>
            {" "}
            · vyloží ešte: ty {zs.pasoval[ja] ? 0 : zs.zostavaLimit[ja]}, {menoHraca(super_)} {zs.pasoval[super_] ? 0 : zs.zostavaLimit[super_]}
          </>
        )}
      </span>
    );
  };
  const popisKraja = (p: PlayerId, smer: "vlavo" | "vpravo") => {
    const nazov = krajStrany(p) ?? (p === ja ? "tvoja strana" : `strana — ${menoHraca(p)}`);
    return (
      <span className="partia-popis" title={tipKraja(p)}>
        {smer === "vlavo" ? "← " : ""}
        {nazov}
        {stredKarta !== null && <span className={`kraj-prevaha ${prevaha[p] === ja ? "moja" : prevaha[p] === null ? "" : "superova"}`}> · prevaha: {kto(prevaha[p])}</span>}
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
        <span className="prazdna lokalita-miesto">vyberá sa…</span>
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
      <button onClick={fn} title="To isté urobí pravý klik na kartu.">
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
            disabled={plan.chyba !== null}
            title={plan.chyba ?? undefined}
            onClick={() => posli({ type: "tah", kroky: plan.kroky })}
          >
            potvrdiť{plan.poldeci > 0 && <span className="cena">−{plan.poldeci} poldeci</span>}
          </button>
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
  /** Pravý klik na prázdny stôl zruší rozbehnutý výber (miesto, cieľ NA EX, Liečbu…). */
  const zrusVyberNaStole = ((): (() => void) | undefined => {
    if (miestoVolby !== null) return () => setMiestoVolby(null);
    if (mode.typ === "naexCiel" || mode.typ === "liecbaZavisly" || mode.typ === "pohrebKarta") return () => setMode({ typ: "ziadny" });
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
  }): ReactNode => (
    <button
      key={p.kluc}
      type="button"
      className={`pecat pecat-nakup${p.dovod !== null ? " ne" : ""}`}
      aria-disabled={p.dovod !== null}
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
                title="Do Pitky už nevykladáš, súper vykladá sám. Za každú kartu, ktorú si ešte smel vyložiť, dostaneš cigaretu."
                onClick={() => (mozemVylozit ? odlozenyPas.spusti({ type: "pass" }) : posli({ type: "pass" }))}
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
                tlacidla: <button onClick={() => posli({ type: "bezReakcie" })}>bez odpovede</button>,
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
              if (hotovoVzdavaNaex) setPotvrdenie("hotovo");
              else posli({ type: "skipNaex" });
            }}
          >
            {superSkoncil ? "končím · vyhodnotiť" : "končím"}
          </button>
        );
        // Vybraná karta (klik na kartu so značkou): pod kartou „vybraná“, v pilulke náhľad, na hrane pečiatka NA EX!.
        const vybranaUid = mode.typ === "naexCiel" ? mode.uid : null;
        const vybrana = vybranaUid === null ? undefined : nahladNaex.get(vybranaUid);
        const menoVybranej = vybranaUid === null ? "" : menoKarty(view.strany.flat().find((pl) => pl.card.uid === vybranaUid)?.card.defId ?? "");
        const textVyberu =
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
              <button className="tlacidlo-naex pecat-naex" data-skratka="n" title={`NA EX na ${menoVybranej} — súper smie hneď odpovedať jednou kartou.`} onClick={() => posli({ type: "naex", uid: vybranaUid })}>
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
            text: "Klikni na staršieho po boku stola — marker sa posunie k súperovi: on dostane priazeň, starší sa začne báť teba (zónové body, cesta k vydeseniu). Zamknuté markery sa nedajú.",
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
                Klikni na staršieho po boku stola — marker ide k súperovi (on priazeň, teba sa starší začne báť).{" "}
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
        if (b.krok === "liecba") {
          const cirhoza = view.hraci[ja].priznane.find((k) => k.defId === "cirhoza");
          const zrusit = <button onClick={zrus}>zrušiť</button>;
          if (mode.typ === "liecbaZavisly") {
            return { nadpis: "Liečba", text: "Klikni na kartu s tagom Závislý vo svojej partii.", tlacidla: zrusit };
          }
          if (mode.typ === "liecbaSenok") {
            const vzata = zoSenku[0];
            return {
              nadpis: "Liečba",
              text:
                vzata === undefined ? (
                  "Vyber kartu zo šenku."
                ) : (
                  <>
                    Berieš <strong>{menoKarty(vzata.defId)}</strong>.
                  </>
                ),
              tlacidla: (
                <>
                  {zrusit}
                  <button onClick={() => setVrstva("senok")}>← späť na šenok</button>
                  <button
                    className="tlacidlo-hlavne"
                    disabled={vzata === undefined}
                    onClick={() =>
                      vzata !== undefined &&
                      posli({ type: "liecba", cirhozaUid: mode.cirhozaUid, zavislyUid: mode.zavislyUid, senokUid: vzata.uid })
                    }
                  >
                    potvrdiť
                  </button>
                </>
              ),
            };
          }
          if (mode.typ === "pohrebKarta") {
            return { nadpis: "Pohreb", text: "Klikni na kartu vo svojej partii, ktorú spáliš.", tlacidla: zrusit };
          }
          return {
            nadpis: "Priznaná Cirhóza",
            text: "Liečba vymení Závislého za kartu zo šenku, Pohreb spáli kartu z tvojej partie.",
            tlacidla: (
              <>
                <button onClick={() => posli({ type: "skipLiecba" })}>preskočiť</button>
                <button
                  disabled={cirhoza === undefined}
                  onClick={() => cirhoza !== undefined && setMode({ typ: "liecbaZavisly", cirhozaUid: cirhoza.uid })}
                >
                  Liečba
                </button>
                <button
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
      : mode.typ === "liecbaSenok" && zoSenku.length === 0
        ? "senok"
        : view.faza === "volbaCiela" && lokalitaNavrh === null
          ? "lokality"
          : null;

  // ---- starší -------------------------------------------------------------
  // Náhľad posunu (Michal 2026-10-19): komu posun pomôže — body spolu a priazeň.
  const ZONA = ["neutrál", "žltá", "oranžová", "červená"] as const;
  const DO_ZONY = ["neutrálu", "žltej", "oranžovej", "červenej"] as const;
  const popisPosunu = (elder: ElderState, cezPohorsenie: boolean, naKraj = false): string => {
    // Prebytok: aj cigareta porazenému za prvý posun staršieho (§8.4) — nahladPosunuPrebytkom.
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

  // Na mobile v zbalenom rade len starší, na ktorých záleží: mimo neutrálu
  // alebo práve klikateľní (bitka o staršieho, Pohoršenie, prebytok).
  const starsiNaMobile =
    mobil && maliStarsi
      ? view.starsi.filter((e) => STUPNICA_ZONY[e.marker] > 0 || klikStarsi(e) !== undefined)
      : view.starsi;
  const prahy = (p: PlayerId) => prahyHraca(data, stol, p);
  const zavislost = (p: PlayerId) => stavZavislosti(data, { ...stol, kolo: view.kolo, hraci: view.hraci }, p);
  const popisKarty = (defId: string): string => {
    const def = data.cards.get(defId);
    return def === undefined ? defId : `${def.name}: ${def.effectText}`;
  };
  const b = view.bitkaStav;
  // Odhad bitky len keď ho hráči ovplyvnia — v Zhromaždení, Pitke a bitke;
  // pri voľbe cieľa a v drafte mätie (Michal 2026-10-20).
  const bitkaPanel =
    odhad === null || view.faza === "volbaCiela" || view.faza === "draft" || view.koniec !== null ? null : (
      <BitkaPanel
        rodJa={rodHracaP(ja)}
        damage={b?.damage ?? odhad}
        sums={lineEval.sums}
        zdroje={lineEval.zdroje}
        rozpis={rozpis}
        menoKarty={menoKarty}
        ja={ja}
        vysledok={b?.damage != null}
        mena={[menoHraca(0), menoHraca(1)]}
        sada={sada}
        ciel={lokalita !== null ? `o ${menoKarty(lokalita.defId)}` : ""}
        naSekeru={view.naSekeru.map((k) => menoKarty(k.defId))}
        poslednaBitka={view.lokalityVHre.length === 0}
        cenaPosunuVitaza={[
          cenaPrebytku({ strany: view.strany } as unknown as GameState, 0),
          cenaPrebytku({ strany: view.strany } as unknown as GameState, 1),
        ]}
        prebytokNaRozdelenie={prebytokNaRozdelenie(view, battleOutcome(b?.damage ?? odhad))}
        utocnik={`útočník: ${view.utocnik === ja ? "ty" : menoHraca(view.utocnik)} — ${view.kolo === 1 ? "v 1. kole náhodne" : "porazený z minulej bitky (remíza roly nemení)"}`}
      />
    );

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
  // v playteste 20261016-134912 to porazená nepochopila.
  const [oznamyPriazne, setOznamyPriazne] = useState<readonly { readonly id: number; readonly komu: PlayerId; readonly text: string }[]>([]);
  const predoslaPriazen = useRef<ReadonlyMap<string, { readonly komu: PlayerId | null; readonly sila: number }> | null>(null);
  const idOznamu = useRef(0);
  useEffect(() => {
    const teraz = new Map(view.starsi.map((e) => [e.elderId, { komu: priazenHraca(e), sila: priazenSila(e) }]));
    const pred = predoslaPriazen.current;
    predoslaPriazen.current = teraz;
    if (pred === null) return;
    const nove: { id: number; komu: PlayerId; text: string }[] = [];
    for (const e of view.starsi) {
      const t = teraz.get(e.elderId);
      const p = pred.get(e.elderId);
      if (t === undefined || t.komu === null) continue;
      if (p !== undefined && p.komu === t.komu && p.sila >= t.sila) continue;
      const sc = scorecardStarsieho(data, e);
      const ucinok = UCINOK_PRIAZNE[sc.favour](t.sila);
      nove.push({
        id: ++idOznamu.current,
        komu: t.komu,
        text: `${t.komu === ja ? "Dostávaš" : `${menoHraca(t.komu)} dostáva`} priazeň ${menoKarty(e.karta.defId)} (${sc.nazov}) sily ${t.sila}: ${ucinok}`,
      });
    }
    if (nove.length === 0) return;
    setOznamyPriazne((o) => [...o, ...nove].slice(-6));
    const ids = nove.map((n) => n.id);
    const t = setTimeout(() => setOznamyPriazne((o) => o.filter((x) => !ids.includes(x.id))), 12000);
    return () => clearTimeout(t);
    // menoHraca a ja sú stále počas partie; stačí sledovať starších.
  }, [view.starsi, data]);
  const oznamyPriazneEl =
    oznamyPriazne.length === 0 ? null : (
      <div className="oznamy-priazne" aria-live="polite">
        {oznamyPriazne.map((o) => (
          <button
            key={o.id}
            type="button"
            className={`oznam-priazne ${o.komu === ja ? "moja" : "superova"}`}
            onClick={() => setOznamyPriazne((x) => x.filter((y) => y.id !== o.id))}
            onContextMenu={pravyKlik(() => setOznamyPriazne((x) => x.filter((y) => y.id !== o.id)))}
            title="Zavrieť (klik alebo pravý klik)"
          >
            <span aria-hidden="true">♥</span> {o.text}
          </button>
        ))}
      </div>
    );

  // ---- draft na stole (Michal 2026-10-16) ----------------------------------
  const sirkaDraftu = mobil ? 84 : 118;
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
            <div key={`m${i}`} className="stavba-zona-miesto" style={{ width: sirkaDraftu, height: sirkaDraftu * 1.4 }}>
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
        <div className="harmonika draft-karty volba-ciela-karty">
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
      return (
        <section ref={draftPanelRef} className={`draft-panel stavba ${somNaTahu ? "moj-tah" : "cakanie"}`} aria-label="Stavba šenku">
          <header className="draft-hlava">
            <strong>Stavba šenku</strong>
            <span>
              {somNaTahu
                ? `Tvoj balíček: ${kariet(draft.mojBalicek.length)} — vyber ${kariet(krokSt.odhod)} na Smetisko, ${zvysnePojdu(krokSt.doSenku)} do Šenku.`
                : `${tvar(rodHracaP(ja), "Vybral si", "Vybrala si", "Výber je hotový")} — čakáš, kým vyberie ${menoHraca(super_)}.`}
            </span>
          </header>
          <div className="stavba-rad">
            {zonaStavby(SMETISKO, "Smetisko", "naspodok spoločného balíčka · súper ich neuvidí", odhod, krokSt.odhod)}
            <div
              className={zonaTriedy(BALICEK_STAVBY, "stavba-balicek harmonika")}
              data-ciel={jeCiel(BALICEK_STAVBY) ? BALICEK_STAVBY : undefined}
            >
              <span className="stavba-balicek-nazov">
                do Šenku <small>{zvysok.length}/{krokSt.doSenku}</small>
              </span>
              {zvysok.map((k) => {
                const z: Zdroj = { karta: k, odkial: "stavba", navrh: false };
                if (!somNaTahu) return sLupou({ karta: k, sirka: sirkaDraftu });
                const props = { karta: k, sirka: sirkaDraftu, onClick: () => doZonyStavby(k.uid, true) };
                return sLupou(props, { obsah: tahatelna(z, karta(props)), zdroj: z });
              })}
            </div>
          </div>
          {somNaTahu && (
            <footer className="draft-paticka">
              <span>
                {!stavbaHotova
                  ? `Na Smetisku ${odhod.length} z ${krokSt.odhod}. Kartu zo Smetiska vrátiš klikom; na plné Smetisko ustúpi posledná.`
                  : `Hotovo? ${zvysnePojdu(zvysok.length).replace(/^z/, "Z")} do Šenku.`}
              </span>
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
        <div className="harmonika draft-karty branie-karty">
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
        <footer className="draft-paticka">
          <span className="tlmene">
            {zoSenku.length === 0
              ? "Beriete striedavo, kým obaja neprestanete; kto nemá cigaretu, prestane sám. Pitiek v bitke bude 1 + menší počet aktivovaných akcií lokality z dvoch strán."
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

  // ---- starší po bokoch stola (Michal 2026-10-22, #55 variant B) ----------------
  // Poradie je pevné (1–4 vľavo, 5–8 vpravo), nie podľa markera — nič neskáče.
  // Plný scorecard je v lupe: kotva má tvar scorecardu, lupa ju zväčší na SIRKA_SCORECARDU_V_LUPE.
  const stlpecStarsich = (starsi: readonly ElderState[], strana: "vlavo" | "vpravo"): ReactNode => (
    <div className={`stlpec-starsich ${strana}`} aria-label={strana === "vlavo" ? "Starší 1–4" : "Starší 5–8"}>
      {starsi.map((elder) => {
        const k = klikStarsi(elder);
        const kluc = `s${elder.elderId}`;
        const patronIdx = view.patronat.findIndex((x) => x?.elderId === elder.elderId);
        const patronElder = patronIdx === -1 ? null : (patronIdx as PlayerId);
        const bodyStarsieho = body.starsi.find((b) => b.elderId === elder.elderId);
        const scorecard = (sirka: number): ReactNode => (
          <Scorecard
            elder={elder}
            data={data}
            sada={sada}
            ja={ja}
            sirka={sirka}
            karta={(s) => karta({ karta: elder.karta, sirka: s })}
            onClick={k?.klik}
            body={bodyStarsieho}
          />
        );
        lupaKarty.set(kluc, { render: (s) => scorecard(s), mierka: SIRKA_SCORECARDU_V_LUPE / SIRKA_DLAZDICE_STARSIEHO });
        return (
          <div
            key={elder.elderId}
            className={[
              "s-lupou",
              "scorecard-obal",
              k !== undefined ? "ma-akciu vyzvat" : mozniPatronati.length > 0 ? "nedostupny" : "",
              patronElder !== null ? "v-patronate" : "",
              lupa?.kluc === kluc ? "harmonika-aktivna" : "",
            ]
              .filter((x) => x !== "")
              .join(" ")}
            {...nadLupou(kluc, (el) => el.querySelector(".kotva-lupy-starsieho"), k === undefined)}
            {...(k === undefined
              ? {}
              : { role: "button", tabIndex: 0, onClick: k.klik, onKeyDown: (e: ReactKeyboardEvent<HTMLElement>) => (e.key === "Enter" || e.key === " ") && k.klik() })}
          >
            <span
              className="kotva-lupy-starsieho"
              aria-hidden="true"
              style={{ height: SIRKA_DLAZDICE_STARSIEHO * pomerScorecardu(sada, data, elder) }}
            />
            <DlazdicaStarsieho
              elder={elder}
              data={data}
              ja={ja}
              meno={menoKarty(elder.karta.defId)}
              body={bodyStarsieho}
              karta={(s) => karta({ karta: elder.karta, sirka: s })}
              akcia={k?.akcia}
              stitok={
                patronElder === null ? undefined : (
                  <span className="ds-patronat">
                    {patronElder === ja ? "v tvojej ruke" : `v ruke: ${menoHraca(patronElder)}`} · +{view.patronat[patronElder]?.pohorsenia ?? 0} Pohoršení
                  </span>
                )
              }
            />
          </div>
        );
      })}
    </div>
  );

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
      <span className="body-teraz" title="Záverečné bodovanie, keby hra skončila teraz">
        body teraz <b className="moje">ty {body.spolu[ja]}</b> ·{" "}
        <b className="superove" title="Súperove nepriznané kliatby sú už odpočítané — ich počet je z toho, čo sa ukázalo na stole.">
          {menoHraca(super_)} {body.spolu[super_]}
        </b>
      </span>
      <button type="button" className="tlacidlo-male tlacidlo-jemne" onClick={() => setAkoBodovanie(!akoBodovanie)} aria-expanded={akoBodovanie}>
        {akoBodovanie ? "skryť rozpis" : "rozpis bodov"}
      </button>
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
      <section className="ucet-bitky" aria-label={`Účet bitky — ${ucetBitky.lokalita}`}>
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
      className="hra"
      style={{ "--ruka-w": `${sirkaVRuke}px`, "--hlavicka-h": `${vyskaHlavicky}px` } as CSSProperties}
    >
      {/* V prehrávači výsledok ukáže detail partie — okno konca s hodnotením a lobby tam nepatrí. */}
      {view.koniec !== null && !koniecZavrety && prehravanie === undefined && (
        <KoniecHry
          rodJa={rodHracaP(ja)}
          rody={[rodHracaP(0), rodHracaP(1)]}
          view={view}
          data={data}
          mena={[menoHraca(0), menoHraca(1)]}
          menoKarty={menoKarty}
          frajerina={frajerina}
          onZavri={() => setKoniecZavrety(true)}
          opustit={opustit}
        />
      )}
      <header className="hra-hlava">
        <span className="kod" title={prehravanie === undefined ? "kód miestnosti — pošli súperovi" : "číslo partie v archíve"}>
          {kod}
        </span>
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
            {vHlavicke}
            <span className={`spojenie ${superPripojeny ? "online" : "offline"}`}>
              {superPripojeny ? `● ${menoHraca(super_)}` : `○ ${menoHraca(super_)} odpojený`}
            </span>
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
          data={data}
          mena={[menoHraca(0), menoHraca(1)]}
          menoStarsieho={menoStarsieho}
          ucet={ucetBaru}
        />
        {/* Účet leží nad stolom vo viditeľnej časti okna (position: fixed) — stôl pri otvorení neposkočí. */}
        {ucetBaru !== undefined && ucetPoloha !== null && (
          <div className="ucet-kotva" id={idUcetu} style={{ top: ucetPoloha.top, maxHeight: ucetPoloha.maxH }}>
            <KrcmovyUcet
              body={body}
              data={data}
              ja={ja}
              mena={[menoHraca(0), menoHraca(1)]}
              menoStarsieho={menoStarsieho}
              kolo={view.kolo}
              dva={zobrazenieSkore === "dva"}
              onZavri={() => setUcetOtvoreny(false)}
            />
          </div>
        )}
        {/* Starší hore — mimo dosahu ruky, aby sa ich lupa nebila s lupou kariet v ruke. */}
        <div className="stred">
          {/* Stôl je hneď pod staršími — pás pokynov a ruka ho neprekryjú
              (playtest 20261012-055944); dosky hráčov sú pod ním. */}
          {hrozbaVydesenia}
          {oznamyPriazneEl}
          {ucetBitkyEl}
          {cielPanel}
          {draftPanel}
          {pasKola}
          {/* Starší po bokoch stola (Michal 2026-10-22, #55 variant B) — nad stolom ostáva len ich súhrn. */}
          {pasKola === null && <div className="starsi-info-samostatne">{starsiSuhrn}</div>}
          <section className="starsi-info" ref={starsiPanelRef} hidden={!akoBodovanie}>
            {akoBodovanie && (
              <div className="ako-bodovanie">
                <p>
                  <b>★ Body</b> dáva každý scorecard <b>obom hráčom</b>: boduje každá <b>aktívna podmienka</b> (svieti — karta
                  staršieho má pri nej akciu), na ktorejkoľvek strane. Číslo pri ikone = koľko z nej máš ty. Lokality, získaní starší
                  a cigarety za kus, nepriznané Dlhy a Cirhózy mínus za kus. Znepokojenie / Strach / Vydesenie dávajú body za každého
                  staršieho v hre, ktorý sa ťa bojí aspoň na tú úroveň.
                </p>
                <p>
                  <b>♥ Priazeň</b> (počas hry) má hráč, ku ktorému je marker posunutý — dáva výhodu podľa scorecardu. Starší sa vtedy
                  bojí toho druhého: posunúť marker k súperovi mu dá priazeň, ale tebe strach staršieho do zónových podmienok.
                </p>
                <RozpisBodov
                  body={body}
                  starsi={view.starsi}
                  data={data}
                  ja={ja}
                  menoSupera={menoHraca(super_)}
                  menoKarty={menoKarty}
                  nadpis="Keby hra skončila teraz"
                />
              </div>
            )}
          </section>
          {/* Farba stola hovorí, čí je ťah: zelená = tvoj, sivá = čakáš. */}
          <div
            ref={liniaObalRef}
            className={`linia-obal ${view.koniec !== null ? "koniec" : somNaTahu ? "moj-tah" : "cakanie"}${hranaStola !== null ? " s-hranou" : ""}`}
            onContextMenu={pravyKlik(zrusVyberNaStole)}
          >
            {/* Pokyn je pilulka na hornej hrane stola (Michal 2026-10-21) — predtým pás nad rukou. */}
            <div className="linia-stav" role="status" aria-live="polite">
              <strong className="pilulka-nadpis">
                {pokyn?.nadpis ?? (view.koniec !== null ? "Koniec hry" : somNaTahu ? "Tvoj ťah" : `Na ťahu je ${menoHraca(super_)}`)}
              </strong>
              {pokyn?.text !== undefined && <span className="pilulka-text">{pokyn.text}</span>}
            </div>
            <div className="stol-plst">
            {stlpecStarsich(view.starsi.slice(0, 4), "vlavo")}
            <div className="linia harmonika-skupiny" ref={liniaRef}>
              <div className="linia-skupina moja">
                {popisKraja(ja, "vlavo")}
                <div className="partia-rad harmonika">{radStrany(ja)}</div>
              </div>
              <div className="linia-skupina lokalita" ref={lokalitaRef}>
                <span className="partia-popis">
                  {lokalita !== null || lokalitaNavrh !== null ? "lokalita" : "cieľ kola"}
                </span>
                <div className="partia-rad harmonika">{stredLinie}</div>
                {popisStranStredu}
                {lokalitaNavrh !== null && tahanie === null && <span className="otocit-tip">klik = otočiť</span>}
              </div>
              <div className="linia-skupina superova">
                {popisKraja(super_, "vpravo")}
                <div className="partia-rad harmonika">{radStrany(super_)}</div>
              </div>
              <SpojeLinie liniaRef={liniaRef} />
            </div>
            {stlpecStarsich(view.starsi.slice(4), "vpravo")}
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
            data={data}
            mena={[menoHraca(0), menoHraca(1)]}
            menoStarsieho={menoStarsieho}
            ucet={ucetBaru}
          />

          {bitkaPanel}

          {odkladacieZony.length > 0 && <div className="odkladanie">{odkladacieZony}</div>}

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
                <button className="tlacidlo-hlavne" onClick={() => setVrstva(null)} disabled={zoSenku.length === 0}>
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

      {vrstva === "odhodene" && (
        <VrstvaPanel
          nazov="Odhodené"
          pozn="tvoj odhadzovací balíček — keď sa minie doberací, zamieša sa doň"
          skryta={tahanie !== null}
          onZavri={() => setVrstva(null)}
        >
          <div className="vrstva-karty harmonika">
            {hJa.odhadzovaci.length === 0 && <span className="popis">Zatiaľ nič.</span>}
            {hJa.odhadzovaci.map((k) => sLupou({ karta: k, sirka: SIRKA_VO_VRSTVE }))}
          </div>
        </VrstvaPanel>
      )}

      {vrstva === "log" && (
        <VrstvaPanel nazov="Log" skryta={tahanie !== null} onZavri={() => setVrstva(null)}>
          <div className="log">
            {log.length === 0 && <span className="popis">Zatiaľ žiadne záznamy — log sa zbiera od pripojenia.</span>}
            {log.map((riadok, i) => (
              <div key={i} className={riadok.startsWith("⚠") ? "manual" : ""}>
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
        <span className="ruka-nadpis">
          ruka<b>{view.ruka.length}</b>
        </span>
        {/* Zrkadlo k „ruka“: odhadzovací balíček je verejný, klik ho ukáže. */}
        <button
          className={`ruka-nadpis odhodene-nadpis ${vrstva === "odhodene" ? "otvorena" : ""}`}
          title="Tvoj odhadzovací balíček"
          onClick={() => setVrstva(vrstva === "odhodene" ? null : "odhodene")}
        >
          odhodené<b>{hJa.odhadzovaci.length}</b>
        </button>
        <div className="ruka-rad harmonika-hover">
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
                  {karta({ karta: k, sirka: sirkaVRuke, vybrana, onClick, hranaVnutorna: strana, spoj })}
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

      {/* Až tu — lupaKarty sa naplnia pri kreslení stola a vrstiev vyššie. */}
      {(() => {
        const lk = lupa === null || tahanie !== null ? undefined : lupaKarty.get(lupa.kluc);
        if (lupa === null || lk === undefined) return null;
        const z = lk.zdroj;
        const chytit = z !== undefined && cieleZdroja(z).size > 0;
        return (
          <Lupa
            rect={lupa.rect}
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

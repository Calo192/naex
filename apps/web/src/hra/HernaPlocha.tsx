// Herná obrazovka (M8): partia súpera hore, lokalita v strede, vlastná
// partia a ruka dole, starší a šenok bokom, stav hráčov a log. Karty sú
// v tlačovom vzhľade; ich sloty svietia podľa živého vyhodnotenia línie.
//
// Živé zvýraznenie: evaluateLine z @naex/core sa volá na klientskom pohľade
// pri každom prekreslení — hráč okamžite vidí, čo mu na spoji chytilo.
//
// Karty sa kladú ťahaním (useTahanie). Položená karta je najprv len NÁVRH
// v tomto prehliadači: dá sa presunúť, vrátiť alebo nahradiť inou a živé
// vyhodnotenie ho už ráta. Na server ide príkaz až po „potvrdiť".

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type {
  CardInstance,
  CielVykladania,
  ClientState,
  Command,
  ElderState,
  GameData,
  KartaZdroj,
  PlacedCard,
  PlayerId,
  VerejnyStav,
} from "@naex/core";
import {
  KONSTANTY,
  STUPNICA_ZONY,
  bodyTeraz,
  cenaPrebytku,
  cieleVykladania,
  evaluateLine,
  barterCena,
  limitBuduceKolo,
  limitZhromazdenia,
  lineState,
  nahladBitkyOStarsieho,
  nahladVylozenia,
  naexCieleVLinii,
  posunMarker,
  poskodenieBitky,
  prahVydesenia,
  prahyHraca,
  priazen,
  priazenHraca,
  priazenSila,
  scorecardStarsieho,
  stranyLokality,
  vydesil,
} from "@naex/core";
import type { ActionSums, GameState, NahladVylozenia, PlatbaZoSenku, Slot } from "@naex/core";
import { IkonaAkcie } from "../karta/IkonaAkcie.tsx";
import { KoniecHry } from "./KoniecHry.tsx";
import type { Sada } from "@naex/tvorba";
import { HernaKarta, posunVzpriamenej, vzhladKarty, type HernaKartaProps } from "./HernaKarta.tsx";
import { Lupa } from "./Lupa.tsx";
import { Vrstva as VrstvaPanel } from "./Vrstva.tsx";
import { BitkaPanel, HracDoska, PriebehKola } from "./Panely.tsx";
import { RozpisBodov } from "./RozpisBodov.tsx";
import { Scoreboard } from "./Scoreboard.tsx";
import { Scorecard, StavStarsieho, UCINOK_PRIAZNE } from "./Scorecard.tsx";
import type { HracInfo, ZmenyFrajeriny } from "./useHra.ts";
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
  | { readonly typ: "vylozenie"; readonly uid: number; readonly ciel: CielVykladania }
  // otocena je v ráme hráča 0, presne ako v príkaze chooseLocation.
  | { readonly typ: "lokalita"; readonly uid: number; readonly otocena: boolean }
  // Bitka o staršieho: karta staršieho v strede línie, útočník ju natočí.
  | { readonly typ: "starsi"; readonly elderId: string; readonly otocena: boolean }
  // Draft aj Liečba: karty zo šenku presunuté do ruky.
  | { readonly typ: "zoSenku"; readonly uids: readonly number[] };

const CIELE_VYKLADANIA: readonly string[] = ["vlastna", "superova", "priznanie", "dedicstvo"] satisfies CielVykladania[];
const jeCielVykladania = (c: string): c is CielVykladania => CIELE_VYKLADANIA.includes(c);

const POPIS_CIELA: Record<CielVykladania, string> = {
  vlastna: "na tvoju stranu",
  superova: "na súperovu stranu (ostane tvoja)",
  priznanie: "priznať",
  dedicstvo: "do Dedičstva (2 cigarety)",
};

const NAHRADIT = "nahradit:";
/** Cieľ pri preusporiadaní ruky: karta, pred/za ktorú ťahaná karta pôjde. */
const PORADIE = "poradie:";
/** Zóny stavby šenku (Michal 2026-10-16): vľavo Smetisko, vpravo Šenok. */
const SMETISKO = "smetisko";
const SENOK_STAVBA = "senokStavba";
const BALICEK_STAVBY = "balicekStavby";

/**
 * Čo netreba mať na stole stále — otvára sa ako vrstva cez obrazovku.
 * „vestica“ ukazuje doberacie balíčky, ktoré hráčovi podľa karty odhalil server.
 */
type Vrstva = "senok" | "lokality" | "log" | "vestica";

/** Pás pokynov nad rukou: fáza, jedna veta, čo robiť, a tlačidlá ťahu. */
interface Pokyn {
  readonly nadpis: ReactNode;
  readonly text?: ReactNode;
  readonly tlacidla?: ReactNode;
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
/** Zväčšenie karty v lupe (a v ruke, viď hra.css). */
const MIERKA_LUPY = 2;
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

function kariet(n: number): string {
  return n === 1 ? "1 kartu" : n >= 2 && n <= 4 ? `${n} karty` : `${n} kariet`;
}

function cigariet(n: number): string {
  return n === 1 ? "1 cigaretu" : n >= 2 && n <= 4 ? `${n} cigarety` : `${n} cigariet`;
}

type Mode =
  | { typ: "ziadny" }
  | { typ: "naexCiel" }
  | { typ: "liecbaZavisly"; cirhozaUid: number }
  | { typ: "liecbaSenok"; cirhozaUid: number; zavislyUid: number }
  | { typ: "pohrebKarta"; cirhozaUid: number }
  | { typ: "nahradaMarker"; defId: string; kde: KartaZdroj }
  // Výbery viacerých kariet: Benzínka (Občania v línii), limit ruky, Veštica.
  | { typ: "vyber"; uids: readonly number[] }
  | { typ: "vestica"; moja: number | null; jeho: number | null }
  | { typ: "starosta"; rukaUid: number | null };

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
  readonly chyba: string | null;
  readonly superPripojeny: boolean;
  readonly kod: string;
  readonly cmd: (c: Command) => void;
  readonly opustit: () => void;
  /** Zmena Frajeriny po dohraní (príde zo servera po zápise do archívu). */
  readonly frajerina?: ZmenyFrajeriny | null;
  readonly kontumacia?: () => void;
}

export function HernaPlocha({ view, data, sada, hraci, log, chyba, superPripojeny, kod, cmd, opustit, frajerina = null, kontumacia }: HernaPlochaProps) {
  DATA = data;
  const ja = view.ja;
  const menoHraca = (p: PlayerId): string => hraci[p]?.meno ?? `Hráč ${p + 1}`;
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
  const [akoBodovanie, setAkoBodovanie] = useState(false);
  // Šírka okna — na mobile menšia ruka a predvolene zbalení starší.
  const [sirkaOkna, setSirkaOkna] = useState(() => (typeof window === "undefined" ? 1600 : window.innerWidth));
  useEffect(() => {
    const zmena = (): void => setSirkaOkna(window.innerWidth);
    window.addEventListener("resize", zmena);
    return () => window.removeEventListener("resize", zmena);
  }, []);
  const mobil = sirkaOkna < MOBIL;
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
  // Pás pokynov sa pri dlhšom texte zalomí — jeho výška posúva stôl nad ruku.
  const pokynRef = useRef<HTMLDivElement>(null);
  const [vyskaPokynu, setVyskaPokynu] = useState(46);
  useEffect(() => {
    const el = pokynRef.current;
    if (el === null) return;
    const ro = new ResizeObserver(() => setVyskaPokynu(Math.ceil(el.getBoundingClientRect().height)));
    ro.observe(el);
    return () => ro.disconnect();
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
  // +2: karta v strede a voľné miesto na koniec strany pri vykladaní.
  const sirkaVLinii =
    sirkaLinie === 0
      ? SIRKA_V_LINII
      : Math.max(SIRKA_V_LINII_MIN, Math.min(SIRKA_V_LINII, Math.floor((sirkaLinie - 60) / (pocetVLinii + 2)) - 12));
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
  // Stavba šenku: karta do šenku a karta na Smetisko (naspodok spoločného
  // balíčka) z môjho balíčka — ťahaním do zón, kým hráč nepotvrdí.
  const [stavba, setStavba] = useState<{ readonly doSenku: number | null; readonly odhod: number | null }>({ doSenku: null, odhod: null });
  useEffect(() => setStavba({ doSenku: null, odhod: null }), [klucTahu]);
  /** Karta do zóny; karta, ktorá tam ležala, sa vráti (alebo vymení miesto s ťahanou). */
  const doZonyStavby = (uid: number, zona: "doSenku" | "odhod" | null): void =>
    setStavba((v) => {
      const odkial = v.doSenku === uid ? "doSenku" : v.odhod === uid ? "odhod" : null;
      if (zona === null) return odkial === null ? v : { ...v, [odkial]: null };
      if (odkial === zona) return v;
      const druha = zona === "doSenku" ? "odhod" : "doSenku";
      return odkial === null ? { ...v, [zona]: uid } : { ...v, [zona]: uid, [druha]: v[zona] };
    });
  const potvrdStavbu = (): void => {
    if (stavba.doSenku !== null && stavba.odhod !== null) posli({ type: "stavbaSenku", doSenku: stavba.doSenku, odhod: stavba.odhod });
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
  const vylozene = (() => {
    if (navrh?.typ !== "vylozenie" || !somNaTahu || !(view.faza === "zhromazdenie" || reagujem)) return null;
    const k = view.ruka.find((x) => x.uid === navrh.uid);
    return k === undefined ? null : { karta: k, ciel: navrh.ciel };
  })();
  const lokalitaNavrh = (() => {
    if (navrh?.typ !== "lokalita" || !somNaTahu || view.faza !== "volbaCiela") return null;
    const k = view.lokalityVHre.find((x) => x.uid === navrh.uid);
    return k === undefined ? null : { karta: k, otocena: navrh.otocena };
  })();
  const starsiNavrh = (() => {
    if (navrh?.typ !== "starsi" || !somNaTahu || view.faza !== "volbaCiela") return null;
    const e = view.starsi.find((x) => x.elderId === navrh.elderId);
    return e === undefined ? null : { elder: e, otocena: navrh.otocena };
  })();
  // Lokalita umiestnená z vrstvy: posuň stránku k stolu, nech ju ruka neprekrýva.
  const navrhLokality = navrh?.typ === "lokalita" ? navrh.uid : null;
  useEffect(() => {
    if (navrhLokality === null) return;
    lokalitaRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [navrhLokality]);
  // Branie zo šenku: šenok je na stole celý čas, kým hráč neprestane brať;
  // karta potiahnutá do ruky ide rovno na server (Michal 2026-10-16).
  const beriem = view.faza === "draft" && draft?.krok === "beranie" && !draft.hotovo[ja] && view.koniec === null;
  // Michal 2026-10-18: karta zo šenku za cigaretu, alebo 2 karty za plný poldeci; nič zadarmo.
  const kredit = draft?.kredit[ja] ?? 0;
  const mamCigaretu = view.hraci[ja].cigarety >= KONSTANTY.SENOK_CIGARIET_ZA_KARTU;
  const mamPoldeci = view.hraci[ja].poldeciPlne > 0;
  const [platbaVolba, setPlatbaVolba] = useState<PlatbaZoSenku>("cigareta");
  // Zvolená platba, ak ju hráč má; inak tá, čo má (druhá karta za poldeci platbu nepotrebuje).
  const platba: PlatbaZoSenku | null =
    kredit > 0 ? null : (platbaVolba === "cigareta" ? mamCigaretu : mamPoldeci) ? platbaVolba : mamCigaretu ? "cigareta" : mamPoldeci ? "poldeci" : null;
  const mozemBrat = beriem && somNaTahu && view.senok.length > 0 && (kredit > 0 || platba !== null);
  // Limit vykladania v tomto kole teraz a po zaplatení poldeci — draft ho znižuje (E1, playtest 20261016-155120).
  const limitTeraz = limitZhromazdenia(view, ja);
  const limitPoVzati = limitZhromazdenia(view, ja, platba === "poldeci" ? -1 : 0);
  const zoSenkuLimit = somNaTahu && mode.typ === "liecbaSenok" ? 1 : 0;
  // Keď hráč má vyberať lokalitu alebo karty zo šenku, vrstva sa otvorí sama
  // (žiadny klik navyše). Raz za fázu — ak ju zavrie (napr. ide na staršieho),
  // znova sa nevnucuje; otvorí ju tlačidlom „späť na výber“.
  const chceVrstvu: Vrstva | null = !somNaTahu || view.koniec !== null
    ? null
    : view.volbaVestica !== null
        ? "vestica"
    : view.faza === "volbaCiela" && navrh?.typ !== "lokalita" && navrh?.typ !== "starsi"
      ? "lokality"
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
  const { stol, lineEval, odhad } = useMemo(() => {
    let strany = view.strany;
    let hraci = view.hraci;
    if (vylozene !== null && (vylozene.ciel === "vlastna" || vylozene.ciel === "superova")) {
      const kam = vylozene.ciel === "vlastna" ? ja : super_;
      const nova: readonly PlacedCard[] = [...view.strany[kam], { card: vylozene.karta, playedBy: ja }];
      strany = kam === 0 ? [nova, view.strany[1]] : [view.strany[0], nova];
    } else if (vylozene !== null) {
      const h = view.hraci[ja];
      const novy =
        vylozene.ciel === "priznanie"
          ? { ...h, priznane: [...h.priznane, vylozene.karta] }
          : { ...h, dedicstvo: [...h.dedicstvo, vylozene.karta] };
      hraci = ja === 0 ? [novy, view.hraci[1]] : [view.hraci[0], novy];
    }
    const ciel =
      lokalitaNavrh !== null
        ? { typ: "lokalita" as const, lokalita: lokalitaNavrh.karta, elderId: null }
        : starsiNavrh !== null
          ? { typ: "starsi" as const, lokalita: starsiNavrh.elder.karta, elderId: starsiNavrh.elder.elderId }
          : view.ciel;
    const stol: VerejnyStav = { ciel, ovladnute: view.ovladnute, strany, starsi: view.starsi, hraci };
    // V strede leží lokalita, v bitke o staršieho karta staršieho.
    // lineState: rovnaká línia ako na serveri (aj Pasca v Dedičstve).
    const lineEval = evaluateLine(
      data,
      lineState({ ...stol, lokalitaOtocena: lokalitaNavrh?.otocena ?? starsiNavrh?.otocena ?? view.lokalitaOtocena }),
    );
    // Absťáky v ruke: svoje poznáš (bez karty, ktorá už leží na stole), súperove nie.
    const mojeAbstaky = view.ruka.filter((k) => k.defId === "abstak" && k.uid !== vylozene?.karta.uid).length;
    const odhad =
      ciel === null ? null : poskodenieBitky(data, stol, lineEval.sums, ja === 0 ? [mojeAbstaky, 0] : [0, mojeAbstaky]);
    return { stol, lineEval, odhad };
    // vylozene a lokalitaNavrh sú odvodené len z navrh a view.
  }, [data, view, navrh, somNaTahu]);

  // NA EX na Občana alebo Starešinu v línii — vlastného aj súperovho (Michal 2026-10-18).
  const naexCiele = useMemo(() => new Set(naexCieleVLinii(data, view.strany)), [data, view.strany]);

  // Kedy NA EX dať môžem — karty, ktoré ho prijmú, nesú v línii značku.
  const pitka = view.pitkaStav;
  const naexMozny =
    somNaTahu &&
    view.faza === "pitka" &&
    pitka !== null &&
    pitka.reakcia === null &&
    !pitka.naexPouzity[ja] &&
    view.hraci[ja].poldeciPlne > 0;
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

  // Náhľad NA EX: bitka a tvoje akcie pred a po — hráč vidí výsledok skôr, než ho potvrdí.
  const nahladNaex = useMemo(() => {
    const out = new Map<number, { tuhe: readonly [number, number]; celkove: readonly [number, number]; zmeny: string[] }>();
    if (mode.typ !== "naexCiel" || odhad === null) return out;
    const mojeAbstaky = view.ruka.filter((k) => k.defId === "abstak").length;
    for (const uid of naexCiele) {
      const strany = view.strany.map((s) => s.map((pl) => (pl.card.uid === uid ? { ...pl, naexBy: ja } : pl))) as unknown as typeof view.strany;
      const ev = evaluateLine(data, { ...lineState(view), strany });
      const d = poskodenieBitky(data, { ...stol, strany }, ev.sums, ja === 0 ? [mojeAbstaky, 0] : [0, mojeAbstaky]);
      const kluce = new Set([...Object.keys(ev.sums[ja]), ...Object.keys(lineEval.sums[ja])]) as Set<keyof (typeof ev.sums)[0]>;
      const zmeny: string[] = [];
      for (const k of kluce) {
        const rozdiel = (ev.sums[ja][k] ?? 0) - (lineEval.sums[ja][k] ?? 0);
        if (rozdiel !== 0) zmeny.push(`${sada.akcie.find((a) => a.kluc === k)?.nazov ?? k} ${rozdiel > 0 ? "+" : "−"}${Math.abs(rozdiel)}`);
      }
      out.set(uid, { tuhe: d.tuhe, celkove: d.celkove, zmeny });
    }
    return out;
  }, [mode.typ, naexCiele, data, view, stol, lineEval, odhad, ja, sada]);

  // Náhľad vyloženia na koniec strany (playtest 20261017-164450: ktorá hrana
  // sa spáruje, hráči zisťovali skúškou) — počas ťahania aj v návrhu.
  const nahladVylozeniaNa = (k: CardInstance, kam: "vlastna" | "superova"): NahladVylozenia =>
    nahladVylozenia(data, lineState(view), ja, k, kam);
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
    if (vylozene === null || (vylozene.ciel !== "vlastna" && vylozene.ciel !== "superova")) return null;
    const n = nahladVylozeniaNa(vylozene.karta, vylozene.ciel);
    return { n, spoj: textSpoja(n), ja: textZmien(n.zmeny[ja]), su: textZmien(n.zmeny[super_]) };
    // vylozene je odvodené z navrh a view.
  }, [data, view, navrh, ja, super_, sada]);

  // Kroky s výberom viacerých kariet si pri začiatku pripravia prázdny výber.
  const bs0 = view.bitkaStav;
  const krokVyberu: string | null =
    bs0 !== null && bs0.caka === ja ? (bs0.krok ?? null) : null;
  useEffect(() => {
    if (krokVyberu === "benzinka" || krokVyberu === "limitRuky") setMode({ typ: "vyber", uids: [] });
    else if (krokVyberu === "vestica") setMode({ typ: "vestica", moja: null, jeho: null });
  }, [krokVyberu, klucTahu]);

  const posli = (c: Command): void => {
    cmd(c);
    setMode({ typ: "ziadny" });
    setNavrh(null);
    setVyberLokality(null);
  };

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
      out.add(SMETISKO);
      out.add(SENOK_STAVBA);
      if (stavba.doSenku === z.karta.uid || stavba.odhod === z.karta.uid) out.add(BALICEK_STAVBY);
    }
    if (z.odkial === "senok" && !z.navrh && mozemBrat) out.add("ruka");
    const zs = view.zhromazdenieStav;
    if (z.odkial === "ruka" && view.faza === "zhromazdenie" && zs !== null && !zs.pasoval[ja]) {
      for (const c of cieleVykladania(data, view.strany, ja, z.karta, zs.zostavaLimit[ja], view.hraci[ja].cigarety)) out.add(c);
      if (z.navrh) out.add("ruka");
    }
    if (z.odkial === "ruka" && reagujem) {
      for (const c of cieleVykladania(data, view.strany, ja, z.karta, Number.POSITIVE_INFINITY)) {
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
    // Mimo povoleného miesta sa karta vráti tam, kde bola.
    if (ciel === null || !cieleZdroja(z).has(ciel)) return;
    if (ciel.startsWith(PORADIE)) {
      const kam = ciel.slice(PORADIE.length);
      presunVRuke(z.karta.uid, kam === "koniec" ? null : Number(kam));
      return;
    }
    if (z.odkial === "stavba") {
      doZonyStavby(z.karta.uid, ciel === SMETISKO ? "odhod" : ciel === SENOK_STAVBA ? "doSenku" : null);
      return;
    }
    if (z.odkial === "senok" && !z.navrh && mozemBrat && ciel === "ruka") {
      setNoveZoSenku((n) => ({ kolo: view.kolo, uids: [...(n.kolo === view.kolo ? n.uids : []), z.karta.uid] }));
      posli(platba === null ? { type: "draftBer", uid: z.karta.uid } : { type: "draftBer", uid: z.karta.uid, platba });
      return;
    }
    if (z.odkial === "ruka") {
      if (ciel === "ruka") setNavrh(null);
      else if (jeCielVykladania(ciel)) setNavrh({ typ: "vylozenie", uid: z.karta.uid, ciel });
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
  const [lupa, setLupa] = useState<{ readonly kluc: string; readonly rect: DOMRect } | null>(null);
  // Čo je pod lupou v tomto prekreslení — lupa kreslí vždy živý stav.
  const lupaKarty = new Map<
    string,
    { readonly render: (sirka: number) => ReactNode; readonly mierka?: number; readonly zdroj?: Zdroj }
  >();
  /** Vzpriamená karta leží nižšie — ilustrácie susedov sú v jednej výške (viď posunVzpriamenej). */
  const posunVLinii = (defId: string, otocena: boolean): number =>
    otocena ? 0 : posunVzpriamenej(sada, data, defId, sirkaVLinii);
  const vLinii = (obsah: ReactNode, defId: string, otocena: boolean, kluc?: number): ReactNode => (
    <div key={kluc} className="v-linii" style={{ marginTop: posunVLinii(defId, otocena) }}>
      {obsah}
    </div>
  );
  /**
   * Karta, ktorá sa pod myšou zväčší (narovnaná, aby sa dala čítať).
   * `obsah` nahradí holú kartu (napr. ťahateľným obalom), `zdroj` dovolí
   * chytiť ju aj zo zväčšenej kópie, `vLinii` ju posunie ako v línii.
   */
  const sLupou = (
    props: Omit<HernaKartaProps, "sada" | "data">,
    moznosti: {
      readonly obsah?: ReactNode;
      readonly zdroj?: Zdroj;
      readonly vLinii?: boolean;
      readonly kluc?: number;
      readonly trieda?: string | undefined;
    } = {},
  ): ReactNode => {
    const uid = props.karta.uid;
    const kluc = `k${uid}`;
    const render = (sirka: number): ReactNode => karta({ ...props, otocena: false, sirka });
    lupaKarty.set(kluc, moznosti.zdroj === undefined ? { render } : { render, zdroj: moznosti.zdroj });
    return (
      <div
        key={moznosti.kluc ?? uid}
        className={moznosti.trieda === undefined ? "s-lupou" : `s-lupou ${moznosti.trieda}`}
        style={moznosti.vLinii === true ? { marginTop: posunVLinii(props.karta.defId, props.otocena === true) } : undefined}
        onMouseEnter={(e) => {
          const kl = e.currentTarget.querySelector(".kl");
          if (tahanie === null && kl !== null) setLupa({ kluc, rect: kl.getBoundingClientRect() });
        }}
      >
        {moznosti.obsah ?? karta(props)}
      </div>
    );
  };
  const aktivneCiele: ReadonlySet<string> = tahanie === null ? new Set() : cieleZdroja(tahanie.zdroj);
  const jeCiel = (c: string): boolean => aktivneCiele.has(c);
  const nadCielom = (c: string): boolean => tahanie?.ciel === c && jeCiel(c);

  /** Karta, ktorú možno chytiť; s `ciel` je zároveň miestom na nahradenie. */
  const tahatelna = (z: Zdroj, obsah: ReactNode, kluc?: number, ciel?: string, trieda?: string): ReactNode => {
    const moze = cieleZdroja(z).size > 0;
    const ide = tahanie?.zdroj.karta.uid === z.karta.uid;
    const nahraditelna = ciel !== undefined && !ide && jeCiel(ciel);
    const poradie = ciel?.startsWith(PORADIE) === true;
    const triedy = trieda === undefined ? ["tahatelna"] : ["tahatelna", trieda];
    if (moze) triedy.push("chytitelna");
    if (ide) triedy.push("tahana");
    if (z.navrh) triedy.push("navrh");
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
      return naexCiele.has(uid) ? () => posli({ type: "naex", uid }) : undefined;
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
    return poradie.map((placed) =>
      sLupou({
        karta: placed.card,
        sirka: sirkaVLinii,
        otocena: placed.playedBy !== ja,
        eval: lineEval.cards.get(placed.card.uid) ?? null,
        naex: placed.naexBy === undefined ? undefined : menoHraca(placed.naexBy),
        onClick: klikLinia(placed.playedBy, placed.card.uid),
        vybrana:
          (mode.typ === "naexCiel" && naexCiele.has(placed.card.uid)) ||
          (mode.typ === "vyber" && benzinkaCiele.has(placed.card.uid) && mode.uids.includes(placed.card.uid)),
      }, { vLinii: true, trieda: naexMozny && naexCiele.has(placed.card.uid) ? "naex-mozny" : undefined }),
    );
  };
  /** Vonkajší koniec strany: vyložený návrh, alebo počas ťahania voľné miesto. */
  const koniecStrany = (p: PlayerId): ReactNode => {
    const ciel: CielVykladania = p === ja ? "vlastna" : "superova";
    if (vylozene !== null && vylozene.ciel === ciel) {
      const z: Zdroj = { karta: vylozene.karta, odkial: "ruka", navrh: true };
      const props = {
        karta: vylozene.karta,
        sirka: sirkaVLinii,
        eval: lineEval.cards.get(vylozene.karta.uid) ?? null,
        hranaVnutorna: nahladSpojov?.n.vnutornaVytlacena,
      };
      return sLupou(props, { obsah: tahatelna(z, karta(props), undefined, ciel), zdroj: z, vLinii: true, kluc: -1 });
    }
    // Počas ťahania z ruky ukáže miesto ešte pred pustením, s čím sa karta spojí.
    const nazovMiesta = p === ja ? "na tvoju stranu" : "na súperovu stranu";
    const n = tahanie !== null && tahanie.zdroj.odkial === "ruka" && jeCiel(ciel) ? nahladVylozeniaNa(tahanie.zdroj.karta, ciel) : null;
    const popis =
      n === null ? (
        nazovMiesta
      ) : (
        <span className="nahlad-miesto">
          <strong>{nazovMiesta}</strong>
          <span>k lokalite ide tvoja {n.vnutornaVytlacena === "left" ? "ľavá" : "pravá"} hrana</span>
          <span className={n.pary.length > 0 ? "nm-spoj" : "nm-bez"}>{textSpoja(n)}</span>
          <span>ty: {textZmien(n.zmeny[ja])}</span>
          <span>
            {menoHraca(super_)}: {textZmien(n.zmeny[super_])}
          </span>
        </span>
      );
    const m = miesto(ciel, popis, sirkaVLinii);
    return m === null ? null : vLinii(m, tahanie?.zdroj.karta.defId ?? "", false, -2);
  };
  const radStrany = (p: PlayerId): ReactNode => {
    const koniec = koniecStrany(p);
    const karty = view.strany[p].length === 0 ? null : kartyStrany(p);
    if (koniec === null && karty === null) return vLinii(<span className="prazdna">prázdna</span>, "", false);
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
    const obsah =
      vylozene !== null && vylozene.ciel === ciel
        ? tahatelna({ karta: vylozene.karta, odkial: "ruka", navrh: true }, karta({ karta: vylozene.karta, sirka: 104 }), -1, ciel)
        : miesto(ciel, nazov, 104);
    if (obsah === null) return null;
    return (
      <div className="odkladanie-zona" key={ciel}>
        <span className="popis">{nazov}</span>
        {obsah}
        <span className="odkladanie-pozn">{pozn}</span>
      </div>
    );
  };
  const odkladacieZony = [
    odkladanie("priznanie", "priznať", "navždy z balíčka · nemíňa limit · Dlh: hneď dobereš kartu, ráta ho Exekútor · Cirhóza: po bitke odomkne Liečbu a Pohreb"),
    odkladanie("dedicstvo", "do Dedičstva", `pasívny efekt · stojí ${KONSTANTY.CENA_DEDICSTVA} cigarety · nemíňa limit`),
  ].filter(
    (z) => z !== null,
  );

  // V strede leží lokalita, v bitke o staršieho karta staršieho (Michal 2026-10-12).
  const lokalita = view.ciel?.lokalita ?? null;
  // Natočenie lokality je v ráme hráča 1 opačné.
  const lokalitaNavrhOtocena = lokalitaNavrh !== null && lokalitaNavrh.otocena !== (ja === 1);
  const starsiNavrhOtocena = starsiNavrh !== null && starsiNavrh.otocena !== (ja === 1);
  // Ktorá hrana stredu je obrátená ku ktorej strane (playtest 20261017-164450:
  // Eva kvôli otočeniu lokality dala súperovi Petelicu). Natočenie je v ráme hráča 0.
  const stredKarta = starsiNavrh?.elder.karta ?? lokalitaNavrh?.karta ?? lokalita;
  const stranyStredu =
    stredKarta === null
      ? null
      : stranyLokality(data, stredKarta, starsiNavrh?.otocena ?? lokalitaNavrh?.otocena ?? view.lokalitaOtocena, ja);
  // Pod kartou len krátke štítky — akcie hrán vidno na karte samej.
  const popisStranStredu =
    stranyStredu === null ? null : (
      <span className="strany-stredu">
        <span title="Táto hrana sa spojí s prvou kartou na tvojej strane — jej akcie dostane majiteľ tej karty.">◀ k tebe</span>
        <span title="Táto hrana sa spojí s prvou kartou na súperovej strane — jej akcie dostane majiteľ tej karty.">k súperovi ▶</span>
      </span>
    );
  const ikonyStranStredu =
    stranyStredu === null ? null : (
      <span className="strany-stredu-ikony">
        k tebe {hranaIkony(stranyStredu.kTebe)} · k súperovi {hranaIkony(stranyStredu.kSuperovi)}
      </span>
    );
  const stredLinie = ((): ReactNode => {
    if (starsiNavrh !== null) {
      return vLinii(
        karta({
          karta: starsiNavrh.elder.karta,
          sirka: sirkaVLinii,
          otocena: starsiNavrhOtocena,
          eval: lineEval.cards.get(starsiNavrh.elder.karta.uid) ?? null,
          onClick: () => setNavrh({ typ: "starsi", elderId: starsiNavrh.elder.elderId, otocena: !starsiNavrh.otocena }),
        }),
        starsiNavrh.elder.karta.defId,
        starsiNavrhOtocena,
      );
    }
    if (lokalita !== null) {
      return sLupou({
        karta: lokalita,
        sirka: sirkaVLinii,
        otocena: view.lokalitaOtocena !== (ja === 1),
        eval: lineEval.cards.get(lokalita.uid) ?? null,
      }, { vLinii: true });
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
        ),
        lokalitaNavrh.karta.defId,
        lokalitaNavrhOtocena,
      );
    }
    return vLinii(
      miesto("lokalita", "polož lokalitu sem", sirkaVLinii) ?? (
        <span className="prazdna lokalita-miesto">vyberá sa…</span>
      ),
      tahanie?.zdroj.karta.defId ?? "",
      false,
    );
  })();

  // ---- pás pokynov nad rukou: čo robiť teraz -------------------------------
  const otvorVrstvu = (v: Vrstva): ReactNode => (
    <button onClick={() => setVrstva(v)}>{v === "senok" ? "otvoriť šenok" : "otvoriť lokality"}</button>
  );
  const pokyn: Pokyn | null = (() => {
    if (view.koniec !== null) {
      return {
        nadpis: view.koniec.vitaz === null ? "Remíza" : view.koniec.vitaz === ja ? "Vyhral si!" : "Prehral si",
        text: (
          <>
            {view.koniec.dovod.replace(/Hráč ([12])/g, (_, n: string) => menoHraca((Number(n) - 1) as PlayerId))}
            {view.koniec.body !== null && ` Body ${view.koniec.body[ja]}:${view.koniec.body[super_]} (ty : ${menoHraca(super_)}).`}
            {frajerina !== null && <ZmenaFrajeriny pred={frajerina[ja].pred} po={frajerina[ja].po} />}
          </>
        ),
        tlacidla: (
          <button className="tlacidlo-hlavne" onClick={opustit}>
            späť do lobby
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
            Vybral si. Čakáš, kým <strong>{menoHraca(super_)}</strong> vyberie kartu do šenku
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
        if (starsiNavrh !== null) {
          // Náhľad bitky o staršieho (Michal 2026-10-12): víťaz dá marker do sivej,
          // jeho strach prestane bodovať, víťazovi pribudne získaný starší.
          const n = nahladBitkyOStarsieho(data, view, starsiNavrh.elder.elderId);
          const b2 = (v: readonly [number, number]): string => `${v[ja]}:${v[super_]}`;
          return {
            nadpis: "Bitka o staršieho",
            text: (
              <>
                <strong>{menoKarty(starsiNavrh.elder.karta.defId)}</strong> v strede{starsiNavrhOtocena ? " (otočený)" : ""} — klikom
                ho otočíš. Body ty:súper teraz <b>{b2(n.teraz)}</b>, ak vyhráš <b>{b2(n.vyhra[ja])}</b>, ak prehráš{" "}
                <b>{b2(n.vyhra[super_])}</b> (bez prebytku).
              </>
            ),
            tlacidla: (
              <>
                <button onClick={() => setNavrh(null)}>← späť</button>
                <button onClick={() => setNavrh({ typ: "starsi", elderId: starsiNavrh.elder.elderId, otocena: !starsiNavrh.otocena })}>
                  otočiť ↻
                </button>
                <button
                  className="tlacidlo-hlavne"
                  onClick={() => posli({ type: "chooseElder", elderId: starsiNavrh.elder.elderId, otocena: starsiNavrh.otocena })}
                >
                  vyvolať bitku
                </button>
              </>
            ),
          };
        }
        return lokalitaNavrh === null
          ? {
              nadpis: "Cieľ kola",
              text: "Vyber lokalitu (klikni a umiestni), alebo klikni na staršieho hore.",
              tlacidla: <button onClick={() => setVrstva("lokality")}>vybrať lokalitu</button>,
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
              tlacidla: (
                <>
                  <button
                    onClick={() => {
                      setNavrh(null);
                      setVrstva("lokality");
                    }}
                  >
                    ← späť na výber
                  </button>
                  <button onClick={() => setNavrh({ typ: "lokalita", uid: lokalitaNavrh.karta.uid, otocena: !lokalitaNavrh.otocena })}>
                    otočiť ↻
                  </button>
                  <button
                    className="tlacidlo-hlavne"
                    onClick={() =>
                      posli({ type: "chooseLocation", uid: lokalitaNavrh.karta.uid, otocena: lokalitaNavrh.otocena })
                    }
                  >
                    potvrdiť
                  </button>
                </>
              ),
            };

      case "draft": {
        if (draft === null) return null;
        if (draft.krok === "stavba") {
          return {
            nadpis: "Stavba šenku",
            text: (
              <>
                Potiahni jednu kartu na <strong>Smetisko</strong> (vľavo — naspodok spoločného balíčka, súper ju neuvidí) a jednu do{" "}
                <strong>Šenku</strong> (vpravo — uvidia ju obaja). Zvyšok podáš {menoHraca(super_)}. Vyberáte naraz.
              </>
            ),
            tlacidla: (
              <button className="tlacidlo-hlavne" disabled={stavba.doSenku === null || stavba.odhod === null} onClick={potvrdStavbu}>
                potvrdiť
              </button>
            ),
          };
        }
        return {
          nadpis: "Branie zo šenku",
          text: mozemBrat ? (
            <>
              <strong>Tvoj ťah</strong> — potiahni kartu zo šenku do ruky (
              {kredit > 0
                ? "druhá karta za už zaplatený poldeci"
                : platba === "cigareta"
                  ? "za cigaretu"
                  : `za plný poldeci dve karty, limit ${limitTeraz} → ${limitPoVzati}`}
              ), alebo už neber (limit {limitTeraz}).
            </>
          ) : view.senok.length === 0 ? (
            "Šenok je prázdny."
          ) : (
            `Nemáš cigaretu ani plný poldeci — zo šenku už nevezmeš. Limit vykladania v tomto kole: ${limitTeraz}.`
          ),
        };
      }

      case "zhromazdenie": {
        const zostava = view.zhromazdenieStav?.zostavaLimit[ja] ?? 0;
        const navyse = view.zhromazdenieStav?.navyse[ja] ?? 0;
        const plne = view.hraci[ja].poldeciPlne;
        const nadpis = (
          <>
            Zhromaždenie <small>limit {zostava}</small>
          </>
        );
        const doDna = (
          <button
            className="tlacidlo-dodna"
            disabled={plne === 0 || zostava === 0}
            onClick={() => posli({ type: "vypit" })}
            title={
              plne === 0
                ? "Nemáš plný poldeci."
                : zostava === 0
                  ? "Limit je vyčerpaný — vypitie by nič nepridalo."
                  : zostava === 1
                    ? "Pozor: limit ti klesne z 1 na 0 — po vypití už nič nevyložíš."
                    : `Vypiť do dna: otočíš plný poldeci na vypitý. Limit ti hneď klesne z ${zostava} na ${zostava - 1}, zato ďalšia karta neukončí ťah${zostava >= 3 ? ` (${zostava - 1} karty za sebou)` : ""}. Pečeň +1 (vyhodnotí sa v najbližšej Pitke).`
            }
          >
            do dna! <span className="cena">limit {zostava} → {Math.max(0, zostava - 1)}</span>
          </button>
        );
        // Fajčiť smie hráč kedykoľvek na svojom ťahu (Michal 2026-10-16) — cigareta = karta hneď.
        const fajcit = (
          <button
            disabled={view.hraci[ja].cigarety === 0}
            title="Fajčiť: za cigaretu si hneď doberieš kartu. Ťah ti neskončí, ráta sa ako nerest."
            onClick={() => cmd({ type: "smoke", pocet: 1 })}
          >
            fajčiť <span className="cena">−1 cig.</span>
          </button>
        );
        return vylozene === null
          ? {
              nadpis,
              text:
                textNahladuTahania ??
                (navyse > 0 ? (
                  <span className="dodna-text">
                    Do dna! Ťah ti neskončí — vylož ešte <strong>{navyse + 1}</strong> {navyse + 1 === 1 ? "kartu" : "karty"} za sebou.
                  </span>
                ) : (
                  "Potiahni kartu z ruky na stôl, alebo pasuj."
                )),
              tlacidla: (
                <>
                  {fajcit}
                  {doDna}
                  <button onClick={() => posli({ type: "pass" })}>pasovať</button>
                </>
              ),
            }
          : {
              nadpis,
              text: (
                <>
                  <strong>{menoKarty(vylozene.karta.defId)}</strong> → {POPIS_CIELA[vylozene.ciel]}
                  {nahladSpojov !== null && (
                    <span className="nahlad-spojov">
                      {" "}· {nahladSpojov.spoj} · ty: {nahladSpojov.ja} · {menoHraca(super_)}: {nahladSpojov.su}
                    </span>
                  )}
                </>
              ),
              tlacidla: (
                <>
                  <button onClick={() => setNavrh(null)}>vrátiť do ruky</button>
                  <button
                    className="tlacidlo-hlavne"
                    onClick={() => posli({ type: "place", uid: vylozene.karta.uid, target: vylozene.ciel })}
                  >
                    potvrdiť
                  </button>
                </>
              ),
            };
      }

      case "pitka": {
        const hracJa = view.hraci[ja];
        const pitkaSt = view.pitkaStav;
        const naexBol = pitkaSt?.naexPouzity[ja] === true;
        const nadpis = `Pitka ${view.pitkaCislo}/${view.pitkyCelkom}`;
        if (reagujem) {
          // Reakcia na súperovo NA EX (Michal 2026-10-12): jedna karta mimo limitu.
          return vylozene === null
            ? {
                nadpis: "Odpoveď na NA EX",
                text: textNahladuTahania ?? (
                  <>
                    {menoHraca(super_)} dal NA EX — môžeš hneď vyložiť <strong>jednu kartu</strong> z ruky (limit nemíňa), napr. aby si
                    jeho neaktívne akcie spároval a NA EX ich zrušil.
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
                  </>
                ),
                tlacidla: (
                  <>
                    <button onClick={() => setNavrh(null)}>vrátiť do ruky</button>
                    <button className="tlacidlo-hlavne" onClick={() => posli({ type: "place", uid: vylozene.karta.uid, target: vylozene.ciel })}>
                      potvrdiť
                    </button>
                  </>
                ),
              };
        }
        if (mode.typ === "naexCiel") {
          const teraz = odhad;
          return {
            nadpis,
            text: (
              <span className="naex-vyber">
                NA EX zruší aktívne akcie karty a zdvojí neaktívne. Cena: pečeň +1 a poldeci sa pri bitke vypije — v ďalšom kole
                budeš mať limit vykladania o 1 nižší (doliať: 2 cigarety). Súper smie hneď odpovedať jednou kartou.
                <span className="naex-nahlad" role="group" aria-label="Náhľad NA EX">
                {[...naexCiele].map((uid) => {
                  const n = nahladNaex.get(uid);
                  const karta = view.strany.flat().find((pl) => pl.card.uid === uid)?.card;
                  if (n === undefined || karta === undefined || teraz === null) return null;
                  const pred = teraz.tuhe;
                  const lepsie = n.tuhe[ja] - n.tuhe[super_] > pred[ja] - pred[super_];
                  const horsie = n.tuhe[ja] - n.tuhe[super_] < pred[ja] - pred[super_];
                  return (
                    <button
                      key={uid}
                      className={`naex-moznost ${lepsie ? "lepsie" : horsie ? "horsie" : ""}`}
                      onClick={() => posli({ type: "naex", uid })}
                    >
                      <strong>{menoKarty(karta.defId)}</strong>
                      <span>
                        bitka {pred[ja]}:{pred[super_]} → <b>{n.tuhe[ja]}:{n.tuhe[super_]}</b>
                      </span>
                      <span className="tlmene">{n.zmeny.length > 0 ? n.zmeny.join(", ") : "akcie bez zmeny"}</span>
                    </button>
                  );
                })}
                </span>
              </span>
            ),
            tlacidla: <button onClick={() => setMode({ typ: "ziadny" })}>zrušiť</button>,
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
        // Prečo NA EX nejde — hráč to vidí hneď, nielen v tooltipe.
        const dovodBezNaex = naexBol
          ? "NA EX si v tejto Pitke už dal."
          : hracJa.poldeciPlne === 0
            ? "Nemáš plný poldeci (doliať: 2 cigarety)."
            : naexCiele.size === 0
              ? "NA EX ide len na Občana či Starešinu v línii (nie Nástroj, nie Liberál, nie k Anonymnému alkoholikovi)."
              : null;
        const krcma = view.ciel?.lokalita?.defId === "krcma" && dovodBezNaex === null;
        const postarkaKarty = KONSTANTY.EFEKT.POSTARKA_KARTY;
        const cenaBarteru = barterCena(data, view, ja);
        const mamEfekt = (defId: string): boolean =>
          [...view.strany[0], ...view.strany[1]].some((pl) => pl.playedBy === ja && pl.card.defId === defId);
        const postarka = mamEfekt("postarka") && pitkaSt?.postarka[ja] !== true;
        const starosta = mamEfekt("starosta") && pitkaSt?.starosta[ja] !== true && hracJa.cigarety > 0;
        return {
          nadpis,
          text: krcma ? (
            <strong>Krčma: kým máš plný poldeci, musíš dať NA EX.</strong>
          ) : dovodBezNaex !== null ? (
            <>
              Fajči (karta za cigaretu), doliať poldeci (2 cig.) alebo kúp nový poldeci (5 cig.) — potom hotovo.{" "}
              <span className="tlmene">{dovodBezNaex}</span>
            </>
          ) : (
            <>
              Daj NA EX (karty so značkou ho prijmú), fajči, doliať poldeci (2 cig.) alebo kúp nový poldeci (5 cig.) — potom hotovo.{" "}
              <span className="tlmene">
                NA EX sa pri bitke vypije: v ďalšom kole limit {limitBuduceKolo(view, ja, true)} (bez NA EX {limitBuduceKolo(view, ja)}).
              </span>
            </>
          ),
          tlacidla: (
            <>
              <button
                className="tlacidlo-naex"
                disabled={dovodBezNaex !== null}
                title={
                  dovodBezNaex ??
                  `Polož plný poldeci na Občana alebo Starešinu v línii — svojho aj súperovho. Ukážem ti náhľad bitky. Poldeci sa pri bitke vypije: v ďalšom kole limit ${limitBuduceKolo(view, ja, true)} namiesto ${limitBuduceKolo(view, ja)}.`
                }
                onClick={() => setMode({ typ: "naexCiel" })}
              >
                NA EX!
              </button>
              {postarka &&
                Array.from({ length: postarkaKarty }, (_, i) => i + 1).map((n) => (
                  <button key={`p${n}`} title={`Poštárka: dober karty navyše a s nimi ${KONSTANTY.EFEKT.POSTARKA_DLHY} Dlh.`} onClick={() => cmd({ type: "postarka", pocet: n })}>
                    Poštárka +{n}
                  </button>
                ))}
              {starosta && (
                <button title="Starosta: za cigaretu vymeň kartu z ruky za kartu zo šenku." onClick={() => setMode({ typ: "starosta", rukaUid: null })}>
                  Starosta <span className="cena">−1</span>
                </button>
              )}
              <button
                disabled={hracJa.cigarety === 0}
                title="Fajčiť: za cigaretu si hneď doberieš kartu (Vízia ju v tejto Pitke preosieje). Ráta sa ako nerest."
                onClick={() => cmd({ type: "smoke", pocet: 1 })}
              >
                fajčiť <span className="cena">−1 cig.</span>
              </button>
              {/* Michal 2026-10-18: doliatie a barter sa nedali nájsť — jasné názvy a zvýraznenie, keď na ne máš. */}
              <button
                className={`tlacidlo-cigarety ${hracJa.cigarety >= KONSTANTY.REFILL_CENA && hracJa.poldeciVypite > 0 ? "mozne" : ""}`}
                disabled={hracJa.cigarety < KONSTANTY.REFILL_CENA || hracJa.poldeciVypite === 0}
                onClick={() => cmd({ type: "refillPoldeci" })}
                title={
                  hracJa.poldeciVypite === 0
                    ? "Nemáš vypitý poldeci, ktorý by sa dal doliať."
                    : `Doliať poldeci: za ${KONSTANTY.REFILL_CENA} cigarety otočíš vypitý poldeci späť na plný (máš ${hracJa.cigarety}).`
                }
              >
                doliať poldeci <span className="cena">−{KONSTANTY.REFILL_CENA} cig.</span>
              </button>
              <button
                className={`tlacidlo-cigarety ${hracJa.cigarety >= cenaBarteru ? "mozne" : ""}`}
                disabled={hracJa.cigarety < cenaBarteru}
                onClick={() => cmd({ type: "barter" })}
                title={`Stokársky barter: za ${cenaBarteru} cigariet dostaneš NOVÝ plný poldeci navyše — máš o poldeci viac natrvalo (máš ${hracJa.cigarety} cig.).`}
              >
                nový poldeci <span className="cena">−{cenaBarteru} cig.</span>
              </button>
              <button
                className="tlacidlo-hlavne"
                disabled={krcma}
                title={krcma ? "Krčma: najprv daj NA EX." : undefined}
                onClick={() => posli({ type: "skipNaex" })}
              >
                hotovo
              </button>
            </>
          ),
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
                zahodíš (vybraní: {vybrane.length}).
              </>
            ),
            tlacidla: (
              <button className="tlacidlo-hlavne" disabled={vybrane.length !== treba} onClick={() => posli({ type: "benzinka", uids: vybrane })}>
                zahodiť
              </button>
            ),
          };
        }
        if (b.krok === "vestica") {
          const v = mode.typ === "vestica" ? mode : { moja: null, jeho: null };
          return {
            nadpis: "Veštica",
            text: "Prehral si — vyber po jednej karte z oboch doberacích balíčkov, vymenia sa a balíčky sa zamiešajú.",
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
        if (b.krok === "limitRuky") {
          const vybrane = mode.typ === "vyber" ? mode.uids : [];
          const treba = view.ruka.length - view.limitRuky[ja];
          return {
            nadpis: (
              <>
                Limit ruky <small>{view.limitRuky[ja]}</small>
              </>
            ),
            text: (
              <>
                Na konci kola smieš mať v ruke najviac {view.limitRuky[ja]} kariet (6 + priazeň Zberateľa). Klikni na{" "}
                <strong>{treba}</strong> {treba === 1 ? "kartu" : "karty"}, ktoré odhodíš do odhadzovacieho balíčka (vybrané: {vybrane.length}).
              </>
            ),
            tlacidla: (
              <button className="tlacidlo-hlavne" disabled={vybrane.length !== treba} onClick={() => posli({ type: "odhod", uids: vybrane })}>
                odhodiť
              </button>
            ),
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
            text: "Klikni na staršieho hore — marker sa posunie k súperovi: on dostane priazeň, starší sa začne báť teba (zónové body, cesta k vydeseniu). Zamknuté markery sa nedajú.",
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
                Klikni na staršieho hore — marker ide k súperovi (on priazeň, teba sa starší začne báť).{" "}
                {cenaPosunu > 1 ? (
                  <strong>Posun ťa stojí {cenaPosunu} (Miňištrant v tvojej partii).</strong>
                ) : (
                  "Posun stojí 1."
                )}
              </>
            ),
          };
        }
        if (b.krok === "nahrada") {
          if (mode.typ === "nahradaMarker") {
            return {
              nadpis: "Náhrada staršieho",
              text: (
                <>
                  <strong>{menoKarty(mode.defId)}</strong> — kam s markerom?
                </>
              ),
              tlacidla: [3, 4, 5].map((m) => (
                <button
                  key={m}
                  onClick={() => posli({ type: "nahrada", defId: mode.defId, kde: mode.kde, marker: m as 3 | 4 | 5 })}
                >
                  pozícia {m}
                </button>
              )),
            };
          }
          return {
            nadpis: "Náhrada staršieho",
            text: "Vyber Občana alebo Zviera, ktorý nahradí staršieho.",
            tlacidla: (view.volbyNahrada ?? []).map((v, i) => (
              <button key={i} onClick={() => setMode({ typ: "nahradaMarker", defId: v.defId, kde: v.kde })}>
                {menoKarty(v.defId)} <span className="cena">{v.kde}</span>
              </button>
            )),
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
  const klikStarsi = (elder: ElderState): { readonly akcia: string; readonly klik: () => void } | undefined => {
    if (!somNaTahu) return undefined;
    // O náhradu staršieho sa nebojuje (Michal 2026-10-12); bitka ide najprv ako návrh s náhľadom.
    if (view.faza === "volbaCiela" && !elder.nahradeny && STUPNICA_ZONY[elder.marker] >= 2) {
      return {
        akcia: "vyvolať bitku",
        klik: () => {
          setNavrh({ typ: "starsi", elderId: elder.elderId, otocena: ja === 1 });
          setVrstva(null);
        },
      };
    }
    const b = view.bitkaStav;
    const smerKSuperovi = super_;
    if (view.faza === "bitka" && b?.caka === ja) {
      // Zamknuté markery (krajná pozícia, Pohoršenie na krajnú) sa neponúkajú.
      if (b.krok === "pohorsenie" && !b.pohnuteMarkery.includes(elder.elderId) && posunMarker(elder, smerKSuperovi, true) !== null) {
        return { akcia: "posunúť k súperovi", klik: () => cmd({ type: "pohorsenie", elderId: elder.elderId }) };
      }
      const vyluceny = view.ciel?.typ === "starsi" ? view.ciel.elderId : null;
      if (b.krok === "prebytok" && elder.elderId !== vyluceny && posunMarker(elder, smerKSuperovi, false) !== null) {
        return { akcia: "posunúť marker", klik: () => cmd({ type: "prebytok", elderId: elder.elderId }) };
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
  const popisKarty = (defId: string): string => {
    const def = data.cards.get(defId);
    return def === undefined ? defId : `${def.name}: ${def.effectText}`;
  };
  const b = view.bitkaStav;
  const bitkaPanel =
    odhad === null || view.faza === "volbaCiela" || view.koniec !== null ? null : (
      <BitkaPanel
        damage={b?.damage ?? odhad}
        sums={lineEval.sums}
        ja={ja}
        utocnik={view.utocnik}
        vysledok={b?.damage != null}
        mena={[menoHraca(0), menoHraca(1)]}
        sada={sada}
        ciel={
          view.ciel?.typ === "starsi"
            ? `o staršieho ${menoKarty(view.starsi.find((e) => e.elderId === view.ciel?.elderId)?.karta.defId ?? "")}`
            : lokalita !== null
              ? `o ${menoKarty(lokalita.defId)}`
              : ""
        }
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
              <strong>Vydesil si {vydeseni[p]} starších!</strong> Ak ich udržíš do konca kola {kolo}, vyhráš.
            </>
          ) : (
            <>
              <strong>
                {menoHraca(p)} vydesil {vydeseni[p]} starších!
              </strong>{" "}
              Ak ich udrží do konca kola {kolo}, vyhrá. Vráť niektorého do sivej — ako útočník vyvolaj bitku o vydeseného staršieho.
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
            title="Zavrieť"
          >
            <span aria-hidden="true">♥</span> {o.text}
          </button>
        ))}
      </div>
    );

  // ---- draft na stole (Michal 2026-10-16) ----------------------------------
  const sirkaDraftu = mobil ? 84 : 118;
  /** Zóna stavby šenku: karta v nej, alebo prázdne miesto s popisom. */
  const zonaStavby = (ciel: string, nazov: string, pozn: string, uid: number | null): ReactNode => {
    const k = draft?.mojBalicek.find((x) => x.uid === uid);
    const z: Zdroj | null = k === undefined ? null : { karta: k, odkial: "stavba", navrh: false };
    return (
      <div className={zonaTriedy(ciel, `stavba-zona ${ciel === SMETISKO ? "smetisko" : "senok"}`)} data-ciel={jeCiel(ciel) ? ciel : undefined}>
        <span className="stavba-zona-nazov">{nazov}</span>
        {k !== undefined && z !== null ? (
          somNaTahu ? (
            sLupou({ karta: k, sirka: sirkaDraftu }, { obsah: tahatelna(z, karta({ karta: k, sirka: sirkaDraftu })), zdroj: z })
          ) : (
            sLupou({ karta: k, sirka: sirkaDraftu })
          )
        ) : (
          <div className="stavba-zona-miesto" style={{ width: sirkaDraftu, height: sirkaDraftu * 1.4 }}>
            potiahni sem kartu
          </div>
        )}
        <span className="stavba-zona-pozn">{pozn}</span>
      </div>
    );
  };
  const draftPanel = ((): ReactNode => {
    if (draft === null || view.faza !== "draft" || view.koniec !== null) return null;
    if (stavim) {
      const volba = somNaTahu ? stavba : (draft.mojVyber ?? { doSenku: null, odhod: null });
      const zvysok = draft.mojBalicek.filter((k) => k.uid !== volba.doSenku && k.uid !== volba.odhod);
      return (
        <section className={`draft-panel stavba ${somNaTahu ? "moj-tah" : "cakanie"}`} aria-label="Stavba šenku">
          <header className="draft-hlava">
            <strong>Stavba šenku</strong>
            <span>
              {somNaTahu
                ? `Tvoj balíček: ${kariet(draft.mojBalicek.length)} — jednu na Smetisko, jednu do Šenku, zvyšok podáš ${menoHraca(super_)}.`
                : `Vybral si — čakáš, kým vyberie ${menoHraca(super_)}.`}
            </span>
          </header>
          <div className="stavba-rad">
            {zonaStavby(SMETISKO, "Smetisko", "naspodok spoločného balíčka · súper ju neuvidí", volba.odhod)}
            <div
              className={zonaTriedy(BALICEK_STAVBY, "stavba-balicek")}
              data-ciel={jeCiel(BALICEK_STAVBY) ? BALICEK_STAVBY : undefined}
            >
              {zvysok.map((k) => {
                const z: Zdroj = { karta: k, odkial: "stavba", navrh: false };
                const props = { karta: k, sirka: sirkaDraftu };
                return somNaTahu ? sLupou(props, { obsah: tahatelna(z, karta(props)), zdroj: z }) : sLupou(props);
              })}
            </div>
            {zonaStavby(SENOK_STAVBA, "Šenok", "uvidia ju obaja · berie sa z neho", volba.doSenku)}
          </div>
          {somNaTahu && (
            <footer className="draft-paticka">
              <span>
                {stavba.odhod === null || stavba.doSenku === null
                  ? "Kartu v zóne vymeníš tak, že tam potiahneš inú."
                  : `Hotovo? Zvyšok (${kariet(zvysok.length)}) podáš ${menoHraca(super_)}.`}
              </span>
              <button className="tlacidlo-hlavne" disabled={stavba.doSenku === null || stavba.odhod === null} onClick={potvrdStavbu}>
                potvrdiť
              </button>
            </footer>
          )}
          {view.senok.length > 0 && (
            <div className="stavba-senok-zatial">
              <span className="oblast-nazov">v šenku zatiaľ · {view.senok.length}</span>
              <div className="draft-karty">{view.senok.map((k) => sLupou({ karta: k, sirka: Math.round(sirkaDraftu * 0.7) }))}</div>
            </div>
          )}
        </section>
      );
    }
    if (!beriem) return null;
    const mam = draft.noveKarty[ja];
    const plne = view.hraci[ja].poldeciPlne;
    const cig = view.hraci[ja].cigarety;
    return (
      <section className={`draft-panel branie ${mozemBrat ? "moj-tah" : "cakanie"}`} aria-label="Branie zo šenku">
        <header className="draft-hlava">
          <strong className="branie-kto">{mozemBrat ? "Tvoj ťah — potiahni kartu do ruky" : `Berie ${menoHraca(super_)}…`}</strong>
          <span className="branie-cena" role="radiogroup" aria-label="Platba za kartu zo šenku">
            {kredit > 0 ? (
              <b>Zaplatil si poldeci — vezmi si ešte {kredit} {kredit === 1 ? "kartu" : "karty"}.</b>
            ) : (
              <>
                <button
                  role="radio"
                  aria-checked={platba === "cigareta"}
                  className={`platba ${platba === "cigareta" ? "zvolena" : ""}`}
                  disabled={!mamCigaretu}
                  onClick={() => setPlatbaVolba("cigareta")}
                  title={`1 karta za cigaretu (máš ${cig}).`}
                >
                  1 karta za cigaretu <small>(máš {cig})</small>
                </button>
                <button
                  role="radio"
                  aria-checked={platba === "poldeci"}
                  className={`platba ${platba === "poldeci" ? "zvolena" : ""}`}
                  disabled={!mamPoldeci}
                  onClick={() => setPlatbaVolba("poldeci")}
                  title={`2 karty za plný poldeci (máš ${plne}) — limit vykladania ${limitTeraz} → ${limitZhromazdenia(view, ja, -1)}.`}
                >
                  2 karty za poldeci <small>(limit {limitTeraz} → {limitZhromazdenia(view, ja, -1)})</small>
                </button>
              </>
            )}
          </span>
          <span className="branie-skore">
            <span className="moje">ty {mam}</span>
            <span className="superove">
              {menoHraca(super_)} {draft.noveKarty[super_]}
              {draft.hotovo[super_] ? " · už neberie" : ""}
            </span>
          </span>
        </header>
        <div className="draft-karty branie-karty">
          {view.senok.length === 0 && <span className="popis">Šenok je prázdny.</span>}
          {view.senok.map((k) => {
            const z: Zdroj = { karta: k, odkial: "senok", navrh: false };
            const props = { karta: k, sirka: sirkaDraftu };
            return mozemBrat ? sLupou(props, { obsah: tahatelna(z, karta(props)), zdroj: z }) : sLupou(props);
          })}
        </div>
        <footer className="draft-paticka">
          <span className="tlmene">
            Beriete striedavo, koľko si môžete dovoliť: 1 karta za cigaretu alebo 2 za poldeci. Pitiek bude toľko, koľko akcií
            lokality sa aktivuje (aspoň 1).
          </span>
          <button
            className="tlacidlo-cigarety"
            disabled={!somNaTahu}
            title={somNaTahu ? `Prestaneš brať zo šenku; v Zhromaždení vyložíš ${limitTeraz}.` : "Počkaj, kým budeš na ťahu."}
            onClick={() => posli({ type: "draftStop" })}
          >
            už neberiem
          </button>
        </footer>
      </section>
    );
  })();

  // ---- pás kola: koľko Pitiek a koľko kariet kto vykladá -------------------
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
            {zs.pasoval[p] ? "pasoval" : zostava === 0 ? "vyložil všetko" : `vyloží ešte ${kariet(zostava)}`}
          </span>
        </span>
      );
    };
    return (
      <div className="pas-kola" key={view.kolo}>
        <span className="pas-pitky" title="Počet Pitiek v kole = počet aktivovaných akcií na karte lokality (aspoň 1) — rastie, keď sa pri lokalite aktivujú ďalšie. V bitke o staršieho je vždy 1.">
          <span className={`pas-pitky-pocet ${n > 1 ? "viac" : ""}`}>
            {view.faza === "bitka" ? `Bitka po ${n} ${n === 1 ? "Pitke" : "Pitkách"}` : view.faza === "pitka" ? `Pitka ${aktualna} z ${n}` : `Zhromaždenie ${aktualna} z ${n}`}
          </span>
          <span className="pas-bodky" aria-hidden="true">
            {Array.from({ length: n }, (_, i) => (
              <span key={i} className={i + 1 < aktualna || view.faza === "bitka" ? "bodka hotova" : i + 1 === aktualna ? "bodka teraz" : "bodka"} />
            ))}
          </span>
          <span className="pas-pozn">{n === 1 ? "len 1 Pitka — potom bitka" : `${n} Pitky — po každej ďalšie Zhromaždenie`}</span>
        </span>
        {view.faza === "zhromazdenie" && (
          <span className="pas-limit">
            {sloty(ja)}
            {sloty(super_)}
          </span>
        )}
      </div>
    );
  })();

  return (
    <div
      className="hra"
      style={{ "--pokyn-h": `${vyskaPokynu}px`, "--ruka-w": `${sirkaVRuke}px` } as CSSProperties}
    >
      {view.koniec !== null && !koniecZavrety && (
        <KoniecHry
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
        <span className="kod" title="kód miestnosti — pošli súperovi">
          {kod}
        </span>
        <PriebehKola view={view} />
        <span className={`spojenie ${superPripojeny ? "online" : "offline"}`}>
          {superPripojeny ? `● ${menoHraca(super_)} online` : `○ ${menoHraca(super_)} odpojený`}
        </span>
        {view.koniec === null && !superPripojeny && kontumacia !== undefined && (
          <button className="opustit" onClick={kontumacia} title="Súper je odpojený. Po 3 minútach si môžeš vyžiadať kontumačnú výhru.">
            kontumačná výhra
          </button>
        )}
        {view.koniec === null && (
          <button
            className={`opustit ${potvrdVzdanie ? "potvrdit" : ""}`}
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
        <button className="opustit" onClick={opustit} title={view.koniec === null ? "Partia beží ďalej — vrátiš sa do nej kódom miestnosti." : undefined}>
          {view.koniec === null ? "odísť" : "opustiť hru"}
        </button>
      </header>

      {chyba !== null && <div className="chyba">{chyba}</div>}

      <div className="plocha">
        {/* Scoreboard nad staršími (Michal 2026-10-18): body po milníkoch, kto má za čo koľko. */}
        <Scoreboard body={body} data={data} ja={ja} menoSupera={menoHraca(super_)} />
        {/* Starší hore — mimo dosahu ruky, aby sa ich lupa nebila s lupou kariet v ruke. */}
        <section className="starsi-panel">
          <h3>
            <span>
              Starší{" "}
              <span className="h3-pozn">{ja === 0 ? "tvoja strana ← → súperova" : "súperova strana ← → tvoja"}</span>
            </span>
            <span
              className={`vydeseni-pocet ${vydeseni[super_] >= prahVyd - 1 ? "hrozba" : ""}`}
              title={`Kto vydesí ${prahVyd} starších (krajná červená pozícia) a udrží ich do konca ďalšieho kola, vyhrá.`}
            >
              vydesení: <b className="moje">ty {vydeseni[ja]}/{prahVyd}</b> · <b className="superove">{menoHraca(super_)} {vydeseni[super_]}/{prahVyd}</b>
            </span>
            <span className="body-teraz" title="Záverečné bodovanie, keby hra skončila teraz">
              body teraz: <b className="moje">ty {body.spolu[ja]}</b> · <b
                className="superove"
                title={body.neiste[super_] ? "Otáznik: súper môže mať v ruke či balíčku skryté Dlhy a Cirhózy — jeho body môžu byť nižšie." : undefined}
              >
                {menoHraca(super_)} {body.spolu[super_]}
                {body.neiste[super_] ? "?" : ""}
              </b>
              <button type="button" className="tlacidlo-male tlacidlo-jemne" onClick={() => setAkoBodovanie(!akoBodovanie)} aria-expanded={akoBodovanie}>
                {akoBodovanie ? "skryť rozpis" : "rozpis bodov"}
              </button>
              <button type="button" className="tlacidlo-male tlacidlo-jemne" onClick={prepniMalychStarsich} aria-pressed={maliStarsi}>
                {maliStarsi ? "zväčšiť" : "zmenšiť"}
              </button>
            </span>
          </h3>
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
          {mobil && maliStarsi && (
            <p className="starsi-mobil">
              {starsiNaMobile.length === view.starsi.length
                ? "Všetci starší."
                : starsiNaMobile.length === 0
                  ? "Všetci starší sú v neutrále."
                  : `Starší mimo neutrálu (${starsiNaMobile.length} z ${view.starsi.length}).`}{" "}
              <button type="button" className="tlacidlo-male tlacidlo-jemne" onClick={prepniMalychStarsich}>
                ukázať všetkých
              </button>
            </p>
          )}
          <div className="scorecardy" ref={scorecardyRef} style={{ gap: MEDZERA_SCORECARDOV }}>
            {starsiNaMobile.map((elder) => {
              const k = klikStarsi(elder);
              const kluc = `s${elder.elderId}`;
              const scorecard = (sirka: number): ReactNode => (
                <Scorecard
                  elder={elder}
                  data={data}
                  sada={sada}
                  ja={ja}
                  sirka={sirka}
                  karta={(s) => karta({ karta: elder.karta, sirka: s })}
                  onClick={k?.klik}
                  body={body.starsi.find((b) => b.elderId === elder.elderId)}
                />
              );
              lupaKarty.set(kluc, { render: (s) => scorecard(s), mierka: mierkaLupyScorecardu });
              return (
                <div key={elder.elderId} className="scorecard-obal" style={{ flex: `1 1 ${sirkaScorecardu}px`, minWidth: sirkaScorecardu }}>
                  <div
                    className="s-lupou"
                    onMouseEnter={(e) => {
                      const el = e.currentTarget.querySelector(".scorecard");
                      if (tahanie === null && el !== null) setLupa({ kluc, rect: el.getBoundingClientRect() });
                    }}
                  >
                    {sirkaRadu > 0 && scorecard(sirkaScorecardu)}
                  </div>
                  <StavStarsieho
                    elder={elder}
                    data={data}
                    ja={ja}
                    meno={menoKarty(elder.karta.defId)}
                    body={body.starsi.find((b) => b.elderId === elder.elderId)}
                    akcia={k?.akcia}
                  />
                </div>
              );
            })}
          </div>
        </section>
        <div className="stred">
          {/* Stôl je hneď pod staršími — pás pokynov a ruka ho neprekryjú
              (playtest 20261012-055944); dosky hráčov sú pod ním. */}
          {hrozbaVydesenia}
          {oznamyPriazneEl}
          {draftPanel}
          {pasKola}
          {/* Farba stola hovorí, čí je ťah: zelená = tvoj, sivá = čakáš. */}
          <div className={`linia-obal ${view.koniec !== null ? "koniec" : somNaTahu ? "moj-tah" : "cakanie"}`}>
            <span className="linia-stav">
              {view.koniec !== null ? "Koniec hry" : somNaTahu ? "Tvoj ťah" : `Na ťahu je ${menoHraca(super_)}`}
            </span>
            <div className="linia" ref={liniaRef}>
              <div className="linia-skupina moja">
                <span className="partia-popis" title="Karty natočené k tebe sú tvoje (tvoja partia), nech ležia na ktorejkoľvek strane.">
                  ← tvoja strana
                </span>
                <div className="partia-rad">{radStrany(ja)}</div>
              </div>
              <div className="linia-skupina lokalita" ref={lokalitaRef}>
                <span className="partia-popis">
                  {view.ciel?.typ === "starsi" || starsiNavrh !== null
                    ? "bitka o staršieho"
                    : lokalita !== null || lokalitaNavrh !== null
                      ? "lokalita"
                      : "cieľ kola"}
                </span>
                <div className="partia-rad">{stredLinie}</div>
                {popisStranStredu}
                {(lokalitaNavrh !== null || starsiNavrh !== null) && tahanie === null && <span className="otocit-tip">klik = otočiť</span>}
              </div>
              <div className="linia-skupina superova">
                <span className="partia-popis">strana — {menoHraca(super_)} →</span>
                <div className="partia-rad">{radStrany(super_)}</div>
              </div>
            </div>
          </div>

          {bitkaPanel}

          {odkladacieZony.length > 0 && <div className="odkladanie">{odkladacieZony}</div>}

          {/* Obaja hráči na jednej úrovni: ty vľavo, súper vpravo (zrkadlovo). */}
          <div className="dosky">
            <HracDoska
              view={view}
              p={ja}
              info={hraci[ja]}
              prahy={prahy(ja)}
              menoKarty={menoKarty}
              popisKarty={popisKarty}
              body={{ body: body.spolu[ja], neiste: body.neiste[ja] }}
              obchodCigariet={{
                mozno: somNaTahu && view.faza === "pitka" && view.pitkaStav?.reakcia === null && view.koniec === null,
                doliat: () => cmd({ type: "refillPoldeci" }),
                novy: () => cmd({ type: "barter" }),
                cenaBarteru: barterCena(data, view, ja),
              }}
            />
            <HracDoska
              view={view}
              p={super_}
              info={hraci[super_]}
              prahy={prahy(super_)}
              menoKarty={menoKarty}
              popisKarty={popisKarty}
              body={{ body: body.spolu[super_], neiste: body.neiste[super_] }}
            />
          </div>
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
          <div className="vrstva-karty">
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
              return sLupou(props, { obsah: vybrana ? karta(props) : tahatelna(z, karta(props)), zdroj: z });
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
                    "Alebo zavri okno a klikni na staršieho (bitka o staršieho)."
                  )}
                </span>
                <button onClick={() => setVrstva(null)}>bitka o staršieho</button>
                <button className="tlacidlo-hlavne" disabled={vybranaLokalita === undefined} onClick={umiestniLokalitu}>
                  umiestniť na stôl
                </button>
              </>
            ) : undefined
          }
        >
          <div className="vrstva-karty">
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
                return sLupou(props, { obsah: tahatelna(z, karta(props)), zdroj: z });
              })}
          </div>
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
              <div className="vrstva-karty">
                {(view.volbaVestica?.[kto] ?? []).map((k, i) => {
                  const v = mode.typ === "vestica" ? mode : null;
                  const vybrana = v !== null && (kto === "moj" ? v.moja === i : v.jeho === i);
                  return sLupou({
                    karta: k,
                    sirka: SIRKA_VO_VRSTVE,
                    vybrana,
                    onClick: () =>
                      v !== null && setMode(kto === "moj" ? { ...v, moja: vybrana ? null : i } : { ...v, jeho: vybrana ? null : i }),
                  });
                })}
              </div>
            </div>
          ))}
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
          Nad ňou je pás pokynov: vrstvy, čo robiť a tlačidlá ťahu. */}
      <div className={zonaTriedy("ruka", "ruka")} data-ciel={jeCiel("ruka") ? "ruka" : undefined}>
        <div ref={pokynRef} className={`pokyn ${view.koniec !== null ? "koniec" : somNaTahu ? "moj-tah" : "cakanie"}`}>
          <div className="pokyn-vrstvy">
            {(["senok", "lokality", "log"] as const).map((v) => {
              const pocet = v === "senok" ? view.senok.length : v === "lokality" ? view.lokalityVHre.length : log.length - videnyLog;
              // Kartu zo šenku či lokalitu vrátiš pustením na jej tlačidlo.
              const ciel = v === "log" ? null : v;
              return (
                <button
                  key={v}
                  className={[
                    "pokyn-vrstva",
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
          </div>
          {pokyn !== null && (
            <>
              <div className="pokyn-text">
                <strong className="pokyn-nadpis">{pokyn.nadpis}</strong>
                {pokyn.text !== undefined && <span>{pokyn.text}</span>}
              </div>
              {pokyn.tlacidla !== undefined && <div className="pokyn-tlacidla">{pokyn.tlacidla}</div>}
            </>
          )}
        </div>
        <span className="ruka-nadpis">
          ruka<b>{view.ruka.length}</b>
        </span>
        <div className="ruka-rad">
          {ruka
            .filter((k) => k.uid !== vylozene?.karta.uid)
            .map((k) => {
              // Limit ruky a Starosta: karty v ruke sa vyberajú klikom.
              const limitRuky = mode.typ === "vyber" && view.bitkaStav?.krok === "limitRuky" && view.bitkaStav.caka === ja;
              const vybrana = limitRuky ? mode.uids.includes(k.uid) : mode.typ === "starosta" && mode.rukaUid === k.uid;
              const onClick = limitRuky
                ? () => setMode({ typ: "vyber", uids: mode.uids.includes(k.uid) ? mode.uids.filter((u) => u !== k.uid) : [...mode.uids, k.uid] })
                : mode.typ === "starosta"
                  ? () => setMode({ typ: "starosta", rukaUid: k.uid })
                  : undefined;
              const nova = noveVRuke.includes(k.uid);
              const dobrata = !nova && dobrate.includes(k.uid);
              const obsah = (
                <>
                  {karta({ karta: k, sirka: sirkaVRuke, vybrana, onClick })}
                  {nova && <span className="nova-stitok">zo šenku</span>}
                  {dobrata && <span className="nova-stitok">dobraná</span>}
                </>
              );
              return tahatelna(
                { karta: k, odkial: "ruka", navrh: false },
                obsah,
                k.uid,
                PORADIE + k.uid,
                nova || dobrata ? "nova-zo-senku" : undefined,
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
            mierka={lk.mierka ?? MIERKA_LUPY}
            onZavri={() => setLupa(null)}
            onPointerDown={chytit ? (e) => zacni(z, e, lupa.rect.width) : undefined}
          >
            {lk.render(lupa.rect.width * (lk.mierka ?? MIERKA_LUPY))}
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

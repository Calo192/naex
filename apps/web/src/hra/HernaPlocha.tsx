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
  STUPNICA_ZONY,
  bodyTeraz,
  cenaPrebytku,
  cieleVykladania,
  evaluateLine,
  hodnotaZopar,
  nahladBitkyOStarsieho,
  posunMarker,
  poskodenieBitky,
  prahyHraca,
  priazen,
} from "@naex/core";
import type { ActionSums, GameState } from "@naex/core";
import { KoniecHry } from "./KoniecHry.tsx";
import type { Sada } from "@naex/tvorba";
import { HernaKarta, posunVzpriamenej, vzhladKarty, type HernaKartaProps } from "./HernaKarta.tsx";
import { Lupa } from "./Lupa.tsx";
import { Vrstva as VrstvaPanel } from "./Vrstva.tsx";
import { BitkaPanel, HracDoska, PriebehKola } from "./Panely.tsx";
import { Scorecard, StavStarsieho } from "./Scorecard.tsx";
import type { HracInfo, ZmenyFrajeriny } from "./useHra.ts";
import { useTahanie } from "./useTahanie.ts";
import "./hra.css";

/** Čo sa ťahá. `navrh` = karta už leží na stole, ale len ako nepotvrdený návrh. */
interface Zdroj {
  readonly karta: CardInstance;
  readonly odkial: "ruka" | "senok" | "lokality";
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
  dedicstvo: "do Dedičstva",
};

const NAHRADIT = "nahradit:";

/**
 * Čo netreba mať na stole stále — otvára sa ako vrstva cez obrazovku.
 * „balicek“ (Policajtka) a „vestica“ ukazujú doberacie balíčky, ktoré hráčovi
 * podľa karty odhalil server.
 */
type Vrstva = "stavba" | "senok" | "lokality" | "log" | "balicek" | "vestica";

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
const SIRKA_SCORECARDU_MAX = 150;
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
  // Výbery viacerých kariet: Benzínka (Občania v línii), limit ruky, Policajtka, Veštica.
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
  // Stavba šenku: karta do šenku a karta naspodok z môjho balíčka.
  const [stavba, setStavba] = useState<{ readonly doSenku: number | null; readonly odhod: number | null }>({ doSenku: null, odhod: null });
  useEffect(() => setStavba({ doSenku: null, odhod: null }), [klucTahu]);
  const klikStavba = (uid: number): void =>
    setStavba((v) =>
      v.doSenku === uid
        ? { ...v, doSenku: null }
        : v.odhod === uid
          ? { ...v, odhod: null }
          : v.doSenku === null
            ? { ...v, doSenku: uid }
            : { ...v, odhod: uid },
    );
  const potvrdStavbu = (): void => {
    if (stavba.doSenku !== null && stavba.odhod !== null) posli({ type: "stavbaSenku", doSenku: stavba.doSenku, odhod: stavba.odhod });
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
  const zoSenkuLimit = !somNaTahu
    ? 0
    : view.faza === "draft"
      ? draft?.krok === "beranie" ? Math.min(1, view.senok.length) : 0
      : mode.typ === "liecbaSenok"
        ? 1
        : 0;
  // Keď hráč má vyberať lokalitu alebo karty zo šenku, vrstva sa otvorí sama
  // (žiadny klik navyše). Raz za fázu — ak ju zavrie (napr. ide na staršieho),
  // znova sa nevnucuje; otvorí ju tlačidlom „späť na výber“.
  const chceVrstvu: Vrstva | null = !somNaTahu || view.koniec !== null
    ? null
    : view.volbaPolicajtka !== null
      ? "balicek"
      : view.volbaVestica !== null
        ? "vestica"
    : view.faza === "volbaCiela" && navrh?.typ !== "lokalita" && navrh?.typ !== "starsi"
      ? "lokality"
      : stavim
        ? "stavba"
        : view.faza === "draft" || mode.typ === "liecbaSenok"
          ? "senok"
          : null;
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
    const lineEval = evaluateLine(data, {
      lokalita: ciel?.lokalita ?? null,
      lokalitaOtocena: lokalitaNavrh?.otocena ?? starsiNavrh?.otocena ?? view.lokalitaOtocena,
      strany,
    });
    // Absťáky v ruke: svoje poznáš (bez karty, ktorá už leží na stole), súperove nie.
    const mojeAbstaky = view.ruka.filter((k) => k.defId === "abstak" && k.uid !== vylozene?.karta.uid).length;
    const odhad =
      ciel === null ? null : poskodenieBitky(data, stol, lineEval.sums, ja === 0 ? [mojeAbstaky, 0] : [0, mojeAbstaky]);
    return { stol, lineEval, odhad };
    // vylozene a lokalitaNavrh sú odvodené len z navrh a view.
  }, [data, view, navrh, somNaTahu]);

  // NA EX (pravidlá v3): len na vlastnú kartu — Občana alebo Starešinu natočeného
  // k tebe, nech leží na ktorejkoľvek strane, a bez poldeci.
  const naexCiele = useMemo(() => {
    const out = new Set<number>();
    for (const strana of view.strany) {
      for (const pl of strana) {
        // Liberál: na neho NA EX dať nemožno.
        if (pl.playedBy !== ja || pl.naexBy !== undefined || pl.card.defId === "liberal") continue;
        const tagy = data.cards.get(pl.card.defId)?.tags ?? [];
        if (tagy.includes("Občan") || tagy.includes("Starešina")) out.add(pl.card.uid);
      }
    }
    return out;
  }, [data, view.strany, ja]);

  // Kedy NA EX dať môžem — karty, ktoré ho prijmú, nesú v línii značku.
  const pitka = view.pitkaStav;
  const naexMozny =
    somNaTahu &&
    view.faza === "pitka" &&
    pitka !== null &&
    pitka.reakcia === null &&
    !pitka.naexPouzity[ja] &&
    !pitka.zakazNaex[ja] &&
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
      const ev = evaluateLine(data, { lokalita: view.ciel?.lokalita ?? null, lokalitaOtocena: view.lokalitaOtocena, strany });
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

  /** Zmeny súčtov akcií (napr. „Rana +1, Viera −1“) — náhľad spojov a NA EX. */
  const zmenyAkcii = (pred: ActionSums, po: ActionSums): string[] => {
    const kluce = new Set([...Object.keys(pred), ...Object.keys(po)]) as Set<keyof ActionSums>;
    const out: string[] = [];
    for (const k of kluce) {
      const rozdiel = (po[k] ?? 0) - (pred[k] ?? 0);
      if (rozdiel !== 0) out.push(`${sada.akcie.find((a) => a.kluc === k)?.nazov ?? k} ${rozdiel > 0 ? "+" : "−"}${Math.abs(rozdiel)}`);
    }
    return out;
  };
  // Náhľad spojov: čo vyložená karta zmení tebe a súperovi oproti stolu bez nej.
  const nahladSpojov = useMemo(() => {
    if (vylozene === null || (vylozene.ciel !== "vlastna" && vylozene.ciel !== "superova")) return null;
    const bez = evaluateLine(data, { lokalita: view.ciel?.lokalita ?? null, lokalitaOtocena: view.lokalitaOtocena, strany: view.strany });
    return { ja: zmenyAkcii(bez.sums[ja], lineEval.sums[ja]), su: zmenyAkcii(bez.sums[super_], lineEval.sums[super_]) };
    // vylozene je odvodené z navrh a view.
  }, [data, view, navrh, lineEval, ja, super_]);

  // Kroky s výberom viacerých kariet si pri začiatku pripravia prázdny výber.
  const bs0 = view.bitkaStav;
  const krokVyberu: string | null =
    view.volba?.hrac === ja ? "policajtka" : bs0 !== null && bs0.caka === ja ? (bs0.krok ?? null) : null;
  useEffect(() => {
    if (krokVyberu === "policajtka" || krokVyberu === "benzinka" || krokVyberu === "limitRuky") setMode({ typ: "vyber", uids: [] });
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
    if (!somNaTahu || view.koniec !== null) return out;
    const zs = view.zhromazdenieStav;
    if (z.odkial === "ruka" && view.faza === "zhromazdenie" && zs !== null && !zs.pasoval[ja]) {
      for (const c of cieleVykladania(data, view.strany, ja, z.karta, zs.zostavaLimit[ja])) out.add(c);
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
  const tahatelna = (z: Zdroj, obsah: ReactNode, kluc?: number, ciel?: string): ReactNode => {
    const moze = cieleZdroja(z).size > 0;
    const ide = tahanie?.zdroj.karta.uid === z.karta.uid;
    const nahraditelna = ciel !== undefined && !ide && jeCiel(ciel);
    const triedy = ["tahatelna"];
    if (moze) triedy.push("chytitelna");
    if (ide) triedy.push("tahana");
    if (z.navrh) triedy.push("navrh");
    if (nahraditelna) triedy.push("nahraditelna");
    if (nahraditelna && nadCielom(ciel)) triedy.push("nad-cielom");
    return (
      <div
        key={kluc}
        className={triedy.join(" ")}
        data-ciel={nahraditelna ? ciel : undefined}
        onPointerDown={moze ? (e) => zacni(z, e) : undefined}
        onDragStart={(e) => e.preventDefault()}
      >
        {obsah}
        {nahraditelna && <span className="nahradit-stitok">nahradiť</span>}
      </div>
    );
  };

  /** Prázdne miesto, kam karta smie — ukáže sa len počas ťahania. */
  const miesto = (ciel: string, popis: string, sirka: number): ReactNode => {
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
      const props = { karta: vylozene.karta, sirka: sirkaVLinii, eval: lineEval.cards.get(vylozene.karta.uid) ?? null };
      return sLupou(props, { obsah: tahatelna(z, karta(props), undefined, ciel), zdroj: z, vLinii: true, kluc: -1 });
    }
    const m = miesto(ciel, p === ja ? "na tvoju stranu" : "na súperovu stranu", sirkaVLinii);
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
    odkladanie("dedicstvo", "do Dedičstva", "pasívny efekt · nemíňa limit"),
  ].filter(
    (z) => z !== null,
  );

  // V strede leží lokalita, v bitke o staršieho karta staršieho (Michal 2026-10-12).
  const lokalita = view.ciel?.lokalita ?? null;
  // Natočenie lokality je v ráme hráča 1 opačné.
  const lokalitaNavrhOtocena = lokalitaNavrh !== null && lokalitaNavrh.otocena !== (ja === 1);
  const starsiNavrhOtocena = starsiNavrh !== null && starsiNavrh.otocena !== (ja === 1);
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

    if (view.volbaPolicajtka !== null) {
      const balicek = view.volbaPolicajtka;
      const vybrane = mode.typ === "vyber" ? mode.uids : [];
      return {
        nadpis: "Policajtka",
        text: (
          <>
            Klikaj na karty svojho balíčka, ktoré dáš <strong>navrch</strong> (v tomto poradí) — ostatné pôjdu naspodok.
            Navrch: <strong>{vybrane.length}</strong>, naspodok {balicek.length - vybrane.length}.
          </>
        ),
        tlacidla: (
          <>
            <button onClick={() => setVrstva("balicek")}>balíček</button>
            <button
              className="tlacidlo-hlavne"
              onClick={() => posli({ type: "policajtka", hore: vybrane.map((u) => balicek.findIndex((k) => k.uid === u)) })}
            >
              potvrdiť
            </button>
          </>
        ),
      };
    }

    switch (view.faza) {
      case "volbaCiela":
        if (starsiNavrh !== null) {
          // Náhľad bitky o staršieho (Michal 2026-10-12): víťaz dá marker do sivej,
          // body z toho staršieho zmiznú obom, víťazovi pribudne získaný starší.
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
                  {lokalitaNavrhOtocena ? " (otočená)" : ""} — klikom na kartu ju otočíš.
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
                Zo svojho balíčka ({kariet(draft.mojBalicek.length)}) daj jednu kartu <strong>do šenku</strong> a jednu{" "}
                <strong>naspodok</strong> spoločného balíčka (súper ju neuvidí). Zvyšok podáš {menoHraca(super_)}. Vyberáte naraz.
              </>
            ),
            tlacidla: (
              <>
                <button onClick={() => setVrstva("stavba")}>← tvoj balíček</button>
                <button className="tlacidlo-hlavne" disabled={stavba.doSenku === null || stavba.odhod === null} onClick={potvrdStavbu}>
                  potvrdiť
                </button>
              </>
            ),
          };
        }
        const mam = draft.noveKarty[ja];
        const manzelky = view.hraci[ja].priznane.filter((x) => x.defId === "milujuca_manzelka").length;
        const cig = Math.max(0, 3 - mam - manzelky);
        const vzata = zoSenku[0];
        return {
          nadpis: "Branie zo šenku",
          text: (
            <>
              Beriete striedavo po jednej, najviac 3. Máš <strong>{mam}/3</strong>
              {draft.hotovo[super_] ? <>, {menoHraca(super_)} už neberie</> : <>, {menoHraca(super_)} {draft.noveKarty[super_]}/3</>}. Keď
              prestaneš, dostaneš <strong>{cigariet(cig)}</strong>
              {manzelky > 0 && <> (Milujúca manželka: −{Math.min(manzelky, 3 - mam)})</>}.
              {vzata !== undefined && (
                <>
                  {" "}
                  Berieš <strong>{menoKarty(vzata.defId)}</strong>.
                </>
              )}
            </>
          ),
          tlacidla: (
            <>
              <button onClick={() => setVrstva("senok")}>← šenok</button>
              <button onClick={() => posli({ type: "draftStop" })}>prestať brať</button>
              <button className="tlacidlo-hlavne" disabled={vzata === undefined} onClick={() => vzata !== undefined && posli({ type: "draftBer", uid: vzata.uid })}>
                vziať
              </button>
            </>
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
                : "Vypiť do dna: otočíš plný poldeci na vypitý. Hneď zahráš ďalšiu kartu bez odovzdania ťahu, ale limit ti klesne o 1 a pečeň +1."
            }
          >
            do dna! <span className="cena">−1 poldeci</span>
          </button>
        );
        return vylozene === null
          ? {
              nadpis,
              text:
                navyse > 0 ? (
                  <span className="dodna-text">
                    Do dna! Ťah ti neskončí — vylož ešte <strong>{navyse + 1}</strong> {navyse + 1 === 1 ? "kartu" : "karty"} za sebou.
                  </span>
                ) : (
                  "Potiahni kartu z ruky na stôl, alebo pasuj."
                ),
              tlacidla: (
                <>
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
                      {" "}· ty: {nahladSpojov.ja.length > 0 ? nahladSpojov.ja.join(", ") : "bez zmeny"} · {menoHraca(super_)}:{" "}
                      {nahladSpojov.su.length > 0 ? nahladSpojov.su.join(", ") : "bez zmeny"}
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
        const zakazNaex = pitkaSt?.zakazNaex[ja] === true;
        const nadpis = `Pitka ${view.pitkaCislo}/${view.pitkyCelkom}`;
        if (reagujem) {
          // Reakcia na súperovo NA EX (Michal 2026-10-12): jedna karta mimo limitu.
          return vylozene === null
            ? {
                nadpis: "Odpoveď na NA EX",
                text: (
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
                        {" "}· ty: {nahladSpojov.ja.length > 0 ? nahladSpojov.ja.join(", ") : "bez zmeny"} · {menoHraca(super_)}:{" "}
                        {nahladSpojov.su.length > 0 ? nahladSpojov.su.join(", ") : "bez zmeny"}
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
        const dovodBezNaex = zakazNaex
          ? "Svokra: v tejto Pitke nesmieš dať NA EX."
          : naexBol
            ? "NA EX si v tejto Pitke už dal."
            : hracJa.poldeciPlne === 0
              ? "Nemáš plný poldeci (doliať: 2 cigarety)."
              : naexCiele.size === 0
                ? "NA EX ide len na tvojho Občana či Starešinu v línii (nie Nástroj, nie Liberál)."
                : null;
        const krcma = view.ciel?.lokalita?.defId === "krcma" && dovodBezNaex === null;
        const zopar = hodnotaZopar(priazen(data, view, "NEPRAJNIK", ja));
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
              Fajči alebo vymeň cigarety — potom hotovo. <span className="tlmene">{dovodBezNaex}</span>
            </>
          ) : (
            "Daj NA EX (karty so značkou ho prijmú), fajči alebo vymeň cigarety — potom hotovo."
          ),
          tlacidla: (
            <>
              <button
                className="tlacidlo-naex"
                disabled={dovodBezNaex !== null}
                title={dovodBezNaex ?? "Polož plný poldeci na svojho Občana alebo Starešinu — ukážem ti náhľad bitky."}
                onClick={() => setMode({ typ: "naexCiel" })}
              >
                NA EX!
              </button>
              {postarka &&
                Array.from({ length: zopar }, (_, i) => i + 1).map((n) => (
                  <button key={`p${n}`} title="Poštárka: dober karty navyše a s nimi Trocha Dlhov." onClick={() => cmd({ type: "postarka", pocet: n })}>
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
                title="Vyfajčená cigareta sa ráta do nerestí a ťahania kariet."
                onClick={() => cmd({ type: "smoke", pocet: 1 })}
              >
                fajčiť <span className="cena">−1</span>
              </button>
              <button
                disabled={hracJa.cigarety < 5}
                onClick={() => cmd({ type: "barter" })}
                title="Stokársky barter: 5 cigariet → nový plný poldeci"
              >
                barter <span className="cena">−5</span>
              </button>
              <button
                disabled={hracJa.cigarety < 2 || hracJa.poldeciVypite === 0}
                onClick={() => cmd({ type: "refillPoldeci" })}
                title="2 kusovky za poldeci: otočí vypitý poldeci späť na plný"
              >
                doliať <span className="cena">−2</span>
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
            text: "Klikni na staršieho hore — marker sa posunie k súperovi: on dostane priazeň teraz, ty body na konci. Zamknuté markery sa nedajú.",
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
                Klikni na staršieho hore — marker ide k súperovi (on priazeň teraz, ty body na konci).{" "}
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
      : stavim && (stavba.doSenku === null || stavba.odhod === null)
        ? "stavba"
        : (view.faza === "draft" && zoSenku.length < zoSenkuLimit) || (mode.typ === "liecbaSenok" && zoSenku.length === 0)
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
        {/* Starší hore — mimo dosahu ruky, aby sa ich lupa nebila s lupou kariet v ruke. */}
        <section className="starsi-panel">
          <h3>
            <span>
              Starší{" "}
              <span className="h3-pozn">{ja === 0 ? "tvoja strana ← → súperova" : "súperova strana ← → tvoja"}</span>
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
                {akoBodovanie ? "skryť" : "ako sa boduje?"}
              </button>
              <button type="button" className="tlacidlo-male tlacidlo-jemne" onClick={prepniMalychStarsich} aria-pressed={maliStarsi}>
                {maliStarsi ? "zväčšiť" : "zmenšiť"}
              </button>
            </span>
          </h3>
          {akoBodovanie && (
            <div className="ako-bodovanie">
              <p>
                <b>♥ Priazeň</b> (počas hry) má hráč, ku ktorému je marker staršieho posunutý — čím ďalej, tým silnejšia (+1 / +2).
                Dáva výhodu podľa scorecardu (prejdi myšou na riadok ♥). Body z nej nie sú.
              </p>
              <p>
                <b>★ Body</b> (na konci hry) dostane len hráč, <b>ktorého sa starší bojí</b> — ten druhý, od ktorého je marker
                odtlačený. Priazeň a strach teda nikdy nepatria tomu istému hráčovi: posunúť marker k súperovi znamená dať mu
                priazeň teraz, ale body neskôr získaš ty.
              </p>
              <p>
                Boduje sa len cez <b>aktívne podmienky na tvojej strane scorecardu</b> (svietia, keď karta staršieho má na
                tom mieste akciu): Znepokojenie / Strach / Vydesenie podľa zóny markera; ovládnuté lokality, získaní starší a
                zvyšné cigarety za kus, ale len od oranžovej zóny; nepriznané Dlhy a Cirhózy mínus za kus. Plné zvýraznenie podmienky = práve by bodovala.
              </p>
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
                  {view.faza === "draft" ? "vziať do ruky" : "vziať"}
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

      {vrstva === "stavba" && stavim && draft !== null && (
        <VrstvaPanel
          nazov={`Stavba šenku · tvoj balíček ${draft.mojBalicek.length}`}
          pozn={somNaTahu ? "klikni na kartu do šenku, potom na kartu naspodok balíčka" : "vybral si — čakáš na súpera"}
          skryta={tahanie !== null}
          onZavri={() => setVrstva(null)}
          paticka={
            somNaTahu ? (
              <>
                <span className="vrstva-paticka-text">
                  {stavba.doSenku === null
                    ? "Vyber kartu do šenku."
                    : stavba.odhod === null
                      ? "Vyber kartu naspodok balíčka."
                      : `Zvyšok (${kariet(draft.mojBalicek.length - 2)}) podáš ${menoHraca(super_)}.`}
                </span>
                <button className="tlacidlo-hlavne" disabled={stavba.doSenku === null || stavba.odhod === null} onClick={potvrdStavbu}>
                  potvrdiť
                </button>
              </>
            ) : undefined
          }
        >
          <div className="vrstva-karty">
            {draft.mojBalicek.map((k) => {
              const volba = somNaTahu ? stavba : (draft.mojVyber ?? { doSenku: null, odhod: null });
              const rola = k.uid === volba.doSenku ? "do šenku" : k.uid === volba.odhod ? "naspodok" : null;
              const props = { karta: k, sirka: SIRKA_VO_VRSTVE, vybrana: rola !== null, onClick: somNaTahu ? () => klikStavba(k.uid) : undefined };
              return sLupou(props, {
                obsah: (
                  <>
                    {karta(props)}
                    {rola !== null && <span className={`stavba-rola ${rola === "do šenku" ? "do-senku" : "naspodok"}`}>{rola}</span>}
                  </>
                ),
                trieda: "stavba-karta",
              });
            })}
          </div>
          <span className="oblast-nazov">šenok zatiaľ · {view.senok.length}</span>
          <div className="vrstva-karty">
            {view.senok.length === 0 && <span className="popis">Zatiaľ prázdny — karty do šenku sa odhalia, keď vyberiete obaja.</span>}
            {view.senok.map((k) => sLupou({ karta: k, sirka: SIRKA_VO_VRSTVE }))}
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

      {vrstva === "balicek" && view.volbaPolicajtka !== null && (
        <VrstvaPanel
          nazov={`Tvoj doberací balíček · ${view.volbaPolicajtka.length}`}
          pozn="Policajtka: klikni na karty, ktoré pôjdu navrch (číslo = poradie); ostatné pôjdu naspodok"
          skryta={tahanie !== null}
          onZavri={() => setVrstva(null)}
        >
          <div className="vrstva-karty">
            {view.volbaPolicajtka.map((k) => {
              const poradie = mode.typ === "vyber" ? mode.uids.indexOf(k.uid) : -1;
              const props = {
                karta: k,
                sirka: SIRKA_VO_VRSTVE,
                vybrana: poradie !== -1,
                onClick: () =>
                  mode.typ === "vyber" &&
                  setMode({ typ: "vyber", uids: poradie !== -1 ? mode.uids.filter((u) => u !== k.uid) : [...mode.uids, k.uid] }),
              };
              return (
                <div key={k.uid} className="poradie-obal">
                  {sLupou(props)}
                  {poradie !== -1 && <span className="poradie">{poradie + 1}</span>}
                </div>
              );
            })}
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
            {([...(stavim ? (["stavba"] as const) : []), "senok", "lokality", "log"] as const).map((v) => {
              const pocet =
                v === "stavba"
                  ? (draft?.mojBalicek.length ?? 0)
                  : v === "senok"
                    ? view.senok.length
                    : v === "lokality"
                      ? view.lokalityVHre.length
                      : log.length - videnyLog;
              // Kartu zo šenku či lokalitu vrátiš pustením na jej tlačidlo.
              const ciel = v === "log" || v === "stavba" ? null : v;
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
                  {v === "stavba" ? "Tvoj balíček" : v === "senok" ? "Šenok" : v === "lokality" ? "Lokality" : "Log"}
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
          {view.ruka
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
              return tahatelna({ karta: k, odkial: "ruka", navrh: false }, karta({ karta: k, sirka: sirkaVRuke, vybrana, onClick }), k.uid);
            })}
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

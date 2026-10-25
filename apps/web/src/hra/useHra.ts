// Spojenie s herným serverom + automatický návrat do partie (M9).
//
// Miesto v miestnosti patrí prihlásenému hráčovi — po obnovení stránky sa
// pošle rejoin s kódom z localStorage a hráč pokračuje, kde prestal.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ClientState, Command, DlzkaHry, Event, GameData, Pohlavie, Rod } from "@naex/core";
import { kariet, loadGameData, rozlozRod } from "@naex/core";
import eldersJson from "@naex/core/data/elders.json";
import scorecardsJson from "@naex/core/data/scorecards.json";
import type { Sada } from "@naex/tvorba";

export interface HracInfo {
  readonly id?: number;
  readonly meno: string;
  readonly avatar: string | null;
  readonly frajerina?: number;
  readonly titul?: string;
  /** Offline protihráč (počítač) — nemá účet ani Frajerinu. */
  readonly bot?: boolean;
  /** Pohlavie z profilu pre tvary hlášok; chýba/null = neuvádza. */
  readonly pohlavie?: Pohlavie | null;
  /** Či sa dá otvoriť profil: bot nemá žiadny, AI playtester je hráčom skrytý. */
  readonly profil?: "verejny" | "skryty" | "ziadny";
}

/** Rod hráča v hláškach (Michal 2026-10-22): bot, pohlavie z profilu, alebo neuvedené. */
export function rodHraca(h: HracInfo | null | undefined): Rod {
  return h?.bot === true ? "bot" : (h?.pohlavie ?? null);
}

/** Meno vo vete — bot je „Bot Teta Gizka“ (Michal 2026-10-22: „Bot … skončil“). */
export function menoVoVete(h: HracInfo | null | undefined, p: number): string {
  if (h === null || h === undefined) return `Hráč ${p + 1}`;
  return h.bot === true ? `Bot ${h.meno}` : h.meno;
}

/** Hláška motora pre človeka: tvary rodu podľa hráčov a mená namiesto „Hráč N“. */
export function textHlasky(text: string, mena: readonly string[], rody: readonly [Rod, Rod]): string {
  // Aj „hráč 2“ uprostred vety (Hrobár, Svokra…) — inak ostalo „hráč 2 si berie 1 cigaretu“.
  return rozlozRod(text, rody).replace(/[Hh]ráč ([12])/g, (_, n: string) => mena[Number(n) - 1] ?? `Hráč ${n}`);
}

/** Zmena Frajeriny po dohraní partie (index = miesto hráča). */
export type ZmenyFrajeriny = readonly [{ readonly pred: number; readonly po: number }, { readonly pred: number; readonly po: number }];

export interface Miestnost {
  readonly code: string;
  readonly seat: 0 | 1;
  readonly started: boolean;
  readonly verejna: boolean;
  readonly dlzka: DlzkaHry;
  readonly sada: Sada;
}

/** Krok výučby „Prvá hra“ tak, ako ho posiela server (KrokVyucbyKlient v packages/server/src/server.ts). */
export interface KrokVyucby {
  readonly index: number;
  readonly spolu: number;
  readonly id: string;
  /**
   * hrac = čaká sa na ťah hráča, bot = ťahá Štamgast, info = len text a „ďalej“,
   * auto = ťah hráča, ktorý hra spraví sama (ako ťah bota, s komentárom v bubline),
   * otazka = kontrolná otázka (text je melichar, možnosti v moznosti).
   */
  readonly kto: "hrac" | "bot" | "info" | "auto" | "otazka";
  /** Ťah bota či auto krok s textom je vykonaný a čaká na „ďalej“ (vyucbaDalej) — U5. */
  readonly vykonany: boolean;
  readonly melichar: string;
  /** Kľúče prvkov na zvýraznenie, napr. „bar:poldeci“, „ruka:hasic“ — v UI atribút data-vyucba. */
  readonly zvyraznit: readonly string[];
  readonly ocakava: Command | null;
  /** Kontrolná otázka: 2–3 možnosti, aspoň jedna správna — klient overí sám; inak null. */
  readonly moznosti: readonly { readonly text: string; readonly spravna: boolean; readonly vysvetlenie: string }[] | null;
  /** Rozhodnutie: kandidáti na zvýraznenie (kľúče ako zvyraznit) namiesto očakávanej karty; inak null. */
  readonly volba: { readonly kandidati: readonly string[] } | null;
  /** Nápis tlačidla „ďalej“ (napr. „Odovzdať cigaretu“); null = „ďalej“. */
  readonly tlacidlo: string | null;
  /** „Ďalej“ odovzdá Melicharovi 1 hernú cigaretu — server ju uberie (Michal 2026-10-25). */
  readonly odovzdaCigaretu: boolean;
  /** Ponúknuť „Preskočiť výučbu“ (úvod s cigaretou). */
  readonly preskocenie: boolean;
  /** So zvýraznenými prvkami sa hráč smie hrať nanečisto — nič sa neposiela (stavba šenku). */
  readonly naneisto: boolean;
}

/** Krok ťahu slovami (jadro popisKroku); uid = karta, ktorú treba zvýrazniť. */
export interface PopisKrokuVyucby {
  readonly typ: Command["type"];
  readonly popis: string;
  readonly uid: number | null;
}

export interface StavVyucby {
  /** null po poslednom kroku. */
  readonly krok: KrokVyucby | null;
  readonly hotovo: boolean;
}

type ServerMsg =
  | { type: "privitanie"; code: string; seat: 0 | 1; started: boolean; verejna: boolean; dlzka: DlzkaHry; sada: Sada }
  | { type: "hraci"; hraci: [HracInfo | null, HracInfo | null] }
  | { type: "state"; view: ClientState; events: Event[] }
  /** Doterajší log partie pri návrate (obnovenie stránky, výpadok) — nahrádza miestny. */
  | { type: "historia"; events: Event[] }
  | { type: "superPripojeny"; connected: boolean }
  | { type: "frajerina"; zmeny: ZmenyFrajeriny }
  /** Hláška majstra Melichara zo soundboardu — server ju posiela obom hráčom. */
  | { type: "melichar"; id: string; seat: 0 | 1; trvanieMs: number }
  /** Výučba „Prvá hra“: aktuálny krok po každej zmene. */
  | { type: "vyucba"; krok: KrokVyucby | null; hotovo: boolean }
  /** Achievement práve získaný — server ho posiela LEN tomuto hráčovi. */
  | { type: "achievement"; zisk: ZiskAchievementu }
  /** Na konci partie (aj po návrate do skončenej partie): získané a „chýbalo málo“. */
  | { type: "achievementySuhrn"; suhrn: SuhrnAchievementov }
  /** Zlý ťah vo výučbe: čo chýba a čo je navyše (text príde aj ako error). */
  | { type: "vyucbaChyba"; chybajuce: readonly PopisKrokuVyucby[]; navyse: readonly PopisKrokuVyucby[] }
  /** Rozhodnutie vo výučbe: zlý ťah dostane radu Melichara namiesto chyby. */
  | { type: "vyucbaRada"; text: string }
  | { type: "error"; text: string };

/**
 * Achievementy (Michal 2026-10-23) — tvar zo servera (packages/server/src/achievementy.ts).
 * popis má dosadený prah ranku; rankov = počet ★ achievementu (1 – 3).
 */
export interface AchievementPreKlienta {
  readonly id: string;
  readonly nazov: string;
  readonly popis: string;
  readonly kategoria: string | null;
  /** „akcia:<Akcia>“ alebo „podmienka:<podmienka>“ (ikony kariet), inak null. */
  readonly piktogram: string | null;
  readonly tajny: boolean;
  readonly rankov: number;
  /** Vzácnosť každého ranku: bezne | nezvycajne | vzacne | legendarne (podľa Navrhára). */
  readonly zriedkavost: readonly string[];
}

/** Získaný rank — oznam v partii. vzacny = 3★ alebo tajný (Melichar sa ozve). */
export interface ZiskAchievementu extends AchievementPreKlienta {
  readonly rank: number;
  readonly hodnota: number;
  readonly vzacny: boolean;
}

/** „Chýbalo málo“: k ranku `rank` chýba prah − hodnota. */
export interface PriblizenieAchievementu extends AchievementPreKlienta {
  readonly rank: number;
  readonly hodnota: number;
  readonly prah: number;
}

export interface SuhrnAchievementov {
  readonly ziskane: readonly ZiskAchievementu[];
  readonly chybaloMalo: readonly PriblizenieAchievementu[];
}

/** Pustená hláška Melichara; n rastie, aby sa tá istá hláška dala pustiť znova. */
export interface HlaskaVPartii {
  readonly n: number;
  readonly id: string;
  readonly seat: 0 | 1;
  readonly trvanieMs: number;
}

export interface HraHook {
  readonly pripojene: boolean;
  readonly miestnost: Miestnost | null;
  readonly data: GameData | null;
  readonly hraci: readonly [HracInfo | null, HracInfo | null];
  readonly view: ClientState | null;
  readonly log: readonly string[];
  /** Udalosti poslednej správy so stavom (id rastie) — účet Pitky a bitky na stole. */
  readonly udalosti: { readonly id: number; readonly events: readonly Event[] };
  readonly chyba: string | null;
  readonly superPripojeny: boolean;
  readonly frajerina: ZmenyFrajeriny | null;
  /** Posledná hláška Melichara pustená v partii (ktorýmkoľvek hráčom). */
  readonly melichar: HlaskaVPartii | null;
  /** Pustí hlášku zo soundboardu — server overí pauzu a pošle ju obom. */
  pustiMelichara(id: string): void;
  /** Výučba „Prvá hra“ v tejto miestnosti, inak null. */
  readonly vyucba: StavVyucby | null;
  /** Achievementy získané v tejto partii v poradí zisku; n rastie s každým novým (oznam). */
  readonly achievementy: { readonly n: number; readonly zisky: readonly ZiskAchievementu[] };
  /** Súhrn achievementov po konci partie, inak null. */
  readonly suhrnAchievementov: SuhrnAchievementov | null;
  /** Posledný zlý ťah vo výučbe (čo chýba, čo je navyše); zmizne ďalším ťahom alebo zrusChybu. */
  /** Rada Melichara po zlom ťahu v rozhodnutí; zmizne ďalším ťahom alebo zrusChybu. */
  readonly radaVyucby: string | null;
  /** Odpoveď na kontrolnú otázku (index možnosti) — server si zapíše prvú. */
  vyucbaOdpoved(index: number): void;
  readonly chybaVyucby: { readonly chybajuce: readonly PopisKrokuVyucby[]; readonly navyse: readonly PopisKrokuVyucby[] } | null;
  /** Spustí výučbu (server pokračuje od uloženého kroku). */
  zalozVyucbu(): void;
  /** Potvrdí krok výučby bez ťahu (len text Melichara). */
  vyucbaDalej(): void;
  /** Nová hra; bot = proti offline protihráčovi (počítač), začína hneď. */
  zaloz(verejna: boolean, dlzka: DlzkaHry, bot?: boolean): void;
  pripoj(code: string): void;
  cmd(command: Command): void;
  /** Kontumačná výhra, keď je súper dlho odpojený (server overí čas). */
  kontumacia(): void;
  odid(): void;
  zrusChybu(): void;
}

const KLUC = "naex.miestnost";

export function textUdalosti(e: Event, mena: readonly string[], rody: readonly [Rod, Rod]): string | null {
  const meno = (p: number) => mena[p] ?? `Hráč ${p + 1}`;
  switch (e.type) {
    case "log":
      return textHlasky(e.text, mena, rody);
    case "tahal":
      return `${meno(e.hrac)} ťahá ${kariet(e.pocet)}.`;
    case "manualEfekt":
      return `⚠ EFEKT (vyhodnoťte ručne): ${e.nazov} — ${e.text}`;
    case "moment":
      return `★ ${textHlasky(e.moment.popis, mena, rody)}`;
    case "bitkaVysledok":
      return `Bitka: tuhé ${e.damage.tuhe[0]}:${e.damage.tuhe[1]}, celkové ${e.damage.celkove[0]}:${e.damage.celkove[1]} — ${e.vitaz === null ? "remíza, lokalita ide na sekeru" : `vyhráva ${meno(e.vitaz)}`}${e.prebytok > 0 ? `, prebytok ${e.prebytok}` : ""}.`;
    case "koniec":
      return e.body === null
        ? `KONIEC: ${textHlasky(e.dovod, mena, rody)}`
        : `KONIEC: ${textHlasky(e.dovod, mena, rody)} Body ${e.body[0]}:${e.body[1]}.`;
    default:
      return null;
  }
}

export function useHra(aktivne: boolean): HraHook {
  const [pripojene, setPripojene] = useState(false);
  const [miestnost, setMiestnost] = useState<Miestnost | null>(null);
  const [hraci, setHraci] = useState<readonly [HracInfo | null, HracInfo | null]>([null, null]);
  const [view, setView] = useState<ClientState | null>(null);
  const [log, setLog] = useState<readonly string[]>([]);
  const [udalosti, setUdalosti] = useState<{ readonly id: number; readonly events: readonly Event[] }>({ id: 0, events: [] });
  const [chyba, setChyba] = useState<string | null>(null);
  const [superPripojeny, setSuperPripojeny] = useState(true);
  const [frajerina, setFrajerina] = useState<ZmenyFrajeriny | null>(null);
  const [melichar, setMelichar] = useState<HlaskaVPartii | null>(null);
  const [vyucba, setVyucba] = useState<StavVyucby | null>(null);
  const [achievementy, setAchievementy] = useState<{ readonly n: number; readonly zisky: readonly ZiskAchievementu[] }>({ n: 0, zisky: [] });
  const [suhrnAchievementov, setSuhrnAchievementov] = useState<SuhrnAchievementov | null>(null);
  const [chybaVyucby, setChybaVyucby] = useState<HraHook["chybaVyucby"]>(null);
  const [radaVyucby, setRadaVyucby] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const menaRef = useRef<string[]>([]);
  menaRef.current = hraci.map((h, i) => menoVoVete(h, i));
  const rodyRef = useRef<[Rod, Rod]>([null, null]);
  rodyRef.current = [rodHraca(hraci[0]), rodHraca(hraci[1])];

  const connect = useCallback(() => {
    const proto = location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${proto}://${location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      setPripojene(true);
      const kod = localStorage.getItem(KLUC);
      if (kod !== null) ws.send(JSON.stringify({ type: "rejoin", code: kod }));
    };

    ws.onmessage = (raw) => {
      const msg = JSON.parse(String(raw.data)) as ServerMsg;
      switch (msg.type) {
        case "privitanie":
          setMiestnost({ code: msg.code, seat: msg.seat, started: msg.started, verejna: msg.verejna, dlzka: msg.dlzka, sada: msg.sada });
          setFrajerina(null);
          setAchievementy({ n: 0, zisky: [] });
          setSuhrnAchievementov(null);
          // Krok výučby príde hneď po privítaní — iná miestnosť výučbu nemá.
          setVyucba(null);
          localStorage.setItem(KLUC, msg.code);
          setChyba(null);
          break;
        case "hraci":
          setHraci(msg.hraci);
          // História príde hneď za menami, ešte pred prekreslením — inak by Log po
          // obnovení stránky písal „Hráč 1“ namiesto mena.
          menaRef.current = msg.hraci.map((h, i) => menoVoVete(h, i));
          rodyRef.current = [rodHraca(msg.hraci[0]), rodHraca(msg.hraci[1])];
          break;
        case "historia":
          setLog(msg.events.map((e) => textUdalosti(e, menaRef.current, rodyRef.current)).filter((t): t is string => t !== null).slice(-250));
          break;
        case "state":
          setView(msg.view);
          setChybaVyucby(null);
          setRadaVyucby(null);
          setMiestnost((m) => (m === null || m.started ? m : { ...m, started: true }));
          setLog((stary) => {
            const nove = msg.events.map((e) => textUdalosti(e, menaRef.current, rodyRef.current)).filter((t): t is string => t !== null);
            return [...stary, ...nove].slice(-250);
          });
          if (msg.events.length > 0) setUdalosti((u) => ({ id: u.id + 1, events: msg.events }));
          break;
        case "superPripojeny":
          setSuperPripojeny(msg.connected);
          break;
        case "frajerina":
          setFrajerina(msg.zmeny);
          break;
        case "melichar":
          setMelichar((h) => ({ n: (h?.n ?? 0) + 1, id: msg.id, seat: msg.seat, trvanieMs: msg.trvanieMs }));
          break;
        case "vyucba":
          setVyucba({ krok: msg.krok, hotovo: msg.hotovo });
          break;
        case "achievement":
          setAchievementy((a) => ({ n: a.n + 1, zisky: [...a.zisky, msg.zisk] }));
          break;
        case "achievementySuhrn":
          setSuhrnAchievementov(msg.suhrn);
          break;
        case "vyucbaRada":
          setRadaVyucby(msg.text);
          break;
        case "vyucbaChyba":
          setChybaVyucby({ chybajuce: msg.chybajuce, navyse: msg.navyse });
          break;
        case "error":
          // Rozohraná partia zanikla (napr. reštart servera — miestnosti žijú
          // v pamäti). Inak by plocha ukazovala starý stav a každý ťah by
          // padal do prázdna; radšej späť do lobby s vysvetlením.
          if (miestnostRef.current !== null && /neexistuje|Nie si v miestnosti/.test(msg.text)) {
            localStorage.removeItem(KLUC);
            setMiestnost(null);
            setView(null);
            setLog([]);
            setHraci([null, null]);
            setVyucba(null);
            setChyba("Partia sa stratila — server sa medzitým reštartoval. Založ novú hru.");
            break;
          }
          // Zaniknutá alebo cudzia miestnosť pred vstupom → zabudni ju.
          if (/neexistuje|nehráš|plná/.test(msg.text) && localStorage.getItem(KLUC) !== null && miestnostRef.current === null) {
            localStorage.removeItem(KLUC);
          }
          setChyba(msg.text);
          break;
      }
    };

    ws.onclose = () => {
      setPripojene(false);
      // Automatický návrat — server aj sieť sa vracajú samy.
      setTimeout(() => {
        if (wsRef.current === ws) connect();
      }, 2000);
    };
  }, []);

  const miestnostRef = useRef<Miestnost | null>(null);
  miestnostRef.current = miestnost;

  useEffect(() => {
    if (!aktivne) return;
    connect();
    return () => {
      const ws = wsRef.current;
      wsRef.current = null;
      ws?.close();
    };
  }, [connect, aktivne]);

  const posli = useCallback((msg: unknown) => {
    const ws = wsRef.current;
    if (ws !== null && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }, []);

  const data = useMemo(() => (miestnost === null ? null : loadGameData(miestnost.sada.cardsJson, eldersJson, miestnost.sada.scorecardsJson ?? scorecardsJson)), [miestnost?.sada]);

  return {
    pripojene,
    miestnost,
    data,
    hraci,
    view,
    log,
    udalosti,
    chyba,
    superPripojeny,
    frajerina,
    melichar,
    achievementy,
    suhrnAchievementov,
    pustiMelichara: useCallback((id: string) => posli({ type: "melichar", id }), [posli]),
    vyucba,
    chybaVyucby,
    radaVyucby,
    vyucbaOdpoved: useCallback((index: number) => posli({ type: "vyucbaOdpoved", index }), [posli]),
    zalozVyucbu: useCallback(() => posli({ type: "create", vyucba: true }), [posli]),
    vyucbaDalej: useCallback(() => posli({ type: "vyucbaDalej" }), [posli]),
    zaloz: useCallback((verejna: boolean, dlzka: DlzkaHry, bot = false) => posli({ type: "create", verejna, dlzka, bot }), [posli]),
    pripoj: useCallback((code: string) => posli({ type: "join", code: code.trim().toUpperCase() }), [posli]),
    cmd: useCallback((command: Command) => posli({ type: "cmd", cmd: command }), [posli]),
    kontumacia: useCallback(() => posli({ type: "kontumacia" }), [posli]),
    odid: useCallback(() => {
      posli({ type: "leave" });
      localStorage.removeItem(KLUC);
      setMiestnost(null);
      setView(null);
      setLog([]);
      setHraci([null, null]);
      setFrajerina(null);
      setVyucba(null);
      setAchievementy({ n: 0, zisky: [] });
      setSuhrnAchievementov(null);
    }, [posli]),
    zrusChybu: useCallback(() => {
      setChyba(null);
      setChybaVyucby(null);
      setRadaVyucby(null);
    }, []),
  };
}

// Spojenie s herným serverom + automatický návrat do partie (M9).
//
// Miesto v miestnosti patrí prihlásenému hráčovi — po obnovení stránky sa
// pošle rejoin s kódom z localStorage a hráč pokračuje, kde prestal.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ClientState, Command, DlzkaHry, Event, GameData } from "@naex/core";
import { loadGameData } from "@naex/core";
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
  | { type: "error"; text: string };

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

function textUdalosti(e: Event, mena: readonly string[]): string | null {
  const meno = (p: number) => mena[p] ?? `Hráč ${p + 1}`;
  switch (e.type) {
    case "log":
      return e.text.replace(/Hráč ([12])/g, (_, n: string) => meno(Number(n) - 1));
    case "tahal":
      return `${meno(e.hrac)} ťahá ${e.pocet} kariet.`;
    case "manualEfekt":
      return `⚠ EFEKT (vyhodnoťte ručne): ${e.nazov} — ${e.text}`;
    case "bitkaVysledok":
      return `Bitka: tuhé ${e.damage.tuhe[0]}:${e.damage.tuhe[1]}, celkové ${e.damage.celkove[0]}:${e.damage.celkove[1]} — ${e.vitaz === null ? "remíza, lokalita ide na sekeru" : `vyhráva ${meno(e.vitaz)}`}${e.prebytok > 0 ? `, prebytok ${e.prebytok}` : ""}.`;
    case "koniec":
      return e.body === null ? `KONIEC: ${e.dovod}` : `KONIEC: ${e.dovod} Body ${e.body[0]}:${e.body[1]}.`;
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
  const wsRef = useRef<WebSocket | null>(null);
  const menaRef = useRef<string[]>([]);
  menaRef.current = hraci.map((h, i) => h?.meno ?? `Hráč ${i + 1}`);

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
          localStorage.setItem(KLUC, msg.code);
          setChyba(null);
          break;
        case "hraci":
          setHraci(msg.hraci);
          break;
        case "historia":
          setLog(msg.events.map((e) => textUdalosti(e, menaRef.current)).filter((t): t is string => t !== null).slice(-250));
          break;
        case "state":
          setView(msg.view);
          setMiestnost((m) => (m === null || m.started ? m : { ...m, started: true }));
          setLog((stary) => {
            const nove = msg.events.map((e) => textUdalosti(e, menaRef.current)).filter((t): t is string => t !== null);
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
    pustiMelichara: useCallback((id: string) => posli({ type: "melichar", id }), [posli]),
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
    }, [posli]),
    zrusChybu: useCallback(() => setChyba(null), []),
  };
}

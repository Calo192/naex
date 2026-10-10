// Spojenie s herným serverom + automatický návrat do partie (M9).
//
// Miesto v miestnosti patrí prihlásenému hráčovi — po obnovení stránky sa
// pošle rejoin s kódom z localStorage a hráč pokračuje, kde prestal.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ClientState, Command, Event, GameData } from "@naex/core";
import { loadGameData } from "@naex/core";
import eldersJson from "@naex/core/data/elders.json";
import type { Sada } from "@naex/tvorba";

export interface HracInfo {
  readonly meno: string;
  readonly avatar: string | null;
}

export interface Miestnost {
  readonly code: string;
  readonly seat: 0 | 1;
  readonly started: boolean;
  readonly verejna: boolean;
  readonly sada: Sada;
}

type ServerMsg =
  | { type: "privitanie"; code: string; seat: 0 | 1; started: boolean; verejna: boolean; sada: Sada }
  | { type: "hraci"; hraci: [HracInfo | null, HracInfo | null] }
  | { type: "state"; view: ClientState; events: Event[] }
  | { type: "superPripojeny"; connected: boolean }
  | { type: "error"; text: string };

export interface HraHook {
  readonly pripojene: boolean;
  readonly miestnost: Miestnost | null;
  readonly data: GameData | null;
  readonly hraci: readonly [HracInfo | null, HracInfo | null];
  readonly view: ClientState | null;
  readonly log: readonly string[];
  readonly chyba: string | null;
  readonly superPripojeny: boolean;
  zaloz(verejna: boolean): void;
  pripoj(code: string): void;
  cmd(command: Command): void;
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
      return `Bitka: tuhé ${e.damage.tuhe[0]}:${e.damage.tuhe[1]}, celkové ${e.damage.celkove[0]}:${e.damage.celkove[1]} — vyhráva ${meno(e.vitaz)}${e.prebytok > 0 ? `, prebytok ${e.prebytok}` : ""}.`;
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
  const [chyba, setChyba] = useState<string | null>(null);
  const [superPripojeny, setSuperPripojeny] = useState(true);
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
          setMiestnost({ code: msg.code, seat: msg.seat, started: msg.started, verejna: msg.verejna, sada: msg.sada });
          localStorage.setItem(KLUC, msg.code);
          setChyba(null);
          break;
        case "hraci":
          setHraci(msg.hraci);
          break;
        case "state":
          setView(msg.view);
          setMiestnost((m) => (m === null || m.started ? m : { ...m, started: true }));
          setLog((stary) => {
            const nove = msg.events.map((e) => textUdalosti(e, menaRef.current)).filter((t): t is string => t !== null);
            return [...stary, ...nove].slice(-250);
          });
          break;
        case "superPripojeny":
          setSuperPripojeny(msg.connected);
          break;
        case "error":
          // Zaniknutá alebo cudzia miestnosť → zabudni ju.
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

  const data = useMemo(() => (miestnost === null ? null : loadGameData(miestnost.sada.cardsJson, eldersJson)), [miestnost?.sada]);

  return {
    pripojene,
    miestnost,
    data,
    hraci,
    view,
    log,
    chyba,
    superPripojeny,
    zaloz: useCallback((verejna: boolean) => posli({ type: "create", verejna }), [posli]),
    pripoj: useCallback((code: string) => posli({ type: "join", code: code.trim().toUpperCase() }), [posli]),
    cmd: useCallback((command: Command) => posli({ type: "cmd", cmd: command }), [posli]),
    odid: useCallback(() => {
      posli({ type: "leave" });
      localStorage.removeItem(KLUC);
      setMiestnost(null);
      setView(null);
      setLog([]);
      setHraci([null, null]);
    }, [posli]),
    zrusChybu: useCallback(() => setChyba(null), []),
  };
}

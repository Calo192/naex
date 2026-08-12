// Spojenie so serverom + automatický návrat do partie (M9).
//
// Kód miestnosti a token hráča žijú v localStorage — obnovenie stránky
// uprostred kola pošle rejoin a hráč pokračuje, kde prestal.

import { useCallback, useEffect, useRef, useState } from "react";
import type { ClientState, Command, Event } from "@naex/core";

export interface Session {
  readonly code: string;
  readonly token: string;
  readonly seat: 0 | 1;
}

type ServerMsg =
  | { type: "privitanie"; code: string; seat: 0 | 1; token: string; started: boolean }
  | { type: "state"; view: ClientState; events: Event[] }
  | { type: "superPripojeny"; connected: boolean }
  | { type: "error"; text: string };

export interface ServerHook {
  readonly pripojene: boolean;
  readonly session: Session | null;
  readonly view: ClientState | null;
  readonly log: readonly string[];
  readonly chyba: string | null;
  readonly superPripojeny: boolean;
  create(): void;
  join(code: string): void;
  cmd(command: Command): void;
  opustit(): void;
}

const STORAGE_KEY = "naex.session";

function ulozenaSession(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === null ? null : (JSON.parse(raw) as Session);
  } catch {
    return null;
  }
}

function textUdalosti(e: Event): string | null {
  switch (e.type) {
    case "log":
      return e.text;
    case "faza":
      return null; // fáza je viditeľná v hlavičke
    case "tahal":
      return `Hráč ${e.hrac + 1} ťahá ${e.pocet} kariet.`;
    case "kartyTahane":
      return null; // súkromný detail — karty pribudnú v ruke
    case "manualEfekt":
      return `⚠ EFEKT (ručne): ${e.nazov} — ${e.text}`;
    case "bitkaVysledok":
      return `Bitka: tuhé ${e.damage.tuhe[0]}:${e.damage.tuhe[1]}, celkové ${e.damage.celkove[0]}:${e.damage.celkove[1]} — vyhráva hráč ${e.vitaz + 1}${e.prebytok > 0 ? `, prebytok ${e.prebytok}` : ""}.`;
    case "koniec":
      return e.body === null
        ? `KONIEC: ${e.dovod}`
        : `KONIEC: ${e.dovod} Body ${e.body[0]}:${e.body[1]}.`;
    default:
      return null;
  }
}

export function useServer(): ServerHook {
  const [pripojene, setPripojene] = useState(false);
  const [session, setSession] = useState<Session | null>(ulozenaSession());
  const [view, setView] = useState<ClientState | null>(null);
  const [log, setLog] = useState<readonly string[]>([]);
  const [chyba, setChyba] = useState<string | null>(null);
  const [superPripojeny, setSuperPripojeny] = useState(true);
  const wsRef = useRef<WebSocket | null>(null);
  const sessionRef = useRef<Session | null>(session);
  sessionRef.current = session;

  const connect = useCallback(() => {
    const proto = location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${proto}://${location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      setPripojene(true);
      const s = sessionRef.current;
      if (s !== null) ws.send(JSON.stringify({ type: "rejoin", code: s.code, token: s.token }));
    };

    ws.onmessage = (raw) => {
      const msg = JSON.parse(String(raw.data)) as ServerMsg;
      switch (msg.type) {
        case "privitanie": {
          const nova: Session = { code: msg.code, token: msg.token, seat: msg.seat };
          setSession(nova);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(nova));
          setChyba(null);
          break;
        }
        case "state": {
          setView(msg.view);
          setLog((stary) => {
            const nove = msg.events.map(textUdalosti).filter((t): t is string => t !== null);
            return [...stary, ...nove].slice(-200);
          });
          break;
        }
        case "superPripojeny":
          setSuperPripojeny(msg.connected);
          break;
        case "error": {
          setChyba(msg.text);
          // Zaniknutá miestnosť alebo zlý token → session je bezcenná.
          if (msg.text.includes("neexistuje") || msg.text.includes("token")) {
            localStorage.removeItem(STORAGE_KEY);
            setSession(null);
            setView(null);
          }
          break;
        }
      }
    };

    ws.onclose = () => {
      setPripojene(false);
      // Automatický pokus o návrat — server aj sieť sa vracajú samy.
      setTimeout(() => {
        if (wsRef.current === ws) connect();
      }, 2000);
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      const ws = wsRef.current;
      wsRef.current = null;
      ws?.close();
    };
  }, [connect]);

  const posli = useCallback((msg: unknown) => {
    const ws = wsRef.current;
    if (ws !== null && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }, []);

  return {
    pripojene,
    session,
    view,
    log,
    chyba,
    superPripojeny,
    create: useCallback(() => posli({ type: "create" }), [posli]),
    join: useCallback((code: string) => posli({ type: "join", code: code.trim() }), [posli]),
    cmd: useCallback((command: Command) => posli({ type: "cmd", cmd: command }), [posli]),
    opustit: useCallback(() => {
      localStorage.removeItem(STORAGE_KEY);
      setSession(null);
      setView(null);
      setLog([]);
    }, []),
  };
}

// Autoritatívny herný server + webová platforma (M7, M12).
//
// Jediné miesto, ktoré pozná celý GameState. Klientom sa VŽDY posiela len
// viewFor(seat) + eventsFor(seat) — nikdy celý stav. Server overuje, kto
// príkaz poslal: hráč nemôže hrať za súpera ani mimo poradia.
//
// Jeden Node proces obsluhuje statického klienta, REST API (/api), nahrané
// súbory (/media) aj WebSocket (/ws) — jeden pôvod, žiadne CORS.
// Účty, karty a sady sú v SQLite (NAEX_DATA); rozohrané partie v pamäti.

import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { readFileSync, existsSync, statSync, mkdirSync } from "node:fs";
import { randomInt } from "node:crypto";
import { fileURLToPath } from "node:url";
import { join, normalize, extname, resolve } from "node:path";
import { WebSocketServer, WebSocket } from "ws";
import type { Command, Event, GameData, GameState, PlayerId } from "@naex/core";
import type { Sada } from "@naex/tvorba";
import { IllegalCommandError, apply, eventsFor, loadGameData, setupGame, viewFor } from "@naex/core";
import { otvorDb } from "./db.ts";
import type { Pouzivatel } from "./auth.ts";
import { Ucty } from "./auth.ts";
import { Media } from "./media.ts";
import { Obsah, nacitajElders } from "./obsah.ts";
import type { OtvorenaHra } from "./api.ts";
import { spracujApi } from "./api.ts";

// ---------------------------------------------------------------------------
// Dáta z repozitára (testy jadra a nástroje ich používajú priamo)

export function loadDataFromDisk(): GameData {
  const cards = JSON.parse(
    readFileSync(fileURLToPath(new URL("../../core/data/cards.json", import.meta.url)), "utf8"),
  ) as unknown;
  return loadGameData(cards, nacitajElders());
}

// ---------------------------------------------------------------------------
// Miestnosti

interface HracVMiestnosti {
  readonly id: number;
  meno: string;
  avatar: string | null;
}

interface Room {
  readonly code: string;
  /** Sada, s ktorou miestnosť vznikla — zverejnenie novej ju nezmení. */
  readonly data: GameData;
  /** Celá sada vrátane vzhľadu kariet — klient z nej kreslí aj počíta. */
  readonly sada: Sada;
  readonly verejna: boolean;
  readonly vytvorena: number;
  state: GameState | null;
  readonly hraci: [HracVMiestnosti | null, HracVMiestnosti | null];
  readonly sockets: [WebSocket | null, WebSocket | null];
  lastActivity: number;
}

/** Bez O/0/I/1 — kód sa diktuje cez telefón. */
const ABECEDA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function novyKod(rooms: Map<string, Room>): string {
  for (;;) {
    let code = "";
    for (let i = 0; i < 4; i++) code += ABECEDA[randomInt(ABECEDA.length)];
    if (!rooms.has(code)) return code;
  }
}

type ClientMsg =
  | { type: "create"; verejna?: boolean }
  | { type: "join"; code: string }
  | { type: "rejoin"; code: string }
  | { type: "leave" }
  | { type: "cmd"; cmd: Command };

interface SocketInfo {
  readonly pouzivatel: Pouzivatel;
  room: Room | null;
  seat: PlayerId | null;
  alive: boolean;
}

export interface GameServer {
  readonly http: Server;
  readonly port: number;
  close(): Promise<void>;
}

export interface ServerOpts {
  readonly port: number;
  readonly staticDir?: string;
  /** Adresár s databázou a nahranými súbormi (predvolene ./data). */
  readonly dataDir?: string;
  /** Prihlasovacie mená administrátorov (NAEX_ADMINS). */
  readonly admini?: readonly string[];
  /** Cookie s príznakom Secure (za HTTPS proxy). */
  readonly bezpecneCookie?: boolean;
}

export function createGameServer(opts: ServerOpts): Promise<GameServer> {
  const teraz = (): number => Date.now();
  const dataDir = resolve(opts.dataDir ?? "data");
  mkdirSync(dataDir, { recursive: true });
  const db = otvorDb(join(dataDir, "naex.sqlite"));
  const ucty = new Ucty(db, opts.admini ?? []);
  const media = new Media(db, dataDir);
  const obsah = new Obsah(db, media);
  obsah.naplnAkTreba(teraz());

  const rooms = new Map<string, Room>();
  const infos = new WeakMap<WebSocket, SocketInfo>();

  const staticDir = opts.staticDir ?? fileURLToPath(new URL("../../../apps/web/dist", import.meta.url));

  const otvoreneHry = (): OtvorenaHra[] =>
    [...rooms.values()]
      .filter((r) => r.verejna && r.state === null && r.hraci[0] !== null && r.sockets[0] !== null && r.hraci[1] === null)
      .map((r) => ({ kod: r.code, hostitel: { meno: r.hraci[0]?.meno ?? "?", avatar: r.hraci[0]?.avatar ?? null }, vytvorena: r.vytvorena }))
      .sort((a, b) => b.vytvorena - a.vytvorena);

  const http = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (url.pathname.startsWith("/api/")) {
      void spracujApi(
        {
          ucty,
          obsah,
          media,
          teraz,
          bezpecneCookie: opts.bezpecneCookie ?? false,
          otvoreneHry,
          poZverejneni: () => undefined,
        },
        req,
        res,
        url.pathname,
        url.searchParams,
      );
      return;
    }
    if (url.pathname.startsWith("/media/")) {
      media.posli(url.pathname.slice("/media/".length), res);
      return;
    }
    serveStatic(staticDir, req, res);
  });
  const wss = new WebSocketServer({ server: http, path: "/ws" });

  const send = (ws: WebSocket, msg: unknown): void => {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  };

  const sendError = (ws: WebSocket, text: string): void => {
    send(ws, { type: "error", text });
  };

  /** Každému pripojenému hráčovi jeho pohľad + jeho udalosti. */
  const broadcast = (room: Room, events: readonly Event[]): void => {
    if (room.state === null) return;
    for (const seat of [0, 1] as const) {
      const ws = room.sockets[seat];
      if (ws === null) continue;
      send(ws, { type: "state", view: viewFor(room.data, room.state, seat), events: eventsFor(events, seat) });
    }
  };

  const posliHracov = (room: Room): void => {
    const hraci = room.hraci.map((h) => (h === null ? null : { meno: h.meno, avatar: h.avatar }));
    for (const ws of room.sockets) if (ws !== null) send(ws, { type: "hraci", hraci });
  };

  const oznamPripojenie = (room: Room, seat: PlayerId, connected: boolean): void => {
    const druhy = room.sockets[seat === 0 ? 1 : 0];
    if (druhy !== null) send(druhy, { type: "superPripojeny", connected });
  };

  const usadit = (ws: WebSocket, room: Room, seat: PlayerId): void => {
    const info = infos.get(ws);
    if (info === undefined) return;
    if (info.room !== null && info.room !== room) odist(ws);
    // Druhý tab toho istého hráča preberá miesto.
    const stary = room.sockets[seat];
    if (stary !== null && stary !== ws) {
      sendError(stary, "Pripojenie prevzal iný tab alebo okno.");
      const si = infos.get(stary);
      if (si !== undefined) {
        si.room = null;
        si.seat = null;
      }
      stary.close();
    }
    const p = info.pouzivatel;
    room.hraci[seat] = { id: p.id, meno: p.meno, avatar: p.avatar };
    room.sockets[seat] = ws;
    info.room = room;
    info.seat = seat;
    room.lastActivity = teraz();
    send(ws, {
      type: "privitanie",
      code: room.code,
      seat,
      started: room.state !== null,
      verejna: room.verejna,
      sada: room.sada,
    });
    posliHracov(room);
    if (room.state !== null) {
      send(ws, { type: "state", view: viewFor(room.data, room.state, seat), events: [] });
      send(ws, { type: "superPripojeny", connected: room.sockets[seat === 0 ? 1 : 0] !== null });
    }
    oznamPripojenie(room, seat, true);
  };

  /** Odchod z miestnosti, ktorá ešte nezačala, ju uvoľní; rozohraná ostáva. */
  const odist = (ws: WebSocket): void => {
    const info = infos.get(ws);
    if (info === undefined || info.room === null || info.seat === null) return;
    const { room, seat } = info;
    if (room.sockets[seat] === ws) room.sockets[seat] = null;
    if (room.state === null) {
      room.hraci[seat] = null;
      if (room.hraci[0] === null && room.hraci[1] === null) rooms.delete(room.code);
    }
    oznamPripojenie(room, seat, false);
    info.room = null;
    info.seat = null;
  };

  const handleMsg = (ws: WebSocket, msg: ClientMsg): void => {
    const info = infos.get(ws);
    if (info === undefined) return;
    const ja = info.pouzivatel;

    switch (msg.type) {
      case "create": {
        const { sada, data } = obsah.aktualnaSada();
        const room: Room = {
          code: novyKod(rooms),
          data,
          sada,
          verejna: msg.verejna === true,
          vytvorena: teraz(),
          state: null,
          hraci: [null, null],
          sockets: [null, null],
          lastActivity: teraz(),
        };
        rooms.set(room.code, room);
        usadit(ws, room, 0);
        break;
      }
      case "join":
      case "rejoin": {
        const room = rooms.get(String(msg.code ?? "").toUpperCase());
        if (room === undefined) {
          sendError(ws, "Miestnosť s týmto kódom neexistuje.");
          return;
        }
        // Hráč, ktorý už v miestnosti sedí, sa vracia na svoje miesto.
        const moje = room.hraci.findIndex((h) => h?.id === ja.id);
        if (moje === 0 || moje === 1) {
          usadit(ws, room, moje);
          return;
        }
        if (msg.type === "rejoin" || room.state !== null || room.hraci[1] !== null) {
          sendError(ws, room.state !== null || room.hraci[1] !== null ? "Miestnosť je plná." : "V tejto miestnosti nehráš.");
          return;
        }
        const seat: PlayerId = room.hraci[0] === null ? 0 : 1;
        usadit(ws, room, seat);
        // Dvaja hráči → hra začína.
        // (usadit práve zmenil room.hraci — TS si pamätá starý stav)
        const [h0, h1] = room.hraci as readonly (HracVMiestnosti | null)[];
        if (h0 != null && h1 != null && room.state === null) {
          room.state = setupGame(room.data, randomInt(2 ** 31));
          broadcast(room, [{ type: "log", text: `Hra začína: ${h0.meno} proti ${h1.meno}.` }]);
        }
        break;
      }
      case "leave": {
        odist(ws);
        break;
      }
      case "cmd": {
        const { room, seat } = info;
        if (room === null || seat === null) {
          sendError(ws, "Nie si v miestnosti.");
          return;
        }
        if (room.state === null) {
          sendError(ws, "Hra ešte nezačala — čaká sa na súpera.");
          return;
        }
        try {
          // Autorizácia: príkaz sa vyhodnocuje VÝHRADNE za usadeného hráča.
          const result = apply(room.data, room.state, msg.cmd, seat);
          room.state = result.state;
          room.lastActivity = teraz();
          broadcast(room, result.events);
        } catch (err) {
          if (err instanceof IllegalCommandError) {
            sendError(ws, err.message);
          } else {
            console.error("Chyba pri príkaze:", err);
            sendError(ws, "Vnútorná chyba servera.");
          }
        }
        break;
      }
      default:
        sendError(ws, "Neznáma správa.");
    }
  };

  wss.on("connection", (ws, req) => {
    const pouzivatel = ucty.zRequestu(req, teraz());
    if (pouzivatel === null) {
      sendError(ws, "Na hranie sa musíš prihlásiť.");
      ws.close(4001, "neprihlaseny");
      return;
    }
    infos.set(ws, { pouzivatel, room: null, seat: null, alive: true });
    ws.on("pong", () => {
      const info = infos.get(ws);
      if (info !== undefined) info.alive = true;
    });
    ws.on("message", (raw) => {
      let msg: ClientMsg;
      try {
        msg = JSON.parse(String(raw)) as ClientMsg;
      } catch {
        sendError(ws, "Neplatná správa.");
        return;
      }
      try {
        handleMsg(ws, msg);
      } catch (err) {
        console.error("Neošetrená chyba:", err);
        sendError(ws, "Vnútorná chyba servera.");
      }
    });
    ws.on("close", () => {
      const info = infos.get(ws);
      if (info === undefined) return;
      const { room, seat } = info;
      if (room !== null && seat !== null && room.sockets[seat] === ws) {
        room.sockets[seat] = null;
        oznamPripojenie(room, seat, false);
      }
      infos.delete(ws);
    });
  });

  // Mŕtve pripojenia: ping každých 30 s, bez odpovede sa zahodia.
  const pingInterval = setInterval(() => {
    for (const ws of wss.clients) {
      const info = infos.get(ws);
      if (info === undefined) continue;
      if (!info.alive) {
        ws.terminate();
        continue;
      }
      info.alive = false;
      ws.ping();
    }
  }, 30_000);

  // Opustené miestnosti sa po 2 hodinách nečinnosti upracú.
  const cleanupInterval = setInterval(() => {
    const t = teraz();
    for (const [code, room] of rooms) {
      const prazdna = room.sockets[0] === null && room.sockets[1] === null;
      if (prazdna && t - room.lastActivity > 2 * 60 * 60 * 1000) rooms.delete(code);
    }
  }, 10 * 60 * 1000);

  return new Promise((resolveP) => {
    http.listen(opts.port, () => {
      const address = http.address();
      const port = typeof address === "object" && address !== null ? address.port : opts.port;
      resolveP({
        http,
        port,
        close: () =>
          new Promise<void>((done) => {
            clearInterval(pingInterval);
            clearInterval(cleanupInterval);
            for (const ws of wss.clients) ws.terminate();
            wss.close(() =>
              http.close(() => {
                db.close();
                done();
              }),
            );
          }),
      });
    });
  });
}

// ---------------------------------------------------------------------------
// Statický klient (produkčný build z apps/web/dist)

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".map": "application/json",
  ".woff2": "font/woff2",
};

function serveStatic(dir: string, req: IncomingMessage, res: ServerResponse): void {
  if (!existsSync(dir)) {
    res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
    res.end("NA EX server beží. Klient nie je zbuildovaný — spusti `npm run build`.\n");
    return;
  }
  const url = (req.url ?? "/").split("?")[0] ?? "/";
  const cesta = normalize(join(dir, url === "/" ? "index.html" : decodeURIComponent(url)));
  // Žiadne úniky mimo dist adresára.
  if (!cesta.startsWith(normalize(dir))) {
    res.writeHead(403).end();
    return;
  }
  const jeSubor = existsSync(cesta) && statSync(cesta).isFile();
  // Neznáma cesta → index.html (klientske stránky /pravidla, /admin…).
  const subor = jeSubor ? cesta : join(dir, "index.html");
  try {
    const obsah = readFileSync(subor);
    const hlavicky: Record<string, string> = {
      "content-type": MIME[extname(subor)] ?? "application/octet-stream",
      "x-content-type-options": "nosniff",
      "referrer-policy": "same-origin",
    };
    // Vite pridáva do názvov hash — tie sa môžu cachovať natrvalo.
    hlavicky["cache-control"] = subor.includes(`${join("assets", "")}`) ? "public, max-age=31536000, immutable" : "no-cache";
    res.writeHead(200, hlavicky);
    res.end(obsah);
  } catch {
    res.writeHead(404).end();
  }
}

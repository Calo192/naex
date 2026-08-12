// Autoritatívny herný server (M7).
//
// Jediné miesto, ktoré pozná celý GameState. Klientom sa VŽDY posiela len
// viewFor(seat) + eventsFor(seat) — nikdy celý stav. Server overuje, kto
// príkaz poslal: hráč nemôže hrať za súpera ani mimo poradia (poradie
// vynucuje apply/naTahu v jadre).
//
// Jeden Node proces obsluhuje statického klienta aj WebSocket — jeden pôvod,
// žiadne CORS. Stav žije v pamäti; databáza pre v1 netreba.

import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { randomInt, randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { join, normalize, extname } from "node:path";
import { WebSocketServer, WebSocket } from "ws";
import type { Command, Event, GameData, GameState, PlayerId } from "@naex/core";
import {
  IllegalCommandError,
  apply,
  eventsFor,
  loadGameData,
  setupGame,
  viewFor,
} from "@naex/core";

// ---------------------------------------------------------------------------
// Dáta — server smie robiť I/O, jadro nie.

export function loadDataFromDisk(): GameData {
  const cards = JSON.parse(
    readFileSync(fileURLToPath(new URL("../../core/data/cards.json", import.meta.url)), "utf8"),
  ) as unknown;
  const elders = JSON.parse(
    readFileSync(fileURLToPath(new URL("../../core/data/elders.json", import.meta.url)), "utf8"),
  ) as unknown;
  return loadGameData(cards, elders);
}

// ---------------------------------------------------------------------------
// Miestnosti

interface Room {
  readonly code: string;
  state: GameState | null;
  readonly tokens: [string, string];
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
  | { type: "create" }
  | { type: "join"; code: string }
  | { type: "rejoin"; code: string; token: string }
  | { type: "cmd"; cmd: Command };

interface SocketInfo {
  room: Room | null;
  seat: PlayerId | null;
  alive: boolean;
}

export interface GameServer {
  readonly http: Server;
  readonly port: number;
  close(): Promise<void>;
}

export function createGameServer(opts: { port: number; staticDir?: string }): Promise<GameServer> {
  const data = loadDataFromDisk();
  const rooms = new Map<string, Room>();
  const infos = new WeakMap<WebSocket, SocketInfo>();

  const staticDir =
    opts.staticDir ?? fileURLToPath(new URL("../../../apps/web/dist", import.meta.url));

  const http = createServer((req, res) => serveStatic(staticDir, req, res));
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
      send(ws, {
        type: "state",
        view: viewFor(data, room.state, seat),
        events: eventsFor(events, seat),
      });
    }
  };

  const oznamPripojenie = (room: Room, seat: PlayerId, connected: boolean): void => {
    const druhy = room.sockets[seat === 0 ? 1 : 0];
    if (druhy !== null) send(druhy, { type: "superPripojeny", connected });
  };

  const usadit = (ws: WebSocket, room: Room, seat: PlayerId): void => {
    const info = infos.get(ws);
    if (info === undefined) return;
    // Druhý tab s tým istým tokenom: nové pripojenie preberá miesto.
    const stary = room.sockets[seat];
    if (stary !== null && stary !== ws) {
      sendError(stary, "Pripojenie prevzal iný tab alebo okno.");
      infos.delete(stary);
      stary.close();
    }
    room.sockets[seat] = ws;
    info.room = room;
    info.seat = seat;
    room.lastActivity = Date.now();
    send(ws, {
      type: "privitanie",
      code: room.code,
      seat,
      token: room.tokens[seat],
      started: room.state !== null,
    });
    if (room.state !== null) {
      send(ws, { type: "state", view: viewFor(data, room.state, seat), events: [] });
      send(ws, {
        type: "superPripojeny",
        connected: room.sockets[seat === 0 ? 1 : 0] !== null,
      });
    }
    oznamPripojenie(room, seat, true);
  };

  const handleMsg = (ws: WebSocket, msg: ClientMsg): void => {
    const info = infos.get(ws);
    if (info === undefined) return;

    switch (msg.type) {
      case "create": {
        const room: Room = {
          code: novyKod(rooms),
          state: null,
          tokens: [randomBytes(16).toString("hex"), randomBytes(16).toString("hex")],
          sockets: [null, null],
          lastActivity: Date.now(),
        };
        rooms.set(room.code, room);
        usadit(ws, room, 0);
        break;
      }
      case "join": {
        const room = rooms.get(msg.code?.toUpperCase?.() ?? "");
        if (room === undefined) {
          sendError(ws, "Miestnosť s týmto kódom neexistuje.");
          return;
        }
        const seat: PlayerId | null =
          room.sockets[0] === null && room.state === null && room.sockets[1] === null
            ? 0
            : room.sockets[1] === null && room.state === null
              ? 1
              : null;
        if (seat === null) {
          sendError(ws, "Miestnosť je plná.");
          return;
        }
        usadit(ws, room, seat);
        // Dvaja hráči → hra začína.
        if (seat === 1 && room.state === null) {
          room.state = setupGame(data, randomInt(2 ** 31));
          broadcast(room, [
            { type: "log", text: "Hra začína. Kód miestnosti: " + room.code },
          ]);
        }
        break;
      }
      case "rejoin": {
        const room = rooms.get(msg.code?.toUpperCase?.() ?? "");
        if (room === undefined) {
          sendError(ws, "Miestnosť s týmto kódom neexistuje.");
          return;
        }
        const seat = room.tokens.indexOf(msg.token);
        if (seat !== 0 && seat !== 1) {
          sendError(ws, "Neplatný token hráča.");
          return;
        }
        usadit(ws, room, seat);
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
          const result = apply(data, room.state, msg.cmd, seat);
          room.state = result.state;
          room.lastActivity = Date.now();
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
    }
  };

  wss.on("connection", (ws) => {
    infos.set(ws, { room: null, seat: null, alive: true });
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
    const teraz = Date.now();
    for (const [code, room] of rooms) {
      const prazdna = room.sockets[0] === null && room.sockets[1] === null;
      if (prazdna && teraz - room.lastActivity > 2 * 60 * 60 * 1000) rooms.delete(code);
    }
  }, 10 * 60 * 1000);

  return new Promise((resolve) => {
    http.listen(opts.port, () => {
      const address = http.address();
      const port = typeof address === "object" && address !== null ? address.port : opts.port;
      resolve({
        http,
        port,
        close: () =>
          new Promise<void>((done) => {
            clearInterval(pingInterval);
            clearInterval(cleanupInterval);
            for (const ws of wss.clients) ws.terminate();
            wss.close(() => http.close(() => done()));
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
  const cesta = normalize(join(dir, url === "/" ? "index.html" : url));
  // Žiadne úniky mimo dist adresára.
  if (!cesta.startsWith(normalize(dir))) {
    res.writeHead(403).end();
    return;
  }
  const subor = existsSync(cesta) && statSync(cesta).isFile() ? cesta : join(dir, "index.html");
  try {
    const obsah = readFileSync(subor);
    res.writeHead(200, { "content-type": MIME[extname(subor)] ?? "application/octet-stream" });
    res.end(obsah);
  } catch {
    res.writeHead(404).end();
  }
}

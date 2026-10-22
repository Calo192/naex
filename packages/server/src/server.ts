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
import type { Command, DlzkaHry, DvojicaStatistik, Event, GameData, GameState, PlayerId, StatistikyKariet } from "@naex/core";
import type { Sada } from "@naex/tvorba";
import {
  DLZKY_HRY,
  IllegalCommandError,
  POVAHY,
  PREDVOLENA_DLZKA,
  apply,
  dostupneDlzky,
  eventsFor,
  legalCommands,
  loadGameData,
  mozeHrat,
  noveStatistiky,
  setupGame,
  tahBota,
  uzavriStatistiky,
  viewFor,
  zapisTah,
  zapisTahKariet,
} from "@naex/core";
import { otvorDb } from "./db.ts";
import type { Pouzivatel } from "./auth.ts";
import { Ucty } from "./auth.ts";
import { Media } from "./media.ts";
import { Avatary } from "./avatary.ts";
import { Hudba } from "./hudba.ts";
import { Obsah, nacitajElders, nacitajScorecards } from "./obsah.ts";
import type { OtvorenaHra, StavServera } from "./api.ts";
import { spracujApi } from "./api.ts";
import type { ZmenaFrajeriny } from "./archiv.ts";
import { Archiv } from "./archiv.ts";
import type { StavTempa } from "./tempo.ts";
import { TempoPartii, fazaPrikazu, noveTempo, zapisPrikaz } from "./tempo.ts";
import type { Pravo } from "./prava.ts";
import { POPIS_PRAVA, Prava } from "./prava.ts";
import { Nazory } from "./nazory.ts";
import { Playtesty } from "./playtesty.ts";
import { Navrhy } from "./navrhy.ts";
import { Roadmapa } from "./roadmapa.ts";
import { Novinky } from "./novinky.ts";
import { Hodnotenia } from "./znamky.ts";
import { titul } from "./frajerina.ts";

// ---------------------------------------------------------------------------
// Dáta z repozitára (testy jadra a nástroje ich používajú priamo)

export function loadDataFromDisk(): GameData {
  const cards = JSON.parse(
    readFileSync(fileURLToPath(new URL("../../core/data/cards.json", import.meta.url)), "utf8"),
  ) as unknown;
  return loadGameData(cards, nacitajElders(), nacitajScorecards());
}

// ---------------------------------------------------------------------------
// Miestnosti

interface HracVMiestnosti {
  readonly id: number;
  meno: string;
  avatar: string | null;
  frajerina: number;
}

/** Účet offline protihráča neexistuje — id 0 SQLite nikdy nepridelí. */
const BOT_ID = 0;

/** Ako dlho musí byť súper odpojený, kým si hráč môže vyžiadať kontumačnú výhru. */
export const KONTUMACIA_PO_MS = 3 * 60 * 1000;

interface Room {
  readonly code: string;
  /** Sada, s ktorou miestnosť vznikla — zverejnenie novej ju nezmení. */
  readonly data: GameData;
  /** Celá sada vrátane vzhľadu kariet — klient z nej kreslí aj počíta. */
  readonly sada: Sada;
  readonly verejna: boolean;
  /** Dĺžka hry — počet lokalít, o ktoré sa bude hrať. */
  readonly dlzka: DlzkaHry;
  readonly vytvorena: number;
  state: GameState | null;
  /** Čas začiatku partie (pre archív). */
  zaciatok: number;
  /** Štatistiky rozohranej partie — zapisujú sa po každom ťahu. */
  statistiky: DvojicaStatistik | null;
  /** Čas a príkazy po fázach (roadmapa #9) — ukladá sa aj pri partii s botom. */
  tempo: StavTempa | null;
  /** Štatistiky kariet rozohranej partie (pre tvorcu kariet). */
  statistikyKariet: StatistikyKariet;
  /** Zmena Frajeriny po dohraní (partia je už v archíve). */
  vysledok: readonly [ZmenaFrajeriny, ZmenaFrajeriny] | null;
  /** Odkedy je hráč na danom mieste odpojený (null = pripojený). */
  readonly odpojenyOd: [number | null, number | null];
  readonly hraci: [HracVMiestnosti | null, HracVMiestnosti | null];
  readonly sockets: [WebSocket | null, WebSocket | null];
  lastActivity: number;
  /** Miesto offline protihráča (NPC), alebo null v partii dvoch ľudí. */
  readonly bot: PlayerId | null;
  /** Povaha bota (POVAHY) — hráč si ju nevyberá, losuje sa pri založení. */
  readonly botPovaha: string;
  /** Naplánovaný ťah bota — kým beží, ďalší sa neplánuje. */
  botTimer: ReturnType<typeof setTimeout> | null;
  /**
   * História logu pre každé miesto (Michal 2026-10-21): len udalosti, ktoré
   * hráč už dostal (eventsFor), aby log prežil obnovenie stránky.
   */
  readonly historia: [Event[], Event[]];
  /** Odkedy smie hráč pustiť ďalšiu hlášku Melichara zo soundboardu (čas v ms). */
  readonly melicharVolnyOd: [number, number];
}

/** Po dohraní vlastnej hlášky musí hráč ešte chvíľu počkať (Michal 2026-10-22). */
export const MELICHAR_PAUZA_MS = 2_000;

/** Koľko udalostí histórie si miestnosť pamätá na jedno miesto. */
const HISTORIA_MAX = 600;
/** Udalosti, z ktorých klient skladá log — súkromné karty (kartyTahane) sa neukladajú. */
const DO_HISTORIE: ReadonlySet<Event["type"]> = new Set(["log", "tahal", "manualEfekt", "bitkaVysledok", "koniec"]);

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
  | { type: "create"; verejna?: boolean; dlzka?: DlzkaHry; bot?: boolean }
  | { type: "join"; code: string }
  | { type: "rejoin"; code: string }
  | { type: "leave" }
  | { type: "kontumacia" }
  | { type: "cmd"; cmd: Command }
  | { type: "melichar"; id: string };

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
  /** Jediný admin (NAEX_ADMIN_LOGIN, NAEX_ADMIN_HESLO); bez hesla sa účet nezakladá. */
  readonly admin?: { readonly login: string; readonly heslo: string | null };
  /** Cookie s príznakom Secure (za HTTPS proxy). */
  readonly bezpecneCookie?: boolean;
  /** Priečinok s reportmi playtestov (predvolene <repo>/docs/playtesty). */
  readonly playtestyDir?: string;
  /** Pauza pred ťahom offline protihráča, aby ho človek stihol sledovať (predvolene 700 ms). */
  readonly botPauzaMs?: number;
}

export function createGameServer(opts: ServerOpts): Promise<GameServer> {
  const teraz = (): number => Date.now();
  const dataDir = resolve(opts.dataDir ?? "data");
  mkdirSync(dataDir, { recursive: true });
  const db = otvorDb(join(dataDir, "naex.sqlite"));
  const ucty = new Ucty(db, opts.admin ?? { login: "Admin", heslo: null });
  const media = new Media(db, dataDir);
  const avatary = new Avatary(media, teraz());
  const hudba = new Hudba(dataDir);
  const melichar = new Hudba(dataDir, "melichar");
  ucty.pouziPredvoleneAvatary(() => avatary.nahodny());
  const obsah = new Obsah(db, media);
  const archiv = new Archiv(db);
  const tempoPartii = new TempoPartii(db);
  const prava = new Prava(db);
  /** Keď používateľ právo nemá, pošle mu chybu a vráti true (ws príkaz sa nevykoná). */
  const bezPrava = (ws: WebSocket, ja: Pouzivatel, pravo: Pravo): boolean => {
    if (prava.smie(ja, pravo)) return false;
    sendError(ws, `Na toto tvoj rank nemá právo: ${POPIS_PRAVA[pravo]}.`);
    return true;
  };
  ucty.prepocitajRanky(prava.nastavenie().postup);
  const nazory = new Nazory(db, prava);
  const playtesty = new Playtesty(opts.playtestyDir ?? fileURLToPath(new URL("../../../docs/playtesty", import.meta.url)), join(dataDir, "playtesty"));
  const navrhy = new Navrhy(db);
  const roadmapa = new Roadmapa(db);
  roadmapa.naplnAkTreba(fileURLToPath(new URL("../seed/roadmapa.json", import.meta.url)), teraz());
  const novinky = new Novinky(db);
  const hodnotenia = new Hodnotenia(db, prava);
  obsah.naplnAkTreba(teraz());
  obsah.naplnBodovanieAkTreba(teraz());
  obsah.premenujZrusenePriazne(teraz());
  obsah.doplnChybajuceIlustracie(teraz());
  obsah.odstranZruseneKlucoveSlova(teraz());
  obsah.zjednotNazvyAkcii(teraz());
  obsah.dorovnajSoSeedom(teraz());

  const rooms = new Map<string, Room>();
  const infos = new WeakMap<WebSocket, SocketInfo>();

  const staticDir = opts.staticDir ?? fileURLToPath(new URL("../../../apps/web/dist", import.meta.url));

  // VERZIA.json zapíše deploy/nahraj.sh do balíka — na vývojovom stroji chýba.
  const spusteny = teraz();
  const suborVerzie = fileURLToPath(new URL("../../../VERZIA.json", import.meta.url));
  const verzia = existsSync(suborVerzie) ? (JSON.parse(readFileSync(suborVerzie, "utf8")) as StavServera["verzia"]) : null;
  const stavServera = (): StavServera => {
    const bezi = [...rooms.values()].filter((r) => r.state !== null && r.state.koniec === null);
    const cakajuce = [...rooms.values()].filter((r) => r.state === null).length;
    return {
      verzia,
      spusteny,
      partie: {
        ludia: bezi.filter((r) => r.bot === null).length,
        sBotom: bezi.filter((r) => r.bot !== null).length,
        cakajuce,
        poslednaAktivita: bezi.length === 0 ? null : Math.max(...bezi.map((r) => r.lastActivity)),
      },
    };
  };

  const otvoreneHry = (): OtvorenaHra[] =>
    [...rooms.values()]
      .filter((r) => r.verejna && r.state === null && r.hraci[0] !== null && r.sockets[0] !== null && r.hraci[1] === null)
      .map((r) => ({
        kod: r.code,
        hostitel: { meno: r.hraci[0]?.meno ?? "?", avatar: r.hraci[0]?.avatar ?? null, frajerina: r.hraci[0]?.frajerina ?? null },
        dlzka: r.dlzka,
        vytvorena: r.vytvorena,
      }))
      .sort((a, b) => b.vytvorena - a.vytvorena);

  const http = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (url.pathname.startsWith("/api/")) {
      void spracujApi(
        {
          ucty,
          obsah,
          media,
          predvoleneAvatary: avatary.hracov,
          hudba,
          melichar,
          archiv,
          tempoPartii,
          prava,
          nazory,
          playtesty,
          navrhy,
          roadmapa,
          novinky,
          hodnotenia,
          teraz,
          bezpecneCookie: opts.bezpecneCookie ?? false,
          otvoreneHry,
          poZverejneni: () => undefined,
          stavServera,
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
    if (url.pathname.startsWith("/hudba/")) {
      hudba.posli(url.pathname.slice("/hudba/".length), req, res);
      return;
    }
    if (url.pathname.startsWith("/melichar/")) {
      melichar.posli(url.pathname.slice("/melichar/".length), req, res);
      return;
    }
    if (url.pathname.startsWith("/playtesty/")) {
      playtesty.posli(url.pathname.slice("/playtesty/".length), res, teraz(), req.headers.host);
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
      const historia = room.historia[seat];
      historia.push(...eventsFor(events, seat).filter((e) => DO_HISTORIE.has(e.type)));
      if (historia.length > HISTORIA_MAX) historia.splice(0, historia.length - HISTORIA_MAX);
      const ws = room.sockets[seat];
      if (ws === null) continue;
      send(ws, { type: "state", view: viewFor(room.data, room.state, seat), events: eventsFor(events, seat) });
    }
  };

  const posliHracov = (room: Room): void => {
    const hraci = room.hraci.map((h, i) =>
      h === null
        ? null
        : i === room.bot
          ? { meno: h.meno, avatar: h.avatar, bot: true }
          : { id: h.id, meno: h.meno, avatar: h.avatar, frajerina: h.frajerina, titul: titul(h.frajerina) },
    );
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
    room.hraci[seat] = { id: p.id, meno: p.meno, avatar: p.avatar, frajerina: archiv.frajerina(p.id).hodnota };
    room.sockets[seat] = ws;
    room.odpojenyOd[seat] = null;
    info.room = room;
    info.seat = seat;
    room.lastActivity = teraz();
    send(ws, {
      type: "privitanie",
      code: room.code,
      seat,
      started: room.state !== null,
      verejna: room.verejna,
      dlzka: room.dlzka,
      sada: room.sada,
    });
    posliHracov(room);
    if (room.state !== null) {
      send(ws, { type: "historia", events: room.historia[seat] });
      send(ws, { type: "state", view: viewFor(room.data, room.state, seat), events: [] });
      const druhe: PlayerId = seat === 0 ? 1 : 0;
      send(ws, { type: "superPripojeny", connected: room.sockets[druhe] !== null || room.bot === druhe });
    }
    if (room.vysledok !== null) send(ws, { type: "frajerina", zmeny: room.vysledok });
    oznamPripojenie(room, seat, true);
  };

  /** Odchod z miestnosti, ktorá ešte nezačala, ju uvoľní; rozohraná ostáva. */
  const odist = (ws: WebSocket): void => {
    const info = infos.get(ws);
    if (info === undefined || info.room === null || info.seat === null) return;
    const { room, seat } = info;
    if (room.sockets[seat] === ws) {
      room.sockets[seat] = null;
      room.odpojenyOd[seat] = teraz();
    }
    if (room.state === null) {
      room.hraci[seat] = null;
      if (room.hraci[0] === null && room.hraci[1] === null) rooms.delete(room.code);
    } else if (room.bot !== null) {
      // Partiu proti botovi nikto iný nedohrá — odchodom zaniká.
      zrusMiestnost(room);
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
        const protiBotovi = msg.bot === true;
        // Práva rankov (Michal 2026-10-22): proti botovi, proti ľuďom, súkromná miestnosť.
        if (bezPrava(ws, ja, protiBotovi ? "hrat_bot" : "hrat_ludia")) return;
        if (!protiBotovi && msg.verejna !== true && bezPrava(ws, ja, "sukromne_miestnosti")) return;
        const dlzka = msg.dlzka ?? PREDVOLENA_DLZKA;
        if (!dostupneDlzky(data).includes(dlzka)) {
          sendError(ws, `Na túto dĺžku hry nemá sada dosť lokalít (má ${data.lokality.length}).`);
          return;
        }
        const room: Room = {
          code: novyKod(rooms),
          data,
          sada,
          verejna: msg.verejna === true && !protiBotovi,
          dlzka,
          vytvorena: teraz(),
          state: null,
          zaciatok: 0,
          statistiky: null,
          tempo: null,
          statistikyKariet: {},
          vysledok: null,
          odpojenyOd: [null, null],
          hraci: [null, null],
          sockets: [null, null],
          lastActivity: teraz(),
          bot: protiBotovi ? 1 : null,
          botPovaha: POVAHY[randomInt(POVAHY.length)]?.id ?? "stamgast",
          botTimer: null,
          historia: [[], []],
          melicharVolnyOd: [0, 0],
        };
        rooms.set(room.code, room);
        if (protiBotovi) {
          // Offline protihráč sedí hneď — partia začína bez čakania.
          const povaha = POVAHY.find((p) => p.id === room.botPovaha);
          room.hraci[1] = { id: BOT_ID, meno: povaha?.meno ?? "Štamgast", avatar: avatary.bota(room.botPovaha), frajerina: 0 };
          room.state = setupGame(room.data, randomInt(2 ** 31), { lokalit: DLZKY_HRY[room.dlzka] });
          room.zaciatok = teraz();
          room.statistiky = noveStatistiky();
          room.tempo = noveTempo(room.zaciatok);
        }
        usadit(ws, room, 0);
        if (protiBotovi) naplanujBota(room);
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
        if (bezPrava(ws, ja, "hrat_ludia")) return;
        const seat: PlayerId = room.hraci[0] === null ? 0 : 1;
        usadit(ws, room, seat);
        // Dvaja hráči → hra začína.
        // (usadit práve zmenil room.hraci — TS si pamätá starý stav)
        const [h0, h1] = room.hraci as readonly (HracVMiestnosti | null)[];
        if (h0 != null && h1 != null && room.state === null) {
          room.state = setupGame(room.data, randomInt(2 ** 31), { lokalit: DLZKY_HRY[room.dlzka] });
          room.zaciatok = teraz();
          room.statistiky = noveStatistiky();
          room.tempo = noveTempo(room.zaciatok);
          room.statistikyKariet = {};
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
          vykonaj(room, msg.cmd, seat);
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
      case "kontumacia": {
        const { room, seat } = info;
        if (room === null || seat === null || room.state === null || room.state.koniec !== null) {
          sendError(ws, "Nie je čo kontumovať.");
          return;
        }
        const super_: PlayerId = seat === 0 ? 1 : 0;
        const od = room.odpojenyOd[super_];
        if (room.sockets[super_] !== null || od === null || room.bot === super_) {
          sendError(ws, "Súper je pripojený.");
          return;
        }
        const zostava = KONTUMACIA_PO_MS - (teraz() - od);
        if (zostava > 0) {
          sendError(ws, `Súper je odpojený len chvíľu. Kontumačnú výhru si môžeš vyžiadať o ${Math.ceil(zostava / 1000)} s.`);
          return;
        }
        vykonaj(room, { type: "vzdat", kontumacia: true }, super_);
        break;
      }
      case "melichar": {
        // Soundboard (Michal 2026-10-22): hlášku pustí len hráč rozohranej partie,
        // počujú ju obaja. Kým jeho vlastná hrá a 2 s po nej, ďalšiu nepustí;
        // súperova ho neblokuje. Bot soundboard nepoužíva.
        const { room, seat } = info;
        if (room === null || seat === null || room.state === null) {
          sendError(ws, "Hlášky Melichara púšťa len hráč rozohranej partie.");
          return;
        }
        if (bezPrava(ws, ja, "melichar_soundboard")) return;
        const hlaska = melichar.hlasky().find((h) => h.id === msg.id);
        if (hlaska === undefined) {
          sendError(ws, "Takú hlášku majster Melichar nepozná.");
          return;
        }
        const t = teraz();
        const caka = room.melicharVolnyOd[seat] - t;
        if (caka > 0) {
          sendError(ws, `Majster Melichar ešte nedohovoril — ďalšiu hlášku pustíš o ${Math.ceil(caka / 1000)} s.`);
          return;
        }
        room.melicharVolnyOd[seat] = t + hlaska.trvanieMs + MELICHAR_PAUZA_MS;
        for (const s of room.sockets) if (s !== null) send(s, { type: "melichar", id: hlaska.id, seat, trvanieMs: hlaska.trvanieMs });
        break;
      }
      default:
        sendError(ws, "Neznáma správa.");
    }
  };

  /** Príkaz za hráča `seat`: nový stav, štatistiky, rozoslanie a pri konci zápis do archívu. */
  const vykonaj = (room: Room, cmd: Command, seat: PlayerId): void => {
    const pred = room.state;
    if (pred === null) return;
    const result = apply(room.data, pred, cmd, seat);
    room.state = result.state;
    room.lastActivity = teraz();
    if (room.tempo !== null) room.tempo = zapisPrikaz(room.tempo, fazaPrikazu(pred), seat, room.lastActivity, result.events);
    if (room.statistiky !== null) room.statistiky = zapisTah(room.statistiky, pred, cmd, seat, result.state, result.events);
    room.statistikyKariet = zapisTahKariet(room.statistikyKariet, pred, cmd, seat, result.events);
    broadcast(room, result.events);
    const dohrata = pred.koniec === null && result.state.koniec !== null && cmd.type !== "vzdat";
    // Návštevník sa stáva hráčom po prvej dohratej partii proti človeku aj proti botovi (Michal 2026-10-21);
    // partia s botom sa pritom do archívu ani štatistík nezapíše.
    if (dohrata) for (const h of room.hraci) if (h !== null && h.id !== BOT_ID) ucty.povysPoPartii(h.id, prava.nastavenie().postup);
    // Partie proti botovi nejdú do archívu — Frajerina a rebríček sú medzi ľuďmi.
    if (pred.koniec === null && result.state.koniec !== null && room.bot === null) zapisDoArchivu(room, result.state, cmd.type !== "vzdat");
    if (pred.koniec === null && result.state.koniec !== null) zapisTempo(room, result.state, cmd.type !== "vzdat");
    naplanujBota(room);
  };

  /** Keď môže hrať offline protihráč, po krátkej pauze zahrá (pri stavbe šenku aj súbežne s človekom). */
  const naplanujBota = (room: Room): void => {
    const bot = room.bot;
    if (bot === null || room.botTimer !== null || room.state === null || !mozeHrat(room.state, bot)) return;
    room.botTimer = setTimeout(() => {
      room.botTimer = null;
      const state = room.state;
      if (state === null || !rooms.has(room.code) || !mozeHrat(state, bot)) return;
      let cmd: Command;
      try {
        cmd = tahBota(room.data, state, bot, randomInt(2 ** 31), { povaha: room.botPovaha });
      } catch (err) {
        console.error("Bot nevedel vybrať ťah:", err);
        const nahrada = legalCommands(room.data, state, bot)[0];
        if (nahrada === undefined) return;
        cmd = nahrada;
      }
      try {
        vykonaj(room, cmd, bot);
      } catch (err) {
        // Nelegálny ťah bota je chyba v bote — partia nesmie zamrznúť.
        console.error("Bot poslal nelegálny ťah:", cmd, err);
        const nahrada = legalCommands(room.data, state, bot)[0];
        if (nahrada !== undefined) vykonaj(room, nahrada, bot);
      }
    }, opts.botPauzaMs ?? 700);
  };

  const zrusMiestnost = (room: Room): void => {
    if (room.botTimer !== null) clearTimeout(room.botTimer);
    room.botTimer = null;
    rooms.delete(room.code);
  };

  const zapisTempo = (room: Room, koniec: GameState, dohrata: boolean): void => {
    if (room.tempo === null) return;
    try {
      tempoPartii.zapis({
        kod: room.code,
        zaciatok: room.zaciatok,
        koniec: room.tempo.posledny,
        dlzka: room.dlzka,
        sBotom: room.bot !== null,
        ai: room.hraci.some((h) => h !== null && h.id !== BOT_ID && ucty.podlaId(h.id)?.ai === true),
        dohrata,
        kola: koniec.kolo,
        tempo: room.tempo,
      });
    } catch (err) {
      console.error("Tempo partie sa nepodarilo zapísať:", err);
    }
  };

  const zapisDoArchivu = (room: Room, koniec: GameState, dohrata: boolean): void => {
    const [h0, h1] = room.hraci;
    if (h0 === null || h1 === null || room.statistiky === null || koniec.koniec === null) return;
    try {
      const { zmeny } = archiv.zapis({
        kod: room.code,
        zaciatok: room.zaciatok,
        koniec: teraz(),
        vitaz: koniec.koniec.vitaz,
        dovod: koniec.koniec.dovod.replace(/Hráč ([12])/g, (_, n: string) => (n === "1" ? h0.meno : h1.meno)),
        kola: koniec.kolo,
        verziaSady: room.sada.verzia,
        dohrata,
        hraci: [h0.id, h1.id],
        // Hodnotená (Frajerina) len keď na to majú právo obaja — inak sa partia archivuje bez zmeny Frajeriny.
        hodnotena: [h0.id, h1.id].every((id) => {
          const u = ucty.podlaId(id);
          return u !== null && prava.smie(u, "hodnotene_partie");
        }),
        body: koniec.koniec.body,
        statistiky: uzavriStatistiky(room.data, room.statistiky, koniec),
        statistikyKariet: room.statistikyKariet,
      });
      room.vysledok = zmeny;
      h0.frajerina = zmeny[0].po;
      h1.frajerina = zmeny[1].po;
      for (const ws of room.sockets) if (ws !== null) send(ws, { type: "frajerina", zmeny });
    } catch (err) {
      // Výsledok partie sa nesmie stratiť potichu, ale ani zhodiť server.
      console.error("Partiu sa nepodarilo zapísať do archívu:", err);
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
        room.odpojenyOd[seat] = teraz();
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
    for (const room of rooms.values()) {
      const prazdna = room.sockets[0] === null && room.sockets[1] === null;
      if (prazdna && t - room.lastActivity > 2 * 60 * 60 * 1000) zrusMiestnost(room);
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
            for (const room of rooms.values()) if (room.botTimer !== null) clearTimeout(room.botTimer);
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
    if (extname(subor) === ".html") {
      // Stránka smie načítať len seba, písma Google a WebSocket na rovnakom pôvode.
      hlavicky["content-security-policy"] = [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: blob:",
        "connect-src 'self' ws: wss:",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join("; ");
    }
    // Vite pridáva do názvov hash — tie sa môžu cachovať natrvalo.
    // Ilustrácie pravidiel nemajú hash v názve, ale menia sa zriedka — deň v cache
    // ušetrí opakované dotazy na server (Singapur je od nás ďaleko).
    hlavicky["cache-control"] = subor.includes(`${join("assets", "")}`)
      ? "public, max-age=31536000, immutable"
      : subor.includes(`${join("pravidla", "")}`) && extname(subor) === ".jpg"
        ? "public, max-age=86400"
        : "no-cache";
    res.writeHead(200, hlavicky);
    res.end(obsah);
  } catch {
    res.writeHead(404).end();
  }
}

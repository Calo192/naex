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
import type { Command, DlzkaHry, DvojicaStatistik, Event, GameData, GameState, PlayerId, Pohlavie, ScenarVyucby, StatistikyKariet, StavKroniky, StavMomentov } from "@naex/core";
import type { Sada } from "@naex/tvorba";
import {
  DLZKY_HRY,
  IllegalCommandError,
  ktoVykona,
  cakaNaDalej,
  castKroku,
  hlaskaPriChybe,
  koniecCastiPoKroku,
  type CastScenara,
  pauzaKrokuVyucby,
  prelozKluceZvyraznenia,
  radaVyucby,
  type MoznostOtazky,
  VERZIA_PRAVIDIEL,
  ucetSpakov,
  defOf,
  doplnNaexZKroniky,
  novaKronika,
  zapisDoKroniky,
  POVAHY,
  PREDVOLENA_DLZKA,
  ALL_DLZKY,
  apply,
  dostupneDlzky,
  eventsFor,
  legalCommands,
  loadGameData,
  mozeHrat,
  momenty,
  NOVE_MOMENTY,
  noveStatistiky,
  obmedzMomenty,
  ocakavanyPrikaz,
  porovnajSKrokom,
  prehrajVyucbu,
  prikazZoScenara,
  vykonajKrok,
  setupGame,
  textChybyKroku,
  VYUCBA_BOT,
  VYUCBA_HRAC,
  tahBota,
  uzavriStatistiky,
  viewFor,
  zapisTah,
  zapisTahKariet,
} from "@naex/core";
import { otvorDb } from "./db.ts";
import type { Pouzivatel } from "./auth.ts";
import { Ucty, jeSpravca } from "./auth.ts";
import { Media } from "./media.ts";
import { Avatary } from "./avatary.ts";
import { Hudba } from "./hudba.ts";
import { Obsah, nacitajElders, nacitajScorecards } from "./obsah.ts";
import type { OtvorenaHra, PostupVyucby, RozohranaPartia, StavServera, Uzavierka } from "./api.ts";
import { OZNAM_UZAVIERKY, spracujApi } from "./api.ts";
import type { ZmenaFrajeriny } from "./archiv.ts";
import { Archiv } from "./archiv.ts";
import type { StavTempa } from "./tempo.ts";
import { TempoPartii, fazaPrikazu, noveTempo, zapisPrikaz } from "./tempo.ts";
import type { Pravo } from "./prava.ts";
import { POPIS_PRAVA, Prava } from "./prava.ts";
import { Ligy } from "./ligy.ts";
import { Profily } from "./profily.ts";
import { Prehravac } from "./prehravac.ts";
import { hashJadra } from "./verziaJadra.ts";
import { Nazory } from "./nazory.ts";
import { Playtesty } from "./playtesty.ts";
import { Navrhy } from "./navrhy.ts";
import { Roadmapa } from "./roadmapa.ts";
import { Novinky } from "./novinky.ts";
import { Dielna } from "./dielna.ts";
import { Hodnotenia } from "./znamky.ts";
import { titul } from "./frajerina.ts";
import { Achievementy, nacitajKatalog, type AchievementyMiestnosti } from "./achievementy.ts";

// ---------------------------------------------------------------------------
// Dáta z repozitára (testy jadra a nástroje ich používajú priamo)

/** Scenár výučby „Prvá hra“ (Michal 2026-10-23) — packages/core/data/vyucba/prva-hra.json. */
export function nacitajVyucbu(): ScenarVyucby {
  return JSON.parse(readFileSync(fileURLToPath(new URL("../../core/data/vyucba/prva-hra.json", import.meta.url)), "utf8")) as ScenarVyucby;
}

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
  /** Pohlavie z profilu pre tvary hlášok (nie je tajné); null = neuvádza. */
  pohlavie: Pohlavie | null;
  /** Účet AI playtestera — hráčom skrytý profil aj Frajerina (Michal 2026-10-22). */
  ai: boolean;
}

/** Účet offline protihráča neexistuje — id 0 SQLite nikdy nepridelí. */
const BOT_ID = 0;
/** Partia bez ťahu tak dlho je opustená — nasadenie na ňu nečaká. */
const OPUSTENA_PO_MS = 30 * 60_000;
/** Miestnosť bez pripojených hráčov a bez činnosti tak dlho sa zruší. */
const ZRUSIT_PRAZDNU_PO_MS = 2 * 60 * 60 * 1000;

/** Ako dlho musí byť súper odpojený, kým si hráč môže vyžiadať kontumačnú výhru. */
const KONTUMACIA_PO_MS = 3 * 60 * 1000;

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
  /** Seed partie a jej príkazy [miesto, príkaz] — do archívu pre budúci prehrávač (Michal 2026-10-22). */
  seed: number | null;
  readonly prikazy: [PlayerId, Command][];
  /** Záznam po kolách (kronika z jadra) — do archívu pre detail partie a súhrn. */
  kronika: StavKroniky | null;
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
  /**
   * Výučba „Prvá hra“: index nasledujúceho kroku scenára. Server pustí len
   * príkaz, ktorý krok dovoľuje; ťahy bota hrá podľa skriptu. Nič z nej
   * nejde do archívu, štatistík ani Frajeriny. vykonany = ťah bota či auto
   * krok s textom je vykonaný a čaká na „ďalej“ (U5). koniecCasti = číslo časti, ktorú hráč
   * práve dokončil — partia stojí, kým nepokračuje ďalšou (vyucbaPokracuj) alebo neodíde.
   * zalohy = koľko záložných hlášok pri chybe už zaznelo (striedajú sa dookola).
   */
  vyucba: { krok: number; vykonany: boolean; koniecCasti: number | null; zalohy: number } | null;
  /** Strop pečiatok momentov (Michal 2026-10-23): 1 za úsek kola, zlato 2 za partiu. */
  momenty: StavMomentov;
  /** Achievementy partie (Michal 2026-10-23); null = nič sa nezískava (výučba, ešte nezačala). */
  achievementy: AchievementyMiestnosti | null;
}

/**
 * Krok výučby pre klienta (tvar dohodnutý s UX/UI): čo povie Melichar, čo
 * zvýrazniť a aký príkaz sa čaká (uid už preložené); null = výučba skončila.
 */
export interface KrokVyucbyKlient {
  readonly index: number;
  readonly spolu: number;
  readonly id: string;
  readonly kto: "hrac" | "bot" | "info" | "auto" | "otazka";
  /** Ťah bota či auto krok je vykonaný a čaká na „ďalej“ (U5); inak false. */
  readonly vykonany: boolean;
  /** Časť, do ktorej krok patrí: poradie kroku v nej (od 0) a počet jej krokov — percentá v bare. */
  readonly cast: { readonly cast: number; readonly nazov: string; readonly poradie: number; readonly krokov: number };
  readonly melichar: string;
  readonly zvyraznit: readonly string[];
  readonly ocakava: Command | null;
  /** Kontrolná otázka: možnosti aj s hláškou zlej odpovede (klient overí sám); inak null. */
  readonly moznosti: readonly MoznostOtazky[] | null;
  /** Rozhodnutie hráča: kandidáti na zvýraznenie namiesto očakávanej karty; inak null. */
  readonly volba: { readonly kandidati: readonly string[] } | null;
  /** Nápis tlačidla „ďalej“ (napr. „Odovzdať cigaretu“); null = „ďalej“. */
  readonly tlacidlo: string | null;
  /** „Ďalej“ odovzdá Melicharovi 1 hernú cigaretu (Michal 2026-10-25). */
  readonly odovzdaCigaretu: boolean;
  /** Ponúknuť „Preskočiť výučbu“ (úvod). */
  readonly preskocenie: boolean;
  /** So zvýraznenými prvkami sa smie hrať nanečisto — nič sa neposiela (stavba šenku). */
  readonly naneisto: boolean;
}

/** Po dohraní vlastnej hlášky musí hráč ešte chvíľu počkať (Michal 2026-10-22). */
export const MELICHAR_PAUZA_MS = 2_000;

/** Koľko udalostí histórie si miestnosť pamätá na jedno miesto. */
const HISTORIA_MAX = 600;
/** Udalosti, z ktorých klient skladá log — súkromné karty (kartyTahane) sa neukladajú. */
const DO_HISTORIE: ReadonlySet<Event["type"]> = new Set(["log", "tahal", "manualEfekt", "bitkaVysledok", "moment", "koniec"]);

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
  | { type: "create"; verejna?: boolean; dlzka?: DlzkaHry; bot?: boolean; vyucba?: boolean }
  | { type: "vyucbaDalej" }
  | { type: "vyucbaPokracuj" }
  | { type: "vyucbaOdpoved"; index: number }
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
  /** Výučba pre všetkých bez ohľadu na vypínač v scenári (testy). */
  readonly vyucbaZapnuta?: boolean;
  /** Achievementy bez ohľadu na vypínač v katalógu (testy). */
  readonly achievementyZapnute?: boolean;
  /** Iný scenár výučby (testy); predvolene data/vyucba/prva-hra.json. */
  readonly scenarVyucby?: ScenarVyucby;
  /** Pevný seed rozdania každej novej partie (testy) — partia sa dá zopakovať. */
  readonly seedRozdania?: number;
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
  const scenarVyucby = opts.scenarVyucby ?? nacitajVyucbu();
  /** Výučba je pre hráčov, až keď je scenár zverejnený; dovtedy ju spustí len správca. */
  const vyucbaPreHracov = opts.vyucbaZapnuta ?? scenarVyucby.zverejnena === true;
  /** Výučba prešla posledným krokom časti — časť končí uprostred partie (1. časť po prvej bitke). */
  const vyucbaSkoncila = (room: Room): boolean =>
    room.vyucba !== null && (room.vyucba.koniecCasti !== null || room.vyucba.krok >= scenarVyucby.kroky.length);
  const idKrokovVyucby = scenarVyucby.kroky.map((k) => k.id);
  /** Časť s textami na schválenie (navrh) spustí len správca — ako vypínač celej výučby. */
  const castPreHraca = (c: CastScenara, ja: Pick<Pouzivatel, "rola">): boolean => !c.navrh || jeSpravca(ja.rola);
  /**
   * Postup výučby účtu: uložený krok (index) a kde v častiach stojí. Na začiatku časti 2+
   * je predošlá dokončená — „Pokračovať vo výučbe“ spustí ďalšiu, ak ju hráč smie hrať.
   */
  const postupVyucby = (ja: Pick<Pouzivatel, "id" | "rola">): PostupVyucby => {
    const ulozene = ucty.vyucba(ja.id, scenarVyucby.verzia ?? null, idKrokovVyucby);
    const cast = castKroku(scenarVyucby, ulozene.krok);
    const naZaciatku = cast !== null && ulozene.krok === cast.od;
    const dalsia = naZaciatku && cast.cast > 1 ? cast : null;
    return {
      krok: ulozene.krok,
      idKroku: idKrokovVyucby[ulozene.krok] ?? null,
      stav: ulozene.stav,
      cast,
      rozpracovana: cast !== null && !naZaciatku,
      dalsia: dalsia !== null && castPreHraca(dalsia, ja) ? dalsia : null,
      pripravujeme: dalsia !== null && !castPreHraca(dalsia, ja) ? dalsia : null,
    };
  };
  const archiv = new Archiv(db);
  // Katalóg achievementov (Navrhár, data/achievementy.json): chyba v ňom vypne achievementy, nie server.
  // Kým katalóg nemá „zapnute“: true, achievementy sa nepočítajú, neukladajú ani neposielajú (Michal 2026-10-23).
  let achievementy: Achievementy | null = null;
  try {
    const katalog = nacitajKatalog();
    if (opts.achievementyZapnute ?? katalog.zapnute) achievementy = new Achievementy(db, katalog);
  } catch (err) {
    console.error("Achievementy sú vypnuté — katalóg sa nedá načítať:", err);
  }
  const tempoPartii = new TempoPartii(db);
  const prava = new Prava(db);
  const ligy = new Ligy(db, teraz, achievementy);
  const profily = new Profily(db);
  /** Keď používateľ právo nemá, pošle mu chybu a vráti true (ws príkaz sa nevykoná). */
  const bezPrava = (ws: WebSocket, ja: Pouzivatel, pravo: Pravo): boolean => {
    if (prava.smie(ja, pravo)) return false;
    sendError(ws, `Na toto tvoj rank nemá právo: ${POPIS_PRAVA[pravo]}.`);
    return true;
  };
  // Deci a Sedmička podľa hviezd achievementov (Michal 2026-10-25); bez achievementov len Poldeci.
  if (achievementy !== null) {
    const a = achievementy;
    a.dorovnajVyucbu(teraz());
    ucty.pouziHviezdy((id) => a.hviezdy(id));
  }
  ucty.prepocitajRanky(prava.nastavenie().postup);
  const nazory = new Nazory(db, prava);
  const playtesty = new Playtesty(opts.playtestyDir ?? fileURLToPath(new URL("../../../docs/playtesty", import.meta.url)), join(dataDir, "playtesty"));
  const navrhy = new Navrhy(db);
  const roadmapa = new Roadmapa(db);
  roadmapa.naplnAkTreba(fileURLToPath(new URL("../seed/roadmapa.json", import.meta.url)), teraz());
  const novinky = new Novinky(db);
  const dielna = new Dielna(db, prava, {
    sada: () => obsah.aktualnaSada().sada,
    kartaTvorcu: (id) => obsah.karty.jeden(id),
    ulozKartuTvorcu: (k) => obsah.ulozKartu(k),
    predvoleneRozmery: () => obsah.nastavenia(),
    jeObrazok: (id) => {
      const z = /^[0-9a-f]{40}$/.test(id) ? media.zaznam(id) : null;
      return z !== null && (z.druh === "kniznica" || z.druh === "karta");
    },
    doRoadmapy: (ja, polozka, cas) => roadmapa.pridaj(ja, polozka, cas),
  });
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
  // Verzia jadra, ktorú nesie archivovaná partia: hash packages/core/src — prehrávač prehrá
  // partiu, kým sa nezmení jadro (nie commit, ten sa mení pri každom nasadení).
  const verziaJadra = hashJadra(fileURLToPath(new URL("../../core/src", import.meta.url)));
  const prehravac = new Prehravac(db, obsah, verziaJadra);
  // Uzávierka pred nasadením (Michal 2026-10-23) — len v pamäti, reštart ju zruší.
  let uzavierka: Uzavierka | null = null;
  const stavServera = (): StavServera => {
    // Dokončená výučba stojí uprostred partie, no nikto ju nedohrá — nasadenie na ňu nečaká.
    const bezi = [...rooms.values()].filter((r) => r.state !== null && r.state.koniec === null && !vyucbaSkoncila(r));
    const cakajuce = [...rooms.values()].filter((r) => r.state === null).length;
    // Partia bez ťahu 30 min je opustená — nasadenie na ňu nečaká (skill naex-nasad).
    const aktivne = bezi.filter((r) => teraz() - r.lastActivity < OPUSTENA_PO_MS).length;
    return {
      verzia,
      spusteny,
      partie: {
        ludia: bezi.filter((r) => r.bot === null).length,
        sBotom: bezi.filter((r) => r.bot !== null).length,
        cakajuce,
        poslednaAktivita: bezi.length === 0 ? null : Math.max(...bezi.map((r) => r.lastActivity)),
        aktivne,
        opustene: bezi.length - aktivne,
      },
      uzavierka,
    };
  };
  const nastavUzavierku = (zapnut: boolean): Uzavierka | null => {
    uzavierka = zapnut ? (uzavierka ?? { od: teraz() }) : null;
    return uzavierka;
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

  // Hotová výučba stojí uprostred partie, no nikto ju nedohrá — „Späť ku stolu“ by viedlo do prázdna.
  const rozohranaPartia = (kod: string, hracId: number): RozohranaPartia | null => {
    const room = rooms.get(kod);
    if (room === undefined || room.state === null || room.state.koniec !== null || vyucbaSkoncila(room)) return null;
    if (!room.hraci.some((h, i) => h !== null && i !== room.bot && h.id === hracId)) return null;
    return { kod: room.code, vyucba: room.vyucba !== null };
  };

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
          achievementy,
          tempoPartii,
          prava,
          ligy,
          profily,
          prehravac,
          nazory,
          playtesty,
          navrhy,
          roadmapa,
          novinky,
          dielna,
          hodnotenia,
          teraz,
          bezpecneCookie: opts.bezpecneCookie ?? false,
          otvoreneHry,
          rozohranaPartia,
          poZverejneni: () => undefined,
          stavServera,
          nastavUzavierku,
          vyucbaKrokov: scenarVyucby.kroky.length,
          vyucbaVerzia: scenarVyucby.verzia ?? null,
          postupVyucby,
          vyucbaPreHracov,
        },
        req,
        res,
        url.pathname,
        url.searchParams,
      );
      return;
    }
    if (url.pathname.startsWith("/media/")) {
      media.posli(url.pathname.slice("/media/".length), res, url.searchParams.has("n"));
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

  // Profil: „ziadny“ (bot), „skryty“ (AI playtester pre hráča — bez Frajeriny), „verejny“.
  // Rozhoduje server podľa toho, kto správu dostane (Michal 2026-10-22).
  const posliHracov = (room: Room): void => {
    for (const ws of room.sockets) {
      if (ws === null) continue;
      const prijemca = infos.get(ws)?.pouzivatel;
      const spravca = prijemca !== undefined && jeSpravca(prijemca.rola);
      const hraci = room.hraci.map((h, i) => {
        if (h === null) return null;
        if (i === room.bot) return { meno: h.meno, avatar: h.avatar, bot: true, profil: "ziadny" };
        if (h.ai && !spravca) return { id: h.id, meno: h.meno, avatar: h.avatar, pohlavie: h.pohlavie, ai: true, profil: "skryty" };
        return { id: h.id, meno: h.meno, avatar: h.avatar, frajerina: h.frajerina, titul: titul(h.frajerina), pohlavie: h.pohlavie, ai: h.ai, profil: "verejny" };
      });
      send(ws, { type: "hraci", hraci });
    }
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
    room.hraci[seat] = { id: p.id, meno: p.meno, avatar: p.avatar, frajerina: archiv.frajerina(p.id).hodnota, pohlavie: p.pohlavie, ai: p.ai };
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
      const connected = room.sockets[druhe] !== null || room.bot === druhe;
      // Po návrate (obnovenie stránky) klient nevie, odkedy súper chýba — odpočet kontumácie by začal odznova.
      const od = room.odpojenyOd[druhe];
      send(ws, { type: "superPripojeny", connected, ...(connected || od === null ? {} : { odpojenyMs: Math.max(0, teraz() - od) }) });
    }
    if (room.vysledok !== null) send(ws, { type: "frajerina", zmeny: room.vysledok });
    const suhrn = room.achievementy?.hraci[seat]?.suhrn ?? null;
    if (suhrn !== null) send(ws, { type: "achievementySuhrn", suhrn });
    if (room.vyucba !== null) posliVyucbu(room);
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

  /** Založí miestnosť s prázdnymi miestami; partia začne rozdaním (výučba prináša stav hotový). */
  const novaMiestnost = (
    zaklad: Pick<Room, "data" | "sada" | "verejna" | "dlzka" | "bot" | "botPovaha"> & Partial<Pick<Room, "state" | "zaciatok" | "seed" | "vyucba">>,
  ): Room => {
    const room: Room = {
      code: novyKod(rooms),
      vytvorena: teraz(),
      state: null,
      zaciatok: 0,
      statistiky: null,
      seed: null,
      prikazy: [],
      kronika: null,
      tempo: null,
      statistikyKariet: {},
      vysledok: null,
      odpojenyOd: [null, null],
      hraci: [null, null],
      sockets: [null, null],
      lastActivity: teraz(),
      botTimer: null,
      historia: [[], []],
      melicharVolnyOd: [0, 0],
      momenty: NOVE_MOMENTY,
      vyucba: null,
      achievementy: null,
      ...zaklad,
    };
    rooms.set(room.code, room);
    return room;
  };

  /** Offline protihráč na mieste v miestnosti — meno a podobizeň podľa povahy. */
  const hracBot = (povaha: string): HracVMiestnosti => ({
    id: BOT_ID,
    meno: POVAHY.find((p) => p.id === povaha)?.meno ?? "Štamgast",
    avatar: avatary.bota(povaha),
    frajerina: 0,
    pohlavie: null,
    ai: false,
  });

  /** Rozdanie novej partie: seed, stav jadra a prázdne záznamy (štatistiky, tempo, kronika). */
  const rozdaj = (room: Room): void => {
    room.seed = opts.seedRozdania ?? randomInt(2 ** 31);
    room.state = setupGame(room.data, room.seed, { lokalit: DLZKY_HRY[room.dlzka] });
    room.zaciatok = teraz();
    room.statistiky = noveStatistiky();
    room.tempo = noveTempo(room.zaciatok);
    room.kronika = novaKronika(room.state);
  };

  const handleMsg = (ws: WebSocket, msg: ClientMsg): void => {
    const info = infos.get(ws);
    if (info === undefined) return;
    const ja = info.pouzivatel;

    switch (msg.type) {
      case "create": {
        // Uzávierka: nové partie nie (ľudia, boti ani AI playtesteri), rozohrané bežia.
        if (uzavierka !== null) {
          sendError(ws, OZNAM_UZAVIERKY);
          return;
        }
        if (msg.vyucba === true) {
          zalozVyucbu(ws, ja);
          break;
        }
        const { sada, data } = obsah.aktualnaSada();
        const protiBotovi = msg.bot === true;
        // Práva rankov (Michal 2026-10-22): proti botovi, proti ľuďom, súkromná miestnosť.
        if (bezPrava(ws, ja, protiBotovi ? "hrat_bot" : "hrat_ludia")) return;
        if (!protiBotovi && msg.verejna !== true && bezPrava(ws, ja, "sukromne_miestnosti")) return;
        // Bez zvolenej ligy (partia s počítačom po výučbe) predvolená, a keď je hráčovi zamknutá, najvyššia, ktorú smie.
        const smieLigu = (d: DlzkaHry): boolean => ligy.preco(ja, d, protiBotovi) === null;
        const dlzka =
          msg.dlzka ??
          (smieLigu(PREDVOLENA_DLZKA)
            ? PREDVOLENA_DLZKA
            : ([...ALL_DLZKY].reverse().find((d) => dostupneDlzky(data).includes(d) && smieLigu(d)) ?? PREDVOLENA_DLZKA));
        if (!dostupneDlzky(data).includes(dlzka)) {
          sendError(ws, `Na túto dĺžku hry nemá sada dosť lokalít (má ${data.lokality.length}).`);
          return;
        }
        const zamknuta = ligy.preco(ja, dlzka, protiBotovi);
        if (zamknuta !== null) {
          sendError(ws, zamknuta);
          return;
        }
        const room = novaMiestnost({
          data,
          sada,
          verejna: msg.verejna === true && !protiBotovi,
          dlzka,
          bot: protiBotovi ? 1 : null,
          botPovaha: POVAHY[randomInt(POVAHY.length)]?.id ?? "stamgast",
        });
        if (protiBotovi) {
          // Offline protihráč sedí hneď — partia začína bez čakania.
          room.hraci[1] = hracBot(room.botPovaha);
          rozdaj(room);
        }
        usadit(ws, room, 0);
        // Až po usadení — achievementy potrebujú účet hráča na mieste 0.
        if (protiBotovi) {
          zacniAchievementy(room);
          naplanujBota(room);
        }
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
        if (uzavierka !== null) {
          sendError(ws, OZNAM_UZAVIERKY);
          return;
        }
        if (bezPrava(ws, ja, "hrat_ludia")) return;
        const zamknuta = ligy.preco(ja, room.dlzka, false);
        if (zamknuta !== null) {
          sendError(ws, zamknuta);
          return;
        }
        const seat: PlayerId = room.hraci[0] === null ? 0 : 1;
        usadit(ws, room, seat);
        // Dvaja hráči → hra začína.
        // (usadit práve zmenil room.hraci — TS si pamätá starý stav)
        const [h0, h1] = room.hraci as readonly (HracVMiestnosti | null)[];
        if (h0 != null && h1 != null && room.state === null) {
          rozdaj(room);
          zacniAchievementy(room);
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
        if (room.vyucba !== null) {
          vykonajVyucbu(ws, room, msg.cmd);
          break;
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
      case "vyucbaOdpoved": {
        // Kontrolná otázka: klient overí odpoveď sám, server si zapíše prvú (metrika).
        const room = info.room;
        const k = room === null || room.vyucba === null || vyucbaSkoncila(room) ? undefined : scenarVyucby.kroky[room.vyucba.krok];
        const moznost = k?.kto === "otazka" && Number.isInteger(msg.index) ? k.moznosti?.[msg.index] : undefined;
        if (room === null || k === undefined || moznost === undefined) {
          sendError(ws, "Teraz nie je otázka, na ktorú sa dá odpovedať.");
          return;
        }
        ucty.ulozOdpovedVyucby(ja.id, k.id, msg.index, moznost.spravna, teraz());
        // Zlá odpoveď je chyba — hláška Melichara (vlastná, kroku, alebo záložná).
        if (!moznost.spravna) {
          const hlaska = hlaskaChyby(room, moznost.hlaska);
          if (hlaska !== null) send(ws, { type: "vyucbaHlaska", hlaska });
        }
        break;
      }
      case "vyucbaPokracuj": {
        // Po konci časti: ďalšia časť v tej istej partii (roadmapa #105).
        const room = info.room;
        const dalsia = room?.vyucba == null ? null : castKroku(scenarVyucby, room.vyucba.krok);
        if (room === null || room.vyucba === null || room.vyucba.koniecCasti === null || dalsia === null) {
          sendError(ws, "Teraz nie je časť výučby, ktorou by sa dalo pokračovať.");
          return;
        }
        if (!castPreHraca(dalsia, ja)) {
          sendError(ws, `${dalsia.cast}. časť výučby ešte pripravujeme.`);
          return;
        }
        room.vyucba.koniecCasti = null;
        room.lastActivity = teraz();
        posliVyucbu(room);
        naplanujVyucbu(room);
        break;
      }
      case "vyucbaDalej": {
        // Výučba: krok bez príkazu (len text Melichara) hráč potvrdí tlačidlom „ďalej“.
        const room = info.room;
        if (room === null || room.vyucba === null) {
          sendError(ws, "Nie si vo výučbe.");
          return;
        }
        if (vyucbaSkoncila(room)) {
          sendError(ws, "Táto časť výučby sa skončila.");
          return;
        }
        const krok = scenarVyucby.kroky[room.vyucba.krok];
        const kto = krok?.kto;
        if (kto !== "info" && kto !== "otazka" && !room.vyucba.vykonany) {
          sendError(ws, "Teraz nie je čo potvrdiť — urob ťah, ktorý ukazuje majster Melichar.");
          return;
        }
        // Cigareta pre Melichara (Michal 2026-10-25): ten istý krok jadra, aký prehrá návrat do výučby.
        if (krok?.odovzdaCigaretu === true && room.state !== null) {
          try {
            room.state = vykonajKrok(room.data, scenarVyucby, room.state, room.vyucba.krok);
          } catch (err) {
            console.error("Scenár výučby: odovzdanie cigarety neprešlo", krok.id, err);
            sendError(ws, "Cigaretu teraz odovzdať nemôžeš.");
            return;
          }
          room.lastActivity = teraz();
          broadcast(room, [{ type: "log", text: "Hráč 1 dal majstrovi Melicharovi cigaretu." }]);
        }
        posunVyucbu(room);
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
    room.prikazy.push([seat, cmd]);
    if (room.kronika !== null) room.kronika = zapisDoKroniky(room.data, room.kronika, pred, cmd, seat, result.state, result.events);
    room.state = result.state;
    room.lastActivity = teraz();
    if (room.tempo !== null) room.tempo = zapisPrikaz(room.tempo, fazaPrikazu(pred), seat, room.lastActivity, result.events);
    if (room.statistiky !== null) room.statistiky = zapisTah(room.statistiky, pred, cmd, seat, result.state, result.events);
    room.statistikyKariet = zapisTahKariet(room.statistikyKariet, pred, cmd, seat, result.events);
    // Pečiatky momentov — z verejných zmien, rovnaké pre oboch (momenty.ts).
    const strop = obmedzMomenty(momenty(room.data, pred, result.state, result.events), room.momenty, result.state);
    room.momenty = strop.stav;
    broadcast(room, [...result.events, ...strop.vybrane.map((moment): Event => ({ type: "moment", moment }))]);
    achievementyPoKroku(room, pred, cmd, seat, result.state, result.events);
    const skoncila = pred.koniec === null && result.state.koniec !== null;
    // Vzdaná a kontumovaná partia sa skončila, ale dohratá nie je.
    const dohrata = skoncila && cmd.type !== "vzdat";
    // Návštevník sa stáva hráčom po prvej dohratej partii proti človeku aj proti botovi (Michal 2026-10-21).
    if (dohrata && room.vyucba === null) for (const h of room.hraci) if (h !== null && h.id !== BOT_ID) ucty.povysPoPartii(h.id, prava.nastavenie().postup);
    // Do archívu ide každá partia, aj s botom (Michal 2026-10-22) — Frajerinu mení len hodnotená partia ľudí.
    // Výučba sa nezapisuje nikam (Michal 2026-10-23) — ani archív, ani tempo.
    if (skoncila && room.vyucba === null) {
      zapisDoArchivu(room, result.state, dohrata);
      zapisTempo(room, result.state, dohrata);
      // Výhra proti človeku môže odomknúť ďalšiu ligu — zapíše sa hneď, nech ju neskoršie sprísnenie nevezme.
      if (room.bot === null) {
        for (const h of room.hraci) {
          const u = h === null ? null : ucty.podlaId(h.id);
          if (u !== null) ligy.dorovnaj(u);
        }
      }
    }
    naplanujBota(room);
  };

  /** Keď môže hrať offline protihráč, po krátkej pauze zahrá (pri stavbe šenku aj súbežne s človekom). */
  const naplanujBota = (room: Room): void => {
    // Vo výučbe ťahá bot podľa scenára (naplanujVyucbu), nie vlastnou hlavou.
    if (room.vyucba !== null) return;
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

  // ---- výučba „Prvá hra“ (Michal 2026-10-23) ---------------------------------

  /**
   * Nová výučba hráča `ja` — pokračuje od uloženého kroku; po dokončenej časti od začiatku
   * ďalšej (prehrá partiu po jej prvý krok). Celá prejdená, alebo ďalšia časť, ktorú hráč
   * ešte nesmie hrať (navrh), začne odznova.
   */
  const zalozVyucbu = (ws: WebSocket, ja: Pouzivatel): void => {
    if (!vyucbaPreHracov && !jeSpravca(ja.rola)) {
      sendError(ws, "Výučba „Prvá hra“ ešte nie je hotová.");
      return;
    }
    const { sada, data } = obsah.aktualnaSada();
    const postup = postupVyucby(ja);
    let krok = postup.cast === null || !castPreHraca(postup.cast, ja) ? 0 : postup.krok;
    let state: GameState;
    try {
      state = prehrajVyucbu(data, scenarVyucby, krok);
    } catch {
      // Uložený postup na aktuálnej sade neprejde (zmenená karta) — od začiatku.
      try {
        krok = 0;
        state = prehrajVyucbu(data, scenarVyucby, 0);
      } catch (err) {
        console.error("Scenár výučby nesedí so sadou kariet:", err);
        sendError(ws, "Výučba sa teraz nedá spustiť — scenár nesedí so sadou kariet.");
        return;
      }
    }
    const room = novaMiestnost({
      data,
      sada,
      verejna: false,
      dlzka: "kratka",
      state,
      zaciatok: teraz(),
      seed: scenarVyucby.rozdanie.seed,
      bot: VYUCBA_BOT,
      botPovaha: "stamgast",
      // Záložné hlášky začnú v každej partii inde — nie vždy tou istou.
      vyucba: { krok, vykonany: false, koniecCasti: null, zalohy: randomInt(1_000) },
    });
    room.hraci[VYUCBA_BOT] = hracBot(room.botPovaha);
    usadit(ws, room, VYUCBA_HRAC);
    naplanujVyucbu(room);
  };

  /** Aktuálny krok výučby pre klienta, alebo null po poslednom kroku časti. */
  const krokVyucby = (room: Room): KrokVyucbyKlient | null => {
    if (room.vyucba === null || room.state === null || vyucbaSkoncila(room)) return null;
    const i = room.vyucba.krok;
    const k = scenarVyucby.kroky[i];
    const cast = castKroku(scenarVyucby, i);
    if (k === undefined || cast === null) return null;
    let ocakava: Command | null = null;
    try {
      ocakava = ocakavanyPrikaz(scenarVyucby, room.state, i);
    } catch (err) {
      console.error("Scenár výučby: krok", k.id, err);
    }
    return {
      index: i,
      spolu: scenarVyucby.kroky.length,
      id: k.id,
      kto: k.kto,
      vykonany: room.vyucba.vykonany,
      cast: { cast: cast.cast, nazov: cast.nazov, poradie: i - cast.od, krokov: cast.po - cast.od + 1 },
      melichar: k.melichar,
      zvyraznit: prelozKluceZvyraznenia(room.state, k.zvyraznit ?? []),
      ocakava,
      moznosti: k.kto === "otazka" ? (k.moznosti ?? []) : null,
      volba: k.volba === undefined ? null : { kandidati: prelozKluceZvyraznenia(room.state, k.volba.kandidati) },
      tlacidlo: k.tlacidlo ?? null,
      odovzdaCigaretu: k.odovzdaCigaretu === true,
      preskocenie: k.preskocenie === true,
      naneisto: k.naneisto === true,
    };
  };

  /**
   * Krok výučby, koniec časti a čo ďalej: po konci časti krok null, hotovo a ďalšia časť —
   * ponuka „Pokračovať“ (dalsiaCast), alebo „pripravujeme“, kým jej texty Michal neschváli.
   */
  const posliVyucbu = (room: Room): void => {
    const ws = room.sockets[VYUCBA_HRAC];
    if (ws === null || room.vyucba === null) return;
    const koniec = room.vyucba.koniecCasti;
    const dalsia = koniec === null ? null : castKroku(scenarVyucby, room.vyucba.krok);
    const hracId = room.hraci[VYUCBA_HRAC]?.id;
    const hrac = hracId === undefined ? null : ucty.podlaId(hracId);
    const smie = dalsia !== null && hrac !== null && castPreHraca(dalsia, hrac);
    const opis = (c: CastScenara | null): { cast: number; nazov: string; minuty: number } | null => (c === null ? null : { cast: c.cast, nazov: c.nazov, minuty: c.minuty });
    send(ws, {
      type: "vyucba",
      krok: krokVyucby(room),
      hotovo: vyucbaSkoncila(room),
      koniecCasti: koniec,
      dalsiaCast: smie ? opis(dalsia) : null,
      pripravujeme: smie ? null : opis(dalsia),
    });
  };

  /**
   * Krok hotový: uloží postup k účtu, pošle ďalší krok a ak je na rade bot, naplánuje ho.
   * Po poslednom kroku časti partia zastane (roadmapa #105) — ďalšia časť až na vyucbaPokracuj.
   */
  const posunVyucbu = (room: Room): void => {
    if (room.vyucba === null) return;
    const koniec = koniecCastiPoKroku(scenarVyucby, room.vyucba.krok);
    room.vyucba.krok++;
    room.vyucba.vykonany = false;
    if (koniec !== null) room.vyucba.koniecCasti = koniec;
    const id = room.hraci[VYUCBA_HRAC]?.id;
    if (id !== undefined) {
      ucty.ulozVyucbu(id, room.vyucba.krok, koniec !== null ? "hotova" : undefined, scenarVyucby.verzia ?? null, idKrokovVyucby[room.vyucba.krok] ?? null);
      if (koniec !== null) {
        // Dokončená časť výučby = hviezdička achievementu Prvá hra za časť (Michal 2026-10-25)
        // a z návštevníka Poldeci — bez archívu, štatistík a Frajeriny. AI playtester achievementy
        // nezískava. Partia stojí (ďalší ťah vykonajVyucbu nepustí), kým hráč nepokračuje ďalšou
        // časťou; odchodom zanikne a ďalšia časť sa prehrá z uloženého postupu.
        const ws = room.sockets[VYUCBA_HRAC];
        const zisky = achievementy !== null && room.hraci[VYUCBA_HRAC]?.ai !== true ? achievementy.udelZaVyucbu(id, teraz(), koniec) : [];
        if (ws !== null) for (const zisk of zisky) send(ws, { type: "achievement", zisk });
        ucty.povysPoPartii(id, prava.nastavenie().postup);
      }
    }
    posliVyucbu(room);
    naplanujVyucbu(room);
  };

  /** Hláška Melichara pri chybe hráča: vlastná, kroku, alebo ďalšia záložná (Michal 2026-10-28). */
  const hlaskaChyby = (room: Room, vlastna: string | null | undefined): string | null => {
    if (room.vyucba === null) return null;
    const h = hlaskaPriChybe(scenarVyucby, scenarVyucby.kroky[room.vyucba.krok], vlastna, room.vyucba.zalohy);
    if (h.zaloha) room.vyucba.zalohy++;
    return h.hlaska;
  };

  /** Príkaz hráča vo výučbe: prejde len ten, ktorý krok dovoľuje. */
  const vykonajVyucbu = (ws: WebSocket, room: Room, cmd: Command): void => {
    if (room.vyucba === null || room.state === null) return;
    const k = scenarVyucby.kroky[room.vyucba.krok];
    if (k === undefined || vyucbaSkoncila(room)) {
      sendError(ws, "Táto časť výučby sa skončila.");
      return;
    }
    if (k.kto !== "hrac") {
      sendError(
        ws,
        k.kto === "info" || room.vyucba.vykonany
          ? "Najprv si prečítaj, čo hovorí majster Melichar, a klikni „ďalej“."
          : k.kto === "auto"
            ? "Tento ťah spraví hra za teba — chvíľu počkaj."
            : "Teraz ťahá Štamgast.",
      );
      return;
    }
    const ocakava = ocakavanyPrikaz(scenarVyucby, room.state, room.vyucba.krok);
    if (ocakava === null) {
      sendError(ws, `Vo výučbe teraz urob toto: ${k.melichar}`);
      posliVyucbu(room);
      return;
    }
    // Zlý alebo neúplný ťah: povedať, čo chýba a čo je navyše (playtest výučby, návrh 1);
    // rovnaká karta (defId aj variant) prejde a vykoná sa krok zo scenára.
    const porovnanie = porovnajSKrokom(room.data, room.state, cmd, ocakava);
    // Rozhodnutie: zlý ťah dostane radu Melichara, nie chybu (UX N2).
    if (!porovnanie.zhoda && k.volba !== undefined) {
      const rada = radaVyucby(room.state, k.volba, cmd);
      send(ws, { type: "vyucbaRada", text: rada.text, hlaska: hlaskaChyby(room, rada.hlaska) });
      posliVyucbu(room);
      return;
    }
    if (!porovnanie.zhoda) {
      sendError(ws, textChybyKroku(porovnanie));
      send(ws, { type: "vyucbaChyba", chybajuce: porovnanie.chybajuce, navyse: porovnanie.navyse, hlaska: hlaskaChyby(room, null) });
      posliVyucbu(room);
      return;
    }
    try {
      vykonaj(room, ocakava, VYUCBA_HRAC);
    } catch (err) {
      console.error("Scenár výučby: krok hráča neprešiel", k.id, err);
      sendError(ws, err instanceof IllegalCommandError ? err.message : "Vnútorná chyba servera.");
      return;
    }
    posunVyucbu(room);
  };

  /** Ťah bota a automatický ťah hráča (auto) zo scenára po pauze — aby ho hráč stihol sledovať. */
  const naplanujVyucbu = (room: Room): void => {
    if (room.vyucba === null || room.botTimer !== null || room.state === null || vyucbaSkoncila(room)) return;
    const najblizsi = scenarVyucby.kroky[room.vyucba.krok];
    if (najblizsi === undefined || (najblizsi.kto !== "bot" && najblizsi.kto !== "auto") || room.vyucba.vykonany) return;
    room.botTimer = setTimeout(() => {
      room.botTimer = null;
      const state = room.state;
      if (state === null || room.vyucba === null || !rooms.has(room.code) || vyucbaSkoncila(room)) return;
      const krok = scenarVyucby.kroky[room.vyucba.krok];
      if ((krok?.kto !== "bot" && krok?.kto !== "auto") || krok.prikaz === undefined) return;
      const hrac = ktoVykona(krok);
      try {
        vykonaj(room, prikazZoScenara(state, hrac, krok.prikaz), hrac);
      } catch (err) {
        console.error(`Scenár výučby: ${krok.kto === "auto" ? "automatický ťah hráča" : "ťah bota"} neprešiel`, krok.id, err);
        return;
      }
      // S textom: ťah je na stole a krok čaká na „ďalej“ — hráč vidí text aj výsledok (U5).
      if (cakaNaDalej(krok)) {
        room.vyucba.vykonany = true;
        posliVyucbu(room);
        return;
      }
      posunVyucbu(room);
      // Pauza podľa textu Melichara — hráč ho stihne prečítať a UI zvýrazniť, čo sa stane (testy: botPauzaMs).
    }, opts.botPauzaMs ?? pauzaKrokuVyucby(najblizsi));
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

  // ---- achievementy (Michal 2026-10-23) ----------------------------------------

  /** Zisky z jednej partie — kód miestnosti sa opakuje, začiatok partie nie. */
  const klucMiestnosti = (room: Room): string => `${room.code}:${room.zaciatok}`;

  const zacniAchievementy = (room: Room): void => {
    if (achievementy === null || room.vyucba !== null) return;
    const ucet = (i: PlayerId): { id: number; ai: boolean } | null => {
      const h = room.hraci[i];
      return h === null || room.bot === i || h.id === BOT_ID ? null : { id: h.id, ai: h.ai };
    };
    try {
      room.achievementy = achievementy.zacni([ucet(0), ucet(1)], room.bot === null ? null : room.botPovaha);
    } catch (err) {
      console.error("Achievementy partie sa nepodarilo založiť:", err);
      room.achievementy = null;
    }
  };

  /** Oznam o zisku ide LEN hráčovi, ktorý získal — súper ho nevidí. */
  const achievementyPoKroku = (room: Room, pred: GameState, cmd: Command, seat: PlayerId, po: GameState, events: readonly Event[]): void => {
    if (achievementy === null || room.achievementy === null || room.vyucba !== null) return;
    try {
      const { zisky, suhrny } = achievementy.poKroku(room.achievementy, room.data, pred, cmd, seat, po, events, klucMiestnosti(room), teraz());
      for (const miesto of [0, 1] as const) {
        const ws = room.sockets[miesto];
        if (ws === null) continue;
        for (const zisk of zisky[miesto]) send(ws, { type: "achievement", zisk });
        const suhrn = suhrny[miesto];
        if (suhrn !== null) send(ws, { type: "achievementySuhrn", suhrn });
      }
      // Nová hviezda môže hneď zvýšiť rank (Deci, Sedmička) — aj keď hráč práve nie je pripojený.
      for (const miesto of [0, 1] as const) {
        const id = room.hraci[miesto]?.id;
        if (zisky[miesto].length > 0 && id !== undefined && id !== BOT_ID) ucty.povysPodlaHviezd(id, prava.nastavenie().postup);
      }
    } catch (err) {
      // Achievementy nesmú zastaviť partiu.
      console.error("Achievementy po ťahu zlyhali:", err);
    }
  };

  const zapisDoArchivu = (room: Room, koniec: GameState, dohrata: boolean): void => {
    const [h0, h1] = room.hraci;
    if (h0 === null || h1 === null || room.statistiky === null || koniec.koniec === null) return;
    try {
      const { id: partia, zmeny } = archiv.zapis({
        kod: room.code,
        zaciatok: room.zaciatok,
        koniec: teraz(),
        vitaz: koniec.koniec.vitaz,
        dovod: koniec.koniec.dovod.replace(/Hráč ([12])/g, (_, n: string) => (n === "1" ? h0.meno : h1.meno)),
        kola: koniec.kolo,
        verziaSady: room.sada.verzia,
        dohrata,
        hraci: [room.bot === 0 ? null : h0.id, room.bot === 1 ? null : h1.id],
        sBotom: room.bot !== null,
        botPovaha: room.bot === null ? null : room.botPovaha,
        dlzka: room.dlzka,
        verziaJadra,
        verziaPravidiel: VERZIA_PRAVIDIEL,
        seed: room.seed,
        prikazy: room.prikazy,
        // Kronika: kolá a záverečný účet špakov (v6, ten istý rozpis ako na stole) s menami starších.
        kronika: {
          kola: room.kronika?.kola ?? [],
          zaverecne: ucetSpakov(viewFor(room.data, koniec, 0)),
          menaStarsich: Object.fromEntries(koniec.starsi.map((e) => [e.elderId, defOf(room.data, e.karta).name])),
        },
        // Hodnotená (Frajerina) len keď na to majú právo obaja a nehrá človek proti AI
        // playtesterovi ani botovi (Michal 2026-10-22) — inak archív a štatistiky bez zmeny Frajeriny.
        hodnotena: room.bot === null && h0.ai === h1.ai && [h0.id, h1.id].every((id) => {
          const u = ucty.podlaId(id);
          return u !== null && prava.smie(u, "hodnotene_partie");
        }),
        body: koniec.koniec.body,
        statistiky: doplnNaexZKroniky(uzavriStatistiky(room.data, room.statistiky, koniec), room.kronika?.kola ?? []),
        statistikyKariet: room.statistikyKariet,
      });
      if (room.achievementy !== null) achievementy?.priradPartiu(klucMiestnosti(room), partia);
      // Partia s botom Frajerinu nemení — správa o nej sa neposiela.
      if (room.bot !== null) return;
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
        // Dokončenú výučbu už niet čo obnoviť — postup je uložený, miestnosť by len visela.
        if (vyucbaSkoncila(room)) zrusMiestnost(room);
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

  const cleanupInterval = setInterval(() => {
    const t = teraz();
    for (const room of rooms.values()) {
      const prazdna = room.sockets[0] === null && room.sockets[1] === null;
      if (prazdna && t - room.lastActivity > ZRUSIT_PRAZDNU_PO_MS) zrusMiestnost(room);
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
    hlavicky["cache-control"] = subor.includes(join("assets", ""))
      ? "public, max-age=31536000, immutable"
      : subor.includes(join("pravidla", "")) && extname(subor) === ".jpg"
        ? "public, max-age=86400"
        : "no-cache";
    res.writeHead(200, hlavicky);
    res.end(obsah);
  } catch {
    res.writeHead(404).end();
  }
}

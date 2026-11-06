// Stoly formátu 2 na 2 (roadmapa #28, rozhodnutia platformy Michal 2026-11-02): štyri miesta,
// boti na každom mieste, pozvánka, voľné miesta v herni a náhodné párovanie, signály a chat
// len pre partnera, vzdanie potvrdzujú obaja, odpojenie je kontumácia tímu, samostatný rebríček.
//
// Oddelené od miestností 1 na 1 zámerne: tie nesú Frajerinu, ligy, achievementy a výučbu, ktoré
// 2 na 2 nemení, a každá zmena ich tvaru by ohrozila partie, ktoré už bežia.

import { randomBytes, randomInt } from "node:crypto";
import type { WebSocket } from "ws";
import type { Command, Event, GameData, GameState, Miesto, PlayerId, Semienko } from "@naex/core";
import {
  DLZKY_HRY,
  IllegalCommandError,
  POVAHY,
  applySPrisunom,
  eventsFor,
  legalCommands,
  miestaFormatu,
  partnerMiesta,
  semienkoChacha,
  setupGame,
  tahBotaNaMieste,
  timMiesta,
  viewFor,
} from "@naex/core";
import type { Db } from "./db.ts";

/** Pevné signály partnerovi. Zoznam je návrh, kým ho Michal neschváli (otvorené v docs/napady/2na2-paragraf.md). */
export const SIGNALY_2NA2 = [
  { id: "mam_silnu", text: "Mám silnú kartu" },
  { id: "nemam_nic", text: "Nemám nič" },
  { id: "dam_naex", text: "Dám NA EX" },
  { id: "setri_poldeci", text: "Šetri poldeci" },
  { id: "kraj_moj", text: "Tento kraj beriem ja" },
  { id: "bij_tento", text: "Biť tohto staršieho" },
] as const;

const CHAT_MAX_ZNAKOV = 300;
const CHAT_PAUZA_MS = 400;
const KONTUMACIA_PO_MS = 3 * 60 * 1000;
const ZRUSIT_PRAZDNY_PO_MS = 30 * 60 * 1000;
const MIESTA = miestaFormatu("2na2");

export interface Hrac2na2 {
  readonly id: number;
  readonly meno: string;
  readonly avatar: string | null;
  readonly pohlavie?: string | null;
  readonly ai?: boolean;
}

type Sedadlo =
  | { readonly druh: "clovek"; readonly hrac: Hrac2na2; ws: WebSocket | null; odpojenyOd: number | null; chatOd: number }
  | { readonly druh: "bot"; readonly povaha: string; readonly meno: string; readonly avatar: string | null };

export interface Stol2na2 {
  readonly code: string;
  readonly data: GameData;
  readonly sada: number;
  readonly sadaKlient: unknown;
  readonly verejny: boolean;
  readonly zakladatel: number;
  readonly sedadla: (Sedadlo | null)[];
  state: GameState | null;
  seed: Semienko | null;
  botTimer: ReturnType<typeof setTimeout> | null;
  /** Kto v tíme navrhol vzdanie; platí, keď ho potvrdí partner (Michal 2026-11-02). */
  readonly navrhVzdania: [Miesto | null, Miesto | null];
  readonly prikazy: [Miesto, Command][];
  readonly historia: Event[][];
  zaciatok: number;
  zapisany: boolean;
  lastActivity: number;
}

export interface ZavislostiStolov {
  /** `sada` je číslo verzie do archívu, `sadaKlient` celá sada pre klienta (ako v privítaní 1 na 1). */
  readonly data: () => { readonly data: GameData; readonly sada: number; readonly sadaKlient: unknown };
  readonly send: (ws: WebSocket, msg: unknown) => void;
  readonly chyba: (ws: WebSocket, text: string) => void;
  readonly novyKod: (obsadene: (code: string) => boolean) => string;
  readonly botHrac: (povaha: string) => { readonly meno: string; readonly avatar: string | null };
  readonly teraz: () => number;
  readonly db: Db;
  readonly botPauzaMs?: number;
  readonly seedRozdania?: Semienko;
}

/** Tabuľky rebríčka 2 na 2; ranky a ligy 1 na 1 sa ich netýkajú (Michal 2026-11-02). */
export function pripravTabulky2na2(db: Db): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS partie_2na2 (
      id INTEGER PRIMARY KEY,
      zaciatok INTEGER NOT NULL,
      koniec INTEGER NOT NULL,
      vitaz INTEGER,
      dohrata INTEGER NOT NULL,
      prikazy TEXT NOT NULL,
      seed TEXT NOT NULL,
      sada INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS partie_2na2_hraci (
      partia INTEGER NOT NULL REFERENCES partie_2na2(id) ON DELETE CASCADE,
      miesto INTEGER NOT NULL,
      pouzivatel INTEGER NOT NULL,
      PRIMARY KEY (partia, miesto)
    );
    CREATE INDEX IF NOT EXISTS partie_2na2_hraci_pouzivatel ON partie_2na2_hraci(pouzivatel);
  `);
}

export interface RiadokRebricka2na2 {
  readonly id: number;
  readonly meno: string;
  readonly avatar: string | null;
  readonly vyhry: number;
  readonly prehry: number;
}

/** Rebríček: len partie štyroch ľudí, s botom sa do štatistík nerátajú. */
export function rebricek2na2(db: Db, limit = 100): readonly RiadokRebricka2na2[] {
  return db
    .prepare(
      `SELECT u.id AS id, u.meno AS meno, u.avatar AS avatar,
              SUM(CASE WHEN p.vitaz = h.miesto % 2 THEN 1 ELSE 0 END) AS vyhry,
              SUM(CASE WHEN p.vitaz IS NOT NULL AND p.vitaz <> h.miesto % 2 THEN 1 ELSE 0 END) AS prehry
         FROM partie_2na2_hraci h
         JOIN partie_2na2 p ON p.id = h.partia
         JOIN pouzivatelia u ON u.id = h.pouzivatel
        WHERE (SELECT COUNT(*) FROM partie_2na2_hraci x WHERE x.partia = h.partia) = 4
        GROUP BY u.id
        ORDER BY vyhry DESC, prehry ASC, u.meno ASC
        LIMIT ?`,
    )
    .all(limit) as unknown as RiadokRebricka2na2[];
}

export class Stoly2na2 {
  private readonly stoly = new Map<string, Stol2na2>();
  private readonly poSockete = new Map<WebSocket, { stol: Stol2na2; miesto: Miesto }>();
  private readonly z: ZavislostiStolov;

  constructor(z: ZavislostiStolov) {
    this.z = z;
  }

  jeNaStole(ws: WebSocket): boolean {
    return this.poSockete.has(ws);
  }

  /** Rozohrané stoly — uzávierka pri nasadení na ne čaká rovnako ako na 1 na 1. */
  rozohrane(): number {
    return [...this.stoly.values()].filter((s) => s.state !== null && s.state.koniec === null).length;
  }

  /** Voľné miesta do herne: len verejné stoly, ktoré ešte nezačali. */
  volneStoly(): readonly { readonly code: string; readonly obsadene: number }[] {
    return [...this.stoly.values()]
      .filter((s) => s.verejny && s.state === null)
      .map((s) => ({ code: s.code, obsadene: s.sedadla.filter((x) => x !== null).length }));
  }

  zaloz(ws: WebSocket, ja: Hrac2na2, volby: { readonly verejny?: boolean; readonly boti?: readonly number[] }): void {
    const { data, sada, sadaKlient } = this.z.data();
    const code = this.z.novyKod((c) => this.stoly.has(c));
    const stol: Stol2na2 = {
      code,
      data,
      sada,
      sadaKlient,
      verejny: volby.verejny === true,
      zakladatel: ja.id,
      sedadla: [null, null, null, null],
      state: null,
      seed: null,
      botTimer: null,
      navrhVzdania: [null, null],
      prikazy: [],
      historia: [[], [], [], []],
      zaciatok: 0,
      zapisany: false,
      lastActivity: this.z.teraz(),
    };
    this.stoly.set(code, stol);
    this.usad(ws, stol, 0, ja);
    for (const m of volby.boti ?? []) this.posadBota(stol, m);
    this.mozeZacat(stol);
    this.posliStol(stol);
  }

  /** Pripojenie cez kód (pozvánka); `miesto` = želané, inak prvé voľné. Návrat na svoje miesto vždy. */
  pridaj(ws: WebSocket, ja: Hrac2na2, code: string, miesto?: number): void {
    const stol = this.stoly.get(code);
    if (stol === undefined) {
      this.z.chyba(ws, "Taký stôl neexistuje.");
      return;
    }
    const moje = MIESTA.find((m) => {
      const s = stol.sedadla[m];
      return s?.druh === "clovek" && s.hrac.id === ja.id;
    });
    if (moje !== undefined) {
      this.usad(ws, stol, moje, ja);
      this.posliStol(stol);
      return;
    }
    const volne = MIESTA.filter((m) => stol.sedadla[m] === null);
    const kam = miesto === undefined ? volne[0] : volne.find((m) => m === miesto);
    if (stol.state !== null || kam === undefined) {
      this.z.chyba(ws, "Na tomto stole už nie je voľné miesto.");
      return;
    }
    this.usad(ws, stol, kam, ja);
    this.mozeZacat(stol);
    this.posliStol(stol);
  }

  /** Náhodné párovanie: prvý verejný stôl s voľným miestom, inak nový verejný. */
  nahodne(ws: WebSocket, ja: Hrac2na2): void {
    const stol = [...this.stoly.values()].find((s) => s.verejny && s.state === null && s.sedadla.some((x) => x === null));
    if (stol === undefined) {
      this.zaloz(ws, ja, { verejny: true });
      return;
    }
    this.pridaj(ws, ja, stol.code);
  }

  /** Zakladateľ doplní prázdne miesta botmi a partia hneď začne. */
  doplnBotmi(ws: WebSocket): void {
    const kde = this.poSockete.get(ws);
    if (kde === undefined) return;
    const { stol } = kde;
    const s = stol.sedadla[kde.miesto];
    if (stol.state !== null || s?.druh !== "clovek" || s.hrac.id !== stol.zakladatel) {
      this.z.chyba(ws, "Botov môže doplniť len ten, kto stôl založil, pred začiatkom partie.");
      return;
    }
    for (const m of MIESTA) if (stol.sedadla[m] === null) this.posadBota(stol, m);
    this.mozeZacat(stol);
    this.posliStol(stol);
  }

  odist(ws: WebSocket): void {
    const kde = this.poSockete.get(ws);
    if (kde === undefined) return;
    const { stol, miesto } = kde;
    this.poSockete.delete(ws);
    if (stol.state === null) {
      stol.sedadla[miesto] = null;
      if (!stol.sedadla.some((s) => s?.druh === "clovek")) this.zrus(stol);
      else this.posliStol(stol);
      return;
    }
    this.odpojenie(stol, miesto, ws);
  }

  /** Zavretie spojenia; partia beží ďalej, po čase si súper vyžiada kontumáciu. */
  odpojil(ws: WebSocket): void {
    const kde = this.poSockete.get(ws);
    if (kde === undefined) return;
    this.poSockete.delete(ws);
    this.odpojenie(kde.stol, kde.miesto, ws);
  }

  private odpojenie(stol: Stol2na2, miesto: Miesto, ws: WebSocket): void {
    const s = stol.sedadla[miesto];
    if (s?.druh === "clovek" && s.ws === ws) {
      s.ws = null;
      s.odpojenyOd = this.z.teraz();
    }
    // Keď už nikto živý nesedí, s partiou proti botom niet čo dohrávať.
    const nikto = !stol.sedadla.some((x) => x?.druh === "clovek" && x.ws !== null);
    if (nikto && stol.state !== null && !stol.sedadla.some((x) => x?.druh === "clovek" && !x.hrac.ai) ) this.zrus(stol);
    else this.posliStol(stol);
  }

  prikaz(ws: WebSocket, cmd: Command): void {
    const kde = this.poSockete.get(ws);
    if (kde === undefined) {
      this.z.chyba(ws, "Nie si za stolom.");
      return;
    }
    const { stol, miesto } = kde;
    if (stol.state === null) {
      this.z.chyba(ws, "Hra ešte nezačala — čaká sa na hráčov.");
      return;
    }
    // Vzdanie ide cez navrhniVzdanie, kontumácia cez kontumacia — klient ich príkazom neobíde.
    if (cmd.type === "vzdat") {
      this.z.chyba(ws, "Vzdanie musí potvrdiť aj partner.");
      return;
    }
    try {
      this.vykonaj(stol, cmd, miesto);
    } catch (err) {
      if (err instanceof IllegalCommandError) this.z.chyba(ws, err.message);
      else {
        console.error("Chyba pri príkaze 2 na 2:", err);
        this.z.chyba(ws, "Vnútorná chyba servera.");
      }
    }
  }

  /** Text len partnerovi a späť sebe; súper nedostane nič (Michal 2026-11-02). */
  chat(ws: WebSocket, text: unknown): void {
    const kde = this.poSockete.get(ws);
    if (kde === undefined || typeof text !== "string") return;
    const ciste = text.trim().slice(0, CHAT_MAX_ZNAKOV);
    if (ciste.length === 0) return;
    const s = kde.stol.sedadla[kde.miesto];
    if (s?.druh !== "clovek") return;
    const t = this.z.teraz();
    if (t - s.chatOd < CHAT_PAUZA_MS) {
      this.z.chyba(ws, "Pomaly, partner to ešte číta.");
      return;
    }
    s.chatOd = t;
    this.partnerovi(kde.stol, kde.miesto, { type: "chat2na2", od: kde.miesto, text: ciste });
  }

  signal(ws: WebSocket, id: unknown): void {
    const kde = this.poSockete.get(ws);
    if (kde === undefined) return;
    const signal = SIGNALY_2NA2.find((x) => x.id === id);
    if (signal === undefined) {
      this.z.chyba(ws, "Taký signál nie je.");
      return;
    }
    this.partnerovi(kde.stol, kde.miesto, { type: "signal2na2", od: kde.miesto, id: signal.id, text: signal.text });
  }

  private partnerovi(stol: Stol2na2, m: Miesto, sprava: unknown): void {
    for (const q of [m, partnerMiesta(m)]) {
      const s = stol.sedadla[q];
      if (s?.druh === "clovek" && s.ws !== null) this.z.send(s.ws, sprava);
    }
  }

  /** Vzdanie musia chcieť obaja; partner bot súhlasí sám. Opakovaný návrh toho istého nič nespraví. */
  navrhniVzdanie(ws: WebSocket): void {
    const kde = this.poSockete.get(ws);
    if (kde === undefined || kde.stol.state === null || kde.stol.state.koniec !== null) return;
    const { stol, miesto } = kde;
    const tim = timMiesta(miesto);
    const partner = stol.sedadla[partnerMiesta(miesto)];
    const navrh = stol.navrhVzdania[tim];
    if (partner?.druh === "bot" || (navrh !== null && navrh !== miesto)) {
      stol.navrhVzdania[tim] = null;
      this.vykonaj(stol, { type: "vzdat" }, miesto);
      return;
    }
    stol.navrhVzdania[tim] = miesto;
    this.posliStol(stol);
  }

  zrusVzdanie(ws: WebSocket): void {
    const kde = this.poSockete.get(ws);
    if (kde === undefined) return;
    kde.stol.navrhVzdania[timMiesta(kde.miesto)] = null;
    this.posliStol(kde.stol);
  }

  /** Odpojenie člena je kontumácia celého tímu (Michal 2026-11-02). */
  kontumacia(ws: WebSocket): void {
    const kde = this.poSockete.get(ws);
    if (kde === undefined) return;
    const { stol, miesto } = kde;
    if (stol.state === null || stol.state.koniec !== null) {
      this.z.chyba(ws, "Nie je čo kontumovať.");
      return;
    }
    const tim: PlayerId = timMiesta(miesto) === 0 ? 1 : 0;
    const odpojeny = MIESTA.find((m) => {
      const s = stol.sedadla[m];
      return timMiesta(m) === tim && s?.druh === "clovek" && s.ws === null && s.odpojenyOd !== null;
    });
    const s = odpojeny === undefined ? null : stol.sedadla[odpojeny];
    if (odpojeny === undefined || s?.druh !== "clovek" || s.odpojenyOd === null) {
      this.z.chyba(ws, "Súperi sú pripojení.");
      return;
    }
    const zostava = KONTUMACIA_PO_MS - (this.z.teraz() - s.odpojenyOd);
    if (zostava > 0) {
      this.z.chyba(ws, `Súper je odpojený len chvíľu. Kontumačnú výhru si môžeš vyžiadať o ${Math.ceil(zostava / 1000)} s.`);
      return;
    }
    this.vykonaj(stol, { type: "vzdat", kontumacia: true }, odpojeny);
  }

  upratajPrazdne(): void {
    const t = this.z.teraz();
    for (const stol of this.stoly.values()) {
      const nikto = !stol.sedadla.some((s) => s?.druh === "clovek" && s.ws !== null);
      if (nikto && t - stol.lastActivity > ZRUSIT_PRAZDNY_PO_MS) this.zrus(stol);
    }
  }

  zavri(): void {
    for (const stol of this.stoly.values()) if (stol.botTimer !== null) clearTimeout(stol.botTimer);
  }

  private zrus(stol: Stol2na2): void {
    if (stol.botTimer !== null) clearTimeout(stol.botTimer);
    this.stoly.delete(stol.code);
  }

  private usad(ws: WebSocket, stol: Stol2na2, m: Miesto, ja: Hrac2na2): void {
    const stare = stol.sedadla[m];
    if (stare?.druh === "clovek" && stare.ws !== null && stare.ws !== ws) {
      this.z.chyba(stare.ws, "Pripojenie prevzal iný tab alebo okno.");
      this.poSockete.delete(stare.ws);
      stare.ws.close();
    }
    stol.sedadla[m] = { druh: "clovek", hrac: ja, ws, odpojenyOd: null, chatOd: 0 };
    this.poSockete.set(ws, { stol, miesto: m });
    stol.lastActivity = this.z.teraz();
    if (stol.state !== null) {
      this.z.send(ws, { type: "historia", events: stol.historia[m] ?? [] });
      this.z.send(ws, { type: "state", view: viewFor(stol.data, stol.state, m), events: [] });
    }
  }

  private posadBota(stol: Stol2na2, m: number): void {
    const miesto = MIESTA.find((x) => x === m);
    if (miesto === undefined || stol.sedadla[miesto] !== null) return;
    // Rôzne povahy, kým stačia: dve rovnaké mená za stolom pôsobia ako chyba.
    const obsadene = new Set(stol.sedadla.flatMap((s) => (s?.druh === "bot" ? [s.povaha] : [])));
    const volne = POVAHY.filter((p) => !obsadene.has(p.id));
    const vyber = volne.length > 0 ? volne : POVAHY;
    const povaha = vyber[randomInt(vyber.length)]?.id ?? "igor";
    stol.sedadla[miesto] = { druh: "bot", povaha, ...this.z.botHrac(povaha) };
  }

  private mozeZacat(stol: Stol2na2): void {
    if (stol.state !== null || stol.sedadla.some((s) => s === null)) return;
    stol.seed = this.z.seedRozdania ?? semienkoChacha(randomBytes(32));
    const ludia = MIESTA.filter((m) => stol.sedadla[m]?.druh === "clovek");
    stol.state = setupGame(stol.data, stol.seed, { format: "2na2", lokalit: DLZKY_HRY.kratka, ludia });
    stol.zaciatok = this.z.teraz();
    this.rozposli(stol, []);
    this.naplanujBota(stol);
  }

  private vykonaj(stol: Stol2na2, cmd: Command, m: Miesto): void {
    const pred = stol.state;
    if (pred === null) return;
    const vysledok = applySPrisunom(stol.data, pred, cmd, m);
    stol.prikazy.push([m, cmd]);
    stol.state = vysledok.state;
    stol.lastActivity = this.z.teraz();
    this.rozposli(stol, vysledok.events);
    if (pred.koniec === null && vysledok.state.koniec !== null) this.zapisVysledok(stol, vysledok.state, cmd.type !== "vzdat");
    this.naplanujBota(stol);
  }

  /** Každému len jeho pohľad a udalosti jeho tímu (nemenné pravidlo 2). */
  private rozposli(stol: Stol2na2, events: readonly Event[]): void {
    const state = stol.state;
    if (state === null) return;
    for (const m of MIESTA) {
      const moje = eventsFor(events, timMiesta(m));
      stol.historia[m]?.push(...moje.filter((e) => e.type === "log" || e.type === "bitkaVysledok" || e.type === "koniec"));
      const s = stol.sedadla[m];
      if (s?.druh === "clovek" && s.ws !== null) this.z.send(s.ws, { type: "state", view: viewFor(stol.data, state, m), events: moje });
    }
    this.posliStol(stol);
  }

  /** Kto kde sedí, verejné pre všetkých za stolom. Id účtu sa neposiela, stačí meno a avatar. */
  private posliStol(stol: Stol2na2): void {
    const miesta = stol.sedadla.map((s) => {
      if (s === null) return null;
      if (s.druh === "bot") return { meno: s.meno, avatar: s.avatar, bot: true, pripojeny: true };
      return { meno: s.hrac.meno, avatar: s.hrac.avatar, bot: false, pripojeny: s.ws !== null };
    });
    for (const m of MIESTA) {
      const s = stol.sedadla[m];
      if (s?.druh !== "clovek" || s.ws === null) continue;
      this.z.send(s.ws, {
        type: "stol2na2",
        code: stol.code,
        miesto: m,
        verejny: stol.verejny,
        sada: stol.sadaKlient,
        zacala: stol.state !== null,
        miesta,
        signaly: SIGNALY_2NA2,
        // Návrh vzdania vidí len vlastný tím.
        navrhVzdania: stol.navrhVzdania[timMiesta(m)],
      });
    }
  }

  private naplanujBota(stol: Stol2na2): void {
    if (stol.botTimer !== null || stol.state === null || stol.state.koniec !== null) return;
    const state = stol.state;
    const bot = MIESTA.find((m) => stol.sedadla[m]?.druh === "bot" && legalCommands(stol.data, state, m).length > 0);
    if (bot === undefined) return;
    stol.botTimer = setTimeout(() => {
      stol.botTimer = null;
      const teraz = stol.state;
      if (teraz === null || !this.stoly.has(stol.code)) return;
      const legal = legalCommands(stol.data, teraz, bot);
      if (legal.length === 0) {
        this.naplanujBota(stol);
        return;
      }
      const sedadlo = stol.sedadla[bot];
      const povaha = sedadlo?.druh === "bot" ? sedadlo.povaha : undefined;
      try {
        this.vykonaj(stol, tahBotaNaMieste(stol.data, teraz, bot, randomInt(2 ** 31), povaha === undefined ? {} : { povaha }), bot);
      } catch (err) {
        // Chyba v bote nesmie partiu zamraziť.
        console.error("Bot 2 na 2 nevedel zahrať:", err);
        const nahrada = legal[0];
        if (nahrada !== undefined) this.vykonaj(stol, nahrada, bot);
      }
    }, this.z.botPauzaMs ?? 700);
  }

  private zapisVysledok(stol: Stol2na2, koniec: GameState, dohrata: boolean): void {
    if (stol.zapisany || koniec.koniec === null) return;
    stol.zapisany = true;
    const { db } = this.z;
    const riadok = db
      .prepare("INSERT INTO partie_2na2 (zaciatok, koniec, vitaz, dohrata, prikazy, seed, sada) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(stol.zaciatok, this.z.teraz(), koniec.koniec.vitaz, dohrata ? 1 : 0, JSON.stringify(stol.prikazy), JSON.stringify(stol.seed), stol.sada);
    const vloz = db.prepare("INSERT INTO partie_2na2_hraci (partia, miesto, pouzivatel) VALUES (?, ?, ?)");
    for (const m of MIESTA) {
      const s = stol.sedadla[m];
      if (s?.druh === "clovek") vloz.run(riadok.lastInsertRowid, m, s.hrac.id);
    }
  }
}

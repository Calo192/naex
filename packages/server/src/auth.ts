// Účty a relácie: meno + heslo (scrypt z node:crypto), relácia v HttpOnly
// cookie. V databáze je len hash tokenu — únik databázy neprezradí relácie.
//
// Úroveň účtu (Michal 2026-10-12): admin (jediný, z NAEX_ADMIN_HESLO),
// subadmin (povýši ho admin), hráč, návštevník. Nový účet je návštevník
// a hráčom sa stane po PARTII_NA_HRACA dohratých partiách.

import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { IncomingMessage } from "node:http";
import type { Db } from "./db.ts";

export type Rola = "admin" | "subadmin" | "hrac" | "navstevnik";

export const UROVNE: readonly Rola[] = ["admin", "subadmin", "hrac", "navstevnik"];

/** Koľko dohratých partií treba, aby sa návštevník stal hráčom. */
export const PARTII_NA_HRACA = 3;

/** Admin a subadmin: správa hráčov, tvorba kariet, mazanie cudzích príspevkov. */
export function jeSpravca(rola: Rola): boolean {
  return rola === "admin" || rola === "subadmin";
}

/** Spätnú väzbu (názory, komentáre, cigarety) píšu hráči a správcovia, návštevník len číta. */
export function smiePisat(ja: { readonly rola: Rola }): void {
  if (ja.rola === "navstevnik") {
    throw new ChybaVstupu(`Návštevník spätnú väzbu len číta — písať môžeš po ${PARTII_NA_HRACA} dohratých partiách.`, 403);
  }
}

const rolaZDb = (v: unknown): Rola => (UROVNE.includes(v as Rola) ? (v as Rola) : "navstevnik");

export interface Pouzivatel {
  readonly id: number;
  readonly login: string;
  readonly meno: string;
  readonly avatar: string | null;
  readonly rola: Rola;
  /** Zväčšenie karty pri prejdení myšou v percentách (LUPA_OD – LUPA_DO). */
  readonly lupa: number;
  /** Hlasitosť hudby počas partie v percentách (0 = vypnutá). */
  readonly hudba: number;
  /** Účet AI agenta — jeho spätná väzba je na webe označená a predvolene skrytá. */
  readonly ai: boolean;
}

export const LUPA_OD = 150;
export const LUPA_DO = 400;
export const LUPA_PREDVOLENA = 200;

/** Zväčšenie lupy z requestu — celé percentá v rozsahu nastavenia. */
export function overLupu(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n < LUPA_OD || n > LUPA_DO) throw new ChybaVstupu(`Zväčšenie musí byť ${LUPA_OD} až ${LUPA_DO} %.`);
  return Math.round(n);
}

export const HUDBA_PREDVOLENA = 30;

/** Hlasitosť hudby z requestu — celé percentá 0 – 100. */
export function overHlasitost(v: unknown): number {
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 100) throw new ChybaVstupu("Hlasitosť hudby musí byť 0 až 100 %.");
  return Math.round(v);
}

/** Dohraté partie používateľa — poddotaz nad riadkom `pouzivatelia` (stĺpec id). */
const DOHRATE_SQL = `SELECT COUNT(*) FROM partie_hraci ph JOIN partie pa ON pa.id = ph.partia
  WHERE ph.pouzivatel = pouzivatelia.id AND pa.dohrata = 1`;

const COOKIE = "naex_sid";
const PLATNOST_MS = 30 * 24 * 60 * 60 * 1000;

export function hashHesla(heslo: string): string {
  const sol = randomBytes(16);
  const hash = scryptSync(heslo, sol, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${sol.toString("base64")}$${hash.toString("base64")}`;
}

export function overHeslo(heslo: string, ulozene: string): boolean {
  const [druh, sol, hash] = ulozene.split("$");
  if (druh !== "scrypt" || sol === undefined || hash === undefined) return false;
  const ocakavany = Buffer.from(hash, "base64");
  const skutocny = scryptSync(heslo, Buffer.from(sol, "base64"), ocakavany.length, { N: 16384, r: 8, p: 1 });
  return timingSafeEqual(ocakavany, skutocny);
}

const hashTokenu = (t: string): string => createHash("sha256").update(t).digest("hex");

export function citajCookie(req: IncomingMessage, meno = COOKIE): string | null {
  for (const kus of (req.headers.cookie ?? "").split(";")) {
    const [k, ...v] = kus.trim().split("=");
    if (k === meno) return decodeURIComponent(v.join("="));
  }
  return null;
}

export function cookieRelacie(token: string, bezpecne: boolean): string {
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${PLATNOST_MS / 1000}${bezpecne ? "; Secure" : ""}`;
}

export function cookieOdhlasenia(bezpecne: boolean): string {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${bezpecne ? "; Secure" : ""}`;
}

export class Ucty {
  private readonly db: Db;
  private readonly adminLogin: string;
  /** Náhodný predvolený avatar pre účet bez vlastnej fotky (pozri Avatary). */
  private predvoleny: () => string | null = () => null;

  constructor(db: Db, admin: { readonly login: string; readonly heslo: string | null }) {
    this.db = db;
    this.adminLogin = admin.login;
    this.pripravUrovne(admin);
  }

  /**
   * Pri štarte: účty zo starej schémy (rola „pouzivatel“) dostanú úroveň podľa
   * dohratých partií, admin je len jeden (ostatní bývalí admini sú hráči)
   * a jeho heslo sa nastaví z konfigurácie.
   */
  private pripravUrovne(admin: { readonly login: string; readonly heslo: string | null }): void {
    this.db
      .prepare(
        `UPDATE pouzivatelia SET rola = CASE WHEN (${DOHRATE_SQL}) >= ? THEN 'hrac' ELSE 'navstevnik' END
         WHERE rola NOT IN ('admin', 'subadmin', 'hrac', 'navstevnik')`,
      )
      .run(PARTII_NA_HRACA);
    this.db.prepare("UPDATE pouzivatelia SET rola = 'hrac' WHERE rola = 'admin' AND login <> ?").run(admin.login);
    if (admin.heslo === null) return;
    const r = this.db.prepare("SELECT id, heslo FROM pouzivatelia WHERE login = ?").get(admin.login) as
      | { id: number; heslo: string }
      | undefined;
    if (r === undefined) {
      this.db
        .prepare("INSERT INTO pouzivatelia (login, heslo, meno, rola, vytvoreny) VALUES (?, ?, ?, 'admin', ?)")
        .run(admin.login, hashHesla(admin.heslo), admin.login, Date.now());
      return;
    }
    // Heslo z konfigurácie platí — zmena NAEX_ADMIN_HESLO sa prejaví pri ďalšom štarte.
    if (!overHeslo(admin.heslo, r.heslo)) this.db.prepare("UPDATE pouzivatelia SET heslo = ? WHERE id = ?").run(hashHesla(admin.heslo), r.id);
    this.db.prepare("UPDATE pouzivatelia SET rola = 'admin' WHERE id = ?").run(r.id);
  }

  /** Počet partií, ktoré hráč dohral podľa pravidiel (bez vzdaných a kontumovaných). */
  dohrate(id: number): number {
    return (this.db.prepare(`SELECT (${DOHRATE_SQL}) AS n FROM pouzivatelia WHERE id = ?`).get(id) as { n: number } | undefined)?.n ?? 0;
  }

  /** Po zápise partie: návštevník s dosť dohratými partiami sa stáva hráčom. */
  povysPoPartii(id: number): void {
    this.db
      .prepare(`UPDATE pouzivatelia SET rola = 'hrac' WHERE id = ? AND rola = 'navstevnik' AND (${DOHRATE_SQL}) >= ?`)
      .run(id, PARTII_NA_HRACA);
  }

  private riadok(r: Record<string, unknown> | undefined): Pouzivatel | null {
    if (r === undefined) return null;
    return {
      id: Number(r.id),
      login: String(r.login),
      meno: String(r.meno),
      avatar: r.avatar === null ? null : String(r.avatar),
      rola: rolaZDb(r.rola),
      lupa: r.lupa === null || r.lupa === undefined ? LUPA_PREDVOLENA : Number(r.lupa),
      hudba: r.hudba === null || r.hudba === undefined ? HUDBA_PREDVOLENA : Number(r.hudba),
      ai: Number(r.ai) === 1,
    };
  }

  podlaId(id: number): Pouzivatel | null {
    return this.riadok(
      this.db.prepare("SELECT id, login, meno, avatar, rola, lupa, hudba, ai FROM pouzivatelia WHERE id = ?").get(id) as
        | Record<string, unknown>
        | undefined,
    );
  }

  /**
   * Predvolené avatary: účty bez fotky ich dostanú hneď, nové pri
   * registrácii a po zmazaní fotky.
   */
  pouziPredvoleneAvatary(nahodny: () => string | null): void {
    this.predvoleny = nahodny;
    const bez = this.db.prepare("SELECT id FROM pouzivatelia WHERE avatar IS NULL").all() as { id: number }[];
    for (const { id } of bez) this.db.prepare("UPDATE pouzivatelia SET avatar = ? WHERE id = ?").run(nahodny(), id);
  }

  predvolenyAvatar(): string | null {
    return this.predvoleny();
  }

  registruj(login: string, heslo: string, meno: string, teraz: number): Pouzivatel {
    const existuje = this.db.prepare("SELECT 1 FROM pouzivatelia WHERE login = ?").get(login);
    // Meno admina je rezervované, aj kým ho konfigurácia nezaložila.
    if (existuje !== undefined || login.toLowerCase() === this.adminLogin.toLowerCase()) {
      throw new ChybaVstupu("Toto prihlasovacie meno je obsadené.");
    }
    const r = this.db
      .prepare("INSERT INTO pouzivatelia (login, heslo, meno, avatar, rola, vytvoreny) VALUES (?, ?, ?, ?, 'navstevnik', ?)")
      .run(login, hashHesla(heslo), meno, this.predvoleny(), teraz);
    const p = this.podlaId(Number(r.lastInsertRowid));
    if (p === null) throw new Error("Účet sa nepodarilo vytvoriť.");
    return p;
  }

  prihlas(login: string, heslo: string): Pouzivatel | null {
    const r = this.db.prepare("SELECT id, heslo FROM pouzivatelia WHERE login = ?").get(login) as
      | { id: number; heslo: string }
      | undefined;
    // Pri neznámom mene sa heslo aj tak „overí“, aby čas odpovede neprezradil účty.
    const ok = overHeslo(heslo, r?.heslo ?? hashHesla("x"));
    if (r === undefined || !ok) return null;
    return this.podlaId(r.id);
  }

  zmenHeslo(id: number, stare: string, nove: string): void {
    const r = this.db.prepare("SELECT heslo FROM pouzivatelia WHERE id = ?").get(id) as { heslo: string } | undefined;
    if (r === undefined || !overHeslo(stare, r.heslo)) throw new ChybaVstupu("Súčasné heslo nesedí.");
    this.db.prepare("UPDATE pouzivatelia SET heslo = ? WHERE id = ?").run(hashHesla(nove), id);
  }

  novaRelacia(id: number, teraz: number): string {
    const token = randomBytes(32).toString("base64url");
    this.db.prepare("DELETE FROM relacie WHERE plati_do < ?").run(teraz);
    this.db.prepare("INSERT INTO relacie (token, pouzivatel, plati_do) VALUES (?, ?, ?)").run(hashTokenu(token), id, teraz + PLATNOST_MS);
    return token;
  }

  zrusRelaciu(token: string): void {
    this.db.prepare("DELETE FROM relacie WHERE token = ?").run(hashTokenu(token));
  }

  zRequestu(req: IncomingMessage, teraz: number): Pouzivatel | null {
    const token = citajCookie(req);
    if (token === null) return null;
    const r = this.db.prepare("SELECT pouzivatel, plati_do FROM relacie WHERE token = ?").get(hashTokenu(token)) as
      | { pouzivatel: number; plati_do: number }
      | undefined;
    if (r === undefined || r.plati_do < teraz) return null;
    return this.podlaId(r.pouzivatel);
  }

  upravProfil(id: number, zmeny: { meno?: string; avatar?: string | null; lupa?: number; hudba?: number }): Pouzivatel | null {
    if (zmeny.meno !== undefined) this.db.prepare("UPDATE pouzivatelia SET meno = ? WHERE id = ?").run(zmeny.meno, id);
    if (zmeny.lupa !== undefined) this.db.prepare("UPDATE pouzivatelia SET lupa = ? WHERE id = ?").run(zmeny.lupa, id);
    if (zmeny.hudba !== undefined) this.db.prepare("UPDATE pouzivatelia SET hudba = ? WHERE id = ?").run(zmeny.hudba, id);
    if (zmeny.avatar !== undefined) this.db.prepare("UPDATE pouzivatelia SET avatar = ? WHERE id = ?").run(zmeny.avatar, id);
    return this.podlaId(id);
  }

  zoznam(): (Pouzivatel & { vytvoreny: number; dohrate: number })[] {
    const rows = this.db
      .prepare(`SELECT id, login, meno, avatar, rola, ai, vytvoreny, (${DOHRATE_SQL}) AS dohrate FROM pouzivatelia ORDER BY id`)
      .all() as Record<string, unknown>[];
    return rows.map((r) => ({ ...(this.riadok(r) as Pouzivatel), vytvoreny: Number(r.vytvoreny), dohrate: Number(r.dohrate) }));
  }

  nastavRolu(id: number, rola: Rola): void {
    this.db.prepare("UPDATE pouzivatelia SET rola = ? WHERE id = ?").run(rola, id);
  }

  nastavAi(id: number, ai: boolean): void {
    this.db.prepare("UPDATE pouzivatelia SET ai = ? WHERE id = ?").run(ai ? 1 : 0, id);
  }
}

/** Chyba spôsobená vstupom používateľa — správa ide priamo do UI. */
export class ChybaVstupu extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export function overLogin(login: unknown): string {
  if (typeof login !== "string" || !/^[a-zA-Z0-9._-]{3,32}$/.test(login.trim())) {
    throw new ChybaVstupu("Prihlasovacie meno: 3 – 32 znakov, písmená bez diakritiky, čísla, bodka, pomlčka.");
  }
  return login.trim();
}

export function overHesloVstup(heslo: unknown): string {
  if (typeof heslo !== "string" || heslo.length < 8 || heslo.length > 200) {
    throw new ChybaVstupu("Heslo musí mať aspoň 8 znakov.");
  }
  return heslo;
}

export function overMeno(meno: unknown): string {
  const m = typeof meno === "string" ? meno.trim().replace(/\s+/g, " ") : "";
  if (m.length < 2 || m.length > 24) throw new ChybaVstupu("Herné meno musí mať 2 – 24 znakov.");
  if (/[<>]/.test(m)) throw new ChybaVstupu("Herné meno nesmie obsahovať < ani >.");
  return m;
}

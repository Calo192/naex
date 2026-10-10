// Účty a relácie: meno + heslo (scrypt z node:crypto), relácia v HttpOnly
// cookie. V databáze je len hash tokenu — únik databázy neprezradí relácie.
// Admin je účet uvedený v NAEX_ADMINS (alebo povýšený iným adminom).

import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { IncomingMessage } from "node:http";
import type { Db } from "./db.ts";

export type Rola = "admin" | "pouzivatel";

export interface Pouzivatel {
  readonly id: number;
  readonly login: string;
  readonly meno: string;
  readonly avatar: string | null;
  readonly rola: Rola;
}

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
  private readonly admini: Set<string>;
  private readonly db: Db;

  constructor(db: Db, admini: readonly string[]) {
    this.db = db;
    this.admini = new Set(admini.map((a) => a.trim().toLowerCase()).filter((a) => a !== ""));
  }

  private riadok(r: Record<string, unknown> | undefined): Pouzivatel | null {
    if (r === undefined) return null;
    return {
      id: Number(r.id),
      login: String(r.login),
      meno: String(r.meno),
      avatar: r.avatar === null ? null : String(r.avatar),
      rola: r.rola === "admin" ? "admin" : "pouzivatel",
    };
  }

  podlaId(id: number): Pouzivatel | null {
    return this.riadok(
      this.db.prepare("SELECT id, login, meno, avatar, rola FROM pouzivatelia WHERE id = ?").get(id) as
        | Record<string, unknown>
        | undefined,
    );
  }

  /** Účet z konfigurácie NAEX_ADMINS dostane rolu admin pri každom prihlásení. */
  private povysAkTreba(p: Pouzivatel): Pouzivatel {
    if (p.rola !== "admin" && this.admini.has(p.login.toLowerCase())) {
      this.db.prepare("UPDATE pouzivatelia SET rola = 'admin' WHERE id = ?").run(p.id);
      return { ...p, rola: "admin" };
    }
    return p;
  }

  registruj(login: string, heslo: string, meno: string, teraz: number): Pouzivatel {
    const existuje = this.db.prepare("SELECT 1 FROM pouzivatelia WHERE login = ?").get(login);
    if (existuje !== undefined) throw new ChybaVstupu("Toto prihlasovacie meno je obsadené.");
    const r = this.db
      .prepare("INSERT INTO pouzivatelia (login, heslo, meno, rola, vytvoreny) VALUES (?, ?, ?, 'pouzivatel', ?)")
      .run(login, hashHesla(heslo), meno, teraz);
    const p = this.podlaId(Number(r.lastInsertRowid));
    if (p === null) throw new Error("Účet sa nepodarilo vytvoriť.");
    return this.povysAkTreba(p);
  }

  prihlas(login: string, heslo: string): Pouzivatel | null {
    const r = this.db.prepare("SELECT id, heslo FROM pouzivatelia WHERE login = ?").get(login) as
      | { id: number; heslo: string }
      | undefined;
    // Pri neznámom mene sa heslo aj tak „overí“, aby čas odpovede neprezradil účty.
    const ok = overHeslo(heslo, r?.heslo ?? hashHesla("x"));
    if (r === undefined || !ok) return null;
    const p = this.podlaId(r.id);
    return p === null ? null : this.povysAkTreba(p);
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

  upravProfil(id: number, zmeny: { meno?: string; avatar?: string | null }): Pouzivatel | null {
    if (zmeny.meno !== undefined) this.db.prepare("UPDATE pouzivatelia SET meno = ? WHERE id = ?").run(zmeny.meno, id);
    if (zmeny.avatar !== undefined) this.db.prepare("UPDATE pouzivatelia SET avatar = ? WHERE id = ?").run(zmeny.avatar, id);
    return this.podlaId(id);
  }

  zoznam(): (Pouzivatel & { vytvoreny: number })[] {
    const rows = this.db.prepare("SELECT id, login, meno, avatar, rola, vytvoreny FROM pouzivatelia ORDER BY id").all() as Record<string, unknown>[];
    return rows.map((r) => ({ ...(this.riadok(r) as Pouzivatel), vytvoreny: Number(r.vytvoreny) }));
  }

  nastavRolu(id: number, rola: Rola): void {
    this.db.prepare("UPDATE pouzivatelia SET rola = ? WHERE id = ?").run(rola, id);
  }

  pocetAdminov(): number {
    return (this.db.prepare("SELECT COUNT(*) AS n FROM pouzivatelia WHERE rola = 'admin'").get() as { n: number }).n;
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

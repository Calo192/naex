// SQLite cez vstavaný node:sqlite — žiadna ďalšia závislosť. Jeden súbor
// v dátovom adresári (NAEX_DATA), schéma sa vytvára pri štarte.
//
// Návrhy a nastavenia sa ukladajú ako JSON v stĺpci `data`: tvar určuje
// @naex/tvorba a databáza ho nemusí poznať. Stĺpce mimo JSON sú len tie,
// podľa ktorých sa hľadá alebo triedi.

import { DatabaseSync } from "node:sqlite";

export type Db = DatabaseSync;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS pouzivatelia (
  id INTEGER PRIMARY KEY,
  login TEXT NOT NULL UNIQUE COLLATE NOCASE,
  heslo TEXT NOT NULL,
  meno TEXT NOT NULL,
  avatar TEXT,
  rola TEXT NOT NULL DEFAULT 'pouzivatel',
  vytvoreny INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS relacie (
  token TEXT PRIMARY KEY,
  pouzivatel INTEGER NOT NULL REFERENCES pouzivatelia(id) ON DELETE CASCADE,
  plati_do INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS media (
  id TEXT PRIMARY KEY,
  typ TEXT NOT NULL,
  druh TEXT NOT NULL,
  nazov TEXT NOT NULL,
  velkost INTEGER NOT NULL,
  vytvorene INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS karty (
  id TEXT PRIMARY KEY,
  poradie INTEGER NOT NULL,
  data TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS akcie (
  kluc TEXT PRIMARY KEY,
  data TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS klucove_slova (
  slovo TEXT PRIMARY KEY,
  data TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS kategorie (
  nazov TEXT PRIMARY KEY,
  data TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS bodovacie_karty (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS ikony_bodovania (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS nastavenia (
  kluc TEXT PRIMARY KEY,
  data TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sady (
  verzia INTEGER PRIMARY KEY AUTOINCREMENT,
  cas INTEGER NOT NULL,
  autor INTEGER,
  data TEXT NOT NULL
);
`;

export function otvorDb(cesta: string): Db {
  const db = new DatabaseSync(cesta);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  db.exec(SCHEMA);
  return db;
}

/** Transakcia — pri výnimke sa všetko vráti. */
export function transakcia<T>(db: Db, fn: () => T): T {
  db.exec("BEGIN");
  try {
    const out = fn();
    db.exec("COMMIT");
    return out;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

/** Jednoduché úložisko JSON dokumentov v tabuľke (kľúč, data). */
export class JsonTabulka<T> {
  constructor(
    private readonly db: Db,
    private readonly tabulka: string,
    private readonly kluc: string,
    private readonly poradie = "rowid",
  ) {}

  vsetky(): T[] {
    const rows = this.db.prepare(`SELECT data FROM ${this.tabulka} ORDER BY ${this.poradie}`).all() as { data: string }[];
    return rows.map((r) => JSON.parse(r.data) as T);
  }

  jeden(id: string): T | null {
    const row = this.db.prepare(`SELECT data FROM ${this.tabulka} WHERE ${this.kluc} = ?`).get(id) as
      | { data: string }
      | undefined;
    return row === undefined ? null : (JSON.parse(row.data) as T);
  }

  uloz(id: string, hodnota: T): void {
    this.db
      .prepare(`INSERT INTO ${this.tabulka} (${this.kluc}, data) VALUES (?, ?) ON CONFLICT(${this.kluc}) DO UPDATE SET data = excluded.data`)
      .run(id, JSON.stringify(hodnota));
  }

  zmaz(id: string): boolean {
    return this.db.prepare(`DELETE FROM ${this.tabulka} WHERE ${this.kluc} = ?`).run(id).changes > 0;
  }

  pocet(): number {
    return (this.db.prepare(`SELECT COUNT(*) AS n FROM ${this.tabulka}`).get() as { n: number }).n;
  }
}

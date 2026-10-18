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
  -- Úroveň účtu: admin | subadmin | hrac | navstevnik (Michal 2026-10-12).
  rola TEXT NOT NULL DEFAULT 'navstevnik',
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

-- Frajerina (hodnotenie hráča, Elo) a archív dohraných partií.
CREATE TABLE IF NOT EXISTS frajerina (
  pouzivatel INTEGER PRIMARY KEY REFERENCES pouzivatelia(id) ON DELETE CASCADE,
  hodnota INTEGER NOT NULL,
  najvyssia INTEGER NOT NULL,
  partie INTEGER NOT NULL DEFAULT 0,
  vyhry INTEGER NOT NULL DEFAULT 0,
  prehry INTEGER NOT NULL DEFAULT 0,
  remizy INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS partie (
  id INTEGER PRIMARY KEY,
  kod TEXT NOT NULL,
  zaciatok INTEGER NOT NULL,
  koniec INTEGER NOT NULL,
  vitaz INTEGER,
  dovod TEXT NOT NULL,
  kola INTEGER NOT NULL,
  verzia_sady INTEGER,
  -- 0 = vzdaná alebo kontumovaná; do povýšenia na hráča sa ráta len dohratá.
  dohrata INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS partie_hraci (
  partia INTEGER NOT NULL REFERENCES partie(id) ON DELETE CASCADE,
  miesto INTEGER NOT NULL,
  pouzivatel INTEGER REFERENCES pouzivatelia(id) ON DELETE SET NULL,
  vysledok TEXT NOT NULL,
  body INTEGER,
  frajerina_pred INTEGER NOT NULL,
  frajerina_po INTEGER NOT NULL,
  statistiky TEXT NOT NULL,
  PRIMARY KEY (partia, miesto)
);
CREATE INDEX IF NOT EXISTS partie_hraci_pouzivatel ON partie_hraci(pouzivatel, partia);

-- Spätná väzba hráčov: názory, komentáre a cigarety (obdoba „páči sa mi“).
CREATE TABLE IF NOT EXISTS nazory (
  id INTEGER PRIMARY KEY,
  autor INTEGER NOT NULL REFERENCES pouzivatelia(id) ON DELETE CASCADE,
  kategoria TEXT NOT NULL,
  text TEXT NOT NULL,
  stav TEXT NOT NULL DEFAULT 'nove',
  vytvoreny INTEGER NOT NULL,
  upraveny INTEGER
);
CREATE TABLE IF NOT EXISTS nazory_komentare (
  id INTEGER PRIMARY KEY,
  nazor INTEGER NOT NULL REFERENCES nazory(id) ON DELETE CASCADE,
  autor INTEGER NOT NULL REFERENCES pouzivatelia(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  vytvoreny INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS nazory_komentare_nazor ON nazory_komentare(nazor);
CREATE TABLE IF NOT EXISTS cigarety_nazorov (
  nazor INTEGER NOT NULL REFERENCES nazory(id) ON DELETE CASCADE,
  pouzivatel INTEGER NOT NULL REFERENCES pouzivatelia(id) ON DELETE CASCADE,
  PRIMARY KEY (nazor, pouzivatel)
);
CREATE TABLE IF NOT EXISTS cigarety_komentarov (
  komentar INTEGER NOT NULL REFERENCES nazory_komentare(id) ON DELETE CASCADE,
  pouzivatel INTEGER NOT NULL REFERENCES pouzivatelia(id) ON DELETE CASCADE,
  PRIMARY KEY (komentar, pouzivatel)
);
`;

export function otvorDb(cesta: string): Db {
  const db = new DatabaseSync(cesta);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  db.exec(SCHEMA);
  migruj(db);
  return db;
}

/** Úpravy databáz vytvorených staršou schémou. */
function migruj(db: Db): void {
  const stlpce = db.prepare("PRAGMA table_info(partie)").all() as { name: string }[];
  if (!stlpce.some((c) => c.name === "dohrata")) {
    db.exec("ALTER TABLE partie ADD COLUMN dohrata INTEGER NOT NULL DEFAULT 1");
    // Staré partie: vzdanie a kontumáciu prezradí len text dôvodu.
    db.exec("UPDATE partie SET dohrata = 0 WHERE dovod LIKE 'Partiu vzdáva%' OR dovod LIKE 'Kontumácia%'");
  }
  // Štatistiky kariet partie (JSON z @naex/core) — staršie partie ich nemajú.
  if (!stlpce.some((c) => c.name === "karty")) db.exec("ALTER TABLE partie ADD COLUMN karty TEXT");
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
  private readonly db: Db;
  private readonly tabulka: string;
  private readonly kluc: string;
  private readonly poradie: string;

  constructor(db: Db, tabulka: string, kluc: string, poradie = "rowid") {
    this.db = db;
    this.tabulka = tabulka;
    this.kluc = kluc;
    this.poradie = poradie;
  }

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

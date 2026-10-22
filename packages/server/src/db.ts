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
  -- Úroveň účtu: admin | subadmin | sedmicka | deci | hrac (Poldeci) | navstevnik (Michal 2026-10-22).
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

-- Návrhy zlepšení z playtestov a rozhodnutia admina o nich (Michal 2026-10-21).
CREATE TABLE IF NOT EXISTS navrhy (
  id INTEGER PRIMARY KEY,
  davka TEXT NOT NULL,
  kluc TEXT NOT NULL,
  poradie INTEGER NOT NULL,
  data TEXT NOT NULL,
  podklady TEXT NOT NULL DEFAULT '[]',
  stav TEXT NOT NULL DEFAULT 'nove',
  volba TEXT,
  poznamka TEXT NOT NULL DEFAULT '',
  rozhodol INTEGER REFERENCES pouzivatelia(id) ON DELETE SET NULL,
  rozhodnuty INTEGER,
  vysledok TEXT NOT NULL DEFAULT '',
  -- Čo ukázal playtest po implementácii (stav overene / nezabralo).
  verdikt TEXT NOT NULL DEFAULT '',
  vytvoreny INTEGER NOT NULL,
  UNIQUE (davka, kluc)
);

-- Známky hry podľa 12 kritérií playtestu (Michal 2026-10-21). Každá zmena je
-- nový riadok: priemer k dátumu sa počíta z posledných známok každého hodnotiteľa.
CREATE TABLE IF NOT EXISTS znamky (
  id INTEGER PRIMARY KEY,
  pouzivatel INTEGER NOT NULL REFERENCES pouzivatelia(id) ON DELETE CASCADE,
  cas INTEGER NOT NULL,
  -- JSON {kriterium: 1–10}; kritérium, ku ktorému hodnotiteľ nemá názor, chýba.
  data TEXT NOT NULL,
  -- Odkiaľ známky sú (napr. playtest „20261021-041728“); '' = hráč na webe.
  zdroj TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS znamky_cas ON znamky(cas);
CREATE UNIQUE INDEX IF NOT EXISTS znamky_zdroj ON znamky(pouzivatel, zdroj) WHERE zdroj <> '';

-- Roadmapa (Michal 2026-10-21): stĺpce sú horizonty, poradie v stĺpci je priorita.
CREATE TABLE IF NOT EXISTS roadmapa (
  id INTEGER PRIMARY KEY,
  stlpec TEXT NOT NULL,
  -- Zlomkové poradie: presun je jeden UPDATE bez prečíslovania stĺpca.
  poradie REAL NOT NULL,
  data TEXT NOT NULL,
  navrh INTEGER REFERENCES navrhy(id) ON DELETE SET NULL,
  verejna INTEGER NOT NULL DEFAULT 1,
  vytvorena INTEGER NOT NULL,
  upravena INTEGER NOT NULL,
  dokoncena INTEGER
);
CREATE INDEX IF NOT EXISTS roadmapa_stlpec ON roadmapa(stlpec, poradie);

-- Tempo partií (roadmapa #9, Michal 2026-10-22): čas a príkazy po fázach,
-- aj partie s botom a vzdané. fazy = JSON { faza: { prikazy: [p0, p1], ms: [p0, p1] } }.
CREATE TABLE IF NOT EXISTS tempo_partii (
  id INTEGER PRIMARY KEY,
  kod TEXT NOT NULL,
  zaciatok INTEGER NOT NULL,
  koniec INTEGER NOT NULL,
  dlzka TEXT NOT NULL,
  s_botom INTEGER NOT NULL,
  ai INTEGER NOT NULL,
  dohrata INTEGER NOT NULL,
  kola INTEGER NOT NULL,
  bitky INTEGER NOT NULL,
  pitky INTEGER NOT NULL,
  prikazy INTEGER NOT NULL,
  fazy TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS tempo_partii_koniec ON tempo_partii(koniec);

-- Novinky (Michal 2026-10-22): zmeny, ktoré sú už na živom webe, pre hráčov.
-- datum = deň zmeny (RRRR-MM-DD); odkaz = cesta na webe alebo ''.
CREATE TABLE IF NOT EXISTS novinky (
  id INTEGER PRIMARY KEY,
  datum TEXT NOT NULL,
  kategoria TEXT NOT NULL,
  nadpis TEXT NOT NULL,
  text TEXT NOT NULL,
  odkaz TEXT NOT NULL DEFAULT '',
  autor INTEGER REFERENCES pouzivatelia(id) ON DELETE SET NULL,
  vytvorena INTEGER NOT NULL,
  upravena INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS novinky_datum ON novinky(datum);
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
  // Zber dát pre profily (Michal 2026-10-22): partie s botom (hráč bota má pouzivatel NULL),
  // dĺžka, verzia jadra (commit) a pravidiel, seed + príkazy na budúci prehrávač, kronika po kolách.
  const novePartie: readonly [string, string][] = [
    ["s_botom", "INTEGER NOT NULL DEFAULT 0"],
    ["bot_povaha", "TEXT"],
    ["dlzka", "TEXT"],
    ["verzia_jadra", "TEXT"],
    ["verzia_pravidiel", "TEXT"],
    ["seed", "INTEGER"],
    ["prikazy", "TEXT"],
    ["kronika", "TEXT"],
  ];
  for (const [meno, typ] of novePartie) if (!stlpce.some((c) => c.name === meno)) db.exec(`ALTER TABLE partie ADD COLUMN ${meno} ${typ}`);
  // Zväčšenie karty pri prejdení myšou v percentách (Michal 2026-10-19); NULL = predvolené.
  // Náhľad média (Michal 2026-10-22, rýchlosť živého webu): menšia kópia, ktorú
  // vyrobí prehliadač admina — /media/<id>?n ju pošle namiesto originálu.
  const mediaStlpce = db.prepare("PRAGMA table_info(media)").all() as { name: string }[];
  if (!mediaStlpce.some((c) => c.name === "nahlad")) db.exec("ALTER TABLE media ADD COLUMN nahlad TEXT");
  const ucty = db.prepare("PRAGMA table_info(pouzivatelia)").all() as { name: string }[];
  if (!ucty.some((c) => c.name === "lupa")) db.exec("ALTER TABLE pouzivatelia ADD COLUMN lupa INTEGER");
  // Hlasitosť hudby počas partie v percentách (Michal 2026-10-20); NULL = predvolená.
  if (!ucty.some((c) => c.name === "hudba")) db.exec("ALTER TABLE pouzivatelia ADD COLUMN hudba INTEGER");
  // Účet AI agenta (playtester, protihráč, admin) — jeho spätná väzba je
  // predvolene skrytá (Michal 2026-10-21). Nastavuje len admin.
  if (!ucty.some((c) => c.name === "ai")) db.exec("ALTER TABLE pouzivatelia ADD COLUMN ai INTEGER NOT NULL DEFAULT 0");
  // Farebná schéma webu (Michal 2026-10-21); NULL = predvolená Krčma.
  if (!ucty.some((c) => c.name === "schema")) db.exec("ALTER TABLE pouzivatelia ADD COLUMN schema TEXT");
  // Zobrazenie skóre v partii (Michal 2026-10-22): dlazdice / spolocny / dva; NULL = dlaždice.
  if (!ucty.some((c) => c.name === "skore")) db.exec("ALTER TABLE pouzivatelia ADD COLUMN skore TEXT");
  // Klávesové skratky v partii (Michal 2026-10-22, roadmapa #19): 0 = vypnuté, NULL = zapnuté.
  if (!ucty.some((c) => c.name === "skratky")) db.exec("ALTER TABLE pouzivatelia ADD COLUMN skratky INTEGER");
  // Ranky (Michal 2026-10-22): 1 = rank nastavil správca ručne, automatický postup ho nemení.
  if (!ucty.some((c) => c.name === "rola_rucne")) db.exec("ALTER TABLE pouzivatelia ADD COLUMN rola_rucne INTEGER NOT NULL DEFAULT 0");
  // Hlášky majstra Melichara v partii proti počítaču (Michal 2026-10-21): hlasitosť
  // a frekvencia v percentách; NULL = predvolené.
  if (!ucty.some((c) => c.name === "melichar")) db.exec("ALTER TABLE pouzivatelia ADD COLUMN melichar INTEGER");
  if (!ucty.some((c) => c.name === "melichar_frekvencia")) db.exec("ALTER TABLE pouzivatelia ADD COLUMN melichar_frekvencia INTEGER");
  // Kedy hráč naposledy otvoril Novinky — značka v navigácii (Michal 2026-10-22); NULL = od registrácie.
  if (!ucty.some((c) => c.name === "novinky_videne")) db.exec("ALTER TABLE pouzivatelia ADD COLUMN novinky_videne INTEGER");
  // Pohlavie pre tvary hlášok v partii (Michal 2026-10-22): muz / zena; NULL = neuvádza (neutrálne hlášky).
  if (!ucty.some((c) => c.name === "pohlavie")) db.exec("ALTER TABLE pouzivatelia ADD COLUMN pohlavie TEXT");
  // Verdikt overenia návrhu ďalším playtestom (Michal 2026-10-21).
  const navrhy = db.prepare("PRAGMA table_info(navrhy)").all() as { name: string }[];
  if (!navrhy.some((c) => c.name === "verdikt")) db.exec("ALTER TABLE navrhy ADD COLUMN verdikt TEXT NOT NULL DEFAULT ''");
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

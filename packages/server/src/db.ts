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
  upraveny INTEGER,
  nadpis TEXT NOT NULL DEFAULT '',
  dovod TEXT NOT NULL DEFAULT '',
  novinka INTEGER REFERENCES novinky(id) ON DELETE SET NULL
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
  upravena INTEGER NOT NULL,
  vydanie TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS novinky_datum ON novinky(datum);

-- Dielňa (Michal 2026-10-22): návrhy kariet od hráčov. data = obsah návrhu (JSON),
-- zaklad_karta = podoba upravovanej karty v čase návrhu, prevzate = obsah pri
-- schválení (podľa neho glosár pozná, či admin kartu prerobil).
CREATE TABLE IF NOT EXISTS dielna_navrhy (
  id INTEGER PRIMARY KEY,
  autor INTEGER NOT NULL REFERENCES pouzivatelia(id) ON DELETE CASCADE,
  typ TEXT NOT NULL,
  zaklad TEXT,
  zaklad_karta TEXT,
  data TEXT NOT NULL,
  stav TEXT NOT NULL,
  dovod TEXT NOT NULL DEFAULT '',
  skryty INTEGER NOT NULL DEFAULT 0,
  karta_id TEXT,
  prevzate TEXT,
  vytvoreny INTEGER NOT NULL,
  upraveny INTEGER NOT NULL,
  odoslany INTEGER,
  posudeny INTEGER,
  posudil INTEGER,
  autor_videne INTEGER
);
CREATE INDEX IF NOT EXISTS dielna_navrhy_autor ON dielna_navrhy(autor, stav);
CREATE TABLE IF NOT EXISTS dielna_cigarety (
  navrh INTEGER NOT NULL REFERENCES dielna_navrhy(id) ON DELETE CASCADE,
  pouzivatel INTEGER NOT NULL REFERENCES pouzivatelia(id) ON DELETE CASCADE,
  cas INTEGER NOT NULL,
  PRIMARY KEY (navrh, pouzivatel)
);
CREATE TABLE IF NOT EXISTS dielna_komentare (
  id INTEGER PRIMARY KEY,
  navrh INTEGER NOT NULL REFERENCES dielna_navrhy(id) ON DELETE CASCADE,
  autor INTEGER NOT NULL REFERENCES pouzivatelia(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  vytvoreny INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS dielna_nahlasenia (
  navrh INTEGER NOT NULL REFERENCES dielna_navrhy(id) ON DELETE CASCADE,
  pouzivatel INTEGER NOT NULL REFERENCES pouzivatelia(id) ON DELETE CASCADE,
  dovod TEXT NOT NULL,
  cas INTEGER NOT NULL,
  PRIMARY KEY (navrh, pouzivatel)
);
-- Kontrolné otázky výučby (Michal 2026-10-23, UX N2): prvá odpoveď hráča na otázku — metrika.
CREATE TABLE IF NOT EXISTS vyucba_odpovede (
  pouzivatel INTEGER NOT NULL REFERENCES pouzivatelia(id) ON DELETE CASCADE,
  krok TEXT NOT NULL,
  odpoved INTEGER NOT NULL,
  spravna INTEGER NOT NULL,
  cas INTEGER NOT NULL,
  PRIMARY KEY (pouzivatel, krok)
);
-- Achievementy (Michal 2026-10-23): získané ranky, súčty kariéry a množiny „rôznych“
-- (povahy, súperi) — rátané od spustenia, nič spätne. proti = ludia | bot | vsetky.
CREATE TABLE IF NOT EXISTS achievementy_zisky (
  pouzivatel INTEGER NOT NULL REFERENCES pouzivatelia(id) ON DELETE CASCADE,
  achievement TEXT NOT NULL,
  rank INTEGER NOT NULL,
  ziskane INTEGER NOT NULL,
  miestnost TEXT NOT NULL,
  partia INTEGER,
  PRIMARY KEY (pouzivatel, achievement, rank)
);
CREATE INDEX IF NOT EXISTS achievementy_zisky_miestnost ON achievementy_zisky(miestnost);
CREATE TABLE IF NOT EXISTS achievementy_kariera (
  pouzivatel INTEGER NOT NULL REFERENCES pouzivatelia(id) ON DELETE CASCADE,
  proti TEXT NOT NULL,
  kluc TEXT NOT NULL,
  hodnota REAL NOT NULL,
  aktualna REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (pouzivatel, proti, kluc)
);
CREATE TABLE IF NOT EXISTS achievementy_rozne (
  pouzivatel INTEGER NOT NULL REFERENCES pouzivatelia(id) ON DELETE CASCADE,
  proti TEXT NOT NULL,
  kluc TEXT NOT NULL,
  stitok TEXT NOT NULL,
  PRIMARY KEY (pouzivatel, proti, kluc, stitok)
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
  if (!stlpceTabulky(db, "partie").has("dohrata")) {
    db.exec("ALTER TABLE partie ADD COLUMN dohrata INTEGER NOT NULL DEFAULT 1");
    // Staré partie: vzdanie a kontumáciu prezradí len text dôvodu.
    db.exec("UPDATE partie SET dohrata = 0 WHERE dovod LIKE 'Partiu vzdáva%' OR dovod LIKE 'Kontumácia%'");
  }
  doplnStlpce(db, "partie", [
    // Štatistiky kariet partie (JSON z @naex/core) — staršie partie ich nemajú.
    ["karty", "TEXT"],
    // Zber dát pre profily (Michal 2026-10-22): partie s botom (hráč bota má pouzivatel NULL),
    // dĺžka, verzia jadra (commit) a pravidiel, seed + príkazy na budúci prehrávač, kronika po kolách.
    ["s_botom", "INTEGER NOT NULL DEFAULT 0"],
    ["bot_povaha", "TEXT"],
    ["dlzka", "TEXT"],
    ["verzia_jadra", "TEXT"],
    ["verzia_pravidiel", "TEXT"],
    ["seed", "INTEGER"],
    ["prikazy", "TEXT"],
    ["kronika", "TEXT"],
  ]);
  doplnStlpce(db, "media", [
    // Náhľad média (Michal 2026-10-22, rýchlosť živého webu): menšia kópia, ktorú
    // vyrobí prehliadač admina — /media/<id>?n ju pošle namiesto originálu.
    ["nahlad", "TEXT"],
  ]);
  doplnStlpce(db, "pouzivatelia", [
    // Zväčšenie karty pri prejdení myšou v percentách (Michal 2026-10-19); NULL = predvolené.
    ["lupa", "INTEGER"],
    // Hlasitosť hudby počas partie v percentách (Michal 2026-10-20); NULL = predvolená.
    ["hudba", "INTEGER"],
    // Účet AI agenta (playtester, protihráč, admin) — jeho spätná väzba je
    // predvolene skrytá (Michal 2026-10-21). Nastavuje len admin.
    ["ai", "INTEGER NOT NULL DEFAULT 0"],
    // Farebná schéma webu (Michal 2026-10-21); NULL = predvolená Krčma.
    ["schema", "TEXT"],
    // Pár farieb hráča v partii (Michal 2026-10-27): "w20", s ⇄ "w20-prehod"; NULL = predvolený.
    // Len pre jeho prehliadač — súperovi sa neposiela.
    ["par", "TEXT"],
    // Zobrazenie skóre v partii (Michal 2026-10-22) — od roadmapy #70 sú body len dlaždice
    // a stĺpec sa nečíta; ostáva, aby staré databázy nemuseli meniť tabuľku.
    ["skore", "TEXT"],
    // Klávesové skratky v partii (Michal 2026-10-22, roadmapa #19): 0 = vypnuté, NULL = zapnuté.
    ["skratky", "INTEGER"],
    // Medziobrazovky pri prechode fáz v partii (Michal 2026-10-27): 0 = vypnuté, NULL = zapnuté.
    ["medziobrazovky", "INTEGER"],
    // Ranky (Michal 2026-10-22): 1 = rank nastavil správca ručne, automatický postup ho nemení.
    ["rola_rucne", "INTEGER NOT NULL DEFAULT 0"],
    // Hlášky majstra Melichara v partii proti počítaču (Michal 2026-10-21): hlasitosť
    // v percentách; NULL = predvolené. Stĺpec melichar_frekvencia v starších
    // databázach sa od 2026-10-23 nečíta — Melichar sa ozve len pri momente.
    ["melichar", "INTEGER"],
    // Výučba „Prvá hra“ (Michal 2026-10-23): koľko krokov scenára hráč prešiel
    // a či ju dokončil alebo preskočil (NULL = ešte nie).
    ["vyucba_krok", "INTEGER NOT NULL DEFAULT 0"],
    ["vyucba_stav", "TEXT"],
    // Verzia scenára, na ktorého kroky sedí vyucba_krok (výučba po častiach, 2026-10-25); NULL = starší scenár.
    ["vyucba_verzia", "TEXT"],
    // Id kroku na indexe vyucba_krok (výučba v troch častiach, 2026-10-28): postup prežije zmenu scenára.
    ["vyucba_krok_id", "TEXT"],
    // Nápovedy Melichara v partii (Michal 2026-10-24): 0 = vypnuté, NULL = zapnuté;
    // videné = JSON pole id z napovedy.json (každá sa ukáže len raz, reset v profile).
    ["napovedy", "INTEGER"],
    ["napovedy_videne", "TEXT"],
    // Kedy hráč naposledy otvoril Novinky — značka v navigácii (Michal 2026-10-22); NULL = od registrácie.
    ["novinky_videne", "INTEGER"],
    // Pohlavie pre tvary hlášok v partii (Michal 2026-10-22): muz / zena; NULL = neuvádza (neutrálne hlášky).
    ["pohlavie", "TEXT"],
    // Profil (Michal 2026-10-22): „skryť môj súhrn“ pred ostatnými; hodnotenie (Frajerina) ostáva viditeľné.
    ["skryty_suhrn", "INTEGER NOT NULL DEFAULT 0"],
  ]);
  // Verdikt overenia návrhu ďalším playtestom (Michal 2026-10-21).
  doplnStlpce(db, "navrhy", [["verdikt", "TEXT NOT NULL DEFAULT ''"]]);
  // Vydanie novinky (Michal 2026-10-27), napr. „Pravidlá v6“ — nadpis dňa v Novinkách; '' = len dátum.
  doplnStlpce(db, "novinky", [["vydanie", "TEXT NOT NULL DEFAULT ''"]]);
  doplnStlpce(db, "nazory", [
    // Spätná väzba S-A (Michal 2026-10-27): voliteľný nadpis „Jednou vetou“ ('' = staré názory
    // ukážu prvú vetu), prečo „nebudeme robiť“ a novinka, v ktorej je „hotovo“.
    ["nadpis", "TEXT NOT NULL DEFAULT ''"],
    ["dovod", "TEXT NOT NULL DEFAULT ''"],
    ["novinka", "INTEGER REFERENCES novinky(id) ON DELETE SET NULL"],
  ]);
}

function stlpceTabulky(db: Db, tabulka: string): Set<string> {
  return new Set((db.prepare(`PRAGMA table_info(${tabulka})`).all() as { name: string }[]).map((c) => c.name));
}

/** Pridá stĺpce, ktoré tabuľka zo staršej schémy ešte nemá — v poradí zoznamu. */
function doplnStlpce(db: Db, tabulka: string, stlpce: readonly (readonly [meno: string, typ: string])[]): void {
  const ma = stlpceTabulky(db, tabulka);
  for (const [meno, typ] of stlpce) if (!ma.has(meno)) db.exec(`ALTER TABLE ${tabulka} ADD COLUMN ${meno} ${typ}`);
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

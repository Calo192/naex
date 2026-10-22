// Spätná väzba hráčov: názory na hru, komentáre k nim a cigarety.
//
// Cigareta je v NA EX! obdoba „páči sa mi“ — jeden hráč dá jednému názoru
// či komentáru najviac jednu a vlastnému nič. Upravovať a mazať smie autor,
// mazať a meniť stav (prijaté / plánované / hotové…) aj admin.

import type { Db } from "./db.ts";
import type { Pouzivatel } from "./auth.ts";
import { ChybaVstupu, jeSpravca } from "./auth.ts";
import { Prava } from "./prava.ts";

export const KATEGORIE = ["pravidla", "karty", "hranie", "web", "chyba", "napad", "ine"] as const;
export type KategoriaNazoru = (typeof KATEGORIE)[number];

export const STAVY = ["nove", "prijate", "planovane", "hotove", "zamietnute"] as const;
export type StavNazoru = (typeof STAVY)[number];

export const MAX_NAZOR = 3000;
export const MAX_KOMENTAR = 1000;

interface Autor {
  readonly id: number;
  readonly meno: string;
  readonly avatar: string | null;
  readonly rola: string;
  /** Účet AI agenta — klient jeho príspevky predvolene skrýva. */
  readonly ai: boolean;
}

export interface Komentar {
  readonly id: number;
  readonly autor: Autor;
  readonly text: string;
  readonly vytvoreny: number;
  readonly cigarety: number;
  readonly mojaCigareta: boolean;
}

export interface Nazor {
  readonly id: number;
  readonly autor: Autor;
  readonly kategoria: KategoriaNazoru;
  readonly text: string;
  readonly stav: StavNazoru;
  readonly vytvoreny: number;
  readonly upraveny: number | null;
  readonly cigarety: number;
  readonly mojaCigareta: boolean;
  readonly komentare: readonly Komentar[];
}

export type Triedenie = "nove" | "cigarety" | "diskusia";

/** Brzda proti záplave: najviac N príspevkov za 10 minút. */
const OKNO_MS = 10 * 60 * 1000;
const LIMIT_NAZOROV = 5;
const LIMIT_KOMENTAROV = 20;

function overText(v: unknown, max: number, pole: string): string {
  const t = typeof v === "string" ? v.replace(/\r\n/g, "\n").trim() : "";
  if (t.length < 3) throw new ChybaVstupu(`${pole}: napíš aspoň pár slov.`);
  if (t.length > max) throw new ChybaVstupu(`${pole}: najviac ${max} znakov.`);
  return t;
}

export function overKategoriu(v: unknown): KategoriaNazoru {
  if (typeof v === "string" && (KATEGORIE as readonly string[]).includes(v)) return v as KategoriaNazoru;
  throw new ChybaVstupu("Neznáma kategória.");
}

export function overStav(v: unknown): StavNazoru {
  if (typeof v === "string" && (STAVY as readonly string[]).includes(v)) return v as StavNazoru;
  throw new ChybaVstupu("Neznámy stav.");
}

export class Nazory {
  private readonly db: Db;

  /** Kto smie písať, komentovať a dávať cigarety — matica práv rankov (Michal 2026-10-22). */
  private readonly prava: Prava;

  constructor(db: Db, prava: Prava = new Prava(db)) {
    this.prava = prava;
    this.db = db;
  }

  zoznam(ja: Pouzivatel, triedenie: Triedenie, kategoria: KategoriaNazoru | null): Nazor[] {
    const poradie =
      triedenie === "cigarety"
        ? "cigarety DESC, n.id DESC"
        : triedenie === "diskusia"
          ? "komentarov DESC, n.id DESC"
          : "n.id DESC";
    const riadky = this.db
      .prepare(
        `SELECT n.id, n.kategoria, n.text, n.stav, n.vytvoreny, n.upraveny,
                u.id AS autor_id, u.meno AS autor_meno, u.avatar AS autor_avatar, u.rola AS autor_rola, u.ai AS autor_ai,
                (SELECT COUNT(*) FROM cigarety_nazorov c WHERE c.nazor = n.id) AS cigarety,
                (SELECT COUNT(*) FROM cigarety_nazorov c WHERE c.nazor = n.id AND c.pouzivatel = ?) AS moja,
                (SELECT COUNT(*) FROM nazory_komentare k WHERE k.nazor = n.id) AS komentarov
         FROM nazory n JOIN pouzivatelia u ON u.id = n.autor
         WHERE (? IS NULL OR n.kategoria = ?)
         ORDER BY ${poradie}
         LIMIT 200`,
      )
      .all(ja.id, kategoria, kategoria) as Record<string, unknown>[];
    if (riadky.length === 0) return [];

    const ids = riadky.map((r) => Number(r.id));
    const komentare = this.db
      .prepare(
        `SELECT k.id, k.nazor, k.text, k.vytvoreny,
                u.id AS autor_id, u.meno AS autor_meno, u.avatar AS autor_avatar, u.rola AS autor_rola, u.ai AS autor_ai,
                (SELECT COUNT(*) FROM cigarety_komentarov c WHERE c.komentar = k.id) AS cigarety,
                (SELECT COUNT(*) FROM cigarety_komentarov c WHERE c.komentar = k.id AND c.pouzivatel = ?) AS moja
         FROM nazory_komentare k JOIN pouzivatelia u ON u.id = k.autor
         WHERE k.nazor IN (${ids.map(() => "?").join(",")})
         ORDER BY k.id`,
      )
      .all(ja.id, ...ids) as Record<string, unknown>[];
    const podlaNazoru = new Map<number, Komentar[]>();
    for (const k of komentare) {
      const zoz = podlaNazoru.get(Number(k.nazor)) ?? [];
      zoz.push({
        id: Number(k.id),
        autor: autorZ(k),
        text: String(k.text),
        vytvoreny: Number(k.vytvoreny),
        cigarety: Number(k.cigarety),
        mojaCigareta: Number(k.moja) > 0,
      });
      podlaNazoru.set(Number(k.nazor), zoz);
    }

    return riadky.map((r) => ({
      id: Number(r.id),
      autor: autorZ(r),
      kategoria: r.kategoria as KategoriaNazoru,
      text: String(r.text),
      stav: r.stav as StavNazoru,
      vytvoreny: Number(r.vytvoreny),
      upraveny: r.upraveny === null ? null : Number(r.upraveny),
      cigarety: Number(r.cigarety),
      mojaCigareta: Number(r.moja) > 0,
      komentare: podlaNazoru.get(Number(r.id)) ?? [],
    }));
  }

  private brzda(tabulka: "nazory" | "nazory_komentare", autor: number, teraz: number, limit: number): void {
    const r = this.db.prepare(`SELECT COUNT(*) AS n FROM ${tabulka} WHERE autor = ? AND vytvoreny > ?`).get(autor, teraz - OKNO_MS) as { n: number };
    if (r.n >= limit) throw new ChybaVstupu("Píšeš príliš rýchlo. Daj si poldeci a skús to o chvíľu.", 429);
  }

  pridaj(ja: Pouzivatel, kategoria: unknown, text: unknown, teraz: number): number {
    this.prava.vyzaduj(ja, "spatna_vazba_pisat");
    const k = overKategoriu(kategoria);
    const t = overText(text, MAX_NAZOR, "Názor");
    this.brzda("nazory", ja.id, teraz, LIMIT_NAZOROV);
    const r = this.db.prepare("INSERT INTO nazory (autor, kategoria, text, vytvoreny) VALUES (?, ?, ?, ?)").run(ja.id, k, t, teraz);
    return Number(r.lastInsertRowid);
  }

  private autorNazoru(id: number): number {
    const r = this.db.prepare("SELECT autor FROM nazory WHERE id = ?").get(id) as { autor: number } | undefined;
    if (r === undefined) throw new ChybaVstupu("Taký názor neexistuje.", 404);
    return r.autor;
  }

  private autorKomentara(id: number): number {
    const r = this.db.prepare("SELECT autor FROM nazory_komentare WHERE id = ?").get(id) as { autor: number } | undefined;
    if (r === undefined) throw new ChybaVstupu("Taký komentár neexistuje.", 404);
    return r.autor;
  }

  uprav(ja: Pouzivatel, id: number, zmeny: Record<string, unknown>, teraz: number): void {
    const autor = this.autorNazoru(id);
    // Oprávnenia sa overia pred akoukoľvek zmenou — požiadavka prejde celá, alebo vôbec.
    if (zmeny.stav !== undefined && !jeSpravca(ja.rola)) throw new ChybaVstupu("Stav mení len admin alebo subadmin.", 403);
    if ((zmeny.text !== undefined || zmeny.kategoria !== undefined) && autor !== ja.id) throw new ChybaVstupu("Upraviť môžeš len svoj názor.", 403);
    const stav = zmeny.stav === undefined ? null : overStav(zmeny.stav);
    const text = zmeny.text === undefined ? null : overText(zmeny.text, MAX_NAZOR, "Názor");
    const kategoria = zmeny.kategoria === undefined ? null : overKategoriu(zmeny.kategoria);
    if (stav !== null) this.db.prepare("UPDATE nazory SET stav = ? WHERE id = ?").run(stav, id);
    if (text !== null) this.db.prepare("UPDATE nazory SET text = ?, upraveny = ? WHERE id = ?").run(text, teraz, id);
    if (kategoria !== null) this.db.prepare("UPDATE nazory SET kategoria = ? WHERE id = ?").run(kategoria, id);
  }

  zmaz(ja: Pouzivatel, id: number): void {
    const autor = this.autorNazoru(id);
    if (autor !== ja.id && !jeSpravca(ja.rola)) throw new ChybaVstupu("Zmazať môžeš len svoj názor.", 403);
    this.db.prepare("DELETE FROM nazory WHERE id = ?").run(id);
  }

  komentuj(ja: Pouzivatel, nazor: number, text: unknown, teraz: number): number {
    this.prava.vyzaduj(ja, "spatna_vazba_reagovat");
    this.autorNazoru(nazor);
    const t = overText(text, MAX_KOMENTAR, "Komentár");
    this.brzda("nazory_komentare", ja.id, teraz, LIMIT_KOMENTAROV);
    const r = this.db.prepare("INSERT INTO nazory_komentare (nazor, autor, text, vytvoreny) VALUES (?, ?, ?, ?)").run(nazor, ja.id, t, teraz);
    return Number(r.lastInsertRowid);
  }

  zmazKomentar(ja: Pouzivatel, id: number): void {
    const autor = this.autorKomentara(id);
    if (autor !== ja.id && !jeSpravca(ja.rola)) throw new ChybaVstupu("Zmazať môžeš len svoj komentár.", 403);
    this.db.prepare("DELETE FROM nazory_komentare WHERE id = ?").run(id);
  }

  /** Dá alebo vezme cigaretu; vracia nový počet cigariet. */
  cigareta(ja: Pouzivatel, druh: "nazor" | "komentar", id: number, dat: boolean): number {
    this.prava.vyzaduj(ja, "spatna_vazba_reagovat");
    const autor = druh === "nazor" ? this.autorNazoru(id) : this.autorKomentara(id);
    if (autor === ja.id) throw new ChybaVstupu("Sám sebe cigaretu nedáš — to by bolo fajčenie na dlh.");
    const [tabulka, stlpec] = druh === "nazor" ? ["cigarety_nazorov", "nazor"] : ["cigarety_komentarov", "komentar"];
    if (dat) this.db.prepare(`INSERT OR IGNORE INTO ${tabulka} (${stlpec}, pouzivatel) VALUES (?, ?)`).run(id, ja.id);
    else this.db.prepare(`DELETE FROM ${tabulka} WHERE ${stlpec} = ? AND pouzivatel = ?`).run(id, ja.id);
    return (this.db.prepare(`SELECT COUNT(*) AS n FROM ${tabulka} WHERE ${stlpec} = ?`).get(id) as { n: number }).n;
  }
}

function autorZ(r: Record<string, unknown>): Autor {
  return {
    id: Number(r.autor_id),
    meno: String(r.autor_meno),
    avatar: r.autor_avatar === null ? null : String(r.autor_avatar),
    rola: String(r.autor_rola),
    ai: Number(r.autor_ai) === 1,
  };
}

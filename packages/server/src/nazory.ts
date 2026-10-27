// Spätná väzba hráčov: názory na hru, komentáre k nim a cigarety.
//
// Cigareta je v NA EX! obdoba „páči sa mi“ — jeden hráč dá jednému názoru
// či komentáru najviac jednu a vlastnému nič. Upravovať a mazať smie autor,
// mazať a meniť stav aj správca (admin, subadmin).
//
// Stavy (Michal 2026-10-27, S-A): záložka „Otvorené“ = nové + prečítané, ďalej
// plánujeme, hotovo (voliteľne s novinkou, v ktorej to je) a nebudeme robiť
// (vždy s jednou vetou prečo — hráč ju vidí).

import type { Db } from "./db.ts";
import type { Pouzivatel } from "./auth.ts";
import { ChybaVstupu, jeSpravca } from "./auth.ts";
import { Prava } from "./prava.ts";

/** Poradie = poradie vo formulári „O čom píšeš?“ (Chyba prvá). Kľúče sa nemenia — staré názory ostávajú, ako boli. */
export const KATEGORIE = ["chyba", "pravidla", "karty", "hranie", "web", "napad", "ine"] as const;
export type KategoriaNazoru = (typeof KATEGORIE)[number];

export const STAVY = ["nove", "prijate", "planovane", "hotove", "zamietnute"] as const;
export type StavNazoru = (typeof STAVY)[number];

/** Záložky stavu na stránke. */
export const SKUPINY_STAVU = ["otvorene", "planovane", "hotove", "zamietnute"] as const;
export type SkupinaStavu = (typeof SKUPINY_STAVU)[number];

const STAVY_SKUPINY: Readonly<Record<SkupinaStavu, readonly StavNazoru[]>> = {
  otvorene: ["nove", "prijate"],
  planovane: ["planovane"],
  hotove: ["hotove"],
  zamietnute: ["zamietnute"],
};

export const MAX_NAZOR = 3000;
export const MAX_KOMENTAR = 1000;
export const MAX_NADPIS = 120;
export const MAX_DOVOD = 200;

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
  /** „Jednou vetou“ — '' pri starých názoroch (klient ukáže prvú vetu textu). */
  readonly nadpis: string;
  readonly text: string;
  readonly stav: StavNazoru;
  /** Prečo „nebudeme robiť“; inak ''. */
  readonly dovod: string;
  /** Novinka, v ktorej je „hotovo“; inak null. */
  readonly novinka: { readonly id: number; readonly datum: string; readonly nadpis: string } | null;
  readonly vytvoreny: number;
  readonly upraveny: number | null;
  readonly cigarety: number;
  readonly mojaCigareta: boolean;
  readonly komentare: readonly Komentar[];
}

export type Triedenie = "nove" | "cigarety" | "diskusia";

export interface FilterNazorov {
  readonly kategoria: KategoriaNazoru | null;
  readonly skupina: SkupinaStavu | null;
  /** false = len od ľudí, true = len od AI, null = všetky. */
  readonly ai: boolean | null;
}

/** Počty v záložkách stavu — zvlášť od ľudí a od AI (prepínač a prázdny stav na stránke). */
export type PoctyNazorov = Readonly<Record<SkupinaStavu, { readonly ludia: number; readonly ai: number }>>;

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

/** Jednoriadkový voliteľný text (nadpis, dôvod). */
function overVetu(v: unknown, max: number, pole: string): string {
  if (v !== undefined && v !== null && typeof v !== "string") throw new ChybaVstupu(`${pole}: musí byť text.`);
  const t = (typeof v === "string" ? v : "").replace(/\s+/g, " ").trim();
  if (t.length > max) throw new ChybaVstupu(`${pole}: najviac ${max} znakov.`);
  return t;
}

export function overKategoriu(v: unknown): KategoriaNazoru {
  if (typeof v === "string" && (KATEGORIE as readonly string[]).includes(v)) return v as KategoriaNazoru;
  throw new ChybaVstupu("Vyber, o čom píšeš.");
}

export function overSkupinu(v: unknown): SkupinaStavu {
  if (typeof v === "string" && (SKUPINY_STAVU as readonly string[]).includes(v)) return v as SkupinaStavu;
  throw new ChybaVstupu(`Stav: ${SKUPINY_STAVU.join(" | ")}.`);
}

function overStav(v: unknown): StavNazoru {
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

  zoznam(ja: Pouzivatel, triedenie: Triedenie, filter: FilterNazorov): Nazor[] {
    // Správca vidí v otvorených nové (ešte neprečítané) hore (Michal 2026-10-27).
    const noveHore = jeSpravca(ja.rola) ? "(n.stav = 'nove') DESC, " : "";
    const poradie =
      triedenie === "cigarety" ? "cigarety DESC, n.id DESC" : triedenie === "diskusia" ? "komentarov DESC, n.id DESC" : `${noveHore}n.id DESC`;
    const stavy = filter.skupina === null ? [] : STAVY_SKUPINY[filter.skupina];
    const ai = filter.ai === null ? [] : [filter.ai ? 1 : 0];
    const riadky = this.db
      .prepare(
        `SELECT n.id, n.kategoria, n.nadpis, n.text, n.stav, n.dovod, n.vytvoreny, n.upraveny,
                v.id AS novinka_id, v.datum AS novinka_datum, v.nadpis AS novinka_nadpis,
                u.id AS autor_id, u.meno AS autor_meno, u.avatar AS autor_avatar, u.rola AS autor_rola, u.ai AS autor_ai,
                (SELECT COUNT(*) FROM cigarety_nazorov c WHERE c.nazor = n.id) AS cigarety,
                (SELECT COUNT(*) FROM cigarety_nazorov c WHERE c.nazor = n.id AND c.pouzivatel = ?) AS moja,
                (SELECT COUNT(*) FROM nazory_komentare k WHERE k.nazor = n.id) AS komentarov
         FROM nazory n JOIN pouzivatelia u ON u.id = n.autor
         LEFT JOIN novinky v ON v.id = n.novinka
         WHERE (? IS NULL OR n.kategoria = ?)
           ${stavy.length === 0 ? "" : `AND n.stav IN (${stavy.map(() => "?").join(",")})`}
           ${ai.length === 0 ? "" : "AND u.ai = ?"}
         ORDER BY ${poradie}
         LIMIT 200`,
      )
      .all(ja.id, filter.kategoria, filter.kategoria, ...stavy, ...ai) as Record<string, unknown>[];
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
      nadpis: String(r.nadpis),
      text: String(r.text),
      stav: r.stav as StavNazoru,
      dovod: String(r.dovod),
      novinka: r.novinka_id === null ? null : { id: Number(r.novinka_id), datum: String(r.novinka_datum), nadpis: String(r.novinka_nadpis) },
      vytvoreny: Number(r.vytvoreny),
      upraveny: r.upraveny === null ? null : Number(r.upraveny),
      cigarety: Number(r.cigarety),
      mojaCigareta: Number(r.moja) > 0,
      komentare: podlaNazoru.get(Number(r.id)) ?? [],
    }));
  }

  /** Počty v záložkách stavu (filter kategórie platí, stav a AI nie). */
  pocty(kategoria: KategoriaNazoru | null): PoctyNazorov {
    const riadky = this.db
      .prepare(
        `SELECT n.stav, u.ai, COUNT(*) AS n FROM nazory n JOIN pouzivatelia u ON u.id = n.autor
         WHERE (? IS NULL OR n.kategoria = ?) GROUP BY n.stav, u.ai`,
      )
      .all(kategoria, kategoria) as { stav: string; ai: number; n: number }[];
    const out = Object.fromEntries(SKUPINY_STAVU.map((s) => [s, { ludia: 0, ai: 0 }])) as Record<SkupinaStavu, { ludia: number; ai: number }>;
    for (const r of riadky) {
      const skupina = SKUPINY_STAVU.find((s) => STAVY_SKUPINY[s].includes(r.stav as StavNazoru));
      if (skupina === undefined) continue;
      if (Number(r.ai) === 1) out[skupina].ai += Number(r.n);
      else out[skupina].ludia += Number(r.n);
    }
    return out;
  }

  private brzda(tabulka: "nazory" | "nazory_komentare", autor: number, teraz: number, limit: number): void {
    const r = this.db.prepare(`SELECT COUNT(*) AS n FROM ${tabulka} WHERE autor = ? AND vytvoreny > ?`).get(autor, teraz - OKNO_MS) as { n: number };
    if (r.n >= limit) throw new ChybaVstupu("Píšeš príliš rýchlo. Daj si poldeci a skús to o chvíľu.", 429);
  }

  pridaj(ja: Pouzivatel, kategoria: unknown, text: unknown, teraz: number, nadpis?: unknown): number {
    this.prava.vyzaduj(ja, "spatna_vazba_pisat");
    const k = overKategoriu(kategoria);
    const n = overVetu(nadpis, MAX_NADPIS, "Jednou vetou");
    const t = overText(text, MAX_NAZOR, "Názor");
    this.brzda("nazory", ja.id, teraz, LIMIT_NAZOROV);
    const r = this.db.prepare("INSERT INTO nazory (autor, kategoria, nadpis, text, vytvoreny) VALUES (?, ?, ?, ?, ?)").run(ja.id, k, n, t, teraz);
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

  /**
   * Autor mení text, nadpis a kategóriu; správca stav, novinku (pri „hotovo“)
   * a dôvod (pri „nebudeme robiť“ povinný). Pri inom stave sa novinka a dôvod zmažú.
   */
  uprav(ja: Pouzivatel, id: number, zmeny: Record<string, unknown>, teraz: number): void {
    const r = this.db.prepare("SELECT autor, stav, dovod, novinka FROM nazory WHERE id = ?").get(id) as
      | { autor: number; stav: string; dovod: string; novinka: number | null }
      | undefined;
    if (r === undefined) throw new ChybaVstupu("Taký názor neexistuje.", 404);
    // Oprávnenia a vstup sa overia pred akoukoľvek zmenou — požiadavka prejde celá, alebo vôbec.
    const spravcovske = zmeny.stav !== undefined || zmeny.novinka !== undefined || zmeny.dovod !== undefined;
    if (spravcovske && !jeSpravca(ja.rola)) throw new ChybaVstupu("Stav mení len admin alebo subadmin.", 403);
    const autorske = zmeny.text !== undefined || zmeny.kategoria !== undefined || zmeny.nadpis !== undefined;
    if (autorske && r.autor !== ja.id) throw new ChybaVstupu("Upraviť môžeš len svoj názor.", 403);

    const stav = zmeny.stav === undefined ? (r.stav as StavNazoru) : overStav(zmeny.stav);
    let novinka = r.novinka;
    if (zmeny.novinka !== undefined) {
      if (zmeny.novinka === null) novinka = null;
      else {
        const n = Number(zmeny.novinka);
        if (!Number.isInteger(n) || this.db.prepare("SELECT 1 FROM novinky WHERE id = ?").get(n) === undefined) throw new ChybaVstupu("Taká novinka neexistuje.");
        if (stav !== "hotove") throw new ChybaVstupu("Novinku má len názor v stave hotovo.");
        novinka = n;
      }
    }
    if (stav !== "hotove") novinka = null;
    let dovod = zmeny.dovod === undefined ? r.dovod : overVetu(zmeny.dovod, MAX_DOVOD, "Prečo nie");
    if (stav !== "zamietnute") dovod = "";
    else if (dovod === "") throw new ChybaVstupu("Pri „nebudeme robiť“ napíš jednou vetou prečo.");
    const text = zmeny.text === undefined ? null : overText(zmeny.text, MAX_NAZOR, "Názor");
    const kategoria = zmeny.kategoria === undefined ? null : overKategoriu(zmeny.kategoria);
    const nadpis = zmeny.nadpis === undefined ? null : overVetu(zmeny.nadpis, MAX_NADPIS, "Jednou vetou");

    if (spravcovske) this.db.prepare("UPDATE nazory SET stav = ?, novinka = ?, dovod = ? WHERE id = ?").run(stav, novinka, dovod, id);
    if (text !== null) this.db.prepare("UPDATE nazory SET text = ?, upraveny = ? WHERE id = ?").run(text, teraz, id);
    if (nadpis !== null) this.db.prepare("UPDATE nazory SET nadpis = ?, upraveny = ? WHERE id = ?").run(nadpis, teraz, id);
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

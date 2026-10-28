// Novinky (Michal 2026-10-22): čo sa na webe a v hre zmenilo — pravidlá, karty,
// dizajn, web, opravy. Píšu sa pre hráča, až keď je zmena na živom webe.
// Číta každý (aj návštevník), píše admin a subadmin (agent Admin).

import type { Db } from "./db.ts";
import { ChybaVstupu } from "./auth.ts";

const KATEGORIE_NOVINIEK = ["pravidla", "karty", "dizajn", "web", "opravy"] as const;
export type KategoriaNovinky = (typeof KATEGORIE_NOVINIEK)[number];

export interface Novinka {
  readonly id: number;
  /** Deň zmeny na živom webe (RRRR-MM-DD). */
  readonly datum: string;
  readonly kategoria: KategoriaNovinky;
  readonly nadpis: string;
  readonly text: string;
  /** Cesta na webe (napr. /pravidla#bitka) alebo ''. */
  readonly odkaz: string;
  /** Vydanie, do ktorého zmena patrí (napr. „Pravidlá v6“), alebo '' — nadpis dňa v Novinkách. */
  readonly vydanie: string;
  readonly vytvorena: number;
  readonly upravena: number;
}

type ObsahNovinky = Pick<Novinka, "datum" | "kategoria" | "nadpis" | "text" | "odkaz" | "vydanie">;

function text(v: unknown, max: number, pole: string, povinny: boolean): string {
  if (v !== undefined && typeof v !== "string") throw new ChybaVstupu(`${pole}: musí byť text.`);
  const t = (typeof v === "string" ? v : "").replace(/\r\n/g, "\n").trim();
  if (povinny && t === "") throw new ChybaVstupu(`${pole}: chýba text.`);
  if (t.length > max) throw new ChybaVstupu(`${pole}: najviac ${max} znakov.`);
  return t;
}

function datum(v: unknown): string {
  const d = typeof v === "string" ? v.trim() : "";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  // Date.UTC prehodí 31. 2. na marec — tak sa odhalí neexistujúci deň.
  const ok = m !== null && new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).toISOString().startsWith(d);
  if (!ok) throw new ChybaVstupu("Dátum: RRRR-MM-DD.");
  return d;
}

function odkaz(v: unknown): string {
  const o = text(v, 300, "Odkaz", false);
  // Len cesta na tomto webe — novinka nesmie viesť von.
  if (o !== "" && !/^\/(?!\/)[\w\-./#%?=&]*$/.test(o)) throw new ChybaVstupu("Odkaz je cesta na webe (začína /, napr. /pravidla#bitka).");
  return o;
}

/** Obsah z tela požiadavky; čo chýba, vezme zo `stara` (úprava len niektorých polí). */
function overObsah(v: Record<string, unknown>, stara: ObsahNovinky | null): ObsahNovinky {
  const ma = (k: string): boolean => v[k] !== undefined || stara === null;
  const kategoria = ma("kategoria") ? v.kategoria : stara?.kategoria;
  if (!(KATEGORIE_NOVINIEK as readonly unknown[]).includes(kategoria)) throw new ChybaVstupu(`Kategória: ${KATEGORIE_NOVINIEK.join(" | ")}.`);
  return {
    datum: ma("datum") ? datum(v.datum) : (stara as ObsahNovinky).datum,
    kategoria: kategoria as KategoriaNovinky,
    nadpis: ma("nadpis") ? text(v.nadpis, 120, "Nadpis", true) : (stara as ObsahNovinky).nadpis,
    text: ma("text") ? text(v.text, 1500, "Text", true) : (stara as ObsahNovinky).text,
    odkaz: ma("odkaz") ? odkaz(v.odkaz) : (stara as ObsahNovinky).odkaz,
    vydanie: ma("vydanie") ? text(v.vydanie, 40, "Vydanie", false).replace(/\s+/g, " ") : (stara as ObsahNovinky).vydanie,
  };
}

export class Novinky {
  private readonly db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  private riadok(r: Record<string, unknown>): Novinka {
    return {
      id: Number(r.id),
      datum: String(r.datum),
      kategoria: r.kategoria as KategoriaNovinky,
      nadpis: String(r.nadpis),
      text: String(r.text),
      odkaz: String(r.odkaz),
      vydanie: String(r.vydanie),
      vytvorena: Number(r.vytvorena),
      upravena: Number(r.upravena),
    };
  }

  /** Najnovšie hore; v ten istý deň neskôr pridaná vyššie. */
  zoznam(): Novinka[] {
    return (this.db.prepare("SELECT * FROM novinky ORDER BY datum DESC, id DESC").all() as Record<string, unknown>[]).map((r) => this.riadok(r));
  }

  private jedna(id: number): Novinka {
    const r = this.db.prepare("SELECT * FROM novinky WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    if (r === undefined) throw new ChybaVstupu("Taká novinka neexistuje.", 404);
    return this.riadok(r);
  }

  pridaj(telo: Record<string, unknown>, autor: number, teraz: number): Novinka {
    const o = overObsah(telo, null);
    const r = this.db
      .prepare(
        `INSERT INTO novinky (datum, kategoria, nadpis, text, odkaz, vydanie, autor, vytvorena, upravena)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      )
      .get(o.datum, o.kategoria, o.nadpis, o.text, o.odkaz, o.vydanie, autor, teraz, teraz) as { id: number };
    return this.jedna(Number(r.id));
  }

  uprav(id: number, telo: Record<string, unknown>, teraz: number): Novinka {
    const o = overObsah(telo, this.jedna(id));
    this.db
      .prepare("UPDATE novinky SET datum = ?, kategoria = ?, nadpis = ?, text = ?, odkaz = ?, vydanie = ?, upravena = ? WHERE id = ?")
      .run(o.datum, o.kategoria, o.nadpis, o.text, o.odkaz, o.vydanie, teraz, id);
    return this.jedna(id);
  }

  zmaz(id: number): void {
    this.jedna(id);
    this.db.prepare("DELETE FROM novinky WHERE id = ?").run(id);
  }

  /** Koľko noviniek pribudlo po čase `od` — značka pri odkaze v navigácii. */
  pocetOd(od: number): number {
    return (this.db.prepare("SELECT COUNT(*) AS n FROM novinky WHERE vytvorena > ?").get(od) as { n: number }).n;
  }

  /** Kedy hráč naposledy otvoril Novinky; kým ich neotvoril, ráta sa od registrácie (staré novinky nie sú „nové“). */
  videne(pouzivatel: number): number {
    const r = this.db.prepare("SELECT COALESCE(novinky_videne, vytvoreny) AS t FROM pouzivatelia WHERE id = ?").get(pouzivatel) as { t: number } | undefined;
    return r === undefined ? 0 : Number(r.t);
  }

  /**
   * „Mám prečítané“ (Michal 2026-10-27), nie samotné otvorenie stránky. `po` = čas najnovšej
   * novinky, ktorú mal hráč pred očami — čo pribudlo, kým čítal, ostane nové.
   * Čas sa nevráti dozadu (dve karty prehliadača so starším zoznamom).
   */
  oznacVidene(pouzivatel: number, teraz: number, po?: unknown): void {
    const cas = typeof po === "number" && Number.isFinite(po) && po > 0 ? Math.min(Math.floor(po), teraz) : teraz;
    this.db.prepare("UPDATE pouzivatelia SET novinky_videne = MAX(COALESCE(novinky_videne, 0), ?) WHERE id = ?").run(cas, pouzivatel);
  }
}

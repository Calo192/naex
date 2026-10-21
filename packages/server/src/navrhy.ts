// Návrhy zlepšení z playtestov (Michal 2026-10-21) — pre admina a subadminov.
//
// Návrhy píše AI navrhár spolu so stratégom po playteste (skill naex-playtest
// s parametrom max) a nahrá ich sem. Admin pri každom vyberie možnosť, dopíše
// poznámku a rozhodne: implementovať, odložiť, zamietnuť. Skill
// naex-implementacia potom zoberie len návrhy, o ktorých implementácii rozhodol
// človek (nie účet AI), a agent Developer ich po dokončení označí.

import type { Db } from "./db.ts";
import type { Pouzivatel } from "./auth.ts";
import { ChybaVstupu, jeSpravca } from "./auth.ts";

export const STAVY_NAVRHU = ["nove", "implementovat", "odlozene", "zamietnute", "rozpracovane", "implementovane"] as const;
export type StavNavrhu = (typeof STAVY_NAVRHU)[number];

/** Rozhodnutia človeka; zvyšné stavy nastavuje Developer počas práce. */
const ROZHODNUTIA: readonly StavNavrhu[] = ["nove", "implementovat", "odlozene", "zamietnute"];

export const KRITICKOSTI = ["kriticka", "vysoka", "stredna", "nizka"] as const;
export type Kritickost = (typeof KRITICKOSTI)[number];

export interface Moznost {
  readonly kluc: string;
  readonly nazov: string;
  readonly popis: string;
  readonly dopad: string;
  readonly narocnost: string;
  readonly odporucana: boolean;
}

/** Obsah návrhu tak, ako ho napísal navrhár. */
export interface ObsahNavrhu {
  /** Stály kľúč v rámci dávky — opätovné nahratie dávky návrh prepíše, rozhodnutie nechá. */
  readonly kluc: string;
  readonly nazov: string;
  readonly kritickost: Kritickost;
  readonly oblast: string;
  readonly problem: string;
  readonly pricina: string;
  readonly prejav: string;
  readonly dokazy: readonly string[];
  readonly moznosti: readonly Moznost[];
  readonly odporucanie: string;
  readonly otazky: readonly string[];
}

interface Osoba {
  readonly id: number;
  readonly meno: string;
  readonly ai: boolean;
}

export interface Navrh extends ObsahNavrhu {
  readonly id: number;
  /** Turnus playtestu, z ktorého návrh vzišiel (napr. „20261021-120000“). */
  readonly davka: string;
  /** Report a rozbory turnusu v docs/playtesty (názvy súborov). */
  readonly podklady: readonly string[];
  readonly poradie: number;
  readonly stav: StavNavrhu;
  /** Vybraná možnosť (kluc), „vlastne“ alebo null. */
  readonly volba: string | null;
  readonly poznamka: string;
  readonly rozhodol: Osoba | null;
  readonly rozhodnuty: number | null;
  /** Čo Developer spravil (commit, poznámka), keď návrh implementoval. */
  readonly vysledok: string;
  readonly vytvoreny: number;
}

const MAX_TEXT = 6000;
const MAX_KRATKY = 200;

function text(v: unknown, max: number, pole: string, povinny = true): string {
  const t = typeof v === "string" ? v.replace(/\r\n/g, "\n").trim() : "";
  if (povinny && t === "") throw new ChybaVstupu(`${pole}: chýba text.`);
  if (t.length > max) throw new ChybaVstupu(`${pole}: najviac ${max} znakov.`);
  return t;
}

function zoznamTextov(v: unknown, max: number, pole: string): string[] {
  if (v === undefined) return [];
  if (!Array.isArray(v) || v.length > 30) throw new ChybaVstupu(`${pole}: očakávam zoznam (najviac 30).`);
  return v.map((x, i) => text(x, max, `${pole} ${i + 1}`));
}

const KLUC_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
const DAVKA_RE = /^\d{8}-\d{6}$/;
const PODKLAD_RE = /^[\w.-]{1,120}\.(html|md)$/;

export function overObsah(v: unknown): ObsahNavrhu {
  if (typeof v !== "object" || v === null || Array.isArray(v)) throw new ChybaVstupu("Návrh musí byť objekt.");
  const o = v as Record<string, unknown>;
  const kluc = String(o.kluc ?? "");
  if (!KLUC_RE.test(kluc)) throw new ChybaVstupu(`Kľúč návrhu „${kluc}“: malé písmená, číslice a pomlčky.`);
  if (!(KRITICKOSTI as readonly unknown[]).includes(o.kritickost)) throw new ChybaVstupu(`Návrh ${kluc}: kritickosť ${KRITICKOSTI.join(" | ")}.`);
  if (!Array.isArray(o.moznosti) || o.moznosti.length < 1 || o.moznosti.length > 6) throw new ChybaVstupu(`Návrh ${kluc}: 1 až 6 možností.`);
  const moznosti = o.moznosti.map((m, i): Moznost => {
    if (typeof m !== "object" || m === null) throw new ChybaVstupu(`Návrh ${kluc}: možnosť ${i + 1} musí byť objekt.`);
    const x = m as Record<string, unknown>;
    const mk = String(x.kluc ?? "");
    if (!/^[A-Z]$/.test(mk)) throw new ChybaVstupu(`Návrh ${kluc}: kľúč možnosti je jedno veľké písmeno.`);
    return {
      kluc: mk,
      nazov: text(x.nazov, MAX_KRATKY, `Možnosť ${mk} — názov`),
      popis: text(x.popis, MAX_TEXT, `Možnosť ${mk} — popis`),
      dopad: text(x.dopad, MAX_TEXT, `Možnosť ${mk} — dopad`, false),
      narocnost: text(x.narocnost, MAX_KRATKY, `Možnosť ${mk} — náročnosť`, false),
      odporucana: x.odporucana === true,
    };
  });
  if (new Set(moznosti.map((m) => m.kluc)).size !== moznosti.length) throw new ChybaVstupu(`Návrh ${kluc}: kľúče možností sa opakujú.`);
  return {
    kluc,
    nazov: text(o.nazov, MAX_KRATKY, "Názov"),
    kritickost: o.kritickost as Kritickost,
    oblast: text(o.oblast, 60, "Oblasť", false),
    problem: text(o.problem, MAX_TEXT, "Problém"),
    pricina: text(o.pricina, MAX_TEXT, "Príčina"),
    prejav: text(o.prejav, MAX_TEXT, "Prejav"),
    dokazy: zoznamTextov(o.dokazy, 1000, "Dôkaz"),
    moznosti,
    odporucanie: text(o.odporucanie, MAX_TEXT, "Odporúčanie", false),
    otazky: zoznamTextov(o.otazky, 1000, "Otázka"),
  };
}

export class Navrhy {
  private readonly db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  zoznam(): Navrh[] {
    const riadky = this.db
      .prepare(
        `SELECT n.*, u.meno AS rozhodol_meno, u.ai AS rozhodol_ai
         FROM navrhy n LEFT JOIN pouzivatelia u ON u.id = n.rozhodol
         ORDER BY n.davka DESC, n.poradie`,
      )
      .all() as Record<string, unknown>[];
    return riadky.map((r) => ({
      ...(JSON.parse(String(r.data)) as ObsahNavrhu),
      id: Number(r.id),
      davka: String(r.davka),
      podklady: JSON.parse(String(r.podklady)) as string[],
      poradie: Number(r.poradie),
      stav: r.stav as StavNavrhu,
      volba: r.volba === null ? null : String(r.volba),
      poznamka: String(r.poznamka),
      rozhodol: r.rozhodol === null ? null : { id: Number(r.rozhodol), meno: String(r.rozhodol_meno ?? "?"), ai: Number(r.rozhodol_ai) === 1 },
      rozhodnuty: r.rozhodnuty === null ? null : Number(r.rozhodnuty),
      vysledok: String(r.vysledok),
      vytvoreny: Number(r.vytvoreny),
    }));
  }

  /**
   * Nahrá dávku návrhov. Opätovné nahratie tej istej dávky prepíše obsah
   * a poradie, ale rozhodnutie admina ostane.
   */
  nahraj(ja: Pouzivatel, telo: Record<string, unknown>, teraz: number): number[] {
    if (!jeSpravca(ja.rola)) throw new ChybaVstupu("Návrhy nahráva len admin alebo subadmin.", 403);
    const davka = String(telo.davka ?? "");
    if (!DAVKA_RE.test(davka)) throw new ChybaVstupu("Dávka: čas turnusu v tvare RRRRMMDD-HHMMSS.");
    const podklady = zoznamTextov(telo.podklady, 120, "Podklad");
    for (const p of podklady) if (!PODKLAD_RE.test(p)) throw new ChybaVstupu(`Podklad „${p}“: názov súboru v docs/playtesty.`);
    if (!Array.isArray(telo.navrhy) || telo.navrhy.length === 0 || telo.navrhy.length > 20) throw new ChybaVstupu("Dávka má 1 až 20 návrhov.");
    const navrhy = telo.navrhy.map(overObsah);
    if (new Set(navrhy.map((n) => n.kluc)).size !== navrhy.length) throw new ChybaVstupu("Kľúče návrhov sa v dávke opakujú.");

    const vloz = this.db.prepare(
      `INSERT INTO navrhy (davka, kluc, poradie, data, podklady, vytvoreny) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(davka, kluc) DO UPDATE SET poradie = excluded.poradie, data = excluded.data, podklady = excluded.podklady
       RETURNING id`,
    );
    return navrhy.map((n, i) => Number((vloz.get(davka, n.kluc, i, JSON.stringify(n), JSON.stringify(podklady), teraz) as { id: number }).id));
  }

  /**
   * Rozhodnutie admina (stav, voľba, poznámka) alebo hlásenie Developera
   * (rozpracované / implementované + výsledok).
   */
  uprav(ja: Pouzivatel, id: number, zmeny: Record<string, unknown>, teraz: number): void {
    if (!jeSpravca(ja.rola)) throw new ChybaVstupu("Návrhy spravuje len admin alebo subadmin.", 403);
    const r = this.db.prepare("SELECT data, stav FROM navrhy WHERE id = ?").get(id) as { data: string; stav: string } | undefined;
    if (r === undefined) throw new ChybaVstupu("Taký návrh neexistuje.", 404);
    const obsah = JSON.parse(r.data) as ObsahNavrhu;

    const stav = zmeny.stav;
    if (stav !== undefined && !(STAVY_NAVRHU as readonly unknown[]).includes(stav)) throw new ChybaVstupu("Neznámy stav návrhu.");
    const volba = zmeny.volba;
    if (volba !== undefined && volba !== null && volba !== "vlastne" && !obsah.moznosti.some((m) => m.kluc === volba)) {
      throw new ChybaVstupu("Taká možnosť v návrhu nie je.");
    }
    const poznamka = zmeny.poznamka === undefined ? undefined : text(zmeny.poznamka, MAX_TEXT, "Poznámka", false);
    const vysledok = zmeny.vysledok === undefined ? undefined : text(zmeny.vysledok, MAX_TEXT, "Výsledok", false);
    if (volba === "vlastne" && (poznamka ?? "") === "" && stav === "implementovat") {
      throw new ChybaVstupu("Pri vlastnom riešení ho opíš v poznámke.");
    }

    // Rozhodnutie (zmena na jeden z ROZHODNUTIA) si pamätá, kto ho urobil — Developer
    // berie len rozhodnutia ľudí, nie účtov AI. Návrat nedokončenej práce
    // (rozpracované → implementovať) pôvodné rozhodnutie nemení.
    const navrat = stav === "implementovat" && r.stav === "rozpracovane";
    const rozhodnutie = typeof stav === "string" && (ROZHODNUTIA as readonly string[]).includes(stav) && !navrat;
    this.db
      .prepare(
        `UPDATE navrhy SET
           stav = COALESCE(?, stav),
           volba = CASE WHEN ? THEN ? ELSE volba END,
           poznamka = COALESCE(?, poznamka),
           vysledok = COALESCE(?, vysledok),
           rozhodol = CASE WHEN ? THEN ? ELSE rozhodol END,
           rozhodnuty = CASE WHEN ? THEN ? ELSE rozhodnuty END
         WHERE id = ?`,
      )
      .run(
        typeof stav === "string" ? stav : null,
        volba !== undefined ? 1 : 0,
        typeof volba === "string" ? volba : null,
        poznamka ?? null,
        vysledok ?? null,
        rozhodnutie ? 1 : 0,
        ja.id,
        rozhodnutie ? 1 : 0,
        teraz,
        id,
      );
  }

  zmaz(ja: Pouzivatel, id: number): void {
    if (ja.rola !== "admin") throw new ChybaVstupu("Návrh maže len admin.", 403);
    if (this.db.prepare("DELETE FROM navrhy WHERE id = ?").run(id).changes === 0) throw new ChybaVstupu("Taký návrh neexistuje.", 404);
  }
}

// Mäkké skrytie a archív (skill naex-vypalit, Michal 2026-11-02): pri vypálení
// Zrejúcej sa skryjú zastarané príspevky AI účtov (Spätná väzba) a archivujú
// reporty a návrhy z playtestov, ktoré sa týkajú zaniknutých kariet či
// mechaník. Nič sa nemaže — každé skrytie aj návrat je riadok v archiv_zaznamy
// s dôvodom, autorom a obsahom v čase skrytia.

import type { Db } from "./db.ts";
import { ChybaVstupu } from "./auth.ts";

export type DruhSkrytia = "nazor" | "komentar" | "navrh" | "report";

export const MAX_DOVOD_SKRYTIA = 300;

/** Dôvod skrytia je povinný — o pol roka už nikto nevie, prečo položka zmizla. */
export function overDovodSkrytia(v: unknown): string {
  const t = (typeof v === "string" ? v : "").replace(/\s+/g, " ").trim();
  if (t.length < 3) throw new ChybaVstupu("Dôvod: napíš jednou vetou, prečo to skrývaš.");
  if (t.length > MAX_DOVOD_SKRYTIA) throw new ChybaVstupu(`Dôvod: najviac ${MAX_DOVOD_SKRYTIA} znakov.`);
  return t;
}

export function zapisSkrytie(
  db: Db,
  z: { readonly druh: DruhSkrytia; readonly kluc: string | number; readonly akcia: "skry" | "vrat"; readonly dovod: string; readonly kto: number; readonly kedy: number; readonly zaloha?: unknown },
): void {
  db.prepare("INSERT INTO archiv_zaznamy (druh, kluc, akcia, dovod, kto, kedy, zaloha) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
    z.druh,
    String(z.kluc),
    z.akcia,
    z.dovod,
    z.kto,
    z.kedy,
    z.zaloha === undefined ? "" : JSON.stringify(z.zaloha),
  );
}

export interface ZaznamSkrytia {
  readonly id: number;
  readonly druh: DruhSkrytia;
  readonly kluc: string;
  readonly akcia: "skry" | "vrat";
  readonly dovod: string;
  readonly kto: string | null;
  readonly kedy: number;
}

/** Posledné záznamy skrytí a návratov (admin.ts archiv). */
export function zaznamySkrytia(db: Db, limit = 200): ZaznamSkrytia[] {
  const riadky = db
    .prepare(
      `SELECT a.id, a.druh, a.kluc, a.akcia, a.dovod, a.kedy, u.meno AS kto
       FROM archiv_zaznamy a LEFT JOIN pouzivatelia u ON u.id = a.kto
       ORDER BY a.id DESC LIMIT ?`,
    )
    .all(limit) as Record<string, unknown>[];
  return riadky.map((r) => ({
    id: Number(r.id),
    druh: r.druh as DruhSkrytia,
    kluc: String(r.kluc),
    akcia: r.akcia as "skry" | "vrat",
    dovod: String(r.dovod),
    kto: r.kto === null ? null : String(r.kto),
    kedy: Number(r.kedy),
  }));
}

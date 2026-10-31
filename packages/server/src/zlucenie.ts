// Zlúčenie dvoch účtov (Michal 2026-10-31): všetko, čo vlastní duplikát, prejde
// na hlavný účet a duplikát zanikne. Vzniklo kvôli ai-admin-2…9 a ai-dizajner-2…3
// na živom webe — prosté zmazanie by cez ON DELETE CASCADE zničilo ich reporty,
// názory a návrhy.
//
// Odkazy na pouzivatelia(id) sa hľadajú cez PRAGMA foreign_key_list, aby zlúčenie
// pokrylo aj tabuľky pridané neskôr. Kolízia s UNIQUE / PRIMARY KEY (frajerina,
// cigareta od oboch k tomu istému názoru, achievement, odpoveď výučby…) ponechá
// riadok hlavného účtu a riadok duplikátu zahodí — súčty kariéry ani Frajerina
// sa nesčítavajú, lebo nie každá hodnota je súčet (rekordy, maximá).

import type { Db } from "./db.ts";
import { ChybaVstupu } from "./auth.ts";

/** Stĺpce s id používateľa bez cudzieho kľúča (staršia schéma) — zoznam ich nevidí. */
const ODKAZY_BEZ_FK: readonly (readonly [tabulka: string, stlpec: string])[] = [
  ["sady", "autor"],
  ["dielna_navrhy", "posudil"],
];

export interface ZmenaTabulky {
  readonly tabulka: string;
  readonly stlpec: string;
  /** Riadky prepísané na hlavný účet. */
  readonly prepisane: number;
  /** Riadky duplikátu zahodené pre kolíziu s riadkom hlavného účtu. */
  readonly zahodene: number;
}

export interface VysledokZlucenia {
  readonly z: { readonly id: number; readonly login: string; readonly meno: string };
  readonly do: { readonly id: number; readonly login: string; readonly meno: string };
  /** true = nanečisto: všetko sa spočítalo a vrátilo späť. */
  readonly skusobne: boolean;
  readonly tabulky: readonly ZmenaTabulky[];
  /** Zrušené relácie duplikátu. */
  readonly relacie: number;
}

const citaj = (db: Db, id: number): { id: number; login: string; meno: string; rola: string } | undefined =>
  db.prepare("SELECT id, login, meno, rola FROM pouzivatelia WHERE id = ?").get(id) as
    | { id: number; login: string; meno: string; rola: string }
    | undefined;

/** Názov v úvodzovkách pre SQL — názvy tabuliek a stĺpcov prichádzajú zo schémy, nie od klienta. */
const q = (meno: string): string => `"${meno.replace(/"/g, '""')}"`;

/** Všetky stĺpce, ktoré odkazujú na používateľa (okrem relácií, tie sa rušia). */
export function odkazyNaPouzivatela(db: Db): { tabulka: string; stlpec: string }[] {
  const tabulky = (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as { name: string }[]).map(
    (t) => t.name,
  );
  const out: { tabulka: string; stlpec: string }[] = [];
  for (const tabulka of tabulky) {
    const fk = db.prepare(`PRAGMA foreign_key_list(${q(tabulka)})`).all() as { table: string; from: string; to: string | null }[];
    for (const k of fk) {
      if (k.table.toLowerCase() === "pouzivatelia" && (k.to === null || k.to === "id")) out.push({ tabulka, stlpec: k.from });
    }
    const stlpce = new Set((db.prepare(`PRAGMA table_info(${q(tabulka)})`).all() as { name: string }[]).map((c) => c.name));
    for (const [t, s] of ODKAZY_BEZ_FK) {
      if (t === tabulka && stlpce.has(s) && !out.some((o) => o.tabulka === t && o.stlpec === s)) out.push({ tabulka, stlpec: s });
    }
  }
  return out.filter((o) => o.tabulka !== "relacie");
}

/**
 * Prepíše všetko z účtu `zId` na `doId` a `zId` zmaže, v jednej transakcii.
 * `skusobne` = to isté nanečisto (na konci ROLLBACK) — počty sú presne tie, ktoré by platili.
 */
export function zlucUcty(db: Db, zId: number, doId: number, skusobne: boolean): VysledokZlucenia {
  if (!Number.isInteger(zId) || !Number.isInteger(doId)) throw new ChybaVstupu("Id účtov musia byť celé čísla.");
  if (zId === doId) throw new ChybaVstupu("Účet nemožno zlúčiť so sebou samým.");
  const z = citaj(db, zId);
  const hlavny = citaj(db, doId);
  if (z === undefined) throw new ChybaVstupu(`Účet ${zId} neexistuje.`, 404);
  if (hlavny === undefined) throw new ChybaVstupu(`Účet ${doId} neexistuje.`, 404);
  if (z.rola === "admin") throw new ChybaVstupu("Účet admina sa nezlučuje.");

  const odkazy = odkazyNaPouzivatela(db);
  db.exec("BEGIN");
  try {
    const tabulky: ZmenaTabulky[] = [];
    for (const { tabulka, stlpec } of odkazy) {
      // OR IGNORE nechá na duplikáte práve riadky, ktoré by narazili na UNIQUE / PRIMARY KEY hlavného účtu.
      const prepisane = Number(db.prepare(`UPDATE OR IGNORE ${q(tabulka)} SET ${q(stlpec)} = ? WHERE ${q(stlpec)} = ?`).run(doId, zId).changes);
      const zahodene = Number(db.prepare(`DELETE FROM ${q(tabulka)} WHERE ${q(stlpec)} = ?`).run(zId).changes);
      if (prepisane > 0 || zahodene > 0) tabulky.push({ tabulka, stlpec, prepisane, zahodene });
    }
    const relacie = Number(db.prepare("DELETE FROM relacie WHERE pouzivatel = ?").run(zId).changes);
    db.prepare("DELETE FROM pouzivatelia WHERE id = ?").run(zId);
    db.exec(skusobne ? "ROLLBACK" : "COMMIT");
    return {
      z: { id: z.id, login: z.login, meno: z.meno },
      do: { id: hlavny.id, login: hlavny.login, meno: hlavny.meno },
      skusobne,
      tabulky,
      relacie,
    };
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

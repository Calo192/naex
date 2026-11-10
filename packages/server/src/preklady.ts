// Preklady kariet na zobrazenie (lokalizácia, Michal 2026-11-10). Jadro hry číta slovenský
// text efektu; preklad je len to, čo hráč v inom jazyku vidí na karte. Zdrojom sú súbory
// prekladateľa v repe (docs/preklady/karty/<jazyk>.json a vzhlad/<jazyk>.json, do obrazu ich
// kopíruje Dockerfile). Keď ich bude upravovať admin, prepíše ich tu záznam z databázy —
// klient ostane pri tom istom /api/preklady/<jazyk>.

import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/** Jazyky prekladu (bez zdrojovej slovenčiny); klient má ten istý zoznam v i18n/preklad.ts. */
export const JAZYKY_PREKLADU = ["en", "pl", "cs", "hu"] as const;
export type JazykPrekladu = (typeof JAZYKY_PREKLADU)[number];

export const jeJazykPrekladu = (v: unknown): v is JazykPrekladu => typeof v === "string" && (JAZYKY_PREKLADU as readonly string[]).includes(v);

export interface PrekladyJazyka {
  /** Id karty → { nazov, efekt, kraje?, sk } (sk = slovenský text, z ktorého sa prekladalo). */
  readonly karty: Readonly<Record<string, unknown>>;
  /** Akcie, kľúčové slová, kategórie (tagy) a bodovacie karty. */
  readonly vzhlad: Readonly<Record<string, unknown>>;
}

const bezPoznamok = (o: unknown): Record<string, unknown> => {
  if (typeof o !== "object" || o === null || Array.isArray(o)) return {};
  return Object.fromEntries(Object.entries(o).filter(([k]) => !k.startsWith("_")));
};

export class Preklady {
  private readonly cache = new Map<string, { readonly cas: number; readonly data: Record<string, unknown> }>();
  private readonly dir: string;

  constructor(dir: string) {
    this.dir = dir;
  }

  /** Súbor prekladateľa; chýbajúci alebo pokazený = prázdny (karta ostane po slovensky). */
  private subor(cast: "karty" | "vzhlad", jazyk: JazykPrekladu): Record<string, unknown> {
    const cesta = join(this.dir, cast, `${jazyk}.json`);
    let cas: number;
    try {
      cas = statSync(cesta).mtimeMs;
    } catch {
      return {};
    }
    // Prekladateľ súbor prepíše bez reštartu servera — číta sa znova, keď sa zmení.
    const v = this.cache.get(cesta);
    if (v !== undefined && v.cas === cas) return v.data;
    let data: Record<string, unknown> = {};
    try {
      data = bezPoznamok(JSON.parse(readFileSync(cesta, "utf8")) as unknown);
    } catch {
      data = {};
    }
    this.cache.set(cesta, { cas, data });
    return data;
  }

  jazyk(jazyk: JazykPrekladu): PrekladyJazyka {
    return { karty: this.subor("karty", jazyk), vzhlad: this.subor("vzhlad", jazyk) };
  }
}

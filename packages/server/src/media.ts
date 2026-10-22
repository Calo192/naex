// Nahrané súbory (ilustrácie, avatary, SVG ikony). Id = SHA-256 obsahu,
// takže súbor je nemenný a dá sa natrvalo cachovať; rovnaký obrázok sa
// uloží len raz. Typ sa overuje podľa obsahu, nie podľa toho, čo tvrdí klient.

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ServerResponse } from "node:http";
import type { Db } from "./db.ts";
import { ChybaVstupu } from "./auth.ts";

export type DruhMedia = "karta" | "avatar" | "ikona" | "kniznica" | "pozadie";

export interface MediaZaznam {
  readonly id: string;
  readonly typ: string;
  readonly druh: DruhMedia;
  readonly nazov: string;
  readonly velkost: number;
  readonly vytvorene: number;
  /** Id menšej kópie na zobrazenie (/media/<id>?n); null = nemá. */
  readonly nahlad?: string | null;
}

/**
 * Od tejto veľkosti má obrázok mať náhľad (Michal 2026-10-22): pozadia
 * scorecardov mali 350 – 600 kB a na stole sa kreslia 240 px široké.
 * Menšie súbory (avatary) ostávajú, ako sú.
 */
export const PRAH_NAHLADU = 150 * 1024;
/** Ilustrácie kariet: náhľad 512 px (≈ 70 kB) sa na stole kreslí ≈ 117 px — aj ten dostane menší. */
export const PRAH_NAHLADU_KARTY = 30 * 1024;

/** Ilustrácie kariet a knižnica (mriežky od 84 px, náhľad karty v Dielni) — malý náhľad. */
const MALY_NAHLAD: readonly DruhMedia[] = ["karta", "kniznica"];

/** Akú dlhú stranu má mať náhľad: karta a knižnica 320 px, ostatné (scorecard 240 px) 512 px. */
export function stranaNahladu(z: Pick<MediaZaznam, "druh">): number {
  return MALY_NAHLAD.includes(z.druh) ? 320 : 512;
}

/** Obrázok, ktorý by mal mať náhľad (a kým ho nemá, ide cez ?n s krátkou cache). */
function potrebujeNahlad(z: MediaZaznam): boolean {
  if (z.typ === "image/svg+xml" || z.nazov.endsWith("@nahlad")) return false;
  return z.velkost > (MALY_NAHLAD.includes(z.druh) ? PRAH_NAHLADU_KARTY : PRAH_NAHLADU);
}

const PRIPONA: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

/** Skutočný typ podľa prvých bajtov; SVG len ako text s koreňom <svg>. */
export function typObsahu(buf: Buffer): string | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.length > 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  const zaciatok = buf.subarray(0, 512).toString("utf8").replace(/^﻿/, "").trimStart();
  if (/^(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE svg[^>]*>\s*)?<svg[\s>]/i.test(zaciatok)) return "image/svg+xml";
  return null;
}

/**
 * SVG môže obsahovať skripty. Ikony sa vkladajú cez <img> (tam skripty
 * nebežia) a pri priamom otvorení ich zastaví CSP sandbox; aj tak odmietame
 * zjavne aktívny obsah, aby sa nedostal ani do exportov.
 */
function overSvg(buf: Buffer): void {
  const t = buf.toString("utf8");
  if (/<script|on\w+\s*=|javascript:|<foreignObject/i.test(t)) {
    throw new ChybaVstupu("SVG obsahuje skripty alebo aktívny obsah — také sa nahrať nedá.");
  }
}

export class Media {
  private readonly adresar: string;
  private readonly db: Db;

  constructor(db: Db, dataDir: string) {
    this.db = db;
    this.adresar = join(dataDir, "media");
    mkdirSync(this.adresar, { recursive: true });
  }

  uloz(buf: Buffer, druh: DruhMedia, nazov: string, teraz: number, povoleneTypy: readonly string[]): MediaZaznam {
    const typ = typObsahu(buf);
    if (typ === null || !povoleneTypy.includes(typ)) {
      throw new ChybaVstupu(`Nepodporovaný súbor. Povolené: ${povoleneTypy.map((t) => PRIPONA[t]).join(", ")}.`, 415);
    }
    if (typ === "image/svg+xml") overSvg(buf);
    const id = createHash("sha256").update(buf).digest("hex").slice(0, 40);
    const cesta = join(this.adresar, `${id}.${PRIPONA[typ]}`);
    if (!existsSync(cesta)) writeFileSync(cesta, buf);
    const existujuci = this.zaznam(id);
    if (existujuci !== null) return existujuci;
    const z: MediaZaznam = { id, typ, druh, nazov: nazov.slice(0, 200), velkost: buf.length, vytvorene: teraz };
    this.db
      .prepare("INSERT INTO media (id, typ, druh, nazov, velkost, vytvorene) VALUES (?, ?, ?, ?, ?, ?)")
      .run(z.id, z.typ, z.druh, z.nazov, z.velkost, z.vytvorene);
    return z;
  }

  zaznam(id: string): MediaZaznam | null {
    const r = this.db.prepare("SELECT * FROM media WHERE id = ?").get(id) as MediaZaznam | undefined;
    return r ?? null;
  }

  zoznam(druh: DruhMedia): MediaZaznam[] {
    return this.db.prepare("SELECT * FROM media WHERE druh = ? ORDER BY vytvorene DESC, nazov").all(druh) as unknown as MediaZaznam[];
  }

  /**
   * Náhľad pre veľký obrázok — menšia kópia, ktorú vyrobí prehliadač admina
   * (server obrázky dekódovať nevie a knižnicu nepridávame). Uloží sa ako
   * ďalšie médium a originál naň ukazuje.
   */
  nastavNahlad(id: string, buf: Buffer, teraz: number): MediaZaznam {
    const povodny = this.zaznam(id);
    if (povodny === null) throw new ChybaVstupu("Taký obrázok nie je.", 404);
    if (povodny.typ === "image/svg+xml") throw new ChybaVstupu("SVG náhľad nepotrebuje.");
    const n = this.uloz(buf, povodny.druh, `${povodny.nazov}@nahlad`, teraz, ["image/jpeg", "image/webp"]);
    if (n.velkost >= povodny.velkost) throw new ChybaVstupu("Náhľad musí byť menší ako originál.");
    this.db.prepare("UPDATE media SET nahlad = ? WHERE id = ?").run(n.id, id);
    return n;
  }

  /** Obrázky bez náhľadu, ktoré ho majú mať, aj so stranou náhľadu — doplní ich tlačidlo v Tvorbe. */
  bezNahladu(): (MediaZaznam & { readonly strana: number })[] {
    const vsetky = this.db.prepare("SELECT * FROM media WHERE nahlad IS NULL ORDER BY velkost DESC").all() as unknown as MediaZaznam[];
    return vsetky.filter(potrebujeNahlad).map((z) => ({ ...z, strana: stranaNahladu(z) }));
  }

  /**
   * GET /media/<id> — nemenné súbory s dlhou cache. S `nahlad` (…?n) pošle
   * menšiu kópiu, ak ju obrázok má. Veľký obrázok bez nej ide s krátkou cache,
   * aby si prehliadač náhľad stiahol, keď ho admin doplní.
   */
  posli(idAlebo: string, res: ServerResponse, nahlad = false): void {
    const povodny = /^[0-9a-f]{40}$/.test(idAlebo) ? this.zaznam(idAlebo) : null;
    const maNahlad = nahlad && povodny?.nahlad != null;
    const z = maNahlad ? this.zaznam(povodny?.nahlad ?? "") : povodny;
    const cesta = z === null ? null : join(this.adresar, `${z.id}.${PRIPONA[z.typ]}`);
    if (z === null || cesta === null || !existsSync(cesta)) {
      res.writeHead(404).end();
      return;
    }
    const docasne = nahlad && !maNahlad && potrebujeNahlad(z);
    res.writeHead(200, {
      "content-type": z.typ,
      "cache-control": docasne ? "public, max-age=3600" : "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
      // SVG otvorené priamo nesmie spustiť nič.
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    });
    res.end(readFileSync(cesta));
  }
}

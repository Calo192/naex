// Reporty z playtestov (docs/playtesty) pre admina a subadminov.
//
// Reporty sú na dvoch miestach: v repozitári (docs/playtesty, do obrazu ich
// dáva Dockerfile) a nahraté cez API do dátového adresára — tak sa nový report
// dostane na živý web bez nasadenia. Nahratý súbor má prednosť.
//
// Reporty píše AI spisovateľ ako samostatné HTML s vlastným JavaScriptom.
// Preto sa nepodávajú na pôvode aplikácie s prihlásením, ale izolovane:
// odpoveď má CSP `sandbox` (nepriehľadný pôvod — skript v reporte nevidí
// cookies ani API v mene admina) a prístup dáva krátkodobý podpísaný token
// v ceste, lebo izolovaný dokument cookie na obrázky neposiela.

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import type { ServerResponse } from "node:http";
import { dirname, extname, join, normalize, sep } from "node:path";
import { ChybaVstupu } from "./auth.ts";

export interface Report {
  /** Cesta v priečinku reportov, napr. „20261012-101447.html“. */
  readonly subor: string;
  readonly nazov: string;
  /** Čas partie z názvu súboru (ms), null pri prehľadoch. */
  readonly cas: number | null;
  /** report spisovateľa, rozbor stratéga, návrhy navrhára, alebo prehľad naprieč playtestami. */
  readonly druh: "prehlad" | "report" | "strategia" | "navrhy";
}

/** Platnosť tokenu — dosť na prečítanie reportu, krátko pre prípad úniku odkazu. */
const PLATNOST_MS = 2 * 60 * 60 * 1000;

const TYPY: Readonly<Record<string, string>> = {
  ".html": "text/html; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

/** Prehľady naprieč playtestami — v zozname sú hore. */
const PREHLADY: Readonly<Record<string, string>> = {
  "vyvoj-znamok.html": "Vývoj známok",
  "zmeny-pravidiel.html": "Zmeny pravidiel z playtestov",
};

/** Cesta nahrávaného súboru: report v koreni, obrázky najviac o priečinok nižšie. */
const NAHRATIE_RE = /^[\w.-]+(\/[\w.-]+)?$/;

export class Playtesty {
  private readonly dir: string;
  /** Nahraté reporty (dátový adresár); null = nahrávanie vypnuté. */
  private readonly nahrateDir: string | null;
  private readonly tajomstvo = randomBytes(32);

  constructor(dir: string, nahrateDir: string | null = null) {
    this.dir = normalize(dir);
    this.nahrateDir = nahrateDir === null ? null : normalize(nahrateDir);
  }

  /** Nahraté najprv — majú prednosť pred rovnomenným súborom z repozitára. */
  private priecinky(): string[] {
    return [this.nahrateDir, this.dir].filter((d): d is string => d !== null && existsSync(d));
  }

  zoznam(): Report[] {
    const out: Report[] = [];
    const videne = new Set<string>();
    for (const dir of this.priecinky()) {
      for (const subor of readdirSync(dir)) {
        const cesta = join(dir, subor);
        if (videne.has(subor) || !statSync(cesta).isFile()) continue;
        const pripona = extname(subor);
        if (pripona !== ".html" && pripona !== ".md") continue;
        const prehlad = PREHLADY[subor];
        const m = /^(?:(strategia|navrhy)-)?(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})/.exec(subor);
        if (prehlad === undefined && m === null) continue;
        const cas = m === null ? null : Date.UTC(Number(m[2]), Number(m[3]) - 1, Number(m[4]), Number(m[5]), Number(m[6]), Number(m[7]));
        videne.add(subor);
        const druh = prehlad !== undefined ? "prehlad" : m?.[1] === "strategia" ? "strategia" : m?.[1] === "navrhy" ? "navrhy" : "report";
        out.push({ subor, nazov: prehlad ?? this.nazov(cesta, subor), cas, druh });
      }
    }
    const prehladNavrch = (r: Report): number => (r.druh === "prehlad" ? 0 : 1);
    return out.sort((a, b) => prehladNavrch(a) - prehladNavrch(b) || (b.cas ?? 0) - (a.cas ?? 0) || a.subor.localeCompare(b.subor));
  }

  /** Uloží nahratý report alebo jeho obrázok (PUT /api/admin/playtesty/subor/<cesta>). */
  uloz(relativna: string, obsah: Buffer): void {
    if (this.nahrateDir === null) throw new ChybaVstupu("Nahrávanie reportov je na tomto serveri vypnuté.");
    if (!NAHRATIE_RE.test(relativna) || relativna.split("/").some((c) => c.startsWith("."))) {
      throw new ChybaVstupu("Neplatná cesta súboru reportu.");
    }
    if (TYPY[extname(relativna).toLowerCase()] === undefined) {
      throw new ChybaVstupu("Report môže byť .html alebo .md, obrázok .png, .jpg, .webp alebo .svg.");
    }
    const cesta = normalize(join(this.nahrateDir, relativna));
    if (!cesta.startsWith(this.nahrateDir + sep)) throw new ChybaVstupu("Neplatná cesta súboru reportu.");
    mkdirSync(dirname(cesta), { recursive: true });
    writeFileSync(cesta, obsah);
  }

  private najdi(relativna: string): string | null {
    for (const dir of this.priecinky()) {
      const cesta = normalize(join(dir, relativna));
      if (cesta.startsWith(dir + sep) && existsSync(cesta) && statSync(cesta).isFile()) return cesta;
    }
    return null;
  }

  private nazov(cesta: string, subor: string): string {
    const zaciatok = readFileSync(cesta, "utf8").slice(0, 4000);
    const t = /<title>([^<]*)<\/title>/i.exec(zaciatok)?.[1] ?? /^#\s+(.+)$/m.exec(zaciatok)?.[1];
    return (t ?? subor).replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
  }

  /** Token do cesty /playtesty/<token>/… — platí PLATNOST_MS. */
  token(teraz: number): string {
    const exp = String(teraz + PLATNOST_MS);
    return `${exp}.${this.podpis(exp)}`;
  }

  private podpis(exp: string): string {
    return createHmac("sha256", this.tajomstvo).update(exp).digest("base64url");
  }

  private platny(token: string, teraz: number): boolean {
    const [exp, sig] = token.split(".");
    if (exp === undefined || sig === undefined || !/^\d+$/.test(exp) || Number(exp) < teraz) return false;
    const ocakavany = Buffer.from(this.podpis(exp));
    const dany = Buffer.from(sig);
    return dany.length === ocakavany.length && timingSafeEqual(dany, ocakavany);
  }

  /** Obslúži GET /playtesty/<token>/<cesta>. `host` doplní CSP o pôvod obrázkov. */
  posli(zvysok: string, res: ServerResponse, teraz: number, host: string | undefined): void {
    const lomka = zvysok.indexOf("/");
    const token = lomka === -1 ? zvysok : zvysok.slice(0, lomka);
    if (!this.platny(token, teraz)) {
      res.writeHead(403, { "content-type": "text/plain; charset=utf-8" }).end("Odkaz na report vypršal — otvor ho znova v sekcii Playtest.");
      return;
    }
    let relativna: string;
    try {
      relativna = decodeURIComponent(zvysok.slice(lomka + 1));
    } catch {
      res.writeHead(400).end();
      return;
    }
    const cesta = this.najdi(relativna);
    const typ = TYPY[extname(relativna).toLowerCase()];
    if (cesta === null || typ === undefined) {
      res.writeHead(404).end();
      return;
    }
    const povod = host !== undefined && /^[\w.-]+(:\d+)?$/.test(host) ? ` http://${host} https://${host}` : "";
    res.writeHead(200, {
      "content-type": typ,
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
      "cache-control": "private, no-cache",
      // Nepriehľadný pôvod: inline skript reportu beží, ale bez cookies a API aplikácie.
      "content-security-policy": [
        "sandbox allow-scripts allow-popups",
        "default-src 'none'",
        "script-src 'unsafe-inline'",
        "style-src 'unsafe-inline'",
        `img-src 'self'${povod} data:`,
        "frame-ancestors 'self'",
      ].join("; "),
    });
    res.end(readFileSync(cesta));
  }
}

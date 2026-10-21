// Hudba počas partie (Michal 2026-10-20): skladby z playlistu NaEx – PLEBS na Suno.
// Suno stream šifruje a MP3 dá len vlastníkovi skladby, preto ich Michal stiahne
// zo Suno a hudba-import.ts ich nahrá do <data>/hudba/ — hudbu servíruje
// vlastný server, nie odkaz na Suno.

import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";

export interface Skladba {
  /** SHA-256 obsahu (40 znakov) — rovnaký súbor sa uloží len raz. */
  readonly id: string;
  readonly nazov: string;
  /** Súbor v adresári hudby: <id>.<prípona>. */
  readonly subor: string;
}

export const ZOZNAM = "zoznam.json";

export const TYP_ZVUKU: Readonly<Record<string, string>> = {
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  ogg: "audio/ogg",
  opus: "audio/ogg",
  webm: "audio/webm",
  wav: "audio/wav",
};

/** Prípona podľa prvých bajtov, nie podľa názvu súboru. */
export function priponaZvuku(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf.toString("ascii", 0, 3) === "ID3" || (buf[0] === 0xff && ((buf[1] ?? 0) & 0xe0) === 0xe0)) return "mp3";
  if (buf.toString("ascii", 4, 8) === "ftyp") return "m4a";
  if (buf.toString("ascii", 0, 4) === "OggS") return "ogg";
  if (buf.readUInt32BE(0) === 0x1a45dfa3) return "webm";
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WAVE") return "wav";
  return null;
}

const SUBOR_RE = /^([0-9a-f]{40})\.([a-z0-9]{2,4})$/;

export class Hudba {
  readonly adresar: string;

  constructor(dataDir: string) {
    this.adresar = join(dataDir, "hudba");
  }

  /** Skladby v poradí zoznamu. Číta sa zakaždým — import beží aj popri serveri. */
  zoznam(): Skladba[] {
    const cesta = join(this.adresar, ZOZNAM);
    if (!existsSync(cesta)) return [];
    try {
      const data = JSON.parse(readFileSync(cesta, "utf8")) as unknown;
      if (!Array.isArray(data)) return [];
      return data.filter((s): s is Skladba => {
        const o = s as Partial<Skladba> | null;
        return (
          typeof o?.nazov === "string" &&
          typeof o.subor === "string" &&
          SUBOR_RE.test(o.subor) &&
          existsSync(join(this.adresar, o.subor))
        );
      });
    } catch {
      return [];
    }
  }

  /**
   * GET /hudba/<id>.<prípona> — s Range, bez neho Safari zvuk neprehrá a ostatné
   * prehliadače nevedia pretáčať. Id je hash obsahu, cache môže byť trvalá.
   */
  posli(subor: string, req: IncomingMessage, res: ServerResponse): void {
    const typ = TYP_ZVUKU[SUBOR_RE.exec(subor)?.[2] ?? ""];
    const cesta = join(this.adresar, subor);
    if (typ === undefined || !existsSync(cesta)) {
      res.writeHead(404).end();
      return;
    }
    const velkost = statSync(cesta).size;
    const hlavicky = {
      "content-type": typ,
      "accept-ranges": "bytes",
      "cache-control": "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
    };
    const rozsah = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range ?? ""));
    if (rozsah === null || (rozsah[1] === "" && rozsah[2] === "")) {
      res.writeHead(200, { ...hlavicky, "content-length": String(velkost) });
      createReadStream(cesta).pipe(res);
      return;
    }
    const [, od = "", po = ""] = rozsah;
    // „bytes=-500“ = posledných 500 bajtov.
    const start = od === "" ? Math.max(0, velkost - Number(po)) : Number(od);
    const koniec = od === "" || po === "" ? velkost - 1 : Math.min(Number(po), velkost - 1);
    if (start > koniec || start >= velkost) {
      res.writeHead(416, { "content-range": `bytes */${velkost}` }).end();
      return;
    }
    res.writeHead(206, {
      ...hlavicky,
      "content-length": String(koniec - start + 1),
      "content-range": `bytes ${start}-${koniec}/${velkost}`,
    });
    createReadStream(cesta, { start, end: koniec }).pipe(res);
  }
}

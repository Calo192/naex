// Hudba počas partie (Michal 2026-10-20): skladby z playlistu NaEx – PLEBS na Suno.
// Suno stream šifruje a MP3 dá len vlastníkovi skladby, preto ich Michal stiahne
// zo Suno a hudba-import.ts ich nahrá do <data>/hudba/ — hudbu servíruje
// vlastný server, nie odkaz na Suno. Rovnako sa servírujú hlášky majstra
// Melichara (Michal 2026-10-21), len z adresára <data>/melichar/.

import { createReadStream, existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import { NALADY, nazovHlasky, type NaladaMomentu } from "@naex/core";

// Text hlášky z názvu súboru ráta aj klient (hláška výučby v starom zozname bez mena).
export { nazovHlasky };

export interface Skladba {
  /** SHA-256 obsahu (40 znakov) — rovnaký súbor sa uloží len raz. */
  readonly id: string;
  readonly nazov: string;
  /** Súbor v adresári hudby: <id>.<prípona>. */
  readonly subor: string;
}

export const ZOZNAM = "zoznam.json";

/** Hláška majstra Melichara — s dĺžkou, podľa ktorej server stráži pauzu medzi hláškami. */
export interface Hlaska extends Skladba {
  readonly trvanieMs: number;
  /** Skupina = priečinok pri importe (id zo SKUPINA_RE). */
  readonly skupina?: string;
  /**
   * Názov súboru bez prípony („09_Boha“) — podľa skupiny a mena hlášku nájde výučba
   * (Michal 2026-10-27). Id je hash obsahu a nazov upravený text, ani jedno sa nedá
   * napísať do scenára. Zoznamy spred importu s menom ho nemajú.
   */
  readonly meno?: string;
}

export const SKUPINY = "skupiny.json";
/** Súbor so stránkou skupiny v jej priečinku pri importe. */
const SKUPINA = "skupina.json";

/**
 * Skupina hlášok (Michal 2026-10-23): priečinok pri importe, jeho skupina.json
 * dá názov, ikonu, farbu, kláves na soundboarde a nálady momentov, pri ktorých
 * sa Melichar ozve hláškou z nej. Kategórie sú dáta, nie kód.
 */
export interface SkupinaHlasok {
  readonly id: string;
  readonly nazov: string;
  /** Krátka ukážková hláška pod názvom. */
  readonly citat: string;
  /** Ikona soundboardu (pivo, kladivo…) alebo krátky text / emoji. */
  readonly ikona: string;
  /** Farebný token zo schemy.css bez „--“ (akcent, cervena…); klient pustí len známe. */
  readonly farba: string;
  /** Kláves 1–9 na soundboarde; null = len klik. */
  readonly klaves: string | null;
  readonly nalady: readonly NaladaMomentu[];
}

/** Id skupiny = názov priečinka: malé písmená bez diakritiky, číslice a pomlčka. */
const SKUPINA_RE = /^[a-z0-9][a-z0-9-]{0,31}$/;
const KLAVES_RE = /^[1-9]$/;

function idSkupiny(priecinok: string): string {
  return priecinok
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

const retazec = (v: unknown, max: number): string | null => (typeof v === "string" && v.trim() !== "" ? v.trim().slice(0, max) : null);

/**
 * Skupina z jej skupina.json (alebo bez neho — len id); chybné polia sa
 * nahradia predvolenými, nech jeden preklep nezhodí celý import.
 */
export function skupinaZDat(id: string, data: unknown): SkupinaHlasok {
  const o = (typeof data === "object" && data !== null ? data : {}) as Record<string, unknown>;
  const nazov = retazec(o.nazov, 40) ?? id.charAt(0).toUpperCase() + id.slice(1).replace(/-/g, " ");
  const klaves = typeof o.klaves === "string" && KLAVES_RE.test(o.klaves) ? o.klaves : null;
  const nalady = Array.isArray(o.nalady) ? NALADY.filter((n) => (o.nalady as unknown[]).includes(n)) : [];
  return {
    id,
    nazov,
    citat: retazec(o.citat, 60) ?? "",
    ikona: retazec(o.ikona, 12) ?? "fuz",
    farba: retazec(o.farba, 24) ?? "akcent",
    klaves,
    nalady,
  };
}

/** Hlášky z priečinka pri importe: skupiny a ich súbory, plus varovania pre človeka. */
export interface PriecinokHlasok {
  readonly skupiny: SkupinaHlasok[];
  readonly subory: { readonly cesta: string; readonly skupina: string }[];
  readonly varovania: string[];
}

/** Všetky súbory v priečinku aj v podpriečinkoch, abecedne — import hudby aj hlášok. */
export function* suboryVPriecinku(dir: string): Generator<string> {
  for (const meno of readdirSync(dir).sort((a, b) => a.localeCompare(b, "sk"))) {
    const cesta = join(dir, meno);
    if (statSync(cesta).isDirectory()) yield* suboryVPriecinku(cesta);
    else yield cesta;
  }
}

/** Súbory hlášok v priečinku skupiny — bez popisu skupiny (skupina.json). */
const suboryHlasok = (dir: string): string[] => [...suboryVPriecinku(dir)].filter((cesta) => basename(cesta) !== SKUPINA);

/**
 * Priečinok s hláškami: každý podpriečinok je skupina (jeho skupina.json ju
 * popíše), priečinok začínajúci „_“ (napr. _na-posudenie) sa vynechá a súbor mimo
 * skupiny tiež — hláška bez skupiny by sa na soundboarde nedala pustiť.
 * Skupiny sú zoradené podľa klávesu, potom podľa názvu; o kláves sa hlási
 * skôr abecedne prvý priečinok, ďalšia skupina s ním ostane len na klik.
 */
export function nacitajPriecinokHlasok(priecinok: string): PriecinokHlasok {
  const skupiny: SkupinaHlasok[] = [];
  const subory: { cesta: string; skupina: string }[] = [];
  const varovania: string[] = [];
  for (const meno of readdirSync(priecinok).sort((a, b) => a.localeCompare(b, "sk"))) {
    const cesta = join(priecinok, meno);
    if (!statSync(cesta).isDirectory()) {
      varovania.push(`${meno} — nie je v priečinku skupiny, vynechávam.`);
      continue;
    }
    if (meno.startsWith("_") || meno.startsWith(".")) {
      const n = suboryHlasok(cesta).length;
      varovania.push(`${meno}/ — priečinok s „_“ sa nenahráva (${n} ${n === 1 ? "súbor" : n >= 2 && n <= 4 ? "súbory" : "súborov"}).`);
      continue;
    }
    const id = idSkupiny(meno);
    if (!SKUPINA_RE.test(id) || skupiny.some((s) => s.id === id)) {
      varovania.push(`${meno}/ — z názvu sa nedá urobiť jedinečné id skupiny, vynechávam.`);
      continue;
    }
    let data: unknown = {};
    const popis = join(cesta, SKUPINA);
    if (existsSync(popis)) {
      try {
        data = JSON.parse(readFileSync(popis, "utf8"));
      } catch {
        varovania.push(`${meno}/${SKUPINA} — nie je platný JSON, skupina dostane predvolený názov a ikonu.`);
      }
    } else varovania.push(`${meno}/ — chýba ${SKUPINA}, skupina dostane predvolený názov a ikonu.`);
    let skupina = skupinaZDat(id, data);
    if (skupina.klaves !== null && skupiny.some((s) => s.klaves === skupina.klaves)) {
      varovania.push(`${meno}/ — kláves ${skupina.klaves} už má iná skupina, táto bude len na klik.`);
      skupina = { ...skupina, klaves: null };
    }
    skupiny.push(skupina);
    for (const s of suboryHlasok(cesta)) subory.push({ cesta: s, skupina: id });
  }
  const poradie = (k: string | null): number => (k === null ? 10 : Number(k));
  skupiny.sort((a, b) => poradie(a.klaves) - poradie(b.klaves) || a.nazov.localeCompare(b.nazov, "sk"));
  return { skupiny, subory, varovania };
}

/** Keď sa dĺžka zo súboru nedá zistiť (iný formát než MP3), ráta sa s touto. */
export const TRVANIE_HLASKY_NEZNAME_MS = 5_000;

// Bitrate v kb/s podľa verzie a vrstvy; index 0 = voľný, 15 = zlý.
const BITRATE_V1 = [
  [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448],
  [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384],
  [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
] as const;
const BITRATE_V2 = [
  [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256],
  [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
  [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
] as const;
const VZORKOVANIE = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] } as const;

/**
 * Dĺžka MP3 v ms — súčet rámcov (aj pri premenlivom bitrate), bez knižnice.
 * Preskočí ID3v2 a nuly na začiatku; null, keď v súbore nie je ani jeden rámec.
 */
export function trvanieMp3(subor: Buffer): number | null {
  const buf = bezUvodnychNul(subor);
  let i = 0;
  if (buf.toString("ascii", 0, 3) === "ID3" && buf.length >= 10) {
    const velkost = (((buf[6] ?? 0) & 0x7f) << 21) | (((buf[7] ?? 0) & 0x7f) << 14) | (((buf[8] ?? 0) & 0x7f) << 7) | ((buf[9] ?? 0) & 0x7f);
    i = 10 + velkost + (((buf[5] ?? 0) & 0x10) !== 0 ? 10 : 0);
  }
  let ms = 0;
  let ramcov = 0;
  while (i + 4 <= buf.length) {
    const b1 = buf[i + 1] ?? 0;
    const b2 = buf[i + 2] ?? 0;
    const verzia = (b1 >> 3) & 3;
    const vrstva = (b1 >> 1) & 3;
    const bitrateIdx = b2 >> 4;
    const vzorkovanieIdx = (b2 >> 2) & 3;
    const tabulka = verzia === 1 ? undefined : VZORKOVANIE[verzia as 0 | 2 | 3];
    const vzorkovanie = tabulka?.[vzorkovanieIdx];
    if (buf[i] !== 0xff || (b1 & 0xe0) !== 0xe0 || vrstva === 0 || bitrateIdx === 0 || bitrateIdx === 15 || vzorkovanie === undefined) {
      // Nie je to hlavička rámca (tag na konci, odpad) — hľadá sa ďalšia.
      i++;
      continue;
    }
    const v1 = verzia === 3;
    const kbps = (v1 ? BITRATE_V1 : BITRATE_V2)[3 - vrstva]?.[bitrateIdx] ?? 0;
    const vypln = (b2 >> 1) & 1;
    const vzoriek = vrstva === 3 ? 384 : vrstva === 2 || v1 ? 1152 : 576;
    const dlzka = vrstva === 3 ? (Math.floor((12_000 * kbps) / vzorkovanie) + vypln) * 4 : Math.floor(((vzoriek / 8) * 1000 * kbps) / vzorkovanie) + vypln;
    if (dlzka <= 4) {
      i++;
      continue;
    }
    ms += (vzoriek / vzorkovanie) * 1000;
    ramcov++;
    i += dlzka;
  }
  return ramcov === 0 ? null : Math.round(ms);
}

const TYP_ZVUKU: Readonly<Record<string, string>> = {
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  ogg: "audio/ogg",
  opus: "audio/ogg",
  webm: "audio/webm",
  wav: "audio/wav",
};

/**
 * Bez núl na začiatku súboru. Hlášky majstra Melichara ich majú pred prvým
 * MP3 rámcom stovky — prehliadač ich preskočí, rozpoznanie typu nie.
 */
export function bezUvodnychNul(buf: Buffer): Buffer {
  let i = 0;
  while (i < buf.length && buf[i] === 0) i++;
  return i === 0 ? buf : buf.subarray(i);
}

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
  /** Dĺžky hlášok, ktoré zoznam ešte nemá (starší import) — rátajú sa raz. */
  private readonly trvania = new Map<string, number>();

  /** podadresar: „hudba“ (skladby) alebo „melichar“ (hlášky). */
  constructor(dataDir: string, podadresar = "hudba") {
    this.adresar = join(dataDir, podadresar);
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
   * Hlášky s dĺžkou: zo zoznamu (import), inak zo súboru — aby server stihol
   * pauzu medzi hláškami aj pred novým importom.
   */
  hlasky(): Hlaska[] {
    return this.zoznam().map((s) => {
      const { trvanieMs: ulozene, skupina, meno } = s as Partial<Hlaska>;
      const zaklad = {
        id: s.id,
        nazov: s.nazov,
        subor: s.subor,
        ...(typeof skupina === "string" && SKUPINA_RE.test(skupina) ? { skupina } : {}),
        ...(typeof meno === "string" && meno !== "" ? { meno } : {}),
      };
      if (typeof ulozene === "number" && ulozene > 0) return { ...zaklad, trvanieMs: ulozene };
      let trvanieMs = this.trvania.get(s.subor);
      if (trvanieMs === undefined) {
        trvanieMs = trvanieMp3(readFileSync(join(this.adresar, s.subor))) ?? TRVANIE_HLASKY_NEZNAME_MS;
        this.trvania.set(s.subor, trvanieMs);
      }
      return { ...zaklad, trvanieMs };
    });
  }

  /** Skupiny hlášok z importu (skupiny.json) — len tie, ktoré majú aspoň jednu hlášku. */
  skupiny(): SkupinaHlasok[] {
    const cesta = join(this.adresar, SKUPINY);
    if (!existsSync(cesta)) return [];
    try {
      const data = JSON.parse(readFileSync(cesta, "utf8")) as unknown;
      if (!Array.isArray(data)) return [];
      const s = new Set(this.hlasky().map((h) => h.skupina));
      return data.flatMap((x) => {
        const id = (x as { id?: unknown } | null)?.id;
        return typeof id === "string" && SKUPINA_RE.test(id) && s.has(id) ? [skupinaZDat(id, x)] : [];
      });
    } catch {
      return [];
    }
  }

  /**
   * GET /hudba/<id>.<prípona> (hlášky /melichar/…) — s Range, bez neho Safari zvuk neprehrá a ostatné
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

// Nahrá hudbu počas partie z priečinka so zvukovými súbormi do <data>/hudba/:
//
//   npm run hudba -- "<priečinok s MP3 zo Suno>"
//   npm run melichar -- "<priečinok s hláškami>"     (→ <data>/melichar/)
//   npm run melichar -- --doplnit                     (len doplní dĺžky do zoznamu)
//
// Priečinok je celý playlist: skladby, ktoré v ňom už nie sú, sa zmažú.
// Názov skladby = názov súboru (Suno ho pri stiahnutí pomenuje podľa skladby),
// pri hláškach bez poradového čísla a s medzerami namiesto podčiarkovníkov.
// Hlášky k momentom ležia v podpriečinkoch pohoda/, smola/ a udiv/ (skupina =
// priečinok, Michal 2026-10-23; ktorý moment pustí ktorú skupinu, určuje
// HLASKY_MOMENTOV v packages/core/src/momenty.ts). Hláška priamo v priečinku
// alebo v inom podpriečinku ide len na soundboard.
// Hláška má aj dĺžku (trvanieMs) — podľa nej server stráži pauzu medzi
// hláškami zo soundboardu (Michal 2026-10-22); --doplnit ju dopíše hláškam
// nahraným pred soundboardom bez pôvodného priečinka.
// Na produkcii viď docs/NASADENIE.md.

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { SKUPINY_HLASOK } from "@naex/core";
import { Hudba, TRVANIE_HLASKY_NEZNAME_MS, ZOZNAM, bezUvodnychNul, nazovHlasky, priponaZvuku, skupinaZCesty, trvanieMp3, type Hlaska, type Skladba } from "./hudba.ts";

const PREPINACE = new Set(["--melichar", "--doplnit"]);
const hlasky = process.argv.includes("--melichar");
const dataDir = process.env.NAEX_DATA ?? fileURLToPath(new URL("../../../data", import.meta.url));
const hudba = new Hudba(dataDir, hlasky ? "melichar" : "hudba");

const trvanie = (buf: Buffer): number => trvanieMp3(buf) ?? TRVANIE_HLASKY_NEZNAME_MS;

if (process.argv.includes("--doplnit")) {
  if (!hlasky) {
    console.error("--doplnit je len pre hlášky: npm run melichar -- --doplnit");
    process.exit(1);
  }
  const doplnene = hudba.zoznam().map((s) => ({ ...s, trvanieMs: trvanie(readFileSync(join(hudba.adresar, s.subor))) }));
  writeFileSync(join(hudba.adresar, ZOZNAM), JSON.stringify(doplnene, null, 2));
  console.log(`Hlášky majstra Melichara: dĺžka doplnená ${doplnene.length} hláškam v ${hudba.adresar}.`);
  process.exit(0);
}

const argument = process.argv.slice(2).find((a) => !PREPINACE.has(a));
if (argument === undefined) {
  console.error('Použitie: npm run hudba -- "<priečinok so skladbami>"  |  npm run melichar -- "<priečinok s hláškami>"  |  npm run melichar -- --doplnit');
  process.exit(1);
}
// npm spúšťa skript v packages/server — relatívna cesta platí od miesta, kde ho človek spustil.
const priecinok = resolve(process.env.INIT_CWD ?? process.cwd(), argument);
mkdirSync(hudba.adresar, { recursive: true });

function* subory(dir: string): Generator<string> {
  for (const meno of readdirSync(dir).sort((a, b) => a.localeCompare(b, "sk"))) {
    const cesta = join(dir, meno);
    if (statSync(cesta).isDirectory()) yield* subory(cesta);
    else yield cesta;
  }
}

const skladby: (Skladba | Hlaska)[] = [];
for (const cesta of subory(priecinok)) {
  const buf = bezUvodnychNul(readFileSync(cesta));
  const pripona = priponaZvuku(buf);
  if (pripona === null) {
    console.warn(`Preskakujem ${basename(cesta)} — nie je to MP3, M4A, OGG, WebM ani WAV.`);
    continue;
  }
  const id = createHash("sha256").update(buf).digest("hex").slice(0, 40);
  if (skladby.some((s) => s.id === id)) continue;
  const subor = `${id}.${pripona}`;
  if (!existsSync(join(hudba.adresar, subor))) writeFileSync(join(hudba.adresar, subor), buf);
  const meno = basename(cesta, extname(cesta)).trim();
  if (!hlasky) {
    skladby.push({ id, nazov: meno, subor });
    continue;
  }
  const rel = relative(priecinok, cesta);
  const skupina = skupinaZCesty(rel);
  if (skupina === undefined && rel !== basename(cesta)) console.warn(`${rel} — priečinok nie je skupina (${SKUPINY_HLASOK.join(", ")}), hláška bude len na soundboarde.`);
  skladby.push({ id, nazov: nazovHlasky(meno), subor, trvanieMs: trvanie(buf), ...(skupina !== undefined ? { skupina } : {}) });
}

writeFileSync(join(hudba.adresar, ZOZNAM), JSON.stringify(skladby, null, 2));
const ostava = new Set(skladby.map((s) => s.subor));
for (const f of readdirSync(hudba.adresar)) {
  if (f !== ZOZNAM && !ostava.has(f)) rmSync(join(hudba.adresar, f));
}
if (hlasky) {
  const pocty = [...SKUPINY_HLASOK, undefined].map((sk) => `${sk ?? "len soundboard"} ${skladby.filter((s) => (s as Hlaska).skupina === sk).length}`);
  console.log(`Hlášky majstra Melichara: ${skladby.length} v ${hudba.adresar} — ${pocty.join(", ")}.`);
} else console.log(`Hudba: ${skladby.length} v ${hudba.adresar}.`);

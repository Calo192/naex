// Nahrá hudbu počas partie z priečinka so zvukovými súbormi do <data>/hudba/:
//
//   npm run hudba -- "<priečinok s MP3 zo Suno>"
//
// Priečinok je celý playlist: skladby, ktoré v ňom už nie sú, sa zmažú.
// Názov skladby = názov súboru (Suno ho pri stiahnutí pomenuje podľa skladby).
// Na produkcii viď docs/NASADENIE.md.

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Hudba, ZOZNAM, priponaZvuku, type Skladba } from "./hudba.ts";

const argument = process.argv[2];
if (argument === undefined) {
  console.error('Použitie: npm run hudba -- "<priečinok so skladbami>"');
  process.exit(1);
}
// npm spúšťa skript v packages/server — relatívna cesta platí od miesta, kde ho človek spustil.
const priecinok = resolve(process.env.INIT_CWD ?? process.cwd(), argument);
const dataDir = process.env.NAEX_DATA ?? fileURLToPath(new URL("../../../data", import.meta.url));
const hudba = new Hudba(dataDir);
mkdirSync(hudba.adresar, { recursive: true });

function* subory(dir: string): Generator<string> {
  for (const meno of readdirSync(dir).sort((a, b) => a.localeCompare(b, "sk"))) {
    const cesta = join(dir, meno);
    if (statSync(cesta).isDirectory()) yield* subory(cesta);
    else yield cesta;
  }
}

const skladby: Skladba[] = [];
for (const cesta of subory(priecinok)) {
  const buf = readFileSync(cesta);
  const pripona = priponaZvuku(buf);
  if (pripona === null) {
    console.warn(`Preskakujem ${basename(cesta)} — nie je to MP3, M4A, OGG, WebM ani WAV.`);
    continue;
  }
  const id = createHash("sha256").update(buf).digest("hex").slice(0, 40);
  if (skladby.some((s) => s.id === id)) continue;
  const subor = `${id}.${pripona}`;
  if (!existsSync(join(hudba.adresar, subor))) writeFileSync(join(hudba.adresar, subor), buf);
  skladby.push({ id, nazov: basename(cesta, extname(cesta)).trim(), subor });
}

writeFileSync(join(hudba.adresar, ZOZNAM), JSON.stringify(skladby, null, 2));
const ostava = new Set(skladby.map((s) => s.subor));
for (const f of readdirSync(hudba.adresar)) {
  if (f !== ZOZNAM && !ostava.has(f)) rmSync(join(hudba.adresar, f));
}
console.log(`Hudba: ${skladby.length} skladieb v ${hudba.adresar}.`);

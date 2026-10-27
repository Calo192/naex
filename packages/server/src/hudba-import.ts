// Nahrá hudbu počas partie z priečinka so zvukovými súbormi do <data>/hudba/:
//
//   npm run hudba -- "<priečinok s MP3 zo Suno>"
//   npm run melichar -- "<priečinok s hláškami>"     (→ <data>/melichar/)
//   npm run melichar -- --doplnit                     (len doplní dĺžky do zoznamu)
//
// Priečinok je celý playlist: skladby, ktoré v ňom už nie sú, sa zmažú.
// Názov skladby = názov súboru (Suno ho pri stiahnutí pomenuje podľa skladby),
// pri hláškach bez poradového čísla a s medzerami namiesto podčiarkovníkov.
// Hlášky ležia v priečinkoch skupín (Michal 2026-10-23): priečinok = skupina
// na soundboarde, jeho skupina.json dá názov, ikonu, farbu, kláves a nálady
// momentov (docs/NASADENIE.md 5c). Priečinok s „_“ na začiatku (_na-posudenie) sa
// nenahrá. Do <data>/melichar/ ide zoznam.json (hlášky) a skupiny.json.
// Hláška si nesie aj meno súboru bez prípony — podľa skupiny a mena ju menuje
// scenár výučby (Michal 2026-10-27).
// Hláška má aj dĺžku (trvanieMs) — podľa nej server stráži pauzu medzi
// hláškami zo soundboardu (Michal 2026-10-22); --doplnit ju dopíše hláškam
// nahraným pred soundboardom bez pôvodného priečinka.
// Na produkcii viď docs/NASADENIE.md.

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  Hudba,
  SKUPINY,
  TRVANIE_HLASKY_NEZNAME_MS,
  ZOZNAM,
  bezUvodnychNul,
  nacitajPriecinokHlasok,
  nazovHlasky,
  priponaZvuku,
  suboryVPriecinku,
  trvanieMp3,
  type Hlaska,
  type Skladba,
} from "./hudba.ts";

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

const hlaskovy = hlasky ? nacitajPriecinokHlasok(priecinok) : null;
for (const v of hlaskovy?.varovania ?? []) console.warn(v);
const vstup = hlaskovy?.subory ?? [...suboryVPriecinku(priecinok)].map((cesta) => ({ cesta, skupina: null }));

const skladby: (Skladba | Hlaska)[] = [];
for (const { cesta, skupina } of vstup) {
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
  skladby.push(skupina === null ? { id, nazov: meno, subor } : { id, nazov: nazovHlasky(meno), meno, subor, trvanieMs: trvanie(buf), skupina });
}

writeFileSync(join(hudba.adresar, ZOZNAM), JSON.stringify(skladby, null, 2));
if (hlaskovy !== null) writeFileSync(join(hudba.adresar, SKUPINY), JSON.stringify(hlaskovy.skupiny, null, 2));
const ostava = new Set(skladby.map((s) => s.subor));
for (const f of readdirSync(hudba.adresar)) {
  if (f !== ZOZNAM && f !== SKUPINY && !ostava.has(f)) rmSync(join(hudba.adresar, f));
}
if (hlaskovy !== null) {
  const pocty = hlaskovy.skupiny.map((sk) => `${sk.klaves ?? "–"} ${sk.nazov} ${skladby.filter((s) => (s as Hlaska).skupina === sk.id).length}`);
  console.log(`Hlášky majstra Melichara: ${skladby.length} v ${hudba.adresar}`);
  for (const r of pocty) console.log(`  ${r}`);
} else console.log(`Hudba: ${skladby.length} v ${hudba.adresar}.`);

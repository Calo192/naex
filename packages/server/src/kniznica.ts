// Import priečinka obrázkov do knižnice tvorcu kariet:
//
//   npm run kniznica -- "docs/NA EX/NA EX"
//
// Obrázky (jpg, png, webp) sa nahrajú ako médiá druhu „kniznica“ s názvom
// „podpriečinok/súbor“ — v tvorcovi sa dajú vybrať ako ilustrácia karty.
// Rovnaký obrázok sa uloží len raz (id = hash obsahu).

import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { otvorDb } from "./db.ts";
import { Media } from "./media.ts";

const priecinok = process.argv[2];
if (priecinok === undefined) {
  console.error('Použitie: npm run kniznica -- "<priečinok s obrázkami>"');
  process.exit(1);
}
const dataDir = process.env.NAEX_DATA ?? fileURLToPath(new URL("../../../data", import.meta.url));
const db = otvorDb(join(dataDir, "naex.sqlite"));
const media = new Media(db, dataDir);

function* subory(dir: string): Generator<string> {
  for (const meno of readdirSync(dir)) {
    const cesta = join(dir, meno);
    if (statSync(cesta).isDirectory()) yield* subory(cesta);
    else if ([".jpg", ".jpeg", ".png", ".webp"].includes(extname(meno).toLowerCase())) yield cesta;
  }
}

let n = 0;
for (const cesta of subory(priecinok)) {
  const nazov = relative(priecinok, cesta).replaceAll("\\", "/");
  try {
    media.uloz(readFileSync(cesta), "kniznica", nazov, Date.now(), ["image/jpeg", "image/png", "image/webp"]);
    n++;
  } catch (err) {
    console.warn(`Preskakujem ${nazov}: ${err instanceof Error ? err.message : String(err)}`);
  }
}
db.close();
console.log(`Do knižnice pribudlo ${n} obrázkov.`);

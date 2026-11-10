// Dorovná slovníky rozhrania podľa zdrojového sk.json (lokalizácia, Michal 2026-11-10):
// v en/pl/cs/hu.json pribudnú nové kľúče s prázdnym textom (prekladateľ ich vyplní, dovtedy
// platí slovenčina) a vypadnú kľúče, ktoré už sk.json nemá. Poradie kľúčov = poradie v sk.json.
//
//   node --experimental-strip-types --no-warnings tools/preklady/dorovnaj.ts

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = join(import.meta.dirname, "..", "..", "apps", "web", "src", "i18n");
const citaj = (j: string): Record<string, unknown> => JSON.parse(readFileSync(join(dir, `${j}.json`), "utf8")) as Record<string, unknown>;
const sk = citaj("sk");

for (const j of ["en", "pl", "cs", "hu"]) {
  const stary = citaj(j);
  const novy: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(stary)) if (k.startsWith("_")) novy[k] = v;
  let pribudlo = 0;
  for (const [k, v] of Object.entries(sk)) {
    if (k.startsWith("_")) continue;
    if (k in stary) novy[k] = stary[k];
    else {
      // Tvary počítaného slova: en a hu majú dva (1, 5), pl a cs tri ako slovenčina.
      novy[k] = typeof v === "string" ? "" : j === "en" || j === "hu" ? { "1": "", "5": "" } : { "1": "", "2": "", "5": "" };
      pribudlo++;
    }
  }
  const vypadlo = Object.keys(stary).filter((k) => !k.startsWith("_") && !(k in sk));
  writeFileSync(join(dir, `${j}.json`), `${JSON.stringify(novy, null, 2)}\n`);
  console.log(`${j}: +${pribudlo} nových, −${vypadlo.length} zastaraných${vypadlo.length > 0 ? ` (${vypadlo.join(", ")})` : ""}`);
}

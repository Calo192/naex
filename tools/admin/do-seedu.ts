// Zverejnená sada → seed servera (packages/server/seed/navrhy.json a karty/*.jpg).
//
// Prečo: produkčný server má vlastnú databázu tvorcu; nasadenie prenáša len kód.
// Server pri štarte dorovná tvorcu podľa seedu a cards.json (Obsah.dorovnajSoSeedom),
// preto pred nasadením treba seed zosúladiť s poslednou zverejnenou sadou.
//
// Použitie (z koreňa repozitára, po zverejnení a skopírovaní cards.json):
//   node --experimental-strip-types --no-warnings tools/admin/do-seedu.ts [data/naex.sqlite]

import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

interface KartaSady {
  readonly id: string;
  readonly farba: string | null;
  readonly sirkaMm: number;
  readonly vyskaMm: number;
  readonly mierkaTextu: number;
  readonly mierkaIkon: number;
  readonly kopie: number;
  readonly obrazok: { readonly plny: string; readonly nahlad: string } | null;
}

const subor = process.argv[2] ?? join("data", "naex.sqlite");
const db = new DatabaseSync(subor, { readOnly: true });
const r = db.prepare("SELECT verzia, data FROM sady ORDER BY verzia DESC LIMIT 1").get() as { verzia: number; data: string } | undefined;
if (r === undefined) throw new Error("Žiadna zverejnená sada.");
const sada = JSON.parse(r.data) as { karty: KartaSady[]; cardsJson: { source: string } };

const cards = JSON.parse(readFileSync("packages/core/data/cards.json", "utf8")) as { source: string };
if (cards.source !== sada.cardsJson.source) {
  throw new Error(`cards.json (${cards.source}) nie je kópia sady v${r.verzia} (${sada.cardsJson.source}) — najprv ju skopíruj.`);
}

const MEDIA = join("data", "media");
const SEED = join("packages", "server", "seed");
const media = (id: string): string => {
  const cesta = join(MEDIA, `${id}.jpg`);
  if (!existsSync(cesta)) throw new Error(`Ilustrácia ${id} nie je JPG v ${MEDIA}.`);
  return cesta;
};
const rovnake = (a: string, b: string): boolean => existsSync(b) && readFileSync(a).equals(readFileSync(b));

let obrazkov = 0;
const navrhy = sada.karty.map((k) => {
  if (k.obrazok !== null) {
    const plny = join(SEED, "karty", `${k.id}.jpg`);
    const nahlad = join(SEED, "karty", `${k.id}@512.jpg`);
    for (const [z, kam] of [
      [media(k.obrazok.plny), plny],
      [media(k.obrazok.nahlad), nahlad],
    ] as const) {
      if (rovnake(z, kam)) continue;
      copyFileSync(z, kam);
      obrazkov++;
    }
  }
  return {
    id: k.id,
    farba: k.farba,
    sirkaMm: k.sirkaMm,
    vyskaMm: k.vyskaMm,
    mierkaTextu: k.mierkaTextu,
    mierkaIkon: k.mierkaIkon,
    kopie: k.kopie,
    obrazok: `${k.id}.jpg`,
  };
});
writeFileSync(join(SEED, "navrhy.json"), JSON.stringify(navrhy, null, 1) + "\n");
console.log(`Seed = sada v${r.verzia}: ${navrhy.length} kariet, ${obrazkov} nových či zmenených obrázkov.`);

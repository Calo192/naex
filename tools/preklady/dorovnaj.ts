// Dorovná slovníky rozhrania podľa zdrojového sk.json (lokalizácia, Michal 2026-11-10):
// v en/pl/cs/hu.json pribudnú nové kľúče s prázdnym textom (prekladateľ ich vyplní, dovtedy
// platí slovenčina) a vypadnú kľúče, ktoré už sk.json nemá. Poradie kľúčov = poradie v sk.json.
//
// Dlhé texty (i18n/<oblasť>/, apps/web/src/i18n/dlhe.ts): zdroj výučby, nápoved a achievementov
// sa najprv vytiahne z dát jadra, potom sa preklady každej oblasti dorovnajú na zdroj. Hotový
// preklad si nechá originál, z ktorého vznikol — kde sa slovenčina medzitým zmenila, vypíše sa
// ako zastaraný (v hre ostane po slovensky, kým ho prekladateľ neopraví).
//
//   node --experimental-strip-types --no-warnings tools/preklady/dorovnaj.ts            všetko
//   node --experimental-strip-types --no-warnings tools/preklady/dorovnaj.ts oblasti    len dlhé texty

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { OBLASTI, dorovnajDlhe, textyAchievementov, textyNapovied, textyVyucby, type SuborDlhych, type ZdrojDlhych } from "../../apps/web/src/i18n/dlhe.ts";

const koren = join(import.meta.dirname, "..", "..");
const dir = join(koren, "apps", "web", "src", "i18n");
const PREKLADY = ["en", "pl", "cs", "hu"] as const;
const citajJson = (cesta: string): Record<string, unknown> => JSON.parse(readFileSync(cesta, "utf8")) as Record<string, unknown>;
const zapis = (cesta: string, v: unknown): void => writeFileSync(cesta, `${JSON.stringify(v, null, 2)}\n`);

function slovniky(): void {
  const citaj = (j: string): Record<string, unknown> => citajJson(join(dir, `${j}.json`));
  const sk = citaj("sk");
  for (const j of PREKLADY) {
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
    zapis(join(dir, `${j}.json`), novy);
    console.log(`${j}: +${pribudlo} nových, −${vypadlo.length} zastaraných${vypadlo.length > 0 ? ` (${vypadlo.join(", ")})` : ""}`);
  }
}

/** Zdroj oblastí, ktoré žijú v dátach jadra — pravidlá a pojmy majú sk.json písaný rukou. */
function zdrojZDat(): void {
  const data = (cesta: string): unknown => citajJson(join(koren, "packages", "core", "data", cesta));
  const meta = (odkial: string) => ({ _meta: { jazyk: "sk", popis: `Vytiahnuté z ${odkial} (tools/preklady/dorovnaj.ts) — neupravuj ručne, zmeň dáta a spusti dorovnaj.` } });
  zapis(join(dir, "vyucba", "sk.json"), { ...meta("packages/core/data/vyucba/prva-hra.json"), ...textyVyucby(data("vyucba/prva-hra.json") as Parameters<typeof textyVyucby>[0]) });
  zapis(join(dir, "napovedy", "sk.json"), { ...meta("packages/core/data/vyucba/napovedy.json"), ...textyNapovied(data("vyucba/napovedy.json") as Parameters<typeof textyNapovied>[0]) });
  zapis(join(dir, "achievementy", "sk.json"), { ...meta("packages/core/data/achievementy.json"), ...textyAchievementov(data("achievementy.json") as Parameters<typeof textyAchievementov>[0]) });
}

const META_PREKLADU =
  "Preklad dlhých textov: pri každom id prelož prázdne polia; pole sk je slovenský originál, z ktorého preklad vzniká — nemeň ho (keď sa slovenčina zmení, preklad sa ukáže ako zastaraný a v hre ostane slovenčina). Značky <p k=\"…\">, <strong>, <a href=\"…\"> a {parametre} ponechaj ako v origináli; pojmy podľa docs/preklady/glosar.json.";

function oblasti(): void {
  zdrojZDat();
  for (const o of OBLASTI) {
    const zdroj = Object.fromEntries(Object.entries(citajJson(join(dir, o, "sk.json"))).filter(([k]) => !k.startsWith("_"))) as ZdrojDlhych;
    for (const j of PREKLADY) {
      const cesta = join(dir, o, `${j}.json`);
      const stary = (existsSync(cesta) ? citajJson(cesta) : { _meta: { jazyk: j, popis: META_PREKLADU } }) as SuborDlhych;
      const { subor, zastarane } = dorovnajDlhe(zdroj, stary);
      zapis(cesta, subor);
      if (zastarane.length > 0) console.log(`${o}/${j}: zastarané preklady (slovenčina sa zmenila): ${zastarane.join(", ")}`);
    }
    console.log(`${o}: ${Object.keys(zdroj).length} id`);
  }
}

if (process.argv[2] !== "oblasti") slovniky();
oblasti();

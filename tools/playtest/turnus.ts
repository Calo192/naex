// Turnus playtestu: 1 až 3 partie naraz, hráčov náhodne vyberie a spáruje zo
// šiestich postáv v tools/playtest/hraci.json (Michal 2026-10-21). Každá partia
// má vlastný server (tools/playtest/zaloz.ts); zakladajú sa postupne, aby si
// nevzali ten istý port.
//
// Použitie (z koreňa repozitára):
//   node --experimental-strip-types --no-warnings tools/playtest/turnus.ts <1|2|3> [kratka|stredna|dlha]
//
// Vypíše turnus (playtest/turnus-<id>/turnus.json) a pre každú partiu reláciu,
// port a oboch hráčov so štýlom. Servery zastaví tools/playtest/ukonci.ts <relacia>.

import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

interface Postava {
  readonly kluc: string;
  readonly meno: string;
  readonly styl: string;
  readonly zameranie: string;
  readonly avatar: string;
}

const { hraci } = JSON.parse(readFileSync("tools/playtest/hraci.json", "utf8")) as { hraci: readonly Postava[] };
const MAX_PARTII = Math.floor(hraci.length / 2);

const [pocetArg = "1", dlzka = "stredna"] = process.argv.slice(2);
const pocet = Number(pocetArg);
if (!Number.isInteger(pocet) || pocet < 1 || pocet > MAX_PARTII) {
  console.error(`Počet partií musí byť 1 až ${MAX_PARTII} (${hraci.length} playtesterov, v partii dvaja).`);
  process.exit(1);
}
if (!["kratka", "stredna", "dlha"].includes(dlzka)) {
  console.error("Dĺžka hry musí byť kratka, stredna alebo dlha.");
  process.exit(1);
}

// Fisher–Yates; náhoda je tu v poriadku — nástroj, nie jadro hry.
const poradie = [...hraci];
for (let i = poradie.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));
  [poradie[i], poradie[j]] = [poradie[j] as Postava, poradie[i] as Postava];
}

const id = new Date().toISOString().slice(0, 19).replace(/[-:]/g, "").replace("T", "-");
const partie: { relacia: string; port: number; hrac1: Postava; hrac2: Postava }[] = [];
for (let n = 1; n <= pocet; n++) {
  const hrac1 = poradie[2 * n - 2] as Postava;
  const hrac2 = poradie[2 * n - 1] as Postava;
  const r = spawnSync(
    process.execPath,
    ["--experimental-strip-types", "--no-warnings", "tools/playtest/zaloz.ts", hrac1.meno, hrac2.meno, dlzka, "--id", `${id}-${n}`],
    { encoding: "utf8" },
  );
  if (r.status !== 0) {
    console.error(`Partia ${n} sa nezaložila:\n${r.stdout}${r.stderr}`);
    console.error(partie.length > 0 ? `Už bežiace servery zastav: ${partie.map((p) => `ukonci.ts ${p.relacia}`).join(", ")}` : "");
    process.exit(1);
  }
  const relacia = /Playtest založený: (\S+)/.exec(r.stdout)?.[1];
  const port = Number(/localhost:(\d+)/.exec(r.stdout)?.[1]);
  if (relacia === undefined || !Number.isInteger(port)) throw new Error(`Nečakaný výstup zaloz.ts:\n${r.stdout}`);
  partie.push({ relacia, port, hrac1, hrac2 });
}

const turnus = join("playtest", `turnus-${id}`);
mkdirSync(turnus, { recursive: true });
writeFileSync(join(turnus, "turnus.json"), `${JSON.stringify({ id, dlzka, zalozeny: new Date().toISOString(), partie }, null, 2)}\n`);

console.log(`Turnus ${id}: ${pocet} ${pocet === 1 ? "partia" : "partie"}, dĺžka ${dlzka} — ${turnus.split("\\").join("/")}/turnus.json`);
for (const [i, p] of partie.entries()) {
  console.log(`\nPartia ${i + 1}: ${p.relacia} (http://localhost:${p.port})`);
  for (const [cislo, h] of [[1, p.hrac1], [2, p.hrac2]] as const) {
    console.log(`  Hráč ${cislo}: ${h.meno} — ${h.styl}\n           Zameranie: ${h.zameranie}`);
  }
}

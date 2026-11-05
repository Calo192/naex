// Turnus playtestu štýlov (skill naex-styly, Michal 2026-11-03): 1 alebo 2 partie naraz, v každej dvaja
// hráči štýlov z tools/playtest/styly.json (ekonóm, agresor, klebetník, sabotér). Každý štýl má jeden
// AI účet, preto hrá v turnuse najviac raz — 2 partie = všetky štyri štýly, zrkadlový zápas sa nedá.
//
// Verziu hry vyberá Michal pred playtestom (2026-11-05): predvolene Vypálená (živý web, zverejnená
// sada, vetva vypalena), --zrejuca = pokusná Zrejúca (kód master, rozpracovaná sada). Každá verzia má
// vlastné denníky štýlov (tools/playtest/denniky/<verzia>/) a vlastnú maticu v histórii.
// --lokalne = dočasný lokálny server z tohto stromu, len na skúšku nástroja (do denníkov ani histórie nie).
//
// Použitie (z koreňa repozitára):
//   node --experimental-strip-types --no-warnings tools/playtest/styly.ts [1|2|<styl>-<styl>…] [kratka|stredna|dlha] [--zrejuca|--lokalne]
//
//   styly.ts 2 stredna                           dve partie, dvojice podľa histórie (najmenej hrané zápasy)
//   styly.ts ekonom-agresor                      jedna konkrétna dvojica
//   styly.ts ekonom-agresor klebetnik-saboter    dve konkrétne dvojice
//   styly.ts 2 stredna --zrejuca                 dve partie na Zrejúcej
//
// Bez čísla ani dvojíc = 2 partie. História zápasov je docs/playtesty/styly-historia.json (vedie ju
// agent naex-sudca-stylov); dvojice sa vyberajú tak, aby sa za tri turnusy odohrala celá matica.
// Partie zakladá tools/playtest/zaloz.ts, servery zastaví tools/playtest/ukonci.ts <relacia>.

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

interface Styl {
  readonly kluc: string;
  readonly nazov: string;
  readonly meno: string;
  readonly charakter: string;
}

interface ZapasHistorie {
  readonly styly: readonly [string, string];
  /** Verzia hry (vypalena | zrejuca); staré záznamy bez nej sú z Vypálenej. */
  readonly instancia?: string;
}

const { styly, hypoteza } = JSON.parse(readFileSync("tools/playtest/styly.json", "utf8")) as { styly: readonly Styl[]; hypoteza: string };
const HISTORIA = "docs/playtesty/styly-historia.json";
const DLZKY = ["kratka", "stredna", "dlha"];

const lokalne = process.argv.includes("--lokalne");
const naZrejucej = process.argv.includes("--zrejuca");
if (lokalne && naZrejucej) {
  console.error("Buď --zrejuca, alebo --lokalne — nie oboje.");
  process.exit(1);
}
const instancia = lokalne ? "lokalne" : naZrejucej ? "zrejuca" : "vypalena";
const argumenty = process.argv.slice(2).filter((a) => a !== "--lokalne" && a !== "--zrejuca");
const dlzka = argumenty.find((a) => DLZKY.includes(a)) ?? "stredna";
const zvysne = argumenty.filter((a) => !DLZKY.includes(a));

function styl(kluc: string): Styl {
  const s = styly.find((x) => x.kluc === kluc);
  if (s === undefined) {
    console.error(`Neznámy štýl „${kluc}“ — štýly sú ${styly.map((x) => x.kluc).join(", ")}.`);
    process.exit(1);
  }
  return s;
}

const kluc = (a: string, b: string): string => [a, b].sort().join("-");

function pocetyZapasov(): ReadonlyMap<string, number> {
  const pocty = new Map<string, number>();
  if (!existsSync(HISTORIA)) return pocty;
  const { zapasy } = JSON.parse(readFileSync(HISTORIA, "utf8")) as { zapasy: readonly ZapasHistorie[] };
  // Matica sa dopĺňa pre verziu, ktorá sa hrá — výsledky Vypálenej a Zrejúcej sa nemiešajú.
  for (const z of zapasy.filter((x) => (x.instancia ?? "vypalena") === instancia)) pocty.set(kluc(...z.styly), (pocty.get(kluc(...z.styly)) ?? 0) + 1);
  return pocty;
}

/** Všetky rozdelenia štýlov do dvojíc (pre štyri štýly tri). */
function parovania(zoznam: readonly string[]): readonly (readonly [string, string])[][] {
  const [prvy, ...ostatne] = zoznam;
  if (prvy === undefined) return [[]];
  return ostatne.flatMap((druhy) => parovania(ostatne.filter((x) => x !== druhy)).map((zvysok) => [[prvy, druhy] as const, ...zvysok]));
}

// Náhoda je tu v poriadku — nástroj, nie jadro hry.
const nahodny = <T>(v: readonly T[]): T => v[Math.floor(Math.random() * v.length)] as T;

let dvojice: (readonly [string, string])[];
if (zvysne.length > 0 && zvysne.every((a) => a.includes("-"))) {
  dvojice = zvysne.map((a) => {
    const [x = "", y = ""] = a.split("-");
    return [styl(x).kluc, styl(y).kluc] as const;
  });
} else {
  const pocet = Number(zvysne[0] ?? "2");
  const najviac = Math.floor(styly.length / 2);
  if (zvysne.length > 1 || !Number.isInteger(pocet) || pocet < 1 || pocet > najviac) {
    console.error(`Zadaj počet partií 1 až ${najviac} alebo dvojice <styl>-<styl> (každý štýl má jeden AI účet, v turnuse hrá najviac raz).`);
    process.exit(1);
  }
  const pocty = pocetyZapasov();
  const hrane = (d: readonly [string, string]): number => pocty.get(kluc(...d)) ?? 0;
  const moznosti = parovania(styly.map((s) => s.kluc)).map((p) =>
    [...p].sort((a, b) => hrane(a) - hrane(b) || Math.random() - 0.5).slice(0, pocet),
  );
  const sucet = (p: readonly (readonly [string, string])[]): number => p.reduce((s, d) => s + hrane(d), 0);
  const najmenej = Math.min(...moznosti.map(sucet));
  dvojice = nahodny(moznosti.filter((p) => sucet(p) === najmenej));
}

const pouzite = dvojice.flat();
if (new Set(pouzite).size !== pouzite.length) {
  console.error("Štýl smie v turnuse hrať najviac raz (jeden AI účet) — zrkadlový zápas ani dve partie toho istého štýlu sa nedajú.");
  process.exit(1);
}

const id = new Date().toISOString().slice(0, 19).replace(/[-:]/g, "").replace("T", "-");
const partie: { relacia: string; adresa: string; port?: number; hrac1: Styl; hrac2: Styl }[] = [];
for (const [n, dvojica] of dvojice.entries()) {
  // Kto je hráč 1, rozhodne náhoda — poradie v dvojici nemá znamenať výhodu.
  const [a, b] = Math.random() < 0.5 ? dvojica : ([dvojica[1], dvojica[0]] as const);
  const hrac1 = styl(a);
  const hrac2 = styl(b);
  const r = spawnSync(
    process.execPath,
    ["--experimental-strip-types", "--no-warnings", "tools/playtest/zaloz.ts", hrac1.meno, hrac2.meno, dlzka, "--id", `${id}-${n + 1}`, ...(lokalne ? [] : naZrejucej ? ["--zrejuca"] : ["--zivy"])],
    { encoding: "utf8" },
  );
  if (r.status !== 0) {
    console.error(`Partia ${n + 1} sa nezaložila:\n${r.stdout}${r.stderr}`);
    if (partie.length > 0) console.error(`Už bežiace servery zastav: ${partie.map((p) => `ukonci.ts ${p.relacia}`).join(", ")}`);
    process.exit(1);
  }
  const relacia = /Playtest založený: (\S+)/.exec(r.stdout)?.[1];
  const adresa = /Server: (\S+)/.exec(r.stdout)?.[1];
  if (relacia === undefined || adresa === undefined) throw new Error(`Nečakaný výstup zaloz.ts:\n${r.stdout}`);
  const port = /^http:\/\/localhost:(\d+)$/.exec(adresa)?.[1];
  partie.push({ relacia, adresa, ...(port === undefined ? {} : { port: Number(port) }), hrac1, hrac2 });
}

const turnus = join("playtest", `turnus-${id}`);
mkdirSync(turnus, { recursive: true });
writeFileSync(join(turnus, "turnus.json"), `${JSON.stringify({ id, druh: "styly", dlzka, instancia, zalozeny: new Date().toISOString(), hypoteza, partie }, null, 2)}\n`);

const NAZVY: Readonly<Record<string, string>> = { vypalena: "Vypálená", zrejuca: "Zrejúca", lokalne: "lokálny server (skúška nástroja)" };
const priecinokDennikov = instancia === "zrejuca" ? "zrejuca" : "vypalena";
console.log(`Turnus štýlov ${id}: ${partie.length} ${partie.length === 1 ? "partia" : "partie"}, dĺžka ${dlzka}, verzia ${NAZVY[instancia] ?? instancia} — ${turnus.split("\\").join("/")}/turnus.json`);
for (const [i, p] of partie.entries()) {
  console.log(`\nPartia ${i + 1}: ${p.relacia} (${p.adresa}) — ${p.hrac1.nazov} proti ${p.hrac2.nazov}`);
  for (const [cislo, h] of [[1, p.hrac1], [2, p.hrac2]] as const) {
    console.log(`  Hráč ${cislo}: ${h.meno} — štýl ${h.kluc} (${h.nazov})\n           Charakter: ${h.charakter}\n           Denník: ${instancia === "lokalne" ? "žiadny (skúška nástroja)" : `tools/playtest/denniky/${priecinokDennikov}/${h.kluc}.md`}`);
  }
}

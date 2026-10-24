// Mapa „paragraf pravidiel → test“ agenta naex-rozhodca (tools/rozhodca/mapa.json).
// Každé normatívne pravidlo z docs/PRAVIDLA.md má záznam: kde je, čo hovorí,
// ktoré testy ho strážia a v akom je stave. Pri ďalšom behu sa prechádzajú len
// paragrafy zmenené od commitu, ku ktorému je mapa aktuálna.
//
//   node --experimental-strip-types --no-warnings tools/rozhodca/mapa.ts prehlad     pokrytie po paragrafoch
//   node --experimental-strip-types --no-warnings tools/rozhodca/mapa.ts zmenene     paragrafy zmenené od pravidlaCommit
//   node --experimental-strip-types --no-warnings tools/rozhodca/mapa.ts over        tvar mapy a či odkazované testy existujú

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

export const STAVY = ["pokryte", "chyba-v-hre", "chyba-v-pravidlach", "nejasne", "netestovatelne"] as const;
type Stav = (typeof STAVY)[number];

interface Pravidlo {
  readonly id: string;
  /** Nadpis paragrafu z PRAVIDLA.md, napr. „10. Starší › Patronát“. */
  readonly paragraf: string;
  readonly pravidlo: string;
  readonly stav: Stav;
  /** „súbor › názov testu“. */
  readonly testy: readonly string[];
  readonly poznamka?: string;
}

interface Mapa {
  /** Commit, ku ktorému mapa zodpovedá docs/PRAVIDLA.md; null = ešte žiadny prechod. */
  readonly pravidlaCommit: string | null;
  readonly aktualizovane: string | null;
  readonly pravidla: readonly Pravidlo[];
}

const SUBOR_MAPY = new URL("./mapa.json", import.meta.url);
const PRAVIDLA = "docs/PRAVIDLA.md";

function nacitaj(): Mapa {
  return JSON.parse(readFileSync(SUBOR_MAPY, "utf8")) as Mapa;
}

/** Nadpisy PRAVIDLA.md (## a ###) s číslom riadku — paragraf je posledný nadpis nad riadkom. */
function nadpisy(text: string): { riadok: number; nazov: string }[] {
  const out: { riadok: number; nazov: string }[] = [];
  let hlavny = "";
  text.split(/\r?\n/).forEach((r, i) => {
    const m = /^(#{2,3}) (.+)$/.exec(r);
    if (m === null) return;
    const nazov = (m[2] ?? "").trim();
    if (m[1] === "##") hlavny = nazov;
    out.push({ riadok: i + 1, nazov: m[1] === "##" ? nazov : `${hlavny} › ${nazov}` });
  });
  return out;
}

function paragrafRiadku(n: { riadok: number; nazov: string }[], riadok: number): string {
  let p = "úvod";
  for (const h of n) if (h.riadok <= riadok) p = h.nazov;
  return p;
}

const [prikaz] = process.argv.slice(2);
const mapa = nacitaj();

switch (prikaz) {
  case "prehlad": {
    const podla = new Map<string, Map<Stav, number>>();
    for (const p of mapa.pravidla) {
      const m = podla.get(p.paragraf) ?? new Map<Stav, number>();
      m.set(p.stav, (m.get(p.stav) ?? 0) + 1);
      podla.set(p.paragraf, m);
    }
    const vsetky = nadpisy(readFileSync(PRAVIDLA, "utf8")).map((h) => h.nazov);
    console.log(`Mapa k commitu ${mapa.pravidlaCommit ?? "— (ešte žiadny prechod)"}, ${mapa.pravidla.length} pravidiel.\n`);
    for (const nazov of vsetky) {
      const m = podla.get(nazov);
      const text = m === undefined ? "— nezmapované" : STAVY.filter((s) => m.has(s)).map((s) => `${s} ${m.get(s)}`).join(", ");
      console.log(`  ${nazov}: ${text}`);
    }
    const mimo = [...podla.keys()].filter((k) => !vsetky.includes(k));
    if (mimo.length > 0) console.log(`\nParagrafy, ktoré v PRAVIDLA.md už nie sú: ${mimo.join("; ")}`);
    break;
  }

  case "zmenene": {
    const text = readFileSync(PRAVIDLA, "utf8");
    if (mapa.pravidlaCommit === null) {
      console.log("Mapa ešte nemá prechod — prejdi celé PRAVIDLA.md.");
      break;
    }
    const diff = spawnSync("git", ["diff", "-U0", mapa.pravidlaCommit, "--", PRAVIDLA], { encoding: "utf8" });
    if (diff.status !== 0) throw new Error(`git diff zlyhal: ${diff.stderr}`);
    const n = nadpisy(text);
    const zmenene = new Set<string>();
    for (const m of diff.stdout.matchAll(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/gm)) {
      const od = Number(m[1]);
      const pocet = m[2] === undefined ? 1 : Number(m[2]);
      for (let r = od; r < od + Math.max(1, pocet); r++) zmenene.add(paragrafRiadku(n, r));
    }
    if (zmenene.size === 0) console.log(`PRAVIDLA.md sa od ${mapa.pravidlaCommit.slice(0, 7)} nezmenili.`);
    else for (const p of zmenene) console.log(p);
    break;
  }

  case "over": {
    const chyby: string[] = [];
    const idcka = new Set<string>();
    for (const p of mapa.pravidla) {
      if (idcka.has(p.id)) chyby.push(`${p.id}: id sa opakuje`);
      idcka.add(p.id);
      if (!(STAVY as readonly string[]).includes(p.stav)) chyby.push(`${p.id}: neznámy stav ${p.stav}`);
      if (p.stav === "pokryte" && p.testy.length === 0) chyby.push(`${p.id}: pokryté bez testu`);
      for (const t of p.testy) {
        const [subor, nazov] = t.split(" › ");
        if (subor === undefined || !existsSync(subor)) chyby.push(`${p.id}: test ${t} — súbor neexistuje`);
        else if (nazov !== undefined && !readFileSync(subor, "utf8").includes(nazov)) chyby.push(`${p.id}: v ${subor} nie je test „${nazov}“`);
      }
    }
    if (chyby.length > 0) {
      console.log(chyby.join("\n"));
      process.exit(1);
    }
    console.log(`Mapa je v poriadku: ${mapa.pravidla.length} pravidiel.`);
    break;
  }

  default:
    throw new Error("Príkaz: prehlad | zmenene | over");
}

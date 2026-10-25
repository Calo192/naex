// Zošity skúseností AI hráčov (Michal 2026-10-25): playtester skúsenosť len
// navrhne vo feedback.md, spisovateľ (pri hre proti človeku sám protihráč) ju
// overí proti PRAVIDLA.md a priebehu partie a zapíše. Formát: skusenosti/README.md.
//
//   node --experimental-strip-types --no-warnings tools/playtest/skusenosti.ts over-verziu [--nasucho]
//   node --experimental-strip-types --no-warnings tools/playtest/skusenosti.ts kontrola
//   node --experimental-strip-types --no-warnings tools/playtest/skusenosti.ts cakajuce
//
// over-verziu — skúsenosti z inej verzie pravidiel, než má jadro, označí ako
//   „neoverená“; spúšťa ho spisovateľ (aj protihráč) pred každým zápisom.
// kontrola    — formát, limit položiek a verzie; pri plnom zošite vypíše, ktorá
//   položka vypadne pri ďalšom pridaní. Rovnakú kontrolu stráži test.
// cakajuce    — feedback.md v playtest/, ktorých návrhy ešte nik nezapísal
//   (followup min nemá spisovateľa, zapíšu sa pri najbližšom reporte).

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { VERZIA_PRAVIDIEL } from "../../packages/core/src/constants.ts";

export const MAX_POLOZIEK = 15;
export const STAVY = ["overená", "neoverená"] as const;
export type Stav = (typeof STAVY)[number];
/** Nadpis časti vo feedback.md; spisovateľ za ňu po zápise doplní „(zapísané <dátum>)“. */
export const NADPIS_NAVRHOV = "## Návrhy skúseností";

export const PRIECINOK = fileURLToPath(new URL("./skusenosti/", import.meta.url));

export interface Skusenost {
  readonly id: string;
  readonly pravidlo: string;
  /** Riadok nadpisu (0-based) — over-verziu mení len riadky položky. */
  readonly riadok: number;
  readonly polia: Readonly<Record<string, string>>;
}

const NADPIS_RE = /^###\s+(\S+)\s+[·—–-]\s+(.+)$/;
const POLE_RE = /^-\s+([^:]+):\s*(.*)$/;

export function nacitajZosit(text: string): readonly Skusenost[] {
  const riadky = text.split(/\r?\n/);
  const vysledok: Skusenost[] = [];
  let aktualna: { id: string; pravidlo: string; riadok: number; polia: Record<string, string> } | null = null;
  for (const [i, riadok] of riadky.entries()) {
    const nadpis = NADPIS_RE.exec(riadok);
    if (nadpis !== null) {
      if (aktualna !== null) vysledok.push(aktualna);
      aktualna = { id: nadpis[1] ?? "", pravidlo: (nadpis[2] ?? "").trim(), riadok: i, polia: {} };
      continue;
    }
    if (/^#{1,3}\s/.test(riadok)) {
      if (aktualna !== null) vysledok.push(aktualna);
      aktualna = null;
      continue;
    }
    const pole = POLE_RE.exec(riadok);
    if (aktualna !== null && pole !== null) {
      const kluc = (pole[1] ?? "").trim();
      // Opráv môže byť viac; do kontroly stačí, že nejaká je.
      aktualna.polia[kluc] = aktualna.polia[kluc] === undefined ? (pole[2] ?? "").trim() : `${aktualna.polia[kluc]}\n${(pole[2] ?? "").trim()}`;
    }
  }
  if (aktualna !== null) vysledok.push(aktualna);
  return vysledok;
}

const cislo = (s: Skusenost, pole: string): number => Number(s.polia[pole] ?? "NaN");

/** Kto vypadne pri preplnení: najmenej potvrdení oproti vyvráteniam, pri zhode neoverená, potom najstaršia. */
export function najslabsia(polozky: readonly Skusenost[]): Skusenost | undefined {
  const sila = (s: Skusenost): number => cislo(s, "potvrdenia") - cislo(s, "vyvrátenia");
  return [...polozky].sort(
    (a, b) =>
      sila(a) - sila(b) ||
      Number(b.polia["stav"] === "neoverená") - Number(a.polia["stav"] === "neoverená") ||
      (a.polia["dátum"] ?? "").localeCompare(b.polia["dátum"] ?? ""),
  )[0];
}

/** Overené skúsenosti z inej verzie pravidiel prepne na „neoverená“; verziu nechá, nech je vidieť, odkiaľ sú. */
export function oznacNeoverene(text: string, verzia: string): { readonly text: string; readonly zmenene: readonly string[] } {
  const riadky = text.split(/\r?\n/);
  const zmenene: string[] = [];
  const polozky = nacitajZosit(text);
  for (const [i, s] of polozky.entries()) {
    if (s.polia["pravidlá"] === verzia || s.polia["stav"] !== "overená") continue;
    const koniec = polozky[i + 1]?.riadok ?? riadky.length;
    for (let r = s.riadok + 1; r < koniec; r++) {
      if (/^-\s+stav:/.test(riadky[r] ?? "")) {
        riadky[r] = "- stav: neoverená";
        zmenene.push(s.id);
        break;
      }
    }
  }
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  return { text: riadky.join(eol), zmenene };
}

export function skontrolujZosit(text: string, nazov: string, verzia: string): readonly string[] {
  const chyby: string[] = [];
  const polozky = nacitajZosit(text);
  if (polozky.length > MAX_POLOZIEK) chyby.push(`${nazov}: ${polozky.length} položiek, najviac ${MAX_POLOZIEK} — vyraď najslabšiu (${najslabsia(polozky)?.id ?? "?"})`);
  const videne = new Set<string>();
  for (const s of polozky) {
    const kde = `${nazov} ${s.id}`;
    if (!new RegExp(`^${nazov}-\\d+$`).test(s.id)) chyby.push(`${kde}: id má tvar ${nazov}-<číslo>`);
    if (videne.has(s.id)) chyby.push(`${kde}: id sa opakuje`);
    videne.add(s.id);
    const stav = s.polia["stav"];
    if (!STAVY.some((x) => x === stav)) chyby.push(`${kde}: stav „${stav ?? ""}“ — povolené ${STAVY.join(", ")}`);
    const pravidla = s.polia["pravidlá"];
    if (pravidla === undefined || !/^v\d+$/.test(pravidla)) chyby.push(`${kde}: pravidlá v tvare v<číslo> (VERZIA_PRAVIDIEL)`);
    else if (pravidla !== verzia && stav === "overená") chyby.push(`${kde}: overená na ${pravidla}, jadro má ${verzia} — spusti over-verziu`);
    for (const pole of ["potvrdenia", "vyvrátenia"]) {
      if (!/^\d+$/.test(s.polia[pole] ?? "")) chyby.push(`${kde}: ${pole} má byť celé číslo`);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s.polia["dátum"] ?? "")) chyby.push(`${kde}: dátum v tvare RRRR-MM-DD`);
    for (const pole of ["partie", "prečo"]) {
      if ((s.polia[pole] ?? "") === "") chyby.push(`${kde}: chýba ${pole}`);
    }
  }
  return chyby;
}

/** Feedback, ktorý návrhy skúseností má, ale spisovateľ ich ešte neoznačil ako zapísané. */
export function maNezapisaneNavrhy(feedback: string): boolean {
  const nadpis = feedback.split(/\r?\n/).find((r) => r.startsWith(NADPIS_NAVRHOV));
  return nadpis !== undefined && !nadpis.includes("zapísané");
}

function zosity(priecinok: string): readonly string[] {
  return readdirSync(priecinok)
    .filter((f) => f.endsWith(".md") && f !== "README.md")
    .sort();
}

function main(): void {
  const [prikaz] = process.argv.slice(2);
  if (prikaz === "over-verziu") {
    const nasucho = process.argv.includes("--nasucho");
    let spolu = 0;
    for (const f of zosity(PRIECINOK)) {
      const cesta = join(PRIECINOK, f);
      const { text, zmenene } = oznacNeoverene(readFileSync(cesta, "utf8"), VERZIA_PRAVIDIEL);
      if (zmenene.length === 0) continue;
      spolu += zmenene.length;
      console.log(`${f}: neoverené ${zmenene.join(", ")}`);
      if (!nasucho) writeFileSync(cesta, text);
    }
    console.log(spolu === 0 ? `Všetky overené skúsenosti sú z pravidiel ${VERZIA_PRAVIDIEL}.` : `${nasucho ? "Označil by som" : "Označené"}: ${spolu} (pravidlá ${VERZIA_PRAVIDIEL}).`);
    return;
  }
  if (prikaz === "kontrola") {
    const chyby: string[] = [];
    for (const f of zosity(PRIECINOK)) {
      const nazov = basename(f, ".md");
      const polozky = nacitajZosit(readFileSync(join(PRIECINOK, f), "utf8"));
      chyby.push(...skontrolujZosit(readFileSync(join(PRIECINOK, f), "utf8"), nazov, VERZIA_PRAVIDIEL));
      const neoverene = polozky.filter((s) => s.polia["stav"] === "neoverená").length;
      const plny = polozky.length >= MAX_POLOZIEK ? ` — plný, pri ďalšom pridaní vypadne ${najslabsia(polozky)?.id ?? "?"}` : "";
      console.log(`${nazov}: ${polozky.length}/${MAX_POLOZIEK}${neoverene > 0 ? `, neoverené ${neoverene}` : ""}${plny}`);
    }
    for (const ch of chyby) console.error(`CHYBA ${ch}`);
    if (chyby.length > 0) process.exit(1);
    console.log(`Zošity sedia (pravidlá ${VERZIA_PRAVIDIEL}).`);
    return;
  }
  if (prikaz === "cakajuce") {
    const najdene: string[] = [];
    if (existsSync("playtest")) {
      for (const relacia of readdirSync("playtest").sort()) {
        for (const hrac of ["hrac1", "hrac2"]) {
          const cesta = join("playtest", relacia, hrac, "feedback.md");
          if (existsSync(cesta) && maNezapisaneNavrhy(readFileSync(cesta, "utf8"))) najdene.push(cesta.split("\\").join("/"));
        }
      }
    }
    console.log(najdene.length === 0 ? "Žiadne nezapísané návrhy skúseností." : najdene.join("\n"));
    return;
  }
  console.error("Použitie: skusenosti.ts over-verziu [--nasucho] | kontrola | cakajuce");
  process.exit(1);
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("tools/playtest/skusenosti.ts")) main();

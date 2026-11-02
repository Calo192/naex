// Zošity skúseností AI hráčov (Michal 2026-10-25): playtester skúsenosť len
// navrhne vo feedback.md, spisovateľ (pri hre proti človeku sám protihráč) ju
// overí proti PRAVIDLA.md a priebehu partie a zapíše. Formát: skusenosti/README.md.
//
//   node --experimental-strip-types --no-warnings tools/playtest/skusenosti.ts verzie
//   node --experimental-strip-types --no-warnings tools/playtest/skusenosti.ts citaj <zrejuca|vypalena> <zošit…>
//   node --experimental-strip-types --no-warnings tools/playtest/skusenosti.ts over-verziu [--nasucho]
//   node --experimental-strip-types --no-warnings tools/playtest/skusenosti.ts kontrola
//   node --experimental-strip-types --no-warnings tools/playtest/skusenosti.ts cakajuce
//
// Od 2026-11-02 sa hrajú dve verzie pravidiel naraz: playtesty na Zrejúcej
// (VERZIA_PRAVIDIEL jadra v master), protihráč proti ľuďom na Vypálenej (verzia
// vetvy vypalena, zapísaná v skusenosti/verzie.json). Skúsenosť je overená na
// verziách v poli „pravidlá“ a návykom je len pre hráča niektorej z nich.
//
// verzie      — verzia Zrejúcej a Vypálenej (ktorú verziu zapísať k partii).
// citaj       — zošity tak, ako ich má čítať hráč danej inštancie: overené na
//   jeho verzii, ostatné ako neoverené; hráč Vypálenej nedostane skúsenosti
//   len z novších pravidiel Zrejúcej.
// over-verziu — verziu Vypálenej dorovná z origin/vypalena (po vypálení sa tak
//   verzia Zrejúcej stane verziou Vypálenej) a skúsenosti overené len na
//   verziách, ktoré nehrá ani jedna inštancia, označí ako „neoverená“;
//   spúšťa ho spisovateľ (aj protihráč) pred každým zápisom.
// kontrola    — formát, limit položiek a verzie; pri plnom zošite vypíše, ktorá
//   položka vypadne pri ďalšom pridaní. Rovnakú kontrolu stráži test.
// cakajuce    — feedback.md v playtest/, ktorých návrhy ešte nik nezapísal
//   (followup min nemá spisovateľa, zapíšu sa pri najbližšom reporte).

import { spawnSync } from "node:child_process";
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
/** Verzia pravidiel Vypálenej — v súbore, aby ju test a cloud poznali aj bez origin/vypalena. */
export const SUBOR_VERZII = join(PRIECINOK, "verzie.json");

export const INSTANCIE = ["zrejuca", "vypalena"] as const;
export type Instancia = (typeof INSTANCIE)[number];
export type Verzie = Readonly<Record<Instancia, string>>;

const VERZIA_RE = /^v\d+$/;
const PRAVIDLA_RE = /^v\d+(, v\d+)*$/;
const poradie = (verzia: string): number => Number(verzia.slice(1));

/** Zrejúca = jadro tohto stromu (master), Vypálená = verzie.json. */
export function nacitajVerzie(subor: string = SUBOR_VERZII): Verzie {
  const vypalena = (JSON.parse(readFileSync(subor, "utf8")) as { vypalena?: unknown }).vypalena;
  if (typeof vypalena !== "string" || !VERZIA_RE.test(vypalena)) throw new Error(`${subor}: „vypalena“ má tvar v<číslo>`);
  return { zrejuca: VERZIA_PRAVIDIEL, vypalena };
}

/** Verzie, ktoré sa práve hrajú — skúsenosť overená na niektorej z nich je niekomu návykom. */
export const hraneVerzie = (v: Verzie): readonly string[] => [...new Set([v.zrejuca, v.vypalena])];

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

/** Verzie pravidiel, na ktorých je skúsenosť overená (pole „pravidlá“, napr. „v10, v11“). */
export function verzieSkusenosti(s: Skusenost): readonly string[] {
  return (s.polia["pravidlá"] ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v !== "");
}

/** Návyk pre hráča tejto verzie: overená a pole „pravidlá“ verziu obsahuje. */
export function platiPre(s: Skusenost, verzia: string): boolean {
  return s.polia["stav"] === "overená" && verzieSkusenosti(s).includes(verzia);
}

/**
 * Čo zo zošita dostane hráč danej verzie. Skúsenosť len z novších pravidiel
 * (Zrejúca pred Vypálenou) hráč Vypálenej nedostane — opiera sa o pravidlá,
 * ktoré jeho hra ešte nemá; staršie áno, ale len ako neoverené.
 */
export function rozdelPre(
  polozky: readonly Skusenost[],
  verzia: string,
): { readonly platne: readonly Skusenost[]; readonly opatrne: readonly Skusenost[]; readonly novsie: readonly Skusenost[] } {
  const lenNovsia = (s: Skusenost): boolean => {
    const v = verzieSkusenosti(s);
    return v.length > 0 && v.every((x) => poradie(x) > poradie(verzia));
  };
  const ostatne = polozky.filter((s) => !platiPre(s, verzia));
  return {
    platne: polozky.filter((s) => platiPre(s, verzia)),
    opatrne: ostatne.filter((s) => !lenNovsia(s)),
    novsie: ostatne.filter(lenNovsia),
  };
}

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

/**
 * Overené skúsenosti, ktorých žiadnu verziu už nehrá ani Zrejúca, ani Vypálená,
 * prepne na „neoverená“; verzie nechá, nech je vidieť, odkiaľ sú.
 */
export function oznacNeoverene(text: string, hrane: readonly string[]): { readonly text: string; readonly zmenene: readonly string[] } {
  const riadky = text.split(/\r?\n/);
  const zmenene: string[] = [];
  const polozky = nacitajZosit(text);
  for (const [i, s] of polozky.entries()) {
    if (s.polia["stav"] !== "overená" || verzieSkusenosti(s).some((v) => hrane.includes(v))) continue;
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

export function skontrolujZosit(text: string, nazov: string, hrane: readonly string[]): readonly string[] {
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
    if (pravidla === undefined || !PRAVIDLA_RE.test(pravidla)) chyby.push(`${kde}: pravidlá v tvare v<číslo>, viac verzií „v10, v11“ (VERZIA_PRAVIDIEL)`);
    else if (stav === "overená" && !verzieSkusenosti(s).some((v) => hrane.includes(v))) chyby.push(`${kde}: overená na ${pravidla}, hrá sa ${hrane.join(" a ")} — spusti over-verziu`);
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

/** VERZIA_PRAVIDIEL vo vetve origin/vypalena; null, keď ju git nepozná (cloud bez vetvy). */
function verziaZVetvy(): string | null {
  const r = spawnSync("git", ["show", "origin/vypalena:packages/core/src/constants.ts"], { encoding: "utf8" });
  if (r.status !== 0) return null;
  return /VERZIA_PRAVIDIEL\s*=\s*"(v\d+)"/.exec(r.stdout)?.[1] ?? null;
}

/** Riadky položky od nadpisu po ďalšiu položku či nadpis, bez prázdnych na konci. */
function textPolozky(riadky: readonly string[], s: Skusenost, polozky: readonly Skusenost[]): string {
  const dalsia = polozky.find((p) => p.riadok > s.riadok)?.riadok ?? riadky.length;
  const koniec = riadky.findIndex((r, i) => i > s.riadok && i < dalsia && /^#{1,2}\s/.test(r));
  return riadky
    .slice(s.riadok, koniec === -1 ? dalsia : koniec)
    .join("\n")
    .trimEnd();
}

function main(): void {
  const [prikaz, ...zvysok] = process.argv.slice(2);
  if (prikaz === "verzie") {
    const v = nacitajVerzie();
    console.log(`Zrejúca (master, playtesty): ${v.zrejuca}\nVypálená (vetva vypalena, protihráč proti ľuďom): ${v.vypalena}`);
    return;
  }
  if (prikaz === "citaj") {
    const [instancia, ...mena] = zvysok;
    if (!INSTANCIE.some((x) => x === instancia) || mena.length === 0) {
      console.error("Použitie: skusenosti.ts citaj <zrejuca|vypalena> <zošit…>   (napr. citaj vypalena protihrac spolocne)");
      process.exit(1);
    }
    const verzia = nacitajVerzie()[instancia as Instancia];
    for (const meno of mena) {
      const text = readFileSync(join(PRIECINOK, `${basename(meno, ".md")}.md`), "utf8");
      const riadky = text.split(/\r?\n/);
      const polozky = nacitajZosit(text);
      const { platne, opatrne, novsie } = rozdelPre(polozky, verzia);
      console.log(`# Zošit ${basename(meno, ".md")} — pre ${instancia === "zrejuca" ? "Zrejúcu" : "Vypálenú"} (pravidlá ${verzia})\n`);
      console.log(`## Návyky — overené na ${verzia} (${platne.length})\n`);
      for (const s of platne) console.log(`${textPolozky(riadky, s, polozky)}\n`);
      console.log(`## Neoverené pre ${verzia} — najprv porovnaj s PRAVIDLA.md, skúšaj len kde chyba veľa nestojí (${opatrne.length})\n`);
      for (const s of opatrne) console.log(`${textPolozky(riadky, s, polozky)}\n`);
      if (novsie.length > 0) console.log(`(Vynechané — len z novších pravidiel, než hráš: ${novsie.map((s) => s.id).join(", ")})\n`);
    }
    return;
  }
  if (prikaz === "over-verziu") {
    const nasucho = process.argv.includes("--nasucho");
    let verzie = nacitajVerzie();
    const zVetvy = verziaZVetvy();
    if (zVetvy === null) console.log(`origin/vypalena nepoznám — Vypálená ostáva ${verzie.vypalena} (verzie.json).`);
    else if (zVetvy !== verzie.vypalena) {
      console.log(`Vypálená: ${verzie.vypalena} → ${zVetvy} (origin/vypalena)${nasucho ? " — nasucho, verzie.json nemením" : ""}.`);
      if (!nasucho) writeFileSync(SUBOR_VERZII, `${JSON.stringify({ vypalena: zVetvy }, null, 2)}\n`);
      verzie = { ...verzie, vypalena: zVetvy };
    }
    const hrane = hraneVerzie(verzie);
    let spolu = 0;
    for (const f of zosity(PRIECINOK)) {
      const cesta = join(PRIECINOK, f);
      const { text, zmenene } = oznacNeoverene(readFileSync(cesta, "utf8"), hrane);
      if (zmenene.length === 0) continue;
      spolu += zmenene.length;
      console.log(`${f}: neoverené ${zmenene.join(", ")}`);
      if (!nasucho) writeFileSync(cesta, text);
    }
    const kde = `Zrejúca ${verzie.zrejuca}, Vypálená ${verzie.vypalena}`;
    console.log(spolu === 0 ? `Všetky overené skúsenosti sú z hraných pravidiel (${kde}).` : `${nasucho ? "Označil by som" : "Označené"}: ${spolu} (${kde}).`);
    return;
  }
  if (prikaz === "kontrola") {
    const verzie = nacitajVerzie();
    const hrane = hraneVerzie(verzie);
    const chyby: string[] = [];
    if (poradie(verzie.vypalena) > poradie(verzie.zrejuca)) chyby.push(`verzie.json: Vypálená ${verzie.vypalena} je novšia než Zrejúca ${verzie.zrejuca} — spusti over-verziu`);
    for (const f of zosity(PRIECINOK)) {
      const nazov = basename(f, ".md");
      const text = readFileSync(join(PRIECINOK, f), "utf8");
      const polozky = nacitajZosit(text);
      chyby.push(...skontrolujZosit(text, nazov, hrane));
      const neoverene = polozky.filter((s) => s.polia["stav"] === "neoverená").length;
      const plny = polozky.length >= MAX_POLOZIEK ? ` — plný, pri ďalšom pridaní vypadne ${najslabsia(polozky)?.id ?? "?"}` : "";
      const pre = INSTANCIE.map((i) => `${i} ${polozky.filter((s) => platiPre(s, verzie[i])).length}`).join(", ");
      console.log(`${nazov}: ${polozky.length}/${MAX_POLOZIEK} (návyky: ${pre})${neoverene > 0 ? `, neoverené ${neoverene}` : ""}${plny}`);
    }
    for (const ch of chyby) console.error(`CHYBA ${ch}`);
    if (chyby.length > 0) process.exit(1);
    console.log(`Zošity sedia (Zrejúca ${verzie.zrejuca}, Vypálená ${verzie.vypalena}).`);
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
  console.error("Použitie: skusenosti.ts verzie | citaj <zrejuca|vypalena> <zošit…> | over-verziu [--nasucho] | kontrola | cakajuce");
  process.exit(1);
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("tools/playtest/skusenosti.ts")) main();

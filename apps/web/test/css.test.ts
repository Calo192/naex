// Stráž CSS (Leader 2026-10-23): pri zlúčení dvoch vetiev sa v hra.css odsekol koniec
// @keyframes a začiatok @media — build to zniesol len s varovaním css-syntax-error
// a pravidlá za tým potichu prestali platiť. Test zlyhá, keď niektorý súbor
// apps/web/src/**/*.css nemá vyvážené zátvorky, nesie značky konfliktu, alebo keď
// ho esbuild (ten istý, čo minifikuje CSS pri vite build) nevie čisto spracovať.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { transformWithEsbuild } from "vite";
import { describe, expect, it } from "vitest";

const KOREN = fileURLToPath(new URL("../src", import.meta.url));

function cssSubory(adresar: string): string[] {
  return readdirSync(adresar).flatMap((f) => {
    const p = join(adresar, f);
    return statSync(p).isDirectory() ? cssSubory(p) : p.endsWith(".css") ? [p] : [];
  });
}

/** Chyby v zátvorkách a značky konfliktu; komentáre a reťazce sa preskočia. */
export function chybyZatvoriek(css: string): string[] {
  const chyby: string[] = [];
  const zasobnik: { znak: string; riadok: number }[] = [];
  const par: Readonly<Record<string, string>> = { "}": "{", ")": "(", "]": "[" };
  let riadok = 1;
  for (let i = 0; i < css.length; i++) {
    const c = css[i]!;
    if (c === "\n") {
      riadok++;
      if (/^(<{7}|={7}|>{7})/.test(css.slice(i + 1, i + 8))) chyby.push(`riadok ${riadok}: značka konfliktu`);
      continue;
    }
    if (c === "/" && css[i + 1] === "*") {
      const koniec = css.indexOf("*/", i + 2);
      if (koniec < 0) {
        chyby.push(`riadok ${riadok}: neuzavretý komentár`);
        break;
      }
      riadok += css.slice(i, koniec).split("\n").length - 1;
      i = koniec + 1;
      continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < css.length && css[j] !== c && css[j] !== "\n") j += css[j] === "\\" ? 2 : 1;
      if (css[j] !== c) chyby.push(`riadok ${riadok}: neuzavretý reťazec`);
      i = j;
      continue;
    }
    if (c === "{" || c === "(" || c === "[") zasobnik.push({ znak: c, riadok });
    else if (c in par) {
      const posledny = zasobnik.pop();
      if (posledny === undefined) chyby.push(`riadok ${riadok}: „${c}“ bez otváracej`);
      else if (posledny.znak !== par[c]) chyby.push(`riadok ${riadok}: „${c}“ zatvára „${posledny.znak}“ z riadku ${posledny.riadok}`);
    }
  }
  for (const z of zasobnik) chyby.push(`riadok ${z.riadok}: „${z.znak}“ sa nikde nezatvorí`);
  return chyby;
}

/** Varovania esbuildu (pri vite build sa hlásia ako css-syntax-error). */
async function varovaniaEsbuild(css: string, subor: string): Promise<string[]> {
  const r = await transformWithEsbuild(css, subor, { loader: "css", minify: true });
  return r.warnings.map((w) => `riadok ${w.location?.line ?? "?"}: ${w.text}`);
}

const subory = cssSubory(KOREN);

describe("CSS webu", () => {
  it("nájde všetky súbory", () => {
    expect(subory.length).toBeGreaterThan(5);
  });

  it.each(subory.map((s) => [relative(KOREN, s), s] as const))("%s má vyvážené zátvorky a parsuje sa bez varovania", async (_meno, cesta) => {
    const css = readFileSync(cesta, "utf8");
    expect(chybyZatvoriek(css)).toEqual([]);
    expect(await varovaniaEsbuild(css, cesta)).toEqual([]);
    // Prvé volanie štartuje službu esbuild — pod záťažou celej sady trvá aj nad 5 s.
  }, 30_000);

  it("stráž by chybu zo zlúčenia naozaj chytila", async () => {
    // Presne to, čo sa stalo: @keyframes bez konca a za ním @media bez začiatku.
    const rozbite = `@keyframes moment-odchod {\n  to {\n    opacity: 0;\n\n.pocitadlo-bitky * {\n    animation: none !important;\n  }\n}\n`;
    expect(chybyZatvoriek(rozbite).length).toBeGreaterThan(0);
    expect((await varovaniaEsbuild(rozbite, "rozbite.css")).length).toBeGreaterThan(0);
    expect(chybyZatvoriek("a {\n<<<<<<< HEAD\n}\n").some((c) => c.includes("konfliktu"))).toBe(true);
    // Zátvorky v komentári a reťazci sa nerátajú.
    expect(chybyZatvoriek(`/* { */ a::before { content: "}"; }`)).toEqual([]);
  });
});

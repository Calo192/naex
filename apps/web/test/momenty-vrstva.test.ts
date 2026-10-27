// Pečiatka momentu nad súhrnom bitky (Michal 2026-10-27: „pečiatky … sú neviditeľné a
// prekryté súhrnom z bitky“). Stráž poradia vrstiev v hra.css: pečiatka leží nad
// Počítadlom bitky a rekapituláciou (.pocitadlo-bitky), pod lupou karty; pri
// prefers-reduced-motion je bez otrasu.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const css = readFileSync(fileURLToPath(new URL("../src/hra/hra.css", import.meta.url)), "utf8");

/** z-index prvého pravidla s presne týmto selektorom (mimo @media). */
function zIndex(selektor: string): number {
  const i = css.search(new RegExp(`^${selektor.replace(/[.]/g, "\\.")} \\{`, "m"));
  expect(i, `pravidlo ${selektor}`).toBeGreaterThanOrEqual(0);
  const telo = css.slice(i, css.indexOf("}", i));
  const z = /z-index:\s*(\d+)/.exec(telo)?.[1];
  expect(z, `z-index v ${selektor}`).toBeDefined();
  return Number(z);
}

describe("pečiatka momentu", () => {
  it("leží nad súhrnom bitky aj Pitky a pod lupou karty", () => {
    expect(zIndex(".moment-vrstva")).toBeGreaterThan(zIndex(".pocitadlo-bitky"));
    expect(zIndex(".moment-vrstva")).toBeGreaterThan(zIndex(".letiaca-karta"));
    expect(zIndex(".moment-vrstva")).toBeLessThan(zIndex(".lupa"));
  });

  it("pri prefers-reduced-motion dopadne bez otrasu", () => {
    const bloky = [...css.matchAll(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/g)].map((m) => m[1] ?? "");
    const pecat = bloky.find((b) => b.includes(".moment-pecat"));
    expect(pecat).toBeDefined();
    expect(pecat).toMatch(/\.moment-pecat \{\s*animation: moment-objav/);
    expect(pecat).toMatch(/\.pocitadlo-bitky\.moment-otras \.pocitadlo-scena \{\s*animation: none/);
  });
});

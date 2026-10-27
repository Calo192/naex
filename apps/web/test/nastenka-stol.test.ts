// Nástenka na stole (Michal 2026-10-27): leží na mieste hracej plochy na plsti — bez korku
// a pripináčikov, lístky ako položené karty — a pri prefers-reduced-motion sa neanimuje.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const css = readFileSync(fileURLToPath(new URL("../src/hra/spaky.css", import.meta.url)), "utf8");
const telo = (selektor: string): string => {
  const i = css.indexOf(`${selektor} {`);
  expect(i, selektor).toBeGreaterThanOrEqual(0);
  return css.slice(i, css.indexOf("}", i));
};

describe("nástenka na stole", () => {
  it("pozadie je plsť stola: bez korku, rámu a pripináčikov", () => {
    expect(telo(".vrstva-nastenky .nastenka")).toMatch(/background: none;[\s\S]*border: 0;/);
    expect(telo(".vrstva-nastenky .nastenka-listok::before")).toMatch(/display: none;/);
    expect(telo(".vrstva-nastenky")).toMatch(/position: absolute;/);
  });

  it("pri prefers-reduced-motion bez príchodu a pokladania lístkov", () => {
    const bloky = [...css.matchAll(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/g)].map((m) => m[1] ?? "");
    expect(bloky.some((b) => /\.vrstva-nastenky,\s*\.vrstva-nastenky \.nastenka-listok \{\s*animation: none;/.test(b))).toBe(true);
  });
});

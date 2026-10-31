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

  it("lístky na výber: efekt písmom stola aspoň 11,5 px, nie zmenšenou kartou (Leader 2026-10-30)", () => {
    const pismo = /font: 400 calc\(clamp\(([\d.]+)px,/.exec(telo(".ll-efekt"))?.[1];
    expect(Number(pismo)).toBeGreaterThanOrEqual(11.5);
    // Lístok na výber má šírku z rozmerNastenky aj na nízkom stole bez kariet (bez-kariet).
    expect(telo(".vrstva-nastenky .nastenka-listok.na-vyber.citatelny")).toMatch(/width: var\(--lc-sirka\);[\s\S]*max-width: none;/);
  });

  it("lístok na výber aj Koniec majú pevný rozmer karty — obsah ich nenatiahne ani nestlačí (Michal 2026-10-31)", () => {
    expect(telo(".vrstva-nastenky .nastenka-listok.na-vyber.citatelny")).toMatch(/height: var\(--lc-vyska\);/);
    const koniec = telo(".vrstva-nastenky .nastenka-listok.koniec.kartovy");
    expect(koniec).toMatch(/width: var\(--lc-sirka\);/);
    expect(koniec).toMatch(/height: var\(--lc-vyska\);/);
    expect(koniec).toMatch(/overflow: hidden;/);
    // Dlhé meno hráča sa skráti, nevytŕča z lístka.
    expect(telo(".nastenka-koniec .nk-meno")).toMatch(/text-overflow: ellipsis;/);
  });
});

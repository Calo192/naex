// Ikona priazne je krígeľ piva (Michal 2026-10-30: srdce v tejto hre nemá čo robiť) —
// vlastné SVG vo farbe rodiča, nikde v hre ani v texte jadra srdce ani emoji.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { IkonaPriazne, riadokPriazneLogu } from "../src/hra/IkonaPriazne.tsx";
import { CESTY_PRIAZNE } from "../src/hra/tvarPriazne.ts";

const koren = fileURLToPath(new URL("../../../", import.meta.url));

function zdrojaky(priecinok: string): string[] {
  return readdirSync(priecinok).flatMap((meno) => {
    const cesta = join(priecinok, meno);
    if (statSync(cesta).isDirectory()) return zdrojaky(cesta);
    return /\.(ts|tsx|css)$/.test(meno) ? [cesta] : [];
  });
}

describe("ikona priazne", () => {
  it("je vlastné SVG bez pevnej farby — farbu dá rodič", () => {
    const html = renderToStaticMarkup(createElement(IkonaPriazne));
    expect(html).toMatch(/^<svg class="ikona-priazne" viewBox="0 0 100 100" aria-hidden="true">/);
    expect(html.match(/<path /g)).toHaveLength(CESTY_PRIAZNE.length);
    expect(html).not.toMatch(/fill="#|style=/);
  });

  it("s titulom je obrázok s menom pre čítačku", () => {
    const html = renderToStaticMarkup(createElement(IkonaPriazne, { titul: "priazeň" }));
    expect(html).toContain('role="img"');
    expect(html).toContain("<title>priazeň</title>");
  });

  it("tvar sa zmestí do mriežky 0..100", () => {
    for (const d of CESTY_PRIAZNE) {
      for (const n of d.match(/-?\d+(\.\d+)?/g) ?? []) {
        expect(Math.abs(Number(n))).toBeLessThanOrEqual(100);
      }
    }
  });

  it("Log spozná záznam o novej priazni aj starý riadok so srdcom z histórie miestnosti", () => {
    expect(riadokPriazneLogu("Priazeň Farár (Svätuškár) sily 2 dostáva Jano.")).toBe("Priazeň Farár (Svätuškár) sily 2 dostáva Jano.");
    expect(riadokPriazneLogu("♥ Jano dostáva priazeň Farár (Svätuškár) sily 2.")).toBe("Jano dostáva priazeň Farár (Svätuškár) sily 2.");
    expect(riadokPriazneLogu("Priazeň Fajčiara: hráč 1 dostáva po šenku 2 cigarety.")).toBeNull();
    expect(riadokPriazneLogu("Jano vyhral bitku.")).toBeNull();
  });

  it("srdce ako symbol priazne nie je v klientovi ani v jadre", () => {
    const subory = [...zdrojaky(join(koren, "apps/web/src")), ...zdrojaky(join(koren, "packages/core/src"))];
    const so = subory.filter((s) => /[♥♡❤]/.test(readFileSync(s, "utf8")));
    expect(so).toEqual([]);
  });
});

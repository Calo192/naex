// Obsah dlaždíc dosky v strede zvislo aj vodorovne a tri počty v Kartách pod sebou
// (Michal 2026-10-30). Stráž CSS, nech sa pri zlúčení vetiev pravidlá potichu nestratia;
// polohu na stole overili snímky pri 1920, 1600, 1440 a 1366 px.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const hra = readFileSync(fileURLToPath(new URL("../src/hra/hra.css", import.meta.url)), "utf8");
const STRED = "minmax\\(0, 1fr\\) auto minmax\\(0, max-content\\) minmax\\(0, 1fr\\)";

describe("dlaždice dosky", () => {
  it("stĺpec dlaždice stojí v strede zvislo, pretečie len dole", () => {
    expect(hra).toMatch(/\n\.doska \.zdroj \{[^}]*align-items: center;\s*justify-content: safe center;/);
  });

  it("nadpis s číslom v rade (nižšie okno) leží v strede medzi dvoma voľnými stĺpcami", () => {
    expect(hra).toMatch(
      new RegExp(`\\.doska \\.zdroj:not\\(\\.zdroj-karty[^{]*\\) \\{\\s*display: grid;\\s*grid-template-columns: ${STRED};\\s*grid-template-rows: auto minmax\\(0, max-content\\);\\s*align-content: safe center;`),
    );
  });

  it("Karty: nadpis a počty v strede dlaždice", () => {
    expect(hra).toMatch(new RegExp(`\\.doska \\.zdroj-karty:not\\(\\.ako-ciel\\) \\{\\s*display: grid;\\s*grid-template-columns: ${STRED};\\s*align-content: safe center;`));
  });

  it("počty v Kartách: čísla doprava v jednom stĺpci, slová od jedného okraja", () => {
    expect(hra).toMatch(/\n\.karty-pocty \{[^}]*text-align: left;/);
    expect(hra).toMatch(/\n\.karty-pocty b \{[^}]*min-width: 1\.6em;[^}]*text-align: right;/);
  });
});

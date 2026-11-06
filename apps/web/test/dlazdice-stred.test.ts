// Obsah dlaždíc dosky v strede zvislo aj vodorovne (Michal 2026-10-30) a dlaždica Karty (2026-11-06). Stráž CSS, nech sa pri zlúčení vetiev pravidlá potichu nestratia;
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

  it("Karty (Michal 2026-11-06): veľké číslo a ruka s priznanými v strede dlaždice", () => {
    expect(hra).toMatch(/
.karty-prehlad {[^}]*align-items: center;s*justify-content: center;/);
    expect(hra).toMatch(/
.karty-rad {[^}]*text-align: left;/);
  });

  it("Karty: súperova dlaždica nie je zrkadlená, veľké číslo je vľavo na oboch stranách", () => {
    expect(hra).not.toMatch(/.superova[^{]*.karty-(prehlad|vylozi|rad)/);
  });
});

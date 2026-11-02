// Známky AI playtesterov z partií na Zrejúcej sa do /vyvoj nezapisujú, ostávajú len
// v reporte playtestu (Michal 2026-11-02). Relácia Zrejúcej má v hra.json „zrejuca“: true
// (tools/playtest/zaloz.ts --zrejuca).

import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ZNAMKY_ZREJUCEJ, jePartiaZrejucej } from "../../../tools/playtest/web.ts";

const KOREN = fileURLToPath(new URL("../../../", import.meta.url));
const FEEDBACK = ["## Hodnotenie podľa kritérií", "", "| # | kritérium | známka |", "|---|---|---|", ...Array.from({ length: 12 }, (_, i) => `| ${i + 1} | k | 7 |`)].join("\n");

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "naex-znamky-"));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

/** Relácia R s hra.json a R/hrac1/feedback.md; vráti cestu k feedback.md. */
function relacia(meno: string, hra: Record<string, unknown>): string {
  const r = join(dir, meno);
  mkdirSync(join(r, "hrac1"), { recursive: true });
  writeFileSync(join(r, "hra.json"), JSON.stringify(hra));
  writeFileSync(join(r, "hrac1", "feedback.md"), FEEDBACK);
  return join(r, "hrac1", "feedback.md");
}

describe("známky z partií na Zrejúcej", () => {
  it("relácia Zrejúcej sa pozná z hra.json, lokálna nie", () => {
    const zr = relacia("20261102-120000-1", { url: "https://zrejuca.test", zrejuca: true });
    const lok = relacia("20261102-120000-2", { port: 8800 });
    expect(jePartiaZrejucej(zr)).toBe(true);
    expect(jePartiaZrejucej(join(dir, "20261102-120000-1"))).toBe(true);
    expect(jePartiaZrejucej(lok)).toBe(false);
    expect(jePartiaZrejucej(join(dir, "nic", "hrac1", "feedback.md"))).toBe(false);
  });

  it("web.ts znamky partiu Zrejúcej nezapíše — ani sa neprihlási na web", () => {
    const zr = relacia("20261102-120000-1", { url: "https://zrejuca.test", zrejuca: true });
    // Neexistujúci web: keby sa nástroj pokúsil prihlásiť alebo zapisovať, skončí chybou.
    const r = spawnSync(
      process.execPath,
      ["--experimental-strip-types", "--no-warnings", "tools/playtest/web.ts", "znamky", "--ako", "Jano Bitkár", "--url", "http://127.0.0.1:9", zr, "--zdroj", "20261102-120000-1"],
      { cwd: KOREN, encoding: "utf8" },
    );
    expect(r.status).toBe(0);
    expect(r.stdout).toContain(ZNAMKY_ZREJUCEJ);
  });
});

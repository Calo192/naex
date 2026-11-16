import { defineConfig } from "vitest/config";
import { nastavDocasneEnv } from "./tools/docasne.ts";

// Dočasné súbory testov (os.tmpdir() v serverových testoch, vite, workery) na disk
// projektu, nie na C (Michal 2026-10-23) — workery prostredie zdedia.
nastavDocasneEnv();

export default defineConfig({
  test: {
    include: ["packages/*/test/**/*.test.ts", "apps/*/test/**/*.test.ts"],
    // Výučba Prvá hra sa prestavuje až pri vypálení v12.5 (CLAUDE.md) — testy výučby sa vrátia s novým scenárom.
    exclude: ["**/node_modules/**", "packages/core/test/vyucba.test.ts", "packages/server/test/vyucba.test.ts", "apps/web/test/zmenyVyucby.test.ts"],
    passWithNoTests: true,
    globalSetup: ["tools/vitest-upratanie.ts"],
  },
});

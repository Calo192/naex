// Upratanie %TEMP% (Leader 2026-10-23): disk C sa zaplnil profilmi headless Chromu
// a priečinkami nástrojov. Maže sa len naše a len staré; cudzie a bežiace ostane.

import { existsSync, mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { docasnyPriecinok, upratStare } from "../../../tools/docasne.ts";

describe("upratanie dočasných priečinkov", () => {
  it("zmaže len naše zvyšky staršie ako hranica", () => {
    const koren = mkdtempSync(join(tmpdir(), "naex-test-docasne-"));
    try {
      const stare = new Date(Date.now() - 3 * 60 * 60 * 1000);
      const priecinok = (meno: string, subory: readonly string[] = [], stary = true): string => {
        const p = join(koren, meno);
        mkdirSync(p, { recursive: true });
        for (const s of subory) {
          mkdirSync(join(p, s, ".."), { recursive: true });
          writeFileSync(join(p, s), "x");
        }
        if (stary) utimesSync(p, stare, stare);
        return p;
      };
      const zmaze = [
        priecinok("naex-test-abc", ["naex.sqlite"]),
        priecinok("naex-poc-abc", ["Local State"]),
        priecinok("sonda-abc"),
        priecinok("z-abc", ["Local State"]),
        priecinok("scoped_dir123_456", ["x.tmp"]),
        priecinok("tmp.abc", ["naex.tgz"]),
      ];
      const ostane = [
        priecinok("naex-novy", [], false),
        priecinok("z-cudzi", ["subor.txt"]),
        priecinok("tmp.cudzi", ["naex.tgz", "iny.txt"]),
        priecinok("iny-program"),
      ];
      const { zmazane } = upratStare(2 * 60 * 60 * 1000, koren);
      expect(zmazane).toBe(zmaze.length);
      for (const p of zmaze) expect(existsSync(p), p).toBe(false);
      for (const p of ostane) expect(existsSync(p), p).toBe(true);
    } finally {
      rmSync(koren, { recursive: true, force: true });
    }
  });

  it("dočasný priečinok zmizne po zmaz()", () => {
    const d = docasnyPriecinok("naex-test-docasny-");
    writeFileSync(join(d.cesta, "a.txt"), "x");
    d.zmaz();
    expect(existsSync(d.cesta)).toBe(false);
  });
});

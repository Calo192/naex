// Verzia jadra = hash packages/core/src (roadmapa #18): partia sa dá prehrať,
// kým sa nezmení jadro; konce riadkov ani poradie súborov hash nemenia.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PREDPONA_JADRA, hashJadra } from "../src/verziaJadra.ts";

describe("verzia jadra", () => {
  it("hash je stabilný, nezávisí od koncov riadkov a zmení sa pri zmene jadra", () => {
    const dir = mkdtempSync(join(tmpdir(), "naex-jadro-"));
    try {
      mkdirSync(join(dir, "pod"));
      writeFileSync(join(dir, "a.ts"), "export const a = 1;\nexport const b = 2;\n");
      writeFileSync(join(dir, "pod", "c.ts"), "export const c = 3;\n");
      writeFileSync(join(dir, "poznamka.md"), "nie je jadro");
      const h = hashJadra(dir);
      expect(h.startsWith(PREDPONA_JADRA)).toBe(true);
      expect(hashJadra(dir)).toBe(h);
      // CRLF (Windows) a LF (server) dajú ten istý hash.
      writeFileSync(join(dir, "a.ts"), "export const a = 1;\r\nexport const b = 2;\r\n");
      expect(hashJadra(dir)).toBe(h);
      // Iný súbor než .ts hash nemení, zmena kódu áno.
      writeFileSync(join(dir, "poznamka.md"), "iný text");
      expect(hashJadra(dir)).toBe(h);
      writeFileSync(join(dir, "pod", "c.ts"), "export const c = 4;\n");
      expect(hashJadra(dir)).not.toBe(h);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("skutočné jadro má hash, ktorý sa nedá zameniť so starým commitom", () => {
    const h = hashJadra(fileURLToPath(new URL("../../core/src", import.meta.url)));
    expect(h).toMatch(/^jadro:[0-9a-f]{16}$/);
  });
});

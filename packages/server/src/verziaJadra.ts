// Verzia jadra pre archív a prehrávač partie (roadmapa #18): hash obsahu
// packages/core/src. Partia sa dá prehrať, kým sa nezmení jadro — zmeny
// klienta či servera ju nerozbijú (nasadzuje sa aj niekoľkokrát denne).
// Konce riadkov sa zjednotia, aby Windows (CRLF) a server (LF) dali ten istý hash.

import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

/** Predpona odlišuje hash jadra od starších záznamov s commitom (tie sa prehrať nedajú). */
export const PREDPONA_JADRA = "jadro:";

export function hashJadra(adresar: string): string {
  const subory: string[] = [];
  const prejdi = (dir: string): void => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const cesta = join(dir, e.name);
      if (e.isDirectory()) prejdi(cesta);
      else if (e.name.endsWith(".ts")) subory.push(cesta);
    }
  };
  prejdi(adresar);
  const h = createHash("sha256");
  for (const s of subory.map((c) => relative(adresar, c).replace(/\\/g, "/")).sort()) {
    h.update(s);
    h.update("\0");
    h.update(readFileSync(join(adresar, s), "utf8").replace(/\r\n/g, "\n"));
    h.update("\0");
  }
  return `${PREDPONA_JADRA}${h.digest("hex").slice(0, 16)}`;
}

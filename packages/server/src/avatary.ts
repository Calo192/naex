// Predvolené avatary — dedinské trosky z seed/avatary/ — a podobizne
// offline protihráčov zo seed/avatary/boti/<id povahy>.jpg.
//
// Kto si nenahrá vlastnú fotku, dostane náhodný predvolený avatar (pri
// registrácii, pri štarte servera ak ho ešte nemá, aj po zmazaní fotky).
// Médium je jedno na obsah, takže opakovaný štart nič neduplikuje.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { randomInt } from "node:crypto";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import type { Media } from "./media.ts";

const ADRESAR = fileURLToPath(new URL("../seed/avatary/", import.meta.url));

export class Avatary {
  /** Id médií predvolených avatarov hráčov. */
  readonly hracov: readonly string[];
  private readonly botov: ReadonlyMap<string, string>;

  constructor(media: Media, teraz: number, adresar = ADRESAR) {
    const nacitaj = (dir: string): [string, string][] =>
      existsSync(dir)
        ? readdirSync(dir)
            .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
            .sort()
            .map((f) => [f.replace(/\.[^.]+$/, ""), media.uloz(readFileSync(join(dir, f)), "avatar", f, teraz, ["image/jpeg", "image/png", "image/webp"]).id])
        : [];
    this.hracov = nacitaj(adresar).map(([, id]) => id);
    this.botov = new Map(nacitaj(join(adresar, "boti")));
  }

  /** Náhodný predvolený avatar, alebo null, keď žiadne nie sú. */
  nahodny(): string | null {
    return this.hracov.length === 0 ? null : (this.hracov[randomInt(this.hracov.length)] ?? null);
  }

  /** Podobizeň offline protihráča podľa id povahy. */
  bota(povaha: string): string | null {
    return this.botov.get(povaha) ?? null;
  }
}

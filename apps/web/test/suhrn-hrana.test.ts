// Súhrn po bitke (Michal 2026-11-03): Ďalej a Preskočiť v rohu pásu sa prehliadali a nad súhrnom
// svietil pokyn a „potvrdiť“ stavby šenku, ktorá ešte nebola na rade. Tlačidlá súhrnu sú na mieste
// potvrdenia — v strede spodnej hrany stola — a kým súhrn beží, pokyn ďalšej fázy sa neukáže.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const plocha = readFileSync(new URL("../src/hra/HernaPlocha.tsx", import.meta.url), "utf8");
const linia = readFileSync(new URL("../src/hra/LiniaStarsich.tsx", import.meta.url), "utf8");

/** Telo IIFE `const <meno> = ((…) => { … })();` — po prvý riadok „  })();“. */
const telo = (meno: string): string => {
  const od = plocha.indexOf(`const ${meno}`);
  expect(od).toBeGreaterThan(-1);
  return plocha.slice(od, plocha.indexOf("\n  })();", od));
};

describe("súhrn po bitke na hrane stola", () => {
  it("pokyn súhrnu predbehne pokyn fázy (stavba šenku) a nesie Ďalej a Preskočiť v strede hrany", () => {
    const pokyn = telo("pokyn: Pokyn | null");
    const suhrn = pokyn.indexOf("if (suhrnBezi && suhrn !== null)");
    expect(suhrn).toBeGreaterThan(-1);
    expect(suhrn).toBeLessThan(pokyn.indexOf('draft.krok === "stavba"'));
    expect(suhrn).toBeLessThan(pokyn.indexOf("view.hasicVolba"));
    const vetva = pokyn.slice(suhrn, pokyn.indexOf("if (!somNaTahu && beriem)", suhrn));
    expect(vetva).toContain("akcia: dalejSuhrnu");
    expect(vetva).toContain("onClick={koniecSuhrnu}");
    expect(vetva).toContain("stred:");
  });

  it("návrh ťahu na hrane (stolTlacidla) počas súhrnu nič neukáže", () => {
    expect(telo("stolTlacidla")).toMatch(/if \([^)]*suhrnBezi\) return null;/);
  });

  it("pás súhrnu v línii starších už tlačidlá nemá", () => {
    expect(linia).not.toContain("onDalej");
    expect(linia).not.toContain("onPreskocit");
    expect(linia).not.toContain("r3-ps-tlacidla");
  });
});

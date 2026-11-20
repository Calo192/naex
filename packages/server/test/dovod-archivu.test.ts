// Detail partie ukazoval „Igor {2:vyhral|vyhrala|vyhráva} bitku…“ (UI inšpekcia W-07):
// archív ukladal dôvod konca so značkou rodu, ktorú klient v detaile nerozkladal.

import { describe, expect, it } from "vitest";
import { rodovo } from "@naex/core";
import { dovodDoArchivu } from "../src/archiv.ts";

describe("dôvod konca partie do archívu", () => {
  const dovod = `Hráč 2 ${rodovo(1, "vyhral", "vyhrala", "vyhráva")} bitku a desí naplno 4 starších — výhra strachom.`;

  it("dosadí meno aj tvar podľa rodu, bez značky {N:…}", () => {
    expect(dovodDoArchivu(dovod, ["Eva", "Igor"], ["zena", "bot"])).toBe("Igor vyhral bitku a desí naplno 4 starších — výhra strachom.");
    expect(dovodDoArchivu(dovod, ["Eva", "Jana"], [null, "zena"])).toBe("Jana vyhrala bitku a desí naplno 4 starších — výhra strachom.");
    expect(dovodDoArchivu(dovod, ["Eva", "Fero"], ["zena", null])).not.toMatch(/[{}]/);
  });
});

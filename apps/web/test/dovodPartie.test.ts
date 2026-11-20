// Partie v archíve spred 2026-11-20 nesú v dôvode značku rodu — zoznam aj detail partie
// ju musia rozložiť rovnako (UI inšpekcia W-07: detail ukazoval surovú šablónu).

import { describe, expect, it } from "vitest";
import { dovodPartie } from "../src/stranky/profil/dovod.ts";

describe("dôvod konca partie z archívu", () => {
  const stary = "Igor {2:vyhral|vyhrala|vyhráva} bitku a desí naplno 4 starších — výhra strachom.";

  it("bez rodu neutrálny tvar, bot mužský", () => {
    expect(dovodPartie(stary)).toBe("Igor vyhráva bitku a desí naplno 4 starších — výhra strachom.");
    expect(dovodPartie(stary, [null, "bot"])).toBe("Igor vyhral bitku a desí naplno 4 starších — výhra strachom.");
  });

  it("nový záznam bez značky ostane, ako je", () => {
    expect(dovodPartie("Eva sa vzdáva.")).toBe("Eva sa vzdáva.");
  });
});

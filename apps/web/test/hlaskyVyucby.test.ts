// Hlášky Melichara vo výučbe (Michal 2026-10-27): klient nájde hlášku, ktorú menuje
// scenár, podľa skupiny a mena súboru (v starom zozname podľa názvu), pri hlasitosti 0
// mlčí.

import { describe, expect, it } from "vitest";
import { hlaskaNaPrehratie, najdiHlaskuVyucby } from "../src/hra/hlaskyVyucby.ts";

const ZOZNAM = [
  { id: "a", nazov: "Boha", meno: "09_Boha", skupina: "udiv" },
  { id: "b", nazov: "Boha", meno: "boha", skupina: "nervy" },
  // Starší import bez mena — nájde sa podľa názvu zo súboru.
  { id: "c", nazov: "Sem pod2", skupina: "reci" },
  { id: "d", nazov: "Ty marha", meno: "ty_marha", skupina: "urazky" },
];

describe("výber hlášky výučby", () => {
  it("podľa skupiny a mena súboru; v zozname bez mena podľa názvu", () => {
    expect(najdiHlaskuVyucby(ZOZNAM, "udiv/09_Boha")?.id).toBe("a");
    expect(najdiHlaskuVyucby(ZOZNAM, "nervy/boha")?.id).toBe("b");
    expect(najdiHlaskuVyucby(ZOZNAM, "reci/sem_pod2")?.id).toBe("c");
    expect(najdiHlaskuVyucby(ZOZNAM, "urazky/ty_marha")?.id).toBe("d");
  });

  it("chýbajúca nahrávka, iná skupina či zlý tvar = ticho", () => {
    expect(najdiHlaskuVyucby(ZOZNAM, "udiv/neexistuje")).toBeNull();
    expect(najdiHlaskuVyucby(ZOZNAM, "pohoda/09_Boha")).toBeNull();
    expect(najdiHlaskuVyucby(ZOZNAM, "09_Boha")).toBeNull();
    expect(najdiHlaskuVyucby(ZOZNAM, null)).toBeNull();
    expect(najdiHlaskuVyucby([], "udiv/09_Boha")).toBeNull();
  });

  it("hlasitosť 0 v profile = ticho", () => {
    expect(hlaskaNaPrehratie(ZOZNAM, "udiv/09_Boha", 70)?.id).toBe("a");
    expect(hlaskaNaPrehratie(ZOZNAM, "udiv/09_Boha", 0)).toBeNull();
  });
});

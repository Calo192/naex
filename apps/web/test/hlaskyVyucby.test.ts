// Hlášky Melichara vo výučbe (Michal 2026-10-27): klient nájde hlášku, ktorú menuje
// scenár, podľa skupiny a mena súboru (v starom zozname podľa názvu), pri hlasitosti 0
// mlčí a pri ťahu bota či hry za hráča počká na ťah.

import { describe, expect, it } from "vitest";
import { hlaskaKroku, hlaskaNaPrehratie, najdiHlaskuVyucby, type KrokSHlaskou } from "../src/hra/hlaskyVyucby.ts";

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

describe("kedy zaznie hláška kroku", () => {
  const krok = (kto: KrokSHlaskou["kto"], vykonany = false, hlaska: string | null = "udiv/09_Boha"): KrokSHlaskou => ({ kto, vykonany, hlaska });

  it("info, ťah hráča a otázka s bublinou hneď; bez bubliny (Počítadlo bitky) ešte nie", () => {
    for (const kto of ["info", "hrac", "otazka"] as const) expect(hlaskaKroku(krok(kto), true)).toBe("udiv/09_Boha");
    expect(hlaskaKroku(krok("info"), false)).toBeNull();
  });

  it("ťah bota a hry za hráča až po ťahu — bublina reaguje na ťah", () => {
    for (const kto of ["bot", "auto"] as const) {
      expect(hlaskaKroku(krok(kto, false), true)).toBeNull();
      expect(hlaskaKroku(krok(kto, true), true)).toBe("udiv/09_Boha");
    }
  });

  it("krok bez hlášky a koniec výučby mlčia", () => {
    expect(hlaskaKroku(krok("info", false, null), true)).toBeNull();
    expect(hlaskaKroku(null, true)).toBeNull();
  });
});

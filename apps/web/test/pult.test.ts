// Pult majstra Melichara v bare (Michal 2026-10-25): otvorený nahradí obsah baru,
// Melichar vo výučbe či v nápovede má prednosť a stráž pauzy po vlastnej hláške ostáva.

import { describe, expect, it } from "vitest";
import { TICHO_MS, prepniPult, pultVBare, stavPauzy, zostavaPauzy } from "../src/hra/pult.ts";

describe("pult Melichara v bare", () => {
  it("zatvorený sa otvorí, otvorený zavrie", () => {
    expect(prepniPult(false, false)).toBe("otvor");
    expect(prepniPult(true, false)).toBe("zavri");
  });

  it("kým Melichar hovorí, pult sa neotvorí", () => {
    expect(prepniPult(false, true)).toBe("pocka");
  });

  it("otvorený pult Melicharovi ustúpi a po ňom sa vráti; zavrieť sa dá aj počas toho", () => {
    expect(pultVBare(true, true)).toBe(false);
    expect(pultVBare(true, false)).toBe(true);
    expect(pultVBare(false, false)).toBe(false);
    expect(prepniPult(true, true)).toBe("zavri");
  });
});

describe("pauza po vlastnej hláške", () => {
  const moja = { koniec: 10_000 };

  it("bez hlášky je pult pripravený", () => {
    expect(stavPauzy(null, 0)).toBe("pripravene");
    expect(zostavaPauzy(null, 0)).toBe(0);
  });

  it("kým hláška hrá, je „moja“, potom 2 s ticho, potom znova pripravený", () => {
    expect(stavPauzy(moja, 9_999)).toBe("moja");
    expect(stavPauzy(moja, 10_000)).toBe("odpocet");
    expect(zostavaPauzy(moja, 10_500)).toBe(TICHO_MS - 500);
    expect(stavPauzy(moja, 10_000 + TICHO_MS - 1)).toBe("odpocet");
    expect(stavPauzy(moja, 10_000 + TICHO_MS)).toBe("pripravene");
    expect(zostavaPauzy(moja, 20_000)).toBe(0);
  });
});

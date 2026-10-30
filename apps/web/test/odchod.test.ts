// Odísť z partie? vo výučbe (Michal 2026-10-25): zámok klikov kroku bez ťahu pohltil aj
// tlačidlá dialógu — ten leží mimo hlavičky — a hra na nich nereagovala.

import { describe, expect, it } from "vitest";
import { KLIKY_MIMO_ZAMKU } from "../src/hra/Vyucba.tsx";
import { ZAVES_ODCHODU, strazOdchod, strazenaPartia } from "../src/lib/odchod.ts";

describe("Odísť z partie vo výučbe", () => {
  it("zámok klikov výučby púšťa dialóg odchodu aj hlavičku webu", () => {
    const selektory = KLIKY_MIMO_ZAMKU.split(",").map((s) => s.trim());
    expect(selektory).toContain(`.${ZAVES_ODCHODU}`);
    expect(selektory).toContain(".hlavicka");
  });

  it("zámok púšťa vyhodnotenie bitky a Pitky — Ďalej po Pitke ide klikom, nielen Enterom (Michal 2026-10-30)", () => {
    const selektory = KLIKY_MIMO_ZAMKU.split(",").map((s) => s.trim());
    expect(selektory).toContain(".pocitadlo-bitky");
  });

  it("strážená partia nesie, či ide o výučbu — dialóg podľa toho nehovorí o súperovi", () => {
    expect(strazenaPartia()).toBeNull();
    const vypni = strazOdchod({ kod: "AB12", vyucba: true });
    expect(strazenaPartia()).toEqual({ kod: "AB12", vyucba: true });
    vypni();
    expect(strazenaPartia()).toBeNull();
  });

  it("vypnutie staršieho stráženia nezruší novšie", () => {
    const stare = strazOdchod({ kod: "AB12", vyucba: false });
    const nove = strazOdchod({ kod: "CD34", vyucba: false });
    stare();
    expect(strazenaPartia()?.kod).toBe("CD34");
    nove();
    expect(strazenaPartia()).toBeNull();
  });
});

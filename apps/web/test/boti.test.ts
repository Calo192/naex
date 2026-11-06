// Výber súpera v lobby (Michal 2026-11-06): predvolený je Náhodný a voľba,
// ktorú server už neponúka, sa nepošle.

import { describe, expect, it } from "vitest";
import { platnaVolbaBota, type BotNaVyber } from "../src/hra/boti.ts";

const BOTI: readonly BotNaVyber[] = [
  { id: "rudo", meno: "Rudo", popis: "Zberač.", avatar: "m1" },
  { id: "igor", meno: "Igor", popis: null, avatar: null },
];

describe("výber bota v lobby", () => {
  it("Náhodný ostáva Náhodným, ponúkaná povaha sa pošle", () => {
    expect(platnaVolbaBota(BOTI, null)).toBeNull();
    expect(platnaVolbaBota(BOTI, "igor")).toBe("igor");
  });

  it("povaha, ktorú server neponúka, sa vráti na Náhodného", () => {
    expect(platnaVolbaBota(BOTI, "zmizla")).toBeNull();
    expect(platnaVolbaBota([], "igor")).toBeNull();
  });
});

// Od zmrazenia v4 (Michal 2026-10-24) je verzia pravidiel číslo dávky, nie dátum
// zmeny — partie v archíve sa podľa nej oddelia od starších s dátumovými značkami.
// Hlavička PRAVIDLA.md musí hovoriť o tej istej verzii a dátume ako jadro, inak
// hráč na stránke Pravidlá a špecifikácia hovoria o inej verzii.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PRAVIDLA_PLATNE_OD, VERZIA_PRAVIDIEL } from "../src/constants.ts";

const pravidla = readFileSync(new URL("../../../docs/PRAVIDLA.md", import.meta.url), "utf8");

describe("verzia pravidiel", () => {
  it("je číslo dávky „vN“, nie dátumová značka starších partií", () => {
    expect(VERZIA_PRAVIDIEL).toMatch(/^v\d+$/);
    expect(VERZIA_PRAVIDIEL).not.toMatch(/^\d{4}-/);
  });

  it("dátum platnosti je skutočný dátum RRRR-MM-DD", () => {
    expect(PRAVIDLA_PLATNE_OD).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(new Date(`${PRAVIDLA_PLATNE_OD}T00:00:00Z`).toISOString().slice(0, 10)).toBe(PRAVIDLA_PLATNE_OD);
  });

  it("hlavička PRAVIDLA.md sedí s jadrom", () => {
    const hlavicka = pravidla.split(/\r?\n/).slice(0, 6).join(" ");
    expect(hlavicka).toContain(`Pravidlá ${VERZIA_PRAVIDIEL} (zmrazené ${PRAVIDLA_PLATNE_OD})`);
  });
});

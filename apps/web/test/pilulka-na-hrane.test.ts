// Pilulka pokynu leží na hornej hrane stola — čiara plste ide jej stredom (Michal 2026-10-21:
// „pečiatky na hrane stola“; 2026-10-30 visela vo výučbe celá nad stolom). Pokyn v toku (výučba,
// pokyn s kartami) má záporný spodný okraj polovice svojej výšky a obsah plste ustúpi o presah.
// Rozloženie meria headless Chrome; tu stráž CSS, nech sa pri zlúčení vetiev pravidlá nestratia.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const citaj = (subor: string): string => readFileSync(fileURLToPath(new URL(`../src/hra/${subor}`, import.meta.url)), "utf8");
const hra = citaj("hra.css");
const vyucba = citaj("vyucba.css");
const plocha = citaj("HernaPlocha.tsx");

describe("pilulka pokynu na hrane stola", () => {
  it("výšku pilulky meria HernaPlocha a presah číta ako registrovanú dĺžku", () => {
    expect(plocha).toMatch(/setProperty\("--pilulka-h"/);
    expect(plocha).toMatch(/getPropertyValue\("--pilulka-presah"\)/);
    expect(hra).toMatch(/@property --pilulka-presah \{\s*syntax: "<length>";\s*inherits: true;\s*initial-value: 0px;/);
  });

  it("výučba: pokyn v toku leží stredom na čiare, nie nad ňou", () => {
    expect(vyucba).toMatch(/body\.vyucba-bezi \.linia-obal:not\(:has\(\.zberatel-ponuka, \.vizia-karta\)\) \{\s*--pilulka-presah: max\(0px, var\(--pilulka-h, 0px\) \/ 2 - 12px\);/);
    expect(vyucba).toMatch(/margin: 0 0 calc\(var\(--pilulka-h, 30px\) \/ -2 - 1px\);/);
  });

  it("pokyn s kartami leží stredom na čiare a obsah plste ustúpi", () => {
    expect(hra).toMatch(/\.linia-stav:has\(\.zberatel-ponuka, \.vizia-karta\) \{\s*margin-bottom: calc\(var\(--pilulka-h, 32px\) \/ -2 - 1px\);/);
    expect(hra).toMatch(/\.linia-obal:has\(\.zberatel-ponuka, \.vizia-karta\) \{\s*--pilulka-presah: max\(0px, var\(--pilulka-h, 0px\) \/ 2 - 12px\);/);
    expect(hra).toMatch(/padding: calc\(12px \+ var\(--pilulka-presah, 0px\)\) 10px 10px;/);
    expect(hra).toMatch(/\.stol-plst > :is\(\.vrstva-fazy, \.vrstva-starsich, \.vrstva-nastenky\) \{\s*margin-top: var\(--pilulka-presah, 0px\);/);
  });

  it("jednoriadková pilulka mimo výučby ostáva absolútne so stredom na čiare", () => {
    expect(hra).toMatch(/\.linia-stav:not\(:has\(\.zberatel-ponuka, \.vizia-karta\)\) \{\s*top: 23px;\s*translate: -50% -50%;/);
  });
});

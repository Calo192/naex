// Os kola v strede lišty (Michal 2026-10-27, dizajn timeline-lista A): pri stole má bar jeden
// riadok, popisy krokov sa na úzkej osi skracujú a mihnutie špakov v dlaždici rešpektuje
// prefers-reduced-motion. Stráž CSS, nech sa pri zlúčení vetiev pravidlá potichu nestratia.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { klikKrokuOsi } from "../src/hra/stitokPartie.ts";

const citaj = (subor: string): string => readFileSync(fileURLToPath(new URL(`../src/hra/${subor}`, import.meta.url)), "utf8");
const hra = citaj("hra.css");
const jbar = citaj("jbar.css");
const hlavicka = citaj("hlavicka.css");

describe("os kola v lište", () => {
  it("bar bez osi má jeden riadok — výšku dostane stôl", () => {
    expect(jbar).toMatch(/\.jbar\.bez-osi \{\s*grid-template-rows: var\(--jbar-h1\);/);
  });

  it("os v lište je kontajner a pruží medzi logom a nástrojmi", () => {
    expect(hlavicka).toMatch(/\.partia-os \{\s*container: os-kola \/ inline-size;[\s\S]*?flex: 1 1 auto;/);
  });

  it("na úzkej osi sa popisy skracujú v dvoch krokoch", () => {
    expect(hra).toMatch(/@container os-kola \(max-width: 900px\) \{\s*\.priebeh-kola \.krok-dlhe \{\s*display: none;/);
    expect(hra).toMatch(/@container os-kola \(max-width: 720px\) \{\s*\.priebeh-kola \.krok-stredne \{\s*display: none;/);
  });

  it("mihnutie „+2“ v dlaždici Špaky sa pri prefers-reduced-motion neanimuje", () => {
    const bloky = [...hra.matchAll(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/g)].map((m) => m[1] ?? "");
    expect(bloky.some((b) => /\.spaky-zmena \{\s*animation: none;/.test(b))).toBe(true);
  });
});

describe("klik na krok osi", () => {
  it("Draft mimo Draftu ukáže šenok na pozretie, v Drafte nie (šenok je na stole)", () => {
    expect(klikKrokuOsi("draft", "zhromazdenie")).toBe("senok");
    expect(klikKrokuOsi("draft", "pitka")).toBe("senok");
    expect(klikKrokuOsi("draft", "draft")).toBeNull();
  });

  it("Bitka ukáže účet bitky, ostatné kroky nič", () => {
    expect(klikKrokuOsi("bitka", "volbaCiela")).toBe("ucetBitky");
    expect(klikKrokuOsi("pitka-1", "zhromazdenie")).toBeNull();
  });
});

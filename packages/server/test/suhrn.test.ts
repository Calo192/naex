// Súhrn hráča (Michal 2026-10-22): čísla od 1. partie, silné a slabé stránky
// od 5, trend od 10, priemer hráčov až od 10 ľudí s 5+ partiami.

import { describe, expect, it } from "vitest";
import type { StatistikyHraca } from "@naex/core";
import { prazdneStatistiky } from "@naex/core";
import type { PartiaSuhrnu } from "../src/suhrn.ts";
import { HRACOV_NA_PRIEMER, METRIKY, priemeryHraca, spocitajSuhrn } from "../src/suhrn.ts";

const st = (z: Partial<StatistikyHraca>): StatistikyHraca => ({ ...prazdneStatistiky(), partie: 1, ...z });

/** Partia, v ktorej hráč vyhrá väčšinu bitiek a ovládne viac lokalít ako súper. */
const silna = (i: number): PartiaSuhrnu => ({
  vysledok: "vyhra",
  body: 40 + i,
  superBody: 20,
  ja: st({ bitky: 5, bitkyVyhrane: 4, lokalityOvladnute: 4, tuheUdelene: 20, poskodenieObdrzane: 8, naex: 2 }),
  super: st({ bitky: 5, bitkyVyhrane: 1, lokalityOvladnute: 1, tuheUdelene: 9, poskodenieObdrzane: 20, naex: 2 }),
});

const hodnota = (s: ReturnType<typeof spocitajSuhrn>, kluc: string) => s.metriky.find((m) => m.kluc === kluc)!;

describe("súhrn hráča", () => {
  it("čísla od 1. partie s počtom, porovnanie so súpermi; bez stránok a trendu pri málo partiách", () => {
    const s = spocitajSuhrn([silna(0), silna(1)], [], true);
    expect(s.partii).toBe(2);
    expect(hodnota(s, "vyhry")).toMatchObject({ hodnota: 100, partii: 2, lepsie: "viac", porovnanie: { superi: 0, hraci: null }, trend: null });
    expect(hodnota(s, "bitkyVyhrane")).toMatchObject({ hodnota: 80, porovnanie: { superi: 20 } });
    expect(hodnota(s, "obdrzaneNaBitku").lepsie).toBe("menej");
    // Metriky v2 bez partieV2 sa nerátajú (staré partie).
    expect(hodnota(s, "senokKarty")).toMatchObject({ hodnota: null, partii: 0 });
    expect(s.silne).toEqual([]);
    expect(s.slabe).toEqual([]);
    expect(METRIKY.every((m) => m.popis.length > 0)).toBe(true);
  });

  it("silné a slabé stránky od 5 partií, najviac 2 + 2, cudzí ich nedostane", () => {
    const partie = Array.from({ length: 6 }, (_, i) => silna(i));
    const s = spocitajSuhrn(partie, [], true);
    expect(s.silne.length).toBeGreaterThan(0);
    expect(s.silne.length).toBeLessThanOrEqual(2);
    expect(s.silne[0]?.dokaz).toMatch(/lepšie v 6 z 6 partií/);
    expect(s.slabe).toEqual([]);
    expect(spocitajSuhrn(partie, [], false).silne).toEqual([]);
    // Obrátene: tie isté partie zo súperovej strany sú slabé stránky.
    const zSupera = partie.map((p) => ({ vysledok: "prehra" as const, body: p.superBody, superBody: p.body, ja: p.super, super: p.ja }));
    expect(spocitajSuhrn(zSupera, [], true).slabe.length).toBeGreaterThan(0);
  });

  it("trend od 10 partií; priemer hráčov až od 10 hráčov", () => {
    const novsie = Array.from({ length: 5 }, (_, i) => silna(i));
    const starsie = Array.from({ length: 5 }, (): PartiaSuhrnu => ({ ...silna(0), vysledok: "prehra" }));
    const s = spocitajSuhrn([...novsie, ...starsie], [], true);
    expect(hodnota(s, "vyhry").trend).toBe(100);
    const jeden = priemeryHraca([silna(0)]);
    expect(hodnota(spocitajSuhrn([silna(0)], Array(HRACOV_NA_PRIEMER - 1).fill(jeden), true), "vyhry").porovnanie.hraci).toBeNull();
    expect(hodnota(spocitajSuhrn([silna(0)], Array(HRACOV_NA_PRIEMER).fill(jeden), true), "vyhry").porovnanie.hraci).toBe(100);
  });
});

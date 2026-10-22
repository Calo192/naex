// Tempo partie (roadmapa #9): čas sa pripisuje fáze, v ktorej sa na príkaz
// čakalo, a hráčovi, ktorý ho poslal.

import { describe, expect, it } from "vitest";
import type { Event } from "@naex/core";
import { noveTempo, zapisPrikaz } from "../src/tempo.ts";

describe("tempo partie", () => {
  it("čas od poslednej zmeny stavu ide hráčovi, ktorý ťahal, a fáze pred príkazom", () => {
    let t = noveTempo(1000);
    t = zapisPrikaz(t, "zhromazdenie", 0, 4000, []);
    t = zapisPrikaz(t, "zhromazdenie", 1, 4500, []);
    const doPitky: Event[] = [{ type: "faza", faza: "pitka" }];
    t = zapisPrikaz(t, "zhromazdenie", 0, 10_000, doPitky);
    t = zapisPrikaz(t, "pitka", 1, 12_000, []);
    expect(t.fazy["zhromazdenie"]).toEqual({ prikazy: [2, 1], ms: [3000 + 5500, 500] });
    expect(t.fazy["pitka"]).toEqual({ prikazy: [0, 1], ms: [0, 2000] });
    expect(t.pitky).toBe(1);
    expect(t.posledny).toBe(12_000);
  });

  it("je nemenné a čas nikdy nejde do mínusu", () => {
    const t0 = noveTempo(5000);
    const t1 = zapisPrikaz(t0, "draft:stavba", 1, 4000, []);
    expect(t0.fazy).toEqual({});
    expect(t1.fazy["draft:stavba"]?.ms).toEqual([0, 0]);
  });
});

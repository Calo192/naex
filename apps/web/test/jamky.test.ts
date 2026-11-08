// Jamky na prázdnych indexoch len na otvorenej hrane línie (Michal 2026-11-08).

import { describe, expect, it } from "vitest";
import { jamkyLinie, type KartaNaKraji, type VstupJamiek } from "../src/hra/jamkyLinie.ts";

const k = (uid: number, otocena = false): KartaNaKraji => ({ uid, otocena });
const vstup = (c: Partial<VstupJamiek>): VstupJamiek => ({
  ja: 0,
  strany: [[], []],
  navrh: [[], []],
  zavreta: [false, false],
  stred: k(100),
  ...c,
});

describe("jamky v línii", () => {
  it("samotná lokalita má jamky na oboch hranách", () => {
    expect(jamkyLinie(vstup({})).get(100)).toEqual({ left: true, right: true });
  });

  it("karta so susedmi z oboch strán jamky nemá, krajná len na vonkajšej hrane", () => {
    // Moja strana vedie od lokality doľava: vonkajšia hrana mojej krajnej karty je ľavá.
    const j = jamkyLinie(vstup({ strany: [[k(1), k(2)], [k(3, true)]] }));
    expect(j.has(100)).toBe(false);
    expect(j.has(1)).toBe(false);
    expect(j.get(2)).toEqual({ left: true, right: false });
    // Súperova karta je otočená: vonkajšia (pravá z môjho pohľadu) je jej vytlačená ľavá.
    expect(j.get(3)).toEqual({ left: true, right: false });
  });

  it("z pohľadu hráča 1 je jeho strana tiež vľavo", () => {
    const j = jamkyLinie(vstup({ ja: 1, strany: [[k(1, true)], [k(2)]] }));
    expect(j.get(2)).toEqual({ left: true, right: false });
    expect(j.get(1)).toEqual({ left: true, right: false });
  });

  it("navrhnutá karta je na konci a hranu prevezme", () => {
    const j = jamkyLinie(vstup({ strany: [[k(1)], []], navrh: [[k(5), k(6)], [k(7)]] }));
    expect(j.has(1)).toBe(false);
    expect(j.has(5)).toBe(false);
    expect(j.get(6)).toEqual({ left: true, right: false });
    expect(j.get(7)).toEqual({ left: false, right: true });
    expect(j.get(100)).toBeUndefined();
  });

  it("za súperovu kartu lícom dole sa nepriloží — kraj nemá jamky", () => {
    const j = jamkyLinie(vstup({ strany: [[], [k(3, true)]], zavreta: [false, true] }));
    expect(j.has(3)).toBe(false);
    expect(j.get(100)).toEqual({ left: true, right: false });
  });

  it("otočená lokalita", () => {
    expect(jamkyLinie(vstup({ stred: k(100, true), strany: [[], [k(3, true)]] })).get(100)).toEqual({ left: false, right: true });
  });

  it("bez lokality nič", () => {
    expect(jamkyLinie(vstup({ stred: null })).size).toBe(0);
  });
});

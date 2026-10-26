// Lobby po nasadení (Michal 2026-10-26): „Miestnosť s týmto kódom neexistuje.“ svietila,
// hoci hráč kód nezadal — klient sa sám vracal do miestnosti z localStorage, ktorú
// reštart servera zmazal.

import { describe, expect, it } from "vitest";
import { reakciaNaChybu } from "../src/hra/chybaMiestnosti.ts";

const NEEXISTUJE = "Miestnosť s týmto kódom neexistuje.";

describe("chyba pri vstupe do miestnosti", () => {
  it("automatický návrat do zaniknutej miestnosti potichu zabudne uložený kód", () => {
    expect(reakciaNaChybu(NEEXISTUJE, { priStole: false, automatickyNavrat: true })).toEqual({ druh: "zabudni", ukaz: false });
    expect(reakciaNaChybu("Miestnosť je plná.", { priStole: false, automatickyNavrat: true })).toEqual({ druh: "zabudni", ukaz: false });
    expect(reakciaNaChybu("V tejto miestnosti nehráš.", { priStole: false, automatickyNavrat: true })).toEqual({ druh: "zabudni", ukaz: false });
  });

  it("kód zadaný hráčom hlášku ukáže", () => {
    expect(reakciaNaChybu(NEEXISTUJE, { priStole: false, automatickyNavrat: false })).toEqual({ druh: "zabudni", ukaz: true });
    expect(reakciaNaChybu("Miestnosť je plná.", { priStole: false, automatickyNavrat: false })).toEqual({ druh: "zabudni", ukaz: true });
  });

  it("partia, pri ktorej hráč sedel, zanikne s vysvetlením", () => {
    expect(reakciaNaChybu(NEEXISTUJE, { priStole: true, automatickyNavrat: true })).toEqual({ druh: "zanikla" });
    expect(reakciaNaChybu("Nie si v miestnosti.", { priStole: true, automatickyNavrat: false })).toEqual({ druh: "zanikla" });
  });

  it("iné chyby sa ukážu ako doteraz", () => {
    expect(reakciaNaChybu("Súper je pripojený.", { priStole: true, automatickyNavrat: false })).toEqual({ druh: "ukaz" });
    expect(reakciaNaChybu("Na hranie sa musíš prihlásiť.", { priStole: false, automatickyNavrat: true })).toEqual({ druh: "ukaz" });
  });
});

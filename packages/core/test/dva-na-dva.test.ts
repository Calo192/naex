// Formát 2 na 2 (Michal 2026-10-28, roadmapa #24): tím je hráč z 1 na 1 s dvoma
// rukami — zdroje, balíčky a kliatby sú tímu, osobná je len ruka a ťah.
// Miesto pri stole: tím = miesto % 2, člen = miesto ÷ 2.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import {
  DLZKY_HRY,
  KONSTANTY,
  clenMiesta,
  kapitan,
  kartyVRukach,
  loadGameData,
  miestaHry,
  miestoClena,
  prahCirhozyBonus,
  prahDlhuBonus,
  rukaMiesta,
  setupGame,
  timMiesta,
} from "../src/index.ts";
import type { Miesto } from "../src/index.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

describe("miesta pri stole", () => {
  it("miesta 0 a 1 sú prví členovia tímov — v 1 na 1 je miesto hráč", () => {
    const miesta: Miesto[] = [0, 1, 2, 3];
    expect(miesta.map(timMiesta)).toEqual([0, 1, 0, 1]);
    expect(miesta.map(clenMiesta)).toEqual([0, 0, 1, 1]);
    for (const m of miesta) expect(miestoClena(timMiesta(m), clenMiesta(m))).toBe(m);
  });
});

describe("príprava 2 na 2", () => {
  const s = setupGame(data, 7, { format: "2na2" });

  it("štyri miesta, každý hráč má štartovacie karty vo vlastnej ruke", () => {
    expect(s.format).toBe("2na2");
    expect(miestaHry(s)).toEqual([0, 1, 2, 3]);
    const start = Object.values(KONSTANTY.START_RUKA).reduce((a, b) => a + b, 0);
    for (const m of miestaHry(s)) expect(rukaMiesta(s, m)).toHaveLength(start);
    const uid = new Set(miestaHry(s).flatMap((m) => rukaMiesta(s, m).map((k) => k.uid)));
    expect(uid.size).toBe(4 * start);
    expect(kartyVRukach(s.hraci[0])).toHaveLength(2 * start);
  });

  it("tím začína s 3 poldeci a 4 cigaretami, prahy Dlhu a Cirhózy o 1 vyššie", () => {
    for (const h of s.hraci) {
      expect(h.poldeciPlne).toBe(3);
      expect(h.cigarety).toBe(4);
    }
    expect(prahDlhuBonus(s, 0)).toBe(1);
    expect(prahCirhozyBonus(s, 1)).toBe(1);
  });

  it("predvolená je Tretia liga", () => {
    expect(s.lokalitCelkom).toBe(DLZKY_HRY.kratka);
  });

  it("kapitáni zo semienka — v každom tíme jeden člen", () => {
    expect(s.kapitani).toBeDefined();
    expect(timMiesta(kapitan(s, 0))).toBe(0);
    expect(timMiesta(kapitan(s, 1))).toBe(1);
  });
});

describe("1 na 1 sa nemení", () => {
  const s = setupGame(data, 7);

  it("bez formátu, kapitánov a druhej ruky; prahy a zdroje ako doteraz", () => {
    expect(s.format).toBeUndefined();
    expect(s.kapitani).toBeUndefined();
    expect(miestaHry(s)).toEqual([0, 1]);
    for (const h of s.hraci) {
      expect(h.rukaDruheho).toBeUndefined();
      expect(h.poldeciPlne).toBe(KONSTANTY.START_POLDECI);
      expect(h.cigarety).toBe(KONSTANTY.START_CIGARETY);
    }
    expect(prahDlhuBonus(s, 0)).toBe(0);
    expect(kapitan(s, 1)).toBe(1);
  });
});

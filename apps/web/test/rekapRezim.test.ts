// Rekapitulácia v troch režimoch (Michal 2026-10-30): súhrn, podrobne (ikony, aj akcie, ktoré
// NA EX zdvojilo a zrušilo, pri riadkoch ×2 a ✕) a text (jedna udalosť = jeden riadok).

import { describe, expect, it } from "vitest";
import type { NaexRekapitulacie, RekapitulaciaPitky } from "@naex/core";
import { akcieNaex, rezimZoZaznamu, riadkyTextuPitky, type CastTextu } from "../src/hra/Rekapitulacia.tsx";

const NAEX: NaexRekapitulacie = {
  karty: [
    { uid: 1, defId: "vymahac", majitel: 1, dal: 0, zdvojilo: 2, zrusilo: 1, akcieZdvojene: { Rana: 1, Poldeci: 1 }, akcieZrusene: { Pecka: 1 } },
    { uid: 2, defId: "pijan", majitel: 1, dal: 1, zdvojilo: 1, zrusilo: 0, akcieZdvojene: { Rana: 1 }, akcieZrusene: {} },
    { uid: 3, defId: "hasic", majitel: 0, dal: 0, zdvojilo: 0, zrusilo: 2, akcieZdvojene: {}, akcieZrusene: { Posilnenie: 1, Rana: 1 } },
  ],
  zdvojilo: [0, 3],
  zrusilo: [2, 1],
};

describe("režim rekapitulácie", () => {
  it("uložený režim platí; bez neho starý prepínač podrobne, inak súhrn", () => {
    expect(rezimZoZaznamu("text", "1")).toBe("text");
    expect(rezimZoZaznamu(null, "1")).toBe("podrobne");
    expect(rezimZoZaznamu(null, "0")).toBe("suhrn");
    expect(rezimZoZaznamu("nezmysel", null)).toBe("suhrn");
  });
});

describe("akcie NA EX pri riadkoch ×2 a ✕", () => {
  it("strana majiteľa karty, rovnaké akcie sčítané, súčet = číslo riadku", () => {
    expect(akcieNaex(NAEX, 1, "akcieZdvojene")).toEqual([
      ["Rana", 2],
      ["Poldeci", 1],
    ]);
    expect(akcieNaex(NAEX, 1, "akcieZrusene")).toEqual([["Pecka", 1]]);
    expect(akcieNaex(NAEX, 0, "akcieZdvojene")).toEqual([]);
    for (const p of [0, 1] as const) {
      expect(akcieNaex(NAEX, p, "akcieZdvojene").reduce((a, [, n]) => a + n, 0)).toBe(NAEX.zdvojilo[p]);
      expect(akcieNaex(NAEX, p, "akcieZrusene").reduce((a, [, n]) => a + n, 0)).toBe(NAEX.zrusilo[p]);
    }
  });

  it("starší záznam bez rozpisu akcií nemá ikony", () => {
    const stary: NaexRekapitulacie = { karty: [{ uid: 1, defId: "x", majitel: 0, dal: 0, zdvojilo: 2, zrusilo: 0 }], zdvojilo: [2, 0], zrusilo: [0, 0] };
    expect(akcieNaex(stary, 0, "akcieZdvojene")).toEqual([]);
  });
});

describe("textový režim Pitky", () => {
  const r: RekapitulaciaPitky = {
    pitka: 1,
    pitkyCelkom: 3,
    naex: NAEX,
    zadlzenie: { pred: [1, 0], zoStola: [4, 0], prah: [2, 2], dlhy: [2, 0] },
    pecen: { zPitia: [0, 0], zNaex: [1, 0], poskodenie: [0, 2], poldeci: [0, 0], prah: [3, 3], cirhozy: [0, 0] },
    cigarety: { akcie: [0, 2], obmedzenie: [0, 2], cigorky: [0, 0], zisk: [0, 0] },
    vizia: [0, 0],
  };

  it("udalosti v poradí vyhodnotenia, prázdne vynechá; NA EX patrí tomu, kto ho dal", () => {
    const riadky = riadkyTextuPitky(r, [{ hrac: 1, defId: null, ciel: null }], 0);
    expect(riadky.map((x) => [x.druh, x.kto, x.krok])).toEqual([
      ["naex", 0, 0],
      ["naex", 1, 0],
      ["naex", 0, 0],
      ["odpoved", 1, 0],
      ["dlh", 0, 1],
      ["pecen", 0, 2],
      ["pecen", 1, 2],
      ["cigarety", 1, 3],
    ]);
    // Akcie na súperovej karte sú vo farbe majiteľa (súpera), nie toho, kto dal NA EX.
    expect(riadky[0]?.casti).toEqual([
      { t: "karta", defId: "vymahac", majitel: 1 },
      { t: "text", s: "×2" },
      { t: "akcie", akcie: [["Rana", 1], ["Poldeci", 1]], kto: 1 },
      { t: "text", s: "✕" },
      { t: "akcie", akcie: [["Pecka", 1]], zrusene: true, kto: 1 },
    ]);
    // Odpoveď na NA EX — na ktorú stranu z pohľadu hráča (Michal 2026-10-28: „neviem, ako súper zareagoval“).
    const strana = (hrac: 0 | 1, ciel: "vlastna" | "superova"): CastTextu | undefined =>
      riadkyTextuPitky(r, [{ hrac, defId: "pijan", ciel }], 0).find((x) => x.druh === "odpoved")?.casti[2];
    expect(strana(0, "vlastna")).toEqual({ t: "text", s: "na tvoju stranu" });
    expect(strana(0, "superova")).toEqual({ t: "text", s: "na súperovu stranu" });
    expect(strana(1, "vlastna")).toEqual({ t: "text", s: "na svoju stranu" });
    expect(strana(1, "superova")).toEqual({ t: "text", s: "na tvoju stranu" });
    // Zadĺženie 5 pri prahu 2: dva Dlhy, 1 ostáva na účte.
    expect(riadky[4]?.casti).toContainEqual({ t: "b", s: "5" });
    expect(riadky[4]?.casti).toContainEqual({ t: "text", s: "· 1 ostáva na účte" });
  });
});

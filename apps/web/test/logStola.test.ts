// Log na stole (UI inšpekcia 20261120, Z-12): najnovšie hore, skupiny „Kolo · fáza“, mená vo farbe.

import { describe, expect, it } from "vitest";
import type { Event } from "@naex/core";
import { NADPIS_LOGU, skupinyLogu, usekyMien } from "../src/hra/logStola.ts";
import { riadkyLogu } from "../src/hra/useHra.ts";

describe("skupiny logu", () => {
  it("najnovšia skupina aj riadok hore; fáza bez záznamu nadpis nemá", () => {
    const log = ["úvod", `${NADPIS_LOGU}Kolo 1 · Ponuka`, "a", "b", `${NADPIS_LOGU}Kolo 1 · Zhromaždenie`, `${NADPIS_LOGU}Kolo 1 · Pitka`, "c"];
    expect(skupinyLogu(log)).toEqual([
      { nadpis: "Kolo 1 · Pitka", riadky: [{ riadok: "c", i: 6 }] },
      { nadpis: "Kolo 1 · Ponuka", riadky: [{ riadok: "b", i: 3 }, { riadok: "a", i: 2 }] },
      { nadpis: null, riadky: [{ riadok: "úvod", i: 0 }] },
    ]);
  });

  it("mená hráčov ako samostatné úseky, dlhšie meno má prednosť", () => {
    expect(usekyMien("Bot Igor vyhráva, Igor ťahá", ["Igor", "Bot Igor"])).toEqual([
      { text: "Bot Igor", hrac: 1 },
      { text: " vyhráva, ", hrac: null },
      { text: "Igor", hrac: 0 },
      { text: " ťahá", hrac: null },
    ]);
    expect(usekyMien("nič", ["Jano", ""])).toEqual([{ text: "nič", hrac: null }]);
  });
});

describe("riadky logu z udalostí", () => {
  it("nadpis fázy s kolom; kolo pribudne po bitke, log jadra ostáva", () => {
    const kolo = { n: 1 };
    const udalosti = [
      { type: "faza", faza: "draft" },
      { type: "log", text: "Ponuka je postavená." },
      { type: "faza", faza: "bitka" },
      { type: "bitkaVysledok", damage: { tuhe: [3, 1] }, vitaz: 0, prebytok: 2 },
      { type: "faza", faza: "volbaCiela" },
    ] as unknown as Event[];
    const riadky = riadkyLogu(udalosti, ["Jano", "Fero"], [null, null], kolo);
    expect(riadky[0]).toBe(`${NADPIS_LOGU}Kolo 1 · Ponuka`);
    expect(riadky[1]).toBe("Ponuka je postavená.");
    expect(riadky[2]).toBe(`${NADPIS_LOGU}Kolo 1 · Bitka`);
    expect(riadky.at(-1)).toBe(`${NADPIS_LOGU}Kolo 2 · O čo sa bijeme`);
    expect(kolo.n).toBe(2);
  });
});

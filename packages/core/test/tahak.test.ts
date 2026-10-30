// Ťahák AI hráčov (tools/playtest/tahak.md) opakuje čísla pravidiel. Keď sa
// hodnota v constants.ts zmení a ťahák nie, playtesteri hrajú podľa starých
// pravidiel a hlásia falošné nezrovnalosti — preto ho stráži test.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DLZKY_HRY, KONSTANTY } from "../src/constants.ts";
import { cenaKroku, cenaPatronatu } from "../src/elders.ts";
import { cenaFajcenia } from "../src/engine.ts";
import { pocet } from "../src/jazyk.ts";

const tahak = readFileSync(new URL("../../../tools/playtest/tahak.md", import.meta.url), "utf8").replace(/\s+/g, " ");

describe("ťahák AI hráčov sedí s constants.ts", () => {
  it.each([
    ["dĺžky hry", `krátka ${DLZKY_HRY.kratka}, stredná ${DLZKY_HRY.stredna}, dlhá ${DLZKY_HRY.dlha}`],
    [
      "štartovky",
      `${Object.values(KONSTANTY.START_RUKA).reduce((a, b) => a + b, 0)} karty v ruke (${KONSTANTY.START_RUKA["ministrant"]} Miňištrant, ${KONSTANTY.START_RUKA["milujuca_manzelka"]} Milujúca manželka, ${KONSTANTY.START_RUKA["pijan"]} Pijan, ${KONSTANTY.START_RUKA["dievcina_na_vydaj"]} Dievčina na vydaj), doberací balíček prázdny`,
    ],
    ["štart", `${KONSTANTY.START_POLDECI} plné poldeci, ${KONSTANTY.START_CIGARETY} cigarety`],
    ["špaky za bitku (v8)", "1 špak za každú kartu v línii"],
    ["strach za novú zónu (v8)", "len zóny, ktoré mu ešte nezaplatil: žltá 1, oranžová 2, červená 3 (zo stredu na červenú spolu 6)"],
    ["Kmotor (v8)", "Kmotor: po bitke presunie 1 / 2 / 3 tvoje priznané Dlhy medzi súperove"],
    ["Exekútor bez prahu (2026-10-28)", "Exekútor príde v každej bitke ku každému s priznaným Dlhom: zhorí polovica priznaných Dlhov zaokrúhlene nahor"],
    ["rozpis úrovní (v7)", "stredná 1 · 2 · 2 · 3 · 3 · P"],
    ["Cirhóza na konci", `−${pocet(KONSTANTY.SPAKY_ZA_CIRHOZU, "špak", "špaky", "špakov")} za kus`],
    ["výkupné (2026-10-27)", `plný poldeci ${KONSTANTY.SPAKY_ZA_POLDECI} špak, každých celých ${KONSTANTY.CIGARIET_ZA_SPAK} cigariet 1 špak`],
    ["karty po bitke", `dobereš **${pocet(KONSTANTY.KARTY_PO_BITKE, "kartu", "karty", "kariet")}**`],
    ["cena šenku", `1 karta za ${KONSTANTY.CENA_SENKU[1]} cigaretu, 2 karty za ${KONSTANTY.CENA_SENKU[2]} cigarety`],
    ["doplnenie šenku", `doplní na ${KONSTANTY.SENOK_PO_BRANI}`],
    ["doliatie", `${KONSTANTY.REFILL_CENA} cigarety → vypitý poldeci`],
    [
      "fajčenie (2026-10-27)",
      `prvé fajčenie v Pitke ${cenaFajcenia(0)} cigareta, druhé ${cenaFajcenia(1)}, tretie ${cenaFajcenia(2)}…`,
    ],
    ["barter", `${KONSTANTY.BARTER_CENA} cigariet → nový plný poldeci`],
    [
      "cena patronátu (v6.1)",
      `červená ${cenaPatronatu({ marker: 0 }).cigarety}, oranžová ${cenaPatronatu({ marker: 1 }).cigarety}, žltá ${cenaPatronatu({ marker: 2 }).cigarety}`,
    ],
    [
      "cena posunu markera (v8.2)",
      `pole von zo stredu stojí ${cenaKroku(3, 4)} / ${cenaKroku(4, 5)} / ${cenaKroku(5, 6)}, k stredu ${cenaKroku(6, 5)} / ${cenaKroku(5, 4)} / ${cenaKroku(4, 3)} (z červenej, z oranžovej, zo žltej); zo stredu na červenú ${cenaKroku(3, 4) + cenaKroku(4, 5) + cenaKroku(5, 6)}`,
    ],
    ["Dlh a Absťák ako počítadlá (v8.2)", "**Dlh a Absťák sú počítadlá, nie karty**"],
    ["Autobusár (v7)", "Autobusár: súper, ktorý pasuje po jeho majiteľovi, cigarety za pas nedostane"],
    ["Strýko (v7)", `(${KONSTANTY.EFEKT.STRYKO_CENA} cigarety → v bitke kola +1 Rana)`],
    ["Vychovávateľka (v7)", `Vychovávateľka (${KONSTANTY.EFEKT.VYCHOVAVATELKA_CENA} cigarety → v bitke`],
    ["Policajtka (v7)", `Policajtka (súper Dlh; za Kriminála ti dá ${KONSTANTY.EFEKT.POLICAJTKA_CIGARETY} cigarety)`],
    ["Obecný úrad (v7)", `Obecný úrad (v7 Kšeft: ${KONSTANTY.EFEKT.URAD_CENA} cigarety`],
  ])("%s", (_, ocakavane) => {
    expect(tahak).toContain(ocakavane);
  });

  it("klient agentov (hrac.ts) berie cenu Cirhózy z jadra, nie natvrdo (playtest 20261028-090549-3, názor #119)", () => {
    const hrac = readFileSync(new URL("../../../tools/playtest/hrac.ts", import.meta.url), "utf8");
    expect(hrac).not.toMatch(/Cirhóz.{0,80}[−-] ?5 špak/);
    expect(hrac).toContain("KONSTANTY.SPAKY_ZA_CIRHOZU");
    expect(KONSTANTY.SPAKY_ZA_CIRHOZU).toBe(3);
  });
});

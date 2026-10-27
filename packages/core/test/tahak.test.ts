// Ťahák AI hráčov (tools/playtest/tahak.md) opakuje čísla pravidiel. Keď sa
// hodnota v constants.ts zmení a ťahák nie, playtesteri hrajú podľa starých
// pravidiel a hlásia falošné nezrovnalosti — preto ho stráži test.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DLZKY_HRY, KONSTANTY } from "../src/constants.ts";
import { cenaPatronatu } from "../src/elders.ts";
import { cenaFajcenia } from "../src/engine.ts";

const tahak = readFileSync(new URL("../../../tools/playtest/tahak.md", import.meta.url), "utf8").replace(/\s+/g, " ");

describe("ťahák AI hráčov sedí s constants.ts", () => {
  it.each([
    ["dĺžky hry", `krátka ${DLZKY_HRY.kratka}, stredná ${DLZKY_HRY.stredna}, dlhá ${DLZKY_HRY.dlha}`],
    [
      "štartovky",
      `${Object.values(KONSTANTY.START_RUKA).reduce((a, b) => a + b, 0)} karty v ruke (${KONSTANTY.START_RUKA["ministrant"]} Miňištrant, ${KONSTANTY.START_RUKA["milujuca_manzelka"]} Milujúca manželka, ${KONSTANTY.START_RUKA["pijan"]} Pijan, ${KONSTANTY.START_RUKA["dievcina_na_vydaj"]} Dievčina na vydaj), doberací balíček prázdny`,
    ],
    ["štart", `${KONSTANTY.START_POLDECI} plné poldeci, ${KONSTANTY.START_CIGARETY} cigarety`],
    ["finále", `Finále má vždy ${KONSTANTY.FINALE_PITKY} Pitky`],
    ["Cirhóza na konci", `−${KONSTANTY.SPAKY_ZA_CIRHOZU} špakov za kus`],
    ["výkupné (2026-10-27)", `plný poldeci ${KONSTANTY.SPAKY_ZA_POLDECI} špak, každých celých ${KONSTANTY.CIGARIET_ZA_SPAK} cigariet 1 špak`],
    ["karty po bitke", `dobereš **${KONSTANTY.KARTY_PO_BITKE} karty**`],
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
  ])("%s", (_, ocakavane) => {
    expect(tahak).toContain(ocakavane);
  });
});

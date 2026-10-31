// Ťahák AI hráčov (tools/playtest/tahak.md) opakuje čísla pravidiel. Keď sa
// hodnota v constants.ts zmení a ťahák nie, playtesteri hrajú podľa starých
// pravidiel a hlásia falošné nezrovnalosti — preto ho stráži test.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DLZKY_HRY, KONSTANTY } from "../src/constants.ts";
import { cenaKroku } from "../src/elders.ts";
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
    ["strach až po udržaní (v8.3)", "až na konci nasledujúceho kola, ak sa na ňom marker dovtedy udrží"],
    ["strach každý stupeň raz (v8.3)", "Každý stupeň raz: **žltá 1, oranžová 2, červená 3 (zo stredu na červenú spolu 6)**"],
    ["Nakladačka vo finále (v8.3)", "**Vo finále sa rozdeľuje len Pohoršenie, Nakladačka nie (v8.3)"],
    ["Nakladačka vo finále na špaky (v9.1)", `dostane za každý bod Nakladačky ${pocet(KONSTANTY.SPAKY_ZA_NAKLADACKU_VO_FINALE, "špak", "špaky", "špakov")} (v9.1)`],
    ["Chuť a neresti (v9.1)", `**Vypiť 1, NA EX ${KONSTANTY.NEREST_NAEX}, vyfajčená cigareta 1**`],
    ["Chuť na konci kola (v9.1)", `**Chuť = väčšie z (Chuť, neresti kola) − ${KONSTANTY.CHUT_UBYTOK}**`],
    ["Opatrovateľka (v9.1)", `Opatrovateľka v tvojej partii porovná tvoju Chuť o ${KONSTANTY.OPATROVATELKA_CHUT} nižšiu`],
    ["šenok začína obranca (v9.2)", "Branie striedavo, **začína obranca (v9.2)**"],
    ["šenok prvý ťah (v9.2)", `**kto berie prvý, na svojom prvom ťahu vezme len ${pocet(KONSTANTY.SENOK_PRVY_TAH, "kartu", "karty", "kariet")}**`],
    ["odpovede lícom dole (v9.2)", "najprv **útočník**, potom **obranca na druhý kraj línie**"],
    ["Zastávka (v9.1)", "Zastávka (v9.1: po **prvej Pitke kola** si každý vezme **zadarmo 1 kartu zo šenku**, najprv útočník, potom obranca"],
    ["pojmy stupnice (v8.3)", "**pokojný (0), znepokojený (1), vystrašený (2), vydesený (3)**"],
    ["Povery (v8.3)", "**každá zvyšná Povera posunie silu priazne jedného staršieho o stupeň k tebe**"],
    ["Povery strop (v8.3)", "**najviac na 3**"],
    ["Robota bez Dlhu (v8.4)", "**za každý Dlh, ktorý nemá čo spáliť, 1 špak**"],
    ["Telefón (v8.4)", `z červenej ${cenaKroku(6, 5, true)}, z oranžovej ${cenaKroku(5, 4, true)}, zo žltej ${cenaKroku(4, 3, true)}`],
    ["Kmotor (v9)", "Kmotor: po bitke presunie 2 / 3 / 4 tvoje priznané Dlhy medzi súperove"],
    ["tretí väzeň (v9)", `kto **zajme tretieho staršieho, vyhráva hneď**`],
    ["väzni po finále (v9)", `**1. väzeň ${KONSTANTY.SPAKY_ZA_VAZNOV[0]}, 2. ${KONSTANTY.SPAKY_ZA_VAZNOV[1]}, 3. ${KONSTANTY.SPAKY_ZA_VAZNOV[2]}, 4. ${KONSTANTY.SPAKY_ZA_VAZNOV[3]}**`],
    ["cena pokusu (v9)", `Cena **${pocet(KONSTANTY.CENA_POKUSU, "cigareta", "cigarety", "cigariet")}**, prepadne vždy`],
    ["Kšeft väzňa (v9)", "Cena: **vypiť 1 plný poldeci** zo zásoby"],
    ["Vychovávateľka (v9)", `**Petelicu navyše (+${KONSTANTY.VYCHOVAVATELKA_TUHE} tuhé)**`],
    ["Exekútor bez prahu (2026-10-28)", "Exekútor príde v každej bitke ku každému s priznaným Dlhom: zhorí polovica priznaných Dlhov zaokrúhlene nahor"],
    ["rozpis úrovní (v7)", "stredná 1 · 2 · 2 · 3 · 3 · P"],
    ["Cirhóza na konci", `−${pocet(KONSTANTY.SPAKY_ZA_CIRHOZU, "špak", "špaky", "špakov")} za kus`],
    ["výkupné (2026-10-27)", `plný poldeci ${KONSTANTY.SPAKY_ZA_POLDECI} špak, každých celých ${KONSTANTY.CIGARIET_ZA_SPAK} cigariet 1 špak`],
    ["karty po bitke", `dobereš **${pocet(KONSTANTY.KARTY_PO_BITKE, "kartu", "karty", "kariet")}**`],
    ["cena šenku", `1 karta za ${KONSTANTY.CENA_SENKU[1]} cigaretu, 2 karty za ${KONSTANTY.CENA_SENKU[2]} cigarety`],
    ["doplnenie šenku", `doplní na ${KONSTANTY.SENOK_PO_BRANI}`],
    ["stavba šenku z dvoch balíčkov (v8.5)", `dostaneš **${KONSTANTY.STAVBA_NARADIE} karty z Náradia a ${KONSTANTY.STAVBA_OBCANIA} z Občanov**, dáš **${(KONSTANTY.STAVBA_NARADIE + KONSTANTY.STAVBA_OBCANIA) / 2} do šenku**`],
    ["doplnenie šenku v pomere (v8.5)", `najprv z Náradia, kým v ňom nie sú ${KONSTANTY.STAVBA_NARADIE} Nástroje, zvyšok z Občanov`],
    ["doliatie", `${KONSTANTY.REFILL_CENA} cigarety → vypitý poldeci`],
    [
      "fajčenie (2026-10-27)",
      `prvé fajčenie v Pitke ${cenaFajcenia(0)} cigareta, druhé ${cenaFajcenia(1)}, tretie ${cenaFajcenia(2)}…`,
    ],
    ["barter", `${KONSTANTY.BARTER_CENA} cigariet → nový plný poldeci`],
    [
      "cena posunu markera (v8.2)",
      `pole von zo stredu stojí ${cenaKroku(3, 4)} / ${cenaKroku(4, 5)} / ${cenaKroku(5, 6)}, k stredu ${cenaKroku(6, 5)} / ${cenaKroku(5, 4)} / ${cenaKroku(4, 3)} (z červenej, z oranžovej, zo žltej); zo stredu na červenú ${cenaKroku(3, 4) + cenaKroku(4, 5) + cenaKroku(5, 6)}`,
    ],
    ["Dlh ako počítadlo (v8.2), Absťák karta (v9.1)", "**Dlh je počítadlo, nie karta**"],
    ["Strýko (v7)", `(${KONSTANTY.EFEKT.STRYKO_CENA} cigarety → v bitke kola +1 Rana)`],
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

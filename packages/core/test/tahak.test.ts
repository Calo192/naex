// Ťahák AI hráčov (tools/playtest/tahak.md) opakuje čísla pravidiel. Keď sa
// hodnota v constants.ts zmení a ťahák nie, playtesteri hrajú podľa starých
// pravidiel a hlásia falošné nezrovnalosti — preto ho stráži test.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DLZKY_HRY, KONSTANTY, VERZIA_PRAVIDIEL_PRESNA, vazniNaVyhru } from "../src/constants.ts";
import { cenaDvihnutia } from "../src/elders.ts";
import { cenaFajcenia, krokStavby } from "../src/engine.ts";
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
    ["starší po bitke (v11.12)", `**žltá ${KONSTANTY.HODNOTA_STUPNA[1]}, oranžová ${KONSTANTY.HODNOTA_STUPNA[2]}, červená ${KONSTANTY.HODNOTA_STUPNA[3]}**`],
    [
      "finále bez dvíhania (v11)",
      `víťaz bitky dostane za každý bod Nakladačky ${pocet(KONSTANTY.SPAKY_ZA_NAKLADACKU_VO_FINALE, "špak", "špaky", "špakov")}, víťaz hádky za každý bod hádky ${pocet(KONSTANTY.SPAKY_ZA_HADKU_VO_FINALE, "špak", "špaky", "špakov")}`,
    ],
    ["priazeň z rozdielu strachov (v11)", "**Priazeň pre teba = strach súpera − tvoj strach**"],
    ["výhra strachom (v11)", `**červený strach aspoň u ${KONSTANTY.CERVENYCH_NA_VYHRU} starších**`],
    ["väzni podľa ligy (v11)", `Tretia liga ${vazniNaVyhru(DLZKY_HRY.kratka)}, Druhá ${vazniNaVyhru(DLZKY_HRY.stredna)}, Prvá ${vazniNaVyhru(DLZKY_HRY.dlha)}`],
    ["cigareta porazenému (v11)", `**porazený ${pocet(KONSTANTY.CIGARETY_PORAZENEMU, "cigareta", "cigarety", "cigariet")}**`],
    ["prah Dlhu (v11.8)", `Prah Dlhu ${KONSTANTY.PRAH_DLHU_ZAKLAD} (v11.8: Hazard aj „1 zadĺženie“ z efektu karty sú rovno Dlh)`],
    ["Výherný automat (v11.8)", `tvoj prah Dlhu ${KONSTANTY.PRAH_DLHU_ZAKLAD + 1} (Dlh za každé ${KONSTANTY.PRAH_DLHU_ZAKLAD + 1} zadĺženia, zvyšok ostáva na účte do ďalšej Pitky aj kola)`],
    ["Chuť a neresti (v9.1)", `**Vypiť 1, NA EX ${KONSTANTY.NEREST_NAEX}, vyfajčená cigareta 1**`],
    ["Chuť na konci kola (v9.1)", `**Chuť = väčšie z (Chuť, neresti kola) − ${KONSTANTY.CHUT_UBYTOK}**`],
    ["Kostol (v11.7)", "**v11.7: NA EX len na kartu na konci línie (na ktoromkoľvek z dvoch koncov), najďalej od Kostola**"],
    ["Výtržník a Silná žena (2026-11-06)", "Rany Výtržníka sú vždy ×1, nezdvojí ich ani Silná nezávislá žena"],
    ["Silná žena len ľudia (2026-11-08)", "zdvojí aktívne akcie len tvojich susedných **Občanov a Starešinov**, nie Zviera ani Nástroj"],
    ["šenok začína obranca (v9.2)", "Branie striedavo, **začína obranca (v9.2)**"],
    ["šenok prvý ťah (v9.2)", `**kto berie prvý, na svojom prvom ťahu vezme len ${pocet(KONSTANTY.SENOK_PRVY_TAH, "kartu", "karty", "kariet")}**`],
    ["odpovede lícom dole (v9.2)", "najprv **útočník**, potom **obranca na druhý kraj línie**"],
    ["Nástroj nie vedľa lokality (v10.2)", "**Vedľa lokality sa Nástroj nevykladá (v10.2):** do prázdneho kraja"],
    ["Forsáž (v10.3)", "Posilnenie + Posilnenie na spoji = **Forsáž** — obe karty spoja majú **všetky aktívne akcie posilnené ×2**"],
    ["Poľovník (v10.4)", "**spáli súperovo Zviera, ktoré je od lokality najďalej**"],
    ["Kšeft zanikol, akcie navyše (frakcie)", "**Posilnenie, Odpor, Forsáž, NA EX ani Silná žena ju nemenia**"],
    ["Vdova (frakcie)", "súper **vyberie a odhodí"],
    ["Predsedova vila (frakcie)", "vyfajčíš, tvoje reči pri jednom staršom o ďalší stupeň**"],
    ["Sypač (v11.5)", "**Sypač** (Podpora): keď sa priložením stretne s tvojím Chlapom, ten má do konca kola **Rany ako Pecky**"],
    ["Zastávka (v9.1)", "Zastávka (v9.1: po **prvej Pitke kola** si každý vezme **zadarmo 1 kartu zo šenku**, najprv útočník, potom obranca"],
    ["pojmy stupnice (v8.3)", "**pokojný (0), znepokojený (1), vystrašený (2), vydesený (3)**"],
    ["mäkké poškodenie (v10)", `**mäkké = Pohoršenie × ${KONSTANTY.HADKA.POHORSENIE_MAKKE} + zvyšné Povery × ${KONSTANTY.HADKA.POVERA_MAKKE}**`],
    ["hádka na reči (v11)", "**Priazne hádka nemení** — víťaz ju po bitke rozdelí na svoje reči"],
    ["Abstinent (v10)", "Abstinent: v bitke sa ti neráta 1 / 2 / 3 Absťákov"],
    ["Horoskop (v10)", `Horoskop: tvoje Povery majú silu ${KONSTANTY.HADKA.HOROSKOP_POVERA}`],
    ["Svätý text (v10)", "Svätý text: hodnota tvojej Viery je o 1 vyššia (len v tlmení tuhého; Povery ruší 1 : 1)"],
    ["Viera ruší Povery na kusy (v10)", "jedna Viera zruší jednu Poveru, aj vylepšenú Horoskopom"],
    ["Robota bez Dlhu (v8.4)", "**za každý Dlh, ktorý nemá čo spáliť, 1 špak**"],
    ["Telefón (v10)", "Telefón: tvoje Pohoršenia nemožno zrušiť Odporom a NA EX"],
    ["Kmotor (v9)", "Kmotor: po bitke presunie 2 / 3 / 4 tvoje priznané Dlhy medzi súperove"],
    [
      "krádež pri zajatí (v11.4)",
      `toľko špakov, koľko bodov hádky má v rečiach pri ňom, najviac koľko má**`,
    ],
    ["cena zajatia (v11.4)", `ho **zajať za ${KONSTANTY.CENA_ZAJATIA} bodov** Nakladačky`],
    ["cena presvedčenia (v11.12)", `ho **presvedčiť za ${KONSTANTY.CENA_PRESVEDCENIA} body** hádky`],
    [
      "príklad presvedčenia (v11.4)",
      `hádka 10 na prázdnom staršom: reči 1 + 2 + 3, presvedčenie ${KONSTANTY.CENA_PRESVEDCENIA}, ${10 - cenaDvihnutia(0, 3) - KONSTANTY.CENA_PRESVEDCENIA} bod inam`,
    ],
    ["schopnosť väzňa (v11.2)", "použiješ **raz za hru, kedy chceš**"],
    ["Poštárka (v11.2)", `**Poštárka:** dostaneš **${pocet(KONSTANTY.POSTARKA_CIGARETY, "cigaretu", "cigarety", "cigariet")}**`],
    ["Autobusár (v11.2)", `**každú kartu za ${KONSTANTY.AUTOBUSAR_CENA}`],
    ["Exekútor bez prahu (2026-10-28)", "Exekútor príde v každej bitke ku každému s priznaným Dlhom: zhorí polovica priznaných Dlhov zaokrúhlene nahor"],
    ["rozpis úrovní (v7)", "stredná 1 · 2 · 2 · 3 · 3 · P"],
    ["Cirhóza na konci", `−${pocet(KONSTANTY.SPAKY_ZA_CIRHOZU, "špak", "špaky", "špakov")} za kus`],
    ["výkupné (2026-10-27)", `plný poldeci ${KONSTANTY.SPAKY_ZA_POLDECI} špak, každých celých ${KONSTANTY.CIGARIET_ZA_SPAK} cigariet 1 špak`],
    ["dobratie do ruky (v11.9)", `dobereš do **${KONSTANTY.DOBRATIE_DO_RUKY} kariet v ruke**`],
    ["výpalné (v11.9)", `súper ti hneď po bitke dá **${pocet(KONSTANTY.VYPALNE_ZA_CERVENU, "cigaretu", "cigarety", "cigariet")} za každého staršieho**`],
    ["cena šenku", `1 karta za ${KONSTANTY.CENA_SENKU[1]} cigaretu, 2 karty za ${KONSTANTY.CENA_SENKU[2]} cigarety`],
    ["doplnenie šenku", `doplní na ${KONSTANTY.SENOK_PO_BRANI}`],
    ["stavba šenku z dvoch balíčkov (v8.5)", `dostaneš **${KONSTANTY.STAVBA_NARADIE} karty z Náradia a ${KONSTANTY.STAVBA_OBCANIA} z Občanov**, dáš **${(KONSTANTY.STAVBA_NARADIE + KONSTANTY.STAVBA_OBCANIA) / 2} do šenku**`],
    [
      "stavba šenku napoly (v11.4 bez karty zadarmo)",
      ((k) => `dáš **${k.doSenku} do šenku** v ľubovoľnom mixe a ${k.odhod} naspodok`)(krokStavby(KONSTANTY.STAVBA_NARADIE + KONSTANTY.STAVBA_OBCANIA)),
    ],
    ["doplnenie šenku v pomere (v8.5)", `najprv z Náradia, kým v ňom nie sú ${KONSTANTY.STAVBA_NARADIE} Nástroje, zvyšok z Občanov`],
    ["doliatie", `${KONSTANTY.REFILL_CENA} cigarety → vypitý poldeci`],
    [
      "fajčenie (2026-10-27)",
      `prvé fajčenie v Pitke ${cenaFajcenia(0)} cigareta, druhé ${cenaFajcenia(1)}, tretie ${cenaFajcenia(2)}…`,
    ],
    ["barter", `${KONSTANTY.BARTER_CENA} cigariet → nový plný poldeci`],
    [
      "cena stupňa (v11)",
      `stupeň stojí **do žltej ${cenaDvihnutia(0, 1)}, do oranžovej ${cenaDvihnutia(1, 2)}, do červenej ${cenaDvihnutia(2, 3)}** (strach zo žltej na červenú ${cenaDvihnutia(1, 2)} + ${cenaDvihnutia(2, 3)} = ${cenaDvihnutia(1, 3)}`,
    ],
    ["Dlh ako počítadlo (v8.2), Absťák karta (v9.1)", "**Dlh je počítadlo, nie karta**"],
    ["Lesná cesta (v11.13)", `Lesná cesta (v11.13: ${KONSTANTY.EFEKT.LESNA_CESTA_TUHE} tuhé za každé svoje Zviera v línii`],
    ["Benzínka (v11.13)", `Benzínka (v11.13: prvé fajčenie v každej Pitke zadarmo, ďalšie ${cenaFajcenia(1)}, ${cenaFajcenia(2)}…`],
  ])("%s", (_, ocakavane) => {
    expect(tahak).toContain(ocakavane);
  });

  it("hlavička ťaháka hovorí o tej istej verzii pravidiel ako jadro", () => {
    expect(tahak.slice(0, 60)).toContain("(" + VERZIA_PRAVIDIEL_PRESNA + " ");
  });

  it("klient agentov (hrac.ts) berie cenu Cirhózy z jadra, nie natvrdo (playtest 20261028-090549-3, názor #119)", () => {
    const hrac = readFileSync(new URL("../../../tools/playtest/hrac.ts", import.meta.url), "utf8");
    expect(hrac).not.toMatch(/Cirhóz.{0,80}[−-] ?5 špak/);
    expect(hrac).toContain("KONSTANTY.SPAKY_ZA_CIRHOZU");
    expect(KONSTANTY.SPAKY_ZA_CIRHOZU).toBe(3);
  });
});

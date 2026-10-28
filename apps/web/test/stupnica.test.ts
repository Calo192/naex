// Popis stupnice a stopa posunu (roadmapa #95) a texty pri staršom (Michal 2026-10-28):
// stopa zráta zdroje posunov; riadky pod stupnicou sú krátke a každá veta je na jednom mieste.

import { describe, expect, it } from "vitest";
import cardsJson from "../../../packages/core/data/cards.json";
import eldersJson from "../../../packages/core/data/elders.json";
import scorecardsJson from "../../../packages/core/data/scorecards.json";
import type { PosunMarkera } from "@naex/core";
import { loadGameData, setupGame } from "@naex/core";
import { stopaStarsieho } from "../src/hra/LiniaStarsich.tsx";
import { pokynPrebytku, riadokDlazdice, riadokPriazne, riadokStrachu, stitokStopy, textStopy } from "../src/hra/textyStarsich.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);
const s0 = setupGame(data, 5);

describe("stopa posunu", () => {
  const id = s0.starsi[0]!.elderId;
  const posuny: PosunMarkera[] = [
    { elderId: id, z: 4, na: 5, zdroj: "pohorsenie", kto: 0 },
    { elderId: "iny", z: 4, na: 3, zdroj: "pohorsenie", kto: 1 },
    { elderId: id, z: 5, na: 6, zdroj: "prebytok", kto: 0 },
    { elderId: id, z: 6, na: 7, zdroj: "prebytok", kto: 0 },
  ];

  it("začína pozíciou pred prvým posunom a rovnaké zdroje po sebe zráta", () => {
    expect(stopaStarsieho(posuny, id)).toEqual({
      z: 4,
      zdroje: [
        { zdroj: "pohorsenie", kto: 0, pocet: 1 },
        { zdroj: "prebytok", kto: 0, pocet: 2 },
      ],
    });
    expect(stopaStarsieho(posuny, "nikto")).toBeUndefined();
  });

  it("štítok na portréte nesie len zdroj a počet, lupa aj kto posúval", () => {
    const stopa = stopaStarsieho(posuny, id)!;
    expect(stitokStopy(stopa.zdroje)).toBe("Pohoršenie · Prebytok ×2");
    expect(textStopy(stopa.zdroje, (p) => (p === 0 ? "ty" : "Fero"))).toBe("Pohoršenie · ty · Prebytok · ty ×2");
  });
});

describe("riadky pod stupnicou (Michal 2026-10-28)", () => {
  it("priazeň: komu a krátky účinok, bez priazne účinok pri +1", () => {
    expect(riadokPriazne("NEPRAJNIK", "ty", 1)).toBe("ty +1 · výpalné 1 cig. za NA EX");
    expect(riadokPriazne("BITKAR", null, 0)).toBe("nikto · pri +1: +1 tuhé v bitke");
  });

  it("strach: koho sa bojí a koľko špakov dá po vyhratej bitke", () => {
    expect(riadokStrachu("Fero", false, 2)).toBe("bojí sa Fero · +2 š, keď vyhrá");
    expect(riadokStrachu("Jano", true, 1)).toBe("bojí sa teba · +1 š, keď vyhráš");
    expect(riadokStrachu(null, false, 0)).toBe("nikoho sa nebojí");
  });

  it("riadky sú krátke — pri bežnom mene najviac dva riadky karty, bez „…“", () => {
    for (const fav of ["UZERNIK", "LAKOMEC", "NEPRAJNIK", "BITKAR", "VERIACI", "FAJCIAR", "ALKOHOLIK", "EXEKUTOR"] as const) {
      for (const sila of [0, 1, 2, 3]) expect(riadokPriazne(fav, sila === 0 ? null : "Michal", sila).length).toBeLessThanOrEqual(44);
    }
    expect(riadokStrachu("Michal", false, 3).length).toBeLessThanOrEqual(44);
  });

  it("dlaždica v bare len slovo — účinok je v línii", () => {
    expect(riadokDlazdice("hore", true)).toBe("pomáha ti");
    expect(riadokDlazdice("dole", false)).toBe("ak vyhrá");
    expect(riadokDlazdice("nic", true)).toBe("neutrálny");
  });

  it("pokyn prebytku povie, na koľko posunov vystačí", () => {
    expect(pokynPrebytku(3, 1)).toMatch(/^Prebytok 3 — vystačí na 3 posuny\./);
    expect(pokynPrebytku(5, 2)).toMatch(/^Prebytok 5, posun stojí 2 \(Miňištrant\) — vystačí na 2 posuny\./);
  });
});

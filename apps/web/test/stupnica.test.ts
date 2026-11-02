// Texty pri staršom (Michal 2026-10-28: každá veta na jednom mieste; v11 Strach a reči): zmeny
// markerov slovami, štítok zmien na portréte, riadky dlaždíc a ceny stupňov.

import { describe, expect, it } from "vitest";
import type { ZmenaMarkera } from "@naex/core";
import { stitokZmien } from "../src/hra/LiniaStarsich.tsx";
import { CENA_POLA, PRAVIDLO_STRACHU, nazovStupna, riadokDlazdice, riadokPriazne, textZmeny } from "../src/hra/textyStarsich.ts";

const MENA = ["Jano", "Fero"] as const;

describe("zmeny markerov (v11)", () => {
  const z = (x: Partial<ZmenaMarkera>): ZmenaMarkera => ({ elderId: "e", hrac: 0, marker: "strach", z: 0, na: 1, zdroj: "nakladacka", kto: 0, ...x });

  it("štítok nesie zdroje a počet", () => {
    expect(stitokZmien([z({}), z({ zdroj: "hadka", marker: "reci" }), z({ z: 1, na: 2 })])).toBe("Nakladačka ×2 · Hádka");
    expect(stitokZmien([z({ zdroj: "nastup", kto: 1, hrac: 0, marker: "reci" })])).toBe("Kapybara");
  });

  it("zmena slovami z pohľadu hráča", () => {
    expect(textZmeny(z({ z: 1, na: 2 }), 0, MENA)).toBe("tvoj strach žltá → oranžová");
    expect(textZmeny(z({ hrac: 1, marker: "reci", z: 2, na: 0 }), 0, MENA)).toBe("reči (Fero) oranžová → zanikli");
    expect(textZmeny(z({ hrac: 1, z: 3, na: 0 }), 1, MENA)).toBe("tvoj strach červená → nič");
  });
});

describe("riadky pri staršom", () => {
  it("priazeň: komu a krátky účinok, bez priazne účinok pri +1", () => {
    expect(riadokPriazne("ROBOTA", "ty", 1)).toBe("ty: +1 Robota v bitke");
    expect(riadokPriazne("BITKAR", null, 0)).toBe("nikomu · pri +1: +1 tuhé v bitke");
  });

  it("dlaždica v bare len slovo", () => {
    expect(riadokDlazdice("hore", true)).toBe("pomáha ti");
    expect(riadokDlazdice("dole", false)).toBe("bojí sa ho");
    expect(riadokDlazdice("nic", true)).toBe("neutrálny");
  });

  it("stupne a ceny v11: žltá 1, oranžová 2, červená 3; špaky 1 / 3 / 5", () => {
    expect(nazovStupna(0)).toBe("nič");
    expect(nazovStupna(3)).toBe("červená");
    expect(CENA_POLA).toBe("stupeň stojí 1 / 2 / 3 (žltá / oranžová / červená)");
    expect(PRAVIDLO_STRACHU).toMatch(/žltá 1, oranžová 3, červená 5/);
    expect(PRAVIDLO_STRACHU).toMatch(/porazenému len za reči/);
  });
});

// Preškolenie na líci karty a Náradie pod kartou (Michal 2026-11-08): pečať sa číta z textu
// efektu (nie z id karty), hrany Nástroja nie sú pečať, text bez zápisu, farba hrany a smer
// pretŕčania podľa karty, nie podľa majiteľa Nástroja.

import { describe, expect, it } from "vitest";
import { hranyZTextu, preskoleniaZTextu, textBezPreskolenia } from "../src/karta/preskolenie.ts";
import { smerPretrcania, vyskaHranyPod } from "../src/hra/PodlozeneNastroje.tsx";

const VIDLY = "Dedičstvo: Tvoje Rany udeľujú o 1 poškodenie viac. Hore: Vzbura. Dole: {Rana}→{Pecka}.";

describe("pečať Preškolenia z textu efektu", () => {
  it("číta spúšťač a premenu, aj s menom akcie z tvorcu (Hazard, Pečeň)", () => {
    expect(preskoleniaZTextu("Furt: Preškolenie {Robota}→{Pecka}.")).toEqual([{ spustac: "Furt", z: "Robota", na: "Pecka" }]);
    expect(preskoleniaZTextu("Konflikt: Preškolenie {Cigareta}→{Hazard}.")).toEqual([{ spustac: "Konflikt", z: "Cigareta", na: "Dlh" }]);
    expect(preskoleniaZTextu("Podpora: Preškolenie {Pečeň}->{Viera}.")).toEqual([{ spustac: "Podpora", z: "PoškodeniePečene", na: "Viera" }]);
  });

  it("dnešný text bez zápisu pečať nemá — nič sa nehádže podľa id karty", () => {
    expect(preskoleniaZTextu("Furt: Roboty kariet, ktoré s ním susedia, sa rátajú ako Pecky.")).toEqual([]);
    expect(preskoleniaZTextu("Dedičstvo: Akcia zrušená tvojím Odporom sa ráta ako tvoja a je posilnená.")).toEqual([]);
  });

  it("hrany Nástroja nie sú pečať na líci", () => {
    expect(preskoleniaZTextu(VIDLY)).toEqual([]);
  });

  it("text bez zápisu ponechá slovo Preškolenie aj hrany Nástroja", () => {
    expect(textBezPreskolenia("Furt: Preškolenie {Robota}→{Pecka}.")).toBe("Furt: Preškolenie.");
    expect(textBezPreskolenia(VIDLY)).toBe(VIDLY);
  });

  it("chybný zápis (rovnaká akcia, neznáma akcia) pečať nedá", () => {
    expect(preskoleniaZTextu("Furt: Preškolenie {Rana}→{Rana}.")).toEqual([]);
    expect(preskoleniaZTextu("Furt: Preškolenie {Pivo}→{Rana}.")).toEqual([]);
  });
});

describe("hrany Nástroja na líci", () => {
  it("Nástroj s oboma hranami má rám, iná karta nie", () => {
    expect(hranyZTextu(VIDLY, ["Nástroj"])).toEqual({ horna: { druh: "karta", ucinok: "Vzbura" }, dolna: { druh: "akcia", z: "Rana", na: "Pecka" } });
    expect(hranyZTextu("Dedičstvo: Tvoje Rany udeľujú o 1 poškodenie viac.", ["Nástroj"])).toBeNull();
    expect(hranyZTextu(VIDLY, ["Občan"])).toBeNull();
  });

  it("Puška (Michal 2026-11-09): hrany posilnenia, text Dedičstva bez nich", () => {
    const puska = "Dedičstvo: Keď by tvoju prepojenú Petelicu zrušil iný efekt (Odpor, NA EX…), namiesto zrušenia udeľuje o 1 poškodenie menej. Hore: Posilnená {Petelica}. Dole: Posilnená {Pecka}.";
    expect(hranyZTextu(puska, ["Nástroj"])).toEqual({ horna: { druh: "posilnenie", akcia: "Petelica" }, dolna: { druh: "posilnenie", akcia: "Pecka" } });
    expect(preskoleniaZTextu(puska)).toEqual([]);
    expect(textBezPreskolenia(puska)).toBe(puska);
  });

});

describe("Nástroj pod kartou (M2)", () => {
  it("trčí dole pod kartou natočenou ku mne, hore pod súperovou — nezáleží, čí je Nástroj", () => {
    expect(smerPretrcania(0, 0)).toBe("dole");
    expect(smerPretrcania(1, 0)).toBe("hore");
    expect(smerPretrcania(1, 1)).toBe("dole");
  });

  it("hrana je čitateľná na malej karte a nenarastie nad 36 px", () => {
    expect(vyskaHranyPod(60)).toBe(18);
    expect(vyskaHranyPod(110)).toBe(28);
    expect(vyskaHranyPod(200)).toBe(36);
  });
});

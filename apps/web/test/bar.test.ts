// Jednotný bar nad stolom (Michal 2026-10-25, mock V2): režim strán podľa fázy,
// ručné prepnutie do konca fázy a jediná stavová správa s prednosťou chyby.

import { describe, expect, it } from "vitest";
import { castiVety, klucFazy, predvolenyRezim, rezimMelichara, vyberSpravu } from "../src/hra/bar.ts";

describe("režim strán baru", () => {
  it("v Zhromaždení ukazuje karty na vyloženie, v Pitke a bitke akcie", () => {
    expect(predvolenyRezim("zhromazdenie")).toBe("karty");
    expect(predvolenyRezim("pitka")).toBe("akcie");
    expect(predvolenyRezim("bitka")).toBe("akcie");
  });

  it("vo voľbe cieľa a v drafte (línia je prázdna) karty", () => {
    expect(predvolenyRezim("volbaCiela")).toBe("karty");
    expect(predvolenyRezim("draft")).toBe("karty");
  });

  it("ručné prepnutie platí do konca fázy — každé Zhromaždenie a Pitka zvlášť", () => {
    expect(klucFazy(2, "pitka", 1)).toBe(klucFazy(2, "pitka", 1));
    expect(klucFazy(2, "pitka", 1)).not.toBe(klucFazy(2, "pitka", 2));
    expect(klucFazy(2, "pitka", 1)).not.toBe(klucFazy(2, "zhromazdenie", 1));
    expect(klucFazy(2, "bitka", 2)).not.toBe(klucFazy(3, "bitka", 2));
  });
});

describe("stavová správa baru", () => {
  it("naraz len jedna: chyba má prednosť pred účtom Pitky a ten pred súperovým ťahom", () => {
    expect(vyberSpravu("Limit je vyčerpaný.", "Pitka 1 vyhodnotená", "Bot vykladá Pijan.")).toEqual({ druh: "chyba", text: "Limit je vyčerpaný." });
    expect(vyberSpravu(null, "Pitka 1 vyhodnotená", "Bot vykladá Pijan.")).toEqual({ druh: "ucet", text: "Pitka 1 vyhodnotená" });
    expect(vyberSpravu(null, null, "Bot vykladá Pijan.")).toEqual({ druh: "super", text: "Bot vykladá Pijan." });
  });

  it("bez udalosti nič", () => {
    expect(vyberSpravu(null, null, null)).toBeNull();
  });
});

describe("Melichar v bare", () => {
  it("piktogram akcie v texte: [Rana] sa nahradí ikonou, slovo za ním ostane", () => {
    const akcie = new Set(["Rana", "Cigareta", "PoškodeniePečene"]);
    expect(castiVety("Každá [Rana] Rana dá 1 tuhé.", (k) => akcie.has(k))).toEqual([{ text: "Každá " }, { akcia: "Rana" }, { text: " Rana dá 1 tuhé." }]);
    expect(castiVety("[Cigareta][PoškodeniePečene]", (k) => akcie.has(k))).toEqual([{ akcia: "Cigareta" }, { akcia: "PoškodeniePečene" }]);
  });

  it("neznámy kľúč aj zástupné meno jadra ostanú textom", () => {
    expect(castiVety("{lokalita} a [Nič] [Rana]", (k) => k === "Rana")).toEqual([{ text: "{lokalita} a [Nič] " }, { akcia: "Rana" }]);
    expect(castiVety("bez značiek", () => true)).toEqual([{ text: "bez značiek" }]);
  });

  it("os kola a nástroje nechá Melichar viditeľné, odhad vezme do bubliny, inak celý bar", () => {
    expect(rezimMelichara(["os-kola"])).toBe("hore");
    expect(rezimMelichara(["hlavicka:senok", "ruka:pijan"])).toBe("hore");
    expect(rezimMelichara(["bitka-ucet"])).toBe("odhad");
    expect(rezimMelichara(["hrozba", "os-kola"])).toBe("odhad");
    expect(rezimMelichara(["ruka:pijan", "potvrdit"])).toBe("cely");
    expect(rezimMelichara([])).toBe("cely");
  });
});

// Popis stupnice a stopa posunu (roadmapa #95) a rozpis bodov pri staršom (#109):
// lístok posunu zráta zdroje a povie, čo z posunu má ktorý hráč; v6 špaky pri staršom.

import { describe, expect, it } from "vitest";
import cardsJson from "../../../packages/core/data/cards.json";
import eldersJson from "../../../packages/core/data/elders.json";
import scorecardsJson from "../../../packages/core/data/scorecards.json";
import type { ElderState, MarkerPos, PosunMarkera } from "@naex/core";
import { loadGameData, setupGame } from "@naex/core";
import { dosledokPosunu, stopaStarsieho, vysvetlenieSpakov } from "../src/hra/LiniaStarsich.tsx";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);
const s0 = setupGame(data, 5);
const elder = (marker: MarkerPos): ElderState => ({ ...(s0.starsi[0] as ElderState), marker });

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

  it("dôsledok (v6, 7 polí): priazeň hneď tomu, ku komu marker prišiel, strach (špaky po bitke) druhému", () => {
    // Zo stredu do súperovej oranžovej (index 5): súper ♥ +2, hráč 0 budí Strach.
    expect(dosledokPosunu(elder(5), 3, 1)).toBe("♥ +2 hneď");
    expect(dosledokPosunu(elder(5), 3, 0, true)).toBe("budíš strach: Strach → +2 po bitke");
    // Späť do stredu: priazeň aj strach zmiznú.
    expect(dosledokPosunu(elder(3), 4, 1)).toBe("♥ preč (bolo +1)");
    expect(dosledokPosunu(elder(3), 4, 0)).toBe("už nebudí strach (bolo Znepokojenie)");
    // Bez posunu nič.
    expect(dosledokPosunu(elder(3), 3, 0)).toBeNull();
  });
});

describe("špaky pri staršom (v6)", () => {
  it("komu starší dá po bitke špaky", () => {
    expect(vysvetlenieSpakov({ elderId: "x", spaky: [2, 0] }, 0, ["Ty", "Fero"])).toMatch(/Bojí sa teba/);
    expect(vysvetlenieSpakov({ elderId: "x", spaky: [0, 3] }, 0, ["Ty", "Fero"])).toMatch(/Bojí sa Fero/);
    expect(vysvetlenieSpakov({ elderId: "x", spaky: [0, 0] }, 0, ["Ty", "Fero"])).toMatch(/Nikoho/);
  });
});


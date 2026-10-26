// Popis stupnice a stopa posunu (roadmapa #95) a rozpis bodov pri staršom (#109):
// lístok posunu zráta zdroje a povie, čo z posunu má ktorý hráč; rozpis bodov ide
// z čísel bodyTeraz (elderScore), nie z vlastného výpočtu.

import { describe, expect, it } from "vitest";
import cardsJson from "../../../packages/core/data/cards.json";
import eldersJson from "../../../packages/core/data/elders.json";
import scorecardsJson from "../../../packages/core/data/scorecards.json";
import type { BodyStarsieho, ElderState, MarkerPos, PosunMarkera } from "@naex/core";
import { bodyTeraz, loadGameData, setupGame, viewFor } from "@naex/core";
import { dosledokPosunu, stopaStarsieho, vysvetlenieBodov } from "../src/hra/LiniaStarsich.tsx";

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

  it("dôsledok: priazeň hneď tomu, ku komu marker prišiel, strach (body) druhému", () => {
    // Zo stredu do súperovej oranžovej (index 7): súper ♥ +2, hráč 0 budí Strach.
    expect(dosledokPosunu(elder(7), 4, 1)).toBe("♥ +2 hneď");
    expect(dosledokPosunu(elder(7), 4, 0, true)).toBe("budíš strach: Strach → až 3 b");
    // Späť do stredu: priazeň aj strach zmiznú.
    expect(dosledokPosunu(elder(4), 6, 1)).toBe("♥ preč (bolo +1)");
    expect(dosledokPosunu(elder(4), 6, 0)).toBe("už nebudí strach (bolo Znepokojenie)");
    // Posun v sivej zóne nemení nič.
    expect(dosledokPosunu(elder(5), 4, 0)).toBeNull();
    expect(dosledokPosunu(elder(5), 4, 1)).toBeNull();
  });
});

describe("rozpis bodov pri staršom (#109)", () => {
  const body = (b: Partial<BodyStarsieho>): BodyStarsieho => ({ elderId: "x", body: [0, 0], vyhry: [0, 0], strach: [0, 0], polozky: [[], []], ...b });

  it("víťaz súbojov: 1 + zóny strachu, porazený nič", () => {
    const vety = vysvetlenieBodov(body({ body: [3, 0], vyhry: [2, 1], strach: [2, 0] }), elder(7), 0, ["Ty", "Fero"]);
    expect(vety.join(" ")).toBe("Súboje 2 : 1 (ty : Fero). Viac súbojov vyhrávaš ty → 1 + 2 za strach (Strach) = 3 b. Fero nedostane nič.");
  });

  it("rovnosť: body obom, každému podľa vzťahu so starším", () => {
    const vety = vysvetlenieBodov(body({ body: [1, 2], vyhry: [1, 1], strach: [0, 1] }), elder(2), 0, ["Ty", "Fero"]);
    expect(vety[1]).toBe("Rovnosť — body dostanú obaja: ty 1 b (priazeň, nie strach), Fero 1 + 1 za strach (Znepokojenie) = 2 b.");
  });

  it("strach v rozpise je ten istý ako v bodoch jadra", () => {
    const s = { ...s0, starsi: s0.starsi.map((e, i) => ({ ...e, marker: ([1, 7, 4, 6, 2, 0, 8, 3] as const)[i] as MarkerPos })) };
    for (const b of bodyTeraz(data, viewFor(data, s, 0)).starsi) {
      for (const p of [0, 1] as const) {
        const su = p === 0 ? 1 : 0;
        expect(b.body[p]).toBe(b.vyhry[p] >= b.vyhry[su] ? 1 + b.strach[p] : 0);
      }
    }
  });
});

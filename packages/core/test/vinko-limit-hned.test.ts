// Vínko vyložené do Dedičstva v Zhromaždení zvýši zostávajúci limit hneď
// (návrh #26 B rozhodcu, dávka 20261027-150555, Michal 2026-10-28; PRAVIDLA §16).

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { CardInstance, GameState } from "../src/index.ts";
import { apply, limitZhromazdenia, loadGameData, planVykladania } from "../src/index.ts";
import { setupSBalickom } from "./helpers.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);
const vinko: CardInstance = { uid: 65001, defId: "vinko", leftLayout: 0, rightLayout: 0 };
const vinko2: CardInstance = { uid: 65002, defId: "vinko", leftLayout: 0, rightLayout: 0 };

function vZhromazdeni(lokalita: string, z: GameState["zhromazdenieStav"], ruka: readonly CardInstance[] = [vinko]): GameState {
  const s0 = setupSBalickom(data, 65);
  return {
    ...s0,
    faza: "zhromazdenie",
    ciel: { typ: "lokalita", lokalita: { uid: 65000, defId: lokalita, leftLayout: 0, rightLayout: 0 } },
    hraci: [{ ...s0.hraci[0], ruka: [...ruka, ...s0.hraci[0].ruka], cigarety: 10 }, s0.hraci[1]],
    zhromazdenieStav: z,
  } as GameState;
}

describe("§16 Vínko vyložené v Zhromaždení: limit +1 hneď (návrh #26 B)", () => {
  it("zostávajúci limit stúpne hneď o 1, limit ďalšieho Zhromaždenia tiež", () => {
    const pred = vZhromazdeni("krcma", { naTahu: 0, zostavaLimit: [2, 2], pasoval: [false, false], navyse: [0, 0] });
    const po = apply(data, pred, { type: "place", uid: vinko.uid, target: "dedicstvo" }, 0).state;
    expect(po.zhromazdenieStav?.zostavaLimit).toEqual([3, 2]);
    expect(limitZhromazdenia(po, 0)).toBe(limitZhromazdenia(pred, 0) + 1);
  });

  it("druhé Vínko limit nezvýši — bonus je len jeden, ako na začiatku Zhromaždenia", () => {
    const pred = vZhromazdeni("krcma", { naTahu: 0, zostavaLimit: [2, 2], pasoval: [false, false], navyse: [0, 0] }, [vinko, vinko2]);
    const s1 = apply(data, pred, { type: "place", uid: vinko.uid, target: "dedicstvo" }, 0).state;
    const s2 = apply(data, { ...s1, zhromazdenieStav: { ...s1.zhromazdenieStav!, naTahu: 0 } }, { type: "place", uid: vinko2.uid, target: "dedicstvo" }, 0).state;
    expect(s2.zhromazdenieStav?.zostavaLimit[0]).toBe(3);
  });

  it("Zastávka: spoločný limit stúpne obom, vlastný len majiteľovi Vínka", () => {
    const pred = vZhromazdeni("zastavka", {
      naTahu: 0,
      zostavaLimit: [4, 4],
      pasoval: [false, false],
      navyse: [0, 0],
      spolocny: true,
      vlastny: [2, 2],
    });
    const po = apply(data, pred, { type: "place", uid: vinko.uid, target: "dedicstvo" }, 0).state;
    expect(po.zhromazdenieStav?.zostavaLimit).toEqual([5, 5]);
    expect(po.zhromazdenieStav?.vlastny).toEqual([3, 2]);
  });

  it("plán ťahu (náhľad limitu) ráta Vínko do Dedičstva ako +1 aj pre ďalšiu kartu ťahu", () => {
    const s = vZhromazdeni("krcma", { naTahu: 0, zostavaLimit: [1, 2], pasoval: [false, false], navyse: [0, 0] });
    const iny = s.hraci[0].ruka.find((k) => !data.cards.get(k.defId)?.tags.includes("Nástroj") && !data.cards.get(k.defId)?.tags.includes("Kliatba"));
    expect(iny).toBeDefined();
    expect(s.hraci[0].poldeciPlne).toBeGreaterThan(0);
    // Vypiť (1 → 0) a Vínko do Dedičstva (+1) — na kartu do línie ostane limit 1.
    const plan = planVykladania(data, s, 0, 1, [
      { karta: vinko, ciel: "dedicstvo" },
      { karta: iny as CardInstance, ciel: "vlastna" },
    ]);
    expect(plan.chyba).toBeNull();
    expect(plan.zostava).toBe(0);
    const samo = planVykladania(data, s, 0, 1, [{ karta: vinko, ciel: "dedicstvo" }]);
    expect(samo.zostava).toBe(2);
  });
});

// Vínko v Dedičstve (v12.2, Michal 2026-11-11: „Tvoje maximum poldeci je o 1 vyššie.“): pri vyložení
// pribudne plný poldeci, v Zhromaždení je to hneď o kartu viac (predtým limit +1, návrh #26 B; PRAVIDLA §16).

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { CardInstance, GameState } from "../src/index.ts";
import { apply, limitBuduceKolo, limitZhromazdenia, loadGameData, planVykladania } from "../src/index.ts";
import { setupSBalickom } from "./helpers.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);
const vinko: CardInstance = { uid: 65001, defId: "vinko", leftLayout: 0, rightLayout: 0 };
const vinko2: CardInstance = { uid: 65002, defId: "vinko", leftLayout: 0, rightLayout: 0 };

function vZhromazdeni(lokalita: string, plne: number, ruka: readonly CardInstance[] = [vinko]): GameState {
  const s0 = setupSBalickom(data, 65);
  return {
    ...s0,
    faza: "zhromazdenie",
    ciel: { typ: "lokalita", lokalita: { uid: 65000, defId: lokalita, leftLayout: 0, rightLayout: 0 } },
    hraci: [{ ...s0.hraci[0], ruka: [...ruka, ...s0.hraci[0].ruka], cigarety: 10, poldeciPlne: plne }, s0.hraci[1]],
    zhromazdenieStav: { naTahu: 0, zostavaLimit: [plne, s0.hraci[1].poldeciPlne], pasoval: [false, false], navyse: [0, 0] },
  } as GameState;
}

describe("§16 Vínko: maximum poldeci +1 (v12.2)", () => {
  it("pri vyložení nový plný poldeci — limit hneď o 1 vyšší, aj maximum po bitke", () => {
    const pred = vZhromazdeni("krcma", 2);
    const po = apply(data, pred, { type: "place", uid: vinko.uid, target: "dedicstvo" }, 0).state;
    expect(po.hraci[0].poldeciPlne).toBe(3);
    expect(po.zhromazdenieStav?.zostavaLimit[0]).toBe(3);
    expect(limitZhromazdenia(po, 0)).toBe(limitZhromazdenia(pred, 0) + 1);
    expect(limitBuduceKolo(po, 0)).toBe(limitBuduceKolo(pred, 0) + 1);
  });

  it("druhé Vínko maximum nezvýši — o 1 vyššie je raz", () => {
    const pred = vZhromazdeni("krcma", 2, [vinko, vinko2]);
    const s1 = apply(data, pred, { type: "place", uid: vinko.uid, target: "dedicstvo" }, 0).state;
    const s2 = apply(data, { ...s1, zhromazdenieStav: { ...s1.zhromazdenieStav!, naTahu: 0 } }, { type: "place", uid: vinko2.uid, target: "dedicstvo" }, 0).state;
    expect(s2.hraci[0].poldeciPlne).toBe(3);
  });

  it("plán ťahu: Vínko do Dedičstva a karta do línie v jednom ťahu — Nástroj cenu nezvýši, poldeci z Vínka zaplatí kartu", () => {
    const s = vZhromazdeni("krcma", 0);
    const iny = s.hraci[0].ruka.find((k) => !data.cards.get(k.defId)?.tags.includes("Nástroj") && !data.cards.get(k.defId)?.tags.includes("Kliatba"));
    expect(iny).toBeDefined();
    const plan = planVykladania(data, s, 0, 0, [
      { karta: vinko, ciel: "dedicstvo" },
      { karta: iny as CardInstance, ciel: "vlastna" },
    ]);
    expect(plan.chyba).toBeNull();
    expect(plan.navyse).toBe(0);
    expect(plan.kroky.map((k) => k.type)).toEqual(["place", "place"]);
    expect(plan.zostava).toBe(0);
    const po = apply(data, s, { type: "tah", kroky: plan.kroky }, 0).state;
    expect(po.strany[0].map((pl) => pl.card.uid)).toEqual([(iny as CardInstance).uid]);
    expect([po.hraci[0].poldeciPlne, po.hraci[0].poldeciVypite]).toEqual([0, 1]);
  });
});

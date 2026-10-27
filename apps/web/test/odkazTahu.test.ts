// „Odkazujem“ (Michal 2026-10-27): Nástroj z ruky do Dedičstva jedným klikom. Je to ten
// istý ťah ako návrh + „potvrdiť“ — overuje sa na pohľade hráča (viewFor) a celý ťah
// musí prejsť aj na serveri (apply s príkazom „tah“).

import { describe, expect, it } from "vitest";
import cardsJson from "../../../packages/core/data/cards.json";
import eldersJson from "../../../packages/core/data/elders.json";
import scorecardsJson from "../../../packages/core/data/scorecards.json";
import type { CardInstance, GameState } from "@naex/core";
import { apply, loadGameData, setupGame, viewFor } from "@naex/core";
import { polozkyOdkazu, tahOdkazu } from "../src/hra/odkazTahu.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

let uidSeq = 71000;
const inst = (defId: string): CardInstance => ({ uid: ++uidSeq, defId, leftLayout: 0, rightLayout: 0 });

/** Zhromaždenie v kole o Jednotu, hráč 0 na ťahu s danou rukou. */
function vZhromazdeni(ruka: CardInstance[], cigarety = 3, dedicstvaVylozene = 0): GameState {
  const s = setupGame(data, 11);
  return {
    ...s,
    faza: "zhromazdenie",
    ciel: { typ: "lokalita", lokalita: inst("jednota") },
    pitkyCelkom: 1,
    pitkaCislo: 0,
    strany: [[], []],
    dedicstvaVylozene,
    hraci: [
      { ...s.hraci[0], ruka, cigarety, poldeciPlne: 2 },
      { ...s.hraci[1], ruka: [inst("pijan"), inst("hasic")], cigarety: 3, poldeciPlne: 2 },
    ],
    zhromazdenieStav: { naTahu: 0, zostavaLimit: [3, 3], pasoval: [false, false], navyse: [0, 0] },
  } as GameState;
}

describe("Odkazujem: Nástroj do Dedičstva", () => {
  it("bez návrhu je ťah len Dedičstvo — Nástroj je v Dedičstve, cigarety ubudnú o cenu, limit ostane", () => {
    const vidly = inst("vidly");
    const s = vZhromazdeni([vidly], 3, 1);
    const t = tahOdkazu(data, viewFor(data, s, 0), 0, [], vidly);
    expect(t.dovod).toBeNull();
    expect(t.kroky).toEqual([{ type: "place", uid: vidly.uid, target: "dedicstvo" }]);
    const po = apply(data, s, { type: "tah", kroky: t.kroky! }, 0).state;
    expect(po.hraci[0].dedicstvo.map((k) => k.uid)).toEqual([vidly.uid]);
    expect(po.hraci[0].cigarety).toBe(1);
    expect(po.dedicstvaVylozene).toBe(2);
    expect(po.zhromazdenieStav?.zostavaLimit[0]).toBe(3);
  });

  it("s kartou v návrhu ide Nástroj na koniec ťahu po Vypiť — rovnako ako pri potvrdení návrhu", () => {
    const pijan = inst("pijan");
    const vidly = inst("vidly");
    const s = vZhromazdeni([pijan, vidly]);
    const polozky = [{ karta: pijan, ciel: "vlastna" as const }, { karta: vidly, ciel: "vlastna" as const }];
    expect(polozkyOdkazu(polozky, vidly)).toEqual([{ karta: pijan, ciel: "vlastna" }, { karta: vidly, ciel: "dedicstvo" }]);
    const t = tahOdkazu(data, viewFor(data, s, 0), 0, polozky, vidly);
    expect(t.kroky).toEqual([{ type: "vypit" }, { type: "place", uid: pijan.uid, target: "vlastna" }, { type: "place", uid: vidly.uid, target: "dedicstvo" }]);
    const po = apply(data, s, { type: "tah", kroky: t.kroky! }, 0).state;
    expect(po.strany[0].map((x) => x.card.uid)).toEqual([pijan.uid]);
    expect(po.hraci[0].dedicstvo.map((k) => k.uid)).toEqual([vidly.uid]);
  });

  it("bez cigariet na Dedičstvo povie prečo, nič neposiela", () => {
    const vidly = inst("vidly");
    const s = vZhromazdeni([vidly], 1, 2);
    const t = tahOdkazu(data, viewFor(data, s, 0), 0, [], vidly);
    expect(t.kroky).toBeNull();
    expect(t.dovod).toMatch(/Dedičstva treba 3/);
  });

  it("mimo Zhromaždenia ani po pase sa neodkazuje", () => {
    const vidly = inst("vidly");
    const s = vZhromazdeni([vidly]);
    const pas = { ...s, zhromazdenieStav: { ...s.zhromazdenieStav!, pasoval: [true, false] as [boolean, boolean] } };
    expect(tahOdkazu(data, viewFor(data, pas, 0), 0, [], vidly).dovod).toMatch(/nevykladáš/);
    expect(tahOdkazu(data, viewFor(data, { ...s, faza: "pitka", zhromazdenieStav: null }, 0), 0, [], vidly).dovod).toMatch(/len v Zhromaždení/);
  });
});

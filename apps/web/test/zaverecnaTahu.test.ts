// Záverečná ako koniec ťahu (Michal 2026-10-24): tlačidlo vedľa potvrdenia odošle návrh
// a jeho posledná karta pôjde lícom dole. Overuje sa na pohľade hráča (viewFor) a celý
// ťah musí prejsť aj na serveri (apply s príkazom „tah“).

import { describe, expect, it } from "vitest";
import cardsJson from "../../../packages/core/data/cards.json";
import eldersJson from "../../../packages/core/data/elders.json";
import scorecardsJson from "../../../packages/core/data/scorecards.json";
import type { CardInstance, GameState, PolozkaVykladania } from "@naex/core";
import { apply, loadGameData, setupGame, viewFor } from "@naex/core";
import { polozkySoZaverecnou, tahSoZaverecnou } from "../src/hra/zaverecnaTahu.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

let uidSeq = 70000;
const inst = (defId: string): CardInstance => ({ uid: ++uidSeq, defId, leftLayout: 0, rightLayout: 0 });

/** Zhromaždenie v kole o Jednotu, hráč 0 na ťahu s danou rukou. */
function vZhromazdeni(ruka: CardInstance[], cigarety = 3): GameState {
  const s = setupGame(data, 11);
  return {
    ...s,
    faza: "zhromazdenie",
    ciel: { typ: "lokalita", lokalita: inst("jednota") },
    pitkyCelkom: 1,
    pitkaCislo: 0,
    strany: [[], []],
    hraci: [
      { ...s.hraci[0], ruka, cigarety, poldeciPlne: 2 },
      { ...s.hraci[1], ruka: [inst("pijan"), inst("hasic")], cigarety: 3, poldeciPlne: 2 },
    ],
    zhromazdenieStav: { naTahu: 0, zostavaLimit: [3, 3], pasoval: [false, false], navyse: [0, 0] },
  } as GameState;
}

describe("Záverečná ako koniec ťahu", () => {
  it("posledná karta návrhu ide ako Záverečná, predchádzajúce ako bežné vyloženie po Vypiť", () => {
    const a = inst("pijan");
    const b = inst("hasic");
    const s = vZhromazdeni([a, b]);
    const t = tahSoZaverecnou(data, viewFor(data, s, 0), 0, [
      { karta: a, ciel: "vlastna" },
      { karta: b, ciel: "superova" },
    ]);
    expect(t.dovod).toBeNull();
    expect(t.kroky).toEqual([{ type: "vypit" }, { type: "place", uid: a.uid, target: "vlastna" }, { type: "zaverecna", uid: b.uid, target: "superova" }]);
    const po = apply(data, s, { type: "tah", kroky: t.kroky! }, 0).state;
    expect(po.strany[1]).toEqual([{ card: b, playedBy: 0, zaverecna: true }]);
    expect(po.hraci[0].cigarety).toBe(2);
    expect(po.zhromazdenieStav?.pasoval[0]).toBe(true);
  });

  it("jedna karta: ťah je len Záverečná", () => {
    const a = inst("pijan");
    const s = vZhromazdeni([a]);
    const t = tahSoZaverecnou(data, viewFor(data, s, 0), 0, [{ karta: a, ciel: "vlastna" }]);
    expect(t.kroky).toEqual([{ type: "zaverecna", uid: a.uid, target: "vlastna" }]);
  });

  it("priznanie ťah nekončí — Záverečnou je posledná karta do línie, aj keď priznanie leží v návrhu za ňou", () => {
    const polozky: PolozkaVykladania[] = [
      { karta: inst("pijan"), ciel: "vlastna" },
      { karta: inst("svokra"), ciel: "priznanie" },
    ];
    expect(polozkySoZaverecnou(polozky).map((x) => x.zaverecna === true)).toEqual([true, false]);
  });

  it("bez karty v návrhu, bez cigarety, s Dedičstvom na konci a po zahranej Záverečnej sa nedá", () => {
    const a = inst("pijan");
    const s = vZhromazdeni([a, inst("hasic")]);
    expect(tahSoZaverecnou(data, viewFor(data, s, 0), 0, []).dovod).toMatch(/Najprv polož/);
    const bezCigariet = vZhromazdeni([a], 0);
    expect(tahSoZaverecnou(data, viewFor(data, bezCigariet, 0), 0, [{ karta: a, ciel: "vlastna" }]).dovod).toMatch(/stojí/);
    expect(tahSoZaverecnou(data, viewFor(data, s, 0), 0, [{ karta: a, ciel: "dedicstvo" }]).dovod).toMatch(/len do línie/);
    // Po Záverečnej (hráč 0 už nevykladá) — aj keby bol znova na rade, druhá nejde.
    const po = apply(data, s, { type: "zaverecna", uid: a.uid, target: "vlastna" }, 0).state;
    const znova = { ...po, zhromazdenieStav: { ...po.zhromazdenieStav!, naTahu: 0 as const } };
    const druha = s.hraci[0].ruka[1]!;
    expect(tahSoZaverecnou(data, viewFor(data, znova, 0), 0, [{ karta: druha, ciel: "vlastna" }]).dovod).toMatch(/druhá nejde/);
  });

  it("chybu pravidiel povie planVykladania — druhá karta bez plného poldeci", () => {
    const a = inst("pijan");
    const b = inst("hasic");
    const s0 = vZhromazdeni([a, b]);
    const s = { ...s0, hraci: [{ ...s0.hraci[0], poldeciPlne: 0 }, s0.hraci[1]] } as GameState;
    const t = tahSoZaverecnou(data, viewFor(data, s, 0), 0, [
      { karta: a, ciel: "vlastna" },
      { karta: b, ciel: "vlastna" },
    ]);
    expect(t.kroky).toBeNull();
    expect(t.dovod).toMatch(/poldeci/);
  });
});

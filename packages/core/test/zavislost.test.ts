// Výhľad závislosti pre rozhranie (playtest 20261019-055945: hráči nevedeli,
// kedy a prečo prichádza Absťák ani ako sa ho zbaviť).

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { CardInstance, GameState, PlayerId } from "../src/index.ts";
import { loadGameData, setupGame, stavZavislosti, viewFor } from "../src/index.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

let uidSeq = 90000;
const inst = (defId: string): CardInstance => ({ uid: ++uidSeq, defId, leftLayout: 0, rightLayout: 0 });

function stav(teraz: number, super_: number, abstaky = 0): GameState {
  const s = setupGame(data, 5);
  const h0 = {
    ...s.hraci[0],
    nerestiTotoKolo: teraz,
    priznane: Array.from({ length: abstaky }, () => inst("abstak")),
  };
  const h1 = { ...s.hraci[1], nerestiTotoKolo: super_ };
  return { ...s, kolo: 3, hraci: [h0, h1] } as GameState;
}

describe("stavZavislosti — Krok so stolom (v8.1)", () => {
  it("menej nerestí než súper → hrozí Absťák a povie, koľko chýba; platí aj v prvom kole", () => {
    const z = stavZavislosti(data, stav(1, 3), 0);
    expect(z.vyhlad).toBe("ziska");
    expect(z.doBezpecia).toBe(2);
    expect(z.super).toBe(3);
    expect(stavZavislosti(data, { ...stav(0, 1), kolo: 1 }, 0).vyhlad).toBe("ziska");
  });

  it("viac nerestí než súper s Absťákom → zbaví sa ho; bez Absťáku nič; súper vidí opak", () => {
    expect(stavZavislosti(data, stav(4, 2, 2), 0).vyhlad).toBe("zbavi");
    expect(stavZavislosti(data, stav(4, 2, 0), 0).vyhlad).toBe("nic");
    expect(stavZavislosti(data, stav(4, 2, 0), 1).vyhlad).toBe("ziska");
  });

  it("pri rovnosti s Absťákom povie, koľko nerestí chýba na zbavenie; Absťák uberá tuhé a dáva Pohoršenie", () => {
    const z = stavZavislosti(data, stav(2, 2, 1), 0);
    expect(z.vyhlad).toBe("nic");
    expect(z.doZbavenia).toBe(1);
    expect(z.abstaky).toBe(1);
    expect(z.ubera).toBe(1);
    expect(z.pohorsenia).toBe(1);
  });

  it("poldeci na stole cez NA EX sa rátajú dopredu obom (vypijú sa v bitke)", () => {
    const s = stav(0, 1);
    const sNaex = { ...s, strany: [[{ card: inst("pijan"), playedBy: 1 as PlayerId, naexBy: 0 as PlayerId }], []] } as GameState;
    expect(stavZavislosti(data, s, 0).vyhlad).toBe("ziska");
    const z = stavZavislosti(data, sNaex, 0);
    expect(z.naexNaStole).toBe(1);
    expect(z.teraz).toBe(1);
    expect(z.vyhlad).toBe("nic");
    expect(stavZavislosti(data, sNaex, 1).super).toBe(1);
  });
});

describe("viewFor — neresti sú verejné", () => {
  it("oba hráči vidia neresti oboch a výhľad sa dá spočítať aj z pohľadu klienta", () => {
    const s = stav(1, 3);
    for (const ja of [0, 1] as const) {
      const v = viewFor(data, s, ja);
      expect(v.hraci[0].nerestiTotoKolo).toBe(1);
      expect(v.hraci[1].nerestiTotoKolo).toBe(3);
      expect(stavZavislosti(data, v, 0)).toEqual(stavZavislosti(data, s, 0));
    }
  });
});

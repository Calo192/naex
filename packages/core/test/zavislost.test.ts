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

function stav(kolo: number, teraz: number, minule: number, abstaky = 0): GameState {
  const s = setupGame(data, 5);
  const h0 = {
    ...s.hraci[0],
    nerestiTotoKolo: teraz,
    nerestiMinuleKolo: minule,
    priznane: Array.from({ length: abstaky }, () => inst("abstak")),
  };
  return { ...s, kolo, hraci: [h0, s.hraci[1]] } as GameState;
}

describe("stavZavislosti", () => {
  it("prvé kolo len nastaví základ", () => {
    expect(stavZavislosti(data, stav(1, 0, 0), 0).vyhlad).toBe("zaklad");
  });

  it("menej nerestí než minule → hrozí Absťák a povie, koľko chýba", () => {
    const z = stavZavislosti(data, stav(3, 1, 3), 0);
    expect(z.vyhlad).toBe("ziska");
    expect(z.doBezpecia).toBe(2);
  });

  it("viac nerestí s Absťákom → zbaví sa ho; bez Absťáku nič", () => {
    expect(stavZavislosti(data, stav(3, 4, 2, 2), 0).vyhlad).toBe("zbavi");
    expect(stavZavislosti(data, stav(3, 4, 2, 0), 0).vyhlad).toBe("nic");
  });

  it("pri rovnosti s Absťákom povie, koľko nerestí chýba na zbavenie", () => {
    const z = stavZavislosti(data, stav(3, 2, 2, 1), 0);
    expect(z.vyhlad).toBe("nic");
    expect(z.doZbavenia).toBe(1);
    expect(z.abstaky).toBe(1);
    expect(z.ubera).toBe(1);
  });

  it("poldeci na stole cez NA EX sa rátajú dopredu (vypijú sa v bitke)", () => {
    const s = stav(2, 0, 1);
    const sNaex = { ...s, strany: [[{ card: inst("pijan"), playedBy: 1 as PlayerId, naexBy: 0 as PlayerId }], []] } as GameState;
    expect(stavZavislosti(data, s, 0).vyhlad).toBe("ziska");
    const z = stavZavislosti(data, sNaex, 0);
    expect(z.naexNaStole).toBe(1);
    expect(z.teraz).toBe(1);
    expect(z.vyhlad).toBe("nic");
  });
});

describe("viewFor — neresti sú verejné", () => {
  it("oba hráči vidia neresti oboch a výhľad sa dá spočítať aj z pohľadu klienta", () => {
    const s = stav(3, 1, 3);
    for (const ja of [0, 1] as const) {
      const v = viewFor(data, s, ja);
      expect(v.hraci[0].nerestiTotoKolo).toBe(1);
      expect(v.hraci[0].nerestiMinuleKolo).toBe(3);
      expect(stavZavislosti(data, v, 0)).toEqual(stavZavislosti(data, s, 0));
    }
  });
});

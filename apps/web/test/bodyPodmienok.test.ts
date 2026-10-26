// Body za starších na stole (pravidlá v5, davka.md): línia starších, bodový bar, koniec
// hry a krčmový účet čítajú súboje podmienok a „kto by staršieho teraz bodoval“ z tých
// istých pomocníkov. Overuje sa, že sedia s bodovaním jadra (bodyTeraz) a že staré
// partie (v4, bez vyhier) sa rozpoznajú.

import { describe, expect, it } from "vitest";
import cardsJson from "../../../packages/core/data/cards.json";
import eldersJson from "../../../packages/core/data/elders.json";
import scorecardsJson from "../../../packages/core/data/scorecards.json";
import type { BodyStarsieho, BodyTeraz, ElderState, GameState, MarkerPos } from "@naex/core";
import { bodyTeraz, loadGameData, setupGame, viewFor } from "@naex/core";
import { jeBodovanieV5, kohoBoduje, preco, subojePoPodmienkach, subojeStarsieho } from "../src/hra/bodyPodmienok.tsx";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

/** Rozohraný stav s vychýlenými markermi a rozdielnymi zásobami — súboje nie sú samé rovnosti. */
function stav(seed: number): GameState {
  const s0 = setupGame(data, seed);
  const markery = [1, 2, 3, 5, 6, 7, 2, 6] as const;
  return {
    ...s0,
    starsi: s0.starsi.map((e, i) => ({ ...e, marker: markery[(i + seed) % 8] as MarkerPos })),
    hraci: [{ ...s0.hraci[0], cigarety: 5 }, { ...s0.hraci[1], cigarety: 1, poldeciPlne: 0 }],
  } as GameState;
}

describe("súboje pri starších (v5) zo skutočného bodovania", () => {
  for (const seed of [1, 7, 42]) {
    it(`seed ${seed}: kto boduje sedí s vyhrami a súčet s bodyTeraz`, () => {
      const body = bodyTeraz(data, viewFor(data, stav(seed), 0));
      expect(jeBodovanieV5(body)).toBe(true);
      let spolu: [number, number] = [0, 0];
      for (const s of body.starsi) {
        const suboje = subojeStarsieho(s);
        expect(suboje).toHaveLength(s.polozky[0].length);
        // Vyhry jadra = súboje, ktoré pomocník pripíše víťazovi.
        expect([suboje.filter((x) => x.vitaz === 0).length, suboje.filter((x) => x.vitaz === 1).length]).toEqual(s.vyhry);
        const kto = kohoBoduje(s);
        if (s.vyhry[0] === s.vyhry[1]) expect(kto).toBe("obaja");
        else expect(kto).toBe(s.vyhry[0] > s.vyhry[1] ? 0 : 1);
        spolu = [spolu[0] + s.body[0], spolu[1] + s.body[1]];
      }
      expect(spolu).toEqual(body.spolu);
    });
  }

  it("súboje podľa podmienky sčítajú vyhry cez všetkých starších", () => {
    const body = bodyTeraz(data, viewFor(data, stav(7), 0));
    const vsetky = body.starsi.flatMap((s) => subojeStarsieho(s));
    for (const [podmienka, t] of subojePoPodmienkach(body)) {
      const tieto = vsetky.filter((x) => x.podmienka === podmienka);
      expect(t.pocet).toBe(tieto.length);
      expect(t.vyhry).toEqual([tieto.filter((x) => x.vitaz === 0).length, tieto.filter((x) => x.vitaz === 1).length]);
    }
    // Cigarety 5 : 1 — kde je súboj o cigarety aktívny, vyhráva hráč 0.
    for (const x of vsetky.filter((y) => y.podmienka === "cigarety")) expect(x.vitaz).toBe(0);
  });
});

describe("kohoBoduje a preco", () => {
  const s = (body: readonly [number, number]): BodyStarsieho => ({ elderId: "x", body, vyhry: [0, 0], strach: [0, 0], polozky: [[], []] });
  it("jeden, obaja, nikto", () => {
    expect(kohoBoduje(s([3, 0]))).toBe(0);
    expect(kohoBoduje(s([0, 1]))).toBe(1);
    expect(kohoBoduje(s([2, 1]))).toBe("obaja");
    expect(kohoBoduje(s([0, 0]))).toBeNull();
  });
  it("1 + zóny strachu, s priazňou či v strede 1", () => {
    const e = setupGame(data, 3).starsi[0] as ElderState;
    // Marker 1 = oranžová na polovici hráča 0: priazeň hráč 0, bojí sa hráča 1.
    expect(preco({ ...e, marker: 1 }, 1)).toBe("1 + 2 za strach");
    expect(preco({ ...e, marker: 1 }, 0)).toBe("1, má jeho priazeň");
    expect(preco({ ...e, marker: 4 }, 0)).toBe("1, marker v strede");
  });
});

describe("staré partie (v4)", () => {
  it("bez vyhier pri staršom — krčmový účet číta body za kusy", () => {
    const v4 = { spolu: [4, 2], starsi: [{ elderId: "x", body: [4, 2], polozky: [[], []] }] } as unknown as BodyTeraz;
    expect(jeBodovanieV5(v4)).toBe(false);
  });
});

// Žeravé ikony (Michal 2026-10-30, mock 3): akcie posilnené Nástrojmi v Dedičstve
// a útoky znížené Úplatkom. Údaj pre stôl dáva jadro, view ho posiela pre oboch.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { CardInstance, GameState, PlayerId, PlayerState } from "../src/index.ts";
import { KONSTANTY, loadGameData, nastrojeTuhe, setupGame, utokPoUplatku, viewFor, vplyvyNaAkcie } from "../src/index.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

let uidSeq = 990000;
const inst = (defId: string): CardInstance => ({ uid: ++uidSeq, defId, leftLayout: 0, rightLayout: 0 });

function sDedicstvom(s: GameState, p: PlayerId, dedicstvo: readonly CardInstance[]): GameState {
  const hraci = [...s.hraci] as [PlayerState, PlayerState];
  hraci[p] = { ...hraci[p], dedicstvo };
  return { ...s, hraci };
}

describe("vplyvyNaAkcie — Nástroje v Dedičstve", () => {
  it("bez Nástrojov nič; Puška Petelica, Vidly Rana, Svätý text Viera", () => {
    const s0 = setupGame(data, 3);
    expect(vplyvyNaAkcie(s0, 0)).toEqual([]);
    const s = sDedicstvom(s0, 0, [inst("puska"), inst("vidly"), inst("svaty_text"), inst("nealko")]);
    expect(vplyvyNaAkcie(s, 0)).toEqual([
      { akcia: "Petelica", zdroj: "puska", o: 1 },
      { akcia: "Rana", zdroj: "vidly", o: 1 },
      { akcia: "Viera", zdroj: "svaty_text", o: KONSTANTY.EFEKT.SVATY_TEXT_VIERA },
    ]);
    // Dedičstvo súpera hráča 0 neposilní.
    expect(vplyvyNaAkcie(s, 1)).toEqual([]);
  });

  it("dva kusy Vidiel: Rana o 2, bitka ráta rovnako (nastrojeTuhe)", () => {
    const s = sDedicstvom(setupGame(data, 3), 1, [inst("vidly"), inst("vidly")]);
    expect(vplyvyNaAkcie(s, 1)).toEqual([{ akcia: "Rana", zdroj: "vidly", o: 2 }]);
    expect(nastrojeTuhe(s, 1, { Rana: 3 })).toEqual([{ zdroj: "vidly", tuhe: 6 }]);
  });

  it("view posiela vplyvy oboch hráčov — obaja vidia to isté (Dedičstvo je verejné)", () => {
    let s = setupGame(data, 5);
    s = sDedicstvom(s, 0, [inst("puska")]);
    s = sDedicstvom(s, 1, [inst("svaty_text")]);
    const v0 = viewFor(data, s, 0);
    const v1 = viewFor(data, s, 1);
    expect(v0.vplyvyAkcii).toEqual([[{ akcia: "Petelica", zdroj: "puska", o: 1 }], [{ akcia: "Viera", zdroj: "svaty_text", o: KONSTANTY.EFEKT.SVATY_TEXT_VIERA }]]);
    expect(v1.vplyvyAkcii).toEqual(v0.vplyvyAkcii);
  });
});

describe("utokPoUplatku — Úplatok Kulturistu", () => {
  it("útok klesá o stupeň Petelica → Pecka → Rana → nič, iné akcie ostávajú", () => {
    expect(utokPoUplatku("Petelica", 0)).toBe("Petelica");
    expect(utokPoUplatku("Petelica", 1)).toBe("Pecka");
    expect(utokPoUplatku("Petelica", 2)).toBe("Rana");
    expect(utokPoUplatku("Pecka", 2)).toBeNull();
    expect(utokPoUplatku("Rana", 1)).toBeNull();
    expect(utokPoUplatku("Viera", 3)).toBe("Viera");
  });
});

// Záznam priazne v logu (Michal 2026-10-23): klient priazeň oznámi toastom a celé
// znenie hľadá hráč v Logu — preto ho píše server ako udalosť (ostane v histórii
// miestnosti aj po obnovení stránky).

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { GameState, MarkerPos } from "../src/index.ts";
import { loadGameData, setupGame, zaznamyPriazne } from "../src/index.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

const sMarkerom = (s: GameState, i: number, marker: number): GameState => ({
  ...s,
  starsi: s.starsi.map((e, j) => (j === i ? { ...e, marker: marker as MarkerPos } : e)),
});

describe("záznam priazne v logu", () => {
  const s = sMarkerom(setupGame(data, 3), 0, 3);

  it("nová priazeň a silnejšia priazeň sa zapíšu, slabšia ani zotrvanie nie", () => {
    const k0 = sMarkerom(s, 0, 2);
    const zaznam = zaznamyPriazne(data, s, k0);
    expect(zaznam).toHaveLength(1);
    expect(zaznam[0]).toMatchObject({ type: "log" });
    expect(zaznam[0]!.type === "log" && zaznam[0]!.text).toMatch(/^Priazeň .+ \(.+\) sily \d+ dostáva Hráč 1\.$/);
    expect(zaznamyPriazne(data, k0, sMarkerom(s, 0, 1))).toHaveLength(1);
    expect(zaznamyPriazne(data, sMarkerom(s, 0, 1), k0)).toHaveLength(0);
    expect(zaznamyPriazne(data, k0, k0)).toHaveLength(0);
    expect(zaznamyPriazne(data, k0, s)).toHaveLength(0);
  });

  it("preklopenie k súperovi je nová priazeň druhého hráča", () => {
    const zaznam = zaznamyPriazne(data, sMarkerom(s, 0, 2), sMarkerom(s, 0, 4));
    expect(zaznam).toHaveLength(1);
    expect(zaznam[0]!.type === "log" && zaznam[0]!.text).toMatch(/ dostáva Hráč 2\.$/);
  });
});

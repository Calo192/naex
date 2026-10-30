// Malé pečiatky krokov (Michal 2026-10-30): pas v Zhromaždení a koniec brania zo šenku. Overuje sa
// na udalostiach skutočnej partie botov — keby motor zmenil znenie logu, pečiatky by potichu zmizli.

import { describe, expect, it } from "vitest";
import cardsJson from "../../../packages/core/data/cards.json";
import eldersJson from "../../../packages/core/data/elders.json";
import scorecardsJson from "../../../packages/core/data/scorecards.json";
import type { Command, PlayerId } from "@naex/core";
import { apply, loadGameData, naTahu, rngInt, rngSeed, setupGame, tahBota } from "@naex/core";
import { peciatkyKrokov, textPeciatkyKroku } from "../src/hra/peciatkyKrokov.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

describe("pečiatky krokov", () => {
  it("pas a koniec brania zo šenku dajú pečiatku tomu, kto ich urobil; iné ťahy nie", () => {
    let s = setupGame(data, 5, { lokalit: 3 });
    let rng = rngSeed(41);
    const videne = { pas: 0, dost: 0 };
    for (let i = 0; i < 4000 && s.koniec === null && (videne.pas < 2 || videne.dost < 2); i++) {
      const p = naTahu(s);
      if (p === null) break;
      const [j, r] = rngInt(rng, 2 ** 31);
      rng = r;
      const cmd: Command = tahBota(data, s, p, j, { povaha: "stamgast" });
      const { state, events } = apply(data, s, cmd, p);
      const pec = peciatkyKrokov(events);
      if (cmd.type === "pass") expect(pec).toContainEqual({ hrac: p, druh: "pas" });
      if (cmd.type === "draftStop") expect(pec).toContainEqual({ hrac: p, druh: "dost" });
      // Pečiatka len tomu, kto ešte nepasoval či ešte bral (aj keď ho hra zastavila sama).
      for (const x of pec) {
        if (x.druh === "pas") expect(s.zhromazdenieStav?.pasoval[x.hrac]).toBe(false);
        else expect(s.draftStav?.hotovo[x.hrac]).toBe(false);
      }
      for (const x of pec) videne[x.druh]++;
      s = state;
    }
    expect(videne.pas).toBeGreaterThan(0);
    expect(videne.dost).toBeGreaterThan(0);
  });

  it("text hovorí, kto pasoval či prestal brať", () => {
    const ja: PlayerId = 0;
    expect(textPeciatkyKroku({ hrac: 1, druh: "pas" }, ja, "Fero")).toEqual({ nazov: "PAS", popis: "Fero pasuje do Pitky." });
    expect(textPeciatkyKroku({ hrac: 0, druh: "dost" }, ja, "Jano")).toEqual({ nazov: "DOSŤ", popis: "Už neberieš zo šenku." });
  });
});

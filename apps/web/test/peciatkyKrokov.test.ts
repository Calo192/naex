// Malé pečiatky krokov (Michal 2026-10-30): pas v Zhromaždení a koniec brania zo šenku. Overuje sa
// na udalostiach skutočnej partie botov — keby motor zmenil znenie logu, pečiatky by potichu zmizli.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import cardsJson from "../../../packages/core/data/cards.json";
import eldersJson from "../../../packages/core/data/elders.json";
import scorecardsJson from "../../../packages/core/data/scorecards.json";
import type { Command, GameState, PlayerId } from "@naex/core";
import { apply, loadGameData, naTahu, rngInt, rngSeed, setupGame, tahBota } from "@naex/core";
import { peciatkyKrokov, textPeciatkyKroku } from "../src/hra/peciatkyKrokov.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

describe("pečiatky krokov", () => {
  it("pas a koniec brania zo šenku dajú pečiatku tomu, kto ich urobil; iné ťahy nie", () => {
    let s = setupGame(data, 5, { lokalit: 3 });
    let rng = rngSeed(41);
    const videne = { pas: 0, dost: 0, hasic: 0 };
    for (let i = 0; i < 4000 && s.koniec === null && (videne.pas < 2 || videne.dost < 2); i++) {
      const p = naTahu(s);
      if (p === null) break;
      const [j, r] = rngInt(rng, 2 ** 31);
      rng = r;
      const cmd: Command = tahBota(data, s, p, j, { povaha: "stamgast" });
      const { state, events } = apply(data, s, cmd, p);
      const pec = peciatkyKrokov(events);
      if (cmd.type === "pass") expect(pec).toContainEqual({ hrac: p, druh: "pas" });
      for (const e of events) if (e.type === "autoPas") expect(pec).toContainEqual({ hrac: e.hrac, druh: "pas", auto: true });
      if (cmd.type === "draftStop") expect(pec).toContainEqual({ hrac: p, druh: "dost" });
      // Pečiatka len tomu, kto ešte nepasoval či ešte bral (aj keď ho hra zastavila sama).
      for (const x of pec) {
        if (x.druh === "pas") expect(s.zhromazdenieStav?.pasoval[x.hrac]).toBe(false);
        else if (x.druh === "dost") expect(s.draftStav?.hotovo[x.hrac]).toBe(false);
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

  it("pas, ktorý urobila hra, povie súperovi aj hráčovi, že nemal čo vyložiť (Michal 2026-11-02)", () => {
    const udalosti = [
      { type: "log", text: "Hráč 2 už nemá čo vyložiť." },
      { type: "autoPas", hrac: 1, dovody: [], pre: 0 },
      { type: "log", text: "Hráč 2 pasuje do Pitky." },
      { type: "log", text: "Hráč 1 pasuje do Pitky." },
    ] as const;
    expect(peciatkyKrokov(udalosti)).toEqual([
      { hrac: 1, druh: "pas", auto: true },
      { hrac: 0, druh: "pas" },
    ]);
    expect(textPeciatkyKroku({ hrac: 1, druh: "pas", auto: true }, 0, "Bot Fero").popis).toBe("Bot Fero nemá čo vyložiť — pasuje do Pitky.");
    expect(textPeciatkyKroku({ hrac: 1, druh: "pas", auto: true }, 1, "Jano").popis).toBe("Nemáš čo vyložiť — pasuješ do Pitky.");
  });

  it("Hasič s prázdnym odhadzovacím balíčkom dá pečiatku tomu, kto ho vyložil; s kartami nie (Michal 2026-11-03)", () => {
    // Prvé Zhromaždenie partie botov, hráč na ťahu dostane do ruky Hasiča — znenie logu je z motora.
    let s = setupGame(data, 5, { lokalit: 3 });
    let rng = rngSeed(7);
    for (let i = 0; i < 500 && s.faza !== "zhromazdenie"; i++) {
      const p = naTahu(s);
      if (p === null) break;
      const [j, r] = rngInt(rng, 2 ** 31);
      rng = r;
      s = apply(data, s, tahBota(data, s, p, j, { povaha: "stamgast" }), p).state;
    }
    const p = naTahu(s) as PlayerId;
    expect(s.faza).toBe("zhromazdenie");
    const hasic = { uid: s.nextUid, defId: "hasic", leftLayout: 0, rightLayout: 0 };
    const vyloz = (odhadzovaci: GameState["hraci"][number]["odhadzovaci"]) => {
      const h = { ...s.hraci[p], ruka: [...s.hraci[p].ruka, hasic], odhadzovaci };
      const pred: GameState = { ...s, nextUid: s.nextUid + 1, hraci: p === 0 ? [h, s.hraci[1]] : [s.hraci[0], h] };
      return peciatkyKrokov(apply(data, pred, { type: "place", uid: hasic.uid, target: "vlastna" }, p).events).filter((x) => x.druh === "hasic");
    };
    expect(vyloz([])).toEqual([{ hrac: p, druh: "hasic" }]);
    expect(vyloz([{ uid: s.nextUid + 1, defId: "cirhoza", leftLayout: 0, rightLayout: 0 }])).toEqual([]);
    expect(textPeciatkyKroku({ hrac: p, druh: "hasic" }, p, "Jano")).toEqual({ nazov: "HASIČ", popis: "Odhadzovací balíček je prázdny — nič nevytiahol." });
  });
});

describe("pečiatka Hasiča len pre toho, kto ho vyložil", () => {
  it("stôl súperovi pečiatku Hasiča neukáže — stačí mu log", () => {
    const zdroj = readFileSync(new URL("../src/hra/HernaPlocha.tsx", import.meta.url), "utf8");
    expect(zdroj).toContain('(x.druh !== "hasic" || x.hrac === ja)');
  });
});

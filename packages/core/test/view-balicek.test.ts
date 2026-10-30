// Doberací balíček na stole (Michal 2026-10-23): hráč vidí zloženie svojho
// balíčka, nie poradie. viewFor posiela len zoradené defId s počtom — bez uid,
// a súperov balíček vôbec.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { GameState, PlayerId } from "../src/index.ts";
import { loadGameData, setupGame, viewFor } from "../src/index.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

/** Stav, v ktorom má hráč p v doberacom balíčku presne dané karty. */
function sBalickom(state: GameState, p: PlayerId, doberaci: GameState["hraci"][number]["doberaci"]): GameState {
  const hraci = [...state.hraci] as [GameState["hraci"][0], GameState["hraci"][1]];
  hraci[p] = { ...hraci[p], doberaci };
  return { ...state, hraci };
}

describe("viewFor — zloženie doberacieho balíčka", () => {
  const zaklad = setupGame(data, 7);
  const karty = [
    { uid: 901, defId: "pijan", leftLayout: 0, rightLayout: 0 },
    { uid: 902, defId: "cirhoza", leftLayout: 0, rightLayout: 0 },
    { uid: 903, defId: "pijan", leftLayout: 0, rightLayout: 0 },
    { uid: 904, defId: "milujuca_manzelka", leftLayout: 0, rightLayout: 0 },
  ];

  it("posiela môj balíček ako zoradené defId s počtom", () => {
    const v = viewFor(data, sBalickom(zaklad, 0, karty), 0);
    expect(v.mojBalicekZlozenie).toEqual([
      { defId: "cirhoza", pocet: 1 },
      { defId: "milujuca_manzelka", pocet: 1 },
      { defId: "pijan", pocet: 2 },
    ]);
    expect(v.hraci[0].doberaciPocet).toBe(4);
  });

  it("poradie balíčka sa z pohľadu nedá vyčítať", () => {
    const a = viewFor(data, sBalickom(zaklad, 0, karty), 0);
    const b = viewFor(data, sBalickom(zaklad, 0, [...karty].reverse()), 0);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("neposiela uid kariet z balíčka", () => {
    const json = JSON.stringify(viewFor(data, sBalickom(zaklad, 0, karty), 0));
    for (const k of karty) expect(json).not.toMatch(new RegExp(`"uid":${k.uid}[,}]`));
  });

  it("súper zloženie môjho balíčka nevidí", () => {
    const s = sBalickom(sBalickom(zaklad, 0, karty), 1, []);
    const preSupera = viewFor(data, s, 1);
    expect(preSupera.mojBalicekZlozenie).toEqual([]);
    // Ani inak: pohľad súpera je rovnaký pre akýkoľvek môj balíček s rovnakým
    // počtom kariet a kliatob (počet kliatob je verejný, view-kliatby.test.ts).
    const ine = karty.map((k) => (k.defId === "cirhoza" ? k : { ...k, defId: "hasic" }));
    expect(JSON.stringify(viewFor(data, sBalickom(s, 0, ine), 1))).toBe(JSON.stringify(preSupera));
  });
});

describe("viewFor — balíčky Náradie a Občania (v8.5)", () => {
  const zaklad = setupGame(data, 11);

  it("počty kariet sú verejné, obsah a poradie nie", () => {
    for (const ja of [0, 1] as const) {
      const v = viewFor(data, zaklad, ja);
      expect(v.naradiePocet).toBe(zaklad.naradie.length);
      expect(v.obcaniaPocet).toBe(zaklad.obcania.length);
      const json = JSON.stringify(v);
      expect(json).not.toContain('"naradie":');
      expect(json).not.toContain('"obcania":');
      for (const k of [...zaklad.naradie, ...zaklad.obcania]) expect(json).not.toMatch(new RegExp(`"uid":${k.uid}[,}]`));
      // Iné poradie oboch balíčkov dá ten istý pohľad.
      const ine = { ...zaklad, naradie: [...zaklad.naradie].reverse(), obcania: [...zaklad.obcania].reverse() };
      expect(JSON.stringify(viewFor(data, ine, ja))).toBe(json);
    }
  });
});

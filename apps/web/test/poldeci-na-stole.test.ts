// Poldeci „na stole“ (pod NA EX) sa ráta k vypitým (Michal 2026-11-03): v bitke sa vypije
// a vráti sa vypitý (§9.5), preto ho dlaždica Poldeci kreslí ako prázdny pohár, nie ako nič.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import cardsJson from "../../../packages/core/data/cards.json";
import eldersJson from "../../../packages/core/data/elders.json";
import scorecardsJson from "../../../packages/core/data/scorecards.json";
import type { GameState, PlayerId } from "@naex/core";
import { apply, legalCommands, loadGameData, mozeHrat, naTahu, opponentOf, setupGame, tahBota, viewFor } from "@naex/core";
import { detailZdroja, poldeciNaStole, riadkyTabule, type CislaHraca, type PohladNaPoldeci } from "../src/hra/tabula.ts";
import { IkonaPoldeci } from "../src/hra/ikonyZdrojov.tsx";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);
const ja: PlayerId = 0;
const su = opponentOf(ja);

/** Prvá Pitka, v ktorej hráč 0 smie dať NA EX — partia botov zo semienka `seed`; null = taká nebola. */
function pitkaSNaex(seed: number): GameState | null {
  let s = setupGame(data, seed);
  for (let n = 0; n < 4000; n++) {
    if (s.faza === "pitka" && mozeHrat(s, ja) && legalCommands(data, s, ja).some((c) => c.type === "naex")) return s;
    const kto = naTahu(s);
    if (kto === null) break;
    s = apply(data, s, tahBota(data, s, kto, n * 7919, { povaha: "igor" }), kto).state;
  }
  return null;
}

/**
 * Pitka po NA EX hráča 0, ktoré ostalo skryté (súper ešte hrá Pitku) — semienko sa hľadá, lebo
 * partie botov sa menia so sadou (sada v11.17: semienko 8 už skryté NA EX nedá).
 */
function poSkrytomNaex(): GameState {
  for (let seed = 8; seed < 60; seed++) {
    const s0 = pitkaSNaex(seed);
    const naex = s0 === null ? undefined : legalCommands(data, s0, ja).find((c) => c.type === "naex");
    if (s0 === null || naex === undefined) continue;
    const s = apply(data, s0, naex, ja).state;
    if (poldeciNaStole(viewFor(data, s, ja), ja).skryte > 0) return s;
  }
  throw new Error("Pitka so skrytým NA EX sa nenašla");
}

describe("poldeci na stole", () => {
  it("skryté NA EX vidí na stole len jeho majiteľ; súperovi sa neprezradí", () => {
    const s = poSkrytomNaex();
    const moj = viewFor(data, s, ja);
    expect(poldeciNaStole(moj, ja)).toEqual({ naStole: 1, skryte: 1 });
    // Súper o mojom skrytom NA EX nevie (bez Bzdochy) — aj pre neho mám poldeci, ako som mal.
    const jeho = viewFor(data, s, su);
    expect(poldeciNaStole(jeho, ja).naStole).toBe(0);
    expect(jeho.hraci[ja].poldeciPlne).toBe(moj.hraci[ja].poldeciPlne);
  });

  it("ráta NA EX v línii, oba poldeci na Výtržníkovi aj NA EX na rube súperovej Záverečnej", () => {
    const pl = (uid: number, naexBy?: PlayerId, naexBy2?: PlayerId) => ({ card: { uid }, playedBy: ja, ...(naexBy === undefined ? {} : { naexBy }), ...(naexBy2 === undefined ? {} : { naexBy2 }) });
    const view = {
      strany: [[pl(1, ja), pl(2, su, ja)], [pl(3), pl(4, su)]],
      pitkaStav: null,
      // Uid 9 v strany nie je (súperova Záverečná lícom dole); uid 1 je moja odkrytá Záverečná.
      zaverecne: [
        { strana: su, majitel: su, uid: 9, naexBy: ja },
        { strana: ja, majitel: ja, uid: 1, naexBy: ja },
      ],
    } as unknown as PohladNaPoldeci;
    expect(poldeciNaStole(view, ja)).toEqual({ naStole: 3, skryte: 0 });
    expect(poldeciNaStole(view, su)).toEqual({ naStole: 2, skryte: 0 });
  });

  it("dlaždica kreslí poldeci na stole ako vypitý pohár so značkou stola", () => {
    const html = renderToStaticMarkup(createElement(IkonaPoldeci, { naStole: true }));
    expect(html).toContain("ikona-poldeci vypity na-stole");
    expect(html).toContain('class="stol"');
    expect(renderToStaticMarkup(createElement(IkonaPoldeci, {}))).not.toContain("stol");
  });

  it("tabuľa a okno zdroja na telefóne rátajú poldeci na stole k vypitým", () => {
    const c = { poldeci: 2, vypite: 0, naStole: 1, limit: 3 } as unknown as CislaHraca;
    const r = riadkyTabule(c, { ...c, naStole: 0 }).find((x) => x.kluc === "poldeci");
    expect(r).toMatchObject({ ja: "2 · 1", su: "2 · 0" });
    const d = detailZdroja("poldeci", c, true);
    const riadky = new Map(d.riadky);
    expect(riadky.get("vypité")).toBe("1");
    expect(riadky.get("z toho na stole (NA EX)")).toBe("1");
    // Neklame: zo stola sa vracia vypitý (§9.5).
    expect(d.text).toContain("vráti sa vypitý");
    expect(new Map(detailZdroja("poldeci", { ...c, naStole: 0 }, true).riadky).has("z toho na stole (NA EX)")).toBe(false);
  });
});


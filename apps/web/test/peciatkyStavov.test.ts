// Stavy karty v línii sú pečiatky cez ilustráciu ako NA EX! (Michal 2026-11-11: „nech to majú cez
// karty nalepené pečiatkou podobne ako NA EX, nie ako teraz malým nápisom nad kartou“).

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { CardLineEval } from "@naex/core";
import { loadGameData } from "@naex/core";
import cardsJson from "../../../packages/core/data/cards.json";
import eldersJson from "../../../packages/core/data/elders.json";
import scorecardsJson from "../../../packages/core/data/scorecards.json";
import { stavyKarty, vytrznikNaKarte } from "../src/hra/HernaKarta.tsx";
import { naexNaKarte, PeciatkyKarty, type StavNaKarte } from "../src/hra/PeciatkaNaex.tsx";

const ev = (x: Partial<CardLineEval>): CardLineEval => ({ uid: 1, vzbura: false, forsaz: false, left: [], right: [], ...x });
const zaverecna: StavNaKarte = { druh: "zaverecna", text: "ZÁVEREČNÁ", pod: "lícom dole", titul: "Tvoja Záverečná" };
const vytrznik: StavNaKarte = { druh: "vytrznik", text: "VÝTRŽNÍK!", pod: "Rany pre teba", titul: "Zrážka NA EX" };

describe("stavy karty ako pečiatky", () => {
  it("Vzbura a Forsáž z vyhodnotenia, každá s vysvetlením", () => {
    const s = stavyKarty(ev({ vzbura: true, forsaz: true }), false);
    expect(s.map((x) => [x.druh, x.text])).toEqual([
      ["vzbura", "VZBURA!"],
      ["forsaz", "FORSÁŽ!"],
    ]);
    for (const x of s) expect(x.titul.length).toBeGreaterThan(20);
  });

  it("NA EX zahasené Odporom a posilnené Posilnením — pri Výtržníkovi nie, ten má akcie prepísané na Rany", () => {
    expect(stavyKarty(ev({ naexStit: "Odpor" }), false).map((x) => x.druh)).toEqual(["zahasene"]);
    expect(stavyKarty(ev({ naexStit: "Posilnenie" }), false).map((x) => x.druh)).toEqual(["posilnene"]);
    expect(stavyKarty(ev({ naexStit: "Odpor" }), true, [vytrznik]).map((x) => x.druh)).toEqual(["vytrznik"]);
  });

  it("Výtržník z línie (s menom) má prednosť pred holým; bez neho karta Výtržníka doplní sama", () => {
    expect(stavyKarty(null, true, [vytrznik])).toEqual([vytrznik]);
    expect(stavyKarty(null, true).map((x) => [x.druh, x.pod])).toEqual([["vytrznik", undefined]]);
  });

  it("Záverečná ide za stavy, ktoré menia akcie", () => {
    expect(stavyKarty(ev({ vzbura: true }), true, [zaverecna, vytrznik]).map((x) => x.druh)).toEqual(["vytrznik", "vzbura", "zaverecna"]);
  });

  it("karta bez stavu nemá pečiatku", () => {
    expect(stavyKarty(ev({}), false)).toEqual([]);
    expect(renderToStaticMarkup(createElement(PeciatkyKarty, { stavy: [] }))).toBe("");
  });

  it("NA EX + Výtržník: dve pečiatky pod sebou, NA EX navrchu, Výtržník s titulkom", () => {
    const html = renderToStaticMarkup(createElement(PeciatkyKarty, { naex: { od: "obaja", kto: "obaja" }, stavy: [vytrznik] }));
    expect(html).toContain('class="peciatky-karty peciatky-2"');
    expect(html.indexOf("NA EX!")).toBeLessThan(html.indexOf("VÝTRŽNÍK!"));
    expect(html).toContain('title="Zrážka NA EX"');
    expect(html).toContain("stav-peciatka-vytrznik");
  });
});

describe("Výtržník na karte: zrážka aj Injekcia pod kartou", () => {
  const data = loadGameData(cardsJson, eldersJson, scorecardsJson);
  const injekcia = { card: { uid: 2, defId: "lievik", leftLayout: 0, rightLayout: 0 }, majitel: 0 as const, hrana: "horna" as const };

  it("Injekcia hore pod kartou: VÝTRŽNÍK! s riadkom, komu sú Rany, a menom Nástroja v titulku", () => {
    const s = vytrznikNaKarte(data, false, [injekcia], "Fero");
    expect(s).toMatchObject({ druh: "vytrznik", text: "VÝTRŽNÍK!", pod: "Rany pre Fero" });
    expect(s?.titul).toContain("Injekcia pod kartou");
  });

  it("zrážka NA EX: titulok zrážky; NA EX! (obaja) navrchu a VÝTRŽNÍK! pod ním", () => {
    const s = vytrznikNaKarte(data, true, undefined, "teba");
    expect(s?.titul).toContain("Zrážka NA EX");
    const html = renderToStaticMarkup(createElement(PeciatkyKarty, { naex: naexNaKarte({ naexBy: 0, naexBy2: 1, skryteMoje: false, skryteSupera: false }, 0, () => "Fero"), stavy: stavyKarty(null, true, s === null ? [] : [s]) }));
    expect(html).toContain('class="peciatky-karty peciatky-2"');
    expect(html).toContain("obaja");
    expect(html).toContain("Rany pre teba");
  });

  it("bez zrážky a s Injekciou dole (preškolenie) karta Výtržník nie je", () => {
    expect(vytrznikNaKarte(data, false, [{ ...injekcia, hrana: "dolna" }], "Fero")).toBeNull();
    expect(vytrznikNaKarte(data, false, undefined, "Fero")).toBeNull();
  });

  it("texty pod NA EX! idú cez preklad (tvoj, obaja, skryto)", () => {
    const html = renderToStaticMarkup(createElement(PeciatkyKarty, { naex: naexNaKarte({ naexBy: undefined, naexBy2: undefined, skryteMoje: true, skryteSupera: false }, 0, () => "Fero"), stavy: [] }));
    expect(html).toContain("tvoj · skryto");
  });
});

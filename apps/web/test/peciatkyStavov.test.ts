// Stavy karty v línii sú pečiatky cez ilustráciu ako NA EX! (Michal 2026-11-11: „nech to majú cez
// karty nalepené pečiatkou podobne ako NA EX, nie ako teraz malým nápisom nad kartou“). Zahasené,
// Posilnené a Záverečná pečiatku nemajú; VYHRAL! / REMÍZA leží na lokalite po bitke.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { BitkaNaNastenke, CardInstance, CardLineEval } from "@naex/core";
import { loadGameData } from "@naex/core";
import cardsJson from "../../../packages/core/data/cards.json";
import eldersJson from "../../../packages/core/data/elders.json";
import scorecardsJson from "../../../packages/core/data/scorecards.json";
import { bezJamiek, stavyKarty, vytrznikNaKarte } from "../src/hra/HernaKarta.tsx";
import { naexNaKarte, PeciatkyKarty, type StavNaKarte } from "../src/hra/PeciatkaNaex.tsx";
import { peciatkaVysledku } from "../src/hra/Spaky.tsx";

const ev = (x: Partial<CardLineEval>): CardLineEval => ({ uid: 1, vzbura: false, forsaz: false, left: [], right: [], ...x });
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

  it("NA EX zahasené Odporom či posilnené Posilnením pečiatku nemá (Michal 2026-11-11)", () => {
    expect(stavyKarty(ev({ naexStit: "Odpor" }), false)).toEqual([]);
    expect(stavyKarty(ev({ naexStit: "Posilnenie" }), false)).toEqual([]);
  });

  it("Výtržník z línie (s menom) má prednosť pred holým; bez neho karta Výtržníka doplní sama", () => {
    expect(stavyKarty(null, true, [vytrznik])).toEqual([vytrznik]);
    expect(stavyKarty(null, true).map((x) => [x.druh, x.pod])).toEqual([["vytrznik", undefined]]);
  });

  it("karta bez stavu nemá pečiatku", () => {
    expect(stavyKarty(ev({}), false)).toEqual([]);
    expect(renderToStaticMarkup(createElement(PeciatkyKarty, { stavy: [] }))).toBe("");
  });
});

describe("NA EX! vo farbe hráča, pri jeho strane, bez mena", () => {
  const meno = (): string => "Fero";
  const html = (naexBy: 0 | 1 | undefined, naexBy2: 0 | 1 | undefined, stavy: readonly StavNaKarte[] = []): string =>
    renderToStaticMarkup(createElement(PeciatkyKarty, { naex: naexNaKarte({ naexBy, naexBy2, skryteMoje: false, skryteSupera: false }, 0, meno), stavy }));

  it("moje NA EX je dole (bližšie ku mne) v mojej farbe, súperovo hore v jeho — meno na pečiatke nie je", () => {
    const moje = html(0, undefined);
    expect(moje).toMatch(/peciatky-hore"><\/span>/u);
    expect(moje).toMatch(/peciatky-dole"><span class="naex-peciatka naex-peciatka-ja"/u);
    const superovo = html(1, undefined);
    expect(superovo).toMatch(/peciatky-hore"><span class="naex-peciatka naex-peciatka-su"/u);
    expect(superovo).toMatch(/peciatky-dole"><\/span>/u);
    // Meno je len pre čítačku, nie text pečiatky.
    expect(superovo.replace(/<[^>]*>/gu, "")).toBe("NA EX!");
    expect(superovo).toContain('aria-label="NA EX — Fero"');
  });

  it("zrážka: dve NA EX! (súperovo hore, moje dole) a VÝTRŽNÍK! medzi nimi — tri pečiatky", () => {
    const h = html(0, 1, stavyKarty(null, true, [vytrznik]));
    expect(h).toContain('class="peciatky-karty peciatky-3"');
    expect(h.match(/NA EX!/gu)).toHaveLength(2);
    expect(h.indexOf("naex-peciatka-su")).toBeLessThan(h.indexOf("VÝTRŽNÍK!"));
    expect(h.indexOf("VÝTRŽNÍK!")).toBeLessThan(h.indexOf("naex-peciatka-ja"));
    expect(h).toContain('title="Zrážka NA EX"');
    expect(h).not.toContain("obaja");
  });

  it("skryté NA EX len obrysom, bez mena aj bez „skryto“ na pečiatke", () => {
    const h = renderToStaticMarkup(createElement(PeciatkyKarty, { naex: naexNaKarte({ naexBy: undefined, naexBy2: undefined, skryteMoje: true, skryteSupera: false }, 0, meno), stavy: [] }));
    expect(h).toContain("naex-peciatka-ja naex-peciatka-skryto");
    expect(h.replace(/<[^>]*>/gu, "")).toBe("NA EX!");
    expect(h).toContain("tvoj · skryto");
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

  it("zrážka NA EX: titulok zrážky a riadok, komu sú Rany", () => {
    const s = vytrznikNaKarte(data, true, undefined, "teba");
    expect(s?.titul).toContain("Zrážka NA EX");
    const html = renderToStaticMarkup(createElement(PeciatkyKarty, { naex: naexNaKarte({ naexBy: 0, naexBy2: 1, skryteMoje: false, skryteSupera: false }, 0, () => "Fero"), stavy: stavyKarty(null, true, s === null ? [] : [s]) }));
    expect(html).toContain('class="peciatky-karty peciatky-3"');
    expect(html).toContain("Rany pre teba");
  });

  it("bez zrážky a s Injekciou dole (preškolenie) karta Výtržník nie je", () => {
    expect(vytrznikNaKarte(data, false, [{ ...injekcia, hrana: "dolna" }], "Fero")).toBeNull();
    expect(vytrznikNaKarte(data, false, undefined, "Fero")).toBeNull();
  });
});

describe("jamky len na kartách, ktoré idú do línie (Michal 2026-11-11: „nemusia mať dierky“)", () => {
  const data = loadGameData(cardsJson, eldersJson, scorecardsJson);
  const k = (defId: string): CardInstance => ({ uid: 1, defId, leftLayout: 0, rightLayout: 0 });

  it("Cirhóza a Absťák jamky nemajú, Občan áno, Nástroj ostáva, ako je", () => {
    expect(bezJamiek(data, k("cirhoza"))).toBe(true);
    expect(bezJamiek(data, k("abstak"))).toBe(true);
    expect(bezJamiek(data, k("pijan"))).toBe(false);
    expect(bezJamiek(data, k("vidly"))).toBe(false);
  });
});

describe("VYHRAL! / REMÍZA na lokalite po bitke", () => {
  const b = (vitaz: 0 | 1 | null): BitkaNaNastenke =>
    ({
      kolo: 1,
      lokalita: { uid: 9, defId: "krcma", leftLayout: 0, rightLayout: 0 },
      vitaz,
      rozhodlo: "tuhe",
      pitky: 2,
      zaBitku: vitaz === 0 ? [6, 0] : vitaz === 1 ? [0, 6] : [0, 0],
      zoSekery: 0,
      abstakZrazka: 0,
      prepadlo: 0,
      zaStarsich: [0, 0],
      exekutor: [0, 0],
      prebytok: [0, 0],
      spakyPo: vitaz === 0 ? [6, 0] : vitaz === 1 ? [0, 6] : [0, 0],
    }) as unknown as BitkaNaNastenke;

  it("víťaz: VYHRAL! v jeho farbe s menom a špakmi za lokalitu", () => {
    expect(peciatkaVysledku(b(0), 0, ["Jano", "Fero"])).toMatchObject({ druh: "vyhral", hrac: "ja", text: "VYHRAL!", pod: "ty · +6" });
    expect(peciatkaVysledku(b(1), 0, ["Jano", "Fero"])).toMatchObject({ druh: "vyhral", hrac: "su", pod: "Fero · +6" });
    const h = renderToStaticMarkup(createElement(PeciatkyKarty, { stavy: [peciatkaVysledku(b(1), 0, ["Jano", "Fero"])] }));
    expect(h).toContain("stav-peciatka-vyhral stav-peciatka-su");
  });

  it("remíza: REMÍZA neutrálne, bez farby hráča", () => {
    const s = peciatkaVysledku(b(null), 0, ["Jano", "Fero"], "Remíza pri Krčme");
    expect(s).toEqual({ druh: "remiza", text: "REMÍZA", titul: "Remíza pri Krčme" });
  });
});

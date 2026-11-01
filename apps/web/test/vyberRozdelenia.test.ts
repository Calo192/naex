// Rozdeľovanie hádky a Nakladačky (Michal 2026-11-01): smer je daný pravidlami (hádka k víťazovi
// §9.1, Nakladačka k súperovi držiteľa §9.4), preto pri staršom nie sú tlačidlá smerov (krígeľ,
// päsť). Ťuk na kartu staršieho výber pridá, ďalší ho vráti; tlačidlo nesie len znamienko,
// piktogram priazne a číslo (mock 9), cena je na stupnici a pravítku.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import cardsJson from "../../../packages/core/data/cards.json";
import eldersJson from "../../../packages/core/data/elders.json";
import scorecardsJson from "../../../packages/core/data/scorecards.json";
import { loadGameData, setupGame, type MarkerPos } from "@naex/core";
import { LiniaStarsich, ucinokVyberu, type RozdelenieStarsieho, type VyberRozdelenia } from "../src/hra/LiniaStarsich.tsx";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);
const elder = { ...setupGame(data, 5).starsi[0]!, marker: 3 as MarkerPos };

const pravitko = { body: 3, dieliky: [], cena: 0, polia: 0 };
const vyber = (z: Partial<VyberRozdelenia> = {}): VyberRozdelenia => ({ posun: { na: 2, cena: 1 }, aktivna: false, klik: () => {}, pravitko, smer: "ja", kraj: false, ...z });
const ceny = Array.from({ length: 7 }, () => null);

function linia(r: RozdelenieStarsieho): string {
  return renderToStaticMarkup(
    createElement(LiniaStarsich, {
      starsi: [{ elder, meno: "Farár", obrazok: null, body: undefined, patron: null, rozdelenie: r }],
      data,
      ja: 0,
      pohlad: 0,
      mena: ["Jano", "Fero"],
      krok: "prebytok",
      zmenene: new Set<string>(),
    }),
  );
}

/** Pás výberu pod stupnicou. */
const pas = (html: string): string => html.match(/<button type="button" class="ls-vyber[^"]*"[^>]*>.*?<\/button>/)?.[0] ?? "";

describe("výber staršieho pri rozdeľovaní — bez tlačidiel smeru", () => {
  it("žiadny krígeľ ani päsť; tlačidlo nesie len znamienko, piktogram priazne a číslo — bez textu a ceny", () => {
    // elder je v strede, posun na 2 = žltá hráča 0 (ja): priazeň po posune moja v sile 1.
    const html = linia({ vyber: vyber(), ceny, navrh: null, mrtvy: false });
    expect(html).not.toContain("ls-sip");
    expect(html).not.toContain("ikona-paste");
    expect(html).not.toContain("ikona-priazne");
    expect(html).toMatch(/class="ls-sc rozdel volitelny"/);
    const b = pas(html);
    expect(b).toContain('<span class="ls-vyber-znak">+</span>');
    expect(b).toContain('class="kr-ikona"');
    expect(b).toContain('<span class="ls-vyber-cislo">1</span>');
    expect(b.replace(/<[^>]+>/g, "")).toBe("+1");
    expect(b).toMatch(/aria-label="Farár: posunúť marker k tebe na [^"]+, stojí 1"/);
  });

  it("Nakladačka, ktorú držíš ty, ide k súperovi — tlačidlo v jeho farbe, smer sa nevyberá", () => {
    const html = linia({ vyber: vyber({ smer: "su", posun: { na: 4, cena: 1 } }), ceny, navrh: null, mrtvy: false });
    expect(pas(html)).toMatch(/class="ls-vyber su"/);
    expect(pas(html)).toMatch(/aria-label="Farár: posunúť marker k Fero na [^"]+, stojí 1"/);
  });

  it("hádka pridáva priazeň k tebe — marker stojí", () => {
    const html = linia({ vyber: vyber(), ceny, navrh: null, mrtvy: false, hadka: true });
    expect(pas(html).replace(/<[^>]+>/g, "")).toBe("+1");
    expect(pas(html)).toMatch(/aria-label="Farár: pridať bod hádky — priazeň k tebe na silu 1 [^"]*marker stojí"/);
  });

  it("vybraný starší: ↺ pred tým istým účinkom", () => {
    const html = linia({ vyber: vyber({ aktivna: true }), ceny, navrh: { na: 2, cena: 1 }, mrtvy: false });
    expect(pas(html).replace(/<[^>]+>/g, "")).toBe("↺+1");
    expect(pas(html)).toContain('aria-pressed="true"');
    expect(pas(html)).toContain("vrátiť výber");
  });

  it("kam sa už nedá: len tlmený piktogram, dôvod v popise (kraj, sila 3, nestačí)", () => {
    const kraj = linia({ vyber: vyber({ posun: null, kraj: true }), ceny, navrh: null, mrtvy: true });
    expect(pas(kraj)).toContain('aria-disabled="true"');
    expect(pas(kraj).replace(/<[^>]+>/g, "")).toBe("");
    expect(pas(kraj)).toContain("marker je na kraji");
    expect(kraj).not.toMatch(/class="ls-sc rozdel[^"]*volitelny/);
    expect(pas(linia({ vyber: vyber({ posun: null, kraj: true }), ceny, navrh: null, mrtvy: true, hadka: true }))).toContain("priazeň je už tvoja v sile 3");
    expect(pas(linia({ vyber: vyber({ posun: null }), ceny, navrh: null, mrtvy: true }))).toContain("nestačí");
  });

  it("cieľ na stupnici je orámovaný, ale nie je samostatné tlačidlo (ťuk berie celá karta)", () => {
    const html = linia({ vyber: vyber(), ceny, navrh: null, mrtvy: false });
    expect(html).toMatch(/<span class="lsr-pole[^"]* ciel"/);
    expect(html).not.toMatch(/<button[^>]*class="lsr-pole/);
  });
});

describe("ucinokVyberu — znamienko a číslo (mock 9)", () => {
  const e = (marker: MarkerPos) => ({ ...elder, marker });
  it("hádka: súperova priazeň len klesne → „−“ o koľko; preklopí sa → „+“ sila po posune", () => {
    expect(ucinokVyberu(e(6), undefined, 0, { posun: { na: 5, cena: 4 }, smer: "ja" }, null, true)).toEqual({ znak: "−", cislo: 1 });
    expect(ucinokVyberu(e(5), undefined, 0, { posun: { na: 3, cena: 5 }, smer: "ja" }, null, true)).toEqual({ znak: "−", cislo: 2 });
    expect(ucinokVyberu(e(4), undefined, 0, { posun: { na: 2, cena: 3 }, smer: "ja" }, null, true)).toEqual({ znak: "+", cislo: 1 });
    expect(ucinokVyberu(e(2), undefined, 0, { posun: { na: 0, cena: 5 }, smer: "ja" }, null, true)).toEqual({ znak: "+", cislo: 3 });
  });
  it("Nakladačka: marker ide k rozdeľujúcemu — „+“ jeho priazeň z markera po posune (hádka kola sa neráta)", () => {
    expect(ucinokVyberu(e(3), undefined, 1, { posun: { na: 5, cena: 3 }, smer: "ja" }, null, false)).toEqual({ znak: "+", cislo: 2 });
    expect(ucinokVyberu(e(1), undefined, 1, { posun: { na: 2, cena: 3 }, smer: "ja" }, null, false)).toEqual({ znak: "−", cislo: 1 });
    // Hádka dala súperovi o stupeň viac — po Nakladačke platí od ďalšieho kola len marker (moja žltá 1).
    const klebety = { [elder.elderId]: 1 };
    expect(ucinokVyberu(e(4), klebety, 0, { posun: { na: 2, cena: 3 }, smer: "ja" }, null, false)).toEqual({ znak: "+", cislo: 1 });
  });
});

// Pravítko posunu pri rozdeľovaní (mock 2 B, Michal 2026-10-30): dielik = pole, šírka = cena,
// farba = zóna, za čiarou rozpočtu zámok. Musí ukázať presne to, čo server urobí (posunZaBody).

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import cardsJson from "../../../packages/core/data/cards.json";
import eldersJson from "../../../packages/core/data/elders.json";
import scorecardsJson from "../../../packages/core/data/scorecards.json";
import { loadGameData, posunZaBody, setupGame, type MarkerPos, type PlayerId } from "@naex/core";
import { LiniaStarsich, type RozdelenieStarsieho, type SipkaRozdelenia } from "../src/hra/LiniaStarsich.tsx";
import { pravitkoPosunu } from "../src/hra/pravitko.ts";

describe("pravitkoPosunu", () => {
  it("ide pole po poli, kým body stačia — ako posunZaBody v jadre", () => {
    for (const telefon of [false, true])
      for (let m = 0; m <= 6; m++)
        for (const smer of [0, 1] as PlayerId[])
          for (let body = 0; body <= 15; body++) {
            const p = pravitkoPosunu(m as MarkerPos, smer, body, telefon);
            const jadro = posunZaBody({ marker: m as MarkerPos }, smer, body, telefon);
            expect([p.cena, p.polia]).toEqual(jadro === null ? [0, 0] : [jadro.cena, jadro.kroky]);
            expect(p.dieliky.filter((d) => d.zamok).length).toBeLessThanOrEqual(1);
            expect(p.dieliky.at(-1)?.zamok ?? false).toBe(p.dieliky.some((d) => d.zamok));
          }
  });

  it("Farár zo žltej súpera k tebe za 5: stred 2, žltá 1, oranžová 2, červená so zámkom", () => {
    const p = pravitkoPosunu(4, 0, 5);
    expect(p.dieliky).toEqual([
      { na: 3, zona: 0, cena: 2, zamok: false },
      { na: 2, zona: 1, cena: 1, zamok: false },
      { na: 1, zona: 2, cena: 2, zamok: false },
      { na: 0, zona: 3, cena: 3, zamok: true },
    ]);
    expect([p.cena, p.polia]).toEqual([5, 3]);
  });

  it("na kraji stupnice sa končí bez zámku, aj keď body ostanú", () => {
    const p = pravitkoPosunu(1, 0, 5);
    expect(p.dieliky).toEqual([{ na: 0, zona: 3, cena: 3, zamok: false }]);
    expect(pravitkoPosunu(0, 0, 5).dieliky).toEqual([]);
  });

  it("s Telefónom stojí pole k stredu toľko ako von", () => {
    expect(pravitkoPosunu(5, 0, 3)).toMatchObject({ cena: 3, polia: 1, dieliky: [{ cena: 3 }, { cena: 2, zamok: true }] });
    expect(pravitkoPosunu(5, 0, 3, true)).toMatchObject({ cena: 3, polia: 2, dieliky: [{ cena: 2 }, { cena: 1 }, { cena: 1, zamok: true }] });
  });
});

describe("pravítko pod stupnicou", () => {
  const data = loadGameData(cardsJson, eldersJson, scorecardsJson);
  const elder = { ...setupGame(data, 5).starsi[0]!, marker: 4 as MarkerPos };
  const ceny = Array.from({ length: 7 }, () => null);
  const smer = (smerK: PlayerId, body: number): SipkaRozdelenia => {
    const p = pravitkoPosunu(4, smerK, body);
    return { posun: p.polia === 0 ? null : { na: (4 + (smerK === 0 ? -p.polia : p.polia)) as MarkerPos, cena: p.cena }, aktivna: false, klik: () => {}, pravitko: p };
  };
  const linia = (r: RozdelenieStarsieho, krok: string): string =>
    renderToStaticMarkup(
      createElement(LiniaStarsich, {
        starsi: [{ elder, meno: "Farár", obrazok: null, body: undefined, patron: null, rozdelenie: r }],
        data,
        ikony: [],
        ja: 0,
        pohlad: 0,
        mena: ["Jano", "Fero"],
        krok,
        zmenene: new Set<string>(),
      }),
    );

  it("Nakladačka: jedno pravítko cez celú šírku s rozpočtom, poliami a zámkom za čiarou", () => {
    const html = linia({ sipky: { ja: smer(0, 5) }, ceny, navrh: null, mrtvy: false }, "prebytok");
    expect(html).toContain('class="lsp-rad jeden"');
    expect(html.match(/class="lsp ja"/g)).toHaveLength(1);
    expect(html.match(/class="lsp-dielik z\d"/g)).toHaveLength(3);
    expect(html).toMatch(/class="lsp-dielik z3 za"[^>]*><svg class="lsp-zamok"/);
    // Rozpočet 5 z dielikov 2 + 1 + 2 + 3 (zámok) = 8.
    expect(html).toContain('class="lsp-ciara" style="left:62.50%"');
    expect(html).toContain("</svg>5 z 5</span>");
    expect(html).toContain("3 polia");
    expect(html).toContain('aria-label="Farár: o 3 polia za 5 z 5, ďalšie pole stojí 3"');
  });

  it("Pohoršenie: dve pravítka nad krígľom a päsťou, bez šípok", () => {
    const html = linia({ sipky: { ja: smer(0, 2), su: smer(1, 2) }, ceny, navrh: null, mrtvy: false }, "pohorsenie");
    expect(html).toMatch(/class="lsp-rad"><span class="lsp ja"[^]*<span class="lsp su"/);
    expect(html).not.toContain("lsp-body");
    expect(html).toContain('aria-label="Farár: o 1 pole za 2 z 2, ďalšie pole stojí 1"');
    expect(html).toContain('aria-label="Farár: o 1 pole za 2 z 2, ďalšie pole stojí 3"');
    expect(html).not.toMatch(/[◀▶]/);
  });

  it("keď body nestačia ani na jedno pole, pravítko ukáže hneď zámok", () => {
    const html = linia({ sipky: { ja: smer(0, 1) }, ceny, navrh: null, mrtvy: true }, "prebytok");
    expect(html).toContain('aria-label="Farár: 1 nestačí ani na jedno pole (stojí 2)"');
    expect(html).toContain("nestačí");
    expect(html).toContain('class="lsp-ciara" style="left:50.00%"');
  });
});

describe("pravítko po rozdaní", () => {
  const data = loadGameData(cardsJson, eldersJson, scorecardsJson);
  const elder = setupGame(data, 5).starsi[0]!;
  it("bez zvyšku neukáže zámok ani „0 z 0“, len „rozdané“", () => {
    const p = pravitkoPosunu(elder.marker, 0, 0);
    const html = renderToStaticMarkup(
      createElement(LiniaStarsich, {
        starsi: [{ elder, meno: "Farár", obrazok: null, body: undefined, patron: null, rozdelenie: { sipky: { ja: { posun: null, aktivna: false, klik: () => {}, pravitko: p } }, ceny: Array.from({ length: 7 }, () => null), navrh: null, mrtvy: true } }],
        data,
        ikony: [],
        ja: 0,
        pohlad: 0,
        mena: ["Jano", "Fero"],
        krok: "prebytok",
        zmenene: new Set<string>(),
      }),
    );
    expect(html).toContain('aria-label="Farár: zvyšok je rozdaný"');
    expect(html).toContain(">rozdané<");
    expect(html).not.toContain("lsp-zamok");
    expect(html).not.toContain("lsp-ciara");
    expect(html).not.toContain("0 z 0");
  });
});

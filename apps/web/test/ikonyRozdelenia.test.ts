// Rozdeľovanie Pohoršenia a Nakladačky (Michal 2026-10-30): smer posunu nesie ikona, nie
// šípka — krígeľ k tebe (udobriť), päsť k súperovi (vydesiť). Päsť je vlastné SVG ako krígeľ.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import cardsJson from "../../../packages/core/data/cards.json";
import eldersJson from "../../../packages/core/data/elders.json";
import scorecardsJson from "../../../packages/core/data/scorecards.json";
import { loadGameData, setupGame } from "@naex/core";
import { IkonaPaste } from "../src/hra/IkonaPaste.tsx";
import { LiniaStarsich, type RozdelenieStarsieho, type SipkaRozdelenia } from "../src/hra/LiniaStarsich.tsx";
import { CESTY_PASTE } from "../src/hra/tvarPaste.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);
const elder = setupGame(data, 5).starsi[0]!;

const pravitko = { body: 1, dieliky: [], cena: 0, polia: 0 };
const smer = (na: 2 | 4, aktivna = false): SipkaRozdelenia => ({ posun: { na, cena: 1 }, aktivna, klik: () => {}, pravitko });

function linia(r: RozdelenieStarsieho): string {
  return renderToStaticMarkup(
    createElement(LiniaStarsich, {
      starsi: [{ elder, meno: "Farár", obrazok: null, body: undefined, patron: null, rozdelenie: r }],
      data,
      ja: 0,
      pohlad: 0,
      mena: ["Jano", "Fero"],
      krok: "pohorsenie",
      zmenene: new Set<string>(),
    }),
  );
}

/** Tlačidlá smerov v poradí, ako sú pod stupnicou. */
const tlacidla = (html: string): string[] => html.match(/<button type="button" class="ls-sip [^"]*"[^>]*>.*?<\/button>/g) ?? [];

describe("ikony smerov pri rozdeľovaní", () => {
  const ceny = Array.from({ length: 7 }, () => null);

  it("k tebe je krígeľ (udobriť), k súperovi päsť (vydesiť) — bez šípok", () => {
    const html = linia({ sipky: { ja: smer(2), su: smer(4) }, ceny, navrh: null, mrtvy: false });
    const [kTebe, kSuperovi] = tlacidla(html);
    expect(kTebe).toContain('class="ikona-priazne"');
    expect(kTebe).not.toContain("ikona-paste");
    expect(kTebe).toMatch(/aria-label="Farár: udobriť — marker k tebe na [^"]+, stojí 1"/);
    expect(kSuperovi).toContain('class="ikona-paste"');
    expect(kSuperovi).not.toContain("ikona-priazne");
    expect(kSuperovi).toMatch(/aria-label="Farár: vydesiť — marker k Fero na [^"]+, stojí 1"/);
    expect(html).not.toMatch(/[◀▶]/);
  });

  it("nepotvrdený posun ide zrušiť a ikona ostane", () => {
    const html = linia({ sipky: { ja: smer(2), su: smer(4, true) }, ceny, navrh: { na: 4, cena: 1 }, mrtvy: false });
    const [, kSuperovi] = tlacidla(html);
    expect(kSuperovi).toContain('aria-label="Farár: zrušiť vydesenie"');
    expect(kSuperovi).toContain('class="ikona-paste"');
    expect(kSuperovi).toContain("↶");
  });

  it("Nakladačka má len krígeľ k tebe", () => {
    const html = linia({ sipky: { ja: smer(2) }, ceny, navrh: null, mrtvy: false });
    expect(tlacidla(html)).toHaveLength(1);
    expect(html).not.toContain("ikona-paste");
  });

  it("smer, ktorým sa nedá, povie čo sa nedá", () => {
    const html = linia({ sipky: { ja: { posun: null, aktivna: false, klik: () => {}, pravitko } }, ceny, navrh: null, mrtvy: true });
    expect(html).toContain('aria-label="Farár: udobriť sa teraz nedá"');
  });
});

describe("ikona päste", () => {
  it("je vlastné SVG bez pevnej farby — farbu dá rodič", () => {
    const html = renderToStaticMarkup(createElement(IkonaPaste));
    expect(html).toMatch(/^<svg class="ikona-paste" viewBox="0 0 100 100" aria-hidden="true">/);
    expect(html.match(/<path /g)).toHaveLength(CESTY_PASTE.length);
    expect(html).not.toMatch(/fill="#|style=/);
  });

  it("s titulom je obrázok s menom pre čítačku", () => {
    const html = renderToStaticMarkup(createElement(IkonaPaste, { titul: "vydesiť" }));
    expect(html).toContain('role="img"');
    expect(html).toContain("<title>vydesiť</title>");
  });

  it("tvar sa zmestí do mriežky 0..100", () => {
    for (const d of CESTY_PASTE) {
      for (const n of d.match(/-?\d+(\.\d+)?/g) ?? []) expect(Math.abs(Number(n))).toBeLessThanOrEqual(100);
    }
  });
});

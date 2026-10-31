// Ikony strachu starších (Michal 2026-10-27, sada 5 „Výkričníky“): stupeň nesie počet
// výkričníkov, farbu hráč, ktorého sa starší bojí; krígeľ priazne je na konci zvýhodneného. Tlačové
// ikony bodovania v seede sú z tých istých tvarov ako ikona na stole.

import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import cardsJson from "../../../packages/core/data/cards.json";
import eldersJson from "../../../packages/core/data/elders.json";
import scorecardsJson from "../../../packages/core/data/scorecards.json";
import type { BitkaNaNastenke, ElderState, MarkerPos } from "@naex/core";
import { loadGameData, setupGame } from "@naex/core";
import { Podtacok } from "../src/achievementy/Podtacok.tsx";
import { piktogramPodtacka } from "../src/achievementy/piktogram.ts";
import { IkonaStrachu, ZnackaStrachu } from "../src/hra/IkonaStrachu.tsx";
import { LiniaStarsich } from "../src/hra/LiniaStarsich.tsx";
import { RozpisStarsich } from "../src/hra/Spaky.tsx";
import { cestyStrachu, stupenStrachu, svgIkonyBodovania } from "../src/hra/tvaryStrachu.ts";

/** Výkričník = klin (M…Z) + bodka (M…a…a…Z): počet bodiek je počet výkričníkov. */
const bodiek = (d: string): number => (d.match(/a[\d.]+ [\d.]+ 0 1 0 [\d.]+ 0a/g) ?? []).length;

describe("tvary výkričníkov", () => {
  it("stupeň je počet výkričníkov: ! Znepokojenie, !! Strach, !!! Vydesenie", () => {
    for (const s of [1, 2, 3] as const) {
      const vykricniky = cestyStrachu(s).filter((c) => !c.podklad);
      expect(vykricniky.reduce((n, c) => n + bodiek(c.d), 0)).toBe(s);
    }
  });

  it("! a !! stoja na priesvitnom odtlačku pečiatky, !!! sú z plnej pečiatky vyrezané", () => {
    expect(cestyStrachu(1).map((c) => c.podklad)).toEqual([true, false]);
    expect(cestyStrachu(2).map((c) => c.podklad)).toEqual([true, false]);
    expect(cestyStrachu(3)).toHaveLength(1);
    expect(cestyStrachu(3)[0]!.evenOdd).toBe(true);
  });

  it("úroveň zóny na stupeň: Neutralita nič, viac ako 3 je stále Vydesenie", () => {
    expect([0, 1, 2, 3, 4].map(stupenStrachu)).toEqual([null, 1, 2, 3, 3]);
    expect(renderToStaticMarkup(createElement(ZnackaStrachu, { uroven: 0 }))).toBe("");
  });

  it("na webe je ikona bez textu „!“ a farbu berie z currentColor (rodič alebo moje/superove)", () => {
    const html = renderToStaticMarkup(createElement(IkonaStrachu, { stupen: 2, trieda: "superove" }));
    expect(html).toContain('class="ikona-strachu s2 superove"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toMatch(/>[^<]*!/);
  });

  it("ikony bodovania v seede sú vygenerované z tých istých tvarov (biele na čiernom)", () => {
    const subory = { 1: "znepokojenie", 2: "strach", 3: "vydesenie" } as const;
    for (const s of [1, 2, 3] as const) {
      const subor = readFileSync(new URL(`../../../packages/server/seed/bodovanie/ikony/${subory[s]}.svg`, import.meta.url), "utf8");
      expect(subor.replace(/\r\n/g, "\n")).toBe(svgIkonyBodovania(s));
    }
  });
});

describe("achievement so zónovou podmienkou", () => {
  it("podtácok kreslí výkričníky z hry, nie nahratú ikonu (pazúry)", () => {
    const p = piktogramPodtacka("podmienka:vydesenie", [{ id: "ikona_vydesenie", nazov: "Vydesenie", media: "m1", podmienka: "vydesenie" }]);
    expect(p).toEqual({ ikona: "podmienka:vydesenie", obrazok: null });
    const html = renderToStaticMarkup(createElement(Podtacok, { rank: "bronz", ...p, nazov: "Strašiak", ziskany: true, velkost: 32 }));
    expect(html).toContain('fill-rule="evenodd"');
    expect(html).not.toContain("<image");
  });
});

describe("výkričníky vo farbe obávaného", () => {
  const data = loadGameData(cardsJson, eldersJson, scorecardsJson);
  const s0 = setupGame(data, 5);
  const elder = (marker: MarkerPos): ElderState => ({ ...(s0.starsi[0] as ElderState), marker });
  // Od 2026-10-28 (Michal: „mouseover je redundantný“) stupnicu, priazeň a strach ukazuje len
  // karta staršieho v línii (od 2026-10-30 bez lupy pri prejdení myšou).
  const karta = (marker: MarkerPos): string =>
    renderToStaticMarkup(
      createElement(LiniaStarsich, {
        starsi: [{ elder: elder(marker), meno: "Farár", obrazok: null, body: undefined, patron: null }],
        data,
        ikony: [],
        ja: 0,
        pohlad: 0,
        mena: ["Jano", "Fero"],
        krok: null,
        zmenene: new Set<string>(),
      }),
    );

  // Od 2026-10-30 (Michal: drobné „◀ ty … Fero ▶“ pod stupnicou nič nehovorili) je pod staršinom
  // meno, komu akú priazeň dáva (vo farbe toho hráča) a koho sa bojí, s výkričníkmi v jeho farbe.
  it("marker na súperovej červenej: krígeľ Ferovi vo Ferovej farbe, !!! v mojej farbe", () => {
    // Pozícia 6 = krajná na strane hráča 1: priazeň má Fero, bojí sa hráča 0 (ja).
    const html = karta(6);
    expect(html).toContain('class="ls-meno">Farár<');
    expect(html).toMatch(/ls-cip priazen superova[^>]*><svg class="ikona-priazne"[^>]*>.*?<\/svg> Fero: /);
    expect(html).not.toContain("ls-strany");
    expect(html).toMatch(/ls-cip strach moj[^>]*>.*ikona-strachu s3.*bojí sa teba · \+6 š čaká na udržanie/);
  });

  it("marker na mojej žltej: ! vo Ferovej farbe, krígeľ na mojom konci", () => {
    const html = karta(2);
    expect(html).toMatch(/ls-cip strach superov[^>]*>.*ikona-strachu s1.*bojí sa Fero · \+1 š čaká na udržanie/);
    expect(html).toMatch(/ls-cip priazen moja[^>]*><svg class="ikona-priazne"[^>]*>.*?<\/svg> ty: /);
  });

  it("v strede nikto: žiadne výkričníky ani krígeľ na stupnici", () => {
    const html = karta(3);
    expect(html).not.toContain("ikona-strachu");
    expect(html).toContain("nikoho sa nebojí");
  });

  it("rozpis za starších: výkričníky podľa špakov vo farbe toho, kto ich dostal; Noviny bez nich", () => {
    const b = {
      zaStarsichRozpis: [
        [
          { elderId: "e1", defId: "farar", spaky: 3 },
          { elderId: null, defId: "noviny", spaky: 1 },
        ],
        [{ elderId: "e2", defId: "krcmarka", spaky: 1 }],
      ],
    } as unknown as BitkaNaNastenke;
    const meno = (id: string): string => id;
    const moje = renderToStaticMarkup(createElement(RozpisStarsich, { b, p: 0, ja: 0, menoKarty: meno }));
    expect(moje).toMatch(/ikona-strachu s3 moje.*farar \+3/);
    expect(moje.match(/ikona-strachu/g)).toHaveLength(1);
    expect(moje).toContain("noviny +1");
    const superove = renderToStaticMarkup(createElement(RozpisStarsich, { b, p: 1, ja: 0, menoKarty: meno }));
    expect(superove).toMatch(/ikona-strachu s1 superove.*krcmarka \+1/);
  });
});

// Starší na stole v11 Strach a reči (Michal 2026-11-02, mocky 3 Teplomery a 5 Pult): rad starších
// s väzňami na ich mieste, rozdeľovanie Nakladačky a hádky klikom na stupeň (len úplné rozdelenie
// prejde serverom) a čo línia nakreslí.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import cardsJson from "../../../packages/core/data/cards.json";
import eldersJson from "../../../packages/core/data/elders.json";
import scorecardsJson from "../../../packages/core/data/scorecards.json";
import type { ClientState, GameState, PlayerId, StarsiVerejne, Stupen, Vazen } from "@naex/core";
import { apply, krokRozdelenia, loadGameData, naTahu, navrhRozdelenia, pultStarsich, setupGame, tahBota, viewFor } from "@naex/core";
import { klikNaStupen, radStarsich, stupneRozdelenia, suhrnRozdelenia } from "../src/hra/teplomery.ts";
import { LiniaStarsich, type MiestoVLinii } from "../src/hra/LiniaStarsich.tsx";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

/** Prvý okamih, keď hráč rozdeľuje v kroku `krok` (partia botov). */
function rozdelovanie(krok: "prebytok" | "reci"): { readonly s: GameState; readonly p: PlayerId } {
  for (let seed = 1; seed < 40; seed++) {
    let s = setupGame(data, seed, { lokalit: 3 });
    for (let n = 0; n < 6000 && s.koniec === null; n++) {
      const kto = naTahu(s);
      if (kto === null) break;
      if (krokRozdelenia(viewFor(data, s, kto), kto) === krok) return { s, p: kto };
      s = apply(data, s, tahBota(data, s, kto, seed * 31 + n), kto).state;
    }
  }
  throw new Error(`krok ${krok} sa nenašiel`);
}

describe("rad starších", () => {
  it("väzeň ostane na mieste svojho ukazovateľa", () => {
    const s0 = setupGame(data, 5);
    const [a, b, c] = s0.starsi as unknown as [StarsiVerejne, StarsiVerejne, StarsiVerejne];
    const v: Vazen = { elderId: "x", hrac: 1, poradie: 1, karta: a.karta, scorecard: a.scorecard, miesto: 1 };
    const rad = radStarsich([a, b, c], [v]);
    expect(rad.map((m) => (m.typ === "vazen" ? "V" : m.elder.elderId))).toEqual([a.elderId, "V", b.elderId, c.elderId]);
  });
});

describe("rozdeľovanie klikom na stupeň", () => {
  for (const krok of ["prebytok", "reci"] as const) {
    it(`${krok}: klik zdvihne, klik na najvyšší vráti, nikdy nad body; Návrh aj úplné kliky server prijme`, () => {
      const { s, p } = rozdelovanie(krok);
      const v = viewFor(data, s, p);
      const sumar0 = suhrnRozdelenia(v, p, [])!;
      expect(sumar0.krok).toBe(krok);
      expect(sumar0.prikaz).toBeNull();
      // Prvý starší, pri ktorom sa dá aspoň stupeň.
      const e = v.starsi.find((x) => stupneRozdelenia(v, p, [], x.elderId).some((st) => st.stav === "dosah"))!;
      const stupne = stupneRozdelenia(v, p, [], e.elderId);
      const prvy = stupne.find((st) => st.stav === "dosah")!;
      const z1 = klikNaStupen(v, p, [], e.elderId, prvy.stupen);
      expect(z1).toEqual([{ elderId: e.elderId, na: prvy.stupen }]);
      expect(stupneRozdelenia(v, p, z1, e.elderId).find((st) => st.stupen === prvy.stupen)?.stav).toBe("vybrany");
      // Klik na najvyšší vybraný ho vráti o stupeň (pod terajší = bez zdvihu).
      const spat = klikNaStupen(v, p, z1, e.elderId, prvy.stupen);
      expect(spat.find((z) => z.elderId === e.elderId)?.na ?? null).toBe(prvy.stupen - 1 > (stupne.filter((st) => st.stav === "pod").length) ? prvy.stupen - 1 : null);
      // Klik na červenú zdvihne tak vysoko, ako body stačia.
      const cervena = klikNaStupen(v, p, [], e.elderId, 3);
      const cena = suhrnRozdelenia(v, p, cervena)!;
      expect(cena.chyba).toBeNull();
      expect(cena.cena).toBeLessThanOrEqual(sumar0.body);
      // Klikmi po jednom stupni, kým sa niečo dá — výsledok je úplné rozdelenie.
      let zdvihy = [] as ReturnType<typeof klikNaStupen>;
      for (let i = 0; i < 40; i++) {
        const plan = suhrnRozdelenia(v, p, zdvihy)!;
        const id = plan.esteSaDa[0];
        if (id === undefined) break;
        const dalsi = stupneRozdelenia(v, p, zdvihy, id).find((st) => st.stav === "dosah")!;
        zdvihy = klikNaStupen(v, p, zdvihy, id, dalsi.stupen);
      }
      const plan = suhrnRozdelenia(v, p, zdvihy)!;
      expect(plan.prikaz).not.toBeNull();
      expect(() => apply(data, s, plan.prikaz!, p)).not.toThrow();
      const navrh = navrhRozdelenia(v)!;
      expect(() => apply(data, s, navrh.prikaz, p)).not.toThrow();
    }, 60_000);
  }
});

describe("línia starších", () => {
  const s0 = setupGame(data, 5);
  const v0 = viewFor(data, s0, 0);
  const st = (i: number, strach: readonly [Stupen, Stupen], reci: readonly [Stupen, Stupen]): StarsiVerejne => ({ ...v0.starsi[i]!, strach, reci });
  const starsi = [st(0, [1, 3], [2, 0]), st(1, [0, 0], [0, 0])];
  const vazen: Vazen = { elderId: "vaz", hrac: 1, poradie: 1, karta: v0.starsi[2]!.karta, scorecard: v0.starsi[2]!.scorecard, miesto: 2 };
  const view = { ...v0, starsi, vazni: [vazen] } as ClientState;
  const rad: MiestoVLinii[] = [
    ...starsi.map((e): MiestoVLinii => ({ typ: "starsi", s: { elder: e, meno: e.karta.defId, obrazok: null, patron: e === starsi[1] ? { kto: 1 } : null } })),
    { typ: "vazen", v: { elderId: "vaz", meno: "Hrobár", obrazok: null, hrac: 1 } },
  ];
  const linia = (rezim: "teplomery" | "pult"): string =>
    renderToStaticMarkup(
      createElement(LiniaStarsich, {
        rad,
        data,
        ja: 0,
        pohlad: 0,
        mena: ["Jano", "Bot Rapavý Fero"],
        krok: null,
        zmenene: new Set<string>(),
        vyhry: { cervene: [0, 2], cervenychNaVyhru: 4, vazni: [0, 1], vazniNaVyhru: 3 },
        pult: pultStarsich(view),
        rezim,
        onRezim: () => {},
      }),
    );

  it("Teplomery: tvoj teplomer vľavo, súperov vpravo; reči s počtom špakov; priazeň; väzeň a ohrozenie", () => {
    const html = linia("teplomery");
    expect(html).toContain('data-vyucba="starsi-stupnica"');
    expect(html).toContain(`data-vyucba="strach:${starsi[0]!.elderId}"`);
    // Môj strach žltá (1 stupeň), súperov červená (3), moje reči oranžová = 3 špaky.
    expect(html).toMatch(/tp-bar ja.*?tp-seg z1 on/);
    expect(html.match(/tp-seg z\d on/g)).toHaveLength(4);
    expect(html).toMatch(/tp-reci"><svg class="tp-bub"[^>]*><path[^>]*><\/path><text[^>]*>3<\/text>/);
    // Priazeň 2 pre mňa (Fero sa bojí viac).
    expect(html).toMatch(/class="kr ja"[^>]*>.*?\+2/);
    expect(html).toContain("v ohrození · skúša Fero");
    expect(html).toContain("v pivnici u Fero");
    expect(html).toContain("2/4");
    expect(html).toContain("⛓ 1/3");
  });

  it("Pult: riadok na staršieho, priazeň a súčty pri výhre a prehre", () => {
    const html = linia("pult");
    expect(html).toContain('class="tp-pult"');
    expect(html).toContain("ty výhra · prehra");
    // Ja: reči oranžová → výhra 3, prehra 3; súper: strach červená → výhra 5, prehra 0.
    expect(html).toMatch(/tp-bd ja"><b>3<\/b> · 3/);
    expect(html).toMatch(/tp-bd su"><b>5<\/b> · 0/);
    expect(html).toContain("⛓ v pivnici u Fero");
    expect(html).toContain("červené 2/4");
  });

  it("rozdeľovanie: stupne sú tlačidlá s cenou a kľúčom výučby", () => {
    const e = starsi[1]!;
    const html = renderToStaticMarkup(
      createElement(LiniaStarsich, {
        rad: [
          {
            typ: "starsi",
            s: {
              elder: e,
              meno: "X",
              obrazok: null,
              patron: null,
              rozdelenie: {
                marker: "strach",
                stupne: [
                  { stupen: 1, stav: "vybrany", cena: 1 },
                  { stupen: 2, stav: "dosah", cena: 3 },
                  { stupen: 3, stav: "mimo", cena: 6 },
                ],
                zdvih: { z: 0, na: 1, cena: 1 },
                klik: () => {},
              },
            },
          },
        ],
        data,
        ja: 0,
        pohlad: 0,
        mena: ["Jano", "Fero"],
        krok: "Nakladačka",
        zmenene: new Set<string>(),
        vyhry: view.vyhry,
        pult: pultStarsich(view),
        rezim: "teplomery",
        onRezim: () => {},
      }),
    );
    expect(html).toContain(`data-vyucba="stupen:${e.elderId}:2"`);
    expect(html).toMatch(/tp-cena">3</);
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain("−1");
  });
});

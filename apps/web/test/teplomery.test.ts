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
    ...starsi.map((e): MiestoVLinii => ({ typ: "starsi", s: { elder: e, meno: e.karta.defId, obrazok: null, presvedcil: e === starsi[1] ? { kto: 1 } : null } })),
    { typ: "vazen", v: { elderId: "vaz", defId: vazen.karta.defId, scorecard: vazen.scorecard, meno: "Hrobár", obrazok: null, hrac: 1 } },
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
        nastenka: [],
        pult: pultStarsich(view),
        rezim,
        onRezim: () => {},
      }),
    );

  it("Teplomery R3: tvoj pás vľavo, súperov vpravo; strach plný, reči šrafované nad ním; hladiny s menom; zátvorka priazne", () => {
    const html = linia("teplomery");
    expect(html).toContain('data-vyucba="starsi-stupnica"');
    expect(html).toContain(`data-vyucba="strach:${starsi[0]!.elderId}"`);
    // Môj strach 1 (plný), moje reči 2 (šrafovaný diel nad ním), súperov strach 3 (tri plné).
    const moj = /r3-pas ja"[^>]*>(.*?)<\/span><span class="r3-pas su/.exec(html)?.[1] ?? "";
    expect(moj.match(/r3-vypln plna/g)).toHaveLength(1);
    expect(moj.match(/r3-vypln reci/g)).toHaveLength(1);
    expect(html.match(/r3-vypln plna/g)).toHaveLength(4);
    // Hladiny s menom hráča (nie „ty“), zátvorka priazne +2 pre mňa (Fero sa bojí viac).
    expect(html).toMatch(/r3-hladina ja" style="--h:1[^"]*"><b class="r3-meno">Jano</);
    expect(html).toMatch(/r3-hladina su" style="--h:3[^"]*"><b class="r3-meno">Fero</);
    expect(html).toMatch(/r3-zatvorka ja" style="--a:1;--b:3"><b>\+2</);
    // Pri teplomeroch slová stupňov nie sú — sú pod menom staršieho, menom hráča.
    for (const cast of html.split('class="ls-stav').slice(0, -1)) expect(cast.slice(cast.lastIndexOf('class="r3"'))).not.toMatch(/znepokojen|vystrašen|vydesen/);
    expect(html).toMatch(/r3-riadok ja"><b class="kto">Jano<\/b>.*?vystrašen.*? — reči/);
    expect(html).not.toMatch(/class="(kto|r3-meno)">ty</);
    expect(html).toContain("✦ presvedčil Fero");
    expect(html).toContain("2/4");
    expect(html).toContain("⛓ 1/3");
  });

  it("väzeň: bez teplomerov a mreží, len pečiatka „V PIVNICI u …“ a krádež", () => {
    const html = linia("teplomery");
    const vaz = /tp-vazen su"[^]*$/.exec(html)?.[0] ?? "";
    expect(vaz).toContain("<b>V PIVNICI</b><span>u Fero</span>");
    expect(vaz).not.toContain("r3-pas");
    expect(vaz).not.toContain("mreze");
    expect(vaz).toContain("je z neho stále");
    // Krádež z nástenky: zajatý v poslednej bitke, v ktorej ešte bodoval.
    const s = renderToStaticMarkup(
      createElement(LiniaStarsich, {
        rad: [rad[2]!],
        data,
        ja: 0,
        pohlad: 0,
        mena: ["Jano", "Fero"],
        krok: null,
        zmenene: new Set<string>(),
        vyhry: view.vyhry,
        nastenka: [{ kolo: 2, bodovanie: [{ elderId: "vaz", defId: "x", stupen: [2, 0], reci: [false, false], spaky: [3, 0] }], kradez: [-3, 3] }],
        pult: pultStarsich(view),
        rezim: "teplomery",
        onRezim: () => {},
      }),
    );
    expect(s).toContain("<small>vzal ti 3 špaky</small>");
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
              presvedcil: null,
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
        nastenka: [],
        pult: pultStarsich(view),
        rezim: "teplomery",
        onRezim: () => {},
      }),
    );
    expect(html).toContain(`data-vyucba="stupen:${e.elderId}:2"`);
    expect(html).toMatch(/r3-cena">3</);
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain("−1");
  });
});

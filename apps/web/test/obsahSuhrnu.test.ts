// Súhrn kola pri starších pred výberom lokality (Michal 2026-10-31; v11 Strach a reči 2026-11-02):
// ktorí starší, teplomery pred → po, bodovanie po bitke, zajatie; tam a späť je ako nezmenený
// a kolo bez udalostí súhrn nemá.

import { describe, expect, it } from "vitest";
import cardsJson from "../../../packages/core/data/cards.json";
import eldersJson from "../../../packages/core/data/elders.json";
import scorecardsJson from "../../../packages/core/data/scorecards.json";
import type { BitkaNaNastenke, ClientState, ElderState, GameState, Stupen, Vazen } from "@naex/core";
import { apply, loadGameData, naTahu, setupGame, tahBota, viewFor } from "@naex/core";
import { dosledky, suhrnPosunov, zaciatokKola, type ZaciatokKola } from "../src/hra/obsahSuhrnu.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);
const s0 = setupGame(data, 5);
const [a, b, c] = s0.starsi as unknown as [ElderState, ElderState, ElderState];

type S = readonly [Stupen, Stupen];
const s = (e: ElderState, strach: S, reci: S = [0, 0]): ElderState => ({ ...e, strach, reci });

function bitka(kolo: number, extra: Partial<BitkaNaNastenke> = {}): BitkaNaNastenke {
  return {
    kolo,
    lokalita: null,
    vitaz: 0,
    rozhodlo: "tuhe",
    pitky: 1,
    zaBitku: [3, 0],
    zoSekery: 0,
    abstakZrazka: 0,
    prepadlo: 0,
    zaStarsich: [0, 0],
    zaStarsichRozpis: [[], []],
    exekutor: [0, 0],
    prebytok: [0, 0],
    spakyPo: [3, 0],
    ...extra,
  };
}

const pred = (starsi: readonly ElderState[], vazni: readonly string[] = []): ZaciatokKola => ({
  kolo: 2,
  starsi: starsi.map((e) => ({ elderId: e.elderId, karta: e.karta, strach: e.strach, reci: e.reci })),
  vazni,
});

type Po = Pick<ClientState, "starsi" | "vazni" | "nastenka">;
const po = (starsi: readonly ElderState[], extra: Partial<Po> = {}): Po => ({ starsi: starsi as Po["starsi"], vazni: [], nastenka: [bitka(2)], ...extra });

describe("súhrn kola pri starších (v11)", () => {
  it("starší so zmeneným strachom či rečami má teplomery pred → po, nezmenení chýbajú, poradie podľa dlaždice", () => {
    const x = suhrnPosunov(pred([a, b, c]), po([s(a, [0, 0], [0, 2]), b, s(c, [1, 0])]));
    expect(x.map((p) => p.elderId)).toEqual([a.elderId, c.elderId]);
    expect(x[0]).toMatchObject({ zmena: true, pred: { strach: [0, 0], reci: [0, 0] }, vazen: null });
    expect(x[1]?.elder?.strach).toEqual([1, 0]);
  });

  it("tam a späť je ako nezmenený", () => {
    expect(suhrnPosunov(pred([s(a, [1, 0], [2, 0])]), po([s(a, [1, 0], [2, 0])]))).toEqual([]);
  });

  it("nezmenený, ktorý po bitke bodoval, má bublinu s výplatou (za reči alebo strach)", () => {
    const rozpis: BitkaNaNastenke["zaStarsichRozpis"] = [[{ elderId: a.elderId, defId: a.karta.defId, spaky: 3, reci: true }], [{ elderId: b.elderId, defId: b.karta.defId, spaky: 1 }]];
    const x = suhrnPosunov(pred([s(a, [0, 0], [2, 0]), s(b, [0, 1])]), po([s(a, [0, 0], [2, 0]), s(b, [0, 1])], { nastenka: [bitka(2, { zaStarsichRozpis: rozpis })] }));
    expect(x.map((p) => [p.elderId, p.zmena, p.vyplata])).toEqual([
      [a.elderId, false, [{ hrac: 0, spaky: 3, reci: true }]],
      [b.elderId, false, [{ hrac: 1, spaky: 1, reci: false }]],
    ]);
  });

  it("výplata z inej bitky sa neráta", () => {
    const rozpis: BitkaNaNastenke["zaStarsichRozpis"] = [[{ elderId: a.elderId, defId: a.karta.defId, spaky: 5 }], []];
    expect(suhrnPosunov(pred([a]), po([a], { nastenka: [bitka(1, { zaStarsichRozpis: rozpis })] }))).toEqual([]);
  });

  it("úspešné zajatie je bublina „uväznený“ v poradí s ostatnými; starý väzeň sa znova neukáže", () => {
    const v: Vazen = { elderId: b.elderId, hrac: 1, poradie: 1, karta: b.karta, scorecard: b.scorecard, miesto: 1 };
    const x = suhrnPosunov(pred([a, b, c]), po([s(a, [0, 1]), c], { vazni: [v] }));
    expect(x.map((p) => [p.elderId, p.vazen])).toEqual([
      [a.elderId, null],
      [b.elderId, { hrac: 1, poradie: 1 }],
    ]);
    expect(suhrnPosunov(pred([a, c], [b.elderId]), po([a, c], { vazni: [v] }))).toEqual([]);
  });
});

describe("dôsledky v bubline", () => {
  it("priazeň u toho istého hráča nesie silu pred kolom; strach a reči pred → po; červená = zajatie možné", () => {
    const [p] = suhrnPosunov(pred([s(a, [0, 1])]), po([s(a, [0, 3])]));
    expect(dosledky(p!)).toEqual([
      { druh: "priazen", hrac: 0, sila: 3, bolo: 1 },
      { druh: "strach", hrac: 1, z: 1, na: 3 },
      { druh: "zajatieMozne", hrac: 1 },
    ]);
  });

  it("prechod priazne: stratená jednému, nová druhému; reči zanikli pod strachom", () => {
    const [p] = suhrnPosunov(pred([s(a, [0, 2], [2, 0])]), po([s(a, [3, 2])]));
    expect(dosledky(p!)).toEqual([
      { druh: "strataPriazne", hrac: 0, sila: 2 },
      { druh: "priazen", hrac: 1, sila: 1, bolo: null },
      { druh: "strach", hrac: 0, z: 0, na: 3 },
      { druh: "reci", hrac: 0, z: 2, na: 0 },
      { druh: "zajatieMozne", hrac: 0 },
    ]);
  });
});

describe("súhrn v partii botov", () => {
  it(
    "zmeny sedia so strachom a rečami na začiatku kôl",
    () => {
      let kol = 0;
      for (const seed of [3, 11]) {
        let st: GameState = setupGame(data, seed, { lokalit: 3 });
        let z = zaciatokKola(viewFor(data, st, 0));
        for (let n = 0; n < 8000 && st.koniec === null; n++) {
          const kto = naTahu(st);
          if (kto === null) break;
          st = apply(data, st, tahBota(data, st, kto, seed + n), kto).state;
          if (st.kolo === z.kolo + 1 && st.koniec === null) {
            const v = viewFor(data, st, 1);
            const suhrn = suhrnPosunov(z, v);
            const kluc = (e: Pick<ElderState, "strach" | "reci">): string => `${e.strach.join()}|${e.reci.join()}`;
            for (const x of suhrn) {
              const zac = z.starsi.find((e) => e.elderId === x.elderId);
              if (x.zmena && x.elder !== null) expect(kluc(x.pred)).toBe(kluc(zac!));
              if (!x.zmena) expect(x.vyplata.length).toBeGreaterThan(0);
            }
            // Každý starší, ktorému sa za kolo zmenil strach či reči, je v súhrne.
            const zmeneni = v.starsi.filter((e) => {
              const zac = z.starsi.find((x) => x.elderId === e.elderId);
              return zac !== undefined && kluc(zac) !== kluc(e);
            });
            expect(suhrn.filter((x) => x.zmena && x.elder !== null).map((x) => x.elderId)).toEqual(zmeneni.map((e) => e.elderId));
            z = zaciatokKola(v);
            kol++;
          }
        }
      }
      expect(kol).toBeGreaterThan(0);
    },
    120_000,
  );
});

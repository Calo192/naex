// Súhrn posunov starších pred výberom lokality (Michal 2026-10-31): ktorí starší, stupnica
// pred → po, výplata udržaného strachu, zajatie, Povery; tam a späť je ako nepohnutý
// a kolo bez udalostí súhrn nemá.

import { describe, expect, it } from "vitest";
import cardsJson from "../../../packages/core/data/cards.json";
import eldersJson from "../../../packages/core/data/elders.json";
import scorecardsJson from "../../../packages/core/data/scorecards.json";
import type { BitkaNaNastenke, ClientState, ElderState, GameState, MarkerPos, Vazen } from "@naex/core";
import { apply, loadGameData, naTahu, setupGame, tahBota, viewFor } from "@naex/core";
import { dosledky, suhrnPosunov, zaciatokKola, type ZaciatokKola } from "../src/hra/obsahSuhrnu.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);
const s0 = setupGame(data, 5);
const [a, b, c, d] = s0.starsi as unknown as [ElderState, ElderState, ElderState, ElderState];

const naPozicii = (e: ElderState, marker: MarkerPos, extra: Partial<ElderState> = {}): ElderState => ({ ...e, marker, ...extra });

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
  starsi: starsi.map((e) => ({ elderId: e.elderId, marker: e.marker, karta: e.karta })),
  vazni,
});

type Po = Pick<ClientState, "starsi" | "vazni" | "nastenka">;
const po = (starsi: readonly ElderState[], extra: Partial<Po> = {}): Po => ({ starsi, vazni: [], nastenka: [bitka(2)], ...extra });

describe("súhrn posunov kola", () => {
  it("prázdny, keď sa v kole nič nestalo", () => {
    expect(suhrnPosunov(pred([a, b]), po([a, b]))).toEqual([]);
  });

  it("pohnutý starší má stupnicu pred → po, nepohnutí chýbajú, poradie podľa dlaždice", () => {
    const z = pred([naPozicii(a, 3), naPozicii(b, 3), naPozicii(c, 4)]);
    const s = suhrnPosunov(z, po([naPozicii(a, 3), naPozicii(b, 5), naPozicii(c, 1)]));
    expect(s.map((x) => [x.elderId, x.posun])).toEqual([
      [b.elderId, { z: 3, na: 5 }],
      [c.elderId, { z: 4, na: 1 }],
    ]);
  });

  it("tam a späť je ako nepohnutý", () => {
    // Napr. Pohoršenie 3 → 5 a Nakladačka späť 5 → 3: na konci kola tam, kde začal.
    expect(suhrnPosunov(pred([naPozicii(a, 3)]), po([naPozicii(a, 3)]))).toEqual([]);
  });

  it("nepohnutý, ktorý vyplatil udržaný strach, má bublinu bez stupnice", () => {
    const zaznam = bitka(2, { zaStarsich: [2, 0], zaStarsichRozpis: [[{ elderId: a.elderId, defId: a.karta.defId, spaky: 2 }, { elderId: null, defId: "noviny", spaky: 1 }], []] });
    const s = suhrnPosunov(pred([naPozicii(a, 5), b]), po([naPozicii(a, 5), b], { nastenka: [bitka(1), zaznam] }));
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ elderId: a.elderId, posun: null, vyplata: [{ hrac: 0, spaky: 2, stupen: 2 }], povery: [], vazen: null });
    expect(dosledky(s[0]!)).toEqual([{ druh: "vyplata", hrac: 0, spaky: 2, stupen: 2 }]);
  });

  it("pohnutý, ktorý vyplatil, má stupnicu aj výplatu v stupni, ktorý držal", () => {
    const zaznam = bitka(2, { zaStarsichRozpis: [[{ elderId: a.elderId, defId: a.karta.defId, spaky: 3 }], []] });
    const [p] = suhrnPosunov(pred([naPozicii(a, 5)]), po([naPozicii(a, 6)], { nastenka: [zaznam] }));
    expect(p).toMatchObject({ posun: { z: 5, na: 6 }, vyplata: [{ hrac: 0, spaky: 3, stupen: 2 }] });
  });

  it("výplata z inej bitky sa neráta", () => {
    const stara = bitka(1, { zaStarsichRozpis: [[{ elderId: a.elderId, defId: a.karta.defId, spaky: 1 }], []] });
    expect(suhrnPosunov(pred([naPozicii(a, 5)]), po([naPozicii(a, 5)], { nastenka: [stara, bitka(2)] }))).toEqual([]);
  });

  it("Povera sa ukáže, aj keď sa marker nepohol — po hráčoch, bez znamienka", () => {
    const zaznam = bitka(2, { povery: [{ [a.elderId]: 1 }, { [a.elderId]: -2, [b.elderId]: -1 }] });
    const s = suhrnPosunov(pred([a, b, c]), po([a, b, c], { nastenka: [zaznam] }));
    expect(s.map((x) => [x.elderId, x.posun, x.povery])).toEqual([
      [a.elderId, null, [{ hrac: 0, stupne: 1 }, { hrac: 1, stupne: 2 }]],
      [b.elderId, null, [{ hrac: 1, stupne: 1 }]],
    ]);
  });

  it("úspešné zajatie je bublina „uväznený“ v poradí s ostatnými, aj s výplatou", () => {
    const vazen: Vazen = { elderId: b.elderId, hrac: 1, poradie: 1, karta: b.karta, scorecard: b.scorecard, miesto: 1 };
    const zaznam = bitka(2, { zaStarsichRozpis: [[], [{ elderId: b.elderId, defId: b.karta.defId, spaky: 3 }]] });
    const s = suhrnPosunov(pred([naPozicii(a, 3), naPozicii(b, 0), naPozicii(c, 3)]), po([naPozicii(a, 4), naPozicii(c, 2)], { vazni: [vazen], nastenka: [zaznam] }));
    expect(s.map((x) => x.elderId)).toEqual([a.elderId, b.elderId, c.elderId]);
    expect(s[1]).toMatchObject({ posun: null, elder: null, vazen: { hrac: 1, poradie: 1 }, vyplata: [{ hrac: 1, spaky: 3, stupen: 3 }] });
    expect(dosledky(s[1]!)).toEqual([
      { druh: "vazen", hrac: 1, poradie: 1 },
      { druh: "vyplata", hrac: 1, spaky: 3, stupen: 3 },
    ]);
  });

  it("starý väzeň sa znova neukáže; neúspešný pokus je bežný posun", () => {
    const vazen: Vazen = { elderId: d.elderId, hrac: 0, poradie: 1, karta: d.karta, scorecard: d.scorecard, miesto: 3 };
    const s = suhrnPosunov(pred([naPozicii(a, 6)], [d.elderId]), po([naPozicii(a, 5)], { vazni: [vazen] }));
    expect(s.map((x) => [x.elderId, x.posun, x.vazen])).toEqual([[a.elderId, { z: 6, na: 5 }, null]]);
  });
});

describe("dôsledky v bubline", () => {
  it("priazeň u toho istého hráča nesie silu pred posunom", () => {
    const [p] = suhrnPosunov(pred([naPozicii(a, 2)]), po([naPozicii(a, 0, { drzane: 3, vyplatene: 1 })]));
    expect(dosledky(p!)).toEqual([
      { druh: "priazen", hrac: 0, sila: 3, bolo: 1 },
      { druh: "strach", hrac: 1, stupen: 3 },
      // Držané 3, zaplatené 1 → koniec ďalšieho kola zaplatí oranžovú a červenú.
      { druh: "naUdrzanie", hrac: 1, spaky: 5 },
      { druh: "zajatieMozne", hrac: 1 },
    ]);
  });

  it("prechod cez stred: stratená priazeň jedného, nová druhého; stred bez priazne a strachu", () => {
    const [p] = suhrnPosunov(pred([naPozicii(a, 1)]), po([naPozicii(a, 4, { drzane: 1 })]));
    expect(dosledky(p!)).toEqual([
      { druh: "strataPriazne", hrac: 0, sila: 2 },
      { druh: "priazen", hrac: 1, sila: 1, bolo: null },
      { druh: "strach", hrac: 0, stupen: 1 },
      { druh: "naUdrzanie", hrac: 0, spaky: 1 },
    ]);
    const [q] = suhrnPosunov(pred([naPozicii(a, 5)]), po([naPozicii(a, 3)]));
    expect(dosledky(q!)).toEqual([{ druh: "strataPriazne", hrac: 1, sila: 2 }]);
  });
});

describe("súhrn v partii botov", () => {
  it(
    "posuny sedia s markermi na začiatku kôl, Povery bitky ostanú na nástenke",
    () => {
      let poveryVidno = false;
      for (const seed of [3, 11]) {
        let s: GameState = setupGame(data, seed, { lokalit: 3 });
        let z = zaciatokKola(viewFor(data, s, 0));
        for (let n = 0; n < 8000 && s.koniec === null; n++) {
          const kto = naTahu(s);
          if (kto === null) break;
          const predTahom = s;
          s = apply(data, s, tahBota(data, s, kto, seed + n), kto).state;
          const klebety = predTahom.bitkaStav?.klebetyHracov;
          if (s.bitkaStav === null && predTahom.bitkaStav !== null && klebety !== undefined && klebety.some((k) => Object.keys(k).length > 0)) {
            // Posledná Povera mohla prísť v tom istom ťahu — nástenka má aspoň to, čo bolo pred ním.
            const zaznam = s.nastenka.find((x) => x.kolo === predTahom.kolo);
            for (const p of [0, 1] as const) for (const [id, n] of Object.entries(klebety[p])) expect(Math.abs(zaznam?.povery?.[p][id] ?? 0)).toBeGreaterThanOrEqual(Math.abs(n));
            poveryVidno = true;
          }
          if (s.kolo === z.kolo + 1 && s.koniec === null) {
            const v = viewFor(data, s, 1);
            const suhrn = suhrnPosunov(z, v);
            for (const x of suhrn) {
              if (x.posun !== null) {
                expect(x.posun.z).toBe(z.starsi.find((e) => e.elderId === x.elderId)?.marker);
                expect(x.posun.na).toBe(v.starsi.find((e) => e.elderId === x.elderId)?.marker);
              } else expect(x.vazen !== null || x.vyplata.length > 0 || x.povery.length > 0).toBe(true);
            }
            // Každý starší, ktorého marker sa za kolo zmenil, je v súhrne.
            const zmeneni = v.starsi.filter((e) => z.starsi.find((x) => x.elderId === e.elderId)?.marker !== e.marker).map((e) => e.elderId);
            expect(suhrn.filter((x) => x.posun !== null).map((x) => x.elderId)).toEqual(zmeneni);
            z = zaciatokKola(v);
          }
        }
      }
      expect(poveryVidno).toBe(true);
    },
    120_000,
  );
});

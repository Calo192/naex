// Súhrn po bitke krok po kroku na doske (Michal 2026-11-02, návrh c): stav pred bitkou sa ráta
// spätne zo zmien markerov, kroky idú v poradí pravidiel (bodovanie → reči klesnú → Nakladačka →
// hádka → priazeň a ďalšie kolo), kroky bez zmeny sa preskočia a koniec je vždy posledný.

import { describe, expect, it } from "vitest";
import cardsJson from "../../../packages/core/data/cards.json";
import eldersJson from "../../../packages/core/data/elders.json";
import scorecardsJson from "../../../packages/core/data/scorecards.json";
import type { BitkaNaNastenke, ClientState, ElderState, GameState, Stupen, Vazen, ZmenaMarkera } from "@naex/core";
import { apply, loadGameData, naTahu, setupGame, tahBota, viewFor } from "@naex/core";
import { fazaKroku, opisKroku, riadkyKroku, stitkyKroku, suhrnBitky, zaciatokKola, type KontextSuhrnu, type ZaciatokKola } from "../src/hra/krokySuhrnu.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);
const s0 = setupGame(data, 5);
const [a, b, c] = s0.starsi as unknown as [ElderState, ElderState, ElderState];

type S = readonly [Stupen, Stupen];
const s = (e: ElderState, strach: S, reci: S = [0, 0]): ElderState => ({ ...e, strach, reci });
const z = (elder: ElderState, x: Omit<ZmenaMarkera, "elderId" | "kto">): ZmenaMarkera => ({ elderId: elder.elderId, kto: x.hrac, ...x });

function bitka(extra: Partial<BitkaNaNastenke> = {}): BitkaNaNastenke {
  return { kolo: 2, lokalita: null, vitaz: 1, rozhodlo: "tuhe", pitky: 1, zaBitku: [0, 3], zoSekery: 0, abstakZrazka: 0, prepadlo: 0, zaStarsich: [0, 0], exekutor: [0, 0], prebytok: [0, 0], spakyPo: [0, 3], ...extra };
}

const zaciatok = (starsi: readonly ElderState[], vazni: readonly string[] = []): ZaciatokKola => ({
  kolo: 2,
  starsi: starsi.map((e) => ({ elderId: e.elderId, karta: e.karta, scorecard: e.scorecard, strach: e.strach, reci: e.reci })),
  vazni,
});

type Po = Pick<ClientState, "starsi" | "vazni" | "zmenyMarkerov" | "nastenka">;
const po = (starsi: readonly ElderState[], zmeny: readonly ZmenaMarkera[], extra: Partial<Po> = {}): Po => ({ starsi: starsi as Po["starsi"], vazni: [], zmenyMarkerov: zmeny, nastenka: [bitka()], ...extra });

const K: KontextSuhrnu = { mena: ["Jano", "Fero"], menoStarsieho: (d) => d, rod: () => "m", nazovPriazne: () => "Bitkár" };

describe("súhrn po bitke: fázy teplomerov", () => {
  // a: Jano reči 2 bodujú a klesnú na 1, Fero Nakladačkou strach 0 → 2, Jano hádkou reči 1 → 3.
  // b: Kšeft vily z Pitky (pred bitkou) ostane v stave „pred“; reči 1 bodujú a zaniknú.
  // c: Fero ho zajal; Janove reči pred tým klesli.
  const zmeny: ZmenaMarkera[] = [
    z(b, { hrac: 0, marker: "reci", z: 0, na: 1, zdroj: "kseft" }),
    z(a, { hrac: 0, marker: "reci", z: 2, na: 1, zdroj: "bodovanie" }),
    z(b, { hrac: 0, marker: "reci", z: 1, na: 0, zdroj: "bodovanie" }),
    z(c, { hrac: 0, marker: "reci", z: 2, na: 1, zdroj: "bodovanie" }),
    z(a, { hrac: 1, marker: "strach", z: 0, na: 2, zdroj: "nakladacka" }),
    z(a, { hrac: 0, marker: "reci", z: 1, na: 3, zdroj: "hadka" }),
  ];
  const vazen: Vazen = { elderId: c.elderId, hrac: 1, poradie: 1, karta: c.karta, scorecard: c.scorecard, miesto: 2 };
  const bod = [
    { elderId: a.elderId, defId: a.karta.defId, stupen: [2, 0] as S, reci: [true, false] as const, spaky: [3, 0] as const },
    { elderId: b.elderId, defId: b.karta.defId, stupen: [1, 0] as S, reci: [true, false] as const, spaky: [1, 0] as const },
    { elderId: c.elderId, defId: c.karta.defId, stupen: [2, 3] as S, reci: [true, false] as const, spaky: [3, 5] as const },
  ];
  const x = suhrnBitky(
    zaciatok([s(a, [0, 0], [2, 0]), s(b, [0, 0]), s(c, [0, 3], [2, 0])]),
    po([s(a, [0, 2], [3, 0]), s(b, [0, 0])], zmeny, { vazni: [vazen], nastenka: [bitka({ bodovanie: bod, kradez: [-3, 3] })] }),
  )!;
  const [ea, eb, ec] = x.starsi;

  it("stav pred bitkou spätne zo zmien, potom fázy v poradí pravidiel", () => {
    expect(ea!.fazy.map((f) => [f.strach, f.reci])).toEqual([
      [[0, 0], [2, 0]],
      [[0, 0], [1, 0]],
      [[0, 2], [1, 0]],
      [[0, 2], [3, 0]],
      [[0, 2], [3, 0]],
    ]);
    // Kšeft vily je pred bitkou — reči 1 sú už v stave „pred“.
    expect(eb!.fazy[0].reci).toEqual([1, 0]);
    expect(eb!.pokles).toEqual([{ hrac: 0, z: 1, na: 0 }]);
    // Zajatý: stav pri zajatí zo začiatku kola a zmien, do pivnice u Fera.
    expect(ec!.fazy[0]).toEqual({ strach: [0, 3], reci: [2, 0] });
    expect(ec!.vazen).toBe(1);
    expect(ec!.priazen).toEqual({ od: { hrac: 0, sila: 3 }, na: { hrac: null, sila: 0 }, zmena: true });
  });

  it("Nakladačka a hádka s cenou; priazeň po bitke z rozdielu strachov", () => {
    expect(ea!.nakladacka).toEqual({ hrac: 1, z: 0, na: 2, cena: 3, zanikli: false });
    expect(ea!.hadka).toEqual({ hrac: 0, z: 1, na: 3, cena: 5 });
    expect(ea!.priazen).toEqual({ od: { hrac: null, sila: 0 }, na: { hrac: 0, sila: 2 }, zmena: true });
    expect(x.nakladacka).toEqual({ hrac: 1, cena: 3 });
    expect(x.hadka).toEqual({ hrac: 0, cena: 5 });
    expect(x.spolu).toEqual([7, 5]);
  });

  it("kroky v poradí pravidiel, koniec posledný; v kroku sa teplomer hýbe z predošlej fázy", () => {
    expect(x.kroky).toEqual(["bodovanie", "reci", "nakladacka", "hadka", "koniec"]);
    expect(fazaKroku("bodovanie")).toEqual({ stav: 0, od: null, duch: false });
    expect(fazaKroku("nakladacka")).toEqual({ stav: 2, od: 1, duch: false });
    expect(fazaKroku("koniec")).toEqual({ stav: 4, od: 0, duch: true });
  });

  it("štítky, riadky a vety menom hráča, stupne slovami", () => {
    expect(stitkyKroku(ea!, "bodovanie", 0, K)).toEqual([{ text: "+3 špaky", kratko: "+3", trieda: "chip-ja" }]);
    expect(stitkyKroku(ea!, "nakladacka", 0, K)).toEqual([{ text: "▲ strach vystrašený · za 3", kratko: "▲ strach vystrašený", trieda: "su" }]);
    expect(stitkyKroku(eb!, "reci", 0, K)[0]?.text).toBe("▼ reči zanikli");
    expect(stitkyKroku(ea!, "koniec", 0, K)[0]?.text).toBe("Bitkár → Jano +2");
    expect(riadkyKroku(ea!, "bodovanie", K)).toEqual(["Jano +3 (vystrašený — reči)"]);
    expect(riadkyKroku(ea!, "hadka", K)).toEqual(["▲ Jano reči → vydesený · za 5"]);
    expect(riadkyKroku(ec!, "koniec", K)).toEqual(["⛓ v pivnici u Fero"]);
    expect(opisKroku(x, "bodovanie", K)).toContain("Spolu Jano +7, Fero +5.");
    expect(opisKroku(x, "nakladacka", K)).toBe(`Fero dvíha Nakladačkou (3) svoj strach: ${a.karta.defId} (3). Plná časť rastie a hladina ide hore.`);
    expect(opisKroku(x, "koniec", K)).toContain(`${c.karta.defId} je v pivnici u Fero.`);
  });
});

describe("súhrn po bitke: prázdne kroky sa preskočia", () => {
  it("len bodovanie → bodovanie a koniec", () => {
    const bod = [{ elderId: a.elderId, defId: a.karta.defId, stupen: [0, 2] as S, reci: [false, false] as const, spaky: [0, 3] as const }];
    const x = suhrnBitky(zaciatok([s(a, [0, 2])]), po([s(a, [0, 2])], [], { nastenka: [bitka({ bodovanie: bod })] }));
    expect(x?.kroky).toEqual(["bodovanie", "koniec"]);
  });

  it("nič sa nestalo, alebo bitka nie je na nástenke → súhrn nie je", () => {
    expect(suhrnBitky(zaciatok([a]), po([a], []))).toBeNull();
    expect(suhrnBitky(zaciatok([a]), po([s(a, [1, 0])], [z(a, { hrac: 0, marker: "strach", z: 0, na: 1, zdroj: "nakladacka" })], { nastenka: [] }))).toBeNull();
  });
});

describe("súhrn po bitke v partii botov", () => {
  it(
    "stav pred bitkou a po nej sedí so skutočnou partiou",
    () => {
      let bitiek = 0;
      for (const seed of [3, 11]) {
        let st: GameState = setupGame(data, seed, { lokalit: 3 });
        let zac = zaciatokKola(viewFor(data, st, 0));
        let predBitkou: GameState | null = null;
        for (let n = 0; n < 8000 && st.koniec === null; n++) {
          const kto = naTahu(st);
          if (kto === null) break;
          const r = apply(data, st, tahBota(data, st, kto, seed + n), kto);
          if (r.events.some((e) => e.type === "bitkaVysledok")) predBitkou = st;
          st = r.state;
          if (st.faza === "volbaCiela" && st.kolo === zac.kolo + 1 && st.koniec === null) {
            const v = viewFor(data, st, 1);
            const x = suhrnBitky(zac, v);
            const kluc = (e: Pick<ElderState, "strach" | "reci">): string => `${e.strach.join()}|${e.reci.join()}`;
            for (const e of x?.starsi ?? []) {
              const pred = predBitkou?.starsi.find((y) => y.elderId === e.elderId);
              if (pred !== undefined) expect(kluc(e.fazy[0])).toBe(kluc(pred));
              const teraz = v.starsi.find((y) => y.elderId === e.elderId);
              if (teraz !== undefined) expect(kluc(e.fazy[4])).toBe(kluc(teraz));
            }
            if (x !== null) bitiek++;
            zac = zaciatokKola(v);
          } else if (st.faza === "volbaCiela" && st.kolo !== zac.kolo) zac = zaciatokKola(viewFor(data, st, 1));
        }
      }
      expect(bitiek).toBeGreaterThan(0);
    },
    120_000,
  );
});

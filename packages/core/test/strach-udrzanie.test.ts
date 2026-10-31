// Pravidlá v8.3 — strach až po udržaní (Michal 2026-10-30, revízia starších R2,
// variant 6A; docs/napady/starsi-revizia.html): stupeň, kam sa marker dostal, zaplatí
// obávanému hráčovi (žltá 1, oranžová 2, červená 3) až na konci nasledujúceho kola,
// ak sa na ňom marker udrží — nech bitku vyhral ktokoľvek. Odtlačený stupeň nič.
// Vo finále nové stupne nič, udržané z posledného kola sa vyplatia po finále;
// prebytok sa vo finále nerozdeľuje. Očakávané hodnoty sú z pravidla.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { BitkaStav, CardInstance, GameState, MarkerPos } from "../src/index.ts";
import { apply, eventsFor, legalCommands, loadGameData, naTahu, setupGame, spakyTeraz, viewFor, vyplatZaStarsich } from "../src/index.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

let uidSeq = 830000;
const inst = (defId: string): CardInstance => ({ uid: ++uidSeq, defId, leftLayout: 0, rightLayout: 0 });

function bitka(b: Partial<BitkaStav>): BitkaStav {
  return {
    krok: null,
    caka: null,
    sums: [{}, {}],
    exekutorHotovy: [true, true],
    exekutor: [0, 0],
    pohorsenieZostava: [0, 0],
    damage: null,
    vitaz: null,
    prebytokDrzi: null,
    prebytokZostava: 0,
    prebytokPosunute: [],
    spalit: [],
    vesticaHotova: true,
    ...b,
  };
}

/** [index staršieho, marker, držané od minulého kola, zaplatené] — ostatní v strede. */
type Marker = readonly [number, MarkerPos, number?, number?];

/**
 * Bitka o Krčmu (útočník 1) čaká na Pohoršenia; poškodenie sa potom vyhodnotí zo
 * súčtov `sums`. Bez Pohoršení sa vyhodnotí hneď pri prvom príkaze.
 */
function predPoskodenim(o: {
  sums: BitkaStav["sums"];
  pohorsenia?: readonly [number, number];
  markery?: readonly Marker[];
  finale?: boolean;
}): GameState {
  const s0 = setupGame(data, 5);
  const [p0, p1] = o.pohorsenia ?? [1, 0];
  const ciel: GameState["ciel"] = o.finale === true
    ? { typ: "finale", lokalita: inst("predsedova_vila") }
    : { typ: "lokalita", lokalita: s0.lokalityVHre.find((k) => k.defId === "krcma")! };
  return {
    ...s0,
    faza: "bitka",
    kolo: o.finale === true ? s0.lokalitCelkom + 1 : 2,
    utocnik: 1,
    strany: [[{ card: inst("pijan"), playedBy: 0 }], [{ card: inst("pijan"), playedBy: 1 }]],
    ciel,
    lokalityVHre: o.finale === true ? [] : s0.lokalityVHre.filter((k) => k.defId !== "krcma"),
    starsi: s0.starsi.map((e, i) => {
      const m = o.markery?.find(([j]) => j === i);
      if (m === undefined) return { ...e, marker: 3 as MarkerPos };
      return { ...e, marker: m[1], ...(m[2] === undefined ? {} : { drzane: m[2] }), ...(m[3] === undefined ? {} : { vyplatene: m[3] }) };
    }),
    bitkaStav: bitka({ krok: "pohorsenie", caka: p0 > 0 ? 0 : 1, pohorsenieZostava: [p0, p1], sums: o.sums }),
  };
}

const id = (s: GameState, i: number): string => s.starsi[i]!.elderId;

/**
 * Dohrá kolo do konca: prebytok ide na starších od konca (7, 6, …) — mimo tých, ktorých
 * test sleduje —, ostatné kroky prvým legálnym príkazom.
 */
function dohrajKolo(s: GameState): GameState {
  let t = s;
  for (let n = 0; n < 50 && t.koniec === null && t.bitkaStav !== null; n++) {
    const p = naTahu(t);
    if (p === null) break;
    const legal = legalCommands(data, t, p);
    const prebytok = [...t.starsi].reverse().map((e) => legal.find((c) => c.type === "prebytok" && c.elderId === e.elderId)).find((c) => c !== undefined);
    t = apply(data, t, prebytok ?? legal[0]!, p).state;
  }
  return t;
}

describe("v8.3: strach až po udržaní (§10)", () => {
  it("nový stupeň koniec kola nezaplatí — začne sa udržiavať; bitka strach nemení", () => {
    // Prvý starší na oranžovej pri hráčovi 1 (bojí sa hráča 0), bez udržania; Pohoršenie hráča 0
    // posunie druhého zo stredu na žltú.
    const s = predPoskodenim({ sums: [{ Rana: 5 }, {}], markery: [[1, 5]] });
    const po = apply(data, s, { type: "pohorsenie", elderId: id(s, 2) }, 0).state;
    expect(po.nastenka.at(-1)).toMatchObject({ vitaz: 0, zaStarsich: [0, 0] });
    const t = dohrajKolo(po);
    expect(t.bitkaStav).toBeNull();
    expect(t.nastenka.at(-1)!.zaStarsich).toEqual([0, 0]);
    expect(t.starsi[1]).toMatchObject({ marker: 5, drzane: 2 });
    expect(t.starsi[1]?.vyplatene).toBeUndefined();
    expect(t.starsi[2]).toMatchObject({ marker: 4, drzane: 1 });
  });

  it("udržaný stupeň zaplatí obávanému na konci kola, aj porazenému — každý stupeň raz", () => {
    // Prvý starší: oranžová pri hráčovi 1, držaná od minulého kola → bojí sa hráča 0 (1 + 2).
    // Druhý: červená pri hráčovi 0, držaná len žltá a tá je zaplatená → oranžová a červená
    // čakajú, hráč 1 od neho nedostane nič. Tretí: oranžová pri hráčovi 0, držaná → hráčovi 1 1 + 2.
    // Jediné Pohoršenie hráča 0 ide na posledného staršieho (nový stupeň, nič).
    const s = predPoskodenim({ sums: [{}, { Rana: 5 }], markery: [[1, 5, 2], [2, 0, 1, 1], [3, 1, 2]] });
    const t = dohrajKolo(apply(data, s, { type: "pohorsenie", elderId: id(s, 7) }, 0).state);
    const zaznam = t.nastenka.at(-1)!;
    // Bitku vyhral hráč 1 — porazený hráč 0 aj tak dostane svojho staršieho.
    expect(zaznam).toMatchObject({ vitaz: 1, zaStarsich: [1 + 2, 1 + 2] });
    expect(zaznam.zaStarsichRozpis).toEqual([
      [{ elderId: id(s, 1), defId: s.starsi[1]!.karta.defId, spaky: 3 }],
      [{ elderId: id(s, 3), defId: s.starsi[3]!.karta.defId, spaky: 3 }],
    ]);
    expect(t.spaky[0]).toBe(3);
    // Zaplatené sú udržané stupne; každý starší sa ďalej udržiava na stupni, kde stojí.
    expect(t.starsi[1]).toMatchObject({ vyplatene: 2, drzane: 2 });
    expect(t.starsi[2]).toMatchObject({ vyplatene: 1, drzane: 3 });
    expect(t.starsi[3]).toMatchObject({ vyplatene: 2, drzane: 2 });
  });

  it("odtlačený stupeň sa nezaplatí — Pohoršenie súpera vráti marker skôr, než koniec kola zaplatí", () => {
    // Červená pri hráčovi 1, držaná od minulého kola (bojí sa hráča 0); hráč 1 ju odtlačí
    // Pohoršením od seba (červená → oranžová stojí 4): zaplatí sa len oranžová (1 + 2).
    const s = predPoskodenim({ sums: [{ Rana: 5 }, {}], pohorsenia: [0, 4], markery: [[1, 6, 3]] });
    const po = apply(data, s, { type: "pohorsenie", elderId: id(s, 1) }, 1).state;
    expect(po.starsi[1]).toMatchObject({ marker: 5, drzane: 2 });
    const t = dohrajKolo(po);
    expect(t.nastenka.at(-1)!.zaStarsich).toEqual([1 + 2, 0]);
  });

  it("ústup a návrat v tom istom kole: vrátený stupeň je znova nový a čaká ďalšie kolo", () => {
    // Červená pri hráčovi 0 (bojí sa hráča 1), držaná; obranca hráč 0 ju odtlačí od seba (4)
    // a útočník hráč 1 ju vráti od seba (oranžová → červená 3).
    const s = predPoskodenim({ sums: [{ Rana: 5 }, {}], pohorsenia: [4, 3], markery: [[1, 0, 3]] });
    const a = apply(data, s, { type: "pohorsenie", elderId: id(s, 1) }, 0).state;
    expect(a.starsi[1]).toMatchObject({ marker: 1, drzane: 2 });
    const b = apply(data, a, { type: "pohorsenie", elderId: id(s, 1) }, 1).state;
    expect(b.starsi[1]).toMatchObject({ marker: 0, drzane: 2 });
    const t = dohrajKolo(b);
    // Zaplatí sa len udržaná oranžová (1 + 2); červená sa začína udržiavať odznova.
    expect(t.nastenka.at(-1)!.zaStarsich).toEqual([0, 1 + 2]);
    expect(t.starsi[1]).toMatchObject({ marker: 0, vyplatene: 2, drzane: 3 });
  });

  it("prechod cez stred zmaže držanie — druhá polovica platí druhému hráčovi až po udržaní", () => {
    // Žltá pri hráčovi 1 (bojí sa hráča 0), držaná; hráč 0 ju Pohoršeniami k sebe prevedie
    // cez stred na žltú pri sebe (žltá → stred 2, stred → žltá 1).
    const s = predPoskodenim({ sums: [{}, { Rana: 5 }], pohorsenia: [3, 0], markery: [[1, 4, 1]] });
    const po = apply(data, s, { type: "pohorsenie", elderId: id(s, 1), kSebe: true }, 0).state;
    expect(po.starsi[1]?.marker).toBe(2);
    expect(po.starsi[1]?.drzane).toBeUndefined();
    const t = dohrajKolo(po);
    expect(t.nastenka.at(-1)!.zaStarsich).toEqual([0, 0]);
    expect(t.starsi[1]).toMatchObject({ marker: 2, drzane: 1 });
  });

  it("výplatu vidia obaja rovnako — nástenka, log konca kola; rozpis nesie len verejné údaje", () => {
    const s = predPoskodenim({ sums: [{}, {}], markery: [[1, 5, 2], [3, 1, 2]] });
    const r1 = apply(data, s, { type: "pohorsenie", elderId: id(s, 7) }, 0);
    let t = r1.state;
    const events = [...r1.events];
    for (let n = 0; n < 50 && t.bitkaStav !== null && t.koniec === null; n++) {
      const p = naTahu(t);
      if (p === null) break;
      const r = apply(data, t, legalCommands(data, t, p)[0]!, p);
      t = r.state;
      events.push(...r.events);
    }
    const zaznam = t.nastenka.at(-1)!;
    // Sekera: na strachu to nič nemení — každý dostane svojich.
    expect(zaznam).toMatchObject({ vitaz: null, zaStarsich: [3, 3] });
    for (const p of [0, 1] as const) {
      expect(viewFor(data, t, p).nastenka.at(-1)?.zaStarsichRozpis).toEqual(zaznam.zaStarsichRozpis);
      const logy = eventsFor(events, p).flatMap((e) => (e.type === "log" && e.text.startsWith("Koniec kola — udržaný strach") ? [e.text] : []));
      expect(logy).toHaveLength(2);
    }
    const kluce = new Set(zaznam.zaStarsichRozpis!.flat().flatMap((x) => Object.keys(x)));
    expect([...kluce].sort()).toEqual(["defId", "elderId", "spaky"]);
  });

  it("náhľad: pri staršom vidno, čo zaplatí koniec kola a čo čaká na udržanie", () => {
    const s = predPoskodenim({ sums: [{ Rana: 5 }, {}], markery: [[1, 6, 1]] });
    for (const p of [0, 1] as const) {
      const t = spakyTeraz(viewFor(data, s, p));
      const e = t.starsi.find((x) => x.elderId === id(s, 1))!;
      expect(e.spaky).toEqual([1, 0]);
      expect(e.naUdrzanie).toEqual([2 + 3, 0]);
      expect(t.zaStarsich).toEqual([1, 0]);
      expect(t.naUdrzanie).toEqual([5, 0]);
    }
  });
});

describe("v8.3: finále (§14b)", () => {
  it("udržané z posledného kola sa vyplatia po finále aj porazenému; nové stupne finále nič; Nakladačka sa nerozdeľuje — v9.1 víťaz dostane za ňu špaky 1 : 1", () => {
    // Prvý starší na oranžovej pri hráčovi 1, držaný (bojí sa hráča 0). Hráč 0 Pohoršením
    // posunie druhého zo stredu na žltú — nový stupeň vo finále nič. Bitku vyhrá hráč 1 s prebytkom 5.
    const s = predPoskodenim({ finale: true, sums: [{}, { Rana: 5 }], markery: [[1, 5, 2]] });
    expect(vyplatZaStarsich(s)).toBe(1);
    const r = apply(data, s, { type: "pohorsenie", elderId: id(s, 2) }, 0);
    const t = dohrajKolo(r.state);
    expect(r.events.some((e) => e.type === "log" && e.text.startsWith("Nakladačka 5 vo finále: hráč 2 dostáva 5 špakov"))).toBe(true);
    expect(t.posunyMarkerov.filter((x) => x.zdroj === "prebytok")).toEqual([]);
    expect(t.nastenka.at(-1)).toMatchObject({ vitaz: 1, finale: true, zaStarsich: [1 + 2, 0], prebytok: [0, 5] });
    const bezNakladacky = t.nastenka.at(-1)!;
    expect(bezNakladacky.spakyPo[1] - s.spaky[1]).toBe(bezNakladacky.zaBitku[1] + 5 - bezNakladacky.exekutor[1]);
    expect(t.koniec).not.toBeNull();
  });
});

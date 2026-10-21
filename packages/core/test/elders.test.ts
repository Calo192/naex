// M5 — starší, ukazovatele, bodovanie.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { CardInstance, ElderState, MarkerPos, ScorecardDef, StavBodovania } from "../src/index.ts";
import {
  buildGameData,
  cenaPatronatu,
  elderScore,
  favourStarsieho,
  freshElder,
  loadGameData,
  podmienkyStarsieho,
  setupGame,
  obavanyHrac,
  patronatMozny,
  prekraciaHranicu,
  posunMarker,
  prebudenyPre,
  priazenHraca,
  priazenSila,
  vydesil,
} from "../src/index.ts";
import { instanceFor, makeDef, syntheticData } from "./helpers.ts";

const starsiLayoutLeft = ["Viera", null, "Povera", null] as const;
const starsiLayoutRight = [null, "Pecka", null, null] as const;
const data = syntheticData([
  makeDef("starsi", starsiLayoutLeft, starsiLayoutRight, { tags: ["Starešina", "Chlap"] }),
]);

function elderAt(marker: MarkerPos, zaciatok?: MarkerPos): ElderState {
  return {
    ...freshElder("starsi", instanceFor(data, "starsi", starsiLayoutLeft, starsiLayoutRight), "sc"),
    marker,
    markerZaciatokKola: zaciatok ?? marker,
  };
}

describe("M5 — priazeň a strach", () => {
  it("marker v strede → priazeň nemá nikto", () => {
    const elder = elderAt(4);
    expect(priazenHraca(elder)).toBeNull();
    expect(priazenSila(elder)).toBe(0);
    expect(obavanyHrac(elder)).toBeNull();
  });

  it("posun k hráčovi 1 → priazeň má hráč 1, ale starší sa bojí hráča 0", () => {
    const elder = elderAt(6);
    expect(priazenHraca(elder)).toBe(1);
    expect(priazenSila(elder)).toBe(1);
    expect(obavanyHrac(elder)).toBe(0);
  });

  it("sila priazne rastie so vzdialenosťou od stredu", () => {
    expect(priazenSila(elderAt(2))).toBe(1);
    expect(priazenSila(elderAt(1))).toBe(2);
    // Michal 2026-10-16: sila 1 / 2 / 3 podľa zóny.
    expect(priazenSila(elderAt(0))).toBe(3);
  });
});

describe("M5 — pohyb markera", () => {
  it("z pozície 6 sa v jednom kole nedá dôjsť ďalej než na 7", () => {
    const elder = elderAt(6); // začiatok kola na 6
    const po1 = posunMarker(elder, 1, false);
    expect(po1).toBe(7);
    // Druhý posun v tom istom kole: marker na 7, ale začiatok kola bol 6.
    const elderPo1: ElderState = { ...elder, marker: po1 as MarkerPos };
    expect(posunMarker(elderPo1, 1, false)).toBeNull();
  });

  it("z pozície 7 na začiatku kola sa dá na 8 → prebudenie pre tlačiaceho", () => {
    const elder = elderAt(7, 7);
    const target = posunMarker(elder, 1, false);
    expect(target).toBe(8);
    const prebudeny: ElderState = { ...elder, marker: target as MarkerPos };
    // Tlačil hráč 0 (smerom k hráčovi 1) → starší sa bojí hráča 0
    // a efekt sa uplatňuje preňho.
    expect(prebudenyPre(prebudeny)).toBe(0);
    expect(vydesil(prebudeny, 0)).toBe(true);
    // Priazeň pritom ostáva súperovi.
    expect(priazenHraca(prebudeny)).toBe(1);
  });

  it("z krajnej pozície sa marker bežným posunom nepohne", () => {
    expect(posunMarker(elderAt(8), 0, false)).toBeNull();
    expect(posunMarker(elderAt(0), 1, false)).toBeNull();
  });

  it("Pohoršenie nikdy nedostane marker na krajnú pozíciu", () => {
    expect(posunMarker(elderAt(7, 7), 1, true)).toBeNull();
    // Bežný posun mimo krajnej pozície Pohoršeniu prekážať nesmie.
    expect(posunMarker(elderAt(6, 6), 1, true)).toBe(7);
  });
});

describe("M5 — patronát a bodovanie", () => {
  it("patronát len patrónovi a od žltej zóny (Michal 2026-10-20)", () => {
    expect(patronatMozny(elderAt(4), 1)).toBe(false);
    expect(patronatMozny(elderAt(6), 1)).toBe(true); // žltá stačí, priazeň má hráč 1
    expect(patronatMozny(elderAt(6), 0)).toBe(false); // hráč 0 je obávaný, nie patrón
    expect(patronatMozny(elderAt(1), 0)).toBe(true);
    expect(patronatMozny(elderAt(8), 1)).toBe(true);
    expect(patronatMozny({ ...elderAt(7), nahradeny: true }, 1)).toBe(false);
  });

  it("cena patronátu: cigarety do červenej + Pohoršenia do stredu, spolu 4", () => {
    expect(cenaPatronatu(elderAt(6))).toEqual({ cigarety: 2, pohorsenia: 2 });
    expect(cenaPatronatu(elderAt(1))).toEqual({ cigarety: 1, pohorsenia: 3 });
    expect(cenaPatronatu(elderAt(8))).toEqual({ cigarety: 0, pohorsenia: 4 });
  });

  it("hranice zón: v sivej sa nič neprekračuje", () => {
    expect(prekraciaHranicu(5, 4)).toBe(false);
    expect(prekraciaHranicu(3, 2)).toBe(true);
    expect(prekraciaHranicu(2, 1)).toBe(true);
    expect(prekraciaHranicu(6, 5)).toBe(true);
  });

  it("podmienky za kus bodujú obom hráčom bez ohľadu na marker a stranu (Michal 2026-10-16)", () => {
    // Karta: vľavo Viera (0) a Povera (2), vpravo Pecka (1).
    const sc: ScorecardDef = {
      id: "sc",
      nazov: "Test",
      favour: "FAJCIAR",
      lava: ["cigarety", null, "lokality", null], // aktívne: 0, 2
      prava: [null, "dlh", null, null], // aktívna: 1
    };
    const d = buildGameData(data.cards, new Map(), { scorecards: [sc], body: BODY });
    const stav = { ...stavBodovania({ cigarety: [9, 4], dlhy: [0, 2] }), ovladnute: [{ hrac: 1 as const }] };
    // Cigarety sa rátajú po trojiciach. Hráč 0: 9 → 3 kusy. Hráč 1: 4 → 1 kus + 1 lokalita × 3 − 2 dlhy.
    for (const marker of [0, 2, 4, 6, 8] as const) {
      expect(elderScore(d, stav, elderAt(marker)).body).toEqual([3, 1 + 3 - 2]);
    }
    const p1 = elderScore(d, stav, elderAt(4)).polozky[1];
    expect(p1.map((x) => [x.podmienka, x.kusy, x.body])).toEqual([
      ["cigarety", 1, 1], // 4 cigarety = 1 kus (po trojiciach)
      ["lokality", 1, 3],
      ["dlh", 2, -2],
    ]);
  });

  it("zónové podmienky bodujú za strach všetkých starších, vrátane tohto — príklad s Farárom", () => {
    // Aktívne: Znepokojenie (lava 0) a Strach (lava 2); Vydesenie vpravo neaktívne.
    const sc: ScorecardDef = { id: "sc", nazov: "Test", favour: "VERIACI", lava: ["znepokojenie", null, "strach", null], prava: [null, null, "vydesenie", null] };
    const d = buildGameData(data.cards, new Map(), { scorecards: [sc], body: BODY });
    const farar = elderAt(4);
    const a = { ...elderAt(6), elderId: "a" }; // bojí sa hráča 0 na úrovni 1
    const b = { ...elderAt(7), elderId: "b" }; // bojí sa hráča 0 na úrovni 2
    const c = { ...elderAt(1), elderId: "c" }; // bojí sa hráča 1 na úrovni 2
    const stav = (f: ElderState): StavBodovania => ({ ...stavBodovania({ cigarety: [0, 0], dlhy: [0, 0] }), starsi: [f, a, b, c] });

    // Farár sám v neutrále: hráč 0 má 1 (a) + 2 (b), hráč 1 má 2 (c).
    expect(elderScore(d, stav(farar), farar).body).toEqual([3, 2]);
    // Farára hráč 0 vydesí (úroveň 3) — Vydesenie Farár nemá aktívne, ráta sa Strach: 1 + 2 + 2.
    const vydeseny = elderAt(8);
    const s = elderScore(d, stav(vydeseny), vydeseny);
    expect(s.body).toEqual([5, 2]);
    expect(s.polozky[0].map((x) => [x.podmienka, x.kusy, x.body])).toEqual([
      ["znepokojenie", 1, 1],
      ["strach", 2, 4],
    ]);
  });

  it("každá aktívna podmienka sa ráta zvlášť, aj keď je rovnaká", () => {
    const sc: ScorecardDef = { id: "sc", nazov: "Test", favour: "LAKOMEC", lava: ["cigarety", null, "cigarety", null], prava: [null, "strach", null, null] };
    const d = buildGameData(data.cards, new Map(), { scorecards: [sc], body: BODY });
    const e = elderAt(7); // bojí sa hráča 0 na úrovni 2
    const stav = { ...stavBodovania({ cigarety: [3, 6], dlhy: [0, 0] }), starsi: [e] };
    expect(elderScore(d, stav, e).body).toEqual([1 + 1 + 2, 2 + 2]);
  });

  it("podmienky staršieho: aktívna je tá, pri ktorej má karta akciu", () => {
    const sc: ScorecardDef = { id: "sc", nazov: "Test", favour: "LAKOMEC", lava: ["dlh", "dlh", null, "dlh"], prava: ["starsi", "starsi", null, null] };
    const d = buildGameData(data.cards, new Map(), { scorecards: [sc], body: BODY });
    const aktivne = podmienkyStarsieho(d, elderAt(4)).filter((p) => p.aktivna).map((p) => `${p.strana}${p.index}`);
    expect(aktivne).toEqual(["lava0", "prava1"]);
    expect(favourStarsieho(d, elderAt(4))).toBe("LAKOMEC");
  });
});

describe("scorecardy pri príprave hry", () => {
  const plne = loadGameData(cardsJson, eldersJson, scorecardsJson);

  it("každý starší dostane iný scorecard, rozdanie je deterministické zo seedu", () => {
    const a = setupGame(plne, 11);
    const ids = a.starsi.map((e) => e.scorecard);
    expect(new Set(ids).size).toBe(a.starsi.length);
    expect(setupGame(plne, 11).starsi.map((e) => e.scorecard)).toEqual(ids);
    // Rôzne seedy → (aspoň pri jednom z nich) iné rozdanie.
    const ine = [12, 13, 14].some((seed) => setupGame(plne, seed).starsi.some((e, i) => e.scorecard !== ids[i]));
    expect(ine).toBe(true);
  });

  it("priazeň staršieho určuje jeho scorecard", () => {
    const s = setupGame(plne, 5);
    for (const e of s.starsi) {
      expect(favourStarsieho(plne, e)).toBe(plne.scorecards.find((x) => x.id === e.scorecard)?.favour);
    }
  });
});

const BODY = { znepokojenie: 1, strach: 2, vydesenie: 3, lokality: 3, starsi: 3, cigarety: 1, cirhoza: -2, dlh: -1 };

function stavBodovania(o: { cigarety: [number, number]; dlhy: [number, number] }): StavBodovania {
  const hrac = (p: 0 | 1) => ({
    cigarety: o.cigarety[p],
    ruka: Array.from({ length: o.dlhy[p] }, (_, i): CardInstance => ({ uid: 900 + 10 * p + i, defId: "dlh", leftLayout: 0, rightLayout: 0 })),
    doberaci: [],
    odhadzovaci: [],
    priznane: [],
  });
  return { ovladnute: [], starsi: [], hraci: [hrac(0), hrac(1)] };
}

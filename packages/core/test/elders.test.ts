// M5 — starší, ukazovatele, bodovanie.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { CardInstance, ElderState, MarkerPos, ScorecardDef, StavBodovania } from "../src/index.ts";
import {
  BODOVANIE_V5,
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

  it("v5: súboje podmienok — kto vyhrá viac, dostane 1 + zóny strachu, v ktorých sa ho starší bojí", () => {
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
    // Cigarety 9 : 4 → hráč 0, lokality 0 : 1 → hráč 1, Dlhy 0 : 2 → hráč 0 (menej). Súboje 2 : 1.
    const body = (marker: MarkerPos): readonly [number, number] => elderScore(d, stav, elderAt(marker)).body;
    expect(body(4)).toEqual([1, 0]); // stred = 1 b
    expect(body(2)).toEqual([1, 0]); // priazeň hráča 0 = 1 b
    expect(body(6)).toEqual([2, 0]); // bojí sa hráča 0 v žltej
    expect(body(8)).toEqual([4, 0]); // vydesený hráčom 0
    const e = elderScore(d, stav, elderAt(4));
    expect(e.vyhry).toEqual([2, 1]);
    expect(e.polozky[1].map((x) => [x.podmienka, x.kusy, x.body])).toEqual([
      ["cigarety", 4, 0], // kus po kuse, nie po trojiciach
      ["lokality", 1, 1],
      ["dlh", 2, 0],
    ]);
  });

  it("v5: zónové podmienky rátajú len strach OSTATNÝCH starších; rovnosť súbojov = body obom", () => {
    // Aktívne: Znepokojenie (lava 0) a Strach (lava 2); Vydesenie vpravo neaktívne.
    const sc: ScorecardDef = { id: "sc", nazov: "Test", favour: "VERIACI", lava: ["znepokojenie", null, "strach", null], prava: [null, null, "vydesenie", null] };
    const d = buildGameData(data.cards, new Map(), { scorecards: [sc], body: BODY });
    const a = { ...elderAt(6), elderId: "a" }; // bojí sa hráča 0 na úrovni 1
    const b = { ...elderAt(7), elderId: "b" }; // bojí sa hráča 0 na úrovni 2
    const c = { ...elderAt(1), elderId: "c" }; // bojí sa hráča 1 na úrovni 2
    const stav = (starsi: ElderState[]): StavBodovania => ({ ...stavBodovania({ cigarety: [0, 0], dlhy: [0, 0] }), starsi });

    // Znepokojenie 2 (a, b) : 1 (c) → hráč 0; Strach 1 (b) : 1 (c) → nikto. Súboje 1 : 0.
    const farar = elderAt(4);
    expect(elderScore(d, stav([farar, a, b, c]), farar).body).toEqual([1, 0]);
    // Farára hráč 0 vydesí — jeho vlastný strach sa do súboja neráta, body áno: 1 + 3.
    const vydeseny = elderAt(8);
    const s = elderScore(d, stav([vydeseny, a, b, c]), vydeseny);
    expect(s.body).toEqual([4, 0]);
    expect(s.polozky[0].map((x) => [x.podmienka, x.kusy, x.body])).toEqual([
      ["znepokojenie", 2, 1],
      ["strach", 1, 0],
    ]);
    // Bez a: Znepokojenie 1 : 1, Strach 1 : 1 → rovnosť, body obom podľa vzťahu (stred = 1).
    expect(elderScore(d, stav([farar, b, c]), farar).body).toEqual([1, 1]);
  });

  it("v5: dve rovnaké aktívne podmienky sú dva súboje; kto väčšinu prehrá, nedostane nič (útecha vypnutá)", () => {
    const sc: ScorecardDef = { id: "sc", nazov: "Test", favour: "LAKOMEC", lava: ["cigarety", null, "cigarety", null], prava: [null, "strach", null, null] };
    const d = buildGameData(data.cards, new Map(), { scorecards: [sc], body: BODY });
    const e = elderAt(7); // bojí sa hráča 0 na úrovni 2, ostatní starší nie sú
    const stav = { ...stavBodovania({ cigarety: [3, 6], dlhy: [0, 0] }), starsi: [e] };
    const v = elderScore(d, stav, e);
    expect(BODOVANIE_V5.UTECHA).toBe(false);
    expect(v.vyhry).toEqual([0, 2]);
    // Hráč 1 vyhral oba súboje o cigarety; starší sa ho nebojí (strach má z hráča 0) → 1 b.
    expect(v.body).toEqual([0, 1]);
  });

  it("v5: Absťák (menej získaných za hru vyhrá) a Rezerva (plné poldeci, Vínko = plný)", () => {
    const sc: ScorecardDef = { id: "sc", nazov: "Test", favour: "FAJCIAR", lava: ["abstak", null, "rezerva", null], prava: [null, null, null, null] };
    const d = buildGameData(data.cards, new Map(), { scorecards: [sc], body: BODY });
    const zaklad = stavBodovania({ cigarety: [0, 0], dlhy: [0, 0] });
    const vinko: CardInstance = { uid: 977, defId: "vinko", leftLayout: 0, rightLayout: 0 };
    const stav = (sVinkom: boolean): StavBodovania => ({
      ...zaklad,
      hraci: [
        { ...zaklad.hraci[0]!, abstakyZiskane: 1, poldeciPlne: 0, dedicstvo: sVinkom ? [vinko] : [] },
        { ...zaklad.hraci[1]!, abstakyZiskane: 3, poldeciPlne: 1 },
      ],
    });
    // Absťák 1 : 3 → hráč 0; Rezerva 1 (Vínko) : 1 → nikto.
    expect(elderScore(d, stav(true), elderAt(4)).vyhry).toEqual([1, 0]);
    expect(elderScore(d, stav(true), elderAt(4)).body).toEqual([1, 0]);
    // Bez Vínka Rezervu vyhrá hráč 1 → 1 : 1, body obom.
    expect(elderScore(d, stav(false), elderAt(4)).body).toEqual([1, 1]);
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

const BODY = { znepokojenie: 1, strach: 2, vydesenie: 3, lokality: 3, starsi: 3, cigarety: 1, cirhoza: -2, dlh: -1, abstak: -1, rezerva: 1 };

function stavBodovania(o: { cigarety: [number, number]; dlhy: [number, number] }): StavBodovania {
  const hrac = (p: 0 | 1) => ({
    cigarety: o.cigarety[p],
    ruka: Array.from({ length: o.dlhy[p] }, (_, i): CardInstance => ({ uid: 900 + 10 * p + i, defId: "dlh", leftLayout: 0, rightLayout: 0 })),
    doberaci: [],
    odhadzovaci: [],
    priznane: [],
    poldeciPlne: 0,
    dedicstvo: [],
  });
  return { ovladnute: [], starsi: [], hraci: [hrac(0), hrac(1)] };
}

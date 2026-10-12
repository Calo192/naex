// M5 — starší, ukazovatele, bodovanie.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { CardInstance, ElderState, MarkerPos, ScorecardDef, StavBodovania } from "../src/index.ts";
import {
  bitkaOStarsiehoMozna,
  buildGameData,
  elderScore,
  favourStarsieho,
  freshElder,
  loadGameData,
  podmienkyStarsieho,
  setupGame,
  obavanyHrac,
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
    expect(priazenSila(elderAt(0))).toBe(2);
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

describe("M5 — bitka o staršieho a bodovanie", () => {
  it("bitka o staršieho len od oranžovej zóny", () => {
    expect(bitkaOStarsiehoMozna(elderAt(4))).toBe(false);
    expect(bitkaOStarsiehoMozna(elderAt(6))).toBe(false); // žltá nestačí
    expect(bitkaOStarsiehoMozna(elderAt(7))).toBe(true);
    expect(bitkaOStarsiehoMozna(elderAt(1))).toBe(true);
    expect(bitkaOStarsiehoMozna(elderAt(8))).toBe(true);
  });

  it("bodovanie: obávaný hráč boduje aktivované podmienky na svojej strane scorecardu", () => {
    // Karta: vľavo Viera (0) a Povera (2), vpravo Pecka (1).
    const sc: ScorecardDef = {
      id: "sc",
      nazov: "Test",
      favour: "VERIACI",
      lava: ["znepokojenie", "strach", "vydesenie", "cigarety"], // aktívne: 0, 2
      prava: ["strach", "dlh", null, "lokality"], // aktívna: 1
    };
    const d = buildGameData(data.cards, new Map(), { scorecards: [sc], body: BODY });
    const stav = stavBodovania({ cigarety: [9, 9], dlhy: [0, 2] });

    // Marker na 7 (oranžová, polovica hráča 1) → obávaný hráč 0, jeho strana je ľavá:
    // znepokojenie (1) áno, vydesenie len v červenej, cigarety neaktívne → 1 bod.
    expect(elderScore(d, stav, elderAt(7))).toMatchObject({ hrac: 0, body: 1 });
    // Marker na 8 (červená) → aj vydesenie (3) → 4 body.
    expect(elderScore(d, stav, elderAt(8))).toMatchObject({ hrac: 0, body: 4 });
    // Marker na 1 → obávaný hráč 1, jeho strana je pravá: dlh × 2 nepriznané = −2.
    // Strach vpravo neboduje — karta tam akciu nemá.
    expect(elderScore(d, stav, elderAt(1))).toMatchObject({ hrac: 1, body: -2 });
    // Marker v sivej → nikto neboduje.
    expect(elderScore(d, stav, elderAt(4))).toBeNull();
  });

  it("kladné podmienky za kus bodujú až od oranžovej zóny, tresty už od žltej", () => {
    const sc: ScorecardDef = {
      id: "sc",
      nazov: "Test",
      favour: "FAJCIAR",
      lava: ["cigarety", null, "znepokojenie", null], // aktívne: 0, 2
      prava: [null, "dlh", null, null], // aktívna: 1
    };
    const d = buildGameData(data.cards, new Map(), { scorecards: [sc], body: BODY });
    const stav = stavBodovania({ cigarety: [9, 9], dlhy: [0, 2] });

    // Žltá (6) → bojí sa hráča 0: cigarety ešte nie, len znepokojenie.
    expect(elderScore(d, stav, elderAt(6))).toMatchObject({ hrac: 0, body: 1 });
    // Oranžová (7) → 9 cigariet × 1 + znepokojenie.
    expect(elderScore(d, stav, elderAt(7))).toMatchObject({ hrac: 0, body: 10 });
    // Žltá (2) → bojí sa hráča 1: 2 nepriznané dlhy platia aj v žltej.
    expect(elderScore(d, stav, elderAt(2))).toMatchObject({ hrac: 1, body: -2 });
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
  });
  return { ovladnute: [], starsi: [], hraci: [hrac(0), hrac(1)] };
}

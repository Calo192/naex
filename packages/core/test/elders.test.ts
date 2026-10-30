// Starší, ukazovatele a špaky za strach (v6: stupnica 7 polí, Michal 2026-10-26).

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { ElderState, MarkerPos } from "../src/index.ts";
import {
  MARKER_STRED,
  STUPNICA_ZONY,
  favourStarsieho,
  freshElder,
  loadGameData,
  setupGame,
  obavanyHrac,
  pokusMozny,
  posunMarker,
  priazenHraca,
  priazenSila,
  poKonciKola,
  sPosunutymMarkerom,
  spakyZaStarsich,
  strachNaUdrzanie,
  strachNaVyplatu,
  strachZ,
  vydesil,
} from "../src/index.ts";
import { instanceFor, makeDef, syntheticData } from "./helpers.ts";

const starsiLayoutLeft = ["Viera", null, "Povera", null] as const;
const starsiLayoutRight = [null, "Pecka", null, null] as const;
const data = syntheticData([
  makeDef("starsi", starsiLayoutLeft, starsiLayoutRight, { tags: ["Starešina", "Chlap"] }),
]);

function elderAt(marker: MarkerPos): ElderState {
  return { ...freshElder("starsi", instanceFor(data, "starsi", starsiLayoutLeft, starsiLayoutRight), "sc"), marker };
}

describe("v6 — stupnica 7 polí", () => {
  it("3-2-1-0-1-2-3: jedno sivé pole v strede", () => {
    expect([...STUPNICA_ZONY]).toEqual([3, 2, 1, 0, 1, 2, 3]);
    expect(MARKER_STRED).toBe(3);
    expect(freshElder("starsi", elderAt(3).karta, "sc").marker).toBe(3);
  });

  it("marker v strede → priazeň nemá nikto a nikto sa nebojí", () => {
    const elder = elderAt(3);
    expect(priazenHraca(elder)).toBeNull();
    expect(priazenSila(elder)).toBe(0);
    expect(obavanyHrac(elder)).toBeNull();
  });

  it("posun k hráčovi 1 → priazeň má hráč 1, starší sa bojí hráča 0", () => {
    const elder = elderAt(4);
    expect(priazenHraca(elder)).toBe(1);
    expect(priazenSila(elder)).toBe(1);
    expect(obavanyHrac(elder)).toBe(0);
  });

  it("sila priazne 1 / 2 / 3 podľa zóny", () => {
    expect(priazenSila(elderAt(2))).toBe(1);
    expect(priazenSila(elderAt(1))).toBe(2);
    expect(priazenSila(elderAt(0))).toBe(3);
    expect(priazenSila(elderAt(6))).toBe(3);
  });
});

describe("v6 — špaky za starších", () => {
  it("starší dá obávanému hráčovi žltá 1, oranžová 2, červená 3; sivý nikomu", () => {
    expect(strachZ(elderAt(3), 0)).toBe(0);
    expect(strachZ(elderAt(3), 1)).toBe(0);
    expect(strachZ(elderAt(4), 0)).toBe(1);
    expect(strachZ(elderAt(5), 0)).toBe(2);
    expect(strachZ(elderAt(6), 0)).toBe(3);
    expect(strachZ(elderAt(6), 1)).toBe(0);
    expect(strachZ(elderAt(0), 1)).toBe(3);
  });

  it("v8.3: súčet za všetkých starších, aj nahradeného — len udržané a nezaplatené stupne (zo stredu na červenú 1 + 2 + 3)", () => {
    const drzi = (m: MarkerPos): ElderState => ({ ...elderAt(m), drzane: STUPNICA_ZONY[m] });
    const starsi = [drzi(6), drzi(4), { ...drzi(1), nahradeny: true }, elderAt(3)];
    expect(spakyZaStarsich(starsi, 0)).toBe(6 + 1);
    expect(spakyZaStarsich(starsi, 1)).toBe(1 + 2);
    // Zaplatené stupne sa už neplatia: červená zaplatená po oranžovú dá len 3.
    expect(spakyZaStarsich([{ ...drzi(6), vyplatene: 2 }], 0)).toBe(3);
    expect(spakyZaStarsich([{ ...drzi(6), vyplatene: 3 }], 0)).toBe(0);
    // Nový stupeň (nedržaný od minulého kola) koniec tohto kola nezaplatí — čaká na udržanie.
    expect(strachNaVyplatu(elderAt(6), 0)).toBe(0);
    expect(strachNaUdrzanie(elderAt(6), 0)).toBe(6);
    expect(strachNaVyplatu({ ...elderAt(6), drzane: 1 }, 0)).toBe(1);
    expect(strachNaUdrzanie({ ...elderAt(6), drzane: 1 }, 0)).toBe(2 + 3);
    expect(strachNaUdrzanie({ ...elderAt(6), drzane: 1, vyplatene: 2 }, 0)).toBe(3);
  });

  it("v8.3: ústup k stredu zmaže zaplatené aj držané stupne, z ktorých marker odišiel; prechod na druhú polovicu zmaže všetko", () => {
    const cervena = { ...elderAt(6), vyplatene: 3, drzane: 3 };
    expect(sPosunutymMarkerom(cervena, 5)).toMatchObject({ vyplatene: 2, drzane: 2 });
    // Späť na červenú: červená je znova nová — čaká na udržanie, koniec kola ju nezaplatí.
    const spat = sPosunutymMarkerom(sPosunutymMarkerom(cervena, 5), 6);
    expect(strachNaVyplatu(spat, 0)).toBe(0);
    expect(strachNaUdrzanie(spat, 0)).toBe(3);
    expect(sPosunutymMarkerom(cervena, 4)).toMatchObject({ vyplatene: 1, drzane: 1 });
    expect(sPosunutymMarkerom(cervena, 3).vyplatene).toBeUndefined();
    expect(sPosunutymMarkerom(cervena, 3).drzane).toBeUndefined();
    expect(sPosunutymMarkerom({ ...elderAt(4), vyplatene: 1, drzane: 1 }, 2).drzane).toBeUndefined();
    // Postup ďalej od stredu nič nezmaže ani nepridá.
    expect(sPosunutymMarkerom({ ...elderAt(5), vyplatene: 2, drzane: 2 }, 6)).toMatchObject({ vyplatene: 2, drzane: 2 });
  });

  it("v8.3: na konci kola sú udržané stupne zaplatené a stupeň markera sa začína udržiavať", () => {
    expect(poKonciKola(elderAt(5))).toMatchObject({ drzane: 2 });
    expect(poKonciKola(elderAt(5)).vyplatene).toBeUndefined();
    expect(poKonciKola({ ...elderAt(6), drzane: 2 })).toMatchObject({ vyplatene: 2, drzane: 3 });
    expect(poKonciKola({ ...elderAt(6), drzane: 3, vyplatene: 1 })).toMatchObject({ vyplatene: 3, drzane: 3 });
    expect(poKonciKola(elderAt(3)).drzane).toBeUndefined();
  });
});

describe("v6 — pohyb markera", () => {
  it("1 posun = 1 pole; zo stredu na červenú tri posuny v jednom kole (zamknutie sa ruší)", () => {
    let e = elderAt(3);
    for (const ciel of [4, 5, 6] as const) {
      const nova = posunMarker(e, 1);
      expect(nova).toBe(ciel);
      e = { ...e, marker: nova as MarkerPos };
    }
    expect(vydesil(e, 0)).toBe(true);
    // Priazeň pritom ostáva súperovi.
    expect(priazenHraca(e)).toBe(1);
  });

  it("z krajnej pozície ďalej von nie, späť k súperovi áno", () => {
    expect(posunMarker(elderAt(6), 1)).toBeNull();
    expect(posunMarker(elderAt(0), 0)).toBeNull();
    expect(posunMarker(elderAt(6), 0)).toBe(5);
    expect(posunMarker(elderAt(0), 1)).toBe(1);
  });
});

describe("v9 — pokus o zajatie (§10)", () => {
  it("zajať smie len hráč, ktorého sa starší bojí na stupni 3 (červená na súperovej polovici)", () => {
    expect(pokusMozny(elderAt(6), 0)).toBe(true);
    expect(pokusMozny(elderAt(0), 1)).toBe(true);
    expect(pokusMozny(elderAt(6), 1)).toBe(false); // hráč 1 má priazeň, nie strach
    expect(pokusMozny(elderAt(5), 0)).toBe(false); // oranžová nestačí
    expect(pokusMozny(elderAt(3), 0)).toBe(false);
  });
});

describe("scorecardy pri príprave hry", () => {
  const plne = loadGameData(cardsJson, eldersJson, scorecardsJson);

  it("každý starší dostane iný scorecard, rozdanie je deterministické zo seedu", () => {
    const a = setupGame(plne, 11);
    const ids = a.starsi.map((e) => e.scorecard);
    expect(new Set(ids).size).toBe(a.starsi.length);
    expect(setupGame(plne, 11).starsi.map((e) => e.scorecard)).toEqual(ids);
    const ine = [12, 13, 14].some((seed) => setupGame(plne, seed).starsi.some((e, i) => e.scorecard !== ids[i]));
    expect(ine).toBe(true);
  });

  it("priazeň staršieho určuje jeho scorecard; v6 bez bodovacích podmienok", () => {
    const s = setupGame(plne, 5);
    for (const e of s.starsi) {
      expect(favourStarsieho(plne, e)).toBe(plne.scorecards.find((x) => x.id === e.scorecard)?.favour);
    }
    for (const sc of plne.scorecards) {
      expect([...sc.lava, ...sc.prava].every((x) => x === null)).toBe(true);
    }
  });
});

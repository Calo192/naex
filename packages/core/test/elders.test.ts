// M5 — starší, ukazovatele, bodovanie.

import { describe, expect, it } from "vitest";
import type { ElderDef, ElderState, MarkerPos } from "../src/index.ts";
import {
  bitkaOStarsiehoMozna,
  elderScore,
  freshElder,
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
    ...freshElder("starsi", instanceFor(data, "starsi", starsiLayoutLeft, starsiLayoutRight)),
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

  it("bodovanie: neprázdne akcie aktivujú bočné pozície, prahovo podľa zóny", () => {
    const def: ElderDef = {
      id: "starsi",
      favour: "VERIACI",
      scoring: [
        { zone: 1, points: 2 }, // left[0] = Viera → aktívna
        { zone: 2, points: 3 }, // left[1] = prázdne → nikdy
        { zone: 3, points: 5 }, // left[2] = Povera → aktívna, len červená
        { zone: 1, points: 1 }, // left[3] = prázdne
        { zone: 1, points: 2 }, // right[0] = prázdne
        { zone: 2, points: 3 }, // right[1] = Pecka → aktívna od oranžovej
        { zone: 1, points: 1 }, // right[2] = prázdne
        { zone: 3, points: 4 }, // right[3] = prázdne
      ],
    };
    // Marker na 7 (oranžová, polovica hráča 1) → obávaný hráč 0;
    // splnené pozície so zónou ≤ 2: left[0] (2) + right[1] (3) = 5 bodov.
    expect(elderScore(data, def, elderAt(7))).toEqual({ hrac: 0, body: 5 });
    // Marker na 8 (červená) → aj zóna 3: + left[2] (5) = 10 bodov.
    expect(elderScore(data, def, elderAt(8))).toEqual({ hrac: 0, body: 10 });
    // Marker v sivej → nikto neboduje.
    expect(elderScore(data, def, elderAt(4))).toBeNull();
    // Marker na polovici hráča 0 → boduje hráč 1.
    expect(elderScore(data, def, elderAt(2))?.hrac).toBe(1);
  });
});

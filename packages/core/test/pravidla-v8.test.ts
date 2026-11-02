// Pravidlá v8 (Michal 2026-10-28, návrhy #28, #29, #32, #33, #34 z playtestu
// 20261027-161907): prebytok rozdeľuje porazený, Kmotor presúva Dlhy, Ihrisko
// s Dvojčatami za dve. Strach za novú zónu (#28 B) nahradilo v8.3 udržanie
// (strach-udrzanie.test.ts). Očakávané hodnoty sú z pravidla.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { BitkaStav, CardInstance, GameState, PlacedCard, PlayerId } from "../src/index.ts";
import { apply, bitkaMody, legalCommands, loadGameData, setupGame } from "../src/index.ts";
import { zPolohy } from "./helpers.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

let uidSeq = 880000;
const inst = (defId: string): CardInstance => ({ uid: ++uidSeq, defId, leftLayout: 0, rightLayout: 0 });

function bitka(b: Partial<BitkaStav>): BitkaStav {
  return {
    krok: null,
    caka: null,
    sums: [{}, {}],
    exekutorHotovy: [true, true],
    exekutor: [0, 0],
   
    damage: null,
    vitaz: null,
    prebytokDrzi: null,
    prebytokZostava: 0,
    prebytokZdvihy: [], prebytokPrepadlo: 0,
    spalit: [],
    vesticaHotova: true,
    ...b,
  };
}

/**
 * Bitka o Krčmu čaká, kým hráč 0 rozdelí hádku (v10) (útočník 1); poškodenie sa potom vyhodnotí
 * zo súčtov `sums`. Markery podľa `markery` (ostatní v strede), v línii po Pijanovi.
 */
function predPoskodenim(o: {
  sums: BitkaStav["sums"];
  pohorsenia?: number;
  markery?: readonly (readonly [number, number, number?])[];
  uprav?: (s: GameState) => GameState;
}): GameState {
  const s0 = setupGame(data, 5);
  const s: GameState = {
    ...s0,
    faza: "bitka",
    kolo: 2,
    utocnik: 1,
    strany: [[{ card: inst("pijan"), playedBy: 0 }], [{ card: inst("pijan"), playedBy: 1 }]],
    ciel: { typ: "lokalita", lokalita: s0.lokalityVHre.find((k) => k.defId === "krcma")! },
    lokalityVHre: s0.lokalityVHre.filter((k) => k.defId !== "krcma"),
    starsi: s0.starsi.map((e, i) => {
      const m = o.markery?.find(([j]) => j === i);
      if (m === undefined) return { ...e, ...zPolohy(3 as number) };
      return { ...e, ...zPolohy(m[1]) };
    }),
    bitkaStav: bitka({ krok: "hadka", caka: 0, hadka: { makke: [o.pohorsenia ?? 1, 0], vitaz: 0, velkost: o.pohorsenia ?? 1, zostava: o.pohorsenia ?? 1, prepadlo: 0, zdvihy: [] }, sums: o.sums }),
  };
  return o.uprav === undefined ? s : o.uprav(s);
}

const elder = (s: GameState, i: number): string => s.starsi[i]!.elderId;

// Nakladačku od v11 rozdeľuje víťaz na svoj strach — strach-reci.test.ts.

describe("v8: Kmotor presúva Dlhy súperovi (návrh #34 B)", () => {
  /** Bitka po Cintoríne — „nič“ ju dokončí a vyrieši krok 6c. */
  function poBitke(silaKmotra: 1 | 2 | 3, dlhy: number): GameState {
    const s0 = setupGame(data, 5);
    const kmotor = s0.starsi.findIndex((e) => data.scorecards.find((x) => x.id === e.scorecard)?.favour === "UZERNIK");
    const s: GameState = {
      ...s0,
      faza: "bitka",
      kolo: 2,
      ciel: { typ: "lokalita", lokalita: s0.lokalityVHre[0]! },
      lokalityVHre: s0.lokalityVHre.slice(1),
      // Priazeň Kmotra má hráč 0 (marker na jeho polovici).
      starsi: s0.starsi.map((e, i) => ({ ...e, ...zPolohy((i === kmotor ? 3 - silaKmotra : 3) as number) })),
      hraci: [{ ...s0.hraci[0], dlhy: dlhy }, s0.hraci[1]],
      bitkaStav: bitka({ krok: "cintorin", caka: 0, vitaz: 0 }),
    };
    return apply(data, s, { type: "cintorin", uid: null }, 0).state;
  }
  const dlhy = (s: GameState, p: PlayerId): number => s.hraci[p].dlhy;

  it("v9: sila 2 → tri tvoje priznané Dlhy prejdú medzi súperove priznané (2 / 3 / 4)", () => {
    const s = poBitke(2, 4);
    expect([dlhy(s, 0), dlhy(s, 1)]).toEqual([1, 3]);
  });

  it("menej Dlhov, ako je sila: presunie, koľko máš; bez Dlhu nič", () => {
    expect([dlhy(poBitke(3, 1), 0), dlhy(poBitke(3, 1), 1)]).toEqual([0, 1]);
    expect([dlhy(poBitke(1, 0), 0), dlhy(poBitke(1, 0), 1)]).toEqual([0, 0]);
  });
});

describe("v8: Ihrisko — Dvojčatá sa rátajú za dve (návrh #32)", () => {
  it("Dvojčatá proti dvom súperovým Občanom kraj nevyhrajú za jedného — je to rovnosť, nikto bonus", () => {
    const s0 = setupGame(data, 5);
    const ihrisko = { typ: "lokalita", lokalita: inst("ihrisko") } as const;
    const na = (defId: string, p: PlayerId): PlacedCard => ({ card: inst(defId), playedBy: p });
    // Kraj hráča 0: Dvojčatá (2) proti jednému súperovmu Pijanovi (1) → +2 hráčovi 0.
    const vyhra: GameState = { ...s0, ciel: ihrisko, strany: [[na("dvojcata", 0), na("pijan", 1)], []] };
    expect(bitkaMody(data, vyhra, 0).tuheBonus).toBe(2);
    // Dvojčatá (2) proti dvom Pijanom (2) → rovnosť, nikto.
    const rovnost: GameState = { ...s0, ciel: ihrisko, strany: [[na("dvojcata", 0), na("pijan", 1), na("pijan", 1)], []] };
    expect(bitkaMody(data, rovnost, 0).tuheBonus).toBe(0);
    expect(bitkaMody(data, rovnost, 1).tuheBonus).toBe(0);
  });
});

// Pohoršenie v8.2 (Michal 2026-10-30): pole stojí podľa zóny, bez limitu, aj na
// červenú. Testy boli do v9 v patronat-20261020.test.ts (patronát zanikol).

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { BitkaStav, GameState, MarkerPos } from "../src/index.ts";
import { apply, legalCommands, loadGameData, setupGame } from "../src/index.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

function bitka(c: Partial<BitkaStav>): BitkaStav {
  return {
    krok: null,
    caka: null,
    sums: [{}, {}],
    exekutorHotovy: [true, true],
    pohorsenieZostava: [0, 0],
    exekutor: [0, 0],
    damage: null,
    vitaz: null,
    prebytokDrzi: null,
    prebytokZostava: 0,
    prebytokPosunute: [],
    spalit: [],
    vesticaHotova: true,
    ...c,
  };
}

describe("Pohoršenie v8.2: cena podľa zóny, bez limitu, aj na červenú (Michal 2026-10-30)", () => {
  function vPohorseni(lokalita: string, marker: MarkerPos, body = 6): GameState {
    const s0 = setupGame(data, 32);
    const lok = { uid: 69999, defId: lokalita, leftLayout: 0, rightLayout: 0 };
    return {
      ...s0,
      faza: "bitka",
      ciel: { typ: "lokalita", lokalita: lok },
      starsi: s0.starsi.map((e, i) => (i === 0 ? { ...e, marker} : e)),
      bitkaStav: bitka({ krok: "pohorsenie", caka: 1, pohorsenieZostava: [0, body] }),
    };
  }
  /** Hráč 1 vyberie prvého staršieho k súperovi (k indexu 0) — počet polí nevyberá. */
  const posun = (s: GameState, kSebe = false): GameState => apply(data, s, { type: "pohorsenie", elderId: s.starsi[0]!.elderId, ...(kSebe ? { kSebe } : {}) }, 1).state;

  it("zo stredu na červenú 6 Pohoršení jedným výberom: žltá 1 + oranžová 2 + červená 3", () => {
    const st = posun(vPohorseni("krcma", 3));
    expect(st.starsi[0]!.marker).toBe(0);
    expect(st.bitkaStav?.pohorsenieZostava[1] ?? 0).toBe(0);
  });

  it("marker ide, kým zvyšok stačí: 5 Pohoršení zo stredu = oranžová, 2 ostanú (na červenú treba 3)", () => {
    const st = posun(vPohorseni("krcma", 3, 5));
    expect(st.starsi[0]!.marker).toBe(1);
    expect(st.bitkaStav?.pohorsenieZostava[1]).toBe(2);
    // Na tohto staršieho k súperovi už nestačia — smú len inam.
    expect(legalCommands(data, st, 1).some((c) => c.type === "pohorsenie" && c.elderId === st.starsi[0]!.elderId && c.kSebe !== true)).toBe(false);
  });

  it("k stredu je pole o 1 drahšie: z pravej oranžovej na ľavú červenú 3 + 2 + 1 + 2 + 3 = 11", () => {
    expect(posun(vPohorseni("krcma", 5, 11)).starsi[0]!.marker).toBe(0);
    // 6 Pohoršení: oranžová → žltá 3, žltá → stred 2, stred → žltá 1.
    expect(posun(vPohorseni("krcma", 5, 6)).starsi[0]!.marker).toBe(2);
  });

  it("k sebe platí to isté: z ľavej červenej k stredu 4, potom 3", () => {
    const st = posun(vPohorseni("krcma", 0, 7), true);
    expect(st.starsi[0]!.marker).toBe(2);
    expect(st.bitkaStav?.pohorsenieZostava[1] ?? 0).toBe(0);
    expect(() => posun(vPohorseni("krcma", 0, 3), true)).toThrow();
  });
});


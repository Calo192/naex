// Ohlásené vydesenie sa ruší hneď (Michal 2026-10-26, „Áno, zrušiť hneď“):
// keď počet vydesených starších hráča klesne pod polovicu — patronátom,
// Pohoršením, prebytkom, čímkoľvek, čo posunie marker —, ohlásenie padá
// v tej chvíli. Kto ich v tom istom kole znova doplní, ohlasuje odznova
// a musí ich udržať do konca nasledujúceho kola (PRAVIDLA §1).

import { describe, expect, it } from "vitest";
// Sada v6 (pred revíziou v7): test stráži pravidlá, ktoré revízia sady nemení.
import cardsJson from "./data/cards-v6.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { BitkaStav, CardInstance, Command, GameState, PlayerId, PlayerState } from "../src/index.ts";
import { apply, legalCommands, loadGameData, naTahu, prahVydesenia, rngInt, rngSeed, setupGame, viewFor, vydesil } from "../src/index.ts";
import { setupSBalickom } from "./helpers.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

let uidSeq = 970000;
const inst = (defId: string): CardInstance => ({ uid: ++uidSeq, defId, leftLayout: 0, rightLayout: 0 });

function sHracom(s: GameState, p: PlayerId, h: Partial<PlayerState>): GameState {
  const hraci = [...s.hraci] as [PlayerState, PlayerState];
  hraci[p] = { ...hraci[p], ...h };
  return { ...s, hraci };
}

function bitka(b: Partial<BitkaStav>): BitkaStav {
  return {
    krok: null,
    caka: null,
    sums: [{}, {}],
    exekutorHotovy: [true, true],
    pohorsenieZostava: [0, 0],
    exekutor: [0, 0],
    damage: null,
    vitaz: 0,
    prebytokDrzi: null,
    prebytokZostava: 0,
    prebytokPosunute: [],
    benzinkaZostava: [0, 0],
    karHotovy: [true, true],
    spalit: [],
    vesticaHotova: true,
    ...b,
  };
}

/**
 * Kolo 3, patronát hráča 1: hráč 0 ohlásil v kole 2 vydesenie 4 z 8 starších
 * (marker 6), piaty starší je na hrane (5). Hráč 0 sa už rozhodol.
 */
function predPatronatom(seed: number): { s: GameState; obcan: CardInstance } {
  const s0 = setupSBalickom(data, seed);
  const obcan = inst("pijan");
  const s = sHracom(
    {
      ...s0,
      faza: "draft",
      kolo: 3,
      utocnik: 0,
      ohlaseneVydesenie: [2, null],
      ciel: { typ: "lokalita", lokalita: s0.lokalityVHre[0]! },
      lokalityVHre: s0.lokalityVHre.slice(1),
      starsi: s0.starsi.map((e, i) => (i < 4 ? { ...e, marker: 6 as const } : i === 4 ? { ...e, marker: 5 as const } : e)),
      draftStav: { krok: "patronat", balicky: [[], []], vyber: [null, null], naTahu: 1, hotovo: [true, false], noveKarty: [0, 0] },
    },
    1,
    { ruka: [obcan], cigarety: 3, poldeciPlne: 2, doberaci: [...s0.hraci[1].doberaci, inst("pijan"), inst("pijan"), inst("pijan")] },
  );
  return { s, obcan };
}

/** Dohrá zvyšok kola `kolo` prvými legálnymi ťahmi (ak ešte beží). */
function dohrajKolo(s: GameState, kolo: number): GameState {
  let st = s;
  for (let i = 0; i < 200 && st.koniec === null && st.kolo === kolo; i++) {
    const p = naTahu(st);
    if (p === null) break;
    const c = legalCommands(data, st, p)[0];
    if (c === undefined) break;
    st = apply(data, st, c, p).state;
  }
  return st;
}

describe("ohlásené vydesenie sa ruší hneď (Michal 2026-10-26)", () => {
  it("§1/§10: patronát nad vydeseným starším zruší ohlásenie v tej chvíli — aj v pohľade oboch hráčov", () => {
    const { s, obcan } = predPatronatom(61);
    expect(prahVydesenia(s)).toBe(4);
    const r = apply(data, s, { type: "patronat", elderId: s.starsi[0]!.elderId, uid: obcan.uid }, 1);
    expect(r.state.starsi[0]!.marker).toBe(3);
    expect(r.state.ohlaseneVydesenie).toEqual([null, null]);
    expect(r.events.some((e) => e.type === "log" && e.text.includes("hrozba vydesenia padla"))).toBe(true);
    for (const p of [0, 1] as const) expect(viewFor(data, r.state, p).ohlaseneVydesenie).toEqual([null, null]);
  });

  it("§1: kto po zrušení v tom istom kole znova doplní polovicu, ohlasuje odznova — na konci kola nevyhrá", () => {
    const { s, obcan } = predPatronatom(62);
    const po = apply(data, s, { type: "patronat", elderId: s.starsi[0]!.elderId, uid: obcan.uid }, 1).state;
    // V bitke toho istého kola hráč 0 prebytkom dotlačí piateho staršieho na červenú.
    const vBitke: GameState = {
      ...po,
      faza: "bitka",
      draftStav: null,
      zhromazdenieStav: null,
      strany: [[], []],
      bitkaStav: bitka({ krok: "prebytok", caka: 0, vitaz: 0, prebytokDrzi: 0, prebytokZostava: 1 }),
    };
    const r = apply(data, vBitke, { type: "prebytok", elderId: s.starsi[4]!.elderId }, 0);
    expect(r.events.some((e) => e.type === "log" && e.text.includes("Ak ich udrží do konca ďalšieho kola"))).toBe(true);
    const koniecKola = dohrajKolo(r.state, 3);
    expect(koniecKola.starsi.filter((e) => vydesil(e, 0))).toHaveLength(4);
    expect(koniecKola.kolo).toBe(4);
    expect(koniecKola.koniec).toBeNull();
    expect(koniecKola.ohlaseneVydesenie[0]).toBe(3);
  });

  it("§1: po žiadnom ťahu nevisí ohlásenie hráča, ktorý nemá vydesenú polovicu starších (náhodné partie)", () => {
    let ohlasenych = 0;
    // 294 a 69: ohlásenie v náhodnej partii pravidiel v6.1 (294) a s dobratím 1 karty po bitke (69, 2026-10-27);
    // 130: pravidlá v7 (prah Exekútora 7, D6); 56, 108, 143: pravidlá v8 (bez finále v testovacej sade);
    // 133, 145: exekúcia bez prahu (2026-10-28).
    for (const seed of [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 294, 69, 130, 56, 108, 143, 133, 145]) {
      let state: GameState = setupGame(data, seed);
      let rng = rngSeed(seed ^ 0x1d);
      for (let i = 0; state.koniec === null && i < 20000; i++) {
        const hrac = naTahu(state);
        if (hrac === null) break;
        const cmds = legalCommands(data, state, hrac);
        const [j, r] = rngInt(rng, cmds.length);
        rng = r;
        state = apply(data, state, cmds[j] as Command, hrac).state;
        if (state.koniec !== null) break;
        for (const p of [0, 1] as const) {
          if (state.ohlaseneVydesenie[p] === null) continue;
          ohlasenych++;
          expect(state.starsi.filter((e) => vydesil(e, p)).length).toBeGreaterThanOrEqual(prahVydesenia(state));
        }
      }
    }
    // Invariant musí niečo strážiť — náhodné partie ohlásenie občas dosiahnu.
    expect(ohlasenych).toBeGreaterThan(0);
  });
});

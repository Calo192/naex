// Playtest 20261021-143600 (návrh „Náhľady sľubujú inú cenu“, bod 4): bitka
// ohlásila prebytok ešte pred odpočtom Pušky a prebytok zrušený Miňištrantom
// či Pohoršenia zrušené Policajtkou prepadli bez hlášky — hráči to brali ako chybu.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { BitkaStav, CardInstance, ElderState, Event, GameState, PlacedCard, PlayerId } from "../src/index.ts";
import { apply, battleOutcome, loadGameData, prebytokNaRozdelenie, setupGame } from "../src/index.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

let uidSeq = 98000;
const inst = (defId: string): CardInstance => ({ uid: ++uidSeq, defId, leftLayout: 0, rightLayout: 0 });
const lezi = (defId: string, playedBy: PlayerId): PlacedCard => ({ card: inst(defId), playedBy });

function bitka(b: Partial<BitkaStav>): BitkaStav {
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
    pohrebHotovy: [true, true],
    benzinkaZostava: [0, 0],

    karHotovy: [true, true],
    spalit: [],
    vesticaHotova: true,
    ...b,
  };
}

function vBitke(strany: GameState["strany"], b: Partial<BitkaStav>, uprav: (s: GameState) => GameState = (s) => s): GameState {
  const s0 = setupGame(data, 17);
  const stred = (e: ElderState): ElderState => ({ ...e, marker: 3 });
  return uprav({
    ...s0,
    faza: "bitka",
    kolo: 2,
    strany,
    ciel: { typ: "lokalita", lokalita: s0.lokalityVHre[0]! },
    lokalityVHre: s0.lokalityVHre.slice(1),
    starsi: s0.starsi.map(stred),
    bitkaStav: bitka(b),
  });
}

const logy = (events: readonly Event[]): string[] => events.flatMap((e) => (e.type === "log" ? [e.text] : []));

/** Hráč 0 doloží posledné Pohoršenie — bitka potom vyhodnotí poškodenie zo súčtov `sums`. */
function poPohorseni(s: GameState) {
  return apply(data, s, { type: "pohorsenie", elderId: s.starsi[0]!.elderId }, 0);
}

describe("bitka hlási, čo zmenší či zruší prebytok a Pohoršenia", () => {
  it("Puška: výsledok bitky nesie prebytok po odpočte a log ho ohlási", () => {
    const s = vBitke([[], []], { krok: "pohorsenie", caka: 0, pohorsenieZostava: [1, 0], sums: [{ Rana: 5 }, {}] }, (t) => ({
      ...t,
      hraci: [t.hraci[0], { ...t.hraci[1], dedicstvo: [inst("puska")] }],
    }));
    const { state, events } = poPohorseni(s);
    const v = events.find((e) => e.type === "bitkaVysledok");
    if (v?.type !== "bitkaVysledok") throw new Error("bitka sa nevyhodnotila");
    expect(v.prebytok).toBe(5);
    expect(v.prebytokNaRozdelenie).toBe(3);
    // Ten istý výpočet ponúka klient v odhade bitky.
    expect(prebytokNaRozdelenie(s, battleOutcome(v.damage))).toBe(3);
    expect(state.bitkaStav?.prebytokZostava).toBe(3);
    expect(logy(events)).toContain("Puška hráča 2: prebytok 5 → 3.");
  });

  it("Miňištrant: prebytok, ktorý na posun nestačí, prepadne s hláškou", () => {
    // Dvaja Miňištranti víťaza → posun stojí 3; prebytok 4 − Puška 2 = 2.
    const s = vBitke(
      [[lezi("ministrant", 0), lezi("ministrant", 0)], []],
      { krok: "pohorsenie", caka: 0, pohorsenieZostava: [1, 0], sums: [{ Rana: 4 }, {}] },
      (t) => ({ ...t, hraci: [t.hraci[0], { ...t.hraci[1], dedicstvo: [inst("puska")] }] }),
    );
    const { state, events } = poPohorseni(s);
    expect(state.bitkaStav?.krok).not.toBe("prebytok");
    expect(logy(events)).toContain("Prebytok 2 prepadol — posun markera stojí hráča 1 3 (Miňištrant).");
  });

  it("Policajtka (Michal 2026-10-26) Pohoršenia neruší — bitka o nej mlčí a Pohoršenia z patronátu platia", () => {
    // Benzínka: hráč 0 spáli jedného z dvoch Občanov, potom sa prepočítajú Pohoršenia.
    const s = vBitke([[lezi("pijan", 0), lezi("pijan", 0)], [lezi("policajtka", 1)]], { krok: "benzinka", caka: 0, benzinkaZostava: [1, 0], exekutorHotovy: [false, false] }, (t) => ({
      ...t,
      patronat: [null, { elderId: t.starsi[0]!.elderId, nahrada: inst("pijan"), pohorsenia: 2 }],
    }));
    const { state, events } = apply(data, s, { type: "benzinka", uids: [s.strany[0][0]!.card.uid] }, 0);
    expect(logy(events).some((t) => t.startsWith("Policajtka") || t.startsWith("Praudovravec umlčal"))).toBe(false);
    expect(state.bitkaStav?.pohorseniaPatronatu?.[0]).toBe(2);
    expect(state.bitkaStav?.pohorseniaSpolu?.[0] ?? 0).toBeGreaterThanOrEqual(2);
  });
});

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

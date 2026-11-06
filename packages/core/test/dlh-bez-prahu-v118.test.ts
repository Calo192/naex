// Každý Hazard je Dlh (v11.8, Michal 2026-11-06, PRAVIDLA §8): prah Dlhu 1, výnimkou je
// len Výherný automat (prah 2, zvyšok ostáva na účte).

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { CardInstance, Event, GameState, PitkaStav, PlacedCard, PlayerId } from "../src/index.ts";
import { apply, buildGameData, legalCommands, loadGameData, nahladPitky, parseScorecards, prahyHraca, setupGame } from "../src/index.ts";
import { EMPTY, instanceFor, makeDef } from "./helpers.ts";
import type { Layout4 } from "./helpers.ts";

const zaklad = loadGameData(cardsJson, eldersJson, scorecardsJson);
// Spoj dvoch kariet: 5 aktívnych akcií Hazard (rovnaké rozloženie ako pravidla-kolo §8).
const HAZARD_VONK: Layout4 = ["Dlh", "Dlh", "Dlh", null];
const HAZARD_VNUT: Layout4 = ["Dlh", "Dlh", "Rana", null];
// Policajtka s Odporom proti dvom akciám súperovej karty otočenej k nej (autority-v104).
const POLICAJTKA_R: Layout4 = ["Odpor", "Odpor", null, null];
const SUPER_R: Layout4 = [null, null, "Rana", "Pecka"];
const data = buildGameData(
  new Map([
    ...zaklad.cards,
    ["t_vonk", makeDef("t_vonk", EMPTY, HAZARD_VONK)],
    ["t_vnut", makeDef("t_vnut", HAZARD_VNUT, EMPTY)],
    ["t_prazdna", makeDef("t_prazdna", EMPTY, EMPTY)],
    ["t_super", makeDef("t_super", EMPTY, SUPER_R)],
    ["policajtka", makeDef("policajtka", EMPTY, POLICAJTKA_R, { tags: ["Občan", "Autorita", "Žena"], triggers: ["Pitka"] })],
  ]),
  zaklad.elders,
  { scorecards: zaklad.scorecards, body: parseScorecards(scorecardsJson).body },
);

let uidSeq = 880000;
const inst = (defId: string): CardInstance => ({ uid: ++uidSeq, defId, leftLayout: 0, rightLayout: 0 });
const lezi = (card: CardInstance, playedBy: PlayerId): PlacedCard => ({ card, playedBy });

function pitkaStav(naTahu: PlayerId): PitkaStav {
  return { naTahu, hotovy: [false, false], naexPouzity: [false, false], fajcenie: [0, 0], reakcia: null, postarka: [false, false], starosta: [false, false], naexPocet: [0, 0], vykup: [false, false] };
}

/** Pitka bez lokality (jej hrany by rušili akcie). Po nej príde bitka a Exekútor, preto Dlhy Pitky rátajú z pitkaVysledok. */
function vPitke(strany: GameState["strany"], hrac0: Partial<GameState["hraci"][0]> = {}): GameState {
  const s0 = setupGame(data, 11);
  const hraci = s0.hraci.map((h, i) => ({ ...h, cigarety: 0, zadlzenie: 0, dlhy: 0, ruka: [], ...(i === 0 ? hrac0 : {}) })) as unknown as GameState["hraci"];
  return {
    ...s0,
    hraci,
    faza: "pitka",
    utocnik: 0,
    ciel: null,
    strany,
    pitkyCelkom: 2,
    pitkaCislo: 1,
    pitkaStav: pitkaStav(0),
  };
}

/** Oba hráči skončia Pitku bez NA EX; vráti stav a udalosti vyhodnotenia. */
function dopi(s: GameState): { readonly state: GameState; readonly events: readonly Event[] } {
  let t = s;
  const events: Event[] = [];
  for (let i = 0; i < 8 && !events.some((e) => e.type === "pitkaVysledok"); i++) {
    const q = ([0, 1] as const).find((x) => legalCommands(data, t, x).some((c) => c.type === "skipNaex" || c.type === "bezReakcie"));
    if (q === undefined) break;
    const r = apply(data, t, legalCommands(data, t, q).find((c) => c.type === "skipNaex" || c.type === "bezReakcie")!, q);
    events.push(...r.events);
    t = r.state;
  }
  return { state: t, events };
}

const dlhyVysledku = (events: readonly Event[]): readonly [number, number] | undefined => {
  const e = events.find((x) => x.type === "pitkaVysledok");
  return e?.type === "pitkaVysledok" ? e.dlhy : undefined;
};

const hazard5 = (): GameState["strany"] => [[lezi(instanceFor(data, "t_vnut", HAZARD_VNUT, EMPTY), 0), lezi(instanceFor(data, "t_vonk", EMPTY, HAZARD_VONK), 0)], []];

describe("Hazard v Pitke (v11.8, §8)", () => {
  it("každá aktívna akcia dá hneď Dlh a na účte nič neostane; výhľad hovorí to isté", () => {
    const s = vPitke(hazard5());
    const nahlad = nahladPitky(data, s)[0];
    expect(nahlad.prahDlhu).toBe(1);
    expect(nahlad.dlhy).toBe(5);
    const { state, events } = dopi(s);
    expect(dlhyVysledku(events)?.[0]).toBe(5);
    expect(state.hraci[0].zadlzenie).toBe(0);
  });

  it("zvyšok z rozohranej partie (zadĺženie 1 pri prahu 1) sa pri Pitke zmení na Dlh, ako ukázal výhľad", () => {
    const s = vPitke([[], []], { zadlzenie: 1 });
    expect(nahladPitky(data, s)[0].dlhy).toBe(1);
    const { state, events } = dopi(s);
    expect(dlhyVysledku(events)?.[0]).toBe(1);
    expect(state.hraci[0].zadlzenie).toBe(0);
  });
});

describe("Výherný automat: prah 2, zvyšok ostáva na účte (v11.8, §8)", () => {
  it("prah Dlhu je 2: 5 Hazardov = 2 Dlhy a 1 zadĺženie ostáva na účte", () => {
    const s = vPitke(hazard5(), { dedicstvo: [inst("vyherny_automat")] });
    expect(prahyHraca(data, s, 0).dlh).toBe(2);
    expect(prahyHraca(data, s, 1).dlh).toBe(1);
    expect(nahladPitky(data, s)[0].dlhy).toBe(2);
    const { state, events } = dopi(s);
    expect(dlhyVysledku(events)?.[0]).toBe(2);
    expect(state.hraci[0].zadlzenie).toBe(1);
  });

  it("zvyšok pod prahom ostáva, aj keď stôl nič nepripíše", () => {
    const s = vPitke([[], []], { dedicstvo: [inst("vyherny_automat")], zadlzenie: 1 });
    const { state, events } = dopi(s);
    expect(dlhyVysledku(events)?.[0]).toBe(0);
    expect(state.hraci[0].zadlzenie).toBe(1);
  });
});

describe("Efekty „získa 1 zadĺženie“ pri prahu 1 (v11.8, §8)", () => {
  /** Hráč 1 priloží kartu k Podvodníkovi hráča 0 a nemá cigaretu. */
  function poPodvodnikovi(hrac1: Partial<GameState["hraci"][1]>): { readonly pred: GameState; readonly po: GameState } {
    const s0 = setupGame(data, 11);
    const lokalita = s0.lokalityVHre.find((k) => k.defId === "zastavka")!;
    const cudzia = inst("t_prazdna");
    const hraci = [
      { ...s0.hraci[0], cigarety: 0, dlhy: 0, zadlzenie: 0 },
      { ...s0.hraci[1], cigarety: 0, dlhy: 0, zadlzenie: 0, ruka: [cudzia], ...hrac1 },
    ] as unknown as GameState["hraci"];
    const pred: GameState = {
      ...s0,
      hraci,
      faza: "zhromazdenie",
      utocnik: 1,
      ciel: { typ: "lokalita", lokalita },
      lokalityVHre: s0.lokalityVHre.filter((k) => k !== lokalita),
      strany: [[lezi(inst("podvodnik"), 0)], []],
      pitkyCelkom: 1,
      pitkaCislo: 0,
      pitkaStav: null,
      zhromazdenieStav: { naTahu: 1, zostavaLimit: [3, 3], pasoval: [false, false], navyse: [0, 0] },
    };
    const po = apply(data, pred, { type: "place", uid: cudzia.uid, target: "superova" }, 1).state;
    return { pred, po };
  }

  it("Podvodník proti Výhernému automatu so zvyškom: 1 + 1 = Dlh", () => {
    const { po } = poPodvodnikovi({ dedicstvo: [inst("vyherny_automat")], zadlzenie: 1 });
    expect(po.hraci[1].dlhy).toBe(1);
    expect(po.hraci[1].zadlzenie).toBe(0);
  });

  it("Podvodník: súper bez cigarety dostane rovno Dlh", () => {
    const { po } = poPodvodnikovi({});
    expect(po.hraci[1].dlhy).toBe(1);
    expect(po.hraci[1].zadlzenie).toBe(0);
  });

  it("Podvodník proti Výhernému automatu: 1 zadĺženie ostáva na účte, Dlh nie", () => {
    const { po } = poPodvodnikovi({ dedicstvo: [inst("vyherny_automat")] });
    expect(po.hraci[1].dlhy).toBe(0);
    expect(po.hraci[1].zadlzenie).toBe(1);
  });

  it("Policajtka: dve akcie zrušené Odporom dajú súperovi v Pitke 2 Dlhy", () => {
    const s = vPitke([[lezi(instanceFor(data, "t_super", EMPTY, SUPER_R), 1), lezi(instanceFor(data, "policajtka", EMPTY, POLICAJTKA_R), 0)], []]);
    expect(nahladPitky(data, s)[1].dlhy).toBe(2);
    const { state, events } = dopi(s);
    expect(dlhyVysledku(events)?.[1]).toBe(2);
    expect(state.hraci[1].zadlzenie).toBe(0);
  });
});

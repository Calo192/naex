// Efekty okolo NA EX — trojica (Michal 2026-10-26, docs/napady/karty-naex-trojica.html):
// Policajtka dá pri odkrytí Dlh súperovi, ktorý dal v Pitke viac NA EX; Svokra
// udelí v bitke Ranu za každú majiteľovu kartu so súperovým NA EX; NA EX majiteľa
// na vlastného Anonymného alkoholika (placatka) sa nepočíta do limitu za Pitku.
// Anonymný alkoholik ani Liberál NA EX nezakazujú. Predtým: Policajtka rušila
// Pohoršenia, Svokra kradla cigarety, Anonymný alkoholik chránil seba.
// NA EX smie len na kartu s aspoň 1 aktívnou a 1 neaktívnou akciou (2026-10-23) —
// preto karty v testoch ležia vo dvojiciach.

import { describe, expect, it } from "vitest";
// Sada v6 (pred revíziou v7): test stráži pravidlá, ktoré revízia sady nemení.
import cardsJson from "./data/cards-v6.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { CardInstance, Event, GameState, PlacedCard, PlayerId } from "../src/index.ts";
import {
  apply,
  bitkaMody,
  evaluateLine,
  pohorseniaVBitke,
  krcmaVyzaduje,
  legalCommands,
  lineState,
  loadGameData,
  moznostiNaex,
  naTahu,
  poskodenieBitky,
  rozpisPoskodenia,
  setupGame,
  svokraRany,
} from "../src/index.ts";
import { naexOdkryte } from "./helpers.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

let uidSeq = 90000;
const inst = (defId: string): CardInstance => ({ uid: ++uidSeq, defId, leftLayout: 0, rightLayout: 0 });
const lezi = (defId: string, playedBy: PlayerId, extra: Partial<PlacedCard> = {}): PlacedCard => ({ card: inst(defId), playedBy, ...extra });
const uid = (pl: PlacedCard | undefined): number => pl?.card.uid ?? -1;

interface Nastavenie {
  /** Cieľ kola — lokalita (krcma, kostol, vinna_pivnica…). */
  readonly lokalita?: string;
  readonly poldeci?: readonly [number, number];
  /**
   * Karta v ruke oboch — po odkrytí sa čaká na odpoveď, takže stav ostane tesne
   * po odkrytí NA EX (pred vyhodnotením Pitky). Bez nej sa Pitka dohrá.
   */
  readonly ruka?: boolean;
}

/** Pitka, hráč `naTahu` na ťahu, obaja s plným poldeci a 3 cigaretami. */
function vPitke(strany: GameState["strany"], naTahu: PlayerId = 0, n: Nastavenie = {}): GameState {
  const s = setupGame(data, 3);
  const poldeci = n.poldeci ?? [1, 1];
  const ruka = (): CardInstance[] => (n.ruka === true ? [inst("pijan")] : []);
  return {
    ...s,
    faza: "pitka",
    pitkyCelkom: 1,
    pitkaCislo: 1,
    ciel: n.lokalita === undefined ? s.ciel : { typ: "lokalita", lokalita: inst(n.lokalita) },
    strany,
    hraci: [
      { ...s.hraci[0], poldeciPlne: poldeci[0], cigarety: 3, ruka: ruka() },
      { ...s.hraci[1], poldeciPlne: poldeci[1], cigarety: 3, ruka: ruka() },
    ],
    pitkaStav: { naTahu, hotovy: [false, false], naexPouzity: [false, false], fajcenie: [0, 0], reakcia: null, postarka: [false, false], starosta: [false, false], naexPocet: [0, 0] },
  } as GameState;
}

/** Kam smie hráč p dať NA EX — aj keď práve nie je na ťahu (vyberá skryto, každý vo svojej časti Pitky). */
const naexCiele = (s: GameState, p: PlayerId): number[] => moznostiNaex(data, s, p);

/**
 * Pitka naraz: kto je na ťahu, dá svoje NA EX (v poradí zo zoznamu) a skončí.
 * Zastaví sa, keď sa čaká na odpoveď na odkryté NA EX alebo keď Pitka skončí.
 */
function odohraj(s: GameState, naex: readonly [readonly number[], readonly number[]]): { state: GameState; logy: string[] } {
  let t = s;
  const logy: string[] = [];
  const zostava = [[...naex[0]], [...naex[1]]];
  for (let i = 0; i < 20 && t.faza === "pitka" && t.vizia === null && t.pitkaStav !== null && t.pitkaStav.reakcia === null; i++) {
    const p = naTahu(t);
    if (p === null) break;
    const u = zostava[p]?.shift();
    const r = apply(data, t, u === undefined ? { type: "skipNaex" } : { type: "naex", uid: u }, p);
    for (const e of r.events as Event[]) if (e.type === "log") logy.push(e.text);
    t = r.state;
  }
  return { state: t, logy };
}

const dlhy = (s: GameState, p: PlayerId): number => s.hraci[p].dlhy;


describe("Svokra (Bitka: Rana za každú tvoju kartu so súperovým NA EX)", () => {
  it("ráta majiteľove karty so súperovým NA EX na oboch stranách, aj podstrčené aj Svokru samu; vlastné NA EX nie", () => {
    const strany: GameState["strany"] = [
      [lezi("zamocnik", 0, { naexBy: 1 }), lezi("zamocnik", 0, { naexBy: 0 }), lezi("zamocnik", 1, { naexBy: 1 })],
      [lezi("zamocnik", 0, { naexBy: 1 }), lezi("svokra", 0, { naexBy: 1 }), lezi("zamocnik", 1, { naexBy: 0 })],
    ];
    const s = { ...vPitke(strany), faza: "bitka" } as GameState;
    expect(svokraRany(data, s, 0)).toBe(3);
    expect(bitkaMody(data, s, 0).tuheZdroje).toContainEqual({ zdroj: "svokra", tuhe: 3 });
    // Súper Svokru nemá — jeho karta so súperovým NA EX mu nič nedá.
    expect(svokraRany(data, s, 1)).toBe(0);
    const sums = evaluateLine(data, lineState(s)).sums;
    expect(rozpisPoskodenia(data, s, sums)[0].bonusy).toContainEqual({ zdroj: "svokra", hodnota: 3 });
  });

  it("zrážka (Výtržník) sa ráta — na karte leží aj súperov poldeci", () => {
    const s = vPitke([[lezi("zamocnik", 0, { naexBy: 0, naexBy2: 1, vytrznik: true }), lezi("svokra", 0)], []]);
    expect(svokraRany(data, s, 0)).toBe(1);
  });

  it("v bitke je Rana navyše v tuhom: to isté NA EX od súpera dá o 1 tuhé viac ako vlastné", () => {
    const stol = (kto: PlayerId): GameState => vPitke([[lezi("zamocnik", 0, { naexBy: kto }), lezi("zamocnik", 0), lezi("svokra", 0)], []]);
    const tuhe = (s: GameState): number => poskodenieBitky(data, s, evaluateLine(data, lineState(s)).sums).tuhe[0];
    expect(tuhe(stol(1)) - tuhe(stol(0))).toBe(1);
  });

  it("Praudovravec súpera ju umlčí (Autorita); dve Svokry — Rana od každej", () => {
    const umlcana = vPitke([[lezi("zamocnik", 0, { naexBy: 1 }), lezi("svokra", 0)], [lezi("praudovravec", 1)]]);
    expect(svokraRany(data, umlcana, 0)).toBe(0);
    const dve = vPitke([[lezi("zamocnik", 0, { naexBy: 1 }), lezi("svokra", 0), lezi("svokra", 0)], []]);
    expect(svokraRany(data, dve, 0)).toBe(2);
  });

  it("pri odkrytí NA EX už súperovi cigarety neberie", () => {
    const pijan = lezi("zamocnik", 0);
    const s = vPitke([[pijan, lezi("zamocnik", 0)], [lezi("svokra", 1)]], 0, { ruka: true });
    const { state, events } = naexOdkryte(data, s, uid(pijan), 0);
    expect(state.pitkaStav?.reakcia).toBe(1);
    expect([state.hraci[0].cigarety, state.hraci[1].cigarety]).toEqual([3, 3]);
    expect(events.some((e) => e.type === "log" && e.text.startsWith("Svokra:"))).toBe(false);
  });

  it("Nástup Svokry NA EX nezakazuje", () => {
    const svokra = inst("svokra");
    const s0 = setupGame(data, 4);
    const s = {
      ...s0,
      faza: "zhromazdenie",
      hraci: [{ ...s0.hraci[0], ruka: [svokra], poldeciPlne: 2, poldeciVypite: 0 }, s0.hraci[1]],
      zhromazdenieStav: { naTahu: 0, zostavaLimit: [3, 3], pasoval: [false, false], navyse: [0, 0] },
    } as GameState;
    const { state, events } = apply(data, s, { type: "place", uid: svokra.uid, target: "vlastna" }, 0);
    expect(events.some((e) => e.type === "log" && e.text.startsWith("Svokra:"))).toBe(false);
    expect("zakazNaex" in state).toBe(false);
  });
});


describe("Liberál", () => {
  it("NA EX naň smie (Michal 2026-10-26 zrušil vetu „Na Liberála NA EX dať nemožno“)", () => {
    const liberal = lezi("liberal", 0);
    const s = vPitke([[lezi("zamocnik", 0), liberal, lezi("zamocnik", 0)], []], 1);
    expect(naexCiele(s, 1)).toContain(uid(liberal));
    expect(() => apply(data, s, { type: "naex", uid: uid(liberal) }, 1)).not.toThrow();
  });
});

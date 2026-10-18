// Efekty okolo NA EX (Michal 2026-10-18): Anonymný alkoholik chráni seba
// a susedov pred NA EX, Svokra za každé NA EX súpera ukradne cigaretu.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { CardInstance, GameState, PlacedCard, PlayerId } from "../src/index.ts";
import { apply, krcmaVyzaduje, legalCommands, loadGameData, setupGame } from "../src/index.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

let uidSeq = 90000;
const inst = (defId: string): CardInstance => ({ uid: ++uidSeq, defId, leftLayout: 0, rightLayout: 0 });
const lezi = (defId: string, playedBy: PlayerId): PlacedCard => ({ card: inst(defId), playedBy });
const uid = (pl: PlacedCard | undefined): number => pl?.card.uid ?? -1;

/** Pitka, hráč `naTahu` na ťahu, obaja s plným poldeci a danými cigaretami. */
function vPitke(strany: GameState["strany"], naTahu: PlayerId = 0, cigarety: [number, number] = [3, 3]): GameState {
  const s = setupGame(data, 3);
  return {
    ...s,
    faza: "pitka",
    pitkyCelkom: 1,
    pitkaCislo: 1,
    strany,
    hraci: [
      { ...s.hraci[0], poldeciPlne: 1, cigarety: cigarety[0] },
      { ...s.hraci[1], poldeciPlne: 1, cigarety: cigarety[1] },
    ],
    pitkaStav: { naTahu, hotovy: [false, false], naexPouzity: [false, false], fajcenie: [0, 0], reakcia: null, postarka: [false, false], starosta: [false, false] },
  } as GameState;
}

const naexCiele = (s: GameState, p: PlayerId): number[] =>
  legalCommands(data, s, p).flatMap((c) => (c.type === "naex" ? [c.uid] : []));

describe("Anonymný alkoholik", () => {
  it("na neho ani na susedov NA EX nedá nikto — ani majiteľ", () => {
    const strana0 = [lezi("pijan", 0), lezi("anonymny_alkoholik", 0), lezi("pijan", 0), lezi("ministrant", 0)];
    const strana1 = [lezi("pijan", 1)];
    for (const p of [0, 1] as const) {
      const s = vPitke([strana0, strana1], p);
      const ciele = naexCiele(s, p);
      expect(ciele).not.toContain(uid(strana0[0]));
      expect(ciele).not.toContain(uid(strana0[1]));
      expect(ciele).not.toContain(uid(strana0[2]));
      expect(ciele).toContain(uid(strana0[3]));
      expect(ciele).toContain(uid(strana1[0]));
      expect(() => apply(data, s, { type: "naex", uid: uid(strana0[2]) }, p)).toThrow(/Anonymný alkoholik/);
    }
  });

  it("susedstvo cez lokalitu sa nepočíta", () => {
    const strana0 = [lezi("anonymny_alkoholik", 0), lezi("pijan", 0)];
    const strana1 = [lezi("pijan", 1)];
    const ciele = naexCiele(vPitke([strana0, strana1]), 0);
    expect(ciele).not.toContain(uid(strana0[1]));
    expect(ciele).toContain(uid(strana1[0]));
  });

  it("podstrčený na súperovu stranu chráni aj súperove karty vedľa seba", () => {
    const strana1 = [lezi("pijan", 1), lezi("anonymny_alkoholik", 0)];
    const ciele = naexCiele(vPitke([[], strana1]), 0);
    expect(ciele).toEqual([]);
  });

  it("Krčma nevyžaduje NA EX, keď jediný Občan stojí pri Alkoholikovi", () => {
    const s = {
      ...vPitke([[lezi("pijan", 0), lezi("anonymny_alkoholik", 0)], []]),
      ciel: { typ: "lokalita", lokalita: inst("krcma"), elderId: null },
    } as GameState;
    expect(krcmaVyzaduje(data, s, 0)).toBe(false);
  });
});

describe("Svokra", () => {
  it("za NA EX súpera ukradne jej majiteľ 1 cigaretu", () => {
    const pijan = lezi("pijan", 0);
    const s = vPitke([[pijan], [lezi("svokra", 1)]], 0, [2, 0]);
    const { state, events } = apply(data, s, { type: "naex", uid: uid(pijan) }, 0);
    expect([state.hraci[0].cigarety, state.hraci[1].cigarety]).toEqual([1, 1]);
    expect(events.some((e) => e.type === "log" && e.text.startsWith("Svokra:"))).toBe(true);
  });

  it("súper bez cigarety nestratí nič; vlastné NA EX majiteľa nič nespustí", () => {
    const pijan = lezi("pijan", 0);
    const bezCigariet = apply(data, vPitke([[pijan], [lezi("svokra", 1)]], 0, [0, 0]), { type: "naex", uid: uid(pijan) }, 0).state;
    expect([bezCigariet.hraci[0].cigarety, bezCigariet.hraci[1].cigarety]).toEqual([0, 0]);
    const vlastne = apply(data, vPitke([[pijan], [lezi("svokra", 0)]], 0, [2, 2]), { type: "naex", uid: uid(pijan) }, 0).state;
    expect([vlastne.hraci[0].cigarety, vlastne.hraci[1].cigarety]).toEqual([2, 2]);
  });

  it("dve Svokry ukradnú 2 cigarety", () => {
    const pijan = lezi("pijan", 0);
    const s = vPitke([[pijan], [lezi("svokra", 1), lezi("svokra", 1)]], 0, [3, 0]);
    const po = apply(data, s, { type: "naex", uid: uid(pijan) }, 0).state;
    expect([po.hraci[0].cigarety, po.hraci[1].cigarety]).toEqual([1, 2]);
  });

  it("Praudovravec súpera ju umlčí (Autorita)", () => {
    const pijan = lezi("pijan", 0);
    const s = vPitke([[pijan, lezi("praudovravec", 0)], [lezi("svokra", 1)]], 0, [2, 0]);
    const po = apply(data, s, { type: "naex", uid: uid(pijan) }, 0).state;
    expect([po.hraci[0].cigarety, po.hraci[1].cigarety]).toEqual([2, 0]);
  });

  it("Nástup Svokry už NA EX nezakazuje", () => {
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

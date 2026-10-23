// Efekty okolo NA EX (Michal 2026-10-18, upravené 2026-10-19 a 2026-10-22): Anonymný
// alkoholik chráni pred súperovým NA EX len seba,
// Svokra za každé NA EX súpera ukradne 2 cigarety.
// NA EX smie len na kartu s aspoň 1 aktívnou a 1 neaktívnou akciou (2026-10-23) —
// preto karty v testoch ležia vo dvojiciach.

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
  // Michal 2026-10-22: chráni pred súperovým NA EX len seba (od 2026-10-19
  // chránil aj majiteľove karty vedľa seba); majiteľ smie.
  it("súper nedá NA EX na neho, na majiteľove karty vedľa neho áno", () => {
    const strana0 = [lezi("pijan", 0), lezi("anonymny_alkoholik", 0), lezi("pijan", 0)];
    const strana1 = [lezi("pijan", 1), lezi("pijan", 1)];
    const s = vPitke([strana0, strana1], 1);
    const ciele = naexCiele(s, 1);
    expect(ciele).not.toContain(uid(strana0[1]));
    expect(ciele).toContain(uid(strana0[0]));
    expect(ciele).toContain(uid(strana0[2]));
    expect(ciele).toContain(uid(strana1[0]));
    expect(() => apply(data, s, { type: "naex", uid: uid(strana0[1]) }, 1)).toThrow(/Anonymný alkoholik/);
    expect(() => apply(data, s, { type: "naex", uid: uid(strana0[2]) }, 1)).not.toThrow();
  });

  it("majiteľ smie dať NA EX na neho aj na svoje karty vedľa neho", () => {
    const strana0 = [lezi("pijan", 0), lezi("anonymny_alkoholik", 0)];
    const ciele = naexCiele(vPitke([strana0, []], 0), 0);
    expect(ciele).toContain(uid(strana0[0]));
    expect(ciele).toContain(uid(strana0[1]));
  });

  it("podstrčený na súperovu stranu chráni seba, súperove karty vedľa seba nie", () => {
    const strana1 = [lezi("pijan", 1), lezi("anonymny_alkoholik", 0), lezi("pijan", 1)];
    expect(naexCiele(vPitke([[], strana1], 1), 1)).toEqual([uid(strana1[0]), uid(strana1[2])]);
    // Majiteľ smie aj na podstrčeného.
    expect(naexCiele(vPitke([[], strana1], 0), 0)).toEqual(strana1.map(uid));
  });

  it("Krčma nevyžaduje NA EX, keď jediný Občan je súperov Alkoholik; Občan vedľa neho už áno", () => {
    const vKrcme = (strana: PlacedCard[]): GameState =>
      ({ ...vPitke([strana, []], 0), ciel: { typ: "lokalita", lokalita: inst("krcma") } }) as GameState;
    expect(krcmaVyzaduje(data, vKrcme([lezi("anonymny_alkoholik", 1)]), 0)).toBe(false);
    expect(krcmaVyzaduje(data, vKrcme([lezi("pijan", 1), lezi("anonymny_alkoholik", 1)]), 0)).toBe(true);
  });
});

describe("Svokra", () => {
  it("za NA EX súpera ukradne jej majiteľ 2 cigarety", () => {
    const pijan = lezi("pijan", 0);
    const s = vPitke([[pijan, lezi("pijan", 0)], [lezi("svokra", 1)]], 0, [3, 0]);
    const { state, events } = apply(data, s, { type: "naex", uid: uid(pijan) }, 0);
    expect([state.hraci[0].cigarety, state.hraci[1].cigarety]).toEqual([1, 2]);
    expect(events.some((e) => e.type === "log" && e.text.startsWith("Svokra:"))).toBe(true);
  });

  it("súper bez cigarety nestratí nič; vlastné NA EX majiteľa nič nespustí", () => {
    const pijan = lezi("pijan", 0);
    const bezCigariet = apply(data, vPitke([[pijan, lezi("pijan", 0)], [lezi("svokra", 1)]], 0, [0, 0]), { type: "naex", uid: uid(pijan) }, 0).state;
    expect([bezCigariet.hraci[0].cigarety, bezCigariet.hraci[1].cigarety]).toEqual([0, 0]);
    const vlastne = apply(data, vPitke([[pijan, lezi("pijan", 0)], [lezi("svokra", 0)]], 0, [2, 2]), { type: "naex", uid: uid(pijan) }, 0).state;
    expect([vlastne.hraci[0].cigarety, vlastne.hraci[1].cigarety]).toEqual([2, 2]);
  });

  it("dve Svokry ukradnú 4 cigarety, viac než súper má nie", () => {
    const pijan = lezi("pijan", 0);
    const s = vPitke([[pijan, lezi("pijan", 0)], [lezi("svokra", 1), lezi("svokra", 1)]], 0, [5, 0]);
    const po = apply(data, s, { type: "naex", uid: uid(pijan) }, 0).state;
    expect([po.hraci[0].cigarety, po.hraci[1].cigarety]).toEqual([1, 4]);
    const malo = apply(data, vPitke([[pijan, lezi("pijan", 0)], [lezi("svokra", 1), lezi("svokra", 1)]], 0, [3, 0]), { type: "naex", uid: uid(pijan) }, 0).state;
    expect([malo.hraci[0].cigarety, malo.hraci[1].cigarety]).toEqual([0, 3]);
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

// Zmeny Michala 2026-10-18 po partii proti AI: štartovky len v štartovacích
// balíčkoch, Nástroj len s podporou Občana/Starešinu a automatický pas.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { CardInstance, GameState, LineState, PlayerId } from "../src/index.ts";
import { KONSTANTY, apply, evaluateLine, loadGameData, setupGame } from "../src/index.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

let uidSeq = 60000;
const inst = (defId: string): CardInstance => ({ uid: ++uidSeq, defId, leftLayout: 0, rightLayout: 0 });

describe("štartovacie karty", () => {
  const STARTOVKY = ["pijan", "ministrant", "milujuca_manzelka", "dievcina_na_vydaj"];

  it("obaja začínajú s 4 Pijanmi, 2 Miňištrantmi, 2 Manželkami a 2 Dievčinami", () => {
    const s = setupGame(data, 7);
    for (const p of [0, 1] as const) {
      const vsetky = [...s.hraci[p].ruka, ...s.hraci[p].doberaci];
      const pocet = (id: string) => vsetky.filter((k) => k.defId === id).length;
      expect(vsetky).toHaveLength(10);
      expect(pocet("pijan")).toBe(4);
      expect(pocet("ministrant")).toBe(2);
      expect(pocet("milujuca_manzelka")).toBe(2);
      expect(pocet("dievcina_na_vydaj")).toBe(2);
    }
    expect(KONSTANTY.START_RUKA).toEqual({ pijan: 4, ministrant: 2, milujuca_manzelka: 2, dievcina_na_vydaj: 2 });
  });

  it("v spoločnom balíčku (a teda v šenku) štartovky nie sú", () => {
    const s = setupGame(data, 7);
    expect(s.spolocnyBalicek.filter((k) => STARTOVKY.includes(k.defId))).toEqual([]);
    expect(s.spolocnyBalicek.length).toBeGreaterThan(0);
  });
});

describe("Nástroj funguje len pri Občanovi alebo Starešinovi", () => {
  const lokalita = inst(data.lokality[0]!.id);
  const line = (strana: LineState["strany"][0]): LineState => ({ lokalita, lokalitaOtocena: false, strany: [strana, []] });
  const aktivne = (l: LineState, uid: number): number => {
    const e = evaluateLine(data, l).cards.get(uid)!;
    return [...e.left, ...e.right].filter((x) => x !== null && x.stav !== "neaktivna").length;
  };

  it("pri lokalite spoj nevznikne — ani na Nástroji, ani na lokalite", () => {
    const puska = inst("puska");
    const l = line([{ card: puska, playedBy: 0 }]);
    expect(aktivne(l, puska.uid)).toBe(0);
    expect(aktivne(l, lokalita.uid)).toBe(0);
  });

  it("vedľa Občana (Pijan) sa Nástroj páruje ako bežná karta", () => {
    // Hľadá Občana, s ktorým má Puška aspoň jeden pár, aby test niečo overoval.
    const puska = inst("puska");
    const obcania = [...data.cards.values()].filter((c) => c.tags.includes("Občan") && !c.tags.includes("Nástroj"));
    let overene = 0;
    for (const o of obcania) {
      const obcan = inst(o.id);
      // partia[0] je pri lokalite: Občan pri lokalite, Puška na konci za ním.
      const s = line([{ card: obcan, playedBy: 0 }, { card: puska, playedBy: 0 }]);
      const bezObcana = line([{ card: puska, playedBy: 0 }]);
      if (aktivne(s, puska.uid) > 0) overene++;
      expect(aktivne(bezObcana, puska.uid)).toBe(0);
    }
    expect(overene).toBeGreaterThan(0);
  });

  it("vedľa karty bez tagu Občan či Starešina (napr. iný Nástroj či Zviera) spoj nevznikne", () => {
    const puska = inst("puska");
    const bezObcana = [...data.cards.values()].find(
      (c) => !c.tags.includes("Občan") && !c.tags.includes("Starešina") && !c.tags.includes("Lokalita") && !c.tags.includes("Kliatba") && c.id !== "puska",
    );
    if (bezObcana === undefined) return;
    const sused = inst(bezObcana.id);
    const l = line([{ card: sused, playedBy: 0 }, { card: puska, playedBy: 0 }]);
    const e = evaluateLine(data, l).cards.get(puska.uid)!;
    // Puška má jediného suseda (kartu bez tagu Občan) — nič na nej nesmie byť aktívne.
    expect([...e.left, ...e.right].filter((x) => x !== null && x.stav === "aktivna")).toEqual([]);
  });
});

describe("priznanie Dlhu dá kartu", () => {
  function sDlhom(doberaci: CardInstance[], odhadzovaci: CardInstance[]): { s: GameState; dlh: CardInstance } {
    const s0 = setupGame(data, 3);
    const dlh = inst("dlh");
    const s = {
      ...s0,
      faza: "zhromazdenie",
      ciel: { typ: "lokalita", lokalita: s0.lokalityVHre[0]!, elderId: null },
      hraci: [{ ...s0.hraci[0], ruka: [dlh, inst("pijan")], doberaci, odhadzovaci }, s0.hraci[1]],
      zhromazdenieStav: { naTahu: 0, zostavaLimit: [2, 2], pasoval: [false, false], navyse: [0, 0] },
    } as GameState;
    return { s, dlh };
  }

  it("z doberacieho balíčka", () => {
    const vrch = inst("ministrant");
    const { s, dlh } = sDlhom([vrch], []);
    const po = apply(data, s, { type: "place", uid: dlh.uid, target: "priznanie" }, 0);
    expect(po.state.hraci[0].ruka.map((k) => k.uid)).toContain(vrch.uid);
    expect(po.events.some((e) => e.type === "log" && e.text.includes("priznáva kartu Dlh a doberá si kartu"))).toBe(true);
  });

  it("aj keď je doberací prázdny — zamieša sa odhadzovací", () => {
    const odhodena = inst("ministrant");
    const { s, dlh } = sDlhom([], [odhodena]);
    const po = apply(data, s, { type: "place", uid: dlh.uid, target: "priznanie" }, 0);
    expect(po.state.hraci[0].ruka.map((k) => k.uid)).toContain(odhodena.uid);
  });
});

describe("automatický pas", () => {
  /** Zhromaždenie, hráč 0 na ťahu, súper už pasoval. */
  function zhromazdenie(ruka: CardInstance[], limit: number, cigarety: number): GameState {
    const s = setupGame(data, 3);
    return {
      ...s,
      faza: "zhromazdenie",
      ciel: { typ: "lokalita", lokalita: s.lokalityVHre[0]!, elderId: null },
      hraci: [{ ...s.hraci[0], ruka, cigarety }, s.hraci[1]],
      zhromazdenieStav: { naTahu: 0, zostavaLimit: [limit, 0], pasoval: [false, true], navyse: [0, 0] },
    } as GameState;
  }

  it("s vyčerpaným limitom a bez kliatby či Nástroja hra pasuje sama — aj s cigaretami", () => {
    const [a, b] = [inst("pijan"), inst("pijan")];
    const s = zhromazdenie([a, b], 1, 3);
    const po = apply(data, s, { type: "place", uid: a.uid, target: "vlastna" }, 0 as PlayerId);
    // Obaja pasovali → Zhromaždenie skončilo bez ďalšieho ťahu hráča 0.
    expect(po.state.faza).not.toBe("zhromazdenie");
    expect(po.events.some((e) => e.type === "log" && e.text.includes("už nemá čo vyložiť"))).toBe(true);
  });

  it("kliatba v ruke auto-pas zastaví — priznanie je stále možnosť", () => {
    const [a, dlh] = [inst("pijan"), inst("dlh")];
    const s = zhromazdenie([a, dlh], 1, 0);
    const po = apply(data, s, { type: "place", uid: a.uid, target: "vlastna" }, 0 as PlayerId);
    expect(po.state.faza).toBe("zhromazdenie");
  });
});

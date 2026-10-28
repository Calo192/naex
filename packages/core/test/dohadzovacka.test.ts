// Dohadzovačka — nový efekt (Michal 2026-10-28): Nástup: keď ju hráč priloží k Občanovi
// alebo Starešinovi O2, z druhej strany lokality sa najvzdialenejší Občan alebo Starešina
// opačného pohlavia ako O2 presunie za ňu (na vonkajší koniec jej strany). Povinné, bez voľby.
// Sada do v22 má ešte starý spúšťač Bitka — test si ho prepne na Nástup.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { CardInstance, GameState, PlacedCard, PlayerId } from "../src/index.ts";
import { apply, loadGameData, presunDohadzovackou, sPrilozenou, setupGame } from "../src/index.ts";

type KartaJson = { id: string; triggers?: string[] };
const zoznam = (Array.isArray(cardsJson) ? cardsJson : (cardsJson as { cards: KartaJson[] }).cards) as KartaJson[];
const sNastupom = zoznam.map((k) => (k.id === "dohadzovacka" ? { ...k, triggers: ["Nástup"] } : k));
const data = loadGameData(Array.isArray(cardsJson) ? sNastupom : { ...(cardsJson as object), cards: sNastupom }, eldersJson, scorecardsJson);

let uidSeq = 770000;
const inst = (defId: string): CardInstance => ({ uid: ++uidSeq, defId, leftLayout: 0, rightLayout: 0 });
const lezi = (card: CardInstance, playedBy: PlayerId, ine: Partial<PlacedCard> = {}): PlacedCard => ({ card, playedBy, ...ine });
const ids = (s: Pick<GameState, "strany">): string[][] => s.strany.map((x) => x.map((pl) => pl.card.defId));

/** Zhromaždenie o Krčmu, hráč 0 na ťahu s Dohadzovačkou v ruke. */
function vZhromazdeni(strany: GameState["strany"], d: CardInstance): GameState {
  const s = setupGame(data, 3);
  return {
    ...s,
    faza: "zhromazdenie",
    utocnik: 0,
    ciel: { typ: "lokalita", lokalita: s.lokalityVHre.find((k) => k.defId === "krcma")! },
    pitkyCelkom: 1,
    pitkaCislo: 0,
    strany,
    hraci: [{ ...s.hraci[0], ruka: [d], poldeciPlne: 2 }, s.hraci[1]],
    zhromazdenieStav: { naTahu: 0, zostavaLimit: [3, 3], pasoval: [false, false], navyse: [0, 0] },
  } as GameState;
}

describe("Dohadzovačka (Nástup, Michal 2026-10-28)", () => {
  it("príklad Michala: „O1 … … O2“ + Dohadzovačka za O2 → „… … O2 · Dohadzovačka · O1“; karta ostáva majiteľovi", () => {
    const d = inst("dohadzovacka");
    // Moja strana: Pijan (Chlap) pri lokalite. Druhá strana: Snúbenica (Žena), Vandal (Chlap), Policajtka (Žena) najďalej.
    const policajtka = inst("policajtka");
    const s = vZhromazdeni([[lezi(inst("pijan"), 0)], [lezi(inst("snubenica"), 1), lezi(inst("vandal"), 1), lezi(policajtka, 1)]], d);
    const { state, events } = apply(data, s, { type: "place", uid: d.uid, target: "vlastna" }, 0);
    expect(ids(state)).toEqual([
      ["pijan", "dohadzovacka", "policajtka"],
      ["snubenica", "vandal"],
    ]);
    expect(state.strany[0].at(-1)).toMatchObject({ card: policajtka, playedBy: 1 });
    expect(events.some((e) => e.type === "log" && e.text.startsWith("Dohadzovačka: Policajtka"))).toBe(true);
    // Presun nie je priloženie: Policajtkin Konflikt (Dlh) sa nespustí.
    expect(state.hraci[0].priznane).toEqual(s.hraci[0].priznane);
  });

  it("na súperovej strane: O2 je súperova Žena, presunie sa môj Chlap z mojej strany", () => {
    const d = inst("dohadzovacka");
    const s = vZhromazdeni([[lezi(inst("hasic"), 0), lezi(inst("zamocnik"), 0)], [lezi(inst("svokra"), 1)]], d);
    const st = apply(data, s, { type: "place", uid: d.uid, target: "superova" }, 0).state;
    expect(ids(st)).toEqual([["hasic"], ["svokra", "dohadzovacka", "zamocnik"]]);
  });

  it("nič sa nestane: O2 nie je Občan ani Starešina, nemá pohlavie, alebo na druhej strane nie je vhodný O1", () => {
    const pes = presunDohadzovackou(data, [[lezi(inst("pes"), 0), lezi(inst("dohadzovacka"), 0)], [lezi(inst("svokra"), 1)]] as const, 0, -1);
    expect(pes.presunuta).toBeNull();
    const d = inst("dohadzovacka");
    expect(presunDohadzovackou(data, [[lezi(inst("pes"), 0), lezi(d, 0)], [lezi(inst("svokra"), 1)]], 0, d.uid).presunuta).toBeNull();
    const d2 = inst("dohadzovacka");
    expect(presunDohadzovackou(data, [[lezi(inst("pijan"), 0), lezi(d2, 0)], [lezi(inst("vandal"), 1)]], 0, d2.uid).presunuta).toBeNull();
    // Prvá karta pri lokalite nemá vnútorného suseda.
    const d3 = inst("dohadzovacka");
    expect(presunDohadzovackou(data, [[lezi(d3, 0)], [lezi(inst("svokra"), 1)]], 0, d3.uid).presunuta).toBeNull();
  });

  it("skrytá Záverečná sa nepresúva — presunie sa najvzdialenejší z ostatných; karta s oboma tagmi sa ráta ako oboje", () => {
    const d = inst("dohadzovacka");
    const r = presunDohadzovackou(
      data,
      [[lezi(inst("pijan"), 0), lezi(d, 0)], [lezi(inst("svokra"), 1), lezi(inst("policajtka"), 1, { zaverecna: true })]],
      0,
      d.uid,
    );
    expect(r.presunuta?.card.defId).toBe("svokra");
    expect(ids(r).map((x) => x.length)).toEqual([3, 1]);
    // Liberál (Žena aj Chlap) ako O2 hľadá oboje; ako O1 sa hodí k Žene aj k Chlapovi.
    const d2 = inst("dohadzovacka");
    expect(presunDohadzovackou(data, [[lezi(inst("liberal"), 0), lezi(d2, 0)], [lezi(inst("vandal"), 1)]], 0, d2.uid).presunuta?.card.defId).toBe("vandal");
    const d3 = inst("dohadzovacka");
    expect(presunDohadzovackou(data, [[lezi(inst("pijan"), 0), lezi(d3, 0)], [lezi(inst("liberal"), 1)]], 0, d3.uid).presunuta?.card.defId).toBe("liberal");
  });

  it("náhľad a bot (sPrilozenou) ukážu ten istý presun ako motor", () => {
    const d = inst("dohadzovacka");
    const s = vZhromazdeni([[lezi(inst("pijan"), 0)], [lezi(inst("snubenica"), 1), lezi(inst("policajtka"), 1)]], d);
    expect(ids(sPrilozenou(data, s, 0, d, 0))).toEqual(ids(apply(data, s, { type: "place", uid: d.uid, target: "vlastna" }, 0).state));
  });
});

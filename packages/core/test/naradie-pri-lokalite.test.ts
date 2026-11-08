// Pravidlá v10.2 (Michal 2026-11-01): „Vedľa lokality sa nedá umiestniť náradie.“
// Nástroj sa nevyloží na prázdnu stranu — ani na svoju, ani na súperovu; server
// zámer zamietne, legalCommands a plán ťahu ho neponúknu. Dedičstvo ostáva.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import predFrakciamiJson from "./data/cards-pred-frakciami.json";
import type { CardInstance, GameState, PlacedCard, PlayerId } from "../src/index.ts";
import { NASTROJ_PRI_LOKALITE, apply, cieleOdpovede, legalCommands, loadGameData, planVykladania, setupGame } from "../src/index.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);
const stara = loadGameData(predFrakciamiJson, eldersJson, scorecardsJson);

let uidSeq = 990000;
const inst = (defId: string): CardInstance => ({ uid: ++uidSeq, defId, leftLayout: 0, rightLayout: 0 });
const lezi = (defId: string, playedBy: PlayerId): PlacedCard => ({ card: inst(defId), playedBy });

/** Zhromaždenie na Zastávke, hráč 0 na ťahu s rukou `ruka`, limit 3, dosť cigariet a poldeci. */
function vZhromazdeni(strany: GameState["strany"], ruka: CardInstance[]): GameState {
  const s0 = setupGame(data, 7);
  const lokalita = s0.lokalityVHre.find((k) => k.defId === "zastavka")!;
  const hraci = s0.hraci.map((h, i) => ({
    ...h,
    cigarety: 5,
    poldeciPlne: 2,
    doberaci: [inst("masiar"), inst("vandal"), inst("hasic")],
    ...(i === 0 ? { ruka } : {}),
  })) as unknown as GameState["hraci"];
  return {
    ...s0,
    hraci,
    faza: "zhromazdenie",
    utocnik: 0,
    ciel: { typ: "lokalita", lokalita },
    lokalityVHre: s0.lokalityVHre.filter((k) => k !== lokalita),
    strany,
    pitkaStav: null,
    pitkaCislo: 0,
    zhromazdenieStav: { naTahu: 0, zostavaLimit: [3, 3], pasoval: [false, false], navyse: [0, 0] },
  };
}

const ciele = (s: GameState, uid: number): string[] =>
  legalCommands(data, s, 0).flatMap((c) => (c.type === "place" && c.uid === uid ? [c.target] : []));

describe("Nástroj vedľa lokality (v10.2)", () => {
  it("na prázdnu stranu sa nevyloží — ani na svoju, ani na súperovu; Dedičstvo áno", () => {
    const noviny = inst("noviny");
    const s = vZhromazdeni([[], []], [noviny]);
    expect(ciele(s, noviny.uid)).toEqual(["dedicstvo"]);
    for (const target of ["vlastna", "superova"] as const) {
      expect(() => apply(data, s, { type: "place", uid: noviny.uid, target }, 0)).toThrow(NASTROJ_PRI_LOKALITE);
      expect(() => apply(data, s, { type: "zaverecna", uid: noviny.uid, target }, 0)).toThrow(NASTROJ_PRI_LOKALITE);
    }
    const d = apply(data, s, { type: "place", uid: noviny.uid, target: "dedicstvo" }, 0).state;
    expect(d.hraci[0].dedicstvo.map((k) => k.uid)).toEqual([noviny.uid]);
  });

  it("za Občanom na ktorejkoľvek strane áno", () => {
    const noviny = inst("noviny");
    const s = vZhromazdeni([[lezi("pijan", 0)], [lezi("masiar", 1)]], [noviny]);
    expect(ciele(s, noviny.uid)).toEqual(["vlastna", "superova", "dedicstvo"]);
    const v = apply(data, s, { type: "place", uid: noviny.uid, target: "superova" }, 0).state;
    expect(v.strany[1].map((pl) => pl.card.uid).at(-1)).toBe(noviny.uid);
    // Len jedna strana obsadená — druhá ostáva zavretá.
    const jedna = vZhromazdeni([[], [lezi("masiar", 1)]], [noviny]);
    expect(ciele(jedna, noviny.uid)).toEqual(["superova", "dedicstvo"]);
  });

  it("ťah s viacerými kartami: Nástroj smie až za kartu vyloženú v tom istom ťahu", () => {
    const pijan = inst("pijan");
    const noviny = inst("noviny");
    const s = vZhromazdeni([[], []], [pijan, noviny]);
    const dobre = planVykladania(data, s, 0, 3, [
      { karta: pijan, ciel: "vlastna" },
      { karta: noviny, ciel: "vlastna" },
    ]);
    expect(dobre.chyba).toBeNull();
    const po = apply(data, s, { type: "tah", kroky: dobre.kroky }, 0).state;
    expect(po.strany[0].map((pl) => pl.card.uid)).toEqual([pijan.uid, noviny.uid]);

    expect(planVykladania(data, s, 0, 3, [{ karta: pijan, ciel: "vlastna" }, { karta: noviny, ciel: "superova" }]).chyba).toBe(NASTROJ_PRI_LOKALITE);
    expect(planVykladania(data, s, 0, 3, [{ karta: noviny, ciel: "vlastna" }, { karta: pijan, ciel: "vlastna" }]).chyba).toBe(NASTROJ_PRI_LOKALITE);
  });

  it("Živnostník pri lokalite: Nástroj za neho áno (neleží už pri lokalite)", () => {
    // Živnostník s Nástupom je zo sady pred frakciami (2026-11-08); jadro ho drží pre staré sady.
    const data = stara;
    const ziv = inst("zivnostnik");
    const pasca = inst("pasca");
    const s = vZhromazdeni([[], []], [ziv, pasca]);
    const pz = apply(data, s, { type: "place", uid: ziv.uid, target: "superova" }, 0).state;
    expect(legalCommands(data, pz, 0)).toContainEqual({ type: "nastroj", uid: pasca.uid });
    const pn = apply(data, pz, { type: "nastroj", uid: pasca.uid }, 0).state;
    expect(pn.strany[1].map((pl) => pl.card.uid)).toEqual([ziv.uid, pasca.uid]);
  });

  it("odpoveď na NA EX: Nástroj nie na prázdnu stranu", () => {
    const noviny = inst("noviny");
    const s = { ...vZhromazdeni([[lezi("pijan", 0)], []], [noviny]), faza: "pitka" } as GameState;
    expect(cieleOdpovede(data, s, 0, noviny)).toEqual(["vlastna"]);
  });

  it("Nástroj, ku ktorému sa lokalita dostane neskôr, ostáva ležať", () => {
    // Pravidlo je len o vykladaní — línia s Nástrojom pri lokalite je platná a hrá sa ďalej.
    const pijan = inst("pijan");
    const s = vZhromazdeni([[lezi("noviny", 0)], []], [pijan]);
    const po = apply(data, s, { type: "place", uid: pijan.uid, target: "vlastna" }, 0).state;
    expect(po.strany[0].map((pl) => pl.card.defId)).toEqual(["noviny", "pijan"]);
  });
});

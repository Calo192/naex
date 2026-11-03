// Konflikt oboma smermi a Podpora (v11.3, Michal 2026-11-03): Konflikt sa spustí, keď sa karta
// priložením ocitne vedľa súperovej karty — je jedno, ktorá z nich sa prikladala. Podpora je
// zrkadlo pre dve karty toho istého hráča; Snúbenica cez ňu vráti súperovo NA EX z vlastného Chlapa.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { CardInstance, GameData, GameState, PlacedCard, PlayerId } from "../src/index.ts";
import { KONSTANTY, apply, buildGameData, loadGameData, parseScorecards, sPrilozenou, setupGame, spustiSpoj } from "../src/index.ts";
import { EMPTY, instanceFor, makeDef } from "./helpers.ts";

const zaklad = loadGameData(cardsJson, eldersJson, scorecardsJson);
const defs = [
  makeDef("snubenica", EMPTY, EMPTY, { tags: ["Občan", "Žena"], triggers: ["Podpora"] }),
  makeDef("velmi_smutiaca_vdova", EMPTY, EMPTY, { tags: ["Občan", "Žena"], triggers: ["Konflikt"] }),
  makeDef("p_chlap", EMPTY, EMPTY, { tags: ["Občan", "Chlap"] }),
  makeDef("p_zena", EMPTY, EMPTY, { tags: ["Občan", "Žena"] }),
  makeDef("p_nastroj", EMPTY, EMPTY, { tags: ["Nástroj"] }),
];
const data: GameData = buildGameData(new Map([...zaklad.cards, ...defs.map((d) => [d.id, d] as const)]), zaklad.elders, {
  scorecards: zaklad.scorecards,
  body: parseScorecards(scorecardsJson).body,
});
const karta = (id: string): CardInstance => instanceFor(data, id, EMPTY, EMPTY);
const lezi = (card: CardInstance, playedBy: PlayerId, x: Partial<PlacedCard> = {}): PlacedCard => ({ card, playedBy, ...x });

/** Zhromaždenie, hráč 0 na ťahu s `ruka`; `strana0` leží na jeho strane. */
function zhromazdenie(strana0: PlacedCard[], ruka: CardInstance[]): GameState {
  const s0 = setupGame(data, 7);
  const lokalita = s0.lokalityVHre.find((k) => k.defId === "zastavka")!;
  return {
    ...s0,
    hraci: [{ ...s0.hraci[0], ruka }, s0.hraci[1]] as unknown as GameState["hraci"],
    faza: "zhromazdenie",
    utocnik: 0,
    ciel: { typ: "lokalita", lokalita },
    lokalityVHre: s0.lokalityVHre.filter((k) => k !== lokalita),
    strany: [strana0, []],
    pitkyCelkom: 1,
    pitkaCislo: 0,
    pitkaStav: null,
    zhromazdenieStav: { naTahu: 0, zostavaLimit: [3, 3], pasoval: [false, false], navyse: [0, 0] },
  };
}
const priloz = (s: GameState, uid: number): GameState => apply(data, s, { type: "place", uid, target: "vlastna" }, 0).state;
const naKarte = (s: GameState, uid: number): PlacedCard => s.strany.flat().find((pl) => pl.card.uid === uid)!;

describe("spustiSpoj (v11.3)", () => {
  it("Konflikt len medzi kartami rôznych hráčov, Podpora len medzi vlastnými; s Nástrojom ani so skrytou nič", () => {
    const vdova = lezi(karta("velmi_smutiaca_vdova"), 0);
    const snub = lezi(karta("snubenica"), 0);
    const cudzi = lezi(karta("p_chlap"), 1);
    const moj = lezi(karta("p_chlap"), 0);
    expect(spustiSpoj(data, "Konflikt", vdova, cudzi)).toBe(true);
    expect(spustiSpoj(data, "Konflikt", vdova, moj)).toBe(false);
    expect(spustiSpoj(data, "Podpora", snub, moj)).toBe(true);
    expect(spustiSpoj(data, "Podpora", snub, cudzi)).toBe(false);
    expect(spustiSpoj(data, "Podpora", snub, lezi(karta("p_nastroj"), 0))).toBe(false);
    expect(spustiSpoj(data, "Konflikt", vdova, lezi(karta("p_nastroj"), 1))).toBe(false);
    expect(spustiSpoj(data, "Podpora", snub, { ...moj, zaverecna: true })).toBe(false);
  });
});

describe("Snúbenica (Podpora, v11.3)", () => {
  it("priložená k vlastnému Chlapovi so súperovým NA EX — NA EX zíde, súperov poldeci sa vráti vypitý", () => {
    const chlap = lezi(karta("p_chlap"), 0, { naexBy: 1 });
    const snub = karta("snubenica");
    const s = zhromazdenie([chlap], [snub]);
    const po = priloz(s, snub.uid);
    expect(naKarte(po, chlap.card.uid).naexBy).toBeUndefined();
    expect(po.hraci[1].poldeciVypite).toBe(s.hraci[1].poldeciVypite + 1);
    expect(po.hraci[1].nerestiTotoKolo).toBe(s.hraci[1].nerestiTotoKolo + KONSTANTY.NEREST_NAEX);
  });

  it("nič: Chlap bez NA EX, vlastné NA EX, Žena so súperovým NA EX, súperov Chlap (to by bol Konflikt)", () => {
    for (const [pl, ocakavane] of [
      [lezi(karta("p_chlap"), 0), undefined],
      [lezi(karta("p_chlap"), 0, { naexBy: 0 }), 0],
      [lezi(karta("p_zena"), 0, { naexBy: 1 }), 1],
      [lezi(karta("p_chlap"), 1, { naexBy: 0 }), 0],
    ] as const) {
      const snub = karta("snubenica");
      const po = priloz(zhromazdenie([pl], [snub]), snub.uid);
      expect(naKarte(po, pl.card.uid).naexBy).toBe(ocakavane);
    }
  });

  it("Výtržník (zrážka): zíde len súperovo NA EX, vlastné ostane a karta vytriezvie", () => {
    const chlap = lezi(karta("p_chlap"), 0, { naexBy: 1, naexBy2: 0, vytrznik: true });
    const snub = karta("snubenica");
    const po = priloz(zhromazdenie([chlap], [snub]), snub.uid);
    const pl = naKarte(po, chlap.card.uid);
    expect([pl.naexBy, pl.naexBy2, pl.vytrznik]).toEqual([0, undefined, undefined]);
  });

  it("náhľad (sPrilozenou) vidí NA EX zísť ako motor", () => {
    const chlap = lezi(karta("p_chlap"), 0, { naexBy: 1 });
    const snub = karta("snubenica");
    const s = zhromazdenie([chlap], [snub]);
    const nahlad = sPrilozenou(data, s, 0, snub, 0);
    expect(naKarte(nahlad, chlap.card.uid).naexBy).toBeUndefined();
  });
});

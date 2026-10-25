// Pravidlá v5 (docs/pravidla-v5/davka.md): zmeny jadra po etapách — Cirhóza
// po bitke, Pohoršenie oboma smermi, scorecardy a bodovanie v5, priazne v5.
// Očakávané hodnoty sú z dávky, nie z kódu.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { BitkaStav, CardInstance, GameState, PlayerId, PlayerState } from "../src/index.ts";
import { apply, loadGameData, setupGame, viewFor } from "../src/index.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

let uidSeq = 990000;
const inst = (defId: string): CardInstance => ({ uid: ++uidSeq, defId, leftLayout: 0, rightLayout: 0 });
const kusy = (n: number, defId: string): CardInstance[] => Array.from({ length: n }, () => inst(defId));

function sHracom(s: GameState, p: PlayerId, h: Partial<PlayerState>): GameState {
  const hraci = [...s.hraci] as [PlayerState, PlayerState];
  hraci[p] = { ...hraci[p], ...h };
  return { ...s, hraci };
}

function bitka(b: Partial<BitkaStav>): BitkaStav {
  return {
    krok: null,
    caka: null,
    sums: [{}, {}],
    exekutorHotovy: [true, true],
    pohorsenieZostava: [0, 0],
    pohorsenieHranice: {},
    damage: null,
    vitaz: 0,
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

/** Bitka v kroku Pohrebu, čaká sa na hráča 0 — skipPohreb ju dokončí a začne ďalšie kolo. */
function predKoncomBitky(seed: number, uprav: (s: GameState) => GameState = (s) => s): GameState {
  const s0 = setupGame(data, seed);
  return uprav({
    ...s0,
    faza: "bitka",
    kolo: 2,
    strany: [[], []],
    ciel: { typ: "lokalita", lokalita: s0.lokalityVHre[0]! },
    lokalityVHre: s0.lokalityVHre.slice(1),
    bitkaStav: bitka({ krok: "pohreb", caka: 0, pohrebHotovy: [false, true] }),
  });
}

describe("v5 bod 8: nepriznaná Cirhóza po bitke do odhadzovacieho balíčka", () => {
  it("Cirhóza z ruky ide po bitke do odhadzovacieho balíčka, priznaná ostáva priznaná", () => {
    const vRuke = inst("cirhoza");
    const priznana = inst("cirhoza");
    const s = predKoncomBitky(61, (x) =>
      sHracom(x, 0, { ruka: [vRuke, ...kusy(2, "pijan")], doberaci: kusy(4, "pijan"), odhadzovaci: [], priznane: [priznana] }),
    );
    const po = apply(data, s, { type: "skipPohreb" }, 0).state;
    expect(po.koniec).toBeNull();
    expect(po.hraci[0].ruka.some((k) => k.uid === vRuke.uid)).toBe(false);
    expect(po.hraci[0].odhadzovaci.map((k) => k.uid)).toContain(vRuke.uid);
    expect(po.hraci[0].priznane.map((k) => k.uid)).toEqual([priznana.uid]);
  });

  it("Cirhóza dobratá až po bitke (2 karty po bitke) ostáva v ruke — rozhodne o nej v ďalšom kole", () => {
    const navrchu = inst("cirhoza");
    const s = predKoncomBitky(62, (x) => sHracom(x, 0, { ruka: kusy(2, "pijan"), doberaci: [navrchu, ...kusy(3, "pijan")], odhadzovaci: [] }));
    const po = apply(data, s, { type: "skipPohreb" }, 0).state;
    expect(po.hraci[0].ruka.map((k) => k.uid)).toContain(navrchu.uid);
  });

  it("odhodená Cirhóza je verejná (odhadzovací balíček), súper nevidí nič navyše z ruky", () => {
    const vRuke = inst("cirhoza");
    const s = predKoncomBitky(63, (x) => sHracom(x, 0, { ruka: [vRuke, inst("pijan")], doberaci: kusy(4, "pijan"), odhadzovaci: [] }));
    const po = apply(data, s, { type: "skipPohreb" }, 0).state;
    const pohlad = viewFor(data, po, 1);
    expect(pohlad.hraci[0].odhadzovaci.map((k) => k.uid)).toContain(vRuke.uid);
    // Karty, ktoré si hráč 0 dobral po bitke, súper nevidí.
    for (const k of po.hraci[0].ruka) expect(JSON.stringify(pohlad)).not.toContain(`"uid":${k.uid},`);
  });
});

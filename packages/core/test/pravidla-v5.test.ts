// Pravidlá v5 (docs/pravidla-v5/davka.md): zmeny jadra po etapách — Cirhóza
// po bitke, Pohoršenie oboma smermi, scorecardy a bodovanie v5, priazne v5.
// Očakávané hodnoty sú z dávky, nie z kódu.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { BitkaStav, CardInstance, ElderState, GameState, PlayerId, PlayerState } from "../src/index.ts";
import { IllegalCommandError, apply, legalCommands, loadGameData, pohorsenieMozne, setupGame, viewFor } from "../src/index.ts";

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

describe("v5 bod 7: Pohoršenie oboma smermi", () => {
  /** Bitka v kroku Pohoršenia, hráč 0 má `n` Pohoršení, línia prázdna. */
  function vPohorseni(seed: number, uprav: (s: GameState) => GameState = (s) => s, n = 1): GameState {
    const s0 = setupGame(data, seed);
    return uprav({
      ...s0,
      faza: "bitka",
      kolo: 2,
      utocnik: 1,
      strany: [[], []],
      ciel: { typ: "lokalita", lokalita: s0.lokalityVHre[0]! },
      lokalityVHre: s0.lokalityVHre.slice(1),
      bitkaStav: bitka({ krok: "pohorsenie", caka: 0, vitaz: null, pohorsenieZostava: [n, 0], pohrebHotovy: [false, false], karHotovy: [true, true], vesticaHotova: false }),
    });
  }
  const sMarkerom = (s: GameState, elderId: string, marker: ElderState["marker"]): GameState => ({
    ...s,
    starsi: s.starsi.map((e) => (e.elderId === elderId ? { ...e, marker, markerZaciatokKola: marker } : e)),
  });
  const bitkarId = (s: GameState): string => s.starsi.find((e) => data.scorecards.find((x) => x.id === e.scorecard)?.favour === "BITKAR")!.elderId;

  it("legálne sú oba smery; k sebe posunie marker k hráčovi a priazeň platí už v poškodení tejto bitky", () => {
    const s = vPohorseni(71);
    const id = bitkarId(s);
    const st = sMarkerom(s, id, 3);
    const legal = legalCommands(data, st, 0);
    expect(legal).toContainEqual({ type: "pohorsenie", elderId: id });
    expect(legal).toContainEqual({ type: "pohorsenie", elderId: id, kSebe: true });
    const kSebe = apply(data, st, { type: "pohorsenie", elderId: id, kSebe: true }, 0).state;
    expect(kSebe.starsi.find((e) => e.elderId === id)?.marker).toBe(2);
    // Bitkár na strane hráča 0 (sila 1) mu dal tuhé navyše už v tejto bitke — prázdna línia, inak 0 : 0.
    expect(kSebe.bitkaStav?.damage?.tuhe[0]).toBeGreaterThan(0);
    expect(kSebe.bitkaStav?.vitaz).toBe(0);
    const kSuperovi = apply(data, st, { type: "pohorsenie", elderId: id }, 0);
    expect(kSuperovi.state.starsi.find((e) => e.elderId === id)?.marker).toBe(4);
    const vysledok = kSuperovi.events.find((e) => e.type === "bitkaVysledok");
    expect(vysledok?.type === "bitkaVysledok" ? vysledok.damage.tuhe[0] : -1).toBe(0);
  });

  it("na krajnú pozíciu nesmie ani k sebe", () => {
    const s = vPohorseni(72);
    const id = s.starsi[0]!.elderId;
    const st = sMarkerom(s, id, 1);
    expect(pohorsenieMozne(st, 0, st.starsi[0]!, true)).toBe(false);
    expect(() => apply(data, st, { type: "pohorsenie", elderId: id, kSebe: true }, 0)).toThrow(IllegalCommandError);
    // Hráč 1 k sebe z pozície 7 tiež nie (8 je krajná).
    expect(pohorsenieMozne(sMarkerom(s, id, 7), 1, { ...st.starsi[0]!, marker: 7, markerZaciatokKola: 7 }, true)).toBe(false);
  });

  it("limit dvoch hraníc zón je spoločný pre oba smery", () => {
    const s = vPohorseni(73, (x) => x, 6);
    const id = s.starsi[0]!.elderId;
    let st = sMarkerom(s, id, 4);
    st = apply(data, st, { type: "pohorsenie", elderId: id, kSebe: true }, 0).state; // 4 → 3, bez hranice
    st = apply(data, st, { type: "pohorsenie", elderId: id, kSebe: true }, 0).state; // 3 → 2, hranica 1
    st = apply(data, st, { type: "pohorsenie", elderId: id }, 0).state; // 2 → 3, hranica 2
    st = apply(data, st, { type: "pohorsenie", elderId: id }, 0).state; // 3 → 4
    st = apply(data, st, { type: "pohorsenie", elderId: id }, 0).state; // 4 → 5
    const e = st.starsi.find((x) => x.elderId === id)!;
    expect(e.marker).toBe(5);
    expect(st.bitkaStav?.pohorsenieHranice[`0:${id}`]).toBe(2);
    // 5 → 6 by bola tretia hranica.
    expect(pohorsenieMozne(st, 0, e)).toBe(false);
    expect(pohorsenieMozne(st, 0, e, true)).toBe(true);
  });
});

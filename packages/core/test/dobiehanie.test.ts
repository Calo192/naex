// Zmeny Michala 2026-10-16 po playteste 20261016-134912 („snehová guľa“):
// silnejšia priazeň, Cigareta dáva fyzické cigarety, fajčenie kedykoľvek,
// ohlásené vydesenie a oprava ceny prebytku pri Miňištrantovi.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { BitkaStav, CardInstance, ElderState, Event, GameState, MarkerPos, PlayerId } from "../src/index.ts";
import { apply, evaluateLine, legalCommands, loadGameData, naTahu, priazen, setupGame, viewFor } from "../src/index.ts";
import { setupSBalickom } from "./helpers.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

let uidSeq = 90000;
const inst = (defId: string, leftLayout = 0, rightLayout = 0): CardInstance => ({ uid: ++uidSeq, defId, leftLayout, rightLayout });

function bitka(b: Partial<BitkaStav>): BitkaStav {
  return {
    krok: null,
    caka: null,
    sums: [{}, {}],
    exekutorHotovy: [true, true],
    pohorsenieZostava: [0, 0],
    exekutor: [0, 0],
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

const sMarkerom = (e: ElderState, marker: MarkerPos): ElderState => ({ ...e, marker});

describe("priazeň: sila 1 / 2 / 3 a dvojnásobný účinok", () => {
  it("bonus = 2 × sila podľa zóny na polovici hráča", () => {
    const s0 = setupSBalickom(data, 3);
    const e0 = s0.starsi[0]!;
    const favour = data.scorecards.find((sc) => sc.id === e0.scorecard)!.favour;
    const s = (m: MarkerPos): GameState => ({ ...s0, starsi: [sMarkerom(e0, m), ...s0.starsi.slice(1)] });
    expect([4, 5, 6].map((m) => priazen(data, s(m as MarkerPos), favour, 1))).toEqual([2, 4, 6]);
    expect([2, 1, 0].map((m) => priazen(data, s(m as MarkerPos), favour, 0))).toEqual([2, 4, 6]);
    expect(priazen(data, s(3), favour, 0)).toBe(0);
    expect(priazen(data, s(6), favour, 0)).toBe(0);
  });
});

describe("cigarety: Cigareta ich dáva, fajčenie dáva karty", () => {
  it("v Pitke smie hráč fajčiť: karta hneď, cigareta preč, ťah mu neskončí (v5: v Zhromaždení nie)", () => {
    const s0 = setupSBalickom(data, 4);
    const s: GameState = {
      ...s0,
      faza: "pitka",
      pitkyCelkom: 1,
      pitkaCislo: 1,
      hraci: [{ ...s0.hraci[0], cigarety: 4 }, s0.hraci[1]],
      pitkaStav: { naTahu: 0, hotovy: [false, false], naexPouzity: [false, false], fajcenie: [0, 0], reakcia: null, postarka: [false, false], starosta: [false, false] },
    } as GameState;
    expect(legalCommands(data, s, 0)).toContainEqual({ type: "smoke", pocet: 1 });
    const po = apply(data, s, { type: "smoke", pocet: 1 }, 0).state;
    expect(po.hraci[0].cigarety).toBe(3);
    expect(po.hraci[0].ruka).toHaveLength(s.hraci[0].ruka.length + 1);
    expect(naTahu(po)).toBe(0);
  });

  it("karty dobraté fajčením v Pitke sú súčasť ruky — viewFor ich súperovi nepošle", () => {
    const s0 = setupSBalickom(data, 6);
    const s: GameState = {
      ...s0,
      faza: "pitka",
      pitkyCelkom: 1,
      pitkaCislo: 1,
      hraci: [{ ...s0.hraci[0], cigarety: 1 }, s0.hraci[1]],
      pitkaStav: { naTahu: 0, hotovy: [false, false], naexPouzity: [false, false], fajcenie: [0, 0], reakcia: null, postarka: [false, false], starosta: [false, false] },
    } as GameState;
    const r = apply(data, s, { type: "smoke", pocet: 1 }, 0);
    const dobrata = r.events.flatMap((e) => (e.type === "kartyTahane" ? e.karty : []));
    expect(dobrata).toHaveLength(1);
    const pohlad = JSON.stringify(viewFor(data, r.state, 1));
    expect(pohlad).not.toContain(`"uid":${dobrata[0]!.uid},`);
  });

  it("aktívne Cigaretky v Pitke pridajú cigarety (mínus súperove Obmedzenia), karty nie", () => {
    // Nájdi v tlačovej sade lokalitu a kartu, ktorej spoj s lokalitou dá hráčovi 0 Cigaretku.
    const s0 = setupSBalickom(data, 5);
    let najdene: { lok: CardInstance; karta: CardInstance; cig: number; obm: number } | null = null;
    for (const lok of s0.lokalityVHre) {
      if (lok.defId === "kostol" || lok.defId === "benzinka") continue;
      for (const def of data.cards.values()) {
        if (!def.tags.includes("Občan")) continue;
        const v = data.variants.get(def.id);
        for (let l = 0; l < (v?.left.length ?? 0) && najdene === null; l++) {
          for (let r = 0; r < (v?.right.length ?? 0) && najdene === null; r++) {
            const karta = inst(def.id, l, r);
            const ev = evaluateLine(data, { lokalita: lok, lokalitaOtocena: false, strany: [[{ card: karta, playedBy: 0 }], []] });
            const cig = ev.sums[0].Cigareta ?? 0;
            if (cig > 0) najdene = { lok, karta, cig, obm: ev.sums[1].Obmedzenie ?? 0 };
          }
        }
        if (najdene !== null) break;
      }
      if (najdene !== null) break;
    }
    expect(najdene).not.toBeNull();
    const { lok, karta, cig, obm } = najdene!;
    let s: GameState = {
      ...s0,
      faza: "pitka",
      pitkyCelkom: 2,
      pitkaCislo: 1,
      ciel: { typ: "lokalita", lokalita: lok },
      lokalitaOtocena: false,
      strany: [[{ card: karta, playedBy: 0 }], []],
      hraci: [{ ...s0.hraci[0], cigarety: 0, poldeciPlne: 0 }, { ...s0.hraci[1], cigarety: 0, poldeciPlne: 0 }],
      pitkaStav: { naTahu: 0, hotovy: [false, false], naexPouzity: [false, false], fajcenie: [0, 0], reakcia: null, postarka: [false, false], starosta: [false, false] },
    } as GameState;
    const ruka = s.hraci[0].ruka.length;
    // Po Pitke ide ďalšia alebo bitka (Pitky podľa lokality) — cigarety a karty sa čítajú z udalostí Pitky.
    const udalosti: Event[] = [];
    for (let i = 0; i < 4 && s.faza === "pitka"; i++) {
      const r = apply(data, s, { type: "skipNaex" }, s.pitkaStav!.naTahu);
      udalosti.push(...r.events);
      s = r.state;
    }
    const ziska = Math.max(0, cig - obm);
    const logy = udalosti.flatMap((e) => (e.type === "log" ? [e.text] : []));
    expect(logy.some((t) => t.startsWith(`Hráč 1 získava ${ziska} `))).toBe(ziska > 0);
    // Len Pitka — bitka, ktorá sa po poslednej Pitke dohrá sama, dá +2 karty (Michal 2026-10-19).
    const doBitky = udalosti.findIndex((e) => e.type === "faza" && e.faza === "bitka");
    const vPitke = doBitky === -1 ? udalosti : udalosti.slice(0, doBitky);
    expect(vPitke.some((e) => e.type === "kartyTahane" && e.hrac === 0)).toBe(false);
    expect(ruka).toBeGreaterThan(0);
  });
});

describe("ohlásené vydesenie", () => {
  /** Hráč 0 má 3 vydesených starších a štvrtého na hrane; prebytok 1. */
  function predVydesenim(seed: number): GameState {
    const s0 = setupSBalickom(data, seed);
    const starsi = s0.starsi.map((e, i) => (i < 3 ? sMarkerom(e, 6) : i === 3 ? sMarkerom(e, 5) : e));
    return {
      ...s0,
      faza: "bitka",
      starsi,
      ciel: { typ: "lokalita", lokalita: s0.lokalityVHre[0]! },
      bitkaStav: bitka({ krok: "prebytok", caka: 0, vitaz: 0, prebytokDrzi: 0, prebytokZostava: 1 }),
    } as GameState;
  }

  it("polovica vydesených starších hru neukončí hneď — vydesenie sa ohlási", () => {
    const s = predVydesenim(7);
    const po = apply(data, s, { type: "prebytok", elderId: s.starsi[3]!.elderId }, 0);
    expect(po.state.ohlaseneVydesenie[0]).toBe(s.kolo);
    expect(po.state.koniec).toBeNull();
    expect(po.events.some((e) => e.type === "log" && e.text.includes("Ak ich udrží do konca ďalšieho kola"))).toBe(true);
  });

  it("kto vydesenie udrží do konca nasledujúceho kola, vyhrá", () => {
    const s0 = predVydesenim(8);
    // Ohlásené už v minulom kole — na konci tohto kola rozhoduje.
    const s: GameState = { ...s0, kolo: s0.kolo + 1, ohlaseneVydesenie: [s0.kolo, null] };
    let po = apply(data, s, { type: "prebytok", elderId: s.starsi[3]!.elderId }, 0).state;
    // Zvyšok bitky (limit ruky a pod.) dohrajú hráči podľa legálnych ťahov.
    for (let i = 0; i < 20 && po.koniec === null && po.faza === "bitka"; i++) {
      const p = naTahu(po) as PlayerId;
      const c = legalCommands(data, po, p)[0];
      if (c === undefined) break;
      po = apply(data, po, c, p).state;
    }
    expect(po.koniec?.vitaz).toBe(0);
    expect(po.koniec?.dovod).toMatch(/udržal/);
  });
});


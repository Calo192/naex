// Pravidlá v11.11 „Hádka platí“ (Michal 2026-11-06): víťaz hádky dostane špaky za svoje karty,
// natáča ďalšiu lokalitu a špaky za reči uberajú zo špakov víťaza za strach. Očakávané hodnoty
// sú z pravidla, nie z kódu.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { BitkaStav, GameState, PlacedCard, PlayerId } from "../src/index.ts";
import { apply, ktoNatacaLokalitu, legalCommands, loadGameData, naTahu, setupGame, spakyOdStarsieho, tahBota } from "../src/index.ts";
import { spustBitku } from "./helpers.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

describe("§5 lokalitu natáča víťaz minulej hádky (v11.11)", () => {
  const stav = (o: Partial<GameState>): GameState => ({ ...setupGame(data, 11, { lokalit: 5 }), faza: "volbaCiela", ...o });

  it("v prvom kole a po remíze v hádke natáča obranca; po hádke jej víťaz", () => {
    expect(ktoNatacaLokalitu(stav({ utocnik: 1 }))).toBe(0);
    expect(ktoNatacaLokalitu(stav({ utocnik: 1, vitazPoslednejHadky: null }))).toBe(0);
    expect(ktoNatacaLokalitu(stav({ utocnik: 1, vitazPoslednejHadky: 1 }))).toBe(1);
    expect(ktoNatacaLokalitu(stav({ utocnik: 1, vitazPoslednejHadky: 0 }))).toBe(0);
  });

  it("natáča súper: obranca vyberá len lokalitu, potom je na ťahu víťaz hádky a až potom sa stavia šenok", () => {
    const s = stav({ utocnik: 1, vitazPoslednejHadky: 1 });
    expect(naTahu(s)).toBe(0);
    const volby = legalCommands(data, s, 0).filter((c) => c.type === "chooseLocation");
    expect(volby.length).toBeGreaterThan(0);
    expect(volby.every((c) => c.type === "chooseLocation" && !c.otocena)).toBe(true);
    const po = apply(data, s, volby[0]!, 0).state;
    expect(po.faza).toBe("natocenieCiela");
    expect(po.ciel).not.toBeNull();
    expect(naTahu(po)).toBe(1);
    expect(legalCommands(data, po, 0).filter((c) => c.type === "natocLokalitu")).toEqual([]);
    expect(legalCommands(data, po, 1).filter((c) => c.type === "natocLokalitu")).toHaveLength(2);
    for (const otocena of [true, false]) {
      const t = apply(data, po, { type: "natocLokalitu", otocena }, 1).state;
      expect(t.faza).toBe("draft");
      expect(t.lokalitaOtocena).toBe(otocena);
    }
  });

  it("natáča obranca: voľba aj natočenie sú jeden ťah, bez novej fázy", () => {
    const s = stav({ utocnik: 1, vitazPoslednejHadky: 0 });
    const uid = legalCommands(data, s, 0).find((c) => c.type === "chooseLocation");
    if (uid?.type !== "chooseLocation") throw new Error("chýba voľba");
    const t = apply(data, s, { ...uid, otocena: true }, 0).state;
    expect(t.faza).toBe("draft");
    expect(t.lokalitaOtocena).toBe(true);
  });

  it("boti dohrajú partie a natáčanie v nich naozaj nastane", () => {
    let natoceni = 0;
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      let s = setupGame(data, seed, { lokalit: 3 });
      for (let krok = 0; s.koniec === null && krok < 6000; krok++) {
        const p = ([0, 1] as const).find((q) => legalCommands(data, s, q).some((c) => c.type !== "vzdat"));
        if (p === undefined) break;
        if (s.faza === "natocenieCiela") natoceni++;
        const cmd = tahBota(data, s, p, krok, { vzorky: 1 });
        s = apply(data, s, cmd, p).state;
      }
      expect(s.koniec).not.toBeNull();
    }
    expect(natoceni).toBeGreaterThan(0);
  }, 120_000);
});

describe("§9.4 víťaz hádky dostane špaky za svoje karty (v11.11)", () => {
  /** Stav tesne pred bitkou: hráč 0 má 3 karty v línii, hráč 1 dve (jedna leží na súperovej strane). */
  function pred(tuhe: readonly [number, number], hadka: PlayerId | null, lokalitaId?: string): GameState {
    const s0 = setupGame(data, 11, { lokalit: 5 });
    const karty = s0.hraci[0].ruka;
    const polozena = (i: number, playedBy: PlayerId): PlacedCard => ({ card: { ...karty[i % karty.length]!, uid: 9000 + i }, playedBy } as PlacedCard);
    const lokalita = lokalitaId === undefined ? s0.lokalityVHre[0]! : (s0.lokalityVHre.find((k) => k.defId === lokalitaId) ?? { ...s0.lokalityVHre[0]!, defId: lokalitaId });
    const makke: [number, number] = hadka === null ? [0, 0] : hadka === 0 ? [2, 0] : [0, 2];
    const b = {
      krok: "hadka",
      caka: null,
      sums: [{ Rana: tuhe[0] }, { Rana: tuhe[1] }],
      exekutorHotovy: [false, false],
      exekutor: [0, 0],
      hadka: { makke, vitaz: hadka, velkost: hadka === null ? 0 : 2, zostava: hadka === null ? 0 : 2, prepadlo: 0, zdvihy: [] },
      damage: null,
      vitaz: null,
      prebytokDrzi: null,
      prebytokZostava: 0,
      prebytokZdvihy: [],
      prebytokPrepadlo: 0,
      spalit: [],
      vesticaHotova: true,
    } as unknown as BitkaStav;
    return {
      ...s0,
      faza: "bitka",
      draftStav: null,
      kolo: 2,
      utocnik: 1,
      ciel: { typ: "lokalita", lokalita },
      strany: [[polozena(0, 0), polozena(1, 0), polozena(2, 1)], [polozena(3, 1), polozena(4, 0)]],
      bitkaStav: b,
      spaky: [0, 0],
    };
  }

  const za = (s: GameState): readonly [number, number] => spustBitku(data, s).state.nastenka.at(-1)!.zaBitku;

  it("víťaz hádky, ktorý prehral bitku: 1 špak za každú svoju kartu; víťaz bitky za všetky", () => {
    // Hráč 1 prehrá bitku, vyhrá hádku: 2 jeho karty v línii (jedna na súperovej strane).
    expect(za(pred([3, 0], 1))).toEqual([5, 2]);
  });

  it("víťaz bitky aj hádky: len za všetky karty, navyše nič", () => {
    expect(za(pred([3, 0], 0))).toEqual([5, 0]);
  });

  it("hádka remíza: porazený nič", () => {
    expect(za(pred([3, 0], null))).toEqual([5, 0]);
  });

  it("sekera: víťaz hádky dostane za svoje karty hneď, všetky karty ďalej čakajú na sekere", () => {
    const s = pred([2, 2], 1);
    const po = spustBitku(data, s).state;
    expect(po.nastenka.at(-1)!.vitaz).toBeNull();
    expect(po.nastenka.at(-1)!.zaBitku).toEqual([0, 2]);
    expect(po.spakyNaSekere).toBe(5);
  });

  it("Kultúrny dom (v11.13): každý len za svoje karty, výhra hádky nepridá druhýkrát", () => {
    // Hráč 0 má v línii 3 karty, hráč 1 dve.
    expect(za(pred([3, 0], 1, "kulturny_dom"))).toEqual([3, 2]);
    expect(za(pred([3, 0], 0, "kulturny_dom"))).toEqual([3, 2]);
  });

});

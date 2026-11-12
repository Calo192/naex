// v11.9 (Michal 2026-11-06, docs/napady/agresivna-hra.html): výpalné hneď po bitke, aby cigarety
// boli pripravené na šenok. Dobratie do 3 kariet z v11.9 nahradili od v11.21 presne 2 karty po bitke.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { GameState, Miesto, PlayerId } from "../src/index.ts";
import { KONSTANTY, apply, cervenychHraca, loadGameData, miestaHry, miestoNaTahu, mozeHrat, poradieVykladania, rukaMiesta, setupGame, tahBotaPata, timMiesta } from "../src/index.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

function predKoncomBitky(uprav: (s: GameState) => GameState, vitaz: PlayerId | null = 0, finale = false): GameState {
  const s0 = setupGame(data, 77);
  const zaklad: GameState = {
    ...s0,
    faza: "bitka",
    kolo: 2,
    strany: [[], []],
    ciel: { typ: finale ? "finale" : "lokalita", lokalita: s0.lokalityVHre[0]! },
    lokalityVHre: s0.lokalityVHre.slice(1),
    bitkaStav: {
      krok: "cintorin",
      caka: 0,
      sums: [{}, {}],
      exekutorHotovy: [true, true],
      exekutor: [0, 0],
      damage: null,
      vitaz,
      prebytokDrzi: null,
      prebytokZostava: 0,
      prebytokZdvihy: [],
      prebytokPrepadlo: 0,
      vesticaHotova: true,
      spalit: [],
    } as unknown as GameState["bitkaStav"],
  };
  return uprav(zaklad);
}

function sCigaretami(s: GameState, cigarety: readonly [number, number]): GameState {
  return {
    ...s,
    hraci: [
      { ...s.hraci[0], cigarety: cigarety[0] },
      { ...s.hraci[1], cigarety: cigarety[1] },
    ],
  };
}

/** Prvých `pocet` starších má červený strach hráča p. */
function sCervenymi(s: GameState, p: PlayerId, pocet: number): GameState {
  return {
    ...s,
    starsi: s.starsi.map((e, i) => {
      if (i >= pocet) return e;
      const strach: [number, number] = [e.strach[0], e.strach[1]];
      strach[p] = 3;
      return { ...e, strach };
    }) as GameState["starsi"],
  };
}

const poBitke = (s: GameState): GameState => apply(data, s, { type: "cintorin", uid: null }, s.bitkaStav?.vitaz === 1 ? 1 : 0).state;

function sRukou(s: GameState, p: PlayerId, ruka: number): GameState {
  const h = s.hraci[p];
  const vsetky = [...h.ruka, ...h.doberaci, ...h.odhadzovaci];
  const karty = Array.from({ length: Math.max(8, ruka + 4) }, (_, i) => vsetky[i % vsetky.length]!).map((k, i) => ({ ...k, uid: 90000 + p * 1000 + i }));
  const novy = { ...h, ruka: karty.slice(0, ruka), doberaci: karty.slice(ruka), odhadzovaci: [] };
  return { ...s, hraci: p === 0 ? [novy, s.hraci[1]] : [s.hraci[0], novy] };
}

/** Ľubovoľná príprava (2 na 2, Päta) v rovnakom konci bitky ako predKoncomBitky. */
function doKoncaBitky(s0: GameState): GameState {
  const z = predKoncomBitky((s) => s);
  return { ...s0, faza: z.faza, kolo: z.kolo, strany: [[], []], ciel: { typ: "lokalita", lokalita: s0.lokalityVHre[0]! }, lokalityVHre: s0.lokalityVHre.slice(1), bitkaStav: z.bitkaStav };
}

describe("dobratie 2 karty po bitke (v11.21, §4)", () => {
  it.each([
    [0, 2],
    [1, 3],
    [2, 4],
    [3, 5],
    [5, 7],
    [7, 9],
  ])("s %i kartami v ruke začne ďalšie kolo s %i", (ruka, cakana) => {
    const po = poBitke(predKoncomBitky((s) => sRukou(s, 0, ruka)));
    expect(po.faza).toBe("volbaCiela");
    expect(po.hraci[0].ruka).toHaveLength(cakana);
  });

  it("s 1 kartou v balíčkoch dostane len ju; z prázdnych sa nedoberá a hra beží ďalej", () => {
    const jedna = sRukou(predKoncomBitky((s) => s), 0, 0).hraci[0].doberaci[0]!;
    const po1 = poBitke(predKoncomBitky((s) => ({ ...s, hraci: [{ ...s.hraci[0], ruka: [], doberaci: [], odhadzovaci: [jedna] }, s.hraci[1]] })));
    expect(po1.hraci[0].ruka.map((k) => k.uid)).toEqual([jedna.uid]);
    const po0 = poBitke(predKoncomBitky((s) => ({ ...s, hraci: [{ ...s.hraci[0], ruka: [], doberaci: [], odhadzovaci: [] }, s.hraci[1]] })));
    expect(po0.faza).toBe("volbaCiela");
    expect(po0.hraci[0].ruka).toHaveLength(0);
  });

  it("2 na 2: každý člen 2 karty do svojej ruky z balíčka tímu, v poradí U1 → O1 → U2 → O2", () => {
    const s1 = doKoncaBitky(setupGame(data, 77, { format: "2na2" }));
    // Tím 0 má v balíčku len 3 karty: jeho prvý člen v poradí dostane 2, druhý 1.
    const tri = sRukou(s1, 0, 0).hraci[0].doberaci.slice(0, 3);
    const s: GameState = {
      ...s1,
      hraci: [
        { ...s1.hraci[0], doberaci: tri, odhadzovaci: [] },
        { ...s1.hraci[1], doberaci: sRukou(s1, 1, 0).hraci[1].doberaci, odhadzovaci: [] },
      ],
    };
    const pred = miestaHry(s).map((m) => rukaMiesta(s, m).length);
    const po = apply(data, s, { type: "cintorin", uid: null }, miestoNaTahu(s)!).state;
    expect(po.faza).toBe("volbaCiela");
    const pribudlo = (m: Miesto): number => rukaMiesta(po, m).length - pred[m]!;
    expect(poradieVykladania(po).filter((m) => timMiesta(m) === 0).map(pribudlo)).toEqual([2, 1]);
    for (const m of miestaHry(po).filter((q) => timMiesta(q) === 1)) expect(pribudlo(m)).toBe(KONSTANTY.DOBRATIE_PO_BITKE);
  });

  it("Päta, Lakeť, Otočka: rovnako 2 karty bez ohľadu na ruku", () => {
    let s = setupGame(data, 3, { rezim: "pata" });
    let x = 3;
    let overenych = 0;
    let plnaRuka = false;
    for (let k = 0; s.koniec === null && k < 12000; k++) {
      const p = ([0, 1] as const).find((q) => mozeHrat(s, q))!;
      x = (x * 1103515245 + 12345) % 2147483648;
      const pred = s;
      const { state, events } = apply(data, s, tahBotaPata(data, s, p, x, { vzorky: 1 }), p);
      s = state;
      if (s.kolo === pred.kolo || s.koniec !== null) continue;
      for (const q of [0, 1] as const) {
        const h = s.hraci[q];
        if (h.doberaci.length + h.odhadzovaci.length === 0) continue;
        if (pred.hraci[q].ruka.length >= 3) plnaRuka = true;
        expect(events.some((e) => e.type === "log" && e.text === `Hráč ${q + 1} si po bitke doberá ${KONSTANTY.DOBRATIE_PO_BITKE} karty.`)).toBe(true);
        overenych++;
      }
    }
    expect(overenych).toBeGreaterThan(0);
    expect(plnaRuka).toBe(true);
  });
});

describe("výpalné (v11.9, §10, krok 6c; v12.4 z banky)", () => {
  it("banka dá 1 cigaretu za každú červenú hneď po bitke, súper nič nestratí", () => {
    // Víťaz 0 má 2 červené; súper má 5 cigariet a ako porazený dostane 1.
    const po = poBitke(predKoncomBitky((s) => sCigaretami(sCervenymi(s, 0, 2), [0, 5])));
    expect(po.faza).toBe("volbaCiela");
    expect(po.hraci[0].cigarety).toBe(2 * KONSTANTY.VYPALNE_ZA_CERVENU);
    expect(po.hraci[1].cigarety).toBe(5 + KONSTANTY.CIGARETY_PORAZENEMU);
  });

  it("banka platí, aj keď súper nemá ani cigaretu", () => {
    const po = poBitke(predKoncomBitky((s) => sCigaretami(sCervenymi(s, 0, 3), [0, 0])));
    expect(po.hraci[0].cigarety).toBe(3 * KONSTANTY.VYPALNE_ZA_CERVENU);
    expect(po.hraci[1].cigarety).toBe(KONSTANTY.CIGARETY_PORAZENEMU);
  });

  it("dostane ho aj ten, kto bitku prehral", () => {
    const po = poBitke(predKoncomBitky((s) => sCigaretami(sCervenymi(s, 1, 2), [4, 0]), 0));
    expect(po.hraci[0].cigarety).toBe(4);
    expect(po.hraci[1].cigarety).toBe(KONSTANTY.CIGARETY_PORAZENEMU + 2);
  });

  it("platí sa aj pri sekere, keď porazený nie je", () => {
    const po = poBitke(predKoncomBitky((s) => sCigaretami(sCervenymi(s, 0, 1), [0, 3]), null));
    expect(po.hraci[0].cigarety).toBe(1);
    expect(po.hraci[1].cigarety).toBe(3);
  });

  it("obaja dostanú každý za svoje červené", () => {
    // Starší 0–1 červení u hráča 0, starší 2 u hráča 1.
    const s = predKoncomBitky((st) => sCigaretami(sCervenymi(st, 0, 2), [0, 1]));
    const sTretim: GameState = {
      ...s,
      starsi: s.starsi.map((e, i) => (i === 2 ? { ...e, strach: [e.strach[0], 3] as [number, number] } : e)) as GameState["starsi"],
    };
    expect(cervenychHraca(sTretim, 0)).toBe(2);
    expect(cervenychHraca(sTretim, 1)).toBe(1);
    const po = poBitke(sTretim);
    // Hráč 1 má 1 + 1 za prehru + 1 za svoju červenú; hráč 0 dostane 2.
    expect(po.hraci[0].cigarety).toBe(2);
    expect(po.hraci[1].cigarety).toBe(1 + KONSTANTY.CIGARETY_PORAZENEMU + 1);
  });

  it("väzeň sa ráta ako červená držiteľa", () => {
    const s = predKoncomBitky((st) => sCigaretami(st, [0, 3]));
    const sVaznom = { ...s, vazni: [{ hrac: 0 as PlayerId, starsi: s.starsi[0]! }] } as unknown as GameState;
    expect(cervenychHraca(sVaznom, 0)).toBe(1);
    const po = poBitke(sVaznom);
    expect(po.hraci[0].cigarety).toBe(1);
  });

  it("po finále sa neplatí", () => {
    const po = poBitke(predKoncomBitky((s) => sCigaretami(sCervenymi(s, 0, 2), [0, 5]), 0, true));
    expect(po.hraci[0].cigarety).toBe(0);
    expect(po.hraci[1].cigarety).toBe(5);
  });
});

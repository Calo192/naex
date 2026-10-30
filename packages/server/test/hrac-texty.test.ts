// Texty klienta AI playtesterov (tools/playtest/texty-hraca.ts) — playtest
// 20261028-090549, sekcia Nezrovnalosti: Bzdocha naslepo, Noviny v odhade bitky,
// „kolo 7“ pri vydesení vo finále, Dievčina na vydaj mimo náhľadu NA EX.
// Čísla sa porovnávajú s jadrom (stavkaBitky, motor), nie s pevnými hodnotami.

import { describe, expect, it } from "vitest";
import {
  bzdochaText,
  efektyPrehry,
  kedyRozhodneVydesenie,
  prehraNaexText,
  stavkaText,
  sVidenymiSkrytymiNaex,
} from "../../../tools/playtest/texty-hraca.ts";
import cardsJson from "../../core/data/cards.json";
import eldersJson from "../../core/data/elders.json";
import scorecardsJson from "../../core/data/scorecards.json";
import type { CardInstance, Command, GameState, PlacedCard, PlayerId } from "../../core/src/index.ts";
import { apply, buildGameData, legalCommands, loadGameData, naTahu, parseScorecards, poOdkrytiNaex, rngInt, rngSeed, setupGame, stavkaBitky, viewFor } from "../../core/src/index.ts";
import type { Layout4 } from "../../core/test/helpers.ts";
import { EMPTY, instanceFor, makeDef, setupSBalickom } from "../../core/test/helpers.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);
const R2: Layout4 = ["Rana", "Rana", null, null];
const R1: Layout4 = ["Rana", null, null, null];
const sada = buildGameData(
  new Map([...data.cards, ["ht_lavy", makeDef("ht_lavy", EMPTY, R2)], ["ht_pol", makeDef("ht_pol", R1, R1)]]),
  data.elders,
  parseScorecards(scorecardsJson),
);

/** Pitka (útočník 0, obranca 1) s dvoma kartami hráča 1, na ktoré sa dá NA EX; Bzdocha v partii hráčov `bzdocha`. */
function doPitky(seed: number, bzdocha: readonly PlayerId[], uprav: (s: GameState) => GameState = (s) => s): { s: GameState; lavy: number } {
  const s0 = setupSBalickom(sada, seed);
  const lavy = instanceFor(sada, "ht_lavy", EMPTY, R2);
  const pol = instanceFor(sada, "ht_pol", R1, R1);
  const bz = (p: PlayerId): PlacedCard[] => (bzdocha.includes(p) ? [{ card: { uid: 890000 + p, defId: "klebetnica", leftLayout: 0, rightLayout: 0 }, playedBy: p }] : []);
  let s: GameState = uprav({
    ...s0,
    faza: "zhromazdenie",
    kolo: 2,
    utocnik: 0,
    pitkyCelkom: 1,
    pitkaCislo: 0,
    ciel: { typ: "lokalita", lokalita: null },
    lokalityVHre: s0.lokalityVHre.slice(1),
    strany: [[...bz(0)], [{ card: pol, playedBy: 1 }, { card: lavy, playedBy: 1 }, ...bz(1)]],
    hraci: [
      { ...s0.hraci[0], ruka: [], cigarety: 5, poldeciPlne: 1, poldeciVypite: 0 },
      { ...s0.hraci[1], ruka: [], cigarety: 5, poldeciPlne: 1, poldeciVypite: 0 },
    ],
    zhromazdenieStav: { naTahu: 0, zostavaLimit: [3, 3], pasoval: [false, false], navyse: [0, 0] },
  });
  s = apply(sada, s, { type: "pass" }, 0).state;
  if (s.faza !== "pitka") s = apply(sada, s, { type: "pass" }, 1).state;
  expect(s.faza).toBe("pitka");
  return { s, lavy: lavy.uid };
}

describe("klient AI hráčov: Bzdocha (playtest 20261028-090549, nezrovnalosť 2)", () => {
  it("majiteľ Bzdochy vidí, na čo dal súper skryto NA EX, a stôl ho ráta", () => {
    const { s, lavy } = doPitky(301, [1]);
    let t = apply(sada, s, { type: "naex", uid: lavy }, 0).state;
    t = apply(sada, t, { type: "skipNaex" }, 0).state;
    const v = viewFor(sada, t, 1);
    // ht_lavy patrí majiteľovi Bzdochy (hráč 1) a leží na jeho strane.
    expect(bzdochaText(sada, v)).toMatch(/^Bzdocha: súper dal skryto NA EX na tvoju kartu ht_lavy \[\d+\] \(na tvojej strane\)/);
    // Stôl a odhad rátajú jeho NA EX tak, ako ho motor zúčtuje pri odkrytí.
    const vs = sVidenymiSkrytymiNaex(sada, v);
    expect(vs.strany[1].find((pl) => pl.card.uid === lavy)?.naexBy).toBe(0);
    expect(vs.hraci[0].poldeciPlne).toBe(v.hraci[0].poldeciPlne - 1);
    // Súper bez Bzdochy nič také nevidí.
    expect(bzdochaText(sada, viewFor(sada, t, 0))).toBeNull();
  });

  it("súper skončil bez NA EX — majiteľ Bzdochy to vie", () => {
    const { s } = doPitky(302, [1]);
    const t = apply(sada, s, { type: "skipNaex" }, 0).state;
    expect(bzdochaText(sada, viewFor(sada, t, 1))).toMatch(/^Bzdocha: súper skončil Pitku bez NA EX/);
  });

  it("bez Bzdochy sa súperovo skryté NA EX do stola nedostane", () => {
    const { s, lavy } = doPitky(303, []);
    const t = apply(sada, s, { type: "naex", uid: lavy }, 0).state;
    const v = viewFor(sada, t, 1);
    expect(bzdochaText(sada, v)).toBeNull();
    expect(sVidenymiSkrytymiNaex(sada, v)).toEqual(v);
  });
});

describe("klient AI hráčov: stávka bitky z jadra (nezrovnalosť 3, Noviny)", () => {
  it("Noviny porazeného (Titulka): pri prehre +1 špak za každý Dlh, ktorý má víťaz navyše", () => {
    const dlh = (uid: number): CardInstance => ({ uid, defId: "dlh", leftLayout: 0, rightLayout: 0 });
    const { s } = doPitky(304, [], (x) => ({
      ...x,
      hraci: [
        { ...x.hraci[0], priznane: [dlh(891001), dlh(891002)] },
        { ...x.hraci[1], dedicstvo: [{ uid: 891003, defId: "noviny", leftLayout: 0, rightLayout: 0 }] },
      ],
    }));
    const v = viewFor(sada, s, 0);
    const st = stavkaBitky(sada, v);
    // Hráč 0 má Dlhy navyše; Noviny má súper — dostane ich, keď prehrá.
    expect(st?.noviny[0]).toBe(0);
    expect(st?.noviny[1]).toBeGreaterThanOrEqual(2);
    const text = stavkaText(sada, v) ?? "";
    expect(text).toContain(`Keď prehrá súper, dostane +`);
    expect(text).toContain(`tvoja výhra +${st?.vyhra} `);
    // Súper vidí to isté z druhej strany.
    const st1 = stavkaBitky(sada, viewFor(sada, s, 1));
    expect(st1?.noviny[0]).toBe(st?.noviny[1]);
    expect(stavkaText(sada, viewFor(sada, s, 1))).toContain(`Keď prehráš, dostaneš +`);
  });

  it("bez cieľa kola stávka nie je", () => {
    const s = setupGame(data, 305);
    expect(stavkaText(data, viewFor(data, s, 0))).toBeNull();
  });
});

describe("klient AI hráčov: ohlásené vydesenie vo finále (nezrovnalosť 8, „kolo 7“)", () => {
  const stredna = { lokalitCelkom: 5, rozpis: [1, 2, 2, 3, 3, 4] };
  it("ohlásenie pred finále rozhodne na konci finále, ohlásené vo finále nedozreje", () => {
    expect(kedyRozhodneVydesenie(stredna, 4)).toBe("na konci kola 5");
    expect(kedyRozhodneVydesenie(stredna, 5)).toBe("na konci finále (ešte pred konečnými špakmi)");
    expect(kedyRozhodneVydesenie(stredna, 6)).toBeNull();
  });
  it("sada bez finále: posledné kolo je posledná lokalita", () => {
    expect(kedyRozhodneVydesenie({ lokalitCelkom: 5 }, 4)).toBe("na konci kola 5 (posledného)");
    expect(kedyRozhodneVydesenie({ lokalitCelkom: 5 }, 5)).toBeNull();
  });
});

describe("klient AI hráčov: efekty Prehra (nezrovnalosť 3, Dievčina na vydaj)", () => {
  it("Dlhy z Dievčiny na vydaj predpovedá klient rovnako, ako ich motor rozdá", () => {
    let porovnane = 0;
    for (const seed of [11, 12, 13, 14, 15, 16]) {
      let state = setupGame(data, seed, { lokalit: 3 });
      let rng = rngSeed(seed ^ 0x77);
      for (let i = 0; i < 4000 && state.koniec === null; i++) {
        const hrac = naTahu(state);
        if (hrac === null) break;
        const cmds = legalCommands(data, state, hrac);
        const [idx, dalsi] = rngInt(rng, cmds.length);
        rng = dalsi;
        const r = apply(data, state, cmds[idx] as Command, hrac);
        for (const e of r.events) {
          const m = e.type === "log" ? /Dievčina na vydaj: hráč (\d) ju zahadzuje — hráč \d získava (\d+)/.exec(e.text) : null;
          if (m === null) continue;
          const porazeny = (Number(m[1]) - 1) as PlayerId;
          for (const ja of [0, 1] as const) expect(efektyPrehry(data, viewFor(data, state, ja)).dievcina[porazeny]).toBe(Number(m[2]));
          porovnane++;
        }
        state = r.state;
      }
    }
    expect(porovnane).toBeGreaterThan(0);
  });

  it("náhľad NA EX na Dievčinu na vydaj povie, koľko Dlhov dá po prehre (Eva: „súper Dlh +1“, po prehre 3)", () => {
    let videne = 0;
    for (const seed of [21, 22, 23, 24, 25, 26, 27, 28]) {
      let state = setupGame(data, seed, { lokalit: 3 });
      let rng = rngSeed(seed ^ 0x99);
      for (let i = 0; i < 4000 && state.koniec === null; i++) {
        const hrac = naTahu(state);
        if (hrac === null) break;
        const cmds = legalCommands(data, state, hrac);
        for (const c of cmds) {
          if (c.type !== "naex") continue;
          const pl = state.strany.flat().find((x) => x.card.uid === c.uid);
          if (pl === undefined || pl.card.defId !== "dievcina_na_vydaj") continue;
          const v = viewFor(data, state, hrac);
          const po = poOdkrytiNaex(data, v, c.uid);
          if (po === null) continue;
          // Poldeci z NA EX sa vypijú pred efektmi Prehra — Dlhy z Dievčiny NA EX nezmení.
          const dlhy = efektyPrehry(data, v).dievcina[pl.playedBy];
          expect(efektyPrehry(data, po.view).dievcina[pl.playedBy]).toBe(dlhy);
          const text = prehraNaexText(data, v, po.view, c.uid);
          expect(text).toContain("efekty Prehra po bitke (toto NA EX ich nezmení");
          if (dlhy > 0) {
            const kto = pl.playedBy === hrac ? "keď prehráš" : "keď prehrá súper";
            const ziska = pl.playedBy === hrac ? "súper získa" : "ty získaš";
            expect(text).toContain(`${kto}: Dievčina na vydaj: ${ziska} ${dlhy} Dlh`);
          }
          videne++;
        }
        const [idx, dalsi] = rngInt(rng, cmds.length);
        rng = dalsi;
        state = apply(data, state, cmds[idx] as Command, hrac).state;
      }
    }
    expect(videne).toBeGreaterThan(0);
  });
});

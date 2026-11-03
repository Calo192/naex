// Texty klienta AI playtesterov (tools/playtest/texty-hraca.ts) — playtest
// 20261028-090549, sekcia Nezrovnalosti: Bzdocha naslepo, Noviny v odhade bitky,
// „kolo 7“ pri vydesení vo finále, Dievčina na vydaj mimo náhľadu NA EX.
// Čísla sa porovnávajú s jadrom (stavkaBitky, motor), nie s pevnými hodnotami.

import { describe, expect, it } from "vitest";
import {
  bzdochaText,
  efektyPrehry,
  prehraNaexText,
  starsiNaNakladacku,
  stavkaText,
  sVidenymiSkrytymiNaex,
} from "../../../tools/playtest/texty-hraca.ts";
import cardsJson from "../../core/data/cards.json";
import eldersJson from "../../core/data/elders.json";
import scorecardsJson from "../../core/data/scorecards.json";
import type { BitkaStav, CardInstance, Command, GameState, PlacedCard, PlayerId } from "../../core/src/index.ts";
import {
  apply,
  buildGameData,
  evaluateLine,
  legalCommands,
  lineState,
  loadGameData,
  nahladVylozenia,
  naTahu,
  parseScorecards,
  poOdkrytiNaex,
  rngInt,
  rngSeed,
  setupGame,
  stavkaBitky,
  viewFor,
} from "../../core/src/index.ts";
import type { Layout4 } from "../../core/test/helpers.ts";
import { EMPTY, instanceFor, makeDef, setupSBalickom } from "../../core/test/helpers.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);
const R2: Layout4 = ["Rana", "Rana", null, null];
const R1: Layout4 = ["Rana", null, null, null];
const D1: Layout4 = [null, "Rana", null, null];
// Dievčina na vydaj s rozložením spred identity kariet (2026-11-03) — test stráži poradie krokov bitky, nie akcie sady.
const DV_L: Layout4 = [null, "Dlh", "Cigareta", null];
const DV_R: Layout4 = [null, "Dlh", "Vízia", null];
const sada = buildGameData(
  new Map([
    ...data.cards,
    ["ht_lavy", makeDef("ht_lavy", EMPTY, R2)],
    ["ht_pol", makeDef("ht_pol", R1, R1)],
    ["ht_d1", makeDef("ht_d1", D1, D1)],
    ["dievcina_na_vydaj", makeDef("dievcina_na_vydaj", DV_L, DV_R, { tags: ["Občan", "Závislý", "Žena"], triggers: ["Prehra"] })],
  ]),
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

  it("náhľad NA EX na kartu, kam súper dal NA EX (Bzdocha), ráta zrážku ako motor (playtest 20261030-184957, Šimon)", () => {
    const { s, lavy } = doPitky(306, [1]);
    let t = apply(sada, s, { type: "naex", uid: lavy }, 0).state;
    t = apply(sada, t, { type: "skipNaex" }, 0).state;
    const po = poOdkrytiNaex(sada, viewFor(sada, t, 1), lavy);
    expect(po?.view.strany[1].find((pl) => pl.card.uid === lavy)?.vytrznik).toBe(true);
    // Motor po odkrytí: tá istá karta je Výtržník a súčty línie sedia s náhľadom.
    let m = apply(sada, t, { type: "naex", uid: lavy }, 1).state;
    m = apply(sada, m, { type: "skipNaex" }, 1).state;
    expect(m.strany[1].find((pl) => pl.card.uid === lavy)?.vytrznik).toBe(true);
    expect(evaluateLine(sada, lineState(po!.view)).sums).toEqual(evaluateLine(sada, lineState(m)).sums);
    // Bez Bzdochy súperovo NA EX nevidno — náhľad zrážku nesľubuje.
    const bez = doPitky(307, []);
    let u = apply(sada, bez.s, { type: "naex", uid: bez.lavy }, 0).state;
    u = apply(sada, u, { type: "skipNaex" }, 0).state;
    expect(poOdkrytiNaex(sada, viewFor(sada, u, 1), bez.lavy)?.view.strany[1].find((pl) => pl.card.uid === bez.lavy)?.vytrznik).toBeUndefined();
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

describe("klient AI hráčov: stávka bitky z jadra (nezrovnalosť 3; Noviny od v11.5 stávku nemenia)", () => {
  it("bez cieľa kola stávka nie je", () => {
    const s = setupGame(data, 305);
    expect(stavkaText(data, viewFor(data, s, 0))).toBeNull();
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
          const m = e.type === "log" ? /Dievčina na vydaj: hráč (\d) ju páli — hráč \d získava (\d+)/.exec(e.text) : null;
          if (m === null) continue;
          const porazeny = (Number(m[1]) - 1) as PlayerId;
          for (const ja of [0, 1] as const) {
            // Súperova skrytá Záverečná pri Dievčine sa otočí až v tom istom ťahu, ktorý bitku spustí —
            // kto ju nevidí, Dlhy za jej spoj predpovedať nemôže (a nesmie, viewFor ju neposiela).
            const v = viewFor(data, state, ja);
            if (v.strany.flat().length !== state.strany.flat().length) continue;
            // Vlastná Záverečná Dievčina sa otočí v tom istom ťahu — efektyPrehry ráta len odkryté karty.
            if (state.strany.flat().some((pl) => pl.card.defId === "dievcina_na_vydaj" && pl.zaverecna === true)) continue;
            expect(efektyPrehry(data, v).dievcina[porazeny], `seed ${seed}, hráč ${ja}`).toBe(Number(m[2]));
            porovnane++;
          }
        }
        state = r.state;
      }
    }
    expect(porovnane).toBeGreaterThan(0);
  });

  it("NA EX na Dievčine Dlhy po prehre nemení — poldeci sa vypijú (§9 krok 5) pred efektmi Prehra (krok 6c); motor aj náhľad", () => {
    const dievcina: CardInstance = instanceFor(sada, "dievcina_na_vydaj", DV_L, DV_R);
    const sused = instanceFor(sada, "ht_d1", D1, D1);
    // Rana suseda na spoji s Dlhom Dievčiny: Dlh aktívny (×1), hráč 1 má jediné poškodenie a vyhrá.
    const { s } = doPitky(309, [], (x) => ({ ...x, strany: [[{ card: dievcina, playedBy: 0, naexBy: 1 }, { card: sused, playedBy: 1 }], []] }));
    const aktivne = (x: GameState): number => {
      const ev = evaluateLine(sada, lineState(x)).cards.get(dievcina.uid)!;
      return [...ev.left, ...ev.right].reduce((a, y) => a + (y?.stav === "aktivna" ? y.nasobok : 0), 0);
    };
    // V Pitke NA EX platí: zruší Dlh na spoji a zdvojí 3 neaktívne akcie.
    expect(aktivne(s)).toBe(6);
    const bezNaex = { ...s, strany: [[{ card: dievcina, playedBy: 0 as PlayerId }, { card: sused, playedBy: 1 as PlayerId }], []] as GameState["strany"] };
    expect(aktivne(bezNaex)).toBe(1);
    for (const ja of [0, 1] as const) expect(efektyPrehry(sada, viewFor(sada, s, ja)).dievcina[0]).toBe(1);
    let t = s;
    const log: string[] = [];
    for (let i = 0; i < 400 && t.koniec === null && t.kolo === s.kolo; i++) {
      const q = ([0, 1] as const).find((x) => legalCommands(sada, t, x).length > 0);
      if (q === undefined) break;
      const legal = legalCommands(sada, t, q);
      const cmd = legal.find((c) => c.type === "skipNaex") ?? legal.find((c) => c.type === "pass") ?? legal.find((c) => c.type === "bezReakcie") ?? (legal[0] as Command);
      const r = apply(sada, t, cmd, q);
      for (const e of r.events) if (e.type === "log") log.push(e.text);
      t = r.state;
    }
    expect(log).toContain("Dievčina na vydaj: hráč 1 ju páli — hráč 2 získava 1 Dlh.");
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

describe("klient AI hráčov: Nakladačka a starší v ohrození (playtest 20261030-184957, Eva N1, Šimon 5)", () => {
  it("staršieho s červeným strachom výpis na Nakladačku neponúkne (strach nemá kam) — rovnako ako server", () => {
    const s0 = setupGame(data, 308);
    const id = s0.starsi[0]!.elderId;
    const bitkaStav: BitkaStav = {
      krok: "prebytok",
      caka: 1,
      sums: [{}, {}],
      exekutorHotovy: [true, true],
     
      exekutor: [0, 0],
      damage: null,
      vitaz: 1,
      prebytokDrzi: 1,
      prebytokZostava: 4,
      prebytokZdvihy: [], prebytokPrepadlo: 0,
      spalit: [],
      vesticaHotova: true,
    };
    const starsi = s0.starsi.map((e, i) => (i === 0 ? { ...e, strach: [0, 3] as const } : e));
    const s: GameState = { ...s0, faza: "bitka", draftStav: null, starsi, ciel: { typ: "lokalita", lokalita: s0.lokalityVHre[0]! }, bitkaStav };
    const ponuka = starsiNaNakladacku(viewFor(data, s, 1)).map((e) => e.elderId);
    expect(ponuka).not.toContain(id);
    expect(ponuka.length).toBeGreaterThan(0);
    // Server ponúka celé rozdelenia (v11) — žiadne nezdvihne strach, ktorý je už na červenej.
    const vPonuke = new Set(legalCommands(data, s, 1).flatMap((c) => (c.type === "prebytok" ? c.zdvihy.map((z) => z.elderId) : [])));
    expect([...vPonuke].every((x) => ponuka.includes(x))).toBe(true);
    expect(() => apply(data, s, { type: "prebytok", zdvihy: [{ elderId: id, na: 1 }] }, 1)).toThrow();
  });
});

describe("náhľad vyloženia: Šofér po NA EX (playtest 20261030-184957, Šimon 1)", () => {
  it("kto už v kole dal NA EX, tomu Šofér Pecku navyše nedá ani v náhľade", () => {
    const s0 = setupGame(data, 309);
    const sofer: CardInstance = { uid: 891100, defId: "sofer", leftLayout: 0, rightLayout: 0 };
    const line = lineState({ ...s0, ciel: { typ: "lokalita", lokalita: s0.lokalityVHre[0]! } });
    expect(nahladVylozenia(data, line, 0, sofer, "superova").tuhe[0]).toBe(2);
    expect(nahladVylozenia(data, line, 0, sofer, "superova", [false, false]).tuhe[0]).toBe(2);
    expect(nahladVylozenia(data, line, 0, sofer, "superova", [true, false]).tuhe[0]).toBe(0);
  });
});

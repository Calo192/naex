// Návrh #38 B (Michal 2026-10-28): hrozba na stole s kliatbami (od 1 Cirhózy alebo
// 1 Dlhu), efekty Prehra v jadre a vydesenie pri rozdeľovaní prebytku.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { Command, GameState, MarkerPos, PlayerId } from "../src/index.ts";
import {
  apply,
  cenaKliatby,
  hrozbaKliatob,
  legalCommands,
  loadGameData,
  naTahu,
  nahladNaexNaKartu,
  nahladPosunuMarkera,
  naexCieleVLinii,
  lineState,
  rngInt,
  rngSeed,
  setupGame,
  textHrozbyKliatob,
  viewFor,
} from "../src/index.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);
const ceny = () => ([0, 1] as const).map(() => ({ cirhoza: cenaKliatby("cirhoza"), dlh: cenaKliatby("dlh") })) as [{ cirhoza: number; dlh: number }, { cirhoza: number; dlh: number }];

/** Stavy Zhromaždenia s cieľom z náhodných partií (bez skrytých NA EX — oba pohľady vidia to isté). */
function* zhromazdenia(seedy: readonly number[]): Generator<GameState> {
  for (const seed of seedy) {
    let st: GameState = setupGame(data, seed);
    let rng = rngSeed(seed ^ 0x38);
    for (let i = 0; st.koniec === null && i < 4000; i++) {
      const p = naTahu(st);
      if (p === null) break;
      if (st.faza === "zhromazdenie" && st.ciel !== null && st.strany.some((s) => s.length > 0)) yield st;
      const cmds = legalCommands(data, st, p);
      const [j, r] = rngInt(rng, cmds.length);
      rng = r;
      st = apply(data, st, cmds[j] as Command, p).state;
    }
  }
}

describe("hrozba kliatob na stole (#38 B)", () => {
  it("je najhoršie NA EX z verejnej línie a sedí s náhľadom NA EX toho, kto by ho dal; nezávisí od pohľadu", () => {
    let naslo = 0;
    for (const s of zhromazdenia([1, 2, 3, 4, 5, 6])) {
      for (const hrac of [0, 1] as const) {
        const obet: PlayerId = hrac === 0 ? 1 : 0;
        const vHraca = viewFor(data, s, hrac);
        const k = hrozbaKliatob(data, vHraca, hrac, true);
        // Obeť vidí to isté — skrytá Záverečná je jediné, čo pohľady líšia (každý vidí len svoju).
        if (!s.strany.flat().some((pl) => pl.zaverecna === true)) expect(hrozbaKliatob(data, viewFor(data, s, obet), hrac, true)).toEqual(k);
        // Každé NA EX hráča z verejnej línie: kliatby obete z náhľadu, ktorý by videl on.
        const vsetky = naexCieleVLinii(data, lineState(vHraca), hrac).flatMap((uid) => {
          const n = nahladNaexNaKartu(data, vHraca, uid, ceny());
          if (n === null) return [];
          const x = n.kliatby[obet];
          const cirhozy = x.cirhozy + x.dalejCirhozy;
          const dlhy = x.dlhy + x.dalejDlhy;
          return cirhozy < 1 && dlhy < 1 ? [] : [{ uid, kliatby: cirhozy + dlhy, cirhozy, dlhy }];
        });
        const naj = vsetky.length === 0 ? 0 : Math.max(...vsetky.map((x) => x.kliatby));
        if (vsetky.length === 0) {
          expect(k).toBeNull();
          continue;
        }
        expect(k).not.toBeNull();
        const zNahladu = vsetky.find((x) => x.uid === k!.uid);
        expect(zNahladu?.kliatby).toBe(naj);
        expect([k!.cirhozy, k!.dlhy]).toEqual([zNahladu?.cirhozy, zNahladu?.dlhy]);
        expect(k!.obet).toBe(obet);
        naslo++;
      }
    }
    expect(naslo).toBeGreaterThan(0);
  });

  it("kto už NA EX dať nesmie, nehrozí; text menuje Cirhózy, Dlhy aj špaky", () => {
    const s = zhromazdenia([7]).next().value as GameState;
    expect(hrozbaKliatob(data, viewFor(data, s, 0), 1, false)).toBeNull();
    expect(textHrozbyKliatob({ cirhozy: 1, dlhy: 2, spaky: -3 })).toBe("Cirhóza +1, Dlh +2, −3 špaky");
    expect(textHrozbyKliatob({ cirhozy: 0, dlhy: 1, spaky: 0 })).toBe("Dlh +1");
  });
});

describe("náhľad posunu povie, koľko starších bude vydesených (#38 B)", () => {
  it("posun na červenú pridá vydeseného tomu, koho sa starší bojí (v9: toho sa dá skúsiť zajať)", () => {
    const s0 = setupGame(data, 11);
    const s: GameState = { ...s0, starsi: s0.starsi.map((e, i) => ({ ...e, marker: (i === 0 ? 5 : 3) as MarkerPos })) };
    const v = viewFor(data, s, 0);
    const n = nahladPosunuMarkera(data, v, s.starsi[0]!.elderId, 1, 3);
    // Marker 5 → 6 (oranžová → červená stojí 3): vydesil ho hráč 0.
    expect(n?.vydeseni).toEqual([1, 0]);
  });
});

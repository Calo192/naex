// Hrozba na stole (Michal 2026-10-23): najsilnejšie NA EX hráča z kariet na stole.
// Musí sedieť so skutočným príkazom naex v motore, nesmie závisieť od skrytej ruky
// a ukáže sa len vtedy, keď zmení víťaza alebo prebytok.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { BattleOutcome, CardInstance, GameState, PlacedCard, PlayerId, PriebehNaex } from "../src/index.ts";
import {
  apply,
  battleOutcome,
  evaluateLine,
  hrozbaNaex,
  legalCommands,
  lineState,
  loadGameData,
  mozeEsteNaex,
  poskodenieBitky,
  setupGame,
  viewFor, sNaexNaKartach } from "../src/index.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);
const obcania = [...data.cards.values()].filter((d) => d.tags.includes("Občan") && d.id !== "liberal").map((d) => d.id);

let uidSeq = 70000;
const inst = (defId: string): CardInstance => ({ uid: ++uidSeq, defId, leftLayout: 0, rightLayout: 0 });

/** Pitka s náhodnou líniou z Občanov; obaja majú plný poldeci. */
function vPitke(seed: number): GameState {
  const s = setupGame(data, seed);
  // Jednoduchý deterministický generátor — línie sa pri každom behu opakujú.
  let x = seed * 7919 + 17;
  const rng = { int: (n: number): number => ((x = (x * 1103515245 + 12345) % 2147483648) % n) };
  const strana = (): PlacedCard[] =>
    Array.from({ length: 1 + rng.int(3) }, () => ({ card: inst(obcania[rng.int(obcania.length)]!), playedBy: rng.int(2) as PlayerId }));
  return {
    ...s,
    faza: "pitka",
    pitkyCelkom: 1,
    pitkaCislo: 1,
    ciel: { typ: "lokalita", lokalita: s.lokalityVHre.find((l) => l.defId !== "kostol")! },
    strany: [strana(), strana()],
    hraci: [
      { ...s.hraci[0], poldeciPlne: 1 },
      { ...s.hraci[1], poldeciPlne: 1 },
    ],
    pitkaStav: { naTahu: 0, hotovy: [false, false], naexPouzity: [false, false], fajcenie: [0, 0], reakcia: null, postarka: [false, false], starosta: [false, false] },
  } as GameState;
}

const priebeh = (s: GameState): PriebehNaex => ({
  faza: s.faza,
  pitkaStav: s.pitkaStav,
  pitkaCislo: s.pitkaCislo,
  pitkyCelkom: s.pitkyCelkom,
  poldeciPlne: [s.hraci[0].poldeciPlne, s.hraci[1].poldeciPlne],
});

const vysledok = (s: GameState): BattleOutcome => battleOutcome(poskodenieBitky(data, s, evaluateLine(data, lineState(s)).sums));
const hodnota = (v: BattleOutcome, p: PlayerId): number =>
  (v.vitaz === null ? 0 : v.vitaz === p ? 1000 : -1000) + (v.prebytokDrzi === null ? 0 : v.prebytokDrzi === p ? v.prebytok : -v.prebytok);

/**
 * Stav po odkrytí NA EX hráča p: poldeci na kartách a NA EX v kole (vypne Šoférov bonus) —
 * tak ako hrozbaNaex; skryté NA EX sa do naexVKole zapíše až pri odkrytí (sada v39: Šofér s Odporom).
 */
const poNaex = (s: GameState, p: PlayerId): GameState => {
  const t = sNaexNaKartach(s);
  const naexVKole: [boolean, boolean] = [t.naexVKole?.[0] ?? false, t.naexVKole?.[1] ?? false];
  naexVKole[p] = true;
  return { ...t, naexVKole };
};

describe("hrozba na stole", () => {
  it("je to najlepšie skutočné NA EX z motora, a len keď zlepší výsledok", () => {
    let nasla = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const s = vPitke(seed);
      for (const p of [0, 1] as const) {
        const na = { ...s, pitkaStav: { ...s.pitkaStav!, naTahu: p } } as GameState;
        const teraz = hodnota(vysledok(na), p);
        // Motor: každé povolené NA EX naozaj zahrané.
        const najlepsie = legalCommands(data, na, p)
          .flatMap((c) => (c.type === "naex" ? [c.uid] : []))
          .map((uid) => hodnota(vysledok(poNaex(apply(data, na, { type: "naex", uid }, p).state, p)), p));
        const best = Math.max(teraz, ...najlepsie);
        const h = hrozbaNaex(data, na, priebeh(na), p);
        if (best > teraz) {
          expect(h).not.toBeNull();
          expect(hodnota(h!.vysledok, p)).toBe(best);
          expect(hodnota(vysledok(poNaex(apply(data, na, { type: "naex", uid: h!.uid }, p).state, p)), p)).toBe(best);
          nasla++;
        } else {
          expect(h).toBeNull();
        }
      }
    }
    // Inak by test nič neoveril.
    expect(nasla).toBeGreaterThan(5);
  });

  it("nezávisí od skrytej ruky — rovnaká z pohľadu oboch hráčov", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const s = vPitke(seed);
      const ina = { ...s, hraci: [s.hraci[0], { ...s.hraci[1], ruka: [...s.hraci[1].ruka].reverse().slice(1) }] } as GameState;
      for (const ja of [0, 1] as const) {
        const v = viewFor(data, ina, ja);
        const zView = hrozbaNaex(data, v, { ...priebeh(s), poldeciPlne: [v.hraci[0].poldeciPlne, v.hraci[1].poldeciPlne] }, ja === 0 ? 1 : 0);
        expect(zView?.uid).toBe(hrozbaNaex(data, s, priebeh(s), ja === 0 ? 1 : 0)?.uid);
      }
    }
  });

  it("kto už NA EX dať nemôže, nehrozí", () => {
    const s = vPitke(3);
    const pr = priebeh(s);
    expect(mozeEsteNaex(s, pr, 0)).toBe(true);
    expect(mozeEsteNaex(s, { ...pr, poldeciPlne: [0, 1] }, 0)).toBe(false);
    expect(mozeEsteNaex(s, { ...pr, faza: "bitka" }, 0)).toBe(false);
    // V poslednej Pitke po použitom NA EX už nie; keď príde ďalšia Pitka, áno.
    const pouzite = { ...pr, pitkaStav: { ...s.pitkaStav!, naexPouzity: [true, false] as const } };
    expect(mozeEsteNaex(s, pouzite, 0)).toBe(false);
    expect(mozeEsteNaex(s, { ...pouzite, pitkyCelkom: 2 }, 0)).toBe(true);
    // Vlastné skryté NA EX míňa limit Pitky aj posledný plný poldeci (playtest 20261026-181227-2):
    // „ty ešte môžeš dať NA EX“ po ňom nemá čo hroziť ani v ďalšej Pitke.
    const skryte = { ...pr, pitkaStav: { ...s.pitkaStav!, skryteNaex: [{ hrac: 0 as const, uid: s.strany[0][0]!.card.uid }] } };
    expect(mozeEsteNaex(s, skryte, 0)).toBe(false);
    expect(mozeEsteNaex(s, { ...skryte, pitkyCelkom: 2 }, 0)).toBe(false);
    expect(mozeEsteNaex(s, { ...skryte, pitkyCelkom: 2, poldeciPlne: [2, 1] }, 0)).toBe(true);
    expect(mozeEsteNaex(s, skryte, 1)).toBe(true);
    // Pred Pitkou (Zhromaždenie) áno; Kostol (v7) NA EX nezakazuje, len obmedzí na kraj pri oltári.
    expect(mozeEsteNaex(s, { ...pr, faza: "zhromazdenie", pitkaStav: null }, 0)).toBe(true);
  });
});

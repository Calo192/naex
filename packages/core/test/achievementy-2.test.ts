// Druhá dávka achievementov (Michal 2026-11-11): nové metriky sa v náhodných partiách
// porovnajú s nezávislým prepočtom z príkazov, udalostí a nástenky.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import achievementyJson from "../data/achievementy.json";
import type { Achievement, Command, Event, GameState, KontextPartie, PlayerId, StavAchievementov } from "../src/index.ts";
import {
  agregatPartie,
  applySPrisunom,
  hodnotaVPartii,
  krokAchievementov,
  legalCommands,
  loadGameData,
  metrika,
  nacitajAchievementy,
  naTahu,
  noveAchievementy,
  rngInt,
  rngSeed,
  setupGame,
  stitkyPartie,
} from "../src/index.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

const NOVE = [
  "bitkaOJedno",
  "abstakyVitaza",
  "retazPremien",
  "kradezPriZajati",
  "vypalne",
  "kartyVTahu",
  "podlozenia",
  "vytrznik",
  "vyhraStrachom",
  "vyhraBezHadky",
  "vyhraOChlp",
  "vyhraFinaleZoZadu",
  "nepriznaneCirhozyVyhra",
  "odveta",
  "nocnaPartia",
  "zajatiStarsi",
  "rozneLokality",
  "hraciDen",
  "nazory",
  "hodnotenia",
] as const;

const katalog = nacitajAchievementy({
  achievementy: NOVE.map((m) => {
    const druh = metrika(m)?.druh;
    return { id: m.toLowerCase(), nazov: m, popis: "Aspoň {prah}.", metrika: m, rozsah: druh === "rozne" ? "kariera" : "partia", prahy: [1] };
  }),
});
const ach = (m: string): Achievement => katalog.achievementy.find((a) => a.metrika === m) as Achievement;

interface Partia {
  readonly s: GameState;
  readonly stav: StavAchievementov;
  readonly kroky: readonly { readonly cmd: Command; readonly autor: PlayerId; readonly udalosti: readonly Event[] }[];
}

function prehraj(seed: number, kontext: KontextPartie): Partia {
  let s = setupGame(data, seed);
  let rng = rngSeed(seed);
  let stav = noveAchievementy();
  const kroky: { cmd: Command; autor: PlayerId; udalosti: readonly Event[] }[] = [];
  for (let i = 0; i < 6000 && s.koniec === null; i++) {
    const p = naTahu(s);
    if (p === null) break;
    const cmds = legalCommands(data, s, p).filter((c) => c.type !== "vzdat");
    const [j, r] = rngInt(rng, cmds.length);
    rng = r;
    const cmd = cmds[j] as Command;
    const { state: po, events } = applySPrisunom(data, s, cmd, p);
    stav = krokAchievementov(katalog, data, stav, s, cmd, p, po, events, kontext).stav;
    kroky.push({ cmd, autor: p, udalosti: events });
    s = po;
  }
  return { s, stav, kroky };
}

const rozloz = (cmd: Command): readonly Command[] => (cmd.type === "tah" ? cmd.kroky : [cmd]);

describe("achievementy 2 — katalóg", () => {
  it("každá nová metrika existuje a katalóg hry ju vie použiť", () => {
    for (const m of NOVE) expect(metrika(m), m).not.toBeNull();
    const hra = nacitajAchievementy(achievementyJson);
    const pouzite = new Set(hra.achievementy.map((a) => a.metrika));
    for (const m of NOVE) expect(pouzite.has(m), `metrika ${m} má achievement`).toBe(true);
    // Mimo partie udeľuje server — musia byť dostupné v partiách oboch typov a bez postupu kariéry.
    for (const a of hra.achievementy.filter((x) => x.metrika === "nazory" || x.metrika === "hodnotenia")) {
      expect(a.proti).toBe("vsetky");
      expect(a.rozsah).toBe("partia");
    }
  });
});

describe("achievementy 2 — metriky v náhodných partiách", () => {
  const kontext: KontextPartie = { botPovaha: null, superi: ["b", "a"], den: "2026-11-11", hodina: 3, odveta: [true, false] };

  it.each([61, 62, 63, 64])("semienko %i: metriky sedia s prepočtom z príkazov, udalostí a nástenky", (seed) => {
    const { s, stav, kroky } = prehraj(seed, kontext);
    expect(s.koniec).not.toBeNull();
    const vitaz = s.koniec?.vitaz ?? null;
    const body = s.koniec?.body ?? null;
    for (const p of [0, 1] as const) {
      const su = p === 0 ? 1 : 0;
      const moje = kroky.filter((k) => k.autor === p);
      const partia = (m: string): number => agregatPartie(stav, p, ach(m)) ?? 0;

      // Ťahy: najviac kariet do línie jedným príkazom a počet podložení.
      const doLinie = (c: Command): boolean => c.type === "zaverecna" || (c.type === "place" && (c.target === "vlastna" || c.target === "superova"));
      expect(hodnotaVPartii(stav, p, ach("kartyVTahu"))).toBe(Math.max(0, ...moje.map((k) => rozloz(k.cmd).filter(doLinie).length)));
      expect(partia("podlozenia")).toBe(moje.reduce((n, k) => n + rozloz(k.cmd).filter((c) => c.type === "podloz").length, 0));

      // Udalosti: výpalné z účtovnej knihy cigariet, bitky o 1.
      const udalosti = kroky.flatMap((k) => k.udalosti);
      expect(partia("vypalne")).toBe(udalosti.reduce((n, e) => n + (e.type === "zmenaCigariet" && e.hrac === p && e.zdroj === "vypalne" && e.suma > 0 ? e.suma : 0), 0));
      expect(partia("bitkaOJedno")).toBe(udalosti.filter((e) => e.type === "bitkaVysledok" && e.vitaz === p && e.prebytok === 1).length);

      // Nástenka: lokality vyhratých bitiek, krádež pri zajatí, väzni.
      const vyhrate = s.nastenka.filter((b) => b.vitaz === p && b.lokalita !== null).map((b) => b.lokalita?.defId as string);
      expect([...stitkyPartie(stav, p, ach("rozneLokality"))].sort()).toEqual([...new Set(vyhrate)].sort());
      expect(hodnotaVPartii(stav, p, ach("kradezPriZajati"))).toBe(Math.max(0, ...s.nastenka.map((b) => b.kradez?.[p] ?? 0)));
      expect([...stitkyPartie(stav, p, ach("zajatiStarsi"))].sort()).toEqual(s.vazni.filter((v) => v.hrac === p).map((v) => v.elderId).sort());

      // Koniec partie.
      const vyhral = vitaz === p;
      expect(partia("vyhraOChlp")).toBe(vyhral && body !== null && body[p] - body[su] <= 5 ? 1 : 0);
      const finale = s.nastenka.at(-1);
      const predFinale = s.nastenka.at(-2);
      const zoZadu = vyhral && finale?.finale === true && finale.vitaz === p && predFinale !== undefined && predFinale.spakyPo[p] < predFinale.spakyPo[su];
      expect(partia("vyhraFinaleZoZadu")).toBe(zoZadu ? 1 : 0);
      const cirhozy = [...s.hraci[p].ruka, ...s.hraci[p].doberaci, ...s.hraci[p].odhadzovaci].filter((c) => c.defId === "cirhoza").length;
      expect(hodnotaVPartii(stav, p, ach("nepriznaneCirhozyVyhra"))).toBe(vyhral ? cirhozy : 0);
      // Výhra strachom je vždy okamžitá výhra bez konečných špakov.
      if (partia("vyhraStrachom") > 0) expect(vyhral && body === null).toBe(true);

      // Kontext zo servera: deň, hodina, odveta — a metriky mimo partie v partii nič nedajú.
      expect(stitkyPartie(stav, p, ach("hraciDen"))).toEqual(["2026-11-11"]);
      expect(partia("nocnaPartia")).toBe(1);
      expect(partia("odveta")).toBe(vyhral && p === 0 ? 1 : 0);
      expect(agregatPartie(stav, p, ach("nazory"))).toBeUndefined();
      expect(agregatPartie(stav, p, ach("hodnotenia"))).toBeUndefined();
    }
    // Výtržník sa ráta obom rovnako.
    expect(agregatPartie(stav, 0, ach("vytrznik"))).toBe(agregatPartie(stav, 1, ach("vytrznik")));
  });

  it("bez kontextu servera: deň, noc ani odveta sa nerátajú; cez deň nie je nočná partia", () => {
    const bez = prehraj(61, { botPovaha: null, superi: [null, null] });
    const den = prehraj(61, { botPovaha: null, superi: [null, null], den: "2026-11-11", hodina: 14 });
    for (const p of [0, 1] as const) {
      expect(stitkyPartie(bez.stav, p, ach("hraciDen"))).toEqual([]);
      expect(agregatPartie(bez.stav, p, ach("nocnaPartia"))).toBeUndefined();
      expect(agregatPartie(bez.stav, p, ach("odveta"))).toBeUndefined();
      expect(agregatPartie(den.stav, p, ach("nocnaPartia"))).toBeUndefined();
      expect(stitkyPartie(den.stav, p, ach("hraciDen"))).toEqual(["2026-11-11"]);
    }
  });
});

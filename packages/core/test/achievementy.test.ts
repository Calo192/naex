// Achievementy (Michal 2026-10-23): katalóg sú dáta, jadro počíta metriky
// v oknách bitka / Pitka / kolo / partia; kariéru sčíta server.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import achievementyJson from "../data/achievementy.json";
import type { Achievement, Command, GameState, KatalogAchievementov, PlayerId, StavAchievementov, ZiskVPartii } from "../src/index.ts";
import {
  apply,
  chybaloMalo,
  hodnotaVPartii,
  agregatPartie,
  krokAchievementov,
  legalCommands,
  loadGameData,
  metrika,
  nacitajAchievementy,
  naTahu,
  noveAchievementy,
  noveStatistiky,
  popisRanku,
  pripocitajKarieru,
  rankZaHodnotu,
  rngInt,
  rngSeed,
  setupGame,
  stitkyPartie,
  zapisTah,
  zoznamMetrik,
} from "../src/index.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

const ach = (a: Partial<Achievement> & { id: string; metrika: string; rozsah: Achievement["rozsah"]; prahy: number[] }): Record<string, unknown> => ({
  nazov: a.id,
  popis: "Aspoň {prah}.",
  ...a,
});

/** Náhodná partia (bez vzdania) — každý krok cez krokAchievementov. */
function prehraj(katalog: KatalogAchievementov, seed: number): { s: GameState; stav: StavAchievementov; zisky: [ZiskVPartii[], ZiskVPartii[]]; kroky: [GameState, Command, PlayerId, GameState, ReturnType<typeof apply>["events"]][] } {
  let s = setupGame(data, seed);
  let rng = rngSeed(seed);
  let stav = noveAchievementy();
  const zisky: [ZiskVPartii[], ZiskVPartii[]] = [[], []];
  const kroky: [GameState, Command, PlayerId, GameState, ReturnType<typeof apply>["events"]][] = [];
  for (let i = 0; i < 6000 && s.koniec === null; i++) {
    const p = naTahu(s);
    if (p === null) break;
    const cmds = legalCommands(data, s, p).filter((c) => c.type !== "vzdat");
    const [j, r] = rngInt(rng, cmds.length);
    rng = r;
    const cmd = cmds[j] as Command;
    const { state: po, events } = apply(data, s, cmd, p);
    const krok = krokAchievementov(katalog, data, stav, s, cmd, p, po, events);
    stav = krok.stav;
    zisky[0].push(...krok.zisky[0]);
    zisky[1].push(...krok.zisky[1]);
    kroky.push([s, cmd, p, po, events]);
    s = po;
  }
  return { s, stav, zisky, kroky };
}

describe("achievementy — katalóg", () => {
  it("data/achievementy.json sa načíta: každá metrika existuje, prahy rastú, id sú jedinečné", () => {
    const k = nacitajAchievementy(achievementyJson);
    expect(k.achievementy.length).toBeGreaterThan(0);
    for (const a of k.achievementy) expect(metrika(a.metrika), a.id).not.toBeNull();
  });

  it("chybný katalóg: všetky chyby naraz, s id achievementu", () => {
    const zly = {
      achievementy: [
        ach({ id: "a", metrika: "neexistuje", rozsah: "bitka", prahy: [1] }),
        ach({ id: "b", metrika: "vyhra", rozsah: "bitka", prahy: [3, 2] }),
        ach({ id: "b", metrika: "vyhra", rozsah: "partia", prahy: [1] }),
        { ...ach({ id: "c", metrika: "vyhra", rozsah: "partia", prahy: [1] }), rozsah: "tyzden", proti: "mimozemstania" },
      ],
    };
    let sprava = "";
    try {
      nacitajAchievementy(zly);
    } catch (e) {
      sprava = (e as Error).message;
    }
    expect(sprava).toMatch(/\(a\): neznáma metrika „neexistuje“/);
    expect(sprava).toMatch(/\(b\): prahy/);
    expect(sprava).toMatch(/\(b\): id už je použité/);
    expect(sprava).toMatch(/\(c\): rozsah/);
    expect(sprava).toMatch(/\(c\): proti/);
  });

  it("metriky: stat.*, akcia.*, body.*, moment.* a vlastné; predvolená agregácia podľa metriky", () => {
    const ids = zoznamMetrik().map((m) => m.id);
    expect(ids).toEqual(expect.arrayContaining(["vyhra", "prebytokBitky", "stat.naex", "stat.najvacsiZasah", "akcia.Rana", "body.lokality", "moment.zvrat"]));
    expect(ids).not.toContain("stat.partie");
    expect(metrika("stat.najvacsiZasah")?.druh).toBe("max");
    expect(metrika("stat.tuheUdelene")?.druh).toBe("sucet");
    const k = nacitajAchievementy({ achievementy: [ach({ id: "x", metrika: "stat.najvacsiZasah", rozsah: "partia", prahy: [5] })] });
    expect(k.achievementy[0]?.agregacia).toBe("max");
    expect(k.achievementy[0]?.proti).toBe("ludia");
  });

  it("rank = počet dosiahnutých prahov, popis dosadí prah ranku", () => {
    const a = nacitajAchievementy({ achievementy: [ach({ id: "x", metrika: "vyhra", rozsah: "kariera", prahy: [1, 10, 50], popis: "Vyhraj {prah} partií." })] }).achievementy[0] as Achievement;
    expect([0, 1, 9, 10, 49, 50, 99].map((h) => rankZaHodnotu(a, h))).toEqual([0, 1, 1, 2, 2, 3, 3]);
    expect(popisRanku(a, 2)).toBe("Vyhraj 10 partií.");
  });
});

describe("achievementy — sledovanie partie", () => {
  const katalog = nacitajAchievementy({
    achievementy: [
      ach({ id: "tuhe-bitka", metrika: "stat.tuheUdelene", rozsah: "bitka", prahy: [1, 4, 8] }),
      ach({ id: "tuhe-partia", metrika: "stat.tuheUdelene", rozsah: "partia", prahy: [1, 10, 1000] }),
      ach({ id: "naex-kolo", metrika: "stat.naex", rozsah: "kolo", prahy: [1, 2, 3] }),
      ach({ id: "poldeci-pitka", metrika: "stat.poldeciVypite", rozsah: "pitka", prahy: [1, 2, 3] }),
      ach({ id: "vyhra", metrika: "vyhra", rozsah: "partia", prahy: [1] }),
      ach({ id: "dohrata", metrika: "dohrataPartia", rozsah: "partia", prahy: [1] }),
      ach({ id: "vyhry-kariera", metrika: "vyhra", rozsah: "kariera", prahy: [1] }),
    ],
  });
  const a = (id: string): Achievement => katalog.achievementy.find((x) => x.id === id) as Achievement;

  it("okná sedia s nezávislým prepočtom zo štatistík: bitka, kolo, Pitka, partia", () => {
    for (const seed of [11, 12, 13]) {
      const { stav, kroky } = prehraj(katalog, seed);
      // Nezávisle: štatistiky krok po kroku, prírastky do okien podľa stavu pred krokom.
      let stat = noveStatistiky();
      const bitka: [number, number] = [0, 0];
      const kolo = [new Map<number, number>(), new Map<number, number>()];
      const pitka = [new Map<string, number>(), new Map<string, number>()];
      for (const [pred, cmd, autor, po, events] of kroky) {
        const nove = zapisTah(stat, pred, cmd, autor, po, events);
        for (const p of [0, 1] as const) {
          const dTuhe = nove[p].tuheUdelene - stat[p].tuheUdelene;
          if (events.some((e) => e.type === "bitkaVysledok")) bitka[p] = Math.max(bitka[p], dTuhe);
          kolo[p]?.set(pred.kolo, (kolo[p]?.get(pred.kolo) ?? 0) + nove[p].naex - stat[p].naex);
          const kp = `${pred.kolo}:${pred.pitkaCislo}`;
          pitka[p]?.set(kp, (pitka[p]?.get(kp) ?? 0) + nove[p].poldeciVypite - stat[p].poldeciVypite);
        }
        stat = nove;
      }
      for (const p of [0, 1] as const) {
        expect(hodnotaVPartii(stav, p, a("tuhe-bitka"))).toBe(bitka[p]);
        expect(hodnotaVPartii(stav, p, a("naex-kolo"))).toBe(Math.max(0, ...(kolo[p]?.values() ?? [])));
        expect(hodnotaVPartii(stav, p, a("poldeci-pitka"))).toBe(Math.max(0, ...(pitka[p]?.values() ?? [])));
        expect(hodnotaVPartii(stav, p, a("tuhe-partia"))).toBe(stat[p].tuheUdelene);
      }
    }
  });

  it("zisky: rank v partii len rastie, výhru má víťaz, kariéru jadro nehlási", () => {
    const { s, zisky } = prehraj(katalog, 21);
    expect(s.koniec).not.toBeNull();
    for (const p of [0, 1] as const) {
      const posledny = new Map<string, number>();
      for (const z of zisky[p]) {
        expect(z.rank).toBeGreaterThan(posledny.get(z.id) ?? 0);
        posledny.set(z.id, z.rank);
      }
      expect(zisky[p].some((z) => z.id === "vyhry-kariera")).toBe(false);
      expect(zisky[p].some((z) => z.id === "dohrata")).toBe(true);
      expect(zisky[p].some((z) => z.id === "vyhra")).toBe(s.koniec?.vitaz === p);
    }
  });

  it("vzdanie: žiadna výhra ani dohratá partia, agregát kariéry výhier ostane prázdny", () => {
    let s = setupGame(data, 31);
    let stav = noveAchievementy();
    const p = naTahu(s) as PlayerId;
    const { state: po, events } = apply(data, s, { type: "vzdat" }, p);
    const krok = krokAchievementov(katalog, data, stav, s, { type: "vzdat" }, p, po, events);
    stav = krok.stav;
    s = po;
    expect(s.koniec).not.toBeNull();
    expect([...krok.zisky[0], ...krok.zisky[1]].map((z) => z.id)).not.toEqual(expect.arrayContaining(["vyhra"]));
    expect([...krok.zisky[0], ...krok.zisky[1]].some((z) => z.id === "dohrata")).toBe(false);
    expect(agregatPartie(stav, 0, a("vyhry-kariera"))).toBeUndefined();
    expect(agregatPartie(stav, 1, a("vyhry-kariera"))).toBeUndefined();
  });

  it("chýbalo málo: ďalší rank od 60 % cesty, tajné nie, najviac 3 najbližšie", () => {
    const k = nacitajAchievementy({
      achievementy: [
        ach({ id: "a", metrika: "vyhra", rozsah: "kariera", prahy: [10, 20] }),
        ach({ id: "b", metrika: "vyhra", rozsah: "kariera", prahy: [10] }),
        ach({ id: "c", metrika: "vyhra", rozsah: "kariera", prahy: [10] }),
        ach({ id: "d", metrika: "vyhra", rozsah: "kariera", prahy: [10] }),
        ach({ id: "e", metrika: "vyhra", rozsah: "kariera", prahy: [10] }),
        { ...ach({ id: "tajny", metrika: "vyhra", rozsah: "kariera", prahy: [10] }), tajny: true },
      ],
    });
    const hodnoty = new Map([
      ["a", 16],
      ["b", 9],
      ["c", 7],
      ["d", 5],
      ["e", 8],
      ["tajny", 9],
    ]);
    // a: má ★1 (16 ≥ 10), k ★2 má 80 % ako e — pri zhode poradie katalógu; d má len 50 % — nie.
    expect(chybaloMalo(k, hodnoty, new Map([["a", 1]]))).toEqual([
      { id: "b", rank: 1, hodnota: 9, prah: 10 },
      { id: "a", rank: 2, hodnota: 16, prah: 20 },
      { id: "e", rank: 1, hodnota: 8, prah: 10 },
    ]);
  });
});

describe("achievementy — všetky metriky", () => {
  it("každá metrika prejde náhodnými partiami bez chyby, záporné sú len body; koncové metriky dostane víťaz", () => {
    const metriky = zoznamMetrik();
    const katalog = nacitajAchievementy({
      achievementy: metriky.map((m, i) =>
        ach({ id: `m${i}`, metrika: m.id, rozsah: m.druh === "seria" || m.druh === "rozne" ? "kariera" : "partia", prahy: [1] }),
      ),
    });
    for (const seed of [51, 52, 53]) {
      const kontext = { botPovaha: "stamgast", superi: ["hrac-b", "hrac-a"] as const };
      let s = setupGame(data, seed);
      let rng = rngSeed(seed);
      let stav = noveAchievementy();
      for (let i = 0; i < 6000 && s.koniec === null; i++) {
        const p = naTahu(s);
        if (p === null) break;
        const cmds = legalCommands(data, s, p).filter((c) => c.type !== "vzdat");
        const [j, r] = rngInt(rng, cmds.length);
        rng = r;
        const cmd = cmds[j] as Command;
        const { state: po, events } = apply(data, s, cmd, p);
        stav = krokAchievementov(katalog, data, stav, s, cmd, p, po, events, kontext).stav;
        s = po;
      }
      expect(s.koniec).not.toBeNull();
      const vitaz = s.koniec?.vitaz ?? null;
      // Body môžu byť záporné (Dlhy, Cirhózy) — ostatné metriky nie.
      for (const a of katalog.achievementy.filter((x) => x.metrika !== "stat.body" && !x.metrika.startsWith("body."))) {
        for (const p of [0, 1] as const) expect(agregatPartie(stav, p, a) ?? 0, `${a.metrika} hráč ${p}`).toBeGreaterThanOrEqual(0);
      }
      const hodnota = (id: string, p: PlayerId): number | undefined => agregatPartie(stav, p, katalog.achievementy.find((a) => a.metrika === id) as Achievement);
      for (const p of [0, 1] as const) {
        expect(hodnota("dohrataPartia", p)).toBe(1);
        expect(hodnota("rozniSuperi", p)).toBe(1);
        expect(hodnota("najvacsiaRuka", p)).toBeGreaterThan(0);
        expect(hodnota("kartyVLinii", p)).toBeGreaterThan(0);
        expect(hodnota("vyhra", p)).toBe(vitaz === p ? 1 : undefined);
        expect(hodnota("vyhraNad.stamgast", p)).toBe(vitaz === p ? 1 : undefined);
        expect(hodnota("porazenePovahy", p)).toBe(vitaz === p ? 1 : undefined);
        expect(hodnota("seriaVyhier", p)).toBe(vitaz === null ? 0 : vitaz === p ? 1 : 0);
        expect(stitkyPartie(stav, p, katalog.achievementy.find((a) => a.metrika === "rozniSuperi") as Achievement)).toEqual([kontext.superi[p]]);
      }
    }
  });

  it("kariéra: súčet, rekord a séria výhier (vlastné vzdanie ju preruší)", () => {
    const k = nacitajAchievementy({
      achievementy: [
        ach({ id: "sucet", metrika: "vyhra", rozsah: "kariera", prahy: [5] }),
        ach({ id: "max", metrika: "prebytokBitky", rozsah: "kariera", prahy: [5] }),
        ach({ id: "seria", metrika: "seriaVyhier", rozsah: "kariera", prahy: [3] }),
      ],
    });
    const [sucet, max, seria] = k.achievementy as [Achievement, Achievement, Achievement];
    expect(pripocitajKarieru(sucet, { hodnota: 4, aktualna: 0 }, 1)).toEqual({ hodnota: 5, aktualna: 0 });
    expect(pripocitajKarieru(sucet, { hodnota: 4, aktualna: 0 }, undefined)).toEqual({ hodnota: 4, aktualna: 0 });
    expect(pripocitajKarieru(max, { hodnota: 9, aktualna: 0 }, 6)).toEqual({ hodnota: 9, aktualna: 0 });
    let s = { hodnota: 0, aktualna: 0 };
    for (const v of [1, 1, 0, 1, 1, 1, undefined, 0]) s = pripocitajKarieru(seria, s, v);
    expect(s).toEqual({ hodnota: 3, aktualna: 0 });
    expect(() => nacitajAchievementy({ achievementy: [ach({ id: "x", metrika: "seriaVyhier", rozsah: "partia", prahy: [3] })] })).toThrow(/len pre rozsah kariera/);
  });
});

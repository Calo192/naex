// Vývojový scenár zajatia (scenar.ts): partia proti botovi so staršími na stupni 3 — tok
// zajatia a presvedčenia (§10, v11.4) sa dá prejsť v prehliadači. Na živom webe sa nesmie zapnúť.

import { describe, expect, it } from "vitest";
import type { Command, GameState, PlayerId } from "@naex/core";
import { apply, kandidatiRozdelenia, krokRozdelenia, bodyRozdelenia, loadGameData, moznostiAkcie, mozeHrat, naTahu, rngInt, rngSeed, setupGame, strachZ, tahBota, vazniNaVyhru } from "@naex/core";
import cardsJson from "../../core/data/cards.json" with { type: "json" };
import eldersJson from "../../core/data/elders.json" with { type: "json" };
import scorecardsJson from "../../core/data/scorecards.json" with { type: "json" };
import { pouziScenar, scenarZProstredia } from "../src/scenar.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

/** Ťahy botov (aj za človeka), kým neplatí podmienka; vráti stav, v ktorom platí. */
function hrajKym(s0: GameState, podmienka: (s: GameState) => boolean, seed = 7): GameState {
  let s = s0;
  let rng = rngSeed(seed);
  for (let i = 0; i < 5000 && s.koniec === null && !podmienka(s); i++) {
    const p = ([0, 1] as const).find((q) => mozeHrat(s, q)) ?? naTahu(s);
    if (p === null) break;
    const [n, r] = rngInt(rng, 2 ** 31);
    rng = r;
    const cmd: Command = tahBota(data, s, p as PlayerId, n, { povaha: "stamgast" });
    s = apply(data, s, cmd, p).state;
  }
  return s;
}

describe("scenár zajatia — len mimo produkcie", () => {
  it("NAEX_SCENAR platí len na lokálnom serveri; na produkcii a s neznámym menom sa ignoruje", () => {
    expect(scenarZProstredia({ NAEX_SCENAR: "zajatie" }).scenar).toBe("zajatie");
    expect(scenarZProstredia({ NAEX_SCENAR: "zajatie-vyhra" }).scenar).toBe("zajatie-vyhra");
    expect(scenarZProstredia({})).toEqual({ scenar: undefined, ignorovany: null });
    expect(scenarZProstredia({ NAEX_SCENAR: "zajatie", NODE_ENV: "production" })).toEqual({ scenar: undefined, ignorovany: "zajatie" });
    expect(scenarZProstredia({ NAEX_SCENAR: "zajatie", NAEX_SECURE_COOKIE: "1" })).toEqual({ scenar: undefined, ignorovany: "zajatie" });
    expect(scenarZProstredia({ NAEX_SCENAR: "vsetko" })).toEqual({ scenar: undefined, ignorovany: "vsetko" });
  });
});

describe("scenár zajatia — rozdanie", () => {
  const s0 = setupGame(data, 11);

  it("prvý starší sa človeka bojí na červenej (strach 3), druhý bota; posledné dvoch smie presvedčiť človek a bot; cigarety navyše", () => {
    const s = pouziScenar(s0, "zajatie", 0);
    expect(strachZ(s.starsi[0]!, 0)).toBe(3);
    expect(strachZ(s.starsi[1]!, 1)).toBe(3);
    expect(s.starsi.at(-2)!.strach).toEqual([2, 3]);
    expect(s.starsi.at(-1)!.strach).toEqual([3, 2]);
    expect(s.starsi.slice(2, -2).every((e) => JSON.stringify(e) === JSON.stringify(s0.starsi.find((x) => x.elderId === e.elderId)))).toBe(true);
    expect(s.hraci[0].cigarety).toBeGreaterThan(s0.hraci[0].cigarety);
    expect(s.hraci[1].cigarety).toBeGreaterThan(s0.hraci[1].cigarety);
    expect(s.vazni).toEqual([]);
  });

  it("zajatie-vyhra: človek má dvoch väzňov (1. a 2. v partii) — zo stupnice zmizli", () => {
    const s = pouziScenar(s0, "zajatie-vyhra", 0);
    expect(s.vazni.map((v) => [v.hrac, v.poradie])).toEqual([
      [0, 1],
      [0, 2],
    ]);
    expect(s.starsi).toHaveLength(s0.starsi.length - 2);
    for (const v of s.vazni) expect(s.starsi.some((e) => e.elderId === v.elderId)).toBe(false);
    expect(s.vazni.length).toBe(vazniNaVyhru(s0.lokalitCelkom) - 1);
  });
});

describe("scenár zajatia — tok v jadre (§10, v11.4)", () => {
  /**
   * Partia, kým človek (hráč 0) nerozdeľuje Nakladačku so zajatím na dosah; potom zajme prvého
   * možného staršieho. null = v tomto rozdaní na to nedošlo (človek nevyhral s Nakladačkou aspoň 5).
   */
  function zajatie(rozdanie: number): boolean | null {
    const s0 = pouziScenar(setupGame(data, rozdanie), "zajatie", 0);
    const s = hrajKym(s0, (x) => x.faza === "bitka" && krokRozdelenia(x, 0) === "prebytok" && moznostiAkcie(x, 0, "strach", bodyRozdelenia(x, 0)).length > 0);
    if (s.koniec !== null || krokRozdelenia(s, 0) !== "prebytok") return null;
    const ciel = moznostiAkcie(s, 0, "strach", bodyRozdelenia(s, 0))[0]!;
    const zdvihy = kandidatiRozdelenia(s, 0, "strach", bodyRozdelenia(s, 0), 4, [ciel])[0]!;
    const po = apply(data, s, { type: "prebytok", zdvihy, zajatia: [ciel] }, 0).state;
    expect(po.vazni.find((v) => v.elderId === ciel)?.hrac).toBe(0);
    expect(po.starsi.some((e) => e.elderId === ciel)).toBe(false);
    return true;
  }

  // Výsledok bitky závisí od rozdaných kariet — zajatie človeka sa hľadá v rade rozdaní.
  it("v niektorom rozdaní človek vyhrá bitku s Nakladačkou aspoň 5 a zajme staršieho na červenej", () => {
    let najdene = false;
    for (let rozdanie = 1; rozdanie <= 30 && !najdene; rozdanie++) najdene = zajatie(rozdanie) === true;
    expect(najdene).toBe(true);
  }, 30_000);
});

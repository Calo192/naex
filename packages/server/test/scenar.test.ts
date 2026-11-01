// Vývojový scenár zajatia (scenar.ts): partia proti botovi so staršími na stupni 3 — tok
// zajatia (§10) sa dá prejsť v prehliadači. Na živom webe sa nesmie zapnúť.

import { describe, expect, it } from "vitest";
import type { Command, GameState, PlayerId } from "@naex/core";
import { KONSTANTY, apply, loadGameData, moznePokusy, mozeHrat, naTahu, rngInt, rngSeed, setupGame, strachZ, tahBota, viewFor } from "@naex/core";
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

  it("prvý starší sa človeka bojí na stupni 3, druhý bota, tretí je na žltej človeka; cigarety navyše", () => {
    const s = pouziScenar(s0, "zajatie", 0);
    expect(strachZ(s.starsi[0]!, 0)).toBe(3);
    expect(strachZ(s.starsi[1]!, 1)).toBe(3);
    // Kapybara potrebuje staršieho mimo stredu, ktorý nie je v ohrození (inak by jadro partiu zaseklo).
    expect(s.starsi[2]!.marker).toBe(2);
    expect(s.starsi.slice(3).every((e) => e.marker === s0.starsi.find((x) => x.elderId === e.elderId)?.marker)).toBe(true);
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
    expect(s.vazni.length).toBe(KONSTANTY.VAZNI_NA_VYHRU - 1);
  });
});

describe("scenár zajatia — tok v jadre (§10)", () => {
  const vysledky = new Set<string>();
  // Rozdanie 11: človek bitku vyhrá (väzeň), rozdanie 12: nie (ústup na oranžovú) — oba výsledky.
  it.each([11, 12])("rozdanie %i: po braní zo šenku sa pokus ponúkne, boss ide súperovi do ruky a po bitke je väzeň alebo ústup", (rozdanie) => {
    const s0 = pouziScenar(setupGame(data, rozdanie), "zajatie", 0);
    const ciel = s0.starsi[0]!.elderId;
    // Krok zajatia, keď rozhoduje človek (hráč 1 = bot, jeho voľbu urobí bot).
    const s = hrajKym(s0, (x) => x.faza === "draft" && x.draftStav?.krok === "zajatie" && x.draftStav.naTahu === 0);
    expect(s.draftStav?.krok).toBe("zajatie");
    expect(moznePokusy(s, 0).map((e) => e.elderId)).toContain(ciel);
    const karta = s.starsi.find((e) => e.elderId === ciel)!.karta;
    const po = apply(data, s, { type: "pokus", elderId: ciel }, 0).state;
    expect(po.pokusy[0]).toEqual({ elderId: ciel });
    expect(po.hraci[1].ruka.some((k) => k.uid === karta.uid)).toBe(true);
    // Súper bossa v ruke vidí; človek vie, že je u súpera (pokus je verejný), ostatné karty nie.
    const pohladCloveka = viewFor(data, po, 0);
    expect(pohladCloveka.pokusy[0]).toEqual({ elderId: ciel });
    expect(viewFor(data, po, 1).ruka.some((k) => k.uid === karta.uid)).toBe(true);
    expect(pohladCloveka.ruka.some((k) => k.uid === karta.uid)).toBe(false);
    expect(pohladCloveka.hraci[1].rukaPocet).toBe(po.hraci[1].ruka.length);
    // Dohrá sa kolo: výsledok je väzeň človeka, alebo starší späť o stupeň (oranžová).
    const konec = hrajKym(po, (x) => x.pokusy[0] === null);
    const vazen = konec.vazni.find((v) => v.elderId === ciel);
    vysledky.add(vazen === undefined ? "ustup" : "vazen");
    if (vazen !== undefined) {
      expect(vazen.hrac).toBe(0);
      expect(konec.starsi.some((e) => e.elderId === ciel)).toBe(false);
    } else {
      expect(strachZ(konec.starsi.find((e) => e.elderId === ciel)!, 0)).toBe(2);
      expect(konec.hraci[1].ruka.some((k) => k.uid === karta.uid)).toBe(false);
    }
  });

  it("rozdania pokryli oba výsledky — väzeň aj ústup", () => {
    expect([...vysledky].sort()).toEqual(["ustup", "vazen"]);
  });
});

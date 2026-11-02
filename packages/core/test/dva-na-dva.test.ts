// Formát 2 na 2 (Michal 2026-10-28, roadmapa #24): tím je hráč z 1 na 1 s dvoma
// rukami — zdroje, balíčky a kliatby sú tímu, osobná je len ruka a ťah.
// Miesto pri stole: tím = miesto % 2, člen = miesto ÷ 2.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import {
  DLZKY_HRY,
  apply,
  KONSTANTY,
  clenMiesta,
  kapitan,
  kartyVRukach,
  loadGameData,
  miestaHry,
  miestoClena,
  miestoNaTahu,
  opponentOf,
  partnerMiesta,
  poradieVykladania,
  prahCirhozyBonus,
  prahDlhuBonus,
  rukaMiesta,
  setupGame,
  timMiesta,
} from "../src/index.ts";
import type { GameState, Miesto } from "../src/index.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

describe("miesta pri stole", () => {
  it("miesta 0 a 1 sú prví členovia tímov — v 1 na 1 je miesto hráč", () => {
    const miesta: Miesto[] = [0, 1, 2, 3];
    expect(miesta.map(timMiesta)).toEqual([0, 1, 0, 1]);
    expect(miesta.map(clenMiesta)).toEqual([0, 0, 1, 1]);
    for (const m of miesta) expect(miestoClena(timMiesta(m), clenMiesta(m))).toBe(m);
  });
});

describe("príprava 2 na 2", () => {
  const s = setupGame(data, 7, { format: "2na2" });

  it("štyri miesta, každý hráč má štartovacie karty vo vlastnej ruke", () => {
    expect(s.format).toBe("2na2");
    expect(miestaHry(s)).toEqual([0, 1, 2, 3]);
    const start = Object.values(KONSTANTY.START_RUKA).reduce((a, b) => a + b, 0);
    for (const m of miestaHry(s)) expect(rukaMiesta(s, m)).toHaveLength(start);
    const uid = new Set(miestaHry(s).flatMap((m) => rukaMiesta(s, m).map((k) => k.uid)));
    expect(uid.size).toBe(4 * start);
    expect(kartyVRukach(s.hraci[0])).toHaveLength(2 * start);
  });

  it("tím začína s 3 poldeci a 4 cigaretami, prahy Dlhu a Cirhózy o 1 vyššie", () => {
    for (const h of s.hraci) {
      expect(h.poldeciPlne).toBe(3);
      expect(h.cigarety).toBe(4);
    }
    expect(prahDlhuBonus(s, 0)).toBe(1);
    expect(prahCirhozyBonus(s, 1)).toBe(1);
  });

  it("predvolená je Tretia liga", () => {
    expect(s.lokalitCelkom).toBe(DLZKY_HRY.kratka);
  });

  it("kapitáni zo semienka — v každom tíme jeden člen", () => {
    expect(s.kapitani).toBeDefined();
    expect(timMiesta(kapitan(s, 0))).toBe(0);
    expect(timMiesta(kapitan(s, 1))).toBe(1);
  });
});

/** Zhromaždenie 2 na 2 s tímovým limitom `limit`, na ťahu kapitán útočného tímu. */
function vZhromazdeni(limit: number): GameState {
  const s = setupGame(data, 7, { format: "2na2" });
  const lokalita = s.lokalityVHre[0];
  if (lokalita === undefined) throw new Error("Bez lokality.");
  return {
    ...s,
    faza: "zhromazdenie",
    ciel: { typ: "lokalita", lokalita },
    pitkyCelkom: 1,
    pitkaCislo: 0,
    zhromazdenieStav: {
      naTahu: kapitan(s, s.utocnik),
      zostavaLimit: [limit, limit],
      pasoval: [false, false],
      navyse: [0, 0],
      skoncili: [false, false, false, false],
    },
  };
}

/** Miesto na ťahu vyloží svoju Pijana na vlastnú stranu. */
function vylozPijana(s: GameState): GameState {
  const kto = miestoNaTahu(s);
  if (kto === null) throw new Error("Nikto nie je na ťahu.");
  const pijan = rukaMiesta(s, kto).find((k) => k.defId === "pijan");
  if (pijan === undefined) throw new Error("Bez Pijana.");
  return apply(data, s, { type: "place", uid: pijan.uid, target: "vlastna" }, kto).state;
}

describe("Zhromaždenie 2 na 2", () => {
  it("poradie U1 → O1 → U2 → O2, prví sú kapitáni; karta ide z ruky toho, kto vykladá", () => {
    let s = vZhromazdeni(3);
    const poradie = poradieVykladania(s);
    const u = s.utocnik;
    expect(poradie).toEqual([kapitan(s, u), kapitan(s, opponentOf(u)), partnerMiesta(kapitan(s, u)), partnerMiesta(kapitan(s, opponentOf(u)))]);
    const tahy: Miesto[] = [];
    for (let i = 0; i < 4; i++) {
      const kto = miestoNaTahu(s) as Miesto;
      tahy.push(kto);
      const pred = rukaMiesta(s, kto).length;
      const partnera = rukaMiesta(s, partnerMiesta(kto));
      s = vylozPijana(s);
      expect(rukaMiesta(s, kto)).toHaveLength(pred - 1);
      expect(rukaMiesta(s, partnerMiesta(kto))).toEqual(partnera);
    }
    expect(tahy).toEqual(poradie);
    // Limit je tímový: každý tím vyložil dve karty z troch.
    expect(s.zhromazdenieStav?.zostavaLimit).toEqual([1, 1]);
  });

  it("cudzie miesto ťahať nesmie", () => {
    const s = vZhromazdeni(3);
    const partner = partnerMiesta(miestoNaTahu(s) as Miesto);
    const karta = rukaMiesta(s, partner)[0];
    expect(() => apply(data, s, { type: "place", uid: karta?.uid ?? -1, target: "vlastna" }, partner)).toThrow();
  });

  it("pas člena je bez cigariet, tím dostane cigarety až za posledného", () => {
    let s = vZhromazdeni(3);
    const u = s.utocnik;
    const u1 = miestoNaTahu(s) as Miesto;
    const cig = s.hraci[u].cigarety;
    s = apply(data, s, { type: "pass" }, u1).state;
    expect(s.hraci[u].cigarety).toBe(cig);
    expect(s.zhromazdenieStav?.pasoval[u]).toBe(false);
    // O1 vyloží, U1 už nehrá — na ťahu je U2, potom O2.
    s = vylozPijana(s);
    expect(miestoNaTahu(s)).toBe(partnerMiesta(u1));
    s = apply(data, s, { type: "pass" }, partnerMiesta(u1)).state;
    // Tím nevyložil nič: zvyšok limitu 3, v rukách 8 kariet → 3 cigarety.
    expect(s.hraci[u].cigarety).toBe(cig + 3);
    expect(s.zhromazdenieStav?.pasoval[u]).toBe(true);
    expect(miestoNaTahu(s)).toBe(partnerMiesta(kapitan(s, opponentOf(u))));
  });

  it("keď skončia ostatní, hrá posledný sám a potom príde Pitka", () => {
    let s = vZhromazdeni(4);
    for (let i = 0; i < 3; i++) s = apply(data, s, { type: "pass" }, miestoNaTahu(s) as Miesto).state;
    const posledny = miestoNaTahu(s) as Miesto;
    s = vylozPijana(s);
    expect(miestoNaTahu(s)).toBe(posledny);
    s = apply(data, s, { type: "pass" }, posledny).state;
    expect(s.faza).toBe("pitka");
  });

  it("Záverečná ukončí vykladanie celého tímu", () => {
    let s = vZhromazdeni(3);
    const u1 = miestoNaTahu(s) as Miesto;
    const karta = rukaMiesta(s, u1).find((k) => k.defId === "pijan");
    s = apply(data, s, { type: "zaverecna", uid: karta?.uid ?? -1, target: "vlastna" }, u1).state;
    expect(s.zhromazdenieStav?.skoncili?.[partnerMiesta(u1)]).toBe(true);
    s = vylozPijana(s);
    // Útočný tím skončil — po O1 je na ťahu O2.
    expect(miestoNaTahu(s)).toBe(partnerMiesta(kapitan(s, opponentOf(s.utocnik))));
  });
});

describe("1 na 1 sa nemení", () => {
  const s = setupGame(data, 7);

  it("bez formátu, kapitánov a druhej ruky; prahy a zdroje ako doteraz", () => {
    expect(s.format).toBeUndefined();
    expect(s.kapitani).toBeUndefined();
    expect(miestaHry(s)).toEqual([0, 1]);
    for (const h of s.hraci) {
      expect(h.rukaDruheho).toBeUndefined();
      expect(h.poldeciPlne).toBe(KONSTANTY.START_POLDECI);
      expect(h.cigarety).toBe(KONSTANTY.START_CIGARETY);
    }
    expect(prahDlhuBonus(s, 0)).toBe(0);
    expect(kapitan(s, 1)).toBe(1);
  });
});

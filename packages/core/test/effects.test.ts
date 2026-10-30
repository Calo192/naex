// M10 — register efektov: pokrytie všetkých 51 id, MANUAL pripomienky
// a vzorové implementované efekty.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { CardInstance, Command, GameState, PlacedCard, PlayerId } from "../src/index.ts";
import {
  REGISTER,
  apply,
  doliatieZakazane,
  bitkaMody,
  computeDamage,
  jeEfektManual,
  legalCommands,
  limitBonus,
  loadGameData,
  naTahu,
  prahCirhozyBonus,
  setupGame,
} from "../src/index.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

let uidSeq = 9000;

function inst(defId: string): CardInstance {
  return { uid: ++uidSeq, defId, leftLayout: 0, rightLayout: 0 };
}

function placed(defId: string, playedBy: PlayerId): PlacedCard {
  return { card: inst(defId), playedBy };
}

/** Reálny stav zo setupGame s prepísanými poľami — hračky pre háčiky. */
function fakeState(overrides: Partial<GameState>): GameState {
  return { ...setupGame(data, 1), ...overrides };
}

describe("M10 — register", () => {
  // Nové karty (Michal 2026-10-20) sú v registri skôr než vo zverejnenej sade —
  // data/cards.json je jej kópia a doplní sa po zverejnení.
  // Náradie (Michal 2026-10-30) je v sade v39 — nič nečaká.
  const CAKAJU_NA_ZVEREJNENIE: string[] = [];

  it("pokrýva všetky id sady, navyše len karty čakajúce na zverejnenie", () => {
    const vRegistri = new Set(Object.keys(REGISTER));
    const vDatach = new Set(data.cards.keys());
    expect([...vDatach].filter((id) => !vRegistri.has(id))).toEqual([]);
    expect([...vRegistri].filter((id) => !vDatach.has(id) && !CAKAJU_NA_ZVEREJNENIE.includes(id))).toEqual([]);
  });

  it("neznáme id je automaticky MANUAL", () => {
    expect(jeEfektManual("nieco_nove")).toBe(true);
    expect(jeEfektManual("ihrisko")).toBe(false);
  });
});

describe("M10 — vzorové efekty (háčiky)", () => {
  it("ihrisko už prah Cirhózy nemení (Michal 2026-10-20 — nový efekt v bitke)", () => {
    const ihrisko = inst("ihrisko");
    expect(prahCirhozyBonus(fakeState({ ciel: { typ: "lokalita", lokalita: ihrisko } }), 0)).toBe(0);
  });

  it("nealko: prah Cirhózy +2; vinko doliatie aj +1 limit, zastávka spoločný limit", () => {
    const base = setupGame(data, 1);
    const sNealkom = fakeState({
      hraci: [{ ...base.hraci[0], dedicstvo: [inst("nealko")] }, base.hraci[1]],
    });
    expect(prahCirhozyBonus(sNealkom, 0)).toBe(2);
    expect(prahCirhozyBonus(sNealkom, 1)).toBe(0);

    const sVinkom = fakeState({
      hraci: [{ ...base.hraci[0], dedicstvo: [inst("vinko")] }, base.hraci[1]],
    });
    expect(doliatieZakazane(sVinkom, 0)).toBe(true);
    expect(doliatieZakazane(sVinkom, 1)).toBe(false);
    expect(limitBonus(sVinkom, 0)).toBe(1);
    expect(limitBonus(sVinkom, 1)).toBe(0);

  });

  it("čierna mačka už nepridáva ranu (nový text: len Vízie)", () => {
    const s = fakeState({
      strany: [[placed("cierna_macka", 0)], []],
      cirhozyVKole: [0, 2],
    });
    expect(bitkaMody(data, s, 0).tuheBonus).toBe(0);
  });


  it("Čierna mačka (v8.3, návrh P5): Povery sa Vierou nerušia — mäkké poškodenie nie je", () => {
    const strana = (sums: Record<string, number>, bezViery = false) => ({
      sums,
      cirhozaBonus: 0,
      tuheBonus: 0,
      abstaky: 0,
      priazenBitkara: 0,
      hodnotaViery: 1,
      ...(bezViery ? { poveryBezViery: true } : {}),
    });
    // Bez mačky: 1 Viera zruší 1 Poveru, zvyšné 3 idú na klebety.
    expect(computeDamage([strana({ Povera: 4 }), strana({ Viera: 1 })]).zvysnaPovera[0]).toBe(3);
    // S mačkou sa nerušia — Povery aj Viera ostávajú.
    const d = computeDamage([strana({ Povera: 4 }, true), strana({ Viera: 1 })]);
    expect(d.zvysnaPovera[0]).toBe(4);
    expect(d.zvysnaViera[1]).toBe(1);
    expect(d.makke).toEqual([0, 0]);
  });
});

describe("M10 — MANUAL režim", () => {
  it("tlačová sada už nemá žiadny neimplementovaný efekt (playtest 20261012-055944)", () => {
    expect(Object.entries(REGISTER).filter(([, st]) => st === "manual")).toEqual([]);
  });
});

/** Stav v Zhromaždení, hráč 0 na ťahu s voľným limitom. */
function zhrom(s: GameState): GameState {
  return {
    ...s,
    faza: "zhromazdenie",
    zhromazdenieStav: { naTahu: 0, zostavaLimit: [2, 2], pasoval: [false, false], navyse: [0, 0] },
  } as GameState;
}

describe("pravidlá v2 a nová tlačová sada", () => {
  it("Robota je akcia a Záhradkár má spúšťač Exekúcia (v7)", () => {
    // v9: Autobusár je boss — Robota je na ľavej strane (silueta A).
    expect(data.cards.get("autobusar")?.left.actions.Robota).toBe(1);
    expect(data.cards.get("zahradkar")?.triggers).toEqual(["Exekúcia"]);
  });


});

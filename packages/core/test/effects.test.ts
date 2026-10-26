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
  zahradkarHraca,
  limitBonus,
  spolocnyLimit,
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
  const CAKAJU_NA_ZVEREJNENIE: string[] = []; // sofer, snubenica, kar sú vo v11

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

    expect(spolocnyLimit(fakeState({ ciel: { typ: "lokalita", lokalita: inst("zastavka") } }))).toBe(true);
    expect(spolocnyLimit(fakeState({}))).toBe(false);
  });

  it("čierna mačka už nepridáva ranu (nový text: len Vízie)", () => {
    const s = fakeState({
      strany: [[placed("cierna_macka", 0)], []],
      cirhozyVKole: [0, 2],
    });
    expect(bitkaMody(data, s, 0).tuheBonus).toBe(0);
  });

  it("recidivista pridáva tuhé; farár a veterinár uberajú", () => {
    const s = fakeState({
      strany: [
        [placed("recidivista", 0), placed("pijan", 0), placed("farar", 0)],
        [placed("kocovnik", 1), placed("veterinar", 1)],
      ],
    });
    const mody0 = bitkaMody(data, s, 0);
    // kocovnik je Zahraničný → recidivista +1.
    expect(mody0.tuheBonus).toBe(1);
    // farár v partii 0: ignoruj 2 súperove Povery (pevné číslo, 2026-10-18).
    expect(mody0.superovePoveryZlava).toBe(2);
    // veterinár v partii 1: cirhózy hráča 1 pridávajú hráčovi 0 o 2 menej.
    expect(mody0.cirhozaZlava).toBe(2);
  });

  it("Neprajník a Čierna mačka: Povery nad súperove priznané Dlhy", () => {
    const strana = (sums: Record<string, number>, dlhy: number, nad?: number) => ({
      sums,
      cirhozaBonus: 0,
      tuheBonus: 0,
      abstaky: 0,
      priznaneDlhy: dlhy,
      priazenBitkara: 0,
      hodnotaViery: 1,
      ...(nad === undefined ? {} : { makkeNadDlhy: nad }),
    });
    // Bez priazne: mäkké je zastropené súperovými priznanými Dlhmi (1).
    expect(computeDamage([strana({ Povera: 4 }, 0), strana({}, 1)]).makke[0]).toBe(1);
    // Neprajník so silou 1 (priazeň 2): o 2 viac.
    expect(computeDamage([strana({ Povera: 4 }, 0, 2), strana({}, 1)]).makke[0]).toBe(3);
    // Čierna mačka: bez stropu.
    expect(computeDamage([strana({ Povera: 4 }, 0, Number.POSITIVE_INFINITY), strana({}, 0)]).makke[0]).toBe(4);
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
  it("Robota je akcia a Záhradkár má spúšťač Exekúcia", () => {
    expect(data.cards.get("autobusar")?.right.actions.Robota).toBe(1);
    expect(data.cards.get("zahradkar")?.triggers).toContain("Exekúcia");
  });

  it("v6: Záhradkára smie hráč pri exekúcii zahodiť namiesto špakov — hľadá sa v ruke aj v balíčkoch", () => {
    const s = fakeState({});
    const ja = s.hraci[0];
    const so = { ...s, hraci: [{ ...ja, ruka: [inst("zahradkar")] }, s.hraci[1]] as unknown as GameState["hraci"] };
    expect(zahradkarHraca(so, 0)).toBe("ruka");
    expect(zahradkarHraca(so, 1)).toBeNull();
  });

  it("pes sa nesmie vyložiť do partie s iným zvieraťom (a naopak)", () => {
    const base = fakeState({});
    const sPsom = {
      ...base,
      hraci: [{ ...base.hraci[0], ruka: [inst("cierna_macka")] }, base.hraci[1]],
      strany: [[placed("pes", 0)], []],
    } as unknown as GameState;
    const tahy = legalCommands(data, zhrom(sPsom), 0);
    expect(tahy.some((t) => t.type === "place" && t.target === "vlastna")).toBe(false);
    // Kontrola, že test nie je prázdny: občan sa k psovi vyložiť smie.
    const sObcanom = { ...sPsom, hraci: [{ ...base.hraci[0], ruka: [inst("pijan")] }, base.hraci[1]] } as unknown as GameState;
    const tahy2 = legalCommands(data, zhrom(sObcanom), 0);
    expect(tahy2.some((t) => t.type === "place" && t.target === "vlastna")).toBe(true);
  });
});

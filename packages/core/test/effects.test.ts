// M10 — register efektov: pokrytie všetkých 50 id, MANUAL pripomienky
// a vzorové implementované efekty.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import type { CardInstance, Command, GameState, PlacedCard, PlayerId } from "../src/index.ts";
import {
  REGISTER,
  apply,
  barterZakazany,
  bitkaMody,
  computeDamage,
  jeEfektManual,
  limitBonus,
  limitOverride,
  loadGameData,
  naTahu,
  prahCirhozyBonus,
  refillZakazany,
  setupGame,
} from "../src/index.ts";

const data = loadGameData(cardsJson, eldersJson);

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
  it("pokrýva všetkých 50 id, ani jedno navyše", () => {
    const vRegistri = new Set(Object.keys(REGISTER));
    const vDatach = new Set(data.cards.keys());
    expect([...vDatach].filter((id) => !vRegistri.has(id))).toEqual([]);
    expect([...vRegistri].filter((id) => !vDatach.has(id))).toEqual([]);
    expect(vRegistri.size).toBe(50);
  });

  it("neznáme id je automaticky MANUAL", () => {
    expect(jeEfektManual("nieco_nove")).toBe(true);
    expect(jeEfektManual("ihrisko")).toBe(false);
  });
});

describe("M10 — vzorové efekty (háčiky)", () => {
  it("ihrisko: prah Cirhózy +1, kým je lokalita odhalená", () => {
    const ihrisko = inst("ihrisko");
    expect(prahCirhozyBonus(fakeState({}))).toBe(0);
    expect(
      prahCirhozyBonus(
        fakeState({ ciel: { typ: "lokalita", lokalita: ihrisko, elderId: null } }),
      ),
    ).toBe(1);
    expect(
      prahCirhozyBonus(fakeState({ ovladnute: [{ karta: ihrisko, hrac: 0 }] })),
    ).toBe(1);
  });

  it("cigorky blokujú refill, vinko barter aj +1 limit, zastávka limit 2", () => {
    const base = setupGame(data, 1);
    const sCigorkami = fakeState({
      hraci: [{ ...base.hraci[0], dedicstvo: [inst("cigorky")] }, base.hraci[1]],
    });
    expect(refillZakazany(sCigorkami, 0)).toBe(true);
    expect(refillZakazany(sCigorkami, 1)).toBe(false);

    const sVinkom = fakeState({
      hraci: [{ ...base.hraci[0], dedicstvo: [inst("vinko")] }, base.hraci[1]],
    });
    expect(barterZakazany(sVinkom, 0)).toBe(true);
    expect(limitBonus(sVinkom, 0)).toBe(1);
    expect(limitBonus(sVinkom, 1)).toBe(0);

    expect(
      limitOverride(fakeState({ ciel: { typ: "lokalita", lokalita: inst("zastavka"), elderId: null } })),
    ).toBe(2);
  });

  it("čierna mačka: dodatočná Rana za súperov prah cirhózy v tomto kole", () => {
    const s = fakeState({
      partie: [[placed("cierna_macka", 0)], []],
      cirhozyVKole: [0, 2],
    });
    expect(bitkaMody(data, s, 0, 1, 2).tuheBonus).toBe(2);
    expect(bitkaMody(data, s, 1, 1, 2).tuheBonus).toBe(0);
  });

  it("recidivista a pes pridávajú tuhé; farár a veterinár uberajú", () => {
    const s = fakeState({
      partie: [
        [placed("recidivista", 0), placed("pes", 0), placed("pijan", 0), placed("farar", 0)],
        [placed("kocovnik", 1), placed("veterinar", 1)],
      ],
    });
    const mody0 = bitkaMody(data, s, 0, 1, 2);
    // kocovnik je Zahraničný → recidivista +1; pijan je Chlap → pes +1.
    expect(mody0.tuheBonus).toBe(2);
    // farár v partii 0: ignoruj trocha (1) povier súpera.
    expect(mody0.superovePoveryZlava).toBe(1);
    // veterinár v partii 1: cirhózy hráča 1 pridávajú hráčovi 0 o zopár menej.
    expect(mody0.cirhozaZlava).toBe(2);
  });

  it("noviny: povery vlastníka a viera súpera sa nerušia", () => {
    const strany = [
      { sums: { Povera: 2 }, cirhozaBonus: 0, tuheBonus: 0, abstaky: 0, priznaneDlhy: 0, priazenBitkara: 0, hodnotaViery: 1 },
      { sums: { Viera: 2 }, cirhozaBonus: 0, tuheBonus: 0, abstaky: 0, priznaneDlhy: 5, priazenBitkara: 0, hodnotaViery: 1 },
    ] as const;
    const bez = computeDamage([strany[0], strany[1]]);
    expect(bez.makke[0]).toBe(0); // povery zrušené vierou
    const sNovinami = computeDamage([strany[0], strany[1]], {
      poveraVieraSaNerusia: [true, false],
    });
    // Povery hráča 0 prežili (noviny) — mäkké obmedzené priznaným dlhom.
    expect(sNovinami.zvysnaPovera[0]).toBe(2);
    expect(sNovinami.makke[0]).toBe(2);
    // A viera hráča 1 zároveň ostala nedotknutá.
    expect(sNovinami.zvysnaViera[1]).toBe(2);
  });
});

describe("M10 — MANUAL režim", () => {
  it("neimplementovaný efekt sa pri bitke spoľahlivo pripomenie v logu", () => {
    // Odohráme začiatok kola: voľba lokality, draft bez kariet (3 cigarety),
    // obranca vyloží Pijana (MANUAL, spúšťač Bitka), obaja pasujú a preskočia
    // NA EX → bitka. V udalostiach musí byť manualEfekt pre Pijana.
    let state = setupGame(data, 7);
    const utocnik = state.utocnik;
    const obranca = utocnik === 0 ? 1 : 0;
    const lok = state.lokalityVHre[0];
    expect(lok).toBeDefined();
    if (lok === undefined) return;

    const krok = (cmd: Command, hrac: PlayerId) => {
      const result = apply(data, state, cmd, hrac);
      state = result.state;
      return result.events;
    };

    krok({ type: "chooseLocation", uid: lok.uid, otocena: false }, utocnik);
    krok({ type: "draft", cigarety: 3, karty: [] }, obranca);
    krok({ type: "draft", cigarety: 3, karty: [] }, utocnik);

    const pijan = state.hraci[obranca].ruka.find((k) => k.defId === "pijan");
    expect(pijan).toBeDefined();
    if (pijan === undefined) return;
    krok({ type: "place", uid: pijan.uid, target: "vlastna" }, obranca);
    krok({ type: "pass" }, naTahu(state) as PlayerId);
    krok({ type: "pass" }, naTahu(state) as PlayerId);
    const eventsObranca = krok({ type: "skipNaex" }, obranca);
    const eventsUtocnik =
      state.faza === "pitka" ? krok({ type: "skipNaex" }, utocnik) : eventsObranca;

    const pripomienky = eventsUtocnik.filter(
      (e) => e.type === "manualEfekt" && e.defId === "pijan",
    );
    expect(pripomienky.length).toBeGreaterThan(0);
  });
});

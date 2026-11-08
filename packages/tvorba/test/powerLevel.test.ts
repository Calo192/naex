import { describe, expect, it } from "vitest";
import cards from "../../core/data/cards.json";
import type { KartaNavrh, StranaNavrhu } from "../src/index.ts";
import { PREDVOLENE_VAHY, PREDVOLENE_VAHY_AKCII, ROZSAH_VAHY, platnaVaha, powerLevelKarty, zlucVahy } from "../src/index.ts";

const strana = (akcie: Record<string, number>): StranaNavrhu => ({ blokovane: [], akcie, povolene: {} });
const karta = (id: string, lava: Record<string, number>, prava: Record<string, number>, efekt = ""): Pick<KartaNavrh, "id" | "efekt" | "lava" | "prava"> => ({
  id,
  efekt,
  lava: strana(lava),
  prava: strana(prava),
});

describe("power level karty", () => {
  it("počet akcie × váha jej typu cez obe strany, plus váha efektu", () => {
    const vahy = { akcie: { Rana: 1, Pecka: 2, Dlh: -2 }, efekty: { brat: 3 } };
    const p = powerLevelKarty(karta("brat", { Rana: 2, Dlh: 1 }, { Pecka: 1, Rana: 1 }, "Raz za hru: niečo."), vahy);
    expect(p).toMatchObject({ lava: 0, prava: 3, efekt: 3, spolu: 6 });
    expect(p.polozky).toEqual([
      { strana: "lava", akcia: "Rana", pocet: 2, vaha: 1, body: 2 },
      { strana: "lava", akcia: "Dlh", pocet: 1, vaha: -2, body: -2 },
      { strana: "prava", akcia: "Pecka", pocet: 1, vaha: 2, body: 2 },
      { strana: "prava", akcia: "Rana", pocet: 1, vaha: 1, body: 1 },
    ]);
  });

  it("záporná akcia power level znižuje; neznáma akcia a nulový počet nerátajú", () => {
    const p = powerLevelKarty(karta("x", { PoškodeniePečene: 2, vlastna_tanec: 3 }, { Rana: 0 }), PREDVOLENE_VAHY);
    expect(p.spolu).toBe(2 * (PREDVOLENE_VAHY_AKCII.PoškodeniePečene ?? 0));
    expect(p.spolu).toBeLessThan(0);
    expect(p.polozky.map((x) => x.akcia)).toEqual(["PoškodeniePečene", "vlastna_tanec"]);
  });

  it("karta bez textu efektu nemá váhu efektu, aj keď je uložená", () => {
    expect(powerLevelKarty(karta("x", {}, {}, "  "), { akcie: {}, efekty: { x: 5 } }).efekt).toBe(0);
  });

  it("súčet je zaokrúhlený na stotiny", () => {
    expect(powerLevelKarty(karta("x", { A: 1 }, { B: 1 }), { akcie: { A: 0.1, B: 0.2 }, efekty: {} }).spolu).toBe(0.3);
  });

  it("predvolené váhy pokrývajú všetky akcie sady a sedia v rozsahu slidera", () => {
    expect(Object.keys(PREDVOLENE_VAHY_AKCII).sort()).toEqual([...cards.actions].sort());
    for (const v of Object.values(PREDVOLENE_VAHY_AKCII)) expect(platnaVaha(v)).toBe(v);
    expect(PREDVOLENE_VAHY_AKCII.Dlh).toBeLessThan(0);
    expect(PREDVOLENE_VAHY_AKCII.PoškodeniePečene).toBeLessThan(0);
  });

  it("uložené váhy prepíšu predvolené, ostatné ostanú", () => {
    const v = zlucVahy({ akcie: { Rana: -3 }, efekty: { brat: 1.5 } });
    expect(v.akcie.Rana).toBe(-3);
    expect(v.akcie.Pecka).toBe(PREDVOLENE_VAHY_AKCII.Pecka);
    expect(v.efekty).toEqual({ brat: 1.5 });
  });

  it("platná váha je číslo v rozsahu na celé kroky", () => {
    expect(platnaVaha(ROZSAH_VAHY.min)).toBe(ROZSAH_VAHY.min);
    expect(platnaVaha(ROZSAH_VAHY.max)).toBe(ROZSAH_VAHY.max);
    expect(platnaVaha(-0)).toBe(0);
    expect(platnaVaha(2.5)).toBe(2.5);
    for (const zla of [2.25, 10.5, -11, Number.NaN, Number.POSITIVE_INFINITY, "1", null, undefined]) expect(platnaVaha(zla)).toBeNull();
  });
});

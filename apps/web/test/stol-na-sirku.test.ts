// Stôl pre telefón na šírku (Michal 2026-10-31): zatiaľ len pre správcov. Ostatní na telefóne
// vidia oznam ako doteraz, počítač sa nemení; správca na telefóne hrá vždy na šírku a na výšku
// dostane výzvu otočiť telefón (stôl pod ňou ostáva). Tabuľa ty | súper ukazuje všetky čísla barov.

import { describe, expect, it } from "vitest";
import { dovodNepodporovania, stolNaSirku, type Zhoda } from "../src/hra/zariadenie.ts";
import { riadkyTabule, type CislaHraca } from "../src/hra/tabula.ts";

/** Zariadenie podľa rozmeru a vstupu — vyhodnotí dotazy z zariadenie.ts ako prehliadač. */
function zariadenie(sirka: number, vyska: number, dotyk: boolean): Zhoda {
  const podmienka = (p: string): boolean => {
    const m = /\((min|max)-(width|height): (\d+)px\)/.exec(p);
    if (m !== null) {
      const hodnota = m[2] === "width" ? sirka : vyska;
      return m[1] === "max" ? hodnota <= Number(m[3]) : hodnota >= Number(m[3]);
    }
    if (p === "(pointer: coarse)") return dotyk;
    if (p === "(orientation: landscape)") return sirka > vyska;
    if (p === "(orientation: portrait)") return vyska >= sirka;
    throw new Error(`neznámy dotaz ${p}`);
  };
  return (dotaz) => dotaz.split(",").some((cast) => cast.trim().split(" and ").every((p) => podmienka(p.trim())));
}

describe("telefón na šírku len pre správcu", () => {
  const telefonSirka = zariadenie(844, 390, true);
  const telefonVyska = zariadenie(390, 844, true);

  it("hráč na telefóne vidí oznam ako doteraz", () => {
    expect(dovodNepodporovania(telefonSirka, false)).toBe("dotyk");
    expect(dovodNepodporovania(telefonVyska, false)).toBe("dotyk");
    expect(stolNaSirku(telefonSirka, false)).toEqual({ naSirku: false, otoc: false });
  });

  it("správca hrá na telefóne na šírku, na výšku dostane výzvu otočiť (stôl ostáva)", () => {
    for (const [w, h] of [
      [844, 390],
      [932, 430],
      [780, 360],
    ] as const) {
      expect(dovodNepodporovania(zariadenie(w, h, true), true)).toBeNull();
      expect(stolNaSirku(zariadenie(w, h, true), true)).toEqual({ naSirku: true, otoc: false });
    }
    expect(dovodNepodporovania(telefonVyska, true)).toBeNull();
    expect(stolNaSirku(telefonVyska, true)).toEqual({ naSirku: true, otoc: true });
  });

  it("počítač a notebook sa nemenia ani správcovi", () => {
    for (const [w, h] of [
      [1920, 1080],
      [1366, 650],
      [1440, 800],
    ] as const) {
      for (const spravca of [false, true]) {
        expect(dovodNepodporovania(zariadenie(w, h, false), spravca)).toBeNull();
        expect(stolNaSirku(zariadenie(w, h, false), spravca).naSirku).toBe(false);
      }
    }
    // Úzke okno počítača ostáva „roztiahni ho“ aj správcovi.
    expect(dovodNepodporovania(zariadenie(844, 390, false), true)).toBe("uzke");
  });

  it("tablet na šírku hrá ako doteraz, na výšku správcovi radí otočiť", () => {
    expect(dovodNepodporovania(zariadenie(1180, 820, true), true)).toBeNull();
    expect(stolNaSirku(zariadenie(1180, 820, true), true).naSirku).toBe(false);
    expect(dovodNepodporovania(zariadenie(820, 1180, true), false)).toBe("dotyk");
    expect(dovodNepodporovania(zariadenie(820, 1180, true), true)).toBe("otoc");
  });
});

const cisla = (x: Partial<CislaHraca>): CislaHraca => ({
  karty: 5,
  balicek: 10,
  odhodene: 2,
  poldeci: 2,
  vypite: 1,
  limit: 3,
  chut: 2,
  nerestiDnes: 1,
  chutHrozi: false,
  abstaky: 0,
  dlhy: 0,
  exekucia: 0,
  zadlzenie: 1,
  prahDlhu: 3,
  cigarety: 4,
  pecen: 0,
  prahPecene: 3,
  spaky: 7,
  zaStarsich: 0,
  priznane: 0,
  dedicstvo: 1,
  vazni: 0,
  cirhozyNepriznane: 0,
  ...x,
});

describe("tabuľa ty | súper", () => {
  it("má riadok pre každé číslo baru a hodnoty oboch hráčov", () => {
    const r = riadkyTabule(cisla({ spaky: 12 }), cisla({ spaky: 3, cigarety: 9 }));
    const podla = new Map(r.map((x) => [x.kluc, x]));
    for (const k of ["karty", "poldeci", "limit", "cigarety", "spaky", "chut", "dlhy", "zadlzenie", "pecen", "balicek", "priznane", "dedicstvo", "vazni"]) {
      expect(podla.has(k), k).toBe(true);
    }
    expect(podla.get("spaky")).toMatchObject({ ja: "12", su: "3" });
    expect(podla.get("cigarety")).toMatchObject({ ja: "4", su: "9" });
    expect(podla.get("vazni")?.ja).toMatch(/^0\/\d$/);
  });

  it("zvýrazní, čo hráčovi škodí (exekúcia, hrozba Absťáku, pečeň pred Cirhózou)", () => {
    const r = riadkyTabule(cisla({ dlhy: 4, exekucia: 2, chutHrozi: true }), cisla({ pecen: 2 }));
    const podla = new Map(r.map((x) => [x.kluc, x]));
    expect(podla.get("dlhy")).toMatchObject({ ja: "4 (−2 š.)", zleJa: true, zleSu: false });
    expect(podla.get("chut")?.zleJa).toBe(true);
    expect(podla.get("pecen")).toMatchObject({ zleJa: false, zleSu: true });
  });

  it("bez Chuti v partii riadok Chuť vynechá", () => {
    expect(riadkyTabule(cisla({ chut: null }), cisla({ chut: null })).some((x) => x.kluc === "chut")).toBe(false);
  });
});

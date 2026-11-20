// Výučba v troch častiach (roadmapa #105): text na konci časti, pokračovanie z lobby
// a kedy výučba drží na stole líniu starších namiesto kariet.

import { describe, expect, it } from "vitest";
import { vetyTextu } from "../src/hra/bar.ts";
import { postupVyucby, rozpracovana, textNaKonci, ukazStarsichVoVyucbe, type VyucbaUctu } from "../src/hra/Vyucba.tsx";
import type { KrokVyucby } from "../src/hra/useHra.ts";

const UCET: VyucbaUctu = { krok: 0, spolu: 210, stav: null, dostupna: true, ponuknut: false, castiHotove: 0, cast: null, rozpracovana: false, dalsiaCast: null, pripravujeme: null };
const DRUHA = { cast: 2, nazov: "NA EX a podlosti", minuty: 16 };

describe("koniec časti výučby", () => {
  const view = { ja: 0 as const, koniec: null };

  const ROZLUCKA = "To je prvé kolo. Na zdravie!";

  it("len rozlúčka Melichara — kam ďalej povedia tlačidlá, text klienta ju neopakuje (V-18)", () => {
    expect(textNaKonci({ dalsiaCast: DRUHA, pripravujeme: null }, view, ROZLUCKA)).toBe(ROZLUCKA);
    expect(textNaKonci({ dalsiaCast: null, pripravujeme: DRUHA }, view, ROZLUCKA)).toBe(ROZLUCKA);
    expect(vetyTextu(textNaKonci({ dalsiaCast: DRUHA, pripravujeme: null }, view, ROZLUCKA))).toHaveLength(2);
  });

  it("po poslednej časti rozlúčka a výsledok partie", () => {
    const koniec = { vitaz: 0 as const, dovod: "", body: [27, 10] as const };
    const text = textNaKonci({ dalsiaCast: null, pripravujeme: null }, { ja: 0, koniec }, ROZLUCKA);
    expect(text).toMatch(/^To je prvé kolo\./);
    expect(text).toContain("Partia skončila 27 : 10 na špaky — vyhral si.");
  });
});

describe("postup výučby (V-22)", () => {
  const CASTI = [
    { cast: 1, minuty: 7 },
    { cast: 2, minuty: 15 },
    { cast: 3, minuty: 12 },
  ];

  it("úseky podľa minút, hotové časti plné, zostávajúce minúty z rozohranej časti", () => {
    const p = postupVyucby(CASTI, 2, 0.5);
    expect(p.useky.map((u) => [u.minuty, u.plne])).toEqual([
      [7, 1],
      [15, 0.5],
      [12, 0],
    ]);
    expect(p.zostava).toBe(8);
    expect(postupVyucby(CASTI, 1, 0.05).zostava).toBe(7);
    expect(postupVyucby(CASTI, 1, 0.99).zostava).toBe(1);
    expect(postupVyucby(CASTI, 3, 1).zostava).toBe(0);
  });
});

describe("pokračovať vo výučbe", () => {
  it("rozohraná časť aj hotová časť s ďalšou čakajúcou; hotová bez ďalšej nie", () => {
    expect(rozpracovana(UCET)).toBe(false);
    expect(rozpracovana({ ...UCET, krok: 12, rozpracovana: true, cast: { cast: 1, nazov: "Základy", minuty: 12 } })).toBe(true);
    expect(rozpracovana({ ...UCET, krok: 65, stav: "hotova", castiHotove: 1, dalsiaCast: DRUHA })).toBe(true);
    expect(rozpracovana({ ...UCET, krok: 65, stav: "hotova", castiHotove: 1, pripravujeme: DRUHA })).toBe(false);
  });
});

describe("línia starších vo výučbe po prvej bitke", () => {
  const krok = (cast: number, kto: KrokVyucby["kto"], zvyraznit: string[] = []): KrokVyucby => ({
    index: 0,
    spolu: 1,
    id: "x",
    kto,
    vykonany: false,
    cast: { cast, nazov: "", poradie: 0, krokov: 1 },
    melichar: "",
    zvyraznit,
    ocakava: null,
    moznosti: null,
    volba: null,
    tlacidlo: null,
    odovzdaCigaretu: false,
    preskocenie: false,
    naneisto: false,
  });

  it("1. časť po bitke vždy starší (aj na jej konci), ťah hráča nie; v 1. kole nikdy", () => {
    expect(ukazStarsichVoVyucbe({ krok: krok(1, "info"), koniecCasti: null }, 2)).toBe(true);
    expect(ukazStarsichVoVyucbe({ krok: null, koniecCasti: 1 }, 2)).toBe(true);
    expect(ukazStarsichVoVyucbe({ krok: krok(1, "hrac", ["starsi:farar"]), koniecCasti: null }, 2)).toBe(false);
    expect(ukazStarsichVoVyucbe({ krok: krok(1, "info", ["starsi:farar"]), koniecCasti: null }, 1)).toBe(false);
  });

  it("2. a 3. časť: starší len v kroku o nich, inak línia kariet a nástenka", () => {
    expect(ukazStarsichVoVyucbe({ krok: krok(2, "info", ["prevaha", "linia"]), koniecCasti: null }, 2)).toBe(false);
    expect(ukazStarsichVoVyucbe({ krok: krok(2, "info", ["linia-starsich"]), koniecCasti: null }, 2)).toBe(true);
    expect(ukazStarsichVoVyucbe({ krok: krok(3, "info", ["bar:body", "nastenka"]), koniecCasti: null }, 4)).toBe(false);
    expect(ukazStarsichVoVyucbe({ krok: null, koniecCasti: 2 }, 3)).toBe(false);
    // Kšeft vily posúva Hrobára — hráč ho má vidieť na stupnici; bežný ťah nie.
    expect(ukazStarsichVoVyucbe({ krok: krok(3, "hrac", ["starsi:hrobar", "tlacidlo:kseft"]), koniecCasti: null }, 4)).toBe(true);
    expect(ukazStarsichVoVyucbe({ krok: krok(3, "hrac", ["ruka:pijan"]), koniecCasti: null }, 4)).toBe(false);
  });
});

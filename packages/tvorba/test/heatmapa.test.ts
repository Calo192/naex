import { describe, expect, it } from "vitest";
import type { KartaNavrh, StranaNavrhu } from "../src/index.ts";
import { akcieNaKartach, heatmapaAkcii, variant, variantyKarty, vytlacenaPozicia } from "../src/index.ts";

const strana = (akcie: Record<string, number>, blokovane: StranaNavrhu["blokovane"] = []): StranaNavrhu => ({ blokovane, akcie, povolene: {} });

const karta = (id: string, lava: StranaNavrhu, prava: StranaNavrhu, tagy: string[] = ["Občan"]): KartaNavrh => ({
  id,
  nazov: id,
  tagy,
  efekt: "",
  obrazok: null,
  farba: null,
  mierkaTextu: 1,
  mierkaIkon: 1,
  sirkaMm: 54,
  vyskaMm: 80,
  kopie: 1,
  lava,
  prava,
  upravene: 0,
});

// Brat: vľavo Rana na 4 voľných pozíciách (4 rozloženia), vpravo Pecka s blokovanou 0 (3 rozloženia).
const brat = karta("brat", strana({ Rana: 1 }), strana({ Pecka: 1 }, [0]));
// Sused: vľavo 2× Rana na pozíciách 1–3 (0 blokovaná), vpravo pevne Rana na všetkých 4.
const sused = karta("sused", strana({ Rana: 2 }, [0]), strana({ Rana: 4 }));

/** Priemer cez všetky varianty karty hrubou silou — kontrola, že podiel strany je ten istý. */
function priemerCezVarianty(k: KartaNavrh, s: "lava" | "prava", i: number, akcia: string | null): number {
  const vs = variantyKarty(k);
  let zhody = 0;
  for (let v = 0; v < vs.pocet; v++) {
    const a = variant(vs, v)?.[s][i] ?? null;
    if (akcia === null ? a !== null : a === akcia) zhody++;
  }
  return zhody / vs.pocet;
}

describe("heatmapa akcií", () => {
  it("každá karta má váhu 1 a obsadenie je priemer cez jej varianty", () => {
    const h = heatmapaAkcii([brat, sused], { akcia: null, otocene: false });
    expect(h.pocetKariet).toBe(2);
    // Vľavo 0: brat 1/4, sused blokovaná.
    expect(h.lava[0].obsadene).toBeCloseTo(0.25);
    expect(h.lava[0].blokovane).toBe(1);
    // Vľavo 1: brat 1/4 + sused 2/3.
    expect(h.lava[1].obsadene).toBeCloseTo(0.25 + 2 / 3);
    // Vpravo 0: brat blokovaná, sused vždy.
    expect(h.prava[0].obsadene).toBeCloseTo(1);
    expect(h.prava[0].blokovane).toBe(1);
    expect(h.prava[2].obsadene).toBeCloseTo(1 / 3 + 1);
    for (const k of [brat, sused])
      for (const s of ["lava", "prava"] as const)
        for (let i = 0; i < 4; i++) {
          const b = h[s][i];
          const zaznam = b?.karty.find((x) => x.id === k.id && !x.blokovana);
          expect(zaznam?.podiel ?? 0).toBeCloseTo(priemerCezVarianty(k, s, i, null));
        }
  });

  it("konkrétna akcia počíta len svoje pozície", () => {
    const h = heatmapaAkcii([brat, sused], { akcia: "Pecka", otocene: false });
    expect(h.lava.map((b) => b.obsadene)).toEqual([0, 0, 0, 0]);
    expect(h.prava[0].obsadene).toBe(0);
    expect(h.prava[1].obsadene).toBeCloseTo(1 / 3);
    expect(h.prava[1].karty).toEqual([{ id: "brat", nazov: "brat", podiel: 1 / 3, blokovana: false }]);
    // Blokované pozície sa ukážu aj pri konkrétnej akcii.
    expect(h.prava[0].blokovane).toBe(1);
    expect(h.prava[0].karty).toEqual([{ id: "brat", nazov: "brat", podiel: 0, blokovana: true }]);
  });

  it("otočená karta: strany sa vymenia a pozícia i je na mieste 3 − i", () => {
    expect(vytlacenaPozicia("lava", 0, true)).toEqual({ strana: "prava", i: 3 });
    expect(vytlacenaPozicia("prava", 2, true)).toEqual({ strana: "lava", i: 1 });
    expect(vytlacenaPozicia("prava", 2, false)).toEqual({ strana: "prava", i: 2 });
    const rovno = heatmapaAkcii([brat, sused], { akcia: null, otocene: false });
    const otocene = heatmapaAkcii([brat, sused], { akcia: null, otocene: true });
    for (let i = 0; i < 4; i++) {
      expect(otocene.lava[i]?.obsadene).toBeCloseTo(rovno.prava[3 - i]?.obsadene ?? -1);
      expect(otocene.prava[i]?.blokovane).toBe(rovno.lava[3 - i]?.blokovane);
    }
    // Brat má blokovanú pravú 0 — otočený ju má vľavo dole.
    expect(otocene.lava[3].karty.find((k) => k.id === "brat")?.blokovana).toBe(true);
  });

  it("karta bez platného variantu do priemeru nevojde", () => {
    const zla = karta("zla", strana({ Rana: 5 }), strana({}));
    expect(heatmapaAkcii([zla, brat], { akcia: null, otocene: false }).pocetKariet).toBe(1);
  });

  it("akcie na kartách rátajú karty, nie kusy", () => {
    const m = akcieNaKartach([brat, sused]);
    expect(m.get("Rana")).toBe(2);
    expect(m.get("Pecka")).toBe(1);
  });
});

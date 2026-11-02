// Heatmapa akcií (stránka Karty, Michal 2026-11-02): ako sú v sade obsadené
// pozície kariet — 4 vľavo a 4 vpravo, 0 hore. Každá karta má váhu 1 a jej
// obsadenie je priemer cez všetky jej varianty; ľavá a pravá strana sa
// permutujú nezávisle, takže priemer cez varianty je podiel rozložení strany.

import type { KartaNavrh, Pozicia, StranaNavrhu } from "./typy.ts";
import { POZICIE } from "./typy.ts";
import { rozlozeniaStrany } from "./varianty.ts";

export type StranaHeatmapy = "lava" | "prava";

/** Karta, ktorá pozíciu obsadzuje (podiel jej variantov) alebo ju má blokovanú. */
export interface KartaVBunke {
  readonly id: string;
  readonly nazov: string;
  /** Podiel variantov karty (0–1), v ktorých na pozícii stojí hľadaná akcia; pri blokovanej 0. */
  readonly podiel: number;
  readonly blokovana: boolean;
}

export interface BunkaHeatmapy {
  /** Koľko kariet v priemere pozíciu obsadzuje (súčet podielov). */
  readonly obsadene: number;
  /** Koľko kariet má pozíciu blokovanú. */
  readonly blokovane: number;
  /** Karty s nenulovým podielom alebo blokovanou pozíciou, od najväčšieho podielu. */
  readonly karty: readonly KartaVBunke[];
}

export type StlpecHeatmapy = readonly [BunkaHeatmapy, BunkaHeatmapy, BunkaHeatmapy, BunkaHeatmapy];

export interface Heatmapa {
  /** Karty, ktoré vošli do výpočtu (aspoň jeden platný variant). */
  readonly pocetKariet: number;
  readonly lava: StlpecHeatmapy;
  readonly prava: StlpecHeatmapy;
}

export interface VolbyHeatmapy {
  /** Kľúč akcie; null = ľubovoľná akcia. */
  readonly akcia: string | null;
  /**
   * Karta na súperovej strane je otočená o 180°: jej pravá strana je vľavo
   * a pozícia i je na mieste 3 − i.
   */
  readonly otocene: boolean;
}

/** Na ktorej strane a pozícii vytlačenej karty leží efektívna pozícia (strana, i). */
export function vytlacenaPozicia(strana: StranaHeatmapy, i: Pozicia, otocene: boolean): { readonly strana: StranaHeatmapy; readonly i: Pozicia } {
  if (!otocene) return { strana, i };
  return { strana: strana === "lava" ? "prava" : "lava", i: (3 - i) as Pozicia };
}

/** Podiel rozložení strany s hľadanou akciou na pozícii, alebo null, keď je pozícia blokovaná. */
function podielyStrany(strana: StranaNavrhu, akcia: string | null): readonly (number | null)[] | null {
  const rozlozenia = rozlozeniaStrany(strana);
  if (rozlozenia.length === 0) return null;
  return POZICIE.map((p) => {
    if (strana.blokovane.includes(p)) return null;
    const zhody = rozlozenia.filter((r) => (akcia === null ? r[p] !== null : r[p] === akcia)).length;
    return zhody / rozlozenia.length;
  });
}

export function heatmapaAkcii(karty: readonly KartaNavrh[], volby: VolbyHeatmapy): Heatmapa {
  const bunky: Record<StranaHeatmapy, { obsadene: number; blokovane: number; karty: KartaVBunke[] }[]> = {
    lava: POZICIE.map(() => ({ obsadene: 0, blokovane: 0, karty: [] })),
    prava: POZICIE.map(() => ({ obsadene: 0, blokovane: 0, karty: [] })),
  };
  let pocetKariet = 0;
  for (const k of karty) {
    const vytlacene = { lava: podielyStrany(k.lava, volby.akcia), prava: podielyStrany(k.prava, volby.akcia) };
    // Karta bez platného variantu sa v hre nevyskytuje — do priemeru nepatrí.
    if (vytlacene.lava === null || vytlacene.prava === null) continue;
    pocetKariet++;
    for (const strana of ["lava", "prava"] as const) {
      for (const i of POZICIE) {
        const zdroj = vytlacenaPozicia(strana, i, volby.otocene);
        const podiel = vytlacene[zdroj.strana]?.[zdroj.i];
        const b = bunky[strana][i];
        if (b === undefined || podiel === undefined) continue;
        if (podiel === null) {
          b.blokovane++;
          b.karty.push({ id: k.id, nazov: k.nazov, podiel: 0, blokovana: true });
        } else if (podiel > 0) {
          b.obsadene += podiel;
          b.karty.push({ id: k.id, nazov: k.nazov, podiel, blokovana: false });
        }
      }
    }
  }
  const stlpec = (s: StranaHeatmapy): StlpecHeatmapy =>
    bunky[s].map((b) => ({
      obsadene: b.obsadene,
      blokovane: b.blokovane,
      karty: [...b.karty].sort((x, y) => Number(x.blokovana) - Number(y.blokovana) || y.podiel - x.podiel || x.nazov.localeCompare(y.nazov, "sk")),
    })) as unknown as StlpecHeatmapy;
  return { pocetKariet, lava: stlpec("lava"), prava: stlpec("prava") };
}

/** Akcie, ktoré sa na kartách naozaj vyskytujú, s počtom kariet, ktoré ich nesú. */
export function akcieNaKartach(karty: readonly KartaNavrh[]): ReadonlyMap<string, number> {
  const pocty = new Map<string, number>();
  for (const k of karty) {
    const kluce = new Set([...Object.entries(k.lava.akcie), ...Object.entries(k.prava.akcie)].filter(([, n]) => n > 0).map(([a]) => a));
    for (const a of kluce) pocty.set(a, (pocty.get(a) ?? 0) + 1);
  }
  return pocty;
}

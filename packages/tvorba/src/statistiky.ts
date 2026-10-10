// Štatistiky návrhov (MAUI DraftStatisticsService, ScorecardStatisticsService,
// ScorecardCategoryChanceService). Každá permutácia karty sa váži počtom
// tlačených kópií — presne tak, ako bude zastúpená v balíčku.

import type { BodovaciaKarta, KartaNavrh } from "./typy.ts";
import { variantyKarty } from "./varianty.ts";

/** Index 0..3 = ľavá strana, 4..7 = pravá (zhora nadol) — ako v MAUI. */
export const INDEXY = ["L0", "L1", "L2", "L3", "R0", "R1", "R2", "R3"] as const;

export interface PouzitieAkcie {
  readonly kluc: string;
  /** Počet návrhov, ktoré akciu majú (na ktorejkoľvek strane). */
  readonly navrhov: number;
  readonly podiel: number;
  /** Koľkokrát sa akcia objaví na všetkých vytlačených kartách. */
  readonly vyskytov: number;
}

export interface Statistiky {
  readonly navrhov: number;
  readonly vytlacenychKariet: number;
  readonly kopie: readonly { readonly id: string; readonly nazov: string; readonly permutacii: number; readonly kariet: number }[];
  readonly pouzitie: readonly PouzitieAkcie[];
  /** Pre akciu: šanca, že je na indexe (ak ju vytlačená karta má). */
  readonly pozicie: Readonly<Record<string, readonly number[]>>;
  /**
   * Páry: očakávaný počet stretnutí pravej akcie A jednej karty s ľavou
   * akciou B ďalšej karty na rovnakej pozícii, pre náhodnú dvojicu kariet.
   */
  readonly pary: Readonly<Record<string, Readonly<Record<string, number>>>>;
  readonly tagy: readonly { readonly tag: string; readonly navrhov: number }[];
  /** Podiel návrhov, ktoré majú index blokovaný. */
  readonly blokovane: readonly number[];
}

export function statistiky(karty: readonly KartaNavrh[]): Statistiky {
  const kopie: Statistiky["kopie"][number][] = [];
  const pouzitie = new Map<string, { navrhov: number; vyskytov: number }>();
  const naIndexe = new Map<string, number[]>();
  const sAkciou = new Map<string, number>();
  // Rozdelenie akcií na indexoch naprieč všetkými vytlačenými kartami.
  const pravo: Map<string, number>[] = [0, 1, 2, 3].map(() => new Map());
  const lavo: Map<string, number>[] = [0, 1, 2, 3].map(() => new Map());
  const tagy = new Map<string, number>();
  const blok = [0, 0, 0, 0, 0, 0, 0, 0];
  let vahy = 0;

  for (const k of karty) {
    const v = variantyKarty(k);
    kopie.push({ id: k.id, nazov: k.nazov, permutacii: v.pocet, kariet: v.pocet * k.kopie });
    for (const t of k.tagy) tagy.set(t, (tagy.get(t) ?? 0) + 1);
    for (const p of k.lava.blokovane) blok[p] = (blok[p] ?? 0) + 1;
    for (const p of k.prava.blokovane) blok[4 + p] = (blok[4 + p] ?? 0) + 1;
    const maAkcie = new Set([...Object.keys(k.lava.akcie), ...Object.keys(k.prava.akcie)].filter(
      (a) => (k.lava.akcie[a] ?? 0) + (k.prava.akcie[a] ?? 0) > 0,
    ));
    for (const a of maAkcie) {
      const u = pouzitie.get(a) ?? { navrhov: 0, vyskytov: 0 };
      u.navrhov++;
      pouzitie.set(a, u);
    }
    for (const l of v.lava) {
      for (const r of v.prava) {
        const w = k.kopie;
        vahy += w;
        const indexy = [...l, ...r];
        const vKarte = new Set<string>();
        indexy.forEach((a, i) => {
          if (a === null) return;
          vKarte.add(a);
          const u = pouzitie.get(a);
          if (u !== undefined) u.vyskytov += w;
          const arr = naIndexe.get(a) ?? [0, 0, 0, 0, 0, 0, 0, 0];
          arr[i] = (arr[i] ?? 0) + w;
          naIndexe.set(a, arr);
        });
        for (const a of vKarte) sAkciou.set(a, (sAkciou.get(a) ?? 0) + w);
        for (let i = 0; i < 4; i++) {
          const la = l[i];
          const ra = r[i];
          if (la !== null && la !== undefined) lavo[i]?.set(la, (lavo[i]?.get(la) ?? 0) + w);
          if (ra !== null && ra !== undefined) pravo[i]?.set(ra, (pravo[i]?.get(ra) ?? 0) + w);
        }
      }
    }
  }

  const pozicie: Record<string, number[]> = {};
  for (const [a, arr] of naIndexe) {
    const n = sAkciou.get(a) ?? 1;
    pozicie[a] = arr.map((x) => x / n);
  }
  const pary: Record<string, Record<string, number>> = {};
  if (vahy > 0) {
    for (let i = 0; i < 4; i++) {
      for (const [ra, rw] of pravo[i] ?? []) {
        for (const [la, lw] of lavo[i] ?? []) {
          const riadok = (pary[ra] ??= {});
          riadok[la] = (riadok[la] ?? 0) + (rw / vahy) * (lw / vahy);
        }
      }
    }
  }
  const n = karty.length;
  return {
    navrhov: n,
    vytlacenychKariet: kopie.reduce((s, k) => s + k.kariet, 0),
    kopie: kopie.sort((a, b) => b.kariet - a.kariet),
    pouzitie: [...pouzitie]
      .map(([kluc, u]) => ({ kluc, navrhov: u.navrhov, podiel: n === 0 ? 0 : u.navrhov / n, vyskytov: u.vyskytov }))
      .sort((a, b) => b.navrhov - a.navrhov || a.kluc.localeCompare(b.kluc)),
    pozicie,
    pary,
    tagy: [...tagy].map(([tag, navrhov]) => ({ tag, navrhov })).sort((a, b) => b.navrhov - a.navrhov),
    blokovane: blok.map((b) => (n === 0 ? 0 : b / n)),
  };
}

/**
 * Pre kategóriu (tag): šanca, že vložená karta tejto kategórie má na indexe
 * neprázdnu akciu — permutácie všetkých kariet kategórie s rovnakou váhou.
 */
export function sancaKategorie(karty: readonly KartaNavrh[], tag: string): number[] {
  const out = [0, 0, 0, 0, 0, 0, 0, 0];
  let n = 0;
  for (const k of karty.filter((x) => x.tagy.includes(tag))) {
    const v = variantyKarty(k);
    for (const l of v.lava) {
      for (const r of v.prava) {
        n++;
        [...l, ...r].forEach((a, i) => {
          if (a !== null) out[i] = (out[i] ?? 0) + 1;
        });
      }
    }
  }
  return out.map((x) => (n === 0 ? 0 : x / n));
}

/** Využitie ikon na bodovacích kartách: ikona → podiel kariet na indexe. */
export function statistikyBodovania(karty: readonly BodovaciaKarta[]): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  for (const k of karty) {
    [...k.lava, ...k.prava].forEach((ikona, i) => {
      if (ikona === null || ikona === undefined) return;
      const arr = (out[ikona] ??= [0, 0, 0, 0, 0, 0, 0, 0]);
      arr[i] = (arr[i] ?? 0) + 1 / Math.max(1, karty.length);
    });
  }
  return out;
}

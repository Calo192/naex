// Strany textu Melichara v bare (UI inšpekcia 20261120-1324, V-01): spojenie strán musí dať presne
// pôvodný text — žiadna veta dvakrát ani nikdy, aj keď sa veta nezmestí sama a ide po úsekoch.

import { describe, expect, it } from "vitest";
import { kusyStrany, rozdelNaStrany, usekyVety, vetyTextu } from "../src/hra/bar.ts";

/** Výška kusov [od, po) pri riadkoch po 20 px: každý kus má svoj počet riadkov. */
const vyskaZRiadkov =
  (riadky: readonly number[]) =>
  (od: number, po: number): number =>
    riadky.slice(od, po).reduce((s, r) => s + r * 20, 0);

function spojStrany<T>(kusy: readonly T[], zaciatky: readonly number[]): T[] {
  return zaciatky.flatMap((_, i) => {
    const [od, po] = kusyStrany(zaciatky, kusy.length, i);
    return kusy.slice(od, po);
  });
}

describe("strany textu v bare", () => {
  const text =
    "Bot Štamgast už neberie z ponuky (spolu 1). Dosť nákupov, klikni už neťahám (P). Cigarety budeš potrebovať. Tretie kolo, po bitke 2 karty: prišiel Miňištrant, a ten ti pomôže.";
  const vety = vetyTextu(text);

  it("vety textu dajú spolu celý text", () => {
    expect(vety.join("")).toBe(text);
    for (const v of vety) expect(usekyVety(v).join("")).toBe(v);
  });

  for (const [riadky, dostupne] of [
    [[1, 1, 1, 2], 40],
    [[1, 1, 1, 2], 20],
    [[2, 1, 3, 1], 40],
    [[1, 1, 1, 1], 200],
  ] as const) {
    it(`každý kus je na práve jednej strane (${riadky.join(",")} riadkov, ${dostupne} px)`, () => {
      const r = rozdelNaStrany(vety.length, vyskaZRiadkov(riadky), dostupne);
      expect(spojStrany(vety, r.zaciatky).join("")).toBe(text);
    });
  }

  it("kus, ktorý sa nezmestí ani sám, ostane na svojej strane a ohlási sa", () => {
    const r = rozdelNaStrany(3, vyskaZRiadkov([1, 3, 1]), 40);
    expect(r.zaciatky).toEqual([0, 1, 2]);
    expect(r.pretecie).toEqual([1]);
  });

  it("vynútený zlom začne novú stranu, aj keď by sa kus zmestil", () => {
    const r = rozdelNaStrany(4, vyskaZRiadkov([1, 1, 1, 1]), 200, new Set([2]));
    expect(r.zaciatky).toEqual([0, 2]);
    expect(spojStrany(["a", "b", "c", "d"], r.zaciatky).join("")).toBe("abcd");
  });

  it("strana mimo rozsahu ukáže poslednú, nie prázdnu ani dvakrát tú istú vetu", () => {
    expect(kusyStrany([0, 2, 3], 5, 9)).toEqual([3, 5]);
    expect(kusyStrany([0, 2, 3], 5, -1)).toEqual([0, 2]);
  });
});

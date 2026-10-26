// Záverečné bodovanie partií do v5 (archív): detail partie v profile číta súboje
// podmienok a „kto by staršieho bodoval“ zo záznamu, ktorý server uložil do kroniky.
// Od v6 (špaky) sa už nebodujú — overuje sa len čítanie starých záznamov.

import { describe, expect, it } from "vitest";
import type { BodPodmienky, BodyStarsieho, BodyTeraz } from "../src/hra/bodyPodmienok.tsx";
import { jeBodovanieV5, kohoBoduje, subojePoPodmienkach, subojeStarsieho } from "../src/hra/bodyPodmienok.tsx";

const pol = (podmienka: BodPodmienky["podmienka"], index: BodPodmienky["index"], kusy: number, body: number): BodPodmienky => ({ strana: "lava", index, podmienka, aktivna: true, kusy, body });

/** Záznam v5: dvaja starší, súboje o cigarety a Dlhy. */
const zaznam: BodyTeraz = {
  spolu: [3, 1],
  starsi: [
    { elderId: "farar", body: [3, 0], vyhry: [2, 0], strach: [2, 0], polozky: [[pol("cigarety", 0, 5, 1), pol("dlh", 1, 0, 1)], [pol("cigarety", 0, 1, 0), pol("dlh", 1, 2, 0)]] },
    { elderId: "hrobar", body: [0, 1], vyhry: [0, 1], strach: [0, 0], polozky: [[pol("cigarety", 2, 5, 0)], [pol("cigarety", 2, 1, 1)]] },
  ],
};

describe("archív v5: súboje pri starších", () => {
  it("kto boduje sedí s vyhrami, súčet so záznamom", () => {
    expect(jeBodovanieV5(zaznam)).toBe(true);
    let spolu: [number, number] = [0, 0];
    for (const s of zaznam.starsi) {
      const suboje = subojeStarsieho(s);
      expect([suboje.filter((x) => x.vitaz === 0).length, suboje.filter((x) => x.vitaz === 1).length]).toEqual(s.vyhry);
      spolu = [spolu[0] + s.body[0], spolu[1] + s.body[1]];
    }
    expect(spolu).toEqual(zaznam.spolu);
  });

  it("súboje podľa podmienky sčítajú vyhry cez všetkých starších", () => {
    const t = subojePoPodmienkach(zaznam).get("cigarety");
    expect(t?.pocet).toBe(2);
    expect(t?.vyhry).toEqual([1, 1]);
  });
});

describe("kohoBoduje", () => {
  const s = (body: readonly [number, number]): BodyStarsieho => ({ elderId: "x", body, vyhry: [0, 0], strach: [0, 0], polozky: [[], []] });
  it("jeden, obaja, nikto", () => {
    expect(kohoBoduje(s([3, 0]))).toBe(0);
    expect(kohoBoduje(s([0, 1]))).toBe(1);
    expect(kohoBoduje(s([2, 1]))).toBe("obaja");
    expect(kohoBoduje(s([0, 0]))).toBeNull();
  });
});

describe("staré partie (v4)", () => {
  it("bez vyhier pri staršom — krčmový účet číta body za kusy", () => {
    const v4 = { spolu: [4, 2], starsi: [{ elderId: "x", body: [4, 2], polozky: [[], []] }] } as unknown as BodyTeraz;
    expect(jeBodovanieV5(v4)).toBe(false);
  });
});

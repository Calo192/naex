// Poradie vitríny achievementov (UI inšpekcia W-35): rozpracované nezískané hore podľa postupu,
// ostatné pod nimi; nič sa nestratí a cudzí profil postup nevidí.

import { describe, expect, it } from "vitest";
import { poradieVitriny, type PolozkaVitriny } from "../src/achievementy/Vitrina.tsx";

const polozka = (id: string, rank: PolozkaVitriny["rank"], postup: [number, number] | null, legacy = false): PolozkaVitriny => ({
  id,
  nazov: id,
  popis: "",
  kategoria: "partie",
  tajny: false,
  ikona: null,
  obrazok: null,
  rank,
  rankCiela: "bronz",
  ziskane: rank === null ? null : 1000,
  postup: postup === null ? null : { hodnota: postup[0], prah: postup[1] },
  legacy,
});

const polozky = [
  polozka("a-nic", null, [0, 3]),
  polozka("b-tretina", null, [1, 3]),
  polozka("c-ziskany", "bronz", [2, 5]),
  polozka("d-polovica", null, [2, 4]),
  polozka("e-legacy", "striebro", null, true),
];

describe("poradie vitríny", () => {
  it("rozpracované hore podľa postupu, získané a legacy ostávajú medzi ostatnými", () => {
    const { rozpracovane, ostatne } = poradieVitriny(polozky, true);
    expect(rozpracovane.map((p) => p.id)).toEqual(["d-polovica", "b-tretina"]);
    expect(ostatne.map((p) => p.id)).toEqual(["e-legacy", "c-ziskany", "a-nic"]);
  });

  it("cudzí profil nemá Rozpracované, nič nechýba", () => {
    const { rozpracovane, ostatne } = poradieVitriny(polozky, false);
    expect(rozpracovane).toEqual([]);
    expect(ostatne).toHaveLength(polozky.length);
  });
});

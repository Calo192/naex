// M1 — dátová vrstva a generovanie variantov.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import { cardVariants, loadGameData, sideLayouts } from "../src/index.ts";

const data = loadGameData(cardsJson, eldersJson);

describe("M1 — načítanie dát", () => {
  it("načíta 50 kariet, 8 starších, 7 lokalít, 8 nástrojov", () => {
    expect(data.cards.size).toBe(50);
    expect(data.elders.size).toBe(8);
    expect(data.lokality.length).toBe(7);
    expect(data.nastroje.length).toBe(8);
    expect(data.staresinovia.length).toBe(8);
  });

  it("každý starší má kartu s tagom Starešina", () => {
    for (const elder of data.elders.values()) {
      const card = data.cards.get(elder.id);
      expect(card).toBeDefined();
      expect(card?.tags).toContain("Starešina");
    }
  });
});

describe("M1 — generovanie variantov", () => {
  it("pre všetkých 50 kariet sedí ľavé × pravé s permutations", () => {
    for (const def of data.cards.values()) {
      const v = cardVariants(def);
      expect(v.left.length, `${def.id} vľavo`).toBe(def.permutations.left);
      expect(v.right.length, `${def.id} vpravo`).toBe(def.permutations.right);
      expect(v.total, `${def.id} spolu`).toBe(def.permutations.total);
    }
  });

  it("blokovaná pozícia je prázdna v každom rozložení", () => {
    for (const def of data.cards.values()) {
      for (const [side, layouts] of [
        [def.left, sideLayouts(def.left)],
        [def.right, sideLayouts(def.right)],
      ] as const) {
        for (const layout of layouts) {
          for (const blocked of side.blocked) {
            expect(layout[blocked], `${def.id} slot ${blocked}`).toBeNull();
          }
        }
      }
    }
  });

  it("ihrisko má vpravo 1 rozloženie (Poldeci ×3 v 3 slotoch)", () => {
    const ihrisko = data.cards.get("ihrisko");
    expect(ihrisko).toBeDefined();
    if (ihrisko === undefined) return;
    const layouts = sideLayouts(ihrisko.right);
    expect(layouts.length).toBe(1);
    expect(layouts[0]).toEqual(["Poldeci", "Poldeci", "Poldeci", null]);
  });

  it("rozloženia sú deterministické a v stabilnom poradí", () => {
    const pijan = data.cards.get("pijan");
    expect(pijan).toBeDefined();
    if (pijan === undefined) return;
    const a = sideLayouts(pijan.left);
    const b = sideLayouts(pijan.left);
    expect(a).toEqual(b);
    // blocked [0], akcie PoškodeniePečene + Poldeci + 1 prázdne:
    // prázdno ("") radí pred akcie, Poldeci pred PoškodeniePečene.
    expect(a[0]).toEqual([null, null, "Poldeci", "PoškodeniePečene"]);
  });

  it("rozloženia v rámci strany sú navzájom rôzne", () => {
    for (const def of data.cards.values()) {
      for (const layouts of [sideLayouts(def.left), sideLayouts(def.right)]) {
        const seen = new Set(layouts.map((l) => JSON.stringify(l)));
        expect(seen.size, def.id).toBe(layouts.length);
      }
    }
  });
});

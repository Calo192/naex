// M1 — dátová vrstva a generovanie variantov.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import { cardVariants, loadGameData, sideLayouts } from "../src/index.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

describe("M1 — načítanie dát", () => {
  it("načíta 63 kariet, 8 starších, 15 lokalít, 8 nástrojov (sada v11 živého webu, 2026-10-23)", () => {
    expect(data.cards.size).toBe(63);
    expect(data.elders.size).toBe(8);
    expect(data.lokality.length).toBe(15);
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
  it("pre všetkých 63 kariet sedí ľavé × pravé s permutations", () => {
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

  it("zhodné akcie sa nepočítajú viackrát (Poldeci ×3 v 3 slotoch = 1)", () => {
    const layouts = sideLayouts({ blocked: [3], actions: { Poldeci: 3 } });
    expect(layouts.length).toBe(1);
    expect(layouts[0]).toEqual(["Poldeci", "Poldeci", "Poldeci", null]);
  });

  it("obmedzenie pozícií vyradí rozloženia so zakázanou akciou", () => {
    // Veterinár vpravo: Cigareta + Poldeci na pozíciách 1–2, Poldeci len na 1.
    const volne = sideLayouts({ blocked: [0, 3], actions: { Cigareta: 1, Poldeci: 1 } });
    expect(volne.length).toBe(2);
    const obmedzene = sideLayouts({
      blocked: [0, 3],
      actions: { Cigareta: 1, Poldeci: 1 },
      allowed: { 1: ["Poldeci"] },
    });
    expect(obmedzene).toEqual([[null, "Poldeci", "Cigareta", null]]);
  });

  it("rozloženia sú deterministické a v stabilnom poradí", () => {
    const strana = { blocked: [0] as const, actions: { PoškodeniePečene: 1, Poldeci: 1 } };
    const a = sideLayouts(strana);
    const b = sideLayouts(strana);
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

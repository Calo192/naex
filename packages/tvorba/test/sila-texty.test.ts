// Hromadná simulácia sily kariet a kontrola textov efektov.

import { describe, expect, it } from "vitest";
import cardsJson from "../../core/data/cards.json";
import eldersJson from "../../core/data/elders.json";
import scorecardsJson from "../../core/data/scorecards.json";
import { loadGameData } from "@naex/core";
import type { KartaNavrh, StranaNavrhu } from "../src/index.ts";
import { PREDVOLENE_AKCIE, PREDVOLENE_KLUCOVE_SLOVA, doCardsJson, kontrolaTextov, silaKariet } from "../src/index.ts";

type Raw = { id: string; name: string; tags: string[]; effect_text: string; left: RawSide; right: RawSide };
type RawSide = { blocked: number[]; actions: Record<string, number>; allowed?: Record<string, string[]> };

const strana = (s: RawSide): StranaNavrhu => ({
  blokovane: s.blocked as StranaNavrhu["blokovane"],
  akcie: s.actions,
  povolene: Object.fromEntries(Object.entries(s.allowed ?? {}).map(([k, v]) => [Number(k), v])),
});

const navrhy: KartaNavrh[] = (cardsJson as unknown as { cards: Raw[] }).cards.map((c) => ({
  id: c.id,
  nazov: c.name,
  tagy: c.tags,
  efekt: c.effect_text,
  obrazok: null,
  farba: null,
  mierkaTextu: 1.1,
  mierkaIkon: 1.3,
  sirkaMm: 54,
  vyskaMm: 80,
  kopie: 1,
  lava: strana(c.left),
  prava: strana(c.right),
  upravene: 0,
}));

describe("hromadná simulácia sily kariet", () => {
  const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

  it("je deterministická a pokryje karty z balíčka (bez lokalít, kliatob a starších)", () => {
    const a = silaKariet(data, { pokusov: 800, seed: 7 });
    const b = silaKariet(data, { pokusov: 800, seed: 7 });
    expect(a).toEqual(b);
    const ids = new Set(a.map((s) => s.defId));
    expect(ids.has("pijan")).toBe(true);
    expect(ids.has("krcma")).toBe(false);
    expect(ids.has("dlh")).toBe(false);
    for (const s of a) {
      expect(s.aktivacia).toBeGreaterThanOrEqual(0);
      expect(s.aktivacia).toBeLessThanOrEqual(1);
    }
  });

  it("karta s Petelicami na oboch stranách je v priemere silnejšia než karta bez útoku", () => {
    const silna: KartaNavrh = { ...navrhy[0]!, id: "test_silna", nazov: "Silná", tagy: ["Občan"], efekt: "", lava: { blokovane: [], akcie: { Petelica: 4 }, povolene: {} }, prava: { blokovane: [], akcie: { Petelica: 4 }, povolene: {} } };
    const slaba: KartaNavrh = { ...silna, id: "test_slaba", nazov: "Slabá", lava: { blokovane: [], akcie: { Viera: 1 }, povolene: {} }, prava: { blokovane: [], akcie: { Viera: 1 }, povolene: {} } };
    const d = loadGameData(doCardsJson([...navrhy, silna, slaba], "test"), eldersJson, scorecardsJson);
    const sila = silaKariet(d, { pokusov: 3000, seed: 3 });
    const tuhe = (id: string) => sila.find((s) => s.defId === id)?.tuhe ?? -1;
    expect(tuhe("test_silna")).toBeGreaterThan(tuhe("test_slaba"));
    expect(tuhe("test_slaba")).toBe(0);
  });
});

describe("kontrola textov efektov", () => {
  const podklady = { klucoveSlova: PREDVOLENE_KLUCOVE_SLOVA, akcie: PREDVOLENE_AKCIE };
  const karta = (efekt: string, id = "pijan"): KartaNavrh => ({ ...navrhy.find((k) => k.id === "pijan")!, id, efekt });

  it("nájde chýbajúci spúšťač, neznámy spúšťač, malé písmeno a chýbajúcu bodku", () => {
    const p = kontrolaTextov([karta("udelí ranu"), karta("Krčmička: Udelí ranu."), karta("Bitka: udelí ranu.")], podklady).map((x) => x.text);
    expect(p.some((t) => t.includes("nezačína spúšťačom"))).toBe(true);
    expect(p.some((t) => t.includes("„Krčmička:“"))).toBe(true);
    expect(p.some((t) => t.includes("malé písmeno"))).toBe(true);
    expect(p.some((t) => t.includes("nekončí bodkou"))).toBe(true);
  });

  it("upozorní na pojem bez diakritiky a na zmenený text implementovaného efektu", () => {
    const p = kontrolaTextov([karta("Dedičstvo: Akcia Poldeci nedoplna Poldecak.", "nealko")], {
      ...podklady,
      zverejnene: [{ id: "nealko", efekt: "Dedičstvo: Pôvodný text." }],
    });
    expect(p.some((x) => x.text.includes("„Poldecak“") && x.text.includes("poldecák"))).toBe(true);
    expect(p.some((x) => x.text.includes("nedopĺňa"))).toBe(true);
    expect(p.some((x) => x.uroven === "chyba" && x.text.includes("jadro"))).toBe(true);
  });

  it("nová karta s efektom je manual", () => {
    const p = kontrolaTextov([karta("Bitka: Udelí ranu.", "nova_karta")], { ...podklady, zverejnene: [] });
    expect(p.map((x) => x.text).join(" ")).toContain("manual");
  });
});

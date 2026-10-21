// Kontrola textov efektov.

import { describe, expect, it } from "vitest";
import cardsJson from "../../core/data/cards.json";
import type { KartaNavrh, StranaNavrhu } from "../src/index.ts";
import { PREDVOLENE_AKCIE, PREDVOLENE_KLUCOVE_SLOVA, kontrolaTextov } from "../src/index.ts";

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

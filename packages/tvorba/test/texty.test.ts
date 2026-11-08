// Kontrola textov efektov.

import { describe, expect, it } from "vitest";
import cardsJson from "../../core/data/cards.json";
import eldersJson from "../../core/data/elders.json";
import type { KartaNavrh, StranaNavrhu } from "../src/index.ts";
import { ALL_TRIGGERS } from "@naex/core";
import { PREDVOLENE_AKCIE, PREDVOLENE_KLUCOVE_SLOVA, kontrolaTextov, spustaceVTexte } from "../src/index.ts";

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

describe("Schopnosť väzňa (v11.2): „Väzeň — raz za hru:“ je spúšťač Väzeň", () => {
  const podklady = { klucoveSlova: PREDVOLENE_KLUCOVE_SLOVA, akcie: PREDVOLENE_AKCIE };
  const starsi = (eldersJson as { elders: { id: string; schopnost: string }[] }).elders;
  const hrobar = starsi.find((s) => s.id === "hrobar")!;
  const text = `Väzeň — raz za hru: ${hrobar.schopnost}`;
  const karta = (efekt: string): KartaNavrh => ({ ...navrhy.find((k) => k.id === "hrobar")!, efekt });

  it("spustaceVTexte dá Väzeň — aj s krátkou pomlčkou či spojovníkom", () => {
    expect(spustaceVTexte(text, ALL_TRIGGERS)).toEqual(["Väzeň"]);
    expect(spustaceVTexte("Väzeň – raz za hru: Dostaneš 4 cigarety.", ALL_TRIGGERS)).toEqual(["Väzeň"]);
    expect(spustaceVTexte("Väzeň - raz za hru: Dostaneš 4 cigarety.", ALL_TRIGGERS)).toEqual(["Väzeň"]);
    // Kšeft zanikol (frakcie 2026-11-08); Spoločník s piktogramom je spúšťač.
    expect(spustaceVTexte("Kšeft: Za 2 cigarety udelíš v bitke Ranu navyše.", ALL_TRIGGERS)).toEqual([]);
    expect(spustaceVTexte("Spoločník: Pamätník {Povera} {Povera}.", ALL_TRIGGERS)).toEqual(["Spoločník"]);
  });

  it("karty starších v cards.json majú spúšťač Väzeň", () => {
    const cards = (cardsJson as unknown as { cards: { id: string; effect_text: string; triggers: string[] }[] }).cards;
    for (const s of starsi) {
      const c = cards.find((k) => k.id === s.id)!;
      expect(c.triggers, s.id).toEqual(["Väzeň"]);
      expect(spustaceVTexte(c.effect_text, ALL_TRIGGERS), s.id).toEqual(["Väzeň"]);
    }
  });

  it("kontrola textov prijme text staršieho bez chyby — aj keď sa líši od zverejnenej sady", () => {
    const zverejnene = [{ id: "hrobar", efekt: "Väzeň — Kšeft: Za vypitý poldeci si vezmi kartu zo súperovho odhadzovacieho balíčka." }];
    expect(kontrolaTextov([karta(text)], podklady).filter((p) => p.uroven === "chyba")).toEqual([]);
    expect(kontrolaTextov([karta(text)], { ...podklady, zverejnene }).filter((p) => p.uroven === "chyba")).toEqual([]);
    expect(kontrolaTextov([karta(text)], { ...podklady, zverejnene, starsi }).filter((p) => p.uroven === "chyba")).toEqual([]);
  });

  it("text staršieho, ktorý nesedí s elders.json, je chyba", () => {
    const p = kontrolaTextov([karta("Väzeň — raz za hru: Vezmi si 2 karty zo súperovho odhadzovacieho balíčka.")], { ...podklady, starsi });
    expect(p.some((x) => x.uroven === "chyba" && x.text.includes("elders.json"))).toBe(true);
  });

  it("stará predpona „Väzeň — Kšeft:“ už nie je spúšťač", () => {
    expect(spustaceVTexte("Väzeň — Kšeft: Za vypitý poldeci si vezmi 1 kartu zo šenku.", ALL_TRIGGERS)).not.toContain("Väzeň");
  });
});

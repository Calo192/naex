import { describe, expect, it } from "vitest";
import cardsJson from "../../core/data/cards.json";
import eldersJson from "../../core/data/elders.json";
import scorecardsJson from "../../core/data/scorecards.json";
import { loadGameData } from "@naex/core";
import type { KartaNavrh, StranaNavrhu } from "../src/index.ts";
import {
  PREDVOLENE_AKCIE,
  PREDVOLENE_KATEGORIE,
  PREDVOLENE_KLUCOVE_SLOVA,
  doCardsJson,
  exportTxt,
  farbaKarty,
  formatujEfekt,
  geometriaKarty,
  importTxt,
  pastelHex,
  rozlozeniaStrany,
  slug,
  variantyKarty,
} from "../src/index.ts";

type Raw = { id: string; name: string; tags: string[]; effect_text: string; left: RawSide; right: RawSide };
type RawSide = { blocked: number[]; actions: Record<string, number>; allowed?: Record<string, string[]> };

function strana(s: RawSide): StranaNavrhu {
  return {
    blokovane: s.blocked as StranaNavrhu["blokovane"],
    akcie: s.actions,
    povolene: Object.fromEntries(Object.entries(s.allowed ?? {}).map(([k, v]) => [Number(k), v])),
  };
}

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

describe("tvorba — varianty a zverejnenie", () => {
  it("počty variantov tvorcu sedia s jadrom pre všetky karty", () => {
    const data = loadGameData(cardsJson, eldersJson, scorecardsJson);
    for (const k of navrhy) {
      expect(variantyKarty(k).pocet, k.id).toBe(data.variants.get(k.id)?.total);
    }
  });

  it("zverejnená sada prejde validáciou jadra a zachová permutácie", () => {
    const json = doCardsJson(navrhy, "test");
    const data = loadGameData(json, eldersJson, scorecardsJson);
    expect(data.cards.size).toBe(navrhy.length);
    // v7 (efekty): Záhradkár má spúšťač Exekúcia.
    expect(data.cards.get("zahradkar")?.triggers).toEqual(["Exekúcia"]);
  });

  it("obmedzenie pozícií filtruje rozloženia", () => {
    const s: StranaNavrhu = { blokovane: [0, 3], akcie: { Cigareta: 1, Poldeci: 1 }, povolene: { 1: ["Poldeci"] } };
    expect(rozlozeniaStrany(s)).toEqual([[null, "Poldeci", "Cigareta", null]]);
  });

  it("slug zodpovedá id kariet", () => {
    expect(slug("Silná, nezávislá žena")).toBe("silna_nezavisla_zena");
    expect(slug("Miňištrant")).toBe("ministrant");
  });
});

describe("tvorba — vzhľad", () => {
  it("pastelové farby sedia s tlačou", () => {
    expect(pastelHex(240)).toBe("#6a6ab8");
    expect(pastelHex(210)).toBe("#6a91b8");
    const pijan = navrhy.find((k) => k.id === "pijan");
    expect(pijan && farbaKarty(pijan, PREDVOLENE_KATEGORIE)).toBe("#b86a91");
  });

  it("geometria 54 × 80 mm dáva rozmery z tlačového PDF", () => {
    const g = geometriaKarty({ sirkaMm: 54, vyskaMm: 80, mierkaTextu: 1.104, mierkaIkon: 1.3, maTagy: true });
    expect(g.pas.h).toBeCloseTo(33.16, 1);
    expect(g.velkostNazvu).toBeCloseTo(11.04, 2);
    expect(g.slotyLave[0]?.w).toBeCloseTo(22.11, 1);
    expect(g.slotyLave[0]?.y).toBeCloseTo(22.93, 0);
  });

  it("spúšťač je tučný a začína nový riadok, pojmy kurzívou", () => {
    const riadky = formatujEfekt("Zhromaždenie: Každý hráč dobral. Bitka: Zahoď kartu a preskúmaj balíček.", PREDVOLENE_KLUCOVE_SLOVA);
    expect(riadky.length).toBe(2);
    expect(riadky[0]?.[0]).toMatchObject({ text: "Zhromaždenie:", tucne: true });
    expect(riadky[1]?.[0]).toMatchObject({ text: "Bitka:", tucne: true });
    const kurzivy = riadky.flat().filter((u) => u.kurziva).map((u) => u.text);
    expect(kurzivy).toEqual(["Zahoď", "preskúmaj"]);
    expect(riadky.flat().map((u) => u.text).join("")).toBe("Zhromaždenie: Každý hráč dobral.Bitka: Zahoď kartu a preskúmaj balíček.");
  });
});

describe("tvorba — export a import TXT", () => {
  it("export → import zachová karty", () => {
    const txt = exportTxt(navrhy, PREDVOLENE_AKCIE, new Date(2026, 9, 10, 12, 0));
    expect(txt).toContain("CARD 1: ");
    expect(txt).toContain("Actions: Hazard x2");
    const { karty, nezname } = importTxt(txt, PREDVOLENE_AKCIE);
    expect(nezname).toEqual([]);
    expect(karty.length).toBe(navrhy.length);
    for (const k of karty) {
      const povodna = navrhy.find((n) => n.nazov === k.nazov);
      expect(povodna, k.nazov).toBeDefined();
      expect(k.tagy).toEqual(povodna?.tagy);
      expect(k.efekt).toBe(povodna?.efekt);
      expect(variantyKarty(k).pocet).toBe(variantyKarty(povodna as KartaNavrh).pocet);
    }
  });

  it("neznáme akcie sa nahlásia a preskočia", () => {
    const txt = `------------------------------------------------------------
CARD 1: Test
------------------------------------------------------------
Tags: Občan
EFECT: Furt: nič.

LEFT side:
  Blocked positions: L0
  Available slots: 3 of 4
  Actions: Rana x1, Smrť x1
  Position restrictions: none (all positions allow every action)

RIGHT side:
  Blocked positions: none
  Available slots: 4 of 4
  Actions: none
  Position restrictions: none (all positions allow every action)

Total permutations: 6 (left 6 x right 1)
`;
    const { karty, nezname } = importTxt(txt, PREDVOLENE_AKCIE);
    expect(nezname).toEqual(["Smrť"]);
    expect(karty[0]?.lava).toEqual({ blokovane: [0], akcie: { Rana: 1 }, povolene: {} });
  });
});

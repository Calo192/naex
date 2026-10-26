// Príbeh a účel karty (Michal 2026-10-26): nepovinné texty pre stránku Pravidlá › Karty.
// Karta bez nich musí ostať v sade aj v exporte presne taká ako predtým a jadro ich nečíta.

import { describe, expect, it } from "vitest";
import cardsJson from "../../core/data/cards.json";
import eldersJson from "../../core/data/elders.json";
import scorecardsJson from "../../core/data/scorecards.json";
import { loadGameData } from "@naex/core";
import type { KartaNavrh } from "../src/index.ts";
import { PREDVOLENE_AKCIE, blokyTextu, doCardsJson, exportTxt, importTxt, sTextamiZImportu, sTextomKarty, textyKarty } from "../src/index.ts";

type Raw = { id: string; name: string; tags: string[]; effect_text: string; left: RawSide; right: RawSide };
type RawSide = { blocked: number[]; actions: Record<string, number>; allowed?: Record<string, string[]> };

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
  lava: {
    blokovane: c.left.blocked as KartaNavrh["lava"]["blokovane"],
    akcie: c.left.actions,
    povolene: Object.fromEntries(Object.entries(c.left.allowed ?? {}).map(([k, v]) => [Number(k), v])),
  },
  prava: {
    blokovane: c.right.blocked as KartaNavrh["prava"]["blokovane"],
    akcie: c.right.actions,
    povolene: Object.fromEntries(Object.entries(c.right.allowed ?? {}).map(([k, v]) => [Number(k), v])),
  },
  upravene: 0,
}));

const PRIBEH = "Kedysi furman, dnes stály hosť pri okne.\n\nVraví sa, že v Krčme prepil aj koňa.";
// Riadky, ktoré by bez odsadenia vyzerali ako hlavička karty alebo strany.
const UCEL = "Drží líniu pri sebe.\n- Zahraj ho pred bitkou o Krčmu.\n- Podstrč ho súperovi,\n  keď má málo kariet.\nLEFT side:\n------------------------------------------------------------\nCARD 9: Podvrh";

const sTextami: KartaNavrh[] = navrhy.map((k, i) => (i === 0 ? { ...k, pribeh: PRIBEH, ucel: UCEL } : i === 1 ? { ...k, pribeh: "Len príbeh." } : k));

describe("príbeh a účel karty — sada", () => {
  it("karta bez textov má v cardsJson rovnaké polia ako predtým", () => {
    const json = doCardsJson(navrhy, "test") as { cards: Record<string, unknown>[] };
    for (const c of json.cards) {
      expect(Object.keys(c)).toEqual(["id", "index", "name", "tags", "effect_text", "triggers", "left", "right", "permutations"]);
    }
  });

  it("texty idú so zverejnenou sadou, jadro ich ignoruje", () => {
    const json = doCardsJson(sTextami, "test") as { cards: Record<string, unknown>[] };
    expect(json.cards[0]?.pribeh).toBe(PRIBEH);
    expect(json.cards[0]?.ucel).toBe(UCEL);
    expect(json.cards[1]?.pribeh).toBe("Len príbeh.");
    expect("ucel" in (json.cards[1] ?? {})).toBe(false);
    expect("pribeh" in (json.cards[2] ?? {})).toBe(false);
    const data = loadGameData(json, eldersJson, scorecardsJson);
    const bez = loadGameData(doCardsJson(navrhy, "test"), eldersJson, scorecardsJson);
    const id = navrhy[0]?.id ?? "";
    expect(data.cards.get(id)).toEqual(bez.cards.get(id));
    expect(Object.keys(data.cards.get(id) ?? {})).not.toContain("pribeh");
  });
});

describe("príbeh a účel karty — tvorca", () => {
  it("prázdny text pole odstráni a návrat k pôvodnému textu dá ten istý JSON", () => {
    const k = sTextami[0] as KartaNavrh;
    const bez = sTextomKarty(sTextomKarty(k, "pribeh", ""), "ucel", "  \n");
    expect("pribeh" in bez || "ucel" in bez).toBe(false);
    expect(JSON.stringify(sTextomKarty(sTextomKarty(bez, "pribeh", PRIBEH), "ucel", UCEL))).toBe(JSON.stringify(k));
    expect(JSON.stringify(sTextomKarty(sTextomKarty(k, "ucel", "iný"), "ucel", UCEL))).toBe(JSON.stringify(k));
    expect(textyKarty(undefined, "")).toEqual({});
  });

  it("odseky, odrážky a pokračovanie odrážky", () => {
    expect(blokyTextu(UCEL)).toEqual([
      { typ: "odstavec", riadky: ["Drží líniu pri sebe."] },
      { typ: "odrazky", polozky: ["Zahraj ho pred bitkou o Krčmu.", "Podstrč ho súperovi, keď má málo kariet."] },
      { typ: "odstavec", riadky: ["LEFT side:", "------------------------------------------------------------", "CARD 9: Podvrh"] },
    ]);
    expect(blokyTextu(PRIBEH)).toEqual([
      { typ: "odstavec", riadky: ["Kedysi furman, dnes stály hosť pri okne."] },
      { typ: "odstavec", riadky: ["Vraví sa, že v Krčme prepil aj koňa."] },
    ]);
    expect(blokyTextu("• prvé\r\n* druhé\r\n\r\n\r\n")).toEqual([{ typ: "odrazky", polozky: ["prvé", "druhé"] }]);
    expect(blokyTextu("")).toEqual([]);
  });
});

describe("príbeh a účel karty — export a import TXT", () => {
  it("export → import zachová texty aj ostatné polia všetkých kariet", () => {
    const txt = exportTxt(sTextami, PREDVOLENE_AKCIE, new Date(2026, 9, 26, 12, 0));
    expect(txt).toContain("STORY:\n  Kedysi furman");
    expect(txt).toContain("PURPOSE: (none)");
    const { karty, nezname } = importTxt(txt, PREDVOLENE_AKCIE);
    expect(nezname).toEqual([]);
    expect(karty.length).toBe(sTextami.length);
    for (const k of karty) {
      const p = sTextami.find((n) => n.nazov === k.nazov);
      expect(p, k.nazov).toBeDefined();
      expect(k.efekt).toBe(p?.efekt);
      expect(k.tagy).toEqual(p?.tagy);
      expect(k.pribeh ?? "").toBe(p?.pribeh ?? "");
      expect(k.ucel ?? "").toBe(p?.ucel ?? "");
    }
  });

  it("súbor bez STORY a PURPOSE (MAUI) texty karty nechá, „(none)“ ich zmaže", () => {
    const k = sTextami[0] as KartaNavrh;
    const plny = exportTxt([k], PREDVOLENE_AKCIE, new Date(2026, 9, 26, 12, 0));
    const maui = `${plny.slice(0, plny.indexOf("\nSTORY:"))}\n`;
    expect(maui).toContain("Total permutations:");
    const zMaui = importTxt(maui, PREDVOLENE_AKCIE).karty[0];
    expect(zMaui?.nazov).toBe(k.nazov);
    expect(zMaui !== undefined && ("pribeh" in zMaui || "ucel" in zMaui)).toBe(false);
    expect(sTextamiZImportu(k, zMaui ?? {})).toEqual(k);

    const prazdne = importTxt(exportTxt([{ ...navrhy[0] } as KartaNavrh], PREDVOLENE_AKCIE, new Date()), PREDVOLENE_AKCIE).karty[0];
    expect(prazdne?.pribeh).toBe("");
    const zmazane = sTextamiZImportu(k, prazdne ?? {});
    expect("pribeh" in zmazane || "ucel" in zmazane).toBe(false);
  });
});

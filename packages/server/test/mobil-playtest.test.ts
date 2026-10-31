// Playtest UI/UX mobilného stola (tools/playtest/mobil.ts): displej, kolá partie
// zo stavu servera, ciele ťukov a výpis prvkov s malým cieľom.

import { describe, expect, it } from "vitest";
import {
  MENA_TESTEROV,
  PRAZDNY_STAV,
  type Prvok,
  type StavMobilu,
  bodCiela,
  citajDisplej,
  citajLigu,
  odohraneKola,
  oknoDispleja,
  popisPartie,
  riadokPrvku,
  vyrez,
  zapisView,
} from "../../../tools/playtest/mobil-stav.ts";
import { loginAgenta } from "../../../tools/playtest/web.ts";

const stav = (z: Partial<StavMobilu>): StavMobilu => ({ ...PRAZDNY_STAV, chyby: [], konzola: [], ...z });
const prvok = (z: Partial<Prvok>): Prvok => ({ c: 1, druh: "tlačidlo", text: "Pas", x: 100, y: 50, w: 60, h: 48, nedostupne: false, ...z });

describe("displej telefónu", () => {
  it("predvolene okno Android Chrome na šírku s lištou (762×340)", () => {
    expect(citajDisplej(undefined)).toEqual({ sirka: 762, vyska: 340 });
  });
  it("zadaný na výšku sa zoradí na šírku, otočenie prehodí rozmery", () => {
    const d = citajDisplej("350x844");
    expect(d).toEqual({ sirka: 844, vyska: 350 });
    expect(oknoDispleja(d, true)).toEqual({ sirka: 350, vyska: 844 });
    expect(oknoDispleja(d, false)).toBe(d);
  });
  it("nezmysel odmietne", () => {
    expect(() => citajDisplej("telefon")).toThrow(/762x340/);
  });
  it("liga predvolene Tretia (kratka)", () => {
    expect(citajLigu(undefined)).toBe("kratka");
    expect(() => citajLigu("najdlhsia")).toThrow();
  });
});

describe("účty playtesterov", () => {
  it("loginy bez čísla na konci (server ai-…-číslo odmieta)", () => {
    const loginy = MENA_TESTEROV.map((m) => loginAgenta(m));
    expect(loginy).toEqual(["ai-palec", "ai-ukazovak", "ai-prstenik"]);
    for (const l of loginy) expect(l).not.toMatch(/-\d+$/);
  });
});

describe("kolá partie zo stavu servera", () => {
  it("zo stavu partie berie len kolo, fázu a ťah", () => {
    const s = stav({});
    zapisView(s, { kolo: 2, lokalitCelkom: 3, faza: "pitka", mozemHrat: true, ruka: [{ uid: 1 }] });
    expect(s).toMatchObject({ kolo: 2, lokalitCelkom: 3, faza: "pitka", mozemHrat: true });
    expect(Object.keys(s)).not.toContain("ruka");
  });
  it("kolo sa ráta za odohrané až po bitke, koniec partie = lokality aj finále", () => {
    expect(odohraneKola(stav({}))).toBe(0);
    expect(odohraneKola(stav({ kolo: 1, faza: "bitka" }))).toBe(0);
    expect(odohraneKola(stav({ kolo: 2, faza: "volbaCiela" }))).toBe(1);
    expect(odohraneKola(stav({ kolo: 4, lokalitCelkom: 3, faza: "koniec" }))).toBe(4);
  });
  it("po dosiahnutí počtu kôl relácie ohlási koniec playtestu", () => {
    expect(popisPartie(stav({ kolo: 1, lokalitCelkom: 3, faza: "zhromazdenie", mozemHrat: false }), 1)).toEqual([
      "Partia: kolo 1 z 3 (+ finále) · fáza Zhromaždenie · ťahá súper (počkaj: pockaj 3)",
    ]);
    const po = popisPartie(stav({ kolo: 2, lokalitCelkom: 3, faza: "volbaCiela", mozemHrat: true }), 1);
    expect(po[0]).toContain("hráš ty");
    expect(po[1]).toMatch(/^KONIEC PLAYTESTU: odohral si 1 kolo/);
    expect(popisPartie(stav({ kolo: 4, lokalitCelkom: 3, faza: "bitka" }), 5)[0]).toContain("finále");
    expect(popisPartie(stav({}), 1)).toEqual([]);
  });
});

describe("ciele ťukov", () => {
  const prvky = [prvok({ c: 1 }), prvok({ c: 2, x: 700, y: 320, w: 30, h: 20 })];
  it("číslo prvku alebo x,y", () => {
    expect(bodCiela("2", prvky, "tuk")).toEqual({ x: 700, y: 320 });
    expect(bodCiela("12,34", prvky, "tuk")).toEqual({ x: 12, y: 34 });
    expect(() => bodCiela("9", prvky, "tuk")).toThrow(/pozri/);
    expect(() => bodCiela(undefined, prvky, "tuk")).toThrow(/cieľ/);
  });
  it("výrez detailu s okrajom, orezaný na okno", () => {
    expect(vyrez("2", prvky, { sirka: 762, vyska: 340 })).toEqual({ x: 673, y: 298, w: 54, h: 42 });
    expect(vyrez("700,300,200,100", prvky, { sirka: 762, vyska: 340 })).toEqual({ x: 700, y: 300, w: 62, h: 40 });
  });
  it("výpis prvku má rozmer a značku malého cieľa", () => {
    expect(riadokPrvku(prvky[0] as Prvok)).toBe("  1. [tlačidlo] Pas @ 100,50 · 60×48");
    expect(riadokPrvku(prvky[1] as Prvok)).toContain("30×20 ⚠ < 44 px");
  });
});

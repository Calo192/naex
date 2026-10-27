// Prechody fáz na stole (Michal 2026-10-27): línia starších zmizne pri prechode fázy
// a medziobrazovka povie, čo sa ide diať.

import { describe, expect, it } from "vitest";
import type { ClientState } from "@naex/core";
import { klucPrechodu, medziobrazovka } from "../src/hra/prechodFazy.ts";

type Faza = Pick<ClientState, "kolo" | "faza" | "draftStav" | "pitkaCislo">;
const draft = (krok: "stavba" | "beranie" | "patronat") => ({ krok }) as unknown as ClientState["draftStav"];
const f = (faza: ClientState["faza"], ine: Partial<Faza> = {}): Faza => ({ kolo: 2, faza, draftStav: null, pitkaCislo: 1, ...ine });

describe("klucPrechodu — kedy stôl prepne z línie starších späť na stôl", () => {
  it("koniec patronátu (draft → Zhromaždenie), výber lokality, šenok aj Pitka menia kľúč", () => {
    const kroky = [
      f("bitka"),
      f("volbaCiela", { kolo: 3 }),
      f("draft", { kolo: 3, draftStav: draft("stavba") }),
      f("draft", { kolo: 3, draftStav: draft("patronat") }),
      f("zhromazdenie", { kolo: 3 }),
      f("pitka", { kolo: 3 }),
      f("zhromazdenie", { kolo: 3, pitkaCislo: 1 }),
      f("pitka", { kolo: 3, pitkaCislo: 2 }),
    ].map(klucPrechodu);
    for (let i = 1; i < kroky.length; i++) expect(kroky[i]).not.toBe(kroky[i - 1]);
  });

  it("stavba a branie šenku sú jedna fáza; ťahy v tej istej fáze kľúč nemenia", () => {
    expect(klucPrechodu(f("draft", { draftStav: draft("stavba") }))).toBe(klucPrechodu(f("draft", { draftStav: draft("beranie") })));
    expect(klucPrechodu(f("bitka"))).toBe(klucPrechodu(f("bitka")));
    expect(klucPrechodu(f("zhromazdenie", { pitkaCislo: 1 }))).toBe(klucPrechodu(f("zhromazdenie", { pitkaCislo: 2 })));
  });
});

type Pohlad = Parameters<typeof medziobrazovka>[0];
const p = (ine: Partial<Pohlad>): Pohlad => ({
  kolo: 2,
  faza: "volbaCiela",
  utocnik: 1,
  pitkaCislo: 1,
  pitkyCelkom: 2,
  lokalitCelkom: 3,
  rozpis: [1, 2, 3],
  bitkaStav: null,
  koniec: null,
  ...ine,
});
const bitka = (krok: "pohorsenie" | "prebytok", drzi: 0 | 1 | null = null) => ({ krok, caka: drzi, prebytokDrzi: drzi }) as unknown as Pohlad["bitkaStav"];

describe("medziobrazovka — prechody fáz (výber lokality, šenok, Pitka, bitka, prebytok, nové kolo, finále)", () => {
  it("výber lokality v novom kole: obranca vyberá a natáča, útočník sa dozvie, kto vyberá", () => {
    const obranca = medziobrazovka(p({}), 0, "Eva", null);
    expect(obranca).toMatchObject({ kluc: "2|lokalita", nadnadpis: "Kolo 2", nadpis: "Výber lokality" });
    expect(obranca?.text).toMatch(/^Vyber lokalitu/);
    expect(medziobrazovka(p({}), 1, "Eva", null)?.text).toMatch(/^Eva ako obranca vyberá/);
  });

  it("finále: nad nadpisom Finále, vrcholová lokalita", () => {
    const m = medziobrazovka(p({ kolo: 4 }), 0, "Eva", null);
    expect(m?.nadnadpis).toBe("Finále");
    expect(m?.text).toMatch(/vrcholovú lokalitu/);
  });

  it("šenok (stavba aj branie) má jednu medziobrazovku s cenami šenku", () => {
    const m = medziobrazovka(p({ faza: "draft" }), 0, "Eva", null);
    expect(m).toMatchObject({ kluc: "2|senok", nadpis: "Šenok" });
    expect(m?.text).toMatch(/1 karta za 1 cigaretu, 2 karty za 3 cigarety/);
  });

  it("každá Pitka zvlášť; začína obranca, útočník má posledné slovo", () => {
    const prva = medziobrazovka(p({ faza: "pitka", pitkaCislo: 1 }), 0, "Eva", null);
    const druha = medziobrazovka(p({ faza: "pitka", pitkaCislo: 2 }), 0, "Eva", null);
    expect(prva?.nadpis).toBe("Pitka 1 z 2");
    expect(druha?.kluc).not.toBe(prva?.kluc);
    expect(prva?.text).toMatch(/^Začínaš/);
    expect(medziobrazovka(p({ faza: "pitka" }), 1, "Eva", null)?.text).toMatch(/ty máš posledné slovo/);
  });

  it("bitka podľa počítadla starého kola, aj keď stôl je už v ďalšom; Pohoršenie patrí k bitke", () => {
    expect(medziobrazovka(p({ kolo: 3 }), 0, "Eva", 2)).toMatchObject({ kluc: "2|bitka", nadpis: "Bitka", nadnadpis: "Kolo 2" });
    expect(medziobrazovka(p({ faza: "bitka", bitkaStav: bitka("pohorsenie", 0) }), 0, "Eva", null)?.kluc).toBe("2|bitka");
  });

  it("prebytok: kto ho drží, rozdeľuje; druhý sa dozvie, že dostane cigarety", () => {
    const m = medziobrazovka(p({ faza: "bitka", bitkaStav: bitka("prebytok", 1) }), 1, "Eva", null);
    expect(m).toMatchObject({ kluc: "2|prebytok", nadpis: "Prebytok" });
    expect(m?.text).toMatch(/^Máš vyššie celkové/);
    expect(medziobrazovka(p({ faza: "bitka", bitkaStav: bitka("prebytok", 1) }), 0, "Eva", null)?.text).toMatch(/dostaneš cigaretu/);
  });

  it("Zhromaždenie, patronát a koniec hry medziobrazovku nemajú", () => {
    expect(medziobrazovka(p({ faza: "zhromazdenie" }), 0, "Eva", null)).toBeNull();
    expect(medziobrazovka(p({ koniec: { vitaz: 0 } as unknown as Pohlad["koniec"] }), 0, "Eva", null)).toBeNull();
  });
});

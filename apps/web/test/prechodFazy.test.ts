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
  ciel: null,
  spaky: [4, 6],
  ...ine,
});
const bitka = (krok: "pohorsenie" | "prebytok", drzi: 0 | 1 | null = null, caka: 0 | 1 | null = drzi) => ({ krok, caka, prebytokDrzi: drzi }) as unknown as Pohlad["bitkaStav"];

describe("medziobrazovka — prechody fáz (výber lokality, šenok, Zhromaždenie, Pitka, bitka, Nakladačka, nové kolo, finále)", () => {
  it("výber lokality v novom kole: obranca vyberá a natáča, útočník sa dozvie, kto vyberá", () => {
    const obranca = medziobrazovka(p({}), 0, "Eva", null);
    expect(obranca).toMatchObject({ kluc: "2|lokalita", nadnadpis: "Kolo 2", nadpis: "Výber lokality" });
    expect(obranca?.text).toMatch(/^Vyber lokalitu/);
    expect(medziobrazovka(p({}), 1, "Eva", null)?.text).toMatch(/^Eva ako obranca vyberá/);
  });

  it("pred finále: vedúci vyberá vrcholovú lokalitu, zaostávajúci útočí — okno Finále až s vybranou lokalitou (v8, návrh #32)", () => {
    // Hráč 0 vedie (6 : 4) — je obranca, útočí Eva.
    const vedie = medziobrazovka(p({ kolo: 4, utocnik: 1, spaky: [6, 4] }), 0, "Eva", null);
    expect(vedie).toMatchObject({ kluc: "4|lokalita-finale", nadpis: "Výber vrcholovej lokality", nadnadpis: "Posledná bitka" });
    expect(vedie?.text).toMatch(/^Vedieš, preto vyberáš a natáčaš vrcholovú lokalitu; Eva má menej špakov a útočí./);
    expect(vedie?.text).not.toMatch(/Pitk|bez lokality/);
    expect(medziobrazovka(p({ kolo: 4, utocnik: 0, spaky: [4, 6] }), 0, "Eva", null)?.text).toMatch(/^Máš menej špakov, preto útočíš/);
    expect(medziobrazovka(p({ kolo: 4, utocnik: 0, spaky: [5, 5] }), 0, "Eva", null)?.text).toMatch(/^Špakov máte rovnako, útočíš ty/);
  });

  it("okno Finále príde s vybranou vrcholovou lokalitou (v drafte namiesto šenku): Pitky podľa spojov, špak za kartu v línii", () => {
    const ciel = { typ: "finale", lokalita: { uid: 1, defId: "herna", leftLayout: 0, rightLayout: 0 } } as const;
    const m = medziobrazovka(p({ kolo: 4, faza: "draft", ciel }), 0, "Eva", null);
    expect(m).toMatchObject({ kluc: "4|finale", nadpis: "Finále" });
    expect(m?.text).toMatch(/Pitiek je podľa spojov s lokalitou, víťaz dostane 1 špak za každú kartu v línii/);
    expect(m?.text).not.toMatch(/bez lokality|vždy 3|stredu/i);
  });

  it("Zhromaždenie: každé zvlášť; útočník vykladá prvý, pas dá cigarety", () => {
    const prve = medziobrazovka(p({ faza: "zhromazdenie", pitkaCislo: 0 }), 1, "Eva", null);
    expect(prve).toMatchObject({ kluc: "2|zhromazdenie|1", nadpis: "Zhromaždenie", nadnadpis: "Kolo 2 · 1 z 2" });
    expect(medziobrazovka(p({ kolo: 4, faza: "zhromazdenie", pitkaCislo: 0 }), 1, "Eva", null)?.nadnadpis).toBe("Finále · 1 z 2");
    expect(prve?.text).toMatch(/^Vykladáš prvý/);
    expect(prve?.text).toMatch(/dostaneš cigaretu/);
    expect(medziobrazovka(p({ faza: "zhromazdenie", pitkaCislo: 1 }), 0, "Eva", null)).toMatchObject({ kluc: "2|zhromazdenie|2", text: expect.stringMatching(/^Eva vykladá prvý/) });
  });

  it("šenok (stavba aj branie) má jednu medziobrazovku s cenami šenku", () => {
    const m = medziobrazovka(p({ faza: "draft" }), 0, "Eva", null);
    expect(m).toMatchObject({ kluc: "2|senok", nadpis: "Šenok" });
    expect(m?.text).toMatch(/1 karta za 1 cigaretu, 2 karty za 3 cigarety/);
  });

  it("každá Pitka zvlášť; hrá sa naraz, útočník má posledné slovo, Bzdocha čaká (Michal 2026-10-27)", () => {
    const prva = medziobrazovka(p({ faza: "pitka", pitkaCislo: 1 }), 0, "Eva", null);
    const druha = medziobrazovka(p({ faza: "pitka", pitkaCislo: 2 }), 0, "Eva", null);
    expect(prva).toMatchObject({ nadpis: "Pitka", nadnadpis: "Kolo 2 · 1 z 2" });
    expect(druha?.kluc).not.toBe(prva?.kluc);
    expect(prva?.text).toMatch(/^Hráte obaja naraz/);
    expect(medziobrazovka(p({ faza: "pitka" }), 1, "Eva", null)?.text).toMatch(/posledné slovo máš ty/);
    expect(medziobrazovka({ ...p({ faza: "pitka" }), pitkaStav: { bzdocha: 0 } }, 0, "Eva", null)?.text).toMatch(/^Máš Bzdochu: počkáš, kým Eva skončí/);
    expect(medziobrazovka({ ...p({ faza: "pitka" }), pitkaStav: { bzdocha: 1 } }, 0, "Eva", null)?.text).toMatch(/Eva má Bzdochu/);
  });

  it("bitka podľa počítadla starého kola, aj keď stôl je už v ďalšom; Pohoršenie patrí k bitke", () => {
    expect(medziobrazovka(p({ kolo: 3 }), 0, "Eva", 2)).toMatchObject({ kluc: "2|bitka", nadpis: "Bitka", nadnadpis: "Kolo 2" });
    expect(medziobrazovka(p({ faza: "bitka", bitkaStav: bitka("pohorsenie", 0) }), 0, "Eva", null)?.kluc).toBe("2|bitka");
  });

  it("Nakladačka (v8): drží ju vyššie celkové, rozdeľuje súper — ten sa dozvie, že vyberá priazne a dostane cigarety", () => {
    // Hráč 1 drží prebytok, rozdeľuje porazený hráč 0.
    const drzim = medziobrazovka(p({ faza: "bitka", bitkaStav: bitka("prebytok", 1, 0) }), 1, "Eva", null);
    expect(drzim).toMatchObject({ kluc: "2|Nakladačka", nadpis: "Nakladačka" });
    expect(drzim?.text).toMatch(/^Máš vyššie celkové/);
    expect(drzim?.text).toMatch(/Ktorých, vyberá Eva/);
    const vyberam = medziobrazovka(p({ faza: "bitka", bitkaStav: bitka("prebytok", 1, 0) }), 0, "Eva", null)?.text;
    expect(vyberam).toMatch(/vyberáš ty/);
    expect(vyberam).toMatch(/dostaneš cigaretu/);
    // Vo finále rozdeľuje držiteľ.
    expect(medziobrazovka(p({ faza: "bitka", bitkaStav: bitka("prebytok", 1, 1) }), 1, "Eva", null)?.text).toMatch(/Rozdeľ Nakladačku/);
  });

  it("patronát je krok šenku (ten istý kľúč, nová medziobrazovka nepríde); koniec hry ju nemá", () => {
    const patronat = { krok: "patronat" } as unknown as ClientState["draftStav"];
    expect(medziobrazovka({ ...p({ faza: "draft" }), draftStav: patronat } as Pohlad, 0, "Eva", null)?.kluc).toBe("2|senok");
    expect(medziobrazovka(p({ koniec: { vitaz: 0 } as unknown as Pohlad["koniec"] }), 0, "Eva", null)).toBeNull();
  });
});

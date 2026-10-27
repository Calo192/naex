// Prechody fáz na stole (Michal 2026-10-27): línia starších zmizne pri prechode fázy
// a medziobrazovka povie, čo sa ide diať.

import { describe, expect, it } from "vitest";
import type { ClientState } from "@naex/core";
import { klucPrechodu } from "../src/hra/prechodFazy.ts";

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

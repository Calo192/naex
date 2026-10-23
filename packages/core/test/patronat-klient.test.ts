// Klient agentov ponúka len ťahy, ktoré motor prijme (Navrhár 2026-10-23): staršieho
// z patronátu nepochová ani nedá do šenku. Pýta sa tou istou funkciou ako motor —
// z pohľadu hráča (viewFor) musí dať rovnakú odpoveď ako zo stavu servera.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { GameState } from "../src/index.ts";
import { jeKartaPatronatu, loadGameData, setupGame, viewFor } from "../src/index.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

describe("starší z patronátu v pohľade hráča", () => {
  it("jeKartaPatronatu dá z viewFor oboch hráčov to isté ako zo stavu", () => {
    const s0 = setupGame(data, 7);
    const e = s0.starsi[2]!;
    const s = { ...s0, patronat: [null, { elderId: e.elderId, nahrada: s0.hraci[1].ruka[0]!, pohorsenia: 1 }] } as GameState;
    for (const ja of [0, 1] as const) {
      const v = viewFor(data, s, ja);
      for (const x of s.starsi) expect(jeKartaPatronatu(v, x.karta.uid)).toBe(jeKartaPatronatu(s, x.karta.uid));
      expect(jeKartaPatronatu(v, e.karta.uid)).toBe(true);
    }
  });
});

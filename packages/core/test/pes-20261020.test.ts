// Pes (Michal 2026-10-20): už nestráži koniec strany. Za každý pár akcií na
// spoji Psa so súperovou kartou — z ktorejkoľvek strany Psa, aj zrušený Odporom
// či NA EX — dá majiteľ Psa v bitke +1 tuhé; od 2026-10-22 len na jeho vlastnej strane.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { GameState, PlacedCard, PlayerId } from "../src/index.ts";
import { bitkaMody, buildGameData, cieleVykladania, loadGameData, parseScorecards, setupGame, spojePsa } from "../src/index.ts";
import { instanceFor, makeDef } from "./helpers.ts";

const zaklad = loadGameData(cardsJson, eldersJson, scorecardsJson);

const PL = ["Rana", null, null, null] as const;
const PP = ["Rana", "Rana", null, null] as const;
const PLNA = ["Rana", "Rana", "Rana", "Rana"] as const;
const ODPOR = [null, null, null, "Odpor"] as const;
const E = [null, null, null, null] as const;

// Syntetický Pes s tým istým id (efekt ide podľa id), ostatné karty zo sady.
const cards = new Map(zaklad.cards);
cards.set("pes", makeDef("pes", PL, PP, { tags: ["Zviera"] }));
cards.set("obcan", makeDef("obcan", PLNA, PLNA, { tags: ["Občan"] }));
cards.set("odporca", makeDef("odporca", ODPOR, E, { tags: ["Občan"] }));
cards.set("nastroj", makeDef("nastroj", PLNA, PLNA, { tags: ["Nástroj"] }));
const sd = buildGameData(cards, zaklad.elders, parseScorecards(scorecardsJson));

const pes = (p: PlayerId): PlacedCard => ({ card: instanceFor(sd, "pes", PL as never, PP as never), playedBy: p });
const obcan = (p: PlayerId): PlacedCard => ({ card: instanceFor(sd, "obcan", PLNA as never, PLNA as never), playedBy: p });

describe("Pes: +1 tuhé za každý pár akcií na spoji so súperovou kartou", () => {
  it("súperova karta za Psom: rátajú sa páry vonkajšej hrany Psa", () => {
    // Strana hráča 1: Pes hráča 1 pri lokalite, za ním Občan hráča 0.
    // Pes je k hráčovi 0 otočený — von sa obracia jeho vytlačená ľavá hrana (1 Rana).
    expect(spojePsa(sd, [[], [pes(1), obcan(0)]])).toEqual([0, 1]);
    // To isté na strane hráča 0 s Psom hráča 0.
    expect(spojePsa(sd, [[pes(0), obcan(1)], []])).toEqual([1, 0]);
  });

  it("súperove karty z oboch strán Psa sa sčítajú (vnútorná hrana má 2 Rany)", () => {
    expect(spojePsa(sd, [[], [obcan(0), pes(1), obcan(0)]])).toEqual([0, 3]);
  });

  it("podstrčený na súperovu stranu nedá nič (Michal 2026-10-22)", () => {
    // Pes hráča 0 na strane hráča 1 medzi kartami hráča 1 — páry sú, bonus nie.
    expect(spojePsa(sd, [[], [obcan(1), pes(0), obcan(1)]])).toEqual([0, 0]);
    expect(spojePsa(sd, [[pes(1), obcan(0)], []])).toEqual([0, 0]);
    // Na vlastnej strane ráta aj kartu, ktorú mu súper podstrčil.
    expect(spojePsa(sd, [[pes(0), obcan(1)], [obcan(1), pes(0)]])).toEqual([1, 0]);
  });

  it("vlastná karta vedľa Psa nič nedá", () => {
    expect(spojePsa(sd, [[], [obcan(1), pes(1), obcan(1)]])).toEqual([0, 0]);
  });

  it("ráta sa aj pár zrušený Odporom — karty sú spojené", () => {
    const odporca: PlacedCard = { card: instanceFor(sd, "odporca", ODPOR as never, E as never), playedBy: 0 };
    expect(spojePsa(sd, [[], [pes(1), odporca]])).toEqual([0, 1]);
  });

  it("Nástroj bez Občana či Starešinu spoj netvorí — nič", () => {
    const nastroj: PlacedCard = { card: instanceFor(sd, "nastroj", PLNA as never, PLNA as never), playedBy: 0 };
    expect(spojePsa(sd, [[], [pes(1), nastroj]])).toEqual([0, 0]);
  });

  it("bonus ide do tuhého poškodenia majiteľa Psa v bitke", () => {
    const s0 = setupGame(sd, 5);
    const s = { ...s0, strany: [[], [obcan(0), pes(1), obcan(0)]] } as GameState;
    expect(bitkaMody(sd, s, 1).tuheZdroje).toContainEqual({ zdroj: "pes", tuhe: 3 });
    expect(bitkaMody(sd, s, 0).tuheZdroje.some((z) => z.zdroj === "pes")).toBe(false);
  });

  it("na súperovho Psa na konci jeho strany sa už smie podstrčiť", () => {
    const ciele = cieleVykladania(zaklad, [[], [{ card: { uid: 990001, defId: "pes", leftLayout: 0, rightLayout: 0 }, playedBy: 1 }]], 0, { uid: 990002, defId: "ministrant", leftLayout: 0, rightLayout: 0 }, 3);
    expect(ciele).toContain("superova");
  });
});

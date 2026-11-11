// Živý playtest 2026-11-11 (Vypálená, Pitka na Zastávke): NA EX šlo len na Živnostníka
// a Miňištranta, hoci všetky karty v línii sú Občania. Nie je to chyba — §7 púšťa NA EX
// len na kartu s aktívnou aj neaktívnou akciou, nie na kartu s neaktívnym Odporom (v11.17)
// a neaktívny Pakt sa do neaktívnych neráta (v7). Prehľadané boli všetky varianty
// a natočenia piatich kariet: kde motor ponúkne práve Živnostníka a Miňištranta,
// Recidivistu a Milujúcu manželku vždy vyradí neaktívny Odpor a Dievčinu neaktívny Pakt.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { LineState, PlacedCard, PlayerId, SlotEval } from "../src/index.ts";
import { evaluateLine, loadGameData, naexCieleVLinii } from "../src/index.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);
const lezi = (uid: number, defId: string, leftLayout: number, rightLayout: number, playedBy: PlayerId): PlacedCard => ({
  card: { uid, defId, leftLayout, rightLayout },
  playedBy,
});
const RECIDIVISTA = 11;
const ZIVNOSTNIK = 12;
const MANZELKA = 13;
const DIEVCINA = 14;
const MINISTRANT = 15;
// Kraj „pri ceste“: Milujúca manželka pri lokalite, Živnostník, Recidivista na konci;
// kraj „pod strieškou“: Dievčina na vydaj pri lokalite, Miňištrant na konci.
const linia: LineState = {
  lokalita: { uid: 1, defId: "zastavka", leftLayout: 0, rightLayout: 0 },
  lokalitaOtocena: true,
  strany: [
    [lezi(MANZELKA, "milujuca_manzelka", 0, 0, 0), lezi(ZIVNOSTNIK, "zivnostnik", 0, 0, 0), lezi(RECIDIVISTA, "recidivista", 0, 2, 0)],
    [lezi(DIEVCINA, "dievcina_na_vydaj", 0, 1, 1), lezi(MINISTRANT, "ministrant", 0, 0, 0)],
  ],
};
const sloty = (uid: number): SlotEval[] => {
  const k = evaluateLine(data, linia).cards.get(uid);
  if (k === undefined) throw new Error(`karta ${uid} nie je v línii`);
  return [...k.left, ...k.right].filter((x): x is SlotEval => x !== null);
};

describe("NA EX v Pitke na Zastávke (živý playtest 2026-11-11)", () => {
  it("ciele sú len Živnostník a Miňištrant — pre oboch hráčov", () => {
    expect(naexCieleVLinii(data, linia, 0)).toEqual([ZIVNOSTNIK, MINISTRANT]);
    expect(naexCieleVLinii(data, linia, 1)).toEqual([ZIVNOSTNIK, MINISTRANT]);
  });

  it("Milujúcu manželku vyradí neaktívny Odpor, hoci má aktívnu aj neaktívnu akciu; Recidivistu tiež", () => {
    const m = sloty(MANZELKA);
    expect(m.some((x) => x.stav === "aktivna")).toBe(true);
    expect(m.some((x) => x.stav === "neaktivna" && x.action !== "Odpor")).toBe(true);
    expect(m.some((x) => x.stav === "neaktivna" && x.action === "Odpor")).toBe(true);
    // Recidivista na konci línie má Odpor na ľavej hrane (slot 2) — v každom natočení, v ktorom
    // motor ponúkne práve Živnostníka a Miňištranta, ostane bez partnera.
    expect(sloty(RECIDIVISTA).some((x) => x.stav === "neaktivna" && x.action === "Odpor")).toBe(true);
  });

  it("Dievčinu vyradí to, že jej jediná neaktívna akcia je Pakt", () => {
    const neaktivne = sloty(DIEVCINA).filter((x) => x.stav === "neaktivna");
    expect(neaktivne.map((x) => x.action)).toEqual(["Pakt"]);
  });
});

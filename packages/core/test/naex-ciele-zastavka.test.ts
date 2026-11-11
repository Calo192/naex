// Živý playtest 2026-11-11 (Vypálená, Pitka na Zastávke): NA EX šlo len na Živnostníka
// a Miňištranta, hoci všetky karty v línii sú Občania. Recidivistu a Milujúcu manželku
// vyraďoval neaktívny Odpor (v11.17), Dievčinu to, že jej jediná neaktívna akcia je Pakt (v7).
// Michal 2026-11-11: „Zrušiť obe obmedzenia.“ (v12.1) — teraz sú cieľom všetci piati.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { LineState, PlacedCard, PlayerId, SlotEval } from "../src/index.ts";
import { evaluateLine, loadGameData, naexCieleVLinii } from "../src/index.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);
const lezi = (uid: number, defId: string, leftLayout: number, rightLayout: number, playedBy: PlayerId, naexBy?: PlayerId): PlacedCard => ({
  card: { uid, defId, leftLayout, rightLayout },
  playedBy,
  ...(naexBy !== undefined ? { naexBy } : {}),
});
const RECIDIVISTA = 11;
const ZIVNOSTNIK = 12;
const MANZELKA = 13;
const DIEVCINA = 14;
const MINISTRANT = 15;
// Kraj „pri ceste“: Milujúca manželka pri lokalite, Živnostník, Recidivista na konci;
// kraj „pod strieškou“: Dievčina na vydaj pri lokalite, Miňištrant na konci.
const linia = (naexNa?: number): LineState => {
  const na = (uid: number): PlayerId | undefined => (uid === naexNa ? 1 : undefined);
  return {
    lokalita: { uid: 1, defId: "zastavka", leftLayout: 0, rightLayout: 0 },
    lokalitaOtocena: true,
    strany: [
      [
        lezi(MANZELKA, "milujuca_manzelka", 0, 0, 0, na(MANZELKA)),
        lezi(ZIVNOSTNIK, "zivnostnik", 0, 0, 0, na(ZIVNOSTNIK)),
        lezi(RECIDIVISTA, "recidivista", 0, 3, 0, na(RECIDIVISTA)),
      ],
      [lezi(DIEVCINA, "dievcina_na_vydaj", 0, 1, 1, na(DIEVCINA)), lezi(MINISTRANT, "ministrant", 0, 0, 0, na(MINISTRANT))],
    ],
  };
};
const sloty = (line: LineState, uid: number): SlotEval[] => {
  const k = evaluateLine(data, line).cards.get(uid);
  if (k === undefined) throw new Error(`karta ${uid} nie je v línii`);
  return [...k.left, ...k.right].filter((x): x is SlotEval => x !== null);
};

describe("NA EX v Pitke na Zastávke (živý playtest 2026-11-11, v12.1)", () => {
  it("cieľom sú všetci piati Občania — pre oboch hráčov", () => {
    const vsetci = [MANZELKA, ZIVNOSTNIK, RECIDIVISTA, DIEVCINA, MINISTRANT];
    expect(naexCieleVLinii(data, linia(), 0)).toEqual(vsetci);
    expect(naexCieleVLinii(data, linia(), 1)).toEqual(vsetci);
  });

  it("Recidivista a Milujúca manželka majú neaktívny Odpor — NA EX naň ide, štít ho zahasí", () => {
    for (const uid of [RECIDIVISTA, MANZELKA]) {
      expect(sloty(linia(), uid).some((x) => x.stav === "neaktivna" && x.action === "Odpor")).toBe(true);
      expect(evaluateLine(data, linia(uid)).cards.get(uid)?.naexStit).toBe("Odpor");
      expect(sloty(linia(uid), uid)).toEqual(sloty(linia(), uid));
    }
  });

  it("Dievčina, ktorej jediná neaktívna akcia je Pakt: NA EX zruší aktívne, Pakt nezdvojí", () => {
    expect(sloty(linia(), DIEVCINA).filter((x) => x.stav === "neaktivna").map((x) => x.action)).toEqual(["Pakt"]);
    const poNaex = sloty(linia(DIEVCINA), DIEVCINA);
    expect(poNaex.filter((x) => x.action !== "Pakt").every((x) => x.stav === "zrusena")).toBe(true);
    expect(poNaex.find((x) => x.action === "Pakt")?.stav).toBe("neaktivna");
  });
});

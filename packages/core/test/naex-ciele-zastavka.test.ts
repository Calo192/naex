// Živý playtest 2026-11-11 (Vypálená, Pitka na Zastávke): NA EX šlo len na Živnostníka
// a Miňištranta, hoci všetky karty v línii sú Občania. Michal 2026-11-11 (v12.1): „Odpor bude
// aktívny LEN vtedy, keď nie je spojený s inou akciou, a bude dávať ‚NA EX‘ štít“ — Recidivistu
// a Milujúcu manželku s nespárovaným Odporom NA EX ďalej obíde; neaktívny Pakt sa do podmienky
// ráta, Dievčina na vydaj je cieľom.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { LineState, PlacedCard, PlayerId, SlotEval } from "../src/index.ts";
import { dovodyBezNaex, evaluateLine, loadGameData, naexCieleVLinii } from "../src/index.ts";

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
  it("cieľom sú Živnostník, Dievčina a Miňištrant — pre oboch hráčov", () => {
    expect(naexCieleVLinii(data, linia(), 0)).toEqual([ZIVNOSTNIK, DIEVCINA, MINISTRANT]);
    expect(naexCieleVLinii(data, linia(), 1)).toEqual([ZIVNOSTNIK, DIEVCINA, MINISTRANT]);
  });

  it("Recidivistu a Milujúcu manželku chráni aktívny (nespárovaný) Odpor", () => {
    const dovody = dovodyBezNaex(data, linia());
    for (const uid of [RECIDIVISTA, MANZELKA]) {
      expect(dovody.get(uid)).toBe("odpor");
      expect(sloty(linia(), uid).find((x) => x.action === "Odpor")?.stav).toBe("aktivna");
    }
  });

  it("Odpor Živnostníka na spoji zruší Petelicu Recidivistu a zhasne; do podmienky sa neráta", () => {
    expect(sloty(linia(), ZIVNOSTNIK).find((x) => x.action === "Odpor")?.stav).toBe("zrusena");
    expect(sloty(linia(), RECIDIVISTA).find((x) => x.action === "Petelica")?.stav).toBe("zrusena");
    expect(dovodyBezNaex(data, linia()).get(ZIVNOSTNIK)).toBeNull();
  });

  it("Dievčina, ktorej jediná neaktívna akcia je Pakt: NA EX zruší aktívne, Pakt nezdvojí", () => {
    expect(sloty(linia(), DIEVCINA).filter((x) => x.stav === "neaktivna").map((x) => x.action)).toEqual(["Pakt"]);
    const poNaex = sloty(linia(DIEVCINA), DIEVCINA);
    expect(poNaex.filter((x) => x.action !== "Pakt").every((x) => x.stav === "zrusena")).toBe(true);
    expect(poNaex.find((x) => x.action === "Pakt")?.stav).toBe("neaktivna");
  });
});

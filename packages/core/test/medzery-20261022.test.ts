// Medzery v pravidlách (návrh #7 A, Michal 2026-10-22): pas na Zastávke platí
// cigarety len za vlastný limit hráča, nie za spoločnú zásobu oboch.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { CardInstance, Command, GameState, PlayerId } from "../src/index.ts";
import { apply, kartyZaPas, KONSTANTY, loadGameData, naTahu, setupGame, vlastnyLimitZhromazdenia } from "../src/index.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

/** Partia v Zhromaždení na Zastávke — cez voľbu cieľa, stavbu šenku a koniec brania. */
function naZastavke(seed: number): GameState {
  let s = setupGame(data, seed);
  const zastavka: CardInstance = { uid: 990001, defId: "zastavka", leftLayout: 0, rightLayout: 0 };
  s = { ...s, lokalityVHre: [zastavka, ...s.lokalityVHre.filter((k) => k.defId !== "zastavka")] };
  s = apply(data, s, { type: "chooseLocation", uid: zastavka.uid, otocena: false }, (1 - s.utocnik) as PlayerId).state;
  while (s.draftStav?.krok === "stavba") {
    for (const p of [0, 1] as const) {
      const b = s.draftStav.balicky[p];
      const cmd: Command = { type: "stavbaSenku", doSenku: b.slice(0, b.length / 2).map((k) => k.uid), odhod: b.slice(b.length / 2).map((k) => k.uid) };
      s = apply(data, s, cmd, p).state;
    }
  }
  while (s.faza === "draft") s = apply(data, s, { type: "draftStop" }, naTahu(s)!).state;
  return s;
}

describe("Zastávka: pas za vlastný limit (Michal 2026-10-22, návrh #7 A)", () => {
  it("spoločný limit je súčet, pas dá cigarety len za vlastný limit hráča", () => {
    const s = naZastavke(3);
    const z = s.zhromazdenieStav!;
    expect(s.faza).toBe("zhromazdenie");
    expect(z.spolocny).toBe(true);
    const vlastne = [vlastnyLimitZhromazdenia(s, 0), vlastnyLimitZhromazdenia(s, 1)];
    expect(z.vlastny).toEqual(vlastne);
    expect(z.zostavaLimit[0]).toBe(vlastne[0]! + vlastne[1]!);
    const p = naTahu(s)!;
    const pred = s.hraci[p].cigarety;
    const po = apply(data, s, { type: "pass" }, p).state;
    expect(po.hraci[p].cigarety - pred).toBe(vlastne[p]! * KONSTANTY.CIGARETY_ZA_PAS_NA_KARTU);
  });

  it("kartyZaPas: menšie zo spoločného zvyšku a vlastného zvyšku; mimo Zastávky zvyšok limitu", () => {
    expect(kartyZaPas({ zostavaLimit: [4, 4], vlastny: [1, 3] }, 0)).toBe(1);
    expect(kartyZaPas({ zostavaLimit: [2, 2], vlastny: [1, 3] }, 1)).toBe(2);
    expect(kartyZaPas({ zostavaLimit: [3, 1] }, 0)).toBe(3);
  });
});

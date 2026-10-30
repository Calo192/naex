// Medzery v pravidlách (návrh #7 A, Michal 2026-10-22): pas platí cigarety za zvyšok
// limitu. Spoločný limit Zastávky zanikol v9.1 (test zastavka-v91.test.ts).

import { describe, expect, it } from "vitest";
import { kartyZaPas } from "../src/index.ts";

describe("Pas za zvyšok limitu (Michal 2026-10-22, návrh #7 A)", () => {
  it("kartyZaPas: zvyšok limitu hráča", () => {
    expect(kartyZaPas({ zostavaLimit: [3, 1] }, 0, 9)).toBe(3);
    expect(kartyZaPas({ zostavaLimit: [3, 1] }, 1, 9)).toBe(1);
  });

  it("v6.1 (Michal 2026-10-27): pas platí najviac za toľko kariet, koľko má hráč v ruke — s prázdnou rukou nič", () => {
    expect(kartyZaPas({ zostavaLimit: [3, 1] }, 0, 2)).toBe(2);
    expect(kartyZaPas({ zostavaLimit: [3, 1] }, 0, 0)).toBe(0);
    expect(kartyZaPas({ zostavaLimit: [4, 4] }, 1, 1)).toBe(1);
  });
});

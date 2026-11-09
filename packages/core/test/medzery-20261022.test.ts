// Medzery v pravidlách (návrh #7 A, Michal 2026-10-22): pas platí cigarety za zvyšok
// limitu. Spoločný limit Zastávky zanikol v9.1 (test zastavka-v91.test.ts).

import { describe, expect, it } from "vitest";
import { kartyZaPas } from "../src/index.ts";

describe("Pas za zvyšok limitu (Michal 2026-10-22, návrh #7 A)", () => {
  it("kartyZaPas: zvyšok limitu hráča", () => {
    expect(kartyZaPas({ zostavaLimit: [3, 1] }, 0)).toBe(3);
    expect(kartyZaPas({ zostavaLimit: [3, 1] }, 1)).toBe(1);
    expect(kartyZaPas({ zostavaLimit: [0, 1] }, 0)).toBe(0);
  });
});

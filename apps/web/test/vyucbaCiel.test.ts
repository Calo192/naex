// Cieľ ťahu vo výučbe (UI inšpekcia 20261120-1324, V-07): svieti aj koniec línie, kam karta ide,
// a POTVRDIŤ až keď návrh sedí s krokom.

import { describe, expect, it } from "vitest";
import type { Command } from "@naex/core";
import { cieleZOcakavania } from "../src/hra/Vyucba.tsx";

describe("cieľ ťahu z očakávaného príkazu", () => {
  it("dve karty na koniec línie: cieľ pri každej, potvrdenie podmienené oboma", () => {
    const c = {
      type: "tah",
      kroky: [{ type: "vypit" }, { type: "place", uid: 7, target: "vlastna" }, { type: "place", uid: 9, target: "vlastna" }],
    } as unknown as Command;
    expect(cieleZOcakavania(c)).toEqual({
      ciele: ["ciel:vlastna:7", "ciel:vlastna:9", "zrusit-ak-zle:7@vlastna,9@vlastna"],
      potvrdit: "potvrdit-ak:7@vlastna,9@vlastna",
    });
  });

  it("Dedičstvo, priznanie a ťahy bez vykladania potvrdzujú ako doteraz", () => {
    expect(cieleZOcakavania({ type: "tah", kroky: [{ type: "place", uid: 3, target: "dedicstvo" }] } as unknown as Command)).toEqual({ ciele: [], potvrdit: "potvrdit" });
    expect(cieleZOcakavania({ type: "pass" } as Command)).toEqual({ ciele: [], potvrdit: "potvrdit" });
    expect(cieleZOcakavania(null)).toEqual({ ciele: [], potvrdit: "potvrdit" });
  });
});

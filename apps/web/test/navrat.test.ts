// Pozvánka /hra?kod=ABCD prežije prihlásenie aj registráciu (nález UX 2026-10-27):
// ?spat= nesie celú cestu aj s kódom a späť vedie len na vlastný web.

import { describe, expect, it } from "vitest";
import { navratZ, sNavratom } from "../src/lib/navrat.ts";

describe("návrat po prihlásení a registrácii", () => {
  it("pozvánka s kódom ide cez prihlásenie aj registráciu tam a späť celá", () => {
    const cesta = "/hra?kod=ABCD";
    for (const stranka of ["/prihlasenie", "/registracia"] as const) {
      const odkaz = sNavratom(stranka, cesta);
      expect(odkaz.startsWith(`${stranka}?spat=`)).toBe(true);
      expect(navratZ(odkaz.slice(stranka.length))).toBe(cesta);
    }
    // Aj s ďalšími parametrami pozvánky.
    expect(navratZ(sNavratom("/prihlasenie", "/hra?kod=ABCD&x=1").slice("/prihlasenie".length))).toBe("/hra?kod=ABCD&x=1");
  });

  it("bez návratu alebo s cudzím webom nič", () => {
    expect(navratZ("")).toBeNull();
    expect(navratZ("?spat=//zly.web/hra")).toBeNull();
    expect(navratZ("?spat=https://zly.web")).toBeNull();
    expect(navratZ("?spat=/hra")).toBe("/hra");
  });
});

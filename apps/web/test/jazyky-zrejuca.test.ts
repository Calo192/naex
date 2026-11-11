// Prepínač jazykov len v Zrejúcej (Michal 2026-11-11): bez príznaku servera (instancia.jazyky v /api/ja)
// je rozhranie po slovensky — ?jazyk, uložená voľba ani voľba hráča sa neuplatnia a nič sa neuloží.

import { beforeAll, describe, expect, it } from "vitest";

const ulozene = new Map<string, string>([["naex_jazyk", "en"]]);

beforeAll(() => {
  // jazyk.tsx beží v prehliadači — v teste stačí, čo naozaj číta a píše.
  Object.assign(globalThis, {
    document: { documentElement: { lang: "sk" } },
    location: { search: "?jazyk=pl" },
    localStorage: { getItem: (k: string) => ulozene.get(k) ?? null, setItem: (k: string, v: string) => void ulozene.set(k, v) },
  });
});

describe("jazyk bez povolenia servera (Vypálená)", () => {
  it("štart, ?jazyk aj voľba hráča ostanú po slovensky a voľba sa neuloží; po povolení platí, po odobratí späť slovenčina", async () => {
    const j = await import("../src/i18n/jazyk.tsx");
    expect(j.jazykyPovolene()).toBe(false);
    expect(j.pociatocnyJazyk()).toBe("sk");
    await j.nastavJazyk("en", true);
    expect(j.aktualnyJazyk()).toBe("sk");
    expect(ulozene.get("naex_jazyk")).toBe("en");

    j.povolJazyky(true);
    expect(j.pociatocnyJazyk()).toBe("pl");
    await j.nastavJazyk("cs", true);
    expect(j.aktualnyJazyk()).toBe("cs");
    expect(ulozene.get("naex_jazyk")).toBe("cs");

    j.povolJazyky(false);
    await j.nastavJazyk("cs");
    expect(j.aktualnyJazyk()).toBe("sk");
  });
});

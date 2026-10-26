// Hlavička webu (Michal 2026-10-26, #21–#23): kto čo vidí v menu, štítok partie
// (krok, špaky, posledná zmena) a kontumácia v menu Partia.

import { describe, expect, it } from "vitest";
import { hlavneMenu, jeAktivna, menuUctu, spravaWebu } from "../src/lib/navigacia.ts";
import { KONTUMACIA_PO_MS, krokPartie, minSek, stavKontumacie, textZmeny, zmenySpakov } from "../src/hra/stitokPartie.ts";
import type { Pouzivatel, Pravo, Rola } from "../src/lib/ucet.tsx";

const VSETKY: readonly Pravo[] = [
  "hrat_bot",
  "hrat_ludia",
  "sukromne_miestnosti",
  "hodnotene_partie",
  "melichar_soundboard",
  "spatna_vazba_pisat",
  "spatna_vazba_reagovat",
  "hodnotit_hru",
  "profily_inych",
  "vlastna_fotka",
  "reporty_playtestov",
  "navrhovat_karty",
  "vidiet_vyvoj",
];

const ucet = (rola: Rola, prava: readonly Pravo[] = VSETKY): Pouzivatel => ({ id: 7, login: "jano", meno: "Jano", avatar: null, rola, prava });
const hrefy = (p: readonly { readonly href: string }[]): string[] => p.map((x) => x.href);

describe("navigácia webu", () => {
  it("Hrať je prvé a jediná hlavná výzva; poradie skupín podľa #23 A", () => {
    const menu = hlavneMenu(ucet("hrac"), null);
    expect(hrefy(menu)).toEqual(["/hra", "/pravidla", "/karty", "/rebricek", "/novinky", "/vyvoj", "/spatna-vazba"]);
    expect(menu.filter((p) => p.hlavna === true).map((p) => p.href)).toEqual(["/hra"]);
    expect(menu.map((p) => p.skupina)).toEqual(["hra", "hra", "hra", "hra", "komunita", "komunita", "komunita"]);
  });

  it("neprihlásený nevidí Playtest ani správu; Vývoj len s právom Nealka", () => {
    expect(hrefy(hlavneMenu(null, VSETKY))).not.toContain("/playtest");
    expect(hrefy(hlavneMenu(null, VSETKY))).toContain("/vyvoj");
    expect(hrefy(hlavneMenu(null, VSETKY.filter((p) => p !== "vidiet_vyvoj")))).not.toContain("/vyvoj");
    expect(spravaWebu(null)).toEqual([]);
  });

  it("rank bez práva vidiet_vyvoj odkaz na Vývoj nemá", () => {
    expect(hrefy(hlavneMenu(ucet("deci", VSETKY.filter((p) => p !== "vidiet_vyvoj")), null))).not.toContain("/vyvoj");
    expect(hrefy(hlavneMenu(ucet("deci"), null))).toContain("/vyvoj");
  });

  it("Správa ▾: admin aj subadmin vidia Playtest, Tvorbu a Hráčov; hráč nič", () => {
    for (const rola of ["admin", "subadmin"] as const) expect(hrefy(spravaWebu(ucet(rola, [])))).toEqual(["/playtest", "/admin", "/hraci"]);
    expect(spravaWebu(ucet("sedmicka"))).toEqual([]);
  });

  it("menu účtu neopakuje položky z menu ani zo Správy", () => {
    for (const rola of ["admin", "subadmin", "sedmicka", "hrac", "navstevnik"] as const) {
      const ja = ucet(rola);
      const inde = [...hrefy(hlavneMenu(ja, null)), ...hrefy(spravaWebu(ja))];
      const vUcte = hrefy(menuUctu(ja));
      expect(vUcte.slice(0, 2)).toEqual(["/profil", "/hrac/7"]);
      expect(vUcte.filter((h) => inde.includes(h))).toEqual([]);
      expect(new Set(inde).size).toBe(inde.length);
    }
  });

  it("rank s reportmi playtestov má Playtest v menu účtu, bez práva nie", () => {
    expect(hrefy(menuUctu(ucet("deci")))).toContain("/playtest");
    expect(hrefy(menuUctu(ucet("deci", VSETKY.filter((p) => p !== "reporty_playtestov"))))).not.toContain("/playtest");
  });

  it("podstránka patrí svojej položke", () => {
    expect(jeAktivna("/karty/dielna", "/karty")).toBe(true);
    expect(jeAktivna("/kartyx", "/karty")).toBe(false);
  });
});

describe("štítok partie", () => {
  const stav = (odohrane: number, lokalit: number, finale = false, koniec = false) =>
    ({
      nastenka: Array.from({ length: odohrane }, () => ({})),
      lokalitCelkom: lokalit,
      ciel: finale ? { typ: "finale" } : null,
      koniec: koniec ? {} : null,
    }) as unknown as Parameters<typeof krokPartie>[0];

  it("krok: bitka n z (lokality + finále), posledná je Finále", () => {
    expect(krokPartie(stav(0, 3)).text).toBe("Bitka 1 z 4");
    expect(krokPartie(stav(2, 3)).kratko).toBe("Bitka 3/4");
    expect(krokPartie(stav(3, 3))).toMatchObject({ text: "Finále", finale: true });
    expect(krokPartie(stav(1, 3, true)).finale).toBe(true);
    expect(krokPartie(stav(4, 3, false, true)).text).toBe("Koniec partie");
  });

  it("zmena špakov po bitke: kto a koľko, aj záporná", () => {
    expect(zmenySpakov([3, 1], [5, 1])).toEqual([{ kto: 0, n: 2 }]);
    expect(zmenySpakov([3, 1], [2, 2])).toEqual([
      { kto: 0, n: -1 },
      { kto: 1, n: 1 },
    ]);
    expect(zmenySpakov([3, 1], [3, 1])).toEqual([]);
    expect(textZmeny(2)).toBe("+2");
    expect(textZmeny(-1)).toBe("−1");
  });
});

describe("kontumácia v menu Partia", () => {
  it("sivá, kým je súper pri stole; s odpočtom do 3 minút; potom zvýraznená", () => {
    const t = 1_000_000;
    expect(stavKontumacie(true, null, t)).toEqual({ druh: "pripojeny" });
    expect(stavKontumacie(false, t - 72_000, t)).toEqual({ druh: "caka", zostavaMs: KONTUMACIA_PO_MS - 72_000 });
    expect(stavKontumacie(false, t - KONTUMACIA_PO_MS, t)).toEqual({ druh: "mozna" });
    // Bez času odpojenia sa počíta od teraz — nikdy hneď „môžeš“.
    expect(stavKontumacie(false, null, t).druh).toBe("caka");
  });

  it("odpočet v minútach a sekundách nahor", () => {
    expect(minSek(108_000)).toBe("1:48");
    expect(minSek(500)).toBe("0:01");
    expect(minSek(KONTUMACIA_PO_MS)).toBe("3:00");
  });
});

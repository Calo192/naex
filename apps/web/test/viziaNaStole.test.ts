// Vízia na stole (Michal 2026-11-08, mockup V-B): karta leží na plsti, voľby sú dve tlačidlá
// s piktogramom Dobratie a Spálenie v strede spodnej hrany — okno Vízie je preč.

import { existsSync, readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { IKONY } from "../src/karta/ikony.ts";
import { rozmerVizie, VolbyVizie, zamerVizie } from "../src/hra/ViziaNaStole.tsx";

const POMER = 80 / 54;
const MOCKUP = new URL("../../../docs/napady/ikony-final.html", import.meta.url);

describe("piktogramy rozhrania", () => {
  // Finál je návrh v docs/napady — keď ho niekto upratal, porovnanie sa preskočí.
  it.skipIf(!existsSync(MOCKUP))("Dobratie (D-E), Odhodenie (O1), Návrat (N1) a Spálenie (S-B) sú v IKONY presne ako vo finále, ktoré Michal vybral", () => {
    const html = readFileSync(MOCKUP, "utf8");
    const riadok = html.split(/\r?\n/).find((r) => r.startsWith("const DATA = ")) ?? "const DATA = {};";
    const fin = (JSON.parse(riadok.slice("const DATA = ".length).replace(/;\s*$/, "")) as { FINAL?: Record<string, { d: string; evenOdd: boolean }[]> }).FINAL ?? {};
    expect(IKONY.Dobratie).toEqual(fin.Dobratie);
    expect(IKONY.Odhodenie).toEqual(fin.Odhodenie);
    expect(IKONY.Návrat).toEqual(fin.Navrat);
    expect(IKONY.Spálenie).toEqual(fin.Spálenie);
  });

  it("každý piktogram je jedna karta so znakom vyrezaným (evenodd)", () => {
    for (const k of ["Dobratie", "Odhodenie", "Návrat", "Spálenie"] as const) expect(IKONY[k].map((c) => c.evenOdd)).toEqual([true]);
  });
});

describe("zámery Vízie", () => {
  it("prvá karta je vrchná, druhá (Krištáľová guľa) nesie druha", () => {
    expect(zamerVizie(0, true)).toEqual({ type: "vizia", vziat: true });
    expect(zamerVizie(0, false)).toEqual({ type: "vizia", vziat: false });
    expect(zamerVizie(1, true)).toEqual({ type: "vizia", vziat: true, druha: true });
    expect(zamerVizie(1, false)).toEqual({ type: "vizia", vziat: false, druha: true });
  });
});

describe("rozmer kariet na plsti", () => {
  // Plsť pri 1366 × 650, 1440 × 800 a 1920 × 1080 (vnútro, zmerané na ukážke stola).
  const plste = [
    { w: 1330, h: 295 },
    { w: 1404, h: 390 },
    { w: 1884, h: 540 },
  ];

  it("karta sa zmestí s pilulkou a tlačidlami hrany bez posúvania", () => {
    for (const plst of plste) {
      for (const pocet of [1, 2]) {
        const r = rozmerVizie(plst, pocet, false);
        const popis = pocet > 1 ? 18 : 0;
        expect(r.sirka * POMER + r.dole + popis + 34).toBeLessThanOrEqual(plst.h);
        expect(pocet * r.sirka + (pocet - 1) * r.medzera).toBeLessThanOrEqual(plst.w);
      }
    }
  });

  it("veľká plsť: karta najviac 300 px; guľa má medzi kartami medzeru", () => {
    expect(rozmerVizie({ w: 1884, h: 540 }, 1, false)).toEqual({ sirka: 300, medzera: 0, dole: 36 });
    expect(rozmerVizie({ w: 1884, h: 540 }, 2, false).medzera).toBe(40);
  });

  it("telefón na šírku: hrana nie je, karta siaha takmer po spodok plste", () => {
    const r = rozmerVizie({ w: 700, h: 240 }, 2, true);
    expect(r.dole).toBe(8);
    expect(r.sirka * POMER + 18 + 8 + 10).toBeLessThanOrEqual(240);
  });
});

describe("tlačidlá Vízie na hrane", () => {
  const html = (pocet: number): string =>
    renderToStaticMarkup(
      createElement(VolbyVizie, {
        karty: [
          { kluc: 1, nazov: "Nealko", ...(pocet > 1 ? { popis: "vrchná" } : {}) },
          ...(pocet > 1 ? [{ kluc: 2, nazov: "Veštica", popis: "druhá" }] : []),
        ],
        rozmer: rozmerVizie({ w: 1404, h: 390 }, pocet, false),
        onVolba: () => undefined,
      }),
    );

  it("jedna karta: do ruky a spáliť, len piktogram a popis pod myšou", () => {
    const h = html(1);
    expect(h.match(/<button/g)).toHaveLength(2);
    expect(h).toContain(IKONY.Dobratie[0]!.d);
    expect(h).toContain(IKONY.Spálenie[0]!.d);
    expect(h).toContain('aria-label="Do ruky: Nealko"');
    expect(h).toContain('aria-label="Spáliť navždy z hry: Nealko"');
    // Bez textu na tlačidle — medzi značkami nie je žiadne slovo.
    expect(h.replace(/<[^>]*>/g, "").trim()).toBe("");
  });

  it("Krištáľová guľa: každá karta má svoju dvojicu", () => {
    const h = html(2);
    expect(h.match(/<button/g)).toHaveLength(4);
    expect(h.match(/class="vizia-par"/g)).toHaveLength(2);
    expect(h).toContain('aria-label="Do ruky: Nealko (vrchná)"');
    expect(h).toContain('aria-label="Spáliť navždy z hry: Veštica (druhá)"');
  });
});

describe("okno Vízie je preč", () => {
  it("HernaPlocha kreslí Víziu na stole, nie v okne", () => {
    const zdroj = readFileSync(new URL("../src/hra/HernaPlocha.tsx", import.meta.url), "utf8");
    expect(zdroj).not.toContain("OknoVizie");
    expect(zdroj).toContain("<ViziaNaStole");
    expect(zdroj).toContain("<VolbyVizie");
  });
});

// Karta z ponuky na plsti (Michal 2026-11-11, mock A v docs/napady/vyber-z-ponuky.html): klik na kartu
// ju len vyznačí, pečiatka VZIAŤ! / NAVRCH! cez ňu pošle zámer a výber sa zavrie — okno, ktoré kartu
// vzalo hneď a ostalo otvorené, je preč.

import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PonukaNaStole, rozmerPonuky, type KartaPonuky } from "../src/hra/PonukaNaStole.tsx";

const POMER = 80 / 54;

describe("rozmer kariet ponuky na plsti", () => {
  // Plsť pri 1366 × 650, 1440 × 800, 1920 × 1080 a 2560 × 1080 (vnútro, ako pri Vízii).
  const plste = [
    { w: 1330, h: 295 },
    { w: 1404, h: 390 },
    { w: 1884, h: 540 },
    { w: 2524, h: 540 },
  ];

  it("celá ponuka sa zmestí do plste v jednom rade s pilulkou, vysunutím a tlačidlom hrany", () => {
    for (const plst of plste) {
      for (const pocet of [1, 3, 5, 7]) {
        const r = rozmerPonuky(plst, pocet, false);
        expect(r.sirka * POMER + r.dole + 34 + 12).toBeLessThanOrEqual(plst.h);
        expect(pocet * r.sirka + (pocet - 1) * r.medzera).toBeLessThanOrEqual(plst.w);
      }
    }
  });

  it("monitor: karty sú veľké (najviac 260 px), nie miniatúry z okna", () => {
    expect(rozmerPonuky({ w: 1884, h: 540 }, 5, false).sirka).toBe(260);
    expect(rozmerPonuky({ w: 1330, h: 295 }, 5, false).sirka).toBeGreaterThanOrEqual(140);
  });

  it("dlhý odhadzovací balíček (Cintorín): karty sa zalomia do radov a celé sa zmestia do plste", () => {
    for (const plst of [...plste, { w: 700, h: 240 }]) {
      const naSirku = plst.w === 700;
      for (const pocet of [8, 12, 16, 24]) {
        const r = rozmerPonuky(plst, pocet, naSirku);
        const rady = Math.ceil(pocet / r.naRad);
        expect(rady).toBeLessThanOrEqual(3);
        expect(rady * r.sirka * POMER + (rady - 1) * r.medzera + r.dole + (naSirku ? 18 : 46)).toBeLessThanOrEqual(plst.h);
        expect(r.naRad * r.sirka + (r.naRad - 1) * r.medzera).toBeLessThanOrEqual(plst.w);
      }
    }
    // Monitor: 12 kariet v dvoch radoch po 6 vyjde väčších ako v jednom rade.
    expect(rozmerPonuky({ w: 1884, h: 540 }, 12, false).naRad).toBe(6);
  });

  it("telefón na šírku: hrana nie je, karty siahajú takmer po spodok plste", () => {
    const r = rozmerPonuky({ w: 700, h: 240 }, 5, true);
    expect(r.dole).toBe(8);
    expect(r.sirka * POMER + 8 + 18).toBeLessThanOrEqual(240);
    expect(5 * r.sirka + 4 * r.medzera).toBeLessThanOrEqual(700);
  });
});

describe("vyznačenie a pečiatka", () => {
  const karty: KartaPonuky[] = [
    { kluc: 1, nazov: "Vandal", mimo: "len Nástroj", render: () => createElement("button", { className: "kl" }, "Vandal") },
    { kluc: 2, nazov: "Vidly", render: () => createElement("button", { className: "kl" }, "Vidly") },
  ];
  const html = (vyznacena: number | null, navrch = false): string =>
    renderToStaticMarkup(
      createElement(PonukaNaStole, {
        karty,
        rozmer: rozmerPonuky({ w: 1404, h: 390 }, 2, false),
        vyznacena,
        peciatka: navrch
          ? { text: "NAVRCH!", pod: "do balíčka", aria: "Dať Vidly navrch doberacieho balíčka" }
          : { text: "VZIAŤ!", pod: "do ruky", aria: "Vziať Vidly do ruky" },
        onVezmi: () => undefined,
      }),
    );

  it("bez vyznačenej karty pečiatka nie je — klik na kartu nič neberie", () => {
    expect(html(null)).not.toContain("ponuka-peciatka");
  });

  it("vyznačená karta má pečiatku VZIAŤ! s cieľom, len jedna a vedľa karty (tlačidlá sa nevnárajú)", () => {
    const h = html(2);
    expect(h.match(/ponuka-peciatka/g)).toHaveLength(1);
    expect(h).toContain("VZIAŤ!");
    expect(h).toContain("do ruky");
    expect(h).toContain('aria-label="Vziať Vidly do ruky"');
    expect(h).toMatch(/<figure class="ponuka-stol-karta vyznacena" data-uid="2"[^>]*><button class="kl">Vidly<\/button><button[^>]*ponuka-peciatka/);
  });

  it("Predavačka: NAVRCH! do balíčka", () => {
    const h = html(2, true);
    expect(h).toContain("NAVRCH!");
    expect(h).toContain("do balíčka");
  });

  it("nevhodná karta je stlmená so štítkom prečo", () => {
    const h = html(null);
    expect(h).toContain('class="ponuka-stol-karta mimo"');
    expect(h).toContain("len Nástroj");
  });
});

describe("HernaPlocha: výber z ponuky", () => {
  const zdroj = readFileSync(new URL("../src/hra/HernaPlocha.tsx", import.meta.url), "utf8");

  it("zámer senok posiela len pečiatka, nie klik na kartu", () => {
    expect(zdroj.match(/type: "senok"/g)).toHaveLength(1);
    expect(zdroj).toMatch(/const vezmiZPonuky = [\s\S]*?\{ type: "senok", uid: k\.uid \}/);
  });

  it("Cintorín: kartu berie len pečiatka, „Nič si neber“ je samostatné tlačidlo; malé karty v pilulke sú preč", () => {
    expect(zdroj.match(/type: "cintorin"/g)).toHaveLength(2);
    expect(zdroj).toContain('posli(mojCintorin ? { type: "cintorin", uid: k.uid } : { type: "senok", uid: k.uid })');
    expect(zdroj).toMatch(/cintorin-nic[^\n]*posli\(\{ type: "cintorin", uid: null \}\)/);
    expect(zdroj).not.toContain("zberatel-ponuka");
  });

  it("ponuka sa ukáže na stole, okno Ponuka sa pri voľbe samo neotvára", () => {
    expect(zdroj).toContain("<PonukaNaStole");
    expect(zdroj).not.toMatch(/chceVrstvu[^;]*"senok"/);
  });
});

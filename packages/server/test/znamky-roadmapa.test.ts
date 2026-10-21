// Známky hry v čase a roadmapa (Michal 2026-10-21): von idú len priemery,
// ľudia až od troch hodnotiteľov; priemer k dátumu z posledných známok
// každého hodnotiteľa; roadmapa verejná bez Prijímača, rozhodnutia o návrhoch
// sa do nej premietnu samy.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Ucty, type Pouzivatel } from "../src/auth.ts";
import { otvorDb } from "../src/db.ts";
import { Navrhy } from "../src/navrhy.ts";
import { Roadmapa } from "../src/roadmapa.ts";
import { Hodnotenia, MIN_LUDI, denZ, priemery } from "../src/znamky.ts";
import type { GameServer } from "../src/server.ts";
import { TEST_ADMIN, nastavUroven, prihlas, registruj, testovaciServer } from "./pomocnik.ts";

function docasnaDb() {
  const dir = mkdtempSync(join(tmpdir(), "naex-znamky-"));
  const db = otvorDb(join(dir, "naex.db"));
  const ucty = new Ucty(db, { login: "Admin", heslo: null });
  let n = 0;
  const ucet = (rola: "hrac" | "navstevnik" | "subadmin" = "hrac", ai = false): Pouzivatel => {
    const p = ucty.registruj(`ucet${++n}`, "tajneheslo", `Účet ${n}`, 1);
    ucty.nastavRolu(p.id, rola);
    if (ai) ucty.nastavAi(p.id, true);
    return ucty.podlaId(p.id) as Pouzivatel;
  };
  return { db, ucet, zmaz: () => { db.close(); rmSync(dir, { recursive: true, force: true }); } };
}

const DEN = 24 * 60 * 60 * 1000;
const T0 = Date.parse("2026-10-21T10:00:00+02:00");

describe("priemery — anonymita", () => {
  it("ľudia pod MIN_LUDI: priemer ľudí aj spoločný sa skryjú, AI sa ukáže", () => {
    const h = (ai: boolean, z: number) => ({ ai, znamky: { zabava: z, tempo: z } });
    const malo = priemery([h(false, 2), h(false, 4), h(true, 8)]);
    expect(malo.ludia.kriteria.zabava).toEqual({ priemer: null, n: 2 });
    expect(malo.ludia.celkom).toEqual({ priemer: null, n: 2 });
    expect(malo.spolu.kriteria.zabava?.priemer).toBeNull();
    expect(malo.spolu.celkom.priemer).toBeNull();
    expect(malo.ai.kriteria.zabava).toEqual({ priemer: 8, n: 1 });

    const dost = priemery([h(false, 2), h(false, 4), h(false, 6), h(true, 8)]);
    expect(MIN_LUDI).toBe(3);
    expect(dost.ludia.kriteria.zabava).toEqual({ priemer: 4, n: 3 });
    expect(dost.spolu.kriteria.zabava).toEqual({ priemer: 5, n: 4 });
    // Kritérium, ku ktorému dvaja z troch ľudí nemajú názor, sa skryje samostatne.
    const ciastocne = priemery([h(false, 2), h(false, 4), { ai: false, znamky: { tempo: 5 } }]);
    expect(ciastocne.ludia.kriteria.tempo?.priemer).toBe(3.67);
    expect(ciastocne.ludia.kriteria.zabava).toEqual({ priemer: null, n: 2 });
  });

  it("bez ľudí je spoločný priemer priemer AI", () => {
    const p = priemery([{ ai: true, znamky: { zabava: 6 } }, { ai: true, znamky: { zabava: 8 } }]);
    expect(p.spolu.kriteria.zabava).toEqual({ priemer: 7, n: 2 });
    expect(p.ludia.kriteria.zabava).toEqual({ priemer: null, n: 0 });
  });
});

describe("hodnotenia — ukladanie a vývoj", () => {
  it("stav k dátumu: neskoršia zmena prepíše hodnotiteľa len od svojho dňa", () => {
    const { db, ucet, zmaz } = docasnaDb();
    try {
      const h = new Hodnotenia(db);
      const ai1 = ucet("hrac", true);
      const ai2 = ucet("hrac", true);
      h.uloz(ai1, { znamky: { rovnovaha: 4 } }, T0);
      h.uloz(ai2, { znamky: { rovnovaha: 6 } }, T0 + 1000);
      h.uloz(ai1, { znamky: { rovnovaha: 8 } }, T0 + 2 * DEN);
      // Stiahnuté hodnotenie sa od toho dňa nepočíta.
      h.uloz(ai2, { znamky: {} }, T0 + 3 * DEN);
      const { body } = h.vyvoj();
      expect(body.map((b) => b.den)).toEqual([denZ(T0), denZ(T0 + 2 * DEN), denZ(T0 + 3 * DEN)]);
      expect(body.map((b) => b.ai.kriteria.rovnovaha?.priemer)).toEqual([5, 7, 8]);
      expect(body[2]?.ai.celkom).toEqual({ priemer: 8, n: 1 });
    } finally {
      zmaz();
    }
  });

  it("návštevník nehodnotí; opakované uloženie do 10 minút prepíše posledný záznam", () => {
    const { db, ucet, zmaz } = docasnaDb();
    try {
      const h = new Hodnotenia(db);
      expect(() => h.uloz(ucet("navstevnik"), { znamky: { zabava: 5 } }, T0)).toThrow(/prvú partiu/);
      const ja = ucet();
      h.uloz(ja, { znamky: { zabava: 5 } }, T0);
      h.uloz(ja, { znamky: { zabava: 7, tempo: 3 } }, T0 + 60_000);
      h.uloz(ja, { znamky: { zabava: 9 } }, T0 + DEN);
      const { n } = db.prepare("SELECT COUNT(*) AS n FROM znamky").get() as { n: number };
      expect(n).toBe(2);
      expect(h.moje(ja)).toEqual({ znamky: { zabava: 9 }, cas: T0 + DEN, smie: true });
      expect(() => h.uloz(ja, { znamky: { zabava: 11 } }, T0)).toThrow(/1 až 10/);
      expect(() => h.uloz(ja, { znamky: { nieco: 5 } }, T0)).toThrow(/Neznáme kritérium/);
    } finally {
      zmaz();
    }
  });

  it("zdroj a čas posiela len AI; import toho istého playtestu neduplikuje", () => {
    const { db, ucet, zmaz } = docasnaDb();
    try {
      const h = new Hodnotenia(db);
      expect(() => h.uloz(ucet(), { znamky: { zabava: 5 }, zdroj: "20261011-101224" }, T0)).toThrow(/AI agent/);
      const ai = ucet("hrac", true);
      const cas = Date.parse("2026-10-11T10:12:24+02:00");
      h.uloz(ai, { znamky: { zabava: 5 }, zdroj: "20261011-101224", cas }, T0);
      h.uloz(ai, { znamky: { zabava: 6 }, zdroj: "20261011-101224", cas }, T0);
      expect(() => h.uloz(ai, { znamky: { zabava: 6 }, cas: T0 + DEN }, T0)).toThrow(/budúcnosti/);
      const riadky = db.prepare("SELECT cas, data FROM znamky").all() as { cas: number; data: string }[];
      expect(riadky).toEqual([{ cas, data: JSON.stringify({ zabava: 6 }) }]);
    } finally {
      zmaz();
    }
  });
});

describe("roadmapa — poradie a návrhy", () => {
  it("presun pred položku a na koniec, Hotové nastaví dokončenie", () => {
    const { db, ucet, zmaz } = docasnaDb();
    try {
      const r = new Roadmapa(db);
      const admin = ucet("subadmin");
      const a = r.pridaj(admin, { nazov: "A", stlpec: "teraz" }, T0);
      const b = r.pridaj(admin, { nazov: "B", stlpec: "teraz" }, T0);
      const c = r.pridaj(admin, { nazov: "C", stlpec: "dalej" }, T0);
      const poradie = (s: string) => r.zoznam(admin).polozky.filter((p) => p.stlpec === s).map((p) => p.nazov);
      r.presun(admin, c, { stlpec: "teraz", pred: a }, T0);
      expect(poradie("teraz")).toEqual(["C", "A", "B"]);
      r.presun(admin, c, { stlpec: "teraz", pred: b }, T0);
      expect(poradie("teraz")).toEqual(["A", "C", "B"]);
      r.presun(admin, a, { stlpec: "teraz", pred: null }, T0);
      expect(poradie("teraz")).toEqual(["C", "B", "A"]);
      r.presun(admin, b, { stlpec: "hotove", pred: null }, T0 + 5);
      const hotova = r.zoznam(admin).polozky.find((p) => p.id === b);
      expect(hotova).toMatchObject({ stlpec: "hotove", stav: "hotove", dokoncena: T0 + 5 });
      expect(r.udalosti()).toEqual([{ cas: T0 + 5, text: "B" }]);
      expect(() => r.presun(ucet(), a, { stlpec: "dalej" }, T0)).toThrow(/admin/);
    } finally {
      zmaz();
    }
  });

  it("verejný pohľad: bez Prijímača, skrytých položiek a odkazov do sekcie Playtest", () => {
    const { db, ucet, zmaz } = docasnaDb();
    try {
      const r = new Roadmapa(db);
      const admin = ucet("subadmin");
      const v = r.pridaj(admin, { nazov: "Verejná", stlpec: "teraz", zdroj: { typ: "playtest", text: "P", odkaz: "/playtest/reporty/x.html" } }, T0);
      const s = r.pridaj(admin, { nazov: "Skrytá", stlpec: "teraz", verejna: false }, T0);
      r.pridaj(admin, { nazov: "V prijímači", stlpec: "prijimac" }, T0);
      r.uprav(admin, v, { zavisi: [s] }, T0);
      const verejne = r.zoznam(null);
      expect(verejne.upravuje).toBe(false);
      expect(verejne.polozky.map((p) => p.nazov)).toEqual(["Verejná"]);
      expect(verejne.polozky[0]?.zdroj?.odkaz).toBe("");
      expect(verejne.polozky[0]?.zavisi).toEqual([]);
      expect(r.zoznam(ucet()).polozky).toHaveLength(1);
      expect(r.zoznam(admin).polozky).toHaveLength(3);
    } finally {
      zmaz();
    }
  });

  it("AI navrhár pridáva len do Prijímača; hráč nepridáva", () => {
    const { db, ucet, zmaz } = docasnaDb();
    try {
      const r = new Roadmapa(db);
      const ai = ucet("hrac", true);
      const id = r.pridaj(ai, { nazov: "Nápad agenta", stlpec: "teraz" }, T0);
      expect(r.zoznam(ucet("subadmin")).polozky.find((p) => p.id === id)?.stlpec).toBe("prijimac");
      expect(() => r.pridaj(ucet(), { nazov: "X" }, T0)).toThrow(/admin/);
    } finally {
      zmaz();
    }
  });

  it("rozhodnutie o návrhu: schválený navrch Prijímača, implementovaný do Hotové, zamietnutý zmizne", () => {
    const { db, ucet, zmaz } = docasnaDb();
    try {
      const r = new Roadmapa(db);
      const navrhy = new Navrhy(db);
      const admin = ucet("subadmin");
      r.pridaj(admin, { nazov: "Starší", stlpec: "prijimac" }, T0);
      const moznost = { kluc: "A", nazov: "Ukázať cenu", popis: "p", dopad: "", narocnost: "", odporucana: true };
      const zaklad = { nazov: "Cena bitky", kritickost: "vysoka", oblast: "zrozumiteľnosť", problem: "Hráč nevie.", pricina: "x", prejav: "y", moznosti: [moznost] };
      const [id1, id2] = navrhy.nahraj(admin, { davka: "20261021-041728", navrhy: [{ ...zaklad, kluc: "bitka" }, { ...zaklad, kluc: "druhy", nazov: "Druhý" }] }, T0);
      const rozhodni = (id: number, stav: string, navyse: Record<string, unknown> = {}) => {
        navrhy.uprav(admin, id, { stav, volba: "A", ...navyse }, T0);
        const n = navrhy.zoznam().find((x) => x.id === id);
        if (n !== undefined) r.zNavrhu(n, n.stav, T0 + 1);
      };
      const polozka = (navrh: number) => r.zoznam(admin).polozky.find((p) => p.navrh === navrh);

      rozhodni(id1 as number, "implementovat");
      const p = polozka(id1 as number);
      expect(p).toMatchObject({ stlpec: "prijimac", nazov: "Cena bitky", kratko: "A: Ukázať cenu", stav: "rozhodnute" });
      expect(r.zoznam(admin).polozky.filter((q) => q.stlpec === "prijimac").map((q) => q.nazov)).toEqual(["Cena bitky", "Starší"]);
      // Admin ho potiahne do Teraz — Developer ho tam nechá.
      r.presun(admin, (p as { id: number }).id, { stlpec: "teraz" }, T0);
      rozhodni(id1 as number, "rozpracovane");
      expect(polozka(id1 as number)).toMatchObject({ stlpec: "teraz", stav: "rozpracovane" });
      rozhodni(id1 as number, "implementovane", { vysledok: "commit abc123" });
      expect(polozka(id1 as number)).toMatchObject({ stlpec: "hotove", stav: "hotove", commit: "commit abc123", dokoncena: T0 + 1 });

      rozhodni(id2 as number, "odlozene");
      expect(polozka(id2 as number)?.stlpec).toBe("neskor");
      rozhodni(id2 as number, "zamietnute");
      expect(polozka(id2 as number)).toBeUndefined();
    } finally {
      zmaz();
    }
  });

  it("overenie po playteste: zabralo ostane v Hotové, nezabralo sa vráti do Prijímača na rozhodnutie", () => {
    const { db, ucet, zmaz } = docasnaDb();
    try {
      const r = new Roadmapa(db);
      const navrhy = new Navrhy(db);
      const admin = ucet("subadmin");
      const moznost = { kluc: "A", nazov: "Ukázať cenu", popis: "p", dopad: "", narocnost: "", odporucana: true };
      const zaklad = { nazov: "Cena bitky", kritickost: "vysoka", oblast: "rozhranie", problem: "Hráč nevie.", pricina: "x", prejav: "y", moznosti: [moznost] };
      const [id1, id2] = navrhy.nahraj(
        admin,
        { davka: "20261021-041728", navrhy: [{ ...zaklad, kluc: "bitka", overenie: ["Nikto sa nepýta na cenu bitky."] }, { ...zaklad, kluc: "druhy", zdroj: "dizajn" }] },
        T0,
      ) as [number, number];
      const zmen = (id: number, zmeny: Record<string, unknown>) => {
        navrhy.uprav(admin, id, zmeny, T0);
        const n = navrhy.zoznam().find((x) => x.id === id);
        if (n !== undefined) r.zNavrhu(n, n.stav, T0 + 1);
        return n;
      };
      const polozka = (navrh: number) => r.zoznam(admin).polozky.find((p) => p.navrh === navrh);

      expect(navrhy.zoznam().find((n) => n.id === id1)).toMatchObject({ overenie: ["Nikto sa nepýta na cenu bitky."], zdroj: "playtest", verdikt: "" });
      // Neimplementovaný návrh sa overiť nedá; verdikt je povinný.
      expect(() => navrhy.uprav(admin, id1, { stav: "overene", verdikt: "ok" }, T0)).toThrow(/implementovaný/);
      zmen(id1, { stav: "implementovat", volba: "A" });
      zmen(id1, { stav: "implementovane", vysledok: "commit abc" });
      expect(() => navrhy.uprav(admin, id1, { stav: "overene" }, T0)).toThrow(/Verdikt/);
      expect(zmen(id1, { stav: "overene", verdikt: "Playtest 20261022: nikto sa nepýtal." })).toMatchObject({ stav: "overene", verdikt: "Playtest 20261022: nikto sa nepýtal." });
      expect(polozka(id1)).toMatchObject({ stlpec: "hotove", hotovo: "Overené playtestom: Playtest 20261022: nikto sa nepýtal." });

      // Návrh z dizajnu má v roadmape zdroj dizajn; keď nezaberie, vráti sa Michalovi.
      zmen(id2, { stav: "implementovat", volba: "A" });
      expect(polozka(id2)?.zdroj).toMatchObject({ typ: "dizajn" });
      zmen(id2, { stav: "implementovane", vysledok: "commit def" });
      zmen(id2, { stav: "nezabralo", verdikt: "Hráči cenu stále prehliadajú." });
      expect(polozka(id2)).toMatchObject({ stlpec: "prijimac", stav: "overit", hotovo: "Nezabralo: Hráči cenu stále prehliadajú." });
      // Rozhodnutie po nezabratí je znova rozhodnutie človeka.
      expect(zmen(id2, { stav: "implementovat", volba: "A", poznamka: "Skús väčšie písmo." })).toMatchObject({ stav: "implementovat", rozhodol: { id: admin.id } });
      expect(() => navrhy.nahraj(admin, { davka: "20261021-041728", navrhy: [{ ...zaklad, kluc: "zly", zdroj: "sen" }] }, T0)).toThrow(/zdroj/);
      navrhy.nahraj(admin, { davka: "20261021-041728", navrhy: [{ ...zaklad, kluc: "rozpor", zdroj: "rozhodca" }] }, T0);
      expect(navrhy.zoznam().find((n) => n.kluc === "rozpor")?.zdroj).toBe("rozhodca");
    } finally {
      zmaz();
    }
  });
});

describe("známky a roadmapa — API", () => {
  let server: GameServer;
  let zmazServer: () => Promise<void>;
  beforeAll(async () => {
    ({ server, zmaz: zmazServer } = await testovaciServer());
  });
  afterAll(async () => {
    await zmazServer();
  });
  const url = (cesta: string) => `http://127.0.0.1:${server.port}/api${cesta}`;
  const volaj = (cookie: string, metoda: string, cesta: string, telo?: unknown) =>
    fetch(url(cesta), { method: metoda, headers: { cookie, "x-naex": "1", "content-type": "application/json" }, body: telo === undefined ? undefined : JSON.stringify(telo) });

  it("verejný vývoj bez prihlásenia neobsahuje nikoho meno ani id", async () => {
    const admin = await prihlas(server.port, TEST_ADMIN.login, TEST_ADMIN.heslo);
    const hraci: string[] = [];
    for (let i = 0; i < 3; i++) {
      const { cookie } = await registruj(server.port, `hodnotitel${i}`);
      expect((await volaj(cookie, "PUT", "/znamky", { znamky: { zabava: 5 } })).status).toBe(403);
      await nastavUroven(server.port, admin, cookie, "hrac");
      expect((await volaj(cookie, "PUT", "/znamky", { znamky: { zabava: 4 + i * 2, tempo: 7 } })).status).toBe(200);
      hraci.push(cookie);
    }
    const r = await fetch(url("/znamky"));
    expect(r.status).toBe(200);
    const text = await r.text();
    expect(text).not.toMatch(/hodnotitel|Hráč|pouzivatel/);
    const v = JSON.parse(text) as { kriteria: unknown[]; body: { ludia: { kriteria: Record<string, { priemer: number | null; n: number }> } }[] };
    expect(v.kriteria).toHaveLength(12);
    expect(v.body.at(-1)?.ludia.kriteria.zabava).toEqual({ priemer: 6, n: 3 });
    const moje = (await (await volaj(hraci[0] as string, "GET", "/znamky/moje")).json()) as { znamky: Record<string, number> };
    expect(moje.znamky).toEqual({ zabava: 4, tempo: 7 });
  });

  it("roadmapa: seed pri prvom štarte, verejne bez Prijímača, hráč nemení", async () => {
    const verejna = (await (await fetch(url("/roadmapa"))).json()) as { polozky: { stlpec: string; id: number }[]; upravuje: boolean };
    expect(verejna.upravuje).toBe(false);
    expect(verejna.polozky.length).toBeGreaterThan(20);
    expect(verejna.polozky.some((p) => p.stlpec === "prijimac")).toBe(false);
    const admin = await prihlas(server.port, TEST_ADMIN.login, TEST_ADMIN.heslo);
    const plna = (await (await volaj(admin, "GET", "/roadmapa")).json()) as { polozky: { stlpec: string }[]; upravuje: boolean };
    expect(plna.upravuje).toBe(true);
    expect(plna.polozky.some((p) => p.stlpec === "prijimac")).toBe(true);
    const { cookie } = await registruj(server.port);
    const prva = verejna.polozky[0] as { id: number };
    expect((await volaj(cookie, "POST", `/roadmapa/${prva.id}/presun`, { stlpec: "neskor" })).status).toBe(403);
    expect((await volaj(admin, "POST", `/roadmapa/${prva.id}/presun`, { stlpec: "neskor" })).status).toBe(200);
  });
});

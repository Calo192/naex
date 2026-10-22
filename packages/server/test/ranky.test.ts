// Ranky a práva (Michal 2026-10-22): návštevník → Poldeci (kľúč „hrac“) →
// Deci → Sedmička, automatický postup len nahor, ručný rank má prednosť,
// matica rank × právo, subadmin nesmie nad seba.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prazdneStatistiky } from "@naex/core";
import { Archiv } from "../src/archiv.ts";
import { Ucty } from "../src/auth.ts";
import { otvorDb } from "../src/db.ts";
import { PRAVA, PREDVOLENE_PRAVA, Prava, rankPodlaPartii } from "../src/prava.ts";
import type { GameServer } from "../src/server.ts";
import { TEST_ADMIN, nastavUroven, prihlas, registruj, testovaciServer } from "./pomocnik.ts";

function docasnaDb(): { db: ReturnType<typeof otvorDb>; zmaz: () => void } {
  const dir = mkdtempSync(join(tmpdir(), "naex-ranky-"));
  const db = otvorDb(join(dir, "naex.db"));
  return { db, zmaz: () => { db.close(); rmSync(dir, { recursive: true, force: true }); } };
}

function partie(archiv: Archiv, hraci: [number, number], pocet: number, dohrata = true): void {
  for (let i = 0; i < pocet; i++) {
    archiv.zapis({
      kod: "TEST", zaciatok: 0, koniec: 1, vitaz: 0, dovod: dohrata ? "Odohrala sa posledná bitka o lokalitu." : "Partiu vzdáva X.",
      kola: 3, verziaSady: null, dohrata, hraci, body: null, statistiky: [prazdneStatistiky(), prazdneStatistiky()],
    });
  }
}

const POSTUP = PREDVOLENE_PRAVA.postup;

describe("ranky — automatický postup", () => {
  it("prahy: Poldeci po prvej partii (aj s botom), Deci po 10, Sedmička po 30 partiách s ľuďmi", () => {
    expect(POSTUP).toEqual({ deci: 10, sedmicka: 30 });
    expect(rankPodlaPartii(POSTUP, 0, false)).toBe("navstevnik");
    expect(rankPodlaPartii(POSTUP, 0, true)).toBe("hrac");
    expect(rankPodlaPartii(POSTUP, 9, true)).toBe("hrac");
    expect(rankPodlaPartii(POSTUP, 10, false)).toBe("deci");
    expect(rankPodlaPartii(POSTUP, 30, false)).toBe("sedmicka");
  });

  it("partie povyšujú len nahor, vzdané sa nerátajú, ručný rank a správcov nemenia", () => {
    const { db, zmaz } = docasnaDb();
    try {
      const ucty = new Ucty(db, { login: "Admin", heslo: null });
      const archiv = new Archiv(db);
      const a = ucty.registruj("jano", "tajneheslo", "Jano", 1);
      const b = ucty.registruj("eva", "tajneheslo", "Eva", 1);
      expect(ucty.povysPoPartii(a.id, POSTUP)).toBe(true);
      expect(ucty.podlaId(a.id)?.rola).toBe("hrac");
      partie(archiv, [a.id, b.id], 9);
      partie(archiv, [a.id, b.id], 5, false);
      expect(ucty.povysPoPartii(a.id, POSTUP)).toBe(false);
      partie(archiv, [a.id, b.id], 1);
      expect(ucty.povysPoPartii(a.id, POSTUP)).toBe(true);
      expect(ucty.podlaId(a.id)?.rola).toBe("deci");
      // Prísnejšie pravidlá nikoho automaticky neznížia.
      ucty.prepocitajRanky({ deci: 50, sedmicka: 60 });
      expect(ucty.podlaId(a.id)?.rola).toBe("deci");
      // Ručný rank: automatika ho nemení ani nahor.
      ucty.nastavRolu(b.id, "navstevnik");
      expect(ucty.rolaRucne(b.id)).toBe(true);
      expect(ucty.povysPoPartii(b.id, POSTUP)).toBe(false);
      expect(ucty.podlaId(b.id)?.rola).toBe("navstevnik");
      // Návrat na automatický rank prepočíta podľa pravidiel.
      ucty.automatickyRank(b.id, POSTUP);
      expect(ucty.rolaRucne(b.id)).toBe(false);
      expect(ucty.podlaId(b.id)?.rola).toBe("deci");
      ucty.automatickyRank(a.id, { deci: 50, sedmicka: 60 });
      expect(ucty.podlaId(a.id)?.rola).toBe("hrac");
      // Subadmin nie je hráčsky rank — automatika ho nemení.
      ucty.nastavRolu(a.id, "subadmin");
      expect(ucty.rolaRucne(a.id)).toBe(false);
      partie(archiv, [a.id, b.id], 40);
      ucty.prepocitajRanky(POSTUP);
      expect(ucty.podlaId(a.id)?.rola).toBe("subadmin");
    } finally {
      zmaz();
    }
  });
});

describe("práva — matica rank × právo", () => {
  it("predvolene smie každý všetko; odobraté právo platí, správca a AI pri hodnotení vždy", () => {
    const { db, zmaz } = docasnaDb();
    try {
      const prava = new Prava(db);
      for (const rola of ["navstevnik", "hrac", "deci", "sedmicka"] as const) {
        expect(prava.zoznam({ rola, ai: false })).toEqual([...PRAVA]);
      }
      const admin = { id: 1, rola: "admin" } as Parameters<Prava["uloz"]>[0];
      prava.uloz(admin, { matica: { hodnotit_hru: ["deci", "sedmicka"], reporty_playtestov: [] } });
      expect(prava.smie({ rola: "hrac", ai: false }, "hodnotit_hru")).toBe(false);
      expect(prava.smie({ rola: "hrac", ai: true }, "hodnotit_hru")).toBe(true);
      expect(prava.smie({ rola: "deci", ai: false }, "hodnotit_hru")).toBe(true);
      expect(prava.smie({ rola: "sedmicka", ai: false }, "reporty_playtestov")).toBe(false);
      expect(prava.smie({ rola: "subadmin", ai: false }, "reporty_playtestov")).toBe(true);
      expect(() => prava.vyzaduj({ rola: "hrac", ai: false }, "hodnotit_hru")).toThrow(/hodnotiť hru/);
      // Neuvedené práva ostanú, ako boli.
      expect(prava.smie({ rola: "navstevnik", ai: false }, "hrat_bot")).toBe(true);
    } finally {
      zmaz();
    }
  });

  it("uloženie overí tvar a smie len správca", () => {
    const { db, zmaz } = docasnaDb();
    try {
      const prava = new Prava(db);
      const admin = { id: 1, rola: "admin" } as Parameters<Prava["uloz"]>[0];
      const hrac = { id: 2, rola: "sedmicka" } as Parameters<Prava["uloz"]>[0];
      expect(() => prava.uloz(hrac, { matica: { hrat_bot: [] } })).toThrow(/admin alebo subadmin/);
      expect(() => prava.uloz(admin, { matica: { lietat: ["hrac"] } })).toThrow(/Neznáme právo/);
      expect(() => prava.uloz(admin, { matica: { hrat_bot: ["subadmin"] } })).toThrow(/zoznam rankov/);
      expect(() => prava.uloz(admin, { postup: { deci: 20, sedmicka: 20 } })).toThrow(/viac partií/);
      expect(prava.uloz(admin, { postup: { deci: 5 } }).postup).toEqual({ deci: 5, sedmicka: 30 });
    } finally {
      zmaz();
    }
  });
});

describe("ranky a práva — API", () => {
  let server: GameServer;
  let zmazServer: () => Promise<void>;
  beforeAll(async () => {
    ({ server, zmaz: zmazServer } = await testovaciServer());
  });
  afterAll(async () => {
    await zmazServer();
  });

  const volaj = async (cookie: string, metoda: string, cesta: string, telo?: unknown) => {
    const res = await fetch(`http://127.0.0.1:${server.port}/api${cesta}`, {
      method: metoda,
      headers: { "content-type": "application/json", "x-naex": "1", cookie },
      body: telo === undefined ? undefined : JSON.stringify(telo),
    });
    return { status: res.status, data: (await res.json()) as Record<string, unknown> };
  };
  const idUctu = async (cookie: string): Promise<number> => ((await volaj(cookie, "GET", "/ja")).data.pouzivatel as { id: number }).id;

  it("/api/ja vráti práva; subadmin mení hráčske ranky a maticu, ale nie správcov", async () => {
    const admin = await prihlas(server.port, TEST_ADMIN.login, TEST_ADMIN.heslo);
    const sub = (await registruj(server.port)).cookie;
    const hrac = (await registruj(server.port)).cookie;
    const sub2 = (await registruj(server.port)).cookie;
    await nastavUroven(server.port, admin, sub, "subadmin");
    await nastavUroven(server.port, admin, sub2, "subadmin");
    expect((await volaj(hrac, "GET", "/ja")).data.pouzivatel).toMatchObject({ rola: "navstevnik", prava: [...PRAVA] });

    const idHraca = await idUctu(hrac);
    expect((await volaj(sub, "PATCH", `/admin/pouzivatelia/${idHraca}`, { rola: "deci" })).status).toBe(200);
    const zoznam = (await volaj(sub, "GET", "/admin/pouzivatelia")).data.pouzivatelia as { id: number; rola: string; rolaRucne: boolean }[];
    expect(zoznam.find((u) => u.id === idHraca)).toMatchObject({ rola: "deci", rolaRucne: true });
    expect((await volaj(sub, "PATCH", `/admin/pouzivatelia/${idHraca}`, { automaticky: true })).status).toBe(200);
    // Partie s botom sa nikde nerátajú, preto kto bol aspoň Poldeci, ostáva ním (0 partií s ľuďmi).
    expect((await volaj(hrac, "GET", "/ja")).data.pouzivatel).toMatchObject({ rola: "hrac" });

    // Nad seba nie: na subadmina, iného subadmina ani admina.
    expect((await volaj(sub, "PATCH", `/admin/pouzivatelia/${idHraca}`, { rola: "subadmin" })).status).toBe(403);
    expect((await volaj(sub, "PATCH", `/admin/pouzivatelia/${await idUctu(sub2)}`, { rola: "hrac" })).status).toBe(403);
    expect((await volaj(sub, "PATCH", `/admin/pouzivatelia/${await idUctu(admin)}`, { rola: "hrac" })).status).toBe(400);
    expect((await volaj(sub, "PATCH", `/admin/pouzivatelia/${idHraca}`, { ai: true })).status).toBe(403);

    // Matica: hráč nie, subadmin áno; zmena sa hneď prejaví v /api/ja.
    expect((await volaj(hrac, "PUT", "/admin/prava", { matica: { hodnotit_hru: [] } })).status).toBe(403);
    const ulozene = await volaj(sub, "PUT", "/admin/prava", { matica: { hodnotit_hru: ["deci", "sedmicka"] } });
    expect(ulozene.status).toBe(200);
    expect(((await volaj(hrac, "GET", "/ja")).data.pouzivatel as { prava: string[] }).prava).not.toContain("hodnotit_hru");
    const nacitane = await volaj(admin, "GET", "/admin/prava");
    expect(nacitane.data).toMatchObject({ postup: { deci: 10, sedmicka: 30 }, ranky: ["navstevnik", "hrac", "deci", "sedmicka"] });
    // Späť na predvolené, aby ostatné testy servera nič nezdedili.
    await volaj(admin, "PUT", "/admin/prava", { matica: { hodnotit_hru: ["navstevnik", "hrac", "deci", "sedmicka"] } });
  });
});

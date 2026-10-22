// Úrovne účtov (Michal 2026-10-12): admin z konfigurácie, subadmin, hráč,
// návštevník; návštevník sa po prvej dohratej partii (aj proti botovi) stáva hráčom (Michal 2026-10-21).

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prazdneStatistiky } from "@naex/core";
import { Archiv } from "../src/archiv.ts";
import { Ucty, hashHesla } from "../src/auth.ts";
import { otvorDb } from "../src/db.ts";
import { PREDVOLENE_PRAVA } from "../src/prava.ts";
import type { GameServer } from "../src/server.ts";
import { TEST_ADMIN, nastavUroven, prihlas, pravaBezNavstevnika, registruj, testovaciServer } from "./pomocnik.ts";

const ADMIN = { login: "Admin", heslo: "testovacie-heslo-admina" };

function docasnaDb(): { db: ReturnType<typeof otvorDb>; zmaz: () => void } {
  const dir = mkdtempSync(join(tmpdir(), "naex-ucty-"));
  const db = otvorDb(join(dir, "naex.db"));
  return { db, zmaz: () => { db.close(); rmSync(dir, { recursive: true, force: true }); } };
}

function partia(archiv: Archiv, hraci: [number, number], dohrata: boolean): void {
  archiv.zapis({
    kod: "TEST", zaciatok: 0, koniec: 1, vitaz: 0, dovod: dohrata ? "Odohrala sa posledná bitka o lokalitu." : "Partiu vzdáva X.",
    kola: 3, verziaSady: null, dohrata, hraci, body: null, statistiky: [prazdneStatistiky(), prazdneStatistiky()],
  });
}

describe("úrovne účtov — databáza", () => {
  it("nový účet je návštevník; po prvej dohratej partii hráč, vyššiu úroveň partia nemení", () => {
    const { db, zmaz } = docasnaDb();
    try {
      const ucty = new Ucty(db, { login: "Admin", heslo: null });
      const archiv = new Archiv(db);
      const a = ucty.registruj("jano", "tajneheslo", "Jano", 1);
      const b = ucty.registruj("eva", "tajneheslo", "Eva", 1);
      expect(a.rola).toBe("navstevnik");
      partia(archiv, [a.id, b.id], false);
      expect(ucty.dohrate(a.id)).toBe(0);
      expect(ucty.povysPoPartii(a.id, PREDVOLENE_PRAVA.postup)).toBe(true);
      expect(ucty.podlaId(a.id)?.rola).toBe("hrac");
      expect(ucty.povysPoPartii(a.id, PREDVOLENE_PRAVA.postup)).toBe(false);
      ucty.nastavRolu(b.id, "subadmin");
      expect(ucty.povysPoPartii(b.id, PREDVOLENE_PRAVA.postup)).toBe(false);
      expect(ucty.podlaId(b.id)?.rola).toBe("subadmin");
    } finally {
      zmaz();
    }
  });

  it("admin z konfigurácie: založí sa, heslo sa aktualizuje, iný admin klesne na hráča, meno je rezervované", () => {
    const { db, zmaz } = docasnaDb();
    try {
      db.prepare("INSERT INTO pouzivatelia (login, heslo, meno, rola, vytvoreny) VALUES ('michal', ?, 'Michal', 'admin', 0)").run(hashHesla("stareheslo"));
      new Ucty(db, ADMIN);
      const ucty = new Ucty(db, { ...ADMIN, heslo: "nove-heslo-admina" });
      expect(ucty.prihlas("Admin", ADMIN.heslo)).toBeNull();
      expect(ucty.prihlas("admin", "nove-heslo-admina")?.rola).toBe("admin");
      expect(ucty.prihlas("michal", "stareheslo")?.rola).toBe("hrac");
      expect(() => ucty.registruj("ADMIN", "tajneheslo", "Podvodník", 1)).toThrow(/obsadené/);
      expect(ucty.zoznam().filter((u) => u.rola === "admin")).toHaveLength(1);
    } finally {
      zmaz();
    }
  });

  it("starú rolu „pouzivatel“ prevedie podľa dohratých partií a staré kontumácie nerátá", () => {
    const { db, zmaz } = docasnaDb();
    try {
      const vloz = (login: string) =>
        Number(db.prepare("INSERT INTO pouzivatelia (login, heslo, meno, rola, vytvoreny) VALUES (?, 'x', ?, 'pouzivatel', 0)").run(login, login).lastInsertRowid);
      const skuseny = vloz("skuseny");
      const novacik = vloz("novacik");
      const zapis = (dovod: string) => {
        const id = Number(db.prepare("INSERT INTO partie (kod, zaciatok, koniec, vitaz, dovod, kola) VALUES ('X', 0, 1, 0, ?, 3)").run(dovod).lastInsertRowid);
        for (const [miesto, kto] of [[0, skuseny], [1, novacik]] as const) {
          db.prepare("INSERT INTO partie_hraci (partia, miesto, pouzivatel, vysledok, frajerina_pred, frajerina_po, statistiky) VALUES (?, ?, ?, 'vyhra', 0, 0, '{}')").run(id, miesto, kto);
        }
      };
      zapis("Odohrala sa posledná bitka o lokalitu.");
      // Novačik nemá dohratú partiu — z tej jedinej ho vyradíme, ostane mu kontumácia.
      db.prepare("DELETE FROM partie_hraci WHERE pouzivatel = ? AND partia = (SELECT MAX(id) FROM partie)").run(novacik);
      const kontumacia = Number(db.prepare("INSERT INTO partie (kod, zaciatok, koniec, vitaz, dovod, kola, dohrata) VALUES ('X', 0, 1, 0, 'Kontumácia: Eva je dlho odpojená.', 3, 0)").run().lastInsertRowid);
      db.prepare("INSERT INTO partie_hraci (partia, miesto, pouzivatel, vysledok, frajerina_pred, frajerina_po, statistiky) VALUES (?, 1, ?, 'prehra', 0, 0, '{}')").run(kontumacia, novacik);
      const ucty = new Ucty(db, { login: "Admin", heslo: null });
      expect(ucty.podlaId(skuseny)?.rola).toBe("hrac");
      expect(ucty.podlaId(novacik)?.rola).toBe("navstevnik");
    } finally {
      zmaz();
    }
  });
});

describe("úrovne účtov — API", () => {
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

  it("admin povýši subadmina; subadmin vidí hráčov, maže cudzie príspevky, úrovne nemení", async () => {
    const admin = await prihlas(server.port, TEST_ADMIN.login, TEST_ADMIN.heslo);
    const sub = (await registruj(server.port)).cookie;
    const hrac = (await registruj(server.port)).cookie;
    const navstevnik = (await registruj(server.port)).cookie;

    expect((await volaj(sub, "GET", "/admin/pouzivatelia")).status).toBe(403);
    await nastavUroven(server.port, admin, sub, "subadmin");
    await nastavUroven(server.port, admin, hrac, "hrac");

    const zoznam = await volaj(sub, "GET", "/admin/pouzivatelia");
    expect(zoznam.status).toBe(200);
    const ucty = zoznam.data.pouzivatelia as { id: number; login: string; rola: string; dohrate: number }[];
    expect(ucty.find((u) => u.login === TEST_ADMIN.login)?.rola).toBe("admin");
    expect(ucty.every((u) => typeof u.dohrate === "number")).toBe(true);

    // Úroveň mení len admin; na admina nepovýši nikoho a adminovi úroveň nezmení.
    const idHraca = ucty.find((u) => u.rola === "hrac")?.id;
    const idAdmina = ucty.find((u) => u.rola === "admin")?.id;
    expect((await volaj(sub, "PATCH", `/admin/pouzivatelia/${idHraca}`, { rola: "subadmin" })).status).toBe(403);
    expect((await volaj(admin, "PATCH", `/admin/pouzivatelia/${idHraca}`, { rola: "admin" })).status).toBe(400);
    expect((await volaj(admin, "PATCH", `/admin/pouzivatelia/${idAdmina}`, { rola: "hrac" })).status).toBe(400);

    // Návštevník bez práv na reakcie číta, ale nekomentuje ani nedáva cigarety.
    await pravaBezNavstevnika(server.port, admin);
    const nazor = await volaj(hrac, "POST", "/nazory", { kategoria: "ine", text: "Hráčov názor na skúšku." });
    expect(nazor.status).toBe(201);
    const id = nazor.data.id as number;
    expect((await volaj(navstevnik, "GET", "/nazory")).status).toBe(200);
    expect((await volaj(navstevnik, "POST", `/nazory/${id}/komentare`, { text: "Návštevník komentuje." })).status).toBe(403);
    expect((await volaj(navstevnik, "PUT", `/nazory/${id}/cigareta`)).status).toBe(403);
    await pravaBezNavstevnika(server.port, admin, false);
    expect((await volaj(navstevnik, "PUT", `/nazory/${id}/cigareta`)).status).toBe(200);

    // Príznak AI nastavuje len admin; autor názoru ho nesie, aby ho klient vedel skryť.
    expect((await volaj(sub, "PATCH", `/admin/pouzivatelia/${idHraca}`, { ai: true })).status).toBe(403);
    expect((await volaj(admin, "PATCH", `/admin/pouzivatelia/${idHraca}`, { ai: "áno" })).status).toBe(400);
    expect((await volaj(admin, "PATCH", `/admin/pouzivatelia/${idHraca}`, {})).status).toBe(400);
    const autor = () => volaj(hrac, "GET", "/nazory").then((r) => (r.data.nazory as { id: number; autor: { ai: boolean } }[]).find((n) => n.id === id)?.autor.ai);
    expect(await autor()).toBe(false);
    expect((await volaj(admin, "PATCH", `/admin/pouzivatelia/${idHraca}`, { ai: true })).status).toBe(200);
    expect(await autor()).toBe(true);
    expect((await volaj(hrac, "GET", "/ja")).data.pouzivatel).toMatchObject({ rola: "hrac", ai: true });

    // Subadmin zmaže cudzí názor a smie meniť jeho stav.
    expect((await volaj(sub, "PATCH", `/nazory/${id}`, { stav: "prijate" })).status).toBe(200);
    expect((await volaj(sub, "DELETE", `/nazory/${id}`)).status).toBe(200);
  });
});

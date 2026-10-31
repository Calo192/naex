// Zlúčenie duplicitných účtov (Michal 2026-10-31): ai-admin-2…9 a ai-dizajner-2…3
// na živom webe — obsah duplikátu prejde na hlavný účet, duplikát zanikne.
// Poistka: registrácia loginu agenta s číslom na konci.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Ucty, hashHesla } from "../src/auth.ts";
import { type Db, otvorDb } from "../src/db.ts";
import type { GameServer } from "../src/server.ts";
import { zlucUcty } from "../src/zlucenie.ts";
import { TEST_ADMIN, nastavUroven, prihlas, registruj, testovaciServer } from "./pomocnik.ts";

function ucet(db: Db, login: string, rola = "subadmin"): number {
  const r = db.prepare("INSERT INTO pouzivatelia (login, heslo, meno, rola, vytvoreny) VALUES (?, ?, ?, ?, 1)").run(login, hashHesla("tajneheslo"), login, rola);
  return Number(r.lastInsertRowid);
}

const pocet = (db: Db, sql: string, ...p: (number | string)[]): number => (db.prepare(sql).get(...p) as { n: number }).n;

/** Databáza s hlavným účtom a duplikátom, ktorý vlastní kúsok z každej oblasti. */
function databaza(): { db: Db; hlavny: number; dup: number; adminId: number; nazor: number } {
  const db = otvorDb(":memory:");
  new Ucty(db, { login: "Admin", heslo: "heslo-admina-test" });
  const adminId = pocet(db, "SELECT id AS n FROM pouzivatelia WHERE login = 'Admin'");
  const hlavny = ucet(db, "ai-admin");
  const dup = ucet(db, "ai-admin-2");
  const iny = ucet(db, "jano", "hrac");

  const nazor = Number(db.prepare("INSERT INTO nazory (autor, kategoria, text, vytvoreny) VALUES (?, 'web', 'od duplikátu', 1)").run(dup).lastInsertRowid);
  const cudzi = Number(db.prepare("INSERT INTO nazory (autor, kategoria, text, vytvoreny) VALUES (?, 'web', 'od Jana', 1)").run(iny).lastInsertRowid);
  db.prepare("INSERT INTO nazory_komentare (nazor, autor, text, vytvoreny) VALUES (?, ?, 'komentár', 2)").run(cudzi, dup);
  // Cigareta k tomu istému názoru od oboch účtov = kolízia PRIMARY KEY (nazor, pouzivatel).
  db.prepare("INSERT INTO cigarety_nazorov (nazor, pouzivatel) VALUES (?, ?), (?, ?), (?, ?)").run(cudzi, hlavny, cudzi, dup, nazor, iny);
  db.prepare("INSERT INTO frajerina (pouzivatel, hodnota, najvyssia) VALUES (?, 1100, 1100), (?, 900, 950)").run(hlavny, dup);
  // Známky z toho istého playtestu = kolízia čiastočného UNIQUE indexu; webové známky ('') prejdú.
  db.prepare("INSERT INTO znamky (pouzivatel, cas, data, zdroj) VALUES (?, 1, '{\"zabava\":8}', 'p1'), (?, 2, '{\"zabava\":3}', 'p1'), (?, 3, '{}', '')").run(hlavny, dup, dup);
  db.prepare("INSERT INTO partie (id, kod, zaciatok, koniec, vitaz, dovod, kola) VALUES (1, 'K', 0, 1, 0, 'x', 3)").run();
  db.prepare("INSERT INTO partie_hraci (partia, miesto, pouzivatel, vysledok, frajerina_pred, frajerina_po, statistiky) VALUES (1, 0, ?, 'vyhra', 1000, 1010, '{}'), (1, 1, ?, 'prehra', 1000, 990, '{}')").run(dup, iny);
  db.prepare("INSERT INTO navrhy (davka, kluc, poradie, data, rozhodol, vytvoreny) VALUES ('d', 'k', 0, '{}', ?, 1)").run(dup);
  // Stĺpec bez cudzieho kľúča (staršia schéma).
  db.prepare("INSERT INTO sady (cas, autor, data) VALUES (1, ?, '{}')").run(dup);
  db.prepare("INSERT INTO relacie (token, pouzivatel, plati_do) VALUES ('t-dup', ?, 99), ('t-hl', ?, 99)").run(dup, hlavny);
  // Tabuľka, ktorá pribudne neskôr — zlúčenie ju nájde cez PRAGMA foreign_key_list.
  db.exec("CREATE TABLE nova_tabulka (id INTEGER PRIMARY KEY, kto INTEGER REFERENCES pouzivatelia(id) ON DELETE CASCADE)");
  db.prepare("INSERT INTO nova_tabulka (kto) VALUES (?)").run(dup);
  return { db, hlavny, dup, adminId, nazor };
}

describe("zlúčenie účtov — databáza", () => {
  it("obsah duplikátu prejde na hlavný účet, pri kolízii ostane riadok hlavného, duplikát zanikne", () => {
    const { db, hlavny, dup, nazor } = databaza();
    const v = zlucUcty(db, dup, hlavny, false);

    expect(v.skusobne).toBe(false);
    expect(v.relacie).toBe(1);
    const podla = (t: string, s: string) => v.tabulky.find((x) => x.tabulka === t && x.stlpec === s);
    expect(podla("nazory", "autor")).toEqual({ tabulka: "nazory", stlpec: "autor", prepisane: 1, zahodene: 0 });
    expect(podla("cigarety_nazorov", "pouzivatel")).toMatchObject({ prepisane: 0, zahodene: 1 });
    expect(podla("frajerina", "pouzivatel")).toMatchObject({ prepisane: 0, zahodene: 1 });
    expect(podla("znamky", "pouzivatel")).toMatchObject({ prepisane: 1, zahodene: 1 });
    expect(podla("sady", "autor")).toMatchObject({ prepisane: 1 });
    expect(podla("nova_tabulka", "kto")).toMatchObject({ prepisane: 1 });
    expect(v.tabulky.some((t) => t.tabulka === "relacie")).toBe(false);

    expect(pocet(db, "SELECT COUNT(*) AS n FROM pouzivatelia WHERE id = ?", dup)).toBe(0);
    expect(pocet(db, "SELECT autor AS n FROM nazory WHERE id = ?", nazor)).toBe(hlavny);
    expect(pocet(db, "SELECT COUNT(*) AS n FROM nazory_komentare WHERE autor = ?", hlavny)).toBe(1);
    expect(pocet(db, "SELECT hodnota AS n FROM frajerina WHERE pouzivatel = ?", hlavny)).toBe(1100);
    expect(pocet(db, "SELECT COUNT(*) AS n FROM znamky WHERE pouzivatel = ?", hlavny)).toBe(2);
    expect((db.prepare("SELECT data FROM znamky WHERE pouzivatel = ? AND zdroj = 'p1'").get(hlavny) as { data: string }).data).toContain("8");
    expect(pocet(db, "SELECT pouzivatel AS n FROM partie_hraci WHERE partia = 1 AND miesto = 0")).toBe(hlavny);
    expect(pocet(db, "SELECT rozhodol AS n FROM navrhy")).toBe(hlavny);
    expect(pocet(db, "SELECT autor AS n FROM sady")).toBe(hlavny);
    expect(pocet(db, "SELECT kto AS n FROM nova_tabulka")).toBe(hlavny);
    expect(pocet(db, "SELECT COUNT(*) AS n FROM relacie")).toBe(1);
    db.close();
  });

  it("nanečisto vráti tie isté počty a nič nezmení", () => {
    const { db, hlavny, dup } = databaza();
    const skusobne = zlucUcty(db, dup, hlavny, true);
    expect(skusobne.skusobne).toBe(true);
    expect(pocet(db, "SELECT COUNT(*) AS n FROM pouzivatelia WHERE id = ?", dup)).toBe(1);
    expect(pocet(db, "SELECT COUNT(*) AS n FROM nazory WHERE autor = ?", dup)).toBe(1);
    expect(pocet(db, "SELECT COUNT(*) AS n FROM relacie WHERE pouzivatel = ?", dup)).toBe(1);
    const naostro = zlucUcty(db, dup, hlavny, false);
    expect(naostro.tabulky).toEqual(skusobne.tabulky);
    db.close();
  });

  it("odmietne účet so sebou samým, admina a neexistujúce id", () => {
    const { db, hlavny, dup, adminId } = databaza();
    expect(() => zlucUcty(db, hlavny, hlavny, true)).toThrow(/so sebou samým/);
    expect(() => zlucUcty(db, adminId, hlavny, true)).toThrow(/admina/);
    expect(() => zlucUcty(db, 999, hlavny, true)).toThrow(/neexistuje/);
    expect(() => zlucUcty(db, dup, 999, true)).toThrow(/neexistuje/);
    expect(() => zlucUcty(db, dup, Number.NaN, true)).toThrow(/celé čísla/);
    expect(pocet(db, "SELECT COUNT(*) AS n FROM pouzivatelia WHERE id = ?", dup)).toBe(1);
    db.close();
  });
});

describe("zlúčenie účtov a poistka — API", () => {
  let server: GameServer;
  let zmaz: () => Promise<void>;
  const hlavicky = { "content-type": "application/json", "x-naex": "1" };
  const idUctu = async (cookie: string): Promise<number> =>
    ((await (await fetch(`http://127.0.0.1:${server.port}/api/ja`, { headers: { cookie } })).json()) as { pouzivatel: { id: number } }).pouzivatel.id;
  const zluc = (cookie: string, z: number, telo: unknown) =>
    fetch(`http://127.0.0.1:${server.port}/api/admin/pouzivatelia/${z}/zluc`, { method: "POST", headers: { ...hlavicky, cookie }, body: JSON.stringify(telo) });

  beforeAll(async () => {
    ({ server, zmaz } = await testovaciServer());
  });
  afterAll(async () => {
    await zmaz();
  });

  it("registrácia odmietne login agenta s číslom na konci, ai-dizajner-ui povolí", async () => {
    for (const login of ["ai-admin-2", "ai-dizajner-3", "AI-Admin-9"]) {
      const res = await fetch(`http://127.0.0.1:${server.port}/api/registracia`, {
        method: "POST",
        headers: hlavicky,
        body: JSON.stringify({ login, heslo: "tajneheslo", meno: "Admin (AI)" }),
      });
      expect(res.status).toBe(400);
      expect(((await res.json()) as { chyba: string }).chyba).toMatch(/jediný účet/);
    }
    await registruj(server.port, "ai-dizajner-ui");
    await registruj(server.port, "ai-dizajner");
    await registruj(server.port, "hrac-2");
  });

  it("zlúčiť smie len admin; subadmin a hráč dostanú 403", async () => {
    const admin = await prihlas(server.port, TEST_ADMIN.login, TEST_ADMIN.heslo);
    const sub = await registruj(server.port, "ai-sub");
    await nastavUroven(server.port, admin, sub.cookie, "subadmin");
    const hrac = await registruj(server.port);
    await nastavUroven(server.port, admin, hrac.cookie, "hrac");
    const hlavny = await registruj(server.port, "ai-hlavny");
    const dup = await registruj(server.port, "ai-hlavny-x");
    const dupId = await idUctu(dup.cookie);
    const hlavnyId = await idUctu(hlavny.cookie);

    expect((await zluc(sub.cookie, dupId, { do: hlavnyId })).status).toBe(403);
    expect((await zluc(hrac.cookie, dupId, { do: hlavnyId })).status).toBe(403);
    expect((await zluc(admin, dupId, { do: dupId })).status).toBe(400);
    expect((await zluc(admin, 99999, { do: hlavnyId })).status).toBe(404);
    expect((await zluc(admin, await idUctu(admin), { do: hlavnyId })).status).toBe(400);

    const skusobne = await zluc(admin, dupId, { do: hlavnyId, skusobne: true });
    expect(skusobne.status).toBe(200);
    expect((await fetch(`http://127.0.0.1:${server.port}/api/ja`, { headers: { cookie: dup.cookie } }).then((r) => r.json())) as { pouzivatel: unknown }).toMatchObject({
      pouzivatel: { id: dupId },
    });

    const res = await zluc(admin, dupId, { do: hlavnyId });
    expect(res.status).toBe(200);
    const v = (await res.json()) as { z: { login: string }; do: { login: string }; relacie: number };
    expect(v).toMatchObject({ z: { login: "ai-hlavny-x" }, do: { login: "ai-hlavny" }, relacie: 1 });
    // Relácia duplikátu je zrušená — už nie je prihlásený.
    expect(((await fetch(`http://127.0.0.1:${server.port}/api/ja`, { headers: { cookie: dup.cookie } }).then((r) => r.json())) as { pouzivatel: unknown }).pouzivatel).toBeNull();
  });
});

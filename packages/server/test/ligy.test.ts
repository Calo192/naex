// Ligy (Michal 2026-10-28): Tretia / Druhá / Prvá liga = krátka / stredná /
// dlhá hra. Admin definuje, čo ktorú odomyká; predvolene smie každý všetko.
// Pravidlo: Druhá po 1 výhre v Tretej proti človeku, Prvá po 3 výhrach v Druhej;
// bot sa neráta, odomknutie sa nevracia, správcovia a AI smú vždy.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prazdneStatistiky } from "@naex/core";
import { Archiv } from "../src/archiv.ts";
import { Ucty } from "../src/auth.ts";
import { otvorDb } from "../src/db.ts";
import { Ligy, PREDVOLENE_LIGY, textPodmienky } from "../src/ligy.ts";
import type { GameServer } from "../src/server.ts";
import { Klient, TEST_ADMIN, nastavUroven, prihlas, registruj, testovaciServer } from "./pomocnik.ts";

function docasnaDb(): { db: ReturnType<typeof otvorDb>; zmaz: () => void } {
  const dir = mkdtempSync(join(tmpdir(), "naex-ligy-"));
  const db = otvorDb(join(dir, "naex.db"));
  return { db, zmaz: () => { db.close(); rmSync(dir, { recursive: true, force: true }); } };
}

/** Partia hráča `kto` proti `proti` (null = bot) v lige; `vyhra` = kto vyhral. */
function partia(archiv: Archiv, kto: number, proti: number | null, dlzka: string, o: { vyhra?: boolean; dohrata?: boolean } = {}): void {
  archiv.zapis({
    kod: "TEST", zaciatok: 0, koniec: 1, vitaz: o.vyhra === false ? 1 : 0, dovod: "test", kola: 3, verziaSady: null,
    dohrata: o.dohrata ?? true, hraci: [kto, proti], sBotom: proti === null, dlzka, body: null,
    statistiky: [prazdneStatistiky(), prazdneStatistiky()],
  });
}

const smie = (ligy: Ligy, ja: Parameters<Ligy["stav"]>[0]) => Object.fromEntries(ligy.stav(ja).map((s) => [s.liga, s.smie]));

describe("ligy — nastavenie a odomykanie", () => {
  it("predvolene smie každý všetko; pravidlo odomykania je pripravené", () => {
    expect(PREDVOLENE_LIGY.vsetkym).toBe(true);
    expect(PREDVOLENE_LIGY.ligy).toEqual({
      kratka: { podmienka: null, ranky: [] },
      stredna: { podmienka: { liga: "kratka", vyhier: 1 }, ranky: [] },
      dlha: { podmienka: { liga: "stredna", vyhier: 3 }, ranky: [] },
    });
    expect(textPodmienky({ liga: "kratka", vyhier: 1 })).toBe("Vyhraj 1 partiu Tretej ligy proti človeku.");
    expect(textPodmienky({ liga: "stredna", vyhier: 3 })).toBe("Vyhraj 3 partie Druhej ligy proti človeku.");
    expect(textPodmienky({ liga: "stredna", vyhier: 5 })).toBe("Vyhraj 5 partií Druhej ligy proti človeku.");
    const { db, zmaz } = docasnaDb();
    try {
      const ucty = new Ucty(db, { login: "Admin", heslo: null });
      const ligy = new Ligy(db, () => 1);
      const novy = ucty.registruj("novy", "tajneheslo", "Nový", 1);
      expect(smie(ligy, novy)).toEqual({ kratka: true, stredna: true, dlha: true });
      expect(ligy.preco(novy, "dlha", false)).toBeNull();
    } finally {
      zmaz();
    }
  });

  it("po vypnutí „všetci smú všetko“: Tretia hneď, Druhá po 1 výhre proti človeku, Prvá po 3; bot a vzdané sa nerátajú", () => {
    const { db, zmaz } = docasnaDb();
    try {
      const ucty = new Ucty(db, { login: "Admin", heslo: null });
      const archiv = new Archiv(db);
      const ligy = new Ligy(db, () => 1);
      ligy.uloz({ rola: "admin" }, { vsetkym: false });
      const a = ucty.registruj("jano", "tajneheslo", "Jano", 1);
      const b = ucty.registruj("eva", "tajneheslo", "Eva", 1);

      expect(ligy.stav(a)).toEqual([
        { liga: "kratka", smie: true, podmienka: null, postup: null },
        { liga: "stredna", smie: false, podmienka: "Vyhraj 1 partiu Tretej ligy proti človeku.", postup: { ma: 0, treba: 1 } },
        { liga: "dlha", smie: false, podmienka: "Vyhraj 3 partie Druhej ligy proti človeku.", postup: { ma: 0, treba: 3 } },
      ]);
      expect(ligy.preco(a, "stredna", false)).toBe("Druhá liga je pre teba zatiaľ zamknutá. Vyhraj 1 partiu Tretej ligy proti človeku. Máš 0 z 1.");

      // Výhra proti botovi, prehra a vzdaná partia Druhú ligu neodomknú.
      partia(archiv, a.id, null, "kratka");
      partia(archiv, a.id, b.id, "kratka", { vyhra: false });
      partia(archiv, a.id, b.id, "kratka", { dohrata: false });
      partia(archiv, a.id, b.id, "stredna");
      expect(smie(ligy, a)).toEqual({ kratka: true, stredna: false, dlha: false });

      partia(archiv, a.id, b.id, "kratka");
      expect(smie(ligy, a)).toEqual({ kratka: true, stredna: true, dlha: false });
      // Eva vyhrala partiu, ktorú Jano prehral — Druhú ligu má aj ona.
      expect(smie(ligy, b)).toEqual({ kratka: true, stredna: true, dlha: false });

      // Prvá liga: výhra v Druhej z predošlej partie + ešte dve, bot sa neráta.
      partia(archiv, a.id, null, "stredna");
      partia(archiv, a.id, b.id, "stredna");
      expect(ligy.stav(a).find((s) => s.liga === "dlha")?.postup).toEqual({ ma: 2, treba: 3 });
      partia(archiv, a.id, b.id, "stredna");
      expect(smie(ligy, a)).toEqual({ kratka: true, stredna: true, dlha: true });

      // Odomknutie sa nevracia: sprísnenie podmienok nič nevezme…
      ligy.uloz({ rola: "admin" }, { ligy: { stredna: { podmienka: { liga: "kratka", vyhier: 10 }, ranky: [] }, dlha: { podmienka: { liga: "stredna", vyhier: 10 }, ranky: [] } } });
      expect(smie(ligy, a)).toEqual({ kratka: true, stredna: true, dlha: true });
      // …a novému hráčovi platí prísnejšie.
      const c = ucty.registruj("fero", "tajneheslo", "Fero", 1);
      expect(ligy.stav(c).find((s) => s.liga === "stredna")?.postup).toEqual({ ma: 0, treba: 10 });

      // Rank v pravidle ligy ju odomkne bez výhier.
      ligy.uloz({ rola: "admin" }, { ligy: { dlha: { podmienka: { liga: "stredna", vyhier: 10 }, ranky: ["sedmicka"] } } });
      const d = ucty.registruj("dana", "tajneheslo", "Dana", 1);
      ucty.nastavRolu(d.id, "sedmicka");
      expect(smie(ligy, ucty.podlaId(d.id) ?? d)).toEqual({ kratka: true, stredna: false, dlha: true });

      // Správca a AI playtester smú vždy všetko.
      expect(smie(ligy, { ...c, rola: "subadmin" })).toEqual({ kratka: true, stredna: true, dlha: true });
      expect(smie(ligy, { ...c, ai: true })).toEqual({ kratka: true, stredna: true, dlha: true });

      // Proti počítaču platí obmedzenie len so zapnutým „aj proti počítaču“.
      expect(ligy.preco(c, "dlha", true)).not.toBeNull();
      ligy.uloz({ rola: "admin" }, { ajProtiPocitacu: false });
      expect(ligy.preco(c, "dlha", true)).toBeNull();
      expect(ligy.preco(c, "dlha", false)).not.toBeNull();
    } finally {
      zmaz();
    }
  });

  it("výhry sa zapíšu, aj keď smie každý všetko — po vypnutí ich hráč nestratí", () => {
    const { db, zmaz } = docasnaDb();
    try {
      const ucty = new Ucty(db, { login: "Admin", heslo: null });
      const archiv = new Archiv(db);
      const ligy = new Ligy(db, () => 1);
      const a = ucty.registruj("jano", "tajneheslo", "Jano", 1);
      const b = ucty.registruj("eva", "tajneheslo", "Eva", 1);
      partia(archiv, a.id, b.id, "kratka");
      ligy.dorovnaj(a);
      ligy.uloz({ rola: "admin" }, { vsetkym: false, ligy: { stredna: { podmienka: { liga: "kratka", vyhier: 5 }, ranky: [] } } });
      expect(smie(ligy, a)).toEqual({ kratka: true, stredna: true, dlha: false });
    } finally {
      zmaz();
    }
  });

  it("nastavenie mení len správca a overí tvar", () => {
    const { db, zmaz } = docasnaDb();
    try {
      const ligy = new Ligy(db, () => 1);
      expect(() => ligy.uloz({ rola: "sedmicka" }, { vsetkym: false })).toThrow(/admin alebo subadmin/);
      expect(() => ligy.uloz({ rola: "admin" }, { vsetkym: "nie" })).toThrow();
      expect(() => ligy.uloz({ rola: "admin" }, { ligy: { extra: { podmienka: null, ranky: [] } } })).toThrow(/Neznáma liga/);
      expect(() => ligy.uloz({ rola: "admin" }, { ligy: { stredna: { podmienka: { liga: "stredna", vyhier: 1 }, ranky: [] } } })).toThrow(/sebe samej/);
      expect(() => ligy.uloz({ rola: "admin" }, { ligy: { stredna: { podmienka: { liga: "kratka", vyhier: -1 }, ranky: [] } } })).toThrow();
      expect(() => ligy.uloz({ rola: "admin" }, { ligy: { stredna: { podmienka: null, ranky: ["admin"] } } })).toThrow();
      // 0 výhier = liga bez podmienky.
      const n = ligy.uloz({ rola: "subadmin" }, { ligy: { stredna: { podmienka: { liga: "kratka", vyhier: 0 }, ranky: [] } } });
      expect(n.ligy.stredna.podmienka).toBeNull();
      expect(ligy.nastavenie().ligy.stredna.podmienka).toBeNull();
      expect(ligy.nastavenie().vsetkym).toBe(true);
    } finally {
      zmaz();
    }
  });
});

describe("ligy — server vynucuje pri založení a pripojení", () => {
  let server: GameServer;
  let zmaz: () => Promise<void>;
  let admin: string;
  const api = async (cesta: string, cookie: string, init: { method?: string; body?: unknown } = {}): Promise<Record<string, unknown>> => {
    const res = await fetch(`http://127.0.0.1:${server.port}/api${cesta}`, {
      method: init.method ?? "GET",
      headers: { "content-type": "application/json", "x-naex": "1", cookie },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    return (await res.json()) as Record<string, unknown>;
  };

  beforeAll(async () => {
    ({ server, zmaz } = await testovaciServer());
    admin = await prihlas(server.port, TEST_ADMIN.login, TEST_ADMIN.heslo);
  });

  afterAll(async () => {
    await zmaz();
  });

  /** Založí miestnosť; vráti kód a ligu. */
  async function zaloz(k: Klient, sprava: Record<string, unknown>): Promise<{ kod: string; dlzka: string }> {
    k.posli({ type: "create", ...sprava });
    const m = await k.cakaj("privitanie");
    return { kod: String(m.code), dlzka: String(m.dlzka) };
  }

  /** Založenie, ktoré server odmietne — vráti text chyby. */
  async function odmietnute(k: Klient, sprava: Record<string, unknown>): Promise<string> {
    k.posli({ type: sprava.code === undefined ? "create" : "join", ...sprava });
    return String((await k.cakaj("error")).text);
  }

  it("predvolene: každý založí aj Prvú ligu a lobby ukáže všetky ligy odomknuté", async () => {
    const { cookie } = await registruj(server.port);
    const r = await api("/hry/otvorene", cookie);
    expect((r.ligy as { smie: boolean }[]).every((l) => l.smie)).toBe(true);
    const k = new Klient(server.port, cookie);
    await k.otvorene();
    expect(await zaloz(k, { dlzka: "dlha", verejna: true })).toMatchObject({ dlzka: "dlha" });
    k.zavri();
  });

  it("so zapnutými pravidlami nový hráč Druhú ligu nezaloží ani sa do nej nepripojí; Tretiu áno", async () => {
    expect(await api("/admin/ligy", admin, { method: "PUT", body: { vsetkym: false } })).toMatchObject({ vsetkym: false });
    // Bežný hráč nastavenie meniť nesmie.
    const hrac = await registruj(server.port);
    expect((await api("/admin/ligy", hrac.cookie, { method: "PUT", body: { vsetkym: true } })).chyba).toBeTruthy();

    const r = await api("/hry/otvorene", hrac.cookie);
    expect(r.ligy).toEqual([
      { liga: "kratka", smie: true, podmienka: null, postup: null },
      { liga: "stredna", smie: false, podmienka: "Vyhraj 1 partiu Tretej ligy proti človeku.", postup: { ma: 0, treba: 1 } },
      { liga: "dlha", smie: false, podmienka: "Vyhraj 3 partie Druhej ligy proti človeku.", postup: { ma: 0, treba: 3 } },
    ]);

    const k = new Klient(server.port, hrac.cookie);
    await k.otvorene();
    expect(await odmietnute(k, { dlzka: "stredna", verejna: true })).toMatch(/Druhá liga je pre teba zatiaľ zamknutá\. Vyhraj 1 partiu Tretej ligy proti človeku/);
    // Ani proti počítaču (predvolene „aj proti počítaču“).
    expect(await odmietnute(k, { dlzka: "dlha", bot: true })).toMatch(/Prvá liga je pre teba zatiaľ zamknutá/);
    // Bez zvolenej ligy (po výučbe) dostane najvyššiu, ktorú smie.
    expect(await zaloz(k, { bot: true })).toMatchObject({ dlzka: "kratka" });
    k.posli({ type: "leave" });
    expect(await zaloz(k, { dlzka: "kratka", verejna: true })).toMatchObject({ dlzka: "kratka" });
    k.zavri();

    // Druhú ligu založí správca; nový hráč sa k nej nepripojí, Poldeci s rankom v pravidle áno.
    const s = new Klient(server.port, admin);
    await s.otvorene();
    const miestnost = await zaloz(s, { dlzka: "stredna", verejna: true });
    const novy = await registruj(server.port);
    const n = new Klient(server.port, novy.cookie);
    await n.otvorene();
    expect(await odmietnute(n, { code: miestnost.kod })).toMatch(/Druhá liga je pre teba zatiaľ zamknutá/);
    n.zavri();

    await api("/admin/ligy", admin, { method: "PUT", body: { ligy: { stredna: { podmienka: { liga: "kratka", vyhier: 1 }, ranky: ["deci"] } } } });
    const deci = await registruj(server.port);
    await nastavUroven(server.port, admin, deci.cookie, "deci");
    const d = new Klient(server.port, deci.cookie);
    await d.otvorene();
    d.posli({ type: "join", code: miestnost.kod });
    expect((await d.cakaj("state")).type).toBe("state");
    d.zavri();
    s.zavri();

    // Vypnutie pravidiel bez nasadenia: hneď smie každý všetko.
    await api("/admin/ligy", admin, { method: "PUT", body: { vsetkym: true } });
    const r2 = await api("/hry/otvorene", hrac.cookie);
    expect((r2.ligy as { smie: boolean }[]).every((l) => l.smie)).toBe(true);
  });
});

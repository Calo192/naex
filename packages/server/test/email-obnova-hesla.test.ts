// Nepovinný e-mail v profile a obnova zabudnutého hesla (Michal 2026-11-01):
// e-mail vidí len hráč sám a admin, žiadosť o obnovu má vždy rovnakú odpoveď,
// odkaz platí 1 hodinu a raz, po zmene hesla zanikne každý nevybavený odkaz.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import type { GameServer } from "../src/server.ts";
import { otvorDb } from "../src/db.ts";
import { zlucUcty } from "../src/zlucenie.ts";
import { emailDoLogu } from "../src/email.ts";
import { LIMIT_NA_EMAIL, LIMIT_NA_IP, ODPOVED_ZIADOSTI, PLATNOST_ODKAZU_MS } from "../src/obnovaHesla.ts";
import { TEST_ADMIN, nastavUroven, prihlas, registruj, testovaciServer } from "./pomocnik.ts";

let server: GameServer;
let zmaz: () => Promise<void>;
/** Hodiny servera — test posúva čas bez čakania. */
let cas = Date.UTC(2026, 10, 1, 12);
/** E-maily, ktoré by server odoslal. */
const poslane: { komu: string; predmet: string; text: string }[] = [];

beforeAll(async () => {
  ({ server, zmaz } = await testovaciServer(TEST_ADMIN, {
    teraz: () => cas,
    adresa: "https://naex.example",
    posliEmail: async (komu, predmet, text) => {
      poslane.push({ komu, predmet, text });
    },
  }));
});

afterAll(async () => {
  await zmaz();
});

let ip = 0;
/** Každý test z inej IP — brzda žiadostí je na IP a testy by si ju míňali navzájom. */
const novaIp = (): string => `10.0.0.${++ip}`;

async function volaj(
  metoda: string,
  cesta: string,
  cookie: string,
  telo?: unknown,
  hlavicky: Record<string, string> = {},
): Promise<{ status: number; data: Record<string, unknown>; text: string; cookie: string }> {
  const res = await fetch(`http://127.0.0.1:${server.port}/api${cesta}`, {
    method: metoda,
    headers: { cookie, "x-naex": "1", ...hlavicky, ...(telo === undefined ? {} : { "content-type": "application/json" }) },
    ...(telo === undefined ? {} : { body: JSON.stringify(telo) }),
  });
  const text = await res.text();
  return { status: res.status, data: JSON.parse(text) as Record<string, unknown>, text, cookie: (res.headers.get("set-cookie") ?? "").split(";")[0] ?? "" };
}

const emailZJa = async (cookie: string): Promise<unknown> => ((await volaj("GET", "/ja", cookie)).data.pouzivatel as { email?: unknown }).email;

/** Hráč s e-mailom v profile. */
async function hracSEmailom(email: string): Promise<{ cookie: string; login: string; id: number }> {
  const h = await registruj(server.port);
  const r = await volaj("PATCH", "/profil", h.cookie, { email });
  expect(r.status).toBe(200);
  return { ...h, id: (r.data.pouzivatel as { id: number }).id };
}

const ziadost = (email: unknown, zIp: string) => volaj("POST", "/obnova-hesla", "", { email }, { "x-forwarded-for": zIp });
const tokenZ = (text: string): string => /\/obnova-hesla\?t=([A-Za-z0-9_-]+)/.exec(text)?.[1] ?? "";

describe("e-mail v profile", () => {
  it("nastaviť, zmeniť a vymazať; vidí ho hráč sám v /ja aj v odpovedi profilu", async () => {
    const { cookie } = await registruj(server.port);
    expect(await emailZJa(cookie)).toBeNull();

    const r = await volaj("PATCH", "/profil", cookie, { email: "  Fero.Mrkva@Example.sk " });
    expect(r.status).toBe(200);
    expect((r.data.pouzivatel as { email: string }).email).toBe("Fero.Mrkva@Example.sk");
    expect(await emailZJa(cookie)).toBe("Fero.Mrkva@Example.sk");

    expect((await volaj("PATCH", "/profil", cookie, { email: "fero@krcma.sk" })).status).toBe(200);
    expect(await emailZJa(cookie)).toBe("fero@krcma.sk");
    // Avatar ani iné nastavenie e-mail z odpovede nevyhodí — klient by ho inak v profile stratil.
    const avatar = await volaj("DELETE", "/profil/avatar", cookie);
    expect((avatar.data.pouzivatel as { email: string }).email).toBe("fero@krcma.sk");

    expect((await volaj("PATCH", "/profil", cookie, { email: "" })).status).toBe(200);
    expect(await emailZJa(cookie)).toBeNull();
    await volaj("PATCH", "/profil", cookie, { email: "fero@krcma.sk" });
    expect((await volaj("PATCH", "/profil", cookie, { email: null })).status).toBe(200);
    expect(await emailZJa(cookie)).toBeNull();
  });

  it("zlý tvar odmietne a nič nezmení; neprihlásený e-mail nemení", async () => {
    const { cookie } = await registruj(server.port);
    await volaj("PATCH", "/profil", cookie, { email: "dobry@example.sk" });
    for (const zle of ["fero", "fero@", "@example.sk", "fero@example", "fe ro@example.sk", "a@b.c", 42, `${"x".repeat(250)}@example.sk`]) {
      const r = await volaj("PATCH", "/profil", cookie, { email: zle });
      expect(r.status, String(zle)).toBe(400);
    }
    expect(await emailZJa(cookie)).toBe("dobry@example.sk");
    expect((await volaj("PATCH", "/profil", "", { email: "cudzi@example.sk" })).status).toBe(401);
  });

  it("unikátny bez ohľadu na veľké písmená: druhý účet ho nedostane, vlastný sa dá prepísať inými písmenami", async () => {
    const a = await hracSEmailom("Jozo@Example.sk");
    const b = await registruj(server.port);
    const r = await volaj("PATCH", "/profil", b.cookie, { email: "jozo@example.SK" });
    expect(r.status).toBe(409);
    expect(String(r.data.chyba)).toContain("iný účet");
    expect(await emailZJa(b.cookie)).toBeNull();
    expect((await volaj("PATCH", "/profil", a.cookie, { email: "jozo@example.sk" })).status).toBe(200);
    expect(await emailZJa(a.cookie)).toBe("jozo@example.sk");
  });
});

describe("žiadosť o obnovu hesla", () => {
  it("existujúci aj neexistujúci e-mail: rovnaká odpoveď, odkaz dostane len skutočný účet", async () => {
    const h = await hracSEmailom("Zabudlivy@Example.sk");
    const pred = poslane.length;
    const zIp = novaIp();
    const existuje = await ziadost("zabudlivy@example.sk", zIp);
    const neexistuje = await ziadost("nikto@example.sk", zIp);
    expect(existuje.status).toBe(200);
    expect(neexistuje.status).toBe(existuje.status);
    expect(neexistuje.text).toBe(existuje.text);
    expect(existuje.data).toEqual({ ok: true, sprava: ODPOVED_ZIADOSTI });

    expect(poslane.length).toBe(pred + 1);
    const mail = poslane.at(-1);
    expect(mail?.komu).toBe("Zabudlivy@Example.sk");
    expect(mail?.text).toContain(h.login);
    expect(mail?.text).toContain("https://naex.example/obnova-hesla?t=");
    expect(tokenZ(mail?.text ?? "").length).toBeGreaterThan(30);
  });

  it("bez e-mailu alebo so zlým tvarom 400 — to o účte nič neprezradí", async () => {
    expect((await ziadost("", novaIp())).status).toBe(400);
    expect((await ziadost("nie-je-email", novaIp())).status).toBe(400);
  });

  it("brzda: z jednej IP najviac LIMIT_NA_IP žiadostí za hodinu, potom 429", async () => {
    const zIp = novaIp();
    for (let i = 0; i < LIMIT_NA_IP; i++) expect((await ziadost(`niekto${i}@example.sk`, zIp)).status).toBe(200);
    expect((await ziadost("dalsi@example.sk", zIp)).status).toBe(429);
    // Iná IP pokračuje; po hodine aj tá istá.
    expect((await ziadost("dalsi@example.sk", novaIp())).status).toBe(200);
    cas += 60 * 60 * 1000;
    expect((await ziadost("dalsi@example.sk", zIp)).status).toBe(200);
  });

  it("brzda: na jeden e-mail najviac LIMIT_NA_EMAIL odkazov za hodinu, ďalšie potichu (rovnaká odpoveď)", async () => {
    await hracSEmailom("spam@example.sk");
    const pred = poslane.length;
    const odpovede: string[] = [];
    for (let i = 0; i < LIMIT_NA_EMAIL + 2; i++) {
      const r = await ziadost(i % 2 === 0 ? "spam@example.sk" : "SPAM@example.sk", novaIp());
      expect(r.status).toBe(200);
      odpovede.push(r.text);
    }
    expect(new Set(odpovede).size).toBe(1);
    expect(poslane.length - pred).toBe(LIMIT_NA_EMAIL);
    cas += 60 * 60 * 1000;
    await ziadost("spam@example.sk", novaIp());
    expect(poslane.length - pred).toBe(LIMIT_NA_EMAIL + 1);
  });
});

describe("odkaz na obnovu hesla", () => {
  it("nové heslo: odhlási všetky relácie, prihlási novou, staré heslo neplatí, odkaz sa druhý raz nedá použiť", async () => {
    const h = await hracSEmailom("obnova1@example.sk");
    const druhaRelacia = await prihlas(server.port, h.login, "tajneheslo");
    await ziadost("obnova1@example.sk", novaIp());
    const token = tokenZ(poslane.at(-1)?.text ?? "");

    expect((await volaj("POST", "/obnova-hesla/over", "", { token })).data).toEqual({ platny: true });
    // Nové heslo podľa rovnakých pravidiel ako pri registrácii.
    expect((await volaj("POST", "/obnova-hesla/nove", "", { token, heslo: "kratke" })).status).toBe(400);

    const r = await volaj("POST", "/obnova-hesla/nove", "", { token, heslo: "noveheslo123" });
    expect(r.status).toBe(200);
    expect((r.data.pouzivatel as { login: string }).login).toBe(h.login);
    expect(await emailZJa(r.cookie)).toBe("obnova1@example.sk");

    for (const stara of [h.cookie, druhaRelacia]) expect((await volaj("GET", "/ja", stara)).data.pouzivatel).toBeNull();
    await expect(prihlas(server.port, h.login, "tajneheslo")).rejects.toThrow();
    expect(await prihlas(server.port, h.login, "noveheslo123")).not.toBe("");

    expect((await volaj("POST", "/obnova-hesla/over", "", { token })).data).toEqual({ platny: false });
    const znova = await volaj("POST", "/obnova-hesla/nove", "", { token, heslo: "este-ine-heslo" });
    expect(znova.status).toBe(400);
    expect(String(znova.data.chyba)).toContain("neplatný");
  });

  it("po použití jedného odkazu zanikne aj ďalší nevybavený odkaz toho účtu", async () => {
    await hracSEmailom("obnova2@example.sk");
    await ziadost("obnova2@example.sk", novaIp());
    const prvy = tokenZ(poslane.at(-1)?.text ?? "");
    await ziadost("obnova2@example.sk", novaIp());
    const druhy = tokenZ(poslane.at(-1)?.text ?? "");
    expect(prvy).not.toBe(druhy);
    expect((await volaj("POST", "/obnova-hesla/nove", "", { token: druhy, heslo: "noveheslo123" })).status).toBe(200);
    expect((await volaj("POST", "/obnova-hesla/over", "", { token: prvy })).data).toEqual({ platny: false });
    expect((await volaj("POST", "/obnova-hesla/nove", "", { token: prvy, heslo: "ine-heslo-456" })).status).toBe(400);
  });

  it("zmena hesla v profile zruší nevybavené odkazy", async () => {
    const h = await hracSEmailom("obnova3@example.sk");
    await ziadost("obnova3@example.sk", novaIp());
    const token = tokenZ(poslane.at(-1)?.text ?? "");
    expect((await volaj("POST", "/profil/heslo", h.cookie, { stare: "tajneheslo", nove: "zmenene-heslo" })).status).toBe(200);
    expect((await volaj("POST", "/obnova-hesla/over", "", { token })).data).toEqual({ platny: false });
  });

  it("platí 1 hodinu: tesne pred koncom áno, po nej nie", async () => {
    await hracSEmailom("obnova4@example.sk");
    await ziadost("obnova4@example.sk", novaIp());
    const token = tokenZ(poslane.at(-1)?.text ?? "");
    cas += PLATNOST_ODKAZU_MS;
    expect((await volaj("POST", "/obnova-hesla/over", "", { token })).data).toEqual({ platny: true });
    cas += 1;
    expect((await volaj("POST", "/obnova-hesla/over", "", { token })).data).toEqual({ platny: false });
    expect((await volaj("POST", "/obnova-hesla/nove", "", { token, heslo: "noveheslo123" })).status).toBe(400);
  });

  it("zlý alebo chýbajúci token je neplatný", async () => {
    for (const token of [undefined, "", "x", "a".repeat(43), 123, "A".repeat(500)]) {
      expect((await volaj("POST", "/obnova-hesla/over", "", { token })).data).toEqual({ platny: false });
      expect((await volaj("POST", "/obnova-hesla/nove", "", { token, heslo: "noveheslo123" })).status).toBe(400);
    }
  });
});

describe("e-mail neunikne", () => {
  /** Všetky správy WebSocketu, kým sa nič nové nedeje. */
  async function spravyWs(cookie: string, poslat: (ws: WebSocket) => void): Promise<string[]> {
    const ws = new WebSocket(`ws://127.0.0.1:${server.port}/ws`, { headers: { cookie } });
    const spravy: string[] = [];
    ws.on("message", (raw) => spravy.push(String(raw)));
    await new Promise<void>((ok, chyba) => {
      ws.once("open", () => ok());
      ws.once("error", chyba);
    });
    poslat(ws);
    await new Promise((r) => setTimeout(r, 300));
    ws.close();
    return spravy;
  }

  it("iný hráč, subadmin ani verejné API ho nedostanú; admin áno", async () => {
    const email = "tajny.email@example.sk";
    const a = await hracSEmailom(email);
    const b = await registruj(server.port);
    const adminCookie = await prihlas(server.port, TEST_ADMIN.login, TEST_ADMIN.heslo);
    const sub = await registruj(server.port);
    await nastavUroven(server.port, adminCookie, sub.cookie, "subadmin");
    await nastavUroven(server.port, adminCookie, b.cookie, "sedmicka");

    const odpovede: string[] = [];
    for (const cookie of [b.cookie, sub.cookie, ""]) {
      for (const cesta of ["/ja", `/hraci/${a.id}`, `/hraci/${a.id}/partie`, "/rebricek", "/nazory", "/dielna", "/dielna/autori", "/znamky", "/hry/otvorene", "/achievementy"]) {
        odpovede.push(`${cesta}: ${(await volaj("GET", cesta, cookie)).text}`);
      }
    }
    const subZoznam = await volaj("GET", "/admin/pouzivatelia", sub.cookie);
    expect(subZoznam.status).toBe(200);
    odpovede.push(subZoznam.text);
    expect((subZoznam.data.pouzivatelia as Record<string, unknown>[]).every((p) => !("email" in p))).toBe(true);

    // Partia: hostiteľ A s e-mailom, B sa pripojí — nič z toho, čo B dostane, e-mail nenesie.
    let kod = "";
    const spravyA = await spravyWs(a.cookie, (ws) => ws.send(JSON.stringify({ type: "create" })));
    for (const s of spravyA) {
      const m = JSON.parse(s) as { type: string; code?: string };
      if (m.type === "privitanie" && m.code !== undefined) kod = m.code;
    }
    expect(kod).not.toBe("");
    odpovede.push(...(await spravyWs(b.cookie, (ws) => ws.send(JSON.stringify({ type: "join", code: kod })))));
    odpovede.push((await volaj("GET", "/hry/otvorene", b.cookie)).text);

    // Kontrola testu: odpovede naozaj nesú údaje hráča A (profil, partia), len bez e-mailu.
    const spolu = odpovede.join("\n");
    expect(spolu).toContain(`Hráč ${a.login}`);
    expect(odpovede.some((o) => o.includes('"type":"hraci"') && o.includes(`Hráč ${a.login}`))).toBe(true);
    for (const o of odpovede) expect(o.toLowerCase(), o.slice(0, 80)).not.toContain(email);
    expect(odpovede.join("\n")).not.toMatch(/"email"\s*:\s*"/);

    const adminZoznam = await volaj("GET", "/admin/pouzivatelia", adminCookie);
    const riadokA = (adminZoznam.data.pouzivatelia as { id: number; email?: string | null }[]).find((p) => p.id === a.id);
    expect(riadokA?.email).toBe(email);
  });
});

describe("databáza", () => {
  it("migrácia: stará databáza bez e-mailu dostane stĺpec, unikátny index aj tabuľku odkazov, účty ostanú", () => {
    const dir = mkdtempSync(join(tmpdir(), "naex-test-"));
    try {
      const cesta = join(dir, "stara.sqlite");
      const stara = new DatabaseSync(cesta);
      stara.exec(`CREATE TABLE pouzivatelia (id INTEGER PRIMARY KEY, login TEXT NOT NULL UNIQUE COLLATE NOCASE, heslo TEXT NOT NULL,
        meno TEXT NOT NULL, avatar TEXT, rola TEXT NOT NULL DEFAULT 'navstevnik', vytvoreny INTEGER NOT NULL)`);
      stara.prepare("INSERT INTO pouzivatelia (login, heslo, meno, vytvoreny) VALUES ('stary', 'x', 'Starý', 1)").run();
      stara.close();

      const db = otvorDb(cesta);
      expect(db.prepare("SELECT login, email FROM pouzivatelia").all()).toEqual([{ login: "stary", email: null }]);
      expect(db.prepare("SELECT name FROM sqlite_master WHERE name IN ('obnova_hesla', 'pouzivatelia_email') ORDER BY name").all()).toEqual([
        { name: "obnova_hesla" },
        { name: "pouzivatelia_email" },
      ]);
      db.prepare("UPDATE pouzivatelia SET email = 'Stary@Example.sk' WHERE login = 'stary'").run();
      expect(() => db.prepare("INSERT INTO pouzivatelia (login, heslo, meno, vytvoreny, email) VALUES ('iny', 'x', 'Iný', 1, 'stary@example.SK')").run()).toThrow();
      // Viac účtov bez e-mailu je v poriadku.
      db.prepare("INSERT INTO pouzivatelia (login, heslo, meno, vytvoreny) VALUES ('bez1', 'x', 'B', 1), ('bez2', 'x', 'B', 1)").run();
      db.close();
      // Druhý štart nad zmigrovanou databázou nič nepokazí.
      const znova = otvorDb(cesta);
      expect(znova.prepare("SELECT COUNT(*) AS n FROM pouzivatelia").get()).toEqual({ n: 3 });
      znova.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("zlúčenie účtov: odkaz na obnovu duplikátu neprejde na hlavný účet", () => {
    const dir = mkdtempSync(join(tmpdir(), "naex-test-"));
    try {
      const db = otvorDb(join(dir, "z.sqlite"));
      const vloz = (login: string): number =>
        Number(db.prepare("INSERT INTO pouzivatelia (login, heslo, meno, vytvoreny) VALUES (?, 'x', ?, 1)").run(login, login).lastInsertRowid);
      const hlavny = vloz("hlavny");
      const dup = vloz("duplikat");
      db.prepare("INSERT INTO obnova_hesla (token, pouzivatel, vytvoreny, plati_do) VALUES ('h', ?, 1, 9e15)").run(dup);
      const v = zlucUcty(db, dup, hlavny, false);
      expect(v.tabulky.some((t) => t.tabulka === "obnova_hesla")).toBe(false);
      expect(db.prepare("SELECT COUNT(*) AS n FROM obnova_hesla").get()).toEqual({ n: 0 });
      db.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("odosielač e-mailov", () => {
  it("režim log: zapíše adresáta, predmet a text s odkazom, nič neodošle", async () => {
    const riadky: string[] = [];
    await emailDoLogu((r) => riadky.push(r))("fero@example.sk", "NA EX! — obnova hesla", "odkaz: https://naex.example/obnova-hesla?t=abc");
    expect(riadky).toHaveLength(1);
    expect(riadky[0]).toContain("fero@example.sk");
    expect(riadky[0]).toContain("NA EX! — obnova hesla");
    expect(riadky[0]).toContain("/obnova-hesla?t=abc");
  });
});

// 2 na 2 a Päta, Lakeť, Otočka len v Zrejúcej (Michal 2026-11-06: hráči dostanú len novú verziu
// Kalamity 1 na 1): Vypálená ich odmietne aj pri ručne poslanej správe, klientovi ich nesľúbi
// a Zrejúca na tom istom commite kvôli nim nie je „bez zmien“.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import type { GameServer } from "../src/server.ts";
import { JAZYKY_LEN_V_ZREJUCEJ, Vypalena, REZIMY_LEN_V_ZREJUCEJ } from "../src/zrejuca.ts";
import { TEST_ADMIN, prihlas, registruj, testovaciServer } from "./pomocnik.ts";

const volaj = (s: GameServer, metoda: string, cesta: string, cookie = "", telo?: unknown): Promise<Response> =>
  fetch(`http://127.0.0.1:${s.port}/api${cesta}`, {
    method: metoda,
    headers: { "content-type": "application/json", "x-naex": "1", cookie },
    ...(telo === undefined ? {} : { body: JSON.stringify(telo) }),
  });

/** Pošle správu a počká na prvú chybu alebo stav; null = server mlčal. */
async function odpoved(server: GameServer, cookie: string, sprava: unknown): Promise<{ readonly chyba: string | null; readonly typy: readonly string[] }> {
  const ws = new WebSocket(`ws://127.0.0.1:${server.port}/ws`, { headers: { cookie } });
  const typy: string[] = [];
  let chyba: string | null = null;
  ws.on("message", (raw) => {
    const m = JSON.parse(String(raw)) as { type: string; text?: string };
    typy.push(m.type);
    if (m.type === "error") chyba = String(m.text);
  });
  await new Promise<void>((r) => ws.once("open", () => r()));
  ws.send(JSON.stringify(sprava));
  await new Promise((r) => setTimeout(r, 150));
  ws.close();
  return { chyba, typy };
}

describe("Vypálená (predvolený server)", () => {
  let server: GameServer;
  let zmaz: () => Promise<void>;
  let cookie = "";

  beforeAll(async () => {
    ({ server, zmaz } = await testovaciServer(TEST_ADMIN, { botPauzaMs: 0 }));
    ({ cookie } = await registruj(server.port));
  });
  afterAll(async () => {
    await zmaz();
  });

  it.each([
    ["založenie stola 2 na 2", { type: "stol2na2Zaloz", verejny: false, boti: [1, 2, 3] }],
    ["pripojenie k stolu 2 na 2", { type: "stol2na2Pridaj", code: "ABCD" }],
    ["náhodné párovanie 2 na 2", { type: "stol2na2Nahodne" }],
    ["partia Päta, Lakeť, Otočka proti botovi", { type: "create", bot: true, rezim: "pata" }],
    ["stôl Päta, Lakeť, Otočka s kódom", { type: "create", rezim: "pata" }],
  ])("odmietne %s", async (_, sprava) => {
    const { chyba, typy } = await odpoved(server, cookie, sprava);
    expect(chyba).toMatch(/len v Zrejúcej/);
    expect(typy).not.toContain("stol2na2");
    expect(typy).not.toContain("state");
  });

  it("partia 1 na 1 ide ako doteraz", async () => {
    const { chyba, typy } = await odpoved(server, cookie, { type: "create", bot: true });
    expect(chyba).toBeNull();
    expect(typy).toContain("state");
  });

  it("rebríček 2 na 2 neexistuje a /ja režimy nesľúbi", async () => {
    expect((await volaj(server, "GET", "/rebricek-2na2")).status).toBe(404);
    const ja = (await (await volaj(server, "GET", "/ja", cookie)).json()) as { instancia: { rezimyNavyse?: boolean } };
    expect(ja.instancia.rezimyNavyse).toBeUndefined();
  });

  it("prepínač jazykov /ja nesľúbi, kým Michal lokalizáciu neuvoľní (Vypálená len po slovensky, 2026-11-11)", async () => {
    expect(JAZYKY_LEN_V_ZREJUCEJ).toBe(true);
    const ja = (await (await volaj(server, "GET", "/ja", cookie)).json()) as { instancia: { jazyky?: boolean } };
    expect(ja.instancia.jazyky).toBeUndefined();
    const navstevnik = (await (await volaj(server, "GET", "/ja")).json()) as { instancia: { jazyky?: boolean } };
    expect(navstevnik.instancia.jazyky).toBeUndefined();
  });
});

describe("zapnuté režimy (Zrejúca, vývoj s NAEX_REZIMY_ZREJUCEJ)", () => {
  let server: GameServer;
  let zmaz: () => Promise<void>;

  beforeAll(async () => {
    ({ server, zmaz } = await testovaciServer(TEST_ADMIN, { botPauzaMs: 0, rezimyZrejucej: true }));
  });
  afterAll(async () => {
    await zmaz();
  });

  it("založí stôl 2 na 2 aj partiu pata a /ja ich sľúbi", async () => {
    const { cookie } = await registruj(server.port);
    const stol = await odpoved(server, cookie, { type: "stol2na2Zaloz", verejny: false, boti: [] });
    expect(stol.chyba).toBeNull();
    expect(stol.typy).toContain("stol2na2");
    const { cookie: druhy } = await registruj(server.port);
    const pata = await odpoved(server, druhy, { type: "create", bot: true, rezim: "pata" });
    expect(pata.chyba).toBeNull();
    expect(pata.typy).toContain("state");
    expect((await volaj(server, "GET", "/rebricek-2na2")).status).toBe(200);
    const ja = (await (await volaj(server, "GET", "/ja", cookie)).json()) as { instancia: { rezimyNavyse?: boolean } };
    expect(ja.instancia.rezimyNavyse).toBe(true);
  });
});

describe("prepínač jazykov zapnutý (Zrejúca, vývoj)", () => {
  let server: GameServer;
  let zmaz: () => Promise<void>;

  beforeAll(async () => {
    ({ server, zmaz } = await testovaciServer(TEST_ADMIN, { botPauzaMs: 0, jazyky: true }));
  });
  afterAll(async () => {
    await zmaz();
  });

  it("/ja povie klientovi, že jazyky smie ponúknuť", async () => {
    const ja = (await (await volaj(server, "GET", "/ja")).json()) as { instancia: { jazyky?: boolean } };
    expect(ja.instancia.jazyky).toBe(true);
  });
});

describe("Zrejúca na tom istom commite ako Vypálená", () => {
  const VERZIA = { commit: "a1b2c3d", vetva: "master", necommitnute: false, nahrate: "2026-11-06T12:00:00Z" };
  let vypalena: GameServer;
  let zrejuca: GameServer;
  let adresaZrejucej = "";
  const zmazat: (() => Promise<void>)[] = [];

  beforeAll(async () => {
    const v = await testovaciServer(TEST_ADMIN, { zrejucaAdresa: "/", verzia: VERZIA, zrejucaUrl: () => adresaZrejucej });
    vypalena = v.server;
    zmazat.push(v.zmaz);
    const z = await testovaciServer(TEST_ADMIN, {
      verzia: VERZIA,
      zrejuca: { vypalena: new Vypalena(`http://127.0.0.1:${vypalena.port}`, null, TEST_ADMIN), synchronizaciaMs: 0, relaciaMs: 0 },
    });
    zrejuca = z.server;
    zmazat.unshift(z.zmaz);
    adresaZrejucej = `http://127.0.0.1:${zrejuca.port}`;
  });
  afterAll(async () => {
    for (const f of zmazat) await f();
  });

  it("nie je „bez zmien“, kým má režimy navyše: hráč s oprávnením ju otvorí", async () => {
    const admin = await prihlas(vypalena.port, TEST_ADMIN.login, TEST_ADMIN.heslo);
    const stav = (await (await volaj(vypalena, "GET", "/zrejuca/stav", admin)).json()) as Record<string, unknown>;
    expect(stav).toEqual({ dostupna: true, vypalena: VERZIA.commit, zrejuca: VERZIA.commit, kariet: 0, ineZmeny: false, rezimy: REZIMY_LEN_V_ZREJUCEJ, bezZmien: false });
    const tam = await volaj(vypalena, "POST", "/instancia", admin, { nazov: "zrejuca" });
    expect(await tam.json()).toEqual({ kam: "/hra" });
    expect(tam.headers.get("set-cookie")).toMatch(/^naex_instancia=zrejuca/);
  });
});

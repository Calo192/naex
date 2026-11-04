// Nálezy strážcu 2026-11-04 (K1–K3) — test, že diery ostali zavreté:
// K1 pokazená cookie či cesta (%E0) nezhodí server,
// K2 ostrá partia sa rozdá zo semienka ChaCha20 (nie z 31-bitového čísla),
// K3 WebSocket z cudzej stránky (iný Origin) server odmietne.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { request } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import { otvorDb } from "../src/db.ts";
import { createGameServer } from "../src/server.ts";
import type { GameServer } from "../src/server.ts";
import { TEST_ADMIN, registruj } from "./pomocnik.ts";
import { Robot } from "./robot.ts";

let server: GameServer;
let dir: string;
beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "naex-strazca-"));
  // Zbuildovaný klient (stačí index.html) — inak server na statickú cestu odpovie textom bez dekódovania.
  mkdirSync(join(dir, "klient"));
  writeFileSync(join(dir, "klient", "index.html"), "<!doctype html>");
  server = await createGameServer({ port: 0, dataDir: dir, admin: TEST_ADMIN, staticDir: join(dir, "klient") });
});
afterAll(async () => {
  await server.close();
  rmSync(dir, { recursive: true, force: true });
});

/** Surová požiadavka — fetch by pokazenú cestu znormalizoval. */
const surovo = (cesta: string, hlavicky: Record<string, string> = {}): Promise<number> =>
  new Promise((ries, zamietni) => {
    const req = request({ host: "127.0.0.1", port: server.port, path: cesta, headers: hlavicky }, (res) => {
      res.resume();
      ries(res.statusCode ?? 0);
    });
    req.on("error", zamietni);
    req.end();
  });

/** Pokus o WebSocket: "open", alebo HTTP kód odmietnutia. */
const skusWs = (hlavicky: Record<string, string>): Promise<"open" | number> =>
  new Promise((ries) => {
    const ws = new WebSocket(`ws://127.0.0.1:${server.port}/ws`, { headers: hlavicky });
    ws.on("open", () => {
      ws.close();
      ries("open");
    });
    ws.on("unexpected-response", (_req, res) => ries(res.statusCode ?? 0));
    ws.on("error", () => undefined);
  });

const cakaj = async (podmienka: () => boolean | Promise<boolean>): Promise<void> => {
  for (let i = 0; i < 400; i++) {
    if (await podmienka()) return;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error("nedočkal som sa");
};

describe("strážca 2026-11-04", () => {
  it("K1: pokazená cookie ani cesta server nezhodia", async () => {
    expect(await surovo("/api/sada", { cookie: "naex_sid=%E0" })).toBe(200);
    expect(await surovo("/api/%E0")).toBe(400);
    expect(await surovo("/%E0")).toBe(400);
    expect(await surovo("/api/ja", { cookie: "naex_sid=%E0" })).toBe(200);
    // WebSocket s pokazenou cookie: neprihlásený, ale server žije.
    expect(await skusWs({ cookie: "naex_sid=%E0" })).toBe("open");
    expect(await surovo("/api/sada")).toBe(200);
  });

  it("K1: podhodená pokazená cookie neprebije platnú reláciu hráča", async () => {
    const { cookie } = await registruj(server.port);
    const res = await fetch(`http://127.0.0.1:${server.port}/api/ja`, { headers: { cookie: `naex_sid=%E0; ${cookie}` } });
    const telo = (await res.json()) as { pouzivatel: { id: number } | null };
    expect(telo.pouzivatel).not.toBeNull();
  });

  it("K3: WebSocket z cudzej stránky server odmietne, z vlastnej a bez Origin pustí", async () => {
    const host = `127.0.0.1:${server.port}`;
    expect(await skusWs({ origin: "http://6-6-6-6.sslip.io", host })).toBe(403);
    expect(await skusWs({ origin: "https://15-235-242-12.sslip.io.zly.sk", host })).toBe(403);
    expect(await skusWs({ origin: "null", host })).toBe(403);
    expect(await skusWs({ origin: `http://${host}`, host })).toBe("open");
    expect(await skusWs({ origin: "https://15-235-242-12.sslip.io", host: "15-235-242-12.sslip.io" })).toBe("open");
    // Vývoj: Vite na :5173 cez proxy.
    expect(await skusWs({ origin: "http://localhost:5173", host })).toBe("open");
    expect(await skusWs({})).toBe("open");
  });

  it("K2: ostrá partia má semienko ChaCha20 a prehrávač ju z neho prehrá", async () => {
    const jano = (await registruj(server.port)).cookie;
    const eva = (await registruj(server.port)).cookie;
    const a = new Robot(server.port, jano);
    const b = new Robot(server.port, eva);
    await a.otvorene();
    await b.otvorene();
    a.posli({ type: "create" });
    await cakaj(() => a.privitanie.code !== undefined);
    b.posli({ type: "join", code: a.privitanie.code });
    await cakaj(() => a.view !== null && b.view !== null);
    for (let i = 0; i < 10; i++) {
      const r = [a, b].find((x) => x.view?.mozemHrat === true && x.view.koniec === null);
      if (r === undefined) break;
      const pred = r.pocetStavov;
      r.posli({ type: "cmd", cmd: r.vyberTah() });
      await cakaj(() => r.pocetStavov > pred || r.chyby.length > 0);
      r.chyby.splice(0);
    }
    b.posli({ type: "cmd", cmd: { type: "vzdat" } });
    const db = otvorDb(join(dir, "naex.sqlite"));
    try {
      await cakaj(() => db.prepare("SELECT COUNT(*) AS n FROM partie").get()?.n === 1);
      const { seed, id } = db.prepare("SELECT id, seed FROM partie").get() as { id: number; seed: unknown };
      expect(seed).toMatch(/^c20:[0-9a-f]{64}$/);
      const res = await fetch(`http://127.0.0.1:${server.port}/api/partie/${id}/kroky`, { headers: { cookie: jano, "x-naex": "1" } });
      const kroky = (await res.json()) as { dostupny: boolean; pocet: number };
      expect(kroky.dostupny).toBe(true);
      const posledny = await fetch(`http://127.0.0.1:${server.port}/api/partie/${id}/krok/${kroky.pocet}`, { headers: { cookie: jano, "x-naex": "1" } });
      expect(((await posledny.json()) as { koniec: boolean }).koniec).toBe(true);
    } finally {
      db.close();
      a.zavri();
      b.zavri();
    }
  }, 60_000);
});

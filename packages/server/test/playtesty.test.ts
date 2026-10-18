// Reporty playtestov v administrácii: len pre správcov, izolované (CSP sandbox)
// a dostupné len s platným tokenom.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createGameServer, type GameServer } from "../src/server.ts";
import { TEST_ADMIN, nastavUroven, prihlas, registruj } from "./pomocnik.ts";

let server: GameServer;
let dir: string;

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "naex-playtesty-"));
  const reporty = join(dir, "playtesty");
  mkdirSync(join(reporty, "20261012-101447"), { recursive: true });
  writeFileSync(join(reporty, "20261012-101447.html"), "<!doctype html><title>Playtest 20261012-101447 — test</title><script>1</script>");
  writeFileSync(join(reporty, "20261012-101447", "snimka.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  writeFileSync(join(reporty, "vyvoj-znamok.html"), "<!doctype html><title>x</title>");
  writeFileSync(join(reporty, "poznamky.txt"), "nie je report");
  server = await createGameServer({ port: 0, dataDir: join(dir, "data"), admin: TEST_ADMIN, staticDir: join(dir, "nic"), playtestyDir: reporty });
});

afterAll(async () => {
  await server.close();
  rmSync(dir, { recursive: true, force: true });
});

const url = (cesta: string) => `http://127.0.0.1:${server.port}${cesta}`;

describe("reporty playtestov", () => {
  it("vidí ich admin aj subadmin, hráč nie; report sa podá izolovane len s tokenom", async () => {
    const hrac = (await registruj(server.port)).cookie;
    const admin = await prihlas(server.port, TEST_ADMIN.login, TEST_ADMIN.heslo);
    const sub = (await registruj(server.port)).cookie;
    await nastavUroven(server.port, admin, sub, "subadmin");

    expect((await fetch(url("/api/admin/playtesty"), { headers: { cookie: hrac } })).status).toBe(403);
    const res = await fetch(url("/api/admin/playtesty"), { headers: { cookie: sub } });
    expect(res.status).toBe(200);
    const { token, reporty } = (await res.json()) as { token: string; reporty: { subor: string; nazov: string; druh: string }[] };
    expect(reporty.map((r) => r.subor)).toEqual(["vyvoj-znamok.html", "20261012-101447.html"]);
    expect(reporty[1]).toMatchObject({ nazov: "Playtest 20261012-101447 — test", druh: "report" });

    const report = await fetch(url(`/playtesty/${token}/20261012-101447.html`));
    expect(report.status).toBe(200);
    expect(report.headers.get("content-security-policy")).toMatch(/^sandbox allow-scripts/);
    expect((await fetch(url(`/playtesty/${token}/20261012-101447/snimka.png`))).status).toBe(200);

    // Bez platného tokenu nič; mimo priečinka ani iné typy súborov.
    expect((await fetch(url("/playtesty/123.zly/20261012-101447.html"))).status).toBe(403);
    expect((await fetch(url(`/playtesty/1.${token.split(".")[1] ?? ""}/20261012-101447.html`))).status).toBe(403);
    expect((await fetch(url(`/playtesty/${token}/..%2Fdata%2Fnaex.sqlite`))).status).toBe(404);
    expect((await fetch(url(`/playtesty/${token}/poznamky.txt`))).status).toBe(404);
  });
});

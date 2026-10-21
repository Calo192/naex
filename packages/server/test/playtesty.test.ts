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

const json = (cookie: string, metoda: string, telo: unknown): RequestInit => ({
  method: metoda,
  headers: { cookie, "x-naex": "1", "content-type": "application/json" },
  body: JSON.stringify(telo),
});

describe("nahraté reporty", () => {
  it("subadmin nahrá report a obrázok do dátového adresára, hráč nie; nahratý má prednosť", async () => {
    const admin = await prihlas(server.port, TEST_ADMIN.login, TEST_ADMIN.heslo);
    const sub = (await registruj(server.port)).cookie;
    await nastavUroven(server.port, admin, sub, "subadmin");
    const hrac = (await registruj(server.port)).cookie;
    const put = (cookie: string, cesta: string, telo: string) =>
      fetch(url(`/api/admin/playtesty/subor/${cesta}`), { method: "PUT", headers: { cookie, "x-naex": "1" }, body: telo });

    expect((await put(hrac, "20261021-120000.html", "<title>x</title>")).status).toBe(403);
    expect((await put(sub, "20261021-120000.html", "<title>Turnus 20261021-120000</title>")).status).toBe(200);
    expect((await put(sub, "20261021-120000/graf.svg", "<svg/>")).status).toBe(200);
    expect((await put(sub, "20261012-101447.html", "<title>Prepísaný</title>")).status).toBe(200);
    // Mimo priečinka, skryté súbory a iné typy nie.
    expect((await put(sub, "..%2Fnaex.sqlite", "x")).status).toBe(400);
    expect((await put(sub, ".skryty.html", "x")).status).toBe(400);
    expect((await put(sub, "skript.js", "x")).status).toBe(400);

    const { token, reporty } = (await (await fetch(url("/api/admin/playtesty"), { headers: { cookie: sub } })).json()) as {
      token: string;
      reporty: { subor: string; nazov: string }[];
    };
    expect(reporty.map((r) => r.subor)).toEqual(["vyvoj-znamok.html", "20261021-120000.html", "20261012-101447.html"]);
    expect(reporty[2]?.nazov).toBe("Prepísaný");
    expect((await fetch(url(`/playtesty/${token}/20261021-120000/graf.svg`))).status).toBe(200);
  });
});

describe("návrhy z playtestov", () => {
  const navrh = (kluc: string) => ({
    kluc,
    nazov: `Návrh ${kluc}`,
    kritickost: "vysoka",
    oblast: "pravidla",
    problem: "Bitku rozhoduje náhoda.",
    pricina: "Ťahanie kariet.",
    prejav: "Lepší hráč prehrá.",
    dokazy: ["playtest 20261021-120000-1, kolo 3"],
    moznosti: [
      { kluc: "A", nazov: "Menej náhody", popis: "Draft namiesto ťahania.", dopad: "+zručnosť", narocnost: "stredná", odporucana: true },
      { kluc: "B", nazov: "Nič", popis: "Nechať tak.", dopad: "", narocnost: "žiadna", odporucana: false },
    ],
    odporucanie: "A",
    otazky: [],
  });

  it("nahratie, rozhodnutie človeka, hlásenie Developera; hráč nič", async () => {
    const admin = await prihlas(server.port, TEST_ADMIN.login, TEST_ADMIN.heslo);
    const sub = (await registruj(server.port)).cookie;
    await nastavUroven(server.port, admin, sub, "subadmin");
    const hrac = (await registruj(server.port)).cookie;
    const davka = { davka: "20261021-120000", podklady: ["20261021-120000.html", "navrhy-20261021-120000.html"], navrhy: [navrh("nahoda"), navrh("tempo")] };

    expect((await fetch(url("/api/admin/navrhy"), json(hrac, "POST", davka))).status).toBe(403);
    expect((await fetch(url("/api/admin/navrhy"), json(sub, "POST", { ...davka, davka: "zle" }))).status).toBe(400);
    expect((await fetch(url("/api/admin/navrhy"), json(sub, "POST", { ...davka, navrhy: [{ ...navrh("x"), kritickost: "strasna" }] }))).status).toBe(400);
    const r = await fetch(url("/api/admin/navrhy"), json(sub, "POST", davka));
    expect(r.status).toBe(201);
    const { ids } = (await r.json()) as { ids: number[] };
    const [prvy = 0, druhy = 0] = ids;

    // Neexistujúca možnosť a vlastné riešenie bez popisu neprejdú.
    expect((await fetch(url(`/api/admin/navrhy/${prvy}`), json(admin, "PATCH", { stav: "implementovat", volba: "Z" }))).status).toBe(400);
    expect((await fetch(url(`/api/admin/navrhy/${prvy}`), json(admin, "PATCH", { stav: "implementovat", volba: "vlastne", poznamka: "" }))).status).toBe(400);
    expect((await fetch(url(`/api/admin/navrhy/${prvy}`), json(admin, "PATCH", { stav: "implementovat", volba: "A", poznamka: "Draft len v bitke." }))).status).toBe(200);
    expect((await fetch(url(`/api/admin/navrhy/${druhy}`), json(admin, "PATCH", { stav: "zamietnute" }))).status).toBe(200);
    // Developer hlási výsledok — rozhodnutie a kto ho urobil ostanú.
    expect((await fetch(url(`/api/admin/navrhy/${prvy}`), json(sub, "PATCH", { stav: "implementovane", vysledok: "commit abc123" }))).status).toBe(200);

    // Opätovné nahratie dávky prepíše obsah, rozhodnutie nechá.
    await fetch(url("/api/admin/navrhy"), json(sub, "POST", { ...davka, navrhy: [{ ...navrh("nahoda"), nazov: "Nový názov" }, navrh("tempo")] }));
    const zoznam = (await (await fetch(url("/api/admin/navrhy"), { headers: { cookie: sub } })).json()) as {
      navrhy: { id: number; nazov: string; stav: string; volba: string | null; poznamka: string; vysledok: string; rozhodol: { meno: string; ai: boolean } | null }[];
    };
    const n1 = zoznam.navrhy.find((n) => n.id === prvy);
    expect(n1).toMatchObject({ nazov: "Nový názov", stav: "implementovane", volba: "A", poznamka: "Draft len v bitke.", vysledok: "commit abc123" });
    expect(n1?.rozhodol?.ai).toBe(false);
    expect(zoznam.navrhy.find((n) => n.id === druhy)?.stav).toBe("zamietnute");
    expect((await fetch(url("/api/admin/navrhy"), { headers: { cookie: hrac } })).status).toBe(403);

    // Developer vráti nedokončený návrh — rozhodnutie admina ostane.
    expect((await fetch(url(`/api/admin/navrhy/${prvy}`), json(sub, "PATCH", { stav: "rozpracovane" }))).status).toBe(200);
    expect((await fetch(url(`/api/admin/navrhy/${prvy}`), json(sub, "PATCH", { stav: "implementovat" }))).status).toBe(200);
    const po = (await (await fetch(url("/api/admin/navrhy"), { headers: { cookie: sub } })).json()) as { navrhy: { id: number; stav: string; rozhodol: { meno: string } | null }[] };
    expect(po.navrhy.find((n) => n.id === prvy)).toMatchObject({ stav: "implementovat", rozhodol: { meno: n1?.rozhodol?.meno } });

    // Mazať smie len admin.
    expect((await fetch(url(`/api/admin/navrhy/${druhy}`), { method: "DELETE", headers: { cookie: sub, "x-naex": "1" } })).status).toBe(403);
    expect((await fetch(url(`/api/admin/navrhy/${druhy}`), { method: "DELETE", headers: { cookie: admin, "x-naex": "1" } })).status).toBe(200);
  });
});

// Lokalizácia (Michal 2026-11-10): jazyk rozhrania v profile a preklady kariet na zobrazenie.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { GameServer } from "../src/server.ts";
import { JAZYKY_ROZHRANIA } from "../src/auth.ts";
import { JAZYKY_PREKLADU } from "../src/preklady.ts";
import { registruj, TEST_ADMIN, testovaciServer } from "./pomocnik.ts";

let server: GameServer;
let zmaz: () => Promise<void>;
const dir = mkdtempSync(join(tmpdir(), "naex-preklady-"));

beforeAll(async () => {
  mkdirSync(join(dir, "karty"));
  mkdirSync(join(dir, "vzhlad"));
  writeFileSync(
    join(dir, "karty", "en.json"),
    JSON.stringify({ _meta: { jazyk: "en" }, krcma: { nazov: "Pub", efekt: "Booze-up: …", kraje: ["by the tap", "by the door"], sk: { nazov: "Krčma", efekt: "Pitka: …" } } }),
  );
  writeFileSync(join(dir, "vzhlad", "en.json"), JSON.stringify({ _meta: {}, kategorie: { Lokalita: "Location" } }));
  writeFileSync(join(dir, "karty", "pl.json"), "{ nie je json");
  ({ server, zmaz } = await testovaciServer(TEST_ADMIN, { prekladyDir: dir }));
});

afterAll(async () => {
  await zmaz();
  rmSync(dir, { recursive: true, force: true });
});

async function volaj(metoda: string, cesta: string, cookie: string, telo?: unknown): Promise<{ status: number; data: Record<string, unknown> }> {
  const res = await fetch(`http://127.0.0.1:${server.port}/api${cesta}`, {
    method: metoda,
    headers: { cookie, "x-naex": "1", ...(telo === undefined ? {} : { "content-type": "application/json" }) },
    ...(telo === undefined ? {} : { body: JSON.stringify(telo) }),
  });
  return { status: res.status, data: (await res.json()) as Record<string, unknown> };
}

describe("jazyk rozhrania v profile", () => {
  it("predvolene podľa prehliadača (null), uloží sa len známy jazyk", async () => {
    const { cookie } = await registruj(server.port);
    expect(((await volaj("GET", "/ja", cookie)).data.pouzivatel as { jazyk: string | null }).jazyk).toBeNull();

    const ok = await volaj("PATCH", "/profil", cookie, { jazyk: "hu" });
    expect(ok.status).toBe(200);
    expect((ok.data.pouzivatel as { jazyk: string }).jazyk).toBe("hu");
    expect(((await volaj("GET", "/ja", cookie)).data.pouzivatel as { jazyk: string }).jazyk).toBe("hu");

    for (const zle of ["de", "EN", "sk-SK", 1, ""]) expect((await volaj("PATCH", "/profil", cookie, { jazyk: zle })).status).toBe(400);
    expect(((await volaj("PATCH", "/profil", cookie, { jazyk: null })).data.pouzivatel as { jazyk: string | null }).jazyk).toBeNull();
  });

  it("preklady sú pre všetky jazyky rozhrania okrem slovenčiny", () => {
    expect(JAZYKY_ROZHRANIA.filter((j) => j !== "sk")).toEqual([...JAZYKY_PREKLADU]);
  });
});

describe("/api/preklady/<jazyk>", () => {
  it("vráti preklady kariet a vzhľadu bez poznámok prekladateľa, aj návštevníkovi", async () => {
    const r = await volaj("GET", "/preklady/en", "");
    expect(r.status).toBe(200);
    expect(r.data.karty).toEqual({ krcma: { nazov: "Pub", efekt: "Booze-up: …", kraje: ["by the tap", "by the door"], sk: { nazov: "Krčma", efekt: "Pitka: …" } } });
    expect(r.data.vzhlad).toEqual({ kategorie: { Lokalita: "Location" } });
  });

  it("chýbajúci alebo pokazený súbor = prázdny preklad, neznámy jazyk 404", async () => {
    expect((await volaj("GET", "/preklady/pl", "")).data).toEqual({ karty: {}, vzhlad: {} });
    expect((await volaj("GET", "/preklady/cs", "")).data).toEqual({ karty: {}, vzhlad: {} });
    expect((await volaj("GET", "/preklady/sk", "")).status).toBe(404);
    expect((await volaj("GET", "/preklady/de", "")).status).toBe(404);
  });
});

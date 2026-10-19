// Nastavenia profilu (Michal 2026-10-19): zväčšenie karty pri prejdení myšou
// (150 – 400 %) a výber avatara z predvolených dedinských trosiek.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { GameServer } from "../src/server.ts";
import { registruj, testovaciServer } from "./pomocnik.ts";

let server: GameServer;
let zmaz: () => Promise<void>;

beforeAll(async () => {
  ({ server, zmaz } = await testovaciServer());
});

afterAll(async () => {
  await zmaz();
});

async function volaj(metoda: string, cesta: string, cookie: string, telo?: unknown): Promise<{ status: number; data: Record<string, unknown> }> {
  const res = await fetch(`http://127.0.0.1:${server.port}/api${cesta}`, {
    method: metoda,
    headers: { cookie, "x-naex": "1", ...(telo === undefined ? {} : { "content-type": "application/json" }) },
    ...(telo === undefined ? {} : { body: JSON.stringify(telo) }),
  });
  return { status: res.status, data: (await res.json()) as Record<string, unknown> };
}

describe("nastavenia profilu", () => {
  it("zväčšenie lupy: predvolene 200 %, uloží sa v rozsahu 150 – 400 %", async () => {
    const { cookie } = await registruj(server.port);
    const ja = await volaj("GET", "/ja", cookie);
    expect((ja.data.pouzivatel as { lupa: number }).lupa).toBe(200);

    const ok = await volaj("PATCH", "/profil", cookie, { lupa: 320 });
    expect(ok.status).toBe(200);
    expect((ok.data.pouzivatel as { lupa: number; meno: string }).lupa).toBe(320);

    for (const zle of [100, 450, "veľa"]) expect((await volaj("PATCH", "/profil", cookie, { lupa: zle })).status).toBe(400);
    expect(((await volaj("GET", "/ja", cookie)).data.pouzivatel as { lupa: number }).lupa).toBe(320);
  });

  it("hráč si vyberie predvolený avatar, cudzie médium nie", async () => {
    const { cookie } = await registruj(server.port);
    const zoznam = (await volaj("GET", "/avatary", cookie)).data.avatary as string[];
    expect(zoznam.length).toBe(20);
    const zvoleny = zoznam[7] as string;

    const ok = await volaj("PUT", "/profil/avatar-predvoleny", cookie, { avatar: zvoleny });
    expect(ok.status).toBe(200);
    expect((ok.data.pouzivatel as { avatar: string }).avatar).toBe(zvoleny);

    expect((await volaj("PUT", "/profil/avatar-predvoleny", cookie, { avatar: "cudzie-medium" })).status).toBe(400);
    expect((await volaj("PUT", "/profil/avatar-predvoleny", "", { avatar: zvoleny })).status).toBe(401);
  });
});

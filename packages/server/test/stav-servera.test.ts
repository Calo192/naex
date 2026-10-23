// Stav servera pre nasadenie (skill naex-nasad): koľko partií by reštart zhodil.
// Vidí ho len správca — čísla o hráčoch nepatria von.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { GameServer } from "../src/server.ts";
import { Klient, TEST_ADMIN, prihlas, registruj, testovaciServer } from "./pomocnik.ts";

let server: GameServer;
let zmaz: () => Promise<void>;

beforeAll(async () => {
  ({ server, zmaz } = await testovaciServer());
});

afterAll(async () => {
  await zmaz();
});

interface Stav {
  verzia: unknown;
  partie: { ludia: number; sBotom: number; cakajuce: number; poslednaAktivita: number | null; aktivne: number; opustene: number };
  uzavierka: unknown;
}

describe("stav servera", () => {
  it("len pre správcu; rozohraná partia dvoch ľudí sa ráta", async () => {
    const admin = await prihlas(server.port, TEST_ADMIN.login, TEST_ADMIN.heslo);
    const a = await registruj(server.port);
    const b = await registruj(server.port);
    const stav = async (cookie: string) => fetch(`http://127.0.0.1:${server.port}/api/admin/stav-servera`, { headers: { cookie } });

    expect((await stav(a.cookie)).status).toBe(403);
    const prazdny = (await (await stav(admin)).json()) as Stav;
    // Testovací (vývojový) server nemá VERZIA.json z nasadenia.
    expect(prazdny.verzia).toBeNull();
    expect(prazdny.partie).toEqual({ ludia: 0, sBotom: 0, cakajuce: 0, poslednaAktivita: null, aktivne: 0, opustene: 0 });
    expect(prazdny.uzavierka).toBeNull();

    const ka = new Klient(server.port, a.cookie);
    await ka.otvorene();
    ka.posli({ type: "create" });
    const kod = (await ka.cakaj("privitanie")).code as string;
    expect(((await (await stav(admin)).json()) as Stav).partie.cakajuce).toBe(1);

    const kb = new Klient(server.port, b.cookie);
    await kb.otvorene();
    kb.posli({ type: "join", code: kod });
    await ka.cakaj("state");
    const bezi = ((await (await stav(admin)).json()) as Stav).partie;
    expect(bezi).toMatchObject({ ludia: 1, sBotom: 0, cakajuce: 0, aktivne: 1, opustene: 0 });
    expect(bezi.poslednaAktivita).not.toBeNull();
    ka.zavri();
    kb.zavri();
  });
});

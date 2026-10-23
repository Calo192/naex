// Uzávierka pred nasadením (Michal 2026-10-23): počas nej sa nedá založiť partia
// ani pripojiť do novej miestnosti (ľudia ani boti), rozohrané partie bežia ďalej
// a hráč sa do nich vráti. Prepína ju len správca; je len v pamäti servera.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { OZNAM_UZAVIERKY } from "../src/api.ts";
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

const adresa = (cesta: string): string => `http://127.0.0.1:${server.port}/api${cesta}`;
const uzavierka = (cookie: string, zapnut: boolean) =>
  fetch(adresa("/admin/uzavierka"), { method: "PUT", headers: { cookie, "content-type": "application/json", "x-naex": "1" }, body: JSON.stringify({ zapnut }) });
const lobby = async (cookie: string) => (await (await fetch(adresa("/hry/otvorene"), { headers: { cookie } })).json()) as { uzavierka: string | null };
const stav = async (cookie: string) =>
  (await (await fetch(adresa("/admin/stav-servera"), { headers: { cookie } })).json()) as { uzavierka: { od: number } | null; partie: { aktivne: number; opustene: number } };

async function klient(cookie: string): Promise<Klient> {
  const k = new Klient(server.port, cookie);
  await k.otvorene();
  return k;
}

describe("uzávierka pred nasadením", () => {
  it("len správca; nové partie nie, rozohrané bežia ďalej; vypnutie ich znova pustí", async () => {
    const admin = await prihlas(server.port, TEST_ADMIN.login, TEST_ADMIN.heslo);
    const a = await registruj(server.port);
    const b = await registruj(server.port);
    const c = await registruj(server.port);

    expect((await uzavierka(a.cookie, true)).status).toBe(403);
    expect((await stav(admin)).uzavierka).toBeNull();
    expect((await lobby(a.cookie)).uzavierka).toBeNull();

    // Rozohraná partia dvoch ľudí a čakajúca miestnosť — obe ešte pred uzávierkou.
    const ka = await klient(a.cookie);
    ka.posli({ type: "create" });
    const kod = (await ka.cakaj("privitanie")).code as string;
    const kb = await klient(b.cookie);
    kb.posli({ type: "join", code: kod });
    await ka.cakaj("state");
    const kc = await klient(c.cookie);
    kc.posli({ type: "create", verejna: true });
    const cakajuca = (await kc.cakaj("privitanie")).code as string;

    expect((await uzavierka(admin, true)).status).toBe(200);
    const zapnuta = await stav(admin);
    expect(zapnuta.uzavierka).not.toBeNull();
    expect(zapnuta.partie).toMatchObject({ aktivne: 1, opustene: 0 });
    expect((await lobby(a.cookie)).uzavierka).toBe(OZNAM_UZAVIERKY);

    // Nová partia s človekom ani s botom nie; do čakajúcej miestnosti sa nikto nepridá.
    const nova = await klient((await registruj(server.port)).cookie);
    nova.posli({ type: "create" });
    expect((await nova.cakaj("error")).text).toBe(OZNAM_UZAVIERKY);
    nova.posli({ type: "create", bot: true });
    expect((await nova.cakaj("error")).text).toBe(OZNAM_UZAVIERKY);
    nova.posli({ type: "join", code: cakajuca });
    expect((await nova.cakaj("error")).text).toBe(OZNAM_UZAVIERKY);

    // Rozohraná partia beží: hráč sa vráti na svoje miesto a dostane stav.
    kb.zavri();
    const kb2 = await klient(b.cookie);
    kb2.posli({ type: "rejoin", code: kod });
    expect((await kb2.cakaj("privitanie")).seat).toBe(1);
    await kb2.cakaj("state");

    // Vypnutie: zakladať sa dá znova.
    expect((await uzavierka(admin, false)).status).toBe(200);
    expect((await stav(admin)).uzavierka).toBeNull();
    nova.posli({ type: "create" });
    expect((await nova.cakaj("privitanie")).code).toMatch(/^[A-Z2-9]{4}$/);

    for (const k of [ka, kb2, kc, nova]) k.zavri();
  });
});

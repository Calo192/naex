// Partia proti offline protihráčovi cez server: človek (testovací klient,
// vidí len svoj ClientState) dohrá celú hru, bot ťahá sám, partia nejde do
// archívu a kontumovať sa nedá.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POVAHY } from "@naex/core";
import type { GameServer } from "../src/server.ts";
import { TEST_ADMIN, prihlas, registruj, testovaciServer } from "./pomocnik.ts";
import { Robot } from "./robot.ts";

let server: GameServer;
let zmaz: () => Promise<void>;

beforeAll(async () => {
  ({ server, zmaz } = await testovaciServer(TEST_ADMIN, { botPauzaMs: 0 }));
});

afterAll(async () => {
  await zmaz();
});

async function cakaj(podmienka: () => boolean, popis: string): Promise<void> {
  for (let i = 0; i < 3000; i++) {
    if (podmienka()) return;
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error(`nedočkal som sa: ${popis}`);
}

describe("offline protihráč na serveri", () => {
  it("človek dohrá celú partiu proti botovi", async () => {
    const a = new Robot(server.port, (await registruj(server.port)).cookie);
    await a.otvorene();
    a.posli({ type: "create", bot: true });
    await cakaj(() => a.view !== null, "začiatok partie");

    // Bot sedí hneď, bez účtu a Frajeriny.
    const hraci = a.hraci as [{ meno: string } | null, { meno: string; avatar: string | null; bot: boolean } | null];
    expect(POVAHY.map((p) => p.meno)).toContain(hraci[1]?.meno);
    expect(hraci[1]?.bot).toBe(true);
    // Hráč bez fotky má náhodnú dedinskú trosku, bot svoju podobizeň (seed/avatary).
    expect(hraci[1]?.avatar).toEqual(expect.any(String));
    expect((hraci[0] as { avatar?: string | null } | null)?.avatar).toEqual(expect.any(String));

    let tahov = 0;
    const odmietnute: string[] = [];
    for (;;) {
      await cakaj(() => a.view?.koniec != null || a.view?.mozemHrat === true, `môj ťah (fáza ${a.view?.faza})`);
      if (a.view?.koniec != null) break;
      const pred = a.pocetStavov;
      a.posli({ type: "cmd", cmd: a.vyberTah() });
      await cakaj(() => a.pocetStavov > pred || a.chyby.length > 0, "odpoveď servera");
      // Bot s nulovou pauzou ťahá hneď — klient občas pošle ťah podľa stavu,
      // ktorý medzitým zastaral. Server ho odmietne; klient počká na nový stav.
      if (a.chyby.length > 0) {
        odmietnute.push(...a.chyby.splice(0));
        await cakaj(() => a.pocetStavov > pred, "nový stav po odmietnutí");
      }
      expect(odmietnute.length, odmietnute.join(" | ")).toBeLessThanOrEqual(2);
      tahov++;
      expect(tahov).toBeLessThan(3000);
    }
    expect(a.view?.koniec).not.toBeNull();

    // Kontumovať bota nemožno a partia sa do archívu nezapísala.
    a.posli({ type: "kontumacia" });
    await cakaj(() => a.chyby.length > 0, "odmietnutie kontumácie");
    const admin = await prihlas(server.port, TEST_ADMIN.login, TEST_ADMIN.heslo);
    const r = (await (await fetch(`http://127.0.0.1:${server.port}/api/admin/statistiky-kariet`, { headers: { cookie: admin } })).json()) as {
      partie: number;
    };
    expect(r.partie).toBe(0);
    a.zavri();
  }, 120_000);

  it("do partie proti botovi sa nikto nepridá", async () => {
    const a = new Robot(server.port, (await registruj(server.port)).cookie);
    await a.otvorene();
    a.posli({ type: "create", bot: true, verejna: true });
    await cakaj(() => a.privitanie.code !== undefined, "privítanie");
    const cookieB = (await registruj(server.port)).cookie;
    const b = new Robot(server.port, cookieB);
    await b.otvorene();
    b.posli({ type: "join", code: a.privitanie.code });
    await cakaj(() => b.chyby.length > 0, "odmietnutie");
    expect(b.chyby[0]).toMatch(/plná/);
    const otvorene = (await (await fetch(`http://127.0.0.1:${server.port}/api/hry/otvorene`, { headers: { cookie: cookieB } })).json()) as { hry: unknown[] };
    expect(otvorene.hry).toEqual([]);
    a.zavri();
    b.zavri();
  });
});

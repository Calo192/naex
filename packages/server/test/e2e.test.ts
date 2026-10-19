// E2E (M7+M8): dvaja klienti odohrajú CELÚ partiu cez server, pričom robot
// sa rozhoduje VÝHRADNE podľa toho, čo vidí klient (ClientState + voľby) —
// presne ako hráč myšou v UI. Zároveň sa pri každej správe kontroluje, že
// zo servera neodišli žiadne skryté dáta.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { GameServer } from "../src/server.ts";
import { TEST_ADMIN, prihlas, registruj, testovaciServer } from "./pomocnik.ts";
import { Robot } from "./robot.ts";

let server: GameServer;
let zmaz: () => Promise<void>;

beforeAll(async () => {
  ({ server, zmaz } = await testovaciServer());
});

afterAll(async () => {
  await zmaz();
});

describe("E2E — celá partia cez server", () => {
  it("dvaja klienti dohrajú hru len z klientskeho pohľadu", async () => {
    const a = new Robot(server.port, (await registruj(server.port)).cookie);
    await a.otvorene();
    a.posli({ type: "create" });
    for (let i = 0; i < 50 && a.privitanie.code === undefined; i++) {
      await new Promise((r) => setTimeout(r, 20));
    }
    const kod = a.privitanie.code;
    expect(kod).toBeDefined();

    const b = new Robot(server.port, (await registruj(server.port)).cookie);
    await b.otvorene();
    const cakajA = a.novyStav();
    const cakajB = b.novyStav();
    b.posli({ type: "join", code: kod });
    await Promise.all([cakajA, cakajB]);

    const roboti = [a, b] as const;
    let tahov = 0;
    while (a.view?.koniec == null && tahov < 3000) {
      tahov++;
      const naTahu = a.view?.naTahu ?? null;
      expect(naTahu, `nikto nie je na ťahu (fáza ${a.view?.faza})`).not.toBeNull();
      if (naTahu === null) break;
      const seatA = a.privitanie.seat as number;
      const robot = roboti[naTahu === seatA ? 0 : 1] as Robot;
      const cmd = robot.vyberTah();
      const druhy = robot === a ? b : a;
      const cakaRobot = robot.novyStav();
      const cakaDruhy = druhy.novyStav();
      robot.posli({ type: "cmd", cmd });
      await cakaRobot;
      expect(robot.chyby, `server odmietol ${JSON.stringify(cmd)} vo fáze ${a.view?.faza}`).toEqual([]);
      await cakaDruhy;
    }

    expect(a.view?.koniec).not.toBeNull();
    expect(b.view?.koniec).not.toBeNull();
    expect(tahov).toBeGreaterThan(20);

    // Archív si pamätá štatistiky kariet partie — podklad pre rebalans v tvorcovi.
    const admin = await prihlas(server.port, TEST_ADMIN.login, TEST_ADMIN.heslo);
    for (let i = 0; i < 50; i++) {
      const r = (await (await fetch(`http://127.0.0.1:${server.port}/api/admin/statistiky-kariet`, { headers: { cookie: admin } })).json()) as {
        partie: number;
        karty: Record<string, { bitky: number }>;
      };
      if (r.partie === 1) {
        expect(Object.values(r.karty).some((k) => k.bitky > 0)).toBe(true);
        break;
      }
      expect(i, "partia sa nezapísala do archívu").toBeLessThan(49);
      await new Promise((res) => setTimeout(res, 20));
    }

    a.zavri();
    b.zavri();
  }, 60_000);
});

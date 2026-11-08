// Power level kariet (Michal 2026-11-08): váhy vidí každý aj bez prihlásenia,
// nastavuje ich len admin — subadmin, hráč aj návštevník dostanú 403, bez účtu 401.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PREDVOLENE_VAHY_AKCII, type VahyPowerLevelu } from "@naex/tvorba";
import type { GameServer } from "../src/server.ts";
import { TEST_ADMIN, nastavUroven, prihlas, registruj, testovaciServer } from "./pomocnik.ts";

interface Stav {
  vahy: VahyPowerLevelu;
  upravene: number | null;
}

let server: GameServer;
let zmaz: () => Promise<void>;
let admin: string;
let subadmin: string;
let hrac: string;
let navstevnik: string;

const url = (cesta: string): string => `http://127.0.0.1:${server.port}/api${cesta}`;
const volaj = (metoda: string, cesta: string, cookie: string | null, telo?: unknown): Promise<Response> =>
  fetch(url(cesta), {
    method: metoda,
    headers: { "x-naex": "1", "content-type": "application/json", ...(cookie === null ? {} : { cookie }) },
    ...(telo === undefined ? {} : { body: JSON.stringify(telo) }),
  });
const stav = async (cookie: string | null = null): Promise<Stav> => (await (await volaj("GET", "/power-level", cookie)).json()) as Stav;

beforeAll(async () => {
  ({ server, zmaz } = await testovaciServer());
  admin = await prihlas(server.port, TEST_ADMIN.login, TEST_ADMIN.heslo);
  subadmin = (await registruj(server.port)).cookie;
  await nastavUroven(server.port, admin, subadmin, "subadmin");
  hrac = (await registruj(server.port)).cookie;
  await nastavUroven(server.port, admin, hrac, "hrac");
  navstevnik = (await registruj(server.port)).cookie;
});

afterAll(async () => {
  await zmaz();
});

describe("power level", () => {
  it("bez úprav sú to predvolené váhy a číta ich aj návštevník bez prihlásenia", async () => {
    const s = await stav();
    expect(s).toEqual({ vahy: { akcie: PREDVOLENE_VAHY_AKCII, efekty: {} }, upravene: null });
    expect(await stav(navstevnik)).toEqual(s);
  });

  it("nastavuje len admin: subadmin, hráč a návštevník 403, bez účtu 401", async () => {
    const telo = { akcie: { Rana: 5 } };
    expect((await volaj("PUT", "/admin/power-level", null, telo)).status).toBe(401);
    for (const cookie of [subadmin, hrac, navstevnik]) expect((await volaj("PUT", "/admin/power-level", cookie, telo)).status).toBe(403);
    expect((await stav()).vahy.akcie.Rana).toBe(PREDVOLENE_VAHY_AKCII.Rana);
  });

  it("admin mení váhy akcií aj efektov; null vráti predvolenú", async () => {
    const r = await volaj("PUT", "/admin/power-level", admin, { akcie: { Rana: -2.5, Pecka: 4 }, efekty: { veterinar: 3 } });
    expect(r.status).toBe(200);
    const s = (await r.json()) as Stav;
    expect(s.vahy.akcie).toMatchObject({ Rana: -2.5, Pecka: 4, Petelica: PREDVOLENE_VAHY_AKCII.Petelica });
    expect(s.vahy.efekty).toEqual({ veterinar: 3 });
    expect(s.upravene).toBeGreaterThan(0);
    expect(await stav()).toEqual(s);

    await volaj("PUT", "/admin/power-level", admin, { akcie: { Rana: null } });
    const po = await stav();
    expect(po.vahy.akcie.Rana).toBe(PREDVOLENE_VAHY_AKCII.Rana);
    expect(po.vahy.akcie.Pecka).toBe(4);
    expect(po.vahy.efekty).toEqual({ veterinar: 3 });
  });

  it("odmietne váhu mimo rozsahu či kroku a zlý tvar — a nezapíše nič z požiadavky", async () => {
    for (const zle of [{ akcie: { Rana: 11 } }, { akcie: { Rana: 1.25 } }, { akcie: { Rana: "1" } }, { efekty: [] }, { akcie: { "": 1 } }]) {
      expect((await volaj("PUT", "/admin/power-level", admin, zle)).status).toBe(400);
    }
    expect((await volaj("PUT", "/admin/power-level", admin, { akcie: { Viera: 2, Rana: 99 } })).status).toBe(400);
    expect((await stav()).vahy.akcie.Viera).toBe(PREDVOLENE_VAHY_AKCII.Viera);
  });
});

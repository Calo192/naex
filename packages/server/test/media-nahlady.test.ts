// Náhľady médií (Michal 2026-10-22): pozadia scorecardov mali 350 – 600 kB
// a stôl sa na živom webe pri prázdnej cache načítal 5 – 8 s. Menšiu kópiu
// vyrobí prehliadač admina, server ju pošle na /media/<id>?n.

import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { GameServer } from "../src/server.ts";
import { TEST_ADMIN, prihlas, registruj, testovaciServer } from "./pomocnik.ts";

let server: GameServer;
let zmaz: () => Promise<void>;
let admin: string;

beforeAll(async () => {
  ({ server, zmaz } = await testovaciServer());
  admin = await prihlas(server.port, TEST_ADMIN.login, TEST_ADMIN.heslo);
});

afterAll(async () => {
  await zmaz();
});

/** JPEG len podľa hlavičky — server typ overuje podľa prvých bajtov, obrázok nedekóduje. */
const jpeg = (kb: number): Buffer => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), randomBytes(kb * 1024)]);

const url = (cesta: string): string => `http://127.0.0.1:${server.port}${cesta}`;

async function nahraj(cesta: string, metoda: string, telo: Buffer, cookie = admin): Promise<Response> {
  return await fetch(url(`/api${cesta}`), { method: metoda, headers: { cookie, "x-naex": "1", "content-type": "image/jpeg" }, body: telo });
}

describe("náhľady médií", () => {
  it("veľký obrázok bez náhľadu: ?n pošle originál s krátkou cache, po nahratí náhľadu náhľad natrvalo", async () => {
    const original = jpeg(300);
    const id = ((await (await nahraj("/admin/media?druh=pozadie&nazov=scorecard", "POST", original)).json()) as { id: string }).id;

    const bez = (await (await fetch(url("/api/admin/media-bez-nahladu"), { headers: { cookie: admin } })).json()) as { media: { id: string }[] };
    expect(bez.media.map((m) => m.id)).toContain(id);

    const pred = await fetch(url(`/media/${id}?n`));
    expect((await pred.arrayBuffer()).byteLength).toBe(original.length);
    expect(pred.headers.get("cache-control")).toBe("public, max-age=3600");

    const nahlad = jpeg(40);
    expect((await nahraj(`/admin/media/${id}/nahlad`, "PUT", nahlad)).status).toBe(200);

    const po = await fetch(url(`/media/${id}?n`));
    expect((await po.arrayBuffer()).byteLength).toBe(nahlad.length);
    expect(po.headers.get("cache-control")).toContain("immutable");
    // Bez ?n ostáva originál — lupa a tlač.
    expect((await (await fetch(url(`/media/${id}`))).arrayBuffer()).byteLength).toBe(original.length);

    const potom = (await (await fetch(url("/api/admin/media-bez-nahladu"), { headers: { cookie: admin } })).json()) as { media: { id: string }[] };
    expect(potom.media.map((m) => m.id)).not.toContain(id);
  });

  it("malý obrázok ide s ?n natrvalo, náhľad väčší ako originál neprejde, hráč náhľad nahrať nesmie", async () => {
    const maly = jpeg(30);
    const id = ((await (await nahraj("/admin/media?druh=karta&nazov=maly", "POST", maly)).json()) as { id: string }).id;
    expect((await fetch(url(`/media/${id}?n`))).headers.get("cache-control")).toContain("immutable");

    expect((await nahraj(`/admin/media/${id}/nahlad`, "PUT", jpeg(60))).status).toBe(400);
    const { cookie } = await registruj(server.port);
    expect((await nahraj(`/admin/media/${id}/nahlad`, "PUT", jpeg(10), cookie)).status).toBe(403);
  });
});

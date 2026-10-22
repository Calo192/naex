// Profily a detail partie (Michal 2026-10-22): kto čo vidí — vynucuje server.

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

const volaj = async <T = Record<string, unknown>>(cookie: string, metoda: string, cesta: string, telo?: unknown): Promise<{ status: number; data: T }> => {
  const res = await fetch(`http://127.0.0.1:${server.port}/api${cesta}`, {
    method: metoda,
    headers: { "content-type": "application/json", "x-naex": "1", cookie },
    body: telo === undefined ? undefined : JSON.stringify(telo),
  });
  return { status: res.status, data: (await res.json()) as T };
};
const idHraca = async (cookie: string): Promise<number> => ((await volaj<{ pouzivatel: { id: number } }>(cookie, "GET", "/ja")).data.pouzivatel.id);

async function partiaSoVzdanim(cookieA: string, cookieB: string): Promise<void> {
  const a = new Klient(server.port, cookieA);
  const b = new Klient(server.port, cookieB);
  await a.otvorene();
  await b.otvorene();
  a.posli({ type: "create" });
  const kod = (await a.cakaj("privitanie")).code as string;
  b.posli({ type: "join", code: kod });
  await a.cakaj("state");
  await b.cakaj("state");
  b.posli({ type: "cmd", cmd: { type: "vzdat" } });
  // Po vzdaní príde správa o Frajerine — partia je vtedy už v archíve.
  await a.cakaj("frajerina");
  a.zavri();
  b.zavri();
}

describe("profily — zoznam a detail partie", () => {
  it("zoznam partií vidí len vlastník a správca; detail účastník (súperova strana verejná) a správca", async () => {
    const admin = await prihlas(server.port, TEST_ADMIN.login, TEST_ADMIN.heslo);
    const jano = (await registruj(server.port)).cookie;
    const eva = (await registruj(server.port)).cookie;
    const cudzi = (await registruj(server.port)).cookie;
    const [idJano, idEva] = [await idHraca(jano), await idHraca(eva)];
    await partiaSoVzdanim(jano, eva);

    const moje = await volaj<{ pocet: number; partie: { id: number; vysledok: string; dohrata: boolean; verziaPravidiel: string; super: { id: number | null; meno: string } }[] }>(jano, "GET", `/hraci/${idJano}/partie`);
    expect(moje.status).toBe(200);
    expect(moje.data.pocet).toBe(1);
    expect(moje.data.partie[0]).toMatchObject({ vysledok: "vyhra", dohrata: false, super: { id: idEva } });
    expect(moje.data.partie[0]?.verziaPravidiel).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect((await volaj(cudzi, "GET", `/hraci/${idJano}/partie`)).status).toBe(404);
    expect((await volaj(eva, "GET", `/hraci/${idJano}/partie`)).status).toBe(404);
    expect((await volaj(admin, "GET", `/hraci/${idJano}/partie`)).status).toBe(200);
    expect((await volaj(jano, "GET", `/hraci/${idJano}/partie?filter=boti`)).data).toMatchObject({ pocet: 0, partie: [] });
    expect((await volaj(jano, "GET", `/hraci/${idJano}/partie?filter=hocico`)).status).toBe(400);

    const id = moje.data.partie[0]!.id;
    type Detail = { ja: number | null; strany: Record<string, unknown>[]; kola: unknown[]; zaverecne: { spolu: number[] } | null; menaStarsich: Record<string, string> };
    const detail = await volaj<Detail>(jano, "GET", `/partie/${id}`);
    expect(detail.status).toBe(200);
    const ja = detail.data.ja!;
    expect(detail.data.strany[ja]).toHaveProperty("naexUspesne");
    expect(detail.data.strany[ja === 0 ? 1 : 0]).not.toHaveProperty("naexUspesne");
    expect(detail.data.zaverecne?.spolu).toHaveLength(2);
    expect(Object.keys(detail.data.menaStarsich).length).toBe(8);
    expect((await volaj(cudzi, "GET", `/partie/${id}`)).status).toBe(404);
    const preSpravcu = await volaj<Detail>(admin, "GET", `/partie/${id}`);
    expect(preSpravcu.data.ja).toBeNull();
    expect(preSpravcu.data.strany.every((s) => "naexUspesne" in s)).toBe(true);
    expect((await volaj(jano, "GET", "/partie/999999")).status).toBe(404);
  });

  it("AI súper je v zozname partií hráča bez odkazu, správca ho vidí", async () => {
    const admin = await prihlas(server.port, TEST_ADMIN.login, TEST_ADMIN.heslo);
    const clovek = (await registruj(server.port)).cookie;
    const ai = (await registruj(server.port)).cookie;
    const [idCloveka, idAi] = [await idHraca(clovek), await idHraca(ai)];
    expect((await volaj(admin, "PATCH", `/admin/pouzivatelia/${idAi}`, { ai: true })).status).toBe(200);
    await partiaSoVzdanim(clovek, ai);
    const moje = await volaj<{ partie: { super: { id: number | null; ai?: boolean } }[] }>(clovek, "GET", `/hraci/${idCloveka}/partie`);
    expect(moje.data.partie[0]?.super).toMatchObject({ id: null, ai: true });
    const preSpravcu = await volaj<{ partie: { super: { id: number | null } }[] }>(admin, "GET", `/hraci/${idCloveka}/partie`);
    expect(preSpravcu.data.partie[0]?.super.id).toBe(idAi);
  });

  it("skryť môj súhrn sa uloží a vráti v /api/ja", async () => {
    const ja = (await registruj(server.port)).cookie;
    expect((await volaj<{ pouzivatel: { skrytySuhrn: boolean } }>(ja, "GET", "/ja")).data.pouzivatel.skrytySuhrn).toBe(false);
    expect((await volaj(ja, "PATCH", "/profil", { skrytySuhrn: true })).status).toBe(200);
    expect((await volaj<{ pouzivatel: { skrytySuhrn: boolean } }>(ja, "GET", "/ja")).data.pouzivatel.skrytySuhrn).toBe(true);
    expect((await volaj(ja, "PATCH", "/profil", { skrytySuhrn: "áno" })).status).toBe(400);
  });
});

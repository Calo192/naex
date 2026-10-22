// Novinky (Michal 2026-10-22): čítať môže každý aj bez prihlásenia, písať len
// admin a subadmin; odkaz smie viesť len na stránku tohto webu.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { GameServer } from "../src/server.ts";
import { TEST_ADMIN, nastavUroven, prihlas, registruj, testovaciServer } from "./pomocnik.ts";

interface Novinka {
  id: number;
  datum: string;
  kategoria: string;
  nadpis: string;
  text: string;
  odkaz: string;
  vytvorena: number;
}

const chvila = (): Promise<void> => new Promise((r) => setTimeout(r, 5));

let server: GameServer;
let zmaz: () => Promise<void>;
let admin: string;
let subadmin: string;
let hrac: string;

const url = (cesta: string): string => `http://127.0.0.1:${server.port}/api${cesta}`;
const volaj = (metoda: string, cesta: string, cookie: string | null, telo?: unknown): Promise<Response> =>
  fetch(url(cesta), {
    method: metoda,
    headers: { "x-naex": "1", "content-type": "application/json", ...(cookie === null ? {} : { cookie }) },
    ...(telo === undefined ? {} : { body: JSON.stringify(telo) }),
  });
const zoznam = async (): Promise<Novinka[]> => ((await (await fetch(url("/novinky"))).json()) as { novinky: Novinka[] }).novinky;

const ZAKLAD = { datum: "2026-10-21", kategoria: "pravidla", nadpis: "Verejný dlh", text: "Nový Dlh sa hneď prizná a vidí ho aj súper." };

beforeAll(async () => {
  ({ server, zmaz } = await testovaciServer());
  admin = await prihlas(server.port, TEST_ADMIN.login, TEST_ADMIN.heslo);
  subadmin = (await registruj(server.port)).cookie;
  await nastavUroven(server.port, admin, subadmin, "subadmin");
  hrac = (await registruj(server.port)).cookie;
  await nastavUroven(server.port, admin, hrac, "hrac");
});

afterAll(async () => {
  await zmaz();
});

describe("novinky", () => {
  it("píše len admin a subadmin; návštevník bez prihlásenia ich číta", async () => {
    expect((await volaj("POST", "/admin/novinky", null, ZAKLAD)).status).toBe(401);
    expect((await volaj("POST", "/admin/novinky", hrac, ZAKLAD)).status).toBe(403);
    const bezHlavicky = await fetch(url("/admin/novinky"), { method: "POST", headers: { cookie: admin, "content-type": "application/json" }, body: JSON.stringify(ZAKLAD) });
    expect(bezHlavicky.status).toBe(403);
    expect(await zoznam()).toEqual([]);

    const r = await volaj("POST", "/admin/novinky", subadmin, { ...ZAKLAD, odkaz: "/pravidla#exekutor" });
    expect(r.status).toBe(201);
    const { novinka } = (await r.json()) as { novinka: Novinka };
    expect(novinka).toMatchObject({ ...ZAKLAD, odkaz: "/pravidla#exekutor" });
    expect((await volaj("POST", "/admin/novinky", admin, { ...ZAKLAD, kategoria: "karty", nadpis: "Kultúrny dom" })).status).toBe(201);

    const vsetky = await zoznam();
    expect(vsetky.map((n) => n.nadpis)).toEqual(["Kultúrny dom", "Verejný dlh"]);
    // Bez prihlásenia ani po ňom nejde von autor.
    expect(Object.keys(vsetky[0] ?? {})).not.toContain("autor");
  });

  it("najnovšie hore podľa dátumu, v ten istý deň neskôr pridaná vyššie", async () => {
    await volaj("POST", "/admin/novinky", admin, { ...ZAKLAD, datum: "2026-10-19", nadpis: "Staršia" });
    await volaj("POST", "/admin/novinky", admin, { ...ZAKLAD, datum: "2026-10-22", nadpis: "Najnovšia" });
    expect((await zoznam()).map((n) => n.nadpis)).toEqual(["Najnovšia", "Kultúrny dom", "Verejný dlh", "Staršia"]);
  });

  it("odmietne zlý dátum, kategóriu, prázdny nadpis aj odkaz von", async () => {
    for (const zle of [
      { ...ZAKLAD, datum: "2026-02-31" },
      { ...ZAKLAD, datum: "21. 10. 2026" },
      { ...ZAKLAD, kategoria: "bitky" },
      { ...ZAKLAD, nadpis: "  " },
      { ...ZAKLAD, text: undefined },
      { ...ZAKLAD, odkaz: "https://zly.example" },
      { ...ZAKLAD, odkaz: "//zly.example" },
      { ...ZAKLAD, odkaz: "javascript:alert(1)" },
    ]) {
      expect((await volaj("POST", "/admin/novinky", admin, zle)).status).toBe(400);
    }
  });

  it("úprava mení len poslané polia, zmazanie novinku odstráni", async () => {
    const id = (await zoznam()).find((n) => n.nadpis === "Staršia")?.id as number;
    expect((await volaj("PATCH", `/admin/novinky/${id}`, hrac, { nadpis: "Nie" })).status).toBe(403);
    const r = await volaj("PATCH", `/admin/novinky/${id}`, subadmin, { nadpis: "Opravená", odkaz: "/karty" });
    expect(r.status).toBe(200);
    expect(((await r.json()) as { novinka: Novinka }).novinka).toMatchObject({ ...ZAKLAD, datum: "2026-10-19", nadpis: "Opravená", odkaz: "/karty" });
    expect((await volaj("PATCH", `/admin/novinky/${id}`, admin, { kategoria: "nic" })).status).toBe(400);

    expect((await volaj("DELETE", `/admin/novinky/${id}`, hrac)).status).toBe(403);
    expect((await volaj("DELETE", `/admin/novinky/${id}`, admin)).status).toBe(200);
    expect((await zoznam()).some((n) => n.id === id)).toBe(false);
    expect((await volaj("DELETE", `/admin/novinky/${id}`, admin)).status).toBe(404);
    expect((await volaj("PATCH", "/admin/novinky/9999", admin, { nadpis: "X" })).status).toBe(404);
  });

  it("počet nových: prihlásenému od poslednej návštevy (predtým od registrácie), návštevníkovi od času z prehliadača", async () => {
    const pocet = async (cookie: string | null, od?: string): Promise<number> =>
      ((await (await volaj("GET", `/novinky/nove${od === undefined ? "" : `?od=${od}`}`, cookie)).json()) as { pocet: number }).pocet;

    await chvila();
    const novy = (await registruj(server.port)).cookie;
    // Staré novinky nie sú pre nového hráča „nové“.
    expect(await pocet(novy)).toBe(0);
    await chvila();
    await volaj("POST", "/admin/novinky", admin, { ...ZAKLAD, nadpis: "Čerstvá" });
    expect(await pocet(novy)).toBe(1);

    const { videne } = (await (await volaj("GET", "/novinky", novy)).json()) as { videne: number | null };
    expect(typeof videne).toBe("number");
    expect((await (await volaj("GET", "/novinky", null)).json()) as { videne: unknown }).toMatchObject({ videne: null });
    expect((await volaj("POST", "/novinky/videne", null)).status).toBe(401);
    await chvila();
    expect((await volaj("POST", "/novinky/videne", novy)).status).toBe(200);
    expect(await pocet(novy)).toBe(0);

    const cerstva = (await zoznam()).find((n) => n.nadpis === "Čerstvá") as Novinka;
    expect(await pocet(null)).toBe(0);
    expect(await pocet(null, "abc")).toBe(0);
    expect(await pocet(null, String(cerstva.vytvorena - 1))).toBe(1);
    expect(await pocet(null, String(cerstva.vytvorena))).toBe(0);
  });
});

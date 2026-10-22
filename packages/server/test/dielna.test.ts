// Dielňa (Michal 2026-10-22): koncept vidí len autor, píše sa podľa práva
// navrhovat_karty, 1 hráč = 1 cigareta (AI sa neráta), najviac 3 otvorené
// návrhy, posudok s povinným dôvodom; schválenie založí kartu v tvorcovi
// a položku v Prijímači roadmapy.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { GameServer } from "../src/server.ts";
import { TEST_ADMIN, nastavUroven, prihlas, registruj, testovaciServer } from "./pomocnik.ts";

interface Navrh {
  id: number;
  typ: string;
  stav: string;
  dovod: string;
  cigarety: number;
  kartaId: string | null;
  noveRozhodnutie: boolean;
  obsah: { nazov: string; efekt: string; tagy: string[] };
  komentare?: { text: string }[];
}

let server: GameServer;
let zmaz: () => Promise<void>;
let admin: string;
let autor: string;
let druhy: string;
let ai: string;

const url = (cesta: string): string => `http://127.0.0.1:${server.port}/api${cesta}`;
const volaj = (metoda: string, cesta: string, cookie: string | null, telo?: unknown): Promise<Response> =>
  fetch(url(cesta), {
    method: metoda,
    headers: { "x-naex": "1", "content-type": "application/json", ...(cookie === null ? {} : { cookie }) },
    ...(telo === undefined ? {} : { body: JSON.stringify(telo) }),
  });
const json = async <T>(r: Promise<Response>): Promise<T> => (await (await r).json()) as T;
const zoznam = async (cookie: string | null): Promise<Navrh[]> => (await json<{ navrhy: Navrh[] }>(volaj("GET", "/dielna", cookie))).navrhy;
const detail = async (cookie: string | null, id: number): Promise<Navrh> => (await json<{ navrh: Navrh }>(volaj("GET", `/dielna/${id}`, cookie))).navrh;

const KOMINAR = {
  nazov: "Kominár",
  tagy: ["Občan", "Chlap"],
  efekt: "Bitka: Ak má súper v línii Zviera, udelí 1 ranu navyše.",
  lava: ["Rana", null, null, null],
  prava: [null, "Pecka", null, null],
  popisIlustracie: "Začadený kominár s metlou na streche krčmy",
};

async function novy(cookie: string, telo: unknown = KOMINAR): Promise<number> {
  const r = await volaj("POST", "/dielna", cookie, telo);
  expect(r.status).toBe(201);
  return ((await r.json()) as { id: number }).id;
}

beforeAll(async () => {
  ({ server, zmaz } = await testovaciServer());
  admin = await prihlas(server.port, TEST_ADMIN.login, TEST_ADMIN.heslo);
  autor = (await registruj(server.port)).cookie;
  druhy = (await registruj(server.port)).cookie;
  ai = (await registruj(server.port)).cookie;
  const aiJa = await json<{ pouzivatel: { id: number } }>(volaj("GET", "/ja", ai));
  expect((await volaj("PATCH", `/admin/pouzivatelia/${aiJa.pouzivatel.id}`, admin, { ai: true })).status).toBe(200);
});

afterAll(async () => {
  await zmaz();
});

describe("Dielňa", () => {
  it("koncept vidí len autor; po odoslaní ho vidia všetci, aj bez prihlásenia", async () => {
    expect((await volaj("POST", "/dielna", null, KOMINAR)).status).toBe(401);
    const id = await novy(autor);
    expect((await zoznam(null)).some((n) => n.id === id)).toBe(false);
    expect((await zoznam(admin)).some((n) => n.id === id)).toBe(false);
    expect((await volaj("GET", `/dielna/${id}`, null)).status).toBe(404);
    expect((await volaj("GET", `/dielna/${id}`, druhy)).status).toBe(404);
    expect((await detail(autor, id)).stav).toBe("koncept");

    expect((await volaj("PATCH", `/dielna/${id}`, druhy, { nazov: "Cudzí" })).status).toBe(404);
    expect((await volaj("POST", `/dielna/${id}/odoslat`, autor)).status).toBe(200);
    const verejny = (await zoznam(null)).find((n) => n.id === id);
    expect(verejny?.stav).toBe("hlasovanie");
    expect(verejny?.obsah.nazov).toBe("Kominár");
    await volaj("DELETE", `/dielna/${id}`, autor);
  });

  it("odmietne neznámu akciu, tag a obrázok mimo knižnice; nedorobený koncept neodošle", async () => {
    for (const zle of [
      { ...KOMINAR, lava: ["Teleport", null, null, null] },
      { ...KOMINAR, lava: ["Rana", null] },
      { ...KOMINAR, tagy: ["Kozmonaut"] },
      { ...KOMINAR, obrazok: "a".repeat(40) },
      { ...KOMINAR, nazov: "x".repeat(41) },
    ]) {
      expect((await volaj("POST", "/dielna", autor, zle)).status).toBe(400);
    }
    const id = await novy(autor, { nazov: "Bez tagov" });
    const r = await volaj("POST", `/dielna/${id}/odoslat`, autor);
    expect(r.status).toBe(400);
    expect(await r.text()).toMatch(/tag/);
    const zlyEfekt = await novy(autor, { ...KOMINAR, efekt: "Hocikedy: niečo sa stane." });
    expect((await volaj("POST", `/dielna/${zlyEfekt}/odoslat`, autor)).status).toBe(400);
    await volaj("DELETE", `/dielna/${id}`, autor);
    await volaj("DELETE", `/dielna/${zlyEfekt}`, autor);
  });

  it("najviac 3 otvorené návrhy na hráča", async () => {
    const ids = [await novy(autor), await novy(autor), await novy(autor)];
    expect((await volaj("POST", "/dielna", autor, KOMINAR)).status).toBe(400);
    for (const id of ids) expect((await volaj("DELETE", `/dielna/${id}`, autor)).status).toBe(200);
  });

  it("1 hráč = 1 cigareta, vlastnému nie, AI sa neráta; komentáre a nahlásenie", async () => {
    const id = await novy(autor);
    await volaj("POST", `/dielna/${id}/odoslat`, autor);
    expect((await volaj("PUT", `/dielna/${id}/cigareta`, autor)).status).toBe(400);
    expect((await volaj("PUT", `/dielna/${id}/cigareta`, null)).status).toBe(401);
    expect((await json<{ cigarety: number }>(volaj("PUT", `/dielna/${id}/cigareta`, druhy))).cigarety).toBe(1);
    expect((await json<{ cigarety: number }>(volaj("PUT", `/dielna/${id}/cigareta`, druhy))).cigarety).toBe(1);
    expect((await json<{ cigarety: number }>(volaj("PUT", `/dielna/${id}/cigareta`, ai))).cigarety).toBe(1);
    // Úprava počas hlasovania smie a cigarety ostanú.
    expect((await volaj("PATCH", `/dielna/${id}`, autor, { efekt: "Bitka: Udelí 1 ranu navyše." })).status).toBe(200);
    expect((await detail(null, id)).cigarety).toBe(1);

    expect((await volaj("POST", `/dielna/${id}/komentare`, null, { text: "Dobrý nápad" })).status).toBe(401);
    expect((await volaj("POST", `/dielna/${id}/komentare`, druhy, { text: "Dobrý nápad, ale drahý." })).status).toBe(201);
    expect((await detail(null, id)).komentare?.map((k) => k.text)).toEqual(["Dobrý nápad, ale drahý."]);

    expect((await volaj("POST", `/dielna/${id}/nahlasit`, druhy, { dovod: "Je to môj sused Fero." })).status).toBe(200);
    expect((await volaj("GET", `/dielna/${id}/nahlasenia`, druhy)).status).toBe(403);
    expect((await json<{ nahlasenia: unknown[] }>(volaj("GET", `/dielna/${id}/nahlasenia`, admin))).nahlasenia).toHaveLength(1);

    // Skrytý návrh vidí len autor a správca.
    expect((await volaj("POST", `/dielna/${id}/skryt`, druhy, { skryty: true })).status).toBe(403);
    expect((await volaj("POST", `/dielna/${id}/skryt`, admin, { skryty: true })).status).toBe(200);
    expect((await volaj("GET", `/dielna/${id}`, null)).status).toBe(404);
    expect((await volaj("GET", `/dielna/${id}`, autor)).status).toBe(200);
    expect((await volaj("GET", `/dielna/${id}`, admin)).status).toBe(200);
    await volaj("POST", `/dielna/${id}/skryt`, admin, { skryty: false });
    await volaj("DELETE", `/dielna/${id}`, admin);
  });

  it("posudok: vrátiť a zamietnuť s dôvodom, autor dostane značku; schválenie založí kartu a položku roadmapy", async () => {
    const id = await novy(autor);
    await volaj("POST", `/dielna/${id}/odoslat`, autor);
    expect((await volaj("POST", `/dielna/${id}/posudok`, druhy, { rozhodnutie: "schvalit" })).status).toBe(403);
    expect((await volaj("POST", `/dielna/${id}/posudok`, admin, { rozhodnutie: "vratit" })).status).toBe(400);

    expect((await volaj("POST", `/dielna/${id}/posudok`, admin, { rozhodnutie: "vratit", dovod: "Rana na hornej pozícii sa takmer nespojí." })).status).toBe(200);
    expect((await json<{ noveRozhodnutia: number }>(volaj("GET", "/dielna", autor))).noveRozhodnutia).toBe(1);
    const vratene = await detail(autor, id);
    expect(vratene).toMatchObject({ stav: "vratene", dovod: "Rana na hornej pozícii sa takmer nespojí." });
    expect((await json<{ noveRozhodnutia: number }>(volaj("GET", "/dielna", autor))).noveRozhodnutia).toBe(0);

    await volaj("PATCH", `/dielna/${id}`, autor, { lava: [null, "Rana", null, null] });
    expect((await volaj("POST", `/dielna/${id}/odoslat`, autor)).status).toBe(200);
    expect((await volaj("POST", `/dielna/${id}/posudok`, admin, { rozhodnutie: "zamietnut", dovod: "Príliš podobné Recidivistovi." })).status).toBe(200);
    expect((await detail(null, id)).stav).toBe("zamietnute");
    // Zamietnutý sa smie poslať znova.
    expect((await volaj("POST", `/dielna/${id}/odoslat`, autor)).status).toBe(200);

    const r = await json<{ kartaId: string; roadmapa: number }>(volaj("POST", `/dielna/${id}/posudok`, admin, { rozhodnutie: "schvalit" }));
    expect(r.kartaId).toBe("kominar");
    const n = await detail(null, id);
    expect(n).toMatchObject({ stav: "v_tvorcovi", kartaId: "kominar" });
    const obsah = await json<{ karty: { id: string; efekt: string; lava: { povolene: Record<string, string[]> } }[] }>(volaj("GET", "/admin/obsah", admin));
    const karta = obsah.karty.find((k) => k.id === "kominar");
    expect(karta?.efekt).toBe(KOMINAR.efekt);
    expect(karta?.lava.povolene).toEqual({ 1: ["Rana"] });
    const roadmapa = await json<{ polozky: { id: number; nazov: string; stlpec: string; preco: string }[] }>(volaj("GET", "/roadmapa", admin));
    const polozka = roadmapa.polozky.find((p) => p.id === r.roadmapa);
    expect(polozka).toMatchObject({ nazov: "Naprogramovať: Kominár", stlpec: "prijimac" });
    expect(polozka?.preco).toMatch(/Leonardo/);
    // Prevzatý návrh sa už nemení ani nemaže.
    expect((await volaj("PATCH", `/dielna/${id}`, autor, { nazov: "Iný" })).status).toBe(400);
    expect((await volaj("DELETE", `/dielna/${id}`, autor)).status).toBe(400);
  });

  it("úprava existujúcej karty vychádza z karty v hre a bez zmeny sa neodošle", async () => {
    const r = await volaj("POST", "/dielna", druhy, { zaklad: "neexistuje" });
    expect(r.status).toBe(400);
    const id = await novy(druhy, { zaklad: "pijan" });
    const n = await detail(druhy, id);
    expect(n.typ).toBe("uprava");
    expect(n.obsah.nazov).toBe("Pijan");
    const bezZmeny = await volaj("POST", `/dielna/${id}/odoslat`, druhy);
    expect(bezZmeny.status).toBe(400);
    expect(await bezZmeny.text()).toMatch(/nelíši/);
    await volaj("PATCH", `/dielna/${id}`, druhy, { efekt: "Furt: Pijan nikdy nedá NA EX." });
    expect((await volaj("POST", `/dielna/${id}/odoslat`, druhy)).status).toBe(200);
  });

  it("bez práva navrhovat_karty hráč nepíše, ale číta", async () => {
    expect((await volaj("PUT", "/admin/prava", admin, { matica: { navrhovat_karty: ["sedmicka"] } })).status).toBe(200);
    const novacik = (await registruj(server.port)).cookie;
    await nastavUroven(server.port, admin, novacik, "hrac");
    expect((await volaj("POST", "/dielna", novacik, KOMINAR)).status).toBe(403);
    expect((await json<{ smiem: boolean }>(volaj("GET", "/dielna", novacik))).smiem).toBe(false);
    expect((await volaj("GET", "/dielna", novacik)).status).toBe(200);
    await volaj("PUT", "/admin/prava", admin, { matica: { navrhovat_karty: ["navstevnik", "hrac", "deci", "sedmicka"] } });
  });
});

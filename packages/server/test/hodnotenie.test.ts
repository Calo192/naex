// Frajerina, archív partií, profil so štatistikami a spätná väzba.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { GameServer } from "../src/server.ts";
import { FRAJERINA_START, novaFrajerina, ocakavanyVysledok, titul } from "../src/frajerina.ts";
import { Klient, TEST_ADMIN, nastavUroven, prihlas, pravaBezNavstevnika, registruj, testovaciServer } from "./pomocnik.ts";

let server: GameServer;
let zmaz: () => Promise<void>;

beforeAll(async () => {
  ({ server, zmaz } = await testovaciServer());
});

afterAll(async () => {
  await zmaz();
});

async function volaj<T>(cookie: string, metoda: string, cesta: string, telo?: unknown): Promise<{ status: number; data: T }> {
  const res = await fetch(`http://127.0.0.1:${server.port}/api${cesta}`, {
    method: metoda,
    headers: { cookie, "x-naex": "1", ...(telo === undefined ? {} : { "content-type": "application/json" }) },
    body: telo === undefined ? undefined : JSON.stringify(telo),
  });
  return { status: res.status, data: (await res.json()) as T };
}

async function idHraca(cookie: string): Promise<number> {
  return (await volaj<{ pouzivatel: { id: number } }>(cookie, "GET", "/ja")).data.pouzivatel.id;
}

/** Odohrá partiu medzi dvoma hráčmi, ktorú hneď ukončí vzdanie sa hráča `vzda`. */
async function partiaSoVzdanim(cookieA: string, cookieB: string, vzda: 0 | 1): Promise<{ zmeny: { pred: number; po: number }[] }> {
  const a = new Klient(server.port, cookieA);
  const b = new Klient(server.port, cookieB);
  await a.otvorene();
  await b.otvorene();
  a.posli({ type: "create" });
  const kod = (await a.cakaj("privitanie")).code as string;
  b.posli({ type: "join", code: kod });
  await b.cakaj("privitanie");
  await a.cakaj("state");
  await b.cakaj("state");
  (vzda === 0 ? a : b).posli({ type: "cmd", cmd: { type: "vzdat" } });
  const koniec = (await a.cakaj("frajerina")) as unknown as { zmeny: { pred: number; po: number }[] };
  await b.cakaj("frajerina");
  a.zavri();
  b.zavri();
  return koniec;
}

describe("Frajerina — výpočet", () => {
  it("rovný proti rovnému: koľko jeden získa, toľko druhý stratí", () => {
    const [a, b] = novaFrajerina([1200, 1200], 0);
    expect(a - 1200).toBe(16);
    expect(1200 - b).toBe(16);
  });

  it("silnejší porazí slabšieho: obaja sa pohnú len málo", () => {
    const [silny, slaby] = novaFrajerina([1600, 1200], 0);
    expect(silny - 1600).toBeGreaterThan(0);
    expect(silny - 1600).toBeLessThanOrEqual(3);
    expect(1200 - slaby).toBe(silny - 1600);
  });

  it("prekvapenie: slabší porazí silnejšieho a získa veľa", () => {
    const [silny, slaby] = novaFrajerina([1600, 1200], 1);
    expect(slaby - 1200).toBeGreaterThanOrEqual(28);
    expect(1600 - silny).toBe(slaby - 1200);
  });

  it("remíza posúva k sebe a očakávanie je symetrické", () => {
    const [a, b] = novaFrajerina([1400, 1200], null);
    expect(a).toBeLessThan(1400);
    expect(b).toBeGreaterThan(1200);
    expect(ocakavanyVysledok(1400, 1200) + ocakavanyVysledok(1200, 1400)).toBeCloseTo(1);
  });

  it("tituly rastú s Frajerinou", () => {
    expect(titul(FRAJERINA_START)).toBe("Návštevník");
    expect(titul(2100)).toBe("Kráľ krčmy");
    expect(titul(500)).toBe("Abstinent");
  });
});

describe("archív partií a profil", () => {
  it("vzdanie sa zapíše partiu, prepočíta Frajerinu a ukáže ju v profile aj rebríčku", async () => {
    const jano = (await registruj(server.port)).cookie;
    const eva = (await registruj(server.port)).cookie;
    const idJano = await idHraca(jano);
    const idEva = await idHraca(eva);

    // Eva sa vzdá → vyhráva Jano (miesto 0).
    const { zmeny } = await partiaSoVzdanim(jano, eva, 1);
    expect(zmeny[0]).toEqual({ pred: 1200, po: 1216 });
    expect(zmeny[1]).toEqual({ pred: 1200, po: 1184 });

    const profil = await volaj<{
      frajerina: { hodnota: number; partie: number; vyhry: number; provizorna: boolean; poradie: number; titul: string };
      historia: { hodnota: number }[];
      statistiky: { partie: number; tahy: number };
      partie: { vysledok: string; dovod: string; super: { id: number; meno: string }; frajerina: { pred: number; po: number } }[];
      superi: { id: number; vyhry: number }[];
    }>(eva, "GET", `/hraci/${idJano}`);
    expect(profil.status).toBe(200);
    expect(profil.data.frajerina).toMatchObject({ hodnota: 1216, partie: 1, vyhry: 1, provizorna: true, poradie: 1 });
    expect(profil.data.historia.map((h) => h.hodnota)).toEqual([1200, 1216]);
    expect(profil.data.statistiky.partie).toBe(1);
    expect(profil.data.partie[0]?.vysledok).toBe("vyhra");
    expect(profil.data.partie[0]?.dovod).toContain("Partiu vzdáva");
    expect(profil.data.partie[0]?.super.id).toBe(idEva);
    expect(profil.data.superi[0]).toMatchObject({ id: idEva, vyhry: 1 });

    // Odveta: Jano sa vzdá, Eva si polepší viac, než by získala proti rovnému.
    const odveta = await partiaSoVzdanim(jano, eva, 0);
    expect(odveta.zmeny[1]?.po).toBeGreaterThan(1184 + 16);
    expect((odveta.zmeny[0]?.pred ?? 0) - (odveta.zmeny[0]?.po ?? 0)).toBe((odveta.zmeny[1]?.po ?? 0) - (odveta.zmeny[1]?.pred ?? 0));

    const rebricek = await volaj<{ hraci: { id: number; poradie: number; partie: number }[] }>(jano, "GET", "/rebricek");
    const riadky = rebricek.data.hraci.filter((h) => h.id === idJano || h.id === idEva);
    expect(riadky).toHaveLength(2);
    expect(riadky.every((h) => h.partie === 2)).toBe(true);
  });

  it("profil a rebríček sú len pre prihlásených; neznámy hráč je 404", async () => {
    const res = await fetch(`http://127.0.0.1:${server.port}/api/rebricek`);
    expect(res.status).toBe(401);
    const ja = (await registruj(server.port)).cookie;
    expect((await volaj(ja, "GET", "/hraci/999999")).status).toBe(404);
    // Nový hráč bez partií má štartovú Frajerinu a žiadne poradie.
    const p = await volaj<{ frajerina: { hodnota: number; poradie: number | null } }>(ja, "GET", `/hraci/${await idHraca(ja)}`);
    expect(p.data.frajerina).toMatchObject({ hodnota: 1200, poradie: null });
  });

  it("kontumácia: kým je súper pripojený, výhru si vyžiadať nemožno", async () => {
    const a = new Klient(server.port, (await registruj(server.port)).cookie);
    const b = new Klient(server.port, (await registruj(server.port)).cookie);
    await a.otvorene();
    await b.otvorene();
    a.posli({ type: "create" });
    const kod = (await a.cakaj("privitanie")).code as string;
    b.posli({ type: "join", code: kod });
    await a.cakaj("state");
    a.posli({ type: "kontumacia" });
    expect(String((await a.cakaj("error")).text)).toContain("pripojený");
    b.zavri();
    while ((await a.cakaj("superPripojeny")).connected !== false) {
      // staršie oznamy o pripojení z fronty
    }
    a.posli({ type: "kontumacia" });
    expect(String((await a.cakaj("error")).text)).toMatch(/o \d+ s/);
    a.zavri();
  });
});

describe("spätná väzba", () => {
  it("názor, komentár, cigarety a oprávnenia", async () => {
    const autor = (await registruj(server.port)).cookie;
    const iny = (await registruj(server.port)).cookie;
    const admin = await prihlas(server.port, TEST_ADMIN.login, TEST_ADMIN.heslo);
    // Keď návštevníkovi matica práv písanie odoberie, spätnú väzbu len číta (predvolene smie všetko).
    await pravaBezNavstevnika(server.port, admin);
    expect((await volaj(autor, "POST", "/nazory", { kategoria: "pravidla", text: "Návštevník skúša písať." })).status).toBe(403);
    await pravaBezNavstevnika(server.port, admin, false);
    await nastavUroven(server.port, admin, autor, "hrac");
    await nastavUroven(server.port, admin, iny, "hrac");

    const novy = await volaj<{ id: number }>(autor, "POST", "/nazory", { kategoria: "pravidla", text: "NA EX na súperovej karte treba vysvetliť." });
    expect(novy.status).toBe(201);
    const id = novy.data.id;

    // Vlastnému názoru cigaretu nedáš, inému áno — a len jednu.
    expect((await volaj(autor, "PUT", `/nazory/${id}/cigareta`)).status).toBe(400);
    expect((await volaj<{ cigarety: number }>(iny, "PUT", `/nazory/${id}/cigareta`)).data.cigarety).toBe(1);
    expect((await volaj<{ cigarety: number }>(iny, "PUT", `/nazory/${id}/cigareta`)).data.cigarety).toBe(1);
    expect((await volaj<{ cigarety: number }>(admin, "PUT", `/nazory/${id}/cigareta`)).data.cigarety).toBe(2);
    expect((await volaj<{ cigarety: number }>(admin, "DELETE", `/nazory/${id}/cigareta`)).data.cigarety).toBe(1);

    const kom = await volaj<{ id: number }>(iny, "POST", `/nazory/${id}/komentare`, { text: "Súhlasím, aj mňa to prekvapilo." });
    expect(kom.status).toBe(201);
    expect((await volaj<{ cigarety: number }>(autor, "PUT", `/nazory/komentare/${kom.data.id}/cigareta`)).data.cigarety).toBe(1);

    const zoznam = await volaj<{
      nazory: { id: number; cigarety: number; mojaCigareta: boolean; komentare: { text: string; cigarety: number }[] }[];
    }>(iny, "GET", "/nazory?triedenie=cigarety");
    const n = zoznam.data.nazory.find((x) => x.id === id);
    expect(n).toMatchObject({ cigarety: 1, mojaCigareta: true });
    expect(n?.komentare[0]).toMatchObject({ text: "Súhlasím, aj mňa to prekvapilo.", cigarety: 1 });

    // Cudzí názor neupravíš ani nezmažeš; stav mení len admin.
    expect((await volaj(iny, "PATCH", `/nazory/${id}`, { text: "prepísané cudzím" })).status).toBe(403);
    expect((await volaj(iny, "DELETE", `/nazory/${id}`)).status).toBe(403);
    expect((await volaj(autor, "PATCH", `/nazory/${id}`, { stav: "hotove" })).status).toBe(403);
    expect((await volaj(admin, "PATCH", `/nazory/${id}`, { stav: "planovane" })).status).toBe(200);
    expect((await volaj(autor, "PATCH", `/nazory/${id}`, { text: "Upravený text názoru." })).status).toBe(200);

    const poUprave = await volaj<{ nazory: { id: number; text: string; stav: string; upraveny: number | null }[] }>(autor, "GET", "/nazory?kategoria=pravidla");
    expect(poUprave.data.nazory.find((x) => x.id === id)).toMatchObject({ text: "Upravený text názoru.", stav: "planovane" });

    // Admin zmaže cudzí komentár, autor svoj názor (komentáre idú s ním).
    expect((await volaj(admin, "DELETE", `/nazory/komentare/${kom.data.id}`)).status).toBe(200);
    expect((await volaj(autor, "DELETE", `/nazory/${id}`)).status).toBe(200);
    expect((await volaj(autor, "GET", "/nazory")).data).toMatchObject({ nazory: [] });
  });

  it("kontrola vstupu, brzda a prihlásenie", async () => {
    const ja = (await registruj(server.port)).cookie;
    await nastavUroven(server.port, await prihlas(server.port, TEST_ADMIN.login, TEST_ADMIN.heslo), ja, "hrac");
    expect((await volaj(ja, "POST", "/nazory", { kategoria: "nezmysel", text: "Text názoru je dosť dlhý." })).status).toBe(400);
    expect((await volaj(ja, "POST", "/nazory", { kategoria: "ine", text: "x" })).status).toBe(400);
    expect((await volaj(ja, "POST", "/nazory", { kategoria: "ine", text: "a".repeat(3001) })).status).toBe(400);
    for (let i = 0; i < 5; i++) expect((await volaj(ja, "POST", "/nazory", { kategoria: "napad", text: `Nápad číslo ${i}` })).status).toBe(201);
    expect((await volaj(ja, "POST", "/nazory", { kategoria: "napad", text: "Šiesty nápad príliš skoro" })).status).toBe(429);
    const res = await fetch(`http://127.0.0.1:${server.port}/api/nazory`);
    expect(res.status).toBe(401);
  });
});

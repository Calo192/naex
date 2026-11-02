// Vypálená a Zrejúca (Michal 2026-11-02): dve inštancie toho istého servera. Zrejúca púšťa
// len admina, subadminov a AI účty — heslo overí Vypálená, účet si tu zrkadlí. Vypálená hrá
// zverejnenú sadu, Zrejúca rozpracovaný stav tvorcu Vypálenej. Tvorca, účty a známky hry
// sú len vo Vypálenej.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { GameServer } from "../src/server.ts";
import { LEN_PRE_TESTEROV, Vypalena } from "../src/zrejuca.ts";
import { TEST_ADMIN, nastavUroven, prihlas, registruj, testovaciServer } from "./pomocnik.ts";

let vypalena: GameServer;
let zrejuca: GameServer;
const upratanie: (() => Promise<void>)[] = [];
const VEREJNA = "https://vypalena.test";
const ZREJUCA_VEREJNA = "https://zrejuca.test";

beforeAll(async () => {
  const v = await testovaciServer(TEST_ADMIN, { zrejucaAdresa: ZREJUCA_VEREJNA });
  vypalena = v.server;
  upratanie.push(v.zmaz);
  const z = await testovaciServer(TEST_ADMIN, {
    zrejuca: { vypalena: new Vypalena(`http://127.0.0.1:${vypalena.port}`, VEREJNA, TEST_ADMIN), synchronizaciaMs: 0 },
  });
  zrejuca = z.server;
  upratanie.unshift(z.zmaz);
});

afterAll(async () => {
  for (const f of upratanie) await f();
});

const HLAVICKY = { "content-type": "application/json", "x-naex": "1" };
const volaj = (server: GameServer, metoda: string, cesta: string, cookie = "", telo?: unknown): Promise<Response> =>
  fetch(`http://127.0.0.1:${server.port}/api${cesta}`, {
    method: metoda,
    headers: { ...HLAVICKY, cookie },
    body: telo === undefined ? null : JSON.stringify(telo),
  });
const prihlasenie = (login: string, heslo: string): Promise<Response> => volaj(zrejuca, "POST", "/prihlasenie", "", { login, heslo });
const cookieZ = (r: Response): string => (r.headers.get("set-cookie") ?? "").split(";")[0] ?? "";

/** Účet vo Vypálenej s danou úrovňou a značkou AI; vráti login (heslo je „tajneheslo“). */
async function ucetVoVypalenej(rola: string, ai = false): Promise<string> {
  const admin = await prihlas(vypalena.port, TEST_ADMIN.login, TEST_ADMIN.heslo);
  const { cookie, login } = await registruj(vypalena.port);
  if (rola !== "navstevnik") await nastavUroven(vypalena.port, admin, cookie, rola);
  if (ai) {
    const ja = (await (await volaj(vypalena, "GET", "/ja", cookie)).json()) as { pouzivatel: { id: number } };
    expect((await volaj(vypalena, "PATCH", `/admin/pouzivatelia/${ja.pouzivatel.id}`, admin, { ai: true })).status).toBe(200);
  }
  return login;
}

describe("Zrejúca — prístup len pre testerov", () => {
  it("neprihlásený vidí len, kde je a ako sa prihlásiť; dáta nie", async () => {
    const ja = (await (await volaj(zrejuca, "GET", "/ja")).json()) as { pouzivatel: unknown; instancia: unknown };
    expect(ja.pouzivatel).toBeNull();
    expect(ja.instancia).toEqual({ nazov: "zrejuca", vypalena: VEREJNA, zrejuca: null });
    const sada = await volaj(zrejuca, "GET", "/sada");
    expect(sada.status).toBe(401);
    expect(((await sada.json()) as { chyba: string }).chyba).toBe(LEN_PRE_TESTEROV);
    expect((await volaj(zrejuca, "GET", "/hry/otvorene")).status).toBe(401);
    // Vypálená ostáva verejná a o Zrejúcej nevie.
    expect(((await (await volaj(vypalena, "GET", "/ja")).json()) as { instancia: unknown }).instancia).toEqual({ nazov: "vypalena", vypalena: null, zrejuca: ZREJUCA_VEREJNA });
    expect((await volaj(vypalena, "GET", "/sada")).status).toBe(200);
  });

  it("hráč s platným heslom Vypálenej dostane slušné odmietnutie, zlé heslo 401", async () => {
    const hrac = await ucetVoVypalenej("hrac");
    const r = await prihlasenie(hrac, "tajneheslo");
    expect(r.status).toBe(403);
    expect(((await r.json()) as { chyba: string }).chyba).toBe(LEN_PRE_TESTEROV);
    expect(cookieZ(r)).toBe("");
    expect((await prihlasenie(hrac, "zleheslo1")).status).toBe(401);
    expect((await prihlasenie(await ucetVoVypalenej("navstevnik"), "tajneheslo")).status).toBe(403);
  });

  it("admin, subadmin a AI účet sa prihlásia heslom z Vypálenej", async () => {
    const admin = await prihlasenie(TEST_ADMIN.login, TEST_ADMIN.heslo);
    expect(admin.status).toBe(200);
    const subadmin = await ucetVoVypalenej("subadmin");
    const ai = await ucetVoVypalenej("hrac", true);
    for (const [login, rola, jeAi] of [
      [subadmin, "subadmin", false],
      [ai, "hrac", true],
    ] as const) {
      const r = await prihlasenie(login, "tajneheslo");
      expect(r.status).toBe(200);
      const ja = (await (await volaj(zrejuca, "GET", "/ja", cookieZ(r))).json()) as { pouzivatel: { login: string; rola: string; ai: boolean } };
      expect(ja.pouzivatel).toMatchObject({ login, rola, ai: jeAi });
      expect((await volaj(zrejuca, "GET", "/sada", cookieZ(r))).status).toBe(200);
    }
  });

  it("účty sa v Zrejúcej nezakladajú ani nemenia heslo; známky hry len vo Vypálenej", async () => {
    expect((await volaj(zrejuca, "POST", "/registracia", "", { login: "novacik1", heslo: "tajneheslo", meno: "Nováčik" })).status).toBe(409);
    const ai = cookieZ(await prihlasenie(await ucetVoVypalenej("hrac", true), "tajneheslo"));
    expect((await volaj(zrejuca, "POST", "/profil/heslo", ai, { stare: "tajneheslo", nove: "inetajneheslo" })).status).toBe(409);
    expect((await volaj(zrejuca, "PUT", "/znamky", ai, { zabava: 7 })).status).toBe(409);
  });
});

describe("Zrejúca — prenos prihlásenia z Vypálenej (menu Správa)", () => {
  const odkaz = (cookie: string) => volaj(vypalena, "POST", "/zrejuca/odkaz", cookie);
  const prenes = (token: string) => fetch(`http://127.0.0.1:${zrejuca.port}/api/prihlasenie-z-vypalenej?token=${encodeURIComponent(token)}`, { redirect: "manual" });

  it("správca dostane jednorazový odkaz a Zrejúca ho prihlási bez hesla", async () => {
    const subadmin = await ucetVoVypalenej("subadmin");
    const cookieV = await prihlas(vypalena.port, subadmin, "tajneheslo");
    const r = await odkaz(cookieV);
    expect(r.status).toBe(200);
    const { url } = (await r.json()) as { url: string };
    const predpona = `${ZREJUCA_VEREJNA}/api/prihlasenie-z-vypalenej?token=`;
    expect(url.startsWith(predpona)).toBe(true);
    const token = decodeURIComponent(url.slice(predpona.length));

    const prvy = await prenes(token);
    expect(prvy.status).toBe(302);
    expect(prvy.headers.get("location")).toBe("/");
    const sessia = cookieZ(prvy);
    expect(sessia).not.toBe("");
    const ja = (await (await volaj(zrejuca, "GET", "/ja", sessia)).json()) as { pouzivatel: { login: string; rola: string } };
    expect(ja.pouzivatel).toMatchObject({ login: subadmin, rola: "subadmin" });

    // Jednorazový: druhý pokus už neprihlási.
    const druhy = await prenes(token);
    expect(druhy.status).toBe(302);
    expect(cookieZ(druhy)).toBe("");
    expect(cookieZ(await prenes("vymysleny-token"))).toBe("");
  });

  it("hráč ani neprihlásený odkaz nedostanú", async () => {
    const hrac = await prihlas(vypalena.port, await ucetVoVypalenej("hrac"), "tajneheslo");
    expect((await odkaz(hrac)).status).toBe(403);
    expect((await odkaz("")).status).toBe(401);
    // Zrejúca odkaz nevydáva (tvorca aj účty sú vo Vypálenej).
    const adminZ = cookieZ(await prihlasenie(TEST_ADMIN.login, TEST_ADMIN.heslo));
    expect((await volaj(zrejuca, "POST", "/zrejuca/odkaz", adminZ)).status).toBe(404);
  });
});

describe("Zrejúca — rozpracovaná sada tvorcu Vypálenej", () => {
  it("Vypálená hrá zverejnenú, Zrejúca rozpracovanú; tvorca sa v Zrejúcej nemení", async () => {
    const adminV = await prihlas(vypalena.port, TEST_ADMIN.login, TEST_ADMIN.heslo);
    const adminZ = cookieZ(await prihlasenie(TEST_ADMIN.login, TEST_ADMIN.heslo));
    const { karty } = (await (await volaj(vypalena, "GET", "/admin/obsah", adminV)).json()) as { karty: { id: string; nazov: string }[] };
    const karta = karty[0];
    if (karta === undefined) throw new Error("Tvorca je prázdny.");
    const zverejneny = karta.nazov;
    // Návrh v tvorcovi Vypálenej, nezverejnený.
    expect((await volaj(vypalena, "PUT", `/admin/karty/${karta.id}`, adminV, { ...karta, nazov: "Rozpracovaná karta" })).status).toBe(200);

    const nazov = async (server: GameServer, cookie: string): Promise<string | undefined> =>
      ((await (await volaj(server, "GET", "/sada", cookie)).json()) as { karty: { id: string; nazov: string }[] }).karty.find((k) => k.id === karta.id)?.nazov;
    expect(await nazov(vypalena, "")).toBe(zverejneny);

    const prvy = (await (await volaj(zrejuca, "POST", "/admin/sada-z-vypalenej", adminZ)).json()) as { verzia: number; zmena: boolean };
    expect(prvy.zmena).toBe(true);
    expect(await nazov(zrejuca, adminZ)).toBe("Rozpracovaná karta");
    // Bez zmeny v tvorcovi nová verzia nevznikne.
    expect((await (await volaj(zrejuca, "POST", "/admin/sada-z-vypalenej", adminZ)).json()) as unknown).toEqual({ verzia: prvy.verzia, zmena: false });
    expect(await nazov(vypalena, "")).toBe(zverejneny);

    // Tvorca je jeden — vo Vypálenej.
    expect((await volaj(zrejuca, "PUT", `/admin/karty/${karta.id}`, adminZ, { ...karta, nazov: "Zo Zrejúcej" })).status).toBe(409);
    expect((await volaj(zrejuca, "POST", "/admin/zverejnit", adminZ, {})).status).toBe(409);
    expect((await volaj(vypalena, "POST", "/admin/sada-z-vypalenej", adminV)).status).toBe(404);
  });

  it("ilustrácie z tvorcu Vypálenej Zrejúca podá zo svojej adresy", async () => {
    const { karty } = (await (await volaj(vypalena, "GET", "/sada")).json()) as { karty: { obrazok: { plny: string } | null }[] };
    const id = karty.find((k) => k.obrazok !== null)?.obrazok?.plny;
    if (id === undefined) throw new Error("Sada nemá ilustráciu.");
    const r = await fetch(`http://127.0.0.1:${zrejuca.port}/media/${id}`);
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("image/jpeg");
    expect((await fetch(`http://127.0.0.1:${zrejuca.port}/media/${"0".repeat(40)}`)).status).toBe(404);
  });
});

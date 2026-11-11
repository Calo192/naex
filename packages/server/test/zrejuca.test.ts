// Vypálená a Zrejúca (Michal 2026-11-02): dve inštancie toho istého servera na jednej adrese.
// Relácia (cookie) je jedna — z Vypálenej; Zrejúca ju overí u Vypálenej a pustí len toho,
// kto má oprávnenie hrat_zrejucu (predvolene Sedmička, správcovia a AI; výnimky dáva admin).
// Prepínač inštancie je cookie naex_instancia, podľa ktorej smeruje Caddy. Vypálená hrá
// zverejnenú sadu, Zrejúca rozpracovaný stav tvorcu Vypálenej. Tvorca, účty a známky hry
// sú len vo Vypálenej.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { GameServer } from "../src/server.ts";
import { LEN_PRE_TESTEROV, Vypalena } from "../src/zrejuca.ts";
import { Klient, TEST_ADMIN, nastavUroven, prihlas, registruj, testovaciServer } from "./pomocnik.ts";

let vypalena: GameServer;
let zrejuca: GameServer;
const upratanie: (() => Promise<void>)[] = [];

beforeAll(async () => {
  const v = await testovaciServer(TEST_ADMIN, { zrejucaAdresa: "/" });
  vypalena = v.server;
  upratanie.push(v.zmaz);
  const z = await testovaciServer(TEST_ADMIN, {
    // relaciaMs 0: zmena oprávnenia sa v teste prejaví hneď.
    zrejuca: { vypalena: new Vypalena(`http://127.0.0.1:${vypalena.port}`, null, TEST_ADMIN), synchronizaciaMs: 0, relaciaMs: 0 },
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
const ja = async (server: GameServer, cookie: string) =>
  (await (await volaj(server, "GET", "/ja", cookie)).json()) as {
    pouzivatel: { id: number; login: string; rola: string; ai: boolean; prava: string[]; zrejuca: boolean | null } | null;
    instancia: { nazov: string; bezPrava?: boolean };
  };

/** Účet vo Vypálenej s danou úrovňou a značkou AI; vráti login a cookie relácie (heslo „tajneheslo“). */
async function ucetVoVypalenej(rola: string, ai = false): Promise<{ login: string; cookie: string; id: number }> {
  const admin = await prihlas(vypalena.port, TEST_ADMIN.login, TEST_ADMIN.heslo);
  const { cookie, login } = await registruj(vypalena.port);
  if (rola !== "navstevnik") await nastavUroven(vypalena.port, admin, cookie, rola);
  const id = (await ja(vypalena, cookie)).pouzivatel?.id ?? -1;
  if (ai) expect((await volaj(vypalena, "PATCH", `/admin/pouzivatelia/${id}`, admin, { ai: true })).status).toBe(200);
  return { login, cookie, id };
}

describe("Zrejúca — oprávnenie hrat_zrejucu", () => {
  it("neprihlásený vidí len, kde je; dáta nie", async () => {
    const odpoved = await ja(zrejuca, "");
    expect(odpoved.pouzivatel).toBeNull();
    expect(odpoved.instancia).toEqual({ nazov: "zrejuca", vypalena: null, zrejuca: null, bezPrava: false, rezimyNavyse: true, jazyky: true });
    expect((await volaj(zrejuca, "GET", "/sada")).status).toBe(401);
    expect((await volaj(zrejuca, "GET", "/hry/otvorene")).status).toBe(401);
    // Vypálená je verejná a ponúka prepnutie (adresa "/" = Caddy smeruje podľa cookie).
    expect((await ja(vypalena, "")).instancia).toEqual({ nazov: "vypalena", vypalena: null, zrejuca: "/" });
    expect((await volaj(vypalena, "GET", "/sada")).status).toBe(200);
  });

  it("predvolene: Sedmička, subadmin, admin a AI áno; Nealko, Poldeci a Deci nie — tou istou reláciou ako vo Vypálenej", async () => {
    const admin = await prihlas(vypalena.port, TEST_ADMIN.login, TEST_ADMIN.heslo);
    const smie = [admin, (await ucetVoVypalenej("sedmicka")).cookie, (await ucetVoVypalenej("subadmin")).cookie, (await ucetVoVypalenej("hrac", true)).cookie];
    const nesmie = [(await ucetVoVypalenej("navstevnik")).cookie, (await ucetVoVypalenej("hrac")).cookie, (await ucetVoVypalenej("deci")).cookie];
    for (const cookie of smie) {
      expect((await ja(vypalena, cookie)).pouzivatel?.prava).toContain("hrat_zrejucu");
      expect((await ja(zrejuca, cookie)).pouzivatel).not.toBeNull();
      expect((await volaj(zrejuca, "GET", "/sada", cookie)).status).toBe(200);
    }
    for (const cookie of nesmie) {
      expect((await ja(vypalena, cookie)).pouzivatel?.prava).not.toContain("hrat_zrejucu");
      const z = await ja(zrejuca, cookie);
      expect(z.pouzivatel).toBeNull();
      expect(z.instancia.bezPrava).toBe(true);
      const sada = await volaj(zrejuca, "GET", "/sada", cookie);
      expect(sada.status).toBe(403);
      expect(((await sada.json()) as { chyba: string }).chyba).toBe(LEN_PRE_TESTEROV);
    }
  });

  it("admin udelí a odoberie výnimku konkrétnemu účtu; subadmin nie", async () => {
    const admin = await prihlas(vypalena.port, TEST_ADMIN.login, TEST_ADMIN.heslo);
    const sub = (await ucetVoVypalenej("subadmin")).cookie;
    const deci = await ucetVoVypalenej("deci");
    const sedmicka = await ucetVoVypalenej("sedmicka");
    const vynimka = (kto: string, id: number, zrejucaHodnota: boolean | null) =>
      volaj(vypalena, "PATCH", `/admin/pouzivatelia/${id}`, kto, { zrejuca: zrejucaHodnota });

    expect((await vynimka(sub, deci.id, true)).status).toBe(403);
    expect((await vynimka(admin, deci.id, true)).status).toBe(200);
    expect((await ja(zrejuca, deci.cookie)).pouzivatel?.login).toBe(deci.login);
    expect((await vynimka(admin, sedmicka.id, false)).status).toBe(200);
    expect((await ja(zrejuca, sedmicka.cookie)).pouzivatel).toBeNull();
    expect((await ja(vypalena, sedmicka.cookie)).pouzivatel?.zrejuca).toBe(false);
    // Späť podľa ranku.
    expect((await vynimka(admin, sedmicka.id, null)).status).toBe(200);
    expect((await ja(zrejuca, sedmicka.cookie)).pouzivatel).not.toBeNull();
    expect((await vynimka(admin, deci.id, "ano" as unknown as boolean)).status).toBe(400);
  });

  it("prepínač inštancie: do Zrejúcej len s oprávnením, späť každý", async () => {
    const hrac = (await ucetVoVypalenej("hrac")).cookie;
    const sedmicka = (await ucetVoVypalenej("sedmicka")).cookie;
    expect((await volaj(vypalena, "POST", "/instancia", hrac, { nazov: "zrejuca" })).status).toBe(403);
    expect((await volaj(vypalena, "POST", "/instancia", "", { nazov: "zrejuca" })).status).toBe(401);
    const tam = await volaj(vypalena, "POST", "/instancia", sedmicka, { nazov: "zrejuca" });
    expect(tam.status).toBe(200);
    expect(await tam.json()).toEqual({ kam: "/hra" });
    expect(tam.headers.get("set-cookie")).toMatch(/^naex_instancia=zrejuca; Path=\/; HttpOnly/);
    const spat = await volaj(zrejuca, "POST", "/instancia", "", { nazov: "vypalena" });
    expect(spat.status).toBe(200);
    expect(spat.headers.get("set-cookie")).toMatch(/^naex_instancia=; .*Max-Age=0/);
  });

  it("prihlásenie v Zrejúcej robí Vypálená: relácia platí v oboch, bez oprávnenia 403", async () => {
    const ai = await ucetVoVypalenej("hrac", true);
    const r = await prihlasenie(ai.login, "tajneheslo");
    expect(r.status).toBe(200);
    const cookie = cookieZ(r);
    expect(cookie).toMatch(/^naex_sid=/);
    expect((await ja(vypalena, cookie)).pouzivatel?.login).toBe(ai.login);
    expect((await ja(zrejuca, cookie)).pouzivatel?.login).toBe(ai.login);

    const hrac = await ucetVoVypalenej("hrac");
    const odmietnuty = await prihlasenie(hrac.login, "tajneheslo");
    expect(odmietnuty.status).toBe(403);
    expect((await prihlasenie(hrac.login, "zleheslo1")).status).toBe(401);

    const odhlasenie = await volaj(zrejuca, "POST", "/odhlasenie", cookie);
    expect(odhlasenie.status).toBe(200);
    expect((await ja(vypalena, cookie)).pouzivatel).toBeNull();
  });

  it("stôl Zrejúcej: oprávnený založí partiu, bez oprávnenia sa nepripojí", async () => {
    const ai = await ucetVoVypalenej("hrac", true);
    const k = new Klient(zrejuca.port, ai.cookie);
    await k.otvorene();
    k.posli({ type: "create", bot: true });
    expect((await k.cakaj("privitanie")).code).toEqual(expect.any(String));
    k.zavri();

    const hrac = await ucetVoVypalenej("hrac");
    const cudzi = new Klient(zrejuca.port, hrac.cookie);
    await cudzi.otvorene();
    expect((await cudzi.cakaj("error")).text).toBe("Na hranie sa musíš prihlásiť.");
  });

  it("účty sa v Zrejúcej nezakladajú ani nemenia heslo; známky hry len vo Vypálenej", async () => {
    expect((await volaj(zrejuca, "POST", "/registracia", "", { login: "novacik1", heslo: "tajneheslo", meno: "Nováčik" })).status).toBe(409);
    const ai = (await ucetVoVypalenej("hrac", true)).cookie;
    expect((await volaj(zrejuca, "POST", "/profil/heslo", ai, { stare: "tajneheslo", nove: "inetajneheslo" })).status).toBe(409);
    expect((await volaj(zrejuca, "PUT", "/znamky", ai, { zabava: 7 })).status).toBe(409);
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

describe("Zrejúca bez zmien sa hráčom neponúka (Michal 2026-11-02)", () => {
  const VERZIA = { commit: "a1b2c3d", vetva: "master", necommitnute: false, nahrate: "2026-11-02T12:00:00Z" };
  let v2: GameServer;
  let z2: GameServer;
  let adresaZrejucej = "";
  const zmazat: (() => Promise<void>)[] = [];

  beforeAll(async () => {
    // Bez režimov navyše: tu sa skúša porovnanie kódu a tvorcu, režimy má vlastný test nižšie.
    const v = await testovaciServer(TEST_ADMIN, { zrejucaAdresa: "/", verzia: VERZIA, zrejucaUrl: () => adresaZrejucej, rezimyLenVZrejucej: [] });
    v2 = v.server;
    zmazat.push(v.zmaz);
    const z = await testovaciServer(TEST_ADMIN, {
      verzia: VERZIA,
      zrejuca: { vypalena: new Vypalena(`http://127.0.0.1:${v2.port}`, null, TEST_ADMIN), synchronizaciaMs: 0, relaciaMs: 0 },
    });
    z2 = z.server;
    zmazat.unshift(z.zmaz);
    adresaZrejucej = `http://127.0.0.1:${z2.port}`;
  });
  afterAll(async () => {
    for (const f of zmazat) await f();
  });

  it("ten istý commit a nič nezverejnené = bez zmien; zmena v tvorcovi Zrejúcu znova ponúkne", async () => {
    const admin = await prihlas(v2.port, TEST_ADMIN.login, TEST_ADMIN.heslo);
    const stav = async () => (await (await volaj(v2, "GET", "/zrejuca/stav", admin)).json()) as Record<string, unknown>;
    expect(await stav()).toEqual({ dostupna: true, vypalena: VERZIA.commit, zrejuca: VERZIA.commit, kariet: 0, ineZmeny: false, rezimy: [], bezZmien: true });
    expect(await (await volaj(z2, "GET", "/verzia")).json()).toEqual({ verzia: VERZIA });

    const bez = await volaj(v2, "POST", "/instancia", admin, { nazov: "zrejuca" });
    expect(bez.status).toBe(200);
    expect(((await bez.json()) as { bezZmien?: boolean }).bezZmien).toBe(true);
    expect(bez.headers.get("set-cookie")).toBeNull();

    const { karty } = (await (await volaj(v2, "GET", "/admin/obsah", admin)).json()) as { karty: { id: string; nazov: string }[] };
    const karta = karty[0];
    if (karta === undefined) throw new Error("Tvorca je prázdny.");
    expect((await volaj(v2, "PUT", `/admin/karty/${karta.id}`, admin, { ...karta, nazov: "Nová v Zrejúcej" })).status).toBe(200);
    expect(await stav()).toMatchObject({ kariet: 1, bezZmien: false });
    const tam = await volaj(v2, "POST", "/instancia", admin, { nazov: "zrejuca" });
    expect(await tam.json()).toEqual({ kam: "/hra" });
    expect(tam.headers.get("set-cookie")).toMatch(/^naex_instancia=zrejuca/);
  });

  it("Zrejúca neodpovedá — prepnutie počká (503), stav to povie", async () => {
    const admin = await prihlas(v2.port, TEST_ADMIN.login, TEST_ADMIN.heslo);
    const predtym = adresaZrejucej;
    adresaZrejucej = "http://127.0.0.1:9";
    try {
      expect((await volaj(v2, "POST", "/instancia", admin, { nazov: "zrejuca" })).status).toBe(503);
      expect(((await (await volaj(v2, "GET", "/zrejuca/stav", admin)).json()) as { dostupna: boolean }).dostupna).toBe(false);
    } finally {
      adresaZrejucej = predtym;
    }
    const hrac = (await registruj(v2.port)).cookie;
    expect((await volaj(v2, "GET", "/zrejuca/stav", hrac)).status).toBe(403);
  });
});

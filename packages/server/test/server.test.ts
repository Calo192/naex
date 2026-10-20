// M7 — integračný test servera: miestnosti, autorizácia, filtrovanie,
// reconnect (M9). Dva ws klienty proti skutočnému serveru na náhodnom porte.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { GameServer } from "../src/server.ts";
import { Klient, prihlas, registruj, testovaciServer } from "./pomocnik.ts";

let server: GameServer;
let zmaz: () => Promise<void>;
let hracA: string;
let hracB: string;
let hracC: string;

beforeAll(async () => {
  ({ server, zmaz } = await testovaciServer());
  hracA = (await registruj(server.port)).cookie;
  hracB = (await registruj(server.port)).cookie;
  hracC = (await registruj(server.port)).cookie;
});

afterAll(async () => {
  await zmaz();
});

describe("M7 — server", () => {
  it("miestnosť, štart hry, autorizácia a filtrovaný pohľad", async () => {
    const a = new Klient(server.port, hracA);
    await a.otvorene();
    a.posli({ type: "create" });
    const privitanieA = await a.cakaj("privitanie");
    expect(privitanieA.seat).toBe(0);
    const kod = privitanieA.code as string;
    expect(kod).toMatch(/^[A-Z2-9]{4}$/);

    const b = new Klient(server.port, hracB);
    await b.otvorene();
    b.posli({ type: "join", code: kod });
    const privitanieB = await b.cakaj("privitanie");
    expect(privitanieB.seat).toBe(1);

    // A dostane oznam o pripojení súpera hneď pri jeho príchode — zožerieme
    // ho, aby neskoršie čakania čítali čerstvé správy.
    const prvePripojenie = await a.cakaj("superPripojeny");
    expect(prvePripojenie.connected).toBe(true);

    // Obaja dostanú stav; pohľad neobsahuje polia s obsahom balíčkov.
    const stavA = await a.cakaj("state");
    const stavB = await b.cakaj("state");
    const viewA = stavA.view as { ja: number; naTahu: number; lokalityVHre: { uid: number }[] };
    const viewB = stavB.view as { ja: number; naTahu: number };
    expect(viewA.ja).toBe(0);
    expect(viewB.ja).toBe(1);
    const jsonA = JSON.stringify(stavA);
    // Ruka súpera a doberacie balíčky sa posielajú len ako počty.
    expect(jsonA).not.toContain('"doberaci":[');
    expect(jsonA).toContain('"doberaciPocet"');
    expect(jsonA).toContain('"rukaPocet"');

    // Hráč mimo poradia dostane chybu; stav sa nezmení.
    const naTahu = viewA.naTahu;
    const mimoPoradia = naTahu === 0 ? b : a;
    const naRade = naTahu === 0 ? a : b;
    mimoPoradia.posli({ type: "cmd", cmd: { type: "pass" } });
    const chyba = await mimoPoradia.cakaj("error");
    expect(String(chyba.text)).toContain("Nie si na ťahu");

    // Legálny príkaz útočníka posunie hru do draftu obom hráčom.
    const lokalita = viewA.lokalityVHre[0];
    expect(lokalita).toBeDefined();
    naRade.posli({
      type: "cmd",
      cmd: { type: "chooseLocation", uid: lokalita?.uid, otocena: false },
    });
    const novyA = await a.cakaj("state");
    const novyB = await b.cakaj("state");
    expect((novyA.view as { faza: string }).faza).toBe("draft");
    expect((novyB.view as { faza: string }).faza).toBe("draft");

    // Tretí hráč sa nedostane dnu.
    const c = new Klient(server.port, hracC);
    await c.otvorene();
    c.posli({ type: "join", code: kod });
    const plna = await c.cakaj("error");
    expect(String(plna.text)).toContain("plná");
    c.zavri();

    // Hráči sa vidia navzájom (meno + avatar).
    const hraci = (await b.cakaj("hraci")).hraci as ({ meno: string } | null)[];
    expect(hraci.every((h) => h !== null && h.meno.startsWith("Hráč"))).toBe(true);

    // M9: výpadok a návrat — miesto sa viaže na prihláseného hráča.
    b.zavri();
    const odpojeny = await a.cakaj("superPripojeny");
    expect(odpojeny.connected).toBe(false);

    const b2 = new Klient(server.port, hracB);
    await b2.otvorene();
    b2.posli({ type: "rejoin", code: kod });
    const spat = await b2.cakaj("privitanie");
    expect(spat.seat).toBe(1);
    expect(spat.started).toBe(true);
    const stavPoNavrate = await b2.cakaj("state");
    expect((stavPoNavrate.view as { faza: string }).faza).toBe("draft");
    const pripojeny = await a.cakaj("superPripojeny");
    expect(pripojeny.connected).toBe(true);

    // M9: druhý tab toho istého hráča preberá pripojenie.
    const b3 = new Klient(server.port, hracB);
    await b3.otvorene();
    b3.posli({ type: "rejoin", code: kod });
    await b3.cakaj("privitanie");
    const prebrate = await b2.cakaj("error");
    expect(String(prebrate.text)).toContain("prevzal");

    a.zavri();
    b3.zavri();
  });

  it("neexistujúci kód, cudzia miestnosť a neprihlásený hráč", async () => {
    const klient = new Klient(server.port, hracA);
    await klient.otvorene();
    klient.posli({ type: "join", code: "XXXX" });
    const chyba = await klient.cakaj("error");
    expect(String(chyba.text)).toContain("neexistuje");

    klient.posli({ type: "create" });
    const privitanie = await klient.cakaj("privitanie");
    const zly = new Klient(server.port, hracC);
    await zly.otvorene();
    zly.posli({ type: "rejoin", code: privitanie.code });
    const zlaOdpoved = await zly.cakaj("error");
    expect(String(zlaOdpoved.text)).toContain("nehráš");

    const anonym = new Klient(server.port, "");
    const odmietnutie = await anonym.cakaj("error");
    expect(String(odmietnutie.text)).toContain("prihlásiť");

    klient.zavri();
    zly.zavri();
  });
});

describe("M12 — účty, profil a admin API", () => {
  const api = async (cesta: string, init: RequestInit & { cookie?: string } = {}) => {
    const res = await fetch(`http://127.0.0.1:${server.port}/api${cesta}`, {
      ...init,
      headers: {
        "x-naex": "1",
        ...(init.body !== undefined && typeof init.body === "string" ? { "content-type": "application/json" } : {}),
        ...(init.cookie !== undefined ? { cookie: init.cookie } : {}),
        ...(init.headers as Record<string, string> | undefined),
      },
    });
    return { status: res.status, telo: (await res.json().catch(() => null)) as Record<string, unknown> | null, res };
  };

  it("registrácia, prihlásenie, profil a avatar", async () => {
    const { cookie, login } = await registruj(server.port);
    const ja = await api("/ja", { cookie });
    expect((ja.telo?.pouzivatel as { login: string }).login).toBe(login);
    expect((ja.telo?.pouzivatel as { rola: string }).rola).toBe("navstevnik");

    const zle = await api("/prihlasenie", { method: "POST", body: JSON.stringify({ login, heslo: "zle-heslo" }) });
    expect(zle.status).toBe(401);
    const dobre = await api("/prihlasenie", { method: "POST", body: JSON.stringify({ login, heslo: "tajneheslo" }) });
    expect(dobre.status).toBe(200);

    const zmena = await api("/profil", { method: "PATCH", cookie, body: JSON.stringify({ meno: "Fero z dediny" }) });
    expect((zmena.telo?.pouzivatel as { meno: string }).meno).toBe("Fero z dediny");

    // 1×1 PNG
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
    const avatar = await api("/profil/avatar", { method: "PUT", cookie, body: png, headers: { "content-type": "image/png" } });
    const id = (avatar.telo?.pouzivatel as { avatar: string }).avatar;
    expect(id).toMatch(/^[0-9a-f]{40}$/);
    const obr = await fetch(`http://127.0.0.1:${server.port}/media/${id}`);
    expect(obr.headers.get("content-type")).toBe("image/png");

    const text = await api("/profil/avatar", { method: "PUT", cookie, body: "<html>", headers: { "content-type": "image/png" } });
    expect(text.status).toBe(415);
  });

  it("bez hlavičky X-Naex sa nič nezmení (CSRF)", async () => {
    const res = await fetch(`http://127.0.0.1:${server.port}/api/registracia`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ login: "csrf_test", heslo: "tajneheslo", meno: "Csrf" }),
    });
    expect(res.status).toBe(403);
  });

  it("bežný hráč nevidí admin API, verejná sada je dostupná", async () => {
    const { cookie } = await registruj(server.port);
    expect((await api("/admin/obsah", { cookie })).status).toBe(403);
    expect((await api("/admin/obsah")).status).toBe(401);
    const sada = await api("/sada");
    expect((sada.telo?.karty as unknown[]).length).toBe(60);
    expect(sada.telo?.verzia).toBe(1);
    // Scorecardy z KartyAI sú v sade od prvého spustenia, ikony s významom v hre.
    expect((sada.telo?.bodovacie as unknown[]).length).toBe(8);
    expect((sada.telo?.ikonyBodovania as { podmienka: string }[]).every((i) => i.podmienka !== null)).toBe(true);
    expect(((sada.telo?.scorecardsJson as { scorecards: unknown[] }).scorecards).length).toBe(8);
  });
});

describe("M12 — admin: úprava karty a zverejnenie", () => {
  it("admin z konfigurácie upraví kartu, zverejní a nová hra beží na novej sade", async () => {
    const { server: s2, zmaz: z2 } = await testovaciServer({ login: "Sef", heslo: "sefovo-testovacie" });
    try {
      const cookie = await prihlas(s2.port, "Sef", "sefovo-testovacie");
      const api = (cesta: string, init: RequestInit = {}) =>
        fetch(`http://127.0.0.1:${s2.port}/api${cesta}`, {
          ...init,
          headers: { "x-naex": "1", "content-type": "application/json", cookie },
        });
      const obsah = (await (await api("/admin/obsah")).json()) as { karty: { id: string; efekt: string }[] };
      const pijan = obsah.karty.find((k) => k.id === "pijan");
      expect(pijan).toBeDefined();
      const upravena = { ...pijan, efekt: "Furt: Testovací text." };
      expect((await api("/admin/karty/pijan", { method: "PUT", body: JSON.stringify(upravena) })).status).toBe(200);

      // Vlastná akcia bez pravidiel v hre zverejnenie zablokuje.
      await api("/admin/akcie/vlastna_test", { method: "PUT", body: JSON.stringify({ nazov: "Test", popis: "" }) });
      const zla = { ...upravena, prava: { blokovane: [], akcie: { vlastna_test: 1 }, povolene: {} } };
      await api("/admin/karty/pijan", { method: "PUT", body: JSON.stringify(zla) });
      const odmietnute = await api("/admin/zverejnit", { method: "POST" });
      expect(odmietnute.status).toBe(422);
      expect(((await odmietnute.json()) as { chyba: string }).chyba).toContain("nemá v hre pravidlá");

      await api("/admin/karty/pijan", { method: "PUT", body: JSON.stringify(upravena) });
      const zverejnene = await api("/admin/zverejnit", { method: "POST" });
      expect(((await zverejnene.json()) as { verzia: number }).verzia).toBe(2);
      const sada = (await (await fetch(`http://127.0.0.1:${s2.port}/api/sada`)).json()) as {
        karty: { id: string; efekt: string }[];
      };
      expect(sada.karty.find((k) => k.id === "pijan")?.efekt).toBe("Furt: Testovací text.");

      // Návrat na v1: zverejní sa znova ako v3; s návrhmi sa vráti aj návrh karty.
      const navrat = (await (await api("/admin/sady/1/obnovit", { method: "POST", body: JSON.stringify({ navrhy: true }) })).json()) as { verzia: number };
      expect(navrat.verzia).toBe(3);
      const po = (await (await fetch(`http://127.0.0.1:${s2.port}/api/sada`)).json()) as { verzia: number; karty: { id: string; efekt: string }[] };
      expect(po.verzia).toBe(3);
      expect(po.karty.find((k) => k.id === "pijan")?.efekt).toBe(pijan?.efekt);
      const navrhy = (await (await api("/admin/obsah")).json()) as { karty: { id: string; efekt: string }[] };
      expect(navrhy.karty.find((k) => k.id === "pijan")?.efekt).toBe(pijan?.efekt);
      expect((await api("/admin/sady/99/obnovit", { method: "POST", body: "{}" })).status).toBe(404);

      const exportRes = await api("/admin/export");
      expect(await exportRes.text()).toContain("CARD 1:");
    } finally {
      await z2();
    }
  });
});

// Výučba „Prvá hra“ na serveri (Michal 2026-10-23): naskriptovaná partia proti
// Štamgastovi — server pustí len príkaz kroku, bot hrá podľa skriptu, postup sa
// ukladá k účtu a dohratie spraví z návštevníka hráča bez archívu a štatistík.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Command } from "@naex/core";
import type { GameServer } from "../src/server.ts";
import type { Msg } from "./pomocnik.ts";
import { Klient, TEST_ADMIN, registruj, testovaciServer } from "./pomocnik.ts";

let server: GameServer;
let zmaz: () => Promise<void>;

beforeAll(async () => {
  ({ server, zmaz } = await testovaciServer(TEST_ADMIN, { botPauzaMs: 0 }));
});

afterAll(async () => {
  await zmaz();
});

interface KrokMsg {
  index: number;
  spolu: number;
  kto: "hrac" | "bot" | "info";
  melichar: string;
  zvyraznit: string[];
  ocakava: Command | null;
}

const api = async <T>(cookie: string, metoda: string, cesta: string): Promise<T> =>
  (await (await fetch(`http://127.0.0.1:${server.port}/api${cesta}`, { method: metoda, headers: { cookie, "x-naex": "1" } })).json()) as T;

async function zacni(cookie: string): Promise<{ k: Klient; prvy: Msg }> {
  const k = new Klient(server.port, cookie);
  await k.otvorene();
  k.posli({ type: "create", vyucba: true });
  return { k, prvy: await k.cakaj("vyucba") };
}

/** Odohrá kroky výučby, kým nie je hotová alebo kým neprejde `max` krokov. */
async function hraj(k: Klient, msg: Msg, max = Number.POSITIVE_INFINITY): Promise<Msg> {
  for (let n = 0; n < max && msg.hotovo !== true; n++) {
    const krok = msg.krok as KrokMsg;
    if (krok.kto === "info") k.posli({ type: "vyucbaDalej" });
    else if (krok.kto === "hrac") k.posli({ type: "cmd", cmd: krok.ocakava });
    msg = await k.cakaj("vyucba");
  }
  return msg;
}

describe("výučba „Prvá hra“", () => {
  it("návštevník ju dostane ponúknutú, prejde celý scenár a je z neho hráč — bez archívu", async () => {
    const { cookie } = await registruj(server.port);
    const ja = await api<{ pouzivatel: { id: number; rola: string } }>(cookie, "GET", "/ja");
    expect(ja.pouzivatel.rola).toBe("navstevnik");
    expect(await api(cookie, "GET", "/vyucba")).toMatchObject({ krok: 0, stav: null, ponuknut: true });

    const { k, prvy } = await zacni(cookie);
    const krok = prvy.krok as KrokMsg;
    expect(krok).toMatchObject({ index: 0, kto: "info" });
    expect(krok.melichar.length).toBeGreaterThan(0);

    const koniec = await hraj(k, prvy);
    expect(koniec).toMatchObject({ hotovo: true, krok: null });
    k.zavri();

    expect((await api<{ pouzivatel: { rola: string } }>(cookie, "GET", "/ja")).pouzivatel.rola).toBe("hrac");
    expect(await api(cookie, "GET", "/vyucba")).toMatchObject({ stav: "hotova", ponuknut: false });
    const partie = await api<{ pocet: number }>(cookie, "GET", `/hraci/${ja.pouzivatel.id}/partie`);
    expect(partie.pocet).toBe(0);
  });

  it("server pustí len príkaz, ktorý krok dovoľuje; „ďalej“ len pri texte", async () => {
    const { cookie } = await registruj(server.port);
    const { k, prvy } = await zacni(cookie);
    // Krok 0 je text — príkaz neprejde.
    k.posli({ type: "cmd", cmd: { type: "pass" } });
    expect(String((await k.cakaj("error")).text)).toMatch(/Melichar/);
    k.posli({ type: "vyucbaDalej" });
    const druhy = await k.cakaj("vyucba");
    expect((druhy.krok as KrokMsg).kto).toBe("hrac");
    // Iný ťah než ten dovolený server odmietne a krok zopakuje.
    k.posli({ type: "cmd", cmd: { type: "pass" } });
    expect(String((await k.cakaj("error")).text)).toMatch(/Vo výučbe teraz urob toto/);
    expect((await k.cakaj("vyucba")).krok).toMatchObject({ index: 1 });
    k.posli({ type: "vyucbaDalej" });
    expect(String((await k.cakaj("error")).text)).toMatch(/Teraz nie je čo potvrdiť/);
    k.zavri();
  });

  it("postup sa ukladá — po odchode výučba pokračuje od toho istého kroku; preskočiť a znova", async () => {
    const { cookie } = await registruj(server.port);
    const { k, prvy } = await zacni(cookie);
    const po = await hraj(k, prvy, 3);
    const index = (po.krok as KrokMsg).index;
    expect(index).toBeGreaterThanOrEqual(3);
    k.zavri();
    await new Promise((r) => setTimeout(r, 50));
    // Bot mohol medzitým dohrať svoje kroky — uložené je aspoň to, čo hráč prešiel.
    const ulozene = await api<{ krok: number }>(cookie, "GET", "/vyucba");
    expect(ulozene.krok).toBeGreaterThanOrEqual(index);

    const znova = await zacni(cookie);
    expect((znova.prvy.krok as KrokMsg).index).toBe(ulozene.krok);
    znova.k.zavri();

    await api(cookie, "POST", "/vyucba/preskocit");
    expect(await api(cookie, "GET", "/vyucba")).toMatchObject({ stav: "preskocena", ponuknut: false });
    await api(cookie, "POST", "/vyucba/znova");
    expect(await api(cookie, "GET", "/vyucba")).toMatchObject({ krok: 0, stav: null });
  });
});

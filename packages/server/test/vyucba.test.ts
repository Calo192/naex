// Výučba „Prvá hra“ na serveri (Michal 2026-10-23): naskriptovaná partia proti
// Štamgastovi — server pustí len príkaz kroku, bot hrá podľa skriptu, postup sa
// ukladá k účtu a dohratie spraví z návštevníka hráča bez archívu a štatistík.

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Command } from "@naex/core";
import type { GameServer } from "../src/server.ts";
import { nacitajVyucbu } from "../src/server.ts";
import type { Msg } from "./pomocnik.ts";
import { Klient, TEST_ADMIN, prihlas, registruj, testovaciServer } from "./pomocnik.ts";

// Testy prechádzajú celú výučbu cez WebSocket (niektoré s vlastným serverom) — pri súbežnom
// behu celej sady 5 s nestačí.
vi.setConfig({ testTimeout: 60_000 });

let server: GameServer;
let zmaz: () => Promise<void>;

beforeAll(async () => {
  ({ server, zmaz } = await testovaciServer(TEST_ADMIN, { botPauzaMs: 0, vyucbaZapnuta: true }));
});

afterAll(async () => {
  await zmaz();
});

interface KrokMsg {
  index: number;
  spolu: number;
  kto: "hrac" | "bot" | "info" | "auto" | "otazka";
  vykonany?: boolean;
  melichar: string;
  zvyraznit: string[];
  ocakava: Command | null;
  moznosti?: { text: string; spravna: boolean; vysvetlenie: string }[] | null;
}

const api = async <T>(cookie: string, metoda: string, cesta: string): Promise<T> =>
  (await (await fetch(`http://127.0.0.1:${server.port}/api${cesta}`, { method: metoda, headers: { cookie, "x-naex": "1" } })).json()) as T;

async function zacni(cookie: string): Promise<{ k: Klient; prvy: Msg }> {
  const k = new Klient(server.port, cookie);
  await k.otvorene();
  k.posli({ type: "create", vyucba: true });
  return { k, prvy: await k.cakaj("vyucba") };
}

/** Krok bez ťahu hráča: pri otázke správna odpoveď (zapíše sa ako prvá), potom „ďalej“ — aj po vykonanom ťahu bota s textom. */
function potvrd(k: Klient, krok: KrokMsg): void {
  if (krok.kto === "otazka") k.posli({ type: "vyucbaOdpoved", index: (krok.moznosti ?? []).findIndex((m) => m.spravna) });
  // Vykonaný ťah bota či auto krok s textom čaká na „ďalej“ (U5).
  if (krok.kto === "info" || krok.kto === "otazka" || krok.vykonany === true) k.posli({ type: "vyucbaDalej" });
}

/** Odohrá kroky výučby, kým nie je hotová alebo kým neprejde `max` krokov. */
async function hraj(k: Klient, msg: Msg, max = Number.POSITIVE_INFINITY): Promise<Msg> {
  for (let n = 0; n < max && msg.hotovo !== true; n++) {
    const krok = msg.krok as KrokMsg;
    if (krok.kto === "hrac") k.posli({ type: "cmd", cmd: krok.ocakava });
    else potvrd(k, krok);
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
    expect((prvy.krok as KrokMsg).kto).toBe("info");
    k.posli({ type: "cmd", cmd: { type: "pass" } });
    expect(String((await k.cakaj("error")).text)).toMatch(/Melichar/);
    // Texty pred prvým ťahom hráča preklikne „ďalej“.
    let msg = prvy;
    while ((msg.krok as KrokMsg).kto === "info") {
      k.posli({ type: "vyucbaDalej" });
      msg = await k.cakaj("vyucba");
    }
    const tah = msg.krok as KrokMsg;
    expect(tah.kto).toBe("hrac");
    // Iný ťah než ten dovolený server odmietne a krok zopakuje.
    // Hráč sa dozvie, čo chýba a čo je navyše — aj v tvare pre UI (playtest výučby, návrh 1).
    k.posli({ type: "cmd", cmd: { type: "pass" } });
    expect(String((await k.cakaj("error")).text)).toMatch(/^Takto nie — .*toto teraz nie: pasuj/);
    const chyba = await k.cakaj("vyucbaChyba");
    expect(chyba.navyse).toEqual([{ typ: "pass", popis: "pasuj", uid: null }]);
    expect((chyba.chybajuce as unknown[]).length).toBeGreaterThan(0);
    expect((await k.cakaj("vyucba")).krok).toMatchObject({ index: tah.index });
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

describe("výučba — vypínač", () => {
  it("zverejnený scenár prva-hra.json dostane každý nový hráč ponúknutý (Michal 2026-10-25)", async () => {
    expect(nacitajVyucbu().zverejnena).toBe(true);
    const { server: s, zmaz: z } = await testovaciServer(TEST_ADMIN, { botPauzaMs: 0 });
    try {
      const { cookie } = await registruj(s.port);
      const r = await fetch(`http://127.0.0.1:${s.port}/api/vyucba`, { headers: { cookie } });
      expect(await r.json()).toMatchObject({ dostupna: true, ponuknut: true });
    } finally {
      await z();
    }
  });

  it("kým nie je zverejnená, hráč ju nedostane ponúknutú ani nespustí; správca áno", async () => {
    const { server: s, zmaz: z } = await testovaciServer(TEST_ADMIN, { botPauzaMs: 0, scenarVyucby: { ...nacitajVyucbu(), zverejnena: false } });
    try {
      const { cookie } = await registruj(s.port);
      const ziadaj = async (c: string) => (await (await fetch(`http://127.0.0.1:${s.port}/api/vyucba`, { headers: { cookie: c } })).json()) as { dostupna: boolean; ponuknut: boolean };
      expect(await ziadaj(cookie)).toMatchObject({ dostupna: false, ponuknut: false });
      const k = new Klient(s.port, cookie);
      await k.otvorene();
      k.posli({ type: "create", vyucba: true });
      expect(String((await k.cakaj("error")).text)).toMatch(/ešte nie je hotová/);
      k.zavri();

      const admin = await prihlas(s.port, TEST_ADMIN.login, TEST_ADMIN.heslo);
      expect(await ziadaj(admin)).toMatchObject({ dostupna: true, ponuknut: false });
      const a = new Klient(s.port, admin);
      await a.otvorene();
      a.posli({ type: "create", vyucba: true });
      expect((await a.cakaj("vyucba")).krok).toMatchObject({ index: 0 });
      a.zavri();
    } finally {
      await z();
    }
  });
});

describe("výučba — automatické kroky hráča (kto: auto)", () => {
  it("auto krok spraví server za hráča ako ťah bota — výučba prejde len s „ďalej“", async () => {
    // Všetky ťahy hráča ako auto: hráč len číta a kliká „ďalej“.
    const zaklad = nacitajVyucbu();
    const scenar = { ...zaklad, kroky: zaklad.kroky.map((k) => (k.kto === "hrac" ? { ...k, kto: "auto" as const } : k)) };
    const { server: s, zmaz: zmazAuto } = await testovaciServer(TEST_ADMIN, { botPauzaMs: 0, vyucbaZapnuta: true, scenarVyucby: scenar });
    try {
      const { cookie } = await registruj(s.port);
      const k = new Klient(s.port, cookie);
      await k.otvorene();
      k.posli({ type: "create", vyucba: true });
      let msg = await k.cakaj("vyucba");
      const videne = new Set<string>();
      for (let n = 0; n < 500 && msg.hotovo !== true; n++) {
        const krok = msg.krok as KrokMsg;
        videne.add(krok.kto);
        // Auto krok čaká rovnako ako bot — nič neposielame; ocakava hráčovi nepríde.
        if (krok.kto === "auto") expect(krok.ocakava).toBeNull();
        potvrd(k, krok);
        msg = await k.cakaj("vyucba");
      }
      expect(msg.hotovo).toBe(true);
      expect(videne.has("auto")).toBe(true);
      expect(videne.has("hrac")).toBe(false);
      k.zavri();
    } finally {
      await zmazAuto();
    }
  });
});

describe("výučba — kontrolné otázky a rozhodnutia (UX N2)", () => {
  it("otázka: odpoveď sa zapíše len prvá, „ďalej“ ju posunie; rozhodnutie: zlý ťah dostane radu, nie chybu", async () => {
    const zaklad = nacitajVyucbu();
    const iHrac = zaklad.kroky.findIndex((k) => k.kto === "hrac");
    const kroky = zaklad.kroky.map((k, j) =>
      j === iHrac ? { ...k, volba: { kandidati: ["ruka:pijan"], zle: [{ prikaz: { type: "pass" as const }, text: "Ešte nepasuj." }], inak: "Skús inú kartu." } } : k,
    );
    const otazka = {
      id: "q-spoj",
      kto: "otazka" as const,
      melichar: "Čo dá spoj?",
      moznosti: [
        { text: "Ranu", spravna: false, vysvetlenie: "Nie celkom." },
        { text: "Cigaretu", spravna: true, vysvetlenie: "Áno." },
      ],
    };
    const scenar = { ...zaklad, kroky: [kroky[0] as (typeof kroky)[number], otazka, ...kroky.slice(1)] };
    const { server: s, zmaz: zmazQ } = await testovaciServer(TEST_ADMIN, { botPauzaMs: 0, vyucbaZapnuta: true, scenarVyucby: scenar });
    try {
      const { cookie } = await registruj(s.port);
      const k = new Klient(s.port, cookie);
      await k.otvorene();
      k.posli({ type: "create", vyucba: true });
      let msg = await k.cakaj("vyucba");
      k.posli({ type: "vyucbaDalej" });
      msg = await k.cakaj("vyucba");
      const q = msg.krok as KrokMsg & { moznosti: { spravna: boolean }[] | null };
      expect(q).toMatchObject({ kto: "otazka", melichar: "Čo dá spoj?" });
      expect(q.moznosti).toHaveLength(2);
      // Najprv zle, potom dobre — zapíše sa len prvá odpoveď.
      k.posli({ type: "vyucbaOdpoved", index: 0 });
      k.posli({ type: "vyucbaOdpoved", index: 1 });
      k.posli({ type: "vyucbaOdpoved", index: 7 });
      expect(String((await k.cakaj("error")).text)).toMatch(/nie je otázka/);
      k.posli({ type: "vyucbaDalej" });
      msg = await k.cakaj("vyucba");
      expect((msg.krok as KrokMsg).index).toBe(2);
      const admin = await prihlas(s.port, TEST_ADMIN.login, TEST_ADMIN.heslo as string);
      const odp = (await (await fetch(`http://127.0.0.1:${s.port}/api/admin/vyucba/odpovede`, { headers: { cookie: admin } })).json()) as { odpovede: unknown[] };
      expect(odp.odpovede).toEqual([{ krok: "q-spoj", odpovedi: 1, spravne: 0 }]);

      // Do rozhodnutia: info preklikať, potom zlý ťah → rada, žiadna chyba.
      while ((msg.krok as KrokMsg).kto !== "hrac") {
        if ((msg.krok as KrokMsg).kto === "info") k.posli({ type: "vyucbaDalej" });
        msg = await k.cakaj("vyucba");
      }
      expect((msg.krok as { volba: unknown }).volba).toEqual({ kandidati: ["ruka:pijan"] });
      k.posli({ type: "cmd", cmd: { type: "pass" } });
      expect((await k.cakaj("vyucbaRada")).text).toBe("Ešte nepasuj.");
      k.posli({ type: "cmd", cmd: { type: "skipNaex" } });
      expect((await k.cakaj("vyucbaRada")).text).toBe("Skús inú kartu.");
      k.zavri();
    } finally {
      await zmazQ();
    }
  });
});

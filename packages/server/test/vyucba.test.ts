// Výučba „Prvá hra“ na serveri (Michal 2026-10-23): naskriptovaná partia proti
// Štamgastovi — server pustí len príkaz kroku, bot hrá podľa skriptu, postup sa
// ukladá k účtu a dohratie spraví z návštevníka hráča bez archívu a štatistík.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Command } from "@naex/core";
import type { GameServer } from "../src/server.ts";
import { nacitajVyucbu } from "../src/server.ts";
import { Ucty } from "../src/auth.ts";
import { otvorDb } from "../src/db.ts";
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

async function zacni(cookie: string, port = server.port): Promise<{ k: Klient; prvy: Msg }> {
  const k = new Klient(port, cookie);
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
    expect(await api(cookie, "GET", "/vyucba")).toMatchObject({ krok: 0, stav: null, ponuknut: true, castiHotove: 0 });

    const { k, prvy } = await zacni(cookie);
    const krok = prvy.krok as KrokMsg;
    expect(krok).toMatchObject({ index: 0, kto: "info" });
    expect(krok.melichar.length).toBeGreaterThan(0);

    const koniec = await hraj(k, prvy);
    expect(koniec).toMatchObject({ hotovo: true, krok: null });
    // Dokončená 1. časť = 1. hviezdička achievementu Prvá hra (Michal 2026-10-25) — oznam príde hneď.
    expect((await k.cakaj("achievement")).zisk).toMatchObject({ id: "prva-hra", rank: 1, rankov: 3 });
    k.zavri();

    expect((await api<{ pouzivatel: { rola: string } }>(cookie, "GET", "/ja")).pouzivatel.rola).toBe("hrac");
    const vitrina = await api<{ achievementy: { achievementy: { id: string; rank: number }[] } }>(cookie, "GET", "/achievementy");
    expect(vitrina.achievementy.achievementy.filter((x) => x.rank > 0).map((x) => x.id)).toEqual(["prva-hra"]);

    // Opakovaná výučba už Prvú hru nedá druhý raz.
    await api(cookie, "POST", "/vyucba/znova");
    // „Začať odznova“ vynuluje stav, hviezdička 1. časti ostáva — vstupy nováčika (#104) sa už neukážu.
    expect(await api(cookie, "GET", "/vyucba")).toMatchObject({ stav: null, castiHotove: 1, ponuknut: false });
    const druha = await zacni(cookie);
    await hraj(druha.k, druha.prvy);
    await expect(druha.k.cakaj("achievement")).rejects.toThrow(/Nedošla/);
    druha.k.zavri();
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
    // Texty a rozhodnutia (výber Lesnej cesty) pred prvým ťahom hráča bez rozhodnutia preklikne.
    let msg = prvy;
    while ((msg.krok as KrokMsg).kto !== "hrac" || (msg.krok as KrokMsg & { volba: unknown }).volba !== null) {
      const krok = msg.krok as KrokMsg;
      if (krok.kto === "hrac") k.posli({ type: "cmd", cmd: krok.ocakava });
      else potvrd(k, krok);
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
    // 4 správy: i-vitaj, i-lokalita, i-lokality, i-hrany — ďalej čaká výber Lesnej cesty.
    const po = await hraj(k, prvy, 4);
    const index = (po.krok as KrokMsg).index;
    expect(index).toBeGreaterThanOrEqual(3);
    k.zavri();
    await new Promise((r) => setTimeout(r, 50));
    // Bot mohol medzitým dohrať svoje kroky — uložené je aspoň to, čo hráč prešiel.
    const ulozene = await api<{ krok: number; ponuknut: boolean }>(cookie, "GET", "/vyucba");
    expect(ulozene.krok).toBeGreaterThanOrEqual(index);
    // Rozpracovaná, nedokončená výučba: pri zakladaní prvej partie sa ponúkne znova (#104).
    expect(ulozene.ponuknut).toBe(true);

    const znova = await zacni(cookie);
    expect((znova.prvy.krok as KrokMsg).index).toBe(ulozene.krok);
    znova.k.zavri();

    await api(cookie, "POST", "/vyucba/preskocit");
    expect(await api(cookie, "GET", "/vyucba")).toMatchObject({ stav: "preskocena", ponuknut: false });
    await api(cookie, "POST", "/vyucba/znova");
    expect(await api(cookie, "GET", "/vyucba")).toMatchObject({ krok: 0, stav: null });
  });
});

describe("výučba po častiach — 1. časť končí uprostred partie (Michal 2026-10-25)", () => {
  const stavServera = async (): Promise<{ partie: { sBotom: number } }> => {
    const admin = await prihlas(server.port, TEST_ADMIN.login, TEST_ADMIN.heslo);
    return (await (await fetch(`http://127.0.0.1:${server.port}/api/admin/stav-servera`, { headers: { cookie: admin } })).json()) as { partie: { sBotom: number } };
  };

  it("po poslednom kroku partia stojí: ťah server nepustí, nasadenie na ňu nečaká a odchodom zanikne", async () => {
    const pred = (await stavServera()).partie.sBotom;
    const { cookie } = await registruj(server.port);
    const { k, prvy } = await zacni(cookie);
    const { code } = await k.cakaj("privitanie");
    expect((await stavServera()).partie.sBotom).toBe(pred + 1);
    const koniec = await hraj(k, prvy);
    expect(koniec).toMatchObject({ hotovo: true, krok: null });
    // Hráč by bol na ťahu (voľba cieľa 2. kola) — vo výučbe už nie.
    k.posli({ type: "cmd", cmd: { type: "chooseLocation", uid: 1, otocena: false } });
    expect(String((await k.cakaj("error")).text)).toMatch(/časť výučby sa skončila/);
    k.posli({ type: "vyucbaDalej" });
    expect(String((await k.cakaj("error")).text)).toMatch(/časť výučby sa skončila/);
    expect((await stavServera()).partie.sBotom).toBe(pred);
    k.zavri();
    await new Promise((r) => setTimeout(r, 50));
    const znova = new Klient(server.port, cookie);
    await znova.otvorene();
    znova.posli({ type: "rejoin", code });
    expect(String((await znova.cakaj("error")).text)).toMatch(/neexistuje/);
    znova.zavri();
    // Do štatistík a archívu sa nič nezapísalo.
    const ja = await api<{ pouzivatel: { id: number } }>(cookie, "GET", "/ja");
    expect((await api<{ pocet: number }>(cookie, "GET", `/hraci/${ja.pouzivatel.id}/partie`)).pocet).toBe(0);
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
      j === iHrac ? { ...k, volba: { kandidati: ["ruka:pijan"], zle: [{ prikaz: { type: "pass" as const }, text: "Ešte nepasuj.", hlaska: "nervy/bud_ticho" }], inak: "Skús inú kartu." } } : k,
    );
    const otazka = {
      id: "q-spoj",
      kto: "otazka" as const,
      melichar: "Čo dá spoj?",
      moznosti: [
        { text: "Ranu", spravna: false, vysvetlenie: "Nie celkom.", hlaska: "urazky/marha" },
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
      // Krok hlášku nenesie — od 2026-10-28 zaznie len pri chybe hráča (Michal).
      expect(msg.krok).toMatchObject({ id: "i-vitaj", cast: { cast: 1, poradie: 0 } });
      expect(msg.krok).not.toHaveProperty("hlaska");
      k.posli({ type: "vyucbaDalej" });
      msg = await k.cakaj("vyucba");
      const q = msg.krok as KrokMsg & { moznosti: { spravna: boolean }[] | null };
      expect(q).toMatchObject({ kto: "otazka", melichar: "Čo dá spoj?" });
      expect(q.moznosti).toHaveLength(2);
      expect(q.moznosti?.[0]).toMatchObject({ spravna: false, hlaska: "urazky/marha" });
      // Najprv zle, potom dobre — zapíše sa len prvá odpoveď; zlá je chyba a pošle hlášku možnosti.
      k.posli({ type: "vyucbaOdpoved", index: 0 });
      expect(await k.cakaj("vyucbaHlaska")).toMatchObject({ hlaska: "urazky/marha" });
      k.posli({ type: "vyucbaOdpoved", index: 1 });
      k.posli({ type: "vyucbaOdpoved", index: 7 });
      expect(String((await k.cakaj("error")).text)).toMatch(/nie je otázka/);
      k.posli({ type: "vyucbaDalej" });
      msg = await k.cakaj("vyucba");
      expect((msg.krok as KrokMsg).index).toBe(2);
      const admin = await prihlas(s.port, TEST_ADMIN.login, TEST_ADMIN.heslo as string);
      const odp = (await (await fetch(`http://127.0.0.1:${s.port}/api/admin/vyucba/odpovede`, { headers: { cookie: admin } })).json()) as { odpovede: unknown[] };
      expect(odp.odpovede).toEqual([{ krok: "q-spoj", odpovedi: 1, spravne: 0 }]);

      // Do rozhodnutia: info a ťahy hry za hráča preklikať, potom zlý ťah → rada, žiadna chyba.
      while ((msg.krok as KrokMsg).kto !== "hrac") {
        potvrd(k, msg.krok as KrokMsg);
        msg = await k.cakaj("vyucba");
      }
      expect((msg.krok as { volba: unknown }).volba).toEqual({ kandidati: ["ruka:pijan"] });
      k.posli({ type: "cmd", cmd: { type: "pass" } });
      // Rada nesie aj hlášku vzoru, všeobecná je bez nej (Michal 2026-10-27).
      expect(await k.cakaj("vyucbaRada")).toMatchObject({ text: "Ešte nepasuj.", hlaska: "nervy/bud_ticho" });
      k.posli({ type: "cmd", cmd: { type: "skipNaex" } });
      // Všeobecná rada nemá hlášku vzoru — zaznie záložná zo scenára (Michal 2026-10-28).
      const rada = await k.cakaj("vyucbaRada");
      expect(rada).toMatchObject({ text: "Skús inú kartu." });
      expect(zaklad.hlaskyChyby).toContain(rada.hlaska);
      k.zavri();
    } finally {
      await zmazQ();
    }
  });
});

describe("výučba — cigareta pre Melichara (Michal 2026-10-25)", () => {
  interface StavMsg {
    view: { hraci: { cigarety: number }[] };
    events: { type: string; text?: string }[];
  }

  it("„Dať cigaretu“ v úvode uberie hráčovi hernú cigaretu cez server a návrat do výučby ju nevráti", async () => {
    const { cookie } = await registruj(server.port);
    const { k, prvy } = await zacni(cookie);
    expect(prvy.krok).toMatchObject({ id: "i-vitaj", kto: "info", tlacidlo: "Dať cigaretu", odovzdaCigaretu: true, preskocenie: true });
    expect(((await k.cakaj("state")) as unknown as StavMsg).view.hraci[0]?.cigarety).toBe(5);
    k.posli({ type: "vyucbaDalej" });
    const po = (await k.cakaj("state")) as unknown as StavMsg;
    expect(po.view.hraci[0]?.cigarety).toBe(4);
    expect(po.events.some((e) => e.type === "log" && /Melichar/.test(e.text ?? ""))).toBe(true);
    expect((await k.cakaj("vyucba")).krok).toMatchObject({ id: "i-lokalita", tlacidlo: null, odovzdaCigaretu: false, preskocenie: false });
    k.zavri();
    await new Promise((r) => setTimeout(r, 50));

    // Obnovenie stránky: výučba pokračuje od i-lokalita a cigareta ostala u Melichara.
    const znova = await zacni(cookie);
    expect(znova.prvy.krok).toMatchObject({ id: "i-lokalita" });
    expect(((await znova.k.cakaj("state")) as unknown as StavMsg).view.hraci[0]?.cigarety).toBe(4);
    znova.k.zavri();
  });

  it("i-strach má tlačidlo „Odovzdať cigaretu“ a uberie ďalšiu; i-senok je nanečisto", async () => {
    const { cookie } = await registruj(server.port);
    const { k, prvy } = await zacni(cookie);
    let msg = prvy;
    let senok: KrokMsg | null = null;
    while ((msg.krok as KrokMsg & { id: string }).id !== "i-strach") {
      const krok = msg.krok as KrokMsg & { id: string };
      if (krok.id === "i-senok") senok = krok;
      if (krok.kto === "hrac") k.posli({ type: "cmd", cmd: krok.ocakava });
      else potvrd(k, krok);
      msg = await k.cakaj("vyucba");
    }
    expect(senok).toMatchObject({ kto: "info", naneisto: true });
    expect(msg.krok).toMatchObject({ kto: "info", tlacidlo: "Odovzdať cigaretu", odovzdaCigaretu: true });
    // Posledný stav pred odovzdaním: z fronty po jednom, kým tam niečo je.
    let pred: StavMsg | null = null;
    for (;;) {
      const st = await Promise.race([k.cakaj("state"), new Promise<null>((r) => setTimeout(() => r(null), 100))]);
      if (st === null) break;
      pred = st as unknown as StavMsg;
    }
    const mal = pred?.view.hraci[0]?.cigarety ?? -1;
    expect(mal).toBe(6);
    k.posli({ type: "vyucbaDalej" });
    expect(((await k.cakaj("state")) as unknown as StavMsg).view.hraci[0]?.cigarety).toBe(5);
    k.zavri();
  });
});

describe("výučba v troch častiach (roadmapa #105)", () => {
  const scenar = nacitajVyucbu();
  const idKroku = (msg: Msg): string => (msg.krok as { id: string }).id;
  const ziadaj = async (port: number, cookie: string): Promise<Record<string, unknown>> =>
    (await (await fetch(`http://127.0.0.1:${port}/api/vyucba`, { headers: { cookie } })).json()) as Record<string, unknown>;

  it("hráč po 1. časti: hviezdička, partia stojí a ponúkne 2. časť (texty schválené, Michal 2026-10-28)", async () => {
    expect(scenar.casti?.every((c) => c.navrh !== true)).toBe(true);
    const { cookie } = await registruj(server.port);
    const { k, prvy } = await zacni(cookie);
    expect(await hraj(k, prvy)).toMatchObject({ hotovo: true, krok: null, koniecCasti: 1, dalsiaCast: { cast: 2, nazov: "NA EX a podlosti" }, pripravujeme: null });
    expect((await k.cakaj("achievement")).zisk).toMatchObject({ id: "prva-hra", rank: 1 });
    k.zavri();
  });

  it("časť s navrh (texty na schválenie) hráčovi server nepustí", async () => {
    const sNavrhom = { ...scenar, casti: scenar.casti?.map((c) => (c.cast === 1 ? c : { ...c, navrh: true })) };
    const { server: srv, zmaz: zmazN } = await testovaciServer(TEST_ADMIN, { botPauzaMs: 0, vyucbaZapnuta: true, scenarVyucby: sNavrhom });
    const server = srv;
    try {
    const { cookie } = await registruj(server.port);
    const { k, prvy } = await zacni(cookie, server.port);
    const koniec = await hraj(k, prvy);
    expect(koniec).toMatchObject({ hotovo: true, krok: null, koniecCasti: 1, dalsiaCast: null, pripravujeme: { cast: 2, nazov: "NA EX a podlosti" } });
    expect((await k.cakaj("achievement")).zisk).toMatchObject({ id: "prva-hra", rank: 1 });
    k.posli({ type: "vyucbaPokracuj" });
    expect(String((await k.cakaj("error")).text)).toMatch(/2\. časť výučby ešte pripravujeme/);
    k.zavri();
    expect(await ziadaj(server.port, cookie)).toMatchObject({
      krok: scenar.kroky.findIndex((x) => x.id === "i-vitaj2"),
      stav: "hotova",
      castiHotove: 1,
      rozpracovana: false,
      dalsiaCast: null,
      pripravujeme: { cast: 2 },
    });
    // „Pokračovať“ by nemal čím — nová výučba začne 1. časťou.
    const znova = await zacni(cookie, server.port);
    expect(idKroku(znova.prvy)).toBe("i-vitaj");
    znova.k.zavri();
    } finally {
      await zmazN();
    }
  });

  it("správca prejde všetky tri časti: po každej hviezdička, ďalšia časť v tej istej partii aj z lobby od svojho začiatku", async () => {
    const { server: s, zmaz: z } = await testovaciServer(TEST_ADMIN, { botPauzaMs: 0, vyucbaZapnuta: true });
    try {
      const admin = await prihlas(s.port, TEST_ADMIN.login, TEST_ADMIN.heslo);
      const k = new Klient(s.port, admin);
      await k.otvorene();
      k.posli({ type: "create", vyucba: true });
      const prva = await hraj(k, await k.cakaj("vyucba"));
      expect(prva).toMatchObject({ hotovo: true, koniecCasti: 1, dalsiaCast: { cast: 2, nazov: "NA EX a podlosti" }, pripravujeme: null });
      expect((await k.cakaj("achievement")).zisk).toMatchObject({ rank: 1 });

      // Pokračovať 2. časťou: tá istá partia, prvý krok 2. časti.
      k.posli({ type: "vyucbaPokracuj" });
      let msg = await k.cakaj("vyucba");
      expect(msg.krok).toMatchObject({ id: "i-vitaj2", cast: { cast: 2, poradie: 0 } });
      // Krok s hláškou pri chybe: zlý ťah ju pošle s vyucbaChyba.
      while ((msg.krok as KrokMsg).kto !== "hrac" || (msg.krok as { volba: unknown }).volba !== null) {
        const krok = msg.krok as KrokMsg;
        if (krok.kto === "hrac") k.posli({ type: "cmd", cmd: krok.ocakava });
        else potvrd(k, krok);
        msg = await k.cakaj("vyucba");
      }
      const sHlaskou = scenar.kroky.find((x) => x.id === idKroku(msg));
      expect(sHlaskou?.hlaskaChyby).toBeDefined();
      k.posli({ type: "cmd", cmd: { type: "pass" } });
      expect(await k.cakaj("vyucbaChyba")).toMatchObject({ hlaska: sHlaskou?.hlaskaChyby });
      msg = await k.cakaj("vyucba");
      const druha = await hraj(k, msg);
      expect(druha).toMatchObject({ hotovo: true, koniecCasti: 2, dalsiaCast: { cast: 3 } });
      expect((await k.cakaj("achievement")).zisk).toMatchObject({ rank: 2 });
      k.zavri();
      await new Promise((r) => setTimeout(r, 50));

      // Z lobby: „Pokračovať vo výučbe“ = 3. časť od jej prvého kroku (partia sa prehrá po ňu).
      expect(await ziadaj(s.port, admin)).toMatchObject({ castiHotove: 2, rozpracovana: false, cast: { cast: 3 }, dalsiaCast: { cast: 3, nazov: "Celá hra" } });
      const tretia = new Klient(s.port, admin);
      await tretia.otvorene();
      tretia.posli({ type: "create", vyucba: true });
      const zaciatok = await tretia.cakaj("vyucba");
      expect(zaciatok.krok).toMatchObject({ id: "i-vitaj3", cast: { cast: 3, poradie: 0 } });
      const koniec = await hraj(tretia, zaciatok);
      expect(koniec).toMatchObject({ hotovo: true, koniecCasti: 3, dalsiaCast: null, pripravujeme: null });
      expect((await tretia.cakaj("achievement")).zisk).toMatchObject({ rank: 3 });
      tretia.zavri();
      expect(await ziadaj(s.port, admin)).toMatchObject({ castiHotove: 3, cast: null, rozpracovana: false, dalsiaCast: null });
    } finally {
      await z();
    }
  });

  it("zlý ťah bez hlášky kroku: záložná zo scenára, dve po sebe nie sú rovnaké", async () => {
    const { cookie } = await registruj(server.port);
    const { k, prvy } = await zacni(cookie);
    let msg = prvy;
    while ((msg.krok as KrokMsg).kto !== "hrac" || (msg.krok as { volba: unknown }).volba !== null) {
      const krok = msg.krok as KrokMsg;
      if (krok.kto === "hrac") k.posli({ type: "cmd", cmd: krok.ocakava });
      else potvrd(k, krok);
      msg = await k.cakaj("vyucba");
    }
    expect(scenar.kroky.find((x) => x.id === idKroku(msg))?.hlaskaChyby).toBeUndefined();
    const hlasky: unknown[] = [];
    for (let n = 0; n < 3; n++) {
      k.posli({ type: "cmd", cmd: { type: "pass" } });
      hlasky.push((await k.cakaj("vyucbaChyba")).hlaska);
    }
    for (const h of hlasky) expect(scenar.hlaskyChyby).toContain(h);
    expect(hlasky[1]).not.toBe(hlasky[0]);
    expect(hlasky[2]).not.toBe(hlasky[1]);
    k.zavri();
  });

  it("uložený postup sa nájde podľa id kroku aj po zmene scenára; staršie uloženie bez id podľa verzie", () => {
    const dir = mkdtempSync(join(tmpdir(), "naex-vyucba-"));
    const db = otvorDb(join(dir, "naex.db"));
    try {
      const ucty = new Ucty(db, { login: "Admin", heslo: null });
      const u = ucty.registruj("jano", "tajneheslo", "Jano", 1);
      ucty.ulozVyucbu(u.id, 2, undefined, "v1", "c");
      expect(ucty.vyucba(u.id, "v1", ["a", "b", "c"]).krok).toBe(2);
      // Pred „c“ pribudli kroky — postup ide s ním, aj keď sa zmenila verzia.
      expect(ucty.vyucba(u.id, "v2", ["x", "y", "a", "b", "c"]).krok).toBe(4);
      // Krok zo scenára zmizol: rovnaká verzia drží index, iná začne odznova.
      expect(ucty.vyucba(u.id, "v1", ["a", "b"]).krok).toBe(2);
      expect(ucty.vyucba(u.id, "v2", ["a", "b"]).krok).toBe(0);
      // Uložené pred 2026-10-28 (bez id).
      ucty.ulozVyucbu(u.id, 5, "hotova", "v1");
      expect(ucty.vyucba(u.id, "v1", ["a", "b", "c"])).toEqual({ krok: 5, stav: "hotova" });
      expect(ucty.vyucba(u.id, "v2", ["a", "b", "c"]).krok).toBe(0);
    } finally {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

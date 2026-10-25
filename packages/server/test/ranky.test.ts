// Ranky a práva (Michal 2026-10-22): návštevník → Poldeci (kľúč „hrac“) →
// Deci → Sedmička, automatický postup len nahor, ručný rank má prednosť,
// matica rank × právo, subadmin nesmie nad seba.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prazdneStatistiky } from "@naex/core";
import { Archiv } from "../src/archiv.ts";
import { Ucty } from "../src/auth.ts";
import { otvorDb } from "../src/db.ts";
import type { KatalogAchievementov } from "@naex/core";
import { Achievementy, nacitajKatalog } from "../src/achievementy.ts";
import { PRAVA, PREDVOLENE_PRAVA, Prava, dalsiRank, prahyRankov, rankPodlaHviezd } from "../src/prava.ts";
import type { GameServer } from "../src/server.ts";
import { createGameServer } from "../src/server.ts";
import { Klient, TEST_ADMIN, nastavUroven, prihlas, registruj, testovaciServer } from "./pomocnik.ts";

function docasnaDb(): { db: ReturnType<typeof otvorDb>; zmaz: () => void } {
  const dir = mkdtempSync(join(tmpdir(), "naex-ranky-"));
  const db = otvorDb(join(dir, "naex.db"));
  return { db, zmaz: () => { db.close(); rmSync(dir, { recursive: true, force: true }); } };
}

function partie(archiv: Archiv, hraci: [number, number], pocet: number, dohrata = true): void {
  for (let i = 0; i < pocet; i++) {
    archiv.zapis({
      kod: "TEST", zaciatok: 0, koniec: 1, vitaz: 0, dovod: dohrata ? "Odohrala sa posledná bitka o lokalitu." : "Partiu vzdáva X.",
      kola: 3, verziaSady: null, dohrata, hraci, body: null, statistiky: [prazdneStatistiky(), prazdneStatistiky()],
    });
  }
}

const POSTUP = PREDVOLENE_PRAVA.postup;

/** Hráč má prvých n hviezd katalógu (ranky po poradí, riadky ako pri zisku v partii); ďalšie, čo už mal, sa pripočítajú. */
function dajHviezdy(db: ReturnType<typeof otvorDb>, katalog: KatalogAchievementov, pouzivatel: number, n: number): void {
  const vloz = db.prepare("INSERT OR IGNORE INTO achievementy_zisky (pouzivatel, achievement, rank, ziskane, miestnost, partia) VALUES (?, ?, ?, 1, 'test', NULL)");
  let zostava = n;
  for (const a of katalog.achievementy) {
    for (let r = 1; r <= a.prahy.length && zostava > 0; r++, zostava--) vloz.run(pouzivatel, a.id, r);
    if (zostava === 0) return;
  }
}

describe("ranky — automatický postup podľa hviezd (Michal 2026-10-25)", () => {
  it("prahy: Deci od 35 %, Sedmička od 50 % všetkých hviezd katalógu, zaokrúhlené nahor", () => {
    expect(POSTUP).toEqual({ deci: 35, sedmicka: 50 });
    const katalog = nacitajKatalog();
    const spolu = katalog.achievementy.reduce((n, a) => n + a.prahy.length, 0);
    const prahy = prahyRankov(POSTUP, spolu);
    expect(prahy).toEqual({ deci: Math.ceil(spolu * 0.35), sedmicka: Math.ceil(spolu * 0.5) });
    // Dnešný katalóg: 62 achievementov so 186 hviezdami + Prvá hra = 187 → Deci 66, Sedmička 94.
    expect(spolu).toBe(187);
    expect(prahy).toEqual({ deci: 66, sedmicka: 94 });
    // Presné percento sa nezaokrúhli nahor o hviezdu navyše; bez katalógu sa na hviezdy nepostupuje.
    expect(prahyRankov(POSTUP, 100)).toEqual({ deci: 35, sedmicka: 50 });
    expect(prahyRankov(POSTUP, 0)).toBeNull();
    const r = (hviezdy: number, poldeci: boolean) => rankPodlaHviezd(POSTUP, { hviezdy, spolu, poldeci });
    expect(r(0, false)).toBe("navstevnik");
    expect(r(65, false)).toBe("navstevnik");
    expect(r(0, true)).toBe("hrac");
    expect(r(65, true)).toBe("hrac");
    expect(r(66, true)).toBe("deci");
    expect(r(93, true)).toBe("deci");
    expect(r(94, true)).toBe("sedmicka");
    expect(r(187, true)).toBe("sedmicka");
    expect(rankPodlaHviezd(POSTUP, { hviezdy: 0, spolu: 0, poldeci: true })).toBe("hrac");
    expect(dalsiRank(POSTUP, "hrac", { hviezdy: 40, spolu })).toEqual({ rank: "deci", prah: 66 });
    expect(dalsiRank(POSTUP, "deci", { hviezdy: 70, spolu })).toEqual({ rank: "sedmicka", prah: 94 });
    expect(dalsiRank(POSTUP, "sedmicka", { hviezdy: 100, spolu })).toBeNull();
  });

  it("Poldeci po výučbe alebo prvej partii; hviezdy povyšujú, partie už nie; nikoho neznížia", () => {
    const { db, zmaz } = docasnaDb();
    try {
      const ucty = new Ucty(db, { login: "Admin", heslo: null });
      const archiv = new Archiv(db);
      const katalog = nacitajKatalog();
      const achievementy = new Achievementy(db, katalog);
      ucty.pouziHviezdy((id) => achievementy.hviezdy(id));
      const a = ucty.registruj("jano", "tajneheslo", "Jano", 1);
      const b = ucty.registruj("eva", "tajneheslo", "Eva", 1);
      const c = ucty.registruj("fero", "tajneheslo", "Fero", 1);

      // Výučba: achievement Prvá hra raz a z návštevníka Poldeci.
      ucty.ulozVyucbu(a.id, 99, "hotova");
      expect(achievementy.udelZaVyucbu(a.id, 5).map((z) => [z.id, z.rank])).toEqual([["prva-hra", 1]]);
      expect(achievementy.udelZaVyucbu(a.id, 6)).toEqual([]);
      expect(achievementy.hviezdy(a.id)).toEqual({ hviezdy: 1, spolu: 187 });
      expect(ucty.povysPoPartii(a.id, POSTUP)).toBe(true);
      expect(ucty.podlaId(a.id)?.rola).toBe("hrac");
      // Kto výučbu preskočí, je Poldeci po prvej dohratej partii (aj s botom).
      expect(ucty.povysPodlaHviezd(b.id, POSTUP)).toBeNull();
      expect(ucty.podlaId(b.id)?.rola).toBe("navstevnik");
      expect(ucty.povysPoPartii(b.id, POSTUP)).toBe(true);
      expect(ucty.podlaId(b.id)?.rola).toBe("hrac");

      // Partie s ľuďmi už Deci nedajú (ani 40 dohratých)…
      partie(archiv, [a.id, b.id], 40);
      ucty.prepocitajRanky(POSTUP);
      expect(ucty.podlaId(a.id)?.rola).toBe("hrac");
      // …hviezdy áno (k Prvej hre ďalšie): 65 nie, 66 Deci, 94 Sedmička — hneď po zisku.
      dajHviezdy(db, katalog, a.id, 64);
      expect(ucty.povysPodlaHviezd(a.id, POSTUP)).toBeNull();
      dajHviezdy(db, katalog, a.id, 65);
      expect(ucty.povysPodlaHviezd(a.id, POSTUP)).toBe("deci");
      dajHviezdy(db, katalog, a.id, 93);
      expect(ucty.povysPodlaHviezd(a.id, POSTUP)).toBe("sedmicka");

      // Nikoho neznížiť: Deci za partie (zo starých pravidiel) ostáva pri prepočte aj pri návrate na automatiku.
      db.prepare("UPDATE pouzivatelia SET rola = 'deci' WHERE id = ?").run(c.id);
      ucty.prepocitajRanky(POSTUP);
      expect(ucty.podlaId(c.id)?.rola).toBe("deci");
      ucty.automatickyRank(c.id, POSTUP);
      expect(ucty.podlaId(c.id)?.rola).toBe("deci");
      // Prísnejšie percentá nikoho neznížia ani pri prepočte.
      ucty.prepocitajRanky({ deci: 90, sedmicka: 99 });
      expect(ucty.podlaId(a.id)?.rola).toBe("sedmicka");

      // Ručný rank: automatika ho nemení ani nahor; návrat na automatiku ho prepočíta (aj nadol, Poldeci ostáva).
      ucty.nastavRolu(b.id, "sedmicka");
      dajHviezdy(db, katalog, b.id, 10);
      expect(ucty.povysPodlaHviezd(b.id, POSTUP)).toBeNull();
      ucty.automatickyRank(b.id, POSTUP);
      expect(ucty.rolaRucne(b.id)).toBe(false);
      expect(ucty.podlaId(b.id)?.rola).toBe("hrac");
      // Subadmin nie je hráčsky rank — automatika ho nemení.
      ucty.nastavRolu(a.id, "subadmin");
      ucty.prepocitajRanky(POSTUP);
      expect(ucty.podlaId(a.id)?.rola).toBe("subadmin");
    } finally {
      zmaz();
    }
  });

  it("štart nad starým nastavením (postup v partiách): percentá sú predvolené, matica ostáva; výučba dodatočne dá Prvú hru", async () => {
    const dir = mkdtempSync(join(tmpdir(), "naex-ranky-start-"));
    try {
      const db = otvorDb(join(dir, "naex.sqlite"));
      const ucty = new Ucty(db, TEST_ADMIN);
      const zaPartie = ucty.registruj("starydeci", "tajneheslo", "Starý Deci", 1);
      const poVyucbe = ucty.registruj("vyucba", "tajneheslo", "Po výučbe", 1);
      db.prepare("UPDATE pouzivatelia SET rola = 'sedmicka' WHERE id = ?").run(zaPartie.id);
      ucty.ulozVyucbu(poVyucbe.id, 99, "hotova");
      const matica = Object.fromEntries(PRAVA.map((p) => [p, p === "hodnotit_hru" ? ["deci", "sedmicka"] : ["navstevnik", "hrac", "deci", "sedmicka"]]));
      db.prepare("INSERT INTO nastavenia (kluc, data) VALUES ('prava', ?)").run(JSON.stringify({ matica, postup: { deci: 10, sedmicka: 30 } }));
      db.close();

      const s = await createGameServer({ port: 0, dataDir: dir, admin: TEST_ADMIN, staticDir: join(dir, "nic"), achievementyZapnute: true });
      try {
        const admin = await prihlas(s.port, TEST_ADMIN.login, TEST_ADMIN.heslo);
        const prava = await fetch(`http://127.0.0.1:${s.port}/api/admin/prava`, { headers: { cookie: admin } });
        expect(prava.status).toBe(200);
        expect(await prava.json()).toMatchObject({
          postup: { deci: 35, sedmicka: 50 },
          hviezdySpolu: 187,
          prahyHviezd: { deci: 66, sedmicka: 94 },
          matica: { hodnotit_hru: ["deci", "sedmicka"] },
        });
        const zoznam = (await (await fetch(`http://127.0.0.1:${s.port}/api/admin/pouzivatelia`, { headers: { cookie: admin } })).json()) as {
          pouzivatelia: { id: number; rola: string }[];
        };
        expect(zoznam.pouzivatelia.find((u) => u.id === zaPartie.id)?.rola).toBe("sedmicka");
        expect(zoznam.pouzivatelia.find((u) => u.id === poVyucbe.id)?.rola).toBe("hrac");
        const cookie = await prihlas(s.port, "vyucba", "tajneheslo");
        const vitrina = (await (await fetch(`http://127.0.0.1:${s.port}/api/achievementy`, { headers: { cookie } })).json()) as {
          achievementy: { achievementy: { id: string; rank: number }[] };
        };
        expect(vitrina.achievementy.achievementy.find((x) => x.id === "prva-hra")?.rank).toBe(1);
      } finally {
        await s.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("práva — matica rank × právo", () => {
  it("predvolene smie každý všetko; odobraté právo platí, správca a AI pri hodnotení vždy", () => {
    const { db, zmaz } = docasnaDb();
    try {
      const prava = new Prava(db);
      for (const rola of ["navstevnik", "hrac", "deci", "sedmicka"] as const) {
        expect(prava.zoznam({ rola, ai: false })).toEqual([...PRAVA]);
      }
      const admin = { id: 1, rola: "admin" } as Parameters<Prava["uloz"]>[0];
      prava.uloz(admin, { matica: { hodnotit_hru: ["deci", "sedmicka"], reporty_playtestov: [] } });
      expect(prava.smie({ rola: "hrac", ai: false }, "hodnotit_hru")).toBe(false);
      expect(prava.smie({ rola: "hrac", ai: true }, "hodnotit_hru")).toBe(true);
      expect(prava.smie({ rola: "deci", ai: false }, "hodnotit_hru")).toBe(true);
      expect(prava.smie({ rola: "sedmicka", ai: false }, "reporty_playtestov")).toBe(false);
      expect(prava.smie({ rola: "subadmin", ai: false }, "reporty_playtestov")).toBe(true);
      expect(() => prava.vyzaduj({ rola: "hrac", ai: false }, "hodnotit_hru")).toThrow(/hodnotiť hru/);
      // Neuvedené práva ostanú, ako boli.
      expect(prava.smie({ rola: "navstevnik", ai: false }, "hrat_bot")).toBe(true);
    } finally {
      zmaz();
    }
  });

  it("uloženie overí tvar a smie len správca", () => {
    const { db, zmaz } = docasnaDb();
    try {
      const prava = new Prava(db);
      const admin = { id: 1, rola: "admin" } as Parameters<Prava["uloz"]>[0];
      const hrac = { id: 2, rola: "sedmicka" } as Parameters<Prava["uloz"]>[0];
      expect(() => prava.uloz(hrac, { matica: { hrat_bot: [] } })).toThrow(/admin alebo subadmin/);
      expect(() => prava.uloz(admin, { matica: { lietat: ["hrac"] } })).toThrow(/Neznáme právo/);
      expect(() => prava.uloz(admin, { matica: { hrat_bot: ["subadmin"] } })).toThrow(/zoznam rankov/);
      expect(() => prava.uloz(admin, { postup: { deci: 50, sedmicka: 50 } })).toThrow(/viac hviezd/);
      expect(() => prava.uloz(admin, { postup: { deci: 101 } })).toThrow(/percento 1 až 100/);
      expect(prava.uloz(admin, { postup: { deci: 30 } }).postup).toEqual({ deci: 30, sedmicka: 50 });
      // Uložené percentá prežijú načítanie (kľúč postupHviezd, starý „postup“ v partiách sa ignoruje).
      expect(new Prava(db).nastavenie().postup).toEqual({ deci: 30, sedmicka: 50 });
    } finally {
      zmaz();
    }
  });
});

describe("ranky a práva — API", () => {
  let server: GameServer;
  let zmazServer: () => Promise<void>;
  beforeAll(async () => {
    ({ server, zmaz: zmazServer } = await testovaciServer());
  });
  afterAll(async () => {
    await zmazServer();
  });

  const volaj = async (cookie: string, metoda: string, cesta: string, telo?: unknown) => {
    const res = await fetch(`http://127.0.0.1:${server.port}/api${cesta}`, {
      method: metoda,
      headers: { "content-type": "application/json", "x-naex": "1", cookie },
      body: telo === undefined ? undefined : JSON.stringify(telo),
    });
    return { status: res.status, data: (await res.json()) as Record<string, unknown> };
  };
  const idUctu = async (cookie: string): Promise<number> => ((await volaj(cookie, "GET", "/ja")).data.pouzivatel as { id: number }).id;

  it("/api/ja vráti práva; subadmin mení hráčske ranky a maticu, ale nie správcov", async () => {
    const admin = await prihlas(server.port, TEST_ADMIN.login, TEST_ADMIN.heslo);
    const sub = (await registruj(server.port)).cookie;
    const hrac = (await registruj(server.port)).cookie;
    const sub2 = (await registruj(server.port)).cookie;
    await nastavUroven(server.port, admin, sub, "subadmin");
    await nastavUroven(server.port, admin, sub2, "subadmin");
    expect((await volaj(hrac, "GET", "/ja")).data.pouzivatel).toMatchObject({ rola: "navstevnik", prava: [...PRAVA] });

    const idHraca = await idUctu(hrac);
    expect((await volaj(sub, "PATCH", `/admin/pouzivatelia/${idHraca}`, { rola: "deci" })).status).toBe(200);
    const zoznam = (await volaj(sub, "GET", "/admin/pouzivatelia")).data.pouzivatelia as { id: number; rola: string; rolaRucne: boolean }[];
    expect(zoznam.find((u) => u.id === idHraca)).toMatchObject({ rola: "deci", rolaRucne: true });
    expect((await volaj(sub, "PATCH", `/admin/pouzivatelia/${idHraca}`, { automaticky: true })).status).toBe(200);
    // Partie s botom sa nikde nerátajú, preto kto bol aspoň Poldeci, ostáva ním (0 partií s ľuďmi).
    expect((await volaj(hrac, "GET", "/ja")).data.pouzivatel).toMatchObject({ rola: "hrac" });

    // Nad seba nie: na subadmina, iného subadmina ani admina.
    expect((await volaj(sub, "PATCH", `/admin/pouzivatelia/${idHraca}`, { rola: "subadmin" })).status).toBe(403);
    expect((await volaj(sub, "PATCH", `/admin/pouzivatelia/${await idUctu(sub2)}`, { rola: "hrac" })).status).toBe(403);
    expect((await volaj(sub, "PATCH", `/admin/pouzivatelia/${await idUctu(admin)}`, { rola: "hrac" })).status).toBe(400);
    expect((await volaj(sub, "PATCH", `/admin/pouzivatelia/${idHraca}`, { ai: true })).status).toBe(403);

    // Matica: hráč nie, subadmin áno; zmena sa hneď prejaví v /api/ja.
    expect((await volaj(hrac, "PUT", "/admin/prava", { matica: { hodnotit_hru: [] } })).status).toBe(403);
    const ulozene = await volaj(sub, "PUT", "/admin/prava", { matica: { hodnotit_hru: ["deci", "sedmicka"] } });
    expect(ulozene.status).toBe(200);
    expect(((await volaj(hrac, "GET", "/ja")).data.pouzivatel as { prava: string[] }).prava).not.toContain("hodnotit_hru");
    const nacitane = await volaj(admin, "GET", "/admin/prava");
    expect(nacitane.data).toMatchObject({ postup: { deci: 35, sedmicka: 50 }, ranky: ["navstevnik", "hrac", "deci", "sedmicka"] });
    // Späť na predvolené, aby ostatné testy servera nič nezdedili.
    await volaj(admin, "PUT", "/admin/prava", { matica: { hodnotit_hru: ["navstevnik", "hrac", "deci", "sedmicka"] } });
  });

  /** Odoberie návštevníkovi jedno právo, spustí kontrolu a vráti ho. */
  const bezPrava = async (admin: string, pravo: string, kontrola: () => Promise<void>): Promise<void> => {
    expect((await volaj(admin, "PUT", "/admin/prava", { matica: { [pravo]: ["hrac", "deci", "sedmicka"] } })).status).toBe(200);
    try {
      await kontrola();
    } finally {
      await volaj(admin, "PUT", "/admin/prava", { matica: { [pravo]: ["navstevnik", "hrac", "deci", "sedmicka"] } });
    }
  };

  it("server vynúti každé právo: hra, Melichar, profily, rebríček, fotka, reporty, Spätná väzba, hodnotenie", async () => {
    const admin = await prihlas(server.port, TEST_ADMIN.login, TEST_ADMIN.heslo);
    const n = (await registruj(server.port)).cookie;
    const iny = (await registruj(server.port)).cookie;
    const idIneho = await idUctu(iny);
    // Druhý hráč je Poldeci — práva sa odoberajú len návštevníkovi.
    await nastavUroven(server.port, admin, iny, "hrac");
    const ws = async (cookie: string): Promise<Klient> => {
      const k = new Klient(server.port, cookie);
      await k.otvorene();
      return k;
    };
    const chyba = async (k: Klient): Promise<string> => String((await k.cakaj("error")).text);

    // Predvolene smie návštevník všetko (Michal 2026-10-22).
    expect((await volaj(n, "GET", `/hraci/${idIneho}`)).status).toBe(200);
    expect((await volaj(n, "GET", "/playtesty")).status).toBe(200);

    await bezPrava(admin, "hrat_bot", async () => {
      const k = await ws(n);
      k.posli({ type: "create", bot: true });
      expect(await chyba(k)).toMatch(/proti počítaču/);
      k.zavri();
    });
    await bezPrava(admin, "sukromne_miestnosti", async () => {
      const k = await ws(n);
      k.posli({ type: "create" });
      expect(await chyba(k)).toMatch(/súkromné/);
      k.posli({ type: "create", verejna: true });
      await k.cakaj("privitanie");
      k.zavri();
    });
    await bezPrava(admin, "hrat_ludia", async () => {
      const k = await ws(n);
      k.posli({ type: "create", verejna: true });
      expect(await chyba(k)).toMatch(/proti ľuďom/);
      const zakladatel = await ws(iny);
      zakladatel.posli({ type: "create" });
      const { code } = await zakladatel.cakaj("privitanie");
      k.posli({ type: "join", code });
      expect(await chyba(k)).toMatch(/proti ľuďom/);
      k.zavri();
      zakladatel.zavri();
    });
    await bezPrava(admin, "melichar_soundboard", async () => {
      const a = await ws(iny);
      const b = await ws(n);
      a.posli({ type: "create" });
      const { code } = await a.cakaj("privitanie");
      b.posli({ type: "join", code });
      await b.cakaj("state");
      b.posli({ type: "melichar", id: "hocico" });
      expect(await chyba(b)).toMatch(/Melichara/);
      a.zavri();
      b.zavri();
    });
    await bezPrava(admin, "profily_inych", async () => {
      expect((await volaj(n, "GET", `/hraci/${idIneho}`)).status).toBe(403);
      expect((await volaj(n, "GET", `/hraci/${await idUctu(n)}`)).status).toBe(200);
      expect((await volaj(n, "GET", "/rebricek")).status).toBe(403);
    });
    await bezPrava(admin, "vlastna_fotka", async () => {
      expect((await volaj(n, "PUT", "/profil/avatar", {})).status).toBe(403);
    });
    await bezPrava(admin, "reporty_playtestov", async () => {
      expect((await volaj(n, "GET", "/playtesty")).status).toBe(403);
      expect((await volaj(admin, "GET", "/playtesty")).status).toBe(200);
    });
    await bezPrava(admin, "spatna_vazba_pisat", async () => {
      expect((await volaj(n, "POST", "/nazory", { kategoria: "ine", text: "Návštevník bez práva píše." })).status).toBe(403);
    });
    await bezPrava(admin, "hodnotit_hru", async () => {
      expect((await volaj(n, "PUT", "/znamky", { znamky: { zabava: 5 } })).status).toBe(403);
    });
   }, 30_000);
});

describe("hodnotené partie", () => {
  it("nehodnotená partia ide do archívu, ale Frajerinu nemení", () => {
    const { db, zmaz } = docasnaDb();
    try {
      const ucty = new Ucty(db, { login: "Admin", heslo: null });
      const archiv = new Archiv(db);
      const a = ucty.registruj("jano", "tajneheslo", "Jano", 1);
      const b = ucty.registruj("eva", "tajneheslo", "Eva", 1);
      const { zmeny } = archiv.zapis({
        kod: "TEST", zaciatok: 0, koniec: 1, vitaz: 0, dovod: "Odohrala sa posledná bitka o lokalitu.",
        kola: 3, verziaSady: null, dohrata: true, hraci: [a.id, b.id], hodnotena: false, body: null,
        statistiky: [prazdneStatistiky(), prazdneStatistiky()],
      });
      expect(zmeny.map((z) => z.po - z.pred)).toEqual([0, 0]);
      expect(archiv.frajerina(a.id).partie).toBe(0);
      expect(ucty.dohrate(a.id)).toBe(1);
      partie(archiv, [a.id, b.id], 1);
      expect(archiv.frajerina(a.id).partie).toBe(1);
      expect(archiv.frajerina(a.id).hodnota).toBeGreaterThan(archiv.frajerina(b.id).hodnota);
    } finally {
      zmaz();
    }
  });
});

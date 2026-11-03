// Upratanie pri vypálení Zrejúcej (skill naex-vypalit, Michal 2026-11-02): mäkké
// skrytie zastaraných príspevkov AI účtov, archív návrhov a reportov
// z playtestov a kandidáti na skrytie (admin.ts zastarane).

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Ucty, type Pouzivatel } from "../src/auth.ts";
import { otvorDb } from "../src/db.ts";
import { Navrhy } from "../src/navrhy.ts";
import { Nazory } from "../src/nazory.ts";
import { Playtesty } from "../src/playtesty.ts";
import { zaznamySkrytia } from "../src/skrytie.ts";
import type { GameServer } from "../src/server.ts";
import { TEST_ADMIN, nastavUroven, prihlas, registruj, testovaciServer } from "./pomocnik.ts";
import { hladane, kmenMena, textZHtml, zaniknuteKarty, zmienky } from "../../../tools/admin/zastarane.ts";

const T0 = Date.parse("2026-11-02T10:00:00+01:00");

function docasnaDb() {
  const dir = mkdtempSync(join(tmpdir(), "naex-vypalit-"));
  const db = otvorDb(join(dir, "naex.db"));
  const ucty = new Ucty(db, { login: "Admin", heslo: null });
  let n = 0;
  const ucet = (rola: "hrac" | "subadmin" = "hrac", ai = false): Pouzivatel => {
    const p = ucty.registruj(`ucet${++n}`, "tajneheslo", `Účet ${n}`, 1);
    ucty.nastavRolu(p.id, rola);
    if (ai) ucty.nastavAi(p.id, true);
    return ucty.podlaId(p.id) as Pouzivatel;
  };
  return { db, dir, ucet, zmaz: () => { db.close(); rmSync(dir, { recursive: true, force: true }); } };
}

const NAVRH = {
  kluc: "uplatok",
  nazov: "Úplatok je príliš silný",
  kritickost: "stredna",
  problem: "Úplatok rozhoduje bitky.",
  pricina: "x",
  prejav: "y",
  moznosti: [{ kluc: "A", nazov: "Zoslabiť", popis: "p", dopad: "", narocnost: "", odporucana: true }],
};

describe("skrytie príspevkov AI v Spätnej väzbe", () => {
  it("názor ani komentár človeka sa skryť nedá — ani správcom, ani s dôvodom", () => {
    const { db, ucet, zmaz } = docasnaDb();
    try {
      const nazory = new Nazory(db);
      const spravca = ucet("subadmin", true);
      const clovek = ucet("hrac");
      const robot = ucet("hrac", true);
      const nazorCloveka = nazory.pridaj(clovek, "karty", "Kohút je príliš silný.", T0);
      const komentarCloveka = nazory.komentuj(clovek, nazory.pridaj(robot, "karty", "Postreh AI o Kohútovi.", T0), "Súhlasím s tým.", T0);
      expect(() => nazory.skry(spravca, "nazor", nazorCloveka, "Kohút zanikol.", T0)).toThrow(/človeka sa neskrýva/);
      expect(() => nazory.skry(spravca, "komentar", komentarCloveka, "Kohút zanikol.", T0)).toThrow(/človeka sa neskrýva/);
      // Ani admin (človek) nie — obmedzenie je na autorovi, nie na tom, kto skrýva.
      const admin = ucet("subadmin");
      expect(() => nazory.skry(admin, "nazor", nazorCloveka, "Kohút zanikol.", T0)).toThrow(/človeka sa neskrýva/);
      expect(nazory.zoznam(clovek, "nove", { kategoria: null, skupina: null, ai: null }).map((n) => n.id)).toContain(nazorCloveka);
      expect(zaznamySkrytia(db)).toEqual([]);
    } finally {
      zmaz();
    }
  });

  it("skrytý AI názor a komentár hráči nevidia, správca ich má v archíve a vráti ich; každý krok je v zázname", () => {
    const { db, ucet, zmaz } = docasnaDb();
    try {
      const nazory = new Nazory(db);
      const spravca = ucet("subadmin", true);
      const clovek = ucet("hrac");
      const robot = ucet("hrac", true);
      const vsetky = { kategoria: null, skupina: null, ai: null } as const;
      const nazorAi = nazory.pridaj(robot, "pravidla", "Úplatok rozhoduje každú bitku.", T0, "Úplatok je silný");
      const nazorCloveka = nazory.pridaj(clovek, "karty", "Pohreb nechápem.", T0);
      const komentarAi = nazory.komentuj(robot, nazorCloveka, "Pohreb funguje takto…", T0);

      expect(() => nazory.skry(clovek, "nazor", nazorAi, "Úplatok zrušený.", T0)).toThrow(/admin/);
      expect(() => nazory.skry(spravca, "nazor", nazorAi, "  ", T0)).toThrow(/Dôvod/);
      nazory.skry(spravca, "nazor", nazorAi, "Úplatok zrušený vo v10.3.", T0 + 1);
      nazory.skry(spravca, "komentar", komentarAi, "Pohreb zrušený.", T0 + 2);
      expect(() => nazory.skry(spravca, "nazor", nazorAi, "znova", T0)).toThrow(/už je skrytý/);

      const zoznam = nazory.zoznam(clovek, "diskusia", vsetky);
      expect(zoznam.map((n) => n.id)).toEqual([nazorCloveka]);
      expect(zoznam[0]?.komentare).toEqual([]);
      expect(nazory.pocty(null).otvorene).toEqual({ ludia: 1, ai: 0 });
      expect(() => nazory.komentuj(clovek, nazorAi, "Ešte k tomu.", T0)).toThrow(/archíve/);

      expect(() => nazory.archiv(clovek)).toThrow(/admin/);
      const archiv = nazory.archiv(spravca);
      expect(archiv.map((p) => [p.druh, p.id, p.dovod, p.skryl])).toEqual([
        ["komentar", komentarAi, "Pohreb zrušený.", spravca.meno],
        ["nazor", nazorAi, "Úplatok zrušený vo v10.3.", spravca.meno],
      ]);
      expect(archiv[0]).toMatchObject({ nazor: nazorCloveka, text: "Pohreb funguje takto…" });

      nazory.vrat(spravca, "nazor", nazorAi, T0 + 3);
      nazory.vrat(spravca, "komentar", komentarAi, T0 + 4);
      expect(() => nazory.vrat(spravca, "nazor", nazorAi, T0)).toThrow(/nie je skrytý/);
      expect(nazory.zoznam(clovek, "nove", vsetky).map((n) => n.id).sort()).toEqual([nazorAi, nazorCloveka].sort());
      expect(nazory.archiv(spravca)).toEqual([]);

      const zaznamy = zaznamySkrytia(db);
      expect(zaznamy.map((z) => [z.druh, z.akcia, z.dovod, z.kto])).toEqual([
        ["komentar", "vrat", "Pohreb zrušený.", spravca.meno],
        ["nazor", "vrat", "Úplatok zrušený vo v10.3.", spravca.meno],
        ["komentar", "skry", "Pohreb zrušený.", spravca.meno],
        ["nazor", "skry", "Úplatok zrušený vo v10.3.", spravca.meno],
      ]);
      const zaloha = db.prepare("SELECT zaloha FROM archiv_zaznamy WHERE druh = 'nazor' AND akcia = 'skry'").get() as { zaloha: string };
      expect(JSON.parse(zaloha.zaloha)).toMatchObject({ nadpis: "Úplatok je silný", text: "Úplatok rozhoduje každú bitku." });
    } finally {
      zmaz();
    }
  });
});

describe("archív návrhov a reportov z playtestov", () => {
  it("archivovaný návrh ostáva so stavom, nečaká na rozhodnutie a dá sa vrátiť", () => {
    const { db, ucet, zmaz } = docasnaDb();
    try {
      const navrhy = new Navrhy(db);
      const spravca = ucet("subadmin", true);
      const [id] = navrhy.nahraj(spravca, { davka: "20261020-120000", navrhy: [NAVRH] }, T0);
      expect(navrhy.naRozhodnutie()).toBe(1);
      expect(() => navrhy.archivuj(ucet("hrac"), id as number, "Úplatok zrušený.", T0)).toThrow(/admin/);
      expect(() => navrhy.archivuj(spravca, id as number, "", T0)).toThrow(/Dôvod/);
      navrhy.archivuj(spravca, id as number, "Úplatok zrušený.", T0 + 1);
      expect(navrhy.zoznam()[0]).toMatchObject({ stav: "nove", archiv: { kedy: T0 + 1, dovod: "Úplatok zrušený.", kto: spravca.meno } });
      expect(navrhy.naRozhodnutie()).toBe(0);
      expect(() => navrhy.archivuj(spravca, id as number, "znova", T0)).toThrow(/už je v archíve/);
      navrhy.vratZArchivu(spravca, id as number, T0 + 2);
      expect(navrhy.zoznam()[0]?.archiv).toBeNull();
      expect(navrhy.naRozhodnutie()).toBe(1);
      expect(zaznamySkrytia(db).map((z) => [z.druh, z.kluc, z.akcia])).toEqual([
        ["navrh", String(id), "vrat"],
        ["navrh", String(id), "skry"],
      ]);
    } finally {
      zmaz();
    }
  });

  it("archivovaný report ostáva v zozname s dôvodom (klient ho štandardne skryje), súbor sa nemaže", () => {
    const { db, dir, ucet, zmaz } = docasnaDb();
    try {
      const reporty = join(dir, "reporty");
      mkdirSync(reporty);
      writeFileSync(join(reporty, "20261020-120000.html"), "<title>Turnus s Úplatkom</title>");
      const playtesty = new Playtesty(reporty, null, db);
      const spravca = ucet("subadmin", true);
      expect(playtesty.zoznam()[0]?.archiv).toBeNull();
      expect(() => playtesty.archivuj(ucet("hrac"), "20261020-120000.html", "Úplatok zrušený.", T0)).toThrow(/admin/);
      expect(() => playtesty.archivuj(spravca, "neexistuje.html", "Úplatok zrušený.", T0)).toThrow(/nie je/);
      playtesty.archivuj(spravca, "20261020-120000.html", "Hrané na pravidlách v9, Úplatok zrušený.", T0 + 1);
      expect(playtesty.zoznam()).toEqual([
        { subor: "20261020-120000.html", nazov: "Turnus s Úplatkom", cas: Date.UTC(2026, 9, 20, 12), druh: "report", archiv: { kedy: T0 + 1, dovod: "Hrané na pravidlách v9, Úplatok zrušený.", kto: spravca.meno } },
      ]);
      playtesty.vratZArchivu(spravca, "20261020-120000.html", T0 + 2);
      expect(playtesty.zoznam()[0]?.archiv).toBeNull();
      expect(() => playtesty.vratZArchivu(spravca, "20261020-120000.html", T0)).toThrow(/nie je v archíve/);
    } finally {
      zmaz();
    }
  });
});

describe("API upratania (admin.ts nazor-skry, navrh-archivuj, playtest-archivuj)", () => {
  let server: GameServer;
  let zmaz: () => Promise<void>;
  let admin: string;
  let agent: string;
  let hrac: string;
  let robot: string;
  const playtestyDir = mkdtempSync(join(tmpdir(), "naex-vypalit-reporty-"));

  async function volaj<T>(cookie: string, metoda: string, cesta: string, telo?: unknown): Promise<{ status: number; data: T }> {
    const res = await fetch(`http://127.0.0.1:${server.port}/api${cesta}`, {
      method: metoda,
      headers: { cookie, "x-naex": "1", ...(telo === undefined ? {} : { "content-type": "application/json" }) },
      body: telo === undefined ? undefined : JSON.stringify(telo),
    });
    return { status: res.status, data: (await res.json()) as T };
  }
  const nastavAi = async (cookie: string): Promise<void> => {
    const id = (await volaj<{ pouzivatel: { id: number } }>(cookie, "GET", "/ja")).data.pouzivatel.id;
    expect((await volaj(admin, "PATCH", `/admin/pouzivatelia/${id}`, { ai: true })).status).toBe(200);
  };

  beforeAll(async () => {
    writeFileSync(join(playtestyDir, "20261020-120000.html"), "<title>Report</title>");
    ({ server, zmaz } = await testovaciServer(TEST_ADMIN, { playtestyDir }));
    admin = await prihlas(server.port, TEST_ADMIN.login, TEST_ADMIN.heslo);
    agent = (await registruj(server.port)).cookie;
    await nastavUroven(server.port, admin, agent, "subadmin");
    await nastavAi(agent);
    hrac = (await registruj(server.port)).cookie;
    await nastavUroven(server.port, admin, hrac, "hrac");
    robot = (await registruj(server.port)).cookie;
    await nastavUroven(server.port, admin, robot, "hrac");
    await nastavAi(robot);
  });

  afterAll(async () => {
    await zmaz();
    rmSync(playtestyDir, { recursive: true, force: true });
  });

  it("ľudský názor aj komentár server odmietne (403), AI skryje a hráč ho už nedostane", async () => {
    const ludsky = (await volaj<{ id: number }>(hrac, "POST", "/nazory", { kategoria: "karty", text: "Kohút je super." })).data.id;
    const aiNazor = (await volaj<{ id: number }>(robot, "POST", "/nazory", { kategoria: "karty", text: "Kohút má posledné slovo." })).data.id;
    const ludskyKomentar = (await volaj<{ id: number }>(hrac, "POST", `/nazory/${aiNazor}/komentare`, { text: "Áno, Kohút." })).data.id;
    const aiKomentar = (await volaj<{ id: number }>(robot, "POST", `/nazory/${ludsky}/komentare`, { text: "Kohút vyhral bitku." })).data.id;

    expect((await volaj(agent, "POST", `/admin/nazory/${ludsky}/skry`, { dovod: "Kohút vyradený." })).status).toBe(403);
    expect((await volaj(admin, "POST", `/admin/komentare/${ludskyKomentar}/skry`, { dovod: "Kohút vyradený." })).status).toBe(403);
    expect((await volaj(hrac, "POST", `/admin/nazory/${aiNazor}/skry`, { dovod: "Kohút vyradený." })).status).toBe(403);
    expect((await volaj(agent, "POST", `/admin/nazory/${aiNazor}/skry`, {})).status).toBe(400);

    expect((await volaj(agent, "POST", `/admin/nazory/${aiNazor}/skry`, { dovod: "Kohút vyradený vo v9.2." })).status).toBe(200);
    expect((await volaj(agent, "POST", `/admin/komentare/${aiKomentar}/skry`, { dovod: "Kohút vyradený vo v9.2." })).status).toBe(200);
    const pohladHraca = (await volaj<{ nazory: { id: number; komentare: { id: number }[] }[] }>(hrac, "GET", "/nazory")).data.nazory;
    expect(pohladHraca.map((n) => n.id)).toEqual([ludsky]);
    expect(pohladHraca[0]?.komentare).toEqual([]);
    // Ani správca ich v bežnom zozname nemá — len v archíve.
    expect((await volaj<{ nazory: { id: number }[] }>(agent, "GET", "/nazory")).data.nazory.map((n) => n.id)).toEqual([ludsky]);
    expect((await volaj(hrac, "GET", "/admin/nazory-archiv")).status).toBe(403);
    const archiv = (await volaj<{ prispevky: { druh: string; id: number; dovod: string }[] }>(agent, "GET", "/admin/nazory-archiv")).data.prispevky;
    expect(archiv.map((p) => [p.druh, p.id])).toEqual([
      ["komentar", aiKomentar],
      ["nazor", aiNazor],
    ]);

    expect((await volaj(agent, "POST", `/admin/nazory/${aiNazor}/vrat`)).status).toBe(200);
    expect((await volaj<{ nazory: { id: number }[] }>(hrac, "GET", "/nazory")).data.nazory.map((n) => n.id).sort()).toEqual([ludsky, aiNazor].sort());
  });

  it("návrh a report: archív s dôvodom a návrat", async () => {
    const { ids } = (await volaj<{ ids: number[] }>(agent, "POST", "/admin/navrhy", { davka: "20261020-120000", navrhy: [NAVRH] })).data;
    const id = ids[0] as number;
    expect((await volaj(agent, "POST", `/admin/navrhy/${id}/archivuj`, { dovod: "" })).status).toBe(400);
    expect((await volaj(agent, "POST", `/admin/navrhy/${id}/archivuj`, { dovod: "Úplatok zrušený." })).status).toBe(200);
    expect((await volaj<{ naRozhodnutie: number }>(agent, "GET", "/admin/navrhy/pocet")).data.naRozhodnutie).toBe(0);
    const navrh = (await volaj<{ navrhy: { id: number; archiv: { dovod: string } | null }[] }>(agent, "GET", "/admin/navrhy")).data.navrhy.find((n) => n.id === id);
    expect(navrh?.archiv?.dovod).toBe("Úplatok zrušený.");
    expect((await volaj(agent, "POST", `/admin/navrhy/${id}/vrat`)).status).toBe(200);

    expect((await volaj(agent, "POST", "/admin/playtesty/archivuj", { subor: "20261020-120000.html", dovod: "Pravidlá v9." })).status).toBe(200);
    const reporty = (await volaj<{ reporty: { subor: string; archiv: { dovod: string } | null }[] }>(agent, "GET", "/admin/playtesty")).data.reporty;
    expect(reporty.find((r) => r.subor === "20261020-120000.html")?.archiv?.dovod).toBe("Pravidlá v9.");
    expect((await volaj(agent, "POST", "/admin/playtesty/vrat", { subor: "20261020-120000.html" })).status).toBe(200);
  });

  it("mená kariet zo zverejnených sád pre admin.ts zastarane", async () => {
    const { mena } = (await volaj<{ mena: { meno: string; poslednaVerzia: number }[] }>(agent, "GET", "/admin/sady/mena")).data;
    expect(Array.isArray(mena)).toBe(true);
    expect((await volaj(hrac, "GET", "/admin/sady/mena")).status).toBe(403);
  });
});

describe("kandidáti na skrytie (tools/admin/zastarane.ts)", () => {
  const konf = {
    mechaniky: [
      { pojem: "Úplatok", vzory: ["uplat(?:ok|k)"], pozn: "" },
      { pojem: "udržaný strach", vzory: ["udrzan\\w* strach"], pozn: "" },
    ],
    karty: [],
  };

  it("zaniknutá karta = v histórii sád, nie v tvorcovi; krátke mená a kmene živých kariet sa vynechajú", () => {
    expect(kmenMena("Injekcia")).toBe("injekci");
    expect(kmenMena("Silná nezávislá žena")).toBe("silna nezavisla zen");
    expect(zaniknuteKarty(["Kohút", "Lievik", "Farár", "Dlh", "Farára"], ["Farár", "Injekcia"])).toEqual(["Kohút", "Lievik"]);
  });

  it("nájde kartu aj v páde a mechaniku bez diakritiky, inak nič", () => {
    const co = hladane(konf, ["Kohút", "Injekcia"]);
    expect(zmienky("S Kohútom a Injekciou som Úplatkom vyhral; úplatok bol silný.", co)).toEqual([
      { pojem: "Úplatok", druh: "mechanika", pocet: 2 },
      { pojem: "Injekcia", druh: "karta", pocet: 1 },
      { pojem: "Kohút", druh: "karta", pocet: 1 },
    ]);
    expect(zmienky("Udržaný  strach u Farára.", co)).toEqual([{ pojem: "udržaný strach", druh: "mechanika", pocet: 1 }]);
    expect(zmienky("Farár hral Pecku, Puška sa neuplatní a Viera sa uplatní.", co)).toEqual([]);
  });

  it("text reportu bez značiek a skriptov", () => {
    expect(textZHtml("<style>.uplatok{}</style><p>Kohút&nbsp;&amp; <b>Úplatok</b></p><script>uplatok()</script>").replace(/\s+/g, " ").trim()).toBe("Kohút & Úplatok");
  });
});

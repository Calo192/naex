// Prehrávač partie (roadmapa #18): krok po kroku zo seedu a príkazov. Viditeľnosť
// (CLAUDE.md, pravidlo 2): účastník len zo svojho miesta, bez súperovej ruky
// a poradia balíčka; cudzí nič; správca si vyberie miesto.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ClientState } from "@naex/core";
import { otvorDb } from "../src/db.ts";
import { Obsah } from "../src/obsah.ts";
import { Media } from "../src/media.ts";
import { Prehravac } from "../src/prehravac.ts";
import type { GameServer } from "../src/server.ts";
import { TEST_ADMIN, prihlas, registruj, testovaciServer } from "./pomocnik.ts";
import { Robot } from "./robot.ts";

// Pevné rozdanie: partia (a s ňou kontrola viditeľnosti) je pri každom behu rovnaká.
// Seed je vybraný tak, že karta z línie bitky sa cez odhadzovací balíček vráti
// Eve do ruky — test tak overuje aj to, že verejne známa karta nie je únik.
const SEED = 26;

let server: GameServer;
let zmaz: () => Promise<void>;
beforeAll(async () => {
  ({ server, zmaz } = await testovaciServer(TEST_ADMIN, { seedRozdania: SEED }));
});
afterAll(async () => {
  await zmaz();
});

const volaj = async <T>(cookie: string, cesta: string): Promise<{ status: number; data: T }> => {
  const res = await fetch(`http://127.0.0.1:${server.port}/api${cesta}`, { headers: { cookie, "x-naex": "1" } });
  return { status: res.status, data: (await res.json()) as T };
};
/** Všetky uid kariet v odpovedi — podľa štruktúry, nie hľadaním v texte. */
const uidy = (o: unknown, out = new Set<number>()): Set<number> => {
  if (Array.isArray(o)) for (const x of o) uidy(x, out);
  else if (o !== null && typeof o === "object") {
    for (const [k, v] of Object.entries(o)) {
      if (k === "uid" && typeof v === "number") out.add(v);
      else uidy(v, out);
    }
  }
  return out;
};
const cakaj = async (podmienka: () => boolean | Promise<boolean>): Promise<void> => {
  for (let i = 0; i < 400; i++) {
    if (await podmienka()) return;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error("nedočkal som sa");
};

describe("prehrávač partie", () => {
  it("účastník prehrá partiu zo svojho miesta bez súperovej ruky; cudzí nič; správca vyberie miesto", async () => {
    const admin = await prihlas(server.port, TEST_ADMIN.login, TEST_ADMIN.heslo);
    const jano = (await registruj(server.port)).cookie;
    const eva = (await registruj(server.port)).cookie;
    const cudzi = (await registruj(server.port)).cookie;
    const a = new Robot(server.port, jano);
    const b = new Robot(server.port, eva);
    await a.otvorene();
    await b.otvorene();
    a.posli({ type: "create" });
    await cakaj(() => a.privitanie.code !== undefined);
    b.posli({ type: "join", code: a.privitanie.code });
    await cakaj(() => a.view !== null && b.view !== null);
    // Pár desiatok legálnych ťahov, potom sa Eva vzdá — partia ide do archívu so seedom a príkazmi.
    for (let i = 0; i < 30; i++) {
      const r = [a, b].find((x) => x.view?.mozemHrat === true && x.view.koniec === null);
      if (r === undefined) break;
      const pred = r.pocetStavov;
      r.posli({ type: "cmd", cmd: r.vyberTah() });
      await cakaj(() => r.pocetStavov > pred || r.chyby.length > 0);
      r.chyby.splice(0);
    }
    b.posli({ type: "cmd", cmd: { type: "vzdat" } });
    const idJano = (await volaj<{ pouzivatel: { id: number } }>(jano, "/ja")).data.pouzivatel.id;
    await cakaj(async () => (await volaj<{ pocet: number }>(jano, `/hraci/${idJano}/partie`)).data.pocet === 1);
    const partia = (await volaj<{ partie: { id: number }[] }>(jano, `/hraci/${idJano}/partie`)).data.partie[0]!.id;
    a.zavri();
    b.zavri();

    type Zoznam = { pocet: number; dostupny: boolean; ja: number | null; kroky: { n: number; miesto: number; typ: string | null }[] };
    const zoznam = await volaj<Zoznam>(jano, `/partie/${partia}/kroky`);
    expect(zoznam.status).toBe(200);
    expect(zoznam.data.dostupny).toBe(true);
    expect(zoznam.data.pocet).toBeGreaterThan(5);
    const ja = zoznam.data.ja!;
    // Typ súperovho príkazu (napr. výber pri stavbe šenku) účastník nedostane.
    expect(zoznam.data.kroky.filter((k) => k.miesto !== ja).every((k) => k.typ === null)).toBe(true);
    expect(zoznam.data.kroky.filter((k) => k.miesto === ja).every((k) => k.typ !== null)).toBe(true);

    type Krok = { n: number; miesto: number; view: ClientState; koniec: boolean };
    const posledny = await volaj<Krok>(jano, `/partie/${partia}/krok/${zoznam.data.pocet}`);
    expect(posledny.data).toMatchObject({ koniec: true, miesto: ja });
    // Prehratý koniec = archivovaný: Eva sa vzdala, vyhral Jano.
    expect((posledny.data.view as unknown as { koniec: { vitaz: number } }).koniec.vitaz).toBe(ja);
    // Krok po kroku: účastník dostane presne pohľad zo svojho miesta, hoci žiada iné — bez súperovej
    // ruky a kariet balíčkov. Karta, ktorá už ležala odkrytá (napr. v línii bitky a cez odhadzovací
    // balíček sa vrátila súperovi do ruky), je verejne známa; únik je len karta zo súperovej ruky,
    // ktorú účastník predtým mimo nej nikdy nevidel.
    const superMiesto = ja === 0 ? 1 : 0;
    const videne = new Set<number>();
    for (let n = 0; n <= zoznam.data.pocet; n++) {
      const moj = await volaj<Krok>(jano, `/partie/${partia}/krok/${n}?miesto=${superMiesto}`);
      expect(moj.status).toBe(200);
      expect(moj.data.miesto).toBe(ja);
      expect(moj.data).toEqual((await volaj<Krok>(admin, `/partie/${partia}/krok/${n}?miesto=${ja}`)).data);
      const jeho = await volaj<Krok>(admin, `/partie/${partia}/krok/${n}?miesto=${superMiesto}`);
      expect(jeho.data.miesto).toBe(superMiesto);
      const jehoRuka = new Set(jeho.data.view.ruka.map((k) => k.uid));
      const vOdpovedi = uidy(moj.data);
      expect([...jehoRuka].filter((u) => vOdpovedi.has(u) && !videne.has(u)), `únik v kroku ${n}`).toEqual([]);
      for (const u of uidy(moj.data.view)) if (!jehoRuka.has(u)) videne.add(u);
      const text = JSON.stringify(moj.data);
      expect(text).not.toContain("\"doberaci\":");
      expect(text).not.toContain("\"spolocnyBalicek\":");
    }
    expect((await volaj(cudzi, `/partie/${partia}/kroky`)).status).toBe(404);
    expect((await volaj(cudzi, `/partie/${partia}/krok/1`)).status).toBe(404);
    expect((await volaj(jano, `/partie/${partia}/krok/-1`)).status).toBe(400);
  }, 60_000);
});

describe("prehrávač — iná verzia jadra", () => {
  it("partiu z inej verzie jadra prehrať nemožno, povie prečo", () => {
    const dir = mkdtempSync(join(tmpdir(), "naex-prehravac-"));
    const db = otvorDb(join(dir, "naex.db"));
    try {
      const obsah = new Obsah(db, new Media(db, dir));
      obsah.naplnAkTreba(0);
      db.prepare("INSERT INTO pouzivatelia (id, login, heslo, meno, rola, vytvoreny) VALUES (5, 'jano', 'x', 'Jano', 'hrac', 0)").run();
      const r = db
        .prepare("INSERT INTO partie (kod, zaciatok, koniec, vitaz, dovod, kola, verzia_sady, dohrata, seed, prikazy, verzia_jadra, dlzka) VALUES ('X', 0, 1, 0, 'test', 1, 1, 1, 7, '[]', 'stary', 'kratka')")
        .run();
      const id = Number(r.lastInsertRowid);
      db.prepare("INSERT INTO partie_hraci (partia, miesto, pouzivatel, vysledok, frajerina_pred, frajerina_po, statistiky) VALUES (?, 0, 5, 'vyhra', 0, 0, '{}')").run(id);
      const p = new Prehravac(db, obsah, "novy");
      expect(p.kroky(id, 5, false)).toMatchObject({ dostupny: false, dovod: expect.stringMatching(/inej verzii/) });
      expect(p.krok(id, 0, 5, false, null)).toMatchObject({ chyba: expect.stringMatching(/inej verzii/) });
      expect(p.kroky(id, 6, false)).toBeNull();
      // Na tej istej verzii a sade sa rozdanie prehrá.
      const rovnaka = new Prehravac(db, obsah, "stary");
      expect(rovnaka.krok(id, 0, 5, false, null)).toMatchObject({ n: 0, miesto: 0, koniec: false });
    } finally {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

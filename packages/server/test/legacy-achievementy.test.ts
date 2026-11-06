// Legacy achievementy (Michal 2026-11-06): hráčom sa nikdy nič neodoberá. Achievement, ktorý
// sa stane nedosiahnuteľným, ostáva držiteľom so značkou a nikto iný sa o ňom nedozvie;
// výhry nad vyradenými povahami sa nerátajú do achievementov povah v hre.

import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  POVAHY,
  VYRADENE_POVAHY,
  apply,
  legalCommands,
  loadGameData,
  naTahu,
  rngInt,
  rngSeed,
  setupGame,
  type Command,
  type GameState,
  type KatalogAchievementov,
} from "@naex/core";
import { Achievementy, nacitajKatalog } from "../src/achievementy.ts";
import { Ucty } from "../src/auth.ts";
import { otvorDb } from "../src/db.ts";
import { Ligy } from "../src/ligy.ts";
import { PREDVOLENE_PRAVA, dalsiRank } from "../src/prava.ts";
import { createGameServer, type GameServer } from "../src/server.ts";
import { TEST_ADMIN, registruj } from "./pomocnik.ts";

const citaj = (subor: string): unknown => JSON.parse(readFileSync(fileURLToPath(new URL(`../../core/data/${subor}`, import.meta.url)), "utf8"));
const data = loadGameData(citaj("cards.json"), citaj("elders.json"), citaj("scorecards.json"));
const katalog = nacitajKatalog();
const LEGACY = ["stamgast-pod-stolom", "fero-umlcany", "gizka-bez-reci"];
/** Hviezdy získateľných achievementov: 189 pôvodných − 9 starých povah + 12 nových. */
const SPOLU = 192;
const POSTUP = PREDVOLENE_PRAVA.postup;

type Db = ReturnType<typeof otvorDb>;

function docasnaDb(): { db: Db; zmaz: () => void } {
  const dir = mkdtempSync(join(tmpdir(), "naex-legacy-"));
  const db = otvorDb(join(dir, "naex.sqlite"));
  return {
    db,
    zmaz: () => {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

function dajRanky(db: Db, pouzivatel: number, achievement: string, rankov: number, cas: number): void {
  const vloz = db.prepare("INSERT INTO achievementy_zisky (pouzivatel, achievement, rank, ziskane, miestnost, partia) VALUES (?, ?, ?, ?, 'stara', 7)");
  for (let r = 1; r <= rankov; r++) vloz.run(pouzivatel, achievement, r, cas);
}

/** Výhry nad povahami tak, ako ich zapisoval starý server (množina porazených). */
function porazene(db: Db, pouzivatel: number, povahy: readonly string[]): void {
  const vloz = db.prepare("INSERT INTO achievementy_rozne (pouzivatel, proti, kluc, stitok) VALUES (?, ?, 'porazenePovahy|rozne', ?)");
  for (const p of povahy) for (const proti of ["bot", "vsetky"]) vloz.run(pouzivatel, proti, p);
}

/** Priebeh náhodnej partie zo semienka (bez vzdania); víťaz je vždy ten istý. */
function partia(seed: number): { kroky: [GameState, Command, 0 | 1, GameState, ReturnType<typeof apply>["events"]][]; vitaz: number | null } {
  let s = setupGame(data, seed);
  let rng = rngSeed(seed);
  const kroky: [GameState, Command, 0 | 1, GameState, ReturnType<typeof apply>["events"]][] = [];
  for (let i = 0; i < 6000 && s.koniec === null; i++) {
    const p = naTahu(s);
    if (p === null) break;
    const cmds = legalCommands(data, s, p).filter((c) => c.type !== "vzdat");
    const [j, r] = rngInt(rng, cmds.length);
    rng = r;
    const cmd = cmds[j] as Command;
    const { state: po, events } = apply(data, s, cmd, p);
    kroky.push([s, cmd, p, po, events]);
    s = po;
  }
  return { kroky, vitaz: s.koniec?.vitaz ?? null };
}

/** Partia, v ktorej vyhrá človek na mieste 0. */
const VYHRA = (() => {
  for (let seed = 1; seed < 200; seed++) {
    const p = partia(seed);
    if (p.vitaz === 0) return p.kroky;
  }
  throw new Error("Žiadne semienko s výhrou hráča 0.");
})();

/** Hráč vyhrá nad botom danej povahy; vráti všetky oznamy zo servera. */
function vyhrajNad(a: Achievementy, pouzivatel: number, povaha: string, cas: number): { id: string; rank: number }[] {
  const am = a.zacni([{ id: pouzivatel, ai: false }, null], povaha);
  const out: { id: string; rank: number }[] = [];
  for (const [pred, cmd, autor, po, udalosti] of VYHRA) {
    const { zisky } = a.poKroku(am, data, pred, cmd, autor, po, udalosti, `m-${povaha}-${cas}`, cas);
    out.push(...zisky[0].map((z) => ({ id: z.id, rank: z.rank })));
  }
  return out;
}

const polozka = (a: Achievementy, hrac: number, id: string) => a.vitrina(hrac).achievementy.find((x) => x.id === id);

describe("legacy achievementy — katalóg", () => {
  it("povahy mimo hry majú legacy achievement, každá povaha v hre vlastný získateľný", () => {
    expect(katalog.achievementy.filter((a) => a.legacy).map((a) => a.id)).toEqual(LEGACY);
    for (const p of VYRADENE_POVAHY) {
      expect(katalog.achievementy.find((a) => a.metrika === `vyhraNad.${p.id}`)?.legacy, p.id).toBe(true);
    }
    for (const p of POVAHY) {
      const a = katalog.achievementy.find((x) => x.metrika === `vyhraNad.${p.id}`);
      expect(a, p.id).toMatchObject({ legacy: false, rozsah: "kariera", proti: "bot", kategoria: "bot", prahy: [1, 5, 20] });
    }
  });

  it("Celá krčma: najvyšší prah = všetky povahy v hre", () => {
    const krcma = katalog.achievementy.find((a) => a.id === "cela-krcma");
    expect(krcma?.prahy).toEqual([1, 2, POVAHY.length]);
    expect(krcma?.popis).toContain(`zo ${POVAHY.length}`);
  });
});

describe("legacy achievementy — hráči", () => {
  it("držiteľ si zachová rank aj dátum a má značku; nedržiteľ ho nevidí ani v počte", () => {
    const { db, zmaz } = docasnaDb();
    try {
      const ucty = new Ucty(db, { login: "Admin", heslo: null });
      const jano = ucty.registruj("jano", "tajneheslo", "Jano", 1);
      const eva = ucty.registruj("eva", "tajneheslo", "Eva", 1);
      dajRanky(db, jano.id, "stamgast-pod-stolom", 2, 1234);
      const a = new Achievementy(db, katalog);

      const jeho = polozka(a, jano.id, "stamgast-pod-stolom");
      expect(jeho).toMatchObject({ legacy: true, rank: 2, nazov: "Štamgast pod stolom", postup: null, prahy: [1, 5, 20] });
      expect(jeho?.ziskane).toEqual([
        { rank: 1, ziskane: 1234, partia: 7 },
        { rank: 2, ziskane: 1234, partia: 7 },
      ]);

      const jehoVitrina = a.vitrina(jano.id).achievementy;
      const jejVitrina = a.vitrina(eva.id).achievementy;
      expect(jehoVitrina.length).toBe(jejVitrina.length + 1);
      for (const id of LEGACY) expect(jejVitrina.some((x) => x.id === id), id).toBe(false);
      expect(JSON.stringify(jejVitrina)).not.toContain("Štamgast pod stolom");
      // Legacy, ktorý Jano nemá, nevidí ani on.
      expect(jehoVitrina.some((x) => x.id === "fero-umlcany")).toBe(false);
    } finally {
      zmaz();
    }
  });

  it("nový hráč ho nezíska, ani keď vyhrá nad vyradenou povahou (rozohraná partia pri nasadení)", () => {
    const { db, zmaz } = docasnaDb();
    try {
      const ucty = new Ucty(db, { login: "Admin", heslo: null });
      const jano = ucty.registruj("jano", "tajneheslo", "Jano", 1);
      const a = new Achievementy(db, katalog);
      const zisky = vyhrajNad(a, jano.id, "stamgast", 10).map((z) => z.id);
      for (const id of [...LEGACY, "cela-krcma"]) expect(zisky, id).not.toContain(id);
      expect(a.drzane(jano.id).has("stamgast-pod-stolom")).toBe(false);
      expect(a.drzane(jano.id).has("cela-krcma")).toBe(false);
      const kariera = db.prepare("SELECT kluc FROM achievementy_kariera WHERE pouzivatel = ? AND kluc LIKE 'vyhraNad%'").all(jano.id);
      expect(kariera).toEqual([]);
    } finally {
      zmaz();
    }
  });

  it("výhra nad povahou v hre dá jej achievement a držiteľ legacy o nič nepríde", () => {
    const { db, zmaz } = docasnaDb();
    try {
      const ucty = new Ucty(db, { login: "Admin", heslo: null });
      const jano = ucty.registruj("jano", "tajneheslo", "Jano", 1);
      dajRanky(db, jano.id, "fero-umlcany", 3, 500);
      const a = new Achievementy(db, katalog);
      const zisky = vyhrajNad(a, jano.id, "igor", 1000);
      expect(zisky).toContainEqual({ id: "igor-v-jarku", rank: 1 });
      expect(zisky.map((z) => z.id)).not.toContain("fero-umlcany");
      expect(polozka(a, jano.id, "fero-umlcany")).toMatchObject({ rank: 3, legacy: true });
      expect(polozka(a, jano.id, "fero-umlcany")?.ziskane.map((z) => z.ziskane)).toEqual([500, 500, 500]);
    } finally {
      zmaz();
    }
  });

  it("achievementy nových povah idú po sebe a výhry nad starými sa do nich nerátajú", () => {
    const { db, zmaz } = docasnaDb();
    try {
      const ucty = new Ucty(db, { login: "Admin", heslo: null });
      const jano = ucty.registruj("jano", "tajneheslo", "Jano", 1);
      // V archíve má porazené všetky tri staré povahy, achievement nedostal (napr. ešte nebol zapnutý).
      porazene(db, jano.id, ["stamgast", "rapavy_fero", "teta_gizka"]);
      const a = new Achievementy(db, katalog);
      expect(polozka(a, jano.id, "cela-krcma")).toMatchObject({ rank: 0, postup: { hodnota: 0, aktualna: null } });
      expect(a.drzane(jano.id).has("cela-krcma")).toBe(false);

      const krcma: number[] = [];
      for (const [i, p] of POVAHY.entries()) {
        const zisky = vyhrajNad(a, jano.id, p.id, 2000 + i);
        for (const z of zisky) if (z.id === "cela-krcma") krcma.push(z.rank);
        expect(polozka(a, jano.id, "cela-krcma")?.postup?.hodnota, p.id).toBe(i + 1);
      }
      // Nový prah je 1, 2, 4: tretia povaha ešte nič nedá, štvrtá dá zlato.
      expect(krcma).toEqual([1, 2, 3]);
      expect(polozka(a, jano.id, "cela-krcma")?.ziskane.map((z) => [z.rank, z.ziskane])).toEqual([
        [1, 2000],
        [2, 2001],
        [3, 2003],
      ]);
      // Staré štítky v databáze ostávajú, len sa nerátajú.
      expect(db.prepare("SELECT COUNT(*) AS n FROM achievementy_rozne WHERE pouzivatel = ? AND stitok = 'stamgast'").get(jano.id)).toEqual({ n: 2 });
    } finally {
      zmaz();
    }
  });

  it("Celá krčma podľa starej definície (3 z 3): zlato aj dátum ostávajú, nič sa nezníži ani neopakuje", () => {
    const { db, zmaz } = docasnaDb();
    try {
      const ucty = new Ucty(db, { login: "Admin", heslo: null });
      const stary = ucty.registruj("stary", "tajneheslo", "Starý", 1);
      const stredny = ucty.registruj("stredny", "tajneheslo", "Stredný", 1);
      dajRanky(db, stary.id, "cela-krcma", 3, 111);
      porazene(db, stary.id, ["stamgast", "rapavy_fero", "teta_gizka"]);
      dajRanky(db, stredny.id, "cela-krcma", 2, 222);
      porazene(db, stredny.id, ["stamgast", "rapavy_fero"]);
      const a = new Achievementy(db, katalog);
      expect(a.hviezdy(stary.id).hviezdy).toBe(3);

      for (const hrac of [stary, stredny]) {
        const zisky = vyhrajNad(a, hrac.id, "igor", 900).map((z) => z.id);
        expect(zisky).not.toContain("cela-krcma");
      }
      expect(polozka(a, stary.id, "cela-krcma")).toMatchObject({ rank: 3, legacy: false });
      expect(polozka(a, stary.id, "cela-krcma")?.ziskane.map((z) => [z.rank, z.ziskane])).toEqual([
        [1, 111],
        [2, 111],
        [3, 111],
      ]);
      // Striebro ostáva a ďalšie treba podľa nového: všetky štyri povahy v hre.
      expect(polozka(a, stredny.id, "cela-krcma")).toMatchObject({ rank: 2, postup: { hodnota: 1, aktualna: null }, prahy: [1, 2, 4] });
      for (const [i, p] of POVAHY.slice(1).entries()) vyhrajNad(a, stredny.id, p.id, 950 + i);
      expect(polozka(a, stredny.id, "cela-krcma")?.rank).toBe(3);
      expect(polozka(a, stredny.id, "cela-krcma")?.ziskane.map((z) => z.ziskane)).toEqual([222, 222, 952]);
    } finally {
      zmaz();
    }
  });

  it("hviezdy: legacy sa držiteľovi rátajú, prahy rankov sú pre všetkých rovnaké a nikoho neznížia", () => {
    const { db, zmaz } = docasnaDb();
    try {
      const ucty = new Ucty(db, { login: "Admin", heslo: null });
      const jano = ucty.registruj("jano", "tajneheslo", "Jano", 1);
      const eva = ucty.registruj("eva", "tajneheslo", "Eva", 1);
      dajRanky(db, jano.id, "stamgast-pod-stolom", 3, 1);
      dajRanky(db, jano.id, "gizka-bez-reci", 1, 1);
      const a = new Achievementy(db, katalog);
      ucty.pouziHviezdy((id) => a.hviezdy(id));
      expect(a.hviezdy(jano.id)).toEqual({ hviezdy: 4, spolu: SPOLU });
      expect(a.legacyHviezdy(jano.id)).toBe(4);
      expect(a.hviezdy(eva.id)).toEqual({ hviezdy: 0, spolu: SPOLU });
      expect(a.legacyHviezdy(eva.id)).toBe(0);
      expect(dalsiRank(POSTUP, "hrac", a.hviezdy(jano.id))).toEqual(dalsiRank(POSTUP, "hrac", a.hviezdy(eva.id)));

      // Sedmička získaná za staré hviezdy ostáva, aj keď sa prahy posunuli.
      db.prepare("UPDATE pouzivatelia SET rola = 'sedmicka' WHERE id = ?").run(jano.id);
      ucty.prepocitajRanky(POSTUP);
      expect(ucty.podlaId(jano.id)?.rola).toBe("sedmicka");
    } finally {
      zmaz();
    }
  });

  it("prechod katalógu: rovnaká databáza pod starým a novým katalógom; Zrejúca: zrkadlený účet drží svoje", () => {
    const { db, zmaz } = docasnaDb();
    try {
      const ucty = new Ucty(db, { login: "Admin", heslo: null });
      const u = { login: "jano", meno: "Jano", rola: "sedmicka", ai: false, avatar: null, pohlavie: null } as const;
      const jano = ucty.zrkadli(u, 1);
      dajRanky(db, jano.id, "stamgast-pod-stolom", 2, 77);
      dajRanky(db, jano.id, "cela-krcma", 3, 78);
      porazene(db, jano.id, ["stamgast", "rapavy_fero", "teta_gizka"]);

      // Vypálená pred prechodom: starý katalóg (žiadne legacy, Celá krčma z 3).
      const stary: KatalogAchievementov = {
        ...katalog,
        achievementy: katalog.achievementy
          .filter((a) => POVAHY.every((p) => a.metrika !== `vyhraNad.${p.id}`))
          .map((a) => ({ ...a, legacy: false, prahy: a.id === "cela-krcma" ? [1, 2, 3] : a.prahy })),
      };
      const pred = new Achievementy(db, stary);
      const predVitrina = pred.vitrina(jano.id).achievementy;
      expect(predVitrina.find((a) => a.id === "cela-krcma")?.rank).toBe(3);

      // Po prechode: bez migrácie, rovnaké riadky, rovnaké dátumy.
      const riadky = db.prepare("SELECT * FROM achievementy_zisky ORDER BY achievement, rank").all();
      const po = new Achievementy(db, katalog);
      for (const id of ["stamgast-pod-stolom", "cela-krcma"]) {
        const a = po.vitrina(jano.id).achievementy.find((x) => x.id === id);
        const b = predVitrina.find((x) => x.id === id);
        expect(a?.rank, id).toBe(b?.rank);
        expect(a?.ziskane, id).toEqual(b?.ziskane);
      }
      expect(db.prepare("SELECT * FROM achievementy_zisky ORDER BY achievement, rank").all()).toEqual(riadky);

      // Zrejúca každú reláciu zrkadlí účet z Vypálenej: rovnaké id, nič nezmizne.
      const znova = ucty.zrkadli({ ...u, meno: "Janko", rola: "deci" }, 2);
      expect(znova.id).toBe(jano.id);
      expect(po.vitrina(znova.id).achievementy.find((x) => x.id === "stamgast-pod-stolom")).toMatchObject({ rank: 2, legacy: true });
    } finally {
      zmaz();
    }
  });

  it("Ligy: legacy sa neponúka, nedá sa nastaviť, držiteľovi odomkne a od ostatných sa nepýta", () => {
    const { db, zmaz } = docasnaDb();
    try {
      const ucty = new Ucty(db, { login: "Admin", heslo: null });
      const a = new Achievementy(db, katalog);
      const ligy = new Ligy(db, () => 1, a);
      const ponuka = ligy.ponukaAchievementov()?.map((x) => x.id) ?? [];
      for (const id of LEGACY) expect(ponuka, id).not.toContain(id);
      expect(ponuka).toContain("igor-v-jarku");
      expect(() => ligy.uloz({ rola: "admin" }, { ligy: { dlha: { podmienka: null, achievement: { id: "fero-umlcany", rank: 1 }, ranky: [] } } })).toThrow(/nedá získať/);

      // Pravidlo uložené pred vyradením: nech ho admin nastavil na Fera.
      ligy.uloz({ rola: "admin" }, { vsetkym: false, ligy: { dlha: { podmienka: { liga: "stredna", vyhier: 3 }, achievement: { id: "maraton", rank: 1 }, ranky: [] } } });
      db.prepare("UPDATE nastavenia SET data = replace(data, '\"maraton\"', '\"fero-umlcany\"') WHERE kluc = 'ligy'").run();
      const jano = ucty.registruj("jano", "tajneheslo", "Jano", 1);
      const eva = ucty.registruj("eva", "tajneheslo", "Eva", 1);
      dajRanky(db, jano.id, "fero-umlcany", 1, 1);
      expect(ligy.stav(jano).find((s) => s.liga === "dlha")).toMatchObject({ smie: true, pristup: "odomknuta" });
      const eviny = ligy.stav(eva).find((s) => s.liga === "dlha");
      expect(eviny?.smie).toBe(false);
      expect(eviny?.podmienka).not.toContain("Rapavý Fero");
      expect(eviny?.podmienka).toContain("Vyhraj 3");
    } finally {
      zmaz();
    }
  });
});

describe("legacy achievementy — API", () => {
  let server: GameServer;
  let db: Db;
  let dir: string;

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), "naex-legacy-api-"));
    server = await createGameServer({ port: 0, dataDir: dir, admin: TEST_ADMIN, staticDir: join(dir, "nic"), achievementyZapnute: true });
    db = otvorDb(join(dir, "naex.sqlite"));
  });

  afterAll(async () => {
    db.close();
    await server.close();
    rmSync(dir, { recursive: true, force: true });
  });

  const api = async <T>(cookie: string, cesta: string): Promise<T> =>
    (await (await fetch(`http://127.0.0.1:${server.port}/api${cesta}`, { headers: { cookie, "x-naex": "1" } })).json()) as T;

  type Profil = {
    achievementy: { achievementy: { id: string; legacy: boolean; rank: number }[] } | null;
    postupRanku: { hviezdy: number; spolu: number } | null;
  };

  it("vlastný aj cudzí profil držiteľa ukáže značku; cudzí účet legacy nedostane, „z N“ rastie len držiteľovi", async () => {
    const drzitel = await registruj(server.port);
    const iny = await registruj(server.port);
    const idDrzitela = (await api<{ pouzivatel: { id: number } }>(drzitel.cookie, "/ja")).pouzivatel.id;
    const idIneho = (await api<{ pouzivatel: { id: number } }>(iny.cookie, "/ja")).pouzivatel.id;
    dajRanky(db, idDrzitela, "stamgast-pod-stolom", 2, 42);

    const vlastny = await api<Profil>(drzitel.cookie, `/hraci/${idDrzitela}`);
    expect(vlastny.achievementy?.achievementy.find((a) => a.id === "stamgast-pod-stolom")).toMatchObject({ legacy: true, rank: 2 });
    expect(vlastny.postupRanku).toMatchObject({ hviezdy: 2, spolu: SPOLU + 2 });

    const cudzi = await api<Profil>(iny.cookie, `/hraci/${idDrzitela}`);
    expect(cudzi.achievementy?.achievementy.find((a) => a.id === "stamgast-pod-stolom")).toMatchObject({ legacy: true, rank: 2 });

    const moj = await api<Profil>(iny.cookie, `/hraci/${idIneho}`);
    expect(moj.achievementy?.achievementy.some((a) => a.legacy)).toBe(false);
    expect(moj.postupRanku).toMatchObject({ hviezdy: 0, spolu: SPOLU });
    expect(moj.achievementy?.achievementy.length).toBe((vlastny.achievementy?.achievementy.length ?? 0) - 1);
  });
});

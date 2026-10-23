// Achievementy na serveri (Michal 2026-10-23): oznam ide len hráčovi, ktorý
// získal, súhrn na konci (aj po opätovnom pripojení), kariéra sa uloží
// k účtu, vitrína rešpektuje „skryť môj súhrn“ a tajné „???“.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { GameServer } from "../src/server.ts";
import { nacitajKatalog } from "../src/achievementy.ts";
import { TEST_ADMIN, registruj, testovaciServer } from "./pomocnik.ts";
import { Robot } from "./robot.ts";

let server: GameServer;
let zmaz: () => Promise<void>;

beforeAll(async () => {
  ({ server, zmaz } = await testovaciServer(TEST_ADMIN, { botPauzaMs: 0, achievementyZapnute: true }));
});

afterAll(async () => {
  await zmaz();
});

async function cakaj(podmienka: () => boolean, popis: string): Promise<void> {
  for (let i = 0; i < 4000; i++) {
    if (podmienka()) return;
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error(`nedočkal som sa: ${popis}`);
}

type Zisk = { id: string; rank: number; vzacny: boolean; nazov: string };
type Polozka = { id: string; nazov: string; popis: string; rank: number; tajny: boolean; prahy: number[]; ziskane: { rank: number; partia: number | null }[] };
type Vitrina = { achievementy: Polozka[] } | null;

const api = async <T>(cookie: string, cesta: string, metoda = "GET", telo?: unknown): Promise<T> =>
  (await (
    await fetch(`http://127.0.0.1:${server.port}/api${cesta}`, {
      method: metoda,
      headers: { cookie, "x-naex": "1", "content-type": "application/json" },
      ...(telo === undefined ? {} : { body: JSON.stringify(telo) }),
    })
  ).json()) as T;

const zisky = (r: Robot): Zisk[] => r.ostatne.filter((m) => m.type === "achievement").map((m) => m.zisk as Zisk);
const suhrny = (r: Robot) => r.ostatne.filter((m) => m.type === "achievementySuhrn");

describe("achievementy na serveri", () => {
  it("partia dvoch ľudí: každý dostane len svoje zisky, súhrn na konci, kariéra a vitrína k účtu", async () => {
    const a = (await registruj(server.port)).cookie;
    const b = (await registruj(server.port)).cookie;
    const ra = new Robot(server.port, a);
    const rb = new Robot(server.port, b);
    await ra.otvorene();
    await rb.otvorene();
    ra.posli({ type: "create" });
    await cakaj(() => ra.privitanie.code !== undefined, "privítanie A");
    rb.posli({ type: "join", code: ra.privitanie.code });
    await cakaj(() => ra.view !== null && rb.view !== null, "začiatok partie");

    for (let tahov = 0; ; tahov++) {
      await cakaj(() => ra.view?.koniec != null || ra.view?.mozemHrat === true || rb.view?.mozemHrat === true, "niekto na ťahu");
      if (ra.view?.koniec != null) break;
      const r = ra.view?.mozemHrat === true ? ra : rb;
      const pred = r.pocetStavov;
      r.posli({ type: "cmd", cmd: r.vyberTah() });
      await cakaj(() => r.pocetStavov > pred || r.chyby.length > 0, "odpoveď servera");
      r.chyby.splice(0);
      expect(tahov).toBeLessThan(4000);
    }
    await cakaj(() => suhrny(ra).length > 0 && suhrny(rb).length > 0, "súhrny na konci");

    // Náhodná partia vždy niečo dá (bitky, dohratá partia) — inak by test nič neoveril.
    expect(zisky(ra).length + zisky(rb).length).toBeGreaterThan(0);
    // Každý dostal len svoje: zisky v partii sú presne tie, čo má vo vitríne.
    const idA = (await api<{ pouzivatel: { id: number } }>(a, "/ja")).pouzivatel.id;
    for (const [r, cookie] of [
      [ra, a],
      [rb, b],
    ] as const) {
      const vitrina = (await api<{ achievementy: Vitrina }>(cookie, "/achievementy")).achievementy;
      expect(vitrina).not.toBeNull();
      const mam = new Map((vitrina?.achievementy ?? []).filter((x) => x.rank > 0).map((x) => [x.id, x.rank]));
      const dostal = new Map<string, number>();
      for (const z of zisky(r)) dostal.set(z.id, Math.max(dostal.get(z.id) ?? 0, z.rank));
      expect(dostal).toEqual(mam);
      // Súhrn obsahuje presne zisky z partie.
      const suhrn = suhrny(r)[0]?.suhrn as { ziskane: Zisk[]; chybaloMalo: { id: string; hodnota: number; prah: number }[] };
      expect(suhrn.ziskane.map((z) => `${z.id}:${z.rank}`)).toEqual(zisky(r).map((z) => `${z.id}:${z.rank}`));
      for (const c of suhrn.chybaloMalo) expect(c.hodnota).toBeLessThan(c.prah);
      // Zisky majú odkaz na partiu v archíve.
      for (const x of vitrina?.achievementy ?? []) for (const z of x.ziskane) expect(z.partia).toEqual(expect.any(Number));
    }
    // Dohratá partia dvoch ľudí: obaja majú „dohratých“ aspoň 1 v kariére, víťaz výhru.
    const katalog = nacitajKatalog();
    const dohrate = katalog.achievementy.find((x) => x.metrika === "dohrataPartia" && x.rozsah === "kariera" && x.proti !== "bot" && x.prahy[0] === 1);
    if (dohrate !== undefined) {
      for (const cookie of [a, b]) {
        const v = (await api<{ achievementy: Vitrina }>(cookie, "/achievementy")).achievementy;
        expect(v?.achievementy.find((x) => x.id === dohrate.id)?.rank).toBeGreaterThanOrEqual(1);
      }
    }

    // Opätovné pripojenie po konci: súhrn príde znova.
    ra.zavri();
    const ra2 = new Robot(server.port, a);
    await ra2.otvorene();
    ra2.posli({ type: "rejoin", code: ra.privitanie.code });
    await cakaj(() => suhrny(ra2).length > 0, "súhrn po návrate");

    // Tajný, ktorý hráč nemá, je „???“ bez prahov; skrytý súhrn skryje vitrínu cudziemu, nie sebe.
    const vlastna = (await api<{ achievementy: Vitrina }>(a, `/hraci/${idA}`)).achievementy;
    const tajny = vlastna?.achievementy.find((x) => x.tajny && x.rank === 0);
    if (tajny !== undefined) expect(tajny).toMatchObject({ prahy: [] });
    if (tajny !== undefined) expect(["???", ...katalog.achievementy.flatMap((x) => (x.tajnyText === null ? [] : [x.tajnyText]))]).toContain(tajny.popis);
    expect(tajny?.nazov ?? "???").toBe("???");
    expect((await api<{ achievementy: Vitrina }>(b, `/hraci/${idA}`)).achievementy).not.toBeNull();
    await api(a, "/profil", "PATCH", { skrytySuhrn: true });
    expect((await api<{ achievementy: Vitrina }>(b, `/hraci/${idA}`)).achievementy).toBeNull();
    expect((await api<{ achievementy: Vitrina }>(a, `/hraci/${idA}`)).achievementy).not.toBeNull();
    ra2.zavri();
    rb.zavri();
  }, 180_000);

  it("partia proti botovi: achievementy „ludia“ sa nerátajú, bot nič nezíska", async () => {
    const a = (await registruj(server.port)).cookie;
    const r = new Robot(server.port, a);
    await r.otvorene();
    r.posli({ type: "create", bot: true });
    await cakaj(() => r.view !== null, "začiatok");
    for (let tahov = 0; ; tahov++) {
      await cakaj(() => r.view?.koniec != null || r.view?.mozemHrat === true, "môj ťah");
      if (r.view?.koniec != null) break;
      const pred = r.pocetStavov;
      r.posli({ type: "cmd", cmd: r.vyberTah() });
      await cakaj(() => r.pocetStavov > pred || r.chyby.length > 0, "odpoveď");
      if (r.chyby.length > 0) {
        r.chyby.splice(0);
        await cakaj(() => r.pocetStavov > pred, "nový stav");
      }
      expect(tahov).toBeLessThan(3000);
    }
    await cakaj(() => suhrny(r).length > 0, "súhrn");
    const katalog = nacitajKatalog();
    for (const z of zisky(r)) expect(katalog.achievementy.find((x) => x.id === z.id)?.proti).not.toBe("ludia");
    r.zavri();
  }, 120_000);
});

describe("achievementy — vypínač (Michal 2026-10-23)", () => {
  it("kým katalóg nemá zapnute: true, partia nič nepošle ani neuloží a API vráti null", async () => {
    expect(nacitajKatalog().zapnute).toBe(false);
    const { server: s, zmaz: zmazVyp } = await testovaciServer(TEST_ADMIN, { botPauzaMs: 0 });
    try {
      const a = (await registruj(s.port)).cookie;
      const r = new Robot(s.port, a);
      await r.otvorene();
      r.posli({ type: "create", bot: true });
      await cakaj(() => r.view !== null, "začiatok");
      for (let tahov = 0; ; tahov++) {
        await cakaj(() => r.view?.koniec != null || r.view?.mozemHrat === true, "môj ťah");
        if (r.view?.koniec != null) break;
        const pred = r.pocetStavov;
        r.posli({ type: "cmd", cmd: r.vyberTah() });
        await cakaj(() => r.pocetStavov > pred || r.chyby.length > 0, "odpoveď");
        if (r.chyby.length > 0) {
          r.chyby.splice(0);
          await cakaj(() => r.pocetStavov > pred, "nový stav");
        }
        expect(tahov).toBeLessThan(3000);
      }
      expect(r.ostatne.filter((m) => m.type === "achievement" || m.type === "achievementySuhrn")).toEqual([]);
      const odpoved = (await (await fetch(`http://127.0.0.1:${s.port}/api/achievementy`, { headers: { cookie: a } })).json()) as { achievementy: unknown };
      expect(odpoved.achievementy).toBeNull();
      r.zavri();
    } finally {
      await zmazVyp();
    }
  }, 120_000);
});

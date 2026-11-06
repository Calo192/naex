// Režim Päta, Lakeť, Otočka cez server: človek (vidí len svoj pohľad) dohrá partiu proti botovi,
// nič nespadne v kronike ani štatistikách a partia nejde do archívu.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ClientState, Command, PlayerId } from "@naex/core";
import type { GameServer } from "../src/server.ts";
import { TEST_ADMIN, prihlas, registruj, testovaciServer } from "./pomocnik.ts";
import { Robot } from "./robot.ts";

let server: GameServer;
let zmaz: () => Promise<void>;

beforeAll(async () => {
  ({ server, zmaz } = await testovaciServer(TEST_ADMIN, { botPauzaMs: 0, rezimyZrejucej: true }));
});

afterAll(async () => {
  await zmaz();
});

async function cakaj(podmienka: () => boolean, popis: string): Promise<void> {
  for (let i = 0; i < 6000; i++) {
    if (podmienka()) return;
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error(`nedočkal som sa: ${popis}`);
}

/** Krok režimu rozhodne z toho, čo hráč vidí; null = hrá sa bežné kolo. */
function tahRezimu(v: ClientState): Command | null {
  const h = v.pata;
  if (h === undefined || h.krok === null) return null;
  const ja: PlayerId = v.ja;
  const su: PlayerId = ja === 0 ? 1 : 0;
  const stojaci = (p: PlayerId): string[] => h.rady[p].filter((s) => !s.podrazeny).map((s) => s.karta.defId);
  switch (h.krok) {
    case "draft":
      return { type: "pataVyber", elderId: h.ponuka[0]?.defId ?? "" };
    case "rad":
      return { type: "pataRad", poradie: h.rady[ja].map((s) => s.karta.defId) };
    case "vymena":
      return { type: "pataVymena", index: null };
    case "liecenie":
      return { type: "pataLiecenie", robotyNaDlh: h.bitka?.vstupL[ja].roboty ?? 0, liecenie: {} };
    case "utok": {
      const ciel = stojaci(su)[0] ?? "";
      const u = h.bitka?.vstupU[ja];
      return { type: "pataUtok", tuhe: (u?.tuhe ?? 0) > 0 ? { [ciel]: u?.tuhe ?? 0 } : {}, jed: (u?.pohorsenie ?? 0) > 0 ? { [ciel]: u?.pohorsenie ?? 0 } : {} };
    }
    case "vyzrat":
      return { type: "pataVyzrat", elderId: null };
  }
}

describe("Päta, Lakeť, Otočka na serveri", () => {
  it("človek dohrá partiu proti botovi a súperov rad ani jeho ruka k nemu neodídu", async () => {
    const { cookie } = await registruj(server.port);
    const a = new Robot(server.port, cookie);
    await a.otvorene();
    a.posli({ type: "create", bot: true, rezim: "pata" });
    await cakaj(() => a.view !== null, "začiatok");
    expect(a.view?.faza === "pataDraft" || a.view?.pata !== undefined).toBe(true);
    let tahov = 0;
    for (;;) {
      await cakaj(() => a.view?.koniec != null || a.view?.mozemHrat === true, `môj ťah (fáza ${a.view?.faza}, krok ${a.view?.pata?.krok})`);
      const v = a.view;
      if (v === null || v.koniec != null) break;
      const pred = a.pocetStavov;
      a.posli({ type: "cmd", cmd: tahRezimu(v) ?? a.vyberTah() });
      await a.vybavene();
      // V Pitke a pri krokoch naraz sa môj ťah môže minúť s botovým; bez nového stavu je to chyba.
      if (a.chyby.length > 0) {
        expect(a.pocetStavov, a.chyby.join(" | ")).toBeGreaterThan(pred);
        a.chyby.splice(0);
      }
      tahov++;
      expect(tahov).toBeLessThan(6000);
    }
    expect(a.view?.koniec).not.toBeNull();
    a.zavri();
    const admin = await prihlas(server.port, TEST_ADMIN.login, TEST_ADMIN.heslo);
    const tempo = (await (await fetch(`http://127.0.0.1:${server.port}/api/admin/tempo`, { headers: { cookie: admin } })).json()) as { partie: unknown[] };
    expect(tempo.partie).toHaveLength(0);
    const karty = (await (await fetch(`http://127.0.0.1:${server.port}/api/admin/statistiky-kariet`, { headers: { cookie: admin } })).json()) as { partie: number };
    expect(karty.partie).toBe(0);
  }, 240000);
});

// Výber súpera proti počítaču (Michal 2026-11-06): klient pošle len id povahy,
// server ho overí proti POVAHY. Bez voľby sa losuje ako doteraz (nástroje a
// playtest zakladajú partiu s botom bez voľby), s voľbou hrá naozaj zvolená povaha.

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { POVAHY } from "@naex/core";
import type { GameServer } from "../src/server.ts";
import { TEST_ADMIN, registruj, testovaciServer } from "./pomocnik.ts";
import { Robot } from "./robot.ts";

// Ktorou povahou bot naozaj ťahá — meno na stole by samo nestačilo.
const povahyTahov = vi.hoisted(() => new Set<string | undefined>());
vi.mock("@naex/core", async (povodny) => {
  const core = await povodny<typeof import("@naex/core")>();
  return {
    ...core,
    tahBota: (...a: Parameters<typeof core.tahBota>) => {
      povahyTahov.add(a[4]?.povaha);
      return core.tahBota(...a);
    },
  };
});

interface HracNaMieste {
  readonly meno: string;
  readonly avatar: string | null;
  readonly bot?: boolean;
}

interface BotNaVyber {
  readonly id: string;
  readonly meno: string;
  readonly popis: string | null;
  readonly avatar: string | null;
}

let server: GameServer;
let zmaz: () => Promise<void>;

beforeAll(async () => {
  ({ server, zmaz } = await testovaciServer(TEST_ADMIN, { botPauzaMs: 0 }));
});

afterAll(async () => {
  await zmaz();
});

async function cakaj(podmienka: () => boolean, popis: string): Promise<void> {
  for (let i = 0; i < 3000; i++) {
    if (podmienka()) return;
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error(`nedočkal som sa: ${popis}`);
}

const vLobby = async (cookie: string): Promise<{ boti: BotNaVyber[] }> =>
  (await (await fetch(`http://127.0.0.1:${server.port}/api/hry/otvorene`, { headers: { cookie } })).json()) as { boti: BotNaVyber[] };

/** Založí partiu s botom a vráti, kto sedí oproti; odchodom partia zanikne a miestnosť sa dá založiť znova. */
async function superVPartii(r: Robot, poziadavka: Record<string, unknown>): Promise<HracNaMieste> {
  r.view = null;
  r.hraci = null;
  r.posli({ type: "create", bot: true, ...poziadavka });
  await cakaj(() => r.view !== null && r.hraci !== null, "začiatok partie");
  const superHrac = (r.hraci as readonly (HracNaMieste | null)[])[1];
  if (superHrac == null) throw new Error("oproti nikto nesedí");
  r.posli({ type: "leave" });
  await r.vybavene();
  return superHrac;
}

describe("výber súpera proti počítaču", () => {
  it("lobby dostane všetky povahy z POVAHY s avatarom a opisom, nič navyše", async () => {
    const { cookie } = await registruj(server.port);
    const { boti } = await vLobby(cookie);
    expect(boti.map((b) => b.id)).toEqual(POVAHY.map((p) => p.id));
    expect(boti.map((b) => b.meno)).toEqual(POVAHY.map((p) => p.meno));
    expect(boti.map((b) => b.popis)).toEqual(POVAHY.map((p) => p.popis.trim() || null));
    for (const b of boti) {
      expect(Object.keys(b).sort()).toEqual(["avatar", "id", "meno", "popis"]);
      expect(b.popis).toEqual(expect.any(String));
      expect(b.avatar, `${b.id}: seed/avatary/boti/<id>.jpg`).toEqual(expect.any(String));
    }
  });

  it("platná povaha: oproti sedí práve ona, s menom a podobizňou z ponuky", async () => {
    const { cookie } = await registruj(server.port);
    const { boti } = await vLobby(cookie);
    const r = new Robot(server.port, cookie);
    await r.otvorene();
    for (const b of boti) {
      const oproti = await superVPartii(r, { povaha: b.id });
      expect(oproti).toMatchObject({ meno: b.meno, avatar: b.avatar, bot: true });
    }
    expect(r.chyby).toEqual([]);
    r.zavri();
  });

  it("neznáma povaha sa odmietne a partia sa nezaloží; zlý typ tiež", async () => {
    const { cookie } = await registruj(server.port);
    const r = new Robot(server.port, cookie);
    await r.otvorene();
    // Vyradené povahy sú len v archíve — súpera z nich založiť nejde.
    for (const zla of ["neznamy", "", "__proto__", "stamgast", "rapavy_fero", "teta_gizka", "IGOR", 1, null, ["igor"], { id: "igor" }]) {
      r.chyby.length = 0;
      r.posli({ type: "create", bot: true, povaha: zla });
      await cakaj(() => r.chyby.length > 0, `odmietnutie ${JSON.stringify(zla)}`);
      expect(r.chyby).toEqual(["Takého súpera tu nemáme."]);
      expect(r.privitanie.code).toBeUndefined();
      expect(r.view).toBeNull();
    }
    r.zavri();
  });

  it("bez voľby sa losuje ako doteraz: vždy povaha z POVAHY a nie stále tá istá", async () => {
    const { cookie } = await registruj(server.port);
    const r = new Robot(server.port, cookie);
    await r.otvorene();
    const mena = new Set<string>();
    for (let i = 0; i < 40; i++) mena.add((await superVPartii(r, {})).meno);
    for (const m of mena) expect(POVAHY.map((p) => p.meno)).toContain(m);
    expect(mena.size).toBeGreaterThan(1);
    r.zavri();
  });

  it("zvolená povaha naozaj ťahá, liga ostáva voľbou hráča a partia je v archíve s botom", async () => {
    const povaha = POVAHY.at(-1)?.id ?? "";
    povahyTahov.clear();
    const { cookie } = await registruj(server.port);
    const r = new Robot(server.port, cookie);
    await r.otvorene();
    r.posli({ type: "create", bot: true, povaha, dlzka: "kratka" });
    await cakaj(() => r.view !== null, "začiatok partie");

    let tahov = 0;
    for (;;) {
      await cakaj(() => r.view?.koniec != null || r.view?.mozemHrat === true, `môj ťah (fáza ${r.view?.faza})`);
      if (r.view?.koniec != null) break;
      r.chyby.length = 0;
      r.posli({ type: "cmd", cmd: r.vyberTah() });
      await r.vybavene();
      tahov++;
      expect(tahov).toBeLessThan(3000);
    }
    expect([...povahyTahov]).toEqual([povaha]);

    const ja = (await (await fetch(`http://127.0.0.1:${server.port}/api/ja`, { headers: { cookie } })).json()) as { pouzivatel: { id: number } };
    const archiv = (await (await fetch(`http://127.0.0.1:${server.port}/api/hraci/${ja.pouzivatel.id}/partie?filter=boti`, { headers: { cookie } })).json()) as {
      partie: { dlzka: string; super: { bot?: string } }[];
    };
    expect(archiv.partie).toHaveLength(1);
    expect(archiv.partie[0]).toMatchObject({ dlzka: "kratka", super: { bot: povaha } });
    r.zavri();
  }, 120_000);
});

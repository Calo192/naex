// Dĺžka hry (pravidlá v3): počet lokalít sa volí pri založení miestnosti.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { GameServer } from "../src/server.ts";
import { Klient, registruj, testovaciServer } from "./pomocnik.ts";

let server: GameServer;
let zmaz: () => Promise<void>;

beforeAll(async () => {
  ({ server, zmaz } = await testovaciServer());
});

afterAll(async () => {
  await zmaz();
});

async function zalozAPripoj(dlzka?: string): Promise<{ view: { lokalitCelkom: number; lokalityVHre: unknown[] } } | { chyba: string }> {
  const a = new Klient(server.port, (await registruj(server.port)).cookie);
  const b = new Klient(server.port, (await registruj(server.port)).cookie);
  await a.otvorene();
  await b.otvorene();
  a.posli(dlzka === undefined ? { type: "create" } : { type: "create", dlzka });
  const odpoved = await a.cakaj("privitanie");
  if (odpoved.type === "error") {
    a.zavri();
    b.zavri();
    return { chyba: String(odpoved.text) };
  }
  expect(odpoved.dlzka).toBe(dlzka ?? "stredna");
  b.posli({ type: "join", code: odpoved.code });
  const stav = await b.cakaj("state");
  a.zavri();
  b.zavri();
  return { view: stav.view as { lokalitCelkom: number; lokalityVHre: unknown[] } };
}

describe("dĺžka hry", () => {
  it("predvolená je stredná — 7 lokalít", async () => {
    const r = await zalozAPripoj();
    expect("view" in r && r.view.lokalitCelkom).toBe(7);
    expect("view" in r && r.view.lokalityVHre.length).toBe(7);
  });

  it("krátka hra má 5 lokalít a lobby ju ponúka", async () => {
    const r = await zalozAPripoj("kratka");
    expect("view" in r && r.view.lokalitCelkom).toBe(5);
    const { cookie } = await registruj(server.port);
    const res = await fetch(`http://127.0.0.1:${server.port}/api/hry/otvorene`, { headers: { cookie } });
    // Sada v8 má 14 lokalít — dlhá hra (11) je možná.
    expect(((await res.json()) as { dlzky: string[] }).dlzky).toEqual(["kratka", "stredna", "dlha"]);
  });

  it("dlhá hra má 11 lokalít", async () => {
    const r = await zalozAPripoj("dlha");
    expect("view" in r && r.view.lokalitCelkom).toBe(11);
  });
});

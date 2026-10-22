// Soundboard majstra Melichara (Michal 2026-10-22): hlášku pustí len hráč
// rozohranej partie a počujú ju obaja; kým hrá jeho vlastná a 2 s po nej,
// ďalšiu nepustí, súperova ho neblokuje. Dĺžka hlášky je z MP3 rámcov.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MELICHAR_PAUZA_MS, createGameServer, type GameServer } from "../src/server.ts";
import { trvanieMp3 } from "../src/hudba.ts";
import { Klient, registruj, TEST_ADMIN, type Msg } from "./pomocnik.ts";

/** MPEG-1 Layer III, 128 kb/s, 44,1 kHz: rámec má 417 bajtov a 1152 vzoriek. */
function mp3(ramcov: number): Buffer {
  const ramec = Buffer.alloc(417);
  ramec.set([0xff, 0xfb, 0x90, 0x00]);
  const id3 = Buffer.from([0x49, 0x44, 0x33, 3, 0, 0, 0, 0, 0, 5, 1, 2, 3, 4, 5]);
  return Buffer.concat([Buffer.alloc(300), id3, ...Array.from({ length: ramcov }, () => ramec)]);
}
const KRATKA = "a".repeat(40);
const KRATKA_MS = Math.round((10 * 1152 * 1000) / 44100);

let server: GameServer;
let dir: string;

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "naex-test-"));
  mkdirSync(join(dir, "melichar"));
  writeFileSync(join(dir, "melichar", `${KRATKA}.mp3`), mp3(10));
  // Starší import bez dĺžky — server ju dopočíta zo súboru.
  writeFileSync(join(dir, "melichar", "zoznam.json"), JSON.stringify([{ id: KRATKA, nazov: "Boha", subor: `${KRATKA}.mp3` }]));
  server = await createGameServer({ port: 0, dataDir: dir, admin: TEST_ADMIN, staticDir: join(dir, "nic"), botPauzaMs: 0 });
});

afterAll(async () => {
  await server.close();
  rmSync(dir, { recursive: true, force: true });
});

async function hrac(): Promise<Klient> {
  const k = new Klient(server.port, (await registruj(server.port)).cookie);
  await k.otvorene();
  return k;
}

const pocka = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("soundboard majstra Melichara", () => {
  it("dĺžka MP3 sa ráta z rámcov, aj za nulami a ID3", async () => {
    expect(trvanieMp3(mp3(10))).toBe(KRATKA_MS);
    expect(trvanieMp3(Buffer.from("<html>chyba</html>"))).toBeNull();
    const r = (await (await fetch(`http://127.0.0.1:${server.port}/api/melichar`)).json()) as { hlasky: { trvanieMs: number }[] };
    expect(r.hlasky[0]?.trvanieMs).toBe(KRATKA_MS);
  });

  it("hlášku počujú obaja; vlastná blokuje do konca + 2 s, súperova nie", async () => {
    const a = await hrac();
    const b = await hrac();
    a.posli({ type: "create" });
    const { code } = await a.cakaj("privitanie");
    b.posli({ type: "join", code });
    await a.cakaj("state");
    await b.cakaj("state");

    a.posli({ type: "melichar", id: KRATKA });
    const uA = await a.cakaj("melichar");
    const uB = await b.cakaj("melichar");
    expect(uA).toEqual({ type: "melichar", id: KRATKA, seat: 0, trvanieMs: KRATKA_MS });
    expect(uB).toEqual(uA);

    // Hneď znova nie — hláška hrá a po nej je pauza.
    a.posli({ type: "melichar", id: KRATKA });
    expect(String((await a.cakaj("error")).text)).toContain("nedohovoril");

    // Súper smie pustiť svoju aj vtedy, keď hrá moja.
    b.posli({ type: "melichar", id: KRATKA });
    expect(((await a.cakaj("melichar")) as Msg).seat).toBe(1);
    await b.cakaj("melichar");

    // Po dohraní a pauze 2 s už áno.
    await pocka(KRATKA_MS + MELICHAR_PAUZA_MS + 100);
    a.posli({ type: "melichar", id: KRATKA });
    expect(((await b.cakaj("melichar")) as Msg).seat).toBe(0);
    a.zavri();
    b.zavri();
  });

  it("hlášku nepustí, kto v partii nesedí, ani neznámu hlášku", async () => {
    const mimo = await hrac();
    mimo.posli({ type: "melichar", id: KRATKA });
    expect(String((await mimo.cakaj("error")).text)).toContain("len hráč");

    // Miestnosť bez súpera — partia ešte nezačala.
    mimo.posli({ type: "create" });
    await mimo.cakaj("privitanie");
    mimo.posli({ type: "melichar", id: KRATKA });
    expect(String((await mimo.cakaj("error")).text)).toContain("len hráč");
    mimo.zavri();

    const a = await hrac();
    a.posli({ type: "create", bot: true });
    await a.cakaj("state");
    a.posli({ type: "melichar", id: "b".repeat(40) });
    expect(String((await a.cakaj("error")).text)).toContain("nepozná");
    a.zavri();
  });

  it("v partii s botom smie hráč tiež", async () => {
    const a = await hrac();
    a.posli({ type: "create", bot: true });
    await a.cakaj("state");
    a.posli({ type: "melichar", id: KRATKA });
    expect(await a.cakaj("melichar")).toMatchObject({ id: KRATKA, seat: 0 });
    a.zavri();
  });
});

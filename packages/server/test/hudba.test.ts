// Hudba počas partie (Michal 2026-10-20): zoznam skladieb, súbory s Range
// (Safari bez neho zvuk neprehrá) a hlasitosť v profile.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createGameServer, type GameServer } from "../src/server.ts";
import { bezUvodnychNul, nazovHlasky, priponaZvuku } from "../src/hudba.ts";
import { registruj, TEST_ADMIN } from "./pomocnik.ts";

const ID = "a".repeat(40);
const OBSAH = Buffer.concat([Buffer.from("ID3"), Buffer.alloc(997, 7)]);

let server: GameServer;
let dir: string;

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "naex-test-"));
  mkdirSync(join(dir, "hudba"));
  writeFileSync(join(dir, "hudba", `${ID}.mp3`), OBSAH);
  writeFileSync(
    join(dir, "hudba", "zoznam.json"),
    JSON.stringify([
      { id: ID, nazov: "Nárek opilca", subor: `${ID}.mp3` },
      // Súbor chýba — do zoznamu sa nedostane.
      { id: "b".repeat(40), nazov: "Stratená", subor: `${"b".repeat(40)}.mp3` },
      // Cesta mimo adresára hudby — tiež nie.
      { id: "c".repeat(40), nazov: "Zlá", subor: "../naex.sqlite" },
    ]),
  );
  mkdirSync(join(dir, "melichar"));
  writeFileSync(join(dir, "melichar", `${ID}.mp3`), OBSAH);
  writeFileSync(join(dir, "melichar", "zoznam.json"), JSON.stringify([{ id: ID, nazov: "No toto je marha", subor: `${ID}.mp3` }]));
  server = await createGameServer({ port: 0, dataDir: dir, admin: TEST_ADMIN, staticDir: join(dir, "nic") });
});

afterAll(async () => {
  await server.close();
  rmSync(dir, { recursive: true, force: true });
});

const url = (cesta: string): string => `http://127.0.0.1:${server.port}${cesta}`;

describe("hudba počas partie", () => {
  it("zoznam obsahuje len skladby, ktorých súbor je v adresári hudby", async () => {
    const r = (await (await fetch(url("/api/hudba"))).json()) as { skladby: { nazov: string; subor: string }[] };
    expect(r.skladby).toEqual([{ id: ID, nazov: "Nárek opilca", subor: `${ID}.mp3` }]);
  });

  it("súbor ide celý aj po kúskoch (Range)", async () => {
    const cely = await fetch(url(`/hudba/${ID}.mp3`));
    expect(cely.status).toBe(200);
    expect(cely.headers.get("content-type")).toBe("audio/mpeg");
    expect(cely.headers.get("accept-ranges")).toBe("bytes");
    expect(Buffer.from(await cely.arrayBuffer()).equals(OBSAH)).toBe(true);

    const kus = await fetch(url(`/hudba/${ID}.mp3`), { headers: { range: "bytes=0-2" } });
    expect(kus.status).toBe(206);
    expect(kus.headers.get("content-range")).toBe(`bytes 0-2/${OBSAH.length}`);
    expect(Buffer.from(await kus.arrayBuffer()).toString("ascii")).toBe("ID3");

    const koniec = await fetch(url(`/hudba/${ID}.mp3`), { headers: { range: "bytes=-10" } });
    expect(koniec.status).toBe(206);
    expect(koniec.headers.get("content-range")).toBe(`bytes ${OBSAH.length - 10}-${OBSAH.length - 1}/${OBSAH.length}`);

    expect((await fetch(url(`/hudba/${ID}.mp3`), { headers: { range: `bytes=${OBSAH.length}-` } })).status).toBe(416);
  });

  it("iné súbory než skladby server nevydá", async () => {
    for (const cesta of ["/hudba/zoznam.json", `/hudba/${"b".repeat(40)}.mp3`, "/hudba/..%2Fnaex.sqlite", `/hudba/${ID}.exe`]) {
      expect((await fetch(url(cesta))).status).toBe(404);
    }
  });

  it("typ zvuku sa pozná podľa obsahu", () => {
    expect(priponaZvuku(OBSAH)).toBe("mp3");
    expect(priponaZvuku(Buffer.from([0, 0, 0, 0x20, ...Buffer.from("ftypM4A "), 0, 0]))).toBe("m4a");
    expect(priponaZvuku(Buffer.from("OggS\0\0\0\0\0\0\0\0"))).toBe("ogg");
    expect(priponaZvuku(Buffer.from("<html>chyba</html>"))).toBeNull();
  });

  it("hlasitosť hudby: predvolene 30 %, uloží sa 0 – 100 %", async () => {
    const { cookie } = await registruj(server.port);
    const volaj = async (telo?: unknown) =>
      fetch(url("/api/" + (telo === undefined ? "ja" : "profil")), {
        method: telo === undefined ? "GET" : "PATCH",
        headers: { cookie, "x-naex": "1", "content-type": "application/json" },
        ...(telo === undefined ? {} : { body: JSON.stringify(telo) }),
      });
    const hudba = async (res: Response) => ((await res.json()) as { pouzivatel: { hudba: number } }).pouzivatel.hudba;

    expect(await hudba(await volaj())).toBe(30);
    expect(await hudba(await volaj({ hudba: 0 }))).toBe(0);
    expect(await hudba(await volaj({ hudba: 75 }))).toBe(75);
    for (const zle of [-5, 120, "nahlas", null]) expect((await volaj({ hudba: zle })).status).toBe(400);
    expect(await hudba(await volaj())).toBe(75);
  });
});

describe("hlášky majstra Melichara", () => {
  it("zoznam a súbory idú z vlastného adresára", async () => {
    const r = (await (await fetch(url("/api/melichar"))).json()) as { hlasky: unknown[] };
    expect(r.hlasky).toEqual([{ id: ID, nazov: "No toto je marha", subor: `${ID}.mp3` }]);
    const subor = await fetch(url(`/melichar/${ID}.mp3`));
    expect(subor.status).toBe(200);
    expect(subor.headers.get("content-type")).toBe("audio/mpeg");
    expect((await fetch(url("/melichar/zoznam.json"))).status).toBe(404);
  });

  it("import: nuly pred prvým MP3 rámcom sa orežú, text hlášky z názvu súboru", () => {
    const sNulami = Buffer.concat([Buffer.alloc(313), Buffer.from([0xff, 0xfb, 0x70, 0xc0]), Buffer.alloc(20, 1)]);
    expect(priponaZvuku(sNulami)).toBeNull();
    expect(priponaZvuku(bezUvodnychNul(sNulami))).toBe("mp3");
    expect(bezUvodnychNul(OBSAH)).toBe(OBSAH);
    expect(nazovHlasky("03_No_toto_je_marha")).toBe("No toto je marha");
    expect(nazovHlasky("07_toto_je_ZIVOT")).toBe("Toto je ZIVOT");
    expect(nazovHlasky("Bez cisla")).toBe("Bez cisla");
  });

  it("hlasitosť (predvolene 70 %, 0 = mlčí) a frekvencia (predvolene 25 %, 5 – 60 %)", async () => {
    const { cookie, login } = await registruj(server.port);
    const volaj = async (telo?: unknown) =>
      fetch(url("/api/" + (telo === undefined ? "ja" : "profil")), {
        method: telo === undefined ? "GET" : "PATCH",
        headers: { cookie, "x-naex": "1", "content-type": "application/json" },
        ...(telo === undefined ? {} : { body: JSON.stringify(telo) }),
      });
    type Nastavenie = { melichar: number; melicharFrekvencia: number };
    const nastavenie = async (res: Response): Promise<Nastavenie> => {
      const { melichar, melicharFrekvencia } = ((await res.json()) as { pouzivatel: Nastavenie }).pouzivatel;
      return { melichar, melicharFrekvencia };
    };

    expect(await nastavenie(await volaj())).toEqual({ melichar: 70, melicharFrekvencia: 25 });
    expect(await nastavenie(await volaj({ melichar: 0 }))).toEqual({ melichar: 0, melicharFrekvencia: 25 });
    expect(await nastavenie(await volaj({ melichar: 40, melicharFrekvencia: 60 }))).toEqual({ melichar: 40, melicharFrekvencia: 60 });
    for (const zle of [{ melichar: 101 }, { melicharFrekvencia: 0 }, { melicharFrekvencia: 61 }, { melicharFrekvencia: 100 }, { melicharFrekvencia: "často" }]) {
      expect((await volaj(zle)).status).toBe(400);
    }
    expect(await nastavenie(await volaj())).toEqual({ melichar: 40, melicharFrekvencia: 60 });

    // Frekvencia uložená pred stropom 60 % (Michal 2026-10-22) sa číta ako strop.
    const db = new DatabaseSync(join(dir, "naex.sqlite"));
    db.prepare("UPDATE pouzivatelia SET melichar_frekvencia = 100 WHERE login = ?").run(login);
    db.close();
    expect(await nastavenie(await volaj())).toEqual({ melichar: 40, melicharFrekvencia: 60 });
  });
});

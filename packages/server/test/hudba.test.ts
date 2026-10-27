// Hudba počas partie (Michal 2026-10-20): zoznam skladieb, súbory s Range
// (Safari bez neho zvuk neprehrá) a hlasitosť v profile.

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createGameServer, type GameServer } from "../src/server.ts";
import { TRVANIE_HLASKY_NEZNAME_MS, bezUvodnychNul, nacitajPriecinokHlasok, nazovHlasky, priponaZvuku, skupinaZDat } from "../src/hudba.ts";
import { registruj, TEST_ADMIN } from "./pomocnik.ts";

const ID = "a".repeat(40);
const ID2 = "d".repeat(40);
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
  writeFileSync(join(dir, "melichar", `${ID2}.mp3`), OBSAH);
  writeFileSync(
    join(dir, "melichar", "zoznam.json"),
    JSON.stringify([
      // meno = súbor bez prípony (import od 2026-10-27); Bzdocha je zo staršieho importu bez neho.
      { id: ID, nazov: "No toto je marha", meno: "03_No_toto_je_marha", subor: `${ID}.mp3`, skupina: "udiv" },
      // Neplatné id skupiny sa zahodí.
      { id: ID2, nazov: "Bzdocha", subor: `${ID2}.mp3`, skupina: "Zlá skupina!" },
    ]),
  );
  writeFileSync(
    join(dir, "melichar", "skupiny.json"),
    JSON.stringify([
      { id: "udiv", nazov: "Údiv", citat: "Boha", ikona: "vykricnik", farba: "info", klaves: "1", nalady: ["udiv", "zle"] },
      // Skupina bez hlášok sa klientovi neposiela.
      { id: "prazdna", nazov: "Prázdna", klaves: "2", nalady: [] },
    ]),
  );
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
    const r = (await (await fetch(url("/api/melichar"))).json()) as { hlasky: unknown[]; skupiny: unknown[] };
    // Súbor bez MP3 rámcov — dĺžka sa nedá zistiť, ráta sa s predvolenou.
    expect(r.hlasky).toEqual([
      { id: ID, nazov: "No toto je marha", meno: "03_No_toto_je_marha", subor: `${ID}.mp3`, skupina: "udiv", trvanieMs: TRVANIE_HLASKY_NEZNAME_MS },
      { id: ID2, nazov: "Bzdocha", subor: `${ID2}.mp3`, trvanieMs: TRVANIE_HLASKY_NEZNAME_MS },
    ]);
    expect(r.skupiny).toEqual([{ id: "udiv", nazov: "Údiv", citat: "Boha", ikona: "vykricnik", farba: "info", klaves: "1", nalady: ["udiv"] }]);
    const subor = await fetch(url(`/melichar/${ID}.mp3`));
    expect(subor.status).toBe(200);
    expect(subor.headers.get("content-type")).toBe("audio/mpeg");
    expect((await fetch(url("/melichar/zoznam.json"))).status).toBe(404);
    expect((await fetch(url("/melichar/skupiny.json"))).status).toBe(404);
  });

  it("import: nuly pred prvým MP3 rámcom sa orežú, text hlášky z názvu súboru", () => {
    const sNulami = Buffer.concat([Buffer.alloc(313), Buffer.from([0xff, 0xfb, 0x70, 0xc0]), Buffer.alloc(20, 1)]);
    expect(priponaZvuku(sNulami)).toBeNull();
    expect(priponaZvuku(bezUvodnychNul(sNulami))).toBe("mp3");
    expect(bezUvodnychNul(OBSAH)).toBe(OBSAH);
    expect(nazovHlasky("03_No_toto_je_marha")).toBe("No toto je marha");
    expect(nazovHlasky("07_toto_je_ZIVOT")).toBe("Toto je ZIVOT");
    expect(nazovHlasky("Bez cisla")).toBe("Bez cisla");
    expect(nazovHlasky("1500_korun")).toBe("1500 korun");
  });

  it("import: priečinok = skupina so skupina.json, „_“ a súbory mimo skupín sa vynechajú", () => {
    const zdroj = mkdtempSync(join(tmpdir(), "naex-melichar-"));
    const subor = (cesta: string, obsah: string | Buffer = OBSAH): void => {
      mkdirSync(join(zdroj, cesta, ".."), { recursive: true });
      writeFileSync(join(zdroj, cesta), obsah);
    };
    subor("Údiv/skupina.json", JSON.stringify({ nazov: "Údiv", ikona: "vykricnik", klaves: "1", nalady: ["udiv"] }));
    subor("Údiv/aha.mp3");
    subor("Údiv/vnorene/boha.mp3");
    subor("nervy/kurva.mp3");
    subor("druha/skupina.json", JSON.stringify({ nazov: "Druhá", klaves: "1" }));
    subor("_vyradene/zla.mp3");
    subor("mimo.mp3");
    try {
      const { skupiny, subory, varovania } = nacitajPriecinokHlasok(zdroj);
      expect(skupiny.map((s) => [s.id, s.nazov, s.klaves])).toEqual([
        ["druha", "Druhá", "1"],
        ["nervy", "Nervy", null],
        ["udiv", "Údiv", null],
      ]);
      expect(subory.map((s) => [s.skupina, s.cesta.slice(zdroj.length + 1).replace(/\\/g, "/")])).toEqual([
        ["nervy", "nervy/kurva.mp3"],
        ["udiv", "Údiv/aha.mp3"],
        ["udiv", "Údiv/vnorene/boha.mp3"],
      ]);
      const v = varovania.join("\n");
      expect(v).toMatch(/_vyradene\/.*\(1 súbor\)/);
      expect(v).toMatch(/mimo\.mp3/);
      expect(v).toMatch(/kláves 1 už má iná skupina/);
      expect(v).toMatch(/nervy\/ — chýba skupina\.json/);
    } finally {
      rmSync(zdroj, { recursive: true, force: true });
    }
  });

  it("import synchronizuje: hláška, ktorá v zdroji už nie je, zmizne zo zoznamu aj z disku (aj na produkcii)", () => {
    const zdroj = mkdtempSync(join(tmpdir(), "naex-melichar-zdroj-"));
    const data = mkdtempSync(join(tmpdir(), "naex-melichar-data-"));
    // Stav po starom importe: hláška, ktorú Michal medzičasom zo zdroja zmazal.
    const stara = `${"e".repeat(40)}.mp3`;
    mkdirSync(join(data, "melichar"));
    writeFileSync(join(data, "melichar", stara), OBSAH);
    writeFileSync(join(data, "melichar", "zoznam.json"), JSON.stringify([{ id: "e".repeat(40), nazov: "Zmazaná", subor: stara }]));
    mkdirSync(join(zdroj, "udiv"));
    writeFileSync(join(zdroj, "udiv", "skupina.json"), JSON.stringify({ nazov: "Údiv", klaves: "1", nalady: ["udiv"] }));
    writeFileSync(join(zdroj, "udiv", "aha.mp3"), OBSAH);
    try {
      execFileSync(process.execPath, ["--experimental-strip-types", "--no-warnings", fileURLToPath(new URL("../src/hudba-import.ts", import.meta.url)), "--melichar", zdroj], {
        env: { ...process.env, NAEX_DATA: data, INIT_CWD: zdroj },
        stdio: "pipe",
      });
      const zostalo = readdirSync(join(data, "melichar")).sort();
      expect(zostalo).not.toContain(stara);
      expect(zostalo.filter((f) => f.endsWith(".mp3"))).toHaveLength(1);
      expect(zostalo).toEqual(expect.arrayContaining(["zoznam.json", "skupiny.json"]));
      const zoznam = JSON.parse(readFileSync(join(data, "melichar", "zoznam.json"), "utf8")) as { nazov: string; skupina: string }[];
      expect(zoznam.map((h) => [h.nazov, h.skupina])).toEqual([["Aha", "udiv"]]);
    } finally {
      rmSync(zdroj, { recursive: true, force: true });
      rmSync(data, { recursive: true, force: true });
    }
  });

  it("skupina.json: chybné polia sa nahradia predvolenými, nálady len známe", () => {
    expect(skupinaZDat("bieda-a-dlhy", { klaves: "0", nalady: ["smola", "radost"], ikona: 5 })).toEqual({
      id: "bieda-a-dlhy",
      nazov: "Bieda a dlhy",
      citat: "",
      ikona: "fuz",
      farba: "akcent",
      klaves: null,
      nalady: ["smola"],
    });
  });

  it("hlasitosť (predvolene 70 %, 0 = mlčí); frekvencia už nie je", async () => {
    const { cookie } = await registruj(server.port);
    const volaj = async (telo?: unknown) =>
      fetch(url("/api/" + (telo === undefined ? "ja" : "profil")), {
        method: telo === undefined ? "GET" : "PATCH",
        headers: { cookie, "x-naex": "1", "content-type": "application/json" },
        ...(telo === undefined ? {} : { body: JSON.stringify(telo) }),
      });
    const nastavenie = async (res: Response): Promise<Record<string, unknown>> => {
      const { melichar, melicharFrekvencia } = ((await res.json()) as { pouzivatel: Record<string, unknown> }).pouzivatel;
      return { melichar, melicharFrekvencia };
    };

    expect(await nastavenie(await volaj())).toEqual({ melichar: 70, melicharFrekvencia: undefined });
    expect(await nastavenie(await volaj({ melichar: 0 }))).toEqual({ melichar: 0, melicharFrekvencia: undefined });
    // Starší klient ešte pošle frekvenciu — server ju potichu ignoruje (Michal 2026-10-23).
    expect(await nastavenie(await volaj({ melichar: 40, melicharFrekvencia: 60 }))).toEqual({ melichar: 40, melicharFrekvencia: undefined });
    expect((await volaj({ melichar: 101 })).status).toBe(400);
    expect(await nastavenie(await volaj())).toEqual({ melichar: 40, melicharFrekvencia: undefined });
  });
});

// Nastavenia profilu (Michal 2026-10-19): zväčšenie karty pri prejdení myšou
// (150 – 400 %) a výber avatara z predvolených dedinských trosiek.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { GameServer } from "../src/server.ts";
import { registruj, testovaciServer } from "./pomocnik.ts";

let server: GameServer;
let zmaz: () => Promise<void>;

beforeAll(async () => {
  ({ server, zmaz } = await testovaciServer());
});

afterAll(async () => {
  await zmaz();
});

async function volaj(metoda: string, cesta: string, cookie: string, telo?: unknown): Promise<{ status: number; data: Record<string, unknown> }> {
  const res = await fetch(`http://127.0.0.1:${server.port}/api${cesta}`, {
    method: metoda,
    headers: { cookie, "x-naex": "1", ...(telo === undefined ? {} : { "content-type": "application/json" }) },
    ...(telo === undefined ? {} : { body: JSON.stringify(telo) }),
  });
  return { status: res.status, data: (await res.json()) as Record<string, unknown> };
}

describe("nastavenia profilu", () => {
  it("pohlavie (Michal 2026-10-22): predvolene neuvedené, muz / zena / null, iné nie", async () => {
    const { cookie } = await registruj(server.port);
    expect(((await volaj("GET", "/ja", cookie)).data.pouzivatel as { pohlavie: string | null }).pohlavie).toBeNull();

    const ok = await volaj("PATCH", "/profil", cookie, { pohlavie: "zena" });
    expect(ok.status).toBe(200);
    expect((ok.data.pouzivatel as { pohlavie: string }).pohlavie).toBe("zena");

    for (const zle of ["žena", "iné", 1, ""]) expect((await volaj("PATCH", "/profil", cookie, { pohlavie: zle })).status).toBe(400);
    expect(((await volaj("PATCH", "/profil", cookie, { pohlavie: null })).data.pouzivatel as { pohlavie: string | null }).pohlavie).toBeNull();
  });

  it("zväčšenie lupy: predvolene 200 %, uloží sa v rozsahu 150 – 400 %", async () => {
    const { cookie } = await registruj(server.port);
    const ja = await volaj("GET", "/ja", cookie);
    expect((ja.data.pouzivatel as { lupa: number }).lupa).toBe(200);

    const ok = await volaj("PATCH", "/profil", cookie, { lupa: 320 });
    expect(ok.status).toBe(200);
    expect((ok.data.pouzivatel as { lupa: number; meno: string }).lupa).toBe(320);

    for (const zle of [100, 450, "veľa"]) expect((await volaj("PATCH", "/profil", cookie, { lupa: zle })).status).toBe(400);
    expect(((await volaj("GET", "/ja", cookie)).data.pouzivatel as { lupa: number }).lupa).toBe(320);
  });

  it("farebná schéma: predvolene žiadna, uloží sa len id v správnom tvare", async () => {
    const { cookie } = await registruj(server.port);
    expect(((await volaj("GET", "/ja", cookie)).data.pouzivatel as { schema: string | null }).schema).toBeNull();

    const ok = await volaj("PATCH", "/profil", cookie, { schema: "noc" });
    expect(ok.status).toBe(200);
    expect((ok.data.pouzivatel as { schema: string }).schema).toBe("noc");

    for (const zle of ["", "Noc", "noc; drop", 3, "x".repeat(30)]) expect((await volaj("PATCH", "/profil", cookie, { schema: zle })).status).toBe(400);
    expect(((await volaj("GET", "/ja", cookie)).data.pouzivatel as { schema: string }).schema).toBe("noc");
  });

  it("pár farieb hráča (Michal 2026-10-27): predvolene žiadny, uloží sa id páru aj s ⇄", async () => {
    const { cookie } = await registruj(server.port);
    expect(((await volaj("GET", "/ja", cookie)).data.pouzivatel as { par: string | null }).par).toBeNull();

    const ok = await volaj("PATCH", "/profil", cookie, { par: "w67-prehod" });
    expect(ok.status).toBe(200);
    expect((ok.data.pouzivatel as { par: string }).par).toBe("w67-prehod");
    expect(((await volaj("PATCH", "/profil", cookie, { par: "w20" })).data.pouzivatel as { par: string }).par).toBe("w20");

    for (const zle of ["", "W20", "w20-x", "w1234", "20", 20, null, "w20-prehod; drop"]) {
      expect((await volaj("PATCH", "/profil", cookie, { par: zle })).status).toBe(400);
    }
    expect(((await volaj("GET", "/ja", cookie)).data.pouzivatel as { par: string }).par).toBe("w20");
  });

  it("zobrazenie skóre už nie je voľba (roadmapa #70): body sú len dlaždice, server skore ignoruje", async () => {
    const { cookie } = await registruj(server.port);
    expect((await volaj("GET", "/ja", cookie)).data.pouzivatel).not.toHaveProperty("skore");

    const ok = await volaj("PATCH", "/profil", cookie, { skore: "dva" });
    expect(ok.status).toBe(200);
    expect(ok.data.pouzivatel).not.toHaveProperty("skore");
  });

  it("klávesové skratky v partii (Michal 2026-10-22): predvolene zapnuté, vypínač len áno/nie", async () => {
    const { cookie } = await registruj(server.port);
    expect(((await volaj("GET", "/ja", cookie)).data.pouzivatel as { skratky: boolean }).skratky).toBe(true);
    expect(((await volaj("PATCH", "/profil", cookie, { skratky: false })).data.pouzivatel as { skratky: boolean }).skratky).toBe(false);
    for (const zle of [0, "nie", null]) expect((await volaj("PATCH", "/profil", cookie, { skratky: zle })).status).toBe(400);
    expect(((await volaj("GET", "/ja", cookie)).data.pouzivatel as { skratky: boolean }).skratky).toBe(false);
  });

  it("hráč si vyberie predvolený avatar, cudzie médium nie", async () => {
    const { cookie } = await registruj(server.port);
    const zoznam = (await volaj("GET", "/avatary", cookie)).data.avatary as string[];
    expect(zoznam.length).toBe(20);
    const zvoleny = zoznam[7] as string;

    const ok = await volaj("PUT", "/profil/avatar-predvoleny", cookie, { avatar: zvoleny });
    expect(ok.status).toBe(200);
    expect((ok.data.pouzivatel as { avatar: string }).avatar).toBe(zvoleny);

    expect((await volaj("PUT", "/profil/avatar-predvoleny", cookie, { avatar: "cudzie-medium" })).status).toBe(400);
    expect((await volaj("PUT", "/profil/avatar-predvoleny", "", { avatar: zvoleny })).status).toBe(401);
  });

  it("nápovedy Melichara (Michal 2026-10-24): predvolene zapnuté, videné sa pamätajú pri účte, vypínač a reset", async () => {
    const { cookie } = await registruj(server.port);
    expect((await volaj("GET", "/napovedy", cookie)).data).toEqual({ zapnute: true, videne: [] });

    expect((await volaj("POST", "/napovedy/videna", cookie, { id: "rola" })).data.videne).toEqual(["rola"]);
    // Druhýkrát sa nezapíše — každá nápoveda raz.
    await volaj("POST", "/napovedy/videna", cookie, { id: "rola" });
    await volaj("POST", "/napovedy/videna", cookie, { id: "pas-cigarety" });
    expect((await volaj("GET", "/napovedy", cookie)).data.videne).toEqual(["rola", "pas-cigarety"]);
    for (const zle of ["Rola!", "", 5, "x".repeat(41)]) expect((await volaj("POST", "/napovedy/videna", cookie, { id: zle })).status).toBe(400);

    const vyp = await volaj("PATCH", "/profil", cookie, { napovedy: false });
    expect((vyp.data.pouzivatel as { napovedy: boolean }).napovedy).toBe(false);
    expect((await volaj("GET", "/napovedy", cookie)).data.zapnute).toBe(false);
    expect((await volaj("PATCH", "/profil", cookie, { napovedy: "nie" })).status).toBe(400);

    await volaj("POST", "/napovedy/reset", cookie);
    expect((await volaj("GET", "/napovedy", cookie)).data.videne).toEqual([]);
    expect((await volaj("GET", "/napovedy", "")).status).toBe(401);
  });
});

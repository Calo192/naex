// Spätná väzba S-A (Michal 2026-10-27): nadpis „Jednou vetou“, povinná kategória,
// záložky stavu s počtami (otvorené = nové + prečítané), filter AI, „nebudeme“
// s dôvodom a „hotovo“ s novinkou.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { GameServer } from "../src/server.ts";
import { TEST_ADMIN, nastavUroven, prihlas, registruj, testovaciServer } from "./pomocnik.ts";

let server: GameServer;
let zmaz: () => Promise<void>;
let admin: string;
let subadmin: string;
let hrac: string;
let robot: string;

async function volaj<T>(cookie: string, metoda: string, cesta: string, telo?: unknown): Promise<{ status: number; data: T }> {
  const res = await fetch(`http://127.0.0.1:${server.port}/api${cesta}`, {
    method: metoda,
    headers: { cookie, "x-naex": "1", ...(telo === undefined ? {} : { "content-type": "application/json" }) },
    body: telo === undefined ? undefined : JSON.stringify(telo),
  });
  return { status: res.status, data: (await res.json()) as T };
}

interface Nazor {
  id: number;
  nadpis: string;
  text: string;
  stav: string;
  dovod: string;
  kategoria: string;
  novinka: { id: number; datum: string; nadpis: string } | null;
  autor: { ai: boolean };
}
type Pocty = Record<"otvorene" | "planovane" | "hotove" | "zamietnute", { ludia: number; ai: number }>;
const zoznam = (cookie: string, q = ""): Promise<{ status: number; data: { nazory: Nazor[]; pocty: Pocty } }> => volaj(cookie, "GET", `/nazory${q}`);

beforeAll(async () => {
  ({ server, zmaz } = await testovaciServer());
  admin = await prihlas(server.port, TEST_ADMIN.login, TEST_ADMIN.heslo);
  subadmin = (await registruj(server.port)).cookie;
  await nastavUroven(server.port, admin, subadmin, "subadmin");
  hrac = (await registruj(server.port)).cookie;
  await nastavUroven(server.port, admin, hrac, "hrac");
  robot = (await registruj(server.port)).cookie;
  await nastavUroven(server.port, admin, robot, "hrac");
  const idRobota = (await volaj<{ pouzivatel: { id: number } }>(robot, "GET", "/ja")).data.pouzivatel.id;
  expect((await volaj(admin, "PATCH", `/admin/pouzivatelia/${idRobota}`, { ai: true })).status).toBe(200);
});

afterAll(async () => {
  await zmaz();
});

describe("spätná väzba S-A", () => {
  it("kategória je povinná, nadpis voliteľný a jednoriadkový", async () => {
    expect((await volaj(hrac, "POST", "/nazory", { text: "Bez kategórie to nejde." })).status).toBe(400);
    const bez = await volaj<{ chyba: string }>(hrac, "POST", "/nazory", { kategoria: "", text: "Prázdna kategória." });
    expect(bez.status).toBe(400);
    expect(bez.data.chyba).toBe("Vyber, o čom píšeš.");
    expect((await volaj(hrac, "POST", "/nazory", { kategoria: "chyba", nadpis: "x".repeat(121), text: "Príliš dlhý nadpis." })).status).toBe(400);

    const s = await volaj<{ id: number }>(hrac, "POST", "/nazory", { kategoria: "chyba", nadpis: " Puška  v Dedičstve\nsa nesčítava ", text: "Dal som dve Pušky a počítala sa jedna." });
    expect(s.status).toBe(201);
    const bezNadpisu = await volaj<{ id: number }>(hrac, "POST", "/nazory", { kategoria: "napad", text: "Starý spôsob bez nadpisu. Druhá veta." });
    const { nazory } = (await zoznam(hrac)).data;
    expect(nazory.find((n) => n.id === s.data.id)).toMatchObject({ nadpis: "Puška v Dedičstve sa nesčítava", stav: "nove", dovod: "", novinka: null });
    expect(nazory.find((n) => n.id === bezNadpisu.data.id)?.nadpis).toBe("");
    // Autor nadpis upraví, cudzí nie.
    expect((await volaj(robot, "PATCH", `/nazory/${s.data.id}`, { nadpis: "Cudzí" })).status).toBe(403);
    expect((await volaj(hrac, "PATCH", `/nazory/${s.data.id}`, { nadpis: "Puška sa nesčítava" })).status).toBe(200);
  });

  it("záložky stavu: otvorené = nové + prečítané, počty od ľudí a od AI, filter ai", async () => {
    const odAi = await volaj<{ id: number }>(robot, "POST", "/nazory", { kategoria: "pravidla", text: "Postreh AI playtestera po partii." });
    expect(odAi.status).toBe(201);
    const { nazory } = (await zoznam(hrac)).data;
    const prvy = nazory.find((n) => n.nadpis === "Puška sa nesčítava") as Nazor;
    expect((await volaj(subadmin, "PATCH", `/nazory/${prvy.id}`, { stav: "prijate" })).status).toBe(200);

    const otvorene = await zoznam(hrac, "?stav=otvorene");
    expect(otvorene.data.nazory.map((n) => n.stav).sort()).toEqual(["nove", "nove", "prijate"]);
    expect(otvorene.data.pocty.otvorene).toEqual({ ludia: 2, ai: 1 });
    expect(otvorene.data.pocty.hotove).toEqual({ ludia: 0, ai: 0 });
    expect((await zoznam(hrac, "?stav=otvorene&ai=0")).data.nazory.every((n) => !n.autor.ai)).toBe(true);
    expect((await zoznam(hrac, "?stav=otvorene&ai=1")).data.nazory.map((n) => n.id)).toEqual([odAi.data.id]);
    // Kategória filtruje aj počty.
    expect((await zoznam(hrac, "?kategoria=pravidla")).data.pocty.otvorene).toEqual({ ludia: 0, ai: 1 });
    expect((await zoznam(hrac, "?stav=vsetko")).status).toBe(400);

    // Správca má v otvorených nové hore, hráč len podľa času.
    const preSpravcu = (await zoznam(admin, "?stav=otvorene&triedenie=nove")).data.nazory;
    expect(preSpravcu.at(-1)?.stav).toBe("prijate");
  });

  it("„nebudeme robiť“ len s jednou vetou prečo; iný stav dôvod zmaže", async () => {
    const id = (await zoznam(hrac, "?kategoria=napad")).data.nazory[0]?.id as number;
    expect((await volaj(hrac, "PATCH", `/nazory/${id}`, { stav: "zamietnute", dovod: "Nie." })).status).toBe(403);
    const bez = await volaj<{ chyba: string }>(admin, "PATCH", `/nazory/${id}`, { stav: "zamietnute" });
    expect(bez.status).toBe(400);
    expect((await volaj(admin, "PATCH", `/nazory/${id}`, { stav: "zamietnute", dovod: "x".repeat(201) })).status).toBe(400);
    expect((await volaj(admin, "PATCH", `/nazory/${id}`, { stav: "zamietnute", dovod: "Hra je striktne pre dvoch hráčov." })).status).toBe(200);
    const z = (await zoznam(hrac, "?stav=zamietnute")).data;
    expect(z.nazory.map((n) => [n.id, n.dovod])).toEqual([[id, "Hra je striktne pre dvoch hráčov."]]);
    expect(z.pocty.zamietnute).toEqual({ ludia: 1, ai: 0 });
    expect((await volaj(admin, "PATCH", `/nazory/${id}`, { stav: "planovane" })).status).toBe(200);
    expect((await zoznam(hrac, "?stav=planovane")).data.nazory.find((n) => n.id === id)?.dovod).toBe("");
  });

  it("„hotovo“ s novinkou: len existujúca, len pri hotovo, zmazaná novinka odkaz zruší", async () => {
    const nov = await volaj<{ novinka: { id: number } }>(admin, "POST", "/admin/novinky", { datum: "2026-10-22", kategoria: "opravy", nadpis: "Puška sa sčíta", text: "Dve Pušky v Dedičstve sa už sčítajú." });
    const novinka = nov.data.novinka.id;
    const id = (await zoznam(hrac, "?stav=otvorene&ai=0")).data.nazory.find((n) => n.kategoria === "chyba")?.id as number;
    expect((await volaj(admin, "PATCH", `/nazory/${id}`, { stav: "planovane", novinka })).status).toBe(400);
    expect((await volaj(admin, "PATCH", `/nazory/${id}`, { stav: "hotove", novinka: 99999 })).status).toBe(400);
    expect((await volaj(hrac, "PATCH", `/nazory/${id}`, { novinka })).status).toBe(403);
    expect((await volaj(subadmin, "PATCH", `/nazory/${id}`, { stav: "hotove", novinka })).status).toBe(200);
    let n = (await zoznam(hrac, "?stav=hotove")).data.nazory.find((x) => x.id === id);
    expect(n?.novinka).toEqual({ id: novinka, datum: "2026-10-22", nadpis: "Puška sa sčíta" });
    // Zmena textu autorom novinku nechá; novinka sa dá zrušiť null-om.
    expect((await volaj(hrac, "PATCH", `/nazory/${id}`, { text: "Dal som dve Pušky a počítala sa len jedna." })).status).toBe(200);
    expect((await zoznam(hrac, "?stav=hotove")).data.nazory.find((x) => x.id === id)?.novinka?.id).toBe(novinka);
    expect((await volaj(admin, "DELETE", `/admin/novinky/${novinka}`)).status).toBe(200);
    n = (await zoznam(hrac, "?stav=hotove")).data.nazory.find((x) => x.id === id);
    expect(n?.stav).toBe("hotove");
    expect(n?.novinka).toBeNull();
  });

  it("bez filtra stavu vráti všetko (nástroje agentov) a staré kategórie platia", async () => {
    const vsetky = (await zoznam(admin, "?triedenie=nove")).data.nazory;
    expect(vsetky.length).toBe(3);
    for (const k of ["pravidla", "karty", "hranie", "web", "chyba", "napad", "ine"]) expect((await zoznam(hrac, `?kategoria=${k}`)).status).toBe(200);
  });
});

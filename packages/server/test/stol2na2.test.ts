// Stoly 2 na 2 na skutočnom serveri: štyri miesta, boti, skrytá ruka súpera, chat len partnerovi,
// vzdanie potvrdzujú obaja, rebríček len z partií štyroch ľudí.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import type { ClientState, Command, Miesto } from "@naex/core";
import type { GameServer } from "../src/server.ts";
import { TEST_ADMIN, registruj, testovaciServer } from "./pomocnik.ts";

let server: GameServer;
let zmaz: () => Promise<void>;

beforeAll(async () => {
  ({ server, zmaz } = await testovaciServer(TEST_ADMIN, { botPauzaMs: 0 }));
});

afterAll(async () => {
  await zmaz();
});

interface SpravaStola {
  readonly code: string;
  readonly miesto: Miesto;
  readonly zacala: boolean;
  readonly navrhVzdania: Miesto | null;
  readonly miesta: readonly ({ readonly meno: string; readonly bot: boolean; readonly pripojeny: boolean } | null)[];
}

class Klient {
  readonly ws: WebSocket;
  view: ClientState | null = null;
  stol: SpravaStola | null = null;
  readonly surove: string[] = [];
  readonly chaty: { od: number; text: string }[] = [];
  readonly signaly: { od: number; id: string }[] = [];
  readonly chyby: string[] = [];

  constructor(cookie: string) {
    this.ws = new WebSocket(`ws://127.0.0.1:${server.port}/ws`, { headers: { cookie } });
    this.ws.on("message", (raw) => {
      const text = String(raw);
      this.surove.push(text);
      const m = JSON.parse(text) as { type: string; [k: string]: unknown };
      if (m.type === "state") this.view = m.view as ClientState;
      if (m.type === "stol2na2") this.stol = m as unknown as SpravaStola;
      if (m.type === "chat2na2") this.chaty.push(m as unknown as { od: number; text: string });
      if (m.type === "signal2na2") this.signaly.push(m as unknown as { od: number; id: string });
      if (m.type === "error") this.chyby.push(String(m.text));
    });
  }

  async otvorene(): Promise<void> {
    if (this.ws.readyState === WebSocket.OPEN) return;
    await new Promise<void>((r) => this.ws.once("open", () => r()));
  }

  posli(m: unknown): void {
    this.ws.send(JSON.stringify(m));
  }
}

async function cakaj(podmienka: () => boolean, popis: string): Promise<void> {
  for (let i = 0; i < 6000; i++) {
    if (podmienka()) return;
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error(`nedočkal som sa: ${popis}`);
}

async function novy(): Promise<Klient> {
  const { cookie } = await registruj(server.port);
  const k = new Klient(cookie);
  await k.otvorene();
  return k;
}

/** Štyria ľudia za jedným stolom, partia začala. */
async function plnyStol(): Promise<Klient[]> {
  const a = await novy();
  a.posli({ type: "stol2na2Zaloz" });
  await cakaj(() => a.stol !== null, "stôl");
  const code = (a.stol as SpravaStola).code;
  const ostatni = await Promise.all([novy(), novy(), novy()]);
  for (const k of ostatni) {
    k.posli({ type: "stol2na2Pridaj", code });
    await cakaj(() => k.stol !== null, "pridanie");
  }
  const vsetci = [a, ...ostatni];
  await cakaj(() => vsetci.every((k) => k.view !== null), "začiatok partie");
  return vsetci;
}

function zatvor(k: readonly Klient[]): void {
  for (const x of k) x.ws.close();
}

describe("stoly 2 na 2", () => {
  it("štvrtý hráč spustí partiu, každý má svoje miesto a pohľad svojho tímu", async () => {
    const k = await plnyStol();
    expect(k.map((x) => x.stol?.miesto)).toEqual([0, 1, 2, 3]);
    for (const x of k) {
      expect(x.view?.format).toBe("2na2");
      expect(x.view?.miesto).toBe(x.stol?.miesto);
    }
    zatvor(k);
  });

  it("nemenné pravidlo 2: ruku súpera a balíčky nikto nedostane, ruku partnera áno", async () => {
    const k = await plnyStol();
    const [a, b, c, d] = k as [Klient, Klient, Klient, Klient];
    const uidy = (x: Klient): number[] => (x.view?.ruka ?? []).map((u) => u.uid);
    const textA = a.surove.join("\n");
    for (const uid of [...uidy(b), ...uidy(d)]) expect(textA).not.toContain(`"uid":${uid},"defId"`);
    expect(a.view?.rukaPartnera?.map((u) => u.uid)).toEqual(uidy(c));
    expect(textA).not.toContain('"doberaci":[');
    expect(textA).not.toContain('"naradie":[');
    zatvor(k);
  });

  it("chat a signál dostane len partner, súper nič; cudzí signál sa odmietne", async () => {
    const k = await plnyStol();
    const [a, b, c, d] = k as [Klient, Klient, Klient, Klient];
    a.posli({ type: "stol2na2Chat", text: "  drž sa  " });
    await cakaj(() => c.chaty.length === 1, "chat partnerovi");
    expect(c.chaty[0]).toMatchObject({ od: 0, text: "drž sa" });
    expect(a.chaty).toHaveLength(1);
    a.posli({ type: "stol2na2Signal", id: "dam_naex" });
    await cakaj(() => c.signaly.length === 1, "signál partnerovi");
    a.posli({ type: "stol2na2Signal", id: "<script>" });
    await cakaj(() => a.chyby.includes("Taký signál nie je."), "odmietnutie");
    expect(b.chaty).toHaveLength(0);
    expect(d.chaty).toHaveLength(0);
    expect(b.signaly).toHaveLength(0);
    expect(d.signaly).toHaveLength(0);
    expect(b.surove.join("\n")).not.toContain("drž sa");
    zatvor(k);
  });

  it("vzdanie: jeden navrhne, súper o tom nevie, až partner to potvrdí; príkaz vzdat neprejde", async () => {
    const k = await plnyStol();
    const [a, b, c] = k as [Klient, Klient, Klient, Klient];
    a.posli({ type: "stol2na2Cmd", cmd: { type: "vzdat" } satisfies Command });
    await cakaj(() => a.chyby.includes("Vzdanie musí potvrdiť aj partner."), "odmietnutie príkazu");
    a.posli({ type: "stol2na2Vzdat" });
    await cakaj(() => c.stol?.navrhVzdania === 0, "návrh partnerovi");
    expect(b.stol?.navrhVzdania).toBeNull();
    expect(a.view?.koniec).toBeNull();
    c.posli({ type: "stol2na2Vzdat" });
    await cakaj(() => a.view?.koniec != null && b.view?.koniec != null, "koniec");
    expect(b.view?.koniec?.vitaz).toBe(1);
    zatvor(k);
  });

  it("výsledok partie štyroch ľudí je v rebríčku, partia s botom nie", async () => {
    const rebricek = async (): Promise<{ meno: string; vyhry: number; prehry: number }[]> =>
      (await (await fetch(`http://127.0.0.1:${server.port}/api/rebricek-2na2`)).json()) as { meno: string; vyhry: number; prehry: number }[];
    const k = await plnyStol();
    const [a, b, c] = k as [Klient, Klient, Klient, Klient];
    a.posli({ type: "stol2na2Vzdat" });
    await cakaj(() => c.stol?.navrhVzdania === 0, "návrh");
    c.posli({ type: "stol2na2Vzdat" });
    await cakaj(() => b.view?.koniec != null, "koniec");
    const menoA = a.stol?.miesta[0]?.meno;
    const menoB = a.stol?.miesta[1]?.meno;
    let tabulka = await rebricek();
    expect(tabulka.find((r) => r.meno === menoB)).toMatchObject({ vyhry: 1, prehry: 0 });
    expect(tabulka.find((r) => r.meno === menoA)).toMatchObject({ vyhry: 0, prehry: 1 });
    zatvor(k);

    const samotny = await novy();
    samotny.posli({ type: "stol2na2Zaloz", boti: [1, 2, 3] });
    await cakaj(() => samotny.view !== null, "začiatok");
    const meno = samotny.stol?.miesta[0]?.meno;
    samotny.posli({ type: "stol2na2Vzdat" });
    await cakaj(() => samotny.view?.koniec != null, "vzdanie");
    tabulka = await rebricek();
    expect(tabulka.find((r) => r.meno === meno)).toBeUndefined();
    zatvor([samotny]);
  });

  it("kontumácia sa dá až po čase a po odchode člena tímu", async () => {
    const k = await plnyStol();
    const [a, b] = k as [Klient, Klient, Klient, Klient];
    a.posli({ type: "stol2na2Kontumacia" });
    await cakaj(() => a.chyby.includes("Súperi sú pripojení."), "súperi pripojení");
    b.ws.close();
    await cakaj(() => a.stol?.miesta[1]?.pripojeny === false, "odpojenie vidno");
    a.posli({ type: "stol2na2Kontumacia" });
    await cakaj(() => a.chyby.some((c) => c.startsWith("Súper je odpojený len chvíľu")), "ešte nie");
    zatvor(k);
  });

  it("cudzí príkaz mimo ťahu neprejde a chyba nezhodí stôl", async () => {
    const k = await plnyStol();
    const a = k[0] as Klient;
    a.posli({ type: "stol2na2Cmd", cmd: { type: "pass" } });
    await cakaj(() => a.chyby.length > 0, "chyba");
    expect(a.view?.koniec).toBeNull();
    zatvor(k);
  });

  it("človek a traja boti dohrajú partiu, jeho tímu je kapitánom on", async () => {
    const a = await novy();
    a.posli({ type: "stol2na2Zaloz", boti: [1, 2, 3] });
    await cakaj(() => a.view !== null, "začiatok");
    expect(a.stol?.miesta.slice(1).every((m) => m?.bot === true)).toBe(true);
    expect(a.view?.kapitani?.[0]).toBe(0);
    a.posli({ type: "stol2na2Vzdat" });
    await cakaj(() => a.view?.koniec != null, "vzdanie s botom ako partnerom je hneď");
    expect(a.view?.koniec?.vitaz).toBe(1);
    zatvor([a]);
  });

  it("náhodné párovanie zaplní jeden verejný stôl a doplnenie botmi spustí partiu", async () => {
    const a = await novy();
    a.posli({ type: "stol2na2Nahodne" });
    await cakaj(() => a.stol !== null, "stôl");
    const b = await novy();
    b.posli({ type: "stol2na2Nahodne" });
    await cakaj(() => b.stol !== null, "párovanie");
    expect(b.stol?.code).toBe(a.stol?.code);
    b.posli({ type: "stol2na2Boti" });
    await cakaj(() => b.chyby.length > 0, "botov dopĺňa len zakladateľ");
    a.posli({ type: "stol2na2Boti" });
    await cakaj(() => a.view !== null && b.view !== null, "partia začala");
    zatvor([a, b]);
  });
});

// M7 — integračný test servera: miestnosti, autorizácia, filtrovanie,
// reconnect (M9). Dva ws klienty proti skutočnému serveru na náhodnom porte.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import { createGameServer, type GameServer } from "../src/server.ts";

interface Msg {
  type: string;
  [k: string]: unknown;
}

/** Testovací klient: fronta správ + čakanie na konkrétny typ. */
class Klient {
  private readonly ws: WebSocket;
  private readonly fronta: Msg[] = [];
  private cakajuci: { rieš: (m: Msg) => void; typ: string } | null = null;

  constructor(port: number) {
    this.ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    this.ws.on("message", (raw) => {
      const msg = JSON.parse(String(raw)) as Msg;
      if (this.cakajuci !== null && msg.type === this.cakajuci.typ) {
        const { rieš } = this.cakajuci;
        this.cakajuci = null;
        rieš(msg);
      } else {
        this.fronta.push(msg);
      }
    });
  }

  async otvorene(): Promise<void> {
    if (this.ws.readyState === WebSocket.OPEN) return;
    await new Promise<void>((rieš, zamietni) => {
      this.ws.once("open", rieš);
      this.ws.once("error", zamietni);
    });
  }

  posli(msg: unknown): void {
    this.ws.send(JSON.stringify(msg));
  }

  /** Vráti najbližšiu správu daného typu (z fronty alebo počká, max 5 s). */
  async cakaj(typ: string): Promise<Msg> {
    const vFronte = this.fronta.findIndex((m) => m.type === typ);
    if (vFronte !== -1) return this.fronta.splice(vFronte, 1)[0] as Msg;
    return await new Promise<Msg>((rieš, zamietni) => {
      const timeout = setTimeout(() => {
        this.cakajuci = null;
        zamietni(new Error(`Nedošla správa typu ${typ}`));
      }, 5000);
      this.cakajuci = {
        typ,
        rieš: (m) => {
          clearTimeout(timeout);
          rieš(m);
        },
      };
    });
  }

  zavri(): void {
    this.ws.close();
  }
}

let server: GameServer;

beforeAll(async () => {
  server = await createGameServer({ port: 0 });
});

afterAll(async () => {
  await server.close();
});

describe("M7 — server", () => {
  it("miestnosť, štart hry, autorizácia a filtrovaný pohľad", async () => {
    const a = new Klient(server.port);
    await a.otvorene();
    a.posli({ type: "create" });
    const privitanieA = await a.cakaj("privitanie");
    expect(privitanieA.seat).toBe(0);
    const kod = privitanieA.code as string;
    expect(kod).toMatch(/^[A-Z2-9]{4}$/);

    const b = new Klient(server.port);
    await b.otvorene();
    b.posli({ type: "join", code: kod });
    const privitanieB = await b.cakaj("privitanie");
    expect(privitanieB.seat).toBe(1);

    // A dostane oznam o pripojení súpera hneď pri jeho príchode — zožerieme
    // ho, aby neskoršie čakania čítali čerstvé správy.
    const prvePripojenie = await a.cakaj("superPripojeny");
    expect(prvePripojenie.connected).toBe(true);

    // Obaja dostanú stav; pohľad neobsahuje polia s obsahom balíčkov.
    const stavA = await a.cakaj("state");
    const stavB = await b.cakaj("state");
    const viewA = stavA.view as { ja: number; naTahu: number; lokalityVHre: { uid: number }[] };
    const viewB = stavB.view as { ja: number; naTahu: number };
    expect(viewA.ja).toBe(0);
    expect(viewB.ja).toBe(1);
    const jsonA = JSON.stringify(stavA);
    // Ruka súpera a doberacie balíčky sa posielajú len ako počty.
    expect(jsonA).not.toContain('"doberaci":[');
    expect(jsonA).toContain('"doberaciPocet"');
    expect(jsonA).toContain('"rukaPocet"');

    // Hráč mimo poradia dostane chybu; stav sa nezmení.
    const naTahu = viewA.naTahu;
    const mimoPoradia = naTahu === 0 ? b : a;
    const naRade = naTahu === 0 ? a : b;
    mimoPoradia.posli({ type: "cmd", cmd: { type: "pass" } });
    const chyba = await mimoPoradia.cakaj("error");
    expect(String(chyba.text)).toContain("Nie si na ťahu");

    // Legálny príkaz útočníka posunie hru do draftu obom hráčom.
    const lokalita = viewA.lokalityVHre[0];
    expect(lokalita).toBeDefined();
    naRade.posli({
      type: "cmd",
      cmd: { type: "chooseLocation", uid: lokalita?.uid, otocena: false },
    });
    const novyA = await a.cakaj("state");
    const novyB = await b.cakaj("state");
    expect((novyA.view as { faza: string }).faza).toBe("draft");
    expect((novyB.view as { faza: string }).faza).toBe("draft");

    // Tretí hráč sa nedostane dnu.
    const c = new Klient(server.port);
    await c.otvorene();
    c.posli({ type: "join", code: kod });
    const plna = await c.cakaj("error");
    expect(String(plna.text)).toContain("plná");
    c.zavri();

    // M9: výpadok a návrat s tokenom.
    b.zavri();
    const odpojeny = await a.cakaj("superPripojeny");
    expect(odpojeny.connected).toBe(false);

    const b2 = new Klient(server.port);
    await b2.otvorene();
    b2.posli({ type: "rejoin", code: kod, token: privitanieB.token });
    const spat = await b2.cakaj("privitanie");
    expect(spat.seat).toBe(1);
    expect(spat.started).toBe(true);
    const stavPoNavrate = await b2.cakaj("state");
    expect((stavPoNavrate.view as { faza: string }).faza).toBe("draft");
    const pripojeny = await a.cakaj("superPripojeny");
    expect(pripojeny.connected).toBe(true);

    // M9: druhý tab s tým istým tokenom preberá pripojenie.
    const b3 = new Klient(server.port);
    await b3.otvorene();
    b3.posli({ type: "rejoin", code: kod, token: privitanieB.token });
    await b3.cakaj("privitanie");
    const prebrate = await b2.cakaj("error");
    expect(String(prebrate.text)).toContain("prevzal");

    a.zavri();
    b3.zavri();
  });

  it("neexistujúci kód a neplatný token", async () => {
    const klient = new Klient(server.port);
    await klient.otvorene();
    klient.posli({ type: "join", code: "XXXX" });
    const chyba = await klient.cakaj("error");
    expect(String(chyba.text)).toContain("neexistuje");

    klient.posli({ type: "create" });
    const privitanie = await klient.cakaj("privitanie");
    const zly = new Klient(server.port);
    await zly.otvorene();
    zly.posli({ type: "rejoin", code: privitanie.code, token: "podvrh" });
    const zlaOdpoved = await zly.cakaj("error");
    expect(String(zlaOdpoved.text)).toContain("token");

    klient.zavri();
    zly.zavri();
  });
});

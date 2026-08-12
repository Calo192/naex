// E2E (M7+M8): dvaja klienti odohrajú CELÚ partiu cez server, pričom robot
// sa rozhoduje VÝHRADNE podľa toho, čo vidí klient (ClientState + voľby) —
// presne ako hráč myšou v UI. Zároveň sa pri každej správe kontroluje, že
// zo servera neodišli žiadne skryté dáta.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import type { ClientState, Command } from "@naex/core";
import { posunMarker } from "@naex/core";
import { createGameServer, type GameServer } from "../src/server.ts";

interface StavMsg {
  type: "state";
  view: ClientState;
}

class Robot {
  view: ClientState | null = null;
  private readonly ws: WebSocket;
  private cakajuci: (() => void) | null = null;
  privitanie: { code?: string; token?: string; seat?: number } = {};
  chyby: string[] = [];

  constructor(port: number) {
    this.ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    this.ws.on("message", (raw) => {
      const text = String(raw);
      const msg = JSON.parse(text) as { type: string; [k: string]: unknown };
      if (msg.type === "state") {
        // Bezpečnostná kontrola pri KAŽDEJ správe: obsah balíčkov a ruka
        // súpera nesmú odísť zo servera.
        expect(text).not.toContain('"doberaci":[');
        expect(text).not.toContain('"spolocnyBalicek":[');
        const view = (msg as unknown as StavMsg).view;
        for (const hrac of view.hraci) {
          expect(hrac).not.toHaveProperty("ruka");
          expect(hrac).not.toHaveProperty("doberaci");
        }
        this.view = view;
        this.cakajuci?.();
        this.cakajuci = null;
      } else if (msg.type === "privitanie") {
        this.privitanie = msg as typeof this.privitanie;
      } else if (msg.type === "error") {
        this.chyby.push(String(msg.text));
      }
    });
  }

  async otvorene(): Promise<void> {
    if (this.ws.readyState === WebSocket.OPEN) return;
    await new Promise<void>((rieš, zamietni) => {
      this.ws.once("open", () => rieš());
      this.ws.once("error", zamietni);
    });
  }

  posli(msg: unknown): void {
    this.ws.send(JSON.stringify(msg));
  }

  async novyStav(): Promise<void> {
    await new Promise<void>((rieš, zamietni) => {
      const t = setTimeout(() => zamietni(new Error("nedošiel stav")), 5000);
      this.cakajuci = () => {
        clearTimeout(t);
        rieš();
      };
    });
  }

  zavri(): void {
    this.ws.close();
  }

  /** Ťah odvodený len z klientskeho pohľadu — zrkadlí možnosti UI. */
  vyberTah(): Command {
    const view = this.view;
    if (view === null) throw new Error("bez stavu");
    const ja = view.ja;

    switch (view.faza) {
      case "volbaCiela": {
        const lok = view.lokalityVHre[0];
        if (lok === undefined) throw new Error("niet lokalít");
        return { type: "chooseLocation", uid: lok.uid, otocena: lok.uid % 2 === 0 };
      }
      case "draft": {
        const cigarety = 1;
        const karty = view.senok.slice(0, Math.min(3 - cigarety, view.senok.length));
        return { type: "draft", cigarety, karty: karty.map((k) => k.uid) };
      }
      case "zhromazdenie": {
        const zostava = view.zhromazdenieStav?.zostavaLimit[ja] ?? 0;
        // Priznaj kliatbu, ak nejakú máš — zbavuje ruku balastu.
        const kliatba = view.ruka.find((k) =>
          ["dlh", "cirhoza", "abstak", "milujuca_manzelka"].includes(k.defId),
        );
        if (kliatba !== undefined) return { type: "place", uid: kliatba.uid, target: "priznanie" };
        if (zostava > 0) {
          // Prvá karta, ktorá nie je Nástroj (Nástroj vedľa Nástroja je
          // zakázaný — robot sa mu jednoducho vyhne).
          const nastroje = new Set(
            ["cigorky", "nealko", "noviny", "pasca", "puska", "svaty_text", "vinko", "vyherny_automat"],
          );
          const karta = view.ruka.find((k) => !nastroje.has(k.defId));
          if (karta !== undefined) return { type: "place", uid: karta.uid, target: "vlastna" };
        }
        return { type: "pass" };
      }
      case "pitka":
        return { type: "skipNaex" };
      case "bitka": {
        const b = view.bitkaStav;
        if (b === null) throw new Error("bitka bez stavu");
        if (b.krok === "exekutor") {
          const volba = view.volbyExekutor?.[0];
          if (volba === undefined) throw new Error("exekútor bez volieb");
          return { type: "exekutorTool", defId: volba.defId, kde: volba.kde };
        }
        if (b.krok === "pohorsenie" || b.krok === "prebytok") {
          const vyluceny = view.ciel?.typ === "starsi" ? view.ciel.elderId : null;
          const smerK = ja === 0 ? 1 : 0;
          const elder = view.starsi.find(
            (e) =>
              !e.nahradeny &&
              e.elderId !== (b.krok === "prebytok" ? vyluceny : null) &&
              !(b.krok === "pohorsenie" && b.pohnuteMarkery.includes(e.elderId)) &&
              posunMarker(e, smerK, b.krok === "pohorsenie") !== null,
          );
          if (elder === undefined) throw new Error(`${b.krok}: žiadny posúvateľný marker`);
          return b.krok === "pohorsenie"
            ? { type: "pohorsenie", elderId: elder.elderId }
            : { type: "prebytok", elderId: elder.elderId };
        }
        if (b.krok === "nahrada") {
          const volba = view.volbyNahrada?.[0];
          if (volba === undefined) throw new Error("náhrada bez volieb");
          return { type: "nahrada", defId: volba.defId, kde: volba.kde, marker: 4 };
        }
        return { type: "skipLiecba" };
      }
      default:
        throw new Error(`nečakaná fáza ${view.faza}`);
    }
  }
}

let server: GameServer;

beforeAll(async () => {
  server = await createGameServer({ port: 0 });
});

afterAll(async () => {
  await server.close();
});

describe("E2E — celá partia cez server", () => {
  it("dvaja klienti dohrajú hru len z klientskeho pohľadu", async () => {
    const a = new Robot(server.port);
    await a.otvorene();
    a.posli({ type: "create" });
    for (let i = 0; i < 50 && a.privitanie.code === undefined; i++) {
      await new Promise((r) => setTimeout(r, 20));
    }
    const kod = a.privitanie.code;
    expect(kod).toBeDefined();

    const b = new Robot(server.port);
    await b.otvorene();
    const cakajA = a.novyStav();
    const cakajB = b.novyStav();
    b.posli({ type: "join", code: kod });
    await Promise.all([cakajA, cakajB]);

    const roboti = [a, b] as const;
    let tahov = 0;
    while (a.view?.koniec == null && tahov < 3000) {
      tahov++;
      const naTahu = a.view?.naTahu ?? null;
      expect(naTahu, `nikto nie je na ťahu (fáza ${a.view?.faza})`).not.toBeNull();
      if (naTahu === null) break;
      const seatA = a.privitanie.seat as number;
      const robot = roboti[naTahu === seatA ? 0 : 1] as Robot;
      const cmd = robot.vyberTah();
      const cakania = [a.novyStav(), b.novyStav()];
      robot.posli({ type: "cmd", cmd });
      await Promise.all(cakania);
      expect(robot.chyby, `server odmietol ${JSON.stringify(cmd)}`).toEqual([]);
    }

    expect(a.view?.koniec).not.toBeNull();
    expect(b.view?.koniec).not.toBeNull();
    expect(tahov).toBeGreaterThan(20);

    a.zavri();
    b.zavri();
  }, 60_000);
});

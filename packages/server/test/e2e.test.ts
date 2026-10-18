// E2E (M7+M8): dvaja klienti odohrajú CELÚ partiu cez server, pričom robot
// sa rozhoduje VÝHRADNE podľa toho, čo vidí klient (ClientState + voľby) —
// presne ako hráč myšou v UI. Zároveň sa pri každej správe kontroluje, že
// zo servera neodišli žiadne skryté dáta.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import type { ClientState, Command } from "@naex/core";
import { cieleVykladania, posunMarker } from "@naex/core";
import type { GameServer } from "../src/server.ts";
import { loadDataFromDisk } from "../src/server.ts";
import { TEST_ADMIN, prihlas, registruj, testovaciServer } from "./pomocnik.ts";

/** Dáta sady pre pravidlá vykladania — robot ich pozná ako hráč (verejné karty). */
const DATA = loadDataFromDisk();

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

  constructor(port: number, cookie: string) {
    this.ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, { headers: { cookie } });
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
        // Odmietnutý ťah: stav nepríde — čakanie ukončíme hneď, test vypíše dôvod.
        this.cakajuci?.();
        this.cakajuci = null;
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
      const t = setTimeout(() => zamietni(new Error("nedošiel stav")), 15_000);
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
        const d = view.draftStav;
        const [prva, druha] = d?.mojBalicek ?? [];
        if (d?.krok === "stavba" && prva !== undefined && druha !== undefined) {
          return { type: "stavbaSenku", doSenku: prva.uid, odhod: druha.uid };
        }
        // Najviac dve karty zo šenku: za cigaretu, inak za poldeci (2 karty).
        const karta = view.senok[0];
        if (karta === undefined || d === null || (d.noveKarty[ja] >= 2 && d.kredit[ja] === 0)) return { type: "draftStop" };
        if (d.kredit[ja] > 0) return { type: "draftBer", uid: karta.uid };
        if (view.hraci[ja].cigarety > 0) return { type: "draftBer", uid: karta.uid, platba: "cigareta" };
        if (view.hraci[ja].poldeciPlne > 0) return { type: "draftBer", uid: karta.uid, platba: "poldeci" };
        return { type: "draftStop" };
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
          // Ako UI: len karta, ktorú pravidlá na tvoju stranu pustia (napr. Pes k zvieraťu nie).
          const karta = view.ruka.find(
            (k) => !nastroje.has(k.defId) && cieleVykladania(DATA, view.strany, ja, k, zostava).includes("vlastna"),
          );
          if (karta !== undefined) return { type: "place", uid: karta.uid, target: "vlastna" };
        }
        return { type: "pass" };
      }
      case "pitka": {
        const p = view.pitkaStav;
        if (p?.reakcia === ja) return { type: "bezReakcie" };
        // Krčma: s plným poldeci treba dať NA EX na vlastného Občana.
        if (view.ciel?.lokalita?.defId === "krcma" && p !== null && !p.naexPouzity[ja] && view.hraci[ja].poldeciPlne > 0) {
          const ciel = [...view.strany[0], ...view.strany[1]].find(
            (pl) =>
              pl.playedBy === ja &&
              pl.naexBy === undefined &&
              pl.card.defId !== "liberal" &&
              ["Občan", "Starešina"].some((t) => (DATA.cards.get(pl.card.defId)?.tags ?? []).includes(t as never)),
          );
          if (ciel !== undefined) return { type: "naex", uid: ciel.card.uid };
        }
        return { type: "skipNaex" };
      }
      case "bitka": {
        const b = view.bitkaStav;
        if (b === null) throw new Error("bitka bez stavu");
        if (b.krok === "benzinka") {
          const obcania = [...view.strany[0], ...view.strany[1]].filter(
            (pl) => pl.playedBy === ja && !b.spalit.includes(pl.card.uid) && (DATA.cards.get(pl.card.defId)?.tags ?? []).includes("Občan"),
          );
          return { type: "benzinka", uids: obcania.slice(0, b.benzinkaZostava[ja]).map((pl) => pl.card.uid) };
        }
        if (b.krok === "vestica") return { type: "vestica", moja: 0, jeho: 0 };
        if (b.krok === "limitRuky") {
          return { type: "odhod", uids: view.ruka.slice(0, view.ruka.length - view.limitRuky[ja]).map((k) => k.uid) };
        }
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
let zmaz: () => Promise<void>;

beforeAll(async () => {
  ({ server, zmaz } = await testovaciServer());
});

afterAll(async () => {
  await zmaz();
});

describe("E2E — celá partia cez server", () => {
  it("dvaja klienti dohrajú hru len z klientskeho pohľadu", async () => {
    const a = new Robot(server.port, (await registruj(server.port)).cookie);
    await a.otvorene();
    a.posli({ type: "create" });
    for (let i = 0; i < 50 && a.privitanie.code === undefined; i++) {
      await new Promise((r) => setTimeout(r, 20));
    }
    const kod = a.privitanie.code;
    expect(kod).toBeDefined();

    const b = new Robot(server.port, (await registruj(server.port)).cookie);
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
      const druhy = robot === a ? b : a;
      const cakaRobot = robot.novyStav();
      const cakaDruhy = druhy.novyStav();
      robot.posli({ type: "cmd", cmd });
      await cakaRobot;
      expect(robot.chyby, `server odmietol ${JSON.stringify(cmd)} vo fáze ${a.view?.faza}`).toEqual([]);
      await cakaDruhy;
    }

    expect(a.view?.koniec).not.toBeNull();
    expect(b.view?.koniec).not.toBeNull();
    expect(tahov).toBeGreaterThan(20);

    // Archív si pamätá štatistiky kariet partie — podklad pre rebalans v tvorcovi.
    const admin = await prihlas(server.port, TEST_ADMIN.login, TEST_ADMIN.heslo);
    for (let i = 0; i < 50; i++) {
      const r = (await (await fetch(`http://127.0.0.1:${server.port}/api/admin/statistiky-kariet`, { headers: { cookie: admin } })).json()) as {
        partie: number;
        karty: Record<string, { bitky: number }>;
      };
      if (r.partie === 1) {
        expect(Object.values(r.karty).some((k) => k.bitky > 0)).toBe(true);
        break;
      }
      expect(i, "partia sa nezapísala do archívu").toBeLessThan(49);
      await new Promise((res) => setTimeout(res, 20));
    }

    a.zavri();
    b.zavri();
  }, 60_000);
});

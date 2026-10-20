// Testovací klient: hrá len z toho, čo vidí hráč (ClientState + voľby),
// a pri každej správe kontroluje, že zo servera neodišli skryté dáta.

import { expect } from "vitest";
import { WebSocket } from "ws";
import type { ClientState, Command } from "@naex/core";
import { cieleVykladania, cielLokalitaId, krokStavby, naexCieleVLinii, posunMarker } from "@naex/core";
import { loadDataFromDisk } from "../src/server.ts";

/** Dáta sady pre pravidlá vykladania — robot ich pozná ako hráč (verejné karty). */
const DATA = loadDataFromDisk();

interface StavMsg {
  type: "state";
  view: ClientState;
}

export class Robot {
  view: ClientState | null = null;
  private readonly ws: WebSocket;
  private cakajuci: (() => void) | null = null;
  privitanie: { code?: string; token?: string; seat?: number } = {};
  chyby: string[] = [];
  /** Koľko stavov už prišlo — na čakanie bez pretekov so súperovým ťahom. */
  pocetStavov = 0;
  hraci: unknown = null;

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
        this.pocetStavov++;
        this.cakajuci?.();
        this.cakajuci = null;
      } else if (msg.type === "hraci") {
        this.hraci = msg.hraci;
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
        if (d?.krok === "stavba") {
          // Po dvoch do šenku a naspodok, zvyšok súperovi (Michal 2026-10-19).
          const uids = d.mojBalicek.map((k) => k.uid);
          const krok = krokStavby(uids.length);
          return { type: "stavbaSenku", doSenku: uids.slice(0, krok.doSenku), odhod: uids.slice(krok.doSenku, krok.doSenku + krok.odhod) };
        }
        // Najviac dve karty zo šenku, po jednej za cigaretu.
        const karta = view.senok[0];
        if (karta === undefined || d === null || d.noveKarty[ja] >= 2) return { type: "draftStop" };
        if (view.hraci[ja].cigarety > 0) return { type: "draftBer", uids: [karta.uid] };
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
            (k) => !nastroje.has(k.defId) && cieleVykladania(DATA, view.strany, ja, k, zostava, true, cielLokalitaId(view)).includes("vlastna"),
          );
          if (karta !== undefined) return { type: "place", uid: karta.uid, target: "vlastna" };
        }
        return { type: "pass" };
      }
      case "pitka": {
        // Vízia: robot si kartu vždy vezme.
        if (view.vizia !== null) return { type: "vizia", vziat: true };
        const p = view.pitkaStav;
        if (p?.reakcia === ja) return { type: "bezReakcie" };
        // Krčma: s plným poldeci treba dať NA EX na vlastného Občana.
        if (view.ciel?.lokalita?.defId === "krcma" && p !== null && !p.naexPouzity[ja] && view.hraci[ja].poldeciPlne > 0) {
          const ciele = new Set(naexCieleVLinii(DATA, view.strany, ja));
          const ciel = [...view.strany[0], ...view.strany[1]].find((pl) => pl.playedBy === ja && ciele.has(pl.card.uid));
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
        if (b.krok === "zberatel") {
          const ponuka = view.volbaZberatel ?? [];
          return { type: "zberatel", uids: ponuka.slice(0, Math.min(view.zberatel[ja], ponuka.length)).map((k) => k.uid) };
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

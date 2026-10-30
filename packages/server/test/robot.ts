// Testovací klient: hrá len z toho, čo vidí hráč (ClientState + voľby),
// a pri každej správe kontroluje, že zo servera neodišli skryté dáta.

import { expect } from "vitest";
import { WebSocket } from "ws";
import type { ClientState, Command } from "@naex/core";
import { cieleVykladania, cielLokalitaId, krokStavby, lineState, naexCieleVLinii, pohorsenieMozne, posunZaBody, poveraMozna, zablokovaneStrany } from "@naex/core";
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
  /** Ostatné správy servera (achievementy, Frajerina…) v poradí príchodu. */
  ostatne: { type: string; [k: string]: unknown }[] = [];

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
      } else {
        this.ostatne.push(msg);
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
    // Hasič: robot si kartu vždy nechá.
    if (view.hasicVolba !== null) return { type: "hasic", nechat: true };
    // Voľby Nástupu v7: Klebetnica pošle naspodok prvú súperovu kartu, Dohadzovačka vymení prvých dvoch starších.
    const nv = view.volbaNastupu;
    if (nv !== null && nv.hrac === ja) {
      const k = nv.ruka?.[0];
      if (nv.typ === "klebetnica" && k !== undefined) return { type: "klebetnica", uid: k.uid };
      const [x, y] = view.starsi;
      if (nv.typ === "dohadzovacka" && x !== undefined && y !== undefined) return { type: "dohadzovacka", elderA: x.elderId, elderB: y.elderId };
      // v7: karta zo šenku, Nástroj za Živnostníka (robot nič), Kapybara (prvý marker mimo stredu).
      const zoSenku = view.senok[0];
      if (nv.typ === "senok" && zoSenku !== undefined) return { type: "senok", uid: zoSenku.uid };
      if (nv.typ === "nastroj") return { type: "nastroj", uid: null };
      const kapybara = view.starsi.find((e) => e.marker !== 3);
      if (nv.typ === "kapybara" && kapybara !== undefined) return { type: "kapybara", elderId: kapybara.elderId };
    }

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
        // Patronát robot nevyužíva.
        if (d?.krok === "patronat") return { type: "bezPatronatu" };
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
          k.defId === "cirhoza",
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
            (k) => !nastroje.has(k.defId) && cieleVykladania(DATA, view.strany, ja, k, zostava, true, cielLokalitaId(view), zablokovaneStrany(view)).includes("vlastna"),
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
        // Krčma: s plným poldeci treba dať NA EX — na vlastného Občana, inak na hocikoho v línii.
        // NA EX naraz (v5): skryté NA EX už dané — Krčma je spokojná.
        if (view.ciel?.lokalita?.defId === "krcma" && p !== null && !p.naexPouzity[ja] && (p.skryteNaex ?? []).length === 0 && view.hraci[ja].poldeciPlne > 0) {
          const ciele = new Set(naexCieleVLinii(DATA, lineState(view), ja));
          const linia = [...view.strany[0], ...view.strany[1]];
          const ciel = linia.find((pl) => pl.playedBy === ja && ciele.has(pl.card.uid)) ?? linia.find((pl) => ciele.has(pl.card.uid));
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
        // v6: Exekútor sa pýta len na Záhradkára — robot ho zahodí.
        if (b.krok === "exekutor") return { type: "zahradkar", zahodit: true };
        // v8.3: Povery — robot ich dá na prvého staršieho, kam smú (klient z verejného pohľadu).
        if (b.krok === "povery") {
          const elder = view.starsi.find((e) => poveraMozna(e, ja, b.klebety));
          if (elder === undefined) throw new Error("povery: žiadny cieľ");
          return { type: "povera", elderId: elder.elderId };
        }
        if (b.krok === "pohorsenie" || b.krok === "prebytok") {
          // Prebytok ide k súperovi držiteľa — od v8 ho rozdeľuje spravidla porazený, teda k nemu.
          const smerK = b.krok === "prebytok" && b.prebytokDrzi !== null ? (b.prebytokDrzi === 0 ? 1 : 0) : ja === 0 ? 1 : 0;
          const elder = view.starsi.find((e) =>
            b.krok === "pohorsenie" ? pohorsenieMozne(view, ja, e) : posunZaBody(e, smerK, b.prebytokZostava) !== null,
          );
          // v5: Pohoršenie smie aj k sebe — keď k súperovi nejde nič.
          const kSebe = b.krok === "pohorsenie" && elder === undefined ? view.starsi.find((e) => pohorsenieMozne(view, ja, e, true)) : undefined;
          if (kSebe !== undefined) return { type: "pohorsenie", elderId: kSebe.elderId, kSebe: true };
          if (elder === undefined) throw new Error(`${b.krok}: žiadny posúvateľný marker`);
          return b.krok === "pohorsenie"
            ? { type: "pohorsenie", elderId: elder.elderId }
            : { type: "prebytok", elderId: elder.elderId };
        }
        // Cintorín (Michal 2026-10-20): robot nič do Dedičstva nedáva.
        if (b.krok === "cintorin") return { type: "cintorin", uid: null };
        if (b.krok === "kar") return { type: "kar", uid: null };
        throw new Error(`nečakaný krok bitky ${b.krok}`);
      }
      default:
        throw new Error(`nečakaná fáza ${view.faza}`);
    }
  }
}

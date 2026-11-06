// Pečiatka a rozpis na dlaždici Cigarety (Michal 2026-11-06): účtovná kniha motora musí sedieť
// so stavom pri každom ťahu, inak by rozpis klamal. Súperov prísun je verejný, platba nie je prísun.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { Command, Event, GameState, PlayerId } from "../src/index.ts";
import {
  KONSTANTY,
  apply,
  applySPrisunom,
  eventsFor,
  legalCommands,
  loadGameData,
  mozeHrat,
  naTahu,
  nahladPitky,
  prisunZUdalosti,
  riadkyCakajuceho,
  rngInt,
  rngSeed,
  rozpisCigaretPitky,
  setupGame,
  sumaPrisunu,
  tahBota,
  viewFor,
} from "../src/index.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

const kniha = (events: readonly Event[], p: PlayerId): number =>
  events.reduce((a, e) => (e.type === "zmenaCigariet" && e.hrac === p ? a + e.suma : a), 0);

interface Krok {
  readonly pred: GameState;
  readonly po: GameState;
  readonly cmd: Command;
  readonly kto: PlayerId;
  readonly events: readonly Event[];
}

/** Partia botov s prímesou náhodných legálnych ťahov — tie dôjdu aj na Kšefty a väzňov, ktoré bot obchádza. */
function partia(seed: number): readonly Krok[] {
  let s = setupGame(data, seed, { lokalit: 3 });
  let rng = rngSeed(seed ^ 0x51);
  const kroky: Krok[] = [];
  for (let i = 0; s.koniec === null && i < 4000; i++) {
    const kto: PlayerId | null = ([0, 1] as const).find((q) => mozeHrat(s, q)) ?? naTahu(s);
    if (kto === null) break;
    const [j, r1] = rngInt(rng, 2 ** 31);
    const [k, r2] = rngInt(r1, 100);
    rng = r2;
    const legalne = k < 25 ? legalCommands(data, s, kto) : [];
    const cmd: Command = legalne[j % Math.max(1, legalne.length)] ?? tahBota(data, s, kto, j, { povaha: "igor" });
    const { state: po, events } = applySPrisunom(data, s, cmd, kto);
    kroky.push({ pred: s, po, cmd, kto, events });
    s = po;
  }
  return kroky;
}

const PARTIE = [101, 102, 103, 104, 105, 106].map(partia);
const KROKY = PARTIE.flat();

describe("účtovná kniha cigariet", () => {
  it("v každom ťahu náhodných partií sedí súčet knihy so zmenou cigariet oboch hráčov", () => {
    expect(KROKY.length).toBeGreaterThan(300);
    for (const { pred, po, events } of KROKY) {
      for (const p of [0, 1] as const) expect(kniha(events, p)).toBe(po.hraci[p].cigarety - pred.hraci[p].cigarety);
    }
  });

  it("rozpis bez platby sedí so zmenou cigariet po odrátaní vlastnej útraty", () => {
    for (const { pred, po, events } of KROKY) {
      const rozpis = prisunZUdalosti(events);
      for (const p of [0, 1] as const) {
        const r = rozpis[p];
        const platba = -events.reduce((a, e) => (e.type === "zmenaCigariet" && e.hrac === p && e.zdroj === "platba" ? a + e.suma : a), 0);
        expect((r?.suma ?? 0) - (r?.platba ?? platba)).toBe(po.hraci[p].cigarety - pred.hraci[p].cigarety);
        if (r !== null) expect(r.suma).toBe(r.riadky.reduce((a, x) => a + x.suma, 0));
      }
    }
  });

  it("náhodné partie prejdú hlavnými zdrojmi prísunu", () => {
    const zdroje = new Set(KROKY.flatMap((k) => k.events.flatMap((e) => (e.type === "zmenaCigariet" ? [e.zdroj] : []))));
    for (const z of ["akcie", "pas", "porazeny", "platba"] as const) expect(zdroje).toContain(z);
  });

  it("apply vracia to isté ako applySPrisunom bez knihy — stopa partie sa nemení", () => {
    for (const { pred, cmd, kto, po, events } of KROKY.slice(0, 400)) {
      const r = apply(data, pred, cmd, kto);
      expect(r.state).toEqual(po);
      expect(r.events).toEqual(events.filter((e) => e.type !== "zmenaCigariet"));
    }
  });
});

describe("platba nie je prísun", () => {
  it("fajčenie, šenok, Dedičstvo ani Kšeft pečiatku nespustia", () => {
    const iba = KROKY.filter(({ events }) => {
      const z = events.filter((e) => e.type === "zmenaCigariet");
      return z.length > 0 && z.every((e) => e.type === "zmenaCigariet" && e.zdroj === "platba");
    });
    expect(iba.length).toBeGreaterThan(5);
    for (const { events } of iba) expect(prisunZUdalosti(events)).toEqual([null, null]);
  });

  it("fajčenie zaplatí cez knihu ako platba", () => {
    const fajcenie = KROKY.filter((k) => k.cmd.type === "smoke");
    expect(fajcenie.length).toBeGreaterThan(0);
    for (const { events, kto } of fajcenie) {
      expect(events.some((e) => e.type === "zmenaCigariet" && e.hrac === kto && e.zdroj === "platba" && e.suma < 0)).toBe(true);
    }
  });
});

describe("súperov prísun je verejný a nič skryté neprezradí", () => {
  it("kniha ide rovnako obom a zhoduje sa s cigaretami v pohľade každého hráča", () => {
    for (const { pred, po, events } of KROKY.slice(0, 800)) {
      for (const pozorovatel of [0, 1] as const) {
        const moje = eventsFor(events, pozorovatel);
        const vpred = viewFor(data, pred, pozorovatel);
        const vpo = viewFor(data, po, pozorovatel);
        for (const p of [0, 1] as const) expect(kniha(moje, p)).toBe(vpo.hraci[p].cigarety - vpred.hraci[p].cigarety);
      }
      expect(eventsFor(events, 0).filter((e) => e.type === "zmenaCigariet")).toEqual(eventsFor(events, 1).filter((e) => e.type === "zmenaCigariet"));
    }
  });

  it("udalosť nesie len hráča, zdroj a sumu — žiadna karta ani adresát", () => {
    for (const { events } of KROKY) {
      for (const e of events) {
        if (e.type === "zmenaCigariet") expect(Object.keys(e).sort()).toEqual(["hrac", "suma", "type", "zdroj"]);
      }
    }
  });

  it("čakajúci prísun oboch hráčov ide spočítať z pohľadu, kým neleží nič skryté", () => {
    let porovnane = 0;
    for (const { pred } of KROKY) {
      if (pred.faza !== "pitka" || pred.pitkaStav === null || pred.ciel === null) continue;
      if (pred.vizia !== null || (pred.pitkaStav.skryteNaex?.length ?? 0) > 0) continue;
      if (pred.strany.some((st) => st.some((pl) => pl.zaverecna === true))) continue;
      const zoStavu = nahladPitky(data, pred);
      for (const pozorovatel of [0, 1] as const) {
        const zPohladu = nahladPitky(data, viewFor(data, pred, pozorovatel));
        expect([zPohladu[0].cigarety, zPohladu[1].cigarety]).toEqual([zoStavu[0].cigarety, zoStavu[1].cigarety]);
      }
      porovnane++;
    }
    expect(porovnane).toBeGreaterThan(20);
  });
});

describe("čakajúci prísun a náhľad Pitky", () => {
  const sums = (cig0: number, obm0: number, cig1: number, obm1: number) =>
    [
      { Cigareta: cig0, Obmedzenie: obm0 },
      { Cigareta: cig1, Obmedzenie: obm1 },
    ] as const;

  it("čistý rozdiel: akcie Cigareta mínus súperove Obmedzenia, najmenej 0", () => {
    const [a, b] = rozpisCigaretPitky(sums(3, 0, 1, 1));
    expect(a).toEqual({ akcie: 3, obmedzenie: 1, zisk: 2 });
    expect(b).toEqual({ akcie: 1, obmedzenie: 0, zisk: 1 });
    expect(rozpisCigaretPitky(sums(1, 0, 0, 4))[0]).toEqual({ akcie: 1, obmedzenie: 1, zisk: 0 });
  });

  it("riadky rozpisu: Obmedzenie len keď naozaj uberá, bez akcií nič", () => {
    expect(riadkyCakajuceho({ akcie: 3, obmedzenie: 1, zisk: 2 })).toEqual([
      { zdroj: "akcie", suma: 3 },
      { zdroj: "obmedzenie", suma: -1 },
    ]);
    expect(riadkyCakajuceho({ akcie: 2, obmedzenie: 0, zisk: 2 })).toEqual([{ zdroj: "akcie", suma: 2 }]);
    expect(riadkyCakajuceho({ akcie: 0, obmedzenie: 0, zisk: 0 })).toEqual([]);
  });

  it("vyhodnotenie Pitky zaúčtuje to, čo hlási pitkaVysledok", () => {
    let pitiek = 0;
    for (const { events } of KROKY) {
      const v = events.find((e) => e.type === "pitkaVysledok");
      if (v === undefined || v.type !== "pitkaVysledok") continue;
      pitiek++;
      const rozpis = prisunZUdalosti(events.filter((e) => e.type !== "zmenaCigariet" || e.zdroj === "akcie" || e.zdroj === "obmedzenie"));
      expect([rozpis[0]?.suma ?? 0, rozpis[1]?.suma ?? 0]).toEqual([v.cigarety[0], v.cigarety[1]]);
    }
    expect(pitiek).toBeGreaterThan(10);
  });

  it("vo Vízii je Pitka vyhodnotená — náhľad už nič nečaká, cigarety sú na účte", () => {
    const s = KROKY.find((k) => k.pred.vizia !== null)?.pred;
    expect(s).toBeDefined();
    if (s !== undefined) for (const n of nahladPitky(data, s)) expect(n.cigarety).toEqual({ akcie: 0, obmedzenie: 0, zisk: 0 });
  });
});

describe("zdroje prísunu z jadra", () => {
  it("výpalné ide oboma smermi ako dva riadky a sedí súčet", () => {
    const krok = KROKY.find((k) => k.events.some((e) => e.type === "zmenaCigariet" && e.zdroj === "vypalne"));
    expect(krok).toBeDefined();
    if (krok === undefined) return;
    const dohromady = krok.events.reduce((a, e) => (e.type === "zmenaCigariet" && e.zdroj === "vypalne" ? a + e.suma : a), 0);
    expect(dohromady).toBe(0);
  });

  it("porazený dostane cigaretu z knihy", () => {
    const krok = KROKY.find((k) => k.events.some((e) => e.type === "zmenaCigariet" && e.zdroj === "porazeny"));
    expect(krok).toBeDefined();
    const e = krok?.events.find((x) => x.type === "zmenaCigariet" && x.zdroj === "porazeny");
    expect(e?.type === "zmenaCigariet" ? e.suma : 0).toBe(KONSTANTY.CIGARETY_PORAZENEMU);
  });

  it("zlúči rovnaký zdroj rovnakým smerom, opačný smer nechá vedľa seba", () => {
    const e = (hrac: PlayerId, zdroj: "vypalne" | "podvodnik" | "platba", suma: number): Event => ({ type: "zmenaCigariet", hrac, zdroj, suma });
    const [a, b] = prisunZUdalosti([e(0, "podvodnik", 1), e(0, "podvodnik", 1), e(0, "vypalne", 3), e(0, "vypalne", -1), e(0, "platba", -2), e(1, "platba", -1)]);
    expect(a).toEqual({
      riadky: [
        { zdroj: "podvodnik", suma: 2 },
        { zdroj: "vypalne", suma: 3 },
        { zdroj: "vypalne", suma: -1 },
      ],
      suma: 4,
      platba: 2,
    });
    expect(b).toBeNull();
  });

  it("znamienko: pravé mínus a plus", () => {
    expect([sumaPrisunu(5), sumaPrisunu(-2), sumaPrisunu(0)]).toEqual(["+5", "−2", "0"]);
  });
});

describe("poistka knihy", () => {
  it("motor mení cigarety len cez zmenCigarety — nový zdroj bez knihy by rozpis ticho rozbil", () => {
    const zdroj = readFileSync(new URL("../src/engine.ts", import.meta.url), "utf8");
    const zmeny = zdroj.match(/\.cigarety\s*(?:\+=|-=)/g) ?? [];
    expect(zmeny).toHaveLength(1);
  });
});

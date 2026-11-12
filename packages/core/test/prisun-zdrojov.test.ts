// Pečiatka a rozpis na dlaždiciach Cigarety a Poldeci (Michal 2026-11-06): účtovná kniha motora musí
// sedieť so stavom pri každom ťahu, inak by rozpis klamal. Súperov prísun je verejný, platba nie je prísun.

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
  riadkyCakajucichPoldeci,
  sMojimiSkrytymiNaex,
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
    // Cigarety za pas zanikli vo v12.2.
    for (const z of ["akcie", "porazeny", "platba"] as const) expect(zdroje).toContain(z);
  });

  it("apply vracia to isté ako applySPrisunom bez knihy — stopa partie sa nemení", () => {
    for (const { pred, cmd, kto, po, events } of KROKY.slice(0, 400)) {
      const r = apply(data, pred, cmd, kto);
      expect(r.state).toEqual(po);
      expect(r.events).toEqual(events.filter((e) => e.type !== "zmenaCigariet" && e.type !== "zmenaPoldeci"));
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
    // Prvé fajčenie na Benzínke je zadarmo (v11.13), z neho platba nie je.
    const fajcenie = KROKY.filter((k) => k.cmd.type === "smoke" && !(k.pred.ciel?.lokalita?.defId === "benzinka" && k.pred.pitkaStav?.fajcenie[k.kto] === 0));
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
      const rozpis = prisunZUdalosti(events.filter((e) => e.type !== "zmenaCigariet" || e.zdroj === "akcie" || e.zdroj === "obmedzenie" || e.zdroj === "obecnyUrad"));
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
  it("výpalné ide z banky — len kladné riadky, nikto ho neplatí (v12.4)", () => {
    const krok = KROKY.find((k) => k.events.some((e) => e.type === "zmenaCigariet" && e.zdroj === "vypalne"));
    expect(krok).toBeDefined();
    if (krok === undefined) return;
    const vypalne = krok.events.filter((e) => e.type === "zmenaCigariet" && e.zdroj === "vypalne");
    expect(vypalne.every((e) => e.type === "zmenaCigariet" && e.suma > 0)).toBe(true);
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

const knihaPoldeci = (events: readonly Event[], p: PlayerId): number =>
  events.reduce((a, e) => (e.type === "zmenaPoldeci" && e.hrac === p ? a + e.suma : a), 0);
const zdrojePoldeci = (events: readonly Event[], p: PlayerId): readonly string[] =>
  events.flatMap((e) => (e.type === "zmenaPoldeci" && e.hrac === p ? [e.zdroj] : []));
const prisunPoldeci = (events: readonly Event[]) => prisunZUdalosti(events, "poldeci");

describe("účtovná kniha poldeci", () => {
  it("v každom ťahu náhodných partií sedí súčet rozpisu a platby so zmenou plných poldeci", () => {
    expect(KROKY.length).toBeGreaterThan(300);
    for (const { pred, po, events } of KROKY) {
      const rozpis = prisunPoldeci(events);
      for (const p of [0, 1] as const) {
        const zmena = po.hraci[p].poldeciPlne - pred.hraci[p].poldeciPlne;
        expect(knihaPoldeci(events, p)).toBe(zmena);
        const platba = 0 - events.reduce((a, e) => (e.type === "zmenaPoldeci" && e.hrac === p && e.zdroj === "platba" ? a + e.suma : a), 0);
        const r = rozpis[p];
        expect((r?.suma ?? 0) - platba).toBe(zmena);
        if (r !== null) {
          expect(r.suma).toBe(r.riadky.reduce((a, x) => a + x.suma, 0));
          expect(r.platba).toBe(platba);
        }
      }
    }
  });

  it("náhodné partie prejdú hlavnými zdrojmi poldeci", () => {
    const zdroje = new Set(KROKY.flatMap((k) => k.events.flatMap((e) => (e.type === "zmenaPoldeci" ? [e.zdroj] : []))));
    for (const z of ["pitka", "obnova", "platba"] as const) expect(zdroje).toContain(z);
  });

  it("vyložená karta je platba poldeci, Vypiť len cigaretou (v12.2); nový poldeci z barteru je prísun", () => {
    const karty = KROKY.filter((k) => k.cmd.type === "place" && (k.cmd.target === "vlastna" || k.cmd.target === "superova") && k.pred.faza === "zhromazdenie");
    expect(karty.length).toBeGreaterThan(0);
    for (const { events, kto } of karty) expect(zdrojePoldeci(events, kto)[0]).toBe("platba");
    const vypit = KROKY.filter((k) => k.cmd.type === "vypit");
    for (const { events, kto } of vypit) {
      expect(zdrojePoldeci(events, kto)).toEqual([]);
      expect(events).toContainEqual({ type: "zmenaCigariet", hrac: kto, zdroj: "platba", suma: -KONSTANTY.CENA_KARTY_NAVYSE });
    }
    const nakup = KROKY.filter((k) => k.cmd.type === "barter");
    for (const { events, kto } of nakup) {
      // Keď ťah Pitku dohrá (nevyhnutné ťahy hrá hra sama), pribudne aj doliatie po Pitke.
      expect(prisunPoldeci(events)[kto]?.riadky).toContainEqual({ zdroj: "barter", suma: 1 });
    }
  });

  it("po bitke sa poldeci obnovia cez knihu ako zdroj Po bitke — celé vypité na plné (v12.2)", () => {
    const krok = KROKY.find((k) => k.events.some((e) => e.type === "zmenaPoldeci" && e.zdroj === "obnova"));
    expect(krok).toBeDefined();
    for (const p of [0, 1] as const) {
      const e = krok?.events.find((x) => x.type === "zmenaPoldeci" && x.zdroj === "obnova" && x.hrac === p);
      if (e?.type === "zmenaPoldeci") expect(krok?.po.hraci[p].poldeciVypite).toBe(0);
    }
  });

  it("Degustátorka je súperov efekt: záporný prísun, nie platba", () => {
    const [a, b] = prisunZUdalosti([{ type: "zmenaPoldeci", hrac: 0, zdroj: "degustatorka", suma: -1 }], "poldeci");
    expect(a).toEqual({ riadky: [{ zdroj: "degustatorka", suma: -1 }], suma: -1, platba: 0 });
    expect(b).toBeNull();
  });

  it("knihy cigariet a poldeci sa nemiešajú", () => {
    const events: Event[] = [
      { type: "zmenaCigariet", hrac: 0, zdroj: "platba", suma: -2 },
      { type: "zmenaPoldeci", hrac: 0, zdroj: "pitka", suma: 1 },
    ];
    expect(prisunZUdalosti(events)).toEqual([null, null]);
    expect(prisunZUdalosti(events, "poldeci")[0]?.suma).toBe(1);
  });
});

describe("čakajúce poldeci a náhľad Pitky", () => {
  it("najviac toľko, koľko je vypitých; riadky po zdrojoch, len keď niečo naozaj otočí", () => {
    expect(riadkyCakajucichPoldeci({ akcie: 3, zisk: 2, casti: [["pitka", 1], ["akcie", 1]], izolacka: 0 })).toEqual([{ zdroj: "pitka", suma: 1 }, { zdroj: "akcie", suma: 1 }]);
    expect(riadkyCakajucichPoldeci({ akcie: 2, zisk: 0, casti: [], izolacka: 0 })).toEqual([]);
    for (const { pred } of KROKY) {
      if (pred.faza !== "pitka" && pred.faza !== "zhromazdenie") continue;
      if (pred.ciel === null) continue;
      for (const [p, n] of nahladPitky(data, pred).entries()) {
        expect(n.poldeci.zisk).toBeLessThanOrEqual(pred.hraci[p]?.poldeciVypite ?? 0);
        expect(n.poldeci.zisk).toBe(n.poldeci.casti.reduce((a, [, x]) => a + x, 0));
      }
    }
  });

  it("posledný odhad pred bitkou bez skrytého NA EX sa zhoduje s tým, čo sa po Pitke dolialo (v12.2)", () => {
    let porovnane = 0;
    let zhody = 0;
    for (const kroky of PARTIE) {
      kroky.forEach(({ pred, events }, i) => {
        if (!events.some((e) => e.type === "bitkaVysledok") || pred.faza !== "pitka" || pred.ciel === null) return;
        if ((pred.pitkaStav?.skryteNaex?.length ?? 0) > 0) return;
        const odhad = nahladPitky(data, pred);
        // Doliatie po Pitke je v tom istom ťahu, ktorý Pitku dohrá.
        const dalsie = kroky.slice(i, i + 1);
        for (const p of [0, 1] as const) {
          const naozaj = dalsie.flatMap((k) => k.events).reduce((n, e) => (e.type === "zmenaPoldeci" && e.hrac === p && (e.zdroj === "akcie" || e.zdroj === "jogurt" || e.zdroj === "pitka") ? n + e.suma : n), 0);
          porovnane++;
          if (odhad[p].poldeci.zisk === naozaj) zhody++;
        }
      });
    }
    expect(porovnane).toBeGreaterThan(10);
    // Odhad smie minúť len to, čo sa ešte zmení v poslednom ťahu (odpoveď na NA EX, efekt bitky).
    expect(zhody / porovnane).toBeGreaterThan(0.8);
  });

  it("Jogurt: pečiatka sľúbi o poldeci viac, keď je čo doliať (v12.2)", () => {
    const s = KROKY.find((k) => k.pred.ciel !== null && k.pred.faza === "pitka")?.pred;
    expect(s).toBeDefined();
    if (s === undefined) return;
    const vypite = { ...s, hraci: s.hraci.map((h) => ({ ...h, poldeciVypite: 9 })) as unknown as GameState["hraci"] };
    const bez = nahladPitky(data, vypite);
    const sJogurtom = { ...vypite, hraci: [{ ...vypite.hraci[0], dedicstvo: [...vypite.hraci[0].dedicstvo, { uid: 99901, defId: "jogurt", leftLayout: 0, rightLayout: 0 }] }, vypite.hraci[1]] as unknown as GameState["hraci"] };
    expect(nahladPitky(data, sJogurtom)[0].poldeci.zisk).toBe(bez[0].poldeci.zisk + KONSTANTY.JOGURT_POLDECI);
  });
});

describe("skryté NA EX dlaždica Poldeci neprezradí", () => {
  const skryte = KROKY.filter((k) => (k.po.pitkaStav?.skryteNaex?.length ?? 0) > 0);

  it("v partiách skryté NA EX naozaj padne", () => {
    expect(skryte.length).toBeGreaterThan(10);
  });

  it("položenie skrytého NA EX nedá do knihy nič — súper sa o ňom z udalostí nedozvie", () => {
    const polozene = KROKY.filter((k) => (k.po.pitkaStav?.skryteNaex?.length ?? 0) > (k.pred.pitkaStav?.skryteNaex?.length ?? 0));
    expect(polozene.length).toBeGreaterThan(0);
    for (const { events, pred, po } of polozene) {
      expect(events.some((e) => e.type === "zmenaPoldeci")).toBe(false);
      for (const p of [0, 1] as const) expect(po.hraci[p].poldeciPlne).toBe(pred.hraci[p].poldeciPlne);
    }
  });

  it("súperov pohľad a odhad z neho sú rovnaké so skrytým NA EX aj bez neho", () => {
    let overene = 0;
    for (const { po } of skryte) {
      const pitka = po.pitkaStav;
      if (pitka === null) continue;
      for (const x of pitka.skryteNaex ?? []) {
        // Odoberá sa len NA EX hráča x — pozorovateľovo vlastné skryté NA EX (aj na tej istej karte) ostáva.
        const bez: GameState = { ...po, pitkaStav: { ...pitka, skryteNaex: (pitka.skryteNaex ?? []).filter((y) => y.hrac !== x.hrac) } };
        const pozorovatel = (x.hrac === 0 ? 1 : 0) as PlayerId;
        // Bzdocha ukazuje súperovu voľbu zámerne.
        const v = viewFor(data, po, pozorovatel);
        if ((v.pitkaStav?.skryteNaex ?? []).some((y) => y.hrac === x.hrac)) continue;
        const vBez = viewFor(data, bez, pozorovatel);
        expect(v.hraci[x.hrac].poldeciPlne).toBe(vBez.hraci[x.hrac].poldeciPlne);
        expect(v.hraci[x.hrac].poldeciVypite).toBe(vBez.hraci[x.hrac].poldeciVypite);
        const stol = sMojimiSkrytymiNaex(data, v);
        const stolBez = sMojimiSkrytymiNaex(data, vBez);
        expect(nahladPitky(data, stol)[x.hrac].poldeci).toEqual(nahladPitky(data, stolBez)[x.hrac].poldeci);
        overene++;
      }
    }
    expect(overene).toBeGreaterThan(10);
  });

  it("odkrytie ide do knihy až pri odkrytí a obaja dostanú to isté", () => {
    const odkrytia = KROKY.filter((k) => (k.pred.pitkaStav?.skryteNaex?.length ?? 0) > 0 && (k.po.pitkaStav?.skryteNaex?.length ?? 0) === 0 && k.events.some((e) => e.type === "zmenaPoldeci"));
    expect(odkrytia.length).toBeGreaterThan(0);
    for (const { events } of odkrytia) {
      expect(eventsFor(events, 0).filter((e) => e.type === "zmenaPoldeci")).toEqual(eventsFor(events, 1).filter((e) => e.type === "zmenaPoldeci"));
    }
    for (const { events } of KROKY) {
      for (const e of events) if (e.type === "zmenaPoldeci") expect(Object.keys(e).sort()).toEqual(["hrac", "suma", "type", "zdroj"]);
    }
  });

  it("kniha ide rovnako obom a sedí s plnými poldeci v pohľade každého hráča", () => {
    for (const { pred, po, events } of KROKY.slice(0, 800)) {
      for (const pozorovatel of [0, 1] as const) {
        const moje = eventsFor(events, pozorovatel);
        const vpred = viewFor(data, pred, pozorovatel);
        const vpo = viewFor(data, po, pozorovatel);
        for (const p of [0, 1] as const) expect(knihaPoldeci(moje, p)).toBe(vpo.hraci[p].poldeciPlne - vpred.hraci[p].poldeciPlne);
      }
    }
  });
});

describe("poistka knihy", () => {
  it("motor mení plné poldeci len cez zmenPoldeci", () => {
    const zdroj = readFileSync(new URL("../src/engine.ts", import.meta.url), "utf8");
    const zmeny = zdroj.match(/\.poldeciPlne\s*(?:\+=|-=|=(?!=))/g) ?? [];
    expect(zmeny).toHaveLength(1);
  });

  it("motor mení cigarety len cez zmenCigarety — nový zdroj bez knihy by rozpis ticho rozbil", () => {
    const zdroj = readFileSync(new URL("../src/engine.ts", import.meta.url), "utf8");
    const zmeny = zdroj.match(/\.cigarety\s*(?:\+=|-=)/g) ?? [];
    expect(zmeny).toHaveLength(1);
  });
});

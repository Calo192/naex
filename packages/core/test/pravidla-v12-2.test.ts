// Pravidlá v12.2 (Michal 2026-11-11): vykladanie za poldeci — limit = plné poldeci, každá karta jeden
// otočí, ďalšie karty v ťahu stoja cigarety (n kariet = n poldeci + n − 1 cigariet), 3 poldeci na štarte,
// po bitke sa obnovia na maximum, po Pitke 1 zadarmo a akcie Poldeci; doliatie a cigarety za pas zanikli.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { CardInstance, Command, Event, GameState, PlacedCard, PlayerId } from "../src/index.ts";
import {
  KONSTANTY,
  KOSTOL_JEDNA_KARTA,
  apply,
  applySPrisunom,
  evaluateLine,
  freshPlayer,
  lineState,
  legalCommands,
  loadGameData,
  maximumPoldeci,
  naTahu,
  planVykladania,
  setupGame,
  tahBota,
} from "../src/index.ts";
import { instanceFor, makeDef, syntheticData } from "./helpers.ts";

const zaklad = loadGameData(cardsJson, eldersJson, scorecardsJson);
const syn = syntheticData([makeDef("poldeci_v122", ["Poldeci", null, null, null], ["Poldeci", null, null, null])]);
const data = { ...zaklad, cards: new Map([...zaklad.cards, ...syn.cards]), variants: new Map([...zaklad.variants, ...syn.variants]) };

let uid = 912000;
const inst = (defId: string): CardInstance => ({ uid: ++uid, defId, leftLayout: 0, rightLayout: 0 });

/** Zhromaždenie, hráč 0 na ťahu s rukou `ruka` a `plne` plnými poldeci. */
function vZhromazdeni(ruka: CardInstance[], o: { plne?: number; cigarety?: number; lokalita?: string; strany?: GameState["strany"] } = {}): GameState {
  const s0 = setupGame(data, 31);
  const lokalita = o.lokalita === undefined ? s0.lokalityVHre.find((k) => k.defId === "krcma")! : inst(o.lokalita);
  const plne = o.plne ?? 3;
  return {
    ...s0,
    faza: "zhromazdenie",
    utocnik: 0,
    ciel: { typ: "lokalita", lokalita },
    strany: o.strany ?? [[], []],
    pitkyCelkom: 1,
    pitkaCislo: 0,
    hraci: [{ ...s0.hraci[0], ruka, poldeciPlne: plne, poldeciVypite: 3 - Math.min(3, plne), cigarety: o.cigarety ?? 5 }, s0.hraci[1]],
    zhromazdenieStav: { naTahu: 0, zostavaLimit: [plne, s0.hraci[1].poldeciPlne], pasoval: [false, false], navyse: [0, 0] },
  };
}

describe("§3 štart a §6 limit (v12.2)", () => {
  it("3 plné poldeci na štarte (v 2 na 2 tím 6), limit = plné poldeci", () => {
    expect(freshPlayer().poldeciPlne).toBe(3);
    expect(freshPlayer("2na2").poldeciPlne).toBe(6);
    const s = setupGame(data, 3);
    expect(s.hraci.map((h) => h.poldeciPlne)).toEqual([3, 3]);
  });

  it("každá karta do línie otočí plný poldeci; bez plného sa nevykladá a hra za hráča pasuje", () => {
    const [a, b] = [inst("pijan"), inst("pijan")];
    let s = vZhromazdeni([a, b], { plne: 1 });
    s = { ...s, zhromazdenieStav: { ...s.zhromazdenieStav!, pasoval: [false, true] } };
    const po = apply(data, s, { type: "place", uid: a.uid, target: "vlastna" }, 0);
    expect([po.state.hraci[0].poldeciPlne, po.state.hraci[0].poldeciVypite]).toEqual([0, 3]);
    // Súper pasoval, hráč 0 nemá plný poldeci — Zhromaždenie skončí bez jeho ďalšieho ťahu.
    expect(po.state.faza).not.toBe("zhromazdenie");
    expect(() => apply(data, { ...s, hraci: [{ ...s.hraci[0], poldeciPlne: 0 }, s.hraci[1]] }, { type: "place", uid: a.uid, target: "vlastna" }, 0)).toThrow(/plný poldeci/);
  });

  it("plné poldeci po pase ostávajú (v12.3 za ne aj cigareta za každý)", () => {
    const s = vZhromazdeni([inst("pijan")], { plne: 3, cigarety: 0 });
    const po = apply(data, s, { type: "pass" }, 0).state;
    expect(po.hraci[0].cigarety).toBe(3);
    expect(po.hraci[0].poldeciPlne).toBe(3);
  });
});

describe("§13 viac kariet v ťahu (v12.2)", () => {
  it("prvá karta len poldeci; dve karty 2 poldeci a 1 cigareta, tri karty 3 poldeci a 2 cigarety; pečeň a nerest za každú navyše", () => {
    for (const n of [1, 2, 3]) {
      const ruka = Array.from({ length: n }, () => inst("pijan"));
      const s = vZhromazdeni(ruka, { plne: 3, cigarety: 5 });
      const plan = planVykladania(data, s, 0, 3, ruka.map((karta) => ({ karta, ciel: "vlastna" as const })));
      expect(plan.chyba).toBeNull();
      expect([plan.poldeci, plan.navyse]).toEqual([n, n - 1]);
      const po = apply(data, s, { type: "tah", kroky: plan.kroky }, 0).state;
      expect(po.strany[0]).toHaveLength(n);
      expect(po.hraci[0].poldeciPlne).toBe(3 - n);
      expect(po.hraci[0].cigarety).toBe(5 - (n - 1) * KONSTANTY.CENA_KARTY_NAVYSE);
      expect(po.hraci[0].pecen).toBe(n - 1);
      expect(po.hraci[0].nerestiTotoKolo).toBe(n - 1);
      expect(naTahu(po)).toBe(1);
    }
  });

  it("bez cigarety na kartu navyše druhá karta nejde", () => {
    const ruka = [inst("pijan"), inst("pijan")];
    const s = vZhromazdeni(ruka, { plne: 3, cigarety: 0 });
    expect(planVykladania(data, s, 0, 3, ruka.map((karta) => ({ karta, ciel: "vlastna" as const }))).chyba).toMatch(/cigaret/);
    expect(legalCommands(data, s, 0).some((c) => c.type === "vypit")).toBe(false);
  });

  it("Vypiť na konci ťahu ani Vypiť navyše server neprijme — nerest sa nekupuje", () => {
    const [a, b] = [inst("pijan"), inst("pijan")];
    const s = vZhromazdeni([a, b], { plne: 3 });
    const naKonci: Command = { type: "tah", kroky: [{ type: "place", uid: a.uid, target: "vlastna" }, { type: "vypit" }] };
    expect(() => apply(data, s, naKonci, 0)).toThrow(/Vypiť/);
    const dvakrat: Command = { type: "tah", kroky: [{ type: "vypit" }, { type: "vypit" }, { type: "place", uid: a.uid, target: "vlastna" }, { type: "place", uid: b.uid, target: "vlastna" }] };
    expect(() => apply(data, s, dvakrat, 0)).toThrow(/Vypiť/);
  });

  it("Nástroj (Dedičstvo aj podloženie) a priznanie cenu ťahu nezvýšia a poldeci nemíňajú", () => {
    const [pijan, noviny, cirhoza] = [inst("pijan"), inst("noviny"), inst("cirhoza")];
    const s = vZhromazdeni([pijan, noviny, cirhoza], { plne: 1, cigarety: 5 });
    const plan = planVykladania(data, s, 0, 1, [
      { karta: cirhoza, ciel: "priznanie" },
      { karta: noviny, ciel: "dedicstvo" },
      { karta: pijan, ciel: "vlastna" },
    ]);
    expect(plan.chyba).toBeNull();
    expect([plan.poldeci, plan.navyse]).toEqual([1, 0]);
    const po = apply(data, s, { type: "tah", kroky: plan.kroky }, 0).state;
    expect(po.hraci[0].dedicstvo.map((k) => k.uid)).toEqual([noviny.uid]);
    expect(po.strany[0].map((pl) => pl.card.uid)).toEqual([pijan.uid]);
    expect(po.hraci[0].poldeciPlne).toBe(0);
    expect(po.hraci[0].nerestiTotoKolo).toBe(0);

    // Podloženie pod vlastnú kartu a potom karta do línie — tiež bez Vypiť.
    const hostitel: PlacedCard = { card: inst("pijan"), playedBy: 0 };
    const puska = inst("puska");
    const druha = inst("ministrant");
    const t = vZhromazdeni([puska, druha], { plne: 1, cigarety: 5, strany: [[hostitel], []] });
    const podloz = legalCommands(data, t, 0).find((c) => c.type === "podloz" && c.nastrojId === puska.uid);
    expect(podloz).toBeDefined();
    const po2 = apply(data, t, { type: "tah", kroky: [podloz as Command, { type: "place", uid: druha.uid, target: "vlastna" }] }, 0).state;
    expect(po2.strany[0].map((pl) => pl.card.uid)).toEqual([hostitel.card.uid, druha.uid]);
    expect(po2.hraci[0].poldeciPlne).toBe(0);
    expect(po2.hraci[0].cigarety).toBe(5 - KONSTANTY.CENA_PODLOZENIA);
  });

  it("Kostol: v ťahu len 1 karta — ani Nástroj s kartou", () => {
    const [a, b, noviny] = [inst("pijan"), inst("pijan"), inst("noviny")];
    const s = vZhromazdeni([a, b, noviny], { plne: 3, lokalita: "kostol" });
    expect(planVykladania(data, s, 0, 3, [{ karta: a, ciel: "vlastna" }, { karta: b, ciel: "vlastna" }]).chyba).toBe(KOSTOL_JEDNA_KARTA);
    expect(planVykladania(data, s, 0, 3, [{ karta: noviny, ciel: "dedicstvo" }, { karta: a, ciel: "vlastna" }]).chyba).toBe(KOSTOL_JEDNA_KARTA);
    expect(() => apply(data, s, { type: "tah", kroky: [{ type: "place", uid: noviny.uid, target: "dedicstvo" }, { type: "place", uid: a.uid, target: "vlastna" }] }, 0)).toThrow(/skončil/);
  });
});

describe("§7 Pitka: doliatie po Pitke, barter, Jednota (v12.2)", () => {
  function vPitke(o: { vypite: number; jogurt?: boolean; poldeciKarty?: number; lokalita?: string; cigarety?: number }): GameState {
    const s0 = setupGame(data, 41);
    const k = (): PlacedCard => ({ card: instanceFor(data, "poldeci_v122", ["Poldeci", null, null, null], ["Poldeci", null, null, null]), playedBy: 0 });
    const lokalita = o.lokalita === undefined ? s0.lokalityVHre.find((x) => x.defId === "krcma")! : inst(o.lokalita);
    return {
      ...s0,
      faza: "pitka",
      utocnik: 1,
      ciel: { typ: "lokalita", lokalita },
      strany: [Array.from({ length: o.poldeciKarty ?? 0 }, k), []],
      pitkyCelkom: 2,
      pitkaCislo: 1,
      pitkaStav: { naTahu: 0, hotovy: [false, false], naexPouzity: [false, false], fajcenie: [0, 0], reakcia: null, postarka: [false, false], starosta: [false, false], naexPocet: [0, 0] },
      hraci: [
        { ...s0.hraci[0], poldeciPlne: 0, poldeciVypite: o.vypite, cigarety: o.cigarety ?? 3, dedicstvo: o.jogurt === true ? [inst("jogurt")] : [] },
        { ...s0.hraci[1], poldeciPlne: 0, poldeciVypite: 3 },
      ],
    };
  }
  /** Dohrá Pitku; vráti, koľko poldeci sa hráčovi 0 po nej dolialo podľa zdrojov (kniha poldeci). */
  const dohraj = (s: GameState): { state: GameState; dolial: Readonly<Record<string, number>> } => {
    let t = s;
    const dolial: Record<string, number> = {};
    for (let i = 0; i < 6 && t.faza === "pitka"; i++) {
      const q = ([0, 1] as const).find((x) => legalCommands(data, t, x).some((c) => c.type === "skipNaex"));
      if (q === undefined) break;
      const r = applySPrisunom(data, t, { type: "skipNaex" }, q);
      for (const e of r.events) if (e.type === "zmenaPoldeci" && e.hrac === 0 && e.suma > 0 && e.zdroj !== "obnova") dolial[e.zdroj] = (dolial[e.zdroj] ?? 0) + e.suma;
      t = r.state;
    }
    return { state: t, dolial };
  };
  const spolu = (d: Readonly<Record<string, number>>): number => Object.values(d).reduce((a, b) => a + b, 0);

  it("po Pitke sa doleje 1 poldeci zadarmo — doliatie za cigarety neexistuje", () => {
    const s = vPitke({ vypite: 3, cigarety: 9 });
    expect(legalCommands(data, s, 0).map((c) => c.type)).not.toContain("refillPoldeci");
    expect(() => apply(data, s, { type: "refillPoldeci" } as unknown as Command, 0)).toThrow(/nepozná/);
    expect(dohraj(s).dolial).toEqual({ pitka: KONSTANTY.POLDECI_PO_PITKE });
  });

  it("aktívne akcie Poldeci a Jogurt dolievajú po každej Pitke navyše, najviac všetky vypité", () => {
    // Dve karty s Poldeci vedľa seba: spoj Poldeci–Poldeci = 2 aktívne akcie.
    const s = vPitke({ vypite: 9, poldeciKarty: 2 });
    // Aktívne akcie Poldeci hráča 0 v línii (spoj kariet aj hrana Krčmy).
    const akcie = evaluateLine(data, lineState(s)).sums[0].Poldeci ?? 0;
    expect(akcie).toBeGreaterThanOrEqual(2);
    expect(dohraj(s).dolial).toEqual({ pitka: 1, akcie });
    expect(dohraj(vPitke({ vypite: 9, poldeciKarty: 2, jogurt: true })).dolial).toEqual({ pitka: 1, jogurt: KONSTANTY.JOGURT_POLDECI, akcie });
    expect(spolu(dohraj(vPitke({ vypite: 2, poldeciKarty: 2, jogurt: true })).dolial)).toBe(2);
  });

  it("barter: nový plný poldeci, maximum +1 natrvalo; Jednota ho tomu s viac Dlhmi zakáže", () => {
    const s = vPitke({ vypite: 3, cigarety: KONSTANTY.BARTER_CENA });
    const po = apply(data, s, { type: "barter" }, 0).state;
    expect(maximumPoldeci(po.hraci[0])).toBe(maximumPoldeci(s.hraci[0]) + 1);
    const jednota = vPitke({ vypite: 3, cigarety: KONSTANTY.BARTER_CENA, lokalita: "jednota" });
    const dlzny: GameState = { ...jednota, hraci: [{ ...jednota.hraci[0], dlhy: 2 }, jednota.hraci[1]] };
    expect(legalCommands(data, dlzny, 0).some((c) => c.type === "barter")).toBe(false);
    expect(() => apply(data, dlzny, { type: "barter" }, 0)).toThrow(/Jednota/);
  });
});

describe("§9.5 obnova po bitke a výkupné po finále (v12.2) — partie botov", () => {
  /** Partia botov; vráti stavy pred a po každom ťahu. */
  function partia(seed: number): { pred: GameState; po: GameState; events: readonly Event[] }[] {
    let s = setupGame(data, seed, { lokalit: 3 });
    const out: { pred: GameState; po: GameState; events: readonly Event[] }[] = [];
    for (let n = 0; n < 6000 && s.koniec === null; n++) {
      const kto = naTahu(s);
      if (kto === null) break;
      const r = applySPrisunom(data, s, tahBota(data, s, kto, seed * 31 + n), kto);
      out.push({ pred: s, po: r.state, events: r.events });
      s = r.state;
    }
    return out;
  }
  const kroky = [5, 6].flatMap(partia);
  const naStole = (s: GameState, p: PlayerId): number => s.strany.flat().filter((pl) => pl.naexBy === p || pl.naexBy2 === p).length;

  it("na začiatku každého ďalšieho kola má každý všetky poldeci plné", () => {
    let novychKol = 0;
    for (const { pred, po } of kroky) {
      if (po.kolo === pred.kolo || po.koniec !== null) continue;
      novychKol++;
      for (const p of [0, 1] as const) {
        expect(po.hraci[p].poldeciVypite).toBe(0);
        expect(po.hraci[p].poldeciPlne).toBe(maximumPoldeci(pred.hraci[p], naStole(pred, p)));
      }
    }
    expect(novychKol).toBeGreaterThan(2);
  });

  it("maximum poldeci sa mení len barterom, Vínkom a Krčmárkou — nič sa nestratí", () => {
    for (const { pred, po } of kroky) {
      if (po.koniec !== null) continue;
      for (const p of [0, 1] as const) {
        // Skryté NA EX ráta poldeci ešte medzi plnými, až pri odkrytí ľahne na kartu.
        const rozdiel = maximumPoldeci(po.hraci[p], naStole(po, p)) - maximumPoldeci(pred.hraci[p], naStole(pred, p));
        expect(rozdiel).toBeGreaterThanOrEqual(0);
        expect(rozdiel).toBeLessThanOrEqual(1);
      }
    }
  });

  it("po finále sa poldeci neobnovujú — vypité ostanú a výkupné ráta len plné", () => {
    // Bitka finále: poldeci z NA EX sa vypijú, nič sa neobnoví.
    const posledny = kroky.filter((k) => k.po.koniec?.body != null);
    expect(posledny.length).toBeGreaterThan(0);
    for (const { events } of posledny) expect(events.some((e) => e.type === "zmenaPoldeci" && e.zdroj === "obnova")).toBe(false);
    expect(kroky.some((k) => k.events.some((e) => e.type === "zmenaPoldeci" && e.zdroj === "obnova"))).toBe(true);
  });
});

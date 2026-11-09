// Zajatie a presvedčenie (pravidlá v11.4, Michal 2026-11-03, PRAVIDLA §10): pokus o zajatie
// v drafte zanikol. Držiteľ Nakladačky smie pri jej rozdelení zajať staršieho, ktorý sa ho bojí
// na červenej už pred touto Nakladačkou (v11.6 — od minulého kola), za 5 bodov; víťaz hádky smie
// pri jej rozdelení presvedčiť staršieho, pri ktorom má súper vyšší strach, keď má reči na
// červenej, za 5 bodov — karta staršieho mu natrvalo patrí. Vo finále ani jedno.
// Očakávané hodnoty sú z pravidla, nie z kódu.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { BitkaStav, CardInstance, Command, ElderState, GameState, PlayerId, Stupen, Vazen } from "../src/index.ts";
import {
  KONSTANTY,
  MOMENTY,
  apply,
  momenty,
  krokStavby,
  legalCommands,
  loadGameData,
  majitelPresvedcenej,
  metrika,
  moznostiAkcie,
  cenaAkcieUplna,
  zdvihyPreAkcie,
  naTahu,
  naladaMomentu,
  priazenHraca,
  setupGame,
  stavSchopnostiVazna,
  viewFor,
} from "../src/index.ts";
import { spustBitku } from "./helpers.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

function bitka(b: Partial<BitkaStav>): BitkaStav {
  return {
    krok: null,
    caka: null,
    sums: [{}, {}],
    exekutorHotovy: [true, true],
    exekutor: [0, 0],
    damage: null,
    vitaz: 0,
    prebytokDrzi: null,
    prebytokZostava: 0,
    prebytokZdvihy: [],
    prebytokPrepadlo: 0,
    spalit: [],
    vesticaHotova: true,
    ...b,
  };
}

interface Markery {
  readonly strach?: readonly [Stupen, Stupen];
  readonly reci?: readonly [Stupen, Stupen];
  readonly presvedcil?: PlayerId;
}

const s0 = setupGame(data, 4);
const id = (i: number): string => s0.starsi[i]!.elderId;
const karta = (i: number): CardInstance => s0.starsi[i]!.karta;
const elder = (s: GameState, i: number): ElderState | undefined => s.starsi.find((e) => e.elderId === id(i));

/**
 * Bitka o lokalitu v kroku rozdelenia: hráč p rozdeľuje `body` Nakladačky (prebytok, je víťaz
 * bitky) alebo hádky (reci). Starší podľa `markery` (index → strach, reči, kto presvedčil).
 */
function vRozdeleni(krok: "prebytok" | "reci", p: PlayerId, body: number, markery: Readonly<Record<number, Markery>>, upravy: (s: GameState) => GameState = (s) => s): GameState {
  const starsi = s0.starsi.map((e, i) => {
    const x = markery[i];
    if (x === undefined) return e;
    return { ...e, strach: x.strach ?? e.strach, reci: x.reci ?? e.reci, ...(x.presvedcil === undefined ? {} : { presvedcil: x.presvedcil }) };
  });
  const s: GameState = {
    ...s0,
    faza: "bitka",
    draftStav: null,
    starsi,
    spaky: [10, 10],
    ciel: { typ: "lokalita", lokalita: s0.lokalityVHre[0]! },
    lokalityVHre: s0.lokalityVHre.slice(1),
    nastenka: [
      { kolo: s0.kolo, lokalita: null, vitaz: p, rozhodlo: "tuhe", pitky: 1, zaBitku: [0, 0], zoSekery: 0, abstakZrazka: 0, prepadlo: 0, zaStarsich: [0, 0], exekutor: [0, 0], prebytok: [0, 0], spakyPo: [10, 10] },
    ],
    bitkaStav:
      krok === "prebytok"
        ? bitka({ krok: "prebytok", caka: p, vitaz: p, prebytokDrzi: p, prebytokZostava: body })
        : bitka({ krok: "reci", caka: p, vitaz: p, hadka: { makke: p === 0 ? [body, 0] : [0, body], vitaz: p, velkost: body, zostava: body, prepadlo: 0, zdvihy: [] } }),
  };
  return upravy(s);
}

/** Karta presvedčeného staršieho i v ruke / doberacom / odhadzovacom balíčku hráča q. */
function sKartou(s: GameState, q: PlayerId, i: number, kam: "ruka" | "doberaci" | "odhadzovaci"): GameState {
  const h = s.hraci[q];
  const novy = { ...h, [kam]: [...h[kam], karta(i)] };
  return { ...s, hraci: q === 0 ? [novy, s.hraci[1]] : [s.hraci[0], novy] };
}

/** Všetky karty hráčov a línie — kde všade leží uid. */
function kdeJe(s: GameState, uid: number): string[] {
  const out: string[] = [];
  for (const q of [0, 1] as const) {
    const h = s.hraci[q];
    for (const kopa of ["ruka", "doberaci", "odhadzovaci", "priznane", "dedicstvo"] as const) if (h[kopa].some((k) => k.uid === uid)) out.push(`${kopa}${q}`);
  }
  for (const q of [0, 1] as const) if (s.strany[q].some((pl) => pl.card.uid === uid)) out.push(`linia${q}`);
  return out;
}

/** Dohrá bitku prvým legálnym príkazom, kým sa kolo neskončí. */
function dohraj(s: GameState): GameState {
  let t = s;
  const kolo = s.kolo;
  for (let i = 0; i < 40 && t.kolo === kolo && t.bitkaStav !== null && t.koniec === null; i++) {
    const q = naTahu(t);
    if (q === null) break;
    const c = legalCommands(data, t, q).find((x) => x.type !== "vzdat");
    if (c === undefined) break;
    t = apply(data, t, c, q).state;
  }
  return t;
}

describe("§5 draft bez pokusu o zajatie (v11.4)", () => {
  it("po voľbe cieľa sa hneď stavia šenok — 4 do šenku, 4 naspodok; karta zadarmo ani pokus nie sú", () => {
    const s: GameState = { ...s0, starsi: s0.starsi.map((e, i) => (i === 0 ? { ...e, strach: [3, 0] } : e)) };
    const obranca: PlayerId = s.utocnik === 0 ? 1 : 0;
    const volba = legalCommands(data, s, obranca).find((c) => c.type === "chooseLocation") as Command;
    const t = apply(data, s, volba, obranca).state;
    expect(t.draftStav?.krok).toBe("stavba");
    expect(t.draftStav?.balicky[0]).toHaveLength(8);
    expect(krokStavby(8)).toEqual({ doSenku: 4, odhod: 4 });
    for (const p of [0, 1] as const) {
      expect(legalCommands(data, t, p).every((c) => c.type === "stavbaSenku" && c.doSenku.length === 4 && c.odhod.length === 4)).toBe(true);
    }
    expect(t.hraci[0].cigarety).toBe(s.hraci[0].cigarety);
  });
});

describe("§10 zajatie pri rozdelení Nakladačky (v11.4)", () => {
  it("za 5 bodov: starší na červenom strachu ide do pivnice, markery zmiznú, súper odovzdá špaky za investované reči (v11.12)", () => {
    const s = vRozdeleni("prebytok", 0, 5, { 0: { strach: [3, 1], reci: [0, 3] } });
    const cmd: Command = { type: "prebytok", zdvihy: [], zajatia: [id(0)] };
    expect(legalCommands(data, s, 0)).toContainEqual(cmd);
    expect(moznostiAkcie(s, 0, "strach", 5)).toEqual([id(0)]);
    const t = apply(data, s, cmd, 0).state;
    expect(elder(t, 0)).toBeUndefined();
    expect(t.vazni).toHaveLength(1);
    expect(t.vazni[0]).toMatchObject({ elderId: id(0), hrac: 0, poradie: 1 });
    // Borisove reči na červenej = 3 body hádky.
    expect(t.spaky).toEqual([13, 7]);
    expect(t.nastenka.at(-1)?.kradez).toEqual([3, -3]);
    expect(t.bitkaStav?.zajatia ?? []).toEqual([]);
  });

  it("v11.6: strach dotiahnutý na červenú v tej istej Nakladačke nestačí — zo strachu 2 ani s 8 bodmi nie", () => {
    const s = vRozdeleni("prebytok", 0, 8, { 0: { strach: [2, 0] } });
    expect(moznostiAkcie(s, 0, "strach", 8)).toEqual([]);
    expect(cenaAkcieUplna(elder(s, 0)!, 0, "strach")).toBeNull();
    expect(zdvihyPreAkcie(s, 0, "strach", [id(0)])).toEqual([]);
    expect(() => apply(data, s, { type: "prebytok", zdvihy: [], zajatia: [id(0)] }, 0)).toThrow(/od minulého kola/);
    expect(() => apply(data, s, { type: "prebytok", zdvihy: [{ elderId: id(0), na: 3 }], zajatia: [id(0)] }, 0)).toThrow(/od minulého kola/);
    expect(legalCommands(data, s, 0).some((c) => c.type === "prebytok" && (c.zajatia?.length ?? 0) > 0)).toBe(false);
    // Dotiahnutie bez zajatia ostáva — strach na červenej, zajať sa dá až v ďalšej Nakladačke.
    const t = apply(data, vRozdeleni("prebytok", 0, 3, { 0: { strach: [2, 0] } }), { type: "prebytok", zdvihy: [{ elderId: id(0), na: 3 }] }, 0).state;
    expect(elder(t, 0)?.strach[0]).toBe(3);
    expect(t.vazni).toEqual([]);
  });

  it("v11.6: strach na červenej z minulého kola — zajatie za 5 prejde, na 4 body nie", () => {
    const s = vRozdeleni("prebytok", 0, 5, { 0: { strach: [3, 0] } });
    expect(cenaAkcieUplna(elder(s, 0)!, 0, "strach")).toBe(5);
    expect(moznostiAkcie(s, 0, "strach", 5)).toEqual([id(0)]);
    expect(moznostiAkcie(s, 0, "strach", 4)).toEqual([]);
    const t = apply(data, s, { type: "prebytok", zdvihy: [], zajatia: [id(0)] }, 0).state;
    expect(t.vazni.map((v) => v.elderId)).toEqual([id(0)]);
  });

  it("viac zajatí v jednom rozdelení; zvyšok sa rozdelí ďalej (rozdeľ, čo sa dá) a prepadne, čo sa nedá", () => {
    const s = vRozdeleni("prebytok", 0, 11, { 0: { strach: [3, 0] }, 1: { strach: [3, 0] } });
    const dva = [id(0), id(1)];
    expect(() => apply(data, s, { type: "prebytok", zdvihy: [], zajatia: dva }, 0)).toThrow(/Rozdeľ, čo sa dá/);
    const t = apply(data, s, { type: "prebytok", zdvihy: [{ elderId: id(2), na: 1 }], zajatia: dva }, 0).state;
    expect(t.vazni.map((v) => [v.elderId, v.hrac, v.poradie])).toEqual([
      [id(0), 0, 1],
      [id(1), 0, 2],
    ]);
    expect(elder(t, 2)!.strach[0]).toBe(1);
    // Každého staršieho najviac raz.
    expect(() => apply(data, s, { type: "prebytok", zdvihy: [{ elderId: id(2), na: 1 }], zajatia: [id(0), id(0)] }, 0)).toThrow();
  });

  it("zajatie je dobrovoľné — keď sa inak dvíhať nedá, bitka počká na rozhodnutie a Nakladačka smie prepadnúť", () => {
    // Na stupnici sú len traja starší a všetci sa hráča 0 boja na červenej: strach nemá kam, zajať
    // môže (štyri červené víťaza by hru ukončili výhrou strachom).
    const s = vRozdeleni("prebytok", 0, 6, { 0: { strach: [3, 0] }, 1: { strach: [3, 0] }, 2: { strach: [3, 0] } }, (x) => ({
      ...x,
      starsi: x.starsi.slice(0, 3),
      bitkaStav: bitka({ krok: "hadka", caka: null, vitaz: null, sums: [{ Rana: 20 }, {}], hadka: { makke: [0, 0], vitaz: null, velkost: 0, zostava: 0, prepadlo: 0, zdvihy: [] } }),
    }));
    const t = spustBitku(data, s).state;
    expect(t.bitkaStav).toMatchObject({ krok: "prebytok", caka: 0 });
    expect(t.bitkaStav!.prebytokZostava).toBeGreaterThanOrEqual(KONSTANTY.CENA_ZAJATIA);
    expect(legalCommands(data, t, 0)).toContainEqual({ type: "prebytok", zdvihy: [] });
    const bez = apply(data, t, { type: "prebytok", zdvihy: [] }, 0).state;
    expect(bez.vazni.filter((v) => v.hrac === 0)).toHaveLength(0);
    expect(bez.starsi).toHaveLength(3);
  });

  it("väzni na výhru (Druhá liga 3) — výhra väzňami hneď po rozdelení Nakladačky", () => {
    const s = vRozdeleni("prebytok", 0, 5, { 0: { strach: [3, 0] } }, (x) => {
      const vazni: Vazen[] = [5, 6].map((j, i) => ({ elderId: x.starsi[j]!.elderId, hrac: 0, poradie: i + 1, karta: x.starsi[j]!.karta, scorecard: x.starsi[j]!.scorecard, miesto: j }));
      return { ...x, vazni, starsi: x.starsi.filter((_, j) => j !== 5 && j !== 6) };
    });
    const t = apply(data, s, { type: "prebytok", zdvihy: [], zajatia: [id(0)] }, 0).state;
    expect(t.koniec?.vitaz).toBe(0);
    expect(t.koniec?.body).toBeNull();
    expect(t.koniec?.dovod).toMatch(/výhra väzňami/);
  });

  it("výhra väzňami so zdvihom v tom istom rozdelení: priazeň zo zdvihu je v logu pred koncom hry, koniec je posledný", () => {
    const s = vRozdeleni("prebytok", 0, 6, { 0: { strach: [3, 0] }, 1: { strach: [0, 0] } }, (x) => {
      const vazni: Vazen[] = [5, 6].map((j, i) => ({ elderId: x.starsi[j]!.elderId, hrac: 0, poradie: i + 1, karta: x.starsi[j]!.karta, scorecard: x.starsi[j]!.scorecard, miesto: j }));
      return { ...x, vazni, starsi: x.starsi.filter((_, j) => j !== 5 && j !== 6) };
    });
    const { state: t, events } = apply(data, s, { type: "prebytok", zdvihy: [{ elderId: id(1), na: 1 }], zajatia: [id(0)] }, 0);
    expect(t.koniec?.dovod).toMatch(/výhra väzňami/);
    expect(events.at(-1)?.type).toBe("koniec");
    const priazen = events.findIndex((e) => e.type === "log" && /^Priazeň .+ dostáva Hráč 2\.$/.test(e.text));
    expect(priazen).toBeGreaterThan(-1);
    expect(priazen).toBeLessThan(events.findIndex((e) => e.type === "koniec"));
  });

  it("vo finále sa nezajíma: Nakladačka ide na špaky 1 : 1, zámer so zajatím server odmietne", () => {
    const s = vRozdeleni("prebytok", 0, 6, { 0: { strach: [3, 0] } }, (x) => ({
      ...x,
      ciel: { typ: "finale", lokalita: x.ciel!.lokalita! },
      bitkaStav: bitka({ krok: "hadka", caka: null, vitaz: null, sums: [{ Rana: 6 }, {}], hadka: { makke: [0, 0], vitaz: null, velkost: 0, zostava: 0, prepadlo: 0, zdvihy: [] } }),
    }));
    const t = dohraj(spustBitku(data, s).state);
    expect(t.vazni).toHaveLength(0);
    expect(t.nastenka.at(-1)!.prebytok[0]).toBeGreaterThan(0);
    const vynutene = vRozdeleni("prebytok", 0, 6, { 0: { strach: [3, 0] } }, (x) => ({ ...x, ciel: { typ: "finale", lokalita: x.ciel!.lokalita! } }));
    expect(() => apply(data, vynutene, { type: "prebytok", zdvihy: [], zajatia: [id(0)] }, 0)).toThrow(/finále/);
  });

  it("zajíma len držiteľ Nakladačky; hádka zajatie nepozná", () => {
    const s = vRozdeleni("prebytok", 0, 5, { 0: { strach: [3, 3] } });
    expect(() => apply(data, s, { type: "prebytok", zdvihy: [], zajatia: [id(0)] }, 1)).toThrow();
    const r = vRozdeleni("reci", 0, 5, { 0: { strach: [3, 0] } });
    expect(legalCommands(data, r, 0).some((c) => c.type === "prebytok")).toBe(false);
  });
});

describe("§10 presvedčenie pri rozdelení hádky (v11.12)", () => {
  it("hádka 10: reči na celý teplomer za 6 + presvedčenie 3, 1 bod inam", () => {
    const s = vRozdeleni("reci", 0, 10, { 0: { strach: [2, 3] } });
    const cmd: Command = { type: "reci", zdvihy: [{ elderId: id(0), na: 1 }, { elderId: id(1), na: 1 }], presvedcenia: [id(0)] };
    const t = apply(data, s, cmd, 0).state;
    const e = elder(t, 0)!;
    expect(e.presvedcil).toBe(0);
    // Reči aj strach oboch ostávajú, priazeň aj ďalej moja.
    expect(e.reci[0]).toBe(3);
    expect(e.reciOd?.[0]).toBe(1);
    expect(e.strach).toEqual([2, 3]);
    expect(priazenHraca(e)).toBe(0);
    // Karta staršieho ide presvedčovateľovi do ruky a patrí jemu.
    expect(kdeJe(t, karta(0).uid)).toEqual(["ruka0"]);
    expect(majitelPresvedcenej(t, karta(0).uid)).toBe(0);
    expect(t.vazni).toHaveLength(0);
  });

  it("ktorýkoľvek starší (v11.12); reči musia byť na celom teplomere", () => {
    const s = vRozdeleni("reci", 0, 9, { 0: { strach: [2, 2] }, 1: { strach: [1, 0] }, 2: { strach: [0, 0] } });
    expect(moznostiAkcie(s, 0, "reci", 9)).toEqual(expect.arrayContaining([id(0), id(1), id(2)]));
    expect(moznostiAkcie(s, 0, "reci", 8)).toEqual([]);
    // Reči len na žltej a oranžovej — presvedčiť nejde.
    expect(() => apply(data, s, { type: "reci", zdvihy: [{ elderId: id(2), na: 2 }], presvedcenia: [id(2)] }, 0)).toThrow(/celom teplomere/);
    // Z prázdneho teplomera 6 + 3 = 9.
    const t = apply(data, s, { type: "reci", zdvihy: [{ elderId: id(2), na: 3 }], presvedcenia: [id(2)] }, 0).state;
    expect(elder(t, 2)!.presvedcil).toBe(0);
  });

  it("kto prvý presvedčí, toho je — presvedčeného už nikto nepresvedčí, ani vlastník znova", () => {
    const sSupera = vRozdeleni("reci", 0, 8, { 0: { strach: [2, 3], presvedcil: 1 } }, (x) => sKartou(x, 1, 0, "doberaci"));
    expect(moznostiAkcie(sSupera, 0, "reci", 8)).not.toContain(id(0));
    expect(() => apply(data, sSupera, { type: "reci", zdvihy: [{ elderId: id(0), na: 3 }], presvedcenia: [id(0)] }, 0)).toThrow(/presvedčil/);
    const sMoj = vRozdeleni("reci", 0, 8, { 0: { strach: [2, 3], presvedcil: 0 } }, (x) => sKartou(x, 0, 0, "doberaci"));
    expect(() => apply(data, sMoj, { type: "reci", zdvihy: [{ elderId: id(0), na: 3 }], presvedcenia: [id(0)] }, 0)).toThrow(/presvedčil/);
  });

  it("vo finále sa nepresviedča", () => {
    const s = vRozdeleni("reci", 0, 8, { 0: { strach: [2, 3] } }, (x) => ({ ...x, ciel: { typ: "finale", lokalita: x.ciel!.lokalita! } }));
    expect(() => apply(data, s, { type: "reci", zdvihy: [{ elderId: id(0), na: 3 }], presvedcenia: [id(0)] }, 0)).toThrow(/finále/);
  });

  it("karta presvedčeného: po bitke ide do odhadzovacieho balíčka majiteľa — aj keby ju efekt spálil či poslal inam", () => {
    const linia = (x: GameState, spalit: boolean): GameState => ({
      ...x,
      strany: [[{ card: karta(0), playedBy: 0, poBitkeK: 1 }], []],
      bitkaStav: { ...x.bitkaStav!, spalit: spalit ? [karta(0).uid] : [] },
    });
    for (const spalit of [false, true]) {
      const s = vRozdeleni("prebytok", 0, 1, { 0: { strach: [0, 2], presvedcil: 0 } }, (x) => linia(x, spalit));
      const t = dohraj(apply(data, s, { type: "prebytok", zdvihy: [{ elderId: id(1), na: 1 }] }, 0).state);
      // Po návrate kariet je u majiteľa (na začiatku ďalšieho kola si ju mohol aj dobrať).
      expect(kdeJe(t, karta(0).uid)).toHaveLength(1);
      expect(kdeJe(t, karta(0).uid)[0]).toMatch(/^(odhadzovaci|doberaci|ruka)0$/);
      expect(elder(t, 0)!.presvedcil).toBe(0);
    }
  });

  it("Vízia presvedčeného nespáli — ide do odhadzovacieho balíčka majiteľa", () => {
    const s: GameState = {
      ...s0,
      faza: "pitka",
      vizia: { zostava: [1, 0] },
      starsi: s0.starsi.map((e, i) => (i === 0 ? { ...e, presvedcil: 0 as const } : e)),
      hraci: [{ ...s0.hraci[0], doberaci: [karta(0), ...s0.hraci[0].doberaci] }, s0.hraci[1]],
    };
    const t = apply(data, s, { type: "vizia", vziat: false }, 0).state;
    expect(kdeJe(t, karta(0).uid)).toEqual(["odhadzovaci0"]);
  });

  it("efekty, ktoré menia majiteľa (Hrobár, Veštica), presvedčeného preskočia", () => {
    const s = vRozdeleni("reci", 1, 1, { 0: { strach: [2, 3], presvedcil: 0 } }, (x) => sKartou(x, 0, 0, "odhadzovaci"));
    expect(stavSchopnostiVazna(s, 1).superovOdhadzovaci.some((k) => k.uid === karta(0).uid)).toBe(false);
    // Veštica: porazený (hráč 1) nesmie vymeniť presvedčeného z môjho doberacieho balíčka.
    const v = vRozdeleni("prebytok", 0, 1, { 0: { strach: [2, 3], presvedcil: 0 } }, (x) => {
      const y = sKartou(x, 0, 0, "doberaci");
      const h1 = { ...y.hraci[1], doberaci: [s0.obcania[0]!, ...y.hraci[1].doberaci] };
      return { ...y, hraci: [y.hraci[0], h1], bitkaStav: bitka({ krok: "vestica", caka: 1, vitaz: 0, vesticaHotova: false }) };
    });
    const jeho = v.hraci[0].doberaci.findIndex((k) => k.uid === karta(0).uid);
    expect(() => apply(data, v, { type: "vestica", moja: 0, jeho }, 1)).toThrow(/Presvedčený/);
    expect(legalCommands(data, v, 1).some((c) => c.type === "vestica" && c.jeho === jeho)).toBe(false);
  });
});

describe("§10 zajatie presvedčeného (v11.4)", () => {
  it.each([
    ["súper z jeho ruky", 1, "ruka"],
    ["súper z jeho doberacieho balíčka", 1, "doberaci"],
    ["vlastník zo svojho odhadzovacieho balíčka", 0, "odhadzovaci"],
  ] as const)("zajme ho %s — karta zmizne a ide do pivnice, presvedčenie zanikne", (_n, majitel, kam) => {
    const s = vRozdeleni("prebytok", 0, 5, { 0: { strach: [3, 1], presvedcil: majitel } }, (x) => sKartou(x, majitel, 0, kam));
    const t = apply(data, s, { type: "prebytok", zdvihy: [], zajatia: [id(0)] }, 0).state;
    expect(kdeJe(t, karta(0).uid)).toEqual([]);
    expect(t.vazni.map((v) => [v.elderId, v.hrac, v.karta.uid])).toEqual([[id(0), 0, karta(0).uid]]);
    expect(majitelPresvedcenej(t, karta(0).uid)).toBeNull();
  });

  it("presvedčený v súperovej línii: po zajatí sa po bitke nevráti do jeho balíčka", () => {
    const s = vRozdeleni("prebytok", 0, 5, { 0: { strach: [3, 1], presvedcil: 1 } }, (x) => ({ ...x, strany: [[], [{ card: karta(0), playedBy: 1 }]] }));
    const t = dohraj(apply(data, s, { type: "prebytok", zdvihy: [], zajatia: [id(0)] }, 0).state);
    expect(kdeJe(t, karta(0).uid)).toEqual([]);
    expect(t.vazni[0]?.karta.uid).toBe(karta(0).uid);
  });
});

describe("viewFor (nemenné pravidlo 2) — presvedčený a väzni", () => {
  it("kto koho presvedčil je verejné, kde jeho karta práve je (ruka či balíček), súper nevidí", () => {
    const iny = s0.obcania[0]!;
    const zaklad = (x: GameState): GameState => ({ ...x, starsi: x.starsi.map((e, i) => (i === 0 ? { ...e, presvedcil: 0 as const } : e)) });
    const vRuke = zaklad({ ...s0, hraci: [{ ...s0.hraci[0], ruka: [...s0.hraci[0].ruka, karta(0)], doberaci: [iny, ...s0.hraci[0].doberaci] }, s0.hraci[1]] });
    const vBalicku = zaklad({
      ...s0,
      hraci: [{ ...s0.hraci[0], ruka: [...s0.hraci[0].ruka, iny], doberaci: [karta(0), ...s0.hraci[0].doberaci] }, s0.hraci[1]],
    });
    const a = viewFor(data, vRuke, 1);
    const b = viewFor(data, vBalicku, 1);
    expect(a.starsi[0]!.presvedcil).toBe(0);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    // Majiteľ svoju ruku vidí.
    expect(viewFor(data, vRuke, 0).ruka.some((k) => k.uid === karta(0).uid)).toBe(true);
    expect(viewFor(data, vBalicku, 0).ruka.some((k) => k.uid === karta(0).uid)).toBe(false);
  });

  it("zajatia a presvedčenia v bitke sú verejné obom", () => {
    const s = vRozdeleni("reci", 0, 9, { 0: { strach: [2, 3] } });
    const t = apply(data, s, { type: "reci", zdvihy: [{ elderId: id(0), na: 1 }], presvedcenia: [id(0)] }, 0).state;
    expect(viewFor(data, t, 1).starsi.find((e) => e.elderId === id(0))?.presvedcil).toBe(0);
  });
});

describe("achievementy a Melichar pri zajatí a presvedčení", () => {
  it("Prvý väzeň, Zachránené a Hrôza a des merajú zajatie; Patrón presvedčenie; ids ostali — kto ich má, nestratí ich", async () => {
    const katalog = (await import("../data/achievementy.json")).default as { achievementy: { id: string; metrika: string }[] };
    const metrikaAch = (aid: string): string | undefined => katalog.achievementy.find((a) => a.id === aid)?.metrika;
    expect(metrikaAch("budicek")).toBe("prvyVazen");
    expect(metrikaAch("zachranene")).toBe("zmarenyPokus");
    expect(metrikaAch("hroza-a-des")).toBe("vyhraVydesenim");
    expect(metrikaAch("patron")).toBe("stat.bitkyOStarsich");
  });

  it("Melichar: zajatie a presvedčenie hráčom je pohoda, súperom smola; pečiatky pri zmene", () => {
    for (const typ of ["zajatie", "presvedcenie"] as const) {
      const m = { typ, ...MOMENTY[typ], hrac: 1, popis: "" } as const;
      expect(naladaMomentu(m, 1)).toBe("pohoda");
      expect(naladaMomentu(m, 0)).toBe("smola");
    }
    const z = vRozdeleni("prebytok", 0, 5, { 0: { strach: [3, 0] } });
    expect(momenty(data, z, apply(data, z, { type: "prebytok", zdvihy: [], zajatia: [id(0)] }, 0).state, []).some((m) => m.typ === "zajatie" && m.hrac === 0)).toBe(true);
    const p = vRozdeleni("reci", 1, 9, { 0: { strach: [3, 2] } });
    expect(momenty(data, p, apply(data, p, { type: "reci", zdvihy: [{ elderId: id(0), na: 1 }], presvedcenia: [id(0)] }, 1).state, []).some((m) => m.typ === "presvedcenie" && m.hrac === 1)).toBe(true);
  });
});

describe("metriky zajatia (achievementy)", () => {
  const krok = (pred: GameState, po: GameState) => ({ pred, po }) as unknown as Parameters<NonNullable<ReturnType<typeof metrika>>["zmer"]>[0];
  it("prvyVazen: prvý väzeň partie; zmarenyPokus: vyhratá bitka proti súperovi, ktorého sa starší bojí na červenej", () => {
    const s = vRozdeleni("prebytok", 0, 5, { 0: { strach: [3, 0] } });
    const zajal = apply(data, s, { type: "prebytok", zdvihy: [], zajatia: [id(0)] }, 0).state;
    expect(metrika("prvyVazen")?.zmer(krok(s, zajal))).toEqual([1, null]);
    const pred: GameState = { ...s, nastenka: [] };
    const bitkaHraca = (p: PlayerId): GameState => ({ ...pred, nastenka: [{ ...s.nastenka[0]!, vitaz: p }] });
    expect(metrika("zmarenyPokus")?.zmer(krok(pred, bitkaHraca(1)))).toEqual([null, 1]);
    expect(metrika("zmarenyPokus")?.zmer(krok(pred, bitkaHraca(0)))).toEqual([null, null]);
  });
});

describe("konštanty v11.4", () => {
  it("zajatie stojí 5 bodov, presvedčenie 3 (v11.12)", () => {
    expect(KONSTANTY.CENA_ZAJATIA).toBe(5);
    expect(KONSTANTY.CENA_PRESVEDCENIA).toBe(3);
  });
});

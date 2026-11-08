// Skryté akcie (Michal 2026-11-08, docs/napady/skryte-akcie.html, skupina A): efekty, ktoré
// dávali Ranu, Pecku či Hazard slovami, sú v zápise akcie navyše „Bitka: podmienka {Akcia}.“
// (Pasca, Pijan, Svokra, Vymáhač, Šofér, Traktorista, Výherný automat). Rany a Pecky idú do
// súčtov, takže ich zosilnia Vidly a Valaška; inak sa výsledok v hre nemení. Staré texty
// platia ďalej, kým admin nezapíše nové. K tomu Vedúcko a Sypač menia aj akcie navyše
// a pečať Podpory a Konfliktu má šípky k susedom.
// Očakávané hodnoty sú z pravidla (špecifikácia), nie z kódu.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import frakcieJson from "./data/frakcie-karty.json";
import skryteJson from "./data/skryte-akcie-karty.json";
import stareJson from "./data/skryte-akcie-stare.json";
import type { CardInstance, GameData, GameState, PlacedCard, PlayerId } from "../src/index.ts";
import type { Layout4 } from "./helpers.ts";
import { EMPTY, instanceFor, makeDef, syntheticData } from "./helpers.ts";
import {
  apply,
  cardVariants,
  efektyNavyse,
  evaluateLine,
  legalCommands,
  lineState,
  loadGameData,
  parseCards,
  pocitadloBitky,
  poskodenieBitky,
  printedSides,
  prahyHraca,
  rozborNavyse,
  rozpisPoskodenia,
  sPrilozenou,
  setupGame,
  tahBota,
  textBezAkcii,
} from "../src/index.ts";

type Surova = Record<string, unknown> & { id: string };

/** Sada z cards.json so zmenami zo zoznamov (texty v zápise tvorcu). */
function sadaSoZmenami(...zoznamy: { readonly karty: readonly unknown[] }[]): GameData {
  const zmeny = new Map<string, Surova>();
  for (const z of zoznamy) for (const k of z.karty as Surova[]) zmeny.set(k.id, { ...zmeny.get(k.id), ...k });
  const cards = (cardsJson as { cards: Surova[] }).cards.map((c) => {
    const z = zmeny.get(c.id);
    if (z === undefined) return c;
    const novy: Surova = { ...c, ...z };
    const def = parseCards({ cards: [novy] }).get(c.id);
    if (def === undefined) throw new Error(c.id);
    const v = cardVariants(def);
    return { ...novy, permutations: { total: v.total, left: v.left.length, right: v.right.length } };
  });
  return loadGameData({ ...cardsJson, cards }, eldersJson, scorecardsJson);
}

/** Starý text (slovami) a nový zápis — inak tá istá sada. cards.json už hrá nový zápis,
 *  preto staré texty idú z vlastnej kópie. */
const stara = sadaSoZmenami(frakcieJson, stareJson);
const nova = sadaSoZmenami(frakcieJson, skryteJson);

const SEDEM = ["pasca", "pijan", "svokra", "vymahac", "sofer", "traktoristka", "vyherny_automat"] as const;

let uidSeq = 980000;
const inst = (defId: string): CardInstance => ({ uid: ++uidSeq, defId, leftLayout: 0, rightLayout: 0 });
const lezi = (card: CardInstance, playedBy: PlayerId, x: Partial<PlacedCard> = {}): PlacedCard => ({ card, playedBy, ...x });

interface Stol {
  readonly strany: GameState["strany"];
  readonly naexVKole?: readonly [boolean, boolean];
  readonly dlhy?: readonly [number, number];
  readonly dedicstvo?: readonly [readonly string[], readonly string[]];
  readonly prilozeniaKu?: readonly [number, number];
}

/** Zhromaždenie na Zastávke s danou líniou — v oboch sadách ten istý stav. */
function stol(data: GameData, x: Stol): GameState {
  const s0 = setupGame(data, 7);
  const lokalita = s0.lokalityVHre.find((k) => k.defId === "zastavka") ?? inst("zastavka");
  const ded = x.dedicstvo ?? [[], []];
  const hraci = s0.hraci.map((h, p) => ({
    ...h,
    dlhy: x.dlhy?.[p] ?? 0,
    // Rovnaké uid v oboch sadách — inak by sa porovnanie líšilo len poradím.
    dedicstvo: (ded[p] ?? []).map((d, i) => ({ uid: 990000 + 10 * p + i, defId: d, leftLayout: 0, rightLayout: 0 })),
  })) as unknown as GameState["hraci"];
  return {
    ...s0,
    hraci,
    faza: "zhromazdenie",
    utocnik: 0,
    ciel: { typ: "lokalita", lokalita },
    lokalityVHre: s0.lokalityVHre.filter((k) => k !== lokalita),
    strany: x.strany,
    naexVKole: x.naexVKole ?? [false, false],
    ...(x.prilozeniaKu === undefined ? {} : { prilozeniaKu: x.prilozeniaKu }),
  };
}

const tuhe = (data: GameData, s: GameState): readonly [number, number] => poskodenieBitky(data, s, evaluateLine(data, lineState(s)).sums).tuhe;

/** Scenáre skupiny A: koľko Rán a Pecák navyše má hráč 0 (z pravidla, §16). */
function scenare(): { readonly nazov: string; readonly x: Stol; readonly rany: number; readonly pecky: number }[] {
  const pijan = inst("pijan");
  return [
    {
      nazov: "Pijan: Rana za každé svoje NA EX v kole (2)",
      x: { strany: [[lezi(pijan, 0, { naexBy: 0 }), lezi(inst("vandal"), 0, { naexBy: 0 })], []], naexVKole: [true, false] },
      rany: 2,
      pecky: 0,
    },
    {
      nazov: "Svokra: Rana za každú tvoju kartu so súperovým NA EX (1)",
      x: { strany: [[lezi(inst("svokra"), 0), lezi(inst("vandal"), 0, { naexBy: 1 })], []], naexVKole: [false, true] },
      rany: 1,
      pecky: 0,
    },
    { nazov: "Vymáhač: Rana za každé 2 priznané Dlhy (5 → 2)", x: { strany: [[lezi(inst("vymahac"), 0)], []], dlhy: [5, 0] }, rany: 2, pecky: 0 },
    { nazov: "Šofér bez NA EX v kole: Pecka", x: { strany: [[lezi(inst("sofer"), 0)], []] }, rany: 0, pecky: 1 },
    { nazov: "Šofér po NA EX: nič", x: { strany: [[lezi(inst("sofer"), 0)], []], naexVKole: [true, false] }, rany: 0, pecky: 0 },
    { nazov: "Traktorista s prevahou v kraji: Pecka", x: { strany: [[lezi(inst("traktoristka"), 0)], []] }, rany: 0, pecky: 1 },
    {
      nazov: "Pasca v Dedičstve, súper priložil k tvojej: Rana",
      x: { strany: [[lezi(inst("masiar"), 0)], []], dedicstvo: [["pasca"], []], prilozeniaKu: [1, 0] },
      rany: 1,
      pecky: 0,
    },
    { nazov: "Pasca bez priloženia: nič", x: { strany: [[lezi(inst("masiar"), 0)], []], dedicstvo: [["pasca"], []] }, rany: 0, pecky: 0 },
  ];
}

describe("zápis „Bitka: podmienka {Akcia}.“ — texty pre admina", () => {
  it("všetkých 7 kariet má akciu navyše z textu, Vdova nie", () => {
    const efekty = Object.fromEntries(SEDEM.map((id) => [id, efektyNavyse(nova.cards.get(id)!)]));
    expect(efekty.pasca).toEqual([{ spustac: "Bitka", tag: null, akcie: ["Rana"], podmienka: "Ak súper v tomto kole priložil kartu k tvojej", dedicstvo: true }]);
    expect(efekty.pijan).toEqual([{ spustac: "Bitka", tag: null, akcie: ["Rana"], podmienka: "Za každé NA EX, ktoré si v tomto kole dal" }]);
    expect(efekty.svokra?.[0]?.akcie).toEqual(["Rana"]);
    expect(efekty.vymahac?.[0]?.akcie).toEqual(["Rana"]);
    expect(efekty.sofer?.[0]).toMatchObject({ spustac: "Bitka", akcie: ["Pecka"], podmienka: "Ak si v tomto kole nedal NA EX" });
    expect(efekty.traktoristka?.[0]).toMatchObject({ spustac: "Bitka", akcie: ["Pecka"], podmienka: "Ak máš v jeho kraji prevahu" });
    // Hazard je akcia Dlh (alias tvorcu).
    expect(efekty.vyherny_automat).toEqual([{ spustac: "Posledná Pitka kola", tag: null, akcie: ["Dlh"], dedicstvo: true }]);
    expect(efektyNavyse(nova.cards.get("velmi_smutiaca_vdova")!)).toEqual([]);
    for (const k of skryteJson.karty) expect(rozborNavyse(k.effect_text).chyby, k.id).toEqual([]);
    // Pole efektu ukáže podmienku a zvyšok vety, piktogram kreslí pečať.
    expect(textBezAkcii(nova.cards.get("sofer")!.effectText)).toBe("Bitka: Ak si v tomto kole nedal NA EX a dostaneš 1 cigaretu.");
    expect(textBezAkcii(nova.cards.get("vyherny_automat")!.effectText)).toBe("Dedičstvo: Tvoj prah Dlhu je o 1 vyšší. Posledná Pitka kola.");
  });

  it("staré texty (slovami) akciu navyše nemajú — platia ako doteraz", () => {
    for (const id of SEDEM) expect(efektyNavyse(stara.cards.get(id)!), id).toEqual([]);
  });

  it("Cirhóza, Lesná cesta a Ihrisko ostávajú slovami", () => {
    for (const id of ["cirhoza", "lesna_cesta", "ihrisko"]) expect(efektyNavyse(nova.cards.get(id)!), id).toEqual([]);
  });
});

describe("výsledok v hre sa nemení — okrem Vidiel a Valašky", () => {
  for (const sc of scenare()) {
    it(sc.nazov, () => {
      const sN = stol(nova, sc.x);
      const sS = stol(stara, sc.x);
      // Bez Náradia ten istý výsledok: v novom zápise sú to akcie v súčtoch, v starom tuhé navyše.
      expect(tuhe(nova, sN)).toEqual(tuhe(stara, sS));
      const sumy = evaluateLine(nova, lineState(sN)).sums[0];
      const sumyStare = evaluateLine(stara, lineState(sS)).sums[0];
      expect((sumy.Rana ?? 0) - (sumyStare.Rana ?? 0)).toBe(sc.rany);
      expect((sumy.Pecka ?? 0) - (sumyStare.Pecka ?? 0)).toBe(sc.pecky);
      // Rozpis bitky ich ukáže pri akciách, nie ako bonus karty.
      const rN = rozpisPoskodenia(nova, sN, evaluateLine(nova, lineState(sN)).sums)[0];
      const rS = rozpisPoskodenia(stara, sS, evaluateLine(stara, lineState(sS)).sums)[0];
      expect(rN.zAkcii - rS.zAkcii).toBe(sc.rany + 2 * sc.pecky);
      expect(rN.bonusy.filter((b) => (SEDEM as readonly string[]).includes(b.zdroj))).toEqual([]);
    });
  }

  it("Vidly zosilnia Rany navyše (+1 za každú), Valaška Pecky navyše; starý text nie (Michal 2026-11-08)", () => {
    for (const sc of scenare()) {
      for (const [nastroj, kusov] of [["vidly", sc.rany], ["boxer", sc.pecky]] as const) {
        const x: Stol = { ...sc.x, dedicstvo: [[...(sc.x.dedicstvo?.[0] ?? []), nastroj], []] };
        const rozdiel = tuhe(nova, stol(nova, x))[0] - tuhe(stara, stol(stara, x))[0];
        expect(rozdiel, `${sc.nazov} + ${nastroj}`).toBe(kusov);
      }
    }
  });

  it("Šoférova cigareta a Traktoristov Dlh bez prevahy ostávajú slovami — pri bitke ich dá motor", () => {
    // Traktorista na súperovej strane, kde má súper prevahu: Pecka nie, Dlh áno (ako doteraz).
    const x: Stol = { strany: [[], [lezi(inst("traktoristka"), 0), lezi(inst("vandal"), 1), lezi(inst("masiar"), 1)]] };
    const sN = stol(nova, x);
    expect(evaluateLine(nova, lineState(sN)).cards.get(x.strany[1][0]!.card.uid)?.navyse?.[0]?.krat).toBe(0);
    expect(tuhe(nova, sN)).toEqual(tuhe(stara, stol(stara, x)));
  });
});

describe("pečať: sivá, kým spúšťač neplatí, výrazná, keď platí", () => {
  it("Šofér: platí bez NA EX, po NA EX zhasne; Pijan ×N za NA EX", () => {
    const sofer = inst("sofer");
    const bez = evaluateLine(nova, lineState(stol(nova, { strany: [[lezi(sofer, 0)], []] })));
    expect(bez.cards.get(sofer.uid)?.navyse?.[0]?.krat).toBe(1);
    const po = evaluateLine(nova, lineState(stol(nova, { strany: [[lezi(sofer, 0)], []], naexVKole: [true, false] })));
    expect(po.cards.get(sofer.uid)?.navyse?.[0]?.krat).toBe(0);
    const pijan = inst("pijan");
    const ev = evaluateLine(nova, lineState(stol(nova, { strany: [[lezi(pijan, 0, { naexBy: 0 }), lezi(inst("vandal"), 0, { naexBy: 0 })], []] })));
    expect(ev.cards.get(pijan.uid)?.navyse?.[0]?.krat).toBe(2);
  });

  it("Pasca a Výherný automat v Dedičstve majú stav pečate; Hazard automatu nejde do súčtov", () => {
    const s = stol(nova, { strany: [[lezi(inst("masiar"), 0)], []], dedicstvo: [["pasca", "vyherny_automat"], []], prilozeniaKu: [1, 0] });
    const ev = evaluateLine(nova, lineState(s));
    const pasca = s.hraci[0].dedicstvo[0]!.uid;
    const automat = s.hraci[0].dedicstvo[1]!.uid;
    expect(ev.navyseDedicstva?.get(pasca)?.[0]?.krat).toBe(1);
    expect(ev.navyseDedicstva?.get(automat)?.[0]?.krat).toBe(0);
    const vPoslednejPitke = { ...s, faza: "pitka" as const, pitkaCislo: 1, pitkyCelkom: 1 };
    const evPitka = evaluateLine(nova, lineState(vPoslednejPitke));
    expect(evPitka.navyseDedicstva?.get(automat)?.[0]?.krat).toBe(1);
    // Dlh dáva motor na konci poslednej Pitky ako doteraz — súčet Hazardu sa nemení.
    expect(evPitka.sums[0].Dlh ?? 0).toBe(evaluateLine(stara, lineState(stol(stara, { strany: s.strany, dedicstvo: [["pasca", "vyherny_automat"], []] }))).sums[0].Dlh ?? 0);
    // Prah Dlhu o 1 vyšší platí ďalej.
    expect(prahyHraca(nova, s, 0).dlh).toBe(prahyHraca(stara, stol(stara, { strany: s.strany, dedicstvo: [["vyherny_automat"], []] }), 0).dlh);
  });

  it("Pasca v línii (nie v Dedičstve) akciu navyše nedá", () => {
    const pasca = inst("pasca");
    const ev = evaluateLine(nova, lineState(stol(nova, { strany: [[lezi(pasca, 0)], []], prilozeniaKu: [1, 0] })));
    expect(ev.cards.get(pasca.uid)?.navyse?.[0]?.krat).toBe(0);
  });
});

describe("počítadlo a rekapitulácia bitky", () => {
  it("Rana Pascy v Dedičstve ide medzi bonusy počítadla, nie ako karta línie", () => {
    const s = stol(nova, { strany: [[lezi(inst("masiar"), 0)], []], dedicstvo: [["pasca"], []], prilozeniaKu: [1, 0] });
    const linia = evaluateLine(nova, lineState(s));
    const p = pocitadloBitky(nova, s, linia, tuhe(nova, s));
    const pasca = s.hraci[0].dedicstvo[0]!.uid;
    expect(p.kroky.some((k) => k.uid === pasca)).toBe(false);
    expect(p.kroky.find((k) => k.druh === "bonus" && k.zdroj === "pasca")?.zmena).toBe(1);
  });
});

describe("Vedúcko a Sypač menia aj akcie navyše (Michal 2026-11-08)", () => {
  it("Vedúcko: Robota navyše Živnostníka vedľa neho je Pecka — v súčtoch aj v stave pečate", () => {
    const ziv = inst("zivnostnik");
    // Vedúcko je Autorita — Živnostník (Spoločník: Autorita {Robota}) platí.
    const ev = evaluateLine(nova, lineState(stol(nova, { strany: [[lezi(inst("veducko"), 0), lezi(ziv, 0)], []] })));
    const stav = ev.cards.get(ziv.uid)?.navyse?.[0];
    expect(stav?.krat).toBe(1);
    expect(stav?.ako).toEqual(["Pecka"]);
    const zdroje = ev.zdroje[0];
    expect(zdroje.Pecka?.some((z) => z.uid === ziv.uid && z.dovody.includes("karta:veducko"))).toBe(true);
    expect(zdroje.Robota?.some((z) => z.uid === ziv.uid && z.dovody.some((d) => d.startsWith("akcia navyše")))).not.toBe(true);
  });

  it("Sypač: tvoj Chlap má aj Rany navyše ako Pecky; ostatné modifikátory akcie navyše nemenia", () => {
    const pijan = inst("pijan");
    const x: Stol = { strany: [[lezi(pijan, 0, { naexBy: 0, ranyAkoPecky: true })], []] };
    const ev = evaluateLine(nova, lineState(stol(nova, x)));
    expect(ev.cards.get(pijan.uid)?.navyse?.[0]?.ako).toEqual(["Pecka"]);
    expect(ev.zdroje[0].Pecka?.some((z) => z.uid === pijan.uid && z.dovody.includes("karta:kulturista"))).toBe(true);
    const navyse = (e: typeof ev, a: "Rana" | "Pecka") => (e.zdroje[0][a] ?? []).filter((z) => z.uid === pijan.uid && z.dovody[0]?.startsWith("akcia navyše") === true).reduce((n, z) => n + z.hodnota, 0);
    expect(navyse(ev, "Pecka")).toBe(1);
    expect(navyse(ev, "Rana")).toBe(0);
    // Bez Sypača tá istá karta dá Ranu navyše.
    const bez = evaluateLine(nova, lineState(stol(nova, { strany: [[lezi(pijan, 0, { naexBy: 0 })], []] })));
    expect(navyse(bez, "Rana")).toBe(1);
    expect(navyse(bez, "Pecka")).toBe(0);
  });

  it("zmenenú akciu na hrane vidno na dotknutej karte (ako: Pecka)", () => {
    // Chlap s vytlačenou Ranou: jeho Rany ako Pecky (Sypač).
    const chlap = [...nova.cards.values()].find((d) => d.tags.includes("Chlap") && d.tags.includes("Občan") && (() => {
      const st = printedSides(nova, { defId: d.id, leftLayout: 0, rightLayout: 0 });
      return [...st.left, ...st.right].includes("Rana");
    })());
    expect(chlap).toBeDefined();
    const k = inst(chlap!.id);
    const ev = evaluateLine(nova, lineState(stol(nova, { strany: [[lezi(k, 0, { ranyAkoPecky: true })], []] })));
    const sloty = [...(ev.cards.get(k.uid)?.left ?? []), ...(ev.cards.get(k.uid)?.right ?? [])].filter((x) => x?.action === "Rana");
    expect(sloty.length).toBeGreaterThan(0);
    for (const x of sloty) expect(x?.ako).toBe("Pecka");
  });
});

describe("premenu Anonymného alkoholika a Tipéra vidno na karte (Michal 2026-11-08)", () => {
  it("Anonymný alkoholik: Poškodenie pečene navyše suseda je Viera — v súčtoch aj v pečati; hrana tiež", () => {
    // Akcia navyše s pečeňou v sade zatiaľ nie je — Miňištrant na skúšku: „Spoločník: Závislý {Poškodenie pečene}.“
    const d = sadaSoZmenami(frakcieJson, skryteJson, { karty: [{ id: "ministrant", effect_text: "Spoločník: Závislý {Poškodenie pečene}." }] });
    const min = inst("ministrant");
    const aa = inst("anonymny_alkoholik");
    const ev = evaluateLine(d, lineState(stol(d, { strany: [[lezi(aa, 0), lezi(min, 0)], []] })));
    const stav = ev.cards.get(min.uid)?.navyse?.[0];
    expect(stav?.krat).toBe(1);
    expect(stav?.ako).toEqual(["Viera"]);
    expect(ev.zdroje[0].Viera?.some((z) => z.uid === min.uid && z.dovody.includes("karta:anonymny_alkoholik"))).toBe(true);
    expect(ev.zdroje[0].PoškodeniePečene?.some((z) => z.uid === min.uid && z.dovody[0]?.startsWith("akcia navyše") === true)).not.toBe(true);
    for (const x of [...(ev.cards.get(min.uid)?.left ?? []), ...(ev.cards.get(min.uid)?.right ?? [])]) {
      if (x?.action === "PoškodeniePečene") expect(x).toMatchObject({ ako: "Viera", naKarte: true });
    }
  });

  it("Profesionálny tipér: posilnené akcie na jeho spoji karta ukáže ako Robotu (svoje) — na oboch kartách spoja", () => {
    const T_R: Layout4 = ["Posilnenie", "Pecka", null, null];
    const A_L: Layout4 = ["Posilnenie", "Rana", null, null];
    const d = syntheticData([makeDef("profesionalny_tiper", EMPTY, T_R), makeDef("a", A_L, EMPTY)]);
    const t = instanceFor(d, "profesionalny_tiper", EMPTY, T_R);
    const a = instanceFor(d, "a", A_L, EMPTY);
    const ev = evaluateLine(d, { lokalita: null, lokalitaOtocena: false, strany: [[], [lezi(t, 0), lezi(a, 0)]] });
    expect(ev.sums[0]).toEqual({ Robota: 4 });
    const sloty = [t, a].flatMap((k) => [...(ev.cards.get(k.uid)?.left ?? []), ...(ev.cards.get(k.uid)?.right ?? [])]).filter((x) => x?.action === "Pecka" || x?.action === "Rana");
    expect(sloty).toHaveLength(2);
    for (const x of sloty) expect(x).toMatchObject({ ako: "Robota", naKarte: true });
  });

  it("Šarlatán ani Výtržník sa na karte zatiaľ nekreslia", () => {
    const k = inst("pijan");
    const ev = evaluateLine(nova, lineState(stol(nova, { strany: [[lezi(k, 0, { vytrznik: true, naexBy: 0, naexBy2: 1 })], []] })));
    for (const x of [...(ev.cards.get(k.uid)?.left ?? []), ...(ev.cards.get(k.uid)?.right ?? [])]) expect(x?.naKarte).toBeUndefined();
  });
});

describe("šípky pečate pri Podpore a Konflikte", () => {
  it("Konflikt si pamätá kartu, s ktorou sa spustil", () => {
    // Praudovravec (Konflikt: Autorita {Pohoršenie}) priložený k súperovej Svokre (Autorita).
    const svokra = lezi(inst("svokra"), 1);
    const praud = inst("praudovravec");
    const s = stol(nova, { strany: [[svokra], []] });
    const po = sPrilozenou(nova, s, 0, praud, 0);
    const pl = po.strany[0].find((x) => x.card.uid === praud.uid);
    expect(pl?.navyseOd).toEqual([[svokra.card.uid]]);
    const stav = evaluateLine(nova, lineState(po)).cards.get(praud.uid)?.navyse?.[0];
    expect(stav?.krat).toBe(1);
    expect(stav?.od).toEqual([svokra.card.uid]);
  });
});

describe("partia botov so sadou skrytých akcií", () => {
  it("dobehne do konca", () => {
    for (const seed of [5, 13]) {
      let s = setupGame(nova, seed, { lokalit: 5 });
      for (let n = 0; n < 20000 && s.koniec === null; n++) {
        const p = ([0, 1] as const).find((q) => legalCommands(nova, s, q).length > 0 && (s.hasicVolby?.[0]?.hrac ?? q) === q) ?? null;
        if (p === null) break;
        s = apply(nova, s, tahBota(nova, s, p, n * 7919 + seed), p).state;
      }
      expect(s.koniec, `seed ${seed}`).not.toBeNull();
    }
  }, 120_000);
});

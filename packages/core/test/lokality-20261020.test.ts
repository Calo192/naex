// Lokality podľa voľby Michala 2026-10-20 (docs/playtesty/navrh-lokality.html):
// 7 prerobených a 7 nových. Nové lokality ešte nie sú vo zverejnenej sade —
// testy im dajú syntetickú kartu s tým istým id; efekty idú podľa id.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { BitkaStav, CardDef, CardInstance, GameData, GameState, PitkaStav, PlacedCard, PlayerId } from "../src/index.ts";
import {
  KONSTANTY,
  apply,
  barterCena,
  bitkaMody,
  buildGameData,
  cieleVykladania,
  exekutorLokality,
  legalCommands,
  loadGameData,
  moznostiNaex,
  naexZaPitku,
  pohorsenieBezLimitu,
  parseScorecards,
  planVykladania,
  evaluateLine,
  prahyHraca,
  prevahaStran,
  rozpisPoskodenia,
  setupGame,
} from "../src/index.ts";
import { instanceFor, makeDef, syntheticData } from "./helpers.ts";

const zaklad = loadGameData(cardsJson, eldersJson, scorecardsJson);
const NOVE = ["most", "cintorin", "obecny_urad", "jednota", "kulturny_dom", "vinna_pivnica", "druzstvo"];

function sadaS(...defs: CardDef[]): GameData {
  const cards = new Map(zaklad.cards);
  for (const d of defs) if (!cards.has(d.id)) cards.set(d.id, d);
  return buildGameData(cards, zaklad.elders, parseScorecards(scorecardsJson));
}
const data = sadaS(...NOVE.map((id) => makeDef(id, ["Rana", null, null, null], [null, "Viera", null, null], { tags: ["Lokalita"] })));

let uidSeq = 98000;
const inst = (defId: string): CardInstance => ({ uid: ++uidSeq, defId, leftLayout: 0, rightLayout: 0 });

function sHracom(s: GameState, p: PlayerId, h: Partial<GameState["hraci"][0]>): GameState {
  const hraci = [...s.hraci] as [GameState["hraci"][0], GameState["hraci"][1]];
  hraci[p] = { ...hraci[p], ...h };
  return { ...s, hraci };
}

/** Kolo o lokalitu defId, bez kariet v línii. */
function vKole(defId: string, seed = 41): GameState {
  const s0 = setupGame(data, seed);
  return {
    ...s0,
    kolo: 2,
    utocnik: 0,
    strany: [[], []],
    ciel: { typ: "lokalita", lokalita: inst(defId) },
    lokalitaOtocena: false,
    lokalityVHre: s0.lokalityVHre.filter((k) => k.defId !== defId),
  };
}

function vZhromazdeni(defId: string, ruka: readonly CardInstance[], limit = 2, poldeciPlne = 2): GameState {
  const s = vKole(defId);
  return sHracom(
    { ...s, faza: "zhromazdenie", pitkyCelkom: 1, pitkaCislo: 0, zhromazdenieStav: { naTahu: 0, zostavaLimit: [limit, limit], pasoval: [false, false], navyse: [0, 0] } },
    0,
    { ruka, poldeciPlne },
  );
}

const PITKA: PitkaStav = {
  naTahu: 0,
  hotovy: [false, false],
  naexPouzity: [false, false],
  fajcenie: [0, 0],
  reakcia: null,
  postarka: [false, false],
  starosta: [false, false],
};

function vPitke(defId: string, h: Partial<GameState["hraci"][0]>, strany: GameState["strany"] = [[], []]): GameState {
  const s = vKole(defId);
  return sHracom({ ...s, faza: "pitka", strany, pitkyCelkom: 1, pitkaCislo: 1, pitkaStav: PITKA }, 0, h);
}

const na = (card: CardInstance, playedBy: PlayerId): PlacedCard => ({ card, playedBy });

// --- Zhromaždenie -------------------------------------------------------------

describe("Most: karty len na vlastnú stranu", () => {
  it("súperova strana nie je medzi cieľmi a server ju odmietne", () => {
    const pijan = inst("pijan");
    expect(cieleVykladania(data, [[], []], 0, pijan, 2, true, "most")).toEqual(["vlastna"]);
    const s = vZhromazdeni("most", [pijan]);
    const ciele = legalCommands(data, s, 0).flatMap((c) => (c.type === "place" ? [c.target] : []));
    expect(ciele).toContain("vlastna");
    expect(ciele).not.toContain("superova");
    expect(() => apply(data, s, { type: "place", uid: pijan.uid, target: "superova" }, 0)).toThrow(/Most/);
  });
});

describe("Družstvo: Pracujúci nemíňajú limit vykladania", () => {
  it("Pracujúci ide aj pri vyčerpanom limite, iná karta nie", () => {
    const zamocnik = inst("zamocnik");
    const pijan = inst("pijan");
    expect(cieleVykladania(data, [[], []], 0, zamocnik, 0, true, "druzstvo")).toContain("vlastna");
    expect(cieleVykladania(data, [[], []], 0, pijan, 0, true, "druzstvo")).toEqual([]);
    expect(cieleVykladania(data, [[], []], 0, zamocnik, 0, true, "krcma")).toEqual([]);
    const s = vZhromazdeni("druzstvo", [zamocnik, pijan], 0);
    const po = apply(data, s, { type: "place", uid: zamocnik.uid, target: "vlastna" }, 0).state;
    expect(po.strany[0].map((pl) => pl.card.uid)).toEqual([zamocnik.uid]);
  });

  it("návrh ťahu: dvaja Pracujúci pri limite 1 (za Vypiť), bez Družstva nie", () => {
    const polozky = [
      { karta: inst("zamocnik"), ciel: "vlastna" as const },
      { karta: inst("zivnostnik"), ciel: "vlastna" as const },
    ];
    const druzstvo = vZhromazdeni("druzstvo", polozky.map((x) => x.karta), 1);
    expect(planVykladania(data, druzstvo, 0, 1, polozky).chyba).toBeNull();
    const krcma = vZhromazdeni("krcma", polozky.map((x) => x.karta), 1);
    expect(planVykladania(data, krcma, 0, 1, polozky).chyba).toMatch(/Limit/);
  });
});

describe("Kostol: nikto nesmie vypiť ani dať NA EX", () => {
  it("v Zhromaždení niet Vypiť a návrh s dvoma kartami neprejde", () => {
    const a = inst("pijan");
    const b = inst("ministrant");
    const s = vZhromazdeni("kostol", [a, b]);
    expect(legalCommands(data, s, 0).some((c) => c.type === "vypit")).toBe(false);
    expect(() => apply(data, s, { type: "vypit" }, 0)).toThrow(/Kostol/);
    const plan = planVykladania(data, s, 0, 2, [
      { karta: a, ciel: "vlastna" },
      { karta: b, ciel: "vlastna" },
    ]);
    expect(plan.chyba).toMatch(/Kostol/);
    expect(planVykladania(data, s, 0, 2, [{ karta: a, ciel: "vlastna" }]).chyba).toBeNull();
  });

  it("v Pitke niet NA EX", () => {
    const s = vPitke("kostol", { poldeciPlne: 2 }, [[na(inst("pijan"), 0)], []]);
    expect(moznostiNaex(data, s, 0)).toEqual([]);
    expect(moznostiNaex(data, { ...s, ciel: { typ: "lokalita", lokalita: inst("krcma") } }, 0).length).toBeGreaterThan(0);
  });
});

// --- Pitka --------------------------------------------------------------------

describe("Zberný dvor: výkup zo šrotu", () => {
  it("raz za Pitku za cigaretu karta z vlastného odhadzovacieho balíčka do ruky", () => {
    const srot = inst("pijan");
    const druha = inst("ministrant");
    const s = vPitke("zberny_dvor", { odhadzovaci: [srot, druha], cigarety: 2, ruka: [] });
    expect(legalCommands(data, s, 0)).toContainEqual({ type: "vykup", uid: srot.uid });
    const po = apply(data, s, { type: "vykup", uid: srot.uid }, 0).state;
    expect(po.hraci[0].ruka.map((k) => k.uid)).toEqual([srot.uid]);
    expect(po.hraci[0].odhadzovaci.map((k) => k.uid)).toEqual([druha.uid]);
    expect(po.hraci[0].cigarety).toBe(2 - KONSTANTY.EFEKT.ZBERNY_DVOR_CENA);
    expect(legalCommands(data, po, 0).some((c) => c.type === "vykup")).toBe(false);
    expect(() => apply(data, po, { type: "vykup", uid: druha.uid }, 0)).toThrow(/už/);
  });

  it("inde výkup nie je", () => {
    const s = vPitke("krcma", { odhadzovaci: [inst("pijan")], cigarety: 2 });
    expect(legalCommands(data, s, 0).some((c) => c.type === "vykup")).toBe(false);
  });
});

describe("Vínna pivnica, Jednota, Obecný úrad, Kultúrny dom", () => {
  it("Vínna pivnica: dve NA EX za Pitku", () => {
    expect(naexZaPitku(vKole("vinna_pivnica"))).toBe(2);
    expect(naexZaPitku(vKole("krcma"))).toBe(1);
  });

  it("Jednota: stokársky barter o 1 cigaretu lacnejší", () => {
    expect(barterCena(data, vKole("jednota"), 0)).toBe(barterCena(data, vKole("krcma"), 0) - 1);
  });

  it("Obecný úrad: prah Exekútora −4 a Robota odhodí 2 Dlhy", () => {
    expect(exekutorLokality(vKole("obecny_urad"))).toEqual({ zlava: KONSTANTY.EFEKT.URAD_PRAH_EXEKUTORA, robota: KONSTANTY.EFEKT.URAD_ROBOTA });
    expect(exekutorLokality(vKole("krcma"))).toEqual({ zlava: 0, robota: 1 });
    expect(prahyHraca(data, vKole("obecny_urad"), 0).exekutor).toBe(prahyHraca(data, vKole("krcma"), 0).exekutor - KONSTANTY.EFEKT.URAD_PRAH_EXEKUTORA);
  });

  it("Kultúrny dom: Pohoršenie bez limitu hraníc zón (Michal 2026-10-20)", () => {
    expect(pohorsenieBezLimitu(vKole("kulturny_dom"))).toBe(true);
    expect(pohorsenieBezLimitu(vKole("krcma"))).toBe(false);
  });
});

// --- Bitka --------------------------------------------------------------------

describe("Lesná cesta a Ihrisko: tuhé za karty na stranách", () => {
  it("Lesná cesta: +1 za každú svoju kartu na súperovej strane, najviac 2; Nástroj sa neráta", () => {
    const s = vKole("lesna_cesta");
    const jedna: GameState = { ...s, strany: [[], [na(inst("pijan"), 0), na(inst("puska"), 0)]] };
    expect(bitkaMody(data, jedna, 0).tuheBonus).toBe(1);
    const tri: GameState = { ...s, strany: [[], [na(inst("pijan"), 0), na(inst("ministrant"), 0), na(inst("pijan"), 0)]] };
    expect(bitkaMody(data, tri, 0).tuheBonus).toBe(KONSTANTY.EFEKT.LESNA_CESTA_MAX);
    expect(bitkaMody(data, tri, 1).tuheBonus).toBe(0);
    // Rozpis pre panel bitky menuje zdroj bonusu a zrážku za Absťáky v ruke.
    const [r0] = rozpisPoskodenia(data, tri, [{}, {}], [1, 0]);
    expect(r0.bonusy).toContainEqual({ zdroj: "lesna_cesta", hodnota: KONSTANTY.EFEKT.LESNA_CESTA_MAX });
    expect(r0.zrazky).toContainEqual({ zdroj: "abstak", hodnota: 1 });
  });

  it("Ihrisko: +2 za každú stranu, kde má hráč viac svojich kariet — teda až 4", () => {
    const s = vKole("ihrisko");
    const obe: GameState = {
      ...s,
      strany: [
        [na(inst("pijan"), 0), na(inst("pijan"), 0), na(inst("ministrant"), 1)],
        [na(inst("pijan"), 0), na(inst("ministrant"), 0)],
      ],
    };
    expect(bitkaMody(data, obe, 0).tuheBonus).toBe(2 * KONSTANTY.EFEKT.IHRISKO_TUHE);
    expect(bitkaMody(data, obe, 1).tuheBonus).toBe(0);
    const rovnost: GameState = { ...s, strany: [[na(inst("pijan"), 0), na(inst("pijan"), 1)], []] };
    expect(bitkaMody(data, rovnost, 0).tuheBonus).toBe(0);
    expect(bitkaMody(data, rovnost, 1).tuheBonus).toBe(0);
  });
});

describe("Cintorín: porazený dá Nástroj z ruky do Dedičstva zadarmo", () => {
  function poLiecbe(defId: string, ruka: readonly CardInstance[]): GameState {
    const s = vKole(defId);
    const bitka: BitkaStav = {
      krok: "liecba",
      caka: 0,
      sums: [{}, {}],
      exekutorHotovy: [true, true],
      pohorsenieZostava: [0, 0],
      pohorsenieHranice: {},
      damage: null,
      vitaz: 1,
      prebytokDrzi: null,
      prebytokZostava: 0,
      prebytokPosunute: [],
      liecbaHotova: [false, true],
      benzinkaZostava: [0, 0],
      lokalitaPrepadne: false,
      spalit: [],
      vesticaHotova: true,
    };
    return sHracom({ ...s, faza: "bitka", bitkaStav: bitka }, 0, { ruka, cigarety: 0 });
  }

  it("po Liečbe čaká Cintorín na porazeného; Nástroj ide do Dedičstva bez cigariet a cena Dedičstva rastie", () => {
    const puska = inst("puska");
    const s = apply(data, poLiecbe("cintorin", [puska, inst("pijan")]), { type: "skipLiecba" }, 0).state;
    expect(s.bitkaStav?.krok).toBe("cintorin");
    expect(s.bitkaStav?.caka).toBe(0);
    expect(legalCommands(data, s, 0)).toEqual(expect.arrayContaining([{ type: "cintorin", uid: puska.uid }, { type: "cintorin", uid: null }]));
    const pred = s.dedicstvaVylozene;
    const po = apply(data, s, { type: "cintorin", uid: puska.uid }, 0).state;
    expect(po.hraci[0].dedicstvo.map((k) => k.uid)).toContain(puska.uid);
    expect(po.hraci[0].cigarety).toBe(0);
    expect(po.dedicstvaVylozene).toBe(pred + 1);
  });

  it("bez Nástroja v ruke alebo inde sa Cintorín preskočí", () => {
    const bez = apply(data, poLiecbe("cintorin", [inst("pijan")]), { type: "skipLiecba" }, 0).state;
    expect(bez.bitkaStav?.krok).not.toBe("cintorin");
    const inde = apply(data, poLiecbe("krcma", [inst("puska")]), { type: "skipLiecba" }, 0).state;
    expect(inde.bitkaStav?.krok).not.toBe("cintorin");
  });
});

describe("Pasca (Michal 2026-10-20): každé súperovo Zviera v línii mu uberie 1 tuhé", () => {
  it("bez Pascy nič, s Pascou súpera −1 za každé moje Zviera; v rozpise ako zrážka", () => {
    const s = vKole("krcma");
    const strany: GameState["strany"] = [[na(inst("pes"), 0), na(inst("cierna_macka"), 0), na(inst("pijan"), 0)], []];
    const bez: GameState = { ...s, strany };
    expect(bitkaMody(data, bez, 0).tuheZlava).toBe(0);
    const sPascou = sHracom({ ...s, strany }, 1, { dedicstvo: [inst("pasca")] });
    expect(bitkaMody(data, sPascou, 0).tuheZlava).toBe(2);
    expect(bitkaMody(data, sPascou, 1).tuheZlava).toBe(0);
    const [r0] = rozpisPoskodenia(data, sPascou, [{ Pecka: 2 }, {}], [0, 0]);
    expect(r0.zrazky).toContainEqual({ zdroj: "pasca", hodnota: 2 });
  });
});

describe("Prevaha (Michal 2026-10-20): hranu lokality dostane, kto má na strane viac svojich kariet", () => {
  const R = ["Rana", null, null, null] as const;
  const E = [null, null, null, null] as const;
  const sd = syntheticData([
    makeDef("lok", R, R, { tags: ["Lokalita"] }),
    makeDef("obcan", R, R, { tags: ["Občan"] }),
    makeDef("prazdny", E, E, { tags: ["Občan"] }),
    makeDef("nastroj", E, E, { tags: ["Nástroj"] }),
  ]);
  const k = (id: string, l: readonly (string | null)[], r: readonly (string | null)[]) => instanceFor(sd, id, l as never, r as never);
  const lok = () => k("lok", R, R);

  it("podstrčená karta pri lokalite hranu nevezme, keď má domáci na strane viac kariet", () => {
    // Strana hráča 1: pri lokalite Občan podstrčený hráčom 0, za ním dve karty hráča 1.
    const strany: GameState["strany"] = [
      [],
      [
        { card: k("obcan", R, R), playedBy: 0 },
        { card: k("prazdny", E, E), playedBy: 1 },
        { card: k("prazdny", E, E), playedBy: 1 },
      ],
    ];
    const ev = evaluateLine(sd, { lokalita: lok(), lokalitaOtocena: false, strany });
    // Rana lokality ide hráčovi 1 (prevaha 2 : 1), Rana podstrčenej karty jej majiteľovi.
    expect(ev.sums[0].Rana).toBe(1);
    expect(ev.sums[1].Rana).toBe(1);
    expect(prevahaStran(sd, strany)).toEqual([null, 1]);
  });

  it("pri rovnosti rozhodne karta pri lokalite; Nástroje sa nerátajú", () => {
    const strany: GameState["strany"] = [
      [],
      [
        { card: k("obcan", R, R), playedBy: 0 },
        { card: k("prazdny", E, E), playedBy: 1 },
        { card: k("nastroj", E, E), playedBy: 1 },
      ],
    ];
    const ev = evaluateLine(sd, { lokalita: lok(), lokalitaOtocena: false, strany });
    expect(ev.sums[0].Rana).toBe(2);
    expect(prevahaStran(sd, strany)).toEqual([null, 0]);
  });
});

describe("Prevaha rátajú len Občania, Zvieratá a Starešinovia (Michal 2026-10-20)", () => {
  it("Cirhóza ani Nástroj do prevahy nerátajú", () => {
    const strany: GameState["strany"] = [
      [na(inst("pijan"), 1), na(inst("cirhoza"), 0), na(inst("puska"), 0)],
      [na(inst("pes"), 0), na(inst("ministrant"), 1)],
    ];
    // Kraj 0: hráč 0 má len Cirhózu a Nástroj → 0 : 1, prevahu má hráč 1.
    // Kraj 1: Pes (Zviera) a Ministrant (Občan) → 1 : 1, rozhodne karta pri lokalite (Pes, hráč 0).
    expect(prevahaStran(data, strany)).toEqual([1, 0]);
  });
});

describe("Presbiter a Dvojčatá (Michal 2026-10-20)", () => {
  const R = ["Rana", null, null, null] as const;
  const V = ["Viera", null, null, null] as const;
  const E = [null, null, null, null] as const;
  const sd = syntheticData([
    // Pravá hrana lokality (kraj hráča 1) dáva Vieru tomu, kto tam má prevahu.
    makeDef("lokV", R, V, { tags: ["Lokalita"] }),
    makeDef("presbiter", R, R, { tags: ["Občan", "Autorita", "Chlap"] }),
    makeDef("obcan", R, R, { tags: ["Občan"] }),
    makeDef("prazdny", E, E, { tags: ["Občan"] }),
    makeDef("dvojcata", E, E, { tags: ["Občan", "Chlap"] }),
    makeDef("praudovravec", E, E, { tags: ["Občan"] }),
  ]);
  const k = (id: string, l: readonly (string | null)[], r: readonly (string | null)[]) => instanceFor(sd, id, l as never, r as never);
  const lok = () => k("lokV", R, V);
  const pl = (id: string, l: readonly (string | null)[], r: readonly (string | null)[], playedBy: PlayerId): PlacedCard => ({ card: k(id, l, r), playedBy });
  const linia = (strany: GameState["strany"]) => evaluateLine(sd, { lokalita: lok(), lokalitaOtocena: false, strany });

  it("Presbiter sám proti prevahe zoberie súperovi toľko Viery, koľko má aktívnych akcií", () => {
    // Kraj hráča 1: Presbiter hráča 0 pri lokalite, za ním dve karty hráča 1 → prevaha hráča 1 (Viera lokality jemu).
    const s = (prvy: string): GameState["strany"] => [[], [pl(prvy, R, R, 0), pl("prazdny", E, E, 1), pl("prazdny", E, E, 1)]];
    expect(linia(s("obcan")).sums[1].Viera).toBe(1);
    const ev = linia(s("presbiter"));
    expect(ev.sums[1].Viera ?? 0).toBe(0);
    expect(ev.zdroje[1].Viera).toContainEqual(expect.objectContaining({ defId: "presbiter", hodnota: -1 }));
  });

  it("nie je sám, alebo súper nemá prevahu, alebo ho umlčí súperov Praudovravec → nič", () => {
    const nieSam: GameState["strany"] = [
      [],
      [pl("presbiter", R, R, 0), pl("prazdny", E, E, 0), pl("prazdny", E, E, 1), pl("prazdny", E, E, 1), pl("prazdny", E, E, 1)],
    ];
    expect(linia(nieSam).sums[1].Viera).toBe(1);
    const umlcany: GameState["strany"] = [[pl("praudovravec", E, E, 1)], [pl("presbiter", R, R, 0), pl("prazdny", E, E, 1), pl("prazdny", E, E, 1)]];
    expect(linia(umlcany).sums[1].Viera).toBe(1);
  });

  it("Dvojčatá sa do prevahy rátajú za dvoch", () => {
    const s = (id: string): GameState["strany"] => [[], [pl("obcan", R, R, 0), pl(id, E, E, 1)]];
    // 1 : 1 → rozhodne karta pri lokalite (hráč 0); s Dvojčatami 1 : 2 → hráč 1.
    expect(prevahaStran(sd, s("prazdny"))).toEqual([null, 0]);
    expect(prevahaStran(sd, s("dvojcata"))).toEqual([null, 1]);
    expect(linia(s("dvojcata")).sums[1].Viera).toBe(1);
  });
});

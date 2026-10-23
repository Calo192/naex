// Rozhodca pravidiel (prvý prechod 2026-10-22): bitka a koniec hry podľa
// PRAVIDLA.md §1, §3, §8, §10, §12 a §14 — Exekútor a Robota, poradie kroku
// Poldeci, Pohreb, návrat kariet, Absťák a neresti, body za kusy,
// efekty kariet. Očakávané hodnoty sú z textu pravidiel, nie z kódu.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { BattleSide, BitkaStav, CardDef, CardInstance, Event, GameData, GameState, PitkaStav, PlacedCard, PlayerId, PlayerState, StavBodovania } from "../src/index.ts";
import {
  apply,
  buildGameData,
  computeDamage,
  elderScore,
  freshElder,
  legalCommands,
  loadGameData,
  naTahu,
  parseScorecards,
  setupGame,
} from "../src/index.ts";
import type { Layout4 } from "./helpers.ts";
import { EMPTY, instanceFor, makeDef } from "./helpers.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

let uidSeq = 890000;
const inst = (defId: string): CardInstance => ({ uid: ++uidSeq, defId, leftLayout: 0, rightLayout: 0 });
const lezi = (card: CardInstance, playedBy: PlayerId, naexBy?: PlayerId): PlacedCard =>
  naexBy === undefined ? { card, playedBy } : { card, playedBy, naexBy };
const kusy = (n: number, defId: string): CardInstance[] => Array.from({ length: n }, () => inst(defId));

function sadaS(...defs: CardDef[]): GameData {
  const cards = new Map(data.cards);
  for (const d of defs) cards.set(d.id, d);
  return buildGameData(cards, data.elders, parseScorecards(scorecardsJson));
}

function sHracom(s: GameState, p: PlayerId, h: Partial<PlayerState>): GameState {
  const hraci = [...s.hraci] as [PlayerState, PlayerState];
  hraci[p] = { ...hraci[p], ...h };
  return { ...s, hraci };
}

function pitkaStav(naTahuHrac: PlayerId): PitkaStav {
  return {
    naTahu: naTahuHrac,
    hotovy: [false, false],
    naexPouzity: [false, false],
    fajcenie: [0, 0],
    reakcia: null,
    postarka: [false, false],
    starosta: [false, false],
    naexPocet: [0, 0],
    vykup: [false, false],
  };
}

/** Pitka (útočník 0, na ťahu obranca 1) — po jej konci začne bitka. */
function vPitke(sada: GameData, seed: number, strany: GameState["strany"]): GameState {
  const s0 = setupGame(sada, seed);
  return { ...s0, faza: "pitka", utocnik: 0, strany, pitkyCelkom: 1, pitkaCislo: 1, pitkaStav: pitkaStav(1) };
}

/** Obaja skončia Pitku bez NA EX; bitka sa rozbehne, kým nečaká na hráča. */
function doBitky(sada: GameData, s: GameState): { state: GameState; events: Event[] } {
  const events: Event[] = [];
  let st = s;
  for (let i = 0; i < 2 && st.faza === "pitka" && st.vizia === null; i++) {
    const r = apply(sada, st, { type: "skipNaex" }, naTahu(st)!);
    st = r.state;
    events.push(...r.events);
  }
  return { state: st, events };
}

function bitka(b: Partial<BitkaStav>): BitkaStav {
  return {
    krok: null,
    caka: null,
    sums: [{}, {}],
    exekutorHotovy: [true, true],
    pohorsenieZostava: [0, 0],
    pohorsenieHranice: {},
    damage: null,
    vitaz: 0,
    prebytokDrzi: null,
    prebytokZostava: 0,
    prebytokPosunute: [],
    pohrebHotovy: [true, true],
    benzinkaZostava: [0, 0],

    karHotovy: [true, true],
    spalit: [],
    vesticaHotova: true,
    ...b,
  };
}

/** Bitka v kroku Pohrebu, čaká sa na hráča 0 — skipPohreb ju dokončí a začne ďalšie kolo. */
function predKoncomBitky(seed: number, uprav: (s: GameState) => GameState = (s) => s): GameState {
  const s0 = setupGame(data, seed);
  return uprav({
    ...s0,
    faza: "bitka",
    kolo: 2,
    strany: [[], []],
    ciel: { typ: "lokalita", lokalita: s0.lokalityVHre[0]! },
    lokalityVHre: s0.lokalityVHre.slice(1),
    bitkaStav: bitka({ krok: "pohreb", caka: 0, pohrebHotovy: [false, true] }),
  });
}

/** Všetky uid v balíčkoch a ruke hráča. */
const zony = (h: PlayerState): number[] => [...h.ruka, ...h.doberaci, ...h.odhadzovaci, ...h.priznane, ...h.dedicstvo].map((k) => k.uid);

// --- §1 Podmienky konca -----------------------------------------------------------

describe("§1 Podmienky konca", () => {
  it("§1/§8.1: kto má priznané Dlhy na prahu Exekútora (10) a nemá Nástroj, okamžite prehráva; pod prahom (9) nie", () => {
    const na = doBitky(data, sHracom(vPitke(data, 41, [[], []]), 0, { priznane: kusy(10, "dlh") })).state;
    expect(na.koniec?.vitaz).toBe(1);
    expect(na.koniec?.dovod).toMatch(/exekúcii/);
    const pod = doBitky(data, sHracom(vPitke(data, 41, [[], []]), 0, { priznane: kusy(9, "dlh") })).state;
    expect(pod.koniec).toBeNull();
    // Kto exekúcii nečelí, Dlh nepáli (Michal 2026-10-22).
    expect(pod.hraci[0].priznane.filter((k) => k.defId === "dlh")).toHaveLength(9);
  });

  it("§8.1: s Nástrojom hráč exekúcii čelí — odovzdá ho a polovica priznaných Dlhov (nadol) zhorí: 11 → 6", () => {
    const noviny = inst("noviny");
    const p0 = vPitke(data, 42, [[], []]);
    // Ruka ostáva (balíček nesmie po odovzdaní Nástroja klesnúť pod 5).
    const s = sHracom(p0, 0, { priznane: kusy(11, "dlh"), ruka: [...p0.hraci[0].ruka, noviny] });
    const st = doBitky(data, s).state;
    expect(st.bitkaStav?.krok).toBe("exekutor");
    expect(st.bitkaStav?.caka).toBe(0);
    const po = apply(data, st, { type: "exekutorTool", defId: "noviny", kde: "ruka" }, 0).state;
    expect(po.koniec).toBeNull();
    expect(po.hraci[0].priznane.filter((k) => k.defId === "dlh")).toHaveLength(6);
    expect(zony(po.hraci[0])).not.toContain(noviny.uid);
  });

  it("§8.1: Robota spáli priznaný Dlh ešte pred kontrolou prahu — 10 Dlhov a 1 Robota exekúciu nespustí", () => {
    const vonk: Layout4 = ["Robota", null, null, null];
    const vnut: Layout4 = ["Rana", null, null, null];
    const sada = sadaS(makeDef("r_rob_o", EMPTY, vonk), makeDef("r_rob_i", vnut, EMPTY));
    const strany: GameState["strany"] = [[lezi(instanceFor(sada, "r_rob_i", vnut, EMPTY), 0), lezi(instanceFor(sada, "r_rob_o", EMPTY, vonk), 0)], []];
    const st = doBitky(sada, sHracom(vPitke(sada, 43, strany), 0, { priznane: kusy(10, "dlh") })).state;
    expect(st.koniec).toBeNull();
    expect(st.hraci[0].priznane.filter((k) => k.defId === "dlh")).toHaveLength(9);
  });

  it("§1: balíček (doberací + odhadzovací + ruka) pod 5 kariet na konci kola znamená prehru; presne 5 nie", () => {
    const styri = predKoncomBitky(44, (s) => sHracom(s, 1, { ruka: kusy(4, "pijan"), doberaci: [], odhadzovaci: [] }));
    const po4 = apply(data, styri, { type: "skipPohreb" }, 0).state;
    expect(po4.koniec?.vitaz).toBe(0);
    const pat = predKoncomBitky(44, (s) => sHracom(s, 1, { ruka: kusy(3, "pijan"), doberaci: kusy(1, "pijan"), odhadzovaci: kusy(1, "pijan"), priznane: kusy(3, "dlh") }));
    const po5 = apply(data, pat, { type: "skipPohreb" }, 0).state;
    expect(po5.koniec).toBeNull();
  });

  it("§1: ohlásené vydesenie — kto do konca nasledujúceho kola udrží polovicu (4 z 8) vydesených, vyhrá; kto ich stratí, nevyhrá", () => {
    const vydes = (n: number) => (s: GameState): GameState => ({
      ...s,
      ohlaseneVydesenie: [1, null],
      starsi: s.starsi.map((e, i) => (i < n ? { ...e, marker: 8 as const, markerZaciatokKola: 8 as const } : e)),
    });
    const udrzal = apply(data, predKoncomBitky(45, vydes(4)), { type: "skipPohreb" }, 0).state;
    expect(udrzal.koniec?.vitaz).toBe(0);
    const stratil = apply(data, predKoncomBitky(45, vydes(3)), { type: "skipPohreb" }, 0).state;
    expect(stratil.koniec).toBeNull();
    expect(stratil.ohlaseneVydesenie[0]).toBeNull();
  });
});

// --- §3 Akcie a §8.3 Poškodenie -------------------------------------------------------

describe("§3 Akcie — tuhé poškodenie", () => {
  it("§3: Rana 1, Pecka 2, Petelica 3 tuhé", () => {
    const strana = (sums: BattleSide["sums"]): BattleSide => ({ sums, cirhozaBonus: 0, tuheBonus: 0, abstaky: 0, priznaneDlhy: 0, priazenBitkara: 0, hodnotaViery: 1 });
    expect(computeDamage([strana({ Rana: 1, Pecka: 1, Petelica: 1 }), strana({})]).tuhe).toEqual([6, 0]);
    expect(computeDamage([strana({ Petelica: 2 }), strana({ Pecka: 3 })]).tuhe).toEqual([6, 6]);
  });
});

// --- §8.5 Poldeci -------------------------------------------------------------------------

describe("§8.5 Poldeci v bitke", () => {
  it("§8.5: NA EX poldeci sa najprv vypijú, potom akcia Poldeci otočí vypitý na plný; bez vypitého vyjde naprázdno; platí pre majiteľa karty aj na súperovej strane", () => {
    const P: Layout4 = ["Poldeci", null, null, null];
    const C: Layout4 = ["Cigareta", null, null, null];
    const sada = sadaS(makeDef("r_pold", P, P), makeDef("r_cig", C, C));
    const k = (defId: string, l: Layout4, p: PlayerId, naexBy?: PlayerId): PlacedCard => lezi(instanceFor(sada, defId, l, l), p, naexBy);
    // Hráč 0 má pár Poldeci–Cigareta na súperovej strane a NA EX na jeho karte; hráč 1 na strane hráča 0.
    const strany: GameState["strany"] = [
      [k("r_pold", P, 1), k("r_cig", C, 1)],
      [k("r_pold", P, 0), k("r_cig", C, 0, 0)],
    ];
    let s = vPitke(sada, 46, strany);
    // Obom priznaná Cirhóza: bitka je remíza v tuhom (1 : 1) a zastaví sa na Pohrebe.
    s = sHracom(s, 0, { poldeciPlne: 0, poldeciVypite: 0, priznane: [inst("cirhoza")], nerestiTotoKolo: 0 });
    s = sHracom(s, 1, { poldeciPlne: 1, poldeciVypite: 0, priznane: [inst("cirhoza")] });
    const st = doBitky(sada, s).state;
    expect(st.bitkaStav?.krok).toBe("pohreb");
    expect([st.hraci[0].poldeciPlne, st.hraci[0].poldeciVypite]).toEqual([1, 0]);
    expect([st.hraci[1].poldeciPlne, st.hraci[1].poldeciVypite]).toEqual([1, 0]);
    // §12: NA EX je nerest (poldeci sa vypije v bitke).
    expect(st.hraci[0].nerestiTotoKolo).toBe(1);
  });
});

// --- §8.6 Pohreb, §8.7 Návrat kariet ------------------------------------------------------------

describe("§8.6 Pohreb a §8.7 Návrat kariet", () => {
  it("§8.6 Pohreb Závislého: spáli priznanú Cirhózu a Závislého z línie, hráč si smie vziať kartu zo šenku — bez Dlhu (v4)", () => {
    const zavisly = inst("pijan");
    const zoSenku = inst("noviny");
    const cirhoza = inst("cirhoza");
    const s = predKoncomBitky(47, (x) => sHracom({ ...x, strany: [[lezi(zavisly, 0)], []], senok: [zoSenku] }, 0, { priznane: [cirhoza] }));
    const po = apply(data, s, { type: "pohreb", cirhozaUid: cirhoza.uid, kartaUid: zavisly.uid, senokUid: zoSenku.uid }, 0).state;
    const h = po.hraci[0];
    expect(h.priznane.some((k) => k.defId === "cirhoza")).toBe(false);
    expect(h.priznane.filter((k) => k.defId === "dlh")).toHaveLength(0);
    expect(po.senok.map((k) => k.uid)).not.toContain(zoSenku.uid);
    expect(h.ruka.map((k) => k.uid)).toContain(zoSenku.uid);
    expect(zony(h)).not.toContain(zavisly.uid);
    expect(zony(po.hraci[1])).not.toContain(zavisly.uid);
  });

  it("§8.6 Pohreb: kartu zo šenku dá len Závislý; Závislého smie pochovať aj bez nej", () => {
    const nezavisly = inst("noviny");
    const zavisly = inst("pijan");
    const zoSenku = inst("hasic");
    const cirhoza = inst("cirhoza");
    const s = predKoncomBitky(47, (x) => sHracom({ ...x, strany: [[lezi(zavisly, 0), lezi(nezavisly, 0)], []], senok: [zoSenku] }, 0, { priznane: [cirhoza] }));
    expect(() => apply(data, s, { type: "pohreb", cirhozaUid: cirhoza.uid, kartaUid: nezavisly.uid, senokUid: zoSenku.uid }, 0)).toThrow(/Závislého/);
    const bez = apply(data, s, { type: "pohreb", cirhozaUid: cirhoza.uid, kartaUid: zavisly.uid }, 0).state;
    expect(bez.hraci[0].ruka.map((k) => k.uid)).not.toContain(zoSenku.uid);
    expect(bez.senok.map((k) => k.uid)).toContain(zoSenku.uid);
    // Liečba ako samostatný úkon už nie je (pravidlá v4).
    expect(legalCommands(data, s, 0).some((c) => (c.type as string) === "liecba")).toBe(false);
    expect(legalCommands(data, s, 0)).toContainEqual({ type: "pohreb", cirhozaUid: cirhoza.uid, kartaUid: zavisly.uid, senokUid: zoSenku.uid });
    expect(legalCommands(data, s, 0)).not.toContainEqual({ type: "pohreb", cirhozaUid: cirhoza.uid, kartaUid: nezavisly.uid, senokUid: zoSenku.uid });
  });

  it("§8.6 Pohreb: spáli priznanú Cirhózu a ľubovoľnú svoju kartu z línie — karta sa nevráti", () => {
    const karta = inst("noviny");
    const cirhoza = inst("cirhoza");
    const s = predKoncomBitky(48, (x) => sHracom({ ...x, strany: [[], [lezi(karta, 0)]] }, 0, { priznane: [cirhoza] }));
    const po = apply(data, s, { type: "pohreb", cirhozaUid: cirhoza.uid, kartaUid: karta.uid }, 0).state;
    expect(po.hraci[0].priznane.some((k) => k.uid === cirhoza.uid)).toBe(false);
    expect(zony(po.hraci[0])).not.toContain(karta.uid);
  });

  it("§8.7: karty z línie sa vrátia do odhadzovacieho balíčka hráča, ktorý ich zahral — aj zo súperovej strany", () => {
    const moja = inst("pijan");
    const jeho = inst("pijan");
    const s = predKoncomBitky(49, (x) => ({ ...x, strany: [[lezi(jeho, 1)], [lezi(moja, 0)]] }));
    const po = apply(data, s, { type: "skipPohreb" }, 0).state;
    expect(zony(po.hraci[0])).toContain(moja.uid);
    expect(zony(po.hraci[1])).not.toContain(moja.uid);
    expect(zony(po.hraci[1])).toContain(jeho.uid);
    expect(zony(po.hraci[0])).not.toContain(jeho.uid);
  });
});

// --- §10 Bodovanie ------------------------------------------------------------------------------

describe("§10 Bodovanie na konci hry", () => {
  it("§10: body za podmienky — znepokojenie 1, strach 2, vydesenie 3, lokalita 2, starší 2, cigarety 1, Cirhóza −2, Dlh −1", () => {
    expect(data.bodyPodmienok).toEqual({ znepokojenie: 1, strach: 2, vydesenie: 3, lokality: 2, starsi: 2, cigarety: 1, cirhoza: -2, dlh: -1 });
  });

  it("§10/§12: Dlh uberá aj priznaný, Cirhóza len nepriznaná (ruka aj oba balíčky), cigarety po trojiciach", () => {
    const R3: Layout4 = ["Rana", "Rana", "Rana", null];
    const def = makeDef("r_starsi", R3, EMPTY, { tags: ["Starešina"] });
    const sada = buildGameData(new Map([[def.id, def]]), new Map(), {
      scorecards: [{ id: "r_sc", nazov: "r_sc", favour: "BITKAR", lava: ["dlh", "cirhoza", "cigarety", null], prava: [null, null, null, null] }],
      body: data.bodyPodmienok,
    });
    const elder = freshElder("r_starsi", instanceFor(sada, "r_starsi", R3, EMPTY), "r_sc");
    const nic = { cigarety: 2, ruka: [], doberaci: [], odhadzovaci: [], priznane: [] };
    const stav: StavBodovania = {
      ovladnute: [],
      starsi: [elder],
      hraci: [
        {
          cigarety: 8,
          ruka: [inst("cirhoza")],
          doberaci: [inst("cirhoza")],
          odhadzovaci: [inst("dlh")],
          priznane: [inst("dlh"), inst("cirhoza")],
        },
        nic,
      ],
    };
    // Hráč 0: Dlh 2 × −1, Cirhóza 2 × −2 (priznaná sa neráta), cigarety ⌊8/3⌋ = 2 × 1 → −4. Hráč 1: 2 cigarety = 0 kusov.
    expect(elderScore(sada, stav, elder).body).toEqual([-4, 0]);
  });
});

// --- §12 Absťák a neresti ---------------------------------------------------------------------

describe("§12 Kliatby — Absťák a neresti", () => {
  const sNerestami = (minule: number, teraz: number, priznane: CardInstance[] = []) =>
    predKoncomBitky(50, (s) => sHracom(s, 0, { nerestiMinuleKolo: minule, nerestiTotoKolo: teraz, priznane, doberaci: [...s.hraci[0].doberaci, ...kusy(5, "pijan")] }));

  it("§12: menej nerestí než v predošlom kole → Absťák rovno priznaný a hráč si zaň dobere kartu", () => {
    const s = sNerestami(2, 1);
    const po = apply(data, s, { type: "skipPohreb" }, 0).state;
    expect(po.hraci[0].priznane.filter((k) => k.defId === "abstak")).toHaveLength(1);
    // 1 karta za priznaný Absťák + 2 karty po bitke.
    expect(po.hraci[0].ruka).toHaveLength(s.hraci[0].ruka.length + 3);
    expect(po.hraci[0].nerestiMinuleKolo).toBe(1);
  });

  it("§12: rovnako nerestí (bez Milujúcej manželky) → nič; viac → jeden Absťák späť do zásoby", () => {
    const rovnako = apply(data, sNerestami(2, 2), { type: "skipPohreb" }, 0).state;
    expect(rovnako.hraci[0].priznane.some((k) => k.defId === "abstak")).toBe(false);
    const viac = apply(data, sNerestami(2, 3, [inst("abstak"), inst("abstak")]), { type: "skipPohreb" }, 0).state;
    expect(viac.hraci[0].priznane.filter((k) => k.defId === "abstak")).toHaveLength(1);
  });

  it("§12 nerest: doliatie poldeci 2, barter za každú cigaretu, fajčenie 1; Dedičstvo ani šenok nie", () => {
    const s0 = setupGame(data, 51);
    let s: GameState = sHracom({ ...s0, faza: "pitka", utocnik: 0, pitkyCelkom: 1, pitkaCislo: 1, pitkaStav: pitkaStav(0) }, 0, { cigarety: 10, poldeciVypite: 1, nerestiTotoKolo: 0 });
    s = apply(data, s, { type: "refillPoldeci" }, 0).state;
    expect(s.hraci[0].nerestiTotoKolo).toBe(2);
    s = apply(data, s, { type: "barter" }, 0).state;
    expect(s.hraci[0].cigarety).toBe(10 - 2 - 5);
    expect(s.hraci[0].nerestiTotoKolo).toBe(2 + 5);
    s = apply(data, s, { type: "smoke", pocet: 1 }, 0).state;
    expect(s.hraci[0].nerestiTotoKolo).toBe(2 + 5 + 1);

    const noviny = inst("noviny");
    const z = sHracom(
      { ...s0, faza: "zhromazdenie", utocnik: 0, pitkyCelkom: 1, pitkaCislo: 0, zhromazdenieStav: { naTahu: 0, zostavaLimit: [3, 3], pasoval: [false, false], navyse: [0, 0] } },
      0,
      { ruka: [noviny], cigarety: 3, nerestiTotoKolo: 0 },
    );
    expect(apply(data, z, { type: "place", uid: noviny.uid, target: "dedicstvo" }, 0).state.hraci[0].nerestiTotoKolo).toBe(0);

    const a = inst("pijan");
    const d = sHracom(
      { ...s0, faza: "draft", senok: [a, inst("pijan")], draftStav: { krok: "beranie", balicky: [[], []], vyber: [null, null], naTahu: 0, hotovo: [false, false], noveKarty: [0, 0] } },
      0,
      { cigarety: 3, nerestiTotoKolo: 0 },
    );
    const poBrani = apply(data, d, { type: "draftBer", uids: [a.uid] }, 0).state;
    expect(poBrani.hraci[0].cigarety).toBe(2);
    expect(poBrani.hraci[0].nerestiTotoKolo).toBe(0);
  });
});

// --- §14 Efekty kariet ------------------------------------------------------------------------

describe("§14 Efekty kariet — výklad", () => {
  function vZhromazdeni(seed: number, ruka: CardInstance[], h: Partial<PlayerState> = {}): GameState {
    const s0 = setupGame(data, seed);
    return sHracom(
      { ...s0, faza: "zhromazdenie", utocnik: 0, pitkyCelkom: 1, pitkaCislo: 0, zhromazdenieStav: { naTahu: 0, zostavaLimit: [3, 3], pasoval: [false, false], navyse: [0, 0] } },
      0,
      { ruka, ...h },
    );
  }

  it("§14 Niekoho stryná: zahodí 1 Dlh aj spomedzi priznaných (verejný dlh 2026-10-21) — len jeden", () => {
    const stryna = inst("niekoho_stryna");
    const s = vZhromazdeni(52, [stryna], { priznane: kusy(2, "dlh") });
    const po = apply(data, s, { type: "place", uid: stryna.uid, target: "vlastna" }, 0).state;
    expect(po.hraci[0].priznane.filter((k) => k.defId === "dlh")).toHaveLength(1);
  });

  it("§14 Veľmi smútiaca vdova: muž navrchu súperovho balíčka ide z hry a majiteľ zahodí 2 Dlhy aj spomedzi priznaných", () => {
    const vdova = inst("velmi_smutiaca_vdova");
    const muz = inst("pijan");
    let s = vZhromazdeni(53, [vdova], { priznane: kusy(3, "dlh") });
    s = sHracom(s, 1, { doberaci: [muz, ...s.hraci[1].doberaci] });
    const po = apply(data, s, { type: "place", uid: vdova.uid, target: "vlastna" }, 0).state;
    expect(po.hraci[0].priznane.filter((k) => k.defId === "dlh")).toHaveLength(1);
    expect(zony(po.hraci[1])).not.toContain(muz.uid);
  });

  it("§14 Hrobár: keď súper Víziou zahodí vrchnú kartu, majiteľ Hrobára dostane cigaretu", () => {
    const V: Layout4 = ["Vízia", null, null, null];
    const sada = sadaS(makeDef("r_vid_h", V, V));
    const vid = (): PlacedCard => lezi(instanceFor(sada, "r_vid_h", V, V), 0);
    let s = vPitke(sada, 54, [[vid(), vid()], [lezi(inst("hrobar"), 1)]]);
    s = doBitky(sada, s).state;
    expect(s.vizia?.zostava[0]).toBeGreaterThan(0);
    expect(naTahu(s)).toBe(0);
    const pred = s.hraci[1].cigarety;
    const zahodil = apply(sada, s, { type: "vizia", vziat: false }, 0).state;
    expect(zahodil.hraci[1].cigarety).toBe(pred + 1);
    const vzal = apply(sada, s, { type: "vizia", vziat: true }, 0).state;
    expect(vzal.hraci[1].cigarety).toBe(pred);
  });

  it("§14 Hrobár: keď súper Pohrebom spáli svoju kartu z línie, majiteľ Hrobára dostane cigaretu (rozhodca #9)", () => {
    const karta = inst("pijan");
    const cirhoza = inst("cirhoza");
    const s = predKoncomBitky(62, (x) => sHracom({ ...x, strany: [[lezi(karta, 0)], [lezi(inst("hrobar"), 1)]] }, 0, { priznane: [cirhoza] }));
    const pred = s.hraci[1].cigarety;
    const po = apply(data, s, { type: "pohreb", cirhozaUid: cirhoza.uid, kartaUid: karta.uid }, 0).state;
    expect(po.hraci[1].cigarety).toBe(pred + 1);
  });

  it("§14 Hrobár: keď súper pochová Závislého a vezme kartu zo šenku, majiteľ Hrobára dostane cigaretu (rozhodca #9)", () => {
    const zavisly = inst("pijan");
    const zoSenku = inst("noviny");
    const cirhoza = inst("cirhoza");
    const s = predKoncomBitky(63, (x) =>
      sHracom({ ...x, strany: [[lezi(zavisly, 0)], [lezi(inst("hrobar"), 1)]], senok: [zoSenku] }, 0, { priznane: [cirhoza] }),
    );
    const pred = s.hraci[1].cigarety;
    const po = apply(data, s, { type: "pohreb", cirhozaUid: cirhoza.uid, kartaUid: zavisly.uid, senokUid: zoSenku.uid }, 0).state;
    expect(po.hraci[1].cigarety).toBe(pred + 1);
  });

  it("§14 Hrobár: vlastný Pohreb majiteľovi Hrobára cigaretu nedá", () => {
    const karta = inst("pijan");
    const cirhoza = inst("cirhoza");
    const s = predKoncomBitky(64, (x) => sHracom({ ...x, strany: [[lezi(karta, 0), lezi(inst("hrobar"), 0)], []] }, 0, { priznane: [cirhoza] }));
    const pred = [s.hraci[0].cigarety, s.hraci[1].cigarety];
    const po = apply(data, s, { type: "pohreb", cirhozaUid: cirhoza.uid, kartaUid: karta.uid }, 0).state;
    expect([po.hraci[0].cigarety, po.hraci[1].cigarety]).toEqual(pred);
  });

  function sPostarkou(seed: number, h: Partial<PlayerState>): GameState {
    const s = vPitke(data, seed, [[lezi(inst("postarka"), 0)], []]);
    return sHracom({ ...s, pitkaStav: pitkaStav(0) }, 0, { priznane: [], ...h });
  }

  it("§14 Poštárka: s prázdnym doberacím aj odhadzovacím balíčkom sa nepoužije a Dlh nedá (rozhodca #8)", () => {
    const s = sPostarkou(61, { doberaci: [], odhadzovaci: [] });
    expect(legalCommands(data, s, 0).some((c) => c.type === "postarka")).toBe(false);
    expect(() => apply(data, s, { type: "postarka", pocet: 2 }, 0)).toThrow();
  });

  it("§14 Poštárka: kto dobral aspoň jednu kartu, získa 1 Dlh — aj keď chcel dve", () => {
    const karta = inst("pijan");
    const s = sPostarkou(61, { doberaci: [karta], odhadzovaci: [] });
    expect(legalCommands(data, s, 0).some((c) => c.type === "postarka")).toBe(true);
    const po = apply(data, s, { type: "postarka", pocet: 2 }, 0).state;
    expect(po.hraci[0].ruka.map((k) => k.uid)).toContain(karta.uid);
    expect(po.hraci[0].priznane.filter((k) => k.defId === "dlh")).toHaveLength(1);
  });

  it("§14 Poštárka: balíček len s Dlhmi — Dlhy sa samy priznajú, do ruky nič, Dlh z Poštárky nepribudne", () => {
    const s = sPostarkou(61, { doberaci: [inst("dlh")], odhadzovaci: [] });
    const ruka = s.hraci[0].ruka.length;
    const po = apply(data, s, { type: "postarka", pocet: 1 }, 0).state;
    expect(po.hraci[0].ruka).toHaveLength(ruka);
    expect(po.hraci[0].priznane.filter((k) => k.defId === "dlh")).toHaveLength(1);
  });

  it("§14 Dievčina na vydaj: pri bitke spáli toľko priznaných Dlhov, koľko má aktívnych akcií, a jej akcie v tej bitke ešte platia", () => {
    const R4: Layout4 = ["Rana", "Rana", "Rana", "Rana"];
    const sada = sadaS(makeDef("r_plna", R4, R4));
    const dievcina = inst("dievcina_na_vydaj");
    // Dievčina vonku, plná karta pri lokalite: Dievčinina pravá strana (Pohoršenie, Povera) je celá spárovaná.
    const strany: GameState["strany"] = [[lezi(instanceFor(sada, "r_plna", R4, R4), 0), lezi(dievcina, 0)], []];
    const s = sHracom(vPitke(sada, 55, strany), 0, { priznane: kusy(3, "dlh") });
    const st = doBitky(sada, s).state;
    const b = st.bitkaStav!;
    expect(b.spalit).toContain(dievcina.uid);
    expect(st.hraci[0].priznane.filter((k) => k.defId === "dlh")).toHaveLength(3 - 2);
    // Jej Pohoršenie a Povera sa v tejto bitke rátajú.
    expect(b.sums[0].Povera).toBe(1);
    expect(b.pohorsenieZostava[0]).toBe(1);
  });
});

// --- §9 Prebudenie a §10 Kategórie ------------------------------------------------------------

describe("§9 Prebudenie a §10 záverečné bodovanie", () => {
  it("§9 Prebudenie: efekt staršieho na krajnej pozícii (Bitka) sa uplatní pre vydesujúceho hráča", () => {
    const zakladne = vPitke(data, 56, [[], []]);
    const idx = zakladne.starsi.findIndex((e) => e.karta.defId === "krcmarka");
    expect(idx).toBeGreaterThanOrEqual(0);
    const sMarkerom = (marker: 7 | 8): GameState =>
      sHracom({ ...zakladne, starsi: zakladne.starsi.map((e, i) => (i === idx ? { ...e, marker, markerZaciatokKola: marker } : e)) }, 0, { poldeciPlne: 0, poldeciVypite: 1 });
    const krcmarka = (events: readonly Event[]): boolean => events.some((e) => e.type === "log" && e.text.startsWith("Krčmárka: hráč 1 otáča"));
    // Marker na 8 = hráč 0 staršieho vydesil → efekt Krčmárky (Bitka) platí jemu.
    expect(krcmarka(doBitky(data, sMarkerom(8)).events)).toBe(true);
    expect(krcmarka(doBitky(data, sMarkerom(7)).events)).toBe(false);
  });

  it("§10 Kategórie: na konci hry sú body len súčtom aktívnych podmienok scorecardov — plošné body nie sú", () => {
    const s = predKoncomBitky(57, (x) => ({ ...x, lokalityVHre: [] }));
    const po = apply(data, s, { type: "skipPohreb" }, 0).state;
    expect(po.koniec?.body).not.toBeNull();
    const ocakavane = [0, 1].map((p) => po.starsi.reduce((a, e) => a + elderScore(data, po, e).body[p]!, 0));
    expect(po.koniec?.body).toEqual(ocakavane);
    const [a, b] = ocakavane as [number, number];
    expect(po.koniec?.vitaz).toBe(a === b ? null : a > b ? 0 : 1);
  });
});

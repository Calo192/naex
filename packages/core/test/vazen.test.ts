// Krok 2 revízie starších (pravidlá v9, Michal 2026-10-30): pokus o zajatie, väzeň,
// tretí väzeň = výhra, špaky 8 / 6 / 4 / 2, Kšeft väzňa, priazne, viewFor.
// Zadanie: docs/napady/starsi-krok2-zadanie.html (O1–O10).

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { BitkaStav, CardInstance, Command, ElderState, GameState, LineState, MarkerPos, PlayerId, Vazen } from "../src/index.ts";
import {
  KONSTANTY,
  MOMENTY,
  naladaMomentu,
  apply,
  eventsFor,
  evaluateLine,
  krcmaVyzaduje,
  legalCommands,
  lineState,
  metrika,
  loadGameData,
  moznostiKseftuVazna,
  moznostiNaex,
  naTahu,
  setupGame,
  spakyZaVaznov,
  stranyBitky,
  viewFor,
} from "../src/index.ts";
import { EMPTY, instanceFor, makeDef, setupSBalickom, syntheticData } from "./helpers.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

function bitka(b: Partial<BitkaStav>): BitkaStav {
  return {
    krok: null,
    caka: null,
    sums: [{}, {}],
    exekutorHotovy: [true, true],
    pohorsenieZostava: [0, 0],
    exekutor: [0, 0],
    damage: null,
    vitaz: 0,
    prebytokDrzi: null,
    prebytokZostava: 0,
    prebytokPosunute: [],
    spalit: [],
    vesticaHotova: true,
    ...b,
  };
}

const sMarkerom = (e: ElderState, marker: MarkerPos, drzane?: number): ElderState => {
  const { vyplatene: _v, drzane: _d, ...bez } = e;
  return { ...bez, marker, ...(drzane !== undefined ? { drzane } : {}) };
};

/** Stav v kroku pokusu o zajatie: prvý starší sa bojí hráča 0 na stupni 3 (marker 6), druhý hráča 1 (marker 0). */
function predPokusom(seed = 3, cigarety: readonly [number, number] = [2, 2]): GameState {
  const s0 = setupGame(data, seed);
  const starsi = s0.starsi.map((e, i) => (i === 0 ? sMarkerom(e, 6) : i === 1 ? sMarkerom(e, 0) : i === 2 ? sMarkerom(e, 5) : e));
  return {
    ...s0,
    faza: "draft",
    utocnik: 0,
    starsi,
    ciel: { typ: "lokalita", lokalita: s0.lokalityVHre[0]! },
    hraci: [{ ...s0.hraci[0], cigarety: cigarety[0] }, { ...s0.hraci[1], cigarety: cigarety[1] }],
    draftStav: { krok: "zajatie", balicky: [[], []], vyber: [null, null], naTahu: 0, hotovo: [false, false], noveKarty: [0, 0] },
  };
}

/**
 * Bitka na konci (krok prebytok, rozdeľuje porazený): hráč `p` sa pokúša zajať staršieho
 * `i` (boss v súperovej ruke), bitku vyhral `vitaz`. Prebytok 1 posunie staršieho 7 —
 * po ňom sa bitka dohrá.
 */
function poBitke(p: PlayerId, i: number, vitaz: PlayerId | null, upravy: (s: GameState) => GameState = (s) => s): GameState {
  const s0 = setupGame(data, 4);
  const starsi = s0.starsi.map((e, j) => (j === i ? sMarkerom(e, p === 0 ? 6 : 0, 3) : e));
  const elder = starsi[i]!;
  const su: PlayerId = p === 0 ? 1 : 0;
  const hraci = s0.hraci.map((h, q) => (q === su ? { ...h, ruka: [...h.ruka, elder.karta] } : h)) as unknown as GameState["hraci"];
  const drzi: PlayerId = vitaz ?? 0;
  const s: GameState = {
    ...s0,
    faza: "bitka",
    starsi,
    hraci,
    ciel: { typ: "lokalita", lokalita: s0.lokalityVHre[0]! },
    lokalityVHre: s0.lokalityVHre.slice(1),
    pokusy: p === 0 ? [{ elderId: elder.elderId }, null] : [null, { elderId: elder.elderId }],
    nastenka: [
      { kolo: 1, lokalita: null, vitaz, rozhodlo: "tuhe", pitky: 1, zaBitku: [0, 0], zoSekery: 0, abstakZrazka: 0, prepadlo: 0, zaStarsich: [0, 0], exekutor: [0, 0], prebytok: [0, 0], spakyPo: [0, 0] },
    ],
    bitkaStav: bitka({ krok: "prebytok", caka: drzi === 0 ? 1 : 0, vitaz, prebytokDrzi: drzi, prebytokZostava: 1 }),
  };
  return upravy(s);
}

function dohrajBitku(s: GameState): GameState {
  const b = s.bitkaStav as BitkaStav;
  const posledny = s.starsi.at(-1)!;
  let po = apply(data, s, { type: "prebytok", elderId: posledny.elderId }, b.caka as PlayerId).state;
  for (let i = 0; i < 30 && po.koniec === null && po.faza === "bitka"; i++) {
    const q = naTahu(po) as PlayerId;
    const c = legalCommands(data, po, q)[0];
    if (c === undefined) break;
    po = apply(data, po, c, q).state;
  }
  return po;
}

describe("§10 Pokus o zajatie — podmienka, cena, poradie", () => {
  it("pokus len na staršieho, ktorý sa ťa bojí na stupni 3; cigareta prepadne a boss ide súperovi do ruky", () => {
    const s = predPokusom();
    const legal = legalCommands(data, s, 0);
    expect(legal).toContainEqual({ type: "bezPokusu" });
    const pokusy = legal.filter((c) => c.type === "pokus");
    // Hráča 0 sa bojí len prvý starší (marker 6 = červená na polovici hráča 1).
    expect(pokusy).toEqual([{ type: "pokus", elderId: s.starsi[0]!.elderId }]);
    const po = apply(data, s, pokusy[0] as Command, 0).state;
    expect(po.hraci[0].cigarety).toBe(1);
    expect(po.hraci[1].ruka.some((k) => k.uid === s.starsi[0]!.karta.uid)).toBe(true);
    expect(po.pokusy[0]).toEqual({ elderId: s.starsi[0]!.elderId });
    // Rozhoduje obranca — vidí voľbu útočníka a má vlastného kandidáta.
    expect(naTahu(po)).toBe(1);
    expect(legalCommands(data, po, 1).filter((c) => c.type === "pokus")).toEqual([{ type: "pokus", elderId: s.starsi[1]!.elderId }]);
  });

  it("každý najviac jeden pokus za kolo; obaja smú, každý iného staršieho; potom Zhromaždenie", () => {
    let s = predPokusom();
    s = apply(data, s, { type: "pokus", elderId: s.starsi[0]!.elderId }, 0).state;
    expect(() => apply(data, s, { type: "pokus", elderId: s.starsi[0]!.elderId }, 1)).toThrow();
    s = apply(data, s, { type: "pokus", elderId: s.starsi[1]!.elderId }, 1).state;
    expect(s.faza).toBe("zhromazdenie");
    expect(s.pokusy.map((x) => x?.elderId)).toEqual([s.starsi[0]!.elderId, s.starsi[1]!.elderId]);
  });

  it("bez cigarety pokus nie je — hra ho preskočí a dôvod povie len hráčovi", () => {
    const s = predPokusom(3, [0, 0]);
    expect(legalCommands(data, s, 0)).toEqual([{ type: "bezPokusu" }]);
    const r = apply(data, { ...s, draftStav: { ...s.draftStav!, naTahu: 0 } }, { type: "bezPokusu" }, 0);
    expect(r.state.faza).toBe("zhromazdenie");
  });

  it("O8: starší v ohrození sa v kole pokusu nehýbe — Pohoršenie, prebytok ani Povera naňho nesmú", () => {
    const s0 = predPokusom();
    const id = s0.starsi[0]!.elderId;
    const s: GameState = {
      ...s0,
      faza: "bitka",
      draftStav: null,
      pokusy: [{ elderId: id }, null],
      bitkaStav: bitka({ krok: "pohorsenie", caka: 1, pohorsenieZostava: [0, 9], poveryZostava: [0, 0] }),
    };
    expect(legalCommands(data, s, 1).some((c) => c.type === "pohorsenie" && c.elderId === id)).toBe(false);
    expect(() => apply(data, s, { type: "pohorsenie", elderId: id, kSebe: true }, 1)).toThrow();
    const sPrebytok: GameState = { ...s, bitkaStav: bitka({ krok: "prebytok", caka: 0, prebytokDrzi: 1, prebytokZostava: 9 }) };
    expect(legalCommands(data, sPrebytok, 0).some((c) => c.type === "prebytok" && c.elderId === id)).toBe(false);
    const sPovery: GameState = { ...s, bitkaStav: bitka({ krok: "povery", caka: 1, poveryZostava: [0, 3] }) };
    expect(legalCommands(data, sPovery, 1).some((c) => c.type === "povera" && c.elderId === id)).toBe(false);
  });
});

describe("§10 Výsledok pokusu (krok 6d)", () => {
  it("víťaz zajme: starší zmizne zo stupnice, je väzeň (1. v partii), karta odíde z ruky súpera; udržaný strach zaplatí", () => {
    const s = poBitke(0, 0, 0);
    const elder = s.starsi[0]!;
    const po = dohrajBitku(s);
    expect(po.starsi.some((e) => e.elderId === elder.elderId)).toBe(false);
    expect(po.vazni).toHaveLength(1);
    expect(po.vazni[0]).toMatchObject({ elderId: elder.elderId, hrac: 0, poradie: 1 });
    expect(po.hraci[1].ruka.some((k) => k.uid === elder.karta.uid)).toBe(false);
    expect(po.hraci[1].odhadzovaci.some((k) => k.uid === elder.karta.uid)).toBe(false);
    // drzane 3 z minulého kola: 1 + 2 + 3 = 6 špakov za udržaný strach.
    expect(po.nastenka.at(-1)?.zaStarsichRozpis?.[0].some((x) => x.elderId === elder.elderId && x.spaky === 6)).toBe(true);
    expect(po.pokusy).toEqual([null, null]);
  });

  it("porazený: starší späť na ukazovateľ, marker o stupeň späť a nezaplatená červená sa zmaže (O9)", () => {
    const s = poBitke(0, 0, 1);
    const elder = s.starsi[0]!;
    const po = dohrajBitku(s);
    const e = po.starsi.find((x) => x.elderId === elder.elderId)!;
    expect(e.marker).toBe(5);
    expect(e.karta.uid).toBe(elder.karta.uid);
    expect(po.vazni).toHaveLength(0);
    expect(po.hraci[1].ruka.some((k) => k.uid === elder.karta.uid)).toBe(false);
    // Udržané boli 3 stupne, po ústupe ostali 2 — zaplatia sa 1 + 2.
    expect(po.nastenka.at(-1)?.zaStarsichRozpis?.[0].find((x) => x.elderId === elder.elderId)?.spaky).toBe(3);
  });

  it("sekera: pokus zlyhá", () => {
    const po = dohrajBitku(poBitke(0, 0, null));
    expect(po.vazni).toHaveLength(0);
    expect(po.starsi[0]!.marker).toBe(5);
  });

  it("boss vyložený súperom do línie sa po bitke vráti aj tak — nezostane v odhadzovacom balíčku", () => {
    const s = poBitke(0, 0, 1, (st) => ({
      ...st,
      hraci: [st.hraci[0], { ...st.hraci[1], ruka: st.hraci[1].ruka.filter((k) => k.uid !== st.starsi[0]!.karta.uid) }],
      strany: [[], [{ card: st.starsi[0]!.karta, playedBy: 1 }]],
    }));
    const po = dohrajBitku(s);
    const uid = s.starsi[0]!.karta.uid;
    expect(po.hraci[1].odhadzovaci.some((k) => k.uid === uid)).toBe(false);
    expect(po.starsi.find((e) => e.elderId === s.starsi[0]!.elderId)?.karta.uid).toBe(uid);
  });

  it("tretí väzeň jedného hráča = výhra hneď, bez konečných špakov", () => {
    const s = poBitke(0, 0, 0, (st) => {
      const vazni: Vazen[] = [5, 6].map((j, i) => ({ elderId: st.starsi[j]!.elderId, hrac: 0, poradie: i + 1, karta: st.starsi[j]!.karta, scorecard: st.starsi[j]!.scorecard, miesto: j }));
      return { ...st, vazni, starsi: st.starsi.filter((_, j) => j !== 5 && j !== 6) };
    });
    const po = dohrajBitku(s);
    expect(po.koniec?.vitaz).toBe(0);
    expect(po.koniec?.body).toBeNull();
    expect(po.koniec?.dovod).toMatch(/tretieho staršieho/);
  });
});

describe("§14 Špaky za väzňov podľa poradia zajatia v partii", () => {
  it("1. väzeň 8, 2. 6, 3. 4, 4. 2 — nech ho zajal ktokoľvek", () => {
    const v = (hrac: PlayerId, poradie: number): Vazen => ({ elderId: `e${poradie}`, hrac, poradie, karta: { uid: poradie, defId: "farar", leftLayout: 0, rightLayout: 0 }, scorecard: "sc", miesto: 0 });
    const vazni = [v(1, 1), v(0, 2), v(0, 3), v(1, 4)];
    expect(KONSTANTY.SPAKY_ZA_VAZNOV).toEqual([8, 6, 4, 2]);
    expect(spakyZaVaznov({ vazni }, 0)).toBe(6 + 4);
    expect(spakyZaVaznov({ vazni }, 1)).toBe(8 + 2);
  });
});

// ---------------------------------------------------------------------------
// Kšeft väzňa (§7)

/** Stav v Pitke: hráč `p` drží väzňa `elderId`. */
function vPitke(elderId: string, p: PlayerId = 0, upravy: (s: GameState) => GameState = (s) => s): GameState {
  const s0 = setupSBalickom(data, 6);
  const elder = s0.starsi.find((e) => e.elderId === elderId)!;
  const lok = s0.lokalityVHre.find((k) => k.defId !== "krcma" && k.defId !== "kostol")!;
  const s: GameState = {
    ...s0,
    faza: "pitka",
    starsi: s0.starsi.filter((e) => e.elderId !== elderId),
    vazni: [{ elderId, hrac: p, poradie: 1, karta: elder.karta, scorecard: elder.scorecard, miesto: 0 }],
    ciel: { typ: "lokalita", lokalita: lok },
    pitkaCislo: 1,
    pitkyCelkom: 2,
    senok: s0.naradie.slice(0, 2),
    pitkaStav: { naTahu: 1, hotovy: [false, false], naexPouzity: [false, false], fajcenie: [0, 0], reakcia: null, postarka: [false, false], starosta: [false, false], naexPocet: [0, 0], vykup: [false, false] },
    zaciatokPitky: { pecen: [0, 0], cirhozy: [0, 0] },
  };
  return upravy(s);
}

const kseft = (s: GameState, p: PlayerId = 0): Command[] => moznostiKseftuVazna(s, p);

describe("§7 Kšeft väzňa — kto, cena, raz za Pitku", () => {
  it("len držiteľ väzňa; cena = vypitý plný poldeci (nerest, +1 pečeň, limit nižší); raz za Pitku", () => {
    const s = vPitke("hrobar");
    expect(kseft(s, 1)).toEqual([]);
    const cmd = kseft(s)[0]!;
    expect(cmd).toEqual({ type: "kseftVazna", elderId: "hrobar" });
    const po = apply(data, s, cmd, 0).state;
    expect(po.hraci[0].poldeciPlne).toBe(s.hraci[0].poldeciPlne - 1);
    expect(po.hraci[0].poldeciVypite).toBe(s.hraci[0].poldeciVypite + 1);
    expect(po.hraci[0].nerestiTotoKolo).toBe(s.hraci[0].nerestiTotoKolo + 1);
    expect(po.hraci[0].pecen).toBe(s.hraci[0].pecen + 1);
    expect(kseft(po)).toEqual([]);
    expect(() => apply(data, po, cmd, 0)).toThrow();
  });

  it("bez plného poldeci (ten na skrytom NA EX sa neráta) Kšeft nie je; po skončení Pitky tiež nie", () => {
    const s = vPitke("hrobar", 0, (st) => ({ ...st, hraci: [{ ...st.hraci[0], poldeciPlne: 0 }, st.hraci[1]] }));
    expect(kseft(s)).toEqual([]);
    const hotovo = vPitke("hrobar", 0, (st) => ({ ...st, pitkaStav: { ...st.pitkaStav!, hotovy: [true, false] } }));
    expect(kseft(hotovo)).toEqual([]);
  });

  it("naprázdno sa neponúka: Hrobár pri prázdnej ruke súpera, Poštárka bez Dlhu, Autobusár pri prázdnom šenku", () => {
    expect(kseft(vPitke("hrobar", 0, (st) => ({ ...st, hraci: [st.hraci[0], { ...st.hraci[1], ruka: [] }] })))).toEqual([]);
    expect(kseft(vPitke("postarka"))).toEqual([]);
    expect(kseft(vPitke("autobusar", 0, (st) => ({ ...st, senok: [] })))).toEqual([]);
  });
});

describe("§7 Kšefty ôsmich väzňov", () => {
  it("Hrobár: súper odhodí náhodnú kartu z ruky do odhadzovacieho balíčka; meno karty vie len on", () => {
    const s = vPitke("hrobar");
    const r = apply(data, s, { type: "kseftVazna", elderId: "hrobar" }, 0);
    expect(r.state.hraci[1].ruka).toHaveLength(s.hraci[1].ruka.length - 1);
    expect(r.state.hraci[1].odhadzovaci).toHaveLength(s.hraci[1].odhadzovaci.length + 1);
    const karta = r.state.hraci[1].odhadzovaci.at(-1)!;
    const meno = data.cards.get(karta.defId)!.name;
    const verejne = eventsFor(r.events, 0).filter((e) => e.type === "log").map((e) => (e as { text: string }).text);
    expect(verejne.some((t) => t.includes(`odhodil ${meno}`))).toBe(false);
    expect(eventsFor(r.events, 1).some((e) => e.type === "log" && e.text.includes(meno))).toBe(true);
  });

  it("Autobusár: karta zo šenku podľa voľby do ruky, šenok sa nedopĺňa", () => {
    const s = vPitke("autobusar");
    const k = s.senok[1]!;
    const po = apply(data, s, { type: "kseftVazna", elderId: "autobusar", kartaUid: k.uid }, 0).state;
    expect(po.hraci[0].ruka.some((x) => x.uid === k.uid)).toBe(true);
    expect(po.senok).toHaveLength(s.senok.length - 1);
  });

  it("Poštárka: 1 priznaný Dlh prejde na súpera", () => {
    const s = vPitke("postarka", 0, (st) => ({ ...st, hraci: [{ ...st.hraci[0], dlhy: 2 }, { ...st.hraci[1], dlhy: 0 }] }));
    const po = apply(data, s, { type: "kseftVazna", elderId: "postarka" }, 0).state;
    expect([po.hraci[0].dlhy, po.hraci[1].dlhy]).toEqual([1, 1]);
  });

  it("Starosta a Farár platia do konca kola (O1, O2) — raz spustené sa už neponúknu", () => {
    const s = vPitke("starosta");
    const po = apply(data, s, { type: "kseftVazna", elderId: "starosta" }, 0).state;
    expect(po.kseftyKola?.hranyPosilnene).toBe(true);
    expect(lineState(po).hranyPosilnene).toBe(true);
    const f = vPitke("farar");
    const pf = apply(data, f, { type: "kseftVazna", elderId: "farar" }, 0).state;
    expect(pf.kseftyKola?.vieraAkoHazard).toEqual([false, true]);
    expect(kseft({ ...pf, pitkaStav: { ...pf.pitkaStav!, kseft: [[], []] } })).toEqual([]);
  });

  it("Krčmárka: súper v tejto Pitke NA EX nedá, už dané skryté NA EX sa mu vráti (O4); na Krčme mu povinnosť zruší", () => {
    const s0 = vPitke("krcmarka");
    const ciel = moznostiNaex(data, { ...s0, pitkaStav: { ...s0.pitkaStav!, naTahu: 1 } }, 1);
    const s: GameState = ciel.length === 0 ? s0 : { ...s0, pitkaStav: { ...s0.pitkaStav!, skryteNaex: [{ hrac: 1, uid: ciel[0]! }] } };
    const r = apply(data, s, { type: "kseftVazna", elderId: "krcmarka" }, 0);
    expect(r.state.pitkaStav?.zakazNaex).toEqual([false, true]);
    expect((r.state.pitkaStav?.skryteNaex ?? []).filter((x) => x.hrac === 1)).toEqual([]);
    expect(r.state.hraci[1].poldeciPlne).toBe(s.hraci[1].poldeciPlne);
    expect(moznostiNaex(data, r.state, 1)).toEqual([]);
    expect(krcmaVyzaduje(data, r.state, 1)).toBe(false);
  });

  it("Vychovávateľka: súperovo NA EX v tejto Pitke → držiteľ +3 tuhé v bitke (jedna Petelica); na Krčme sa neponúkne", () => {
    const s = vPitke("vychovavatelka");
    const po = apply(data, s, { type: "kseftVazna", elderId: "vychovavatelka" }, 0).state;
    expect(po.pitkaStav?.hrozbaPetelice).toEqual([1, 0]);
    const sPetelicou: GameState = { ...po, kseftyKola: { petelice: [1, 0] } };
    const sums = evaluateLine(data, lineState(po)).sums;
    expect(stranyBitky(data, sPetelicou, sums)[0].tuheBonus - stranyBitky(data, po, sums)[0].tuheBonus).toBe(3);
    const krcma = data.lokality.find((l) => l.id === "krcma");
    if (krcma !== undefined) {
      const naKrcme = vPitke("vychovavatelka", 0, (st) => ({ ...st, ciel: { typ: "lokalita", lokalita: { uid: 99991, defId: "krcma", leftLayout: 0, rightLayout: 0 } } }));
      expect(kseft(naKrcme)).toEqual([]);
    }
  });

  it("Veterinár: Cirhóza z ruky alebo priznaná z hry (O3, nie z balíčka); pečeň v tejto Pitke 0 vrátane ceny", () => {
    const cirhoza = (uid: number): CardInstance => ({ uid, defId: "cirhoza", leftLayout: 0, rightLayout: 0 });
    const s = vPitke("veterinar", 0, (st) => ({
      ...st,
      hraci: [{ ...st.hraci[0], ruka: [...st.hraci[0].ruka, cirhoza(99001)], priznane: [cirhoza(99002)], odhadzovaci: [cirhoza(99003)], pecen: 2 }, st.hraci[1]],
    }));
    const moznosti = kseft(s);
    expect(moznosti).toEqual([
      { type: "kseftVazna", elderId: "veterinar", kartaUid: 99001 },
      { type: "kseftVazna", elderId: "veterinar", kartaUid: 99002 },
    ]);
    const po = apply(data, s, moznosti[1]!, 0).state;
    expect(po.hraci[0].priznane.some((k) => k.uid === 99002)).toBe(false);
    expect(po.hraci[0].odhadzovaci.some((k) => k.uid === 99003)).toBe(true);
    expect(po.hraci[0].pecen).toBe(0);
    expect(po.pitkaStav?.bezPecene).toEqual([true, false]);
    // Bez Cirhózy v ruke či medzi priznanými sa ponúkne len časť o pečeni.
    expect(kseft(vPitke("veterinar"))).toEqual([{ type: "kseftVazna", elderId: "veterinar" }]);
  });
});

describe("§7 Starosta a Farár v línii (partia.ts)", () => {
  const lok = makeDef("lok", [null, "Cigareta", null, null], ["Pecka", null, null, null], { tags: ["Lokalita"] });
  const a = makeDef("a", EMPTY, [null, "Rana", null, null]);
  const vl = makeDef("vl", EMPTY, ["Viera", null, null, null]);
  const vr = makeDef("vr", ["Viera", null, null, null], EMPTY);
  const syn = syntheticData([lok, a, vl, vr]);

  it("Starosta: aktívne akcie hrán lokality ×2, ostatné nie", () => {
    const line: LineState = {
      lokalita: instanceFor(syn, "lok", [null, "Cigareta", null, null], ["Pecka", null, null, null]),
      lokalitaOtocena: false,
      strany: [[{ card: instanceFor(syn, "a", EMPTY, [null, "Rana", null, null]), playedBy: 0 }], []],
    };
    expect(evaluateLine(syn, line).sums[0]).toEqual({ Rana: 1, Cigareta: 1 });
    expect(evaluateLine(syn, { ...line, hranyPosilnene: true }).sums[0]).toEqual({ Rana: 1, Cigareta: 2 });
  });

  it("Farár: súperova aktívna Viera je posilnený Hazard (2 zadĺženia za Vieru), v bitke Viera chýba", () => {
    const line: LineState = {
      lokalita: null,
      lokalitaOtocena: false,
      strany: [[], [{ card: instanceFor(syn, "vl", EMPTY, ["Viera", null, null, null]), playedBy: 0 }, { card: instanceFor(syn, "vr", ["Viera", null, null, null], EMPTY), playedBy: 0 }]],
    };
    const bez = evaluateLine(syn, line).sums[0];
    expect(bez.Viera).toBe(2);
    const s = evaluateLine(syn, { ...line, vieraAkoHazard: [true, false] }).sums[0];
    expect(s.Viera ?? 0).toBe(0);
    expect(s.Dlh).toBe(4);
  });
});

describe("viewFor (nemenné pravidlo 2) — pokus, boss a väzni", () => {
  it("pokus, väzni a Kšefty kola sú verejné; zvyšok súperovej ruky nie", () => {
    let s = predPokusom();
    s = apply(data, s, { type: "pokus", elderId: s.starsi[0]!.elderId }, 0).state;
    const v0 = viewFor(data, s, 0);
    expect(v0.pokusy[0]).toEqual({ elderId: s.starsi[0]!.elderId });
    expect(v0.hraci[1].rukaPocet).toBe(s.hraci[1].ruka.length);
    const json = JSON.stringify(v0);
    for (const k of s.hraci[1].ruka) {
      const boss = k.uid === s.starsi[0]!.karta.uid;
      // Boss je verejný (karta staršieho v starsi), ostatné karty súperovej ruky nesmú prejsť.
      if (!boss) expect(json.includes(`"uid":${k.uid},`)).toBe(false);
    }
  });
});

describe("achievementy a Melichar pri zajatí (Michal 2026-10-30)", () => {
  it("Prvý väzeň, Zachránené (zmarený pokus) a Hrôza a des (tretí väzeň) merajú zajatie; ids ostali — kto ich má, nestratí ich", async () => {
    const katalog = (await import("../data/achievementy.json")).default as { achievementy: { id: string; metrika: string }[] };
    const metrika = (id: string): string | undefined => katalog.achievementy.find((a) => a.id === id)?.metrika;
    expect(metrika("budicek")).toBe("prvyVazen");
    expect(metrika("zachranene")).toBe("zmarenyPokus");
    expect(metrika("hroza-a-des")).toBe("vyhraVydesenim");
    expect(katalog.achievementy.some((a) => a.metrika === "moment.prebudenie" || a.metrika === "moment.zachranene")).toBe(false);
  });

  it("Melichar: zajatie hráčom je pohoda, zajatie súperom (botom) hráčovi smola", () => {
    const m = { typ: "zajatie", ...MOMENTY.zajatie, hrac: 1, popis: "" } as const;
    expect(naladaMomentu(m, 1)).toBe("pohoda");
    expect(naladaMomentu(m, 0)).toBe("smola");
  });
});

describe("metriky zajatia (achievementy v9)", () => {
  const krok = (pred: GameState, po: GameState) => ({ pred, po }) as unknown as Parameters<NonNullable<ReturnType<typeof metrika>>["zmer"]>[0];
  it("prvyVazen: prvý väzeň partie; zmarenyPokus: súperov pokus zlyhal mojou výhrou", () => {
    const s = poBitke(0, 0, 0);
    const vyhral = dohrajBitku(s);
    expect(metrika("prvyVazen")?.zmer(krok(s, vyhral))).toEqual([1, null]);
    expect(metrika("zmarenyPokus")?.zmer(krok(s, vyhral))).toEqual([null, null]);
    const s1 = poBitke(0, 0, 1);
    const zmaril = dohrajBitku(s1);
    expect(metrika("prvyVazen")?.zmer(krok(s1, zmaril))).toEqual([null, null]);
    expect(metrika("zmarenyPokus")?.zmer(krok(s1, zmaril))).toEqual([null, 1]);
  });
});

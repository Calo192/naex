// Pravidlá v5 (docs/pravidla-v5/davka.md): zmeny jadra po etapách — Cirhóza
// po bitke, Pohoršenie oboma smermi, scorecardy a bodovanie v5, priazne v5.
// Očakávané hodnoty sú z dávky, nie z kódu.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { BitkaStav, CardInstance, ElderState, Favour, GameState, PlayerId, PlayerState } from "../src/index.ts";
import {
  IllegalCommandError,
  KONSTANTY,
  apply,
  barterCena,
  buildGameData,
  evaluateLine,
  eventsFor,
  favourStarsieho,
  legalCommands,
  loadGameData,
  naTahu,
  parseScorecards,
  pohorseniaVBitke,
  poskodenieBitky,
  prahyHraca,
  paleneDlhyVBitke,
  priazenZKluca,
  rozpisPoskodenia,
  setupGame,
  tahBota,
  uidZaverecnej,
  viewFor,
} from "../src/index.ts";
import type { Layout4 } from "./helpers.ts";
import { EMPTY, instanceFor, makeDef } from "./helpers.ts";
import { setupSBalickom } from "./helpers.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

let uidSeq = 990000;
const inst = (defId: string): CardInstance => ({ uid: ++uidSeq, defId, leftLayout: 0, rightLayout: 0 });
const kusy = (n: number, defId: string): CardInstance[] => Array.from({ length: n }, () => inst(defId));

function sHracom(s: GameState, p: PlayerId, h: Partial<PlayerState>): GameState {
  const hraci = [...s.hraci] as [PlayerState, PlayerState];
  hraci[p] = { ...hraci[p], ...h };
  return { ...s, hraci };
}

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
    benzinkaZostava: [0, 0],
    karHotovy: [true, true],
    spalit: [],
    vesticaHotova: true,
    ...b,
  };
}

/** Bitka v kroku Cintorína, čaká sa na hráča 0 — „nič“ ju dokončí a začne ďalšie kolo. */
function predKoncomBitky(seed: number, uprav: (s: GameState) => GameState = (s) => s): GameState {
  const s0 = setupSBalickom(data, seed);
  return uprav({
    ...s0,
    faza: "bitka",
    kolo: 2,
    strany: [[], []],
    ciel: { typ: "lokalita", lokalita: s0.lokalityVHre[0]! },
    lokalityVHre: s0.lokalityVHre.slice(1),
    bitkaStav: bitka({ krok: "cintorin", caka: 0 }),
  });
}

describe("v5 bod 8: nepriznaná Cirhóza po bitke do odhadzovacieho balíčka", () => {
  it("Cirhóza z ruky ide po bitke do odhadzovacieho balíčka, priznaná ostáva priznaná", () => {
    const vRuke = inst("cirhoza");
    const priznana = inst("cirhoza");
    const s = predKoncomBitky(61, (x) =>
      sHracom(x, 0, { ruka: [vRuke, ...kusy(2, "pijan")], doberaci: kusy(4, "pijan"), odhadzovaci: [], priznane: [priznana] }),
    );
    const po = apply(data, s, { type: "cintorin", uid: null }, 0).state;
    expect(po.koniec).toBeNull();
    expect(po.hraci[0].ruka.some((k) => k.uid === vRuke.uid)).toBe(false);
    expect(po.hraci[0].odhadzovaci.map((k) => k.uid)).toContain(vRuke.uid);
    expect(po.hraci[0].priznane.map((k) => k.uid)).toEqual([priznana.uid]);
  });

  it("Cirhóza dobratá až po bitke (2 karty po bitke) ostáva v ruke — rozhodne o nej v ďalšom kole", () => {
    const navrchu = inst("cirhoza");
    const s = predKoncomBitky(62, (x) => sHracom(x, 0, { ruka: kusy(2, "pijan"), doberaci: [navrchu, ...kusy(3, "pijan")], odhadzovaci: [] }));
    const po = apply(data, s, { type: "cintorin", uid: null }, 0).state;
    expect(po.hraci[0].ruka.map((k) => k.uid)).toContain(navrchu.uid);
  });

  it("odhodená Cirhóza je verejná (odhadzovací balíček), súper nevidí nič navyše z ruky", () => {
    const vRuke = inst("cirhoza");
    const s = predKoncomBitky(63, (x) => sHracom(x, 0, { ruka: [vRuke, inst("pijan")], doberaci: kusy(4, "pijan"), odhadzovaci: [] }));
    const po = apply(data, s, { type: "cintorin", uid: null }, 0).state;
    const pohlad = viewFor(data, po, 1);
    expect(pohlad.hraci[0].odhadzovaci.map((k) => k.uid)).toContain(vRuke.uid);
    // Karty, ktoré si hráč 0 dobral po bitke, súper nevidí.
    for (const k of po.hraci[0].ruka) expect(JSON.stringify(pohlad)).not.toContain(`"uid":${k.uid},`);
  });
});

describe("v5 bod 7: Pohoršenie oboma smermi", () => {
  /** Bitka v kroku Pohoršenia, hráč 0 má `n` Pohoršení, línia prázdna. */
  function vPohorseni(seed: number, uprav: (s: GameState) => GameState = (s) => s, n = 1): GameState {
    const s0 = setupSBalickom(data, seed);
    return uprav({
      ...s0,
      faza: "bitka",
      kolo: 2,
      utocnik: 1,
      strany: [[], []],
      ciel: { typ: "lokalita", lokalita: s0.lokalityVHre[0]! },
      lokalityVHre: s0.lokalityVHre.slice(1),
      bitkaStav: bitka({ krok: "pohorsenie", caka: 0, vitaz: null, pohorsenieZostava: [n, 0], karHotovy: [true, true], vesticaHotova: false }),
    });
  }
  const sMarkerom = (s: GameState, elderId: string, marker: ElderState["marker"]): GameState => ({
    ...s,
    starsi: s.starsi.map((e) => (e.elderId === elderId ? { ...e, marker} : e)),
  });
  const bitkarId = (s: GameState): string => s.starsi.find((e) => data.scorecards.find((x) => x.id === e.scorecard)?.favour === "BITKAR")!.elderId;

  it("legálne sú oba smery; k sebe posunie marker k hráčovi a priazeň platí už v poškodení tejto bitky", () => {
    const s = vPohorseni(71);
    const id = bitkarId(s);
    const st = sMarkerom(s, id, 3);
    const legal = legalCommands(data, st, 0);
    expect(legal).toContainEqual({ type: "pohorsenie", elderId: id });
    expect(legal).toContainEqual({ type: "pohorsenie", elderId: id, kSebe: true });
    const kSebe = apply(data, st, { type: "pohorsenie", elderId: id, kSebe: true }, 0).state;
    expect(kSebe.starsi.find((e) => e.elderId === id)?.marker).toBe(2);
    // Bitkár na strane hráča 0 (sila 1) mu dal tuhé navyše už v tejto bitke — prázdna línia, inak 0 : 0.
    expect(kSebe.bitkaStav?.damage?.tuhe[0]).toBeGreaterThan(0);
    expect(kSebe.bitkaStav?.vitaz).toBe(0);
    const kSuperovi = apply(data, st, { type: "pohorsenie", elderId: id }, 0);
    expect(kSuperovi.state.starsi.find((e) => e.elderId === id)?.marker).toBe(4);
    const vysledok = kSuperovi.events.find((e) => e.type === "bitkaVysledok");
    expect(vysledok?.type === "bitkaVysledok" ? vysledok.damage.tuhe[0] : -1).toBe(0);
  });

  it("v6: aj k sebe smie na krajnú pozíciu, ďalej von nie (oranžová → červená stojí 3, v8.2)", () => {
    const s = vPohorseni(72, (x) => x, 3);
    const id = s.starsi[0]!.elderId;
    const st = sMarkerom(s, id, 1);
    expect(legalCommands(data, st, 0)).toContainEqual({ type: "pohorsenie", elderId: id, kSebe: true });
    const po = apply(data, st, { type: "pohorsenie", elderId: id, kSebe: true }, 0).state;
    expect(po.starsi.find((e) => e.elderId === id)?.marker).toBe(0);
    const naKraji = sMarkerom(s, id, 0);
    expect(legalCommands(data, naKraji, 0)).not.toContainEqual({ type: "pohorsenie", elderId: id, kSebe: true });
    expect(() => apply(data, naKraji, { type: "pohorsenie", elderId: id, kSebe: true }, 0)).toThrow(IllegalCommandError);
  });

  it("v8.2: limit hraníc zón nie je — zo stredu na kraj 1 + 2 + 3 = 6 jedným výberom, späť do stredu 4 + 3 + 2 = 9", () => {
    const s = vPohorseni(73, (x) => x, 15);
    const id = s.starsi[0]!.elderId;
    let st = sMarkerom(s, id, 3);
    st = apply(data, st, { type: "pohorsenie", elderId: id, kSebe: true }, 0).state; // 3 → 0
    expect(st.starsi.find((x) => x.elderId === id)?.marker).toBe(0);
    expect(st.bitkaStav?.pohorsenieZostava[0]).toBe(9);
    st = apply(data, st, { type: "pohorsenie", elderId: id }, 0).state; // 0 → 3, na žltú súpera už nič neostane
    expect(st.starsi.find((x) => x.elderId === id)?.marker).toBe(3);
  });
});

describe("v5 bod 5 a v6: scorecardy nesú len priazeň", () => {
  it("východisková sada má 8 scorecardov bez podmienok (v6) a mená Kmotor, Abstinent, Robota a Advokát (v9)", () => {
    expect(data.scorecards).toHaveLength(8);
    const vsetky = data.scorecards.flatMap((sc) => [...sc.lava, ...sc.prava]);
    expect(vsetky.every((x) => x === null)).toBe(true);
    expect(data.scorecards.find((sc) => sc.favour === "UZERNIK")?.nazov).toBe("Kmotor");
    expect(data.scorecards.find((sc) => sc.favour === "LAKOMEC")?.nazov).toBe("Abstinent");
    expect(data.scorecards.find((sc) => sc.favour === "ROBOTA")?.nazov).toBe("Robota");
    expect(data.scorecards.find((sc) => sc.favour === "ADVOKAT")?.nazov).toBe("Advokát");
    // Bodovacia karta v tvorcovi smie niesť nové meno.
    expect(priazenZKluca("KMOTOR")).toBe("UZERNIK");
    expect(priazenZKluca("ABSTINENT")).toBe("LAKOMEC");
    // Staré sady (v9): Výpalník → Robota, Exekútor → Advokát.
    expect(priazenZKluca("VYPALNIK")).toBe("ROBOTA");
    expect(priazenZKluca("NEPRAJNIK")).toBe("ROBOTA");
    expect(priazenZKluca("EXEKUTOR")).toBe("ADVOKAT");
  });

  it("Absťák = Absťáky získané za hru: zahodením karty Absťák počítadlo neklesne", () => {
    // v9.1: menej nerestí než Chuť → karta Absťák a počítadlo +1.
    const s = predKoncomBitky(81, (x) => sHracom(x, 0, { nerestiTotoKolo: 1, chut: 2, abstakyZiskane: 1, doberaci: kusy(4, "pijan") }));
    const po = apply(data, s, { type: "cintorin", uid: null }, 0).state;
    expect(po.hraci[0].abstakyZiskane).toBe(2);
    // Karta z balíčka zmizne (Vízia), získané ostávajú.
    const bez: GameState = { ...po, hraci: [{ ...po.hraci[0], odhadzovaci: po.hraci[0].odhadzovaci.filter((k) => k.defId !== "abstak") }, po.hraci[1]] };
    expect(bez.hraci[0].abstakyZiskane).toBe(2);
    // Klient vidí počítadlo oboch (karta pribúda pred očami oboch).
    expect(viewFor(data, bez, 1).hraci[0].abstakyZiskane).toBe(2);
  });
});

describe("v5 bod 6: priazne v5 (sila 1 / 2 / 3)", () => {
  const R2: Layout4 = ["Rana", "Rana", null, null];
  const R1: Layout4 = ["Rana", null, null, null];
  const sada = buildGameData(
    new Map([...data.cards, ["v5_lavy", makeDef("v5_lavy", EMPTY, R2)], ["v5_pol", makeDef("v5_pol", R1, R1)]]),
    data.elders,
    parseScorecards(scorecardsJson),
  );
  /** Priazeň `favour` hráčovi p so silou sila (marker na jeho polovici). */
  const sPriaznou = (s: GameState, favour: Favour, p: PlayerId, sila: 1 | 2 | 3): GameState => {
    const marker = (p === 0 ? 3 - sila : 3 + sila) as ElderState["marker"];
    return { ...s, starsi: s.starsi.map((e) => (favourStarsieho(sada, e) === favour ? { ...e, marker} : e)) };
  };
  /** Pitka: hráč 1 na ťahu, na jeho strane dve karty, na ktoré smie dať NA EX. Ruky prázdne (bez odpovedí). */
  function pitkaSNaex(seed: number): { s: GameState; ciel: number } {
    const s0 = setupSBalickom(sada, seed);
    const lavy = instanceFor(sada, "v5_lavy", EMPTY, R2);
    const pol = instanceFor(sada, "v5_pol", R1, R1);
    const s: GameState = {
      ...s0,
      faza: "pitka",
      kolo: 2,
      utocnik: 0,
      pitkyCelkom: 1,
      pitkaCislo: 1,
      ciel: { typ: "lokalita", lokalita: null },
      lokalityVHre: s0.lokalityVHre.slice(1),
      // Karty hráča 1 sú otočené — pol vľavo, lavy vpravo: Rany sa spárujú len čiastočne.
      strany: [[], [{ card: pol, playedBy: 1 }, { card: lavy, playedBy: 1 }]],
      hraci: [
        { ...s0.hraci[0], ruka: [], cigarety: 5 },
        { ...s0.hraci[1], ruka: [], cigarety: 5, poldeciPlne: 1, poldeciVypite: 1 },
      ],
      pitkaStav: { naTahu: 1, hotovy: [false, false], naexPouzity: [false, false], fajcenie: [0, 0], reakcia: null, postarka: [false, false], starosta: [false, false], naexPocet: [0, 0], vykup: [false, false] },
    };
    return { s, ciel: lavy.uid };
  }
  /** Dohrá Pitku a bitku bez ďalších rozhodnutí (skipNaex / bezReakcie / Cintorín bez Nástroja). */
  function dohraj(s0: GameState): GameState {
    let s = s0;
    for (let i = 0; i < 20 && (s.faza === "pitka" || s.faza === "bitka") && s.koniec === null; i++) {
      const p = naTahu(s);
      if (p === null) break;
      const legal = legalCommands(sada, s, p);
      const cmd = legal.find((c) => c.type === "skipNaex" || c.type === "bezReakcie" || (c.type === "cintorin" && c.uid === null)) ?? legal[0]!;
      s = apply(sada, s, cmd, p).state;
    }
    return s;
  }

  it("Bitkár: +1 / +2 / +3 tuhého (nie dvojnásobok)", () => {
    const s0 = setupSBalickom(data, 91);
    for (const sila of [1, 2, 3] as const) {
      expect(poskodenieBitky(data, sPriaznou(s0, "BITKAR", 0, sila), [{}, {}]).tuhe).toEqual([sila, 0]);
    }
  });

  it("Abstinent (Lakomec): v bitke +1 / +2 / +3 Pohoršenia; barter nezlacňuje", () => {
    const s0 = setupSBalickom(data, 92);
    expect(pohorseniaVBitke(data, sPriaznou(s0, "LAKOMEC", 1, 2), [{}, {}])).toEqual([0, 2]);
    expect(barterCena(data, sPriaznou(s0, "LAKOMEC", 1, 3), 1)).toBe(KONSTANTY.BARTER_CENA);
  });

  it("Advokát (v9): exekúcia ti odpočíta o silu priazne menej špakov, Dlhy zhoria ako doteraz", () => {
    const s0 = sPriaznou(setupSBalickom(data, 93), "ADVOKAT", 0, 2);
    const s: GameState = {
      ...s0,
      faza: "bitka",
      kolo: 2,
      ciel: { typ: "lokalita", lokalita: s0.lokalityVHre[0]! },
      lokalityVHre: s0.lokalityVHre.slice(1),
      hraci: [{ ...s0.hraci[0], dlhy: 5 }, { ...s0.hraci[1], dlhy: 5 }],
      bitkaStav: bitka({ krok: "pohorsenie", caka: 0, pohorsenieZostava: [1, 0], exekutorHotovy: [false, false] }),
    };
    const iny = s.starsi.find((e) => e.marker === 3 && !["ADVOKAT", "ROBOTA"].includes(favourStarsieho(data, e)))!;
    const po = apply(data, s, { type: "pohorsenie", elderId: iny.elderId }, 0).state;
    expect([po.hraci[0].dlhy, po.hraci[1].dlhy]).toEqual([2, 2]);
    expect(po.nastenka.at(-1)?.exekutor).toEqual([1, 3]);
    expect(prahyHraca(data, s, 0).exekucia).toBe(3);
  });

  it("Alkoholik a Kmotor prahy Cirhózy a Dlhu nemenia, Robota Povery nemení", () => {
    let s = setupSBalickom(data, 94);
    s = sPriaznou(sPriaznou(sPriaznou(s, "ALKOHOLIK", 0, 3), "UZERNIK", 0, 3), "ROBOTA", 0, 3);
    expect(prahyHraca(data, s, 0).cirhoza).toBe(KONSTANTY.PRAH_CIRHOZY_ZAKLAD);
    expect(prahyHraca(data, s, 0).dlh).toBe(KONSTANTY.PRAH_DLHU_ZAKLAD);
    expect(rozpisPoskodenia(data, s, [{}, {}])[0].zvysnaPovera).toBe(0);
  });

  it("Kmotor (v9): po bitke presunie 2 / 3 / 4 priznané Dlhy, bez Dlhu nič", () => {
    const s = predKoncomBitky(95, (x) => sHracom(sPriaznou(x, "UZERNIK", 0, 2), 0, { dlhy: 4, doberaci: kusy(4, "pijan") }));
    const po = apply(data, s, { type: "cintorin", uid: null }, 0).state;
    expect(po.hraci[0].dlhy).toBe(1);
    const bez = predKoncomBitky(95, (x) => sHracom(sPriaznou(x, "UZERNIK", 0, 2), 0, { dlhy: 0, doberaci: kusy(4, "pijan") }));
    expect(apply(data, bez, { type: "cintorin", uid: null }, 0).state.hraci[0].dlhy).toBe(0);
  });

  it("Fajčiar (v9): +1 / +2 / +3 cigarety po bitke (nie po šenku)", () => {
    const s0 = setupSBalickom(data, 96);
    const s: GameState = {
      ...sPriaznou(s0, "FAJCIAR", 0, 2),
      faza: "draft",
      utocnik: 0,
      ciel: { typ: "lokalita", lokalita: s0.lokalityVHre[0]! },
      lokalityVHre: s0.lokalityVHre.slice(1),
      draftStav: { krok: "beranie", balicky: [[], []], vyber: [null, null], naTahu: 1, hotovo: [true, false], noveKarty: [0, 0] },
    };
    const po = apply(data, s, { type: "draftStop" }, 1).state;
    expect(po.hraci[0].cigarety).toBe(s.hraci[0].cigarety);
    const b = predKoncomBitky(96, (x) => sPriaznou(x, "FAJCIAR", 0, 2));
    const pb = apply(data, b, { type: "cintorin", uid: null }, 0).state;
    const bez = apply(data, predKoncomBitky(96, (x) => x), { type: "cintorin", uid: null }, 0).state;
    expect(pb.hraci[0].cigarety - bez.hraci[0].cigarety).toBe(2);
  });

  it("Robota (v9, O5): priazeň = akcie Robota navyše, pália Dlhy pred Exekútorom", () => {
    const s0 = setupSBalickom(data, 99);
    const s = { ...sPriaznou(s0, "ROBOTA", 0, 2), ciel: { typ: "lokalita", lokalita: s0.lokalityVHre[0]! } } as GameState;
    expect(paleneDlhyVBitke(data, s)).toEqual([2, 0]);
  });

  it("Na zdravie „do dna“ (Alkoholik): poldeci z tvojho NA EX sa po bitke vráti plný", () => {
    const { s, ciel } = pitkaSNaex(98);
    const s1 = dohraj(apply(sada, sPriaznou(s, "ALKOHOLIK", 1, 1), { type: "naex", uid: ciel }, 1).state);
    // Poldeci z NA EX späť plný + začiatok kola otočí jeden vypitý (ten, čo mal pred Pitkou).
    expect([s1.hraci[1].poldeciPlne, s1.hraci[1].poldeciVypite]).toEqual([2, 0]);
    const bez = dohraj(apply(sada, s, { type: "naex", uid: ciel }, 1).state);
    expect([bez.hraci[1].poldeciPlne, bez.hraci[1].poldeciVypite]).toEqual([1, 1]);
  });
});

describe("v5 bod 2: NA EX naraz + Výtržník", () => {
  const R2: Layout4 = ["Rana", "Rana", null, null];
  const R1: Layout4 = ["Rana", null, null, null];
  const VP: Layout4 = ["Viera", "Pohoršenie", null, null];
  const sada = buildGameData(
    new Map([...data.cards, ["v5n_lavy", makeDef("v5n_lavy", EMPTY, R2)], ["v5n_pol", makeDef("v5n_pol", R1, R1)], ["v5n_vp", makeDef("v5n_vp", EMPTY, VP)]]),
    data.elders,
    parseScorecards(scorecardsJson),
  );
  /** Pitka, obranca 1 na ťahu; na strane hráča 1 dve jeho karty (NA EX smie na obe), ruky prázdne. */
  function pitka(seed: number): { s: GameState; lavy: number; pol: number } {
    const s0 = setupSBalickom(sada, seed);
    const lavy = instanceFor(sada, "v5n_lavy", EMPTY, R2);
    const pol = instanceFor(sada, "v5n_pol", R1, R1);
    const s: GameState = {
      ...s0,
      faza: "pitka",
      kolo: 2,
      utocnik: 0,
      pitkyCelkom: 1,
      pitkaCislo: 1,
      ciel: { typ: "lokalita", lokalita: null },
      lokalityVHre: s0.lokalityVHre.slice(1),
      strany: [[], [{ card: pol, playedBy: 1 }, { card: lavy, playedBy: 1 }]],
      hraci: [
        // Cigareta na fajčenie — inak by hra „hotovo“ odohrala za hráča sama.
        { ...s0.hraci[0], ruka: [], cigarety: 1, poldeciPlne: 1, poldeciVypite: 0 },
        { ...s0.hraci[1], ruka: [], cigarety: 1, poldeciPlne: 1, poldeciVypite: 0 },
      ],
      pitkaStav: { naTahu: 1, hotovy: [false, false], naexPouzity: [false, false], fajcenie: [0, 0], reakcia: null, postarka: [false, false], starosta: [false, false], naexPocet: [0, 0], vykup: [false, false] },
    };
    return { s, lavy: lavy.uid, pol: pol.uid };
  }

  it("skryté NA EX súper nevidí — pohľad aj udalosti sú rovnaké, ako keby NA EX nedal", () => {
    const { s, lavy } = pitka(101);
    const { state, events } = apply(sada, s, { type: "naex", uid: lavy }, 1);
    expect(state.pitkaStav?.skryteNaex).toEqual([{ hrac: 1, uid: lavy }]);
    expect(state.hraci[1].poldeciPlne).toBe(1);
    const bez: GameState = { ...state, pitkaStav: { ...state.pitkaStav!, skryteNaex: [] } };
    expect(viewFor(sada, state, 0)).toEqual(viewFor(sada, bez, 0));
    expect(eventsFor(events, 0)).toEqual([]);
    // Vlastné NA EX hráč vidí.
    expect(viewFor(sada, state, 1).pitkaStav?.skryteNaex).toEqual([{ hrac: 1, uid: lavy }]);
    expect(eventsFor(events, 1).length).toBeGreaterThan(0);
    // Ani „hotovo“ neprezradí, či NA EX dal.
    const hotovo = apply(sada, state, { type: "skipNaex" }, 1);
    const hotovoBez = apply(sada, { ...s }, { type: "skipNaex" }, 1);
    expect(viewFor(sada, hotovo.state, 0)).toEqual(viewFor(sada, hotovoBez.state, 0));
    expect(eventsFor(hotovo.events, 0)).toEqual(eventsFor(hotovoBez.events, 0));
  });

  it("keď po skrytom NA EX ostáva len „hotovo“, hra ho odohrá bez stopy pre súpera (playtest 20261027-062058)", () => {
    // Bez cigariet je po NA EX „hotovo“ jediný ťah — hra ho urobí sama. Súper
    // musí vidieť to isté ako pri ručnom „hotovo“ bez NA EX: log aj pohľad.
    const { s: s0, lavy } = pitka(104);
    const s = sHracom(s0, 1, { cigarety: 0 });
    const naex = apply(sada, s, { type: "naex", uid: lavy }, 1);
    expect(naex.state.pitkaStav?.hotovy[1]).toBe(true);
    const bez = apply(sada, s, { type: "skipNaex" }, 1);
    expect(eventsFor(naex.events, 0)).toEqual(eventsFor(bez.events, 0));
    expect(viewFor(sada, naex.state, 0)).toEqual(viewFor(sada, bez.state, 0));
    const texty = (ev: readonly { type: string; text?: string }[]) => ev.flatMap((e) => (e.type === "log" && e.text !== undefined ? [e.text] : []));
    expect(texty(eventsFor(naex.events, 0))).toEqual(["Hráč 2 končí svoju časť Pitky. Čaká sa na hráča 1."]);
    // Hráč sám sa dozvie, prečo mu Pitka skončila.
    expect(texty(eventsFor(naex.events, 1)).some((t) => t.startsWith("Po skrytom NA EX už v Pitke nemáš čo urobiť"))).toBe(true);
  });

  it("bot nevidí súperovo skryté NA EX — rozhodne sa rovnako", () => {
    const { s, lavy } = pitka(102);
    const poNaex = apply(sada, s, { type: "naex", uid: lavy }, 1).state;
    const sHotovym = apply(sada, poNaex, { type: "skipNaex" }, 1).state;
    const bez = apply(sada, s, { type: "skipNaex" }, 1).state;
    expect(tahBota(sada, sHotovym, 0, 7)).toEqual(tahBota(sada, bez, 0, 7));
  });

  it("odkrytie po „hotovo“ oboch: poldeci, pečeň a záznam; dve NA EX na tú istú kartu = Výtržník", () => {
    const { s, lavy } = pitka(103);
    let st = apply(sada, s, { type: "naex", uid: lavy }, 1).state;
    st = apply(sada, st, { type: "skipNaex" }, 1).state;
    // Hráč 0 súperovo NA EX nevidí — tú istú kartu smie vybrať.
    expect(legalCommands(sada, st, 0)).toContainEqual({ type: "naex", uid: lavy });
    st = apply(sada, st, { type: "naex", uid: lavy }, 0).state;
    const { state, events } = apply(sada, st, { type: "skipNaex" }, 0);
    const texty = events.flatMap((e) => (e.type === "log" ? [e.text] : []));
    expect(texty.some((t) => t.startsWith("Zrážka NA EX"))).toBe(true);
    expect(events.filter((e) => e.type === "pecen").map((e) => (e.type === "pecen" ? e.hrac : -1)).sort()).toEqual([0, 1]);
    const vysledok = events.find((e) => e.type === "bitkaVysledok");
    // Výtržník: obe akcie karty sú aktívne Rany majiteľa (hráč 1), bez zdvojenia NA EX,
    // a sused s ňou spáruje svoju Ranu ako predtým: 2 + 1.
    expect(vysledok?.type === "bitkaVysledok" ? vysledok.sums[1].Rana : -1).toBe(3);
    // Pri odkrytí obaja položili svoj plný poldeci na kartu.
    expect([state.hraci[0].poldeciPlne, state.hraci[1].poldeciPlne]).toEqual([0, 0]);
  });

  it("Výtržník je výtržníkom len počas jednej bitky — po bitke vytriezvie (pôvodné akcie, bez príznaku, aj v pohľade a logu)", () => {
    const { s: s0, lavy } = pitka(104);
    let st = apply(sada, s0, { type: "naex", uid: lavy }, 1).state;
    st = apply(sada, st, { type: "skipNaex" }, 1).state;
    st = apply(sada, st, { type: "naex", uid: lavy }, 0).state;
    const logy: string[] = [];
    let r = apply(sada, st, { type: "skipNaex" }, 0);
    for (let i = 0; ; i++) {
      for (const e of r.events) if (e.type === "log") logy.push(e.text);
      st = r.state;
      const p = naTahu(st);
      if (st.faza !== "pitka" && st.faza !== "bitka") break;
      if (p === null || i > 30) throw new Error("bitka sa nedohrala");
      r = apply(sada, st, legalCommands(sada, st, p)[0]!, p);
    }
    expect(logy.some((t) => t.startsWith("Zrážka NA EX"))).toBe(true);
    expect(logy.some((t) => t.includes("vytriezvel"))).toBe(true);
    // Karta je späť v balíčku majiteľa ako obyčajná karta — rovnaký variant, žiadny príznak.
    expect(st.strany).toEqual([[], []]);
    const karta = [...st.hraci[1].odhadzovaci, ...st.hraci[1].ruka, ...st.hraci[1].doberaci].find((k) => k.uid === lavy);
    expect(karta).toEqual(s0.strany[1].find((pl) => pl.card.uid === lavy)?.card);
    for (const q of [0, 1] as const) expect(JSON.stringify(viewFor(sada, st, q))).not.toMatch(/vytrznik|naexBy2/);
    // Vyložená znova má pôvodné akcie: spárovaná Rana z každej karty = 2 (ako Výtržník dala 3).
    const pol = instanceFor(sada, "v5n_pol", R1, R1);
    const znova = evaluateLine(sada, { lokalita: null, lokalitaOtocena: false, strany: [[], [{ card: pol, playedBy: 1 }, { card: karta!, playedBy: 1 }]] });
    expect(znova.sums[1].Rana).toBe(2);
  });

  it("Výtržník: všetky akcie karty sú aktívne Rany pre majiteľa, aj Viera a Pohoršenie", () => {
    const vp = instanceFor(sada, "v5n_vp", EMPTY, VP);
    const pol = instanceFor(sada, "v5n_pol", R1, R1);
    const line = (vytrznik: boolean) => ({
      lokalita: null,
      lokalitaOtocena: false,
      strany: [[], [{ card: pol, playedBy: 1 as PlayerId }, { card: vp, playedBy: 1 as PlayerId, ...(vytrznik ? { naexBy: 0 as PlayerId, naexBy2: 1 as PlayerId, vytrznik: true as const } : {}) }]] as GameState["strany"],
    });
    const bez = evaluateLine(sada, line(false)).sums[1];
    const s = evaluateLine(sada, line(true)).sums[1];
    expect(s.Viera ?? 0).toBe(0);
    expect(s.Pohoršenie ?? 0).toBe(0);
    // Viera a Pohoršenie Výtržníka sú dve Rany navyše.
    expect((s.Rana ?? 0) - (bez.Rana ?? 0)).toBe(2);
  });
});

describe("v5 bod 2: skryté NA EX na súperovu Záverečnú", () => {
  it("vlastné skryté NA EX nesie náhradné uid Záverečnej — skutočná karta sa neprezradí", () => {
    const s0 = setupSBalickom(data, 111);
    const zaverecna: CardInstance = { uid: 991111, defId: "svokra", leftLayout: 0, rightLayout: 0 };
    const s: GameState = {
      ...s0,
      faza: "pitka",
      pitkyCelkom: 1,
      pitkaCislo: 1,
      ciel: { typ: "lokalita", lokalita: s0.lokalityVHre[0]! },
      lokalityVHre: s0.lokalityVHre.slice(1),
      strany: [[], [{ card: inst("pijan"), playedBy: 1 }, { card: zaverecna, playedBy: 1, zaverecna: true }]],
      hraci: [{ ...s0.hraci[0], poldeciPlne: 1, cigarety: 1 }, s0.hraci[1]],
      pitkaStav: { naTahu: 0, hotovy: [false, false], naexPouzity: [false, false], fajcenie: [0, 0], reakcia: null, postarka: [false, false], starosta: [false, false], naexPocet: [0, 0], vykup: [false, false] },
    };
    const po = apply(data, s, { type: "naex", uid: uidZaverecnej(1) }, 0).state;
    const pohlad = viewFor(data, po, 0);
    expect(pohlad.pitkaStav?.skryteNaex).toEqual([{ hrac: 0, uid: uidZaverecnej(1) }]);
    expect(JSON.stringify(pohlad)).not.toContain(`${zaverecna.uid}`);
    // Druhé NA EX na tú istú Záverečnú už nie.
    expect(legalCommands(data, po, 0)).not.toContainEqual({ type: "naex", uid: uidZaverecnej(1) });
  });
});

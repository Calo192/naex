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
  pohorsenieMozne,
  pohorseniaVBitke,
  poskodenieBitky,
  prahyHraca,
  priazenZKluca,
  rozpisPoskodenia,
  setupGame,
  tahBota,
  uidZaverecnej,
  viewFor,
} from "../src/index.ts";
import type { Layout4 } from "./helpers.ts";
import { EMPTY, instanceFor, makeDef } from "./helpers.ts";

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

describe("v5 bod 8: nepriznaná Cirhóza po bitke do odhadzovacieho balíčka", () => {
  it("Cirhóza z ruky ide po bitke do odhadzovacieho balíčka, priznaná ostáva priznaná", () => {
    const vRuke = inst("cirhoza");
    const priznana = inst("cirhoza");
    const s = predKoncomBitky(61, (x) =>
      sHracom(x, 0, { ruka: [vRuke, ...kusy(2, "pijan")], doberaci: kusy(4, "pijan"), odhadzovaci: [], priznane: [priznana] }),
    );
    const po = apply(data, s, { type: "skipPohreb" }, 0).state;
    expect(po.koniec).toBeNull();
    expect(po.hraci[0].ruka.some((k) => k.uid === vRuke.uid)).toBe(false);
    expect(po.hraci[0].odhadzovaci.map((k) => k.uid)).toContain(vRuke.uid);
    expect(po.hraci[0].priznane.map((k) => k.uid)).toEqual([priznana.uid]);
  });

  it("Cirhóza dobratá až po bitke (2 karty po bitke) ostáva v ruke — rozhodne o nej v ďalšom kole", () => {
    const navrchu = inst("cirhoza");
    const s = predKoncomBitky(62, (x) => sHracom(x, 0, { ruka: kusy(2, "pijan"), doberaci: [navrchu, ...kusy(3, "pijan")], odhadzovaci: [] }));
    const po = apply(data, s, { type: "skipPohreb" }, 0).state;
    expect(po.hraci[0].ruka.map((k) => k.uid)).toContain(navrchu.uid);
  });

  it("odhodená Cirhóza je verejná (odhadzovací balíček), súper nevidí nič navyše z ruky", () => {
    const vRuke = inst("cirhoza");
    const s = predKoncomBitky(63, (x) => sHracom(x, 0, { ruka: [vRuke, inst("pijan")], doberaci: kusy(4, "pijan"), odhadzovaci: [] }));
    const po = apply(data, s, { type: "skipPohreb" }, 0).state;
    const pohlad = viewFor(data, po, 1);
    expect(pohlad.hraci[0].odhadzovaci.map((k) => k.uid)).toContain(vRuke.uid);
    // Karty, ktoré si hráč 0 dobral po bitke, súper nevidí.
    for (const k of po.hraci[0].ruka) expect(JSON.stringify(pohlad)).not.toContain(`"uid":${k.uid},`);
  });
});

describe("v5 bod 7: Pohoršenie oboma smermi", () => {
  /** Bitka v kroku Pohoršenia, hráč 0 má `n` Pohoršení, línia prázdna. */
  function vPohorseni(seed: number, uprav: (s: GameState) => GameState = (s) => s, n = 1): GameState {
    const s0 = setupGame(data, seed);
    return uprav({
      ...s0,
      faza: "bitka",
      kolo: 2,
      utocnik: 1,
      strany: [[], []],
      ciel: { typ: "lokalita", lokalita: s0.lokalityVHre[0]! },
      lokalityVHre: s0.lokalityVHre.slice(1),
      bitkaStav: bitka({ krok: "pohorsenie", caka: 0, vitaz: null, pohorsenieZostava: [n, 0], pohrebHotovy: [false, false], karHotovy: [true, true], vesticaHotova: false }),
    });
  }
  const sMarkerom = (s: GameState, elderId: string, marker: ElderState["marker"]): GameState => ({
    ...s,
    starsi: s.starsi.map((e) => (e.elderId === elderId ? { ...e, marker, markerZaciatokKola: marker } : e)),
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

  it("na krajnú pozíciu nesmie ani k sebe", () => {
    const s = vPohorseni(72);
    const id = s.starsi[0]!.elderId;
    const st = sMarkerom(s, id, 1);
    expect(pohorsenieMozne(st, 0, st.starsi[0]!, true)).toBe(false);
    expect(() => apply(data, st, { type: "pohorsenie", elderId: id, kSebe: true }, 0)).toThrow(IllegalCommandError);
    // Hráč 1 k sebe z pozície 7 tiež nie (8 je krajná).
    expect(pohorsenieMozne(sMarkerom(s, id, 7), 1, { ...st.starsi[0]!, marker: 7, markerZaciatokKola: 7 }, true)).toBe(false);
  });

  it("limit dvoch hraníc zón je spoločný pre oba smery", () => {
    const s = vPohorseni(73, (x) => x, 6);
    const id = s.starsi[0]!.elderId;
    let st = sMarkerom(s, id, 4);
    st = apply(data, st, { type: "pohorsenie", elderId: id, kSebe: true }, 0).state; // 4 → 3, bez hranice
    st = apply(data, st, { type: "pohorsenie", elderId: id, kSebe: true }, 0).state; // 3 → 2, hranica 1
    st = apply(data, st, { type: "pohorsenie", elderId: id }, 0).state; // 2 → 3, hranica 2
    st = apply(data, st, { type: "pohorsenie", elderId: id }, 0).state; // 3 → 4
    st = apply(data, st, { type: "pohorsenie", elderId: id }, 0).state; // 4 → 5
    const e = st.starsi.find((x) => x.elderId === id)!;
    expect(e.marker).toBe(5);
    expect(st.bitkaStav?.pohorsenieHranice[`0:${id}`]).toBe(2);
    // 5 → 6 by bola tretia hranica.
    expect(pohorsenieMozne(st, 0, e)).toBe(false);
    expect(pohorsenieMozne(st, 0, e, true)).toBe(true);
  });
});

describe("v5 bod 5: scorecardy v5 s podmienkami Absťák a Rezerva", () => {
  it("východisková sada má 8 scorecardov, Absťák aj Rezervu a nové mená Kmotor a Abstinent", () => {
    expect(data.scorecards).toHaveLength(8);
    const vsetky = data.scorecards.flatMap((sc) => [...sc.lava, ...sc.prava]);
    expect(vsetky).toContain("abstak");
    expect(vsetky).toContain("rezerva");
    expect(data.scorecards.find((sc) => sc.favour === "UZERNIK")?.nazov).toBe("Kmotor");
    expect(data.scorecards.find((sc) => sc.favour === "LAKOMEC")?.nazov).toBe("Abstinent");
    // Bodovacia karta v tvorcovi smie niesť nové meno.
    expect(priazenZKluca("KMOTOR")).toBe("UZERNIK");
    expect(priazenZKluca("ABSTINENT")).toBe("LAKOMEC");
  });

  it("Absťák = Absťáky získané za hru: zbavením sa Absťáku počítadlo neklesne", () => {
    // Menej nerestí než minulé kolo → Absťák a počítadlo +1.
    const s = predKoncomBitky(81, (x) => sHracom(x, 0, { nerestiMinuleKolo: 2, nerestiTotoKolo: 1, abstakyZiskane: 1, doberaci: kusy(4, "pijan") }));
    const po = apply(data, s, { type: "skipPohreb" }, 0).state;
    expect(po.hraci[0].abstakyZiskane).toBe(2);
    // Viac nerestí → Absťák späť do zásoby, získané ostávajú.
    const s2 = predKoncomBitky(82, (x) => sHracom(x, 0, { nerestiMinuleKolo: 1, nerestiTotoKolo: 3, abstakyZiskane: 2, priznane: [inst("abstak")], doberaci: kusy(4, "pijan") }));
    const po2 = apply(data, s2, { type: "skipPohreb" }, 0).state;
    expect(po2.hraci[0].priznane.some((k) => k.defId === "abstak")).toBe(false);
    expect(po2.hraci[0].abstakyZiskane).toBe(2);
    // Klient vidí počítadlo oboch (Absťák sa priznáva verejne).
    expect(viewFor(data, po2, 1).hraci[0].abstakyZiskane).toBe(2);
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
    const marker = (p === 0 ? 3 - sila : 5 + sila) as ElderState["marker"];
    return { ...s, starsi: s.starsi.map((e) => (favourStarsieho(sada, e) === favour ? { ...e, marker, markerZaciatokKola: marker } : e)) };
  };
  /** Pitka: hráč 1 na ťahu, na jeho strane dve karty, na ktoré smie dať NA EX. Ruky prázdne (bez odpovedí). */
  function pitkaSNaex(seed: number): { s: GameState; ciel: number } {
    const s0 = setupGame(sada, seed);
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
  /** Dohrá Pitku a bitku bez ďalších rozhodnutí (skipNaex / bezReakcie / skipPohreb). */
  function dohraj(s0: GameState): GameState {
    let s = s0;
    for (let i = 0; i < 20 && (s.faza === "pitka" || s.faza === "bitka") && s.koniec === null; i++) {
      const p = naTahu(s);
      if (p === null) break;
      const legal = legalCommands(sada, s, p);
      const cmd = legal.find((c) => c.type === "skipNaex" || c.type === "bezReakcie" || c.type === "skipPohreb") ?? legal[0]!;
      s = apply(sada, s, cmd, p).state;
    }
    return s;
  }

  it("Bitkár: +1 / +2 / +3 tuhého (nie dvojnásobok)", () => {
    const s0 = setupGame(data, 91);
    for (const sila of [1, 2, 3] as const) {
      expect(poskodenieBitky(data, sPriaznou(s0, "BITKAR", 0, sila), [{}, {}], [0, 0]).tuhe).toEqual([sila, 0]);
    }
  });

  it("Abstinent (Lakomec): v bitke +1 / +2 / +3 Pohoršenia; barter nezlacňuje", () => {
    const s0 = setupGame(data, 92);
    expect(pohorseniaVBitke(data, sPriaznou(s0, "LAKOMEC", 1, 2), [{}, {}])).toEqual([0, 2]);
    expect(barterCena(data, sPriaznou(s0, "LAKOMEC", 1, 3), 1)).toBe(KONSTANTY.BARTER_CENA);
  });

  it("Exekútor: súperov prah Exekúcie je nižší o silu, vlastný ostáva 10", () => {
    const s = sPriaznou(setupGame(data, 93), "EXEKUTOR", 1, 2);
    expect(prahyHraca(data, s, 0).exekutor).toBe(KONSTANTY.PRAH_EXEKUTORA_ZAKLAD - 2);
    expect(prahyHraca(data, s, 1).exekutor).toBe(KONSTANTY.PRAH_EXEKUTORA_ZAKLAD);
  });

  it("Alkoholik a Kmotor prahy Cirhózy a Dlhu nemenia, Neprajník strop mäkkého nezdvíha", () => {
    let s = setupGame(data, 94);
    s = sPriaznou(sPriaznou(sPriaznou(s, "ALKOHOLIK", 0, 3), "UZERNIK", 0, 3), "NEPRAJNIK", 0, 3);
    expect(prahyHraca(data, s, 0).cirhoza).toBe(KONSTANTY.PRAH_CIRHOZY_ZAKLAD);
    expect(prahyHraca(data, s, 0).dlh).toBe(KONSTANTY.PRAH_DLHU_ZAKLAD);
    expect(rozpisPoskodenia(data, s, [{}, {}], [0, 0])[0].makkeStrop).toBe(0);
  });

  it("Kmotor (Úžerník): po bitke zmizne 1 / 2 / 3 priznaných Dlhov, bez Dlhu nič", () => {
    const s = predKoncomBitky(95, (x) => sHracom(sPriaznou(x, "UZERNIK", 0, 2), 0, { priznane: kusy(3, "dlh"), doberaci: kusy(4, "pijan") }));
    const po = apply(data, s, { type: "skipPohreb" }, 0).state;
    expect(po.hraci[0].priznane.filter((k) => k.defId === "dlh")).toHaveLength(1);
    const bez = predKoncomBitky(95, (x) => sHracom(sPriaznou(x, "UZERNIK", 0, 2), 0, { priznane: [], doberaci: kusy(4, "pijan") }));
    expect(apply(data, bez, { type: "skipPohreb" }, 0).state.hraci[0].priznane).toHaveLength(0);
  });

  it("Fajčiar: +1 / +2 / +3 cigarety po výbere zo šenku", () => {
    const s0 = setupGame(data, 96);
    const s: GameState = {
      ...sPriaznou(s0, "FAJCIAR", 0, 2),
      faza: "draft",
      utocnik: 0,
      ciel: { typ: "lokalita", lokalita: s0.lokalityVHre[0]! },
      lokalityVHre: s0.lokalityVHre.slice(1),
      draftStav: { krok: "beranie", balicky: [[], []], vyber: [null, null], naTahu: 1, hotovo: [true, false], noveKarty: [0, 0] },
    };
    const po = apply(data, s, { type: "draftStop" }, 1).state;
    expect(po.hraci[0].cigarety).toBe(s.hraci[0].cigarety + 2);
    expect(po.hraci[1].cigarety).toBe(s.hraci[1].cigarety);
  });

  it("Výpalné (Neprajník): za každé súperovo NA EX mu prejde 1 / 2 / 3 cigariet", () => {
    const { s, ciel } = pitkaSNaex(97);
    const sNeprajnikom = sPriaznou(s, "NEPRAJNIK", 0, 2);
    const po = dohraj(apply(sada, sNeprajnikom, { type: "naex", uid: ciel }, 1).state);
    // Bez priazne sa nič neplatí (cigarety za prebytok sú v oboch partiách rovnaké).
    const bez = dohraj(apply(sada, s, { type: "naex", uid: ciel }, 1).state);
    expect(bez.hraci[1].cigarety).toBe(5);
    expect(po.hraci[1].cigarety - bez.hraci[1].cigarety).toBe(-2);
    expect(po.hraci[0].cigarety - bez.hraci[0].cigarety).toBe(2);
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
    const s0 = setupGame(sada, seed);
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
    const s0 = setupGame(data, 111);
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
      zaverecnaOdklad: [null, { naexSupera: 0, naexVlastne: 0, zahodeniaSupera: 0 }],
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

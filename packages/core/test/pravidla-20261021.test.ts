// Pravidlá 2026-10-21 (rozbory strategia-kliatby-20261021 a strategia-remiza-20261021,
// dizajn hra-nezrovnalosti-20261021-1229): remíza „na sekeru“ len podľa tuhého,
// verejný dlh a Cirhóza navrch balíčka (od 2026-10-25 ide do odhadzovacieho,
// pravidla-20261025.test.ts), náhľad Pitky, záznam „hotovo“ a verejný počet
// nepriznaných kliatob vo viewFor.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { CardInstance, Command, Event, GameState, PlacedCard, PlayerId } from "../src/index.ts";
import {
  apply,
  buildGameData,
  eventsFor,
  legalCommands,
  loadGameData,
  nahladPitky,
  naTahu,
  nepriznaneKliatbyHraca,
  parseScorecards,
  rngInt,
  rngSeed,
  rozlozRod,
  setupGame,
  viewFor,
} from "../src/index.ts";
import type { Layout4 } from "./helpers.ts";
import { instanceFor, makeDef } from "./helpers.ts";
import { setupSBalickom } from "./helpers.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

interface Krok {
  readonly pred: GameState;
  readonly cmd: Command;
  readonly hrac: PlayerId;
  readonly po: GameState;
  readonly events: readonly Event[];
}

/** Náhodná partia legálnymi ťahmi — každý krok s výsledkom pre kontrolu invariantov. */
function partia(seed: number, kazdyKrok: (k: Krok) => void): GameState {
  let state = setupSBalickom(data, seed);
  let rng = rngSeed(seed ^ 0x5eca);
  for (let i = 0; state.koniec === null && i < 20000; i++) {
    const hrac = naTahu(state);
    if (hrac === null) break;
    const cmds = legalCommands(data, state, hrac);
    const [j, r] = rngInt(rng, cmds.length);
    rng = r;
    const cmd = cmds[j] as Command;
    const { state: po, events } = apply(data, state, cmd, hrac);
    kazdyKrok({ pred: state, cmd, hrac, po, events });
    state = po;
  }
  return state;
}

const SEEDY = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233];

describe("remíza a sekera v6 (Michal 2026-10-26; sekera od 2026-10-21)", () => {
  it("remízu v tuhom rozhodnú Absťáky, potom Dlhy; sekera odloží špaky kola víťazovi ďalšej bitky", () => {
    let sekier = 0;
    let zoSekery = 0;
    let rozhodliRemizu = 0;
    for (const seed of SEEDY) {
      partia(seed, ({ pred, po, events }) => {
        const vysledok = events.find((e) => e.type === "bitkaVysledok");
        // Lokality nemiznú: v hre + na nástenke (+ cieľ) = všetky.
        const spolu = po.lokalityVHre.length + po.nastenka.filter((b) => b.lokalita !== null).length + (po.ciel?.typ === "lokalita" && po.bitkaStav?.damage == null ? 1 : 0);
        expect(spolu).toBe(po.lokalitCelkom);
        if (vysledok?.type !== "bitkaVysledok") return;
        const [a, b] = vysledok.damage.tuhe;
        if (a !== b) expect([vysledok.vitaz, vysledok.rozhodlo]).toEqual([a > b ? 0 : 1, "tuhe"]);
        else if (vysledok.rozhodlo !== "sekera") rozhodliRemizu++;
        const zaznam = po.nastenka.at(-1)!;
        expect(zaznam.vitaz).toBe(vysledok.vitaz);
        const finale = pred.ciel?.typ === "finale";
        if (vysledok.vitaz === null) {
          sekier++;
          if (!finale) expect(po.spakyNaSekere).toBe(pred.spakyNaSekere + zaznam.pitky);
          else expect(zaznam.prepadlo).toBe(pred.spakyNaSekere + zaznam.pitky);
        } else {
          expect(zaznam.zoSekery).toBe(pred.spakyNaSekere);
          expect(po.spakyNaSekere).toBe(0);
          if (pred.spakyNaSekere > 0) zoSekery++;
        }
      });
    }
    expect(sekier).toBeGreaterThan(0);
    expect(zoSekery).toBeGreaterThan(0);
    expect(rozhodliRemizu).toBeGreaterThan(0);
  });
});

describe("verejný dlh (Michal 2026-10-21) a nová Cirhóza do odhadzovacieho balíčka (Michal 2026-10-25)", () => {
  const P4: Layout4 = ["PoškodeniePečene", "PoškodeniePečene", "PoškodeniePečene", "PoškodeniePečene"];
  const D4: Layout4 = ["Dlh", "Dlh", "Dlh", "Dlh"];
  const piticka = makeDef("piticka", P4, P4);
  const dlzna = makeDef("dlzna", D4, D4);
  const cards = new Map(data.cards);
  cards.set(piticka.id, piticka);
  cards.set(dlzna.id, dlzna);
  const sada = buildGameData(cards, data.elders, parseScorecards(scorecardsJson));

  function vPitke(s: GameState, strany: GameState["strany"]): GameState {
    return {
      ...s,
      faza: "pitka",
      pitkyCelkom: 1,
      pitkaCislo: 1,
      strany,
      pitkaStav: {
        naTahu: s.utocnik === 0 ? 1 : 0,
        hotovy: [false, false],
        naexPouzity: [false, false],
        fajcenie: [0, 0],
        reakcia: null,
        postarka: [false, false],
        starosta: [false, false],
      },
    };
  }

  it("nový Dlh sa hneď prizná a ráta sa na konci; nová Cirhóza ide do odhadzovacieho balíčka", () => {
    const s1 = setupSBalickom(sada, 77);
    // Doberací balíček so 6 kartami: dobratie po bitke ho nevyčerpá, odhadzovací sa nezamieša.
    const plny = Array.from({ length: 6 }, (_, i): CardInstance => ({ uid: 700001 + i, defId: "pijan", leftLayout: 0, rightLayout: 0 }));
    const s0: GameState = { ...s1, hraci: [{ ...s1.hraci[0], doberaci: plny, odhadzovaci: [] }, s1.hraci[1]] };
    const lezi = (card: CardInstance, playedBy: PlayerId): PlacedCard => ({ card, playedBy });
    let s = vPitke(s0, [[lezi(instanceFor(sada, "piticka", P4, P4), 0), lezi(instanceFor(sada, "dlzna", D4, D4), 0)], []]);
    // Čo náhľad sľúbi, musí vyhodnotenie urobiť.
    const nahlad = nahladPitky(sada, s);
    const zaciatok = naTahu(s)!;
    s = apply(sada, s, { type: "skipNaex" }, zaciatok).state;
    const { state, events } = apply(sada, s, { type: "skipNaex" }, naTahu(s)!);
    // Bitka po Pitke sa rozbehne v tom istom ťahu (Robota by Dlh spálila) — rátaj z logu.
    const priznaneDlhy = events.filter((e) => e.type === "log" && e.text.startsWith("Hráč 1 získava Dlh — hneď sa priznáva")).length;
    expect(nahlad[0].dlhy).toBeGreaterThan(0);
    expect(priznaneDlhy).toBe(nahlad[0].dlhy);
    expect(state.hraci[0].odhadzovaci.some((k) => k.defId === "dlh")).toBe(false);
    expect(nahlad[0].cirhozy).toBeGreaterThan(0);
    // Cirhózy idú do odhadzovacieho balíčka — dobratie po bitke ich do ruky nedá.
    expect(events.filter((e) => e.type === "log" && e.text === "Hráč 1 získava Cirhózu — ide do jeho odhadzovacieho balíčka.")).toHaveLength(nahlad[0].cirhozy);
    expect(nepriznaneKliatbyHraca(state.hraci[0]).cirhoza - nepriznaneKliatbyHraca(s0.hraci[0]).cirhoza).toBe(nahlad[0].cirhozy);
    expect(state.hraci[0].odhadzovaci.filter((k) => k.defId === "cirhoza")).toHaveLength(nahlad[0].cirhozy);
    expect(state.hraci[0].doberaci.some((k) => k.defId === "cirhoza")).toBe(false);
    expect(state.hraci[0].ruka.some((k) => k.defId === "cirhoza")).toBe(false);
  });

  it("Dlh sa sám nepáli — kto exekúcii nečelí, priznané Dlhy si nechá (Michal 2026-10-22)", () => {
    const s0 = setupSBalickom(sada, 77);
    const dlh = (uid: number): CardInstance => ({ uid, defId: "dlh", leftLayout: 0, rightLayout: 0 });
    const sDlhmi: GameState = {
      ...s0,
      hraci: [{ ...s0.hraci[0], priznane: [dlh(900001), dlh(900002)] }, s0.hraci[1]],
    };
    let s = vPitke(sDlhmi, [[{ card: instanceFor(sada, "piticka", P4, P4), playedBy: 0 }], []]);
    s = apply(sada, s, { type: "skipNaex" }, naTahu(s)!).state;
    const { state, events } = apply(sada, s, { type: "skipNaex" }, naTahu(s)!);
    expect(events.some((e) => e.type === "log" && e.text.includes("páli"))).toBe(false);
    expect(state.hraci[0].priznane.filter((k) => k.defId === "dlh").map((k) => k.uid)).toEqual([900001, 900002]);
  });
});

describe("náhľad Pitky = vyhodnotenie (Michal 2026-10-21)", () => {
  it("na konci každej Pitky vznikne presne toľko Cirhóz a Dlhov, koľko ukazoval náhľad", () => {
    let pitiek = 0;
    for (const seed of SEEDY) {
      partia(seed, ({ pred, cmd, events }) => {
        const pitka = pred.pitkaStav;
        // NA EX naraz (v5): Pitka sa vyhodnotí po poslednom „hotovo“ alebo po
        // poslednej odpovedi na odkryté NA EX. Skryté NA EX náhľad ešte nevidí
        // (ani hráč) — také kroky sa porovnať nedajú.
        if ((cmd.type !== "skipNaex" && cmd.type !== "bezReakcie") || pitka === null) return;
        if ((pitka.skryteNaex ?? []).length > 0 || !events.some((e) => e.type === "pitkaVysledok")) return;
        const nahlad = nahladPitky(data, pred);
        for (const p of [0, 1] as const) {
          const cirhozy = events.filter((e) => e.type === "log" && rozlozRod(e.text, ["muz", "muz"]) === `Hráč ${p + 1} dosiahol prah pečene (${nahlad[p].prahPecene}) — Cirhóza.`).length;
          const dlhy = events.filter((e) => e.type === "log" && rozlozRod(e.text, ["muz", "muz"]) === `Hráč ${p + 1} dosiahol prah dlhu (${nahlad[p].prahDlhu}) — Dlh.`).length;
          expect(cirhozy).toBe(nahlad[p].cirhozy);
          expect(dlhy).toBe(nahlad[p].dlhy);
          // Účet Pitky pre klienta hovorí to isté.
          const ucet = events.find((e) => e.type === "pitkaVysledok");
          expect(ucet?.type === "pitkaVysledok" ? [ucet.cirhozy[p], ucet.dlhy[p]] : null).toEqual([nahlad[p].cirhozy, nahlad[p].dlhy]);
        }
        pitiek++;
      });
    }
    expect(pitiek).toBeGreaterThan(20);
  });

  it("vo Vízii je Pitka vyhodnotená — náhľad nepripočíta stôl druhýkrát (playtest 20261021-143600)", () => {
    let vizii = 0;
    for (const seed of SEEDY) {
      partia(seed, ({ pred }) => {
        if (pred.vizia === null) return;
        const nahlad = nahladPitky(data, pred);
        for (const p of [0, 1] as const) {
          expect(nahlad[p].pecenZoStola).toBe(0);
          expect(nahlad[p].zadlzenieZoStola).toBe(0);
          expect(nahlad[p].cirhozy).toBe(0);
          expect(nahlad[p].dlhy).toBe(0);
        }
        vizii++;
      });
    }
    expect(vizii).toBeGreaterThan(0);
  });

  it("„hotovo“ v Pitke sa zapíše do logu, ktorý vidia obaja", () => {
    let hotovych = 0;
    partia(4, ({ cmd, hrac, events }) => {
      if (cmd.type !== "skipNaex") return;
      for (const q of [0, 1] as const) {
        expect(eventsFor(events, q).some((e) => e.type === "log" && e.text.startsWith(`Hráč ${hrac + 1} končí svoju časť Pitky`))).toBe(true);
      }
      hotovych++;
    });
    expect(hotovych).toBeGreaterThan(0);
  });
});

describe("viewFor: počet nepriznaných kliatob je odvoditeľný z verejného logu", () => {
  // Bezpečnostná hranica (CLAUDE.md, pravidlo 2): počet súperových nepriznaných
  // kliatob sa smie posielať len preto, že každá jeho zmena je vo verejnom logu.
  // Keby sa počet zmenil bez verejnej zmienky, bol by to únik skrytej informácie.
  it("každá zmena počtu súperových kliatob má v jeho logu zmienku o kliatbe", () => {
    let zmien = 0;
    for (const seed of SEEDY) {
      partia(seed, ({ pred, po, events }) => {
        for (const q of [0, 1] as const) {
          const a = nepriznaneKliatbyHraca(pred.hraci[q]);
          const b = nepriznaneKliatbyHraca(po.hraci[q]);
          if (a.dlh === b.dlh && a.cirhoza === b.cirhoza) continue;
          zmien++;
          const su: PlayerId = q === 0 ? 1 : 0;
          const verejne = eventsFor(events, su).filter((e) => e.type === "log").map((e) => (e.type === "log" ? e.text : ""));
          const zmienka = verejne.some((t) => (a.dlh !== b.dlh && /Dlh/.test(t)) || (a.cirhoza !== b.cirhoza && /Cirhóz/.test(t)));
          expect(zmienka, `kliatby hráča ${q + 1}: ${JSON.stringify(a)} → ${JSON.stringify(b)}, log: ${verejne.join(" | ")}`).toBe(true);
        }
        // A view ich posiela presne.
        const v = viewFor(data, po, 0);
        expect(v.nepriznaneKliatby[1]).toEqual(nepriznaneKliatbyHraca(po.hraci[1]));
      });
    }
    expect(zmien).toBeGreaterThan(10);
  });
});

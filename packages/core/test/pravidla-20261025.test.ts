// Michal 2026-10-25: nová Cirhóza ide do odhadzovacieho balíčka (nie navrch
// doberacieho) a keď sa doberací balíček minie, odhadzovací sa zamieša
// a stane sa z neho nový doberací balíček — pri každom ťahaní.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { CardDef, CardInstance, GameData, GameState, PlayerId, PlayerState } from "../src/index.ts";
import { apply, buildGameData, loadGameData, nahladPitky, naTahu, parseScorecards, setupGame } from "../src/index.ts";
import type { Layout4 } from "./helpers.ts";
import { instanceFor, makeDef } from "./helpers.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

let uidSeq = 250000;
const inst = (defId: string): CardInstance => ({ uid: ++uidSeq, defId, leftLayout: 0, rightLayout: 0 });
const kusy = (n: number, defId: string): CardInstance[] => Array.from({ length: n }, () => inst(defId));

function sada(...defs: CardDef[]): GameData {
  const cards = new Map(data.cards);
  for (const d of defs) cards.set(d.id, d);
  return buildGameData(cards, data.elders, parseScorecards(scorecardsJson));
}

function sHracom(s: GameState, p: PlayerId, h: Partial<PlayerState>): GameState {
  const hraci = [...s.hraci] as [PlayerState, PlayerState];
  hraci[p] = { ...hraci[p], ...h };
  return { ...s, hraci };
}

const PITKA_STAV = {
  hotovy: [false, false],
  naexPouzity: [false, false],
  fajcenie: [0, 0],
  reakcia: null,
  postarka: [false, false],
  starosta: [false, false],
  naexPocet: [0, 0],
  vykup: [false, false],
} as const;

function vPitke(seed: number, g: GameData = data, strany: GameState["strany"] = [[], []]): GameState {
  const s0 = setupGame(g, seed);
  return {
    ...s0,
    faza: "pitka",
    utocnik: 1,
    pitkyCelkom: 1,
    pitkaCislo: 1,
    ciel: { typ: "lokalita", lokalita: s0.lokalityVHre[0]! },
    lokalityVHre: s0.lokalityVHre.slice(1),
    strany,
    pitkaStav: { ...PITKA_STAV, naTahu: 0 },
  };
}

const uids = (karty: readonly CardInstance[]): number[] => karty.map((k) => k.uid);

describe("nová Cirhóza ide do odhadzovacieho balíčka (Michal 2026-10-25)", () => {
  const EMPTY: Layout4 = [null, null, null, null];
  const P4: Layout4 = ["PoškodeniePečene", "PoškodeniePečene", "PoškodeniePečene", "PoškodeniePečene"];
  const V2: Layout4 = ["Vízia", "Vízia", null, null];
  const lokV = makeDef("lok_vizia", ["Rana", null, null, null], EMPTY, { tags: ["Lokalita"] });
  const piticka = makeDef("piticka", P4, P4);
  const vestec = makeDef("vestec", EMPTY, V2);
  const sadaC = sada(lokV, piticka, vestec);

  /**
   * Hráč 0 je tesne pod prahom pečene a má v línii pečeň aj dve Vízie; obaja
   * dajú „bez NA EX“, kým nepríde Vízia. Dve Vízie preto, aby po prvej ešte
   * neprišla bitka (tá by nepriznanú Cirhózu z ruky vrátila do odhadzovacieho).
   */
  function poPitke(seed: number, doberaci: CardInstance[], odhadzovaci: CardInstance[]): { s: GameState; cirhozy: number } {
    const s0 = setupGame(sadaC, seed);
    let s: GameState = sHracom(
      {
        ...s0,
        faza: "pitka",
        utocnik: 1,
        ciel: { typ: "lokalita", lokalita: instanceFor(sadaC, "lok_vizia", ["Rana", null, null, null], EMPTY) },
        lokalitaOtocena: false,
        strany: [
          [
            { card: instanceFor(sadaC, "piticka", P4, P4), playedBy: 0 },
            { card: instanceFor(sadaC, "vestec", EMPTY, V2), playedBy: 0 },
          ],
          [],
        ],
        pitkyCelkom: 1,
        pitkaCislo: 1,
        pitkaStav: { ...PITKA_STAV, naTahu: 0 },
      },
      0,
      { pecen: 3, doberaci, odhadzovaci },
    );
    const cirhozy = nahladPitky(sadaC, s)[0].cirhozy;
    expect(cirhozy).toBeGreaterThan(0);
    for (let i = 0; i < 2 && s.vizia === null && s.faza === "pitka"; i++) s = apply(sadaC, s, { type: "skipNaex" }, naTahu(s)!).state;
    expect(s.vizia?.zostava[0]).toBe(2);
    return { s, cirhozy };
  }

  it("Cirhóza nejde navrch doberacieho — Vízia vidí jeho pôvodnú vrchnú kartu", () => {
    const vrch = inst("pijan");
    const { s, cirhozy } = poPitke(71, [vrch, ...kusy(3, "pijan")], []);
    expect(s.hraci[0].doberaci[0]?.uid).toBe(vrch.uid);
    expect(s.hraci[0].doberaci.some((k) => k.defId === "cirhoza")).toBe(false);
    expect(s.hraci[0].odhadzovaci.filter((k) => k.defId === "cirhoza")).toHaveLength(cirhozy);
  });

  it("pri prázdnom doberacom sa odhadzovací zamieša a nová Cirhóza príde do ruky (Vízia: vziať)", () => {
    const { s, cirhozy } = poPitke(72, [], []);
    expect(s.hraci[0].doberaci).toHaveLength(cirhozy);
    expect(s.hraci[0].odhadzovaci).toEqual([]);
    const vrchna = s.hraci[0].doberaci[0]!;
    expect(vrchna.defId).toBe("cirhoza");
    const po = apply(sadaC, s, { type: "vizia", vziat: true }, 0).state;
    expect(po.vizia?.zostava[0]).toBe(1);
    expect(po.hraci[0].ruka.map((k) => k.uid)).toContain(vrchna.uid);
  });
});

describe("keď sa doberací balíček minie, odhadzovací sa zamieša a stane sa z neho nový doberací", () => {
  it("fajčenie", () => {
    const odhodene = [inst("cirhoza"), inst("ministrant")];
    const s = sHracom(vPitke(73), 0, { cigarety: 3, doberaci: [], odhadzovaci: odhodene });
    const po = apply(data, s, { type: "smoke", pocet: 2 }, 0).state;
    expect(uids(po.hraci[0].ruka)).toEqual(expect.arrayContaining(uids(odhodene)));
    expect(po.hraci[0].odhadzovaci).toEqual([]);
    expect(po.hraci[0].doberaci).toEqual([]);
    // Zamiešanie ide zo seedovaného generátora v stave — rovnaký stav, rovnaký výsledok.
    expect(apply(data, s, { type: "smoke", pocet: 2 }, 0).state).toEqual(po);
    expect(po.rng).not.toEqual(s.rng);
  });

  it("fajčenie uprostred: najprv zvyšok doberacieho, potom zamiešaný odhadzovací", () => {
    const posledna = inst("pijan");
    const odhodena = inst("cirhoza");
    const s = sHracom(vPitke(74), 0, { cigarety: 3, doberaci: [posledna], odhadzovaci: [odhodena] });
    const po = apply(data, s, { type: "smoke", pocet: 2 }, 0).state;
    expect(uids(po.hraci[0].ruka)).toEqual(expect.arrayContaining([posledna.uid, odhodena.uid]));
    expect(po.hraci[0].odhadzovaci).toEqual([]);
  });

  it("Poštárka", () => {
    const odhodena = inst("ministrant");
    const strany: GameState["strany"] = [[{ card: inst("postarka"), playedBy: 0 }], []];
    const s = sHracom(vPitke(75, data, strany), 0, { doberaci: [], odhadzovaci: [odhodena] });
    const po = apply(data, s, { type: "postarka", pocet: 1 }, 0).state;
    expect(uids(po.hraci[0].ruka)).toContain(odhodena.uid);
    expect(po.hraci[0].odhadzovaci).toEqual([]);
  });

  it("priznanie kliatby", () => {
    const s0 = setupGame(data, 76);
    const dlh = inst("dlh");
    const odhodena = inst("ministrant");
    const s = {
      ...sHracom(s0, 0, { ruka: [dlh, inst("pijan")], doberaci: [], odhadzovaci: [odhodena] }),
      faza: "zhromazdenie",
      ciel: { typ: "lokalita", lokalita: s0.lokalityVHre[0]! },
      zhromazdenieStav: { naTahu: 0, zostavaLimit: [2, 2], pasoval: [false, false], navyse: [0, 0] },
    } as GameState;
    const po = apply(data, s, { type: "place", uid: dlh.uid, target: "priznanie" }, 0).state;
    expect(uids(po.hraci[0].ruka)).toContain(odhodena.uid);
    expect(po.hraci[0].odhadzovaci).toEqual([]);
  });

  it("dobratie po bitke (2 karty na ďalšie kolo)", () => {
    const s0 = setupGame(data, 77);
    const odhodene = kusy(3, "ministrant");
    const s = sHracom(
      {
        ...s0,
        faza: "bitka",
        kolo: 2,
        strany: [[], []],
        ciel: { typ: "lokalita", lokalita: s0.lokalityVHre[0]! },
        lokalityVHre: s0.lokalityVHre.slice(1),
        bitkaStav: {
          krok: "pohreb",
          caka: 0,
          sums: [{}, {}],
          exekutorHotovy: [true, true],
          pohorsenieZostava: [0, 0],
          pohorsenieHranice: {},
          damage: null,
          vitaz: 0,
          prebytokDrzi: null,
          prebytokZostava: 0,
          prebytokPosunute: [],
          pohrebHotovy: [false, true],
          karHotovy: [true, true],
          vesticaHotova: true,
          benzinkaZostava: [0, 0],
          spalit: [0, 0],
        } as unknown as GameState["bitkaStav"],
      },
      0,
      { ruka: [], doberaci: [], odhadzovaci: odhodene },
    );
    const po = apply(data, s, { type: "skipPohreb" }, 0).state;
    expect(po.koniec).toBeNull();
    expect(po.hraci[0].ruka.filter((k) => odhodene.some((o) => o.uid === k.uid))).toHaveLength(2);
    expect(po.hraci[0].doberaci).toHaveLength(1);
    expect(po.hraci[0].odhadzovaci).toEqual([]);
  });

  it("Veľmi smútiaca vdova odhalí vrchnú kartu zamiešaného odhadzovacieho balíčka súpera", () => {
    const s0 = setupGame(data, 78);
    const vdova = inst("velmi_smutiaca_vdova");
    const muz = inst("pijan");
    let s = {
      ...sHracom(s0, 0, { ruka: [vdova, inst("pijan")] }),
      faza: "zhromazdenie",
      ciel: { typ: "lokalita", lokalita: s0.lokalityVHre[0]! },
      zhromazdenieStav: { naTahu: 0, zostavaLimit: [2, 2], pasoval: [false, false], navyse: [0, 0] },
    } as GameState;
    s = sHracom(s, 1, { doberaci: [], odhadzovaci: [muz] });
    const po = apply(data, s, { type: "place", uid: vdova.uid, target: "vlastna" }, 0).state;
    const h1 = po.hraci[1];
    expect(uids([...h1.ruka, ...h1.doberaci, ...h1.odhadzovaci])).not.toContain(muz.uid);
  });
});

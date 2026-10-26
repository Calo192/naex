// Efekty okolo NA EX — trojica (Michal 2026-10-26, docs/napady/karty-naex-trojica.html):
// Policajtka dá pri odkrytí Dlh súperovi, ktorý dal v Pitke viac NA EX; Svokra
// udelí v bitke Ranu za každú majiteľovu kartu so súperovým NA EX; NA EX majiteľa
// na vlastného Anonymného alkoholika (placatka) sa nepočíta do limitu za Pitku.
// Anonymný alkoholik ani Liberál NA EX nezakazujú. Predtým: Policajtka rušila
// Pohoršenia, Svokra kradla cigarety, Anonymný alkoholik chránil seba.
// NA EX smie len na kartu s aspoň 1 aktívnou a 1 neaktívnou akciou (2026-10-23) —
// preto karty v testoch ležia vo dvojiciach.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { CardInstance, Event, GameState, PlacedCard, PlayerId } from "../src/index.ts";
import {
  apply,
  bitkaMody,
  evaluateLine,
  pohorseniaVBitke,
  krcmaVyzaduje,
  legalCommands,
  lineState,
  loadGameData,
  moznostiNaex,
  naTahu,
  poskodenieBitky,
  rozpisPoskodenia,
  setupGame,
  svokraRany,
} from "../src/index.ts";
import { naexOdkryte } from "./helpers.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

let uidSeq = 90000;
const inst = (defId: string): CardInstance => ({ uid: ++uidSeq, defId, leftLayout: 0, rightLayout: 0 });
const lezi = (defId: string, playedBy: PlayerId, extra: Partial<PlacedCard> = {}): PlacedCard => ({ card: inst(defId), playedBy, ...extra });
const uid = (pl: PlacedCard | undefined): number => pl?.card.uid ?? -1;

interface Nastavenie {
  /** Cieľ kola — lokalita (krcma, kostol, vinna_pivnica…). */
  readonly lokalita?: string;
  readonly poldeci?: readonly [number, number];
  /**
   * Karta v ruke oboch — po odkrytí sa čaká na odpoveď, takže stav ostane tesne
   * po odkrytí NA EX (pred vyhodnotením Pitky). Bez nej sa Pitka dohrá.
   */
  readonly ruka?: boolean;
}

/** Pitka, hráč `naTahu` na ťahu, obaja s plným poldeci a 3 cigaretami. */
function vPitke(strany: GameState["strany"], naTahu: PlayerId = 0, n: Nastavenie = {}): GameState {
  const s = setupGame(data, 3);
  const poldeci = n.poldeci ?? [1, 1];
  const ruka = (): CardInstance[] => (n.ruka === true ? [inst("pijan")] : []);
  return {
    ...s,
    faza: "pitka",
    pitkyCelkom: 1,
    pitkaCislo: 1,
    ciel: n.lokalita === undefined ? s.ciel : { typ: "lokalita", lokalita: inst(n.lokalita) },
    strany,
    hraci: [
      { ...s.hraci[0], poldeciPlne: poldeci[0], cigarety: 3, ruka: ruka() },
      { ...s.hraci[1], poldeciPlne: poldeci[1], cigarety: 3, ruka: ruka() },
    ],
    pitkaStav: { naTahu, hotovy: [false, false], naexPouzity: [false, false], fajcenie: [0, 0], reakcia: null, postarka: [false, false], starosta: [false, false], naexPocet: [0, 0] },
  } as GameState;
}

/** Kam smie hráč p dať NA EX — aj keď práve nie je na ťahu (vyberá skryto, každý vo svojej časti Pitky). */
const naexCiele = (s: GameState, p: PlayerId): number[] => moznostiNaex(data, s, p);

/**
 * Pitka naraz: kto je na ťahu, dá svoje NA EX (v poradí zo zoznamu) a skončí.
 * Zastaví sa, keď sa čaká na odpoveď na odkryté NA EX alebo keď Pitka skončí.
 */
function odohraj(s: GameState, naex: readonly [readonly number[], readonly number[]]): { state: GameState; logy: string[] } {
  let t = s;
  const logy: string[] = [];
  const zostava = [[...naex[0]], [...naex[1]]];
  for (let i = 0; i < 20 && t.faza === "pitka" && t.vizia === null && t.pitkaStav !== null && t.pitkaStav.reakcia === null; i++) {
    const p = naTahu(t);
    if (p === null) break;
    const u = zostava[p]?.shift();
    const r = apply(data, t, u === undefined ? { type: "skipNaex" } : { type: "naex", uid: u }, p);
    for (const e of r.events as Event[]) if (e.type === "log") logy.push(e.text);
    t = r.state;
  }
  return { state: t, logy };
}

const dlhy = (s: GameState, p: PlayerId): number => s.hraci[p].priznane.filter((k) => k.defId === "dlh").length;

describe("Policajtka (Pitka: súper s viac NA EX dostane Dlh)", () => {
  /** Hráč 0 dve dvojice Pijanov, hráč 1 dvojicu Pijanov a Policajtku. */
  const stol = (): GameState["strany"] => [
    [lezi("pijan", 0), lezi("pijan", 0)],
    [lezi("pijan", 1), lezi("pijan", 1), lezi("policajtka", 1)],
  ];

  it("súper dal v Pitke viac NA EX (1 : 0) — pri odkrytí dostane Dlh, hneď priznaný", () => {
    const s = vPitke(stol(), 0, { ruka: true });
    const ciel = naexCiele(s, 0)[0]!;
    const { state, logy } = odohraj(s, [[ciel], []]);
    // Stav tesne po odkrytí: čaká sa na odpoveď, Pitka sa ešte nevyhodnotila.
    expect(state.pitkaStav?.reakcia).toBe(1);
    expect(dlhy(state, 0) - dlhy(s, 0)).toBe(1);
    expect(dlhy(state, 1)).toBe(dlhy(s, 1));
    expect(logy).toContain("Policajtka: hráč 1 dal v tejto Pitke viac NA EX (1 : 0) — dostáva Dlh.");
  });

  it("rovnosť (1 : 1) — nič; viac NA EX majiteľa Policajtky (0 : 1) — tiež nič", () => {
    const s = vPitke(stol(), 0, { ruka: true });
    const moje = naexCiele(s, 0).find((u) => s.strany[0].some((pl) => pl.card.uid === u))!;
    const jeho = naexCiele(s, 1).find((u) => s.strany[1].some((pl) => pl.card.uid === u && pl.card.defId === "pijan"))!;
    const rovnost = odohraj(s, [[moje], [jeho]]);
    expect(rovnost.state.pitkaStav?.naexPocet).toEqual([1, 1]);
    expect(rovnost.logy.some((t) => t.startsWith("Policajtka"))).toBe(false);
    expect([dlhy(rovnost.state, 0), dlhy(rovnost.state, 1)]).toEqual([dlhy(s, 0), dlhy(s, 1)]);
    const majitel = odohraj(s, [[], [jeho]]);
    expect(majitel.state.pitkaStav?.naexPocet).toEqual([0, 1]);
    expect(majitel.logy.some((t) => t.startsWith("Policajtka"))).toBe(false);
    expect([dlhy(majitel.state, 0), dlhy(majitel.state, 1)]).toEqual([dlhy(s, 0), dlhy(s, 1)]);
  });

  it("0 : 0 a Kostol (NA EX nedá nikto) — Policajtka mlčí", () => {
    for (const lokalita of [undefined, "kostol"]) {
      const s = vPitke(stol(), 0, lokalita === undefined ? {} : { lokalita });
      if (lokalita === "kostol") expect(naexCiele(s, 0)).toEqual([]);
      const { logy } = odohraj(s, [[], []]);
      expect(logy.some((t) => t.startsWith("Policajtka"))).toBe(false);
      expect(logy.some((t) => t.startsWith("Odkryté NA EX"))).toBe(false);
    }
  });

  it("Vínna pivnica 2 : 0 — jeden Dlh, nie za každé NA EX navyše", () => {
    const s = vPitke(stol(), 0, { lokalita: "vinna_pivnica", poldeci: [2, 1], ruka: true });
    const ciele = naexCiele(s, 0).filter((u) => s.strany[0].some((pl) => pl.card.uid === u) || s.strany[1].some((pl) => pl.card.uid === u && pl.card.defId === "pijan"));
    expect(ciele.length).toBeGreaterThanOrEqual(2);
    const { state, logy } = odohraj(s, [[ciele[0]!, ciele[1]!], []]);
    expect(state.pitkaStav?.naexPocet).toEqual([2, 0]);
    expect(dlhy(state, 0) - dlhy(s, 0)).toBe(1);
    expect(logy).toContain("Policajtka: hráč 1 dal v tejto Pitke viac NA EX (2 : 0) — dostáva Dlh.");
  });

  it("placatka sa ráta: bežné NA EX a NA EX na vlastného Anonymného alkoholika (2 : 1) — Dlh", () => {
    const aa = lezi("anonymny_alkoholik", 0);
    const s = vPitke([[lezi("pijan", 0), aa, lezi("pijan", 0)], [lezi("pijan", 1), lezi("pijan", 1), lezi("policajtka", 1)]], 0, { poldeci: [2, 1], ruka: true });
    const bezne = naexCiele(s, 0).find((u) => u !== uid(aa))!;
    const jeho = naexCiele(s, 1).find((u) => s.strany[1].some((pl) => pl.card.uid === u && pl.card.defId === "pijan"))!;
    const { state, logy } = odohraj(s, [[bezne, uid(aa)], [jeho]]);
    expect(state.pitkaStav?.naexPocet).toEqual([2, 1]);
    expect(dlhy(state, 0) - dlhy(s, 0)).toBe(1);
    expect(logy).toContain("Policajtka: hráč 1 dal v tejto Pitke viac NA EX (2 : 1) — dostáva Dlh.");
  });

  it("Praudovravec súpera ju umlčí (Autorita)", () => {
    const s = vPitke([[lezi("pijan", 0), lezi("pijan", 0), lezi("praudovravec", 0)], [lezi("pijan", 1), lezi("pijan", 1), lezi("policajtka", 1)]], 0, { ruka: true });
    const ciel = naexCiele(s, 0).find((u) => s.strany[0].some((pl) => pl.card.uid === u && pl.card.defId === "pijan"))!;
    const { state, logy } = odohraj(s, [[ciel], []]);
    expect(state.pitkaStav?.naexPocet).toEqual([1, 0]);
    expect(logy.some((t) => t.startsWith("Policajtka"))).toBe(false);
    expect(dlhy(state, 0)).toBe(dlhy(s, 0));
  });

  it("Pohoršenia v bitke už neruší (predtým Furt: súperove Pohoršenia neplatia) — ani z patronátu", () => {
    const s0 = vPitke([[lezi("pijan", 0), lezi("pijan", 0)], [lezi("policajtka", 1)]], 0);
    const s: GameState = { ...s0, patronat: [null, { elderId: s0.starsi[0]!.elderId, nahrada: inst("pijan"), pohorsenia: 2 }] };
    const sums = evaluateLine(data, lineState(s)).sums;
    expect(pohorseniaVBitke(data, s, sums)[0]).toBe((sums[0].Pohoršenie ?? 0) + 2);
  });
});

describe("Svokra (Bitka: Rana za každú tvoju kartu so súperovým NA EX)", () => {
  it("ráta majiteľove karty so súperovým NA EX na oboch stranách, aj podstrčené aj Svokru samu; vlastné NA EX nie", () => {
    const strany: GameState["strany"] = [
      [lezi("pijan", 0, { naexBy: 1 }), lezi("pijan", 0, { naexBy: 0 }), lezi("pijan", 1, { naexBy: 1 })],
      [lezi("pijan", 0, { naexBy: 1 }), lezi("svokra", 0, { naexBy: 1 }), lezi("pijan", 1, { naexBy: 0 })],
    ];
    const s = { ...vPitke(strany), faza: "bitka" } as GameState;
    expect(svokraRany(data, s, 0)).toBe(3);
    expect(bitkaMody(data, s, 0).tuheZdroje).toContainEqual({ zdroj: "svokra", tuhe: 3 });
    // Súper Svokru nemá — jeho karta so súperovým NA EX mu nič nedá.
    expect(svokraRany(data, s, 1)).toBe(0);
    const sums = evaluateLine(data, lineState(s)).sums;
    expect(rozpisPoskodenia(data, s, sums, [0, 0])[0].bonusy).toContainEqual({ zdroj: "svokra", hodnota: 3 });
  });

  it("zrážka (Výtržník) sa ráta — na karte leží aj súperov poldeci", () => {
    const s = vPitke([[lezi("pijan", 0, { naexBy: 0, naexBy2: 1, vytrznik: true }), lezi("svokra", 0)], []]);
    expect(svokraRany(data, s, 0)).toBe(1);
  });

  it("v bitke je Rana navyše v tuhom: to isté NA EX od súpera dá o 1 tuhé viac ako vlastné", () => {
    const stol = (kto: PlayerId): GameState => vPitke([[lezi("pijan", 0, { naexBy: kto }), lezi("pijan", 0), lezi("svokra", 0)], []]);
    const tuhe = (s: GameState): number => poskodenieBitky(data, s, evaluateLine(data, lineState(s)).sums, [0, 0]).tuhe[0];
    expect(tuhe(stol(1)) - tuhe(stol(0))).toBe(1);
  });

  it("Praudovravec súpera ju umlčí (Autorita); dve Svokry — Rana od každej", () => {
    const umlcana = vPitke([[lezi("pijan", 0, { naexBy: 1 }), lezi("svokra", 0)], [lezi("praudovravec", 1)]]);
    expect(svokraRany(data, umlcana, 0)).toBe(0);
    const dve = vPitke([[lezi("pijan", 0, { naexBy: 1 }), lezi("svokra", 0), lezi("svokra", 0)], []]);
    expect(svokraRany(data, dve, 0)).toBe(2);
  });

  it("pri odkrytí NA EX už súperovi cigarety neberie", () => {
    const pijan = lezi("pijan", 0);
    const s = vPitke([[pijan, lezi("pijan", 0)], [lezi("svokra", 1)]], 0, { ruka: true });
    const { state, events } = naexOdkryte(data, s, uid(pijan), 0);
    expect(state.pitkaStav?.reakcia).toBe(1);
    expect([state.hraci[0].cigarety, state.hraci[1].cigarety]).toEqual([3, 3]);
    expect(events.some((e) => e.type === "log" && e.text.startsWith("Svokra:"))).toBe(false);
  });

  it("Nástup Svokry NA EX nezakazuje", () => {
    const svokra = inst("svokra");
    const s0 = setupGame(data, 4);
    const s = {
      ...s0,
      faza: "zhromazdenie",
      hraci: [{ ...s0.hraci[0], ruka: [svokra], poldeciPlne: 2, poldeciVypite: 0 }, s0.hraci[1]],
      zhromazdenieStav: { naTahu: 0, zostavaLimit: [3, 3], pasoval: [false, false], navyse: [0, 0] },
    } as GameState;
    const { state, events } = apply(data, s, { type: "place", uid: svokra.uid, target: "vlastna" }, 0);
    expect(events.some((e) => e.type === "log" && e.text.startsWith("Svokra:"))).toBe(false);
    expect("zakazNaex" in state).toBe(false);
  });
});

describe("Anonymný alkoholik (Furt: placatka mimo limitu NA EX)", () => {
  it("súper smie dať NA EX naňho — aj na podstrčeného; do limitu sa mu ráta", () => {
    const aa = lezi("anonymny_alkoholik", 0);
    const s = vPitke([[lezi("pijan", 0), aa, lezi("pijan", 0)], [lezi("pijan", 1), lezi("pijan", 1)]], 1, { poldeci: [1, 2] });
    expect(naexCiele(s, 1)).toContain(uid(aa));
    const po = apply(data, s, { type: "naex", uid: uid(aa) }, 1).state;
    // Súperovi placatka nepatrí — limit 1 je minutý.
    expect(naexCiele(po, 1)).toEqual([]);
    const podstrceny = lezi("anonymny_alkoholik", 0);
    const s2 = vPitke([[], [lezi("pijan", 1), podstrceny, lezi("pijan", 1)]], 1);
    expect(naexCiele(s2, 1)).toContain(uid(podstrceny));
  });

  it("placatka: po bežnom NA EX smie majiteľ dať ešte NA EX na vlastného Anonymného alkoholika — inam už nie", () => {
    const aa = lezi("anonymny_alkoholik", 0);
    const s = vPitke([[lezi("pijan", 0), aa, lezi("pijan", 0)], [lezi("pijan", 1), lezi("pijan", 1)]], 0, { poldeci: [3, 1] });
    const bezne = naexCiele(s, 0).find((u) => u !== uid(aa))!;
    const po = apply(data, s, { type: "naex", uid: bezne }, 0).state;
    expect(naexCiele(po, 0)).toEqual([uid(aa)]);
    const poPlacatke = apply(data, po, { type: "naex", uid: uid(aa) }, 0).state;
    expect(poPlacatke.pitkaStav?.skryteNaex?.filter((x) => x.hrac === 0)).toHaveLength(2);
    expect(naexCiele(poPlacatke, 0)).toEqual([]);
    // Aj naopak: najprv placatka, potom bežné NA EX.
    const najprv = apply(data, s, { type: "naex", uid: uid(aa) }, 0).state;
    expect(naexCiele(najprv, 0)).toContain(bezne);
    expect(() => apply(data, najprv, { type: "naex", uid: bezne }, 0)).not.toThrow();
  });

  it("podstrčený na súperovu stranu je stále majiteľova placatka", () => {
    const aa = lezi("anonymny_alkoholik", 0);
    const s = vPitke([[lezi("pijan", 0), lezi("pijan", 0)], [lezi("pijan", 1), aa, lezi("pijan", 1)]], 0, { poldeci: [2, 1] });
    const bezne = naexCiele(s, 0).find((u) => u !== uid(aa))!;
    const po = apply(data, s, { type: "naex", uid: bezne }, 0).state;
    expect(naexCiele(po, 0)).toEqual([uid(aa)]);
  });

  it("na Anonymného alkoholika s poldeci ďalšie NA EX nejde — placatka najviac raz za kolo", () => {
    const aa = lezi("anonymny_alkoholik", 0, { naexBy: 0 });
    const s = vPitke([[lezi("pijan", 0), aa, lezi("pijan", 0)], [lezi("pijan", 1), lezi("pijan", 1)]], 0, { poldeci: [2, 1] });
    expect(naexCiele(s, 0)).not.toContain(uid(aa));
    const bezne = naexCiele(s, 0)[0]!;
    expect(naexCiele(apply(data, s, { type: "naex", uid: bezne }, 0).state, 0)).toEqual([]);
  });

  it("bez plného poldeci placatka nejde", () => {
    const aa = lezi("anonymny_alkoholik", 0);
    const s = vPitke([[lezi("pijan", 0), aa, lezi("pijan", 0)], []], 0, { poldeci: [1, 1] });
    const bezne = naexCiele(s, 0).find((u) => u !== uid(aa))!;
    const po = apply(data, s, { type: "naex", uid: bezne }, 0).state;
    expect(naexCiele(po, 0)).toEqual([]);
    expect(() => apply(data, po, { type: "naex", uid: uid(aa) }, 0)).toThrow();
  });

  it("Kostol: zákaz NA EX platí aj pre placatku", () => {
    const aa = lezi("anonymny_alkoholik", 0);
    const s = vPitke([[lezi("pijan", 0), aa, lezi("pijan", 0)], []], 0, { lokalita: "kostol", poldeci: [2, 1] });
    expect(naexCiele(s, 0)).toEqual([]);
    expect(() => apply(data, s, { type: "naex", uid: uid(aa) }, 0)).toThrow(/Kostol/);
  });

  it("Krčma: povinné NA EX splní aj placatka; po bežnom NA EX placatka povinná nie je", () => {
    const aa = lezi("anonymny_alkoholik", 0);
    const s = vPitke([[lezi("pijan", 0), aa, lezi("pijan", 0)], [lezi("pijan", 1), lezi("pijan", 1)]], 0, { lokalita: "krcma", poldeci: [3, 1] });
    expect(krcmaVyzaduje(data, s, 0)).toBe(true);
    const poPlacatke = apply(data, s, { type: "naex", uid: uid(aa) }, 0).state;
    expect(krcmaVyzaduje(data, poPlacatke, 0)).toBe(false);
    expect(legalCommands(data, poPlacatke, 0)).toContainEqual({ type: "skipNaex" });
    // Bežné NA EX ešte smie, len nemusí.
    expect(naexCiele(poPlacatke, 0).length).toBeGreaterThan(0);
    const bezne = naexCiele(s, 0).find((u) => u !== uid(aa))!;
    const poBeznom = apply(data, s, { type: "naex", uid: bezne }, 0).state;
    expect(krcmaVyzaduje(data, poBeznom, 0)).toBe(false);
    expect(naexCiele(poBeznom, 0)).toEqual([uid(aa)]);
    expect(() => apply(data, poBeznom, { type: "skipNaex" }, 0)).not.toThrow();
  });

  it("Vínna pivnica: dve bežné NA EX a k tomu placatka", () => {
    const aa = lezi("anonymny_alkoholik", 0);
    const s = vPitke([[lezi("pijan", 0), aa, lezi("pijan", 0)], [lezi("pijan", 1), lezi("pijan", 1)]], 0, { lokalita: "vinna_pivnica", poldeci: [3, 1] });
    const bezne = naexCiele(s, 0).filter((u) => u !== uid(aa));
    expect(bezne.length).toBeGreaterThanOrEqual(2);
    let t = apply(data, s, { type: "naex", uid: bezne[0]! }, 0).state;
    t = apply(data, t, { type: "naex", uid: naexCiele(t, 0).find((u) => u !== uid(aa))! }, 0).state;
    expect(naexCiele(t, 0)).toEqual([uid(aa)]);
    t = apply(data, t, { type: "naex", uid: uid(aa) }, 0).state;
    expect(t.pitkaStav?.skryteNaex?.filter((x) => x.hrac === 0)).toHaveLength(3);
  });

  it("po odkrytí: placatka sa ráta do počtu NA EX Pitky (Policajtka), limit nemíňa", () => {
    const aa = lezi("anonymny_alkoholik", 0);
    const s = vPitke([[lezi("pijan", 0), aa, lezi("pijan", 0)], [lezi("pijan", 1), lezi("pijan", 1)]], 0, { poldeci: [2, 1], ruka: true });
    const { state } = odohraj(s, [[uid(aa)], []]);
    expect(state.pitkaStav?.reakcia).toBe(1);
    expect(state.pitkaStav?.naexPocet).toEqual([1, 0]);
    expect(state.pitkaStav?.naexPouzity).toEqual([false, false]);
  });
});

describe("Liberál", () => {
  it("NA EX naň smie (Michal 2026-10-26 zrušil vetu „Na Liberála NA EX dať nemožno“)", () => {
    const liberal = lezi("liberal", 0);
    const s = vPitke([[lezi("pijan", 0), liberal, lezi("pijan", 0)], []], 1);
    expect(naexCiele(s, 1)).toContain(uid(liberal));
    expect(() => apply(data, s, { type: "naex", uid: uid(liberal) }, 1)).not.toThrow();
  });
});

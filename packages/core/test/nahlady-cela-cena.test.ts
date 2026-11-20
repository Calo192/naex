// Celá cena NA EX a patronátu v náhľade (návrh #1, playtest 20261024-075830):
// cigarety a mäkké (hádka v10), ktoré náhľad sľúbi, musí hra naozaj zúčtovať —
// rátajú ich tie isté funkcie (cigaretyZPitky, poskodenieBitky).

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { CardInstance, ClientState, Event, GameState, PlacedCard, PlayerId } from "../src/index.ts";
import {
  apply,
  buildGameData,
  mozeHrat,
  rngInt,
  rngSeed,
  tahBota,
  dopadyNahladu,
  loadGameData,
  moznostiNaex,
  naTahu,
  nahladNaexNaKartu,
  parseScorecards,
  poskodenieBitky,
  viewFor,
} from "../src/index.ts";
import type { Layout4 } from "./helpers.ts";
import { instanceFor, makeDef, zPolohy } from "./helpers.ts";
import { setupSBalickom } from "./helpers.ts";

const zaklad = loadGameData(cardsJson, eldersJson, scorecardsJson);
const C4: Layout4 = ["Cigareta", "Cigareta", "Cigareta", "Cigareta"];
const P4: Layout4 = ["Pohoršenie", "Pohoršenie", "Pohoršenie", "Pohoršenie"];
const V4: Layout4 = ["Povera", "Povera", "Povera", "Povera"];
const fajciar = makeDef("fajciar_test", C4, C4, { tags: ["Občan"] });
const pohorsujuci = makeDef("pohorsujuci_test", P4, P4, { tags: ["Občan"] });
const poverciva = makeDef("poverciva_test", V4, V4, { tags: ["Občan"] });
const PL2: Layout4 = ["Poldeci", null, "Poldeci", null];
const RB2: Layout4 = ["Robota", null, "Robota", null];
const dolievac = makeDef("dolievac_test", PL2, PL2, { tags: ["Občan"] });
const robotnik = makeDef("robotnik_test", RB2, RB2, { tags: ["Občan"] });
const cards = new Map(zaklad.cards);
for (const d of [fajciar, pohorsujuci, poverciva, dolievac, robotnik]) cards.set(d.id, d);
const data = buildGameData(cards, zaklad.elders, parseScorecards(scorecardsJson));

const lezi = (card: CardInstance, playedBy: PlayerId): PlacedCard => ({ card, playedBy });

/** Posledná Pitka kola, obaja s plným poldeci a bez kariet v ruke (na NA EX sa neodpovedá). */
function vPitke(strana0: readonly PlacedCard[]): GameState {
  const s0 = setupSBalickom(data, 41);
  return {
    ...s0,
    faza: "pitka",
    pitkyCelkom: 1,
    pitkaCislo: 1,
    strany: [strana0, []],
    hraci: [
      { ...s0.hraci[0], ruka: [], poldeciPlne: 1 },
      // Priznané Dlhy hráča 1 = strop pre mäkké hráča 0.
      { ...s0.hraci[1], ruka: [], poldeciPlne: 1, dlhy: 3 },
    ],
    pitkaStav: {
      naTahu: s0.utocnik === 0 ? 1 : 0,
      hotovy: [false, false],
      naexPouzity: [false, false],
      fajcenie: [0, 0],
      reakcia: null,
      postarka: [false, false],
      starosta: [false, false],
    },
  };
}

/** Dohrá Pitku bez ďalšieho NA EX; vráti stav a cigarety zo zúčtovania Pitky. */
function dohraj(s: GameState): { readonly t: GameState; readonly cigarety: readonly [number, number] } {
  let t = s;
  const events: Event[] = [];
  for (let i = 0; i < 4 && t.faza === "pitka"; i++) {
    const r = apply(data, t, { type: "skipNaex" }, naTahu(t)!);
    events.push(...r.events);
    t = r.state;
  }
  expect(t.faza).not.toBe("pitka");
  const vysledok = events.find((e) => e.type === "pitkaVysledok");
  if (vysledok?.type !== "pitkaVysledok") throw new Error("Pitka sa nevyhodnotila.");
  return { t, cigarety: vysledok.cigarety };
}

/** Hráč p dá NA EX na uid (súper najprv skončí, ak je na ťahu on). */
function naex(s: GameState, p: PlayerId, uid: number): GameState {
  let t = s;
  if (naTahu(t) !== p) t = apply(data, t, { type: "skipNaex" }, naTahu(t)!).state;
  return apply(data, t, { type: "naex", uid }, p).state;
}

/** Karty, na ktoré hráč 1 smie dať NA EX — aspoň jedna, inak test nič neoverí. */
function ciele(s: GameState): number[] {
  const out = moznostiNaex(data, s, 1);
  expect(out.length).toBeGreaterThan(0);
  return out;
}

/** Pohľad hráča p po zamýšľanom NA EX — tak ho skladá klient. */
function poNaex(pred: ClientState, p: PlayerId, uid: number): ClientState {
  const strany: ClientState["strany"] = [
    pred.strany[0].map((pl) => (pl.card.uid === uid ? { ...pl, naexBy: p } : pl)),
    pred.strany[1].map((pl) => (pl.card.uid === uid ? { ...pl, naexBy: p } : pl)),
  ];
  const h = pred.hraci;
  const hraci: ClientState["hraci"] = p === 0 ? [{ ...h[0], pecen: h[0].pecen + 1 }, h[1]] : [h[0], { ...h[1], pecen: h[1].pecen + 1 }];
  return { ...pred, strany, hraci };
}

/** Mäkké, s ktorým bitka vstúpi do hádky (v10) — z hádky, alebo tým istým výpočtom pred ňou. */
const makkeBitky = (t: GameState): readonly [number, number] => {
  const b = t.bitkaStav;
  if (b === null) throw new Error("Bitka nezačala.");
  return b.hadka?.makke ?? poskodenieBitky(data, t, b.sums).makke;
};

describe("náhľad NA EX: cigarety a mäkké sedia so zúčtovaním", () => {
  it("cigarety: o koľko viac či menej dostane súper v Pitke", () => {
    const s = vPitke([
      lezi(instanceFor(data, "fajciar_test", C4, C4), 0),
      lezi(instanceFor(data, "fajciar_test", C4, C4), 0),
      lezi(instanceFor(data, "fajciar_test", C4, C4), 0),
    ]);
    const p: PlayerId = 1;
    const bez = dohraj(s).cigarety;
    let zmeny = 0;
    for (const uid of ciele(s)) {
      const pred = viewFor(data, s, p);
      const [d0, d1] = dopadyNahladu(data, pred, poNaex(pred, p, uid), 0);
      const s_ = dohraj(naex(s, p, uid)).cigarety;
      expect(d0.cigarety).toBe(s_[0] - bez[0]);
      expect(d1.cigarety).toBe(s_[1] - bez[1]);
      if (d0.cigarety !== 0) zmeny++;
    }
    expect(zmeny).toBeGreaterThan(0);
  });

  it("cigarety: NA EX ležiaci do bitky platí v každej ďalšej Pitke kola", () => {
    const s = vPitke([lezi(instanceFor(data, "fajciar_test", C4, C4), 0), lezi(instanceFor(data, "fajciar_test", C4, C4), 0)]);
    const pred = viewFor(data, s, 1);
    const uid = ciele(s)[0]!;
    const [jedna] = dopadyNahladu(data, pred, poNaex(pred, 1, uid), 0);
    const [tri] = dopadyNahladu(data, pred, poNaex(pred, 1, uid), 2);
    expect(tri.cigarety).toBe(jedna.cigarety * 3);
  });

  it("mäkké (v10): o koľko viac mäkkého súper vnesie do hádky — Pohoršenie za 2", () => {
    const s = vPitke([
      lezi(instanceFor(data, "pohorsujuci_test", P4, P4), 0),
      lezi(instanceFor(data, "pohorsujuci_test", P4, P4), 0),
      lezi(instanceFor(data, "pohorsujuci_test", P4, P4), 0),
    ]);
    const p: PlayerId = 1;
    const bez = makkeBitky(dohraj(s).t);
    let zmeny = 0;
    for (const uid of ciele(s)) {
      const pred = viewFor(data, s, p);
      const po = poNaex(pred, p, uid);
      const [d0] = dopadyNahladu(data, pred, po, 0);
      const sNaex = makkeBitky(dohraj(naex(s, p, uid)).t);
      expect(d0.makke).toBe(sNaex[0] - bez[0]);
      expect(d0.makkeSpolu).toBe(sNaex[0]);
      expect(d0.makke % 2).toBe(0);
      if (d0.makke !== 0) zmeny++;
    }
    expect(zmeny).toBeGreaterThan(0);
  });

});

// Náhľad pokusu o zajatie (v9–v11.3) zanikol s pokusom (v11.4).

describe("náhľad NA EX nemlčí o tom, čo hra zúčtuje navyše (návrh #49)", () => {
  const karta = (uid: number, defId: string): CardInstance => ({ uid, defId, leftLayout: 0, rightLayout: 0 });
  const ceny = [
    { cirhoza: -1, dlh: -1 },
    { cirhoza: -1, dlh: -1 },
  ] as const;

  /** Dohrá Pitku bez ďalšieho NA EX a vráti stav a všetky záznamy logu. */
  function sLogom(s: GameState): { readonly t: GameState; readonly log: string[] } {
    let t = s;
    const log: string[] = [];
    for (let i = 0; i < 6 && t.faza === "pitka"; i++) {
      const r = apply(data, t, { type: "skipNaex" }, naTahu(t)!);
      for (const e of r.events) if (e.type === "log") log.push(e.text);
      t = r.state;
    }
    return { t, log };
  }

  it("Policajtka (Michal 2026-10-26) súperove Pohoršenia neruší — bitka ich pridelí, ako sľúbil náhľad", () => {
    const s0 = vPitke([
      lezi(instanceFor(data, "pohorsujuci_test", P4, P4), 0),
      lezi(instanceFor(data, "pohorsujuci_test", P4, P4), 0),
      lezi(instanceFor(data, "pohorsujuci_test", P4, P4), 0),
    ]);
    const s: GameState = { ...s0, strany: [s0.strany[0], [lezi(karta(940001, "policajtka"), 1)]] };
    const bez = sLogom(s);
    const spolu = (t: GameState): number => (t.bitkaStav === null ? 0 : makkeBitky(t)[0]);
    expect(spolu(bez.t)).toBeGreaterThan(0);
    // 0 : 0 NA EX — Policajtka mlčí.
    expect(bez.log.some((x) => x.startsWith("Policajtka:"))).toBe(false);
    for (const uid of ciele(s).filter((u) => u !== 940001)) {
      const n = nahladNaexNaKartu(data, viewFor(data, s, 1), uid, ceny)!;
      const { t } = sLogom(naex(s, 1, uid));
      expect(n.dopady[0].makke).toBe(spolu(t) - spolu(bez.t));
      expect(n.dopady[0].makkeSpolu).toBe(spolu(t));
    }
  });



});

// Playtest 20261117-140948, nezrovnalosť 4 (Vilo): NA EX na kartu s neaktívnymi Poldeci či Robotou ich zdvojí —
// doliatie po Pitke (od v12.6 posledné slovo) a špaky z Roboty sa v náhľade neukázali, hoci ich hra zúčtovala.
describe("náhľad NA EX: doliatie po Pitke a Robota sedia s motorom", () => {
  const ceny = [
    { cirhoza: 3, dlh: 1 },
    { cirhoza: 3, dlh: 1 },
  ] as const;

  /** Posledná Pitka kola s kartou hráča 0 na konci línie; vypitých poldeci dosť, aby doliatie nič nestropovalo. */
  function stol(defId: string, layout: Layout4, pitkyCelkom: number): GameState {
    const s = vPitke([lezi(instanceFor(data, "pohorsujuci_test", P4, P4), 0), lezi(instanceFor(data, defId, layout, layout), 0)]);
    return {
      ...s,
      pitkyCelkom,
      hraci: [
        { ...s.hraci[0], poldeciPlne: 0, poldeciVypite: 6, dlhy: 0 },
        { ...s.hraci[1], poldeciVypite: 2, dlhy: 0 },
      ],
    };
  }

  // Finále: po ňom sa poldeci neobnovia (§9.5), doliatie po poslednej Pitke ide do výkupného — rovnako ako pred
  // ďalším Zhromaždením; motor ho ráta tým istým doliatiePoPitke.
  it("doliatie: o koľko poldeci viac či menej sa po Pitke doleje (finále, pred výkupným)", () => {
    const s: GameState = { ...stol("dolievac_test", PL2, 1), ciel: { typ: "finale", lokalita: { uid: 990001, defId: "polovnicka_chata", leftLayout: 0, rightLayout: 0 } } };
    /** Doliatie oboch hráčov podľa motora (zmenaPoldeci zo zdrojov doliatia), keď Pitku dohrajú bez ďalšieho NA EX. */
    const doliatie = (t0: GameState): readonly [number, number] => {
      let t = t0;
      const out: [number, number] = [0, 0];
      for (let i = 0; i < 4 && t.faza === "pitka"; i++) {
        const r = apply(data, t, { type: "skipNaex" }, naTahu(t)!);
        for (const e of r.events) {
          const m = e.type === "log" ? /^Hráčovi (\d) sa po Pitke dolieva (\d+)/u.exec(e.text) : null;
          if (m !== null) out[Number(m[1]) - 1 as PlayerId] += Number(m[2]);
        }
        t = r.state;
      }
      return out;
    };
    const bez = doliatie(s);
    let zmeny = 0;
    for (const uid of ciele(s)) {
      const n = nahladNaexNaKartu(data, viewFor(data, s, 1), uid, ceny)!;
      const t = doliatie(naex(s, 1, uid));
      for (const p of [0, 1] as const) expect(n.dopady[p].doliatie, `uid ${uid}, hráč ${p}`).toBe(t[p] - bez[p]);
      if (n.dopady[0].doliatie !== 0) zmeny++;
    }
    expect(zmeny).toBeGreaterThan(0);
  });

  it("doliatie po poslednej Pitke kola mimo finále náhľad nehlási — bitka obnoví všetky poldeci", () => {
    const s = stol("dolievac_test", PL2, 1);
    for (const uid of ciele(s)) expect(nahladNaexNaKartu(data, viewFor(data, s, 1), uid, ceny)!.dopady.map((d) => d.doliatie)).toEqual([0, 0]);
  });

  it("Robota: špaky za Dlhy, ktoré nemá čo spáliť, ako ich bitka zúčtuje", () => {
    const s = { ...stol("robotnik_test", RB2, 1), ciel: { typ: "lokalita" as const, lokalita: null } };
    /** Dohrá Pitku a bitku botmi (ruky sú prázdne, líniu nezmenia) — špaky z Roboty hráča 0 podľa logu motora. */
    const robota = (t0: GameState): number => {
      let t = t0;
      let rng = rngSeed(7);
      let spaky: number | null = null;
      for (let i = 0; i < 300 && t.koniec === null && spaky === null; i++) {
        const p = ([0, 1] as const).find((q) => mozeHrat(t, q)) ?? naTahu(t);
        if (p === null) break;
        const [seed, r] = rngInt(rng, 2 ** 31);
        rng = r;
        const vysledok = apply(data, t, t.faza === "pitka" ? { type: "skipNaex" } : tahBota(data, t, p, seed), p);
        for (const e of vysledok.events) {
          const m = e.type === "log" ? /^Robota: hráč 1 nemá čo spáliť — dostáva (\d+)/u.exec(e.text) : null;
          if (m !== null) spaky = Number(m[1]);
          if (e.type === "log" && e.text.startsWith("Robota: hráč 1 páli")) spaky ??= 0;
        }
        t = vysledok.state;
        if (t.faza !== "bitka" && t.faza !== "pitka") spaky ??= 0;
      }
      return spaky ?? 0;
    };
    const bez = robota(s);
    let zmeny = 0;
    for (const uid of ciele(s)) {
      const n = nahladNaexNaKartu(data, viewFor(data, s, 1), uid, ceny)!;
      expect(n.dopady[0].robota, `uid ${uid}`).toBe(robota(naex(s, 1, uid)) - bez);
      if (n.dopady[0].robota !== 0) zmeny++;
    }
    expect(zmeny).toBeGreaterThan(0);
  });
});

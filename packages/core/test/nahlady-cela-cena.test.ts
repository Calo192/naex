// Celá cena NA EX a patronátu v náhľade (návrh #1, playtest 20261024-075830):
// cigarety, Pohoršenia a mäkké, ktoré náhľad sľúbi, musí hra naozaj zúčtovať —
// rátajú ich tie isté funkcie (cigaretyZPitky, pohorseniaVBitke).

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { CardInstance, ClientState, Event, GameState, MarkerPos, PlacedCard, PlayerId } from "../src/index.ts";
import {
  apply,
  battleOutcome,
  buildGameData,
  cenaPrebytku,
  cenaPatronatu,
  dopadyNahladu,
  evaluateLine,
  hodnotaPohorseni,
  lineState,
  loadGameData,
  moznostiNaex,
  naTahu,
  nahladNaexNaKartu,
  parseScorecards,
  pohorseniaVBitke,
  poskodenieBitky,
  prebytokNahladu,
  prebytokNaRozdelenie,
  setupGame,
  stavPoPatronate,
  sNaexNaKartach,
  viewFor,
} from "../src/index.ts";
import type { Layout4 } from "./helpers.ts";
import { instanceFor, makeDef } from "./helpers.ts";
import { setupSBalickom } from "./helpers.ts";

const zaklad = loadGameData(cardsJson, eldersJson, scorecardsJson);
const C4: Layout4 = ["Cigareta", "Cigareta", "Cigareta", "Cigareta"];
const P4: Layout4 = ["Pohoršenie", "Pohoršenie", "Pohoršenie", "Pohoršenie"];
const V4: Layout4 = ["Povera", "Povera", "Povera", "Povera"];
const fajciar = makeDef("fajciar_test", C4, C4, { tags: ["Občan"] });
const pohorsujuci = makeDef("pohorsujuci_test", P4, P4, { tags: ["Občan"] });
const poverciva = makeDef("poverciva_test", V4, V4, { tags: ["Občan"] });
const cards = new Map(zaklad.cards);
for (const d of [fajciar, pohorsujuci, poverciva]) cards.set(d.id, d);
const data = buildGameData(cards, zaklad.elders, parseScorecards(scorecardsJson));

const lezi = (card: CardInstance, playedBy: PlayerId): PlacedCard => ({ card, playedBy });
const dlh = (uid: number): CardInstance => ({ uid, defId: "dlh", leftLayout: 0, rightLayout: 0 });

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
      { ...s0.hraci[1], ruka: [], poldeciPlne: 1, priznane: [dlh(920001), dlh(920002), dlh(920003)] },
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

/** Pohoršenia, ktoré bitka hráčom pridelí — prvý stav bitky, ktorý ich už nastavil. */
const pohorseniaBitky = (t: GameState): readonly [number, number] => {
  const b = t.bitkaStav;
  if (b === null) throw new Error("Bitka nezačala.");
  return b.pohorsenieZostava;
};

describe("náhľad NA EX: cigarety, Pohoršenia a mäkké sedia so zúčtovaním", () => {
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

  it("Pohoršenia: o koľko posunov viac súper dostane v bitke a ≈ body z nich", () => {
    const s = vPitke([
      lezi(instanceFor(data, "pohorsujuci_test", P4, P4), 0),
      lezi(instanceFor(data, "pohorsujuci_test", P4, P4), 0),
      lezi(instanceFor(data, "pohorsujuci_test", P4, P4), 0),
    ]);
    const p: PlayerId = 1;
    const bez = pohorseniaBitky(dohraj(s).t);
    let zmeny = 0;
    for (const uid of ciele(s)) {
      const pred = viewFor(data, s, p);
      const po = poNaex(pred, p, uid);
      const [d0] = dopadyNahladu(data, pred, po, 0);
      const sNaex = pohorseniaBitky(dohraj(naex(s, p, uid)).t);
      expect(d0.pohorsenia).toBe(sNaex[0] - bez[0]);
      expect(d0.pohorseniaSpolu).toBe(sNaex[0]);
      expect(d0.pohorseniaBody).toBe(hodnotaPohorseni(data, po, 0, sNaex[0]) - hodnotaPohorseni(data, pred, 0, bez[0]));
      if (d0.pohorsenia !== 0) zmeny++;
    }
    expect(zmeny).toBeGreaterThan(0);
  });

  it("mäkké: zmena Povier pod stropom súperových priznaných Dlhov", () => {
    const s0 = vPitke([
      lezi(instanceFor(data, "poverciva_test", V4, V4), 0),
      lezi(instanceFor(data, "poverciva_test", V4, V4), 0),
      lezi(instanceFor(data, "poverciva_test", V4, V4), 0),
    ]);
    // Strop mäkkého vysoko, aby NA EX mäkké naozaj zmenilo.
    const s: GameState = { ...s0, hraci: [s0.hraci[0], { ...s0.hraci[1], priznane: Array.from({ length: 20 }, (_, i) => dlh(921000 + i)) }] };
    const p: PlayerId = 1;
    let zmeny = 0;
    for (const uid of ciele(s)) {
      const pred = viewFor(data, s, p);
      const [d0] = dopadyNahladu(data, pred, poNaex(pred, p, uid), 0);
      // NA EX naraz (v5): skryté NA EX sa do línie dostane až pri odkrytí.
      const t = sNaexNaKartach(naex(s, p, uid));
      // Bitka ráta poškodenie poskodenieBitky (vyhodnotPoskodenie).
      const makke = (x: GameState): number => poskodenieBitky(data, x, evaluateLine(data, lineState(x)).sums, [0, 0]).makke[0];
      expect(d0.makke).toBe(makke(t) - makke(s));
      if (d0.makke !== 0) zmeny++;
    }
    expect(zmeny).toBeGreaterThan(0);
  });
});

describe("náhľad patronátu: cigarety a Pohoršenia súpera", () => {
  /** Krok patronátu: útočník u, starší[0] mu prejavuje priazeň v oranžovej zóne. */
  function vPatronate(): { s: GameState; u: PlayerId; obcan: CardInstance } {
    const s0 = setupSBalickom(data, 31);
    const u = s0.utocnik;
    const obcan: CardInstance = { uid: 930001, defId: "pijan", leftLayout: 0, rightLayout: 0 };
    const marker = (u === 0 ? 1 : 5) as MarkerPos;
    const pijan = (uid: number): CardInstance => ({ uid, defId: "pijan", leftLayout: 0, rightLayout: 0 });
    const hraci = s0.hraci.map((h, i) =>
      i === u
        ? { ...h, ruka: [obcan], cigarety: 3, doberaci: [...h.doberaci, pijan(930011), pijan(930012), pijan(930013)] }
        : { ...h, ruka: [pijan(930002)], doberaci: [...h.doberaci, pijan(930021), pijan(930022), pijan(930023)] },
    ) as unknown as GameState["hraci"];
    const s: GameState = {
      ...s0,
      faza: "draft",
      ciel: { typ: "lokalita", lokalita: s0.lokalityVHre[0]! },
      lokalityVHre: s0.lokalityVHre.slice(1),
      starsi: s0.starsi.map((e, i) => (i === 0 ? { ...e, marker} : e)),
      hraci,
      draftStav: { krok: "patronat", balicky: [[], []], vyber: [null, null], naTahu: u, hotovo: [false, false], noveKarty: [0, 0] },
    };
    return { s, u, obcan };
  }

  it("patrón zaplatí cigarety, súper dostane Pohoršenia ako v hre", () => {
    const { s, u, obcan } = vPatronate();
    const su: PlayerId = u === 0 ? 1 : 0;
    const elder = s.starsi[0]!;
    const cena = cenaPatronatu(elder);
    const pred = viewFor(data, s, u);
    const po = stavPoPatronate(pred, elder.elderId);
    const d = dopadyNahladu(data, pred, po, 0);
    const t = apply(data, s, { type: "patronat", elderId: elder.elderId, uid: obcan.uid }, u).state;

    expect(d[u].cigarety).toBe(t.hraci[u].cigarety - s.hraci[u].cigarety);
    expect(d[u].cigarety).toBe(-cena.cigarety);
    // Bitka pridelí Pohoršenia tým istým výpočtom (nastavSumy → pohorseniaVBitke).
    const sums = evaluateLine(data, lineState(t)).sums;
    expect(d[su].pohorsenia).toBe(pohorseniaVBitke(data, t, sums)[su] - pohorseniaVBitke(data, s, sums)[su]);
    expect(d[su].pohorsenia).toBe(cena.pohorsenia);
    // Súper nimi strach vráti — pre neho kladné body, nie viac než bez obmedzení zón.
    expect(d[su].pohorseniaBody).toBe(hodnotaPohorseni(data, po, su, cena.pohorsenia));
    expect(d[su].pohorseniaBody).toBeGreaterThan(0);
    expect(d[u].makke).toBe(0);
  });
});

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
    const spolu = (t: GameState): number => t.bitkaStav?.pohorseniaSpolu?.[0] ?? 0;
    expect(spolu(bez.t)).toBeGreaterThan(0);
    // 0 : 0 NA EX — Policajtka mlčí.
    expect(bez.log.some((x) => x.startsWith("Policajtka:"))).toBe(false);
    for (const uid of ciele(s).filter((u) => u !== 940001)) {
      const n = nahladNaexNaKartu(data, viewFor(data, s, 1), uid, ceny)!;
      const { t } = sLogom(naex(s, 1, uid));
      expect(n.dopady[0].pohorsenia).toBe(spolu(t) - spolu(bez.t));
      expect(n.dopady[0].pohorseniaSpolu).toBe(spolu(t));
    }
  });

  it("Vychovávateľka: priznaný Dlh odíde súperovi — náhľad aj Dlhy po bitke s tým rátajú", () => {
    const s0 = vPitke([lezi(instanceFor(data, "fajciar_test", C4, C4), 0), lezi(instanceFor(data, "fajciar_test", C4, C4), 0)]);
    const s: GameState = { ...s0, strany: [s0.strany[0], [lezi(karta(940002, "vychovavatelka"), 1)]] };
    const uid = ciele(s).find((u) => u !== 940002)!;
    const n = nahladNaexNaKartu(data, viewFor(data, s, 1), uid, ceny)!;
    expect(n.odkrytie.vychovavatelka).toBe(true);
    const { t } = sLogom(naex(s, 1, uid));
    const dlhy = (x: GameState): number => x.hraci[1].priznane.filter((k) => k.defId === "dlh").length;
    expect(n.odkrytie.view.hraci[1].priznane.filter((k) => k.defId === "dlh").length).toBe(dlhy(t));
    expect(n.kliatby[1].dlhyPoBitke).toBe(dlhy(t) - dlhy(sLogom(s).t));
  });

  it("Krčmárka: NA EX v kole ju pripraví o otočený poldeci — náhľad to povie", () => {
    const s0 = vPitke([lezi(instanceFor(data, "fajciar_test", C4, C4), 0), lezi(instanceFor(data, "fajciar_test", C4, C4), 0)]);
    const s: GameState = {
      ...s0,
      strany: [s0.strany[0], [lezi(karta(940003, "krcmarka"), 1)]],
      hraci: [s0.hraci[0], { ...s0.hraci[1], poldeciVypite: 1 }],
    };
    const uid = ciele(s).find((u) => u !== 940003)!;
    const n = nahladNaexNaKartu(data, viewFor(data, s, 1), uid, ceny)!;
    expect(n.odkrytie.krcmarka).toBe(true);
    expect(sLogom(s).log.some((x) => x.startsWith("Krčmárka:"))).toBe(true);
    expect(sLogom(naex(s, 1, uid)).log.some((x) => x.startsWith("Krčmárka:"))).toBe(false);
  });

  it("Puška a Miňištrant: prebytok na rozdelenie a cena posunu ako v bitke", () => {
    const s0 = vPitke([lezi(karta(940004, "ministrant"), 0)]);
    const s: GameState = { ...s0, hraci: [s0.hraci[0], { ...s0.hraci[1], dedicstvo: [karta(940005, "puska")] }] };
    const v = viewFor(data, s, 0);
    const damage = { tuhe: [6, 1], makke: [0, 0], celkove: [6, 1], zvysnaViera: [0, 0], zvysnaPovera: [0, 0] } as const;
    const pr = prebytokNahladu(v, damage);
    expect(pr.drzi).toBe(0);
    expect(pr.prebytok).toBe(5);
    expect(pr.naRozdelenie).toBe(prebytokNaRozdelenie(s, battleOutcome(damage)));
    expect(pr.naRozdelenie).toBe(3);
    expect(pr.cenaPosunu).toBe(cenaPrebytku(s, 0));
    expect(pr.cenaPosunu).toBe(2);
    expect(pr.posuny).toBe(1);
    // Prebytok bez výhry v tuhom (remíza) Miňištrant nezdražie.
    expect(prebytokNahladu(v, { ...damage, tuhe: [1, 1], makke: [5, 0] }).cenaPosunu).toBe(1);
  });
});

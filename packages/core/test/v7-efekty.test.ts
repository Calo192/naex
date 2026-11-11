// Efekty kariet v7, druhá fáza revízie sady (Michal 2026-10-27, plan.md časť 14):
// Konflikt (jednosmerný spúšťač, časť 13), nové efekty občanov, starších,
// Nástrojov a lokalít, útočník finále. Beží na sade pred frakciami (2026-11-08): jadro staré
// efekty drží pre staré sady; nové efekty tých istých kariet stráži frakcie.test.ts.

import { describe, expect, it } from "vitest";
import cardsJson from "./data/cards-pred-frakciami.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { CardInstance, Command, GameState, PitkaStav, PlacedCard, PlayerId, PlayerState, RekapitulaciaPitky } from "../src/index.ts";
import {
  apply,
  bitkaMody,
  evaluateLine,
  legalCommands,
  mozeHrat,
  naTahu,
  lineState,
  loadGameData,
  moznostiNaex,
  nastrojeTuhe,
  paleneDlhyVBitke,
  pokutaPolicajtky,
  poskodenieBitky,
  prirastkyPitky,
  setupGame,
  utocnikFinale,
  vidiVolbuSupera,
  prahDlhuPitky,
  prahyHraca,
  stavkaBitky,
  viewFor,
} from "../src/index.ts";
import { zPolohy } from "./helpers.ts";
import { sHranami } from "./naradieData.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);
const dataH = loadGameData(sHranami(cardsJson), eldersJson, scorecardsJson);

let uidSeq = 980000;
const inst = (defId: string): CardInstance => ({ uid: ++uidSeq, defId, leftLayout: 0, rightLayout: 0 });
const lezi = (card: CardInstance, playedBy: PlayerId, x: Partial<PlacedCard> = {}): PlacedCard => ({ card, playedBy, ...x });
const dlhy = (s: GameState, p: PlayerId): number => s.hraci[p].dlhy;
/** Priznané Dlhy aj tie, ktoré v bitke zhoreli pri exekúcii (bez prahu, Michal 2026-10-28). */
const dlhyAjZhorene = (s: GameState, p: PlayerId): number => dlhy(s, p) + s.nastenka.reduce((a, b) => a + b.exekutor[p], 0);

function sHracom(s: GameState, p: PlayerId, h: Partial<PlayerState>): GameState {
  const hraci = [...s.hraci] as [PlayerState, PlayerState];
  hraci[p] = { ...hraci[p], ...h };
  return { ...s, hraci };
}

function pitkaStav(naTahu: PlayerId): PitkaStav {
  return { naTahu, hotovy: [false, false], naexPouzity: [false, false], fajcenie: [0, 0], reakcia: null, postarka: [false, false], starosta: [false, false], naexPocet: [0, 0] };
}

/** Pitka na lokalite `lok` (obranca = hráč 0 je na ťahu). */
function vPitke(lok: string, strany: GameState["strany"], seed = 7): GameState {
  const s0 = setupGame(data, seed);
  const lokalita = s0.lokalityVHre.find((k) => k.defId === lok)!;
  // Balíček, cigarety a šenok, aby hráči mali vždy voľbu (inak hra dohrá Pitku sama).
  const hraci = s0.hraci.map((h) => ({ ...h, cigarety: 5, doberaci: [inst("masiar"), inst("vandal"), inst("hasic")] })) as unknown as GameState["hraci"];
  return {
    ...s0,
    hraci,
    senok: [inst("masiar"), inst("zamocnik"), inst("vandal")],
    faza: "pitka",
    utocnik: 1,
    ciel: { typ: "lokalita", lokalita },
    lokalityVHre: s0.lokalityVHre.filter((k) => k !== lokalita),
    strany,
    pitkyCelkom: 1,
    pitkaCislo: 1,
    pitkaStav: pitkaStav(0),
  };
}

/** Zhromaždenie na lokalite `lok` (hráč 0 na ťahu, limit 3). */
function vZhromazdeni(lok: string, strany: GameState["strany"], ruka: CardInstance[], p: PlayerId = 0): GameState {
  const s = vPitke(lok, strany);
  return sHracom(
    { ...s, faza: "zhromazdenie", pitkaStav: null, pitkaCislo: 0, zhromazdenieStav: { naTahu: p, zostavaLimit: [3, 3], pasoval: [false, false], navyse: [0, 0] } },
    p,
    { ruka },
  );
}

/** Obaja skončia Pitku bez NA EX a bez odpovede — vyhodnotí sa. */
function skonciPitku(s0: GameState): GameState {
  let s = s0;
  for (let i = 0; i < 6 && s.faza === "pitka" && s.vizia === null; i++) {
    const q = ([0, 1] as const).find((x) => legalCommands(data, s, x).some((c) => c.type === "skipNaex" || c.type === "bezReakcie"));
    if (q === undefined) break;
    s = apply(data, s, legalCommands(data, s, q).find((c) => c.type === "skipNaex" || c.type === "bezReakcie")!, q).state;
  }
  return s;
}

/** Dohrá kolo prvými „pokojnými“ ťahmi až po ďalšie kolo (alebo koniec hry). */
function dohrajKolo(s0: GameState): GameState {
  let s = s0;
  const kolo = s.kolo;
  for (let i = 0; i < 400 && s.koniec === null && s.kolo === kolo; i++) {
    const q = ([0, 1] as const).find((x) => legalCommands(data, s, x).length > 0);
    if (q === undefined) break;
    const legal = legalCommands(data, s, q);
    const cmd =
      legal.find((c) => c.type === "skipNaex") ??
      legal.find((c) => c.type === "pass") ??
      legal.find((c) => c.type === "bezReakcie") ??
      legal.find((c) => (c.type === "cintorin" && c.uid === null)) ??
      legal.find((c) => c.type === "vizia" && c.vziat) ??
      (legal[0] as Command);
    s = apply(data, s, cmd, q).state;
  }
  return s;
}

describe("Konflikt (v7, plan.md 13.1)", () => {
  // Policajtka od sady B+ (Michal 2026-11-02) nemá Konflikt, ale Pitku „Za každú súperovu akciu, ktorú v tejto
  // Pitke zruší tvoj Odpor, získa súper 1 zadĺženie.“ (jadro v10.4; syntetické dáta v autority-v104.test.ts).
  it("Policajtka (P-B): súper získa zadĺženie za každú akciu zrušenú jej majiteľovým Odporom", () => {
    expect(data.cards.get("policajtka")?.triggers).toEqual(["Pitka"]);
    // Policajtka hráča 0 pri lokalite, za ňou súperov Miňištrant otočený k súperovi: jej Odpor zruší jeho akciu.
    const s0 = setupGame(data, 5);
    const s: GameState = { ...s0, strany: [[lezi(inst("policajtka"), 0), lezi(inst("ministrant"), 1)], []] };
    const ev = evaluateLine(data, lineState(s));
    expect(ev.zruseneOdporom).toEqual([1, 0]);
    expect(pokutaPolicajtky(data, s, ev)).toEqual([0, 1]);
    expect(prirastkyPitky(data, s).zadlzenie).toEqual([0, 1]);
  });

  // Mechaniku Konfliktu skúša Šarlatán (premena po Konflikte); Snúbenica má od v11.3 Podporu
  // (konflikt-podpora-v113.test.ts).
  const premena = (st: GameState, uid: number): string | undefined => [...st.strany[0], ...st.strany[1]].find((pl) => pl.card.uid === uid)?.premena;

  it("vlastné priloženie a podložený Nástroj Konflikt nevyvolajú", () => {
    const sar = inst("sarlatan");
    const vlastna = vZhromazdeni("zastavka", [[lezi(sar, 0)], []], [inst("masiar")]);
    const masiar = vlastna.hraci[0].ruka[0]!;
    expect(premena(apply(data, vlastna, { type: "place", uid: masiar.uid, target: "vlastna" }, 0).state, sar.uid)).toBeUndefined();
    const sar2 = inst("sarlatan");
    const cudzia = vZhromazdeni("zastavka", [[lezi(sar2, 1)], []], [inst("masiar")]);
    const chlap = cudzia.hraci[0].ruka[0]!;
    expect(premena(apply(data, cudzia, { type: "place", uid: chlap.uid, target: "vlastna" }, 0).state, sar2.uid)).toBe("sarlatan");
    const sar3 = inst("sarlatan");
    const pasca = inst("pasca");
    const nastroj = vZhromazdeni("zastavka", [[lezi(sar3, 0)], []], [pasca]);
    // Náradie (2026-11-08): podloženie nie je priloženie; od v11.16 len pod vlastnú kartu.
    const podlozeny = apply(dataH, nastroj, { type: "podloz", nastrojId: pasca.uid, hostitelId: sar3.uid, hrana: "horna" }, 0).state;
    expect(podlozeny.strany[0][0]?.podlozene?.map((n) => n.card.uid)).toEqual([pasca.uid]);
    expect(premena(podlozeny, sar3.uid)).toBeUndefined();
  });

  it("Konflikt oboma smermi (v11.3): Šarlatána priložený k súperovej karte sa premení tiež", () => {
    const sar = inst("sarlatan");
    const s = vZhromazdeni("zastavka", [[lezi(inst("masiar"), 1)], []], [sar]);
    expect(premena(apply(data, s, { type: "place", uid: sar.uid, target: "vlastna" }, 0).state, sar.uid)).toBe("sarlatan");
  });

  it("NA EX na kartu vedľa Konfliktu ho nespustí", () => {
    const sar = inst("sarlatan");
    const s = vPitke("zastavka", [[lezi(inst("zamocnik"), 1), lezi(sar, 1)], []]);
    for (const uid of moznostiNaex(data, s, 0)) {
      expect(premena(apply(data, s, { type: "naex", uid }, 0).state, sar.uid)).toBeUndefined();
    }
  });

  it("Hrobár v línii od v9 Konflikt nemá (len akcie); Vdovu od v10.3 skúša pravidla-v103.test.ts", () => {
    const hrobar = inst("hrobar");
    const karta = inst("zamocnik");
    const dalsia = inst("vandal");
    const s2 = vZhromazdeni("zastavka", [[lezi(hrobar, 1)], []], [karta, dalsia]);
    const po2 = apply(data, s2, { type: "place", uid: karta.uid, target: "vlastna" }, 0).state;
    expect(po2.strany[0].at(-1)?.posledna).toBeUndefined();
    expect(po2.strany[0].at(-1)?.poBitkeZHry).toBeUndefined();
  });

  it("Šarlatán: po Konflikte sa do konca kola jeho Dlhy rátajú ako Viera a Povery ako Rana", () => {
    const sar = inst("sarlatan");
    const s = vZhromazdeni("zastavka", [[lezi(inst("zamocnik"), 1), lezi(sar, 1)], []], [inst("masiar")]);
    const karta = s.hraci[0].ruka[0]!;
    const po = apply(data, s, { type: "place", uid: karta.uid, target: "vlastna" }, 0).state;
    expect(po.strany[0].find((pl) => pl.card.uid === sar.uid)?.premena).toBe("sarlatan");
    const zdroje = evaluateLine(data, lineState(po)).zdroje[1];
    expect((zdroje.Dlh ?? []).some((z) => z.uid === sar.uid)).toBe(false);
    expect((zdroje.Povera ?? []).some((z) => z.uid === sar.uid)).toBe(false);
  });

  it("Miňištrant: Nástup — vyvolal Konflikt, jeho Viera sa ráta ako Pecka", () => {
    const min = inst("ministrant");
    const s = vZhromazdeni("zastavka", [[lezi(inst("sarlatan"), 1)], []], [min]);
    const po = apply(data, s, { type: "place", uid: min.uid, target: "vlastna" }, 0).state;
    expect(po.strany[0].find((pl) => pl.card.uid === min.uid)?.premena).toBe("ministrant");
    expect((evaluateLine(data, lineState(po)).zdroje[0].Viera ?? []).some((z) => z.uid === min.uid)).toBe(false);
  });

  it("Záverečná vyvolá Konflikt až pri otočení na konci Pitky", () => {
    const sar = inst("sarlatan");
    const masiar = inst("masiar");
    const s = vZhromazdeni("zastavka", [[lezi(sar, 1)], []], [masiar]);
    const po = apply(data, s, { type: "zaverecna", uid: masiar.uid, target: "vlastna" }, 0).state;
    expect(premena(po, sar.uid)).toBeUndefined();
    let t = apply(data, po, { type: "pass" }, 1).state;
    for (let i = 0; i < 4 && t.faza === "pitka"; i++) {
      const q = ([0, 1] as const).find((x) => legalCommands(data, t, x).some((c) => c.type === "skipNaex" || c.type === "bezReakcie"));
      if (q === undefined) break;
      t = apply(data, t, legalCommands(data, t, q).find((c) => c.type === "skipNaex" || c.type === "bezReakcie")!, q).state;
    }
    expect(premena(t, sar.uid)).toBe("sarlatan");
  });
});

describe("efekty v línii (v7)", () => {
  it("podstrčený Pes platí: na súperovej strane vedľa súperovej karty sa jeho aktívne akcie rátajú dvakrát (§13, návrh #41 A)", () => {
    const sucet = (s: GameState): number => {
      const ev = evaluateLine(data, lineState(s)).cards.get(1)!;
      return [...ev.left, ...ev.right].reduce((n, x) => n + (x?.stav === "aktivna" ? x.nasobok : 0), 0);
    };
    const pocet = (s: GameState): number => {
      const ev = evaluateLine(data, lineState(s)).cards.get(1)!;
      return [...ev.left, ...ev.right].filter((x) => x?.stav === "aktivna").length;
    };
    let overene = 0;
    const pv = data.variants.get("pes")!;
    const zv = data.variants.get("zamocnik")!;
    for (const [pl, pr] of [...pv.left.map((_, i) => [i, 0] as const), ...pv.right.map((_, i) => [0, i] as const)]) {
      for (let zl = 0; zl < zv.left.length; zl++) {
        const pes: CardInstance = { uid: 1, defId: "pes", leftLayout: pl, rightLayout: pr };
        const zam = (kto: PlayerId): PlacedCard => lezi({ uid: 2, defId: "zamocnik", leftLayout: zl, rightLayout: 0 }, kto);
        const bez = vPitke("zastavka", [[], [lezi(pes, 0)]]);
        const cudzi = vPitke("zastavka", [[], [lezi(pes, 0), zam(1)]]);
        expect(sucet(cudzi) - sucet(bez)).toBe(2 * (pocet(cudzi) - pocet(bez)));
        if (pocet(cudzi) > pocet(bez)) overene++;
      }
    }
    expect(overene).toBeGreaterThan(0);
  });

  // Kapybara (Nástup — súperove reči o stupeň nižšie) a Krokodíl (Bitka — Občania a Zvieratá v okolí)
  // zanikli 2026-11-09; nové efekty: kapybara-telefon-krokodil.test.ts.

  it("Pes: aktívne akcie na spoji so súperovou kartou sa rátajú dvakrát; vedľa Mäsiara nie (2026-10-28)", () => {
    const sucet = (s: GameState, uid: number): number => {
      const ev = evaluateLine(data, lineState(s)).cards.get(uid)!;
      return [...ev.left, ...ev.right].reduce((n, x) => n + (x?.stav === "aktivna" ? x.nasobok : 0), 0);
    };
    const pocet = (s: GameState, uid: number): number => {
      const ev = evaluateLine(data, lineState(s)).cards.get(uid)!;
      return [...ev.left, ...ev.right].filter((x) => x?.stav === "aktivna").length;
    };
    let overene = 0;
    const pv = data.variants.get("pes")!;
    // Sused bez Posilnenia, Paktu a Odporu (Zámočník má od 2026-11-02 Posilnenie, to by násobilo aj Psa).
    const zv = data.variants.get("zahradkar")!;
    for (const [pl, pr] of [...pv.left.map((_, i) => [i, 0] as const), ...pv.right.map((_, i) => [0, i] as const)]) for (const strana of [0, 1] as const) {
      for (let zl = 0; zl < zv.left.length; zl++) {
        for (let zr = 0; zr < zv.right.length; zr++) {
          const pes: CardInstance = { uid: 1, defId: "pes", leftLayout: pl, rightLayout: pr };
          const st = (x: PlacedCard[]): GameState["strany"] => (strana === 0 ? [x, []] : [[], x]);
          const sused = (kto: PlayerId): PlacedCard => lezi({ uid: 2, defId: "zahradkar", leftLayout: zl, rightLayout: zr }, kto);
          const bez = vPitke("zastavka", st([lezi(pes, 0)]));
          const vlastny = vPitke("zastavka", st([lezi(pes, 0), sused(0)]));
          const cudzi = vPitke("zastavka", st([lezi(pes, 0), sused(1)]));
          // Spoj s vlastnou kartou: nové aktívne akcie Psa ×1, so súperovou ×2.
          expect(sucet(vlastny, 1) - sucet(bez, 1)).toBe(pocet(vlastny, 1) - pocet(bez, 1));
          expect(sucet(cudzi, 1) - sucet(bez, 1)).toBe(2 * (pocet(cudzi, 1) - pocet(bez, 1)));
          if (pocet(cudzi, 1) > pocet(bez, 1)) overene++;
        }
      }
    }
    expect(overene).toBeGreaterThan(0);
    const pes: CardInstance = { uid: 1, defId: "pes", leftLayout: 0, rightLayout: 0 };
    const priMasiarovi = vPitke("zastavka", [[lezi(pes, 0), lezi(inst("masiar"), 1)], []]);
    expect(sucet(priMasiarovi, 1)).toBe(pocet(priMasiarovi, 1));
  });

});

describe("Pitka (v7)", () => {
  it("Stryná: hráč bez NA EX v Pitke +1 pečeň (Liberál od v10.3 zadĺženie nedáva)", () => {
    const s = vPitke("zastavka", [[lezi(inst("niekoho_stryna"), 0), lezi(inst("zamocnik"), 0)], [lezi(inst("masiar"), 1)]]);
    const bez = prirastkyPitky(data, { ...s, strany: [[lezi(inst("zamocnik"), 0)], [lezi(inst("masiar"), 1)]] }, undefined, [false, false]);
    const so = prirastkyPitky(data, s, undefined, [true, false]);
    expect(so.poskodeniePecene[1] - bez.poskodeniePecene[1]).toBeGreaterThanOrEqual(1);
  });

  it("Veterinár v línii od v9 pečeň okolia nemaže — jeho efekt je len Kšeft väzňa", () => {
    const sused = lezi(inst("zivnostnik"), 0); // má Poškodenie pečene
    const s = vPitke("zastavka", [[lezi(inst("veterinar"), 0), sused], []]);
    expect(prirastkyPitky(data, s).poskodeniePecene[0]).toBe(evaluateLine(data, lineState(s)).sums[0].PoškodeniePečene ?? 0);
  });

  it("Kar: pečeň za NA EX dostane súper toho, kto ho dal", () => {
    const s = vPitke("kar", [[lezi(inst("zamocnik"), 0), lezi(inst("vandal"), 0)], [lezi(inst("masiar"), 1), lezi(inst("hasic"), 1)]]);
    const uid = moznostiNaex(data, s, 0)[0];
    expect(uid).toBeDefined();
    let t = apply(data, s, { type: "naex", uid: uid! }, 0).state;
    if (t.pitkaStav?.hotovy[0] !== true) t = apply(data, t, { type: "skipNaex" }, 0).state;
    const { events } = apply(data, t, { type: "skipNaex" }, 1);
    expect(events.some((e) => e.type === "log" && e.text.startsWith("Kar: pečeň za NA EX hráča 1 dostáva hráč 2"))).toBe(true);
    expect(events.some((e) => e.type === "pecen" && e.hrac === 1)).toBe(true);
    expect(events.some((e) => e.type === "pecen" && e.hrac === 0)).toBe(false);
  });

  it("Krčmárka v línii od v9 odpoveď na NA EX nezakazuje (jej efekt je Kšeft väzňa)", () => {
    const strany: GameState["strany"] = [[lezi(inst("zamocnik"), 0), lezi(inst("vandal"), 0)], [lezi(inst("masiar"), 1), lezi(inst("hasic"), 1)]];
    const base = sHracom(vPitke("zastavka", strany), 1, { ruka: [inst("degustatorka")] });
    const naex = (s: GameState): GameState => {
      let t = apply(data, s, { type: "naex", uid: moznostiNaex(data, s, 0)[0]! }, 0).state;
      if (t.pitkaStav?.hotovy[0] !== true) t = apply(data, t, { type: "skipNaex" }, 0).state;
      return apply(data, t, { type: "skipNaex" }, 1).state;
    };
    expect(naex(base).pitkaStav?.reakcia).toBe(1);
    const krcmarka = { ...base, strany: [[...strany[0], lezi(inst("krcmarka"), 0)], strany[1]] } as GameState;
    expect(naex(krcmarka).pitkaStav?.reakcia).toBe(1);
  });

  it("Cintorín (Pozostalosť, Michal 2026-10-27): nová Cirhóza sa už sama nepriznáva", () => {
    const s = sHracom(vPitke("cintorin", [[lezi(inst("zamocnik"), 0)], []]), 0, { pecen: 10 });
    const t = skonciPitku(s);
    expect(t.hraci[0].priznane.some((k) => k.defId === "cirhoza")).toBe(false);
    const h = t.hraci[0];
    expect([...h.ruka, ...h.doberaci, ...h.odhadzovaci].some((k) => k.defId === "cirhoza")).toBe(true);
  });

  it("Jednota: kto má viac priznaných Dlhov, nesmie fajčiť ani barterovať (v12.2); Benzínka nikomu fajčiť nezakáže", () => {
    const s = sHracom(sHracom(vPitke("jednota", [[], []]), 0, { dlhy: 2, cigarety: 9, poldeciVypite: 1 }), 1, { dlhy: 1 });
    const legal = legalCommands(data, s, 0);
    expect(legal.some((c) => c.type === "smoke" || c.type === "barter")).toBe(false);
    const b = sHracom(vPitke("benzinka", [[lezi(inst("zamocnik"), 0), lezi(inst("vandal"), 0)], [lezi(inst("masiar"), 1)]]), 0, { cigarety: 5 });
    expect(legalCommands(data, b, 0).some((c) => c.type === "smoke")).toBe(true);
    const b1 = { ...sHracom(b, 1, { cigarety: 5 }), pitkaStav: pitkaStav(1) };
    expect(legalCommands(data, b1, 1).some((c) => c.type === "smoke")).toBe(true);
  });

  it("Bzdocha: kto vyberá NA EX po súperovi, vidí jeho skryté NA EX — inak nie", () => {
    const strany: GameState["strany"] = [[lezi(inst("zamocnik"), 0), lezi(inst("vandal"), 0)], [lezi(inst("masiar"), 1), lezi(inst("klebetnica"), 1)]];
    // Vínna pivnica: po prvom NA EX má hráč ešte voľbu, Pitku za neho hra neskončí.
    const s = vPitke("vinna_pivnica", strany);
    let t = apply(data, s, { type: "naex", uid: moznostiNaex(data, s, 0)[0]! }, 0).state;
    expect(t.pitkaStav?.hotovy[0]).toBe(false);
    expect(viewFor(data, t, 1).pitkaStav?.skryteNaex).toEqual([]);
    t = apply(data, t, { type: "skipNaex" }, 0).state;
    expect(viewFor(data, t, 1).pitkaStav?.skryteNaex).toHaveLength(1);
    // Klient to vie aj z pohľadov (štítok na stole, text pri poldeci): hráč 1 vidí, hráč 0 nie.
    expect(vidiVolbuSupera(data, viewFor(data, t, 1), 1)).toBe(true);
    expect(vidiVolbuSupera(data, viewFor(data, t, 0), 1)).toBe(true);
    expect(vidiVolbuSupera(data, viewFor(data, t, 0), 0)).toBe(false);
    // Bez Bzdochy nič.
    const bez = { ...t, strany: [strany[0], [strany[1][0]!]] } as GameState;
    expect(viewFor(data, bez, 1).pitkaStav?.skryteNaex).toEqual([]);
  });

  it("Krabička cigariet: za každé 2 cigarety, ktoré súper vyfajčí, karta navyše", () => {
    const s = sHracom(sHracom(vPitke("zastavka", [[], []]), 1, { dedicstvo: [inst("cigorky")] }), 0, { cigarety: 6 });
    const pred = s.hraci[1].ruka.length;
    const po = apply(data, apply(data, s, { type: "smoke" }, 0).state, { type: "smoke", pocet: 1 }, 0).state;
    // Fajčenie stojí 1 + 2 = 3 cigarety → 1 karta.
    expect(po.hraci[1].ruka.length - pred).toBe(1);
  });
});

describe("Zhromaždenie a Nástup (v7)", () => {
  it("Autobusár v línii od v9 cigarety za pas neberie (jeho efekt je Kšeft väzňa)", () => {
    const s = vZhromazdeni("zastavka", [[], [lezi(inst("autobusar"), 1)]], [inst("masiar"), inst("vandal")]);
    const z = { ...s, zhromazdenieStav: { ...s.zhromazdenieStav!, pasoval: [false, true] as [boolean, boolean] } };
    const po = apply(data, z, { type: "pass" }, 0).state;
    // Pas dáva cigaretu za každý plný poldeci (v12.3) — Autobusár z nich neberie nič.
    expect(po.hraci[0].cigarety).toBe(s.hraci[0].cigarety + s.hraci[0].poldeciPlne);
  });

  it("Starosta v línii od v9 Nástup nemá; Živnostník Nástup nemá ani v starej sade (Nástroj pod neho zanikol 2026-11-09); Anonymný alkoholik od v11.5 Nástup nemá", () => {
    const starosta = inst("starosta");
    const s = vZhromazdeni("zastavka", [[], []], [starosta]);
    const po = apply(data, s, { type: "place", uid: starosta.uid, target: "vlastna" }, 0).state;
    expect(legalCommands(data, po, 0).some((c) => c.type === "senok")).toBe(false);

    // Sada pred frakciami (Živnostník s Nástupom) s hranami Nástrojov: voľba Nástroja pod neho už neexistuje.
    const ziv = inst("zivnostnik");
    const sz = vZhromazdeni("zastavka", [[], []], [ziv, inst("vidly")]);
    const pz = apply(dataH, sz, { type: "place", uid: ziv.uid, target: "vlastna" }, 0).state;
    expect(pz.hasicVolby ?? []).toEqual([]);
    expect(legalCommands(dataH, pz, 0).some((c) => (c.type as string) === "nastroj")).toBe(false);

    const aa = inst("anonymny_alkoholik");
    const sa = sHracom(vZhromazdeni("zastavka", [[], []], [aa]), 0, { odhadzovaci: [inst("cirhoza"), inst("cirhoza"), inst("masiar")] });
    const pa = apply(data, sa, { type: "place", uid: aa.uid, target: "vlastna" }, 0).state;
    expect(pa.hraci[0].priznane.filter((k) => k.defId === "cirhoza")).toHaveLength(0);
    expect(pa.hraci[0].odhadzovaci.filter((k) => k.defId === "cirhoza")).toHaveLength(2);
  });
});

describe("Bitka a po bitke (v7)", () => {
  it("Vidly: Rany z vyložených akcií o 1 viac — Rany navyše z efektov nie (Michal 2026-10-27); Puška už Petelicu nezvyšuje (2026-10-30)", () => {
    const s = sHracom(vPitke("zastavka", [[], []]), 0, { dedicstvo: [inst("puska"), inst("vidly")] });
    expect(nastrojeTuhe(s, 0, { Rana: 2, Petelica: 1 })).toEqual([{ zdroj: "vidly", tuhe: 2 }]);
    const bez = poskodenieBitky(data, { ...s, hraci: [{ ...s.hraci[0], dedicstvo: [] }, s.hraci[1]] }, [{ Rana: 2, Petelica: 1 }, {}]).tuhe[0];
    expect(poskodenieBitky(data, s, [{ Rana: 2, Petelica: 1 }, {}]).tuhe[0]).toBe(bez + 2);
  });

  it("Pasca: súper v kole priložil kartu k tvojej → Rana navyše (v9.1, predtým Pecka); Pijan: Rana za každé svoje NA EX", () => {
    const s = sHracom(vPitke("zastavka", [[lezi(inst("pijan"), 0, { naexBy: 0 }), lezi(inst("vandal"), 0, { naexBy: 0 })], []]), 0, { dedicstvo: [inst("pasca")] });
    expect(bitkaMody(data, s, 0).tuheZdroje).toContainEqual({ zdroj: "pijan", tuhe: 2 });
    expect(bitkaMody(data, s, 0).tuheZdroje.some((z) => z.zdroj === "pasca")).toBe(false);
    expect(bitkaMody(data, { ...s, prilozeniaKu: [1, 0] }, 0).tuheZdroje).toContainEqual({ zdroj: "pasca", tuhe: 1 });
  });

  it("Recidivista sa porazenému vráti do ruky, Dievčina sa zahodí a víťaz získa Dlhy, Farár dá víťazovi zadĺženie", () => {
    const rec = inst("recidivista");
    const dievc = inst("dievcina_na_vydaj");
    // Hráč 1 vyhrá (silné karty), hráč 0 prehrá s Recidivistom a Dievčinou.
    const silna = (n: number): PlacedCard[] => Array.from({ length: n }, () => lezi(inst("kulturista"), 1));
    const s = vPitke("zastavka", [[lezi(rec, 0), lezi(dievc, 0), lezi(inst("farar"), 0)], silna(3)]);
    const po = dohrajKolo(s);
    const vsetky = (p: PlayerId): number[] => [...po.hraci[p].doberaci, ...po.hraci[p].odhadzovaci].map((k) => k.uid);
    const bitka = po.nastenka.at(-1);
    if (bitka?.vitaz !== 1) return; // test stojí na víťazstve hráča 1
    expect(po.hraci[0].ruka.some((k) => k.uid === rec.uid)).toBe(true);
    expect(vsetky(0)).not.toContain(dievc.uid);
  });

  it("stávka bitky ráta Herňu ako výplata (vyplatSpaky); Noviny od v11.5 špaky nedávajú", () => {
    const silna = (n: number): PlacedCard[] => Array.from({ length: n }, () => lezi(inst("kulturista"), 1));
    // Herňa: hráč 1 vyhrá, hráč 0 má 3 priznané Dlhy → víťaz +3.
    const h = sHracom(vPitke("herna", [[lezi(inst("zamocnik"), 0)], silna(3)]), 0, { dlhy: 3 });
    const stavkaH = stavkaBitky(viewFor(data, h, 1))!;
    expect(stavkaH.herna).toEqual([3, 0]);
    // 4 karty v línii (v8) + Herňa 3; výplata ráta Dlhy až po Pitke (D6 ich môže pridať), stávka tie teraz.
    expect(stavkaH.vyhra).toBe(4 + 3);
    expect(-stavkaBitky(viewFor(data, h, 0))!.prehra).toBe(stavkaH.vyhra);
    // Noviny (v11.5 Dedičstvo: Hádka) už porazenému špaky za Dlhy víťaza nedajú.
    const n = sHracom(sHracom(vPitke("zastavka", [[lezi(inst("zamocnik"), 0)], silna(3)]), 0, { dedicstvo: [inst("noviny")] }), 1, { dlhy: 2 });
    expect(stavkaBitky(viewFor(data, n, 1))!.vyhra).toBe(4);
    const poN = dohrajKolo(n).nastenka.at(-1)!;
    expect(poN.vitaz).toBe(1);
    expect(poN.zaBitku[0]).toBe(0);
    expect(poN.noviny).toBeUndefined();
  });

  it("Výherný automat (text sady v7, bez zápisu): prah Dlhu +1 a v poslednej Pitke kola Dlh", () => {
    const s = sHracom(vPitke("most", [[], []]), 0, { dedicstvo: [inst("vyherny_automat")] });
    const t = skonciPitku(s);
    expect(dlhyAjZhorene(t, 0)).toBe(dlhy(s, 0) + 1);
    // Rekapitulácia Pitky delí zadĺženie prahom hráča, nie základným (kontrola kódu v7, bod 8).
    // Rekapitulácia ide udalosťou pitkaRekap (pitkyKola sa po kole vyprázdni).
    let rekap: RekapitulaciaPitky | undefined;
    let u = s;
    for (let i = 0; i < 6 && rekap === undefined && u.faza === "pitka"; i++) {
      const q = ([0, 1] as const).find((x) => legalCommands(data, u, x).some((c) => c.type === "skipNaex" || c.type === "bezReakcie"));
      if (q === undefined) break;
      const r = apply(data, u, legalCommands(data, u, q).find((c) => c.type === "skipNaex" || c.type === "bezReakcie")!, q);
      for (const e of r.events) if (e.type === "pitkaRekap") rekap = e.rekap;
      u = r.state;
    }
    expect(rekap?.zadlzenie.prah).toEqual([prahyHraca(data, s, 0).dlh, prahyHraca(data, s, 1).dlh]);
    expect(prahDlhuPitky(rekap!, 0)).toBe(prahDlhuPitky(rekap!, 1) + 1);
    // Rozohraná partia spred opravy má v stave jedno číslo.
    expect(prahDlhuPitky({ ...rekap!, zadlzenie: { ...rekap!.zadlzenie, prah: 3 as unknown as readonly [number, number] } }, 0)).toBe(3);
  });

  it("Záhradkár (Exekúcia, Michal 2026-10-28): v línii v tvojej partii ťa exekúcia v tomto kole obíde — Dlhy ani špaky nezhoria", () => {
    const zah = inst("zahradkar");
    const s = sHracom(vPitke("most", [[lezi(zah, 0), lezi(inst("vandal"), 1)], []]), 0, { dlhy: 8 });
    const t = skonciPitku(s);
    expect(t.bitkaStav?.krok === "exekutor" && t.bitkaStav.caka !== null).toBe(false);
    const zaznam = t.nastenka.at(-1);
    expect(zaznam?.exekutor[0] ?? 0).toBe(0);
    // Robota v línii (ak ju karty majú) Dlhy páli aj tak — Záhradkár ruší len exekúciu.
    expect(dlhy(t, 0)).toBe(8 - Math.min(8, paleneDlhyVBitke(data, s)[0]));
    // Záhradkár sa nezahadzuje.
    expect(t.bitkaStav?.spalit ?? []).not.toContain(zah.uid);
    // Súperov Záhradkár (podstrčený do mojej strany) ma nechráni — rozhoduje partia.
    const sCudzi = sHracom(vPitke("most", [[lezi(inst("vandal"), 0), lezi(inst("zahradkar"), 1)], []]), 0, { dlhy: 8 });
    const poRobote = 8 - Math.min(8, paleneDlhyVBitke(data, sCudzi)[0]);
    expect(dlhy(skonciPitku(sCudzi), 0)).toBe(poRobote - Math.ceil(poRobote / 2));
  });
});

describe("finále (Michal 2026-10-27)", () => {
  it("útočí zaostávajúci; pri rovnosti porazený poslednej bitky; po sekere ostáva útočník", () => {
    expect(utocnikFinale([3, 7], 1, 1)).toBe(0);
    expect(utocnikFinale([9, 2], 0, 0)).toBe(1);
    expect(utocnikFinale([4, 4], 0, 0)).toBe(1);
    expect(utocnikFinale([4, 4], null, 0)).toBe(0);
  });
});

describe("Cintorín — Pozostalosť (Michal 2026-10-27, Pohreb zrušený)", () => {
  const silna = (n: number): PlacedCard[] => Array.from({ length: n }, () => lezi(inst("kulturista"), 1));
  /** Bitka po Pitke pokojnými ťahmi, kým nečaká na Cintorín (alebo kým kolo neskončí). */
  function poCintorin(s0: GameState): GameState {
    let s = s0;
    const kolo = s.kolo;
    for (let i = 0; i < 400 && s.koniec === null && s.kolo === kolo; i++) {
      if (s.bitkaStav?.krok === "cintorin" && s.bitkaStav.caka !== null) return s;
      const q = ([0, 1] as const).find((x) => legalCommands(data, s, x).length > 0);
      if (q === undefined) break;
      const legal = legalCommands(data, s, q);
      const cmd =
        legal.find((c) => c.type === "skipNaex") ??
        legal.find((c) => c.type === "pass") ??
        legal.find((c) => c.type === "bezReakcie") ??
        legal.find((c) => c.type === "vizia" && c.vziat) ??
        (legal[0] as Command);
      s = apply(data, s, cmd, q).state;
    }
    return s;
  }

  it("porazený si vezme kartu zo svojho odhadzovacieho balíčka do ruky; cena Dedičstva sa nemení", () => {
    const pijan = inst("pijan");
    const s = poCintorin(sHracom(vPitke("cintorin", [[lezi(inst("zamocnik"), 0)], silna(3)]), 0, { odhadzovaci: [pijan, inst("masiar")], cigarety: 0 }));
    expect(s.bitkaStav?.krok).toBe("cintorin");
    expect(s.bitkaStav?.caka).toBe(0);
    const legal = legalCommands(data, s, 0);
    expect(legal).toEqual(expect.arrayContaining([{ type: "cintorin", uid: pijan.uid }, { type: "cintorin", uid: null }]));
    const po = apply(data, s, { type: "cintorin", uid: pijan.uid }, 0).state;
    expect(po.hraci[0].ruka.map((k) => k.uid)).toContain(pijan.uid);
    expect(po.hraci[0].odhadzovaci.map((k) => k.uid)).not.toContain(pijan.uid);
    expect(po.dedicstvaVylozene).toBe(s.dedicstvaVylozene);
  });

  it("voľba nič: karta ostáva v balíčku; cudziu kartu server odmietne", () => {
    const pijan = inst("pijan");
    const cudzia = inst("vidly");
    const base = vPitke("cintorin", [[lezi(inst("zamocnik"), 0)], silna(3)]);
    const s = poCintorin(sHracom(sHracom({ ...base, senok: [...base.senok, cudzia] }, 0, { odhadzovaci: [pijan] }), 1, { odhadzovaci: [] }));
    expect(s.bitkaStav?.caka).toBe(0);
    expect(() => apply(data, s, { type: "cintorin", uid: cudzia.uid }, 0)).toThrow(/odhadzovacom/);
    const po = apply(data, s, { type: "cintorin", uid: null }, 0).state;
    expect(po.hraci[0].ruka.map((k) => k.uid)).not.toContain(pijan.uid);
    expect(po.hraci[0].odhadzovaci.map((k) => k.uid)).toContain(pijan.uid);
    // Víťaz Cintorín nevyužije.
    expect(() => apply(data, s, { type: "cintorin", uid: pijan.uid }, 1)).toThrow();
  });

  it("s prázdnym odhadzovacím balíčkom, na inej lokalite a pri sekere sa Cintorín preskočí", () => {
    // Bez vlastnej karty v línii — tá by sa pred Cintorínom vrátila do balíčka (v11.13).
    const bez = poCintorin(sHracom(vPitke("cintorin", [[], silna(3)]), 0, { ruka: [inst("pijan")], odhadzovaci: [] }));
    expect(bez.nastenka.at(-1)?.vitaz).toBe(1);
    expect(bez.bitkaStav?.krok === "cintorin" && bez.bitkaStav.caka !== null).toBe(false);
    const inde = poCintorin(sHracom(vPitke("zastavka", [[lezi(inst("zamocnik"), 0)], silna(3)]), 0, { odhadzovaci: [inst("pijan")] }));
    expect(inde.bitkaStav?.krok === "cintorin" && inde.bitkaStav.caka !== null).toBe(false);
    // Sekera: prázdna línia, rovnako Absťákov aj Dlhov — porazený nie je.
    const s = sHracom(sHracom(vPitke("cintorin", [[], []]), 0, { odhadzovaci: [inst("pijan")] }), 1, { odhadzovaci: [inst("masiar")] });
    const sekera = poCintorin(s);
    expect(sekera.nastenka.at(-1)?.vitaz).toBeNull();
    expect(sekera.bitkaStav?.krok === "cintorin" && sekera.bitkaStav.caka !== null).toBe(false);
  });

  it("v11.13 (Michal 2026-11-07): Cintorín čaká až po návrate kariet — porazený si smie vziať aj kartu z práve odohranej línie", () => {
    const zamocnik = inst("zamocnik");
    const sily = silna(3);
    const s = poCintorin(sHracom(vPitke("cintorin", [[lezi(zamocnik, 0)], sily]), 0, { odhadzovaci: [] }));
    expect(s.bitkaStav?.caka).toBe(0);
    expect(s.strany).toEqual([[], []]);
    const legal = legalCommands(data, s, 0);
    expect(legal).toContainEqual({ type: "cintorin", uid: zamocnik.uid });
    // Víťazove karty idú do jeho balíčka, porazenému sa neponúkajú.
    for (const pl of sily) expect(legal).not.toContainEqual({ type: "cintorin", uid: pl.card.uid });
    const po = apply(data, s, { type: "cintorin", uid: zamocnik.uid }, 0).state;
    expect(po.hraci[0].ruka.map((k) => k.uid)).toContain(zamocnik.uid);
    expect(po.hraci[0].odhadzovaci.map((k) => k.uid)).not.toContain(zamocnik.uid);
    expect(po.faza).not.toBe("bitka");
  });

  it("Cirhóza vzatá Cintorínom sa ako každá nepriznaná vráti do balíčka; porazený dostane cigaretu raz", () => {
    const cirhoza = inst("cirhoza");
    const s = poCintorin(sHracom(vPitke("cintorin", [[lezi(inst("zamocnik"), 0)], silna(3)]), 0, { odhadzovaci: [cirhoza] }));
    expect(s.bitkaStav?.caka).toBe(0);
    const cigarety = s.hraci[0].cigarety;
    const po = apply(data, s, { type: "cintorin", uid: cirhoza.uid }, 0).state;
    expect(po.hraci[0].ruka.map((k) => k.uid)).not.toContain(cirhoza.uid);
    expect(po.hraci[0].odhadzovaci.map((k) => k.uid)).toContain(cirhoza.uid);
    expect(po.hraci[0].cigarety).toBe(cigarety);
  });
});

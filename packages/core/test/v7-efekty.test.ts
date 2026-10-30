// Efekty kariet v7, druhá fáza revízie sady (Michal 2026-10-27, plan.md časť 14):
// Konflikt (jednosmerný spúšťač, časť 13), Úplatok, nové efekty občanov, starších,
// Nástrojov a lokalít, útočník finále.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { CardInstance, Command, GameState, PitkaStav, PlacedCard, PlayerId, PlayerState, RekapitulaciaPitky } from "../src/index.ts";
import {
  apply,
  bitkaMody,
  evaluateLine,
  legalCommands,
  lineState,
  loadGameData,
  moznostiNaex,
  nastrojeTuhe,
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

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

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
  return { naTahu, hotovy: [false, false], naexPouzity: [false, false], fajcenie: [0, 0], reakcia: null, postarka: [false, false], starosta: [false, false], naexPocet: [0, 0], vykup: [false, false] };
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
  it("Policajtka: súper, ktorý k nej priloží kartu, získa Dlh; za Kriminála jej majiteľ dostane 2 cigarety", () => {
    const pol = inst("policajtka");
    const masiar = inst("masiar");
    const s = vZhromazdeni("zastavka", [[lezi(pol, 1)], []], [masiar]);
    const po = apply(data, s, { type: "place", uid: masiar.uid, target: "vlastna" }, 0).state;
    expect(dlhy(po, 0)).toBe(dlhy(s, 0) + 1);
    const vandal = inst("vandal"); // Kriminál
    const s2 = vZhromazdeni("zastavka", [[lezi(pol, 1)], []], [vandal]);
    const po2 = apply(data, s2, { type: "place", uid: vandal.uid, target: "vlastna" }, 0).state;
    expect(dlhy(po2, 0)).toBe(dlhy(s2, 0));
    expect([po2.hraci[0].cigarety, po2.hraci[1].cigarety]).toEqual([s2.hraci[0].cigarety - 2, s2.hraci[1].cigarety + 2]);
  });

  it("vlastné priloženie a priložený Nástroj Konflikt nevyvolajú", () => {
    const pol = inst("policajtka");
    const masiar = inst("masiar");
    const vlastna = vZhromazdeni("zastavka", [[lezi(pol, 0)], []], [masiar]);
    expect(dlhy(apply(data, vlastna, { type: "place", uid: masiar.uid, target: "vlastna" }, 0).state, 0)).toBe(dlhy(vlastna, 0));
    const pasca = inst("pasca");
    const nastroj = vZhromazdeni("zastavka", [[lezi(pol, 1)], []], [pasca]);
    expect(dlhy(apply(data, nastroj, { type: "place", uid: pasca.uid, target: "vlastna" }, 0).state, 0)).toBe(dlhy(nastroj, 0));
  });

  it("NA EX na kartu vedľa Konfliktu ho nespustí", () => {
    const pol = inst("policajtka");
    const s = vPitke("zastavka", [[lezi(inst("zamocnik"), 1), lezi(pol, 1)], []]);
    for (const uid of moznostiNaex(data, s, 0)) {
      const po = apply(data, s, { type: "naex", uid }, 0).state;
      expect(dlhy(po, 0)).toBe(dlhy(s, 0));
    }
  });

  it("Vdova: priložená karta ide po bitke z hry; Hrobár v línii od v9 Konflikt nemá (len akcie)", () => {
    const vdova = inst("velmi_smutiaca_vdova");
    const chlap = inst("masiar");
    const s = vZhromazdeni("zastavka", [[lezi(vdova, 1)], []], [chlap]);
    const po = apply(data, s, { type: "place", uid: chlap.uid, target: "vlastna" }, 0).state;
    expect(po.strany[0].find((pl) => pl.card.uid === chlap.uid)?.poBitkeZHry).toBe(true);
    const hrobar = inst("hrobar");
    const karta = inst("zamocnik");
    const dalsia = inst("vandal");
    const s2 = vZhromazdeni("zastavka", [[lezi(hrobar, 1)], []], [karta, dalsia]);
    const po2 = apply(data, s2, { type: "place", uid: karta.uid, target: "vlastna" }, 0).state;
    expect(po2.strany[0].at(-1)?.posledna).toBeUndefined();
    expect(po2.strany[0].at(-1)?.poBitkeZHry).toBeUndefined();
  });

  it("Snúbenica: priložený Chlap ide po bitke do odhadzovacieho balíčka jej majiteľa", () => {
    const snub = inst("snubenica");
    const chlap = inst("masiar");
    const s = vZhromazdeni("zastavka", [[lezi(snub, 1)], []], [chlap]);
    const koniec = dohrajKolo(apply(data, s, { type: "place", uid: chlap.uid, target: "vlastna" }, 0).state);
    expect([...koniec.hraci[1].odhadzovaci, ...koniec.hraci[1].doberaci, ...koniec.hraci[1].ruka].some((k) => k.uid === chlap.uid)).toBe(true);
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
    const s = vZhromazdeni("zastavka", [[lezi(inst("policajtka"), 1)], []], [min]);
    const po = apply(data, s, { type: "place", uid: min.uid, target: "vlastna" }, 0).state;
    expect(po.strany[0].find((pl) => pl.card.uid === min.uid)?.premena).toBe("ministrant");
    expect((evaluateLine(data, lineState(po)).zdroje[0].Viera ?? []).some((z) => z.uid === min.uid)).toBe(false);
  });

  it("Záverečná vyvolá Konflikt až pri otočení na konci Pitky", () => {
    const pol = inst("policajtka");
    const masiar = inst("masiar");
    const s = vZhromazdeni("zastavka", [[lezi(pol, 1)], []], [masiar]);
    const po = apply(data, s, { type: "zaverecna", uid: masiar.uid, target: "vlastna" }, 0).state;
    expect(dlhy(po, 0)).toBe(dlhy(s, 0));
    let t = apply(data, po, { type: "pass" }, 1).state;
    for (let i = 0; i < 4 && t.faza === "pitka"; i++) {
      const q = ([0, 1] as const).find((x) => legalCommands(data, t, x).some((c) => c.type === "skipNaex" || c.type === "bezReakcie"));
      if (q === undefined) break;
      t = apply(data, t, legalCommands(data, t, q).find((c) => c.type === "skipNaex" || c.type === "bezReakcie")!, q).state;
    }
    expect(dlhyAjZhorene(t, 0)).toBeGreaterThanOrEqual(dlhy(s, 0) + 1);
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

  it("Kapybara je povinná: aj keď je mimo stredu len marker na polovici majiteľa, iná voľba nie je (§16, návrh #41 A)", () => {
    const kapy = inst("kapybara");
    const sk = vZhromazdeni("zastavka", [[], []], [kapy]);
    const starsi = sk.starsi.map((e, i) => (i === 0 ? { ...e, marker: 1 as const } : { ...e, marker: 3 as const }));
    const pk = apply(data, { ...sk, starsi }, { type: "place", uid: kapy.uid, target: "vlastna" }, 0).state;
    const volby = legalCommands(data, pk, 0);
    expect(volby).toEqual([{ type: "kapybara", elderId: starsi[0]!.elderId }]);
  });

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
    const zv = data.variants.get("zamocnik")!;
    for (const [pl, pr] of [...pv.left.map((_, i) => [i, 0] as const), ...pv.right.map((_, i) => [0, i] as const)]) for (const strana of [0, 1] as const) {
      for (let zl = 0; zl < zv.left.length; zl++) {
        for (let zr = 0; zr < zv.right.length; zr++) {
          const pes: CardInstance = { uid: 1, defId: "pes", leftLayout: pl, rightLayout: pr };
          const st = (x: PlacedCard[]): GameState["strany"] => (strana === 0 ? [x, []] : [[], x]);
          const sused = (kto: PlayerId): PlacedCard => lezi({ uid: 2, defId: "zamocnik", leftLayout: zl, rightLayout: zr }, kto);
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

  it("Úplatok: súper cigaretou zníži útoky Kulturistu o stupeň, raz za Pitku", () => {
    const kult = inst("kulturista");
    const s = { ...vPitke("zastavka", [[], [lezi(inst("zamocnik"), 0), lezi(kult, 1)]]), pitkaStav: pitkaStav(0) };
    const legal = legalCommands(data, s, 0);
    expect(legal).toContainEqual({ type: "uplatok", uid: kult.uid });
    const po = apply(data, s, { type: "uplatok", uid: kult.uid }, 0).state;
    expect(po.hraci[0].cigarety).toBe(s.hraci[0].cigarety - 1);
    expect(po.strany[1].find((pl) => pl.card.uid === kult.uid)?.uplatky).toBe(1);
    expect(legalCommands(data, po, 0).some((c) => c.type === "uplatok")).toBe(false);
    // Vlastný Kulturista Úplatok neponúka.
    expect(legalCommands(data, { ...s, pitkaStav: pitkaStav(1) }, 1).some((c) => c.type === "uplatok")).toBe(false);
    const tri = { ...s, strany: [[], [lezi(inst("zamocnik"), 0), lezi(kult, 1, { uplatky: 3 })]] } as GameState;
    const ev = evaluateLine(data, lineState(tri));
    for (const a of ["Petelica", "Pecka", "Rana"] as const) expect((ev.zdroje[1][a] ?? []).some((z) => z.uid === kult.uid)).toBe(false);
  });

  it("Krokodíl: na konci bitky idú z hry Občania a Zvieratá v jeho okolí (oboch hráčov)", () => {
    const kroko = inst("krokodil");
    const moj = inst("zamocnik");
    const jeho = inst("sofer");
    const s = vPitke("zastavka", [[lezi(moj, 0), lezi(kroko, 0), lezi(jeho, 1)], []]);
    const po = dohrajKolo(s);
    const vsetky = (p: PlayerId, t: GameState = po): number[] => [...t.hraci[p].ruka, ...t.hraci[p].doberaci, ...t.hraci[p].odhadzovaci].map((k) => k.uid);
    expect(vsetky(0)).not.toContain(moj.uid);
    expect(vsetky(1)).not.toContain(jeho.uid);
    expect(vsetky(0)).toContain(kroko.uid);
    // Vedľa Mäsiara (2026-10-28) Krokodíl nič nezožerie.
    const masiar = inst("masiar");
    const priMasiarovi = dohrajKolo(vPitke("zastavka", [[lezi(inst("zamocnik"), 0), lezi(inst("krokodil"), 0), lezi(masiar, 1)], []]));
    expect(vsetky(1, priMasiarovi)).toContain(masiar.uid);
  });
});

describe("Pitka (v7)", () => {
  it("Stryná: hráč bez NA EX v Pitke +1 pečeň; Liberál: súper bez rovnováhy žien a chlapov +1 zadĺženie", () => {
    const s = vPitke("zastavka", [[lezi(inst("niekoho_stryna"), 0), lezi(inst("liberal"), 0)], [lezi(inst("masiar"), 1)]]);
    const bez = prirastkyPitky(data, { ...s, strany: [[lezi(inst("zamocnik"), 0)], [lezi(inst("masiar"), 1)]] }, undefined, [false, false]);
    const so = prirastkyPitky(data, s, undefined, [true, false]);
    expect(so.poskodeniePecene[1] - bez.poskodeniePecene[1]).toBeGreaterThanOrEqual(1);
    expect(so.zadlzenie[1] - bez.zadlzenie[1]).toBe(1);
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

  it("Jednota: kto má viac priznaných Dlhov, nesmie fajčiť ani dolievať; Benzínka: fajčí len najďalej", () => {
    const s = sHracom(sHracom(vPitke("jednota", [[], []]), 0, { dlhy: 2, cigarety: 9, poldeciVypite: 1 }), 1, { dlhy: 1 });
    const legal = legalCommands(data, s, 0);
    expect(legal.some((c) => c.type === "smoke" || c.type === "refillPoldeci")).toBe(false);
    const b = sHracom(vPitke("benzinka", [[lezi(inst("zamocnik"), 0), lezi(inst("vandal"), 0)], [lezi(inst("masiar"), 1)]]), 0, { cigarety: 5 });
    expect(legalCommands(data, b, 0).some((c) => c.type === "smoke")).toBe(true);
    const b1 = { ...sHracom(b, 1, { cigarety: 5 }), pitkaStav: pitkaStav(1) };
    expect(legalCommands(data, b1, 1).some((c) => c.type === "smoke")).toBe(false);
  });

  it("Benzínka: pri rovnakej vzdialenosti nefajčí nikto (Michal 2026-10-27)", () => {
    const b = sHracom(sHracom(vPitke("benzinka", [[lezi(inst("zamocnik"), 0)], [lezi(inst("masiar"), 1)]]), 0, { cigarety: 5 }), 1, { cigarety: 5 });
    expect(legalCommands(data, b, 0).some((c) => c.type === "smoke")).toBe(false);
    expect(legalCommands(data, { ...b, pitkaStav: pitkaStav(1) }, 1).some((c) => c.type === "smoke")).toBe(false);
    expect(() => apply(data, b, { type: "smoke" }, 0)).toThrow(/Benzínka/);
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
    expect(po.hraci[0].cigarety).toBe(s.hraci[0].cigarety + 2);
  });

  it("Starosta v línii od v9 Nástup nemá; Kapybara (marker k stredu), Živnostník (Nástroj za neho), Anonymný alkoholik (Cirhózy)", () => {
    const starosta = inst("starosta");
    const s = vZhromazdeni("zastavka", [[], []], [starosta]);
    const po = apply(data, s, { type: "place", uid: starosta.uid, target: "vlastna" }, 0).state;
    expect(legalCommands(data, po, 0).some((c) => c.type === "senok")).toBe(false);

    const kapy = inst("kapybara");
    const sk = vZhromazdeni("zastavka", [[], []], [kapy]);
    const starsi = sk.starsi.map((e, i) => (i === 0 ? { ...e, marker: 1 as const } : e));
    const pk = apply(data, { ...sk, starsi }, { type: "place", uid: kapy.uid, target: "vlastna" }, 0).state;
    const ck = legalCommands(data, pk, 0).find((x) => x.type === "kapybara" && x.elderId === starsi[0]!.elderId)!;
    expect(apply(data, pk, ck, 0).state.starsi[0]!.marker).toBe(2);

    const ziv = inst("zivnostnik");
    const pasca = inst("pasca");
    const sz = vZhromazdeni("zastavka", [[], []], [ziv, pasca]);
    const pz = apply(data, sz, { type: "place", uid: ziv.uid, target: "vlastna" }, 0).state;
    expect(legalCommands(data, pz, 0)).toContainEqual({ type: "nastroj", uid: pasca.uid });
    const pn = apply(data, pz, { type: "nastroj", uid: pasca.uid }, 0).state;
    expect(pn.strany[0].map((pl) => pl.card.uid)).toEqual([ziv.uid, pasca.uid]);
    expect(pn.zhromazdenieStav?.zostavaLimit[0]).toBe(2);

    const aa = inst("anonymny_alkoholik");
    const sa = sHracom(vZhromazdeni("zastavka", [[], []], [aa]), 0, { odhadzovaci: [inst("cirhoza"), inst("cirhoza"), inst("masiar")] });
    const pa = apply(data, sa, { type: "place", uid: aa.uid, target: "vlastna" }, 0).state;
    expect(pa.hraci[0].priznane.filter((k) => k.defId === "cirhoza")).toHaveLength(2);
    expect(pa.hraci[0].odhadzovaci.some((k) => k.defId === "cirhoza")).toBe(false);
  });
});

describe("Kšeft (v7)", () => {
  it("Poštárka a Vychovávateľka v línii od v9 Kšeft nemajú (len väzeň); Obecný úrad, Zberný dvor", () => {
    const post = inst("postarka");
    const vych = inst("vychovavatelka");
    const s = sHracom(vPitke("zastavka", [[lezi(post, 0), lezi(vych, 0)], []]), 0, { doberaci: [inst("masiar"), inst("vandal")], cigarety: 4 });
    expect(legalCommands(data, s, 0).some((c) => c.type === "kseft")).toBe(false);

    const su = sHracom(vPitke("obecny_urad", [[], []]), 0, { cigarety: 3, dlhy: 1 });
    const lok = su.ciel!.lokalita!;
    const pu = apply(data, su, { type: "kseft", uid: lok.uid }, 0).state;
    expect([dlhy(pu, 0), dlhy(pu, 1)]).toEqual([0, dlhy(su, 1) + 1]);

    const karta = inst("masiar");
    const sz = sHracom(vPitke("zberny_dvor", [[], []]), 0, { cigarety: 1, odhadzovaci: [karta] });
    expect(legalCommands(data, sz, 0)).toContainEqual({ type: "kseft", uid: sz.ciel!.lokalita!.uid, kartaUid: karta.uid });
    const pz = apply(data, sz, { type: "kseft", uid: sz.ciel!.lokalita!.uid, kartaUid: karta.uid }, 0).state;
    expect(pz.hraci[0].ruka.some((k) => k.uid === karta.uid)).toBe(true);
  });

  it("v9: prebudenie zaniklo — Poštárka na kraji stupnice Kšeft nedáva", () => {
    const s0 = vPitke("zastavka", [[], []]);
    const i = s0.starsi.findIndex((e) => e.karta.defId === "postarka");
    if (i === -1) return;
    const starsi = s0.starsi.map((e, j) => (j === i ? { ...e, marker: 6 as const } : e));
    const s = sHracom({ ...s0, starsi }, 0, { doberaci: [inst("masiar")] });
    expect(legalCommands(data, s, 0).some((c) => c.type === "kseft")).toBe(false);
  });
});

describe("Bitka a po bitke (v7)", () => {
  it("Vidly: Rany z vyložených akcií o 1 viac — Rany navyše z efektov nie (Michal 2026-10-27); Puška už Petelicu nezvyšuje (2026-10-30)", () => {
    // Strýko z Ameriky kúpil Ranu navyše — Vidly ju nezosilnia.
    const s = { ...sHracom(vPitke("zastavka", [[], []]), 0, { dedicstvo: [inst("puska"), inst("vidly")] }), kseftRany: [1, 0] as [number, number] };
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

  it("Noviny — Titulka (návrh #40): porazený majiteľ dostane 1 špak za každý Dlh víťaza navyše, víťaz špaky za bitku celé", () => {
    const silna = (n: number): PlacedCard[] => Array.from({ length: n }, () => lezi(inst("kulturista"), 1));
    const s = sHracom(sHracom(vPitke("zastavka", [[lezi(inst("zamocnik"), 0)], silna(3)]), 0, { dedicstvo: [inst("noviny")], dlhy: 1 }), 1, { dlhy: 3 });
    const po = dohrajKolo(s);
    const bitka = po.nastenka.at(-1)!;
    expect(bitka.vitaz).toBe(1);
    // Dlhy pred exekúciou: víťaz 3 (aj s Dlhmi z Pitky), porazený 1 → aspoň 2.
    expect(bitka.noviny ?? 0).toBeGreaterThanOrEqual(2);
    expect(bitka.zaBitku[0]).toBe(bitka.noviny);
    expect(bitka.zaBitku[1]).toBe(bitka.karty);
  });

  it("stávka bitky ráta Herňu a Noviny ako výplata (vyplatSpaky)", () => {
    const silna = (n: number): PlacedCard[] => Array.from({ length: n }, () => lezi(inst("kulturista"), 1));
    // Herňa: hráč 1 vyhrá, hráč 0 má 3 priznané Dlhy → víťaz +3.
    const h = sHracom(vPitke("herna", [[lezi(inst("zamocnik"), 0)], silna(3)]), 0, { dlhy: 3 });
    const stavkaH = stavkaBitky(data, viewFor(data, h, 1))!;
    expect(stavkaH.herna).toEqual([3, 0]);
    // 4 karty v línii (v8) + Herňa 3; výplata ráta Dlhy až po Pitke (D6 ich môže pridať), stávka tie teraz.
    expect(stavkaH.vyhra).toBe(4 + 3);
    expect(-stavkaBitky(data, viewFor(data, h, 0))!.prehra).toBe(stavkaH.vyhra);
    // Noviny porazeného (Titulka): víťaz (hráč 1) má o 2 Dlhy viac — výhra celá, porazený +2.
    const n = sHracom(sHracom(vPitke("zastavka", [[lezi(inst("zamocnik"), 0)], silna(3)]), 0, { dedicstvo: [inst("noviny")] }), 1, { dlhy: 2 });
    const stavkaN = stavkaBitky(data, viewFor(data, n, 1))!;
    expect(stavkaN.vyhra).toBe(4);
    expect(stavkaN.noviny).toEqual([0, 2]);
    expect(stavkaBitky(data, viewFor(data, n, 0))!.noviny[0]).toBe(2);
    const poN = dohrajKolo(n).nastenka.at(-1)!;
    expect(poN.vitaz).toBe(1);
    expect(poN.zaBitku[0]).toBe(poN.noviny);
    expect(poN.noviny ?? 0).toBeGreaterThanOrEqual(2);
  });

  it("Výherný automat: prah Dlhu +1 a v poslednej Pitke kola Dlh", () => {
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
    expect(dlhy(t, 0)).toBe(8);
    // Záhradkár sa nezahadzuje.
    expect(t.bitkaStav?.spalit ?? []).not.toContain(zah.uid);
    // Súperov Záhradkár (podstrčený do mojej strany) ma nechráni — rozhoduje partia.
    const cudzi = skonciPitku(sHracom(vPitke("most", [[lezi(inst("vandal"), 0), lezi(inst("zahradkar"), 1)], []]), 0, { dlhy: 8 }));
    expect(dlhy(cudzi, 0)).toBe(4);
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

  it("porazený dá Nástroj z ruky do Dedičstva zadarmo; spoločná cena Dedičstva rastie", () => {
    const puska = inst("puska");
    const s = poCintorin(sHracom(vPitke("cintorin", [[lezi(inst("zamocnik"), 0)], silna(3)]), 0, { ruka: [puska, inst("pijan")], cigarety: 0 }));
    expect(s.bitkaStav?.krok).toBe("cintorin");
    expect(s.bitkaStav?.caka).toBe(0);
    const legal = legalCommands(data, s, 0);
    expect(legal).toEqual(expect.arrayContaining([{ type: "cintorin", uid: puska.uid }, { type: "cintorin", uid: null }]));
    const po = apply(data, s, { type: "cintorin", uid: puska.uid }, 0).state;
    expect(po.hraci[0].dedicstvo.map((k) => k.uid)).toContain(puska.uid);
    expect(po.hraci[0].cigarety).toBeGreaterThanOrEqual(s.hraci[0].cigarety) // zadarmo (cigarety za prebytok prídu až po Cintoríne);
    expect(po.dedicstvaVylozene).toBe(s.dedicstvaVylozene + 1);
  });

  it("porazený smie vziať Nástroj aj zo šenku — zo šenku zmizne", () => {
    const vidly = inst("vidly");
    const base = vPitke("cintorin", [[lezi(inst("zamocnik"), 0)], silna(3)]);
    const s = poCintorin(sHracom({ ...base, senok: [...base.senok, vidly] }, 0, { ruka: [inst("pijan")] }));
    expect(s.bitkaStav?.caka).toBe(0);
    expect(legalCommands(data, s, 0)).toContainEqual({ type: "cintorin", uid: vidly.uid });
    const po = apply(data, s, { type: "cintorin", uid: vidly.uid }, 0).state;
    expect(po.hraci[0].dedicstvo.map((k) => k.uid)).toContain(vidly.uid);
    expect(po.senok.map((k) => k.uid)).not.toContain(vidly.uid);
    // Víťaz Cintorín nevyužije.
    expect(() => apply(data, s, { type: "cintorin", uid: vidly.uid }, 1)).toThrow();
  });

  it("bez Nástroja v ruke aj v šenku, na inej lokalite a pri sekere sa Cintorín preskočí", () => {
    const bez = poCintorin(sHracom(vPitke("cintorin", [[lezi(inst("zamocnik"), 0)], silna(3)]), 0, { ruka: [inst("pijan")] }));
    expect(bez.bitkaStav?.krok === "cintorin" && bez.bitkaStav.caka !== null).toBe(false);
    const inde = poCintorin(sHracom(vPitke("zastavka", [[lezi(inst("zamocnik"), 0)], silna(3)]), 0, { ruka: [inst("puska")] }));
    expect(inde.bitkaStav?.krok === "cintorin" && inde.bitkaStav.caka !== null).toBe(false);
    // Sekera: prázdna línia, rovnako Absťákov aj Dlhov — porazený nie je.
    const s = sHracom(sHracom(vPitke("cintorin", [[], []]), 0, { ruka: [inst("puska")] }), 1, { ruka: [inst("vidly")] });
    const sekera = poCintorin(s);
    expect(sekera.nastenka.at(-1)?.vitaz).toBeNull();
    expect(sekera.bitkaStav?.krok === "cintorin" && sekera.bitkaStav.caka !== null).toBe(false);
    expect(sekera.hraci[0].dedicstvo).toHaveLength(0);
    expect(sekera.hraci[1].dedicstvo).toHaveLength(0);
  });
});

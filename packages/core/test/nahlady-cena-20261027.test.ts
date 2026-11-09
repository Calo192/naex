// Náhľady sľubujú inú cenu, než hra zúčtuje — návrh #1 / roadmapa #49, dorobenie
// (Michal 2026-10-27, playtesty 20261027-062058 a 20261027-105422, nočné
// nezrovnalosti 20261026). Každý náhľad sa porovná s motorom:
//  - rozsah nerozdelenej hádky (v10; predtým Pohoršení) = horná hranica toho, čo víťaz hádky dosiahne,
//  - hádka: bitka po pláne = poškodenie motora,
//  - najhoršia odpoveď na NA EX: žiadna skutočná odpoveď nedopadne horšie,
//  - limit ďalšieho kola po NA EX ráta akciu Poldeci,
//  - odhad „do konca“ ráta Noviny, náhľad vyloženia bonus Psa.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { BattleOutcome, BitkaStav, CardInstance, Command, DamageResult, GameState, PlayerId } from "../src/index.ts";
import {
  apply,
  battleOutcome,
  silaPriazne,
  cenaKliatby,
  evaluateLine,
  favourStarsieho,
  legalCommands,
  limitBonus,
  limitBuduceKolo,
  lineState,
  loadGameData,
  moznostiNaex,
  mozeHrat,
  nahladNaexNaKartu,
  najhorsiaOdpovedNaNaex,
  naTahu,
  nerozdelenaHadka,
  planRozdelenia,
  poskodenieStola,
  rngInt,
  rngSeed,
  sPrilozenou,
  setupGame,
  stolPriPoskodeni,
  viewFor,
  vyhladDlhov,
} from "../src/index.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

const kto = (s: GameState): PlayerId | null => ([0, 1] as const).find((q) => mozeHrat(s, q)) ?? naTahu(s);
const supera = (p: PlayerId): PlayerId => (p === 0 ? 1 : 0);

/** Ako dobre bitka dopadne pre hráča p — rovnako ako hrozba: víťaz, potom prebytok. */
function hodnota(v: BattleOutcome, p: PlayerId): number {
  const vitaz = v.vitaz === null ? 0 : v.vitaz === p ? 1 : -1;
  const prebytok = v.prebytokDrzi === null ? 0 : v.prebytokDrzi === p ? v.prebytok : -v.prebytok;
  return vitaz * 1000 + prebytok;
}

/** Partie náhodnými legálnymi ťahmi; `vezmi` vyberie stavy na porovnanie (z rozdania najviac `naRozdanie`). */
function stavy(seedy: readonly number[], vezmi: (s: GameState) => boolean, naRozdanie: number): { s: GameState; seed: number }[] {
  const out: { s: GameState; seed: number }[] = [];
  for (const seed of seedy) {
    let s = setupGame(data, seed);
    let rng = rngSeed(seed * 31 + 7);
    let n = 0;
    for (let krok = 0; s.koniec === null && krok < 3000 && n < naRozdanie; krok++) {
      if (vezmi(s)) {
        out.push({ s, seed });
        n++;
      }
      const q = kto(s);
      if (q === null) break;
      const cmds = legalCommands(data, s, q).filter((c) => c.type !== "vzdat");
      const [i, r] = rngInt(rng, 2 ** 31);
      rng = r;
      s = apply(data, s, cmds[i % cmds.length] as Command, q).state;
    }
  }
  return out;
}

// Rozsah hádky a bitka po pláne hádky (v10) zanikli s v11 — hádka poškodenie nemení.

/** Posledná Pitka, hráč p smie NA EX, súper skryté NA EX nemá, lícom dole nič a nie Krčma. */
function predNaex(s: GameState): boolean {
  const pitka = s.pitkaStav;
  if (s.faza !== "pitka" || pitka === null || s.vizia !== null || pitka.reakcia !== null || s.pitkaCislo !== s.pitkyCelkom) return false;
  if (s.ciel?.lokalita?.defId === "krcma") return false;
  const p = naTahu(s);
  if (p === null || pitka.hotovy[p] || (pitka.skryteNaex ?? []).some((x) => x.hrac !== p)) return false;
  if (s.strany.flat().some((pl) => pl.zaverecna === true)) return false;
  return moznostiNaex(data, s, p).length > 0;
}

const cenyKliatob = (): [{ cirhoza: number; dlh: number }, { cirhoza: number; dlh: number }] =>
  [0, 1].map(() => ({ cirhoza: cenaKliatby("cirhoza"), dlh: cenaKliatby("dlh") })) as [
    { cirhoza: number; dlh: number },
    { cirhoza: number; dlh: number },
  ];

/** Po NA EX hráča p obaja skončia Pitku bez ďalšieho NA EX — stav, keď súper smie odpovedať (alebo null). */
function naOdpoved(s0: GameState, p: PlayerId, uid: number): GameState | null {
  let s = apply(data, s0, { type: "naex", uid }, p).state;
  for (let i = 0; i < 40 && s.faza === "pitka" && s.pitkaStav !== null; i++) {
    if (s.pitkaStav.reakcia === supera(p)) return s;
    if (s.pitkaStav.reakcia !== null || s.vizia !== null) return null;
    const q = naTahu(s);
    if (q === null) return null;
    const cmd = legalCommands(data, s, q).find((c) => c.type === "skipNaex");
    if (cmd === undefined) return null;
    s = apply(data, s, cmd, q).state;
  }
  return null;
}

describe("najhoršia odpoveď na NA EX: žiadna skutočná odpoveď nedopadne horšie (playtest 20261026-173610-3 N5)", () => {
  const vzorky = stavy(Array.from({ length: 60 }, (_, i) => 4000 + i), predNaex, 1);

  it("každá legálna odpoveď súpera z jeho skutočnej ruky je nanajvýš taká zlá ako náhľad", () => {
    let odpovede = 0;
    let trafene = 0;
    for (const { s, seed } of vzorky) {
      const p = naTahu(s) as PlayerId;
      const su = supera(p);
      const view = viewFor(data, s, p);
      for (const uid of moznostiNaex(data, s, p)) {
        const n = nahladNaexNaKartu(data, view, uid, cenyKliatob());
        if (n === null) continue;
        const r = naOdpoved(s, p, uid);
        if (r === null) continue;
        const najhorsia = najhorsiaOdpovedNaNaex(data, n);
        const hranica = najhorsia === null ? hodnota(battleOutcome(n.po), p) : hodnota(najhorsia.vysledok, p);
        for (const c of legalCommands(data, r, su)) {
          // Odpoveď je bežné vyloženie (place) do línie.
          if (c.type !== "place" || (c.target !== "vlastna" && c.target !== "superova")) continue;
          const karta = r.hraci[su].ruka.find((k) => k.uid === c.uid);
          // Nástup Snúbenice vymení kartu s NA EX — náhľad ho nepredvída (napísané v najhorsiaOdpoved).
          if (karta === undefined || karta.defId === "snubenica") continue;
          const { state: t, events } = apply(data, r, c, su);
          const v = viewFor(data, t, p);
          // Bez hádky (mäkké 0 : 0, v10) sa bitka vyhodnotí hneď v tom istom ťahu — poškodenie je v udalosti.
          const vysledok = events.find((e) => e.type === "bitkaVysledok");
          const d = vysledok?.type === "bitkaVysledok" ? vysledok.damage : poskodenieStola(data, stolPriPoskodeni(data, v, n.dalsiePitky[1]));
          const h = hodnota(battleOutcome(d), p);
          odpovede++;
          expect(h, `seed ${seed}: NA EX na ${uid}, odpoveď ${karta.defId} → ${c.target}`).toBeGreaterThanOrEqual(hranica);
          if (najhorsia !== null && h === hranica) trafene++;
        }
      }
    }
    expect(odpovede).toBeGreaterThanOrEqual(100);
    expect(trafene).toBeGreaterThan(0);
  }, 30000);

  it("Dievčina na vydaj na vonkajšiu hranu Pijana: odpoveď zruší, čo NA EX zdvojilo", () => {
    // N5: NA EX na Pijana na konci línie ukázal 6 : 3, odpoveď Dievčinou dala 6 : 4.
    // Náhľad musí sľúbiť aspoň takú zlú odpoveď, ako bola skutočná.
    let najdene = 0;
    for (const { s } of vzorky) {
      const p = naTahu(s) as PlayerId;
      const view = viewFor(data, s, p);
      for (const uid of moznostiNaex(data, s, p)) {
        const n = nahladNaexNaKartu(data, view, uid, cenyKliatob());
        if (n === null) continue;
        const o = najhorsiaOdpovedNaNaex(data, n);
        if (o === null) continue;
        najdene++;
        expect(hodnota(o.vysledok, p)).toBeLessThan(hodnota(battleOutcome(n.po), p));
        expect(data.cards.has(o.karta.defId)).toBe(true);
      }
    }
    expect(najdene).toBeGreaterThan(10);
    // Dlhý výpočet (náhľad každého NA EX aj najhoršej odpovede) — na vyťaženom stroji nad 5 s.
  }, 30_000);
});

describe("limit ďalšieho kola po NA EX ráta akciu Poldeci (playtest 20261026-173610-1 N2)", () => {
  const vzorky = stavy(Array.from({ length: 80 }, (_, i) => 5000 + i), predNaex, 1);

  /** Dohrá Pitku a bitku prvými legálnymi ťahmi po začiatok ďalšieho kola. */
  function doDalsiehoKola(s0: GameState): GameState {
    let s = s0;
    const kolo = s0.kolo;
    for (let i = 0; i < 300 && s.koniec === null && s.kolo === kolo; i++) {
      const q = kto(s);
      if (q === null) break;
      const legal = legalCommands(data, s, q).filter((c) => c.type !== "vzdat");
      const cmd = legal.find((c) => c.type === "skipNaex") ?? legal.find((c) => c.type === "bezReakcie") ?? legal[0];
      if (cmd === undefined) break;
      s = apply(data, s, cmd, q).state;
    }
    return s;
  }

  it("plné poldeci na začiatku ďalšieho kola = náhľad NA EX na danú kartu", () => {
    let porovnane = 0;
    let sAkciou = 0;
    for (const { s, seed } of vzorky) {
      const p = naTahu(s) as PlayerId;
      // Kšeft väzňa (v9) stojí poldeci podľa voľby hráča — náhľad ho nepredvída.
      if (s.vazni.length > 0) continue;
      const view = viewFor(data, s, p);
      for (const uid of moznostiNaex(data, s, p)) {
        const n = nahladNaexNaKartu(data, view, uid, cenyKliatob());
        if (n === null || n.dalsiePitky[1] !== 0) continue;
        const t = doDalsiehoKola(apply(data, s, { type: "naex", uid }, p).state);
        if (t.koniec !== null || t.kolo === s.kolo || t.faza === "draft") continue;
        const ocakavane = limitBuduceKolo(n.odkrytie.view, p, false, data) - 1 - limitBonus(n.odkrytie.view, p);
        expect(t.hraci[p].poldeciPlne, `seed ${seed}: NA EX na ${uid}`).toBe(ocakavane);
        porovnane++;
        if ((evaluateLine(data, lineState(n.odkrytie.view)).sums[p].Poldeci ?? 0) > 0) sAkciou++;
      }
    }
    expect(porovnane).toBeGreaterThanOrEqual(40);
    expect(sAkciou).toBeGreaterThan(0);
  });
});




describe("výhľad Dlhov cez viac Pitiek kola = Dlhy po Exekútorovi (roadmapa #49)", () => {
  /** Prvá z viacerých Pitiek kola, lícom dole nič, nikto nemá skryté NA EX; Krčma by NA EX vynútila. */
  const vhodny = (s: GameState): boolean =>
    s.faza === "pitka" &&
    (s.hasicVolby ?? []).length === 0 &&
    s.ciel?.lokalita?.defId !== "krcma" &&
    s.vizia === null &&
    s.pitkaStav !== null &&
    s.pitkaStav.reakcia === null &&
    s.pitkaCislo < s.pitkyCelkom &&
    (s.pitkaStav.skryteNaex ?? []).length === 0 &&
    !s.strany.flat().some((pl) => pl.zaverecna === true);
  const vzorky = stavy(Array.from({ length: 80 }, (_, i) => 7000 + i), vhodny, 1);

  /** Nikto nič nevyloží ani nedá NA EX — stôl ostane, Pitky sa opakujú; bitka po krok Pohoršenia. */
  function poExekutora(s0: GameState): GameState {
    let s = s0;
    for (let i = 0; i < 200 && s.koniec === null; i++) {
      const b = s.bitkaStav;
      // Exekúcia ide od 2026-10-28 až po poškodení — Dlhy po nej sú hotové, keď je poškodenie.
      if (b !== null && b.damage !== null) return s;
      const q = kto(s);
      if (q === null) break;
      const legal = legalCommands(data, s, q);
      const cmd =
        legal.find((c) => c.type === "skipNaex") ??
        legal.find((c) => c.type === "pass") ??
        legal.find((c) => c.type === "bezReakcie") ??
        legal.find((c) => c.type === "vizia" && c.vziat) ??
        legal[0];
      if (cmd === undefined) break;
      s = apply(data, s, cmd, q).state;
    }
    return s;
  }

  it("Dlhy z každej ďalšej Pitky, pálenie aj exekúcia sedia s motorom", () => {
    let porovnane = 0;
    let viacDlhov = 0;
    for (const { s, seed } of vzorky) {
      const t = poExekutora(s);
      if (t.faza !== "bitka" || t.kolo !== s.kolo) continue;
      // Pohoršenia v bitke idú od 2026-10-28 pred exekúciou a smú pohnúť priazňou Exekútora — to výhľad nevie.
      for (const p of [0, 1] as const) {
        // Priazne Robota a Advokát (v9) sa smú v bitke pohnúť Poverami a Pohoršeniami — to výhľad nevie.
        if (silaPriazne(data, s, "ROBOTA", p) !== silaPriazne(data, t, "ROBOTA", p)) continue;
        const view = viewFor(data, s, p);
        const vyhlad = vyhladDlhov(data, view, s.pitkyCelkom - s.pitkaCislo)[p];
        const dlhy = t.hraci[p].dlhy;
        expect(vyhlad.poBitke, `seed ${seed} kolo ${s.kolo}, hráč ${p}`).toBe(dlhy);
        porovnane++;
        if (vyhlad.nove >= 2) viacDlhov++;
      }
    }
    expect(porovnane).toBeGreaterThanOrEqual(40);
    expect(viacDlhov).toBeGreaterThan(0);
  });
});

describe("Vandal ako odpoveď na NA EX (seed 4016, sada v51)", () => {
  it("náhľad (sPrilozenou) otočí lokalitu ako Nástup v motore — najhoršia odpoveď s ním ráta", () => {
    const s0 = setupGame(data, 4016);
    const vandal: CardInstance = { uid: 990001, defId: "vandal", leftLayout: 0, rightLayout: 0 };
    const pijan: CardInstance = { uid: 990002, defId: "pijan", leftLayout: 0, rightLayout: 0 };
    const s: GameState = {
      ...s0,
      faza: "zhromazdenie",
      utocnik: 0,
      ciel: { typ: "lokalita", lokalita: s0.lokalityVHre[0]! },
      pitkyCelkom: 1,
      pitkaCislo: 0,
      strany: [[{ card: pijan, playedBy: 0 }], []],
      hraci: [{ ...s0.hraci[0], ruka: [vandal], poldeciPlne: 2 }, s0.hraci[1]],
      zhromazdenieStav: { naTahu: 0, zostavaLimit: [2, 2], pasoval: [false, false], navyse: [0, 0] },
    };
    for (const target of ["vlastna", "superova"] as const) {
      const motor = apply(data, s, { type: "place", uid: vandal.uid, target }, 0).state;
      const nahlad = sPrilozenou(data, s, target === "vlastna" ? 0 : 1, vandal, 0);
      expect(motor.lokalitaOtocena).toBe(!s.lokalitaOtocena);
      expect(nahlad.lokalitaOtocena).toBe(motor.lokalitaOtocena);
      expect(evaluateLine(data, lineState(nahlad)).sums).toEqual(evaluateLine(data, lineState(motor)).sums);
    }
  });
});

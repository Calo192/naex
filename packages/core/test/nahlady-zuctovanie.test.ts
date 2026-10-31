// Náhľad NA EX = skutočné zúčtovanie (návrh #49, Michal 2026-10-26 „áno, celá cena“).
// Pre sadu rozdaní (seedy) sa partia dohrá náhodnými legálnymi ťahmi do poslednej
// Pitky kola. Tam sa porovná náhľad NA EX na každú možnú kartu (nahladNaexNaKartu,
// to isté volá klient) so stavom motora po NA EX oproti stavu bez neho: cigarety
// (Pitka, Svokra, Výpalné), Cirhózy, Dlhy (aj Vychovávateľka), Pohoršenia (aj
// zrušené Policajtkou), tuhé, mäkké a prebytok (Puška, Miňištrant).
// Súper NA EX nedá a neodpovie — náhľad to tak sľubuje.

import { describe, expect, it } from "vitest";
// Sada v6 (pred revíziou v7): test stráži pravidlá, ktoré revízia sady nemení.
import cardsJson from "./data/cards-v6.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { ActionSums, ClientState, Command, DamageResult, GameState, PlayerId } from "../src/index.ts";
import {
  apply,
  partiaHraca,
  battleOutcome,
  cenaKliatby,
  dalsiePitkyKola,
  legalCommands,
  loadGameData,
  moznostiNaex,
  mozeHrat,
  nahladNaexNaKartu,
  naTahu,
  pohorseniaVBitke,
  poskodenieBitky,
  prebytokNaRozdelenie,
  rngInt,
  rngSeed,
  setupGame,
  sMojimiSkrytymiNaex,
  stolPriPoskodeni,
  viewFor,
} from "../src/index.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

const kto = (s: GameState): PlayerId | null => ([0, 1] as const).find((q) => mozeHrat(s, q)) ?? naTahu(s);

/**
 * Posledná Pitka kola, hráč p na ťahu smie NA EX, súper skryté NA EX nemá a lícom
 * dole neleží žiadna Záverečná — čo je skryté, náhľad nepozná a nesľubuje.
 */
function vhodna(s: GameState): PlayerId | null {
  const pitka = s.pitkaStav;
  if (s.faza !== "pitka" || pitka === null || s.koniec !== null || s.vizia !== null || pitka.reakcia !== null) return null;
  if (s.pitkaCislo !== s.pitkyCelkom) return null;
  // Krčma: súper by NA EX dať musel — mohol by trafiť tú istú kartu.
  if (s.ciel?.lokalita?.defId === "krcma") return null;
  const p = naTahu(s);
  if (p === null || pitka.hotovy[p]) return null;
  if ((pitka.skryteNaex ?? []).some((x) => x.hrac !== p)) return null;
  // Záverečná lícom dole sa na konci Pitky otočí: súperovu náhľad nepozná, Nástup ani vlastnej
  // (napr. Snúbenica vymení kartu s NA EX) nepredvída.
  if (s.strany.flat().some((pl) => pl.zaverecna === true)) return null;
  return moznostiNaex(data, s, p).length > 0 ? p : null;
}

/** Stavy na porovnanie: z každého rozdania najviac dva, partia ide náhodnými legálnymi ťahmi. */
function vzorky(seedy: readonly number[]): { s: GameState; p: PlayerId; seed: number }[] {
  const out: { s: GameState; p: PlayerId; seed: number }[] = [];
  for (const seed of seedy) {
    let s = setupGame(data, seed);
    let rng = rngSeed(seed * 13 + 5);
    let n = 0;
    for (let krok = 0; s.koniec === null && krok < 3000 && n < 2; krok++) {
      const v = vhodna(s);
      if (v !== null) {
        out.push({ s, p: v, seed });
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

/**
 * Dohrá Pitku bez ďalších rozhodnutí: nikto ďalšie NA EX nedá ani neodpovie, Vízia
 * berie kartu do ruky. Vráti prvý stav po Pitke (bitka začala alebo kolo pokračuje).
 */
function poPitke(s0: GameState): GameState {
  let s = s0;
  for (let i = 0; i < 60 && s.faza === "pitka" && s.koniec === null; i++) {
    const q = naTahu(s);
    if (q === null) break;
    const legal = legalCommands(data, s, q);
    const cmd =
      legal.find((c) => c.type === "skipNaex") ??
      legal.find((c) => c.type === "bezReakcie") ??
      legal.find((c) => c.type === "vizia" && c.vziat) ??
      legal[0];
    if (cmd === undefined) break;
    s = apply(data, s, cmd, q).state;
  }
  return s;
}

/**
 * Bitka po Pitke po prvé Pohoršenie alebo po poškodenie: Kar nič nezahodí, Benzínka
 * a Exekútor prvou legálnou možnosťou — zapamätá si, ktoré padli. Pohoršenia hýbu
 * markermi, a tým priazňou (Bitkár, Veriaci) podľa voľby hráča — pred nimi je stôl
 * taký, aký náhľad sľubuje.
 */
function doPoskodenia(s0: GameState): { readonly s: GameState; readonly rozhodnutia: ReadonlySet<string> } {
  let s = s0;
  const rozhodnutia = new Set<string>();
  const caka = (t: GameState): boolean => (t.bitkaStav?.krok === "pohorsenie" || t.bitkaStav?.krok === "povery") && t.bitkaStav.caka !== null;
  for (let i = 0; i < 80 && s.faza === "bitka" && s.bitkaStav?.damage == null && !caka(s) && s.koniec === null; i++) {
    const q = naTahu(s);
    if (q === null) break;
    const legal = legalCommands(data, s, q);
    const cmd = legal.find((c) => c.type === "kar" && c.uid === null) ?? legal[0];
    if (cmd === undefined) break;
    rozhodnutia.add(cmd.type);
    s = apply(data, s, cmd, q).state;
  }
  return { s, rozhodnutia };
}

const dlhy = (s: { readonly hraci: GameState["hraci"] | ClientState["hraci"] }, q: PlayerId): number => s.hraci[q].dlhy;

describe("náhľad NA EX == zúčtovanie motora (seedy)", () => {
  const stavy = vzorky(Array.from({ length: 100 }, (_, i) => 1000 + i));

  it("vzoriek je dosť na porovnanie", () => {
    expect(stavy.length).toBeGreaterThanOrEqual(100);
  });

  it("cigarety, Cirhózy, Dlhy, Pohoršenia, tuhé, mäkké a Nakladačka sedia", () => {
    let porovnane = 0;
    let bitky = 0;
    for (const { s, p, seed } of stavy) {
      const view = viewFor(data, s, p);
      const ceny = ([0, 1] as const).map(() => ({ cirhoza: cenaKliatby("cirhoza"), dlh: cenaKliatby("dlh") })) as [
        { cirhoza: number; dlh: number },
        { cirhoza: number; dlh: number },
      ];
      const su: PlayerId = p === 0 ? 1 : 0;
      const bez = poPitke(s);
      const bezBitka = doPoskodenia(bez);
      const zaklad = sMojimiSkrytymiNaex(data, view);
      for (const uid of moznostiNaex(data, s, p)) {
        // NA EX na súperovu skrytú Záverečnú: čo je na nej, náhľad nevie (a nesmie vedieť).
        if (!view.strany.flat().some((pl) => pl.card.uid === uid)) continue;
        const n = nahladNaexNaKartu(data, view, uid, ceny);
        expect(n).not.toBeNull();
        if (n === null) continue;
        if (n.dalsiePitky[1] !== 0) continue;
        const s1 = poPitke(apply(data, s, { type: "naex", uid }, p).state);
        // Porovnáva sa stav, kde bitka čaká pred poškodením: zúčtovaná Pitka a súčty bitky, NA EX ešte na kartách.
        const b1 = s1.bitkaStav;
        const b0 = bez.bitkaStav;
        if (s1.faza !== "bitka" || bez.faza !== "bitka" || b1 === null || b0 === null || b1.damage !== null || b0.damage !== null) continue;
        const kde = `seed ${seed} kolo ${s.kolo}, hráč ${p}, NA EX na ${uid}`;
        if (s.ciel?.lokalita?.defId !== "benzinka") expect(n.liniaPo.sums, `${kde}: súčty akcií v bitke`).toEqual(b1.sums);
        for (const q of [0, 1] as const) {
          expect(n.dopady[q].cigarety, `${kde}: cigarety hráča ${q}`).toBe(s1.hraci[q].cigarety - bez.hraci[q].cigarety);
          expect(n.kliatby[q].cirhozy + n.kliatby[q].dalejCirhozy, `${kde}: Cirhózy hráča ${q}`).toBe(s1.cirhozyVKole[q] - bez.cirhozyVKole[q]);
          // Bitka ráta Pohoršenia zo svojich súčtov (nastavSumy) — tým istým výpočtom ako náhľad.
          const pA = pohorseniaVBitke(data, s1, b1.sums)[q];
          const pB = pohorseniaVBitke(data, bez, b0.sums)[q];
          expect(n.dopady[q].pohorseniaSpolu, `${kde}: Pohoršenia hráča ${q}`).toBe(pA);
          expect(n.dopady[q].pohorsenia, `${kde}: Pohoršenia navyše hráča ${q}`).toBe(pA - pB);
        }
        porovnane++;
        // Bitka až po poškodenie. Benzínka mení líniu voľbou hráča — tú náhľad nepredvída.
        if (s.ciel?.lokalita?.defId === "benzinka") continue;
        const sNaex = doPoskodenia(s1);
        const dA = sNaex.s.bitkaStav;
        const dB = bezBitka.s.bitkaStav;
        if (sNaex.s.faza !== "bitka" || bezBitka.s.faza !== "bitka" || dA == null || dB == null) continue;
        for (const q of [0, 1] as const) {
          // Robota a Exekútor bežia hneď po poškodení v tom istom ťahu — potom už Dlhy nie sú tie „pri poškodení“.
          if (dA.exekutorHotovy[q] || dB.exekutorHotovy[q]) continue;
          // Priznané Dlhy pri poškodení — strop súperovho mäkkého.
          expect(dlhy(stolPriPoskodeni(data, n.odkrytie.view, 0), q), `${kde}: Dlhy pri poškodení, hráč ${q}`).toBe(dlhy(sNaex.s, q));
          expect(dlhy(stolPriPoskodeni(data, zaklad, 0), q), `${kde}: Dlhy bez NA EX, hráč ${q}`).toBe(dlhy(bezBitka.s, q));
          // Dlhy po bitke (po exekúcii, ktorá ide od 2026-10-28 až po poškodení) overuje test výhľadu Dlhov.
        }
        // Pohoršenia, ktoré bitka hráčovi pridelila (prvý, kto ich má, ešte nezačal).
        for (const q of [0, 1] as const) {
          if (dA.damage === null && dA.pohorsenieZostava[q] > 0) expect(n.dopady[q].pohorseniaSpolu, `${kde}: Pohoršenia v bitke, hráč ${q}`).toBe(dA.pohorsenieZostava[q]);
        }
        // Poškodenie: hotové z bitky, alebo pred Pohoršeniami tým istým výpočtom ako vyhodnotPoskodenie.
        const poskodenie = (t: GameState): DamageResult => t.bitkaStav?.damage ?? poskodenieBitky(data, t, t.bitkaStav!.sums);
        const pA = poskodenie(sNaex.s);
        const pB = poskodenie(bezBitka.s);
        expect(n.po.tuhe, `${kde}: tuhé`).toEqual(pA.tuhe);
        expect(n.po.makke, `${kde}: mäkké`).toEqual(pA.makke);
        expect(n.pred.tuhe, `${kde}: tuhé bez NA EX`).toEqual(pB.tuhe);
        expect(n.pred.makke, `${kde}: mäkké bez NA EX`).toEqual(pB.makke);
        for (const q of [0, 1] as const) expect(n.dopady[q].makke, `${kde}: mäkké navyše, hráč ${q}`).toBe(pA.makke[q] - pB.makke[q]);
        const vysledok = battleOutcome(pA);
        expect(n.prebytokPo.drzi, `${kde}: Nakladačku drží`).toBe(vysledok.prebytokDrzi);
        expect(n.prebytokPo.naRozdelenie, `${kde}: Nakladačka na rozdelenie (Puška)`).toBe(prebytokNaRozdelenie(sNaex.s, vysledok));
        if (dA.damage !== null && dA.krok === "prebytok" && dA.prebytokPosunute.length === 0 && dA.caka !== null) {
          expect(n.prebytokPo.naRozdelenie, `${kde}: Nakladačka v bitke`).toBe(dA.prebytokZostava);
        }
        bitky++;
      }
    }
    expect(porovnane).toBeGreaterThanOrEqual(200);
    expect(bitky).toBeGreaterThanOrEqual(200);
  });

  it("ďalšie Pitky kola v náhľade = počet Pitiek motora", () => {
    let porovnane = 0;
    for (let seed = 2000; seed < 2015; seed++) {
      let s = setupGame(data, seed);
      let rng = rngSeed(seed);
      for (let krok = 0; s.koniec === null && krok < 2000; krok++) {
        // Súperovu Záverečnú lícom dole pohľad nemá — línia by bola iná.
        const skryte = s.strany.flat().some((pl) => pl.zaverecna === true && pl.playedBy !== 0);
        if ((s.faza === "pitka" || s.faza === "zhromazdenie") && s.vizia === null && !skryte) {
          const zacate = s.faza === "pitka" ? s.pitkaCislo : s.pitkaCislo + 1;
          expect(dalsiePitkyKola(data, viewFor(data, s, 0)), `seed ${seed}, krok ${krok}`).toBe(s.pitkyCelkom - zacate);
          porovnane++;
        }
        const q = kto(s);
        if (q === null) break;
        const cmds = legalCommands(data, s, q).filter((c) => c.type !== "vzdat");
        const [i, r] = rngInt(rng, 2 ** 31);
        rng = r;
        s = apply(data, s, cmds[i % cmds.length] as Command, q).state;
      }
    }
    expect(porovnane).toBeGreaterThan(200);
  });
});

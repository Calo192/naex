// Rekapitulácia bitky a Pitky (roadmapa #106, Michal 2026-10-26): čísla pod Počítadlom
// bitky a po Pitke musia sedieť so skutočným zúčtovaním motora — tuhé, mäkké a rušenie
// Viery s Poverou s poškodením bitky, Dlhy, Cirhózy a cigarety s vyhodnotením Pitky,
// blok „z Pitiek kola“ so súčtom Pitiek. NA EX sa ráta majiteľovi karty.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { CardInstance, Command, Event, GameState, PlacedCard, PlayerId, RekapitulaciaPitky } from "../src/index.ts";
import {
  apply,
  AKCIE_TUHE,
  evaluateLine,
  loadGameData,
  naTahu,
  pecenPitky,
  rngInt,
  rngSeed,
  setupGame,
  tahBota,
  ucinokNaex,
  viewFor,
  zadlzeniePitky,
} from "../src/index.ts";
import type { Layout4 } from "./helpers.ts";
import { EMPTY, instanceFor, makeDef, syntheticData } from "./helpers.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

interface Zaznam {
  readonly pred: GameState;
  readonly po: GameState;
  readonly events: readonly Event[];
}

/** Celá partia dvoch botov — každý príkaz so stavom pred a po. */
function partia(seed: number): Zaznam[] {
  let s = setupGame(data, seed, { lokalit: 4 });
  let rng = rngSeed(seed ^ 0x5a);
  const out: Zaznam[] = [];
  for (let i = 0; i < 20000 && s.koniec === null; i++) {
    const p = naTahu(s);
    if (p === null) break;
    const [j, r] = rngInt(rng, 2 ** 31);
    rng = r;
    const cmd: Command = tahBota(data, s, p, j, { povaha: i % 2 === 0 ? "stamgast" : "chamtivy" });
    const { state: po, events } = apply(data, s, cmd, p);
    out.push({ pred: s, po, events });
    s = po;
  }
  return out;
}

const SEMIENKA = [3, 8, 21];
const PARTIE = SEMIENKA.map(partia);

describe("rekapitulácia Pitky", () => {
  it("Dlhy, Cirhózy, cigarety a zvyšky sedia s vyhodnotením Pitky", () => {
    let pitiek = 0;
    let sCirhozou = 0;
    for (const zaznamy of PARTIE) {
      let vysledok: Extract<Event, { type: "pitkaVysledok" }> | null = null;
      // Cirhózy od začiatku Pitky podľa logu motora (aj tie z odkrytia NA EX).
      let cirhozy: [number, number] = [0, 0];
      for (const z of zaznamy) {
        for (const e of z.events) {
          if (e.type === "faza" && e.faza === "pitka") cirhozy = [0, 0];
          if (e.type === "log") {
            const m = /^Hráč (\d) získava Cirhózu/.exec(e.text);
            if (m !== null) cirhozy[(Number(m[1]) - 1) as PlayerId] += 1;
          }
          if (e.type === "pitkaVysledok") vysledok = e;
          if (e.type !== "pitkaRekap") continue;
          const r = e.rekap;
          pitiek++;
          expect(vysledok?.pitka).toBe(r.pitka);
          for (const p of [0, 1] as const) {
            expect(r.zadlzenie.dlhy[p]).toBe(vysledok?.dlhy[p]);
            expect(r.zadlzenie.dlhy[p]).toBe(Math.floor(zadlzeniePitky(r, p) / r.zadlzenie.prah));
            expect(r.cigarety.zisk[p]).toBe(vysledok?.cigarety[p]);
            expect(r.cigarety.zisk[p]).toBe(r.cigarety.akcie[p] - r.cigarety.obmedzenie[p] + r.cigarety.cigorky[p]);
            expect(r.cigarety.cigorky[p]).toBeGreaterThanOrEqual(0);
            // Všetka pečeň Pitky: celé prahy = Cirhózy (aj z NA EX pri odkrytí), zvyšok prepadne.
            expect(r.pecen.cirhozy[p]).toBe(cirhozy[p]);
            expect(r.pecen.cirhozy[p]).toBe(Math.floor(pecenPitky(r, p) / r.pecen.prah[p]));
            if (r.pecen.cirhozy[p] > 0) sCirhozou++;
          }
          // Zvyšok pod prahom, ktorý motor po Pitke vynuluje (log dokonciPitku).
          for (const p of [0, 1] as const) {
            const riadok = z.events.find((x) => x.type === "log" && x.text.startsWith(`Hráč ${p + 1}: po Pitke sa pečeň`));
            const m = riadok?.type === "log" ? /pečeň \((\d+)\) a zadĺženie \((\d+)\)/.exec(riadok.text) : null;
            expect(Number(m?.[1] ?? 0)).toBe(pecenPitky(r, p) - r.pecen.cirhozy[p] * r.pecen.prah[p]);
            expect(Number(m?.[2] ?? 0)).toBe(zadlzeniePitky(r, p) - r.zadlzenie.dlhy[p] * r.zadlzenie.prah);
          }
          // Až po otočení Záverečných — inak by prezradila súperovu kartu lícom dole.
          expect(z.po.strany.flat().some((pl) => pl.zaverecna === true)).toBe(false);
        }
      }
    }
    expect(pitiek).toBeGreaterThan(8);
    expect(sCirhozou).toBeGreaterThan(0);
  });

  it("pohľad hráča nenesie rekapitulácie Pitiek kola", () => {
    const z = PARTIE[0]!.find((x) => (x.po.pitkyKola ?? []).length > 0);
    expect(z).toBeDefined();
    const v = viewFor(data, z!.po, 0) as unknown as Record<string, unknown>;
    expect(v["pitkyKola"]).toBeUndefined();
    expect(v["zaciatokPitky"]).toBeUndefined();
  });
});

describe("rekapitulácia bitky", () => {
  it("tuhé, Viera × Povera, mäkké a blok z Pitiek kola sedia s poškodením bitky", () => {
    let bitiek = 0;
    let sPoverou = 0;
    let sPitkami = 0;
    for (const zaznamy of PARTIE) {
      let pitkyKola: RekapitulaciaPitky[] = [];
      for (const z of zaznamy) {
        for (const e of z.events) {
          if (e.type === "pitkaRekap") pitkyKola.push(e.rekap);
          if (e.type !== "bitkaVysledok") continue;
          const r = e.rekap;
          expect(r).toBeDefined();
          if (r === undefined) continue;
          bitiek++;
          const d = e.damage;
          expect(r.tuheSpolu).toEqual([d.tuhe[0], d.tuhe[1]]);
          expect(r.makke).toEqual([d.makke[0], d.makke[1]]);
          expect(r.celkove).toEqual([d.celkove[0], d.celkove[1]]);
          expect(r.vitaz).toBe(e.vitaz);
          expect(r.prebytok).toBe(e.prebytok);
          const sucet = (xs: readonly { kto: PlayerId; n: number }[], p: PlayerId): number => xs.filter((x) => x.kto === p).reduce((a, x) => a + x.n, 0);
          for (const p of [0, 1] as const) {
            const q: PlayerId = p === 0 ? 1 : 0;
            // Jednotky tuhého = súčty akcií, z ktorých bitka rátala.
            for (const a of AKCIE_TUHE) expect(sucet(r.tuhe[a], p)).toBe(e.sums[p][a] ?? 0);
            // Viera a Povera: rušia sa v dvojiciach — moja Viera so súperovou Poverou.
            expect(sucet(r.viera, p) - r.zrusenaViera[p]).toBe(d.zvysnaViera[p]);
            expect(sucet(r.povera, p) - r.zrusenaPovera[p]).toBe(d.zvysnaPovera[p]);
            expect(r.zrusenaViera[p]).toBe(r.zrusenaPovera[q]);
            expect(r.zrusenaViera[p]).toBe(Math.min(sucet(r.viera, p), sucet(r.povera, q)));
            // Zvyšná Povera zaberie najviac na súperove priznané Dlhy.
            expect(r.makke[p]).toBe(Math.min(d.zvysnaPovera[p], r.makkeStrop[p]));
            if (!r.bezStropu[p]) expect(r.makkeStrop[p]).toBeGreaterThanOrEqual(r.priznaneDlhy[q]);
            expect(sucet(r.pohorsenie.polozky, p)).toBe(r.pohorsenie.spolu[p]);
            if (sucet(r.povera, p) > 0) sPoverou++;
          }
          // Blok „z Pitiek kola“ = súčet rekapitulácií Pitiek tohto kola.
          expect(r.pitkyKola?.pocet ?? 0).toBe(pitkyKola.length);
          if (r.pitkyKola !== null) {
            sPitkami++;
            for (const p of [0, 1] as const) {
              expect(r.pitkyKola.dlhy[p]).toBe(pitkyKola.reduce((a, x) => a + x.zadlzenie.dlhy[p], 0));
              expect(r.pitkyKola.cirhozy[p]).toBe(pitkyKola.reduce((a, x) => a + x.pecen.cirhozy[p], 0));
              expect(r.pitkyKola.pecen[p]).toBe(pitkyKola.reduce((a, x) => a + pecenPitky(x, p), 0));
            }
            // Cirhózy kola sú tie isté, ktoré motor napočítal (cirhozyVKole pred koncom kola).
            if (z.po.faza === "bitka") expect(r.pitkyKola.cirhozy).toEqual([z.po.cirhozyVKole[0], z.po.cirhozyVKole[1]]);
          }
          pitkyKola = [];
        }
      }
    }
    expect(bitiek).toBeGreaterThan(5);
    expect(sPoverou).toBeGreaterThan(0);
    expect(sPitkami).toBeGreaterThan(0);
  });
});

describe("NA EX v rekapitulácii (Michal 2026-10-26: majiteľovi karty)", () => {
  const lezi = (card: CardInstance, playedBy: PlayerId, naexBy?: PlayerId): PlacedCard =>
    naexBy === undefined ? { card, playedBy } : { card, playedBy, naexBy };
  // Posilňovač: Posilnenie na spoji, Rana bez partnera; partner: Pecka na spoji, Cigareta bez partnera.
  const POSIL: Layout4 = ["Posilnenie", "Rana", null, null];
  const PARTNER_L: Layout4 = ["Pecka", null, null, null];
  const PARTNER_P: Layout4 = ["Cigareta", null, null, null];
  const s = syntheticData([makeDef("posil", EMPTY, POSIL), makeDef("partner", PARTNER_L, PARTNER_P)]);

  it("zrušené aktívne a zdvojené neaktívne akcie idú majiteľovi, nie tomu, kto NA EX dal", () => {
    const partner = instanceFor(s, "partner", PARTNER_L, PARTNER_P);
    const posil = instanceFor(s, "posil", EMPTY, POSIL);
    const line = { lokalita: null, lokalitaOtocena: false, strany: [[lezi(partner, 0, 1), lezi(posil, 0)], []] as const };
    const r = ucinokNaex(s, line, evaluateLine(s, line));
    expect(r.karty).toEqual([{ uid: partner.uid, defId: "partner", majitel: 0, dal: 1, zdvojilo: 1, zrusilo: 1 }]);
    expect(r.zdvojilo).toEqual([1, 0]);
    expect(r.zrusilo).toEqual([1, 0]);
  });

  it("NA EX na Posilnení zruší Posilnenie a zdvojí neaktívnu Ranu", () => {
    const partner = instanceFor(s, "partner", PARTNER_L, PARTNER_P);
    const posil = instanceFor(s, "posil", EMPTY, POSIL);
    const line = { lokalita: null, lokalitaOtocena: false, strany: [[lezi(partner, 0), lezi(posil, 0, 0)], []] as const };
    const r = ucinokNaex(s, line);
    expect(r.karty).toEqual([{ uid: posil.uid, defId: "posil", majitel: 0, dal: 0, zdvojilo: 1, zrusilo: 1 }]);
    // Bez NA EX nič.
    expect(ucinokNaex(s, { ...line, strany: [[lezi(partner, 0), lezi(posil, 0)], []] }).karty).toEqual([]);
  });
});

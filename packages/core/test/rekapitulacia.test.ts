// Rekapitulácia bitky a Pitky (roadmapa #106, Michal 2026-10-26): čísla pod Počítadlom
// bitky a po Pitke musia sedieť so skutočným zúčtovaním motora — tuhé, mäkké a rušenie
// Viery s Poverou s poškodením bitky, Dlhy, Cirhózy a cigarety s vyhodnotením Pitky,
// blok „z Pitiek kola“ so súčtom Pitiek. NA EX sa ráta majiteľovi karty.

import { describe, expect, it } from "vitest";
// Sada v6 (pred revíziou v7): test stráži pravidlá, ktoré revízia sady nemení.
import cardsJson from "./data/cards-v6.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { CardInstance, Command, Event, GameState, PlacedCard, PlayerId, RekapitulaciaPitky } from "../src/index.ts";
import {
  akcieRekapitulacie,
  apply,
  AKCIE_PITKY,
  AKCIE_TUHE,
  evaluateLine,
  eventsFor,
  loadGameData,
  naTahu,
  pitkaPredBitkou,
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

/** Index ďalšej rekapitulácie Pitky v udalostiach príkazu (inak koniec zoznamu). */
function nasledujuca(events: readonly Event[], i: number): number {
  const j = events.findIndex((x, k) => k > i && x.type === "pitkaRekap");
  return j === -1 ? events.length : j;
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
        for (const [ie, e] of z.events.entries()) {
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
            expect(r.zadlzenie.dlhy[p]).toBe(Math.floor(zadlzeniePitky(r, p) / r.zadlzenie.prah[p]));
            expect(r.cigarety.zisk[p]).toBe(vysledok?.cigarety[p]);
            expect(r.cigarety.zisk[p]).toBe(r.cigarety.akcie[p] - r.cigarety.obmedzenie[p] + r.cigarety.cigorky[p]);
            expect(r.cigarety.cigorky[p]).toBeGreaterThanOrEqual(0);
            // Všetka pečeň Pitky: celé prahy = Cirhózy (aj z NA EX pri odkrytí), zvyšok prepadne.
            expect(r.pecen.cirhozy[p]).toBe(cirhozy[p]);
            expect(r.pecen.cirhozy[p]).toBe(Math.floor(pecenPitky(r, p) / r.pecen.prah[p]));
            if (r.pecen.cirhozy[p] > 0) sCirhozou++;
            // Podrobný náhľad (Michal 2026-10-30): súčet ikon = číslo riadku, zrušené dali 0.
            const podrobne = (a: (typeof AKCIE_PITKY)[number]): number => (r.akcie?.[a] ?? []).filter((x) => x.kto === p).reduce((n, x) => n + x.n, 0);
            expect(podrobne("Dlh")).toBe(r.zadlzenie.zoStola[p]);
            expect(podrobne("PoškodeniePečene")).toBe(r.pecen.poskodenie[p]);
            expect(podrobne("Poldeci")).toBe(r.pecen.poldeci[p]);
            expect(podrobne("Cigareta")).toBe(r.cigarety.akcie[p]);
            expect(podrobne("Vízia")).toBe(r.vizia[p]);
          }
          // Zvyšok pečene pod prahom motor po Pitke vynuluje (log dokonciPitku); zadĺženie
          // od v7 ostáva na účte (D6) — v rekapitulácii je ako zvyšok.
          for (const p of [0, 1] as const) {
            // Jeden príkaz smie dohrať aj viac Pitiek (nevyhnutné ťahy) — log patrí tejto, nie prvej.
            const poTejto = z.events.slice(ie + 1, nasledujuca(z.events, ie));
            const riadok = poTejto.find((x) => x.type === "log" && x.text.startsWith(`Hráč ${p + 1}: po Pitke sa pečeň`));
            const m = riadok?.type === "log" ? /pečeň \((\d+)\)/.exec(riadok.text) : null;
            expect(Number(m?.[1] ?? 0)).toBe(pecenPitky(r, p) - r.pecen.cirhozy[p] * r.pecen.prah[p]);
            const ucet = poTejto.find((x) => x.type === "log" && x.text.startsWith(`Hráč ${p + 1}: zadĺženie `));
            const u = ucet?.type === "log" ? /zadĺženie (\d+) ostáva/.exec(ucet.text) : null;
            expect(Number(u?.[1] ?? 0)).toBe(zadlzeniePitky(r, p) - r.zadlzenie.dlhy[p] * r.zadlzenie.prah[p]);
          }
          // Až po otočení Záverečných — inak by prezradila súperovu kartu lícom dole.
          expect(z.po.strany.flat().some((pl) => pl.zaverecna === true)).toBe(false);
        }
      }
    }
    expect(pitiek).toBeGreaterThan(8);
    expect(sCirhozou).toBeGreaterThan(0);
  });

  it("posledná Pitka kola je „pred bitkou“ — jej vrstvu nahradí rekapitulácia bitky (Michal 2026-10-26)", () => {
    let predBitkou = 0;
    let dalej = 0;
    for (const zaznamy of PARTIE) {
      // Pitka pred bitkou čaká na bitku kola; tá ju musí mať v bloku „z Pitiek kola“.
      let caka: RekapitulaciaPitky | null = null;
      for (const z of zaznamy) {
        for (const [i, e] of z.events.entries()) {
          if (e.type === "pitkaRekap") {
            expect(caka).toBeNull();
            if (pitkaPredBitkou(z.events, i)) {
              predBitkou++;
              caka = e.rekap;
              expect(z.po.faza === "bitka" || z.po.kolo > z.pred.kolo || z.po.koniec !== null).toBe(true);
            } else {
              dalej++;
              // Po príkaze, ktorý dohral aj ďalšie Pitky, je stav až po poslednej z nich.
              if (nasledujuca(z.events, i) < z.events.length) continue;
              expect(z.po.faza === "zhromazdenie" || z.po.faza === "pitka").toBe(true);
              expect(z.po.kolo).toBe(z.pred.kolo);
            }
          }
          if (e.type === "bitkaVysledok") {
            expect(caka).not.toBeNull();
            expect(e.rekap?.pitkyKola?.pocet).toBe(caka?.pitka);
            caka = null;
          }
        }
      }
    }
    expect(predBitkou).toBeGreaterThan(5);
    expect(dalej).toBeGreaterThan(0);
  });

  it("pitkaPredBitkou rozhoduje prvá zmena fázy za rekapituláciou, nie neskoršia bitka", () => {
    const rekap = PARTIE[0]!.flatMap((z) => z.events).find((e) => e.type === "pitkaRekap");
    expect(rekap).toBeDefined();
    const log: Event = { type: "log", text: "…" };
    expect(pitkaPredBitkou([rekap!, log, { type: "faza", faza: "bitka" }], 0)).toBe(true);
    expect(pitkaPredBitkou([rekap!, { type: "faza", faza: "zhromazdenie" }, rekap!, { type: "faza", faza: "bitka" }], 0)).toBe(false);
    expect(pitkaPredBitkou([rekap!, { type: "faza", faza: "zhromazdenie" }, rekap!, { type: "faza", faza: "bitka" }], 2)).toBe(true);
    expect(pitkaPredBitkou([rekap!, log], 0)).toBe(false);
    expect(pitkaPredBitkou([log, { type: "faza", faza: "bitka" }], 0)).toBe(false);
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
  it("tuhé, Viera × Povera, zvyšné Povery a blok z Pitiek kola sedia s poškodením bitky", () => {
    let bitiek = 0;
    let sPoverou = 0;
    let zrusenych = 0;
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
            // Zvyšné Povery (v8.3) idú na klebety, nie do poškodenia; celkové = tuhé.
            expect(r.zvysnaPovera[p]).toBe(d.zvysnaPovera[p]);
            expect(r.celkove[p]).toBe(r.tuheSpolu[p]);
            expect(sucet(r.pohorsenie.polozky, p)).toBe(r.pohorsenie.spolu[p]);
            if (sucet(r.povera, p) > 0) sPoverou++;
            // Podrobný náhľad: súčet ikon = číslo riadku; zrušené dali 0 a vedia čím.
            const ikony = r.akcie ?? {};
            for (const a of AKCIE_TUHE) expect(sucet(ikony[a] ?? [], p)).toBe(e.sums[p][a] ?? 0);
            expect(sucet(ikony.Viera ?? [], p)).toBe(sucet(r.viera, p));
            expect(sucet(ikony.Povera ?? [], p)).toBe(sucet(r.povera, p));
            expect(sucet(ikony.Pohoršenie ?? [], p)).toBe(r.pohorsenie.spolu[p]);
            for (const x of Object.values(ikony).flat()) {
              if (!x.zrusena) continue;
              zrusenych++;
              expect(x.n).toBe(0);
              expect(["Odpor", "NA EX"]).toContain(x.dovody[0]);
            }
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
    expect(zrusenych).toBeGreaterThan(0);
  });

  it("podrobný náhľad: 2 Rany, Rana ×2 a dve sivé (Odpor, NA EX) = 4 (príklad Michala 2026-10-30)", () => {
    const RANY: Layout4 = ["Rana", "Rana", "Rana", "Rana"];
    const PROTI: Layout4 = ["Rana", "Odpor", "Posilnenie", null];
    const JEDNA: Layout4 = ["Rana", null, null, null];
    // Súperova karta je otočená — jej vytlačená pravá strana je pri spoji vľavo, v obrátenom poradí.
    const CUDZIA: Layout4 = [null, null, null, "Rana"];
    const sd = syntheticData([makeDef("rany", EMPTY, RANY), makeDef("proti", PROTI, EMPTY), makeDef("jedna", EMPTY, JEDNA), makeDef("cudzia", EMPTY, CUDZIA)]);
    const rany = instanceFor(sd, "rany", EMPTY, RANY);
    const proti = instanceFor(sd, "proti", PROTI, EMPTY);
    const jedna = instanceFor(sd, "jedna", EMPTY, JEDNA);
    const cudzia = instanceFor(sd, "cudzia", EMPTY, CUDZIA);
    // Bez lokality: strana 0 je úsek [rany, proti] (zľava), strana 1 úsek [jedna, cudzia].
    const line = {
      lokalita: null,
      lokalitaOtocena: false,
      strany: [
        [{ card: proti, playedBy: 0 }, { card: rany, playedBy: 0 }],
        [{ card: jedna, playedBy: 0, naexBy: 1 }, { card: cudzia, playedBy: 1 }],
      ],
    } as const satisfies { strany: readonly [readonly PlacedCard[], readonly PlacedCard[]] } & Record<string, unknown>;
    const linia = evaluateLine(sd, line);
    expect(linia.zrusene[0].Rana?.map((z) => [z.defId, z.dovody])).toEqual([
      ["rany", ["Odpor"]],
      ["jedna", ["NA EX"]],
    ]);
    const ikony = akcieRekapitulacie(linia, ["Rana"]).Rana ?? [];
    const moje = ikony.filter((x) => x.kto === 0).map((x) => [x.defId, x.n, x.zrusena]);
    expect(moje).toEqual([
      ["proti", 1, false],
      ["rany", 1, false],
      ["rany", 2, false],
      ["rany", 0, true],
      ["jedna", 0, true],
    ]);
    expect(ikony.filter((x) => x.kto === 0).reduce((n, x) => n + x.n, 0)).toBe(4);
    expect(linia.sums[0].Rana).toBe(4);
    // Súperova Rana na spoji so zrušenou ostáva jeho.
    expect(ikony.filter((x) => x.kto === 1).map((x) => [x.defId, x.n])).toEqual([["cudzia", 1]]);
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
    expect(r.karty).toEqual([{ uid: partner.uid, defId: "partner", majitel: 0, dal: 1, zdvojilo: 1, zrusilo: 1, akcieZdvojene: { Cigareta: 1 }, akcieZrusene: { Pecka: 1 } }]);
    expect(r.zdvojilo).toEqual([1, 0]);
    expect(r.zrusilo).toEqual([1, 0]);
  });

  it("akcie pri ×2 a ✕ (Michal 2026-10-30) sedia so súčtami, sú z karty a oba pohľady ich majú rovnaké", () => {
    let kariet = 0;
    for (const zaznamy of PARTIE) {
      for (const z of zaznamy) {
        for (const e of z.events) {
          if (e.type !== "pitkaRekap") continue;
          for (const x of e.rekap.naex.karty) {
            kariet++;
            const spolu = (m: Readonly<Partial<Record<string, number>>> | undefined): number => Object.values(m ?? {}).reduce((a: number, n) => a + (n ?? 0), 0);
            expect(spolu(x.akcieZdvojene)).toBe(x.zdvojilo);
            expect(spolu(x.akcieZrusene)).toBe(x.zrusilo);
            // Len akcie vytlačené na karte (verejná definícia), nič zo skrytých kariet.
            const def = data.cards.get(x.defId);
            const naKarte = new Set([...Object.keys(def?.left.actions ?? {}), ...Object.keys(def?.right.actions ?? {})]);
            for (const a of [...Object.keys(x.akcieZdvojene ?? {}), ...Object.keys(x.akcieZrusene ?? {})]) expect(naKarte.has(a)).toBe(true);
          }
          // Rekapitulácia je verejná: obaja hráči dostanú tú istú.
          const pre = (p: PlayerId) => eventsFor(z.events, p).filter((u) => u.type === "pitkaRekap");
          expect(pre(0)).toEqual(pre(1));
        }
      }
    }
    expect(kariet).toBeGreaterThan(0);
  });

  it("NA EX na Posilnení zruší Posilnenie a zdvojí neaktívnu Ranu", () => {
    const partner = instanceFor(s, "partner", PARTNER_L, PARTNER_P);
    const posil = instanceFor(s, "posil", EMPTY, POSIL);
    const line = { lokalita: null, lokalitaOtocena: false, strany: [[lezi(partner, 0), lezi(posil, 0, 0)], []] as const };
    const r = ucinokNaex(s, line);
    expect(r.karty).toEqual([{ uid: posil.uid, defId: "posil", majitel: 0, dal: 0, zdvojilo: 1, zrusilo: 1, akcieZdvojene: { Rana: 1 }, akcieZrusene: { Posilnenie: 1 } }]);
    // Bez NA EX nič.
    expect(ucinokNaex(s, { ...line, strany: [[lezi(partner, 0), lezi(posil, 0)], []] }).karty).toEqual([]);
  });
});

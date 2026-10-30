// Rekapitulácia bitky a Pitky (roadmapa #106, Michal 2026-10-26): pod Počítadlom
// bitky tabuľka „koľko čoho“ — tuhé po akciách, Viera proti Povere po dvojiciach,
// Pohoršenie, NA EX majiteľovi karty a blok z Pitiek kola; po každej Pitke to isté
// pre Dlh, pečeň a cigarety. Čísla skladá motor pri vyhodnotení z tých istých
// výpočtov, ktorými účtuje (rozpisPoskodenia, prirastkyPitky, cigaretyZPitky),
// a posiela ich v udalosti — klient ich len kreslí. Všetko je verejné: línia,
// priznané kliatby, Dlhy, Absťáky a pečeň vidia obaja.

import type { DamageResult } from "./battle.ts";
import type { GameData } from "./data.ts";
import type { BitkaNaNastenke, Event, RozpisPoskodenia } from "./engine.ts";
import type { ActionSums, LineEval, LineState, ZdrojAkcie } from "./partia.ts";
import { evaluateLine } from "./partia.ts";
import type { Action, PlayerId } from "./types.ts";

type Dvojica = readonly [number, number];

/** Kus riadku: komu sa ráta, z ktorej karty v línii (vlna počítadla) a koľko. */
export interface PolozkaRekapitulacie {
  readonly kto: PlayerId;
  /** Karta v línii; null = mimo línie (priazeň, patronát) — ukáže sa po kartách. */
  readonly uid: number | null;
  readonly n: number;
}

/** Čo NA EX urobilo s akciami karty — ráta sa majiteľovi karty (Michal 2026-10-26). */
export interface NaexNaKarte {
  readonly uid: number;
  readonly defId: string;
  readonly majitel: PlayerId;
  /** Kto poldeci na kartu dal. */
  readonly dal: PlayerId;
  /** Akcie, ktoré NA EX zdvojilo (neaktívna → aktívna ×2; Veterán aktívne ×2). */
  readonly zdvojilo: number;
  /** Akcie, ktoré NA EX zrušilo (aktívna → zrušená). */
  readonly zrusilo: number;
  /**
   * Ktoré akcie to boli a koľko ich (Michal 2026-10-30: ikony vedľa riadkov ×2 a ✕);
   * súčty sedia so zdvojilo a zrusilo. Chýba v starších záznamoch.
   */
  readonly akcieZdvojene?: Readonly<Partial<Record<Action, number>>>;
  readonly akcieZrusene?: Readonly<Partial<Record<Action, number>>>;
}

export interface NaexRekapitulacie {
  readonly karty: readonly NaexNaKarte[];
  /** Súčty podľa majiteľa karty. */
  readonly zdvojilo: Dvojica;
  readonly zrusilo: Dvojica;
}

/**
 * Jedna akcia v podrobnom náhľade rekapitulácie (Michal 2026-10-30): zjednodušený
 * ukáže súčet a pruh, podrobný ikony akcií vedľa seba — aktívne, zdvojené (×2)
 * aj zrušené (sivé, dali 0) a čím. Posilnenie a Odpor sa neukazujú — sú to modifikátory.
 */
export interface AkciaRekapitulacie {
  readonly kto: PlayerId;
  /** Karta, ktorej slot akciu dal; null = mimo línie (priazeň, patronát, efekt karty). */
  readonly uid: number | null;
  readonly defId: string | null;
  /** Koľko akcia dala (2 = zdvojená, 0 = zrušená); záporná = efekt karty ubral (Veterinár, Farár…). */
  readonly n: number;
  readonly zrusena: boolean;
  /** Prečo je aktívna či zdvojená („Posilnenie“, „NA EX“, „Vzbura“, „karta:<defId>“), pri zrušenej čím („Odpor“, „NA EX“). */
  readonly dovody: readonly string[];
}
export type AkcieRekapitulacie = Readonly<Partial<Record<Action, readonly AkciaRekapitulacie[]>>>;

/**
 * Akcie z línie po jednom slote pre podrobný náhľad. `spolu` je číslo, ktoré riadok
 * ukazuje (súčet bitky, prírastok Pitky) — čo z línie nepochádza, dorovná položka
 * mimo línie (uid null), aby súčet podrobného náhľadu sedel so zjednodušeným.
 */
export function akcieRekapitulacie(linia: LineEval, akcie: readonly Action[], spolu: (p: PlayerId, a: Action) => number = (p, a) => nula(linia.sums[p][a])): AkcieRekapitulacie {
  const out: Partial<Record<Action, AkciaRekapitulacie[]>> = {};
  for (const a of akcie) {
    const xs: AkciaRekapitulacie[] = [];
    for (const p of [0, 1] as const) {
      const aktivne = (linia.zdroje[p][a] ?? []).filter((z) => z.hodnota > 0);
      for (const z of aktivne) xs.push({ kto: p, uid: z.uid, defId: z.defId, n: z.hodnota, zrusena: false, dovody: z.dovody });
      const zvysok = spolu(p, a) - aktivne.reduce((s, z) => s + z.hodnota, 0);
      if (zvysok !== 0) xs.push({ kto: p, uid: null, defId: null, n: zvysok, zrusena: false, dovody: [] });
      for (const z of linia.zrusene[p][a] ?? []) xs.push({ kto: p, uid: z.uid, defId: z.defId, n: 0, zrusena: true, dovody: z.dovody });
    }
    if (xs.length > 0) out[a] = xs;
  }
  return out;
}

/** Akcie, ktoré podrobný náhľad Pitky ukazuje (riadky Dlh, pečeň, cigarety, Vízia). */
export const AKCIE_PITKY: readonly Action[] = ["Dlh", "PoškodeniePečene", "Poldeci", "Cigareta", "Obmedzenie", "Vízia"];

export type AkciaTuha = "Rana" | "Pecka" | "Petelica";
export const AKCIE_TUHE: readonly AkciaTuha[] = ["Rana", "Pecka", "Petelica"];

/**
 * Záverečná odhalená na konci Pitky (hlásenie Michala 2026-10-27: „nevidel som, čo
 * vlastne zahral“) — karta a čo urobila. Verejné: karta je už lícom hore.
 */
export interface ZaverecnaOdhalena {
  readonly majitel: PlayerId;
  readonly strana: PlayerId;
  readonly uid: number;
  readonly defId: string;
  /** Akcie karty aktívne v tejto Pitke (jednotky, zdvojená = 2), aj Odpor a Posilnenie. */
  readonly akcie: Readonly<Partial<Record<Action, number>>>;
  /** Hlášky motora pri otočení — Nástup a odložené efekty (Svokra, Hrobár…); len verejné. */
  readonly efekty: readonly string[];
}

/** Súčet Pitiek kola — blok „z Pitiek kola“ v rekapitulácii bitky. */
export interface PitkyKola {
  readonly pocet: number;
  readonly zadlzenie: Dvojica;
  readonly dlhy: Dvojica;
  readonly pecen: Dvojica;
  readonly cirhozy: Dvojica;
  /** Záverečné odhalené v Pitkách kola (chýba v starších záznamoch). */
  readonly zaverecne?: readonly ZaverecnaOdhalena[];
}

export interface RekapitulaciaBitky {
  /** Jednotky akcií tuhého po kartách (zdvojená akcia = 2). */
  readonly tuhe: Readonly<Record<AkciaTuha, readonly PolozkaRekapitulacie[]>>;
  /** Jednotky Viery a Povery, ktoré idú do rušenia (Veriaci pridá, Farár uberie). */
  readonly viera: readonly PolozkaRekapitulacie[];
  readonly povera: readonly PolozkaRekapitulacie[];
  /** Moja Viera zrušená súperovými Poverami a moje Povery zrušené súperovou Vierou. */
  readonly zrusenaViera: Dvojica;
  readonly zrusenaPovera: Dvojica;
  /** Tuhé, ktoré súperovi uberie moja zvyšná Viera (× hodnota Viery). */
  readonly vieraUbera: Dvojica;
  /** Moje priznané Dlhy pri vyhodnotení (remíza v tuhom). */
  readonly priznaneDlhy: Dvojica;
  /** Zvyšné Povery po vyrušení s Vierou — v8.3 posunuli silu priazní (klebety), nie poškodenie. */
  readonly zvysnaPovera: Dvojica;
  /** Povery, ktoré súperov Farár ignoruje (do rušenia nejdú). */
  readonly poveraIgnorovana: Dvojica;
  readonly pohorsenie: { readonly polozky: readonly PolozkaRekapitulacie[]; readonly spolu: Dvojica };
  readonly naex: NaexRekapitulacie;
  readonly pitkyKola: PitkyKola | null;
  readonly tuheSpolu: Dvojica;
  readonly celkove: Dvojica;
  readonly vitaz: PlayerId | null;
  readonly prebytok: number;
  readonly prebytokDrzi: PlayerId | null;
  /**
   * Špaky bitky (v6): za bitku, za starších, exekúcia — záznam nástenky v čase
   * výsledku (prebytok vo finále a na Kultúrnom dome sa dopíše až na nástenke).
   */
  readonly spaky?: BitkaNaNastenke;
  /** Podrobný náhľad: tuhé, Viera, Povera a Pohoršenie po slotoch (chýba v starších záznamoch). */
  readonly akcie?: AkcieRekapitulacie;
}

export interface RekapitulaciaPitky {
  readonly pitka: number;
  readonly pitkyCelkom: number;
  readonly naex: NaexRekapitulacie;
  readonly zadlzenie: {
    /** Zadĺženie pred vyhodnotením (zvyčajne 0) a z akcií Dlh na stole. */
    readonly pred: Dvojica;
    readonly zoStola: Dvojica;
    /** Prah Dlhu hráčov (Výherný automat ho zvyšuje); rekapitulácie spred v7-opravy majú jedno číslo — čítaj cez prahDlhuPitky. */
    readonly prah: Dvojica;
    readonly dlhy: Dvojica;
  };
  readonly pecen: {
    /** Vypité do dna v Zhromaždení pred touto Pitkou. */
    readonly zPitia: Dvojica;
    /** Poldeci vypité za vlastné NA EX v tejto Pitke. */
    readonly zNaex: Dvojica;
    readonly poskodenie: Dvojica;
    readonly poldeci: Dvojica;
    readonly prah: Dvojica;
    /** Cirhózy z tejto Pitky, aj tie, ktoré dalo už NA EX pri odkrytí. */
    readonly cirhozy: Dvojica;
  };
  readonly cigarety: {
    readonly akcie: Dvojica;
    /** Súperove Obmedzenia, ktoré naozaj ubrali (najviac toľko, koľko mal Cigariet). */
    readonly obmedzenie: Dvojica;
    readonly cigorky: Dvojica;
    readonly zisk: Dvojica;
  };
  /** Aktívne Vízie — koľko vrchných kariet hráč prezrie. */
  readonly vizia: Dvojica;
  /** Záverečné otočené na konci tejto Pitky (chýba, keď žiadna neležala). */
  readonly zaverecne?: readonly ZaverecnaOdhalena[];
  /** Podrobný náhľad: akcie Pitky po slotoch (chýba v starších záznamoch). */
  readonly akcie?: AkcieRekapitulacie;
}

const nula = (v: number | undefined): number => v ?? 0;
const dvojica = (f: (p: PlayerId) => number): Dvojica => [f(0), f(1)];

/**
 * NA EX na kartách línie: porovná vyhodnotenie s NA EX a bez neho. Rátajú sa všetky
 * akcie karty (aj Posilnenie a Odpor) — hráč vidí, koľko sa na nej zmenilo. Výtržník
 * (zrážka NA EX) sa nepočíta, jeho akcie sú Rany.
 */
export function ucinokNaex(data: GameData, line: LineState, ev: LineEval = evaluateLine(data, line)): NaexRekapitulacie {
  const sNaex = [...line.strany[0], ...line.strany[1]].filter((pl) => pl.naexBy !== undefined && pl.vytrznik !== true);
  if (sNaex.length === 0) return { karty: [], zdvojilo: [0, 0], zrusilo: [0, 0] };
  const bez = (strana: LineState["strany"][number]) =>
    strana.map((pl) => (pl.naexBy === undefined ? pl : { card: pl.card, playedBy: pl.playedBy, ...(pl.zaverecna === true ? { zaverecna: true as const } : {}) }));
  const ev0 = evaluateLine(data, { ...line, strany: [bez(line.strany[0]), bez(line.strany[1])] });
  const karty: NaexNaKarte[] = [];
  for (const pl of sNaex) {
    const s = ev.cards.get(pl.card.uid);
    const s0 = ev0.cards.get(pl.card.uid);
    if (s === undefined || s0 === undefined) continue;
    let zdvojilo = 0;
    let zrusilo = 0;
    const akcieZdvojene: Partial<Record<Action, number>> = {};
    const akcieZrusene: Partial<Record<Action, number>> = {};
    const sloty = [...s.left, ...s.right];
    const sloty0 = [...s0.left, ...s0.right];
    sloty.forEach((x, i) => {
      const x0 = sloty0[i];
      if (x === null || x0 === null || x0 === undefined) return;
      if (x0.stav === "aktivna" && x.stav === "zrusena") {
        zrusilo++;
        const a = x0.action;
        akcieZrusene[a] = nula(akcieZrusene[a]) + 1;
      } else if (x.stav === "aktivna" && (x0.stav !== "aktivna" || x.nasobok > x0.nasobok)) {
        zdvojilo++;
        const a = x.action;
        akcieZdvojene[a] = nula(akcieZdvojene[a]) + 1;
      }
    });
    karty.push({ uid: pl.card.uid, defId: pl.card.defId, majitel: pl.playedBy, dal: pl.naexBy as PlayerId, zdvojilo, zrusilo, akcieZdvojene, akcieZrusene });
  }
  const suma = (k: "zdvojilo" | "zrusilo"): Dvojica => dvojica((p) => karty.filter((x) => x.majitel === p).reduce((a, x) => a + x[k], 0));
  return { karty, zdvojilo: suma("zdvojilo"), zrusilo: suma("zrusilo") };
}

/** Zdroje akcie po kartách (jedna položka za kartu, jednotky = hodnota). */
function poKartach(zdroje: readonly ZdrojAkcie[] | undefined, kto: PlayerId): PolozkaRekapitulacie[] {
  const out: PolozkaRekapitulacie[] = [];
  for (const z of zdroje ?? []) {
    const x = out.find((o) => o.uid === z.uid);
    if (x === undefined) out.push({ kto, uid: z.uid, n: z.hodnota });
    else out[out.indexOf(x)] = { ...x, n: x.n + z.hodnota };
  }
  return out;
}

/**
 * Položky upravené na súčet `spolu`: chýbajúce mimo línie (uid null), prebytočné uberie od konca.
 * Záporné položky (Presbiter uberá Vieru) sa zahodia — `spolu` ich už obsahuje a pri
 * orezaní od konca by ostali kladné karty navyše.
 */
function naSucet(polozky: readonly PolozkaRekapitulacie[], kto: PlayerId, spolu: number): PolozkaRekapitulacie[] {
  const out = polozky.filter((x) => x.n > 0).map((x) => ({ ...x }));
  let rozdiel = spolu - out.reduce((a, x) => a + x.n, 0);
  if (rozdiel > 0) out.push({ kto, uid: null, n: rozdiel });
  for (let i = out.length - 1; i >= 0 && rozdiel < 0; i--) {
    const ubrat = Math.min(out[i]!.n, -rozdiel);
    out[i]!.n -= ubrat;
    rozdiel += ubrat;
  }
  return out.filter((x) => x.n > 0);
}

export interface VstupRekapitulacieBitky {
  readonly linia: LineEval;
  readonly line: LineState;
  /** Súčty, z ktorých bitka počítala (BitkaStav.sums). */
  readonly sums: readonly [ActionSums, ActionSums];
  readonly rozpis: readonly [RozpisPoskodenia, RozpisPoskodenia];
  readonly damage: DamageResult;
  readonly priznaneDlhy: Dvojica;
  /** Pohoršenia, ktoré hráči v bitke dostali (nastavSumy). */
  readonly pohorsenia: Dvojica;
  readonly pitkyKola: readonly RekapitulaciaPitky[];
  readonly vitaz: PlayerId | null;
  readonly prebytok: number;
  readonly prebytokDrzi: PlayerId | null;
}

export function rekapitulaciaBitky(data: GameData, v: VstupRekapitulacieBitky): RekapitulaciaBitky {
  const { linia, rozpis, damage } = v;
  const tuhe = {} as Record<AkciaTuha, PolozkaRekapitulacie[]>;
  for (const a of AKCIE_TUHE) tuhe[a] = ([0, 1] as const).flatMap((p) => naSucet(poKartach(linia.zdroje[p][a], p), p, nula(v.sums[p][a])));
  // Do rušenia ide Viera s Veriacim a Povera bez tých, ktoré ignoruje súperov Farár (stranyBitky).
  const vieraSpolu = dvojica((p) => damage.zvysnaViera[p] + rozpis[p].zrusenaViera);
  const poveraSpolu = dvojica((p) => damage.zvysnaPovera[p] + rozpis[p].zrusenaPovera);
  const viera = ([0, 1] as const).flatMap((p) => naSucet(poKartach(linia.zdroje[p].Viera, p), p, vieraSpolu[p]));
  const povera = ([0, 1] as const).flatMap((p) => naSucet(poKartach(linia.zdroje[p].Povera, p), p, poveraSpolu[p]));
  const pohorsenie = ([0, 1] as const).flatMap((p) => naSucet(poKartach(linia.zdroje[p].Pohoršenie, p), p, v.pohorsenia[p]));
  return {
    tuhe,
    viera,
    povera,
    zrusenaViera: dvojica((p) => rozpis[p].zrusenaViera),
    zrusenaPovera: dvojica((p) => rozpis[p].zrusenaPovera),
    vieraUbera: dvojica((p) => damage.zvysnaViera[p] * rozpis[p].hodnotaViery),
    priznaneDlhy: v.priznaneDlhy,
    zvysnaPovera: dvojica((p) => rozpis[p].zvysnaPovera),
    poveraIgnorovana: dvojica((p) => rozpis[p].poveraIgnorovana),
    pohorsenie: { polozky: pohorsenie, spolu: v.pohorsenia },
    naex: ucinokNaex(data, v.line, linia),
    pitkyKola: v.pitkyKola.length === 0 ? null : spocitajPitkyKola(v.pitkyKola),
    tuheSpolu: [damage.tuhe[0], damage.tuhe[1]],
    celkove: [damage.celkove[0], damage.celkove[1]],
    vitaz: v.vitaz,
    prebytok: v.prebytok,
    prebytokDrzi: v.prebytokDrzi,
    // Riadky ukazujú súčty bitky (Viera s Veriacim, Povera bez ignorovaných Farárom, Pohoršenia s patronátom).
    akcie: akcieRekapitulacie(linia, [...AKCIE_TUHE, "Viera", "Povera", "Pohoršenie"], (p, a) =>
      a === "Viera" ? vieraSpolu[p] : a === "Povera" ? poveraSpolu[p] : a === "Pohoršenie" ? v.pohorsenia[p] : nula(v.sums[p][a]),
    ),
  };
}

/** Súčet Pitiek kola z ich rekapitulácií. */
export function spocitajPitkyKola(rekapy: readonly RekapitulaciaPitky[]): PitkyKola {
  const sucet = (f: (r: RekapitulaciaPitky, p: PlayerId) => number): Dvojica => dvojica((p) => rekapy.reduce((a, r) => a + f(r, p), 0));
  const zaverecne = rekapy.flatMap((r) => r.zaverecne ?? []);
  return {
    pocet: rekapy.length,
    zadlzenie: sucet((r, p) => r.zadlzenie.pred[p] + r.zadlzenie.zoStola[p]),
    dlhy: sucet((r, p) => r.zadlzenie.dlhy[p]),
    pecen: sucet((r, p) => pecenPitky(r, p)),
    cirhozy: sucet((r, p) => r.pecen.cirhozy[p]),
    ...(zaverecne.length > 0 ? { zaverecne } : {}),
  };
}

/** Aktívne akcie karty v línii — čo Záverečná v Pitke dávala, aj Odpor a Posilnenie na spoji. */
export function akcieKartyVLinii(linia: LineEval, uid: number): Partial<Record<Action, number>> {
  const out: Partial<Record<Action, number>> = {};
  const ev = linia.cards.get(uid);
  for (const x of ev === undefined ? [] : [...ev.left, ...ev.right]) {
    if (x === null || x.stav !== "aktivna") continue;
    const a = x.action;
    out[a] = (out[a] ?? 0) + x.nasobok;
  }
  return out;
}

/** Všetka pečeň hráča v Pitke (pitie, NA EX, karty na stole). */
export function pecenPitky(r: RekapitulaciaPitky, p: PlayerId): number {
  return r.pecen.zPitia[p] + r.pecen.zNaex[p] + r.pecen.poskodenie[p] + r.pecen.poldeci[p];
}

/** Zadĺženie hráča v Pitke. */
export function zadlzeniePitky(r: RekapitulaciaPitky, p: PlayerId): number {
  return r.zadlzenie.pred[p] + r.zadlzenie.zoStola[p];
}

/** Prah Dlhu hráča v Pitke — rozohrané partie môžu mať v stave ešte spoločné číslo bez Výherného automatu. */
export function prahDlhuPitky(r: RekapitulaciaPitky, p: PlayerId): number {
  const prah: Dvojica | number = r.zadlzenie.prah;
  return typeof prah === "number" ? prah : prah[p];
}

export interface VstupRekapitulaciePitky {
  readonly pitka: number;
  readonly pitkyCelkom: number;
  readonly line: LineState;
  readonly linia: LineEval;
  /** Zadĺženie a pečeň z kariet na stole (prirastkyPitky). */
  readonly zadlzenieZoStola: Dvojica;
  readonly poskodeniePecene: Dvojica;
  readonly poldeci: Dvojica;
  /** Zadĺženie pred vyhodnotením. */
  readonly zadlzeniePred: Dvojica;
  readonly prahDlhu: Dvojica;
  /** Karty Dlh z vyhodnotenia (pitkaVysledok). */
  readonly dlhy: Dvojica;
  /** Pečeň na začiatku Pitky (vypité v Zhromaždení) a NA EX, ktoré hráč v Pitke dal. */
  readonly pecenNaZaciatku: Dvojica;
  readonly naexDal: Dvojica;
  readonly prahPecene: Dvojica;
  /** Cirhózy získané od začiatku Pitky (aj pri odkrytí NA EX). */
  readonly cirhozy: Dvojica;
  /** Cigarety z vyhodnotenia (cigaretyZPitky). */
  readonly cigarety: Dvojica;
}

export function rekapitulaciaPitky(data: GameData, v: VstupRekapitulaciePitky): RekapitulaciaPitky {
  const sums = v.linia.sums;
  const akcie = dvojica((p) => nula(sums[p].Cigareta));
  const obmedzenie = dvojica((p) => Math.min(akcie[p], nula(sums[p === 0 ? 1 : 0].Obmedzenie)));
  return {
    pitka: v.pitka,
    pitkyCelkom: v.pitkyCelkom,
    naex: ucinokNaex(data, v.line, v.linia),
    zadlzenie: { pred: v.zadlzeniePred, zoStola: v.zadlzenieZoStola, prah: v.prahDlhu, dlhy: v.dlhy },
    pecen: {
      zPitia: v.pecenNaZaciatku,
      zNaex: v.naexDal,
      poskodenie: v.poskodeniePecene,
      poldeci: v.poldeci,
      prah: v.prahPecene,
      cirhozy: v.cirhozy,
    },
    // Cigorky (Dedičstvo) Obmedzenie neuberie — sú to cigarety nad rámec akcií.
    cigarety: { akcie, obmedzenie, cigorky: dvojica((p) => v.cigarety[p] - (akcie[p] - obmedzenie[p])), zisk: v.cigarety },
    vizia: dvojica((p) => nula(sums[p].Vízia)),
    // Dlh a pečeň ukazujú prírastky z kariet na stole (Liberál, Veterinár, Manželka ich menia).
    akcie: akcieRekapitulacie(v.linia, AKCIE_PITKY, (p, a) =>
      a === "Dlh" ? v.zadlzenieZoStola[p] : a === "PoškodeniePečene" ? v.poskodeniePecene[p] : a === "Poldeci" ? v.poldeci[p] : nula(sums[p][a]),
    ),
  };
}

/**
 * Pitka, po ktorej v tom istom ťahu začala bitka (posledná Pitka kola). Klient jej rekapituláciu
 * neukazuje (Michal 2026-10-26): rekapitulácia bitky ju má v bloku „z Pitiek kola“ a dve vrstvy
 * za sebou by hovorili to isté. Rozhoduje prvá zmena fázy po udalosti `pitkaRekap` — ďalšie
 * Zhromaždenie, alebo bitka.
 */
export function pitkaPredBitkou(events: readonly Event[], index: number): boolean {
  if (events[index]?.type !== "pitkaRekap") return false;
  for (let i = index + 1; i < events.length; i++) {
    const e = events[i];
    if (e?.type === "faza") return e.faza === "bitka";
  }
  return false;
}

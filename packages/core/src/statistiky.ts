// Štatistiky partie pre profil hráča — čistá funkcia nad ťahmi motora.
//
// Server po každom apply() zavolá zapisTah(pred, príkaz, po, udalosti) a na
// konci partie uzavriStatistiky(). Všetko sa odvodzuje zo stavu a udalostí,
// motor kvôli štatistikám nič nepočíta navyše — len posiela udalosti
// "pecen" a súčty akcií v "bitkaVysledok".

import type { Action, CardInstance, PlayerId, Podmienka } from "./types.ts";
import { opponentOf } from "./types.ts";
import type { GameData } from "./data.ts";
import type { Command, Event, GameState } from "./engine.ts";
import type { PlayerState } from "./player.ts";
import type { ElderState } from "./elders.ts";
import { elderScore, vydesil } from "./elders.ts";

export interface StatistikyHraca {
  /** Partie, z ktorých súčet vznikol (jedna partia = 1). */
  readonly partie: number;
  /** Partie, ktoré sa skončili záverečným bodovaním (len tie majú body). */
  readonly bodovanePartie: number;
  readonly tahy: number;
  readonly kola: number;

  readonly bitky: number;
  readonly bitkyVyhrane: number;
  readonly bitkyAkoUtocnik: number;
  readonly bitkyAkoUtocnikVyhrane: number;
  readonly bitkyOStarsich: number;

  readonly tuheUdelene: number;
  readonly makkeUdelene: number;
  readonly poskodenieObdrzane: number;
  /** Najvyššie celkové poškodenie v jednej bitke (pri súčte maximum). */
  readonly najvacsiZasah: number;
  readonly prebytokZiskany: number;
  /** Aktívne akcie v bitkách (súčty z línie, vrátane násobkov). */
  readonly akcie: Readonly<Partial<Record<Action, number>>>;
  /** Povery, ktoré neprerušila súperova Viera. */
  readonly poveryUcinne: number;

  readonly poskodeniePecene: number;
  readonly cirhozyZiskane: number;
  readonly cirhozyPriznane: number;
  readonly liecby: number;
  readonly pohreby: number;

  readonly dlhyZiskane: number;
  readonly dlhyPriznane: number;
  /** Dlhy, ktorých sa hráč zbavil (Exekútor, Robota, efekty kariet). */
  readonly dlhyZbavene: number;
  readonly exekucie: number;
  readonly abstakyZiskane: number;

  readonly poldeciVypite: number;
  readonly cigaretyVyfajcene: number;
  readonly cigaretyZiskane: number;
  readonly cigaretyMinute: number;
  readonly bartery: number;
  readonly dolievania: number;

  readonly naex: number;
  readonly naexNaSuperove: number;
  readonly kartyVylozene: number;
  readonly kartyDoSuperovej: number;
  readonly dedicstvo: number;

  readonly posunyPohorsenim: number;
  readonly posunyPrebytkom: number;
  readonly starsiZiskani: number;
  readonly lokalityOvladnute: number;
  readonly starsiVydeseni: number;

  readonly body: number;
  /** Najviac bodov v jednej partii (pri súčte maximum). */
  readonly najviacBodov: number;
  readonly bodyPodla: Readonly<Partial<Record<Podmienka, number>>>;
}

export type DvojicaStatistik = readonly [StatistikyHraca, StatistikyHraca];

export function prazdneStatistiky(): StatistikyHraca {
  return {
    partie: 0,
    bodovanePartie: 0,
    tahy: 0,
    kola: 0,
    bitky: 0,
    bitkyVyhrane: 0,
    bitkyAkoUtocnik: 0,
    bitkyAkoUtocnikVyhrane: 0,
    bitkyOStarsich: 0,
    tuheUdelene: 0,
    makkeUdelene: 0,
    poskodenieObdrzane: 0,
    najvacsiZasah: 0,
    prebytokZiskany: 0,
    akcie: {},
    poveryUcinne: 0,
    poskodeniePecene: 0,
    cirhozyZiskane: 0,
    cirhozyPriznane: 0,
    liecby: 0,
    pohreby: 0,
    dlhyZiskane: 0,
    dlhyPriznane: 0,
    dlhyZbavene: 0,
    exekucie: 0,
    abstakyZiskane: 0,
    poldeciVypite: 0,
    cigaretyVyfajcene: 0,
    cigaretyZiskane: 0,
    cigaretyMinute: 0,
    bartery: 0,
    dolievania: 0,
    naex: 0,
    naexNaSuperove: 0,
    kartyVylozene: 0,
    kartyDoSuperovej: 0,
    dedicstvo: 0,
    posunyPohorsenim: 0,
    posunyPrebytkom: 0,
    starsiZiskani: 0,
    lokalityOvladnute: 0,
    starsiVydeseni: 0,
    body: 0,
    najviacBodov: 0,
    bodyPodla: {},
  };
}

export function noveStatistiky(): DvojicaStatistik {
  return [{ ...prazdneStatistiky(), partie: 1 }, { ...prazdneStatistiky(), partie: 1 }];
}

type Cisla = { -readonly [K in keyof StatistikyHraca as StatistikyHraca[K] extends number ? K : never]: number };
type Mut = Cisla & {
  akcie: Partial<Record<Action, number>>;
  bodyPodla: Partial<Record<Podmienka, number>>;
};

const MAXIMA: ReadonlySet<string> = new Set(["najvacsiZasah", "najviacBodov"]);

function scitajMapy<K extends string>(a: Readonly<Partial<Record<K, number>>>, b: Readonly<Partial<Record<K, number>>>): Partial<Record<K, number>> {
  const out: Partial<Record<K, number>> = { ...a };
  for (const [k, v] of Object.entries(b) as [K, number][]) out[k] = (out[k] ?? 0) + v;
  return out;
}

/** Súčet štatistík (profil = súčet všetkých partií); rekordy sa berú ako maximum. */
export function scitajStatistiky(a: StatistikyHraca, b: StatistikyHraca): StatistikyHraca {
  const out = { ...prazdneStatistiky() } as Mut;
  for (const kluc of Object.keys(out) as (keyof StatistikyHraca)[]) {
    const x = a[kluc];
    const y = b[kluc];
    if (typeof x !== "number" || typeof y !== "number") continue;
    (out as unknown as Record<string, number>)[kluc] = MAXIMA.has(kluc) ? Math.max(x, y) : x + y;
  }
  out.akcie = scitajMapy(a.akcie, b.akcie);
  out.bodyPodla = scitajMapy(a.bodyPodla, b.bodyPodla);
  return out;
}

/**
 * Doplní chýbajúce polia (štatistiky uložené staršou verziou servera) —
 * nové počítadlá začínajú nulou.
 */
export function normalizujStatistiky(v: unknown): StatistikyHraca {
  const zaklad = prazdneStatistiky();
  if (typeof v !== "object" || v === null) return zaklad;
  const o = v as Record<string, unknown>;
  const out = { ...zaklad } as Mut;
  for (const kluc of Object.keys(zaklad)) {
    const x = o[kluc];
    if (typeof x === "number" && Number.isFinite(x)) (out as unknown as Record<string, number>)[kluc] = x;
  }
  const mapa = (x: unknown): Record<string, number> => {
    const r: Record<string, number> = {};
    if (typeof x === "object" && x !== null) {
      for (const [k, n] of Object.entries(x)) if (typeof n === "number" && Number.isFinite(n)) r[k] = n;
    }
    return r;
  };
  out.akcie = mapa(o.akcie);
  out.bodyPodla = mapa(o.bodyPodla);
  return out;
}

// ---------------------------------------------------------------------------
// Zápis ťahov

function kartyVZonach(h: PlayerState): CardInstance[] {
  return [...h.ruka, ...h.doberaci, ...h.odhadzovaci, ...h.priznane, ...h.dedicstvo];
}

/** Karty daného druhu, ktoré hráč vlastní (balíček, ruka, priznané, vlastné karty v líniách). */
function vlastnene(state: GameState, p: PlayerId, defId: string): CardInstance[] {
  const vLiniach = state.strany.flatMap((partia) => partia.filter((pl) => pl.playedBy === p).map((pl) => pl.card));
  return [...kartyVZonach(state.hraci[p]), ...vLiniach].filter((k) => k.defId === defId);
}

/** Kliatby, ktoré v tomto ťahu NOVO vznikli (uid z rozsahu práve pridelených). */
function noveKliatby(pred: GameState, po: GameState, p: PlayerId, defId: string): number {
  return vlastnene(po, p, defId).filter((k) => k.uid >= pred.nextUid).length;
}

function kartaVRuke(state: GameState, p: PlayerId, uid: number): CardInstance | undefined {
  return state.hraci[p].ruka.find((k) => k.uid === uid);
}

function zapisJedneho(
  st: StatistikyHraca,
  pred: GameState,
  cmd: Command,
  autor: PlayerId,
  po: GameState,
  events: readonly Event[],
  p: PlayerId,
): StatistikyHraca {
  const s = { ...st, akcie: { ...st.akcie }, bodyPodla: { ...st.bodyPodla } } as Mut;
  const opp = opponentOf(p);
  const hPred = pred.hraci[p];
  const hPo = po.hraci[p];

  // ---- príkazy tohto hráča
  if (autor === p) {
    s.tahy += 1;
    switch (cmd.type) {
      case "place": {
        const karta = kartaVRuke(pred, p, cmd.uid);
        if (cmd.target === "priznanie") {
          if (karta?.defId === "dlh") s.dlhyPriznane += 1;
          if (karta?.defId === "cirhoza") s.cirhozyPriznane += 1;
        } else if (cmd.target === "dedicstvo") {
          s.dedicstvo += 1;
        } else {
          s.kartyVylozene += 1;
          if (cmd.target === "superova") s.kartyDoSuperovej += 1;
        }
        break;
      }
      case "naex": {
        s.naex += 1;
        const naKarte = pred.strany.flatMap((x) => x).find((pl) => pl.card.uid === cmd.uid);
        if (naKarte !== undefined && naKarte.playedBy !== p) s.naexNaSuperove += 1;
        break;
      }
      case "smoke":
        s.cigaretyVyfajcene += cmd.pocet;
        break;
      case "barter":
        s.bartery += 1;
        break;
      case "refillPoldeci":
        s.dolievania += 1;
        break;
      case "exekutorTool":
        s.exekucie += 1;
        break;
      case "pohorsenie":
        s.posunyPohorsenim += 1;
        break;
      case "prebytok":
        s.posunyPrebytkom += 1;
        break;
      case "liecba":
        s.liecby += 1;
        break;
      case "pohreb":
        s.pohreby += 1;
        break;
      case "nahrada":
        s.starsiZiskani += 1;
        break;
      default:
        break;
    }
  }

  // ---- udalosti
  for (const e of events) {
    if (e.type === "pecen" && e.hrac === p) s.poskodeniePecene += e.mnozstvo;
    if (e.type === "bitkaVysledok") {
      const d = e.damage;
      s.bitky += 1;
      if (e.vitaz === p) s.bitkyVyhrane += 1;
      if (pred.utocnik === p) {
        s.bitkyAkoUtocnik += 1;
        if (e.vitaz === p) s.bitkyAkoUtocnikVyhrane += 1;
      }
      if (pred.ciel?.typ === "starsi") s.bitkyOStarsich += 1;
      s.tuheUdelene += d.tuhe[p];
      s.makkeUdelene += d.makke[p];
      s.poskodenieObdrzane += d.celkove[opp];
      s.najvacsiZasah = Math.max(s.najvacsiZasah, d.celkove[p]);
      if (e.prebytokDrzi === p) s.prebytokZiskany += e.prebytok;
      s.poveryUcinne += d.zvysnaPovera[p];
      for (const [akcia, n] of Object.entries(e.sums[p]) as [Action, number][]) {
        if (n > 0) s.akcie[akcia] = (s.akcie[akcia] ?? 0) + n;
      }
    }
  }

  // ---- rozdiely stavu
  s.cirhozyZiskane += noveKliatby(pred, po, p, "cirhoza");
  const noveDlhy = noveKliatby(pred, po, p, "dlh");
  s.dlhyZiskane += noveDlhy;
  s.dlhyZbavene += Math.max(0, vlastnene(pred, p, "dlh").length + noveDlhy - vlastnene(po, p, "dlh").length);
  s.abstakyZiskane += noveKliatby(pred, po, p, "abstak");
  s.poldeciVypite += Math.max(0, hPo.poldeciVypite - hPred.poldeciVypite);
  const dCig = hPo.cigarety - hPred.cigarety;
  if (dCig > 0) s.cigaretyZiskane += dCig;
  if (dCig < 0) s.cigaretyMinute += -dCig;

  return s;
}

/** Započíta jeden ťah (príkaz hráča `autor`) do štatistík oboch hráčov. */
export function zapisTah(
  stat: DvojicaStatistik,
  pred: GameState,
  cmd: Command,
  autor: PlayerId,
  po: GameState,
  events: readonly Event[],
): DvojicaStatistik {
  return [zapisJedneho(stat[0], pred, cmd, autor, po, events, 0), zapisJedneho(stat[1], pred, cmd, autor, po, events, 1)];
}

/** Záver partie: lokality, starší, vydesenie a body podľa podmienok scorecardov. */
export function uzavriStatistiky(data: GameData, stat: DvojicaStatistik, koniec: GameState): DvojicaStatistik {
  const bodovana = koniec.koniec?.body != null;
  const out = stat.map((st, i) => {
    const p = i as PlayerId;
    const s = { ...st, akcie: { ...st.akcie }, bodyPodla: { ...st.bodyPodla } } as Mut;
    s.kola = koniec.kolo;
    s.lokalityOvladnute = koniec.ovladnute.filter((o) => o.hrac === p).length;
    s.starsiVydeseni = koniec.starsi.filter((e) => vydesil(e as ElderState, p)).length;
    if (bodovana) {
      s.bodovanePartie = 1;
      for (const elder of koniec.starsi) {
        const score = elderScore(data, koniec, elder);
        if (score === null || score.hrac !== p) continue;
        for (const pol of score.polozky) s.bodyPodla[pol.podmienka] = (s.bodyPodla[pol.podmienka] ?? 0) + pol.body;
      }
      s.body = koniec.koniec?.body?.[p] ?? 0;
      s.najviacBodov = s.body;
    }
    return s as StatistikyHraca;
  });
  return [out[0] as StatistikyHraca, out[1] as StatistikyHraca];
}

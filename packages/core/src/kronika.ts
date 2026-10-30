// Kronika partie (Michal 2026-10-22, profily): záznam po kolách (bitkách) pre
// detail partie a súhrn hráča. Odvodí sa čisto zo stavu a udalostí po každom
// príkaze — rovnako ako zapisTah, bez I/O. Server ju uloží do archívu; čo z nej
// smie vidieť ktorý hráč, rozhoduje API (verejné sú výsledky bitiek, NA EX,
// pasy, šenok a body — nie karty v ruke).

import type { Command, Event, GameState } from "./engine.ts";
import { lineState, poskodenieBitky } from "./engine.ts";
import type { GameData } from "./data.ts";
import { evaluateLine } from "./partia.ts";
import type { DvojicaStatistik } from "./statistiky.ts";
import type { PlayerId } from "./types.ts";
import { opponentOf } from "./types.ts";

export interface NaexVKole {
  readonly kto: PlayerId;
  /** Majiteľ karty, na ktorú NA EX padlo. */
  readonly naCiu: PlayerId;
  /** Zlepšilo NA EX po súperovej odpovedi bitku v prospech toho, kto ho dal? null = nedalo sa posúdiť. */
  readonly uspech: boolean | null;
}

export interface KoloKroniky {
  readonly cislo: number;
  readonly lokalita: string | null;
  readonly utocnik: PlayerId;
  readonly pitky: number;
  readonly tuhe: readonly [number, number];
  readonly makke: readonly [number, number];
  /** null = sekera (remíza v tuhom, Absťákoch aj Dlhoch) alebo bitka sa neodohrala. */
  readonly vitaz: PlayerId | null;
  readonly sekera: boolean;
  readonly prebytok: { readonly drzi: PlayerId; readonly kolko: number } | null;
  readonly naex: readonly NaexVKole[];
  readonly pasy: readonly { readonly kto: PlayerId; readonly cigarety: number }[];
  /** Karty zo šenku a cigarety za ne. */
  readonly senok: readonly [number, number];
  readonly cigaretySenok: readonly [number, number];
  /** Pokus o zajatie v kole (v9; do v8 patronát). */
  readonly patronat: readonly [boolean, boolean];
  /** Nové Dlhy a Cirhózy v kole. */
  readonly dlhy: readonly [number, number];
  readonly cirhozy: readonly [number, number];
  /** Špaky oboch po kole (v6); pri konci hry konečné špaky. */
  readonly bodyPo: readonly [number, number] | null;
}

export interface StavKroniky {
  readonly kola: readonly KoloKroniky[];
  readonly kolo: KoloKroniky;
  /** NA EX čaká na súperovu odpoveď: rozdiel tuhého (kto − súper) pred NA EX. */
  readonly caka: { readonly index: number; readonly kto: PlayerId; readonly pred: number } | null;
}

const prazdneKolo = (s: GameState): KoloKroniky => ({
  cislo: s.kolo,
  lokalita: s.ciel?.lokalita?.defId ?? null,
  utocnik: s.utocnik,
  pitky: 0,
  tuhe: [0, 0],
  makke: [0, 0],
  vitaz: null,
  sekera: false,
  prebytok: null,
  naex: [],
  pasy: [],
  senok: [0, 0],
  cigaretySenok: [0, 0],
  patronat: [false, false],
  dlhy: [0, 0],
  cirhozy: [0, 0],
  bodyPo: null,
});

export function novaKronika(s: GameState): StavKroniky {
  return { kola: [], kolo: prazdneKolo(s), caka: null };
}

const pocet = (s: GameState, p: PlayerId, defId: string): number => {
  const h = s.hraci[p];
  return [...h.ruka, ...h.doberaci, ...h.odhadzovaci, ...h.priznane].filter((k) => k.defId === defId).length;
};
/** Rozdiel tuhého poškodenia (p − súper) v línii tak, ako by sa bitka vyhodnotila teraz. */
function rozdiel(data: GameData, s: GameState, p: PlayerId): number {
  const d = poskodenieBitky(data, s, evaluateLine(data, lineState(s)).sums);
  return d.tuhe[p] - d.tuhe[opponentOf(p)];
}
const dvojica = (x: readonly [number, number], p: PlayerId, o: number): [number, number] =>
  p === 0 ? [x[0] + o, x[1]] : [x[0], x[1] + o];

/** Zapíše jeden vykonaný príkaz (pred → po) do kroniky. */
export function zapisDoKroniky(
  data: GameData,
  k: StavKroniky,
  pred: GameState,
  cmd: Command,
  autor: PlayerId,
  po: GameState,
  events: readonly Event[],
): StavKroniky {
  let kolo: KoloKroniky = k.kolo;
  let caka = k.caka;
  if (kolo.lokalita === null && po.ciel?.lokalita != null) kolo = { ...kolo, lokalita: po.ciel.lokalita.defId };

  const kroky = cmd.type === "tah" ? cmd.kroky : [cmd];
  for (const c of kroky) {
    if (c.type === "pass") kolo = { ...kolo, pasy: [...kolo.pasy, { kto: autor, cigarety: Math.max(0, po.hraci[autor].cigarety - pred.hraci[autor].cigarety) }] };
    if (c.type === "draftBer") {
      kolo = {
        ...kolo,
        senok: dvojica(kolo.senok, autor, c.uids.length),
        cigaretySenok: dvojica(kolo.cigaretySenok, autor, Math.max(0, pred.hraci[autor].cigarety - po.hraci[autor].cigarety)),
      };
    }
    if (c.type === "pokus") kolo = { ...kolo, patronat: autor === 0 ? [true, kolo.patronat[1]] : [kolo.patronat[0], true] };
  }
  if (cmd.type === "naex") {
    const naKarte = [...pred.strany[0], ...pred.strany[1]].find((pl) => pl.card.uid === cmd.uid);
    kolo = { ...kolo, naex: [...kolo.naex, { kto: autor, naCiu: (naKarte?.playedBy ?? autor) as PlayerId, uspech: null }] };
    caka = { index: kolo.naex.length - 1, kto: autor, pred: rozdiel(data, pred, autor) };
  }
  // NA EX sa posúdi, keď súper odpovedal (alebo nemohol): reakcia už nečaká a stále je Pitka.
  if (caka !== null && po.pitkaStav?.reakcia == null) {
    const uspech = po.faza === "pitka" ? rozdiel(data, po, caka.kto) > caka.pred : null;
    const index = caka.index;
    kolo = { ...kolo, naex: kolo.naex.map((n, i) => (i === index ? { ...n, uspech } : n)) };
    caka = null;
  }

  for (const p of [0, 1] as const) {
    const noveDlhy = (po.hraci[p].dlhyZiskane ?? 0) - (pred.hraci[p].dlhyZiskane ?? 0);
    const noveCirhozy = pocet(po, p, "cirhoza") - pocet(pred, p, "cirhoza");
    if (noveDlhy > 0) kolo = { ...kolo, dlhy: dvojica(kolo.dlhy, p, noveDlhy) };
    if (noveCirhozy > 0) kolo = { ...kolo, cirhozy: dvojica(kolo.cirhozy, p, noveCirhozy) };
  }
  for (const e of events) {
    if (e.type === "faza" && e.faza === "pitka") kolo = { ...kolo, pitky: kolo.pitky + 1 };
    if (e.type === "bitkaVysledok") {
      kolo = {
        ...kolo,
        tuhe: [e.damage.tuhe[0], e.damage.tuhe[1]],
        makke: [e.damage.makke[0], e.damage.makke[1]],
        vitaz: e.vitaz,
        sekera: e.vitaz === null,
        prebytok: e.prebytokDrzi === null ? null : { drzi: e.prebytokDrzi, kolko: e.prebytokNaRozdelenie },
      };
    }
  }

  // Koniec kola (nové kolo alebo koniec hry): špaky po kole a ďalšie kolo.
  if (po.kolo !== pred.kolo || (po.koniec !== null && pred.koniec === null)) {
    const body = po.koniec?.body ?? po.spaky;
    const hotove: KoloKroniky = { ...kolo, bodyPo: [body[0], body[1]] };
    return { kola: [...k.kola, hotove], kolo: prazdneKolo(po), caka: null };
  }
  return { kola: k.kola, kolo, caka };
}

/** Štatistiky v2: úspešnosť NA EX z kroniky (posúdiť sa dá len po súperovej odpovedi). */
export function doplnNaexZKroniky(stat: DvojicaStatistik, kola: readonly KoloKroniky[]): DvojicaStatistik {
  const naex = kola.flatMap((k) => k.naex);
  const pre = (p: PlayerId) => ({
    ...stat[p],
    naexUspesne: stat[p].naexUspesne + naex.filter((n) => n.kto === p && n.uspech === true).length,
    naexHodnotene: stat[p].naexHodnotene + naex.filter((n) => n.kto === p && n.uspech !== null).length,
  });
  return [pre(0), pre(1)];
}

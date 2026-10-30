// Pečiatky momentov s Melicharom (Michal 2026-10-23, nápad 5 v
// docs/napady/napady-20261023-1447.html). Keď sa v partii naozaj niečo stane,
// stôl to povie nahlas: pečiatka na hrane stola a Melicharova hláška.
//
// momenty(pred, po, udalosti) je čistá a počíta len z VEREJNÝCH vecí: línia
// bez skrytých Záverečných, výhľad bitky, markery, sekera,
// výsledok bitky. Ruka, balíčky ani skrytá karta do nej nevstupujú (pravidlo 2)
// — moment je preto rovnaký pre oboch hráčov a server ho smie poslať obom.
// Strop (najviac 1 pečiatka za úsek kola, zlato najviac 2 za partiu) stráži
// obmedzMomenty, aby oslavy neotravovali.

import type { PlayerId } from "./types.ts";
import { opponentOf } from "./types.ts";
import type { GameData } from "./data.ts";
import type { Event, GameState } from "./engine.ts";
import { bitkyNaSekere, lineState, poskodenieBitky } from "./engine.ts";
import type { LineEval, LineState } from "./partia.ts";
import { evaluateLine } from "./partia.ts";
import { prebudenyPre } from "./elders.ts";

export type StupenMomentu = "bronz" | "striebro" | "zlato";

export type TypMomentu =
  | "zvrat"
  | "bomba"
  | "zaverecna"
  | "vzbura"
  | "prebudenie"
  | "zachranene"
  | "bitkaOVsetko"
  | "vyprask";

export interface Moment {
  readonly typ: TypMomentu;
  readonly stupen: StupenMomentu;
  /** Komu sa moment stal v prospech (Pohoda), jeho súperovi Smola; null = obom Údiv. */
  readonly hrac: PlayerId | null;
  /** Text pečiatky. */
  readonly nazov: string;
  /** Veta do logu — hráč vždy v tvare „Hráč N“ (nominatív), klient ho nahradí menom. */
  readonly popis: string;
}

/** Stupeň a text pečiatky každého momentu — aj pre ukážku v klientovi. */
export const MOMENTY: Readonly<Record<TypMomentu, { readonly stupen: StupenMomentu; readonly nazov: string }>> = {
  zvrat: { stupen: "striebro", nazov: "ZVRAT!" },
  bomba: { stupen: "striebro", nazov: "BOMBA ×4" },
  zaverecna: { stupen: "striebro", nazov: "ZÁVEREČNÁ!" },
  vzbura: { stupen: "bronz", nazov: "VZBURA!" },
  prebudenie: { stupen: "striebro", nazov: "PREBUDENIE" },
  zachranene: { stupen: "zlato", nazov: "ZACHRÁNENÉ" },
  bitkaOVsetko: { stupen: "striebro", nazov: "BITKA O VŠETKO" },
  vyprask: { stupen: "bronz", nazov: "VÝPRASK" },
};

/**
 * Nálada momentu pre Melicharovu hlášku. Ktoré skupiny hlášok (priečinky pri
 * importe) k nálade patria, určujú dáta — pole nalady v skupina.json
 * (npm run melichar, docs/NASADENIE.md 5c), nie kód.
 */
export const NALADY = ["pohoda", "smola", "udiv"] as const;
export type NaladaMomentu = (typeof NALADY)[number];

/**
 * Jediné miesto mapovania moment → nálada: akú náladu má moment pre toho, komu
 * sa stal v prospech (pre), a pre jeho súpera (proti). Moment bez hráča
 * (hrac null) má pre oboch náladu pre.
 */
export const NALADY_MOMENTOV: Readonly<Record<TypMomentu, { readonly pre: NaladaMomentu; readonly proti: NaladaMomentu }>> = {
  zvrat: { pre: "pohoda", proti: "smola" },
  bomba: { pre: "pohoda", proti: "smola" },
  zaverecna: { pre: "pohoda", proti: "smola" },
  vzbura: { pre: "udiv", proti: "udiv" },
  prebudenie: { pre: "pohoda", proti: "smola" },
  zachranene: { pre: "pohoda", proti: "smola" },
  bitkaOVsetko: { pre: "udiv", proti: "udiv" },
  vyprask: { pre: "pohoda", proti: "smola" },
};

/** Nálada momentu pre hráča ja. */
export function naladaMomentu(moment: Moment, ja: PlayerId): NaladaMomentu {
  const n = NALADY_MOMENTOV[moment.typ];
  return moment.hrac === null || moment.hrac === ja ? n.pre : n.proti;
}

const PORADIE_STUPNOV:Readonly<Record<StupenMomentu, number>> = { bronz: 0, striebro: 1, zlato: 2 };

/** Prebytok od tejto hodnoty je Výprask. */
export const VYPRASK_OD = 8;
/** Súčin násobkov akcie od tejto hodnoty je Bomba. */
export const BOMBA_OD = 4;
/** Zlatých pečiatok najviac za partiu. */
export const ZLATO_ZA_PARTIU = 2;

/** Línia bez skrytých Záverečných — to, čo vidia obaja. */
function verejnaLinia(s: GameState): LineState {
  const l = lineState(s);
  return { ...l, strany: l.strany.map((strana) => strana.filter((pl) => pl.zaverecna !== true)) as unknown as LineState["strany"] };
}

function skrytych(s: GameState): number {
  return s.strany.reduce((a, strana) => a + strana.filter((pl) => pl.zaverecna === true).length, 0);
}

/** Víťaz výhľadu bitky z verejnej línie; null = remíza či niet cieľa. */
function vyhlad(data: GameData, s: GameState, ev: LineEval): PlayerId | null {
  if (s.ciel === null) return null;
  const damage = poskodenieBitky(data, { ...s, strany: verejnaLinia(s).strany }, ev.sums);
  return damage.tuhe[0] === damage.tuhe[1] ? null : damage.tuhe[0] > damage.tuhe[1] ? 0 : 1;
}

/** Akcie so súčinom násobkov aspoň BOMBA_OD: [uid, akcia] — kľúč, aby sa rátali len nové. */
function bomby(s: GameState, ev: LineEval): Map<string, PlayerId> {
  const majitel = new Map<number, PlayerId>();
  for (const strana of s.strany) for (const pl of strana) majitel.set(pl.card.uid, pl.playedBy);
  const out = new Map<string, PlayerId>();
  for (const [uid, karta] of ev.cards) {
    const m = majitel.get(uid);
    if (m === undefined) continue;
    for (const [i, slot] of [...karta.left, ...karta.right].entries()) {
      if (slot === null || slot.stav !== "aktivna" || slot.nasobok < BOMBA_OD) continue;
      const akcia = slot.ako ?? slot.action;
      // Dlh a Poškodenie pečene ×4 sú bomba pod majiteľom — v prospech súpera.
      const komu = akcia === "Dlh" || akcia === "PoškodeniePečene" ? opponentOf(m) : m;
      out.set(`${uid}:${i}`, komu);
    }
  }
  return out;
}

function vzbury(ev: LineEval): number {
  let n = 0;
  for (const karta of ev.cards.values()) if (karta.vzbura) n++;
  return n;
}

/**
 * Momenty, ktoré priniesol jeden príkaz (stav pred, stav po a jeho udalosti).
 * Kandidáti — strop drží obmedzMomenty.
 */
export function momenty(data: GameData, pred: GameState, po: GameState, udalosti: readonly Event[]): Moment[] {
  const out: Moment[] = [];
  const evPred = evaluateLine(data, verejnaLinia(pred));
  const evPo = evaluateLine(data, verejnaLinia(po));

  // Zvrat posledným slovom: NA EX alebo odpoveď naň v Pitke otočí víťaza výhľadu
  // z jedného hráča na druhého (z remízy to zvrat nie je — inak by padal priveľmi často).
  const naexPred = pred.strany.flat().filter((pl) => pl.naexBy !== undefined).length;
  const naexPo = po.strany.flat().filter((pl) => pl.naexBy !== undefined).length;
  const kariet = (s: GameState): number => s.strany[0].length + s.strany[1].length;
  if (pred.faza === "pitka" && po.faza === "pitka" && (naexPo > naexPred || kariet(po) > kariet(pred))) {
    const a = vyhlad(data, pred, evPred);
    const b = vyhlad(data, po, evPo);
    if (a !== null && b !== null && a !== b) {
      out.push({ typ: "zvrat", ...MOMENTY.zvrat, hrac: b, popis: `Zvrat posledným slovom — bitku vo výhľade teraz vyhráva Hráč ${b + 1}.` });
    }
  }

  // Záverečná to otočila: po otočení skrytých kariet sa zmení víťaz výhľadu.
  if (skrytych(pred) > skrytych(po) && po.ciel !== null) {
    const a = vyhlad(data, pred, evPred);
    const b = vyhlad(data, po, evPo);
    if (b !== null && a !== b) {
      out.push({ typ: "zaverecna", ...MOMENTY.zaverecna, hrac: b, popis: `Záverečná to otočila — bitku vo výhľade teraz vyhráva Hráč ${b + 1}.` });
    }
  }

  // Bomba ×4: nová akcia so súčinom násobkov aspoň 4 (NA EX × Silná žena, Veterán…).
  const bPred = bomby(pred, evPred);
  for (const [kluc, komu] of bomby(po, evPo)) {
    if (bPred.has(kluc)) continue;
    out.push({ typ: "bomba", ...MOMENTY.bomba, hrac: komu, popis: `Bomba — akcia sa ráta aspoň štyrikrát, teší sa Hráč ${komu + 1}.` });
    break;
  }

  // Vzbura: Odpor proti Odporu na novom spoji.
  if (vzbury(evPo) > vzbury(evPred)) {
    out.push({ typ: "vzbura", ...MOMENTY.vzbura, hrac: null, popis: "Vzbura — Odpor narazil na Odpor a obe karty sa rozbehli naplno." });
  }

  // Prebudenie: marker staršieho dorazil na krajnú pozíciu.
  for (const e of po.starsi) {
    const predtym = pred.starsi.find((x) => x.elderId === e.elderId);
    const kto = prebudenyPre(e);
    if (kto === null || predtym === undefined || prebudenyPre(predtym) === kto) continue;
    out.push({ typ: "prebudenie", ...MOMENTY.prebudenie, hrac: kto, popis: `Prebudenie — starší sa zobudil, jeho efekt teraz využíva Hráč ${kto + 1}.` });
    break;
  }

  // Zachránené: ohlásené vydesenie zmarené (patronát, odpoveď súpera) a hra beží ďalej.
  for (const p of [0, 1] as const) {
    if (pred.ohlaseneVydesenie[p] !== null && po.ohlaseneVydesenie[p] === null && po.koniec === null) {
      const zachranca = opponentOf(p);
      out.push({ typ: "zachranene", ...MOMENTY.zachranene, hrac: zachranca, popis: `Zachránené — Hráč ${zachranca + 1} zmaril ohlásené vydesenie na poslednú chvíľu.` });
    }
  }

  // Bitka o všetko: na sekere sú špaky aspoň z dvoch bitiek, keď sa začína bitka.
  if (pred.faza !== "bitka" && po.faza === "bitka" && bitkyNaSekere(po.nastenka) >= 2) {
    out.push({ typ: "bitkaOVsetko", ...MOMENTY.bitkaOVsetko, hrac: null, popis: `Bitka o všetko — víťaz berie aj ${po.spakyNaSekere} špakov zo sekery.` });
  }

  // Výprask: prebytok aspoň 8.
  for (const e of udalosti) {
    if (e.type !== "bitkaVysledok" || e.prebytok < VYPRASK_OD || e.prebytokDrzi === null) continue;
    out.push({ typ: "vyprask", ...MOMENTY.vyprask, hrac: e.prebytokDrzi, popis: `Výprask — prebytok ${e.prebytok}, rozdeľuje ho Hráč ${e.prebytokDrzi + 1}.` });
  }
  return out;
}

/** Čo si partia pamätá kvôli stropu pečiatok. */
export interface StavMomentov {
  /** Úsek kola, v ktorom už pečiatka padla (kolo + Pitka či bitka). */
  readonly usek: string | null;
  readonly zlate: number;
}

export const NOVE_MOMENTY: StavMomentov = { usek: null, zlate: 0 };

/** Úsek kola pre strop: každá Pitka (aj jej Zhromaždenie) zvlášť, bitka zvlášť. */
function usekKola(s: GameState): string {
  if (s.faza === "bitka" || s.koniec !== null) return `${s.kolo}:b`;
  if (s.faza === "zhromazdenie" || s.faza === "pitka") return `${s.kolo}:p${s.pitkaCislo}`;
  return `${s.kolo}:z`;
}

/**
 * Strop: najviac jedna pečiatka za úsek kola (najvyšší stupeň vyhrá), zlato
 * najviac ZLATO_ZA_PARTIU za partiu — ďalšie zlato sa nepečiatkuje.
 */
export function obmedzMomenty(kandidati: readonly Moment[], stav: StavMomentov, po: GameState): { vybrane: Moment[]; stav: StavMomentov } {
  const usek = usekKola(po);
  if (stav.usek === usek) return { vybrane: [], stav };
  const povolene = kandidati.filter((m) => m.stupen !== "zlato" || stav.zlate < ZLATO_ZA_PARTIU);
  if (povolene.length === 0) return { vybrane: [], stav };
  const najlepsi = [...povolene].sort((a, b) => PORADIE_STUPNOV[b.stupen] - PORADIE_STUPNOV[a.stupen])[0] as Moment;
  return { vybrane: [najlepsi], stav: { usek, zlate: stav.zlate + (najlepsi.stupen === "zlato" ? 1 : 0) } };
}

// Hrany karty v línii z pohľadu hráča — spoločné pre web aj textového klienta.
//
// Prečo: šesť playtestov za sebou sa hráči mýlili, ktorá hrana karty sa
// spáruje. „Ľavá/pravá“ závisí od strany línie: na tvojej strane sa
// k lokalite obracia pravá hrana tvojej karty, na súperovej ľavá. Pojmy
// VNÚTORNÁ (obrátená k lokalite, páruje sa so susedom bližšie k stredu)
// a VONKAJŠIA (voľná pre ďalšiu kartu) platia rovnako na oboch stranách.
//
// Rám diváka: jeho strana je vľavo, lokalita v strede, súperova strana
// vpravo; hrany sa čítajú zhora nadol tak, ako ich vidí. Na spoji sa
// stretnú sloty s rovnakým indexom aj v tomto ráme (otočenie celej línie
// o 180° pre hráča 1 zachová páry).

import type { Action, CardInstance, PlayerId, Slot } from "./types.ts";
import { opponentOf } from "./types.ts";
import type { GameData } from "./data.ts";
import { defOf, printedSides } from "./data.ts";
import type { ActionSums, LineEval, LineState, PlacedCard } from "./partia.ts";
import { evaluateLine, premenyVLinii } from "./partia.ts";
import type { KartaSNastrojmi } from "./naradie.ts";
import { preskolenaStrana, preskoleniaHostitela } from "./naradie.ts";
import { bitkaMody, zadlzeniePitkyZLinie } from "./effects.ts";
import type { VerejnyStav } from "./effects.ts";

export interface HranyZPohladu {
  readonly lava: readonly Slot[];
  readonly prava: readonly Slot[];
}

/**
 * Hrany karty tak, ako ich vidí divák (zhora nadol); `otocena` = karta je voči nemu nohami hore.
 * Karta v línii (`vLinii`) má akcie už premenené podloženým Nástrojom — s nimi sa páruje;
 * `premeny` (partia.ts premenyVLinii) pridajú aj Školiteľov.
 */
export function hranyZPohladu(
  data: GameData,
  karta: CardInstance,
  otocena: boolean,
  vLinii?: KartaSNastrojmi,
  premeny: ReadonlyMap<Action, { readonly na: Action; readonly uid: number }> = vLinii === undefined ? new Map() : preskoleniaHostitela(data, vLinii),
): HranyZPohladu {
  const tlac = printedSides(data, karta);
  const p = { left: preskolenaStrana(premeny, tlac.left), right: preskolenaStrana(premeny, tlac.right) };
  return otocena
    ? { lava: [...p.right].reverse(), prava: [...p.left].reverse() }
    : { lava: [...p.left], prava: [...p.right] };
}

export interface StranyLokality {
  /** Hrana lokality obrátená ku kraju vľavo (z pohľadu hráča). */
  readonly kTebe: readonly Slot[];
  /** Hrana lokality obrátená ku kraju vpravo (z pohľadu hráča). */
  readonly kSuperovi: readonly Slot[];
}

/** Strany lokality (aj karty staršieho v strede); `lokalitaOtocena` je v ráme hráča 0 ako v LineState a chooseLocation. */
export function stranyLokality(data: GameData, lokalita: CardInstance, lokalitaOtocena: boolean, ja: PlayerId): StranyLokality {
  const h = hranyZPohladu(data, lokalita, lokalitaOtocena !== (ja === 1));
  return { kTebe: h.lava, kSuperovi: h.prava };
}

export type StranaLinie = "vlastna" | "superova";

export interface SusedNaSpoji {
  readonly karta: CardInstance;
  /** true = lokalita alebo karta staršieho v strede línie. */
  readonly stred: boolean;
  /** Majiteľ susednej karty; stred nemá majiteľa. */
  readonly majitel: PlayerId | null;
  /** Hrana suseda, ktorá sa stretne s novou kartou (zhora nadol z pohľadu hráča). */
  readonly hrana: readonly Slot[];
}

export interface NahladVylozenia {
  /** Vnútorná hrana novej karty (k lokalite), zhora nadol z pohľadu hráča. */
  readonly vnutorna: readonly Slot[];
  /** Vonkajšia hrana — ostane voľná pre ďalšiu kartu. */
  readonly vonkajsia: readonly Slot[];
  /** Vytlačená strana karty, ktorá bude vnútorná (karta je k hráčovi natočená, takže vo vlastnom ráme). */
  readonly vnutornaVytlacena: "left" | "right";
  readonly sused: SusedNaSpoji | null;
  /** Indexy (zhora), na ktorých sa stretnú dve neprázdne akcie. */
  readonly pary: readonly { readonly index: number; readonly moja: NonNullable<Slot>; readonly susedova: NonNullable<Slot> }[];
  /** Zmena súčtov aktívnych akcií oproti stolu bez karty, [hráč 0, hráč 1]. */
  readonly zmeny: readonly [ActionSums, ActionSums];
  /**
   * Zmena tuhého navyše z kariet v línii (Pes, Recidivista, Lesná cesta, Ihrisko —
   * bitkaMody), [hráč 0, hráč 1]. Bonus Psa náhľad predtým vynechal
   * (playtest 20261026-173610-1).
   */
  readonly tuhe: readonly [number, number];
}

/**
 * Tuhé navyše z kariet v línii — ten istý výpočet ako bitka (bitkaMody), bez Dedičstva a starších.
 * `naexVKole`: kto už v kole dal NA EX — Šofér potom Pecku navyše nedá (playtest 20261030-184957).
 */
function tuheZLinie(data: GameData, line: LineState, strany: LineState["strany"], naexVKole?: readonly [boolean, boolean]): readonly [number, number] {
  const ciel: VerejnyStav["ciel"] = line.lokalita === null ? null : { typ: "lokalita", lokalita: line.lokalita };
  const stav: VerejnyStav = {
    ciel,
    strany,
    starsi: [],
    hraci: [{ priznane: [], dlhy: 0, abstaky: 0, dedicstvo: [] }, { priznane: [], dlhy: 0, abstaky: 0, dedicstvo: [] }],
    ...(naexVKole !== undefined ? { naexVKole } : {}),
  };
  return [bitkaMody(data, stav, 0).tuheBonus, bitkaMody(data, stav, 1).tuheBonus];
}

function rozdiel(pred: ActionSums, po: ActionSums): ActionSums {
  const out: Partial<Record<keyof ActionSums, number>> = {};
  const kluce = new Set([...Object.keys(pred), ...Object.keys(po)]) as Set<keyof ActionSums>;
  for (const k of kluce) {
    const d = (po[k] ?? 0) - (pred[k] ?? 0);
    if (d !== 0) out[k] = d;
  }
  return out;
}

/**
 * Čo spraví karta hráča `ja` vyložená na koniec línie `kam` — pred potvrdením.
 * `naexVKole` zo stavu (view.naexVKole); bez neho náhľad ráta, že v kole ešte nikto NA EX nedal.
 */
export function nahladVylozenia(
  data: GameData,
  line: LineState,
  ja: PlayerId,
  karta: CardInstance,
  kam: StranaLinie,
  naexVKole?: readonly [boolean, boolean],
  /**
   * Línia po vyložení tak, ako ju zloží motor (sPrilozenou: Konflikt a Podpora oboch kariet,
   * Miňištrant, Šarlatán) — bez nej sa karta len priloží a spúšťače spoja náhľad nevidí.
   */
  stranyPo?: LineState["strany"],
): NahladVylozenia {
  const p = kam === "vlastna" ? ja : opponentOf(ja);
  const naMojej = kam === "vlastna";
  const strana = line.strany[p];
  const nova: readonly PlacedCard[] = [...strana, { card: karta, playedBy: ja }];
  const strany: LineState["strany"] = stranyPo ?? (p === 0 ? [nova, line.strany[1]] : [line.strany[0], nova]);
  // Furt Školiteľa preškolí oboch susedov — páry sa ukážu už s preškolenými akciami.
  const premenyPo = premenyVLinii(data, { lokalita: line.lokalita, strany });
  // Hráčova karta je k nemu natočená; jeho strana je vľavo od lokality,
  // takže k stredu sa na nej obracia pravá hrana, na súperovej ľavá.
  const moje = hranyZPohladu(data, karta, false, undefined, premenyPo.get(karta.uid)?.hrany);
  const vnutorna = naMojej ? moje.prava : moje.lava;
  const vonkajsia = naMojej ? moje.lava : moje.prava;

  const krajna = strana[strana.length - 1];
  let sused: SusedNaSpoji | null = null;
  if (krajna !== undefined) {
    const h = hranyZPohladu(data, krajna.card, krajna.playedBy !== ja, krajna, premenyPo.get(krajna.card.uid)?.hrany);
    sused = { karta: krajna.card, stred: false, majitel: krajna.playedBy, hrana: naMojej ? h.lava : h.prava };
  } else if (line.lokalita !== null) {
    const s = stranyLokality(data, line.lokalita, line.lokalitaOtocena, ja);
    sused = { karta: line.lokalita, stred: true, majitel: null, hrana: naMojej ? s.kTebe : s.kSuperovi };
  }

  const pary: { index: number; moja: NonNullable<Slot>; susedova: NonNullable<Slot> }[] = [];
  if (sused !== null) {
    for (let k = 0; k < 4; k++) {
      const a = vnutorna[k] ?? null;
      const b = sused.hrana[k] ?? null;
      if (a !== null && b !== null) pary.push({ index: k, moja: a, susedova: b });
    }
  }

  // Zadĺženie tak, ako ho pripíše Pitka — Finančná poradkyňa posiela Dlh súperovi, Policajtka pridá pokutu.
  const sumy = (s: LineState["strany"], ev: LineEval): readonly [ActionSums, ActionSums] => {
    const z = zadlzeniePitkyZLinie(data, { strany: s }, ev);
    return [{ ...ev.sums[0], Dlh: z[0] }, { ...ev.sums[1], Dlh: z[1] }];
  };
  const pred = sumy(line.strany, evaluateLine(data, line));
  const po = sumy(strany, evaluateLine(data, { ...line, strany }));
  const tuhePred = tuheZLinie(data, line, line.strany, naexVKole);
  const tuhePo = tuheZLinie(data, line, strany, naexVKole);

  return {
    vnutorna,
    vonkajsia,
    vnutornaVytlacena: naMojej ? "right" : "left",
    sused,
    pary,
    zmeny: [rozdiel(pred[0], po[0]), rozdiel(pred[1], po[1])],
    tuhe: [tuhePo[0] - tuhePred[0], tuhePo[1] - tuhePred[1]],
  };
}

/**
 * Kraje línie (Michal 2026-10-20): názov polovice pri strane hráča 0 a 1 podľa
 * hrán karty v strede (tvorca, `kraj`). Vytlačená ľavá hrana leží pri strane
 * hráča 0, kým lokalita nie je otočená. Bez názvu null.
 */
export function krajeStran(data: GameData, stred: CardInstance | null, otocena: boolean): [string | null, string | null] {
  const def = stred === null ? undefined : data.cards.get(stred.defId);
  if (def === undefined) return [null, null];
  const lava = def.left.kraj ?? null;
  const prava = def.right.kraj ?? null;
  return otocena ? [prava, lava] : [lava, prava];
}

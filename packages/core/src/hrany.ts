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

import type { CardInstance, PlayerId, Slot } from "./types.ts";
import type { GameData } from "./data.ts";
import { defOf, printedSides } from "./data.ts";
import type { ActionSums, LineEval, LineState, PlacedCard } from "./partia.ts";
import { evaluateLine, spojVznikne, snubenicaVracia } from "./partia.ts";
import { zadlzenieZLinie } from "./effects.ts";

export interface HranyZPohladu {
  readonly lava: readonly Slot[];
  readonly prava: readonly Slot[];
}

/** Hrany karty tak, ako ich vidí divák (zhora nadol); `otocena` = karta je voči nemu nohami hore. */
export function hranyZPohladu(data: GameData, karta: CardInstance, otocena: boolean): HranyZPohladu {
  const p = printedSides(data, karta);
  return otocena
    ? { lava: [...p.right].reverse(), prava: [...p.left].reverse() }
    : { lava: [...p.left], prava: [...p.right] };
}

export interface StranyLokality {
  /** Hrana lokality obrátená k tvojej strane línie. */
  readonly kTebe: readonly Slot[];
  /** Hrana lokality obrátená k súperovej strane. */
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

/** Čo spraví karta hráča `ja` vyložená na koniec strany `kam` — pred potvrdením. */
export function nahladVylozenia(
  data: GameData,
  line: LineState,
  ja: PlayerId,
  karta: CardInstance,
  kam: StranaLinie,
): NahladVylozenia {
  const p: PlayerId = kam === "vlastna" ? ja : ja === 0 ? 1 : 0;
  const naMojej = kam === "vlastna";
  // Hráčova karta je k nemu natočená; jeho strana je vľavo od lokality,
  // takže k stredu sa na nej obracia pravá hrana, na súperovej ľavá.
  const moje = hranyZPohladu(data, karta, false);
  const vnutorna = naMojej ? moje.prava : moje.lava;
  const vonkajsia = naMojej ? moje.lava : moje.prava;

  // Snúbenica vedľa karty s NA EX ju pošle do ruky a ľahne na jej miesto.
  const strana = snubenicaVracia(line.strany[p], karta.defId) === null ? line.strany[p] : line.strany[p].slice(0, -1);
  const krajna = strana[strana.length - 1];
  let sused: SusedNaSpoji | null = null;
  if (krajna !== undefined) {
    const h = hranyZPohladu(data, krajna.card, krajna.playedBy !== ja);
    sused = { karta: krajna.card, stred: false, majitel: krajna.playedBy, hrana: naMojej ? h.lava : h.prava };
  } else if (line.lokalita !== null) {
    const s = stranyLokality(data, line.lokalita, line.lokalitaOtocena, ja);
    sused = { karta: line.lokalita, stred: true, majitel: null, hrana: naMojej ? s.kTebe : s.kSuperovi };
  } else if (line.finale === true) {
    // Finále: línia je jeden úsek, prvá karta druhej strany je stredová — jej
    // vnútorná hrana sa obracia k tejto strane (playtest 20261027-062058: „nič sa nespojí“).
    const stredova = line.strany[p === 0 ? 1 : 0][0];
    if (stredova !== undefined) {
      const h = hranyZPohladu(data, stredova.card, stredova.playedBy !== ja);
      sused = { karta: stredova.card, stred: false, majitel: stredova.playedBy, hrana: naMojej ? h.lava : h.prava };
    }
  }

  const pary: { index: number; moja: NonNullable<Slot>; susedova: NonNullable<Slot> }[] = [];
  const spoj =
    sused !== null &&
    spojVznikne({ tags: defOf(data, karta).tags, stred: false }, { tags: defOf(data, sused.karta).tags, stred: sused.stred });
  if (sused !== null && spoj) {
    for (let k = 0; k < 4; k++) {
      const a = vnutorna[k] ?? null;
      const b = sused.hrana[k] ?? null;
      if (a !== null && b !== null) pary.push({ index: k, moja: a, susedova: b });
    }
  }

  const nova: readonly PlacedCard[] = [...strana, { card: karta, playedBy: ja }];
  const strany: LineState["strany"] = p === 0 ? [nova, line.strany[1]] : [line.strany[0], nova];
  // Dlh tak, ako ho pripíše Pitka — Finančná poradkyňa ho posiela súperovi.
  const sumy = (s: LineState["strany"], ev: LineEval): readonly [ActionSums, ActionSums] => {
    const z = zadlzenieZLinie(data, { strany: s }, ev);
    return [{ ...ev.sums[0], Dlh: z[0] }, { ...ev.sums[1], Dlh: z[1] }];
  };
  const pred = sumy(line.strany, evaluateLine(data, line));
  const po = sumy(strany, evaluateLine(data, { ...line, strany }));

  return {
    vnutorna,
    vonkajsia,
    vnutornaVytlacena: naMojej ? "right" : "left",
    sused,
    pary,
    zmeny: [rozdiel(pred[0], po[0]), rozdiel(pred[1], po[1])],
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

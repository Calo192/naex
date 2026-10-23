// Hrozba na stole (Michal 2026-10-23, roadmapa, nápad 1 z napady-20261023-1016):
// výhľad bitky ukáže najhorší prípad z toho, čo leží na stole — o koľko ešte
// hráč môže otočiť bitku jedným NA EX. Ruka sa nepočíta vôbec (skrytá ostáva
// skrytá), ani ďalšie vyložené karty či odpoveď na NA EX. Počíta sa len
// z verejných vecí, takže to isté smie ukázať web aj klient agentov.

import type { BattleOutcome, DamageResult } from "./battle.ts";
import { battleOutcome } from "./battle.ts";
import type { GameData } from "./data.ts";
import type { VerejnyStav } from "./effects.ts";
import { zakazNaex } from "./effects.ts";
import type { PitkaStav } from "./engine.ts";
import { lineState, naexCieleVLinii, poskodenieBitky } from "./engine.ts";
import { evaluateLine } from "./partia.ts";
import type { Phase, PlayerId } from "./types.ts";

/** Stôl bitky — verejný stav s otočením lokality (to isté, z čoho sa ráta odhad bitky). */
export type StolBitky = VerejnyStav & { readonly lokalitaOtocena: boolean };

/** Čo treba vedieť, či hráč ešte smie dať NA EX pred bitkou (všetko verejné). */
export interface PriebehNaex {
  readonly faza: Phase;
  readonly pitkaStav: PitkaStav | null;
  /** Odohrané Pitky kola a koľko ich kolo má. */
  readonly pitkaCislo: number;
  readonly pitkyCelkom: number;
  readonly poldeciPlne: readonly [number, number];
}

export interface HrozbaNaex {
  /** Kto by NA EX dal. */
  readonly hrac: PlayerId;
  /** Karta v línii, na ktorú by NA EX dal. */
  readonly uid: number;
  readonly damage: DamageResult;
  readonly vysledok: BattleOutcome;
}

/**
 * Smie hráč p ešte pred bitkou dať NA EX? V Zhromaždení áno (Pitka príde), v Pitke,
 * kým ho v nej nepoužil alebo nie je hotový — alebo ak po nej príde ďalšia Pitka.
 */
export function mozeEsteNaex(stol: StolBitky, priebeh: PriebehNaex, p: PlayerId): boolean {
  if (zakazNaex(stol) || priebeh.poldeciPlne[p] <= 0) return false;
  if (priebeh.faza === "zhromazdenie") return true;
  if (priebeh.faza !== "pitka") return false;
  const pitka = priebeh.pitkaStav;
  const vTejtoPitke = pitka !== null && !pitka.hotovy[p] && !pitka.naexPouzity[p];
  return vTejtoPitke || priebeh.pitkaCislo < priebeh.pitkyCelkom;
}

/** Ako dobre bitka dopadne pre hráča p: najprv víťaz, potom prebytok (kto ho drží a koľko). */
function hodnota(v: BattleOutcome, p: PlayerId): number {
  const vitaz = v.vitaz === null ? 0 : v.vitaz === p ? 1 : -1;
  const prebytok = v.prebytokDrzi === null ? 0 : v.prebytokDrzi === p ? v.prebytok : -v.prebytok;
  return vitaz * 1000 + prebytok;
}

/**
 * Najsilnejšie NA EX hráča p z kariet na stole — len ak zmení víťaza alebo
 * prebytok v jeho prospech (inak null; riadok by bol len šum). Ten istý výpočet
 * ako odhad bitky: línia s poldecákom navyše na jednej karte.
 */
export function hrozbaNaex(
  data: GameData,
  stol: StolBitky,
  priebeh: PriebehNaex,
  p: PlayerId,
  abstakyVRuke: readonly [number, number],
): HrozbaNaex | null {
  if (stol.ciel === null || !mozeEsteNaex(stol, priebeh, p)) return null;
  const bitka = (s: StolBitky): DamageResult => poskodenieBitky(data, s, evaluateLine(data, lineState(s)).sums, abstakyVRuke);
  const teraz = hodnota(battleOutcome(bitka(stol)), p);
  let najlepsia: HrozbaNaex | null = null;
  for (const uid of naexCieleVLinii(data, lineState(stol), p)) {
    const strany = stol.strany.map((strana) => strana.map((pl) => (pl.card.uid === uid ? { ...pl, naexBy: p } : pl))) as unknown as StolBitky["strany"];
    const damage = bitka({ ...stol, strany });
    const vysledok = battleOutcome(damage);
    const h = hodnota(vysledok, p);
    if (h > teraz && (najlepsia === null || h > hodnota(najlepsia.vysledok, p))) najlepsia = { hrac: p, uid, damage, vysledok };
  }
  return najlepsia;
}


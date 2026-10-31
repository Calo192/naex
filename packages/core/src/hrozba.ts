// Hrozba na stole (Michal 2026-10-23, roadmapa, nápad 1 z napady-20261023-1016):
// výhľad bitky ukáže najhorší prípad z toho, čo leží na stole — o koľko ešte
// hráč môže otočiť bitku jedným NA EX. Ruka sa nepočíta vôbec (skrytá ostáva
// skrytá), ani ďalšie vyložené karty či odpoveď na NA EX. Počíta sa len
// z verejných vecí, takže to isté smie ukázať web aj klient agentov.

import type { BattleOutcome, DamageResult } from "./battle.ts";
import { battleOutcome } from "./battle.ts";
import type { GameData } from "./data.ts";
import type { VerejnyStav } from "./effects.ts";
import { naexZaPitku } from "./effects.ts";
import type { BitkaKrok, PitkaStav } from "./engine.ts";
import { lineState, naexCieleVLinii, pohorseniaVBitke, poskodenieBitky, stranyBitky } from "./engine.ts";
import type { ElderState, MarkerPos } from "./elders.ts";
import { MARKER_KRAJ, MARKER_STRED, cenaPosunuOPoli, telefonHraca } from "./elders.ts";
import type { ActionSums } from "./partia.ts";
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
  const pitka = priebeh.pitkaStav;
  // Skryté NA EX (v5) míňajú poldeci aj limit Pitky už teraz, hoci sa odpíšu až pri
  // odkrytí. Klient pozná len svoje, súperove mu viewFor nepošle.
  const skryte = priebeh.faza === "pitka" ? (pitka?.skryteNaex ?? []).filter((x) => x.hrac === p).length : 0;
  if (priebeh.poldeciPlne[p] - skryte <= 0) return false;
  if (priebeh.faza === "zhromazdenie") return true;
  if (priebeh.faza !== "pitka") return false;
  const vTejtoPitke = pitka !== null && !pitka.hotovy[p] && !pitka.naexPouzity[p] && (pitka.naexPocet?.[p] ?? 0) + skryte < naexZaPitku(stol);
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
): HrozbaNaex | null {
  if (stol.ciel === null || !mozeEsteNaex(stol, priebeh, p)) return null;
  const bitka = (s: StolBitky): DamageResult => poskodenieBitky(data, s, evaluateLine(data, lineState(s)).sums);
  const teraz = hodnota(battleOutcome(bitka(stol)), p);
  let najlepsia: HrozbaNaex | null = null;
  for (const uid of naexCieleVLinii(data, lineState(stol), p)) {
    const strany = stol.strany.map((strana) => strana.map((pl) => (pl.card.uid === uid ? { ...pl, naexBy: p } : pl))) as unknown as StolBitky["strany"];
    // NA EX v kole vypne Šoférov bonus (playtest v7 131033: hrozba 6 : 6, náhľad 4 : 6).
    const naexVKole: [boolean, boolean] = [stol.naexVKole?.[0] ?? false, stol.naexVKole?.[1] ?? false];
    naexVKole[p] = true;
    const damage = bitka({ ...stol, strany, naexVKole });
    const vysledok = battleOutcome(damage);
    const h = hodnota(vysledok, p);
    if (h > teraz && (najlepsia === null || h > hodnota(najlepsia.vysledok, p))) najlepsia = { hrac: p, uid, damage, vysledok };
  }
  return najlepsia;
}


/**
 * Rozsah nepridelených Pohoršení (Michal 2026-10-27 „ukázať rozsah“, playtest
 * 20261027-105422): odhad bitky ráta s markermi, ako stoja, no Pohoršenia sa
 * prideľujú až v bitke a priazeň (Bitkár, Veriaci) mení
 * poškodenie hneď. Všetko z verejného: počty Pohoršení vidia obaja.
 */
export interface NepridelenePohorsenia {
  readonly pocet: readonly [number, number];
}

/** Stôl pre Pohoršenia: verejné pokusy o zajatie (v9) a stav bitky (GameState aj ClientState). */
export type StolPohorseni = StolBitky & {
  readonly pokusy: readonly ({ readonly elderId: string } | null)[];
  readonly bitkaStav: {
    readonly krok: BitkaKrok | null;
    readonly damage: DamageResult | null;
    readonly caka: PlayerId | null;
    readonly pohorsenieZostava: readonly [number, number];
  } | null;
};

/**
 * Pohoršenia, ktoré hráči ešte rozdelia pred poškodením. Pred bitkou (a kým
 * ich bitka pri vstupe do Povier nepridelí) ten istý výpočet ako nastavSumy,
 * v bitke zvyšok z bitkaStav. Povery bez čakajúceho hráča = bitka do nich ešte
 * nevstúpila (stojí na voľbe z efektu Bitka či Furt).
 */
export function nepridelenePohorsenia(data: GameData, stol: StolPohorseni, sums: readonly [ActionSums, ActionSums]): NepridelenePohorsenia {
  const b = stol.bitkaStav;
  if (b !== null && b.damage !== null) return { pocet: [0, 0] };
  if (b === null || (b.krok === "povery" && b.caka === null)) return { pocet: pohorseniaVBitke(data, stol, sums) };
  return { pocet: b.pohorsenieZostava };
}

export interface RozsahPohorseni {
  /** Kto Pohoršenia rozdeľuje. */
  readonly hrac: PlayerId;
  readonly pocet: number;
  /** Najlepšia bitka pre hráča, ktorý ich rozdeľuje (súperove stoja). */
  readonly damage: DamageResult;
  readonly vysledok: BattleOutcome;
}

/**
 * Najlepšia bitka, akú hráč p dosiahne svojimi nepridelenými Pohoršeniami
 * (k sebe aj k súperovi, súperove Pohoršenia stoja) — len ak zmení víťaza alebo
 * prebytok v jeho prospech, inak null. Ten istý výpočet ako vyhodnotPoskodenie:
 * súčty línie stoja, poškodenie sa ráta s novou priazňou. Posun stojí podľa zóny
 * (v8.2, cenaPosunuOPoli); že marker ide, kým body stačia, odhad zanedbá — zvyšok
 * hráč spravidla minie najprv na iného staršieho. Prehľadáva len starších, ktorých
 * posun mení vstupy bitky.
 */
export function rozsahPohorseni(
  data: GameData,
  stol: StolPohorseni,
  sums: readonly [ActionSums, ActionSums],
  nepridelene: NepridelenePohorsenia,
  p: PlayerId,
): RozsahPohorseni | null {
  const n = nepridelene.pocet[p];
  if (stol.ciel === null || n <= 0) return null;
  const bitka = (starsi: readonly ElderState[]): DamageResult => poskodenieBitky(data, { ...stol, starsi }, sums);
  const teraz = hodnota(battleOutcome(bitka(stol.starsi)), p);
  // Porovnáva sa vstup bitky, nie poškodenie: priazeň skrytá pod súperovou Vierou
  // (tuhé orezané na 0) poškodenie sama nezmení, s posunom iného staršieho však áno.
  const strany = (starsi: readonly ElderState[]): string => JSON.stringify(stranyBitky(data, { ...stol, starsi }, sums));
  const zakladStrany = strany(stol.starsi);
  // Starší v ohrození (pokus o zajatie, v9) sa v kole pokusu nehýbe.
  const vOhrozeni = new Set(stol.pokusy.flatMap((x) => (x === null ? [] : [x.elderId])));
  const posun = (e: ElderState, d: number): ElderState => ({ ...e, marker: (e.marker + d) as MarkerPos });
  // Posuny d každého staršieho: záporné k hráčovi 0, kladné k hráčovi 1.
  const kandidati = stol.starsi
    .map((e, i) => {
      const max = vOhrozeni.has(e.elderId) ? 0 : n;
      const od = -Math.min(max, e.marker - MARKER_KRAJ[0]);
      const po = Math.min(max, MARKER_KRAJ[1] - e.marker);
      const meni = Array.from({ length: po - od + 1 }, (_, k) => od + k).some(
        (d) => d !== 0 && strany(stol.starsi.map((x, j) => (j === i ? posun(x, d) : x))) !== zakladStrany,
      );
      return { i, od, po, meni, max };
    })
    .filter((k) => k.meni);
  let najlepsia: RozsahPohorseni | null = null;
  let najlepsiaHodnota = teraz;
  const skus = (k: number, zostava: number, starsi: readonly ElderState[]): void => {
    const kand = kandidati[k];
    if (kand === undefined) {
      const damage = bitka(starsi);
      const vysledok = battleOutcome(damage);
      const h = hodnota(vysledok, p);
      if (h > najlepsiaHodnota) {
        najlepsiaHodnota = h;
        najlepsia = { hrac: p, pocet: n, damage, vysledok };
      }
      return;
    }
    const z = stol.starsi[kand.i]?.marker ?? MARKER_STRED;
    for (let d = Math.max(kand.od, -zostava); d <= Math.min(kand.po, zostava); d++) {
      const cena = cenaPosunuOPoli(z, d, telefonHraca(stol, p));
      if (cena > Math.min(zostava, kand.max)) continue;
      skus(k + 1, zostava - cena, d === 0 ? starsi : starsi.map((x, j) => (j === kand.i ? posun(x, d) : x)));
    }
  };
  skus(0, n, stol.starsi);
  return najlepsia;
}

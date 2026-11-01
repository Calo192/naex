// Hrozba na stole (Michal 2026-10-23, roadmapa, nápad 1 z napady-20261023-1016):
// výhľad bitky ukáže najhorší prípad z toho, čo leží na stole — o koľko ešte
// hráč môže otočiť bitku jedným NA EX. Ruka sa nepočíta vôbec (skrytá ostáva
// skrytá), ani ďalšie vyložené karty či odpoveď na NA EX. Počíta sa len
// z verejných vecí, takže to isté smie ukázať web aj klient agentov.

import type { BattleOutcome, DamageResult } from "./battle.ts";
import { battleOutcome, vysledokHadky } from "./battle.ts";
import type { GameData } from "./data.ts";
import type { VerejnyStav } from "./effects.ts";
import { naexZaPitku } from "./effects.ts";
import type { BitkaKrok, PitkaStav } from "./engine.ts";
import { lineState, naexCieleVLinii, poskodenieBitky, stranyBitky } from "./engine.ts";
import type { ElderState, Klebety } from "./elders.ts";
import { MARKER_KRAJ, cenaPosunuOPoli, polohaPriazne } from "./elders.ts";
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
 * Rozsah nerozdelenej hádky (v10; predtým rozsah Pohoršení, Michal 2026-10-27 „ukázať
 * rozsah“): odhad bitky ráta s priazňami, ako stoja, no víťaz hádky ich pred poškodením
 * posunie k sebe (Bitkár, Veriaci, Abstinent). Všetko z verejného: línia aj hádka.
 */
export interface NerozdelenaHadka {
  /** Víťaz hádky (null = remíza alebo hádka nie je). */
  readonly vitaz: PlayerId | null;
  /** Koľko z hádky ešte rozdelí. */
  readonly zostava: number;
}

/** Stôl pre hádku: stav bitky (GameState aj ClientState). */
export type StolHadky = StolBitky & {
  readonly bitkaStav: {
    readonly krok: BitkaKrok | null;
    readonly damage: DamageResult | null;
    readonly caka: PlayerId | null;
    readonly hadka?: { readonly vitaz: PlayerId | null; readonly zostava: number };
    readonly klebety?: Klebety;
  } | null;
};

/**
 * Hádka, ktorú víťaz ešte rozdelí pred poškodením. Pred bitkou (a kým do nej bitka
 * nevstúpila) z mäkkého línie — ten istý výpočet ako vstup do hádky; v bitke zvyšok z bitkaStav.
 */
export function nerozdelenaHadka(data: GameData, stol: StolHadky, sums: readonly [ActionSums, ActionSums]): NerozdelenaHadka {
  const b = stol.bitkaStav;
  if (b !== null && b.damage !== null) return { vitaz: null, zostava: 0 };
  if (b === null || b.hadka === undefined) {
    const h = vysledokHadky(poskodenieBitky(data, stol, sums).makke);
    return { vitaz: h.vitaz, zostava: h.velkost };
  }
  return { vitaz: b.hadka.vitaz, zostava: b.hadka.zostava };
}

export interface RozsahHadky {
  /** Kto hádku rozdeľuje (jej víťaz). */
  readonly hrac: PlayerId;
  readonly pocet: number;
  /** Najlepšia bitka pre víťaza hádky. */
  readonly damage: DamageResult;
  readonly vysledok: BattleOutcome;
}

/**
 * Najlepšia bitka, akú víťaz hádky p dosiahne jej rozdelením (len k sebe, cena podľa zóny,
 * strop 3) — len ak zmení víťaza alebo Nakladačku v jeho prospech, inak null. Ten istý
 * výpočet ako vyhodnotPoskodenie: súčty línie stoja, poškodenie sa ráta s klebetami.
 * Že priazeň ide, kým body stačia, odhad zanedbá — zvyšok víťaz minie najprv na iného
 * staršieho. Prehľadáva len starších, ktorých posun mení vstupy bitky.
 */
export function rozsahHadky(
  data: GameData,
  stol: StolHadky,
  sums: readonly [ActionSums, ActionSums],
  nerozdelena: NerozdelenaHadka,
  p: PlayerId,
): RozsahHadky | null {
  const n = nerozdelena.zostava;
  if (stol.ciel === null || nerozdelena.vitaz !== p || n <= 0) return null;
  const zaklad = stol.bitkaStav?.klebety ?? {};
  const sKlebetami = (k: Klebety): StolHadky => ({ ...stol, bitkaStav: { krok: "hadka", damage: null, caka: null, ...(stol.bitkaStav ?? {}), klebety: k } });
  const bitka = (k: Klebety): DamageResult => poskodenieBitky(data, sKlebetami(k), sums);
  const teraz = hodnota(battleOutcome(bitka(zaklad)), p);
  // Porovnáva sa vstup bitky, nie poškodenie: priazeň skrytá pod súperovou Vierou
  // (tuhé orezané na 0) poškodenie sama nezmení, s posunom iného staršieho však áno.
  const strany = (k: Klebety): string => JSON.stringify(stranyBitky(data, sKlebetami(k), sums));
  const zakladStrany = strany(zaklad);
  const smer = p === 0 ? -1 : 1;
  const sPosunom = (k: Klebety, e: ElderState, d: number): Klebety => {
    // Poloha priazne ide o d polí k p; klebety = marker − nová poloha (elders.ts posunHadkou).
    const na = polohaPriazne(e, k) + smer * d;
    return { ...k, [e.elderId]: e.marker - na };
  };
  const kandidati = stol.starsi
    .map((e) => {
      const z = polohaPriazne(e, zaklad);
      const max = Math.min(n, p === 0 ? z - MARKER_KRAJ[0] : MARKER_KRAJ[1] - z);
      const meni = Array.from({ length: max }, (_, i) => i + 1).some((d) => strany(sPosunom(zaklad, e, d)) !== zakladStrany);
      return { e, z, max, meni };
    })
    .filter((k) => k.meni);
  let najlepsia: RozsahHadky | null = null;
  let najlepsiaHodnota = teraz;
  const skus = (i: number, zostava: number, k: Klebety): void => {
    const kand = kandidati[i];
    if (kand === undefined) {
      const damage = bitka(k);
      const vysledok = battleOutcome(damage);
      const h = hodnota(vysledok, p);
      if (h > najlepsiaHodnota) {
        najlepsiaHodnota = h;
        najlepsia = { hrac: p, pocet: n, damage, vysledok };
      }
      return;
    }
    for (let d = 0; d <= kand.max; d++) {
      const cena = cenaPosunuOPoli(kand.z, smer * d);
      if (cena > zostava) break;
      skus(i + 1, zostava - cena, d === 0 ? k : sPosunom(k, kand.e, d));
    }
  };
  skus(0, n, zaklad);
  return najlepsia;
}

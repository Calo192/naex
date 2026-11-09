// Odhad špakov po kole (Michal 2026-11-06, mock Špaky na krajoch): čo hráči dostanú, keď bitka
// a hádka dopadnú ako teraz. Ráta sa z toho, čo klient vidí; pravidlá výplaty sú v engine
// (vyplatSpaky, bodovanie starších, exekucieBitky) a test ich porovnáva so skutočnou bitkou.
// Krádež pri zajatí v odhade nie je: rozhodne o nej víťaz až pri delení Nakladačky (krok 4e).

import { battleOutcome, spakyPriExekucii, type DamageResult, type RozhodnutieBitky } from "./battle.ts";
import { spakyOdStarsieho } from "./elders.ts";
import type { GameData } from "./data.ts";
import type { VerejnyStav } from "./effects.ts";
import { vysledokHadkyStola } from "./effects.ts";
import { jeFinale, kartyBitky, paleneDlhyVBitke, silaPriazne, spakyZaVyhru, verejneAbstaky, zahradkarChrani } from "./engine.ts";
import type { LineEval } from "./partia.ts";
import { KONSTANTY } from "./constants.ts";
import { opponentOf, type PlayerId } from "./types.ts";

export interface RozpisOdhadu {
  /** Karty v línii, sekera a Herňa víťazovi; porazenému Kultúrny dom. */
  readonly zaBitku: number;
  /** Nakladačka vo finále 1 : 1. */
  readonly nakladacka: number;
  /** Hádka vo finále 1 : 1. */
  readonly hadka: number;
  readonly starsi: number;
  /** Robota, ktorá nemá čo spáliť. */
  readonly robota: number;
  /** Špaky, ktoré vezme Exekútor (kladné číslo, od súčtu sa odčíta). */
  readonly exekutor: number;
  readonly spolu: number;
}

export interface OdhadSpakov {
  readonly vitaz: PlayerId | null;
  readonly rozhodlo: RozhodnutieBitky;
  readonly hraci: readonly [RozpisOdhadu, RozpisOdhadu];
  /** Špaky za karty, ktoré pri sekere čakajú na víťaza ďalšej bitky. */
  readonly naSekeru: number;
  /** Špaky, ktoré pri sekere vo finále prepadnú. */
  readonly prepadne: number;
  /** Spolu [hráč 0, hráč 1], keď bitku vyhrá ten druhý; pri sekere null. Vo finále bez Nakladačky, tá závisí od obratu. */
  readonly obrat: readonly [number, number] | null;
}

export type StavOdhadu = VerejnyStav & { readonly spakyNaSekere: number; readonly lokalitaOtocena: boolean };

/** Rozpis oboch hráčov, keď bitku vyhrá `vitaz` a Nakladačku má ako `nakladackaBodov`. */
function rozpisVysledku(data: GameData, s: StavOdhadu, linia: LineEval, makke: readonly [number, number], vitaz: PlayerId | null, nakladackaBodov: number): readonly [RozpisOdhadu, RozpisOdhadu] {
  const finale = jeFinale(s);
  const karty = kartyBitky(s);
  const palene = paleneDlhyVBitke(data, s, linia);
  const hd = vysledokHadkyStola(data, s, makke);
  const vitazHadky = hd.vitaz;
  const vyplata = vitaz === null ? null : spakyZaVyhru(s, vitaz, karty, vitazHadky);
  const rozpis = (p: PlayerId): RozpisOdhadu => {
    const vyhral = vitaz === p;
    // Pri sekere dostane víťaz hádky za svoje karty hneď (v11.11), línia čaká na sekere.
    const zaBitku = vyplata === null ? (vitazHadky === p ? karty.vlastne[p] : 0) : vyhral ? vyplata.spolu : vyplata.porazenemu;
    const nakladacka = finale && vyhral ? nakladackaBodov * KONSTANTY.SPAKY_ZA_NAKLADACKU_VO_FINALE : 0;
    const hadka = finale && hd.vitaz === p ? hd.velkost * KONSTANTY.SPAKY_ZA_HADKU_VO_FINALE : 0;
    const starsi = s.starsi.reduce((a, e) => a + spakyOdStarsieho(e, p, vyhral), 0);
    // Robota pred Exekútorom (§11): Exekútor už príde len k tomu, čo Robota nespálila.
    const dlhy = s.hraci[p].dlhy;
    const spalene = Math.min(palene[p], dlhy);
    const robota = palene[p] - spalene;
    const exekutor = zahradkarChrani(data, s, p) ? 0 : spakyPriExekucii(dlhy - spalene, silaPriazne(data, s, "ADVOKAT", p));
    return { zaBitku, nakladacka, hadka, starsi, robota, exekutor, spolu: zaBitku + nakladacka + hadka + starsi + robota - exekutor };
  };
  return [rozpis(0), rozpis(1)];
}

/** Odhad výplaty kola z línie a poškodenia, ktoré hráč práve vidí. */
export function odhadSpakovKola(data: GameData, s: StavOdhadu, linia: LineEval, damage: DamageResult): OdhadSpakov {
  const vysledok = battleOutcome(damage, { abstaky: [verejneAbstaky(s, 0), verejneAbstaky(s, 1)], dlhy: [s.hraci[0].dlhy, s.hraci[1].dlhy] });
  const makke: readonly [number, number] = [damage.makke[0], damage.makke[1]];
  const hraci = rozpisVysledku(data, s, linia, makke, vysledok.vitaz, vysledok.prebytokDrzi === vysledok.vitaz ? vysledok.prebytok : 0);
  const karty = kartyBitky(s).spolu;
  const sekera = vysledok.vitaz === null;
  const finale = jeFinale(s);
  const obrat = vysledok.vitaz === null ? null : rozpisVysledku(data, s, linia, makke, opponentOf(vysledok.vitaz), 0);
  return {
    vitaz: vysledok.vitaz,
    rozhodlo: vysledok.rozhodlo,
    hraci,
    naSekeru: sekera && !finale ? karty : 0,
    prepadne: sekera && finale ? karty + s.spakyNaSekere : 0,
    obrat: obrat === null ? null : [obrat[0].spolu, obrat[1].spolu],
  };
}

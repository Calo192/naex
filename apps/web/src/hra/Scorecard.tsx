// Texty k scorecardom staršieho: znamienko bodov a účinok priazne. Súboje podmienok
// (v5) sú v bodyPodmienok.tsx; scorecardy na stole kreslí LiniaStarsich.tsx (#69).

import type { Favour } from "@naex/core";
import { KONSTANTY } from "@naex/core";

/** „+4“, „−2“, „0“. */
export function znamienko(n: number): string {
  return n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0";
}


/** Čo priazeň danej sily (1 / 2 / 3) dáva — od v5 silou, bez dvojnásobku. PRAVIDLA §10. */
export const UCINOK_PRIAZNE: Readonly<Record<Favour, (sila: number) => string>> = {
  // Priazne v5 (Michal 2026-10-24/25): účinok = sila 1 / 2 / 3, bez dvojnásobku.
  UZERNIK: (s) => `Kmotor: po bitke prejde ${s === 1 ? "1 tvoj priznaný Dlh" : `${s} tvoje priznané Dlhy`} medzi súperove priznané.`,
  LAKOMEC: (s) => `Abstinent: v bitke +${s} ${s === 1 ? "Pohoršenie" : "Pohoršenia"}.`,
  NEPRAJNIK: (s) => `Výpalné: za každé súperovo NA EX ti zaplatí ${s} ${s === 1 ? "cigaretu" : "cigarety"}.`,
  BITKAR: (s) => `+${s} tuhého poškodenia v každej bitke.`,
  // Michal 2026-10-20: Viera navyše rovná sile — predtým vyššia hodnota každej Viery (dve Viery = štít 10).
  VERIACI: (s) => `+${s} ${s === 1 ? "Viera" : "Viery"} v každej bitke (ruší súperove Povery a uberá jeho tuhé poškodenie).`,
  // Michal 2026-10-19: cigarety platia šenok aj Dedičstvo — Fajčiar dáva silu, bez dvojnásobku.
  FAJCIAR: (s) => `+${s} ${s === 1 ? "cigareta" : "cigarety"} po výbere zo šenku (Obmedzenie ich neuberá).`,
  ALKOHOLIK: (s) => `Na zdravie: poldeci z ${s === 1 ? "jedného tvojho NA EX" : `${s} tvojich NA EX`} v kole sa ti po bitke vráti plný.`,
  EXEKUTOR: (s) => `Exekúcia súperovi zhorí navyše ${s} ${s === 1 ? "Dlh" : "Dlhy"} a toľko špakov.`,
};

/**
 * Účinok priazne krátko do riadku scorecardu v línii (Michal 2026-10-23: má byť
 * vidno vždy, aj keď priazeň nemá nikto — aby hráč videl, koho sa oplatí desiť).
 */
export const UCINOK_KRATKO: Readonly<Record<Favour, (sila: number) => string>> = {
  UZERNIK: (s) => `${s} Dlh súperovi po bitke`,
  LAKOMEC: (s) => `+${s} Pohoršenie v bitke`,
  NEPRAJNIK: (s) => `výpalné ${s} cig. za NA EX`,
  BITKAR: (s) => `+${s} tuhé v bitke`,
  VERIACI: (s) => `+${s} ${s === 1 ? "Viera" : "Viery"} v bitke`,
  FAJCIAR: (s) => `+${s} cig. po šenku`,
  ALKOHOLIK: (s) => `${s} NA EX do dna`,
  EXEKUTOR: (s) => `súperovi exekúcia +${s}`,
};


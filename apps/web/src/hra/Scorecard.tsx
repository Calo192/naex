// Texty k scorecardom staršieho: znamienko bodov, výpočet podmienky a účinok priazne.
// Scorecardy na stole kreslí LiniaStarsich.tsx (Michal 2026-10-23, #69).

import type { BodPodmienky, Favour } from "@naex/core";
import { KONSTANTY, urovenPodmienky } from "@naex/core";

/** „+4“, „−2“, „0“. */
export function znamienko(n: number): string {
  return n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0";
}

/** Výpočet jednej podmienky pre hráča: „2 starší × 2 = +4“. */
export function vypocetPodmienky(p: BodPodmienky, bodyZaKus: number): string {
  const kusy =
    urovenPodmienky(p.podmienka) !== null
      ? `${p.kusy} ${p.kusy === 1 ? "starší" : "starších"}`
      : `${p.kusy} ks`;
  return `${kusy} × ${bodyZaKus < 0 ? `−${-bodyZaKus}` : bodyZaKus} = ${znamienko(p.body)}`;
}

/**
 * Čo priazeň danej sily (1 / 2 / 3) dáva — bonus je NASOBOK_PRIAZNE × sila
 * (Michal 2026-10-16: dvojnásobný účinok). PRAVIDLA §9.
 */
export const UCINOK_PRIAZNE: Readonly<Record<Favour, (sila: number) => string>> = {
  // Michal 2026-10-20: Úžerník nahradil Zberateľa — prah Dlhu + sila (bez dvojnásobku).
  UZERNIK: (s) => `Prah Dlhu ${KONSTANTY.PRAH_DLHU_ZAKLAD + s} namiesto ${KONSTANTY.PRAH_DLHU_ZAKLAD} — Dlh dostaneš neskôr.`,
  // Michal 2026-10-18: Trocha a Zopár zmizli — Lakomec zlacní barter, Neprajník pustí Povery nad priznané Dlhy.
  LAKOMEC: (s) => `Stokársky barter (nový poldeci) za ${KONSTANTY.BARTER_CENA - s} cigariet namiesto ${KONSTANTY.BARTER_CENA}.`,
  NEPRAJNIK: (s) => `Tvoje Povery smú dať mäkké poškodenie o ${bonus(s)} viac, než má súper priznaných Dlhov.`,
  BITKAR: (s) => `+${bonus(s)} tuhého poškodenia v každej bitke.`,
  // Michal 2026-10-20: Viera navyše rovná sile — predtým vyššia hodnota každej Viery (dve Viery = štít 10).
  VERIACI: (s) => `+${s} ${s === 1 ? "Viera" : "Viery"} v každej bitke (ruší súperove Povery a uberá jeho tuhé poškodenie).`,
  // Michal 2026-10-19: cigarety platia šenok aj Dedičstvo — Fajčiar dáva silu, bez dvojnásobku.
  FAJCIAR: (s) => `+${s} ${s === 1 ? "cigareta" : "cigarety"} v prvej Pitke bitky o lokalitu.`,
  ALKOHOLIK: (s) => `Prah Cirhózy ${KONSTANTY.PRAH_CIRHOZY_ZAKLAD + bonus(s)} namiesto ${KONSTANTY.PRAH_CIRHOZY_ZAKLAD} — Cirhózu dostaneš neskôr.`,
  EXEKUTOR: (s) => `Prah Exekútora ${KONSTANTY.PRAH_EXEKUTORA_ZAKLAD + 2 * bonus(s)} namiesto ${KONSTANTY.PRAH_EXEKUTORA_ZAKLAD}.`,
};

/** Bonus priazne danej sily (Michal 2026-10-16: dvojnásobný účinok). */
function bonus(sila: number): number {
  return KONSTANTY.NASOBOK_PRIAZNE * sila;
}


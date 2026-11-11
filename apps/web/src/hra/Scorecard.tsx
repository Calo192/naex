// Texty k scorecardom staršieho: znamienko bodov a účinok priazne. Súboje podmienok
// (v5) sú v bodyPodmienok.tsx; scorecardy na stole kreslí LiniaStarsich.tsx (#69).

import type { Favour } from "@naex/core";
import { t } from "../i18n/jazyk.tsx";

/** „+4“, „−2“, „0“. */
export function znamienko(n: number): string {
  return n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0";
}


/** Čo priazeň danej sily (1 / 2 / 3) dáva — od v5 silou, bez dvojnásobku. PRAVIDLA §10. */
export const UCINOK_PRIAZNE: Readonly<Record<Favour, (sila: number) => string>> = {
  // Priazne v5 (Michal 2026-10-24/25): účinok = sila 1 / 2 / 3, bez dvojnásobku.
  // Priazne v9 (Michal 2026-10-30): Kmotor 2 / 3 / 4, Fajčiar po bitke, Advokát a Robota namiesto Exekútora a Výpalníka.
  UZERNIK: (s) => t("ucinok.uzernik", { n: s + 1 }),
  // Abstinent v10 (Michal 2026-11-01): Absťáky v bitke neškodia — predtým Pohoršenia navyše.
  LAKOMEC: (s) => t("ucinok.lakomec", { n: s }),
  ROBOTA: (s) => t("ucinok.robota", { n: s }),
  BITKAR: (s) => t("ucinok.bitkar", { n: s }),
  // Michal 2026-10-20: Viera navyše rovná sile — predtým vyššia hodnota každej Viery (dve Viery = štít 10).
  VERIACI: (s) => t("ucinok.veriaci", { n: s }),
  // Michal 2026-10-19: cigarety platia šenok aj Dedičstvo — Fajčiar dáva silu, bez dvojnásobku.
  FAJCIAR: (s) => t("ucinok.fajciar", { n: s }),
  // Michal 2026-11-06: Viera a Povery sa rušia, ako keby boli na akcii karty.
  OHOVARACKA: (s) => t("ucinok.ohovaracka", { n: s }),
  ADVOKAT: (s) => t("ucinok.advokat", { n: s }),
};

/**
 * Účinok priazne krátko do riadku scorecardu v línii (Michal 2026-10-23: má byť
 * vidno vždy, aj keď priazeň nemá nikto — aby hráč videl, koho sa oplatí desiť).
 */
export const UCINOK_KRATKO: Readonly<Record<Favour, (sila: number) => string>> = {
  UZERNIK: (s) => t("ucinokKratko.uzernik", { n: s + 1 }),
  LAKOMEC: (s) => t("ucinokKratko.lakomec", { n: s }),
  ROBOTA: (s) => t("ucinokKratko.robota", { n: s }),
  BITKAR: (s) => t("ucinokKratko.bitkar", { n: s }),
  VERIACI: (s) => t("ucinokKratko.veriaci", { n: s }),
  FAJCIAR: (s) => t("ucinokKratko.fajciar", { n: s }),
  OHOVARACKA: (s) => t("ucinokKratko.ohovaracka", { n: s }),
  ADVOKAT: (s) => t("ucinokKratko.advokat", { n: s }),
};


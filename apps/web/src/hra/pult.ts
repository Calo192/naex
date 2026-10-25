// Pult majstra Melichara v jednotnom bare (Michal 2026-10-25): kým je otvorený, nahradí
// obsah baru nad stolom; po zatvorení sa bar vráti. Rozhodnutia sú tu bez Reactu,
// nech sa dajú otestovať.

/** Pauza po vlastnej hláške — rovnakú stráži server (MELICHAR_PAUZA_MS). */
export const TICHO_MS = 2_000;

export type StavPauzy = "pripravene" | "moja" | "odpocet";

/** Vlastná hláška hrá, dohrala a beží pauza, alebo môže ísť ďalšia. */
export function stavPauzy(moja: { readonly koniec: number } | null, teraz: number): StavPauzy {
  if (moja === null || teraz >= moja.koniec + TICHO_MS) return "pripravene";
  return teraz < moja.koniec ? "moja" : "odpocet";
}

/** Koľko ms ešte treba počkať na ďalšiu vlastnú hlášku. */
export const zostavaPauzy = (moja: { readonly koniec: number } | null, teraz: number): number =>
  moja === null ? 0 : Math.max(0, moja.koniec + TICHO_MS - teraz);

/**
 * Tlačidlo či kláves M. Melichar vo výučbe, v nápovede či pri pečiatke momentu má
 * prednosť: kým hovorí, pult sa neotvorí („pocka“ — tlačidlo sa len zatrasie),
 * a otvorený pult mu ustúpi a po jeho dohovorení sa vráti.
 */
export function prepniPult(otvorene: boolean, melicharHovori: boolean): "otvor" | "zavri" | "pocka" {
  if (otvorene) return "zavri";
  return melicharHovori ? "pocka" : "otvor";
}

/** Pult je v bare, len keď je otvorený a Melichar práve nehovorí. */
export const pultVBare = (otvorene: boolean, melicharHovori: boolean): boolean => otvorene && !melicharHovori;

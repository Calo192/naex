// Register efektov kariet (M10 ho naplní).
//
// Zásada z BRIEF-u: neimplementovaný efekt nesmie blokovať hru — karty bez
// implementácie bežia v režime MANUAL: motor ich v správnej fáze vypíše do
// logu a hráči ich vyhodnotia sami.

/** Karty, ktorých efekt je zabudovaný priamo v motore (nie MANUAL). */
const NATIVNE: ReadonlySet<string> = new Set([
  "dlh", // „Skontroluj, či pred dverami nestojí exekútor“ — krok Exekútora
  "cirhoza", // „Obdržíš od súpera dodatočnú ranu“ — cirhozaBonus v bitke
  "kocovnik", // „Môže nastúpiť do súperovej partie“ — povolenie vykladania
]);

/** Karty, ktoré smú nastúpiť do súperovej partie. */
const DO_SUPEROVEJ: ReadonlySet<string> = new Set(["kocovnik"]);

export function mozeDoSuperovejPartie(defId: string): boolean {
  return DO_SUPEROVEJ.has(defId);
}

export function jeEfektManual(defId: string): boolean {
  return !NATIVNE.has(defId);
}

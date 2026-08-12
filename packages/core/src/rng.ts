// Deterministická náhoda — mulberry32.
//
// Jediný zdroj náhody v celej hre. Stav generátora žije v GameState a každé
// použitie vracia NOVÝ stav (žiadna mutácia) — rovnaké semienko + rovnaké
// príkazy = rovnaká hra, čo je podmienka reprodukovania chýb aj replayov.

export type RngState = number;

export function rngSeed(seed: number): RngState {
  // >>> 0 normalizuje na uint32, aby bol stav vždy rovnaký typ hodnoty.
  return seed >>> 0;
}

/** Vráti [náhodné číslo z [0,1), nový stav]. */
export function rngNext(state: RngState): [number, RngState] {
  let t = (state + 0x6d2b79f5) >>> 0;
  const next = t;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return [value, next];
}

/** Celé číslo z [0, n). */
export function rngInt(state: RngState, n: number): [number, RngState] {
  const [value, next] = rngNext(state);
  return [Math.floor(value * n), next];
}

/** Fisher–Yates — vráti nové pole, vstup nemení. */
export function rngShuffle<T>(state: RngState, items: readonly T[]): [T[], RngState] {
  const result = [...items];
  let s = state;
  for (let i = result.length - 1; i > 0; i--) {
    const [j, next] = rngInt(s, i + 1);
    s = next;
    const a = result[i] as T;
    result[i] = result[j] as T;
    result[j] = a;
  }
  return [result, s];
}

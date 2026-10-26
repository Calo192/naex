// Frajerina — hodnotenie hráča podľa vzoru šachového Elo.
//
// Očakávaný výsledok hráča A proti B je E = 1 / (1 + 10^((B − A) / 400)).
// Po partii sa hodnota zmení o K · (skutočný − očakávaný). Súčet zmien je
// nulový: koľko jeden získa, toľko druhý stratí. Rovný proti rovnému tak ide
// o ±16; keď favorit s náskokom 400 porazí slabšieho, posunú sa obaja len
// o 3 body, ale prekvapenie (slabší vyhrá) stojí favorita 29.

export const FRAJERINA_START = 1200;
const K = 32;
/** Pod túto hodnotu Frajerina neklesne — nech sa dá vždy vyhrabať späť. */
const MINIMUM = 100;
/** Kým hráč neodohrá toľko partií, hodnotenie je provizórne (ako „1200?“ v šachu). */
export const PROVIZORNE_PARTIE = 5;

export type Vysledok = "vyhra" | "prehra" | "remiza";

export function ocakavanyVysledok(ja: number, super_: number): number {
  return 1 / (1 + 10 ** ((super_ - ja) / 400));
}

/** Nové hodnoty oboch hráčov; `vitaz` null = remíza. */
export function novaFrajerina(f: readonly [number, number], vitaz: 0 | 1 | null): [number, number] {
  const skutocny = vitaz === null ? 0.5 : vitaz === 0 ? 1 : 0;
  const zmena = Math.round(K * (skutocny - ocakavanyVysledok(f[0], f[1])));
  // Minimum môže súčet narušiť len pri úplne dole; inak je hra s nulovým súčtom.
  return [Math.max(MINIMUM, f[0] + zmena), Math.max(MINIMUM, f[1] - zmena)];
}

/** Hodnosti podľa Frajeriny — obdoba šachových titulov. */
const TITULY: readonly { readonly od: number; readonly nazov: string }[] = [
  { od: 0, nazov: "Abstinent" },
  { od: 950, nazov: "Zelenáč" },
  { od: 1100, nazov: "Návštevník" },
  { od: 1300, nazov: "Štamgast" },
  { od: 1450, nazov: "Frajer" },
  { od: 1600, nazov: "Veľký frajer" },
  { od: 1800, nazov: "Postrach dediny" },
  { od: 2000, nazov: "Kráľ krčmy" },
];

export function titul(hodnota: number): string {
  let out = TITULY[0]?.nazov ?? "";
  for (const t of TITULY) if (hodnota >= t.od) out = t.nazov;
  return out;
}

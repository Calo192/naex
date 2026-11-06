// Tvary počítaných slov v rozhraní. Motor má na hlášky vlastné pocet() v @naex/core
// (akuzatív aj s číslom); tu je len tvar slova a záporné číslo sa skloňuje ako kladné.

/** Slovenské tvary: 1 partia, 2–4 partie, 5 partií. */
export function tvar(n: number, jeden: string, dva: string, pat: string): string {
  const a = Math.abs(n);
  return a === 1 ? jeden : a >= 2 && a <= 4 ? dva : pat;
}

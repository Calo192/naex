// Tvary počítaných slov v hláškach motora (akuzatív): 1 cigaretu, 2–4 cigarety,
// 0 a 5+ cigariet. Predtým mali hlášky pevný tvar — „1 cigariet“, „0 karty“.

export function pocet(n: number, jeden: string, dvaAzStyri: string, inak: string): string {
  return `${n} ${n === 1 ? jeden : n >= 2 && n <= 4 ? dvaAzStyri : inak}`;
}

export const cigariet = (n: number): string => pocet(n, "cigaretu", "cigarety", "cigariet");
export const kariet = (n: number): string => pocet(n, "kartu", "karty", "kariet");

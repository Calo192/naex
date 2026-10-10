// Farebný model z MAUI (CategoryColorStore): pastel daný len odtieňom,
// so stálou sýtosťou a jasom, aby biely titulok bol vždy čitateľný.

import type { Kategoria, KartaNavrh } from "./typy.ts";

const SYTOST = 0.42;
const JAS = 0.72;

/** Záložná farba, keď žiadny tag karty nemá zapnutú kategóriu. */
export const SIVA = "#4b5563";

export function pastelHex(odtien: number): string {
  const h = (((odtien % 360) + 360) % 360) / 60;
  const c = JAS * SYTOST;
  const x = c * (1 - Math.abs((h % 2) - 1));
  const m = JAS - c;
  const [r, g, b] =
    h < 1 ? [c, x, 0] : h < 2 ? [x, c, 0] : h < 3 ? [0, c, x] : h < 4 ? [0, x, c] : h < 5 ? [x, 0, c] : [c, 0, x];
  const hex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, "0");
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

/** Odtieň (0–360) z hex farby — na predvyplnenie výberu farby. */
export function odtienZHex(hex: string): number {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (m === null) return 0;
  const [r, g, b] = [m[1], m[2], m[3]].map((v) => parseInt(v ?? "0", 16) / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  if (d === 0) return 0;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return Math.round(((h * 60) + 360) % 360);
}

/** Farba karty: vlastná, inak prvý tag so zapnutou kategóriou, inak sivá. */
export function farbaKarty(k: Pick<KartaNavrh, "farba" | "tagy">, kategorie: readonly Kategoria[]): string {
  if (k.farba !== null) return k.farba;
  for (const tag of k.tagy) {
    const kat = kategorie.find((c) => c.zapnuta && c.nazov.toLocaleLowerCase("sk") === tag.toLocaleLowerCase("sk"));
    if (kat !== undefined) return pastelHex(kat.odtien);
  }
  return SIVA;
}

/**
 * Rozdelí odtiene kategórií čo najrovnomernejšie po kruhu (MAUI „redistribute
 * colours“) — poradie kategórií ostáva, menia sa len odtiene zapnutých.
 */
export function rozlozOdtiene(kategorie: readonly Kategoria[]): Kategoria[] {
  const zapnute = kategorie.filter((k) => k.zapnuta);
  const krok = zapnute.length === 0 ? 0 : 360 / zapnute.length;
  let i = 0;
  return kategorie.map((k) => (k.zapnuta ? { ...k, odtien: Math.round((i++ * krok) % 360) } : k));
}

// Rozloženie ponuky patronátu (#110) — bez DOM, aby sa dalo otestovať.

/** Pomer výšky a šírky karty — ten istý ako na stole (HernaPlocha). */
const POMER_KARTY = 80 / 54;
/** Šírka textu vedľa karty; pod ňou je karta pri úzkom stole menšia, než keby bol text pod kartou. */
const SIRKA_TEXTU = 200;
/** Výška textu pod kartou, keď sa vedľa nezmestí. */
const VYSKA_TEXTU_POD = 78;
const HLAVA = 30;
/** Pod touto šírkou by akcie na karte neboli čitateľné; nad tou by karta zbytočne zaberala stôl. */
const MIN_SIRKA = 64;
const MAX_SIRKA = 220;
const MEDZERA = 14;

/**
 * Šírka kariet v ponuke s `n` možnosťami na ploche w × h: čo najväčšia, text vedľa
 * karty alebo pod ňou — podľa toho, kde vyjde väčšia; nikdy pod čitateľnú hranicu.
 */
export function rozlozeniePonuky(w: number, h: number, n: number): { readonly sirka: number; readonly textPod: boolean; readonly naStlpec: number } {
  const pocet = Math.max(1, n);
  const naStlpec = Math.max(0, (w - MEDZERA * (pocet - 1)) / pocet);
  const vyska = Math.max(0, h - HLAVA);
  const vedla = Math.min(vyska / POMER_KARTY, naStlpec - SIRKA_TEXTU - 10);
  const pod = Math.min((vyska - VYSKA_TEXTU_POD) / POMER_KARTY, naStlpec);
  const textPod = pod > vedla + 8;
  const sirka = h <= 0 ? 0 : Math.floor(Math.min(MAX_SIRKA, Math.max(MIN_SIRKA, textPod ? pod : vedla)));
  return { sirka, textPod, naStlpec };
}

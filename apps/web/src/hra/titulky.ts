// Titulky hlášok majstra Melichara (lokalizácia, Michal 2026-11-10) — bez Reactu, nech sa dajú
// otestovať. Kto hlášku prehrá (Melichar v partii, neskôr výučba a soundboard), zavolá
// ukazTitulok a pri konci skryTitulok; kreslí ich TitulokMelichara.tsx.

export type Titulky = Readonly<Record<string, unknown>>;

/** Kľúč titulku hlášky — skupina a meno súboru („pohoda/a_smeje_sa“); staré zoznamy bez mena ho nemajú. */
export function klucTitulku(h: { readonly skupina?: string; readonly meno?: string }): string | null {
  return h.skupina === undefined || h.meno === undefined ? null : `${h.skupina}/${h.meno}`;
}

/** Text titulku; chýbajúci súbor (slovenčina) či prázdny text = žiadny titulok. */
export function textTitulku(titulky: Titulky | null, kluc: string | null): string | null {
  if (titulky === null || kluc === null || kluc.startsWith("_")) return null;
  const v = titulky[kluc];
  return typeof v === "string" && v.trim() !== "" ? v : null;
}

let prave: string | null = null;
const odberatelia = new Set<() => void>();
const oznam = (): void => {
  for (const o of odberatelia) o();
};

/** Hláška začala znieť — titulok sa ukáže, kým ju niekto neskryje. */
export function ukazTitulok(h: { readonly skupina?: string; readonly meno?: string }): void {
  prave = klucTitulku(h);
  oznam();
}

export function skryTitulok(): void {
  if (prave === null) return;
  prave = null;
  oznam();
}

export const praveZnie = (): string | null => prave;

export function odoberTitulky(o: () => void): () => void {
  odberatelia.add(o);
  return () => odberatelia.delete(o);
}

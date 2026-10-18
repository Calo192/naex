// Štýl ilustrácií NA EX! pre generovanie v Leonardo.Ai (API, tools/admin/leonardo.ts).
// Opis štýlu je v tools/admin/styl.md; tu je štýlový chvost promptu
// a referenčné ilustrácie podľa kategórie karty.

import { resolve } from "node:path";

/** Model, ktorým vznikla celá tlačová sada (názvy zdrojových súborov). */
export const MODEL = "Nano Banana (Gemini 2.5 Flash Image)";

/** Štýlový chvost promptu — opis súčasných ilustrácií. */
export const STYL =
  "Gritty adult comic book illustration matching the reference images: bold black ink outlines, hand-drawn linework, " +
  "cross-hatching and grainy texture in the shadows, muted dirty palette of browns, olive, slate blue and grey with one warm " +
  "accent light, slightly grotesque caricatured expressive faces with realistic proportions, run-down post-socialist " +
  "Slovak village atmosphere with cluttered worn details. Square composition, main subject centered. " +
  "No text, no letters, no logos, no watermark, no frame, no border.";

export const REFERENCIE: Readonly<Record<string, readonly string[]>> = {
  obcan: ["svokra", "pijan", "hasic"],
  staresina: ["krcmarka", "veterinar", "autobusar"],
  lokalita: ["benzinka", "krcma", "zastavka"],
  naradie: ["puska", "vinko", "vyherny_automat"],
  zviera: ["cierna_macka", "pes"],
  kliatba: ["dlh", "cirhoza", "abstak"],
};

/** Kategória podľa tagov karty (druh karty). */
export function kategoriaPodlaTagov(tagy: readonly string[]): string | null {
  if (tagy.includes("Lokalita")) return "lokalita";
  if (tagy.includes("Kliatba")) return "kliatba";
  if (tagy.includes("Starešina")) return "staresina";
  if (tagy.includes("Nástroj")) return "naradie";
  if (tagy.includes("Zviera")) return "zviera";
  if (tagy.includes("Občan")) return "obcan";
  return null;
}

export function zostavPrompt(namet: string): string {
  return `${namet.trim().replace(/\.$/, "")}. ${STYL}`;
}

export function cestyReferencii(kategoria: string): string[] {
  return (REFERENCIE[kategoria] ?? []).map((id) => resolve("packages/server/seed/karty", `${id}.jpg`));
}

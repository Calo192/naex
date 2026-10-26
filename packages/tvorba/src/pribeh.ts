// Príbeh a účel karty (Michal 2026-10-26): texty pre hráča, ktoré ukazuje len
// stránka Pravidlá › Karty — nie hra ani výučba. Jadro ich nečíta. Prázdny text
// sa neukladá, takže karta bez textov má v JSON rovnaký tvar ako pred ich zavedením.

import type { KartaNavrh } from "./typy.ts";

export type TextKarty = "pribeh" | "ucel";

/** Najdlhší príbeh či účel, ktorý server prijme. */
export const MAX_TEXTU_KARTY = 4000;

/** Polia s textami pre hráča; prázdne a chýbajúce vynechá. */
export function textyKarty(pribeh: string | undefined, ucel: string | undefined): { pribeh?: string; ucel?: string } {
  return {
    ...(pribeh === undefined || pribeh.trim() === "" ? {} : { pribeh }),
    ...(ucel === undefined || ucel.trim() === "" ? {} : { ucel }),
  };
}

/**
 * Karta s novým príbehom alebo účelom. Texty idú na koniec objektu v rovnakom
 * poradí ako zo servera — tvorca porovnáva návrhy cez JSON.
 */
export function sTextomKarty(k: KartaNavrh, pole: TextKarty, text: string): KartaNavrh {
  const { pribeh, ucel, ...zvysok } = k;
  return pole === "pribeh" ? { ...zvysok, ...textyKarty(text, ucel) } : { ...zvysok, ...textyKarty(pribeh, text) };
}

export type BlokTextu =
  | { readonly typ: "odstavec"; readonly riadky: readonly string[] }
  | { readonly typ: "odrazky"; readonly polozky: readonly string[] };

const ODRAZKA = /^\s*[-–•*]\s+/;

/**
 * Text z tvorcu na odseky a odrážky: prázdny riadok oddeľuje odseky, riadok
 * začatý „- “ (aj „•“, „*“, „–“) je odrážka, odsadený riadok pod odrážkou ju
 * dopĺňa. Ostatné zalomenia ostávajú, ako ich autor napísal.
 */
export function blokyTextu(text: string): BlokTextu[] {
  const bloky: BlokTextu[] = [];
  let odstavec: string[] | null = null;
  let odrazky: string[] | null = null;
  const uzavri = (): void => {
    if (odstavec !== null) bloky.push({ typ: "odstavec", riadky: odstavec });
    if (odrazky !== null) bloky.push({ typ: "odrazky", polozky: odrazky });
    odstavec = null;
    odrazky = null;
  };
  for (const surovy of text.replace(/\r\n?/g, "\n").split("\n")) {
    const riadok = surovy.trimEnd();
    if (riadok.trim() === "") {
      uzavri();
      continue;
    }
    if (ODRAZKA.test(riadok)) {
      if (odrazky === null) uzavri();
      odrazky ??= [];
      odrazky.push(riadok.replace(ODRAZKA, ""));
      continue;
    }
    if (odrazky !== null && /^\s/.test(riadok)) {
      odrazky[odrazky.length - 1] = `${odrazky[odrazky.length - 1] ?? ""} ${riadok.trim()}`;
      continue;
    }
    if (odstavec === null) uzavri();
    odstavec ??= [];
    odstavec.push(riadok.trim());
  }
  uzavri();
  return bloky;
}

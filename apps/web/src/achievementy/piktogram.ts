// Piktogram achievementu (tvar od New features): „akcia:<Akcia>“ = vstavaná ikona akcie,
// „podmienka:<typ>“ = nahratá ikona bodovania zo sady s tým významom, null = bez piktogramu.

import type { IkonaBodovania } from "@naex/tvorba";
import { mediaUrl } from "../lib/api.ts";

export interface PiktogramPodtacka {
  readonly ikona: string | null;
  readonly obrazok: string | null;
}

export function piktogramPodtacka(piktogram: string | null, ikonyBodovania: readonly IkonaBodovania[]): PiktogramPodtacka {
  if (piktogram === null) return { ikona: null, obrazok: null };
  if (piktogram.startsWith("podmienka:")) {
    const typ = piktogram.slice("podmienka:".length);
    const ikona = ikonyBodovania.find((i) => i.podmienka === typ);
    return { ikona: null, obrazok: ikona === undefined ? null : mediaUrl(ikona.media, true) };
  }
  return { ikona: piktogram, obrazok: null };
}

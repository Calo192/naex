// Prevod achievementov zo servera (tvar od New features, useHra.ts a GET /api/achievementy)
// na podtácky: rank 1–3 = bronz, striebro, zlato (Michal 2026-10-23: hviezdy podľa ranku),
// piktogram „akcia:“ / „podmienka:“ na ikonu alebo obrázok zo sady.

import type { IkonaBodovania } from "@naex/tvorba";
import type { AchievementPreKlienta } from "../hra/useHra.ts";
import type { RankPodtacka } from "./Podtacok.tsx";
import { piktogramPodtacka } from "./piktogram.ts";
import type { KategoriaVitriny, PolozkaVitriny } from "./Vitrina.tsx";

const RANKY: readonly RankPodtacka[] = ["bronz", "striebro", "zlato"];

/** Rank zo servera (1 – 3) na farbu podtácku; mimo rozsahu najbližší. */
export const rankPodtacka = (rank: number): RankPodtacka => RANKY[Math.min(RANKY.length, Math.max(1, rank)) - 1] ?? "bronz";

/** Vzácnosť ranku do textu („vzácne“) — bežné sa nepíšu. */
const VZACNOST: Readonly<Record<string, string>> = { nezvycajne: "nezvyčajné", vzacne: "vzácne", legendarne: "legendárne" };
export const textVzacnosti = (a: AchievementPreKlienta, rank: number): string | null => VZACNOST[a.zriedkavost[rank - 1] ?? ""] ?? null;

/** Položka vitríny zo servera (packages/server/src/achievementy.ts, PolozkaVitriny). */
export interface PolozkaVitrinyApi extends AchievementPreKlienta {
  /** 0 = nemá. */
  readonly rank: number;
  readonly prahy: readonly number[];
  /** Len kariérne: kde hráč je (séria: najdlhšia a aktuálna). */
  readonly postup: { readonly hodnota: number; readonly aktualna: number | null } | null;
  readonly ziskane: readonly { readonly rank: number; readonly ziskane: number; readonly partia: number | null }[];
}

export interface VitrinaApi {
  readonly kategorie: readonly KategoriaVitriny[];
  readonly achievementy: readonly PolozkaVitrinyApi[];
}

export function polozkaVitriny(a: PolozkaVitrinyApi, ikony: readonly IkonaBodovania[]): PolozkaVitriny {
  const ziskany = a.rank > 0;
  // Ďalší rank, na ktorý sa dá ísť (pri plnom zlate už žiadny).
  const dalsi = a.rank < a.rankov ? a.rank + 1 : null;
  const prah = dalsi === null ? undefined : a.prahy[dalsi - 1];
  const najvyssi = a.ziskane.filter((z) => z.rank === a.rank).reduce<number | null>((m, z) => (m === null || z.ziskane < m ? z.ziskane : m), null);
  return {
    id: a.id,
    nazov: a.nazov,
    popis: a.popis,
    kategoria: a.kategoria ?? "",
    tajny: a.tajny,
    ...piktogramPodtacka(a.piktogram, ikony),
    rank: ziskany ? rankPodtacka(a.rank) : null,
    rankCiela: rankPodtacka(dalsi ?? a.rank),
    ziskane: ziskany ? najvyssi : null,
    postup: a.postup === null || prah === undefined ? null : { hodnota: a.postup.hodnota, prah, aktualna: a.postup.aktualna },
    vzacnost: ziskany ? textVzacnosti(a, a.rank) : null,
  };
}

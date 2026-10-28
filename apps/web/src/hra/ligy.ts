// Ligy v lobby (Michal 2026-10-28): ktorú ligu hráč smie, čo ho delí od
// zamknutej a ktorá sa má predvoliť. Stav posiela server (/api/hry/otvorene,
// server/ligy.ts) a pri založení aj pripojení ho overí sám — tu sa len kreslí.

import type { DlzkaHry } from "@naex/core";
import { ALL_DLZKY } from "@naex/core";

/** Prečo hráč ligu smie: odomkol ju sám, smú ju všetci, smie vždy (správca, AI), alebo nesmie. */
export type PristupKLige = "odomknuta" | "vsetci" | "vzdy" | "zamknuta";

export interface StavLigy {
  readonly liga: DlzkaHry;
  readonly smie: boolean;
  /** Chýba pri starom serveri. */
  readonly pristup?: PristupKLige;
  /** Čo treba splniť, aj s postupom výhier („… proti človeku (máš 0/1).“). */
  readonly podmienka: string | null;
  readonly postup: { readonly ma: number; readonly treba: number } | null;
  /** Výhry proti ľuďom v lige. */
  readonly vyhry?: number;
}

/** Smie hráč ligu? Bez stavu (starý server, ešte nenačítané) áno — server aj tak overí. */
export function smieLigu(ligy: readonly StavLigy[] | null, liga: DlzkaHry): boolean {
  return ligy?.find((l) => l.liga === liga)?.smie ?? true;
}

/** Text zámku — podmienka s postupom od servera; null, keď liga nie je zamknutá. */
export function popisZamku(ligy: readonly StavLigy[] | null, liga: DlzkaHry): string | null {
  const s = ligy?.find((l) => l.liga === liga);
  if (s === undefined || s.smie) return null;
  return s.podmienka ?? "Túto ligu ti zatiaľ nepustili.";
}

/** Riadok ligy v profile: stav a čo chýba (Michal 2026-10-28). */
export function stavLigyVProfile(s: StavLigy): { readonly stav: string; readonly detail: string | null } {
  const pristup = s.pristup ?? (s.smie ? "odomknuta" : "zamknuta");
  const stav = { odomknuta: "odomknutá", vsetci: "zatiaľ voľná pre všetkých", vzdy: "voľná vždy", zamknuta: "zamknutá" }[pristup];
  // Kým smú všetci, podmienka ukazuje, čo bude treba, až ju admin zapne.
  const detail = s.podmienka === null ? null : pristup === "vsetci" ? `Na odomknutie: ${s.podmienka}` : pristup === "zamknuta" ? s.podmienka : null;
  return { stav, detail };
}

/**
 * Dá sa liga zvoliť? Zamknutá áno, len keď obmedzenie neplatí pre partie proti
 * počítaču — potom s ňou ide len „Hrať proti počítaču“.
 */
export function volitelnaLiga(ligy: readonly StavLigy[] | null, ajProtiPocitacu: boolean, liga: DlzkaHry): boolean {
  return smieLigu(ligy, liga) || !ajProtiPocitacu;
}

/**
 * Liga, ktorá má byť zvolená: doterajšia, ak sa dá zvoliť a sada ju má; inak
 * najvyššia, ktorú hráč smie (nový hráč tak nezačne na zamknutej Druhej lige).
 */
export function zvolenaLiga(ligy: readonly StavLigy[] | null, ajProtiPocitacu: boolean, dostupne: readonly DlzkaHry[], doterajsia: DlzkaHry): DlzkaHry {
  if (dostupne.includes(doterajsia) && volitelnaLiga(ligy, ajProtiPocitacu, doterajsia)) return doterajsia;
  const ide = (d: DlzkaHry): boolean => dostupne.includes(d) && smieLigu(ligy, d);
  return [...ALL_DLZKY].reverse().find(ide) ?? doterajsia;
}

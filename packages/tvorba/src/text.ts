// Formátovanie textu efektu podľa kľúčových slov (MAUI KeywordStore +
// CardPdfService.BuildStyledWords): slovo sa porovná bez interpunkcie
// a bez ohľadu na veľkosť písmen so slovom pravidla alebo jeho tvarmi.

import type { KlucoveSlovo } from "./typy.ts";

export interface Usek {
  readonly text: string;
  readonly tucne: boolean;
  readonly kurziva: boolean;
  /** Pravidlo, ktoré úsek naformátovalo (pre tooltip s popisom). */
  readonly pravidlo: KlucoveSlovo | null;
}

/** Riadok textu efektu; riadky oddeľujú slová s novyRiadok. */
export type Riadok = readonly Usek[];

function normalizuj(slovo: string): string {
  return slovo.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "").toLocaleLowerCase("sk");
}

export function mapaPravidiel(pravidla: readonly KlucoveSlovo[]): Map<string, KlucoveSlovo> {
  const mapa = new Map<string, KlucoveSlovo>();
  for (const p of pravidla) {
    for (const tvar of [p.slovo, ...p.tvary]) {
      const k = normalizuj(tvar);
      if (k !== "" && !mapa.has(k)) mapa.set(k, p);
    }
  }
  return mapa;
}

/**
 * Rozdelí text na riadky naformátovaných úsekov. Medzery sa zachovajú
 * v bežných úsekoch, takže spojením textov vznikne pôvodný text.
 */
export function formatujEfekt(text: string, pravidla: readonly KlucoveSlovo[]): Riadok[] {
  const mapa = mapaPravidiel(pravidla);
  const riadky: Usek[][] = [[]];
  const pridaj = (u: Usek): void => {
    const riadok = riadky[riadky.length - 1] as Usek[];
    const posledny = riadok[riadok.length - 1];
    // Bežný text sa zlučuje, aby DOM nebol zbytočne rozdrobený.
    if (posledny !== undefined && posledny.pravidlo === null && u.pravidlo === null) {
      riadok[riadok.length - 1] = { ...posledny, text: posledny.text + u.text };
    } else {
      riadok.push(u);
    }
  };

  for (const kus of text.split(/(\s+)/)) {
    if (kus === "") continue;
    if (/^\s+$/.test(kus)) {
      pridaj({ text: kus, tucne: false, kurziva: false, pravidlo: null });
      continue;
    }
    const pravidlo = mapa.get(normalizuj(kus)) ?? null;
    if (pravidlo === null || (!pravidlo.tucne && !pravidlo.kurziva && !pravidlo.novyRiadok && pravidlo.popis === "")) {
      pridaj({ text: kus, tucne: false, kurziva: false, pravidlo: null });
      continue;
    }
    const aktualny = riadky[riadky.length - 1] as Usek[];
    const maObsah = aktualny.some((u) => u.text.trim() !== "");
    if (pravidlo.novyRiadok && maObsah) {
      // Medzera pred zalomením nemá význam.
      const posledny = aktualny[aktualny.length - 1];
      if (posledny !== undefined && posledny.pravidlo === null) {
        const orezany = posledny.text.replace(/\s+$/, "");
        if (orezany === "") aktualny.pop();
        else aktualny[aktualny.length - 1] = { ...posledny, text: orezany };
      }
      riadky.push([]);
    }
    pridaj({ text: kus, tucne: pravidlo.tucne, kurziva: pravidlo.kurziva, pravidlo });
  }
  return riadky.filter((r) => r.length > 0);
}

/**
 * Predpona Kšeftu väzňa (v9, Michal 2026-10-30): „Väzeň — Kšeft:“ je jeden spúšťač
 * Väzeň — jadro tak odlíši efekt staršieho od Kšeftu karty v línii. Pomlčka smie byť
 * dlhá, krátka aj spojovník.
 */
const PREDPONA_VAZNA = /(^|[\s.!?])Väzeň\s*[—–-]\s*Kšeft:/gu;

/** Text, v ktorom je „Väzeň — Kšeft:“ zapísané ako spúšťač „Väzeň:“ (pre spustaceVTexte a kontrolu textov). */
export function sPredponouVazna(text: string): string {
  return text.replace(PREDPONA_VAZNA, "$1Väzeň:");
}

/** Spúšťače efektov nájdené v texte (slovo s dvojbodkou), v poradí výskytu. */
export function spustaceVTexte(povodny: string, spustace: readonly string[]): string[] {
  const text = sPredponouVazna(povodny);
  const out: string[] = [];
  for (const s of spustace) {
    const re = new RegExp(`(^|[\\s.!?])${s}:`, "u");
    if (re.test(text) && !out.includes(s)) out.push(s);
  }
  return out.sort((a, b) => text.indexOf(`${a}:`) - text.indexOf(`${b}:`));
}

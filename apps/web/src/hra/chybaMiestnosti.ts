// Chyba zo servera pri vstupe do miestnosti — kedy ju ukázať hráčovi.
//
// Po načítaní stránky sa klient sám vracia do miestnosti z localStorage. Po
// reštarte servera (nasadenie) tá miestnosť neexistuje a hláška „Miestnosť
// s týmto kódom neexistuje.“ by v lobby svietila, hoci hráč žiadny kód
// nezadal (Michal 2026-10-26).

export type ReakciaNaChybu =
  /** Hráč sedel pri stole a partia zanikla — späť do lobby s vysvetlením. */
  | { readonly druh: "zanikla" }
  /** Uložený kód zabudnúť; hlášku ukázať len vtedy, keď kód zadal hráč. */
  | { readonly druh: "zabudni"; readonly ukaz: boolean }
  | { readonly druh: "ukaz" };

export const TEXT_ZANIKLEJ_PARTIE = "Partia sa stratila — server sa medzitým reštartoval. Založ novú hru.";

export function reakciaNaChybu(
  text: string,
  kontext: {
    /** Klient má miestnosť (sedí pri stole alebo čaká na súpera). */
    readonly priStole: boolean;
    /** Chyba odpovedá na automatický návrat (rejoin po pripojení), nie na kód od hráča. */
    readonly automatickyNavrat: boolean;
  },
): ReakciaNaChybu {
  if (kontext.priStole) return /neexistuje|Nie si v miestnosti/.test(text) ? { druh: "zanikla" } : { druh: "ukaz" };
  if (/neexistuje|nehráš|plná/.test(text)) return { druh: "zabudni", ukaz: !kontext.automatickyNavrat };
  return { druh: "ukaz" };
}

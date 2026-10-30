// Pravítko posunu pri rozdeľovaní (mock 2 B, Michal 2026-10-30): playtesteri čakali, že
// porazený volí aj počet polí. Pravítko ukáže, že marker ide pole po poli, kým body stačia —
// dielik = pole, do ktorého marker vojde (šírka = cena, farba = zóna), a prvé pole, na ktoré
// už nestačí, je za čiarou rozpočtu so zámkom. Ráta to isté ako posunZaBody v jadre.

import { STUPNICA_ZONY, cenaKroku, posunMarker, type MarkerPos, type PlayerId } from "@naex/core";

/** Pole na ceste markera: kam vojde, v akej zóne a za koľko. */
export interface DielikPravitka {
  readonly na: MarkerPos;
  readonly zona: number;
  readonly cena: number;
  /** Prvé pole, na ktoré zvyšok už nestačí — za ním sa pravítko končí. */
  readonly zamok: boolean;
}

export interface Pravitko {
  /** Body, ktoré posun má (zvyšok Nakladačky či Pohoršení pre tohto staršieho). */
  readonly body: number;
  readonly dieliky: readonly DielikPravitka[];
  /** Koľko posun naozaj stojí a o koľko polí marker pôjde. */
  readonly cena: number;
  readonly polia: number;
}

/** Cesta markera z `marker` k hráčovi `smerK` za `body` (Telefón: k stredu za cenu ako von). */
export function pravitkoPosunu(marker: MarkerPos, smerK: PlayerId, body: number, telefon = false): Pravitko {
  const dieliky: DielikPravitka[] = [];
  let cena = 0;
  for (let z = marker, na = posunMarker({ marker: z }, smerK); na !== null; z = na, na = posunMarker({ marker: z }, smerK)) {
    const c = cenaKroku(z, na, telefon);
    const zamok = cena + c > body;
    dieliky.push({ na, zona: STUPNICA_ZONY[na], cena: c, zamok });
    if (zamok) break;
    cena += c;
  }
  return { body, dieliky, cena, polia: dieliky.filter((d) => !d.zamok).length };
}

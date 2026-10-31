// Dátový model tvorcu kariet — webový ekvivalent konceptov z MAUI aplikácie
// KartyAI (CardDraft, KeywordRule, CategoryColor, ScorecardDraft…).
//
// Návrh karty je bohatší než herná definícia v cards.json: nesie aj vzhľad
// (obrázok, farbu, mierky, rozmer) a tlač (počet kópií). Hra dostane len
// zverejnenú sadu prevedenú do formátu cards.json (zverejnenie.ts).

import type { Podmienka } from "@naex/core";

/** Pozície 0..3 zhora nadol, ako v pravidlách. */
export type Pozicia = 0 | 1 | 2 | 3;
export const POZICIE: readonly Pozicia[] = [0, 1, 2, 3];

export interface StranaNavrhu {
  /** Blokované pozície — nikdy nedržia akciu. */
  readonly blokovane: readonly Pozicia[];
  /** Multimnožina akcií: kľúč akcie → počet. */
  readonly akcie: Readonly<Record<string, number>>;
  /**
   * Obmedzenie pozícií: pozícia smie držať len vymenované akcie (alebo ostať
   * prázdna). Chýbajúca alebo prázdna pozícia povoľuje všetko.
   */
  readonly povolene: Readonly<Partial<Record<Pozicia, readonly string[]>>>;
  /**
   * Lokalita: názov polovice línie pri tejto hrane, napr. Krčma „pri výčape“
   * a „pri dverách“ (Michal 2026-10-20 — namiesto mätúcej „tvojej/súperovej strany“).
   */
  readonly kraj?: string;
}

/** Obrázok karty v dvoch veľkostiach (média sú nemenné, id = hash obsahu). */
export interface ObrazokKarty {
  readonly plny: string;
  readonly nahlad: string;
}

export interface KartaNavrh {
  /** Stabilné id — viaže sa naň implementácia efektu v jadre; po vzniku sa nemení. */
  readonly id: string;
  readonly nazov: string;
  readonly tagy: readonly string[];
  readonly efekt: string;
  readonly obrazok: ObrazokKarty | null;
  /** Vlastná farba (hex); null = farba podľa kategórie (tagov). */
  readonly farba: string | null;
  readonly mierkaTextu: number;
  readonly mierkaIkon: number;
  readonly sirkaMm: number;
  readonly vyskaMm: number;
  /** Koľko kópií každej permutácie sa tlačí. */
  readonly kopie: number;
  readonly lava: StranaNavrhu;
  readonly prava: StranaNavrhu;
  readonly upravene: number;
  /** Príbeh karty (backstory) pre detail karty v glosári Karty; hra ho nečíta. Chýba = karta ho ešte nemá. */
  readonly pribeh?: string;
  /** Účel v hre: čo s kartou hráč dosiahne a aké zahrania ponúka (odrážky „- “); hra ho nečíta. */
  readonly ucel?: string;
}

export type IkonaAkcie =
  | { readonly typ: "vstavana" }
  | { readonly typ: "svg"; readonly media: string };

export interface AkciaDef {
  /** Vstavané akcie majú kľúč z jadra (Rana, Pecka…), vlastné „vlastna_…“. */
  readonly kluc: string;
  readonly nazov: string;
  readonly popis: string;
  readonly ikona: IkonaAkcie;
  readonly poradie: number;
}

/** Pravidlo formátovania textu efektu (MAUI KeywordRule). */
export interface KlucoveSlovo {
  readonly slovo: string;
  readonly tucne: boolean;
  readonly kurziva: boolean;
  /** Ak slovo nie je na začiatku textu, začne nový riadok. */
  readonly novyRiadok: boolean;
  /** Ďalšie tvary slova (zahodiť, zahodí…). */
  readonly tvary: readonly string[];
  /** Vysvetlenie pre hráča — zobrazí sa ako tooltip. */
  readonly popis: string;
}

/** Farba kategórie (tagu); karta preberá farbu prvého zapnutého tagu. */
export interface Kategoria {
  readonly nazov: string;
  readonly odtien: number;
  readonly zapnuta: boolean;
}

/** Ikona pre bodovacie karty starších (MAUI DashboardIconStore). */
export interface IkonaBodovania {
  readonly id: string;
  readonly nazov: string;
  readonly media: string;
  /** Čo ikona v hre znamená; bez významu sa scorecard s ňou nedá zverejniť. */
  readonly podmienka?: Podmienka | null;
}

/** Bodovacia karta — podložka, do ktorej sa vkladá karta staršieho. */
export interface BodovaciaKarta {
  readonly id: string;
  readonly nazov: string;
  readonly sirkaMm: number;
  readonly vyskaMm: number;
  readonly mierkaIkon: number;
  readonly farba: string | null;
  readonly pozadie: string | null;
  /** Id ikony bodovania na pozíciách 0..3 (null = prázdne). */
  readonly lava: readonly (string | null)[];
  readonly prava: readonly (string | null)[];
  readonly upravene: number;
}

/** Predvolené hodnoty pre nové karty a hromadné úpravy (Global Settings). */
export interface Nastavenia {
  readonly sirkaMm: number;
  readonly vyskaMm: number;
  readonly mierkaTextu: number;
  readonly mierkaIkon: number;
}

export const PREDVOLENE_NASTAVENIA: Nastavenia = {
  sirkaMm: 54,
  vyskaMm: 80,
  mierkaTextu: 1.1,
  mierkaIkon: 1.3,
};

/** Všetko, čo potrebuje klient na zobrazenie kariet (glosár, hra, tvorca). */
export interface Vzhlad {
  readonly akcie: readonly AkciaDef[];
  readonly klucoveSlova: readonly KlucoveSlovo[];
  readonly kategorie: readonly Kategoria[];
}

/** Zverejnená sada — to, čo vidí hráč a s čím beží hra. */
export interface Sada extends Vzhlad {
  readonly verzia: number;
  readonly cas: number;
  readonly karty: readonly KartaNavrh[];
  /** Herné dáta vo formáte packages/core/data/cards.json. */
  readonly cardsJson: unknown;
  /** Scorecardy vo formáte packages/core/data/scorecards.json (staršie sady ich nemajú). */
  readonly scorecardsJson?: unknown;
  /** Vzhľad scorecardov pre hru (ilustrácia, ikony). */
  readonly bodovacie?: readonly BodovaciaKarta[];
  readonly ikonyBodovania?: readonly IkonaBodovania[];
}

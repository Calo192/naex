// Herné konštanty. Hodnoty označené TODO nie sú v pravidlách v11 — sú
// vytlačené na fyzických komponentoch a treba ich overiť podľa krabice.
// Menia sa TU, kód sa meniť nemusí.

export const KONSTANTY = {
  /** Štartovacie vybavenie hráča (PRAVIDLA §11). */
  START_POLDECI: 2,
  /**
   * Veľkosť ruky (rozhodnutie Michala 2026-10-11): štartovacie karty sa
   * zamiešajú do doberacieho balíčka, hráč si dobere toľkoto a na začiatku
   * každého kola si ruku doplní na túto veľkosť. Kliatby idú do
   * odhadzovacieho balíčka, nie do ruky.
   */
  VELKOST_RUKY: 5,
  START_CIGARETY: 1,

  /**
   * TODO: overiť podľa komponentov — rozdelenie 10 štartovacích kariet medzi
   * 4 typy štartoviek pravidlá neuvádzajú (otvorená otázka č. 7).
   */
  START_RUKA: {
    pijan: 3,
    ministrant: 3,
    milujuca_manzelka: 2,
    dievcina_na_vydaj: 2,
  } as Readonly<Record<string, number>>,

  /**
   * TODO: overiť podľa komponentov — koľko kópií každej karty (Občan/Zviera/
   * Nástroj) je v spoločnom doberacom balíčku. V tlači je každý variant
   * samostatná karta; pre v1 berieme 2 kópie s náhodným variantom.
   */
  KOPIE_V_SPOLOCNOM_BALICKU: 2,

  /** Základy odvodených hodnôt (PRAVIDLA §9 a §13). */
  /**
   * Prah Cirhózy (+ priazeň Alkoholika). Michal 2026-10-12 zvýšil z 2 na 3:
   * v playteste 20261011-183315 hráči priznávali kliatby po jednej a kolá sa
   * naťahovali (tempo 5,5).
   */
  PRAH_CIRHOZY_ZAKLAD: 3,
  /**
   * Prah Dlhu (Michal 2026-10-12): akcie Hazard plnia zadĺženie a kartu Dlh
   * hráč dostane až pri tomto prahu — ako pečeň a Cirhóza. Ďalšie pravidlá
   * k zadĺženiu (priazne, efekty kariet) pribudnú neskôr.
   */
  PRAH_DLHU: 2,
  PRAH_EXEKUTORA_ZAKLAD: 10, // + 2 × priazeň Exekútora
  HODNOTA_VIERY_ZAKLAD: 1, // + priazeň Veriaceho
  PRESKUMANIE: 5,
  TROCHA_ZAKLAD: 1, // + priazeň Lakomca
  ZOPAR_ZAKLAD: 2, // + priazeň Neprajníka
  /**
   * Limit ruky na konci kola (+ priazeň Zberateľa). Michal 2026-10-12: ruky
   * v playteste 20261012-055944 narástli na 10–16 kariet; nadbytok hráč
   * odhodí do odhadzovacieho balíčka podľa vlastného výberu.
   */
  LIMIT_RUKY_ZAKLAD: 6,

  /** Prehra pri poklese balíčka pod túto hodnotu (PRAVIDLA §1). */
  MIN_VELKOST_BALICKA: 5,

  /** Stokársky barter: cigarety → nový plný poldeci (PRAVIDLA §5). */
  BARTER_CENA: 5,
  /** Fyzické cigarety → otočenie vypitého poldeci (PRAVIDLA §5). */
  REFILL_CENA: 2,

  // Body na konci hry sú v data/scorecards.json (podmienky scorecardov).
} as const;

/**
 * Dĺžka hry = počet lokalít, o ktoré sa hráči bijú (rozhodnutie Michala
 * 2026-10-11). Dlhá hra potrebuje v sade aspoň 11 lokalít — kým ich admin
 * v tvorcovi nepridá, nedá sa zvoliť.
 */
export const DLZKY_HRY = { kratka: 5, stredna: 7, dlha: 11 } as const;
export type DlzkaHry = keyof typeof DLZKY_HRY;
export const ALL_DLZKY: readonly DlzkaHry[] = ["kratka", "stredna", "dlha"];
export const PREDVOLENA_DLZKA: DlzkaHry = "stredna";
export const NAZOV_DLZKY: Readonly<Record<DlzkaHry, string>> = { kratka: "Krátka", stredna: "Stredná", dlha: "Dlhá" };

// Herné konštanty. Hodnoty označené TODO nie sú v pravidlách v11 — sú
// vytlačené na fyzických komponentoch a treba ich overiť podľa krabice.
// Menia sa TU, kód sa meniť nemusí.

export const KONSTANTY = {
  /** Štartovacie vybavenie hráča (PRAVIDLA §11). */
  START_POLDECI: 2,
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
  PRAH_CIRHOZY_ZAKLAD: 2, // + priazeň Alkoholika
  PRAH_EXEKUTORA_ZAKLAD: 10, // + 2 × priazeň Exekútora
  HODNOTA_VIERY_ZAKLAD: 1, // + priazeň Veriaceho
  PRESKUMANIE_ZAKLAD: 5, // + priazeň Očumovateľa
  TROCHA_ZAKLAD: 1, // + priazeň Lakomca
  ZOPAR_ZAKLAD: 2, // + priazeň Neprajníka

  /** Prehra pri poklese balíčka pod túto hodnotu (PRAVIDLA §1). */
  MIN_VELKOST_BALICKA: 5,

  /** Počet lokalít v hre: 3 krátka / 6 stredná (kariet je len 7 — otázka č. 8). */
  LOKALIT_V_HRE: 3,

  /** Stokársky barter: cigarety → nový plný poldeci (PRAVIDLA §5). */
  BARTER_CENA: 5,
  /** Fyzické cigarety → otočenie vypitého poldeci (PRAVIDLA §5). */
  REFILL_CENA: 2,

  /** Bodovanie na konci hry. Jediné dané pravidlami je −1 za nepriznaný dlh. */
  BODY_ZA_LOKALITU: 3, // TODO: overiť podľa komponentov
  BODY_ZA_STARSIEHO: 3, // TODO: overiť podľa komponentov
  BODY_ZA_CIGARETU: 1, // TODO: overiť podľa komponentov
  POKUTA_NEPRIZNANA_CIRHOZA: -2, // TODO: overiť podľa komponentov
  POKUTA_NEPRIZNANY_DLH: -1,
} as const;

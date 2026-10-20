// Herné konštanty. Hodnoty označené TODO nie sú v pravidlách v11 — sú
// vytlačené na fyzických komponentoch a treba ich overiť podľa krabice.
// Menia sa TU, kód sa meniť nemusí.

export const KONSTANTY = {
  /**
   * Štartovacie vybavenie hráča (PRAVIDLA §11). Michal 2026-10-20 znížil
   * poldeci z 3 na 2 (cigarety ostávajú 3) — pas teraz platí cigaretami.
   */
  START_POLDECI: 2,
  /**
   * Štartovacia ruka (rozhodnutie Michala 2026-10-11): štartovacie karty sa
   * zamiešajú do doberacieho balíčka a hráč si dobere toľkoto. Kliatby idú
   * do odhadzovacieho balíčka, nie do ruky.
   */
  VELKOST_RUKY: 5,
  /**
   * Po každej bitke si hráč dobere toľkoto kariet (Michal 2026-10-19) —
   * namiesto doplnenia ruky na 5. Limit ruky nie je.
   */
  KARTY_PO_BITKE: 2,
  START_CIGARETY: 3,

  /**
   * Štartovací balíček každého hráča (Michal 2026-10-18). Tieto štyri druhy
   * sú výhradne štartovacie — v spoločnom balíčku ani v šenku nie sú.
   */
  START_RUKA: {
    pijan: 4,
    ministrant: 2,
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
   * Prah Dlhu (+ sila Úžerníka): akcie Dlh plnia zadĺženie a kartu Dlh hráč
   * dostane pri tomto prahu. Michal 2026-10-18 znížil z 2 na 1 (Dlh v playteste
   * nevznikol), 2026-10-20 vrátil na 2 s priazňou Úžerníka. Úžerník pridáva
   * silu, nie 2 × silu — zadĺženie sa po Pitke nuluje a vyšší prah by Dlh vypol.
   */
  PRAH_DLHU_ZAKLAD: 2,
  /**
   * Pas (Michal 2026-10-20): kto v Zhromaždení pasuje, dostane toľko cigariet,
   * koľko kariet ešte smel vyložiť (zostávajúci limit), a hrá až v Pitke.
   */
  CIGARETY_ZA_PAS_NA_KARTU: 1,
  /**
   * Šenok (Michal 2026-10-19): hráč na ťahu berie 1 kartu za 1 cigaretu, alebo
   * 2 karty za 3 cigarety; poldeci sa v šenku neplatí. Index = počet kariet.
   */
  CENA_SENKU: [0, 1, 3] as readonly number[],
  /**
   * Po braní sa šenok doplní z vrchu spoločného balíčka na toľkoto kariet
   * (Michal 2026-10-20) — pre Liečbu, Starostu a iné efekty, ktoré z neho berú.
   */
  SENOK_PO_BRANI: 8,
  /**
   * Dedičstvo (Michal 2026-10-19): cena rastie spoločne pre oboch hráčov —
   * prvý Nástroj v hre stojí 1 cigaretu, druhý 2, tretí 3…
   */
  CENA_DEDICSTVA_ZAKLAD: 1,
  /**
   * Priazeň (Michal 2026-10-16): sila 1 / 2 / 3 podľa zóny markera a účinok
   * dvojnásobný — každá priazeň pridáva NASOBOK_PRIAZNE × sila. Má vyvážiť
   * prehrávanie: prebytok posúva markery k porazenému.
   */
  NASOBOK_PRIAZNE: 2,
  PRAH_EXEKUTORA_ZAKLAD: 10, // + 2 × priazeň Exekútora
  HODNOTA_VIERY_ZAKLAD: 1, // + priazeň Veriaceho
  PRESKUMANIE: 5,

  /** Prehra pri poklese balíčka pod túto hodnotu (PRAVIDLA §1). */
  MIN_VELKOST_BALICKA: 5,

  /**
   * Pevné čísla z efektov kariet (Michal 2026-10-18, revízia kariet, variant A):
   * nahrádzajú kľúčové slová Trocha a Zopár, ktoré záviseli od priazne
   * Lakomca a Neprajníka. Texty kariet v tvorcovi uvádzajú tie isté čísla.
   */
  EFEKT: {
    AUTOBUSAR_ABSTAKY: 1,
    FARAR_POVERY: 2,
    VETERINAR_CIRHOZA: 2,
    LESNA_CESTA_MAX: 2,
    IHRISKO_TUHE: 2,
    URAD_PRAH_EXEKUTORA: 4,
    URAD_ROBOTA: 2,
    ZBERNY_DVOR_CENA: 1,
    POSTARKA_KARTY: 2,
    POSTARKA_DLHY: 1,
    PODVODNIK_CIGARETY: 2,
    SVOKRA_CIGARETY: 2,
    VDOVA_DLHY: 2,
    STRYNA_KLIATBY: 1,
    NEALKO_PRAH_CIRHOZY: 2,
    SVATY_TEXT_VIERA: 1,
    PUSKA_PREBYTOK: 2,
    CIGORKY_CIGARETY: 1,
    AUTOMAT_VYHRA_CIGARETY: 2,
    AUTOMAT_PREHRA_DLHY: 1,
  },

  /** Stokársky barter: cigarety → nový plný poldeci (PRAVIDLA §5); Lakomec zlacní. */
  BARTER_CENA: 5,
  /** Cigarety → otočenie vypitého poldeci (PRAVIDLA §5). */
  REFILL_CENA: 2,
  /**
   * Nové kolo, nový poldeci (Michal 2026-10-16, playtest 20261016-155120):
   * na začiatku kola sa toľko vypitých poldeci otočí na plné. Bez toho hráč
   * po drafte a NA EX ostal s limitom 1 až do konca partie (Eva 4 zo 7 kôl).
   */
  POLDECI_NA_ZACIATKU_KOLA: 1,

  /**
   * Podmienka „zvyšné cigarety“ ráta kusy po trojiciach (Michal 2026-10-16):
   * cigarety sa hromadia z akcií Cigareta a sú hlavne mena, nie zdroj bodov.
   */
  CIGARIET_NA_KUS: 3,

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

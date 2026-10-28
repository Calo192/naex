// Herné konštanty. Menia sa TU, kód sa meniť nemusí. Hodnoty, ktoré pravidlá
// v11 neudávali, potvrdil Michal 2026-10-22 (roadmapa #11).

export const KONSTANTY = {
  /**
   * Štartovacie vybavenie hráča (PRAVIDLA §3). Michal 2026-10-20 znížil
   * poldeci z 3 na 2 (cigarety ostávajú 3) — pas teraz platí cigaretami.
   */
  START_POLDECI: 2,
  /**
   * Po každej bitke si hráč dobere toľkoto kariet (Michal 2026-10-19) —
   * namiesto doplnenia ruky na 5. Limit ruky nie je. Od 2026-10-27 len 1
   * (predtým 2): ďalšie karty sa majú kupovať cigaretami (šenok, fajčenie).
   */
  KARTY_PO_BITKE: 1,
  START_CIGARETY: 3,

  /**
   * Počiatočná ruka každého hráča (v6, Michal 2026-10-26): len tieto štyri
   * karty, doberací balíček je na začiatku prázdny (predtým 7 štartoviek
   * 3/2/1/1 v balíčku a 5 v ruke). Tieto štyri druhy sú výhradne štartovacie —
   * v spoločnom balíčku ani v šenku nie sú.
   */
  START_RUKA: {
    ministrant: 1,
    milujuca_manzelka: 1,
    pijan: 1,
    dievcina_na_vydaj: 1,
  } as Readonly<Record<string, number>>,

  /**
   * Koľko kópií každej karty (Občan/Zviera/Nástroj) je v spoločnom doberacom
   * balíčku, každá s náhodným variantom (Michal 2026-10-22): 2 kópie dajú
   * 62 kariet — dlhej hre stačia a sada sa neriedi.
   */
  KOPIE_V_SPOLOCNOM_BALICKU: 2,

  // Základy odvodených hodnôt (PRAVIDLA §8 a §10).
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
   * koľko kariet ešte smel vyložiť (zostávajúci limit), najviac toľko, koľko má
   * kariet v ruke (v6.1), a hrá až v Pitke.
   */
  CIGARETY_ZA_PAS_NA_KARTU: 1,
  /** Záverečná (roadmapa #83, Michal 2026-10-23): karta lícom dole za cigaretu. */
  CENA_ZAVERECNEJ: 1,
  /**
   * Šenok (Michal 2026-10-19): hráč na ťahu berie 1 kartu za 1 cigaretu, alebo
   * 2 karty za 3 cigarety; poldeci sa v šenku neplatí. Index = počet kariet.
   */
  CENA_SENKU: [0, 1, 3] as readonly number[],
  /**
   * Po braní sa šenok doplní z vrchu spoločného balíčka na toľkoto kariet
   * (Michal 2026-10-20) — pre Pohreb Závislého, Starostu a iné efekty, ktoré z neho berú.
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
  /**
   * v8 (Michal 2026-10-28, návrh #34 A): 6, so súperovou priazňou Exekútora 5 / 4 / 3
   * (v7 bolo 7 — exekúcia sa spustila raz z 18 bitiek, Dlh nič nestál).
   */
  PRAH_EXEKUTORA_ZAKLAD: 6,
  HODNOTA_VIERY_ZAKLAD: 1, // Veriaci (2026-10-20) dáva Vieru navyše rovnú sile, hodnotu nemení
  /**
   * Špaky (pravidlá v6, Michal 2026-10-26): víťaz bitky dostane vždy aspoň
   * SPAKY_ZA_BITKU_MIN a nepriznaná Cirhóza na konci hry stojí toľkoto špakov
   * za kus (ruka aj oba balíčky) — v8 (Michal 2026-10-28, návrh #33) 3, predtým 5.
   */
  SPAKY_ZA_BITKU_MIN: 1,
  SPAKY_ZA_CIRHOZU: 3,
  /**
   * Výkupné zvyšných zdrojov na konci hry (Michal 2026-10-27): každý plný
   * poldeci dá toľkoto špakov a každých CIGARIET_ZA_SPAK cigariet 1 špak.
   * Bez stropu — prebytok zdrojov sa má dať zúžitkovať, nie prepadnúť.
   */
  SPAKY_ZA_POLDECI: 1,
  CIGARIET_ZA_SPAK: 5,

  /**
   * Pevné čísla z efektov kariet (Michal 2026-10-18, revízia kariet, variant A):
   * nahrádzajú kľúčové slová Trocha a Zopár, ktoré záviseli od priazne
   * Lakomca a Neprajníka. Texty kariet v tvorcovi uvádzajú tie isté čísla.
   */
  EFEKT: {
    IHRISKO_TUHE: 2,
    ZBERNY_DVOR_CENA: 1,
    /** Do v7 Poštárka (Pitka) dávala až 2 karty; od v7 Kšeft za 1 Dlh 1 karta. */
    POSTARKA_KARTY: 2,
    POSTARKA_DLHY: 1,
    SVOKRA_RANY: 1,
    NEALKO_PRAH_CIRHOZY: 2,
    KRCMA_PRAH_CIRHOZY: 2,
    SVATY_TEXT_VIERA: 1,
    /** Konflikt Policajtky (v7): Kriminál jej majiteľovi dá toľko cigariet. */
    POLICAJTKA_CIGARETY: 2,
    /** Krabička cigariet (v7): za každých toľko cigariet, ktoré súper vyfajčí, 1 karta. */
    CIGORKY_ZA_KARTU: 2,
    /** Kšefty v7 (plan.md 14.0): Strýko, Vychovávateľka, Obecný úrad. */
    STRYKO_CENA: 2,
    VYCHOVAVATELKA_CENA: 2,
    URAD_CENA: 3,
  },

  /** Stokársky barter: cigarety → nový plný poldeci (PRAVIDLA §7); Lakomec zlacní. */
  BARTER_CENA: 5,
  /** Cigarety → otočenie vypitého poldeci (PRAVIDLA §7). */
  REFILL_CENA: 2,
  /**
   * Fajčenie v Pitke (Michal 2026-10-27, PRAVIDLA §7): k-te fajčenie hráča v tej
   * istej Pitke stojí ZAKLAD + (k − 1) × PRIRASTOK cigariet — 1, 2, 3…; každá Pitka
   * začína znova od prvého. Nie je to strop: fajčiť sa dá stále, len drahšie.
   */
  CENA_FAJCENIA_ZAKLAD: 1,
  CENA_FAJCENIA_PRIRASTOK: 1,
  /**
   * Nové kolo, nový poldeci (Michal 2026-10-16, playtest 20261016-155120):
   * na začiatku kola sa toľko vypitých poldeci otočí na plné. Bez toho hráč
   * po drafte a NA EX ostal s limitom 1 až do konca partie (Eva 4 zo 7 kôl).
   */
  POLDECI_NA_ZACIATKU_KOLA: 1,
} as const;

/**
 * Dĺžka hry = počet lokalít, o ktoré sa hráči bijú (rozhodnutie Michala
 * 2026-10-11; 3 / 5 / 7 od 2026-10-24, predtým 5 / 7 / 11). Po nich sa hrá
 * ešte finále na pinnacle lokalite (v7). Dĺžku, na ktorú sada nemá dosť
 * lokalít, ponuka vynechá.
 */
export const DLZKY_HRY = { kratka: 3, stredna: 5, dlha: 7 } as const;

/**
 * Verzia pravidiel, ktorú nesie každá archivovaná partia (Michal 2026-10-22) —
 * podľa nej sa dajú oddeliť partie hrané na iných pravidlách. Do zmrazenia v4
 * bola značkou dátum zmeny („2026-10-24.2“); od v4 (Michal 2026-10-24) sa
 * pravidlá menia len v dávkach raz za 2 týždne a celá dávka dostane ďalšie
 * číslo („v5“) spolu s novým dátumom platnosti.
 */
// v8 (Michal 2026-10-28): bodovanie kartami v línii, strach za nové zóny, prebytok
// rozdeľuje porazený, Kultúrny dom „Obaja bodujú“, Cirhóza −3, Exekútor 6, Kmotor presúva Dlhy.
export const VERZIA_PRAVIDIEL = "v8";
/** Odkedy platí VERZIA_PRAVIDIEL — hráč ho vidí na stránke Pravidlá. */
export const PRAVIDLA_PLATNE_OD = "2026-10-28";
export type DlzkaHry = keyof typeof DLZKY_HRY;
export const ALL_DLZKY: readonly DlzkaHry[] = ["kratka", "stredna", "dlha"];
export const PREDVOLENA_DLZKA: DlzkaHry = "stredna";
export const NAZOV_DLZKY: Readonly<Record<DlzkaHry, string>> = { kratka: "Krátka", stredna: "Stredná", dlha: "Dlhá" };

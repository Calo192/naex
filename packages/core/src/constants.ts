// Herné konštanty. Menia sa TU, kód sa meniť nemusí. Hodnoty, ktoré pravidlá
// v11 neudávali, potvrdil Michal 2026-10-22 (roadmapa #11).

export const KONSTANTY = {
  /**
   * Štartovacie vybavenie hráča (PRAVIDLA §3). Michal 2026-10-20 znížil
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
   * Štartovací balíček každého hráča: 7 kariet (Michal 2026-10-22, roadmapa #8;
   * predtým 10 = 4/2/2/2). Slabé štartovky majú hráča hnať do šenku a skôr
   * ustúpiť silnejším kartám; 5 by hráča nechalo hneď na hranici prehry
   * (balíček pod 5) a s jedným Miňištrantom bez cigariet na šenok. Tieto štyri
   * druhy sú výhradne štartovacie — v spoločnom balíčku ani v šenku nie sú.
   */
  START_RUKA: {
    pijan: 3,
    ministrant: 2,
    milujuca_manzelka: 1,
    dievcina_na_vydaj: 1,
  } as Readonly<Record<string, number>>,

  /**
   * Koľko kópií každej karty (Občan/Zviera/Nástroj) je v spoločnom doberacom
   * balíčku, každá s náhodným variantom (Michal 2026-10-22): 2 kópie dajú
   * 62 kariet — dlhej hre stačia a sada sa neriedi.
   */
  KOPIE_V_SPOLOCNOM_BALICKU: 2,

  /** Základy odvodených hodnôt (PRAVIDLA §8 a §10). */
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
  PRAH_EXEKUTORA_ZAKLAD: 10, // + 2 × priazeň Exekútora
  HODNOTA_VIERY_ZAKLAD: 1, // Veriaci (2026-10-20) dáva Vieru navyše rovnú sile, hodnotu nemení
  PRESKUMANIE: 5,
  /**
   * Pohoršenie (Michal 2026-10-20): ten istý marker smie ísť v bitke aj
   * viackrát, Pohoršenia jedného hráča ho však posunú najviac cez toľkoto
   * hraníc zón (pravá sivá → ľavá oranžová áno). Kultúrny dom limit ruší.
   */
  POHORSENIE_MAX_HRANIC: 2,

  /**
   * Prehra pri poklese balíčka pod túto hodnotu platila do v4; vo v5 sa ruší
   * (Michal 2026-10-24). Ostáva ako opatrnosť bota pri zahadzovaní kariet.
   */
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
    KRCMA_PRAH_CIRHOZY: 2,
    SVATY_TEXT_VIERA: 1,
    PUSKA_PREBYTOK: 2,
    CIGORKY_CIGARETY: 1,
    AUTOMAT_VYHRA_CIGARETY: 2,
    AUTOMAT_PREHRA_DLHY: 1,
  },

  /** Stokársky barter: cigarety → nový plný poldeci (PRAVIDLA §7); Lakomec zlacní. */
  BARTER_CENA: 5,
  /** Cigarety → otočenie vypitého poldeci (PRAVIDLA §7). */
  REFILL_CENA: 2,
  /**
   * Nové kolo, nový poldeci (Michal 2026-10-16, playtest 20261016-155120):
   * na začiatku kola sa toľko vypitých poldeci otočí na plné. Bez toho hráč
   * po drafte a NA EX ostal s limitom 1 až do konca partie (Eva 4 zo 7 kôl).
   */
  POLDECI_NA_ZACIATKU_KOLA: 1,

  /**
   * Do v4: podmienka „zvyšné cigarety“ rátala kusy po trojiciach. Vo v5 sa
   * o cigarety bojuje kus po kuse (súboj podmienok), konštantu číta už len UI.
   *
   * Pôvodne: podmienka „zvyšné cigarety“ ráta kusy po trojiciach (Michal 2026-10-16):
   * cigarety sa hromadia z akcií Cigareta a sú hlavne mena, nie zdroj bodov.
   */
  CIGARIET_NA_KUS: 3,

  // Body na konci hry sú v data/scorecards.json (podmienky scorecardov).
} as const;

/**
 * Dĺžka hry = počet lokalít, o ktoré sa hráči bijú (rozhodnutie Michala
 * 2026-10-11; 3 / 5 / 7 od 2026-10-24, predtým 5 / 7 / 11). Dĺžku, na ktorú
 * sada nemá dosť lokalít, ponuka vynechá.
 */
export const DLZKY_HRY = { kratka: 3, stredna: 5, dlha: 7 } as const;

/**
 * Verzia pravidiel, ktorú nesie každá archivovaná partia (Michal 2026-10-22) —
 * podľa nej sa dajú oddeliť partie hrané na iných pravidlách. Do zmrazenia v4
 * bola značkou dátum zmeny („2026-10-24.2“); od v4 (Michal 2026-10-24) sa
 * pravidlá menia len v dávkach raz za 2 týždne a celá dávka dostane ďalšie
 * číslo („v5“) spolu s novým dátumom platnosti.
 */
export const VERZIA_PRAVIDIEL = "v5";
/** Odkedy platí VERZIA_PRAVIDIEL — hráč ho vidí na stránke Pravidlá. */
export const PRAVIDLA_PLATNE_OD = "2026-10-25";
/**
 * Bodovanie v5 (návrh Michala 2026-10-24, docs/pravidla-v5/davka.md) — čo ešte
 * nie je rozhodnuté, je tu pomenované a vypnuté.
 */
export const BODOVANIE_V5 = {
  /**
   * TODO(Michal): variant (a) „útecha“ — kto väčšinu súbojov pri staršom
   * prehrá, ale vyhrá aspoň jednu podmienku, dostane 1 b. Rozhodne Michal po
   * finálnom meraní stratéga (interview 3, 2026-10-25); dovtedy vypnuté.
   */
  UTECHA: false as boolean,
} as const;

export type DlzkaHry = keyof typeof DLZKY_HRY;
export const ALL_DLZKY: readonly DlzkaHry[] = ["kratka", "stredna", "dlha"];
export const PREDVOLENA_DLZKA: DlzkaHry = "stredna";
export const NAZOV_DLZKY: Readonly<Record<DlzkaHry, string>> = { kratka: "Krátka", stredna: "Stredná", dlha: "Dlhá" };

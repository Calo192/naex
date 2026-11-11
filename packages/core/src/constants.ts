// Herné konštanty. Menia sa TU, kód sa meniť nemusí. Hodnoty, ktoré pravidlá
// v11 neudávali, potvrdil Michal 2026-10-22 (roadmapa #11).

/**
 * Hodnota stupňa teplomera (žltá, oranžová, červená) — strach aj reči (v11.12; v11.20, Michal
 * 2026-11-10: „Zmeniť na 1 / 2 / 3“, do v11.19 1 / 2 / 2). Plný teplomer = súčet.
 */
const HODNOTA_STUPNA: readonly number[] = [0, 1, 2, 3];

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
   * V11.9–v11.20 sa doberalo do 3 kariet v ruke (kto šetril, nedostal nič). Od v11.21
   * (Michal 2026-11-10: „nie DO 2, ale 2 karty“) dostane každý presne toľkoto bez ohľadu na ruku.
   */
  DOBRATIE_PO_BITKE: 2,
  START_CIGARETY: 3,

  /**
   * Formát 2 na 2 (Michal 2026-10-28): tím začína s 3 poldeci a 4 cigaretami
   * a prah Dlhu aj Cirhózy má o 1 vyšší — zdroje a kliatby sú spoločné tímu.
   */
  DVA_NA_DVA: {
    START_POLDECI: 3,
    START_CIGARETY: 4,
    PRAH_NAVYSE: 1,
  },

  /**
   * Počiatočná ruka každého hráča (v6, Michal 2026-10-26): len tieto štyri
   * karty, doberací balíček je na začiatku prázdny (predtým 7 štartoviek
   * 3/2/1/1 v balíčku a 5 v ruke). Tieto štyri druhy sú výhradne štartovacie —
   * v Náradí, Občanoch ani v šenku nie sú.
   */
  START_RUKA: {
    ministrant: 1,
    milujuca_manzelka: 1,
    pijan: 1,
    dievcina_na_vydaj: 1,
  } as Readonly<Record<string, number>>,

  /**
   * Koľko kópií každej karty (Občan/Zviera/Nástroj) je v balíčkoch Náradie
   * a Občania, každá s náhodným variantom (Michal 2026-10-22): 2 kópie dlhej
   * hre stačia a sada sa neriedi.
   */
  KOPIE_V_SPOLOCNOM_BALICKU: 2,
  /**
   * Stavba šenku (v8.5, Michal 2026-10-30): každý hráč dostane 2 karty
   * z Náradia a 6 z Občanov, bez ohľadu na počet starších. V tom istom pomere
   * sa šenok dopĺňa po braní (SENOK_PO_BRANI).
   */
  STAVBA_NARADIE: 2,
  STAVBA_OBCANIA: 6,

  // Základy odvodených hodnôt (PRAVIDLA §8 a §10).
  /**
   * Prah Cirhózy. Michal 2026-10-12 zvýšil z 2 na 3:
   * v playteste 20261011-183315 hráči priznávali kliatby po jednej a kolá sa
   * naťahovali (tempo 5,5).
   */
  PRAH_CIRHOZY_ZAKLAD: 3,
  /**
   * Prah Dlhu: akcie Hazard (kľúč Dlh, v8.2) plnia zadĺženie a Dlh (od v8.2
   * počítadlo) hráč dostane pri tomto prahu. Michal 2026-10-18 znížil z 2 na 1
   * (Dlh v playteste nevznikol), 2026-10-20 vrátil na 2 s priazňou Úžerníka (v5
   * priazeň prah nemení), 2026-11-06 (v11.8) znova 1: „hráči majú strašne málo
   * Dlhov“ — každý Hazard je hneď Dlh. Prah nad 1 má len Výherný automat
   * (prahDlhuBonus); len vtedy má hráč zvyšok zadĺženia na účte.
   */
  PRAH_DLHU_ZAKLAD: 1,
  /**
   * Pas (Michal 2026-10-20): kto v Zhromaždení pasuje, dostane toľko cigariet,
   * koľko kariet ešte smel vyložiť (zostávajúci limit), najviac toľko, koľko má
   * kariet v ruke (v6.1), a hrá až v Pitke.
   */
  CIGARETY_ZA_PAS_NA_KARTU: 1,
  /** Podloženie Nástroja pod kartu v línii (Náradie, Michal 2026-11-08, P4). */
  CENA_PODLOZENIA: 1,
  /** Záverečná (roadmapa #83, Michal 2026-10-23): karta lícom dole za cigaretu. */
  CENA_ZAVERECNEJ: 1,
  /** Odpoveď na NA EX (v11.16, Michal 2026-11-09): toľko plných poldeci sa za ňu vypije. */
  CENA_ODPOVEDE_POLDECI: 1,
  /**
   * Šenok (Michal 2026-10-19): hráč na ťahu berie 1 kartu za 1 cigaretu, alebo
   * 2 karty za 3 cigarety; poldeci sa v šenku neplatí. Index = počet kariet.
   */
  CENA_SENKU: [0, 1, 3] as readonly number[],
  /** Kto berie zo šenku prvý (obranca, v9.2), vezme na prvom ťahu najviac toľko kariet — nevykradne šenok. */
  SENOK_PRVY_TAH: 1,
  /**
   * Po braní sa šenok doplní z vrchu Náradia a Občanov na toľkoto kariet
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
  HODNOTA_VIERY_ZAKLAD: 1, // Veriaci (2026-10-20) dáva Vieru navyše rovnú sile, hodnotu nemení
  /**
   * Hádka (v10, Michal 2026-11-01, docs/napady/hadka.html H3): mäkké poškodenie z akcie,
   * ktorej je v sade menej, je 2, z početnejšej 1 — v sade v53 je Povier viac než
   * Pohoršení. Horoskop (Dedičstvo) dá Povere silu 2. Pri zmene pomeru akcií v sade prepočítať.
   * 3 a 2 (Horoskop 3) sa skúšalo v Zrejúcej 2026-11-04 — „extrémne silné“, Michal 2026-11-05 vrátil.
   */
  HADKA: {
    POHORSENIE_MAKKE: 2,
    POVERA_MAKKE: 1,
    HOROSKOP_POVERA: 2,
  },
  /**
   * Špaky (pravidlá v6, Michal 2026-10-26): víťaz bitky dostane vždy aspoň
   * SPAKY_ZA_BITKU_MIN a nepriznaná Cirhóza na konci hry stojí toľkoto špakov
   * za kus (ruka aj oba balíčky) — v8 (Michal 2026-10-28, návrh #33) 3, predtým 5.
   */
  SPAKY_ZA_BITKU_MIN: 1,
  SPAKY_ZA_CIRHOZU: 3,
  /**
   * Nakladačka vo finále (v9.1, Michal 2026-10-30): markery sa po finále už nehýbu,
   * víťaz dostane toľkoto špakov za každý jej bod. Cieľ: vedúci pred finále má vyhrať
   * okolo polovice partií (predtým ~81 %, Nakladačka vo finále prepadla).
   */
  SPAKY_ZA_NAKLADACKU_VO_FINALE: 1,
  /** Hádka vo finále (v11): reči sa už nedvíhajú, víťaz hádky dostane toľkoto špakov za každý jej bod. */
  SPAKY_ZA_HADKU_VO_FINALE: 1,
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
    SVOKRA_RANY: 1,
    NEALKO_PRAH_CIRHOZY: 2,
    KRCMA_PRAH_CIRHOZY: 2,
    SVATY_TEXT_VIERA: 1,
    /** Konflikt Policajtky (v7): Kriminál jej majiteľovi dá toľko cigariet. */
    POLICAJTKA_CIGARETY: 2,
    /** Konflikt Veľmi smútiacej vdovy (v11.3, predtým 2): súper odhodí toľko kariet z balíčka za každého svojho Chlapa pri nej. */
    VDOVA_ODHOD_ZA_CHLAPA: 1,
    /** Krabička cigariet (v7): za každých toľko cigariet, ktoré súper vyfajčí, 1 karta. */
    CIGORKY_ZA_KARTU: 2,
    /** Lesná cesta (v11.13): tuhé navyše za každé svoje Zviera v línii. */
    LESNA_CESTA_TUHE: 2,
    /** Obecný úrad (v11.13): cigarety a Dlhy získané v Pitke sa rátajú toľkokrát. */
    OBECNY_URAD_NASOBOK: 2,
    /** Benzínka (v11.15): každé fajčenie v Pitke stojí o toľko cigariet menej, najmenej 0. */
    BENZINKA_ZLAVA: 1,
  },

  /**
   * Zajatie a presvedčenie (v11.4, Michal 2026-11-03, PRAVIDLA §10): pri rozdelení Nakladačky
   * stojí zajatie staršieho s červeným strachom toľko bodov, pri rozdelení hádky presvedčenie
   * staršieho s rečami na celom teplomere toľko bodov (v11.12). Cena v cigaretách (pokus o zajatie) zanikla.
   * Väzni na výhru podľa ligy (vazniNaVyhru).
   */
  CENA_ZAJATIA: 5,
  CENA_PRESVEDCENIA: 3,
  /**
   * Strach a reči (v11, Michal 2026-11-02, docs/napady/strach-reci.html): vstup na stupeň
   * 1 / 2 / 3 (žltá, oranžová, červená) stojí pri dvíhaní toľko bodov Nakladačky či hádky,
   * koľko je číslo stupňa; po bitke marker na ňom dá SPAKY_ZA_STUPEN špakov — súčet hodnôt
   * stupňov po neho (1 / 3 / 6). Kto vyhrá bitku a má červený strach u CERVENYCH_NA_VYHRU
   * starších (väzni sa rátajú), vyhráva hneď.
   */
  CENA_STUPNA: [0, 1, 2, 3] as readonly number[],
  SPAKY_ZA_STUPEN: HODNOTA_STUPNA.map((_, st) => HODNOTA_STUPNA.slice(1, st + 1).reduce((a, b) => a + b, 0)) as readonly number[],
  /**
   * Reči na súperovom teplomere (v11.12, Michal 2026-11-06): špaky za stupeň dostane ten, kto ho
   * drží (1 / 2 / 3, v11.20). Súper platí za stupeň s rečami o REC_PRIRAZKA viac.
   */
  HODNOTA_STUPNA,
  REC_PRIRAZKA: 1,
  CERVENYCH_NA_VYHRU: 4,
  /** Porazený bitky dostane toľkoto cigariet (v11 — do v10 cigaretu za každého posunutého staršieho). */
  CIGARETY_PORAZENEMU: 1,
  /**
   * Výpalné (v11.9, Michal 2026-11-06, návrh E): súper po bitke dá toľkoto cigariet za každého
   * staršieho na tvojom červenom strachu (väzeň sa ráta), koľko má — aby strach financoval šenok.
   */
  VYPALNE_ZA_CERVENU: 1,
  /** Schopnosť väzňa Poštárky (v11.2, Michal 2026-11-02): toľko cigariet držiteľovi. */
  POSTARKA_CIGARETY: 4,
  /** Schopnosť väzňa Autobusára (v11.2): každá karta zo šenku za toľko cigariet. */
  AUTOBUSAR_CENA: 1,

  /** Stokársky barter: cigarety → nový plný poldeci (PRAVIDLA §7); Lakomec zlacní. */
  BARTER_CENA: 5,
  /** Cigarety → otočenie vypitého poldeci (PRAVIDLA §7). */
  REFILL_CENA: 2,
  /**
   * Fajčenie v Pitke (Michal 2026-10-27, PRAVIDLA §7): k-te fajčenie hráča v tej
   * istej Pitke stojí ZAKLAD + (k − 1) × PRIRASTOK cigariet — 1, 2, 3…; každá Pitka
   * začína znova od prvého. Nie je to strop: fajčiť sa dá stále, len drahšie.
   */
  /**
   * Chuť a Absťák (v9.1, Michal 2026-10-30, docs/napady/abstak-3.html): NA EX je väčšia
   * dávka než vypitý poldeci, preto ráta za 2 neresti (Vypiť a vyfajčená cigareta po 1).
   * Na konci kola Chuť klesne o CHUT_UBYTOK (od väčšieho z Chuti a nerestí kola) —
   * kto prestane piť, odvyká postupne, nie naraz.
   */
  NEREST_NAEX: 2,
  CHUT_UBYTOK: 1,
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
 * Väzni na výhru (v11, Michal 2026-11-02): (lokality + finále) / 2 — Tretia liga 2,
 * Druhá 3, Prvá 4. Do v10 vždy 3.
 */
export function vazniNaVyhru(lokalitCelkom: number): number {
  return Math.max(1, Math.ceil((lokalitCelkom + 1) / 2));
}

/**
 * Verzia pravidiel, ktorú nesie každá archivovaná partia (Michal 2026-10-22) —
 * podľa nej sa dajú oddeliť partie hrané na iných pravidlách. Do zmrazenia v4
 * bola značkou dátum zmeny („2026-10-24.2“); od v4 (Michal 2026-10-24) sa
 * pravidlá menia len v dávkach raz za 2 týždne a celá dávka dostane ďalšie
 * číslo („v5“) spolu s novým dátumom platnosti.
 */
// v8 (Michal 2026-10-28): bodovanie kartami v línii, strach za nové zóny, prebytok
// rozdeľuje porazený, Kultúrny dom „Obaja bodujú“, Cirhóza −3, Exekútor bez prahu (Záhradkár ho obíde), Kmotor presúva Dlhy.
// v8.1 (Michal 2026-10-28, roadmapa #113) bez novej značky — test drží tvar „vN“: Absťák Nervák
// (porovnanie nerestí so súperom, +1 Pohoršenie, bez zrážky špakov).
// v8.2 (Michal 2026-10-30) tiež bez novej značky: akcia Dlh sa volá Hazard, Dlh a Absťák sú
// počítadlá (nie karty, Absťák bez dobratia), posun markera Pohoršením a prebytkom stojí podľa zóny.
// v8.5 (Michal 2026-10-30) bez novej značky: spoločný balíček sa delí na Náradie a Občanov,
// stavba šenku vždy 2 + 6 kariet.
// v9 (Michal 2026-10-30, krok 2 revízie starších): väzeň namiesto patronátu a vydesenia
// (tretí väzeň vyhráva), Kšeft väzňa namiesto efektov starších, bossovia, nové priazne.
// v9.1 (Michal 2026-10-30) bez novej značky — v9 ešte nebola nasadená: Chuť a karta Absťák
// (Nervák zanikol), Nakladačka vo finále → špaky 1 : 1, Zastávka (karta zo šenku po 1. Pitke), Pasca Rana.
// v9.2 (Michal 2026-10-30) bez novej značky — ide s v9.1: šenok začína obranca (1. ťah 1 karta),
// NA EX sa odkrývajú naraz, odpovede na NA EX lícom dole (útočník, potom obranca na druhý kraj).
// v9.3 (Michal 2026-10-31) bez novej značky: Výtržník prebíja Úplatok (Úplatok zrušený vo v10.3).
// v10 (Michal 2026-11-01, docs/napady/hadka.html): Hádka — Povery a Pohoršenie sú mäkké
// poškodenie, víťaz hádky posunie priazne starších k sebe do konca kola (marker sa nehýbe);
// Abstinent odpúšťa Absťáky, nové Telefón, Horoskop (Svätý text ostáva len na tuhé).
// v10.3 (Michal 2026-11-02) bez novej značky: Forsáž (Posilnenie + Posilnenie), Nástroj bez Vzbury
// a Forsáže, Sypač namiesto Kulturistu s Úplatkom (Úplatok zrušený), nová Vdova a Liberál.
// v10.4 (Michal 2026-11-02) bez novej značky: pojem Spáliť, Autority Poľovník, Predavačka a Vedúcko,
// Policajtka s pokutovým blokom (Pitka), Profesionálny tipér ráta aj Forsáž.
// v11 (Michal 2026-11-02, docs/napady/strach-reci.html): Strach a reči — každý hráč má pri staršom
// vlastný strach a reči, priazeň = rozdiel strachov, bodovanie starších po bitke, výhra strachom
// (4 červené), väzni na výhru podľa ligy, krádež pri zajatí; platí v Zrejúcej.
// v11.1 (Michal 2026-11-02, Zrejúca) bez novej značky: Vzbura obráti aktivitu karty — nespojené
// akcie aktívne, spojené neaktívne; Odpor proti Posilneniu = Vzbura karty s Odporom, posilnená;
// na kartu so Vzburou NA EX nejde.
// v11.2 (Michal 2026-11-02, Zrejúca) bez novej značky: Kšeft väzňa zrušený — každý väzeň má
// schopnosť, ktorú držiteľ použije raz za hru (elders.json, engine.ts schopnostiVazna).
// v11.4 (Michal 2026-11-03) bez novej značky: pokus o zajatie zanikol — zajíma sa za 5 bodov
// Nakladačky, za 5 bodov hádky sa starší presvedčí (jeho karta do balíčka presvedčovateľa).
// v11.5 (Michal 2026-11-03) bez novej značky: identita kariet — nové akcie sady a efekty Novín,
// Opatrovateľky, Podvodníka, Anonymného alkoholika, Šoféra, Sypača a Koňa.
// v11.6 (Michal 2026-11-03) bez novej značky: zajať sa dá len staršieho, ktorý sa hráča bojí na
// červenej už pred touto Nakladačkou (od minulého kola) — dotiahnuť a zajať naraz nejde.
// v11.7 (Michal 2026-11-06) bez novej značky: Kostol — NA EX len na poslednú kartu línie (oba konce),
// oltár a otočenie Kostola pre NA EX zanikli.
// v11.9 (Michal 2026-11-06) bez novej značky: dobratie do 3 kariet v ruke, výpalné po bitke.
// v11.10 (Michal 2026-11-06) bez novej značky: priazeň Ohováračka namiesto Alkoholika.
// v11.11 (Michal 2026-11-06) bez novej značky: hádka dáva špaky za svoje karty, víťaz hádky natáča
// ďalšiu lokalitu, reči uberajú zo špakov za strach.
// v11.14 (vo Vypálenej od 2026-11-09) bez novej značky: frakcie bez Kšeftu, Občania v troch
// kategóriách (Preškolenie), Náradie sa podkladá pod kartu, Predavačka a Živnostník berú zo šenku.
// v11.15 (Michal 2026-11-09, Zrejúca) bez novej značky: Benzínka — každé fajčenie o 1 cigaretu lacnejšie.
// v11.16 (Michal 2026-11-09, Zrejúca) bez novej značky: Vypiť len so zostávajúcim limitom, cigarety za pas
// bez ohľadu na karty v ruke, Degustátorka zníži súperov limit hneď, podloženie naprázdno sa ponúka,
// odpoveď na NA EX stojí plný poldeci, Nástroj len pod vlastné karty, Školiteľ aj Zviera (Mäsiar ho umlčí).
// v11.17 (Michal 2026-11-09, Zrejúca) bez novej značky: NA EX × Odpor a Posilnenie — zrušený Odpor pustí
// partnera, neaktívny Odpor NA EX zahasí, neaktívne Posilnenie nedá NA EX zrušiť aktívne akcie.
// v11.18 (Michal 2026-11-09, Zrejúca) bez novej značky: Vedúcko Podporou — Roboty ako Pecky len tvojej karte, s ktorou sa stretne.
// v11.19 (Michal 2026-11-09, Zrejúca) bez novej značky: Dohadzovačka presúva len kartu z konca druhého kraja.
// v11.20 (Michal 2026-11-10, Zrejúca) bez novej značky: hodnota stupňa 1 / 2 / 3 (plný teplomer 6),
// premeny sa reťazia všetky (Školitelia, potom Nástroje, každá na výsledku predošlej).
// v11.21 (Michal 2026-11-10, Zrejúca) bez novej značky: po bitke si každý dobere presne 2 karty, nie do 3;
// hrana posilnenia Nástroja a Forsáž Energeťáka posilnia akcie aktívne po NA EX (neaktívne ×4).
// v12 (Michal 2026-11-11: „Keď to budeš vypaľovať, označ to ako verzia 12“) nová značka: akcie navyše mení celý podložený Nástroj aj Forsáž
// Energeťáka; Traktorista Pecka s prevahou, Pasca Rana za každú priloženú kartu, Výherný automat Dlh v každej
// Pitke, Kapybara Furt Preškolenie susedov, Predavačka karta z ponuky navrch balíčka.
// v12.1 (Michal 2026-11-11: „Zrušiť obe obmedzenia.“) bez novej značky: NA EX aj na kartu s neaktívnym
// Odporom (štít v11.17 ho zahasí) a neaktívny Pakt sa ráta do neaktívnych akcií.
export const VERZIA_PRAVIDIEL = "v12";
/**
 * Presná verzia pravidiel vrátane dávky — hráč ju vidí na stránke Pravidlá, ktorá má
 * vždy odzrkadľovať správanie nasadenej hry (Michal 2026-10-31). Značka partií
 * (VERZIA_PRAVIDIEL) sa pri dávke nemení, táto áno.
 */
export const VERZIA_PRAVIDIEL_PRESNA = "v12.1";
/** Odkedy platí VERZIA_PRAVIDIEL_PRESNA — hráč ho vidí na stránke Pravidlá. */
export const PRAVIDLA_PLATNE_OD = "2026-11-11";
export type DlzkaHry = keyof typeof DLZKY_HRY;
export const ALL_DLZKY: readonly DlzkaHry[] = ["kratka", "stredna", "dlha"];
export const PREDVOLENA_DLZKA: DlzkaHry = "stredna";
/**
 * Ligy (Michal 2026-10-28): hráč vidí dĺžku hry ako ligu — Tretia (3 lokality),
 * Druhá (5), Prvá (7). Interné id, API a databáza ostávajú kratka/stredna/dlha.
 */
export const NAZOV_DLZKY: Readonly<Record<DlzkaHry, string>> = { kratka: "Tretia liga", stredna: "Druhá liga", dlha: "Prvá liga" };
/** Genitív názvu ligy — „Vyhraj 1 partiu Tretej ligy“. */
export const NAZOV_DLZKY_GENITIV: Readonly<Record<DlzkaHry, string>> = { kratka: "Tretej ligy", stredna: "Druhej ligy", dlha: "Prvej ligy" };

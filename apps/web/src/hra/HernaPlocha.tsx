// Herná obrazovka (M8): partia súpera hore, lokalita v strede, vlastná
// partia a ruka dole, starší a šenok bokom, stav hráčov a log. Karty sú
// v tlačovom vzhľade; ich sloty svietia podľa živého vyhodnotenia línie.
//
// Živé zvýraznenie: evaluateLine z @naex/core sa volá na klientskom pohľade
// pri každom prekreslení — hráč okamžite vidí, čo mu na spoji chytilo.
//
// Karty sa kladú ťahaním (useTahanie) alebo klikom na miesto na konci strany
// a potom na kartu v ruke. Pravý klik všade odstraňuje: vráti kartu z návrhu,
// zruší výber. Položená karta je najprv len NÁVRH
// v tomto prehliadači: dá sa presunúť, vrátiť alebo nahradiť inou a živé
// vyhodnotenie ho už ráta. Na server ide príkaz až po „potvrdiť“ na stole — v
// Zhromaždení celý ťah naraz (Michal 2026-10-19): každá ďalšia karta v tom
// istom ťahu stojí plný poldeci a rozhranie to výrazne ukazuje.

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent as ReactFocusEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import type {
  BitkaNaNastenke,
  CardInstance,
  CielVykladania,
  ClientState,
  Command,
  ElderState,
  Event,
  Favour,
  GameData,
  LineEval,
  LokalitaVHistorii,
  PlacedCard,
  PlayerId,
  PocitadloBitky as Pocitadlo,
  RekapitulaciaBitky,
  RekapitulaciaPitky,
  VerejnyStav,
  ZobrataVerejne,
  Zdvih,
} from "@naex/core";
import { prveFajcenieZadarmo, opisReci, sRadom, odhadSpakovKola, type StavOdhadu, riadkyCakajuceho, riadkyCakajucichPoldeci, KONSTANTY, jeCoTahat, jeFinaleNaNastenke, cigaretyZaPas, efektyPrehry, hrozbaKliatob, mozeEsteNaex, textHrozbyKliatob, textyEfektovPrehry, cenaKliatby, battleOutcome, prebytokNaRozdelenie, nahladPitky, vyhladDlhov, evaluateLine, efektyNavyse, pocitadloBitky, pitkaPredBitkou, hrozbaNaex, krokStavby, planVykladania, barterCena, limitBuduceKolo, limitZhromazdenia, lineState, nahladZajatia, prevahaStran, krajeStran, dovodZakazuFajcit, defOf, jednotaZakazuje, ponukaSenku, cenaFajceniaHraca, naexLimitMinuty as naexLimitMinutyHraca, sMojimiSkrytymiNaex, sPrilozenou, vystrahaPecene, nahladNaexNaKartu, najhorsiaOdpovedNaNaex, cenaTahu, nahladVylozenia, moznostiNaexVPohlade, zablokovaneStrany, NASTROJ_DO_LINIE, favourStarsieho, krokRozdelenia, cieleOdpovede, maxZoSenku, bodyRozdelenia, printedSides, poskodenieBitky, rozpisPoskodenia, prahyHraca, scorecardStarsieho, stavKraja, stavkaBitky, stavZavislosti, stranyLokality, vidiVolbuSupera, hraVPitke, cakaSBzdochou, opponentOf, majitelPresvedcenej, moznostiAkcie, cenaAkcieUplna, zdvihyPreAkcie, navrhRozdelenia, pohladPoRozdeleni, priazenHraca, priazenSila, pultStarsich, spakyTeraz, NAZVY_ZON, vazniNaVyhru } from "@naex/core";
import type { Moment, ActionSums, DopadyNahladu, KliatbyNahladu, NahladNaexNaKartu, PrebytokNahladu, NahladVylozenia, PolozkaVykladania, Rod, Slot, StranaLinie, VystrahaPecene } from "@naex/core";
import type { KtoraHrana, MoznostPodlozenia, PodlozenyNastroj } from "@naex/core";
import { aktivnaHrana, dovodNepodlozenia, hranyNastroja, ponukaPodlozenia, ucinkyNastrojov } from "@naex/core";
import { sDlhmiPoradkyne } from "@naex/core";
import { IkonaAkcie } from "../karta/IkonaAkcie.tsx";
import { PodlozeneNastroje, smerPretrcania, vyskaHranyPod } from "./PodlozeneNastroje.tsx";
import { vzhladSady } from "../lib/sada.tsx";
import { KoniecHry } from "./KoniecHry.tsx";
import { JAMKY_RUKY, jamkyLinie, type KartaNaKraji } from "./jamkyLinie.ts";
import { IkonaPriazne, riadokPriazneLogu } from "./IkonaPriazne.tsx";
import { cenaPola, NAZOV_DELENIA, rodStarsieho } from "./textyStarsich.ts";
import { IkonaDelenia, LiniaStarsich, type AkciaStarsieho, type MiestoVLinii, type RezimLinie, type RozdelenieStarsieho, type StarsiVLinii, type SuhrnNaLinii } from "./LiniaStarsich.tsx";
import { klikNaStupen, radStarsich, stupneRozdelenia, suhrnRozdelenia, zdvihStarsieho } from "./teplomery.ts";
import { PilulkaPriazne } from "./KruzokPriazne.tsx";
import { NAZOV_PRIAZNE, favourPodlaId, kratkeMeno, pocetPriazniKola, priazenKola, reciZHadky, type PriazneBitky } from "./priazenKola.ts";
import { LetiacaKarta, type Obdlznik, type Prelet } from "./LetiacaKarta.tsx";
import { radSenku } from "./tieneSenku.ts";
import { PocitadloSLiniou } from "./PocitadloBitky.tsx";
import { vyhraStrachomBitky } from "./vyhraStrachom.ts";
import { RekapitulaciaPitkyVrstva, type OdpovedNaNaex, type PiktogramyRekapitulacie } from "./Rekapitulacia.tsx";
import { mediaUrl } from "../lib/api.ts";
import { useStolVHlavicke, useStrazOdchodu } from "../lib/odchod.ts";
import { HlavickaPartie } from "./HlavickaPartie.tsx";
import { GaleriaKariet, type SekciaKariet } from "./GaleriaKariet.tsx";
import { SkratkyNapoveda, escVratiNavrh, tlacidloNavratu, useSkratky, type VrstvyPreEsc } from "./skratky.tsx";
import type { RezimStran } from "./bar.ts";
import { KARTA_MIN as NASTENKA_KARTA_MIN, rozmerNastenky, type ListokNaVyber } from "./rozlozenieNastenky.ts";
import { prepniVyber, rozdelenieStavby } from "./stavbaSenku.ts";
import { JednotnyBar, type StranaBaru } from "./JednotnyBar.tsx";
import { polozkySoZaverecnou, tahSoZaverecnou } from "./zaverecnaTahu.ts";
import { kartaVyucbyDoOblasti, polozkyOdkazu, tahOdkazu } from "./odkazTahu.ts";
import { klucPrechodu, krokNaStarsich, medziobrazovka, starsiNaStole, tahNaStole, type KrokNaStarsich } from "./prechodFazy.ts";
import { peciatkyKrokov, textPeciatkyKroku, type PeciatkaKroku } from "./peciatkyKrokov.ts";
import { Medziobrazovka } from "./Medziobrazovka.tsx";
import { SuhrnLokality } from "./SuhrnLokality.tsx";
import { dalsiPohladSuhrnu, type KontextSuhrnu, type SuhrnBitky, type ZaciatokKola } from "./krokySuhrnu.ts";
import { PAUZA_CIELA_MS, pauzaPoVolbeCiela, type PauzaCiela } from "./pauzaCiela.ts";
import { poslednaPitkaVDavke, stolZastavenia } from "./zastaveniePitky.ts";
import { lokalitaVStrede, lokalitaZNavrhu, natacamNavrh, tipNavrhuLokality } from "./natocenieNavrhu.ts";
import { naexNaKarte, PeciatkaNaex, type NaexNaKarte, type StavNaKarte } from "./PeciatkaNaex.tsx";
import { farbaKarty, type Sada } from "@naex/tvorba";
import { HernaKarta, ZarStolaKontext, vzhladKarty, type HernaKartaProps } from "./HernaKarta.tsx";
import { useZarovnanieLinie } from "./zarovnanieLinie.ts";
import { Lupa, maxMierkaLupy } from "./Lupa.tsx";
import { LUPA_PREDVOLENA, useUcet } from "../lib/ucet.tsx";
import { rezimRadov } from "./spakyAStarsi.ts";
import { Vrstva as VrstvaPanel } from "./Vrstva.tsx";
import { VesticaVyber } from "./Vestica.tsx";
import { rozmerVizie, ViziaNaStole, VolbyVizie, zamerVizie, type KartaVizie } from "./ViziaNaStole.tsx";
import {
  AkcieStrany,
  BitkaPanel,
  CenaCigariet,
  CenaPoldeci,
  Vymena,
  HracDoska,
  IkonaKarty,
  IkonaPoldeci,
  OdhadBaru,
  OdhadKola,
  PriebehKola,
  tipOdhadu,
  type BitkaPanelProps,
  type PriazenVOdhade,
  type HrozbaBitky,
  type KartyDlazdica,
  type VyhladPitky,
} from "./Panely.tsx";
import { KseftPodKartou } from "./KseftPodKartou.tsx";
import { IkonaMrezi } from "./ikonyZdrojov.tsx";
import { kseftyNaStole } from "./kseftyNaStole.ts";
import { moznostiVily } from "./volbaVily.ts";
import { cieleSuperovhoNaex, vystrahaCela, vystrahaKratko } from "./vystrahyStola.ts";
import { StavkaBitky } from "./StavkaBitky.tsx";
import { UCINOK_KRATKO, UCINOK_PRIAZNE } from "./Scorecard.tsx";
import type { HracInfo, SuhrnAchievementov, ZmenyFrajeriny } from "./useHra.ts";
import { menoVoVete, rodHraca, textHlasky } from "./useHra.ts";
import { NAHRADIT, textNepolozenejKarty } from "./nepolozenaKarta.ts";
import { useBezNaexVBitke, useOdlozenyPrikaz } from "./usePohodlie.ts";
import { useTahanie, type Tahanie } from "./useTahanie.ts";
import { NapovedaPodrzania, OknoZdroja, StlpecHraca, Tabula } from "./PultHraca.tsx";
import { usePrisunZdroja, type PrisunDlazdice } from "./PeciatkaZdroja.tsx";
import { cislaHraca, poldeciNaStole, type ZdrojStlpca } from "./tabula.ts";
import { preDotykUzol } from "./dotyk.ts";
import { Avatar } from "../komponenty.tsx";
import { TlacidloCelejObrazovky, useCelaObrazovka } from "./CelaObrazovka.tsx";
import { PruhPokynu } from "./PruhPokynu.tsx";
import { useVypinacNapoved } from "./Napovedy.tsx";
import "./hra.css";
import "./mobil-sirka.css";
// Až po hra.css — jednotný bar upravuje aj jej pravidlá (os kola, nástroje, rezerva stola).
import "./jbar.css";
import { IkonaSpaku, Nastenka, sMinusom, spakyPredBitkou, textSpakovBitky } from "./Spaky.tsx";
import { nazovKarty, prekladKariet, prelozHlasku, t, tr, tRod, tZoServera } from "../i18n/jazyk.tsx";
import { spakov } from "../i18n/pocty.ts";

/** Kľúč v localStorage: rozloženie línie starších (Teplomery alebo Pult). */
export const ULOZENY_REZIM_LINIE = "naex-linia-starsich";

/**
 * Čo sa ťahá. `navrh` = karta už leží na stole, ale len ako nepotvrdený návrh.
 * „stavba“ = karta z môjho balíčka stavby šenku (aj keď už leží v zóne).
 */
interface Zdroj {
  readonly karta: CardInstance;
  readonly odkial: "ruka" | "senok" | "lokality" | "stavba";
  readonly navrh: boolean;
}

/** Nepotvrdený ťah — žije len v klientovi, server o ňom nevie. */
type Navrh =
  // Vyloženia z ruky v jednom ťahu: v Zhromaždení aj viac kariet (každá ďalšia
  // za plný poldeci, Michal 2026-10-19), v odpovedi na NA EX jedna.
  | { readonly typ: "vylozenia"; readonly polozky: readonly { readonly uid: number; readonly ciel: CielVykladania }[] }
  // otocena je v ráme hráča 0, presne ako v príkaze chooseLocation.
  | { readonly typ: "lokalita"; readonly uid: number; readonly otocena: boolean }
  // Draft: karty zo šenku presunuté do ruky.
  | { readonly typ: "zoSenku"; readonly uids: readonly number[] }
  // Náradie (Michal 2026-11-08, mock 2): Nástroj zasunutý pod hostiteľa, kým hráč neotočí hranu a nepotvrdí.
  | { readonly typ: "podlozenie"; readonly nastroj: number; readonly hostitel: number; readonly hrana: KtoraHrana };

const CIELE_VYKLADANIA: readonly string[] = ["vlastna", "superova", "priznanie", "dedicstvo"] satisfies CielVykladania[];
const jeCielVykladania = (c: string): c is CielVykladania => CIELE_VYKLADANIA.includes(c);

// Gettery: popis sa číta v jazyku hráča pri vykreslení.
const POPIS_CIELA: Record<CielVykladania, string> = {
  get vlastna() {
    return t("rekapText.naKoniecVlavo");
  },
  get superova() {
    return t("plocha.cielSuperova");
  },
  get priznanie() {
    return t("plocha.cielPriznanie");
  },
  get dedicstvo() {
    return t("plocha.cielDedicstvo");
  },
};

/** Cieľ pri preusporiadaní ruky: karta, pred/za ktorú ťahaná karta pôjde. */
/** Ako dlho sa na stole otáča odhalená Záverečná, kým príde rekapitulácia Pitky (Michal 2026-10-27). */
const ODHALENIE_MS = 2200;
const PORADIE = "poradie:";
/** Cieľ ťahania: karta v línii, pod ktorú sa Nástroj zasunie (Náradie 2026-11-08). */
const PODLOZIT = "podlozit:";

/** Pokyn voľby karty zo šenku podľa karty, ktorá ju dala (Zastávka nemá zdroj). */
function textVolbySenku(zdroj: string | undefined): string {
  if (zdroj === "predavacka") return t("plocha.volbaPredavacka");
  if (zdroj === "zivnostnik") return t("plocha.volbaZivnostnik");
  return t("plocha.volbaSenku");
}

/**
 * Čo netreba mať na stole stále — otvára sa ako vrstva cez obrazovku.
 * „vestica“ ukazuje doberacie balíčky, ktoré hráčovi podľa karty odhalil server.
 */
type Vrstva = "senok" | "lokality" | "log" | "vestica" | "karty" | "pivnica";
/** Sekcia, pri ktorej sa otvorí vrstva Karty (Michal 2026-10-23, #76) — súper ukazuje len Priznané a Dedičstvo. */
type ZalozkaKariet = SekciaKariet;

/**
 * Pokyn ťahu (Michal 2026-10-21): nadpis a text sú v pilulke na hornej hrane
 * stola, tlačidlá na jeho spodnej hrane — `vlavo` nákupy za cigarety, `stred`
 * pečiatka NA EX! či potvrdenie ťahu (pecatTahu, Michal 2026-10-25), `vpravo`
 * (a všeobecné `tlacidla`) koniec ťahu a vedľajšie voľby.
 */
interface Pokyn {
  readonly nadpis: ReactNode;
  /** Bublina jedným písmom a jednou veľkosťou (rozdeľovanie, mock C · Pečať). */
  readonly jednotny?: boolean;
  readonly text?: ReactNode;
  /** Ovládač v riadku pokynu vedľa textu — text sa skracuje trojbodkou, ovládač nesmie (počítač, telefón ho má v texte). */
  readonly odkaz?: ReactNode;
  readonly tlacidla?: ReactNode;
  readonly vlavo?: ReactNode;
  readonly stred?: ReactNode;
  readonly vpravo?: ReactNode;
  /** Telefón: druhá voľba binárneho rozhodnutia — tmavý segment vedľa hlavnej akcie, nie v ▾. */
  readonly druha?: ReactNode;
  /** Telefón: potvrdenie či varovanie — pruh ukáže celé znenie pod sebou, nie orezané trojbodkou. */
  readonly naliehavy?: boolean;
}
/** Hrana stola pre ťah s návrhom: pečiatka v strede, vedľajšie voľby vľavo či vpravo. */
interface HranaTahu {
  readonly stred: ReactNode;
  readonly vlavo?: ReactNode;
  readonly vpravo?: ReactNode;
  readonly druha?: ReactNode;
}
/** Podržanie prsta, po ktorom sa karta v ruke zväčší (telefón na šírku). */
const DLHY_TUK_MS = 450;
/** Ako dlho sa stôl po prechode fázy ustáli, kým príde medziobrazovka. */
const MEDZIOBRAZOVKA_MS = 400;
/** Ako dlho ostane toast na stole (výsledok bitky; ohlásené vydesenie o 3 s dlhšie). */
const TOAST_STOLA_MS = 7000;
/** Malá pečiatka pasu či konca brania zo šenku — dopad a chvíľa na prečítanie, potom zmizne sama. */
const PECIATKA_KROKU_MS = 2000;
/** Súperov pas, ktorý urobila hra, ostane dlhšie — hráč má pochopiť, prečo súper vykladá sám. */
const PECIATKA_AUTO_PASU_MS = 3500;

/** Šírka karty v ruke — nastavuje aj --ruka-w v hra.css (na mobile menšia). */
const SIRKA_V_RUKE = 120;
const SIRKA_V_RUKE_MOBIL = 72;
/** Telefón na šírku: výška pásu ruky ako zlomok výšky okna — spodok patrí len ruke (Michal 2026-10-31). */
const RUKA_NA_SIRKU = 0.25;
/** Telefón na šírku: toľko kariet leží v ruke vedľa seba bez prekrývania. */
const KARIET_V_RUKE_NA_SIRKU = 8;
/** Telefón na šírku: najmenšia karta v línii — stôl sa tam nikdy neposúva, karta sa radšej zmenší. */
const SIRKA_NA_SIRKU_MIN = 36;
/** Telefón na šírku: pri dlhej línii smie karta klesnúť aj pod SIRKA_NA_SIRKU_MIN — prečíta sa podržaním. */
const SIRKA_NA_SIRKU_MIN_LINIA = 26;
/** Telefón na šírku s lištou prehliadača: pod touto výškou okna sa nástenka pri voľbe cieľa zhustí. */
const NIZKY_TELEFON = 360;
/** Výška popolníkov nad lístkami nástenky (rozlozenieNastenky: 60 px pri --nk = 1). */
const POPOLNIKY_NASTENKY = 60;
/** Pod touto šírkou okna je rozloženie mobilné. */
const MOBIL = 760;
/** Výšky okna, pod ktorými sa stôl zhustí — rovnaké hranice má hra.css (@media max-height). */
const NOTEBOOK = 920;
const NIZKE_OKNO = 720;
/** Partia je stredobod hry — karty 1,5× väčšie než pôvodných 132 px. */
const SIRKA_V_LINII = 198;
/** Dlhá línia sa zmenší na šírku stola, ale nie pod túto šírku karty. */
const SIRKA_V_LINII_MIN = 96;
/**
 * Najmenšia čitateľná karta v línii. Bežné rozlíšenia ju neprekročia (1366 × 650 so
 * 7 kartami ≈ 84 px, 1440 × 800 so zoomom 125 % ≈ 79 px); menšie okno či zoom 150 %
 * prepne stôl na scroll (Michal 2026-10-24).
 */
const SIRKA_CITATELNA = 72;
/** Ako dlho musí karta ostať pod SIRKA_CITATELNA, kým stôl prejde na scroll. */
const ONESKORENIE_SCROLLU_MS = 200;
/** Miesto na klik na konci strany — zlomok šírky karty v línii. */
const MIESTO_VOLBY = 0.42;
/** Výška pod kartami v línii pre štítok Kšeftu (Michal 2026-11-02: celú kartu musí byť vidno). */
const REZERVA_KSEFTU = 30;
/** Karty v okne Pivnica — veľké a čitateľné (na telefóne menšie). */
const SIRKA_PIVNICE = 210;
const SIRKA_PIVNICE_NA_SIRKU = 120;
/** Výška okna mimo karty v Pivnici (lišta, hlavička okna, pravidlo, poradie a tlačidlo schopnosti). */
const PIVNICA_OKREM_KARTY = 430;
/** Karty v šenku a lokalitách — väčšie než kedysi v bočnom paneli. */
const SIRKA_VO_VRSTVE = 150;
/** Výška / šírka karty (54 × 80 mm) — výška línie určuje veľkosť kariet (Stôl bez scrollovania, #67). */
const POMER_KARTY = 80 / 54;
/** Náhradné uid tieňov vzatých kariet šenku (UID_TIENA − miesto) — mimo uid kariet aj Záverečnej. */
const UID_TIENA = -800000;
/** Čo línia zaberá okrem kariet: okraj, popisy strán, rezerva posuvníka. */
const PRIDAVOK_LINIE = 74;
/** To isté na nízkom okne (NOTEBOOK): jeden tenký riadok nadpisov, menšie okraje (hra.css). */
const PRIDAVOK_NOTEBOOK = 38;
/** Pod NIZKE_OKNO: spodný okraj línie leží pod hranou stola (hra.css). */
const PRIDAVOK_NIZKE = 28;
/** Režim Päta, Lakeť, Otočka: výška dvoch pásov starších nad a pod líniou; pod NOTEBOOK sú v jednom riadku (pata.css). */
const REZERVA_RADOV = 130;
const REZERVA_RADOV_NOTEBOOK = 92;
/** Najmenší posun kariet akcia ku akcii (zlomok výšky karty), kým ho línia nezmeria. */
const REZERVA_POSUNU = 0.3;

/** Pravý klik = odstrániť / zrušiť (Michal 2026-10-20) — bez kontextovej ponuky prehliadača. */
function pravyKlik(fn: (() => void) | undefined): ((e: React.MouseEvent) => void) | undefined {
  return fn === undefined
    ? undefined
    : (e) => {
        e.preventDefault();
        e.stopPropagation();
        fn();
      };
}

/** Dĺžka doznievania lupy po odchode myši — rovnaká ako animácia .lupa.doznieva v hra.css. */
const DOZNIEVANIE_LUPY_MS = 160;
/** Ako dlho ostane hláška „karta sa nepoložila“ — stačí na prečítanie, potom nezavadzia. */
const ZOBRAZENIE_CHYBY_TAHANIA_MS = 6000;
/**
 * Kam s hláškou „karta sa nepoložila“ (w × h): k bodu pustenia — nad, pod, vedľa,
 * alebo do rohu plste —, kde najmenej zakryje ciele ťahu, lokalitu, pečiatky
 * a bary (UI inšpekcia 2026-10-24: nad bodom pod líniou zakryla líniu aj „+“).
 * Pri rovnakom skóre bližšie k bodu. Nad plsť nie — tam je pokyn a pás kola.
 */
function polohaChybyTahania(bod: { readonly x: number; readonly y: number }, w: number, h: number): { readonly x: number; readonly y: number } {
  const plst = document.querySelector(".stol-plst")?.getBoundingClientRect();
  // Pilulka pokynu presahuje na hornú hranu plste.
  const hore = Math.max(8, (plst?.top ?? 0) + 8);
  const dole = Math.max(hore, window.innerHeight - 8 - h);
  const vpravo = Math.max(16, window.innerWidth - 16 - w);
  const medzera = 14;
  const kandidati = [
    [bod.x - w / 2, bod.y - h - medzera],
    [bod.x - w / 2, bod.y + medzera],
    [bod.x - w - medzera, bod.y - h / 2],
    [bod.x + medzera, bod.y - h / 2],
    ...(plst === undefined
      ? []
      : [
          [plst.left + 8, plst.top + 8],
          [plst.right - 8 - w, plst.top + 8],
          [plst.left + 8, plst.bottom - 8 - h],
          [plst.right - 8 - w, plst.bottom - 8 - h],
        ]),
  ].map(([x = 0, y = 0]) => ({ x: Math.min(Math.max(x, 16), vpravo), y: Math.min(Math.max(y, hore), dole) }));
  const vahy: readonly (readonly [string, number])[] = [
    [".linia .kl, .miesto-volby, .linia-skupina.lokalita, .stol-hrana .pecat, .stol-hrana button, [data-vyucba-bublina]", 10],
    [".doska, .linia-stav, .jbar", 3],
    [".ruka .kl", 1],
  ];
  const prekazky = vahy.map(([sel, vaha]) => ({ vaha, r: [...document.querySelectorAll(sel)].map((e) => e.getBoundingClientRect()) }));
  const skore = (p: { readonly x: number; readonly y: number }): number =>
    prekazky.reduce(
      (s, { vaha, r }) =>
        s + vaha * r.reduce((t, b) => t + Math.max(0, Math.min(p.x + w, b.right) - Math.max(p.x, b.left)) * Math.max(0, Math.min(p.y + h, b.bottom) - Math.max(p.y, b.top)), 0),
      0,
    ) + Math.hypot(p.x + w / 2 - bod.x, p.y + h / 2 - bod.y);
  return kandidati.reduce((naj, p) => (skore(p) < skore(naj) ? p : naj));
}

function kariet(n: number): string {
  return t("stol.kariet", { n });
}

/** Podmet so slovesom — „zvyšné 4 karty pôjdu“, „zvyšných 5 kariet pôjde“. */
function zvysnePojdu(n: number): string {
  return t("stol.zvysnePojdu", { n });
}

function cigariet(n: number): string {
  return t("stol.cigariet", { n });
}

/** Prvé písmeno veľkým — na začiatok vety v každom jazyku. */
const velkym = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

type Mode =
  | { typ: "ziadny" }
  // NA EX na dva kroky (dizajn hra-nezrovnalosti-20261021-1229, UX N3): vyber kartu, potom potvrď.
  | { typ: "naexCiel"; uid: number | null }

  // Veštica: po jednej karte z oboch doberacích balíčkov.
  | { typ: "vestica"; moja: number | null; jeho: number | null };

/**
 * Kraje lokality v jazyku hráča: preklad podľa id karty (ľavý, pravý), otočená lokalita ich
 * vymení ako krajeStran. Bez prekladu ostávajú slovenské z jadra.
 */
function prelozKraje(sk: [string | null, string | null], defId: string | null, otocena: boolean): [string | null, string | null] {
  const p = defId === null || sk[0] === null || sk[1] === null ? undefined : prekladKariet().kraje.get(defId);
  if (p === undefined) return sk;
  return otocena ? [p[1], p[0]] : [p[0], p[1]];
}

// Hra beží na sade svojej miestnosti; pomocné funkcie nižšie ju čítajú odtiaľto.
let DATA: GameData;

/** Meno karty na zobrazenie — v jazyku hráča, ak ho preklad kariet má. */
function menoKarty(defId: string): string {
  return nazovKarty(DATA.cards.get(defId)?.name ?? defId);
}

export interface HernaPlochaProps {
  readonly view: ClientState;
  readonly data: GameData;
  readonly sada: Sada;
  readonly hraci: readonly [HracInfo | null, HracInfo | null];
  readonly log: readonly string[];
  /** Udalosti poslednej správy so stavom — účet Pitky a bitky. */
  readonly udalosti?: { readonly id: number; readonly events: readonly Event[] };
  /** História odohraných lokalít zo servera — súhrn lokality po kliku na nástenke. */
  readonly lokality?: readonly LokalitaVHistorii[];
  readonly chyba: string | null;
  readonly zrusChybu?: () => void;
  readonly superPripojeny: boolean;
  /** Odkedy je súper odpojený (useHra) — odpočet kontumácie v menu Partia. */
  readonly superOdpojenyOd?: number | null;
  readonly kod: string;
  readonly cmd: (c: Command) => void;
  readonly opustit: () => void;
  /** Zmena Frajeriny po dohraní (príde zo servera po zápise do archívu). */
  readonly frajerina?: ZmenyFrajeriny | null;
  /** Achievementy z partie (súhrn po konci) — okno konca ich ukáže. */
  readonly achievementy?: SuhrnAchievementov | null;
  readonly kontumacia?: () => void;
  /** Ovládanie navyše v hlavičke webu pred menom súpera (soundboard Melichara). */
  readonly vHlavicke?: ReactNode;
  /** Režim Päta, Lakeť, Otočka: rady starších nad a pod líniou. */
  readonly nadLiniou?: ReactNode;
  readonly podLiniou?: ReactNode;
  /** Režim Päta, Lakeť, Otočka: starší v paneli hráča. */
  readonly portretyStarsich?: ((p: PlayerId) => ReactNode) | undefined;
  /** Režim Päta, Lakeť, Otočka: krok, ktorý na chvíľu prekryje celú plsť (skladanie radu). */
  readonly naPlsti?: ReactNode;
  /** Prehrávač dohratej partie (roadmapa #18): ovládanie krokov nahradí v hlavičke spojenie, vzdanie a odchod. */
  readonly prehravanie?: ReactNode;
  /** Počítadlo bitky beží / skončilo — pečiatka momentu z bitky (Momenty) počká na jeho koniec. */
  readonly onPocitadlo?: (bezi: boolean) => void;
  /** Ukážka stola: začiatok predošlého kola — súhrn po bitke sa ukáže hneď po načítaní (snímky). */
  readonly ukazkaSuhrnu?: ZaciatokKola | undefined;
  /** Výučba „Prvá hra“: okno konca partie neukazovať — záver povie Melichar v bubline. */
  readonly bezOknaKonca?: boolean;
  /** Výučba „Prvá hra“ beží — pas bez odpočtu na vrátenie, „končím“ bez druhého potvrdenia. */
  readonly vyucba?: boolean;
  /**
   * Výučba: id kroku, ktorý po ťahu čaká na „ďalej“ s textom Melichara. Bitka, ktorú jeho ťah
   * spustil, sa prehrá až po zmene kroku — inak bežala pod textom, ktorý sa nedal prečítať (U3).
   */
  readonly zadrzBitku?: string | null;
  /** Výučba: ťah, ktorý krok čaká — „potvrdiť“ sa odomkne, až keď na stole leží všetko z neho. */
  readonly vyucbaOcakava?: Command | null;
  /** Výučba: ťah hráča teraz spraví hra (krok „auto“) — stôl nevyzýva hráča a nereaguje na neho. */
  readonly zaHracaHra?: boolean;
  /**
   * Výučba: hráč si stavbu šenku len skúša (Michal 2026-10-25) — karty smie presúvať, no
   * potvrdiť nie je; rozloženie spraví Melichar v ďalšom kroku.
   */
  readonly naneisto?: boolean;
  /**
   * Výučba: kroky po bitke hovoria o starších a stupnici, hoci partia je už pri voľbe cieľa
   * 2. kola — línia starších ostane na stole (bar bežný, nie bodový) namiesto výberu lokality.
   */
  readonly ukazStarsich?: boolean;
  /**
   * Telefón na šírku (Michal 2026-10-31; od 2026-11-01 hráč od ranku Poldeci): rozloženie „Pult“
   * (mobil-sirka.css) — hlavička webu preč, hráči v úzkych stĺpcoch po stranách, v strede pokyn,
   * plsť a dok s rukou; karta sa kladie ťukom.
   */
  readonly naSirku?: boolean;
}

/** Názvy fáz pre titulok karty prehliadača (kľúče slovníka faza.*). */
const NAZOV_FAZY: Readonly<Record<string, string>> = {
  volbaCiela: "faza.volbaCiela",
  natocenieCiela: "faza.natocenieCiela",
  draft: "faza.draft",
  zhromazdenie: "faza.zhromazdenie",
  pitka: "faza.pitka",
  bitka: "faza.bitka",
};

/** Účet Pitky — čo vyhodnotenie pripísalo (udalosť pitkaVysledok). */
interface UcetPitky {
  readonly kolo: number;
  readonly pitka: number;
  readonly cirhozy: readonly [number, number];
  readonly dlhy: readonly [number, number];
  readonly cigarety: readonly [number, number];
}

/** Vrstva po vyhodnotení: zastavenie po poslednej Pitke, rekapitulácia Pitky, alebo Počítadlo bitky s rekapituláciou. */
type VrstvaVyhodnotenia =
  | {
      /** Stôl po poslednej Pitke kola bez prekrytia — Ďalej a Preskočiť na hrane (zastaveniePitky.ts). */
      readonly druh: "stol";
      readonly pitka: number;
    }
  | {
      readonly druh: "pitka";
      readonly r: RekapitulaciaPitky;
      readonly nadpis: string;
      readonly odpovede: readonly OdpovedNaNaex[];
      readonly momenty?: readonly Moment[];
      /** Tuhé bitky pred Pitkou a po nej — telefón ukáže, čo Pitka (NA EX) spravila so skóre. */
      readonly skore?: { readonly pred: readonly [number, number]; readonly po: readonly [number, number] } | null;
    }
  | {
      readonly druh: "bitka";
      readonly p: Pocitadlo;
      readonly stol: ClientState;
      readonly linia: LineEval;
      readonly rekap: RekapitulaciaBitky | null;
      readonly odpovede: readonly OdpovedNaNaex[];
      /** Pečiatky momentov z tej istej dávky udalostí — telefón ich ukáže v pruhu súhrnu, nie cez obsah. */
      readonly momenty?: readonly Moment[];
    };

/** Účet bitky — výsledok, lokality, posuny markerov a body pred a po. */
interface UcetBitky {
  readonly kolo: number;
  readonly lokalita: string;
  readonly tuhe: readonly [number, number];
  readonly vitaz: PlayerId | null;
  readonly prebytok: number;
  readonly prebytokNaRozdelenie: number;
  readonly prebytokDrzi: PlayerId | null;
  /** Záznam bitky na nástenke (v6): špaky za bitku, za starších, Exekútor, sekera. */
  readonly bitka: BitkaNaNastenke | null;
  readonly posuny: readonly { readonly meno: string; readonly pred: number; readonly po: number }[];
  /** Špaky v popolníkoch pred bitkou. */
  readonly spakyPred: readonly [number, number];
}

export function HernaPlocha({
  view: viewZoServera,
  data,
  sada,
  hraci,
  log,
  udalosti,
  lokality = [],
  chyba,
  zrusChybu,
  superPripojeny,
  superOdpojenyOd = null,
  kod,
  cmd,
  opustit,
  frajerina = null,
  achievementy = null,
  kontumacia,
  vHlavicke,
  nadLiniou,
  podLiniou,
  portretyStarsich,
  naPlsti,
  prehravanie,
  onPocitadlo,
  ukazkaSuhrnu,
  bezOknaKonca,
  vyucbaOcakava,
  vyucba,
  zadrzBitku = null,
  zaHracaHra = false,
  naneisto = false,
  ukazStarsich = false,
  naSirku = false,
}: HernaPlochaProps) {
  DATA = data;
  // Odložené zobrazenie (Michal 2026-10-27): kým hráč pozerá odhalenú Záverečnú a rekapituláciu
  // Pitky, súperov ďalší ťah (napr. nová Záverečná na tú istú stranu) sa nekreslí — server ho
  // už odohral, stôl ho ukáže až po Ďalej.
  const [zadrzanyView, setZadrzanyView] = useState<ClientState | null>(null);
  const view = zadrzanyView ?? viewZoServera;
  const ja = view.ja;
  // Bot je vo vete „Bot Božena“; tvary podľa rodu hráča (Michal 2026-10-22).
  const menoHraca = (p: PlayerId): string => menoVoVete(hraci[p], p);
  const rodHracaP = (p: PlayerId): Rod => rodHraca(hraci[p]);
  const karta = (props: Omit<HernaKartaProps, "sada" | "data"> & { readonly key?: number }) => {
    const { key, ...rest } = props;
    return <HernaKarta key={key} sada={sada} data={data} {...rest} />;
  };
  // Žeravé ikony (Michal 2026-10-30): karty v ruke a línii vedia, čo ich majiteľovi posilňuje Dedičstvo.
  const videneZaru = useRef(new Map<string, number>()).current;
  // Pečate Nástrojov v Dedičstve (Pasca, Výherný automat — skryté akcie 2026-11-08) z tej istej línie ako server.
  const zarStola = useMemo(() => {
    const sPecatou = view.hraci.some((h) => h.dedicstvo.some((k) => efektyNavyse(defOf(data, k)).some((e) => e.dedicstvo === true)));
    const navyseDedicstva = sPecatou ? evaluateLine(data, lineState(view)).navyseDedicstva : undefined;
    return { view, videne: videneZaru, ...(navyseDedicstva === undefined ? {} : { navyseDedicstva }) };
  }, [view, videneZaru, data]);
  const super_ = opponentOf(ja);
  const [mode, setMode] = useState<Mode>({ typ: "ziadny" });
  const [vrstva, setVrstva] = useState<Vrstva | null>(null);
  /** Kolo odohranej lokality, ktorej súhrn (Pitky a bitka) je otvorený po kliku na nástenke. */
  const [suhrnLokality, setSuhrnLokality] = useState<number | null>(null);
  // Čí popolník nástenka zvýrazní (Michal 2026-10-27): Špaky súpera otvoria jeho, hlavička tvoju.
  const [nastenkaPre, setNastenkaPre] = useState<PlayerId>(ja);
  useEffect(() => {
    if (vrstva !== "lokality") setNastenkaPre(ja);
  }, [vrstva, ja]);
  /** Kedy sme naposledy automaticky otvorili vrstvu — raz za fázu, nie pri každom prekreslení. */
  const autoVrstva = useRef("");
  // Obrazovka konca hry sa dá zavrieť a pozrieť si stôl.
  const [koniecZavrety, setKoniecZavrety] = useState(false);
  // Koľko riadkov logu hráč už videl — zvyšok svieti ako nové na tlačidle.
  const [videnyLog, setVidenyLog] = useState(() => log.length);
  useEffect(() => {
    if (vrstva === "log") setVidenyLog(log.length);
  }, [vrstva, log.length]);
  // Stavbu šenku hrajú obaja naraz — „môžem hrať“ nie je vždy „som na ťahu“.
  // Ťah, ktorý vo výučbe spraví hra za hráča, nie je hráčov — inak stavba šenku vyzývala
  // „Vyber 4 karty na Smetisko“ s POTVRDIŤ, kým hra stavala (playtest výučby 20261025, krok 6).
  const somNaTahu = view.mozemHrat && !zaHracaHra;
  const draft = view.draftStav;
  const stavim = view.faza === "draft" && draft?.krok === "stavba";
  // Živý odhad záverečného bodovania — hráč musí stále vidieť, za čo dostane body.
  // v6: špaky (spolu = keby hra skončila teraz), za starších a odhad.
  const body = useMemo(() => spakyTeraz(view), [view]);
  // Šírka okna — na mobile menšia ruka a predvolene zbalení starší.
  const [sirkaOkna, setSirkaOkna] = useState(() => (typeof window === "undefined" ? 1600 : window.innerWidth));
  const [vyskaOkna, setVyskaOkna] = useState(() => (typeof window === "undefined" ? 1000 : window.innerHeight));
  useEffect(() => {
    const zmena = (): void => {
      setSirkaOkna(window.innerWidth);
      setVyskaOkna(window.innerHeight);
    };
    window.addEventListener("resize", zmena);
    document.addEventListener("fullscreenchange", zmena);
    window.visualViewport?.addEventListener("resize", zmena);
    return () => {
      window.removeEventListener("resize", zmena);
      document.removeEventListener("fullscreenchange", zmena);
      window.visualViewport?.removeEventListener("resize", zmena);
    };
  }, []);
  // Telefón na šírku má vlastné rozloženie (Pult) — mobil na výšku by preň prestavil šenok a cieľ kola
  // (na Androide s lištou prehliadača má okno pod 760 px a stavba šenku sa zasekla, Michal 2026-10-31).
  const mobil = sirkaOkna < MOBIL && !naSirku;
  const celaObrazovka = useCelaObrazovka();
  // Vypínač nápovedí Melichara v menu ☰ (telefón).
  const napovedy = useVypinacNapoved();
  // Kto od stola odíde (lobby, iná stránka), nemá ostať na celej obrazovke.
  useEffect(
    () => () => {
      if (document.fullscreenElement !== null) void document.exitFullscreen().catch(() => undefined);
    },
    [],
  );
  // Dotyková obrazovka bez myši — kartu v ruke zväčší ťuknutie (hover tam nie je).
  const jeDotyk = useMemo(() => typeof window !== "undefined" && window.matchMedia?.("(hover: none)").matches === true, []);
  // Nízky notebook (MacBook 14" ≈ 860 px, 13" s lištou ≈ 800, 1366 × 650): menšia ruka nechá výšku stolu.
  // Na šírku telefónu je ruka pás cez celú šírku medzi stĺpcami: karta celá, osem vedľa seba.
  const vyskaRukyNaSirku = Math.round(Math.min(110, Math.max(64, vyskaOkna * RUKA_NA_SIRKU)));
  const sirkaVRuke = naSirku
    ? Math.floor(Math.min((vyskaRukyNaSirku - 8) / POMER_KARTY, (sirkaOkna - 2 * 68 - 12 - (KARIET_V_RUKE_NA_SIRKU - 1) * 4) / KARIET_V_RUKE_NA_SIRKU))
    : mobil
      ? SIRKA_V_RUKE_MOBIL
      : vyskaOkna < NIZKE_OKNO
        ? 84
        : vyskaOkna < NOTEBOOK
          ? 96
          : SIRKA_V_RUKE;
  // Telefón na šírku: celá obrazovka patrí stolu — hlavička webu sa skryje (hra.css nevie o ranku hráča,
  // preto trieda na <html>) a obsah siahne aj pod výrez displeja; okraje dorovná env(safe-area-inset-*).
  useEffect(() => {
    if (!naSirku) return;
    const html = document.documentElement;
    html.classList.add("stol-na-sirku");
    const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
    const povodny = meta?.content ?? null;
    if (meta !== null && !/viewport-fit/.test(meta.content)) meta.content = `${meta.content}, viewport-fit=cover`;
    // Zamknúť na šírku dovolí prehliadač len na celej obrazovke či v PWA (hlavne Android) — inak ticho nič.
    const orientacia = screen.orientation as (ScreenOrientation & { lock?: (o: string) => Promise<void> }) | undefined;
    try {
      orientacia?.lock?.("landscape").catch(() => undefined);
    } catch {
      // starší prehliadač bez Promise z lock()
    }
    return () => {
      html.classList.remove("stol-na-sirku");
      if (meta !== null && povodny !== null) meta.content = povodny;
    };
  }, [naSirku]);
  // Časová os kola sa lepí pod hlavičku webu — tá je tiež prilepená, preto jej výška.
  const [vyskaHlavicky, setVyskaHlavicky] = useState(0);
  useEffect(() => {
    const el = document.querySelector<HTMLElement>(".hlavicka");
    if (el === null) return;
    const zmeraj = () => setVyskaHlavicky(el.offsetHeight);
    zmeraj();
    const ro = new ResizeObserver(zmeraj);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // Kým partia beží, klik na menu v hlavičke sa najprv opýta (Michal 2026-10-23); prehrávač nestráži.
  useStrazOdchodu(view.koniec === null && prehravanie === undefined, kod, vyucba === true);
  // Pri stole hlavička nemá menu webu (Michal 2026-10-26, #23); prehrávač ho nechá.
  useStolVHlavicke(prehravanie === undefined);
  // Ovládanie partie (spojenie, kontumácia, vzdať sa, odísť) je v hlavičke webu — Layout má preň miesto.
  const [slotHlavicky, setSlotHlavicky] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setSlotHlavicky(document.getElementById("hlavicka-hra"));
  }, []);
  const liniaRef = useRef<HTMLDivElement>(null);
  useZarovnanieLinie(liniaRef);
  // Lepiaca hrana stola má zmysel, len keď je línia nad rukou aspoň trochu vidno.
  // Keď stôl leží skoro celý pod okrajom okna, hrana by sa vysunula cez pilulku
  // pokynu a pás kola (Pitka na 1600 × 1000) — vtedy ostane na stole.
  const [liniaVidno, setLiniaVidno] = useState(true);
  useEffect(() => {
    const el = liniaRef.current;
    if (el === null || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([z]) => setLiniaVidno(z?.isIntersecting ?? true), { rootMargin: "0px 0px -320px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  // Zväčšenie karty (lupa a ruka) podľa nastavenia v profile.
  const mierkaLupy = (useUcet().ja?.lupa ?? LUPA_PREDVOLENA) / 100;
  // Klávesové skratky v partii (Michal 2026-10-22, roadmapa #19) — vypínač v profile.
  const skratky = useSkratky(useUcet().ja?.skratky !== false && view.koniec === null, (k) => {
    // N bez vybranej karty nič nerobil — nováčik nevedel prečo (playtest výučby U6).
    if (k !== "n" || !naexMozny || mode.typ === "naexCiel") return;
    const r = liniaRef.current?.getBoundingClientRect();
    setChybaTahania({ text: t("plocha.najprvVyberNaex"), x: r === undefined ? window.innerWidth / 2 : r.left + r.width / 2, y: r === undefined ? window.innerHeight / 2 : r.top + r.height / 2 });
  });
  const lokalitaRef = useRef<HTMLDivElement>(null);
  // Línia môže byť dlhá — lokalitu drž v strede pohľadu.
  const pocetVLinii = view.strany[0].length + view.strany[1].length;
  // Kšeft leží pod kartou, ktorá ho ponúka (Michal 2026-11-02) — nie na hrane medzi Fajčiť a Doliať.
  // Väzni nie sú na stole, ale v okne Pivnica (ikona v nástrojoch stola) — plocha sa nezmenší.
  const kseftyStola = prehravanie === undefined ? kseftyNaStole(data, view) : [];
  // Na nízkom notebooku (1366 × 650) by veľké karty väzňov odsunuli tlačidlá schopností pod okraj okna.
  const sirkaPivnice = Math.max(SIRKA_PIVNICE_NA_SIRKU, Math.min(SIRKA_PIVNICE, Math.floor((vyskaOkna - PIVNICA_OKREM_KARTY) / POMER_KARTY)));
  const kseftyVLinii = kseftyStola.filter((k) => k.druh !== "vazen");
  const mojiVazni = view.vazni.filter((v) => v.hrac === ja);
  // Schopnosť väzňa (v11.2) teraz ide — Pivnica na hrane svieti.
  const schopnostTeraz = kseftyStola.some((k) => k.druh === "vazen" && k.dovod === null);
  // Pod kartami ostane riadok na štítok Kšeftu, len keď nejaký v línii je — karty sa o toľko zmenšia.
  const rezervaKseftu = (kseftyVLinii.length > 0 ? REZERVA_KSEFTU : 0) + (nadLiniou === undefined ? 0 : vyskaOkna < NOTEBOOK ? REZERVA_RADOV_NOTEBOOK : REZERVA_RADOV);
  // Dlhá línia sa zmenší na šírku stola (karty sa nezrežú), až po minimum.
  const [sirkaLinie, setSirkaLinie] = useState(0);
  useEffect(() => {
    const el = liniaRef.current;
    if (el === null) return;
    const ro = new ResizeObserver(([z]) => setSirkaLinie(Math.floor(z?.contentRect.width ?? 0)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // Výška stola (#67): stôl dostane, čo ostane z okna, a karty sa zmenšia tak, aby sa
  // línia zmestila aj s posunom akcia ku akcii — ten línia zmeria po zarovnaní.
  const plstRef = useRef<HTMLDivElement>(null);
  const [vyskaPlste, setVyskaPlste] = useState(0);
  // Vnútro plste s okrajom (clientWidth/Height) — nástenka na stole sa škáluje podľa šírky
  // aj výšky (Michal 2026-10-28); jej vrstva je umiestnená absolútne voči tomuto boxu.
  const [vnutroPlste, setVnutroPlste] = useState<{ readonly w: number; readonly h: number }>({ w: 0, h: 0 });
  useEffect(() => {
    const el = plstRef.current;
    if (el === null) return;
    const ro = new ResizeObserver(([z]) => {
      setVyskaPlste(Math.floor(z?.contentRect.height ?? 0));
      setVnutroPlste((x) => (x.w === el.clientWidth && x.h === el.clientHeight ? x : { w: el.clientWidth, h: el.clientHeight }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // Voľba cieľa a draft ležia vo vrstve na stole: karty sa zväčšia na jej výšku.
  // Réžia = všetko v paneli okrem kariet (hlavička, popisy, rad šenku zatiaľ bez kariet);
  // zmeria sa po vykreslení a karty sa prepočítajú — ako rezerva posunu línie.
  const [vrstvaFazyEl, setVrstvaFazyEl] = useState<HTMLDivElement | null>(null);
  const [vyskaVrstvy, setVyskaVrstvy] = useState(0);
  // Réžia v rámci kroku len rastie: keď sa rad kariet pri úzkom okne zalomí,
  // réžia skočí, karty sa zmenšia, rad sa odlomí a réžia klesne — pri voľnom
  // nastavovaní sa to točilo donekonečna (React #185 pod ≈ 1300 px, Bugfixing
  // 2026-10-24). Nový krok alebo iný rozmer vrstvy či línie (okno, zoom) začne
  // meranie odznova — až po prepočte rozloženia, inak by ostala réžia z menšieho okna.
  const [reziaDraftu, setReziaDraftu] = useState(0);
  useEffect(() => setReziaDraftu(0), [view.faza, draft?.krok, vyskaVrstvy, sirkaLinie]);
  useEffect(() => {
    if (vrstvaFazyEl === null) return;
    const ro = new ResizeObserver(([z]) => setVyskaVrstvy(Math.floor(z?.contentRect.height ?? 0)));
    ro.observe(vrstvaFazyEl);
    return () => ro.disconnect();
  }, [vrstvaFazyEl]);
  useLayoutEffect(() => {
    const panel = vrstvaFazyEl?.firstElementChild;
    if (!(panel instanceof HTMLElement)) return;
    // Na šírku telefónu je panel na celú výšku plste a obsah v ňom vystredený — réžia sa ráta
    // od vrchu obsahu, inak by voľné miesto nad ním zmenšovalo karty (a tým rástlo) donekonečna.
    let hore = panel.getBoundingClientRect().top;
    if (naSirku) hore = Math.min(...[...panel.children].map((c) => c.getBoundingClientRect().top), Number.POSITIVE_INFINITY) - parseFloat(getComputedStyle(panel).paddingTop);
    let spodok = hore;
    for (const c of panel.children) spodok = Math.max(spodok, c.getBoundingClientRect().bottom);
    const obsah = spodok - hore + parseFloat(getComputedStyle(panel).paddingBottom);
    let karty = 0;
    // Lokalita pri stavbe je väčšia než karty balíčka — do réžie patrí, čo pridá navyše.
    // Rady kariet (balíček stavby na telefóne v dvoch) nie sú réžia — rátajú sa všetky.
    const rady = new Set<number>();
    for (const kl of panel.querySelectorAll<HTMLElement>(":is(.stavba-balicek, .draft-karty:not(.stavba-senok-zatial *)) .kl")) {
      karty = Math.max(karty, kl.offsetHeight);
      if (kl.closest(".stavba-balicek") !== null) rady.add(Math.round(kl.getBoundingClientRect().top / 8));
    }
    karty *= Math.max(1, rady.size);
    const zatial = panel.querySelector<HTMLElement>(".stavba-senok-zatial .kl")?.offsetHeight ?? 0;
    if (karty === 0) return;
    const r = Math.round(obsah - karty - zatial);
    if (r > reziaDraftu + 3) setReziaDraftu(r);
  });
  const [rezervaPosunu, setRezervaPosunu] = useState(REZERVA_POSUNU);
  const [rezervaHran, setRezervaHran] = useState(0);
  useEffect(() => setRezervaPosunu(REZERVA_POSUNU), [view.kolo]);
  useLayoutEffect(() => {
    const l = liniaRef.current;
    if (l === null) return;
    let posun = 0;
    let vyska = 0;
    for (const el of l.querySelectorAll<HTMLElement>(".partia-rad > *")) {
      posun = Math.max(posun, parseFloat(el.style.marginTop) || 0);
      const kl = el.querySelector<HTMLElement>(".kl");
      if (kl !== null) vyska = Math.max(vyska, kl.offsetHeight);
    }
    if (vyska === 0) return;
    const r = Math.ceil((posun / vyska) * 20) / 20;
    if (r > rezervaPosunu) setRezervaPosunu(r);
    // Hrany Nástrojov pod mojimi kartami trčia pod líniu (Náradie, mock 2) — línia ich má mať v rezerve,
    // stôl nesmie scrollovať. Tie nad súperovými kartami posúvajú rad a zachytí ich rezervaPosunu.
    let dole = 0;
    for (const el of l.querySelectorAll<HTMLElement>(".s-nastrojmi-dole")) dole = Math.max(dole, parseFloat(el.style.paddingBottom) || 0);
    const rd = Math.ceil((dole / vyska) * 20) / 20;
    if (rd !== rezervaHran) setRezervaHran(rd);
  });
  // Kladiem kartu z ruky do línie: v Zhromaždení (kým nepasujem) alebo v odpovedi na NA EX.
  const vykladam =
    somNaTahu &&
    view.koniec === null &&
    ((view.faza === "zhromazdenie" && view.zhromazdenieStav !== null && !view.zhromazdenieStav.pasoval[ja]) ||
      (view.faza === "pitka" && view.pitkaStav?.reakcia === ja));
  // +2: karta v strede a voľné miesto na koniec strany pri vykladaní;
  // pri vykladaní ležia na oboch koncoch úzke miesta na klik (MIESTO_VOLBY).
  // Pod NOTEBOOK skryje hra.css riadok „na prebitie“ a popis strán pod lokalitou, nadpisy krajov sú tenšie.
  // Stôl so scrollom (Michal 2026-10-24): keď by karty v línii klesli pod čitateľnú
  // veľkosť (malé okno, zoom 150 %), partia prestane byť na výšku okna, karty ostanú
  // SIRKA_CITATELNA a stránka sa scrolluje. Výška stola sa vtedy riadi kartami — preto
  // každá zmena okna (aj zoom) vráti stôl na výšku okna a premeria ho; na scroll prejde,
  // až keď karta ostane pod minimom chvíľu (prvé rozloženie po načítaní ešte skáče).
  const [stolScroll, setStolScroll] = useState(false);
  useEffect(() => setStolScroll(false), [sirkaOkna, vyskaOkna]);
  const sirkaPodlaVysky = stolScroll
    ? SIRKA_CITATELNA
    : mobil || vyskaPlste === 0
      ? SIRKA_V_LINII
      : Math.floor((vyskaPlste - rezervaKseftu - (vyskaOkna < NIZKE_OKNO ? PRIDAVOK_NIZKE : vyskaOkna < NOTEBOOK ? PRIDAVOK_NOTEBOOK : PRIDAVOK_LINIE)) / (POMER_KARTY * (1 + rezervaPosunu + rezervaHran)));
  useEffect(() => {
    // Výučba stôl na scroll neprepína: návrh ťahu so spojom (vysunuté karty, pokyn v dvoch riadkoch
    // úzkeho stola) ho prepol natrvalo a pás hráča s rukou ostali pod okrajom okna (UI inšpekcia
    // 20261024-napovedy, N4). Karty ostávajú aj tak na SIRKA_CITATELNA a do plste sa vojdú.
    if (mobil || naSirku || vyucba === true || stolScroll || vyskaPlste === 0 || sirkaPodlaVysky >= SIRKA_CITATELNA) return;
    // Skrytá línia (starší, voľba cieľa, draft): plsť zmenší pokyn s kartami (zajatie),
    // nie karty línie — scroll by plsť zrazil na pár px (UI inšpekcia 20261024-nahlad, N1).
    if (plstRef.current?.classList.contains("linia-skryta") === true) return;
    const t = setTimeout(() => setStolScroll(true), ONESKORENIE_SCROLLU_MS);
    return () => clearTimeout(t);
  }, [mobil, naSirku, vyucba, stolScroll, vyskaPlste, sirkaPodlaVysky]);
  const sirkaVLinii =
    sirkaLinie === 0
      ? Math.min(SIRKA_V_LINII, sirkaPodlaVysky)
      : naSirku
        ? // Na šírku telefónu sa línia zmestí medzi stĺpce (oprava 5: pri 5–8 kartách pretiekla cez okraj
          // a „+“ zmizlo) — karty sa rovnomerne zmenšia podľa šírky aj výšky plste.
          Math.max(
            SIRKA_NA_SIRKU_MIN_LINIA,
            Math.min(SIRKA_V_LINII, sirkaPodlaVysky, Math.floor((sirkaLinie - 24) / (pocetVLinii + 1 + (vykladam ? 2 * MIESTO_VOLBY : 0))) - 4),
          )
        : // Minimum platí pre šírku (dlhá línia sa radšej posúva); výška stola ho prebije —
        // na nízkom notebooku sa karty inak orezali dole (Michal 2026-10-23) — no nie pod
        // čitateľnú veľkosť: tam už stôl prejde na scroll.
        Math.max(
          SIRKA_CITATELNA,
          Math.min(
            sirkaPodlaVysky,
            Math.max(SIRKA_V_LINII_MIN, Math.min(SIRKA_V_LINII, Math.floor((sirkaLinie - 60) / (pocetVLinii + 2 + (vykladam ? 2 * MIESTO_VOLBY : 0))) - 12)),
          ),
        );
  useEffect(() => {
    const l = liniaRef.current;
    const lok = lokalitaRef.current;
    if (l === null || lok === null) return;
    l.scrollTo({ left: lok.offsetLeft + lok.offsetWidth / 2 - l.clientWidth / 2, behavior: "smooth" });
  }, [pocetVLinii, view.ciel]);

  // ---- návrh ťahu ----------------------------------------------------------
  const [navrh, setNavrh] = useState<Navrh | null>(null);
  // Nová fáza, ťah alebo krok bitky — starý návrh už neplatí.
  const klucTahu = `${view.kolo}|${view.faza}|${view.naTahu}|${view.bitkaStav?.krok ?? ""}|${draft?.krok ?? ""}|${draft?.balicekPocet[ja] ?? ""}`;
  useEffect(() => setNavrh(null), [klucTahu]);
  // Pokyn ťahu (pilulka na stole, v drafte pätička šenku) nesmie pri novom ťahu
  // ostať pod pripnutou rukou (UI inšpekcia U04) — stránka sa posunie len
  // toľko, aby bol nad rukou; keď ho hráč vidí, nehýbe sa.
  useEffect(() => {
    if (!somNaTahu) return;
    const ciel = document.querySelector<HTMLElement>(view.faza === "draft" ? ".draft-paticka" : ".linia-stav");
    if (ciel === null) return;
    const ruka = document.querySelector<HTMLElement>(".ruka")?.getBoundingClientRect().height ?? 0;
    const dole = window.innerHeight - ruka;
    const r = ciel.getBoundingClientRect();
    if (r.top > 0 && r.bottom > dole) window.scrollBy({ top: r.bottom - dole + 12, behavior: "smooth" });
    // Len pri novom ťahu — nie pri každom prekreslení.
  }, [klucTahu, somNaTahu]);
  // Nevratné kroky s inline potvrdením (dizajn UX N1): „hotovo“ v Pitke, keď
  // ním hráč vzdáva možné NA EX, a „pasovať“, keď ešte môže vykladať.
  const [potvrdenie, setPotvrdenie] = useState<"hotovo" | null>(null);
  useEffect(() => setPotvrdenie(null), [klucTahu, view.pitkaCislo]);
  // „Skončiť Pitku“ bez NA EX chce druhý klik — keď ho hráč neurobí, tlačidlo sa po chvíli vráti.
  // Na telefóne vydrží, kým hráč neťukne inde — „naozaj?“ v pruhu by si inak nestihol prečítať.
  useEffect(() => {
    if (potvrdenie === null) return;
    if (naSirku) {
      const mimo = (e: PointerEvent): void => {
        if (e.target instanceof Element && e.target.closest('[data-vyucba="tlacidlo:hotovo"]') !== null) return;
        setPotvrdenie(null);
      };
      document.addEventListener("pointerdown", mimo, true);
      return () => document.removeEventListener("pointerdown", mimo, true);
    }
    const t = setTimeout(() => setPotvrdenie(null), 4000);
    return () => clearTimeout(t);
  }, [potvrdenie, naSirku]);
  useEffect(() => {
    if (potvrdenie === null && mode.typ !== "naexCiel") return;
    const klaves = (e: KeyboardEvent): void => {
      if (e.key !== "Escape") return;
      setPotvrdenie(null);
      setMode((m) => (m.typ === "naexCiel" ? { typ: "ziadny" } : m));
    };
    window.addEventListener("keydown", klaves);
    return () => window.removeEventListener("keydown", klaves);
  }, [potvrdenie, mode.typ]);
  // Stavba šenku (Michal 2026-10-28, roadmapa #147 a #148): klik vyberie kartu do Šenku
  // (karta sa zdvihne), ďalší klik výber zruší; nevybrané idú naspodok Náradia a Občanov.
  // Pri plnom výbere sú ostatné zosivené a klik na ne nič neurobí. Koľko do Šenku, určuje
  // jadro (krokStavby: polovica nahor). Server dostane celé rozdelenie. Pravidlo §5 sa nemení.
  const [senokStavby, setSenokStavby] = useState<readonly number[]>([]);
  useEffect(() => {
    setSenokStavby([]);
  }, [klucTahu]);
  const krokSt = krokStavby(draft?.krok === "stavba" ? draft.mojBalicek.length : 0);
  const prepniStavbu = (uid: number): void => setSenokStavby((x) => prepniVyber(x, uid, krokSt.doSenku));
  const { doSenku: doSenkuStavby, odhod: odhodStavby } = rozdelenieStavby(draft?.krok === "stavba" ? draft.mojBalicek : [], senokStavby);
  const stavbaHotova = doSenkuStavby.length === krokSt.doSenku && odhodStavby.length === krokSt.odhod;
  const zrusStavbu = (): void => setSenokStavby([]);
  const potvrdStavbu = (): void => {
    if (stavbaHotova && !naneisto) posli({ type: "stavbaSenku", doSenku: doSenkuStavby, odhod: odhodStavby });
  };

  // Limit Zhromaždenia na jeho začiatku — pás nad stolom z neho ukazuje,
  // koľko kariet hráč už vyložil a koľko ešte smie (server posiela len zvyšok).
  const zs0 = view.zhromazdenieStav;
  const klucZhromazdenia = `${view.kolo}-${view.pitkaCislo}`;
  const [limitNaZaciatku, setLimitNaZaciatku] = useState<{ readonly kluc: string; readonly limit: readonly [number, number] } | null>(null);
  useEffect(() => {
    if (view.faza !== "zhromazdenie" || zs0 === null || limitNaZaciatku?.kluc === klucZhromazdenia) return;
    setLimitNaZaciatku({ kluc: klucZhromazdenia, limit: [zs0.zostavaLimit[0], zs0.zostavaLimit[1]] });
  }, [view.faza, zs0, klucZhromazdenia, limitNaZaciatku]);

  // Karty, ktoré si hráč v tomto kole vzal zo šenku — v ruke sú označené.
  const [noveZoSenku, setNoveZoSenku] = useState<{ readonly kolo: number; readonly uids: readonly number[] }>({ kolo: 0, uids: [] });
  // Štítok „zo šenku“ len počas draftu (Michal 2026-10-18) — potom sú to bežné karty v ruke.
  const noveVRuke = noveZoSenku.kolo === view.kolo && view.faza === "draft" ? noveZoSenku.uids : [];

  // Práve dobraté karty mimo draftu (priznaný Dlh, fajčenie, Pitka) — dobratie
  // inak zaniklo v logu (Michal 2026-10-18). Štítok platí do ďalšej zmeny ruky.
  const predoslaRuka = useRef<readonly number[] | null>(null);
  const [dobrate, setDobrate] = useState<readonly number[]>([]);
  const klucRuky = view.ruka.map((k) => k.uid).join(",");
  useEffect(() => {
    const teraz = view.ruka.map((k) => k.uid);
    const pred = predoslaRuka.current;
    predoslaRuka.current = teraz;
    if (pred === null || view.faza === "draft") {
      setDobrate([]);
      return;
    }
    const nove = teraz.filter((u) => !pred.includes(u));
    // Ubudnutie karty (vyloženie) štítok len upraví, pribudnutie ho nahradí.
    setDobrate((d) => (nove.length > 0 ? nove : d.filter((u) => teraz.includes(u))));
  }, [klucRuky, view.faza]);

  // Poradie kariet v ruke si hráč skladá sám (Michal 2026-10-16); žije len
  // v tomto prehliadači — server poradie ruky nepozná a nepotrebuje.
  const klucPoradia = `naex.ruka.${kod}.${ja}`;
  const [poradieRuky, setPoradieRuky] = useState<readonly number[]>(() => {
    try {
      const ulozene = localStorage.getItem(klucPoradia);
      return ulozene === null ? [] : (JSON.parse(ulozene) as number[]);
    } catch {
      return [];
    }
  });
  const ulozPoradie = (uids: readonly number[]): void => {
    setPoradieRuky(uids);
    try {
      localStorage.setItem(klucPoradia, JSON.stringify(uids));
    } catch {
      // bez úložiska sa poradie len nezapamätá po obnovení stránky
    }
  };
  /** Ruka v poradí hráča; nové karty idú na koniec v poradí, v akom prišli. */
  const ruka = useMemo(() => {
    const pozicia = new Map(poradieRuky.map((uid, i) => [uid, i]));
    return [...view.ruka].sort(
      (a, b) => (pozicia.get(a.uid) ?? Number.MAX_SAFE_INTEGER) - (pozicia.get(b.uid) ?? Number.MAX_SAFE_INTEGER),
    );
  }, [view.ruka, poradieRuky]);
  const presunVRuke = (uid: number, cielUid: number | null): void => {
    const uids = ruka.map((k) => k.uid);
    const odkial = uids.indexOf(uid);
    if (odkial === -1) return;
    const bez = uids.filter((u) => u !== uid);
    // Doprava ide karta ZA cieľ, doľava PRED neho — ako pri preskladaní kariet v ruke.
    const kam = cielUid === null ? bez.length : bez.indexOf(cielUid) + (uids.indexOf(cielUid) > odkial ? 1 : 0);
    ulozPoradie([...bez.slice(0, kam), uid, ...bez.slice(kam)]);
  };

  // Návrh sa vždy overí proti aktuálnemu pohľadu; karta, ktorá už nie je
  // tam, odkiaľ prišla, z návrhu potichu vypadne.
  // Reakcia na súperovo NA EX: jedna karta z ruky do línie mimo limitu.
  const reagujem = somNaTahu && view.faza === "pitka" && view.pitkaStav?.reakcia === ja;
  // Podloženie Nástroja (Náradie, Michal 2026-11-08): ťah v Zhromaždení, nie v odpovedi na NA EX.
  const mozemPodkladat = somNaTahu && view.koniec === null && view.faza === "zhromazdenie" && view.zhromazdenieStav !== null && !view.zhromazdenieStav.pasoval[ja];
  const ponukyPodlozenia = useMemo(() => {
    const linia = lineState(view);
    const pamat = new Map<number, readonly MoznostPodlozenia[]>();
    return (k: CardInstance): readonly MoznostPodlozenia[] => {
      let p = pamat.get(k.uid);
      if (p === undefined) {
        p = hranyNastroja(defOf(data, k)) === null ? [] : ponukaPodlozenia(data, linia, k, ja);
        pamat.set(k.uid, p);
      }
      return p;
    };
  }, [data, view, ja]);
  /** Kam smie Nástroj z ruky — prázdne mimo vlastného ťahu v Zhromaždení. */
  const ponukaPre = (k: CardInstance): readonly MoznostPodlozenia[] => (mozemPodkladat ? ponukyPodlozenia(k) : []);
  /** Zasunutý Nástroj v návrhu: karta z ruky, hostiteľ a pretŕčajúca hrana. */
  const podlozenieNavrh = (() => {
    if (navrh?.typ !== "podlozenie" || !mozemPodkladat) return null;
    const nastroj = view.ruka.find((k) => k.uid === navrh.nastroj);
    if (nastroj === undefined || !ponukaPre(nastroj).some((m) => m.hostitel === navrh.hostitel && m.hrana === navrh.hrana)) return null;
    return { nastroj, hostitel: navrh.hostitel, hrana: navrh.hrana };
  })();
  /** Zasunie Nástroj pod kartu: trčí prvá hrana, ktorá tam má čo robiť (mock 2, Ťah). */
  const zasun = (k: CardInstance, hostitel: number): void => {
    const moznosti = ponukaPre(k).filter((m) => m.hostitel === hostitel);
    const hrana = (moznosti.find((m) => m.maCoRobit) ?? moznosti[0])?.hrana;
    if (hrana === undefined) return;
    // Nástroj odišiel z ruky pod kartu — výber v ruke (zlaté rámy hostiteľov) končí.
    setVybranaDoOblasti(null);
    setNavrh({ typ: "podlozenie", nastroj: k.uid, hostitel, hrana });
  };
  /** Otočí zasunutý Nástroj — trčí druhá hrana, ak ju pravidlá pod touto kartou pustia. */
  const otocPodlozenie = (): void => {
    if (podlozenieNavrh === null) return;
    const druha: KtoraHrana = podlozenieNavrh.hrana === "horna" ? "dolna" : "horna";
    if (!ponukaPre(podlozenieNavrh.nastroj).some((m) => m.hostitel === podlozenieNavrh.hostitel && m.hrana === druha)) return;
    setNavrh({ typ: "podlozenie", nastroj: podlozenieNavrh.nastroj.uid, hostitel: podlozenieNavrh.hostitel, hrana: druha });
  };
  const vylozenia: readonly PolozkaVykladania[] = (() => {
    if (navrh?.typ !== "vylozenia" || !somNaTahu || !(view.faza === "zhromazdenie" || reagujem)) return [];
    return navrh.polozky.flatMap((x) => {
      const k = view.ruka.find((r) => r.uid === x.uid);
      return k === undefined ? [] : [{ karta: k, ciel: x.ciel }];
    });
  })();
  // Pri myši na Záverečnej návrh ukáže, ktorá karta pôjde lícom dole.
  const [nahladZaverecnej, setNahladZaverecnej] = useState(false);
  useEffect(() => setNahladZaverecnej(false), [klucTahu]);
  /** Posledná navrhnutá karta (v odpovedi na NA EX jediná). */
  const vylozene: PolozkaVykladania | null = vylozenia[vylozenia.length - 1] ?? null;
  // Celý ťah v Zhromaždení naraz: koľko poldeci stojí a či ho pravidlá pustia —
  // rovnaký výpočet, aký server urobí s príkazom „tah“.
  const zostavaTeraz = view.zhromazdenieStav?.zostavaLimit[ja] ?? 0;
  const planTahu = (polozky: readonly PolozkaVykladania[]) => planVykladania(data, view, ja, zostavaTeraz, polozky);
  const plan = view.faza === "zhromazdenie" ? planTahu(vylozenia) : null;
  // Výučba (playtest 20261023-161148, návrh 1): ťah, ktorému ešte niečo chýba, sa nedá potvrdiť —
  // inak ho server odmietol a hráč nevedel prečo. Rovnaká karta (defId) platí za tú zo scenára.
  const chybaVyucby = (polozky: readonly PolozkaVykladania[]): string | null => {
    if (vyucbaOcakava === undefined || vyucbaOcakava === null) return null;
    const kroky = (vyucbaOcakava.type === "tah" ? vyucbaOcakava.kroky : [vyucbaOcakava]) as readonly Command[];
    const ocakavane = kroky.flatMap((k) => {
      if (k.type !== "place" && k.type !== "zaverecna") return [];
      const defId = view.ruka.find((r) => r.uid === k.uid)?.defId;
      return defId === undefined ? [] : [{ defId, ciel: k.target, zaverecna: k.type === "zaverecna" }];
    });
    const sedi = (o: (typeof ocakavane)[number], v: PolozkaVykladania): boolean =>
      v.karta.defId === o.defId && v.ciel === o.ciel && o.zaverecna === (v.zaverecna === true);
    const chyba = ocakavane.filter((o) => !polozky.some((v) => sedi(o, v)));
    if (chyba.length === 0) return null;
    const navyse = polozky.filter((v) => !ocakavane.some((o) => sedi(o, v)));
    return [
      t("plocha.esteChyba", { karty: chyba.map((o) => menoKarty(o.defId)).join(", ") }),
      navyse.length > 0 ? t("plocha.nepatri", { karty: navyse.map((v) => menoKarty(v.karta.defId)).join(", ") }) : "",
    ]
      .filter((x) => x !== "")
      .join(" ");
  };
  const chybaVoVyucbe = chybaVyucby(vylozenia);
  // Záverečná (roadmapa #83, Michal 2026-10-24) je forma konca ťahu: tlačidlo vedľa potvrdenia
  // odošle návrh a jeho posledná karta pôjde lícom dole; potom už v tomto Zhromaždení nevykladám.
  const zaverecna = ((): { readonly kroky: readonly Command[] | null; readonly dovod: string | null } | null => {
    if (view.faza !== "zhromazdenie" || !somNaTahu) return null;
    const t = tahSoZaverecnou(data, view, ja, vylozenia);
    const vyucba = t.kroky === null ? null : chybaVyucby(polozkySoZaverecnou(vylozenia));
    return vyucba === null ? t : { kroky: null, dovod: vyucba };
  })();
  /** Koľkatá karta do línie či do Dedičstva v ťahu (od 0) — od druhej stojí plný poldeci. */
  const poradieVTahu = (uid: number): number => vylozenia.filter((x) => x.ciel !== "priznanie").findIndex((x) => x.karta.uid === uid);
  // v11.11: lokalitu vybral súper a natáčam ja — návrh je jej natočenie, nie voľba.
  const lokalitaNavrh = lokalitaZNavrhu(view, somNaTahu, navrh?.typ === "lokalita" ? navrh : null);
  // Lokalita umiestnená z vrstvy: posuň stránku k stolu, nech ju ruka neprekrýva.
  const navrhLokality = navrh?.typ === "lokalita" ? navrh.uid : null;
  useEffect(() => {
    if (navrhLokality === null) return;
    lokalitaRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [navrhLokality]);
  // Branie zo šenku (Michal 2026-10-19): na ťahu potiahneš 1 alebo 2 karty do
  // ruky a potvrdíš — 1 karta za cigaretu, 2 karty za 3 cigarety, poldeci sa neplatí.
  const beriem = view.faza === "draft" && draft?.krok === "beranie" && !draft.hotovo[ja] && view.koniec === null;
  const cigJa = view.hraci[ja].cigarety;
  // v9.2: kto berie prvý (obranca), na prvom ťahu len 1 kartu — ten istý strop ako jadro (maxZoSenku).
  const prvyTahSenku = beriem && somNaTahu && maxZoSenku(view, ja) < 2;
  const kolkoMozemBrat =
    beriem && somNaTahu
      ? Math.min(view.senok.length, maxZoSenku(view, ja), cigJa >= (KONSTANTY.CENA_SENKU[2] ?? 3) ? 2 : cigJa >= (KONSTANTY.CENA_SENKU[1] ?? 1) ? 1 : 0)
      : 0;
  const dovodJednejKarty = prvyTahSenku ? t("plocha.jednaKarta", { cig: cigariet(KONSTANTY.CENA_SENKU[2] ?? 3) }) : null;
  const mozemBrat = kolkoMozemBrat > 0;
  const hJa = view.hraci[ja];
  const limitTeraz = limitZhromazdenia(view, ja);
  const zoSenkuLimit = kolkoMozemBrat;
  const mojaVolbaSenku = view.volbaNastupu?.typ === "senok" && view.volbaNastupu.hrac === ja ? view.volbaNastupu : null;
  // Keď hráč má vyberať kartu zo šenku (Starosta) či Vešticu, vrstva sa otvorí
  // sama. Raz za fázu — ak ju zavrie, znova sa nevnucuje. Cieľ kola sa vyberá
  // na stole (Michal 2026-10-19), nie vo vrstve.
  const chceVrstvu: Vrstva | null = !somNaTahu || view.koniec !== null
    ? null
    : view.volbaVestica !== null
        ? "vestica"
    : // Karta z ponuky (Starosta, Dohadzovačka v7): ponuka sa otvorí sama.
          view.volbaNastupu?.typ === "senok" && view.volbaNastupu.hrac === ja
          ? "senok"
          : null;
  // Výber lokality skončil (aj keď ho urobil súper) — vrstva by zakryla draft na stole.
  useEffect(() => {
    if (view.faza !== "volbaCiela") setVrstva((v) => (v === "lokality" ? null : v));
  }, [view.faza]);
  const klucAutoVrstvy = `${view.kolo}-${view.faza}-${mode.typ}-${view.pitkaCislo}-${draft?.krok ?? ""}-${draft?.balicekPocet[ja] ?? ""}`;
  useEffect(() => {
    if (chceVrstvu === null || autoVrstva.current === klucAutoVrstvy) return;
    autoVrstva.current = klucAutoVrstvy;
    setVrstva(chceVrstvu);
  }, [chceVrstvu, klucAutoVrstvy]);
  const zoSenku: readonly CardInstance[] =
    navrh?.typ === "zoSenku" && zoSenkuLimit > 0
      ? view.senok.filter((k) => navrh.uids.includes(k.uid)).slice(0, zoSenkuLimit)
      : [];

  // NA EX naraz (v5): moje skryto vybrané NA EX — server posiela len moje,
  // na súperovu skrytú Záverečnú s jej náhradným uid. Súperove nevidím.
  const mojeSkryteNaex = useMemo(
    () => new Set((view.pitkaStav?.skryteNaex ?? []).filter((x) => x.hrac === ja).map((x) => x.uid)),
    [view.pitkaStav, ja],
  );
  // Bzdocha (v7): kto vyberá NA EX po súperovi, dostane aj jeho skryté NA EX — stôl ich vyznačí.
  const superoveSkryteNaex = useMemo(
    () => new Set((view.pitkaStav?.skryteNaex ?? []).filter((x) => x.hrac !== ja).map((x) => x.uid)),
    [view.pitkaStav, ja],
  );
  const vidimVolbuSupera = view.pitkaStav !== null && vidiVolbuSupera(data, view, ja);
  // Pečiatka NA EX na karte (Michal 2026-11-09): odkryté NA EX z línie a zo skrytých len tie, ktoré pohľad
  // nesie — moje, a súperove cez Bzdochu (vyberám po ňom). Zrážka oboch je Výtržník.
  const naexNaKarteVLinii = (naexBy: PlayerId | undefined, naexBy2: PlayerId | undefined, skryteMoje: boolean, skryteSupera: boolean): NaexNaKarte | undefined =>
    naexNaKarte({ naexBy, naexBy2, skryteMoje, skryteSupera }, ja, menoHraca);
  // Pre mňa sú skryté NA EX dané: náhľady a výhľady rátajú s nimi tak, ako ich motor
  // zúčtuje pri odkrytí (poldeci, pečeň, Svokra, Výpalné — sMojimiSkrytymiNaex).
  const zaklad = useMemo(() => sMojimiSkrytymiNaex(data, view), [data, view]);
  // Finále je na pinnacle lokalite a línia je ako v každom kole (Michal 2026-10-27).
  const jeFinaleStola = view.ciel?.typ === "finale";
  // Stôl tak, ako by vyzeral po potvrdení návrhu — z neho sa ráta živé
  // zvýraznenie spojov aj odhad bitky. Moje skryté NA EX v ňom ležia na kartách
  // (pre mňa sú dané), súperove nie — tie sa ukážu až pri odkrytí.
  const { stol, lineEval, odhad, rozpis, hrozby, hrozbyKliatob, presunute } = useMemo(() => {
    let strany: ClientState["strany"] = zaklad.strany;
    // Zasunutý Nástroj v návrhu: línia, bar aj odhad bitky ho už rátajú (náhľad premenených slotov).
    if (podlozenieNavrh !== null) {
      const n = { card: podlozenieNavrh.nastroj, majitel: ja, hrana: podlozenieNavrh.hrana };
      strany = strany.map((st) => st.map((pl) => (pl.card.uid === podlozenieNavrh.hostitel ? { ...pl, podlozene: [...(pl.podlozene ?? []), n] } : pl))) as unknown as ClientState["strany"];
    }
    let hraci = zaklad.hraci;
    let prilozeniaKu = zaklad.prilozeniaKu;
    // Karty, ktoré navrhnutá Dohadzovačka presunie z druhej strany lokality za seba.
    const presunute = new Set<number>();
    for (const x of vylozenia) {
      if (x.ciel === "vlastna" || x.ciel === "superova") {
        const kam = x.ciel === "vlastna" ? ja : super_;
        // Konflikt, Miňištrant a Dohadzovačka menia stôl už pri priložení — ako motor.
        const po = sPrilozenou(data, { ...zaklad, strany, hraci, ...(prilozeniaKu === undefined ? {} : { prilozeniaKu }) }, kam, x.karta, ja);
        if (x.karta.defId === "dohadzovacka") {
          const pred = new Set(strany[kam].map((pl) => pl.card.uid));
          for (const pl of po.strany[kam]) if (!pred.has(pl.card.uid) && pl.card.uid !== x.karta.uid) presunute.add(pl.card.uid);
        }
        strany = po.strany;
        hraci = po.hraci;
        prilozeniaKu = po.prilozeniaKu;
      } else {
        const h = hraci[ja];
        const novy = x.ciel === "priznanie" ? { ...h, priznane: [...h.priznane, x.karta] } : { ...h, dedicstvo: [...h.dedicstvo, x.karta] };
        hraci = ja === 0 ? [novy, hraci[1]] : [hraci[0], novy];
      }
    }
    const ciel = lokalitaNavrh !== null && view.ciel === null ? { typ: "lokalita" as const, lokalita: lokalitaNavrh.karta } : view.ciel;
    // Šofér, Vychovávateľka, Pasca a Vidly čítajú aj NA EX v kole, schopnosti väzňov a špaky (playtest v7 131033).
    const stol: VerejnyStav = {
      ciel,
      strany,
      starsi: view.starsi,
      hraci,
      spaky: view.spaky,
      naexVKole: zaklad.naexVKole,
      ...(view.kseftyKola === undefined ? {} : { kseftyKola: view.kseftyKola }),
      ...(prilozeniaKu === undefined ? {} : { prilozeniaKu }),
    };
    // lineState: rovnaká línia ako na serveri.
    // V režime Päta, Lakeť, Otočka dávajú akcie aj rady starších: bar a odhad bitky rátajú ako server.
    // Dlh Finančnej poradkyne ukáže bar aj panel bitky pri súperovi, ktorému ho Pitka pripíše.
    const lineEval = sDlhmiPoradkyne(data, stol, sRadom(data, view, evaluateLine(data, lineState({ ...stol, lokalitaOtocena: lokalitaNavrh?.otocena ?? view.lokalitaOtocena }))));
    // Klebety z hádky (v10) platia už v tejto bitke — odhad ich ráta (priazeň po hádke).
    const stolSKlebetami = { ...stol, bitkaStav: view.bitkaStav } as VerejnyStav;
    const odhad = ciel === null ? null : poskodenieBitky(data, stolSKlebetami, lineEval.sums);
    const rozpis = rozpisPoskodenia(data, stolSKlebetami, lineEval.sums);
    // Hrozba na stole: najsilnejšie NA EX každého z vás z kariet na stole (bez ruky).
    const priebeh = {
      faza: view.faza,
      pitkaStav: view.pitkaStav,
      pitkaCislo: view.pitkaCislo,
      pitkyCelkom: view.pitkyCelkom,
      poldeciPlne: [view.hraci[0].poldeciPlne, view.hraci[1].poldeciPlne] as const,
    };
    const stolBitky = { ...stol, lokalitaOtocena: lokalitaNavrh?.otocena ?? view.lokalitaOtocena, zaverecne: view.zaverecne };
    const hrozby =
      ciel === null || view.bitkaStav !== null
        ? ([null, null] as const)
        : ([hrozbaNaex(data, stolBitky, priebeh, 0), hrozbaNaex(data, stolBitky, priebeh, 1)] as const);
    // Kliatby z cudzieho NA EX (#38 B) — z pohľadu s mojimi skrytými NA EX, ruka sa neráta.
    const hrozbyKliatob =
      ciel === null || view.bitkaStav !== null || vylozenia.length > 0
        ? ([null, null] as const)
        : ([hrozbaKliatob(data, zaklad, 0, mozeEsteNaex(stolBitky, priebeh, 0)), hrozbaKliatob(data, zaklad, 1, mozeEsteNaex(stolBitky, priebeh, 1))] as const);
    return { stol, lineEval, odhad, rozpis, hrozby, hrozbyKliatob, presunute };
    // vylozene a lokalitaNavrh sú odvodené len z navrh a view.
  }, [data, view, navrh, somNaTahu, zaklad]);
  const zarStolaSEvalom = useMemo(() => ({ ...zarStola, evaly: lineEval.cards }), [zarStola, lineEval]);

  // Karty, na ktoré NA EX teraz smiem dať, nesú v línii značku — tie isté podmienky
  // ako motor (moznostiNaexVPohlade: Kostol, limit Pitky, plné poldeci, moje skryté NA EX,
  // súperova Záverečná cez náhradné uid). Značka bez Kostola svietila aj tam (roadmapa #112).
  const naexCiele = useMemo(() => new Set(moznostiNaexVPohlade(data, view)), [data, view]);
  const pitka = view.pitkaStav;
  const naexLimitMinuty = pitka !== null && naexLimitMinutyHraca(view, ja);
  const naexMozny = somNaTahu && naexCiele.size > 0;
  // Kartu so značkou smieš rovno kliknúť.
  const naexPriamo = naexMozny;

  // ---- výhľad Pitky (Michal 2026-10-21) ------------------------------------
  // Počítadlá pečene a zadĺženia ukazujú stav „po Pitke“, nie „doteraz“ — ten
  // istý výpočet ako vyhodnotenie (nahladPitky). V Zhromaždení ráta aj poldeci,
  // ktoré navrhnutý ťah vypije.
  const otocenaTeraz = lokalitaNavrh?.otocena ?? view.lokalitaOtocena;
  // Pečeň zo skrytých NA EX už nesie zaklad (sMojimiSkrytymiNaex).
  const vypijemVTahu = plan?.poldeci ?? 0;
  // Stávka bitky (návrh 3 A): v pásme kola a pri potvrdení pasu.
  const stavka = useMemo(
    () => (view.faza === "zhromazdenie" || view.faza === "pitka" ? stavkaBitky(view) : null),
    [data, view],
  );
  const nahladyPitky = useMemo(() => {
    if (view.koniec !== null || (view.faza !== "zhromazdenie" && view.faza !== "pitka") || stol.ciel === null) return null;
    const h = zaklad.hraci;
    const hraci: ClientState["hraci"] =
      ja === 0 ? [{ ...h[0], pecen: h[0].pecen + vypijemVTahu }, h[1]] : [h[0], { ...h[1], pecen: h[1].pecen + vypijemVTahu }];
    return nahladPitky(data, {
      ciel: stol.ciel,
      strany: stol.strany,
      starsi: view.starsi,
      hraci,
      lokalitaOtocena: otocenaTeraz,
      vizia: view.vizia,
      zaverecne: view.zaverecne,
      ...(view.poldeciOtoceneVKole === undefined ? {} : { poldeciOtoceneVKole: view.poldeciOtoceneVKole }),
    });
  }, [data, view, stol, ja, vypijemVTahu, otocenaTeraz, zaklad]);
  /** Špaky jednej Cirhózy a jedného Dlhu na konci hry (cenaKliatby: Cirhóza −SPAKY_ZA_CIRHOZU, Dlh 0). */
  const cenyKliatob = useMemo(
    () =>
      ([0, 1] as const).map(() => ({ cirhoza: cenaKliatby("cirhoza"), dlh: cenaKliatby("dlh") })) as [
        { readonly cirhoza: number; readonly dlh: number },
        { readonly cirhoza: number; readonly dlh: number },
      ],
    [],
  );
  const dalsiePitky = Math.max(0, view.pitkyCelkom - (view.faza === "pitka" ? view.pitkaCislo : view.pitkaCislo + 1));
  // Dlhy po najbližšej bitke (návrh #1 B): z nových prežijú len tie, ktoré
  // Robota a Dievčina na vydaj nespália — rovnaký stôl ako výhľad Pitky.
  const dlhyBitka = useMemo(() => {
    if (nahladyPitky === null || stol.ciel === null) return null;
    const h = zaklad.hraci;
    const hraci: ClientState["hraci"] =
      ja === 0 ? [{ ...h[0], pecen: h[0].pecen + vypijemVTahu }, h[1]] : [h[0], { ...h[1], pecen: h[1].pecen + vypijemVTahu }];
    const v = vyhladDlhov(data, { ciel: stol.ciel, strany: stol.strany, starsi: view.starsi, hraci, lokalitaOtocena: otocenaTeraz, vizia: view.vizia }, dalsiePitky);
    return ([0, 1] as const).map((p) => {
      const teraz = view.hraci[p].dlhy;
      return { pali: v[p].kapacita, ostane: v[p].poBitke - Math.max(0, teraz - v[p].kapacita) };
    }) as [VyhladPitky["dlhyBitka"], VyhladPitky["dlhyBitka"]];
  }, [nahladyPitky, stol, view, ja, vypijemVTahu, data, otocenaTeraz, dalsiePitky, zaklad]);
  const vyhladPitky = (p: PlayerId): VyhladPitky | null =>
    nahladyPitky === null || dlhyBitka === null
      ? null
      : {
          nahlad: nahladyPitky[p],
          vPitke: view.faza === "pitka",
          dalsiePitky,
          cenaCirhozy: cenyKliatob[p].cirhoza,
          cenaDlhu: cenyKliatob[p].dlh,
          dlhyBitka: dlhyBitka[p],
        };

  // Prečo na kartu NA EX nejde — hráč to vidí pri karte (dizajn hra-20261021-1240, UX N4).
  const dovodBezNaexNaKartu = (pl: PlacedCard): string => {
    const def = data.cards.get(pl.card.defId);
    if (pl.naexBy !== undefined) return t("plocha.uzLezi");
    if (def !== undefined && !def.tags.includes("Občan") && !def.tags.includes("Starešina"))
      return def.tags.includes("Nástroj") ? t("plocha.naexLenNastroj") : t("plocha.naexLen");
    if (naexLimitMinuty) return t("plocha.naexLimit");
    return t("plocha.naexAktivna");
  };
  /**
   * Kliatby z náhľadu NA EX či odpovede: Cirhóza s oboma cenami (nepriznaná
   * body, priznaná +1 tuhé súperovi), Dlh po najbližšej bitke (návrh #1 B).
   */
  const textKliatob = (k: KliatbyNahladu): string => {
    const znak = (n: number): string => `${n > 0 ? "+" : "−"}${Math.abs(n)}`;
    const cirhozy = k.cirhozy + k.dalejCirhozy;
    const dlhy = k.dlhy + k.dalejDlhy;
    const casti: string[] = [];
    if (cirhozy !== 0) casti.push(t("plocha.krajCirhoza", { n: znak(cirhozy) }) + (cirhozy > 0 ? t("plocha.cirhozaPriznana") : ""));
    if (dlhy !== 0) casti.push(t("plocha.krajDlh", { n: znak(dlhy) }) + (dlhy !== k.dlhyPoBitke ? t("plocha.dlhPoBitke", { n: k.dlhyPoBitke === 0 ? t("starsi.nic") : znak(k.dlhyPoBitke) }) : ""));
    if (k.dalejCirhozy !== 0 || k.dalejDlhy !== 0) casti.push(t("plocha.vratane"));
    return `${casti.length === 0 ? t("starsi.nic") : casti.join(", ")}${k.body !== 0 ? ` · ${k.body > 0 ? "+" : "−"}${Math.abs(k.body)} š` : ""}`;
  };
  /**
   * Zvyšok ceny ťahu (návrh #1, playtest 20261024-075830): cigarety z Pitiek
   * kola a mäkké do hádky (v10).
   * Len to, čo sa mení; null, keď sa nemení nič.
   */
  const textDopadov = (d: readonly [DopadyNahladu, DopadyNahladu]): string | null => {
    const znak = (n: number): string => `${n > 0 ? "+" : "−"}${Math.abs(n)}`;
    const kto = (p: PlayerId): string => (p === ja ? t("stol.ty") : menoHraca(super_));
    const hraci = [ja, super_] as const;
    const casti: string[] = [];
    const cig = hraci.filter((p) => d[p].cigarety !== 0).map((p) => `${kto(p)} ${znak(d[p].cigarety)}`);
    if (cig.length > 0) casti.push(t("plocha.cigaretyZoznam", { zoznam: cig.join(", ") }));
    const makke = hraci.filter((p) => d[p].makke !== 0).map((p) => `${kto(p)} ${znak(d[p].makke)}${d[p].makkeSpolu !== d[p].makke ? t("plocha.spoluZatvorka", { n: d[p].makkeSpolu }) : ""}`);
    if (makke.length > 0) casti.push(t("plocha.makkeZoznam", { zoznam: makke.join(", ") }));
    return casti.length === 0 ? null : casti.join(" · ");
  };
  /**
   * Efekty Prehra po bitke podľa stola (návrh #38 B) — jadro ich ráta (efektyPrehry), tie isté
   * slová ako klient AI hráčov; null, keď na stole nie sú.
   */
  const efektyPoBitke = (s: ClientState): string | null => {
    const e = efektyPrehry(data, s);
    const casti = ([ja, super_] as const).flatMap((p) => {
      const texty = textyEfektovPrehry(e, p, ja);
      return texty.length === 0 ? [] : [(p === ja ? t("plocha.kedPrehras") : t("plocha.kedPrehra", { meno: menoHraca(super_) })) + `: ${texty.join(", ")}`];
    });
    return casti.length === 0 ? null : casti.join("; ");
  };
  /** Efekty Prehra po NA EX na kartu `uid` — keď ich NA EX zmení, alebo mieri na kartu s Prehrou (Dievčina, Farár). */
  const poBitkeNaex = (po: ClientState, uid: number | null): string | null => {
    const text = efektyPoBitke(po);
    const defId = uid === null ? undefined : zaklad.strany.flat().find((pl) => pl.card.uid === uid)?.card.defId;
    const sPrehrou = defId === "dievcina_na_vydaj" || defId === "farar";
    return text !== efektyPoBitke(zaklad) || sPrehrou ? (text ?? t("starsi.nic")) : null;
  };
  /**
   * Prebytok bitky pred ťahom a po ňom, keď sa mení alebo ho kráti Puška či Miňištrant
   * (bitka to hlási v logu, náhľad mlčal — playtest 20261024-075830).
   */
  const textPrebytku = (a: PrebytokNahladu, b: PrebytokNahladu): string | null => {
    const popis = (x: PrebytokNahladu): string => {
      if (x.drzi === null || x.prebytok === 0) return t("priazen.ziadny");
      const kratenie = [
        ...(x.naRozdelenie !== x.prebytok ? [`${t("panel.puska")} −${x.prebytok - x.naRozdelenie}`] : []),
        ...(x.cenaPosunu > 1 ? [t("plocha.posunZa", { n: x.cenaPosunu })] : []),
      ];
      const posuny = kratenie.length === 0 ? "" : ` (${kratenie.join(", ")} → ${t("plocha.posunov", { n: x.posuny })})`;
      return `${x.drzi === ja ? t("plocha.tvoj") : t("plocha.superov")} ${x.prebytok}${posuny}`;
    };
    const rovnaky = a.drzi === b.drzi && a.prebytok === b.prebytok && a.posuny === b.posuny;
    if (rovnaky && b.naRozdelenie === b.prebytok && b.cenaPosunu === 1) return null;
    return rovnaky ? t("plocha.nakladacka", { x: popis(b) }) : t("plocha.nakladackaZmena", { a: popis(a), b: popis(b) });
  };
  /**
   * Cena NA EX skrátene pre jeden riadok pokynu (UI inšpekcia 20261024-nahlad, N3):
   * body z kliatob, cigarety a mäkké — podrobnosti sú v rozbalenom pokyne.
   */
  const kratkaCena = (k: readonly [KliatbyNahladu, KliatbyNahladu], d: readonly [DopadyNahladu, DopadyNahladu]): string | null => {
    const znak = (n: number): string => `${n > 0 ? "+" : "−"}${Math.abs(n)}`;
    const kto = (p: PlayerId): string => (p === ja ? t("stol.ty") : t("stol.superKratko"));
    const hraci = [ja, super_] as const;
    const casti = [
      ...hraci.filter((p) => k[p].body !== 0).map((p) => `${kto(p)} ${znak(k[p].body)} š`),
      ...hraci.filter((p) => d[p].cigarety !== 0).map((p) => `${kto(p)} ${znak(d[p].cigarety)} cig`),
      ...hraci.filter((p) => d[p].makke !== 0).map((p) => t("plocha.ktoMakke", { kto: kto(p), n: znak(d[p].makke) })),
    ];
    return casti.length === 0 ? null : casti.join(" · ");
  };
  // Možnosť NA EX pod myšou či fokusom — tá istá karta svieti na stole.
  // Karta z riadku hrozby (prejdenie myšou) — v línii sa zvýrazní.
  const [ukazHrozbu, setUkazHrozbu] = useState<number | null>(null);

  // Náhľad NA EX s celou cenou (dizajn hra-nezrovnalosti-20261021-1229, UI N4 + UX N3;
  // návrh #49 „áno, celá cena“): bitka pred a po, zmeny OBOCH hráčov, vzorec násobkov na
  // karte, kliatby, cigarety, Pohoršenia, mäkké a prebytok — všetko z nahladNaexNaKartu
  // v jadre, ktorá stôl po NA EX skladá krokmi motora (test nahlady-zuctovanie).
  const nahladNaex = useMemo(() => {
    const out = new Map<
      number,
      NahladNaexNaKartu & {
        readonly zmeny: readonly [string[], string[]];
        readonly vzorec: readonly string[];
        readonly majitel: PlayerId;
        readonly strana: PlayerId;
        readonly pozicia: number;
      }
    >();
    if (mode.typ !== "naexCiel" || odhad === null || nahladyPitky === null) return out;
    const nazov = (k: string): string => sada.akcie.find((a) => a.kluc === k)?.nazov ?? k;
    const dovod = (d: string): string =>
      d === "NA EX" ? "×2 NA EX" : d === "Posilnenie" ? "×2 Posilnenie" : d === "Forsáž" ? "×2 Forsáž" : d.startsWith("karta:") ? `×2 ${menoKarty(d.slice(6))}` : d;
    for (const uid of naexCiele) {
      const strana = view.strany[0].some((pl) => pl.card.uid === uid) ? 0 : 1;
      const index = view.strany[strana].findIndex((pl) => pl.card.uid === uid);
      const placed = view.strany[strana][index];
      if (placed === undefined) continue;
      const n = nahladNaexNaKartu(data, view, uid, cenyKliatob);
      if (n === null) continue;
      // Dlh Finančnej poradkyne pri súperovi, ako ho pripíše Pitka (NA EX nemení, čie karty ležia).
      const ev = sDlhmiPoradkyne(data, view, n.liniaPo);
      const liniaPred = sDlhmiPoradkyne(data, view, n.liniaPred);
      const zmeny = ([0, 1] as const).map((p) => {
        const kluce = new Set([...Object.keys(ev.sums[p]), ...Object.keys(liniaPred.sums[p])]) as Set<keyof (typeof ev.sums)[0]>;
        const out2: string[] = [];
        for (const k of kluce) {
          const rozdiel = (ev.sums[p][k] ?? 0) - (liniaPred.sums[p][k] ?? 0);
          if (rozdiel !== 0) out2.push(`${nazov(k)} ${rozdiel > 0 ? "+" : "−"}${Math.abs(rozdiel)}`);
        }
        return out2;
      }) as [string[], string[]];
      // Vzorec: akcie tejto karty po NA EX s dôvodmi zdvojenia (Rana 4: ×2 NA EX, ×2 Silná žena).
      // Z oboch strán — Dlh Finančnej poradkyne leží v rozpise súpera.
      const vzorec: string[] = [];
      for (const [akcia, zoznam] of ev.zdroje.flatMap((zdroje) => Object.entries(zdroje))) {
        for (const z of zoznam ?? []) {
          if (z.uid !== uid || z.hodnota <= 0) continue;
          const dovody = z.dovody.map(dovod);
          vzorec.push(`${nazov(akcia)} ${z.hodnota}${dovody.length > 0 ? ` (${dovody.join(" · ")})` : ""}`);
        }
      }
      out.set(uid, { ...n, zmeny, vzorec, majitel: placed.playedBy, strana, pozicia: index + 1 });
    }
    return out;
  }, [mode.typ, naexCiele, data, view, odhad, sada, nahladyPitky, cenyKliatob]);

  // Náhľad odpovede na NA EX (návrh #1 B): ten istý ako pri NA EX — bitka pred
  // a po navrhnutej karte, kliatby a ostatné dopady oboch hráčov (cenaTahu).
  const nahladOdpovede = useMemo(() => {
    if (!reagujem || odhad === null || stol.ciel === null || !vylozenia.some((x) => x.ciel === "vlastna" || x.ciel === "superova")) return null;
    return cenaTahu(data, view, { ...view, strany: stol.strany }, cenyKliatob);
  }, [reagujem, odhad, stol, vylozenia, view, data, cenyKliatob]);

  // Náhľad vyloženia na koniec strany (playtest 20261017-164450: ktorá hrana
  // sa spáruje, hráči zisťovali skúškou) — počas ťahania aj v návrhu.
  const nahladVylozeniaNa = (k: CardInstance, kam: "vlastna" | "superova"): NahladVylozenia =>
    nahladVylozenia(data, { ...lineState(view), strany: stol.strany }, ja, k, kam, view.naexVKole);
  // Výstraha pečene pred vyložením (Michal 2026-11-06): Cirhózy karty ešte skôr, než ide na stôl.
  // Na požiadanie a s pamäťou do zmeny stola — hrozba NA EX skúša celú líniu a ťahanie prekresľuje často.
  const { vystrahaVylozenia, vystrahaNavrhu } = useMemo(() => {
    const hraciSPecenou = (h: ClientState["hraci"], pecen: number): ClientState["hraci"] =>
      ja === 0 ? [{ ...h[0], pecen: h[0].pecen + pecen }, h[1]] : [h[0], { ...h[1], pecen: h[1].pecen + pecen }];
    const poNavrhu: ClientState = {
      ...zaklad,
      strany: stol.strany,
      hraci: hraciSPecenou(zaklad.hraci, plan?.poldeci ?? 0),
      ...(stol.prilozeniaKu === undefined ? {} : { prilozeniaKu: stol.prilozeniaKu }),
    };
    // Odpoveď na NA EX je jediná karta: nová nahradí navrhnutú, ráta sa teda bez nej.
    const pred = reagujem ? zaklad : poNavrhu;
    const pamat = new Map<string, VystrahaPecene | null>();
    const vystrahaVylozenia = (k: CardInstance, kam: StranaLinie): VystrahaPecene | null => {
      if (zaklad.ciel === null) return null;
      const kluc = `${k.uid}:${kam}`;
      const znama = pamat.get(kluc);
      if (znama !== undefined) return znama;
      // Ďalšia karta v tom istom ťahu sa platí plným poldeci — aj to je pečeň.
      const vypije = plan === null || reagujem ? 0 : planTahu([...vylozenia, { karta: k, ciel: kam }]).poldeci - plan.poldeci;
      const po = sPrilozenou(data, pred, kam === "vlastna" ? ja : super_, k, ja);
      const v = vystrahaPecene(data, pred, { ...po, hraci: hraciSPecenou(po.hraci, vypije) });
      pamat.set(kluc, v);
      return v;
    };
    const vystrahaNavrhu =
      plan === null || zaklad.ciel === null || !vylozenia.some((x) => x.ciel === "vlastna" || x.ciel === "superova") ? null : vystrahaPecene(data, zaklad, poNavrhu);
    return { vystrahaVylozenia, vystrahaNavrhu };
    // vylozenia, plan a planTahu sú odvodené z navrh a view.
  }, [data, view, navrh, zaklad, stol, reagujem, ja, super_]);
  const textVystrahy = (v: VystrahaPecene, karta: CardInstance): string =>
    vystrahaCela(v, ja, menoHraca(super_), menoKarty(stol.strany.flat().find((pl) => pl.card.uid === v.naex?.uid)?.card.defId ?? karta.defId));
  const nazovAkcie = (k: string): string => sada.akcie.find((a) => a.kluc === k)?.nazov ?? k;
  const piktogramyRekapitulacie: PiktogramyRekapitulacie = {
    ikona: (k) => <IkonaAkcie kluc={k} akcia={sada.akcie.find((a) => a.kluc === k)} />,
    nazov: nazovAkcie,
  };
  const textZmien = (z: ActionSums): string =>
    (Object.entries(z) as [string, number][]).map(([k, d]) => `${nazovAkcie(k)} ${d > 0 ? "+" : "−"}${Math.abs(d)}`).join(", ") || t("plocha.bezZmeny");
  // Zmeny akcií aj tuhé navyše z kariet (Pes, Recidivista…) — bonus Psa náhľad vynechal (playtest 20261026-173610-1).
  const textZmienVylozenia = (n: NahladVylozenia, p: PlayerId): string => {
    const akcie = textZmien(n.zmeny[p]);
    const navyse = n.tuhe[p];
    if (navyse === 0) return akcie;
    const tuhe = t("plocha.tuheNavyse", { n: `${navyse > 0 ? "+" : "−"}${Math.abs(navyse)}` });
    return akcie === t("plocha.bezZmeny") ? tuhe : `${akcie}, ${tuhe}`;
  };
  const textSpoja = (n: NahladVylozenia): string =>
    n.sused === null
      ? t("plocha.nicSaNespoji")
      : n.pary.length === 0
        ? t("plocha.nemaPar")
        : t("plocha.spoj", { pary: n.pary.map((p) => `${nazovAkcie(p.moja)} + ${nazovAkcie(p.susedova)}`).join(", ") });
  /** Hrana ako rad ikon zhora nadol (prázdny slot = pomlčka). */
  const hranaIkony = (h: readonly Slot[]): ReactNode => (
    <span className="hrana-ikony" title={t("plocha.zhoraNadol")}>
      {h.map((k, i) =>
        k === null ? (
          <span key={i} className="hi-prazdny">
            —
          </span>
        ) : (
          <span key={i} className="hi-slot" title={nazovAkcie(k)}>
            <IkonaAkcie kluc={k} akcia={sada.akcie.find((a) => a.kluc === k)} />
          </span>
        ),
      )}
    </span>
  );
  const nahladSpojov = useMemo(() => {
    // Náhľad poslednej navrhnutej karty do línie — na stole, kde už ležia tie pred ňou.
    const doLinie = vylozenia.filter((x) => x.ciel === "vlastna" || x.ciel === "superova");
    const posledna = doLinie[doLinie.length - 1];
    if (posledna === undefined) return null;
    let strany = view.strany;
    for (const x of doLinie.slice(0, -1)) {
      const kam = x.ciel === "vlastna" ? ja : super_;
      const nova: readonly PlacedCard[] = [...strany[kam], { card: x.karta, playedBy: ja }];
      strany = kam === 0 ? [nova, strany[1]] : [strany[0], nova];
    }
    // Konflikt a Podpora pri priložení ukáže náhľad tak, ako ich zloží motor (sPrilozenou).
    const stranyPo = sPrilozenou(data, { ...view, strany }, posledna.ciel === "vlastna" ? ja : super_, posledna.karta, ja).strany;
    const n = nahladVylozenia(data, { ...lineState(view), strany }, ja, posledna.karta, posledna.ciel === "vlastna" ? "vlastna" : "superova", view.naexVKole, stranyPo);
    return { n, uid: posledna.karta.uid, spoj: textSpoja(n), ja: textZmienVylozenia(n, ja), su: textZmienVylozenia(n, super_) };
    // vylozenia sú odvodené z navrh a view.
  }, [data, view, navrh, ja, super_, sada]);

  // ---- výber miesta klikom (Michal 2026-10-20) -----------------------------
  // Okrem ťahania: hráč klikne na koniec strany a z ruky sa vysunú karty, ktoré
  // tam vytvoria spoj — akcie spoja svietia na nich aj na susedovi. Karty, ktoré
  // sa tam dajú položiť bez spoja, ostanú stlmené; nepoložiteľné stlmené ešte viac.
  const [miestoVolby, setMiestoVolby] = useState<StranaLinie | null>(null);
  useEffect(() => setMiestoVolby(null), [klucTahu]);
  useEffect(() => {
    if (!vykladam) setMiestoVolby(null);
  }, [vykladam]);
  const moznostiMiesta = useMemo(() => {
    // kratko: text na úzke miesto, kde by sa dlhé slová lámali v polovici; celý dôvod ostáva v title.
    const out = new Map<StranaLinie, { readonly karty: ReadonlyMap<number, NahladVylozenia>; readonly dovod: string | null; readonly kratko?: string }>();
    if (!vykladam) return out;
    const volne = ruka.filter((k) => !vylozenia.some((x) => x.karta.uid === k.uid));
    const zablokovane = zablokovaneStrany(view);
    for (const c of ["vlastna", "superova"] as const) {
      // Za kartou lícom dole sa nedá priložiť — jadro by vrátilo len všeobecné „sem nemôžeš“.
      // Odpoveď na NA EX (v9.2): po útočníkovi smie obranca len na druhý kraj línie.
      const krajOdpovede = reagujem ? (view.pitkaStav?.krajOdpovede ?? null) : null;
      if (krajOdpovede !== null && (c === "vlastna" ? ja : super_) === krajOdpovede) {
        out.set(c, { karty: new Map(), dovod: t("plocha.uzOdpovedal"), kratko: t("plocha.druhyKraj") });
        continue;
      }
      if (zablokovane[c === "vlastna" ? ja : super_]) {
        out.set(c, { karty: new Map(), dovod: t("plocha.zaZaverecnou"), kratko: t("plocha.azPoPitke") });
        continue;
      }
      const karty = new Map<number, NahladVylozenia>();
      let dovod: string | null = null;
      for (const k of volne) {
        // Odpoveď na NA EX je jediná karta — nová nahradí navrhnutú, ráta sa teda bez nej.
        const chyba = reagujem
          ? cieleOdpovede(data, view, ja, k).includes(c)
            ? null
            : t("plocha.semZiadnu")
          : planTahu([...vylozenia, { karta: k, ciel: c }]).chyba;
        if (chyba !== null) {
          dovod ??= chyba;
          continue;
        }
        karty.set(k.uid, reagujem ? nahladVylozenia(data, lineState(view), ja, k, c, view.naexVKole) : nahladVylozeniaNa(k, c));
      }
      out.set(c, { karty, dovod: karty.size > 0 ? null : (dovod ?? t("plocha.nemasKartu")) });
    }
    return out;
    // vylozenia a planTahu sú odvodené z navrh a view; nahladVylozeniaNa zo stol.
  }, [data, view, navrh, ruka, vykladam, reagujem, stol, ja]);
  const vybraneMiesto = miestoVolby === null ? undefined : moznostiMiesta.get(miestoVolby);
  /** Klik na kartu v ruke pri vybranom mieste: karta ide na stôl ako návrh. */
  const polozNaMiesto = (k: CardInstance): void => {
    if (miestoVolby === null || vybraneMiesto?.karty.has(k.uid) !== true) return;
    const ciel = miestoVolby;
    setNavrh({
      typ: "vylozenia",
      polozky: reagujem ? [{ uid: k.uid, ciel }] : [...vylozenia.map((x) => ({ uid: x.karta.uid, ciel: x.ciel })), { uid: k.uid, ciel }],
    });
    setMiestoVolby(null);
  };
  /** Navrhnutá karta späť do ruky (pravý klik). */
  const vratDoRuky = (uid: number): void => {
    const zvysok = vylozenia.filter((x) => x.karta.uid !== uid).map((x) => ({ uid: x.karta.uid, ciel: x.ciel }));
    setNavrh(zvysok.length === 0 ? null : { typ: "vylozenia", polozky: zvysok });
  };
  useEffect(() => {
    if (miestoVolby === null) return;
    const klaves = (e: KeyboardEvent): void => {
      if (e.key === "Escape") setMiestoVolby(null);
    };
    window.addEventListener("keydown", klaves);
    return () => window.removeEventListener("keydown", klaves);
  }, [miestoVolby]);
  /**
   * Akcie suseda na konci vybranej strany, s ktorými sa niektorá karta z ruky
   * spáruje — na vytlačených stranách suseda (otočená karta má hrany obrátené).
   */
  const spojSuseda = useMemo(() => {
    if (vybraneMiesto === undefined || miestoVolby === null) return null;
    let sused: NahladVylozenia["sused"] = null;
    const indexy = new Set<number>();
    for (const n of vybraneMiesto.karty.values()) {
      if (n.sused === null || n.pary.length === 0) continue;
      sused = n.sused;
      for (const p of n.pary) indexy.add(p.index);
    }
    if (sused === null) return null;
    const otocena = sused.stred ? view.lokalitaOtocena !== (ja === 1) : sused.majitel !== ja;
    // Z pohľadu hráča sa k novej karte obracia na jeho strane ľavá hrana suseda, na súperovej pravá.
    const vPohlade: "left" | "right" = miestoVolby === "vlastna" ? "left" : "right";
    const vytlacena: "left" | "right" = otocena ? (vPohlade === "left" ? "right" : "left") : vPohlade;
    const dlzka = printedSides(data, sused.karta)[vytlacena].length;
    const sloty = [...indexy].map((i) => (otocena ? dlzka - 1 - i : i));
    return { uid: sused.karta.uid, spoj: vytlacena === "left" ? { left: sloty, right: [] } : { left: [], right: sloty } };
  }, [vybraneMiesto, miestoVolby, view.lokalitaOtocena, ja, data]);
  const spojPre = (uid: number) => (spojSuseda?.uid === uid ? spojSuseda.spoj : undefined);

  // Veštica si pri začiatku kroku pripraví prázdny výber.
  const bs0 = view.bitkaStav;
  const krokVyberu: string | null =
    bs0 !== null && bs0.caka === ja ? (bs0.krok ?? null) : null;
  useEffect(() => {
    if (krokVyberu === "vestica") setMode({ typ: "vestica", moja: null, jeho: null });
  }, [krokVyberu, klucTahu]);

  // Vízia na stole (Michal 2026-11-08, mockup V-B): karty na plsti nad rukou, voľby na spodnej hrane.
  const viziaK = view.vizia !== null && somNaTahu && view.koniec === null ? view.volbaVizia : null;
  const viziaK2 = viziaK === null ? null : (view.volbaViziaDruha ?? null);
  /** Nová Vízia (aj ďalšia v tej istej Pitke) = nový kľúč — karty znova vyjdú z balíčka. */
  const klucVizie = viziaK === null ? null : `${view.kolo}-${view.pitkaCislo}-${viziaK.uid}-${viziaK2?.uid ?? ""}-${view.vizia?.zostava[ja] ?? 0}`;
  const kartyVizie: readonly KartaVizie[] = [viziaK, viziaK2].flatMap((k, i) =>
    k === null
      ? []
      : [{ kluc: k.uid, nazov: menoKarty(k.defId), ...(viziaK2 === null ? {} : { popis: i === 0 ? t("plocha.vrchna") : t("plocha.druha") }), render: (sirka: number) => sLupou({ karta: k, sirka }) }],
  );
  const rozmerKarietVizie = rozmerVizie(vnutroPlste, kartyVizie.length, naSirku);

  const posli = (c: Command): void => {
    cmd(c);
    setMode({ typ: "ziadny" });
    // Vo výučbe môže server ťah odmietnuť radou Melichara („Otoč ho, klikni naň ešte raz“) — návrh
    // ostane na stole, nech ho hráč opraví; prijatý ťah zmení klucTahu a návrh zmizne aj tak.
    if (vyucba !== true) setNavrh(null);
  };
  // Menej klikov (roadmapa #9 B): logika je v usePohodlie a v jadre (pohodlie.ts).
  const bezNaex = useBezNaexVBitke(view, posli);
  const odlozenyPas = useOdlozenyPrikaz(posli, `${klucTahu}|${vylozenia.length}`); // potiahnutá karta pas zruší

  // ---- rozdelenie Nakladačky (strach) a hádky (reči), v11 Strach a reči ----------------
  // Zdvihy pri starších sú nepotvrdené v stave klienta; Potvrdiť ich pošle serveru jedným
  // zámerom, Návrh ich vyplní (navrhRozdelenia jadra), Reset (aj Esc) ich zahodí. Cenu, zvyšok
  // a úplnosť ráta jadro (planRozdelenia) — ten istý výpočet, aký urobí server.
  const krokDelenia = somNaTahu && view.koniec === null ? krokRozdelenia(view, ja) : null;
  const [zdvihyDelenia, setZdvihyDelenia] = useState<readonly Zdvih[]>([]);
  // Zajatia (Nakladačka) či presvedčenia (hádka), v11.4 — starší, ktorých hráč zvolil tlačidlom.
  const [akcieDelenia, setAkcieDelenia] = useState<readonly string[]>([]);
  const klucDelenia =
    krokDelenia === null
      ? null
      : `${view.kolo}|${krokDelenia}|${bodyRozdelenia(view, ja)}|${view.starsi.map((e) => `${e.strach.join("")}${e.reci.join("")}${e.reciOd?.join("") ?? ""}`).join("|")}`;
  useEffect(() => {
    setZdvihyDelenia([]);
    setAkcieDelenia([]);
  }, [klucDelenia]);
  const planDelenia = krokDelenia === null ? null : suhrnRozdelenia(view, ja, zdvihyDelenia, akcieDelenia);
  const resetDelenia = (): void => {
    setZdvihyDelenia([]);
    setAkcieDelenia([]);
  };
  /** Pečiatka Zajať / Presvedčiť (v11.6): prepne akciu pri staršom; presvedčenie dotiahne reči na červenú. */
  const prepniAkciuDelenia = (elderId: string): void => {
    if (planDelenia === null) return;
    if (akcieDelenia.includes(elderId)) {
      setAkcieDelenia(akcieDelenia.filter((x) => x !== elderId));
      return;
    }
    setAkcieDelenia([...akcieDelenia, elderId]);
    const nove = zdvihyPreAkcie(view, ja, planDelenia.marker, [elderId]);
    setZdvihyDelenia((x) => [...x.filter((z) => z.elderId !== elderId), ...nove]);
  };
  // Esc = Reset nepotvrdených zdvihov — až keď nie je otvorená lupa či dialóg (ten Esc zje skôr).
  const maZdvihyDelenia = zdvihyDelenia.length + akcieDelenia.length > 0;
  useEffect(() => {
    if (!maZdvihyDelenia) return;
    const klaves = (e: KeyboardEvent): void => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      const otvorene = (sel: string): boolean => [...document.querySelectorAll(sel)].some((el) => el.getClientRects().length > 0);
      if (otvorene('.lupa:not(.doznieva), [role="dialog"]')) return;
      e.preventDefault();
      setZdvihyDelenia([]);
      setAkcieDelenia([]);
    };
    window.addEventListener("keydown", klaves);
    return () => window.removeEventListener("keydown", klaves);
  }, [maZdvihyDelenia]);
  const klikDelenia = (elderId: string, stupen: number): void => setZdvihyDelenia((x) => klikNaStupen(view, ja, x, elderId, stupen, akcieDelenia));
  // Výučba čaká konkrétne rozdelenie (v11 jeden zámer so zdvihmi aj na viac starších) — zdvih na iného
  // staršieho, než scenár chce, server odmietne; Potvrdiť povie prečo.
  const chybaDeleniaVyucby = ((): string | null => {
    const o = vyucbaOcakava;
    if (o === undefined || o === null || planDelenia === null || (o.type !== "reci" && o.type !== "prebytok")) return null;
    const ciele = new Set(o.zdvihy.map((z) => z.elderId));
    if (ciele.size === 0 || zdvihyDelenia.every((z) => ciele.has(z.elderId))) return null;
    const mena = [...ciele].map((id) => menoKarty(view.starsi.find((e) => e.elderId === id)?.karta.defId ?? id)).join(", ");
    return o.type === "reci" ? t("plocha.vyucbaReci", { mena }) : t("plocha.vyucbaStrach", { mena });
  })();

  // ---- čo sa práve stalo (dizajn hra-20261021-1240, UX N3) -------------------
  // Keď môj ťah skončí, zapamätá sa línia a dĺžka logu. Keď som znova na ťahu,
  // súperove karty, ktoré medzitým pribudli, nesú štítok „nová“ a pás ukáže,
  // čo súper urobil — bez otvárania logu.
  const liniaPoMojomTahu = useRef<ReadonlySet<number> | null>(null);
  useEffect(() => {
    if (somNaTahu) return;
    liniaPoMojomTahu.current = new Set([...view.strany[0], ...view.strany[1]].map((pl) => pl.card.uid));
    // Snímka len pri konci môjho ťahu — nie pri každom súperovom vyložení.
  }, [somNaTahu]);
  // Záverečné odhalené na konci poslednej Pitky (Michal 2026-10-27): karta sa na stole otočí
  // lícom hore a do konca ďalšieho Zhromaždenia nesie štítok — súper (aj bot) často hneď
  // zahrá novú Záverečnú na tú istú stranu a bez neho to vyzerá, akoby sa stará neotočila.
  // Ktoré karty to sú, hovorí rekapitulácia Pitky (udalosť pitkaRekap).
  const [otoceneZaverecne, setOtoceneZaverecne] = useState<{ readonly kolo: number; readonly pitka: number; readonly uids: ReadonlySet<number>; readonly od: number } | null>(null);
  const otoceneTeraz: ReadonlySet<number> =
    otoceneZaverecne !== null && otoceneZaverecne.kolo === view.kolo && otoceneZaverecne.pitka === view.pitkaCislo ? otoceneZaverecne.uids : new Set();
  // Animácia otočenia beží len hneď po Pitke, nie pri každom neskoršom prekreslení.
  const odhalenieCerstve = otoceneZaverecne !== null && Date.now() - otoceneZaverecne.od < ODHALENIE_MS + 600;
  const noveSuperove: readonly number[] =
    somNaTahu && liniaPoMojomTahu.current !== null
      ? [...view.strany[0], ...view.strany[1]]
          .filter((pl) => pl.playedBy === super_ && !(liniaPoMojomTahu.current?.has(pl.card.uid) ?? true))
          .map((pl) => pl.card.uid)
      : [];
  const menoSupera = menoHraca(super_);

  // Účet Pitky a bitky (UX N2/N3, UI N5 „bloček“ v striedmej podobe): čo
  // vyhodnotenie komu pripísalo — inak to bolo len v logu a skóre skočilo bez súhrnu.
  const [ucetPitky, setUcetPitky] = useState<UcetPitky | null>(null);
  const vysledokBitky = useRef<Extract<Event, { type: "bitkaVysledok" }> | null>(null);
  // Počítadlo bitky (Michal 2026-10-23) a pod ním rekapitulácia; po Pitke jej rekapitulácia
  // (roadmapa #106). Vrstvy idú po rade, na stole je vždy len prvá z fronty, a každú zavrie až
  // hráč (Ďalej). Stôl bitky je ten s líniou — keď bitka hneď skončila
  // a línia už zmizla, predošlý pohľad.
  const [frontaVrstiev, setFrontaVrstiev] = useState<readonly VrstvaVyhodnotenia[]>([]);
  // Automatický pas (Michal 2026-11-02: „hra pasne za neho a zrazu súper vyloží 3 karty a ani
  // nevie prečo“): okno s dôvodom, kým ho hráč nezavrie, stôl stojí a vyhodnotenia čakajú za ním.
  const oknoAutoPasu = prehravanie === undefined && vyucba !== true;
  const [autoPas, setAutoPas] = useState<{ readonly id: number; readonly dovody: readonly string[]; readonly superVyklada: boolean } | null>(null);
  const vrstvaVyhodnotenia = autoPas === null ? (frontaVrstiev[0] ?? null) : null;
  const pocitadlo = vrstvaVyhodnotenia?.druh === "bitka" ? vrstvaVyhodnotenia : null;
  const pocitadloAktivne = useRef(false);
  const koniecPocitadla = useCallback(() => {
    setFrontaVrstiev((f) => {
      pocitadloAktivne.current = f.length > 1;
      return f.slice(1);
    });
  }, []);
  // Zastavenie po poslednej Pitke: Ďalej = koniecPocitadla (vyhodnotenie Pitky a bitky ide po rade),
  // Preskočiť zavrie zastavenie aj vyhodnotenia, ktoré za ním čakajú — ako Preskočiť pri súhrne starších.
  const zastavenieBezi = vrstvaVyhodnotenia?.druh === "stol";
  const preskocVyhodnotenie = useCallback(() => {
    pocitadloAktivne.current = false;
    setFrontaVrstiev([]);
  }, []);
  // Kým sa na stole otáča Záverečná, rekapitulácia Pitky čaká (ODHALENIE_MS).
  const [cakaOdhalenie, setCakaOdhalenie] = useState(false);
  const casovacOdhalenia = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (casovacOdhalenia.current !== null) clearTimeout(casovacOdhalenia.current);
  }, []);
  const pocitadloBezi = vrstvaVyhodnotenia !== null || cakaOdhalenie;
  useEffect(() => onPocitadlo?.(pocitadloBezi), [pocitadloBezi, onPocitadlo]);
  // Odpovede na NA EX (udalosť odpovedNaNaex) prichádzajú aj v inom ťahu než vyhodnotenie
  // Pitky — zbierajú sa do jej rekapitulácie a za celé kolo do rekapitulácie bitky.
  const odpovedePitky = useRef<OdpovedNaNaex[]>([]);
  const odpovedeKola = useRef<OdpovedNaNaex[]>([]);
  useEffect(() => {
    const nove: VrstvaVyhodnotenia[] = [];
    const events = udalosti?.events ?? [];
    let odhalenie = false;
    // Zastavenie po poslednej Pitke (Michal 2026-11-09) — výučba má svoj scenár, prehrávač svoje tempo.
    const zastavenie = vyucba !== true && prehravanie === undefined && zadrzBitku === null ? poslednaPitkaVDavke(events) : -1;
    for (const [i, e] of events.entries()) {
      if (e.type === "odpovedNaNaex") {
        const o: OdpovedNaNaex = { hrac: e.hrac, defId: e.defId, ciel: e.ciel };
        odpovedePitky.current.push(o);
        odpovedeKola.current.push(o);
      }
      const zaverecne = e.type === "pitkaRekap" ? (e.rekap.zaverecne ?? []) : [];
      if (e.type === "pitkaRekap" && zaverecne.length > 0) {
        odhalenie = true;
        setOtoceneZaverecne({ kolo: view.kolo, pitka: e.rekap.pitka, uids: new Set(zaverecne.map((z) => z.uid)), od: Date.now() });
      }
      if (e.type === "pitkaVysledok") setUcetPitky({ kolo: view.kolo, pitka: e.pitka, cirhozy: e.cirhozy, dlhy: e.dlhy, cigarety: e.cigarety });
      // Poslednú Pitku kola ukáže rekapitulácia bitky („z Pitiek kola“), nie vlastná vrstva (Michal 2026-10-26) —
      // okrem Pitky s NA EX či odpoveďou (Michal 2026-10-28): medzi ňou a rekapituláciou bitky býva
      // hádka, Nakladačka aj Vízia, a hráč musí hneď vidieť, čo NA EX a odpoveď spravili.
      if (e.type === "pitkaRekap") {
        if (i === zastavenie) nove.push({ druh: "stol", pitka: e.rekap.pitka });
        const odpovede = odpovedePitky.current;
        odpovedePitky.current = [];
        if (!pitkaPredBitkou(events, i) || e.rekap.naex.karty.length > 0 || odpovede.length > 0) {
          const ciel = view.ciel ?? predoslyView.current?.ciel ?? null;
          const lok = ciel?.lokalita ?? null;
          // Skóre bitky pred Pitkou a po nej z verejnej línie (to isté, čo ráta odhad na stole).
          const tuhe = (s: ClientState | null): readonly [number, number] | null =>
            s === null || s.ciel === null || s.strany.every((x) => x.length === 0) ? null : poskodenieBitky(data, s, evaluateLine(data, lineState(s)).sums).tuhe;
          const pred = tuhe(predoslyView.current);
          const po = tuhe(viewZoServera);
          nove.push({
            druh: "pitka",
            r: e.rekap,
            nadpis: `Pitka ${e.rekap.pitka} / ${e.rekap.pitkyCelkom}${lok === null ? "" : ` · ${menoKarty(lok.defId)}`}`,
            odpovede,
            skore: pred === null || po === null ? null : { pred, po },
          });
        }
      }
      if (e.type === "bitkaVysledok") {
        vysledokBitky.current = e;
        const zaklad = view.ciel !== null && view.strany.some((s) => s.length > 0) ? view : (predoslyView.current ?? view);
        // Línia z udalosti: keď bitka prišla v tom istom ťahu ako odpoveď na NA EX, posledný
        // pohľad odpoveď ešte nemal a Počítadlo by rátalo bez nej (Michal 2026-10-28).
        const stol: ClientState = e.strany === undefined ? zaklad : { ...zaklad, strany: e.strany };
        const odpovede = odpovedeKola.current;
        odpovedeKola.current = [];
        if (stol.ciel !== null) {
          const linia = evaluateLine(data, lineState(stol));
          nove.push({ druh: "bitka", p: pocitadloBitky(data, stol, linia, e.damage.tuhe), stol, linia, rekap: e.rekap ?? null, odpovede });
        }
      }
    }
    if (nove.length === 0) return;
    // Momenty (Výprask, Zvrat…) patria k poslednému vyhodnoteniu dávky.
    const momentyDavky = events.flatMap((e) => (e.type === "moment" ? [e.moment] : []));
    const posledna = nove.at(-1);
    if (momentyDavky.length > 0 && posledna !== undefined && posledna.druh !== "stol") nove[nove.length - 1] = { ...posledna, momenty: momentyDavky };
    pocitadloAktivne.current = true;
    // Prehrávač pri posúvaní nehromadí vrstvy — ukáže len tú z práve zobrazeného kroku.
    if (prehravanie !== undefined) setFrontaVrstiev(nove);
    else if (zadrzBitku === null) {
      // Stôl ostane taký, aký bol na konci Pitky či v bitke, kým hráč vyhodnotenie nezavrie —
      // inak pod ním (aj počas otáčania Záverečných) preskočí na súperove posuny starších
      // a stôl ďalšieho kola (Michal 2026-10-30). Keď je server už v ďalšom kole, drží sa stôl bitky.
      if (vyucba !== true) {
        const bitka = nove.find((v) => v.druh === "bitka");
        setZadrzanyView(
          (z) =>
            z ??
            (zastavenie >= 0
              ? stolZastavenia(viewZoServera, bitka?.stol ?? null)
              : bitka !== undefined && bitka.stol.kolo !== viewZoServera.kolo
                ? bitka.stol
                : viewZoServera),
        );
      }
      // Zastavenie stôl neprekryje — Záverečná sa otočí priamo pod ním, rekapitulácia počká na Ďalej.
      if (odhalenie && zastavenie < 0) {
        // Najprv nech hráč vidí, ako sa Záverečná na stole otočí, až potom rekapitulácia.
        setCakaOdhalenie(true);
        if (casovacOdhalenia.current !== null) clearTimeout(casovacOdhalenia.current);
        casovacOdhalenia.current = setTimeout(() => {
          casovacOdhalenia.current = null;
          setFrontaVrstiev((f) => [...f, ...nove]);
          setCakaOdhalenie(false);
        }, ODHALENIE_MS);
      } else setFrontaVrstiev((f) => [...f, ...nove]);
    } else setOdlozeneBitky((o) => ({ krok: zadrzBitku, vrstvy: [...(o?.vrstvy ?? []), ...nove] }));
    // Len nové udalosti — view.kolo je to isté prekreslenie.
  }, [udalosti?.id]);
  // Odložené vrstvy sa spustia, keď výučba prejde na ďalší krok — ešte pred vykreslením, aby text
  // nového kroku nebolo vidno skôr než animáciu.
  const [odlozeneBitky, setOdlozeneBitky] = useState<{ readonly krok: string; readonly vrstvy: readonly VrstvaVyhodnotenia[] } | null>(null);
  useLayoutEffect(() => {
    if (odlozeneBitky === null || odlozeneBitky.krok === zadrzBitku) return;
    setFrontaVrstiev((f) => [...f, ...odlozeneBitky.vrstvy]);
    setOdlozeneBitky(null);
  }, [odlozeneBitky, zadrzBitku]);
  // Malé pečiatky krokov (Michal 2026-10-30): pas v Zhromaždení a koniec brania zo šenku.
  const [peciatkaKroku, setPeciatkaKroku] = useState<{ readonly id: number; readonly p: readonly PeciatkaKroku[] } | null>(null);
  useEffect(() => {
    if (prehravanie !== undefined) return;
    // Vlastný pas, ktorý urobila hra, vysvetlí okno — pečiatka by svietila nad ním. Hasič naprázdno
    // len tomu, kto ho vyložil (Michal 2026-11-03) — súperovi stačí log.
    const nove = peciatkyKrokov(udalosti?.events ?? []).filter((x) => !(oknoAutoPasu && x.auto === true && x.hrac === ja) && (x.druh !== "hasic" || x.hrac === ja));
    if (nove.length > 0) setPeciatkaKroku({ id: udalosti?.id ?? 0, p: nove });
    const mojAutoPas = oknoAutoPasu ? (udalosti?.events ?? []).find((e) => e.type === "autoPas" && e.hrac === ja) : undefined;
    if (mojAutoPas?.type === "autoPas") {
      // Stôl ostane taký, aký bol pri pase — súperove ďalšie ťahy prídu až po Rozumiem.
      setZadrzanyView((z) => z ?? viewZoServera);
      setAutoPas({ id: udalosti?.id ?? 0, dovody: mojAutoPas.dovody, superVyklada: viewZoServera.faza === "zhromazdenie" });
    }
    // Len nové udalosti.
  }, [udalosti?.id]);
  useEffect(() => {
    if (peciatkaKroku === null) return;
    // Pečiatku, ktorá vysvetľuje, čo urobila hra (auto pas, Hasič naprázdno), treba aj dočítať.
    const ms = peciatkaKroku.p.some((x) => x.auto === true || x.druh === "hasic") ? PECIATKA_AUTO_PASU_MS : PECIATKA_KROKU_MS;
    const t = setTimeout(() => setPeciatkaKroku((x) => (x?.id === peciatkaKroku.id ? null : x)), ms);
    return () => clearTimeout(t);
  }, [peciatkaKroku]);
  // Vyhodnotenie zavreté (Ďalej) — stôl dobehne na to, čo medzitým poslal server.
  useEffect(() => {
    if (zadrzanyView !== null && !cakaOdhalenie && frontaVrstiev.length === 0 && autoPas === null) setZadrzanyView(null);
  }, [zadrzanyView, cakaOdhalenie, frontaVrstiev, autoPas]);
  const [ucetBitky, setUcetBitky] = useState<UcetBitky | null>(null);
  const [ucetBitkyZavrety, setUcetBitkyZavrety] = useState(false);
  const predoslyView = useRef<ClientState | null>(null);
  const viewPredBitkou = useRef<ClientState | null>(null);
  useEffect(() => {
    const pred = predoslyView.current;
    predoslyView.current = view;
    if (pred === null) return;
    if (view.faza === "bitka" && pred.faza !== "bitka") viewPredBitkou.current = pred;
    const skoncila = view.kolo > pred.kolo || (view.koniec !== null && pred.koniec === null && pred.ciel !== null);
    if (!skoncila) return;
    const zaklad = viewPredBitkou.current !== null && viewPredBitkou.current.kolo === pred.kolo ? viewPredBitkou.current : pred;
    viewPredBitkou.current = null;
    const v = vysledokBitky.current;
    vysledokBitky.current = null;
    // v6: lokalita ide na nástenku; víťaz dostane špaky, pri sekere čakajú (vo finále prepadnú).
    const bitka = view.nastenka.find((b) => b.kolo === pred.kolo) ?? null;
    const posuny = view.starsi.flatMap((e) => {
      const a = zaklad.starsi.find((x) => x.elderId === e.elderId);
      const priazen = (x: Pick<ElderState, "strach">): number => x.strach[1] - x.strach[0];
      return a === undefined || priazen(a) === priazen(e) ? [] : [{ meno: menoKarty(e.karta.defId), pred: priazen(a), po: priazen(e) }];
    });
    setUcetBitky({
      kolo: pred.kolo,
      lokalita:
        zaklad.ciel === null || zaklad.ciel.lokalita === null
          ? zaklad.ciel?.typ === "finale" ? t("faza.finale") : ""
          : zaklad.ciel.typ === "finale" ? t("spaky.finaleLokalita", { meno: menoKarty(zaklad.ciel.lokalita.defId) }) : menoKarty(zaklad.ciel.lokalita.defId),
      tuhe: v?.damage.tuhe ?? [0, 0],
      vitaz: v?.vitaz ?? null,
      prebytok: v?.prebytok ?? 0,
      prebytokNaRozdelenie: v?.prebytokNaRozdelenie ?? 0,
      prebytokDrzi: v?.prebytokDrzi ?? null,
      bitka,
      posuny,
      // Pred bitkou = po nej mínus to, čo bitka dala (pohľad pred výsledkom nemusí byť k dispozícii).
      spakyPred: bitka === null ? [zaklad.spaky[0], zaklad.spaky[1]] : spakyPredBitkou(bitka),
    });
    setUcetBitkyZavrety(false);
    // Porovnáva sa len predošlý a nový pohľad.
  }, [view]);
  // Výsledok bitky je toast na stole (Michal 2026-10-28: pás nad stolom zmenšoval plochu) —
  // zmizne sám, klik ho zavrie, klik na Bitku v lište ho ukáže znova. Vo výučbe o ňom hovorí
  // Melichar, preto tam čaká na klik.
  const ukazUcetBitky =
    ucetBitky !== null && !ucetBitkyZavrety && view.kolo === ucetBitky.kolo + 1 && (view.faza === "volbaCiela" || view.faza === "natocenieCiela" || view.faza === "draft");
  useEffect(() => {
    if (!ukazUcetBitky || vyucba === true) return;
    const t = setTimeout(() => setUcetBitkyZavrety(true), TOAST_STOLA_MS);
    return () => clearTimeout(t);
  }, [ukazUcetBitky, vyucba]);

  // Titulok karty prehliadača — hráč v inej karte vidí, že je na ťahu (UX N1, U9).
  useEffect(() => {
    const povodny = document.title;
    return () => {
      document.title = povodny;
    };
  }, []);
  useEffect(() => {
    document.title =
      view.koniec !== null
        ? t("stol.titulKoniec")
        : somNaTahu
          ? t("stol.titulMojTah", { faza: t(NAZOV_FAZY[view.faza] ?? "") })
          : t("stol.titulTahSupera", { meno: menoSupera });
  }, [somNaTahu, view.faza, view.koniec, menoSupera]);

  // Posun k miestu ťahu pri zmene fázy alebo kroku (UX N1, U3): aktívna plocha
  // pod časovú os. Nie, ak hráč za posledné 3 s sám roloval, a bez animácie pri
  // prefers-reduced-motion.
  const cielPanelRef = useRef<HTMLElement>(null);
  const draftPanelRef = useRef<HTMLElement>(null);
  const liniaObalRef = useRef<HTMLDivElement>(null);
  // Pokyn v toku (výučba, pokyn s kartami) leží stredom na hrane stola — CSS potrebuje jeho výšku
  // (--pilulka-h) a vráti, o koľko ustúpi obsah plste (--pilulka-presah); o to sa zmenší nástenka.
  const [presahPilulky, setPresahPilulky] = useState(0);
  const pilulkaRef = useCallback((el: HTMLDivElement | null) => {
    const obal = el?.parentElement;
    if (el === null || obal === null || obal === undefined) return;
    const ro = new ResizeObserver(() => {
      obal.style.setProperty("--pilulka-h", `${el.getBoundingClientRect().height}px`);
      setPresahPilulky(Math.round(parseFloat(getComputedStyle(obal).getPropertyValue("--pilulka-presah")) || 0));
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      obal.style.removeProperty("--pilulka-h");
      setPresahPilulky(0);
    };
  }, []);
  // Vrstva nástenky na stole — lístky na výber pri voľbe cieľa sa rátajú z jej skutočnej plochy.
  const [rozmerVrstvyNastenky, setRozmerVrstvyNastenky] = useState<{ readonly w: number; readonly h: number } | null>(null);
  const vrstvaNastenkyRef = useCallback((el: HTMLDivElement | null) => {
    if (el === null) return;
    const ro = new ResizeObserver(() =>
      setRozmerVrstvyNastenky((x) => (x !== null && x.w === el.clientWidth && x.h === el.clientHeight ? x : { w: el.clientWidth, h: el.clientHeight })),
    );
    ro.observe(el);
    return () => {
      ro.disconnect();
      setRozmerVrstvyNastenky(null);
    };
  }, []);
  const posledneRolovanie = useRef(0);
  useEffect(() => {
    const zaznamenaj = (): void => {
      posledneRolovanie.current = Date.now();
    };
    window.addEventListener("wheel", zaznamenaj, { passive: true });
    window.addEventListener("touchmove", zaznamenaj, { passive: true });
    return () => {
      window.removeEventListener("wheel", zaznamenaj);
      window.removeEventListener("touchmove", zaznamenaj);
    };
  }, []);
  useEffect(() => {
    if (!somNaTahu || view.koniec !== null || Date.now() - posledneRolovanie.current < 3000) return;
    const krok = view.bitkaStav?.krok;
    const el: HTMLElement | null =
      view.faza === "volbaCiela"
        ? cielPanelRef.current
        : view.faza === "draft"
          ? (draftPanelRef.current ?? liniaObalRef.current)
          : view.faza === "bitka" && (krok === "reci" || krok === "prebytok")
            ? liniaObalRef.current
            : liniaObalRef.current;
    if (el === null) return;
    const r = el.getBoundingClientRect();
    const hore = vyskaHlavicky + 56;
    const dole = window.innerHeight - 170;
    // Už je vidno — nič.
    if (r.top >= hore && r.top <= Math.max(hore, dole)) return;
    const rychlo = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
    window.scrollTo({ top: Math.max(0, r.top + window.scrollY - hore), behavior: rychlo ? "auto" : "smooth" });
    // klucTahu zahŕňa fázu, ťah aj krok bitky.
  }, [klucTahu, somNaTahu]);

  const volimLokalitu = somNaTahu && view.faza === "volbaCiela" && view.koniec === null;
  /** v11.11: lokalitu vyberám, ale natočí ju súper — víťaz minulej hádky. */
  const natociSuper = view.faza === "volbaCiela" && !natacamNavrh(view, ja);
  /** Klik na kartu v šenku: pridá ju do výberu (do limitu), opätovný klik ju vráti. */
  const prepniZoSenku = (uid: number): void => {
    const uids = zoSenku.map((k) => k.uid);
    if (uids.includes(uid)) setNavrh({ typ: "zoSenku", uids: uids.filter((u) => u !== uid) });
    else if (uids.length < zoSenkuLimit) setNavrh({ typ: "zoSenku", uids: [...uids, uid] });
    else if (zoSenkuLimit === 1) setNavrh({ typ: "zoSenku", uids: [uid] });
  };
  // ---- ťahanie ----------------------------------------------------------------
  /** Kam smie karta zo zdroja ísť (hodnoty data-ciel). */
  const cieleZdroja = (z: Zdroj): ReadonlySet<string> => {
    const out = new Set<string>();
    // Preskladať ruku smie hráč kedykoľvek, aj keď nie je na ťahu.
    if (z.odkial === "ruka" && !z.navrh) {
      for (const k of ruka) if (k.uid !== z.karta.uid) out.add(PORADIE + k.uid);
      out.add(PORADIE + "koniec");
    }
    if (!somNaTahu || view.koniec !== null) return out;
    const zs = view.zhromazdenieStav;
    if (z.odkial === "ruka" && view.faza === "zhromazdenie" && zs !== null && !zs.pasoval[ja]) {
      // Karta smie tam, kam ju pustí celý ťah (aj s cenou ďalších kariet v poldeci).
      const bez = vylozenia.filter((x) => x.karta.uid !== z.karta.uid);
      for (const c of CIELE_VYKLADANIA as readonly CielVykladania[]) {
        if (planTahu([...bez, { karta: z.karta, ciel: c }]).chyba === null) out.add(c);
      }
      // Na miesto navrhnutej karty: nahradí ju.
      for (const x of bez) {
        if (planTahu(bez.map((y) => (y === x ? { karta: z.karta, ciel: x.ciel } : y))).chyba === null) out.add(NAHRADIT + x.karta.uid);
      }
      // Nástroj sa pustí na kartu v línii — zasunie sa pod ňu (Náradie 2026-11-08).
      if (!z.navrh) for (const m of ponukaPre(z.karta)) out.add(PODLOZIT + m.hostitel);
      if (z.navrh) out.add("ruka");
    }
    if (z.odkial === "ruka" && reagujem) {
      const zablokovane = zablokovaneStrany(view);
      for (const c of cieleOdpovede(data, view, ja, z.karta)) {
        if (!zablokovane[c === "vlastna" ? ja : super_]) out.add(c);
      }
      if (z.navrh) out.add("ruka");
    }
    if (z.odkial === "senok" && zoSenkuLimit > 0) {
      if (z.navrh) {
        out.add("senok");
      } else {
        if (zoSenku.length < zoSenkuLimit) out.add("ruka");
        for (const k of zoSenku) out.add(NAHRADIT + k.uid);
      }
    }
    if (z.odkial === "lokality" && view.faza === "volbaCiela") {
      // Navrhnutú lokalitu vráti pravý klik na stole — tlačidlo Nástenka, kam sa púšťala, zaniklo.
      if (!z.navrh) out.add("lokalita");
    }
    return out;
  };

  // Kde hráč pustil kartu: položená karta sa objaví pod nehybnou myšou a jej lupa zakryla
  // tlačidlá návrhu (UI inšpekcia, výučba kolo 4) — lupa sa ukáže, až keď myš odíde z miesta.
  const poPusteni = useRef<{ readonly x: number; readonly y: number } | null>(null);
  const pusti = (z: Zdroj, ciel: string | null, bod: { readonly x: number; readonly y: number }): void => {
    poPusteni.current = bod;
    // Karta ťahaná zo zväčšenej kópie — lupa by po pustení visela na starom mieste.
    setLupa(null);
    setMiestoVolby(null);
    setChybaTahania(null);
    // Mimo povoleného miesta sa karta vráti tam, kde bola. Keď ju hráč chcel vyložiť,
    // povie to hláška — ticho bolo horšie než samo zlyhanie (playtest výučby 2026-10-23).
    // Pustenie späť nad ruku je zrušenie, to hlášku nepotrebuje.
    if (ciel === null || !cieleZdroja(z).has(ciel)) {
      // Aj pri vyčerpanom limite (žiadny cieľ) — vtedy hláška povie prečo a čo ďalej.
      const vykladal = z.odkial === "ruka" && !z.navrh && vykladam;
      if (vykladal && document.elementFromPoint(bod.x, bod.y)?.closest(".ruka") == null) {
        const miesta = [...moznostiMiesta.values()];
        // Nástroj sa do línie nevykladá (Náradie 2026-11-08): povedz to o tejto karte, nie všeobecné „na stôl už nie“.
        const nastroj = defOf(data, z.karta).tags.includes("Nástroj");
        const text = textNepolozenejKarty({
          ciele: cieleZdroja(z),
          plus: miesta.some((m) => m.dovod === null),
          dovodStola: miesta.find((m) => m.dovod !== null)?.dovod ?? null,
          pas: view.faza === "zhromazdenie",
          dovodKarty: nastroj ? NASTROJ_DO_LINIE : null,
        });
        setChybaTahania({ text, ...bod });
      }
      return;
    }
    if (ciel.startsWith(PODLOZIT)) {
      setVybranaDoOblasti(null);
      zasun(z.karta, Number(ciel.slice(PODLOZIT.length)));
      return;
    }
    if (ciel.startsWith(PORADIE)) {
      const kam = ciel.slice(PORADIE.length);
      presunVRuke(z.karta.uid, kam === "koniec" ? null : Number(kam));
      return;
    }
    if (z.odkial === "ruka") {
      const bez = vylozenia.filter((x) => x.karta.uid !== z.karta.uid).map((x) => ({ uid: x.karta.uid, ciel: x.ciel }));
      if (ciel === "ruka") {
        setNavrh(bez.length === 0 ? null : { typ: "vylozenia", polozky: bez });
      } else if (ciel.startsWith(NAHRADIT)) {
        const stara = Number(ciel.slice(NAHRADIT.length));
        setNavrh({ typ: "vylozenia", polozky: bez.map((x) => (x.uid === stara ? { uid: z.karta.uid, ciel: x.ciel } : x)) });
      } else if (jeCielVykladania(ciel)) {
        setNavrh({ typ: "vylozenia", polozky: reagujem ? [{ uid: z.karta.uid, ciel }] : [...bez, { uid: z.karta.uid, ciel }] });
      }
    } else if (z.odkial === "senok") {
      const uids = zoSenku.map((k) => k.uid);
      if (ciel === "senok") {
        setNavrh({ typ: "zoSenku", uids: uids.filter((u) => u !== z.karta.uid) });
      } else if (ciel === "ruka") {
        setNavrh({ typ: "zoSenku", uids: [...uids, z.karta.uid] });
      } else if (ciel.startsWith(NAHRADIT)) {
        const stara = Number(ciel.slice(NAHRADIT.length));
        setNavrh({ typ: "zoSenku", uids: uids.map((u) => (u === stara ? z.karta.uid : u)) });
      }
    } else if (ciel === "lokalita") {
      // Náhrada inou lokalitou si nechá zvolené natočenie.
      setNavrh({ typ: "lokalita", uid: z.karta.uid, otocena: lokalitaNavrh?.otocena ?? ja === 1 });
      // Lokalita je vybraná — vrstva by už len zavadzala pri otáčaní a potvrdení.
      setVrstva(null);
    } else {
      setNavrh(null);
    }
  };

  // Hláška leží tam, kde hráč kartu pustil — to miesto je prázdne. Na stole by
  // zakryla lokalitu a „+“, kam hovorí kartu pustiť (UI inšpekcia 2026-10-24).
  const [chybaTahania, setChybaTahania] = useState<{ readonly text: string; readonly x: number; readonly y: number } | null>(null);
  useEffect(() => setChybaTahania(null), [klucTahu]);
  useEffect(() => {
    if (chybaTahania === null) return;
    const t = setTimeout(() => setChybaTahania(null), ZOBRAZENIE_CHYBY_TAHANIA_MS);
    return () => clearTimeout(t);
  }, [chybaTahania]);
  const chybaTahaniaRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = chybaTahaniaRef.current;
    if (el === null || chybaTahania === null) return;
    const p = polohaChybyTahania(chybaTahania, el.offsetWidth, el.offsetHeight);
    el.style.left = `${p.x}px`;
    el.style.top = `${p.y}px`;
  }, [chybaTahania]);
  const { tahanie: tahanieMysou, zacni, duchRef } = useTahanie(pusti);
  // Telefón na šírku (dizajn A „Pult“): ťuk na kartu ju vyberie a ciele svietia ako pri ťahaní,
  // ťuk na cieľ ju položí — ťahanie od spodku displeja berie iPhone ako gesto domov.
  const [vyberTukom, setVyberTukom] = useState<Zdroj | null>(null);
  useEffect(() => setVyberTukom(null), [klucTahu, naSirku]);
  const tahanie: Tahanie<Zdroj> | null =
    tahanieMysou ?? (vyberTukom === null ? null : { zdroj: vyberTukom, x: 0, y: 0, sirka: 0, ciel: null });
  const hraRef = useRef<HTMLDivElement>(null);
  // Okno s odhadom bitky (ťuk na odznak odhadu na telefóne) a menu Partia (☰ v rohu plste).
  const [detailOdhadu, setDetailOdhadu] = useState(false);
  // Tabuľa porovnania ty | súper (dizajn B) — na šírku telefónu nahrádza dva plné bary.
  const [tabulaOtvorena, setTabulaOtvorena] = useState(false);
  // Okno zdroja zo stĺpca hráča (ťuk na cigarety, poldeci…) — ako medziobrazovka.
  const [oknoZdroja, setOknoZdroja] = useState<{ readonly p: PlayerId; readonly zdroj: ZdrojStlpca } | null>(null);
  const prepniVyberTukom = (z: Zdroj): void => setVyberTukom((v) => (v?.karta.uid === z.karta.uid ? null : z));
  // Ťuk mimo karty a cieľa výber zruší, ťuk na cieľ kartu položí (zachytí sa skôr, než ho dostane cieľ).
  const tukNaCiel = (e: ReactMouseEvent<HTMLElement>): void => {
    if (vyberTukom === null || !(e.target instanceof Element)) return;
    const ciel = e.target.closest<HTMLElement>("[data-ciel]")?.dataset.ciel;
    // Iná karta v ruke je pri ťuku výberom, nie miestom v poradí ruky.
    if (ciel !== undefined && !ciel.startsWith(PORADIE) && cieleZdroja(vyberTukom).has(ciel)) {
      e.preventDefault();
      e.stopPropagation();
      setVyberTukom(null);
      pusti(vyberTukom, ciel, { x: e.clientX, y: e.clientY });
      return;
    }
    if (e.target.closest(".tahatelna, .lupa") === null) setVyberTukom(null);
  };
  // Podržanie prsta na karte v ruke ju zväčší (lupa) — ťuk ju na šírku telefónu vyberá.
  const dlhyTuk = useRef<{ readonly casovac: number; readonly zrus: () => void } | null>(null);
  const poDlhomTuku = useRef(false);
  const zacniDlhyTuk = (e: ReactPointerEvent<HTMLElement>, akcia: (el: HTMLElement) => void): void => {
    dlhyTuk.current?.zrus();
    poDlhomTuku.current = false;
    const el = e.currentTarget;
    const x0 = e.clientX;
    const y0 = e.clientY;
    const pohyb = (ev: PointerEvent): void => {
      if (Math.hypot(ev.clientX - x0, ev.clientY - y0) > 8) zrus();
    };
    const zrus = (): void => {
      if (dlhyTuk.current !== null) clearTimeout(dlhyTuk.current.casovac);
      dlhyTuk.current = null;
      window.removeEventListener("pointermove", pohyb);
      window.removeEventListener("pointerup", zrus);
      window.removeEventListener("pointercancel", zrus);
    };
    window.addEventListener("pointermove", pohyb);
    window.addEventListener("pointerup", zrus);
    window.addEventListener("pointercancel", zrus);
    const casovac = window.setTimeout(() => {
      zrus();
      poDlhomTuku.current = true;
      akcia(el);
      // Klik po pustení prsta padne na zväčšenú kartu (lupa nad ňou) — nesmie ju vybrať ani vziať.
      const pusti = (): void => {
        const zahod = (c: MouseEvent): void => {
          c.stopPropagation();
          c.preventDefault();
        };
        window.addEventListener("click", zahod, { capture: true, once: true });
        setTimeout(() => window.removeEventListener("click", zahod, { capture: true }), 400);
      };
      window.addEventListener("pointerup", pusti, { once: true });
    }, DLHY_TUK_MS);
    dlhyTuk.current = { casovac, zrus };
  };
  useEffect(() => () => dlhyTuk.current?.zrus(), []);

  // ---- lupa nad kartami na stole a vo vrstvách ----------------------------
  // Michal 2026-10-22: karta sa zväčší pri prejdení myšou (predtým klikom) a susedia
  // v tom istom rade uhnú do strán ako v ruke (harmonika v hra.css). Klik ostáva
  // herným akciám — lupa leží nad kartou a klik na ňu urobí to isté ako na kartu.
  // zFokusu: lupu otvoril fokus z klávesnice, zavrie ju jeho strata.
  // prechod: lupa sa preniesla zo susednej karty — nastúpi jemnejšie (bez skoku zo 50 %).
  const [lupa, setLupa] = useState<{ readonly kluc: string; readonly rect: DOMRect; readonly zFokusu?: boolean; readonly prechod?: boolean } | null>(null);
  // Lupa, ktorú myš práve opustila, chvíľu doznieva (Michal 2026-10-23: prechod z karty
  // na kartu „trhal“ — stará lupa zmizla naraz a nová skočila na miesto).
  const [doznieva, setDoznieva] = useState<{ readonly kluc: string; readonly rect: DOMRect } | null>(null);
  useEffect(() => {
    if (doznieva === null) return;
    const t = setTimeout(() => setDoznieva(null), DOZNIEVANIE_LUPY_MS);
    return () => clearTimeout(t);
  }, [doznieva]);
  // Čo je pod lupou v tomto prekreslení — lupa kreslí vždy živý stav.
  const lupaKarty = new Map<
    string,
    {
      readonly render: (sirka: number) => ReactNode;
      readonly mierka?: number;
      /** Lupa nad prvkom, nie cez neho (starší v rade — susedia ostanú voľní). */
      readonly nad?: boolean;
      readonly zdroj?: Zdroj;
      readonly odstran?: (() => void) | undefined;
    }
  >();
  /** Zväčší kartu pod prvkom `el` (myš, fokus, na dotyku ťuknutie). */
  const otvorLupu = (kluc: string, el: Element | null | undefined, zFokusu = false, prechod = false): void => {
    // Časovač prejdenia myšou mohol dobehnúť až počas ťahania — stav `tahanie` v ňom je starý.
    if (tahanie === null && !document.body.classList.contains("tahanie-aktivne") && el != null) setLupa({ kluc, rect: bezPosunuHarmoniky(el), zFokusu, prechod });
  };
  const casovacLupy = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lupaZavreta = useRef<{ readonly kluc: string; readonly cas: number } | null>(null);
  // Ako nájsť kartu prvku s lupou (data-lupa) — pre prechod na susednú kartu.
  const najdiLupu = new Map<string, (el: HTMLElement) => Element | null>();
  /**
   * Zavrie lupu. Keď z nej myš odišla na susednú kartu, otvorí hneď lupu tej
   * karty — inak by sa susedia vrátili na miesto (harmonika) a karta pod
   * myšou by uskočila (Bugfixing 2026-10-22, stavba šenku). Poloha novej lupy
   * je tam, kde karta skončí, keď sa stane aktívnou: bez posunu harmoniky.
   */
  const zavriLupu = (kde?: { readonly x: number; readonly y: number }): void => {
    if (lupa !== null) lupaZavreta.current = { kluc: lupa.kluc, cas: Date.now() };
    const dalsia = kde === undefined || tahanie !== null || lupa === null ? null : lupaPodMysou(kde.x, kde.y, lupa);
    // Pri odchode myši stará lupa dozneje; pri kliku, Esc či ťahaní zmizne hneď.
    if (lupa !== null && kde !== undefined && tahanie === null) setDoznieva({ kluc: lupa.kluc, rect: lupa.rect });
    setLupa(dalsia === null ? null : { ...dalsia, prechod: true });
  };
  /**
   * Poloha karty, keď sa stane aktívnou: bez posunu harmoniky. Počas uhýbania
   * susedov je karta v pohybe a jej okamžitá poloha by lupu postavila vedľa.
   */
  const bezPosunuHarmoniky = (ciel: Element): DOMRect => {
    let posun = 0;
    for (let a: Element | null = ciel; a !== null; a = a.parentElement) {
      const rodic = a.parentElement;
      if (rodic?.classList.contains("harmonika") === true || rodic?.classList.contains("harmonika-skupiny") === true) {
        const t = getComputedStyle(a).transform;
        if (t !== "none") posun += new DOMMatrixReadOnly(t).m41;
      }
    }
    const r = ciel.getBoundingClientRect();
    return new DOMRect(r.x - posun, r.y, r.width, r.height);
  };
  /**
   * Karta, na ktorú myš odišla z lupy. Susedia uhýbajú o kúsok viac, než lupa
   * narástla, takže medzi lupou a susedom je medzera — keby lupa v nej zhasla,
   * susedia by sa vrátili a hneď znova uhli (blikanie). Preto sa hľadá aj kúsok
   * ďalej v smere pohybu.
   */
  const lupaPodMysou = (
    x: number,
    y: number,
    terajsia: { readonly kluc: string; readonly rect: DOMRect },
  ): { readonly kluc: string; readonly rect: DOMRect } | null => {
    const smer = Math.sign(x - (terajsia.rect.left + terajsia.rect.width / 2));
    for (const d of [0, 8, 16, 24]) {
      const el = document
        .elementsFromPoint(x + smer * d, y)
        .find(
          (e): e is HTMLElement =>
            e instanceof HTMLElement &&
            e.dataset.lupa !== undefined &&
            e.dataset.lupa !== terajsia.kluc &&
            lupaKarty.has(e.dataset.lupa) &&
            e.closest(".lupa") === null,
        );
      const kluc = el?.dataset.lupa;
      const ciel = el === undefined || kluc === undefined ? null : (najdiLupu.get(kluc)?.(el) ?? null);
      if (kluc !== undefined && ciel !== null) return { kluc, rect: bezPosunuHarmoniky(ciel) };
    }
    return null;
  };
  useEffect(() => () => clearTimeout(casovacLupy.current), []);
  // Lupa po ťahaní ostala visieť nad miestami a tlačidlami (playtest výučby U2): zavrie sa
  // pri začiatku ťahania, pri novom ťahu (karta pod ňou sa presunula) a na požiadanie
  // výučby pri novom kroku (udalosť naex:zavri-lupu — Escape by zrušil aj výber).
  const zavriLupuHned = useCallback((): void => {
    clearTimeout(casovacLupy.current);
    setLupa(null);
    setDoznieva(null);
  }, []);
  useEffect(() => {
    if (tahanie !== null) zavriLupuHned();
  }, [tahanie !== null, zavriLupuHned]);
  useEffect(zavriLupuHned, [klucTahu, view.strany[0].length + view.strany[1].length, zavriLupuHned]);
  useEffect(() => {
    window.addEventListener("naex:zavri-lupu", zavriLupuHned);
    return () => window.removeEventListener("naex:zavri-lupu", zavriLupuHned);
  }, [zavriLupuHned]);

  // Súhrn po bitke krok po kroku na línii starších (Michal 2026-11-02, návrh c): po zavretí
  // vyhodnotenia bitky ukáže na teplomeroch v poradí pravidiel, čo sa so staršími stalo. Krok sa
  // neprehráva sám — Ďalej a Preskočiť (Michal). Kedy sa spustí, rozhoduje dalsiPohladSuhrnu (z pohľadov
  // servera); kto sa pripojil uprostred kola, súhrn tohto kola nedostane. Výučba ho zatiaľ nemá (text
  // Melichara chýba), prehrávač ide svojím tempom.
  const suhrnZapnuty = vyucba !== true && prehravanie === undefined;
  const zaciatokTohtoKola = useRef<ZaciatokKola | null>(ukazkaSuhrnu ?? null);
  const [suhrn, setSuhrn] = useState<{ readonly kolo: number; readonly bitka: SuhrnBitky; readonly krok: number } | null>(null);
  useEffect(() => {
    if (!suhrnZapnuty) return;
    const x = dalsiPohladSuhrnu(zaciatokTohtoKola.current, viewZoServera);
    zaciatokTohtoKola.current = x.zaciatok;
    if (x.suhrn !== null) setSuhrn({ kolo: x.suhrn.kolo, bitka: x.suhrn, krok: 0 });
  }, [viewZoServera]);
  const suhrnBezi =
    suhrn !== null &&
    zadrzanyView === null &&
    frontaVrstiev.length === 0 &&
    !cakaOdhalenie &&
    view.koniec === null &&
    view.kolo === suhrn.kolo + 1;
  useEffect(() => {
    // Koniec hry (vzdanie) alebo kolo, ktoré súhrn prebehlo, ho zahodí.
    if (suhrn !== null && (view.koniec !== null || view.kolo > suhrn.kolo + 1)) setSuhrn(null);
  }, [suhrn, view.koniec, view.kolo]);

  // Pauza po súperovej voľbe cieľa (roadmapa #102): stavbu šenku robia obaja naraz, takže
  // hráč by súperovu voľbu prebehol. Michal 2026-10-30 („nevidel som, akú lokalitu súper
  // vyberá“): lokalita sa ukáže veľká, „Rozumiem“ príde po 3 s a stôl čaká na klik.
  // Vo výučbe lokalitu ukazuje Melichar svojím krokom, v prehrávači tempo určuje hráč.
  const [pauzaCiela, setPauzaCiela] = useState<PauzaCiela | null>(null);
  const predVolbouCiela = useRef<ClientState | null>(null);
  useLayoutEffect(() => {
    // Zo servera, nie zo stola: kým stôl drží bitku (vyhodnotenie, súhrn kola), súper medzitým
    // vyberie a voľbu cieľa by stôl nikdy neukázal.
    const pred = predVolbouCiela.current;
    predVolbouCiela.current = viewZoServera;
    if (vyucba === true || prehravanie !== undefined) return;
    const nova = pauzaPoVolbeCiela(pred, viewZoServera);
    if (nova !== null) setPauzaCiela(nova);
    else if (pauzaCiela !== null && (viewZoServera.kolo !== pauzaCiela.kolo || viewZoServera.koniec !== null)) setPauzaCiela(null);
  }, [viewZoServera]);
  // Kým beží počítadlo bitky, pauza počká — inak by jej 3 s ubehli pod ním. Vyhodnotenie a súhrn kola idú pred ňou.
  const pauzaBezi = pauzaCiela !== null && !pocitadloBezi && !suhrnBezi && zadrzanyView === null && suhrn === null;
  const zrusPauzuCiela = useCallback((): void => setPauzaCiela(null), []);
  // ---- medziobrazovky pri prechode fáz (Michal 2026-10-27) ------------------
  // Pri výbere lokality, šenku, Zhromaždení, Pitke, bitke a prebytku (aj v novom kole a vo finále,
  // ktoré tak nahradilo starý oznam) sa ukáže názov fázy a čo sa ide diať; ostane do „Rozumiem“. Vypínač v profile, výučba má vlastné
  // bubliny. Bitka čaká s počítadlom, kým hráč neklikne — inak by prebehlo pod medziobrazovkou.
  const medziZapnute = useUcet().ja?.medziobrazovky !== false && vyucba !== true && prehravanie === undefined;
  const medziTeraz = medziobrazovka(view, ja, menoHraca(super_), pocitadlo !== null ? pocitadlo.stol.kolo : null);
  // Pri načítaní stola sa za videnú berie fáza, ktorá už beží — okrem začiatku partie.
  const [potvrdenaMedzi, setPotvrdenaMedzi] = useState<string | null>(() =>
    view.kolo === 1 && view.faza === "volbaCiela" ? null : (medziTeraz?.kluc ?? null),
  );
  // Telefón (oprava 5): úvodné okno fázy len prvýkrát v partii, nie v každom kole — v kole 1 to bolo
  // ≈ 7 ťukov na Rozumiem. Videné druhy (šenok, Pitka…) si pamätá karta prehliadača pre túto partiu.
  const klucVidenychMedzi = `naex-medzi-${kod}`;
  const [videneDruhyMedzi, setVideneDruhyMedzi] = useState<ReadonlySet<string>>(() => {
    try {
      return new Set(JSON.parse(sessionStorage.getItem(klucVidenychMedzi) ?? "[]") as string[]);
    } catch {
      return new Set();
    }
  });
  const druhMedzi = (kluc: string): string => kluc.split("|")[1] ?? kluc;
  const potvrdMedzi = (kluc: string): void => {
    setPotvrdenaMedzi(kluc);
    if (!naSirku) return;
    setVideneDruhyMedzi((v) => {
      const nove = new Set([...v, druhMedzi(kluc)]);
      try {
        sessionStorage.setItem(klucVidenychMedzi, JSON.stringify([...nove]));
      } catch {
        // bez úložiska si to pamätá len tento stôl
      }
      return nove;
    });
  };
  const medziCaka =
    medziZapnute && medziTeraz !== null && medziTeraz.kluc !== potvrdenaMedzi && !(naSirku && videneDruhyMedzi.has(druhMedzi(medziTeraz.kluc)));
  // Krátka chvíľa, kým sa stôl ustáli (bitka a nové kolo prídu naraz, počítadlo až po nich).
  const [medziUstalena, setMedziUstalena] = useState<string | null>(null);
  const klucMedzi = medziCaka ? medziTeraz.kluc : null;
  useEffect(() => {
    if (klucMedzi === null) return;
    const t = setTimeout(() => setMedziUstalena(klucMedzi), MEDZIOBRAZOVKA_MS);
    return () => clearTimeout(t);
  }, [klucMedzi]);
  const medziViditelna =
    medziCaka &&
    medziUstalena === medziTeraz.kluc &&
    !pauzaBezi &&
    !suhrnBezi &&
    !cakaOdhalenie &&
    autoPas === null &&
    (vrstvaVyhodnotenia === null || pocitadlo !== null);
  // Pod stmaveným stolom by dopad nikto nevidel — počká, kým sa stôl uvoľní.
  const pozdrzDopad = pocitadloBezi || zadrzanyView !== null || suhrnBezi || pauzaBezi || medziCaka || autoPas !== null;
  const { dopady: dopadyCigariet, nedavne: nedavneCigarety } = usePrisunZdroja("cigarety", udalosti, [viewZoServera.hraci[0].cigarety, viewZoServera.hraci[1].cigarety], pozdrzDopad);
  // Číslo dlaždice: skryté NA EX už hráčovi leží na stole (poldeciNaStole).
  const plnePoldeci = (v: ClientState, p: PlayerId): number => Math.max(0, v.hraci[p].poldeciPlne - poldeciNaStole(v, p).skryte);
  const { dopady: dopadyPoldeci, nedavne: nedavnePoldeci } = usePrisunZdroja("poldeci", udalosti, [plnePoldeci(viewZoServera, 0), plnePoldeci(viewZoServera, 1)], pozdrzDopad);
  // Po vyhodnotení Pitky (Vízia, otočené Záverečné, Zastávka) sú cigarety už na účte, nič nečaká.
  const pitkaVyhodnotena = view.faza === "pitka" && (view.pitkaStav === null || (ucetPitky?.kolo === view.kolo && ucetPitky.pitka === view.pitkaCislo));
  const prisunCigariet = (p: PlayerId): PrisunDlazdice => ({
    druh: "cigarety",
    hodnota: view.hraci[p].cigarety,
    cakajuci:
      nahladyPitky === null || pitkaVyhodnotena
        ? null
        : { suma: nahladyPitky[p].cigarety.zisk, riadky: riadkyCakajuceho(nahladyPitky[p].cigarety), kedy: t("plocha.naKonciPitky"), po: t("panel.poPitke") },
    dopad: dopadyCigariet[p],
    nedavny: nedavneCigarety[p],
  });
  // Akcie Poldeci otáčajú až v bitke, preto čakajú aj po vyhodnotení Pitky; s Jogurtom už v nej.
  const prisunPoldeci = (p: PlayerId): PrisunDlazdice => ({
    druh: "poldeci",
    hodnota: plnePoldeci(view, p),
    cakajuci:
      nahladyPitky === null
        ? null
        : {
            suma: nahladyPitky[p].poldeci.zisk,
            riadky: riadkyCakajucichPoldeci(nahladyPitky[p].poldeci),
            kedy: view.hraci[p].dedicstvo.some((k) => k.defId === "jogurt") ? t("plocha.najneskorVBitke") : t("plocha.vBitke"),
            po: t("plocha.poBitke"),
          },
    dopad: dopadyPoldeci[p],
    nedavny: nedavnePoldeci[p],
  });
  // Po súhrne ide hra rovno na výber lokality (Michal 2026-10-30) — medziobrazovka „Výber lokality“
  // by bola ďalší klik navyše. Pred finále ostane: hovorí, kto útočí a kto vyberá.
  const koniecSuhrnu = (): void => {
    if (medziTeraz?.kluc === `${view.kolo}|lokalita`) setPotvrdenaMedzi(medziTeraz.kluc);
    setSuhrn(null);
  };
  const dalejSuhrnu = (): void => {
    if (suhrn === null) return;
    if (suhrn.krok + 1 < suhrn.bitka.kroky.length) setSuhrn({ ...suhrn, krok: suhrn.krok + 1 });
    else koniecSuhrnu();
  };
  useEffect(() => {
    if (pauzaBezi) zavriLupuHned();
  }, [pauzaBezi, zavriLupuHned]);
  // Susedia uhnú o polovicu prírastku šírky lupy (harmonika v hra.css) — pred
  // vykreslením, aby sa susedia nepohli najprv o starý posun.
  useLayoutEffect(() => {
    if (lupa === null) return;
    const lk = lupaKarty.get(lupa.kluc);
    const mierka = Math.min(lk?.mierka ?? mierkaLupy, maxMierkaLupy(lupa.rect));
    document.body.style.setProperty("--harmonika-posun", `${Math.round((lupa.rect.width * (mierka - 1)) / 2 + 6)}px`);
    return () => {
      document.body.style.removeProperty("--harmonika-posun");
    };
    // lupaKarty sa skladá pri každom kreslení — stačí kľúč a poloha lupy.
  }, [lupa, mierkaLupy]);
  // Uhnuté skupiny línie môžu presiahnuť jej šírku. Línia, ktorá sa v pokoji
  // neposúva, by vtedy ukázala vodorovný posuvník (skok výšky stola) a prichytenie
  // lokality do stredu by ju posunulo — udalosť scroll lupu zavrela, preto lupa
  // pri prechode myšou „trhala“ (Michal 2026-10-23). Kým je lupa otvorená, línia
  // si drží stav z pokoja (hra.css .linia.lupa-v-pokoji).
  const liniaVPokoji = useRef<boolean | null>(null);
  useLayoutEffect(() => {
    const l = liniaRef.current;
    if (l === null) return;
    if (lupa === null) {
      liniaVPokoji.current = null;
      l.classList.remove("lupa-v-pokoji");
      return;
    }
    if (liniaVPokoji.current === null) liniaVPokoji.current = l.scrollWidth <= l.clientWidth;
    l.classList.toggle("lupa-v-pokoji", liniaVPokoji.current);
  }, [lupa]);
  /**
   * Udalosti prvku, ktorý sa pri prejdení myšou zväčší. Lupa sa otvorí až po
   * krátkej chvíli (pri prechode cez rad by blikala); hneď po zavretí inej
   * lupy bez čakania, nech sa dá rad prechádzať plynulo. Kartu, z ktorej lupy
   * myš práve odišla, znova neotvorí, kým myš neopustí jej miesto.
   */
  const ONESKORENIE_LUPY_MS = 150;
  /** O koľko px sa musí myš po pustení karty pohnúť, aby sa lupa znova otvárala. */
  const VZDIALENOST_PO_PUSTENI = 60;
  // Myš, ktorá sa od príchodu k stolu nepohla, lupu neotvorí: po kliku na „Začať výučbu“ ostala
  // nad lokalitou a jej zväčšenina zakryla bublinu Melichara (playtest výučby 20261030, krok 1).
  // Prehliadač po zmene stránky pošle pohyb na tom istom mieste — ten sa neráta.
  const mysSaPohla = useRef(false);
  useEffect(() => {
    let prva: { readonly x: number; readonly y: number } | null = null;
    const pohyb = (e: PointerEvent): void => {
      if (e.pointerType !== "mouse") return;
      if (prva === null) prva = { x: e.clientX, y: e.clientY };
      else if (Math.hypot(e.clientX - prva.x, e.clientY - prva.y) >= 4) {
        mysSaPohla.current = true;
        window.removeEventListener("pointermove", pohyb);
      }
    };
    window.addEventListener("pointermove", pohyb);
    return () => window.removeEventListener("pointermove", pohyb);
  }, []);
  const nadLupou = (kluc: string, najdi: (el: HTMLElement) => Element | null, fokus: boolean) => {
    najdiLupu.set(kluc, najdi);
    return {
      "data-lupa": kluc,
      tabIndex: fokus ? 0 : undefined,
      onPointerEnter: (e: ReactPointerEvent<HTMLElement>): void => {
        if (e.pointerType !== "mouse" || tahanie !== null || !mysSaPohla.current) return;
        const p = poPusteni.current;
        if (p !== null) {
          if (Math.hypot(e.clientX - p.x, e.clientY - p.y) < VZDIALENOST_PO_PUSTENI) return;
          poPusteni.current = null;
        }
        const z = lupaZavreta.current;
        if (z?.kluc === kluc) return;
        const el = e.currentTarget;
        clearTimeout(casovacLupy.current);
        const plynulo = z !== null && Date.now() - z.cas < 300;
        casovacLupy.current = setTimeout(() => otvorLupu(kluc, najdi(el), false, plynulo), plynulo ? 0 : ONESKORENIE_LUPY_MS);
      },
      onPointerLeave: (): void => {
        clearTimeout(casovacLupy.current);
        if (lupaZavreta.current?.kluc === kluc) lupaZavreta.current = { kluc: "", cas: lupaZavreta.current.cas };
      },
      onFocus: (e: ReactFocusEvent<HTMLElement>): void => {
        if (e.currentTarget.matches(":focus-visible")) otvorLupu(kluc, najdi(e.currentTarget), true);
      },
      onBlur: (): void => setLupa((l) => (l?.kluc === kluc && l.zFokusu === true ? null : l)),
      // Dotyk nemá prejdenie myšou — kartu bez akcie zväčší ťuknutie.
      onClick: jeDotyk && fokus ? (e: ReactMouseEvent<HTMLElement>) => otvorLupu(kluc, najdi(e.currentTarget)) : undefined,
      // Telefón na šírku: podržanie prsta kartu zväčší a klik po ňom nič nevykoná (playtest mobilu
      // 2026-10-31: podržanie lokality ju otočilo, karty v šenku vzalo).
      ...(naSirku
        ? {
            onPointerDownCapture: (e: ReactPointerEvent<HTMLElement>): void => zacniDlhyTuk(e, (el) => otvorLupu(kluc, najdi(el))),
            onClickCapture: (e: ReactMouseEvent<HTMLElement>): void => {
              if (!poDlhomTuku.current) return;
              poDlhomTuku.current = false;
              e.preventDefault();
              e.stopPropagation();
            },
          }
        : {}),
    };
  };
  // Zvislý posun kariet, aby sa akcie na spoji stretli slot pri slote, ráta useZarovnanieLinie z DOM.
  const vLinii = (obsah: ReactNode, kluc?: number): ReactNode => (
    <div key={kluc} className="v-linii">
      {obsah}
    </div>
  );
  /**
   * Karta, ktorá sa klikom zväčší (otočená ostane otočená, ako na stole). Ak klik
   * na kartu niečo robí (výber, NA EX…), zväčší ju tlačidlo v rohu.
   * `obsah` nahradí holú kartu (napr. ťahateľným obalom), `zdroj` dovolí
   * chytiť ju aj zo zväčšenej kópie,
   * `odstran` je pravý klik (aj na zväčšenú kópiu).
   */
  const sLupou = (
    props: Omit<HernaKartaProps, "sada" | "data">,
    moznosti: {
      readonly obsah?: ReactNode;
      readonly zdroj?: Zdroj;
      readonly kluc?: number;
      readonly trieda?: string | undefined;
      readonly odstran?: (() => void) | undefined;
      /** Nápoveda celej karty (napr. prečo naň NA EX nejde). */
      readonly titul?: string;
      /** Štítok cez kartu (napr. „nová“ pri súperovom ťahu). */
      readonly stitok?: ReactNode;
      /** Bez lupy — na karte ležia tlačidlá (voľba zóny v šenku), lupa by ich zakryla. */
      readonly bezLupy?: boolean;
      /** Tieň karty, ktorú vzal súper zo šenku — miesto v rade (odtiaľ odletí animácia). */
      readonly tien?: number;
      /** Cieľ ťahania (data-ciel) — karta v línii, pod ktorú sa dá zasunúť Nástroj. */
      readonly ciel?: string;
    } = {},
  ): ReactNode => {
    const uid = props.karta.uid;
    const kluc = `k${uid}`;
    // Lupa ukáže kartu tak, ako leží na stole, aj otočenú (Michal 2026-10-27) — text sa číta aj tak.
    const render = (sirka: number): ReactNode => karta({ ...props, sirka });
    if (moznosti.bezLupy !== true) lupaKarty.set(kluc, { render, ...(moznosti.zdroj === undefined ? {} : { zdroj: moznosti.zdroj }), odstran: moznosti.odstran });
    const maAkciu = props.onClick !== undefined;
    const triedy = ["s-lupou", maAkciu ? "ma-akciu" : "", lupa?.kluc === kluc ? "harmonika-aktivna" : ""];
    if (moznosti.trieda !== undefined) triedy.push(moznosti.trieda);
    return (
      <div
        key={moznosti.kluc ?? uid}
        className={triedy.filter((x) => x !== "").join(" ")}
        title={moznosti.titul}
        data-tien={moznosti.tien}
        data-ciel={moznosti.ciel}
        // Karta s akciou je fokusovateľná sama; ostatné dostanú tabIndex kvôli klávesnici.
        {...nadLupou(kluc, (el) => el.querySelector(".kl"), !maAkciu)}
        onContextMenu={pravyKlik(moznosti.odstran)}
      >
        {moznosti.obsah ?? karta(props)}
        {moznosti.stitok}
      </div>
    );
  };
  // Priazeň podľa id staršieho pre záznamy nástenky a súhrnov (krúžok priazne pri mene).
  const favourPodlaIdStola = (elderId: string) => favourPodlaId(data, view, elderId);
  // Krčmová nástenka (v6, spaky.html bod 12): lokalitu si víťaz neberie — ide na nástenku s jeho fotkou a špakmi.
  const nastenkaEl = (
    sKartami: boolean,
    sirkaKarty = 74,
    ucet = false,
    vyber?: (k: CardInstance, sirka: number) => ReactNode,
    kompaktna = !sKartami,
    mierka = 1,
    sirkaVyberu = sirkaKarty,
    listokVyberu: ListokNaVyber | null = null,
  ): ReactNode => (
    <Nastenka
      nastenka={view.pata === undefined ? view.nastenka : []}
      bezFinale={view.pata !== undefined}
      zostava={view.lokalityVHre}
      ciel={view.ciel}
      ja={ja}
      mena={[menoHraca(0), menoHraca(1)]}
      avatary={[hraci[0]?.avatar ?? null, hraci[1]?.avatar ?? null]}
      karta={sKartami ? (k, sirka) => karta({ karta: k, sirka }) : undefined}
      menoKarty={menoKarty}
      favour={favourPodlaIdStola}
      sirkaKarty={Math.round(sirkaKarty)}
      kompaktna={kompaktna}
      koniec={view.koniec !== null}
      vyhraStrachom={(b) => vyhraStrachomBitky(view, b.kolo)}
      ucet={ucet && view.pata === undefined ? { body, zvyraznit: nastenkaPre } : undefined}
      vyber={vyber}
      mierka={mierka}
      sirkaVyberu={sirkaVyberu}
      listokVyberu={listokVyberu}
      suhrn={(b) => (naSirku || !lokality.some((z) => z.kolo === b.kolo) ? null : () => setSuhrnLokality(b.kolo))}
      poStarom={naSirku}
    />
  );
  const aktivneCiele: ReadonlySet<string> = tahanie === null ? new Set() : cieleZdroja(tahanie.zdroj);
  // Vybraná karta, ktorá už nemá kam ísť (limit sa minul, karta odišla z ruky), sa odznačí.
  useEffect(() => {
    if (vyberTukom !== null && aktivneCiele.size === 0) setVyberTukom(null);
  });
  const jeCiel = (c: string): boolean => aktivneCiele.has(c);
  const nadCielom = (c: string): boolean => tahanie?.ciel === c && jeCiel(c);

  /** Karta, ktorú možno chytiť; s `ciel` je zároveň miestom na nahradenie. */
  const tahatelna = (
    z: Zdroj,
    obsah: ReactNode,
    kluc?: number,
    ciel?: string,
    trieda?: string,
    odstran?: () => void,
    /** Karta v ruke: zastávka klávesnice a klik bez myši (Enter, ťuknutie) — dizajn UX N4. */
    fokus?: {
      readonly aktivuj: (el: HTMLElement) => void;
      readonly popis: string;
      readonly tukni?: boolean;
      readonly naMys?: (() => void) | undefined;
      /** Podržanie prsta (len na šírku telefónu) — lupa. */
      readonly podrz?: ((el: HTMLElement) => void) | undefined;
    },
  ): ReactNode => {
    const moze = cieleZdroja(z).size > 0;
    const ide = tahanie?.zdroj.karta.uid === z.karta.uid;
    // Na šírku telefónu ťuk na kartu bez vlastnej akcie (karta v línii z návrhu, šenok, lokalita) ju vyberie.
    const tukVyberie = naSirku && moze && fokus === undefined;
    const podrz = naSirku ? fokus?.podrz : undefined;
    const nahraditelna = ciel !== undefined && !ide && jeCiel(ciel);
    const poradie = ciel?.startsWith(PORADIE) === true;
    const triedy = trieda === undefined ? ["tahatelna"] : ["tahatelna", trieda];
    if (moze) triedy.push("chytitelna");
    if (ide) triedy.push(tahanieMysou === null ? "vybrana-tukom" : "tahana");
    // Nie „navrh“ — tú triedu má karta návrhu v sekcii Playtest (margin 14px) a CSS je spoločné.
    if (z.navrh) triedy.push("navrhnuta");
    if (nahraditelna) triedy.push(poradie ? "poradie-ciel" : "nahraditelna");
    if (nahraditelna && nadCielom(ciel)) triedy.push("nad-cielom");
    // Kam karta v ruke padne: doprava za cieľ, doľava pred neho.
    if (poradie && nahraditelna && tahanie !== null) {
      const uids = ruka.map((k) => k.uid);
      triedy.push(uids.indexOf(Number(ciel.slice(PORADIE.length))) > uids.indexOf(tahanie.zdroj.karta.uid) ? "za" : "pred");
    }
    return (
      <div
        key={kluc}
        className={triedy.join(" ")}
        data-ciel={nahraditelna ? ciel : undefined}
        onPointerDown={
          podrz !== undefined
            ? (e) => {
                zacniDlhyTuk(e, podrz);
                if (moze) zacni(z, e);
              }
            : moze
              ? (e) => zacni(z, e)
              : undefined
        }
        onDragStart={(e) => e.preventDefault()}
        onContextMenu={pravyKlik(odstran)}
        {...(fokus === undefined
          ? tukVyberie
            ? {
                onClick: (e: React.MouseEvent<HTMLDivElement>) => {
                  // Karta s vlastným klikom (výber v šenku, lokalita na nástenke) ho robí sama.
                  if (e.target instanceof Element && e.target.closest(".kl-klik") !== null) return;
                  e.stopPropagation();
                  prepniVyberTukom(z);
                },
              }
            : {}
          : {
              tabIndex: 0,
              "aria-label": fokus.popis,
              ...(fokus.naMys === undefined ? {} : { onMouseEnter: fokus.naMys }),
              ...(fokus.tukni === true
                ? {
                    onClick: (e: React.MouseEvent<HTMLDivElement>) => {
                      if (poDlhomTuku.current) {
                        poDlhomTuku.current = false;
                        return;
                      }
                      fokus.aktivuj(e.currentTarget);
                    },
                  }
                : {}),
              onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => {
                if (e.key !== "Enter" && e.key !== " ") return;
                e.preventDefault();
                fokus.aktivuj(e.currentTarget);
              },
            })}
      >
        {obsah}
        {nahraditelna && !poradie && <span className="nahradit-stitok">{t("plocha.nahradit")}</span>}
      </div>
    );
  };

  /** Prázdne miesto, kam karta smie — ukáže sa len počas ťahania. */
  const miesto = (ciel: string, popis: ReactNode, sirka: number): ReactNode => {
    if (tahanie === null || !jeCiel(ciel)) return null;
    const v = vzhladKarty(sada, data, tahanie.zdroj.karta.defId);
    return (
      <div
        className={`ciel-miesto ${nadCielom(ciel) ? "nad-cielom" : ""}`}
        data-ciel={ciel}
        style={{ width: sirka, height: (sirka * v.vyskaMm) / v.sirkaMm }}
      >
        {popis}
      </div>
    );
  };

  // Miesto pod kurzorom zakrýva ťahaná karta — jeho náhľad zopakuje panel.
  const cielTahania = tahanie?.zdroj.odkial === "ruka" ? tahanie.ciel : null;
  const kamTahania: "vlastna" | "superova" | null =
    (cielTahania === "vlastna" || cielTahania === "superova") && jeCiel(cielTahania) ? cielTahania : null;
  const nahladTahania =
    tahanie !== null && kamTahania !== null ? { ciel: kamTahania, n: nahladVylozeniaNa(tahanie.zdroj.karta, kamTahania) } : null;
  const vystrahaTahania = tahanie !== null && kamTahania !== null && !tahanie.zdroj.navrh ? vystrahaVylozenia(tahanie.zdroj.karta, kamTahania) : null;
  const textNahladuTahania =
    nahladTahania === null ? null : (
      <span className="nahlad-spojov">
        {tahanie !== null && vystrahaTahania !== null && <strong className="pecen-varovanie">{textVystrahy(vystrahaTahania, tahanie.zdroj.karta)} · </strong>}
        <strong>{menoKarty(tahanie?.zdroj.karta.defId ?? "")}</strong> → {POPIS_CIELA[nahladTahania.ciel]} · {textSpoja(nahladTahania.n)} · ty:{" "}
        {textZmienVylozenia(nahladTahania.n, ja)} · {menoHraca(super_)}: {textZmienVylozenia(nahladTahania.n, super_)}
      </span>
    );

  const zonaTriedy = (ciel: string, zaklad: string): string =>
    [zaklad, jeCiel(ciel) ? "ciel-zona" : "", nadCielom(ciel) ? "nad-cielom" : ""].join(" ");

  // ---- klikanie na karty v línii (NA EX cieľ) -------------------
  const klikLinia = (_majitel: PlayerId, uid: number): (() => void) | undefined => {
    if (mode.typ === "naexCiel") {
      if (!naexCiele.has(uid)) return undefined;
      return () => setMode(mode.uid === uid ? { typ: "ziadny" } : { typ: "naexCiel", uid });
    }
    // Pitka (Michal 2026-10-21): klik na kartu so značkou ju rovno vyberie — pečiatka NA EX! sa ukáže na hrane stola.
    if (naexPriamo && mode.typ === "ziadny" && naexCiele.has(uid)) {
      return () => setMode({ typ: "naexCiel", uid });
    }
    return undefined;
  };

  const kseftNaKarte = (k: (typeof kseftyStola)[number]): ReactNode => (
    <KseftPodKartou
      kseft={k}
      cmd={cmd}
      naDotyk={naSirku}
      onNedostupny={(text, x, y) => setChybaTahania({ text, x, y })}
    />
  );
  // Štítok leží celý pod kartou (v rezerve pod líniou) — text karty ani susedov nezakryje.
  const kseftPod = (uid: number, obsah: ReactNode): ReactNode => {
    const k = kseftyVLinii.find((x) => x.uid === uid);
    if (k === undefined) return obsah;
    return (
      <div key={uid} className="s-kseftom" style={{ paddingBottom: REZERVA_KSEFTU }}>
        {obsah}
        {kseftNaKarte(k)}
      </div>
    );
  };
  // Línia z pohľadu hráča (PRAVIDLA §6): tvoja strana vedie od lokality
  // doľava, súperova doprava — karty sa dotýkajú presne tak, ako sa
  // vyhodnocujú spoje. Karta je otočená, ak ju zahral ten druhý z vás
  // (súperove vlastné karty sú voči tebe nohami hore).
  const kartyStrany = (p: PlayerId): ReactNode[] => {
    const strana = view.strany[p];
    const poradie = p === ja ? [...strana].reverse() : strana;
    return poradie.map((placed) => kartaVLinii(placed));
  };
  const kartaVLinii = (placed: PlacedCard): ReactNode => {
    {
      const uid = placed.card.uid;
      const otocena = otoceneTeraz.has(uid);
      // Otočená súperova Záverečná je v línii „nová“ — štítok otočenia povie viac.
      const nova = noveSuperove.includes(uid) && !otocena;
      // NA EX na karte je pečiatka cez ilustráciu (Michal 2026-11-09), výber pre NA EX nápis pod kartou.
      const naexBy = placed.naexBy;
      // NA EX naraz (v5): moje skryté NA EX vidím len ja; zrážka oboch = Výtržník.
      const skryteMoje = mojeSkryteNaex.has(uid);
      const skryteSupera = superoveSkryteNaex.has(uid);
      const vytrznik = placed.vytrznik === true;
      const vybranaNaex = mode.typ === "naexCiel" && mode.uid === uid;
      const presunieSa = presunute.has(uid);
      const peciatkaNaex = naexNaKarteVLinii(naexBy, placed.naexBy2, skryteMoje, skryteSupera);
      // Náradie (mock 2): s Nástrojom v ruke svietia karty, pod ktoré sa dá zasunúť; zasunutý v návrhu leží pod hostiteľom.
      const podlozeneTu: readonly PodlozenyNastroj[] = [
        ...(placed.podlozene ?? []),
        ...(podlozenieNavrh?.hostitel === uid ? [{ card: podlozenieNavrh.nastroj, majitel: ja, hrana: podlozenieNavrh.hrana }] : []),
      ];
      // Stavy karty sú pečiatky cez ilustráciu ako NA EX (Michal 2026-11-11), nie štítky nad kartou;
      // Výtržníka (zrážka, Injekcia), Vzburu, Forsáž a NA EX zahasené či posilnené (v11.17) pridá karta sama.
      const komuRany = placed.playedBy === ja ? t("plocha.teba") : menoHraca(placed.playedBy);
      const stavyZLinie: StavNaKarte[] = [
        ...(placed.zaverecna === true
          ? [
              placed.odpoved === true
                ? { druh: "odpoved" as const, text: t("peciatka.odpoved"), pod: t("peciatka.licomDole"), titul: t("plocha.odpovedTitul", { meno: menoHraca(super_) }) }
                : { druh: "zaverecna" as const, text: t("peciatka.zaverecna"), pod: t("peciatka.licomDole"), titul: t("plocha.zaverecnaTitul") },
            ]
          : otocena
            ? [{ druh: "zaverecna" as const, text: t("peciatka.zaverecna"), pod: t("peciatka.odhalena"), titul: t("plocha.odhalenaTitul") }]
            : []),
      ];
      const stitky =
        nova || presunieSa || vybranaNaex ? (
          <>
            {presunieSa && (
              <span className="nova-stitok" title={t("plocha.presunieTitul")}>
                {t("plocha.presunie")}
              </span>
            )}
            {nova && (
              <span className="nova-stitok" title={t("plocha.vylozil", { meno: menoHraca(super_) })}>
                {t("plocha.nova")}
              </span>
            )}
            {vybranaNaex && <span className="vybrana-pod">✓ {t("plocha.vybrana")}</span>}
          </>
        ) : undefined;
      const nastrojVyber = nastrojKPodlozeniu;
      const smieSem = (k: CardInstance): boolean => ponukaPre(k).some((m) => m.hostitel === uid);
      // Podloženie naprázdno (v11.16, Michal 2026-11-09): ponúka sa, ale tlmene — ani jedna hrana tu nič nezmení.
      const naprazdno = (k: CardInstance): MoznostPodlozenia | null => {
        const tu = ponukaPre(k).filter((m) => m.hostitel === uid);
        return tu.length > 0 && tu.every((m) => !m.maCoRobit) ? (tu[0] ?? null) : null;
      };
      const prazdne = nastrojKPodlozeniu !== null && smieSem(nastrojKPodlozeniu) ? naprazdno(nastrojKPodlozeniu) : null;
      const presunPodlozenie = podlozenieNavrh !== null && podlozenieNavrh.hostitel !== uid && smieSem(podlozenieNavrh.nastroj) ? podlozenieNavrh.nastroj : null;
      const klikPodlozenia =
        nastrojVyber !== null ? (smieSem(nastrojVyber) ? () => zasun(nastrojVyber, uid) : undefined) : presunPodlozenie !== null ? () => zasun(presunPodlozenie, uid) : null;
      const cielPodlozenia = PODLOZIT + uid;
      const hostitel = sLupou(
        {
          karta: placed.card,
          sirka: sirkaVLinii,
          otocena: placed.playedBy !== ja,
          eval: lineEval.cards.get(uid) ?? null,
          onClick: klikPodlozenia === null ? klikLinia(placed.playedBy, uid) : klikPodlozenia,
          vybrana: mode.typ === "naexCiel" && mode.uid === uid,
          spoj: spojPre(uid),
          jamky: jamkyStola.get(uid),
          vytrznik,
          komuRany,
          podlozene: podlozeneTu,
          naex: peciatkaNaex,
          stavy: stavyZLinie,
        },
        {
          ...(jeCiel(cielPodlozenia) ? { ciel: cielPodlozenia } : {}),
          trieda: [
            nastrojVyber !== null ? (smieSem(nastrojVyber) ? "podloz-ciel" : "podloz-nie") : "",
            prazdne !== null ? "podloz-prazdne" : "",
            nastrojVyber === null && presunPodlozenie !== null ? "podloz-presun" : "",
            nadCielom(cielPodlozenia) ? "nad-cielom" : "",
            naexMozny && naexCiele.has(uid) ? "naex-mozny" : "",
            mode.typ === "naexCiel" && !naexCiele.has(uid) ? "naex-nie" : "",
            naexBy !== undefined || skryteMoje ? "naex-dany" : "",
            skryteSupera ? "naex-supera" : "",
            vytrznik ? "vytrznik" : "",
            nova ? "nova-superova" : "",
            ukazHrozbu === uid ? "hrozba-ciel" : "",
            placed.zaverecna === true ? "zaverecna-moja" : "",
            otocena ? "zaverecna-odhalena" : "",
            otocena && odhalenieCerstve ? "zaverecna-otaca" : "",
          ]
            .join(" ")
            .trim() || undefined,
          ...(mode.typ === "naexCiel" && !naexCiele.has(uid) ? { titul: dovodBezNaexNaKartu(placed) } : {}),
          ...(nastrojVyber !== null && !smieSem(nastrojVyber) ? { titul: dovodBezPodlozenia(nastrojVyber, uid) } : {}),
          ...(prazdne !== null ? { titul: `Hrana tu nič nezmení (${prazdne.popis}) — podložiť smieš, len minieš cigaretu a ťah.` } : {}),
          ...(stitky !== undefined ? { stitok: stitky } : {}),
        },
      );
      if (podlozeneTu.length === 0) return kseftPod(uid, hostitel);
      for (const n of podlozeneTu) lupaKarty.set(`n${n.card.uid}`, { render: (s) => karta({ karta: n.card, sirka: s, aktivnaHrana: n.hrana }) });
      const navrhUid = podlozenieNavrh?.hostitel === uid ? podlozenieNavrh.nastroj.uid : null;
      return kseftPod(
        uid,
        <PodlozeneNastroje
          key={uid}
          nastroje={podlozeneTu.map((n) => ({ n, hrana: aktivnaHrana(data, n), nazov: menoKarty(n.card.defId), farba: farbaKarty(vzhladKarty(sada, data, n.card.defId), sada.kategorie), navrh: n.card.uid === navrhUid }))}
          smer={smerPretrcania(placed.playedBy, ja)}
          vyska={vyskaHranyPod(sirkaVLinii)}
          ja={ja}
          vzhlad={vzhladSady(sada)}
          menoHraca={menoHraca}
          obsah={hostitel}
          lupa={(n, el) => otvorLupu(`n${n.card.uid}`, el)}
          otoc={druhaHranaIde ? otocPodlozenie : null}
        />,
      );
    }
  };
  /** Štítok na navrhnutej karte, za ktorú hráč v tomto ťahu vypije plný poldeci. */
  const stitokPoldeci = (uid: number): ReactNode =>
    view.faza === "zhromazdenie" && poradieVTahu(uid) >= 1 ? (
      <span className="poldeci-stitok" title={t("plocha.poldeciStitokTitul")}>
        {t("plocha.minusPoldeci")}
      </span>
    ) : null;
  /** Ťahaná karta by bola v ťahu ďalšia — stojí plný poldeci (Michal 2026-10-19: hra to musí jasne ohlásiť). */
  const tahanaStojiPoldeci =
    tahanie !== null &&
    tahanie.zdroj.odkial === "ruka" &&
    view.faza === "zhromazdenie" &&
    vylozenia.some((x) => x.ciel !== "priznanie" && x.karta.uid !== tahanie.zdroj.karta.uid);
  const varovaniePoldeci = tahanaStojiPoldeci ? (
    <span className="nm-poldeci">{t("plocha.dalsiaKartaLimit")}</span>
  ) : null;

  /** Vonkajší koniec strany: navrhnuté karty, a počas ťahania voľné miesto. */
  const naStoleNavrh = nahladZaverecnej && zaverecna?.kroky != null ? polozkySoZaverecnou(vylozenia) : vylozenia;
  const navrhnutaKarta = (x: (typeof naStoleNavrh)[number]): ReactNode => {
    {
      const z: Zdroj = { karta: x.karta, odkial: "ruka", navrh: true };
      const props = {
        karta: x.karta,
        sirka: sirkaVLinii,
        eval: lineEval.cards.get(x.karta.uid) ?? null,
        hranaVnutorna: nahladSpojov?.uid === x.karta.uid ? nahladSpojov.n.vnutornaVytlacena : undefined,
        spoj: spojPre(x.karta.uid),
        jamky: jamkyStola.get(x.karta.uid),
        ...(x.zaverecna === true ? { stavy: [{ druh: "zaverecna" as const, text: t("peciatka.zaverecna"), pod: t("peciatka.licomDole"), titul: t("plocha.zaverecnaTitul") }] } : {}),
      };
      const vrat = (): void => vratDoRuky(x.karta.uid);
      const obsah = tahatelna(
        z,
        <>
          {karta(props)}
          {stitokPoldeci(x.karta.uid)}
        </>,
        undefined,
        NAHRADIT + x.karta.uid,
        undefined,
        vrat,
      );
      return sLupou(props, { obsah, zdroj: z, kluc: -100 - x.karta.uid, odstran: vrat });
    }
  };
  const koniecStrany = (p: PlayerId): ReactNode => {
    const ciel: CielVykladania = p === ja ? "vlastna" : "superova";
    const navrhnute = naStoleNavrh.filter((x) => x.ciel === ciel).map(navrhnutaKarta);
    const volne = tahanie === null ? miestoNaKlik(p, ciel) : miestoNaKonci(p, ciel);
    if (navrhnute.length === 0) return volne;
    // Tvoja strana vedie od lokality doľava — najvzdialenejšia karta je vľavo.
    return p === ja ? (
      <>
        {volne}
        {[...navrhnute].reverse()}
      </>
    ) : (
      <>
        {navrhnute}
        {volne}
      </>
    );
  };
  const miestoNaKonci = (p: PlayerId, ciel: "vlastna" | "superova"): ReactNode => {
    // Počas ťahania z ruky ukáže miesto ešte pred pustením, s čím sa karta spojí.
    const nazovMiesta = p === ja ? t("plocha.naKoniecVlavo") : t("plocha.naKoniecVpravo");
    const n = tahanie !== null && tahanie.zdroj.odkial === "ruka" && jeCiel(ciel) ? nahladVylozeniaNa(tahanie.zdroj.karta, ciel) : null;
    const vystraha = n !== null && tahanie !== null && !tahanie.zdroj.navrh ? vystrahaVylozenia(tahanie.zdroj.karta, ciel) : null;
    const popis =
      n === null ? (
        <>
          {nazovMiesta}
          {varovaniePoldeci}
        </>
      ) : (
        <span className="nahlad-miesto">
          <strong>{nazovMiesta}</strong>
          {vystraha !== null && <span className="nm-pecen">{vystrahaKratko(vystraha, ja)}</span>}
          <span>{n.vnutornaVytlacena === "left" ? t("plocha.ideLava") : t("plocha.idePrava")}</span>
          <span className={n.pary.length > 0 ? "nm-spoj" : "nm-bez"}>{textSpoja(n)}</span>
          <span>{t("stol.ty")}: {textZmienVylozenia(n, ja)}</span>
          <span className="nm-super">
            {menoHraca(super_)}: {textZmienVylozenia(n, super_)}
          </span>
          {varovaniePoldeci}
        </span>
      );
    const m = miesto(ciel, popis, sirkaVLinii);
    return m === null ? null : vLinii(m, -2);
  };
  /** Úzke miesto na konci strany: klik vysunie z ruky karty, ktoré sa tu spoja. */
  const miestoNaKlik = (p: PlayerId, ciel: StranaLinie): ReactNode => {
    const m = moznostiMiesta.get(ciel);
    if (m === undefined) return null;
    const vybrane = miestoVolby === ciel;
    const moze = m.dovod === null;
    const sSpojom = [...m.karty.values()].filter((n) => n.pary.length > 0).length;
    const nazov = p === ja ? t("plocha.naKoniecVlavo") : t("plocha.naKoniecVpravo");
    const vyska = (sirkaVLinii * 80) / 54;
    const sirkaMiesta = Math.round(sirkaVLinii * MIESTO_VOLBY);
    return vLinii(
      <button
        type="button"
        className={["miesto-volby", vybrane ? "vybrane" : "", moze ? "" : "zakazane"].join(" ")}
        style={{ width: sirkaMiesta, height: vyska }}
        disabled={!moze}
        aria-pressed={vybrane}
        title={
          !moze
            ? (m.dovod ?? "")
            : vybrane
              ? t("plocha.vyberZRuky")
              : t("plocha.klikniVyber", { kam: nazov })
        }
        onClick={() => setMiestoVolby(vybrane ? null : ciel)}
        onContextMenu={pravyKlik(vybrane ? () => setMiestoVolby(null) : undefined)}
      >
        <span className="mv-plus" aria-hidden="true">
          {moze ? "+" : "⊘"}
        </span>
        {/* Prečo sa sem nedá — textom, nie len v title, ktorý na dotyku nevidno (UX N4, U13).
            V úzkom mieste (malé karty na nízkom notebooku) by sa text lámal po písmenách — ostáva v title. */}
        {(moze || m.kratko !== undefined ? sirkaMiesta >= 36 : sirkaMiesta >= 72) && (
          <span className={`mv-text ${moze ? "" : "mv-dovod"} ${!moze && m.kratko !== undefined ? "mv-kratko" : ""}`}>
            {!moze ? (m.kratko ?? m.dovod ?? t("plocha.nedaSa")) : vybrane ? t("plocha.vyberZRukyKratko") : sSpojom > 0 ? t("plocha.spoj", { pary: sSpojom }) : t("plocha.bezSpoja")}
          </span>
        )}
      </button>,
      -3,
    );
  };
  /** Súperova Záverečná lícom dole (roadmapa #83): rub na vonkajšom konci strany, NA EX na ňu prejde vždy. */
  const rubZaverecnej = (p: PlayerId): ReactNode => {
    const z = view.zaverecne.find((x) => x.strana === p && x.majitel !== ja);
    if (z === undefined) return null;
    // Na strane leží jeho predošlá, už otočená Záverečná — táto je nová z tohto Zhromaždenia.
    const dalsiaZaverecna = view.strany[p].some((pl) => otoceneTeraz.has(pl.card.uid));
    const vybrana = mode.typ === "naexCiel" && mode.uid === z.uid;
    // Ako karta v línii: značka, keď NA EX dať môžeš; klik rovno, alebo po pečiatke NA EX!.
    const znacka = naexMozny && naexCiele.has(z.uid);
    const klik = znacka && (naexPriamo || mode.typ === "naexCiel") ? () => setMode(vybrana ? { typ: "ziadny" } : { typ: "naexCiel", uid: z.uid }) : undefined;
    const naexRubu = naexNaKarteVLinii(z.naexBy ?? undefined, undefined, mojeSkryteNaex.has(z.uid), superoveSkryteNaex.has(z.uid));
    return vLinii(
      <button
        type="button"
        className={["rub-zaverecnej", znacka ? "naex-mozny" : "", superoveSkryteNaex.has(z.uid) ? "naex-supera" : "", vybrana ? "vybrana" : ""].join(" ")}
        // Výučba (2. časť): kľúč „zaverecna“ svieti aj súperovu Záverečnú, nielen pečiatku.
        data-vyucba="zaverecna"
        style={{ width: sirkaVLinii, height: (sirkaVLinii * 80) / 54 }}
        disabled={klik === undefined}
        onClick={klik}
        title={z.odpoved === true ? t("plocha.rubOdpoved", { meno: menoHraca(super_) }) : t("plocha.rubZaverecna", { meno: menoHraca(super_) }) + (dalsiaZaverecna ? t("plocha.rubNova") : "") + (klik !== undefined ? t("plocha.rubKlik") : "")}
      >
        <span className="rub-text">
          {z.odpoved === true ? t("plocha.odpoved") : t("rekapText.zaverecna")}
          <small>{z.odpoved === true ? t("plocha.rubOdpovedPod") : dalsiaZaverecna ? t("plocha.rubNovaPod") : t("plocha.rubPod")}</small>
        </span>
        {naexRubu !== undefined && (
          <span className="rub-peciatka" style={{ fontSize: sirkaVLinii * 0.15 }}>
            <PeciatkaNaex naex={naexRubu} />
          </span>
        )}
        {vybrana && <span className="vybrana-pod">✓ {t("plocha.vybrana")}</span>}
      </button>,
      -1000 - p,
    );
  };
  const radStrany = (p: PlayerId): ReactNode => {
    const koniec = koniecStrany(p);
    const karty = view.strany[p].length === 0 ? null : kartyStrany(p);
    const rub = rubZaverecnej(p);
    // Prázdna strana má veľkosť karty v línii — pevných 198 px pretieklo nízky stôl (posuvník línie).
    if (koniec === null && karty === null && rub === null) {
      return vLinii(
        <span className="prazdna" style={{ width: sirkaVLinii, minHeight: Math.round(sirkaVLinii * POMER_KARTY) }}>
          {t("plocha.prazdna")}
        </span>,
      );
    }
    // Tvoja partia vedie od lokality doľava, jej koniec je teda vľavo; skrytá Záverečná leží na konci.
    return p === ja ? (
      <>
        {koniec}
        {rub}
        {karty}
      </>
    ) : (
      <>
        {karty}
        {rub}
        {koniec}
      </>
    );
  };

  const lokalita = view.ciel?.lokalita ?? null;
  // Pri natočení cieľa server lokalitu už nesie, ale v strede leží hráčov návrh natočenia.
  const stred = lokalitaVStrede(lokalita, view.lokalitaOtocena, lokalitaNavrh);
  // Natočenie lokality je v ráme hráča 1 opačné.
  const lokalitaNavrhOtocena = lokalitaNavrh !== null && lokalitaNavrh.otocena !== (ja === 1);
  // Jamky na prázdnych indexoch len na otvorenej hrane línie (Michal 2026-11-08, jamkyLinie.ts).
  // Za Záverečnou lícom dole (vlastnou aj súperovou) sa nepriloží — taký kraj je zavretý.
  const kartyKraja = (p: PlayerId): KartaNaKraji[] => view.strany[p].map((pl) => ({ uid: pl.card.uid, otocena: pl.playedBy !== ja }));
  const navrhKraja = (p: PlayerId): KartaNaKraji[] =>
    naStoleNavrh.filter((x) => x.ciel === (p === ja ? "vlastna" : "superova")).map((x) => ({ uid: x.karta.uid, otocena: false }));
  const zavreteKraje = zablokovaneStrany(view);
  const jamkyStola = jamkyLinie({
    ja,
    strany: [kartyKraja(0), kartyKraja(1)],
    navrh: [navrhKraja(0), navrhKraja(1)],
    zavreta: zavreteKraje,
    stred: stred === null ? null : { uid: stred.karta.uid, otocena: stred.otocena !== (ja === 1) },
  });
  // Ktorá hrana stredu je obrátená ku ktorej strane (playtest 20261017-164450:
  // Eva kvôli otočeniu lokality dala súperovi Petelicu). Natočenie je v ráme hráča 0.
  const stredKarta = lokalitaNavrh?.karta ?? lokalita;
  const stranyStredu =
    stredKarta === null ? null : stranyLokality(data, stredKarta, lokalitaNavrh?.otocena ?? view.lokalitaOtocena, ja);
  // Kraje (Michal 2026-10-20): polovice línie sa volajú podľa hrán lokality
  // (Krčma: pri výčape / pri dverách) — „tvoja/súperova strana“ mätie, lebo
  // obaja vykladajú na obe. Vytlačená ľavá hrana leží pri strane hráča 0,
  // kým lokalita nie je otočená.
  const kraje = prelozKraje(krajeStran(data, stredKarta, lokalitaNavrh?.otocena ?? view.lokalitaOtocena), stredKarta?.defId ?? null, lokalitaNavrh?.otocena ?? view.lokalitaOtocena);
  const krajStrany = (p: PlayerId): string | null => kraje[p];
  // Prevaha: akcie hrany dostane, kto má v kraji viac svojich Občanov, Zvierat a Starešinov.
  const prevaha = prevahaStran(data, stol.strany);
  const kto = (p: PlayerId | null): string => (p === null ? t("stol.nikto") : p === ja ? t("stol.ty") : menoHraca(p));
  const tipKraja = (p: PlayerId): string => t("stol.tipKraja", { kto: kto(prevaha[p]) });
  // Rovnosť a prebitie (návrh 5 A): hráči čítali „majiteľ karty pri lokalite“
  // ako majiteľa lokality a nevedeli, koľko kariet treba na prebratie hrany.
  // Ako reťazec aj pre nápovedu kraja — na nízkom okne riadok skryje hra.css (UI inšpekcia).
  const textRovnostiKraja = (p: PlayerId): string | null => {
    const s = stavKraja(data, stol.strany[p]);
    if (stredKarta === null || s.prevaha === null || s.naPrebitie === null) return null;
    const druhy = opponentOf(s.prevaha);
    const zs = view.faza === "zhromazdenie" ? view.zhromazdenieStav : null;
    const rovnost = !s.rovnost
      ? ""
      : s.prevaha === ja
        ? t("stol.rovnostTy", { a: s.pocet[ja], b: s.pocet[super_] })
        : t("stol.rovnostSuper", { a: s.pocet[ja], b: s.pocet[super_], meno: menoHraca(s.prevaha) });
    const limit =
      zs === null ? "" : t("stol.vylozieEste", { ja: zs.pasoval[ja] ? 0 : zs.zostavaLimit[ja], meno: menoHraca(super_), su: zs.pasoval[super_] ? 0 : zs.zostavaLimit[super_] });
    const karty = t("stol.kariet", { n: s.naPrebitie });
    return druhy === ja ? t("stol.naPrebitieTy", { rovnost, karty, limit }) : t("stol.naPrebitieSuper", { rovnost, meno: menoHraca(druhy), karty, limit });
  };
  const rovnostKraja = (p: PlayerId): ReactNode => {
    const t = textRovnostiKraja(p);
    return t === null ? null : <span className="kraj-rovnost">{t}</span>;
  };
  const popisKraja = (p: PlayerId, smer: "vlavo" | "vpravo") => {
    const nazov = krajStrany(p) ?? (p === ja ? t("stol.vlavo") : t("stol.vpravo"));
    return (
      <span className="partia-popis" title={[tipKraja(p), textRovnostiKraja(p)].filter((x) => x !== null).join(" ")}>
        {smer === "vlavo" ? "← " : ""}
        {nazov}
        {stredKarta !== null && (
          <span className={`kraj-prevaha ${prevaha[p] === ja ? "moja" : prevaha[p] === null ? "" : "superova"}`} data-vyucba="prevaha">
            {" "}
            {/* Telefón: krátko, celé meno by hlavičku kraja orezalo (playtest 20261031-191322). */}
            {t("stol.prevaha", { kto: naSirku ? (prevaha[p] === null ? t("stol.nikto") : prevaha[p] === ja ? t("stol.ty") : t("stol.superKratko")) : kto(prevaha[p]) })}
          </span>
        )}
        {smer === "vpravo" ? " →" : ""}
        {rovnostKraja(p)}
      </span>
    );
  };
  // Pod kartou len krátke štítky — akcie hrán vidno na karte samej.
  const popisStranStredu =
    stranyStredu === null ? null : (
      <span className="strany-stredu">
        <span title={tipKraja(ja)}>◀ {krajStrany(ja) ?? t("stol.vlavo")}</span>
        <span title={tipKraja(super_)}>{krajStrany(super_) ?? t("stol.vpravo")} ▶</span>
      </span>
    );
  const ikonyStranStredu =
    stranyStredu === null ? null : (
      <span className="strany-stredu-ikony">
        {t("stol.vlavo")} {hranaIkony(stranyStredu.kTebe)} · {t("stol.vpravo")} {hranaIkony(stranyStredu.kSuperovi)}
      </span>
    );
  const stredLinie = ((): ReactNode => {
    if (stred !== null && !stred.navrh) {
      return kseftPod(
        stred.karta.uid,
        sLupou({
          karta: stred.karta,
          sirka: sirkaVLinii,
          otocena: stred.otocena !== (ja === 1),
          eval: lineEval.cards.get(stred.karta.uid) ?? null,
          spoj: spojPre(stred.karta.uid),
          jamky: jamkyStola.get(stred.karta.uid),
        }),
      );
    }
    // Návrh lokality je bez lupy — klik ju otáča a narovnaná lupa by to skryla.
    if (lokalitaNavrh !== null) {
      return vLinii(
        tahatelna(
          { karta: lokalitaNavrh.karta, odkial: "lokality", navrh: true },
          karta({
            karta: lokalitaNavrh.karta,
            sirka: sirkaVLinii,
            otocena: lokalitaNavrhOtocena,
            eval: lineEval.cards.get(lokalitaNavrh.karta.uid) ?? null,
            jamky: jamkyStola.get(lokalitaNavrh.karta.uid),
            ...(natociSuper ? {} : { onClick: () => setNavrh({ typ: "lokalita", uid: lokalitaNavrh.karta.uid, otocena: !lokalitaNavrh.otocena }) }),
          }),
          undefined,
          "lokalita",
          undefined,
          () => setNavrh(null),
        ),
      );
    }
    return vLinii(
      miesto("lokalita", t("plocha.polozLokalitu"), sirkaVLinii) ?? (
        <span className="prazdna lokalita-miesto" style={{ width: sirkaVLinii, minHeight: Math.round(sirkaVLinii * POMER_KARTY) }}>
          {t("plocha.vyberaSa")}
        </span>
      ),
    );
  })();

  /** Pokyn pri vybranom mieste na konci strany. */
  const textVolbyMiesta: ReactNode =
    miestoVolby === null || vybraneMiesto === undefined ? null : (
      <span className="volba-miesta-text">
        <strong>{miestoVolby === "vlastna" ? t("plocha.naKoniecVlavoVelke") : t("plocha.naKoniecVpravoVelke")}:</strong>{" "}
        {t("plocha.klikniNaKartu")}{" "}
        {view.strany[miestoVolby === "vlastna" ? ja : super_].length === 0 &&
          !vylozenia.some((x) => x.ciel === miestoVolby) &&
          ruka.some((k) => !vylozenia.some((x) => x.karta.uid === k.uid) && defOf(data, k).tags.includes("Nástroj")) && (
            <span className="tlmene">{t("plocha.nastrojSemNie")}</span>
          )}{" "}
        {vylozenia.some((x) => x.ciel !== "priznanie") && view.faza === "zhromazdenie" && (
          <span className="nm-poldeci">{t("plocha.dalsiaKarta")}</span>
        )}{" "}
        <span className="tlmene">{t("plocha.zrusisPravym")}</span>
      </span>
    );

  // Záverečná vpravo pri konci ťahu (Michal 2026-10-24), nie medzi nákupmi: je to druhý spôsob,
  // ako ťah odoslať. Neaktívna ostáva viditeľná a pri myši povie prečo, ako pečiatky nákupov.
  const tlacidloZaverecnej: ReactNode =
    zaverecna === null ? null : (
      <button
        type="button"
        className="tlacidlo-zaverecna"
        data-vyucba="zaverecna"
        aria-disabled={zaverecna.kroky === null}
        title={
          zaverecna.dovod ??
          t("plocha.zaverecnaTlacidlo", { cig: cigariet(KONSTANTY.CENA_ZAVERECNEJ) })
        }
        onMouseEnter={() => setNahladZaverecnej(true)}
        onMouseLeave={() => setNahladZaverecnej(false)}
        onFocus={() => setNahladZaverecnej(true)}
        onBlur={() => setNahladZaverecnej(false)}
        onClick={(e) => {
          if (zaverecna.kroky !== null) posli({ type: "tah", kroky: zaverecna.kroky });
          // Na dotyku nápoveda pod myšou nie je — ťuk povie, prečo záverečná teraz nejde.
          else if (naSirku && zaverecna.dovod !== null) setChybaTahania({ text: zaverecna.dovod, x: e.clientX, y: e.clientY });
        }}
      >
        <span className="ikona-rub" aria-hidden="true" />
        <Vymena das={<CenaCigariet n={KONSTANTY.CENA_ZAVERECNEJ} />} dostanes={t("plocha.zaverecnaMale")} />
      </button>
    );

  // ---- potvrdenie ťahu ako pečiatka (Michal 2026-10-25) ---------------------
  // Hlavné potvrdenie ťahu leží v strede spodnej hrany stola, na mieste pečiatky NA EX! —
  // nie v paneloch či v rohu. ✕ v rohu návrh vráti (ako zrušenie výberu pri NA EX!);
  // keď nie je čo potvrdiť, na tom istom mieste je ťah bez návrhu („už neťahám“, „neberiem“).
  const pecatTahu = (p: {
    readonly text: ReactNode;
    readonly akcia: () => void;
    readonly druh?: "potvrd" | "pas";
    /** Prečo sa teraz nedá — pečiatka je len obrys a dôvod povie pri myši. */
    readonly dovod?: string | null;
    readonly tip?: string;
    readonly skratka?: "k" | "p";
    readonly vyucba?: string;
    readonly zrus?: { readonly akcia: () => void; readonly popis: string };
  }): ReactNode => (
    <span className="pecat-tahu-obal">
      <button
        type="button"
        className={p.druh === "pas" ? "pecat pecat-koncim pecat-pas" : "pecat pecat-potvrd"}
        data-skratka={p.skratka}
        data-vyucba={p.vyucba}
        disabled={p.dovod !== undefined && p.dovod !== null}
        title={p.dovod ?? p.tip}
        onClick={p.akcia}
      >
        {p.text}
      </button>
      {p.zrus !== undefined && (
        // Esc stlačí ✕ (tlacidloNavratu) — vráti návrh ako pravý klik.
        <button type="button" className="pecat-zrusit" data-skratka="esc" aria-label={p.zrus.popis} title={`${p.zrus.popis} (aj Esc či pravý klik)`} onClick={p.zrus.akcia}>
          ✕
        </button>
      )}
    </span>
  );
  const pravidloBrania =
    t("plocha.pravidloBrania");
  const potvrdBranie = (): void => {
    const uids = zoSenku.map((k) => k.uid);
    setNoveZoSenku((n) => ({ kolo: view.kolo, uids: [...(n.kolo === view.kolo ? n.uids : []), ...uids] }));
    posli({ type: "draftBer", uids });
  };
  /** Koľko kariet si kto v tomto kole vzal zo šenku — na stole vpravo na hrane (predtým v hlavičke panelu). */
  const skoreBrania: ReactNode =
    draft === null ? null : (
      <span className="hrana-skore" title={t("plocha.noveKartyTitul")}>
        <span className="moje">{t("stol.ty")} {draft.noveKarty[ja]}</span>
        <span className="superove">
          {menoHraca(super_)} {draft.noveKarty[super_]}
          {draft.hotovo[super_] ? t("plocha.uzNeberie") : ""}
        </span>
      </span>
    );

  // ---- dlaždica KARTY ako cieľ priznania a Dedičstva (Michal 2026-10-23, #76) ----
  // Pri ťahaní kliatby sa dlaždica KARTY v tvojom bare zmení na cieľ „Priznať“, pri Nástroji
  // na „Dedičstvo“ s cenou; karta sa pustí na ňu (do návrhu ťahu), stôl sa neprepína. Klik na
  // kartu a potom na dlaždicu robí to isté (aj kláves O). Kam karta patrí, určuje jej typ — keď ju
  // tam pravidlá teraz nepustia, dlaždica povie prečo. Vybraný Nástroj má navyše pečiatku
  // „odkazujem“ vedľa pasovať (Michal 2026-10-27: Dedičstvo bolo neintuitívne) — tá aj dlaždica
  // pošlú ten istý ťah ako „potvrdiť“ (planVykladania → tah), len hneď.
  const [vybranaDoOblasti, setVybranaDoOblasti] = useState<number | null>(null);
  useEffect(() => setVybranaDoOblasti(null), [klucTahu]);
  /** Kam smie karta z ruky — rovnaké ciele ako pri ťahaní (planVykladania). */
  const kamIde = (k: CardInstance): { readonly priznanie: boolean; readonly dedicstvo: boolean } => {
    const c = cieleZdroja({ karta: k, odkial: "ruka", navrh: false });
    return { priznanie: c.has("priznanie"), dedicstvo: c.has("dedicstvo") };
  };
  const mozemOdkladat = view.faza === "zhromazdenie" && vykladam && !reagujem;
  const typOblasti = (k: CardInstance): { readonly priznanie: boolean; readonly dedicstvo: boolean } => {
    const tagy = data.cards.get(k.defId)?.tags ?? [];
    return { priznanie: mozemOdkladat && tagy.includes("Kliatba"), dedicstvo: mozemOdkladat && tagy.includes("Nástroj") };
  };
  const tahanaZRuky = tahanie !== null && tahanie.zdroj.odkial === "ruka" && !tahanie.zdroj.navrh ? tahanie.zdroj.karta : null;
  const vybranaKarta = vybranaDoOblasti === null ? null : (ruka.find((k) => k.uid === vybranaDoOblasti) ?? null);
  // Výučba: kartu, ktorú krok posiela do Dedičstva či na priznanie, čaká dlaždica od začiatku kroku.
  const kartaVyucby = mozemOdkladat && tahanaZRuky === null && vybranaKarta === null ? kartaVyucbyDoOblasti(vyucbaOcakava, ruka, vylozenia) : null;
  const kartaOblasti = tahanaZRuky ?? vybranaKarta ?? kartaVyucby;
  const typKarty = kartaOblasti === null ? null : typOblasti(kartaOblasti);
  const cielDlazdice: "priznanie" | "dedicstvo" | null = typKarty === null ? null : typKarty.priznanie ? "priznanie" : typKarty.dedicstvo ? "dedicstvo" : null;
  const smieNaDlazdicu = kartaOblasti !== null && cielDlazdice !== null && kamIde(kartaOblasti)[cielDlazdice];
  /** Prečo karta na dlaždicu nesmie — ten istý výpočet, aký urobí server. */
  const chybaDlazdice =
    kartaOblasti === null || cielDlazdice === null || smieNaDlazdicu
      ? null
      : (planTahu([...vylozenia.filter((x) => x.karta.uid !== kartaOblasti.uid), { karta: kartaOblasti, ciel: cielDlazdice }]).chyba ?? t("plocha.semJuNesmies"));
  /** Odkáže Nástroj do Dedičstva hneď — návrh ťahu + Nástroj, ten istý príkaz „tah“ ako „potvrdiť“ (odkazTahu.ts). */
  // Výučba pustí len ťah zo scenára — ako pri „potvrdiť“.
  const dovodOdkazu = (k: CardInstance): string | null => tahOdkazu(data, view, ja, vylozenia, k).dovod ?? chybaVyucby(polozkyOdkazu(vylozenia, k));
  const odkaz = (k: CardInstance): void => {
    const t = tahOdkazu(data, view, ja, vylozenia, k);
    if (t.kroky === null || dovodOdkazu(k) !== null) return;
    setVybranaDoOblasti(null);
    setNavrh(null);
    posli({ type: "tah", kroky: t.kroky });
  };
  /** Nástroj vybraný či ťahaný z ruky, ktorý sa dá podložiť — karty v línii, pod ktoré smie, svietia (mock 2, Ťah 1). */
  const nastrojKPodlozeniu = [tahanaZRuky, vybranaKarta].find((k): k is CardInstance => k !== null && ponukaPre(k).length > 0) ?? null;
  /** Prečo Nástroj pod túto kartu nejde — dôvod jadra pre hornú hranu, inak pre dolnú. */
  const dovodBezPodlozenia = (k: CardInstance, uid: number): string =>
    dovodNepodlozenia(data, lineState(view), k, uid, "horna", ja) ?? dovodNepodlozenia(data, lineState(view), k, uid, "dolna", ja) ?? t("plocha.nezasuva");
  const druhaHranaIde =
    podlozenieNavrh !== null &&
    ponukaPre(podlozenieNavrh.nastroj).some((m) => m.hostitel === podlozenieNavrh.hostitel && m.hrana !== podlozenieNavrh.hrana);
  /** Nástroj vybraný v ruke, ktorý smie do Dedičstva — vtedy je na hrane stola „odkazujem“. */
  const nastrojNaOdkaz = vybranaKarta !== null && typOblasti(vybranaKarta).dedicstvo ? vybranaKarta : null;
  const tlacidloOdkazu: ReactNode = (() => {
    if (nastrojNaOdkaz === null) return null;
    const k = nastrojNaOdkaz;
    const chyba = dovodOdkazu(k);
    const cena = view.cenaDedicstva;
    const ineVNavrhu = vylozenia.some((x) => x.karta.uid !== k.uid && x.ciel !== "priznanie");
    const tip =
      t("plocha.odkazTip", { karta: menoKarty(k.defId), cig: cigariet(cena), mas: hJa.cigarety }) +
      (ineVNavrhu ? t("plocha.odkazTipNavrh") : t("plocha.odkazTip2"));
    return (
      <button
        type="button"
        className="pecat pecat-koncim pecat-odkaz"
        data-vyucba="tlacidlo:odkazujem"
        aria-disabled={chyba !== null}
        title={chyba ?? tip}
        onClick={(e) => {
          if (chyba === null) odkaz(k);
          else setChybaTahania({ text: chyba, x: e.clientX, y: e.clientY });
        }}
      >
        <Vymena das={<CenaCigariet n={cena} />} dostanes="odkazujem" />
      </button>
    );
  })();

  // ---- tlačidlá návrhu na stole (Michal 2026-10-20) ------------------------
  // Potvrdenie patrí k tomu, čo leží na stole — hráč nemusí pozerať dole na pás.
  const stolTlacidla = ((): HranaTahu | null => {
    // Súhrn po bitke a zastavenie po poslednej Pitke držia hranu pre Ďalej a Preskočiť (pokyn).
    if (!somNaTahu || view.koniec !== null || zastavenieBezi || suhrnBezi) return null;
    if (view.faza === "natocenieCiela" && lokalitaNavrh !== null) {
      const otocit = (
        <button onClick={() => setNavrh({ typ: "lokalita", uid: lokalitaNavrh.karta.uid, otocena: !lokalitaNavrh.otocena })} data-vyucba="tlacidlo:otocit">
          {t("plocha.otocit")} ↻
        </button>
      );
      return {
        ...(naSirku ? { druha: otocit } : { vlavo: otocit }),
        stred: pecatTahu({
          text: t("plocha.potvrdit"),
          skratka: "k",
          tip: t("plocha.natocenieTip", { meno: menoKarty(lokalitaNavrh.karta.defId) }),
          akcia: () => posli({ type: "natocLokalitu", otocena: lokalitaNavrh.otocena }),
        }),
      };
    }
    if (view.faza === "volbaCiela" && lokalitaNavrh !== null && natociSuper) {
      return {
        stred: pecatTahu({
          text: t("plocha.potvrdit"),
          skratka: "k",
          tip: t("plocha.bitkaONatoci", { meno: menoKarty(lokalitaNavrh.karta.defId), kto: menoHraca(super_) }),
          akcia: () => posli({ type: "chooseLocation", uid: lokalitaNavrh.karta.uid, otocena: false }),
          zrus: { akcia: () => setNavrh(null), popis: t("plocha.spatNaVyber") },
        }),
      };
    }
    if (view.faza === "volbaCiela" && lokalitaNavrh !== null) {
      const otocit = (
        <button onClick={() => setNavrh({ typ: "lokalita", uid: lokalitaNavrh.karta.uid, otocena: !lokalitaNavrh.otocena })} data-vyucba="tlacidlo:otocit">
          {t("plocha.otocit")} ↻
        </button>
      );
      return {
        ...(naSirku ? { druha: otocit } : { vlavo: otocit }),
        stred: pecatTahu({
          text: t("plocha.potvrdit"),
          skratka: "k",
          tip: lokalitaNavrhOtocena ? t("plocha.bitkaOOtocenu", { meno: menoKarty(lokalitaNavrh.karta.defId) }) : t("plocha.bitkaO", { meno: menoKarty(lokalitaNavrh.karta.defId) }),
          akcia: () => posli({ type: "chooseLocation", uid: lokalitaNavrh.karta.uid, otocena: lokalitaNavrh.otocena }),
          zrus: { akcia: () => setNavrh(null), popis: t("plocha.spatNaVyber") },
        }),
      };
    }
    if (podlozenieNavrh !== null) {
      const p = podlozenieNavrh;
      const moznost = ponukaPre(p.nastroj).find((m) => m.hostitel === p.hostitel && m.hrana === p.hrana);
      const hostitelKarta = view.strany.flat().find((pl) => pl.card.uid === p.hostitel);
      const cena = KONSTANTY.CENA_PODLOZENIA;
      const otocit = (
        <button type="button" onClick={otocPodlozenie} disabled={!druhaHranaIde} title={druhaHranaIde ? t("plocha.otocitNastroj") : t("plocha.druhaHranaNejde")}>
          {t("plocha.otocit")} ⟲
        </button>
      );
      return {
        ...(naSirku ? { druha: otocit } : { vlavo: otocit }),
        stred: pecatTahu({
          text: (
            <>
              {t("plocha.zasunut")} <CenaCigariet n={cena} />
            </>
          ),
          skratka: "k",
          dovod: hJa.cigarety < cena ? t("plocha.nemasNaZasunutie", { cig: cigariet(cena) }) : null,
          tip:
            t("plocha.podlozenieTip", { nastroj: `${menoKarty(p.nastroj.defId)}${moznost === undefined ? "" : ` (${moznost.popis})`}`, karta: hostitelKarta === undefined ? "" : menoKarty(hostitelKarta.card.defId), cig: cigariet(cena) }) +
            (moznost !== undefined && !moznost.maCoRobit ? t("plocha.hranaNicNezmeni") : "") +
            t("plocha.podlozenieTip2"),
          akcia: () => posli({ type: "podloz", nastrojId: p.nastroj.uid, hostitelId: p.hostitel, hrana: p.hrana }),
          zrus: { akcia: () => setNavrh(null), popis: t("plocha.vratitNastroj") },
        }),
      };
    }
    if (view.faza === "zhromazdenie" && plan !== null && vylozenia.length > 0) {
      return {
        stred: pecatTahu({
          text: <>{t("plocha.potvrdit")}{plan.poldeci > 0 && <span className="cena">−{t("spaky.nPoldeci", { n: plan.poldeci })}</span>}</>,
          skratka: "k",
          dovod: plan.chyba === null ? chybaVoVyucbe : prelozHlasku(plan.chyba),
          akcia: () => posli({ type: "tah", kroky: plan.kroky }),
          zrus: { akcia: () => setNavrh(null), popis: t("plocha.vratitKarty") },
        }),
        vpravo: (
          <>
            {/* Výučba: prečo sa nedá potvrdiť, priamo pri tlačidle (nápoveda na dotyku nie je). */}
            {chybaVoVyucbe !== null && plan.chyba === null && <span className="vyucba-zamok">{chybaVoVyucbe}</span>}
            {tlacidloZaverecnej}
            {tlacidloOdkazu}
          </>
        ),
      };
    }
    if (reagujem && vylozene !== null) {
      // Odpoveď na NA EX stojí plný poldeci (v11.16, Michal 2026-11-09) — vypije sa ako pri Vypiť.
      return {
        stred: pecatTahu({
          text: (
            <>
              {t("plocha.potvrdit")} <CenaPoldeci n={KONSTANTY.CENA_ODPOVEDE_POLDECI} />
            </>
          ),
          skratka: "k",
          tip: t("plocha.odpovedStoji"),
          akcia: () => posli({ type: "place", uid: vylozene.karta.uid, target: vylozene.ciel }),
          zrus: { akcia: () => setNavrh(null), popis: t("plocha.vratitKartu") },
        }),
      };
    }
    // Rozdeľovanie (v11): Návrh vyplní úplné rozdelenie, Potvrdiť pošle len úplné (iné server
    // neprijme), v jeho rohu ↺ Reset. Keď je rozdelenie úplné, Potvrdiť pulzuje.
    if (planDelenia !== null && krokDelenia !== null) {
      const n = zdvihyDelenia.length + akcieDelenia.length;
      const prikaz = planDelenia.prikaz;
      const navrh = navrhRozdelenia(view, akcieDelenia);
      const dovod =
        chybaDeleniaVyucby ??
        planDelenia.chyba ??
        (n === 0
          ? krokDelenia === "prebytok" ? t("plocha.klikniStupenStrach") : t("plocha.klikniStupenReci")
          : planDelenia.esteSaDa.length > 0
            ? t("plocha.zvysokStaci", { n: planDelenia.zvysok })
            : null);
      return {
        stred: (
          <span className="pecat-tahu-obal pecat-delenia">
            <button
              type="button"
              className="pecat pecat-tichy pecat-navrh-delenia"
              data-vyucba="tlacidlo:navrh-delenia"
              disabled={navrh === null || vyucba === true}
              title={navrh !== null && navrh.akcie.length > akcieDelenia.length ? t("plocha.navrhZajme") : t("plocha.navrhRozdeli")}
              onClick={() => {
                if (navrh === null) return;
                setZdvihyDelenia(navrh.zdvihy);
                // Zajatia na výhru väzňami pridá návrh sám, keď hráč žiadne nevybral (jadro navrhRozdelenia).
                if (navrh.akcie.length > akcieDelenia.length) setAkcieDelenia(navrh.akcie);
              }}
            >
              {t("plocha.navrh")}
            </button>
            <button
              type="button"
              className={`pecat pecat-potvrd${prikaz !== null && n > 0 ? " vyzva" : ""}`}
              data-skratka="k"
              data-vyucba="tlacidlo:potvrdit-delenie"
              disabled={prikaz === null || chybaDeleniaVyucby !== null}
              title={dovod ?? (planDelenia.prepadne > 0 ? t("plocha.posleRozdeleniePrepadne", { n: planDelenia.prepadne }) : t("plocha.posleRozdelenie"))}
              onClick={() => {
                if (prikaz !== null) posli(prikaz);
              }}
            >
              ✓ {t("plocha.potvrdit")}{n > 0 && <span className="poc">{n}</span>}
            </button>
            <button type="button" className="pecat-reset" disabled={n === 0} aria-label={t("plocha.reset")} title={t("plocha.resetEsc")} onClick={resetDelenia}>
              ↺
            </button>
          </span>
        ),
      };
    }
    return null;
  })();
  /** Pravý klik na prázdny stôl zruší rozbehnutý výber (miesto, cieľ NA EX…). */
  const zrusVyberNaStole = ((): (() => void) | undefined => {
    if (miestoVolby !== null) return () => setMiestoVolby(null);
    if (mode.typ === "naexCiel") return () => setMode({ typ: "ziadny" });
    return undefined;
  })();

  // ---- pokyn: pilulka na hornej hrane stola, tlačidlá na spodnej -------------
  /** Nákup na hrane stola ako papierová pečiatka (Michal 2026-10-21): čo sa nedá, je len obrys a pri myši povie prečo. */
  const pecatNakupu = (p: {
    readonly kluc: string;
    readonly nazov: string;
    readonly cena: number;
    readonly znamienko?: "−" | "+";
    readonly dovod: string | null;
    readonly tip: string;
    readonly akcia: () => void;
    /** Čo hráč za cenu dostane — vždy za cenou so šípkou (Michal 2026-10-28: cena → odmena). */
    readonly zisk?: ReactNode;
  }): ReactNode => (
    <button
      key={p.kluc}
      type="button"
      className={`pecat pecat-nakup${p.dovod !== null ? " ne" : ""}`}
      data-vyucba={`tlacidlo:${p.kluc}`}
      aria-disabled={p.dovod !== null}
      title={p.dovod ?? p.tip}
      onClick={(e) => {
        if (p.dovod === null) p.akcia();
        // Nedostupný nákup povie prečo — tichý klik na DOLIAŤ mýlil (playtest výučby 20261025).
        else setChybaTahania({ text: p.dovod, x: e.clientX, y: e.clientY });
      }}
    >
      {(p.zisk !== undefined || p.cena > 0) && (
        <span className="pecat-riadok">
          {p.cena > 0 ? <Vymena das={<CenaCigariet n={p.cena} znamienko={p.znamienko ?? "−"} />} dostanes={p.zisk} /> : p.zisk}
        </span>
      )}
      <span className="pecat-nazov">{p.nazov}</span>
    </button>
  );
  const pokyn: Pokyn | null = (() => {
    if (view.koniec !== null) {
      return {
        nadpis: view.koniec.vitaz === null ? t("koniec.remiza") : view.koniec.vitaz === ja ? tRod("koniec.vyhra", rodHracaP(ja)) : tRod("koniec.prehra", rodHracaP(ja)),
        text: (
          <>
            {textHlasky(view.koniec.dovod, [menoHraca(0), menoHraca(1)], [rodHracaP(0), rodHracaP(1)])}
            {view.koniec.body !== null && t("plocha.koniecSpaky", { ja: sMinusom(view.koniec.body[ja]), su: sMinusom(view.koniec.body[super_]), meno: menoHraca(super_) })}
            {frajerina !== null && <ZmenaFrajeriny pred={frajerina[ja].pred} po={frajerina[ja].po} />}
          </>
        ),
        // Výučba končí v bare Melichara (tam je aj „Do lobby“) — tu by tlačidlo predbehlo jej záver.
        tlacidla:
          vyucba === true ? undefined : (
            <button className="tlacidlo-hlavne" onClick={opustit}>
              {prehravanie === undefined ? t("koniec.spatDoLobby") : t("plocha.spatNaDetail")}
            </button>
          ),
      };
    }
    // Súhrn po bitke (Michal 2026-11-03): pokyn a potvrdenie ďalšej fázy (stavby šenku) by sa ukazovali
    // nad súhrnom, hoci na rade ešte nie sú. Ďalej a Preskočiť sú na mieste potvrdenia, v strede hrany.
    if (suhrnBezi && suhrn !== null) {
      const posledny = suhrn.krok >= suhrn.bitka.kroky.length - 1;
      const preskocit = posledny ? null : (
        <button type="button" className="pecat pecat-tichy" title={t("plocha.zavrieSuhrn")} onClick={koniecSuhrnu}>
          {t("plocha.preskocit")}
        </button>
      );
      // Každý svojím tempom: obranca po súhrne vyberá, útočníka čaká lokalita súpera alebo čakanie.
      const posledne = viewZoServera.faza === "volbaCiela" && viewZoServera.utocnik !== ja ? t("plocha.vybratLokalitu") : t("plocha.dalej");
      const dalej = pecatTahu({
        text: posledny ? posledne : t("plocha.dalej"),
        skratka: "k",
        tip: posledny ? t("plocha.suhrnSaZavrie") : t("plocha.dalsiKrok"),
        akcia: dalejSuhrnu,
      });
      return {
        nadpis: t("linia.suhrnPoBitke", { n: suhrn.bitka.kolo }),
        text: t("plocha.coBitkaUrobila"),
        ...(naSirku
          ? { stred: dalej, ...(preskocit === null ? {} : { druha: preskocit }) }
          : {
              stred: (
                <>
                  {preskocit}
                  {dalej}
                </>
              ),
            }),
      };
    }
    // Zastavenie po poslednej Pitke (Michal 2026-11-09): stôl vo finálnom stave, kým hráč nedá Ďalej —
    // tlačidlá ako pri súhrne starších. Preskočiť len vtedy, keď za zastavením ešte niečo čaká.
    if (vrstvaVyhodnotenia?.druh === "stol") {
      const preskocit =
        frontaVrstiev.length > 1 ? (
          <button type="button" className="pecat pecat-tichy" title={t("plocha.preskociVyhodnotenie")} onClick={preskocVyhodnotenie}>
            {t("plocha.preskocit")}
          </button>
        ) : null;
      const dalej = pecatTahu({
        text: t("plocha.dalej"),
        skratka: "k",
        tip: frontaVrstiev.length > 1 ? t("plocha.vyhodnotenie") : t("plocha.hraPokracuje"),
        akcia: koniecPocitadla,
      });
      return {
        nadpis: t("plocha.pitkaSkoncila", { n: vrstvaVyhodnotenia.pitka }),
        text: t("plocha.pozriStol"),
        ...(naSirku
          ? { stred: dalej, ...(preskocit === null ? {} : { druha: preskocit }) }
          : {
              stred: (
                <>
                  {preskocit}
                  {dalej}
                </>
              ),
            }),
      };
    }
    if (!somNaTahu && beriem) {
      return {
        nadpis: t("plocha.branie"),
        text: (
          <span className="cakanie-text">
            {tr("plocha.berieSuper", { meno: menoHraca(super_) })}
            <span className="bodky" aria-hidden="true" />
          </span>
        ),
        ...(mobil ? {} : { vpravo: skoreBrania }),
      };
    }
    if (zaHracaHra && stavim && draft?.mojVyber === null) {
      return {
        nadpis: t("plocha.stavba"),
        text: (
          <span className="cakanie-text">
            {t("plocha.staviaMelichar")}
            <span className="bodky" aria-hidden="true" />
          </span>
        ),
      };
    }
    if (!somNaTahu && stavim) {
      return {
        nadpis: t("plocha.stavba"),
        text: (
          <span className="cakanie-text">
            {tRod("plocha.vybralSi", rodHracaP(ja))} {tr("plocha.cakasKym", { meno: menoHraca(super_) })}
            <span className="bodky" aria-hidden="true" />
          </span>
        ),
      };
    }

    if (!somNaTahu && view.faza === "natocenieCiela") {
      return { nadpis: t("faza.natocenieCiela"), text: t("plocha.natacaSuper", { meno: menoHraca(super_) }) };
    }
    if (!somNaTahu && view.hasicVolba !== null && view.hasicVolba.hrac === super_) {
      const k = view.hasicVolba.karta;
      return {
        nadpis: t("plocha.hasic"),
        text: (
          <span className="cakanie-text">
            {tr("plocha.hasicSuper", { meno: menoHraca(super_), slovo: tRod("plocha.vytiahol", rodHracaP(super_)), karta: k === null ? "" : <> <strong>{menoKarty(k.defId)}</strong></> })}
            <span className="bodky" aria-hidden="true" />
          </span>
        ),
      };
    }
    if (!somNaTahu && view.vizia !== null) {
      return {
        nadpis: t("plocha.vizia"),
        text: (
          <span className="cakanie-text">
            {tr("plocha.viziaSuper", { meno: menoHraca(super_) })}
            <span className="bodky" aria-hidden="true" />
          </span>
        ),
      };
    }
    // Súperov krok na staršom (UX N4): názov kroku a čo z neho bude mať čakajúci, nie len „Čakáš“.
    const bsCak = view.bitkaStav;
    if (!somNaTahu && view.faza === "bitka" && bsCak !== null && bsCak.caka === super_ && (bsCak.krok === "prebytok" || bsCak.krok === "reci")) {
      const prebytok = bsCak.krok === "prebytok";
      return {
        nadpis: (
          <>
            {t("plocha.delenieSupera", { co: prebytok ? NAZOV_DELENIA.prebytok : NAZOV_DELENIA.hadka })} <small>{t("plocha.zostava", { n: prebytok ? bsCak.prebytokZostava : (bsCak.hadka?.zostava ?? 0) })}</small>
          </>
        ),
        text: (
          <span className="cakanie-text">
            {prebytok ? (
              <>
                {tr("plocha.superRozdelujeNakladacku", { meno: menoHraca(super_) })}
              </>
            ) : (
              <>
                {tr("plocha.superRozdelujeHadku", { meno: menoHraca(super_), skore: bsCak.hadka === undefined ? "" : `${bsCak.hadka.makke[super_]} : ${bsCak.hadka.makke[ja]} ` })}
              </>
            )}
            <span className="bodky" aria-hidden="true" />
          </span>
        ),
      };
    }

    // Pitka naraz (Michal 2026-10-27): kto skončil, čaká na súpera; s Bzdochou sa čaká, kým súper skončí.
    const psCak = view.pitkaStav;
    if (!somNaTahu && view.faza === "pitka" && view.vizia === null && psCak !== null && psCak.reakcia === null && !psCak.hotovy[ja] && cakaSBzdochou(psCak, ja)) {
      return {
        nadpis: t("plocha.bzdocha"),
        text: (
          <span className="cakanie-text">
            {tr("plocha.bzdochaText", { meno: menoHraca(super_) })}
            <span className="bodky" aria-hidden="true" />
          </span>
        ),
      };
    }
    if (!somNaTahu && view.faza === "pitka" && view.vizia === null && psCak !== null && psCak.reakcia === null && psCak.hotovy[ja] && !psCak.hotovy[super_]) {
      return {
        nadpis: t("plocha.cakas"),
        text: (
          <span className="cakanie-text">
            {tRod("plocha.skoncilSi", rodHracaP(ja))} {tr("plocha.esteHra", { meno: menoHraca(super_) })}
            {psCak.bzdocha === super_ ? t("plocha.maBzdochu") : ""}.
            <span className="bodky" aria-hidden="true" />
          </span>
        ),
      };
    }
    if (!somNaTahu) {
      return {
        nadpis: t("plocha.cakas"),
        text: (
          <span className="cakanie-text">
            {tr("plocha.naTahuJe", { meno: menoHraca(super_) })}
            <span className="bodky" aria-hidden="true" />
          </span>
        ),
      };
    }
    if (view.volbaNastupu !== null && view.volbaNastupu.hrac === ja) {
      // Voľby v7 čakajú ako Hasič: karta zo šenku (Zastávka, Predavačka, Živnostník), Zberný dvor, vila.
      const nv = view.volbaNastupu;
      if (nv.typ === "dvor") {
        // Frakcie (2026-11-08): Zberný dvor — spáliť 1 kartu z ruky, nie kliatbu.
        const ponuka = view.ruka.filter((k) => !defOf(data, k).tags.includes("Kliatba"));
        const nic = <button onClick={() => posli({ type: "spal", uid: null })}>{t("plocha.nicNepalit")}</button>;
        return {
          nadpis: t("plocha.zbernyDvor"),
          text: (
            <span className="vizia-text">
              <span>{t("plocha.smiesSpalit")}</span>{" "}
              {ponuka.map((k) => (
                <span key={k.uid} className="vizia-karta">
                  {karta({ karta: k, sirka: 72, onClick: () => posli({ type: "spal", uid: k.uid }) })}
                </span>
              ))}
            </span>
          ),
          ...(naSirku ? { druha: nic } : { vpravo: <span className="pecat pecat-tichy">{nic}</span> }),
        };
      }
      if (nv.typ === "vila") {
        return {
          nadpis: t("delenie.vila"),
          text: (
            <span>
              {t("plocha.vilaText")}{" "}
              {moznostiVily(view).map((m) => (
                <button key={m.elderId} type="button" className="pecat pecat-nakup" onClick={() => posli({ type: "vila", elderId: m.elderId })}>
                  {menoKarty(m.defId)}: {m.pred} → {m.po}
                </button>
              ))}
            </span>
          ),
        };
      }
      // Šenok: Podpora Predavačky (len Občan) a Živnostníka (len Nástroj) ponúka len kartu toho druhu.
      const ponuka = ponukaSenku(data, view, nv);
      return {
        nadpis: nv.zdroj === "predavacka" ? nazovKarty("Predavačka") : nv.zdroj === "zivnostnik" ? nazovKarty("Živnostník") : t("plocha.kartaZPonuky"),
        text: (
          <span className="vizia-text">
            <span>{textVolbySenku(nv.zdroj)}</span>{" "}
            {ponuka.map((k) => (
              <span key={k.uid} className="vizia-karta">
                {karta({ karta: k, sirka: 72, onClick: () => posli({ type: "senok", uid: k.uid }) })}
              </span>
            ))}
          </span>
        ),
      };
    }
    if (view.hasicVolba !== null) {
      // Hasič (Michal 2026-10-26): náhodná karta z odhadzovacieho balíčka — do ruky, alebo späť.
      const k = view.hasicVolba.karta;
      return {
        nadpis: t("plocha.hasic"),
        text: (
          <span className="vizia-text">
            {k !== null && <span className="vizia-karta">{sLupou({ karta: k, sirka: 72 })}</span>}
            <span>
              {k === null ? (
                t("plocha.hasicNieJe")
              ) : (
                <>
                  {tr("plocha.hasicTi", { karta: menoKarty(k.defId) })}
                </>
              )}
            </span>
          </span>
        ),
        // „vrátiť“ je druhá voľba, nie zrušenie — preto nie je ✕ na pečiatke.
        stred: pecatTahu({
          text: k === null ? t("plocha.pokracovat") : t("plocha.doRuky"),
          tip: k === null ? t("plocha.hraPokracuje") : t("plocha.nechasVRuke"),
          akcia: () => posli({ type: "hasic", nechat: k !== null }),
        }),
        ...(k === null ? {} : naSirku ? { druha: <button onClick={() => posli({ type: "hasic", nechat: false })}>{t("plocha.vratit")}</button> } : { vpravo: <button onClick={() => posli({ type: "hasic", nechat: false })}>{t("plocha.vratit")}</button> }),
      };
    }

    switch (view.faza) {
      case "natocenieCiela":
        return somNaTahu && lokalitaNavrh !== null
          ? {
              nadpis: t("faza.natocenieCiela"),
              text: (
                <>
                  {tr("plocha.natacas", { karta: menoKarty(lokalitaNavrh.karta.defId) })} {ikonyStranStredu}
                </>
              ),
            }
          : null;
      case "volbaCiela":
        return lokalitaNavrh === null
          ? {
              nadpis: t("faza.volbaCiela"),
              text: (mobil ? t("plocha.klikniPanel") : t("plocha.klikniNastenka")) + (natociSuper ? t("plocha.natociSuper", { meno: menoHraca(super_) }) : ""),
            }
          : natociSuper
            ? { nadpis: t("faza.volbaCiela"), text: t("plocha.natociJu", { karta: menoKarty(lokalitaNavrh.karta.defId), meno: menoHraca(super_) }) }
            : {
              nadpis: t("faza.volbaCiela"),
              text: (
                <>
                  <strong>{menoKarty(lokalitaNavrh.karta.defId)}</strong>
                  {lokalitaNavrhOtocena ? t("plocha.otocena") : ""} {t("plocha.klikomOtocis")} {ikonyStranStredu} {t("plocha.akcieHrany")}
                </>
              ),
            };

      case "draft": {
        if (draft === null) return null;
        if (draft.krok === "stavba" && naneisto) {
          return {
            nadpis: t("plocha.stavba"),
            text: tr("plocha.skusSi"),
          };
        }
        if (draft.krok === "stavba") {
          return {
            nadpis: t("plocha.stavba"),
            text: (
              <>
                {tr("plocha.klikomVyber", { karty: kariet(krokSt.doSenku) })}{" "}
                {t("plocha.naspodokNeuvidi", { zvysne: velkym(zvysnePojdu(krokSt.odhod)) })}
              </>
            ),
            // Na mobile je „potvrdiť“ v pätičke panelu stavby.
            ...(mobil
              ? {}
              : {
                  stred: pecatTahu({
                    text: t("plocha.potvrdit"),
                    skratka: "k",
                    dovod: stavbaHotova ? null : t("plocha.doPonuky", { a: doSenkuStavby.length, b: krokSt.doSenku }),
                    tip: t("plocha.naspodok", { zvysne: zvysnePojdu(odhodStavby.length) }),
                    akcia: potvrdStavbu,
                    ...(senokStavby.length > 0 ? { zrus: { akcia: zrusStavbu, popis: t("plocha.zrusitVyber") } } : {}),
                  }),
                }),
          };
        }
        // Na stole (nie na mobile, tam je pätička v paneli šenku) je potvrdenie pečiatkou na hrane
        // a pilulka hovorí, čo „hotovo“ potvrdí (Michal 2026-10-25).
        const cenaBrania = KONSTANTY.CENA_SENKU[zoSenku.length] ?? 0;
        return {
          nadpis: t("plocha.branie"),
          text:
            zoSenku.length > 0 ? (
              <>
                {zoSenku.length === 1
                  ? tr("plocha.beriesJednu", { karty: menoKarty(zoSenku[0]?.defId ?? ""), cig: cigariet(cenaBrania), vratit: mobil ? `„${t("plocha.vratit")}“` : "✕" })
                  : tr("plocha.beriesViac", { karty: zoSenku.map((k) => menoKarty(k.defId)).join(t("plocha.a")), cig: cigariet(cenaBrania), vratit: mobil ? `„${t("plocha.vratit")}“` : "✕" })}
              </>
            ) : mozemBrat ? (
              <>
                {tr("plocha.tvojTahBranie", { co: kolkoMozemBrat === 2 ? t("plocha.jednuAleboDve") : t("plocha.kartu"), jedna: cigariet(KONSTANTY.CENA_SENKU[1] ?? 1), dve: cigariet(KONSTANTY.CENA_SENKU[2] ?? 3), limit: limitTeraz })}
                {dovodJednejKarty !== null && <> {dovodJednejKarty}</>}
              </>
            ) : view.senok.length === 0 ? (
              t("plocha.ponukaPrazdna")
            ) : (
              <>
                {t("plocha.nemasCigaretu", { limit: limitTeraz })}
              </>
            ),
          ...(mobil
            ? {}
            : {
                // Počet cigariet je na bare hráča — ľavý kraj hrany patrí Pivnici (Michal 2026-11-02).
                stred:
                  zoSenku.length > 0
                    ? pecatTahu({
                        text: (
                          <>
                            <Vymena das={<CenaCigariet n={cenaBrania} />} dostanes={t("plocha.hotovo")} />
                          </>
                        ),
                        skratka: "k",
                        tip: t("plocha.beriesTip", { karty: zoSenku.map((k) => menoKarty(k.defId)).join(t("plocha.a")), cig: cigariet(cenaBrania) }),
                        akcia: potvrdBranie,
                        zrus: { akcia: () => setNavrh(null), popis: zoSenku.length === 1 ? t("plocha.vratitKartuDoPonuky") : t("plocha.vratitKartyDoPonuky") },
                      })
                    : pecatTahu({
                        text: t("plocha.uzNetaham"),
                        druh: "pas",
                        skratka: "p",
                        vyucba: "tlacidlo:pas",
                        tip: t("plocha.prestanesBrat", { n: limitTeraz, pravidlo: pravidloBrania }),
                        akcia: () => posli({ type: "draftStop" }),
                      }),
                vpravo: skoreBrania,
              }),
        };
      }

      case "zhromazdenie": {
        const zostava = zostavaTeraz;
        const plne = view.hraci[ja].poldeciPlne;
        // Fázu a limit hovorí jednotný bar (os kola, strany) — pilulka nesie len pokyn (Michal 2026-10-25).
        const nadpis = null;
        // Fajčiť sa vo v5 dá len v Pitke (bod 1, Michal 2026-10-24) — v Zhromaždení tlačidlo nie je.
        // Celý ťah naraz (Michal 2026-10-19): karty sa ťahajú na stôl ako návrh,
        // každá ďalšia stojí plný poldeci, server dostane ťah až po „potvrdiť“ na stole.
        if (vylozenia.length === 0 || plan === null) {
          const zaPas = cigaretyZaPas(data, view, ja);
          // Náradie (Michal 2026-11-08): Nástroj v ruke sa zasúva pod kartu v línii, nielen odkazuje.
          const nastrojVRuke = ruka.some((k) => ponukaPre(k).length > 0);
          const pokynNaradia =
            !nastrojVRuke ? null : (
              <>
                {t("zhrom.nastroj", { cigarety: cigariet(KONSTANTY.CENA_PODLOZENIA) })}{" "}
              </>
            );
          // Pas je nevratný: potvrdenie len keď ešte niečo vyložiť môžem (UX N1, U10).
          const mozemVylozit = zostava > 0 && [...moznostiMiesta.values()].some((m) => m.karty.size > 0);
          if (odlozenyPas.caka !== null) {
            return {
              nadpis,
              text: (
                <>
                  <strong>{t("zhrom.pasujesOdlozene", { cigarety: cigariet(zaPas), meno: menoHraca(super_), s: odlozenyPas.zostavaS })}</strong>
                  {stavka !== null && (
                    <>
                      <br />
                      <StavkaBitky stavka={stavka} />
                    </>
                  )}
                </>
              ),
              vpravo: (
                <>
                  <button className="pecat pecat-tichy" onClick={odlozenyPas.vrat} autoFocus>
                    {t("zhrom.vratit")}
                  </button>
                </>
              ),
            };
          }
          return {
            nadpis,
            text: textNahladuTahania ?? textVolbyMiesta ?? (![...moznostiMiesta.values()].some((m) => m.karty.size > 0) ? (
              // Pri vyčerpanom limite pokyn „potiahni kartu“ zavádzal (playtest výučby 20261025, K11).
              <>
                {zaPas > 0 ? tr("zhrom.nicNevylozisZaPas", { cigarety: cigariet(zaPas) }) : tr("zhrom.nicNevylozis")}{" "}
                {pokynNaradia}
                <span className="tlmene">{[...moznostiMiesta.values()].find((m) => m.dovod !== null)?.dovod ?? ""}</span>
              </>
            ) : (
              <>
                {/* Pokyn sa zmestí do jedného riadku aj pri 1366 px (UI inšpekcia 20261110-pojmy) — ďalšia karta v ťahu len pri plnom poldeci. */}
                {tr("zhrom.pokyn")}{" "}
                {pokynNaradia}
                {plne > 0 && <span className="tlmene">{t("zhrom.dalsiaKarta")}</span>}
              </>
            )),
            ...(() => {
              const pas = (
                <button
                  className="pecat pecat-koncim"
                  data-skratka="p"
                  data-vyucba="tlacidlo:pas"
                  title={t("zhrom.pasTip")}
                  onClick={() => (mozemVylozit && vyucba !== true ? odlozenyPas.spusti({ type: "pass" }) : posli({ type: "pass" }))}
                >
                  <Vymena das={t("zhrom.pasovat")} dostanes={<CenaCigariet n={zaPas} znamienko="+" />} />
                </button>
              );
              // Na telefóne je pas hlavná akcia pruhu pokynu, záverečná a odkaz idú do ▾.
              return naSirku
                ? {
                    stred: pas,
                    vpravo: (
                      <>
                        {tlacidloZaverecnej}
                        {tlacidloOdkazu}
                      </>
                    ),
                  }
                : {
                    vpravo: (
                      <>
                        {tlacidloZaverecnej}
                        {tlacidloOdkazu}
                        {pas}
                      </>
                    ),
                  };
            })(),
          };
        }
        const mojVyhlad = nahladyPitky?.[ja] ?? null;
        const poslednaVLinii = [...vylozenia].reverse().find((x) => x.ciel === "vlastna" || x.ciel === "superova");
        return {
          nadpis,
          text: (
            <>
              {vystrahaNavrhu !== null && poslednaVLinii !== undefined && (
                <strong className="pecen-varovanie">{textVystrahy(vystrahaNavrhu, poslednaVLinii.karta)} · </strong>
              )}
              {vylozenia.map((x, i) => (
                <span key={x.karta.uid} className="tah-polozka">
                  {i > 0 && " · "}
                  <strong>{menoKarty(x.karta.defId)}</strong> → {POPIS_CIELA[x.ciel]}
                  {poradieVTahu(x.karta.uid) >= 1 && <b className="poldeci-text"> ({t("plocha.minusPoldeci")})</b>}
                </span>
              ))}
              {plan.poldeci > 0 && (
                <strong className="poldeci-varovanie">
                  {" "}
                  {t("plocha.tahStoji", { n: plan.poldeci, z: zostava, na: plan.zostava })}
                  {mojVyhlad !== null && mojVyhlad.cirhozy > 0 && (vystrahaNavrhu?.cirhozy[ja] ?? 0) === 0
                    ? t("plocha.vPitkeCirhoza", { n: mojVyhlad.cirhozy, s: mojVyhlad.cirhozy * cenyKliatob[ja].cirhoza })
                    : ""}
                  .
                </strong>
              )}
              {plan.chyba !== null && <strong className="chyba-tahu"> {prelozHlasku(plan.chyba)}</strong>}
              {nahladSpojov !== null && (
                <span className="nahlad-spojov">
                  {" "}· {nahladSpojov.spoj} · {t("stol.ty")}: {nahladSpojov.ja} · {menoHraca(super_)}: {nahladSpojov.su}
                </span>
              )}
              {textNahladuTahania !== null && <> · {textNahladuTahania}</>}
              {textVolbyMiesta !== null && <> · {textVolbyMiesta}</>}
            </>
          ),
        };
      }

      case "pitka": {
        if (view.vizia !== null) {
          // Vízia (Michal 2026-10-19): vrchná karta balíčka do ruky, alebo navždy preč. Karta leží
          // na stole a voľby sú v strede spodnej hrany (Michal 2026-11-08, mockup V-B).
          const zostava = view.vizia.zostava[ja];
          const este = zostava > 1 ? t("plocha.esteVizia", { n: zostava - 1 }) : "";
          // Krištáľová guľa (Náradie 2026-10-30): dve vrchné karty — o jednej rozhodneš, druhá ostane navrchu.
          const gula = view.volbaViziaDruha != null;
          return {
            nadpis: gula ? t("plocha.viziaGula") : t("plocha.vizia"),
            text: gula
              ? t("plocha.viziaDve") + este
              : t("plocha.viziaJedna") + este,
            stred: kartyVizie.length === 0 ? undefined : <VolbyVizie karty={kartyVizie} rozmer={rozmerKarietVizie} onVolba={(i, vziat) => posli(zamerVizie(i, vziat))} />,
          };
        }
        const hracJa = view.hraci[ja];
        const pitkaSt = view.pitkaStav;
        const obranca = opponentOf(view.utocnik);
        const naexBol = naexLimitMinuty;
        // Štítok pri karte Agresor prehliadol (playtest 20261106) — súperovo NA EX z Bzdochy patrí aj do hlavičky.
        const cezBzdochu = cieleSuperovhoNaex(view, menoKarty);
        const nadpis =
          cezBzdochu.length === 0 ? null : (
            <span className="nadpis-bzdocha" title={t("plocha.bzdochaTitul")}>
              {menoHraca(super_)} {tRod("plocha.dal", rodHracaP(super_))} {t("plocha.naexNa", { karty: cezBzdochu.join(t("plocha.a")) })}
            </span>
          );
        if (reagujem) {
          // Odpoveď na súperovo NA EX (v9.2, Michal 2026-10-30): jedna karta lícom dole za plný poldeci (v11.16),
          // mimo limitu — najprv útočník, potom obranca na druhý kraj; otočia sa naraz.
          const poMneSuper = (pitkaSt?.frontaReakcii ?? []).includes(super_);
          const krajSupera = pitkaSt?.krajOdpovede ?? null;
          const superoveNaex = view.strany
            .flat()
            .filter((pl) => pl.naexBy === super_ || pl.naexBy2 === super_)
            .map((pl) => (pl.vytrznik === true ? t("plocha.vytrznikZatvorka", { meno: menoKarty(pl.card.defId) }) : menoKarty(pl.card.defId)));
          return vylozene === null
            ? {
                nadpis: t("plocha.odpovedNaNaex"),
                text: textNahladuTahania ?? textVolbyMiesta ?? (
                  <>
                    {tr("plocha.naexOdkryte", { meno: menoHraca(super_), dal: tRod("plocha.dal", rodHracaP(super_)), na: superoveNaex.length > 0 ? ` ${t("plocha.naexNaKarty", { karty: superoveNaex.join(t("plocha.a")) })}` : "", ikona: <IkonaPoldeci /> })}{" "}
                    {poMneSuper ? (
                      <strong>{t("plocha.odpovedasPrvy", { meno: menoHraca(super_) })}</strong>
                    ) : krajSupera !== null ? (
                      <strong>{t("plocha.uzOdpovedalLicom", { meno: menoHraca(super_) })}</strong>
                    ) : obranca === ja ? (
                      <strong>{t("plocha.neodpovedal", { meno: menoHraca(super_) })}</strong>
                    ) : null}{" "}
                    {t("plocha.obeOdpovede")}{" "}
                    {tr("plocha.potiahniJu")}
                  </>
                ),
                stred: pecatTahu({
                  text: t("plocha.bezOdpovede"),
                  druh: "pas",
                  vyucba: "tlacidlo:bez-odpovede",
                  tip: t("plocha.neodpovies"),
                  akcia: () => posli({ type: "bezReakcie" }),
                }),
              }
            : {
                nadpis: t("plocha.odpovedNaNaex"),
                text: (
                  <>
                    <strong>{menoKarty(vylozene.karta.defId)}</strong> → {POPIS_CIELA[vylozene.ciel]}
                    {nahladSpojov !== null && (
                      <span className="nahlad-spojov">
                        {" "}· {nahladSpojov.spoj} · {t("stol.ty")}: {nahladSpojov.ja} · {menoHraca(super_)}: {nahladSpojov.su}
                      </span>
                    )}
                    {nahladOdpovede !== null && odhad !== null && (
                      <span className="tlmene">
                        {" "}· {t("rekap.bitka")} {nahladOdpovede.pred.tuhe[ja]}:{nahladOdpovede.pred.tuhe[super_]} → <b>{nahladOdpovede.po.tuhe[ja]}:{nahladOdpovede.po.tuhe[super_]}</b> · {t("plocha.kliatbyTy")}{" "}
                        {textKliatob(nahladOdpovede.kliatby[ja])} · {menoHraca(super_)}: {textKliatob(nahladOdpovede.kliatby[super_])}
                        {textDopadov(nahladOdpovede.dopady) !== null && <> · {textDopadov(nahladOdpovede.dopady)}</>}
                        {textPrebytku(nahladOdpovede.prebytokPred, nahladOdpovede.prebytokPo) !== null && <> · {textPrebytku(nahladOdpovede.prebytokPred, nahladOdpovede.prebytokPo)}</>}
                      </span>
                    )}
                    {textVolbyMiesta !== null && <> · {textVolbyMiesta}</>}
                  </>
                ),
              };
        }
        // Prečo NA EX nejde — hráč to vidí hneď, nielen v tooltipe.
        const dovodBezNaex = naexCiele.size > 0
          ? null
          : naexBol
          ? mojeSkryteNaex.size > 0
            ? t("plocha.naexLeziSkryto")
            : t("plocha.naexUzDal")
          : hracJa.poldeciPlne - mojeSkryteNaex.size <= 0
            ? t("plocha.nemasPlny")
            : naexCiele.size === 0
              ? view.ciel?.lokalita?.defId === "kostol"
                ? t("plocha.kostol")
                : t("plocha.naexLenObcan")
              : null;
        // Krčma chce jedno NA EX; po ňom už končím nič neblokuje.
        const krcma = view.ciel?.lokalita?.defId === "krcma" && dovodBezNaex === null && mojeSkryteNaex.size === 0;
        const cenaBarteru = barterCena(data, view, ja);
        // Vínko (Michal 2026-10-19): s ním sa poldeci za cigarety nedolieva.
        const vinko = hracJa.dedicstvo.some((k) => k.defId === "vinko");
        const zakazFajc = dovodZakazuFajcit(data, view, ja);
        // Pitka naraz (Michal 2026-10-27): obaja hrajú súčasne; poradie platí len pre odpovede na NA EX.
        const superSkoncil = pitkaSt?.hotovy[super_] === true;
        const superCakaSBzdochou = pitkaSt != null && cakaSBzdochou(pitkaSt, super_);
        // NA EX naraz (v5): či súper NA EX dal, sa ukáže až pri odkrytí — tu len že už vybral.
        const kontext = superSkoncil ? (
          <>
            <strong>
              {menoHraca(super_)} {tRod("plocha.uzVybral", rodHracaP(super_))}
            </strong>{" "}
            {vidimVolbuSupera
              ? superoveSkryteNaex.size > 0
                ? t("plocha.jehoNaexVidis")
                : t("plocha.naexNedal")
              : t("plocha.ciAKam")}{" "}
            {obranca === ja ? t("plocha.odpovedaOn") : t("plocha.odpovedasTy")}{" "}
          </>
        ) : (
          <>
            <strong>{t("plocha.hrateNaraz")}</strong>{" "}
            {superCakaSBzdochou
              ? t("plocha.superMaBzdochu", { meno: menoHraca(super_) })
              : t("plocha.vyberateSkryto")}{" "}
          </>
        );
        const limitPo = limitBuduceKolo(zaklad, ja, true, data);
        const limitBez = limitBuduceKolo(zaklad, ja, false, data);
        // „Skončiť Pitku“ chce druhý klik len vtedy, keď hráč má plný poldeci a NA EX nedal (Michal 2026-10-27).
        const hotovoVzdavaNaex =
          dovodBezNaex === null && mojeSkryteNaex.size === 0 && (pitkaSt?.naexPocet?.[ja] ?? 0) === 0 && hracJa.poldeciPlne > 0 && !krcma;
        const potvrdzujem = potvrdenie === "hotovo" && hotovoVzdavaNaex;
        const cig = hracJa.cigarety;
        // Fajčenie zdražie s každým v tej istej Pitke (Michal 2026-10-27): 1, 2, 3… cigarety.
        const cenaFajc = cenaFajceniaHraca(view, ja);
        // Nákupy za cigarety (Michal 2026-10-21): každý je samostatná pečiatka vľavo na hrane stola — jeden klik.
        const nakupy = (
          <>
            {pecatNakupu({
              kluc: "fajcit",
              // Pečiatka ukazuje, čo hráč dostane (Michal 2026-10-27): cena v cigaretách → karta.
              zisk: <IkonaKarty zakaz={zakazFajc !== null} />,
              nazov: cenaFajc === 0 ? t("plocha.fajcitZadarmo") : t("plocha.fajcit"),
              cena: cenaFajc,
              dovod: zakazFajc !== null
                ? zakazFajc
                : cig < cenaFajc
                  ? t("plocha.fajcitStoji", { cena: cigariet(cenaFajc), mas: cig })
                  : !jeCoTahat(hracJa.doberaciPocet, hracJa.odhadzovaci.length)
                    ? t("plocha.nemasZCoho")
                    : null,
              tip:
                cenaFajc === 0
                  ? t("plocha.benzinkaTip", { cena: cigariet(cenaFajceniaHraca(view, ja, 2)) })
                  : t("plocha.fajcitTip", { cena: cigariet(cenaFajc), benzinka: prveFajcenieZadarmo(view) ? t("plocha.benzinkaLacnejsie") : "", dalsie: cigariet(cenaFajceniaHraca(view, ja, 2) - cenaFajc), nova: prveFajcenieZadarmo(view) ? t("tabula.zadarmo") : t("plocha.odCeny", { cena: cigariet(KONSTANTY.CENA_FAJCENIA_ZAKLAD) }) }),
              akcia: () => cmd({ type: "smoke", pocet: 1 }),
            })}
            {pecatNakupu({
              kluc: "doliat",
              zisk: <IkonaPoldeci />,
              nazov: t("plocha.doliat"),
              cena: KONSTANTY.REFILL_CENA,
              dovod: vinko
                ? t("plocha.vinko")
                : jednotaZakazuje(view, ja)
                ? t("plocha.jednota")
                : hracJa.poldeciVypite === 0
                  ? t("plocha.nemasVypity")
                  : cig < KONSTANTY.REFILL_CENA
                    ? t("plocha.doliatStoji", { cena: cigariet(KONSTANTY.REFILL_CENA), mas: cig })
                    : null,
              tip: t("plocha.doliatTip", { cena: cigariet(KONSTANTY.REFILL_CENA) }),
              akcia: () => cmd({ type: "refillPoldeci" }),
            })}
            {pecatNakupu({
              kluc: "novy",
              zisk: <IkonaPoldeci novy />,
              nazov: t("tabula.novyPoldeci"),
              cena: cenaBarteru,
              dovod: cig < cenaBarteru ? t("plocha.barterStoji", { cena: cigariet(cenaBarteru), mas: cig }) : null,
              tip: t("plocha.barterTip", { cena: cigariet(cenaBarteru) }),
              akcia: () => cmd({ type: "barter" }),
            })}
            {/* Kšefty (Strýko, lokalita, väzni) nie sú tu — ležia pod kartou, ktorá ich ponúka (Michal 2026-11-02). */}
          </>
        );
        const koncim = (
          <button
            className="pecat pecat-koncim"
            data-skratka="k"
            data-vyucba="tlacidlo:hotovo"
            aria-disabled={krcma}
            title={
              krcma
                ? t("plocha.krcmaNajprv")
                : potvrdzujem
                  ? t("plocha.esteJedenKlik")
                  : superSkoncil
                    ? t("plocha.nedaSaVratitOdkryju")
                    : superCakaSBzdochou
                      ? t("plocha.nedaSaVratitBzdocha", { meno: menoHraca(super_) })
                      : t("plocha.nedaSaVratit", { meno: menoHraca(super_) })
            }
            onClick={() => {
              if (krcma) return;
              if (hotovoVzdavaNaex && !potvrdzujem && vyucba !== true) setPotvrdenie("hotovo");
              else posli({ type: "skipNaex" });
            }}
          >
            {potvrdzujem ? (naSirku ? t("plocha.naozajTukni") : t("plocha.naozajBezNaex")) : t("plocha.skoncitPitku")}
          </button>
        );
        // Vybraná karta (klik na kartu so značkou): pod kartou „vybraná“, v pilulke náhľad, na hrane pečiatka NA EX!.
        const vybranaUid = mode.typ === "naexCiel" ? mode.uid : null;
        const vybrana = vybranaUid === null ? undefined : nahladNaex.get(vybranaUid);
        // Najhoršia verejne možná odpoveď súpera — skúša celú sadu, preto len pre vybranú kartu (playtest 20261026-173610-3).
        const odpoved = vybrana === undefined ? null : najhorsiaOdpovedNaNaex(data, vybrana);
        const naRub = vybranaUid !== null && view.zaverecne.some((z) => z.uid === vybranaUid);
        const menoVybranej = naRub ? t("plocha.superovuZaverecnu") : vybranaUid === null ? "" : menoKarty(view.strany.flat().find((pl) => pl.card.uid === vybranaUid)?.card.defId ?? "");
        // Limit po NA EX na túto kartu: akcie Poldeci po NA EX (zruší či zdvojí ich) — playtest 20261026-173610-1.
        const limitPoVybranej = vybrana === undefined ? limitPo : limitBuduceKolo(vybrana.odkrytie.view, ja, false, data);
        const textVyberu = naRub ? (
          <span className="naex-vyber-text">
            {tr("plocha.naexNaRub")}
          </span>
        ) :
          vybrana === undefined || odhad === null ? null : (
            <span className="naex-vyber-text">
              <strong>{t("plocha.naexNaKartu", { karta: menoVybranej })}</strong> · {t("rekap.bitka")} {vybrana.pred.tuhe[ja]}:{vybrana.pred.tuhe[super_]} →{" "}
              <b>
                {vybrana.po.tuhe[ja]}:{vybrana.po.tuhe[super_]}
              </b>{" "}
              {vybrana.po.tuhe[ja] - vybrana.po.tuhe[super_] > vybrana.pred.tuhe[ja] - vybrana.pred.tuhe[super_]
                ? "▲"
                : vybrana.po.tuhe[ja] - vybrana.po.tuhe[super_] < vybrana.pred.tuhe[ja] - vybrana.pred.tuhe[super_]
                  ? "▼"
                  : "="}{" "}
              {odpoved !== null && (
                <span title={odpoved.strana === ja ? t("plocha.najhorsiaVlavo", { karta: menoKarty(odpoved.karta.defId) }) : t("plocha.najhorsiaVpravo", { karta: menoKarty(odpoved.karta.defId) })}>
                  · {t("plocha.poNajhorsej", { meno: menoHraca(super_) })}{" "}
                  <b>
                    {odpoved.damage.tuhe[ja]}:{odpoved.damage.tuhe[super_]}
                  </b>{" "}
                </span>
              )}
              {kratkaCena(vybrana.kliatby, vybrana.dopady) !== null && <>· {t("plocha.cena")} <b>{kratkaCena(vybrana.kliatby, vybrana.dopady)}</b> </>}
              · {t("stol.ty")}: {vybrana.zmeny[ja].length > 0 ? vybrana.zmeny[ja].join(", ") : t("plocha.bezZmeny")} · {menoHraca(super_)}:{" "}
              {vybrana.zmeny[super_].length > 0 ? vybrana.zmeny[super_].join(", ") : t("plocha.bezZmeny")}
              <span className="tlmene">
                {" "}
                · {t("plocha.kliatbyTy")} {textKliatob(vybrana.kliatby[ja])} · {menoHraca(super_)}: {textKliatob(vybrana.kliatby[super_])}
                {textDopadov(vybrana.dopady) !== null && <> · {textDopadov(vybrana.dopady)}</>}
                {textPrebytku(vybrana.prebytokPred, vybrana.prebytokPo) !== null && <> · {textPrebytku(vybrana.prebytokPred, vybrana.prebytokPo)}</>} · {t("plocha.pecenPlus")}
                {vybrana.odkrytie.svokra > 0 && (
                  <>
                    {" "}
                    · {t("plocha.svokra", { meno: menoHraca(super_), n: vybrana.odkrytie.svokra })}
                  </>
                )}
                {vybrana.odkrytie.kar && <> · {t("plocha.kar", { meno: menoHraca(super_) })}</>}
                {poBitkeNaex(vybrana.odkrytie.view, vybranaUid) !== null && <> · {t("panel.poBitkePrehra")} {poBitkeNaex(vybrana.odkrytie.view, vybranaUid)}</>}
                {view.zaverecne.some((z) => z.majitel === super_) && <> · {t("plocha.bezZaverecnej")}</>} ·{" "}
                {t("plocha.naexDetail", { limit: limitPoVybranej === limitBez ? t("plocha.ostane", { n: limitBez }) : t("plocha.namiesto", { a: limitPoVybranej, b: limitBez }), meno: menoHraca(super_), ruka: kariet(view.hraci[super_].rukaPocet) })}
              </span>
            </span>
          );
        // Tlačidlo NA EX je v Pitke stále (Michal 2026-10-27) — bez vybranej karty neaktívne a v tooltipe povie prečo.
        const naexStred =
          vybranaUid === null || dovodBezNaex !== null ? (
            <span className="pecat-naex-obal">
              <button
                className="tlacidlo-naex pecat-naex neaktivne"
                data-vyucba="tlacidlo:naex"
                aria-disabled="true"
                title={dovodBezNaex ?? t("plocha.najprvKlikni")}
                // Na dotyku nápoveda pod myšou nie je — ťuk povie, prečo NA EX teraz nejde.
                onClick={
                  naSirku
                    ? (e) => setChybaTahania({ text: dovodBezNaex ?? t("plocha.najprvTukni"), x: e.clientX, y: e.clientY })
                    : undefined
                }
              >
                NA EX!
              </button>
            </span>
          ) : (
            <span className="pecat-naex-obal">
              <button
                className="tlacidlo-naex pecat-naex"
                data-skratka="n"
                data-vyucba="tlacidlo:naex"
                title={t("plocha.naexSkryto", { karta: menoVybranej, meno: menoHraca(super_) })}
                onClick={() => posli({ type: "naex", uid: vybranaUid })}
              >
                NA EX!
              </button>
              <button className="pecat-zrusit" aria-label={t("plocha.zrusitVyber")} title={t("plocha.zrusitVyberPravy")} onClick={() => setMode({ typ: "ziadny" })}>
                ✕
              </button>
            </span>
          );
        // Voľba až na konci ako celá veta — na začiatku sa čítala ako odtrhnutý kus vety pred
        // „Začínaš Pitku“ (playtest výučby 20261025). Výučba ju nevysvetľuje, tam nie je.
        const odkazBezNaex =
          !potvrdzujem && !krcma && textVyberu === null && !bezNaex.zapnute && vyucba !== true ? (
            <button
              className="auto-hotovo-odkaz"
              title={t("plocha.bezNaexTitul")}
              onClick={bezNaex.zapni}
            >
              {t("plocha.dalsiePitkyBezNaex")}
            </button>
          ) : null;
        return {
          nadpis,
          naliehavy: potvrdzujem,
          ...(naSirku ? {} : { odkaz: odkazBezNaex }),
          text: potvrdzujem ? (
            <strong>{t("plocha.skoncitBezNaex")}</strong>
          ) : krcma ? (
            textVyberu ?? <strong>{t("plocha.krcmaMusis")}</strong>
          ) : (
            textVyberu ?? (
              <>
                {/* Prepínač je odkaz v texte, nie pečiatka — na hrane by prekryl popis kraja (UX/UI, 1600×1000). */}
                {bezNaex.zapnute && (
                  <>
                    <strong>{t("plocha.doKoncaBitky")}</strong>{" "}
                    <button className="auto-hotovo-odkaz" onClick={bezNaex.vypni}>
                      {t("plocha.zrusit")}
                    </button>{" "}
                  </>
                )}
                {kontext}
                {mojeSkryteNaex.size > 0 && (
                  <>
                    <strong>
                      {t("plocha.naexLeziNa", { karty: [...mojeSkryteNaex]
                        .map((uid) =>
                          view.zaverecne.some((z) => z.uid === uid) ? t("plocha.superovejZaverecnej") : menoKarty(view.strany.flat().find((pl) => pl.card.uid === uid)?.card.defId ?? ""),
                        )
                        .join(t("plocha.a")) })}
                    </strong>{" "}
                    {t("plocha.nevidiKym", { meno: menoHraca(super_) })}{" "}
                  </>
                )}
                {dovodBezNaex !== null ? (
                  <>
                    {t("plocha.fajciDoliat")} <span className="tlmene">{dovodBezNaex}</span>
                  </>
                ) : (
                  <>
                    {t("plocha.klikniNaexAlebo")}{" "}
                    <span className="tlmene">
                      {t("plocha.naexSaVypije", { limit: limitPo === limitBez ? t("plocha.ostane", { n: limitBez }) : t("plocha.namiesto", { a: limitPo, b: limitBez }) })}
                    </span>
                  </>
                )}
                {naSirku && odkazBezNaex !== null && <> {odkazBezNaex}</>}
              </>
            )
          ),
          ...(naSirku
            ? // Telefón: hlavná akcia pruhu je NA EX!, keď je karta vybraná, inak Skončiť Pitku; zvyšok v ▾.
              vybranaUid !== null && dovodBezNaex === null && !potvrdzujem
              ? {
                  vlavo: nakupy,
                  stred: naexStred,
                  vpravo: koncim,
                }
              : {
                  vlavo: (
                    <>
                      {naexStred}
                      {nakupy}
                    </>
                  ),
                  stred: koncim,
                }
            : {
                vlavo: nakupy,
                stred: naexStred,
                vpravo: koncim,
              }),
        };
      }

      case "bitka": {
        const b = view.bitkaStav;
        if (b === null) return null;
        if (b.krok === "vestica") {
          const v = mode.typ === "vestica" ? mode : { moja: null, jeho: null };
          return {
            nadpis: t("plocha.vestica"),
            text: `${tRod("plocha.prehralSi", rodHracaP(ja))} ${t("plocha.vesticaText")}`,
            vlavo: <button onClick={() => setVrstva("vestica")}>{t("plocha.balicky")}</button>,
            stred: pecatTahu({
              text: t("plocha.vymenit"),
              dovod: v.moja === null || v.jeho === null ? t("plocha.vyberPoJednej") : null,
              akcia: () => v.moja !== null && v.jeho !== null && posli({ type: "vestica", moja: v.moja, jeho: v.jeho }),
            }),
          };
        }
        if (b.krok === "cintorin") {
          // Cintorín (v11.13): porazený si smie vziať do ruky 1 kartu zo svojho odhadzovacieho balíčka —
          // čaká sa po návrate kariet, takže sú v ňom aj karty z práve odohranej línie (Michal 2026-11-07).
          return {
            nadpis: nazovKarty("Cintorín"),
            text: (
              <span className="zberatel-text">
                <span>
                  {tRod("plocha.cintorin", rodHracaP(ja))}: {tr("plocha.cintorinText")}
                </span>
                <span className="zberatel-ponuka">
                  {view.hraci[ja].odhadzovaci.map((k, _, vsetky) => (
                    // S kartami z línie býva balíček dlhší — menšie karty, nech panel na notebooku nezakryje spodok stola.
                    <span key={k.uid}>{karta({ karta: k, sirka: vsetky.length > 12 ? 64 : 84, onClick: () => posli({ type: "cintorin", uid: k.uid }) })}</span>
                  ))}
                </span>
              </span>
            ),
            tlacidla: <button onClick={() => posli({ type: "cintorin", uid: null })}>{t("starsi.nic")}</button>,
          };
        }
        // Nakladačka (strach) a hádka (reči), v11: klik na stupeň v teplomeri pridá zdvih.
        // Bublina rozdeľovania: názov, žetóny (idú / zostáva), cena stupňov a čo prepadne.
        if ((b.krok === "reci" || b.krok === "prebytok") && planDelenia !== null && krokDelenia !== null) {
          const zvysok = planDelenia.zvysok;
          const ide = planDelenia.cena;
          const m = planDelenia.esteSaDa.length;
          // Zajať / Presvedčiť (v11.6) nie sú v bubline — pečiatka na staršom (akciaStarsieho).
          return {
            jednotny: true,
            nadpis: (
              <>
                <span className="pil-nazov">
                  <IkonaDelenia krok={krokDelenia} /> {NAZOV_DELENIA[krokDelenia]} → {krokDelenia === "prebytok" ? t("starsi.tvojStrach") : t("starsi.tvojeReci")}
                </span>
                <span className="zetony" aria-hidden="true">
                  {Array.from({ length: Math.min(ide + zvysok, 24) }, (_, i) => (
                    <span key={i} className={`zeton${i < ide ? " ide" : ""}`}>
                      <IkonaDelenia krok={krokDelenia} />
                    </span>
                  ))}
                </span>
                <span data-vyucba="rozdelenie-zvysok">
                  {tr("plocha.zostavaZ", { n: <b className="cislo">{zvysok}</b>, z: planDelenia.body })}
                </span>
              </>
            ),
            text: (
              <>
                <span className="pil-sep">·</span>
                <span title={cenaPola()}>{t("plocha.stupen123")}</span>
                <span className="pil-sep">·</span>
                {zvysok === 0 ? (
                  <span>{t("plocha.vsetkoRozdane")}</span>
                ) : m > 0 ? (
                  <span>
                    {tr("plocha.staciEste", { n: m, cislo: <b className="cislo">{m}</b> })}
                  </span>
                ) : (
                  <span className="prepadne">
                    {tr("plocha.prepadneB", { n: <b className="cislo">{planDelenia.prepadne}</b> })}
                  </span>
                )}
                {ide === 0 && m > 0 && (
                  <>
                    <span className="pil-sep">·</span>{" "}
                    {/* Medzera: na telefóne je oddeľovač skrytý a vety by sa zliali. */}
                    <span>
                      <span className="len-mys">{t("plocha.klikni")}</span>
                      <span className="len-dotyk">{t("plocha.tukni")}</span> {t("plocha.naStupen")}
                    </span>
                  </>
                )}
              </>
            ),
          };
        }
        return null;
      }

      default:
        return null;
    }
  })();

  // ---- starší -------------------------------------------------------------
  /** Reči z hádky po starších a meno staršieho podľa priazne — rekapitulácia bitky (v11). */
  const priazneBitky = (_kolo: number): PriazneBitky => {
    const hadka = reciZHadky({ hadka: view.bitkaStav?.hadka, zmeny: view.zmenyMarkerov }, ja).flatMap((x) => {
      const e = view.starsi.find((y) => y.elderId === x.elderId);
      return e === undefined ? [] : [{ ...x, meno: menoKarty(e.karta.defId), fav: favourStarsieho(data, e) }];
    });
    return {
      hadka,
      menoStarsieho: (fav) => {
        const e = view.starsi.find((x) => favourStarsieho(data, x) === fav);
        return e === undefined ? null : menoKarty(e.karta.defId);
      },
    };
  };
  // Nakladačku a hádku rozdeľuje hráč klikom na stupeň v teplomeri (rozdelenieStarsieho).

  // ---- línia starších na mieste línie kariet (Michal 2026-10-23, #68 + #69 variant A) ----
  // Krok na staršom ukáže líniu obom hráčom; čakajúci si smie nahliadnuť na stôl.
  const krokNa = krokNaStarsich(view);
  const krokStarsich: (KrokNaStarsich & { readonly nazov: string }) | null =
    krokNa === null
      ? null
      : {
          ...krokNa,
          nazov: NAZOV_DELENIA[krokNa.typ],
        };
  const klucKroku = krokStarsich === null ? null : `${view.kolo}-${krokStarsich.typ}-${krokStarsich.kto}`;
  /** Čie čísla línia zvýrazní (Body hráča alebo súpera); null = línia kariet. */
  const [pohladStarsich, setPohladStarsich] = useState<PlayerId | null>(null);
  const [nahliadnutie, setNahliadnutie] = useState(false);
  useEffect(() => setNahliadnutie(false), [klucKroku]);
  // Ťah na stole — aj stavba a branie šenku (Michal 2026-10-30) — zavrie ručne otvorených
  // starších; počas neho si ich hráč smie otvoriť znova.
  const mamTahNaStole = tahNaStole(view, somNaTahu);
  useEffect(() => {
    if (mamTahNaStole) setPohladStarsich(null);
  }, [mamTahNaStole]);
  // Línia starších zmizne, hneď ako prestane byť aktuálna (Michal 2026-10-27): koniec bitky či
  // pokusu o zajatie, výber lokality, šenok, Zhromaždenie, Pitka — aj keď je na ťahu súper.
  const fazaStola = klucPrechodu(view);
  const predoslaFazaStola = useRef(fazaStola);
  useEffect(() => {
    if (predoslaFazaStola.current === fazaStola) return;
    predoslaFazaStola.current = fazaStola;
    setPohladStarsich(null);
  }, [fazaStola]);
  // Kým beží počítadlo bitky či zastavenie po poslednej Pitke, stôl ukazuje líniu kariet (rozsvecujú sa,
  // resp. nesú NA EX), nie starších.
  // Pauza po súperovej voľbe cieľa líniu starších na chvíľu skryje — rámik pauzy by inak svietil
  // na medzeru medzi staršími a vybranú lokalitu by nebolo vidno (Michal 2026-10-26). Po pauze
  // sa línia vráti sama: stav, ktorý ju otvoril (zajatie, Starší), sa nemení.
  // Súhrn po bitke ide na línii starších (návrh c) — pred nástenkou s voľbou lokality.
  const starsiViditelni =
    !pauzaBezi &&
    tahanie === null &&
    pocitadlo === null &&
    !zastavenieBezi &&
    (suhrnBezi || starsiNaStole({ krok: krokStarsich !== null, nahliadnutie, rucne: pohladStarsich !== null, vyucba: ukazStarsich }));
  const pohladLinie = pohladStarsich ?? ja;
  // Krčmová nástenka leží na mieste hracej plochy (Michal 2026-10-27), nie v okne nad stolom.
  // Pri voľbe cieľa sa ukáže sama a vyberá sa v nej lokalita (obranca klikne, útočník čaká).
  // Pri ťahaní lokality z nej ustúpi, nech je vidno, kam ju pustiť; krok na staršom má prednosť.
  const volbaNaStole = !mobil && !pauzaBezi && view.faza === "volbaCiela" && view.koniec === null && lokalitaNavrh === null;
  const nastenkaNaStole = (vrstva === "lokality" || volbaNaStole) && tahanie === null && !starsiViditelni;
  // Bar starších (Michal 2026-10-27): po kliku na Starších ukážu oba bary dlaždicu na každého staršieho;
  // späť sa prepnú spolu so stolom. Nástenka (Špaky) prepne bary na dlaždice špakov (rezimBaru).
  const bodovyRezim = starsiViditelni && pohladStarsich !== null;

  const zavriStarsich = (): void => setPohladStarsich(null);
  const prepniStarsich = (p: PlayerId): void => {
    // Nástenka (Špaky) a línia starších (Starší) sa navzájom vylučujú (Michal 2026-10-27).
    setVrstva((v) => (v === "lokality" ? null : v));
    if (krokStarsich !== null && !nahliadnutie) {
      setPohladStarsich((x) => (x === p ? null : p));
      return;
    }
    setNahliadnutie(false);
    if (starsiViditelni && pohladLinie === p) zavriStarsich();
    else setPohladStarsich(p);
  };
  const otvorNastenku = (p: PlayerId): void => {
    if (vrstva === "lokality" && nastenkaPre === p) {
      setVrstva(null);
      return;
    }
    zavriStarsich();
    setNastenkaPre(p);
    setVrstva("lokality");
  };
  // Nástenka na stole nemá okno s krížikom — Esc ju zavrie (lupa karty má prednosť).
  useEffect(() => {
    if (vrstva !== "lokality") return;
    const klaves = (e: KeyboardEvent): void => {
      if (e.key === "Escape" && lupa === null) setVrstva(null);
    };
    window.addEventListener("keydown", klaves);
    return () => window.removeEventListener("keydown", klaves);
  }, [vrstva, lupa]);
  useEffect(() => {
    if (!starsiViditelni && !nahliadnutie) return;
    const klaves = (e: KeyboardEvent): void => {
      if (e.key !== "Escape" || vrstva !== null || lupa !== null) return;
      // Esc krok nezruší (UX): v kroku vráti z nahliadnutia späť na starších.
      if (nahliadnutie) setNahliadnutie(false);
      else if (krokStarsich === null) zavriStarsich();
    };
    window.addEventListener("keydown", klaves);
    return () => window.removeEventListener("keydown", klaves);
  }, [starsiViditelni, nahliadnutie, vrstva, lupa, krokStarsich === null]);
  // Starší, ktorým sa práve pohol marker — v línii bliknú.
  const markeryPred = useRef<ReadonlyMap<string, string> | null>(null);
  const [zmeneniStarsi, setZmeneniStarsi] = useState<ReadonlySet<string>>(new Set());
  useEffect(() => {
    const kluc = (e: ElderState): string => `${e.strach.join()}|${e.reci.join()}|${e.reciOd?.join() ?? ""}`;
    const teraz = new Map(view.starsi.map((e) => [e.elderId, kluc(e)]));
    const pred = markeryPred.current;
    markeryPred.current = teraz;
    if (pred === null) return;
    const zmena = new Set(view.starsi.filter((e) => pred.get(e.elderId) !== kluc(e)).map((e) => e.elderId));
    if (zmena.size === 0) return;
    setZmeneniStarsi(zmena);
    const t = setTimeout(() => setZmeneniStarsi(new Set()), 1600);
    return () => clearTimeout(t);
  }, [view.starsi]);
  const krokMoj = krokStarsich !== null && krokStarsich.kto === ja && somNaTahu;

  /** Prečo sa na staršieho v mojom kroku nedá kliknúť — Nakladačka a hádka: stupne, ktoré sa nedajú, nesie teplomer (zamknutý, mimo). */
  const zamokStarsieho = (_e: ElderState): string | undefined => undefined;
  /** Starší pri rozdeľovaní (v11): stupne môjho markera a nepotvrdený zdvih z plánu jadra. */
  const rozdelenieStarsieho = (e: ElderState): RozdelenieStarsieho | undefined => {
    if (planDelenia === null || krokDelenia === null || !krokMoj) return undefined;
    return {
      marker: planDelenia.marker,
      stupne: stupneRozdelenia(view, ja, zdvihyDelenia, e.elderId, akcieDelenia),
      zdvih: zdvihStarsieho(e, ja, planDelenia.marker, zdvihyDelenia),
      klik: (s) => klikDelenia(e.elderId, s),
    };
  };
  const poDeleni = planDelenia === null ? view : pohladPoRozdeleni(view, ja, planDelenia.marker, zdvihyDelenia);
  const obrazokStarsieho = (defId: string): string | null => {
    const o = vzhladKarty(sada, data, defId).obrazok;
    return o === null ? null : mediaUrl(o.nahlad);
  };
  // Pečiatka ZAJAŤ / PRESVEDČIŤ (v11.6, Michal 2026-11-03): len pri mojom rozdelení a len na staršom,
  // pri ktorom sa akcia na moje body dá (aj zvolený ostáva, nech sa dá vrátiť). Cena celá —
  // pri presvedčení s dotiahnutím rečí na červenú.
  const ponukaAkcii = planDelenia === null ? [] : [...new Set([...moznostiAkcie(view, ja, planDelenia.marker, planDelenia.body), ...akcieDelenia])];
  const akciaStarsieho = (e: (typeof view.starsi)[number]): AkciaStarsieho | undefined => {
    if (planDelenia === null || krokDelenia === null || !ponukaAkcii.includes(e.elderId)) return undefined;
    const zajatie = krokDelenia === "prebytok";
    const cena = cenaAkcieUplna(e, ja, planDelenia.marker) ?? (zajatie ? KONSTANTY.CENA_ZAJATIA : KONSTANTY.CENA_PRESVEDCENIA);
    const meno = menoKarty(e.karta.defId);
    const n = nahladZajatia(view, e.elderId);
    const nahlad = zajatie
      ? t("plocha.zajatNahlad", { meno, cena, vazni: n.mojichVaznov, prah: n.vazniNaVyhru, vyhra: n.vyhra ? t("plocha.vyhrasHned") : "", super: menoHraca(super_), spaky: spakov(n.kradez) })
      : t("plocha.presvedcitNahlad", { meno, cena, teplomer: cena > KONSTANTY.CENA_PRESVEDCENIA ? t("plocha.celyTeplomer") : "" });
    return { druh: zajatie ? "zajat" : "presvedcit", cena, zapnuta: akcieDelenia.includes(e.elderId), nahlad, klik: () => prepniAkciuDelenia(e.elderId) };
  };
  const radLinie: MiestoVLinii[] = radStarsich(view.starsi, view.vazni).map((m): MiestoVLinii => {
    if (m.typ === "vazen")
    {
      // Schopnosť väzňa (v11.2): tlačidlo pod pečiatkou „V PIVNICI“ — len pri mojom väzňovi.
      const k = m.vazen.hrac === ja ? kseftyStola.find((x) => x.druh === "vazen" && x.uid === m.vazen.karta.uid) : undefined;
      return {
        typ: "vazen",
        v: {
          elderId: m.vazen.elderId,
          defId: m.vazen.karta.defId,
          scorecard: m.vazen.scorecard,
          meno: menoKarty(m.vazen.karta.defId),
          obrazok: obrazokStarsieho(m.vazen.karta.defId),
          hrac: m.vazen.hrac,
          pouzita: m.vazen.pouzita === true,
          ...(k === undefined ? {} : { schopnost: kseftNaKarte(k) }),
        },
      };
    }
    const e = m.elder;
    const rozdelenie = rozdelenieStarsieho(e);
    const zmeny = view.zmenyMarkerov.filter((x) => x.elderId === e.elderId);
    const s: StarsiVLinii = {
      elder: e,
      meno: menoKarty(e.karta.defId),
      obrazok: obrazokStarsieho(e.karta.defId),
      dovod: rozdelenie === undefined ? zamokStarsieho(e) : undefined,
      presvedcil: e.presvedcil === undefined ? null : { kto: e.presvedcil },
      vybrany: akcieDelenia.includes(e.elderId),
      akcia: akciaStarsieho(e),
      zmeny,
      rozdelenie,
      po: rozdelenie?.zdvih == null ? undefined : poDeleni.starsi.find((x) => x.elderId === e.elderId),
    };
    return { typ: "starsi", s };
  });
  // Teplomery alebo Pult (mock 3 / mock 5) — voľba sa pamätá v prehliadači.
  const [rezimLinie, setRezimLinie] = useState<RezimLinie>(() => (typeof localStorage !== "undefined" && localStorage.getItem(ULOZENY_REZIM_LINIE) === "pult" ? "pult" : "teplomery"));
  const zmenRezimLinie = (r: RezimLinie): void => {
    setRezimLinie(r);
    try {
      localStorage.setItem(ULOZENY_REZIM_LINIE, r);
    } catch {
      // Súkromné okno bez úložiska — voľba platí len do obnovenia.
    }
  };
  const pultLinie = useMemo(() => pultStarsich(view), [view]);
  // Lupa staršieho pri prejdení myšou zrušená (Michal 2026-10-30: „priveľa textu, hráča mätie“) —
  // meno a priazeň sú pod staršinom priamo v línii.
  const rezimBaru = rezimRadov({ nastenkaKlikom: vrstva === "lokality", nastenkaNaStole, liniaStarsich: bodovyRezim });
  const idLinieStarsich = useId();
  // Mimo kroku tlačidlo nie je — na stôl sa vracia Esc a dlaždicou Starší; „← Späť na stôl“
  // zaberal miesto starším (Michal 2026-10-30).
  const tlacidloLinieStarsich: ReactNode =
    krokStarsich !== null ? (
      krokMoj ? null : (
        <button type="button" className="ls-tlacidlo" onClick={() => setNahliadnutie(true)} title={t("plocha.krokNezrusi")}>
          {t("koniec.pozrietStol")}
        </button>
      )
    ) : null;
  // Súhrn po bitke na línii (návrh c): krok drží stôl, Ďalej na hrane (pokyn) ide na ďalší krok, po
  // poslednom hra pokračuje; Preskočiť súhrn zavrie hneď.
  const kontextSuhrnu: KontextSuhrnu = {
    mena: [kratkeMeno(menoHraca(0)), kratkeMeno(menoHraca(1))],
    menoStarsieho: menoKarty,
    rod: (defId) => rodStarsieho(defId, menoKarty(defId)),
    nazovPriazne: (scorecard) => {
      const fav = data.scorecards.find((x) => x.id === scorecard)?.favour;
      return fav === undefined ? "" : NAZOV_PRIAZNE[fav];
    },
  };
  const suhrnNaLinii: SuhrnNaLinii | undefined =
    suhrnBezi && suhrn !== null
      ? {
          bitka: suhrn.bitka,
          krok: suhrn.krok,
          kontext: kontextSuhrnu,
        }
      : undefined;
  const prahy = (p: PlayerId) => prahyHraca(data, stol, p);
  const zavislost = (p: PlayerId) => stavZavislosti(data, { ...stol, kolo: view.kolo, hraci: view.hraci }, p);
  const b = view.bitkaStav;
  // Hrozba na stole do riadku bitky: súperova prvá (to je to prekvapenie z posledného slova, #35).
  const najdiVLinii = (uid: number) => view.strany.flat().find((pl) => pl.card.uid === uid);
  const textHrozby = (kto: "ja" | "su"): HrozbaBitky | null => {
    const h = hrozby[kto === "ja" ? ja : super_];
    if (h === null) return null;
    const pl = najdiVLinii(h.uid);
    // Názov karty sa neskloňuje — „na svoju kartu Svokra“.
    const karta =
      pl === undefined
        ? t("plocha.kartu")
        : pl.playedBy === h.hrac
          ? kto === "ja"
            ? t("plocha.svojuKartu", { meno: menoKarty(pl.card.defId) })
            : t("plocha.jehoKartu", { meno: menoKarty(pl.card.defId) })
          : kto === "ja"
            ? t("plocha.jehoKartu", { meno: menoKarty(pl.card.defId) })
            : t("plocha.tvojuKartu", { meno: menoKarty(pl.card.defId) });
    const skore = `${h.damage.tuhe[ja]} : ${h.damage.tuhe[super_]}`;
    const tuhe = t("plocha.tuheSkore", { skore });
    const v = h.vysledok;
    const prebytok = v.prebytokDrzi === null ? "" : t("plocha.prebytokKomu", { n: v.prebytok, komu: v.prebytokDrzi === ja ? t("panel.tebe") : menoHraca(super_) });
    const kdo = kto === "ja" ? t("plocha.tyEsteMozes") : t("plocha.esteMoze", { meno: menoHraca(super_) });
    const drzi = v.prebytokDrzi === ja ? t("stol.ty") : t("stol.superKratko");
    const kratkyPrebytok = v.prebytokDrzi === null ? "" : t("plocha.kratkyPrebytok", { n: v.prebytok, kto: drzi });
    const ktoMini = kto === "ja" ? t("stol.ty") : t("stol.superKratko");
    return {
      kto,
      uid: h.uid,
      mini: t("plocha.hrozbaMini", { kto: ktoMini, skore }) + kratkyPrebytok,
      miniNaex: t("plocha.hrozbaMiniNaex", { kto: ktoMini, skore }) + kratkyPrebytok,
      kratko:
        (kto === "ja" ? t("plocha.tyEsteMozes") : t("plocha.superEsteMoze")) +
        `: ${tuhe}` +
        (v.prebytokDrzi === null ? "" : t("plocha.prebytokKomu", { n: v.prebytok, komu: drzi })),
      cele: t("plocha.hrozbaCele", { kdo, karta, tuhe, prebytok }),
    };
  };
  // Hrozba kliatob (návrh #38 B): NA EX z kariet na stole, ktoré pridá Cirhózu či Dlh, aj keď víťaza nezmení.
  const textKliatobHrozby = (kto: "ja" | "su"): HrozbaBitky | null => {
    const k = hrozbyKliatob[kto === "ja" ? ja : super_];
    if (k === null) return null;
    const pl = najdiVLinii(k.uid);
    const karta = pl === undefined ? t("plocha.kartu") : menoKarty(pl.card.defId);
    const komu = k.obet === ja ? t("panel.tebe") : menoHraca(super_);
    const kliatby = textHrozbyKliatob(k);
    return {
      kto,
      zdroj: "kliatby",
      uid: k.uid,
      mini: t("plocha.kliatbyMini", { kto: kto === "ja" ? t("stol.ty") : t("stol.superKratko"), komu, kliatby }),
      kratko: kto === "ja" ? t("plocha.kliatbyTvoje", { karta, komu, kliatby }) : t("plocha.kliatbySuperovo", { karta, komu, kliatby }),
      cele: kto === "ja" ? t("plocha.kliatbyAkDas", { karta, komu, kliatby }) : t("plocha.kliatbyAkDa", { meno: menoHraca(super_), karta, komu, kliatby }),
    };
  };
  // Hádka príde v bitke isto, NA EX len možno — ide prvá; pri viacerých položkách bez prebytku
  // (je v titulku a nápovede), inak by sa do riadku pri 1366 px nezmestila ani druhá.
  const polozkyHrozby = [textHrozby("su"), textKliatobHrozby("su"), textHrozby("ja"), textKliatobHrozby("ja")].filter((h): h is HrozbaBitky => h !== null);
  const hrozbyBitky =
    polozkyHrozby.length < 2
      ? polozkyHrozby
      : polozkyHrozby.map((h) => ({ ...h, mini: h.zdroj === "hadka" || h.zdroj === "kliatby" ? h.mini : (h.miniNaex ?? h.mini) }));
  // Odhad bitky len keď ho hráči ovplyvnia — v Zhromaždení, Pitke a bitke;
  // pri voľbe cieľa a v drafte mätie (Michal 2026-10-20).
  // Priazne, ktoré pôsobia priamo v bitke (tuhé, Viera, Povery, Absťáky, Robota), po hádke — nápoveda odhadu.
  const priazneOdhadu = (): PriazenVOdhade[] => {
    const su = kratkeMeno(menoHraca(super_));
    return view.starsi.flatMap((e) => {
      const fav = favourStarsieho(data, e);
      if (fav !== "BITKAR" && fav !== "VERIACI" && fav !== "OHOVARACKA" && fav !== "LAKOMEC" && fav !== "ROBOTA") return [];
      const pk = priazenKola(e, ja);
      if (pk.komu === null) return [];
      const meno = menoKarty(e.karta.defId);
      return [{ fav, p: pk, text: pk.komu === "ja" ? `${meno} ${UCINOK_KRATKO[fav](pk.sila)}` : `${meno}: ${su} ${UCINOK_KRATKO[fav](pk.sila)}`, hadka: null }];
    });
  };
  const bitkaProps: BitkaPanelProps | null =
    odhad === null || view.faza === "volbaCiela" || view.faza === "natocenieCiela" || view.faza === "draft" || view.koniec !== null
      ? null
      : {
          rodJa: rodHracaP(ja),
          damage: b?.damage ?? odhad,
          sums: lineEval.sums,
          zdroje: lineEval.zdroje,
          rozpis,
          menoKarty,
          ja,
          vysledok: b?.damage != null,
          mena: [menoHraca(0), menoHraca(1)],
          sada,
          ciel: lokalita !== null ? t("plocha.oLokalitu", { meno: menoKarty(lokalita.defId) }) : "",
          naSekeru: view.spakyNaSekere > 0 ? [t("os.nSpakov", { n: view.spakyNaSekere })] : [],
          poslednaBitka: view.ciel?.typ === "finale",
          prebytokNaRozdelenie: prebytokNaRozdelenie(view, battleOutcome(b?.damage ?? odhad)),
          skrytaSupera: b?.damage == null && view.zaverecne.some((z) => z.majitel !== ja),
          utocnik: t("plocha.utocnikRiadok", { kto: view.utocnik === ja ? t("stol.ty") : menoHraca(view.utocnik), preco: view.kolo === 1 ? t("plocha.nahodne") : t("plocha.porazenyMinulej") }),
          hrozby: b?.damage != null ? [] : hrozbyBitky,
          poBitke: b?.damage != null ? null : efektyPoBitke(zaklad),
          ukazHrozbu: setUkazHrozbu,
          priazne: priazneOdhadu(),
          // Počas bitky je výplata už v popolníkoch; telefón má vlastný odznak bez špakov.
          spaky:
            b?.damage != null || mobil || naSirku || (view.faza !== "zhromazdenie" && view.faza !== "pitka")
              ? null
              : odhadSpakovKola(data, { ...stol, spakyNaSekere: view.spakyNaSekere, lokalitaOtocena: lokalitaNavrh?.otocena ?? view.lokalitaOtocena } as StavOdhadu, lineEval, odhad),
        };
  // Strany jednotného baru sú vždy aktivované akcie (Michal 2026-11-06); počty kariet sú v dlaždici Karty.
  // Na mobile sú akcie v celom paneli bitky pod barom — strany baru nesú len karty.
  const rezimStran: RezimStran = mobil ? "karty" : "akcie";
  const bitkaPanel = bitkaProps === null || !mobil ? null : <BitkaPanel {...bitkaProps} />;

  // ---- väzni (v9) a priazeň (Michal 2026-10-16) -----------------------------
  // Vydesenie ako výhra zaniklo (v9) — os baru ukazuje väzňov, tretí vyhráva.
  const prahVyd = vazniNaVyhru(view.lokalitCelkom);
  const vydeseni = [0, 1].map((p) => view.vazni.filter((v) => v.hrac === p).length) as [number, number];
  // Bublina „Máš 2 väzňov!“ na stole zanikla (Michal 2026-11-02: „robí to bordel na stole“) — počet
  // z troch ukazuje Pivnica (2/3) a jej okno povie, ako vyhrať; súperovu hrozbu tiež.

  // Keď hráčovi pribudne priazeň (posun k nemu), povie mu to hra hneď aj s účinkom —
  // v playteste 20261016-134912 to porazená nepochopila. Michal 2026-10-23: plávajúci
  // toast na hornej hrane stola (nemení rozloženie), jeden naraz, 4 s; záznam píše
  // do logu server (zaznamyPriazne v jadre), takže ostane aj po obnovení stránky.
  type ToastPriazne = { readonly id: number; readonly komu: PlayerId; readonly fav: Favour; readonly sila: number; readonly zaklad: string; readonly pocet: number; readonly cele: string };
  const [toastPriazne, setToastPriazne] = useState<ToastPriazne | null>(null);
  const predoslaPriazen = useRef<ReadonlyMap<string, { readonly komu: PlayerId | null; readonly sila: number }> | null>(null);
  const idOznamu = useRef(0);
  // Počas Počítadla bitky by ho prekrylo — počká a jeho 4 s začnú až po ňom.
  const toastCaka = useRef<ToastPriazne | null>(null);
  // Ten istý text tesne po sebe (pohľad sa prekreslí s rovnakou zmenou) toast neobnoví.
  const poslednyToast = useRef<{ readonly text: string; readonly kedy: number } | null>(null);
  // Druhá priazeň tesne po prvej (ďalší krok tej istej bitky) by prvú prepísala skôr,
  // než sa dá prečítať — zlúči sa do jedného toastu s „(+n)“.
  const zobrazenyToast = useRef<{ readonly t: ToastPriazne; readonly od: number } | null>(null);
  const zluc = (stary: ToastPriazne | null, novy: ToastPriazne): ToastPriazne =>
    stary === null ? novy : { ...novy, pocet: stary.pocet + novy.pocet, cele: `${stary.cele}\n${novy.cele}` };
  const ukazToast = (t: ToastPriazne | null): void => {
    zobrazenyToast.current = t === null ? null : { t, od: performance.now() };
    setToastPriazne(t);
  };
  useEffect(() => {
    const teraz = new Map(view.starsi.map((e) => [e.elderId, { komu: priazenHraca(e), sila: priazenSila(e) }]));
    const pred = predoslaPriazen.current;
    predoslaPriazen.current = teraz;
    if (pred === null) return;
    const nove: { komu: PlayerId; fav: Favour; sila: number; kratko: string; cele: string }[] = [];
    for (const e of view.starsi) {
      const tp = teraz.get(e.elderId);
      const p = pred.get(e.elderId);
      if (tp === undefined || tp.komu === null) continue;
      if (p !== undefined && p.komu === tp.komu && p.sila >= tp.sila) continue;
      const sc = scorecardStarsieho(data, e);
      const meno = menoKarty(e.karta.defId);
      nove.push({
        komu: tp.komu,
        fav: sc.favour,
        sila: tp.sila,
        // Komu a akú silnú povie krúžok (Michal 2026-10-31) — text len meno a účinok.
        kratko: `${meno} · ${tp.komu === ja ? t("stol.ty") : kratkeMeno(menoHraca(tp.komu))}: ${UCINOK_KRATKO[sc.favour](tp.sila)}`,
        cele: tp.komu === ja ? t("plocha.dostavasPriazen", { meno, nazov: tZoServera(`priazen.nazov.${sc.favour}`, sc.nazov), sila: tp.sila, ucinok: UCINOK_PRIAZNE[sc.favour](tp.sila) }) : t("plocha.dostavaPriazen", { kto: menoHraca(tp.komu), meno, nazov: tZoServera(`priazen.nazov.${sc.favour}`, sc.nazov), sila: tp.sila, ucinok: UCINOK_PRIAZNE[sc.favour](tp.sila) }),
      });
    }
    const posledny = nove[nove.length - 1];
    if (posledny === undefined) return;
    // Len jeden naraz — ďalší nahradí predošlý; viac naraz zhrnie „(+n)“, všetky sú v Logu.
    const kratko = posledny.kratko + (nove.length > 1 ? ` (+${nove.length - 1})` : "");
    const teraz2 = performance.now();
    if (poslednyToast.current !== null && poslednyToast.current.text === kratko && teraz2 - poslednyToast.current.kedy < 8000) return;
    poslednyToast.current = { text: kratko, kedy: teraz2 };
    const novy = { id: ++idOznamu.current, komu: posledny.komu, fav: posledny.fav, sila: posledny.sila, zaklad: posledny.kratko, pocet: nove.length, cele: nove.map((n) => n.cele).join("\n") };
    const z = zobrazenyToast.current;
    if (pocitadloAktivne.current) toastCaka.current = zluc(toastCaka.current, novy);
    else ukazToast(z !== null && teraz2 - z.od < 1500 ? zluc(z.t, novy) : novy);
    // menoHraca a ja sú len na text; stačí sledovať starších.
  }, [view.starsi, data]);
  useEffect(() => {
    if (pocitadloBezi || toastCaka.current === null) return;
    ukazToast(toastCaka.current);
    toastCaka.current = null;
  }, [pocitadloBezi]);
  useEffect(() => {
    if (toastPriazne === null) return;
    const t = setTimeout(() => setToastPriazne((x) => (x?.id === toastPriazne.id ? null : x)), 4000);
    return () => clearTimeout(t);
  }, [toastPriazne]);
  // Poloha toastu: vedľa pilulky pokynu na hornej hrane stola, ak je tam miesto,
  // inak tesne pod ňou v pravom rohu stola — nikdy nie cez bary, ruku, pokyn či karty.
  const [polohaToastu, setPolohaToastu] = useState<CSSProperties | null>(null);
  const toastJe = toastPriazne !== null;
  useLayoutEffect(() => {
    if (!toastJe) return;
    const zmeraj = (): void => {
      const obal = liniaObalRef.current?.getBoundingClientRect();
      const pilulka = liniaObalRef.current?.querySelector(".linia-stav")?.getBoundingClientRect();
      if (obal === undefined || pilulka === undefined) return setPolohaToastu(null);
      const vedla = obal.right - pilulka.right - 28;
      setPolohaToastu(
        vedla >= 200
          ? { top: pilulka.top - obal.top + pilulka.height / 2, right: 12, maxWidth: vedla, translate: "0 -50%" }
          : { top: pilulka.bottom - obal.top + 6, right: 12, maxWidth: Math.min(380, obal.width / 3) },
      );
    };
    zmeraj();
    window.addEventListener("resize", zmeraj);
    return () => window.removeEventListener("resize", zmeraj);
  }, [toastJe, toastPriazne?.id]);
  const toastPriazneEl =
    toastPriazne === null ? null : (
      <button
        key={toastPriazne.id}
        type="button"
        className={`toast-priazne ${toastPriazne.komu === ja ? "moja" : "superova"}`}
        style={polohaToastu ?? undefined}
        role="status"
        aria-live="polite"
        title={`${toastPriazne.cele}\n${t("plocha.klikZavrieLog")}`}
        onClick={() => ukazToast(null)}
        onContextMenu={pravyKlik(() => ukazToast(null))}
      >
        <PilulkaPriazne fav={toastPriazne.fav} p={{ komu: toastPriazne.komu === ja ? "ja" : "su", sila: toastPriazne.sila }} /> {toastPriazne.zaklad}
        {toastPriazne.pocet > 1 && ` (+${toastPriazne.pocet - 1})`}
      </button>
    );

  // ---- tieň karty, ktorú vzal súper zo šenku (#111, Michal 2026-10-26) -----
  // Na mieste karty ostane do konca draftu stlmená karta so súperovým menom — hráč vidí,
  // čo mu súper zobral. Vlastné vzaté karty tieň nenechajú, tie má hráč v ruke.
  const zobrateZoSenku = view.faza === "draft" ? (draft?.zobrate ?? []) : [];
  const tieneSenku = zobrateZoSenku.filter((z) => z.hrac === super_);
  const tienSenku = (z: ZobrataVerejne, sirka: number): ReactNode => {
    const uid = UID_TIENA - z.miesto;
    const kto = `${tRod("plocha.vzal", rodHracaP(super_))} ${menoHraca(super_)}`;
    return sLupou(
      { karta: { uid, ...z.karta }, sirka },
      {
        kluc: uid,
        trieda: "senok-tien",
        titul: t("plocha.zPonukyVzal", { karta: menoKarty(z.karta.defId), vzal: tRod("plocha.vzalTitul", rodHracaP(super_)), meno: menoHraca(super_) }),
        stitok: <span className="senok-tien-stitok">{kto}</span>,
        tien: z.miesto,
      },
    );
  };
  /** Karty šenku v rade aj s tieňmi — každá na mieste, kde ležala pred braním. */
  const radSenkuSTienmi = (karty: readonly CardInstance[], kresli: (k: CardInstance) => ReactNode, sirka: number): ReactNode[] =>
    radSenku(view.senok, karty, zobrateZoSenku, super_).map((x) => (x.typ === "karta" ? kresli(x.karta) : tienSenku(x.zobrata, sirka)));
  // Prelet karty, ktorú súper práve vzal: z miesta jej tieňa k jeho doske (aj bot, aj Melichar vo výučbe).
  const [prelety, setPrelety] = useState<readonly (Prelet & { readonly karta: ZobrataVerejne["karta"] })[]>([]);
  const zobratePred = useRef<{ readonly kolo: number; readonly pocet: number } | null>(null);
  useLayoutEffect(() => {
    const pred = zobratePred.current;
    zobratePred.current = { kolo: view.kolo, pocet: zobrateZoSenku.length };
    // Po načítaní partie (aj po odpojení) sa nič neprehráva — len branie, ktoré hráč práve videl.
    if (pred === null || pred.kolo !== view.kolo || zobrateZoSenku.length <= pred.pocet) return;
    const nove = zobrateZoSenku.slice(pred.pocet).filter((z) => z.hrac === super_);
    if (nove.length === 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const obdlznik = (el: Element | null): Obdlznik | null => {
      const r = el?.getBoundingClientRect();
      return r === undefined || r.width === 0 ? null : { left: r.left, top: r.top, width: r.width, height: r.height };
    };
    const na = obdlznik(document.querySelector(".doska.superova .zdroj-karty")) ?? obdlznik(document.querySelector(".doska.superova"));
    // Keď súperovo branie draft ukončilo, šenok na stole už nie je — karta vyletí spod tlačidla Šenok.
    const tlacidlo = obdlznik(document.querySelector('[data-vyucba="hlavicka:senok"]'));
    const nahradny = tlacidlo === null ? null : { left: tlacidlo.left, top: tlacidlo.top + tlacidlo.height, width: 96, height: Math.round(96 * POMER_KARTY) };
    if (na === null) return;
    const pridaj = nove.flatMap((z) => {
      const odkial = obdlznik(document.querySelector(`.senok-tien[data-tien="${z.miesto}"] .kl`)) ?? nahradny;
      return odkial === null ? [] : [{ kluc: `${view.kolo}-${z.miesto}`, z: odkial, na, karta: z.karta }];
    });
    if (pridaj.length > 0) setPrelety((x) => [...x, ...pridaj]);
  });

  // ---- draft na stole (Michal 2026-10-16) ----------------------------------
  // Na stole (#67) sa lokalita (≈ 1,5 karty) a balíček zmestia do jedného radu;
  // na výšku karty vyplnia vrstvu stola bez réžie panelu (malý notebook, Michal 2026-10-23).
  const radZatial = stavim && view.senok.length > 0 ? 0.7 : 0;
  // Branie má vedľa šenku aj lokalitu, o ktorú sa bije (Michal 2026-10-30) — o 1,5 karty viac.
  const lokalitaPriBrani = view.faza === "draft" && !stavim && view.ciel?.lokalita != null ? 1.5 : 0;
  const miestDraftuPre = (rady: number): number =>
    stavim ? Math.max(rady === 2 ? 4 : 6, Math.ceil((draft?.mojBalicek.length ?? 8) / rady) + 2) : Math.max(6, view.faza === "draft" ? view.senok.length + tieneSenku.length + lokalitaPriBrani : view.lokalityVHre.length);
  const sirkaDraftuPre = (radyStavby: number): number => {
    const miestDraftu = miestDraftuPre(radyStavby);
    return Math.max(
        // Telefón na šírku s lištou prehliadača (300 – 340 px): karty sa radšej zmenšia, než by ich zrezal okraj.
        naSirku ? SIRKA_NA_SIRKU_MIN : 56,
        Math.min(
          170,
          // Na šírku: stavba má balíček + lokalitu, branie kariet šenku, voľba cieľa lokalít;
          // 60 px okraje panelu a zón, 10 px medzera za každou kartou.
          sirkaLinie > 0 ? (naSirku ? Math.floor((sirkaLinie - 24) / miestDraftu) - 7 : Math.floor((sirkaLinie - 60) / miestDraftu) - 10) : 118,
          // Pri stole so scrollom má vrstva výšku podľa obsahu — karty sa podľa nej nezmenšujú.
          stolScroll ? Number.POSITIVE_INFINITY : vyskaVrstvy > 0 ? Math.floor((vyskaVrstvy - reziaDraftu - (radyStavby - 1) * 10) / (POMER_KARTY * (radyStavby + radZatial))) : 118,
        ),
      );
  };
  // Telefón na šírku: balíček stavby v jednom či dvoch radoch — podľa toho, kde budú karty väčšie
  // (nízka plsť s rukou dole chce jeden rad, vyššia dva). Rad sa zalomí sám podľa šírky kariet.
  const sirkaDraftu = mobil ? 84 : naSirku && stavim ? Math.max(sirkaDraftuPre(1), sirkaDraftuPre(2)) : sirkaDraftuPre(1);
  // Voľba cieľa na stole (Michal 2026-10-19): lokality sú v paneli namiesto
  // stavby šenku.
  const cielPanel = ((): ReactNode => {
    if (view.faza !== "volbaCiela" || view.koniec !== null) return null;
    const naStole = lokalitaNavrh?.karta ?? null;
    return (
      <section ref={cielPanelRef} className={`draft-panel volba-ciela ${somNaTahu ? "moj-tah" : "cakanie"}`} aria-label="O čo sa bijeme">
        <header className="draft-hlava">
          <strong>{t("faza.volbaCiela")}</strong>
          <span>
            {!somNaTahu
              ? t("plocha.superVybera", { meno: menoHraca(super_) })
              : naStole !== null
                ? natociSuper
                  ? t("plocha.naStolePotvrd", { karta: menoKarty(naStole.defId), meno: menoHraca(super_) })
                  : t("plocha.naStoleOtoc", { karta: menoKarty(naStole.defId) })
                : t("plocha.klikniLokalitu")}
          </span>
        </header>
        <div className="harmonika draft-karty volba-ciela-karty" data-vyucba="lokality">
          {view.lokalityVHre.length === 0 && <span className="popis">{t("plocha.ziadneLokality")}</span>}
          {view.lokalityVHre
            .filter((k) => k.uid !== lokalitaNavrh?.karta.uid)
            .map((k) => {
              const z: Zdroj = { karta: k, odkial: "lokality", navrh: false };
              const props = {
                karta: k,
                sirka: sirkaDraftu,
                onClick: volimLokalitu
                  ? () => setNavrh({ typ: "lokalita", uid: k.uid, otocena: lokalitaNavrh?.otocena ?? ja === 1 })
                  : undefined,
              };
              return volimLokalitu ? sLupou(props, { obsah: tahatelna(z, karta(props)), zdroj: z }) : sLupou(props);
            })}
        </div>
        {view.spakyNaSekere > 0 && (
          <p className="sekera-pozn">
            {tr("plocha.naSekereText", { spaky: spakov(view.spakyNaSekere) })}
          </p>
        )}
        {view.pata === undefined && view.nastenka.length > 0 && nastenkaEl(false)}
      </section>
    );
  })();
  const draftPanel = ((): ReactNode => {
    if (draft === null || view.faza !== "draft" || view.koniec !== null) return null;
    if (stavim) {
      // Na ťahu výber klikom; po potvrdení (čakanie na súpera) to, čo hráč poslal.
      const doSenku = somNaTahu ? doSenkuStavby : [...(draft.mojVyber?.doSenku ?? [])];
      const plny = doSenku.length >= krokSt.doSenku;
      const textStavby = !stavbaHotova
        ? t("plocha.doPonukyZ", { a: doSenku.length, b: krokSt.doSenku })
        : t("plocha.hotovoNaspodok", { zvysne: zvysnePojdu(krokSt.odhod) });
      const lokalita = view.ciel?.lokalita ?? null;
      // Lokalita, o ktorú sa bije, namiesto Smetiska (#147): väčšia než karty balíčka — hráč
      // vidí hrany, efekt a kraje, k čomu karty vyberá. Vysoká ako balíček s miestom na zdvihnutú
      // kartu a nadpisom (≈ 54 px), aby kartám balíčka nebrala výšku.
      // Na šírku telefónu je lokalita rovnako veľká ako karty balíčka — vyššia by brala výšku všetkým kartám.
      const sirkaLokality = naSirku ? sirkaDraftu : Math.round(sirkaDraftu + 54 / POMER_KARTY);
      return (
        <section ref={draftPanelRef} className={`draft-panel stavba ${somNaTahu ? "moj-tah" : "cakanie"}`} aria-label={t("plocha.stavba")} data-vyucba="stavba">
          {/* Na stole nadpis aj čo robiť hovorí pilulka a „potvrdiť“ je pečiatka na hrane stola — hlavička
              a pätička brali výšku kartám (malý notebook, Michal 2026-10-23 a 2026-10-25). */}
          {somNaTahu && !mobil ? null : (
            <header className="draft-hlava">
              <strong>{t("plocha.stavba")}</strong>
              <span>
                {somNaTahu
                  ? t("plocha.tvojBalicek", { balicek: kariet(draft.mojBalicek.length), vyber: kariet(krokSt.doSenku), zvysne: zvysnePojdu(krokSt.odhod) })
                  : zaHracaHra && draft.mojVyber === null
                    ? t("plocha.staviaMelicharBodka")
                    : t("plocha.cakasKymVyberie", { vybral: tRod("plocha.vybralSiBez", rodHracaP(ja)), meno: menoHraca(super_) })}
              </span>
            </header>
          )}
          <div className="stavba-rad">
            {lokalita !== null && (
              <div className="stavba-lokalita" data-vyucba="stavba-lokalita">
                <span className="stavba-lokalita-nazov">
                  {view.ciel?.typ === "finale" ? t("stol.finale") : t("plocha.bijeSaO")}
                </span>
                {sLupou({ karta: lokalita, sirka: sirkaLokality, otocena: view.lokalitaOtocena }, { trieda: "stavba-lokalita-karta" })}
              </div>
            )}
            <div className={`stavba-balicek harmonika${plny ? " plny" : ""}`} role="group" aria-label={t("plocha.vyberDoPonuky", { a: doSenku.length, b: krokSt.doSenku })}>
              <span className="stavba-balicek-nazov">
                {t("plocha.doPonukyMale")} <small>{doSenku.length}/{krokSt.doSenku}</small>
                <span className="stavba-balicek-pozn" title={t("plocha.naspodokTitul")}>
                  {t("plocha.ostatneNaspodok", { naradie: view.naradiePocet, obcania: view.obcaniaPocet })}
                </span>
              </span>
              {draft.mojBalicek.map((k) => {
                const vybrata = doSenku.includes(k.uid);
                // Plný výber: nevybraté karty sú zosivené — do Šenku už nepôjdu (#148).
                const sediva = plny && !vybrata;
                const trieda = `stavba-vyber${vybrata ? " vybrata" : ""}${sediva ? " zosivena" : ""}`;
                if (!somNaTahu) return sLupou({ karta: k, sirka: sirkaDraftu }, { trieda });
                const props = { karta: k, sirka: sirkaDraftu, onClick: () => prepniStavbu(k.uid), stlacena: vybrata, zakazana: sediva };
                const titul = vybrata ? t("plocha.doPonukyKlikVrati") : sediva ? t("plocha.doPonukyPlno") : t("plocha.klikDoPonuky");
                return sLupou(props, { trieda, titul });
              })}
            </div>
          </div>
          {somNaTahu && mobil && !naneisto && (
            <footer className="draft-paticka">
              <span>{textStavby}</span>
              <button className="tlacidlo-hlavne" data-skratka="k" disabled={!stavbaHotova} onClick={potvrdStavbu}>
                {t("plocha.potvrdit")}
              </button>
            </footer>
          )}
          {view.senok.length > 0 && (
            <div className="stavba-senok-zatial">
              <span className="oblast-nazov">{t("plocha.vPonukeZatial", { n: view.senok.length })}</span>
              <div className="harmonika draft-karty">{view.senok.map((k) => sLupou({ karta: k, sirka: Math.round(sirkaDraftu * 0.7) }))}</div>
            </div>
          )}
        </section>
      );
    }
    if (!beriem) return null;
    const mam = draft.noveKarty[ja];
    const cig = view.hraci[ja].cigarety;
    const cena = KONSTANTY.CENA_SENKU[zoSenku.length] ?? 0;
    const lokalitaBrania = view.ciel?.lokalita ?? null;
    return (
      <section ref={draftPanelRef} className={`draft-panel branie ${mozemBrat ? "moj-tah" : "cakanie"}`} aria-label="Branie z ponuky">
        {/* Na stole hovorí pilulka, kto berie a za koľko, a skóre aj potvrdenie ležia na hrane stola —
            hlavička by brala výšku kartám (malý notebook, Michal 2026-10-25). */}
        {mobil && (
          <header className="draft-hlava">
            <strong className="branie-kto">
              {mozemBrat
                ? t("plocha.tvojTahPotiahni", { co: kolkoMozemBrat === 2 ? t("plocha.jednuAleboDve") : t("plocha.kartu") })
                : somNaTahu
                  ? t("plocha.nemasNaKartu")
                  : t("plocha.berie", { meno: menoHraca(super_) })}
            </strong>
            <span className="branie-cena">
              {t("plocha.cenaBrania", { jedna: cigariet(KONSTANTY.CENA_SENKU[1] ?? 1), dve: cigariet(KONSTANTY.CENA_SENKU[2] ?? 3) })} <small>({t("plocha.mas", { n: cig })})</small>
              {dovodJednejKarty !== null && <small className="branie-prvy"> · {dovodJednejKarty}</small>}
            </span>
            <span className="branie-skore">
              <span className="moje">{t("stol.ty")} {mam}</span>
              <span className="superove">
                {menoHraca(super_)} {draft.noveKarty[super_]}
                {draft.hotovo[super_] ? t("plocha.uzNeberie") : ""}
              </span>
            </span>
          </header>
        )}
        {/* Lokalita, o ktorú sa bije, aj pri braní — nielen pri stavbe šenku (Michal 2026-10-30). */}
        <div className={`branie-rad${lokalitaBrania !== null && !mobil ? " stavba-rad" : ""}`}>
          {lokalitaBrania !== null && !mobil && (
            <div className="stavba-lokalita">
              <span className="stavba-lokalita-nazov">{view.ciel?.typ === "finale" ? t("stol.finale") : t("plocha.bijeSaO")}</span>
              {sLupou({ karta: lokalitaBrania, sirka: naSirku ? sirkaDraftu : Math.round(sirkaDraftu + 54 / POMER_KARTY), otocena: view.lokalitaOtocena }, { trieda: "stavba-lokalita-karta" })}
            </div>
          )}
          <div className="harmonika draft-karty branie-karty" data-vyucba="senok">
            {view.senok.length === 0 && tieneSenku.length === 0 && <span className="popis">{t("plocha.ponukaPrazdna")}</span>}
            {radSenkuSTienmi(
              view.senok.filter((k) => !zoSenku.some((x) => x.uid === k.uid)),
              (k) => {
                const z: Zdroj = { karta: k, odkial: "senok", navrh: false };
                // Klik vezme kartu do ruky ako návrh (bez ťahania, UX N4) — „hotovo“ ju potvrdí.
                const props = { karta: k, sirka: sirkaDraftu, ...(mozemBrat ? { onClick: () => prepniZoSenku(k.uid) } : {}) };
                return mozemBrat ? sLupou(props, { obsah: tahatelna(z, karta(props)), zdroj: z }) : sLupou(props);
              },
              sirkaDraftu,
            )}
          </div>
        </div>
        {/* Na mobile pätička pod kartami; na stole je potvrdenie pečiatkou na hrane (pokyn.stred). */}
        {mobil && (
          <footer className="draft-paticka" title={pravidloBrania}>
            <span className="tlmene">
              {zoSenku.length === 0
                ? pravidloBrania
                : t("plocha.beriesTip", { karty: zoSenku.map((k) => menoKarty(k.defId)).join(t("plocha.a")), cig: cigariet(cena) })}
            </span>
            {zoSenku.length > 0 ? (
              <>
                <button onClick={() => setNavrh(null)}>{t("plocha.vratit")}</button>
                <button className="tlacidlo-hlavne" data-skratka="k" onClick={potvrdBranie}>
                  {t("plocha.hotovo")} <span className="cena">−{t("tabula.cig", { n: cena })}</span>
                </button>
              </>
            ) : (
              <button
                className="tlacidlo-cigarety"
                data-skratka="p"
                data-vyucba="tlacidlo:pas"
                disabled={!somNaTahu}
                title={somNaTahu ? t("plocha.prestanesBratKratko", { n: limitTeraz }) : t("plocha.pockaj")}
                onClick={() => posli({ type: "draftStop" })}
              >
                {t("plocha.uzNetaham")}
              </button>
            )}
          </footer>
        )}
      </section>
    );
  })();

  // Stôl bez scrollovania (#67): na počítači leží voľba cieľa a draft na stole namiesto
  // prázdnej línie. Lokalita na otočenie a potvrdenie je v línii — vtedy sa vráti línia.
  useEffect(() => {
    if (vybranaDoOblasti === null) return;
    const klaves = (e: KeyboardEvent): void => {
      if (e.key === "Escape") setVybranaDoOblasti(null);
    };
    window.addEventListener("keydown", klaves);
    return () => window.removeEventListener("keydown", klaves);
  }, [vybranaDoOblasti]);
  // Zasunutý Nástroj (mock 2): medzerník ho otočí; Esc ho vráti do ruky cez ✕ pečiatky (data-skratka="esc").
  const otocRef = useRef(otocPodlozenie);
  otocRef.current = otocPodlozenie;
  const zasuvam = podlozenieNavrh !== null;
  useEffect(() => {
    if (!zasuvam) return;
    const klaves = (e: KeyboardEvent): void => {
      if (e.key !== " " || e.defaultPrevented || (e.target instanceof HTMLElement && e.target.closest("input, textarea, button") !== null)) return;
      e.preventDefault();
      otocRef.current();
    };
    window.addEventListener("keydown", klaves);
    return () => window.removeEventListener("keydown", klaves);
  }, [zasuvam]);
  // Esc vráti návrh ťahu do ruky až ako posledná vrstva (Leader 2026-10-24). Obsluhy
  // ostatných vrstiev bežia na ten istý kláves; stav z tohto kreslenia ešte ukazuje,
  // čo bolo otvorené pred stlačením, a DOM sa do konca udalosti nezmení.
  useEffect(() => {
    if (navrh === null) return;
    const klaves = (e: KeyboardEvent): void => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      const otvorene = (sel: string): boolean => [...document.querySelectorAll(sel)].some((el) => el.getClientRects().length > 0);
      const vrstvy: VrstvyPreEsc = {
        // Lupa karty, ktorá klikom odišla zo šenku do ruky, ostane v stave bez kresby (nemá
        // z čoho odísť myšou) — Esc by inak návrh nikdy nevrátil.
        lupa: (lupa !== null && lupaKarty.has(lupa.kluc)) || otvorene(".lupa:not(.doznieva)"),
        dialog: vrstva !== null || skratky.napoveda || otvorene('[role="dialog"]'),
        starsi: starsiViditelni || nahliadnutie,
        vyber: miestoVolby !== null || mode.typ === "naexCiel" || vybranaDoOblasti !== null,
        potvrdenie: potvrdenie !== null,
        pult: otvorene(".sb-bar"),
      };
      const navrat = tlacidloNavratu();
      if (!escVratiNavrh(vrstvy, navrat !== null)) return;
      e.preventDefault();
      navrat?.click();
    };
    window.addEventListener("keydown", klaves);
    return () => window.removeEventListener("keydown", klaves);
  });
  /** Klik na kartu v ruke: karta → cieľ na dlaždici. */
  const vyberDoOblasti = (k: CardInstance): void => {
    setMiestoVolby(null);
    setVybranaDoOblasti(vybranaDoOblasti === k.uid ? null : k.uid);
  };
  const vylozDoOblasti = (k: CardInstance, ciel: "priznanie" | "dedicstvo"): void => {
    if (!kamIde(k)[ciel]) return;
    const bez = vylozenia.filter((x) => x.karta.uid !== k.uid).map((x) => ({ uid: x.karta.uid, ciel: x.ciel }));
    setNavrh({ typ: "vylozenia", polozky: [...bez, { uid: k.uid, ciel }] });
    setVybranaDoOblasti(null);
  };
  // Vrstva Karty so záložkami; klik na súperovu dlaždicu ukáže jeho Priznané a Dedičstvo.
  const [kartyHrac, setKartyHrac] = useState<PlayerId>(ja);
  const [kartyZalozka, setKartyZalozka] = useState<ZalozkaKariet>("balicek");
  const otvorKarty = (p: PlayerId, zalozka?: ZalozkaKariet): void => {
    const z = zalozka ?? (p === ja ? "balicek" : "priznane");
    if (vrstva === "karty" && kartyHrac === p && (zalozka === undefined || kartyZalozka === z)) {
      setVrstva(null);
      return;
    }
    setKartyHrac(p);
    setKartyZalozka(z);
    setVrstva("karty");
  };
  // Veľké číslo dlaždice Karty (Michal 2026-11-06): v Zhromaždení, čo ešte vyloží; inde limit toho nasledujúceho.
  const vylozenePocet = (p: PlayerId): KartyDlazdica["vylozi"] => {
    const zs = view.zhromazdenieStav;
    const vyloz = p === ja ? t("plocha.vylozis") : t("plocha.vylozi");
    if (view.faza === "zhromazdenie" && zs !== null) return { cislo: zs.zostavaLimit[p], popis: vyloz, tip: t("plocha.esteVylozi", { vyloz, karty: kariet(zs.zostavaLimit[p]) }) };
    if (view.faza === "volbaCiela" || view.faza === "natocenieCiela" || view.faza === "draft") {
      const n = limitZhromazdenia(view, p);
      return { cislo: n, popis: vyloz, tip: t("plocha.vZhromazdeniVylozi", { vyloz, karty: kariet(n) }) };
    }
    const dalsiaPitka = view.faza === "pitka" && view.pitkaCislo < view.pitkyCelkom;
    const n = dalsiaPitka ? limitZhromazdenia(view, p) : limitBuduceKolo(view, p, false, data);
    return { cislo: n, popis: t("plocha.dalej"), tip: `${dalsiaPitka ? t("plocha.dalsieZhromazdenie") : t("plocha.dalsieKolo")}: ${kariet(n)}` };
  };
  const kartyDlazdica = (p: PlayerId): KartyDlazdica => ({
    otvorena: vrstva === "karty" && kartyHrac === p,
    otvor: () => otvorKarty(p),
    navrhy: p === ja ? vylozenia.filter((x) => x.ciel === "priznanie" || x.ciel === "dedicstvo").length : 0,
    vylozi: vylozenePocet(p),
    ciel:
      p !== ja || cielDlazdice === null
        ? null
        : {
            nazov: cielDlazdice === "priznanie" ? t("plocha.priznat") : t("galeria.dedicstvo"),
            pozn:
              cielDlazdice === "priznanie"
                ? kartaOblasti?.defId === "cirhoza"
                  ? t("plocha.zaCirhozu")
                  : t("plocha.doberesKartu")
                : `−${cigariet(view.cenaDedicstva)} · ${t("plocha.mas", { n: hJa.cigarety })}`,
            zamknute: chybaDlazdice,
            aktivny: jeCiel(cielDlazdice) || ((vybranaKarta ?? kartaVyucby) !== null && smieNaDlazdicu),
            nad: nadCielom(cielDlazdice),
            dataCiel: jeCiel(cielDlazdice) ? cielDlazdice : undefined,
            // Klik s vybraným Nástrojom robí to isté ako „odkazujem“ — jedna cesta, nie dve. Vo výučbe
            // dlaždica vezme kartu, ktorú krok čaká, aj bez výberu v ruke.
            onKlik: ((): (() => void) | undefined => {
              const k = vybranaKarta ?? kartaVyucby;
              if (k === null || !smieNaDlazdicu) return undefined;
              return () => (cielDlazdice === "dedicstvo" ? odkaz(k) : vylozDoOblasti(k, cielDlazdice));
            })(),
          },
  });

  // Počas pauzy po súperovej voľbe cieľa je vidno líniu s vybranou lokalitou, nie stavbu.
  // Voľbu cieľa ukazuje na stole nástenka (volbaNaStole); cielPanel ostáva pre mobil.
  const vrstvaFazy: ReactNode = mobil || pauzaBezi || volbaNaStole ? null : draftPanel;
  const liniaSkryta = starsiViditelni || vrstvaFazy !== null || nastenkaNaStole;
  // Karty lokalít na nástenke čo najväčšie podľa šírky aj výšky plste, aby sa nástenka zmestila
  // bez posúvania (Michal 2026-10-28: „nech poriadne využíva priestor“). Vrstva nástenky má
  // okraj 26 px hore, 10 px po bokoch a dole 48 px (hrana stola).
  const listkovNastenky =
    view.nastenka.length +
    (view.ciel !== null ? 1 : 0) +
    view.lokalityVHre.length +
    (view.nastenka.some((b) => jeFinaleNaNastenke(b)) || view.ciel?.typ === "finale" ? 0 : 1) +
    1;
  // Pri voľbe cieľa podľa skutočnej vrstvy — odhad počíta s hranou stola, aj keď na nej nič nie je,
  // a lístkom na výber by chýbalo ~40 px výšky.
  // Telefón na šírku s lištou prehliadača (≤ 360 px): pri voľbe cieľa nástenka skryje popolníky
  // (špaky sú v pultoch) a lístok Koniec — inak by lokality na výber vytlačila pod okraj plste.
  const volbaNaNizkomTelefone = naSirku && volbaNaStole && vyskaOkna <= NIZKY_TELEFON;
  const nastenkaRozmer =
    volbaNaStole && rozmerVrstvyNastenky !== null
      ? rozmerNastenky(
          rozmerVrstvyNastenky.w,
          rozmerVrstvyNastenky.h + (volbaNaNizkomTelefone ? POPOLNIKY_NASTENKY : 0),
          listkovNastenky - (volbaNaNizkomTelefone ? 1 : 0),
          view.lokalityVHre.length,
          view.nastenka.length,
        )
      : rozmerNastenky(vnutroPlste.w - 20, vnutroPlste.h - 26 - 48 - presahPilulky, listkovNastenky, volbaNaStole ? view.lokalityVHre.length : 0, view.nastenka.length);
  const sirkaNastenky = nastenkaRozmer.sirkaKarty;
  const sirkaVolby = nastenkaRozmer.sirkaVyberu;
  // Voľba cieľa na nástenke: lokalita, o ktorú sa ešte nehralo, je karta na výber — klik ju dá
  // na stôl (otočiť a potvrdiť sa dá tam), dá sa aj potiahnuť. Útočník ich len vidí.
  const vyberNaNastenke = (k: CardInstance, sirka: number): ReactNode => {
    const z: Zdroj = { karta: k, odkial: "lokality", navrh: false };
    const props = {
      karta: k,
      sirka,
      onClick: volimLokalitu
        ? () => {
            setNavrh({ typ: "lokalita", uid: k.uid, otocena: lokalitaNavrh?.otocena ?? ja === 1 });
            setVrstva((v) => (v === "lokality" ? null : v));
          }
        : undefined,
    };
    // Tá istá karta ako v náhľade a lupe, len menšia (Michal 2026-10-31: „Bez zmeny vzhľadu karty“).
    const obsah = karta(props);
    return volimLokalitu ? sLupou(props, { obsah: tahatelna(z, obsah), zdroj: z }) : sLupou(props, { obsah });
  };

  // ---- jednotný bar: strany, odhad a os kola (Michal 2026-10-25, mock V2) -------------
  // Vydesení sú v osi baru jedným krátkym údajom, celé znenie je v nápovede.
  const desi = (
    <span
      className={`jbar-desi vydeseni-pocet ${vydeseni[super_] >= prahVyd - 1 ? "hrozba" : ""}`}
      title={t("plocha.vazniTitul", { ja: vydeseni[ja], meno: menoHraca(super_), su: vydeseni[super_], prah: prahVyd })}
    >
      <span className="jbar-desi-nazov">{t("starsi.vazni")} </span>
      <b className="moje">{vydeseni[ja]}</b>:<b className="superove">{vydeseni[super_]}</b>/{prahVyd}
    </span>
  );
  // Os kola v strede hlavičky webu (Michal 2026-10-27, dizajn timeline-lista A) — bar má jeden
  // riadok a stôl je vyšší. Mobil a prehrávač majú os v bare ako doteraz.
  const osVListe = !mobil && prehravanie === undefined;
  const skratkyZapnute = useUcet().ja?.skratky !== false;
  const osKola = (
    <>
      {/* Kód miestnosti je v hlavičke webu (menu Partia); v prehrávači ostáva číslo partie tu. */}
      {prehravanie !== undefined && (
        <span className="kod" title={t("plocha.cisloPartie")}>
          {kod}
        </span>
      )}
      <PriebehKola
        view={view}
        onBitka={ucetBitky !== null && view.kolo === ucetBitky.kolo + 1 ? () => setUcetBitkyZavrety(false) : undefined}
        // Šenok na pozretie (napr. pred Starostom) — ďalší klik alebo Esc ho zavrie; v Drafte je na stole.
        onDraft={() => setVrstva((v) => (v === "senok" ? null : "senok"))}
      />
    </>
  );
  // Log a ? — tlačidlo Šenok zaniklo (Michal 2026-10-27): šenok sa ukáže sám, keď ho treba
  // (draft na stole, Starosta, Cintorín), a pokyn má naň tlačidlo.
  const nastrojeStola = (
    <div className="hlava-vrstvy">
      <button
        className={["hlava-vrstva", vrstva === "log" ? "otvorena" : ""].join(" ")}
        data-vyucba="hlavicka:log"
        onClick={() => setVrstva(vrstva === "log" ? null : "log")}
      >
        Log
        {log.length - videnyLog > 0 && <span className="pocet nove">{log.length - videnyLog}</span>}
      </button>
      {skratkyZapnute && (
        <button
          type="button"
          className={`hlava-vrstva hlava-skratky ${skratky.napoveda ? "otvorena" : ""}`}
          aria-expanded={skratky.napoveda}
          aria-keyshortcuts="?"
          data-vyucba="hlavicka:skratky"
          title={t("plocha.skratky")}
          onClick={skratky.prepniNapovedu}
        >
          ?
        </button>
      )}
      {/* Celá obrazovka (Michal 2026-10-31) — na počítači pre všetkých, na telefóne skryje lištu prehliadača. */}
      {celaObrazovka.mozna && <TlacidloCelejObrazovky zapnuta={celaObrazovka.zapnuta} prepni={celaObrazovka.prepni} />}
    </div>
  );
  const rukaPocet = (p: PlayerId): ReactNode => (
    <span key="ruka" className="jbar-ruka" title={p === ja ? t("plocha.kartyVTvojejRuke") : t("plocha.kartyVRukeHraca", { meno: menoHraca(p) })}>
      <b>{view.hraci[p].rukaPocet}</b> {t("tabula.vRuke")}
    </span>
  );
  // Režim „karty“ (Michal 2026-10-25): povinne počet kariet — zvyšných na vyloženie alebo
  // v ruke podľa fázy; nič, čo už je inde na stole (cigarety, poldeci sú v bare hráča).
  // Stav pod menom v bare (Michal 2026-11-06): čo niesol režim „karty“ a na dlaždici nie je.
  const stavStrany = (p: PlayerId): { readonly text: string; readonly tip?: string } | null => {
    if (view.koniec !== null) return null;
    const zs = view.zhromazdenieStav;
    const ps = view.pitkaStav;
    if (view.faza === "zhromazdenie" && zs !== null) {
      if (zs.pasoval[p]) return { text: tRod("plocha.pasoval", rodHracaP(p)) };
      if (zs.zostavaLimit[p] === 0) return { text: t("plocha.vsetkoVonku") };
      return null;
    }
    if (view.faza === "pitka" && ps !== null) {
      const skryte = p === ja && mojeSkryteNaex.size > 0;
      const naex = (ps.naexPocet?.[p] ?? 0) > 0;
      const odkryte = ps.hotovy[0] && ps.hotovy[1];
      if (ps.reakcia === p) return { text: t("plocha.odpoveda"), tip: p === ja ? t("plocha.odpovedasNaNaex") : t("plocha.odpovedaNaNaex") };
      if (cakaSBzdochou(ps, p)) return { text: t("plocha.cakaBzdocha"), tip: p === ja ? t("plocha.sBzdochouJa", { meno: menoHraca(super_) }) : t("plocha.sBzdochouSu") };
      if (ps.hotovy[p] && !odkryte && p !== ja && vidimVolbuSupera) return { text: `✓ NA EX ${superoveSkryteNaex.size > 0 ? `×${superoveSkryteNaex.size}` : t("tabula.nie")}`, tip: t("plocha.vdakaBzdoche") };
      if (ps.hotovy[p] && !odkryte && p !== ja) return { text: "✓ NA EX?", tip: t("plocha.ciAKamTip") };
      if (ps.hotovy[p]) return { text: `✓ ${naex || skryte ? t("plocha.poNaex") : odkryte ? t("plocha.bezNaex") : t("spaky.koniec")}` };
      if (skryte) return { text: t("plocha.naexSkrytoKratko"), tip: t("plocha.superNevidi1") };
      if (naex) return { text: t("plocha.naexDal") };
      return null;
    }
    if (view.faza === "draft" && draft !== null) {
      if (draft.krok === "stavba") return { text: draft.vybral[p] ? `✓ ${tRod("plocha.vybral", rodHracaP(p))}` : t("plocha.staviaPonuku") };
      if (draft.krok === "beranie" && draft.hotovo[p]) return { text: `✓ ${tRod("plocha.skoncil", rodHracaP(p))}` };
      if (draft.noveKarty[p] > 0) return { text: t("plocha.zPonuky", { n: draft.noveKarty[p] }) };
    }
    return null;
  };
  const kartyBaru = (p: PlayerId): ReactNode => {
    const casti: ReactNode[] = [];
    const pozn = (kluc: string, text: ReactNode, title?: string): void => {
      casti.push(
        <span key={kluc} className="jbar-pozn" title={title}>
          {text}
        </span>,
      );
    };
    const zs = view.zhromazdenieStav;
    const ps = view.pitkaStav;
    const obranca = opponentOf(view.utocnik);
    if (view.koniec !== null) {
      casti.push(rukaPocet(p));
    } else if (view.faza === "zhromazdenie" && zs !== null) {
      const start = limitNaZaciatku?.kluc === klucZhromazdenia ? limitNaZaciatku.limit : zs.zostavaLimit;
      const spolu = Math.max(start[p], zs.zostavaLimit[p]);
      const zostava = zs.zostavaLimit[p];
      casti.push(
        <span key="sloty" className="pas-sloty" aria-hidden="true">
          {Array.from({ length: spolu }, (_, i) => (
            <span key={i} className={i < spolu - zostava ? "slot pouzity" : "slot"} />
          ))}
        </span>,
      );
      const poradie = obranca === p ? t("plocha.odpovedaDruhy") : t("plocha.odpovedaPrvy");
      casti.push(
        <span key="text" className="jbar-hlavne" title={`${p === ja ? t("starsi.Ty") : menoHraca(p)}: ${poradie}.`}>
          {zs.pasoval[p]
            ? tRod("plocha.pasoval", rodHracaP(p))
            : zostava === 0
              ? tRod("plocha.vylozilVsetko", rodHracaP(p))
              : p === ja
                ? t("plocha.vylozisEste", { karty: kariet(zostava) })
                : t("plocha.vyloziEste", { karty: kariet(zostava) })}
        </span>,
      );
    } else if (view.faza === "pitka" && ps !== null) {
      // NA EX naraz (v5): súperove NA EX je známe až po odkrytí (obaja skončili), moje skryté vidím.
      const naex = (ps.naexPocet?.[p] ?? 0) > 0;
      const skryte = p === ja && mojeSkryteNaex.size > 0;
      const odkryte = ps.hotovy[0] && ps.hotovy[1];
      // Pitka naraz (Michal 2026-10-27): poradie platí len pre odpovede na NA EX — od v9.2 útočník prvý, lícom dole.
      casti.push(rukaPocet(p));
      if (ps.reakcia === p) pozn("stav", p === ja ? t("plocha.odpovedasMale") : t("plocha.odpovedaMale"));
      else if (cakaSBzdochou(ps, p))
        pozn("stav", t("plocha.cakaBzdocha"), p === ja ? t("plocha.sBzdochouJa", { meno: menoHraca(super_) }) : t("plocha.sBzdochouSu"));
      else if (ps.hotovy[p] && !odkryte && p !== ja && vidimVolbuSupera)
        pozn("stav", `✓ ${tRod("plocha.vybral", rodHracaP(p))} · NA EX ${superoveSkryteNaex.size > 0 ? `×${superoveSkryteNaex.size}` : t("tabula.nie")}`, t("plocha.vdakaBzdoche"));
      else if (ps.hotovy[p] && !odkryte && p !== ja)
        pozn("stav", `✓ ${tRod("plocha.vybral", rodHracaP(p))} · NA EX?`, t("plocha.ciAKamTip2"));
      else if (ps.hotovy[p]) pozn("stav", `✓ ${tRod("plocha.skoncil", rodHracaP(p))}${naex || skryte ? ` ${t("plocha.poNaex")}` : odkryte ? ` ${t("plocha.bezNaex")}` : ""}`);
      else if (skryte) pozn("stav", t("plocha.naexSkrytoKratko"), t("plocha.superNevidi2"));
      else if (naex) pozn("stav", t("plocha.naexDal"));
      if (view.pitkaCislo < view.pitkyCelkom) pozn("limit", `${t("plocha.dalsieZhromazdenie")}: ${limitZhromazdenia(view, p)}`, t("plocha.limitDalsieho"));
    } else if (view.faza === "draft" && draft !== null) {
      casti.push(rukaPocet(p));
      if (draft.krok === "stavba") pozn("stav", draft.vybral[p] ? `✓ ${tRod("plocha.vybral", rodHracaP(p))}` : t("plocha.staviaPonuku"));
      if (draft.noveKarty[p] > 0) pozn("senok", t("plocha.zPonuky", { n: draft.noveKarty[p] }));
      if (draft.krok === "beranie" && draft.hotovo[p]) pozn("stav", `✓ ${tRod("plocha.skoncil", rodHracaP(p))}`);
    } else if (view.faza === "bitka") {
      casti.push(rukaPocet(p));
      pozn("dobere", t("plocha.poBitkeDobere", { n: KONSTANTY.DOBRATIE_PO_BITKE }));
    } else {
      casti.push(rukaPocet(p));
    }
    return casti;
  };
  const naTahuStrana = (p: PlayerId): boolean => {
    if (view.koniec !== null) return false;
    if (view.faza === "draft" && draft?.krok === "stavba") return !draft.vybral[p];
    const ps = view.pitkaStav;
    // Pitka naraz: na ťahu sú obaja, kým neskončia (Bzdocha čaká).
    if (view.faza === "pitka" && ps !== null && view.vizia === null) return ps.reakcia === p || hraVPitke(ps, p);
    return view.naTahu === p;
  };
  const stranaBaru = (p: PlayerId): StranaBaru => ({
    meno: p === ja ? "ty" : menoHraca(p),
    naTahu: naTahuStrana(p),
    stav: stavStrany(p),
    akcie: <AkcieStrany sums={lineEval.sums[p]} zdroje={lineEval.zdroje[p]} rozpis={rozpis[p]} sada={sada} menoKarty={menoKarty} sNazvom />,
    karty: kartyBaru(p),
  });
  const stredBaru: ReactNode =
    bitkaProps !== null && !mobil && !naSirku ? (
      <OdhadKola {...bitkaProps} />
    ) : bitkaProps !== null ? (
      <>
        <OdhadBaru {...bitkaProps} />
        {stavka !== null && <StavkaBitky stavka={stavka} kratko />}
      </>
    ) : (
      <>
        <span className="jbar-nadpis">{view.koniec !== null ? t("spaky.koniec") : t("plocha.ciel")}</span>
        <b className="jbar-verdikt">
          {view.koniec !== null ? t("faza.koniecHry") : lokalita !== null ? menoKarty(lokalita.defId) : t("plocha.vyberaSaLokalita")}
        </b>
        {view.koniec === null && view.spakyNaSekere > 0 && <span className="jbar-tuhe">{t("plocha.plusNaSekere", { n: view.spakyNaSekere })}</span>}
      </>
    );

  // ---- účty a posledné udalosti (UX N3) ---------------------------------------
  const zn = (x: number): string => (x > 0 ? `+${x}` : x < 0 ? `−${-x}` : "±0");
  const ucetBitkyEl =
    !ukazUcetBitky || ucetBitky === null ? null : (
      <button
        type="button"
        className="toast-stola ucet-bitky"
        aria-label={t("plocha.vysledokBitkyAria", { lokalita: ucetBitky.lokalita })}
        data-vyucba="bitka-ucet"
        role="status"
        title={t("plocha.ucetBitkyTitul")}
        onClick={() => setUcetBitkyZavrety(true)}
      >
        <strong>
          {ucetBitky.vitaz === null
            ? t("plocha.ucetRemiza", { lokalita: ucetBitky.lokalita })
            : t("plocha.ucetVysledok", { lokalita: ucetBitky.lokalita, vysledok: tRod(ucetBitky.vitaz === ja ? "plocha.ucetVyhral" : "plocha.ucetPrehral", rodHracaP(ja)), n: Math.abs(ucetBitky.tuhe[0] - ucetBitky.tuhe[1]) })}
        </strong>
        {ucetBitky.bitka !== null && (
          <span className="ucet-bitky-spaky">
            <IkonaSpaku /> {textSpakovBitky(ucetBitky.bitka, ucetBitky.spakyPred, [ja, super_], (p) => (p === ja ? t("stol.ty") : menoHraca(p)))}
          </span>
        )}
      </button>
    );
  const textUctuPitky = ((): string | null => {
    if (ucetPitky === null || ucetPitky.kolo !== view.kolo || view.faza === "volbaCiela" || view.faza === "natocenieCiela" || view.faza === "draft") return null;
    const za = (p: PlayerId): string => {
      const casti: string[] = [];
      if (ucetPitky.cirhozy[p] > 0) casti.push(t("rekap.plusCirhoza", { n: ucetPitky.cirhozy[p] }));
      if (ucetPitky.dlhy[p] > 0) casti.push(t("rekap.plusDlh", { n: ucetPitky.dlhy[p] }));
      const body = ucetPitky.cirhozy[p] * cenyKliatob[p].cirhoza + ucetPitky.dlhy[p] * cenyKliatob[p].dlh;
      if (body !== 0) casti.push(`(${zn(body)} š)`);
      if (ucetPitky.cigarety[p] > 0) casti.push(`+${t("tabula.cig", { n: ucetPitky.cigarety[p] })}`);
      return casti.length === 0 ? t("starsi.nic") : casti.join(" ");
    };
    return t("plocha.pitkaVyhodnotena", { n: ucetPitky.pitka, ja: za(ja), meno: menoHraca(super_), su: za(super_) });
  })();

  // Spodná hrana stola (Michal 2026-10-21): vľavo nákupy za cigarety, v strede
  // NA EX! či potvrdenie návrhu, vpravo koniec ťahu.
  const hranaVlavo = stolTlacidla?.vlavo ?? pokyn?.vlavo ?? null;
  const hranaStred = stolTlacidla?.stred ?? pokyn?.stred ?? null;
  const vpravoTahu = stolTlacidla?.vpravo ?? null;
  const tlacidlaPokynu = pokyn?.tlacidla;
  const hranaVpravo =
    vpravoTahu === null && tlacidlaPokynu === undefined && pokyn?.vpravo === undefined ? null : (
      <>
        {vpravoTahu}
        {tlacidlaPokynu}
        {pokyn?.vpravo}
      </>
    );
  // Pivnica (Michal 2026-11-02) na mieste, kde bol počet cigariet: väzni a ich schopnosti v okne. Bez väzňa
  // ostane tlmená, aby kraj hrany neposkakoval; svieti, keď schopnosť väzňa teraz ide (v11.2).
  const pivnicaNaHrane = view.pata !== undefined ? null : (
    <button
      type="button"
      className={["hrana-pivnica", mojiVazni.length === 0 ? "prazdna" : "", schopnostTeraz ? "dostupna" : "", vrstva === "pivnica" ? "otvorena" : ""].filter((x) => x !== "").join(" ")}
      data-vyucba="hrana:pivnica"
      aria-label={t("plocha.pivnicaAria", { n: mojiVazni.length, prah: prahVyd }) + (schopnostTeraz ? t("plocha.pivnicaMozes") : "")}
      title={
        mojiVazni.length === 0
          ? t("plocha.pivnicaPrazdna")
          : schopnostTeraz
            ? t("plocha.pivnicaTeraz")
            : t("plocha.pivnicaVazni")
      }
      onClick={() => setVrstva(vrstva === "pivnica" ? null : "pivnica")}
    >
      <span className="hrana-pivnica-cislo">
        <IkonaMrezi />
        <b>{mojiVazni.length}</b>/{prahVyd}
      </span>
      pivnica
    </button>
  );
  const maHranaTlacidla = hranaVlavo !== null || hranaStred !== null || hranaVpravo !== null;
  // Na stole (Michal 2026-10-25) je hrana jeden rad stredom na čiare okraja plste.
  // Na telefóne hrana nie je — ťahy sú v pruhu pokynu (spodok patrí ruke, Michal 2026-10-31).
  const hranaStola = !maHranaTlacidla || naSirku ? null : (
    // Počas pauzy po voľbe cieľa by „potvrdiť“ stavby svietilo v okne okolo lokality; miesto drží, aby stôl neposkočil.
    // V drafte sa hrana neprilepí nad ruku: stôl leží pod draftom a pri posúvaní
    // by zakrývala karty draftu a pokyn.
    // Ani keď z línie nad rukou nie je nič vidno (liniaVidno) — okrem rozdeľovania: línia kariet
    // je vtedy skrytá pod staršími a Potvrdiť musí ostať na očiach aj pri dvoch stĺpcoch na telefóne.
    <div className={`${view.faza === "draft" || (!liniaVidno && krokDelenia === null) ? "stol-hrana neprilepena" : "stol-hrana"} s-tlacidlami${pauzaBezi ? " pocas-pauzy" : ""}`}>
      <div className="hrana-rad">
        <div className="hrana-vlavo">
          {pivnicaNaHrane}
          {hranaVlavo}
        </div>
        <div className="hrana-stred">{hranaStred}</div>
        <div className="hrana-vpravo">{hranaVpravo}</div>
      </div>
    </div>
  );
  // Odhad bitky v pruhu pokynu (telefón): malý segment vľavo, ťuk = okno s celým odhadom — cez líniu nič.
  const odhadVPruhu: ReactNode = (() => {
    if (!naSirku || bitkaProps === null) return null;
    const tuheOdhadu = bitkaProps.damage.tuhe;
    const rozdiel = tuheOdhadu[ja] - tuheOdhadu[super_];
    return (
      <button
        type="button"
        className={rozdiel > 0 ? "vyhravam" : rozdiel < 0 ? "prehravam" : "remiza"}
        aria-label={t("plocha.odhadAria", { a: tuheOdhadu[ja], b: tuheOdhadu[super_] })}
        onClick={() => setDetailOdhadu(true)}
      >
        {tuheOdhadu[ja]}:{tuheOdhadu[super_]}
      </button>
    );
  })();
  // Línia starších otvorená ťukom na Starších v stĺpci (nie krok): pruh povie, čo stôl ukazuje, a vráti späť.
  const pohladNaStarsich = naSirku && starsiViditelni && krokStarsich === null && pohladStarsich !== null;
  const pruhPokynu = !naSirku ? null : pohladNaStarsich ? (
    <PruhPokynu
      kluc={`starsi-${klucTahu}`}
      nadpis={t("starsi.nazov")}
      text={pohladLinie === ja ? t("plocha.pohladStarsich") : t("plocha.pohladStarsichHraca", { meno: menoHraca(pohladLinie) })}
      hlavna={
        <button type="button" className="pruh-spat" onClick={zavriStarsich}>
          ← {t("plocha.spatNaStol")}
        </button>
      }
      vedlajsie={null}
    />
  ) : (
    <PruhPokynu
      kluc={klucTahu}
      jednotny={pokyn?.jednotny === true}
      naliehavy={pokyn?.naliehavy === true}
      nadpis={pokyn === null || pokyn.nadpis !== null ? (pokyn?.nadpis ?? (view.koniec !== null ? t("faza.koniecHry") : somNaTahu ? t("plocha.tvojTah") : t("plocha.naTahuJeText", { meno: menoHraca(super_) }))) : null}
      text={pokyn?.text === undefined ? null : preDotykUzol(pokyn.text)}
      hlavna={hranaStred ?? hranaVpravo}
      druha={stolTlacidla?.druha ?? pokyn?.druha}
      odhad={odhadVPruhu}
      chyba={chyba}
      onZrusChybu={zrusChybu}
      vedlajsie={
        <>
          {hranaVlavo}
          {hranaStred !== null && hranaVpravo}
          {/* ✕ a ↺ z rohu hlavnej pečiatky — v pruhu sú skryté, tu sa ukážu len ony. */}
          {hranaStred !== null && <span className="pruh-zrusenie">{hranaStred}</span>}
        </>
      }
    />
  );

  // Štítok partie a menu Partia ▾ (Michal 2026-10-26, #22 A) — menu webu je počas partie preč (#23).
  // Na šírku telefónu je hlavička webu skrytá a menu s Logom ležia v hornom pulte stola.
  const hlavickaPartie =
    prehravanie !== undefined ? (
      <div className="hlavicka-partia">{prehravanie}</div>
    ) : (
      <HlavickaPartie
        kod={kod}
        view={view}
        menoSupera={menoHraca(super_)}
        superBot={hraci[super_]?.bot === true}
        superPripojeny={superPripojeny}
        superOdpojenyOd={superOdpojenyOd}
        vyucba={vyucba === true}
        os={osVListe && !naSirku ? osKola : null}
        nastroje={osVListe && !naSirku ? nastrojeStola : null}
        melichar={vHlavicke}
        vzdat={() => cmd({ type: "vzdat" })}
        kontumacia={kontumacia}
        opustit={opustit}
        dotyk={
          naSirku
            ? {
                polozky: (
                  <>
                    <button type="button" role="menuitem" data-zavrie="" onClick={() => setVrstva("log")}>
                      {t("plocha.logPartie")}
                      {log.length - videnyLog > 0 && <span className="pocet nove">{log.length - videnyLog}</span>}
                    </button>
                    <button type="button" role="menuitemcheckbox" aria-checked={napovedy.zapnute} onClick={napovedy.prepni}>
                      {t("plocha.napovedyMelichara")} <b>{napovedy.zapnute ? t("plocha.zapnute") : t("plocha.vypnute")}</b>
                    </button>
                    {celaObrazovka.zapnuta && (
                      <button type="button" role="menuitem" data-zavrie="" onClick={celaObrazovka.prepni}>
                        {t("plocha.ukoncitCelu")}
                      </button>
                    )}
                  </>
                ),
              }
            : undefined
        }
      />
    );
  // Čísla stĺpca a tabule: aj cena nového poldeci a priazeň starších.
  const cislaPultu = (p: PlayerId) =>
    cislaHraca(view, p, prahy(p), zavislost(p), body, { cenaBarteru: barterCena(data, view, p), priazen: pocetPriazniKola(view.starsi, p) });
  // Stĺpec hráča na šírku telefónu (PultHraca.tsx): ty vľavo s nástrojmi stola, súper vpravo s menu Partia.
  const pult = (p: PlayerId): ReactNode => (
    <StlpecHraca
      view={view}
      prisunCigariet={prisunCigariet(p)}
      prisunPoldeci={prisunPoldeci(p)}
      p={p}
      info={hraci[p]}
      meno={hraci[p]?.meno ?? t("stol.hrac", { n: p + 1 })}
      cisla={cislaPultu(p)}
      naTahu={naTahuStrana(p)}
      karty={kartyDlazdica(p)}
      detail={(zdroj) => setOknoZdroja({ p, zdroj })}
      starsi={{ stlacene: starsiViditelni && krokStarsich === null && pohladLinie === p, prepni: () => prepniStarsich(p) }}
      tabula={{ otvorena: tabulaOtvorena, prepni: () => setTabulaOtvorena((o) => !o) }}
      {...(p === ja ? { pivnica: { vazni: mojiVazni.length, naVyhru: prahVyd, dostupna: schopnostTeraz, otvor: () => setVrstva("pivnica") } } : {})}
    />
  );
  const oknoZdrojaEl =
    !naSirku || oknoZdroja === null ? null : (
      <OknoZdroja
        prisun={oknoZdroja.zdroj === "cigarety" ? prisunCigariet(oknoZdroja.p) : oknoZdroja.zdroj === "poldeci" ? prisunPoldeci(oknoZdroja.p) : undefined}
        zdroj={oknoZdroja.zdroj}
        cisla={cislaPultu(oknoZdroja.p)}
        ja={oknoZdroja.p === ja}
        meno={menoHraca(oknoZdroja.p)}
        zavri={() => setOknoZdroja(null)}
        akcia={
          oknoZdroja.zdroj === "karty"
            ? { text: t("plocha.ukazatKarty"), spusti: () => { setOknoZdroja(null); otvorKarty(oknoZdroja.p, oknoZdroja.p === ja ? "balicek" : "priznane"); } }
            : oknoZdroja.zdroj === "spaky"
              ? { text: t("spaky.nastenka"), spusti: () => { setOknoZdroja(null); otvorNastenku(oknoZdroja.p); } }
              : undefined
        }
      />
    );
  const tabulaEl = !naSirku || !tabulaOtvorena ? null : (
    <Tabula
      ja={cislaPultu(ja)}
      su={cislaPultu(super_)}
      avatary={[
        <Avatar key="ja" meno={hraci[ja]?.meno ?? "ty"} avatar={hraci[ja]?.avatar ?? null} velkost={28} farba="ja" />,
        <Avatar key="su" meno={hraci[super_]?.meno ?? t("stol.superKratko")} avatar={hraci[super_]?.avatar ?? null} velkost={28} farba="su" />,
      ]}
      zavri={() => setTabulaOtvorena(false)}
      akcie={
        <>
          <button type="button" className="tlacidlo-male" onClick={() => { setTabulaOtvorena(false); otvorNastenku(ja); }}>
            {t("plocha.nastenkaTlacidlo")}
          </button>
          <button type="button" className="tlacidlo-male" onClick={() => { setTabulaOtvorena(false); otvorKarty(ja, "balicek"); }}>
            {t("plocha.mojeKarty")}
          </button>
          <button type="button" className="tlacidlo-male" onClick={() => { setTabulaOtvorena(false); otvorKarty(super_, "priznane"); }}>
            {t("plocha.kartySupera")}
          </button>
        </>
      }
    />
  );

  // Lokalita, ktorú vybral súper: karta v čitateľnej veľkosti a pod ňou hrany tak, ako ležia na stole
  // (tvoj kraj vľavo, ako na stole). Na notebooku stojí vedľa textu, aby sa zmestila na výšku bez posúvania.
  const pauzaCielaEl = ((): ReactNode => {
    if (!pauzaBezi || lokalita === null) return null;
    const kTebe = krajStrany(ja);
    const kSuperovi = krajStrany(super_);
    const finale = view.ciel?.typ === "finale";
    const sirkaKarty = Math.round(
      Math.max(
        120,
        mobil
          ? Math.min(sirkaOkna * 0.62, (vyskaOkna - 360) / POMER_KARTY)
          : naSirku
            ? // Telefón na šírku: karta vľavo na výšku okna, text a hrany vedľa nej.
              (vyskaOkna - 56) / POMER_KARTY
            : Math.min(560, vyskaOkna - 160) / POMER_KARTY,
      ),
    );
    const obsah = {
      kluc: `${view.kolo}|lokalita-supera`,
      nadnadpis: finale ? t("plocha.finaleVrcholova") : t("plocha.koloLokalita", { n: view.kolo }),
      nadpis: menoKarty(lokalita.defId),
      text:
        t("plocha.superVybralLokalitu", { meno: menoHraca(super_), vybral: tRod("plocha.vybralLok", rodHracaP(super_)), co: finale ? t("plocha.vrcholovuLokalitu") : t("plocha.lokalituKola") }) +
        (kTebe !== null && kSuperovi !== null ? t("plocha.vlavoHrana", { lavy: kTebe, pravy: kSuperovi }) : t("plocha.hranyLezia")),
    };
    return (
      <Medziobrazovka obsah={obsah} onRozumiem={zrusPauzuCiela} tlacidloPoMs={PAUZA_CIELA_MS} vypinac={false} trieda="lokalita-supera">
        <div className="ls-lokalita">
          {karta({ karta: lokalita, sirka: sirkaKarty, otocena: view.lokalitaOtocena !== (ja === 1) })}
          <span className="ls-hrany" style={naSirku ? undefined : { width: sirkaKarty }}>
            <span>◀ {t("stol.vlavo")}{kTebe !== null && <b> {kTebe}</b>}</span>
            <span>{kSuperovi !== null && <b>{kSuperovi} </b>}{t("stol.vpravo")} ▶</span>
          </span>
          {ikonyStranStredu}
        </div>
      </Medziobrazovka>
    );
  })();

  return (
    <ZarStolaKontext.Provider value={zarStolaSEvalom}>
    <div
      ref={hraRef}
      className={naSirku ? "hra mobil-sirka" : stolScroll ? "hra stol-scroll" : "hra"}
      style={{ "--ruka-w": `${sirkaVRuke}px`, "--hlavicka-h": `${vyskaHlavicky}px`, ...(naSirku ? { "--dok-h": `${vyskaRukyNaSirku}px` } : {}) } as CSSProperties}
      onClickCapture={naSirku ? tukNaCiel : undefined}
      onContextMenuCapture={
        naSirku
          ? (e) => {
              e.preventDefault();
              e.stopPropagation();
            }
          : undefined
      }
    >
      {pauzaCielaEl}
      {naSirku && view.koniec === null && ruka.length > 0 && <NapovedaPodrzania />}
      {tabulaEl}
      {oknoZdrojaEl}
      {naSirku && detailOdhadu && bitkaProps !== null && (
        <Medziobrazovka
          obsah={{ kluc: "odhad-bitky", nadnadpis: lokalita === null ? t("rekap.bitka") : menoKarty(lokalita.defId), nadpis: bitkaProps.vysledok ? t("panel.vysledokBitky") : t("panel.odhadBitky"), text: "" }}
          onRozumiem={() => setDetailOdhadu(false)}
          vypinac={false}
          zavrietMimo
          trieda="okno-odhadu"
        >
          <div className="okno-odhadu-telo">{tipOdhadu(bitkaProps, stavka, textUctuPitky).text}</div>
        </Medziobrazovka>
      )}
      {/* V prehrávači výsledok ukáže detail partie — okno konca s hodnotením a lobby tam nepatrí. */}
      {view.koniec !== null && !koniecZavrety && prehravanie === undefined && bezOknaKonca !== true && (
        <KoniecHry
          rodJa={rodHracaP(ja)}
          rody={[rodHracaP(0), rodHracaP(1)]}
          view={view}
          mena={[menoHraca(0), menoHraca(1)]}
          avatary={[hraci[0]?.avatar ?? null, hraci[1]?.avatar ?? null]}
          menoKarty={menoKarty}
          starsi={{
            data,
            obrazok: (defId) => {
              const o = vzhladKarty(sada, data, defId).obrazok;
              return o === null ? null : mediaUrl(o.nahlad);
            },
          }}
          frajerina={frajerina}
          achievementy={achievementy ?? null}
          onZavri={() => setKoniecZavrety(true)}
          opustit={opustit}
        />
      )}
      <JednotnyBar
        os={osVListe ? null : osKola}
        desi={osVListe ? null : desi}
        nastroje={osVListe ? null : nastrojeStola}
        rezim={rezimStran}
        stred={stredBaru}
        tip={bitkaProps !== null ? tipOdhadu(bitkaProps, stavka, textUctuPitky) : null}
        ja={stranaBaru(ja)}
        su={stranaBaru(super_)}
        chyba={chyba}
        zrusChybu={zrusChybu}
        mobil={mobil || naSirku}
        onOdhad={naSirku && bitkaProps !== null ? () => setDetailOdhadu(true) : undefined}
      >
        {skratky.napoveda && <SkratkyNapoveda onZavri={skratky.zavriNapovedu} />}
      </JednotnyBar>
      {slotHlavicky !== null && !naSirku && createPortal(hlavickaPartie, slotHlavicky)}

      <div className="plocha">
        {/* Súperi sedia oproti sebe (Michal 2026-10-22): súperov bar hore, tvoj pod stolom;
            scoreboard nad staršími zanikol — body sú v bare hráča. */}
        {naSirku ? (
          // Telefón na šírku: súper v úzkom stĺpci vpravo (kraj línie k nemu), menu Partia na jeho spodku.
          pult(super_)
        ) : (
        <HracDoska
          pult={portretyStarsich?.(super_)}
          data={data}
          view={view}
          p={super_}
          info={hraci[super_]}
          prahy={prahy(super_)}
          zavislost={zavislost(super_)}
          menoKarty={menoKarty}
          vyhlad={vyhladPitky(super_)}
          prisunCigariet={prisunCigariet(super_)}
          prisunPoldeci={prisunPoldeci(super_)}
          body={body}
          starsi={{ stlacene: starsiViditelni && krokStarsich === null && pohladLinie === super_, prepni: () => prepniStarsich(super_), id: idLinieStarsich }}
          spakyKlik={{ stlacene: vrstva === "lokality" && nastenkaPre === super_, prepni: () => otvorNastenku(super_) }}
          karty={kartyDlazdica(super_)}
          rezim={rezimBaru}
          menoSupera={menoHraca(super_)}
          mena={[menoHraca(0), menoHraca(1)]}
          pocitadloBezi={pocitadloBezi}
          // Stav súpera je bodkou na jeho avatare, nie v lište (dizajn timeline-lista A); bot sa neodpája.
          spojenie={hraci[super_]?.bot === true || vyucba === true || prehravanie !== undefined ? undefined : { pripojeny: superPripojeny, odpojenyOd: superOdpojenyOd }}
        />
        )}
        {/* Starší hore — mimo dosahu ruky, aby sa ich lupa nebila s lupou kariet v ruke. */}
        <div className="stred">
          {/* Stôl je hneď pod staršími — pás pokynov a ruka ho neprekryjú
              (playtest 20261012-055944); dosky hráčov sú pod ním. */}
          {/* Na počítači ležia voľba cieľa a draft na stole (vrstvaFazy) — línia je vtedy prázdna. */}
          {mobil && cielPanel}
          {mobil && !pauzaBezi && draftPanel}
          {bitkaPanel}
          {/* Farba stola hovorí, čí je ťah: zelená = tvoj, sivá = čakáš. */}
          <div
            ref={liniaObalRef}
            className={`linia-obal ${view.koniec !== null ? "koniec" : somNaTahu ? "moj-tah" : "cakanie"}${hranaStola === null ? "" : maHranaTlacidla ? " s-hranou s-tlacidlami" : " s-hranou"}`}
            onContextMenu={pravyKlik(zrusVyberNaStole)}
          >
            {/* Pokyn je pilulka na hornej hrane stola (Michal 2026-10-21) — predtým pás nad rukou. */}
            {/* tabIndex: pokyn skrátený na jeden riadok sa rozbalí aj z klávesnice (fokus). */}
            {/* Výučba po bitke hovorí o starších, hoci partia stojí pri voľbe cieľa 2. kola — „klikni na
                lokalitu“ by hráča posielal na ťah, ktorý výučba nepustí. */}
            {/* Telefón: pruh pokynu s ťahmi a ☰ Partia v pravom hornom rohu plste — jediná ikona na stole. */}
            {naSirku && (
              <div className="pruh-riadok">
                {!ukazStarsich && pruhPokynu}
                {hlavickaPartie}
              </div>
            )}
            {!ukazStarsich && !naSirku && (
              <div ref={pilulkaRef} className={`linia-stav${pokyn?.jednotny === true ? " jednotna" : ""}`} role="status" aria-live="polite" tabIndex={0}>
                {(pokyn === null || pokyn.nadpis !== null) && (
                  <strong className="pilulka-nadpis">
                    {pokyn?.nadpis ?? (view.koniec !== null ? t("faza.koniecHry") : somNaTahu ? t("plocha.tvojTah") : t("plocha.naTahuJeText", { meno: menoHraca(super_) }))}
                  </strong>
                )}
                {pokyn?.text !== undefined && <span className="pilulka-text">{pokyn.text}</span>}
                {pokyn?.odkaz != null && <span className="pilulka-odkaz">{pokyn.odkaz}</span>}
              </div>
            )}
            {toastPriazneEl}
            {/* Výsledok bitky je toast na stole — plochu nezmenšuje (Michal 2026-10-28). */}
            {ucetBitkyEl !== null && <div className="toasty-stola">{ucetBitkyEl}</div>}
            {prelety.map((x) => (
              <LetiacaKarta key={x.kluc} prelet={x} koniec={() => setPrelety((p) => p.filter((y) => y.kluc !== x.kluc))}>
                {karta({ karta: { uid: UID_TIENA - 500, ...x.karta }, sirka: Math.round(x.z.width) })}
              </LetiacaKarta>
            ))}
            <div className={`stol-plst${liniaSkryta ? " linia-skryta" : ""}${starsiViditelni && krokStarsich !== null ? " krok-starsich" : ""}`} ref={plstRef}>
            {/* Línia kariet ostáva v DOM a drží výšku stola — línia starších leží nad ňou (#68). */}
            {nadLiniou}
            <div className="linia harmonika-skupiny" ref={liniaRef} inert={liniaSkryta} aria-hidden={liniaSkryta || undefined} data-vyucba="linia">
              <div className="linia-skupina moja">
                {popisKraja(ja, "vlavo")}
                <div className="partia-rad harmonika">{radStrany(ja)}</div>
              </div>
              <div
                className={`linia-skupina lokalita${lokalitaNavrh !== null ? " navrh" : ""}${lokalitaNavrh !== null && natociSuper ? " natoci-super" : ""}${jeFinaleStola ? " finale" : ""}`}
                ref={lokalitaRef}
                data-vyucba={lokalitaNavrh !== null ? "lokalita-navrh" : undefined}
              >
                <span
                  className="partia-popis"
                  title={
                    stranyStredu === null || krajStrany(ja) === null || krajStrany(super_) === null
                      ? undefined
                      : t("stol.krajeTip", { lavy: krajStrany(ja) ?? "", pravy: krajStrany(super_) ?? "" })
                  }
                >
                  {jeFinaleStola && lokalita !== null ? (naSirku ? t("stol.finale") : t("stol.finaleLokalita")) : lokalita !== null || lokalitaNavrh !== null ? t("stol.lokalita") : t("stol.cielKola")}
                </span>
                <div className="partia-rad harmonika">{stredLinie}</div>
                {popisStranStredu}
                {lokalitaNavrh !== null && tahanie === null && (
                  <span className="otocit-tip" data-vyucba={natociSuper ? undefined : "otocenie"}>
                    {tipNavrhuLokality(!natociSuper, naSirku, menoHraca(super_))}
                  </span>
                )}
              </div>
              <div className="linia-skupina superova">
                {popisKraja(super_, "vpravo")}
                <div className="partia-rad harmonika">{radStrany(super_)}</div>
              </div>
            </div>
            {podLiniou}
            {naPlsti}
            {klucVizie !== null && kartyVizie.length > 0 && <ViziaNaStole key={klucVizie} karty={kartyVizie} rozmer={rozmerKarietVizie} />}
            {vrstvaFazy !== null && !starsiViditelni && !nastenkaNaStole && (
              <div className="vrstva-fazy" ref={setVrstvaFazyEl}>
                {vrstvaFazy}
              </div>
            )}
            <div className="vrstva-starsich" id={idLinieStarsich} hidden={!starsiViditelni} data-vyucba="linia-starsich">
              {starsiViditelni && (
                <LiniaStarsich
                  rad={radLinie}
                  data={data}
                  ja={ja}
                  pohlad={pohladLinie}
                  mena={[menoHraca(0), menoHraca(1)]}
                  krok={krokMoj && krokStarsich !== null ? krokStarsich.nazov : null}
                  zmenene={zmeneniStarsi}
                  vyhry={view.vyhry}
                  pult={pultLinie}
                  rezim={rezimLinie}
                  onRezim={zmenRezimLinie}
                  tlacidlo={suhrnNaLinii === undefined ? tlacidloLinieStarsich : null}
                  nastenka={view.nastenka}
                  suhrn={suhrnNaLinii}
                />
              )}
            </div>
            {nastenkaNaStole && (
              <div
                ref={vrstvaNastenkyRef}
                className={`vrstva-nastenky${nastenkaRozmer.sirkaKarty >= NASTENKA_KARTA_MIN ? "" : " bez-kariet"}${volbaNaNizkomTelefone ? " volba-nizka" : ""}`}
                data-vyucba="nastenka"
                style={{ "--nk": nastenkaRozmer.nk, "--nk-sirka": `${nastenkaRozmer.sirkaKarty}px`, "--nk-stlpcov": nastenkaRozmer.rady === 2 ? nastenkaRozmer.stlpcov : 99 } as CSSProperties}
              >
                {volbaNaStole ? (
                  <span className="nastenka-pokyn">
                    <strong>{t("faza.volbaCiela")}</strong>
                    {/* Pokyn na ťah je v pilulke nad stolom — tu len to, čo v nej nie je. */}
                    {!volimLokalitu && t("plocha.superVybera", { meno: menoHraca(super_) })}
                    {view.spakyNaSekere > 0 && <small>{t("plocha.naSekereVezme", { spaky: spakov(view.spakyNaSekere) })}</small>}
                  </span>
                ) : (
                  <button type="button" className="ls-tlacidlo nastenka-spat" onClick={() => setVrstva(null)}>
                    ← {t("plocha.spatNaStolVelke")} <kbd>Esc</kbd>
                  </button>
                )}
                {volbaNaStole
                  ? nastenkaEl(sirkaNastenky >= NASTENKA_KARTA_MIN, sirkaNastenky, true, vyberNaNastenke, false, nastenkaRozmer.nk, sirkaVolby, nastenkaRozmer.vyber)
                  : nastenkaEl(sirkaNastenky >= NASTENKA_KARTA_MIN, sirkaNastenky, true, undefined, false, nastenkaRozmer.nk)}
              </div>
            )}
            {nahliadnutie && krokStarsich !== null && (
              <button type="button" className="ls-tlacidlo stol-navrat" onClick={() => setNahliadnutie(false)}>
                ← {t("plocha.spatNaStarsich")} · {krokStarsich.nazov} <kbd>Esc</kbd>
              </button>
            )}
            </div>
            {hranaStola}
          </div>

          {naSirku ? pult(ja) : (
          <HracDoska
            pult={portretyStarsich?.(ja)}
            data={data}
            view={view}
            p={ja}
            info={hraci[ja]}
            prahy={prahy(ja)}
            zavislost={zavislost(ja)}
            menoKarty={menoKarty}
            menoSupera={menoHraca(super_)}
            mena={[menoHraca(0), menoHraca(1)]}
            vyhlad={vyhladPitky(ja)}
            prisunCigariet={prisunCigariet(ja)}
            prisunPoldeci={prisunPoldeci(ja)}
            body={body}
            starsi={{
              stlacene: starsiViditelni && krokStarsich === null && pohladLinie === ja,
              prepni: () => prepniStarsich(ja),
              id: idLinieStarsich,
              posuny: new Set(view.zmenyMarkerov.map((x) => x.elderId)).size,
            }}
            spakyKlik={{ stlacene: vrstva === "lokality" && nastenkaPre === ja, prepni: () => otvorNastenku(ja) }}
            karty={kartyDlazdica(ja)}
            rezim={rezimBaru}
            pocitadloBezi={pocitadloBezi}
          />
          )}


        </div>

      </div>

      {vrstva === "senok" && (
        <VrstvaPanel
          nazov={t("plocha.ponukaN", { n: view.senok.length })}
          pozn={
            mojaVolbaSenku !== null
              ? textVolbySenku(mojaVolbaSenku.zdroj)
              : zoSenkuLimit > 0
              ? t("plocha.klikniNaVybrane", { co: zoSenkuLimit === 1 ? t("plocha.kartu") : t("plocha.nulaAzKariet", { n: zoSenkuLimit }) })
              : t("plocha.vBalickoch", { naradie: view.naradiePocet, obcania: view.obcaniaPocet })
          }
          skryta={tahanie !== null}
          onZavri={() => setVrstva(null)}
          paticka={
            zoSenkuLimit > 0 ? (
              <>
                <span className="vrstva-paticka-text">
                  {zoSenku[0] !== undefined ? (
                    <>
                      {tr("plocha.beriesKartu", { karta: menoKarty(zoSenku[0].defId) })}
                    </>
                  ) : (
                    t("plocha.vyberJednu")
                  )}
                </span>
                <button className="tlacidlo-hlavne" data-vyucba="potvrdit" onClick={() => setVrstva(null)} disabled={zoSenku.length === 0}>
                  {t("plocha.vziat")}
                </button>
              </>
            ) : undefined
          }
        >
          <div className="vrstva-karty harmonika">
            {view.senok.length === 0 && tieneSenku.length === 0 && <span className="popis">{t("plocha.ponukaPrazdna")}</span>}
            {radSenkuSTienmi(view.senok, (k) => {
              const z: Zdroj = { karta: k, odkial: "senok", navrh: false };
              const vybrana = zoSenku.some((x) => x.uid === k.uid);
              // Predavačka a Živnostník (Podpora) dovolia len kartu svojho druhu — ostatné sú zosivené.
              const mimoPonuky = mojaVolbaSenku !== null && !ponukaSenku(data, view, mojaVolbaSenku).some((x) => x.uid === k.uid);
              const props = {
                karta: k,
                sirka: SIRKA_VO_VRSTVE,
                vybrana,
                onClick:
                  mojaVolbaSenku !== null
                    ? mimoPonuky
                      ? undefined
                      : () => posli({ type: "senok", uid: k.uid })
                    : zoSenkuLimit > 0
                      ? () => prepniZoSenku(k.uid)
                      : undefined,
              };
              return sLupou(props, {
                obsah: vybrana ? karta(props) : tahatelna(z, karta(props)),
                zdroj: z,
                odstran: vybrana ? () => prepniZoSenku(k.uid) : undefined,
                trieda: mimoPonuky ? "mimo-ponuky" : undefined,
              });
            }, SIRKA_VO_VRSTVE)}
          </div>
        </VrstvaPanel>
      )}

      {vrstva === "vestica" && view.volbaVestica !== null && (
        <VrstvaPanel
          nazov={t("plocha.vesticaNazov")}
          pozn={t("plocha.vesticaPozn")}
          skryta={tahanie !== null}
          trieda="vestica-panel"
          onZavri={() => setVrstva(null)}
          // Výmena sa potvrdí priamo tu (Michal 2026-11-02) — predtým bolo treba okno zavrieť a potvrdiť pečiatkou v páse.
          paticka={(() => {
            const v = mode.typ === "vestica" ? mode : null;
            const moja = v?.moja ?? null;
            const jeho = v?.jeho ?? null;
            const kartaV = (kto: "moj" | "jeho", i: number | null): CardInstance | undefined => (i === null ? undefined : view.volbaVestica?.[kto][i]);
            const km = kartaV("moj", moja);
            const kj = kartaV("jeho", jeho);
            return (
              <div className="vestica-paticka">
                <span className="vrstva-paticka-text">
                  {km !== undefined && kj !== undefined ? (
                    <>
                      {tr("plocha.vesticaVymena", { dam: <strong className="vestica-su">{menoKarty(km.defId)}</strong>, meno: menoHraca(super_), vezmem: <strong className="vestica-ja">{menoKarty(kj.defId)}</strong> })}
                    </>
                  ) : km === undefined && kj === undefined ? (
                    t("plocha.vyberVlavoVpravo")
                  ) : km === undefined ? (
                    t("plocha.esteVlavo")
                  ) : (
                    t("plocha.esteVpravo")
                  )}
                </span>
                <button
                  className="tlacidlo-hlavne"
                  data-vyucba="potvrdit"
                  disabled={moja === null || jeho === null}
                  onClick={() => {
                    if (moja === null || jeho === null) return;
                    setVrstva(null);
                    posli({ type: "vestica", moja, jeho });
                  }}
                >
                  {t("plocha.vymenit")}
                </button>
              </div>
            );
          })()}
        >
          <VesticaVyber
            moj={view.volbaVestica.moj}
            jeho={view.volbaVestica.jeho}
            moja={mode.typ === "vestica" ? mode.moja : null}
            jehoVyber={mode.typ === "vestica" ? mode.jeho : null}
            menoSupera={menoHraca(super_)}
            menoKarty={menoKarty}
            najviac={SIRKA_VO_VRSTVE}
            onVyber={(kto, i) => {
              if (mode.typ !== "vestica") return;
              setMode(kto === "moj" ? { ...mode, moja: i } : { ...mode, jeho: i });
            }}
            karta={(k, sirka, vybrana, onClick, stitok) =>
              sLupou(
                { karta: k, sirka, vybrana, onClick },
                {
                  stitok,
                  ...(vybrana ? { trieda: "vestica-vybrana" } : {}),
                  odstran: vybrana ? onClick : undefined,
                },
              )
            }
          />
        </VrstvaPanel>
      )}

      {vrstva === "karty" && (
        <GaleriaKariet
          key={kartyHrac}
          view={view}
          data={data}
          sada={sada}
          hrac={kartyHrac}
          moje={kartyHrac === ja}
          meno={kartyHrac === ja ? (hraci[ja]?.meno ?? "ty") : menoHraca(kartyHrac)}
          avatar={hraci[kartyHrac]?.avatar ?? null}
          sekcia={kartyHrac === ja || kartyZalozka === "dedicstvo" ? kartyZalozka : "priznane"}
          velka={(k, sirka) => sLupou({ karta: k, sirka })}
          skryta={tahanie !== null}
          onZavri={() => setVrstva(null)}
        />
      )}

      {vrstva === "pivnica" && (
        <VrstvaPanel
          nazov={t("plocha.pivnicaNazov")}
          pozn={
            <>
              {t("plocha.vazniNaVyhru", { n: prahVyd })}
              {vydeseni[super_] >= prahVyd - 1 && view.koniec === null && (
                <span className="pivnica-hrozba">
                  {" "}
                  {t("plocha.superMaVaznov", { meno: menoHraca(super_), n: vydeseni[super_], prah: prahVyd })}
                </span>
              )}
            </>
          }
          skryta={tahanie !== null}
          onZavri={() => setVrstva(null)}
        >
          <div className="pivnica-okno">
            {mojiVazni.length === 0 && <span className="popis">{t("plocha.nemasVazna")}</span>}
            {/* Na telefóne by riadok odsunul tlačidlá pod okraj — pravidlo povie detail po ťuknutí. */}
            {mojiVazni.length > 0 && !naSirku && <span className="pivnica-pravidlo">{t("plocha.schopnostRaz")}</span>}
            {mojiVazni.map((v) => {
              const k = kseftyStola.find((x) => x.uid === v.karta.uid);
              return (
                <div key={v.elderId} className="pivnica-vazen">
                  {karta({ karta: v.karta, sirka: naSirku ? SIRKA_PIVNICE_NA_SIRKU : sirkaPivnice })}
                  <span className="pivnica-poradie">
                    {t("plocha.zajaty", { n: v.poradie })}
                  </span>
                  {k !== undefined && kseftNaKarte(k)}
                </div>
              );
            })}
          </div>
        </VrstvaPanel>
      )}

      {vrstva === "log" && (
        <VrstvaPanel nazov="Log" skryta={tahanie !== null} onZavri={() => setVrstva(null)}>
          <div className="log">
            {log.length === 0 && <span className="popis">{t("plocha.logPrazdny")}</span>}
            {log.map((riadok, i) => {
              const priazen = riadokPriazneLogu(riadok);
              return (
                <div key={i} className={riadok.startsWith("⚠") ? "manual" : priazen !== null ? "log-priazen" : ""}>
                  {priazen === null ? riadok : (
                    <>
                      <IkonaPriazne /> {priazen}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </VrstvaPanel>
      )}

      {/* Ruka je pripnutá k spodku okna a vždy v jednom rade — pri veľa
          kartách sa prekrývajú (viď .ruka v hra.css), nikdy nezalomia.
          Pokyn a tlačidlá ťahu sú na stole (pilulka a hrana stola). */}
      <div
        className={zonaTriedy("ruka", vybraneMiesto !== undefined ? "ruka volba-miesta" : "ruka")}
        data-ciel={jeCiel("ruka") ? "ruka" : undefined}
        style={{ "--lupa-ruky": mierkaLupy } as CSSProperties}
      >
        {/* Karty v ruke vidno hneď vedľa — dôležitejšie je, koľko ostáva v balíčku (dizajn U10). */}
        <button
          className={`ruka-nadpis odhodene-nadpis balicek-nadpis ${vrstva === "karty" && kartyHrac === ja && kartyZalozka === "balicek" ? "otvorena" : ""}`}
          title={t("plocha.doberaciTitul")}
          aria-expanded={vrstva === "karty" && kartyHrac === ja && kartyZalozka === "balicek"}
          onClick={() => otvorKarty(ja, "balicek")}
        >
          {t("plocha.balicekMale")}<b>{hJa.doberaciPocet}</b>
        </button>
        {/* Zrkadlo k „balíček“: odhadzovací balíček je verejný, klik ho ukáže. */}
        <button
          className={`ruka-nadpis odhodene-nadpis ${vrstva === "karty" && kartyHrac === ja && kartyZalozka === "odhodene" ? "otvorena" : ""}`}
          title={t("plocha.odhadzovaciTitul")}
          onClick={() => otvorKarty(ja, "odhodene")}
        >
          {t("tabula.odhodene")}<b>{hJa.odhadzovaci.length}</b>
        </button>
        <div className="ruka-rad harmonika-hover" data-vyucba="ruka">
          {ruka
            .filter((k) => !vylozenia.some((x) => x.karta.uid === k.uid) && k.uid !== podlozenieNavrh?.nastroj.uid)
            .map((k) => {
              // Vybrané miesto na stole: karta, ktorá tam smie, sa tam klikom položí.
              const naMiesto = vybraneMiesto?.karty.get(k.uid);
              const onClick =
                naMiesto !== undefined
                    ? () => polozNaMiesto(k)
                    : vybraneMiesto === undefined && (typOblasti(k).priznanie || typOblasti(k).dedicstvo)
                      ? () => vyberDoOblasti(k)
                      : undefined;
              const nova = noveVRuke.includes(k.uid);
              const dobrata = !nova && dobrate.includes(k.uid);
              const pary = naMiesto?.pary ?? [];
              const strana = naMiesto?.vnutornaVytlacena;
              const vystraha = naMiesto !== undefined && miestoVolby !== null ? vystrahaVylozenia(k, miestoVolby) : null;
              const spoj =
                strana === undefined || pary.length === 0
                  ? undefined
                  : { left: strana === "left" ? pary.map((x) => x.index) : [], right: strana === "right" ? pary.map((x) => x.index) : [] };
              const obsah = (
                <>
                  {karta({ karta: k, sirka: sirkaVRuke, vybrana: vybranaDoOblasti === k.uid, onClick, hranaVnutorna: strana, spoj, jamky: JAMKY_RUKY })}
                  {/* Nízke okno: pás s názvom je pod okrajom okna — meno ukáže štítok nad ním (hra.css). */}
                  <span className="ruka-meno" aria-hidden="true">
                    {menoKarty(k.defId)}
                  </span>
                  {nova &&<span className="nova-stitok">{t("plocha.zPonukyStitok")}</span>}
                  {dobrata && <span className="nova-stitok">{t("plocha.dobrana")}</span>}
                  {majitelPresvedcenej(view, k.uid) !== null && <span className="nova-stitok">{t("plocha.presvedcenyStarsi")}</span>}
                  {pary.length > 0 && <span className="spoj-stitok">{pary.length === 1 ? "1 spoj" : `${pary.length} spoje`}</span>}
                  {vystraha !== null && <span className="pecen-stitok">{vystrahaKratko(vystraha, ja)}</span>}
                </>
              );
              const triedy = [nova || dobrata ? "nova-zo-senku" : ""];
              if (vybraneMiesto !== undefined) triedy.push(naMiesto === undefined ? "nemoze" : pary.length > 0 ? "vysunuta" : "bez-spoja");
              // Bez myši: Enter / ťuknutie urobí to isté čo klik, inak kartu zväčší (lupa) — na dotyku sa ruka inak prečítať nedá.
              const klucLupy = `r${k.uid}`;
              const zdrojRuky: Zdroj = { karta: k, odkial: "ruka", navrh: false };
              lupaKarty.set(klucLupy, { render: (s) => karta({ karta: k, sirka: s, jamky: JAMKY_RUKY }), zdroj: zdrojRuky });
              const lupaRuky = (el: HTMLElement): void => otvorLupu(klucLupy, el.querySelector(".kl"));
              const aktivuj = (el: HTMLElement): void => {
                if (onClick !== undefined) onClick();
                else if (naSirku && cieleZdroja(zdrojRuky).size > 0) prepniVyberTukom(zdrojRuky);
                else lupaRuky(el);
              };
              return tahatelna(
                zdrojRuky,
                obsah,
                k.uid,
                PORADIE + k.uid,
                triedy.join(" ").trim() || undefined,
                vybraneMiesto !== undefined
                    ? () => setMiestoVolby(null)
                    : undefined,
                {
                  aktivuj,
                  popis: `${menoKarty(k.defId)}${naMiesto !== undefined ? t("plocha.polozitNaMiesto") : ""}`,
                  tukni: (jeDotyk || naSirku) && onClick === undefined,
                  podrz: naSirku ? lupaRuky : undefined,
                  // Štítok „dobraná“ zmizne pri prvom prejdení myšou — hráč kartu videl (Michal 2026-10-30).
                  naMys: dobrata ? () => setDobrate((d) => d.filter((u) => u !== k.uid)) : undefined,
                },
              );
            })}
          {jeCiel(PORADIE + "koniec") && (
            <div className={`poradie-koniec ${nadCielom(PORADIE + "koniec") ? "nad-cielom" : ""}`} data-ciel={PORADIE + "koniec"}>
              na koniec
            </div>
          )}
          {zoSenku.map((k) =>
            tahatelna(
              { karta: k, odkial: "senok", navrh: true },
              naSirku ? (
                <>
                  {karta({ karta: k, sirka: sirkaVRuke, jamky: JAMKY_RUKY })}
                  <span className="ruka-meno" aria-hidden="true">
                    {menoKarty(k.defId)}
                  </span>
                </>
              ) : (
                karta({ karta: k, sirka: sirkaVRuke, jamky: JAMKY_RUKY })
              ),
              k.uid,
              NAHRADIT + k.uid,
              undefined,
              // Pravý klik vráti kartu do šenku.
              () => prepniZoSenku(k.uid),
            ),
          )}
        </div>
      </div>

      {(() => {
        const b = suhrnLokality === null ? undefined : view.nastenka.find((x) => x.kolo === suhrnLokality);
        if (b === undefined) return null;
        return (
          <SuhrnLokality
            key={`suhrn-${b.kolo}`}
            b={b}
            zaznam={lokality.find((z) => z.kolo === b.kolo) ?? null}
            ja={ja}
            mena={[menoHraca(0), menoHraca(1)]}
            avatary={[hraci[0]?.avatar ?? null, hraci[1]?.avatar ?? null]}
            menoKarty={menoKarty}
            piktogramy={piktogramyRekapitulacie}
            favour={favourPodlaIdStola}
            onZavri={() => setSuhrnLokality(null)}
            vyhraStrachom={vyhraStrachomBitky(view, b.kolo)}
          />
        );
      })()}
      {vrstvaVyhodnotenia?.druh === "pitka" && (
        <RekapitulaciaPitkyVrstva
          key={`pitka-${view.kolo}-${vrstvaVyhodnotenia.r.pitka}`}
          r={vrstvaVyhodnotenia.r}
          ja={ja}
          mena={[menoHraca(0), menoHraca(1)]}
          nadpis={vrstvaVyhodnotenia.nadpis}
          menoKarty={menoKarty}
          piktogramy={piktogramyRekapitulacie}
          onKoniec={koniecPocitadla}
          odpovede={vrstvaVyhodnotenia.odpovede}
          naSirku={naSirku}
          momenty={vrstvaVyhodnotenia.momenty}
          skore={vrstvaVyhodnotenia.skore ?? null}
        />
      )}
      {peciatkaKroku !== null && (
        <div className="moment-vrstva peciatky-krokov" aria-live="polite" role="status">
          <div className="moment-stoh">
            {peciatkaKroku.p.map((x, i) => {
              const t = textPeciatkyKroku(x, ja, menoHraca(x.hrac));
              return (
                <div key={`${peciatkaKroku.id}-${i}`} className={`moment-pecat moment-maly ${x.hrac === ja ? "moja" : "superova"}`} style={{ "--poradie": i } as CSSProperties}>
                  <span className="moment-nazov">{t.nazov}</span>
                  <span className="moment-popis">{t.popis}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {medziViditelna && medziTeraz !== null && <Medziobrazovka obsah={medziTeraz} onRozumiem={() => potvrdMedzi(medziTeraz.kluc)} />}
      {autoPas !== null && (
        <Medziobrazovka
          obsah={{
            kluc: `autopas-${autoPas.id}`,
            nadnadpis: t("faza.zhromazdenie"),
            nadpis: t("plocha.pasujes"),
            text: `${t("plocha.hraPasovala")} ${autoPas.superVyklada ? t("plocha.superVykladaDalej") : t("plocha.ideSaNaPitku")}`,
          }}
          onRozumiem={() => setAutoPas(null)}
          vypinac={false}
          trieda="auto-pas"
        >
          {autoPas.dovody.length > 0 && (
            <ul className="auto-pas-dovody">
              {autoPas.dovody.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          )}
        </Medziobrazovka>
      )}
      {pocitadlo !== null && !medziCaka && (
        <PocitadloSLiniou
          key={`bitka-${pocitadlo.stol.kolo}`}
          vrstva={pocitadlo}
          ja={ja}
          mena={[menoHraca(0), menoHraca(1)]}
          karta={karta}
          menoKarty={menoKarty}
          piktogramy={piktogramyRekapitulacie}
          onKoniec={koniecPocitadla}
          vysledokHned={vyucba === true}
          naSirku={naSirku}
          priazne={priazneBitky(pocitadlo.stol.kolo)}
          vyhraStrachom={vyhraStrachomBitky(view, pocitadlo.stol.kolo)}
        />
      )}

      {/* Až tu — lupaKarty sa naplnia pri kreslení stola a vrstiev vyššie. */}
      {(() => {
        // Doznievajúca lupa pod novou — len obraz, myš ani klik neberie.
        const lk = doznieva === null || doznieva.kluc === lupa?.kluc ? undefined : lupaKarty.get(doznieva.kluc);
        if (doznieva === null || lk === undefined) return null;
        return (
          <Lupa key={`doznieva-${doznieva.kluc}`} rect={doznieva.rect} mierka={lk.mierka ?? mierkaLupy} onZavri={() => setDoznieva(null)} doznieva nad={lk.nad === true}>
            {lk.render(doznieva.rect.width * Math.min(lk.mierka ?? mierkaLupy, maxMierkaLupy(doznieva.rect)))}
          </Lupa>
        );
      })()}
      {(() => {
        // Výber ťukom (telefón na šírku) lupu nezakazuje — tú ruší len skutočné ťahanie.
        const lk = lupa === null || tahanieMysou !== null ? undefined : lupaKarty.get(lupa.kluc);
        if (lupa === null || lk === undefined) return null;
        const z = lk.zdroj;
        const chytit = z !== undefined && cieleZdroja(z).size > 0;
        // Na telefóne je karta malá — podržanie ju zväčší skoro na výšku displeja.
        const mierka = naSirku ? maxMierkaLupy(lupa.rect) : (lk.mierka ?? mierkaLupy);
        return (
          <Lupa
            // Nový kľúč = nová lupa s nástupom; stará pod ňou dozneje.
            key={lupa.kluc}
            rect={lupa.rect}
            prechod={lupa.prechod === true}
            nad={lk.nad === true}
            mierka={mierka}
            onZavri={zavriLupu}
            onPointerDown={chytit && !naSirku ? (e) => zacni(z, e, lupa.rect.width) : undefined}
            onOdstran={naSirku ? undefined : lk.odstran}
          >
            {lk.render(lupa.rect.width * Math.min(mierka, maxMierkaLupy(lupa.rect)))}
          </Lupa>
        );
      })()}

      {tahanieMysou !== null && (
        <div
          className="tahanie-duch"
          ref={duchRef}
          style={{ transform: `translate(${tahanieMysou.x}px, ${tahanieMysou.y}px)`, width: tahanieMysou.sirka }}
        >
          {karta({
            karta: tahanieMysou.zdroj.karta,
            sirka: tahanieMysou.sirka,
            otocena: tahanieMysou.zdroj.odkial === "lokality" && tahanieMysou.zdroj.navrh && lokalitaNavrhOtocena,
            bezPopisov: true,
          })}
        </div>
      )}

      {chybaTahania !== null && (
        // Poloha sa dopočíta pred vykreslením (useLayoutEffect) podľa rozmeru hlášky.
        <div className="chyba-tahania" role="alert" ref={chybaTahaniaRef}>
          <span>⚠ {chybaTahania.text}</span>
          <button type="button" className="tlacidlo-male" onClick={() => setChybaTahania(null)}>
            OK
          </button>
        </div>
      )}
    </div>
    </ZarStolaKontext.Provider>
  );
}

/** Zmena Frajeriny po partii: „Frajerina 1200 → 1216 (+16)“. */
function ZmenaFrajeriny({ pred, po }: { readonly pred: number; readonly po: number }) {
  const rozdiel = po - pred;
  return (
    <span className={`zmena-frajeriny ${rozdiel > 0 ? "plus" : rozdiel < 0 ? "minus" : ""}`}>
      {" "}
      {tr("plocha.frajerinaZmena", { pred, po, zmena: `${rozdiel > 0 ? "+" : rozdiel < 0 ? "−" : "±"}${Math.abs(rozdiel)}` })}
    </span>
  );
}

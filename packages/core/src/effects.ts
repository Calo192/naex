// Register efektov kariet (M10).
//
// Žiadne DSL — jedna malá funkcia na kartu, zavesená na konkrétny háčik
// motora. Neimplementovaný efekt nie je blokujúci: karta beží v režime
// MANUAL — motor ju v správnej fáze pripomenie v logu a hráči ju vyhodnotia
// sami. Register MUSÍ pokrývať všetkých 51 id (kontroluje to test).

import type { PlayerId, Tag } from "./types.ts";
import { opponentOf } from "./types.ts";
import type { GameData } from "./data.ts";
import { defOf } from "./data.ts";
import type { GameState } from "./engine.ts";
import type { ElderState } from "./elders.ts";
import { favourStarsieho, prebudenyPre, priazenHraca, priazenSila } from "./elders.ts";
import type { CardInstance } from "./types.ts";
import type { LineEval, PlacedCard } from "./partia.ts";
import { evaluateLine, prevahaStran, rataSaDoPrevahy, spojePsa } from "./partia.ts";
import { limitVykladania } from "./player.ts";
import { KONSTANTY } from "./constants.ts";

/**
 * Verejná časť stavu, z ktorej čítajú efekty ovplyvňujúce bitku a prahy.
 * Spĺňa ju GameState aj ClientState — klient z nej počíta živý odhad
 * poškodenia rovnakým kódom ako server.
 */
export interface VerejnyStav {
  readonly ciel: GameState["ciel"];
  readonly strany: GameState["strany"];
  readonly starsi: readonly ElderState[];
  readonly hraci: readonly [VerejnyHrac, VerejnyHrac];
  /** Špaky (Vidly v7) — chýba v syntetických stavoch testov. */
  readonly spaky?: readonly [number, number];
  /** Hráč dal v tomto kole NA EX (Šofér v7). */
  readonly naexVKole?: readonly [boolean, boolean];
  /** Rany navyše kúpené Kšeftom v tomto kole (Strýko z Ameriky v7). */
  readonly kseftRany?: readonly [number, number];
}

export interface VerejnyHrac {
  readonly priznane: readonly CardInstance[];
  readonly dedicstvo: readonly CardInstance[];
}

/**
 * native — pravidlo zabudované priamo v motore (nie je čo pripomínať)
 * impl   — efekt implementovaný v tomto súbore cez háčiky motora
 * manual — bez implementácie; motor ho pripomína v logu
 */
export type EfektStatus = "native" | "impl" | "manual";

export const REGISTER: Readonly<Record<string, EfektStatus>> = {
  // Texty podľa tlačovej sady (docs/KartyAI_PrintFile_20260716). Zmenený text
  // karty v tvorcovi → skontroluj, či implementácia ešte sedí.
  autobusar: "impl", // Bitka: ignoruj 1 Absťák — v poškodení, remíze aj špakoch víťaza
  benzinka: "impl", // Zhromaždenie + Pitka: nikto nesmie fajčiť (Michal 2026-10-20)
  cigorky: "impl", // Dedičstvo: žiadny refill; v každej Pitke cigareta navyše
  kocovnik: "native", // Furt: jeho akcie sa počítajú hráčovi s prevahou v jeho kraji (Michal 2026-10-24; evaluateLine)
  cirhoza: "native", // Bitka: dodatočná rana od súpera (cirhozaBonus)
  dievcina_na_vydaj: "impl", // Bitka (v7): od 4 priznaných Dlhov zahodenie + Dlhy podľa aktívnych akcií
  dlh: "native", // Bitka: krok Exekútora
  farar: "impl", // Bitka: ignoruj 2 súperove Povery
  financna_poradkyna: "impl", // Pitka: Dlh z jej akcií dostáva súper, nie jej majiteľ (Michal 2026-10-18; spúšťač z Prestávky 2026-10-24)
  hasic: "impl", // Nástup: náhodná karta z odhadzovacieho — nechať v ruke, alebo vrátiť (príkaz hasic)
  hrobar: "impl", // Furt: cigareta, keď súper zahodí kartu
  ihrisko: "impl", // Bitka: v každom kraji +2 tuhé tomu, kto tam má viac svojich Občanov, Zvierat a Starešinov (Michal 2026-10-20)
  krcma: "impl", // Pitka: s plným poldeci povinný NA EX (bez NA EX sa Pitka neskončí); prah Cirhózy +2
  krcmarka: "impl", // Bitka: otočenie vypitého poldeci
  lesna_cesta: "impl", // Bitka (v7): +1 tuhé za každé svoje Zviera v súperovom kraji
  liberal: "impl", // Furt: 2× akcie pri rovnosti pohlaví (NA EX naň smie od 2026-10-26)
  milujuca_manzelka: "impl", // Pitka (v7, M2): tvoje poškodenie pečene v Pitke −1 (prirastkyPitky)
  ministrant: "impl", // Výhra: posun markera stojí +1 prebytku
  nealko: "impl", // Dedičstvo: Poldeci/NA EX bez pečene; Poldeci nedopĺňa
  niekoho_stryna: "impl", // Nástup: zahoď 1 Cirhózu alebo 1 Dlh z ruky
  noviny: "impl", // Dedičstvo (v6): po vyhratej bitke (pri sekere obom) +1 špak, keď sa ťa bojí viac starších ako súpera (engine.ts)
  pasca: "impl", // Dedičstvo: každé súperovo Zviera v línii mu uberie 1 tuhé (Michal 2026-10-20)
  pijan: "impl", // Bitka: rana do vlastnej partie pri žene s aktívnym poldeci
  policajtka: "impl", // Pitka: súper, ktorý v nej dal viac NA EX ako ty, dostane Dlh (Michal 2026-10-26)
  postarka: "impl", // Pitka: voliteľné doberanie s dlhmi
  praudovravec: "impl", // Furt (v7, Dezinformátor): Odpor na jeho spojoch posilní (partia.ts)
  presbiter: "impl", // Bitka: sám proti prevahe — súper má o toľko Viery menej, koľko má Presbiter aktívnych akcií (partia.ts, Michal 2026-10-20)
  dvojcata: "impl", // Furt: do prevahy sa rátajú za dvoch (partia.ts, Michal 2026-10-20)
  puska: "impl", // Dedičstvo: pohoršenia proti tebe neplatia; tvoje povery nič
  recidivista: "impl", // Bitka: rana za zahraničného v súperovej partii
  silna_nezavisla_zena: "impl", // Furt: akcie len s podporou dvoch chlapov
  starosta: "impl", // Pitka: výmena karty za cigaretu
  svaty_text: "impl", // Dedičstvo: Viera chráni pred mäkkým
  veterinar: "impl", // Bitka: Cirhóza pridáva o zopár menej
  veteran: "impl", // Furt: NA EX naňho aktívne akcie zdvojí (nezruší), neaktívne nezdvojí (partia.ts, Michal 2026-10-23)
  velmi_smutiaca_vdova: "impl", // Nástup: muž navrchu súperovho balíčka preč
  vestica: "impl", // Prehra: výmena kariet v balíčkoch
  vychovavatelka: "impl", // NA EX → tvoj priznaný Dlh do súperovho doberacieho balíčka (Michal 2026-10-19)
  vinko: "impl", // Dedičstvo: poldeci navyše; nedolieva poldeci za cigarety (Michal 2026-10-19)
  vyherny_automat: "impl", // Dedičstvo: výhra páli dlhy, prehra dlh dáva
  zastavka: "impl", // Zhromaždenie: spoločný limit vykladania — súčet limitov oboch (Michal 2026-10-20)
  zberny_dvor: "impl", // Pitka: raz za Pitku za cigaretu karta z vlastného odhadzovacieho balíčka (Michal 2026-10-20)
  zamocnik: "impl", // Furt: akcie nástrojov v okolí posilnené
  zivnostnik: "impl", // Výhra: víťaz zahodí jedno súperovo Dedičstvo podľa výberu (Michal 2026-10-26; predtým Nástup)
  abstak: "native", // Bitka: o ranu menej (−1 tuhé za kus)
  pes: "impl", // Furt: +1 tuhé za pár akcií na spoji so súperovou kartou; nikdy v partii s iným zvieraťom
  kostol: "impl", // Zhromaždenie: nikto nesmie vypiť; Pitka: nikto nesmie dať NA EX (Michal 2026-10-20)
  zahradkar: "impl", // Bitka (v7): tvoj prah Exekútora je o 2 vyšší (exekutorLokality)
  svokra: "impl", // Bitka: za každú tvoju kartu so súperovým NA EX súperovi Rana (Michal 2026-10-26)
  sarlatan: "impl", // Furt (v7): aktívna pečeň v okolí sa ráta aj ako Viera (partia.ts)
  podvodnik: "impl", // Prehra (v7): jeden tvoj priznaný Dlh prejde k súperovi
  cierna_macka: "impl", // Furt: tvoje Povery dávajú mäkké poškodenie aj bez súperových priznaných Dlhov
  anonymny_alkoholik: "impl", // Furt: tvoje NA EX naňho sa nepočíta do limitu za Pitku (placatka, Michal 2026-10-26)
  // Roadmapa #71 (2026-10-23).
  sofer: "impl", // Bitka (v7): bez NA EX v kole Pecka navyše (bitkaMody)
  snubenica: "impl", // Nástup (do 2026-10-23 Ujo s fúrikom): vedľa karty s NA EX ju vráti majiteľovi do ruky a zaujme jej miesto
  // Nové lokality (Michal 2026-10-20, docs/playtesty/navrh-lokality.html).
  most: "impl", // Zhromaždenie: karty len na vlastnú stranu
  cintorin: "impl", // Prehra: Nástroj z ruky do Dedičstva bez platenia
  obecny_urad: "impl", // Bitka (v7): každá aktívna Robota spáli 2 priznané Dlhy
  jednota: "impl", // Kšeft (v7): za 1 Dlh 2 cigarety
  kulturny_dom: "impl", // Bitka (v6): prebytok sa nerozdeľuje — držiteľ dostane toľko špakov
  vinna_pivnica: "impl", // Pitka: NA EX až dvakrát
  druzstvo: "impl", // Zhromaždenie: Pracujúci nemíňajú limit vykladania
  kar: "impl", // Pitka (v7): doliatie bez cigariet, každé +1 pečeň
  // Sada v7 (revízia, Michal 2026-10-27) — schválené novinky, nové karty a lokality.
  vidly: "impl", // Dedičstvo: +1 tuhé, kým máš menej špakov (bitkaMody)
  lievik: "impl", // Dedičstvo: NA EX aj na Zviera (naexCieleVLinii)
  krokodil: "impl", // Furt: súperovu kartu vyloženú vedľa po bitke zožerie (koniecBitky)
  kapybara: "impl", // Kšeft: za 2 cigarety súper −1 špak
  kon: "impl", // Furt: Nástroj s ním tvorí spoj (partia.ts spojVznikne)
  kohut: "impl", // Furt: kolo má aspoň 2 Pitky (pocetPitiek)
  degustatorka: "impl", // Nástup: súperovi s viac plnými poldeci otočí jeden na vypitý
  klebetnica: "impl", // Nástup: pozri súperovu ruku, jednu kartu naspodok (príkaz klebetnica)
  dohadzovacka: "impl", // Nástup: vymeň dvom starším scorecardy (príkaz dohadzovacka)
  vandal: "impl", // Nástup: otoč lokalitu o 180°
  stryko_z_ameriky: "impl", // Kšeft: za 2 cigarety Rana navyše v bitke kola
  opatrovatelka: "impl", // Nástup: nerestí z minulého kola −2
  smetiarka: "impl", // Kšeft: kartu z ruky (nie Kliatbu) odhodíš za cigaretu
  brigadnik: "impl", // Furt: do prevahy sa neráta (partia.ts)
  masiar: "native", // bez efektu
  kulturista: "native", // bez efektu
  traktoristka: "impl", // Bitka: s prevahou v jej kraji Pecka navyše, inak Dlh
  oslavenec: "impl", // Kšeft: za plný poldeci súper +2 pečene v tejto Pitke
  vymahac: "impl", // Bitka: za každé 2 priznané Dlhy Rana navyše
  sklad: "impl", // Kšeft: za cigaretu vrchná karta zo súperovho odhadzovacieho balíčka
  polovnicka_chata: "impl", // Furt: tuhé z hrán ×2 (partia.ts)
  predsedova_vila: "impl", // Kšeft: za 2 cigarety posun markera o 1
  herna: "impl", // Bitka: víťaz + špaky za priznané Dlhy porazeného (vyplatSpaky)
};

export function jeEfektManual(defId: string): boolean {
  return (REGISTER[defId] ?? "manual") === "manual";
}

// ---------------------------------------------------------------------------
// Kde sa efekt nachádza a komu patrí

/** Lokalita aktuálneho kola. */
export function jeCielLokalita(state: Pick<VerejnyStav, "ciel">, defId: string): boolean {
  // Aj pinnacle vo finále (v7).
  return state.ciel?.lokalita?.defId === defId;
}

/**
 * Karty hráča p v línii — tie, ktoré zahral a sú natočené k nemu, v jeho aj
 * v súperovej partii. Akcie aj efekty karty patria jej majiteľovi; „tvoja
 * partia“ v texte karty znamená tvoje karty (pravidlá v3).
 */
export function partiaHraca(state: { readonly strany: VerejnyStav["strany"] }, p: PlayerId): PlacedCard[] {
  return [...state.strany[0], ...state.strany[1]].filter((pl) => pl.playedBy === p);
}

/**
 * Hráč p má v línii odkrytú kartu defId (natočenú k sebe, v ktorejkoľvek
 * partii). Skrytá Záverečná sa neráta — jej efekty mimo línie sa odložia na
 * otočenie, inak by ju prezradili (Michal 2026-10-23).
 */
export function vPartii(state: Pick<VerejnyStav, "strany">, p: PlayerId, defId: string): boolean {
  return partiaHraca(state, p).some((pl) => pl.card.defId === defId && pl.zaverecna !== true);
}

export function vDedicstve(state: VerejnyStav, p: PlayerId, defId: string): boolean {
  return state.hraci[p].dedicstvo.some((k) => k.defId === defId);
}

/**
 * Efekt „patrí“ hráčovi p: je to jeho karta v línii, v jeho Dedičstve,
 * alebo je to prebudený starší vydesený hráčom p.
 */
export function efektHraca(state: VerejnyStav, p: PlayerId, defId: string): boolean {
  if (vPartii(state, p, defId) || vDedicstve(state, p, defId)) return true;
  return state.starsi.some((e) => e.karta.defId === defId && prebudenyPre(e) === p);
}

/**
 * Praudovravec: Autority v SÚPEROVEJ partii neuplatňujú efekt (Michal
 * 2026-10-18; predtým v tvojej). Kontroluje sa pri každom efekte karty
 * s tagom Autorita, ktorej majiteľom je hráč p.
 */
export function efektPotlaceny(data: GameData, state: Pick<VerejnyStav, "strany">, p: PlayerId, defId: string): boolean {
  const def = data.cards.get(defId);
  if (def === undefined || !def.tags.includes("Autorita" as Tag)) return false;
  // v7: Praudovravec je Dezinformátor (Odpor na jeho spojoch posilní, partia.ts) —
  // Autority už neumlčí. Umlčanie ostáva len pre sady s jeho starým textom.
  return vPartii(state, opponentOf(p), "praudovravec") && data.cards.get("praudovravec")?.effectText.includes("Autorit") === true;
}

/**
 * Zadĺženie z aktívnych akcií Dlh v línii, [hráč 0, hráč 1]. financna_poradkyna
 * (Michal 2026-10-18): Dlh z jej akcií dostáva súper, nie jej majiteľ. Jeden
 * výpočet pre Pitku (prirastkyPitky) aj náhľad vyloženia (nahladVylozenia) —
 * náhľad ho predtým pripísal majiteľovi (playtest 2026-10-22).
 */
export function zadlzenieZLinie(data: GameData, state: Pick<VerejnyStav, "strany">, vyhodnotenie: LineEval): readonly [number, number] {
  const poradkynaDlhy = [0, 0] as [number, number];
  for (const p of [0, 1] as const) {
    for (const placed of partiaHraca(state, p)) {
      if (placed.card.defId !== "financna_poradkyna" || efektPotlaceny(data, state, p, "financna_poradkyna")) continue;
      const ev = vyhodnotenie.cards.get(placed.card.uid);
      if (ev === undefined) continue;
      for (const strana of [ev.left, ev.right]) {
        for (const slot of strana) {
          if (slot?.action === "Dlh" && slot.stav === "aktivna") poradkynaDlhy[p] += slot.nasobok;
        }
      }
    }
  }
  const sums = vyhodnotenie.sums;
  const pre = (p: PlayerId): number => Math.max(0, (sums[p].Dlh ?? 0) - poradkynaDlhy[p]) + poradkynaDlhy[opponentOf(p)];
  return [pre(0), pre(1)];
}

// ---------------------------------------------------------------------------
// Háčiky — motor ich volá na presne určených miestach

/**
 * Prah Cirhózy navyše: nealko v Dedičstve hráča p (+2) a Krčma ako cieľ kola
 * (+2 obom — povinné NA EX tam už neznamená istú Cirhózu, Michal 2026-10-22).
 */
export function prahCirhozyBonus(state: VerejnyStav, p: PlayerId): number {
  return (
    (vDedicstve(state, p, "nealko") ? KONSTANTY.EFEKT.NEALKO_PRAH_CIRHOZY : 0) +
    (jeCielLokalita(state, "krcma") ? KONSTANTY.EFEKT.KRCMA_PRAH_CIRHOZY : 0)
  );
}

/** vinko: počíta sa ako nevypitý poldeci navyše (limit vykladania +1). */
export function limitBonus(state: VerejnyStav, p: PlayerId): number {
  return vDedicstve(state, p, "vinko") ? 1 : 0;
}

/** zastavka (Michal 2026-10-20): obaja hráči majú spoločný limit vykladania — súčet ich limitov. */
export function spolocnyLimit(state: VerejnyStav): boolean {
  return jeCielLokalita(state, "zastavka");
}

/** kostol: nikto nesmie vypiť (v Zhromaždení teda len jedna karta za ťah). */
export function zakazVypit(state: Pick<VerejnyStav, "ciel">): boolean {
  return jeCielLokalita(state, "kostol");
}

/** kostol: nikto nesmie dať NA EX. */
export function zakazNaex(state: VerejnyStav): boolean {
  return jeCielLokalita(state, "kostol");
}

/** benzinka: nikto nesmie fajčiť (v Zhromaždení ani v Pitke). */
export function zakazFajcit(state: VerejnyStav): boolean {
  return jeCielLokalita(state, "benzinka");
}

/** most: karty sa smú vykladať len na vlastnú stranu (aj odpoveď na NA EX). */
export function lenVlastnaStrana(lokalita: string | null): boolean {
  return lokalita === "most";
}

/** druzstvo: karty s tagom Pracujúci nemíňajú limit vykladania. */
export function bezLimituPracujuci(lokalita: string | null, tagy: readonly Tag[]): boolean {
  return lokalita === "druzstvo" && tagy.includes("Pracujúci");
}

/** vinna_pivnica: koľko NA EX smie hráč dať za Pitku. */
export function naexZaPitku(state: VerejnyStav): number {
  return jeCielLokalita(state, "vinna_pivnica") ? 2 : 1;
}

/**
 * O koľko je prah Exekútora hráča p nižší (záporné = vyšší) a koľko Dlhov spáli
 * jedna Robota. v7: Obecný úrad už prah neznižuje, len Robota tam páli 2 Dlhy;
 * Záhradkár (Bitka) v línii hráča zvýši jeho prah o 2 — každý zvlášť.
 */
export function exekutorLokality(state: VerejnyStav, p?: PlayerId): { readonly zlava: number; readonly robota: number } {
  const zahradkari = p === undefined ? 0 : partiaHraca(state, p).filter((pl) => pl.card.defId === "zahradkar" && pl.zaverecna !== true).length;
  return { zlava: 0 - zahradkari * KONSTANTY.EFEKT.ZAHRADKAR_PRAH, robota: jeCielLokalita(state, "obecny_urad") ? KONSTANTY.EFEKT.URAD_ROBOTA : 1 };
}

/** Stokársky barter je o toľko lacnejší — v7 už nič (Jednota má Kšeft). */
export function barterZlavaLokality(_state: VerejnyStav): number {
  return 0;
}

/** kar (Pitka, v7): doliatie nestojí cigarety, ale pridá 1 poškodenie pečene. */
export function doliatieNaKari(state: Pick<VerejnyStav, "ciel">): boolean {
  return jeCielLokalita(state, "kar");
}

/** zberny_dvor: raz za Pitku za cigaretu karta z vlastného odhadzovacieho balíčka. */
export function vykupZoSrotu(state: VerejnyStav): boolean {
  return jeCielLokalita(state, "zberny_dvor");
}

/** cintorin: porazený smie vyložiť Nástroj z ruky do Dedičstva bez platenia. */
export function dedicstvoZaPrehru(state: VerejnyStav): boolean {
  return jeCielLokalita(state, "cintorin");
}

/** Verejný stav s poldeci hráčov — spĺňa ho GameState aj pohľad klienta. */
export interface StavPoldeci extends VerejnyStav {
  readonly hraci: readonly [VerejnyHrac & PoldeciHraca, VerejnyHrac & PoldeciHraca];
}
interface PoldeciHraca {
  readonly poldeciPlne: number;
  readonly poldeciVypite: number;
}

/**
 * Limit vykladania na začiatku Zhromaždenia tohto kola (PRAVIDLA §6) — pre
 * náhľad „limit po tomto ťahu“. `zmenaPoldeci` mení plné poldeci (−1 za
 * kartu zo šenku).
 */
export function limitZhromazdenia(state: StavPoldeci, p: PlayerId, zmenaPoldeci = 0): number {
  // Zastávka: spoločný limit oboch — súčet ich limitov.
  if (spolocnyLimit(state)) {
    return vlastnyLimitZhromazdenia(state, 0, p === 0 ? zmenaPoldeci : 0) + vlastnyLimitZhromazdenia(state, 1, p === 1 ? zmenaPoldeci : 0);
  }
  return vlastnyLimitZhromazdenia(state, p, zmenaPoldeci);
}

/** Limit hráča bez Zastávky — na Zastávke z neho platí pas (Michal 2026-10-22). */
export function vlastnyLimitZhromazdenia(state: StavPoldeci, p: PlayerId, zmenaPoldeci = 0): number {
  return limitVykladania({ poldeciPlne: Math.max(0, state.hraci[p].poldeciPlne + zmenaPoldeci) }) + limitBonus(state, p);
}

/**
 * Odhad limitu v ďalšom kole v poradí motora: poldeci na stole cez NA EX sa
 * pri bitke vypijú (vypiPoldeci), aktívne akcie Poldeci v línii otočia vypité
 * na plné a na začiatku kola sa dolejú (KONSTANTY.POLDECI_NA_ZACIATKU_KOLA).
 * Nevie o Krčmárke, doliatí cigaretami ani o budúcej Zastávke — ukazuje, s čím
 * hráč ráta, ak nič z toho nepríde. `naex` = dá teraz NA EX (na neznámu kartu;
 * kto ju pozná, pošle stav po NA EX a `naex` false). Akciu Poldeci ráta len
 * s dátami sady a so stavom, ktorý pozná otočenie lokality — predtým ju náhľad
 * vynechal a sľuboval limit o 1 nižší (playtest 20261026-173610-1).
 */
export function limitBuduceKolo(state: StavPoldeci & { readonly lokalitaOtocena?: boolean }, p: PlayerId, naex = false, data?: GameData): number {
  const h = state.hraci[p];
  // Zrážka NA EX (v5, Výtržník): druhý poldeci na karte je toho druhého hráča.
  const naStole = state.strany.flat().filter((pl) => pl.naexBy === p || pl.naexBy2 === p).length + (naex ? 1 : 0);
  // Na zdravie „do dna“ (Alkoholik v5): poldeci z toľkých NA EX, aká je sila priazne, sa po bitke
  // vráti plný (vypiPoldeci) — bez dát sady sa priazeň nepozná, náhľad ju neráta.
  const vratia = data === undefined ? 0 : Math.min(naStole, silaDoDna(data, state, p));
  const vypite = h.poldeciVypite + naStole - vratia;
  const otocia = data === undefined || state.lokalitaOtocena === undefined ? 0 : Math.min(vypite, akciePoldeci(data, state, state.lokalitaOtocena)[p]);
  const plne = h.poldeciPlne - (naex ? 1 : 0) + vratia + otocia;
  const dolieva = Math.min(KONSTANTY.POLDECI_NA_ZACIATKU_KOLA, vypite - otocia);
  return plne + dolieva + 1 + limitBonus(state, p);
}

/** Aktívne akcie Poldeci v línii — v bitke otočia toľko vypitých poldeci na plné (vypiPoldeci). */
function akciePoldeci(data: GameData, state: VerejnyStav, lokalitaOtocena: boolean): readonly [number, number] {
  const finale = state.ciel?.typ === "finale";
  const sums = evaluateLine(data, { lokalita: state.ciel?.lokalita ?? null, lokalitaOtocena, strany: state.strany, ...(finale ? { finale: true } : {}) }).sums;
  return [sums[0].Poldeci ?? 0, sums[1].Poldeci ?? 0];
}

/** Sila priazne Alkoholika („do dna“) hráča p — koľko poldeci z jeho NA EX sa za kolo vráti plných. */
export function silaDoDna(data: GameData, state: Pick<VerejnyStav, "starsi">, p: PlayerId): number {
  const e = state.starsi.find((x) => favourStarsieho(data, x) === "ALKOHOLIK" && priazenHraca(x) === p);
  return e === undefined ? 0 : priazenSila(e);
}

/**
 * vinko: nemôžeš dolievať poldeci za cigarety (Michal 2026-10-19 — predtým
 * zakazovalo stokársky barter; ten je s Vínkom povolený).
 */
export function doliatieZakazane(state: GameState, p: PlayerId): boolean {
  return vDedicstve(state, p, "vinko");
}


/** puska (Dedičstvo): prebytočné poškodenie, ktoré súper rozdeľuje proti jej majiteľovi, je menšie. */
export function prebytokProtiZlava(state: VerejnyStav, proti: PlayerId): number {
  return vDedicstve(state, proti, "puska") ? KONSTANTY.EFEKT.PUSKA_PREBYTOK : 0;
}

/** ministrant: posun markera stojí o 1 prebytočné poškodenie navyše. */
export function cenaPrebytku(state: GameState, p: PlayerId): number {
  return 1 + partiaHraca(state, p).filter((pl) => pl.card.defId === "ministrant").length;
}

/** Bitkové modifikátory závislé od kariet v hre. */
export interface BitkaMody {
  /** Dodatočné tuhé poškodenie hráča (recidivista, Svokra, Lesná cesta, Ihrisko). */
  readonly tuheBonus: number;
  /** Tuhé menej: súperova Pasca v Dedičstve, −1 za každé moje Zviera v línii (Michal 2026-10-20). */
  readonly tuheZlava: number;
  /** Z čoho sa tuheBonus skladá — pre nápovedu v paneli bitky. */
  readonly tuheZdroje: readonly { readonly zdroj: string; readonly tuhe: number }[];
  /** autobusar: ignoruj 1 Absťák. */
  readonly abstakyZlava: number;
  /** farar: ignoruj 2 súperove Povery. */
  readonly superovePoveryZlava: number;
  /** veterinar: Cirhóza pridáva o 2 poškodenia menej. */
  readonly cirhozaZlava: number;
}

/**
 * svokra (Bitka, Michal 2026-10-26 — predtým kradla cigarety za NA EX): za
 * každú kartu hráča p so súperovým NA EX — na ktorejkoľvek strane, aj pri
 * zrážke (Výtržník) — dostane súper Ranu (+1 tuhé pre p). Poldeci z NA EX
 * ležia na kartách do kroku 5 bitky, takže sa rátajú rovno zo stola; každá
 * Svokra zvlášť. Autorita — súperov Praudovravec ju umlčí.
 */
export function svokraRany(data: GameData, state: VerejnyStav, p: PlayerId): number {
  if (!efektHraca(state, p, "svokra") || efektPotlaceny(data, state, p, "svokra")) return 0;
  const opp = opponentOf(p);
  const moje = partiaHraca(state, p);
  const svokry = Math.max(1, moje.filter((pl) => pl.card.defId === "svokra" && pl.zaverecna !== true).length);
  const sNaexSupera = moje.filter((pl) => pl.naexBy === opp || pl.naexBy2 === opp).length;
  return svokry * sNaexSupera * KONSTANTY.EFEKT.SVOKRA_RANY;
}

/**
 * Traktoristky hráča p, ktoré ležia v kraji, kde má prevahu (v7, Na leasing).
 * Vo finále bez lokality kraje nie sú — prevahu tam nemá nikto.
 */
export function traktoristkySPrevahou(data: GameData, state: Pick<VerejnyStav, "strany" | "ciel">, p: PlayerId): number {
  if (state.ciel?.lokalita == null) return 0;
  const prevaha = prevahaStran(data, state.strany);
  let n = 0;
  for (const strana of [0, 1] as const) {
    for (const pl of state.strany[strana]) if (pl.card.defId === "traktoristka" && pl.playedBy === p && pl.zaverecna !== true && prevaha[strana] === p) n++;
  }
  return n;
}

/** Traktoristky hráča p bez prevahy v ich kraji — každá mu v bitke dá Dlh. */
export function traktoristkyBezPrevahy(data: GameData, state: Pick<VerejnyStav, "strany" | "ciel">, p: PlayerId): number {
  const vsetky = partiaHraca(state, p).filter((pl) => pl.card.defId === "traktoristka" && pl.zaverecna !== true).length;
  return vsetky - traktoristkySPrevahou(data, state, p);
}

/** lievik (Dedičstvo, v7): NA EX smie hráč dať aj na Zviera. */
export function naexNaZviera(state: VerejnyStav, p: PlayerId): boolean {
  return vDedicstve(state, p, "lievik");
}

export function bitkaMody(data: GameData, state: VerejnyStav, p: PlayerId): BitkaMody {
  const opp = opponentOf(p);
  const tuheZdroje: { zdroj: string; tuhe: number }[] = [];
  const pridaj = (zdroj: string, tuhe: number): void => {
    if (tuhe > 0) tuheZdroje.push({ zdroj, tuhe });
  };

  // recidivista: za každého súperovho zahraničného dodatočná rana
  if (vPartii(state, p, "recidivista")) {
    pridaj("recidivista", partiaHraca(state, opp).filter((pl) => defOf(data, pl.card).tags.includes("Zahraničný")).length);
  }
  // pes (Michal 2026-10-20): +1 tuhé za každý pár akcií na spoji Psa so súperovou kartou.
  pridaj("pes", spojePsa(data, state.strany, state.ciel?.typ === "finale" && state.ciel.lokalita === null)[p]);
  pridaj("svokra", svokraRany(data, state, p));
  // Rátajú sa tie isté karty ako do prevahy: Občania, Zvieratá, Starešinovia.
  const doPrevahy = (pl: PlacedCard): boolean => rataSaDoPrevahy(defOf(data, pl.card).tags);
  // lesna_cesta (v7, Michal 2026-10-27): +1 tuhé za každé svoje Zviera v súperovom kraji, bez stropu (7.5 body 1–2).
  if (jeCielLokalita(state, "lesna_cesta")) {
    pridaj("lesna_cesta", state.strany[opp].filter((pl) => pl.playedBy === p && pl.zaverecna !== true && defOf(data, pl.card).tags.includes("Zviera")).length);
  }
  const mojeKarty = partiaHraca(state, p).filter((pl) => pl.zaverecna !== true);
  const pocetKariet = (defId: string): number => mojeKarty.filter((pl) => pl.card.defId === defId).length;
  // sofer (v7): bez NA EX v tomto kole udelí Pecku navyše (2 tuhé).
  if (state.naexVKole?.[p] !== true) pridaj("sofer", 2 * pocetKariet("sofer"));
  // traktoristka (v7, Na leasing): s prevahou v jej kraji Pecka navyše; bez nej Dlh (engine, začiatok bitky).
  pridaj("traktoristka", 2 * traktoristkySPrevahou(data, state, p));
  // vymahac (v7): za každé 2 priznané Dlhy majiteľa 1 Rana navyše.
  const dlhy = state.hraci[p].priznane.filter((k) => k.defId === "dlh").length;
  pridaj("vymahac", pocetKariet("vymahac") * Math.floor(dlhy / 2));
  // vidly (Dedičstvo, v7): +1 tuhé, kým má hráč menej špakov ako súper.
  if (vDedicstve(state, p, "vidly") && state.spaky !== undefined && state.spaky[p] < state.spaky[opp]) pridaj("vidly", 1);
  // stryko_z_ameriky (Kšeft, v7): Rany kúpené v Pitkách tohto kola.
  pridaj("stryko_z_ameriky", state.kseftRany?.[p] ?? 0);
  // ihrisko (Michal 2026-10-20): v každom kraji +2 tuhé tomu, kto tam má viac svojich Občanov, Zvierat a Starešinov.
  if (jeCielLokalita(state, "ihrisko")) {
    for (const strana of state.strany) {
      const moje = strana.filter((pl) => pl.playedBy === p && doPrevahy(pl)).length;
      const jeho = strana.filter((pl) => pl.playedBy === opp && doPrevahy(pl)).length;
      if (moje > jeho) pridaj("ihrisko", KONSTANTY.EFEKT.IHRISKO_TUHE);
    }
  }

  return {
    tuheBonus: tuheZdroje.reduce((a, z) => a + z.tuhe, 0),
    tuheZdroje,
    tuheZlava: vDedicstve(state, opp, "pasca") ? partiaHraca(state, p).filter((pl) => defOf(data, pl.card).tags.includes("Zviera")).length : 0,
    abstakyZlava: efektHraca(state, p, "autobusar") ? KONSTANTY.EFEKT.AUTOBUSAR_ABSTAKY : 0,
    superovePoveryZlava: efektHraca(state, p, "farar") ? KONSTANTY.EFEKT.FARAR_POVERY : 0,
    cirhozaZlava: efektHraca(state, opp, "veterinar") ? KONSTANTY.EFEKT.VETERINAR_CIRHOZA : 0,
  };
}

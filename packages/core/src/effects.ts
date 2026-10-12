// Register efektov kariet (M10).
//
// Žiadne DSL — jedna malá funkcia na kartu, zavesená na konkrétny háčik
// motora. Neimplementovaný efekt nie je blokujúci: karta beží v režime
// MANUAL — motor ju v správnej fáze pripomenie v logu a hráči ju vyhodnotia
// sami. Register MUSÍ pokrývať všetkých 50 id (kontroluje to test).

import type { PlayerId, Tag } from "./types.ts";
import { opponentOf } from "./types.ts";
import type { GameData } from "./data.ts";
import { defOf } from "./data.ts";
import type { GameState } from "./engine.ts";
import type { ElderState } from "./elders.ts";
import { prebudenyPre } from "./elders.ts";
import type { CardInstance } from "./types.ts";
import type { PlacedCard } from "./partia.ts";

/**
 * Verejná časť stavu, z ktorej čítajú efekty ovplyvňujúce bitku a prahy.
 * Spĺňa ju GameState aj ClientState — klient z nej počíta živý odhad
 * poškodenia rovnakým kódom ako server.
 */
export interface VerejnyStav {
  readonly ciel: GameState["ciel"];
  readonly ovladnute: GameState["ovladnute"];
  readonly strany: GameState["strany"];
  readonly starsi: readonly ElderState[];
  readonly hraci: readonly [VerejnyHrac, VerejnyHrac];
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
  autobusar: "impl", // Bitka: ignoruj trocha absťákov
  benzinka: "impl", // Bitka: súčet Cigaretiek > 7 → zahodenie občanov
  cigorky: "impl", // Dedičstvo: žiadny refill; pred bitkou cigareta za aktívnu Cigaretku
  kocovnik: "native", // Nástup: do súperovej partie bez limitu vykladania (návrh 2026-10-11)
  cirhoza: "native", // Bitka: dodatočná rana od súpera (cirhozaBonus)
  dievcina_na_vydaj: "impl", // Bitka: zahodenie + dlhy podľa aktívnych akcií
  dlh: "native", // Bitka: krok Exekútora
  farar: "impl", // Bitka: ignoruj trocha povier súpera
  financna_poradkyna: "impl", // Prestávka: jej Dlhy dostávajú obaja hráči
  hasic: "impl", // Nástup: Pracujúci občan z odhadzovacieho do ruky
  hrobar: "impl", // Furt: cigareta, keď súper zahodí kartu
  ihrisko: "impl", // Furt: prah Cirhózy +1
  krcma: "impl", // Pitka: povinný NA EX (bez NA EX sa Pitka neskončí)
  krcmarka: "impl", // Bitka: voliteľné otočenie poldecáka
  lesna_cesta: "impl", // Pitka: NA EX zahodí absťák
  liberal: "impl", // Furt: 2× akcie pri rovnosti pohlaví; Furt: nevie NA EX
  milujuca_manzelka: "impl", // Furt: o cigaretu menej
  ministrant: "impl", // Výhra: posun markera stojí +1 prebytku
  nealko: "impl", // Dedičstvo: Poldeci/NA EX bez pečene; Poldeci nedopĺňa
  niekoho_stryna: "impl", // Nástup: zahoď trocha Cirhóz z ruky
  noviny: "impl", // Dedičstvo: tvoje povery a súperova viera sa nerušia
  pasca: "impl", // Dedičstvo: obmedzenie dáva súperovi pecku
  pijan: "impl", // Bitka: rana do vlastnej partie pri žene s aktívnym poldeci
  policajtka: "impl", // Nástup: preskúmaj a rozdeľ doberací balíček (voľba hráča)
  postarka: "impl", // Pitka: voliteľné doberanie s dlhmi
  praudovravec: "impl", // Furt: Autority v tvojej partii neuplatňujú efekt
  puska: "impl", // Dedičstvo: pohoršenia proti tebe neplatia; tvoje povery nič
  recidivista: "impl", // Bitka: rana za zahraničného v súperovej partii
  silna_nezavisla_zena: "impl", // Furt: akcie len s podporou dvoch chlapov
  starosta: "impl", // Pitka: výmena karty za cigaretu
  svaty_text: "impl", // Dedičstvo: Viera chráni pred mäkkým
  veterinar: "impl", // Bitka: Cirhóza pridáva o zopár menej
  veteran: "impl", // Bitka: pozičné vypínanie strán
  velmi_smutiaca_vdova: "impl", // Nástup: muž navrchu súperovho balíčka preč
  vestica: "impl", // Prehra: výmena kariet v balíčkoch
  vychovavatelka: "impl", // Zhromaždenie: NA EX → súper berie priznaný dlh
  vinko: "impl", // Dedičstvo: poldeci navyše; žiadny barter
  vyherny_automat: "impl", // Dedičstvo: výhra páli dlhy, prehra dlh dáva
  zastavka: "impl", // Zhromaždenie: hrajú sa 2 karty bez ohľadu na poldeci
  zberny_dvor: "impl", // Pitka: o trocha menej dlhov
  zamocnik: "impl", // Furt: akcie nástrojov v okolí posilnené
  zivnostnik: "impl", // Nástup: zahoď súperovo dedičstvo
  abstak: "native", // Bitka: o ranu menej (−1 tuhé za kus)
  pes: "impl", // Furt: nikdy v partii s iným zvieraťom
  kostol: "impl", // Zhromaždenie: karta za aktívnu Vieru; Bitka: povery neplatia
  zahradkar: "impl", // Exekúcia: smie ísť namiesto náradia
  svokra: "impl", // Nástup: súper v najbližšej Pitke nesmie dať NA EX (pravidlá v3)
  sarlatan: "impl", // Furt: Viera v okolí platí ako Vízia
  podvodnik: "impl", // Prehra: ukradni trocha cigariet
  cierna_macka: "impl", // Pitka: súperove Vízie neplatia
};

export function jeEfektManual(defId: string): boolean {
  return (REGISTER[defId] ?? "manual") === "manual";
}

/**
 * kocovnik: do súperovej partie nastupuje bez limitu vykladania. Do súperovej
 * partie smie od pravidiel v3 každá karta — Kočovník dostal tento efekt
 * namiesto pôvodného (návrh, text karty treba upraviť v tvorcovi).
 */
export function bezLimituVykladania(defId: string, ciel: "vlastna" | "superova"): boolean {
  return defId === "kocovnik" && ciel === "superova";
}

// ---------------------------------------------------------------------------
// Kde sa efekt nachádza a komu patrí

/** Furt na lokalite platí, kým je odhalená: cieľ kola alebo už ovládnutá. */
export function lokalitaVHre(state: VerejnyStav, defId: string): boolean {
  if (state.ciel?.typ === "lokalita" && state.ciel.lokalita?.defId === defId) return true;
  return state.ovladnute.some((o) => o.karta.defId === defId);
}

/** Lokalita aktuálneho kola. */
export function jeCielLokalita(state: VerejnyStav, defId: string): boolean {
  return state.ciel?.typ === "lokalita" && state.ciel.lokalita?.defId === defId;
}

/**
 * Karty hráča p v línii — tie, ktoré zahral a sú natočené k nemu, v jeho aj
 * v súperovej partii. Akcie aj efekty karty patria jej majiteľovi; „tvoja
 * partia“ v texte karty znamená tvoje karty (pravidlá v3).
 */
export function partiaHraca(state: { readonly strany: VerejnyStav["strany"] }, p: PlayerId): PlacedCard[] {
  return [...state.strany[0], ...state.strany[1]].filter((pl) => pl.playedBy === p);
}

/** Hráč p má v línii kartu defId (natočenú k sebe, v ktorejkoľvek partii). */
export function vPartii(state: VerejnyStav, p: PlayerId, defId: string): boolean {
  return partiaHraca(state, p).some((pl) => pl.card.defId === defId);
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
 * Praudovravec: Autority v tvojej partii neuplatňujú efekt. Kontroluje sa
 * pri každom efekte karty s tagom Autorita, ktorej majiteľom je hráč p.
 */
export function efektPotlaceny(data: GameData, state: GameState, p: PlayerId, defId: string): boolean {
  const def = data.cards.get(defId);
  if (def === undefined || !def.tags.includes("Autorita" as Tag)) return false;
  return vPartii(state, p, "praudovravec");
}

// ---------------------------------------------------------------------------
// Háčiky — motor ich volá na presne určených miestach

/** ihrisko: prah Cirhózy je o 1 vyšší (platí obom hráčom). */
export function prahCirhozyBonus(state: VerejnyStav): number {
  return lokalitaVHre(state, "ihrisko") ? 1 : 0;
}

/** nealko: Poldeci ani NA EX neprispievajú k prahu cirhózy. */
export function pecenSaNepocita(
  state: GameState,
  p: PlayerId,
  zdroj: "pecen" | "poldeci" | "naex",
): boolean {
  return zdroj !== "pecen" && vDedicstve(state, p, "nealko");
}

/** nealko: akcia Poldecko neotáča vypité poldeci. */
export function poldeckoNedopina(state: GameState, p: PlayerId): boolean {
  return vDedicstve(state, p, "nealko");
}

/** vinko: počíta sa ako nevypitý poldeci navyše (limit vykladania +1). */
export function limitBonus(state: GameState, p: PlayerId): number {
  return vDedicstve(state, p, "vinko") ? 1 : 0;
}

/** zastavka: hráči hrajú 2 karty bez ohľadu na poldecáky. */
export function limitOverride(state: GameState): number | null {
  return jeCielLokalita(state, "zastavka") ? 2 : null;
}

/** vinko: nemôžeš vykonať stokársky barter. */
export function barterZakazany(state: GameState, p: PlayerId): boolean {
  return vDedicstve(state, p, "vinko");
}

/** cigorky: nemôžeš otočiť poldeci za cigarety. */
export function refillZakazany(state: GameState, p: PlayerId): boolean {
  return vDedicstve(state, p, "cigorky");
}

/** lesna_cesta: ak dáš NA EX, zahoď absťák. */
export function naexPaliAbstak(state: GameState): boolean {
  return jeCielLokalita(state, "lesna_cesta");
}

/** cierna_macka: súperove Vízie neplatia. */
export function vizieNeplatia(state: GameState, p: PlayerId): boolean {
  return vPartii(state, opponentOf(p), "cierna_macka");
}

/** kostol: povery v tejto lokalite neplatia (obom). puska: tvoje nie. */
export function poveryNeplatia(state: VerejnyStav, p: PlayerId): boolean {
  return jeCielLokalita(state, "kostol") || vDedicstve(state, p, "puska");
}

/** puska: súperove Pohoršenia proti tebe neplatia. */
export function pohorseniaNeplatia(state: GameState, proti: PlayerId): boolean {
  return vDedicstve(state, proti, "puska");
}

/** noviny (hráča p): p-ho povery a súperova viera sa navzájom nerušia. */
export function poveraVieraSaNerusia(state: VerejnyStav, p: PlayerId): boolean {
  return vDedicstve(state, p, "noviny");
}

/** kostol: hráč s aktívnou Vierou si dobral kartu (v kroku ťahania). */
export function kartaZaVieru(state: GameState): boolean {
  return jeCielLokalita(state, "kostol");
}

/** zberny_dvor: hráči generujú o trocha menej dlhov. */
export function dlhovMenej(state: GameState, trocha: number): number {
  return jeCielLokalita(state, "zberny_dvor") ? trocha : 0;
}

/** ministrant: posun markera stojí o 1 prebytočné poškodenie navyše. */
export function cenaPrebytku(state: GameState, p: PlayerId): number {
  return 1 + partiaHraca(state, p).filter((pl) => pl.card.defId === "ministrant").length;
}

/** Bitkové modifikátory závislé od kariet v hre. */
export interface BitkaMody {
  /** Dodatočné tuhé poškodenie hráča (recidivista). */
  readonly tuheBonus: number;
  /** autobusar: ignoruj trocha absťákov. */
  readonly abstakyZlava: number;
  /** farar: ignoruj trocha povier súpera. */
  readonly superovePoveryZlava: number;
  /** veterinar: Cirhóza pridáva o zopár poškodenia menej. */
  readonly cirhozaZlava: number;
}

export function bitkaMody(
  data: GameData,
  state: VerejnyStav,
  p: PlayerId,
  trocha: number,
  zopar: number,
): BitkaMody {
  const opp = opponentOf(p);
  let tuheBonus = 0;

  // recidivista: za každého súperovho zahraničného dodatočná rana
  if (vPartii(state, p, "recidivista")) {
    tuheBonus += partiaHraca(state, opp).filter((pl) =>
      defOf(data, pl.card).tags.includes("Zahraničný"),
    ).length;
  }

  return {
    tuheBonus,
    abstakyZlava: efektHraca(state, p, "autobusar") ? trocha : 0,
    superovePoveryZlava: efektHraca(state, p, "farar") ? trocha : 0,
    cirhozaZlava: efektHraca(state, opp, "veterinar") ? zopar : 0,
  };
}

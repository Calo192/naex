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
import { prebudenyPre } from "./elders.ts";

/**
 * native — pravidlo zabudované priamo v motore (nie je čo pripomínať)
 * impl   — efekt implementovaný v tomto súbore cez háčiky motora
 * manual — bez implementácie; motor ho pripomína v logu
 */
export type EfektStatus = "native" | "impl" | "manual";

export const REGISTER: Readonly<Record<string, EfektStatus>> = {
  autobusar: "impl", // Bitka: ignoruj trocha absťákov
  benzinka: "manual", // Bitka: súčet Cigaretiek > 7 → zahodenie občanov
  cigorky: "impl", // Dedičstvo: žiadny refill; pred bitkou cigareta za aktívnu Cigaretku
  kocovnik: "native", // Nástup: smie do súperovej partie
  cirhoza: "native", // Bitka: dodatočná rana od súpera (cirhozaBonus)
  dievcina_na_vydaj: "manual", // Bitka: zahodenie + dlhy podľa aktívnych akcií
  dlh: "native", // Bitka: krok Exekútora
  farar: "impl", // Bitka: ignoruj trocha povier súpera
  financna_poradkyna: "impl", // Prestávka: jej Dlhy dostávajú obaja hráči
  hasic: "impl", // Nástup: Pracujúci občan z odhadzovacieho do ruky
  hrobar: "manual", // Furt: cigareta, keď súper zahodí kartu
  ihrisko: "impl", // Furt: prah Cirhózy +1
  krcma: "manual", // Pitka: povinný NA EX; Bitka: poldeci sa otočia
  krcmarka: "manual", // Bitka: voliteľné otočenie poldecáka
  lesna_cesta: "impl", // Pitka: NA EX zahodí absťák
  liberal: "manual", // Bitka: 2× akcie pri rovnosti pohlaví; nevie NA EX
  milujuca_manzelka: "manual", // Furt: o cigaretu menej
  ministrant: "impl", // Výhra: posun markera stojí +1 prebytku
  nealko: "impl", // Dedičstvo: Poldeci/NA EX bez pečene; Poldeci nedopĺňa
  niekoho_stryna: "impl", // Nástup: zahoď trocha Cirhóz
  noviny: "impl", // Dedičstvo: tvoje povery a súperova viera sa nerušia
  pasca: "manual", // Dedičstvo: obmedzenie dáva súperovi pecku
  pijan: "manual", // Bitka: rana do vlastnej partie pri žene v okolí
  policajtka: "impl", // Nástup: kriminálnik v súperovej ruke → súper berie dlh
  postarka: "manual", // Pitka: voliteľné doberanie s dlhmi
  praudovravec: "impl", // Furt: Autority v tvojej partii neuplatňujú efekt
  puska: "impl", // Dedičstvo: pohoršenia proti tebe neplatia; tvoje povery nič
  recidivista: "impl", // Bitka: +1 za zahraničného v súperovej partii
  silna_nezavisla_zena: "manual", // Furt: akcie len s podporou dvoch chlapov
  starosta: "manual", // Pitka: výmena karty za cigaretu
  svaty_text: "manual", // Dedičstvo: Viera chráni pred mäkkým
  veterinar: "impl", // Bitka: Cirhóza pridáva o zopár menej
  veteran: "manual", // Bitka: pozičné vypínanie strán
  velmi_smutiaca_vdova: "impl", // Nástup: muž navrchu súperovho balíčka preč
  vestica: "manual", // Prehra: výmena kariet v balíčkoch
  vychovavatelka: "manual", // Zhromaždenie: NA EX → súper berie priznaný dlh
  vinko: "impl", // Dedičstvo: poldeci navyše; žiadny barter
  vyherny_automat: "impl", // Dedičstvo: výhra páli dlhy, prehra dlh dáva
  zastavka: "impl", // Zhromaždenie: hrajú sa 2 karty bez ohľadu na poldeci
  zberny_dvor: "impl", // Pitka: o trocha menej dlhov
  zamocnik: "manual", // Furt: nástroje v okolí posilnené
  zivnostnik: "impl", // Nástup: zahoď súperovo dedičstvo
  abstak: "manual", // native −1 tuhé; texty navyše sa pripomínajú
  pes: "impl", // Nástup: len vedľa občana; Bitka: rana pri chlapovi
  kostol: "impl", // Zhromaždenie: karta za aktívnu Vieru; Bitka: povery neplatia
  polovnik: "manual", // Furt: Petelica +1 v okolí; ignoruje zvieratá
  svokra: "manual", // Furt: pohoršenia 2× pri mužovi
  sarlatan: "manual", // Bitka: absťák za pečeň; Vízie ako Viera
  podvodnik: "impl", // Výhra: zahoď 2 dlhy; Prehra: ukradni cigaretu
  cierna_macka: "impl", // Furt: súperove Vízie neplatia; Bitka: rana za prah
};

export function jeEfektManual(defId: string): boolean {
  return (REGISTER[defId] ?? "manual") === "manual";
}

/** Karty, ktoré smú nastúpiť do súperovej partie. */
export function mozeDoSuperovejPartie(defId: string): boolean {
  return defId === "kocovnik";
}

// ---------------------------------------------------------------------------
// Kde sa efekt nachádza a komu patrí

/** Furt na lokalite platí, kým je odhalená: cieľ kola alebo už ovládnutá. */
export function lokalitaVHre(state: GameState, defId: string): boolean {
  if (state.ciel?.typ === "lokalita" && state.ciel.lokalita?.defId === defId) return true;
  return state.ovladnute.some((o) => o.karta.defId === defId);
}

/** Lokalita aktuálneho kola. */
export function jeCielLokalita(state: GameState, defId: string): boolean {
  return state.ciel?.typ === "lokalita" && state.ciel.lokalita?.defId === defId;
}

export function vPartii(state: GameState, p: PlayerId, defId: string): boolean {
  return state.partie[p].some((pl) => pl.card.defId === defId);
}

export function vDedicstve(state: GameState, p: PlayerId, defId: string): boolean {
  return state.hraci[p].dedicstvo.some((k) => k.defId === defId);
}

/**
 * Efekt „patrí“ hráčovi p: karta leží v jeho partii, v jeho Dedičstve,
 * alebo je to prebudený starší vydesený hráčom p.
 */
export function efektHraca(state: GameState, p: PlayerId, defId: string): boolean {
  if (vPartii(state, p, defId) || vDedicstve(state, p, defId)) return true;
  return state.starsi.some((e) => e.karta.defId === defId && prebudenyPre(e) === p);
}

/**
 * Praudovravec: Autority v tvojej partii neuplatňujú efekt. Kontroluje sa
 * pri každom efekte karty s tagom Autorita ležiacej v partii p.
 */
export function efektPotlaceny(data: GameData, state: GameState, p: PlayerId, defId: string): boolean {
  const def = data.cards.get(defId);
  if (def === undefined || !def.tags.includes("Autorita" as Tag)) return false;
  return vPartii(state, p, "praudovravec");
}

// ---------------------------------------------------------------------------
// Háčiky — motor ich volá na presne určených miestach

/** ihrisko: prah Cirhózy je o 1 vyšší (platí obom hráčom). */
export function prahCirhozyBonus(state: GameState): number {
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
export function poveryNeplatia(state: GameState, p: PlayerId): boolean {
  return jeCielLokalita(state, "kostol") || vDedicstve(state, p, "puska");
}

/** puska: súperove Pohoršenia proti tebe neplatia. */
export function pohorseniaNeplatia(state: GameState, proti: PlayerId): boolean {
  return vDedicstve(state, proti, "puska");
}

/** noviny (hráča p): p-ho povery a súperova viera sa navzájom nerušia. */
export function poveraVieraSaNerusia(state: GameState, p: PlayerId): boolean {
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
  return 1 + state.partie[p].filter((pl) => pl.card.defId === "ministrant").length;
}

/** Bitkové modifikátory závislé od kariet v hre. */
export interface BitkaMody {
  /** Dodatočné tuhé poškodenie hráča (recidivista, pes, cierna_macka). */
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
  state: GameState,
  p: PlayerId,
  trocha: number,
  zopar: number,
): BitkaMody {
  const opp = opponentOf(p);
  let tuheBonus = 0;

  // recidivista: za každého Zahraničného v súperovej partii dodatočné poškodenie
  if (vPartii(state, p, "recidivista")) {
    tuheBonus += state.partie[opp].filter((pl) =>
      defOf(data, pl.card).tags.includes("Zahraničný"),
    ).length;
  }
  // pes: ak je v tvojej partii chlap, udelí súperovi Ranu
  if (vPartii(state, p, "pes")) {
    const maChlapa = state.partie[p].some(
      (pl) => pl.card.defId !== "pes" && defOf(data, pl.card).tags.includes("Chlap"),
    );
    if (maChlapa) tuheBonus += 1;
  }
  // cierna_macka: ak súper v tomto kole prekročil prah cirhózy, dodatočná Rana
  if (vPartii(state, p, "cierna_macka")) {
    tuheBonus += state.cirhozyVKole[opp];
  }

  return {
    tuheBonus,
    abstakyZlava: efektHraca(state, p, "autobusar") ? trocha : 0,
    superovePoveryZlava: efektHraca(state, p, "farar") ? trocha : 0,
    cirhozaZlava: efektHraca(state, opp, "veterinar") ? zopar : 0,
  };
}

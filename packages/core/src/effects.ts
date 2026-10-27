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
import { rataSaDoPrevahy, spojePsa } from "./partia.ts";
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
  autobusar: "impl", // Bitka: ignoruj 1 Absťák
  benzinka: "impl", // Zhromaždenie + Pitka: nikto nesmie fajčiť (Michal 2026-10-20)
  cigorky: "impl", // Dedičstvo: žiadny refill; v každej Pitke cigareta navyše
  kocovnik: "native", // Furt: jeho akcie sa počítajú hráčovi s prevahou v jeho kraji (Michal 2026-10-24; evaluateLine)
  cirhoza: "native", // Bitka: dodatočná rana od súpera (cirhozaBonus)
  dievcina_na_vydaj: "impl", // Bitka: zahodenie + dlhy podľa aktívnych akcií
  dlh: "native", // Bitka: krok Exekútora
  farar: "impl", // Bitka: ignoruj 2 súperove Povery
  financna_poradkyna: "impl", // Pitka: Dlh z jej akcií dostáva súper, nie jej majiteľ (Michal 2026-10-18; spúšťač z Prestávky 2026-10-24)
  hasic: "impl", // Nástup: Pracujúci občan z odhadzovacieho do ruky
  hrobar: "impl", // Furt: cigareta, keď súper zahodí kartu
  ihrisko: "impl", // Bitka: v každom kraji +2 tuhé tomu, kto tam má viac svojich Občanov, Zvierat a Starešinov (Michal 2026-10-20)
  krcma: "impl", // Pitka: s plným poldeci povinný NA EX (bez NA EX sa Pitka neskončí); prah Cirhózy +2
  krcmarka: "impl", // Bitka: otočenie vypitého poldeci
  lesna_cesta: "impl", // Bitka: +1 tuhé za každého svojho Občana, Zviera či Starešinu v súperovom kraji, najviac 2 (Michal 2026-10-20)
  liberal: "impl", // Furt: 2× akcie pri rovnosti pohlaví; Furt: nevie NA EX
  milujuca_manzelka: "impl", // Furt: Absťák aj pri rovnakom počte nerestí (Michal 2026-10-19)
  ministrant: "impl", // Výhra: posun markera stojí +1 prebytku
  nealko: "impl", // Dedičstvo: Poldeci/NA EX bez pečene; Poldeci nedopĺňa
  niekoho_stryna: "impl", // Nástup: zahoď 1 Cirhózu alebo 1 Dlh z ruky
  noviny: "impl", // Dedičstvo (v6): po vyhratej bitke (pri sekere obom) +1 špak, keď sa ťa bojí viac starších ako súpera (engine.ts)
  pasca: "impl", // Dedičstvo: každé súperovo Zviera v línii mu uberie 1 tuhé (Michal 2026-10-20)
  pijan: "impl", // Bitka: rana do vlastnej partie pri žene s aktívnym poldeci
  policajtka: "impl", // Nástup: preskúmaj a rozdeľ doberací balíček (voľba hráča)
  postarka: "impl", // Pitka: voliteľné doberanie s dlhmi
  praudovravec: "impl", // Furt: Autority v tvojej partii neuplatňujú efekt
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
  zahradkar: "impl", // Exekúcia (v6): smieš ho zahodiť namiesto špakov, Dlhy zhoria aj tak (príkaz zahradkar)
  svokra: "impl", // Furt: za každé NA EX súpera mu ukradni 2 cigarety (Michal 2026-10-19)
  sarlatan: "impl", // Furt: Viera v okolí platí ako Vízia
  podvodnik: "impl", // Prehra: ukradni 2 cigarety
  cierna_macka: "impl", // Furt: tvoje Povery dávajú mäkké poškodenie aj bez súperových priznaných Dlhov
  anonymny_alkoholik: "impl", // Furt: súper naňho nedá NA EX
  // Roadmapa #71 (2026-10-23).
  sofer: "impl", // Furt: NA EX na susednú kartu nezdvojí jej neaktívne akcie (partia.ts)
  snubenica: "impl", // Nástup (do 2026-10-23 Ujo s fúrikom): vedľa karty s NA EX ju vráti majiteľovi do ruky a zaujme jej miesto
  // Nové lokality (Michal 2026-10-20, docs/playtesty/navrh-lokality.html).
  most: "impl", // Zhromaždenie: karty len na vlastnú stranu
  cintorin: "impl", // Prehra: Nástroj z ruky do Dedičstva bez platenia
  obecny_urad: "impl", // Bitka: prah Exekútora −4, Robota spáli 2 priznané Dlhy
  jednota: "impl", // Pitka: stokársky barter o 1 cigaretu lacnejší
  kulturny_dom: "impl", // Bitka (v6): prebytok sa nerozdeľuje — držiteľ dostane toľko špakov
  vinna_pivnica: "impl", // Pitka: NA EX až dvakrát
  druzstvo: "impl", // Zhromaždenie: Pracujúci nemíňajú limit vykladania
  kar: "impl", // Bitka: každý smie zahodiť jednu nepriznanú Cirhózu z ruky (roadmapa #80)
};

export function jeEfektManual(defId: string): boolean {
  return (REGISTER[defId] ?? "manual") === "manual";
}

// ---------------------------------------------------------------------------
// Kde sa efekt nachádza a komu patrí

/** Lokalita aktuálneho kola. */
export function jeCielLokalita(state: Pick<VerejnyStav, "ciel">, defId: string): boolean {
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
  return vPartii(state, opponentOf(p), "praudovravec");
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

/** obecny_urad: o koľko je prah Exekútora nižší a koľko Dlhov odhodí jedna Robota. */
export function exekutorLokality(state: VerejnyStav): { readonly zlava: number; readonly robota: number } {
  return jeCielLokalita(state, "obecny_urad") ? { zlava: KONSTANTY.EFEKT.URAD_PRAH_EXEKUTORA, robota: KONSTANTY.EFEKT.URAD_ROBOTA } : { zlava: 0, robota: 1 };
}

/** jednota: stokársky barter je o toľko lacnejší. */
export function barterZlavaLokality(state: VerejnyStav): number {
  return jeCielLokalita(state, "jednota") ? 1 : 0;
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
 * Odhad limitu v ďalšom kole: poldeci na stole cez NA EX sa pri bitke
 * vypijú, na začiatku kola sa dolejú (KONSTANTY.POLDECI_NA_ZACIATKU_KOLA).
 * Nevie o akcii Poldeci, Krčmárke, doliatí cigaretami ani o budúcej Zastávke —
 * ukazuje, s čím hráč ráta, ak nič z toho nepríde. `naex` = dá teraz NA EX.
 */
export function limitBuduceKolo(state: StavPoldeci, p: PlayerId, naex = false, data?: GameData): number {
  const h = state.hraci[p];
  // Zrážka NA EX (v5, Výtržník): druhý poldeci na karte je toho druhého hráča.
  const naStole = state.strany.flat().filter((pl) => pl.naexBy === p || pl.naexBy2 === p).length + (naex ? 1 : 0);
  // Na zdravie „do dna“ (Alkoholik v5): poldeci z toľkých NA EX, aká je sila priazne, sa po bitke
  // vráti plný (vypiPoldeci) — bez dát sady sa priazeň nepozná, náhľad ju neráta.
  const vratia = data === undefined ? 0 : Math.min(naStole, silaDoDna(data, state, p));
  const plne = h.poldeciPlne - (naex ? 1 : 0) + vratia;
  const dolieva = Math.min(KONSTANTY.POLDECI_NA_ZACIATKU_KOLA, h.poldeciVypite + naStole - vratia);
  return plne + dolieva + 1 + limitBonus(state, p);
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


/** policajtka (Furt): súperove Pohoršenia proti jej majiteľovi neplatia. */
export function pohorseniaNeplatia(data: GameData, state: VerejnyStav, proti: PlayerId): boolean {
  return efektHraca(state, proti, "policajtka") && !efektPotlaceny(data, state, proti, "policajtka");
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
  /** Dodatočné tuhé poškodenie hráča (recidivista, Lesná cesta, Ihrisko). */
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
  pridaj("pes", spojePsa(data, state.strany, state.ciel?.typ === "finale")[p]);
  // Rátajú sa tie isté karty ako do prevahy: Občania, Zvieratá, Starešinovia.
  const doPrevahy = (pl: PlacedCard): boolean => rataSaDoPrevahy(defOf(data, pl.card).tags);
  // lesna_cesta (Michal 2026-10-20): +1 tuhé za každú svoju kartu na súperovej strane, najviac 2.
  if (jeCielLokalita(state, "lesna_cesta")) {
    pridaj("lesna_cesta", Math.min(KONSTANTY.EFEKT.LESNA_CESTA_MAX, state.strany[opp].filter((pl) => pl.playedBy === p && doPrevahy(pl)).length));
  }
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

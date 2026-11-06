// Offline protihráč (NPC) — klasická herná „AI“: heuristiky a krátky výpočet
// dopredu, žiadny jazykový model.
//
// Ako rozmýšľa:
//  - hodnotaStavu() ohodnotí stav z pohľadu hráča: odhad konečných špakov
//    (v6: špaky v popolníku a strach starších × bitky, ktoré ešte prídu;
//    jednoduchá forma, ladenie robí bot-tréner), postup k vydeseniu, priazne
//    v bitkách, ktoré ešte prídu, zdroje
//    (poldeci, cigarety, ruka, Absťáky, Dlhy) a odhad prebiehajúcej bitky
//    (tuhé poškodenie z línie → šanca na výhru × čo je v stávke),
//  - pri vykladaní, NA EX, hádke a Nakladačke si zahrá
//    dopredu na kópii stavu tým istým jadrom (apply, evaluateLine): po svojom
//    ťahu dohrá Zhromaždenie, v ktorom obaja vykladajú chamtivo,
//  - drobné voľby (draft, fajčenie, priznanie, limit ruky…) robí pravidlami,
//  - cigarety, ruku a poldeci ráta ako špaky vo finále (uzitokRuky, uzitokCigariet, uzitokPoldeci):
//    finále platí 1 špak za bod Nakladačky bez stropu, vedúci bez rezervy ho prehrá.
//
// Férovosť: bot beží na serveri a dostane celý GameState, ale skôr než
// začne počítať, skryté informácie zamieša (zahmliStav): súperova ruka sa
// náhodne vytiahne zo všetkých jeho skrytých kariet a poradie všetkých
// doberacích balíčkov sa zamieša. Vie teda len to, čo by si zapamätal
// pozorný hráč pri stole (ktoré karty súper vlastní), nie čo drží v ruke,
// ani čo si kto dobere.
//
// Čisté a deterministické ako zvyšok jadra — náhoda ide zo semienka, ktoré
// dá volajúci (server).

import type { Action, CardInstance, Favour, PlayerId } from "./types.ts";
import { ALL_FAVOURS, opponentOf } from "./types.ts";
import type { GameData } from "./data.ts";
import { defOf, printedSides } from "./data.ts";
import type { RngState } from "./rng.ts";
import { rngInt, rngNext, rngSeed, rngShuffle } from "./rng.ts";
import { evaluateLine } from "./partia.ts";
import { KONSTANTY, vazniNaVyhru } from "./constants.ts";
import { abstakyVBitke, spakyPriExekucii, zhoriPriExekucii } from "./battle.ts";
import type { ElderState } from "./elders.ts";
import { najvyssiMarker, priazenPre, spakyZaStupen, strachZ, vydesil } from "./elders.ts";
import { jeCielLokalita, partiaHraca } from "./effects.ts";
import { stranyLokality } from "./hrany.ts";
import { stavZavislosti } from "./zavislost.ts";
import type { Command, GameState } from "./engine.ts";
import {
  apply,
  cieleVykladania,
  cielLokalitaId,
  krcmaVyzaduje,
  kartyZaPas,
  sPrilozenou,
  krokStavby,
  legalCommands,
  sNaexNaKartach,
  silaPriazne,
  lineState,
  poskodenieBitky,
  jeFinale,
  kartyBitky,
  zahradkarChrani,
  prahyHraca,
  cervenychHraca,
  vazniHraca,
  priazen,
  verejneAbstaky,
  majitelPresvedcenej,
  nepriznaneCirhozy,
  vykupneHraca,
  cenaFajceniaHraca,
} from "./engine.ts";

/**
 * Povaha offline protihráča — tie isté výpočty, iné váhy. Všetky hrajú
 * naplno; líšia sa tým, čo si cenia a koľko riskujú.
 */
export interface Povaha {
  readonly id: string;
  readonly meno: string;
  readonly popis: string;
  /** Násobok stávky bitky — ako veľmi chce vyhrať práve túto bitku. */
  readonly bitka: number;
  /** Násobok bodov zo scorecardov a vydesenia. */
  readonly body: number;
  /** Násobok zdrojov (poldeci, cigarety, ruka). */
  readonly zdroje: number;
  /** Násobok postihov za Dlh, pečeň a Absťák. */
  readonly kliatby: number;
  /** O koľko lepšie musí byť NA EX alebo runda než nič (záporné = ochotne riskuje). */
  readonly prahRiziko: number;
  /** O koľko lepšie musí byť zajatie či presvedčenie (v11.4; v9–v11.3 pokus o zajatie, do v8 patronát) než rozdelenie bez neho. */
  readonly prahStarsi: number;
  /** Rozdiel hodnôt, pod ktorým sú ťahy „rovnako dobré“ a vyberá medzi nimi náhodne. */
  readonly nahodnost: number;
  // Páky štýlu (Michal 2026-11-03) — bez nich hrá povaha ako doteraz.
  /** Hodnota každého bodu vlastného tuhého poškodenia v línii navyše (Igor: bije, kde sa dá). */
  readonly tuhe?: number;
  /** Násobok stávky bitky vo finále; inde platí `bitka` (Rudo: prežiť, rozhodnúť na konci). */
  readonly bitkaFinale?: number;
  /** Hodnota karty v ruke navyše pred finále (Rudo: karty šetrí na posledné kolo). */
  readonly ruka?: number;
  /** Hodnota každého poldeci navyše, plného aj vypitého (Rudo: nalieva); NA EX ju neberie, otočí plný na vypitý. */
  readonly poldeci?: number;
  /** Násobok hádky — reči pri starších bodujú aj porazenému (Božena: Viera a Povery). */
  readonly hadka?: number;
  /** Súperove kliatby (Dlh, pečeň, Absťák) navyše k `kliatby` (Darina: škodí súperovi). */
  readonly skoda?: number;
  /** Hodnota vlastnej aktívnej akcie navyše — v línii aj pri výbere karty (Rudo: Cigareta a Vízia, Božena: Povery a Viera). */
  readonly akcie?: Partial<Readonly<Record<Action, number>>>;
}

/** Násobok bitky — vo finále bitkaFinale, ak ho povaha má. */
function nasobokBitky(k: Kontext, s: GameState): number {
  return jeFinale(s) ? (k.povaha.bitkaFinale ?? k.povaha.bitka) : k.povaha.bitka;
}

/** Súčet páky `akcie` cez zoznam akcií; povaha bez nej vždy 0. */
function pakaAkcii(k: Kontext, sloty: Iterable<Action | null>): number {
  const vahy = k.povaha.akcie;
  if (vahy === undefined) return 0;
  let v = 0;
  for (const a of sloty) if (a !== null) v += vahy[a] ?? 0;
  return v;
}

/** Hodnota karty pre túto povahu — aktivuje sa zhruba polovica akcií ako v hodnotaKarty. */
function hodnotaKartyPreMna(k: Kontext, karta: CardInstance, kolPoTejto?: number): number {
  const v = hodnotaKarty(k.data, karta, kolPoTejto);
  if (k.povaha.akcie === undefined) return v;
  const strany = printedSides(k.data, karta);
  return v + 0.5 * pakaAkcii(k, [...strany.left, ...strany.right]);
}

/** Násobok kliatieb hráča p z pohľadu bota — súperove ťažia škodcu viac. */
function nasobokKliatieb(k: Kontext, p: PlayerId): number {
  return k.povaha.kliatby + (p === k.ja ? 0 : (k.povaha.skoda ?? 0));
}

/** Súperi v hre: výber bota aj losovanie (Michal 2026-11-03 a 2026-11-06, nahradili pôvodné tri). Každý hrá jeden štýl. */
export const POVAHY: readonly Povaha[] = [
  {
    id: "igor",
    meno: "Igor",
    popis: "Útočník — bije sa o každú lokalitu a dáva čo najviac tuhého poškodenia.",
    bitka: 1.4,
    body: 0.8,
    zdroje: 0.8,
    kliatby: 0.6,
    prahRiziko: -0.4,
    prahStarsi: -0.3,
    nahodnost: 0.15,
    tuhe: 0.6,
  },
  {
    id: "rudo",
    meno: "Rudo",
    popis: "Zberač — hromadí cigarety, Vízie a poldeci, prvé kolá prežije a karty nasadí vo finále.",
    bitka: 0.75,
    body: 1,
    zdroje: 1.3,
    kliatby: 1,
    prahRiziko: 0.4,
    prahStarsi: 1,
    nahodnost: 0.1,
    bitkaFinale: 1.6,
    ruka: 0.25,
    poldeci: 6,
    akcie: { Cigareta: 0.5, Vízia: 0.8, Poldeci: 0.3 },
  },
  {
    id: "bozena",
    meno: "Božena",
    popis: "Veriaca — hrá na Vieru a Povery a u starších boduje rečami, aj keď bitku prehrá.",
    bitka: 0.8,
    body: 1.5,
    zdroje: 1,
    kliatby: 1.1,
    prahRiziko: 0.3,
    prahStarsi: 0,
    nahodnost: 0.1,
    hadka: 2,
    akcie: { Povera: 0.7, Viera: 0.35 },
  },
  {
    id: "darina",
    meno: "Darina",
    popis: "Škodkyňa — súperovi zapína Dlhy a poškodenie pečene, aj cez NA EX.",
    bitka: 0.9,
    body: 1,
    zdroje: 1,
    kliatby: 1,
    prahRiziko: -0.3,
    prahStarsi: 0.5,
    nahodnost: 0.15,
    skoda: 2.5,
  },
];

/**
 * Povahy, ktoré už nehrajú — len meno. Ostávajú v archíve partií a v achievementoch;
 * Štamgast je navyše postava výučby, tá hrá podľa skriptu bez výpočtu bota.
 */
export const VYRADENE_POVAHY: readonly Pick<Povaha, "id" | "meno">[] = [
  { id: "stamgast", meno: "Štamgast" },
  { id: "rapavy_fero", meno: "Rapavý Fero" },
  { id: "teta_gizka", meno: "Teta Gizka" },
];

/** Meno bota aj z vyradenej povahy. Partie spred zápisu povahy (null) hral Štamgast. */
export function menoPovahy(id: string | null | undefined): string {
  return [...POVAHY, ...VYRADENE_POVAHY].find((p) => p.id === id)?.meno ?? "Štamgast";
}

/** Povaha podľa id; neznáme id = prvá v POVAHY. */
export function povahaBota(id: string | undefined): Povaha {
  return POVAHY.find((p) => p.id === id) ?? (POVAHY[0] as Povaha);
}

export interface BotNastavenia {
  /** Koľko zamiešaní skrytých informácií sa prepočíta pri dôležitej voľbe. */
  readonly vzorky?: number;
  /** Id povahy (POVAHY); predvolená je prvá. */
  readonly povaha?: string;
}

// ---------------------------------------------------------------------------
// Hodnota kariet a akcií (ladené turnajom bot proti botovi, tools/bot/turnaj.ts)

/** Hodnota aktívnej akcie pre hráča, ktorému sa pripíše. */
const VAHA_AKCIE: Readonly<Record<Action, number>> = {
  Rana: 1,
  Pecka: 2,
  Petelica: 3,
  // Mäkké poškodenie (v10): Povera 1, Pohoršenie 2 — hádka.
  Povera: 0.4,
  Pohoršenie: 0.8,
  Viera: 1,
  Dlh: -0.8,
  PoškodeniePečene: -0.5,
  Obmedzenie: 0.3,
  // Cigareta a Vízia dajú kartu v každej Pitke, nielen raz za bitku (partia 17: Michal 23 aktívnych
  // Cigariet a 15 Vízií, bot 1 a 3, cigarety mimo pasov 38 : 3).
  Cigareta: 0.9,
  Vízia: 0.8,
  Poldeci: 0.5,
  // v10.3: Posilnenie proti Posilneniu je Forsáž (obe karty ×2) — už nikdy nie je hluché.
  Posilnenie: 0.7,
  // v11.1: Odpor proti Posilneniu dá posilnenú Vzburu a karta so Vzburou je chránená pred NA EX
  // (turnaj stredna 200 partií: 0.45 proti 0.3 — 110 : 86 výhier; 0.6 nepridá).
  Odpor: 0.45,
  // v8.4: Robota bez Dlhu dá špak — nikdy nie je hluchá.
  Robota: 0.9,
  // Pakt sa v súčtoch nikdy neobjaví — na spoji sa premení na akciu partnera.
  Pakt: 0,
};

/**
 * Čo karte pridáva jej efekt (hrubý odhad z textov sady v7, plan.md 14.0;
 * zladí turnaj). Efekty, ktoré menia bitku na stole (Pes, Mäsiar, premena,
 * Konflikt), bot vidí v odhade bitky — tu je len ich zvyšok v balíčku.
 */
const BONUS_EFEKTU: Readonly<Record<string, number>> = {
  silna_nezavisla_zena: 1,
  // Náradie (2026-10-30): premena posilnených akcií na jeho spojoch vidí odhad bitky.
  profesionalny_tiper: 0.3,
  liberal: 0.4,
  zamocnik: 0.3,
  policajtka: 0.5,
  praudovravec: 0.3,
  recidivista: 0.6,
  vestica: 0.3,
  hasic: 0.3,
  kocovnik: 0.5,
  sarlatan: 0.4,
  svokra: 0.4,
  // Identita kariet (v11.5): Konflikt — cigareta od súpera (bez nej zadĺženie); priloženie ráta sPrilozenou len v bitke.
  podvodnik: 0.4,
  // Furt (v11.5): pečeň susedov ako Viera — odhad bitky aj Pitky to vidí z evaluateLine.
  anonymny_alkoholik: 0.3,
  // Furt (v11.5): posilnení Pamätníci v okolí — tuhé vidí odhad bitky.
  opatrovatelka: 0.2,
  farar: 0.4,
  starosta: 0.6,
  postarka: 0.4,
  hrobar: 0.5,
  krcmarka: 0.4,
  veterinar: 0.3,
  autobusar: 0.3,
  dievcina_na_vydaj: 0.3,
  ministrant: 0.3,
  zahradkar: 0.4,
  cierna_macka: 0.5,
  pes: 0.5,
  // Bitka (v11.5): Pecku vidí odhad bitky, cigareta navyše je zvyšok.
  sofer: 0.4,
  snubenica: 0.5,
  zivnostnik: 0.4,
  velmi_smutiaca_vdova: 0.4,
  niekoho_stryna: 0.3,
  kapybara: 0.4,
  stryko_z_ameriky: 0.5,
  // Kšeft: karta za cigaretu (Michal 2026-11-02) — ako Strýko, odbytisko cigariet.
  predavacka: 0.5,
  // Nástup spáli súperovo Zviera — bitku ráta simulácia vyloženia, zvyšok hry SPALENIE_ZA_KARTU.
  polovnik: 0.4,
  // Furt: Roboty susedov ako Pecky — tuhé ráta odhad bitky, Dlh, ktorý Robota nespáli, tiež.
  veducko: 0.3,
  krokodil: 0.4,
  // Furt: spoj s Nástrojom a (v11.5) Roboty o 1 Dlh viac (paleneDlhyVBitke).
  kon: 0.4,
  pijan: 0.3,
  degustatorka: 0.3,
  klebetnica: 0.3,
  // Nástup presunie súperovu kartu z druhej strany — účinok ráta simulácia vyloženia (sPrilozenou).
  dohadzovacka: 0.3,
  masiar: 0.2,
  // Sypač (v11.5, Podpora): vlastný Chlap s Ranami ako Peckami — simulácia vyloženia (sPrilozenou).
  kulturista: 0.3,
  vandal: 0.2,
  traktoristka: 0.3,
  vymahac: 0.4,
  vychovavatelka: 0.4,
};

/** Hodnota Nástroja v Dedičstve (malá priazeň natrvalo). */
const DEDICSTVO: Readonly<Record<string, number>> = {
  nealko: 0.6,
  svaty_text: 0.8,
  // v7: karta za každé 2 cigarety, ktoré súper vyfajčí.
  cigorky: 0.5,
  // Náradie 2026-10-30: Puška chráni prepojenú Petelicu pred zrušením (ráta za 2); Vidly Rany +1.
  puska: 0.4,
  vidly: 1,
  // v11.5 (Dedičstvo: Hádka): víťaz hádky — súper odhodí náhodnú kartu z ruky.
  noviny: 0.5,
  // v7: Pecka navyše, keď súper priložil kartu k mojej.
  pasca: 0.8,
  // v7: prah Dlhu +1, ale Dlh v každom kole.
  vyherny_automat: -0.3,
  vinko: 0.8,
  lievik: 0.3,
  // Náradie (Michal 2026-10-30) — hrubé odhady, kým ich nezmeria turnaj.
  zapalovac: 0.4,
  vyherne_zreby: 0.4,
  pistalka: 0.3,
  hrable: 0.5,
  zrkadlo: 0.4,
  boxer: 0.7,
  telefon: 0.4,
  jogurt: 0.5,
  energetak: 0.4,
  horoskop: 0.4,
  furik: 0.5,
  kristalova_gula: 0.4,
};

/**
 * Čo jeden bod sily priazne urobí v jednej budúcej bitke (v jednotkách
 * hodnotaStavu). Priazne v5 nie sú rovnako silné v každej partii: Bitkár
 * a Veriaci menia tuhé, Abstinent odpúšťa Absťáky (v10), Ohováračka pridáva
 * Povery do hádky a Kmotor zaberie len pri priznanom Dlhu. Súperovi tak bot
 * dáva tú, ktorá mu v tejto partii urobí najmenej (Michal 2026-10-24).
 * Exekútor tu nie je — nižší prah súpera už ráta hodnotaZdrojov.
 */
const PRIAZEN_ZA_BITKU = {
  BITKAR: 1.2,
  VERIACI: 0.9,
  /** Za Absťák, ktorý Abstinent v bitke odpustí (v10) — ako bod tuhého. */
  LAKOMEC: 1.1,
  FAJCIAR: 0.5,
  /** Za špak, ktorý Advokát ušetrí pri exekúcii (len s priznaným Dlhom). */
  ADVOKAT: 0.8,
  /** Za akciu Robota navyše — spáli Dlh, alebo dá špak. */
  ROBOTA: 0.9,
  /** Za Poveru navyše v hádke (v11.10) — ako akcia Povera, odhad bez merania. */
  OHOVARACKA: 0.4,
  /** Za priznaný Dlh, ktorý Kmotor presunie súperovi (v8): mne ubudne, jemu pribudne. */
  UZERNIK: 1.0,
} as const;
/** Pravdepodobnosť, že priazeň vydrží do ďalšej bitky (Nakladačka markery hýbe). */
const VYDRZ_PRIAZNE = 0.6;

/** Akcie, ktoré sa vracajú počas zvyšku hry — tým viac, čím je hry viac; vo finále skoro nič. */
const HOSPODARSKE: ReadonlySet<Action> = new Set<Action>(["Cigareta", "Vízia", "Obmedzenie", "Poldeci"]);

function nasobokHospodarstva(kolPoTejto: number | undefined): number {
  if (kolPoTejto === undefined) return 1;
  return kolPoTejto === 0 ? 0.2 : Math.min(2, 0.75 + 0.25 * kolPoTejto);
}

/**
 * Hodnota karty v balíčku — čím vyššia, tým radšej ju bot má. `kolPoTejto`: koľko bitiek po tejto
 * ešte príde; skoro v hre je cigareta a karta navyše vždy viac než v poslednom kole.
 */
export function hodnotaKarty(data: GameData, karta: CardInstance, kolPoTejto?: number): number {
  if (karta.defId === "cirhoza") return -3;
  // Absťák (v9.1): mŕtvy ťah a −1 tuhé v každej bitke, kým je v balíčku.
  if (karta.defId === "abstak") return -2;
  const def = defOf(data, karta);
  const strany = printedSides(data, karta);
  let akcie = 0;
  const hospodarstvo = nasobokHospodarstva(kolPoTejto);
  for (const slot of [...strany.left, ...strany.right]) if (slot !== null) akcie += VAHA_AKCIE[slot] * (HOSPODARSKE.has(slot) ? hospodarstvo : 1);
  // Aktivuje sa zhruba polovica akcií — páruje sa vždy len jedna hrana. Pakt (v7) má
  // hodnotu akcie, ktorú dostane do páru — v priemere asi ako Robota.
  for (const slot of [...strany.left, ...strany.right]) if (slot === "Pakt") akcie += 0.3;
  let v = akcie * 0.5 + (BONUS_EFEKTU[def.id] ?? 0);
  if (def.tags.includes("Nástroj")) v += (DEDICSTVO[def.id] ?? 0) * 0.5;
  return v;
}

function jeKliatbaBezAkcii(data: GameData, karta: CardInstance): boolean {
  const tags = defOf(data, karta).tags;
  return tags.includes("Kliatba") && !tags.includes("Občan");
}

// ---------------------------------------------------------------------------
// Zahmlenie skrytých informácií

/**
 * Kópia stavu, v ktorej sú skryté informácie zamiešané: súperova ruka je
 * náhodný výber z jeho ruky a doberacieho balíčka, poradie všetkých
 * doberacích balíčkov a generátor náhody sú nové. Bot počíta len nad ňou.
 */
export function zahmliStav(state: GameState, ja: PlayerId, rng: RngState): [GameState, RngState] {
  const su = opponentOf(ja);
  let r = rng;
  const on = state.hraci[su];
  // Pred miešaním kanonické poradie — výsledok tak nezávisí od toho, ako sú
  // skryté karty v skutočnosti rozdelené a zoradené (overuje test férovosti).
  const poUid = (karty: readonly CardInstance[]): CardInstance[] => [...karty].sort((a, b) => a.uid - b.uid);
  // Aj súperova skrytá Záverečná v línii — na jej miesto ide náhodná z jeho skrytých kariet.
  // Karta presvedčeného staršieho (v11.4) sa mieša s ostatnými — kde je, súper nevie.
  const zaverecne = ([0, 1] as const).flatMap((strana) =>
    state.strany[strana].flatMap((pl, index) => (pl.zaverecna === true && pl.playedBy === su ? [{ strana, index, karta: pl.card }] : [])),
  );
  const [skryte, r1] = rngShuffle(r, poUid([...on.ruka, ...on.doberaci, ...zaverecne.map((z) => z.karta)]));
  const [mojBalicek, r2] = rngShuffle(r1, poUid(state.hraci[ja].doberaci));
  const [naradie, r2b] = rngShuffle(r2, poUid(state.naradie));
  const [obcania, r3] = rngShuffle(r2b, poUid(state.obcania));
  const [seed, r4] = rngInt(r3, 2 ** 31);
  r = r4;
  const naZaverecne = skryte.slice(0, zaverecne.length);
  const zvysok = skryte.slice(zaverecne.length);
  const skrytaRuka = on.ruka.length;
  const superHrac = { ...on, ruka: zvysok.slice(0, skrytaRuka), doberaci: zvysok.slice(skrytaRuka) };
  const strany = state.strany.map((strana, si) =>
    strana.map((pl, index) => {
      const i = zaverecne.findIndex((z) => z.strana === si && z.index === index);
      const karta = naZaverecne[i];
      return i === -1 || karta === undefined ? pl : { ...pl, card: karta };
    }),
  ) as unknown as GameState["strany"];
  const mojHrac = { ...state.hraci[ja], doberaci: mojBalicek };
  return [
    {
      ...state,
      rng: rngSeed(seed),
      naradie,
      obcania,
      hraci: ja === 0 ? [mojHrac, superHrac] : [superHrac, mojHrac],
      strany,
    },
    r,
  ];
}

// ---------------------------------------------------------------------------
// Hodnotenie stavu

interface Kontext {
  readonly data: GameData;
  readonly ja: PlayerId;
  /** Čo je v stávke v prebiehajúcej bitke (v špakoch), rovnaké pre oboch. */
  readonly stavka: number;
  /** Váha zdrojov podľa toho, koľko hry ešte ostáva (posledná bitka ≈ 0). */
  readonly buducnost: number;
  readonly povaha: Povaha;
}

/**
 * Odhad konečných špakov (v6), moje mínus súperove: špaky v popolníku,
 * nepriznané Cirhózy (ich počet je verejný), výkupné zdrojov a bodovanie starších
 * v bitkách, ktoré ešte prídu (bodyStarsichVOdhade, v11). Starší sa smú nahradiť (zajatie).
 */
function rozdielBodov(_data: GameData, s: GameState, ja: PlayerId, starsi: readonly ElderState[] = s.starsi): number {
  const su = opponentOf(ja);
  const odhad = (p: PlayerId): number =>
    s.spaky[p] -
    KONSTANTY.SPAKY_ZA_CIRHOZU * nepriznaneCirhozy(s.hraci[p]) +
    vykupneVOdhade(s, p) +
    bodyStarsichVOdhade(s, p, starsi) -
    exekucieDoKonca(_data, s, p);
  return odhad(ja) - odhad(su);
}

/**
 * Špaky, ktoré hráčovi p zhoria pri exekúciách do konca hry (Michal 2026-10-28,
 * exekúcia bez prahu): v každej zvyšnej bitke polovica Dlhov nahor a sila súperovho
 * Exekútora, kým Dlhy nezmiznú. Záhradkár v línii obíde len túto bitku; nové Dlhy,
 * Robotu ani Kmotra odhad nepredvída.
 */
function exekucieDoKonca(data: GameData, s: GameState, p: PlayerId): number {
  let dlhy = s.hraci[p].dlhy;
  if (dlhy === 0) return 0;
  const advokat = silaPriazne(data, s, "ADVOKAT", p);
  const tato = s.ciel !== null && (s.bitkaStav === null || !s.bitkaStav.exekutorHotovy[p]) && !zahradkarChrani(data, s, p) ? 1 : 0;
  let spolu = 0;
  for (let n = kolPoTomto(s) + tato; n > 0 && dlhy > 0; n--) {
    spolu += spakyPriExekucii(dlhy, advokat);
    dlhy -= zhoriPriExekucii(dlhy);
  }
  return spolu;
}

/** Bitky, v ktorých starší ešte budú bodovať (v11, krok 4b) — vrátane prebiehajúcej, kým nebodovala. */
function bitiekNaBodovanie(s: GameState): number {
  const tato = s.koniec === null && (s.faza !== "bitka" || s.bitkaStav === null || s.bitkaStav.damage === null) ? 1 : 0;
  return kolPoTomto(s) + tato;
}

/**
 * Bodovanie starších v odhade (v11, Michal 2026-11-02): v každej bitke, ktorá ešte príde,
 * dá starší víťazovi špaky za najvyšší marker, porazenému za reči. Reči bodujú hneď (aj pri
 * prehre) a po každej bitke klesnú o stupeň; strach je trvalý, ale boduje len víťazovi —
 * bot ráta polovičnú šancu na výhru (výsledok prebiehajúcej bitky ráta hodnotaBitky).
 */
function bodyStarsichVOdhade(s: GameState, p: PlayerId, starsi: readonly ElderState[] = s.starsi): number {
  const n = bitiekNaBodovanie(s);
  let spolu = 0;
  for (const e of starsi) {
    const strach = e.strach[p];
    let reci: number = e.reci[p];
    for (let i = 0; i < n; i++) {
      spolu += reci > strach ? spakyZaStupen(reci) : 0.5 * spakyZaStupen(strach);
      reci = reci - 1 > strach ? reci - 1 : 0;
    }
  }
  return spolu;
}

/**
 * Akú časť výkupného (2026-10-27) bot ráta už teraz: vo finále celé, skôr
 * 1 / (1 + zvyšné bitky). Poldeci a cigarety sa do konca ešte minú a doplnia —
 * plné výkupné by bota učilo hromadiť ich namiesto hrania.
 */
function vahaVykupneho(s: GameState): number {
  return 1 / (1 + kolPoTomto(s));
}

/**
 * Výkupné hráča p v odhade konečných špakov. Vo finále presne (plné poldeci,
 * celé päťky cigariet); skôr plynulo, lebo koľko cigariet ostane, ešte nevedno.
 * Poldeci pod vlastným skrytým NA EX sa vypije, nevykúpi.
 */
function vykupneVOdhade(s: GameState, p: PlayerId, cigarety: number = s.hraci[p].cigarety): number {
  const h = s.hraci[p];
  const skryte = (s.pitkaStav?.skryteNaex ?? []).filter((x) => x.hrac === p).length;
  if (kolPoTomto(s) === 0) return vykupneHraca({ poldeciPlne: h.poldeciPlne, cigarety }, skryte).spaky;
  const poldeci = Math.max(0, h.poldeciPlne - skryte) * KONSTANTY.SPAKY_ZA_POLDECI;
  return vahaVykupneho(s) * (poldeci + Math.max(0, cigarety) / KONSTANTY.CIGARIET_ZA_SPAK);
}

/** Čo hráča p stojí minúť n cigariet: ich úžitok v hre a výkupné, o ktoré príde. */
function cenaCigariet(k: Kontext, s: GameState, p: PlayerId, n: number): number {
  const c = s.hraci[p].cigarety;
  return k.povaha.zdroje * (uzitokCigariet(s, c) - uzitokCigariet(s, c - n)) + k.povaha.body * (vykupneVOdhade(s, p, c) - vykupneVOdhade(s, p, c - n));
}

// ---------------------------------------------------------------------------
// Rezerva na finále (Michal 2026-11-06): finále platí Nakladačku 1 špak za bod bez stropu a 1 špak
// za každú kartu v línii, takže vedúci bez kariet a cigariet ho prehrá aj o 40 špakov. Karta a
// cigareta preto do posledného kola neslabnú; slabnú, až keď ich už nebude kde minúť. Hodnoty sú
// v špakoch a ladí ich turnaj (tools/bot/kola.ts, súper hromadic).

/** Čo prinesie karta navyše zahraná vo finále: jej tuhé a špak za kartu v línii. */
const KARTA_VO_FINALE = 4;
/** Cena karty pod hranicou dobratia oproti rezerve: kým sa v kole ešte vykladá a po poslednom vykladaní. */
const KARTA_POD_DOBRATIM = 0.75;
const KARTA_POD_DOBRATIM_NA_KONCI = 0.25;
/** Koľko kariet si hráč za kolo najviac dotiahne z balíčka (dobratie a fajčenie), hrubý odhad. */
const KARIET_ZA_KOLO = 3;
/** Plný poldeci navyše, keď ruka presahuje limit vykladania: karta by inak ostala ležať. */
const ZA_LIMIT_NAVYSE = 1;
/** Koľko kariet z ruky a možností ťahu výpočet dopredu skúša — s plnou rukou by bot ťahal priveľmi dlho. */
const KARIET_VO_VYPOCTE = 6;
const MOZNOSTI_VO_VYPOCTE = 6;
/** Vykladaní (Zhromaždení), ktoré odhad ráta vo finále, kým nevie, koľko Pitiek bude. */
const ODHAD_VYKLADANI = 3;

/**
 * Váha rezervy podľa toho, koľko bitiek ostáva do finále. Skoro v hre je väčšia, lebo cigareta a karta
 * z prvých kôl sa úročia: súper, ktorý K1–K2 obetuje za zdroje, porážal bota 38 : 20, ako v partii 17.
 */
function vahaRezervy(s: GameState): number {
  const n = kolPoTomto(s);
  return n <= 1 ? 1 : n === 2 ? 1.1 : 1.25;
}

/** Vykladania tejto bitky po tom, ktoré práve beží (finále: či sa kartu ešte dá zahrať). */
function vykladaniPotom(s: GameState): number {
  if (s.faza === "zhromazdenie") return Math.max(0, s.pitkyCelkom - s.pitkaCislo - 1);
  if (s.faza === "pitka") return Math.max(0, s.pitkyCelkom - s.pitkaCislo);
  if (s.faza === "bitka") return 0;
  return ODHAD_VYKLADANI;
}

/**
 * Úžitok ruky v špakoch. Kariet, ktoré sa dajú vyložiť, je vo finále (vykladania × limit), nad to
 * karta veľa nepridá — ale nie je to strop, len klesajúci úžitok. Pred finále sa ruka na začiatku kola
 * sama doberie (DOBRATIE_DO_RUKY), takže karta pod touto hranicou má menšiu cenu než rezerva nad ňou.
 */
function uzitokRuky(s: GameState, p: PlayerId, karty: number): number {
  const finale = kolPoTomto(s) === 0;
  const vykladani = finale ? vykladaniPotom(s) : ODHAD_VYKLADANI;
  if (vykladani === 0) return 0;
  const kapacita = Math.max(2, vykladani * (s.hraci[p].poldeciPlne + 1));
  const plna = Math.min(karty, kapacita);
  const navyse = Math.max(0, karty - kapacita);
  const rezerva = plna + 0.25 * navyse;
  if (finale) return KARTA_VO_FINALE * rezerva;
  const zadarmo = Math.min(plna, KONSTANTY.DOBRATIE_DO_RUKY);
  const pod = vykladaniPotom(s) > 0 ? KARTA_POD_DOBRATIM : KARTA_POD_DOBRATIM_NA_KONCI;
  return vahaRezervy(s) * KARTA_VO_FINALE * (rezerva - zadarmo + zadarmo * pod);
}

/**
 * Úžitok cigariet v špakoch: prvé dve sú karta istá (šenok, prvé fajčenie), ďalšie karta za 1 až
 * 2 cigarety, a nad desať sa už nemajú kde minúť — preto sa nemajú hromadiť do výkupného 5 : 1.
 */
function uzitokCigariet(s: GameState, cigarety: number): number {
  const c = Math.max(0, cigarety);
  const krivka = Math.min(c, 2) + 0.7 * Math.max(0, Math.min(c, 6) - 2) + 0.2 * Math.max(0, Math.min(c, 10) - 6) + 0.05 * Math.max(0, c - 10);
  if (kolPoTomto(s) > 0) return vahaRezervy(s) * KARTA_VO_FINALE * 0.6 * krivka;
  // Finále: cigareta je už len fajčenie pred ďalším vykladaním. V každej Pitke prvá karta za 1,
  // druhá za 2, tretia za 3 — preto cigaretu navyše ceníme čoraz menej a nič z nej nešetríme.
  const pitky = vykladaniPotom(s);
  if (pitky === 0) return 0;
  const prve = Math.min(c, pitky);
  const druhe = Math.min(Math.max(0, c - pitky), 2 * pitky);
  const tretie = Math.min(Math.max(0, c - 3 * pitky), 3 * pitky);
  return 0.9 * KARTA_VO_FINALE * (prve + druhe / 2 + tretie / 3);
}

/** Úžitok plných poldeci: limit vykladania — prvé dva sú najcennejšie. Výkupné ráta rozdielBodov. */
function uzitokPoldeci(s: GameState, plne: number): number {
  const v = Math.min(plne, 2) * 1.3 + 1.1 * Math.max(0, plne - 2);
  return kolPoTomto(s) > 0 ? v : vykladaniPotom(s) > 0 ? 0.6 * v : 0;
}

/** Bitky o lokalitu, ktoré ešte prídu po tejto. */
function buducnostHry(s: GameState): number {
  const zostava = kolPoTomto(s);
  // Zdroje sa míňajú naplno, kým ostáva aspoň polovica partie (krátka hra:
  // 1 bitka po tejto, stredná 2, dlhá 3); pevné „3“ ich v krátkej hre
  // podceňovalo už od 1. kola (turnaj proti starému botovi 2026-10-24).
  const polovica = Math.max(1, (Math.max(s.lokalitCelkom, zostava + 1) - 1) / 2);
  return Math.max(0.15, Math.min(1, zostava / polovica));
}

/**
 * Čo získa víťaz prebiehajúcej bitky oproti porazenému (v špakoch) okrem kariet
 * v línii (tie ráta hodnotaBitky zo stavu, ktorý hodnotí — v8): sekera, výhra
 * oproti prehre je dvojnásobok. Starší (v11) dajú víťazovi strach navyše oproti
 * rečiam porazeného; kto má 4 červené, výhrou končí hru (výhra strachom).
 */
function stavkaBitky(s: GameState): number {
  if (s.ciel === null) return 0;
  // Zajatie (v11.4): víťaz smie Nakladačkou zajať staršieho, ktorý sa ho bojí na červenej —
  // polovica hodnoty väzňa, lebo Nakladačka na to nemusí stačiť.
  let zajatia = 0;
  for (const q of [0, 1] as const) {
    let naj = 0;
    for (const e of s.starsi) if (vydesil(e, q)) naj = Math.max(naj, hodnotaVazna(s, q, e.elderId));
    zajatia += 0.5 * naj;
  }
  let starsi = 0;
  for (const e of s.starsi) for (const q of [0, 1] as const) starsi += spakyZaStupen(najvyssiMarker(e, q)) - spakyZaStupen(e.reci[q]);
  let strach = 0;
  for (const q of [0, 1] as const) if (cervenychHraca(s, q) >= KONSTANTY.CERVENYCH_NA_VYHRU) strach += VYHRA_HNED;
  return 2 * s.spakyNaSekere + zajatia + starsi + strach;
}

/** Okamžitá výhra (4 červené, väzni) v jednotkách stávky — prehrať ju nesmie bot nikdy lacno. */
const VYHRA_HNED = 200;

/**
 * Karty v línii v stávke bitky (v8): víťaz dostane 1 špak za každú, takže pri
 * šanci `sanca` je to 2 × karty × (sanca − ½). Na Kultúrnom dome dostane porazený
 * svoje karty: stávka je len raz karty a navyše polovica rozdielu vlastných kariet.
 */
function kartyVStavke(s: GameState, q: PlayerId, sanca: number): number {
  const karty = kartyBitky(s);
  if (!jeCielLokalita(s, "kulturny_dom")) return 2 * karty.spolu * (sanca - 0.5);
  return karty.spolu * (sanca - 0.5) + 0.5 * (karty.vlastne[q] - karty.vlastne[opponentOf(q)]);
}

/**
 * Odhad prebiehajúcej bitky z pohľadu hráča q: šanca na výhru z rozdielu
 * tuhého poškodenia × stávka, prebytok a čo línia v Pitke prinesie (cigarety,
 * hádka, Dlhy, pečeň). `ostrost` = istota výsledku (v Zhromaždení môže
 * súper ešte odpovedať, v bitke je rozhodnuté).
 */
function hodnotaBitky(k: Kontext, s: GameState, q: PlayerId, ostrost: number): number {
  const data = k.data;
  const o = opponentOf(q);
  const sums = evaluateLine(data, lineState(s)).sums;
  const dmg = poskodenieBitky(data, s, sums);
  // Remíza v tuhom (v6): vyhrá menej Absťákov, potom menej priznaných Dlhov, inak sekera (šanca ½).
  // Abstinent (v10) Absťáky odpustí aj pri remíze.
  const remiza = (p: PlayerId): [number, number] => [abstakyVBitke(verejneAbstaky(s, p), dmg.abstinent?.[p]), prahyHraca(data, s, p).priznaneDlhy];
  const [aq, dq] = remiza(q);
  const [ao, dO] = remiza(o);
  const tuhe = dmg.tuhe[q] - dmg.tuhe[o];
  const m = tuhe !== 0 ? tuhe : aq !== ao ? 0.5 * Math.sign(ao - aq) : 0.5 * Math.sign(dO - dq);
  const celk = dmg.celkove[q] - dmg.celkove[o];
  const sanca = 1 / (1 + Math.exp(-ostrost * m));
  // Vo finále je Nakladačka priamo špaky (v9.1) — bez stropu, každý bod rozdielu sa ráta.
  const prebytok = jeFinale(s) ? celk : Math.max(-PREBYTOK_STROP, Math.min(PREBYTOK_STROP, celk));
  const bitka = nasobokBitky(k, s);
  let v = bitka * (k.stavka * (sanca - 0.5) + kartyVStavke(s, q, sanca) + cenaBoduPrebytku(s) * prebytok);
  v += (k.povaha.tuhe ?? 0) * dmg.tuhe[q];

  // Hádka (v11): víťaz ju po bitke rozdelí na svoje reči (vo finále špaky 1 : 1) — v bitke
  // ju bot ráta presne (najlepsi). Kým bitka nezačala, ide z línie.
  if (s.faza === "zhromazdenie" || s.faza === "pitka") {
    v += bitka * (k.povaha.hadka ?? 1) * cenaBoduHadky(s) * Math.max(-HADKA_STROP, Math.min(HADKA_STROP, dmg.makke[q] - dmg.makke[o]));
  }

  // Akcie, ktoré sa vyhodnotia až v Pitke — po nej už sú v stave.
  if (s.faza === "zhromazdenie" || s.faza === "pitka") {
    for (const p of [q, o] as const) {
      const sp = sums[p];
      const so = sums[opponentOf(p)];
      const h = s.hraci[p];
      let w = 0;
      // Výkupné: cigareta z Pitky a poldeci otočený v bitke na plný sú na konci hry aj špaky.
      const vykupne = k.povaha.body * vahaVykupneho(s);
      const cigareta = k.povaha.zdroje * (uzitokCigariet(s, h.cigarety + 1) - uzitokCigariet(s, h.cigarety));
      // Línia sa vyhodnotí v každej zvyšnej Pitke kola, cigareta aj Vízia sa teda rátajú toľkokrát.
      const pitky = Math.max(1, Math.min(3, s.pitkyCelkom - s.pitkaCislo + (s.faza === "pitka" ? 1 : 0)));
      w += pitky * (cigareta + vykupne / KONSTANTY.CIGARIET_ZA_SPAK) * Math.max(0, (sp.Cigareta ?? 0) - (so.Obmedzenie ?? 0));
      w += pitky * k.povaha.zdroje * (uzitokRuky(s, p, h.ruka.length + 1) - uzitokRuky(s, p, h.ruka.length)) * (sp["Vízia"] ?? 0);
      // Robota (v8.4): za každý Dlh, ktorý nemá čo spáliť, špak (Fúrik páli viac).
      const furik = h.dedicstvo.filter((x) => x.defId === "furik").length;
      w += k.povaha.body * Math.max(0, (sp.Robota ?? 0) * (1 + furik) - h.dlhy);
      const naex = s.strany.flat().filter((pl) => pl.naexBy === p).length;
      w += (0.4 * k.buducnost + vykupne * KONSTANTY.SPAKY_ZA_POLDECI) * Math.min(sp.Poldeci ?? 0, h.poldeciVypite + naex);
      // Akcia Dlh zadlžuje (karta Dlh za každý celý prah). Pečeň pod prahom sa po Pitke
      // vynuluje, ale tesne pod prahom ju dorazí ďalšie pitie či NA EX.
      const prah = prahyHraca(data, s, p).cirhoza;
      const pecen = h.pecen + (sp.PoškodeniePečene ?? 0) + (sp.Poldeci ?? 0);
      const blizko = pecen % prah === prah - 1 ? 0.4 : 0;
      w -= nasobokKliatieb(k, p) * (1.5 * (sp.Dlh ?? 0) + 0.15 * pecen + blizko);
      // Škodca (Darina) sa teší z každej pečene súpera, nielen z tej, čo dorazí k prahu.
      if (p !== k.ja) w -= (k.povaha.skoda ?? 0) * 0.5 * pecen;
      if (p === k.ja && k.povaha.akcie !== undefined) {
        for (const [a, vaha] of Object.entries(k.povaha.akcie)) w += vaha * (sp[a as Action] ?? 0);
      }
      w -= cenaNovejCirhozy(k, s) * Math.floor(pecen / prah);
      v += p === q ? w : -w;
    }
  }
  return v;
}

/** Zdroje hráča p — len verejné údaje (ruka len počtom), preto sa dajú porovnať. */
function hodnotaZdrojov(k: Kontext, s: GameState, p: PlayerId): number {
  const h = s.hraci[p];
  const f = k.buducnost;
  let v = 0;
  // Poldeci z NA EX limit nezvyšuje (v4), po bitke ostane vypitý ako ostatné.
  v += uzitokPoldeci(s, h.poldeciPlne) + 0.35 * (h.poldeciVypite + s.strany.flat().filter((pl) => pl.naexBy === p).length) * f;
  v += uzitokCigariet(s, h.cigarety);
  v += uzitokRuky(s, p, h.ruka.length);
  v *= k.povaha.zdroje;
  if (!jeFinale(s)) v += (k.povaha.ruka ?? 0) * h.ruka.length;
  v += (k.povaha.poldeci ?? 0) * (h.poldeciPlne + h.poldeciVypite);
  // Absťák (v9.1): karta v balíčku — o ranu menej v každej bitke a mŕtvy ťah.
  let postih = 0.7 * verejneAbstaky(s, p);
  // Priznaný Dlh: remíza v bitke; špaky, ktoré zhoria pri exekúcii, ráta rozdielBodov.
  postih += 0.3 * prahyHraca(k.data, s, p).priznaneDlhy;
  postih += hrozbaAbstaku(k, s, p);
  v -= nasobokKliatieb(k, p) * postih;
  // Tenký balíček už neprehráva (v5), len sa z neho nedá fajčiť ani ťahať.
  const balicek = h.doberaci.length + h.odhadzovaci.length + h.ruka.length + partiaHraca(s, p).length;
  if (balicek < TENKY_BALICEK) v -= (TENKY_BALICEK - balicek) * 0.5;
  for (const kus of h.dedicstvo) v += (DEDICSTVO[kus.defId] ?? 0) * f;
  return v;
}

/**
 * Výhľad Chuti na konci kola (v9.1, stavZavislosti): pod latkou = karta Absťák; vyššia
 * Chuť po kole je záväzok na ďalšie kolá — NA EX ju dvíha o 2. Po finále nič neznamená,
 * Chuť po predposlednom kole už tiež nie (Absťák po finále neprichádza).
 */
function hrozbaAbstaku(k: Kontext, s: GameState, p: PlayerId): number {
  const zostava = kolPoTomto(s);
  if (zostava === 0 || s.bezChuti === true) return 0;
  const z = stavZavislosti(k.data, s, p);
  return (z.vyhlad === "ziska" ? 0.7 : 0) + (zostava >= 2 ? 0.12 * z.chutPo : 0);
}

/** Koľko nerestí chýba, aby na konci kola neprišiel Absťák (0 = netreba). */
function chybajuceNeresti(k: Kontext, s: GameState, ja: PlayerId): number {
  return kolPoTomto(s) === 0 || s.bezChuti === true ? 0 : stavZavislosti(k.data, s, ja).doBezpecia;
}

/** Pod toľko kariet (ruka, balíčky, partia) hráč balíček nepreriedi. */
const TENKY_BALICEK = 7;

/**
 * Priazne hráča p v bitkách, ktoré ešte prídu — z rozdielu strachov (v11). Prebiehajúcu
 * bitku ráta hodnotaBitky so skutočnou priazňou.
 */
function hodnotaPriazni(k: Kontext, s: GameState, p: PlayerId): number {
  const n = kolPoTomto(s);
  let v = 0;
  if (n === 0) return v;
  let bitiek = 0;
  for (let j = 0; j < n; j++) bitiek += VYDRZ_PRIAZNE ** j;
  const zMarkera = { starsi: s.starsi };
  for (const fav of ALL_FAVOURS) {
    const sila = silaPriazne(k.data, zMarkera, fav, p);
    if (sila <= 0) continue;
    v += hodnotaSilyPriazne(k, s, p, fav, sila) * bitiek;
  }
  return v;
}

/** Čo priazeň `fav` sily `sila` hráčovi p urobí v jednej bitke (jednotky hodnotaStavu). */
function hodnotaSilyPriazne(k: Kontext, s: GameState, p: PlayerId, fav: Favour, sila: number): number {
  const pv = k.povaha;
  switch (fav) {
    case "BITKAR":
      return sila * PRIAZEN_ZA_BITKU.BITKAR * pv.bitka;
    case "VERIACI":
      return sila * PRIAZEN_ZA_BITKU.VERIACI * pv.bitka;
    case "LAKOMEC":
      // Abstinent (v10): odpustí najviac toľko Absťákov, koľko ich hráč má — bez Absťáku nič.
      return Math.min(sila, verejneAbstaky(s, p)) * PRIAZEN_ZA_BITKU.LAKOMEC * pv.bitka;
    case "FAJCIAR":
      return sila * PRIAZEN_ZA_BITKU.FAJCIAR * pv.zdroje;
    case "ROBOTA":
      // Akcie Robota navyše (v9): spália Dlh, alebo dajú špak.
      return sila * PRIAZEN_ZA_BITKU.ROBOTA * pv.body;
    case "OHOVARACKA":
      // Povery navyše idú do hádky a tá cez reči na špaky.
      return sila * PRIAZEN_ZA_BITKU.OHOVARACKA * pv.body;
    case "UZERNIK": {
      // Kmotor bez priznaného Dlhu nerobí nič; presunie ich súperovi najviac toľko, koľko mám.
      const dlhy = prahyHraca(k.data, s, p).priznaneDlhy;
      return Math.min(dlhy, sila + 1) * PRIAZEN_ZA_BITKU.UZERNIK * pv.kliatby;
    }
    case "ADVOKAT": {
      // Advokát ušetrí špaky len pri exekúcii — s priznaným Dlhom.
      const dlhy = prahyHraca(k.data, s, p).priznaneDlhy;
      return dlhy > 0 ? Math.min(sila, zhoriPriExekucii(dlhy)) * PRIAZEN_ZA_BITKU.ADVOKAT * pv.body : 0;
    }
  }
}

/**
 * Postup k okamžitým výhram (v11): väzni (Kšefty, výhra väzňami podľa ligy) a červené strachy
 * (výhra strachom pri 4 — ďalšia vyhratá bitka končí hru), starší na červenej, ktorých sa dá
 * skúsiť zajať. Bodovanie starších je v rozdiele bodov, tu je len hodnota výhier navyše.
 */
function hodnotaVydesenia(s: GameState, p: PlayerId): number {
  const vazni = vazniHraca(s, p).length;
  const naVyhru = vazniNaVyhru(s.lokalitCelkom);
  const ciele = s.starsi.filter((e) => vydesil(e, p)).length;
  const cervene = cervenychHraca(s, p);
  const zostava = kolPoTomto(s) + (s.ciel === null ? 1 : 0);
  let v = vazni * (2 + 1.5 * Math.min(zostava, 3));
  if (zostava > 0) {
    if (vazni >= naVyhru - 1) v += VAZEN_PRED_VYHROU + (ciele > 0 ? 10 : 0);
    if (cervene >= KONSTANTY.CERVENYCH_NA_VYHRU) v += CERVENE_NA_VYHRU;
    else if (cervene === KONSTANTY.CERVENYCH_NA_VYHRU - 1) v += CERVENE_PRED_VYHROU;
    v += 1.5 * ciele + 0.4 * s.starsi.filter((e) => strachZ(e, p) === 2).length;
  }
  // Výpalné (v11.9): súper platí za každú červenú (aj väzňa) v každej bitke pred finále, koľko má.
  const bitkyVypalneho = kolPoTomto(s);
  v += CENA_VYPALNEHO * Math.min(cervene * KONSTANTY.VYPALNE_ZA_CERVENU * bitkyVypalneho, s.hraci[opponentOf(p)].cigarety + bitkyVypalneho);
  // Presvedčený starší (v11.4): jeho karta je natrvalo v mojom balíčku a súper ho už nepresvedčí.
  v += s.starsi.filter((e) => e.presvedcil === p).length * (PRESVEDCENY + PRESVEDCENY_ZA_BITKU * Math.min(zostava, 3));
  return v;
}

/** Cigareta z výpalného v špakoch; turnaj: 0,5 pomáha, celá cena ani odpočet pri platiacom nie. */
const CENA_VYPALNEHO = 0.5;

/** Nepoužitá schopnosť väzňa (v11.2) pri voľbe zajatia (v11.4) — v hodnote stavu nie je. */
const SCHOPNOST_VAZNA = 4;
/** Presvedčený starší (v11.4): základ a za každú bitku, v ktorej sa jeho karta ešte zahrá. */
const PRESVEDCENY = 6;
const PRESVEDCENY_ZA_BITKU = 3;

/** Väzeň pred výhrou väzňami. */
const VAZEN_PRED_VYHROU = 20;
/** 4 červené — ďalšia vyhratá bitka je výhra (polovičná šanca na ňu). */
const CERVENE_NA_VYHRU = 60;
/** Tretia červená zo štyroch. */
const CERVENE_PRED_VYHROU = 12;

/**
 * Čo hráčovi q prinesie väzeň, ak ho zajme (v11.4 Nakladačkou) — pre stávku bitky:
 * krádež súperových špakov za jeho najvyšší marker, schopnosť a výhra väzňami. Že starší
 * zmizne zo stupnice (priazeň, bodovanie), ráta volajúci zo stavu bez neho.
 */
function hodnotaVazna(s: Pick<GameState, "vazni" | "starsi" | "spaky" | "lokalitCelkom">, q: PlayerId, elderId: string): number {
  const su = opponentOf(q);
  const elder = s.starsi.find((e) => e.elderId === elderId);
  const kradez = elder === undefined ? 0 : Math.max(0, Math.min(spakyZaStupen(najvyssiMarker(elder, su)), s.spaky[su]));
  const vyhra = vazniHraca(s, q).length + 1 >= vazniNaVyhru(s.lokalitCelkom);
  return 2 * kradez + 4 + (vyhra ? VYHRA_HNED : 0);
}

/** Koľko bitiek príde po tejto (v6 aj finále). */
function kolPoTomto(s: GameState): number {
  // v7: s rozpisom úrovní sú v lokalityVHre všetky lokality sady — kolá ráta rozpis.
  if (s.rozpis !== undefined) return Math.max(0, s.rozpis.length - s.kolo);
  // Sada bez pinnacle lokalít (testy) finále nemá.
  return Math.max(0, s.lokalityVHre.length - (s.ciel === null ? 1 : 0));
}

/** Celková hodnota stavu z pohľadu bota (k.ja). */
function hodnotaStavu(k: Kontext, s: GameState, ostrost: number): number {
  const ja = k.ja;
  const su = opponentOf(ja);
  if (s.koniec !== null) {
    if (s.koniec.vitaz === null) return 0;
    return s.koniec.vitaz === ja ? 1000 : -1000;
  }
  let v = k.povaha.body * (rozdielBodov(k.data, s, ja) + hodnotaVydesenia(s, ja) - hodnotaVydesenia(s, su));
  v += hodnotaPriazni(k, s, ja) - hodnotaPriazni(k, s, su);
  v += hodnotaZdrojov(k, s, ja) - hodnotaZdrojov(k, s, su);
  const bitkaPred = s.faza === "bitka" && s.bitkaStav !== null && s.bitkaStav.damage === null;
  if (s.ciel !== null && (s.faza === "zhromazdenie" || s.faza === "pitka" || bitkaPred)) {
    v += hodnotaBitky(k, s, ja, bitkaPred ? 3 : ostrost);
  } else if (s.ciel !== null && s.faza === "bitka" && s.bitkaStav !== null) {
    v += hodnotaVysledku(k, s, s.bitkaStav);
  }
  return v;
}

/**
 * Bitka s rozhodnutým poškodením, ktorej lokalita ešte nie je pridelená. Bez
 * tohto by posledný výber hádky (po ňom sa poškodenie vyhodnotí hneď)
 * nevidelo, že priazeň z hádky (Bitkár, Veriaci, Abstinent) bitku vyhrá.
 */
function hodnotaVysledku(k: Kontext, s: GameState, b: NonNullable<GameState["bitkaStav"]>): number {
  // Špaky za bitku a za starších sú po výsledku už v popolníkoch. Nerozdelenú Nakladačku
  // a hádku ráta ako v hodnotaBitky — rozdelenie samo bot zahrá nanečisto (najlepsi).
  const ja = k.ja;
  const drzi = b.prebytokDrzi;
  const prebytok = drzi === null ? 0 : (drzi === ja ? 1 : -1) * Math.min(PREBYTOK_STROP, b.prebytokZostava);
  const hd = b.hadka;
  const hadka = hd === undefined || hd.vitaz === null ? 0 : (hd.vitaz === ja ? 1 : -1) * Math.min(HADKA_STROP, hd.zostava);
  return nasobokBitky(k, s) * (cenaBoduPrebytku(s) * prebytok + (k.povaha.hadka ?? 1) * cenaBoduHadky(s) * hadka);
}

/**
 * Čo jeden bod Nakladačky prinesie víťazovi (v11): stupeň strachu za 1 / 2 / 3 boduje
 * v každej ďalšej vyhratej bitke (≈ ZA_BOD_NAKLADACKY za bod a bitku), ale súperovi dá
 * priazeň. Vo finále je bod priamo 1 špak.
 */
function cenaBoduPrebytku(s: GameState): number {
  if (jeFinale(s)) return KONSTANTY.SPAKY_ZA_NAKLADACKU_VO_FINALE;
  return ZA_BOD_NAKLADACKY * Math.min(3, Math.max(0, kolPoTomto(s)));
}

/**
 * Čo jeden bod hádky prinesie jej víťazovi (v11): reči bodujú v najbližšej bitke aj pri
 * prehre a potom klesajú — bod ≈ ZA_BOD_HADKY, keď ešte bitka príde. Vo finále 1 špak.
 */
function cenaBoduHadky(s: GameState): number {
  if (jeFinale(s)) return KONSTANTY.SPAKY_ZA_HADKU_VO_FINALE;
  return kolPoTomto(s) > 0 ? ZA_BOD_HADKY : 0;
}

/** Bod Nakladačky na jednu ďalšiu bitku (stupeň 1 / 3 / 5 špakov za 1 / 2 / 3 body, polovičná šanca na výhru). */
const ZA_BOD_NAKLADACKY = 0.4;

/**
 * Cirhóza, ktorá z Pitky ešte len príde (v špakoch). Nepriznaná stojí na konci
 * SPAKY_ZA_CIRHOZU špakov (rozdielBodov ju tak ráta hneď, ako je v balíčku); skoro v hre ju
 * hráč ešte prizná a pochová, pred finále sotva, vo finále už nie
 * (Fero vo finále dával NA EX za −20 špakov, turnaj v6).
 */
function cenaNovejCirhozy(k: Kontext, s: GameState): number {
  const zostava = kolPoTomto(s);
  return k.povaha.body * KONSTANTY.SPAKY_ZA_CIRHOZU * (zostava === 0 ? 1 : zostava === 1 ? 0.8 : 0.6);
}

/**
 * Bod hádky (v11): reči 1 / 3 / 5 za 1 / 3 / 6 bodov bodujú hneď v ďalšej bitke a potom klesajú
 * (spolu ≈ 1–1,5 špaku za bod). Jemné ladenie patrí naex-bot-trener.
 */
const ZA_BOD_HADKY = 1;
/** Strop prebytku a hádky v odhade bitky — starších a polí je konečne veľa. */
const PREBYTOK_STROP = 8;
const HADKA_STROP = 8;

// ---------------------------------------------------------------------------
// Zhromaždenie nanečisto — obaja vykladajú chamtivo

interface Vylozenie {
  readonly karta: CardInstance;
  readonly kam: "vlastna" | "superova";
}

/** Stôl po vyložení — s Konfliktom a premenou Miňištranta ako v motore (sPrilozenou, v7). */
function sKartou(data: GameData, s: GameState, q: PlayerId, v: Vylozenie): GameState {
  return sPrilozenou(data, s, v.kam === "vlastna" ? q : opponentOf(q), v.karta, q);
}

/** Najlepšie vyloženie hráča q podľa odhadu bitky, alebo null, keď žiadne nepomôže. */
function najlepsieVylozenie(k: Kontext, s: GameState, ruka: readonly CardInstance[], q: PlayerId, limit: number): Vylozenie | null {
  const pred = hodnotaBitky(k, s, q, 0.9);
  // Karta z ruky a cigareta, ktorú by za ňu dal pas (kartyZaPas).
  const c = s.hraci[q].cigarety;
  const cenaKarty = k.povaha.zdroje * (uzitokRuky(s, q, ruka.length) - uzitokRuky(s, q, ruka.length - 1) + (limit > 0 ? uzitokCigariet(s, c + 1) - uzitokCigariet(s, c) : 0));
  let najlepsie: Vylozenie | null = null;
  let najlepsiaHodnota = pred + 0.05;
  const videne = new Set<string>();
  const nKol = kolPoTomto(s);
  const skusane = ruka.length <= KARIET_VO_VYPOCTE ? ruka : [...ruka].sort((a, b) => hodnotaKartyPreMna(k, b, nKol) - hodnotaKartyPreMna(k, a, nKol)).slice(0, KARIET_VO_VYPOCTE);
  for (const karta of skusane) {
    if (jeKliatbaBezAkcii(k.data, karta)) continue;
    for (const kam of cieleVykladania(k.data, s.strany, q, karta, limit, false, cielLokalitaId(s))) {
      if (kam !== "vlastna" && kam !== "superova") continue;
      const kluc = `${karta.defId}/${karta.leftLayout}/${karta.rightLayout}/${kam}`;
      if (videne.has(kluc)) continue;
      videne.add(kluc);
      const v = { karta, kam } as const;
      const h = hodnotaBitky(k, sKartou(k.data, s, q, v), q, 0.9) - cenaKarty;
      if (h > najlepsiaHodnota) {
        najlepsiaHodnota = h;
        najlepsie = v;
      }
    }
  }
  return najlepsie;
}

function minieLimit(data: GameData, v: Vylozenie): boolean {
  return !defOf(data, v.karta).tags.includes("Nástroj");
}

/** Dohrá Zhromaždenie: kto je na ťahu, vyloží najlepšiu kartu, alebo pasuje. */
function dohrajZhromazdenie(k: Kontext, s: GameState): GameState {
  const z = s.zhromazdenieStav;
  if (s.faza !== "zhromazdenie" || z === null) return s;
  let strany = s.strany;
  const ruky: [CardInstance[], CardInstance[]] = [[...s.hraci[0].ruka], [...s.hraci[1].ruka]];
  const limit: [number, number] = [z.zostavaLimit[0], z.zostavaLimit[1]];
  const pasoval: [boolean, boolean] = [z.pasoval[0], z.pasoval[1]];
  const navyse: [number, number] = [z.navyse[0], z.navyse[1]];
  // Pas dáva cigaretu za každú kartu, ktorú hráč ešte smel vyložiť a má v ruke (kartyZaPas).
  // Bez nej skutočný pas (s cigaretami) vyzeral lepšie než vykladanie, po
  // ktorom sa v nanečisto dohranom Zhromaždení pasuje zadarmo — a vo v5
  // rozhoduje súboj o Cigarety (bot pasoval o poslednú bitku).
  const cigarety: [number, number] = [s.hraci[0].cigarety, s.hraci[1].cigarety];
  let naTahu = z.naTahu;
  for (let krok = 0; krok < 30 && !(pasoval[0] && pasoval[1]); krok++) {
    const q = naTahu;
    const v = najlepsieVylozenie(k, { ...s, strany }, ruky[q], q, limit[q]);
    if (v === null) {
      pasoval[q] = true;
      navyse[q] = 0;
      cigarety[q] += kartyZaPas({ zostavaLimit: limit }, q, ruky[q].length) * KONSTANTY.CIGARETY_ZA_PAS_NA_KARTU;
    } else {
      strany = sKartou(k.data, { ...s, strany }, q, v).strany;
      ruky[q] = ruky[q].filter((x) => x.uid !== v.karta.uid);
      if (minieLimit(k.data, v)) limit[q] = Math.max(0, limit[q] - 1);
      if (navyse[q] > 0) {
        navyse[q] -= 1;
        continue;
      }
    }
    if (!pasoval[opponentOf(q)]) naTahu = opponentOf(q);
  }
  return {
    ...s,
    strany,
    hraci: [
      { ...s.hraci[0], ruka: ruky[0], cigarety: cigarety[0] },
      { ...s.hraci[1], ruka: ruky[1], cigarety: cigarety[1] },
    ],
    zhromazdenieStav: { ...z, naTahu, zostavaLimit: limit, pasoval, navyse },
  };
}

// ---------------------------------------------------------------------------
// Rozhodnutie

interface Volba {
  readonly data: GameData;
  readonly state: GameState;
  readonly ja: PlayerId;
  readonly legal: readonly Command[];
  /** Zamiešané kópie stavu — nad nimi sa počíta. */
  readonly vzorky: readonly GameState[];
  readonly k: Kontext;
  /** Náhodné číslo zo semienka — výber medzi rovnako dobrými ťahmi (povaha.nahodnost). */
  readonly nahoda: number;
}

function priemer(volba: Volba, cmd: Command, ohodnot: (s: GameState) => number): number {
  let sucet = 0;
  let n = 0;
  for (const vzorka of volba.vzorky) {
    let po: GameState;
    try {
      po = apply(volba.data, vzorka, cmd, volba.ja).state;
    } catch {
      continue;
    }
    sucet += ohodnot(po);
    n++;
  }
  return n === 0 ? Number.NEGATIVE_INFINITY : sucet / n;
}

/**
 * Najlepšia z možností; medzi takmer rovnako dobrými (rozdiel pod
 * povaha.nahodnost) vyberie náhodne — bot tak nehrá stále ten istý vzorec.
 */
function najlepsi(volba: Volba, moznosti: readonly Command[], ohodnot: (s: GameState) => number): Command | null {
  const hodnoty = moznosti.map((cmd) => ({ cmd, v: priemer(volba, cmd, ohodnot) }));
  const bestV = Math.max(...hodnoty.map((x) => x.v));
  if (!Number.isFinite(bestV)) return null;
  const blizke = hodnoty.filter((x) => x.v >= bestV - volba.k.povaha.nahodnost);
  return blizke[Math.floor(volba.nahoda * blizke.length)]?.cmd ?? null;
}

/**
 * Ťah offline protihráča. Vráti vždy jeden z legálnych príkazov (alebo
 * výber kariet, ktorý apply prijme). Hráč nesmie byť bez možnosti — to
 * je chyba volajúceho.
 */
export function tahBota(data: GameData, stav: GameState, ja: PlayerId, seed: number, nastavenia: BotNastavenia = {}): Command {
  // NA EX naraz (v5): súperove skryté NA EX bot nevidí, rovnako ako hráč.
  const state: GameState =
    stav.pitkaStav === null ? stav : { ...stav, pitkaStav: { ...stav.pitkaStav, skryteNaex: (stav.pitkaStav.skryteNaex ?? []).filter((x) => x.hrac === ja) } };
  const vsetky = legalCommands(data, state, ja);
  // Schopnosť väzňa (v11.2) je raz za hru — bot ju použije len podľa jednoduchého pravidla, inak ju šetrí.
  const schopnost = schopnostBota(data, state, ja, vsetky);
  if (schopnost !== null) return schopnost;
  const legal = vsetky.filter((c) => c.type !== "schopnostVazna");
  const prvy = legal[0];
  if (prvy === undefined) throw new Error("Bot nemá legálny ťah.");
  if (legal.length === 1) return prvy;
  const hasic = volbaHasica(data, state);
  if (hasic !== null) return hasic;

  const [nahoda, r0] = rngNext(rngSeed(seed));
  let rng = r0;
  const vzorky: GameState[] = [];
  const pocet = Math.max(1, nastavenia.vzorky ?? 4);
  for (let i = 0; i < pocet; i++) {
    const [z, r] = zahmliStav(state, ja, rng);
    vzorky.push(z);
    rng = r;
  }
  const k: Kontext = {
    data,
    ja,
    stavka: stavkaBitky(state),
    buducnost: buducnostHry(state),
    povaha: povahaBota(nastavenia.povaha),
  };
  const volba: Volba = { data, state, ja, legal, vzorky, k, nahoda };

  // Voľby, ktoré menia stôl (Kapybara, Nástroj za Živnostníka), si zahrá nanečisto.
  const typ = state.hasicVolby?.[0]?.typ;
  if (typ === "kapybara" || typ === "nastroj") return najlepsi(volba, legal, (po) => hodnotaStavu(k, po, 1.5)) ?? prvy;
  const cmd = rozhodni(volba);
  return cmd ?? prvy;
}

/**
 * Schopnosť väzňa (v11.2): jednoduché pravidlá, nech ju bot nepoužije naprázdno ani hneď
 * zbytočne. Krčmárka a Veterinár hneď; Poštárka s málom cigariet či vo finále; Hrobár
 * na kartu, ktorá nie je kliatba a nie je horšia ako priemer jeho kariet; Farár na súperovo
 * NA EX na vlastnej karte (alebo v poslednej Pitke na akomkoľvek); Starosta v poslednej Pitke,
 * keď posilnené hrany bitku pohnú v jeho prospech; Vychovávateľka, keď má súper v ruke
 * aspoň 2 karty; Autobusár na aspoň 2 karty nad priemerom (jedna cigareta ostane).
 */
function schopnostBota(data: GameData, state: GameState, ja: PlayerId, legal: readonly Command[]): Command | null {
  const ponuka = legal.filter((c): c is Extract<Command, { type: "schopnostVazna" }> => c.type === "schopnostVazna");
  if (ponuka.length === 0) return null;
  const opp = opponentOf(ja);
  const h = state.hraci[ja];
  const defId = (c: { readonly elderId: string }): string | undefined => state.vazni.find((x) => x.elderId === c.elderId)?.karta.defId;
  const poslednaPitka = state.faza === "pitka" && state.pitkaCislo >= state.pitkyCelkom;
  const finale = state.ciel?.typ === "finale";
  for (const c of ponuka) {
    switch (defId(c)) {
      case "krcmarka":
      case "veterinar":
        return c;
      case "postarka":
        if (h.cigarety <= 2 || finale) return c;
        break;
      case "hrobar": {
        const karta = state.hraci[opp].odhadzovaci.find((k) => k.uid === c.uid);
        if (karta !== undefined && !defOf(data, karta).tags.includes("Kliatba") && hodnotaKarty(data, karta) >= priemernaKarta(data, state, ja)) return c;
        break;
      }
      case "farar": {
        const pl = state.strany.flat().find((x) => x.card.uid === c.uid);
        if (pl !== undefined && (pl.playedBy === ja || poslednaPitka)) return c;
        break;
      }
      case "starosta": {
        if (!poslednaPitka) break;
        const rozdiel = (s: GameState): number => {
          const t = poskodenieBitky(data, s, evaluateLine(data, lineState(s)).sums).tuhe;
          return t[ja] - t[opp];
        };
        const posilnene: GameState = { ...state, kseftyKola: { ...(state.kseftyKola ?? {}), hranyPosilnene: true } };
        if (rozdiel(posilnene) >= rozdiel(state) + 2) return c;
        break;
      }
      case "vychovavatelka":
        if (state.hraci[opp].ruka.length >= 2) return c;
        break;
      case "autobusar": {
        const priemer = priemernaKarta(data, state, ja);
        const dobre = [...state.senok].filter((k) => hodnotaKarty(data, k) > priemer).sort((a, b) => hodnotaKarty(data, b) - hodnotaKarty(data, a));
        const kolko = Math.min(dobre.length, h.cigarety - 1);
        if (kolko >= 2) return { type: "schopnostVazna", elderId: c.elderId, uids: dobre.slice(0, kolko).map((k) => k.uid) };
        break;
      }
    }
  }
  return null;
}

/** Hasič: kliatbu bot vráti do odhadzovacieho balíčka, inú kartu si nechá. */
function volbaHasica(data: GameData, state: GameState): Command | null {
  const volba = state.hasicVolby?.[0];
  if (volba === undefined) return null;
  if (volba.typ === "kapybara" || volba.typ === "nastroj") return null;
  if (volba.typ === "senok") {
    // Zastávka: zo šenku najlepšiu kartu.
    const best = [...state.senok].sort((a, b) => hodnotaKarty(data, b) - hodnotaKarty(data, a))[0];
    return best === undefined ? null : { type: "senok", uid: best.uid };
  }
  const karta = state.hraci[volba.hrac].odhadzovaci.find((k) => k.uid === volba.uid);
  return { type: "hasic", nechat: karta !== undefined && !defOf(data, karta).tags.includes("Kliatba") };
}

function rozhodni(v: Volba): Command | null {
  switch (v.state.faza) {
    case "volbaCiela":
      return volbaCiela(v);
    case "draft":
      return draft(v);
    case "zhromazdenie":
      return zhromazdenie(v);
    case "pitka":
      return pitka(v);
    case "bitka":
      return bitka(v);
    default:
      return null;
  }
}

// --- Voľba cieľa -----------------------------------------------------------

function hodnotaHrany(hrana: readonly (Action | null)[]): number {
  return hrana.reduce((a, x) => a + (x === null ? 0 : VAHA_AKCIE[x]), 0);
}

function volbaCiela(v: Volba): Command | null {
  const { data, state, ja } = v;
  // Lokalita: draft výsledok rozmaže, rozhoduje natočenie — hrana k mojej
  // strane sa páruje skôr s mojimi kartami.
  let lokalita: Command | null = null;
  let lokalitaV = Number.NEGATIVE_INFINITY;
  for (const cmd of v.legal) {
    if (cmd.type !== "chooseLocation") continue;
    const lok = state.lokalityVHre.find((x) => x.uid === cmd.uid);
    if (lok === undefined) continue;
    const hrany = stranyLokality(data, lok, cmd.otocena, ja);
    let h = 0.6 * hodnotaHrany(hrany.kTebe) - 0.4 * hodnotaHrany(hrany.kSuperovi);
    if (lok.defId === "lesna_cesta" && verejneAbstaky(state, ja) > 0) h += 0.5;
    if (h > lokalitaV) {
      lokalitaV = h;
      lokalita = cmd;
    }
  }
  return lokalita;
}

// --- Draft -----------------------------------------------------------------

function priemernaKarta(data: GameData, state: GameState, ja: PlayerId): number {
  const h = state.hraci[ja];
  const vsetky = [...h.ruka, ...h.doberaci, ...h.odhadzovaci];
  if (vsetky.length === 0) return 0;
  const n = kolPoTomto(state);
  return vsetky.reduce((a, x) => a + hodnotaKarty(data, x, n), 0) / vsetky.length;
}

function draft(v: Volba): Command | null {
  const { data, state, ja } = v;
  const d = state.draftStav;
  if (d === null) return null;
  if (d.krok === "stavba") {
    // Naspodok vlastného balíčka dá silné karty: odtiaľ si ich dotiahne fajčením a dobraním a súper
    // ich nedostane; do šenku, z ktorého berú obaja, ide slabšia polovica (partia 17: bot s 0 cigaretami
    // ponúkal to najlepšie súperovi s 11). Keď je balíček dlhý a do konca hry sa naspodok nedotiahne
    // (najviac asi 3 karty za kolo) a cigariet má viac než súper, silné dá do šenku a kúpi si ich.
    const n = kolPoTomto(state);
    const vsetky = [...d.balicky[ja]].sort((a, b) => hodnotaKartyPreMna(v.k, b, n) - hodnotaKartyPreMna(v.k, a, n));
    const krok = krokStavby(vsetky.length);
    const h = state.hraci[ja];
    const nedotiahne = h.doberaci.length >= KARIET_ZA_KOLO * (n + 1);
    const kupi = h.cigarety >= 2 && h.cigarety > state.hraci[opponentOf(ja)].cigarety;
    const silneDoSenku = nedotiahne && kupi;
    const odhod = silneDoSenku ? vsetky.slice(krok.doSenku) : vsetky.slice(0, krok.odhod);
    const doSenku = silneDoSenku ? vsetky.slice(0, krok.doSenku) : vsetky.slice(krok.odhod);
    return { type: "stavbaSenku", doSenku: doSenku.map((x) => x.uid), odhod: odhod.map((x) => x.uid) };
  }
  // Branie zo šenku (Michal 2026-10-19): 1 karta za cigaretu, 2 karty za 3.
  const nKol = kolPoTomto(state);
  const ponuka = [...state.senok].sort((a, b) => hodnotaKartyPreMna(v.k, b, nKol) - hodnotaKartyPreMna(v.k, a, nKol));
  const najlepsia = ponuka[0];
  if (najlepsia === undefined) return { type: "draftStop" };
  const druha = ponuka[1];
  // Zisk karty oproti tomu, čo stojí: karta v ruke je špaky vo finále, kvalita oproti priemeru balíčka navrch.
  const { k } = v;
  const h = state.hraci[ja];
  const priemer = priemernaKarta(data, state, ja);
  const ruka = h.ruka.length;
  const zisk = (x: CardInstance | undefined, poradie: number): number =>
    x === undefined ? 0 : hodnotaKartyPreMna(k, x, nKol) - priemer + k.povaha.zdroje * (uzitokRuky(state, ja, ruka + poradie + 1) - uzitokRuky(state, ja, ruka + poradie));
  const mozne = (uids: readonly number[]): Command | null =>
    v.legal.find((c) => c.type === "draftBer" && c.uids.length === uids.length && uids.every((u) => c.uids.includes(u))) ?? null;
  const jedna = mozne([najlepsia.uid]);
  const dve = druha === undefined ? null : mozne([najlepsia.uid, druha.uid]);
  const zaJednu = zisk(najlepsia, 0) - cenaCigariet(k, state, ja, KONSTANTY.CENA_SENKU[1] ?? 1);
  const zaDve = zisk(najlepsia, 0) + zisk(druha, 1) - cenaCigariet(k, state, ja, KONSTANTY.CENA_SENKU[2] ?? 3);
  // Keď súper prestal, je to posledný ťah brania — po jednej by už nebolo kedy.
  const posledny = d.hotovo[opponentOf(ja)];
  if (dve !== null && zaDve > 0 && (posledny || zaDve > zaJednu)) return dve;
  if (jedna !== null && zaJednu > 0) return jedna;
  return { type: "draftStop" };
}

// --- Zhromaždenie ----------------------------------------------------------

function zhromazdenie(v: Volba): Command | null {
  const { data, state, ja, k } = v;
  const h = state.hraci[ja];
  const z = state.zhromazdenieStav;
  if (z === null) return null;

  // Priznanie neodovzdá ťah. Cirhóza priznaná
  // dá súperovi +1 tuhé v každej zvyšnej bitke (Michal 2026-10-20), nepriznaná
  // −2 za každú aktívnu podmienku pečeň na konci. Cena priznania teda rastie
  // s počtom zvyšných bitiek, nie s dĺžkou hry — v krátkej hre (3 lokality)
  // by pevné „najviac dve zvyšné“ priznávalo už v 1. kole.
  for (const cmd of v.legal) {
    if (cmd.type !== "place" || cmd.target !== "priznanie") continue;
    const karta = h.ruka.find((x) => x.uid === cmd.uid);
    if (karta?.defId === "cirhoza" && ziskPriznaniaCirhozy(v, karta) > 0) return cmd;
  }

  // Dedičstvo: dobrý Nástroj natrvalo, keď na to sú cigarety a balíček to znesie.
  const balicek = h.ruka.length + h.doberaci.length + h.odhadzovaci.length;
  if (k.buducnost >= 0.3 && balicek >= 10) {
    for (const cmd of v.legal) {
      if (cmd.type !== "place" || cmd.target !== "dedicstvo") continue;
      const karta = h.ruka.find((x) => x.uid === cmd.uid);
      if (karta === undefined || (DEDICSTVO[karta.defId] ?? 0) < 0.5) continue;
      if (h.dedicstvo.some((x) => x.defId === karta.defId)) continue;
      return cmd;
    }
  }

  // Fajčiť sa od v5 dá len v Pitke (tam rieši fajčenie pitka()).

  // Vykladanie: každú možnosť dohrá nanečisto (obaja chamtivo) a ohodnotí.
  const videne = new Set<string>();
  const moznosti: Command[] = [];
  const vylozenia: Command[] = [];
  for (const cmd of v.legal) {
    if (cmd.type === "pass" || cmd.type === "vypit") {
      moznosti.push(cmd);
      continue;
    }
    if ((cmd.type !== "place" && cmd.type !== "zaverecna") || (cmd.target !== "vlastna" && cmd.target !== "superova")) continue;
    const karta = h.ruka.find((x) => x.uid === cmd.uid);
    if (karta === undefined || jeKliatbaBezAkcii(data, karta)) continue;
    const kluc = `${karta.defId}/${karta.leftLayout}/${karta.rightLayout}/${cmd.target}/${cmd.type}`;
    if (videne.has(kluc)) continue;
    videne.add(kluc);
    vylozenia.push(cmd);
  }
  // S plnou rukou sa celý výpočet robí len pre najsľubnejšie vyloženia (odhad bitky bez dohrania Zhromaždenia).
  const vzorka = v.vzorky[0] ?? state;
  const odhad = (cmd: Command): number => {
    try {
      return hodnotaBitky(k, apply(data, vzorka, cmd, ja).state, ja, 0.9);
    } catch {
      return Number.NEGATIVE_INFINITY;
    }
  };
  if (vylozenia.length <= MOZNOSTI_VO_VYPOCTE) moznosti.push(...vylozenia);
  else moznosti.push(...vylozenia.map((cmd) => ({ cmd, h: odhad(cmd) })).sort((a, b) => b.h - a.h).slice(0, MOZNOSTI_VO_VYPOCTE).map((x) => x.cmd));
  // Záverečná: blok súperovej odpovede na tej strane už dohrá dohrajZhromazdenie
  // (súper za ňu nepriloží); utajenie karty do konca Pitky má malú cenu navyše.
  const sZaverecnou = (po: GameState): number =>
    po.strany.some((strana) => strana.some((pl) => pl.zaverecna === true && pl.playedBy === ja)) ? BONUS_ZAVERECNEJ * k.buducnost : 0;
  // Poľovník: súperova karta spálená z línie mu chýba v balíčku do konca hry — tým viac, čím je lepšia.
  // Skrytú Záverečnú Poľovník nestrieľa (a vo vzorkách má iné uid).
  const superove = [...state.strany[0], ...state.strany[1]].filter((pl) => pl.playedBy !== ja && pl.zaverecna !== true);
  const spalene = (po: GameState): number => {
    const ostali = new Set([...po.strany[0], ...po.strany[1]].map((pl) => pl.card.uid));
    const zmizli = superove.filter((pl) => !ostali.has(pl.card.uid));
    return zmizli.reduce((a, pl) => a + Math.max(0, hodnotaKarty(data, pl.card)), 0) * SPALENIE_ZA_KARTU * k.buducnost;
  };
  return najlepsi(v, moznosti, (po) => hodnotaStavu(k, dohrajZhromazdenie(k, po), 0.9) + sZaverecnou(po) + spalene(po));
}

/** O koľko musí byť NA EX lepšie, keď ho súper s Bzdochou uvidí skôr, než dohrá Pitku — hrubý odhad. */
const BZDOCHA_NAEX = 1;

/** Koľko z hodnoty súperovej karty v balíčku zarobí jej spálenie (Poľovník) — hrubý odhad. */
const SPALENIE_ZA_KARTU = 0.5;

/** Hodnota jedného tuhého navyše pre súpera v jednej bitke (v bodoch) — hrubý odhad. */
const CENA_TUHEHO_ZA_BITKU = 0.9;

/**
 * Body, ktoré priznanie Cirhózy ušetrí na konci, mínus súperovo +1 tuhé
 * v tejto a každej ďalšej bitke. Nepriznaná ide vo v5 po bitke do balíčka
 * a v poslednom kole sa môže vrátiť do ruky — vtedy ju prizná lacno (za jednu
 * bitku), preto cena tuhého len polovičná (heuristika stratéga, 2026-10-25).
 */
function ziskPriznaniaCirhozy(v: Volba, karta: CardInstance): number {
  const { data, state, ja, k } = v;
  const h = state.hraci[ja];
  const hrac = { ...h, ruka: h.ruka.filter((x) => x.uid !== karta.uid), priznane: [...h.priznane, karta] };
  const po: GameState = { ...state, hraci: ja === 0 ? [hrac, state.hraci[1]] : [state.hraci[0], hrac] };
  const usetri = rozdielBodov(data, po, ja) - rozdielBodov(data, state, ja);
  const bitiek = kolPoTomto(state) + (state.ciel === null ? 0 : 1);
  return k.povaha.body * usetri - 0.5 * k.povaha.bitka * CENA_TUHEHO_ZA_BITKU * bitiek;
}

/** Cena utajenia Záverečnej (súper nevie, čo odpovedať) — hrubý odhad. */
const BONUS_ZAVERECNEJ = 0.25;

// --- Pitka -----------------------------------------------------------------

function pitka(v: Volba): Command | null {
  const { data, state, ja, k } = v;
  const su = opponentOf(ja);
  const h = state.hraci[ja];

  // Vízia: vrchnú kartu si nechá, ak je lepšia ako priemer balíčka; kliatby
  // a slabé karty zahodí — ale balíček nesmie klesnúť pod minimum (prehra).
  if (state.vizia !== null) {
    const vrchna = h.doberaci[0];
    const balicek = h.ruka.length + h.doberaci.length + h.odhadzovaci.length + partiaHraca(state, ja).length;
    // v5: prehra balíčkom pod 5 kariet neplatí — nepriznanú Cirhózu zahodí vždy, slabú kartu, kým balíček nie je tenký.
    const zahodit =
      vrchna !== undefined &&
      (vrchna.defId === "cirhoza" || vrchna.defId === "abstak" || (balicek > TENKY_BALICEK && hodnotaKarty(data, vrchna) < priemernaKarta(data, state, ja) - 0.3));
    // Krištáľová guľa (Náradie 2026-10-30): z dvoch vrchných vezme lepšiu, inak zahodí horšiu.
    const druha = h.doberaci[1];
    if (vrchna !== undefined && druha !== undefined && v.legal.some((c) => c.type === "vizia" && c.druha === true)) {
      const cena = (x: CardInstance): number => (x.defId === "cirhoza" || x.defId === "abstak" ? -99 : hodnotaKarty(data, x));
      const lepsiaDruha = cena(druha) > cena(vrchna);
      if (Math.max(cena(vrchna), cena(druha)) >= priemernaKarta(data, state, ja) - 0.3 || balicek <= TENKY_BALICEK) {
        return lepsiaDruha ? { type: "vizia", vziat: true, druha: true } : { type: "vizia", vziat: true };
      }
      return lepsiaDruha ? { type: "vizia", vziat: false } : { type: "vizia", vziat: false, druha: true };
    }
    return { type: "vizia", vziat: !zahodit };
  }

  const p = state.pitkaStav;
  if (p === null) return null;

  // Odpoveď na súperovo NA EX: jedna karta mimo limitu, ak pomôže.
  if (p.reakcia === ja) {
    return najlepsi(v, v.legal, (po) => hodnotaStavu(k, po, 1.5));
  }

  // Hospodárenie s cigaretami — poldeci navyše, karty fajčením; Chuť kŕmi koniec ťahu.
  const najdi = (typ: Command["type"]): Command | undefined => v.legal.find((c) => c.type === typ);
  const barter = najdi("barter");
  const refill = najdi("refillPoldeci");
  const smoke = najdi("smoke");
  const maCoTahat = h.doberaci.length + h.odhadzovaci.length > 0;
  // Finále: zdroje sa už len vykúpia. Doliatie mení 2 cigarety na plný poldeci (špak),
  // fajčenie a dorovnávanie nerestí (Absťák po finále nič nestojí) výkupné len berú.
  const finale = kolPoTomto(state) === 0;
  const skryte = (p.skryteNaex ?? []).filter((x) => x.hrac === ja).length;
  const vykupneTeraz = vykupneHraca(h, skryte).spaky;
  if (finale && refill !== undefined && vykupneHraca({ poldeciPlne: h.poldeciPlne + 1, cigarety: h.cigarety - KONSTANTY.REFILL_CENA }, skryte).spaky > vykupneTeraz) {
    return refill;
  }
  // Doliatie a barter: plný poldeci je limit vykladania a na konci výkupné; oproti cigaretám, ktoré stojí.
  const zdroje = k.povaha.zdroje;
  const ziskPoldeci = zdroje * (uzitokPoldeci(state, h.poldeciPlne + 1) - uzitokPoldeci(state, h.poldeciPlne)) + k.povaha.body * vahaVykupneho(state) * KONSTANTY.SPAKY_ZA_POLDECI + (h.ruka.length > h.poldeciPlne + 1 ? ZA_LIMIT_NAVYSE : 0);
  // Páka poldeci (Rudo: nalieva): barter pridá poldeci navyše, doliatie len otočí vypitý na plný.
  const nalievac = k.povaha.poldeci ?? 0;
  if (!finale && refill !== undefined && ziskPoldeci + 0.5 * nalievac > cenaCigariet(k, state, ja, KONSTANTY.REFILL_CENA)) return refill;
  if (barter !== undefined && (finale ? vykladaniPotom(state) > 0 : true) && ziskPoldeci + nalievac > cenaCigariet(k, state, ja, KONSTANTY.BARTER_CENA)) return barter;
  // Fajčenie: karta v ruke proti cigaretám (cena v jednej Pitke rastie 1, 2, 3…). Vo finále po
  // poslednom vykladaní už karta nič nedá, a cigareta môže byť špak z výkupného.
  const cenaFajc = cenaFajceniaHraca(state, ja);
  const fajcenieStoji = finale && vykladaniPotom(state) === 0 && vykupneHraca({ poldeciPlne: h.poldeciPlne, cigarety: h.cigarety - cenaFajc }, skryte).spaky < vykupneTeraz;
  const ziskKarty = zdroje * (uzitokRuky(state, ja, h.ruka.length + 1) - uzitokRuky(state, ja, h.ruka.length));
  if (smoke !== undefined && !fajcenieStoji && maCoTahat && ziskKarty > cenaCigariet(k, state, ja, cenaFajc)) return smoke;

  // Kšeft (v7): zahrá si ho nanečisto; berie, keď stav zlepší viac než o povahový prah.
  const ksefty = v.legal.filter((c) => c.type === "kseft");
  if (ksefty.length > 0) {
    const ohodnot = (po: GameState): number => hodnotaStavu(k, po, 1.5);
    const best = najlepsi(v, ksefty, ohodnot);
    const teraz = v.vzorky.reduce((a, s) => a + ohodnot(s), 0) / Math.max(1, v.vzorky.length);
    if (best !== null && priemer(v, best, ohodnot) > teraz + 0.25 + k.povaha.prahRiziko) return best;
  }

  // NA EX: zahrá si ho nanečisto aj so súperovou odpoveďou.
  const naex = v.legal.filter((c) => c.type === "naex");
  if (naex.length > 0) {
    // NA EX naraz (v5): skryté NA EX sa ráta, akoby už ležalo na karte; súper
    // naň odpovie až po odkrytí — ak má čím.
    const poOdpovedi = (po0: GameState): number => {
      let po = poOdkrytiNaex(po0, ja);
      if (po.hraci[su].ruka.length > 0) {
        const odpoved = najlepsieVylozenie(k, po, po.hraci[su].ruka, su, Number.POSITIVE_INFINITY);
        if (odpoved !== null) {
          po = {
            ...po,
            strany: sKartou(data, po, su, odpoved).strany,
            hraci: su === 0
              ? [{ ...po.hraci[0], ruka: po.hraci[0].ruka.filter((x) => x.uid !== odpoved.karta.uid) }, po.hraci[1]]
              : [po.hraci[0], { ...po.hraci[1], ruka: po.hraci[1].ruka.filter((x) => x.uid !== odpoved.karta.uid) }],
          };
        }
      }
      return hodnotaStavu(k, po, 1.5);
    };
    const best = najlepsi(v, naex, poOdpovedi);
    if (best !== null) {
      if (krcmaVyzaduje(data, state, ja)) return best;
      const s0 = v.vzorky[0] ?? state;
      const bez = hodnotaStavu(k, sNaexNaKartach(s0), 1.5);
      // Súperova Bzdocha: NA EX vidí skôr, než dohrá svoju časť Pitky — prekvapenie je preč.
      const vidno = p.bzdocha === su ? BZDOCHA_NAEX : 0;
      if (priemer(v, best, poOdpovedi) > bez + k.povaha.prahRiziko + vidno) return best;
    }
  }
  // Koniec ťahu v Pitke: nakŕmiť Chuť fajčením, keď je to lacné, inak príde Absťák (v9.1).
  // Doliatie ani barter nerest nie sú. Drahé fajčenie by spálilo zbytočne veľa cigariet.
  const chyba = chybajuceNeresti(k, state, ja);
  if (!finale && chyba > 0 && smoke !== undefined && maCoTahat && cenaFajc <= chyba + 1) return smoke;
  return najdi("skipNaex") ?? null;
}

/**
 * Skryté NA EX hráča ja odkryté tak, ako ich odkryje jadro: poldeci na karte,
 * pečeň +1 tomu, kto NA EX dal, nerest. Samotné
 * sNaexNaKartach pečeň ani cigarety neráta — bot by NA EX pod súperovým
 * pečeňou dával, akoby nič nestálo. Rany od súperovej Svokry ráta odhad
 * bitky (bitkaMody). Policajtka vo v7 za NA EX Dlh nedáva — len Konflikt
 * pri priložení, ten ráta simulácia vyloženia.
 */
function poOdkrytiNaex(s: GameState, ja: PlayerId): GameState {
  const pocet = (s.pitkaStav?.skryteNaex ?? []).filter((x) => x.hrac === ja).length;
  const po = sNaexNaKartach(s);
  if (pocet === 0) return po;
  const su = opponentOf(ja);
  const h = po.hraci[ja];
  // Nerest NA EX ráta stavZavislosti z poldeci na karte (×2) — nepripisuje sa dvakrát.
  const moj = { ...h, pecen: h.pecen + pocet };
  const jeho = po.hraci[su];
  return { ...po, hraci: ja === 0 ? [moj, jeho] : [jeho, moj] };
}

// --- Bitka -----------------------------------------------------------------

function bitka(v: Volba): Command | null {
  const { data, state, ja, k } = v;
  const b = state.bitkaStav;
  if (b === null) return null;
  const h = state.hraci[ja];
  const ohodnot = (po: GameState): number => hodnotaStavu(k, po, 3);

  switch (b.krok) {
    case "prebytok":
    case "reci": {
      // Rozdelenie (v11) má veľa podôb — skryté karty ho takmer nemenia, stačí jedna vzorka.
      // Zajatie či presvedčenie (v11.4) berie, keď je lepšie o prah povahy než rozdelenie bez neho.
      const jedna = { ...v, vzorky: v.vzorky.slice(0, 1) };
      const sAkciou = (c: Command): boolean => (c.type === "prebytok" && (c.zajatia?.length ?? 0) > 0) || (c.type === "reci" && (c.presvedcenia?.length ?? 0) > 0);
      const bez = najlepsi(jedna, v.legal.filter((c) => !sAkciou(c)), ohodnot);
      const akcie = v.legal.filter(sAkciou);
      if (akcie.length === 0) return bez;
      const s = najlepsi(jedna, akcie, ohodnot);
      if (s === null || bez === null) return s ?? bez;
      // Schopnosť väzňa (raz za hru) hodnota stavu nevidí — zajatie ju dá navyše.
      const schopnosti = s.type === "prebytok" ? (s.zajatia?.length ?? 0) * SCHOPNOST_VAZNA : 0;
      return priemer(jedna, s, ohodnot) + schopnosti >= priemer(jedna, bez, ohodnot) + k.povaha.prahStarsi ? s : bez;
    }
    case "cintorin": {
      // Cintorín: zadarmo do Dedičstva najcennejší Nástroj z ruky alebo zo šenku.
      let best: Command | null = null;
      let bestV = 0;
      for (const cmd of v.legal) {
        if (cmd.type !== "cintorin" || cmd.uid === null) continue;
        const karta = [...h.ruka, ...state.senok].find((x) => x.uid === cmd.uid);
        const hodnota = karta === undefined ? 0 : 1 + (DEDICSTVO[karta.defId] ?? 0);
        if (hodnota > bestV) {
          bestV = hodnota;
          best = cmd;
        }
      }
      return best ?? { type: "cintorin", uid: null };
    }
    case "vestica": {
      const su = opponentOf(ja);
      const moje = h.doberaci;
      const jeho = state.hraci[su].doberaci;
      // Presvedčený starší (v11.4) sa nevymieňa — engine by taký ťah odmietol.
      const volne = (karty: readonly CardInstance[]): number[] => karty.flatMap((x, i) => (majitelPresvedcenej(state, x.uid) === null ? [i] : []));
      const hodnota = (karty: readonly CardInstance[], i: number): number => hodnotaKarty(data, karty[i] as CardInstance);
      const moja = volne(moje).reduce((a, i) => (hodnota(moje, i) < hodnota(moje, a) ? i : a), volne(moje)[0] ?? 0);
      const jehoI = volne(jeho).reduce((a, i) => (hodnota(jeho, i) > hodnota(jeho, a) ? i : a), volne(jeho)[0] ?? 0);
      return { type: "vestica", moja, jeho: jehoI };
    }
    default:
      return null;
  }
}

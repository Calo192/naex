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
//  - pri vykladaní, NA EX, Pohoršení a prebytku si zahrá
//    dopredu na kópii stavu tým istým jadrom (apply, evaluateLine): po svojom
//    ťahu dohrá Zhromaždenie, v ktorom obaja vykladajú chamtivo,
//  - drobné voľby (draft, fajčenie, priznanie, limit ruky…) robí pravidlami.
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

import type { Action, CardInstance, PlayerId } from "./types.ts";
import { ALL_FAVOURS, opponentOf } from "./types.ts";
import type { GameData } from "./data.ts";
import { defOf, printedSides } from "./data.ts";
import type { RngState } from "./rng.ts";
import { rngInt, rngNext, rngSeed, rngShuffle } from "./rng.ts";
import type { PlacedCard } from "./partia.ts";
import { evaluateLine } from "./partia.ts";
import { KONSTANTY } from "./constants.ts";
import { spakyPriExekucii, zhoriPriExekucii } from "./battle.ts";
import type { ElderState, MarkerPos } from "./elders.ts";
import { sPosunutymMarkerom, spakyZaStarsich, strachNaUdrzanieSpolu, strachZ, vydesil } from "./elders.ts";
import { efektHraca, efektPotlaceny, jeCielLokalita, limitZhromazdenia, partiaHraca } from "./effects.ts";
import { stranyLokality } from "./hrany.ts";
import { stavZavislosti } from "./zavislost.ts";
import type { Command, GameState } from "./engine.ts";
import {
  apply,
  barterCena,
  cieleVykladania,
  cielLokalitaId,
  krcmaVyzaduje,
  kartyZaPas,
  sPrilozenou,
  krokStavby,
  legalCommands,
  naexCieleVLinii,
  sNaexNaKartach,
  silaPriazne,
  lineState,
  poskodenieBitky,
  pohorseniaVBitke,
  jeFinale,
  kartyBitky,
  zahradkarChrani,
  jeKartaBossa,
  prahyHraca,
  spakyZaVaznov,
  vazniHraca,
  priazen,
  uidZaverecnej,
  verejneAbstaky,
  nepriznaneCirhozy,
  vykupneHraca,
  vyplatZaStarsich,
  cenaFajceniaHraca,
} from "./engine.ts";

/**
 * Povaha offline protihráča — tie isté výpočty, iné váhy. Všetky tri hrajú
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
  /** O koľko lepší musí byť pokus o zajatie (v9; do v8 patronát) než nič. */
  readonly prahStarsi: number;
  /** Rozdiel hodnôt, pod ktorým sú ťahy „rovnako dobré“ a vyberá medzi nimi náhodne. */
  readonly nahodnost: number;
}

export const POVAHY: readonly Povaha[] = [
  {
    id: "stamgast",
    meno: "Štamgast",
    popis: "Vyvážený — bije sa, keď sa oplatí, a ráta body.",
    bitka: 1,
    body: 1,
    zdroje: 1,
    kliatby: 1,
    prahRiziko: 0.2,
    prahStarsi: 0.5,
    nahodnost: 0.15,
  },
  {
    id: "rapavy_fero",
    meno: "Rapavý Fero",
    popis: "Agresívny — chce každú bitku, pije, dáva NA EX a o kliatby sa nestará.",
    bitka: 1.35,
    body: 0.85,
    zdroje: 0.8,
    kliatby: 0.7,
    prahRiziko: -0.3,
    prahStarsi: -0.5,
    nahodnost: 0.2,
  },
  {
    id: "teta_gizka",
    meno: "Teta Gizka",
    popis: "Šetrná a vypočítavá — hrá na body, šetrí cigarety a poldeci, vyhýba sa kliatbám.",
    bitka: 0.85,
    body: 1.3,
    zdroje: 1.3,
    kliatby: 1.4,
    prahRiziko: 0.6,
    prahStarsi: 1.5,
    nahodnost: 0.1,
  },
];

/** Povaha podľa id; neznáme id = Štamgast. */
export function povahaBota(id: string | undefined): Povaha {
  return POVAHY.find((p) => p.id === id) ?? (POVAHY[0] as Povaha);
}

export interface BotNastavenia {
  /** Koľko zamiešaní skrytých informácií sa prepočíta pri dôležitej voľbe. */
  readonly vzorky?: number;
  /** Id povahy (POVAHY); predvolený je Štamgast. */
  readonly povaha?: string;
}

// ---------------------------------------------------------------------------
// Hodnota kariet a akcií (ladené turnajom bot proti botovi, tools/bot/turnaj.ts)

/** Hodnota aktívnej akcie pre hráča, ktorému sa pripíše. */
const VAHA_AKCIE: Readonly<Record<Action, number>> = {
  Rana: 1,
  Pecka: 2,
  Petelica: 3,
  Povera: 0.4,
  Pohoršenie: 0.7,
  Viera: 1,
  Dlh: -0.8,
  PoškodeniePečene: -0.5,
  Obmedzenie: 0.3,
  Cigareta: 0.4,
  Vízia: 0.15,
  Poldeci: 0.5,
  Posilnenie: 0.6,
  Odpor: 0.3,
  // v8.4: Robota bez Dlhu dá špak — nikdy nie je hluchá.
  Robota: 0.6,
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
  podvodnik: 0.3,
  anonymny_alkoholik: 0.2,
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
  sofer: 0.3,
  snubenica: 0.5,
  zivnostnik: 0.4,
  velmi_smutiaca_vdova: 0.4,
  niekoho_stryna: 0.3,
  kapybara: 0.4,
  stryko_z_ameriky: 0.5,
  krokodil: 0.4,
  kon: 0.3,
  kohut: 0.3,
  pijan: 0.3,
  degustatorka: 0.3,
  klebetnica: 0.3,
  // Nástup presunie súperovu kartu z druhej strany — účinok ráta simulácia vyloženia (sPrilozenou).
  dohadzovacka: 0.3,
  masiar: 0.2,
  kulturista: 0.2,
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
  // v7: špaky za prehranú bitku, keď má víťaz viac priznaných Dlhov.
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
 * a Veriaci menia tuhé, Abstinent dáva Pohoršenia, kým „do dna“
 * zaberú len pri NA EX a Kmotor len pri priznanom Dlhu. Súperovi tak bot
 * dáva tú, ktorá mu v tejto partii urobí najmenej (Michal 2026-10-24).
 * Exekútor tu nie je — nižší prah súpera už ráta hodnotaZdrojov.
 */
const PRIAZEN_ZA_BITKU = {
  BITKAR: 1.2,
  VERIACI: 0.9,
  LAKOMEC: 0.7,
  FAJCIAR: 0.5,
  /** Za špak, ktorý Advokát ušetrí pri exekúcii (len s priznaným Dlhom). */
  ADVOKAT: 0.8,
  /** Za akciu Robota navyše — spáli Dlh, alebo dá špak. */
  ROBOTA: 0.9,
  /** Plný poldeci namiesto vypitého. */
  DO_DNA: 0.6,
  /** Za priznaný Dlh, ktorý Kmotor presunie súperovi (v8): mne ubudne, jemu pribudne. */
  UZERNIK: 1.0,
} as const;
/** Pravdepodobnosť, že priazeň vydrží do ďalšej bitky (prebytok a Pohoršenie markery hýbu). */
const VYDRZ_PRIAZNE = 0.6;
/** Koľko NA EX dá hráč priemerne za bitku (partie botov v5). */
const NAEX_ZA_BITKU = 0.35;

/** Hodnota karty v balíčku — čím vyššia, tým radšej ju bot má. */
export function hodnotaKarty(data: GameData, karta: CardInstance): number {
  if (karta.defId === "cirhoza") return -3;
  // Absťák (v9.1): mŕtvy ťah a −1 tuhé v každej bitke, kým je v balíčku.
  if (karta.defId === "abstak") return -2;
  const def = defOf(data, karta);
  const strany = printedSides(data, karta);
  let akcie = 0;
  for (const slot of [...strany.left, ...strany.right]) if (slot !== null) akcie += VAHA_AKCIE[slot];
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
  // Boss v súperovej ruke (pokus o zajatie, v9) je verejný — do miešania nejde, ostáva v ruke.
  const bossovia = on.ruka.filter((x) => jeKartaBossa(state, x.uid));
  // Aj súperova skrytá Záverečná v línii — na jej miesto ide náhodná z jeho skrytých kariet.
  const zaverecne = ([0, 1] as const).flatMap((strana) =>
    state.strany[strana].flatMap((pl, index) => (pl.zaverecna === true && pl.playedBy === su ? [{ strana, index, karta: pl.card }] : [])),
  );
  const [skryte, r1] = rngShuffle(r, poUid([...on.ruka.filter((x) => !bossovia.includes(x)), ...on.doberaci, ...zaverecne.map((z) => z.karta)]));
  const [mojBalicek, r2] = rngShuffle(r1, poUid(state.hraci[ja].doberaci));
  const [naradie, r2b] = rngShuffle(r2, poUid(state.naradie));
  const [obcania, r3] = rngShuffle(r2b, poUid(state.obcania));
  const [seed, r4] = rngInt(r3, 2 ** 31);
  r = r4;
  const naZaverecne = skryte.slice(0, zaverecne.length);
  const zvysok = skryte.slice(zaverecne.length);
  const skrytaRuka = on.ruka.length - bossovia.length;
  const superHrac = { ...on, ruka: [...bossovia, ...zvysok.slice(0, skrytaRuka)], doberaci: zvysok.slice(skrytaRuka) };
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
 * nepriznané Cirhózy (ich počet je verejný), výkupné zdrojov a strach starších
 * (strachVOdhade) a väzni (v9). Starší sa smú nahradiť (pokus o zajatie, náhľad posunu).
 */
function rozdielBodov(_data: GameData, s: GameState, ja: PlayerId, starsi: readonly ElderState[] = s.starsi): number {
  const su = opponentOf(ja);
  const odhad = (p: PlayerId): number =>
    s.spaky[p] -
    KONSTANTY.SPAKY_ZA_CIRHOZU * nepriznaneCirhozy(s.hraci[p]) +
    vykupneVOdhade(s, p) +
    strachVOdhade(s, p, starsi) +
    spakyZaVaznov(s, p) -
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

/**
 * Strach v odhade (v8.3, Michal 2026-10-30): stupne držané od minulého kola zaplatí
 * koniec tohto kola naplno (súper ich ešte môže odtlačiť, to už vidí výpočet dopredu),
 * nové stupne až koniec ďalšieho kola, ak sa udržia (VYDRZ_POSUNU); keď ďalší koniec
 * kola nepríde (finále), nové stupne nič. Výhra bitky na strachu nič nemení.
 */
function strachVOdhade(s: GameState, p: PlayerId, starsi: readonly ElderState[] = s.starsi): number {
  const n = vyplatZaStarsich(s);
  if (n === 0) return 0;
  return spakyZaStarsich(starsi, p) + (n > 1 ? VYDRZ_POSUNU * strachNaUdrzanieSpolu(starsi, p) : 0);
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
  return n * 0.3 * k.buducnost * k.povaha.zdroje + k.povaha.body * (vykupneVOdhade(s, p, c) - vykupneVOdhade(s, p, c - n));
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
 * oproti prehre je dvojnásobok. Strach starších od v8.3 v stávke nie je — platí
 * za udržanie na konci kola, nech bitku vyhrá ktokoľvek.
 */
function stavkaBitky(_data: GameData, s: GameState, _ja: PlayerId): number {
  if (s.ciel === null) return 0;
  // Pokus o zajatie (v9): víťaz bitky rozhodne, či bude väzeň.
  let pokusy = 0;
  for (const q of [0, 1] as const) if (s.pokusy[q] !== null) pokusy += hodnotaVazna(s, q);
  return 2 * s.spakyNaSekere + pokusy;
}

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
 * Pohoršenia, Dlhy, pečeň). `ostrost` = istota výsledku (v Zhromaždení môže
 * súper ešte odpovedať, v bitke je rozhodnuté).
 */
function hodnotaBitky(k: Kontext, s: GameState, q: PlayerId, ostrost: number): number {
  const data = k.data;
  const o = opponentOf(q);
  const sums = evaluateLine(data, lineState(s)).sums;
  const dmg = poskodenieBitky(data, s, sums);
  // Remíza v tuhom (v6): vyhrá menej Absťákov, potom menej priznaných Dlhov, inak sekera (šanca ½).
  const remiza = (p: PlayerId): [number, number] => [verejneAbstaky(s, p), prahyHraca(data, s, p).priznaneDlhy];
  const [aq, dq] = remiza(q);
  const [ao, dO] = remiza(o);
  const tuhe = dmg.tuhe[q] - dmg.tuhe[o];
  const m = tuhe !== 0 ? tuhe : aq !== ao ? 0.5 * Math.sign(ao - aq) : 0.5 * Math.sign(dO - dq);
  const celk = dmg.celkove[q] - dmg.celkove[o];
  const sanca = 1 / (1 + Math.exp(-ostrost * m));
  // Vo finále je Nakladačka priamo špaky (v9.1) — bez stropu, každý bod rozdielu sa ráta.
  const prebytok = jeFinale(s) ? celk : Math.max(-PREBYTOK_STROP, Math.min(PREBYTOK_STROP, celk));
  let v = k.povaha.bitka * (k.stavka * (sanca - 0.5) + kartyVStavke(s, q, sanca) + cenaBoduPrebytku(s) * prebytok);

  // Akcie, ktoré sa vyhodnotia až v Pitke — po nej už sú v stave.
  if (s.faza === "zhromazdenie" || s.faza === "pitka") {
    const pohorsenia = pohorseniaVBitke(data, s, sums);
    const zaPohorsenie = cenaPosunu(s);
    for (const p of [q, o] as const) {
      const sp = sums[p];
      const so = sums[opponentOf(p)];
      const h = s.hraci[p];
      let w = 0;
      // Výkupné: cigareta z Pitky a poldeci otočený v bitke na plný sú na konci hry aj špaky.
      const vykupne = k.povaha.body * vahaVykupneho(s);
      w += (0.3 * k.buducnost + vykupne / KONSTANTY.CIGARIET_ZA_SPAK) * Math.max(0, (sp.Cigareta ?? 0) - (so.Obmedzenie ?? 0));
      // Pohoršenie je bod posunu markera bez limitu — nový stupeň zaplatí raz, keď sa
      // udrží do konca ďalšieho kola (v8.3); pevných 0,5 za kus podceňovalo karty s Pohoršením.
      w += zaPohorsenie * Math.min(POHORSENIE_STROP, pohorsenia[p]);
      // Povera (v8.3): zvyšná po Viere posunie silu priazne o stupeň na toto kolo — nikdy hluchá.
      w += ZA_POVERU * Math.min(POHORSENIE_STROP, dmg.zvysnaPovera[p]);
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
      w -= k.povaha.kliatby * (1.5 * (sp.Dlh ?? 0) + 0.15 * pecen + blizko);
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
  v += (1.0 * h.poldeciPlne + 0.35 * (h.poldeciVypite + s.strany.flat().filter((pl) => pl.naexBy === p).length)) * f;
  v += 0.3 * h.cigarety * f;
  v += 0.3 * h.ruka.length * f;
  v *= k.povaha.zdroje;
  // Absťák (v9.1): karta v balíčku — o ranu menej v každej bitke a mŕtvy ťah.
  let postih = 0.7 * verejneAbstaky(s, p);
  // Priznaný Dlh: remíza v bitke, súperove Povery; špaky, ktoré zhoria pri exekúcii, ráta rozdielBodov.
  postih += 0.3 * prahyHraca(k.data, s, p).priznaneDlhy;
  postih += hrozbaAbstaku(k, s, p);
  v -= k.povaha.kliatby * postih;
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
 * Priazne hráča p v bitkách, ktoré ešte prídu. Prebiehajúcu bitku ráta
 * hodnotaBitky so skutočnou priazňou (Pohoršenie k sebe platí hneď).
 */
function hodnotaPriazni(k: Kontext, s: GameState, p: PlayerId): number {
  const n = kolPoTomto(s);
  if (n === 0) return 0;
  let bitiek = 0;
  for (let j = 0; j < n; j++) bitiek += VYDRZ_PRIAZNE ** j;
  const pv = k.povaha;
  let v = 0;
  for (const fav of ALL_FAVOURS) {
    const sila = priazen(k.data, s, fav, p) / KONSTANTY.NASOBOK_PRIAZNE;
    if (sila <= 0) continue;
    switch (fav) {
      case "BITKAR":
        v += sila * PRIAZEN_ZA_BITKU.BITKAR * pv.bitka * bitiek;
        break;
      case "VERIACI":
        v += sila * PRIAZEN_ZA_BITKU.VERIACI * pv.bitka * bitiek;
        break;
      case "LAKOMEC":
        v += sila * PRIAZEN_ZA_BITKU.LAKOMEC * pv.body * bitiek;
        break;
      case "FAJCIAR":
        v += sila * PRIAZEN_ZA_BITKU.FAJCIAR * pv.zdroje * bitiek;
        break;
      case "ROBOTA":
        // Akcie Robota navyše (v9): spália Dlh, alebo dajú špak.
        v += sila * PRIAZEN_ZA_BITKU.ROBOTA * pv.body * bitiek;
        break;
      case "ALKOHOLIK":
        // „Do dna“: plný poldeci namiesto vypitého, najviac za sila NA EX v kole — NA EX je zriedka viac.
        v += Math.min(sila, 1) * NAEX_ZA_BITKU * PRIAZEN_ZA_BITKU.DO_DNA * pv.zdroje * bitiek;
        break;
      case "UZERNIK": {
        // Kmotor bez priznaného Dlhu nerobí nič; presunie ich súperovi najviac toľko, koľko mám.
        const dlhy = prahyHraca(k.data, s, p).priznaneDlhy;
        v += Math.min(dlhy, (sila + 1) * bitiek) * PRIAZEN_ZA_BITKU.UZERNIK * pv.kliatby;
        break;
      }
      case "ADVOKAT": {
        // Advokát ušetrí špaky len pri exekúcii — s priznaným Dlhom.
        const dlhy = prahyHraca(k.data, s, p).priznaneDlhy;
        if (dlhy > 0) v += Math.min(sila, zhoriPriExekucii(dlhy)) * PRIAZEN_ZA_BITKU.ADVOKAT * pv.body * bitiek;
        break;
      }
    }
  }
  return v;
}

/**
 * Postup k výhre väzňami (v9): špaky za väzňov sú v rozdiele bodov, tu je ich
 * hodnota navyše — blízkosť tretieho väzňa (výhra), Kšefty a starší na stupni 3,
 * ktorých sa dá skúsiť zajať.
 */
function hodnotaVydesenia(s: GameState, p: PlayerId): number {
  const vazni = vazniHraca(s, p).length;
  const ciele = s.starsi.filter((e) => vydesil(e, p)).length;
  const zostava = kolPoTomto(s) + (s.ciel === null ? 1 : 0);
  let v = vazni * (2 + 1.5 * Math.min(zostava, 3));
  if (vazni >= KONSTANTY.VAZNI_NA_VYHRU - 1 && zostava > 0) v += VAZEN_PRED_VYHROU + (ciele > 0 ? 10 : 0);
  if (zostava > 0) v += 1.5 * ciele + 0.4 * s.starsi.filter((e) => strachZ(e, p) === 2).length;
  return v;
}

/** Druhý väzeň — tretí vyhráva. */
const VAZEN_PRED_VYHROU = 20;

/** Čo pokúšajúcemu q prinesie väzeň, ak vyhrá bitku (v9) — pre stávku bitky aj voľbu pokusu. */
function hodnotaVazna(s: Pick<GameState, "vazni">, q: PlayerId): number {
  const poradie = s.vazni.length + 1;
  const vyhra = vazniHraca(s, q).length + 1 >= KONSTANTY.VAZNI_NA_VYHRU;
  return (KONSTANTY.SPAKY_ZA_VAZNOV[poradie - 1] ?? 0) + 4 + (vyhra ? 200 : 0);
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
 * tohto by posledné Pohoršenie útočníka (po ňom sa poškodenie vyhodnotí hneď)
 * nevidelo, že Pohoršenie k sebe (Bitkár, Veriaci) bitku vyhrá.
 */
function hodnotaVysledku(k: Kontext, s: GameState, b: NonNullable<GameState["bitkaStav"]>): number {
  // Špaky za bitku sú po výsledku už v popolníkoch, strach na konci kola ráta rozdielBodov.
  // Nerozdelený prebytok ako v hodnotaBitky; cigarety za prebytok dostane súper držiteľa až po bitke.
  const ja = k.ja;
  const drzi = b.prebytokDrzi;
  const prebytok = drzi === null ? 0 : (drzi === ja ? 1 : -1) * Math.min(6, b.prebytokZostava);
  const cigarety = drzi === null ? 0 : (drzi === ja ? -1 : 1) * 0.3 * k.buducnost * k.povaha.zdroje * b.prebytokPosunute.length;
  return k.povaha.bitka * cenaBoduPrebytku(s) * prebytok + cigarety;
}

/**
 * Čo jeden bod prebytku (posun markera po špakoch tejto bitky) prinesie
 * držiteľovi v špakoch (cenaPosunu). Vo finále sa nerozdeľuje — víťaz zaň dostane
 * špaky 1 : 1 (v9.1).
 */
function cenaBoduPrebytku(s: GameState): number {
  return jeFinale(s) ? KONSTANTY.SPAKY_ZA_NAKLADACKU_VO_FINALE : cenaPosunu(s);
}

/**
 * Čo prinesie jeden bod posunu markera od seba (bod prebytku, Pohoršenie) v špakoch,
 * v8.3: nový stupeň zaplatí raz (ZONA_ZA_BOD), až keď sa udrží do konca ďalšieho
 * kola (VYDRZ_POSUNU). Keď ďalší koniec kola nepríde (finále), posun má len obrannú
 * cenu — odtlačiť súperov držaný stupeň skôr, než ho koniec kola zaplatí.
 */
function cenaPosunu(s: GameState): number {
  const dalsichKoncovKola = vyplatZaStarsich(s) - (s.ciel === null ? 0 : 1);
  return dalsichKoncovKola > 0 ? ZONA_ZA_BOD * VYDRZ_POSUNU : OBRANA_ZA_BOD;
}

/** Bod posunu, ktorý už nový stupeň nezaplatí — odtlačenie súperovho držaného stupňa (turnaj v8.3). */
const OBRANA_ZA_BOD = 0.5;

/**
 * Špaky zóny na jeden bod posunu (v8.2, Michal 2026-10-30): pole von zo stredu stojí
 * toľko bodov, koľko zóna zaplatí (žltá 1, oranžová 2, červená 3), ústup k stredu je
 * drahší a nezaplatí nič — bod teda vynesie najviac 1. Do v8.1 bolo pole za bod (1,5).
 */
const ZONA_ZA_BOD = 1;

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

/** Koľko z hodnoty posunu markera ostane, keď ho súper môže odtlačiť späť (turnaj v6). */
const VYDRZ_POSUNU = 0.6;
/** Stupeň priazne na jedno kolo z jednej Povery (v8.3) — v bitke ho bot ráta presne (najlepsi). */
const ZA_POVERU = 0.5;
/** Strop prebytku a Pohoršení v odhade bitky — markerov a polí je konečne veľa. */
const PREBYTOK_STROP = 8;
const POHORSENIE_STROP = 6;

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
  const cenaKarty = 0.3 * k.buducnost;
  let najlepsie: Vylozenie | null = null;
  let najlepsiaHodnota = pred + 0.05;
  const videne = new Set<string>();
  for (const karta of ruka) {
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

/**
 * Hodnota stavu, keď hráč q ešte dá najlepšie NA EX (alebo žiadne) — pre
 * odhad rundy „Ešte jednu!“, po ktorej príde nová Pitka.
 */
function sNajlepsimNaex(k: Kontext, s: GameState, q: PlayerId, ostrost: number): number {
  let best = hodnotaStavu(k, s, ostrost);
  if (s.hraci[q].poldeciPlne <= 0) return best;
  for (const uid of naexCieleVLinii(k.data, lineState(s), q)) {
    const cielena = (pl: PlacedCard, si: number): boolean => pl.card.uid === uid || (pl.zaverecna === true && uid === uidZaverecnej(si as PlayerId));
    const strany = s.strany.map((strana, si) => strana.map((pl) => (cielena(pl, si) ? { ...pl, naexBy: q } : pl))) as unknown as GameState["strany"];
    const h = s.hraci[q];
    const hrac = { ...h, poldeciPlne: h.poldeciPlne - 1, pecen: h.pecen + 1, nerestiTotoKolo: h.nerestiTotoKolo + 1 };
    const po: GameState = { ...s, strany, hraci: q === 0 ? [hrac, s.hraci[1]] : [s.hraci[0], hrac] };
    best = Math.max(best, hodnotaStavu(k, po, ostrost));
  }
  return best;
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
  const legal = legalCommands(data, state, ja);
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
    stavka: stavkaBitky(data, state, ja),
    buducnost: buducnostHry(state),
    povaha: povahaBota(nastavenia.povaha),
  };
  const volba: Volba = { data, state, ja, legal, vzorky, k, nahoda };

  // Voľby, ktoré menia stôl (Dohadzovačka v6, Kapybara, Nástroj za Živnostníka), si zahrá nanečisto.
  const typ = state.hasicVolby?.[0]?.typ;
  if (typ === "dohadzovacka" || typ === "kapybara" || typ === "nastroj") return najlepsi(volba, legal, (po) => hodnotaStavu(k, po, 1.5)) ?? prvy;
  const cmd = rozhodni(volba);
  return cmd ?? prvy;
}

/** Hasič: kliatbu bot vráti do odhadzovacieho balíčka, inú kartu si nechá. */
function volbaHasica(data: GameData, state: GameState): Command | null {
  const volba = state.hasicVolby?.[0];
  if (volba === undefined) return null;
  if (volba.typ === "klebetnica") {
    // Klebetnica (v7): súperovi pošle naspodok jeho najlepšiu kartu v ruke.
    const ruka = state.hraci[opponentOf(volba.hrac)].ruka;
    const best = [...ruka].sort((a, b) => hodnotaKarty(data, b) - hodnotaKarty(data, a))[0];
    return best === undefined ? null : { type: "klebetnica", uid: best.uid };
  }
  if (volba.typ === "dohadzovacka" || volba.typ === "kapybara" || volba.typ === "nastroj") return null;
  if (volba.typ === "senok") {
    // Starosta, Dohadzovačka (v7): zo šenku najlepšiu kartu.
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
  const { data, state, ja, k } = v;
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
  return vsetky.reduce((a, x) => a + hodnotaKarty(data, x), 0) / vsetky.length;
}

function draft(v: Volba): Command | null {
  const { data, state, ja } = v;
  const d = state.draftStav;
  if (d === null) return null;
  if (d.krok === "zajatie") return pokus(v);
  if (d.krok === "stavba") {
    // Najlepšie karty do šenku (inak ich tam dá súper). Útočník berie zo šenku
    // druhý (v9.2) — ďalšie dobré radšej pošle naspodok, než by ich podal súperovi.
    const zoradene = [...d.balicky[ja]].sort((a, b) => hodnotaKarty(data, b) - hodnotaKarty(data, a));
    const krok = krokStavby(zoradene.length);
    const doSenku = zoradene.slice(0, krok.doSenku);
    const zvysok = zoradene.slice(krok.doSenku);
    const odhod = state.utocnik !== ja ? zvysok.slice(zvysok.length - krok.odhod) : zvysok.slice(0, krok.odhod);
    return { type: "stavbaSenku", doSenku: doSenku.map((x) => x.uid), odhod: odhod.map((x) => x.uid) };
  }
  // Branie zo šenku (Michal 2026-10-19): 1 karta za cigaretu, 2 karty za 3.
  const ponuka = [...state.senok].sort((a, b) => hodnotaKarty(data, b) - hodnotaKarty(data, a));
  const najlepsia = ponuka[0];
  if (najlepsia === undefined) return { type: "draftStop" };
  const druha = ponuka[1];
  // Zisk karty do balíčka oproti tomu, čo stojí. Cigareta je platidlo
  // (šenok, Dedičstvo, pokus o zajatie) a na konci hry výkupné (5 za špak).
  const { k } = v;
  const h = state.hraci[ja];
  const priemer = priemernaKarta(data, state, ja);
  const balicek = h.ruka.length + h.doberaci.length + h.odhadzovaci.length;
  // V poslednom kole karta zo šenku pomôže už len v tejto bitke; cigareta ostáva do bodovania.
  const posledne = kolPoTomto(state) === 0;
  const zisk = (x: CardInstance | undefined): number =>
    x === undefined ? 0 : (hodnotaKarty(data, x) - priemer + 0.5 + (balicek < 10 && !posledne ? 0.6 : 0)) * (posledne ? 0.6 : 1);
  const mozne = (uids: readonly number[]): Command | null =>
    v.legal.find((c) => c.type === "draftBer" && c.uids.length === uids.length && uids.every((u) => c.uids.includes(u))) ?? null;
  const jedna = mozne([najlepsia.uid]);
  const dve = druha === undefined ? null : mozne([najlepsia.uid, druha.uid]);
  const zaJednu = zisk(najlepsia) - cenaCigariet(k, state, ja, KONSTANTY.CENA_SENKU[1] ?? 1);
  const zaDve = zisk(najlepsia) + zisk(druha) - cenaCigariet(k, state, ja, KONSTANTY.CENA_SENKU[2] ?? 3);
  if (dve !== null && zaDve > 0 && zaDve > zaJednu) return dve;
  if (jedna !== null && zaJednu > 0) return jedna;
  return { type: "draftStop" };
}

/**
 * Pokus o zajatie (v9, Michal 2026-10-30) — odhad zo špakov: pri výhre väzeň (špaky
 * podľa poradia, Kšeft, tretí vyhráva) a starší zmizne zo stupnice, pri prehre marker
 * ustúpi o stupeň (nezaplatená červená prepadne). Cigareta prepadne vždy a boss ide
 * súperovi do ruky. Výsledok bitky je pred Zhromaždením neistý.
 */
function pokus(v: Volba): Command | null {
  const { data, state, ja, k } = v;
  const su = opponentOf(ja);
  const bez = v.legal.find((c) => c.type === "bezPokusu") ?? null;
  const hodnotaStarsich = (starsi: readonly ElderState[]): number => {
    const s = { ...state, starsi };
    return k.povaha.body * (rozdielBodov(data, s, ja, starsi) - hodnotaVydesenia(s, su)) + hodnotaPriazni(k, s, ja) - hodnotaPriazni(k, s, su);
  };
  const teraz = hodnotaStarsich(state.starsi);
  const sanca = 0.5;
  let best: Command | null = null;
  let bestV = k.povaha.prahStarsi;
  for (const cmd of v.legal) {
    if (cmd.type !== "pokus") continue;
    const elder = state.starsi.find((e) => e.elderId === cmd.elderId);
    if (elder === undefined) continue;
    const poVyhre = hodnotaStarsich(state.starsi.filter((e) => e.elderId !== elder.elderId)) + k.povaha.body * hodnotaVazna(state, ja);
    const spat = (elder.marker < 3 ? elder.marker + 1 : elder.marker - 1) as MarkerPos;
    const poPrehre = hodnotaStarsich(state.starsi.map((e) => (e.elderId === elder.elderId ? sPosunutymMarkerom(e, spat) : e)));
    const hodnota =
      sanca * (poVyhre - teraz) +
      (1 - sanca) * (poPrehre - teraz) -
      cenaCigariet(k, state, ja, KONSTANTY.CENA_POKUSU) -
      0.5 * hodnotaKarty(data, elder.karta) +
      0.4 * k.povaha.bitka;
    if (hodnota > bestV) {
      bestV = hodnota;
      best = cmd;
    }
  }
  return best ?? bez;
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
    moznosti.push(cmd);
  }
  // Záverečná: blok súperovej odpovede na tej strane už dohrá dohrajZhromazdenie
  // (súper za ňu nepriloží); utajenie karty do konca Pitky má malú cenu navyše.
  const sZaverecnou = (po: GameState): number =>
    po.strany.some((strana) => strana.some((pl) => pl.zaverecna === true && pl.playedBy === ja)) ? BONUS_ZAVERECNEJ * k.buducnost : 0;
  return najlepsi(v, moznosti, (po) => hodnotaStavu(k, dohrajZhromazdenie(k, po), 0.9) + sZaverecnou(po));
}

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
  // Fajčenie zdražie s každým v tej istej Pitke (1, 2, 3… cigarety, 2026-10-27): drahšie len s tenkou rukou.
  const cenaFajc = cenaFajceniaHraca(state, ja);
  const fajcenieStoji = finale && vykupneHraca({ poldeciPlne: h.poldeciPlne, cigarety: h.cigarety - cenaFajc }, skryte).spaky < vykupneTeraz && h.ruka.length > 0;
  const fajcitDo = h.ruka.length <= 2 ? 3 : h.ruka.length < 4 ? 2 : 0;
  if (barter !== undefined && h.poldeciPlne + h.poldeciVypite < 5 && k.buducnost > 0.3) {
    return barter;
  }
  if (refill !== undefined && k.buducnost > 0.3) return refill;
  if (smoke !== undefined && !fajcenieStoji && maCoTahat && cenaFajc <= fajcitDo && h.ruka.length < 4 && h.cigarety >= cenaFajc + 2) return smoke;
  // v5: fajčí sa len v Pitke — s prázdnou rukou si kartu na ďalšie kolo dober aj za poslednú cigaretu navyše.
  if (smoke !== undefined && !fajcenieStoji && maCoTahat && cenaFajc <= fajcitDo && h.ruka.length <= 2 && h.cigarety >= cenaFajc + 1) return smoke;

  // Kšeft a Úplatok (v7): zahrá si ich nanečisto; berie, keď stav zlepší viac než o povahový prah.
  // Poštárka (Dlh za kartu) len s tenkou rukou — cenu Dlhu (istú exekúciu) ráta hodnotaStavu.
  const ksefty = v.legal.filter((c) => c.type === "kseft" || c.type === "kseftVazna" || c.type === "uplatok");
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
      let po = poOdkrytiNaex(data, po0, ja);
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
      if (priemer(v, best, poOdpovedi) > bez + k.povaha.prahRiziko) return best;
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
function poOdkrytiNaex(data: GameData, s: GameState, ja: PlayerId): GameState {
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
    case "povery":
    case "pohorsenie":
    case "prebytok":
      return najlepsi(v, v.legal, ohodnot);
    case "benzinka": {
      const pocet = v.legal.find((c) => c.type === "benzinka")?.uids.length ?? 0;
      const spalit = b.spalit;
      const obcania = partiaHraca(state, ja)
        .filter((pl) => defOf(data, pl.card).tags.includes("Občan") && !spalit.includes(pl.card.uid))
        .sort((x, y) => hodnotaKarty(data, x.card) - hodnotaKarty(data, y.card));
      return { type: "benzinka", uids: obcania.slice(0, pocet).map((pl) => pl.card.uid) };
    }
    case "kar": {
      // Kar: nepriznaná Cirhóza na konci prehráva súboje o Cirhózu — zahodí ju
      // vždy (v5: prehra balíčkom pod 5 kariet neplatí).
      const zahod = v.legal.find((c) => c.type === "kar" && c.uid !== null);
      return zahod ?? { type: "kar", uid: null };
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
    case "zivnostnik": {
      // Živnostník: zahodí súperovi najcennejšie Dedičstvo.
      const su = opponentOf(ja);
      let best: Command | null = null;
      let bestV = Number.NEGATIVE_INFINITY;
      for (const cmd of v.legal) {
        if (cmd.type !== "zivnostnik") continue;
        const karta = state.hraci[su].dedicstvo.find((x) => x.uid === cmd.uid);
        const hodnota = karta === undefined ? 0 : (DEDICSTVO[karta.defId] ?? 0);
        if (hodnota > bestV) {
          bestV = hodnota;
          best = cmd;
        }
      }
      return best;
    }
    case "vestica": {
      const su = opponentOf(ja);
      const moje = h.doberaci;
      const jeho = state.hraci[su].doberaci;
      let moja = 0;
      let jehoI = 0;
      moje.forEach((x, i) => {
        const m = moje[moja];
        if (m !== undefined && hodnotaKarty(data, x) < hodnotaKarty(data, m)) moja = i;
      });
      jeho.forEach((x, i) => {
        const m = jeho[jehoI];
        if (m !== undefined && hodnotaKarty(data, x) > hodnotaKarty(data, m)) jehoI = i;
      });
      return { type: "vestica", moja, jeho: jehoI };
    }
    default:
      return null;
  }
}

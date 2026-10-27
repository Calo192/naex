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
import { evaluateLine, snubenicaVracia } from "./partia.ts";
import { KONSTANTY } from "./constants.ts";
import type { ElderState, MarkerPos } from "./elders.ts";
import { MARKER_STRED, cenaPatronatu, spakyZaStarsich, strachZ, vydesil } from "./elders.ts";
import { limitZhromazdenia, partiaHraca } from "./effects.ts";
import { stranyLokality } from "./hrany.ts";
import type { Command, GameState } from "./engine.ts";
import {
  apply,
  barterCena,
  cieleVykladania,
  cielLokalitaId,
  krcmaVyzaduje,
  kartyZaPas,
  krokStavby,
  manzelkyHraca,
  legalCommands,
  naexCieleVLinii,
  sNaexNaKartach,
  silaPriazne,
  svokraZaNaex,
  lineState,
  poskodenieBitky,
  pohorseniaVBitke,
  prebytokDoSpakov,
  prahVydesenia,
  prahyHraca,
  priazen,
  uidZaverecnej,
  verejneAbstaky,
  nepriznaneCirhozy,
  vyplatZaStarsich,
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
  /** O koľko lepší musí byť patronát (vziať staršieho do ruky) než nič. */
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
  Robota: 0.2,
};

/** Čo karte pridáva jej efekt (hrubý odhad z textov sady v6). */
const BONUS_EFEKTU: Readonly<Record<string, number>> = {
  silna_nezavisla_zena: 1,
  liberal: 0.5,
  zamocnik: 0.3,
  policajtka: 0.5,
  praudovravec: 0.3,
  recidivista: 0.5,
  vestica: 0.3,
  hasic: 0.3,
  kocovnik: 0.5,
  sarlatan: 0.2,
  svokra: 0.4,
  podvodnik: 0.3,
  anonymny_alkoholik: 0.4,
  farar: 0.6,
  starosta: 0.4,
  postarka: 0.3,
  hrobar: 0.3,
  krcmarka: 0.4,
  veterinar: 0.4,
  autobusar: 0.4,
  dievcina_na_vydaj: 0.3,
  ministrant: 0.2,
  zahradkar: 0.4,
  cierna_macka: 0.5,
  pes: 0.3,
  sofer: 0.3,
  snubenica: 0.4,
  zivnostnik: 0.3,
};

/** Hodnota Nástroja v Dedičstve (malá priazeň natrvalo). */
const DEDICSTVO: Readonly<Record<string, number>> = {
  nealko: 0.6,
  svaty_text: 0.8,
  cigorky: 0.8,
  puska: 0.6,
  // v6.1: +1 špak po vyhratej bitke, keď sa ma bojí viac starších.
  noviny: 0.8,
  pasca: 0.5,
  vyherny_automat: 0.4,
  vinko: 0.8,
};

/**
 * Čo jeden bod sily priazne urobí v jednej budúcej bitke (v jednotkách
 * hodnotaStavu). Priazne v5 nie sú rovnako silné v každej partii: Bitkár
 * a Veriaci menia tuhé, Abstinent dáva Pohoršenia, kým Výpalné a „do dna“
 * zaberú len pri NA EX a Kmotor len pri priznanom Dlhu. Súperovi tak bot
 * dáva tú, ktorá mu v tejto partii urobí najmenej (Michal 2026-10-24).
 * Exekútor tu nie je — nižší prah súpera už ráta hodnotaZdrojov.
 */
const PRIAZEN_ZA_BITKU = {
  BITKAR: 1.2,
  VERIACI: 0.9,
  LAKOMEC: 0.7,
  FAJCIAR: 0.5,
  /** Za cigaretu, ktorú súper zaplatí za NA EX (cigareta prejde z jeho zdrojov do mojich). */
  VYPALNE: 0.5,
  /** Plný poldeci namiesto vypitého. */
  DO_DNA: 0.6,
  /** Za priznaný Dlh, ktorý Kmotor spáli. */
  UZERNIK: 0.5,
} as const;
/** Pravdepodobnosť, že priazeň vydrží do ďalšej bitky (prebytok, Pohoršenie a patronát markery hýbu). */
const VYDRZ_PRIAZNE = 0.6;
/** Koľko NA EX dá hráč priemerne za bitku (partie botov v5). */
const NAEX_ZA_BITKU = 0.35;

/** Hodnota karty v balíčku — čím vyššia, tým radšej ju bot má. */
export function hodnotaKarty(data: GameData, karta: CardInstance): number {
  if (karta.defId === "dlh") return -2.5;
  if (karta.defId === "cirhoza") return -3;
  if (karta.defId === "abstak") return -2;
  const def = defOf(data, karta);
  const strany = printedSides(data, karta);
  let akcie = 0;
  for (const slot of [...strany.left, ...strany.right]) if (slot !== null) akcie += VAHA_AKCIE[slot];
  // Aktivuje sa zhruba polovica akcií — páruje sa vždy len jedna hrana.
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
  // Súperova karta lícom dole pri patronáte je tiež skrytá — ide do miešania.
  const jehoPatronat = state.patronat[su];
  const licomDole = jehoPatronat === null ? [] : [jehoPatronat.nahrada];
  // Aj súperova skrytá Záverečná v línii — na jej miesto ide náhodná z jeho skrytých kariet.
  const zaverecne = ([0, 1] as const).flatMap((strana) =>
    state.strany[strana].flatMap((pl, index) => (pl.zaverecna === true && pl.playedBy === su ? [{ strana, index, karta: pl.card }] : [])),
  );
  const [skryte, r1] = rngShuffle(r, poUid([...on.ruka, ...on.doberaci, ...licomDole, ...zaverecne.map((z) => z.karta)]));
  const [mojBalicek, r2] = rngShuffle(r1, poUid(state.hraci[ja].doberaci));
  const [spolocny, r3] = rngShuffle(r2, poUid(state.spolocnyBalicek));
  const [seed, r4] = rngInt(r3, 2 ** 31);
  r = r4;
  const naZaverecne = skryte.slice(licomDole.length, licomDole.length + zaverecne.length);
  const zvysok = skryte.slice(licomDole.length + zaverecne.length);
  const superHrac = { ...on, ruka: zvysok.slice(0, on.ruka.length), doberaci: zvysok.slice(on.ruka.length) };
  const strany = state.strany.map((strana, si) =>
    strana.map((pl, index) => {
      const i = zaverecne.findIndex((z) => z.strana === si && z.index === index);
      const karta = naZaverecne[i];
      return i === -1 || karta === undefined ? pl : { ...pl, card: karta };
    }),
  ) as unknown as GameState["strany"];
  const mojHrac = { ...state.hraci[ja], doberaci: mojBalicek };
  const nahrada = skryte[0];
  const patronat: GameState["patronat"] =
    jehoPatronat === null || nahrada === undefined
      ? state.patronat
      : su === 0
        ? [{ ...jehoPatronat, nahrada }, state.patronat[1]]
        : [state.patronat[0], { ...jehoPatronat, nahrada }];
  return [
    {
      ...state,
      rng: rngSeed(seed),
      spolocnyBalicek: spolocny,
      hraci: ja === 0 ? [mojHrac, superHrac] : [superHrac, mojHrac],
      patronat,
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
 * Strach platí len víťazovi bitky (v6.1, Michal 2026-10-27): bot ráta, že zo
 * zvyšných bitiek vyhrá každý polovicu. Prebiehajúcu bitku rozhodne stávka
 * (stavkaBitky), tu je len jej stred.
 */
const PODIEL_VYHIER = 0.5;

/**
 * Odhad konečných špakov (v6), moje mínus súperove: špaky v popolníku,
 * nepriznané Cirhózy (ich počet je verejný) a strach starších × koľkokrát
 * ešte vyplatia × podiel vyhier. Starší sa smú nahradiť (patronát, náhľad posunu).
 */
function rozdielBodov(_data: GameData, s: GameState, ja: PlayerId, starsi: readonly ElderState[] = s.starsi): number {
  const su = opponentOf(ja);
  const vyplat = PODIEL_VYHIER * vyplatZaStarsich(s);
  const odhad = (p: PlayerId): number =>
    s.spaky[p] - KONSTANTY.SPAKY_ZA_CIRHOZU * nepriznaneCirhozy(s.hraci[p]) + vyplat * spakyZaStarsich(starsi, p);
  return odhad(ja) - odhad(su);
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
 * Čo získa víťaz prebiehajúcej bitky oproti porazenému (v špakoch, v6): víťaz
 * dostane Pitky kola a sekeru — výhra oproti prehre je teda dvojnásobok. Od
 * v6.1 aj starších, ktorí sa ho boja: moja výhra mi ich dá, súperova jemu.
 */
function stavkaBitky(_data: GameData, s: GameState, _ja: PlayerId): number {
  if (s.ciel === null) return 0;
  const pitky = Math.max(1, s.pitkyCelkom, s.pitkaCislo);
  // Patronát: porazený patrón platí poldeci (bolestné).
  let patronat = 0;
  for (const q of [0, 1] as const) if (s.patronat[q] !== null) patronat += 2;
  const strach = s.bitkaStav !== null && s.bitkaStav.damage !== null ? 0 : spakyZaStarsich(s.starsi, 0) + spakyZaStarsich(s.starsi, 1);
  return 2 * (pitky + s.spakyNaSekere) + strach + patronat;
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
  const abstaky: [number, number] = [0, 0];
  abstaky[k.ja] = s.hraci[k.ja].ruka.filter((x) => x.defId === "abstak").length;
  const dmg = poskodenieBitky(data, s, sums, abstaky);
  // Remíza v tuhom (v6): vyhrá menej Absťákov, potom menej priznaných Dlhov, inak sekera (šanca ½).
  const remiza = (p: PlayerId): [number, number] => [verejneAbstaky(s, p) + abstaky[p], prahyHraca(data, s, p).priznaneDlhy];
  const [aq, dq] = remiza(q);
  const [ao, dO] = remiza(o);
  const tuhe = dmg.tuhe[q] - dmg.tuhe[o];
  const m = tuhe !== 0 ? tuhe : aq !== ao ? 0.5 * Math.sign(ao - aq) : 0.5 * Math.sign(dO - dq);
  const celk = dmg.celkove[q] - dmg.celkove[o];
  const sanca = 1 / (1 + Math.exp(-ostrost * m));
  let v = k.povaha.bitka * (k.stavka * (sanca - 0.5) + cenaBoduPrebytku(s) * Math.max(-PREBYTOK_STROP, Math.min(PREBYTOK_STROP, celk)));

  // Akcie, ktoré sa vyhodnotia až v Pitke — po nej už sú v stave.
  if (s.faza === "zhromazdenie" || s.faza === "pitka") {
    const pohorsenia = pohorseniaVBitke(data, s, sums);
    const zaPohorsenie = PODIEL_VYHIER * vyplatZaStarsich(s) * VYDRZ_POSUNU;
    for (const p of [q, o] as const) {
      const sp = sums[p];
      const so = sums[opponentOf(p)];
      const h = s.hraci[p];
      let w = 0;
      w += 0.3 * Math.max(0, (sp.Cigareta ?? 0) - (so.Obmedzenie ?? 0)) * k.buducnost;
      // v6: Pohoršenie posunie marker o pole bez limitu — strach platí špaky po každej
      // zvyšnej bitke (aj tejto); pevných 0,5 za kus podceňovalo karty s Pohoršením.
      w += zaPohorsenie * Math.min(POHORSENIE_STROP, pohorsenia[p]);
      const naex = s.strany.flat().filter((pl) => pl.naexBy === p).length;
      w += 0.4 * Math.min(sp.Poldeci ?? 0, h.poldeciVypite + naex) * k.buducnost;
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
  let postih = 1.3 * verejneAbstaky(s, p);
  const prahy = prahyHraca(k.data, s, p);
  postih += 0.3 * prahy.priznaneDlhy;
  const rezerva = prahy.exekutor - prahy.priznaneDlhy;
  if (rezerva <= 1) postih += 4;
  else if (rezerva <= 3) postih += 1.5;
  // Absťák: menej nerestí než minulé kolo; prvé kolo len nastavuje základ.
  if (s.kolo === 1) {
    postih += 0.25 * h.nerestiTotoKolo;
  } else {
    // Milujúca manželka: Absťák už pri rovnosti nerestí (každá o 1 viac).
    const deficit = h.nerestiMinuleKolo + manzelky(s, p) - h.nerestiTotoKolo;
    if (deficit > 0) postih += Math.min(1.3, 0.45 * deficit);
    else postih += 0.1 * -deficit;
  }
  v -= k.povaha.kliatby * postih;
  // Tenký balíček už neprehráva (v5), len sa z neho nedá fajčiť ani ťahať.
  const balicek = h.doberaci.length + h.odhadzovaci.length + h.ruka.length + partiaHraca(s, p).length;
  if (balicek < TENKY_BALICEK) v -= (TENKY_BALICEK - balicek) * 0.5;
  for (const kus of h.dedicstvo) v += (DEDICSTVO[kus.defId] ?? 0) * f;
  return v;
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
      case "NEPRAJNIK":
        // Výpalné: za každé súperovo NA EX prejde sila cigariet od súpera k hráčovi.
        v += sila * NAEX_ZA_BITKU * PRIAZEN_ZA_BITKU.VYPALNE * pv.zdroje * bitiek;
        break;
      case "ALKOHOLIK":
        // „Do dna“: plný poldeci namiesto vypitého, najviac za sila NA EX v kole — NA EX je zriedka viac.
        v += Math.min(sila, 1) * NAEX_ZA_BITKU * PRIAZEN_ZA_BITKU.DO_DNA * pv.zdroje * bitiek;
        break;
      case "UZERNIK": {
        // Kmotor bez priznaného Dlhu nerobí nič; Dlhy spáli najviac raz.
        const dlhy = prahyHraca(k.data, s, p).priznaneDlhy;
        v += Math.min(dlhy, sila * bitiek) * PRIAZEN_ZA_BITKU.UZERNIK * pv.kliatby;
        break;
      }
      case "EXEKUTOR":
        break;
    }
  }
  return v;
}

/** Postup k výhre vydesením (body za strach už sú v rozdiele bodov). */
function hodnotaVydesenia(s: GameState, p: PlayerId): number {
  const prah = prahVydesenia(s);
  const vydeseni = s.starsi.filter((e) => vydesil(e, p)).length;
  const ohlasene = s.ohlaseneVydesenie[p];
  // Ohlásené vydesenie vyhrá až na konci nasledujúceho kola. V poslednom kole
  // (v krátkej hre už v 3.) nové vydesenie nezaberie — rátajú sa len body.
  // v6: posun markera má cenu zvyšných výplat strachu (aj 5–6 špakov) — výhra
  // vydesením musí vážiť viac než pár posunov, inak ju bot nebráni ani nedotiahne.
  if (ohlasene !== null && ohlasene < s.kolo && vydeseni >= prah) return 2.5 * vydeseni + VYDESENIE_DRZI;
  if (kolPoTomto(s) === 0) return 0;
  let v = 2.5 * vydeseni + 0.5 * s.starsi.filter((e) => strachZ(e, p) === 2).length;
  if (vydeseni >= prah) v += VYDESENIE_OHLASENE;
  else if (vydeseni === prah - 1) v += 8;
  return v;
}

/** Vydesenie, ktoré vyhrá na konci tohto kola / ohlásené, na ktoré má súper ešte kolo. */
const VYDESENIE_DRZI = 100;
const VYDESENIE_OHLASENE = 60;

/** Koľko bitiek príde po tejto (v6 aj finále). */
function kolPoTomto(s: GameState): number {
  return Math.max(0, s.lokalityVHre.length + (s.ciel?.typ === "finale" ? 0 : 1) - (s.ciel === null ? 1 : 0));
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
  // Špaky za bitku a za starších sú po výsledku už v popolníkoch (rozdielBodov).
  // Nerozdelený prebytok ako v hodnotaBitky; cigarety za prebytok dostane súper držiteľa až po bitke.
  const ja = k.ja;
  const drzi = b.prebytokDrzi;
  const prebytok = drzi === null ? 0 : (drzi === ja ? 1 : -1) * Math.min(6, b.prebytokZostava);
  const cigarety = drzi === null ? 0 : (drzi === ja ? -1 : 1) * 0.3 * k.buducnost * k.povaha.zdroje * b.prebytokPosunute.length;
  return k.povaha.bitka * cenaBoduPrebytku(s) * prebytok + cigarety;
}

/**
 * Čo jeden bod prebytku (posun markera o pole po špakoch tejto bitky) prinesie
 * v špakoch: zvyšné výplaty strachu, s rezervou na to, že súper marker odtlačí.
 * Po finále a na Kultúrnom dome je prebytok rovno špakmi.
 */
function cenaBoduPrebytku(s: GameState): number {
  if (prebytokDoSpakov(s)) return 1;
  const poBitke = s.bitkaStav !== null && s.bitkaStav.damage !== null;
  return Math.max(0.35, PODIEL_VYHIER * (vyplatZaStarsich(s) - (poBitke ? 0 : 1)) * VYDRZ_POSUNU);
}

/**
 * Cirhóza, ktorá z Pitky ešte len príde (v špakoch). Nepriznaná stojí na konci
 * 5 špakov (rozdielBodov ju tak ráta hneď, ako je v balíčku); skoro v hre ju
 * hráč ešte prizná a pochová, pred finále sotva, vo finále už nie
 * (Fero vo finále dával NA EX za −20 špakov, turnaj v6).
 */
function cenaNovejCirhozy(k: Kontext, s: GameState): number {
  const zostava = kolPoTomto(s);
  return k.povaha.body * KONSTANTY.SPAKY_ZA_CIRHOZU * (zostava === 0 ? 1 : zostava === 1 ? 0.8 : 0.6);
}

/** Koľko z hodnoty posunu markera ostane, keď ho súper môže odtlačiť späť (turnaj v6). */
const VYDRZ_POSUNU = 0.6;
/** Strop prebytku a Pohoršení v odhade bitky — markerov a polí je konečne veľa. */
const PREBYTOK_STROP = 8;
const POHORSENIE_STROP = 6;

// ---------------------------------------------------------------------------
// Zhromaždenie nanečisto — obaja vykladajú chamtivo

interface Vylozenie {
  readonly karta: CardInstance;
  readonly kam: "vlastna" | "superova";
}

function sKartou(strany: GameState["strany"], q: PlayerId, v: Vylozenie): GameState["strany"] {
  const p: PlayerId = v.kam === "vlastna" ? q : opponentOf(q);
  const nova: PlacedCard = { card: v.karta, playedBy: q };
  // Snúbenica vedľa karty s NA EX ju pošle do ruky a ľahne na jej miesto.
  const strana = snubenicaVracia(strany[p], v.karta.defId) === null ? strany[p] : strany[p].slice(0, -1);
  return p === 0 ? [[...strana, nova], strany[1]] : [strany[0], [...strana, nova]];
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
      const h = hodnotaBitky(k, { ...s, strany: sKartou(s.strany, q, v) }, q, 0.9) - cenaKarty;
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
  const vlastny: [number, number] = [z.vlastny?.[0] ?? limit[0], z.vlastny?.[1] ?? limit[1]];
  const cigarety: [number, number] = [s.hraci[0].cigarety, s.hraci[1].cigarety];
  let naTahu = z.naTahu;
  for (let krok = 0; krok < 30 && !(pasoval[0] && pasoval[1]); krok++) {
    const q = naTahu;
    const v = najlepsieVylozenie(k, { ...s, strany }, ruky[q], q, limit[q]);
    if (v === null) {
      pasoval[q] = true;
      navyse[q] = 0;
      cigarety[q] += kartyZaPas({ zostavaLimit: limit, vlastny }, q, ruky[q].length) * KONSTANTY.CIGARETY_ZA_PAS_NA_KARTU;
    } else {
      strany = sKartou(strany, q, v);
      ruky[q] = ruky[q].filter((x) => x.uid !== v.karta.uid);
      if (minieLimit(k.data, v)) {
        limit[q] = Math.max(0, limit[q] - 1);
        vlastny[q] = Math.max(0, vlastny[q] - 1);
      }
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
    zhromazdenieStav: { ...z, naTahu, zostavaLimit: limit, pasoval, navyse, ...(z.vlastny === undefined ? {} : { vlastny }) },
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

  const cmd = rozhodni(volba);
  return cmd ?? prvy;
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
  if (d.krok === "patronat") return patronat(v);
  if (d.krok === "stavba") {
    // Najlepšie karty do šenku (inak ich tam dá súper). Obranca berie zo šenku
    // druhý — ďalšie dobré radšej pošle naspodok, než by ich podal súperovi.
    const zoradene = [...d.balicky[ja]].sort((a, b) => hodnotaKarty(data, b) - hodnotaKarty(data, a));
    const krok = krokStavby(zoradene.length);
    const doSenku = zoradene.slice(0, krok.doSenku);
    const zvysok = zoradene.slice(krok.doSenku);
    const odhod = state.utocnik === ja ? zvysok.slice(zvysok.length - krok.odhod) : zvysok.slice(0, krok.odhod);
    return { type: "stavbaSenku", doSenku: doSenku.map((x) => x.uid), odhod: odhod.map((x) => x.uid) };
  }
  // Branie zo šenku (Michal 2026-10-19): 1 karta za cigaretu, 2 karty za 3.
  const ponuka = [...state.senok].sort((a, b) => hodnotaKarty(data, b) - hodnotaKarty(data, a));
  const najlepsia = ponuka[0];
  if (najlepsia === undefined) return { type: "draftStop" };
  const druha = ponuka[1];
  // Zisk karty do balíčka oproti tomu, čo stojí. Cigareta je platidlo
  // (šenok, Dedičstvo, patronát) — vo v6 už neboduje.
  const { k } = v;
  const h = state.hraci[ja];
  const priemer = priemernaKarta(data, state, ja);
  const balicek = h.ruka.length + h.doberaci.length + h.odhadzovaci.length;
  // V poslednom kole karta zo šenku pomôže už len v tejto bitke; cigareta ostáva do bodovania.
  const posledne = kolPoTomto(state) === 0;
  const zisk = (x: CardInstance | undefined): number =>
    x === undefined ? 0 : (hodnotaKarty(data, x) - priemer + 0.5 + (balicek < 10 && !posledne ? 0.6 : 0)) * (posledne ? 0.6 : 1);
  const cenaCigarety = 0.3 * k.buducnost * k.povaha.zdroje;
  const mozne = (uids: readonly number[]): Command | null =>
    v.legal.find((c) => c.type === "draftBer" && c.uids.length === uids.length && uids.every((u) => c.uids.includes(u))) ?? null;
  const jedna = mozne([najlepsia.uid]);
  const dve = druha === undefined ? null : mozne([najlepsia.uid, druha.uid]);
  const zaJednu = zisk(najlepsia) - (KONSTANTY.CENA_SENKU[1] ?? 1) * cenaCigarety;
  const zaDve = zisk(najlepsia) + zisk(druha) - (KONSTANTY.CENA_SENKU[2] ?? 3) * cenaCigarety;
  if (dve !== null && zaDve > 0 && zaDve > zaJednu) return dve;
  if (jedna !== null && zaJednu > 0) return jedna;
  return { type: "draftStop" };
}

/**
 * Patronát (Michal 2026-10-20) — odhad zo špakov. V6 (Michal 2026-10-26) súper
 * Pohoršeniami z patronátu patróna nevráti, marker ostane v strede: súper prestane
 * dostávať špaky za jeho strach a vydesenie padne. Prehra stojí poldeci.
 */
function patronat(v: Volba): Command | null {
  const { data, state, ja, k } = v;
  const su = opponentOf(ja);
  const bez = v.legal.find((c) => c.type === "bezPatronatu") ?? null;
  const hodnotaStarsich = (starsi: readonly ElderState[]): number => {
    const s = { ...state, starsi };
    return (
      k.povaha.body * (rozdielBodov(data, s, ja, starsi) + hodnotaVydesenia(s, ja) - hodnotaVydesenia(s, su)) +
      hodnotaPriazni(k, s, ja) -
      hodnotaPriazni(k, s, su)
    );
  };
  const teraz = hodnotaStarsich(state.starsi);
  const cenaCigarety = 0.3 * k.buducnost * k.povaha.zdroje;
  const bolestne = 2.5 * k.buducnost * k.povaha.zdroje;
  // Výsledok bitky je pred Zhromaždením neistý; patrón má navyše kartu staršieho.
  const sanca = 0.5;
  let best: Command | null = null;
  let bestV = k.povaha.prahStarsi;
  for (const cmd of v.legal) {
    if (cmd.type !== "patronat") continue;
    const elder = state.starsi.find((e) => e.elderId === cmd.elderId);
    const karta = state.hraci[ja].ruka.find((x) => x.uid === cmd.uid);
    if (elder === undefined || karta === undefined) continue;
    const cena = cenaPatronatu(elder);
    const marker: MarkerPos = MARKER_STRED;
    const poVyhre = hodnotaStarsich(
      state.starsi.map((e) => (e.elderId === elder.elderId ? { ...e, marker, karta, nahradeny: true, ziskal: ja } : e)),
    );
    const poPrehre = hodnotaStarsich(state.starsi.map((e) => (e.elderId === elder.elderId ? { ...e, marker } : e)));
    // v6: súper dostane cena.pohorsenia Pohoršení — každé posunie iný marker o pole
    // ku mne, takže špaky za strach, ktoré návrat do stredu vzal, si väčšinou vráti.
    const pohorseniaSupera = k.povaha.body * cena.pohorsenia * PODIEL_VYHIER * vyplatZaStarsich(state);
    const hodnota =
      sanca * (poVyhre - teraz + 0.6 * hodnotaKarty(data, elder.karta) * k.buducnost) +
      (1 - sanca) * (poPrehre - teraz - bolestne) -
      pohorseniaSupera -
      cena.cigarety * cenaCigarety -
      0.3 * hodnotaKarty(data, karta) +
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

  // Priznanie neodovzdá ťah. Dlh sa prizná sám pri dobratí; Cirhóza priznaná
  // dá súperovi +1 tuhé v každej zvyšnej bitke (Michal 2026-10-20), nepriznaná
  // −2 za každú aktívnu podmienku pečeň na konci. Cena priznania teda rastie
  // s počtom zvyšných bitiek, nie s dĺžkou hry — v krátkej hre (3 lokality)
  // by pevné „najviac dve zvyšné“ priznávalo už v 1. kole.
  for (const cmd of v.legal) {
    if (cmd.type !== "place" || cmd.target !== "priznanie") continue;
    const karta = h.ruka.find((x) => x.uid === cmd.uid);
    if (karta?.defId === "cirhoza" && ziskPriznaniaCirhozy(v, karta) > 0) return cmd;
    if (karta?.defId === "dlh") return cmd;
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

/**
 * Koľko nerestí smie hráč v tomto kole mať bez toho, aby si zdvihol latku na
 * ďalšie kolo (Absťák = menej nerestí než minule). Každá nerest navyše je
 * záväzok aj na budúce kolo — barter za 5 cigariet ich pridá 5 (playtest
 * 20261019-102558: Teta Gizka sa tak roztočila na tri Absťáky). V poslednej
 * bitke už na tom nezáleží.
 */
function stropNeresti(state: GameState, ja: PlayerId): number {
  if (kolPoTomto(state) === 0) return Number.POSITIVE_INFINITY;
  const h = state.hraci[ja];
  if (state.kolo === 1) return 1;
  return h.nerestiMinuleKolo + manzelky(state, ja) + (verejneAbstaky(state, ja) > 0 ? 1 : 0);
}

/** Odhalené Milujúce manželky hráča — posúvajú latku Absťáku (Michal 2026-10-19). */
const manzelky = (state: GameState, p: PlayerId): number => manzelkyHraca(state, p);

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
      (vrchna.defId === "cirhoza" || (balicek > TENKY_BALICEK && hodnotaKarty(data, vrchna) < priemernaKarta(data, state, ja) - 0.3));
    return { type: "vizia", vziat: !zahodit };
  }

  const p = state.pitkaStav;
  if (p === null) return null;

  // Odpoveď na súperovo NA EX: jedna karta mimo limitu, ak pomôže.
  if (p.reakcia === ja) {
    return najlepsi(v, v.legal, (po) => hodnotaStavu(k, po, 1.5));
  }

  // Hospodárenie s cigaretami — najprv proti Absťáku, potom poldeci navyše.
  // Hospodárenie s cigaretami: nerestí len toľko, aby latka na ďalšie kolo nerástla.
  const strop = stropNeresti(state, ja);
  const neresti = h.nerestiTotoKolo;
  const najdi = (typ: Command["type"]): Command | undefined => v.legal.find((c) => c.type === typ);
  const barter = najdi("barter");
  const refill = najdi("refillPoldeci");
  const smoke = najdi("smoke");
  const maCoTahat = h.doberaci.length + h.odhadzovaci.length > 0;
  if (barter !== undefined && neresti + barterCena(data, state, ja) <= strop + 1 && h.poldeciPlne + h.poldeciVypite < 5 && k.buducnost > 0.3) {
    return barter;
  }
  if (refill !== undefined && neresti + KONSTANTY.REFILL_CENA <= strop && k.buducnost > 0.3) return refill;
  if (smoke !== undefined && maCoTahat && h.ruka.length < 4 && h.cigarety >= 3 && neresti + 1 <= strop) return smoke;
  // v5: fajčí sa len v Pitke — s prázdnou rukou si kartu na ďalšie kolo dober aj za poslednú cigaretu navyše.
  if (smoke !== undefined && maCoTahat && h.ruka.length <= 2 && h.cigarety >= 2 && neresti + 1 <= strop) return smoke;

  // Poštárka: dve karty za Dlh, kým je Exekútor ďaleko.
  const postarka = v.legal.find((c) => c.type === "postarka" && c.pocet === KONSTANTY.EFEKT.POSTARKA_KARTY);
  const prahy = prahyHraca(data, state, ja);
  if (postarka !== undefined && h.ruka.length < 6 && prahy.exekutor - prahy.priznaneDlhy > 4) return postarka;

  // Starosta: vymeň najhoršiu kartu z ruky za výrazne lepšiu zo šenku.
  let starosta: Command | null = null;
  let zisk = 1;
  for (const cmd of v.legal) {
    if (cmd.type !== "starosta") continue;
    const zRuky = h.ruka.find((x) => x.uid === cmd.rukaUid);
    const zoSenku = state.senok.find((x) => x.uid === cmd.senokUid);
    if (zRuky === undefined || zoSenku === undefined) continue;
    const z = hodnotaKarty(data, zoSenku) - hodnotaKarty(data, zRuky);
    if (z > zisk && h.cigarety >= 2) {
      zisk = z;
      starosta = cmd;
    }
  }
  if (starosta !== null) return starosta;

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
            strany: sKartou(po.strany, su, odpoved),
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
      if (priemer(v, best, poOdpovedi) > hodnotaStavu(k, sNaexNaKartach(s0), 1.5) + k.povaha.prahRiziko) return best;
    }
  }
  // Koniec ťahu v Pitke: chýbajúce neresti dorovnať, inak hrozí Absťák.
  if (state.kolo > 1 && neresti < h.nerestiMinuleKolo) {
    if (refill !== undefined && h.nerestiMinuleKolo - neresti >= 2) return refill;
    if (smoke !== undefined && maCoTahat) return smoke;
    if (refill !== undefined) return refill;
  }
  return najdi("skipNaex") ?? null;
}

/**
 * Skryté NA EX hráča ja odkryté tak, ako ich odkryje jadro: poldeci na karte,
 * pečeň +1 tomu, kto NA EX dal, nerest, Svokra a Výpalné súpera. Samotné
 * sNaexNaKartach pečeň ani cigarety neráta — bot by NA EX pod súperovým
 * Výpalným dával, akoby nič nestálo.
 */
function poOdkrytiNaex(data: GameData, s: GameState, ja: PlayerId): GameState {
  const pocet = (s.pitkaStav?.skryteNaex ?? []).filter((x) => x.hrac === ja).length;
  const po = sNaexNaKartach(s);
  if (pocet === 0) return po;
  const su = opponentOf(ja);
  const h = po.hraci[ja];
  let cigarety = h.cigarety;
  let platba = 0;
  for (let i = 0; i < pocet; i++) {
    const svokra = svokraZaNaex(data, po, ja, cigarety);
    cigarety -= svokra;
    const vypalne = Math.min(cigarety, silaPriazne(data, po, "NEPRAJNIK", su));
    cigarety -= vypalne;
    platba += svokra + vypalne;
  }
  const moj = { ...h, cigarety, pecen: h.pecen + pocet, nerestiTotoKolo: h.nerestiTotoKolo + pocet };
  const jeho = { ...po.hraci[su], cigarety: po.hraci[su].cigarety + platba };
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
    case "pohorsenie":
    case "prebytok":
      return najlepsi(v, v.legal, ohodnot);
    case "exekutor":
      // Záhradkár (v6): radšej zahodí kartu, než by mu zhoreli špaky.
      return { type: "zahradkar", zahodit: true };
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
      // Cintorín: zadarmo do Dedičstva najcennejší Nástroj z ruky.
      let best: Command | null = null;
      let bestV = 0;
      for (const cmd of v.legal) {
        if (cmd.type !== "cintorin" || cmd.uid === null) continue;
        const karta = h.ruka.find((x) => x.uid === cmd.uid);
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
    case "pohreb": {
      // Pohreb preriedi balíček o slabú kartu; za Závislého navyše vymení
      // kartu za lepšiu zo šenku (balíček sa nezmenší). Inak nič — priznaná
      // Cirhóza neškodí.
      const priemer = priemernaKarta(data, state, ja);
      const balicek = h.ruka.length + h.doberaci.length + h.odhadzovaci.length + partiaHraca(state, ja).length;
      // Pohreb spáli aj priznanú Cirhózu — súper za ňu prestane dostávať +1 tuhé
      // v každej ďalšej bitke (v6 to je aj +1 prebytku, teda posun markera).
      const zaCirhozu = kolPoTomto(state) * (CENA_TUHEHO_ZA_BITKU + 0.5 * cenaBoduPrebytku(state));
      let best: Command | null = null;
      let bestV = 0.5;
      for (const cmd of v.legal) {
        if (cmd.type !== "pohreb") continue;
        const karta = partiaHraca(state, ja).find((pl) => pl.card.uid === cmd.kartaUid)?.card;
        if (karta === undefined) continue;
        const zoSenku = cmd.senokUid === undefined ? undefined : state.senok.find((x) => x.uid === cmd.senokUid);
        // Tenký balíček kartu len stratí, hrubý sa preriedi (zvyšné karty sú v priemere lepšie).
        const nahrada = zoSenku !== undefined ? hodnotaKarty(data, zoSenku) : balicek >= 11 ? priemer : priemer - 1;
        const zisk = zaCirhozu + nahrada - hodnotaKarty(data, karta) - 0.3;
        if (zisk > bestV) {
          bestV = zisk;
          best = cmd;
        }
      }
      return best ?? v.legal.find((c) => c.type === "skipPohreb") ?? null;
    }
    default:
      return null;
  }
}

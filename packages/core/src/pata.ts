// Režim Päta, Lakeť, Otočka (roadmapa #166, Michal 2026-10-31, 2026-11-01, 2026-11-06):
// draft 4 a 4 starších s pečeňou, rad mimo línie, štít Viery, jed z Pohoršenia a Má dosť.
// Kolo ostáva z Kalamity; tento modul drží len to, čo je v režime iné, a engine ho len volá.
// Všetky funkcie sú čisté prechody stavu, nemenia vstup.

import type { Action, CardInstance, PlayerId } from "./types.ts";
import { opponentOf } from "./types.ts";
import type { GameData } from "./data.ts";
import type { ActionSums, LineEval, LineState, PlacedCard } from "./partia.ts";
import { evaluateLine } from "./partia.ts";
import { abstakyVBitke } from "./battle.ts";

export type RezimHry = "kalamita" | "pata";

/** Hodnoty režimu. Pečeň je rozhodnutie Michala 2026-11-06 (× 2, Farár po prvom meraní 27), doladí sa po prvej hre. */
export const PATA = {
  STARSICH_NA_HRACA: 4,
  /** Hadovitý draft: A B B A A B B A (index do [prvý, druhý]). */
  PORADIE_DRAFTU: [0, 1, 1, 0, 0, 1, 1, 0],
  PECEN: {
    farar: 27,
    krcmarka: 36,
    starosta: 33,
    postarka: 24,
    hrobar: 33,
    autobusar: 30,
    veterinar: 27,
    vychovavatelka: 27,
  },
  /** Dať vyžrať: pečeň za 1 plný poldeci, cigarety nič (Michal 2026-11-06). */
  VYZRAT_PECEN: 3,
  /** Robota: vylieči 2 alebo spáli Dlh (N7, Michal 2026-11-06). */
  ROBOTA_LIECI: 2,
  /** Jed klesne po bitke o 1, s Má dosť Farára o 2. */
  JED_POKLES: 1,
  JED_POKLES_FARAR: 2,
  /** Vždy 3 lokality na výber, po jednej z úrovní; pinnacle sa nehrá (Michal 2026-11-06). */
  UROVNE_LOKALIT: [1, 2, 3],
  /** Karty a lokality, ktoré bez špakov, rečí a hádky nemajú zmysel, alebo plošne prerastú (Michal 2026-11-06). */
  VYRADENE: ["noviny", "horoskop", "cierna_macka", "kapybara", "kulturny_dom", "predsedova_vila", "herna"],
} as const;

export type StarsiId = keyof typeof PATA.PECEN;

/** Znenie Má dosť pre kartu staršieho na stole. `hned` = raz pri podrazení, inak do konca partie. */
export const MA_DOST: Readonly<Record<StarsiId, { readonly nazov: string; readonly text: string; readonly hned: boolean }>> = {
  postarka: { nazov: "Všetko vyklopím", text: "Súperova ruka je pre teba odkrytá.", hned: false },
  veterinar: { nazov: "Liečim už len kravy", text: "Zahoď všetky svoje Cirhózy.", hned: true },
  vychovavatelka: { nazov: "Do radu!", text: "Po odhalení radov vymeníš v súperovom rade dvoch susedných starších.", hned: false },
  farar: { nazov: "Rozhrešenie", text: "Jed na tvojich starších klesá o 2.", hned: false },
  autobusar: { nazov: "Ty nastupuješ prvý", text: "Z ponuky berieš vždy prvý a hneď 2 karty.", hned: false },
  starosta: { nazov: "Kde sa pije, poviem ja", text: "Lokalitu vyberáš a natáčaš ty.", hned: false },
  hrobar: { nazov: "Aspoň mám robotu", text: "+1 tuhé za každého podrazeného staršieho.", hned: false },
  krcmarka: { nazov: "Už ti nenalejem", text: "Súperovi sa na začiatku kola neotočí vypitý poldeci.", hned: false },
};

export function jeVyradenaVPate(defId: string): boolean {
  return (PATA.VYRADENE as readonly string[]).includes(defId);
}

export interface StarsiPata {
  readonly karta: CardInstance;
  readonly pecen: number;
  /** Štít z Viery; každý starší má svoj, prenáša sa medzi kolami. */
  readonly stit: number;
  readonly jed: number;
  readonly podrazeny: boolean;
}

export interface PataStav {
  /** Starší hráčov v poradí radu; rad[0] je ľavý z pohľadu majiteľa. */
  readonly rady: readonly [readonly StarsiPata[], readonly StarsiPata[]];
}

function idStarsieho(s: Pick<StarsiPata, "karta">): StarsiId {
  return s.karta.defId as StarsiId;
}

/** Nový starší po drafte: plná pečeň, bez štítu a jedu. */
export function novyStarsi(karta: CardInstance): StarsiPata {
  return { karta, pecen: PATA.PECEN[karta.defId as StarsiId], stit: 0, jed: 0, podrazeny: false };
}

/** Kto vyberá `index`-tého staršieho, keď `prvy` draftuje prvý. */
export function naTahuDraftu(prvy: PlayerId, index: number): PlayerId | null {
  const kto = PATA.PORADIE_DRAFTU[index];
  if (kto === undefined) return null;
  return kto === 0 ? prvy : opponentOf(prvy);
}

export function stojaci(stav: PataStav, p: PlayerId): readonly StarsiPata[] {
  return stav.rady[p].filter((s) => !s.podrazeny);
}

/** Má dosť platí, keď hráčov starší už padol. */
export function maDost(stav: PataStav, p: PlayerId, id: StarsiId): boolean {
  return stav.rady[p].some((s) => idStarsieho(s) === id && s.podrazeny);
}

/** Má dosť Hrobára: +1 tuhé za každého podrazeného staršieho na stole, teda aj súperovho. */
export function tuheHrobara(stav: PataStav, p: PlayerId): number {
  if (!maDost(stav, p, "hrobar")) return 0;
  return [...stav.rady[0], ...stav.rady[1]].filter((s) => s.podrazeny).length;
}

/** Rad vyhodnotený ako línia: sloty kariet na vykreslenie a čo ktorý starší práve dáva. */
export interface VyhodnotenieRadu {
  readonly cards: LineEval["cards"];
  /** Podľa uid karty; podrazený v mape nie je, jeho akcie neplatia. */
  readonly naStarsom: ReadonlyMap<number, ActionSums>;
  readonly sumy: ActionSums;
}

/**
 * Akcie radu ako malej línie bez lokality. Podrazený ostáva spojkou: sused na spoji s ním svoju akciu
 * dostane, jeho vlastné akcie neplatia a jeho Odpor ani Posilnenie suseda nemenia — preto sa mu na výpočet
 * prepíšu na Pakt, ktorý len kopíruje partnera, a jeho príspevky sa zo súčtov vynechajú.
 */
export function vyhodnotRad(
  data: GameData,
  rad: readonly StarsiPata[],
  p: PlayerId,
  nastroje?: LineState["nastroje"],
): VyhodnotenieRadu {
  const podrazeni = new Set(rad.filter((s) => s.podrazeny).map((s) => s.karta.uid));
  const variants = new Map(data.variants);
  for (const s of rad) {
    if (!s.podrazeny) continue;
    const v = data.variants.get(s.karta.defId);
    if (v === undefined) continue;
    const bezUcinku = <T extends readonly (Action | null)[]>(strana: T): T =>
      strana.map((a) => (a === "Odpor" || a === "Posilnenie" ? "Pakt" : a)) as unknown as T;
    variants.set(s.karta.defId, { ...v, left: v.left.map(bezUcinku), right: v.right.map(bezUcinku) });
  }
  // evaluateLine prvú stranu číta od lokality, otočený zoznam dá spoje rad[i].pravá ↔ rad[i + 1].ľavá.
  const karty: PlacedCard[] = [...rad].reverse().map((s) => ({ card: s.karta, playedBy: p }));
  const prazdna: readonly PlacedCard[] = [];
  const line: LineState = {
    lokalita: null,
    lokalitaOtocena: false,
    strany: p === 0 ? [karty, prazdna] : [prazdna, karty],
    ...(nastroje === undefined ? {} : { nastroje }),
  };
  const ev = evaluateLine({ ...data, variants }, line);
  const sumy: Partial<Record<Action, number>> = {};
  const naStarsom = new Map<number, Partial<Record<Action, number>>>();
  const zdroje = ev.zdroje[p];
  for (const akcia of Object.keys(zdroje) as Action[]) {
    for (const z of zdroje[akcia] ?? []) {
      if (podrazeni.has(z.uid)) continue;
      sumy[akcia] = (sumy[akcia] ?? 0) + z.hodnota;
      const m = naStarsom.get(z.uid) ?? {};
      m[akcia] = (m[akcia] ?? 0) + z.hodnota;
      naStarsom.set(z.uid, m);
    }
  }
  return { cards: ev.cards, naStarsom, sumy };
}

export function sumyRadu(
  data: GameData,
  rad: readonly StarsiPata[],
  p: PlayerId,
  nastroje?: LineState["nastroje"],
): ActionSums {
  return vyhodnotRad(data, rad, p, nastroje).sumy;
}

/** Súčet dvoch súčtov akcií — línia + rad v Pitke aj v bitke. */
export function spocitajSumy(a: ActionSums, b: ActionSums): ActionSums {
  const out: Partial<Record<Action, number>> = { ...a };
  for (const akcia of Object.keys(b) as Action[]) out[akcia] = (out[akcia] ?? 0) + (b[akcia] ?? 0);
  return out;
}

/** Poradie radu hráča (po braní zo šenku, naraz a skryto): len preskladanie vlastných starších. */
export function preskladajRad(stav: PataStav, p: PlayerId, poradie: readonly string[]): PataStav | null {
  const rad = stav.rady[p];
  if (poradie.length !== rad.length) return null;
  const nove: StarsiPata[] = [];
  for (const id of poradie) {
    const s = rad.find((x) => x.karta.defId === id);
    if (s === undefined || nove.includes(s)) return null;
    nove.push(s);
  }
  return sRadom(stav, p, nove);
}

function sRadom(stav: PataStav, p: PlayerId, rad: readonly StarsiPata[]): PataStav {
  return { rady: p === 0 ? [rad, stav.rady[1]] : [stav.rady[0], rad] };
}

/** Má dosť Vychovávateľky: `p` vymení v súperovom rade susedov na indexoch i a i + 1. */
export function vymenVRadeSupera(stav: PataStav, p: PlayerId, i: number): PataStav | null {
  if (!maDost(stav, p, "vychovavatelka")) return null;
  const q = opponentOf(p);
  const rad = stav.rady[q];
  const a = rad[i];
  const b = rad[i + 1];
  if (a === undefined || b === undefined) return null;
  const nove = [...rad];
  nove[i] = b;
  nove[i + 1] = a;
  return sRadom(stav, q, nove);
}

/** Dať vyžrať: plný poldeci (platí engine) za pečeň vlastnému stojacemu staršiemu, aj nad pôvodnú. */
export function dajVyzrat(stav: PataStav, p: PlayerId, id: string): PataStav | null {
  const s = stav.rady[p].find((x) => x.karta.defId === id);
  if (s === undefined || s.podrazeny) return null;
  return sRadom(stav, p, stav.rady[p].map((x) => (x === s ? { ...x, pecen: x.pecen + PATA.VYZRAT_PECEN } : x)));
}

/** Tuhé hráča v režime: tlmí ho až štít pri staršom, preto tu Viera nefiguruje. */
export function tuheStrany(s: {
  readonly sums: ActionSums;
  readonly cirhozaBonus: number;
  readonly tuheBonus: number;
  readonly abstaky: number;
  readonly tuheZlava?: number;
}): number {
  const base = (s.sums.Rana ?? 0) + (s.sums.Pecka ?? 0) * 2 + (s.sums.Petelica ?? 0) * 3 + s.cirhozaBonus + s.tuheBonus;
  return Math.max(0, base - abstakyVBitke(s.abstaky) - (s.tuheZlava ?? 0));
}

/** Rozdelenie bodov na starších: id staršieho → body. */
export type Rozdelenie = Readonly<Record<string, number>>;

/** Prvý krok bitky: čo spravia Roboty. Obaja volia naraz a skryto. */
export interface ZamerLieceniaPata {
  /** Koľko Robôt spáli Dlh; ostatné liečia starších z `liecenie` (id → počet Robôt). */
  readonly robotyNaDlh: number;
  readonly liecenie: Rozdelenie;
}

/** Druhý krok bitky: rozdelenie tuhého a jedu na súperových stojacich. Obaja volia naraz a skryto. */
export interface ZamerUtokuPata {
  readonly tuhe: Rozdelenie;
  readonly jed: Rozdelenie;
}

export interface VstupLieceniaPata {
  readonly roboty: number;
  /** Koľko Dlhov spáli jedna Robota (Fúrik). */
  readonly silaRoboty: number;
  /** Priznané Dlhy na začiatku bitky. */
  readonly dlhy: number;
  /** Exekúcia v tomto kole neplatí (Záhradkár). */
  readonly bezExekucie: boolean;
  readonly zamer: ZamerLieceniaPata;
}

export interface VstupUtokuPata {
  readonly tuhe: number;
  readonly povery: number;
  readonly pohorsenie: number;
  /** Nová Viera tejto bitky — hodnota so Svätým textom. */
  readonly viera: number;
  readonly zamer: ZamerUtokuPata;
}

/** Čo rozhoduje víťaza bitky aj zhodu pri súčasnom páde; rátané na začiatku bitky. */
export interface StavBitkyPata {
  readonly tuhe: readonly [number, number];
  readonly abstaky: readonly [number, number];
  readonly dlhy: readonly [number, number];
  readonly utocnik: PlayerId;
}

function sucet(r: Rozdelenie): number {
  return Object.values(r).reduce((a, n) => a + n, 0);
}

/** Rozdelenie smie ísť len na stojacich, po celých kladných bodoch a musí minúť presne `spolu`. */
function platneRozdelenie(r: Rozdelenie, ciele: readonly StarsiPata[], spolu: number): boolean {
  for (const [id, body] of Object.entries(r)) {
    if (!Number.isInteger(body) || body < 0) return false;
    if (body > 0 && !ciele.some((s) => s.karta.defId === id)) return false;
  }
  return sucet(r) === spolu;
}

/** Overenie zámerov — klient posiela zámery, server ich musí vedieť odmietnuť. */
export function platnyZamerLiecenia(stav: PataStav, p: PlayerId, roboty: number, z: ZamerLieceniaPata): boolean {
  if (!Number.isInteger(z.robotyNaDlh) || z.robotyNaDlh < 0 || z.robotyNaDlh > roboty) return false;
  return platneRozdelenie(z.liecenie, stojaci(stav, p), roboty - z.robotyNaDlh);
}

export function platnyZamerUtoku(stav: PataStav, p: PlayerId, tuhe: number, pohorsenie: number, z: ZamerUtokuPata): boolean {
  const q = opponentOf(p);
  return platneRozdelenie(z.tuhe, stojaci(stav, q), tuhe) && platneRozdelenie(z.jed, stojaci(stav, q), pohorsenie);
}

/** Dlhy, ktoré exekúcia spáli: polovica nahor, ako v Kalamite. */
export function palenePriExekucii(dlhy: number): number {
  return Math.ceil(dlhy / 2);
}

/** Víťaz bitky ako v Kalamite (§9.4); Viera doň nezasahuje, je to štít pri staršom. Null = sekera. */
export function vitazBitkyPata(b: Pick<StavBitkyPata, "tuhe" | "abstaky" | "dlhy">): PlayerId | null {
  if (b.tuhe[0] !== b.tuhe[1]) return b.tuhe[0] > b.tuhe[1] ? 0 : 1;
  if (b.abstaky[0] !== b.abstaky[1]) return b.abstaky[0] < b.abstaky[1] ? 0 : 1;
  if (b.dlhy[0] !== b.dlhy[1]) return b.dlhy[0] < b.dlhy[1] ? 0 : 1;
  return null;
}

/** Medzivýsledok kroku bitky; prečerpanie sa sčítava cez oba kroky. */
export interface KrokBitkyPata {
  readonly stav: PataStav;
  /** Starší, ktorí v tejto bitke doteraz padli. */
  readonly padli: readonly [readonly string[], readonly string[]];
  /** Súčet záporných čísel pečene starších padnutých v tejto bitke. */
  readonly precerpanie: readonly [number, number];
  /** Dlhy po Robote a exekúcii. */
  readonly dlhyPo: readonly [number, number];
  /** Víťaz partie, ak niekto prišiel o všetkých starších; ďalší krok sa už nerobí. */
  readonly vitazPartie: PlayerId | null;
}

/** Podrazenie: kto klesol na nulu, padne; jeho jed a štít prepadnú. */
function podrazPadnutych(
  rady: readonly [readonly StarsiPata[], readonly StarsiPata[]],
  predtym: Pick<KrokBitkyPata, "padli" | "precerpanie">,
  dlhyPo: readonly [number, number],
  b: StavBitkyPata,
): KrokBitkyPata {
  const padli: [string[], string[]] = [[...predtym.padli[0]], [...predtym.padli[1]]];
  const precerpanie: [number, number] = [predtym.precerpanie[0], predtym.precerpanie[1]];
  const nove = ([0, 1] as const).map((p) =>
    rady[p].map((s) => {
      if (s.podrazeny || s.pecen > 0) return s;
      padli[p].push(s.karta.defId);
      precerpanie[p] += -s.pecen;
      return { ...s, podrazeny: true, jed: 0, stit: 0 };
    }),
  ) as [StarsiPata[], StarsiPata[]];
  const pad0 = nove[0].every((s) => s.podrazeny);
  const pad1 = nove[1].every((s) => s.podrazeny);
  let vitazPartie: PlayerId | null = null;
  if (pad0 && pad1) {
    // Remíza v režime neexistuje: menšie prečerpanie, potom ako víťaz bitky, nakoniec útočník.
    vitazPartie = precerpanie[0] !== precerpanie[1] ? (precerpanie[0] < precerpanie[1] ? 0 : 1) : (vitazBitkyPata(b) ?? b.utocnik);
  } else if (pad0) {
    vitazPartie = 1;
  } else if (pad1) {
    vitazPartie = 0;
  }
  return { stav: { rady: nove }, padli, precerpanie, dlhyPo, vitazPartie };
}

/**
 * Prvý krok bitky (Michal 2026-11-06): Roboty oboch naraz spália Dlhy a liečia, potom exekúcia
 * uberie každému stojacemu 1 za každý spálený Dlh. Štít ju netlmí.
 */
export function vyhodnotLieceniePata(
  stav: PataStav,
  vstup: readonly [VstupLieceniaPata, VstupLieceniaPata],
  b: StavBitkyPata,
): KrokBitkyPata {
  const dlhyPo: [number, number] = [vstup[0].dlhy, vstup[1].dlhy];
  const rady = ([0, 1] as const).map((p) => {
    const v = vstup[p];
    const poPaleni = Math.max(0, v.dlhy - v.zamer.robotyNaDlh * v.silaRoboty);
    const spalene = v.bezExekucie ? 0 : palenePriExekucii(poPaleni);
    dlhyPo[p] = poPaleni - spalene;
    return stav.rady[p].map((s) => {
      if (s.podrazeny) return s;
      return { ...s, pecen: s.pecen + (v.zamer.liecenie[s.karta.defId] ?? 0) * PATA.ROBOTA_LIECI - spalene };
    });
  }) as [StarsiPata[], StarsiPata[]];
  return podrazPadnutych(rady, { padli: [[], []], precerpanie: [0, 0] }, dlhyPo, b);
}

/**
 * Druhý krok bitky: obaja dávajú poškodenie naraz. Nová Viera pribudne každému stojacemu, Povery a tuhé
 * idú cez štít; kto po nich stojí, dostane nový jed a na konci bitky všetok jed mimo štítu.
 */
export function vyhodnotUtokPata(
  krok: KrokBitkyPata,
  vstup: readonly [VstupUtokuPata, VstupUtokuPata],
  b: StavBitkyPata,
): KrokBitkyPata {
  const rady = ([0, 1] as const).map((p) => {
    const utok = vstup[opponentOf(p)];
    // Má dosť Farára platí od bitky po jeho páde, stav po prvom kroku ho už pozná.
    const pokles = maDost(krok.stav, p, "farar") ? PATA.JED_POKLES_FARAR : PATA.JED_POKLES;
    return krok.stav.rady[p].map((s) => {
      if (s.podrazeny) return s;
      const body = utok.povery + (utok.zamer.tuhe[s.karta.defId] ?? 0);
      const stit = s.stit + vstup[p].viera;
      const zachyti = Math.min(stit, body);
      const pecen = s.pecen - (body - zachyti);
      // Jed na padnutom prepadne.
      if (pecen <= 0) return { ...s, stit: stit - zachyti, pecen };
      const jed = s.jed + (utok.zamer.jed[s.karta.defId] ?? 0);
      return { ...s, stit: stit - zachyti, pecen: pecen - jed, jed: Math.max(0, jed - pokles) };
    });
  }) as [StarsiPata[], StarsiPata[]];
  return podrazPadnutych(rady, krok, krok.dlhyPo, b);
}

/** Rozohraná bitka režimu: oba kroky naraz, zámery sú skryté, kým nevyberú obaja. */
export interface BitkaPata {
  readonly vstupL: readonly [Omit<VstupLieceniaPata, "zamer">, Omit<VstupLieceniaPata, "zamer">];
  readonly vstupU: readonly [Omit<VstupUtokuPata, "zamer">, Omit<VstupUtokuPata, "zamer">];
  readonly bitka: StavBitkyPata;
  readonly liecenie: readonly [ZamerLieceniaPata | null, ZamerLieceniaPata | null];
  readonly utok: readonly [ZamerUtokuPata | null, ZamerUtokuPata | null];
  readonly krok: KrokBitkyPata | null;
  /** Dať vyžrať: hráč už nič nedá. */
  readonly vyzrat: readonly [boolean, boolean];
}

export type KrokPata = "draft" | "rad" | "vymena" | "liecenie" | "utok" | "vyzrat";

/** Stav režimu v GameState. */
export interface HraPata extends PataStav {
  /** Čo sa práve rozhoduje mimo bežných fáz; null = hrá sa kolo ako v Kalamite. */
  readonly krok: KrokPata | null;
  readonly prvy: PlayerId;
  /** Starší, ktorí v drafte ešte ostali. */
  readonly ponuka: readonly CardInstance[];
  /** Poradie radu v tomto kole, skryté, kým nevyberú obaja. */
  readonly radVyber: readonly [readonly string[] | null, readonly string[] | null];
  readonly lokality: LokalityPata;
  readonly bitka: BitkaPata | null;
}

/** Kto v kroku režimu ešte nerozhodol. */
export function mozeHratPata(h: HraPata, p: PlayerId): boolean {
  switch (h.krok) {
    case "draft":
      return naTahuDraftu(h.prvy, PATA.STARSICH_NA_HRACA * 2 - h.ponuka.length) === p;
    case "rad":
      return h.radVyber[p] === null;
    case "vymena":
      return maDost(h, p, "vychovavatelka");
    case "liecenie":
      return h.bitka?.liecenie[p] === null;
    case "utok":
      return h.bitka?.utok[p] === null;
    case "vyzrat":
      return h.bitka?.vyzrat[p] === false;
    case null:
      return false;
  }
}

/** Čo hráč z režimu vidí: súperov výber a zámery nie, kým nevyberú obaja; z lokalít len tie na výber. */
export function hraPataPre(h: HraPata, ja: PlayerId): HraPata {
  const skry = <T>(dvojica: readonly [T | null, T | null], nahrada: T): readonly [T | null, T | null] =>
    (ja === 0 ? [dvojica[0], dvojica[1] === null ? null : nahrada] : [dvojica[0] === null ? null : nahrada, dvojica[1]]) as readonly [T | null, T | null];
  const bitka = h.bitka;
  return {
    ...h,
    radVyber: skry(h.radVyber, []),
    lokality: [h.lokality[0].slice(0, 1), h.lokality[1].slice(0, 1), h.lokality[2].slice(0, 1)],
    bitka:
      bitka === null
        ? null
        : {
            ...bitka,
            // Do odhalenia súper vidí len, že už rozhodol.
            liecenie: bitka.liecenie[0] !== null && bitka.liecenie[1] !== null ? bitka.liecenie : skry(bitka.liecenie, { robotyNaDlh: 0, liecenie: {} }),
            utok: bitka.utok[0] !== null && bitka.utok[1] !== null ? bitka.utok : skry(bitka.utok, { tuhe: {}, jed: {} }),
          },
  };
}

/** Balíčky lokalít po úrovniach; odohraná ide naspodok, takže lokality sa nikdy neminú. */
export type LokalityPata = readonly [readonly CardInstance[], readonly CardInstance[], readonly CardInstance[]];

export function lokalityNaVyberPata(l: LokalityPata): readonly CardInstance[] {
  return l.flatMap((balicek) => (balicek[0] === undefined ? [] : [balicek[0]]));
}

/** Zvolená lokalita ide po kole naspodok svojej úrovne. */
export function odohrajLokalitu(l: LokalityPata, uid: number): LokalityPata {
  const presun = (balicek: readonly CardInstance[]): readonly CardInstance[] => {
    const karta = balicek[0];
    return karta !== undefined && karta.uid === uid ? [...balicek.slice(1), karta] : balicek;
  };
  return [presun(l[0]), presun(l[1]), presun(l[2])];
}

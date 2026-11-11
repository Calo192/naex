// Jazyk rozhrania pre celú aplikáciu. Slovenčina je v balíku vždy (náhradný jazyk), ostatné
// slovníky a preklady kariet sa načítajú až pri prepnutí — kto hrá po slovensky, nesťahuje nič.
// Prepnutie prekreslí celý strom: App číta useJazyk() a žiadny komponent nie je memo, takže
// aj t() mimo hookov (pomocné funkcie, ktoré kreslí komponent) dostane nový jazyk.

import { Fragment, useSyncExternalStore, type ReactNode } from "react";
import { api } from "../lib/api.ts";
import { ZDROJOVY_JAZYK, jazykZPrehliadaca, jeJazyk, preloz, rozober, type Jazyk, type Parametre, type Slovnik, type Uzol } from "./preklad.ts";
import { PRAZDNY_PREKLAD, zostavPreklad, type PrekladKariet, type SuborPrekladu } from "./karty.ts";
import { najdiVzor, vzoryHlasok } from "./hlasky.ts";
import { prelozDlhy, type Oblast, type SuborDlhych } from "./dlhe.ts";
import sk from "./sk.json";

export { JAZYKY, NAZVY_JAZYKOV, type Jazyk } from "./preklad.ts";

const ZDROJ: Slovnik = sk;
const KLUC_ULOZENIA = "naex_jazyk";

const SLOVNIKY: Readonly<Record<Exclude<Jazyk, "sk">, () => Promise<{ default: Slovnik }>>> = {
  en: () => import("./en.json"),
  pl: () => import("./pl.json"),
  cs: () => import("./cs.json"),
  hu: () => import("./hu.json"),
};

interface Stav {
  readonly jazyk: Jazyk;
  readonly slovnik: Slovnik | null;
  /** Surový preklad kariet zo servera (/api/preklady/<jazyk>); mapy z neho zostaví prekladKariet(). */
  readonly karty: SuborPrekladu | null;
  /** Načítané dlhé texty (dlhe.ts) v aktuálnom jazyku — oblasť sa načíta, až keď ju niekto číta. */
  readonly oblasti: Readonly<Partial<Record<Oblast, SuborDlhych>>>;
}

let stav: Stav = { jazyk: ZDROJOVY_JAZYK, slovnik: null, karty: null, oblasti: {} };
const odberatelia = new Set<() => void>();
let poradie = 0;

const zmen = (s: Stav): void => {
  stav = s;
  document.documentElement.lang = s.jazyk;
  for (const o of odberatelia) o();
};

/** Uložená voľba návštevníka; súkromné okno či zakázané úložisko = žiadna. */
function ulozeny(): Jazyk | null {
  try {
    const v = localStorage.getItem(KLUC_ULOZENIA);
    return jeJazyk(v) ? v : null;
  } catch {
    return null;
  }
}

function uloz(j: Jazyk): void {
  try {
    localStorage.setItem(KLUC_ULOZENIA, j);
  } catch {
    // Bez úložiska platí voľba do zatvorenia stránky.
  }
}

/**
 * Jazyk pri štarte: ?jazyk=en v adrese (odkaz pre hráča v inom jazyku, snímky), voľba
 * v prehliadači, inak jazyk prehliadača (prvá návšteva).
 */
export function pociatocnyJazyk(): Jazyk {
  const zAdresy = new URLSearchParams(location.search).get("jazyk");
  if (jeJazyk(zAdresy)) {
    uloz(zAdresy);
    return zAdresy;
  }
  return ulozeny() ?? jazykZPrehliadaca(typeof navigator === "undefined" ? [] : (navigator.languages ?? [navigator.language]));
}

const nacitajKarty = (j: Jazyk): Promise<SuborPrekladu | null> =>
  j === ZDROJOVY_JAZYK ? Promise.resolve(null) : api.get<SuborPrekladu>(`/preklady/${j}`).catch(() => null);

/**
 * Prepne jazyk — až keď je slovník načítaný, aby sa stránka neprekreslila dvakrát (najprv po
 * slovensky). Preklady kariet idú zo servera a dokreslia sa, keď prídu — pomalé API nesmie
 * zdržať prvé vykreslenie. ulozit = voľba hráča (prepínač), nie z prehliadača či profilu.
 */
export async function nastavJazyk(j: Jazyk, ulozit = false): Promise<void> {
  if (ulozit) uloz(j);
  if (j === stav.jazyk && (j === ZDROJOVY_JAZYK || stav.slovnik !== null)) return;
  const n = ++poradie;
  const karty = nacitajKarty(j);
  const slovnik = j === ZDROJOVY_JAZYK ? null : await SLOVNIKY[j]().then((m): Slovnik | null => m.default, () => null);
  // Rýchle klikanie v prepínači: platí posledná voľba.
  if (n !== poradie) return;
  zmen({ jazyk: j, slovnik, karty: null, oblasti: {} });
  const k = await karty;
  if (n === poradie && k !== null) zmen({ ...stav, karty: k });
}

export const aktualnyJazyk = (): Jazyk => stav.jazyk;

/** Súbory dlhých textov po oblastiach — každý je samostatný kúsok balíka, stiahne sa až pri čítaní. */
const SUBORY_OBLASTI = import.meta.glob<{ default: SuborDlhych }>("./{pravidla,pojmy,vyucba,napovedy,achievementy}/{en,pl,cs,hu}.json");
const nacitavane = new Set<string>();

function nacitajOblast(o: Oblast, j: Jazyk): void {
  const kluc = `./${o}/${j}.json`;
  const nacitaj = SUBORY_OBLASTI[kluc];
  // Neúspech sa neopakuje — text ostane po slovensky do ďalšieho prepnutia jazyka.
  if (nacitaj === undefined || nacitavane.has(kluc)) return;
  nacitavane.add(kluc);
  void nacitaj().then(
    (m) => {
      nacitavane.delete(kluc);
      if (stav.jazyk === j) zmen({ ...stav, oblasti: { ...stav.oblasti, [o]: m.default } });
    },
    () => undefined,
  );
}

/**
 * Dlhý text (kapitola pravidiel, krok výučby, nápoveda, achievement) v jazyku hráča: preklad
 * z oblasti, ktorého slovenský originál je presne sk; inak sk. Prvé čítanie oblasť načíta
 * a po načítaní sa stránka prekreslí. pole null = hľadá sa podľa originálu v celom id.
 */
export function textOblasti(o: Oblast, id: string, pole: string | null, sk: string): string {
  if (stav.jazyk === ZDROJOVY_JAZYK) return sk;
  const subor = stav.oblasti[o];
  if (subor === undefined) {
    nacitajOblast(o, stav.jazyk);
    return sk;
  }
  return prelozDlhy(subor, id, pole, sk);
}

/** Preklad kľúča v aktuálnom jazyku; chýbajúci preklad = slovenský text. */
export function t(kluc: string, p?: Parametre): string {
  return preloz(stav.jazyk, stav.slovnik, ZDROJ, kluc, p);
}

/**
 * Text, ktorý prišiel po slovensky zo servera alebo z jadra (popis bota, meno staršieho…):
 * po slovensky ostane presne taký, aký prišiel; v inom jazyku preklad kľúča, kým ho niet, originál.
 * V sk.json je kľúč s aktuálnym slovenským textom — prekladateľ tak vie, čo prekladá.
 */
export function tZoServera(kluc: string, povodny: string, p?: Parametre): string {
  if (stav.jazyk === ZDROJOVY_JAZYK || stav.slovnik === null) return povodny;
  const text = preloz(stav.jazyk, stav.slovnik, {}, kluc, p);
  return text === kluc ? povodny : text;
}

let vzory: ReturnType<typeof vzoryHlasok> | null = null;

/**
 * Hláška motora či servera (slovenský voľný text): po slovensky presne taká, ako prišla; v inom
 * jazyku preklad vzoru motor.* / server.*, na ktorý celá sedí (hlasky.ts), inak originál.
 */
export function prelozHlasku(text: string): string {
  if (stav.jazyk === ZDROJOVY_JAZYK || stav.slovnik === null) return text;
  vzory ??= vzoryHlasok(ZDROJ);
  const z = najdiVzor(text, vzory);
  if (z === null) return text;
  // Časť hlášky, ktorá je sama vzorom („Advokát ušetril {usetril}“ = „2 špaky“), sa preloží tiež.
  const casti: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(z.p)) casti[k] = typeof v === "string" ? prelozHlasku(v) : v;
  const p = preloz(stav.jazyk, stav.slovnik, {}, z.kluc, casti);
  return p === z.kluc ? text : p;
}

/** Tvar podľa rodu hráča (kľúč.m / .z / .n) — ako tvar() v jadre: bot je mužský, bez pohlavia neutrálny. */
export function tRod(kluc: string, rod: "muz" | "zena" | "bot" | null, p?: Parametre): string {
  return t(`${kluc}.${rod === "zena" ? "z" : rod === "muz" || rod === "bot" ? "m" : "n"}`, p);
}

/** Značka v preklade: obsah (už so vnorenými značkami), poradie a atribút (<a href="#x"> → "#x"). */
export type Znacka = (obsah: ReactNode, i: number, atribut: string | null) => ReactNode;

/** Značky, ktoré smie preklad obsahovať: <b>tučné</b>, <strong>dôraz</strong>, <i>kurzíva</i>, <em>, <kod>kód</kod>. */
const ZNACKY: Readonly<Record<string, Znacka>> = {
  b: (o, i) => <b key={i}>{o}</b>,
  strong: (o, i) => <strong key={i}>{o}</strong>,
  i: (o, i) => <i key={i}>{o}</i>,
  em: (o, i) => <em key={i}>{o}</em>,
  kod: (o, i) => <code key={i}>{o}</code>,
};

/**
 * Preklad s formátovaním (<b>…</b>) a s parametrami, ktoré sú prvky (odkaz, kód miestnosti):
 * textové parametre sa dosadia rovno, prvok tam, kde je {meno} v texte. Stránka smie pridať
 * vlastné značky (pravidlá: <p k="lokalita">lokalitu</p> = pojem zo slovníka).
 */
export function tr(kluc: string, p?: Readonly<Record<string, string | number | ReactNode>>, znacky?: Readonly<Record<string, Znacka>>): ReactNode {
  const textove: Record<string, string | number> = {};
  const prvky: Record<string, ReactNode> = {};
  for (const [k, v] of Object.entries(p ?? {})) {
    if (typeof v === "string" || typeof v === "number") textove[k] = v;
    else prvky[k] = v;
  }
  return formatuj(t(kluc, textove), prvky, znacky);
}

/** Text so značkami a prvkami na React; čistý text bez značiek ostane reťazcom. */
export function formatuj(text: string, prvky: Readonly<Record<string, ReactNode>> = {}, znacky?: Readonly<Record<string, Znacka>>): ReactNode {
  const vsetky = znacky === undefined ? ZNACKY : { ...ZNACKY, ...znacky };
  const kresli = (uzly: readonly Uzol[]): ReactNode[] =>
    uzly.map((u, i) => (typeof u === "string" ? <Fragment key={i}>{sPrvkami(u, prvky)}</Fragment> : (vsetky[u.znacka]?.(<>{kresli(u.deti)}</>, i, u.atribut) ?? null)));
  const uzly = rozober(text, Object.keys(vsetky));
  if (uzly.length === 1 && typeof uzly[0] === "string" && Object.keys(prvky).length === 0) return uzly[0];
  return <>{kresli(uzly)}</>;
}

function sPrvkami(text: string, prvky: Readonly<Record<string, ReactNode>>): ReactNode {
  if (Object.keys(prvky).length === 0) return text;
  const out: ReactNode[] = [];
  let od = 0;
  for (const m of text.matchAll(/\{([\p{L}\p{N}_]+)\}/gu)) {
    const k = m[1] ?? "";
    if (!(k in prvky)) continue;
    if (m.index > od) out.push(text.slice(od, m.index));
    out.push(<Fragment key={`${k}${m.index}`}>{prvky[k]}</Fragment>);
    od = m.index + m[0].length;
  }
  if (od < text.length) out.push(text.slice(od));
  return out;
}

const odober = (o: () => void): (() => void) => {
  odberatelia.add(o);
  return () => odberatelia.delete(o);
};
const snimka = (): Stav => stav;

/** Aktuálny jazyk; komponent sa prekreslí po prepnutí. */
export function useJazyk(): Jazyk {
  return useSyncExternalStore(odober, snimka).jazyk;
}

let zostaveny: { readonly z: SuborPrekladu; readonly p: PrekladKariet } | null = null;

/** Preklad kariet v aktuálnom jazyku; slovenčina či chýbajúci preklad = prázdny, karty ako doteraz. */
export function prekladKariet(): PrekladKariet {
  const z = stav.karty;
  if (z === null || stav.jazyk === ZDROJOVY_JAZYK) return PRAZDNY_PREKLAD;
  if (zostaveny?.z === z) return zostaveny.p;
  const p = zostavPreklad(z, { hore: t("karta.hore"), dole: t("karta.dole") });
  zostaveny = { z, p };
  return p;
}

/** Preklad kariet v komponente — prekreslí sa po prepnutí jazyka. */
export function usePrekladKariet(): PrekladKariet {
  useSyncExternalStore(odober, snimka);
  return prekladKariet();
}

/** Názov karty v jazyku hráča (slovenský, kým preklad nie je). */
export const nazovKarty = (sk: string): string => prekladKariet().nazvy.get(sk) ?? sk;

/** Kraj lokality v jazyku hráča podľa id karty a strany. */
export function krajLokality(id: string, strana: "lava" | "prava", sk: string): string {
  const k = prekladKariet().kraje.get(id);
  return k === undefined ? sk : k[strana === "lava" ? 0 : 1];
}

/** Tag karty v jazyku hráča. */
export const nazovTagu = (sk: string): string => prekladKariet().tagy.get(sk) ?? sk;

/** Record s gettermi: text sa číta v jazyku hráča pri každom použití (kľúč predpona.<kľúč>). */
export const textyPodla = <K extends string>(kluce: readonly K[], predpona: string): Readonly<Record<K, string>> =>
  Object.defineProperties({}, Object.fromEntries(kluce.map((k) => [k, { get: () => t(`${predpona}.${k}`), enumerable: true }]))) as Readonly<Record<K, string>>;

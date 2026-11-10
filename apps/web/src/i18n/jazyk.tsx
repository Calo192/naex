// Jazyk rozhrania pre celú aplikáciu. Slovenčina je v balíku vždy (náhradný jazyk), ostatné
// slovníky a preklady kariet sa načítajú až pri prepnutí — kto hrá po slovensky, nesťahuje nič.
// Prepnutie prekreslí celý strom: App číta useJazyk() a žiadny komponent nie je memo, takže
// aj t() mimo hookov (pomocné funkcie, ktoré kreslí komponent) dostane nový jazyk.

import { Fragment, useSyncExternalStore, type ReactNode } from "react";
import { api } from "../lib/api.ts";
import { ZDROJOVY_JAZYK, jazykZPrehliadaca, jeJazyk, preloz, useky, type Jazyk, type Parametre, type Slovnik } from "./preklad.ts";
import { PRAZDNY_PREKLAD, zostavPreklad, type PrekladKariet, type SuborPrekladu } from "./karty.ts";
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
}

let stav: Stav = { jazyk: ZDROJOVY_JAZYK, slovnik: null, karty: null };
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
  zmen({ jazyk: j, slovnik, karty: null });
  const k = await karty;
  if (n === poradie && k !== null) zmen({ ...stav, karty: k });
}

export const aktualnyJazyk = (): Jazyk => stav.jazyk;

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

/** Tvar podľa rodu hráča (kľúč.m / .z / .n) — ako tvar() v jadre: bot je mužský, bez pohlavia neutrálny. */
export function tRod(kluc: string, rod: "muz" | "zena" | "bot" | null, p?: Parametre): string {
  return t(`${kluc}.${rod === "zena" ? "z" : rod === "muz" || rod === "bot" ? "m" : "n"}`, p);
}

/** Značky, ktoré smie preklad obsahovať: <b>tučné</b>, <strong>dôraz</strong>, <i>kurzíva</i>, <kod>kód</kod>. */
const ZNACKY: Readonly<Record<string, (obsah: string, i: number) => ReactNode>> = {
  b: (o, i) => <b key={i}>{o}</b>,
  strong: (o, i) => <strong key={i}>{o}</strong>,
  i: (o, i) => <i key={i}>{o}</i>,
  kod: (o, i) => <code key={i}>{o}</code>,
};

/**
 * Preklad s formátovaním (<b>…</b>) a s parametrami, ktoré sú prvky (odkaz, kód miestnosti):
 * textové parametre sa dosadia rovno, prvok tam, kde je {meno} v texte.
 */
export function tr(kluc: string, p?: Readonly<Record<string, string | number | ReactNode>>): ReactNode {
  const textove: Record<string, string | number> = {};
  const prvky: Record<string, ReactNode> = {};
  for (const [k, v] of Object.entries(p ?? {})) {
    if (typeof v === "string" || typeof v === "number") textove[k] = v;
    else prvky[k] = v;
  }
  const text = t(kluc, textove);
  const casti = useky(text, Object.keys(ZNACKY)).map((u, i) => {
    if (u.znacka !== null) return ZNACKY[u.znacka]?.(u.text, i) ?? u.text;
    return <Fragment key={i}>{sPrvkami(u.text, prvky)}</Fragment>;
  });
  return casti.length === 1 && typeof casti[0] === "string" ? casti[0] : <>{casti}</>;
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

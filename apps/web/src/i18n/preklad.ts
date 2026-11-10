// Preklad rozhrania (lokalizácia, Michal 2026-11-10: en, pl, cs, hu). Zdrojom je slovenský
// slovník sk.json; preklady sú JSON s tými istými kľúčmi, aby ich prekladateľ plnil bez kódu.
// Chýbajúci alebo prázdny kľúč v preklade = slovenský text (hra sa dá hrať aj s polovičným
// prekladom). Čisté funkcie bez prehliadača — stav jazyka drží jazyk.tsx.

export const JAZYKY = ["sk", "en", "pl", "cs", "hu"] as const;
export type Jazyk = (typeof JAZYKY)[number];
export const ZDROJOVY_JAZYK = "sk" satisfies Jazyk;

/** Názov jazyka v ňom samom — prepínač ho ukazuje tak, ako ho hľadá jeho hovoriaci. */
export const NAZVY_JAZYKOV: Readonly<Record<Jazyk, string>> = {
  sk: "Slovenčina",
  en: "English",
  pl: "Polski",
  cs: "Čeština",
  hu: "Magyar",
};

export const jeJazyk = (v: unknown): v is Jazyk => typeof v === "string" && (JAZYKY as readonly string[]).includes(v);

/**
 * Tvary počítaného slova podľa vzoru „1 karta / 2 karty / 5 kariet“. Prekladateľ vyplní tie,
 * ktoré jeho jazyk má: en a hu stačí "1" a "5", pl/cs/sk všetky tri. Chýbajúci tvar = "5".
 */
export interface Tvary {
  readonly "1"?: string;
  readonly "2"?: string;
  readonly "5"?: string;
}
export type Hodnota = string | Tvary;
/** Slovník: kľúč → text alebo tvary; kľúče s „_“ na začiatku sú poznámky pre prekladateľa. */
export type Slovnik = Readonly<Record<string, Hodnota | Readonly<Record<string, unknown>>>>;

export type Parametre = Readonly<Record<string, string | number>>;

/**
 * Ktorý tvar patrí k číslu. sk, cs: 1 / 2–4 / ostatné. pl: 1 / končí na 2–4 okrem 12–14
 * (22 karty, ale 12 kart) / ostatné. en, hu: 1 / ostatné (maďarčina po číslovke množné číslo
 * nedáva, prekladateľ tam napíše rovnaký text). Desatinné číslo berie tvar „5“.
 */
export function tvarPoctu(jazyk: Jazyk, n: number): keyof Tvary {
  const a = Math.abs(n);
  if (!Number.isInteger(a)) return "5";
  if (a === 1) return "1";
  if (jazyk === "sk" || jazyk === "cs") return a >= 2 && a <= 4 ? "2" : "5";
  if (jazyk === "pl") {
    const d = a % 10;
    const s = a % 100;
    return d >= 2 && d <= 4 && (s < 12 || s > 14) ? "2" : "5";
  }
  return "5";
}

const jeTvary = (v: unknown): v is Tvary => typeof v === "object" && v !== null && !Array.isArray(v);

/** Text z hodnoty slovníka; null = hodnota chýba alebo je prázdna (prekladateľ ju ešte nevyplnil). */
function textHodnoty(v: unknown, jazyk: Jazyk, n: number | undefined): string | null {
  if (typeof v === "string") return v === "" ? null : v;
  if (!jeTvary(v)) return null;
  const tvar = n === undefined ? "5" : tvarPoctu(jazyk, n);
  // Chýbajúci tvar: "2" → "5" (en nemá „2“), "5" → "2" → "1".
  const poradie: readonly (keyof Tvary)[] = tvar === "1" ? ["1", "5", "2"] : tvar === "2" ? ["2", "5", "1"] : ["5", "2", "1"];
  for (const k of poradie) {
    const t = v[k];
    if (typeof t === "string" && t !== "") return t;
  }
  return null;
}

/** Dosadí {meno} z parametrov; zápis, ktorý parameter nemá (napr. {Rana} karty), nechá tak. */
export function dosad(text: string, p: Parametre | undefined): string {
  if (p === undefined) return text;
  return text.replace(/\{([\p{L}\p{N}_]+)\}/gu, (cely: string, k: string) => {
    const v = p[k];
    return v === undefined ? cely : String(v);
  });
}

/**
 * Preklad kľúča: najprv cieľový slovník, potom slovenský; ani tam = kľúč sám (chyba v kóde,
 * stráži ju test). Parameter n vyberá tvar počítaného slova.
 */
export function preloz(jazyk: Jazyk, ciel: Slovnik | null, zdroj: Slovnik, kluc: string, p?: Parametre): string {
  const n = typeof p?.n === "number" ? p.n : undefined;
  const text = (ciel !== null && jazyk !== ZDROJOVY_JAZYK ? textHodnoty(ciel[kluc], jazyk, n) : null) ?? textHodnoty(zdroj[kluc], ZDROJOVY_JAZYK, n);
  return dosad(text ?? kluc, p);
}

/**
 * Jazyk z prehliadača (navigator.languages) pri prvej návšteve: prvý, ktorý hra pozná;
 * „sk-SK“ = sk. Prehliadač v jazyku, ktorý hra nemá (de, uk…), dostane angličtinu — slovenčinu
 * by cudzinec nečítal. Bez údaja slovenčina.
 */
export function jazykZPrehliadaca(jazyky: readonly string[]): Jazyk {
  for (const j of jazyky) {
    const zaklad = j.toLowerCase().split(/[-_]/u)[0];
    if (jeJazyk(zaklad)) return zaklad;
  }
  return jazyky.some((j) => j.trim() !== "") ? "en" : ZDROJOVY_JAZYK;
}

/** Úsek textu so značkou: <b>…</b> v preklade → komponent podľa mena značky. */
export type Usek = { readonly text: string; readonly znacka: string | null };

/**
 * Rozdelí text na úseky podľa jednoduchých značiek <meno>…</meno> (bez vnárania) — preklad
 * smie mať tučné slovo inde než slovenčina. Neznáma značka ostane textom.
 */
export function useky(text: string, znacky: readonly string[]): Usek[] {
  const out: Usek[] = [];
  const re = /<([a-z]+)>([\s\S]*?)<\/\1>/gu;
  let od = 0;
  for (const m of text.matchAll(re)) {
    const meno = m[1] ?? "";
    if (!znacky.includes(meno)) continue;
    const i = m.index;
    if (i > od) out.push({ text: text.slice(od, i), znacka: null });
    out.push({ text: m[2] ?? "", znacka: meno });
    od = i + m[0].length;
  }
  if (od < text.length) out.push({ text: text.slice(od), znacka: null });
  return out;
}

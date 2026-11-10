// Preklad kariet na zobrazenie (lokalizácia, Michal 2026-11-10). Jadro aj pečate na líci
// karty čítajú slovenský text efektu ({Akcia}, spúšťače, hrany Nástroja) — preklad je len
// to, čo hráč číta. Preklad platí, len kým sa slovenský text karty nezmenil (pole sk v súbore
// prekladateľa); po zmene karty v tvorcovi karta ostane po slovensky, kým ju nepreloží znova —
// radšej slovensky a presne než po anglicky a zastarane.

import type { AkciaDef, KlucoveSlovo, Vzhlad } from "@naex/tvorba";
import { akciaZTokenu } from "@naex/core";

/** Odpoveď /api/preklady/<jazyk> — súbory prekladateľa bez poznámok. */
export interface SuborPrekladu {
  readonly karty: Readonly<Record<string, unknown>>;
  readonly vzhlad: Readonly<Record<string, unknown>>;
}

export interface PrekladKariet {
  /** Slovenský názov → preložený. */
  readonly nazvy: ReadonlyMap<string, string>;
  /** Slovenský text efektu (presne) → preložený. */
  readonly efekty: ReadonlyMap<string, string>;
  /** Id karty → kraje lokality [ľavý, pravý]. */
  readonly kraje: ReadonlyMap<string, readonly [string, string]>;
  /** Tag (kategória) → preložený. */
  readonly tagy: ReadonlyMap<string, string>;
  /** Kľúč akcie → názov a popis. */
  readonly akcie: ReadonlyMap<string, { readonly nazov: string; readonly popis: string }>;
  /** Slovenské kľúčové slovo → preložené slovo, tvary a popis. */
  readonly klucoveSlova: ReadonlyMap<string, { readonly slovo: string; readonly tvary: readonly string[]; readonly popis: string }>;
  /** Bodovacia karta (priazeň) → preložený názov. */
  readonly bodovacie: ReadonlyMap<string, string>;
  /** Slová hrán Nástroja v preklade („Top“, „Bottom“). */
  readonly hore: string;
  readonly dole: string;
  /** false = slovenčina alebo preklad ešte nie je; karty sa kreslia ako doteraz. */
  readonly aktivny: boolean;
}

export const PRAZDNY_PREKLAD: PrekladKariet = {
  nazvy: new Map(),
  efekty: new Map(),
  kraje: new Map(),
  tagy: new Map(),
  akcie: new Map(),
  klucoveSlova: new Map(),
  bodovacie: new Map(),
  hore: "Hore",
  dole: "Dole",
  aktivny: false,
};

const obj = (v: unknown): Readonly<Record<string, unknown>> => (typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v : null);

/** Mapy prekladu zo súborov prekladateľa; neúplný záznam sa preskočí (karta ostane po slovensky). */
export function zostavPreklad(subor: SuborPrekladu, slova: { readonly hore: string; readonly dole: string }): PrekladKariet {
  const nazvy = new Map<string, string>();
  const efekty = new Map<string, string>();
  const kraje = new Map<string, readonly [string, string]>();
  for (const [id, v] of Object.entries(obj(subor.karty))) {
    const k = obj(v);
    const sk = obj(k.sk);
    const skNazov = str(sk.nazov);
    const nazov = str(k.nazov);
    if (skNazov !== null && nazov !== null) nazvy.set(skNazov, nazov);
    const skEfekt = typeof sk.efekt === "string" ? sk.efekt : null;
    const efekt = str(k.efekt);
    if (skEfekt !== null && skEfekt !== "" && efekt !== null) efekty.set(skEfekt, efekt);
    const kr = Array.isArray(k.kraje) ? k.kraje : null;
    const l = str(kr?.[0]);
    const p = str(kr?.[1]);
    if (l !== null && p !== null) kraje.set(id, [l, p]);
  }
  const vz = obj(subor.vzhlad);
  const akcie = new Map<string, { nazov: string; popis: string }>();
  for (const [kluc, v] of Object.entries(obj(vz.akcie))) {
    const a = obj(v);
    const nazov = str(a.nazov);
    if (nazov !== null) akcie.set(kluc, { nazov, popis: str(a.popis) ?? "" });
  }
  const klucoveSlova = new Map<string, { slovo: string; tvary: readonly string[]; popis: string }>();
  for (const [sk, v] of Object.entries(obj(vz.klucoveSlova))) {
    const a = obj(v);
    const slovo = str(a.slovo);
    if (slovo === null) continue;
    const tvary = Array.isArray(a.tvary) ? a.tvary.filter((x): x is string => typeof x === "string" && x !== "") : [];
    klucoveSlova.set(sk, { slovo, tvary, popis: str(a.popis) ?? "" });
  }
  const mapa = (v: unknown): Map<string, string> => new Map(Object.entries(obj(v)).flatMap(([k, x]) => (str(x) === null ? [] : [[k, x as string] as const])));
  return { nazvy, efekty, kraje, tagy: mapa(vz.kategorie), akcie, klucoveSlova, bodovacie: mapa(vz.bodovacie), hore: slova.hore, dole: slova.dole, aktivny: true };
}

/**
 * Vzhľad pre kartu s preloženým textom: akcie s preloženým menom a popisom, kľúčové slová
 * v jazyku prekladu (tučné a zalomenie ako v slovenčine). Kategórie ostávajú — podľa ich
 * slovenských mien sa farbí karta.
 */
export function prelozVzhlad(v: Vzhlad, p: PrekladKariet): Vzhlad {
  if (!p.aktivny) return v;
  const akcie: AkciaDef[] = v.akcie.map((a) => {
    const x = p.akcie.get(a.kluc);
    return x === undefined ? a : { ...a, nazov: x.nazov, popis: x.popis === "" ? a.popis : x.popis };
  });
  const klucoveSlova: KlucoveSlovo[] = v.klucoveSlova.map((k) => {
    const x = p.klucoveSlova.get(k.slovo);
    return x === undefined ? k : { ...k, slovo: x.slovo, tvary: x.tvary, popis: x.popis === "" ? k.popis : x.popis };
  });
  return { ...v, akcie, klucoveSlova };
}

const esc = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
const TOKEN = /\{([^{}]+)\}/gu;
const SIPKA = String.raw`\s*(?:→|->|>)\s*`;

/**
 * Text preloženého efektu pripravený tak, ako KartaLico pripravuje slovenský: na Nástroji
 * s rámom hrany zmiznú (kreslí ich rám), zápis Preškolenia {X}→{Y} zmizne (kreslí ho pečať)
 * a pri akciách navyše zmiznú piktogramy (kreslí ich pečať), hrany ostanú slovami.
 * Spúšťače sa tu nehľadajú — čo pečať kreslí, zistí KartaLico zo slovenského textu.
 */
export function efektNaZobrazenie(
  text: string,
  o: { readonly hore: string; readonly dole: string; readonly nastroj: boolean; readonly sNavyse: boolean; readonly menoAkcie: (kluc: string) => string },
): string {
  const kde = `(?:${esc(o.hore)}|${esc(o.dole)})`;
  const hrana = new RegExp(String.raw`(?<=^|[\s.!?])(${kde}):\s*([^.!?\n]*?)\s*(?:[.!?]+|(?=\n)|(?=\s${kde}:)|$)`, "gu");
  let s = text;
  if (o.nastroj) s = s.replace(hrana, "");
  // Preškolenie mimo hrán — hrany ho majú tiež, tie ostávajú (rám alebo slová nižšie).
  const preskolenie = new RegExp(String.raw`(?:${kde}:\s*)?\{([^{}]+)\}${SIPKA}\{([^{}]+)\}`, "gu");
  s = s.replace(preskolenie, (m: string) => (new RegExp(String.raw`^${kde}:`, "u").test(m) ? m : ""));
  if (o.sNavyse) {
    const meno = (token: string): string => o.menoAkcie(akciaZTokenu(token) ?? token);
    s = s
      .replace(hrana, (_cely: string, slovo: string, obsah: string) => {
        const slovami = obsah.replace(new RegExp(String.raw`\{([^{}]+)\}${SIPKA}\{([^{}]+)\}`, "gu"), (_m: string, a: string, b: string) => `${meno(a)} → ${meno(b)}`).replace(TOKEN, (_m: string, a: string) => meno(a));
        return `${slovo}: ${slovami}. `;
      })
      .replace(TOKEN, "")
      .replace(/[ \t]+([.,!?])/gu, "$1")
      .replace(/:([.,!?])/gu, "$1");
  }
  return s
    .replace(/[ \t]+([.,!?])/gu, "$1")
    .replace(/[ \t]{2,}/gu, " ")
    .trim();
}

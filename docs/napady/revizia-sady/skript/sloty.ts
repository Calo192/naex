// Návrh slotov (blocked + allowed) hráčskych kariet po revízii sady — overenie podmienok Michala.
//
//   node --experimental-strip-types --no-warnings docs/napady/revizia-sady/skript/sloty.ts
//
// Zapíše docs/napady/revizia-sady/sloty.json a docs/napady/navrh-sloty.html, vypíše súhrn
// a skončí kódom 1, ak návrh (PO) poruší niektorú podmienku. Žiadna simulácia partií:
// rozloženia generuje sideLayouts z jadra (packages/core/src/variants.ts), hra z nich losuje
// rovnomerne (engine.ts:679), preto je „očakávaný výskyt“ priemer cez rozloženia strany.
//
// Podmienky (Michal 27. 10. 2026, doslova v HTML):
//   1. žiadna hráčska karta nemá viac ako 8 variantov (ľavé × pravé rozloženia),
//   2. každá má aspoň 4 varianty,
//   3. rozloženie akcií po indexoch približne rovnomerné — prevod na čísla (Leader):
//      a) druh s aspoň 4 očakávanými výskytmi: každý index 15–40 % výskytov druhu (obe strany spolu),
//      b) vzácnejší druh: aspoň dve rôzne okná na rôznych kartách,
//      c) obsadenosť každého indexu (ľavá aj pravá strana zvlášť) v pásme ±20 % od priemeru strany.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { sideLayouts } from "../../../../packages/core/src/variants.ts";
import type { SideDef } from "../../../../packages/core/src/types.ts";
import { AKCIE_PORADIE, KARTY, SKRATKY, type Akcie, type KartaPoRevizii } from "./karty.ts";

const TU = dirname(fileURLToPath(import.meta.url));
const KOREN = join(TU, "..", "..", "..", "..");

interface Okno {
  readonly b: readonly number[];
  readonly a?: Readonly<Record<number, readonly string[]>>;
}
interface OknaKarty {
  readonly L: Okno;
  readonly R: Okno;
}

// ---------------------------------------------------------------------------
// NÁVRH (PO) = výsledok skript/hladaj.ts s predvolenými parametrami: lokálne hľadanie nad všetkými
// oknami (blocked × allowed) s pevnými pripnutiami nižšie. allowed len tam, kde bez neho nejde stlačiť
// počet variantov na 4–8 alebo udržať pripnutie.
export const OKNA_PO: Readonly<Record<string, OknaKarty>> = {
  noviny: { L: { b: [0, 3] }, R: { b: [3] } },
  cigorky: { L: { b: [2, 3] }, R: { b: [0, 3] } },
  vinko: { L: { b: [] }, R: { b: [] } },
  pasca: { L: { b: [1, 2] }, R: { b: [3] } },
  puska: { L: { b: [0, 1] }, R: { b: [0, 1] } },
  svaty_text: { L: { b: [0, 1] }, R: { b: [] } },
  nealko: { L: { b: [] }, R: { b: [1, 2, 3] } },
  vyherny_automat: { L: { b: [] }, R: { b: [] } },
  vidly: { L: { b: [] }, R: { b: [0, 3] } },
  lievik: { L: { b: [0, 1] }, R: { b: [3] } },
  cierna_macka: { L: { b: [0, 1] }, R: { b: [1, 3] } },
  pes: { L: { b: [1, 2] }, R: { b: [0] } },
  krokodil: { L: { b: [1, 3] }, R: { b: [0, 1] } },
  kapybara: { L: { b: [0, 3] }, R: { b: [2, 3] } },
  kon: { L: { b: [0, 1] }, R: { b: [2, 3] } },
  kohut: { L: { b: [1, 2] }, R: { b: [2] } },
  financna_poradkyna: { L: { b: [0] }, R: { b: [0], a: { 1: ["Obmedzenie"] } } },
  velmi_smutiaca_vdova: { L: { b: [3] }, R: { b: [1, 2] } },
  vestica: { L: { b: [0], a: { 3: ["PoškodeniePečene"] } }, R: { b: [0] } },
  silna_nezavisla_zena: { L: { b: [2] }, R: { b: [1, 3] } },
  policajtka: { L: { b: [0, 3] }, R: { b: [2, 3] } },
  hasic: { L: { b: [2, 3] }, R: { b: [1, 2] } },
  praudovravec: { L: { b: [2], a: { 1: ["Povera", "Viera"] } }, R: { b: [0], a: { 3: ["Vízia"] } } },
  zamocnik: { L: { b: [0, 3] }, R: { b: [0, 1] } },
  niekoho_stryna: { L: { b: [3], a: { 0: ["Viera"] } }, R: { b: [2], a: { 3: ["Povera", "Viera"] } } },
  veteran: { L: { b: [0, 1] }, R: { b: [1, 3] } },
  recidivista: { L: { b: [2] }, R: { b: [2, 3] } },
  liberal: { L: { b: [2, 3] }, R: { b: [1, 3] } },
  zivnostnik: { L: { b: [], a: { 0: ["Robota"], 1: ["Odpor"] } }, R: { b: [0] } },
  kocovnik: { L: { b: [0, 3] }, R: { b: [2], a: { 3: ["PoškodeniePečene", "Pecka"] } } },
  svokra: { L: { b: [1, 2, 3] }, R: { b: [3] } },
  sarlatan: { L: { b: [2] }, R: { b: [0], a: { 2: ["Pohoršenie"] } } },
  podvodnik: { L: { b: [1] }, R: { b: [1, 3] } },
  zahradkar: { L: { b: [1] }, R: { b: [2], a: { 1: ["Poldeci"] } } },
  anonymny_alkoholik: { L: { b: [0, 1] }, R: { b: [0, 3] } },
  presbiter: { L: { b: [1, 3] }, R: { b: [2, 3] } },
  dvojcata: { L: { b: [0, 1] }, R: { b: [0, 1] } },
  sofer: { L: { b: [1, 2] }, R: { b: [1, 3] } },
  snubenica: { L: { b: [0, 1] }, R: { b: [1, 2] } },
  degustatorka: { L: { b: [2, 3] }, R: { b: [1, 2] } },
  klebetnica: { L: { b: [1, 3] }, R: { b: [0, 2] } },
  dohadzovacka: { L: { b: [0, 1] }, R: { b: [2, 3] } },
  vandal: { L: { b: [2, 3] }, R: { b: [0, 1] } },
  stryko_z_ameriky: { L: { b: [0, 1] }, R: { b: [1] } },
  opatrovatelka: { L: { b: [2, 3] }, R: { b: [0, 1] } },
  smetiarka: { L: { b: [0, 2] }, R: { b: [1, 3] } },
  brigadnik: { L: { b: [], a: { 0: ["Cigareta"], 3: ["Pakt"] } }, R: { b: [0], a: { 3: ["Obmedzenie"] } } },
  masiar: { L: { b: [2, 3] }, R: { b: [2, 3] } },
  kulturista: { L: { b: [0, 2, 3] }, R: { b: [] } },
  traktoristka: { L: { b: [0, 1] }, R: { b: [2] } },
  oslavenec: { L: { b: [0, 2] }, R: { b: [0, 3] } },
  vymahac: { L: { b: [2, 3] }, R: { b: [0, 3] } },
  pijan: { L: { b: [1, 2], a: { 0: ["PoškodeniePečene"] } }, R: { b: [1] } },
  milujuca_manzelka: { L: { b: [2, 3] }, R: { b: [0, 2] } },
  ministrant: { L: { b: [0, 1] }, R: { b: [1, 2] } },
  dievcina_na_vydaj: { L: { b: [3] }, R: { b: [0, 2] } },
};

// ---------------------------------------------------------------------------
// PRED = tie isté akcie po revízii s oknami, aké by dostali bez preusporiadania:
// cards.json pri kartách bez zmeny akcií, plan.json `strany` (10.1) pri prerobených a nových,
// sloty schválených noviniek z ich návrhových dokumentov, Pakt podľa 12.1.
const OKNA_PRED_INAK: Readonly<Record<string, OknaKarty>> = {
  // 10.1 (plan.json strany)
  puska: { L: { b: [0, 1] }, R: { b: [0, 1] } },
  vyherny_automat: { L: { b: [] }, R: { b: [] } },
  financna_poradkyna: { L: { b: [], a: { 0: ["Dlh"], 1: ["Dlh"], 2: ["Povera"], 3: ["Povera"] } }, R: { b: [], a: { 0: ["Cigareta", "Obmedzenie"], 1: ["Cigareta", "Obmedzenie"], 2: ["Dlh"], 3: ["Dlh"] } } },
  vestica: { L: { b: [], a: { 0: ["Vízia"], 1: ["Vízia"], 2: ["Cigareta", "PoškodeniePečene"], 3: ["Cigareta", "PoškodeniePečene"] } }, R: { b: [3] } },
  praudovravec: { L: { b: [3] }, R: { b: [2], a: { 0: ["Povera", "Vízia"], 1: ["Povera", "Vízia"], 3: ["Pohoršenie"] } } },
  niekoho_stryna: { L: { b: [3], a: { 0: ["Poldeci", "Viera"], 1: ["Poldeci", "Viera"], 2: ["PoškodeniePečene"] } }, R: { b: [], a: { 0: ["Viera"], 1: ["Povera", "Viera"], 2: ["Povera", "Vízia"], 3: ["Povera", "Vízia"] } } },
  veteran: { L: { b: [2, 3] }, R: { b: [0], a: { 1: ["Odpor"], 2: ["Petelica"], 3: ["Petelica"] } } },
  recidivista: { L: { b: [0, 3] }, R: { b: [], a: { 0: ["Petelica"], 1: ["Petelica"], 2: ["Rana"], 3: ["Rana"] } } },
  liberal: { L: { b: [2, 3] }, R: { b: [0, 1] } },
  kocovnik: { L: { b: [0, 3] }, R: { b: [3], a: { 0: ["Cigareta"], 1: ["Pecka", "PoškodeniePečene"], 2: ["Pecka", "PoškodeniePečene"] } } },
  sarlatan: { L: { b: [3] }, R: { b: [3], a: { 0: ["Cigareta", "Pohoršenie"], 1: ["Cigareta", "Pohoršenie"], 2: ["PoškodeniePečene"] } } },
  podvodnik: { L: { b: [], a: { 0: ["Cigareta"], 1: ["Cigareta"], 2: ["Dlh"], 3: ["Dlh"] } }, R: { b: [0], a: { 1: ["Obmedzenie"], 2: ["Rana"], 3: ["Rana"] } } },
  zahradkar: { L: { b: [], a: { 0: ["Cigareta"], 1: ["Cigareta"], 2: ["PoškodeniePečene"], 3: ["PoškodeniePečene"] } }, R: { b: [], a: { 0: ["Poldeci", "Rana"], 1: ["Poldeci", "Rana"], 2: ["Robota"], 3: ["Robota"] } } },
  dvojcata: { L: { b: [2, 3] }, R: { b: [0, 1] } },
  sofer: { L: { b: [0, 3] }, R: { b: [0, 3] } },
  masiar: { L: { b: [0, 3] }, R: { b: [0, 3] } },
  kulturista: { L: { b: [0, 2, 3] }, R: { b: [0, 3] } },
  traktoristka: { L: { b: [0, 3] }, R: { b: [0, 3] } },
  oslavenec: { L: { b: [0, 3] }, R: { b: [0, 3] } },
  // 10.1 + Pakt (12.1): Brigádnik Pakt na odblokovaný slot 3, Živnostník Dlh/Pakt na 2–3.
  brigadnik: { L: { b: [], a: { 0: ["Robota"], 1: ["Cigareta", "Rana"], 2: ["Cigareta", "Rana"], 3: ["Pakt"] } }, R: { b: [0], a: { 1: ["Robota"], 2: ["PoškodeniePečene", "Obmedzenie"], 3: ["PoškodeniePečene", "Obmedzenie"] } } },
  zivnostnik: { L: { b: [], a: { 0: ["Odpor", "Robota"], 1: ["Odpor", "Robota"], 2: ["Dlh", "Pakt"], 3: ["Dlh", "Pakt"] } }, R: { b: [], a: { 0: ["Cigareta"], 1: ["Cigareta"], 2: ["PoškodeniePečene"], 3: ["PoškodeniePečene"] } } },
  // Dávka 3: Svokra s Dlhom namiesto Obmedzenia v tom istom okne, Vymáhač podľa D5.
  svokra: { L: { b: [2, 3] }, R: { b: [], a: { 0: ["Viera"], 1: ["Viera"], 2: ["Dlh", "Pecka"], 3: ["Dlh", "Pecka"] } } },
  vymahac: { L: { b: [0, 3] }, R: { b: [0, 3] } },
  // Schválené novinky (karty-naradie-zvierata.html, karty-kolo2.html, karty-obcania.html).
  vidly: { L: { b: [1, 2] }, R: { b: [0, 3] } },
  lievik: { L: { b: [0, 3] }, R: { b: [0, 1] } },
  krokodil: { L: { b: [0, 3] }, R: { b: [0, 3] } },
  kapybara: { L: { b: [0, 3] }, R: { b: [0, 3] } },
  kon: { L: { b: [0, 3] }, R: { b: [1, 2] } },
  kohut: { L: { b: [1, 2] }, R: { b: [0, 3] } },
  degustatorka: { L: { b: [2, 3] }, R: { b: [0, 3] } },
  klebetnica: { L: { b: [2, 3] }, R: { b: [0, 3] } },
  dohadzovacka: { L: { b: [0, 1] }, R: { b: [0, 3] } },
  vandal: { L: { b: [0, 3] }, R: { b: [2, 3] } },
  stryko_z_ameriky: { L: { b: [0, 3] }, R: { b: [0, 3] } },
  opatrovatelka: { L: { b: [0, 3] }, R: { b: [2, 3] } },
  smetiarka: { L: { b: [0, 3] }, R: { b: [0, 3] } }, // predpoklad: sloty nikde nezapísané
};
const PRED_POZNAMKA: Readonly<Record<string, string>> = {
  dohadzovacka: "Pakt v okne 2–3 podľa 12.1 (Viera, Pakt na 2–3)",
  smetiarka: "sloty nikde nezapísané, predpoklad blok. 0 a 3",
};

// ---------------------------------------------------------------------------
// Pripnutia, ktoré návrh zachováva (sú tvrdé, kontroluje ich overenie nižšie).
interface Pripnutie {
  readonly nazov: string;
  readonly preco: string;
  readonly over: (po: Readonly<Record<string, Strana[]>>) => boolean;
}

// Kombá z plánu (časť 5), ktoré stoja na polohe: pravdepodobnosť, že sa spoj zapne.
// Karta „pri lokalite“ dáva ľavú stranu, karta „za ňou“ pravú (§6: vnútorná hrana je pravá).
interface Kombo {
  readonly nazov: string;
  readonly lava: string; // karta pri lokalite (jej ľavá strana)
  readonly lavaAkcia: string | null; // null = hocijaká akcia
  readonly prava: string; // karta za ňou (jej pravá strana)
  readonly pravaAkcia: string;
  readonly delenie: number; // Kulturista: 2 Dlhy → podiel aktívnych
  readonly plan: string;
}
const KOMBA: readonly Kombo[] = [
  { nazov: "WAU 1 · Kulturista za Silnou ženou (jeho Dlhy aktívne)", lava: "silna_nezavisla_zena", lavaAkcia: null, prava: "kulturista", pravaAkcia: "Dlh", delenie: 2, plan: "5.1" },
  { nazov: "WAU 2 · Dezinformátor: Petelica Hasiča na Odpore Praudovravca", lava: "praudovravec", lavaAkcia: "Odpor", prava: "hasic", pravaAkcia: "Petelica", delenie: 1, plan: "5.2, 10.1 pozn." },
  { nazov: "WAU 3 · Petelica Pušky na Posilnení Koňa", lava: "kon", lavaAkcia: "Posilnenie", prava: "puska", pravaAkcia: "Petelica", delenie: 1, plan: "5.3" },
  { nazov: "WAU 6 · Petelica Traktoristky na Veštici", lava: "traktoristka", lavaAkcia: "Petelica", prava: "vestica", pravaAkcia: "*", delenie: 1, plan: "5.6" },
  { nazov: "WAU 6 · Petelica Pušky na Veštici", lava: "vestica", lavaAkcia: null, prava: "puska", pravaAkcia: "Petelica", delenie: 1, plan: "5.6" },
  { nazov: "WAU 7 · Petelica Recidivistu na Praudovravcovi", lava: "praudovravec", lavaAkcia: null, prava: "recidivista", pravaAkcia: "Petelica", delenie: 1, plan: "5.7" },
];

// ---------------------------------------------------------------------------
// Výpočet

interface Strana {
  readonly akcie: Akcie;
  readonly okno: Okno;
  readonly rozlozenia: readonly (readonly (string | null)[])[];
  /** Očakávaný výskyt druhu na indexe 0–3. */
  readonly E: Readonly<Record<string, readonly number[]>>;
  readonly obsadenost: readonly number[];
  /** Ktoré akcie sa na indexe môžu objaviť (null = blokovaný). */
  readonly mozne: readonly (readonly string[] | null)[];
}

function strana(akcie: Akcie, okno: Okno): Strana {
  const def = { blocked: okno.b, actions: akcie, allowed: okno.a } as unknown as SideDef;
  const rozlozenia = sideLayouts(def) as unknown as (string | null)[][];
  const E: Record<string, number[]> = {};
  for (const a of Object.keys(akcie)) E[a] = [0, 0, 0, 0];
  const obsadenost = [0, 0, 0, 0];
  const mozne: (Set<string> | null)[] = [0, 1, 2, 3].map((i) => (okno.b.includes(i) ? null : new Set<string>()));
  for (const r of rozlozenia) {
    r.forEach((s, i) => {
      if (s === null) return;
      E[s]![i]! += 1 / rozlozenia.length;
      obsadenost[i]! += 1 / rozlozenia.length;
      mozne[i]?.add(s);
    });
  }
  return {
    akcie, okno, rozlozenia, E, obsadenost,
    mozne: mozne.map((m) => (m === null ? null : AKCIE_PORADIE.filter((a) => m.has(a)))),
  };
}

interface KartaVysledok {
  readonly karta: KartaPoRevizii;
  readonly L: Strana;
  readonly R: Strana;
  readonly varianty: number;
}

function vyhodnot(okna: (k: KartaPoRevizii) => OknaKarty): KartaVysledok[] {
  return KARTY.map((karta) => {
    const o = okna(karta);
    const L = strana(karta.lava, o.L);
    const R = strana(karta.prava, o.R);
    return { karta, L, R, varianty: L.rozlozenia.length * R.rozlozenia.length };
  });
}

// cards.json — dnešné okná (PRED pri kartách bez zmeny) a dnešná sada (DNES).
interface CardJsonSide { blocked: number[]; actions: Record<string, number>; allowed?: Record<string, string[]> }
interface CardJson { id: string; name: string; tags: string[]; left: CardJsonSide; right: CardJsonSide }
const CARDS: CardJson[] = (JSON.parse(readFileSync(join(KOREN, "packages/core/data/cards.json"), "utf8")) as { cards: CardJson[] }).cards;
const cardsById = new Map(CARDS.map((c) => [c.id, c]));
const oknoZJson = (s: CardJsonSide): Okno => ({
  b: s.blocked,
  ...(s.allowed ? { a: Object.fromEntries(Object.entries(s.allowed).map(([k, v]) => [Number(k), v])) } : {}),
});

const PO = vyhodnot((k) => {
  const o = OKNA_PO[k.id];
  if (!o) throw new Error(`Návrh nemá okná pre ${k.id}`);
  return o;
});
const PRED = vyhodnot((k) => {
  const o = OKNA_PRED_INAK[k.id];
  if (o) return o;
  const c = cardsById.get(k.id);
  if (!c) throw new Error(`PRED: chýbajú okná pre ${k.id}`);
  return { L: oknoZJson(c.left), R: oknoZJson(c.right) };
});
// DNES: hráčske karty dnešnej sady s dnešnými akciami (bez starešinov, lokalít a kliatob).
const DNES: KartaVysledok[] = CARDS
  .filter((c) => !c.tags.includes("Starešina") && !c.tags.includes("Lokalita") &&
    Object.keys(c.left.actions).length + Object.keys(c.right.actions).length > 0)
  .map((c) => {
    const karta: KartaPoRevizii = { id: c.id, nazov: c.name, druh: "Občan", kopie: 2, lava: c.left.actions, prava: c.right.actions, zdroj: "cards.json", vHre: true };
    const L = strana(c.left.actions, oknoZJson(c.left));
    const R = strana(c.right.actions, oknoZJson(c.right));
    return { karta, L, R, varianty: L.rozlozenia.length * R.rozlozenia.length };
  });

interface Suhrn {
  readonly kariet: number;
  /** druh → [ľavá 0–3, pravá 0–3] */
  readonly E: Record<string, [number[], number[]]>;
  readonly spolu: Record<string, number>;
  readonly obsadenost: [number[], number[]];
  readonly akciiStrana: [number, number];
}
function suhrn(v: readonly KartaVysledok[]): Suhrn {
  const E: Record<string, [number[], number[]]> = {};
  const spolu: Record<string, number> = {};
  const obsadenost: [number[], number[]] = [[0, 0, 0, 0], [0, 0, 0, 0]];
  const akciiStrana: [number, number] = [0, 0];
  for (const k of v) {
    ([k.L, k.R] as const).forEach((s, sd) => {
      for (const [a, vec] of Object.entries(s.E)) {
        const e = (E[a] ??= [[0, 0, 0, 0], [0, 0, 0, 0]]);
        vec.forEach((x, i) => { e[sd]![i]! += x; });
        spolu[a] = (spolu[a] ?? 0) + vec.reduce((p, q) => p + q, 0);
      }
      s.obsadenost.forEach((x, i) => { obsadenost[sd]![i]! += x; });
      akciiStrana[sd]! += Object.values(s.akcie).reduce((p, q) => p + q, 0);
    });
  }
  return { kariet: v.length, E, spolu, obsadenost, akciiStrana };
}

const PRAH_DRUH = 4;
const PODIEL_MIN = 0.15, PODIEL_MAX = 0.40, OBSADENOST_TOL = 0.20;

interface Porusenie { readonly podmienka: string; readonly text: string }

function kontrola(v: readonly KartaVysledok[], s: Suhrn): Porusenie[] {
  const p: Porusenie[] = [];
  for (const k of v) {
    if (k.varianty > 8) p.push({ podmienka: "1", text: `${k.karta.nazov}: ${k.varianty} variantov (> 8)` });
    if (k.varianty < 4) p.push({ podmienka: "2", text: `${k.karta.nazov}: ${k.varianty} variantov (< 4)` });
  }
  for (const a of AKCIE_PORADIE) {
    const T = s.spolu[a];
    if (T === undefined) continue;
    const e = s.E[a]!;
    if (T >= PRAH_DRUH - 1e-9) {
      for (let i = 0; i < 4; i++) {
        const podiel = (e[0][i]! + e[1][i]!) / T;
        if (podiel < PODIEL_MIN - 1e-9 || podiel > PODIEL_MAX + 1e-9) {
          p.push({ podmienka: "3a", text: `${SKRATKY[a]} na indexe ${i}: ${pct(podiel)} (mimo 15–40 %)` });
        }
      }
    } else {
      // vzácny druh: aspoň dve rôzne okná (množiny indexov) na rôznych kartách
      const okna = new Map<string, Set<string>>();
      for (const k of v) {
        ([k.L, k.R] as const).forEach((st, sd) => {
          const vec = st.E[a];
          if (!vec) return;
          const kluc = (sd ? "P" : "Ľ") + vec.map((x, i) => (x > 1e-9 ? i : "")).join("");
          (okna.get(kluc) ?? okna.set(kluc, new Set()).get(kluc)!).add(k.karta.id);
        });
      }
      const karty = new Set([...okna.values()].flatMap((x) => [...x]));
      if (okna.size < 2 || karty.size < 2) p.push({ podmienka: "3b", text: `${SKRATKY[a]}: len ${okna.size} okno na ${karty.size} kartách` });
    }
  }
  s.obsadenost.forEach((o, sd) => {
    const m = s.akciiStrana[sd]! / 4;
    o.forEach((x, i) => {
      const r = x / m - 1;
      if (Math.abs(r) > OBSADENOST_TOL + 1e-9) {
        p.push({ podmienka: "3c", text: `${sd ? "pravý" : "ľavý"} index ${i}: ${cislo(x)} akcie (priemer ${cislo(m)}, ${r > 0 ? "+" : ""}${pct(r)})` });
      }
    });
  });
  return p;
}

// Spoj náhodnej dvojice kariet: každá karta je natočená k sebe alebo k súperovi s rovnakou
// šancou; otočená karta vymení strany a obráti indexy (§6, PRAVIDLA.md:258–266).
const TUHE: Readonly<Record<string, number>> = { Rana: 1, Pecka: 2, Petelica: 3 };
function spoj(s: Suhrn): { akcie: number; tuhe: number } {
  const N = s.kariet;
  const vec = (sd: 0 | 1, f: (a: string) => number) => [0, 1, 2, 3].map((i) =>
    Object.entries(s.E).reduce((acc, [a, e]) => acc + f(a) * e[sd][i]!, 0) / N);
  const O = [vec(0, (a) => (a === "" ? 0 : 1)), vec(1, () => 1)] as const;
  const T = [vec(0, (a) => TUHE[a] ?? 0), vec(1, (a) => TUHE[a] ?? 0)] as const;
  const P = [vec(0, (a) => (a === "Pakt" ? 1 : 0)), vec(1, (a) => (a === "Pakt" ? 1 : 0))] as const;
  const efPrava = (x: readonly (readonly number[])[]) => [0, 1, 2, 3].map((i) => (x[1]![i]! + x[0]![3 - i]!) / 2);
  const efLava = (x: readonly (readonly number[])[]) => [0, 1, 2, 3].map((i) => (x[0]![i]! + x[1]![3 - i]!) / 2);
  const oR = efPrava(O), oL = efLava(O), tR = efPrava(T), tL = efLava(T), pR = efPrava(P), pL = efLava(P);
  let akcie = 0, tuhe = 0;
  for (let i = 0; i < 4; i++) {
    akcie += 2 * oR[i]! * oL[i]!;
    tuhe += tR[i]! * oL[i]! + tL[i]! * oR[i]! + pR[i]! * tL[i]! + pL[i]! * tR[i]!;
  }
  return { akcie, tuhe };
}

function komboP(v: readonly KartaVysledok[], k: Kombo): number {
  const m = new Map(v.map((x) => [x.karta.id, x]));
  const A = m.get(k.lava)!.L, B = m.get(k.prava)!.R;
  const a = k.lavaAkcia ? A.E[k.lavaAkcia]! : A.obsadenost;
  const b = k.pravaAkcia === "*" ? B.obsadenost : B.E[k.pravaAkcia]!;
  // Pravá akcia „*“ znamená: akcia ľavej karty nájde na pravej strane suseda hocijakého partnera.
  return [0, 1, 2, 3].reduce((acc, i) => acc + a[i]! * b[i]!, 0) / k.delenie;
}

const PRIPNUTIA: readonly { nazov: string; preco: string; over: (v: readonly KartaVysledok[]) => boolean }[] = [
  {
    nazov: "Kulturista: Petelica sama na ľavom slote 1",
    preco: "WAU 1 (plán 5.1, 11.2): tvar „Petelica sama na slote 1, Dlh ×2 vnútri“.",
    over: (v) => { const k = v.find((x) => x.karta.id === "kulturista")!; return k.L.rozlozenia.length === 1 && k.L.E["Petelica"]![1] === 1; },
  },
  {
    nazov: "Pakt: ľavá strana, okno 2–3 na troch nosičoch",
    preco: "12.1: Brigádnik slot 3, Živnostník okno 2–3 vedľa Dlhu (Dlh aj Pakt na 2–3), Dohadzovačka okno 2–3.",
    over: (v) => {
      const g = (id: string) => v.find((x) => x.karta.id === id)!.L;
      const b = g("brigadnik").E["Pakt"]!, z = g("zivnostnik"), d = g("dohadzovacka").E["Pakt"]!;
      const len23 = (e: readonly number[]) => e[0] === 0 && e[1] === 0 && e[2]! > 0 && e[3]! > 0;
      return b[3] === 1 && len23(z.E["Pakt"]!) && z.E["Dlh"]![0] === 0 && z.E["Dlh"]![1] === 0 && len23(d);
    },
  },
  {
    nazov: "Puška: Petelica na pravých slotoch 2–3",
    preco: "WAU 3 (5.3) a WAU 6 (5.6) počítajú s Petelicou Pušky na 2–3; návrh ju tam nechal a podľa nej postavil Koňa a Vešticu.",
    over: (v) => { const e = v.find((x) => x.karta.id === "puska")!.R.E["Petelica"]!; return e[2] === 0.5 && e[3] === 0.5; },
  },
  {
    nazov: "Praudovravec: ľavá strana plná na troch indexoch, Odpor môže stretnúť Petelicu Hasiča",
    preco: "WAU 2 a WAU 7 (5.2, 5.7, poznámka k 10.1: Dezinformátor s Hasičom tým vzniká).",
    over: (v) => KOMBA.filter((k) => k.lava === "praudovravec").every((k) => komboP(v, k) > 0),
  },
];

// ---------------------------------------------------------------------------
// Formátovanie

function cislo(x: number, d = 1): string { return x.toFixed(d).replace(".", ",").replace("-0,0", "0,0"); }
function pct(x: number): string { return `${Math.round(x * 100)} %`; }
function esc(s: string): string { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function akcieText(a: Akcie): string {
  return AKCIE_PORADIE.filter((x) => a[x]).map((x) => SKRATKY[x] + (a[x]! > 1 ? ` ×${a[x]}` : "")).join(", ");
}
function oknoJson(o: Okno) {
  return { blocked: [...o.b], ...(o.a ? { allowed: Object.fromEntries(Object.entries(o.a).map(([k, v]) => [k, [...v]])) } : {}) };
}
/** Štyri bunky strany: čo môže stáť na indexe 0–3. */
function bunky(s: Strana): string {
  return s.mozne.map((m, i) => {
    if (m === null) return `<span class="sl x" title="index ${i}: blokovaný">✕</span>`;
    const t = m.map((a) => SKRATKY[a]).join("/");
    const vzdy = s.obsadenost[i]! > 0.999;
    return `<span class="sl${vzdy ? " plny" : ""}" title="index ${i}${vzdy ? ": vždy plný" : ": môže byť prázdny"}">${esc(t || "·")}</span>`;
  }).join("");
}
function oknoText(o: Okno): string {
  const b = o.b.length ? `blok. ${o.b.join(", ")}` : "bez bloku";
  const a = o.a ? "; " + Object.entries(o.a).map(([k, v]) => `${k}: ${v.map((x) => SKRATKY[x]).join("/")}`).join(", ") : "";
  return b + a;
}

const S_DNES = suhrn(DNES), S_PRED = suhrn(PRED), S_PO = suhrn(PO);
const P_DNES = kontrola(DNES, S_DNES), P_PRED = kontrola(PRED, S_PRED), P_PO = kontrola(PO, S_PO);
const SP_DNES = spoj(S_DNES), SP_PRED = spoj(S_PRED), SP_PO = spoj(S_PO);
const PRIPNUTIA_OK = PRIPNUTIA.map((p) => ({ ...p, ok: p.over(PO) }));
const KOMBA_V = KOMBA.map((k) => ({ ...k, pred: komboP(PRED, k), po: komboP(PO, k) }));

function maticaHtml(s: Suhrn, nadpis: string): string {
  const riadky = AKCIE_PORADIE.filter((a) => s.spolu[a] !== undefined).map((a) => {
    const T = s.spolu[a]!, e = s.E[a]!;
    const bunk = [0, 1, 2, 3].map((i) => {
      const p = (e[0][i]! + e[1][i]!) / T;
      const zle = T >= PRAH_DRUH && (p < PODIEL_MIN - 1e-9 || p > PODIEL_MAX + 1e-9);
      return `<td${zle ? ' class="zle"' : ""} title="ľavá ${cislo(e[0][i]!)} · pravá ${cislo(e[1][i]!)}">${pct(p)}</td>`;
    }).join("");
    return `<tr><td>${SKRATKY[a]}${T < PRAH_DRUH ? ' <span class="pozn">(vzácna)</span>' : ""}</td><td>${cislo(T, 0)}</td>${bunk}</tr>`;
  }).join("\n");
  return `<h3>${nadpis}</h3>
<table><tr><th>Akcia</th><th>spolu</th><th>i0</th><th>i1</th><th>i2</th><th>i3</th></tr>
${riadky}
</table>`;
}
function obsadenostRiadky(s: Suhrn, nazov: string): string {
  return ([0, 1] as const).map((sd) => {
    const m = s.akciiStrana[sd] / 4;
    const b = s.obsadenost[sd].map((x) => {
      const r = x / m - 1;
      return `<td${Math.abs(r) > OBSADENOST_TOL + 1e-9 ? ' class="zle"' : ""}>${cislo(x)} <span class="pozn">${r >= 0 ? "+" : "−"}${Math.abs(Math.round(r * 100))} %</span></td>`;
    }).join("");
    return `<tr><td>${nazov} · ${sd ? "pravá" : "ľavá"}</td>${b}<td>${cislo(m)}</td></tr>`;
  }).join("\n");
}
function extremy(s: Suhrn): { text: string; hodnota: number } {
  let najviac = { text: "", hodnota: 0 }, najmenej = { text: "", hodnota: 1 };
  for (const a of AKCIE_PORADIE) {
    const T = s.spolu[a];
    if (T === undefined || T < PRAH_DRUH) continue;
    for (let i = 0; i < 4; i++) {
      const p = (s.E[a]![0][i]! + s.E[a]![1][i]!) / T;
      if (p > najviac.hodnota) najviac = { text: `${SKRATKY[a]} na i${i} ${pct(p)}`, hodnota: p };
      if (p < najmenej.hodnota) najmenej = { text: `${SKRATKY[a]} na i${i} ${pct(p)}`, hodnota: p };
    }
  }
  return { text: `najviac ${najviac.text}, najmenej ${najmenej.text}`, hodnota: najviac.hodnota };
}

const DRUH_PORADIE = ["Nástroj", "Zviera", "Občan", "Štart"] as const;
const DRUH_NAZOV: Record<string, string> = { Nástroj: "Nástroje", Zviera: "Zvieratá", Občan: "Občania", Štart: "Štartové" };
const pripnuteKarty = new Set(["kulturista", "brigadnik", "zivnostnik", "dohadzovacka", "puska", "praudovravec", "hasic", "recidivista", "kon", "vestica", "traktoristka"]);

function kartyHtml(): string {
  const predMap = new Map(PRED.map((x) => [x.karta.id, x]));
  return DRUH_PORADIE.map((druh) => {
    const riadky = PO.filter((x) => x.karta.druh === druh).map((x) => {
      const p = predMap.get(x.karta.id)!;
      const pin = pripnuteKarty.has(x.karta.id) ? ' <span class="pin" title="zachované pripnutie alebo kombo">●</span>' : "";
      const allowed = x.L.okno.a || x.R.okno.a ? ' <span class="pozn">(allowed)</span>' : "";
      return `<tr><td><b>${esc(x.karta.nazov)}</b>${pin}<br><span class="pozn">${esc(akcieText(x.karta.lava))} / ${esc(akcieText(x.karta.prava))}</span></td>
<td class="okno"><div class="str">${bunky(x.L)}</div><div class="pozn">${esc(oknoText(x.L.okno))} · ${x.L.rozlozenia.length}</div></td>
<td class="okno"><div class="str">${bunky(x.R)}</div><div class="pozn">${esc(oknoText(x.R.okno))} · ${x.R.rozlozenia.length}</div></td>
<td><span class="${p.varianty > 8 || p.varianty < 4 ? "zle" : ""}">${p.varianty}</span> → <b>${x.varianty}</b>${allowed}</td></tr>`;
    }).join("\n");
    return `<h3>${DRUH_NAZOV[druh]}</h3>
<table class="karty"><tr><th>Karta · akcie ľ / p</th><th>Ľavá i0–i3</th><th>Pravá i0–i3</th><th>Var. pred → po</th></tr>
${riadky}
</table>`;
  }).join("\n");
}

// ---------------------------------------------------------------------------
// Výstupy

const pocty = (v: readonly KartaVysledok[]) => ({
  nad8: v.filter((x) => x.varianty > 8).map((x) => `${x.karta.nazov} ${x.varianty}`),
  pod4: v.filter((x) => x.varianty < 4).map((x) => `${x.karta.nazov} ${x.varianty}`),
  sAllowed: v.filter((x) => x.L.okno.a || x.R.okno.a).length,
});
const C_DNES = pocty(DNES), C_PRED = pocty(PRED), C_PO = pocty(PO);
const EX_DNES = extremy(S_DNES), EX_PRED = extremy(S_PRED), EX_PO = extremy(S_PO);
const podielyPo = AKCIE_PORADIE.filter((a) => (S_PO.spolu[a] ?? 0) >= PRAH_DRUH)
  .flatMap((a) => [0, 1, 2, 3].map((i) => (S_PO.E[a]![0][i]! + S_PO.E[a]![1][i]!) / S_PO.spolu[a]!));
const PODIELY_PO = `${Math.round(Math.min(...podielyPo) * 100)}–${Math.round(Math.max(...podielyPo) * 100)} %`;
const OBS_PO = Math.ceil(Math.max(...([0, 1] as const).flatMap((sd) =>
  S_PO.obsadenost[sd].map((x) => Math.abs(x / (S_PO.akciiStrana[sd] / 4) - 1)))) * 100);
// Výsledok hľadania (skript/hladaj.ts, PERSIDE=1 TUHEW=200): rovnaké podmienky aj po stranách,
// obsadenosť so sklonom do stredu na hranici ±20 %. Nie je zafixovaný návrh, len odhad možností.
const TUHE_STRED = 0.546;

const json = {
  zdroj: "Vymyselník 2026-10-27 — návrh slotov hráčskych kariet po revízii (skript/sloty.ts). Bez simulácie: očakávané výskyty cez rozloženia sideLayouts (variants.ts), rovnomerný los (engine.ts:679). Počty na 1 kópiu sady (každá karta 1×; v hre 2×, pomery rovnaké).",
  podmienky: {
    "1": "Žiadna hráčska karta okrem kliatby nebude mať viac ako 8 variantov (Michal).",
    "2": "Okrem starešinov každá karta má minimálne 4 varianty (Michal).",
    "3": "Rozloženie akcií (vrátane Paktu) približne rovnomerné, nie 80 % / 20 % a inde 0 (Michal). Prevod: druh s ≥ 4 výskytmi 15–40 % na každom indexe (obe strany spolu); vzácny druh ≥ 2 okná na rôznych kartách; obsadenosť indexu ±20 % od priemeru strany.",
  },
  vysledok: {
    po: { porusenia: P_PO, ...C_PO, extremy: EX_PO.text, spoj: SP_PO },
    pred: { porusenia: P_PRED.length, ...C_PRED, extremy: EX_PRED.text, spoj: SP_PRED },
    dnes: { porusenia: P_DNES.length, ...C_DNES, extremy: EX_DNES.text, spoj: SP_DNES, kariet: DNES.length },
  },
  pripnutia: PRIPNUTIA_OK.map((p) => ({ nazov: p.nazov, preco: p.preco, ok: p.ok })),
  komba: KOMBA_V.map((k) => ({ nazov: k.nazov, plan: k.plan, pred: +k.pred.toFixed(3), po: +k.po.toFixed(3) })),
  karty: PO.map((x) => {
    const p = PRED.find((y) => y.karta.id === x.karta.id)!;
    return {
      id: x.karta.id, nazov: x.karta.nazov, druh: x.karta.druh, kopie: x.karta.kopie, zdroj_akcii: x.karta.zdroj,
      variantov: x.varianty,
      lava: { akcie: x.karta.lava, ...oknoJson(x.L.okno), rozlozeni: x.L.rozlozenia.length },
      prava: { akcie: x.karta.prava, ...oknoJson(x.R.okno), rozlozeni: x.R.rozlozenia.length },
      pred: { variantov: p.varianty, lava: oknoJson(p.L.okno), prava: oknoJson(p.R.okno), ...(PRED_POZNAMKA[x.karta.id] ? { poznamka: PRED_POZNAMKA[x.karta.id] } : {}) },
    };
  }),
  matice: Object.fromEntries((["dnes", "pred", "po"] as const).map((n) => {
    const s = { dnes: S_DNES, pred: S_PRED, po: S_PO }[n];
    return [n, {
      kariet: s.kariet,
      obsadenost: { lava: s.obsadenost[0].map((x) => +x.toFixed(3)), prava: s.obsadenost[1].map((x) => +x.toFixed(3)), akcii: s.akciiStrana },
      druhy: Object.fromEntries(AKCIE_PORADIE.filter((a) => s.spolu[a] !== undefined).map((a) => [a, {
        spolu: +s.spolu[a]!.toFixed(3),
        lava: s.E[a]![0].map((x) => +x.toFixed(3)), prava: s.E[a]![1].map((x) => +x.toFixed(3)),
      }])),
    }];
  })),
};
writeFileSync(join(TU, "..", "sloty.json"), JSON.stringify(json, null, 1) + "\n");

const vsetkoOk = P_PO.length === 0 && PRIPNUTIA_OK.every((p) => p.ok);
const html = `<!doctype html>
<html lang="sk">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Návrh slotov: vyrovnané indexy</title>
<style>
:root{
  --pozadie:#f5f1e8; --papier:#fffdf7; --text:#2b2520; --tlmene:#6b6155;
  --linka:#d8cfbf; --akcent:#8a4b2d; --zle:#a33b3b; --dobre:#3d7a3d; --variant:#9a7b22;
}
@media (prefers-color-scheme: dark){
  :root:not([data-theme="light"]){
    --pozadie:#1d1a16; --papier:#262219; --text:#e8e0d2; --tlmene:#a89c8a;
    --linka:#3d372d; --akcent:#d08a5e; --zle:#d97b7b; --dobre:#7dbb7d; --variant:#d3b45a;
  }
}
:root[data-theme="dark"]{
  --pozadie:#1d1a16; --papier:#262219; --text:#e8e0d2; --tlmene:#a89c8a;
  --linka:#3d372d; --akcent:#d08a5e; --zle:#d97b7b; --dobre:#7dbb7d; --variant:#d3b45a;
}
*{box-sizing:border-box}
body{margin:0;background:var(--pozadie);color:var(--text);font:16px/1.5 Georgia,'Times New Roman',serif;padding:16px}
main{max-width:980px;margin:0 auto}
h1{font-size:1.7em;margin:.2em 0 .1em;color:var(--akcent)}
.pod{color:var(--tlmene);margin:0 0 1em}
section{background:var(--papier);border:1px solid var(--linka);border-radius:10px;padding:12px 16px;margin:14px 0}
h2{font-size:1.15em;margin:.1em 0 .4em;color:var(--akcent)}
h3{font-size:1em;margin:1em 0 .3em}
table{border-collapse:collapse;width:100%;font-size:.9em}
td,th{border-bottom:1px solid var(--linka);padding:4px 8px;text-align:right;vertical-align:top}
td:first-child,th:first-child{text-align:left}
th{color:var(--tlmene);font-weight:normal}
.zle{color:var(--zle);font-weight:bold}
.dobre{color:var(--dobre);font-weight:bold}
.pozn{color:var(--tlmene);font-size:.85em}
ul,ol{margin:.3em 0 .5em;padding-left:1.3em}
li{margin:.3em 0}
code{font-family:Consolas,monospace;font-size:.88em;background:var(--pozadie);padding:1px 5px;border-radius:4px}
table.karty td{text-align:left}
td.okno{min-width:11em}
.str{display:flex;gap:2px}
.sl{flex:1;min-width:0;border:1px solid var(--linka);border-radius:4px;padding:1px 2px;font-size:.72em;text-align:center;overflow-wrap:anywhere;line-height:1.25}
.sl.plny{border-color:var(--akcent)}
.sl.x{color:var(--tlmene);background:var(--pozadie)}
.pin{color:var(--variant)}
.dve{display:grid;grid-template-columns:1fr 1fr;gap:12px}
@media (max-width:640px){ td,th{padding:3px 4px} body{padding:10px} .dve{grid-template-columns:1fr} td.okno{min-width:8em} }
</style>
</head>
<body>
<main>
<h1>Návrh slotov: vyrovnané indexy</h1>
<p class="pod">Vymyselník · 27. 10. 2026 · ${PO.length} hráčskych kariet po revízii (${PO.filter((x) => x.karta.druh === "Nástroj").length} Nástrojov, ${PO.filter((x) => x.karta.druh === "Zviera").length} Zvierat, ${PO.filter((x) => x.karta.druh === "Občan").length} Občanov, ${PO.filter((x) => x.karta.druh === "Štart").length} štartové) · mimo rozsahu: starešinovia, kliatby, lokality · nič som nesimuloval, čísla sú výpočet z rozložení (<code>sideLayouts</code>, rovnomerný los <code>engine.ts:679</code>), na 1 kópiu sady</p>

<section>
<h2>V skratke</h2>
<ul>
<li><b class="${vsetkoOk ? "dobre" : "zle"}">Podmienky 1–3 ${vsetkoOk ? "prešli" : "NEPREŠLI"}.</b> Všetky karty majú ${Math.min(...PO.map((x) => x.varianty))}–${Math.max(...PO.map((x) => x.varianty))} variantov (pred: ${C_PRED.nad8.length} kariet nad 8, ${C_PRED.pod4.length} pod 4). Každý druh s aspoň 4 výskytmi má na každom indexe ${PODIELY_PO} výskytov (cieľ 15–40 %). Obsadenosť indexov je v pásme ±${OBS_PO} % od priemeru strany (cieľ ±20 %).</li>
<li><b>Najväčší zostávajúci extrém:</b> ${esc(EX_PO.text)}. Pred preusporiadaním: ${esc(EX_PRED.text)}.</li>
<li><b>Pakt</b> (3 výskyty na kópiu sady, vzácny druh) ostáva zámerne len na ľavých indexoch 2–3 (12.1). Má dve rôzne okná na rôznych kartách: slot 3 (Brigádnik) a okno 2–3 (Živnostník, Dohadzovačka).</li>
<li><b>Pripnutia a kombá:</b> Kulturista (Petelica sama na ľavom slote 1) a Pakt ostali. Kombá z plánu, ktoré stoja na polohe, sa zapínajú rovnako často alebo častejšie, okrem WAU 1. Tam to inak nejde, pozri „Čo sa nepodarilo“.</li>
<li><b>Allowed</b> má ${C_PO.sAllowed} z ${PO.length} kariet, pred preusporiadaním ${C_PRED.sAllowed}. Ostal len tam, kde spojka so 6–7 akciami inak nevojde do 8 variantov, alebo kde drží pripnutie.</li>
<li><b>Vedľajší účinok (dôležité):</b> keď sú indexy obsadené rovnomerne, akcia nájde partnera menej často, lebo ubudlo „plného stredu“. Aktívne tuhé na náhodný spoj klesne z ${cislo(SP_PRED.tuhe, 3)} na ${cislo(SP_PO.tuhe, 3)} (${SP_PO.tuhe >= SP_PRED.tuhe ? "+" : "−"}${Math.abs(Math.round((SP_PO.tuhe / SP_PRED.tuhe - 1) * 100))} %) a aktívne akcie z ${cislo(SP_PRED.akcie, 3)} na ${cislo(SP_PO.akcie, 3)} (${SP_PO.akcie >= SP_PRED.akcie ? "+" : "−"}${Math.abs(Math.round((SP_PO.akcie / SP_PRED.akcie - 1) * 100))} %). Bez simulácie, model nižšie.</li>
</ul>
<p><b>Odporúčanie:</b> prijať okná z tabuľky kariet. Úbytok aktívneho tuhého (časť 5) treba vedome vyrovnať, napríklad ďalšou Peckou alebo Petelicou na nových kartách (deficit z 10.5 trvá), a zmerať ho v ďalšom turnaji alebo playteste, keď ich Michal povolí.</p>
</section>

<section>
<h2>1 · Podmienky Michala a ich prevod na čísla</h2>
<ol>
<li>„Žiadna hráčska karta okrem kliatby nebude mať viac ako 8 variant.“ → ľavé × pravé rozloženia ≤ 8.</li>
<li>„Okrem starešin každá karta má minimálne 4 varianty.“ → ľavé × pravé ≥ 4.</li>
<li>„Po preorganizovaní akcií (vrátane paktu) bude rozloženie akcií približne rovnomerné. Nemusí to byť presne, ale nesmie to byť, že 80 %, 20 % a inde 0.“ → (a) druh s aspoň 4 očakávanými výskytmi: na každom indexe 15–40 % výskytov druhu (obe strany spolu); (b) vzácnejší druh: aspoň dve rôzne okná na rôznych kartách; (c) obsadenosť každého indexu, ľavá aj pravá strana zvlášť, v pásme ±20 % od priemeru strany.</li>
</ol>
<table>
<tr><th>Sada</th><th>kariet</th><th>&gt; 8 var.</th><th>&lt; 4 var.</th><th>porušení 3a–3c</th><th>s allowed</th></tr>
<tr><td>Dnes (cards.json, dnešné akcie)</td><td>${DNES.length}</td><td>${C_DNES.nad8.length}</td><td>${C_DNES.pod4.length}</td><td>${P_DNES.filter((p) => p.podmienka.startsWith("3")).length}</td><td>${C_DNES.sAllowed}</td></tr>
<tr><td>Pred (akcie po revízii, okná bez zmeny)</td><td>${PRED.length}</td><td class="${C_PRED.nad8.length ? "zle" : ""}">${C_PRED.nad8.length}</td><td class="${C_PRED.pod4.length ? "zle" : ""}">${C_PRED.pod4.length}</td><td class="${P_PRED.some((p) => p.podmienka.startsWith("3")) ? "zle" : ""}">${P_PRED.filter((p) => p.podmienka.startsWith("3")).length}</td><td>${C_PRED.sAllowed}</td></tr>
<tr><td><b>Po (návrh)</b></td><td>${PO.length}</td><td class="dobre">${C_PO.nad8.length}</td><td class="dobre">${C_PO.pod4.length}</td><td class="${P_PO.length ? "zle" : "dobre"}">${P_PO.filter((p) => p.podmienka.startsWith("3")).length}</td><td>${C_PO.sAllowed}</td></tr>
</table>
<p class="pozn">Pred: nad 8 ${esc(C_PRED.nad8.join(", ") || "—")}; pod 4 ${esc(C_PRED.pod4.join(", ") || "—")}. Okná „pred“ sú z <code>cards.json</code>, z <code>plan.json</code> (10.1), zo slotov schválených noviniek (<code>karty-naradie-zvierata.html</code>, <code>karty-kolo2.html</code>, <code>karty-obcania.html</code>) a z 12.1 pre Pakt. Smetiarka nemá sloty nikde zapísané, rátam s blok. 0 a 3.</p>
</section>

<section>
<h2>2 · Obsadenosť indexov (očakávaný počet akcií na kópiu sady)</h2>
<table>
<tr><th>Sada · strana</th><th>i0</th><th>i1</th><th>i2</th><th>i3</th><th>priemer</th></tr>
${obsadenostRiadky(S_DNES, "Dnes")}
${obsadenostRiadky(S_PRED, "Pred")}
${obsadenostRiadky(S_PO, "<b>Po</b>")}
</table>
<p class="pozn">Percento = odchýlka od priemeru strany; červené je mimo ±20 %. „Dnes“ je ${DNES.length} hráčskych kariet dnešnej sady s dnešnými akciami. Analýza z rána rátala len 29 Občanov a Zvierat, preto sa čísla líšia.</p>
</section>

<section>
<h2>3 · Akcia × index (obe strany spolu, podiel indexu na výskytoch druhu, ideál 25 %)</h2>
<div class="dve">
<div>${maticaHtml(S_PRED, "Pred (akcie po revízii, okná bez zmeny)")}</div>
<div>${maticaHtml(S_PO, "Po (návrh)")}</div>
</div>
<p class="pozn">Červené je mimo 15–40 % pri druhu s aspoň 4 výskytmi. Po podržaní prsta alebo myši nad bunkou uvidíš rozpis na ľavú a pravú stranu. Pri otočení karty k súperovi sa indexy obrátia (§6, <code>PRAVIDLA.md:258–266</code>), preto som vyrovnával aj každú stranu zvlášť (pozri <code>sloty.json</code>, <code>matice</code>).</p>
</section>

<section>
<h2>4 · Karty: okná a varianty</h2>
<p class="pozn">Štyri políčka strany = indexy 0–3 zhora. V políčku je, čo naň môže padnúť: ✕ blokovaný, hrubší okraj = vždy plný. Pod tým okno v tvare <code>cards.json</code> (blok. = <code>blocked</code>; „2: Pečeň“ = <code>allowed</code>, na index 2 smie len Pečeň) a počet rozložení strany. ● = zachované pripnutie alebo kombo.</p>
${kartyHtml()}
</section>

<section>
<h2>5 · Zachované pripnutia a kombá</h2>
<ul>
${PRIPNUTIA_OK.map((p) => `<li><b class="${p.ok ? "dobre" : "zle"}">${p.ok ? "✓" : "✗"}</b> <b>${esc(p.nazov)}</b> — ${esc(p.preco)}</li>`).join("\n")}
</ul>
<table>
<tr><th>Kombo (plán, časť)</th><th>pred</th><th>po</th></tr>
${KOMBA_V.map((k) => `<tr><td>${esc(k.nazov)} <span class="pozn">(${k.plan})</span></td><td>${pct(k.pred)}</td><td class="${k.po + 1e-9 < k.pred ? "zle" : "dobre"}">${pct(k.po)}</td></tr>`).join("\n")}
</table>
<p class="pozn">Šanca, že sa spoj v kombe zapne, keď kartu priložíš za tú pri lokalite (jej pravá strana k ľavej strane predošlej, §6). Pri WAU 1 je to podiel Kulturistových Dlhov, ktoré nájdu partnera na Silnej žene.</p>
<p><b>Ďalšie polohy z plánu, ktoré som nepovažoval za mechanické:</b> úderníci „v strede (sloty 1–2)“ (časť 2, archetyp U a 1.2) a Svokra „Dlh a Pecka na slotoch 2–3“ (D3). Oboje opisuje okná z tlače, nie efekt. Michalova podmienka 3 ich prekonáva: stred bol preplnený práve preto. Zásada 6.1 (cena na tej istej strane ako útok) ostáva, akcie sa medzi stranami nepresúvali.</p>
</section>

<section>
<h2>6 · Čo sa nepodarilo a prečo</h2>
<ul>
<li><b>WAU 1 (Kulturista za Silnou ženou):</b> pred ${pct(KOMBA_V[0]!.pred)}, po ${pct(KOMBA_V[0]!.po)}. Pred to stálo na Kulturistovi s 1 variantom, čo porušuje podmienku 2. Kulturistova ľavá strana je pripnutá na 1 rozloženie, takže pravá (Dlh ×2) musí mať aspoň 4. Dva Dlhy na 3 voľných slotoch dajú len 3 rozloženia, preto pravá strana musí byť celá voľná (6 rozložení) a každý Dlh je na náhodnom indexe. Silná žena má vľavo len 2 akcie, takže zachytí v priemere polovicu. Viac sa nedá bez porušenia podmienky 2 alebo pripnutia. Tvar komba (Petelica sama na slote 1) ostal, mení sa len, koľko jeho Dlhov sa so Silnou ženou spáruje.</li>
<li><b>Pakt na indexoch 0–1:</b> 0 % zámerne. Pripnutie z 12.1 (ľavé okno 2–3) má prednosť. Pakt má 3 výskyty, je teda vzácny druh a podmienku 3b spĺňa.</li>
<li><b>Ľavá strana Petelice a Posilnenia:</b> na ľavej strane sú len 2 kusy každého, takže strana sama rovnomerná byť nemôže. Spolu s pravou stranou sú presne na 25 %.</li>
<li><b>Strany s jedným rozložením:</b> ${PO.flatMap((x) => [[x, "ľavá", x.L] as const, [x, "pravá", x.R] as const]).filter(([, , s]) => s.rozlozenia.length === 1 && Object.values(s.akcie).reduce((a, b) => a + b, 0) < 4).map(([x, n]) => `${esc(x.karta.nazov)} (${n})`).join(", ")}. Karta má aj tak 4–6 variantov. Pevná strana pomáha stlačiť počet pod 8 a dorovnať okrajové indexy.</li>
<li><b>Menej aktívnych spojov:</b> rovnomernosť (podmienka 3c) znižuje, ako často sa stretnú dve akcie (pozri 7). Rovnomerný návrh to neobchádza. Čiastočne to vráti sklon do stredu v rámci tolerancie (otázka 1), celé len viac tuhých akcií.</li>
</ul>
</section>

<section>
<h2>7 · Model spoja (výpočet, nie simulácia)</h2>
<table>
<tr><th>Sada</th><th>aktívne akcie na spoj</th><th>aktívne tuhé na spoj</th></tr>
<tr><td>Dnes</td><td>${cislo(SP_DNES.akcie, 3)}</td><td>${cislo(SP_DNES.tuhe, 3)}</td></tr>
<tr><td>Pred</td><td>${cislo(SP_PRED.akcie, 3)}</td><td>${cislo(SP_PRED.tuhe, 3)}</td></tr>
<tr><td><b>Po</b></td><td>${cislo(SP_PO.akcie, 3)}</td><td>${cislo(SP_PO.tuhe, 3)}</td></tr>
</table>
<p class="pozn">Dve náhodné hráčske karty, náhodné rozloženie, každá s polovičnou šancou otočená k súperovi (strany sa vymenia, indexy obrátia). Tuhé: Rana 1, Pecka 2, Petelica 3; Pakt má hodnotu partnera. Lokality a výber hráča (ktorú kartu kam priloží) model nezarátava, preto nejde o rovnaké číslo ako v 1.2 plánu. Porovnávať treba len riadky medzi sebou.</p>
</section>

<section>
<h2>8 · Dopad na pravidlá a kód</h2>
<ul>
<li><b>Pravidlá:</b> žiadny. Mení sa len <code>blocked</code> a <code>allowed</code> v dátach kariet.</li>
<li><b>Dáta:</b> okná sa zadajú v tvorcovi pri zavádzaní revízie (v7) a zverejnia s novou sadou. <code>cards.json</code> sa potom skopíruje zo živého webu (CLAUDE.md, pravidlo 5). Strojovo sú v <code>docs/napady/revizia-sady/sloty.json</code> (<code>karty[].lava/prava</code>, tvar <code>cards.json</code>).</li>
<li><b>Tlač:</b> každé rozloženie je samostatná tlačená karta (<code>variants.ts</code>). Pri 4–8 variantoch je to 4–8 obrázkov rozložení na kartu namiesto 1–16.</li>
<li><b>Kód:</b> netreba. Pakt potrebuje symbol v tvorcovi (12.3), to platí aj bez tohto návrhu.</li>
<li><b>Overenie:</b> <code>node --experimental-strip-types --no-warnings docs/napady/revizia-sady/skript/sloty.ts</code> prepočíta tento dokument aj JSON a pri porušení skončí chybou. Okná našiel <code>skript/hladaj.ts</code> (asi 3 minúty, s predvolenými parametrami vráti presne tento návrh).</li>
</ul>
</section>

<section>
<h2>9 · Otázky pre Michala</h2>
<ol>
<li><b>Úbytok aktívneho tuhého</b> o ${Math.abs(Math.round((SP_PO.tuhe / SP_PRED.tuhe - 1) * 100))} % (model 7): (a) prijať a vyrovnať ďalšími Peckami alebo Petelicami na nových kartách, (b) využiť toleranciu ±20 % na mierny sklon do stredu (indexy 1–2 plnšie, Pecky a Rany tam): hľadanie našlo okná, ktoré spĺňajú podmienky aj po stranách a dajú ${cislo(TUHE_STRED, 3)} (úbytok len ${Math.abs(Math.round((TUHE_STRED / SP_PRED.tuhe - 1) * 100))} %), ale stred je zase plnší, alebo (c) prijať, kým to nezmeria turnaj? Odporúčam (a). Rovnomerné okná nezávisia od toho, ako často sa karty pri spoji otáčajú.</li>
<li><b>Prevod podmienky 3</b> (15–40 % na index, ±20 % obsadenosť) sedí, alebo chceš prísnejšie čísla? Návrh drží ${PODIELY_PO} a ±${OBS_PO} %, takže rezervu má.</li>
<li><b>Pripnutia:</b> stačí zachovať Kulturistu, Pakt a kombá (časť 5), alebo chceš držať aj pôvodné tlačové okná niektorých kariet (napríklad Svokra „Dlh a Pecka na 2–3“)?</li>
</ol>
</section>

<p class="pozn">Zdroj: <code>docs/napady/revizia-sady/skript/sloty.ts</code>, <code>hladaj.ts</code> a <code>karty.ts</code> (akcie po revízii: <code>cards.json</code>, plán 3 a 10.1, 4, 12.1, Dávka 3), <code>packages/core/src/variants.ts</code>, <code>engine.ts:679</code>, <code>PRAVIDLA.md:247–266</code>.</p>
</main>
</body>
</html>
`;
writeFileSync(join(KOREN, "docs", "napady", "navrh-sloty.html"), html);

// Súhrn do konzoly
console.log(`PO: ${PO.length} kariet, varianty ${Math.min(...PO.map((x) => x.varianty))}–${Math.max(...PO.map((x) => x.varianty))}, porušení ${P_PO.length}, allowed na ${C_PO.sAllowed} kartách`);
for (const p of P_PO) console.log(`  [${p.podmienka}] ${p.text}`);
console.log(`PRED: porušení ${P_PRED.length} (nad 8: ${C_PRED.nad8.join(", ") || "—"}; pod 4: ${C_PRED.pod4.join(", ") || "—"})`);
for (const p of P_PRED.filter((x) => x.podmienka.startsWith("3"))) console.log(`  [${p.podmienka}] ${p.text}`);
console.log(`DNES: porušení ${P_DNES.length}`);
console.log(`Extrém PO: ${EX_PO.text}; PRED: ${EX_PRED.text}`);
for (const p of PRIPNUTIA_OK) console.log(`Pripnutie ${p.ok ? "OK" : "PORUŠENÉ"}: ${p.nazov}`);
for (const k of KOMBA_V) console.log(`Kombo ${k.nazov}: pred ${pct(k.pred)}, po ${pct(k.po)}`);
console.log(`Spoj (akcie / tuhé): dnes ${cislo(SP_DNES.akcie, 3)} / ${cislo(SP_DNES.tuhe, 3)}, pred ${cislo(SP_PRED.akcie, 3)} / ${cislo(SP_PRED.tuhe, 3)}, po ${cislo(SP_PO.akcie, 3)} / ${cislo(SP_PO.tuhe, 3)}`);
if (!vsetkoOk) process.exit(1);

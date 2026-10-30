// Jednotný bar nad stolom (Michal 2026-10-25, mock V2 „Os dole, správa pod verdiktom“):
// nahradil os kola, pás fázy aj riadok bitky. Hore strana | odhad bitky + stavová
// správa | strana, dole os kola. Strany ukazujú buď aktivované akcie, alebo karty
// na vyloženie; každá informácia je v bare len raz.

import type { Phase } from "@naex/core";

export type RezimStran = "akcie" | "karty";

/**
 * Režim strán, kým hráč neklikne (Michal 2026-10-25): v Zhromaždení sa rozhoduje, koľko
 * kariet ešte vyložiť, v Pitke a bitke rozhodujú akcie. Voľba cieľa a draft línie nemajú.
 */
export function predvolenyRezim(faza: Phase): RezimStran {
  return faza === "pitka" || faza === "bitka" ? "akcie" : "karty";
}

/** Ručné prepnutie platí do konca fázy — každé Zhromaždenie a Pitka sú fázou zvlášť. */
export function klucFazy(kolo: number, faza: Phase, pitkaCislo: number): string {
  return `${kolo}:${faza}:${faza === "zhromazdenie" || faza === "pitka" ? pitkaCislo : 0}`;
}

export type DruhSpravy = "chyba" | "ucet" | "super";

export interface SpravaBaru {
  readonly druh: DruhSpravy;
  readonly text: string;
}

/**
 * Stavová správa má v bare jedno miesto, takže naraz len jedna: chyba ťahu má prednosť
 * (hráč musí vedieť, prečo ťah neprešiel), potom účet Pitky, potom čo urobil súper.
 */
export function vyberSpravu(chyba: string | null, ucetPitky: string | null, superov: string | null): SpravaBaru | null {
  if (chyba !== null) return { druh: "chyba", text: chyba };
  if (ucetPitky !== null) return { druh: "ucet", text: ucetPitky };
  if (superov !== null) return { druh: "super", text: superov };
  return null;
}

// ---- Majster Melichar v bare (Michal 2026-10-25, mock „Melichar v bare“) ----------------

/**
 * Kde Melichar v bare hovorí: zvyčajne obsadí celý bar. Keď ukazuje na os kola či
 * Šenok · Lokality · Log, os ostane pod ním viditeľná; keď na odhad bitky, odhad je
 * priamo v jeho bubline (inak by ukazoval na niečo, čo sám zakrýva).
 */
export type RezimMelichara = "cely" | "hore" | "odhad";

export function rezimMelichara(kluce: readonly string[]): RezimMelichara {
  if (kluce.some((k) => k === "hrozba" || k === "bitka-ucet" || k === "odhad")) return "odhad";
  if (kluce.some((k) => k === "os-kola" || k.startsWith("hlavicka:"))) return "hore";
  return "cely";
}

export type CastVety = { readonly text: string } | { readonly akcia: string };

/** Tvary podstatného mena vo všetkých pádoch oboch čísel (zhodné tvary len raz). */
const tvary = (...t: readonly string[]): readonly string[] => [...new Set(t)];
const podlaZena = (k: string, gPl: string, sgG = `${k}y`, sgD = `${k}e`): readonly string[] =>
  tvary(`${k}a`, sgG, sgD, `${k}u`, `${k}ou`, gPl, `${k}ám`, `${k}ami`, `${k}ách`);
const podlaVysvedcenie = (k: string): readonly string[] =>
  tvary(`${k}ie`, `${k}ia`, `${k}iu`, `${k}ím`, `${k}í`, `${k}iam`, `${k}iami`, `${k}iach`);

/**
 * Slová, pri ktorých Melichar ukáže piktogram akcie aj bez značky (Michal 2026-10-25: „Keď
 * Melichar hovorí o akcii, treba ukázať piktogram“). Vymenované tvary, nie voľný kmeň — inak
 * by ikonu dostalo aj „ráno“ či „dlho“. Začiatočné písmeno smie byť veľké aj malé.
 */
export const TVARY_AKCII: Readonly<Record<string, readonly string[]>> = {
  Viera: tvary(...podlaZena("Vier", "Vier"), "Vieram", "Vierach"),
  Rana: podlaZena("Ran", "Rán"),
  Pecka: podlaZena("Peck", "Peciek"),
  Petelica: tvary(...podlaZena("Petelic", "Petelíc", "Petelice", "Petelici"), "Peteliciam", "Peteliciach"),
  Povera: podlaZena("Pover", "Pover"),
  Cigareta: podlaZena("Cigaret", "Cigariet"),
  Robota: podlaZena("Robot", "Robôt"),
  Vízia: tvary("Vízia", "Vízie", "Vízii", "Víziu", "Víziou", "Vízií", "Víziám", "Víziami", "Víziách"),
  Pohoršenie: podlaVysvedcenie("Pohoršen"),
  Obmedzenie: podlaVysvedcenie("Obmedzen"),
  Posilnenie: podlaVysvedcenie("Posilnen"),
  PoškodeniePečene: podlaVysvedcenie("Poškoden").map((t) => `${t} pečene`),
  // Akcia s kľúčom Dlh sa od v8.2 volá Hazard; Dlh (počítadlo, ktoré dáva) má ten istý piktogram.
  Dlh: tvary("Hazard", "Hazardu", "Hazarde", "Hazardom", "Hazardy", "Hazardov", "Hazardmi", "Hazardoch", "Dlh", "Dlhu", "Dlhom", "Dlhy", "Dlhov", "Dlhmi", "Dlhoch"),
  Odpor: tvary("Odpor", "Odporu", "Odpore", "Odporom", "Odpory", "Odporov", "Odporoch"),
  Poldeci: tvary("Poldeci"),
};

const KLUC_TVARU = new Map(Object.entries(TVARY_AKCII).flatMap(([kluc, t]) => t.map((x) => [x.toLowerCase(), kluc] as const)));
const vzorTvaru = (t: string): string => {
  const [prve = "", ...zvysok] = [...t];
  return `[${prve.toUpperCase()}${prve.toLowerCase()}]${zvysok.join("").replace(/ /g, "\\s+")}`;
};
/** Dlhšie tvary skôr — „Ranami“ pred „Rana“; hranica slova aj pre diakritiku (\p{L}). */
const SLOVO_AKCIE = new RegExp(
  `(?<![\\p{L}\\p{N}])(?:${Object.values(TVARY_AKCII)
    .flat()
    .sort((x, y) => y.length - x.length)
    .map(vzorTvaru)
    .join("|")})(?![\\p{L}\\p{N}])`,
  "gu",
);
const ZNACKA = /\[([^[\]\s]+)\]/g;
/** Veta končí bodkou, otáznikom, výkričníkom či trojbodkou; zvyšok bez nich je posledná veta. */
const VETA = /[^.!?…]*(?:[.!?…]+|$)/g;

function pridajText(out: CastVety[], text: string): void {
  if (text === "") return;
  const posledna = out.at(-1);
  if (posledna !== undefined && "text" in posledna) out[out.length - 1] = { text: posledna.text + text };
  else out.push({ text });
}

/**
 * Text Melichara na kúsky text / piktogram akcie. Značka [Rana], [Cigareta], [PoškodeniePečene]
 * — kľúč akcie (ako v tvorcovi) — sa nahradí jej piktogramom; slovo za ňou píše autor sám
 * („jednu [Cigareta] cigaretu“). Hranaté zátvorky, lebo kučeravé {lokalita}, {karta} sú zástupné
 * mená, ktoré dopĺňa jadro. Neznámy kľúč ostane textom. Bez značky dostane piktogram pred seba
 * slovo akcie (TVARY_AKCII), v každej vete len prvý výskyt a len keď v nej akcia značku nemá.
 */
export function castiVety(text: string, jeAkcia: (kluc: string) => boolean): CastVety[] {
  const out: CastVety[] = [];
  for (const [veta] of text.matchAll(VETA)) {
    if (veta === "") continue;
    const ukazane = new Set([...veta.matchAll(ZNACKA)].map((m) => m[1] ?? "").filter(jeAkcia));
    const slova = (kus: string): void => {
      let i = 0;
      for (const m of kus.matchAll(SLOVO_AKCIE)) {
        const kluc = KLUC_TVARU.get(m[0].replace(/\s+/g, " ").toLowerCase());
        if (kluc === undefined || ukazane.has(kluc) || !jeAkcia(kluc)) continue;
        ukazane.add(kluc);
        pridajText(out, kus.slice(i, m.index));
        out.push({ akcia: kluc });
        pridajText(out, m[0]);
        i = m.index + m[0].length;
      }
      pridajText(out, kus.slice(i));
    };
    let i = 0;
    for (const m of veta.matchAll(ZNACKA)) {
      const kluc = m[1] ?? "";
      if (!jeAkcia(kluc)) continue;
      slova(veta.slice(i, m.index));
      out.push({ akcia: kluc });
      i = m.index + m[0].length;
    }
    slova(veta.slice(i));
  }
  return out;
}

/** Text Melichara po vetách (s medzerou pred vetou) — strana v bare sa delí len medzi vetami. */
export function vetyTextu(text: string): string[] {
  return [...text.matchAll(VETA)].map((m) => m[0]).filter((v) => v.trim() !== "");
}

export interface StranyTextu {
  /** Index prvého kusu každej strany (prvá strana začína nulou). */
  readonly zaciatky: readonly number[];
  /** Kusy, ktoré sa nezmestia ani samy — problém textu, nie rozloženia. */
  readonly pretecie: readonly number[];
}

/**
 * Strany textu Melichara (Michal 2026-10-25: v bare sa nescrolluje a bar sa nerozbalí cez
 * stôl). Kusy (vety, štítok, chyba) idú za sebou, kým sa zmestia do výšky; ďalší začne novú
 * stranu. vyska(od, po) je výška kusov [od, po) vysádzaných na jednej strane — meria ju
 * prehliadač, lebo zalomenie riadkov závisí od šírky aj piktogramov.
 */
export function rozdelNaStrany(pocet: number, vyska: (od: number, po: number) => number, dostupne: number): StranyTextu {
  const zaciatky: number[] = [];
  const pretecie: number[] = [];
  let od = 0;
  while (od < pocet) {
    zaciatky.push(od);
    let po = od + 1;
    if (vyska(od, po) > dostupne) pretecie.push(od);
    else while (po < pocet && vyska(od, po + 1) <= dostupne) po++;
    od = po;
  }
  return { zaciatky: zaciatky.length === 0 ? [0] : zaciatky, pretecie };
}

/**
 * Kvíz má v bare miesto na dve možnosti pod sebou (Michal 2026-10-25: „Stačí, ak možnosti budú
 * 2.“). Pri viacerých v dátach sa ukážu prvé dve — a keď medzi nimi nie je správna, druhú
 * nahradí správna, inak by sa otázka nedala zodpovedať. Index ostáva z dát (server si zapíše
 * odpoveď podľa neho).
 */
export function moznostiKvizu<M extends { readonly spravna?: boolean }>(
  moznosti: readonly M[],
): { readonly zobrazene: readonly { readonly index: number; readonly moznost: M }[]; readonly varovanie: string | null } {
  const vsetky = moznosti.map((moznost, index) => ({ index, moznost }));
  if (vsetky.length <= 2) return { zobrazene: vsetky, varovanie: null };
  const prve = vsetky.slice(0, 2);
  const spravna = vsetky.find((x) => x.moznost.spravna === true);
  const zobrazene = spravna === undefined || prve.includes(spravna) ? prve : [prve[0]!, spravna];
  return { zobrazene, varovanie: `Kvíz má ${vsetky.length} možnosti, v bare sa ukážu len dve (${zobrazene.map((x) => x.index + 1).join(" a ")}).` };
}

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

/**
 * Značka piktogramu v reči Melichara: [Rana], [Cigareta], [PoškodeniePečene] — kľúč akcie
 * (ako v tvorcovi) sa v bubline nahradí jej piktogramom. Slovo za ním píše autor sám, lebo sa
 * skloňuje („jednu [Cigareta] cigaretu“). Hranaté zátvorky, lebo kučeravé {lokalita}, {karta}
 * sú zástupné mená, ktoré dopĺňa jadro. Neznámy kľúč ostane textom.
 */
export function castiVety(text: string, jeAkcia: (kluc: string) => boolean): CastVety[] {
  const out: CastVety[] = [];
  let zvysok = "";
  let i = 0;
  for (const m of text.matchAll(/\[([^[\]\s]+)\]/g)) {
    const kluc = m[1] ?? "";
    zvysok += text.slice(i, m.index);
    i = m.index + m[0].length;
    if (!jeAkcia(kluc)) {
      zvysok += m[0];
      continue;
    }
    if (zvysok !== "") out.push({ text: zvysok });
    zvysok = "";
    out.push({ akcia: kluc });
  }
  zvysok += text.slice(i);
  if (zvysok !== "") out.push({ text: zvysok });
  return out;
}

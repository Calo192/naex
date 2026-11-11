// Rozdelenie hodnôt achievementov v partiách botov — podklad na prahy ★ / ★★ / ★★★.
// Bot nehrá ako človek (nefajčí do zásoby, málo podkladá), preto sú čísla orientačné:
// ukážu, či je prah zadarmo alebo mimo dosahu, nie presnú vzácnosť.
//
//   node --experimental-strip-types --no-warnings tools/achievementy/prahy.ts [partií=40] [kratka|stredna|dlha] [filter id]
//
// Pri achievementoch za bitku / Pitku / kolo / partiu je hodnota najlepší výsledok hráča
// v partii, pri kariére prírastok za jednu partiu (koľko partií treba na prah = prah / priemer).

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Command, DlzkaHry, GameState, PlayerId } from "../../packages/core/src/index.ts";
import {
  DLZKY_HRY,
  POVAHY,
  agregatPartie,
  applySPrisunom,
  hodnotaVPartii,
  krokAchievementov,
  loadGameData,
  mozeHrat,
  nacitajAchievementy,
  naTahu,
  noveAchievementy,
  rngInt,
  rngSeed,
  setupGame,
  tahBota,
  ziskatelne,
} from "../../packages/core/src/index.ts";

const koren = join(import.meta.dirname, "..", "..");
const json = (cesta: string): unknown => JSON.parse(readFileSync(join(koren, "packages", "core", "data", cesta), "utf8"));
const data = loadGameData(json("cards.json"), json("elders.json"), json("scorecards.json"));
const katalog = nacitajAchievementy(json("achievementy.json"));

const partii = Number(process.argv[2] ?? 40);
const dlzka = (process.argv[3] ?? "stredna") as DlzkaHry;
const filter = process.argv[4] ?? "";
const sledovane = ziskatelne(katalog).filter((a) => a.proti !== "bot" && a.id.includes(filter));
const hodnoty = new Map<string, number[]>(sledovane.map((a) => [a.id, []]));

for (let i = 0; i < partii; i++) {
  let s: GameState = setupGame(data, 5000 + i, { lokalit: DLZKY_HRY[dlzka] });
  let rng = rngSeed(900 + i);
  let stav = noveAchievementy();
  const povahy = [POVAHY[i % POVAHY.length], POVAHY[(i + 1 + Math.floor(i / POVAHY.length)) % POVAHY.length]];
  for (let krok = 0; s.koniec === null && krok < 20000; krok++) {
    const p: PlayerId | null = ([0, 1] as const).find((q) => mozeHrat(s, q)) ?? naTahu(s);
    if (p === null) break;
    const [seed, r] = rngInt(rng, 2 ** 31);
    rng = r;
    const cmd: Command = tahBota(data, s, p, seed, { povaha: povahy[p]?.id });
    const { state: po, events } = applySPrisunom(data, s, cmd, p);
    stav = krokAchievementov(katalog, data, stav, s, cmd, p, po, events, { botPovaha: null, superi: ["a", "b"] }).stav;
    s = po;
  }
  for (const a of sledovane) {
    for (const p of [0, 1] as const) hodnoty.get(a.id)?.push(a.rozsah === "kariera" ? (agregatPartie(stav, p, a) ?? 0) : hodnotaVPartii(stav, p, a));
  }
}

const kvantil = (zoradene: readonly number[], q: number): number => zoradene[Math.min(zoradene.length - 1, Math.floor(q * zoradene.length))] ?? 0;
console.log(`${partii} partií botov (${dlzka}), ${partii * 2} hráčov\n`);
console.log("id".padEnd(26), "rozsah".padEnd(8), "prahy".padEnd(16), "p50  p90  max  priem  nenul%  ★1%  ★2%  ★3%");
for (const a of sledovane) {
  const v = [...(hodnoty.get(a.id) ?? [])].sort((x, y) => x - y);
  const priemer = v.reduce((n, x) => n + x, 0) / Math.max(1, v.length);
  const podiel = (prah: number | undefined): string => (prah === undefined || a.rozsah === "kariera" ? "   –" : `${Math.round((100 * v.filter((x) => x >= prah).length) / Math.max(1, v.length))}`.padStart(4));
  console.log(
    a.id.padEnd(26),
    a.rozsah.padEnd(8),
    a.prahy.join("/").padEnd(16),
    String(kvantil(v, 0.5)).padStart(3),
    String(kvantil(v, 0.9)).padStart(4),
    String(v.at(-1) ?? 0).padStart(4),
    priemer.toFixed(2).padStart(6),
    `${Math.round((100 * v.filter((x) => x > 0).length) / Math.max(1, v.length))}`.padStart(6),
    podiel(a.prahy[0]),
    podiel(a.prahy[1]),
    podiel(a.prahy[2]),
  );
}

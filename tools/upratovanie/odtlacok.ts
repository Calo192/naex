// Odtlačok hry — dôkaz, že refaktor nezmenil správanie jadra ani bota.
//
//   node --experimental-strip-types --no-warnings tools/upratovanie/odtlacok.ts [partii]
//
// Odohrá partie bot proti botovi (všetky povahy, všetky dĺžky) s pevnými semienkami
// a zahashuje každý príkaz, udalosti, pohľady oboch hráčov a koniec. Náhoda je
// deterministická, takže rovnaký kód = rovnaký odtlačok. Agent naex-upratovac ho
// spustí pred refaktorom a po ňom; iný odtlačok znamená zmenu správania, nie čistenie.
// Zámerná zmena pravidiel, kariet alebo bota odtlačok mení — preto sa neukladá do repa.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { Command, DlzkaHry, GameState, PlayerId } from "../../packages/core/src/index.ts";
import { DLZKY_HRY, POVAHY, apply, loadGameData, mozeHrat, naTahu, rngInt, rngSeed, setupGame, tahBota, viewFor } from "../../packages/core/src/index.ts";

const citaj = (s: string): unknown => JSON.parse(readFileSync(new URL(`../../packages/core/data/${s}`, import.meta.url), "utf8"));
const data = loadGameData(citaj("cards.json"), citaj("elders.json"), citaj("scorecards.json"));

const partii = Number(process.argv[2] ?? 18);
const dlzky = Object.keys(DLZKY_HRY) as DlzkaHry[];
const celkovy = createHash("sha256");

for (let i = 0; i < partii; i++) {
  const dlzka = dlzky[i % dlzky.length] as DlzkaHry;
  // Povahy sa striedajú inak ako dĺžky, aby sa každá dvojica stretla v každej dĺžke.
  const j = Math.floor(i / dlzky.length);
  const povahy = [POVAHY[j % POVAHY.length], POVAHY[(j + 1 + Math.floor(j / POVAHY.length)) % POVAHY.length]].map((p) => p?.id);
  const h = createHash("sha256");
  let s: GameState = setupGame(data, 5000 + i, { lokalit: DLZKY_HRY[dlzka] });
  let rng = rngSeed(900 + i);
  let krokov = 0;
  for (; s.koniec === null && krokov < 20000; krokov++) {
    const p: PlayerId | null = ([0, 1] as const).find((q) => mozeHrat(s, q)) ?? naTahu(s);
    if (p === null) break;
    const [seed, r] = rngInt(rng, 2 ** 31);
    rng = r;
    const cmd: Command = tahBota(data, s, p, seed, { povaha: povahy[p] });
    const vysledok = apply(data, s, cmd, p);
    h.update(JSON.stringify(cmd)).update(JSON.stringify(vysledok.events));
    s = vysledok.state;
    // Pohľady chránia nemenné pravidlo 2 (čo hráč vidí); refaktor view.ts ich nesmie zmeniť.
    if (krokov % 25 === 0) h.update(JSON.stringify(viewFor(data, s, 0))).update(JSON.stringify(viewFor(data, s, 1)));
  }
  h.update(JSON.stringify(s));
  const odtlacok = h.digest("hex");
  celkovy.update(odtlacok);
  const k = s.koniec;
  const koniec = k === null ? "nedohraná" : k.vitaz === null ? "remíza" : `vyhral hráč ${k.vitaz + 1}`;
  console.log(`#${i} ${dlzka} ${povahy.join("/")}: ${krokov} krokov, ${koniec} — ${odtlacok.slice(0, 16)}`);
}
console.log(`ODTLACOK ${celkovy.digest("hex")}`);

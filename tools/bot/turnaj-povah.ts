// Turnaj povah offline protihráča — každá proti každej, so štatistikami štýlu.
//
//   node --experimental-strip-types --no-warnings tools/bot/turnaj-povah.ts [partii] [dlzka] [povaha…]
//
// partii = partií na dvojicu (predvolene 10, sedadlá sa striedajú), dlzka = kratka | stredna | dlha,
// povahy predvolene igor rudo bozena darina (Michal 2026-11-03). Okrem výhier vypíše, či povaha
// hrá svoj štýl: tuhé a mäkké poškodenie v bitke, cigarety, karty vo finále, poldeci, NA EX,
// Dlhy a pečeň súpera, reči a strach u starších.

import { readFileSync } from "node:fs";
import type { Command, DlzkaHry, GameState, PlayerId } from "../../packages/core/src/index.ts";
import { DLZKY_HRY, POVAHY, apply, jeFinale, loadGameData, mozeHrat, naTahu, rngInt, rngSeed, setupGame, tahBota } from "../../packages/core/src/index.ts";

const citaj = (s: string): unknown => JSON.parse(readFileSync(new URL(`../../packages/core/data/${s}`, import.meta.url), "utf8"));
const data = loadGameData(citaj("cards.json"), citaj("elders.json"), citaj("scorecards.json"));

const partii = Number(process.argv[2] ?? 10);
const dlzka = (process.argv[3] ?? "stredna") as DlzkaHry;
const povahy = process.argv.length > 4 ? process.argv.slice(4) : ["igor", "rudo", "bozena", "darina"];
for (const id of povahy) if (!POVAHY.some((p) => p.id === id)) throw new Error(`Neznáma povaha ${id} (${POVAHY.map((p) => p.id).join(", ")}).`);

interface Stat {
  partie: number;
  vyhry: number;
  remizy: number;
  body: number;
  bitky: number;
  bitkyVyhrane: number;
  tuhe: number;
  makke: number;
  cigaretyZiskane: number;
  cigaretyNaKonci: number;
  vizie: number;
  kartyPredFinale: number;
  kartyVoFinale: number;
  rukaPredFinale: number;
  poldeciNaKonci: number;
  naexVlastne: number;
  naexSuperove: number;
  dlhySupera: number;
  pecenSupera: number;
  cirhozySupera: number;
  reci: number;
  strach: number;
  vyhraStrachom: number;
}
const nova = (): Stat => ({
  partie: 0, vyhry: 0, remizy: 0, body: 0, bitky: 0, bitkyVyhrane: 0, tuhe: 0, makke: 0, cigaretyZiskane: 0, cigaretyNaKonci: 0, vizie: 0,
  kartyPredFinale: 0, kartyVoFinale: 0, rukaPredFinale: 0, poldeciNaKonci: 0, naexVlastne: 0, naexSuperove: 0,
  dlhySupera: 0, pecenSupera: 0, cirhozySupera: 0, reci: 0, strach: 0, vyhraStrachom: 0,
});
const staty = new Map(povahy.map((id) => [id, nova()] as const));
const vzajomne = new Map<string, [number, number, number]>();

function partia(seed: number, sedadla: readonly [string, string]): void {
  let s: GameState = setupGame(data, seed, { lokalit: DLZKY_HRY[dlzka] });
  let rng = rngSeed(77 + seed);
  const st = [staty.get(sedadla[0])!, staty.get(sedadla[1])!] as const;
  let vFinale = false;
  let bitkaKola = -1;
  for (let krok = 0; s.koniec === null && krok < 20000; krok++) {
    const p = ([0, 1] as const).find((q) => mozeHrat(s, q)) ?? naTahu(s);
    if (p === null) break;
    const [nah, r] = rngInt(rng, 2 ** 31);
    rng = r;
    const cmd: Command = tahBota(data, s, p, nah, { povaha: sedadla[p] });
    const finale = jeFinale(s);
    if (finale && !vFinale) {
      vFinale = true;
      for (const q of [0, 1] as const) st[q].rukaPredFinale += s.hraci[q].ruka.length;
    }
    if (cmd.type === "place" && (cmd.target === "vlastna" || cmd.target === "superova")) {
      if (finale) st[p].kartyVoFinale++;
      else st[p].kartyPredFinale++;
    }
    if (cmd.type === "vizia" && cmd.vziat) st[p].vizie++;
    if (cmd.type === "naex") {
      const karta = s.strany.flat().find((pl) => pl.card.uid === cmd.uid);
      if (karta?.playedBy === p) st[p].naexVlastne++;
      else st[p].naexSuperove++;
    }
    const pred = s;
    s = apply(data, s, cmd, p).state;
    for (const q of [0, 1] as const) {
      const su: PlayerId = q === 0 ? 1 : 0;
      st[q].cigaretyZiskane += Math.max(0, s.hraci[q].cigarety - pred.hraci[q].cigarety);
      st[su].dlhySupera += Math.max(0, s.hraci[q].dlhy - pred.hraci[q].dlhy);
      st[su].pecenSupera += Math.max(0, s.hraci[q].pecen - pred.hraci[q].pecen);
      st[su].cirhozySupera += Math.max(0, (s.cirhozyVKole[q] ?? 0) - (pred.cirhozyVKole[q] ?? 0));
    }
    const dmg = s.bitkaStav?.damage ?? null;
    if (dmg !== null && bitkaKola !== s.kolo) {
      bitkaKola = s.kolo;
      for (const q of [0, 1] as const) {
        const su: PlayerId = q === 0 ? 1 : 0;
        st[q].bitky++;
        st[q].tuhe += dmg.tuhe[q];
        st[q].makke += dmg.makke[q];
        if (dmg.tuhe[q] > dmg.tuhe[su]) st[q].bitkyVyhrane++;
      }
    }
  }
  const k = s.koniec;
  if (k === null) return;
  const kluc = `${sedadla[0]}|${sedadla[1]}`;
  for (const q of [0, 1] as const) {
    st[q].partie++;
    if (k.vitaz === q) st[q].vyhry++;
    else if (k.vitaz === null) st[q].remizy++;
    if (k.body !== null) st[q].body += k.body[q];
    st[q].cigaretyNaKonci += s.hraci[q].cigarety;
    st[q].poldeciNaKonci += s.hraci[q].poldeciPlne + s.hraci[q].poldeciVypite;
    for (const e of s.starsi) {
      st[q].reci += e.reci[q];
      st[q].strach += e.strach[q];
    }
    if (k.vitaz === q && k.dovod.includes("strachom")) st[q].vyhraStrachom++;
  }
  const v = vzajomne.get(kluc) ?? [0, 0, 0];
  v[k.vitaz === 0 ? 0 : k.vitaz === 1 ? 1 : 2]++;
  vzajomne.set(kluc, v);
}

const t0 = performance.now();
for (let a = 0; a < povahy.length; a++) {
  for (let b = a + 1; b < povahy.length; b++) {
    const pa = povahy[a]!;
    const pb = povahy[b]!;
    let va = 0;
    let vb = 0;
    for (let i = 0; i < partii; i++) {
      const sedadla: [string, string] = i % 2 === 0 ? [pa, pb] : [pb, pa];
      const predA = staty.get(pa)!.vyhry;
      const predB = staty.get(pb)!.vyhry;
      partia(1000 + i, sedadla);
      va += staty.get(pa)!.vyhry - predA;
      vb += staty.get(pb)!.vyhry - predB;
    }
    console.log(`${pa} – ${pb}: ${va} : ${vb}${partii - va - vb > 0 ? ` (${partii - va - vb} remíza)` : ""}`);
  }
}

const n = (x: number, d: number): string => (d === 0 ? "–" : (x / d).toFixed(1));
console.log(`\nŠtatistiky štýlu (priemer na partiu, poškodenie na bitku), ${dlzka}, ${((performance.now() - t0) / 1000).toFixed(0)} s:`);
const riadky: [string, (s: Stat) => string][] = [
  ["výhry", (s) => `${s.vyhry}/${s.partie}`],
  ["body (špaky)", (s) => n(s.body, s.partie)],
  ["bitky vyhrané v tuhom", (s) => `${s.bitkyVyhrane}/${s.bitky}`],
  ["tuhé na bitku", (s) => n(s.tuhe, s.bitky)],
  ["mäkké na bitku", (s) => n(s.makke, s.bitky)],
  ["cigarety získané", (s) => n(s.cigaretyZiskane, s.partie)],
  ["cigarety na konci", (s) => n(s.cigaretyNaKonci, s.partie)],
  ["Vízie vzaté", (s) => n(s.vizie, s.partie)],
  ["karty vyložené pred finále", (s) => n(s.kartyPredFinale, s.partie)],
  ["karty vo finále", (s) => n(s.kartyVoFinale, s.partie)],
  ["ruka pred finále", (s) => n(s.rukaPredFinale, s.partie)],
  ["poldeci na konci", (s) => n(s.poldeciNaKonci, s.partie)],
  ["NA EX na vlastné karty", (s) => n(s.naexVlastne, s.partie)],
  ["NA EX na súperove karty", (s) => n(s.naexSuperove, s.partie)],
  ["Dlhy súpera", (s) => n(s.dlhySupera, s.partie)],
  ["pečeň súpera", (s) => n(s.pecenSupera, s.partie)],
  ["Cirhózy súpera", (s) => n(s.cirhozySupera, s.partie)],
  ["reči u starších (súčet)", (s) => n(s.reci, s.partie)],
  ["strach u starších (súčet)", (s) => n(s.strach, s.partie)],
  ["výhry strachom", (s) => String(s.vyhraStrachom)],
];
const sirka = Math.max(...riadky.map(([r]) => r.length));
console.log(`${"".padEnd(sirka)}  ${povahy.map((p) => p.padStart(9)).join("")}`);
for (const [nazov, f] of riadky) console.log(`${nazov.padEnd(sirka)}  ${povahy.map((p) => f(staty.get(p)!).padStart(9)).join("")}`);

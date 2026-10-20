// Meranie strategickosti — koľko o partii rozhoduje zručnosť a koľko náhoda.
//
//   node --experimental-strip-types --no-warnings tools/bot/strategickost.ts [--partii 16] [--rozdania 10]
//        [--behy 6] [--dlzka stredna] [--povaha stamgast] [--json cesta.json] [--len rebrik,miesto,rozdanie]
//
// Bez servera, nad jadrom pravidiel. Spúšťa sa aj vo worktree s upravenými
// pravidlami (agent naex-strateg) — rovnaké semienka, takže čísla sa dajú
// porovnať s východiskom. Bot je ladený na súčasné pravidlá; pri variante
// sú čísla orientačné (bot sa novým pravidlám neprispôsobí).
//
// Partia trvá ~2 s; predvolené čísla ≈ 250 partií ≈ 8 min. Časti sa dajú pustiť
// paralelne (--len rebrik / --len miesto,rozdanie).
//
// Merania:
//  rebrik   — bot proti horším hráčom (bot s pravdepodobnosťou ε ťahá náhodne,
//             chamtivý, náhodný). Každé rozdanie dvakrát s vymenenými miestami
//             („duplikát“ ako v bridži): ak silnejší vyhrá obe, rozhodla zručnosť;
//             ak každú vyhrá ten istý stolec, rozhodlo rozdanie alebo miesto.
//  miesto   — bot proti rovnakému botovi: výhoda hráča 1, dĺžka, otočky
//             (víťaz prehrával po polovici kôl), ako často vyhrá vedúci po kole k,
//             podiel vynútených ťahov (len jedna možnosť) a priemer možností na ťah.
//  rozdanie — to isté rozdanie viackrát s inými semienkami botov: ak výsledok
//             takmer vždy rovnaký, partiu predurčilo rozdanie, nie hra.

import { readFileSync, writeFileSync } from "node:fs";
import type { Command, DlzkaHry, GameState, PlayerId } from "../../packages/core/src/index.ts";
import {
  DLZKY_HRY,
  apply,
  bodyTeraz,
  evaluateLine,
  legalCommands,
  lineState,
  loadGameData,
  mozeHrat,
  naTahu,
  poskodenieBitky,
  rngInt,
  rngSeed,
  setupGame,
  tahBota,
  viewFor,
} from "../../packages/core/src/index.ts";

const citaj = (s: string): unknown => JSON.parse(readFileSync(new URL(`../../packages/core/data/${s}`, import.meta.url), "utf8"));
const data = loadGameData(citaj("cards.json"), citaj("elders.json"), citaj("scorecards.json"));

function arg(meno: string, predvolene: string): string {
  const i = process.argv.indexOf(`--${meno}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? (process.argv[i + 1] as string) : predvolene;
}
const partii = Number(arg("partii", "16"));
const rozdani = Number(arg("rozdania", "10"));
const behov = Number(arg("behy", "6"));
const dlzka = arg("dlzka", "stredna") as DlzkaHry;
const povaha = arg("povaha", "stamgast");
const jsonCesta = arg("json", "");
const casti = new Set(arg("len", "rebrik,miesto,rozdanie").split(","));

type Hrac = { readonly meno: string; readonly tah: (s: GameState, p: PlayerId, seed: number) => Command };

function nahodnyTah(s: GameState, p: PlayerId, seed: number): Command {
  const cmds = legalCommands(data, s, p);
  return cmds[seed % cmds.length] as Command;
}

// Rovnaká latka ako v turnaj.ts — vykladá kartu s najväčším okamžitým rozdielom tuhého.
function chamtivyTah(s: GameState, p: PlayerId, seed: number): Command {
  const cmds = legalCommands(data, s, p);
  if (s.faza === "pitka" && s.pitkaStav?.reakcia !== p) {
    // Vízia: chamtivý hráč si kartu vždy vezme.
    const skip = cmds.find((c) => c.type === "skipNaex" || (c.type === "vizia" && c.vziat));
    if (skip !== undefined) return skip;
  }
  if (s.faza === "zhromazdenie" || (s.faza === "pitka" && s.pitkaStav?.reakcia === p)) {
    const o: PlayerId = p === 0 ? 1 : 0;
    const rozdiel = (st: GameState): number => {
      const d = poskodenieBitky(data, st, evaluateLine(data, lineState(st)).sums, [0, 0]);
      return d.tuhe[p] - d.tuhe[o];
    };
    let best: Command | null = null;
    let bestV = rozdiel(s);
    for (const c of cmds) {
      if (c.type !== "place" || (c.target !== "vlastna" && c.target !== "superova")) continue;
      const v = rozdiel(apply(data, s, c, p).state);
      if (v > bestV) {
        bestV = v;
        best = c;
      }
    }
    if (best !== null) return best;
    const pas = cmds.find((c) => c.type === "pass" || c.type === "bezReakcie");
    if (pas !== undefined) return pas;
  }
  return nahodnyTah(s, p, seed);
}

const bot = (pov: string): Hrac => ({ meno: `bot:${pov}`, tah: (s, p, seed) => tahBota(data, s, p, seed, { povaha: pov }) });
// Bot, ktorý s pravdepodobnosťou ε urobí náhodný ťah — „slabší hráč“ s plynule nastaviteľnou silou.
const chybujuci = (pov: string, eps: number): Hrac => ({
  meno: `bot:${pov} ε=${eps}`,
  tah: (s, p, seed) => ((seed % 1000) / 1000 < eps ? nahodnyTah(s, p, Math.floor(seed / 1000)) : tahBota(data, s, p, seed, { povaha: pov })),
});

interface Vysledok {
  readonly vitaz: PlayerId | null;
  readonly body: readonly [number, number] | null;
  readonly kol: number;
  readonly dovod: string;
  /** Vedúci podľa živého odhadu bodov na konci každého kola (null = rovnosť). */
  readonly vedúci: readonly (PlayerId | null)[];
  readonly tahov: number;
  readonly vynutenych: number;
  readonly moznosti: number;
}

function body(s: GameState): [number, number] {
  // Každý hráč pozná presne len svoje kliatby — vlastné body z vlastného pohľadu.
  return [bodyTeraz(data, viewFor(data, s, 0)).spolu[0], bodyTeraz(data, viewFor(data, s, 1)).spolu[1]];
}

function odohraj(seedHry: number, seedBotov: number, hraci: readonly [Hrac, Hrac]): Vysledok {
  let s: GameState = setupGame(data, seedHry, { lokalit: DLZKY_HRY[dlzka] });
  let rng = rngSeed(seedBotov);
  const veduci: (PlayerId | null)[] = [];
  let kolo = s.kolo;
  let tahov = 0;
  let vynutenych = 0;
  let moznosti = 0;
  for (let krok = 0; s.koniec === null && krok < 20000; krok++) {
    const p = ([0, 1] as const).find((q) => mozeHrat(s, q)) ?? naTahu(s);
    if (p === null) break;
    const [seed, r] = rngInt(rng, 2 ** 31);
    rng = r;
    const n = legalCommands(data, s, p).length;
    tahov++;
    moznosti += n;
    if (n <= 1) vynutenych++;
    s = apply(data, s, (hraci[p] as Hrac).tah(s, p, seed), p).state;
    if (s.kolo !== kolo && s.koniec === null) {
      const [a, b] = body(s);
      veduci.push(a > b ? 0 : b > a ? 1 : null);
      kolo = s.kolo;
    }
  }
  const k = s.koniec;
  return {
    vitaz: k?.vitaz ?? null,
    body: k?.body ?? null,
    kol: s.kolo,
    dovod: k === null ? "nedohraná" : k.dovod.replace(/Hráč [12]/g, "X").replace(/-?\d+/g, "#"),
    vedúci: veduci,
    tahov,
    vynutenych,
    moznosti,
  };
}

const pct = (a: number, b: number): string => (b === 0 ? "—" : `${Math.round((100 * a) / b)} %`);
const vystup: Record<string, unknown> = { dlzka, povaha, partii, rozdani, behov };

// ---------------------------------------------------------------- rebrík
if (casti.has("rebrik")) {
  const silny = bot(povaha);
  const supery: Hrac[] = [
    chybujuci(povaha, 0.1),
    chybujuci(povaha, 0.25),
    chybujuci(povaha, 0.5),
    { meno: "chamtivy", tah: chamtivyTah },
    { meno: "nahodny", tah: nahodnyTah },
  ];
  console.log(`\n== Rebrík zručnosti: ${silny.meno} proti slabším (${partii} rozdaní × 2 miesta, ${dlzka}) ==`);
  console.log("súper                  výhry silného   obe vyhral   delené   obe prehral   rozdiel bodov");
  const rebrik: unknown[] = [];
  for (const slaby of supery) {
    let vyhry = 0;
    let obe = 0;
    let delene = 0;
    let ziadna = 0;
    let rozdiel = 0;
    for (let i = 0; i < partii; i++) {
      const a = odohraj(1000 + i, 77 + i, [silny, slaby]);
      const b = odohraj(1000 + i, 77 + i, [slaby, silny]);
      const v = (a.vitaz === 0 ? 1 : 0) + (b.vitaz === 1 ? 1 : 0);
      vyhry += v;
      if (v === 2) obe++;
      else if (v === 1) delene++;
      else ziadna++;
      if (a.body !== null) rozdiel += a.body[0] - a.body[1];
      if (b.body !== null) rozdiel += b.body[1] - b.body[0];
    }
    const riadok = { super: slaby.meno, vyhry: vyhry / (2 * partii), obe: obe / partii, delene: delene / partii, ziadna: ziadna / partii, rozdielBodov: rozdiel / (2 * partii) };
    rebrik.push(riadok);
    console.log(
      `${slaby.meno.padEnd(22)} ${pct(vyhry, 2 * partii).padStart(13)} ${pct(obe, partii).padStart(12)} ${pct(delene, partii).padStart(8)} ${pct(ziadna, partii).padStart(13)} ${(rozdiel / (2 * partii)).toFixed(1).padStart(15)}`,
    );
  }
  console.log("Čítanie: strategická hra = strmý rebrík (už ε=0,1 prehráva väčšinu). Veľa „delených“ = rozhoduje rozdanie či miesto.");
  vystup.rebrik = rebrik;
}

// ---------------------------------------------------------------- miesto, otočky, voľby
if (casti.has("miesto")) {
  const b = bot(povaha);
  const n = 2 * partii;
  let p1 = 0;
  let remiz = 0;
  let kol = 0;
  let otocky = 0;
  let sPolovicou = 0;
  let tahov = 0;
  let vynutenych = 0;
  let moznosti = 0;
  const vedieVyhra: { vyhral: number; spolu: number }[] = [];
  const dovody = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    const r = odohraj(3000 + i, 500 + i, [b, b]);
    if (r.vitaz === 0) p1++;
    if (r.vitaz === null) remiz++;
    kol += r.kol;
    tahov += r.tahov;
    vynutenych += r.vynutenych;
    moznosti += r.moznosti;
    dovody.set(r.dovod, (dovody.get(r.dovod) ?? 0) + 1);
    r.vedúci.forEach((v, k) => {
      const z = (vedieVyhra[k] ??= { vyhral: 0, spolu: 0 });
      if (v === null || r.vitaz === null) return;
      z.spolu++;
      if (v === r.vitaz) z.vyhral++;
    });
    const pol = r.vedúci[Math.floor(r.vedúci.length / 2)];
    if (pol !== undefined && pol !== null && r.vitaz !== null) {
      sPolovicou++;
      if (pol !== r.vitaz) otocky++;
    }
  }
  console.log(`\n== Zrkadlo: ${b.meno} proti sebe (${n} partií) ==`);
  console.log(`Hráč 1 vyhral ${pct(p1, n - remiz)} rozhodnutých partií (remíz ${remiz}). Priemerne ${(kol / n).toFixed(1)} kôl.`);
  console.log(`Otočky (víťaz po polovici kôl prehrával): ${pct(otocky, sPolovicou)}.`);
  console.log(`Vedúci po kole k vyhrá: ${vedieVyhra.map((z, k) => `k${k + 1} ${pct(z.vyhral, z.spolu)} (${z.spolu})`).join(", ")}`);
  console.log(`Vynútené ťahy (jediná možnosť): ${pct(vynutenych, tahov)}; priemerne ${(moznosti / Math.max(1, tahov)).toFixed(1)} možností na ťah.`);
  for (const [d, c] of dovody) console.log(`  ${c}× ${d}`);
  vystup.miesto = {
    vyhodaHraca1: p1 / Math.max(1, n - remiz),
    remizy: remiz / n,
    kol: kol / n,
    otocky: otocky / Math.max(1, sPolovicou),
    vedieVyhra: vedieVyhra.map((z) => (z.spolu === 0 ? null : z.vyhral / z.spolu)),
    vynutene: vynutenych / Math.max(1, tahov),
    moznostiNaTah: moznosti / Math.max(1, tahov),
    dovody: Object.fromEntries(dovody),
  };
}

// ---------------------------------------------------------------- predurčenosť rozdania
if (casti.has("rozdanie")) {
  const b = bot(povaha);
  let suma = 0;
  const podiely: number[] = [];
  for (let d = 0; d < rozdani; d++) {
    let v1 = 0;
    let rozhodnute = 0;
    for (let k = 0; k < behov; k++) {
      const r = odohraj(7000 + d, 9000 + 31 * d + k, [b, b]);
      if (r.vitaz === null) continue;
      rozhodnute++;
      if (r.vitaz === 0) v1++;
    }
    const p = rozhodnute === 0 ? 0.5 : v1 / rozhodnute;
    podiely.push(p);
    suma += Math.abs(2 * p - 1);
  }
  // Čo by vyšlo, keby každé rozdanie bolo férová minca — šum z malého počtu behov.
  let sum = 0;
  let c = 1;
  for (let j = 0; j <= behov; j++) {
    sum += (c / 2 ** behov) * Math.abs((2 * j) / behov - 1);
    c = (c * (behov - j)) / (j + 1);
  }
  const pred = suma / rozdani;
  console.log(`\n== Predurčenosť rozdania (${rozdani} rozdaní × ${behov} behov, ${b.meno} proti sebe) ==`);
  console.log(`Podiel výhier hráča 1 v rozdaniach: ${podiely.map((p) => Math.round(100 * p)).join(" ")} %`);
  console.log(`Predurčenosť ${pred.toFixed(2)} (0 = rozdanie nerozhoduje, 1 = rozdanie určí víťaza; čistý šum pri ${behov} behoch ≈ ${sum.toFixed(2)}).`);
  console.log("Pozor: boty sú si podobné, preto aj ich rozhodnutia ťahajú číslo hore — porovnávaj variant s východiskom, nie s nulou.");
  vystup.rozdanie = { predurcenost: pred, sum, podiely };
}

if (jsonCesta !== "") {
  writeFileSync(jsonCesta, JSON.stringify(vystup, null, 2));
  console.log(`\nJSON: ${jsonCesta}`);
}

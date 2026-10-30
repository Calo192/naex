// Turnaj offline protihráča — sila a rýchlosť bota bez servera.
//
//   node --experimental-strip-types --no-warnings tools/bot/turnaj.ts [partii] [super] [dlzka] [povaha]
//
// super: nahodny (predvolený) | chamtivy | bot | bot:<povaha> | stary:<priečinok>. Bot (povaha,
// predvolene stamgast) hrá striedavo za hráča 1 a 2. Povahy: stamgast, rapavy_fero, teta_gizka.
// Chamtivý vykladá kartu s najväčším okamžitým rozdielom tuhého poškodenia,
// NA EX nedáva, zvyšok hrá náhodne — latka „hráč, ktorý vie vykladať“.
// stary:<priečinok> = tá istá povaha, ale bot.ts z inej kópie repozitára (worktree
// so starou verziou bota) — či úprava bota naozaj pomohla (agent naex-bot-trener).
// Pravidlá berie z tohto stromu, preto porovnávaj len verzie s rovnakým jadrom.
//
// Na konci vypíše, koľkokrát bot použil ktorý ťah — nové pravidlo, ktoré bot
// nikdy nepoužije, tu vidno hneď (Developer to prikladá k návrhu).

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { Command, DlzkaHry, GameState, PlayerId } from "../../packages/core/src/index.ts";
import {
  DLZKY_HRY,
  apply,
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
} from "../../packages/core/src/index.ts";

const citaj = (s: string): unknown => JSON.parse(readFileSync(new URL(`../../packages/core/data/${s}`, import.meta.url), "utf8"));
const data = loadGameData(citaj("cards.json"), citaj("elders.json"), citaj("scorecards.json"));

const partii = Number(process.argv[2] ?? 10);
const superTyp = process.argv[3] ?? "nahodny";
const dlzka = (process.argv[4] ?? "stredna") as DlzkaHry;
const povaha = process.argv[5] ?? "stamgast";
const povahaSupera = superTyp.startsWith("bot:") ? superTyp.slice(4) : superTyp === "bot" ? povaha : null;
const staryBot: typeof tahBota | null = superTyp.startsWith("stary:")
  ? ((await import(pathToFileURL(resolve(superTyp.slice("stary:".length), "packages/core/src/bot.ts")).href)) as { tahBota: typeof tahBota }).tahBota
  : null;

function nahodny(s: GameState, p: PlayerId, seed: number): Command {
  const cmds = legalCommands(data, s, p);
  return cmds[seed % cmds.length] as Command;
}

function chamtivy(s: GameState, p: PlayerId, seed: number): Command {
  const cmds = legalCommands(data, s, p);
  if (s.faza === "pitka" && s.pitkaStav?.reakcia !== p) {
    // Vízia: chamtivý hráč si kartu vždy vezme.
    const skip = cmds.find((c) => c.type === "skipNaex" || (c.type === "vizia" && c.vziat));
    if (skip !== undefined) return skip;
  }
  if (s.faza === "zhromazdenie" || (s.faza === "pitka" && s.pitkaStav?.reakcia === p)) {
    const o: PlayerId = p === 0 ? 1 : 0;
    const rozdiel = (st: GameState): number => {
      const d = poskodenieBitky(data, st, evaluateLine(data, lineState(st)).sums);
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
  return nahodny(s, p, seed);
}

let vyhry = 0;
let remizy = 0;
const dovody = new Map<string, number>();
let najdlhsi = 0;
let tahovBota = 0;
let casBota = 0;
let bodyBot = 0;
let bodySuper = 0;
const typyTahov = new Map<string, number>();

for (let i = 0; i < partii; i++) {
  const botSeat: PlayerId = i % 2 === 0 ? 0 : 1;
  let s: GameState = setupGame(data, 1000 + i, { lokalit: DLZKY_HRY[dlzka] });
  let rng = rngSeed(77 + i);
  for (let krok = 0; s.koniec === null && krok < 20000; krok++) {
    // Pri stavbe šenku hrajú obaja naraz — najprv ten, kto ešte nevybral.
    const p = ([0, 1] as const).find((q) => mozeHrat(s, q)) ?? naTahu(s);
    if (p === null) break;
    const [seed, r] = rngInt(rng, 2 ** 31);
    rng = r;
    let cmd: Command;
    if (p !== botSeat && staryBot !== null) {
      cmd = staryBot(data, s, p, seed, { povaha });
    } else if (p === botSeat || povahaSupera !== null) {
      const t0 = performance.now();
      cmd = tahBota(data, s, p, seed, { povaha: p === botSeat ? povaha : (povahaSupera ?? povaha) });
      const dt = performance.now() - t0;
      if (p === botSeat) {
        casBota += dt;
        tahovBota++;
        najdlhsi = Math.max(najdlhsi, dt);
        const typ = cmd.type === "place" ? `place:${cmd.target}` : cmd.type;
        typyTahov.set(typ, (typyTahov.get(typ) ?? 0) + 1);
      }
    } else if (superTyp === "chamtivy") {
      cmd = chamtivy(s, p, seed);
    } else {
      cmd = nahodny(s, p, seed);
    }
    s = apply(data, s, cmd, p).state;
  }
  const k = s.koniec;
  if (k === null) {
    console.log(`#${i}: nedohraná (kolo ${s.kolo}, ${s.faza})`);
    continue;
  }
  if (k.vitaz === botSeat) vyhry++;
  else if (k.vitaz === null) remizy++;
  if (k.body !== null) {
    bodyBot += k.body[botSeat];
    bodySuper += k.body[botSeat === 0 ? 1 : 0];
  }
  const dovod = k.dovod.replace(/Hráč [12]/g, "X").replace(/\d+/g, "#");
  dovody.set(dovod, (dovody.get(dovod) ?? 0) + 1);
  const vysledok = k.vitaz === botSeat ? "bot vyhral" : k.vitaz === null ? "remíza" : "bot prehral";
  const body = k.body !== null ? ` ${k.body[botSeat]}:${k.body[botSeat === 0 ? 1 : 0]}` : "";
  console.log(`#${i} (bot = hráč ${botSeat + 1}): ${vysledok} — ${k.dovod}${body} (kolo ${s.kolo})`);
}
console.log(`\nBot ${povaha} proti „${superTyp}“: ${vyhry} výhier, ${remizy} remíz z ${partii}. Body spolu ${bodyBot}:${bodySuper}.`);
console.log(`Ťahy bota: ${tahovBota}, priemer ${(casBota / Math.max(1, tahovBota)).toFixed(1)} ms, najdlhší ${najdlhsi.toFixed(0)} ms.`);
for (const [d, n] of dovody) console.log(`  ${n}× ${d}`);
console.log(
  `Ťahy bota podľa typu: ${[...typyTahov]
    .sort((a, b) => b[1] - a[1])
    .map(([t, n]) => `${t} ${n}`)
    .join(", ")}`,
);

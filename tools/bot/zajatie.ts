// Ako často sa v partiách botov dá zajať a presvedčiť staršieho (§10, v11.4) a ako často to bot
// urobí — podklad k otázke, či stupeň 3 a reči na červenej v hre vôbec nastanú.
//
//   node --experimental-strip-types --no-warnings tools/bot/zajatie.ts [partii] [dlzka] [povaha]
//
// Bot hrá proti sebe (predvolene povahy na striedačku). Ráta sa v rozdelení Nakladačky a hádky:
// koľkokrát mal rozdeľujúci zajatie či presvedčenie na dosah (moznostiAkcie), koľkokrát ho bot
// urobil; navyše výhry väzňami a najvyšší stupeň strachu v partii.

import { readFileSync } from "node:fs";
import type { DlzkaHry, GameState, PlayerId } from "../../packages/core/src/index.ts";
import {
  DLZKY_HRY,
  POVAHY,
  apply,
  bodyRozdelenia,
  krokRozdelenia,
  loadGameData,
  markerRozdelenia,
  mozeHrat,
  moznostiAkcie,
  naTahu,
  rngInt,
  rngSeed,
  setupGame,
  strachZ,
  tahBota,
} from "../../packages/core/src/index.ts";

const citaj = (s: string): unknown => JSON.parse(readFileSync(new URL(`../../packages/core/data/${s}`, import.meta.url), "utf8"));
const data = loadGameData(citaj("cards.json"), citaj("elders.json"), citaj("scorecards.json"));

const partii = Number(process.argv[2] ?? 20);
const dlzka = (process.argv[3] ?? "stredna") as DlzkaHry;
const povahaArg = process.argv[4];

let kol = 0;
const naDosah = { prebytok: 0, reci: 0 };
const urobil = { prebytok: 0, reci: 0 };
let zajatych = 0;
let presvedcenych = 0;
let vyhierVaznami = 0;
const najvyssiStupen = [0, 0, 0, 0];

for (let i = 0; i < partii; i++) {
  const povahy = [povahaArg ?? POVAHY[i % POVAHY.length]?.id ?? "igor", povahaArg ?? POVAHY[(i + 1) % POVAHY.length]?.id ?? "igor"] as const;
  let s: GameState = setupGame(data, 5000 + i, { lokalit: DLZKY_HRY[dlzka] });
  let rng = rngSeed(91 + i);
  let maxStupen = 0;
  for (let krok = 0; s.koniec === null && krok < 20000; krok++) {
    for (const e of s.starsi) maxStupen = Math.max(maxStupen, strachZ(e, 0), strachZ(e, 1));
    const p = ([0, 1] as const).find((q) => mozeHrat(s, q)) ?? naTahu(s);
    if (p === null) break;
    const [seed, r] = rngInt(rng, 2 ** 31);
    rng = r;
    const kr = krokRozdelenia(s, p as PlayerId);
    if (kr !== null && moznostiAkcie(s, p as PlayerId, markerRozdelenia(kr), bodyRozdelenia(s, p as PlayerId)).length > 0) naDosah[kr]++;
    const cmd = tahBota(data, s, p as PlayerId, seed, { povaha: povahy[p] });
    if (cmd.type === "prebytok" && (cmd.zajatia?.length ?? 0) > 0) {
      urobil.prebytok++;
      zajatych += cmd.zajatia!.length;
    }
    if (cmd.type === "reci" && (cmd.presvedcenia?.length ?? 0) > 0) {
      urobil.reci++;
      presvedcenych += cmd.presvedcenia!.length;
    }
    s = apply(data, s, cmd, p).state;
  }
  kol += s.kolo;
  najvyssiStupen[maxStupen] = (najvyssiStupen[maxStupen] ?? 0) + 1;
  if (s.koniec?.dovod.includes("výhra väzňami") === true) vyhierVaznami++;
  const presv = s.starsi.filter((e) => e.presvedcil !== undefined).length;
  console.log(`#${i} ${povahy[0]} vs ${povahy[1]}: kolo ${s.kolo}, najvyšší strach ${maxStupen}, väzňov ${s.vazni.length}, presvedčených ${presv} — ${s.koniec?.dovod ?? "nedohraná"}`);
}

console.log(`\n${partii} partií (${dlzka}), ${kol} kôl.`);
console.log(`Zajatie na dosah pri rozdelení Nakladačky: ${naDosah.prebytok}×, bot zajal ${urobil.prebytok}× (${zajatych} starších); výhra väzňami ${vyhierVaznami}×.`);
console.log(`Presvedčenie na dosah pri rozdelení hádky: ${naDosah.reci}×, bot presvedčil ${urobil.reci}× (${presvedcenych} starších).`);
console.log(`Najvyšší stupeň strachu v partii (kedykoľvek): ${najvyssiStupen.map((n, st) => `${st}: ${n}`).join(", ")}.`);

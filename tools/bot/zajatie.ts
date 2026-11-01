// Ako často sa v partiách botov dá skúsiť zajať staršieho (§10, v9) — podklad k otázke,
// či stupeň 3 v hre vôbec nastane (od v10 hýbe markerom už len Nakladačka).
//
//   node --experimental-strip-types --no-warnings tools/bot/zajatie.ts [partii] [dlzka] [povaha]
//
// Bot hrá proti sebe (predvolene povahy na striedačku). Ráta sa v kroku draftu „zajatie“
// (od v10.1 hneď po voľbe cieľa, pred stavbou šenku): či sa niektorý starší hráča bojí na stupni 3, či mal hráč cigaretu,
// koľko pokusov bot urobil a koľko z nich vyšlo; navyše najvyšší stupeň strachu v partii.

import { readFileSync } from "node:fs";
import type { DlzkaHry, GameState, PlayerId } from "../../packages/core/src/index.ts";
import { DLZKY_HRY, KONSTANTY, POVAHY, apply, loadGameData, mozeHrat, naTahu, pokusMozny, rngInt, rngSeed, setupGame, strachZ, tahBota } from "../../packages/core/src/index.ts";

const citaj = (s: string): unknown => JSON.parse(readFileSync(new URL(`../../packages/core/data/${s}`, import.meta.url), "utf8"));
const data = loadGameData(citaj("cards.json"), citaj("elders.json"), citaj("scorecards.json"));

const partii = Number(process.argv[2] ?? 20);
const dlzka = (process.argv[3] ?? "stredna") as DlzkaHry;
const povahaArg = process.argv[4];

let kol = 0;
let krokovZajatia = 0;
let sPodmienkou = 0;
let sPodmienkouACigaretou = 0;
let partiiSoStupnom3 = 0;
let pokusov = 0;
let uspechov = 0;
let vyhierTromiVaznami = 0;
const najvyssiStupen = [0, 0, 0, 0];

for (let i = 0; i < partii; i++) {
  const povahy = [povahaArg ?? POVAHY[i % POVAHY.length]?.id ?? "stamgast", povahaArg ?? POVAHY[(i + 1) % POVAHY.length]?.id ?? "stamgast"] as const;
  let s: GameState = setupGame(data, 5000 + i, { lokalit: DLZKY_HRY[dlzka] });
  let rng = rngSeed(91 + i);
  let maxStupen = 0;
  let stupen3VPartii = false;
  for (let krok = 0; s.koniec === null && krok < 20000; krok++) {
    for (const e of s.starsi) maxStupen = Math.max(maxStupen, strachZ(e, 0), strachZ(e, 1));
    const p = ([0, 1] as const).find((q) => mozeHrat(s, q)) ?? naTahu(s);
    if (p === null) break;
    const [seed, r] = rngInt(rng, 2 ** 31);
    rng = r;
    const cmd = tahBota(data, s, p as PlayerId, seed, { povaha: povahy[p] });
    if (cmd.type === "pokus") pokusov++;
    const vazniPred = s.vazni.length;
    const volbaPred = s.faza === "volbaCiela";
    s = apply(data, s, cmd, p).state;
    uspechov += s.vazni.length - vazniPred;
    // Krok „zajatie“, v ktorom nikto pokus nemá, jadro preskočí v tom istom ťahu — ráta sa
    // preto chvíľa po voľbe cieľa (markery ani cigarety sa pri preskočení nemenia).
    if (volbaPred && s.faza !== "volbaCiela") {
      krokovZajatia++;
      for (const q of [0, 1] as const) {
        if (!s.starsi.some((e) => pokusMozny(e, q))) continue;
        sPodmienkou++;
        stupen3VPartii = true;
        if (s.hraci[q].cigarety >= KONSTANTY.CENA_POKUSU) sPodmienkouACigaretou++;
      }
    }
  }
  kol += s.kolo;
  if (stupen3VPartii) partiiSoStupnom3++;
  najvyssiStupen[maxStupen] = (najvyssiStupen[maxStupen] ?? 0) + 1;
  if (s.koniec?.dovod.includes("tretieho staršieho") === true) vyhierTromiVaznami++;
  console.log(`#${i} ${povahy[0]} vs ${povahy[1]}: kolo ${s.kolo}, najvyšší strach ${maxStupen}, väzňov ${s.vazni.length} — ${s.koniec?.dovod ?? "nedohraná"}`);
}

console.log(`\n${partii} partií (${dlzka}), ${kol} kôl, ${krokovZajatia} krokov „zajatie“ v drafte.`);
console.log(`Starší na stupni 3 v kroku zajatia: ${sPodmienkou}× (hráč × kolo), z toho s cigaretou ${sPodmienkouACigaretou}×; v ${partiiSoStupnom3} partiách z ${partii}.`);
console.log(`Pokusy bota: ${pokusov}, úspešné ${uspechov}; výhra tretím väzňom ${vyhierTromiVaznami}×.`);
console.log(`Najvyšší stupeň strachu v partii (kedykoľvek): ${najvyssiStupen.map((n, st) => `${st}: ${n}`).join(", ")}.`);

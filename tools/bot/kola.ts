// Rozbor partie bota po kolách (Michal 2026-11-06): či šetrí cigarety alebo mu chýbajú, čo berie
// zo šenku a ako dopadne finále.
//
//   node --experimental-strip-types --no-warnings tools/bot/kola.ts [partii] [super] [dlzka] [povaha] [--bot <priečinok>] [--json <súbor>]
//
// super: hromadic | ekonom | budovatel:<priečinok s botom na boj> | chamtivy | nahodny | bot:<povaha> | stary:<priečinok>. --bot <priečinok> = hrdina
// je bot.ts z inej kópie repozitára (rovnaké semienka, rovnaké jadro z tohto stromu). Bot hrá
// striedavo za oboch hráčov ako v turnaj.ts.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { Action, CardInstance, Command, DlzkaHry, GameState, PlayerId } from "../../packages/core/src/index.ts";
import { DLZKY_HRY, apply, evaluateLine, legalCommands, lineState, loadGameData, mozeHrat, naTahu, poskodenieBitky, printedSides, rngInt, rngSeed, setupGame, tahBota } from "../../packages/core/src/index.ts";
import { budovatel, ekonom, hromadic } from "./hromadic.ts";

const citaj = (s: string): unknown => JSON.parse(readFileSync(new URL(`../../packages/core/data/${s}`, import.meta.url), "utf8"));
const data = loadGameData(citaj("cards.json"), citaj("elders.json"), citaj("scorecards.json"));

const args = process.argv.slice(2);
const volba = (nazov: string): string | null => {
  const i = args.indexOf(nazov);
  if (i === -1) return null;
  const v = args[i + 1] ?? null;
  args.splice(i, 2);
  return v;
};
const botDir = volba("--bot");
const jsonSubor = volba("--json");
const partii = Number(args[0] ?? 40);
const superTyp = args[1] ?? "hromadic";
const dlzka = (args[2] ?? "stredna") as DlzkaHry;
const povaha = args[3] ?? "stamgast";

const nacitajBota = async (dir: string): Promise<typeof tahBota> =>
  ((await import(pathToFileURL(resolve(dir, "packages/core/src/bot.ts")).href)) as { tahBota: typeof tahBota }).tahBota;
const hrdina = botDir === null ? tahBota : await nacitajBota(botDir);
const staryBot = superTyp.startsWith("stary:") ? await nacitajBota(superTyp.slice("stary:".length)) : null;
const povahaSupera = superTyp.startsWith("bot:") ? superTyp.slice(4) : null;
const botBudovatela = superTyp.startsWith("budovatel:") ? await nacitajBota(superTyp.slice("budovatel:".length)) : null;

function chamtivy(s: GameState, p: PlayerId, seed: number): Command {
  const cmds = legalCommands(data, s, p);
  const nahodny = cmds[seed % cmds.length] as Command;
  if (s.faza === "pitka" && s.pitkaStav?.reakcia !== p) {
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
  return nahodny;
}

interface NaZaciatkuKola {
  n: number;
  cigarety: number;
  ruka: number;
  balicek: number;
  poldeciPlne: number;
  poldeciVypite: number;
  spaky: number;
  spakySuper: number;
  cigaretySuper: number;
  rukaSuper: number;
}
const noveKolo = (): NaZaciatkuKola => ({ n: 0, cigarety: 0, ruka: 0, balicek: 0, poldeciPlne: 0, poldeciVypite: 0, spaky: 0, spakySuper: 0, cigaretySuper: 0, rukaSuper: 0 });
const kola = new Map<number, NaZaciatkuKola>();

/** Cigarety minuté podľa typu ťahu, po kolách. */
const minute = new Map<number, Map<string, number>>();
/** Čo bot berie zo šenku: karty podľa toho, či sú tuhé (väčšina akcií Rana/Pecka/Petelica). */
const TUHE: ReadonlySet<Action> = new Set<Action>(["Rana", "Pecka", "Petelica"]);
let ponukaAkcii = 0;
let ponukaTuhych = 0;
let vzatychKariet = 0;
let vzatychTuhych = 0;
let akciiVzatych = 0;
let akciiTuhych = 0;
const akcieVzate = new Map<string, number>();
function zapisKartu(karta: CardInstance): void {
  const strany = printedSides(data, karta);
  const akcie = [...strany.left, ...strany.right].filter((x): x is Action => x !== null);
  const tuhe = akcie.filter((x) => TUHE.has(x)).length;
  vzatychKariet++;
  akciiVzatych += akcie.length;
  akciiTuhych += tuhe;
  if (akcie.length > 0 && tuhe * 2 >= akcie.length) vzatychTuhych++;
  for (const a of akcie) akcieVzate.set(a, (akcieVzate.get(a) ?? 0) + 1);
}

let vyhry = 0;
let prehry = 0;
let remizy = 0;
let bodyBot = 0;
let bodySuper = 0;
const dovody = new Map<string, number>();
interface Finale {
  dohrane: number;
  bitkyVyhral: number;
  spakyZaFinaleBot: number;
  spakyZaFinaleSuper: number;
  cigaretyNaKonci: number;
  cigaretyNaKonciSuper: number;
  rukaNaKonci: number;
  nakladackaBot: number;
  nakladackaSuper: number;
  vediPredFinale: number;
  vediPredFinaleVyhral: number;
  zaostavaPredFinale: number;
  zaostavaPredFinaleVyhral: number;
  bitkyVyhralPredFinale: number;
  bitkyPredFinale: number;
}
const f: Finale = { dohrane: 0, bitkyVyhral: 0, spakyZaFinaleBot: 0, spakyZaFinaleSuper: 0, cigaretyNaKonci: 0, cigaretyNaKonciSuper: 0, rukaNaKonci: 0, nakladackaBot: 0, nakladackaSuper: 0, vediPredFinale: 0, vediPredFinaleVyhral: 0, zaostavaPredFinale: 0, zaostavaPredFinaleVyhral: 0, bitkyVyhralPredFinale: 0, bitkyPredFinale: 0 };

let pitiek = 0;
let prazdnychPitiek = 0;
let cigaretyZaPas = 0;
let cigaretyInak = 0;
let aktivnychCigariet = 0;
let aktivnychVizii = 0;
let vylozenych = 0;
let casBota = 0;
let cpuBota = 0;
let najdlhsiCpu = 0;
let tahovBota = 0;
let najdlhsi = 0;
const typy = new Map<string, number>();

for (let i = 0; i < partii; i++) {
  const botSeat: PlayerId = i % 2 === 0 ? 0 : 1;
  const su: PlayerId = botSeat === 0 ? 1 : 0;
  let s: GameState = setupGame(data, 1000 + i, { lokalit: DLZKY_HRY[dlzka] });
  let rng = rngSeed(77 + i);
  let posledneKolo = -1;
  let predFinale: { ja: number; on: number } | null = null;
  for (let krok = 0; s.koniec === null && krok < 20000; krok++) {
    if (s.kolo !== posledneKolo) {
      posledneKolo = s.kolo;
      const k = kola.get(s.kolo) ?? noveKolo();
      const h = s.hraci[botSeat];
      const o = s.hraci[su];
      k.n++;
      k.cigarety += h.cigarety;
      k.ruka += h.ruka.length;
      k.balicek += h.doberaci.length + h.odhadzovaci.length;
      k.poldeciPlne += h.poldeciPlne;
      k.poldeciVypite += h.poldeciVypite;
      k.spaky += s.spaky[botSeat];
      k.spakySuper += s.spaky[su];
      k.cigaretySuper += o.cigarety;
      k.rukaSuper += o.ruka.length;
      kola.set(s.kolo, k);
    }
    const p = ([0, 1] as const).find((q) => mozeHrat(s, q)) ?? naTahu(s);
    if (p === null) break;
    const [seed, r] = rngInt(rng, 2 ** 31);
    rng = r;
    let cmd: Command;
    if (p === botSeat) {
      const c0 = process.cpuUsage();
      const t0 = performance.now();
      cmd = hrdina(data, s, p, seed, { povaha });
      const dt = performance.now() - t0;
      casBota += dt;
      const c1 = process.cpuUsage(c0);
      cpuBota += (c1.user + c1.system) / 1000;
      najdlhsiCpu = Math.max(najdlhsiCpu, (c1.user + c1.system) / 1000);
      tahovBota++;
      najdlhsi = Math.max(najdlhsi, dt);
      const typ = cmd.type === "place" ? `place:${cmd.target}` : cmd.type;
      typy.set(typ, (typy.get(typ) ?? 0) + 1);
      if (cmd.type === "draftBer") {
        const uids = cmd.uids;
        for (const k of s.senok) {
          const st = printedSides(data, k);
          const ak = [...st.left, ...st.right].filter((x): x is Action => x !== null);
          ponukaAkcii += ak.length;
          ponukaTuhych += ak.filter((x) => TUHE.has(x)).length;
        }
        for (const k of s.senok) if (uids.includes(k.uid)) zapisKartu(k);
      }
    } else if (staryBot !== null) {
      cmd = staryBot(data, s, p, seed, { povaha });
    } else if (povahaSupera !== null) {
      cmd = hrdina(data, s, p, seed, { povaha: povahaSupera });
    } else if (superTyp === "hromadic") {
      cmd = hromadic(data, s, p, seed);
    } else if (botBudovatela !== null) {
      cmd = budovatel(data, s, p, seed, botBudovatela);
    } else if (superTyp === "ekonom") {
      cmd = ekonom(data, s, p, seed);
    } else if (superTyp === "chamtivy") {
      cmd = chamtivy(s, p, seed);
    } else {
      const cmds = legalCommands(data, s, p);
      cmd = cmds[seed % cmds.length] as Command;
    }
    if ((cmd.type === "place" && (cmd.target === "vlastna" || cmd.target === "superova")) || cmd.type === "zaverecna") {
      if (p === botSeat) vylozenych++;
    }
    const bolFinale = s.ciel?.typ === "finale";
    const pitkaPred = s.faza === "pitka" ? s.pitkaCislo : -1;
    const sumyPred = s.faza === "pitka" ? evaluateLine(data, lineState(s)).sums[botSeat] : null;
    const cigPred = s.hraci[botSeat].cigarety;
    const koloPred = s.kolo;
    const finalePred = bolFinale ? null : s;
    s = apply(data, s, cmd, p).state;
    if (s.faza === "pitka" && s.pitkaCislo !== pitkaPred && s.pitkaStav !== null) {
      pitiek++;
      if (s.hraci[botSeat].ruka.length === 0 && s.hraci[botSeat].cigarety === 0) prazdnychPitiek++;
    }
    if (sumyPred !== null && (s.faza !== "pitka" || s.pitkaCislo !== pitkaPred)) {
      aktivnychCigariet += sumyPred.Cigareta ?? 0;
      aktivnychVizii += sumyPred["Vízia"] ?? 0;
    }
    if (s.hraci[botSeat].cigarety > cigPred) {
      if (cmd.type === "pass" && p === botSeat) cigaretyZaPas += s.hraci[botSeat].cigarety - cigPred;
      else cigaretyInak += s.hraci[botSeat].cigarety - cigPred;
    }
    if (p === botSeat && s.hraci[botSeat].cigarety < cigPred) {
      const mapa = minute.get(koloPred) ?? new Map<string, number>();
      mapa.set(cmd.type, (mapa.get(cmd.type) ?? 0) + cigPred - s.hraci[botSeat].cigarety);
      minute.set(koloPred, mapa);
    }
    if (finalePred !== null && s.ciel?.typ === "finale" && predFinale === null) predFinale = { ja: s.spaky[botSeat], on: s.spaky[su] };
  }
  const k = s.koniec;
  if (k === null) {
    console.log(`#${i}: nedohraná (kolo ${s.kolo}, ${s.faza})`);
    continue;
  }
  if (k.vitaz === botSeat) vyhry++;
  else if (k.vitaz === null) remizy++;
  else prehry++;
  if (k.body !== null) {
    bodyBot += k.body[botSeat];
    bodySuper += k.body[su];
  }
  const vysledok = k.vitaz === botSeat ? "výhra" : k.vitaz === null ? "remíza" : "prehra";
  const dovod = `${vysledok}: ${/strachom/.test(k.dovod) ? "strachom" : /väzň/.test(k.dovod) ? "väzňami" : /finále/.test(k.dovod) ? "po finále" : k.dovod}`;
  dovody.set(dovod, (dovody.get(dovod) ?? 0) + 1);
  const nastenka = s.nastenka;
  const predFinaleBitky = nastenka.filter((b) => !b.finale);
  f.bitkyPredFinale += predFinaleBitky.length;
  f.bitkyVyhralPredFinale += predFinaleBitky.filter((b) => b.vitaz === botSeat).length;
  const fin = nastenka.find((b) => b.finale);
  if (fin !== undefined && predFinale !== null) {
    f.dohrane++;
    if (fin.vitaz === botSeat) f.bitkyVyhral++;
    f.cigaretyNaKonci += s.hraci[botSeat].cigarety;
    f.cigaretyNaKonciSuper += s.hraci[su].cigarety;
    f.rukaNaKonci += s.hraci[botSeat].ruka.length;
    if (k.body !== null) {
      f.spakyZaFinaleBot += k.body[botSeat] - predFinale.ja;
      f.spakyZaFinaleSuper += k.body[su] - predFinale.on;
    }
    if (predFinale.ja > predFinale.on) {
      f.vediPredFinale++;
      if (k.vitaz === botSeat) f.vediPredFinaleVyhral++;
    } else if (predFinale.ja < predFinale.on) {
      f.zaostavaPredFinale++;
      if (k.vitaz === botSeat) f.zaostavaPredFinaleVyhral++;
    }
  }
}

const c = (x: number, n: number): string => (n === 0 ? "—" : (x / n).toFixed(1));
console.log(`\nBot ${povaha}${botDir === null ? "" : ` (${botDir})`} proti „${superTyp}“, ${dlzka}: ${vyhry} výhier, ${prehry} prehier, ${remizy} remíz z ${partii}. Body ${bodyBot}:${bodySuper}.`);
console.log(`Ťahy ${tahovBota}, priemer ${(casBota / Math.max(1, tahovBota)).toFixed(1)} ms (CPU ${(cpuBota / Math.max(1, tahovBota)).toFixed(1)} ms), najdlhší ${najdlhsi.toFixed(0)} ms (CPU ${najdlhsiCpu.toFixed(0)} ms).`);
for (const [d, n] of dovody) console.log(`  ${n}× ${d}`);
console.log("\nkolo |   n | cig ruka balík plné vypité | špaky | súper cig ruka špaky | minuté cigarety");
for (const [nk, k] of [...kola].sort((a, b) => a[0] - b[0])) {
  const m = [...(minute.get(nk) ?? [])].sort((a, b) => b[1] - a[1]).map(([t, x]) => `${t} ${c(x, k.n)}`).join(", ");
  console.log(
    `${String(nk).padStart(4)} | ${String(k.n).padStart(3)} | ${c(k.cigarety, k.n).padStart(4)} ${c(k.ruka, k.n).padStart(4)} ${c(k.balicek, k.n).padStart(5)} ${c(k.poldeciPlne, k.n).padStart(4)} ${c(k.poldeciVypite, k.n).padStart(6)} | ${c(k.spaky, k.n).padStart(5)} | ${c(k.cigaretySuper, k.n).padStart(9)} ${c(k.rukaSuper, k.n).padStart(4)} ${c(k.spakySuper, k.n).padStart(5)} | ${m}`,
  );
}
console.log(
  `\nZo šenku: ${vzatychKariet} kariet, tuhých kariet ${vzatychKariet === 0 ? 0 : ((100 * vzatychTuhych) / vzatychKariet).toFixed(0)} %, tuhých akcií ${akciiVzatych === 0 ? 0 : ((100 * akciiTuhych) / akciiVzatych).toFixed(0)} % (v ponuke šenku ${ponukaAkcii === 0 ? 0 : ((100 * ponukaTuhych) / ponukaAkcii).toFixed(0)} %).`,
);
console.log(`Akcie vzatých kariet: ${[...akcieVzate].sort((a, b) => b[1] - a[1]).map(([a, n]) => `${a} ${n}`).join(", ")}`);
console.log(
  `Finále: dohrané ${f.dohrane}, bitku vyhral ${f.bitkyVyhral}; špaky z finále a výkupného bot ${c(f.spakyZaFinaleBot, f.dohrane)}, súper ${c(f.spakyZaFinaleSuper, f.dohrane)}; cigarety na konci bot ${c(f.cigaretyNaKonci, f.dohrane)}, súper ${c(f.cigaretyNaKonciSuper, f.dohrane)}; ruka na konci ${c(f.rukaNaKonci, f.dohrane)}.`,
);
console.log(
  `Pred finále: bitky vyhral ${f.bitkyVyhralPredFinale}/${f.bitkyPredFinale}; viedol ${f.vediPredFinale} (partiu vyhral ${f.vediPredFinaleVyhral}), zaostával ${f.zaostavaPredFinale} (vyhral ${f.zaostavaPredFinaleVyhral}).`,
);
console.log(
  `Na partiu: Pitiek ${c(pitiek, partii)}, s prázdnou rukou a 0 cigaretami ${c(prazdnychPitiek, partii)} (${pitiek === 0 ? 0 : ((100 * prazdnychPitiek) / pitiek).toFixed(0)} %); cigarety za pas ${c(cigaretyZaPas, partii)}, inak ${c(cigaretyInak, partii)}; aktívne Cigarety ${c(aktivnychCigariet, partii)}, Vízie ${c(aktivnychVizii, partii)}; kariet vyložených ${c(vylozenych, partii)}, zo šenku ${c(vzatychKariet, partii)}.`,
);
console.log(`Ťahy podľa typu: ${[...typy].sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t} ${n}`).join(", ")}`);
if (jsonSubor !== null) {
  mkdirSync(dirname(jsonSubor), { recursive: true });
  writeFileSync(jsonSubor, JSON.stringify({ povaha, superTyp, dlzka, partii, vyhry, prehry, remizy, bodyBot, bodySuper, kola: Object.fromEntries(kola), minute: Object.fromEntries([...minute].map(([x, m]) => [x, Object.fromEntries(m)])), finale: f, vzatychKariet, vzatychTuhych, akciiVzatych, akciiTuhych, priemerMs: casBota / Math.max(1, tahovBota), cpuMs: cpuBota / Math.max(1, tahovBota), najdlhsiMs: najdlhsi }, null, 1));
}

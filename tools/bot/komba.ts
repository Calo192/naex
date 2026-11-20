// Telemetria komb — koľko z akcií na kartách sa v bitke naozaj ráta a ako veľké sú násobky.
//
//   node --experimental-strip-types --no-warnings tools/bot/komba.ts [partii] [dlzka] [--json <súbor>]
//
// Odohrá partie bot proti botovi (všetky povahy striedavo, pevné semienka) a pri každej bitke
// zmeria líniu: koľko kariet v nej leží, koľko slotov s akciou je aktívnych, neaktívnych a zrušených,
// aké násobky dosiahli, ako často vznikla Forsáž, Vzbura, NA EX, Výtržník, podložený Nástroj,
// akcie navyše a Preškolenie. Podklad pre návrhy, ktoré majú kombá zväčšiť: bez merania sa nedá
// povedať, či kombá chýbajú preto, že ich hra nedovolí, alebo preto, že sa ťažko skladajú.

import { writeFileSync } from "node:fs";
import { readFileSync } from "node:fs";
import type { Command, DlzkaHry, GameState, PlayerId } from "../../packages/core/src/index.ts";
import { DLZKY_HRY, POVAHY, apply, evaluateLine, lineState, loadGameData, mozeHrat, naTahu, rngInt, rngSeed, setupGame, tahBota } from "../../packages/core/src/index.ts";

const citaj = (s: string): unknown => JSON.parse(readFileSync(new URL(`../../packages/core/data/${s}`, import.meta.url), "utf8"));
const data = loadGameData(citaj("cards.json"), citaj("elders.json"), citaj("scorecards.json"));

const args = process.argv.slice(2);
const jsonI = args.indexOf("--json");
const jsonSubor = jsonI === -1 ? null : (args[jsonI + 1] ?? null);
if (jsonI !== -1) args.splice(jsonI, 2);
const partii = Number(args[0] ?? 40);
const dlzka = (args[1] ?? "stredna") as DlzkaHry;

const MODIFIKATORY = new Set(["Posilnenie", "Odpor", "Pakt"]);
const TUHE: Readonly<Record<string, number>> = { Rana: 1, Pecka: 2, Petelica: 3 };

interface Bitka {
  kolo: number;
  finale: boolean;
  kariet: number;
  karietHraca: [number, number];
  sloty: number;
  aktivne: number;
  neaktivne: number;
  zrusene: number;
  modifikatory: number;
  maxNasobok: number;
  nasobky: Record<string, number>;
  forsaz: number;
  vzbura: number;
  naex: number;
  vytrznik: number;
  podlozene: number;
  navyse: number;
  preskolene: number;
  dedicstvo: [number, number];
  tuhe: [number, number];
  makke: [number, number];
  /** Najväčší príspevok tuhého jednej karty a jeho podiel na tuhom jej majiteľa. */
  topKarta: number;
  topKartaDef: string;
  pitiek: number;
  vitaz: PlayerId | null;
  /** Línia pri bitke (verejná) — na rozbory spojov bez opakovania partií. */
  linia: {
    lok: string | null;
    otocena: boolean;
    strany: { d: string; l: number; r: number; by: PlayerId; naex?: PlayerId; pod?: string[] }[][];
  };
}

const bitky: Bitka[] = [];
const prikazy = new Map<string, number>();
const kroky: number[] = [];
const dovody = new Map<string, number>();
const spaky: [number, number][] = [];
let pitiekVKole = 0;

for (let i = 0; i < partii; i++) {
  const povahy = [POVAHY[i % POVAHY.length], POVAHY[(i + 1 + Math.floor(i / POVAHY.length)) % POVAHY.length]].map((p) => p?.id);
  let s: GameState = setupGame(data, 7000 + i, { lokalit: DLZKY_HRY[dlzka] });
  let rng = rngSeed(1300 + i);
  let n = 0;
  pitiekVKole = 0;
  for (; s.koniec === null && n < 20000; n++) {
    const p: PlayerId | null = ([0, 1] as const).find((q) => mozeHrat(s, q)) ?? naTahu(s);
    if (p === null) break;
    const [seed, r] = rngInt(rng, 2 ** 31);
    rng = r;
    const cmd: Command = tahBota(data, s, p, seed, { povaha: povahy[p] });
    const zoznam = cmd.type === "tah" ? cmd.kroky : [cmd];
    for (const c of zoznam) prikazy.set(c.type, (prikazy.get(c.type) ?? 0) + 1);
    const pred = s;
    const vysledok = apply(data, s, cmd, p);
    s = vysledok.state;
    for (const e of vysledok.events) {
      if (e.type === "pitkaVysledok") pitiekVKole++;
      if (e.type !== "bitkaVysledok") continue;
      const strany = e.strany ?? pred.strany;
      const line = { ...lineState(pred), strany };
      const ev = evaluateLine(data, line);
      const b: Bitka = {
        kolo: pred.kolo,
        finale: pred.kolo > DLZKY_HRY[dlzka],
        kariet: strany[0].length + strany[1].length,
        karietHraca: [0, 0],
        sloty: 0,
        aktivne: 0,
        neaktivne: 0,
        zrusene: 0,
        modifikatory: 0,
        maxNasobok: 0,
        nasobky: {},
        forsaz: 0,
        vzbura: 0,
        naex: 0,
        vytrznik: 0,
        podlozene: 0,
        navyse: 0,
        preskolene: 0,
        dedicstvo: [pred.hraci[0].dedicstvo.length, pred.hraci[1].dedicstvo.length],
        tuhe: [e.damage.tuhe[0], e.damage.tuhe[1]],
        makke: [e.damage.makke[0], e.damage.makke[1]],
        topKarta: 0,
        topKartaDef: "",
        pitiek: pitiekVKole,
        vitaz: e.vitaz,
        linia: {
          lok: line.lokalita?.defId ?? null,
          otocena: line.lokalitaOtocena,
          strany: strany.map((kraj) =>
            kraj.map((pl) => ({
              d: pl.card.defId,
              l: pl.card.leftLayout,
              r: pl.card.rightLayout,
              by: pl.playedBy,
              ...(pl.naexBy === undefined ? {} : { naex: pl.naexBy }),
              ...(pl.podlozene === undefined || pl.podlozene.length === 0 ? {} : { pod: pl.podlozene.map((n) => `${n.card.defId}:${n.hrana}`) }),
            })),
          ),
        },
      };
      pitiekVKole = 0;
      for (const pl of [...strany[0], ...strany[1]]) {
        b.karietHraca[pl.playedBy]++;
        if (pl.naexBy !== undefined) b.naex++;
        if (pl.vytrznik === true) b.vytrznik++;
        b.podlozene += pl.podlozene?.length ?? 0;
        const ce = ev.cards.get(pl.card.uid);
        if (ce === undefined) continue;
        if (ce.forsaz) b.forsaz++;
        if (ce.vzbura) b.vzbura++;
        if ((ce.preskolena?.length ?? 0) > 0) b.preskolene++;
        let tuheKarty = 0;
        for (const slot of [...ce.left, ...ce.right]) {
          if (slot === null) continue;
          if (MODIFIKATORY.has(slot.action)) {
            b.modifikatory++;
            continue;
          }
          b.sloty++;
          if (slot.stav === "aktivna" && slot.nasobok > 0) {
            b.aktivne++;
            b.maxNasobok = Math.max(b.maxNasobok, slot.nasobok);
            const k = `x${slot.nasobok}`;
            b.nasobky[k] = (b.nasobky[k] ?? 0) + 1;
            tuheKarty += (TUHE[slot.ako ?? slot.action] ?? 0) * slot.nasobok;
          } else if (slot.stav === "zrusena") b.zrusene++;
          else b.neaktivne++;
        }
        for (const nv of ce.navyse ?? []) {
          if (nv.krat <= 0) continue;
          b.navyse += nv.krat;
          nv.akcie.forEach((a0, j) => {
            tuheKarty += (TUHE[nv.ako?.[j] ?? a0] ?? 0) * nv.krat * (nv.nasobok?.[j] ?? 1);
          });
        }
        if (tuheKarty > b.topKarta) {
          b.topKarta = tuheKarty;
          b.topKartaDef = pl.card.defId;
        }
      }
      bitky.push(b);
    }
  }
  kroky.push(n);
  const k = s.koniec;
  const dovod = k === null ? "nedohraná" : (k.dovod ?? "").replace(/Hráč \d/g, "Hráč").replace(/\d+/g, "N").slice(0, 60);
  dovody.set(dovod, (dovody.get(dovod) ?? 0) + 1);
  spaky.push([s.spaky[0], s.spaky[1]]);
}

const priemer = (xs: readonly number[]): number => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length);
const fmt = (x: number): string => x.toFixed(2);
const kvantil = (xs: readonly number[], q: number): number => {
  const z = [...xs].sort((a, b) => a - b);
  return z[Math.min(z.length - 1, Math.floor(q * z.length))] ?? 0;
};
const podiel = (f: (b: Bitka) => boolean): string => `${((100 * bitky.filter(f).length) / bitky.length).toFixed(1)} %`;

const sloty = bitky.reduce((a, b) => a + b.sloty, 0);
const aktivne = bitky.reduce((a, b) => a + b.aktivne, 0);
const neaktivne = bitky.reduce((a, b) => a + b.neaktivne, 0);
const zrusene = bitky.reduce((a, b) => a + b.zrusene, 0);
const nasobky: Record<string, number> = {};
for (const b of bitky) for (const [k, v] of Object.entries(b.nasobky)) nasobky[k] = (nasobky[k] ?? 0) + v;

console.log(`PARTIÍ ${partii} (${dlzka}), BITIEK ${bitky.length}, krokov na partiu ${fmt(priemer(kroky))}`);
console.log(`karty v línii pri bitke: priemer ${fmt(priemer(bitky.map((b) => b.kariet)))}, medián ${kvantil(bitky.map((b) => b.kariet), 0.5)}, p90 ${kvantil(bitky.map((b) => b.kariet), 0.9)}, max ${Math.max(...bitky.map((b) => b.kariet))}`);
console.log(`Pitiek na kolo: priemer ${fmt(priemer(bitky.map((b) => b.pitiek)))}, podiel kôl s 1 Pitkou ${podiel((b) => b.pitiek <= 1)}`);
console.log(`sloty s akciou na kartách v línii: ${sloty} — aktívne ${((100 * aktivne) / sloty).toFixed(1)} %, neaktívne ${((100 * neaktivne) / sloty).toFixed(1)} %, zrušené ${((100 * zrusene) / sloty).toFixed(1)} %`);
console.log(`násobky aktívnych slotov: ${Object.entries(nasobky).sort().map(([k, v]) => `${k} ${((100 * v) / aktivne).toFixed(1)} %`).join(", ")}`);
console.log(`najväčší násobok v bitke: priemer ${fmt(priemer(bitky.map((b) => b.maxNasobok)))}; bitky s ×4 a viac ${podiel((b) => b.maxNasobok >= 4)}, s ×8 a viac ${podiel((b) => b.maxNasobok >= 8)}`);
console.log(`bitky s Forsážou ${podiel((b) => b.forsaz > 0)}, so Vzburou ${podiel((b) => b.vzbura > 0)}, s NA EX ${podiel((b) => b.naex > 0)}, s Výtržníkom ${podiel((b) => b.vytrznik > 0)}`);
console.log(`bitky s podloženým Nástrojom ${podiel((b) => b.podlozene > 0)}, s akciou navyše ${podiel((b) => b.navyse > 0)}, s Preškolením ${podiel((b) => b.preskolene > 0)}`);
console.log(`Dedičstvo na hráča pri bitke: priemer ${fmt(priemer(bitky.flatMap((b) => b.dedicstvo)))}`);
console.log(`tuhé na hráča: priemer ${fmt(priemer(bitky.flatMap((b) => b.tuhe)))}, p90 ${kvantil(bitky.flatMap((b) => b.tuhe), 0.9)}, max ${Math.max(...bitky.flatMap((b) => b.tuhe))}; rozdiel tuhého priemer ${fmt(priemer(bitky.map((b) => Math.abs(b.tuhe[0] - b.tuhe[1]))))}`);
console.log(`mäkké na hráča: priemer ${fmt(priemer(bitky.flatMap((b) => b.makke)))}, max ${Math.max(...bitky.flatMap((b) => b.makke))}`);
console.log(`najsilnejšia karta bitky (tuhé): priemer ${fmt(priemer(bitky.map((b) => b.topKarta)))}, p90 ${kvantil(bitky.map((b) => b.topKarta), 0.9)}, max ${Math.max(...bitky.map((b) => b.topKarta))}`);
const top = new Map<string, number>();
for (const b of bitky) if (b.topKartaDef !== "") top.set(b.topKartaDef, (top.get(b.topKartaDef) ?? 0) + 1);
console.log(`najčastejšia najsilnejšia karta: ${[...top].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k} ${v}`).join(", ")}`);
console.log("po kolách (karty v línii / aktívne sloty / max násobok / tuhé na hráča):");
for (const kolo of [...new Set(bitky.map((b) => b.kolo))].sort((a, b) => a - b)) {
  const bk = bitky.filter((b) => b.kolo === kolo);
  console.log(`  kolo ${kolo}: ${fmt(priemer(bk.map((b) => b.kariet)))} / ${fmt(priemer(bk.map((b) => b.aktivne)))} / ${fmt(priemer(bk.map((b) => b.maxNasobok)))} / ${fmt(priemer(bk.flatMap((b) => b.tuhe)))}  (${bk.length} bitiek)`);
}
console.log(`príkazy na partiu: ${[...prikazy].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${fmt(v / partii)}`).join(", ")}`);
console.log(`konce: ${[...dovody].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${v}× ${k}`).join(" | ")}`);
console.log(`špaky: víťaz priemer ${fmt(priemer(spaky.map(([a, b]) => Math.max(a, b))))}, porazený ${fmt(priemer(spaky.map(([a, b]) => Math.min(a, b))))}`);

if (jsonSubor !== null) writeFileSync(jsonSubor, JSON.stringify({ partii, dlzka, bitky, prikazy: Object.fromEntries(prikazy), kroky, spaky }));

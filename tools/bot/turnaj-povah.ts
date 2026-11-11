// Turnaj povah offline protihráča — každá proti každej, so štatistikami štýlu.
//
//   node --experimental-strip-types --no-warnings tools/bot/turnaj-povah.ts [partii] [dlzka] [povaha…]
//
// partii = partií na dvojicu (predvolene 10, sedadlá sa striedajú), dlzka = kratka | stredna | dlha,
// povahy predvolene igor rudo bozena darina (Michal 2026-11-03). Dvojice bežia najviac
// v NAEX_VLAKNA vláknach (predvolene 4, limit z docs/SESSIONS.md). Okrem výhier vypíše, či povaha
// hrá svoj štýl: tuhé a mäkké poškodenie, cigarety, Vízie, karty vo finále, nalievanie poldeci,
// Viera a Povery, špaky od starších aj v prehratých bitkách, NA EX, Dlhy a pečeň súpera.

import { readFileSync } from "node:fs";
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import type { Command, DlzkaHry, GameState, PlayerId } from "../../packages/core/src/index.ts";
import { DLZKY_HRY, POVAHY, apply, jeFinale, loadGameData, mozeHrat, naTahu, rngInt, rngSeed, setupGame, tahBota } from "../../packages/core/src/index.ts";

const citaj = (s: string): unknown => JSON.parse(readFileSync(new URL(`../../packages/core/data/${s}`, import.meta.url), "utf8"));
const data = loadGameData(citaj("cards.json"), citaj("elders.json"), citaj("scorecards.json"));

const nova = () => ({
  partie: 0, vyhry: 0, remizy: 0, body: 0, bitky: 0, bitkyVyhrane: 0, tuhe: 0, makke: 0, viera: 0, povery: 0,
  cigaretyZiskane: 0, cigaretyNaKonci: 0, vizie: 0, fajcenia: 0, bartery: 0, poldeciNajviac: 0,
  kartyPredFinale: 0, kartyVoFinale: 0, rukaPredFinale: 0, naexVlastne: 0, naexSuperove: 0,
  dlhySupera: 0, pecenSupera: 0, cirhozySupera: 0, zaStarsich: 0, zaStarsichPrehra: 0, vyhraStrachom: 0, tahy: 0, ms: 0, najdlhsi: 0,
});
type Stat = ReturnType<typeof nova>;

interface Zadanie {
  readonly pa: string;
  readonly pb: string;
  readonly partii: number;
  readonly dlzka: DlzkaHry;
}
interface Vysledok {
  readonly zadanie: Zadanie;
  readonly a: Stat;
  readonly b: Stat;
}

function partia(seed: number, sedadla: readonly [string, string], st: readonly [Stat, Stat], dlzka: DlzkaHry): void {
  let s: GameState = setupGame(data, seed, { lokalit: DLZKY_HRY[dlzka] });
  let rng = rngSeed(77 + seed);
  let vFinale = false;
  let bitkaKola = -1;
  const najviac = [0, 0];
  for (let krok = 0; s.koniec === null && krok < 20000; krok++) {
    const p = ([0, 1] as const).find((q) => mozeHrat(s, q)) ?? naTahu(s);
    if (p === null) break;
    const [nah, r] = rngInt(rng, 2 ** 31);
    rng = r;
    const t0 = performance.now();
    const cmd: Command = tahBota(data, s, p, nah, { povaha: sedadla[p] });
    const ms = performance.now() - t0;
    st[p].tahy++;
    st[p].ms += ms;
    st[p].najdlhsi = Math.max(st[p].najdlhsi, ms);
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
    if (cmd.type === "smoke") st[p].fajcenia++;
    if (cmd.type === "barter") st[p].bartery++;
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
      najviac[q] = Math.max(najviac[q] ?? 0, s.hraci[q].poldeciPlne + s.hraci[q].poldeciVypite);
    }
    const b = s.bitkaStav;
    if (b !== null && b.damage !== null && bitkaKola !== s.kolo) {
      bitkaKola = s.kolo;
      for (const q of [0, 1] as const) {
        const su: PlayerId = q === 0 ? 1 : 0;
        st[q].bitky++;
        st[q].tuhe += b.damage.tuhe[q];
        st[q].makke += b.damage.makke[q];
        st[q].viera += b.sums[q].Viera ?? 0;
        st[q].povery += b.sums[q].Povera ?? 0;
        if (b.damage.tuhe[q] > b.damage.tuhe[su]) st[q].bitkyVyhrane++;
      }
    }
  }
  const k = s.koniec;
  if (k === null) return;
  for (const q of [0, 1] as const) {
    st[q].partie++;
    if (k.vitaz === q) st[q].vyhry++;
    else if (k.vitaz === null) st[q].remizy++;
    if (k.body !== null) st[q].body += k.body[q];
    st[q].cigaretyNaKonci += s.hraci[q].cigarety;
    st[q].poldeciNajviac += najviac[q] ?? 0;
    for (const z of s.nastenka) {
      st[q].zaStarsich += z.zaStarsich[q];
      if (z.vitaz !== null && z.vitaz !== q) st[q].zaStarsichPrehra += z.zaStarsich[q];
    }
    if (k.vitaz === q && k.dovod.includes("strachom")) st[q].vyhraStrachom++;
  }
}

function dvojica(z: Zadanie): Vysledok {
  const a = nova();
  const b = nova();
  for (let i = 0; i < z.partii; i++) {
    if (i % 2 === 0) partia(1000 + i, [z.pa, z.pb], [a, b], z.dlzka);
    else partia(1000 + i, [z.pb, z.pa], [b, a], z.dlzka);
  }
  return { zadanie: z, a, b };
}

function pridaj(kam: Stat, co: Stat): void {
  const k = kam as Record<string, number>;
  for (const [kluc, v] of Object.entries(co)) k[kluc] = kluc === "najdlhsi" ? Math.max(k[kluc] ?? 0, v) : (k[kluc] ?? 0) + v;
}

function n(x: number, d: number): string {
  return d === 0 ? "–" : (x / d).toFixed(1);
}

async function hlavny(): Promise<void> {
  const partii = Number(process.argv[2] ?? 10);
  const dlzka = (process.argv[3] ?? "stredna") as DlzkaHry;
  const povahy = process.argv.length > 4 ? process.argv.slice(4) : ["igor", "rudo", "bozena", "darina"];
  for (const id of povahy) if (!POVAHY.some((p) => p.id === id)) throw new Error(`Neznáma povaha ${id} (${POVAHY.map((p) => p.id).join(", ")}).`);
  const vlakna = Number(process.env.NAEX_VLAKNA ?? 4);

  const fronta: Zadanie[] = [];
  for (let a = 0; a < povahy.length; a++) {
    for (let b = a + 1; b < povahy.length; b++) fronta.push({ pa: povahy[a] as string, pb: povahy[b] as string, partii, dlzka });
  }
  const staty = new Map(povahy.map((id) => [id, nova()] as const));

  const t0 = performance.now();
  const robotnik = async (): Promise<void> => {
    for (let z = fronta.shift(); z !== undefined; z = fronta.shift()) {
      const zadanie = z;
      const v = await new Promise<Vysledok>((hotovo, chyba) => {
        const w = new Worker(new URL(import.meta.url), { workerData: zadanie });
        w.once("message", hotovo);
        w.once("error", chyba);
      });
      pridaj(staty.get(v.zadanie.pa) as Stat, v.a);
      pridaj(staty.get(v.zadanie.pb) as Stat, v.b);
      const rem = v.a.partie - v.a.vyhry - v.b.vyhry;
      console.log(`${v.zadanie.pa} – ${v.zadanie.pb}: ${v.a.vyhry} : ${v.b.vyhry}${rem > 0 ? ` (${rem} remíza)` : ""}   body ${n(v.a.body, v.a.partie)} : ${n(v.b.body, v.b.partie)}`);
    }
  };
  await Promise.all(Array.from({ length: vlakna }, robotnik));

  console.log(`\nŠtatistiky štýlu (priemer na partiu, poškodenie a Viera/Povery na bitku), ${dlzka}, ${((performance.now() - t0) / 1000).toFixed(0)} s:`);
  const riadky: [string, (s: Stat) => string][] = [
    ["výhry", (s) => `${s.vyhry}/${s.partie}`],
    ["body (špaky)", (s) => n(s.body, s.partie)],
    ["bitky vyhrané v tuhom", (s) => `${s.bitkyVyhrane}/${s.bitky}`],
    ["tuhé na bitku", (s) => n(s.tuhe, s.bitky)],
    ["mäkké na bitku", (s) => n(s.makke, s.bitky)],
    ["Viera na bitku", (s) => n(s.viera, s.bitky)],
    ["Povery na bitku", (s) => n(s.povery, s.bitky)],
    ["špaky od starších", (s) => n(s.zaStarsich, s.partie)],
    ["  z toho v prehratých bitkách", (s) => n(s.zaStarsichPrehra, s.partie)],
    ["cigarety získané", (s) => n(s.cigaretyZiskane, s.partie)],
    ["cigarety na konci", (s) => n(s.cigaretyNaKonci, s.partie)],
    ["fajčenia", (s) => n(s.fajcenia, s.partie)],
    ["Vízie vzaté", (s) => n(s.vizie, s.partie)],
    ["karty vyložené pred finále", (s) => n(s.kartyPredFinale, s.partie)],
    ["karty vo finále", (s) => n(s.kartyVoFinale, s.partie)],
    ["ruka pred finále", (s) => n(s.rukaPredFinale, s.partie)],
    ["bartery (nový poldeci)", (s) => n(s.bartery, s.partie)],
    ["najviac poldeci naraz", (s) => n(s.poldeciNajviac, s.partie)],
    ["NA EX na vlastné karty", (s) => n(s.naexVlastne, s.partie)],
    ["NA EX na súperove karty", (s) => n(s.naexSuperove, s.partie)],
    ["Dlhy súpera", (s) => n(s.dlhySupera, s.partie)],
    ["pečeň súpera", (s) => n(s.pecenSupera, s.partie)],
    ["Cirhózy súpera", (s) => n(s.cirhozySupera, s.partie)],
    ["výhry strachom", (s) => String(s.vyhraStrachom)],
    ["ms na ťah (najdlhší)", (s) => `${n(s.ms, s.tahy)} (${s.najdlhsi.toFixed(0)})`],
  ];
  const sirka = Math.max(...riadky.map(([r]) => r.length));
  console.log(`${"".padEnd(sirka)}  ${povahy.map((p) => p.padStart(12)).join("")}`);
  for (const [nazov, f] of riadky) console.log(`${nazov.padEnd(sirka)}  ${povahy.map((p) => f(staty.get(p) as Stat).padStart(12)).join("")}`);
}

if (isMainThread) await hlavny();
else parentPort?.postMessage(dvojica(workerData as Zadanie));

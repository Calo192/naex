// Hľadanie okien (blocked + allowed) pre návrh slotov — pomocný nástroj k sloty.ts.
//
//   node --experimental-strip-types --no-warnings docs/napady/revizia-sady/skript/hladaj.ts
//
// Pre každú stranu karty vyskúša všetky blokované sloty a všetky allowed (zlúči tie, ktoré
// dajú rovnaké rozloženia, a nechá najjednoduchší zápis), potom lokálnym hľadaním vyberie
// kombináciu, ktorá spĺňa podmienky Michala a je čo najrovnomernejšia. Kombá z plánu
// (časť 5) a Pakt sú pevné filtre. Trvá asi 2–3 minúty (prvý beh), výsledok vypíše a zapíše
// do OUT (predvolene do dočasného priečinka). Návrh v sloty.ts je beh s predvolenými
// parametrami. Parametre (env): UNI, SIDE, OCCU (váhy rovnomernosti), CXW (cena allowed),
// TUHEW (> 0 = ťahá aktívne tuhé nahor), PERSIDE=1 (podmienka 3a aj po stranách), SEED, ITER.
// Hľadanie „sklon do stredu“ v HTML: PERSIDE=1 UNI=1 SIDE=0.2 OCCU=1 TUHEW=200.
import { KARTY } from "./karty.ts";
import { sideLayouts } from "../../../../packages/core/src/variants.ts";
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const CACHE_SUBOR = join(tmpdir(), "naex-sloty-kandidati.json");
const CACHE: Record<string, any> = existsSync(CACHE_SUBOR) ? JSON.parse(readFileSync(CACHE_SUBOR, "utf8")) : {};
type Cfg = { blocked: number[]; allowed?: Record<number, string[]>; n: number; cx: number; E: Record<string, number[]>; occ: number[]; key: string };

function subsets<T>(arr: T[]): T[][] { const r: T[][] = []; for (let m = 1; m < (1 << arr.length); m++) r.push(arr.filter((_, i) => m & (1 << i))); return r; }

function evalSide(actions: Record<string, number>, blocked: number[], allowed?: Record<number, string[]>) {
  const L = sideLayouts({ blocked, actions, allowed } as any);
  const E: Record<string, number[]> = {}; const occ = [0, 0, 0, 0];
  for (const a of Object.keys(actions)) E[a] = [0, 0, 0, 0];
  for (const lay of L) lay.forEach((s: any, i: number) => { if (s) { E[s][i] += 1 / L.length; occ[i] += 1 / L.length; } });
  return { L, E, occ };
}

function candidates(actions: Record<string, number>): Cfg[] { const ck = JSON.stringify(actions); if (CACHE[ck]) return CACHE[ck]; const res = candidates0(actions); CACHE[ck] = res; writeFileSync(CACHE_SUBOR, JSON.stringify(CACHE)); return res; }
function candidates0(actions: Record<string, number>): Cfg[] {
  const kinds = Object.keys(actions); const k = Object.values(actions).reduce((a, b) => a + b, 0);
  const best = new Map<string, Cfg>();
  for (const B of [[], ...subsets([0, 1, 2, 3])]) {
    if (4 - B.length < k) continue;
    const free = [0, 1, 2, 3].filter(i => !B.includes(i));
    const opts: (string[] | null)[] = [null, ...subsets(kinds).filter(s => s.length < kinds.length)];
    const idx = free.map(() => 0);
    while (true) {
      const allowed: Record<number, string[]> = {}; let cx = 0;
      free.forEach((s, j) => { const o = opts[idx[j]]; if (o) { allowed[s] = o; cx += 1 + o.length * 0.01; } });
      const { L, E, occ } = evalSide(actions, B, cx ? allowed : undefined);
      if (L.length >= 1 && L.length <= 8) {
        const key = JSON.stringify(L);
        const prev = best.get(key);
        if (!prev || cx < prev.cx) best.set(key, { blocked: B, allowed: cx ? allowed : undefined, n: L.length, cx, E, occ, key });
      }
      let j = 0; while (j < free.length) { idx[j]++; if (idx[j] < opts.length) break; idx[j] = 0; j++; }
      if (j === free.length) break;
    }
  }
  return [...best.values()];
}

// Pripnutia: Kulturista a Pakt (zámer plánu), ďalej okná, na ktorých stoja kombá z časti 5.
const pin: Record<string, (c: Cfg) => boolean> = {
  "kulturista:L": c => c.n === 1 && c.E["Petelica"][1] === 1,
  "brigadnik:L": c => c.E["Pakt"][3] === 1,
  "zivnostnik:L": c => c.E["Dlh"][0] === 0 && c.E["Dlh"][1] === 0 && c.E["Pakt"][0] === 0 && c.E["Pakt"][1] === 0 && c.E["Pakt"][2] > 0 && c.E["Pakt"][3] > 0,
  "dohadzovacka:L": c => c.E["Pakt"][0] === 0 && c.E["Pakt"][1] === 0 && c.E["Pakt"][2] > 0 && c.E["Pakt"][3] > 0,
};
const eq = (a: number[], b: number[]) => a.every((x, i) => Math.abs(x - b[i]) < 1e-9);
Object.assign(pin, {
  "puska:R": (c: Cfg) => eq(c.E["Petelica"], [0, 0, .5, .5]),
  "vestica:L": (c: Cfg) => c.occ[2] > 0.999 && c.occ[3] > 0.999,
  "vestica:R": (c: Cfg) => c.occ[2] > 0.999 && c.occ[3] > 0.999,
  "traktoristka:L": (c: Cfg) => c.E["Petelica"][0] === 0 && c.E["Petelica"][1] === 0,
  "kon:L": (c: Cfg) => c.E["Posilnenie"][2] + c.E["Posilnenie"][3] >= 0.5 - 1e-9,
  "hasic:R": (c: Cfg) => eq(c.E["Petelica"], [.5, 0, 0, .5]),
  "praudovravec:L": (c: Cfg) => eq(c.occ, [1, 1, 0, 1]) && c.E["Odpor"][0] + c.E["Odpor"][3] >= 2 / 3 - 1e-9,
  "recidivista:R": (c: Cfg) => c.E["Petelica"][2] === 0,
});

const cards = KARTY.map(c => {
  let L = candidates(c.lava as any), R = candidates(c.prava as any);
  if (pin[c.id + ":L"]) L = L.filter(pin[c.id + ":L"]);
  if (pin[c.id + ":R"]) R = R.filter(pin[c.id + ":R"]);
  const pairs: [number, number][] = [];
  L.forEach((l, i) => R.forEach((r, j) => { const p = l.n * r.n; if (p >= 4 && p <= 8) pairs.push([i, j]); }));
  return { c, L, R, pairs };
});
for (const x of cards) if (!x.pairs.length) console.log("NO PAIRS", x.c.id);
console.error("candidates done", cards.reduce((a, x) => a + x.pairs.length, 0));

const KINDS = [...new Set(KARTY.flatMap(c => [...Object.keys(c.lava), ...Object.keys(c.prava)]))];
const tot: Record<string, number> = {}; for (const c of KARTY) { for (const [a, n] of Object.entries(c.lava)) tot[a] = (tot[a] ?? 0) + n; for (const [a, n] of Object.entries(c.prava)) tot[a] = (tot[a] ?? 0) + n; }
const sideTot = [0, 0]; for (const c of KARTY) { sideTot[0] += Object.values(c.lava).reduce((a, b) => a + b, 0); sideTot[1] += Object.values(c.prava).reduce((a, b) => a + b, 0); }

const E: Record<string, number[][]> = {}; for (const k of KINDS) E[k] = [[0, 0, 0, 0], [0, 0, 0, 0]];
const O = [[0, 0, 0, 0], [0, 0, 0, 0]];
let CX = 0;
const choice: number[] = cards.map(() => 0);
function apply(ci: number, pi: number, sgn: number) {
  const x = cards[ci]; const [li, ri] = x.pairs[pi]; const l = x.L[li], r = x.R[ri];
  for (const [s, cfg] of [[0, l], [1, r]] as [number, Cfg][]) { for (const [a, v] of Object.entries(cfg.E)) for (let i = 0; i < 4; i++) E[a][s][i] += sgn * v[i]; for (let i = 0; i < 4; i++) O[s][i] += sgn * cfg.occ[i]; CX += sgn * cfg.cx; }
}
const W = { viol: 1000, uni: Number(process.env.UNI ?? 20), side: Number(process.env.SIDE ?? 2), occ: 1000, occU: Number(process.env.OCCU ?? 30), cx: Number(process.env.CXW ?? 0.3), combo: Number(process.env.COW ?? 0) };
function objective() {
  let v = 0;
  for (const k of KINDS) {
    const T = tot[k];
    const comb = [0, 1, 2, 3].map(i => E[k][0][i] + E[k][1][i]);
    if (T >= 4) for (let i = 0; i < 4; i++) { const s = comb[i] / T; v += W.viol * (Math.max(0, 0.15 - s) + Math.max(0, s - 0.40)) + W.uni * (s - 0.25) ** 2; }
    for (let sd = 0; sd < 2; sd++) { const t = E[k][sd].reduce((a, b) => a + b, 0); if (t >= 3) for (let i = 0; i < 4; i++) v += W.side * (E[k][sd][i] / t - 0.25) ** 2; if (process.env.PERSIDE && t >= 4) for (let i = 0; i < 4; i++) { const s = E[k][sd][i] / t; v += W.viol * (Math.max(0, 0.15 - s) + Math.max(0, s - 0.40)); } }
  }
  for (let sd = 0; sd < 2; sd++) { const m = sideTot[sd] / 4; for (let i = 0; i < 4; i++) { const r = O[sd][i] / m - 1; v += W.occ * Math.max(0, Math.abs(r) - 0.2) + W.occU * r * r; } }
  return v + W.cx * CX + W.combo * comboPenalty() - Number(process.env.TUHEW ?? 0) * tuheSpoj();
}
const TUHE: Record<string, number> = { Rana: 1, Pecka: 2, Petelica: 3 };
function tuheSpoj() {
  const N = cards.length;
  const vec = (sd: number, f: (a: string) => number) => [0, 1, 2, 3].map(i => KINDS.reduce((acc, a) => acc + f(a) * E[a][sd][i], 0) / N);
  const O2 = [O[0].map(x => x / N), O[1].map(x => x / N)];
  const T = [vec(0, a => TUHE[a] ?? 0), vec(1, a => TUHE[a] ?? 0)];
  const P = [vec(0, a => a === "Pakt" ? 1 : 0), vec(1, a => a === "Pakt" ? 1 : 0)];
  const efR = (x: number[][]) => [0, 1, 2, 3].map(i => (x[1][i] + x[0][3 - i]) / 2);
  const efL = (x: number[][]) => [0, 1, 2, 3].map(i => (x[0][i] + x[1][3 - i]) / 2);
  const oR = efR(O2), oL = efL(O2), tR = efR(T), tL = efL(T), pR = efR(P), pL = efL(P);
  let t = 0; for (let i = 0; i < 4; i++) t += tR[i] * oL[i] + tL[i] * oR[i] + pR[i] * tL[i] + pL[i] * tR[i];
  return t;
}
const cardIdx: Record<string, number> = {}; cards.forEach((x, i) => cardIdx[x.c.id] = i);
function sideCfg(id: string, side: number): Cfg { const ci = cardIdx[id]; const [l, r] = cards[ci].pairs[choice[ci]]; return side ? cards[ci].R[r] : cards[ci].L[l]; }
function pv(cfg: Cfg, a: string | null): number[] { return a ? cfg.E[a] : cfg.occ; }
const COMBOS: [string, string, string | null, string, string | null, number, number][] = [
  ["WAU1 Kulturista pri Silnej žene", "silna_nezavisla_zena", null, "kulturista", "Dlh", 1, 2],
  ["WAU2 Dezinformátor", "praudovravec", "Odpor", "hasic", "Petelica", 1 / 3, 1],
  ["WAU3 Kôň + Puška", "kon", "Posilnenie", "puska", "Petelica", 1 / 4, 1],
  ["WAU6 Traktoristka na Veštici", "traktoristka", "Petelica", "vestica", null, 1, 1],
  ["WAU6 Veštica pred Puškou", "vestica", null, "puska", "Petelica", 1, 1],
  ["WAU7 Recidivista na Praudovravcovi", "praudovravec", null, "recidivista", "Petelica", 1, 1],
];
function comboP(c: (typeof COMBOS)[number]) { const a = pv(sideCfg(c[1], 0), c[2]), b = pv(sideCfg(c[3], 1), c[4]); let p = 0; for (let i = 0; i < 4; i++) p += a[i] * b[i]; return p / c[6]; }
function comboPenalty() { let v = 0; for (const c of COMBOS) { const p = comboP(c); if (p < 1e-9) v += 1000; v += Math.max(0, c[5] - p); } return v; }
cards.forEach((x, ci) => { let b = 0, bv = Infinity; x.pairs.forEach(([l, r], pi) => { const v = x.L[l].cx + x.R[r].cx; if (v < bv) { bv = v; b = pi; } }); choice[ci] = b; apply(ci, b, 1); });
let rng = Number(process.env.SEED ?? 12345); const rnd = () => (rng = (rng * 1103515245 + 12345) % 2147483648) / 2147483648;
let cur = objective(); let bestObj = cur; let bestChoice = [...choice];
for (let iter = 0; iter < Number(process.env.ITER ?? 40); iter++) {
  let improved = false;
  const order = cards.map((_, i) => i).sort(() => rnd() - 0.5);
  for (const ci of order) {
    apply(ci, choice[ci], -1);
    let b = choice[ci], bv = Infinity;
    for (let pi = 0; pi < cards[ci].pairs.length; pi++) { apply(ci, pi, 1); const v = objective(); if (v < bv - 1e-9) { bv = v; b = pi; } apply(ci, pi, -1); }
    if (b !== choice[ci]) improved = true;
    choice[ci] = b; apply(ci, b, 1); cur = bv;
  }
  if (cur < bestObj - 1e-9) { bestObj = cur; bestChoice = [...choice]; }
  if (!improved) {
    for (let t = 0; t < 6; t++) { const ci = Math.floor(rnd() * cards.length); apply(ci, choice[ci], -1); choice[ci] = Math.floor(rnd() * cards[ci].pairs.length); apply(ci, choice[ci], 1); }
    cur = objective();
  }
}
cards.forEach((_, ci) => apply(ci, choice[ci], -1)); bestChoice.forEach((pi, ci) => { choice[ci] = pi; apply(ci, pi, 1); });
console.log("obj", objective().toFixed(3), "CX", CX.toFixed(2), "TUHE", tuheSpoj().toFixed(3)); for (const c of COMBOS) console.log(c[0], comboP(c).toFixed(2), "plan", c[5].toFixed(2));
for (const k of KINDS) { const comb = [0, 1, 2, 3].map(i => E[k][0][i] + E[k][1][i]); console.log(k.padEnd(18), tot[k], comb.map(x => (100 * x / tot[k]).toFixed(0).padStart(3) + "%").join(" "), " L", E[k][0].map(x => x.toFixed(1)).join(" "), " R", E[k][1].map(x => x.toFixed(1)).join(" ")); }
for (let sd = 0; sd < 2; sd++) console.log(sd ? "R" : "L", O[sd].map(x => x.toFixed(2)).join(" "), "mean", (sideTot[sd] / 4).toFixed(2));
const out: any[] = [];
cards.forEach((x, ci) => { const [l, r] = x.pairs[choice[ci]]; const L = x.L[l], R = x.R[r]; out.push({ id: x.c.id, L: { blocked: L.blocked, allowed: L.allowed, n: L.n }, R: { blocked: R.blocked, allowed: R.allowed, n: R.n } }); console.log(x.c.id.padEnd(22), JSON.stringify(x.c.lava), "b" + JSON.stringify(L.blocked), L.allowed ? "a" + JSON.stringify(L.allowed) : "", L.n, "||", JSON.stringify(x.c.prava), "b" + JSON.stringify(R.blocked), R.allowed ? "a" + JSON.stringify(R.allowed) : "", R.n, "=", L.n * R.n); });
writeFileSync(process.env.OUT ?? join(tmpdir(), "naex-sloty-hladanie.json"), JSON.stringify(out, null, 1));

// Power score sady: dnešné akcie (cards.json) vs. návrh (navrh.mjs), váhy po mäkkom 3 a 2 (v11.7).
// node docs/napady/makke-akcie/sila.mjs [--vsetky]
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ZMENY, VAHY, SILA_EFEKTU, KODY } from './navrh.mjs';
const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const d = JSON.parse(readFileSync(`${ROOT}packages/core/data/cards.json`, 'utf8'));
const ID = { OBR: ['Viera'], TUH: ['Rana', 'Pecka', 'Petelica'], MAK: ['Povera', 'Pohoršenie'], EKO: ['Poldeci', 'Cigareta', 'Robota'], POD: ['Vízia', 'Posilnenie', 'Pakt'], SAB: ['Odpor', 'Obmedzenie'] };
const idOf = (a) => Object.keys(ID).find((k) => ID[k].includes(a));
export const typOf = (c) => c.tags.includes('Lokalita') ? 'Lok' : c.tags.includes('Nástroj') ? 'Nas' : c.tags.includes('Starešina') ? 'Star' : c.tags.includes('Kliatba') ? 'Kl' : c.tags.includes('Občan') ? 'Obc' : 'Zv';
export const stara = (s) => ({ blocked: s.blocked ?? [], acts: Object.entries(s.actions).flatMap(([k, v]) => Array(v).fill(k)) });
export const nova = (str) => { const [b, a] = str.split('|'); return { blocked: b ? b.split(',').map(Number) : [], acts: a ? a.split(' ').map((k) => { if (!KODY[k]) throw new Error(k); return KODY[k]; }) : [] }; };
export function karty() {
  return d.cards.filter((c) => typOf(c) !== 'Kl').map((c) => {
    const old = { L: stara(c.left), R: stara(c.right) };
    const z = ZMENY[c.id];
    const neu = z ? { L: z.L ? nova(z.L) : old.L, R: z.R ? nova(z.R) : old.R } : old;
    return { id: c.id, i: c.index, name: c.name, tags: c.tags, typ: typOf(c), effect: c.effect_text, ef: SILA_EFEKTU[c.id] ?? 1, note: z?.pozn ?? '', old, neu };
  });
}
const vsetky = (k, v) => [...k[v].L.acts, ...k[v].R.acts];
export const identity = (acts) => [...new Set(acts.map(idOf).filter(Boolean))];
const sila = (k, v, W) => vsetky(k, v).reduce((s, a) => s + (k.typ === 'Nas' ? Math.abs(W[a] ?? 0) : (W[a] ?? 0)), 0) + k.ef;
function pasma(K, v, W) {
  const p = {};
  for (const t of ['Obc', 'Zv', 'Nas', 'Star', 'Lok']) {
    const x = K.filter((k) => k.typ === t).map((k) => sila(k, v, W));
    const m = x.reduce((a, b) => a + b, 0) / x.length, sd = Math.sqrt(x.reduce((a, b) => a + (b - m) ** 2, 0) / x.length);
    const w = Math.max(1.5 * sd, 0.25 * m); p[t] = { m, lo: m - w, hi: m + w };
  }
  return p;
}
if (process.argv[1]?.endsWith("sila.mjs")) {
  const K = karty(); const p = pasma(K, 'neu', VAHY.nove);
  const f = {}, fo = {};
  for (const k of K) { for (const a of vsetky(k, 'neu')) f[a] = (f[a] || 0) + 1; for (const a of vsetky(k, 'old')) fo[a] = (fo[a] || 0) + 1; }
  for (const a of ['Viera', 'Povera', 'Pohoršenie']) console.log(a.padEnd(11), fo[a], '→', f[a]);
  for (const t of Object.keys(p)) console.log('pásmo', t, p[t].lo.toFixed(1), '–', p[t].hi.toFixed(1), 'priemer', p[t].m.toFixed(1));
  for (const k of K) {
    const s0 = sila(k, 'old', VAHY.stare), s1 = sila(k, 'neu', VAHY.nove), ids = identity(vsetky(k, 'neu'));
    const mimo = s1 < p[k.typ].lo ? 'POD' : s1 > p[k.typ].hi ? 'NAD' : '';
    if (process.argv.includes('--vsetky') || mimo || ids.length > 2 || ZMENY[k.id]) console.log(k.typ.padEnd(4), k.id.padEnd(22), s0.toFixed(1).padStart(5), '→', s1.toFixed(1).padStart(5), mimo.padEnd(3), ids.join(' ').padEnd(9), ZMENY[k.id] ? '*' : '');
  }
}
// Varianty (B+: Odpor Občana pevne v slote 1, vzbúrenca v 2) — Občan 4–8, Nástroj a Zviera 2–4, Starší 1.
const fact = (n) => (n <= 1 ? 1 : n * fact(n - 1));
const VZB = new Set(['recidivista', 'kocovnik']);
export function varianty(k, v) {
  if (k.typ === 'Star' || k.typ === 'Lok') return null;
  let n = 1;
  for (const s of [k[v].L, k[v].R]) {
    let free = 4 - s.blocked.length; const rest = [...s.acts];
    if (k.typ === 'Obc' && rest.includes('Odpor')) { const pin = VZB.has(k.id) ? 2 : 1; if (!s.blocked.includes(pin)) { free--; rest.splice(rest.indexOf('Odpor'), 1); } }
    const cnt = {}; for (const a of rest) cnt[a] = (cnt[a] || 0) + 1;
    n *= fact(free) / [...Object.values(cnt), free - rest.length].reduce((x, y) => x * fact(y), 1);
  }
  return n;
}
if (process.argv[1]?.endsWith('sila.mjs')) {
  const R = { Obc: [4, 8], Nas: [2, 4], Zv: [2, 4] };
  for (const k of karty()) if (ZMENY[k.id] && R[k.typ]) { const n = varianty(k, 'neu'); console.log('varianty', k.id, varianty(k, 'old'), '→', n, n < R[k.typ][0] || n > R[k.typ][1] ? 'MIMO' : 'ok'); }
}

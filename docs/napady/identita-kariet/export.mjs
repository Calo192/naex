// Návrh sady vo formáte strán cards.json (blocked, actions, allowed pre pevný Odpor B+) — podklad pre naex-admin.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { KODY, NAVRH } from './design.mjs';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const d = JSON.parse(readFileSync(`${ROOT}packages/core/data/cards.json`, 'utf8'));
const VZBURENCI = new Set(['recidivista', 'kocovnik']);
const strana = (str, obcan, id) => {
  const [b, a] = str.split('|');
  const blocked = b ? b.split(',').map(Number) : [];
  const actions = {};
  for (const k of a ? a.split(' ') : []) actions[KODY[k]] = (actions[KODY[k]] || 0) + 1;
  const out = { blocked, actions };
  if (obcan && actions.Odpor) out.pevny_odpor = VZBURENCI.has(id) ? 2 : 1;
  return out;
};
const karty = NAVRH.map(([id, ids, L, R]) => {
  const c = d.cards.find(x => x.id === id);
  const obcan = c.tags.includes('Občan');
  return { id, name: c.name, identity: ids.split(' '), left: strana(L, obcan, id), right: strana(R, obcan, id) };
});
writeFileSync(new URL('./navrh-sada.json', import.meta.url), JSON.stringify(karty, null, 1) + '\n');
console.log('navrh-sada.json', karty.length);

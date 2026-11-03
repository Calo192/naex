import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { KODY, NAVRH, EFEKTY } from './design.mjs';

// Pokračovanie: uprav design.mjs (akcie, návrhy efektov) alebo sablona.html, potom
// node docs/napady/identita-kariet/build.mjs → docs/napady/identita-kariet.html (kontrola: check.mjs).
const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const d = JSON.parse(readFileSync(`${ROOT}packages/core/data/cards.json`, 'utf8'));
const typOf = c => c.tags.includes('Lokalita') ? 'Lok' : c.tags.includes('Nástroj') ? 'Nas'
  : c.tags.includes('Starešina') ? 'Star' : c.tags.includes('Kliatba') ? 'Kl' : c.tags.includes('Občan') ? 'Obc' : 'Zv';
const oldSide = s => ({ blocked: s.blocked ?? [], acts: Object.entries(s.actions).flatMap(([k, v]) => Array(v).fill(k)) });
const newSide = str => { const [b, a] = str.split('|'); return { blocked: b ? b.split(',').map(Number) : [], acts: a ? a.split(' ').map(k => KODY[k]) : [] }; };

const karty = [];
for (const [id, ids, L, R, ef, note] of NAVRH) {
  const c = d.cards.find(x => x.id === id);
  karty.push({
    id, i: c.index, name: c.name, tags: c.tags, typ: typOf(c), effect: c.effect_text,
    ids: ids.split(' '), ef, note,
    old: { L: oldSide(c.left), R: oldSide(c.right) },
    neu: { L: newSide(L), R: newSide(R) },
  });
}
karty.sort((a, b) => a.i - b.i);
const DATA = { karty, efekty: EFEKTY };

const html = readFileSync(new URL('./sablona.html', import.meta.url), 'utf8')
  .replace('/*__DATA__*/null', JSON.stringify(DATA));
writeFileSync(`${ROOT}docs/napady/identita-kariet.html`, html);
console.log('ok', karty.length, html.length);

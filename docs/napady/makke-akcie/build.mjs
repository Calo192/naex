// Mock „Mäkké 3 a 2“: node docs/napady/makke-akcie/build.mjs → docs/napady/makke-akcie.html (kontrola: sila.mjs).
// Šablóna je z mocku Identita kariet (docs/napady/identita-kariet), dáta z navrh.mjs nad cards.json.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { karty, identity } from './sila.mjs';
import { VAHY, ZMENY } from './navrh.mjs';
const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const vyucba = readFileSync(`${ROOT}packages/core/data/vyucba/prva-hra.json`, 'utf8');
const K = karty().map((k) => {
  const vo = new RegExp(`"${k.id}"|:${k.id}"`).test(vyucba);
  const zmenena = ZMENY[k.id]?.L !== undefined || ZMENY[k.id]?.R !== undefined;
  const note = [k.note, zmenena && vo ? 'Karta je vo výučbe Prvá hra — scenár a hlášky treba pri vypálení prejsť.' : ''].filter(Boolean).join(' ');
  return { ...k, note, zmenena, ids: identity([...k.neu.L.acts, ...k.neu.R.acts]) };
}).sort((a, b) => a.i - b.i);
const pocty = (v) => { const c = {}; for (const k of K) for (const a of [...k[v].L.acts, ...k[v].R.acts]) c[a] = (c[a] || 0) + 1; return c; };
const o = pocty('old'), n = pocty('neu');
const zmenene = K.filter((k) => k.zmenena).length;
const p = (pary) => { let t = readFileSync(new URL('./sablona.html', import.meta.url), 'utf8').replace(/\r\n/g, '\n'); for (const [a, b] of pary) { if (!t.includes(a)) throw new Error('šablóna: ' + a.slice(0, 60)); t = t.replace(a, b); } return t; };
const html = p([
  ['<title>Identita kariet — NA EX!</title>', '<title>Mäkké 3 a 2 — NA EX!</title>'],
  ['<h1>Identita kariet</h1>', '<h1>Mäkké 3 a 2: menej Viery, viac Povier a Pohoršenia</h1>'],
  ['<p class="mini">Návrh sady od zelenej lúky · 2026-11-03 · ilustrácie, názvy, tagy a efekty ostávajú, prerobené sú akcie · pri 10 kartách návrh nového efektu</p>',
    `<p class="mini">2026-11-04 · nadväzuje na Identitu kariet (v11.5) · mení sa ${zmenene} kariet, efekty ostávajú · <b>Mäkké 3 a 2 Michal 2026-11-05 vrátil na 2 a 1 („extrémne silné“)</b>; power score a rebalans tu počítajú ešte s 3 a 2</p>`],
  ['<p><b>Princíp.</b> Každá karta má najviac <b>dve identity</b>. Akcie z tretej identity na nej nie sú. <b>Hazard</b> a <b>Poškodenie pečene</b> sú neutrálne — smie ich mať každá karta a vyvažujú silné akcie.</p>',
    `<p><b>Čo sa mení.</b> Viera ${o.Viera} → <b>${n.Viera}</b>, Povera ${o.Povera} → <b>${n.Povera}</b>, Pohoršenie ${o['Pohoršenie']} → <b>${n['Pohoršenie']}</b> (súčet akcií na všetkých kartách). Vieru strácajú karty, kde nemá oporu v efekte ani v téme (Milujúca manželka, Niekoho stryná, Kar); Svätý text, Miňištrant, Anonymný alkoholik, Kostol a Farár ju držia, lebo na nej stojí ich efekt alebo téma. Každá karta má najviac <b>dve identity</b> — Poľovnícka chata mala tri. Karty, ktoré po mäkkom 3 a 2 vyskočili nad pásmo, sú prevážené (Telefón, Nealko, Liberál) a Pohoršenie, ktoré tým ubudlo, prešlo na Jednotu a Poštárku.</p>
  <p class="mini"><b>Zmenené karty</b> zapni tlačidlom „Len zmenené karty“; „Ukázať pôvodné akcie“ ukáže dnešný stav. Power score používa nové hodnoty mäkkého (záložka Power score).</p>`],
  ["'naex-identita-' + k", "'naex-makke-' + k"], ["'naex-identita-' + k", "'naex-makke-' + k"],
  [`const VAHY0 = { Rana: 1, Pecka: 2.2, Petelica: 3.5, Povera: 0.9, Pohoršenie: 2, Viera: 1.1, Poldeci: 1.3, Cigareta: 1, Robota: 1.1,
  Vízia: 1.4, Posilnenie: 1.6, Pakt: 1.2, Odpor: 1.2, Obmedzenie: 0.8, PoškodeniePečene: -1, Dlh: -0.9 };`, `const VAHY0 = ${JSON.stringify(VAHY.nove)};`],
  ['`V dnešnej sade má ${stareZle} z ${DATA.karty.length} kariet s akciami tri a viac identít. V návrhu žiadna.`',
    '`V dnešnej sade má ${stareZle} z ${DATA.karty.length} kariet s akciami tri identity (Poľovnícka chata). V návrhu žiadna.`'],
  ['<button role="tab" data-tab="efekty">Návrhy efektov</button>', ''],
  ["prepinac('b-efekty', 'lenEf', 'Všetky karty', 'Len s návrhom efektu');", "prepinac('b-efekty', 'lenEf', 'Všetky karty', 'Len zmenené karty');"],
  ['<button class="btn" id="b-efekty">Len s návrhom efektu</button>', '<button class="btn" id="b-efekty">Len zmenené karty</button>'],
  ['(!stav.lenEf || DATA.efekty[k.id])', '(!stav.lenEf || k.zmenena)'],
  ['Hodnoty akcií si môžeš nižšie zmeniť — všetko sa prepočíta.',
    'Hodnoty akcií si môžeš nižšie zmeniť — všetko sa prepočíta. <b>Mäkké 3 a 2:</b> Pohoršenie 2 → 2,4, Povera 0,9 → 1,4, Viera 1,1 → 1,3. Bod mäkkého je lacnejší ako bod tuhého (Pohoršenie 3 × 0,8, Povera 2 × 0,7) — pri 2 a 1 bolo mäkké v hre „priam až extrémne slabé“; Viera stúpla, lebo ruší silnejšiu Poveru. Pri váhe 1 : 1 by všetky mäkké karty vyleteli nad pásmo a rebalans by ich osekal, čo je proti cieľu.'],
]).replace('/*__DATA__*/null', JSON.stringify({ karty: K, efekty: {} }));
writeFileSync(`${ROOT}docs/napady/makke-akcie.html`, html);
console.log('ok', K.length, 'zmenených', zmenene, html.length);

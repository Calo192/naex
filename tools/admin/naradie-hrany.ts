// Hrany Nástrojov (rework Náradia, Michal 2026-11-08) — kontrola sady pre agenta naex-admin.
//
// Zoznam hrán 22 Nástrojov je v packages/core/test/data/naradie-hrany.json (podľa
// docs/napady/naradie-hrany-zoznam.html v5): pre každý Nástroj presný text efektu, ktorý
// admin zadá v tvorcovi Vypálenej (rozpracovaný stav, nezverejniť), a Nástroj stratí sloty.
// Skript porovná sadu so zoznamom a vypíše, čo ešte treba prepísať.
//
//   node --experimental-strip-types --no-warnings tools/admin/naradie-hrany.ts [cards.json]
//   … naradie-hrany.ts --sada <výstup.json>   sada s hranami podľa zoznamu (turnaj botov: NAEX_SADA)

import { readFileSync, writeFileSync } from "node:fs";
import { chybyHran, hranyNastroja } from "../../packages/core/src/index.ts";
import type { Tag } from "../../packages/core/src/index.ts";

interface Nastroj {
  readonly id: string;
  readonly nazov: string;
  readonly effect_text: string;
}
interface SurovaKarta {
  readonly id: string;
  readonly name: string;
  readonly tags: readonly string[];
  readonly effect_text: string;
  readonly left: { readonly actions: Readonly<Record<string, number>> };
  readonly right: { readonly actions: Readonly<Record<string, number>> };
}

const koren = new URL("../../", import.meta.url);
const zoznam = JSON.parse(readFileSync(new URL("packages/core/test/data/naradie-hrany.json", koren), "utf8")) as { readonly nastroje: readonly Nastroj[] };
const vystup = process.argv[2] === "--sada" ? process.argv[3] : undefined;
const cesta = vystup === undefined ? process.argv[2] : undefined;
const sada = JSON.parse(readFileSync(cesta === undefined ? new URL("packages/core/data/cards.json", koren) : cesta, "utf8")) as { readonly cards: readonly SurovaKarta[] };

let hotovych = 0;
for (const n of zoznam.nastroje) {
  const karta = sada.cards.find((c) => c.id === n.id);
  if (karta === undefined) {
    console.log(`✗ ${n.nazov} (${n.id}) — v sade chýba`);
    continue;
  }
  const def = { effectText: karta.effect_text, tags: karta.tags as readonly Tag[] };
  const chcem = hranyNastroja({ effectText: n.effect_text, tags: ["Nástroj"] });
  const mam = hranyNastroja(def);
  const sloty = Object.keys(karta.left.actions).length + Object.keys(karta.right.actions).length;
  const problemy = [
    ...chybyHran(def),
    ...(mam !== null && JSON.stringify(mam) !== JSON.stringify(chcem) ? ["hrany nesedia so zoznamom"] : []),
    ...(sloty > 0 ? ["má ešte sloty — Nástroj je bez slotov"] : []),
  ];
  if (problemy.length === 0) {
    hotovych++;
    continue;
  }
  console.log(`✗ ${n.nazov} (${n.id}): ${problemy.join("; ")}`);
  console.log(`    text efektu: ${n.effect_text}`);
}
console.log(`\n${hotovych} / ${zoznam.nastroje.length} Nástrojov má hrany podľa zoznamu.`);

if (vystup !== undefined) {
  const texty = new Map(zoznam.nastroje.map((n) => [n.id, n.effect_text]));
  const bezSlotov = { blocked: [], actions: {} };
  const cards = sada.cards.map((c) => {
    const text = texty.get(c.id);
    return text === undefined ? c : { ...c, effect_text: text, left: bezSlotov, right: bezSlotov, permutations: { total: 1, left: 1, right: 1 } };
  });
  writeFileSync(vystup, JSON.stringify({ ...sada, cards }, null, 2));
  console.log(`Sada s hranami: ${vystup}`);
}

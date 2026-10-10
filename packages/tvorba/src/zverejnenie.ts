// Návrhy kariet → herné dáta vo formáte packages/core/data/cards.json.
// Validáciu robí samotné jadro (loadGameData) — tu len skladáme JSON
// a zachytíme to, čo jadro nevie povedať zrozumiteľne (vlastné akcie).

import { ALL_ACTIONS, ALL_TRIGGERS } from "@naex/core";
import type { KartaNavrh, StranaNavrhu } from "./typy.ts";
import { POZICIE } from "./typy.ts";
import { rozlozeniaStrany } from "./varianty.ts";
import { spustaceVTexte } from "./text.ts";

/** Prevod názvu na id karty (rovnaký ako tools/parse_cards.py). */
export function slug(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function stranaJson(s: StranaNavrhu): Record<string, unknown> {
  const actions: Record<string, number> = {};
  for (const [k, n] of Object.entries(s.akcie).sort(([a], [b]) => a.localeCompare(b))) if (n > 0) actions[k] = n;
  const out: Record<string, unknown> = { blocked: [...s.blokovane].sort(), actions };
  const allowed: Record<string, string[]> = {};
  for (const p of POZICIE) {
    const z = s.povolene[p];
    if (z !== undefined && z.length > 0 && !s.blokovane.includes(p)) allowed[String(p)] = [...z];
  }
  if (Object.keys(allowed).length > 0) out.allowed = allowed;
  return out;
}

/** Akcie, ktoré hra nepozná — karta s nimi sa nedá zverejniť. */
export function neznameAkcie(k: KartaNavrh): string[] {
  const vsetky = [...Object.keys(k.lava.akcie), ...Object.keys(k.prava.akcie)];
  return [...new Set(vsetky.filter((a) => !(ALL_ACTIONS as readonly string[]).includes(a)))];
}

export function doCardsJson(karty: readonly KartaNavrh[], zdroj: string): unknown {
  const cards = karty.map((k, i) => {
    const l = rozlozeniaStrany(k.lava).length;
    const r = rozlozeniaStrany(k.prava).length;
    return {
      id: k.id,
      index: i + 1,
      name: k.nazov,
      tags: [...k.tagy],
      effect_text: k.efekt,
      triggers: spustaceVTexte(k.efekt, ALL_TRIGGERS),
      left: stranaJson(k.lava),
      right: stranaJson(k.prava),
      permutations: { total: l * r, left: l, right: r },
    };
  });
  return {
    source: zdroj,
    actions: [...new Set(cards.flatMap((c) => [...Object.keys(c.left.actions as object), ...Object.keys(c.right.actions as object)]))].sort(),
    tags: [...new Set(cards.flatMap((c) => c.tags))].sort(),
    cards,
  };
}

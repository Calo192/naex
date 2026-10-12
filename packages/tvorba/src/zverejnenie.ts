// Návrhy kariet → herné dáta vo formáte packages/core/data/cards.json.
// Validáciu robí samotné jadro (loadGameData) — tu len skladáme JSON
// a zachytíme to, čo jadro nevie povedať zrozumiteľne (vlastné akcie).

import type { Favour, Podmienka } from "@naex/core";
import { ALL_ACTIONS, ALL_FAVOURS, ALL_TRIGGERS, priazenZKluca } from "@naex/core";
import type { BodovaciaKarta, IkonaBodovania, KartaNavrh, StranaNavrhu } from "./typy.ts";
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

/**
 * Bodovacie karty → scorecardy pre hru (formát packages/core/data/scorecards.json).
 * Priazeň sa číta z názvu karty (Zberateľ → ZBERATEL), význam pozície
 * z ikony. Body za podmienky sú herné hodnoty z jadra (`body`).
 */
export function doScorecardsJson(
  bodovacie: readonly BodovaciaKarta[],
  ikony: readonly IkonaBodovania[],
  body: Readonly<Record<Podmienka, number>>,
): { readonly json: unknown; readonly problemy: readonly string[] } {
  const problemy: string[] = [];
  const podmienka = (id: string | null, kde: string): Podmienka | null => {
    if (id === null) return null;
    const ik = ikony.find((i) => i.id === id);
    if (ik === undefined) {
      problemy.push(`${kde}: ikona ${id} neexistuje.`);
      return null;
    }
    if (ik.podmienka === undefined || ik.podmienka === null) {
      problemy.push(`${kde}: ikona „${ik.nazov}“ nemá určený význam v hre.`);
      return null;
    }
    return ik.podmienka;
  };
  const scorecards = bodovacie.map((b) => {
    const kluc = slug(b.nazov).toUpperCase();
    const favour: Favour = priazenZKluca(kluc) ?? (kluc as Favour);
    if (priazenZKluca(kluc) === null) problemy.push(`Bodovacia karta „${b.nazov}“: názov nie je žiadna priazeň (${ALL_FAVOURS.join(", ")}).`);
    const strana = (s: readonly (string | null)[], nazov: string) =>
      [0, 1, 2, 3].map((i) => podmienka(s[i] ?? null, `Bodovacia karta „${b.nazov}“ ${nazov} ${i + 1}`));
    return { id: b.id, nazov: b.nazov, favour, lava: strana(b.lava, "vľavo"), prava: strana(b.prava, "vpravo") };
  });
  return { json: { body, scorecards }, problemy };
}

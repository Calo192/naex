// O1 z playtestu 20261024-075830 (Michal 2026-10-24): NA EX na kartu
// s Posilnením zruší Posilnenie aj ×2, ktoré dávalo partnerovi na spoji.
// Partnerova akcia ostáva aktívna ×1. Očakávané hodnoty sú z textu §7.

import { describe, expect, it } from "vitest";
import type { CardInstance, GameData, LineEval, PlacedCard, PlayerId } from "../src/index.ts";
import { evaluateLine } from "../src/index.ts";
import type { Layout4 } from "./helpers.ts";
import { EMPTY, instanceFor, makeDef, syntheticData } from "./helpers.ts";

const lezi = (card: CardInstance, playedBy: PlayerId, naexBy?: PlayerId): PlacedCard =>
  naexBy === undefined ? { card, playedBy } : { card, playedBy, naexBy };

/** Posilňovač: Posilnenie na spoji s partnerom, Rana bez partnera (neaktívna). */
const POSIL: Layout4 = ["Posilnenie", "Rana", null, null];
/** Partner: Pecka proti Posilneniu, Cigareta bez partnera (neaktívny — NA EX naň má zmysel). */
const PARTNER_L: Layout4 = ["Pecka", null, null, null];
const PARTNER_P: Layout4 = ["Cigareta", null, null, null];

function sada(posilId = "posil"): { sada: GameData; posil: () => CardInstance; partner: () => CardInstance } {
  const s = syntheticData([
    makeDef(posilId, EMPTY, POSIL, { tags: ["Občan"] }),
    makeDef("partner", PARTNER_L, PARTNER_P, { tags: ["Občan"] }),
  ]);
  return {
    sada: s,
    posil: () => instanceFor(s, posilId, EMPTY, POSIL),
    partner: () => instanceFor(s, "partner", PARTNER_L, PARTNER_P),
  };
}

/** Línia hráča 0 bez lokality: strany[0] = [partner, posilňovač] → spoj posilňovač.pravá ↔ partner.ľavá. */
function linia(s: GameData, partner: PlacedCard, posil: PlacedCard): LineEval {
  return evaluateLine(s, { lokalita: null, lokalitaOtocena: false, strany: [[partner, posil], []] });
}

describe("§7 NA EX na kartu s Posilnením (O1, Michal 2026-10-24)", () => {
  it("zruší aj ×2 partnera na spoji — jeho akcia ostáva aktívna ×1", () => {
    const { sada: s, posil, partner } = sada();
    const p = partner();
    const bez = linia(s, lezi(p, 0), lezi(posil(), 0));
    expect(bez.sums[0].Pecka).toBe(2);

    const sNaex = linia(s, lezi(p, 0), lezi(posil(), 0, 1));
    expect(sNaex.sums[0].Pecka).toBe(1);
    expect(sNaex.cards.get(p.uid)?.left[0]).toMatchObject({ stav: "aktivna", nasobok: 1 });
    // Rozpis v paneli bitky už zdvojenie Posilnením neukazuje.
    expect(sNaex.zdroje[0].Pecka?.[0]?.dovody).not.toContain("Posilnenie");
    // Samotná karta s NA EX: neaktívna Rana sa zdvojí ako vždy.
    expect(sNaex.sums[0].Rana).toBe(2);
  });

  it("platí aj na súperovej karte: majiteľ partnera stratí ×2", () => {
    // Súperov posilňovač podstrčený vedľa partnera hráča 0; otočený o 180° — Posilnenie
    // musí byť na vytlačenej ľavej strane odzadu, aby ležalo na spoji.
    const obe: Layout4 = [null, null, null, "Posilnenie"];
    const s = syntheticData([makeDef("posil_obe", obe, POSIL, { tags: ["Občan"] }), makeDef("partner", PARTNER_L, PARTNER_P, { tags: ["Občan"] })]);
    const p = instanceFor(s, "partner", PARTNER_L, PARTNER_P);
    const posil = instanceFor(s, "posil_obe", obe, POSIL);
    const bez = linia(s, lezi(p, 0), lezi(posil, 1));
    const sNaex = linia(s, lezi(p, 0), lezi(posil, 1, 0));
    expect(bez.sums[0].Pecka).toBe(2);
    expect(sNaex.sums[0].Pecka).toBe(1);
    // Súperovi NA EX zdvojí jeho neaktívnu Ranu.
    expect(sNaex.sums[1].Rana).toBe(2);
  });

  it("partner s vlastným NA EX: jeho akcia na spoji je zrušená, zrušenie Posilnenia ju neoživí", () => {
    const { sada: s, posil, partner } = sada();
    const p = partner();
    const ev = linia(s, lezi(p, 0, 0), lezi(posil(), 0, 1));
    expect(ev.sums[0].Pecka ?? 0).toBe(0);
    expect(ev.cards.get(p.uid)?.left[0]).toMatchObject({ stav: "zrusena", nasobok: 0 });
    // Partnerov neaktívny Cigareta NA EX zdvojí.
    expect(ev.sums[0].Cigareta).toBe(2);
  });

  it("hrana lokality ostáva aktívna, ale bez ×2 od zrušeného Posilnenia", () => {
    const lok = makeDef("r_lok", ["Rana", null, null, null], EMPTY, { tags: ["Lokalita"] });
    const pri: Layout4 = ["Posilnenie", "Pecka", null, null];
    const karta = makeDef("r_pri", EMPTY, pri, { tags: ["Občan"] });
    const s = syntheticData([lok, karta]);
    const lokalita = instanceFor(s, "r_lok", ["Rana", null, null, null], EMPTY);
    const c = instanceFor(s, "r_pri", EMPTY, pri);
    const zLokality = (ev: LineEval): number => (ev.zdroje[0].Rana ?? []).filter((z) => z.vStrede).reduce((a, z) => a + z.hodnota, 0);
    const bez = evaluateLine(s, { lokalita, lokalitaOtocena: false, strany: [[lezi(c, 0)], []] });
    const sNaex = evaluateLine(s, { lokalita, lokalitaOtocena: false, strany: [[lezi(c, 0, 1)], []] });
    expect(zLokality(bez)).toBe(2);
    expect(zLokality(sNaex)).toBe(1);
    // Počet Pitiek sa nemení — hrana ostáva aktivovaná.
    expect(sNaex.aktivneStredu).toEqual(bez.aktivneStredu);
    expect(sNaex.sums[0].Pecka).toBe(2);
  });

  it("Veterán s Posilnením: NA EX ho nezruší, partner má ×2 ďalej", () => {
    const { sada: s, posil, partner } = sada("veteran");
    const p = partner();
    const ev = linia(s, lezi(p, 0), lezi(posil(), 0, 1));
    expect(ev.sums[0].Pecka).toBe(2);
    expect(ev.zdroje[0].Pecka?.[0]?.dovody).toContain("Posilnenie");
  });
});

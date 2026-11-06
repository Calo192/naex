// Výtržník vedľa Silnej nezávislej ženy (Michal 2026-11-06, „nezdvojuje, ako hra“, §7): jej Furt
// zdvojuje aktívne akcie tvojich susedov, no Rany Výtržníka platia vždy ×1.

import { describe, expect, it } from "vitest";
import type { Layout4 } from "./helpers.ts";
import { EMPTY, instanceFor, makeDef, syntheticData } from "./helpers.ts";
import type { CardInstance, LineState, PlacedCard } from "../src/index.ts";
import { evaluateLine } from "../src/index.ts";

const R: Layout4 = ["Rana", null, null, null];
const R1: Layout4 = [null, "Rana", null, null];
const sada = syntheticData([makeDef("silna_nezavisla_zena", R, R1, { tags: ["Občan", "Žena"] }), makeDef("chlap", R1, R, { tags: ["Občan", "Chlap"] }), makeDef("koniec", R1, EMPTY, { tags: ["Občan"] })]);
const rozlozenia: Record<string, [Layout4, Layout4]> = { silna_nezavisla_zena: [R, R1], chlap: [R1, R], koniec: [R1, EMPTY] };
const k = (id: string): CardInstance => {
  const [l, r] = rozlozenia[id] as [Layout4, Layout4];
  return instanceFor(sada, id, l, r);
};
const lezi = (id: string, extra: Partial<PlacedCard> = {}): PlacedCard => ({ card: k(id), playedBy: 0, ...extra });
const linia = (...karty: PlacedCard[]): LineState => ({ lokalita: null, lokalitaOtocena: false, strany: [[], karty] });
const VYTRZNIK: Partial<PlacedCard> = { naexBy: 0, naexBy2: 1, vytrznik: true };

describe("Výtržník vedľa Silnej nezávislej ženy", () => {
  it("bez zrážky žena suseda zdvojí, z Výtržníka má jeho Rany ×1", () => {
    const zena = lezi("silna_nezavisla_zena");
    const chlap = lezi("chlap");
    const bezZrazky = evaluateLine(sada, linia(zena, chlap)).zdroje[0].Rana?.find((z) => z.uid === chlap.card.uid);
    expect(bezZrazky?.hodnota).toBe(2);

    const vytrznik = { ...chlap, ...VYTRZNIK };
    const rany = (evaluateLine(sada, linia(zena, vytrznik)).zdroje[0].Rana ?? []).filter((z) => z.uid === chlap.card.uid);
    // Chlap má dve akcie na hranách — obe sú Rany Výtržníka, každá za 1.
    expect(rany.map((z) => z.hodnota)).toEqual([1, 1]);
  });

  it("rozpis pri Výtržníkovi žiadne zdvojenie neukáže (čip ×2 by klamal)", () => {
    const vytrznik = lezi("chlap", VYTRZNIK);
    const rany = (evaluateLine(sada, linia(lezi("silna_nezavisla_zena"), vytrznik)).zdroje[0].Rana ?? []).filter((z) => z.uid === vytrznik.card.uid);
    expect(rany.length).toBeGreaterThan(0);
    for (const z of rany) expect(z.dovody).toEqual([]);
  });
});

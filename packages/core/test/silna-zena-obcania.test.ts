// Silná nezávislá žena podporí len ľudí (Michal 2026-11-08): aktívne akcie susedných vlastných
// Občanov a Starešinov ×2; Zviera ani Nástroj nie, ani Občan so Zvieraťom (Recidivista).
// Lokalitu a súperove karty ako doteraz nie.

import { describe, expect, it } from "vitest";
import type { Layout4 } from "./helpers.ts";
import { EMPTY, instanceFor, makeDef, syntheticData } from "./helpers.ts";
import type { CardInstance, LineState, PlacedCard, Tag } from "../src/index.ts";
import { evaluateLine } from "../src/index.ts";

const R: Layout4 = ["Rana", null, null, null];
const R1: Layout4 = [null, "Rana", null, null];
const SUSEDIA: Record<string, readonly Tag[]> = {
  obcan: ["Občan", "Chlap"],
  staresina: ["Starešina"],
  nastroj: ["Nástroj"],
  zviera: ["Zviera"],
  recidivista: ["Občan", "Zviera"],
};
const sada = syntheticData([
  makeDef("silna_nezavisla_zena", R, R1, { tags: ["Občan", "Žena"] }),
  ...Object.entries(SUSEDIA).map(([id, tags]) => makeDef(id, R1, R, { tags })),
  makeDef("lok", R, R, { tags: ["Lokalita"] }),
]);
const k = (id: string): CardInstance => (id === "silna_nezavisla_zena" ? instanceFor(sada, id, R, R1) : instanceFor(sada, id, R1, R));
const lezi = (id: string, playedBy: 0 | 1 = 0): PlacedCard => ({ card: k(id), playedBy });
const ZENA = "karta:silna_nezavisla_zena";

/** Rany suseda vedľa Silnej ženy: hodnoty a či niektorú zdvojila ona. */
function ranySuseda(id: string, playedBy: 0 | 1 = 0): { hodnoty: number[]; odZeny: boolean } {
  const sused = lezi(id, playedBy);
  const linia: LineState = { lokalita: null, lokalitaOtocena: false, strany: [[], [lezi("silna_nezavisla_zena"), sused]] };
  const zdroje = (evaluateLine(sada, linia).zdroje[playedBy].Rana ?? []).filter((z) => z.uid === sused.card.uid);
  return { hodnoty: zdroje.map((z) => z.hodnota), odZeny: zdroje.some((z) => z.dovody.includes(ZENA)) };
}

describe("Silná nezávislá žena zdvojí len Občanov a Starešinov", () => {
  it.each(["obcan", "staresina"])("%s vedľa nej má aktívne akcie ×2", (id) => {
    const { hodnoty, odZeny } = ranySuseda(id);
    expect(odZeny).toBe(true);
    expect(hodnoty).toContain(2);
  });

  it.each(["nastroj", "zviera", "recidivista"])("%s vedľa nej ostane ×1", (id) => {
    const { hodnoty, odZeny } = ranySuseda(id);
    expect(hodnoty.length).toBeGreaterThan(0);
    expect(odZeny).toBe(false);
    expect(hodnoty.every((h) => h === 1)).toBe(true);
  });

  it("súperovho Občana nezdvojí", () => {
    expect(ranySuseda("obcan", 1).odZeny).toBe(false);
  });

  it("lokalitu vedľa nej nezdvojí", () => {
    const linia: LineState = { lokalita: instanceFor(sada, "lok", R, R), lokalitaOtocena: false, strany: [[], [lezi("silna_nezavisla_zena")]] };
    const ev = evaluateLine(sada, linia);
    const vsetky = [0, 1].flatMap((p) => Object.values(ev.zdroje[p as 0 | 1]).flatMap((z) => z ?? []));
    expect(vsetky.length).toBeGreaterThan(0);
    expect(vsetky.some((z) => z.dovody.includes(ZENA))).toBe(false);
  });
});

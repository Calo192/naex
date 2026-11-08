// Piktogramy rozhrania (Michal 2026-11-08, docs/napady/ikony-final.html): „+1“ v Dobratí
// a „−1“ v Odhodení musia mať zhodné písmo — kartu, „1“ aj vodorovnú čiaru znamienka.
// Odhodenie je preto Dobratie, z ktorého plusu ostalo len vodorovné rameno.

import { describe, expect, it } from "vitest";
import { IKONY } from "../src/karta/ikony.ts";

type Bod = readonly [number, number];

/** Rozdelí cestu na podcesty (každá začína M) a z rovných úsečiek vytiahne body. */
function podcesty(d: string): string[] {
  return d.split(/(?=M)/).map((p) => p.trim());
}

function body(podcesta: string): Bod[] {
  return [...podcesta.matchAll(/[ML]\s*(-?[\d.]+)[ ,](-?[\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])] as const);
}

function obdlznik(b: readonly Bod[]) {
  const xs = b.map((p) => p[0]);
  const ys = b.map((p) => p[1]);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
}

function jedinaCesta(kluc: keyof typeof IKONY): string {
  const cesty = IKONY[kluc];
  expect(cesty).toHaveLength(1);
  expect(cesty[0]!.evenOdd).toBe(true);
  return cesty[0]!.d;
}

describe("piktogramy rozhrania", () => {
  it("Odhodenie má tú istú kartu a tú istú „1“ ako Dobratie", () => {
    const [kartaPlus, plus, jednaPlus] = podcesty(jedinaCesta("Dobratie"));
    const [kartaMinus, minus, jednaMinus] = podcesty(jedinaCesta("Odhodenie"));
    expect(kartaMinus).toBe(kartaPlus);
    expect(jednaMinus).toBe(jednaPlus);
    expect(plus).toBeDefined();
    expect(minus).toBeDefined();
  });

  it("mínus je presne vodorovné rameno plusu (rovnaká hrúbka a šírka)", () => {
    const plus = body(podcesty(jedinaCesta("Dobratie"))[1]!);
    const minus = body(podcesty(jedinaCesta("Odhodenie"))[1]!);
    // Vodorovné rameno plusu: celá šírka plusu, výška podľa bodov na jeho ľavom okraji.
    const p = obdlznik(plus);
    const lavyOkraj = plus.filter((b) => b[0] === p.x0).map((b) => b[1]);
    const rameno = { x0: p.x0, x1: p.x1, y0: Math.min(...lavyOkraj), y1: Math.max(...lavyOkraj) };
    expect(minus).toHaveLength(4);
    expect(obdlznik(minus)).toEqual(rameno);
    // Zvislé rameno (body na hornom okraji plusu) má tú istú hrúbku ako mínus.
    const hornyOkraj = plus.filter((b) => b[1] === p.y0).map((b) => b[0]);
    expect(Math.max(...hornyOkraj) - Math.min(...hornyOkraj)).toBe(rameno.y1 - rameno.y0);
  });

  it("Dobratie, Odhodenie a Návrat zdieľajú kartu D-E", () => {
    const karta = podcesty(jedinaCesta("Dobratie"))[0];
    expect(podcesty(jedinaCesta("Návrat"))[0]).toBe(karta);
    expect(IKONY["Spálenie"].length).toBeGreaterThan(0);
  });
});

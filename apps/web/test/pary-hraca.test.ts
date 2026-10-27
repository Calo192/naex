// Pár farieb hráča (Michal 2026-10-27): zoznam v lib/paryHraca.ts, tóny v schemy.css
// a predvoľba v public/schema.js musia sedieť. Kontrast textu farbou hráča sa stráži
// vo všetkých 28 schémach (≥ 4,5 : 1 na --pozadie, --plocha aj --plocha-2).

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PARY, PAR_PREDVOLENY, popisParu, tonyParu, volbaDoUctu, volbaZUctu } from "../src/lib/paryHraca.ts";
import { SCHEMY } from "../src/lib/schemy.ts";

const CSS = readFileSync(new URL("../src/schemy.css", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const SCHEMA_JS = readFileSync(new URL("../public/schema.js", import.meta.url), "utf8");

/** Obsah bloku pravidla, ktorého selektor sa začína `zaciatok`. */
function blok(zaciatok: string): string {
  const i = CSS.indexOf(zaciatok);
  expect(i, zaciatok).toBeGreaterThanOrEqual(0);
  const od = CSS.indexOf("{", i);
  return CSS.slice(od + 1, CSS.indexOf("}", od));
}

function token(telo: string, meno: string): string | null {
  return new RegExp(`--${meno}:\\s*(#[0-9a-f]{6})`).exec(telo)?.[1] ?? null;
}

function jas(hex: string): number {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function kontrast(a: string, b: string): number {
  const [x, y] = [jas(a), jas(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

const tmaveTony = blok(":root {\n  --par-w20-1");
const svetleTony = blok(":root:is(");

describe("pár farieb hráča", () => {
  it("5 párov, predvolený Sifón a malinovka, názvy bez čísla Wadu", () => {
    expect(PARY.map((p) => p.id)).toEqual(["w20", "w9", "w67", "w106", "w287"]);
    expect(PAR_PREDVOLENY).toBe("w20");
    expect(PARY[0]?.nazov).toBe("Sifón a malinovka");
    for (const p of PARY) expect(p.nazov).not.toMatch(/\d/);
  });

  it("každý pár má oba tóny pre tmavé aj svetlé schémy a pravidlo s ⇄", () => {
    for (const p of PARY) {
      for (const t of [1, 2]) {
        expect(token(tmaveTony, `par-${p.id}-${t}`), `${p.id}-${t} tmavé`).not.toBeNull();
        expect(token(svetleTony, `par-${p.id}-${t}`), `${p.id}-${t} svetlé`).not.toBeNull();
      }
      expect(CSS).toContain(`:root[data-par="${p.id}"] { --ja: var(--par-${p.id}-1); --su: var(--par-${p.id}-2); }`);
      expect(CSS).toContain(`:root[data-par="${p.id}"][data-prehod] { --ja: var(--par-${p.id}-2); --su: var(--par-${p.id}-1); }`);
    }
  });

  it("svetlé tóny platia práve vo svetlých schémach", () => {
    const vSelektore = [...CSS.slice(CSS.indexOf(":root:is("), CSS.indexOf("{", CSS.indexOf(":root:is("))).matchAll(/data-schema="(\w+)"/g)].map((m) => m[1]);
    expect(vSelektore.sort()).toEqual(SCHEMY.filter((s) => !s.tmava).map((s) => s.id).sort());
  });

  it("text farbou hráča má v každej schéme aspoň 4,5 : 1", () => {
    for (const s of SCHEMY) {
      const telo = blok(s.id === "krcma" ? ":root,\n:root[data-schema=\"krcma\"]" : `:root[data-schema="${s.id}"]`);
      const pozadia = ["pozadie", "plocha", "plocha-2"].map((m) => token(telo, m));
      for (const p of PARY)
        for (const t of [1, 2]) {
          const farba = token(s.tmava ? tmaveTony : svetleTony, `par-${p.id}-${t}`) as string;
          for (const bg of pozadia) expect(kontrast(farba, bg as string), `${s.id} ${p.id}-${t} na ${bg}`).toBeGreaterThanOrEqual(4.5);
        }
    }
  });

  it("schema.js nastaví predvolený pár a prijme každý pár zo zoznamu", () => {
    expect(SCHEMA_JS).toContain(`setAttribute("data-par", "${PAR_PREDVOLENY}")`);
    const vzor = /\/(\^w\[0-9\]\{1,3\}\$)\//.exec(SCHEMA_JS)?.[1];
    expect(vzor).toBeDefined();
    for (const p of PARY) expect(new RegExp(vzor as string).test(p.id)).toBe(true);
  });

  it("voľba sa do účtu ukladá v jednom reťazci a neznámy pár padne na predvolený", () => {
    expect(volbaDoUctu({ par: "w67", prehod: true })).toBe("w67-prehod");
    expect(volbaZUctu("w67-prehod")).toEqual({ par: "w67", prehod: true });
    expect(volbaZUctu("w9")).toEqual({ par: "w9", prehod: false });
    expect(volbaZUctu("w999")).toEqual({ par: "w20", prehod: false });
    for (const p of PARY) for (const prehod of [false, true]) expect(volbaZUctu(volbaDoUctu({ par: p.id, prehod }))).toEqual({ par: p.id, prehod });
  });

  it("⇄ prehodí tóny aj slovný popis", () => {
    expect(tonyParu("w20", false)).toEqual({ ja: "var(--par-w20-1)", su: "var(--par-w20-2)" });
    expect(tonyParu("w20", true)).toEqual({ ja: "var(--par-w20-2)", su: "var(--par-w20-1)" });
    expect(popisParu(PARY[0]!, true)).toBe("ty ružová, súper tyrkysová");
  });
});

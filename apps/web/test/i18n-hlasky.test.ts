// Lokalizácia, vlna 3a: vzory hlášok motora (hlasky.ts) a kľúče, ktoré zrkadlia slovenské texty
// jadra — keď sa text v jadre zmení, sk.json ho musí dobehnúť, inak by sa slovenčina rozišla.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { NAZVY_ZDROJOV_PRISUNU, cigariet as cigarietJadra, kariet as karietJadra, spakov as spakovJadra } from "@naex/core";
import { najdiVzor, vzoryHlasok } from "../src/i18n/hlasky.ts";
import { preloz, type Slovnik } from "../src/i18n/preklad.ts";

const koren = join(import.meta.dirname, "..", "..", "..");
const sk = JSON.parse(readFileSync(join(koren, "apps/web/src/i18n/sk.json"), "utf8")) as Slovnik;
const elders = JSON.parse(readFileSync(join(koren, "packages/core/data/elders.json"), "utf8")) as { elders: { id: string; schopnost: string }[] };

describe("vzory hlášok motora", () => {
  const vzory = vzoryHlasok(sk);

  it("hláška sedí na vzor celá, čísla vyberajú tvar, meno je ľubovoľný text", () => {
    expect(najdiVzor("Fero z dolného konca už nemá čo vyložiť.", vzory)).toEqual({ kluc: "motor.nemaCoVylozit", p: { meno: "Fero z dolného konca" } });
    expect(najdiVzor("Exekútor: hráčovi 2 zhorí 3 priznané Dlhy a 3 špaky.", vzory)).toEqual({ kluc: "motor.exekutorDlhy", p: { hrac: "2", n2: 3, n: 3 } });
    expect(najdiVzor("Exekútor: hráčovi 1 zhorí 5 priznaných Dlhov a 0 špakov.", vzory)?.kluc).toBe("motor.exekutorDlhov");
    expect(najdiVzor("Niečo, čo vzor nemá.", vzory)).toBeNull();
    // Dlhší text za vzorom = iná hláška (napr. s Advokátom) — ostane po slovensky.
    expect(najdiVzor("Exekútor: hráčovi 1 zhorí 1 priznaný Dlh a 1 špak (Advokát ušetril 1 špak).", vzory)).toBeNull();
  });

  it("preklad vzoru dosadí časti hlášky a tvar podľa čísla", () => {
    const en: Slovnik = { "motor.exekutorDlhy": { "1": "Bailiff: player {hrac} burns {n2} Debts and {n} butt.", "5": "Bailiff: player {hrac} burns {n2} Debts and {n} butts." } };
    const z = najdiVzor("Exekútor: hráčovi 2 zhorí 3 priznané Dlhy a 3 špaky.", vzory);
    expect(z).not.toBeNull();
    if (z !== null) expect(preloz("en", en, {}, z.kluc, z.p)).toBe("Bailiff: player 2 burns 3 Debts and 3 butts.");
  });
});

describe("kľúče, ktoré zrkadlia texty jadra", () => {
  it("schopnosti väzňov sú v sk.json doslova ako v elders.json", () => {
    for (const e of elders.elders) expect(sk[`schopnost.${e.id}`], e.id).toBe(e.schopnost);
  });

  it("názvy zdrojov prísunu ako v jadre", () => {
    for (const [k, v] of Object.entries(NAZVY_ZDROJOV_PRISUNU)) expect(sk[`prisun.${k}`], k).toBe(v);
  });

  it("počítané slová v klientovi = tvary jadra", () => {
    for (const n of [0, 1, 2, 4, 5, 11, 22]) {
      expect(preloz("sk", null, sk, "pocet.spakov", { n })).toBe(spakovJadra(n));
      expect(preloz("sk", null, sk, "pocet.kariet", { n })).toBe(karietJadra(n));
      expect(preloz("sk", null, sk, "pocet.cigariet", { n })).toBe(cigarietJadra(n));
    }
  });
});

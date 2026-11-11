// Lokalizácia, vlna 3a: vzory hlášok motora (hlasky.ts) a kľúče, ktoré zrkadlia slovenské texty
// jadra — keď sa text v jadre zmení, sk.json ho musí dobehnúť, inak by sa slovenčina rozišla.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MA_DOST, NAZVY_ZDROJOV_PRISUNU, cigariet as cigarietJadra, kariet as karietJadra, spakov as spakovJadra } from "@naex/core";
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
    // S Advokátom je to iný vzor; ušetrené špaky sú časť, ktorá je sama vzorom (prelozHlasku ju preloží tiež).
    expect(najdiVzor("Exekútor: hráčovi 1 zhorí 1 priznaný Dlh a 1 špak (Advokát ušetril 2 špaky).", vzory)).toEqual({ kluc: "motor.exekutorAdvokatDlh", p: { hrac: "1", n2: 1, n: 1, usetril: "2 špaky" } });
    expect(najdiVzor("2 špaky", vzory)).toEqual({ kluc: "motor.spakov", p: { n: 2 } });
    // Dlhší text za vzorom = iná hláška — ostane po slovensky.
    expect(najdiVzor("Exekútor: hráčovi 1 zhorí 1 priznaný Dlh a 1 špak (a ešte niečo).", vzory)).toBeNull();
  });

  it("vzor hlášky s číslom berie len číslo — iná hláška s „získava“ naň nesedí", () => {
    expect(najdiVzor("Fero získava 3 cigarety.", vzory)).toEqual({ kluc: "motor.ziskavaCigarety", p: { meno: "Fero", n: 3 } });
    expect(najdiVzor("Fero získava Dlh.", vzory)).toBeNull();
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

describe("kľúče, ktoré zrkadlia texty jadra a servera (vlna 3c)", () => {
  const zdrojServera = (subor: string): string => readFileSync(join(koren, "packages/server/src", subor), "utf8");

  it("Má dosť starších v režime Päta, Lakeť, Otočka ako v jadre", () => {
    for (const [id, md] of Object.entries(MA_DOST)) expect(sk[`pata.maDost.${id}`], id).toBe(md.text);
  });

  it("kritériá známok a signály 2 na 2 ako na serveri", () => {
    const kriteria = [...zdrojServera("znamky.ts").matchAll(/\{ kluc: "(\w+)", nazov: "([^"]*)", otazka: "([^"]*)" \}/gu)];
    expect(kriteria.length).toBe(12);
    for (const [, kluc, nazov, otazka] of kriteria) {
      expect(sk[`kriterium.${kluc}.nazov`], kluc).toBe(nazov);
      expect(sk[`kriterium.${kluc}.otazka`], kluc).toBe(otazka);
    }
    const signaly = [...zdrojServera("stol2na2.ts").matchAll(/\{ id: "(\w+)", text: "([^"]*)" \}/gu)];
    expect(signaly.length).toBeGreaterThan(0);
    for (const [, id, text] of signaly) expect(sk[`stol2na2.signaly.${id}`], id).toBe(text);
  });

  it("dôvody, prečo schopnosť väzňa nemá účinok, sú vzory hlášok", () => {
    const engine = readFileSync(join(koren, "packages/core/src/engine.ts"), "utf8");
    const telo = engine.slice(engine.indexOf("export function schopnostBezUcinku"), engine.indexOf("export function", engine.indexOf("export function schopnostBezUcinku") + 10));
    const dovody = [...telo.matchAll(/"([^"]+\.)"/gu)].map((m) => m[1]!);
    expect(dovody.length).toBeGreaterThan(5);
    const vzory = vzoryHlasok(sk);
    for (const d of dovody) expect(najdiVzor(d, vzory)?.kluc.startsWith("motor.schopnost."), d).toBe(true);
  });
});

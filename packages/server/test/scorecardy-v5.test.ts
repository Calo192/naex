// Scorecardy pravidiel v5 na serveri (Admin 2026-10-25, zadanie scorecardy-v5-seed):
// čistá databáza dostane rozloženie v5 zo seedu; databáza so scorecardmi v4
// v tvorcovi (dnešný živý web) server v5 neskladá a hrá ďalej s v4, kým Admin
// nezverejní nové — štart nič sám nezverejní.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import type { Command, GameData, Podmienka } from "@naex/core";
import { KONSTANTY, apply, legalCommands, naTahu, parseScorecards, rngInt, rngSeed, setupGame } from "@naex/core";
import { AKCIE_20261019, doScorecardsJson } from "@naex/tvorba";
import scorecardsJson from "../../core/data/scorecards.json" with { type: "json" };
import { otvorDb } from "../src/db.ts";
import { Media } from "../src/media.ts";
import { Obsah } from "../src/obsah.ts";

const dir = mkdtempSync(join(tmpdir(), "naex-scorecardy-v5-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const jadro = parseScorecards(scorecardsJson);

/** Rozloženie seedu v4 (bodovacie.json do 2026-10-25) — tak dnes vyzerá živý tvorca. */
const V4: readonly (readonly [string, string, readonly Podmienka[], readonly Podmienka[]])[] = [
  ["ocumovatel", "Úžerník", ["dlh", "znepokojenie", "vydesenie", "starsi"], ["strach", "lokality", "znepokojenie", "cirhoza"]],
  ["veriaci", "Veriaci", ["cirhoza", "lokality", "strach", "znepokojenie"], ["vydesenie", "starsi", "lokality", "dlh"]],
  ["alkoholik", "Alkoholik", ["starsi", "strach", "starsi", "cigarety"], ["strach", "lokality", "vydesenie", "lokality"]],
  ["bitkar", "Bitkár", ["vydesenie", "lokality", "strach", "lokality"], ["strach", "lokality", "lokality", "cigarety"]],
  ["fajciar", "Fajčiar", ["strach", "cigarety", "lokality", "dlh"], ["cigarety", "znepokojenie", "starsi", "znepokojenie"]],
  ["lakomec", "Lakomec", ["dlh", "znepokojenie", "strach", "cirhoza"], ["dlh", "lokality", "dlh", "vydesenie"]],
  ["neprajnik", "Neprajník", ["znepokojenie", "vydesenie", "znepokojenie", "strach"], ["starsi", "cigarety", "cirhoza", "strach"]],
  ["exekutor", "Exekútor", ["lokality", "dlh", "cigarety", "vydesenie"], ["znepokojenie", "cirhoza", "dlh", "starsi"]],
];

/** Náhodná partia až do konca — hra so scorecardmi sady nesmie spadnúť. */
function dohraj(data: GameData, seed: number): void {
  let s = setupGame(data, seed);
  let rng = rngSeed(seed);
  for (let i = 0; i < 20000 && s.koniec === null; i++) {
    const p = naTahu(s);
    if (p === null) break;
    const cmds = legalCommands(data, s, p);
    const [j, r] = rngInt(rng, cmds.length);
    rng = r;
    s = apply(data, s, cmds[j] as Command, p).state;
  }
  expect(s.koniec).not.toBeNull();
}

/** Štart servera nad existujúcou databázou — tie isté kroky ako server.ts. */
function start(obsah: Obsah, teraz: number): void {
  obsah.naplnAkTreba(teraz);
  obsah.naplnBodovanieAkTreba(teraz);
  obsah.premenujZrusenePriazne(teraz);
  obsah.doplnChybajuceIlustracie(teraz);
  obsah.odstranZruseneKlucoveSlova(teraz);
  obsah.zjednotNazvyAkcii(teraz);
  obsah.dorovnajSoSeedom(teraz);
}

describe("scorecardy v5 na serveri", () => {
  it("čistá databáza: seed bodovacích kariet = scorecards.json v5 (priazeň, meno, podmienky) a hra ich načíta", () => {
    const db = otvorDb(join(dir, "cista.sqlite"));
    const obsah = new Obsah(db, new Media(db, dir));
    start(obsah, 1);
    const { data } = obsah.aktualnaSada();
    const tvar = (x: readonly { favour: string; nazov: string; lava: readonly unknown[]; prava: readonly unknown[] }[]) =>
      x.map((sc) => ({ favour: sc.favour, nazov: sc.nazov, lava: sc.lava, prava: sc.prava })).sort((a, b) => a.favour.localeCompare(b.favour));
    expect(tvar(data.scorecards)).toEqual(tvar(jadro.scorecards));
    expect(obsah.ikonyBodovania.vsetky().map((i) => i.podmienka)).toEqual(expect.arrayContaining(["abstak", "rezerva"]));
    dohraj(data, 3);
    db.close();
  });

  it("tvorca prijme Kmotra, Abstinenta, Výpalníka a ikony Absťák a Rezerva — sada v5 sa dá zverejniť", () => {
    const db = otvorDb(join(dir, "zverejnenie.sqlite"));
    const obsah = new Obsah(db, new Media(db, dir));
    start(obsah, 1);
    const { json, problemy } = doScorecardsJson(obsah.bodovacie.vsetky(), obsah.ikonyBodovania.vsetky(), jadro.body);
    expect(problemy).toEqual([]);
    expect((json as { scorecards: { favour: string; nazov: string }[] }).scorecards.filter((sc) => ["Kmotor", "Abstinent", "Výpalník"].includes(sc.nazov)).map((sc) => sc.favour).sort()).toEqual(["LAKOMEC", "NEPRAJNIK", "UZERNIK"]);
    const sada = obsah.zverejni(null, 2);
    expect(sada.verzia).toBeGreaterThan(0);
    db.close();
  });

  it("databáza so scorecardmi v4 (živý web): štart v5 nespadne, nič nezverejní ani nepremenuje a hra beží s rozložením v4", () => {
    const cesta = join(dir, "v4.sqlite");
    {
      const db = otvorDb(cesta);
      const obsah = new Obsah(db, new Media(db, dir));
      start(obsah, 1);
      // Tvorca ako dnes na živom webe: rozloženie a mená v4, zverejnené hráčom.
      for (const [id, nazov, lava, prava] of V4) {
        const b = obsah.bodovacie.vsetky().find((x) => x.id === id);
        if (b === undefined) throw new Error(`seed nemá bodovaciu kartu ${id}`);
        obsah.bodovacie.uloz(id, { ...b, nazov, lava: lava.map((p) => `ikona_${p}`), prava: prava.map((p) => `ikona_${p}`) });
      }
      obsah.zverejni(null, 2);
      db.close();
    }
    const db = otvorDb(cesta);
    const obsah = new Obsah(db, new Media(db, dir));
    const pred = obsah.aktualnaSada().sada.verzia;
    start(obsah, 3);
    const { sada, data } = obsah.aktualnaSada();
    expect(sada.verzia).toBe(pred);
    expect(obsah.bodovacie.vsetky().map((b) => b.nazov)).toEqual(expect.arrayContaining(["Úžerník", "Lakomec", "Neprajník"]));
    // Priazne starých mien hra pozná, rozloženie je v4 (bez Absťáku a Rezervy), body sú z jadra v5.
    const uzernik = data.scorecards.find((sc) => sc.favour === "UZERNIK");
    expect(uzernik?.nazov).toBe("Úžerník");
    expect(uzernik?.lava).toEqual(["dlh", "znepokojenie", "vydesenie", "starsi"]);
    expect(data.scorecards.find((sc) => sc.favour === "LAKOMEC")?.nazov).toBe("Lakomec");
    expect(data.scorecards.flatMap((sc) => [...sc.lava, ...sc.prava])).not.toContain("abstak");
    for (const seed of [1, 2]) dohraj(data, seed);
    db.close();
  });
});

describe("popis akcie Dlh v tvorcovi (v5)", () => {
  it("čísla sú z jadra: prah Dlhu; Exekútor bez prahu (2026-10-28) páli Dlhy aj špaky", () => {
    const dlh = AKCIE_20261019.find((a) => a.kluc === "Dlh")?.popis ?? "";
    expect(dlh).toContain(`za každé ${KONSTANTY.PRAH_DLHU_ZAKLAD} zadĺženia`);
    expect(dlh).toContain("príde v každej bitke Exekútor");
    expect(dlh).toContain("rovnako veľa špakov");
    expect(dlh).not.toMatch(/Úžerník|uberá bod|súboj o podmienku/);
  });
});

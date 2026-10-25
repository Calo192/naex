// Zrušené priazne a body za podmienky z jadra: Očumovateľa nahradil Zberateľ
// (Michal 2026-10-12) a Zberateľa Úžerník (Michal 2026-10-20). Existujúca
// databáza sa premenuje a staršie zverejnené sady hrajú s aktuálnymi bodmi.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { otvorDb } from "../src/db.ts";
import { Media } from "../src/media.ts";
import { Obsah } from "../src/obsah.ts";

const dir = mkdtempSync(join(tmpdir(), "naex-priazne-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("zrušené priazne Očumovateľ a Zberateľ", () => {
  for (const stare of ["Očumovateľ", "Zberateľ"]) {
    it(`bodovacia karta ${stare} sa premenuje na Kmotra (v5) a hra má priazeň UZERNIK`, () => {
      const db = otvorDb(join(dir, `naex-${stare}.sqlite`));
      const obsah = new Obsah(db, new Media(db, dir));
      obsah.naplnAkTreba(1);
      obsah.naplnBodovanieAkTreba(1);
      // Databáza spred premenovania: bodovacia karta sa volá po starom.
      const uzernik = obsah.bodovacie.vsetky().find((b) => b.nazov === "Kmotor");
      expect(uzernik).toBeDefined();
      obsah.bodovacie.uloz(uzernik!.id, { ...uzernik!, nazov: stare });

      obsah.premenujZrusenePriazne(2);
      expect(obsah.bodovacie.vsetky().some((b) => b.nazov === stare)).toBe(false);
      const { data } = obsah.aktualnaSada();
      expect(data.scorecards.some((sc) => sc.favour === "UZERNIK" && sc.nazov === "Kmotor")).toBe(true);
      // Body (vo v5 smer súboja) berie hra z jadra, nie zo zverejnenej sady.
      expect(data.bodyPodmienok.lokality).toBe(1);
      expect(data.bodyPodmienok.dlh).toBe(-1);
      db.close();
    });
  }
});

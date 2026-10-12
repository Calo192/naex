// Zberateľ namiesto Očumovateľa a body za podmienky z jadra (Michal 2026-10-12,
// playtest 20261012-055944): existujúca databáza sa premenuje a staršie
// zverejnené sady hrajú s aktuálnymi bodmi.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { otvorDb } from "../src/db.ts";
import { Media } from "../src/media.ts";
import { Obsah } from "../src/obsah.ts";

const dir = mkdtempSync(join(tmpdir(), "naex-priazne-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("zrušená priazeň Očumovateľ", () => {
  it("bodovacia karta sa premenuje na Zberateľa a hra má priazeň ZBERATEL", () => {
    const db = otvorDb(join(dir, "naex.sqlite"));
    const obsah = new Obsah(db, new Media(db, dir));
    obsah.naplnAkTreba(1);
    obsah.naplnBodovanieAkTreba(1);
    // Databáza spred premenovania: bodovacia karta sa volá po starom.
    const zberatel = obsah.bodovacie.vsetky().find((b) => b.nazov === "Zberateľ");
    expect(zberatel).toBeDefined();
    obsah.bodovacie.uloz(zberatel!.id, { ...zberatel!, nazov: "Očumovateľ" });

    obsah.premenujZrusenePriazne(2);
    expect(obsah.bodovacie.vsetky().some((b) => b.nazov === "Očumovateľ")).toBe(false);
    const { data } = obsah.aktualnaSada();
    expect(data.scorecards.some((sc) => sc.favour === "ZBERATEL" && sc.nazov === "Zberateľ")).toBe(true);
    // Body za kus berie hra z jadra, nie zo zverejnenej sady.
    expect(data.bodyPodmienok.lokality).toBe(2);
    expect(data.bodyPodmienok.starsi).toBe(2);
    db.close();
  });
});

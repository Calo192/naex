// Dorovnanie tvorcu so sadou v repozitári (Michal 2026-10-20): produkčný server
// so starou sadou (bez nových kariet a kľúčových slov) pri štarte prevezme
// cards.json a seed/ a zverejní novú verziu. Nezverejnenú prácu admina neprepíše.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { KartaNavrh } from "@naex/tvorba";
import { otvorDb } from "../src/db.ts";
import { Media } from "../src/media.ts";
import { Obsah } from "../src/obsah.ts";

const upratat: (() => void)[] = [];
afterEach(() => {
  for (const f of upratat.splice(0)) f();
});

function priprav(): { obsah: Obsah; db: ReturnType<typeof otvorDb> } {
  const dir = mkdtempSync(join(tmpdir(), "naex-dorovnanie-"));
  const db = otvorDb(join(dir, "naex.sqlite"));
  upratat.push(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const obsah = new Obsah(db, new Media(db, dir));
  obsah.naplnAkTreba(1);
  return { obsah, db };
}

const pocetSad = (db: ReturnType<typeof otvorDb>): number => (db.prepare("SELECT count(*) n FROM sady").get() as { n: number }).n;

/** Tvorca ako na produkcii pred 2026-10-20: bez Presbitera a Prevahy, stará Pasca, všetko zverejnené. */
function staraProdukcia(obsah: Obsah, db: ReturnType<typeof otvorDb>): void {
  db.prepare("DELETE FROM karty WHERE id = 'presbiter'").run();
  const pasca = obsah.karty.jeden("pasca") as KartaNavrh;
  obsah.ulozKartu({ ...pasca, efekt: "Dedičstvo: Akcie prvej karty, ktorú ti súper podstrčí, neplatia.", upravene: 2 });
  obsah.klucoveSlova.zmaz("Prevaha");
  obsah.zverejni(null, 3);
}

describe("dorovnanie tvorcu so seedom", () => {
  it("čistá databáza z aktuálneho seedu nič nemení ani nezverejňuje", () => {
    const { obsah, db } = priprav();
    const pred = pocetSad(db);
    expect(obsah.dorovnajSoSeedom(10)).toBe("bez-zmeny");
    expect(pocetSad(db)).toBe(pred);
  });

  it("stará sada dostane nové karty s ilustráciou, texty a kľúčové slová a zverejní sa raz", () => {
    const { obsah, db } = priprav();
    staraProdukcia(obsah, db);
    const pred = pocetSad(db);
    expect(obsah.dorovnajSoSeedom(10)).toBe("hotovo");
    expect(pocetSad(db)).toBe(pred + 1);
    expect(obsah.karty.jeden("presbiter")?.obrazok).not.toBeNull();
    expect(obsah.karty.jeden("pasca")?.efekt).toContain("Zviera");
    expect(obsah.klucoveSlova.jeden("Prevaha")).not.toBeNull();
    const sada = obsah.aktualnaSada().sada;
    expect(sada.karty.map((k) => k.id)).toContain("presbiter");
    expect(sada.karty.find((k) => k.id === "krcma")?.lava.kraj).toBe("pri výčape");
    // Druhý štart už nič nerobí.
    expect(obsah.dorovnajSoSeedom(20)).toBe("uz-bezalo");
    expect(pocetSad(db)).toBe(pred + 1);
  });

  it("popisy akcií a kľúčových slov z pravidiel M23 prepíše, názov a ikonu akcie nechá", () => {
    const { obsah, db } = priprav();
    const robota = obsah.akcie.jeden("Robota");
    if (robota === null) throw new Error("chýba Robota");
    obsah.akcie.uloz("Robota", { ...robota, nazov: "Fuška", popis: "Pred kontrolou prahu Exekútora odhodí 1 priznaný Dlh." });
    const vyhra = obsah.klucoveSlova.jeden("Výhra");
    if (vyhra === null) throw new Error("chýba Výhra");
    obsah.klucoveSlova.uloz("Výhra", { ...vyhra, popis: "Uplatní sa, keď vyhráš bitku o lokalitu alebo o staršieho." });
    obsah.zverejni(null, 3);
    expect(obsah.dorovnajSoSeedom(10)).toBe("hotovo");
    const sada = obsah.aktualnaSada().sada;
    const nova = sada.akcie.find((a) => a.kluc === "Robota");
    expect(nova?.popis).toContain("spáli");
    expect(nova?.nazov).toBe("Fuška");
    expect(sada.klucoveSlova.find((k) => k.slovo === "Výhra")?.popis).toContain("sekeru");
    expect(pocetSad(db)).toBeGreaterThan(1);
  });

  it("nezverejnenú prácu admina neprepíše", () => {
    const { obsah, db } = priprav();
    staraProdukcia(obsah, db);
    const pasca = obsah.karty.jeden("pasca") as KartaNavrh;
    obsah.ulozKartu({ ...pasca, efekt: "Rozpracované adminom.", upravene: 5 });
    expect(obsah.dorovnajSoSeedom(10)).toBe("preskocene");
    expect(obsah.karty.jeden("pasca")?.efekt).toBe("Rozpracované adminom.");
  });
});

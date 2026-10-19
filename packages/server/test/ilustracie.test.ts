// Chýbajúce ilustrácie zo seed/: databáza, ktorá vznikla skôr, než karta
// dostala obrázok v seede, ho pri štarte doplní — v návrhu aj vo zverejnenej
// sade — a ilustráciu nastavenú adminom nechá tak.

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
  const dir = mkdtempSync(join(tmpdir(), "naex-ilustracie-"));
  const db = otvorDb(join(dir, "naex.sqlite"));
  upratat.push(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const obsah = new Obsah(db, new Media(db, dir));
  obsah.naplnAkTreba(1);
  return { obsah, db };
}

/** Zmaže ilustráciu karty v návrhu aj v poslednej sade — ako na serveri založenom zo starého seedu. */
function bezIlustracie(db: ReturnType<typeof otvorDb>, id: string): void {
  const r = db.prepare("SELECT data FROM karty WHERE id = ?").get(id) as { data: string };
  db.prepare("UPDATE karty SET data = ? WHERE id = ?").run(JSON.stringify({ ...JSON.parse(r.data), obrazok: null }), id);
  const s = db.prepare("SELECT verzia, data FROM sady ORDER BY verzia DESC LIMIT 1").get() as { verzia: number; data: string };
  const sada = JSON.parse(s.data) as { karty: KartaNavrh[] };
  const karty = sada.karty.map((k) => (k.id === id ? { ...k, obrazok: null } : k));
  db.prepare("UPDATE sady SET data = ? WHERE verzia = ?").run(JSON.stringify({ ...sada, karty }), s.verzia);
}

const obrazokVSade = (obsah: Obsah, id: string): KartaNavrh["obrazok"] | undefined =>
  obsah.aktualnaSada().sada.karty.find((k) => k.id === id)?.obrazok;

describe("chýbajúce ilustrácie zo seedu", () => {
  it("Anonymný alkoholik má ilustráciu už pri prvom štarte", () => {
    const { obsah } = priprav();
    expect(obrazokVSade(obsah, "anonymny_alkoholik")).not.toBeNull();
  });

  it("doplní ilustráciu do návrhu aj do sady, adminovu nezmení", () => {
    const { obsah, db } = priprav();
    const verzia = obsah.aktualnaSada().sada.verzia;
    const admina = obrazokVSade(obsah, "pijan");
    bezIlustracie(db, "anonymny_alkoholik");
    (obsah as unknown as { cache: null }).cache = null;
    expect(obrazokVSade(obsah, "anonymny_alkoholik")).toBeNull();

    obsah.doplnChybajuceIlustracie(2);
    const sada = obsah.aktualnaSada().sada;
    expect(sada.verzia).toBe(verzia + 1);
    expect(obrazokVSade(obsah, "anonymny_alkoholik")).not.toBeNull();
    expect(obrazokVSade(obsah, "pijan")).toEqual(admina);

    // Opakovaný štart už nič nemení — žiadna ďalšia verzia sady.
    obsah.doplnChybajuceIlustracie(3);
    expect(obsah.aktualnaSada().sada.verzia).toBe(verzia + 1);
  });
});

describe("zrušené kľúčové slová", () => {
  it("Trocha a Zopár zmiznú z tvorcu aj zo zverejnenej sady", () => {
    const { obsah, db } = priprav();
    // Stará databáza: slová sú v tvorcovi aj v sade.
    const slovo = (s: string) => ({ slovo: s, tvary: [], tucne: false, kurziva: true, farba: null, popis: s });
    for (const s of ["trocha", "zopár"]) db.prepare("INSERT INTO klucove_slova (slovo, data) VALUES (?, ?)").run(s, JSON.stringify(slovo(s)));
    const r = db.prepare("SELECT verzia, data FROM sady ORDER BY verzia DESC LIMIT 1").get() as { verzia: number; data: string };
    const sada = JSON.parse(r.data) as { klucoveSlova: unknown[] };
    db.prepare("UPDATE sady SET data = ? WHERE verzia = ?").run(JSON.stringify({ ...sada, klucoveSlova: [...sada.klucoveSlova, slovo("trocha"), slovo("zopár")] }), r.verzia);
    (obsah as unknown as { cache: null }).cache = null;

    obsah.odstranZruseneKlucoveSlova(2);
    const nova = obsah.aktualnaSada().sada;
    expect(nova.verzia).toBe(r.verzia + 1);
    expect(nova.klucoveSlova.map((k) => k.slovo)).not.toContain("trocha");
    expect(nova.klucoveSlova.map((k) => k.slovo)).not.toContain("zopár");
    expect(obsah.vzhlad().klucoveSlova.map((k) => k.slovo)).not.toContain("trocha");
    expect(nova.klucoveSlova.map((k) => k.slovo)).toContain("zahoď");
  });
});

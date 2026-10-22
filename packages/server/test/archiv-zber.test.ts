// Zber dát pre profily (Michal 2026-10-22): archív aj pre partie s botom,
// dĺžka, verzia jadra a pravidiel, seed a príkazy na budúci prehrávač.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { prazdneStatistiky } from "@naex/core";
import { Archiv } from "../src/archiv.ts";
import { Ucty } from "../src/auth.ts";
import { otvorDb } from "../src/db.ts";

function docasnaDb(): { db: ReturnType<typeof otvorDb>; zmaz: () => void } {
  const dir = mkdtempSync(join(tmpdir(), "naex-zber-"));
  const db = otvorDb(join(dir, "naex.db"));
  return { db, zmaz: () => { db.close(); rmSync(dir, { recursive: true, force: true }); } };
}

describe("archív — zber dát", () => {
  it("partia s botom: bot bez účtu, Frajerina sa nemení, ranky ju nerátajú; seed, príkazy a verzie sa uložia", () => {
    const { db, zmaz } = docasnaDb();
    try {
      const ucty = new Ucty(db, { login: "Admin", heslo: null });
      const archiv = new Archiv(db);
      const jano = ucty.registruj("jano", "tajneheslo", "Jano", 1);
      const prikazy = [[0, { type: "chooseLocation", uid: 3, otocena: false }], [1, { type: "vzdat" }]];
      const { id, zmeny } = archiv.zapis({
        kod: "BOT1", zaciatok: 10, koniec: 20, vitaz: 0, dovod: "Partiu vzdáva Štamgast.", kola: 1, verziaSady: 7, dohrata: false,
        hraci: [jano.id, null], sBotom: true, botPovaha: "stamgast", dlzka: "kratka", verziaJadra: "abc123", verziaPravidiel: "2026-10-22",
        seed: 4242, prikazy, kronika: [{ kolo: 1 }], body: null, statistiky: [prazdneStatistiky(), prazdneStatistiky()],
      });
      expect(zmeny).toEqual([{ pred: 1200, po: 1200 }, { pred: 0, po: 0 }]);
      const r = db.prepare("SELECT s_botom, bot_povaha, dlzka, verzia_jadra, verzia_pravidiel, seed, prikazy, kronika FROM partie WHERE id = ?").get(id) as Record<string, unknown>;
      expect(r).toMatchObject({ s_botom: 1, bot_povaha: "stamgast", dlzka: "kratka", verzia_jadra: "abc123", verzia_pravidiel: "2026-10-22", seed: 4242 });
      expect(JSON.parse(String(r.prikazy))).toEqual(prikazy);
      expect(JSON.parse(String(r.kronika))).toEqual([{ kolo: 1 }]);
      const miesta = db.prepare("SELECT miesto, pouzivatel FROM partie_hraci WHERE partia = ? ORDER BY miesto").all(id) as { miesto: number; pouzivatel: number | null }[];
      expect(miesta).toEqual([{ miesto: 0, pouzivatel: jano.id }, { miesto: 1, pouzivatel: null }]);
      expect(archiv.frajerina(jano.id).partie).toBe(0);
      expect(ucty.dohrate(jano.id)).toBe(0);
      const p = archiv.profil(jano.id)!;
      expect(p.bilancia).toMatchObject({ ludia: { partie: 0 }, boti: { partie: 1, vyhry: 1 } });
      expect(p.statistiky.partie).toBe(0);
    } finally {
      zmaz();
    }
  });
});

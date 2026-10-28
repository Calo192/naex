// Príbeh a účel karty (Michal 2026-10-26): admin ich píše v tvorcovi, idú so
// zverejnenou sadou (sada.karty aj cardsJson) a hra ich nečíta. Karty bez nich
// a staré databázy musia fungovať ako doteraz.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { KartaNavrh } from "@naex/tvorba";
import { ChybaVstupu } from "../src/auth.ts";
import { overNavrh } from "../src/api.ts";
import { otvorDb } from "../src/db.ts";
import { Media } from "../src/media.ts";
import { Obsah } from "../src/obsah.ts";
import { prihlas, testovaciServer } from "./pomocnik.ts";

const upratat: (() => void)[] = [];
afterEach(() => {
  for (const f of upratat.splice(0)) f();
});

function priprav(): { obsah: Obsah; db: ReturnType<typeof otvorDb> } {
  const dir = mkdtempSync(join(tmpdir(), "naex-pribeh-"));
  const db = otvorDb(join(dir, "naex.sqlite"));
  upratat.push(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const obsah = new Obsah(db, new Media(db, dir));
  obsah.naplnAkTreba(1);
  return { obsah, db };
}

const pijan = (obsah: Obsah): KartaNavrh => {
  const k = obsah.karty.jeden("pijan");
  if (k === null) throw new Error("chýba pijan");
  return k;
};

describe("príbeh a účel karty — kontrola vstupu", () => {
  it("nepovinné texty: prázdne a chýbajúce sa neuložia, konce riadkov ako v prehliadači", () => {
    const { obsah } = priprav();
    const k = pijan(obsah);
    const bez = overNavrh({ ...k }, "pijan", 5);
    expect("pribeh" in bez || "ucel" in bez).toBe(false);
    const prazdne = overNavrh({ ...k, pribeh: "  \r\n", ucel: null }, "pijan", 5);
    expect("pribeh" in prazdne || "ucel" in prazdne).toBe(false);
    const s = overNavrh({ ...k, pribeh: "Prvý.\r\n\r\nDruhý.", ucel: "- zahranie" }, "pijan", 5);
    expect(s.pribeh).toBe("Prvý.\n\nDruhý.");
    expect(s.ucel).toBe("- zahranie");
    expect(() => overNavrh({ ...k, pribeh: 7 }, "pijan", 5)).toThrow(ChybaVstupu);
    expect(() => overNavrh({ ...k, ucel: "x".repeat(4001) }, "pijan", 5)).toThrow(ChybaVstupu);
  });
});

describe("príbeh a účel karty — sada", () => {
  it("prvá sada z cards.json bez textov ich nemá a hra beží", () => {
    const { obsah } = priprav();
    const { sada, data } = obsah.aktualnaSada();
    expect(sada.karty.some((k) => "pribeh" in k || "ucel" in k)).toBe(false);
    expect((sada.cardsJson as { cards: object[] }).cards.some((c) => "pribeh" in c || "ucel" in c)).toBe(false);
    expect(data.cards.size).toBe(sada.karty.length);
  });

  it("zverejnenie prenesie texty v sada.karty aj cardsJson; jadro ich nečíta", () => {
    const { obsah } = priprav();
    obsah.ulozKartu({ ...pijan(obsah), pribeh: "Sedí pri výčape od rána.", ucel: "- Drž ho na Pitku.", upravene: 2 });
    const sada = obsah.zverejni(null, 3);
    expect(sada.karty.find((k) => k.id === "pijan")?.pribeh).toBe("Sedí pri výčape od rána.");
    const c = (sada.cardsJson as { cards: { id: string; pribeh?: string; ucel?: string }[] }).cards.find((x) => x.id === "pijan");
    expect(c?.pribeh).toBe("Sedí pri výčape od rána.");
    expect(c?.ucel).toBe("- Drž ho na Pitku.");
    const def = obsah.aktualnaSada().data.cards.get("pijan");
    expect(def).toBeDefined();
    expect(Object.keys(def ?? {})).not.toContain("pribeh");
    expect(Object.keys(def ?? {})).not.toContain("ucel");
  });

  it("dorovnanie so seedom texty v tvorcovi nezmaže, keď ich cards.json nemá", () => {
    const { obsah, db } = priprav();
    // Stará produkcia: iný efekt Pijana, zverejnené — dorovnanie Pijana prepíše podľa cards.json.
    obsah.ulozKartu({ ...pijan(obsah), efekt: "Starý efekt.", pribeh: "Príbeh z tvorcu.", ucel: "Účel z tvorcu.", upravene: 2 });
    obsah.zverejni(null, 3);
    const pred = (db.prepare("SELECT count(*) n FROM sady").get() as { n: number }).n;
    expect(obsah.dorovnajSoSeedom(10, "test-pribeh")).toBe("hotovo");
    expect((db.prepare("SELECT count(*) n FROM sady").get() as { n: number }).n).toBe(pred + 1);
    const po = pijan(obsah);
    expect(po.efekt).not.toBe("Starý efekt.");
    expect(po.pribeh).toBe("Príbeh z tvorcu.");
    expect(po.ucel).toBe("Účel z tvorcu.");
    expect(obsah.aktualnaSada().sada.karty.find((k) => k.id === "pijan")?.pribeh).toBe("Príbeh z tvorcu.");
  });
});

describe("príbeh a účel karty — admin API", () => {
  it("PUT, zverejnenie, /api/sada, export a import TXT", async () => {
    const { server, zmaz } = await testovaciServer({ login: "Sef", heslo: "sefovo-testovacie" });
    try {
      const cookie = await prihlas(server.port, "Sef", "sefovo-testovacie");
      const api = (cesta: string, init: RequestInit = {}, typ = "application/json") =>
        fetch(`http://127.0.0.1:${server.port}/api${cesta}`, { ...init, headers: { "x-naex": "1", "content-type": typ, cookie } });
      const obsah = (await (await api("/admin/obsah")).json()) as { karty: KartaNavrh[] };
      const k = obsah.karty.find((x) => x.id === "pijan");
      if (k === undefined) throw new Error("chýba pijan");
      const ulozena = (await (await api("/admin/karty/pijan", { method: "PUT", body: JSON.stringify({ ...k, pribeh: "Starý pijan.", ucel: "- Prvé zahranie\n- Druhé" }) })).json()) as KartaNavrh;
      expect(ulozena.ucel).toBe("- Prvé zahranie\n- Druhé");
      expect((await api("/admin/karty/pijan", { method: "PUT", body: JSON.stringify({ ...k, pribeh: ["zlé"] }) })).status).toBe(400);
      await api("/admin/karty/pijan", { method: "PUT", body: JSON.stringify(ulozena) });
      expect((await api("/admin/zverejnit", { method: "POST" })).status).toBe(200);

      const sada = (await (await fetch(`http://127.0.0.1:${server.port}/api/sada`)).json()) as {
        karty: KartaNavrh[];
        cardsJson: { cards: { id: string; pribeh?: string; ucel?: string }[] };
      };
      expect(sada.karty.find((x) => x.id === "pijan")?.pribeh).toBe("Starý pijan.");
      expect(sada.cardsJson.cards.find((x) => x.id === "pijan")?.ucel).toBe("- Prvé zahranie\n- Druhé");
      expect(sada.karty.filter((x) => x.pribeh !== undefined).map((x) => x.id)).toEqual(["pijan"]);

      const txt = await (await api("/admin/export")).text();
      expect(txt).toContain("STORY:\n  Starý pijan.");
      // Súbor bez STORY a PURPOSE (export z MAUI) texty nechá; export s „(none)“ ich zmaže.
      const bezTextov = txt.replace(/^STORY:[\s\S]*?(?=\n\n)/gm, "").replace(/^PURPOSE:.*$/gm, "");
      expect((await api("/admin/import", { method: "POST", body: bezTextov }, "text/plain; charset=utf-8")).status).toBe(200);
      const po = (await (await api("/admin/obsah")).json()) as { karty: KartaNavrh[] };
      expect(po.karty.find((x) => x.id === "pijan")?.pribeh).toBe("Starý pijan.");
      const zmazane = txt.replace(/STORY:\n {2}Starý pijan\.\nPURPOSE:\n {2}- Prvé zahranie\n {2}- Druhé/, "STORY: (none)\nPURPOSE: (none)");
      expect(zmazane).not.toBe(txt);
      expect((await api("/admin/import", { method: "POST", body: zmazane }, "text/plain; charset=utf-8")).status).toBe(200);
      const poZmazani = (await (await api("/admin/obsah")).json()) as { karty: KartaNavrh[] };
      const p = poZmazani.karty.find((x) => x.id === "pijan");
      expect(p !== undefined && ("pribeh" in p || "ucel" in p)).toBe(false);
    } finally {
      await zmaz();
    }
  });
});

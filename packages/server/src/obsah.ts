// Obsah tvorcu kariet (návrhy, akcie, kľúčové slová, kategórie, bodovacie
// karty) a zverejnené sady. Hra a glosár bežia vždy nad POSLEDNOU ZVEREJNENOU
// sadou — rozpracované návrhy admina hráči nevidia.

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import type { GameData } from "@naex/core";
import { loadGameData } from "@naex/core";
import type {
  AkciaDef,
  BodovaciaKarta,
  IkonaBodovania,
  KartaNavrh,
  Kategoria,
  KlucoveSlovo,
  Nastavenia,
  Pozicia,
  Sada,
  StranaNavrhu,
} from "@naex/tvorba";
import {
  PREDVOLENE_AKCIE,
  PREDVOLENE_KATEGORIE,
  PREDVOLENE_KLUCOVE_SLOVA,
  PREDVOLENE_NASTAVENIA,
  chybyNavrhu,
  doCardsJson,
  neznameAkcie,
} from "@naex/tvorba";
import type { Db } from "./db.ts";
import { JsonTabulka, transakcia } from "./db.ts";
import type { Media } from "./media.ts";
import { ChybaVstupu } from "./auth.ts";

const CORE_DATA = fileURLToPath(new URL("../../core/data/", import.meta.url));
const SEED = fileURLToPath(new URL("../seed/", import.meta.url));

export function nacitajElders(): unknown {
  return JSON.parse(readFileSync(join(CORE_DATA, "elders.json"), "utf8")) as unknown;
}

interface SeedNavrh {
  readonly id: string;
  readonly farba: string;
  readonly sirkaMm: number;
  readonly vyskaMm: number;
  readonly mierkaTextu: number;
  readonly mierkaIkon: number;
  readonly kopie: number;
  readonly obrazok: string;
}

type RawSide = { blocked: Pozicia[]; actions: Record<string, number>; allowed?: Record<string, string[]> };
type RawCard = { id: string; name: string; tags: string[]; effect_text: string; left: RawSide; right: RawSide };

function stranaZJson(s: RawSide): StranaNavrhu {
  return {
    blokovane: s.blocked,
    akcie: s.actions,
    povolene: Object.fromEntries(Object.entries(s.allowed ?? {}).map(([k, v]) => [Number(k), v])),
  };
}

export class Obsah {
  readonly karty: JsonTabulka<KartaNavrh>;
  readonly akcie: JsonTabulka<AkciaDef>;
  readonly klucoveSlova: JsonTabulka<KlucoveSlovo>;
  readonly kategorie: JsonTabulka<Kategoria>;
  readonly bodovacie: JsonTabulka<BodovaciaKarta>;
  readonly ikonyBodovania: JsonTabulka<IkonaBodovania>;
  private readonly nastaveniaT: JsonTabulka<unknown>;
  private readonly elders: unknown;
  private cache: { sada: Sada; data: GameData } | null = null;

  constructor(
    private readonly db: Db,
    private readonly media: Media,
  ) {
    this.karty = new JsonTabulka(db, "karty", "id", "poradie, id");
    this.akcie = new JsonTabulka(db, "akcie", "kluc");
    this.klucoveSlova = new JsonTabulka(db, "klucove_slova", "slovo");
    this.kategorie = new JsonTabulka(db, "kategorie", "nazov");
    this.bodovacie = new JsonTabulka(db, "bodovacie_karty", "id");
    this.ikonyBodovania = new JsonTabulka(db, "ikony_bodovania", "id");
    this.nastaveniaT = new JsonTabulka(db, "nastavenia", "kluc");
    this.elders = nacitajElders();
  }

  // -------------------------------------------------------------------------
  // Prvé spustenie: tlačová sada z repozitára

  naplnAkTreba(teraz: number): void {
    if (this.karty.pocet() > 0) return;
    const cards = (JSON.parse(readFileSync(join(CORE_DATA, "cards.json"), "utf8")) as { cards: RawCard[] }).cards;
    const seedPath = join(SEED, "navrhy.json");
    const navrhy = existsSync(seedPath) ? (JSON.parse(readFileSync(seedPath, "utf8")) as SeedNavrh[]) : [];
    transakcia(this.db, () => {
      cards.forEach((c, i) => {
        const s = navrhy.find((n) => n.id === c.id);
        const obrazok = s === undefined ? null : this.seedObrazok(s.obrazok, teraz);
        this.ulozKartu(
          {
            id: c.id,
            nazov: c.name,
            tagy: c.tags,
            efekt: c.effect_text,
            obrazok,
            // Farba v tlači zodpovedá kategórii — návrh ju preberá z tagov.
            farba: null,
            mierkaTextu: s?.mierkaTextu ?? PREDVOLENE_NASTAVENIA.mierkaTextu,
            mierkaIkon: s?.mierkaIkon ?? PREDVOLENE_NASTAVENIA.mierkaIkon,
            sirkaMm: s?.sirkaMm ?? PREDVOLENE_NASTAVENIA.sirkaMm,
            vyskaMm: s?.vyskaMm ?? PREDVOLENE_NASTAVENIA.vyskaMm,
            kopie: s?.kopie ?? 1,
            lava: stranaZJson(c.left),
            prava: stranaZJson(c.right),
            upravene: teraz,
          },
          i,
        );
      });
      for (const a of PREDVOLENE_AKCIE) this.akcie.uloz(a.kluc, a);
      for (const k of PREDVOLENE_KLUCOVE_SLOVA) this.klucoveSlova.uloz(k.slovo, k);
      for (const k of PREDVOLENE_KATEGORIE) this.kategorie.uloz(k.nazov, k);
      this.nastaveniaT.uloz("predvolene", PREDVOLENE_NASTAVENIA);
    });
    this.zverejni(null, teraz);
  }

  private seedObrazok(subor: string, teraz: number): KartaNavrh["obrazok"] {
    const plny = join(SEED, "karty", subor);
    const nahlad = join(SEED, "karty", subor.replace(/\.jpg$/, "@512.jpg"));
    if (!existsSync(plny)) return null;
    const p = this.media.uloz(readFileSync(plny), "karta", subor, teraz, ["image/jpeg"]);
    const n = existsSync(nahlad) ? this.media.uloz(readFileSync(nahlad), "karta", subor, teraz, ["image/jpeg"]) : p;
    return { plny: p.id, nahlad: n.id };
  }

  // -------------------------------------------------------------------------
  // Návrhy

  ulozKartu(k: KartaNavrh, poradie?: number): void {
    const p =
      poradie ??
      ((this.db.prepare("SELECT poradie FROM karty WHERE id = ?").get(k.id) as { poradie: number } | undefined)?.poradie ??
        ((this.db.prepare("SELECT MAX(poradie) AS m FROM karty").get() as { m: number | null }).m ?? -1) + 1);
    this.db
      .prepare("INSERT INTO karty (id, poradie, data) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data, poradie = excluded.poradie")
      .run(k.id, p, JSON.stringify(k));
  }

  nastavenia(): Nastavenia {
    return (this.nastaveniaT.jeden("predvolene") as Nastavenia | null) ?? PREDVOLENE_NASTAVENIA;
  }

  ulozNastavenia(n: Nastavenia): void {
    this.nastaveniaT.uloz("predvolene", n);
  }

  vzhlad(): Pick<Sada, "akcie" | "klucoveSlova" | "kategorie"> {
    return {
      akcie: this.akcie.vsetky().sort((a, b) => a.poradie - b.poradie),
      klucoveSlova: this.klucoveSlova.vsetky(),
      kategorie: this.kategorie.vsetky(),
    };
  }

  // -------------------------------------------------------------------------
  // Zverejnenie

  /** Overí návrhy a uloží novú sadu; pri chybe vyhodí zoznam problémov. */
  zverejni(autor: number | null, teraz: number): Sada {
    const karty = this.karty.vsetky();
    const problemy: string[] = [];
    for (const k of karty) {
      for (const ch of chybyNavrhu(k)) problemy.push(`${k.nazov}: ${ch}`);
      const nezname = neznameAkcie(k);
      if (nezname.length > 0) {
        const nazvy = nezname.map((a) => this.akcie.jeden(a)?.nazov ?? a).join(", ");
        problemy.push(`${k.nazov}: akcia ${nazvy} nemá v hre pravidlá — najprv ju treba naprogramovať v jadre.`);
      }
    }
    const cardsJson = doCardsJson(karty, `tvorca kariet ${new Date(teraz).toISOString()}`);
    if (problemy.length === 0) {
      try {
        loadGameData(cardsJson, this.elders);
      } catch (err) {
        problemy.push(err instanceof Error ? err.message : String(err));
      }
    }
    if (problemy.length > 0) throw new ChybaVstupu(`Sadu nemožno zverejniť:\n${problemy.join("\n")}`, 422);

    const obsah = { cas: teraz, karty, cardsJson, ...this.vzhlad() };
    const r = this.db.prepare("INSERT INTO sady (cas, autor, data) VALUES (?, ?, ?)").run(teraz, autor, JSON.stringify(obsah));
    this.cache = null;
    return { verzia: Number(r.lastInsertRowid), ...obsah };
  }

  aktualnaSada(): { sada: Sada; data: GameData } {
    if (this.cache !== null) return this.cache;
    const r = this.db.prepare("SELECT verzia, data FROM sady ORDER BY verzia DESC LIMIT 1").get() as
      | { verzia: number; data: string }
      | undefined;
    if (r === undefined) throw new Error("Žiadna zverejnená sada — server sa nenaplnil.");
    const sada = { verzia: r.verzia, ...(JSON.parse(r.data) as Omit<Sada, "verzia">) };
    this.cache = { sada, data: loadGameData(sada.cardsJson, this.elders) };
    return this.cache;
  }

  historiaSad(): { verzia: number; cas: number; autor: number | null; kariet: number }[] {
    const rows = this.db.prepare("SELECT verzia, cas, autor, data FROM sady ORDER BY verzia DESC LIMIT 50").all() as {
      verzia: number;
      cas: number;
      autor: number | null;
      data: string;
    }[];
    return rows.map((r) => ({
      verzia: r.verzia,
      cas: r.cas,
      autor: r.autor,
      kariet: (JSON.parse(r.data) as { karty: unknown[] }).karty.length,
    }));
  }

  get eldersJson(): unknown {
    return this.elders;
  }
}

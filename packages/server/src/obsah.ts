// Obsah tvorcu kariet (návrhy, akcie, kľúčové slová, kategórie, bodovacie
// karty) a zverejnené sady. Hra a glosár bežia vždy nad POSLEDNOU ZVEREJNENOU
// sadou — rozpracované návrhy admina hráči nevidia.

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import type { GameData, Podmienka } from "@naex/core";
import { loadGameData, parseScorecards } from "@naex/core";
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
  AKCIE_20261019,
  PREDVOLENE_AKCIE,
  PREDVOLENE_KATEGORIE,
  PREDVOLENE_KLUCOVE_SLOVA,
  PREDVOLENE_NASTAVENIA,
  chybyNavrhu,
  doCardsJson,
  doScorecardsJson,
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

/** Východiskové scorecardy z repozitára — pre sady zverejnené pred ich zavedením. */
export function nacitajScorecards(): unknown {
  return JSON.parse(readFileSync(join(CORE_DATA, "scorecards.json"), "utf8")) as unknown;
}

interface SeedBodovanie {
  readonly nazvyIkon: Readonly<Record<Podmienka, string>>;
  readonly bodovacie: readonly {
    readonly id: string;
    readonly nazov: string;
    readonly sirkaMm: number;
    readonly vyskaMm: number;
    readonly mierkaIkon: number;
    readonly lava: readonly (Podmienka | null)[];
    readonly prava: readonly (Podmienka | null)[];
    readonly pozadie: string;
  }[];
}

interface SeedNavrh {
  readonly id: string;
  /** null = farba podľa kategórie (tagov). */
  readonly farba: string | null;
  readonly sirkaMm: number;
  readonly vyskaMm: number;
  readonly mierkaTextu: number;
  readonly mierkaIkon: number;
  readonly kopie: number;
  readonly obrazok: string;
}

type RawSide = { blocked: Pozicia[]; actions: Record<string, number>; allowed?: Record<string, string[]>; name?: string };
type RawCard = { id: string; name: string; tags: string[]; effect_text: string; left: RawSide; right: RawSide };

/** Strana návrhu v porovnateľnom tvare (poradie kľúčov akcií a pozícií). */
function rovnaStrana(s: StranaNavrhu): unknown {
  const zoradene = <T>(o: Readonly<Record<string, T>>) => Object.entries(o).sort(([a], [b]) => a.localeCompare(b));
  return [[...s.blokovane].sort(), zoradene(s.akcie), zoradene(s.povolene as Record<string, readonly string[]>), s.kraj ?? null];
}

function stranaZJson(s: RawSide): StranaNavrhu {
  return {
    blokovane: s.blocked,
    akcie: s.actions,
    povolene: Object.fromEntries(Object.entries(s.allowed ?? {}).map(([k, v]) => [Number(k), v])),
    ...(s.name === undefined ? {} : { kraj: s.name }),
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
  private readonly scorecardsPredvolene: unknown;
  private cache: { sada: Sada; data: GameData } | null = null;
  /** Herné dáta starších sád pre prehrávač partie (sada sa po zverejnení nemení). */
  private readonly dataSad = new Map<number, GameData>();

  private readonly db: Db;
  private readonly media: Media;

  constructor(db: Db, media: Media) {
    this.db = db;
    this.media = media;
    this.karty = new JsonTabulka(db, "karty", "id", "poradie, id");
    this.akcie = new JsonTabulka(db, "akcie", "kluc");
    this.klucoveSlova = new JsonTabulka(db, "klucove_slova", "slovo");
    this.kategorie = new JsonTabulka(db, "kategorie", "nazov");
    this.bodovacie = new JsonTabulka(db, "bodovacie_karty", "id");
    this.ikonyBodovania = new JsonTabulka(db, "ikony_bodovania", "id");
    this.nastaveniaT = new JsonTabulka(db, "nastavenia", "kluc");
    this.elders = nacitajElders();
    this.scorecardsPredvolene = nacitajScorecards();
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
    // Ešte pred prvou sadou — zverejní sa jedna verzia so všetkým.
    this.naplnBodovanieAkTreba(teraz);
    this.zverejni(null, teraz);
  }

  /**
   * Scorecardy z KartyAI (seed/bodovanie) do databázy, ktorá ich ešte nemá.
   * Do sady sa doplnia novou verziou s rovnakými kartami — rozpracované
   * návrhy admina sa tým nezverejnia.
   */
  naplnBodovanieAkTreba(teraz: number): void {
    if (this.bodovacie.pocet() > 0 || this.ikonyBodovania.pocet() > 0) return;
    const dir = join(SEED, "bodovanie");
    const seedPath = join(dir, "bodovacie.json");
    if (!existsSync(seedPath)) return;
    const seed = JSON.parse(readFileSync(seedPath, "utf8")) as SeedBodovanie;
    transakcia(this.db, () => {
      for (const [podmienka, nazov] of Object.entries(seed.nazvyIkon) as [Podmienka, string][]) {
        const subor = join(dir, "ikony", `${podmienka}.svg`);
        if (!existsSync(subor)) continue;
        const m = this.media.uloz(readFileSync(subor), "ikona", `${podmienka}.svg`, teraz, ["image/svg+xml"]);
        this.ikonyBodovania.uloz(`ikona_${podmienka}`, { id: `ikona_${podmienka}`, nazov, media: m.id, podmienka });
      }
      for (const b of seed.bodovacie) {
        const subor = join(dir, "pozadia", b.pozadie);
        const pozadie = existsSync(subor) ? this.media.uloz(readFileSync(subor), "pozadie", b.pozadie, teraz, ["image/jpeg"]).id : null;
        const ikona = (p: Podmienka | null): string | null => (p === null ? null : `ikona_${p}`);
        this.bodovacie.uloz(b.id, {
          id: b.id,
          nazov: b.nazov,
          sirkaMm: b.sirkaMm,
          vyskaMm: b.vyskaMm,
          mierkaIkon: b.mierkaIkon,
          farba: null,
          pozadie,
          lava: b.lava.map(ikona),
          prava: b.prava.map(ikona),
          upravene: teraz,
        });
      }
    });
    this.prezverejniBodovanie(teraz);
  }

  /**
   * Očumovateľa nahradil Zberateľ (Michal 2026-10-12), Zberateľa Úžerník
   * (2026-10-20) a Úžerníka v pravidlách v5 Kmotor: bodovacia karta so ZRUŠENÝM
   * menom sa v databáze premenuje a scorecardy sa zverejnia nanovo s rovnakými
   * kartami. Úžerník, Lakomec a Neprajník sa tu zámerne nepremenúvajú — mená hra
   * ďalej pozná (aliasy priazní), a prezverejnenie by hráčom bez súhlasu Michala
   * vydalo nové scorecardy; v5 do tvorcu zapíše Admin a zverejní so súhlasom.
   */
  premenujZrusenePriazne(teraz: number): void {
    const stare = this.bodovacie.vsetky().filter((b) => b.nazov === "Očumovateľ" || b.nazov === "Zberateľ");
    if (stare.length === 0) return;
    transakcia(this.db, () => {
      for (const b of stare) this.bodovacie.uloz(b.id, { ...b, nazov: "Kmotor", upravene: teraz });
    });
    this.prezverejniBodovanie(teraz);
  }

  /**
   * Karty bez ilustrácie, ku ktorým seed už ilustráciu má, ju dostanú — v
   * návrhu aj vo zverejnenej sade (nová verzia s rovnakými kartami, takže
   * rozpracované návrhy sa nezverejnia). Ilustráciu, ktorú admin nastavil,
   * neprepisuje. Prečo: Anonymný alkoholik pribudol do sady skôr než do
   * seed/, a server založený z čistej databázy ho mal bez obrázka.
   */
  doplnChybajuceIlustracie(teraz: number): void {
    const seedPath = join(SEED, "navrhy.json");
    if (!existsSync(seedPath)) return;
    const navrhy = JSON.parse(readFileSync(seedPath, "utf8")) as SeedNavrh[];
    const zoSeedu = (id: string): KartaNavrh["obrazok"] => {
      const s = navrhy.find((n) => n.id === id);
      return s === undefined ? null : this.seedObrazok(s.obrazok, teraz);
    };
    const doplnene = new Map<string, NonNullable<KartaNavrh["obrazok"]>>();
    transakcia(this.db, () => {
      for (const k of this.karty.vsetky()) {
        if (k.obrazok !== null) continue;
        const obrazok = zoSeedu(k.id);
        if (obrazok === null) continue;
        doplnene.set(k.id, obrazok);
        this.ulozKartu({ ...k, obrazok });
      }
    });
    const posledna = this.db.prepare("SELECT data FROM sady ORDER BY verzia DESC LIMIT 1").get() as { data: string } | undefined;
    if (posledna === undefined) return;
    const stara = JSON.parse(posledna.data) as Omit<Sada, "verzia">;
    let zmena = false;
    const karty = stara.karty.map((k) => {
      if (k.obrazok !== null) return k;
      const obrazok = doplnene.get(k.id) ?? zoSeedu(k.id);
      if (obrazok === null) return k;
      zmena = true;
      return { ...k, obrazok };
    });
    if (!zmena) return;
    this.db.prepare("INSERT INTO sady (cas, autor, data) VALUES (?, ?, ?)").run(teraz, null, JSON.stringify({ ...stara, cas: teraz, karty }));
    this.cache = null;
  }

  /**
   * Kľúčové slová Trocha a Zopár zrušila revízia kariet (Michal 2026-10-18):
   * efekty majú pevné čísla. Zo starých databáz sa odstránia z tvorcu aj zo
   * zverejnenej sady (nová verzia s rovnakými kartami) — inak by ich pravidlá
   * na webe stále ukazovali.
   */
  odstranZruseneKlucoveSlova(teraz: number): void {
    const zrusene = new Set(["trocha", "zopár"]);
    transakcia(this.db, () => {
      for (const k of this.klucoveSlova.vsetky()) if (zrusene.has(k.slovo.toLowerCase())) this.klucoveSlova.zmaz(k.slovo);
    });
    const posledna = this.db.prepare("SELECT data FROM sady ORDER BY verzia DESC LIMIT 1").get() as { data: string } | undefined;
    if (posledna === undefined) return;
    const stara = JSON.parse(posledna.data) as Omit<Sada, "verzia">;
    const klucoveSlova = stara.klucoveSlova.filter((k) => !zrusene.has(k.slovo.toLowerCase()));
    if (klucoveSlova.length === stara.klucoveSlova.length) return;
    this.db.prepare("INSERT INTO sady (cas, autor, data) VALUES (?, ?, ?)").run(teraz, null, JSON.stringify({ ...stara, cas: teraz, klucoveSlova }));
    this.cache = null;
  }

  /**
   * Jednotné názvy akcií a nová Vízia (Michal 2026-10-19): kľúč Cigaretka sa
   * premenuje na Cigareta v tvorcovi (akcie, karty) aj vo zverejnenej sade
   * (nová verzia s rovnakými kartami) a názvy a popisy akcií sa prepíšu podľa
   * AKCIE_20261019 — inak by hráči videli Hazard, Poldecko a starú Víziu.
   * Beží raz; značku si pamätá v nastaveniach.
   */
  zjednotNazvyAkcii(teraz: number): void {
    const ZNACKA = "migracia-akcie-20261019";
    if (this.nastaveniaT.jeden(ZNACKA) !== null) return;
    const premenuj = <T>(x: T): T => JSON.parse(JSON.stringify(x).replaceAll('"Cigaretka"', '"Cigareta"')) as T;
    const upravAkciu = (a: AkciaDef): AkciaDef => {
      const kluc = a.kluc === "Cigaretka" ? "Cigareta" : a.kluc;
      const nova = AKCIE_20261019.find((x) => x.kluc === kluc);
      return nova === undefined ? { ...a, kluc } : { ...a, kluc, nazov: nova.nazov, popis: nova.popis };
    };
    transakcia(this.db, () => {
      for (const a of this.akcie.vsetky()) {
        const nova = upravAkciu(a);
        if (nova.kluc !== a.kluc) this.akcie.zmaz(a.kluc);
        this.akcie.uloz(nova.kluc, nova);
      }
      for (const k of this.karty.vsetky()) {
        const nova = premenuj(k);
        if (JSON.stringify(nova) !== JSON.stringify(k)) this.ulozKartu(nova);
      }
      this.nastaveniaT.uloz(ZNACKA, { cas: teraz });
    });
    const posledna = this.db.prepare("SELECT data FROM sady ORDER BY verzia DESC LIMIT 1").get() as { data: string } | undefined;
    if (posledna === undefined) return;
    const stara = JSON.parse(posledna.data) as Omit<Sada, "verzia">;
    const nova = { ...premenuj(stara), akcie: stara.akcie.map(upravAkciu) };
    // Čistá databáza má už nové názvy — bez zmeny netreba novú verziu.
    if (JSON.stringify(nova) === JSON.stringify(stara)) return;
    this.db.prepare("INSERT INTO sady (cas, autor, data) VALUES (?, ?, ?)").run(teraz, null, JSON.stringify({ ...nova, cas: teraz }));
    this.cache = null;
  }

  /**
   * Dorovnanie tvorcu so sadou v repozitári (Michal 2026-10-20: „make it part
   * of live website“). Produkčný server má vlastnú databázu; nasadenie prenáša
   * len kód. Návrhy kariet sa prepíšu podľa data/cards.json (texty, tagy,
   * akcie, kraje) a seed/ (kópie, mierky, ilustrácie), chýbajúce pribudnú,
   * kľúčové slová a popisy vstavaných akcií sa doplnia z predvolených a tvorca
   * sa zverejní. Beží raz pre každú značku (nová značka pri každej zmene
   * cards.json); preskočí sa, ak má tvorca nezverejnenú prácu (návrh upravený
   * po poslednom zverejnení) — tú by prepísal.
   */
  dorovnajSoSeedom(teraz: number, znacka = "migracia-sada-v15-20261024"):"hotovo" | "bez-zmeny" | "preskocene" | "uz-bezalo" {
    if (this.nastaveniaT.jeden(znacka) !== null) return "uz-bezalo";
    const posledna = this.db.prepare("SELECT cas FROM sady ORDER BY verzia DESC LIMIT 1").get() as { cas: number } | undefined;
    const navrhy = this.karty.vsetky();
    if (posledna !== undefined && navrhy.some((k) => k.upravene > posledna.cas)) {
      console.warn(`Tvorca má nezverejnené návrhy — ${znacka} sa preskakuje (dorovnaj ručne).`);
      return "preskocene";
    }
    const cards = (JSON.parse(readFileSync(join(CORE_DATA, "cards.json"), "utf8")) as { cards: RawCard[] }).cards;
    const seedPath = join(SEED, "navrhy.json");
    const seed = existsSync(seedPath) ? (JSON.parse(readFileSync(seedPath, "utf8")) as SeedNavrh[]) : [];
    const kluc = (k: KartaNavrh): string =>
      JSON.stringify([k.nazov, k.tagy, k.efekt, k.obrazok, k.farba, k.mierkaTextu, k.mierkaIkon, k.sirkaMm, k.vyskaMm, k.kopie, rovnaStrana(k.lava), rovnaStrana(k.prava)]);
    let zmena = false;
    transakcia(this.db, () => {
      cards.forEach((c, i) => {
        const stary = this.karty.jeden(c.id);
        const s = seed.find((n) => n.id === c.id);
        const obrazok = (s === undefined ? null : this.seedObrazok(s.obrazok, teraz)) ?? stary?.obrazok ?? null;
        const novy: KartaNavrh = {
          id: c.id,
          nazov: c.name,
          tagy: c.tags,
          efekt: c.effect_text,
          obrazok,
          farba: s !== undefined ? s.farba : (stary?.farba ?? null),
          mierkaTextu: s?.mierkaTextu ?? stary?.mierkaTextu ?? PREDVOLENE_NASTAVENIA.mierkaTextu,
          mierkaIkon: s?.mierkaIkon ?? stary?.mierkaIkon ?? PREDVOLENE_NASTAVENIA.mierkaIkon,
          sirkaMm: s?.sirkaMm ?? stary?.sirkaMm ?? PREDVOLENE_NASTAVENIA.sirkaMm,
          vyskaMm: s?.vyskaMm ?? stary?.vyskaMm ?? PREDVOLENE_NASTAVENIA.vyskaMm,
          kopie: s?.kopie ?? stary?.kopie ?? 1,
          lava: stranaZJson(c.left),
          prava: stranaZJson(c.right),
          upravene: teraz,
        };
        if (stary !== null && kluc(stary) === kluc(novy)) return;
        zmena = true;
        this.ulozKartu(novy, stary === null ? navrhy.length + i : undefined);
      });
      for (const k of PREDVOLENE_KLUCOVE_SLOVA) {
        const stare = this.klucoveSlova.jeden(k.slovo);
        if (stare !== null && JSON.stringify(stare) === JSON.stringify(k)) continue;
        zmena = true;
        this.klucoveSlova.uloz(k.slovo, k);
      }
      // Popisy vstavaných akcií idú s pravidlami (M23: Robota, Dlh, Poškodenie
      // pečene); názov, ikonu a poradie z tvorcu nechá.
      for (const a of PREDVOLENE_AKCIE) {
        const stara = this.akcie.jeden(a.kluc);
        if (stara === null || stara.popis === a.popis) continue;
        zmena = true;
        this.akcie.uloz(a.kluc, { ...stara, popis: a.popis });
      }
      this.nastaveniaT.uloz(znacka, { cas: teraz });
    });
    if (!zmena) return "bez-zmeny";
    this.zverejni(null, teraz);
    return "hotovo";
  }

  /** Nová verzia sady s rovnakými kartami a aktuálnymi scorecardmi z tvorcu. */
  private prezverejniBodovanie(teraz: number): void {
    const posledna = this.db.prepare("SELECT data FROM sady ORDER BY verzia DESC LIMIT 1").get() as { data: string } | undefined;
    if (posledna === undefined) return;
    const stara = JSON.parse(posledna.data) as Omit<Sada, "verzia">;
    const obsah = { ...stara, cas: teraz, ...this.bodovanieSady() };
    loadGameData(obsah.cardsJson, this.elders, obsah.scorecardsJson);
    this.db.prepare("INSERT INTO sady (cas, autor, data) VALUES (?, ?, ?)").run(teraz, null, JSON.stringify(obsah));
    this.cache = null;
  }

  /** Scorecardy pre sadu z bodovacích kariet tvorcu (prázdny tvorca → východiskové z repozitára). */
  private bodovanieSady(): { scorecardsJson: unknown; bodovacie: BodovaciaKarta[]; ikonyBodovania: IkonaBodovania[]; problemy: string[] } {
    const bodovacie = this.bodovacie.vsetky();
    const ikonyBodovania = this.ikonyBodovania.vsetky();
    if (bodovacie.length === 0) return { scorecardsJson: this.scorecardsPredvolene, bodovacie, ikonyBodovania, problemy: [] };
    const body = parseScorecards(this.scorecardsPredvolene).body;
    const { json, problemy } = doScorecardsJson(bodovacie, ikonyBodovania, body);
    return { scorecardsJson: json, bodovacie, ikonyBodovania, problemy: [...problemy] };
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
    const { problemy: problemyBodovania, ...bodovanie } = this.bodovanieSady();
    problemy.push(...problemyBodovania);
    if (problemy.length === 0) {
      try {
        loadGameData(cardsJson, this.elders, bodovanie.scorecardsJson);
      } catch (err) {
        problemy.push(err instanceof Error ? err.message : String(err));
      }
    }
    if (problemy.length > 0) throw new ChybaVstupu(`Sadu nemožno zverejniť:\n${problemy.join("\n")}`, 422);

    const obsah = { cas: teraz, karty, cardsJson, ...bodovanie, ...this.vzhlad() };
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
    const ulozena = { verzia: r.verzia, ...(JSON.parse(r.data) as Omit<Sada, "verzia">) };
    // Sady spred scorecardov hrajú s východiskovými z repozitára. Body za
    // podmienky sú herné hodnoty jadra — platia aj pre staršie sady.
    const scorecards = (ulozena.scorecardsJson ?? this.scorecardsPredvolene) as Record<string, unknown>;
    const body = (this.scorecardsPredvolene as { body: unknown }).body;
    const sada: Sada = { ...ulozena, scorecardsJson: { ...scorecards, body } };
    this.cache = { sada, data: loadGameData(sada.cardsJson, this.elders, sada.scorecardsJson) };
    return this.cache;
  }

  /**
   * Herné dáta zverejnenej sady `verzia` — prehrávač partie (roadmapa #18) prehrá
   * partiu na tej sade, na ktorej sa hrala. null = sada neexistuje alebo ju jadro nenačíta.
   */
  dataSady(verzia: number): GameData | null {
    const v = this.dataSad.get(verzia);
    if (v !== undefined) return v;
    const r = this.db.prepare("SELECT data FROM sady WHERE verzia = ?").get(verzia) as { data: string } | undefined;
    if (r === undefined) return null;
    const ulozena = JSON.parse(r.data) as Omit<Sada, "verzia">;
    const body = (this.scorecardsPredvolene as { body: unknown }).body;
    const scorecards = { ...((ulozena.scorecardsJson ?? this.scorecardsPredvolene) as Record<string, unknown>), body };
    try {
      const data = loadGameData(ulozena.cardsJson, this.elders, scorecards);
      this.dataSad.set(verzia, data);
      return data;
    } catch {
      return null;
    }
  }

  /**
   * Návrat na staršiu sadu: jej obsah sa zverejní znova ako nová verzia
   * (história sa neprepisuje). S `navrhy` sa do tvorcu vrátia aj návrhy
   * kariet tej sady; návrhy, ktoré v nej neboli, ostanú nedotknuté.
   */
  obnovSadu(verzia: number, autor: number, teraz: number, navrhy: boolean): { verzia: number; kariet: number; mimoSady: string[] } {
    const r = this.db.prepare("SELECT data FROM sady WHERE verzia = ?").get(verzia) as { data: string } | undefined;
    if (r === undefined) throw new ChybaVstupu(`Sada v${verzia} neexistuje.`, 404);
    const stara = JSON.parse(r.data) as Omit<Sada, "verzia">;
    const body = (this.scorecardsPredvolene as { body: unknown }).body;
    const scorecards = { ...((stara.scorecardsJson ?? this.scorecardsPredvolene) as Record<string, unknown>), body };
    try {
      loadGameData(stara.cardsJson, this.elders, scorecards);
    } catch (err) {
      throw new ChybaVstupu(`Sadu v${verzia} súčasná hra nevie načítať: ${err instanceof Error ? err.message : String(err)}`, 422);
    }
    const nova = this.db.prepare("INSERT INTO sady (cas, autor, data) VALUES (?, ?, ?)").run(teraz, autor, JSON.stringify({ ...stara, cas: teraz }));
    this.cache = null;
    const ids = new Set(stara.karty.map((k) => k.id));
    if (navrhy) {
      transakcia(this.db, () => {
        stara.karty.forEach((k, i) => this.ulozKartu({ ...k, upravene: teraz }, i));
      });
    }
    return { verzia: Number(nova.lastInsertRowid), kariet: stara.karty.length, mimoSady: this.karty.vsetky().filter((k) => !ids.has(k.id)).map((k) => k.id) };
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

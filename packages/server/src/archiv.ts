// Archív dohraných partií: Frajerina, štatistiky pre profil a rebríček.
//
// Každá dohraná partia je jeden riadok v `partie` a dva v `partie_hraci`
// (štatistiky hráča ako JSON z @naex/core). Profil je súčet týchto riadkov —
// pri desiatkach či stovkách partií na hráča to zvládne aj prostý JS.

import type { DvojicaStatistik, StatistikyHraca, StatistikyKariet } from "@naex/core";
import { normalizujStatistiky, normalizujStatistikyKariet, prazdneStatistiky, scitajStatistiky, scitajStatistikyKariet } from "@naex/core";
import type { Db } from "./db.ts";
import { transakcia } from "./db.ts";
import type { Vysledok } from "./frajerina.ts";
import { FRAJERINA_START, PROVIZORNE_PARTIE, novaFrajerina, titul } from "./frajerina.ts";

export interface StavFrajeriny {
  readonly hodnota: number;
  readonly najvyssia: number;
  readonly partie: number;
  readonly vyhry: number;
  readonly prehry: number;
  readonly remizy: number;
}

export interface ZaznamPartie {
  readonly kod: string;
  readonly zaciatok: number;
  readonly koniec: number;
  readonly vitaz: 0 | 1 | null;
  readonly dovod: string;
  readonly kola: number;
  readonly verziaSady: number | null;
  /** Dohratá podľa pravidiel (nie vzdaná ani kontumovaná). */
  readonly dohrata: boolean;
  /** Id používateľov na miestach 0 a 1. */
  readonly hraci: readonly [number, number];
  /** Mení Frajerinu — false, keď jeden z hráčov nemá právo na hodnotené partie (predvolene true). */
  readonly hodnotena?: boolean;
  readonly body: readonly [number, number] | null;
  readonly statistiky: DvojicaStatistik;
  /** Štatistiky kariet partie (podklad pre rebalans). */
  readonly statistikyKariet?: StatistikyKariet;
}

export interface ZmenaFrajeriny {
  readonly pred: number;
  readonly po: number;
}

interface HracVerejny {
  readonly id: number | null;
  readonly meno: string;
  readonly avatar: string | null;
}

export interface PartiaVProfile {
  readonly id: number;
  readonly koniec: number;
  readonly trvanie: number;
  readonly kola: number;
  readonly dovod: string;
  readonly vysledok: Vysledok;
  /** Body [moje, súperove] — len partie ukončené záverečným bodovaním. */
  readonly body: readonly [number, number] | null;
  readonly frajerina: ZmenaFrajeriny;
  readonly super: HracVerejny & { readonly frajerina: number };
}

/** Kto sa na profil pozerá (Michal 2026-10-22): vlastník, cudzí človek, správca. */
export type PohladProfilu = "vlastny" | "cudzi" | "spravca";

export interface Bilancia {
  readonly partie: number;
  readonly vyhry: number;
  readonly prehry: number;
  readonly remizy: number;
}

export interface ProfilHraca {
  readonly pohlad: PohladProfilu;
  /** Profil AI playtestera — hráči ho nevidia; správca dostane pás „Skrytý profil“. */
  readonly skryty: boolean;
  readonly hrac: HracVerejny & { readonly id: number; readonly rola: string; readonly vytvoreny: number; readonly ai: boolean };
  /** Bilancia podľa súpera: s ľuďmi a s botmi (počet partií s botmi vidí aj cudzí). */
  readonly bilancia: { readonly ludia: Bilancia; readonly boti: Bilancia };
  /** Výsledky 5 posledných partií s ľuďmi, najnovší prvý. */
  readonly forma: readonly Vysledok[];
  /** Len pri cudzom profile: bilancia toho, kto sa pozerá, proti tomuto hráčovi (z jeho pohľadu). */
  readonly vyDvaja: Bilancia | null;
  readonly frajerina: StavFrajeriny & { readonly titul: string; readonly provizorna: boolean; readonly poradie: number | null };
  /** Vývoj Frajeriny od registrácie (prvý bod = štart). */
  readonly historia: readonly { readonly cas: number; readonly hodnota: number }[];
  readonly statistiky: StatistikyHraca;
  /** Súčet ťahov a hracieho času (ms) — pre priemery. */
  readonly casSpolu: number;
  readonly partie: readonly PartiaVProfile[];
  readonly superi: readonly (HracVerejny & { readonly partie: number; readonly vyhry: number; readonly prehry: number; readonly remizy: number })[];
}

export interface RiadokRebricka extends StavFrajeriny {
  readonly poradie: number;
  readonly id: number;
  readonly meno: string;
  readonly avatar: string | null;
  /** Úroveň účtu — rebríček ukazuje rank (Poldeci, Deci, Sedmička). */
  readonly rola: string;
  readonly titul: string;
  readonly provizorna: boolean;
}

const vysledokPre = (vitaz: 0 | 1 | null, miesto: 0 | 1): Vysledok => (vitaz === null ? "remiza" : vitaz === miesto ? "vyhra" : "prehra");

export class Archiv {
  private readonly db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  frajerina(pouzivatel: number): StavFrajeriny {
    const r = this.db.prepare("SELECT hodnota, najvyssia, partie, vyhry, prehry, remizy FROM frajerina WHERE pouzivatel = ?").get(pouzivatel) as
      | { hodnota: number; najvyssia: number; partie: number; vyhry: number; prehry: number; remizy: number }
      | undefined;
    if (r === undefined) return { hodnota: FRAJERINA_START, najvyssia: FRAJERINA_START, partie: 0, vyhry: 0, prehry: 0, remizy: 0 };
    return { hodnota: r.hodnota, najvyssia: r.najvyssia, partie: r.partie, vyhry: r.vyhry, prehry: r.prehry, remizy: r.remizy };
  }

  /** Uloží dohranú partiu a prepočíta Frajerinu oboch hráčov (jedna transakcia). */
  zapis(z: ZaznamPartie): { id: number; zmeny: [ZmenaFrajeriny, ZmenaFrajeriny] } {
    return transakcia(this.db, () => {
      const pred = [this.frajerina(z.hraci[0]), this.frajerina(z.hraci[1])] as const;
      const hodnotena = z.hodnotena !== false;
      const po: readonly [number, number] = hodnotena ? novaFrajerina([pred[0].hodnota, pred[1].hodnota], z.vitaz) : [pred[0].hodnota, pred[1].hodnota];
      const r = this.db
        .prepare("INSERT INTO partie (kod, zaciatok, koniec, vitaz, dovod, kola, verzia_sady, dohrata, karty) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .run(z.kod, z.zaciatok, z.koniec, z.vitaz, z.dovod, z.kola, z.verziaSady, z.dohrata ? 1 : 0, z.statistikyKariet === undefined ? null : JSON.stringify(z.statistikyKariet));
      const id = Number(r.lastInsertRowid);
      for (const miesto of [0, 1] as const) {
        const vysledok = vysledokPre(z.vitaz, miesto);
        this.db
          .prepare(
            "INSERT INTO partie_hraci (partia, miesto, pouzivatel, vysledok, body, frajerina_pred, frajerina_po, statistiky) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          )
          .run(id, miesto, z.hraci[miesto], vysledok, z.body?.[miesto] ?? null, pred[miesto].hodnota, po[miesto], JSON.stringify(z.statistiky[miesto]));
        const f = pred[miesto];
        // Nehodnotená partia ostane v archíve a štatistikách, Frajerinu nemení.
        if (!hodnotena) continue;
        this.db
          .prepare(
            `INSERT INTO frajerina (pouzivatel, hodnota, najvyssia, partie, vyhry, prehry, remizy) VALUES (?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(pouzivatel) DO UPDATE SET hodnota = excluded.hodnota, najvyssia = excluded.najvyssia, partie = excluded.partie,
               vyhry = excluded.vyhry, prehry = excluded.prehry, remizy = excluded.remizy`,
          )
          .run(
            z.hraci[miesto],
            po[miesto],
            Math.max(f.najvyssia, po[miesto]),
            f.partie + 1,
            f.vyhry + (vysledok === "vyhra" ? 1 : 0),
            f.prehry + (vysledok === "prehra" ? 1 : 0),
            f.remizy + (vysledok === "remiza" ? 1 : 0),
          );
      }
      return {
        id,
        zmeny: [
          { pred: pred[0].hodnota, po: po[0] },
          { pred: pred[1].hodnota, po: po[1] },
        ],
      };
    });
  }

  /** Poradie v rebríčku (1 = najlepší); hráč bez partie poradie nemá. */
  /** Poradie v rebríčku (1 = najlepší); hráč bez partie poradie nemá. AI účty sa rátajú len pre správcu. */
  private poradie(f: StavFrajeriny, sAi: boolean): number | null {
    if (f.partie === 0) return null;
    const r = this.db
      .prepare("SELECT COUNT(*) AS n FROM frajerina f JOIN pouzivatelia u ON u.id = f.pouzivatel WHERE f.partie > 0 AND f.hodnota > ? AND (? = 1 OR u.ai = 0)")
      .get(f.hodnota, sAi ? 1 : 0) as { n: number };
    return r.n + 1;
  }

  /**
   * Profil hráča podľa toho, kto sa pozerá (Michal 2026-10-22). Cudzí dostane
   * hlavičku, Frajerinu, bilanciu, formu a vzájomnú bilanciu — nie zoznam partií
   * ani súperov. Kto profil vidieť smie (AI len správca), rozhoduje volajúci.
   */
  profil(pouzivatel: number, pohlad: PohladProfilu = "vlastny", volajuci: number | null = null): ProfilHraca | null {
    const u = this.db.prepare("SELECT id, meno, avatar, rola, vytvoreny, ai FROM pouzivatelia WHERE id = ?").get(pouzivatel) as
      | { id: number; meno: string; avatar: string | null; rola: string; vytvoreny: number; ai: number }
      | undefined;
    if (u === undefined) return null;
    const f = this.frajerina(pouzivatel);

    const riadky = this.db
      .prepare(
        `SELECT p.id, p.zaciatok, p.koniec, p.kola, p.dovod, ja.miesto, ja.vysledok, ja.body, ja.frajerina_pred, ja.frajerina_po, ja.statistiky,
                on_.pouzivatel AS super_id, on_.body AS super_body, on_.frajerina_pred AS super_frajerina, s.meno AS super_meno, s.avatar AS super_avatar
         FROM partie_hraci ja
         JOIN partie p ON p.id = ja.partia
         JOIN partie_hraci on_ ON on_.partia = ja.partia AND on_.miesto != ja.miesto
         LEFT JOIN pouzivatelia s ON s.id = on_.pouzivatel
         WHERE ja.pouzivatel = ?
         ORDER BY p.id`,
      )
      .all(pouzivatel) as {
      id: number;
      zaciatok: number;
      koniec: number;
      kola: number;
      dovod: string;
      vysledok: Vysledok;
      body: number | null;
      frajerina_pred: number;
      frajerina_po: number;
      statistiky: string;
      super_id: number | null;
      super_body: number | null;
      super_frajerina: number;
      super_meno: string | null;
      super_avatar: string | null;
    }[];

    let statistiky = prazdneStatistiky();
    let casSpolu = 0;
    const historia: { cas: number; hodnota: number }[] = [{ cas: u.vytvoreny, hodnota: riadky[0]?.frajerina_pred ?? f.hodnota }];
    const superi = new Map<number, { id: number; meno: string; avatar: string | null; partie: number; vyhry: number; prehry: number; remizy: number }>();
    for (const r of riadky) {
      let st: StatistikyHraca;
      try {
        st = normalizujStatistiky(JSON.parse(r.statistiky));
      } catch {
        st = { ...prazdneStatistiky(), partie: 1 };
      }
      statistiky = scitajStatistiky(statistiky, st);
      casSpolu += Math.max(0, r.koniec - r.zaciatok);
      historia.push({ cas: r.koniec, hodnota: r.frajerina_po });
      if (r.super_id !== null) {
        const s = superi.get(r.super_id) ?? { id: r.super_id, meno: r.super_meno ?? "?", avatar: r.super_avatar, partie: 0, vyhry: 0, prehry: 0, remizy: 0 };
        s.partie += 1;
        if (r.vysledok === "vyhra") s.vyhry += 1;
        else if (r.vysledok === "prehra") s.prehry += 1;
        else s.remizy += 1;
        superi.set(r.super_id, s);
      }
    }

    const partie: PartiaVProfile[] = riadky
      .slice(-25)
      .reverse()
      .map((r) => ({
        id: r.id,
        koniec: r.koniec,
        trvanie: Math.max(0, r.koniec - r.zaciatok),
        kola: r.kola,
        dovod: r.dovod,
        vysledok: r.vysledok,
        body: r.body === null || r.super_body === null ? null : [r.body, r.super_body],
        frajerina: { pred: r.frajerina_pred, po: r.frajerina_po },
        super: { id: r.super_id, meno: r.super_meno ?? "zmazaný hráč", avatar: r.super_avatar, frajerina: r.super_frajerina },
      }));

    const bilancia = (rs: readonly { vysledok: Vysledok }[]): Bilancia => ({
      partie: rs.length,
      vyhry: rs.filter((r) => r.vysledok === "vyhra").length,
      prehry: rs.filter((r) => r.vysledok === "prehra").length,
      remizy: rs.filter((r) => r.vysledok === "remiza").length,
    });
    // Z pohľadu volajúceho: jeho výhra je prehra tohto hráča.
    const otoc: Record<Vysledok, Vysledok> = { vyhra: "prehra", prehra: "vyhra", remiza: "remiza" };
    const cudzi = pohlad === "cudzi";
    return {
      pohlad,
      skryty: u.ai === 1,
      hrac: { id: u.id, meno: u.meno, avatar: u.avatar, rola: u.rola, vytvoreny: u.vytvoreny, ai: u.ai === 1 },
      frajerina: { ...f, titul: titul(f.hodnota), provizorna: f.partie < PROVIZORNE_PARTIE, poradie: this.poradie(f, pohlad === "spravca") },
      historia,
      statistiky,
      casSpolu,
      bilancia: { ludia: bilancia(riadky), boti: bilancia([]) },
      forma: riadky.slice(-5).reverse().map((r) => r.vysledok),
      vyDvaja: cudzi && volajuci !== null ? bilancia(riadky.filter((r) => r.super_id === volajuci).map((r) => ({ vysledok: otoc[r.vysledok] }))) : null,
      // Zoznam partií a súperov len vlastník a správca.
      partie: cudzi ? [] : partie,
      superi: cudzi ? [] : [...superi.values()].sort((a, b) => b.partie - a.partie).slice(0, 8),
    };
  }

  /**
   * Štatistiky kariet zo všetkých partií so zápisom kariet (od verzie sady
   * `odVerzie`, ak je daná) — podklad pre rebalans v tvorcovi. `lenLudia`
   * vynechá partie s AI účtom (protihráč agent): rebalans má stáť na tom,
   * ako hrajú ľudia, nie na dojmoch AI.
   */
  statistikyKariet(odVerzie: number | null = null, lenLudia = false): { partie: number; karty: StatistikyKariet } {
    const rows = this.db
      .prepare(
        `SELECT karty FROM partie p WHERE karty IS NOT NULL AND (? IS NULL OR verzia_sady >= ?)
           AND (? = 0 OR NOT EXISTS (
             SELECT 1 FROM partie_hraci h JOIN pouzivatelia u ON u.id = h.pouzivatel WHERE h.partia = p.id AND u.ai = 1))`,
      )
      .all(odVerzie, odVerzie, lenLudia ? 1 : 0) as { karty: string }[];
    let karty: StatistikyKariet = {};
    for (const r of rows) karty = scitajStatistikyKariet(karty, normalizujStatistikyKariet(JSON.parse(r.karty) as unknown));
    return { partie: rows.length, karty };
  }

  /** Rebríček Frajeriny; AI playtesterov vidí len správca (Michal 2026-10-22). */
  rebricek(limit = 100, sAi = false): RiadokRebricka[] {
    const riadky = this.db
      .prepare(
        `SELECT f.pouzivatel AS id, u.meno, u.avatar, u.rola, f.hodnota, f.najvyssia, f.partie, f.vyhry, f.prehry, f.remizy
         FROM frajerina f JOIN pouzivatelia u ON u.id = f.pouzivatel
         WHERE f.partie > 0 AND (? = 1 OR u.ai = 0)
         ORDER BY f.hodnota DESC, f.partie DESC, u.id
         LIMIT ?`,
      )
      .all(sAi ? 1 : 0, limit) as { id: number; meno: string; avatar: string | null; rola: string; hodnota: number; najvyssia: number; partie: number; vyhry: number; prehry: number; remizy: number }[];
    // Rovnaká Frajerina = rovnaké poradie (ako v šachových rebríčkoch).
    let poradie = 0;
    let predosla = Number.POSITIVE_INFINITY;
    return riadky.map((r, i) => {
      if (r.hodnota < predosla) {
        poradie = i + 1;
        predosla = r.hodnota;
      }
      return { ...r, poradie, titul: titul(r.hodnota), provizorna: r.partie < PROVIZORNE_PARTIE };
    });
  }
}

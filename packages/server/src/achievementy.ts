// Achievementy na serveri (Michal 2026-10-23): jadro (achievementy.ts v core)
// počíta metriky partie; server rozhodne, kto čo získava, uloží zisk k účtu,
// sčíta kariéru a pošle oznam LEN hráčovi, ktorý získal (súper ho nevidí).
//
// Kto získava: človek (nie bot, nie AI účet), nie vo výučbe — za jej dokončenie
// je len achievement s metrikou „vyucba“ (Prvá hra). Hviezdy (★) všetkých
// achievementov určujú rank Deci a Sedmička (prava.ts). Achievement sa
// ráta v partii, ktorej typ (ľudia / bot) zodpovedá jeho „proti“. Kariéra
// sa sčíta po partii vo vedierku jej typu a vo „vsetky“; rátané od spustenia.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  agregatPartie,
  chybaloMalo,
  hodnotaVPartii,
  klucKariery,
  krokAchievementov,
  nacitajAchievementy,
  noveAchievementy,
  popisRanku,
  pripocitajKarieru,
  rankZaHodnotu,
  stitkyPartie,
  type Achievement,
  type Command,
  type Event,
  type GameData,
  type GameState,
  type KatalogAchievementov,
  type KontextPartie,
  type PlayerId,
  type ProtiKomu,
  type StavAchievementov,
} from "@naex/core";
import type { Db } from "./db.ts";
import { transakcia } from "./db.ts";
import type { HviezdyHraca } from "./prava.ts";

const KATALOG = fileURLToPath(new URL("../../core/data/achievementy.json", import.meta.url));

export function nacitajKatalog(): KatalogAchievementov {
  return nacitajAchievementy(JSON.parse(readFileSync(KATALOG, "utf8")) as unknown);
}

export type TypPartie = "ludia" | "bot";

const ratSa = (a: Achievement, typ: TypPartie): boolean => a.proti === "vsetky" || a.proti === typ;

/** Achievement tak, ako ho vidí klient — oznam, súhrn, vitrína. */
export interface AchievementPreKlienta {
  readonly id: string;
  readonly nazov: string;
  readonly popis: string;
  readonly kategoria: string | null;
  readonly piktogram: string | null;
  readonly tajny: boolean;
  /** Počet rankov (dĺžka prahov) — ★ z koľkých. */
  readonly rankov: number;
  /** Vzácnosť každého ranku (bezne, nezvycajne, vzacne, legendarne) — farba podtácku. */
  readonly zriedkavost: readonly string[];
}

/** Oznam v partii: hráč práve získal rank. */
export interface ZiskAchievementu extends AchievementPreKlienta {
  readonly rank: number;
  readonly hodnota: number;
  /** Vzácny zisk — 3★ alebo tajný; Melichar sa ozve. */
  readonly vzacny: boolean;
}

/** „Chýbalo málo“ na konci partie: k ďalšiemu ranku. */
export interface PriblizenieAchievementu extends AchievementPreKlienta {
  readonly rank: number;
  readonly hodnota: number;
  readonly prah: number;
}

export interface SuhrnAchievementov {
  readonly ziskane: readonly ZiskAchievementu[];
  readonly chybaloMalo: readonly PriblizenieAchievementu[];
}

const preKlienta = (a: Achievement, rank: number): AchievementPreKlienta => ({
  id: a.id,
  nazov: a.nazov,
  popis: popisRanku(a, Math.max(1, rank)),
  kategoria: a.kategoria,
  piktogram: a.piktogram,
  tajny: a.tajny,
  rankov: a.prahy.length,
  zriedkavost: a.zriedkavost,
});

interface Kariera {
  readonly hodnota: number;
  readonly aktualna: number;
}

/** Hráč v partii, ktorý achievementy získava. */
interface HracAchievementov {
  readonly id: number;
  /** Ranky, ktoré už má (z databázy + získané v tejto partii). */
  readonly drzane: Map<string, number>;
  /** Kariéra pred partiou: kľúč proti|metrika|agregacia. */
  readonly kariera: ReadonlyMap<string, Kariera>;
  readonly rozne: ReadonlyMap<string, ReadonlySet<string>>;
  readonly ziskane: ZiskAchievementu[];
  suhrn: SuhrnAchievementov | null;
}

export interface AchievementyMiestnosti {
  stav: StavAchievementov;
  readonly typ: TypPartie;
  readonly kontext: KontextPartie;
  readonly hraci: readonly [HracAchievementov | null, HracAchievementov | null];
}

const klucVedra = (proti: ProtiKomu | TypPartie, a: Achievement): string => `${proti}|${klucKariery(a)}`;

export class Achievementy {
  readonly katalog: KatalogAchievementov;
  private readonly db: Db;

  constructor(db: Db, katalog: KatalogAchievementov) {
    this.db = db;
    this.katalog = katalog;
  }

  /** Ranky, ktoré hráč má: achievement → najvyšší rank. */
  drzane(pouzivatel: number): Map<string, number> {
    const out = new Map<string, number>();
    const riadky = this.db.prepare("SELECT achievement, MAX(rank) AS rank FROM achievementy_zisky WHERE pouzivatel = ? GROUP BY achievement").all(pouzivatel) as {
      achievement: string;
      rank: number;
    }[];
    for (const r of riadky) out.set(r.achievement, Number(r.rank));
    return out;
  }

  /** Všetky zisky hráča s dátumom a partiou — pre vitrínu. */
  zisky(pouzivatel: number): { achievement: string; rank: number; ziskane: number; partia: number | null }[] {
    return (
      this.db.prepare("SELECT achievement, rank, ziskane, partia FROM achievementy_zisky WHERE pouzivatel = ? ORDER BY ziskane, rank").all(pouzivatel) as {
        achievement: string;
        rank: number;
        ziskane: number;
        partia: number | null;
      }[]
    ).map((r) => ({ achievement: r.achievement, rank: Number(r.rank), ziskane: Number(r.ziskane), partia: r.partia === null ? null : Number(r.partia) }));
  }

  private kariera(pouzivatel: number): Map<string, Kariera> {
    const out = new Map<string, Kariera>();
    const riadky = this.db.prepare("SELECT proti, kluc, hodnota, aktualna FROM achievementy_kariera WHERE pouzivatel = ?").all(pouzivatel) as {
      proti: string;
      kluc: string;
      hodnota: number;
      aktualna: number;
    }[];
    for (const r of riadky) out.set(`${r.proti}|${r.kluc}`, { hodnota: Number(r.hodnota), aktualna: Number(r.aktualna) });
    return out;
  }

  private rozne(pouzivatel: number): Map<string, Set<string>> {
    const out = new Map<string, Set<string>>();
    const riadky = this.db.prepare("SELECT proti, kluc, stitok FROM achievementy_rozne WHERE pouzivatel = ?").all(pouzivatel) as { proti: string; kluc: string; stitok: string }[];
    for (const r of riadky) {
      const k = `${r.proti}|${r.kluc}`;
      const s = out.get(k) ?? new Set<string>();
      s.add(r.stitok);
      out.set(k, s);
    }
    return out;
  }

  /** Hodnota kariérneho achievementu: súčet partií + táto partia. */
  private hodnotaKariery(h: HracAchievementov, a: Achievement, stav: StavAchievementov, miesto: PlayerId): number {
    const k = klucVedra(a.proti, a);
    if (a.agregacia === "rozne") {
      const spolu = new Set(h.rozne.get(k) ?? []);
      for (const s of stitkyPartie(stav, miesto, a)) spolu.add(s);
      return spolu.size;
    }
    const stara = h.kariera.get(k) ?? { hodnota: 0, aktualna: 0 };
    return pripocitajKarieru(a, stara, agregatPartie(stav, miesto, a)).hodnota;
  }

  /**
   * Začiatok partie. hraci[i] = účet na mieste i, alebo null (bot); AI účty
   * nezískavajú nič. superi = účty súperov (pre „rôznych súperov“).
   */
  zacni(hraci: readonly [{ readonly id: number; readonly ai: boolean } | null, { readonly id: number; readonly ai: boolean } | null], botPovaha: string | null): AchievementyMiestnosti {
    const typ: TypPartie = hraci.some((h) => h === null) ? "bot" : "ludia";
    const hrac = (i: PlayerId): HracAchievementov | null => {
      const h = hraci[i];
      if (h === null || h.ai) return null;
      return { id: h.id, drzane: this.drzane(h.id), kariera: this.kariera(h.id), rozne: this.rozne(h.id), ziskane: [], suhrn: null };
    };
    const superId = (i: PlayerId): string | null => {
      const s = hraci[i === 0 ? 1 : 0];
      return s === null || s.ai ? null : String(s.id);
    };
    return {
      stav: noveAchievementy(),
      typ,
      kontext: { botPovaha: typ === "bot" ? botPovaha : null, superi: [superId(0), superId(1)] },
      hraci: [hrac(0), hrac(1)],
    };
  }

  /**
   * Krok partie: zisky pre každé miesto (už uložené v databáze) a pri konci
   * partie súhrn so „chýbalo málo“. Kariéra sa zapíše na konci.
   */
  poKroku(
    am: AchievementyMiestnosti,
    data: GameData,
    pred: GameState,
    cmd: Command,
    autor: PlayerId,
    po: GameState,
    udalosti: readonly Event[],
    miestnost: string,
    cas: number,
  ): { readonly zisky: readonly [ZiskAchievementu[], ZiskAchievementu[]]; readonly suhrny: readonly [SuhrnAchievementov | null, SuhrnAchievementov | null] } {
    const krok = krokAchievementov(this.katalog, data, am.stav, pred, cmd, autor, po, udalosti, am.kontext);
    am.stav = krok.stav;
    const koniec = pred.koniec === null && po.koniec !== null;
    const zisky: [ZiskAchievementu[], ZiskAchievementu[]] = [[], []];
    const suhrny: [SuhrnAchievementov | null, SuhrnAchievementov | null] = [null, null];
    for (const miesto of [0, 1] as const) {
      const h = am.hraci[miesto];
      if (h === null) continue;
      // Kandidáti: zisky z jadra (bitka/Pitka/kolo/partia) + kariéra prepočítaná so súčtom.
      const kandidati = new Map<string, { a: Achievement; rank: number; hodnota: number }>();
      for (const z of krok.zisky[miesto]) {
        const a = this.katalog.achievementy.find((x) => x.id === z.id);
        if (a !== undefined && ratSa(a, am.typ)) kandidati.set(a.id, { a, rank: z.rank, hodnota: z.hodnota });
      }
      for (const a of this.katalog.achievementy) {
        if (a.rozsah !== "kariera" || !ratSa(a, am.typ)) continue;
        const hodnota = this.hodnotaKariery(h, a, am.stav, miesto);
        kandidati.set(a.id, { a, rank: rankZaHodnotu(a, hodnota), hodnota });
      }
      for (const { a, rank, hodnota } of kandidati.values()) {
        const mal = h.drzane.get(a.id) ?? 0;
        if (rank <= mal) continue;
        transakcia(this.db, () => {
          const vloz = this.db.prepare(
            "INSERT OR IGNORE INTO achievementy_zisky (pouzivatel, achievement, rank, ziskane, miestnost, partia) VALUES (?, ?, ?, ?, ?, NULL)",
          );
          for (let r = mal + 1; r <= rank; r++) vloz.run(h.id, a.id, r, cas, miestnost);
        });
        h.drzane.set(a.id, rank);
        const zisk: ZiskAchievementu = { ...preKlienta(a, rank), rank, hodnota, vzacny: rank >= 3 || a.tajny };
        h.ziskane.push(zisk);
        zisky[miesto].push(zisk);
      }
      if (koniec) {
        this.zapisKarieru(h, am, miesto);
        suhrny[miesto] = h.suhrn = this.suhrn(h, am, miesto);
      }
    }
    return { zisky, suhrny };
  }

  /** Súčty kariéry po partii — vo vedierku typu partie a vo „vsetky“. */
  private zapisKarieru(h: HracAchievementov, am: AchievementyMiestnosti, miesto: PlayerId): void {
    const hotove = new Set<string>();
    transakcia(this.db, () => {
      for (const a of this.katalog.achievementy) {
        if (a.rozsah !== "kariera") continue;
        for (const proti of [am.typ, "vsetky"] as const) {
          const k = klucVedra(proti, a);
          if (hotove.has(k)) continue;
          hotove.add(k);
          if (a.agregacia === "rozne") {
            const vloz = this.db.prepare("INSERT OR IGNORE INTO achievementy_rozne (pouzivatel, proti, kluc, stitok) VALUES (?, ?, ?, ?)");
            for (const s of stitkyPartie(am.stav, miesto, a)) vloz.run(h.id, proti, klucKariery(a), s);
            continue;
          }
          const zaPartiu = agregatPartie(am.stav, miesto, a);
          if (zaPartiu === undefined) continue;
          const nova = pripocitajKarieru(a, h.kariera.get(k) ?? { hodnota: 0, aktualna: 0 }, zaPartiu);
          this.db
            .prepare(
              "INSERT INTO achievementy_kariera (pouzivatel, proti, kluc, hodnota, aktualna) VALUES (?, ?, ?, ?, ?) ON CONFLICT (pouzivatel, proti, kluc) DO UPDATE SET hodnota = excluded.hodnota, aktualna = excluded.aktualna",
            )
            .run(h.id, proti, klucKariery(a), nova.hodnota, nova.aktualna);
        }
      }
    });
  }

  private suhrn(h: HracAchievementov, am: AchievementyMiestnosti, miesto: PlayerId): SuhrnAchievementov {
    const hodnoty = new Map<string, number>();
    for (const a of this.katalog.achievementy) {
      if (!ratSa(a, am.typ)) continue;
      hodnoty.set(a.id, a.rozsah === "kariera" ? this.hodnotaKariery(h, a, am.stav, miesto) : hodnotaVPartii(am.stav, miesto, a));
    }
    const blizko = chybaloMalo(this.katalog, hodnoty, h.drzane).flatMap((p) => {
      const a = this.katalog.achievementy.find((x) => x.id === p.id);
      return a === undefined ? [] : [{ ...preKlienta(a, p.rank), rank: p.rank, hodnota: p.hodnota, prah: p.prah }];
    });
    return { ziskane: [...h.ziskane], chybaloMalo: blizko };
  }

  /** Koľko hviezd (★) je v katalógu spolu — z neho sa rátajú prahy rankov Deci a Sedmička. */
  spoluHviezd(): number {
    return this.katalog.achievementy.reduce((n, a) => n + a.prahy.length, 0);
  }

  /**
   * Hviezdy hráča: súčet rankov achievementov z katalógu. Všetky hviezdy platia rovnako
   * (aj tajné a „záporné“ ako Vlastný gól); achievement vyradený z katalógu sa neráta.
   */
  hviezdy(pouzivatel: number): HviezdyHraca {
    let hviezdy = 0;
    const drzane = this.drzane(pouzivatel);
    for (const a of this.katalog.achievementy) hviezdy += Math.min(drzane.get(a.id) ?? 0, a.prahy.length);
    return { hviezdy, spolu: this.spoluHviezd() };
  }

  /**
   * Koniec výučby „Prvá hra“: achievementy s metrikou „vyucba“ (Michal 2026-10-25).
   * Udelia sa raz — opakovaná výučba už nič nedá. Vráti nové zisky pre oznam.
   */
  udelZaVyucbu(pouzivatel: number, cas: number): ZiskAchievementu[] {
    const drzane = this.drzane(pouzivatel);
    const out: ZiskAchievementu[] = [];
    for (const a of this.katalog.achievementy) {
      if (a.metrika !== "vyucba" || (drzane.get(a.id) ?? 0) >= a.prahy.length) continue;
      const mal = drzane.get(a.id) ?? 0;
      const rank = a.prahy.length;
      transakcia(this.db, () => {
        const vloz = this.db.prepare("INSERT OR IGNORE INTO achievementy_zisky (pouzivatel, achievement, rank, ziskane, miestnost, partia) VALUES (?, ?, ?, ?, 'vyucba', NULL)");
        for (let r = mal + 1; r <= rank; r++) vloz.run(pouzivatel, a.id, r, cas);
      });
      out.push({ ...preKlienta(a, rank), rank, hodnota: 1, vzacny: rank >= 3 || a.tajny });
    }
    return out;
  }

  /** Pri štarte: kto výučbu dokončil skôr, než achievement existoval, dostane ho dodatočne (bez oznamu). */
  dorovnajVyucbu(cas: number): void {
    if (!this.katalog.achievementy.some((a) => a.metrika === "vyucba")) return;
    const ids = this.db.prepare("SELECT id FROM pouzivatelia WHERE vyucba_stav = 'hotova' AND ai = 0").all() as { id: number }[];
    for (const { id } of ids) this.udelZaVyucbu(Number(id), cas);
  }

  /** Po zápise do archívu: zisky z miestnosti dostanú id partie (odkaz na detail). */
  priradPartiu(miestnost: string, partia: number): void {
    this.db.prepare("UPDATE achievementy_zisky SET partia = ? WHERE miestnost = ? AND partia IS NULL").run(partia, miestnost);
  }

  /**
   * Vitrína hráča: každý achievement s rankom, ktorý má, a dátumami. Tajný,
   * ktorý hráč nemá, má názov a popis „???“ (alebo tajnyText).
   */
  vitrina(pouzivatel: number): VitrinaAchievementov {
    const zisky = this.zisky(pouzivatel);
    const kariera = this.kariera(pouzivatel);
    const rozne = this.rozne(pouzivatel);
    // Postup kariéry (Michal 2026-10-24: Kamaráti z krčmy, séria výhier…) — súčet partií od spustenia.
    const postup = (a: Achievement): PostupKariery | null => {
      if (a.rozsah !== "kariera") return null;
      const k = klucVedra(a.proti, a);
      if (a.agregacia === "rozne") return { hodnota: rozne.get(k)?.size ?? 0, aktualna: null };
      const v = kariera.get(k) ?? { hodnota: 0, aktualna: 0 };
      return { hodnota: v.hodnota, aktualna: a.agregacia === "seria" ? v.aktualna : null };
    };
    const polozky = this.katalog.achievementy.map((a): PolozkaVitriny => {
      const moje = zisky.filter((z) => z.achievement === a.id);
      const rank = moje.reduce((m, z) => Math.max(m, z.rank), 0);
      const skryty = a.tajny && rank === 0;
      return {
        id: a.id,
        nazov: skryty ? "???" : a.nazov,
        popis: skryty ? (a.tajnyText ?? "???") : popisRanku(a, Math.max(1, rank)),
        kategoria: a.kategoria,
        piktogram: skryty ? null : a.piktogram,
        tajny: a.tajny,
        rankov: a.prahy.length,
        rank,
        zriedkavost: skryty ? [] : a.zriedkavost,
        prahy: skryty ? [] : a.prahy,
        postup: skryty ? null : postup(a),
        ziskane: moje.map((z) => ({ rank: z.rank, ziskane: z.ziskane, partia: z.partia })),
      };
    });
    return { kategorie: this.katalog.kategorie, achievementy: polozky };
  }
}

/** Postup kariérneho achievementu: hodnota cez partie (súčet, rekord alebo počet rôznych); pri sérii aj aktuálna séria. */
export interface PostupKariery {
  readonly hodnota: number;
  readonly aktualna: number | null;
}

export interface PolozkaVitriny extends AchievementPreKlienta {
  readonly rank: number;
  /** Prahy rankov (pri skrytom tajnom prázdne). */
  readonly prahy: readonly number[];
  /** Len rozsah kariera (a nie skrytý tajný): kde hráč je, napr. 7 z 10 rôznych ľudí; inak null. */
  readonly postup: PostupKariery | null;
  readonly ziskane: readonly { readonly rank: number; readonly ziskane: number; readonly partia: number | null }[];
}

export interface VitrinaAchievementov {
  readonly kategorie: readonly { readonly id: string; readonly nazov: string }[];
  readonly achievementy: readonly PolozkaVitriny[];
}

// Profily a detail partie (Michal 2026-10-22). Čo kto vidí, rozhoduje server:
// zoznam partií len vlastník a správca, detail partie len účastník a správca.
// Účastník dostane svoju stranu plnú a zo súperovej len to, čo bolo na stole
// verejné (CLAUDE.md, pravidlo 2). AI playtester je hráčom skrytý — v cudzích
// partiách sa ukáže bez odkazu (id null).

import type { KoloKroniky, StatistikyHraca, UcetSpakov } from "@naex/core";

/** Záverečné bodovanie partie do v5 (po starších) — server ho len prenáša z archívu. */
export interface ZaverecneV5 {
  readonly spolu: readonly [number, number];
  readonly starsi: readonly unknown[];
}
import { POVAHY, normalizujStatistiky } from "@naex/core";
import type { Db } from "./db.ts";
import type { Vysledok } from "./frajerina.ts";
import type { PartiaSuhrnu, Suhrn } from "./suhrn.ts";
import { PARTII_NA_PRIEMER, priemeryHraca, spocitajSuhrn } from "./suhrn.ts";

export type FilterPartii = "ludia" | "boti" | "spolu";
export const FILTRE_PARTII: readonly FilterPartii[] = ["ludia", "boti", "spolu"];

const sqlFiltra = (f: FilterPartii): string => (f === "ludia" ? "AND p.s_botom = 0" : f === "boti" ? "AND p.s_botom = 1" : "");

export interface SuperVPartii {
  /** null = bot, zmazaný účet alebo AI playtester pre ne-správcu (bez odkazu). */
  readonly id: number | null;
  readonly meno: string;
  readonly avatar: string | null;
  /** Povaha bota (POVAHY), ak hral bot. */
  readonly bot?: string;
  readonly ai?: true;
}

export interface RiadokPartie {
  readonly id: number;
  readonly koniec: number;
  readonly trvanie: number;
  readonly dlzka: string | null;
  readonly kola: number;
  readonly dovod: string;
  readonly dohrata: boolean;
  readonly verziaPravidiel: string | null;
  readonly vysledok: Vysledok;
  /** [moje, súperove] — len partie so záverečným bodovaním. */
  readonly body: readonly [number, number] | null;
  /** Zmena Frajeriny; null, keď sa partia nehodnotila (bot, AI, bez práva). */
  readonly frajerina: { readonly pred: number; readonly po: number } | null;
  readonly super: SuperVPartii;
}

/** Štatistiky súpera, ktoré na stole verejné neboli (úspech NA EX stojí na jeho skrytej ruke). */
const NEVEREJNE: readonly (keyof StatistikyHraca)[] = ["naexUspesne", "naexHodnotene"];

function verejneStatistiky(s: StatistikyHraca): Partial<StatistikyHraca> {
  const out: Record<string, unknown> = { ...s };
  for (const k of NEVEREJNE) delete out[k];
  return out as Partial<StatistikyHraca>;
}

export interface HracVPartii extends SuperVPartii {
  readonly vysledok: Vysledok;
  readonly body: number | null;
  readonly frajerina: { readonly pred: number; readonly po: number } | null;
}

export interface DetailPartie {
  readonly id: number;
  readonly koniec: number;
  readonly trvanie: number;
  readonly dlzka: string | null;
  readonly verziaPravidiel: string | null;
  readonly dovod: string;
  readonly dohrata: boolean;
  /** Miesto toho, kto sa pozerá; null = správca, ktorý nehral. */
  readonly ja: 0 | 1 | null;
  readonly hraci: readonly [HracVPartii, HracVPartii];
  readonly kola: readonly KoloKroniky[];
  /** Svoja strana plná, súperova len verejné polia; správca obe plné. */
  readonly strany: readonly [Partial<StatistikyHraca>, Partial<StatistikyHraca>];
  /** Záverečný účet: v6 špaky (UcetSpakov), do v5 bodovanie po starších; najstaršie partie ho nemajú. */
  readonly zaverecne: UcetSpakov | ZaverecneV5 | null;
  readonly menaStarsich: Readonly<Record<string, string>>;
}

interface RiadokHraca {
  miesto: number;
  pouzivatel: number | null;
  vysledok: Vysledok;
  body: number | null;
  frajerina_pred: number;
  frajerina_po: number;
  statistiky: string;
  meno: string | null;
  avatar: string | null;
  ai: number | null;
}

const menoBota = (povaha: string | null): string => POVAHY.find((p) => p.id === povaha)?.meno ?? "Štamgast";

/** Štatistiky hráča z archívu; poškodený záznam = prázdne štatistiky. */
function citajStatistiky(json: string): StatistikyHraca {
  try {
    return normalizujStatistiky(JSON.parse(json));
  } catch {
    return normalizujStatistiky(null);
  }
}

/** Zmena Frajeriny v partii; null, keď sa partia nehodnotila (bot, AI, bez práva). */
const zmenaFrajeriny = (sBotom: boolean, pred: number, po: number): { readonly pred: number; readonly po: number } | null =>
  sBotom || pred === po ? null : { pred, po };

export class Profily {
  private readonly db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  private superVPartii(r: { pouzivatel: number | null; meno: string | null; avatar: string | null; ai: number | null }, botPovaha: string | null, sBotom: boolean, spravca: boolean): SuperVPartii {
    if (r.pouzivatel === null && sBotom) return { id: null, meno: menoBota(botPovaha), avatar: null, bot: botPovaha ?? "stamgast" };
    const ai = r.ai === 1;
    return {
      id: ai && !spravca ? null : r.pouzivatel,
      meno: r.meno ?? "zmazaný hráč",
      avatar: r.avatar,
      ...(ai ? { ai: true as const } : {}),
    };
  }

  /** Partie hráča, najnovšie prvé; volajúci rozhodol, že ich smie vidieť. */
  partieHraca(id: number, filter: FilterPartii, od: number, limit: number, spravca: boolean): { pocet: number; partie: RiadokPartie[] } {
    const f = sqlFiltra(filter);
    const pocet = (this.db.prepare(`SELECT COUNT(*) AS n FROM partie_hraci ja JOIN partie p ON p.id = ja.partia WHERE ja.pouzivatel = ? ${f}`).get(id) as { n: number }).n;
    const riadky = this.db
      .prepare(
        `SELECT p.id, p.zaciatok, p.koniec, p.dlzka, p.kola, p.dovod, p.dohrata, p.verzia_pravidiel, p.s_botom, p.bot_povaha,
                ja.vysledok, ja.body, ja.frajerina_pred, ja.frajerina_po,
                on_.pouzivatel, on_.body AS super_body, s.meno, s.avatar, s.ai
         FROM partie_hraci ja
         JOIN partie p ON p.id = ja.partia
         JOIN partie_hraci on_ ON on_.partia = ja.partia AND on_.miesto != ja.miesto
         LEFT JOIN pouzivatelia s ON s.id = on_.pouzivatel
         WHERE ja.pouzivatel = ? ${f}
         ORDER BY p.id DESC
         LIMIT ? OFFSET ?`,
      )
      .all(id, limit, od) as {
      id: number;
      zaciatok: number;
      koniec: number;
      dlzka: string | null;
      kola: number;
      dovod: string;
      dohrata: number;
      verzia_pravidiel: string | null;
      s_botom: number;
      bot_povaha: string | null;
      vysledok: Vysledok;
      body: number | null;
      frajerina_pred: number;
      frajerina_po: number;
      pouzivatel: number | null;
      super_body: number | null;
      meno: string | null;
      avatar: string | null;
      ai: number | null;
    }[];
    return {
      pocet,
      partie: riadky.map((r) => ({
        id: r.id,
        koniec: r.koniec,
        trvanie: Math.max(0, r.koniec - r.zaciatok),
        dlzka: r.dlzka,
        kola: r.kola,
        dovod: r.dovod,
        dohrata: r.dohrata === 1,
        verziaPravidiel: r.verzia_pravidiel,
        vysledok: r.vysledok,
        body: r.body === null || r.super_body === null ? null : [r.body, r.super_body],
        frajerina: zmenaFrajeriny(r.s_botom === 1, r.frajerina_pred, r.frajerina_po),
        super: this.superVPartii(r, r.bot_povaha, r.s_botom === 1, spravca),
      })),
    };
  }

  /** Detail partie pre účastníka alebo správcu; null = neexistuje alebo ju volajúci vidieť nesmie. */
  detail(partia: number, volajuci: number, spravca: boolean): DetailPartie | null {
    const p = this.db
      .prepare("SELECT id, zaciatok, koniec, dlzka, verzia_pravidiel, dovod, dohrata, s_botom, bot_povaha, kronika FROM partie WHERE id = ?")
      .get(partia) as
      | { id: number; zaciatok: number; koniec: number; dlzka: string | null; verzia_pravidiel: string | null; dovod: string; dohrata: number; s_botom: number; bot_povaha: string | null; kronika: string | null }
      | undefined;
    if (p === undefined) return null;
    const hraci = this.db
      .prepare(
        `SELECT h.miesto, h.pouzivatel, h.vysledok, h.body, h.frajerina_pred, h.frajerina_po, h.statistiky, u.meno, u.avatar, u.ai
         FROM partie_hraci h LEFT JOIN pouzivatelia u ON u.id = h.pouzivatel WHERE h.partia = ? ORDER BY h.miesto`,
      )
      .all(partia) as unknown as RiadokHraca[];
    if (hraci.length !== 2) return null;
    const ja = hraci.find((h) => h.pouzivatel === volajuci)?.miesto;
    const miesto = ja === 0 || ja === 1 ? ja : null;
    if (miesto === null && !spravca) return null;

    let kronika: { kola?: KoloKroniky[]; zaverecne?: UcetSpakov | ZaverecneV5; menaStarsich?: Record<string, string> } = {};
    try {
      const k = p.kronika === null ? null : (JSON.parse(p.kronika) as unknown);
      // Staršia podoba (len pole kôl) aj nová ({ kola, zaverecne, menaStarsich }).
      kronika = Array.isArray(k) ? { kola: k as KoloKroniky[] } : ((k as typeof kronika | null) ?? {});
    } catch {
      kronika = {};
    }
    // Úspech súperovho NA EX stojí na jeho skrytej ruke — účastník ho nedostane.
    const kola = (kronika.kola ?? []).map((kolo) =>
      miesto === null ? kolo : { ...kolo, naex: kolo.naex.map((n) => (n.kto === miesto ? n : { ...n, uspech: null })) },
    );
    const hrac = (h: RiadokHraca): HracVPartii => ({
      ...this.superVPartii(h, p.bot_povaha, p.s_botom === 1, spravca),
      vysledok: h.vysledok,
      body: h.body,
      frajerina: zmenaFrajeriny(p.s_botom === 1, h.frajerina_pred, h.frajerina_po),
    });
    const [h0, h1] = hraci as [RiadokHraca, RiadokHraca];
    const strana = (h: RiadokHraca): Partial<StatistikyHraca> => (miesto === null || h.miesto === miesto ? citajStatistiky(h.statistiky) : verejneStatistiky(citajStatistiky(h.statistiky)));
    return {
      id: p.id,
      koniec: p.koniec,
      trvanie: Math.max(0, p.koniec - p.zaciatok),
      dlzka: p.dlzka,
      verziaPravidiel: p.verzia_pravidiel,
      dovod: p.dovod,
      dohrata: p.dohrata === 1,
      ja: miesto,
      hraci: [hrac(h0), hrac(h1)],
      kola,
      strany: [strana(h0), strana(h1)],
      zaverecne: kronika.zaverecne ?? null,
      menaStarsich: kronika.menaStarsich ?? {},
    };
  }

  /** Posledné partie hráča pre súhrn (najnovšia prvá); vzdané sa rátajú (Michal 2026-10-22). */
  private partieSuhrnu(id: number, filter: FilterPartii, pocet: number): PartiaSuhrnu[] {
    const riadky = this.db
      .prepare(
        `SELECT ja.vysledok, ja.body, ja.statistiky, on_.body AS super_body, on_.statistiky AS super_statistiky
         FROM partie_hraci ja
         JOIN partie p ON p.id = ja.partia
         JOIN partie_hraci on_ ON on_.partia = ja.partia AND on_.miesto != ja.miesto
         WHERE ja.pouzivatel = ? ${sqlFiltra(filter)}
         ORDER BY p.id DESC
         LIMIT ?`,
      )
      .all(id, pocet) as { vysledok: Vysledok; body: number | null; statistiky: string; super_body: number | null; super_statistiky: string }[];
    return riadky.map((r) => ({
      vysledok: r.vysledok,
      body: r.body,
      superBody: r.super_body,
      ja: citajStatistiky(r.statistiky),
      super: citajStatistiky(r.super_statistiky),
    }));
  }

  /**
   * Súhrn hráča z posledných `okno` partií. Porovnanie s hráčmi: ľudia (nie AI)
   * s aspoň PARTII_NA_PRIEMER partiami s ľuďmi, bez partií s botmi.
   */
  suhrn(id: number, filter: FilterPartii, sStrankami: boolean, okno = 20): Suhrn {
    const ludia = this.db
      .prepare(
        `SELECT ja.pouzivatel AS id FROM partie_hraci ja JOIN partie p ON p.id = ja.partia JOIN pouzivatelia u ON u.id = ja.pouzivatel
         WHERE p.s_botom = 0 AND u.ai = 0 AND ja.pouzivatel != ?
         GROUP BY ja.pouzivatel HAVING COUNT(*) >= ?`,
      )
      .all(id, PARTII_NA_PRIEMER) as { id: number }[];
    const populacia = ludia.map((u) => priemeryHraca(this.partieSuhrnu(u.id, "ludia", okno)));
    return spocitajSuhrn(this.partieSuhrnu(id, filter, okno), populacia, sStrankami);
  }
}

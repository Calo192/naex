// Ranky a práva (Michal 2026-10-22). Hráčske ranky: návštevník → Poldeci
// (kľúč „hrac“) → Deci → Sedmička; nad nimi subadmin a admin. Na Deci
// a Sedmičku sa postupuje hviezdami achievementov (Michal 2026-10-25), nie
// partiami; automatika rank len zvyšuje, nikoho neznižuje. Admin a subadmin
// prideľujú práva rankom v matici (Tvorba → Ranky a práva). Správcovia majú
// vždy všetko, aby sa nikto nezamkol; správcovské funkcie (Tvorba, roadmapa,
// návrhy) ostávajú viazané na rolu. Server každé právo overí — klient len
// skrýva tlačidlá (CLAUDE.md, pravidlá 2 a 3).

import type { Pouzivatel, Rola } from "./auth.ts";
import { ChybaVstupu, jeSpravca } from "./auth.ts";
import type { Db } from "./db.ts";

export const PRAVA = [
  "hrat_bot",
  "hrat_ludia",
  "sukromne_miestnosti",
  "hodnotene_partie",
  "melichar_soundboard",
  "spatna_vazba_pisat",
  "spatna_vazba_reagovat",
  "hodnotit_hru",
  "profily_inych",
  "vlastna_fotka",
  "reporty_playtestov",
  "navrhovat_karty",
  "vidiet_vyvoj",
] as const;
export type Pravo = (typeof PRAVA)[number];

/** Popis pre admin UI a pre hlášku, keď právo chýba. */
export const POPIS_PRAVA: Readonly<Record<Pravo, string>> = {
  hrat_bot: "hrať proti počítaču",
  hrat_ludia: "hrať proti ľuďom",
  sukromne_miestnosti: "zakladať súkromné miestnosti",
  hodnotene_partie: "hrať hodnotené partie (Frajerina)",
  melichar_soundboard: "púšťať hlášky Melichara zo soundboardu",
  spatna_vazba_pisat: "písať do Spätnej väzby",
  spatna_vazba_reagovat: "komentovať a dávať cigarety v Spätnej väzbe",
  hodnotit_hru: "hodnotiť hru (12 kritérií)",
  profily_inych: "vidieť profily iných hráčov a rebríček",
  vlastna_fotka: "nahrať vlastnú fotku avatara",
  reporty_playtestov: "vidieť reporty playtestov",
  navrhovat_karty: "navrhovať karty (Dielňa)",
  vidiet_vyvoj: "vidieť stránku Vývoj (známky hry a roadmapu)",
};

/** Ranky, ktorým sa práva prideľujú, od najnižšieho. */
export const RANKY_HRACOV = ["navstevnik", "hrac", "deci", "sedmicka"] as const satisfies readonly Rola[];
export type RankHraca = (typeof RANKY_HRACOV)[number];

export const jeRankHraca = (r: Rola): r is RankHraca => (RANKY_HRACOV as readonly Rola[]).includes(r);

/**
 * Postup na Deci a Sedmičku v percentách všetkých hviezd (★) achievementov
 * (Michal 2026-10-25). Prahy v hviezdach sa rátajú z aktuálneho katalógu —
 * nový achievement ich posunie sám.
 */
export interface PostupRankov {
  /** Deci od toľkých percent všetkých hviezd. */
  readonly deci: number;
  /** Sedmička od toľkých percent všetkých hviezd. */
  readonly sedmicka: number;
}

/** Hviezdy hráča a koľko ich je v katalógu spolu (0 = achievementy vypnuté). */
export interface HviezdyHraca {
  readonly hviezdy: number;
  readonly spolu: number;
}

/** Čo rozhoduje o automatickom ranku hráča. */
export interface PodkladRanku extends HviezdyHraca {
  /** Dokončil výučbu alebo dohral aspoň jednu partiu (aj s botom) — Poldeci. */
  readonly poldeci: boolean;
}

export interface NastaveniePrav {
  /** Pre každé právo ranky, ktoré ho majú. */
  readonly matica: Readonly<Record<Pravo, readonly RankHraca[]>>;
  readonly postup: PostupRankov;
}

/**
 * Predvolené (Michal 2026-10-22): „Pre začiatok dovoľ všetko každému“ — práva
 * nižším rankom odoberie admin postupne (roadmapa #57). Poldeci po výučbe
 * alebo prvej dohratej partii (aj s botom) je pevné pravidlo; Deci od 35 %
 * a Sedmička od 50 % všetkých hviezd (Michal 2026-10-25).
 */
export const PREDVOLENE_PRAVA: NastaveniePrav = {
  matica: Object.fromEntries(PRAVA.map((p) => [p, [...RANKY_HRACOV]])) as Record<Pravo, RankHraca[]>,
  postup: { deci: 35, sedmicka: 50 },
};

const KLUC = "prava";

/**
 * Prahy v hviezdach: percento zo všetkých, zaokrúhlené nahor — „aspoň 35 %“
 * nesmie pustiť hráča pod 35 %. Bez katalógu (spolu 0) sa na hviezdy postúpiť nedá.
 */
export function prahyRankov(postup: PostupRankov, spolu: number): { readonly deci: number; readonly sedmicka: number } | null {
  if (spolu <= 0) return null;
  // Malá rezerva proti chybe pohyblivej čiarky (35 % zo 100 nesmie dať 36).
  const prah = (percent: number): number => Math.max(1, Math.ceil((percent * spolu) / 100 - 1e-9));
  return { deci: prah(postup.deci), sedmicka: prah(postup.sedmicka) };
}

/** Rank podľa hviezd; Poldeci po výučbe alebo prvej dohratej partii. */
export function rankPodlaHviezd(postup: PostupRankov, p: PodkladRanku): RankHraca {
  const prahy = prahyRankov(postup, p.spolu);
  if (prahy !== null && p.hviezdy >= prahy.sedmicka) return "sedmicka";
  if (prahy !== null && p.hviezdy >= prahy.deci) return "deci";
  return p.poldeci ? "hrac" : "navstevnik";
}

/** Ďalší rank a koľko hviezd naň treba — pre profil; null na vrchole alebo bez katalógu. */
export function dalsiRank(postup: PostupRankov, rank: RankHraca, h: HviezdyHraca): { readonly rank: "deci" | "sedmicka"; readonly prah: number } | null {
  const prahy = prahyRankov(postup, h.spolu);
  if (prahy === null || rank === "sedmicka") return null;
  return rank === "deci" ? { rank: "sedmicka", prah: prahy.sedmicka } : { rank: "deci", prah: prahy.deci };
}

export class Prava {
  private readonly db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  /** Uložené nastavenie doplnené o predvolené — nové právo tak dostane predvolenú hodnotu samo. */
  nastavenie(): NastaveniePrav {
    const r = this.db.prepare("SELECT data FROM nastavenia WHERE kluc = ?").get(KLUC) as { data: string } | undefined;
    // Postup v partiách (kľúč „postup“, do 2026-10-25) sa ignoruje — percentá hviezd sú v „postupHviezd“.
    let ulozene: Partial<{ matica: Record<string, unknown>; postupHviezd: Record<string, unknown> }> = {};
    try {
      ulozene = r === undefined ? {} : (JSON.parse(r.data) as typeof ulozene);
    } catch {
      ulozene = {};
    }
    const matica = { ...PREDVOLENE_PRAVA.matica } as Record<Pravo, readonly RankHraca[]>;
    for (const p of PRAVA) {
      const v = ulozene.matica?.[p];
      if (Array.isArray(v)) matica[p] = RANKY_HRACOV.filter((x) => v.includes(x));
    }
    const percento = (v: unknown): number | null => (typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 100 ? v : null);
    const deci = percento(ulozene.postupHviezd?.deci);
    const sedmicka = percento(ulozene.postupHviezd?.sedmicka);
    // Pokazený záznam (Sedmička nie nad Deci) nesmie pustiť hráčov rovno na Sedmičku — radšej predvolené.
    const postup = deci !== null && sedmicka !== null && sedmicka > deci ? { deci, sedmicka } : PREDVOLENE_PRAVA.postup;
    return { matica, postup };
  }

  /** Zmena matice alebo pravidiel postupu — len správca; overí tvar. */
  uloz(ja: Pouzivatel, telo: Record<string, unknown>): NastaveniePrav {
    if (!jeSpravca(ja.rola)) throw new ChybaVstupu("Práva rankov mení len admin alebo subadmin.", 403);
    const teraz = this.nastavenie();
    const matica = { ...teraz.matica } as Record<Pravo, readonly RankHraca[]>;
    if (telo.matica !== undefined) {
      if (typeof telo.matica !== "object" || telo.matica === null || Array.isArray(telo.matica)) throw new ChybaVstupu("Matica: objekt právo → ranky.");
      for (const [p, v] of Object.entries(telo.matica as Record<string, unknown>)) {
        if (!(PRAVA as readonly string[]).includes(p)) throw new ChybaVstupu(`Neznáme právo „${p}“.`);
        if (!Array.isArray(v) || v.some((x) => !(RANKY_HRACOV as readonly unknown[]).includes(x))) {
          throw new ChybaVstupu(`Právo „${p}“: zoznam rankov (${RANKY_HRACOV.join(", ")}).`);
        }
        matica[p as Pravo] = RANKY_HRACOV.filter((x) => v.includes(x));
      }
    }
    let postup = teraz.postup;
    if (telo.postup !== undefined) {
      const b = telo.postup as Record<string, unknown>;
      const percento = (v: unknown, co: string, predtym: number): number => {
        if (v === undefined) return predtym;
        if (typeof v !== "number" || !Number.isInteger(v) || v < 1 || v > 100) throw new ChybaVstupu(`${co}: celé percento 1 až 100.`);
        return v;
      };
      postup = { deci: percento(b.deci, "Deci", postup.deci), sedmicka: percento(b.sedmicka, "Sedmička", postup.sedmicka) };
      if (postup.sedmicka <= postup.deci) throw new ChybaVstupu("Sedmička musí vyžadovať viac hviezd ako Deci.");
    }
    const nove: NastaveniePrav = { matica, postup };
    this.db
      .prepare("INSERT INTO nastavenia (kluc, data) VALUES (?, ?) ON CONFLICT(kluc) DO UPDATE SET data = excluded.data")
      .run(KLUC, JSON.stringify({ matica, postupHviezd: postup }));
    return nove;
  }

  /**
   * Má používateľ právo? Správca vždy; AI agent hodnotiť smie vždy (playtesty).
   * Neprihlásený (null) má práva Nealka — verejnú stránku (Vývoj) tak admin
   * zatvorí aj návštevníkom bez účtu, keď ju Nealkovi odoberie.
   */
  smie(ja: Pick<Pouzivatel, "rola" | "ai"> | null, pravo: Pravo): boolean {
    if (ja === null) return this.nastavenie().matica[pravo].includes("navstevnik");
    if (jeSpravca(ja.rola)) return true;
    if (pravo === "hodnotit_hru" && ja.ai) return true;
    return jeRankHraca(ja.rola) && this.nastavenie().matica[pravo].includes(ja.rola);
  }

  vyzaduj(ja: Pick<Pouzivatel, "rola" | "ai"> | null, pravo: Pravo): void {
    if (this.smie(ja, pravo)) return;
    if (ja === null) throw new ChybaVstupu(`Prihlás sa — bez účtu sa nedá ${POPIS_PRAVA[pravo]}.`, 401);
    throw new ChybaVstupu(`Na toto tvoj rank nemá právo: ${POPIS_PRAVA[pravo]}.`, 403);
  }

  /** Zoznam práv používateľa — pre /api/ja (klient podľa neho skrýva tlačidlá). */
  zoznam(ja: Pick<Pouzivatel, "rola" | "ai">): Pravo[] {
    return PRAVA.filter((p) => this.smie(ja, p));
  }
}

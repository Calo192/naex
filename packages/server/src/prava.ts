// Ranky a práva (Michal 2026-10-22). Hráčske ranky: návštevník → Poldeci
// (kľúč „hrac“) → Deci → Sedmička; nad nimi subadmin a admin. Admin a subadmin
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
};

/** Ranky, ktorým sa práva prideľujú, od najnižšieho. */
export const RANKY_HRACOV = ["navstevnik", "hrac", "deci", "sedmicka"] as const satisfies readonly Rola[];
export type RankHraca = (typeof RANKY_HRACOV)[number];

export const jeRankHraca = (r: Rola): r is RankHraca => (RANKY_HRACOV as readonly Rola[]).includes(r);

export interface PostupRankov {
  /** Deci po toľkých dohratých partiách s ľuďmi (bez vzdaných). */
  readonly deci: number;
  /** Sedmička po toľkých dohratých partiách s ľuďmi. */
  readonly sedmicka: number;
}

export interface NastaveniePrav {
  /** Pre každé právo ranky, ktoré ho majú. */
  readonly matica: Readonly<Record<Pravo, readonly RankHraca[]>>;
  readonly postup: PostupRankov;
}

/**
 * Predvolené (Michal 2026-10-22): „Pre začiatok dovoľ všetko každému“ — práva
 * nižším rankom odoberie admin postupne (roadmapa #57). Poldeci po prvej
 * dohratej partii (aj s botom) je pevné pravidlo, Deci po 10, Sedmička po 30.
 */
export const PREDVOLENE_PRAVA: NastaveniePrav = {
  matica: Object.fromEntries(PRAVA.map((p) => [p, [...RANKY_HRACOV]])) as Record<Pravo, RankHraca[]>,
  postup: { deci: 10, sedmicka: 30 },
};

const KLUC = "prava";

/** Rank podľa dohratých partií s ľuďmi; Poldeci má každý, kto dohral aspoň jednu partiu (aj s botom). */
export function rankPodlaPartii(postup: PostupRankov, sLudmi: number, dohralAspon1: boolean): RankHraca {
  if (sLudmi >= postup.sedmicka) return "sedmicka";
  if (sLudmi >= postup.deci) return "deci";
  return dohralAspon1 || sLudmi >= 1 ? "hrac" : "navstevnik";
}

export class Prava {
  private readonly db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  /** Uložené nastavenie doplnené o predvolené — nové právo tak dostane predvolenú hodnotu samo. */
  nastavenie(): NastaveniePrav {
    const r = this.db.prepare("SELECT data FROM nastavenia WHERE kluc = ?").get(KLUC) as { data: string } | undefined;
    let ulozene: Partial<{ matica: Record<string, unknown>; postup: Record<string, unknown> }> = {};
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
    const cislo = (v: unknown, predvolene: number): number => (typeof v === "number" && Number.isInteger(v) && v >= 1 ? v : predvolene);
    return {
      matica,
      postup: {
        deci: cislo(ulozene.postup?.deci, PREDVOLENE_PRAVA.postup.deci),
        sedmicka: cislo(ulozene.postup?.sedmicka, PREDVOLENE_PRAVA.postup.sedmicka),
      },
    };
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
      const cislo = (v: unknown, co: string, predtym: number): number => {
        if (v === undefined) return predtym;
        if (typeof v !== "number" || !Number.isInteger(v) || v < 1 || v > 10000) throw new ChybaVstupu(`${co}: celé číslo 1 až 10000.`);
        return v;
      };
      postup = { deci: cislo(b.deci, "Deci", postup.deci), sedmicka: cislo(b.sedmicka, "Sedmička", postup.sedmicka) };
      if (postup.sedmicka <= postup.deci) throw new ChybaVstupu("Sedmička musí vyžadovať viac partií ako Deci.");
    }
    const nove: NastaveniePrav = { matica, postup };
    this.db
      .prepare("INSERT INTO nastavenia (kluc, data) VALUES (?, ?) ON CONFLICT(kluc) DO UPDATE SET data = excluded.data")
      .run(KLUC, JSON.stringify(nove));
    return nove;
  }

  /** Má používateľ právo? Správca vždy; AI agent hodnotiť smie vždy (playtesty). */
  smie(ja: Pick<Pouzivatel, "rola" | "ai">, pravo: Pravo): boolean {
    if (jeSpravca(ja.rola)) return true;
    if (pravo === "hodnotit_hru" && ja.ai) return true;
    return jeRankHraca(ja.rola) && this.nastavenie().matica[pravo].includes(ja.rola);
  }

  vyzaduj(ja: Pick<Pouzivatel, "rola" | "ai">, pravo: Pravo): void {
    if (!this.smie(ja, pravo)) throw new ChybaVstupu(`Na toto tvoj rank nemá právo: ${POPIS_PRAVA[pravo]}.`, 403);
  }

  /** Zoznam práv používateľa — pre /api/ja (klient podľa neho skrýva tlačidlá). */
  zoznam(ja: Pick<Pouzivatel, "rola" | "ai">): Pravo[] {
    return PRAVA.filter((p) => this.smie(ja, p));
  }
}

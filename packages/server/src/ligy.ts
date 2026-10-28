// Ligy (Michal 2026-10-28): dĺžky hry sa hráčovi ukazujú ako Tretia / Druhá /
// Prvá liga a odomykajú sa podľa nastavenia, ktoré definuje admin (Hráči →
// Ligy). Predvolene smie každý všetko; pravidlo odomykania je pripravené —
// Tretia liga hneď, Druhá po 1 výhre v Tretej proti človeku, Prvá po 3 výhrach
// v Druhej — a admin ho zapne vypnutím „všetci smú všetko“ bez nasadenia.
// Partie s botom sa nerátajú (ako v štatistikách). Odomknutie sa zapíše do
// ligy_odomknute, takže ho neskoršie sprísnenie podmienok hráčovi nevezme.
// Správcovia a AI playtesteri smú vždy všetko (turnusy). Server ligu overí pri
// založení aj pripojení — klient len ukazuje zámok (CLAUDE.md, pravidlá 2 a 3).

import { ALL_DLZKY, NAZOV_DLZKY, NAZOV_DLZKY_GENITIV, type DlzkaHry } from "@naex/core";
import type { Pouzivatel } from "./auth.ts";
import { ChybaVstupu, jeSpravca } from "./auth.ts";
import type { Db } from "./db.ts";
import { RANKY_HRACOV, jeRankHraca, type RankHraca } from "./prava.ts";

/** Ligu odomkne toľko výhier proti človeku v inej lige; vyhier 0 = liga je otvorená každému. */
export interface PodmienkaLigy {
  readonly liga: DlzkaHry;
  readonly vyhier: number;
}

export interface PravidloLigy {
  /** null = liga je otvorená každému. */
  readonly podmienka: PodmienkaLigy | null;
  /** Ranky, ktoré ligu majú bez ohľadu na výhry. */
  readonly ranky: readonly RankHraca[];
}

export interface NastavenieLig {
  /** Všetci smú všetky ligy — pravidlá nižšie sa nevynucujú (len sa ukladá, čo hráč splnil). */
  readonly vsetkym: boolean;
  /** Platí obmedzenie aj pre partie proti počítaču (výučba nikdy). */
  readonly ajProtiPocitacu: boolean;
  readonly ligy: Readonly<Record<DlzkaHry, PravidloLigy>>;
}

/** Ako je na tom hráč v jednej lige — pre lobby (zámok, podmienka, postup). */
export interface StavLigy {
  readonly liga: DlzkaHry;
  readonly smie: boolean;
  /** Čo treba splniť („Vyhraj 1 partiu Tretej ligy proti človeku.“); null, keď smie. */
  readonly podmienka: string | null;
  /** Postup k podmienke výhier; null, keď smie alebo liga nemá podmienku výhier. */
  readonly postup: { readonly ma: number; readonly treba: number } | null;
}

export const PREDVOLENE_LIGY: NastavenieLig = {
  vsetkym: true,
  ajProtiPocitacu: true,
  ligy: {
    kratka: { podmienka: null, ranky: [] },
    stredna: { podmienka: { liga: "kratka", vyhier: 1 }, ranky: [] },
    dlha: { podmienka: { liga: "stredna", vyhier: 3 }, ranky: [] },
  },
};

const KLUC = "ligy";
/** Strop len proti preklepu v správe (999 výhier), nie herný limit. */
const MAX_VYHIER = 999;

const jeLiga = (v: unknown): v is DlzkaHry => (ALL_DLZKY as readonly unknown[]).includes(v);

const partii = (n: number): string => (n === 1 ? "partiu" : n >= 2 && n <= 4 ? "partie" : "partií");

/** „Vyhraj 3 partie Druhej ligy proti človeku.“ */
export function textPodmienky(p: PodmienkaLigy): string {
  return `Vyhraj ${p.vyhier} ${partii(p.vyhier)} ${NAZOV_DLZKY_GENITIV[p.liga]} proti človeku.`;
}

/** Overí pravidlo jednej ligy z tela požiadavky; chyby hlási po slovensky. */
function overPravidlo(liga: DlzkaHry, v: unknown): PravidloLigy {
  if (typeof v !== "object" || v === null || Array.isArray(v)) throw new ChybaVstupu(`${NAZOV_DLZKY[liga]}: objekt { podmienka, ranky }.`);
  const o = v as Record<string, unknown>;
  const ranky = o.ranky ?? [];
  if (!Array.isArray(ranky) || ranky.some((x) => !(RANKY_HRACOV as readonly unknown[]).includes(x))) {
    throw new ChybaVstupu(`${NAZOV_DLZKY[liga]}: zoznam rankov (${RANKY_HRACOV.join(", ")}).`);
  }
  let podmienka: PodmienkaLigy | null = null;
  if (o.podmienka !== null && o.podmienka !== undefined) {
    const p = o.podmienka as Record<string, unknown>;
    if (!jeLiga(p.liga)) throw new ChybaVstupu(`${NAZOV_DLZKY[liga]}: podmienka musí menovať ligu (${ALL_DLZKY.join(", ")}).`);
    if (typeof p.vyhier !== "number" || !Number.isInteger(p.vyhier) || p.vyhier < 0 || p.vyhier > MAX_VYHIER) {
      throw new ChybaVstupu(`${NAZOV_DLZKY[liga]}: počet výhier je celé číslo 0 až ${MAX_VYHIER}.`);
    }
    if (p.liga === liga && p.vyhier > 0) throw new ChybaVstupu(`${NAZOV_DLZKY[liga]} sa nemôže odomykať výhrami v sebe samej.`);
    if (p.vyhier > 0) podmienka = { liga: p.liga, vyhier: p.vyhier };
  }
  return { podmienka, ranky: RANKY_HRACOV.filter((x) => ranky.includes(x)) };
}

export class Ligy {
  private readonly db: Db;
  private readonly teraz: () => number;

  constructor(db: Db, teraz: () => number) {
    this.db = db;
    this.teraz = teraz;
  }

  /** Uložené nastavenie doplnené o predvolené; pokazený záznam ligy = predvolené pravidlo. */
  nastavenie(): NastavenieLig {
    const r = this.db.prepare("SELECT data FROM nastavenia WHERE kluc = ?").get(KLUC) as { data: string } | undefined;
    let ulozene: Partial<{ vsetkym: unknown; ajProtiPocitacu: unknown; ligy: Record<string, unknown> }> = {};
    try {
      ulozene = r === undefined ? {} : (JSON.parse(r.data) as typeof ulozene);
    } catch {
      ulozene = {};
    }
    const ligy = { ...PREDVOLENE_LIGY.ligy } as Record<DlzkaHry, PravidloLigy>;
    for (const l of ALL_DLZKY) {
      const v = ulozene.ligy?.[l];
      if (v === undefined) continue;
      try {
        ligy[l] = overPravidlo(l, v);
      } catch {
        // Necháme predvolené — radšej prísnejšie pravidlo zo zadania ako pokazený záznam.
      }
    }
    return {
      vsetkym: typeof ulozene.vsetkym === "boolean" ? ulozene.vsetkym : PREDVOLENE_LIGY.vsetkym,
      ajProtiPocitacu: typeof ulozene.ajProtiPocitacu === "boolean" ? ulozene.ajProtiPocitacu : PREDVOLENE_LIGY.ajProtiPocitacu,
      ligy,
    };
  }

  /** Zmena nastavenia — len správca. */
  uloz(ja: Pick<Pouzivatel, "rola">, telo: Record<string, unknown>): NastavenieLig {
    if (!jeSpravca(ja.rola)) throw new ChybaVstupu("Ligy nastavuje len admin alebo subadmin.", 403);
    const teraz = this.nastavenie();
    if (telo.vsetkym !== undefined && typeof telo.vsetkym !== "boolean") throw new ChybaVstupu("„Všetci smú všetko“: áno alebo nie.");
    if (telo.ajProtiPocitacu !== undefined && typeof telo.ajProtiPocitacu !== "boolean") throw new ChybaVstupu("„Aj proti počítaču“: áno alebo nie.");
    const ligy = { ...teraz.ligy } as Record<DlzkaHry, PravidloLigy>;
    if (telo.ligy !== undefined) {
      if (typeof telo.ligy !== "object" || telo.ligy === null || Array.isArray(telo.ligy)) throw new ChybaVstupu("Ligy: objekt liga → pravidlo.");
      for (const [l, v] of Object.entries(telo.ligy as Record<string, unknown>)) {
        if (!jeLiga(l)) throw new ChybaVstupu(`Neznáma liga „${l}“.`);
        ligy[l] = overPravidlo(l, v);
      }
    }
    const nove: NastavenieLig = {
      vsetkym: (telo.vsetkym as boolean | undefined) ?? teraz.vsetkym,
      ajProtiPocitacu: (telo.ajProtiPocitacu as boolean | undefined) ?? teraz.ajProtiPocitacu,
      ligy,
    };
    this.db
      .prepare("INSERT INTO nastavenia (kluc, data) VALUES (?, ?) ON CONFLICT(kluc) DO UPDATE SET data = excluded.data")
      .run(KLUC, JSON.stringify(nove));
    return nove;
  }

  /** Výhry hráča v lige proti človeku — dohraté partie bez bota (vzdaná partia sa nepočíta, ako pri Poldeci). */
  vyhry(pouzivatel: number, liga: DlzkaHry): number {
    const r = this.db
      .prepare(
        `SELECT COUNT(*) AS n FROM partie_hraci ph JOIN partie pa ON pa.id = ph.partia
         WHERE ph.pouzivatel = ? AND ph.vysledok = 'vyhra' AND pa.dohrata = 1 AND pa.s_botom = 0 AND pa.dlzka = ?`,
      )
      .get(pouzivatel, liga) as { n: number };
    return Number(r.n);
  }

  private odomknute(pouzivatel: number): Set<DlzkaHry> {
    const rs = this.db.prepare("SELECT liga FROM ligy_odomknute WHERE pouzivatel = ?").all(pouzivatel) as { liga: string }[];
    return new Set(rs.map((r) => r.liga).filter(jeLiga));
  }

  /**
   * Stav všetkých líg pre hráča. Splnenú podmienku hneď zapíše — aj keď je
   * zapnuté „všetci smú všetko“ —, aby ju neskoršie sprísnenie nevzalo.
   */
  stav(ja: Pick<Pouzivatel, "id" | "rola" | "ai">): StavLigy[] {
    const n = this.nastavenie();
    const volny = jeSpravca(ja.rola) || ja.ai;
    const odomknute = this.odomknute(ja.id);
    const zapis = this.db.prepare("INSERT OR IGNORE INTO ligy_odomknute (pouzivatel, liga, cas) VALUES (?, ?, ?)");
    return ALL_DLZKY.map((liga): StavLigy => {
      const pravidlo = n.ligy[liga];
      const p = pravidlo.podmienka;
      const ma = p === null ? 0 : this.vyhry(ja.id, p.liga);
      const zRanku = jeRankHraca(ja.rola) && pravidlo.ranky.includes(ja.rola);
      const splnene = p === null || ma >= p.vyhier || zRanku;
      if (splnene && !odomknute.has(liga) && (p !== null || zRanku)) zapis.run(ja.id, liga, this.teraz());
      const smie = volny || n.vsetkym || splnene || odomknute.has(liga);
      if (smie || p === null) return { liga, smie, podmienka: null, postup: null };
      return { liga, smie, podmienka: textPodmienky(p), postup: { ma, treba: p.vyhier } };
    });
  }

  /** Po archivovanej partii ľudí: zapíše, čo hráč práve odomkol. */
  dorovnaj(ja: Pick<Pouzivatel, "id" | "rola" | "ai">): void {
    this.stav(ja);
  }

  /**
   * Prečo hráč ligu hrať nesmie (text pre hlášku), alebo null, keď smie.
   * Partie proti počítaču obmedzuje len zapnuté „aj proti počítaču“.
   */
  preco(ja: Pick<Pouzivatel, "id" | "rola" | "ai">, liga: DlzkaHry, protiPocitacu: boolean): string | null {
    if (protiPocitacu && !this.nastavenie().ajProtiPocitacu) return null;
    const s = this.stav(ja).find((x) => x.liga === liga);
    if (s === undefined || s.smie) return null;
    const postup = s.postup === null ? "" : ` Máš ${s.postup.ma} z ${s.postup.treba}.`;
    return `${NAZOV_DLZKY[liga]} je pre teba zatiaľ zamknutá. ${s.podmienka ?? ""}${postup}`.trim();
  }
}

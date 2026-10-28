// Ligy (Michal 2026-10-28): dĺžky hry sa hráčovi ukazujú ako Tretia / Druhá /
// Prvá liga a odomykajú sa podľa nastavenia, ktoré definuje admin (Hráči →
// Ligy). Predvolene smie každý všetko; pravidlo odomykania je pripravené —
// Tretia liga hneď, Druhá po 1 výhre v Tretej proti človeku, Prvá po 3 výhrach
// v Druhej — a admin ho zapne vypnutím „všetci smú všetko“ bez nasadenia.
// Partie s botom sa nerátajú (ako v štatistikách); výhra, keď súper vzdá
// alebo prehrá kontumačne, áno (Michal 2026-10-28). Partie proti počítaču
// ligy predvolene neobmedzujú (Michal 2026-10-28). Odomknutie sa zapíše do
// ligy_odomknute, takže ho neskoršie sprísnenie podmienok hráčovi nevezme.
// Správcovia a AI playtesteri smú vždy všetko (turnusy). Server ligu overí pri
// založení aj pripojení — klient len ukazuje zámok (CLAUDE.md, pravidlá 2 a 3).
// Ligu môže odomknúť aj achievement (Michal 2026-10-28) — ktorákoľvek splnená
// cesta stačí: výhry, achievement alebo rank.

import { ALL_DLZKY, NAZOV_DLZKY, NAZOV_DLZKY_GENITIV, type DlzkaHry, type KatalogAchievementov } from "@naex/core";
import type { Pouzivatel } from "./auth.ts";
import { ChybaVstupu, jeSpravca } from "./auth.ts";
import type { Db } from "./db.ts";
import { RANKY_HRACOV, jeRankHraca, type RankHraca } from "./prava.ts";

/** Ligu odomkne toľko výhier proti človeku v inej lige; vyhier 0 = liga je otvorená každému. */
export interface PodmienkaLigy {
  readonly liga: DlzkaHry;
  readonly vyhier: number;
}

/** Ligu odomkne achievement aspoň na danom ranku (★). */
export interface AchievementLigy {
  readonly id: string;
  readonly rank: number;
}

export interface PravidloLigy {
  /** Výhry, ktoré ligu odomknú; null = bez podmienky výhier. */
  readonly podmienka: PodmienkaLigy | null;
  /** Achievement, ktorý ligu odomkne; null = bez neho. Bez výhier aj achievementu je liga otvorená každému. */
  readonly achievement: AchievementLigy | null;
  /** Ranky, ktoré ligu majú bez ohľadu na výhry. */
  readonly ranky: readonly RankHraca[];
}

/** Prečo hráč ligu smie: splnil podmienku sám, smú ju všetci, smie vždy (správca, AI), alebo nesmie. */
export type PristupKLige = "odomknuta" | "vsetci" | "vzdy" | "zamknuta";

/** Čo Ligy potrebujú z achievementov: katalóg (názvy, ranky) a čo hráč drží. */
export interface ZdrojAchievementov {
  readonly katalog: KatalogAchievementov;
  drzane(pouzivatel: number): ReadonlyMap<string, number>;
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
  readonly pristup: PristupKLige;
  /**
   * Čo treba splniť, s postupom („Vyhraj 1 partiu Tretej ligy proti človeku (máš 0/1).“);
   * null, keď ju hráč odomkol sám alebo liga podmienku nemá.
   */
  readonly podmienka: string | null;
  /** Postup k podmienke výhier; null, keď je odomknutá alebo nemá podmienku výhier. */
  readonly postup: { readonly ma: number; readonly treba: number } | null;
  /** Výhry proti ľuďom v tejto lige — profil. */
  readonly vyhry: number;
}

export const PREDVOLENE_LIGY: NastavenieLig = {
  vsetkym: true,
  ajProtiPocitacu: false,
  ligy: {
    kratka: { podmienka: null, achievement: null, ranky: [] },
    stredna: { podmienka: { liga: "kratka", vyhier: 1 }, achievement: null, ranky: [] },
    dlha: { podmienka: { liga: "stredna", vyhier: 3 }, achievement: null, ranky: [] },
  },
};

const KLUC = "ligy";
/**
 * Verzia uloženého záznamu. Do verzie 2 bolo „aj proti počítaču“ predvolene
 * zapnuté a uložilo sa s každou zmenou — staršiemu záznamu sa preto neverí
 * a platí vypnuté (Michal 2026-10-28: partie proti počítaču ligy neobmedzujú).
 */
const VERZIA_ZAZNAMU = 2;
/** Strop len proti preklepu v správe (999 výhier), nie herný limit. */
const MAX_VYHIER = 999;

const jeLiga = (v: unknown): v is DlzkaHry => (ALL_DLZKY as readonly unknown[]).includes(v);

const partii = (n: number): string => (n === 1 ? "partiu" : n >= 2 && n <= 4 ? "partie" : "partií");

/** „Vyhraj 3 partie Druhej ligy proti človeku.“ */
export function textPodmienky(p: PodmienkaLigy): string {
  return `Vyhraj ${p.vyhier} ${partii(p.vyhier)} ${NAZOV_DLZKY_GENITIV[p.liga]} proti človeku.`;
}

/** „získaj achievement „Maratón“ ★2“ — hviezda len pri achievemente s viac rankami. */
export function textAchievementu(a: AchievementLigy, katalog: KatalogAchievementov | null): string {
  const def = katalog?.achievementy.find((x) => x.id === a.id);
  const hviezda = def !== undefined && def.prahy.length > 1 ? ` ★${a.rank}` : "";
  return `získaj achievement „${def?.nazov ?? a.id}“${hviezda}`;
}

/**
 * Celá podmienka ligy pre hráča: výhry s postupom, achievement, alebo oboje
 * („… (máš 0/1) alebo získaj achievement „Maratón“ ★2.“). null = liga podmienku nemá.
 */
export function textPravidla(pravidlo: PravidloLigy, vyhier: number, katalog: KatalogAchievementov | null): string | null {
  const casti: string[] = [];
  const p = pravidlo.podmienka;
  if (p !== null) casti.push(`${textPodmienky(p).slice(0, -1)} (máš ${Math.min(vyhier, p.vyhier)}/${p.vyhier})`);
  if (pravidlo.achievement !== null) casti.push(textAchievementu(pravidlo.achievement, katalog));
  if (casti.length === 0) return null;
  const veta = casti.join(" alebo ");
  return `${veta.charAt(0).toUpperCase()}${veta.slice(1)}.`;
}

/**
 * Overí pravidlo jednej ligy z tela požiadavky; chyby hlási po slovensky.
 * Uložený achievement, ktorý z katalógu medzičasom zmizol, sa pri čítaní
 * (prisne = false) len vynechá — ostatné cesty k lige platia ďalej.
 */
function overPravidlo(liga: DlzkaHry, v: unknown, katalog: KatalogAchievementov | null, prisne: boolean): PravidloLigy {
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
  let achievement: AchievementLigy | null = null;
  if (o.achievement !== null && o.achievement !== undefined) {
    const a = o.achievement as Record<string, unknown>;
    const def = typeof a.id === "string" ? katalog?.achievementy.find((x) => x.id === a.id) : undefined;
    if (def === undefined) {
      if (prisne) throw new ChybaVstupu(katalog === null ? "Achievementy sú vypnuté — ligu achievementom odomknúť nemožno." : `${NAZOV_DLZKY[liga]}: neznámy achievement.`);
    } else {
      if (typeof a.rank !== "number" || !Number.isInteger(a.rank) || a.rank < 1 || a.rank > def.prahy.length) {
        throw new ChybaVstupu(`${NAZOV_DLZKY[liga]}: rank achievementu „${def.nazov}“ je 1 až ${def.prahy.length}.`);
      }
      achievement = { id: def.id, rank: a.rank };
    }
  }
  return { podmienka, achievement, ranky: RANKY_HRACOV.filter((x) => ranky.includes(x)) };
}

export class Ligy {
  private readonly db: Db;
  private readonly teraz: () => number;
  /** null = achievementy sú vypnuté; podmienka achievementom sa potom nedá splniť ani nastaviť. */
  private readonly achievementy: ZdrojAchievementov | null;

  constructor(db: Db, teraz: () => number, achievementy: ZdrojAchievementov | null = null) {
    this.db = db;
    this.teraz = teraz;
    this.achievementy = achievementy;
  }

  /** Achievementy na výber v správe Lig; null = vypnuté. */
  ponukaAchievementov(): { readonly id: string; readonly nazov: string; readonly rankov: number }[] | null {
    return this.achievementy?.katalog.achievementy.map((a) => ({ id: a.id, nazov: a.nazov, rankov: a.prahy.length })) ?? null;
  }

  /** Uložené nastavenie doplnené o predvolené; pokazený záznam ligy = predvolené pravidlo. */
  nastavenie(): NastavenieLig {
    const r = this.db.prepare("SELECT data FROM nastavenia WHERE kluc = ?").get(KLUC) as { data: string } | undefined;
    let ulozene: Partial<{ verzia: unknown; vsetkym: unknown; ajProtiPocitacu: unknown; ligy: Record<string, unknown> }> = {};
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
        ligy[l] = overPravidlo(l, v, this.achievementy?.katalog ?? null, false);
      } catch {
        // Necháme predvolené — radšej prísnejšie pravidlo zo zadania ako pokazený záznam.
      }
    }
    return {
      vsetkym: typeof ulozene.vsetkym === "boolean" ? ulozene.vsetkym : PREDVOLENE_LIGY.vsetkym,
      ajProtiPocitacu:
        ulozene.verzia === VERZIA_ZAZNAMU && typeof ulozene.ajProtiPocitacu === "boolean" ? ulozene.ajProtiPocitacu : PREDVOLENE_LIGY.ajProtiPocitacu,
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
        ligy[l] = overPravidlo(l, v, this.achievementy?.katalog ?? null, true);
      }
    }
    const nove: NastavenieLig = {
      vsetkym: (telo.vsetkym as boolean | undefined) ?? teraz.vsetkym,
      ajProtiPocitacu: (telo.ajProtiPocitacu as boolean | undefined) ?? teraz.ajProtiPocitacu,
      ligy,
    };
    this.db
      .prepare("INSERT INTO nastavenia (kluc, data) VALUES (?, ?) ON CONFLICT(kluc) DO UPDATE SET data = excluded.data")
      .run(KLUC, JSON.stringify({ verzia: VERZIA_ZAZNAMU, ...nove }));
    return nove;
  }

  /** Výhry hráča v lige proti človeku (bez bota) — aj keď súper vzdal alebo prehral kontumačne (Michal 2026-10-28). */
  vyhry(pouzivatel: number, liga: DlzkaHry): number {
    const r = this.db
      .prepare(
        `SELECT COUNT(*) AS n FROM partie_hraci ph JOIN partie pa ON pa.id = ph.partia
         WHERE ph.pouzivatel = ? AND ph.vysledok = 'vyhra' AND pa.s_botom = 0 AND pa.dlzka = ?`,
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
    const katalog = this.achievementy?.katalog ?? null;
    const drzane = ALL_DLZKY.some((l) => n.ligy[l].achievement !== null) ? (this.achievementy?.drzane(ja.id) ?? null) : null;
    const vyhryVLige = new Map<DlzkaHry, number>(ALL_DLZKY.map((l) => [l, this.vyhry(ja.id, l)]));
    return ALL_DLZKY.map((liga): StavLigy => {
      const pravidlo = n.ligy[liga];
      const p = pravidlo.podmienka;
      const a = pravidlo.achievement;
      const ma = p === null ? 0 : (vyhryVLige.get(p.liga) ?? 0);
      // Bez výhier aj achievementu je liga otvorená každému — ranky samé ju nezamknú (tak platilo od začiatku).
      const otvorena = p === null && a === null;
      const zVyhier = p !== null && ma >= p.vyhier;
      const zRanku = jeRankHraca(ja.rola) && pravidlo.ranky.includes(ja.rola);
      const zAchievementu = a !== null && (drzane?.get(a.id) ?? 0) >= a.rank;
      const splnene = otvorena || zVyhier || zRanku || zAchievementu;
      if (splnene && !otvorena && !odomknute.has(liga)) zapis.run(ja.id, liga, this.teraz());
      const odomknuta = splnene || odomknute.has(liga);
      const pristup: PristupKLige = odomknuta ? "odomknuta" : volny ? "vzdy" : n.vsetkym ? "vsetci" : "zamknuta";
      const smie = pristup !== "zamknuta";
      const vyhry = vyhryVLige.get(liga) ?? 0;
      if (odomknuta) return { liga, smie, pristup, podmienka: null, postup: null, vyhry };
      return {
        liga,
        smie,
        pristup,
        podmienka: textPravidla(pravidlo, ma, katalog),
        postup: p === null ? null : { ma: Math.min(ma, p.vyhier), treba: p.vyhier },
        vyhry,
      };
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
    return `${NAZOV_DLZKY[liga]} je pre teba zatiaľ zamknutá. ${s.podmienka ?? ""}`.trim();
  }
}

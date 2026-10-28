// Účty a relácie: meno + heslo (scrypt z node:crypto), relácia v HttpOnly
// cookie. V databáze je len hash tokenu — únik databázy neprezradí relácie.
//
// Úroveň účtu (Michal 2026-10-12): admin (jediný, z NAEX_ADMIN_HESLO),
// subadmin (povýši ho admin), hráč, návštevník. Nový účet je návštevník
// a hráčom (Poldeci) sa stane po výučbe alebo prvej dohratej partii proti človeku aj proti botovi
// (Michal 2026-10-21); Deci a Sedmička podľa hviezd achievementov (Michal 2026-10-25, prava.ts).

import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { IncomingMessage } from "node:http";
import type { Db } from "./db.ts";
import type { HviezdyHraca, PostupRankov } from "./prava.ts";
import { RANKY_HRACOV, jeRankHraca, rankPodlaHviezd, type RankHraca } from "./prava.ts";
import type { Pohlavie } from "@naex/core";
import { POHLAVIA } from "@naex/core";

/**
 * Úroveň účtu. Hráčske ranky (Michal 2026-10-22): návštevník → Poldeci (kľúč
 * „hrac“, v UI Poldeci) → Deci → Sedmička; nad nimi subadmin a admin.
 */
export type Rola = "admin" | "subadmin" | "sedmicka" | "deci" | "hrac" | "navstevnik";

const UROVNE: readonly Rola[] = ["admin", "subadmin", "sedmicka", "deci", "hrac", "navstevnik"];

/** Admin a subadmin: správa hráčov, tvorba kariet, mazanie cudzích príspevkov. */
export function jeSpravca(rola: Rola): boolean {
  return rola === "admin" || rola === "subadmin";
}

const rolaZDb = (v: unknown): Rola => (UROVNE.includes(v as Rola) ? (v as Rola) : "navstevnik");
/** Číselné nastavenie účtu; NULL (alebo stĺpec mimo dotazu) = predvolené. */
const nastavenie = (v: unknown, predvolene: number): number => (v === null || v === undefined ? predvolene : Number(v));
/** Vypínač účtu; NULL (alebo stĺpec mimo dotazu) = zapnutý, 0 = vypnutý. */
const vypinac = (v: unknown): boolean => v === null || v === undefined || Number(v) === 1;

export interface Pouzivatel {
  readonly id: number;
  readonly login: string;
  readonly meno: string;
  readonly avatar: string | null;
  readonly rola: Rola;
  /** Zväčšenie karty pri prejdení myšou v percentách (LUPA_OD – LUPA_DO). */
  readonly lupa: number;
  /** Hlasitosť hudby počas partie v percentách (0 = vypnutá). */
  readonly hudba: number;
  /** Hlasitosť hlášok majstra Melichara v partii proti počítaču v percentách (0 = vypnuté). */
  readonly melichar: number;
  /** Účet AI agenta — jeho spätná väzba je na webe označená a predvolene skrytá. */
  readonly ai: boolean;
  /** Farebná schéma webu (id zo zoznamu klienta); null = predvolená. */
  readonly schema: string | null;
  /** Pár farieb hráča v partii ("w20", "w20-prehod"); null = predvolený. Posiela sa len jemu. */
  readonly par: string | null;
  /** Klávesové skratky v partii (K, P, N, Esc, ?) — predvolene zapnuté. */
  readonly skratky: boolean;
  /** Medziobrazovky pri prechode fáz v partii (Michal 2026-10-27) — predvolene zapnuté. */
  readonly medziobrazovky: boolean;
  /** Pohlavie pre tvary hlášok („Eva skončila“); null = neuvádza, hlášky sú neutrálne. */
  readonly pohlavie: Pohlavie | null;
  /** Nápovedy majstra Melichara v partii (Michal 2026-10-24) — predvolene zapnuté. */
  readonly napovedy: boolean;
  /** Súhrn štatistík skrytý pred ostatnými (Michal 2026-10-22). */
  readonly skrytySuhrn: boolean;
}

export const LUPA_OD = 150;
export const LUPA_DO = 400;
export const LUPA_PREDVOLENA = 200;

/** Zväčšenie lupy z requestu — celé percentá v rozsahu nastavenia. */
export function overLupu(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n < LUPA_OD || n > LUPA_DO) throw new ChybaVstupu(`Zväčšenie musí byť ${LUPA_OD} až ${LUPA_DO} %.`);
  return Math.round(n);
}

/** Najviac toľko videných nápoved pri účte — katalóg ich má 19, strop len chráni databázu. */
const MAX_VIDENYCH_NAPOVED = 100;

/** Id nápovede z requestu — tvar ako v napovedy.json („pas-cigarety“). */
export function overIdNapovedy(v: unknown): string {
  if (typeof v !== "string" || !/^[a-z0-9-]{1,40}$/.test(v)) throw new ChybaVstupu("Neznáma nápoveda.");
  return v;
}

export function overPrepinac(v: unknown, co: string): boolean {
  if (typeof v !== "boolean") throw new ChybaVstupu(`${co}: zapnuté alebo vypnuté.`);
  return v;
}

/** Pohlavie z requestu — muz, zena, alebo null (neuvádzať). */
export function overPohlavie(v: unknown): Pohlavie | null {
  if (v === null) return null;
  if (!POHLAVIA.includes(v as Pohlavie)) throw new ChybaVstupu("Pohlavie je muž, žena, alebo neuvádzať.");
  return v as Pohlavie;
}

/**
 * Farebná schéma z requestu. Zoznam schém pozná len klient (apps/web/src/lib/schemy.ts) —
 * neznáme id prehliadač ignoruje a ukáže predvolenú, preto stačí overiť tvar.
 */
export function overSchemu(v: unknown): string {
  if (typeof v !== "string" || !/^[a-z]{2,20}$/.test(v)) throw new ChybaVstupu("Neznáma farebná schéma.");
  return v;
}

/** Pár farieb hráča z requestu — id páru (w + číslo Wadovej kombinácie), s ⇄ prípona -prehod. */
export function overPar(v: unknown): string {
  if (typeof v !== "string" || !/^w[0-9]{1,3}(-prehod)?$/.test(v)) throw new ChybaVstupu("Neznámy pár farieb.");
  return v;
}

export const HUDBA_PREDVOLENA = 30;

/** Hlasitosť hudby (aj hlášok) z requestu — celé percentá 0 – 100. */
export function overHlasitost(v: unknown, co = "hudby"): number {
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 100) throw new ChybaVstupu(`Hlasitosť ${co} musí byť 0 až 100 %.`);
  return Math.round(v);
}

export const MELICHAR_PREDVOLENY = 70;

/** Dohraté partie používateľa — poddotaz nad riadkom `pouzivatelia` (stĺpec id). */
const DOHRATE_SQL = `SELECT COUNT(*) FROM partie_hraci ph JOIN partie pa ON pa.id = ph.partia
  WHERE ph.pouzivatel = pouzivatelia.id AND pa.dohrata = 1 AND pa.s_botom = 0`;

const COOKIE = "naex_sid";
const PLATNOST_MS = 30 * 24 * 60 * 60 * 1000;
/** Parametre scrypt — uložený hash ich nenesie, preto ich hashovanie aj overenie berie odtiaľto. */
const SCRYPT = { N: 16384, r: 8, p: 1 } as const;

export function hashHesla(heslo: string): string {
  const sol = randomBytes(16);
  const hash = scryptSync(heslo, sol, 64, SCRYPT);
  return `scrypt$${sol.toString("base64")}$${hash.toString("base64")}`;
}

function overHeslo(heslo: string, ulozene: string): boolean {
  const [druh, sol, hash] = ulozene.split("$");
  if (druh !== "scrypt" || sol === undefined || hash === undefined) return false;
  const ocakavany = Buffer.from(hash, "base64");
  const skutocny = scryptSync(heslo, Buffer.from(sol, "base64"), ocakavany.length, SCRYPT);
  return timingSafeEqual(ocakavany, skutocny);
}

const hashTokenu = (t: string): string => createHash("sha256").update(t).digest("hex");

export function citajCookie(req: IncomingMessage, meno = COOKIE): string | null {
  for (const kus of (req.headers.cookie ?? "").split(";")) {
    const [k, ...v] = kus.trim().split("=");
    if (k === meno) return decodeURIComponent(v.join("="));
  }
  return null;
}

export function cookieRelacie(token: string, bezpecne: boolean): string {
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${PLATNOST_MS / 1000}${bezpecne ? "; Secure" : ""}`;
}

export function cookieOdhlasenia(bezpecne: boolean): string {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${bezpecne ? "; Secure" : ""}`;
}

export class Ucty {
  private readonly db: Db;
  private readonly adminLogin: string;
  /** Náhodný predvolený avatar pre účet bez vlastnej fotky (pozri Avatary). */
  private predvoleny: () => string | null = () => null;
  /** Hviezdy achievementov hráča (pozri Achievementy); bez achievementov 0 z 0 — na hviezdy sa nepostupuje. */
  private hviezdyHraca: (id: number) => HviezdyHraca = () => ({ hviezdy: 0, spolu: 0 });

  constructor(db: Db, admin: { readonly login: string; readonly heslo: string | null }) {
    this.db = db;
    this.adminLogin = admin.login;
    this.pripravUrovne(admin);
  }

  /**
   * Pri štarte: účty zo starej schémy (rola „pouzivatel“) dostanú úroveň podľa
   * dohratých partií, admin je len jeden (ostatní bývalí admini sú hráči)
   * a jeho heslo sa nastaví z konfigurácie.
   */
  private pripravUrovne(admin: { readonly login: string; readonly heslo: string | null }): void {
    this.db
      .prepare(
        `UPDATE pouzivatelia SET rola = CASE WHEN (${DOHRATE_SQL}) >= 1 THEN 'hrac' ELSE 'navstevnik' END
         WHERE rola NOT IN (${UROVNE.map(() => "?").join(", ")})`,
      )
      .run(...UROVNE);
    // Od 2026-10-21 stačí na úroveň hráč jedna dohratá partia.
    this.db.prepare(`UPDATE pouzivatelia SET rola = 'hrac' WHERE rola = 'navstevnik' AND (${DOHRATE_SQL}) >= 1`).run();
    this.db.prepare("UPDATE pouzivatelia SET rola = 'hrac' WHERE rola = 'admin' AND login <> ?").run(admin.login);
    if (admin.heslo === null) return;
    const r = this.db.prepare("SELECT id, heslo FROM pouzivatelia WHERE login = ?").get(admin.login) as
      | { id: number; heslo: string }
      | undefined;
    if (r === undefined) {
      this.db
        .prepare("INSERT INTO pouzivatelia (login, heslo, meno, rola, vytvoreny) VALUES (?, ?, ?, 'admin', ?)")
        .run(admin.login, hashHesla(admin.heslo), admin.login, Date.now());
      return;
    }
    // Heslo z konfigurácie platí — zmena NAEX_ADMIN_HESLO sa prejaví pri ďalšom štarte.
    if (!overHeslo(admin.heslo, r.heslo)) this.db.prepare("UPDATE pouzivatelia SET heslo = ? WHERE id = ?").run(hashHesla(admin.heslo), r.id);
    this.db.prepare("UPDATE pouzivatelia SET rola = 'admin' WHERE id = ?").run(r.id);
  }

  /** Počet partií, ktoré hráč dohral podľa pravidiel (bez vzdaných a kontumovaných). */
  dohrate(id: number): number {
    return (this.db.prepare(`SELECT (${DOHRATE_SQL}) AS n FROM pouzivatelia WHERE id = ?`).get(id) as { n: number } | undefined)?.n ?? 0;
  }

  /**
   * Postup výučby „Prvá hra“: krok scenára a či je dokončená alebo preskočená.
   * Krok sa hľadá podľa uloženého id kroku (`idKrokov` = id krokov scenára v poradí) —
   * scenár môže pribudnúť či zmeniť poradie a postup ostane. Bez id (uložené pred
   * 2026-10-28) platí index pri tej istej verzii scenára (`verzia` = ScenarVyucby.verzia),
   * inak výučba začne od prvého kroku; stav ostáva.
   */
  vyucba(id: number, verzia: string | null, idKrokov: readonly string[] = []): { krok: number; stav: "hotova" | "preskocena" | null } {
    const r = this.db.prepare("SELECT vyucba_krok, vyucba_krok_id, vyucba_stav, vyucba_verzia FROM pouzivatelia WHERE id = ?").get(id) as
      | { vyucba_krok: number; vyucba_krok_id: string | null; vyucba_stav: string | null; vyucba_verzia: string | null }
      | undefined;
    const stav = r?.vyucba_stav === "hotova" || r?.vyucba_stav === "preskocena" ? r.vyucba_stav : null;
    const podlaId = r?.vyucba_krok_id == null ? -1 : idKrokov.indexOf(r.vyucba_krok_id);
    if (podlaId >= 0) return { krok: podlaId, stav };
    const krok = Number(r?.vyucba_krok ?? 0);
    return { krok: (r?.vyucba_verzia ?? null) === verzia ? krok : 0, stav };
  }

  /** Prvá odpoveď hráča na kontrolnú otázku výučby — ďalšie pokusy sa nezapisujú. */
  ulozOdpovedVyucby(id: number, krok: string, odpoved: number, spravna: boolean, cas: number): void {
    this.db.prepare("INSERT OR IGNORE INTO vyucba_odpovede (pouzivatel, krok, odpoved, spravna, cas) VALUES (?, ?, ?, ?, ?)").run(id, krok, odpoved, spravna ? 1 : 0, cas);
  }

  /** Prehľad prvých odpovedí na otázky výučby: koľkí odpovedali a koľkí správne. */
  odpovedeVyucby(): { krok: string; odpovedi: number; spravne: number }[] {
    return (
      this.db.prepare("SELECT krok, COUNT(*) AS odpovedi, SUM(spravna) AS spravne FROM vyucba_odpovede GROUP BY krok ORDER BY krok").all() as {
        krok: string;
        odpovedi: number;
        spravne: number;
      }[]
    ).map((r) => ({ krok: r.krok, odpovedi: Number(r.odpovedi), spravne: Number(r.spravne) }));
  }

  /** Nápovedy Melichara, ktoré hráč už videl (id z napovedy.json). */
  videneNapovedy(id: number): string[] {
    const r = this.db.prepare("SELECT napovedy_videne FROM pouzivatelia WHERE id = ?").get(id) as { napovedy_videne: string | null } | undefined;
    try {
      const v: unknown = JSON.parse(r?.napovedy_videne ?? "[]");
      return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
    } catch {
      return [];
    }
  }

  /** Zapíše videnú nápovedu; zoznam má strop, aby ho klient nenafúkol. */
  pridajVidenuNapovedu(id: number, napoveda: string): string[] {
    const videne = this.videneNapovedy(id);
    if (videne.includes(napoveda) || videne.length >= MAX_VIDENYCH_NAPOVED) return videne;
    const nove = [...videne, napoveda];
    this.db.prepare("UPDATE pouzivatelia SET napovedy_videne = ? WHERE id = ?").run(JSON.stringify(nove), id);
    return nove;
  }

  /** „Ukázať nápovedy znova“ v profile. */
  resetujNapovedy(id: number): void {
    this.db.prepare("UPDATE pouzivatelia SET napovedy_videne = NULL WHERE id = ?").run(id);
  }

  /**
   * Uloží postup výučby; stav undefined = nemení sa, verzia = scenár, na ktorého kroky krok sedí,
   * idKroku = id kroku na indexe krok (null za posledným krokom).
   */
  ulozVyucbu(id: number, krok: number, stav?: "hotova" | "preskocena" | null, verzia: string | null = null, idKroku: string | null = null): void {
    if (stav === undefined) this.db.prepare("UPDATE pouzivatelia SET vyucba_krok = ?, vyucba_krok_id = ?, vyucba_verzia = ? WHERE id = ?").run(krok, idKroku, verzia, id);
    else this.db.prepare("UPDATE pouzivatelia SET vyucba_krok = ?, vyucba_krok_id = ?, vyucba_stav = ?, vyucba_verzia = ? WHERE id = ?").run(krok, idKroku, stav, verzia, id);
  }

  /** Zdroj hviezd achievementov — nastaví server, keď sú achievementy zapnuté. */
  pouziHviezdy(hviezdy: (id: number) => HviezdyHraca): void {
    this.hviezdyHraca = hviezdy;
  }

  hviezdy(id: number): HviezdyHraca {
    return this.hviezdyHraca(id);
  }

  /**
   * Po dohratej partii (aj proti botovi) alebo výučbe: rank podľa pravidiel
   * postupu — len povyšuje, ručne nastavený rank a správcov nemení. Vracia, či sa zmenil.
   */
  povysPoPartii(id: number, postup: PostupRankov): boolean {
    return this.povys(id, postup, true);
  }

  /** Po novej hviezde: povýši, ak na to hráč má. Vráti nový rank, alebo null, keď sa nezmenil. */
  povysPodlaHviezd(id: number, postup: PostupRankov): Rola | null {
    return this.povys(id, postup, false) ? (this.podlaId(id)?.rola ?? null) : null;
  }

  /**
   * Pri štarte a po zmene pravidiel: povýši každého, komu pravidlá dávajú vyšší rank.
   * Nikoho neznižuje — kto má Deci alebo Sedmičku ešte za partie, ponechá si ich (Michal 2026-10-25).
   */
  prepocitajRanky(postup: PostupRankov): void {
    const ids = this.db.prepare("SELECT id FROM pouzivatelia WHERE rola_rucne = 0").all() as { id: number }[];
    for (const { id } of ids) this.povys(id, postup, false);
  }

  /** Rank podľa pravidiel; Poldeci dáva výučba alebo dohratá partia (s botom sa nerátajú v DOHRATE_SQL, preto poPartii). */
  private rankPodlaPravidiel(id: number, postup: PostupRankov, poPartii: boolean): RankHraca {
    const r = this.db.prepare(`SELECT vyucba_stav, (${DOHRATE_SQL}) AS dohrate FROM pouzivatelia WHERE id = ?`).get(id) as
      | { vyucba_stav: string | null; dohrate: number }
      | undefined;
    const poldeci = poPartii || r?.vyucba_stav === "hotova" || Number(r?.dohrate ?? 0) >= 1;
    return rankPodlaHviezd(postup, { ...this.hviezdyHraca(id), poldeci });
  }

  /** Rank účtu a či ho nastavil správca ručne; undefined = účet neexistuje. */
  private rankUctu(id: number): { readonly rola: Rola; readonly rucne: boolean } | undefined {
    const r = this.db.prepare("SELECT rola, rola_rucne FROM pouzivatelia WHERE id = ?").get(id) as { rola: string; rola_rucne: number } | undefined;
    return r === undefined ? undefined : { rola: rolaZDb(r.rola), rucne: r.rola_rucne === 1 };
  }

  private povys(id: number, postup: PostupRankov, poPartii: boolean): boolean {
    const ucet = this.rankUctu(id);
    if (ucet === undefined || ucet.rucne) return false;
    const teraz = ucet.rola;
    if (!jeRankHraca(teraz)) return false;
    const cielovy = this.rankPodlaPravidiel(id, postup, poPartii);
    if (RANKY_HRACOV.indexOf(cielovy) <= RANKY_HRACOV.indexOf(teraz)) return false;
    this.db.prepare("UPDATE pouzivatelia SET rola = ? WHERE id = ?").run(cielovy, id);
    return true;
  }

  /**
   * Návrat z ručného ranku na automatický: ručný rank sa prepočíta podľa pravidiel
   * (aj nadol), kto už bol aspoň Poldeci, ostáva ním. Automatický rank sa neznižuje —
   * Deci a Sedmička získané ešte za partie ostávajú (Michal 2026-10-25: nikoho neznížiť).
   */
  automatickyRank(id: number, postup: PostupRankov): void {
    const ucet = this.rankUctu(id);
    if (ucet === undefined) return;
    const teraz = ucet.rola;
    if (!jeRankHraca(teraz)) return;
    const podlaPravidiel = this.rankPodlaPravidiel(id, postup, false);
    const dolna: RankHraca = ucet.rucne ? (teraz === "navstevnik" ? "navstevnik" : "hrac") : teraz;
    const rank = RANKY_HRACOV[Math.max(RANKY_HRACOV.indexOf(podlaPravidiel), RANKY_HRACOV.indexOf(dolna))] ?? podlaPravidiel;
    this.db.prepare("UPDATE pouzivatelia SET rola = ?, rola_rucne = 0 WHERE id = ?").run(rank, id);
  }

  /** Či rank nastavil správca ručne (automatika ho nemení). */
  rolaRucne(id: number): boolean {
    return this.rankUctu(id)?.rucne === true;
  }

  private riadok(r: Record<string, unknown> | undefined): Pouzivatel | null {
    if (r === undefined) return null;
    return {
      id: Number(r.id),
      login: String(r.login),
      meno: String(r.meno),
      avatar: r.avatar === null ? null : String(r.avatar),
      rola: rolaZDb(r.rola),
      lupa: nastavenie(r.lupa, LUPA_PREDVOLENA),
      hudba: nastavenie(r.hudba, HUDBA_PREDVOLENA),
      melichar: nastavenie(r.melichar, MELICHAR_PREDVOLENY),
      ai: Number(r.ai) === 1,
      schema: typeof r.schema === "string" ? r.schema : null,
      par: typeof r.par === "string" ? r.par : null,
      skratky: vypinac(r.skratky),
      medziobrazovky: vypinac(r.medziobrazovky),
      napovedy: vypinac(r.napovedy),
      pohlavie: POHLAVIA.includes(r.pohlavie as Pohlavie) ? (r.pohlavie as Pohlavie) : null,
      skrytySuhrn: Number(r.skryty_suhrn) === 1,
    };
  }

  podlaId(id: number): Pouzivatel | null {
    return this.riadok(
      this.db.prepare("SELECT id, login, meno, avatar, rola, lupa, hudba, melichar, ai, schema, par, skratky, medziobrazovky, napovedy, pohlavie, skryty_suhrn FROM pouzivatelia WHERE id = ?").get(id) as
        | Record<string, unknown>
        | undefined,
    );
  }

  /**
   * Predvolené avatary: účty bez fotky ich dostanú hneď, nové pri
   * registrácii a po zmazaní fotky.
   */
  pouziPredvoleneAvatary(nahodny: () => string | null): void {
    this.predvoleny = nahodny;
    const bez = this.db.prepare("SELECT id FROM pouzivatelia WHERE avatar IS NULL").all() as { id: number }[];
    for (const { id } of bez) this.db.prepare("UPDATE pouzivatelia SET avatar = ? WHERE id = ?").run(nahodny(), id);
  }

  predvolenyAvatar(): string | null {
    return this.predvoleny();
  }

  registruj(login: string, heslo: string, meno: string, teraz: number): Pouzivatel {
    const existuje = this.db.prepare("SELECT 1 FROM pouzivatelia WHERE login = ?").get(login);
    // Meno admina je rezervované, aj kým ho konfigurácia nezaložila.
    if (existuje !== undefined || login.toLowerCase() === this.adminLogin.toLowerCase()) {
      throw new ChybaVstupu("Toto prihlasovacie meno je obsadené.");
    }
    const r = this.db
      .prepare("INSERT INTO pouzivatelia (login, heslo, meno, avatar, rola, vytvoreny) VALUES (?, ?, ?, ?, 'navstevnik', ?)")
      .run(login, hashHesla(heslo), meno, this.predvoleny(), teraz);
    const p = this.podlaId(Number(r.lastInsertRowid));
    if (p === null) throw new Error("Účet sa nepodarilo vytvoriť.");
    return p;
  }

  prihlas(login: string, heslo: string): Pouzivatel | null {
    const r = this.db.prepare("SELECT id, heslo FROM pouzivatelia WHERE login = ?").get(login) as
      | { id: number; heslo: string }
      | undefined;
    // Pri neznámom mene sa heslo aj tak „overí“, aby čas odpovede neprezradil účty.
    const ok = overHeslo(heslo, r?.heslo ?? hashHesla("x"));
    if (r === undefined || !ok) return null;
    return this.podlaId(r.id);
  }

  zmenHeslo(id: number, stare: string, nove: string): void {
    const r = this.db.prepare("SELECT heslo FROM pouzivatelia WHERE id = ?").get(id) as { heslo: string } | undefined;
    if (r === undefined || !overHeslo(stare, r.heslo)) throw new ChybaVstupu("Súčasné heslo nesedí.");
    this.db.prepare("UPDATE pouzivatelia SET heslo = ? WHERE id = ?").run(hashHesla(nove), id);
  }

  novaRelacia(id: number, teraz: number): string {
    const token = randomBytes(32).toString("base64url");
    this.db.prepare("DELETE FROM relacie WHERE plati_do < ?").run(teraz);
    this.db.prepare("INSERT INTO relacie (token, pouzivatel, plati_do) VALUES (?, ?, ?)").run(hashTokenu(token), id, teraz + PLATNOST_MS);
    return token;
  }

  zrusRelaciu(token: string): void {
    this.db.prepare("DELETE FROM relacie WHERE token = ?").run(hashTokenu(token));
  }

  zRequestu(req: IncomingMessage, teraz: number): Pouzivatel | null {
    const token = citajCookie(req);
    if (token === null) return null;
    const r = this.db.prepare("SELECT pouzivatel, plati_do FROM relacie WHERE token = ?").get(hashTokenu(token)) as
      | { pouzivatel: number; plati_do: number }
      | undefined;
    if (r === undefined || r.plati_do < teraz) return null;
    return this.podlaId(r.pouzivatel);
  }

  upravProfil(
    id: number,
    zmeny: {
      meno?: string;
      avatar?: string | null;
      lupa?: number;
      hudba?: number;
      melichar?: number;
      schema?: string;
      par?: string;
      skratky?: boolean;
      medziobrazovky?: boolean;
      napovedy?: boolean;
      pohlavie?: Pohlavie | null;
      skrytySuhrn?: boolean;
    },
  ): Pouzivatel | null {
    if (zmeny.meno !== undefined) this.db.prepare("UPDATE pouzivatelia SET meno = ? WHERE id = ?").run(zmeny.meno, id);
    if (zmeny.lupa !== undefined) this.db.prepare("UPDATE pouzivatelia SET lupa = ? WHERE id = ?").run(zmeny.lupa, id);
    if (zmeny.hudba !== undefined) this.db.prepare("UPDATE pouzivatelia SET hudba = ? WHERE id = ?").run(zmeny.hudba, id);
    if (zmeny.melichar !== undefined) this.db.prepare("UPDATE pouzivatelia SET melichar = ? WHERE id = ?").run(zmeny.melichar, id);
    if (zmeny.schema !== undefined) this.db.prepare("UPDATE pouzivatelia SET schema = ? WHERE id = ?").run(zmeny.schema, id);
    if (zmeny.par !== undefined) this.db.prepare("UPDATE pouzivatelia SET par = ? WHERE id = ?").run(zmeny.par, id);
    if (zmeny.skratky !== undefined) this.db.prepare("UPDATE pouzivatelia SET skratky = ? WHERE id = ?").run(zmeny.skratky ? 1 : 0, id);
    if (zmeny.medziobrazovky !== undefined) this.db.prepare("UPDATE pouzivatelia SET medziobrazovky = ? WHERE id = ?").run(zmeny.medziobrazovky ? 1 : 0, id);
    if (zmeny.napovedy !== undefined) this.db.prepare("UPDATE pouzivatelia SET napovedy = ? WHERE id = ?").run(zmeny.napovedy ? 1 : 0, id);
    if (zmeny.pohlavie !== undefined) this.db.prepare("UPDATE pouzivatelia SET pohlavie = ? WHERE id = ?").run(zmeny.pohlavie, id);
    if (zmeny.skrytySuhrn !== undefined) this.db.prepare("UPDATE pouzivatelia SET skryty_suhrn = ? WHERE id = ?").run(zmeny.skrytySuhrn ? 1 : 0, id);
    if (zmeny.avatar !== undefined) this.db.prepare("UPDATE pouzivatelia SET avatar = ? WHERE id = ?").run(zmeny.avatar, id);
    return this.podlaId(id);
  }

  zoznam(): (Pouzivatel & { vytvoreny: number; dohrate: number; rolaRucne: boolean })[] {
    const rows = this.db
      .prepare(`SELECT id, login, meno, avatar, rola, rola_rucne, ai, vytvoreny, (${DOHRATE_SQL}) AS dohrate FROM pouzivatelia ORDER BY id`)
      .all() as Record<string, unknown>[];
    return rows.map((r) => ({
      ...(this.riadok(r) as Pouzivatel),
      vytvoreny: Number(r.vytvoreny),
      dohrate: Number(r.dohrate),
      rolaRucne: Number(r.rola_rucne) === 1,
    }));
  }

  /** Ručné nastavenie úrovne — hráčsky rank potom automatika nemení (rola_rucne). */
  nastavRolu(id: number, rola: Rola): void {
    this.db.prepare("UPDATE pouzivatelia SET rola = ?, rola_rucne = ? WHERE id = ?").run(rola, jeRankHraca(rola) ? 1 : 0, id);
  }

  nastavAi(id: number, ai: boolean): void {
    this.db.prepare("UPDATE pouzivatelia SET ai = ? WHERE id = ?").run(ai ? 1 : 0, id);
  }
}

/** Chyba spôsobená vstupom používateľa — správa ide priamo do UI. */
export class ChybaVstupu extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export function overLogin(login: unknown): string {
  if (typeof login !== "string" || !/^[a-zA-Z0-9._-]{3,32}$/.test(login.trim())) {
    throw new ChybaVstupu("Prihlasovacie meno: 3 – 32 znakov, písmená bez diakritiky, čísla, bodka, pomlčka.");
  }
  return login.trim();
}

export function overHesloVstup(heslo: unknown): string {
  if (typeof heslo !== "string" || heslo.length < 8 || heslo.length > 200) {
    throw new ChybaVstupu("Heslo musí mať aspoň 8 znakov.");
  }
  return heslo;
}

export function overMeno(meno: unknown): string {
  const m = typeof meno === "string" ? meno.trim().replace(/\s+/g, " ") : "";
  if (m.length < 2 || m.length > 24) throw new ChybaVstupu("Herné meno musí mať 2 – 24 znakov.");
  if (/[<>]/.test(m)) throw new ChybaVstupu("Herné meno nesmie obsahovať < ani >.");
  return m;
}

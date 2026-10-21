// Roadmapa hry (Michal 2026-10-21). Stĺpce sú abstraktné horizonty, nie
// dátumy; poradie v stĺpci je priorita a Developer berie stĺpec Teraz zhora.
//
// Vidí ju každý (aj bez prihlásenia) okrem Prijímača a položiek, ktoré správca
// skryl. Upravuje ju admin a subadmin; AI agent (navrhár) smie len pridávať,
// a to len do Prijímača. Rozhodnutie o návrhu z playtestu sa do roadmapy
// premietne samo (zNavrhu): schválený do Prijímača, odložený do Neskôr,
// implementovaný do Hotové.

import { existsSync, readFileSync } from "node:fs";
import type { Db } from "./db.ts";
import type { Pouzivatel } from "./auth.ts";
import { ChybaVstupu, jeSpravca } from "./auth.ts";
import type { Navrh, StavNavrhu } from "./navrhy.ts";

export const STLPCE = [
  { kluc: "prijimac", nazov: "Prijímač", horizont: "", zamer: "Návrhy z playtestov a dizajnu, ktoré čakajú na zaradenie do horizontu.", verejny: false },
  { kluc: "teraz", nazov: "Teraz", horizont: "horizont 1", zamer: "Férová a čitateľná partia.", verejny: true },
  { kluc: "dalej", nazov: "Ďalej", horizont: "horizont 2", zamer: "Pripravená pre ľudí.", verejny: true },
  { kluc: "potom", nazov: "Potom", horizont: "horizont 3", zamer: "Hra vo dvojici: formát 2 na 2.", verejny: true },
  { kluc: "neskor", nazov: "Neskôr", horizont: "horizont 4", zamer: "Obsah a komunita. Nápady a odložené návrhy.", verejny: true },
  { kluc: "hotove", nazov: "Hotové", horizont: "", zamer: "Implementované a nasadené.", verejny: true },
] as const;
export type Stlpec = (typeof STLPCE)[number]["kluc"];
const KLUCE_STLPCOV: readonly string[] = STLPCE.map((s) => s.kluc);

export const OBLASTI = ["pravidla", "ui", "karty", "2v2", "platforma", "komunita"] as const;
export type Oblast = (typeof OBLASTI)[number];
export const NAROCNOSTI = ["S", "M", "L"] as const;
export type Narocnost = (typeof NAROCNOSTI)[number];
export const STAVY_POLOZKY = ["napad", "nove", "rozhodnute", "overit", "rozpracovane", "hotove"] as const;
export type StavPolozky = (typeof STAVY_POLOZKY)[number];
export const TYPY_ZDROJA = ["playtest", "dizajn", "michal", "napad"] as const;

export interface Zdroj {
  readonly typ: (typeof TYPY_ZDROJA)[number];
  readonly text: string;
  /** Cesta v aplikácii (napr. /playtest/reporty/…) alebo ''. */
  readonly odkaz: string;
}

export interface ObsahPolozky {
  readonly nazov: string;
  readonly kratko: string;
  readonly preco: string;
  readonly hotovo: string;
  readonly oblast: Oblast;
  readonly narocnost: Narocnost;
  readonly stav: StavPolozky;
  readonly zdroj: Zdroj | null;
  /** Id položiek, ktoré musia byť hotové skôr. */
  readonly zavisi: readonly number[];
  /** Commit alebo výsledok Developera pri hotovej položke. */
  readonly commit: string;
}

export interface Polozka extends ObsahPolozky {
  readonly id: number;
  readonly stlpec: Stlpec;
  readonly poradie: number;
  readonly navrh: number | null;
  readonly verejna: boolean;
  readonly vytvorena: number;
  readonly upravena: number;
  readonly dokoncena: number | null;
}

const MAX_TEXT = 2000;

function text(v: unknown, max: number, pole: string, povinny = false): string {
  const t = typeof v === "string" ? v.replace(/\r\n/g, "\n").trim() : "";
  if (povinny && t === "") throw new ChybaVstupu(`${pole}: chýba text.`);
  if (t.length > max) throw new ChybaVstupu(`${pole}: najviac ${max} znakov.`);
  return t;
}

function zJednej<T extends string>(v: unknown, moznosti: readonly T[], pole: string): T {
  if (!(moznosti as readonly unknown[]).includes(v)) throw new ChybaVstupu(`${pole}: ${moznosti.join(" | ")}.`);
  return v as T;
}

function overZdroj(v: unknown): Zdroj | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== "object" || Array.isArray(v)) throw new ChybaVstupu("Zdroj musí byť objekt.");
  const z = v as Record<string, unknown>;
  const odkaz = text(z.odkaz, 300, "Odkaz zdroja");
  if (odkaz !== "" && !/^\/[\w\-./#%]*$/.test(odkaz)) throw new ChybaVstupu("Odkaz zdroja je cesta na webe (začína /).");
  return { typ: zJednej(z.typ, TYPY_ZDROJA, "Typ zdroja"), text: text(z.text, 120, "Zdroj", true), odkaz };
}

/** Celý obsah položky z tela požiadavky; čo chýba, vezme z `stary`. */
function overObsah(v: Record<string, unknown>, stary: ObsahPolozky | null): ObsahPolozky {
  const ma = (k: string): boolean => v[k] !== undefined;
  const zavisi = ma("zavisi") ? v.zavisi : (stary?.zavisi ?? []);
  if (!Array.isArray(zavisi) || zavisi.length > 20 || zavisi.some((z) => !Number.isInteger(z))) throw new ChybaVstupu("Závislosti: zoznam id položiek.");
  return {
    nazov: ma("nazov") ? text(v.nazov, 120, "Názov", true) : (stary?.nazov ?? text(undefined, 120, "Názov", true)),
    kratko: ma("kratko") ? text(v.kratko, 300, "Krátko") : (stary?.kratko ?? ""),
    preco: ma("preco") ? text(v.preco, MAX_TEXT, "Prečo") : (stary?.preco ?? ""),
    hotovo: ma("hotovo") ? text(v.hotovo, MAX_TEXT, "Hotovo, keď") : (stary?.hotovo ?? ""),
    oblast: ma("oblast") ? zJednej(v.oblast, OBLASTI, "Oblasť") : (stary?.oblast ?? "pravidla"),
    narocnost: ma("narocnost") ? zJednej(v.narocnost, NAROCNOSTI, "Náročnosť") : (stary?.narocnost ?? "M"),
    stav: ma("stav") ? zJednej(v.stav, STAVY_POLOZKY, "Stav") : (stary?.stav ?? "napad"),
    zdroj: ma("zdroj") ? overZdroj(v.zdroj) : (stary?.zdroj ?? null),
    zavisi: zavisi as number[],
    commit: ma("commit") ? text(v.commit, 300, "Commit") : (stary?.commit ?? ""),
  };
}

/** Oblasť návrhu z playtestu je voľný text navrhára — odhad pre farbu na tabuli. */
function oblastNavrhu(oblast: string): Oblast {
  const o = oblast.toLocaleLowerCase("sk");
  if (/rozhran|zobraz|ui|ux|ovládan|stôl|displej/.test(o)) return "ui";
  if (/kart/.test(o)) return "karty";
  return "pravidla";
}

/** Len obsah (stĺpec data) — bez stĺpcov tabuľky. */
const obsahZ = (p: ObsahPolozky): ObsahPolozky => ({
  nazov: p.nazov, kratko: p.kratko, preco: p.preco, hotovo: p.hotovo, oblast: p.oblast,
  narocnost: p.narocnost, stav: p.stav, zdroj: p.zdroj, zavisi: p.zavisi, commit: p.commit,
});

/** Položka zo seed/roadmapa.json — závislosti a stĺpec cez kľúče. */
interface SeedPolozka extends Partial<Omit<ObsahPolozky, "zavisi">> {
  readonly kluc: string;
  readonly stlpec: Stlpec;
  readonly zavisi?: readonly string[];
  readonly verejna?: boolean;
  /** Deň dokončenia hotovej položky (RRRR-MM-DD). */
  readonly dokoncena?: string;
}

export class Roadmapa {
  private readonly db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  private riadok(r: Record<string, unknown>): Polozka {
    return {
      ...(JSON.parse(String(r.data)) as ObsahPolozky),
      id: Number(r.id),
      stlpec: r.stlpec as Stlpec,
      poradie: Number(r.poradie),
      navrh: r.navrh === null ? null : Number(r.navrh),
      verejna: Number(r.verejna) === 1,
      vytvorena: Number(r.vytvorena),
      upravena: Number(r.upravena),
      dokoncena: r.dokoncena === null ? null : Number(r.dokoncena),
    };
  }

  private vsetky(): Polozka[] {
    return (this.db.prepare("SELECT * FROM roadmapa ORDER BY poradie, id").all() as Record<string, unknown>[]).map((r) => this.riadok(r));
  }

  private jedna(id: number): Polozka {
    const r = this.db.prepare("SELECT * FROM roadmapa WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    if (r === undefined) throw new ChybaVstupu("Taká položka roadmapy neexistuje.", 404);
    return this.riadok(r);
  }

  /** Roadmapa pre `ja`: správca vidí všetko, ostatní verejné stĺpce a položky bez odkazov do sekcie Playtest. */
  zoznam(ja: Pouzivatel | null): { stlpce: typeof STLPCE; polozky: Polozka[]; upravuje: boolean } {
    const spravca = ja !== null && jeSpravca(ja.rola);
    const vsetky = this.vsetky();
    if (spravca) return { stlpce: STLPCE, polozky: vsetky, upravuje: true };
    const verejneStlpce = new Set<string>(STLPCE.filter((s) => s.verejny).map((s) => s.kluc));
    const polozky = vsetky.filter((p) => p.verejna && verejneStlpce.has(p.stlpec));
    const viditelne = new Set(polozky.map((p) => p.id));
    return {
      stlpce: STLPCE,
      polozky: polozky.map((p) => ({
        ...p,
        navrh: null,
        zavisi: p.zavisi.filter((z) => viditelne.has(z)),
        zdroj: p.zdroj === null ? null : { ...p.zdroj, odkaz: p.zdroj.odkaz.startsWith("/playtest") ? "" : p.zdroj.odkaz },
      })),
      upravuje: false,
    };
  }

  /** Hotové položky s dátumom — značky na časovej osi známok. */
  udalosti(): { cas: number; text: string }[] {
    return this.vsetky()
      .filter((p) => p.stlpec === "hotove" && p.verejna && p.dokoncena !== null)
      .map((p) => ({ cas: p.dokoncena as number, text: p.nazov }))
      .sort((a, b) => a.cas - b.cas);
  }

  private hranica(stlpec: Stlpec, kde: "zaciatok" | "koniec"): number {
    const r = this.db.prepare(`SELECT ${kde === "zaciatok" ? "MIN" : "MAX"}(poradie) AS p FROM roadmapa WHERE stlpec = ?`).get(stlpec) as { p: number | null };
    if (r.p === null) return 1;
    return kde === "zaciatok" ? r.p - 1 : r.p + 1;
  }

  /** Poradie tesne pred položkou `pred` v stĺpci (null = na koniec). */
  private poradiePred(stlpec: Stlpec, pred: number | null, okrem: number): number {
    if (pred === null) return this.hranica(stlpec, "koniec");
    const p = this.jedna(pred);
    if (p.stlpec !== stlpec) throw new ChybaVstupu("Položka, pred ktorú presúvaš, je v inom stĺpci.");
    const predosla = this.db
      .prepare("SELECT MAX(poradie) AS p FROM roadmapa WHERE stlpec = ? AND poradie < ? AND id <> ?")
      .get(stlpec, p.poradie, okrem) as { p: number | null };
    return predosla.p === null ? p.poradie - 1 : (predosla.p + p.poradie) / 2;
  }

  private vloz(obsah: ObsahPolozky, stlpec: Stlpec, poradie: number, teraz: number, navrh: number | null = null, verejna = true, dokoncena: number | null = null): number {
    const r = this.db
      .prepare(
        `INSERT INTO roadmapa (stlpec, poradie, data, navrh, verejna, vytvorena, upravena, dokoncena)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      )
      .get(stlpec, poradie, JSON.stringify(obsah), navrh, verejna ? 1 : 0, teraz, teraz, dokoncena) as { id: number };
    return Number(r.id);
  }

  pridaj(ja: Pouzivatel, telo: Record<string, unknown>, teraz: number): number {
    if (!jeSpravca(ja.rola) && !ja.ai) throw new ChybaVstupu("Do roadmapy pridáva len admin, subadmin alebo AI navrhár.", 403);
    // AI agent pridáva len do Prijímača — stĺpec a poradie určí človek.
    const stlpec = ja.ai && !jeSpravca(ja.rola) ? "prijimac" : zJednej(telo.stlpec ?? "prijimac", KLUCE_STLPCOV, "Stĺpec") as Stlpec;
    const obsah = overObsah(telo, null);
    this.overZavislosti(obsah.zavisi, null);
    const navrch = telo.navrch === true;
    return this.vloz(obsah, stlpec, this.hranica(stlpec, navrch ? "zaciatok" : "koniec"), teraz, null, telo.verejna !== false);
  }

  private overZavislosti(zavisi: readonly number[], id: number | null): void {
    for (const z of zavisi) {
      if (z === id) throw new ChybaVstupu("Položka nemôže závisieť sama od seba.");
      this.jedna(z);
    }
  }

  uprav(ja: Pouzivatel, id: number, telo: Record<string, unknown>, teraz: number): void {
    if (!jeSpravca(ja.rola)) throw new ChybaVstupu("Roadmapu upravuje len admin alebo subadmin.", 403);
    const stara = this.jedna(id);
    const obsah = overObsah(telo, stara);
    this.overZavislosti(obsah.zavisi, id);
    const verejna = telo.verejna === undefined ? stara.verejna : telo.verejna === true;
    this.db.prepare("UPDATE roadmapa SET data = ?, verejna = ?, upravena = ? WHERE id = ?").run(JSON.stringify(obsah), verejna ? 1 : 0, teraz, id);
  }

  /** Presun do stĺpca `stlpec` pred položku `pred` (null = na koniec). */
  presun(ja: Pouzivatel, id: number, telo: Record<string, unknown>, teraz: number): void {
    if (!jeSpravca(ja.rola)) throw new ChybaVstupu("Poradie v roadmape mení len admin alebo subadmin.", 403);
    const p = this.jedna(id);
    const stlpec = zJednej(telo.stlpec ?? p.stlpec, KLUCE_STLPCOV, "Stĺpec") as Stlpec;
    const pred = telo.pred === null || telo.pred === undefined ? null : Number(telo.pred);
    if (pred !== null && !Number.isInteger(pred)) throw new ChybaVstupu("Pred: id položky alebo null.");
    if (pred === id) return;
    this.premiestni(p, stlpec, this.poradiePred(stlpec, pred, id), teraz);
  }

  private premiestni(p: Polozka, stlpec: Stlpec, poradie: number, teraz: number, zmeny: Partial<ObsahPolozky> = {}): void {
    const doHotovych = stlpec === "hotove" && p.stlpec !== "hotove";
    const zHotovych = stlpec !== "hotove" && p.stlpec === "hotove";
    const stav: StavPolozky | undefined = doHotovych ? "hotove" : zHotovych ? "rozhodnute" : undefined;
    const data = obsahZ({ ...p, ...zmeny, ...(stav !== undefined ? { stav } : {}) });
    this.db
      .prepare("UPDATE roadmapa SET stlpec = ?, poradie = ?, data = ?, upravena = ?, dokoncena = ? WHERE id = ?")
      .run(stlpec, poradie, JSON.stringify(data), teraz, doHotovych ? teraz : zHotovych ? null : p.dokoncena, p.id);
  }

  zmaz(ja: Pouzivatel, id: number): void {
    if (!jeSpravca(ja.rola)) throw new ChybaVstupu("Z roadmapy maže len admin alebo subadmin.", 403);
    this.jedna(id);
    this.db.prepare("DELETE FROM roadmapa WHERE id = ?").run(id);
    // Závislosť na zmazanej položke stratila zmysel.
    for (const p of this.vsetky().filter((q) => q.zavisi.includes(id))) {
      this.db.prepare("UPDATE roadmapa SET data = ? WHERE id = ?").run(JSON.stringify(obsahZ({ ...p, zavisi: p.zavisi.filter((z) => z !== id) })), p.id);
    }
  }

  /**
   * Rozhodnutie o návrhu z playtestu sa premietne do roadmapy: schválený ide
   * navrch Prijímača, odložený na koniec Neskôr, implementovaný do Hotové,
   * zamietnutý alebo vrátený na rozhodnutie z Prijímača a Neskôr zmizne.
   * Kam ho admin medzitým potiahol (Teraz, Ďalej…), tam ostane.
   */
  zNavrhu(n: Navrh, stav: StavNavrhu, teraz: number): void {
    const r = this.db.prepare("SELECT * FROM roadmapa WHERE navrh = ?").get(n.id) as Record<string, unknown> | undefined;
    const p = r === undefined ? null : this.riadok(r);
    const moznost = n.moznosti.find((m) => m.kluc === n.volba);
    const obsah: ObsahPolozky = {
      nazov: n.nazov,
      kratko: moznost !== undefined ? `${moznost.kluc}: ${moznost.nazov}` : n.volba === "vlastne" ? "Vlastné riešenie (poznámka v návrhu)." : n.problem.slice(0, 280),
      preco: n.problem.slice(0, MAX_TEXT),
      hotovo: "",
      oblast: oblastNavrhu(n.oblast),
      narocnost: "M",
      stav: "rozhodnute",
      zdroj: { typ: "playtest", text: `Playtest ${n.davka}`, odkaz: "/playtest" },
      zavisi: [],
      commit: "",
    };
    switch (stav) {
      case "implementovat":
        if (p === null) this.vloz(obsah, "prijimac", this.hranica("prijimac", "zaciatok"), teraz, n.id);
        else if (p.stlpec === "neskor" || p.stlpec === "hotove") this.premiestni(p, "prijimac", this.hranica("prijimac", "zaciatok"), teraz, { stav: "rozhodnute", kratko: obsah.kratko });
        else this.premiestni(p, p.stlpec, p.poradie, teraz, { stav: "rozhodnute", kratko: obsah.kratko });
        return;
      case "odlozene":
        if (p === null) this.vloz({ ...obsah, stav: "napad" }, "neskor", this.hranica("neskor", "koniec"), teraz, n.id);
        else if (p.stlpec !== "hotove") this.premiestni(p, "neskor", this.hranica("neskor", "koniec"), teraz, { stav: "napad" });
        return;
      case "rozpracovane":
        if (p === null) this.vloz({ ...obsah, stav: "rozpracovane" }, "teraz", this.hranica("teraz", "zaciatok"), teraz, n.id);
        else this.premiestni(p, p.stlpec === "hotove" ? "teraz" : p.stlpec, p.poradie, teraz, { stav: "rozpracovane" });
        return;
      case "implementovane":
        if (p === null) this.vloz({ ...obsah, stav: "hotove", commit: n.vysledok.slice(0, 300) }, "hotove", this.hranica("hotove", "zaciatok"), teraz, n.id, true, teraz);
        else this.premiestni(p, "hotove", this.hranica("hotove", "zaciatok"), teraz, { commit: n.vysledok.slice(0, 300) });
        return;
      case "zamietnute":
      case "nove":
        if (p !== null && (p.stlpec === "prijimac" || p.stlpec === "neskor")) this.db.prepare("DELETE FROM roadmapa WHERE id = ?").run(p.id);
        return;
    }
  }

  /** Prvé spustenie: prázdnu roadmapu naplní zo seed/roadmapa.json. */
  naplnAkTreba(seedPath: string, teraz: number): void {
    const { n } = this.db.prepare("SELECT COUNT(*) AS n FROM roadmapa").get() as { n: number };
    if (n > 0 || !existsSync(seedPath)) return;
    const seed = JSON.parse(readFileSync(seedPath, "utf8")) as SeedPolozka[];
    const ids = new Map<string, number>();
    const poradie = new Map<string, number>();
    for (const s of seed) {
      const obsah = overObsah({ ...s, zavisi: [] } as unknown as Record<string, unknown>, null);
      const por = (poradie.get(s.stlpec) ?? 0) + 1;
      poradie.set(s.stlpec, por);
      const dokoncena = s.dokoncena === undefined ? null : Date.parse(`${s.dokoncena}T12:00:00+02:00`);
      ids.set(s.kluc, this.vloz(obsah, s.stlpec, por, teraz, null, s.verejna !== false, dokoncena));
    }
    for (const s of seed) {
      if (s.zavisi === undefined || s.zavisi.length === 0) continue;
      const id = ids.get(s.kluc) as number;
      const p = this.jedna(id);
      const zavisi = s.zavisi.map((k) => ids.get(k)).filter((z): z is number => z !== undefined);
      this.premiestni(p, p.stlpec, p.poradie, p.upravena, { zavisi });
    }
  }
}

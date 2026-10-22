// Dielňa (Michal 2026-10-22): hráči navrhujú nové karty aj úpravy existujúcich,
// ostatní hlasujú cigaretami (1 hráč = 1 cigareta, AI hlasy sa nerátajú)
// a komentujú; admin alebo subadmin návrh schváli (prevezme do tvorcu kariet
// a založí v Prijímači roadmapy „naprogramovať efekt“), vráti na úpravu,
// alebo zamietne — vždy s dôvodom. Koncept vidí len autor; ostatné stavy
// sú verejné. Server vynucuje všetko (CLAUDE.md, pravidlá 2 a 3).

import type { KartaNavrh, Sada, StranaNavrhu } from "@naex/tvorba";
import { chybyNavrhu, kontrolaTextov } from "@naex/tvorba";
import type { Db } from "./db.ts";
import type { Pouzivatel } from "./auth.ts";
import { ChybaVstupu, jeSpravca } from "./auth.ts";
import type { Prava } from "./prava.ts";

export const STAVY_DIELNE = ["koncept", "hlasovanie", "vratene", "zamietnute", "v_tvorcovi"] as const;
export type StavDielne = (typeof STAVY_DIELNE)[number];
/** Stav, ako ho vidí hráč: „v hre“ a „archív“ sa odvodzujú pri čítaní. */
export type StavZobrazeny = StavDielne | "v_hre" | "archiv";
export type TypNavrhu = "nova" | "uprava";
export type Rozhodnutie = "schvalit" | "vratit" | "zamietnut";

/** Otvorené návrhy (koncept, hlasovanie, vrátené) — najviac 3 na hráča. */
export const MAX_OTVORENYCH = 3;
/** Návrh bez jedinej ľudskej cigarety ide po 60 dňoch do archívu. */
export const ARCHIV_PO_MS = 60 * 24 * 60 * 60 * 1000;
/** Značka „krabička“ — len vizuálny prah, nie podmienka posudku. */
export const KRABICKA = 20;
const POZICIE = [0, 1, 2, 3] as const;
const OKNO_MS = 10 * 60 * 1000;
const LIMIT_KOMENTAROV = 20;
const MAX_TAGOV = 5;

export interface ObsahNavrhu {
  readonly nazov: string;
  readonly tagy: readonly string[];
  readonly efekt: string;
  readonly lava: StranaNavrhu;
  readonly prava: StranaNavrhu;
  /** Ilustrácia z knižnice (id média) alebo pôvodná ilustrácia upravovanej karty. */
  readonly obrazok: string | null;
  /** Slovný popis ilustrácie — po schválení zadanie pre Leonardo. */
  readonly popisIlustracie: string;
  /** Nápad na akciu, ktorú hra nepozná — len text, nie kód. */
  readonly novaAkcia: string;
  /** Prečo by karta (zmena) hre pomohla. */
  readonly zdovodnenie: string;
}

export interface AutorDielne {
  readonly id: number;
  readonly meno: string;
  readonly avatar: string | null;
  readonly rola: string;
  readonly ai: boolean;
  /** Má aspoň jednu kartu prevzatú z Dielne — odznak pri mene. */
  readonly odznak: boolean;
}

export interface KomentarDielne {
  readonly id: number;
  readonly autor: AutorDielne;
  readonly text: string;
  readonly vytvoreny: number;
}

export interface NavrhDielne {
  readonly id: number;
  readonly typ: TypNavrhu;
  /** Id upravovanej karty (úprava) — a jej podoba v čase návrhu, nech sa dá ukázať rozdiel. */
  readonly zaklad: string | null;
  readonly zakladKarta: KartaNavrh | null;
  readonly autor: AutorDielne;
  readonly obsah: ObsahNavrhu;
  readonly stav: StavZobrazeny;
  readonly dovod: string;
  readonly cigarety: number;
  readonly mojaCigareta: boolean;
  readonly komentarov: number;
  readonly vytvoreny: number;
  readonly upraveny: number;
  readonly odoslany: number | null;
  readonly posudeny: number | null;
  /** Id karty v tvorcovi po prevzatí. */
  readonly kartaId: string | null;
  readonly skryty: boolean;
  /** Počet nahlásení — len pre správcu (inak 0). */
  readonly nahlaseni: number;
  /** Autor ešte nevidel posledné rozhodnutie. */
  readonly noveRozhodnutie: boolean;
}

export interface DetailNavrhu extends NavrhDielne {
  readonly komentare: readonly KomentarDielne[];
  readonly mojeNahlasenie: boolean;
}

/** Čo Dielňa potrebuje od zvyšku servera (tvorca kariet, roadmapa). */
export interface KontextDielne {
  readonly sada: () => Sada;
  /** Návrh karty v tvorcovi podľa id (null = neexistuje). */
  readonly kartaTvorcu: (id: string) => KartaNavrh | null;
  readonly ulozKartuTvorcu: (k: KartaNavrh) => void;
  readonly predvoleneRozmery: () => Pick<KartaNavrh, "sirkaMm" | "vyskaMm" | "mierkaTextu" | "mierkaIkon">;
  /** Je médium v knižnici (alebo ilustrácia karty) — iné obrázky Dielňa nepustí. */
  readonly jeObrazok: (id: string) => boolean;
  /** Položka do Prijímača roadmapy; vráti jej id. */
  readonly doRoadmapy: (ja: Pouzivatel, polozka: Record<string, unknown>, teraz: number) => number;
}

function text(v: unknown, max: number, pole: string, povinny = false): string {
  if (v !== undefined && v !== null && typeof v !== "string") throw new ChybaVstupu(`${pole}: musí byť text.`);
  const t = (typeof v === "string" ? v : "").replace(/\r\n/g, "\n").trim();
  if (povinny && t.length < 2) throw new ChybaVstupu(`${pole}: chýba.`);
  if (t.length > max) throw new ChybaVstupu(`${pole}: najviac ${max} znakov.`);
  return t;
}

/**
 * Strana z editora Dielne: na každej zo 4 pozícií jedna akcia alebo nič. Do
 * tvorcu sa prevedie bez straty — obsadená pozícia smie držať len svoju
 * akciu, prázdna je blokovaná (karta má teda jedno rozloženie).
 */
export function stranaZPozicii(pozicie: readonly (string | null)[]): StranaNavrhu {
  const akcie: Record<string, number> = {};
  const povolene: Partial<Record<0 | 1 | 2 | 3, readonly string[]>> = {};
  const blokovane: (0 | 1 | 2 | 3)[] = [];
  for (const p of POZICIE) {
    const a = pozicie[p] ?? null;
    if (a === null) blokovane.push(p);
    else {
      akcie[a] = (akcie[a] ?? 0) + 1;
      povolene[p] = [a];
    }
  }
  return { blokovane, akcie, povolene };
}

/** Pozície strany pre editor: akcia na pozícii, ak je jednoznačná (strana z Dielne alebo jednoduchá karta). */
export function poziciZoStrany(s: StranaNavrhu): (string | null)[] {
  return POZICIE.map((p) => {
    const pov = s.povolene[p];
    return pov !== undefined && pov.length === 1 && !s.blokovane.includes(p) ? (pov[0] ?? null) : null;
  });
}

function overStranu(v: unknown, akcie: ReadonlySet<string>, pole: string): StranaNavrhu {
  if (!Array.isArray(v) || v.length !== 4) throw new ChybaVstupu(`${pole}: 4 pozície (akcia alebo null).`);
  const pozicie = v.map((a) => {
    if (a === null) return null;
    if (typeof a !== "string" || !akcie.has(a)) throw new ChybaVstupu(`${pole}: neznáma akcia „${String(a)}“. Novú akciu opíš v nápade na akciu.`);
    return a;
  });
  return stranaZPozicii(pozicie);
}

const prazdnyObsah = (): ObsahNavrhu => ({
  nazov: "",
  tagy: [],
  efekt: "",
  lava: stranaZPozicii([null, null, null, null]),
  prava: stranaZPozicii([null, null, null, null]),
  obrazok: null,
  popisIlustracie: "",
  novaAkcia: "",
  zdovodnenie: "",
});

/** Id karty v tvorcovi z názvu: malé písmená bez diakritiky, podčiarkovníky. */
export function idZNazvu(nazov: string, obsadene: (id: string) => boolean): string {
  const zaklad =
    nazov
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || "karta";
  if (!obsadene(zaklad)) return zaklad;
  for (let n = 2; ; n++) if (!obsadene(`${zaklad}_${n}`)) return `${zaklad}_${n}`;
}

const rovnakeStrany = (a: StranaNavrhu, b: StranaNavrhu): boolean =>
  JSON.stringify(poziciZoStrany(a)) === JSON.stringify(poziciZoStrany(b)) && JSON.stringify(a.akcie) === JSON.stringify(b.akcie);

export class Dielna {
  private readonly db: Db;
  private readonly prava: Prava;
  private readonly ctx: KontextDielne;

  constructor(db: Db, prava: Prava, ctx: KontextDielne) {
    this.db = db;
    this.prava = prava;
    this.ctx = ctx;
  }

  // ---------------------------------------------------------------------------
  // Overenie obsahu

  private overObsah(v: Record<string, unknown>, stary: ObsahNavrhu): ObsahNavrhu {
    const sada = this.ctx.sada();
    const akcie = new Set(sada.akcie.map((a) => a.kluc));
    const ma = (k: string): boolean => v[k] !== undefined;
    let tagy = stary.tagy;
    if (ma("tagy")) {
      const povolene = new Set([...sada.kategorie.map((k) => k.nazov), ...sada.karty.flatMap((k) => k.tagy)]);
      if (!Array.isArray(v.tagy) || v.tagy.length > MAX_TAGOV || v.tagy.some((t) => typeof t !== "string" || !povolene.has(t))) {
        throw new ChybaVstupu(`Tagy: najviac ${MAX_TAGOV} z tých, ktoré hra pozná.`);
      }
      tagy = [...new Set(v.tagy as string[])];
    }
    let obrazok = stary.obrazok;
    if (ma("obrazok")) {
      if (v.obrazok === null) obrazok = null;
      else if (typeof v.obrazok === "string" && this.ctx.jeObrazok(v.obrazok)) obrazok = v.obrazok;
      else throw new ChybaVstupu("Ilustráciu vyber z knižnice (vlastný obrázok Dielňa nepríjme).");
    }
    return {
      nazov: ma("nazov") ? text(v.nazov, 40, "Názov") : stary.nazov,
      tagy,
      efekt: ma("efekt") ? text(v.efekt, 300, "Efekt") : stary.efekt,
      lava: ma("lava") ? overStranu(v.lava, akcie, "Ľavá strana") : stary.lava,
      prava: ma("prava") ? overStranu(v.prava, akcie, "Pravá strana") : stary.prava,
      obrazok,
      popisIlustracie: ma("popisIlustracie") ? text(v.popisIlustracie, 400, "Popis ilustrácie") : stary.popisIlustracie,
      novaAkcia: ma("novaAkcia") ? text(v.novaAkcia, 600, "Nápad na akciu") : stary.novaAkcia,
      zdovodnenie: ma("zdovodnenie") ? text(v.zdovodnenie, 1000, "Prečo") : stary.zdovodnenie,
    };
  }

  /** Čo musí platiť pred odoslaním na hlasovanie (koncept smie byť nedorobený). */
  private chybyNaOdoslanie(o: ObsahNavrhu, typ: TypNavrhu, zaklad: KartaNavrh | null): string[] {
    const chyby: string[] = [];
    if (o.nazov.length < 2) chyby.push("Karta potrebuje názov.");
    if (o.tagy.length === 0) chyby.push("Vyber aspoň jeden tag (napr. Občan, Zviera, Nástroj).");
    const akcii = Object.keys(o.lava.akcie).length + Object.keys(o.prava.akcie).length;
    if (akcii === 0 && o.efekt === "") chyby.push("Karta bez akcií potrebuje aspoň efekt.");
    const karta = this.kartaZObsahu(o, "navrh", null);
    chyby.push(...chybyNavrhu(karta));
    if (o.efekt !== "") {
      const sada = this.ctx.sada();
      for (const p of kontrolaTextov([karta], { klucoveSlova: sada.klucoveSlova, akcie: sada.akcie })) {
        if (p.uroven === "chyba") chyby.push(`Efekt: ${p.text}`);
      }
    }
    if (typ === "uprava" && zaklad !== null) {
      const zmena =
        o.nazov !== zaklad.nazov ||
        o.efekt !== zaklad.efekt ||
        JSON.stringify(o.tagy) !== JSON.stringify(zaklad.tagy) ||
        !rovnakeStrany(o.lava, zaklad.lava) ||
        !rovnakeStrany(o.prava, zaklad.prava) ||
        o.novaAkcia !== "";
      if (!zmena) chyby.push("Úprava sa od karty v hre ničím nelíši.");
    }
    return chyby;
  }

  private kartaZObsahu(o: ObsahNavrhu, id: string, zaklad: KartaNavrh | null): KartaNavrh {
    const obrazok = o.obrazok === null ? null : zaklad?.obrazok?.plny === o.obrazok ? zaklad.obrazok : { plny: o.obrazok, nahlad: o.obrazok };
    return {
      ...(zaklad ?? { ...this.ctx.predvoleneRozmery(), farba: null, kopie: 1 }),
      id,
      nazov: o.nazov,
      tagy: o.tagy,
      efekt: o.efekt,
      obrazok,
      lava: o.lava,
      prava: o.prava,
      upravene: 0,
    } as KartaNavrh;
  }

  // ---------------------------------------------------------------------------
  // Čítanie

  private autor(r: Record<string, unknown>, pred: string): AutorDielne {
    return {
      id: Number(r[`${pred}id`]),
      meno: String(r[`${pred}meno`]),
      avatar: r[`${pred}avatar`] === null ? null : String(r[`${pred}avatar`]),
      rola: String(r[`${pred}rola`]),
      ai: Number(r[`${pred}ai`]) === 1,
      odznak: Number(r[`${pred}odznak`]) > 0,
    };
  }

  private static readonly SELECT = `
    SELECT n.*, u.id AS a_id, u.meno AS a_meno, u.avatar AS a_avatar, u.rola AS a_rola, u.ai AS a_ai,
      (SELECT COUNT(*) FROM dielna_navrhy x WHERE x.autor = n.autor AND x.stav = 'v_tvorcovi') AS a_odznak,
      (SELECT COUNT(*) FROM dielna_cigarety c JOIN pouzivatelia v ON v.id = c.pouzivatel WHERE c.navrh = n.id AND v.ai = 0) AS cigarety,
      (SELECT COUNT(*) FROM dielna_cigarety c WHERE c.navrh = n.id AND c.pouzivatel = ?) AS moja,
      (SELECT COUNT(*) FROM dielna_komentare k WHERE k.navrh = n.id) AS komentarov,
      (SELECT COUNT(*) FROM dielna_nahlasenia h WHERE h.navrh = n.id) AS nahlaseni
    FROM dielna_navrhy n JOIN pouzivatelia u ON u.id = n.autor`;

  private navrh(r: Record<string, unknown>, ja: Pouzivatel | null, teraz: number, vHre: ReadonlySet<string>): NavrhDielne {
    const stav = r.stav as StavDielne;
    const cigarety = Number(r.cigarety);
    const odoslany = r.odoslany === null ? null : Number(r.odoslany);
    const kartaId = r.karta_id === null ? null : String(r.karta_id);
    const zobrazeny: StavZobrazeny =
      stav === "v_tvorcovi" && kartaId !== null && vHre.has(kartaId)
        ? "v_hre"
        : stav === "hlasovanie" && cigarety === 0 && odoslany !== null && teraz - odoslany > ARCHIV_PO_MS
          ? "archiv"
          : stav;
    const posudeny = r.posudeny === null ? null : Number(r.posudeny);
    const jeAutor = ja !== null && ja.id === Number(r.autor);
    return {
      id: Number(r.id),
      typ: r.typ as TypNavrhu,
      zaklad: r.zaklad === null ? null : String(r.zaklad),
      zakladKarta: r.zaklad_karta === null ? null : (JSON.parse(String(r.zaklad_karta)) as KartaNavrh),
      autor: this.autor(r, "a_"),
      obsah: JSON.parse(String(r.data)) as ObsahNavrhu,
      stav: zobrazeny,
      dovod: String(r.dovod),
      cigarety,
      mojaCigareta: Number(r.moja) > 0,
      komentarov: Number(r.komentarov),
      vytvoreny: Number(r.vytvoreny),
      upraveny: Number(r.upraveny),
      odoslany,
      posudeny,
      kartaId,
      skryty: Number(r.skryty) === 1,
      nahlaseni: ja !== null && jeSpravca(ja.rola) ? Number(r.nahlaseni) : 0,
      noveRozhodnutie: jeAutor && posudeny !== null && (r.autor_videne === null || posudeny > Number(r.autor_videne)),
    };
  }

  private vHre(): Set<string> {
    return new Set(this.ctx.sada().karty.map((k) => k.id));
  }

  /** Smie `ja` návrh vidieť? Koncept len autor; skrytý autor a správca. */
  private vidi(r: Record<string, unknown>, ja: Pouzivatel | null): boolean {
    const autor = ja !== null && ja.id === Number(r.autor);
    if (r.stav === "koncept") return autor;
    if (Number(r.skryty) === 1) return autor || (ja !== null && jeSpravca(ja.rola));
    return true;
  }

  zoznam(ja: Pouzivatel | null, teraz: number): NavrhDielne[] {
    const vHre = this.vHre();
    const riadky = this.db.prepare(`${Dielna.SELECT} ORDER BY COALESCE(n.odoslany, n.vytvoreny) DESC, n.id DESC LIMIT 500`).all(ja?.id ?? 0) as Record<string, unknown>[];
    return riadky.filter((r) => this.vidi(r, ja)).map((r) => this.navrh(r, ja, teraz, vHre));
  }

  private riadok(id: number, ja: Pouzivatel | null): Record<string, unknown> {
    const r = this.db.prepare(`${Dielna.SELECT} WHERE n.id = ?`).get(ja?.id ?? 0, id) as Record<string, unknown> | undefined;
    // Neviditeľný návrh sa tvári ako neexistujúci — koncept neprezradí ani svoju existenciu.
    if (r === undefined || !this.vidi(r, ja)) throw new ChybaVstupu("Taký návrh v Dielni nie je.", 404);
    return r;
  }

  detail(ja: Pouzivatel | null, id: number, teraz: number): DetailNavrhu {
    const r = this.riadok(id, ja);
    const komentare = (
      this.db
        .prepare(
          `SELECT k.id, k.text, k.vytvoreny, u.id AS a_id, u.meno AS a_meno, u.avatar AS a_avatar, u.rola AS a_rola, u.ai AS a_ai,
             (SELECT COUNT(*) FROM dielna_navrhy x WHERE x.autor = k.autor AND x.stav = 'v_tvorcovi') AS a_odznak
           FROM dielna_komentare k JOIN pouzivatelia u ON u.id = k.autor WHERE k.navrh = ? ORDER BY k.id`,
        )
        .all(id) as Record<string, unknown>[]
    ).map((k) => ({ id: Number(k.id), autor: this.autor(k, "a_"), text: String(k.text), vytvoreny: Number(k.vytvoreny) }));
    const mojeNahlasenie = ja !== null && this.db.prepare("SELECT 1 FROM dielna_nahlasenia WHERE navrh = ? AND pouzivatel = ?").get(id, ja.id) !== undefined;
    return { ...this.navrh(r, ja, teraz, this.vHre()), komentare, mojeNahlasenie };
  }

  /** Koľko rozhodnutí o návrhoch `ja` ešte nevidel — značka pri Kartách a v Dielni. */
  noveRozhodnutia(ja: Pouzivatel): number {
    return (
      this.db
        .prepare("SELECT COUNT(*) AS n FROM dielna_navrhy WHERE autor = ? AND posudeny IS NOT NULL AND (autor_videne IS NULL OR posudeny > autor_videne)")
        .get(ja.id) as { n: number }
    ).n;
  }

  /** Autor otvoril svoj návrh — rozhodnutie o ňom už videl. */
  videl(ja: Pouzivatel, id: number, teraz: number): void {
    this.db.prepare("UPDATE dielna_navrhy SET autor_videne = ? WHERE id = ? AND autor = ?").run(teraz, id, ja.id);
  }

  /**
   * Autori kariet v hre z Dielne pre glosár: „prerobena“ = karta v sade sa od
   * prevzatého návrhu líši (názov, efekt alebo akcie) — vtedy „nápad: X“.
   */
  autoriKariet(): Record<string, { readonly meno: string; readonly prerobena: boolean; readonly navrh: number }> {
    const sada = new Map(this.ctx.sada().karty.map((k) => [k.id, k]));
    const out: Record<string, { meno: string; prerobena: boolean; navrh: number }> = {};
    const riadky = this.db
      .prepare("SELECT n.id, n.karta_id, n.prevzate, u.meno FROM dielna_navrhy n JOIN pouzivatelia u ON u.id = n.autor WHERE n.stav = 'v_tvorcovi' AND n.karta_id IS NOT NULL ORDER BY n.id")
      .all() as { id: number; karta_id: string; prevzate: string | null; meno: string }[];
    for (const r of riadky) {
      const k = sada.get(r.karta_id);
      if (k === undefined || r.prevzate === null) continue;
      const p = JSON.parse(r.prevzate) as ObsahNavrhu;
      const prerobena = k.nazov !== p.nazov || k.efekt !== p.efekt || !rovnakeStrany(k.lava, p.lava) || !rovnakeStrany(k.prava, p.prava);
      out[r.karta_id] = { meno: r.meno, prerobena, navrh: Number(r.id) };
    }
    return out;
  }

  // ---------------------------------------------------------------------------
  // Autor: koncept, úpravy, odoslanie

  private otvorene(autor: number, okrem: number | null): number {
    return (
      this.db
        .prepare("SELECT COUNT(*) AS n FROM dielna_navrhy WHERE autor = ? AND stav IN ('koncept', 'hlasovanie', 'vratene') AND id <> ?")
        .get(autor, okrem ?? -1) as { n: number }
    ).n;
  }

  vytvor(ja: Pouzivatel, telo: Record<string, unknown>, teraz: number): number {
    this.prava.vyzaduj(ja, "navrhovat_karty");
    if (this.otvorene(ja.id, null) >= MAX_OTVORENYCH) {
      throw new ChybaVstupu(`Naraz smieš mať najviac ${MAX_OTVORENYCH} otvorené návrhy. Dokonči alebo zmaž niektorý.`);
    }
    let typ: TypNavrhu = "nova";
    let zaklad: KartaNavrh | null = null;
    let zakladny = prazdnyObsah();
    if (telo.zaklad !== undefined && telo.zaklad !== null) {
      zaklad = this.ctx.sada().karty.find((k) => k.id === telo.zaklad) ?? null;
      if (zaklad === null) throw new ChybaVstupu("Upravovať sa dá len karta, ktorá je v hre.");
      typ = "uprava";
      zakladny = {
        ...zakladny,
        nazov: zaklad.nazov,
        tagy: zaklad.tagy,
        efekt: zaklad.efekt,
        // Strany ostanú, ako sú (aj s viacerými rozloženiami); pevné pozície
        // dostanú, až keď ich autor v editore zmení.
        lava: zaklad.lava,
        prava: zaklad.prava,
        obrazok: zaklad.obrazok?.plny ?? null,
      };
    }
    const obsah = this.overObsah(telo, zakladny);
    const r = this.db
      .prepare(
        `INSERT INTO dielna_navrhy (autor, typ, zaklad, zaklad_karta, data, stav, vytvoreny, upraveny)
         VALUES (?, ?, ?, ?, ?, 'koncept', ?, ?) RETURNING id`,
      )
      .get(ja.id, typ, zaklad?.id ?? null, zaklad === null ? null : JSON.stringify(zaklad), JSON.stringify(obsah), teraz, teraz) as { id: number };
    return Number(r.id);
  }

  private mojRiadok(ja: Pouzivatel, id: number): Record<string, unknown> {
    const r = this.riadok(id, ja);
    if (Number(r.autor) !== ja.id) throw new ChybaVstupu("Upravovať môžeš len svoj návrh.", 403);
    return r;
  }

  /** Úprava smie aj počas hlasovania — cigarety ostanú. Prevzatý návrh sa už nemení. */
  uprav(ja: Pouzivatel, id: number, telo: Record<string, unknown>, teraz: number): void {
    this.prava.vyzaduj(ja, "navrhovat_karty");
    const r = this.mojRiadok(ja, id);
    if (r.stav === "v_tvorcovi") throw new ChybaVstupu("Návrh je už v tvorcovi kariet — ďalšie zmeny navrhni ako úpravu karty.");
    const obsah = this.overObsah(telo, JSON.parse(String(r.data)) as ObsahNavrhu);
    this.db.prepare("UPDATE dielna_navrhy SET data = ?, upraveny = ? WHERE id = ?").run(JSON.stringify(obsah), teraz, id);
  }

  /** Koncept, vrátený či zamietnutý návrh ide (znova) na hlasovanie. */
  odosli(ja: Pouzivatel, id: number, teraz: number): void {
    this.prava.vyzaduj(ja, "navrhovat_karty");
    const r = this.mojRiadok(ja, id);
    if (!["koncept", "vratene", "zamietnute"].includes(String(r.stav))) throw new ChybaVstupu("Tento návrh už hlasovaním prechádza alebo je v tvorcovi.");
    if (r.stav === "zamietnute" && this.otvorene(ja.id, id) >= MAX_OTVORENYCH) {
      throw new ChybaVstupu(`Naraz smieš mať najviac ${MAX_OTVORENYCH} otvorené návrhy.`);
    }
    const zaklad = r.zaklad_karta === null ? null : (JSON.parse(String(r.zaklad_karta)) as KartaNavrh);
    const chyby = this.chybyNaOdoslanie(JSON.parse(String(r.data)) as ObsahNavrhu, r.typ as TypNavrhu, zaklad);
    if (chyby.length > 0) throw new ChybaVstupu(chyby.join(" "));
    this.db.prepare("UPDATE dielna_navrhy SET stav = 'hlasovanie', odoslany = ?, upraveny = ? WHERE id = ?").run(teraz, teraz, id);
  }

  zmaz(ja: Pouzivatel, id: number): void {
    const r = this.riadok(id, ja);
    const autor = Number(r.autor) === ja.id;
    if (!autor && !jeSpravca(ja.rola)) throw new ChybaVstupu("Zmazať môžeš len svoj návrh.", 403);
    if (r.stav === "v_tvorcovi") throw new ChybaVstupu("Prevzatý návrh sa nemaže — je z neho karta v tvorcovi.");
    this.db.prepare("DELETE FROM dielna_navrhy WHERE id = ?").run(id);
  }

  // ---------------------------------------------------------------------------
  // Ostatní: cigarety, komentáre, nahlásenie

  /** 1 hráč = 1 cigareta; vlastnému nie. AI smie, ale do súčtu sa neráta. */
  cigareta(ja: Pouzivatel, id: number, dat: boolean, teraz: number): number {
    this.prava.vyzaduj(ja, "navrhovat_karty");
    const r = this.riadok(id, ja);
    if (Number(r.autor) === ja.id) throw new ChybaVstupu("Vlastnému návrhu cigaretu nedáš.");
    if (dat && !["hlasovanie", "vratene"].includes(String(r.stav))) throw new ChybaVstupu("Hlasuje sa len o návrhoch v hlasovaní.");
    if (dat) this.db.prepare("INSERT OR IGNORE INTO dielna_cigarety (navrh, pouzivatel, cas) VALUES (?, ?, ?)").run(id, ja.id, teraz);
    else this.db.prepare("DELETE FROM dielna_cigarety WHERE navrh = ? AND pouzivatel = ?").run(id, ja.id);
    return (
      this.db
        .prepare("SELECT COUNT(*) AS n FROM dielna_cigarety c JOIN pouzivatelia v ON v.id = c.pouzivatel WHERE c.navrh = ? AND v.ai = 0")
        .get(id) as { n: number }
    ).n;
  }

  komentuj(ja: Pouzivatel, id: number, telo: unknown, teraz: number): number {
    this.prava.vyzaduj(ja, "navrhovat_karty");
    this.riadok(id, ja);
    const t = text(telo, 1000, "Komentár");
    if (t.length < 3) throw new ChybaVstupu("Komentár: napíš aspoň pár slov.");
    const { n } = this.db.prepare("SELECT COUNT(*) AS n FROM dielna_komentare WHERE autor = ? AND vytvoreny > ?").get(ja.id, teraz - OKNO_MS) as { n: number };
    if (n >= LIMIT_KOMENTAROV) throw new ChybaVstupu("Píšeš príliš rýchlo. Daj si poldeci a skús to o chvíľu.", 429);
    const r = this.db.prepare("INSERT INTO dielna_komentare (navrh, autor, text, vytvoreny) VALUES (?, ?, ?, ?) RETURNING id").get(id, ja.id, t, teraz) as { id: number };
    return Number(r.id);
  }

  zmazKomentar(ja: Pouzivatel, komentar: number): void {
    const r = this.db.prepare("SELECT autor FROM dielna_komentare WHERE id = ?").get(komentar) as { autor: number } | undefined;
    if (r === undefined) throw new ChybaVstupu("Taký komentár nie je.", 404);
    if (r.autor !== ja.id && !jeSpravca(ja.rola)) throw new ChybaVstupu("Zmazať môžeš len svoj komentár.", 403);
    this.db.prepare("DELETE FROM dielna_komentare WHERE id = ?").run(komentar);
  }

  /** Nahlásiť smie každý prihlásený (napr. karta o skutočnom človeku); raz. */
  nahlas(ja: Pouzivatel, id: number, dovod: unknown, teraz: number): void {
    this.riadok(id, ja);
    const t = text(dovod, 500, "Dôvod nahlásenia");
    if (t.length < 3) throw new ChybaVstupu("Napíš, čo je na návrhu zlé.");
    this.db.prepare("INSERT OR IGNORE INTO dielna_nahlasenia (navrh, pouzivatel, dovod, cas) VALUES (?, ?, ?, ?)").run(id, ja.id, t, teraz);
  }

  nahlasenia(ja: Pouzivatel, id: number): { meno: string; dovod: string; cas: number }[] {
    if (!jeSpravca(ja.rola)) throw new ChybaVstupu("Nahlásenia vidí len admin a subadmin.", 403);
    return this.db
      .prepare("SELECT u.meno, h.dovod, h.cas FROM dielna_nahlasenia h JOIN pouzivatelia u ON u.id = h.pouzivatel WHERE h.navrh = ? ORDER BY h.cas")
      .all(id) as { meno: string; dovod: string; cas: number }[];
  }

  // ---------------------------------------------------------------------------
  // Správca: skrytie a posudok

  skry(ja: Pouzivatel, id: number, skryty: boolean): void {
    if (!jeSpravca(ja.rola)) throw new ChybaVstupu("Skrývať návrhy smie len admin a subadmin.", 403);
    this.riadok(id, ja);
    this.db.prepare("UPDATE dielna_navrhy SET skryty = ? WHERE id = ?").run(skryty ? 1 : 0, id);
  }

  /**
   * Schváliť (prevziať do tvorcu), vrátiť na úpravu alebo zamietnuť — dôvod je
   * povinný pri vrátení a zamietnutí. Schválenie založí alebo upraví návrh
   * karty v tvorcovi a pri novom efekte položku v Prijímači roadmapy.
   */
  posud(ja: Pouzivatel, id: number, telo: Record<string, unknown>, teraz: number): { kartaId: string | null; roadmapa: number | null } {
    if (!jeSpravca(ja.rola)) throw new ChybaVstupu("Návrhy posudzuje len admin alebo subadmin.", 403);
    const r = this.riadok(id, ja);
    const rozhodnutie = telo.rozhodnutie;
    if (rozhodnutie !== "schvalit" && rozhodnutie !== "vratit" && rozhodnutie !== "zamietnut") throw new ChybaVstupu("Rozhodnutie: schvalit | vratit | zamietnut.");
    if (!["hlasovanie", "vratene"].includes(String(r.stav))) throw new ChybaVstupu("Posudzuje sa len návrh v hlasovaní alebo vrátený na úpravu.");
    const dovod = text(telo.dovod, 1000, "Dôvod");
    if (rozhodnutie !== "schvalit" && dovod.length < 3) throw new ChybaVstupu("Pri vrátení a zamietnutí napíš autorovi dôvod.");

    if (rozhodnutie !== "schvalit") {
      this.db
        .prepare("UPDATE dielna_navrhy SET stav = ?, dovod = ?, posudeny = ?, posudil = ? WHERE id = ?")
        .run(rozhodnutie === "vratit" ? "vratene" : "zamietnute", dovod, teraz, ja.id, id);
      return { kartaId: null, roadmapa: null };
    }

    const obsah = JSON.parse(String(r.data)) as ObsahNavrhu;
    const typ = r.typ as TypNavrhu;
    const zakladKarta = r.zaklad_karta === null ? null : (JSON.parse(String(r.zaklad_karta)) as KartaNavrh);
    const chyby = this.chybyNaOdoslanie(obsah, typ, zakladKarta);
    if (chyby.length > 0) throw new ChybaVstupu(`Návrh sa nedá prevziať: ${chyby.join(" ")}`);

    // Úprava sa premietne do návrhu tej istej karty v tvorcovi (aj s tým, čo
    // tam medzitým zmenil admin — rozmery, farba, kópie ostanú); nová karta
    // dostane voľné id z názvu.
    const stara = typ === "uprava" && r.zaklad !== null ? this.ctx.kartaTvorcu(String(r.zaklad)) : null;
    if (typ === "uprava" && stara === null) throw new ChybaVstupu("Upravovaná karta už v tvorcovi nie je.");
    const kartaId = stara?.id ?? idZNazvu(obsah.nazov, (x) => this.ctx.kartaTvorcu(x) !== null);
    const karta = { ...this.kartaZObsahu(obsah, kartaId, stara), upravene: teraz };
    this.ctx.ulozKartuTvorcu(karta);

    let roadmapa: number | null = null;
    const novyEfekt = obsah.efekt !== "" && (typ === "nova" || obsah.efekt !== zakladKarta?.efekt);
    if (novyEfekt || obsah.novaAkcia !== "") {
      const autor = String(r.a_meno);
      roadmapa = this.ctx.doRoadmapy(
        ja,
        {
          nazov: `Naprogramovať: ${obsah.nazov}`.slice(0, 120),
          kratko: (novyEfekt ? `Efekt: ${obsah.efekt}` : `Nová akcia: ${obsah.novaAkcia}`).slice(0, 300),
          preco: [
            `Návrh z Dielne #${id} (autor ${autor}) prevzatý do tvorcu ako karta ${kartaId}.`,
            obsah.novaAkcia !== "" ? `Nápad na akciu: ${obsah.novaAkcia}` : "",
            obsah.popisIlustracie !== "" ? `Ilustrácia (zadanie pre Leonardo): ${obsah.popisIlustracie}` : "",
          ]
            .filter((x) => x !== "")
            .join("\n"),
          hotovo: "Efekt karty vyhodnocuje jadro (nie manual) a karta je zverejnená v sade.",
          oblast: "karty",
          narocnost: "M",
          stav: "napad",
          zdroj: { typ: "napad", text: `Dielňa #${id}`, odkaz: `/karty/dielna/${id}` },
          stlpec: "prijimac",
        },
        teraz,
      );
    }
    this.db
      .prepare("UPDATE dielna_navrhy SET stav = 'v_tvorcovi', dovod = ?, posudeny = ?, posudil = ?, karta_id = ?, prevzate = ? WHERE id = ?")
      .run(dovod, teraz, ja.id, kartaId, JSON.stringify(obsah), id);
    return { kartaId, roadmapa };
  }
}

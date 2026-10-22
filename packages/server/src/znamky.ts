// Známky hry podľa 12 kritérií playtestu (Michal 2026-10-21).
//
// Hodnotia hráči na stránke Spätná väzba aj AI playtesteri po partii — tými
// istými kritériami (tools/playtest/kriteria.md). Hráč známky kedykoľvek zmení;
// každá zmena je nový riadok, takže priemer „k dátumu“ sa dá spočítať spätne
// z posledných známok každého hodnotiteľa platných v ten deň.
//
// Von ide len priemer. Kým skupinu ľudí tvoria menej ako MIN_LUDI hodnotitelia,
// priemer ľudí (ani spoločný, z ktorého by sa dal dopočítať) sa neposiela —
// inak by priemer prezradil známky konkrétneho hráča.

import type { Db } from "./db.ts";
import type { Pouzivatel } from "./auth.ts";
import { ChybaVstupu, jeSpravca } from "./auth.ts";
import { Prava } from "./prava.ts";

export interface Kriterium {
  readonly kluc: string;
  readonly nazov: string;
  readonly otazka: string;
}

export const KRITERIA: readonly Kriterium[] = [
  { kluc: "zabava", nazov: "Zábava", otazka: "Bavil som sa? Chcel by som hrať znova hneď teraz?" },
  { kluc: "rozhodnutia", nazov: "Zmysluplné rozhodnutia", otazka: "Mali moje voľby skutočné dôsledky? Bolo viac rozumných možností, alebo len jedna zjavná?" },
  { kluc: "rovnovaha", nazov: "Rovnováha a férovosť", otazka: "Mali obaja hráči rovnakú šancu? Nie je niektorá stratégia, karta alebo pozícia zjavne silnejšia?" },
  { kluc: "nahoda", nazov: "Náhoda vs. zručnosť", otazka: "Rozhodla partiu skôr šikovnosť, alebo ťahanie kariet? Je pomer primeraný?" },
  { kluc: "interakcia", nazov: "Interakcia hráčov", otazka: "Reagoval som na súpera? Mohol som mu skrížiť plány, alebo hral každý sám pre seba?" },
  { kluc: "tempo", nazov: "Tempo a prestoje", otazka: "Plynula hra, alebo som dlho čakal? Mala partia správnu dĺžku?" },
  { kluc: "zrozumitelnost", nazov: "Zrozumiteľnosť pravidiel", otazka: "Rozumel som, čo smiem a prečo sa niečo stalo?" },
  { kluc: "hlbka", nazov: "Hĺbka vs. zložitosť", otazka: "Je strategická hĺbka úmerná množstvu pravidiel?" },
  { kluc: "znovuhratelnost", nazov: "Znovuhrateľnosť", otazka: "Bude ďalšia partia iná? Je viac ciest k víťazstvu?" },
  { kluc: "tema", nazov: "Téma a prepojenie", otazka: "Sedí dedinská krčmová téma na to, čo sa v hre deje?" },
  { kluc: "napatie", nazov: "Napätie a priebeh", otazka: "Bola partia napínavá až do konca? Dal sa stratený stav ešte otočiť?" },
  { kluc: "originalita", nazov: "Originalita", otazka: "Prináša hra niečo, čo inde nie je?" },
];

const KLUCE = new Set(KRITERIA.map((k) => k.kluc));

/** Od koľkých ľudí sa ukáže ich priemer (Michal 2026-10-21). */
export const MIN_LUDI = 3;

/** Opakované uloženie v tomto okne prepíše posledný záznam — ladenie posuvníkov nie je zmena názoru. */
const OKNO_UPRAVY_MS = 10 * 60 * 1000;

/** Najstarší čas, ktorý smie mať importovaný záznam (prvý playtest bol 11. 10. 2026). */
const NAJSKOR = Date.UTC(2026, 0, 1);

const ZDROJ_RE = /^[\w.-]{1,60}$/;

export type Znamky = Readonly<Record<string, number>>;

export interface Hodnota {
  readonly priemer: number | null;
  /** Koľko hodnotiteľov dalo známku (pri ľuďoch aj vtedy, keď priemer skrývame). */
  readonly n: number;
}

export interface Skupina {
  /** Priemer cez hodnotiteľov z priemeru ich vlastných známok. */
  readonly celkom: Hodnota;
  readonly kriteria: Readonly<Record<string, Hodnota>>;
}

export interface BodVyvoja {
  /** Deň v tvare RRRR-MM-DD (Bratislava) — stav po poslednej zmene v ten deň. */
  readonly den: string;
  readonly ludia: Skupina;
  readonly ai: Skupina;
  readonly spolu: Skupina;
}

export interface Vyvoj {
  readonly kriteria: readonly Kriterium[];
  readonly minLudi: number;
  readonly body: readonly BodVyvoja[];
}

const denFormat = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Bratislava" });
export const denZ = (cas: number): string => denFormat.format(cas);

export function overZnamky(v: unknown): Znamky {
  if (typeof v !== "object" || v === null || Array.isArray(v)) throw new ChybaVstupu("Známky: očakávam objekt {kritérium: 1–10}.");
  const out: Record<string, number> = {};
  for (const [k, z] of Object.entries(v)) {
    if (!KLUCE.has(k)) throw new ChybaVstupu(`Neznáme kritérium „${k}“.`);
    if (z === null) continue;
    if (typeof z !== "number" || !Number.isInteger(z) || z < 1 || z > 10) throw new ChybaVstupu(`${k}: známka je celé číslo 1 až 10.`);
    out[k] = z;
  }
  return out;
}

const zaokruhli = (x: number): number => Math.round(x * 100) / 100;

interface Hodnotitel {
  readonly ai: boolean;
  readonly znamky: Znamky;
}

function skupina(hodnotitelia: readonly Hodnotitel[], skryt: (kluc: string | null, n: number) => boolean): Skupina {
  const kriteria: Record<string, Hodnota> = {};
  for (const { kluc } of KRITERIA) {
    const hodnoty = hodnotitelia.map((h) => h.znamky[kluc]).filter((z): z is number => z !== undefined);
    const n = hodnoty.length;
    kriteria[kluc] = { priemer: n === 0 || skryt(kluc, n) ? null : zaokruhli(hodnoty.reduce((a, b) => a + b, 0) / n), n };
  }
  const vlastne = hodnotitelia
    .map((h) => Object.values(h.znamky))
    .filter((z) => z.length > 0)
    .map((z) => z.reduce((a, b) => a + b, 0) / z.length);
  const n = vlastne.length;
  return { celkom: { priemer: n === 0 || skryt(null, n) ? null : zaokruhli(vlastne.reduce((a, b) => a + b, 0) / n), n }, kriteria };
}

const malo = (n: number): boolean => n > 0 && n < MIN_LUDI;

/** Priemery ľudí, AI a spolu pre jeden okamih — skrýva ľudí pod MIN_LUDI. */
export function priemery(hodnotitelia: readonly Hodnotitel[]): Omit<BodVyvoja, "den"> {
  const ludia = hodnotitelia.filter((h) => !h.ai);
  const ludiaSkupina = skupina(ludia, (_, n) => malo(n));
  // Spoločný priemer by spolu s priemerom AI prezradil priemer ľudí — skryje sa tam, kde ten ľudský.
  const spolu = skupina(hodnotitelia, (kluc) => malo(kluc === null ? ludiaSkupina.celkom.n : (ludiaSkupina.kriteria[kluc]?.n ?? 0)));
  return { ludia: ludiaSkupina, ai: skupina(hodnotitelia.filter((h) => h.ai), () => false), spolu };
}

export class Hodnotenia {
  private readonly db: Db;

  /** Kto smie hodnotiť — matica práv rankov (Michal 2026-10-22); AI agent vždy. */
  private readonly prava: Prava;

  constructor(db: Db, prava: Prava = new Prava(db)) {
    this.prava = prava;
    this.db = db;
  }

  /** Hodnotiť smie rank s právom hodnotit_hru, správca a AI agent. */
  smie(ja: Pouzivatel): boolean {
    return this.prava.smie(ja, "hodnotit_hru");
  }

  /** Posledné známky hráča (bez importovaných z playtestov). */
  moje(ja: Pouzivatel): { znamky: Znamky | null; cas: number | null; smie: boolean } {
    const r = this.db.prepare("SELECT data, cas FROM znamky WHERE pouzivatel = ? ORDER BY cas DESC, id DESC LIMIT 1").get(ja.id) as
      | { data: string; cas: number }
      | undefined;
    return { znamky: r === undefined ? null : (JSON.parse(r.data) as Znamky), cas: r?.cas ?? null, smie: this.smie(ja) };
  }

  /**
   * Uloží známky. Prázdny objekt = hráč svoje hodnotenie stiahol (od tej chvíle
   * sa do priemeru neráta). `zdroj` a `cas` smie poslať len AI agent alebo
   * správca — import známok z playtestu s časom partie.
   */
  uloz(ja: Pouzivatel, telo: Record<string, unknown>, teraz: number): { cas: number } {
    if (!this.smie(ja)) throw new ChybaVstupu("Na hodnotenie hry tvoj rank nemá právo.", 403);
    const znamky = overZnamky(telo.znamky);
    const importuje = telo.zdroj !== undefined || telo.cas !== undefined;
    if (importuje && !ja.ai && !jeSpravca(ja.rola)) throw new ChybaVstupu("Zdroj a čas hodnotenia posiela len AI agent.", 403);
    const zdroj = telo.zdroj === undefined ? "" : String(telo.zdroj);
    if (zdroj !== "" && !ZDROJ_RE.test(zdroj)) throw new ChybaVstupu("Zdroj: id playtestu (písmená, číslice, - . _).");
    let cas = teraz;
    if (telo.cas !== undefined) {
      if (typeof telo.cas !== "number" || !Number.isInteger(telo.cas) || telo.cas < NAJSKOR || telo.cas > teraz) throw new ChybaVstupu("Čas hodnotenia: ms od 1970, nie v budúcnosti.");
      cas = telo.cas;
    }
    const data = JSON.stringify(znamky);

    if (zdroj !== "") {
      // Opätovný import toho istého playtestu záznam prepíše, neduplikuje.
      this.db
        .prepare(`INSERT INTO znamky (pouzivatel, cas, data, zdroj) VALUES (?, ?, ?, ?)
                  ON CONFLICT(pouzivatel, zdroj) WHERE zdroj <> '' DO UPDATE SET cas = excluded.cas, data = excluded.data`)
        .run(ja.id, cas, data, zdroj);
      return { cas };
    }
    const posledny = this.db.prepare("SELECT id, cas, zdroj FROM znamky WHERE pouzivatel = ? ORDER BY cas DESC, id DESC LIMIT 1").get(ja.id) as
      | { id: number; cas: number; zdroj: string }
      | undefined;
    if (posledny !== undefined && posledny.zdroj === "" && cas === teraz && teraz - posledny.cas < OKNO_UPRAVY_MS) {
      this.db.prepare("UPDATE znamky SET cas = ?, data = ? WHERE id = ?").run(cas, data, posledny.id);
    } else {
      this.db.prepare("INSERT INTO znamky (pouzivatel, cas, data) VALUES (?, ?, ?)").run(ja.id, cas, data);
    }
    return { cas };
  }

  /** Časová os priemerov: jeden bod za každý deň, v ktorý sa niečie hodnotenie zmenilo. */
  vyvoj(): Vyvoj {
    const riadky = this.db
      .prepare(
        `SELECT z.pouzivatel, z.cas, z.data, u.ai FROM znamky z JOIN pouzivatelia u ON u.id = z.pouzivatel
         ORDER BY z.cas, z.id`,
      )
      .all() as { pouzivatel: number; cas: number; data: string; ai: number }[];
    const aktualne = new Map<number, Hodnotitel>();
    const body: BodVyvoja[] = [];
    for (let i = 0; i < riadky.length; i++) {
      const r = riadky[i]!;
      aktualne.set(r.pouzivatel, { ai: Number(r.ai) === 1, znamky: JSON.parse(r.data) as Znamky });
      const den = denZ(r.cas);
      const dalsi = riadky[i + 1];
      if (dalsi !== undefined && denZ(dalsi.cas) === den) continue;
      body.push({ den, ...priemery([...aktualne.values()]) });
    }
    return { kriteria: KRITERIA, minLudi: MIN_LUDI, body };
  }
}

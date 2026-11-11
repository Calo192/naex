// Slovník pravidiel (osnova Navrhára 2026-10-24, schválil Michal): jediný zdroj
// pre vysvetlenie pojmu pod myšou v texte aj pre slovník na konci stránky.
// Každý pojem jednou vetou, podľa toho, čo hra naozaj robí (tools/playtest/tahak.md).
// Texty sú v i18n/pojmy/sk.json (lokalizácia 3c), preklad sa načíta až pri inom jazyku.

import zdroj from "../../i18n/pojmy/sk.json";
import type { ZdrojDlhych } from "../../i18n/dlhe.ts";
import { textOblasti } from "../../i18n/jazyk.tsx";

export interface PojemSlovnika {
  /** Kotva v slovníku (#pojem-<id>) a kľúč v texte (<Pojem k="…">). */
  readonly id: string;
  readonly pojem: string;
  readonly popis: string;
}

const ZDROJ: ZdrojDlhych = zdroj as unknown as ZdrojDlhych;

/** Text pojmu v jazyku hráča (i18n/pojmy, lenivo načítaný preklad). */
const textPojmu = (id: string, pole: string): string => textOblasti("pojmy", id, pole, ZDROJ[id]?.[pole] ?? "");

/** Pojem a popis sú gettery — čítajú sa v jazyku hráča pri vykreslení. */
export const SLOVNIK: readonly PojemSlovnika[] = Object.keys(ZDROJ)
  .filter((id) => !id.startsWith("_"))
  .map((id) => ({
    id,
    get pojem() {
      return textPojmu(id, "pojem");
    },
    get popis() {
      return textPojmu(id, "popis");
    },
  }));

const PODLA_ID: ReadonlyMap<string, PojemSlovnika> = new Map(SLOVNIK.map((p) => [p.id, p]));

export function pojemSlovnika(id: string): PojemSlovnika | null {
  return PODLA_ID.get(id) ?? null;
}

/**
 * Jadro pojmov (docs/napady/prvy-dojem-navstevnika.html, časť 9; Michal 2026-11-10: „Pojmy
 * ako Pitka, bitka a podobne treba domyselne vysvetliť.“): v bubline Melichara a v nápovedách
 * je ich prvý výskyt podčiarknutý a pod myšou (na telefóne ťukom) ukáže krátku vetu pre nováčika.
 * Slovník vyššie ostáva presný pre stránku Pravidlá; tvary sú slová, ako ich píše Melichar.
 */
export interface PojemJadra {
  /** Id v SLOVNIK — nadpis bubliny a odkaz na celé vysvetlenie. */
  readonly id: string;
  readonly kratko: string;
  readonly tvary: readonly string[];
}

/** Poradie pojmov jadra; kratko a tvary sú v i18n/pojmy/sk.json pri pojme. */
const ID_JADRA = ["spak", "bitka", "lokalita", "akcia", "udery", "senok", "cigareta", "zhromazdenie", "linia", "poldeci", "spoj", "pitka", "naex", "starsi", "strach"] as const;

export const JADRO_POJMOV: readonly PojemJadra[] = ID_JADRA.map((id) => ({
  id,
  get kratko() {
    return textPojmu(id, "kratko");
  },
  get tvary() {
    return textPojmu(id, "tvary")
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t !== "");
  },
}));

const vzory = new Map<string, RegExp>();

/** Vzor tvarov pojmu v jazyku hráča — preklad má vlastné tvary. */
function vzorPojmu(p: PojemJadra): RegExp {
  // Bez tvarov (preklad ich ešte nemá) by prázdny vzor sedel na každý text.
  if (p.tvary.length === 0) return /(?!)/u;
  const zdroj = String.raw`(?<!\p{L})(?:${p.tvary.join("|")})(?!\p{L})`;
  let re = vzory.get(zdroj);
  if (re === undefined) {
    re = new RegExp(zdroj, "iu");
    vzory.set(zdroj, re);
  }
  return re;
}

/** Ktoré pojmy jadra majú v ktorom texte prvý výskyt — každý pojem sa podčiarkne raz za bublinu. */
export function prvePojmy(texty: readonly string[], uzVidene: ReadonlySet<string> = new Set()): ReadonlySet<string>[] {
  const videne = new Set(uzVidene);
  return texty.map((t) => {
    const tu = new Set<string>();
    for (const p of JADRO_POJMOV) {
      if (videne.has(p.id) || !vzorPojmu(p).test(t)) continue;
      tu.add(p.id);
      videne.add(p.id);
    }
    return tu;
  });
}

export interface KusSPojmom {
  readonly text: string;
  /** Id pojmu jadra, keď je kus jeho slovom v texte. */
  readonly pojem?: string;
}

/** Text na kúsky, v ktorých je prvý výskyt každého pojmu z `pojmy` samostatným kusom. */
export function castiSPojmami(text: string, pojmy: ReadonlySet<string>): KusSPojmom[] {
  const nalezy: { readonly od: number; readonly do: number; readonly id: string }[] = [];
  for (const id of pojmy) {
    const p = pojemJadra(id);
    const m = p === null ? null : vzorPojmu(p).exec(text);
    if (m !== null && m !== undefined) nalezy.push({ od: m.index, do: m.index + m[0].length, id });
  }
  nalezy.sort((a, b) => a.od - b.od);
  const out: KusSPojmom[] = [];
  let i = 0;
  for (const n of nalezy) {
    if (n.od < i) continue;
    if (n.od > i) out.push({ text: text.slice(i, n.od) });
    out.push({ text: text.slice(n.od, n.do), pojem: n.id });
    i = n.do;
  }
  if (i < text.length) out.push({ text: text.slice(i) });
  return out;
}

export function pojemJadra(id: string): PojemJadra | null {
  return JADRO_POJMOV.find((p) => p.id === id) ?? null;
}

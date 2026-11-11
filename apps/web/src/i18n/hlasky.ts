// Hlášky motora a servera v jazyku hráča (lokalizácia, Michal 2026-11-10). Jadro a server píšu
// po slovensky voľným textom a na preklady sa nemenia (jadro bez I/O, hlášky sú aj v testoch a logoch).
// Klient preto pozná vzory: kľúče motor.* a server.* v sk.json sú slovenské vety s {parametrami};
// keď hláška celá sedí na vzor, ukáže sa preklad toho kľúča s dosadenými časťami. Hláška bez vzoru
// ostane po slovensky — vzory pribúdajú podľa toho, čo hráči vidia najčastejšie.
//
// Parameter {n…} (n, n2…) berie len číslo a vyberá tvar počítaného slova; ostatné berú čokoľvek
// (meno hráča, karty). Vzor s tvarmi ({"1": …, "2": …, "5": …}) sa skúša v každom tvare.

import type { Parametre, Slovnik } from "./preklad.ts";

/** Predpony kľúčov, ktoré sú vzormi hlášok. */
export const PREDPONY_VZOROV = ["motor.", "server."] as const;

interface Vzor {
  readonly kluc: string;
  readonly re: RegExp;
  readonly mena: readonly string[];
}

const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");

function zostavVzor(kluc: string, text: string): Vzor {
  const mena: string[] = [];
  let re = "";
  let od = 0;
  for (const m of text.matchAll(/\{([\p{L}\p{N}_]+)\}/gu)) {
    re += escape(text.slice(od, m.index));
    const meno = m[1] ?? "";
    mena.push(meno);
    re += /^n\d*$/u.test(meno) ? "(-?\\d+)" : "(.+?)";
    od = m.index + m[0].length;
  }
  re += escape(text.slice(od));
  return { kluc, re: new RegExp(`^${re}$`, "u"), mena };
}

/** Vzory zo slovenského slovníka — každý tvar zvlášť, dlhšie (konkrétnejšie) skôr. */
export function vzoryHlasok(zdroj: Slovnik): readonly Vzor[] {
  const out: { vzor: Vzor; dlzka: number }[] = [];
  for (const [kluc, v] of Object.entries(zdroj)) {
    if (!PREDPONY_VZOROV.some((p) => kluc.startsWith(p))) continue;
    const texty = typeof v === "string" ? [v] : Object.values(v).filter((x): x is string => typeof x === "string");
    for (const text of texty) out.push({ vzor: zostavVzor(kluc, text), dlzka: text.length });
  }
  return out.sort((a, b) => b.dlzka - a.dlzka).map((x) => x.vzor);
}

/** Kľúč a parametre vzoru, na ktorý hláška celá sedí; null = hláška nemá vzor. */
export function najdiVzor(text: string, vzory: readonly Vzor[]): { readonly kluc: string; readonly p: Parametre } | null {
  for (const v of vzory) {
    const m = v.re.exec(text);
    if (m === null) continue;
    const p: Record<string, string | number> = {};
    v.mena.forEach((meno, i) => {
      const hodnota = m[i + 1] ?? "";
      p[meno] = /^n\d*$/u.test(meno) ? Number(hodnota) : hodnota;
    });
    return { kluc: v.kluc, p };
  }
  return null;
}

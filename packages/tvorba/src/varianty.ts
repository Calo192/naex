// Permutácie strán návrhu — rovnaký algoritmus ako jadro (core/variants.ts),
// ale nad ľubovoľnými kľúčmi akcií vrátane vlastných, ktoré jadro nepozná.
// Tvorca ich potrebuje na náhľad, štatistiky a tlač ešte pred zverejnením.

import type { KartaNavrh, Pozicia, StranaNavrhu } from "./typy.ts";
import { POZICIE } from "./typy.ts";

/** Rozloženie jednej strany: kľúč akcie alebo null na každej pozícii. */
export type RozlozenieStrany = readonly [string | null, string | null, string | null, string | null];

export function volnePozicie(strana: StranaNavrhu): Pozicia[] {
  return POZICIE.filter((p) => !strana.blokovane.includes(p));
}

export function pocetAkcii(strana: StranaNavrhu): number {
  return Object.values(strana.akcie).reduce((a, b) => a + Math.max(0, b), 0);
}

/** Všetky rôzne rozloženia strany v stabilnom poradí (prázdno pred akciami). */
export function rozlozeniaStrany(strana: StranaNavrhu): RozlozenieStrany[] {
  const volne = volnePozicie(strana);
  const symboly = new Map<string, number>();
  let n = 0;
  for (const [kluc, pocet] of Object.entries(strana.akcie)) {
    if (pocet > 0) {
      symboly.set(kluc, pocet);
      n += pocet;
    }
  }
  if (n > volne.length) return [];
  if (volne.length - n > 0) symboly.set("", volne.length - n);

  const rozne = [...symboly.keys()].sort();
  const out: RozlozenieStrany[] = [];
  const aktualne: string[] = [];
  const rek = (): void => {
    if (aktualne.length === volne.length) {
      const r: (string | null)[] = [null, null, null, null];
      for (let k = 0; k < volne.length; k++) {
        const sym = aktualne[k] ?? "";
        const poz = volne[k] as Pozicia;
        if (sym !== "") {
          const povolene = strana.povolene[poz];
          if (povolene !== undefined && povolene.length > 0 && !povolene.includes(sym)) return;
          r[poz] = sym;
        }
      }
      out.push(r as unknown as RozlozenieStrany);
      return;
    }
    for (const sym of rozne) {
      const zostava = symboly.get(sym) ?? 0;
      if (zostava === 0) continue;
      symboly.set(sym, zostava - 1);
      aktualne.push(sym);
      rek();
      aktualne.pop();
      symboly.set(sym, zostava);
    }
  };
  rek();
  return out;
}

export interface Varianty {
  readonly lava: RozlozenieStrany[];
  readonly prava: RozlozenieStrany[];
  readonly pocet: number;
}

export function variantyKarty(k: Pick<KartaNavrh, "lava" | "prava">): Varianty {
  const lava = rozlozeniaStrany(k.lava);
  const prava = rozlozeniaStrany(k.prava);
  return { lava, prava, pocet: lava.length * prava.length };
}

/** Variant podľa poradového čísla (ľavá strana mení sa pomalšie). */
export function variant(v: Varianty, i: number): { lava: RozlozenieStrany; prava: RozlozenieStrany } | null {
  if (v.pocet === 0) return null;
  const idx = ((i % v.pocet) + v.pocet) % v.pocet;
  const lava = v.lava[Math.floor(idx / v.prava.length)];
  const prava = v.prava[idx % v.prava.length];
  if (lava === undefined || prava === undefined) return null;
  return { lava, prava };
}

/** Chyby návrhu (MAUI CardCreationSpec.Validate) — prázdne pole = v poriadku. */
export function chybyNavrhu(k: KartaNavrh): string[] {
  const chyby: string[] = [];
  if (k.nazov.trim() === "") chyby.push("Karta musí mať názov.");
  if (k.sirkaMm <= 0 || k.sirkaMm > 500) chyby.push("Šírka musí byť 1 – 500 mm.");
  if (k.vyskaMm <= 0 || k.vyskaMm > 500) chyby.push("Výška musí byť 1 – 500 mm.");
  if (k.kopie < 1 || k.kopie > 1000) chyby.push("Počet kópií musí byť 1 – 1000.");
  for (const [meno, s] of [["Ľavá", k.lava], ["Pravá", k.prava]] as const) {
    const volne = volnePozicie(s).length;
    const n = pocetAkcii(s);
    if (n > volne) chyby.push(`${meno} strana má ${n} akcií, ale len ${volne} voľných pozícií.`);
    else if (n > 0 && rozlozeniaStrany(s).length === 0) {
      chyby.push(`${meno} strana: obmedzenia pozícií nedovoľujú žiadne rozloženie.`);
    }
  }
  return chyby;
}

// Dielňa (Michal 2026-10-22): tvary z /api/dielna a prevod návrhu na kartu
// pre KartaLico. Návrh drží akcie na 4 pevných pozíciách strany — tvorca ich
// prevezme bez straty (obsadená pozícia = len táto akcia, prázdna = blokovaná).

import type { KartaNavrh, StranaNavrhu } from "@naex/tvorba";
import { PREDVOLENE_NASTAVENIA } from "@naex/tvorba";

export type StavZobrazeny = "koncept" | "hlasovanie" | "vratene" | "zamietnute" | "v_tvorcovi" | "v_hre" | "archiv";
export type Pozicie = readonly (string | null)[];

export interface ObsahNavrhu {
  readonly nazov: string;
  readonly tagy: readonly string[];
  readonly efekt: string;
  readonly lava: StranaNavrhu;
  readonly prava: StranaNavrhu;
  readonly obrazok: string | null;
  readonly popisIlustracie: string;
  readonly novaAkcia: string;
  readonly zdovodnenie: string;
}

export interface AutorDielne {
  readonly id: number;
  readonly meno: string;
  readonly avatar: string | null;
  readonly rola: string;
  readonly ai: boolean;
  readonly odznak: boolean;
}

export interface NavrhDielne {
  readonly id: number;
  readonly typ: "nova" | "uprava";
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
  readonly kartaId: string | null;
  readonly skryty: boolean;
  readonly nahlaseni: number;
  readonly noveRozhodnutie: boolean;
}

export interface DetailNavrhu extends NavrhDielne {
  readonly komentare: readonly { readonly id: number; readonly autor: AutorDielne; readonly text: string; readonly vytvoreny: number }[];
  readonly mojeNahlasenie: boolean;
}

export interface ZoznamDielne {
  readonly navrhy: readonly NavrhDielne[];
  readonly krabicka: number;
  readonly maxOtvorenych: number;
  readonly smiem: boolean;
  readonly noveRozhodnutia: number;
}

export const STAVY: Readonly<Record<StavZobrazeny, { readonly nazov: string; readonly znak: string }>> = {
  koncept: { nazov: "koncept", znak: "✎" },
  hlasovanie: { nazov: "v hlasovaní", znak: "●" },
  vratene: { nazov: "vrátený na úpravu", znak: "↺" },
  zamietnute: { nazov: "zamietnutý", znak: "✕" },
  v_tvorcovi: { nazov: "v tvorcovi", znak: "✓" },
  v_hre: { nazov: "v hre", znak: "★" },
  archiv: { nazov: "v archíve", znak: "▫" },
};

const POZICIE = [0, 1, 2, 3] as const;

/** Akcie na pozíciách strany, ak sú jednoznačné; strana s viacerými rozloženiami vráti null. */
export function poziciZoStrany(s: StranaNavrhu): Pozicie | null {
  const out = POZICIE.map((p) => {
    const pov = s.povolene[p];
    return pov !== undefined && pov.length === 1 && !s.blokovane.includes(p) ? (pov[0] ?? null) : null;
  });
  const pocet = Object.values(s.akcie).reduce((a, n) => a + n, 0);
  return out.filter((x) => x !== null).length === pocet ? out : null;
}

export function stranaZPozicii(pozicie: Pozicie): StranaNavrhu {
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

/** Karta na vykreslenie (KartaLico); pri úprave preberá rozmery a farbu pôvodnej karty. */
export function kartaZNavrhu(o: ObsahNavrhu, zaklad: KartaNavrh | null): KartaNavrh {
  const obrazok = o.obrazok === null ? null : zaklad?.obrazok?.plny === o.obrazok ? zaklad.obrazok : { plny: o.obrazok, nahlad: o.obrazok };
  return {
    ...(zaklad ?? { ...PREDVOLENE_NASTAVENIA, farba: null, kopie: 1 }),
    id: zaklad?.id ?? "navrh",
    nazov: o.nazov === "" ? "Bez názvu" : o.nazov,
    tagy: o.tagy,
    efekt: o.efekt,
    obrazok,
    lava: o.lava,
    prava: o.prava,
    upravene: 0,
  } as KartaNavrh;
}

export const kedy = (cas: number): string => {
  const dni = Math.floor((Date.now() - cas) / 86_400_000);
  if (dni <= 0) return "dnes";
  if (dni === 1) return "včera";
  if (dni < 7) return `pred ${dni} dňami`;
  return new Date(cas).toLocaleDateString("sk-SK", { day: "numeric", month: "numeric", year: "numeric" });
};

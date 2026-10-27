// Prihlásený používateľ pre celú aplikáciu.

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "./api.ts";
import { aktualnyPar, pouziPar, volbaDoUctu, volbaZUctu } from "./paryHraca.ts";
import { aktualnaSchema, pouziSchemu } from "./schemy.ts";
import type { Pohlavie } from "@naex/core";

/**
 * Úroveň účtu — práva overuje server, tu len podľa nej kreslíme. Hráčske ranky
 * (Michal 2026-10-22): návštevník → Poldeci (kľúč „hrac“) → Deci → Sedmička.
 */
export type Rola = "admin" | "subadmin" | "sedmicka" | "deci" | "hrac" | "navstevnik";

export const NAZOV_UROVNE: Readonly<Record<Rola, string>> = {
  admin: "admin",
  subadmin: "subadmin",
  sedmicka: "Sedmička",
  deci: "Deci",
  hrac: "Poldeci",
  navstevnik: "Nealko",
};

/** Hráčske ranky od najnižšieho — tým sa prideľujú práva. */
export const RANKY_HRACOV: readonly Rola[] = ["navstevnik", "hrac", "deci", "sedmicka"];

/** Práva rankov (server/prava.ts); kľúče pozná server, klient podľa nich len skrýva. */
export type Pravo =
  | "hrat_bot"
  | "hrat_ludia"
  | "sukromne_miestnosti"
  | "hodnotene_partie"
  | "melichar_soundboard"
  | "spatna_vazba_pisat"
  | "spatna_vazba_reagovat"
  | "hodnotit_hru"
  | "profily_inych"
  | "vlastna_fotka"
  | "reporty_playtestov"
  | "navrhovat_karty"
  | "vidiet_vyvoj";

/** Má prihlásený používateľ právo? Bez zoznamu (starý server) áno — server aj tak overí. */
export const maPravo = (ja: Pick<Pouzivatel, "prava"> | null, pravo: Pravo): boolean => ja !== null && (ja.prava === undefined || ja.prava.includes(pravo));

/** Admin a subadmin: správa hráčov, tvorba kariet, mazanie cudzích príspevkov. */
export const jeSpravca = (rola: Rola): boolean => rola === "admin" || rola === "subadmin";

export interface Pouzivatel {
  readonly id: number;
  readonly login: string;
  readonly meno: string;
  readonly avatar: string | null;
  readonly rola: Rola;
  /** Dohraté partie — posiela ho len /api/ja. */
  readonly dohrate?: number;
  /** Práva ranku — posiela ich len /api/ja. */
  readonly prava?: readonly Pravo[];
  /** Zväčšenie karty pri prejdení myšou v percentách (150 – 400, predvolene 200). */
  readonly lupa?: number;
  /** Hlasitosť hudby počas partie v percentách (0 = vypnutá, predvolene 30). */
  readonly hudba?: number;
  /** Hlasitosť hlášok majstra Melichara v partii proti počítaču v percentách (0 = vypnuté, predvolene 70). */
  readonly melichar?: number;
  /** Účet AI agenta (nastavuje admin). */
  readonly ai?: boolean;
  /** Farebná schéma webu (lib/schemy.ts); null = predvolená. */
  readonly schema?: string | null;
  /** Pár farieb hráča v partii (lib/paryHraca.ts, "w20" / "w20-prehod"); null = predvolený. */
  readonly par?: string | null;
  /** Nápovedy majstra Melichara v partii (Michal 2026-10-24); chýba = zapnuté. */
  readonly napovedy?: boolean;
  /** Klávesové skratky v partii (K, P, N, Esc, ?); chýba = zapnuté. */
  readonly skratky?: boolean;
  /** Medziobrazovky pri prechode fáz v partii (Michal 2026-10-27); chýba = zapnuté. */
  readonly medziobrazovky?: boolean;
  /** Pohlavie pre tvary hlášok v partii; null/chýba = neuvádza (neutrálne hlášky). */
  readonly pohlavie?: Pohlavie | null;
}

export const LUPA_OD = 150;
export const LUPA_DO = 400;
export const LUPA_PREDVOLENA = 200;
export const HUDBA_PREDVOLENA = 30;
export const MELICHAR_PREDVOLENY = 70;

interface UcetKontext {
  readonly ja: Pouzivatel | null;
  readonly nacitane: boolean;
  /** Práva neprihláseného (Nealko) — podľa nich hlavička skrýva odkazy; null = server ich neposlal. */
  readonly pravaNavstevnika: readonly Pravo[] | null;
  nastav(p: Pouzivatel | null): void;
  /** Znova načíta účet zo servera — úroveň sa mení aj počas partie (hráčom po prvej dohratej partii). */
  obnov(): void;
  odhlas(): Promise<void>;
}

const Kontext = createContext<UcetKontext | null>(null);

export function UcetProvider({ children }: { children: ReactNode }) {
  const [ja, setJaStav] = useState<Pouzivatel | null>(null);
  const [nacitane, setNacitane] = useState(false);
  const [pravaNavstevnika, setPravaNavstevnika] = useState<readonly Pravo[] | null>(null);

  // Schéma a pár farieb uložené v účte majú prednosť pred prehliadačom — platia na každom zariadení.
  const setJa = useCallback((p: Pouzivatel | null): void => {
    if (p?.schema != null && p.schema !== aktualnaSchema()) pouziSchemu(p.schema);
    if (p?.par != null && p.par !== volbaDoUctu(aktualnyPar())) pouziPar(volbaZUctu(p.par));
    setJaStav(p);
  }, []);

  const obnov = useCallback((): void => {
    api
      .get<{ pouzivatel: Pouzivatel | null; prava?: readonly Pravo[] }>("/ja")
      .then((r) => {
        setPravaNavstevnika(r.pouzivatel === null ? (r.prava ?? null) : null);
        setJa(r.pouzivatel);
      })
      .catch(() => setJa(null))
      .finally(() => setNacitane(true));
  }, [setJa]);

  useEffect(obnov, [obnov]);

  const odhlas = useCallback(async () => {
    await api.post("/odhlasenie");
    setJa(null);
    // Práva návštevníka (čo hlavička ukáže bez účtu).
    obnov();
  }, [obnov]);

  return <Kontext.Provider value={{ ja, nacitane, pravaNavstevnika, nastav: setJa, obnov, odhlas }}>{children}</Kontext.Provider>;
}

export function useUcet(): UcetKontext {
  const k = useContext(Kontext);
  if (k === null) throw new Error("useUcet mimo UcetProvider");
  return k;
}

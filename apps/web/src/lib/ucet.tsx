// Prihlásený používateľ pre celú aplikáciu.

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "./api.ts";
import { aktualnaSchema, pouziSchemu } from "./schemy.ts";

/** Úroveň účtu (Michal 2026-10-12) — práva overuje server, tu len podľa nej kreslíme. */
export type Rola = "admin" | "subadmin" | "hrac" | "navstevnik";

export const NAZOV_UROVNE: Readonly<Record<Rola, string>> = {
  admin: "admin",
  subadmin: "subadmin",
  hrac: "hráč",
  navstevnik: "návštevník",
};

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
  /** Zväčšenie karty (ruka pod myšou, inde klikom) v percentách (150 – 400, predvolene 200). */
  readonly lupa?: number;
  /** Hlasitosť hudby počas partie v percentách (0 = vypnutá, predvolene 30). */
  readonly hudba?: number;
  /** Účet AI agenta (nastavuje admin). */
  readonly ai?: boolean;
  /** Farebná schéma webu (lib/schemy.ts); null = predvolená. */
  readonly schema?: string | null;
}

export const LUPA_OD = 150;
export const LUPA_DO = 400;
export const LUPA_PREDVOLENA = 200;
export const HUDBA_PREDVOLENA = 30;

interface UcetKontext {
  readonly ja: Pouzivatel | null;
  readonly nacitane: boolean;
  nastav(p: Pouzivatel | null): void;
  /** Znova načíta účet zo servera — úroveň sa mení aj počas partie (hráčom po prvej bitke). */
  obnov(): void;
  odhlas(): Promise<void>;
}

const Kontext = createContext<UcetKontext | null>(null);

export function UcetProvider({ children }: { children: ReactNode }) {
  const [ja, setJaStav] = useState<Pouzivatel | null>(null);
  const [nacitane, setNacitane] = useState(false);

  // Schéma uložená v účte má prednosť pred tou v prehliadači — platí na každom zariadení.
  const setJa = useCallback((p: Pouzivatel | null): void => {
    if (p?.schema != null && p.schema !== aktualnaSchema()) pouziSchemu(p.schema);
    setJaStav(p);
  }, []);

  const obnov = useCallback((): void => {
    api
      .get<{ pouzivatel: Pouzivatel | null }>("/ja")
      .then((r) => setJa(r.pouzivatel))
      .catch(() => setJa(null))
      .finally(() => setNacitane(true));
  }, [setJa]);

  useEffect(obnov, [obnov]);

  const odhlas = useCallback(async () => {
    await api.post("/odhlasenie");
    setJa(null);
  }, []);

  return <Kontext.Provider value={{ ja, nacitane, nastav: setJa, obnov, odhlas }}>{children}</Kontext.Provider>;
}

export function useUcet(): UcetKontext {
  const k = useContext(Kontext);
  if (k === null) throw new Error("useUcet mimo UcetProvider");
  return k;
}

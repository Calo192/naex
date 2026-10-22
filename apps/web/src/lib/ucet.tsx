// Prihlásený používateľ pre celú aplikáciu.

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "./api.ts";
import { aktualnaSchema, pouziSchemu } from "./schemy.ts";

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
  navstevnik: "návštevník",
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
  | "navrhovat_karty";

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
  /** Zväčšenie karty (ruka pod myšou, inde klikom) v percentách (150 – 400, predvolene 200). */
  readonly lupa?: number;
  /** Hlasitosť hudby počas partie v percentách (0 = vypnutá, predvolene 30). */
  readonly hudba?: number;
  /** Hlasitosť hlášok majstra Melichara v partii proti počítaču v percentách (0 = vypnuté, predvolene 70). */
  readonly melichar?: number;
  /** Pri koľkých percentách hráčových ťahov sa Melichar ozve (5 – 60, predvolene 25). */
  readonly melicharFrekvencia?: number;
  /** Účet AI agenta (nastavuje admin). */
  readonly ai?: boolean;
  /** Farebná schéma webu (lib/schemy.ts); null = predvolená. */
  readonly schema?: string | null;
  /** Zobrazenie skóre v partii (ZOBRAZENIA_SKORE); chýba = dlaždice. */
  readonly skore?: ZobrazenieSkore;
  /** Klávesové skratky v partii (K, P, N, Esc, ?); chýba = zapnuté. */
  readonly skratky?: boolean;
}

/**
 * Zobrazenie skóre v partii (Michal 2026-10-22): po kliku na Body rozpis
 * bodov ako dlaždice v bare hráča, alebo krčmový účet cez starších —
 * spoločný, alebo dva proti sebe. Server pozná tie isté id (auth.ts).
 */
export const ZOBRAZENIA_SKORE = [
  { id: "dlazdice", nazov: "Dlaždice podmienok", popis: "Bar hráča sa prepne na šesť dlaždíc — lokality, starší, cigarety, zóny strachu, Dlhy, Cirhóza." },
  { id: "spolocny", nazov: "Spoločný účet", popis: "Krčmový účet cez starších: ty vľavo, súper vpravo, podmienka v strede." },
  { id: "dva", nazov: "Dva účty", popis: "Dva krčmové účty proti sebe — súperov zhora, tvoj zdola." },
] as const;
export type ZobrazenieSkore = (typeof ZOBRAZENIA_SKORE)[number]["id"];
export const SKORE_PREDVOLENE: ZobrazenieSkore = "dlazdice";

export const LUPA_OD = 150;
export const LUPA_DO = 400;
export const LUPA_PREDVOLENA = 200;
export const HUDBA_PREDVOLENA = 30;
export const MELICHAR_PREDVOLENY = 70;
export const MELICHAR_FREKVENCIA_OD = 5;
/** Najvyššia šanca hlášky, aj na NA EX! (Michal 2026-10-22). */
export const MELICHAR_FREKVENCIA_DO = 60;
export const MELICHAR_FREKVENCIA_PREDVOLENA = 25;

interface UcetKontext {
  readonly ja: Pouzivatel | null;
  readonly nacitane: boolean;
  nastav(p: Pouzivatel | null): void;
  /** Znova načíta účet zo servera — úroveň sa mení aj počas partie (hráčom po prvej dohratej partii). */
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

// Zverejnená sada kariet (glosár, pravidlá, hra). Načíta sa raz pri štarte.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Sada, Vzhlad } from "@naex/tvorba";
import { api } from "./api.ts";

interface SadaKontext {
  readonly sada: Sada | null;
  readonly chyba: string | null;
  obnov(): void;
}

const Kontext = createContext<SadaKontext | null>(null);

export function SadaProvider({ children }: { children: ReactNode }) {
  const [sada, setSada] = useState<Sada | null>(null);
  const [chyba, setChyba] = useState<string | null>(null);
  const obnov = useCallback(() => {
    api
      .get<Sada>("/sada")
      .then((s) => {
        setSada(s);
        setChyba(null);
      })
      .catch((e: unknown) => setChyba(e instanceof Error ? e.message : String(e)));
  }, []);
  useEffect(obnov, [obnov]);
  const hodnota = useMemo(() => ({ sada, chyba, obnov }), [sada, chyba, obnov]);
  return <Kontext.Provider value={hodnota}>{children}</Kontext.Provider>;
}

export function useSada(): SadaKontext {
  const k = useContext(Kontext);
  if (k === null) throw new Error("useSada mimo SadaProvider");
  return k;
}

export function vzhladSady(s: Sada): Vzhlad {
  return { akcie: s.akcie, klucoveSlova: s.klucoveSlova, kategorie: s.kategorie };
}

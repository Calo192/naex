// Prihlásený používateľ pre celú aplikáciu.

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "./api.ts";

export interface Pouzivatel {
  readonly id: number;
  readonly login: string;
  readonly meno: string;
  readonly avatar: string | null;
  readonly rola: "admin" | "pouzivatel";
}

interface UcetKontext {
  readonly ja: Pouzivatel | null;
  readonly nacitane: boolean;
  nastav(p: Pouzivatel | null): void;
  odhlas(): Promise<void>;
}

const Kontext = createContext<UcetKontext | null>(null);

export function UcetProvider({ children }: { children: ReactNode }) {
  const [ja, setJa] = useState<Pouzivatel | null>(null);
  const [nacitane, setNacitane] = useState(false);

  useEffect(() => {
    api
      .get<{ pouzivatel: Pouzivatel | null }>("/ja")
      .then((r) => setJa(r.pouzivatel))
      .catch(() => setJa(null))
      .finally(() => setNacitane(true));
  }, []);

  const odhlas = useCallback(async () => {
    await api.post("/odhlasenie");
    setJa(null);
  }, []);

  return <Kontext.Provider value={{ ja, nacitane, nastav: setJa, odhlas }}>{children}</Kontext.Provider>;
}

export function useUcet(): UcetKontext {
  const k = useContext(Kontext);
  if (k === null) throw new Error("useUcet mimo UcetProvider");
  return k;
}

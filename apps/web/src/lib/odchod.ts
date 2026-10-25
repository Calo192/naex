// Strážca odchodu z partie (Michal 2026-10-23): kým partia beží, klik na položku
// menu v hlavičke sa najprv opýta, či hráč chce partiu opustiť. Zapína ho herná
// plocha, číta Layout.

import { useEffect, useState } from "react";

/** Stráži sa rozohraná partia (kód miestnosti); vo výučbe je súperom bot a nič nečaká. */
export type StrazenaPartia = { readonly kod: string; readonly vyucba: boolean };

/** Trieda závesu dialógu — zámok klikov výučby ho musí púšťať, leží mimo hlavičky. */
export const ZAVES_ODCHODU = "odchod-zaves";

let strazena: StrazenaPartia | null = null;
const POSLUCHACI = new Set<() => void>();

function oznam(): void {
  for (const f of POSLUCHACI) f();
}

/** Zapne stráženie partie; vráti jeho vypnutie. */
export function strazOdchod(partia: StrazenaPartia): () => void {
  strazena = partia;
  oznam();
  return () => {
    if (strazena !== partia) return;
    strazena = null;
    oznam();
  };
}

/** Práve strážená partia, alebo null. */
export function strazenaPartia(): StrazenaPartia | null {
  return strazena;
}

/** Herná plocha: kým partia beží, hlavička stráži odchod. */
export function useStrazOdchodu(aktivna: boolean, kodMiestnosti: string, vyucba = false): void {
  useEffect(() => (aktivna ? strazOdchod({ kod: kodMiestnosti, vyucba }) : undefined), [aktivna, kodMiestnosti, vyucba]);
}

/** Layout: rozohraná partia, alebo null, keď sa nič nestráži. */
export function useStrazenaPartia(): StrazenaPartia | null {
  const [hodnota, setHodnota] = useState(strazena);
  useEffect(() => {
    const f = (): void => setHodnota(strazena);
    POSLUCHACI.add(f);
    f();
    return () => {
      POSLUCHACI.delete(f);
    };
  }, []);
  return hodnota;
}

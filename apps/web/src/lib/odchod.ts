// Strážca odchodu z partie (Michal 2026-10-23): kým partia beží, klik na položku
// menu v hlavičke sa najprv opýta, či hráč chce partiu opustiť. Zapína ho herná
// plocha, číta Layout.

import { useEffect, useState } from "react";

let kod: string | null = null;
const POSLUCHACI = new Set<() => void>();

/** Herná plocha: kým partia beží, hlavička stráži odchod (kod = kód miestnosti). */
export function useStrazOdchodu(aktivna: boolean, kodMiestnosti: string): void {
  useEffect(() => {
    if (!aktivna) return;
    kod = kodMiestnosti;
    for (const f of POSLUCHACI) f();
    return () => {
      kod = null;
      for (const f of POSLUCHACI) f();
    };
  }, [aktivna, kodMiestnosti]);
}

/** Layout: kód miestnosti rozohranej partie, alebo null, keď sa nič nestráži. */
export function useStrazenaPartia(): string | null {
  const [hodnota, setHodnota] = useState(kod);
  useEffect(() => {
    const f = (): void => setHodnota(kod);
    POSLUCHACI.add(f);
    f();
    return () => {
      POSLUCHACI.delete(f);
    };
  }, []);
  return hodnota;
}

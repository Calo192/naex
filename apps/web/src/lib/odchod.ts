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

/** Kód rozohranej miestnosti v prehliadači (useHra) — Layout podľa neho ukáže „Späť ku stolu“. */
export const KLUC_MIESTNOSTI = "naex.miestnost";

// Stôl v hlavičke (Michal 2026-10-26, #23): kým herná plocha kreslí partiu, hlavička
// nemá menu webu — len logo, štítok partie, menu Partia a účet. Platí aj po konci
// partie, kým hráč sedí pri stole; prehrávač dohratej partie menu webu nechá.
let stol = false;
const POSLUCHACI_STOLA = new Set<() => void>();

/** Herná plocha: kým je aktívna, hlavička je v režime stola. */
export function useStolVHlavicke(aktivny: boolean): void {
  useEffect(() => {
    if (!aktivny) return;
    stol = true;
    for (const f of POSLUCHACI_STOLA) f();
    return () => {
      stol = false;
      for (const f of POSLUCHACI_STOLA) f();
    };
  }, [aktivny]);
}

/** Layout: sedí hráč pri stole? */
export function useJeStolVHlavicke(): boolean {
  const [hodnota, setHodnota] = useState(stol);
  useEffect(() => {
    const f = (): void => setHodnota(stol);
    POSLUCHACI_STOLA.add(f);
    f();
    return () => {
      POSLUCHACI_STOLA.delete(f);
    };
  }, []);
  return hodnota;
}

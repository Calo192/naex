// Hra na mobile zatiaľ nie je podporovaná (Michal 2026-10-22): herný stôl
// potrebuje šírku a myš. Blokuje sa len v klientovi, server nič nerozlišuje.
// Tablet na šírku (≥ 1024 px) hrať smie; telefón aj na šírku nie (nízky).
// Výnimka (Michal 2026-10-31): admin a subadmin skúšajú stôl pre telefón na šírku
// (rozloženie „Pult“, mobil-sirka.css). Na telefóne sa hrá vždy na šírku — na výšku stôl
// prekryje výzva otočiť telefón a partia beží ďalej (Michal 2026-10-31: „forcnúť hru na šírku“).

import { useEffect, useState } from "react";

/** Úzke okno, alebo dotyková obrazovka užšia ako tablet na šírku či nízka (telefón na šírku). */
const NEPODPOROVANE = "(max-width: 899px), (pointer: coarse) and (max-width: 1023px), (pointer: coarse) and (max-height: 500px)";
const DOTYK = "(pointer: coarse)";
/** Telefón — dotykový displej, ktorý má na šírku nanajvýš 500 px výšky (na výšku šírky). */
const TELEFON = "(pointer: coarse) and (orientation: landscape) and (max-height: 500px), (pointer: coarse) and (orientation: portrait) and (max-width: 500px)";
const NA_VYSKU = "(orientation: portrait)";
const DOTAZY = [NEPODPOROVANE, DOTYK, TELEFON, NA_VYSKU] as const;

export type DovodNepodporovania = "dotyk" | "uzke" | "otoc";

/** Čo platí pre zariadenie: dotaz → zhoduje sa. */
export type Zhoda = (dotaz: string) => boolean;

function zhoda(dotaz: string): boolean {
  return typeof window !== "undefined" && window.matchMedia?.(dotaz).matches === true;
}

/**
 * null = hrať sa dá; inak dôvod: „dotyk“ (mobil, tablet na výšku), „uzke“ (počítač
 * s príliš úzkym oknom — stačí ho roztiahnuť) alebo „otoc“ (správca s telefónom na výšku).
 */
export function dovodNepodporovania(z: Zhoda, spravca: boolean): DovodNepodporovania | null {
  if (spravca && z(TELEFON)) return null;
  if (!z(NEPODPOROVANE)) return null;
  if (!z(DOTYK)) return "uzke";
  return spravca && z(NA_VYSKU) ? "otoc" : "dotyk";
}

/**
 * Stôl pre telefón (rozloženie Pult) — len správca. `otoc`: telefón je na výšku, stôl prekryje
 * výzva otočiť ho; rozloženie ostáva, aby sa po otočení nič nestratilo.
 */
export function stolNaSirku(z: Zhoda, spravca: boolean): { readonly naSirku: boolean; readonly otoc: boolean } {
  const telefon = spravca && z(TELEFON);
  return { naSirku: telefon, otoc: telefon && z(NA_VYSKU) };
}

/** Prepočíta hodnotu pri každej zmene ktoréhokoľvek dotazu (otočenie, roztiahnutie okna). */
function useZhoda<T>(vypocet: (z: Zhoda) => T, kluc: unknown): T {
  const [stav, setStav] = useState(() => vypocet(zhoda));
  useEffect(() => {
    setStav(vypocet(zhoda));
    const mq = DOTAZY.map((d) => window.matchMedia?.(d)).filter((m): m is MediaQueryList => m !== undefined);
    const zmena = (): void => setStav(vypocet(zhoda));
    for (const m of mq) m.addEventListener("change", zmena);
    return () => {
      for (const m of mq) m.removeEventListener("change", zmena);
    };
    // vypocet je čistá funkcia kľúča (spravca)
  }, [kluc]);
  return stav;
}

export function useNepodporovaneZariadenie(spravca = false): DovodNepodporovania | null {
  return useZhoda((z) => dovodNepodporovania(z, spravca), spravca);
}

export function useStolNaSirku(spravca: boolean): { readonly naSirku: boolean; readonly otoc: boolean } {
  return useZhoda((z) => stolNaSirku(z, spravca), spravca);
}

// Hra na mobile zatiaľ nie je podporovaná (Michal 2026-10-22): herný stôl
// potrebuje šírku a myš. Blokuje sa len v klientovi, server nič nerozlišuje.
// Tablet na šírku (≥ 1024 px) hrať smie; telefón aj na šírku nie (nízky).

import { useEffect, useState } from "react";

/** Úzke okno, alebo dotyková obrazovka užšia ako tablet na šírku či nízka (telefón na šírku). */
const NEPODPOROVANE = "(max-width: 899px), (pointer: coarse) and (max-width: 1023px), (pointer: coarse) and (max-height: 500px)";
const DOTYK = "(pointer: coarse)";

function zhoda(dotaz: string): boolean {
  return typeof window !== "undefined" && window.matchMedia?.(dotaz).matches === true;
}

/**
 * null = hrať sa dá; inak dôvod: „dotyk“ (mobil, tablet na výšku) alebo
 * „uzke“ (počítač s príliš úzkym oknom — stačí ho roztiahnuť).
 */
export function useNepodporovaneZariadenie(): "dotyk" | "uzke" | null {
  const zisti = (): "dotyk" | "uzke" | null => (zhoda(NEPODPOROVANE) ? (zhoda(DOTYK) ? "dotyk" : "uzke") : null);
  const [stav, setStav] = useState(zisti);
  useEffect(() => {
    const mq = window.matchMedia?.(NEPODPOROVANE);
    if (mq === undefined) return;
    const zmena = (): void => setStav(zisti());
    mq.addEventListener("change", zmena);
    return () => mq.removeEventListener("change", zmena);
  }, []);
  return stav;
}

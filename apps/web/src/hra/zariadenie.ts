// Hra na mobile zatiaľ nie je podporovaná (Michal 2026-10-22): herný stôl
// potrebuje šírku a myš. Blokuje sa len v klientovi, server nič nerozlišuje.
// Tablet na šírku (≥ 1024 px) hrať smie; telefón aj na šírku nie (nízky).
// Výnimka (Michal 2026-10-31): admin a subadmin skúšajú stôl pre telefón na šírku
// (rozloženie „Pult“, mobil-sirka.css). Na telefóne sa hrá povinne na celej obrazovke (Michal
// 2026-10-31, po skúške na Androide) — kým nie je, stôl prekryje výzva; iPhone bez Fullscreen API
// Partia pod výzvou beží ďalej. Na iPhone sa zatiaľ nehrá vôbec, ani správca (Michal 2026-10-31:
// na mobile len Android) — iPad ostáva, ako bol.

import { useEffect, useState } from "react";

/** Úzke okno, alebo dotyková obrazovka užšia ako tablet na šírku či nízka (telefón na šírku). */
const NEPODPOROVANE = "(max-width: 899px), (pointer: coarse) and (max-width: 1023px), (pointer: coarse) and (max-height: 500px)";
const DOTYK = "(pointer: coarse)";
/** Telefón — dotykový displej, ktorý má na šírku nanajvýš 500 px výšky (na výšku šírky). */
const TELEFON = "(pointer: coarse) and (orientation: landscape) and (max-height: 500px), (pointer: coarse) and (orientation: portrait) and (max-width: 500px)";
const NA_VYSKU = "(orientation: portrait)";
const DOTAZY = [NEPODPOROVANE, DOTYK, TELEFON, NA_VYSKU] as const;

export type DovodNepodporovania = "dotyk" | "uzke" | "otoc" | "iphone";

/** iPhone či iPod podľa user-agenta (iPad sa hlási ako iPad alebo Macintosh — ten sem nepatrí). */
export function jeIPhone(ua: string): boolean {
  return /\b(iPhone|iPod)\b/.test(ua);
}

const IPHONE = typeof navigator !== "undefined" && jeIPhone(navigator.userAgent);

/** Čo platí pre zariadenie: dotaz → zhoduje sa. */
export type Zhoda = (dotaz: string) => boolean;

function zhoda(dotaz: string): boolean {
  return typeof window !== "undefined" && window.matchMedia?.(dotaz).matches === true;
}

/**
 * null = hrať sa dá; inak dôvod: „dotyk“ (mobil, tablet na výšku), „uzke“ (počítač
 * s príliš úzkym oknom — stačí ho roztiahnuť) alebo „otoc“ (správca s telefónom na výšku).
 */
export function dovodNepodporovania(z: Zhoda, spravca: boolean, iphone = false): DovodNepodporovania | null {
  if (iphone) return "iphone";
  if (spravca && z(TELEFON)) return null;
  if (!z(NEPODPOROVANE)) return null;
  if (!z(DOTYK)) return "uzke";
  return spravca && z(NA_VYSKU) ? "otoc" : "dotyk";
}

/**
 * Stôl pre telefón (rozloženie Pult) — len správca. `otoc`: telefón je na výšku, stôl prekryje
 * výzva otočiť ho; rozloženie ostáva, aby sa po otočení nič nestratilo.
 */
export function stolNaSirku(z: Zhoda, spravca: boolean, iphone = false): { readonly naSirku: boolean; readonly otoc: boolean } {
  const telefon = spravca && !iphone && z(TELEFON);
  return { naSirku: telefon, otoc: telefon && z(NA_VYSKU) };
}

export type VyzvaTelefonu = "cela" | "otoc" | null;

/**
 * Čo prekryje stôl na telefóne: „cela“ = ťukni a hraj na celú obrazovku (fullscreen chce gesto),
 * „otoc“ = otoč telefón na šírku. Celá obrazovka je povinná, kde ju prehliadač vie (Android);
 * keď ju nevie (iPhone) alebo ju odmietol, stačí poloha na šírku. Na počítači sa nič nevynucuje.
 */
export function vyzvaTelefonu(p: { readonly telefon: boolean; readonly naVysku: boolean; readonly celaMozna: boolean; readonly celaZapnuta: boolean }): VyzvaTelefonu {
  if (!p.telefon) return null;
  if (p.celaMozna && !p.celaZapnuta) return "cela";
  return p.naVysku ? "otoc" : null;
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
  return useZhoda((z) => dovodNepodporovania(z, spravca, IPHONE), spravca);
}

export function useStolNaSirku(spravca: boolean): { readonly naSirku: boolean; readonly otoc: boolean } {
  return useZhoda((z) => stolNaSirku(z, spravca, IPHONE), spravca);
}

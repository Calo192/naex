// Hra na mobile zatiaľ nie je podporovaná (Michal 2026-10-22): herný stôl
// potrebuje šírku a myš. Blokuje sa len v klientovi, server nič nerozlišuje.
// Tablet na šírku (≥ 1024 px) hrať smie; telefón aj na šírku nie (nízky).
// Stôl pre telefón na šírku (rozloženie „Pult“, mobil-sirka.css) skúšali najprv len admin a subadmin
// (Michal 2026-10-31); od 2026-11-01 ho na Androide dostane každý od ranku Poldeci. Nováčik bez
// výučby nie — výučba na telefóne nie je odladená a stôl bez nej nepochopí. Na telefóne sa hrá
// povinne na celej obrazovke (Michal 2026-10-31, po skúške na Androide) — kým nie je, stôl prekryje
// výzva; iPhone bez Fullscreen API. Partia pod výzvou beží ďalej. Na iPhone sa zatiaľ nehrá vôbec,
// ani správca (Michal 2026-10-31: na mobile len Android) — iPad ostáva, ako bol.

import { useEffect, useState } from "react";
import type { Rola } from "../lib/ucet.tsx";

/** Úzke okno, alebo dotyková obrazovka užšia ako tablet na šírku či nízka (telefón na šírku). */
const NEPODPOROVANE = "(max-width: 899px), (pointer: coarse) and (max-width: 1023px), (pointer: coarse) and (max-height: 500px)";
const DOTYK = "(pointer: coarse)";
/** Telefón — dotykový displej, ktorý má na šírku nanajvýš 500 px výšky (na výšku šírky). */
const TELEFON = "(pointer: coarse) and (orientation: landscape) and (max-height: 500px), (pointer: coarse) and (orientation: portrait) and (max-width: 500px)";
const NA_VYSKU = "(orientation: portrait)";
const DOTAZY = [NEPODPOROVANE, DOTYK, TELEFON, NA_VYSKU] as const;

export type DovodNepodporovania = "dotyk" | "uzke" | "otoc" | "iphone" | "rank";

/** iPhone či iPod podľa user-agenta (iPad sa hlási ako iPad alebo Macintosh — ten sem nepatrí). */
export function jeIPhone(ua: string): boolean {
  return /\b(iPhone|iPod)\b/.test(ua);
}

/** Stôl pre telefón smie hráč od ranku Poldeci (kľúč „hrac“) a správca; návštevník a odhlásený nie. */
export function smieTelefon(rola: Rola | null): boolean {
  return rola !== null && rola !== "navstevnik";
}

const IPHONE = typeof navigator !== "undefined" && jeIPhone(navigator.userAgent);

/** Čo platí pre zariadenie: dotaz → zhoduje sa. */
export type Zhoda = (dotaz: string) => boolean;

function zhoda(dotaz: string): boolean {
  return typeof window !== "undefined" && window.matchMedia?.(dotaz).matches === true;
}

/**
 * null = hrať sa dá; inak dôvod: „dotyk“ (tablet na výšku, dotyková obrazovka medzi telefónom
 * a tabletom), „uzke“ (počítač s príliš úzkym oknom — stačí ho roztiahnuť), „otoc“ (smie stôl
 * pre telefón, ale displej je na výšku a väčší než telefón), „rank“ (telefón bez ranku Poldeci)
 * alebo „iphone“. `mobil` = smie stôl pre telefón (smieTelefon).
 */
export function dovodNepodporovania(z: Zhoda, mobil: boolean, iphone = false): DovodNepodporovania | null {
  if (iphone) return "iphone";
  if (z(TELEFON)) return mobil ? null : "rank";
  if (!z(NEPODPOROVANE)) return null;
  if (!z(DOTYK)) return "uzke";
  return mobil && z(NA_VYSKU) ? "otoc" : "dotyk";
}

/**
 * Stôl pre telefón (rozloženie Pult) — od ranku Poldeci. `otoc`: telefón je na výšku, stôl
 * prekryje výzva otočiť ho; rozloženie ostáva, aby sa po otočení nič nestratilo.
 */
export function stolNaSirku(z: Zhoda, mobil: boolean, iphone = false): { readonly naSirku: boolean; readonly otoc: boolean } {
  const telefon = mobil && !iphone && z(TELEFON);
  return { naSirku: telefon, otoc: telefon && z(NA_VYSKU) };
}

/**
 * Stránky mimo stola (Karty): telefón podľa toho istého dotazu ako stôl, bez ohľadu na rank
 * a značku — aj iPhone. `naVysku` rozhodne, či karty idú po jednej, alebo po troch.
 */
export function telefonStranky(z: Zhoda): { readonly telefon: boolean; readonly naVysku: boolean } {
  const telefon = z(TELEFON);
  return { telefon, naVysku: telefon && z(NA_VYSKU) };
}

/** Medzera medzi kartami vedľa seba na stránke Karty, telefón na šírku (px). */
export const MEDZERA_KARIET_TELEFON = 12;

/** Šírka karty na stránke Karty na telefóne: na výšku celá šírka mriežky, na šírku tretina bez medzier. */
export function sirkaKartyNaTelefone(sirkaMriezky: number, naVysku: boolean): number {
  const stlpce = naVysku ? 1 : 3;
  return Math.max(0, Math.floor((sirkaMriezky - (stlpce - 1) * MEDZERA_KARIET_TELEFON) / stlpce));
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
    // vypocet je čistá funkcia kľúča (mobil)
  }, [kluc]);
  return stav;
}

export function useNepodporovaneZariadenie(mobil = false): DovodNepodporovania | null {
  return useZhoda((z) => dovodNepodporovania(z, mobil, IPHONE), mobil);
}

export function useStolNaSirku(mobil: boolean): { readonly naSirku: boolean; readonly otoc: boolean } {
  return useZhoda((z) => stolNaSirku(z, mobil, IPHONE), mobil);
}

export function useTelefonStranky(): { readonly telefon: boolean; readonly naVysku: boolean } {
  return useZhoda(telefonStranky, null);
}

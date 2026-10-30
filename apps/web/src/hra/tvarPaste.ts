// Tvar ikony päste (vydesenie pri rozdeľovaní, Michal 2026-10-30) — dvojička krígľa
// z tvarPriazne.ts: rovnaká mriežka 0..100, plná silueta vo farbe rodiča, vnútorné
// ryhy vyrezané evenodd. Zovretá päsť spredu: štyri hánky hore, palec cez prsty.
//
// Pri 14 px nesú tvar hánky a hranatá silueta so zápästím; ryhy medzi prstami
// a zahnutý palec pribudnú od ≈ 20 px.

/**
 * Silueta: zápästie, ľavá dlaň s koreňom palca, štyri hánky (prostredník najvyššie,
 * malíček najnižšie) a pravá hrana dlane; pod ňou ryhy medzi prstami, spodok prstov,
 * hrot a spodok palca.
 */
const PAST =
  "M29 97L29 84C20 81 11 74 10 63L10 49C10 43 13 39 18 38L18 29C18 22 22 19 27 19" +
  "C31 19 34 21 35 24C36 16 40 12 46 12C51 12 54 15 55 19C56 15 60 14 64 14" +
  "C69 14 72 17 73 22C74 20 77 19 80 20C85 21 90 25 90 31L90 58C90 68 85 76 77 81L77 97Z" +
  "M33.5 27L37 27L37 43L33.5 43Z" +
  "M53.5 22L57 22L57 43L53.5 43Z" +
  "M71.5 25L75 25L75 45L71.5 45Z" +
  "M15 52C30 47 48 45 60 46C65 46.5 67 50 66 54L65 60L61.5 60L62.5 54C63 51 62 50 59.5 50C48 49.5 31 51 16 56Z" +
  "M68 49C75 48 81 48 86 50L86 54C81 52 75 52 68 53Z" +
  "M18 68C32 65 46 64 57 65L56 69C45 68 32 69 19 72Z";

export const CESTY_PASTE: readonly string[] = [PAST];

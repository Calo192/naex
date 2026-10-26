// Navigácia webu (Michal 2026-10-26, #23 variant A): Hrať prvé a zvýraznené, skupina
// hry a za oddeľovačom vývoj a komunita; správa webu v jednom menu „Správa ▾“ a menu
// účtu bez položiek, ktoré sú inde. Kto čo vidí, rozhoduje tu — Layout len kreslí.
// Práva stráži server; skrytý odkaz len šetrí hráča od stránky, ktorá ho odmietne.

import { jeSpravca, maPravo, type Pouzivatel, type Pravo } from "./ucet.tsx";

export interface PolozkaNavigacie {
  readonly href: string;
  readonly text: string;
  readonly skupina: "hra" | "komunita";
  /** Pri nedostatku miesta ide do „Viac ▾“ najprv položka s najnižšou prioritou; Hrať nikdy. */
  readonly priorita: number;
  /** Hlavná výzva (tlačidlo). */
  readonly hlavna?: boolean;
}

interface Definicia extends PolozkaNavigacie {
  readonly pravo?: Pravo;
}

const NAVIGACIA: readonly Definicia[] = [
  { href: "/hra", text: "Hrať", skupina: "hra", priorita: 99, hlavna: true },
  { href: "/pravidla", text: "Pravidlá", skupina: "hra", priorita: 6 },
  { href: "/karty", text: "Karty", skupina: "hra", priorita: 5 },
  { href: "/rebricek", text: "Rebríček", skupina: "hra", priorita: 4, pravo: "profily_inych" },
  { href: "/novinky", text: "Novinky", skupina: "komunita", priorita: 3 },
  { href: "/vyvoj", text: "Vývoj", skupina: "komunita", priorita: 2, pravo: "vidiet_vyvoj" },
  { href: "/spatna-vazba", text: "Spätná väzba", skupina: "komunita", priorita: 1 },
];

/**
 * Hlavné menu. Neprihlásený má práva Nealka (/api/ja ich pošle aj bez účtu);
 * bez nich (starý server) sa ukáže všetko ako doteraz — server aj tak overí.
 */
export function hlavneMenu(ja: Pouzivatel | null, pravaNavstevnika: readonly Pravo[] | null): PolozkaNavigacie[] {
  const smie = (p: Pravo): boolean => (ja !== null ? maPravo(ja, p) : pravaNavstevnika === null || pravaNavstevnika.includes(p));
  return NAVIGACIA.filter((n) => n.pravo === undefined || smie(n.pravo));
}

export interface PolozkaSpravy {
  readonly href: string;
  readonly text: string;
  /** Pri Playteste počet návrhov na rozhodnutie. */
  readonly pocet?: "navrhy";
}

/** Menu „Správa ▾“ — admin aj subadmin vidia všetko (stránky si práva strážia samé). */
export function spravaWebu(ja: Pouzivatel | null): PolozkaSpravy[] {
  if (ja === null || !jeSpravca(ja.rola)) return [];
  return [
    { href: "/playtest", text: "Playtest", pocet: "navrhy" },
    { href: "/admin", text: "Tvorba kariet" },
    { href: "/hraci", text: "Hráči" },
  ];
}

/**
 * Menu účtu: profil, štatistiky a odhlásenie. Rank s právom na reporty playtestov,
 * ktorý nie je správca, tu má Playtest — inde by ho nenašiel.
 */
export function menuUctu(ja: Pouzivatel): { readonly href: string; readonly text: string }[] {
  const polozky = [
    { href: "/profil", text: "Môj profil" },
    { href: `/hrac/${ja.id}`, text: "Moje štatistiky" },
  ];
  if (!jeSpravca(ja.rola) && maPravo(ja, "reporty_playtestov")) polozky.push({ href: "/playtest", text: "Reporty playtestov" });
  return polozky;
}

/** Aktívna položka: presná cesta alebo jej podstránka (/karty/dielna patrí Kartám). */
export const jeAktivna = (cesta: string, href: string): boolean => cesta === href || cesta.startsWith(`${href}/`);
